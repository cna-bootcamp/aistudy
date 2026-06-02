"""LangGraph 워크플로 구성 (SAS: Scheduler-Agent-Supervisor 패턴)

흐름:
  START → router(Scheduler)
        ├─ code: rag → code_generation ─┐
        └─ qa  : rag → web → youtube → qa_response ─┤
                                                     → supervisor
  supervisor(품질 평가 0.75 기준)
        ├─ 통과: code → final_response → END / qa → END
        ├─ 재시도: retry(쿼리 재작성) → rag (재시도 루프)
        └─ 폴백(재시도 초과): fallback → END
"""
from __future__ import annotations

from langgraph.graph import END, StateGraph  # 그래프 구성 요소

from graph.nodes import (
    code_generation_node,
    fallback_node,
    final_response_node,
    qa_response_node,
    rag_node,
    retry_node,
    route_by_type,
    router_node,
    should_continue,
    supervisor_node,
    web_node,
    youtube_node,
)
from graph.state import AgentState


def create_workflow() -> StateGraph:
    """노드와 엣지를 연결하여 MAS 워크플로 그래프를 구성함 (컴파일 전)."""
    workflow = StateGraph(AgentState)

    # === 노드 등록 ===
    workflow.add_node("router", router_node)               # 1. 질문 분류 (Scheduler)
    workflow.add_node("rag", rag_node)                     # 2. RAG 검색 (KG + Vector)
    workflow.add_node("web", web_node)                     # 3. 웹 검색 (Q&A 전용)
    workflow.add_node("youtube", youtube_node)             # 4. YouTube 검색 (Q&A 전용)
    workflow.add_node("code_generation", code_generation_node)  # 5. 코드 생성
    workflow.add_node("qa_response", qa_response_node)     # 6. Q&A 종합 응답
    workflow.add_node("supervisor", supervisor_node)       # 7. 품질 평가 (Supervisor)
    workflow.add_node("retry", retry_node)                 # 8. 재시도 준비
    workflow.add_node("fallback", fallback_node)           # 9. 폴백 응답
    workflow.add_node("final_response", final_response_node)  # 10. 코드 최종 포맷

    # === 시작점: 항상 router부터 ===
    workflow.set_entry_point("router")

    # router → rag (code/qa 모두 RAG부터)
    workflow.add_conditional_edges("router", route_by_type, {"code": "rag", "qa": "rag"})

    # rag 이후 유형별 분기
    def after_rag(state: AgentState) -> str:
        """RAG 이후 유형에 따라 코드 생성 또는 웹 검색으로 분기."""
        return state.get("question_type", "qa")

    workflow.add_conditional_edges(
        "rag", after_rag, {"code": "code_generation", "qa": "web"}
    )

    # Q&A 경로: rag → web → youtube → qa_response
    workflow.add_edge("web", "youtube")
    workflow.add_edge("youtube", "qa_response")

    # 코드/Q&A 모두 supervisor로 수렴
    workflow.add_edge("code_generation", "supervisor")
    workflow.add_edge("qa_response", "supervisor")

    # supervisor 이후 분기: 통과/재시도/폴백
    def after_supervisor(state: AgentState) -> str:
        """평가 결과에 따라 완료(코드는 final_response, Q&A는 END)/재시도/폴백 결정."""
        decision = should_continue(state)  # "end" | "retry" | "fallback"
        if decision == "end":
            # 코드 유형은 코드+저장경로 포맷이 필요하므로 final_response 경유
            return "final_response" if state.get("question_type") == "code" else "end"
        return decision

    workflow.add_conditional_edges(
        "supervisor",
        after_supervisor,
        {
            "final_response": "final_response",
            "retry": "retry",
            "fallback": "fallback",
            "end": END,
        },
    )

    # 재시도 경로: retry → rag (다시 검색부터)
    def after_retry(state: AgentState) -> str:
        """재시도 시 유형에 맞춰 다시 RAG로 진입."""
        return state.get("question_type", "qa")

    workflow.add_conditional_edges("retry", after_retry, {"code": "rag", "qa": "rag"})

    # 종료 엣지
    workflow.add_edge("fallback", END)
    workflow.add_edge("final_response", END)

    return workflow


def compile_workflow():
    """StateGraph를 실행 가능한 CompiledGraph로 컴파일함."""
    return create_workflow().compile()
