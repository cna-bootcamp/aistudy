"""상위 SAS Orchestrator StateGraph 조립 — Fan-out/Fan-in + Loop Guard + 글로벌 HITL.

[2계층 SAS] 이 그래프가 상위 SAS임. 노드 run_unit/run_mas_c 가 호출하는 단위 MAS(A/B/C)는
각자 내부에 또 하나의 SAS(하위)를 가짐 → SAS 2계층 중첩(복합 MAS, 교재 §9.2).

[그래프 흐름]
  START → scheduler
  scheduler ─(fan_out 조건부)→ Send[run_unit]×N (A∥B 병렬)  /  direct_answer (잡담)
  run_unit → supervisor (병렬 join: 모든 분기 완료 후 1회)
  supervisor ─(조건부)→ Send[run_unit](실패 재디스패치, Loop Guard)  /  run_mas_c  /  compose
  run_mas_c ─(조건부)→ human_review(escalated 시 HITL)  /  compose
  human_review(interrupt_before) → compose → END
  direct_answer → END

[Fan-out=Send] '활성 단위만' 선택적으로 병렬 분기(교재 §9.2: 조건부는 Send API로 선택 분기).
[Fan-in=reducer] 병렬 결과는 Shared State 의 operator.add 리듀서로 병합(경합 방지).
[멀티턴] checkpointer + thread_id 로 대화별 상태를 이어받음.
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

from langgraph.checkpoint.memory import MemorySaver
from langgraph.constants import Send
from langgraph.graph import END, START, StateGraph

from graph import nodes
from graph.state import OrchestratorState


def _branch_send(state: dict, unit: str) -> Send:
    """run_unit 분기 1개를 위한 Send 를 만듦.

    Send(node, arg): arg 는 그 노드 인스턴스의 '입력 상태'임(메인 상태와 분리). 따라서 분기가
    필요로 하는 unit·question·history 를 직접 담아 보냄. 노드의 반환값만 메인 상태로 reducer 병합됨.
    """
    return Send("run_unit", {
        "unit": unit,
        "question": state["question"],
        "history": state.get("history", []),
    })


def fan_out(state: dict):
    """scheduler 직후 분기: 활성 단위가 있으면 Send 로 병렬 fan-out, 없으면 직접 답변."""
    units = state.get("active_units", []) or []
    if not units:
        return "direct_answer"
    # 활성 단위(A·B)만 동시 디스패치 — A와 B는 입력=질문으로 상호 독립이라 병렬 안전
    return [_branch_send(state, unit) for unit in units]


def route_after_supervisor(state: dict):
    """supervisor 직후 분기: 실패 재디스패치(Loop Guard) / MAS C 취합 / 합성."""
    route = state.get("next_route", "compose")
    if route == "redispatch":
        return [_branch_send(state, unit) for unit in state.get("redispatch_units", [])]
    if route == "to_c":
        return "run_mas_c"
    return "compose"


def decide_review(state: dict) -> str:
    """run_mas_c 직후 분기: C가 게이트 미통과(escalated)면 글로벌 HITL, 아니면 바로 합성."""
    return "human_review" if state.get("escalated") else "compose"


def build_graph():
    """오케스트레이터 StateGraph 를 조립·컴파일함 (checkpointer + 글로벌 HITL interrupt)."""
    workflow = StateGraph(OrchestratorState)

    # 노드 등록 (Scheduler / 병렬 분기 / 글로벌 Supervisor / C 취합 / HITL / 합성 / 직접답변)
    workflow.add_node("scheduler", nodes.scheduler_node)
    workflow.add_node("run_unit", nodes.run_unit_node)
    workflow.add_node("supervisor", nodes.supervisor_node)
    workflow.add_node("run_mas_c", nodes.run_mas_c_node)
    workflow.add_node("human_review", nodes.human_review_node)
    workflow.add_node("compose", nodes.compose_node)
    workflow.add_node("direct_answer", nodes.direct_answer_node)

    workflow.add_edge(START, "scheduler")
    # 조건부 fan-out: 활성 단위로 병렬 Send, 또는 직접 답변 (path 목록은 컴파일 검증용)
    workflow.add_conditional_edges("scheduler", fan_out, ["run_unit", "direct_answer"])
    # 병렬 분기 join: 모든 run_unit 인스턴스 완료 후 supervisor 1회 실행
    workflow.add_edge("run_unit", "supervisor")
    workflow.add_conditional_edges(
        "supervisor", route_after_supervisor, ["run_unit", "run_mas_c", "compose"]
    )
    workflow.add_conditional_edges("run_mas_c", decide_review, ["human_review", "compose"])
    workflow.add_edge("human_review", "compose")
    workflow.add_edge("compose", END)
    workflow.add_edge("direct_answer", END)

    # checkpointer + interrupt_before: 글로벌 HITL — human_review 실행 전 멈춰 사람 승인을 기다림
    return workflow.compile(checkpointer=MemorySaver(), interrupt_before=["human_review"])
