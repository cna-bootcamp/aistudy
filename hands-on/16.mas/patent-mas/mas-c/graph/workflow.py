"""MAS C(특허 의견서 작성·검증) 런타임 워크플로우 — LangGraph StateGraph.

런타임 인라인 게이트(매 요청, reference-free, 저지연):
  gather_context  : provided_context(오케스트레이터 A·B fan-in)가 있으면 그대로 사용,
                    없으면(단독 데모) korean-law MCP를 A·B 프록시로 호출해 컨텍스트 수집
  write_draft     : 검색 컨텍스트 종합 → 의견서 초안 생성
  grade_support   : Self-RAG [IsSup] 근거성 grader (검색 컨텍스트 기반, 정답 불필요, 1콜)
  verify_citations: korean-law MCP verify_citations 로 법령 조문 인용 환각 탐지 (LLM 미사용)
                    (조문-scoped — 판례 사건번호는 IsSup·코드생성 출처가 보완)
  rewrite_draft   : 근거 미달 또는 인용 환각 시 엄격 근거 기반으로 재작성
  escalate        : 재시도 소진 또는 verify 판정 불가(서비스 이슈) → HITL 승급 표시
  human_review    : 확정 전 사람 승인 (interrupt_before, 법적 책임 고지 포함)
  finalize        : DLP 개인정보 마스킹 + 고지문 부착 → 최종 출력

게이트 정책(전파 차단):
  gate_passed = [IsSup]=True AND verify_citations(✗ 오류=0, 판정 성공)
  미통과 시:  verify 판정 불가 → escalate / 재시도 여유 → rewrite / 재시도 소진 → escalate
  모든 출력 경로는 human_review(사람 승인)를 반드시 거침.
"""

from __future__ import annotations

from typing import Literal, Optional

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, START, END

from config import settings
from graph import prompts
from graph.state import AgentState, ContextPlan, SupportGrade
from harness.dlp import DLPFilter
from sources.law_mcp import run_gather_context, run_verify_citations


# ---------------------------------------------------------------------------
# LLM / 보조 함수
# ---------------------------------------------------------------------------

def build_llm() -> ChatGroq:
    """Groq LPU의 gpt-oss-120b 인스턴스를 생성함 (작성·평가·재작성 공용, 런타임 전용).

    reasoning_format='hidden' 으로 추론 과정을 숨기고 최종 텍스트만 받음(MUST).
    with_structured_output(method='json_schema') 와 공존 가능함을 mas-a/mas-b 스모크로 확인함.
    temperature=0 으로 작성·판단을 재현 가능하게 함.
    """
    api_key = settings.require_env("GROQ_API_KEY")
    return ChatGroq(
        model=settings.LLM_MODEL,
        temperature=settings.LLM_TEMPERATURE,
        reasoning_format=settings.LLM_REASONING_FORMAT,
        api_key=api_key,
        max_retries=settings.LLM_MAX_RETRIES,  # 429/503 일시 오류에 지수 백오프 재시도
    )


def format_history(history: list) -> str:
    """직전 대화 메시지를 프롬프트용 텍스트로 변환함 (멀티턴 맥락 제공)."""
    if not history:
        return "(이전 대화 없음)"
    recent = history[-settings.HISTORY_TURNS:]
    lines = []
    for message in recent:
        speaker = "사용자" if message["role"] == "user" else "어시스턴트"
        lines.append(f"{speaker}: {message['content']}")
    return "\n".join(lines)


def build_context_text(items: list[dict]) -> str:
    """컨텍스트 항목을 소스별로 묶어 초안 작성용 단일 컨텍스트 문자열로 합침."""
    if not items:
        return "(검색 컨텍스트 없음)"
    grouped: dict[str, list[dict]] = {}
    for item in items:
        grouped.setdefault(item.get("source", "자료"), []).append(item)
    blocks = []
    for source, group in grouped.items():
        lines = [f"=== {source} ==="]
        for index, item in enumerate(group, 1):
            content = (item.get("content", "") or "")[:settings.CONTEXT_ITEM_MAX_CHARS]
            lines.append(f"[{source} {index}] {item.get('title', '')}\n{content}")
        blocks.append("\n\n".join(lines))
    return "\n\n".join(blocks)


def build_sources_section(items: list[dict]) -> str:
    """컨텍스트 항목의 citation 을 소스별로 묶어 '출처' 섹션을 코드에서 직접 구성함(인용 환각 방지)."""
    if not items:
        return ""
    grouped: dict[str, list[str]] = {}
    for item in items:
        citation = item.get("citation")
        if citation:
            grouped.setdefault(item.get("source", "자료"), []).append(citation)
    blocks = []
    for source, citations in grouped.items():
        unique = list(dict.fromkeys(citations))  # 순서 보존 중복 제거
        blocks.append(f"**{source}**\n" + "\n".join(unique))
    return "## 출처\n" + "\n\n".join(blocks) if blocks else ""


