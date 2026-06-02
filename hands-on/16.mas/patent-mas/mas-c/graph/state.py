"""MAS C(의견서 작성·검증) 워크플로우의 상태(State)와 구조화 출력 스키마(Pydantic) 정의.

[런타임 인라인 게이트 신호]
  IsSup        : 생성된 초안이 검색 컨텍스트에 근거하는지 검증 (SupportGrade, reference-free, 1콜)
  verify_cit   : korean-law MCP verify_citations 결과(코드 파싱) — LLM 미사용, 환각 인용 탐지
  gate         : IsSup·verify_citations 통과 여부 → 미달 시 재작성 또는 HITL 승급
  HITL         : interrupt_before=['finalize'] 로 확정 전 사람 승인
  DLP          : 개인정보 마스킹 후 최종 출력

LLM이 판단하는 단계(IsSup)는 with_structured_output(method='json_schema')로 출력을 강제해 안정 파싱함(MUST).
초안 본문(prose)·재작성 결과는 자연어이므로 StrOutputParser로 처리함(구조화 불필요).
"""

from __future__ import annotations

from typing import Optional, TypedDict

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# 구조화 출력 스키마 (LLM 판단 단계 전용)
# ---------------------------------------------------------------------------

class SupportGrade(BaseModel):
    """[IsSup] 근거성 평가: 초안이 검색 컨텍스트에 근거하는지(환각이 없는지) 검증."""

    is_supported: bool = Field(
        description="생성된 의견서 초안의 핵심 주장이 제공된 검색 컨텍스트로 뒷받침되는지 여부"
    )
    reasoning: str = Field(description="근거성 판단 이유 (한국어 한 문장)")


class ContextPlan(BaseModel):
    """단독 실행(provided_context 미주입) 시 컨텍스트 수집 계획.

    오케스트레이터가 MAS A·B 결과를 주입하면 이 단계는 건너뜀. 단독 데모/테스트에서만
    korean-law MCP를 A·B 프록시로 호출하기 위해 검색 키워드·법령명을 LLM이 추출함.
    """

    law_query: str = Field(description="판례·해석례 검색용 핵심 법률 키워드 (예: '직무발명 보상금')")
    law_name: str = Field(
        description="질문에 특정 법령명이 명시되면 그 이름(예: '특허법'). 없으면 빈 문자열"
    )


# ---------------------------------------------------------------------------
# LangGraph 상태 정의
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    """그래프 전체에서 노드 사이로 공유·갱신되는 상태 데이터.

    각 노드는 이 딕셔너리의 일부 키만 갱신해 반환하면 LangGraph가 기존 상태에 병합함.
    """

    # === 입력 ===
    question: str               # 사용자의 의견서 작성 요청 (예: '거절이유 통지 대응 의견서 초안')
    history: list               # 이전 대화 맥락 [{"role", "content"}] (멀티턴, 선택)
    # 오케스트레이터가 MAS A·B의 실제 검색 결과를 주입하는 통로.
    # 비어 있지 않으면 gather_context가 자체 수집을 건너뛰고 이 값을 그대로 사용함(fan-in 소비자 역할).
    provided_context: list

    # === 컨텍스트 수집 ===
    # [{source, title, content, citation}] — MAS A(법령)·MAS B(판례·동향) 검색 컨텍스트 종합
    context_items: list

    # === 초안 작성 ===
    draft: str                  # 현재 의견서 초안 본문 (재작성 시 갱신됨)

    # === 게이트 1: 근거성 [IsSup] ===
    is_supported: Optional[bool]   # 초안이 컨텍스트에 근거하는지
    support_reasoning: str         # 근거성 판단 근거

    # === 게이트 2: 인용 환각 탐지 (verify_citations) ===
    # {status, total, exist, errors, warns, hallucinated[], text, ok} — law_client가 코드 파싱한 결과
    citation_report: dict
    citations_ok: Optional[bool]   # 인용 환각이 없는지 (✗ 오류 0건이면 True)
    citation_issue: str            # 인용 문제 요약 (재작성 프롬프트에 전달)

    # === 게이트 종합 / 재작성 루프 ===
    gate_passed: Optional[bool]    # IsSup True 그리고 citations_ok True
    gate_reason: str               # 게이트 통과/실패 사유 요약
    escalated: bool                # 게이트 미달 + 재시도 소진 → HITL 승급 여부
    retry_count: int               # 현재까지 재작성 횟수
    rewrites: list                 # 재작성 이력 [{reason}]

    # === HITL (사람 승인) ===
    approved: Optional[bool]       # 사람 승인 결과 (None=미결정, resume 시 기본 승인 / False=반려)
    review_feedback: str           # 반려 시 사람이 남긴 피드백

    # === DLP / 최종 출력 ===
    dlp_findings: list             # 마스킹된 개인정보 탐지 결과 [{type, value, position}]
    final_output: str              # DLP 마스킹·고지문이 포함된 최종 의견서
