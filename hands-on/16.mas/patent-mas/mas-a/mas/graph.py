"""SAS 워크플로 조립 — LangGraph StateGraph로 Scheduler→Agent→Supervisor를 연결함.

그래프 형태:
    START → scheduler → agent → supervisor ─┬─(retry)──→ agent
                                            ├─(fuse)───→ fuse → END
                                            └─(end)────→ END

PatentLawMAS는 무거운 초기화(ChromaDB 연결, GraphRAG Parquet/LanceDB, LLM)를 1회만 수행하고
answer(question, mode)로 동기 검색 진입점을 제공함. server.py와 테스트가 공통으로 사용함.
"""
from __future__ import annotations

import logging

from langgraph.graph import END, START, StateGraph

from config.settings import Settings, settings as default_settings
from mas.nodes import MASNodes
from mas.router import QueryRouter
from mas.state import PatentLawState
from retrieval.graphrag_retriever import GraphRAGRetriever
from retrieval.vector_retriever import VectorRetriever

logger = logging.getLogger(__name__)

# 호출자가 지정할 수 있는 모드(auto 포함)
VALID_REQUEST_MODES = {"auto", "vector", "local", "global", "drift"}


class PatentLawMAS:
    """특허법 법령지식 MAS — 두 검색기를 SAS 워크플로로 오케스트레이션하는 진입점."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or default_settings
        # 키·스토어 검증을 초기화 시점에 수행 — 검색 단계에서야 실패하는 것을 방지함
        self.settings.ensure_api_keys()
        missing = self.settings.validate_stores()
        if missing:
            raise RuntimeError("필수 인덱싱 산출물이 없음: " + ", ".join(missing))

        # 검색기·라우터·노드 구성 (무거운 초기화 1회)
        self.vector = VectorRetriever(self.settings)
        self.graphrag = GraphRAGRetriever(self.settings)
        self.router = QueryRouter(self.settings)
        self.nodes = MASNodes(self.settings, self.vector, self.graphrag, self.router)
        self.graph = self._build_graph()
        logger.info("PatentLawMAS 초기화 완료 (model=%s)", self.settings.llm_model)

    def _build_graph(self):
        """SAS StateGraph를 구성·컴파일함."""
        builder = StateGraph(PatentLawState)
        builder.add_node("scheduler", self.nodes.scheduler_node)
        builder.add_node("agent", self.nodes.agent_node)
        builder.add_node("supervisor", self.nodes.supervisor_node)
        builder.add_node("fuse", self.nodes.fuse_node)

        builder.add_edge(START, "scheduler")
        builder.add_edge("scheduler", "agent")
        builder.add_edge("agent", "supervisor")
        # Supervisor의 next_step에 따라 재검색/융합/종료로 분기 (Loop Guard는 supervisor 내부에서 보장)
        builder.add_conditional_edges(
            "supervisor",
            lambda state: state.get("next_step", "end"),
            {"agent": "agent", "fuse": "fuse", "end": END},
        )
        builder.add_edge("fuse", END)
        return builder.compile()

    def answer(self, question: str, mode: str = "auto") -> dict:
        """질문을 받아 SAS 워크플로를 실행하고 응답 딕셔너리를 반환함.

        반환에 requested_mode/resolved_mode/route_reason/supervisor_reason을 포함해
        "어떤 모드를 왜 골랐고, 충분성 평가가 어땠는지"를 호출자가 관찰할 수 있게 함.
        """
        question = (question or "").strip()
        if not question:
            return {
                "answer": "질문이 비어 있습니다. 검색할 내용을 입력하세요.",
                "requested_mode": mode, "resolved_mode": None, "route_reason": "빈 질문",
                "sources": [], "evidence": {}, "error": True,
            }

        requested = (mode or "auto").lower().strip()
        if requested not in VALID_REQUEST_MODES:
            logger.warning("알 수 없는 모드 '%s' → auto로 대체", requested)
            requested = "auto"

        final = self.graph.invoke({"question": question, "requested_mode": requested})
        return self._shape(question, requested, final)

    @staticmethod
    def _shape(question: str, requested: str, state: PatentLawState) -> dict:
        """그래프 최종 State를 외부 응답용으로 정리함."""
        passes = state.get("passes", [])
        return {
            "question": question,
            "answer": state.get("answer", ""),
            "requested_mode": requested,
            "resolved_mode": state.get("mode"),
            "route_reason": state.get("route_reason", ""),
            "used_llm_fallback": state.get("used_llm_fallback", False),
            "supervisor_reason": state.get("supervisor_reason", ""),
            "sufficient": state.get("sufficient"),
            "reroutes": state.get("reroutes", 0),
            "modes_used": [p.get("mode") for p in passes],
            "sources": state.get("sources", []),
            "evidence": state.get("evidence", {}),
            "note": state.get("note", ""),
            "error": bool(state.get("error", False)),
        }

    # === MCP Resource 지원 ===============================================

    def kg_stats(self) -> dict:
        """KG 통계(엔티티/관계/커뮤니티/텍스트유닛 수, 엔티티 타입 분포) 반환."""
        return self.graphrag.kg_stats()

    def kg_schema(self) -> str:
        """KG 스키마(엔티티 타입·관계·인덱스 구성) 문자열 반환."""
        return self.graphrag.kg_schema()
