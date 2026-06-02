"""SAS 워크플로 공유 State 정의.

LangGraph는 TypedDict로 노드 간 공유 State를 표현함. 대부분 필드는 마지막 노드가 덮어쓰지만,
여러 노드/패스가 '누적'해야 하는 필드(tried_modes, passes)는 reducer(operator.add)로 병합함.
  - tried_modes : 이미 검색한 모드(중복 검색 금지의 근거)
  - passes      : 패스별 검색 결과(Supervisor가 보완 모드로 재검색하면 2개가 쌓이고, fuse가 융합)
"""
from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict


class PatentLawState(TypedDict, total=False):
    """특허법 법령지식 MAS의 공유 상태."""

    # --- 입력 ---
    question: str                    # 사용자 질문
    requested_mode: str              # 호출자가 요청한 모드 (auto/vector/local/global/drift)

    # --- Scheduler 결과 ---
    mode: str                        # 현재 실행할(또는 실행한) 모드
    route_reason: str                # 라우팅 근거
    used_llm_fallback: bool          # 패턴 확신도 부족으로 LLM 분류를 썼는지

    # --- 누적(reducer) ---
    tried_modes: Annotated[list[str], operator.add]   # 시도한 모드 누적
    passes: Annotated[list[dict[str, Any]], operator.add]  # 패스별 결과 누적

    # --- 최신 패스 편의 필드 (Agent가 매 패스 갱신) ---
    answer: str                      # 현재 답변
    sources: list[dict[str, Any]]    # 현재 출처(직렬화된 dict)
    evidence: dict[str, int]         # 근거 개수 요약
    note: str                        # 폴백 등 부가 설명

    # --- Supervisor 결과 ---
    reroutes: int                    # 보완 모드 전환 횟수(Loop Guard 카운터)
    sufficient: bool                 # 근거 충분 판정
    supervisor_reason: str           # 판정 근거
    next_step: str                   # 라우팅 제어: "agent" | "fuse" | "end"

    # --- 메타 ---
    error: bool                      # 처리 중 오류 발생 여부
