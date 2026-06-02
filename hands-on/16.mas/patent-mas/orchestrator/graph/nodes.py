"""오케스트레이터(상위 SAS) 그래프 노드 — Scheduler / run_unit / Supervisor / MAS C / 합성.

[Agent 직접 호출 금지 원칙(교재 §2.3)] 어떤 노드도 다른 단위 MAS를 '직접' 호출해 결과를 넘기지
않음. 모든 조율은 Shared State 갱신 + 라우팅 엣지로만 이뤄짐. run_unit 은 자기 분기 단위 1개만
호출해 결과를 State(reducer=operator.add)에 누적하고, 이후 노드는 State 만 읽어 다음 행동을 정함.

[비동기 분기] run_unit / run_mas_c 는 async 노드임. LangGraph 가 Send 로 펼친 병렬 분기들을 한
superstep 에서 동시 await 하므로 A(MCP 네트워크 대기)와 B(워커 서브프로세스 대기)가 겹쳐 실행됨
(asyncio.gather 등가). 각 분기는 asyncio.wait_for 로 분기별 타임아웃을 건다(계층적 타임아웃, §7.7).
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import asyncio
import logging

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from clients import mas_a_client
from clients.worker_client import call_mas_b, call_mas_c
from config.llm import build_chat_llm
from config.settings import settings
from graph.scheduler import Scheduler
from graph.state import INTENT_CHITCHAT
from graph.supervisor import WorkflowBudget, estimate_tokens, validate_branch

logger = logging.getLogger("orchestrator.nodes")

_scheduler = Scheduler()  # 의도 분류기 (패턴 + LLM 폴백) — 모듈 1회 생성


def _recent_history(state: dict) -> list:
    """프롬프트·워커에 넘길 최근 대화 맥락만 잘라냄 (토큰·비용 제한)."""
    history = state.get("history", []) or []
    return history[-settings.history_turns:]


# ---------------------------------------------------------------------------
# 노드 1: Scheduler — 의도 분류 → 활성 단위 결정 + 글로벌 Budget 초기화
# ---------------------------------------------------------------------------

def scheduler_node(state: dict) -> dict:
    """질문 의도를 분류하고 활성 단위 MAS·C 필요 여부를 정함(상위 SAS 진입점)."""
    question = state["question"]
    decision = _scheduler.route(question, _recent_history(state))
    print(f"\n[Scheduler] intent={decision.intent} units={decision.active_units} "
          f"needs_c={decision.needs_c} ({decision.method})")
    print(f"  → 근거: {decision.reason}")
    return {
        "intent": decision.intent,
        "active_units": decision.active_units,
        "needs_c": decision.needs_c,
        "route_reason": decision.reason,
        "route_method": decision.method,
        # Loop Guard / Kill-switch 상태 초기화
        "redispatch_count": 0,
        "killed": False,
        "supervisor_notes": [],
    }


# ---------------------------------------------------------------------------
# 노드 2: run_unit — Send 로 펼쳐진 단일 분기(A 또는 B) 호출
# ---------------------------------------------------------------------------

async def run_unit_node(state: dict) -> dict:
    """이 분기에 배정된 단위 MAS 1개(A=MCP / B=워커)를 호출해 결과를 State 에 누적함.

    반환 키는 모두 reducer=operator.add 대상 → 여러 분기가 동시에 써도 리스트로 안전 병합됨.
    분기별 asyncio.wait_for 로 타임아웃을 걸고, 실패는 예외 대신 ok=False 결과로 정규화함
    (상위 Supervisor 가 graceful degradation/재디스패치로 처리).
    """
    unit = state["unit"]
    question = state["question"]
    history = _recent_history(state)

    if unit == "A":
        branch = await _run_mas_a(question)
    elif unit == "B":
        branch = await _run_mas_b(question, history)
    else:  # 정의되지 않은 단위 — 방어적 처리
        branch = {"unit": unit, "ok": False, "answer": "", "context_items": [],
                  "error": f"알 수 없는 단위: {unit}"}

    tokens = estimate_tokens(branch.get("answer", ""))
    status = "정상" if branch.get("ok") else f"실패({branch.get('error', '')[:60]})"
    print(f"[run_unit:{unit}] {status} / 컨텍스트 {len(branch.get('context_items', []))}개 / 추정 {tokens}토큰")
    return {"branch_results": [branch], "spent_calls": [1], "spent_tokens": [tokens]}


async def _run_mas_a(question: str) -> dict:
    """MAS A(법령지식) 호출 — MCP 클라이언트(Streamable HTTP), asyncio.wait_for 타임아웃."""
    print("[run_unit:A] MAS A(MCP) 법령지식 검색 중...")
    try:
        res = await asyncio.wait_for(
            mas_a_client.ask_patent_law_async(question, "auto"),
            timeout=settings.timeout_mas_a,
        )
        if res.get("error"):
            return {"unit": "A", "ok": False, "answer": res.get("answer", ""),
                    "context_items": [], "error": "MAS A 내부 오류"}
        return {
            "unit": "A", "ok": True, "answer": res.get("answer", ""),
            "context_items": mas_a_client.to_context_items(res),
            "summary": {"resolved_mode": res.get("resolved_mode"),
                        "modes_used": res.get("modes_used", []),
                        "sources": len(res.get("sources", []))},
        }
    except asyncio.TimeoutError:
        return {"unit": "A", "ok": False, "answer": "", "context_items": [],
                "error": f"MAS A 타임아웃({settings.timeout_mas_a}s)"}
    except Exception as error:  # noqa: BLE001 - 연결 실패 등은 graceful degradation 대상
        return {"unit": "A", "ok": False, "answer": "", "context_items": [],
                "error": f"MAS A 호출 실패: {type(error).__name__}: {error}"}


async def _run_mas_b(question: str, history: list) -> dict:
    """MAS B(선행기술·동향) 호출 — 서브프로세스 워커(API/FC), asyncio.wait_for 타임아웃."""
    print("[run_unit:B] MAS B(워커) 선행기술·동향 리서치 중...")
    try:
        res = await asyncio.wait_for(
            call_mas_b(question, history),
            timeout=settings.timeout_mas_b + 15,  # 워커 내부 타임아웃보다 약간 길게(이중 가드)
        )
        if not res.get("ok"):
            return {"unit": "B", "ok": False, "answer": res.get("answer", ""),
                    "context_items": [], "error": res.get("error", "MAS B 실패")}
        return {
            "unit": "B", "ok": True, "answer": res.get("answer", ""),
            "context_items": res.get("context_items", []),
            "summary": {**(res.get("counts") or {}),
                        "is_supported": res.get("is_supported"),
                        "is_useful": res.get("is_useful")},
        }
    except asyncio.TimeoutError:
        return {"unit": "B", "ok": False, "answer": "", "context_items": [],
                "error": f"MAS B 타임아웃({settings.timeout_mas_b}s)"}
    except Exception as error:  # noqa: BLE001
        return {"unit": "B", "ok": False, "answer": "", "context_items": [],
                "error": f"MAS B 호출 실패: {type(error).__name__}: {error}"}


# ---------------------------------------------------------------------------
# 노드 3: Supervisor(글로벌) — Budget·출력 검증·Loop Guard·Kill-switch
# ---------------------------------------------------------------------------

def supervisor_node(state: dict) -> dict:
    """병렬 분기 결과를 검증하고, 예산을 점검해 다음 라우트(재디스패치/C취합/합성)를 결정함.

    교재 §7.5/§7.8 통제를 한 노드로 모음:
      - Budget   : 누적 호출수·추정 토큰으로 WorkflowBudget 구성, C/재디스패치 전 can_afford 점검
      - 출력 검증 : validate_branch 로 분기별 사용 가능성 판정 → 실패 단위 식별
      - Loop Guard: 실패 단위가 있어도 redispatch_count 가 한도 미만일 때만 1회 재시도
      - Kill-switch: 예산 부족 시 추가 디스패치 차단 → 부분 결과로 진행(graceful degradation)
    """
    results = state.get("branch_results", [])
    # 같은 단위가 재디스패치로 여러 번 있으면 '마지막 시도'만 채택(최신 결과 우선)
    latest: dict[str, dict] = {}
    for result in results:
        latest[result.get("unit", "?")] = result

    budget = WorkflowBudget(
        max_calls=settings.budget_max_calls,
        max_tokens=settings.budget_max_tokens,
        max_depth=settings.budget_max_depth,
        used_calls=sum(state.get("spent_calls", [])),
        used_tokens=sum(state.get("spent_tokens", [])),
    )

    failed_units, ok_units = [], []
    for unit, result in latest.items():
        valid, reason = validate_branch(result)
        (ok_units if valid else failed_units).append(unit)
        if not valid:
            print(f"[Supervisor] 출력 검증 실패: {unit} — {reason}")

    notes: list[str] = []
    redispatch_count = state.get("redispatch_count", 0)
    killed = state.get("killed", False)

    # 1) Loop Guard + 부분 실패 재디스패치 (실패 단위가 있고, 재시도 여유·예산이 있을 때만)
    if failed_units and redispatch_count < settings.max_redispatch and budget.can_afford(len(failed_units)):
        redispatch_count += 1
        print(f"[Supervisor] 부분 실패 재디스패치 #{redispatch_count}: {failed_units} (Loop Guard {settings.max_redispatch})")
        notes.append(f"부분 실패 단위 {failed_units} 재시도(#{redispatch_count})")
        return {
            "failed_units": failed_units, "next_route": "redispatch",
            "redispatch_units": failed_units, "redispatch_count": redispatch_count,
            "budget_report": budget.report(), "supervisor_notes": notes,
        }

    # 재시도를 더 못 하는데도 실패가 남으면 graceful degradation 안내
    if failed_units:
        notes.append(f"⚠️ 일부 단위 실패로 부분 결과로 진행(graceful degradation): {failed_units}")

    # 2) MAS C 취합 분기 — 예산(Kill-switch) 점검 후 결정
    if state.get("needs_c") and ok_units:
        if budget.can_afford(1):
            print("[Supervisor] A∥B 취합 → MAS C 라우팅")
            return {"failed_units": failed_units, "next_route": "to_c",
                    "redispatch_count": redispatch_count, "budget_report": budget.report(),
                    "supervisor_notes": notes}
        # 예산 부족 → Kill-switch (C 생략, 부분 결과로 합성)
        killed = True
        notes.append("⛔ Kill-switch: 예산 부족으로 MAS C 취합 생략(부분 결과로 응답)")
        print("[Supervisor] Kill-switch — 예산 부족으로 C 생략")

    return {"failed_units": failed_units, "next_route": "compose", "killed": killed,
            "redispatch_count": redispatch_count, "budget_report": budget.report(),
            "supervisor_notes": notes}


# ---------------------------------------------------------------------------
# 노드 4: run_mas_c — A∥B fan-in 취합 (의견서 작성·검증)
# ---------------------------------------------------------------------------

async def run_mas_c_node(state: dict) -> dict:
    """A∥B 의 검색 컨텍스트를 종합해 MAS C(의견서 작성·검증) 워커를 호출함(fan-in)."""
    # 성공 분기(A·B)의 context_items 를 모아 C의 provided_context 로 주입함
    provided_context: list = []
    for result in state.get("branch_results", []):
        if result.get("ok") and result.get("unit") in ("A", "B"):
            provided_context.extend(result.get("context_items", []))
    print(f"\n[run_mas_c] A∥B 컨텍스트 {len(provided_context)}개 주입 → MAS C 호출")

    try:
        res = await asyncio.wait_for(
            call_mas_c(state["question"], _recent_history(state), provided_context),
            timeout=settings.timeout_mas_c + 15,
        )
    except asyncio.TimeoutError:
        res = {"ok": False, "final_output": "", "error": f"MAS C 타임아웃({settings.timeout_mas_c}s)",
               "escalated": True, "gate_reason": "타임아웃"}
    except Exception as error:  # noqa: BLE001
        res = {"ok": False, "final_output": "", "error": f"MAS C 호출 실패: {type(error).__name__}",
               "escalated": True, "gate_reason": str(error)[:120]}

    # 게이트 미통과·호출 실패 시 escalated. force_escalate(데모 토글)면 HITL 패널 시연을 위해 강제 발화
    escalated = bool(res.get("escalated")) or not res.get("ok") or settings.force_escalate
    if settings.force_escalate and res.get("ok"):
        res.setdefault("gate_reason", "ORCH_FORCE_ESCALATE=1 (HITL 데모 강제 승급)")
    tokens = estimate_tokens(res.get("final_output", "") or res.get("draft", ""))
    print(f"[run_mas_c] ok={res.get('ok')} gate_passed={res.get('gate_passed')} escalated={escalated}")
    return {"mas_c_result": res, "escalated": escalated,
            "spent_calls": [1], "spent_tokens": [tokens]}


# ---------------------------------------------------------------------------
# 노드 5: human_review — 글로벌 HITL (interrupt_before 로 이 노드 앞에서 멈춤)
# ---------------------------------------------------------------------------

def human_review_node(state: dict) -> dict:
    """글로벌 HITL 승인 지점. C가 게이트 미통과(escalated)면 이 앞에서 그래프가 멈춰 사람 승인을 받음.

    interrupt_before=['human_review'] 로 실행 전 멈춤 → 앱이 update_state 로 approved/feedback 을
    기록한 뒤 재개하면 이 노드(표식)가 통과됨. 승인 여부는 compose 분기에서 반영됨.
    """
    print(f"\n[human_review] 글로벌 HITL 통과 — approved={state.get('approved')}")
    return {}


# ---------------------------------------------------------------------------
# 노드 6/7: compose(단위 결과 합성) / direct_answer(잡담 직접 답변)
# ---------------------------------------------------------------------------

def compose_node(state: dict) -> dict:
    """단위 MAS 결과를 최종 답변으로 합성하고 Supervisor 통제 메모(예산·열화·HITL)를 덧붙임."""
    print("\n[compose] 최종 답변 합성 중...")
    mas_c = state.get("mas_c_result") or {}
    parts: list[str] = []

    if state.get("needs_c"):
        # 의견서 경로 — C의 최종 출력(이미 DLP·고지문 포함)을 본문으로 사용
        if mas_c.get("ok") and mas_c.get("final_output"):
            if state.get("approved") is False:
                parts.append("> ⚠️ 검토자가 반려한 초안임. 최종본이 아니며 추가 수정이 필요함.")
            parts.append(mas_c["final_output"])
        else:
            # C 실패 → A∥B 근거라도 모아 안내(graceful degradation)
            parts.append("⚠️ 의견서 자동 작성에 실패하여, 수집된 법령·동향 근거만 정리합니다.")
            parts.append(_combine_branch_answers(state))
    else:
        # 법령/동향 경로 — 성공 분기 답변을 라벨 섹션으로 합성(단위 본문 그대로 → 인용 환각 방지)
        parts.append(_combine_branch_answers(state))

    # 최종 예산 리포트 재계산 — Supervisor 리포트는 C 호출 '이전' 시점이라, 사용자에게는
    # C까지 포함한 누적 호출수·토큰을 보여줘야 실제 사용량과 일치함(정직한 보고).
    final_budget = WorkflowBudget(
        max_calls=settings.budget_max_calls, max_tokens=settings.budget_max_tokens,
        used_calls=sum(state.get("spent_calls", [])), used_tokens=sum(state.get("spent_tokens", [])),
    ).report()

    notes = _build_notes({**state, "budget_report": final_budget})
    final = "\n\n".join(p for p in parts if p).strip() or "죄송합니다. 답변을 생성하지 못했습니다."
    if notes:
        final = f"{final}\n\n---\n{notes}"
    return {"final_answer": final, "budget_report": final_budget,
            "supervisor_notes": [notes] if notes else []}


async def direct_answer_node(state: dict) -> dict:
    """잡담·특허 외 질문은 단위 MAS 없이 LLM 지식으로 직접 답변함(불필요한 분산 호출 차단)."""
    print("\n[direct_answer] 단위 MAS 미호출 → LLM 직접 답변")
    history_text = _format_history(_recent_history(state))
    prompt = ChatPromptTemplate.from_messages([
        ("system", "당신은 특허법 분산 MAS 챗봇입니다. 이번 질문은 검색이 필요 없는 인사·잡담이거나 "
                   "특허와 무관한 주제입니다. 이전 대화 맥락을 고려해 친절히 답하되, 필요하면 특허 관련 "
                   "질문을 안내하세요.\n\n## 이전 대화 맥락\n{history}"),
        ("human", "{question}"),
    ])
    try:
        answer = (prompt | build_chat_llm(max_tokens=512) | StrOutputParser()).invoke(
            {"history": history_text, "question": state["question"]}
        )
    except Exception as error:  # noqa: BLE001
        answer = f"답변 생성 중 오류가 발생했습니다: {type(error).__name__}"
    return {"final_answer": answer,
            "budget_report": {"used_calls": 0, "max_calls": settings.budget_max_calls},
            "supervisor_notes": []}


def _combine_branch_answers(state: dict) -> str:
    """성공한 A/B 분기 답변을 단위별 라벨 섹션으로 묶음(본문은 단위 출력 그대로 보존)."""
    labels = {"A": "📘 법령 지식 (MAS A)", "B": "🔎 선행기술·동향 (MAS B)"}
    # active_units 등장 순서를 보존해 일관된 출력 순서를 만듦
    ordered = state.get("active_units", []) or [r.get("unit") for r in state.get("branch_results", [])]
    by_unit = {r.get("unit"): r for r in state.get("branch_results", []) if r.get("ok")}
    blocks = []
    for unit in ordered:
        result = by_unit.get(unit)
        if result and result.get("answer"):
            header = labels.get(unit, f"MAS {unit}")
            single = len([u for u in ordered if by_unit.get(u)]) == 1
            blocks.append(result["answer"] if single else f"## {header}\n\n{result['answer']}")
    return "\n\n".join(blocks)


def _build_notes(state: dict) -> str:
    """Supervisor 통제 결과(예산·열화·승급·승인)를 사용자용 한 줄 메모로 요약함."""
    lines: list[str] = []
    report = state.get("budget_report") or {}
    if report:
        lines.append(f"🧮 Budget: 호출 {report.get('used_calls', 0)}/{report.get('max_calls', 0)}회, "
                     f"추정 토큰 {report.get('used_tokens', 0):,}/{report.get('max_tokens', 0):,}")
    if state.get("killed"):
        lines.append("⛔ Kill-switch 작동: 예산 한도로 일부 단계 생략됨")
    if state.get("failed_units"):
        lines.append(f"⚠️ 부분 실패(graceful degradation): {state['failed_units']}")
    mas_c = state.get("mas_c_result") or {}
    if state.get("needs_c") and mas_c:
        cit = mas_c.get("citation_summary") or {}
        lines.append(f"✅ MAS C 게이트: {'통과' if mas_c.get('gate_passed') else '미통과'} / "
                     f"인용검증 {cit.get('verdict', '-')}(✗{cit.get('errors', 0)})")
        if state.get("escalated"):
            verdict = "승인됨" if state.get("approved") else ("반려됨" if state.get("approved") is False else "검토필요")
            lines.append(f"🙋 글로벌 HITL 승급 → 사람 검토 {verdict}")
    return "  \n".join(lines)


def _format_history(history: list) -> str:
    """직전 대화 메시지를 프롬프트용 텍스트로 변환함."""
    if not history:
        return "(이전 대화 없음)"
    lines = []
    for message in history:
        speaker = "사용자" if message.get("role") == "user" else "어시스턴트"
        lines.append(f"{speaker}: {message.get('content', '')}")
    return "\n".join(lines)
