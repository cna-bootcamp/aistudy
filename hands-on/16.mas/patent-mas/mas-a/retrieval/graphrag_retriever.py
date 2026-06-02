"""MS GraphRAG 검색기 — 요건·권리·절차의 관계/커뮤니티 구조를 질의함.

역할(조문 벡터 RAG와 구분): 단일 조문 원문이 아니라, 엔티티(요건·권리·절차·기관) 사이의 관계와
커뮤니티 단위 요약을 활용하는 구조적 질의. Microsoft GraphRAG의 query API를 그대로 사용함.

  - Local Search  : 특정 엔티티 중심의 관계·근접 컨텍스트 (예: "신규성 요건과 연결된 절차")
  - Global Search : 커뮤니티 리포트 기반의 전체 주제·요약 (예: "특허 거절이유의 전반 구조")
  - DRIFT Search  : Global primer + Local follow-up 결합 (복합·다단계 추론)

선행 인덱싱(indexing/graphrag)의 Parquet + LanceDB를 '재인덱싱 없이' 조회함.
LLM/임베딩은 settings.yaml에 정의된 Groq gpt-oss-120b + OpenAI text-embedding-3-small을 사용함.
"""
from __future__ import annotations

import logging
from typing import Any

import pandas as pd
from graphrag.api import drift_search, global_search, local_search
from graphrag.config.load_config import load_config

from config.settings import Settings
from retrieval.async_utils import is_json_parse_error, run_async
from retrieval.types import SearchOutput, SourceItem

logger = logging.getLogger(__name__)

# GraphRAG가 노출하는 검색 모드 (basic은 조문 벡터 RAG와 역할이 겹쳐 제외 — 중복 검색 금지)
GRAPHRAG_MODES = ("local", "global", "drift")


class RetrievalError(RuntimeError):
    """필수 인덱싱 산출물이 없어 검색을 수행할 수 없을 때 발생."""


