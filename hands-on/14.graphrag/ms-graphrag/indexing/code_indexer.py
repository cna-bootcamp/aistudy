#!/usr/bin/env python
"""예제코드 전용 벡터 인덱스 빌더 (KG 미생성, Vector만)

예제코드(hands-on/**/*.py)는 절차적 특성상 벡터 유사도 검색이 적합하므로,
GraphRAG 파이프라인(KG 구축)에 포함하지 않고 별도 LanceDB 벡터 인덱스를 구축함.

[처리 흐름]
  1. DocumentLoader.load_code(): 예제코드를 AST 기반 청크로 변환
  2. Ollama qwen3-embedding: 각 청크를 4096차원 벡터로 임베딩
  3. LanceDB(store/vector/code): code_chunks 테이블로 저장

[핵심 개념]
  - LanceDB: 로컬 파일 기반 벡터 DB (유사도 검색용)
  - qwen3-embedding: Ollama 로컬 임베딩 모델 (4096차원)
"""
import sys
from collections import Counter
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

import requests                                 # Ollama HTTP API 호출용
import lancedb                                  # 로컬 벡터 DB
from tqdm import tqdm

# indexing 디렉터리를 모듈 검색 경로에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent))
from config.settings import settings
from document_loader import GraphRAGDocumentLoader, GraphRAGDocument
from utils.logger import get_logger

logger = get_logger("code_indexer")

CODE_TABLE_NAME = "code_chunks"  # 예제코드 벡터 인덱스 테이블명
EMBED_WORKERS = 4                # 임베딩 병렬 워커 수 (OLLAMA_NUM_PARALLEL과 맞춤)


def get_ollama_embedding(text: str, model: str) -> list[float] | None:
    """Ollama API로 텍스트 1건을 임베딩함.

    Args:
        text: 임베딩할 텍스트
        model: 임베딩 모델명 (qwen3-embedding)

    Returns:
        임베딩 벡터(리스트) 또는 None(실패 시)
    """
    url = f"{settings.ollama_base_url}/api/embeddings"
    # Ollama 임베딩 API는 단일 입력 키로 "prompt"를 사용함
    payload = {"model": model, "prompt": text}
    try:
        response = requests.post(url, json=payload, timeout=120)
        if response.status_code == 200:
            return response.json().get("embedding")
        logger.warning("임베딩 실패(status=%s): %s", response.status_code, response.text[:200])
        return None
    except Exception as e:
        logger.warning("Ollama 연결 오류: %s", e)
        return None


def build_code_vector_index(documents: list[GraphRAGDocument]) -> bool:
    """예제코드 청크를 임베딩하여 LanceDB 벡터 인덱스로 저장함.

    Args:
        documents: 예제코드 GraphRAGDocument 리스트

    Returns:
        성공 여부
    """
    if not documents:
        logger.warning("예제코드 문서가 없어 벡터 인덱스를 건너뜀")
        return False

    model_name = settings.embedding_model
    logger.info("예제코드 임베딩 시작: %d개 청크 (모델=%s)", len(documents), model_name)

    # 병렬로 임베딩 생성 (제출 순서를 보존해 메타데이터와 1:1 매핑)
    with ThreadPoolExecutor(max_workers=EMBED_WORKERS) as executor:
        futures = [executor.submit(get_ollama_embedding, doc.content, model_name) for doc in documents]
        rows = []
        for doc, future in tqdm(zip(documents, futures), total=len(documents), desc="코드 임베딩", ncols=80):
            embedding = future.result()
            if embedding is None:
                continue  # 실패 청크는 제외
            rows.append({
                "id": f"{doc.get_output_filename()}",                  # 청크 고유 ID
                "vector": embedding,                                    # 임베딩 벡터 (LanceDB는 'vector' 컬럼 요구)
                "text": doc.content[:4000],                             # 원문 (검색 결과 표시용, 길이 제한)
                "source": doc.metadata["source"],                      # 원본 파일 절대경로
                "filename": doc.metadata["filename"],                  # 파일명
                "chunk_index": int(doc.metadata["chunk_index"]),       # 청크 인덱스
                "section_title": doc.metadata["section_title"],         # 함수/클래스명
            })

    if not rows:
        logger.error("임베딩에 성공한 청크가 없음 (Ollama 서버 확인 필요)")
        return False

    # 지배적인 차원을 결정하고 비정상 벡터(길이 0 또는 불일치) 필터링
    # Ollama는 빈/공백 텍스트에 [] 반환 → None이 아니라서 위 None 체크를 통과함
    # LanceDB는 첫 row로 스키마(FixedSizeList 차원)를 추론하므로 사전 필터 필수
    dim_counter = Counter(len(r["vector"]) for r in rows)
    dominant_dim = dim_counter.most_common(1)[0][0]
    valid_rows = [r for r in rows if len(r["vector"]) == dominant_dim]
    dropped = len(rows) - len(valid_rows)
    if dropped:
        logger.warning("비정상 벡터 %d개 제외 (차원 분포: %s → 유효 차원: %d)",
                       dropped, dict(dim_counter), dominant_dim)
    rows = valid_rows

    if not rows:
        logger.error("유효한 벡터가 없음")
        return False

    logger.info("인덱싱 대상: %d개 (전체 %d개 중 %d개 제외)",
                len(rows), len(rows) + dropped, dropped)

    # LanceDB에 연결하여 테이블을 재구성함 (항상 최신 데이터로 갱신)
    settings.code_vector_dir.mkdir(parents=True, exist_ok=True)
    db = lancedb.connect(str(settings.code_vector_dir))
    if CODE_TABLE_NAME in db.table_names():
        db.drop_table(CODE_TABLE_NAME)
    db.create_table(CODE_TABLE_NAME, rows)
    logger.info("예제코드 벡터 인덱스 생성 완료: %d개 (%s/%s.lance)",
                len(rows), settings.code_vector_dir, CODE_TABLE_NAME)
    return True


def index_code(mode: str = "full", documents: list[GraphRAGDocument] | None = None) -> bool:
    """예제코드 벡터 인덱싱 진입점.

    Args:
        mode: "full"(전체) 또는 "test"(소량)
        documents: 외부에서 미리 로드한 문서 (test 모드에서 재사용)

    Returns:
        성공 여부
    """
    if documents is None:
        loader = GraphRAGDocumentLoader()
        if mode == "test":
            _, documents = loader.load_specific_files()
        else:
            documents = loader.load_code()
    return build_code_vector_index(documents)


# 직접 실행 시 전체 예제코드 인덱싱 수행 (import 시 미실행)
if __name__ == "__main__":
    ok = index_code(mode="test" if "--mode" in sys.argv and "test" in sys.argv else "full")
    sys.exit(0 if ok else 1)
