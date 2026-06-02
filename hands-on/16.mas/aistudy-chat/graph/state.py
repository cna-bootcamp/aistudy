"""LangGraph State 정의 (SAS 패턴의 Shared State)

MAS 워크플로 전체에서 공유되는 상태 딕셔너리.
각 노드(Agent)는 이 State를 읽고 일부 필드만 업데이트하여 반환하며, 노드 간 협업은 이 공유
State를 통해 이루어짐 (Agent가 다른 Agent를 직접 호출하지 않음).
"""
from __future__ import annotations

from typing import Annotated, Literal, Optional, TypedDict

from langgraph.graph.message import add_messages  # 메시지 리스트를 자동 누적 병합하는 reducer

from config.settings import SOURCE_WEIGHTS


# TypedDict: 키별 타입을 지정한 딕셔너리 — LangGraph가 이 구조로 공유 State를 관리함
class AgentState(TypedDict):
    """MAS 시스템 전체 공유 상태."""

    # === 대화 관리 ===
    # add_messages reducer로 노드가 추가한 메시지가 자동 누적됨 (덮어쓰지 않음)
    messages: Annotated[list, add_messages]

    # === 질문 정보 ===
    question: str                          # 원본 사용자 질문
    question_type: Literal["code", "qa"]   # Router가 분류한 유형

    # === 각 Agent 검색 결과 (Shared State로 노드 간 공유) ===
    rag_results: list[dict]      # 교재/KG 검색 결과
    web_results: list[dict]      # 웹 검색 결과
    youtube_results: list[dict]  # YouTube 검색 결과

    # === 코드 생성 결과 (code 유형) ===
    generated_code: str   # 생성된 Python 코드
    code_filename: str    # 저장된 파일 경로

    # === 최종 출력 ===
    answer: str           # 사용자에게 반환할 최종 답변

    # === Supervisor 평가 결과 ===
    evaluation_score: float    # 품질 점수 (0.0~1.0)
    evaluation_passed: bool    # 통과 여부 (score >= 0.75)
    retry_count: int           # 현재 재시도 횟수 (max 2 = Loop Guard)
    retry_strategy: str        # 재시도 전략 (query_rewrite / direct_generation / reweight_sources)

    # === 재시도/가중치 ===
    rewritten_query: str       # 재작성된 쿼리 (있으면 RAG에서 우선 사용)
    source_weights: dict       # Q&A 소스 가중치 {"rag":.., "web":.., "youtube":..}

    # === 에러 ===
    error: Optional[str]


def create_initial_state(question: str) -> AgentState:
    """워크플로 시작용 초기 State를 생성함 (모든 필드 기본값)."""
    return AgentState(
        messages=[],
        question=question,
        question_type="qa",            # 기본값, Router가 실제 분류
        rag_results=[],
        web_results=[],
        youtube_results=[],
        generated_code="",
        code_filename="",
        answer="",
        evaluation_score=0.0,
        evaluation_passed=False,
        retry_count=0,
        retry_strategy="",
        rewritten_query="",
        source_weights=SOURCE_WEIGHTS["default"].copy(),
        error=None,
    )


def get_current_query(state: AgentState) -> str:
    """현재 사용할 쿼리를 반환함 (재작성 쿼리가 있으면 우선)."""
    return state.get("rewritten_query") or state.get("question", "")