class GraphRAGRetriever:
    """선행 구축된 GraphRAG Parquet/LanceDB 위에서 Microsoft GraphRAG API 검색을 실행함."""

    def __init__(self, settings: Settings):
        self.settings = settings
        missing = settings.validate_stores()
        if missing:
            raise RetrievalError("필수 인덱싱 산출물이 없음: " + ", ".join(missing))

        # load_config에는 반드시 GraphRAG --root의 '절대경로'를 넘김.
        # vector_store.db_uri(store/vector/graphrag)가 이 루트 기준으로 해석되어야
        # Local/DRIFT가 LanceDB를 정확히 찾음 (CWD 기준으로 해석되면 빈 컨텍스트가 됨).
        self.config = load_config(settings.graphrag_root)
        self.response_type = settings.response_type
        self.community_level = settings.community_level
        self.drift_json_retries = settings.drift_json_retries
        self._frames: dict[str, pd.DataFrame] = {}  # Parquet 지연 로딩 캐시

    # -- 공개 진입점 ---------------------------------------------------------

    def search(self, query: str, mode: str) -> SearchOutput:
        """동기 진입점 — 내부적으로 async GraphRAG API를 안전한 루프 브리지로 실행함."""
        if mode not in GRAPHRAG_MODES:
            raise ValueError(f"GraphRAGRetriever가 처리할 수 없는 모드: {mode}")
        return run_async(self._search_async(query, mode))

    # -- 내부 검색 구현 ------------------------------------------------------

    async def _search_async(self, query: str, mode: str) -> SearchOutput:
        if mode == "local":
            answer, context = await self._local(query)
        elif mode == "global":
            answer, context = await global_search(
                config=self.config,
                entities=self._frame("entities"),
                communities=self._frame("communities"),
                community_reports=self._frame("community_reports"),
                community_level=self.community_level,
                dynamic_community_selection=False,
                response_type=self.response_type,
                query=query,
            )
        else:  # drift
            return await self._drift_with_fallback(query)

        sources = self._collect_sources(context)
        return SearchOutput(
            mode=mode,
            answer=str(answer).strip(),
            sources=sources,
            evidence={"sources": len(sources)},
        )

    async def _local(self, query: str) -> tuple[Any, Any]:
        return await local_search(
            config=self.config,
            entities=self._frame("entities"),
            communities=self._frame("communities"),
            community_reports=self._frame("community_reports"),
            text_units=self._frame("text_units"),
            relationships=self._frame("relationships"),
            covariates=self._optional_frame("covariates"),
            community_level=self.community_level,
            response_type=self.response_type,
            query=query,
        )

    async def _drift_with_fallback(self, query: str) -> SearchOutput:
        """DRIFT Search를 시도하되, primer JSON 파싱이 반복 실패하면 Local Search로 폴백함."""
        errors: list[str] = []
        for attempt in range(self.drift_json_retries + 1):
            try:
                answer, context = await drift_search(
                    config=self.config,
                    entities=self._frame("entities"),
                    communities=self._frame("communities"),
                    community_reports=self._frame("community_reports"),
                    text_units=self._frame("text_units"),
                    relationships=self._frame("relationships"),
                    community_level=self.community_level,
                    response_type=self.response_type,
                    query=query,
                )
                sources = self._collect_sources(context)
                return SearchOutput(
                    mode="drift",
                    answer=str(answer).strip(),
                    sources=sources,
                    evidence={"sources": len(sources)},
                )
            except Exception as exc:
                if not is_json_parse_error(exc):
                    raise  # JSON 외 오류는 그대로 전파
                errors.append(f"attempt={attempt + 1}: {exc}")

        # 재시도 소진 → Local Search로 폴백 (graceful degradation)
        answer, context = await self._local(query)
        note = (
            f"DRIFT primer JSON 파싱 실패가 {len(errors)}회 반복되어 "
            f"Local Search로 폴백함"
        )
        logger.warning(note)
        return SearchOutput(
            mode="local",
            answer=str(answer).strip(),
            sources=self._collect_sources(context),
            note=note,
        )

    # -- Parquet 로딩 --------------------------------------------------------

    def _frame(self, name: str) -> pd.DataFrame:
        """필수 Parquet 프레임을 지연 로딩함 (검색마다 재읽기 방지)."""
        if name not in self._frames:
            path = self.settings.graphrag_parquet_dir / f"{name}.parquet"
            if not path.exists():
                raise RetrievalError(f"필수 Parquet 파일 없음: {path}")
            self._frames[name] = pd.read_parquet(path)
        return self._frames[name]

    def _optional_frame(self, name: str) -> pd.DataFrame | None:
        """선택적 Parquet 프레임을 지연 로딩함 (없으면 None)."""
        path = self.settings.graphrag_parquet_dir / f"{name}.parquet"
        if not path.exists():
            return None
        return self._frame(name)

    # -- 컨텍스트 → 출처 변환 ------------------------------------------------

    def _collect_sources(self, context_data: Any) -> list[SourceItem]:
        """GraphRAG 컨텍스트(엔티티/관계/리포트 프레임)를 간결한 표시용 출처로 변환함."""
        max_items = self.settings.graph_top_sources
        sources: list[SourceItem] = []
        for source_type, frame in _iter_context_frames(context_data):
            if frame.empty:
                continue
            for _, row in frame.head(max_items).iterrows():
                sources.append(_source_from_row(source_type, row))
                if len(sources) >= max_items:
                    return sources
        return sources

    # -- KG 통계/스키마 (MCP Resource용) ------------------------------------

    def kg_stats(self) -> dict[str, Any]:
        """KG 규모 통계를 반환함 — 엔티티/관계/커뮤니티/텍스트유닛 수 + 엔티티 타입 분포."""
        entities = self._frame("entities")
        relationships = self._frame("relationships")
        communities = self._frame("communities")
        community_reports = self._frame("community_reports")
        text_units = self._frame("text_units")

        type_col = "type" if "type" in entities.columns else None
        type_counts = (
            {str(k): int(v) for k, v in entities[type_col].value_counts().items()}
            if type_col else {}
        )
        return {
            "entity_count": int(len(entities)),
            "relationship_count": int(len(relationships)),
            "community_count": int(len(communities)),
            "community_report_count": int(len(community_reports)),
            "text_unit_count": int(len(text_units)),
            "entity_types": type_counts,
        }

    def kg_schema(self) -> str:
        """KG 스키마를 사람이 읽기 좋은 문자열로 반환함 (엔티티 타입·인덱스 구성)."""
        stats = self.kg_stats()
        types = ", ".join(f"{k}({v})" for k, v in stats["entity_types"].items()) or "(타입 정보 없음)"
        lines = [
            "[특허법 Knowledge Graph 스키마]",
            f"- 노드(엔티티): {stats['entity_count']}개  / 관계(엣지): {stats['relationship_count']}개",
            f"- 커뮤니티: {stats['community_count']}개 / 커뮤니티 리포트: {stats['community_report_count']}개",
            f"- 텍스트 유닛: {stats['text_unit_count']}개",
            f"- 엔티티 타입 분포: {types}",
            "- 벡터 인덱스(LanceDB): entity_description / text_unit_text / community_full_content (각 1536d)",
            "- 검색 모드: local(엔티티 관계) / global(커뮤니티 요약) / drift(복합 추론)",
        ]
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# GraphRAG 컨텍스트 정규화 헬퍼 (콜백 변형마다 모양이 달라 방어적으로 처리)
# ---------------------------------------------------------------------------

