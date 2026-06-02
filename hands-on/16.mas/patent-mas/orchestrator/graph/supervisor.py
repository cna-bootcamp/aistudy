"""글로벌 Supervisor 통제 도구 — Budget·Kill-switch·출력 검증 (교재 §7.5/§7.8).

상위 SAS의 Supervisor 책임을 '재사용 가능한 순수 로직'으로 분리함:
  - WorkflowBudget : 워크플로 전체의 호출수·추정 토큰 한도 관리 + 비율 기반 분배(교재 §7.5)
  - 출력 검증       : 각 단위 MAS 결과가 사용 가능한지 구조적으로 판정 → 실패 단위 식별(graceful degradation)
이 모듈은 LangGraph 에 의존하지 않음(노드는 nodes.py 가 담당). 통제 '규칙'만 담아 테스트·이해가 쉬움.
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

from dataclasses import dataclass


@dataclass
class WorkflowBudget:
    """워크플로 전체 예산 관리 (교재 §7.5 Budget 시스템을 분산 MAS용으로 단순화).

    호출수(max_calls)를 1차(결정적) 통제 기준으로, 추정 토큰(max_tokens)을 보조 지표로 둠.
    used_* 는 지금까지의 사용량 누계임.
    """

    max_calls: int = 8
    max_tokens: int = 120_000
    max_depth: int = 2
    used_calls: int = 0
    used_tokens: int = 0

    def can_proceed(self) -> bool:
        """남은 예산이 있는지 (호출수·토큰 모두 한도 미만일 때만 True)."""
        return self.used_calls < self.max_calls and self.used_tokens < self.max_tokens

    def can_afford(self, n_calls: int) -> bool:
        """추가로 n_calls 만큼 호출해도 호출수 한도를 넘지 않는지 (Kill-switch 사전 점검)."""
        return (self.used_calls + n_calls) <= self.max_calls and self.used_tokens < self.max_tokens

    def record(self, calls: int, tokens: int) -> None:
        """사용량을 누적함 (분기 완료 후 집계)."""
        self.used_calls += calls
        self.used_tokens += tokens

    def report(self) -> dict:
        """현재 예산 사용 요약을 dict 로 반환함 (UI·로그 표시용)."""
        return {
            "used_calls": self.used_calls, "max_calls": self.max_calls,
            "used_tokens": self.used_tokens, "max_tokens": self.max_tokens,
            "exhausted": not self.can_proceed(),
        }


def estimate_tokens(text: str) -> int:
    """문자열의 추정 토큰 수 (영문 ~4자/토큰 관행). 정확치 아님 — Budget 보조 지표용 추정."""
    return max(1, len(text or "") // 4)


def validate_branch(result: dict) -> tuple[bool, str]:
    """단위 MAS 분기 결과의 사용 가능성을 구조적으로 검증함(LLM 미사용, 결정적).

    워커가 ok=False(타임아웃·예외)거나 의미 있는 본문이 없으면 실패로 판정함.
    실패 단위는 상위에서 graceful degradation(부분 결과로 진행) 또는 Loop Guard 재디스패치 대상이 됨.
    """
    if not result.get("ok"):
        return False, result.get("error", "단위 MAS 호출 실패")
    # MAS A/B 는 answer, MAS C 는 final_output 에 본문이 담김
    body = result.get("answer") or result.get("final_output") or ""
    if not str(body).strip():
        return False, "빈 응답(본문 없음)"
    return True, "정상"
