"""오케스트레이터(상위 SAS) 공유 State 와 구조화 출력 스키마(Pydantic) 정의.

[복합 MAS = 2계층 SAS] 상위 SAS의 Shared State 는 단위 MAS(A/B/C) 호출 결과를 모으는 그릇임.
A∥B 병렬 분기가 '동시에' 같은 키에 결과를 쓰므로, 병합 키는 reducer=operator.add 로 선언해
경합(InvalidUpdateError)을 막고 리스트로 누적함(교재 §9.2: Shared State reducer 병합).

[Self-RAG/SAS 토큰과 구분] 여기 구조화 스키마는 '상위' 판단 전용임:
  IntentDecision : Scheduler 의도 분류(어느 단위 MAS를 활성화할지)
  OutputVerdict  : Supervisor 출력 검증(합성 답변이 근거 있고 유용한지)
모두 with_structured_output(method='json_schema')로 출력을 강제해 안정 파싱함(MUST).
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import operator
from typing import Annotated, Literal, Optional, TypedDict

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# 의도(intent) 상수 — Scheduler 라우팅 분기 키
# ---------------------------------------------------------------------------
INTENT_LAW = "law_knowledge"        # 법령 개념·요건·조문 → MAS A 단독
INTENT_TREND = "prior_art_trend"    # 선행기술·판례·동향 → MAS B (+근거 필요 시 A 병렬 보강)
INTENT_OPINION = "opinion_drafting"  # 의견서·서면 작성 → A∥B 병렬 → MAS C 취합
INTENT_CHITCHAT = "chitchat"        # 인사·특허 외 잡담 → 단위 MAS 미호출, 직접 답변


# ---------------------------------------------------------------------------
# 구조화 출력 스키마 (LLM 판단 단계 전용)
# ---------------------------------------------------------------------------

class IntentDecision(BaseModel):
    """Scheduler LLM 폴백용 의도 분류 결과 (패턴 매칭 확신도가 낮을 때만 호출)."""

    intent: Literal["law_knowledge", "prior_art_trend", "opinion_drafting", "chitchat"] = Field(
        description="질문 의도 분류. law_knowledge=법령개념/요건/조문, prior_art_trend=선행기술/판례/동향, "
                    "opinion_drafting=의견서/서면 작성, chitchat=인사/특허 외 잡담"
    )
    active_units: list[Literal["A", "B"]] = Field(
        description="병렬 fan-out 으로 활성화할 단위 MAS. A=법령지식, B=선행기술·동향. "
                    "법령 질문=['A'], 동향 질문=['B'](근거 필요 시 ['A','B']), 의견서=['A','B'], 잡담=[]"
    )
    needs_c: bool = Field(
        description="MAS C(의견서 작성·검증)가 필요한지 여부. 의견서/서면 작성 요청일 때만 True"
    )
    reasoning: str = Field(description="분류 근거 (한국어 한 문장)")


# 참고: 합성 답변의 '근거성(할루시네이션)' LLM 검증은 단위 MAS에 위임함(방어 심층화) —
# MAS B의 [IsSup]/[IsUse], MAS C의 [IsSup]+verify_citations 가 이미 수행함. 상위 Supervisor 는
# 분기 결과의 사용 가능성을 '구조적'으로 검증함(graph/supervisor.py:validate_branch, LLM 미사용).


# ---------------------------------------------------------------------------
# 상위 SAS 공유 State 정의
# ---------------------------------------------------------------------------

class OrchestratorState(TypedDict, total=False):
    """그래프 전체에서 노드 사이로 공유·갱신되는 상태 데이터.

    total=False: 노드는 일부 키만 갱신해 반환하면 됨. Annotated[..., operator.add] 로 표시한
    키는 병렬 분기가 동시에 써도 리스트로 누적 병합됨(경합 방지).
    """

    # === 입력 ===
    question: str                    # 현재 사용자 질문
    history: list                    # 이전 대화 맥락 [{"role","content"}] (멀티턴)

    # === Scheduler 라우팅 결과 ===
    intent: str                      # INTENT_* 중 하나
    active_units: list               # 병렬 활성 단위 ["A","B"]
    needs_c: bool                    # MAS C 취합 필요 여부
    route_reason: str                # 라우팅 판단 근거
    route_method: str                # "pattern" | "llm" (어느 방식으로 결정했는지)

    # === Send 분기 입력(브랜치 로컬) — run_unit 1개 인스턴스가 처리할 단위 지정 ===
    unit: str                        # 이 분기가 호출할 단위 ("A" | "B")
    branch_budget: dict              # 이 분기에 배정된 예산 스냅샷 {"max_calls","max_tokens"}

    # === 병렬 분기 결과 (reducer=operator.add 로 누적 병합) ===
    branch_results: Annotated[list, operator.add]   # [{"unit","ok","answer","context_items",...}]
    spent_calls: Annotated[list, operator.add]      # 단위 호출 1건당 [1] 누적 (Budget 호출수 집계)
    spent_tokens: Annotated[list, operator.add]     # 분기별 추정 토큰 [n] 누적 (Budget 토큰 추정)

    # === 글로벌 Supervisor (Budget·검증·Loop Guard) ===
    budget_report: dict              # 예산 사용 요약 {used_calls, max_calls, used_tokens, ...}
    failed_units: list               # 출력 검증·호출 실패 단위 (graceful degradation 표시)
    next_route: str                  # Supervisor 결정 라우트 ("redispatch"|"to_c"|"compose")
    redispatch_units: list           # 재디스패치할 실패 단위 (Loop Guard 대상)
    redispatch_count: int            # 재디스패치 횟수 (Loop Guard 한도와 비교)
    killed: bool                     # Kill-switch 작동 여부 (Budget 초과 등)

    # === MAS C 취합 ===
    mas_c_result: dict               # C 워커 결과 {final_output, gate_passed, escalated, ...}
    escalated: bool                  # C가 게이트 미통과로 HITL 승급을 요청했는지

    # === HITL (글로벌 사람 승인) ===
    approved: Optional[bool]         # 사람 승인 결과 (None=미결정, True=승인, False=반려)
    review_feedback: str             # 반려 시 사람이 남긴 피드백

    # === 최종 출력 ===
    final_answer: str                # 사용자에게 보여줄 최종 합성 답변
    # Supervisor 통제 메모 — 여러 노드(scheduler·supervisor·compose)가 누적하므로 reducer 로 병합
    supervisor_notes: Annotated[list, operator.add]