def _iter_context_frames(context_data: Any) -> list[tuple[str, pd.DataFrame]]:
    """GraphRAG 컨텍스트에서 이름 붙은 DataFrame 목록을 추출함."""
    frames: list[tuple[str, pd.DataFrame]] = []
    if isinstance(context_data, pd.DataFrame):
        frames.append(("context", context_data))
    elif isinstance(context_data, dict):
        for name, value in context_data.items():
            if isinstance(value, pd.DataFrame):
                frames.append((str(name), value))
            elif isinstance(value, list) and value and isinstance(value[0], dict):
                frames.append((str(name), pd.DataFrame(value)))
    elif isinstance(context_data, list):
        for idx, value in enumerate(context_data):
            if isinstance(value, pd.DataFrame):
                frames.append((f"context_{idx}", value))
    return frames


def _source_from_row(source_type: str, row: pd.Series) -> SourceItem:
    """GraphRAG 컨텍스트 행 하나를 표시용 SourceItem으로 변환함."""
    data = row.to_dict()
    title = _first_present(data, ["title", "source", "id", "community", "human_readable_id"])
    if "source" in data and "target" in data:  # 관계(relationship) 행
        title = f"{data.get('source')} -> {data.get('target')}"
    content = _first_present(
        data, ["description", "summary", "text", "full_content", "content", "report"]
    )
    metadata = {
        key: _stringify(value)
        for key, value in data.items()
        if key not in {"text", "full_content", "summary", "description", "content", "report"}
    }
    return SourceItem(
        source_type=source_type,
        title=_stringify(title)[:160],
        content=_stringify(content)[:1200],  # MCP 응답 간결화
        metadata=metadata,
    )


def _first_present(data: dict[str, Any], keys: list[str]) -> Any:
    """딕셔너리에서 첫 번째로 비어있지 않은 필드를 반환함."""
    for key in keys:
        value = data.get(key)
        if value is not None and str(value).strip():
            return value
    return ""


def _stringify(value: Any) -> str:
    """리스트/딕셔너리 등을 안전한 문자열로 변환함."""
    if isinstance(value, (dict, list, tuple)):
        import json

        return json.dumps(value, ensure_ascii=False, default=str)
    return str(value)
