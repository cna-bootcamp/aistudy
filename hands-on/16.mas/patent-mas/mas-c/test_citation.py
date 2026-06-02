#!/usr/bin/env python3
"""인용 환각 시나리오 테스트 (결정적) — 파서 · 게이트 차단 · fail-safe 검증.

이 테스트의 목표는 'LLM이 환각을 일으키도록 유도'하는 것이 아니라(비결정적),
환각이 주어졌을 때 게이트가 '확실히 차단'하는지를 결정적으로 검증하는 것임.
  1) parse_verify_result : 캡처된 verify_citations 응답 텍스트를 정확히 파싱하는가
  2) decide_gate         : 환각(✗>0)/판정불가(ok=None)/소진 시 올바르게 차단·라우팅하는가
  3) verify_citations 노드: 서비스 도달 실패를 '정상'으로 흡수하지 않고 HITL 로 승급하는가
  4) (선택) live          : 실제 verify_citations 호출로 환각을 탐지하는가 (네트워크/LAW_OC 필요)

실행: python test_citation.py            (결정적 테스트만)
      python test_citation.py --live     (실제 MCP 호출 포함)
"""

from __future__ import annotations

import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sources.law_mcp import parse_verify_result

# 실제 verify_citations 가 돌려준 응답들을 캡처한 고정 표본 (네트워크 없이 파서 검증)
SAMPLE_HALLUCINATION = """[HALLUCINATION_DETECTED] == 인용 검증 결과 ==
총 3건 | ✓ 0 실존 | ✗ 1 오류 | ⚠ 2 확인필요

⚠ 특허권의 존속기간은 특허법 제88조 — 법제처 검색은 '특허법'(으)로만 매칭됨. 법령명 정확성 재확인 필요
✗ 특허법 제999조 — [NOT_FOUND] 해당 조문 없음 (존재 범위: 제1조~제232조)
⚠ 직무발명은 발명진흥법 제15조 — 법제처 검색은 '발명진흥법'(으)로만 매칭됨. 법령명 정확성 재확인 필요

⚠️ [HALLUCINATION_DETECTED] 1건 인용이 법제처 DB에 실존하지 않습니다."""

SAMPLE_NO_CITATIONS = """[NO_CITATIONS_FOUND] 입력 텍스트에서 조문 인용이 발견되지 않았습니다.

⚠️ 이 결과는 '검증 성공'이 아니라 '검증할 인용이 없음'입니다."""

SAMPLE_ALL_VALID = """== 인용 검증 결과 ==
총 2건 | ✓ 2 실존 | ✗ 0 오류 | ⚠ 0 확인필요

✓ 특허법 제29조 — 실존 확인
✓ 특허법 제88조 — 실존 확인"""

SAMPLE_GARBAGE = "503 Service Temporarily Unavailable\n<html>...</html>"


# ---------------------------------------------------------------------------
# 미니 테스트 러너
# ---------------------------------------------------------------------------
_passed, _failed = 0, 0


def check(name: str, condition: bool, detail: str = "") -> None:
    global _passed, _failed
    if condition:
        _passed += 1
        print(f"  ✓ PASS: {name}")
    else:
        _failed += 1
        print(f"  ✗ FAIL: {name} {('— ' + detail) if detail else ''}")


# ---------------------------------------------------------------------------
# 1) 파서 테스트
# ---------------------------------------------------------------------------

def test_parser() -> None:
    print("\n[1] parse_verify_result — 응답 표본 파싱")

    hall = parse_verify_result(SAMPLE_HALLUCINATION)
    check("환각 표본: parsed=True", hall["parsed"] is True)
    check("환각 표본: ok=False (✗>0 차단)", hall["ok"] is False, f"ok={hall['ok']}")
    check("환각 표본: errors=1", hall["errors"] == 1, f"errors={hall['errors']}")
    check("환각 표본: 제999조가 환각 목록에 있음",
          any("제999조" in h for h in hall["hallucinated"]), str(hall["hallucinated"]))
    check("환각 표본: ⚠는 차단하지 않음(warns=2)", hall["warns"] == 2, f"warns={hall['warns']}")

    none = parse_verify_result(SAMPLE_NO_CITATIONS)
    check("인용없음 표본: ok=True (검증할 것 없음)", none["ok"] is True)
    check("인용없음 표본: total=0", none["total"] == 0)

    valid = parse_verify_result(SAMPLE_ALL_VALID)
    check("정상 표본: ok=True", valid["ok"] is True)
    check("정상 표본: exist=2, errors=0", valid["exist"] == 2 and valid["errors"] == 0)

    garbage = parse_verify_result(SAMPLE_GARBAGE)
    check("쓰레기 응답: parsed=False (판정 보류, fail-safe)", garbage["parsed"] is False)
    check("쓰레기 응답: ok=None (정상으로 흡수 금지)", garbage["ok"] is None)


