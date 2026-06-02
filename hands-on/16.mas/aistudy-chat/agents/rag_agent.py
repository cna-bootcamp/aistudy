"""RAG Agent (KG + Vector DB 검색)

기존 Microsoft GraphRAG 산출물(hands-on/14.graphrag/ms-graphrag/store)을 그대로 재사용함.
무거운 GraphRAG API(local/global/drift, 멀티 LLM 호출) 대신 LanceDB 직접 벡터검색을 사용해
로컬 qwen3:8b 환경에서도 빠르고 안정적으로 동작하도록 설계함.

스토어 구조 (인덱싱 시 qwen3-embedding=4096차원으로 구축):
  store/vector/graphrag/
    - text_unit_text      : 교재 청크 임베딩 (id + vector만 보유 → text_units.parquet과 id 조인)
    - entity_description  : KG 엔티티 임베딩 (id + vector만 보유 → entities.parquet과 id 조인)
  store/vector/code/
    - code_chunks         : 예제코드 청크 임베딩 (text 직접 보유)

교재 검색은 Vector(text_unit) + KG(entity)를 함께 사용하여 "KG와 Vector DB 모두 사용" 요건을 충족함.
"""
from __future__ import annotations

from typing import Optional

import lancedb  # 로컬 임베딩 벡터 DB (GraphRAG가 산출한 .lance 테이블 읽기)
import pandas as pd  # Parquet(text_units/entities) 로드 및 id 조인

from config.settings import settings, AGENTS
from llm.ollama_embeddings import OllamaEmbeddings
from utils.logger import get_logger

logger = get_logger("agents.rag")


