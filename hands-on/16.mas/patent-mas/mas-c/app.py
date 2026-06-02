#!/usr/bin/env python3
"""MAS C — 특허 의견서 작성·검증 단위 MAS (LangGraph 인라인 게이트 + HITL + DLP).

워크플로우: 컨텍스트 종합 → 의견서 초안 → [IsSup] 근거성 → verify_citations 인용 환각 탐지
            → (미달 시 재작성/HITL 승급) → 사람 승인(interrupt) → DLP 마스킹 → 최종 출력

기술 스택:
  LLM        : Groq LPU openai/gpt-oss-120b (reasoning_format='hidden')  # 런타임 전용
  인용 검증   : korean-law MCP verify_citations (원격 Streamable HTTP)
  프레임워크  : LangGraph StateGraph (checkpointer + interrupt_before)

사용법:
  python app.py            # 대화형 (질문 → HITL 승인 → 최종 의견서)
  python app.py --demo     # 검증 시나리오를 비대화형으로 실행 (HITL 자동 승인)
"""

from __future__ import annotations

import sys
import uuid

# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from config import settings
from graph.workflow import PatentOpinionMAS, build_llm


# ---------------------------------------------------------------------------
# HITL 구동 (interrupt_before=['human_review'] → update_state → 재개)
# ---------------------------------------------------------------------------

def run_with_hitl(agent: PatentOpinionMAS, question: str, history: list,
                  approve_fn, provided_context: list | None = None) -> dict:
    """그래프를 실행하고 human_review 인터럽트마다 approve_fn 으로 사람 승인을 받아 재개함.

    approve_fn(state) -> (approved: bool, feedback: str)
    반환: 그래프 종료 시점의 최종 상태(final_output 포함)
    """
    # thread_id: 이 요청의 체크포인트 식별자(질문마다 고유). recursion_limit 로 재작성 루프 여유 확보.
    config = {"configurable": {"thread_id": str(uuid.uuid4())},
              "recursion_limit": settings.RECURSION_LIMIT}
    initial = agent.initial_state(question, history, provided_context)

    agent.graph.invoke(initial, config)  # human_review 직전(interrupt_before)에서 멈춤
    while True:
        snapshot = agent.graph.get_state(config)
        if not snapshot.next:            # 더 실행할 노드가 없으면 종료
            return snapshot.values
        # interrupt_before 로 human_review 앞에서 멈춘 상태 — 사람 승인 결정을 받아 기록 후 재개
        approved, feedback = approve_fn(snapshot.values)
        agent.graph.update_state(config, {"approved": approved, "review_feedback": feedback})
        agent.graph.invoke(None, config)


# ---------------------------------------------------------------------------
# 출력 / 요약
# ---------------------------------------------------------------------------

def format_summary(state: dict) -> str:
    """게이트·재작성·HITL·DLP 처리 결과를 한눈에 보이도록 요약 문자열로 만듦."""
    report = state.get("citation_report") or {}
    lines = ["=" * 64, "MAS C 처리 결과 요약 (의견서 작성·검증)", "=" * 64]
    lines.append(f"[컨텍스트] 항목 {len(state.get('context_items', []))}개")
    if state.get("retry_count", 0) > 0:
        lines.append(f"[재작성  ] {state['retry_count']}회")
    lines.append(f"[IsSup   ] 근거 있음 : {state.get('is_supported')}")
    if report:
        verdict = "판정불가" if report.get("ok") is None else ("정상" if report.get("ok") else "환각탐지")
        lines.append(f"[인용검증 ] {verdict} (총 {report.get('total', 0)} / "
                     f"✓{report.get('exist', 0)} ✗{report.get('errors', 0)} ⚠{report.get('warns', 0)})")
        if report.get("hallucinated"):
            lines.append(f"           환각 인용: {report['hallucinated']}")
    lines.append(f"[게이트  ] {'통과' if state.get('gate_passed') else '미통과'} — {state.get('gate_reason', '')}")
    lines.append(f"[HITL    ] 승인 : {state.get('approved')}  / 승급(escalated): {state.get('escalated')}")
    findings = state.get("dlp_findings", [])
    lines.append(f"[DLP     ] 마스킹 PII : {len(findings)}건 {[f['type'] for f in findings] if findings else ''}")
    lines.append("=" * 64)
    return "\n".join(lines)


def print_result(state: dict) -> None:
    """처리 요약과 최종 의견서를 콘솔에 출력함."""
    print("\n" + format_summary(state))
    print("\n" + "-" * 64)
    print("최종 의견서:")
    print("-" * 64)
    print(state.get("final_output", "(출력 없음)"))
    print("-" * 64)


def show_review_panel(state: dict) -> None:
    """HITL 승인 화면: 초안·게이트 상태·법적 책임 고지를 사람에게 보여줌."""
    print("\n" + "#" * 64)
    print("# 사람 승인 요청 (HITL) — 확정 전 검토")
    print("#" * 64)
    print(format_summary(state))
    print("\n[검토 대상 초안]\n" + "-" * 64)
    print(state.get("draft", ""))
    print("-" * 64)
    print("\n" + settings.LEGAL_DISCLAIMER)