# ---------------------------------------------------------------------------
# 2) 게이트 라우팅 테스트 (decide_gate / decide_after_review)
# ---------------------------------------------------------------------------

def test_gate_routing() -> None:
    print("\n[2] decide_gate / decide_after_review — 차단·라우팅")
    from graph.workflow import PatentOpinionMAS, build_llm

    agent = PatentOpinionMAS(build_llm())  # 구성은 오프라인(네트워크 미사용)

    base = agent.initial_state("테스트")
    # 통과
    s = {**base, "gate_passed": True}
    check("게이트 통과 → approve(사람승인)", agent.decide_gate(s) == "approve")
    # 환각(✗>0), 재시도 여유 → rewrite
    s = {**base, "gate_passed": False, "retry_count": 0,
         "citation_report": {"ok": False, "errors": 1}}
    check("환각 + 재시도 여유 → rewrite", agent.decide_gate(s) == "rewrite")
    # 환각, 재시도 소진 → escalate
    s = {**base, "gate_passed": False, "retry_count": settings_max(),
         "citation_report": {"ok": False, "errors": 1}}
    check("환각 + 재시도 소진 → escalate", agent.decide_gate(s) == "escalate")
    # verify 판정불가(ok=None) → 재작성으로 못 고침 → escalate (서비스 이슈)
    s = {**base, "gate_passed": False, "retry_count": 0,
         "citation_report": {"ok": None, "errors": 0}}
    check("verify 판정불가(ok=None) → escalate(rewrite 금지)", agent.decide_gate(s) == "escalate")

    # 사람 반려 + 재시도 여유 → rewrite
    s = {**base, "approved": False, "retry_count": 0, "review_feedback": "수정 요망"}
    check("반려 + 재시도 여유 → rewrite", agent.decide_after_review(s) == "rewrite")
    # 사람 승인 → finalize
    s = {**base, "approved": True}
    check("승인 → finalize", agent.decide_after_review(s) == "finalize")
    # 반려 + 소진 → finalize(반려 표시)
    s = {**base, "approved": False, "retry_count": settings_max()}
    check("반려 + 소진 → finalize", agent.decide_after_review(s) == "finalize")


def settings_max() -> int:
    from config import settings
    return settings.MAX_REWRITES


# ---------------------------------------------------------------------------
# 3) verify_citations 노드 fail-safe (서비스 도달 실패를 정상으로 흡수하지 않음)
# ---------------------------------------------------------------------------

def test_node_failsafe() -> None:
    print("\n[3] verify_citations 노드 fail-safe — 서비스 다운 시 HITL 승급")
    import graph.workflow as wf
    from graph.workflow import PatentOpinionMAS, build_llm

    agent = PatentOpinionMAS(build_llm())
    original = wf.run_verify_citations
    # 서비스 도달 실패를 시뮬레이션: reachable=False, ok=None
    wf.run_verify_citations = lambda text: {
        "reachable": False, "ok": None, "total": 0, "exist": 0, "errors": 0, "warns": 0,
        "hallucinated": [], "warnings": [], "text": "", "note": "simulated outage",
    }
    try:
        state = {**agent.initial_state("테스트"), "draft": "특허법 제29조 ...",
                 "is_supported": True, "context_items": []}
        out = agent.verify_citations(state)
        check("서비스 다운: citations_ok=False (정상 흡수 금지)", out["citations_ok"] is False)
        check("서비스 다운: gate_passed=False", out["gate_passed"] is False)
        check("서비스 다운: decide_gate → escalate", agent.decide_gate({**state, **out}) == "escalate")
    finally:
        wf.run_verify_citations = original  # 원복


# ---------------------------------------------------------------------------
# 4) (선택) live — 실제 verify_citations 호출
# ---------------------------------------------------------------------------

def test_live() -> None:
    print("\n[4] live — 실제 korean-law MCP verify_citations 호출")
    from sources.law_mcp import run_verify_citations
    mixed = ("특허권의 존속기간은 특허법 제88조에 따라 출원일 후 20년이다. "
             "또한 특허법 제999조에 따라 즉시 구속된다.")
    rep = run_verify_citations(mixed)
    check("live: reachable=True", rep["reachable"] is True, rep.get("note", ""))
    check("live: ok=False (환각 제999조 탐지)", rep["ok"] is False)
    check("live: 환각 목록에 제999조", any("제999조" in h for h in rep["hallucinated"]))


def main() -> None:
    print("=" * 64)
    print("인용 환각 시나리오 테스트 (MAS C)")
    print("=" * 64)
    test_parser()
    test_gate_routing()
    test_node_failsafe()
    if "--live" in sys.argv[1:]:
        test_live()
    else:
        print("\n[4] live 테스트 생략 (--live 로 실제 MCP 호출 포함 가능)")

    print("\n" + "=" * 64)
    print(f"결과: {_passed} PASS / {_failed} FAIL")
    print("=" * 64)
    sys.exit(1 if _failed else 0)


if __name__ == "__main__":
    main()
