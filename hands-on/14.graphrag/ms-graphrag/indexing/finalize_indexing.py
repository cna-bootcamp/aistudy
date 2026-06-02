#!/usr/bin/env python
"""GraphRAG 인덱싱 후처리 스크립트

GraphRAG CLI 인덱싱(graphrag index) 이후 추가로 필요한 보완 작업을 수행함.
  1. 엔티티 임베딩 누락분 보완 (Ollama OOM/타임아웃으로 누락된 경우 수동 생성)
  2. 커뮤니티 리포트 full_content 임베딩 생성 (DRIFT Search용)
  3. LanceDB community_full_content 테이블 생성 (DRIFT Search용)

대상 경로 (교재 GraphRAG 산출물):
  - Parquet: store/parquet
  - LanceDB: store/vector/graphrag
"""
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

import pandas as pd
import requests
import lancedb
from tqdm import tqdm

# indexing 디렉터리를 모듈 검색 경로에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent))
from config.settings import settings
from utils.logger import get_logger

logger = get_logger("finalize_indexing")

EMBED_WORKERS = 4  # 임베딩 병렬 워커 수


def get_ollama_embedding(text: str, model: str) -> list[float] | None:
    """Ollama API로 텍스트 1건을 임베딩함 (실패 시 None)."""
    url = f"{settings.ollama_base_url}/api/embeddings"
    try:
        response = requests.post(url, json={"model": model, "prompt": text}, timeout=120)
        if response.status_code == 200:
            return response.json().get("embedding")
        logger.warning("임베딩 실패(status=%s)", response.status_code)
        return None
    except Exception as e:
        logger.warning("Ollama 연결 오류: %s", e)
        return None


def generate_missing_entity_embeddings(parquet_dir: Path) -> bool:
    """누락된 엔티티 임베딩을 수동 생성함.

    GraphRAG 인덱싱 중 Ollama OOM/타임아웃으로 임베딩이 누락된 경우를 보완함.
    이미 엔티티의 90% 이상 임베딩이 있으면 건너뜀.

    Args:
        parquet_dir: GraphRAG Parquet 출력 디렉터리 (store/parquet)

    Returns:
        성공 여부
    """
    entities_path = parquet_dir / "entities.parquet"
    embedding_path = parquet_dir / "embeddings.entity_description.parquet"

    if not entities_path.exists():
        logger.error("entities.parquet 없음 - 엔티티 임베딩 보완 불가")
        return False

    entities_df = pd.read_parquet(entities_path)

    # 이미 임베딩이 충분하면(엔티티의 90% 이상) 재생성을 건너뜀
    if embedding_path.exists():
        try:
            emb_df = pd.read_parquet(embedding_path)
            if len(emb_df) >= len(entities_df) * 0.9:
                logger.info("엔티티 임베딩이 이미 충분함 (%d/%d) - 건너뜀", len(emb_df), len(entities_df))
                return True
        except Exception:
            pass  # 파일 손상 시 재생성

    # description이 없으면 title로 대체
    if "description" not in entities_df.columns:
        entities_df["description"] = entities_df["title"]
    entities_df["description"] = entities_df["description"].fillna(entities_df["title"])

    logger.info("엔티티 임베딩 수동 생성 시작: %d개", len(entities_df))
    model_name = settings.embedding_model
    embeddings, ids = [], []

    with ThreadPoolExecutor(max_workers=EMBED_WORKERS) as executor:
        futures = [
            executor.submit(get_ollama_embedding, f"{row['title']}: {row['description']}", model_name)
            for _, row in entities_df.iterrows()
        ]
        for (_, row), future in tqdm(zip(entities_df.iterrows(), futures), total=len(entities_df), desc="엔티티 임베딩", ncols=80):
            emb = future.result()
            if emb is not None:
                embeddings.append(emb)
                ids.append(row["id"])

    if not embeddings:
        logger.error("엔티티 임베딩 생성 실패")
        return False

    pd.DataFrame({"id": ids, "embedding": embeddings}).to_parquet(embedding_path)
    logger.info("엔티티 임베딩 저장 완료: %d개", len(ids))
    return True


