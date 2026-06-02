"""오케스트레이터 비대화형 검증 CLI — 교재 §9.2 4종 테스트 질의 시나리오를 순차 실행함.

각 질의를 새 대화(thread_id)로 실행하고, 글로벌 HITL 인터럽트가 걸리면 자동 승인으로 재개함
(대화형 승인은 app.py 가 담당). 라우팅·예산·최종 답변 일부를 출력하고 마지막에 PASS/FAIL 을 집계함.

사전 조건: ① mas-a MCP 서버 기동(:8010) ② mas-b/mas-c venv 준비 ③ hands-on/.env 키 설정.
사용법:  python run_cli.py            # 4종 전체
         python run_cli.py 4          # 4번 질의만 (1~4)
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import asyncio
import sys
import uuid
from pathlib import Path

# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# python run_cli.py 로 직접 실행할 때 config/graph/clients 패키지를 찾도록 프로젝트 경로를 추가함
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config.settings import settings
from graph.state import INTENT_LAW, INTENT_OPINION, INTENT_TREND
from graph.workflow import build_graph

# (질의, 기대 의도, MAS C 기대 여부) — §9.2 테스트 질의어
SCENARIOS = [
    ("특허를 받기 위한 요건(신규성·진보성)을 설명해줘", INTENT_LAW, False),
    ("특허권의 존속기간을 정한 조문을 인용해서 알려줘", INTENT_LAW, False),
    ("직무발명 보상 관련 최근 판례와 업계 동향을 조사해줘", INTENT_TREND, False),
    ("거절이유 통지에 대응하는 특허 의견서 초안을 작성하고 인용을 검증해줘", INTENT_OPINION, True),
]


async def run_one(graph, question: str, history: list | None = None) -> dict:
    """질의 1건을 실행하고, 글로벌 HITL 인터럽트는 자동 승인으로 통과시켜 최종 상태를 반환함.

    history: 멀티턴 맥락(이전 대화). 턴마다 새 thread_id 를 쓰되 누적 history 를 주입함.
    """
    config = {"configurable": {"thread_id": str(uuid.uuid4())},
              "recursion_limit": settings.recursion_limit}
    await graph.ainvoke({"question": question, "history": history or []}, config)
    while True:
        snapshot = graph.get_state(config)
        if not snapshot.next:            # 더 실행할 노드가 없으면 종료
            return snapshot.values
        # interrupt_before(human_review)로 멈춘 상태 — 검증에서는 자동 승인 후 재개
        print(">> [CLI] 글로벌 HITL 인터럽트 → 자동 승인")
        graph.update_state(config, {"approved": True, "review_feedback": ""})
        await graph.ainvoke(None, config)


# 멀티턴 시나리오 — (질의, 기대 의도). 3턴째는 맥락 의존 후속 질의(LLM 폴백이 history로 해소)
MULTITURN = [
    ("특허 요건을 설명해줘", INTENT_LAW),
    ("직무발명 보상 관련 최근 판례 동향은?", INTENT_TREND),
    ("방금 그 내용 더 자세히 알려줘", INTENT_TREND),  # 직전(동향) 주제를 이어받아야 함
]


async def run_multiturn(graph) -> int:
    """멀티턴 대화에서 history 가 누적·전달되고, 맥락 의존 후속 질의가 직전 주제로 라우팅되는지 검증함."""
    print("\n" + "=" * 72 + "\n[멀티턴 검증] 3턴 대화 (history 누적 + 후속 질의 맥락 라우팅)")
    history: list = []
    verdicts: list[tuple[str, bool]] = []
    for turn, (question, expected_intent) in enumerate(MULTITURN, 1):
        print("\n" + "#" * 72)
        print(f"# 턴 {turn}: {question}  (history {len(history)}개 전달)")
        print("#" * 72)
        state = await run_one(graph, question, history)
        intent, answer = state.get("intent"), state.get("final_answer", "")
        print(f"[턴 {turn}] intent={intent} (기대 {expected_intent}) units={state.get('active_units')} "
              f"method={state.get('route_method')}")
        print("-" * 72 + "\n" + answer[:400] + ("..." if len(answer) > 400 else "") + "\n" + "-" * 72)
        # 멀티턴 맥락 누적
        history.append({"role": "user", "content": question})
        history.append({"role": "assistant", "content": answer})
        verdicts.append((f"T{turn}", intent == expected_intent and bool(answer.strip())))

    print("\n[멀티턴 종합]")
    for name, ok in verdicts:
        print(f"  {name} : {'PASS' if ok else 'FAIL'}")
    all_pass = all(ok for _, ok in verdicts) and len(history) == 2 * len(MULTITURN)
    print(f"  history 누적 {len(history)}개 / 전체: {'ALL PASS' if all_pass else 'FAIL'}")
    return 0 if all_pass else 1


async def main(only) -> int:
    settings.ensure_api_keys()
    graph = build_graph()
    if only == "mt":
        return await run_multiturn(graph)
    scenarios = SCENARIOS if only is None else [SCENARIOS[only - 1]]

    verdicts: list[tuple[str, bool]] = []
    for idx, (question, expected_intent, expected_c) in enumerate(scenarios, 1):
        num = only or idx
        print("\n" + "#" * 72)
        print(f"# 시나리오 {num}: {question}")
        print("#" * 72)
        try:
            state = await run_one(graph, question)
        except Exception as error:  # noqa: BLE001
            print(f"!! 실행 예외: {type(error).__name__}: {error}")
            verdicts.append((f"S{num}", False))
            continue

        intent = state.get("intent")
        answer = state.get("final_answer", "")
        report = state.get("budget_report", {})
        print(f"\n[결과] intent={intent} (기대 {expected_intent}) / needs_c={state.get('needs_c')} (기대 {expected_c})")
        print(f"[결과] units={state.get('active_units')} failed={state.get('failed_units')} "
              f"killed={state.get('killed')} escalated={state.get('escalated')}")
        print(f"[결과] budget={report}")
        print("-" * 72)
        print(answer[:900] + ("..." if len(answer) > 900 else ""))
        print("-" * 72)

        # 통과 기준: 의도 일치 + C 필요 여부 일치 + 비어있지 않은 최종 답변
        ok = (intent == expected_intent) and (bool(state.get("needs_c")) == expected_c) and bool(answer.strip())
        verdicts.append((f"S{num}", ok))

    print("\n" + "=" * 72 + "\n[종합 판정]")
    for name, ok in verdicts:
        print(f"  {name} : {'PASS' if ok else 'FAIL'}")
    all_pass = all(ok for _, ok in verdicts)
    print(f"\n  전체: {'ALL PASS' if all_pass else 'FAIL'}")
    return 0 if all_pass else 1


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    args = sys.argv[1:]
    if "mt" in args:                 # python run_cli.py mt → 멀티턴 검증
        mode = "mt"
    else:                            # 숫자 → 해당 시나리오만, 없으면 전체
        mode = next((int(a) for a in args if a.isdigit()), None)
    sys.exit(asyncio.run(main(mode)))
