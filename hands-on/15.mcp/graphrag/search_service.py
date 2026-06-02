"""AI 에이전트 개발 지원 서비스 — 검색 오케스트레이터.

비즈니스 시나리오의 4단계 흐름을 한 곳에서 조립함.
  1) 사용자 요청 접수      → answer(question, mode)
  2) 검색 방법 결정        → QueryRouter (auto면 패턴/LLM 라우팅, 그 외면 호출자 지정 모드)
  3) 결정된 방법으로 검색  → QueryEngine (vector / graph_qa / hybrid / cypher)
  4) 검색 결과를 LLM에 보내 답변 생성 → QueryEngine 내부에서 Groq LPU 호출

MCP 서버(server.py)와 테스트(test_e2e.py)가 공통으로 사용하는 진입점임.
무거운 초기화(Neo4j 연결, 임베딩 래퍼, GraphCypherQAChain 빌드)는 한 번만 수행하도록 설계함.
"""
import logging
from typing import Any

from config.settings import Settings
from graph.neo4j_connection import Neo4jConnection
from query.query_engine import QueryEngine
from query.router import QueryRouter

logger = logging.getLogger(__name__)

# MCP 호출자가 지정할 수 있는 검색 모드 (auto는 라우터가 자동 결정)
VALID_MODES = {"auto", "vector", "graph_qa", "hybrid", "cypher"}


class SearchService:
    """검색 파이프라인 전체를 캡슐화한 서비스."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or Settings()
        # LLM 호출 전에 키 존재를 먼저 검증 — 미설정 시 답변 단계 401 대신 초기화 시점에 즉시 실패
        self.settings.ensure_groq_api_key()
        self.connection = Neo4jConnection(self.settings)
        self.engine = QueryEngine(self.settings, self.connection.graph)
        self.router = QueryRouter(self.settings)
        logger.info("SearchService 초기화 완료 (model=%s)", self.settings.groq_model)

    def answer(self, question: str, mode: str = "auto") -> dict[str, Any]:
        """질문을 받아 검색 방법을 결정·실행하고 답변 결과 딕셔너리를 반환함.

        반환 딕셔너리에 requested_mode/resolved_mode/route_reason을 포함해
        "서버가 어떤 검색 방법을 왜 골랐는지"를 호출자가 관찰·검증할 수 있게 함.
        """
        question = (question or "").strip()
        if not question:
            return {
                "answer": "질문이 비어 있습니다. 검색할 내용을 입력하세요.",
                "requested_mode": mode,
                "resolved_mode": None,
                "route_reason": "빈 질문",
                "sources": [],
                "error": True,
            }

        requested_mode = (mode or "auto").lower().strip()
        if requested_mode not in VALID_MODES:
            logger.warning("알 수 없는 모드 '%s' → auto로 대체", requested_mode)
            requested_mode = "auto"

        # 2단계: 검색 방법 결정
        if requested_mode == "auto":
            decision = self.router.route(question, "Auto")
            resolved_mode, route_reason = decision.mode, decision.reason
        else:
            resolved_mode, route_reason = requested_mode, "MCP 호출자 지정 모드"

        logger.info("질문='%s' → 모드=%s (%s)", question[:60], resolved_mode, route_reason)

        # 3·4단계: 결정된 방법으로 검색 + LLM 답변 생성 (cypher 모드는 행 리스트를 직접 반환)
        result = self.engine.search(question, resolved_mode)

        # 검색 결과에 라우팅 메타를 덧붙여 반환
        result.setdefault("sources", [])
        result["question"] = question
        result["requested_mode"] = requested_mode
        result["resolved_mode"] = resolved_mode
        result["route_reason"] = route_reason
        return result

    def kg_stats(self) -> dict[str, Any]:
        """KG 노드/관계/라벨 통계 반환 (MCP Resource용)."""
        return self.connection.get_stats()

    def kg_schema(self) -> str:
        """KG 스키마 문자열 반환 (MCP Resource용)."""
        return self.connection.get_schema()

    def health(self) -> dict[str, Any]:
        """Neo4j 연결·벡터 차원 상태를 점검해 요약 반환."""
        warnings = self.connection.validate_vector_dimensions()
        stats = self.connection.get_stats()
        return {
            "neo4j_uri": self.settings.neo4j_uri,
            "groq_model": self.settings.groq_model,
            "embedding_model": self.settings.embedding_model,
            "vector_dim_warnings": warnings or ["OK (4096 일치)"],
            "node_count": stats["node_count"],
            "entity_count": stats["entity_count"],
            "chunk_count": stats["chunk_count"],
            "relationship_count": stats["relationship_count"],
        }