# ---------------------------------------------------------------------------
# 승인 콜백 (대화형 / 데모)
# ---------------------------------------------------------------------------

def interactive_approve(state: dict) -> tuple[bool, str]:
    """대화형 승인: 초안·게이트를 보여주고 승인/반려(+피드백)를 입력받음."""
    show_review_panel(state)
    while True:
        choice = input("\n승인하시겠습니까? (y=승인 / n=반려, 사유 입력): ").strip()
        if choice.lower() in ("y", "yes", "승인"):
            return True, ""
        if choice.lower() in ("n", "no", "반려"):
            feedback = input("반려 사유(재작성에 반영): ").strip()
            return False, feedback
        print("y 또는 n 을 입력하세요.")


def make_demo_approve(reject_first: bool = False):
    """데모 승인 콜백 생성기: 기본 자동 승인. reject_first=True 면 첫 회만 반려해 재작성을 시연함."""
    calls = {"n": 0}

    def _approve(state: dict) -> tuple[bool, str]:
        show_review_panel(state)
        calls["n"] += 1
        if reject_first and calls["n"] == 1:
            print(">> [데모] 첫 검토: 반려하여 재작성을 시연합니다.")
            return False, "결론을 더 단정적으로 쓰고, 근거 조문을 명확히 인용해 주세요."
        print(">> [데모] 자동 승인합니다.")
        return True, ""

    return _approve


# ---------------------------------------------------------------------------
# 실행 모드
# ---------------------------------------------------------------------------

def run_demo(agent: PatentOpinionMAS) -> None:
    """검증 시나리오를 비대화형으로 실행함 (--demo). HITL 은 자동 승인/반려로 시연."""
    scenarios = [
        # (질문, 승인콜백) — 단독 실행이라 gather_context 가 MCP 로 컨텍스트를 수집함
        ("직무발명 보상금 청구에 대한 의견서를 작성해줘", make_demo_approve(reject_first=False)),
        ("특허 거절이유(진보성 부정) 통지에 대한 대응 의견서를 작성해줘", make_demo_approve(reject_first=True)),
    ]
    history: list = []
    for idx, (question, approve_fn) in enumerate(scenarios, 1):
        print("\n" + "@" * 64)
        print(f"@ 데모 시나리오 {idx}/{len(scenarios)}: {question}")
        print("@" * 64)
        state = run_with_hitl(agent, question, history, approve_fn)
        print_result(state)
        history.append({"role": "user", "content": question})
        history.append({"role": "assistant", "content": state.get("final_output", "")})


def chat(agent: PatentOpinionMAS) -> None:
    """대화형 루프: 질문 → 작성·검증 → HITL 승인 → 최종 의견서."""
    print("\n" + "=" * 64)
    print("특허 의견서 작성·검증 MAS C")
    print("=" * 64)
    print("의견서 초안을 작성하고, 근거성([IsSup])과 인용 환각(verify_citations)을 검증합니다.")
    print("확정 전 사람 승인(HITL)을 거치며, 최종 출력은 DLP 로 개인정보를 마스킹합니다.")
    print("'quit'/'q' 종료, 'clear' 대화 초기화.")
    print("=" * 64 + "\n")

    history: list = []
    while True:
        try:
            question = input("의견서 작성 요청: ").strip()
            if not question:
                continue
            if question.lower() in ("quit", "q", "exit", "종료"):
                print("\n종료합니다. 감사합니다!")
                break
            if question.lower() in ("clear", "초기화"):
                history.clear()
                print("\n[대화 맥락을 초기화했습니다.]\n")
                continue
            state = run_with_hitl(agent, question, history, interactive_approve)
            print_result(state)
            history.append({"role": "user", "content": question})
            history.append({"role": "assistant", "content": state.get("final_output", "")})
            print()
        except KeyboardInterrupt:
            print("\n\n종료합니다.")
            break
        except Exception as error:  # noqa: BLE001 - 한 요청의 오류로 루프가 죽지 않게 함
            print(f"\n오류가 발생했습니다: {error}\n")


def main() -> None:
    """LLM·그래프를 준비하고 모드(데모/대화형)에 따라 실행함."""
    print("\n" + "=" * 64)
    print("MAS C — 특허 의견서 작성·검증 (LangGraph + Groq gpt-oss-120b)")
    print("=" * 64)
    try:
        print(f"korean-law MCP: {settings.LAW_MCP_BASE_URL}?oc=*** (verify_citations 게이트)")
        settings.build_law_mcp_url()  # LAW_OC 누락을 실행 초기에 잡음
        llm = build_llm()
        agent = PatentOpinionMAS(llm)
        if "--demo" in sys.argv[1:]:
            run_demo(agent)
        else:
            chat(agent)
    except (RuntimeError, ValueError) as error:
        print(f"\n[오류] {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