def generate_community_report_embeddings(parquet_dir: Path, lancedb_dir: Path) -> bool:
    """커뮤니티 리포트 full_content 임베딩을 생성하고 LanceDB 테이블을 만듦 (DRIFT Search용).

    DRIFT Search는 community_reports의 full_content 임베딩이 필요함.
    GraphRAG에서 자동 생성되지 않으면 여기서 보완함.

    Args:
        parquet_dir: GraphRAG Parquet 출력 디렉터리 (store/parquet)
        lancedb_dir: GraphRAG LanceDB 디렉터리 (store/vector/graphrag)

    Returns:
        성공 여부
    """
    cr_path = parquet_dir / "community_reports.parquet"
    if not cr_path.exists():
        logger.warning("community_reports.parquet 없음 - DRIFT 임베딩 건너뜀")
        return False

    cr_df = pd.read_parquet(cr_path)
    if len(cr_df) == 0:
        logger.warning("community_reports가 비어있음 - DRIFT 임베딩 건너뜀")
        return False

    # 이미 임베딩이 90% 이상 있으면 재생성을 건너뜀
    if "full_content_embedding" in cr_df.columns:
        non_null = cr_df["full_content_embedding"].notna().sum()
        if non_null >= len(cr_df) * 0.9:
            logger.info("커뮤니티 리포트 임베딩이 이미 충분함 (%d/%d)", non_null, len(cr_df))
        else:
            cr_df = _embed_community_reports(cr_df, cr_path)
    else:
        cr_df = _embed_community_reports(cr_df, cr_path)

    # LanceDB community_full_content 테이블 생성 (DRIFT Search 진입점)
    return _build_community_lancedb(cr_df, lancedb_dir)


def _embed_community_reports(cr_df: pd.DataFrame, cr_path: Path) -> pd.DataFrame:
    """커뮤니티 리포트의 full_content를 임베딩하여 컬럼으로 추가·저장함."""
    logger.info("커뮤니티 리포트 임베딩 생성 시작: %d개", len(cr_df))
    model_name = settings.embedding_model
    embeddings = []

    with ThreadPoolExecutor(max_workers=EMBED_WORKERS) as executor:
        futures = []
        for _, row in cr_df.iterrows():
            # full_content 우선, 없으면 summary 사용 (입력 길이 4000자 제한)
            text = str(row.get("full_content", "") or row.get("summary", ""))[:4000]
            futures.append(executor.submit(get_ollama_embedding, text, model_name))
        for future in tqdm(futures, total=len(cr_df), desc="커뮤니티 임베딩", ncols=80):
            embeddings.append(future.result())  # None도 순서 보존을 위해 포함

    cr_df = cr_df.reset_index(drop=True)
    cr_df["full_content_embedding"] = embeddings
    cr_df.to_parquet(cr_path)
    success = sum(1 for e in embeddings if e is not None)
    logger.info("커뮤니티 리포트 임베딩 저장 완료: %d/%d", success, len(cr_df))
    return cr_df


def _build_community_lancedb(cr_df: pd.DataFrame, lancedb_dir: Path) -> bool:
    """community_full_content LanceDB 테이블을 생성함 (DRIFT Search용)."""
    try:
        lancedb_dir.mkdir(parents=True, exist_ok=True)
        db = lancedb.connect(str(lancedb_dir))
        cr_df = cr_df.reset_index(drop=True)

        rows = []
        for _, row in cr_df.iterrows():
            emb = row.get("full_content_embedding")
            if emb is not None:
                rows.append({
                    "id": str(row["id"]),
                    "text": str(row.get("full_content", ""))[:2000],
                    "vector": emb,
                })

        if not rows:
            logger.warning("유효한 커뮤니티 임베딩이 없어 LanceDB 테이블 생성을 건너뜀")
            return False

        table_name = "community_full_content"
        if table_name in db.table_names():
            db.drop_table(table_name)
        db.create_table(table_name, rows)
        logger.info("LanceDB '%s' 테이블 생성 완료: %d개", table_name, len(rows))
        return True
    except Exception as e:
        logger.warning("community_full_content LanceDB 생성 실패: %s", e)
        return False


def finalize_indexing() -> None:
    """인덱싱 후처리 진입점.

    index_documents.py의 GraphRAG 인덱싱 직후 자동 호출됨.
    1) 엔티티 임베딩 보완 → 2) 커뮤니티 리포트 임베딩 + LanceDB 테이블(DRIFT) 생성.
    """
    parquet_dir = settings.parquet_dir
    lancedb_dir = settings.graphrag_vector_dir

    logger.info("=== 인덱싱 후처리 시작 ===")
    generate_missing_entity_embeddings(parquet_dir)
    generate_community_report_embeddings(parquet_dir, lancedb_dir)
    logger.info("=== 인덱싱 후처리 완료 ===")


# 직접 실행 시 후처리만 단독 수행 (import 시 미실행)
if __name__ == "__main__":
    finalize_indexing()