def generate_draft(llm: ChatGroq, question: str, context_text: str,
                   history_text: str, gate_issue: str = "") -> str:
    """검색 컨텍스트를 근거로 의견서 초안을 생성함 (gate_issue 가 있으면 엄격 재작성).

    런타임 write_draft·rewrite_draft 노드가 공유하며, 오프라인 RAGAS 평가도 동일 시스템
    프롬프트(graph/prompts.DRAFT_SYSTEM_PROMPT)를 써서 측정값이 런타임을 대표하게 함.
    """
    system = prompts.DRAFT_SYSTEM_PROMPT
    if gate_issue:
        system = system + prompts.DRAFT_STRICT_RULE.replace("{gate_issue}", gate_issue)
    prompt = ChatPromptTemplate.from_messages([("system", system), ("human", "{question}")])
    return (prompt | llm | StrOutputParser()).invoke({
        "history": history_text, "context": context_text, "question": question,
    })


# ---------------------------------------------------------------------------
# MAS C 본체 (LangGraph 노드 + 그래프 구성)
# ---------------------------------------------------------------------------

class PatentOpinionMAS:
    """특허 의견서 작성·검증 단위 MAS (LangGraph StateGraph + checkpointer + interrupt)."""

    def __init__(self, llm: ChatGroq):
        self.llm = llm
        # 구조화 출력은 json_schema 로 강제(gpt-oss-120b는 function_calling 모드에서 도구명 오생성 위험)
        self.context_planner = llm.with_structured_output(ContextPlan, method="json_schema")
        self.support_grader = llm.with_structured_output(SupportGrade, method="json_schema")
        self.dlp = DLPFilter()
        self.graph = self._build_graph()

    # ===== 노드 1: gather_context =====
    def gather_context(self, state: AgentState) -> dict:
        """컨텍스트 확보: 오케스트레이터 주입분(provided_context) 우선, 없으면 MCP로 자체 수집."""
        provided = state.get("provided_context") or []
        if provided:
            print(f"\n[gather_context] 오케스트레이터 주입 컨텍스트 사용: {len(provided)}개 항목")
            return {"context_items": provided}

        print("\n[gather_context] 단독 실행 → korean-law MCP 로 컨텍스트 수집(A·B 프록시)")
        plan_prompt = ChatPromptTemplate.from_messages([
            ("system", prompts.CONTEXT_PLAN_SYSTEM), ("human", prompts.CONTEXT_PLAN_HUMAN),
        ])
        try:
            plan: ContextPlan = (plan_prompt | self.context_planner).invoke({"question": state["question"]})
            law_query = plan.law_query or state["question"]
            law_name = plan.law_name
        except Exception as error:  # noqa: BLE001 - 계획 실패 시 질문 자체로 폴백
            print(f"  ! 컨텍스트 계획 실패(질문으로 폴백): {type(error).__name__}")
            law_query, law_name = state["question"], ""
        print(f"  → law_query='{law_query}' law_name='{law_name}'")

        try:
            items = run_gather_context(law_query, law_name)
        except Exception as error:  # noqa: BLE001 - 수집 실패해도 빈 컨텍스트로 진행(IsSup가 잡음)
            print(f"  ! 컨텍스트 수집 실패(빈 컨텍스트로 진행): {type(error).__name__}: {str(error)[:120]}")
            items = []
        print(f"  → 수집된 컨텍스트 항목 {len(items)}개")
        return {"context_items": items}

    # ===== 노드 2: write_draft =====
    def write_draft(self, state: AgentState) -> dict:
        """검색 컨텍스트를 종합해 의견서 초안을 생성함 (최초 1회)."""
        print("\n[write_draft] 의견서 초안 작성 중...")
        context_text = build_context_text(state["context_items"])
        draft = generate_draft(self.llm, state["question"], context_text,
                               format_history(state.get("history", [])))
        print(f"  → 초안 {len(draft)}자 생성")
        return {"draft": draft}

    # ===== 노드 3: grade_support (IsSup) =====
    def grade_support(self, state: AgentState) -> dict:
        """[IsSup] 초안이 검색 컨텍스트에 근거하는지 1콜로 평가함(정답 불필요)."""
        print("\n[IsSup] 초안 근거성 평가 중...")
        context_text = build_context_text(state["context_items"])
        prompt = ChatPromptTemplate.from_messages([
            ("system", prompts.SUPPORT_GRADER_SYSTEM), ("human", prompts.SUPPORT_GRADER_HUMAN),
        ])
        grade: SupportGrade = (prompt | self.support_grader).invoke({
            "context": context_text, "draft": state["draft"],
        })
        print(f"  → 근거 있음: {grade.is_supported} ({grade.reasoning})")
        return {"is_supported": grade.is_supported, "support_reasoning": grade.reasoning}

    # ===== 노드 4: verify_citations =====
    def verify_citations(self, state: AgentState) -> dict:
        """korean-law MCP verify_citations 로 인용 환각을 탐지하고 게이트를 종합함(LLM 미사용)."""
        print("\n[verify_citations] 법령 조문 인용 환각 검증 중...")
        report = run_verify_citations(state["draft"])
        citations_ok = report.get("ok") is True  # ✗(NOT_FOUND) 0건 + 판정 성공일 때만 True

        if not report.get("reachable", False):
            issue = f"인용 검증 서비스 판정 불가: {report.get('note', '')}"
            print(f"  → 판정 불가(reachable=False) — {report.get('note', '')}")
        elif citations_ok:
            issue = ""
            print(f"  → 인용 정상 (총 {report['total']} / ✓{report['exist']} ✗0 ⚠{report['warns']})")
        else:
            issue = "환각(미존재) 인용: " + "; ".join(report.get("hallucinated", [])[:5])
            print(f"  → 환각 탐지 ✗{report['errors']}건: {report.get('hallucinated', [])}")

        is_supported = bool(state.get("is_supported"))
        gate_passed = is_supported and citations_ok
        reasons = []
        if not is_supported:
            reasons.append(f"근거 미달([IsSup]=False): {state.get('support_reasoning', '')}")
        if issue:
            reasons.append(issue)
        gate_reason = " / ".join(reasons) if reasons else "근거성·인용 모두 통과"
        print(f"  → 게이트: {'통과' if gate_passed else '미통과'} ({gate_reason})")

        return {
            "citation_report": report, "citations_ok": citations_ok, "citation_issue": issue,
            "gate_passed": gate_passed, "gate_reason": gate_reason,
        }

    # ===== 노드 5: rewrite_draft =====
    def rewrite_draft(self, state: AgentState) -> dict:
        """근거 미달·인용 환각·사람 반려 시 엄격 근거 기반으로 초안을 재작성함."""
        retry = state.get("retry_count", 0) + 1
        print(f"\n[rewrite_draft] 재작성 #{retry} (사유 반영)...")
        # 게이트 이슈(근거성·인용)와 사람 반려 피드백을 모두 모아 엄격 재작성 지시로 전달
        issues = []
        if not bool(state.get("is_supported", True)):
            issues.append(f"- 근거성 부족: {state.get('support_reasoning', '')}")
        if state.get("citation_issue"):
            issues.append(f"- 인용 문제: {state['citation_issue']}")
        if state.get("approved") is False and state.get("review_feedback"):
            issues.append(f"- 검토자 반려 의견: {state['review_feedback']}")
        gate_issue = "\n".join(issues) if issues else "- 근거성과 인용 정확성을 다시 점검하세요."

        context_text = build_context_text(state["context_items"])
        draft = generate_draft(self.llm, state["question"], context_text,
                               format_history(state.get("history", [])), gate_issue=gate_issue)
        print(f"  → 재작성 초안 {len(draft)}자")
        rewrites = list(state.get("rewrites", [])) + [{"reason": gate_issue}]
        # 재작성 후 사람 반려 플래그는 초기화(다음 라운드에서 다시 승인 받도록)
        return {"draft": draft, "retry_count": retry, "rewrites": rewrites,
                "approved": None, "review_feedback": ""}

    # ===== 노드 6: escalate =====
    def escalate(self, state: AgentState) -> dict:
        """재시도 소진/verify 판정 불가 → HITL 승급 표시(전파 차단, 사람이 최종 판단)."""
        print(f"\n[escalate] 게이트 미통과로 HITL 승급: {state.get('gate_reason', '')}")
        return {"escalated": True}

    # ===== 노드 7: human_review (interrupt 지점) =====
    def human_review(self, state: AgentState) -> dict:
        """확정 전 사람 승인 노드. interrupt_before 로 이 노드 실행 전 그래프가 멈춤.

        앱이 사람의 승인/반려(+피드백)를 update_state 로 기록한 뒤 재개하면 이 노드가 통과됨.
        승인 여부는 state['approved'] 로 전달됨(None=미지정 → 기본 승인 처리는 분기에서).
        """
        decision = state.get("approved")
        print(f"\n[human_review] 사람 승인 결과: approved={decision}")
        return {}

    # ===== 노드 8: finalize (DLP) =====
    def finalize(self, state: AgentState) -> dict:
        """DLP 개인정보 마스킹 + 법적 책임 고지문 부착 → 최종 출력 구성."""
        print("\n[finalize] DLP 마스킹 + 고지문 부착...")
        draft = state["draft"]
        findings = self.dlp.scan(draft)
        masked = self.dlp.mask(draft)
        if findings:
            print(f"  → PII {len(findings)}건 마스킹: {[f['type'] for f in findings]}")

        sources_section = build_sources_section(state["context_items"])
        notes = []
        if state.get("escalated"):
            notes.append(f"> ⚠️ 자동 검증 게이트 미통과 항목이 있어 사람 검토로 승급됨: {state.get('gate_reason', '')}")
        if state.get("approved") is False:
            notes.append("> ⚠️ 검토자가 반려한 초안임. 최종본이 아니며 추가 수정이 필요함.")
        notes_section = "\n".join(notes)

        parts = [masked]
        if sources_section:
            parts.append(sources_section)
        if notes_section:
            parts.append(notes_section)
        parts.append(settings.LEGAL_DISCLAIMER)
        final_output = "\n\n".join(parts)
        return {"final_output": final_output, "dlp_findings": findings}

    # ===== 조건부 엣지 =====
    def decide_gate(self, state: AgentState) -> Literal["approve", "rewrite", "escalate"]:
        """verify 직후 분기: 통과→사람승인 / 판정불가·소진→승급 / 그 외 미통과→재작성."""
        if state["gate_passed"]:
            return "approve"
        # verify 판정 불가(서비스 이슈)는 재작성으로 못 고침 → 바로 HITL 승급
        if state.get("citation_report", {}).get("ok") is None:
            return "escalate"
        if state.get("retry_count", 0) < settings.MAX_REWRITES:
            return "rewrite"
        return "escalate"

    def decide_after_review(self, state: AgentState) -> Literal["finalize", "rewrite"]:
        """사람 승인 직후 분기: 반려+재시도 여유면 재작성, 그 외에는 확정(DLP)."""
        if state.get("approved") is False:
            if state.get("retry_count", 0) < settings.MAX_REWRITES:
                return "rewrite"
            print("  → 반려되었으나 재시도 소진 → 반려 표시와 함께 확정 단계로 진행")
        return "finalize"

    # ===== 그래프 구성 =====
    def _build_graph(self):
        """노드·엣지를 연결하고 checkpointer + interrupt_before(HITL)로 컴파일함."""
        workflow = StateGraph(AgentState)
        workflow.add_node("gather_context", self.gather_context)
        workflow.add_node("write_draft", self.write_draft)
        workflow.add_node("grade_support", self.grade_support)
        workflow.add_node("verify_citations", self.verify_citations)
        workflow.add_node("rewrite_draft", self.rewrite_draft)
        workflow.add_node("escalate", self.escalate)
        workflow.add_node("human_review", self.human_review)
        workflow.add_node("finalize", self.finalize)

        workflow.add_edge(START, "gather_context")
        workflow.add_edge("gather_context", "write_draft")
        workflow.add_edge("write_draft", "grade_support")
        workflow.add_edge("grade_support", "verify_citations")
        workflow.add_conditional_edges("verify_citations", self.decide_gate, {
            "approve": "human_review", "rewrite": "rewrite_draft", "escalate": "escalate",
        })
        workflow.add_edge("rewrite_draft", "grade_support")  # 재작성 → 재평가(IsSup·verify) 루프
        workflow.add_edge("escalate", "human_review")
        workflow.add_conditional_edges("human_review", self.decide_after_review, {
            "finalize": "finalize", "rewrite": "rewrite_draft",
        })
        workflow.add_edge("finalize", END)

        # checkpointer + interrupt_before: human_review 실행 전 멈춰 사람 승인을 기다림(HITL)
        return workflow.compile(checkpointer=MemorySaver(), interrupt_before=["human_review"])

    # ===== 초기 상태 =====
    @staticmethod
    def initial_state(question: str, history: Optional[list] = None,
                      provided_context: Optional[list] = None) -> AgentState:
        """그래프 실행용 초기 상태를 구성함 (오케스트레이터는 provided_context 를 주입)."""
        return {
            "question": question,
            "history": history or [],
            "provided_context": provided_context or [],
            "context_items": [],
            "draft": "",
            "is_supported": None, "support_reasoning": "",
            "citation_report": {}, "citations_ok": None, "citation_issue": "",
            "gate_passed": None, "gate_reason": "", "escalated": False,
            "retry_count": 0, "rewrites": [],
            "approved": None, "review_feedback": "",
            "dlp_findings": [], "final_output": "",
        }