class RAGAgent:
    """LanceDB 벡터검색 + Parquet 조인으로 교재/코드/KG를 검색하는 Agent."""

    def __init__(self, embeddings: Optional[OllamaEmbeddings] = None) -> None:
        """RAG Agent 초기화 — LanceDB 연결과 Parquet 프레임을 지연 로딩으로 준비함."""
        self.embeddings = embeddings or OllamaEmbeddings()
        self.agent_info = AGENTS.get("rag_agent", {})
        self.name = self.agent_info.get("name", "RAG Agent")

        # LanceDB 연결 (graphrag: 교재/엔티티, code: 예제코드)
        self._graph_db = lancedb.connect(str(settings.graphrag_vector_dir))
        self._code_db = lancedb.connect(str(settings.code_vector_dir))

        # Parquet 프레임 캐시 — 최초 사용 시 한 번만 로드 (id → text/메타 조인용)
        self._frames: dict[str, pd.DataFrame] = {}

    # --- Parquet 로딩 헬퍼 -------------------------------------------------

    def _frame(self, name: str) -> pd.DataFrame:
        """필요한 Parquet 프레임을 지연 로딩하여 반환함 (캐시)."""
        if name not in self._frames:
            path = settings.parquet_dir / f"{name}.parquet"
            self._frames[name] = pd.read_parquet(path)
        return self._frames[name]

    # --- 교재 검색 (Vector + KG) ------------------------------------------

    def search_textbook(self, query: str, top_k: Optional[int] = None) -> list[dict]:
        """교재 텍스트 유닛을 벡터검색하고 Parquet 본문과 조인하여 반환함.

        반환 각 dict: {content, source(파일명), section, score, kind="textbook"}
        """
        top_k = top_k or settings.textbook_top_k
        try:
            query_vector = self.embeddings.embed_query(query)
            # text_unit_text: id + vector만 보유 → 검색 결과 id로 text_units.parquet 조인
            table = self._graph_db.open_table("text_unit_text")
            hits = table.search(query_vector).limit(top_k).to_pandas()

            text_units = self._frame("text_units").set_index("id")
            results: list[dict] = []
            for _, hit in hits.iterrows():
                tid = hit["id"]
                if tid not in text_units.index:
                    continue
                raw_text = str(text_units.loc[tid, "text"])
                results.append({
                    "content": raw_text[: settings.context_chunk_max_chars],
                    "source": _extract_meta(raw_text, "File") or "교재",
                    "section": _extract_meta(raw_text, "Section") or "",
                    # _distance(작을수록 유사) → 0~1 유사도 점수로 변환하여 표시·평가에 사용
                    "score": _distance_to_score(float(hit.get("_distance", 1.0))),
                    "kind": "textbook",
                })
            logger.info(f"[RAG] 교재 검색: {len(results)}건")
            return results
        except Exception as e:
            logger.error(f"교재 검색 실패: {e}")
            return []

    def search_entities(self, query: str, top_k: Optional[int] = None) -> list[dict]:
        """KG 엔티티 설명을 벡터검색하고 entities.parquet과 조인하여 반환함.

        Knowledge Graph(엔티티/관계 그래프)의 노드 설명을 검색에 활용하여 답변 근거를 보강함.
        반환 각 dict: {content, source(엔티티명), section(타입), score, kind="entity"}
        """
        top_k = top_k or settings.entity_top_k
        try:
            query_vector = self.embeddings.embed_query(query)
            # entity_description: id + vector만 보유 → entities.parquet과 id 조인
            table = self._graph_db.open_table("entity_description")
            hits = table.search(query_vector).limit(top_k).to_pandas()

            entities = self._frame("entities").set_index("id")
            results: list[dict] = []
            for _, hit in hits.iterrows():
                eid = hit["id"]
                if eid not in entities.index:
                    continue
                row = entities.loc[eid]
                title = str(row.get("title", ""))
                description = str(row.get("description", ""))
                results.append({
                    "content": description[: settings.context_chunk_max_chars],
                    "source": title,
                    "section": str(row.get("type", "")),
                    "score": _distance_to_score(float(hit.get("_distance", 1.0))),
                    "kind": "entity",
                })
            logger.info(f"[RAG] KG 엔티티 검색: {len(results)}건")
            return results
        except Exception as e:
            logger.error(f"엔티티 검색 실패: {e}")
            return []

    # --- 코드 검색 --------------------------------------------------------

    def search_code(self, query: str, top_k: Optional[int] = None) -> list[dict]:
        """예제코드 청크를 벡터검색하여 반환함 (code_chunks는 text를 직접 보유).

        반환 각 dict: {content, source(파일경로), section(섹션명), filename, score, kind="code"}
        """
        top_k = top_k or settings.code_top_k
        try:
            query_vector = self.embeddings.embed_query(query)
            table = self._code_db.open_table("code_chunks")
            hits = table.search(query_vector).limit(top_k).to_pandas()

            results: list[dict] = []
            for _, hit in hits.iterrows():
                results.append({
                    "content": str(hit.get("text", ""))[: settings.context_chunk_max_chars],
                    "source": str(hit.get("source", "")),
                    "filename": str(hit.get("filename", "")),
                    "section": str(hit.get("section_title", "")),
                    "score": _distance_to_score(float(hit.get("_distance", 1.0))),
                    "kind": "code",
                })
            logger.info(f"[RAG] 코드 검색: {len(results)}건")
            return results
        except Exception as e:
            logger.error(f"코드 검색 실패: {e}")
            return []

    # --- 컨텍스트 포맷 ----------------------------------------------------

    def format_context(self, results: list[dict]) -> str:
        """검색 결과 리스트를 LLM 프롬프트용 컨텍스트 문자열로 포맷함."""
        if not results:
            return "관련 문서를 찾을 수 없음."
        parts = []
        for i, r in enumerate(results, 1):
            source = r.get("filename") or r.get("source", "unknown")
            section = r.get("section", "")
            label = f"{source}" + (f" :: {section}" if section else "")
            parts.append(f"[자료 {i}] ({r.get('kind', '')}) {label} (관련도: {r.get('score', 0):.2f})\n{r.get('content', '')}")
        return "\n\n---\n\n".join(parts)


# ---------------------------------------------------------------------------
# 모듈 수준 헬퍼
# ---------------------------------------------------------------------------

def _distance_to_score(distance: float) -> float:
    """LanceDB의 _distance(작을수록 유사)를 0~1 유사도 점수로 변환함.

    cosine/L2 거리 d에 대해 1/(1+d)로 단조 감소 변환 — 거리가 0이면 1.0, 멀수록 0에 수렴.
    """
    return round(1.0 / (1.0 + max(distance, 0.0)), 4)


def _extract_meta(text: str, key: str) -> str:
    """text 앞머리의 "[File: ...]" / "[Section: ...]" 메타 토큰에서 값을 추출함.

    인덱싱 시 각 교재 청크 앞에 [Source: ..][File: ..][Section: ..] 형태로 출처가 삽입되어 있음.
    """
    import re
    match = re.search(rf"\[{key}:\s*([^\]]+)\]", text)
    return match.group(1).strip() if match else ""
