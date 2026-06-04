window.EXPLAIN_DATA = {
  meta: {
    title: "특허 의견서 작성·검증 MAS — 인라인 검증 게이트 + HITL(사람 승인) + DLP(민감정보 마스킹)",
    entry: "app.py",
  },

  // 좌측 그룹 = 파일 (진입점 → 워크플로우 → 상태/프롬프트 → 외부도구(MCP·DLP) → 설정)
  files: [
    { id: "app",      label: "app.py",            role: "Streamlit/CLI 진입점 — 질문 받기→그래프 실행→HITL 사람 승인→최종 의견서 출력" },
    { id: "workflow", label: "graph/workflow.py", role: "LangGraph 워크플로우 — 초안 작성→[IsSup] 근거성→인용 검증→재작성/승급→사람 승인→DLP 노드를 엮음" },
    { id: "state",    label: "graph/state.py",    role: "그래프 상태(State)와 LLM 구조화 출력 스키마 정의 — 노드 사이로 흐르는 데이터 묶음" },
    { id: "prompts",  label: "graph/prompts.py",  role: "초안 작성·근거성 평가 프롬프트(LLM 지시문) 모음 — 인용 환각을 막는 작성 규칙 포함" },
    { id: "lawmcp",   label: "sources/law_mcp.py", role: "korean-law MCP 클라이언트 — 인용 검증(verify_citations)을 실패-안전하게 호출하고 결과를 파싱" },
    { id: "dlp",      label: "harness/dlp.py",    role: "DLP 출력 필터 — 주민번호·전화·이메일 등 개인정보(PII)를 정규식으로 탐지·마스킹" },
    { id: "settings", label: "config/settings.py", role: "전역 설정 — 모델·MCP 접속·게이트 제어값·법적 책임 고지문을 한곳에서 관리" },
  ],

  // 전체 처리 흐름 (질문 → 컨텍스트 → 초안 → 검증 게이트 → 재작성/승급 → 사람 승인 → DLP → 출력)
  flow: [
    {
      step: 1,
      title: "질문 입력 & 컨텍스트 확보",
      summary: "gather_context: 오케스트레이터가 준 자료가 있으면 사용, 없으면 korean-law MCP로 법령·판례 수집",
      detail: "사용자가 '직무발명 보상금 의견서를 써줘' 같은 요청을 합니다. 의견서를 쓰려면 근거 자료가 필요하므로, 상위 시스템이 미리 넘겨준 검색 자료(provided_context)가 있으면 그대로 쓰고, 없으면(단독 실행) 법령 검색 서버(korean-law MCP)에서 관련 법령·판례를 직접 모읍니다. 비유하면 '글을 쓰기 전에 참고할 책과 판례집을 책상에 펼치는' 단계입니다.",
    },
    {
      step: 2,
      title: "의견서 초안 작성",
      summary: "write_draft: 모은 자료를 근거로 LLM이 의견서 초안(사안 개요·쟁점·법령·검토의견·결론)을 생성",
      detail: "모아 둔 자료를 LLM(gpt-oss-120b)에게 주고, 정해진 형식(사안 개요→쟁점→관련 법령·판례→검토 의견→결론)으로 의견서 초안을 쓰게 합니다. 이때 '자료에 실제로 나온 조문만 인용하고, 조문 번호를 지어내지 말라'는 엄격한 규칙을 줍니다. AI가 그럴듯한 가짜 조문을 만드는 '환각'을 처음부터 줄이기 위함입니다.",
    },
    {
      step: 3,
      title: "검증 게이트 1 — 근거성 [IsSup]",
      summary: "grade_support: 초안의 주장이 '모아 둔 자료'로 실제 뒷받침되는지 LLM이 1번 호출로 판정",
      detail: "AI가 쓴 초안이 정말 근거 있는 글인지 검사하는 첫 관문입니다. 별도의 '정답'이 없어도(reference-free), '이 초안의 핵심 주장이 제공된 자료에서 직접 확인되는가?'를 LLM에게 한 번 물어 True/False로 답하게 합니다. 자료에 없는 사실을 지어냈으면 False가 됩니다. 비유하면 '제출하기 전에 인용한 내용이 실제 책에 있는지 대조하는' 검토입니다.",
    },
    {
      step: 4,
      title: "검증 게이트 2 — 인용 환각 탐지 (verify_citations)",
      summary: "verify_citations: 초안에 적힌 '특허법 제29조' 같은 조문 인용이 실제 존재하는지 MCP로 교차검증",
      detail: "초안에 적은 법령 조문 인용('특허법 제29조' 등)이 실제로 존재하는 조문인지를 외부 검증 서버(korean-law MCP)에 물어 확인합니다. AI가 없는 조문 번호를 지어낸 경우(환각 인용)를 잡아냅니다. 이 검사는 LLM을 쓰지 않고 실제 법령 DB와 대조하므로 더 믿을 만합니다. 두 게이트를 모두 통과(근거 있음 + 환각 인용 0건)해야 다음으로 넘어갑니다.",
    },
    {
      step: 5,
      title: "재작성 또는 승급(escalate) — fail-safe",
      summary: "decide_gate: 게이트 미통과 시 → (여유 있으면) 엄격 재작성 / (검증 불가·재시도 소진) HITL 승급",
      detail: "게이트를 통과하지 못하면 두 갈래로 처리합니다. (a) 고칠 수 있는 문제(근거 부족·환각 인용)이고 재작성 횟수가 남았으면 문제점을 알려 주며 다시 쓰게 합니다(rewrite). (b) 검증 서버가 응답을 못 줘 '판정 불가'이거나 재작성을 다 써 버리면, AI가 임의로 통과시키지 않고 사람에게 넘깁니다(escalate). 핵심은 '검증 실패를 정상으로 흡수하지 않고, 막히면 사람에게 올린다'는 fail-safe 원칙입니다.",
    },
    {
      step: 6,
      title: "사람 승인 (HITL)",
      summary: "human_review: interrupt로 그래프를 멈추고 초안·게이트 결과·법적 고지를 사람이 보고 승인/반려",
      detail: "이 시스템의 가장 중요한 안전장치입니다. AI 결과를 곧장 내보내지 않고, LangGraph의 interrupt 기능으로 'human_review 노드 직전'에서 실행을 멈춥니다. 사람은 초안과 검증 결과, 법적 책임 고지를 보고 승인하거나 사유를 적어 반려합니다(반려하면 다시 재작성). 왜 사람이 최종 확인할까요? 법률 문서는 틀리면 큰 피해가 생기고, AI는 100% 정확하지 않기 때문에 '확정 권한은 사람이 갖는' 구조로 만든 것입니다.",
    },
    {
      step: 7,
      title: "DLP 마스킹 + 최종 출력",
      summary: "finalize: 승인된 초안에서 주민번호·전화·이메일 등 개인정보를 가린 뒤 출처·고지문을 붙여 출력",
      detail: "사람이 승인한 글을 외부로 내보내기 직전, 마지막 게이트로 개인정보(PII)를 가립니다. 주민등록번호·전화번호·이메일·카드번호 같은 민감정보를 정규식으로 찾아 '[유형_마스킹]'으로 바꿉니다(DLP). 왜 가릴까요? 의견서가 메일·문서로 유출돼도 개인이 식별되지 않게 하기 위함입니다. 마지막에 출처 목록과 '이 글은 AI 참고용이며 전문가 검토가 필요함' 고지문을 붙여 최종본을 완성합니다.",
    },
    {
      step: 8,
      title: "(별도) 오프라인 RAGAS 평가",
      summary: "evaluate/: 런타임과 분리된 별도 환경에서 작성 품질(Faithfulness 등)을 사후 측정 — 핵심 흐름엔 미포함",
      detail: "evaluate/ 폴더는 위 실시간 흐름과 무관하게, 별도 가상환경에서 RAGAS로 작성 품질을 사후 평가하는 도구입니다. 런타임 의존성이 아니므로 본 설명에서는 흐름 언급만 하고 함수 설명에서는 제외합니다.",
    },
  ],

  functions: [
    // ───────────────────────── app.py ─────────────────────────
    {
      id: "run_with_hitl",
      name: "run_with_hitl()",
      fileId: "app",
      summary: "그래프를 실행하되 사람 승인(HITL) 지점마다 멈춰 승인 결정을 받아 다시 이어 가는 함수",
      how: "LangGraph의 interrupt 기능을 실제로 굴리는 함수입니다. 먼저 그래프를 한 번 실행하면 사람 승인 노드 '직전'에서 자동으로 멈춥니다(interrupt_before). 그 멈춘 지점에서 현재 상태(초안·검증 결과)를 꺼내 approve_fn(사람에게 묻는 콜백)에 넘겨 '승인/반려'를 받고, 그 결정을 상태에 기록(update_state)한 뒤 invoke(None)으로 멈춘 곳부터 다시 이어 실행합니다. 더 실행할 노드가 없을 때까지 이 멈춤-승인-재개를 반복합니다.",
      terms: ["HITL", "LangGraph", "interrupt(인터럽트)", "체크포인터(checkpointer)", "thread_id", "콜백(callback)", "UUID"],
      lines: [
        { at: 'config = {"configurable": {"thread_id": str(uuid.uuid4())},', text: "이번 요청을 식별할 고유 ID(thread_id)를 만듭니다 — 멈췄다 이어 갈 때 '어느 대화였는지' 기억하는 열쇠입니다." },
        { at: "initial = agent.initial_state(question, history, provided_context)", text: "그래프에 넣을 초기 상태(질문·이전 대화·주입 자료)를 준비합니다." },
        { at: "agent.graph.invoke(initial, config)  # human_review 직전", text: "그래프를 실행합니다. 사람 승인 노드 '직전'에서 자동으로 멈춥니다." },
        { at: "snapshot = agent.graph.get_state(config)", text: "지금 멈춰 있는 상태(스냅샷)를 꺼냅니다 — 초안·검증 결과가 들어 있습니다." },
        { at: "if not snapshot.next:", text: "더 실행할 노드가 없으면(끝까지 왔으면) 최종 상태를 돌려주고 끝냅니다." },
        { at: "approved, feedback = approve_fn(snapshot.values)", text: "사람에게 '승인할래요?'를 물어 승인 여부와 반려 사유(피드백)를 받습니다." },
        { at: 'agent.graph.update_state(config, {"approved": approved,', text: "사람의 승인 결정을 그래프 상태에 기록합니다(다음 분기가 이 값을 봄)." },
        { at: "agent.graph.invoke(None, config)", text: "멈췄던 지점부터 다시 이어 실행합니다(None은 '새 입력 없이 재개'를 뜻함)." },
      ],
      code: `def run_with_hitl(agent: PatentOpinionMAS, question: str, history: list,
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
        agent.graph.invoke(None, config)`,
    },
    {
      id: "format_summary",
      name: "format_summary()",
      fileId: "app",
      summary: "게이트·재작성·HITL·DLP 처리 결과를 한눈에 보이는 요약 문자열로 만드는 함수",
      how: "한 요청이 처리되며 일어난 일(자료 몇 개 모았는지, 재작성 몇 번 했는지, 근거성 통과 여부, 인용 검증 결과, 사람 승인 여부, 개인정보 몇 건 가렸는지)을 표처럼 정리해 줍니다. 사람이 승인 화면과 최종 결과에서 '무슨 검증을 거쳤는지' 빠르게 파악하도록 돕는 표시 전용 함수입니다.",
      terms: ["IsSup", "DLP", "PII(개인정보)", "게이트(gate)", "escalate(승급)"],
      lines: [
        { at: "report = state.get(", text: "인용 검증 결과 보고서를 상태에서 꺼냅니다(없으면 빈 값)." },
        { at: "lines.append(f\"[컨텍스트] 항목", text: "근거로 모은 자료가 몇 개인지 적습니다." },
        { at: "lines.append(f\"[IsSup", text: "근거성 게이트(IsSup) 통과 여부를 적습니다." },
        { at: 'verdict = "판정불가"', text: "인용 검증을 '정상/환각탐지/판정불가' 중 하나로 해석합니다(검증 서버가 죽으면 판정불가)." },
        { at: "lines.append(f\"[게이트", text: "두 검증을 종합한 게이트 통과/미통과와 사유를 적습니다." },
        { at: "lines.append(f\"[HITL", text: "사람 승인 결과와 승급(escalated) 여부를 적습니다." },
        { at: "findings = state.get(\"dlp_findings\"", text: "DLP가 가린 개인정보 목록을 꺼냅니다." },
        { at: "lines.append(f\"[DLP", text: "마스킹한 개인정보가 몇 건·어떤 유형인지 적습니다." },
      ],
      code: `def format_summary(state: dict) -> str:
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
    return "\\n".join(lines)`,
    },

    {
      id: "review_callbacks",
      name: "show_review_panel() · interactive_approve() · make_demo_approve()",
      fileId: "app",
      summary: "사람 승인(HITL) 화면을 보여주고(show_review_panel) 승인/반려를 받는 콜백 — 대화형/데모 두 가지",
      how: "HITL 멈춤 지점에서 run_with_hitl이 호출하는 '사람에게 묻는' 콜백들입니다. show_review_panel은 처리 요약·초안·법적 고지를 화면에 보여줍니다. interactive_approve는 사람이 직접 y/n과 반려 사유를 입력하게 합니다. make_demo_approve는 자동 시연용 콜백을 만들어, 기본은 자동 승인하되 reject_first=True면 첫 회만 반려해 '반려→재작성' 흐름을 보여줍니다. 모든 콜백은 (승인여부, 피드백) 짝을 돌려줍니다.",
      terms: ["HITL", "콜백(callback)", "법적 책임 고지(disclaimer)", "재작성(rewrite)"],
      lines: [
        { at: "def show_review_panel(state: dict) -> None:", text: "승인 화면: 요약·초안·법적 고지를 사람에게 보여줍니다." },
        { at: "print(state.get(\"draft\", \"\"))", text: "검토 대상인 초안 본문을 화면에 출력합니다." },
        { at: 'choice = input("\\n승인하시겠습니까? (y=승인 / n=반려, 사유 입력): ").strip()', text: "대화형: 사람에게 승인 여부를 입력받습니다." },
        { at: 'feedback = input("반려 사유(재작성에 반영): ").strip()', text: "대화형: 반려 시 재작성에 반영할 사유를 입력받습니다." },
        { at: "if reject_first and calls[\"n\"] == 1:", text: "데모: reject_first면 첫 회만 반려해 재작성을 시연합니다." },
        { at: 'print(">> [데모] 자동 승인합니다.")', text: "데모: 그 외에는 자동으로 승인합니다." },
      ],
      code: `def show_review_panel(state: dict) -> None:
    """HITL 승인 화면: 초안·게이트 상태·법적 책임 고지를 사람에게 보여줌."""
    print("\\n" + "#" * 64)
    print("# 사람 승인 요청 (HITL) — 확정 전 검토")
    print("#" * 64)
    print(format_summary(state))
    print("\\n[검토 대상 초안]\\n" + "-" * 64)
    print(state.get("draft", ""))
    print("-" * 64)
    print("\\n" + settings.LEGAL_DISCLAIMER)


def interactive_approve(state: dict) -> tuple[bool, str]:
    """대화형 승인: 초안·게이트를 보여주고 승인/반려(+피드백)를 입력받음."""
    show_review_panel(state)
    while True:
        choice = input("\\n승인하시겠습니까? (y=승인 / n=반려, 사유 입력): ").strip()
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

    return _approve`,
    },
    {
      id: "run_demo_chat",
      name: "run_demo() · chat()",
      fileId: "app",
      summary: "MAS를 실제로 굴리는 두 러너 — 비대화형 시연(run_demo)과 대화형 루프(chat)",
      how: "준비된 MAS를 실행하는 진입 함수들입니다. run_demo는 미리 정해 둔 검증 시나리오를 자동 승인/반려 콜백으로 비대화형 실행해 동작을 시연합니다(--demo). chat은 사용자의 질문을 계속 받아 작성·검증·사람 승인을 거쳐 최종 의견서를 출력하는 대화형 루프입니다. 둘 다 run_with_hitl로 그래프를 돌리고, 대화 맥락(history)을 누적해 멀티턴을 지원합니다.",
      terms: ["HITL", "콜백(callback)", "멀티턴(multi-turn)", "재작성(rewrite)"],
      lines: [
        { at: '("직무발명 보상금 청구에 대한 의견서를 작성해줘", make_demo_approve(reject_first=False)),', text: "데모 시나리오 1: 자동 승인으로 정상 흐름을 보여줍니다." },
        { at: "make_demo_approve(reject_first=True)),", text: "데모 시나리오 2: 첫 회 반려로 '반려→재작성' 흐름을 보여줍니다." },
        { at: "state = run_with_hitl(agent, question, history, approve_fn)", text: "데모: 정해진 콜백으로 그래프를 실행합니다." },
        { at: "state = run_with_hitl(agent, question, history, interactive_approve)", text: "대화형: 사람이 직접 승인하는 콜백으로 실행합니다." },
        { at: 'if question.lower() in ("quit", "q", "exit", "종료"):', text: "대화형: 종료어를 입력하면 루프를 끝냅니다." },
        { at: 'if question.lower() in ("clear", "초기화"):', text: "대화형: 'clear'로 이전 대화 맥락을 비울 수 있습니다." },
        { at: "except Exception as error:  # noqa: BLE001 - 한 요청의 오류로 루프가 죽지 않게 함", text: "대화형: 한 요청에서 오류가 나도 전체 루프가 죽지 않게 감쌉니다." },
      ],
      code: `def run_demo(agent: PatentOpinionMAS) -> None:
    """검증 시나리오를 비대화형으로 실행함 (--demo). HITL 은 자동 승인/반려로 시연."""
    scenarios = [
        # (질문, 승인콜백) — 단독 실행이라 gather_context 가 MCP 로 컨텍스트를 수집함
        ("직무발명 보상금 청구에 대한 의견서를 작성해줘", make_demo_approve(reject_first=False)),
        ("특허 거절이유(진보성 부정) 통지에 대한 대응 의견서를 작성해줘", make_demo_approve(reject_first=True)),
    ]
    history: list = []
    for idx, (question, approve_fn) in enumerate(scenarios, 1):
        print("\\n" + "@" * 64)
        print(f"@ 데모 시나리오 {idx}/{len(scenarios)}: {question}")
        print("@" * 64)
        state = run_with_hitl(agent, question, history, approve_fn)
        print_result(state)
        history.append({"role": "user", "content": question})
        history.append({"role": "assistant", "content": state.get("final_output", "")})


def chat(agent: PatentOpinionMAS) -> None:
    """대화형 루프: 질문 → 작성·검증 → HITL 승인 → 최종 의견서."""
    print("\\n" + "=" * 64)
    print("특허 의견서 작성·검증 MAS C")
    print("=" * 64)
    print("의견서 초안을 작성하고, 근거성([IsSup])과 인용 환각(verify_citations)을 검증합니다.")
    print("확정 전 사람 승인(HITL)을 거치며, 최종 출력은 DLP 로 개인정보를 마스킹합니다.")
    print("'quit'/'q' 종료, 'clear' 대화 초기화.")
    print("=" * 64 + "\\n")

    history: list = []
    while True:
        try:
            question = input("의견서 작성 요청: ").strip()
            if not question:
                continue
            if question.lower() in ("quit", "q", "exit", "종료"):
                print("\\n종료합니다. 감사합니다!")
                break
            if question.lower() in ("clear", "초기화"):
                history.clear()
                print("\\n[대화 맥락을 초기화했습니다.]\\n")
                continue
            state = run_with_hitl(agent, question, history, interactive_approve)
            print_result(state)
            history.append({"role": "user", "content": question})
            history.append({"role": "assistant", "content": state.get("final_output", "")})
            print()
        except KeyboardInterrupt:
            print("\\n\\n종료합니다.")
            break
        except Exception as error:  # noqa: BLE001 - 한 요청의 오류로 루프가 죽지 않게 함
            print(f"\\n오류가 발생했습니다: {error}\\n")`,
    },

    // ───────────────────────── graph/workflow.py ─────────────────────────
    {
      id: "grade_support",
      name: "grade_support()",
      fileId: "workflow",
      summary: "검증 게이트 1 — 초안이 '모아 둔 자료'에 근거하는지(환각이 없는지) LLM 1콜로 판정하는 노드",
      how: "Self-RAG의 [IsSup](Is Supported) 평가입니다. 모아 둔 검색 자료와 초안을 함께 LLM에게 주고 '이 초안이 자료에 근거하나요?'를 물어 True/False와 한 문장 이유를 받습니다. 정답지가 따로 없어도 되는(reference-free) 가벼운 검사라 한 번의 호출로 끝납니다. 결과는 구조화 출력(SupportGrade)으로 강제해 항상 같은 형태로 안정 파싱됩니다.",
      terms: ["IsSup", "Self-RAG", "LLM", "with_structured_output(구조화 출력)", "노드(node)", "프롬프트(prompt)"],
      lines: [
        { at: "context_text = build_context_text(state[\"context_items\"])", text: "모아 둔 자료들을 하나의 긴 문자열(컨텍스트)로 합칩니다." },
        { at: 'prompts.SUPPORT_GRADER_SYSTEM', text: "'초안이 자료에 근거하는지 평가하라'는 채점관 지시문을 시스템 프롬프트로 씁니다." },
        { at: "grade: SupportGrade = (prompt | self.support_grader).invoke({", text: "LLM을 호출해 결과를 SupportGrade(True/False+이유) 형태로 강제 출력받습니다." },
        { at: '"context": context_text, "draft": state["draft"],', text: "평가에 필요한 자료(컨텍스트)와 채점 대상(초안)을 넘깁니다." },
        { at: 'return {"is_supported": grade.is_supported,', text: "근거 여부와 판단 이유를 상태에 기록해 다음 노드(인용 검증)로 넘깁니다." },
      ],
      code: `    # ===== 노드 3: grade_support (IsSup) =====
    def grade_support(self, state: AgentState) -> dict:
        """[IsSup] 초안이 검색 컨텍스트에 근거하는지 1콜로 평가함(정답 불필요)."""
        print("\\n[IsSup] 초안 근거성 평가 중...")
        context_text = build_context_text(state["context_items"])
        prompt = ChatPromptTemplate.from_messages([
            ("system", prompts.SUPPORT_GRADER_SYSTEM), ("human", prompts.SUPPORT_GRADER_HUMAN),
        ])
        grade: SupportGrade = (prompt | self.support_grader).invoke({
            "context": context_text, "draft": state["draft"],
        })
        print(f"  → 근거 있음: {grade.is_supported} ({grade.reasoning})")
        return {"is_supported": grade.is_supported, "support_reasoning": grade.reasoning}`,
    },
    {
      id: "verify_citations_node",
      name: "verify_citations() (노드)",
      fileId: "workflow",
      summary: "검증 게이트 2 — MCP 인용 검증 결과로 환각 인용을 잡고, 두 게이트를 종합해 통과 여부를 결정하는 노드",
      how: "초안의 법령 조문 인용을 korean-law MCP로 검증하고(LLM 미사용), 그 결과와 앞 게이트(IsSup)를 합쳐 최종 통과 여부를 정합니다. 검증 서버가 응답을 못 주면(reachable=False) '판정 불가'로 두어 게이트를 통과시키지 않습니다(fail-safe). 통과 조건은 '근거 있음(IsSup=True) 그리고 환각 인용 0건'으로, 둘 다 만족해야만 사람 승인 단계로 갑니다.",
      terms: ["verify_citations", "인용 환각(hallucination)", "게이트(gate)", "fail-safe(실패 안전)", "MCP", "노드(node)"],
      lines: [
        { at: "report = run_verify_citations(state[\"draft\"])", text: "초안을 MCP 인용 검증 도구에 보내 결과 보고서를 받습니다." },
        { at: 'citations_ok = report.get("ok") is True', text: "환각 인용이 0건이고 판정에 성공했을 때만 '인용 정상'으로 봅니다." },
        { at: 'if not report.get("reachable", False):', text: "검증 서버에 닿지 못했으면(판정 불가) 통과시키지 않고 문제로 표시합니다(fail-safe)." },
        { at: "is_supported = bool(state.get(\"is_supported\"))", text: "앞 게이트(근거성) 결과를 가져옵니다." },
        { at: "gate_passed = is_supported and citations_ok", text: "게이트 핵심: 근거 있음 '그리고' 환각 인용 0건일 때만 통과입니다." },
        { at: "if not is_supported:", text: "근거가 부족하면 미통과 사유로 기록합니다." },
        { at: 'gate_reason = " / ".join(reasons) if reasons', text: "통과/미통과 사유들을 한 줄 요약으로 합칩니다." },
        { at: '"gate_passed": gate_passed, "gate_reason": gate_reason,', text: "종합 게이트 결과를 상태에 기록해 분기(decide_gate)가 보게 합니다." },
      ],
      code: `    # ===== 노드 4: verify_citations =====
    def verify_citations(self, state: AgentState) -> dict:
        """korean-law MCP verify_citations 로 인용 환각을 탐지하고 게이트를 종합함(LLM 미사용)."""
        print("\\n[verify_citations] 법령 조문 인용 환각 검증 중...")
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
        }`,
    },
    {
      id: "decide_gate",
      name: "decide_gate()",
      fileId: "workflow",
      summary: "검증 직후 갈림길 — 통과면 사람 승인, 판정불가·재시도 소진이면 승급, 그 외엔 재작성으로 보내는 분기 함수",
      how: "게이트 결과를 보고 다음에 어느 노드로 갈지 정하는 LangGraph 조건부 엣지입니다. 통과하면 사람 승인(approve)으로, 검증 서버가 응답을 못 줘 '판정 불가'면 재작성으로는 못 고치므로 바로 사람에게 승급(escalate)합니다. 고칠 수 있는 문제이고 재작성 여유가 남았으면 재작성(rewrite), 재시도를 다 썼으면 승급(escalate)으로 보냅니다. fail-safe(막히면 사람에게)를 코드로 구현한 핵심입니다.",
      terms: ["조건부 엣지(conditional edge)", "분기(branch)", "escalate(승급)", "fail-safe(실패 안전)", "재작성(rewrite)"],
      lines: [
        { at: 'if state["gate_passed"]:', text: "두 검증을 모두 통과했으면 곧장 사람 승인 단계로 보냅니다." },
        { at: 'return "approve"', text: "사람 승인(human_review) 노드로 가라는 신호입니다." },
        { at: 'if state.get("citation_report", {}).get("ok") is None:', text: "인용 검증이 '판정 불가'면 재작성으로 못 고치므로 바로 승급합니다." },
        { at: 'if state.get("retry_count", 0) < settings.MAX_REWRITES:', text: "재작성 횟수가 한도(기본 2회) 미만이면 다시 쓰게 하고(rewrite), 한도에 도달했으면 사람에게 승급(escalate)합니다." },
        { at: 'return "rewrite"', text: "엄격한 근거 기반으로 다시 쓰는 재작성 노드로 보냅니다." },
        { at: "# verify 판정 불가(서비스 이슈)는 재작성으로 못 고침", text: "검증 서버가 응답을 못 주면 재작성으로 해결 불가 → 바로 승급(escalate)으로 보냅니다." },
      ],
      code: `    # ===== 조건부 엣지 =====
    def decide_gate(self, state: AgentState) -> Literal["approve", "rewrite", "escalate"]:
        """verify 직후 분기: 통과→사람승인 / 판정불가·소진→승급 / 그 외 미통과→재작성."""
        if state["gate_passed"]:
            return "approve"
        # verify 판정 불가(서비스 이슈)는 재작성으로 못 고침 → 바로 HITL 승급
        if state.get("citation_report", {}).get("ok") is None:
            return "escalate"
        if state.get("retry_count", 0) < settings.MAX_REWRITES:
            return "rewrite"
        return "escalate"`,
    },
    {
      id: "build_graph",
      name: "_build_graph()",
      fileId: "workflow",
      summary: "8개 노드와 분기를 연결하고, HITL을 위해 'human_review 직전에 멈추도록' 컴파일하는 함수",
      how: "전체 워크플로우의 '배선도'입니다. 노드(컨텍스트→초안→근거성→인용검증→재작성/승급→사람승인→DLP)를 추가하고 화살표(엣지)로 잇습니다. 검증 뒤(decide_gate)와 승인 뒤(decide_after_review)는 상황에 따라 길이 갈리는 조건부 엣지로 연결합니다. 마지막에 checkpointer(중간 상태 저장)와 interrupt_before=['human_review']를 주어, 사람 승인 노드 '직전'에서 자동으로 멈추는 HITL 구조로 컴파일합니다.",
      terms: ["StateGraph", "노드(node)", "엣지(edge)", "조건부 엣지(conditional edge)", "체크포인터(checkpointer)", "interrupt(인터럽트)", "HITL"],
      lines: [
        { at: "workflow = StateGraph(AgentState)", text: "상태(State)를 공유하는 빈 워크플로우 그래프를 만듭니다." },
        { at: 'workflow.add_node("human_review", self.human_review)', text: "사람 승인 노드를 등록합니다 — 여기 직전에서 그래프가 멈추게 됩니다." },
        { at: 'workflow.add_edge(START, "gather_context")', text: "시작점에서 첫 노드(컨텍스트 확보)로 이어 줍니다." },
        { at: 'workflow.add_conditional_edges("verify_citations", self.decide_gate, {', text: "인용 검증 뒤 decide_gate 결과에 따라 승인/재작성/승급으로 길을 가릅니다." },
        { at: 'workflow.add_edge("rewrite_draft", "grade_support")', text: "재작성하면 다시 근거성→인용 검증으로 돌아가는 루프를 만듭니다." },
        { at: 'workflow.add_conditional_edges("human_review", self.decide_after_review, {', text: "사람 승인 뒤 반려면 재작성, 승인이면 확정(DLP)으로 길을 가릅니다." },
        { at: 'return workflow.compile(checkpointer=MemorySaver(), interrupt_before=["human_review"])', text: "핵심: 중간 저장(checkpointer)을 켜고 사람 승인 노드 '직전'에서 멈추도록 컴파일합니다(HITL)." },
      ],
      code: `    # ===== 그래프 구성 =====
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
        return workflow.compile(checkpointer=MemorySaver(), interrupt_before=["human_review"])`,
    },

    {
      id: "gather_context",
      name: "gather_context() (노드 1)",
      fileId: "workflow",
      summary: "글을 쓰기 전 근거 자료를 확보하는 첫 노드 — 주입 자료가 있으면 쓰고, 없으면 MCP로 직접 수집",
      how: "의견서를 쓰려면 근거가 필요하므로 가장 먼저 자료를 모읍니다. 상위 오케스트레이터가 미리 넘겨준 검색 자료(provided_context)가 있으면 그대로 쓰고(자체 수집 생략), 없으면(단독 실행) LLM에게 검색 키워드·법령명을 뽑게 한 뒤 korean-law MCP로 판례·해석례·법령을 직접 모읍니다. 수집이 실패해도 멈추지 않고 빈 컨텍스트로 진행합니다 — 근거가 부족하면 뒤의 [IsSup] 게이트가 잡아내기 때문입니다.",
      terms: ["노드(node)", "State(상태)", "MCP", "fan-in(팬인)", "폴백(fallback)", "with_structured_output(구조화 출력)"],
      lines: [
        { at: "provided = state.get(\"provided_context\") or []", text: "상위 시스템이 주입한 검색 자료가 있는지 먼저 확인합니다." },
        { at: "if provided:", text: "주입 자료가 있으면 그대로 컨텍스트로 쓰고 자체 수집을 건너뜁니다(fan-in 소비)." },
        { at: 'return {"context_items": provided}', text: "주입받은 자료를 그대로 상태에 채워 다음 노드로 넘깁니다." },
        { at: "plan: ContextPlan = (plan_prompt | self.context_planner).invoke({\"question\": state[\"question\"]})", text: "단독 실행이면 LLM이 검색 키워드(law_query)와 법령명(law_name)을 뽑습니다." },
        { at: "law_query, law_name = state[\"question\"], \"\"", text: "계획 단계가 실패하면 질문 자체를 검색어로 쓰는 안전한 폴백입니다." },
        { at: "items = run_gather_context(law_query, law_name)", text: "korean-law MCP로 판례·해석례·법령을 실제로 수집합니다." },
        { at: "items = []", text: "수집이 실패해도 멈추지 않고 빈 자료로 진행합니다(뒤의 IsSup가 근거 부족을 잡음)." },
        { at: 'return {"context_items": items}', text: "모은 자료를 상태에 채워 초안 작성 노드로 넘깁니다." },
      ],
      code: `    # ===== 노드 1: gather_context =====
    def gather_context(self, state: AgentState) -> dict:
        """컨텍스트 확보: 오케스트레이터 주입분(provided_context) 우선, 없으면 MCP로 자체 수집."""
        provided = state.get("provided_context") or []
        if provided:
            print(f"\\n[gather_context] 오케스트레이터 주입 컨텍스트 사용: {len(provided)}개 항목")
            return {"context_items": provided}

        print("\\n[gather_context] 단독 실행 → korean-law MCP 로 컨텍스트 수집(A·B 프록시)")
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
        return {"context_items": items}`,
    },
    {
      id: "write_draft",
      name: "write_draft() (노드 2)",
      fileId: "workflow",
      summary: "모은 자료를 근거로 LLM이 의견서 초안을 처음 쓰게 하는 노드",
      how: "확보한 자료를 하나의 컨텍스트로 합쳐 LLM에게 주고, 정해진 형식(사안 개요→쟁점→법령·판례→검토 의견→결론)으로 의견서 초안을 쓰게 합니다(최초 1회). 실제 생성은 공용 헬퍼 generate_draft가 맡고, 이 노드는 자료·대화 맥락을 준비해 넘기는 역할입니다. 결과 초안은 상태(draft)에 담겨 다음 검증 게이트로 흘러갑니다.",
      terms: ["노드(node)", "LLM", "프롬프트(prompt)", "멀티턴(multi-turn)"],
      lines: [
        { at: "context_text = build_context_text(state[\"context_items\"])", text: "모은 자료들을 초안 작성용 단일 컨텍스트 문자열로 합칩니다." },
        { at: "draft = generate_draft(self.llm, state[\"question\"], context_text,", text: "공용 생성 헬퍼에 질문·자료·대화 맥락을 넘겨 초안을 만듭니다." },
        { at: "format_history(state.get(\"history\", []))", text: "이전 대화 맥락을 프롬프트용 텍스트로 변환해 함께 넘깁니다(멀티턴)." },
        { at: 'return {"draft": draft}', text: "생성된 초안을 상태에 담아 근거성 평가(다음 노드)로 넘깁니다." },
      ],
      code: `    # ===== 노드 2: write_draft =====
    def write_draft(self, state: AgentState) -> dict:
        """검색 컨텍스트를 종합해 의견서 초안을 생성함 (최초 1회)."""
        print("\\n[write_draft] 의견서 초안 작성 중...")
        context_text = build_context_text(state["context_items"])
        draft = generate_draft(self.llm, state["question"], context_text,
                               format_history(state.get("history", [])))
        print(f"  → 초안 {len(draft)}자 생성")
        return {"draft": draft}`,
    },
    {
      id: "rewrite_draft",
      name: "rewrite_draft() (노드 5)",
      fileId: "workflow",
      summary: "게이트 미통과·사람 반려 시 문제점을 알려 주며 더 엄격한 근거 기반으로 다시 쓰게 하는 노드",
      how: "검증을 통과하지 못했거나 사람이 반려한 초안을 고쳐 쓰는 노드입니다. 무엇이 문제였는지(근거 부족·환각 인용·검토자 반려 의견)를 모두 모아 '엄격 재작성 지시'로 LLM에 전달합니다. 재작성 횟수(retry_count)를 1 늘려 무한 루프를 막고, 다음 라운드에서 다시 승인받도록 사람 승인 플래그(approved)를 초기화합니다.",
      terms: ["노드(node)", "재작성(rewrite)", "IsSup", "MAX_REWRITES", "프롬프트(prompt)"],
      lines: [
        { at: "retry = state.get(\"retry_count\", 0) + 1", text: "재작성 횟수를 1 늘립니다 — 한도(MAX_REWRITES)를 넘으면 사람에게 승급됩니다." },
        { at: "if not bool(state.get(\"is_supported\", True)):", text: "근거성이 부족했으면 그 사유를 재작성 지시에 담습니다." },
        { at: "if state.get(\"citation_issue\"):", text: "환각 인용 문제가 있었으면 그 내용을 재작성 지시에 담습니다." },
        { at: "if state.get(\"approved\") is False and state.get(\"review_feedback\"):", text: "사람이 반려했으면 그 피드백도 재작성 지시에 담습니다." },
        { at: "draft = generate_draft(self.llm, state[\"question\"], context_text,", text: "문제점(gate_issue)을 붙여 더 엄격한 규칙으로 초안을 다시 만듭니다." },
        { at: 'return {"draft": draft, "retry_count": retry, "rewrites": rewrites,', text: "새 초안·늘어난 재작성 횟수·이력을 기록하고, 승인 플래그는 초기화합니다." },
      ],
      code: `    # ===== 노드 5: rewrite_draft =====
    def rewrite_draft(self, state: AgentState) -> dict:
        """근거 미달·인용 환각·사람 반려 시 엄격 근거 기반으로 초안을 재작성함."""
        retry = state.get("retry_count", 0) + 1
        print(f"\\n[rewrite_draft] 재작성 #{retry} (사유 반영)...")
        # 게이트 이슈(근거성·인용)와 사람 반려 피드백을 모두 모아 엄격 재작성 지시로 전달
        issues = []
        if not bool(state.get("is_supported", True)):
            issues.append(f"- 근거성 부족: {state.get('support_reasoning', '')}")
        if state.get("citation_issue"):
            issues.append(f"- 인용 문제: {state['citation_issue']}")
        if state.get("approved") is False and state.get("review_feedback"):
            issues.append(f"- 검토자 반려 의견: {state['review_feedback']}")
        gate_issue = "\\n".join(issues) if issues else "- 근거성과 인용 정확성을 다시 점검하세요."

        context_text = build_context_text(state["context_items"])
        draft = generate_draft(self.llm, state["question"], context_text,
                               format_history(state.get("history", [])), gate_issue=gate_issue)
        print(f"  → 재작성 초안 {len(draft)}자")
        rewrites = list(state.get("rewrites", [])) + [{"reason": gate_issue}]
        # 재작성 후 사람 반려 플래그는 초기화(다음 라운드에서 다시 승인 받도록)
        return {"draft": draft, "retry_count": retry, "rewrites": rewrites,
                "approved": None, "review_feedback": ""}`,
    },
    {
      id: "escalate",
      name: "escalate() (노드 6)",
      fileId: "workflow",
      summary: "재시도 소진·검증 불가로 AI가 스스로 못 고치는 상황을 사람에게 올리는 승급 노드 (fail-safe)",
      how: "AI가 더 이상 자동으로 해결할 수 없는 상황(재작성 한도 소진, 또는 인용 검증 서버 응답 불가)을 사람에게 넘기는 노드입니다. 하는 일은 단순히 'escalated=True' 표시를 남기는 것뿐이지만, 이 표시는 최종 출력에 '자동 검증 미통과로 사람에게 올림' 경고를 붙이는 근거가 됩니다. 검증 실패를 정상으로 흡수하지 않고 사람에게 올린다는 fail-safe 원칙의 핵심 노드입니다.",
      terms: ["노드(node)", "escalate(승급)", "fail-safe(실패 안전)", "HITL", "게이트(gate)"],
      lines: [
        { at: '[escalate] 게이트 미통과로 HITL 승급', text: "승급 사유(gate_reason)를 로그로 남깁니다." },
        { at: 'return {"escalated": True}', text: "'사람에게 승급함' 표시를 상태에 남깁니다 — 최종 출력에 경고로 반영됩니다." },
      ],
      code: `    # ===== 노드 6: escalate =====
    def escalate(self, state: AgentState) -> dict:
        """재시도 소진/verify 판정 불가 → HITL 승급 표시(전파 차단, 사람이 최종 판단)."""
        print(f"\\n[escalate] 게이트 미통과로 HITL 승급: {state.get('gate_reason', '')}")
        return {"escalated": True}`,
    },
    {
      id: "human_review",
      name: "human_review() (노드 7, interrupt 지점)",
      fileId: "workflow",
      summary: "확정 전 그래프가 멈추는 사람 승인 지점 — interrupt_before로 이 노드 '직전'에서 멈춤",
      how: "이 시스템의 가장 중요한 안전장치입니다. 그래프는 interrupt_before 설정 때문에 이 노드를 '실행하기 직전'에 멈춥니다. 앱이 사람의 승인/반려(+피드백)를 상태에 기록(update_state)하고 재개하면, 그제서야 이 노드가 실행되어 통과합니다. 노드 자체는 결과를 출력만 할 뿐 비어 있고(빈 dict 반환), 실제 멈춤·재개는 그래프 컴파일 설정(interrupt_before)과 앱의 run_with_hitl이 담당합니다.",
      terms: ["노드(node)", "HITL", "interrupt(인터럽트)", "State(상태)"],
      lines: [
        { at: "decision = state.get(\"approved\")", text: "앱이 기록해 둔 사람의 승인 결과(approved)를 읽습니다." },
        { at: "[human_review] 사람 승인 결과: approved={decision}", text: "사람 승인 결과를 로그로 확인합니다." },
        { at: "return {}", text: "노드 자체는 상태를 바꾸지 않습니다 — 멈춤·재개는 그래프 설정과 앱이 담당합니다." },
      ],
      code: `    # ===== 노드 7: human_review (interrupt 지점) =====
    def human_review(self, state: AgentState) -> dict:
        """확정 전 사람 승인 노드. interrupt_before 로 이 노드 실행 전 그래프가 멈춤.

        앱이 사람의 승인/반려(+피드백)를 update_state 로 기록한 뒤 재개하면 이 노드가 통과됨.
        승인 여부는 state['approved'] 로 전달됨(None=미지정 → 기본 승인 처리는 분기에서).
        """
        decision = state.get("approved")
        print(f"\\n[human_review] 사람 승인 결과: approved={decision}")
        return {}`,
    },
    {
      id: "finalize",
      name: "finalize() (노드 8, DLP)",
      fileId: "workflow",
      summary: "승인된 초안에서 개인정보를 가리고(DLP) 출처·경고·법적 고지를 붙여 최종본을 완성하는 노드",
      how: "외부로 내보내기 직전의 마지막 노드입니다. DLP 필터로 초안의 개인정보(PII)를 탐지(scan)·마스킹(mask)하고, 코드가 직접 만든 출처 섹션과 (승급·반려 시) 경고문, 그리고 법적 책임 고지문을 차례로 붙여 최종 출력을 조립합니다. 출처를 LLM이 아닌 코드가 실제 검색 결과로만 구성하므로, 본문에 끼어든 인용 환각이 출처 목록으로 새지 않습니다.",
      terms: ["노드(node)", "DLP", "PII(개인정보)", "마스킹(masking)", "escalate(승급)", "법적 책임 고지(disclaimer)"],
      lines: [
        { at: "findings = self.dlp.scan(draft)", text: "초안에서 개인정보가 무엇이 몇 건 들었는지 먼저 탐지합니다(감사용)." },
        { at: "masked = self.dlp.mask(draft)", text: "탐지된 개인정보를 '[유형_마스킹]'으로 실제로 가립니다." },
        { at: "sources_section = build_sources_section(state[\"context_items\"])", text: "출처 섹션을 코드가 실제 검색 결과로만 직접 구성합니다(환각 유입 차단)." },
        { at: "if state.get(\"escalated\"):", text: "검증 미통과로 승급된 경우 경고문을 덧붙입니다." },
        { at: "if state.get(\"approved\") is False:", text: "사람이 반려한 초안이면 '최종본 아님' 경고를 덧붙입니다." },
        { at: "parts.append(settings.LEGAL_DISCLAIMER)", text: "마지막에 'AI 참고용' 법적 책임 고지문을 붙입니다." },
        { at: 'return {"final_output": final_output, "dlp_findings": findings}', text: "마스킹·고지가 포함된 최종 의견서와 탐지 목록을 상태에 담습니다." },
      ],
      code: `    # ===== 노드 8: finalize (DLP) =====
    def finalize(self, state: AgentState) -> dict:
        """DLP 개인정보 마스킹 + 법적 책임 고지문 부착 → 최종 출력 구성."""
        print("\\n[finalize] DLP 마스킹 + 고지문 부착...")
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
        notes_section = "\\n".join(notes)

        parts = [masked]
        if sources_section:
            parts.append(sources_section)
        if notes_section:
            parts.append(notes_section)
        parts.append(settings.LEGAL_DISCLAIMER)
        final_output = "\\n\\n".join(parts)
        return {"final_output": final_output, "dlp_findings": findings}`,
    },
    {
      id: "decide_after_review",
      name: "decide_after_review()",
      fileId: "workflow",
      summary: "사람 승인 직후 갈림길 — 반려+재시도 여유면 재작성, 그 외엔 확정(DLP)으로 보내는 분기",
      how: "사람 승인 노드를 지난 뒤 다음 행선지를 정하는 조건부 엣지입니다. 사람이 반려했고(approved=False) 재작성 여유가 남았으면 재작성으로 돌려보냅니다. 반려했더라도 재시도를 다 썼으면 무한 루프를 막기 위해 반려 표시를 단 채 확정(finalize)으로 진행합니다. 승인했으면 그대로 확정으로 갑니다.",
      terms: ["조건부 엣지(conditional edge)", "분기(branch)", "재작성(rewrite)", "MAX_REWRITES", "HITL"],
      lines: [
        { at: "if state.get(\"approved\") is False:", text: "사람이 반려했는지 확인합니다." },
        { at: "if state.get(\"retry_count\", 0) < settings.MAX_REWRITES:", text: "재작성 여유가 남았으면 다시 쓰게 돌려보냅니다." },
        { at: 'return "rewrite"', text: "재작성 노드로 가라는 신호입니다." },
        { at: "반려되었으나 재시도 소진", text: "재시도를 다 썼으면 무한 루프를 막고 반려 표시와 함께 확정으로 진행합니다." },
        { at: 'return "finalize"', text: "승인됐거나 더 못 고치면 최종 확정(DLP) 노드로 보냅니다." },
      ],
      code: `    def decide_after_review(self, state: AgentState) -> Literal["finalize", "rewrite"]:
        """사람 승인 직후 분기: 반려+재시도 여유면 재작성, 그 외에는 확정(DLP)."""
        if state.get("approved") is False:
            if state.get("retry_count", 0) < settings.MAX_REWRITES:
                return "rewrite"
            print("  → 반려되었으나 재시도 소진 → 반려 표시와 함께 확정 단계로 진행")
        return "finalize"`,
    },
    {
      id: "initial_state",
      name: "initial_state()",
      fileId: "workflow",
      summary: "그래프 실행을 시작할 때 모든 상태 칸을 빈 기본값으로 채워 주는 초기화 함수",
      how: "그래프를 처음 돌릴 때 넣을 시작 상태(State)를 만듭니다. 질문·이전 대화·주입 자료(provided_context)만 받아 채우고, 나머지 칸(초안·게이트 신호·승인·DLP 결과 등)은 모두 빈 기본값(None·빈 문자열·빈 리스트·0)으로 둡니다. 오케스트레이터가 호출할 때는 provided_context에 MAS A·B의 검색 결과를 주입해 자체 수집을 생략시킵니다.",
      terms: ["State(상태)", "TypedDict", "fan-in(팬인)", "노드(node)"],
      lines: [
        { at: "def initial_state(question: str, history: Optional[list] = None,", text: "질문·이전 대화·주입 자료를 받아 시작 상태를 만듭니다." },
        { at: '"provided_context": provided_context or [],', text: "오케스트레이터가 주입한 검색 결과를 담는 칸(있으면 자체 수집 생략)." },
        { at: '"draft": "",', text: "초안은 아직 비어 있음 — write_draft 노드가 채웁니다." },
        { at: '"gate_passed": None, "gate_reason": "", "escalated": False,', text: "게이트·승급 신호는 아직 미결정(None/False)으로 시작합니다." },
        { at: '"retry_count": 0, "rewrites": [],', text: "재작성 횟수·이력을 0과 빈 목록으로 초기화합니다." },
        { at: '"approved": None, "review_feedback": "",', text: "사람 승인 결과도 아직 미결정(None)으로 둡니다." },
      ],
      code: `    # ===== 초기 상태 =====
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
        }`,
    },
    {
      id: "draft_builders",
      name: "generate_draft() · build_context_text() · build_sources_section()",
      fileId: "workflow",
      summary: "초안을 만드는 헬퍼 3종 — 자료를 컨텍스트로 합치고(build_context_text), 초안을 생성하고(generate_draft), 출처를 코드로 안전하게 구성(build_sources_section)",
      how: "write_draft·rewrite_draft 노드가 공유하는 보조 함수들입니다. build_context_text는 모은 자료를 소스별로 묶어 하나의 긴 컨텍스트 문자열로 합칩니다. generate_draft는 그 컨텍스트와 작성 지시문으로 LLM을 호출해 초안을 만들되, 재작성 시 gate_issue(문제점)가 있으면 엄격 규칙을 덧붙입니다. build_sources_section은 '출처' 섹션을 LLM이 아니라 코드가 실제 검색 결과(citation)로만 구성해, 본문에 끼어든 환각 인용이 출처로 새지 않게 합니다.",
      terms: ["LLM", "프롬프트(prompt)", "StrOutputParser(문자열 파서)", "인용 환각(hallucination)", "재작성(rewrite)"],
      lines: [
        { at: 'return "(검색 컨텍스트 없음)"', text: "build_context_text: 자료가 없으면 '컨텍스트 없음'을 돌려줍니다." },
        { at: "for source, group in grouped.items():", text: "build_context_text: 자료를 소스별(판례·해석례·법령)로 묶어 블록을 만듭니다." },
        { at: "if gate_issue:", text: "generate_draft: 재작성이면(문제점이 있으면) 엄격 규칙을 시스템 프롬프트에 덧붙입니다." },
        { at: "return (prompt | llm | StrOutputParser()).invoke({", text: "generate_draft: LLM을 호출해 초안 텍스트를 받습니다(자유 문장이라 문자열 파서 사용)." },
        { at: "for source, citations in grouped.items():", text: "build_sources_section: 출처를 소스별로 묶습니다." },
        { at: "unique = list(dict.fromkeys(citations))", text: "build_sources_section: 같은 출처 중복을 순서를 지키며 제거합니다." },
        { at: 'return "## 출처\\n" + "\\n\\n".join(blocks) if blocks else ""', text: "build_sources_section: 코드가 실제 검색 결과로만 '출처' 섹션을 구성합니다(환각 차단)." },
      ],
      code: `# (일부 발췌) graph/workflow.py — 초안 생성/컨텍스트/출처 빌더(노드가 공유)

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
            lines.append(f"[{source} {index}] {item.get('title', '')}\\n{content}")
        blocks.append("\\n\\n".join(lines))
    return "\\n\\n".join(blocks)


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
        blocks.append(f"**{source}**\\n" + "\\n".join(unique))
    return "## 출처\\n" + "\\n\\n".join(blocks) if blocks else ""


def generate_draft(llm: ChatGroq, question: str, context_text: str,
                   history_text: str, gate_issue: str = "") -> str:
    """검색 컨텍스트를 근거로 의견서 초안을 생성함 (gate_issue 가 있으면 엄격 재작성)."""
    system = prompts.DRAFT_SYSTEM_PROMPT
    if gate_issue:
        system = system + prompts.DRAFT_STRICT_RULE.replace("{gate_issue}", gate_issue)
    prompt = ChatPromptTemplate.from_messages([("system", system), ("human", "{question}")])
    return (prompt | llm | StrOutputParser()).invoke({
        "history": history_text, "context": context_text, "question": question,
    })`,
    },
    {
      id: "build_llm",
      name: "build_llm() · format_history()",
      fileId: "workflow",
      summary: "LLM 인스턴스를 만들고(build_llm), 이전 대화를 프롬프트용 텍스트로 바꾸는(format_history) 보조 함수",
      how: "build_llm은 작성·평가·재작성에 두루 쓸 Groq의 gpt-oss-120b를 만듭니다. 추론 과정을 숨기고(reasoning_format='hidden') 최종 텍스트만 받게 하고, temperature=0으로 같은 입력이면 같은 결과가 나오게(재현 가능) 합니다. format_history는 최근 몇 개의 대화 메시지만 잘라 '사용자/어시스턴트' 형식의 텍스트로 바꿔 프롬프트에 넣을 수 있게 합니다(멀티턴 맥락 제공).",
      terms: ["LLM", "재현성(determinism)", "reasoning_format(추론 형식)", "멀티턴(multi-turn)", "프롬프트(prompt)"],
      lines: [
        { at: "return ChatGroq(", text: "Groq LPU에서 도는 LLM 인스턴스를 만듭니다." },
        { at: "reasoning_format=settings.LLM_REASONING_FORMAT,", text: "추론 과정을 숨기고 최종 텍스트만 받게 합니다('hidden')." },
        { at: "max_retries=settings.LLM_MAX_RETRIES,", text: "일시 오류(429/503)에 지수 백오프로 자동 재시도합니다." },
        { at: "if not history:", text: "format_history: 이전 대화가 없으면 '없음' 안내를 돌려줍니다." },
        { at: "recent = history[-settings.HISTORY_TURNS:]", text: "format_history: 최근 N개 메시지만 잘라 프롬프트가 너무 길어지지 않게 합니다." },
        { at: 'speaker = "사용자" if message["role"] == "user" else "어시스턴트"', text: "format_history: 각 메시지를 '사용자/어시스턴트'로 표시해 맥락을 명확히 합니다." },
      ],
      code: `# (일부 발췌) graph/workflow.py — LLM 생성 + 대화 맥락 변환

def build_llm() -> ChatGroq:
    """Groq LPU의 gpt-oss-120b 인스턴스를 생성함 (작성·평가·재작성 공용, 런타임 전용)."""
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
    return "\\n".join(lines)`,
    },

    // ───────────────────────── graph/state.py ─────────────────────────
    {
      id: "agentstate",
      name: "AgentState (상태 스키마)",
      fileId: "state",
      summary: "그래프 노드들이 공유·갱신하는 상태 데이터의 형태 — 게이트 신호·승인·DLP 결과를 담는 묶음",
      how: "워크플로우 전체에서 노드 사이로 흐르는 '공용 데이터 묶음'의 형태를 정의합니다(TypedDict). 각 노드는 이 중 일부 키만 채워 반환하면 LangGraph가 기존 상태에 자동 병합합니다. 근거성(is_supported)·인용 검증(citation_report)·게이트 종합(gate_passed)·사람 승인(approved)·DLP 결과(dlp_findings) 같은 핵심 신호가 여기 모여 노드 간에 전달됩니다. SupportGrade는 IsSup 평가용 구조화 출력 스키마입니다.",
      terms: ["State(상태)", "TypedDict", "with_structured_output(구조화 출력)", "IsSup", "게이트(gate)"],
      lines: [
        { at: "class SupportGrade(BaseModel):", text: "IsSup 평가 결과를 담는 구조화 출력 스키마(LLM이 이 형태로만 답하게 강제)." },
        { at: "is_supported: bool = Field(", text: "초안이 자료에 근거하는지 여부(True/False)." },
        { at: "class AgentState(TypedDict):", text: "그래프 전체가 공유하는 상태 데이터의 형태를 선언합니다." },
        { at: "draft: str", text: "현재 의견서 초안 본문(재작성하면 갱신됨)." },
        { at: "is_supported: Optional[bool]", text: "검증 게이트 1(근거성) 결과를 담는 칸." },
        { at: "citation_report: dict", text: "검증 게이트 2(인용 검증) 결과 보고서를 담는 칸." },
        { at: "gate_passed: Optional[bool]", text: "두 게이트를 종합한 통과 여부(근거 있음 그리고 인용 정상)." },
        { at: "approved: Optional[bool]", text: "사람(HITL) 승인 결과 — None은 미결정, False는 반려." },
        { at: "dlp_findings: list", text: "DLP가 가린 개인정보 목록을 담는 칸." },
      ],
      code: `# (일부 발췌) graph/state.py — 구조화 출력 + 그래프 상태 스키마

class SupportGrade(BaseModel):
    """[IsSup] 근거성 평가: 초안이 검색 컨텍스트에 근거하는지(환각이 없는지) 검증."""

    is_supported: bool = Field(
        description="생성된 의견서 초안의 핵심 주장이 제공된 검색 컨텍스트로 뒷받침되는지 여부"
    )
    reasoning: str = Field(description="근거성 판단 이유 (한국어 한 문장)")


class AgentState(TypedDict):
    """그래프 전체에서 노드 사이로 공유·갱신되는 상태 데이터."""

    # === 입력 ===
    question: str               # 사용자의 의견서 작성 요청
    history: list               # 이전 대화 맥락 (멀티턴, 선택)
    provided_context: list      # 오케스트레이터가 주입하는 검색 결과(있으면 자체 수집 생략)

    # === 컨텍스트 / 초안 ===
    context_items: list         # 종합된 검색 컨텍스트 [{source, title, content, citation}]
    draft: str                  # 현재 의견서 초안 본문 (재작성 시 갱신됨)

    # === 게이트 1: 근거성 [IsSup] ===
    is_supported: Optional[bool]   # 초안이 컨텍스트에 근거하는지
    support_reasoning: str         # 근거성 판단 근거

    # === 게이트 2: 인용 환각 탐지 (verify_citations) ===
    citation_report: dict          # law_client가 코드 파싱한 검증 결과
    citations_ok: Optional[bool]   # 인용 환각이 없는지 (✗ 오류 0건이면 True)
    citation_issue: str            # 인용 문제 요약 (재작성 프롬프트에 전달)

    # === 게이트 종합 / 재작성 루프 ===
    gate_passed: Optional[bool]    # IsSup True 그리고 citations_ok True
    gate_reason: str               # 게이트 통과/실패 사유 요약
    escalated: bool                # 게이트 미달 + 재시도 소진 → HITL 승급 여부
    retry_count: int               # 현재까지 재작성 횟수

    # === HITL (사람 승인) / DLP ===
    approved: Optional[bool]       # 사람 승인 결과 (None=미결정 / False=반려)
    review_feedback: str           # 반려 시 사람이 남긴 피드백
    dlp_findings: list             # 마스킹된 개인정보 탐지 결과
    final_output: str              # DLP 마스킹·고지문이 포함된 최종 의견서`,
    },

    {
      id: "context_plan",
      name: "ContextPlan (검색 계획 스키마)",
      fileId: "state",
      summary: "단독 실행 시 '무엇을 검색할지'(키워드·법령명)를 LLM이 정해진 형태로 뽑게 하는 구조화 출력 스키마",
      how: "오케스트레이터가 자료를 안 줬을 때만 쓰이는 스키마입니다. gather_context 노드에서 LLM이 사용자 질문을 보고 '판례·해석례 검색 키워드(law_query)'와 '법령명(law_name, 없으면 빈 문자열)'을 뽑는데, 그 결과를 자유 문장이 아니라 이 두 필드 형태로만 답하게 강제(with_structured_output)해 안정적으로 파싱합니다. 오케스트레이터가 MAS A·B 결과를 주입하면 이 계획 단계는 통째로 건너뜁니다.",
      terms: ["with_structured_output(구조화 출력)", "LLM", "노드(node)", "fan-in(팬인)"],
      lines: [
        { at: "class ContextPlan(BaseModel):", text: "검색 계획을 담는 구조화 출력 스키마(LLM이 이 형태로만 답하게 강제)." },
        { at: "law_query: str = Field(description=\"판례·해석례 검색용 핵심 법률 키워드", text: "판례·해석례를 찾을 핵심 검색 키워드를 담는 칸." },
        { at: "law_name: str = Field(", text: "질문에 드러난 특정 법령명(없으면 빈 문자열)을 담는 칸." },
      ],
      code: `# (일부 발췌) graph/state.py — 단독 실행 시 컨텍스트 수집 계획 스키마

class ContextPlan(BaseModel):
    """단독 실행(provided_context 미주입) 시 컨텍스트 수집 계획.

    오케스트레이터가 MAS A·B 결과를 주입하면 이 단계는 건너뜀. 단독 데모/테스트에서만
    korean-law MCP를 A·B 프록시로 호출하기 위해 검색 키워드·법령명을 LLM이 추출함.
    """

    law_query: str = Field(description="판례·해석례 검색용 핵심 법률 키워드 (예: '직무발명 보상금')")
    law_name: str = Field(
        description="질문에 특정 법령명이 명시되면 그 이름(예: '특허법'). 없으면 빈 문자열"
    )`,
    },

    // ───────────────────────── graph/prompts.py ─────────────────────────
    {
      id: "draft_prompt",
      name: "DRAFT_SYSTEM_PROMPT (작성 지시문)",
      fileId: "prompts",
      summary: "의견서를 정해진 형식으로 쓰게 하고 '자료에 없는 조문은 지어내지 말라'는 인용 규칙을 강제하는 LLM 지시문",
      how: "LLM에게 의견서를 어떻게 쓸지 알려 주는 시스템 프롬프트입니다. 의견서 형식(사안 개요→쟁점→관련 법령·판례→검토 의견→결론)을 정하고, 가장 중요하게 '검색 자료에 실제로 나온 조문만 인용하고 번호를 추측해 만들지 말라'는 인용 규칙을 줍니다. 이 규칙은 두 가지 효과가 있습니다: (1) AI 환각을 처음부터 줄이고, (2) 인용을 '법령명+제N조' 형식으로 표기하게 해 뒤의 verify_citations가 검증할 수 있게 합니다.",
      terms: ["프롬프트(prompt)", "시스템 프롬프트", "인용 환각(hallucination)", "verify_citations"],
      lines: [
        { at: "DRAFT_SYSTEM_PROMPT =", text: "초안 작성용 시스템 프롬프트(LLM 지시문)를 정의합니다." },
        { at: "## 작성 형식 (마크다운)", text: "의견서를 정해진 5개 섹션 형식으로 쓰게 합니다." },
        { at: "## 인용 규칙 (매우 중요)", text: "환각을 막는 핵심 규칙 묶음입니다." },
        { at: "「법령명 + 제N조」 형식으로 표기합니다", text: "인용을 '특허법 제29조' 형식으로 적게 해 뒤의 검증 도구가 파싱하도록 만듭니다." },
        { at: "컨텍스트에 없는 조문 번호를 추측해서 만들지 마세요", text: "자료에 없는 조문 번호를 지어내지 못하게 하는 환각 방지 규칙입니다." },
        { at: "{context}", text: "실제 검색 자료가 이 자리에 채워져 초안 작성의 근거가 됩니다." },
      ],
      code: `# (일부 발췌) graph/prompts.py — 초안 작성 시스템 프롬프트

DRAFT_SYSTEM_PROMPT = """당신은 특허 전문 변리사를 보조하는 의견서 작성 AI입니다.

## 역할
- 아래 '검색 컨텍스트'(특허법 조문·판례·해석례)와 이전 대화 맥락을 종합하여 특허 의견서 초안을 작성합니다.
- 의견서는 실무 변리사가 검토·확정하기 위한 '초안'이며, 법적 효력이 있는 최종 자문이 아닙니다.

## 작성 형식 (마크다운)
1. **사안 개요**: 질문/요청을 1~2문장으로 정리
2. **쟁점**: 핵심 법적 쟁점을 항목으로 정리
3. **관련 법령·판례**: 컨텍스트에 근거한 조문·판례를 인용하며 검토
4. **검토 의견**: 쟁점별 분석과 실무적 판단
5. **결론**: 권고 사항 요약

## 인용 규칙 (매우 중요)
- 법령 조문은 반드시 '특허법 제29조', '발명진흥법 제15조' 처럼 「법령명 + 제N조」 형식으로 표기합니다.
- 컨텍스트에 실제로 등장하는 조문·판례만 인용합니다. 컨텍스트에 없는 조문 번호를 추측해서 만들지 마세요.
- 조문 번호가 불확실하면 번호를 지어내지 말고 '관련 규정' 으로 서술하거나 컨텍스트의 표현을 그대로 따릅니다.
- 확인되지 않은 사실은 '확인되지 않음'으로 명시합니다.

## 이전 대화 맥락
{history}

## 검색 컨텍스트
{context}"""`,
    },

    // ───────────────────────── sources/law_mcp.py ─────────────────────────
    {
      id: "parse_verify_result",
      name: "parse_verify_result()",
      fileId: "lawmcp",
      summary: "인용 검증 서버가 돌려준 '사람이 읽는 텍스트' 응답을 파싱해 환각 인용 개수·통과 여부로 바꾸는 함수",
      how: "korean-law MCP는 JSON이 아니라 '총 N건 | ✓ 실존 | ✗ 오류 | ⚠ 확인필요' 같은 사람이 읽는 텍스트를 줍니다. 이 함수가 정규식으로 그 요약을 읽어 숫자로 바꿉니다. 인용이 아예 없으면(검증 대상 없음) 통과로 처리하고, 요약을 못 찾으면(해석 불가) ok=None(판정 보류)으로 둬 게이트가 함부로 통과시키지 않게 합니다. ✗(미존재) 0건일 때만 ok=True입니다(⚠는 막지 않음).",
      terms: ["파싱(parsing)", "정규식(regex)", "인용 환각(hallucination)", "fail-safe(실패 안전)", "MCP"],
      lines: [
        { at: 'report = {"parsed": False,', text: "기본값은 '아직 신뢰할 판정 없음'(parsed=False, ok=None)으로 둡니다." },
        { at: 'if "[NO_CITATIONS_FOUND]" in text:', text: "초안에 인용이 하나도 없으면 검증할 게 없으므로 통과(ok=True)로 둡니다." },
        { at: "summary = _VERIFY_SUMMARY.search(text)", text: "'총 N건 ✓ ✗ ⚠' 요약 줄을 정규식으로 찾습니다." },
        { at: "if not summary:", text: "요약을 못 찾으면 신뢰성 있게 해석 불가 → 판정 보류(fail-safe)로 그대로 둡니다." },
        { at: "total, exist, errors, warns = (int(summary.group(i))", text: "요약에서 총·실존·오류·확인필요 건수를 숫자로 뽑습니다." },
        { at: 'if s.startswith("✗"):', text: "✗로 시작하는 줄(미존재 = 환각 인용)을 따로 모읍니다." },
        { at: '"ok": errors == 0,', text: "핵심 판정: 환각 인용(✗)이 0건이면 통과(ok=True)입니다." },
      ],
      code: `# (일부 발췌) sources/law_mcp.py — verify_citations 응답 파서

def parse_verify_result(text: str) -> dict:
    """verify_citations 응답 텍스트를 파싱함.

    Returns: {parsed, total, exist, errors, warns, hallucinated[], warnings[], ok}
      - parsed : 응답을 신뢰성 있게 해석했는지 (False면 판정 불가 → 호출자가 fail-safe 처리)
      - ok     : 환각 인용(✗)이 0건이면 True (⚠ 는 차단하지 않음)
    """
    report = {"parsed": False, "total": 0, "exist": 0, "errors": 0, "warns": 0,
              "hallucinated": [], "warnings": [], "ok": None, "text": text}

    # 인용이 전혀 없는 경우: 검증할 대상이 없으므로 통과(환각 없음)
    if "[NO_CITATIONS_FOUND]" in text:
        report.update({"parsed": True, "total": 0, "ok": True})
        return report

    summary = _VERIFY_SUMMARY.search(text)
    if not summary:
        # 요약을 못 찾으면 신뢰성 있게 해석 불가 → 판정 보류(fail-safe)
        return report

    total, exist, errors, warns = (int(summary.group(i)) for i in range(1, 5))
    # 항목별 라인 수집: ✗(환각) / ⚠(부분매칭).
    hallucinated, warnings = [], []
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("✗"):
            hallucinated.append(s.lstrip("✗ ").strip())
        elif s.startswith("⚠") and "[HALLUCINATION_DETECTED]" not in s:
            warnings.append(s.lstrip("⚠️ ").strip())

    report.update({
        "parsed": True, "total": total, "exist": exist, "errors": errors, "warns": warns,
        "hallucinated": hallucinated, "warnings": warnings,
        "ok": errors == 0,   # ✗(NOT_FOUND) 0건이면 환각 없음 → 통과
    })
    return report`,
    },
    {
      id: "verify_citations_async",
      name: "verify_citations() (MCP 호출)",
      fileId: "lawmcp",
      summary: "초안의 조문 인용을 MCP로 교차검증하되, 실패를 절대 '정상'으로 흡수하지 않는 fail-safe 호출 함수",
      how: "초안 텍스트를 korean-law MCP의 verify_citations 도구에 보내 실제 법령 DB와 대조합니다. 가장 중요한 설계는 fail-safe입니다: 서버 도달 실패·타임아웃·응답 파싱 불가 같은 어떤 실패든 '인용 정상'으로 흡수하지 않고 {reachable:False, ok:None}로 보고합니다. 게이트는 ok가 True일 때만 통과시키므로, '판정 없음'은 통과하지 못하고 사람(HITL)에게 승급됩니다. 즉 막히면 막지 말고 사람에게 넘기는 안전 설계입니다.",
      terms: ["verify_citations", "fail-safe(실패 안전)", "MCP", "ClientSession", "타임아웃(timeout)", "비동기(async)"],
      lines: [
        { at: 'fallback = {"reachable": False, "ok": None,', text: "실패 시 돌려줄 기본값: 도달 못함·판정 없음(ok=None) — 절대 통과로 흡수하지 않음." },
        { at: "url = settings.build_law_mcp_url()", text: "법제처 인증키를 붙인 MCP 접속 URL을 만듭니다." },
        { at: 'result = await asyncio.wait_for(', text: "정해진 시간 안에 응답이 오도록 타임아웃을 걸고 검증 도구를 호출합니다." },
        { at: 'session.call_tool("verify_citations",', text: "초안 텍스트를 verify_citations 도구로 보내 실제 조문 존재를 대조시킵니다." },
        { at: 'if not report["parsed"]:', text: "응답은 받았으나 해석 불가면 판정 보류(fallback)로 처리합니다." },
        { at: 'report["reachable"] = True', text: "정상적으로 판정했으면 '도달함'으로 표시해 게이트가 결과를 신뢰하게 합니다." },
        { at: "except Exception as error:  # noqa: BLE001 - 연결/타임아웃", text: "어떤 실패든 잡아 '판정 없음'으로 보고합니다(실패를 정상으로 흡수 금지)." },
      ],
      code: `# (일부 발췌) sources/law_mcp.py — fail-safe 인용 검증 호출

async def verify_citations(text: str) -> dict:
    """초안 텍스트의 '법령 조문' 인용을 korean-law MCP verify_citations 로 교차검증함.

    [fail-safe — 절대 실패를 '정상'으로 흡수하지 않음]
      - 정상 판정 : {reachable:True, ok:True/False, ...report}
      - 서비스 도달 실패/타임아웃/응답 파싱 불가 : {reachable:False, ok:None, note:...}
        → 게이트는 ok is True 일 때만 통과시키므로, 판정 없음은 통과하지 못하고 HITL 로 승급됨.
    """
    fallback = {"reachable": False, "ok": None, "total": 0, "exist": 0, "errors": 0, "warns": 0,
                "hallucinated": [], "warnings": [], "text": "", "note": ""}
    try:
        url = settings.build_law_mcp_url()
        async with streamablehttp_client(url) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await asyncio.wait_for(
                    session.call_tool("verify_citations",
                                      {"text": text, "maxCitations": settings.VERIFY_MAX_CITATIONS}),
                    timeout=settings.LAW_MCP_TIMEOUT_SECONDS,
                )
        report = parse_verify_result(_text_of(result))
        if not report["parsed"]:
            # 응답은 받았으나 해석 불가 → 신뢰할 판정이 없음(fail-safe로 미통과 처리)
            fallback["note"] = "verify 응답을 파싱하지 못함(판정 보류)"
            return fallback
        report["reachable"] = True
        return report
    except Exception as error:  # noqa: BLE001 - 연결/타임아웃 등 어떤 실패든 '판정 없음'으로 보고
        fallback["note"] = f"verify 호출 실패(판정 보류): {type(error).__name__}"
        return fallback`,
    },

    {
      id: "gather_law_context",
      name: "gather_law_context() · run_gather_context()",
      fileId: "lawmcp",
      summary: "단독 실행 시 korean-law MCP 한 세션으로 판례·해석례·법령을 모아 컨텍스트로 만드는 수집 함수",
      how: "오케스트레이터가 자료를 안 줬을 때, 이 함수가 korean-law MCP에 직접 접속해 (1) 판례, (2) 해석례, (3) (법령명이 드러나면) 최신 법령 조문을 모읍니다. 한 번의 세션 안에서 여러 도구를 차례로 호출합니다. 핵심은 출처(citation)를 코드가 직접 만든다는 점입니다 — 본문은 LLM이 쓰지만 출처 한 줄은 실제 검색 결과로 구성해 인용 환각을 막습니다. run_gather_context는 동기 노드에서 이 비동기 함수를 돌리는 다리(asyncio.run)입니다.",
      terms: ["MCP", "ClientSession", "비동기(async)", "동기 래퍼(sync wrapper)", "인용 환각(hallucination)", "graceful(우아한 실패)"],
      lines: [
        { at: "async with ClientSession(read, write) as session:", text: "MCP 서버와 연결을 맺고 도구를 호출할 세션을 엽니다." },
        { at: '"domain": "precedent", "query": law_query,', text: "먼저 '판례'를 검색합니다." },
        { at: '"domain": "interpretation", "query": law_query,', text: "다음으로 '해석례'를 검색합니다." },
        { at: 'items.append({"source": "판례", "title": prec["title"],', text: "판례 결과를 컨텍스트 항목으로 담습니다(출처는 코드가 구성)." },
        { at: 'items.append({"source": "해석례", "title": interp["title"],', text: "해석례 결과를 컨텍스트 항목으로 담습니다." },
        { at: "if law_name:", text: "질문에 특정 법령명이 드러난 경우에만 최신 조문을 추가로 가져옵니다." },
        { at: '"source": "법령", "title": laws[0]["name"],', text: "법령 조문 본문을 컨텍스트 항목으로 담습니다." },
        { at: "return asyncio.run(gather_law_context(law_query, law_name))", text: "동기 래퍼: 동기 노드에서 비동기 수집을 실행하는 다리입니다." },
      ],
      code: `# (일부 발췌) sources/law_mcp.py — 단독 실행 시 컨텍스트 수집(A·B 프록시)

async def gather_law_context(law_query: str, law_name: str = "") -> list[dict]:
    """korean-law MCP 한 세션으로 판례·해석례·(최신 법령 조문)을 수집해 컨텍스트 항목으로 반환함.

    Returns: [{source, title, content, citation}]
      - content : 초안 작성용 본문(LLM 컨텍스트)
      - citation: 코드에서 직접 구성한 출처 한 줄(인용 환각 방지)
    """
    url = settings.build_law_mcp_url()
    items: list[dict] = []

    async with streamablehttp_client(url) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # 1) 판례
            prec_text = await _call_tool_graceful(session, "search_decisions", {
                "domain": "precedent", "query": law_query, "display": settings.LAW_SEARCH_DISPLAY,
            })
            for prec in parse_decisions(prec_text, "판례"):
                citation = (f"- [{prec['title']}]({prec['url']}) "
                            f"(사건번호 {prec['case_number'] or 'N/A'}, 선고일 {prec['date'] or 'N/A'})"
                            if prec["url"] else f"- {prec['summary']}")
                items.append({"source": "판례", "title": prec["title"],
                              "content": prec["summary"], "citation": citation})

            # 2) 해석례
            interp_text = await _call_tool_graceful(session, "search_decisions", {
                "domain": "interpretation", "query": law_query, "display": settings.LAW_SEARCH_DISPLAY,
            })
            for interp in parse_decisions(interp_text, "해석례"):
                citation = (f"- [{interp['title']}]({interp['url']}) (회신일 {interp['date'] or 'N/A'})"
                            if interp["url"] else f"- {interp['title']} (회신일 {interp['date'] or 'N/A'})")
                items.append({"source": "해석례", "title": interp["title"],
                              "content": interp["summary"], "citation": citation})

            # 3) 최신 법령 조문 — 특정 법령명이 드러난 경우만 search_law → get_law_text
            if law_name:
                laws = parse_laws(await _call_tool_graceful(session, "search_law", {
                    "query": law_name, "display": 5,
                }))
                if laws and laws[0]["mst"]:
                    law_text = await _call_tool_graceful(session, "get_law_text", {"mst": laws[0]["mst"]})
                    if law_text:
                        items.append({
                            "source": "법령", "title": laws[0]["name"],
                            "content": law_text[:settings.LAW_TEXT_MAX_CHARS],
                            "citation": f"- {laws[0]['name']} (최신 조문, 출처: 법제처 국가법령정보센터)",
                        })

    return items


def run_gather_context(law_query: str, law_name: str = "") -> list[dict]:
    """동기 래퍼: 동기 LangGraph 노드에서 비동기 컨텍스트 수집을 실행함(asyncio.run 브리지)."""
    return asyncio.run(gather_law_context(law_query, law_name))`,
    },
    {
      id: "parse_law_results",
      name: "parse_decisions() · parse_laws()",
      fileId: "lawmcp",
      summary: "korean-law MCP가 돌려준 '사람이 읽는 텍스트' 검색 결과를 구조화된 목록으로 바꾸는 파서",
      how: "korean-law MCP는 JSON이 아니라 사람이 읽는 줄글 텍스트를 줍니다. parse_decisions는 판례·해석례 결과에서 머리글('[607079] 제목')과 '키: 값' 메타데이터를 정규식으로 읽어 제목·사건번호·날짜·링크 목록으로 만듭니다. parse_laws는 법령 검색 결과에서 법령명과 '- 법령ID: ...' 같은 메타를 읽어 목록으로 만듭니다. 둘 다 장식 라인(💡📍 등)은 건너뛰고, 메타 줄을 머리글보다 먼저 검사해 혼동을 막습니다.",
      terms: ["파싱(parsing)", "정규식(regex)", "MCP", "메타데이터(metadata)"],
      lines: [
        { at: "def parse_decisions(text: str, source_label: str) -> list[dict]:", text: "판례·해석례 검색 결과 텍스트를 구조화 목록으로 바꿉니다." },
        { at: "header = _ITEM_HEADER.match(stripped)", text: "'[번호] 제목' 머리글을 만나면 새 항목을 시작합니다." },
        { at: "for item in items:", text: "parse_decisions: 모은 항목들의 날짜·링크를 정리해 표준 형태로 만듭니다." },
        { at: 'date = (fields.get("선고일") or fields.get("회신일자") or fields.get("의결일")', text: "여러 날짜 필드명 중 먼저 있는 값을 날짜로 채택합니다." },
        { at: "def parse_laws(text: str) -> list[dict]:", text: "법령 검색(search_law) 결과 텍스트를 구조화 목록으로 바꿉니다." },
        { at: "field = _LAW_FIELD.match(line)  # '- 키: 값' 을 머리글보다 먼저 검사(혼동 방지)", text: "'- 키: 값' 메타 줄을 머리글보다 먼저 검사해 혼동을 막습니다." },
        { at: "for law in laws:", text: "parse_laws: 모은 법령들의 법령ID·MST·공포일을 표준 형태로 정리합니다." },
      ],
      code: `# (일부 발췌) sources/law_mcp.py — 검색 결과 텍스트 파서

def parse_decisions(text: str, source_label: str) -> list[dict]:
    """판례/해석례 검색 결과 텍스트를 [{title, source, case_number, date, url, summary}] 로 파싱함."""
    items: list[dict] = []
    current: dict | None = None
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith(_SKIP_PREFIXES):
            continue
        header = _ITEM_HEADER.match(stripped)
        if header:
            if current:
                items.append(current)
            current = {"id": header.group(1), "title": header.group(2).strip(),
                       "source": source_label, "fields": {}}
            continue
        if current is not None:
            field = _FIELD_LINE.match(line)
            if field:
                current["fields"][field.group(1).strip()] = field.group(2).strip()
    if current:
        items.append(current)

    normalized = []
    for item in items:
        fields = item["fields"]
        date = (fields.get("선고일") or fields.get("회신일자") or fields.get("의결일")
                or fields.get("결정일") or "")
        link = fields.get("링크", "")
        normalized.append({
            "id": item["id"], "title": item["title"], "source": item["source"],
            "case_number": fields.get("사건번호", "") or fields.get("안건번호", ""),
            "date": date,
            "url": _absolute_url(link) if link else "",
            "summary": f"{item['title']} (사건번호 {fields.get('사건번호', 'N/A')}, 선고/회신일 {date or 'N/A'})",
        })
    return normalized


def parse_laws(text: str) -> list[dict]:
    """법령 검색(search_law) 결과 텍스트를 [{name, law_id, mst, date, category}] 로 파싱함."""
    laws: list[dict] = []
    current: dict | None = None
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith(_SKIP_PREFIXES):
            continue
        field = _LAW_FIELD.match(line)  # '- 키: 값' 을 머리글보다 먼저 검사(혼동 방지)
        if field and current is not None:
            current["fields"][field.group(1).strip()] = field.group(2).strip()
            continue
        header = _LAW_HEADER.match(line)
        if header:
            if current:
                laws.append(current)
            current = {"name": header.group(1).strip(), "fields": {}}
    if current:
        laws.append(current)

    normalized = []
    for law in laws:
        fields = law["fields"]
        normalized.append({
            "name": law["name"], "law_id": fields.get("법령ID", ""),
            "mst": fields.get("MST", ""), "date": fields.get("공포일", ""),
            "category": fields.get("구분", ""),
        })
    return normalized`,
    },

    // ───────────────────────── harness/dlp.py ─────────────────────────
    {
      id: "dlp_filter",
      name: "DLPFilter.scan() · mask()",
      fileId: "dlp",
      summary: "주민번호·전화·이메일·카드번호 같은 개인정보를 정규식으로 탐지(scan)하고 가리는(mask) 출력 필터",
      how: "마지막 안전장치인 DLP(Data Loss Prevention) 필터입니다. 한국에서 흔한 개인정보(PII) 패턴을 정규식으로 정의해 두고, scan()으로 '무엇이 몇 건' 들었는지 먼저 보고하고(감사 로그용), mask()로 실제로 '[유형_마스킹]'으로 바꿉니다. LLM을 쓰지 않고 정규식만 씁니다 — 출력 필터는 빠르고 확실해야 하며, 가리기 누락이 AI의 들쭉날쭉함에 좌우되면 안 되기 때문입니다. 왜 가릴까요? 의견서가 유출돼도 개인이 식별되지 않게 하기 위함입니다.",
      terms: ["DLP", "PII(개인정보)", "정규식(regex)", "마스킹(masking)", "결정적(deterministic)"],
      lines: [
        { at: "PII_PATTERNS: dict[str, str] = {", text: "탐지할 개인정보 유형별 정규식 패턴 목록을 정의합니다." },
        { at: '"주민등록번호":', text: "주민등록번호 패턴(앞 6자리-뒤 7자리)을 정의합니다." },
        { at: '"이메일":', text: "이메일 주소 패턴을 정의합니다." },
        { at: "def scan(self, text: str) -> list[dict]:", text: "텍스트에서 개인정보를 '탐지만' 합니다(가리지는 않음) — 감사·요약용." },
        { at: "for match in re.finditer(pattern, text):", text: "각 패턴에 맞는 부분을 모두 찾아 유형·값·위치를 기록합니다." },
        { at: "def mask(self, text: str) -> str:", text: "탐지된 개인정보를 실제로 가리는(치환) 함수입니다." },
        { at: 'masked = re.sub(pattern, f"[{pii_type}_마스킹]", masked)', text: "찾은 개인정보를 '[유형_마스킹]'으로 바꿔 안전한 텍스트로 만듭니다." },
      ],
      code: `# (일부 발췌) harness/dlp.py — 개인정보 탐지·마스킹 출력 필터

class DLPFilter:
    """텍스트에서 개인 식별 정보(PII)를 탐지·마스킹하는 출력 필터."""

    # PII 패턴 — 한국 환경에서 흔한 식별 정보. 더 구체적인 패턴을 앞에 둠.
    PII_PATTERNS: dict[str, str] = {
        "주민등록번호": r"\\d{6}-[1-4]\\d{6}",                              # 901010-1234567
        "전화번호": r"01[016789]-?\\d{3,4}-?\\d{4}",                        # 010-1234-5678
        "카드번호": r"\\b\\d{4}-\\d{4}-\\d{4}-\\d{4}\\b",                       # 1234-5678-9012-3456
        "이메일": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",      # user@example.com
    }

    def scan(self, text: str) -> list[dict]:
        """텍스트에서 PII를 탐지해 [{type, value, position}] 목록을 반환함(치환은 하지 않음)."""
        findings: list[dict] = []
        for pii_type, pattern in self.PII_PATTERNS.items():
            for match in re.finditer(pattern, text):
                findings.append({
                    "type": pii_type,
                    "value": match.group(),
                    "position": match.span(),
                })
        return findings

    def mask(self, text: str) -> str:
        """탐지된 PII를 '[유형_마스킹]' 형태로 치환한 안전한 텍스트를 반환함."""
        masked = text
        for pii_type, pattern in self.PII_PATTERNS.items():
            masked = re.sub(pattern, f"[{pii_type}_마스킹]", masked)
        return masked`,
    },

    // ───────────────────────── config/settings.py ─────────────────────────
    {
      id: "settings_consts",
      name: "주요 설정 상수",
      fileId: "settings",
      summary: "모델·MCP 접속·게이트 제어값(재작성 한도 등)·법적 책임 고지문을 한곳에 모은 설정값들",
      how: "코드 곳곳에서 settings.XXX로 참조하는 값을 이 파일 한곳에 모읍니다. LLM 모델·MCP 접속·재작성 최대 횟수(MAX_REWRITES)·재귀 한계(RECURSION_LIMIT)·법적 책임 고지문(LEGAL_DISCLAIMER) 등을 여기서 한 번에 관리합니다. build_law_mcp_url()은 인증키(LAW_OC)가 없으면 실행 초기에 명확한 오류를 내 빠르게 실패시킵니다(나중에 헷갈리지 않게).",
      terms: ["설정 상수", "fail-fast(빠른 실패)", "MAX_REWRITES", "환경변수(.env)", "법적 책임 고지(disclaimer)"],
      lines: [
        { at: 'LLM_MODEL = "openai/gpt-oss-120b"', text: "초안 작성·근거성 평가·재작성을 담당하는 LLM 모델." },
        { at: 'LLM_REASONING_FORMAT = "hidden"', text: "추론 과정을 숨기고 최종 텍스트만 받게 하는 설정." },
        { at: "MAX_REWRITES = 2", text: "근거 미달·환각 시 다시 쓰는 최대 횟수. 넘으면 무한 루프 대신 사람에게 승급." },
        { at: "RECURSION_LIMIT = 50", text: "재작성 루프가 LangGraph 기본 단계 한계(25)에 걸리지 않도록 늘린 값." },
        { at: "LEGAL_DISCLAIMER = (", text: "사람 승인 화면·최종 출력에 붙이는 '이 글은 AI 참고용' 법적 책임 고지문." },
        { at: "def build_law_mcp_url() -> str:", text: "MCP 접속 URL을 만들되, 인증키가 없으면 실행 초기에 명확한 오류를 냅니다(fail-fast)." },
        { at: "if not LAW_OC:", text: "인증키가 비어 있으면 어디를 고쳐야 하는지 알려 주는 오류를 발생시킵니다." },
      ],
      code: `# (일부 발췌) config/settings.py — 런타임 전역 설정

# LLM (런타임 전용 — Groq LPU, 클라우드)
LLM_MODEL = "openai/gpt-oss-120b"      # 초안 작성·근거성 평가·재작성을 모두 담당
LLM_REASONING_FORMAT = "hidden"        # 추론 과정을 숨기고 최종 텍스트만 받음
LLM_TEMPERATURE = 0                    # 재현 가능하게(결정적으로) 온도 0 고정

# 인라인 게이트 / 워크플로우 제어
MAX_REWRITES = 2        # 근거 미달·인용 환각 시 재작성 최대 횟수(넘으면 HITL 승급)
RECURSION_LIMIT = 50    # 재작성 루프가 기본 단계 한계(25)에 걸리지 않도록 상향
HISTORY_TURNS = 6       # 프롬프트에 포함할 직전 대화 메시지 수

# HITL — 법적 책임 고지문 (AI 생성물이 전문가 자문을 대체하지 않음을 명시)
LEGAL_DISCLAIMER = (
    "⚠️ 본 의견서 초안은 AI가 생성한 참고용 자료이며, 법적 효력이 있는 변리사·변호사의 자문을 "
    "대체하지 않습니다. 인용된 법령·판례는 자동 검증을 거쳤으나, 확정·제출 전 반드시 전문가의 "
    "최종 검토를 받으시기 바랍니다."
)


def build_law_mcp_url() -> str:
    """korean-law MCP 접속 URL을 구성함 (기본 URL + oc 인증키 쿼리 파라미터).

    LAW_OC가 비어 있으면 실행 초기에 명확한 오류를 내 디버깅을 쉽게 함.
    """
    if not LAW_OC:
        raise RuntimeError(f"LAW_OC가 설정되지 않음. {ENV_PATH}의 LAW_OC 값을 확인하세요.")
    return f"{LAW_MCP_BASE_URL}?oc={LAW_OC}"`,
    },
  ],

  glossary: {
    "HITL": "Human-In-The-Loop. AI가 결과를 곧장 내보내지 않고, 확정 전에 사람의 승인을 받는 구조. 잘못되면 피해가 큰 법률 문서라서 사람이 최종 판단권을 가짐.",
    "LangGraph": "여러 처리 단계(노드)를 그래프(흐름도)로 엮어 LLM 워크플로우를 만드는 프레임워크. 분기·반복·중간 멈춤(interrupt)을 지원함.",
    "interrupt(인터럽트)": "그래프 실행을 특정 노드 '직전'에서 잠시 멈추는 기능. 여기서는 사람 승인(human_review) 앞에서 멈춰 사람 입력을 기다림.",
    "체크포인터(checkpointer)": "그래프의 중간 상태를 저장해 두는 장치. 멈췄다가 나중에 그 지점부터 다시 이어 갈 수 있게 함(HITL의 토대).",
    "thread_id": "한 요청(대화)을 식별하는 고유 번호. 멈췄다 이어 갈 때 '어느 대화의 상태인지' 찾는 열쇠.",
    "UUID": "겹치지 않는 고유 식별자를 만드는 방법. 여기서는 요청마다 새 thread_id를 만드는 데 씀.",
    "콜백(callback)": "'필요할 때 대신 호출해 달라'고 넘겨 주는 함수. 여기선 '사람에게 승인을 묻는 함수'를 콜백으로 전달함.",
    "State(상태)": "그래프 노드들이 공유하며 갱신하는 데이터 묶음. 질문·초안·검증 결과·승인 여부 등이 모두 여기 담김.",
    "TypedDict": "딕셔너리(키-값 묶음)에 어떤 키가 어떤 타입으로 들어가는지 미리 정해 두는 파이썬 타입 도구.",
    "노드(node)": "워크플로우의 한 처리 단계. 여기서는 초안 작성·근거성 평가·인용 검증 같은 각 작업이 하나의 노드.",
    "엣지(edge)": "노드와 노드를 잇는 화살표(다음에 어디로 갈지). 흐름의 방향을 정함.",
    "조건부 엣지(conditional edge)": "상황(상태값)에 따라 다음 노드가 달라지는 갈림길 엣지. 예: 통과면 승인, 실패면 재작성.",
    "StateGraph": "상태(State)를 공유하는 LangGraph의 그래프 객체. 노드·엣지를 등록해 워크플로우를 구성함.",
    "분기(branch)": "조건에 따라 처리 경로가 둘 이상으로 갈리는 것.",
    "재작성(rewrite)": "검증을 통과하지 못한 초안을, 문제점을 알려 주며 LLM에게 다시 쓰게 하는 것.",
    "escalate(승급)": "AI가 스스로 처리하지 못하는 상황(검증 불가·재시도 소진)을 사람에게 올려 판단을 맡기는 것.",
    "fail-safe(실패 안전)": "검증이 실패하면 '정상'으로 흡수해 통과시키지 말고, 막거나 사람에게 넘기도록 설계하는 안전 원칙.",
    "fail-fast(빠른 실패)": "잘못된 설정·누락을 나중이 아니라 실행 초기에 바로 오류로 알려 디버깅을 쉽게 하는 방식.",
    "게이트(gate)": "통과 조건을 만족해야만 다음 단계로 넘어가게 하는 검문소. 여기선 근거성+인용 검증을 둘 다 통과해야 함.",
    "IsSup": "Is Supported. 생성된 초안이 제공된 검색 자료에 실제로 근거하는지(환각이 없는지)를 평가하는 게이트.",
    "Self-RAG": "검색으로 가져온 자료에 답이 근거하는지 모델 스스로 점검·교정하게 하는 RAG 기법. IsSup이 그 한 신호임.",
    "verify_citations": "초안에 적힌 법령 조문 인용이 실제로 존재하는지 법령 DB와 대조해 검증하는 MCP 도구.",
    "인용 환각(hallucination)": "AI가 실제로 존재하지 않는 조문 번호·판례를 그럴듯하게 지어내는 오류. 검증으로 잡아냄.",
    "MCP": "Model Context Protocol. LLM 앱이 외부 도구·데이터(여기선 법령 검색·인용 검증 서버)에 표준 방식으로 연결하는 규약.",
    "ClientSession": "MCP 서버와 연결을 맺고 도구를 호출하는 클라이언트 세션 객체.",
    "타임아웃(timeout)": "응답을 정해진 시간까지만 기다리고, 넘으면 실패로 처리하는 제한 시간.",
    "비동기(async)": "기다리는 동안 다른 일을 할 수 있게 처리하는 방식(async/await). 네트워크 호출처럼 대기가 긴 작업에 씀.",
    "파싱(parsing)": "정해지지 않은 텍스트에서 필요한 정보(숫자·항목)를 규칙으로 뽑아 구조화하는 것.",
    "정규식(regex)": "글자 패턴을 규칙으로 표현해 찾기/바꾸기를 하는 도구. 예: \\d는 '숫자 한 개'를 뜻함.",
    "프롬프트(prompt)": "LLM에게 무엇을 어떻게 하라고 알려 주는 지시문(입력 텍스트).",
    "시스템 프롬프트": "대화 전체에 적용되는 LLM의 역할·규칙을 정하는 기본 지시문.",
    "LLM": "Large Language Model(대규모 언어 모델). 글을 이해하고 생성하는 AI. 여기선 의견서 작성·평가를 담당.",
    "with_structured_output(구조화 출력)": "LLM이 자유 문장 대신 정해진 형태(필드)로만 답하게 강제하는 기능. 결과 파싱을 안정시킴.",
    "DLP": "Data Loss Prevention(데이터 유출 방지). 출력에 남은 민감정보를 탐지·마스킹해 외부 유출을 막는 안전장치.",
    "PII(개인정보)": "Personally Identifiable Information. 개인을 식별할 수 있는 정보(주민번호·전화·이메일·카드번호 등).",
    "마스킹(masking)": "민감정보를 '[유형_마스킹]'처럼 가려진 표시로 바꿔 원래 값이 드러나지 않게 하는 것.",
    "결정적(deterministic)": "같은 입력이면 항상 같은 결과가 나오는 성질. DLP는 LLM 대신 정규식을 써서 누락이 들쭉날쭉하지 않게 함.",
    "설정 상수": "코드 여러 곳에서 쓰는 값을 한 파일에 모아 둔 것. 바꿀 때 한 곳만 고치면 됨.",
    "MAX_REWRITES": "근거 미달·인용 환각 시 재작성을 허용하는 최대 횟수(기본 2). 넘으면 무한 루프 대신 사람에게 승급.",
    "환경변수(.env)": "API 키 같은 비밀값을 코드 밖 .env 파일에 두고 읽어 오는 방식. 비밀이 코드에 노출되지 않게 함.",
    "법적 책임 고지(disclaimer)": "이 결과물이 AI 참고용이며 전문가 자문을 대체하지 않음을 알리는 안내문. 오·남용을 방지함.",
    "fan-in(팬인)": "여러 갈래에서 나온 결과를 한곳으로 모으는 것. 여기선 상위 오케스트레이터가 MAS A·B의 검색 결과를 모아 MAS C에 주입함(provided_context).",
    "폴백(fallback)": "원래 방법이 실패했을 때 대신 쓰는 안전한 대안. 예: 검색 계획이 실패하면 질문 자체를 검색어로 씀.",
    "멀티턴(multi-turn)": "한 번의 질문이 아니라 여러 차례 주고받는 대화. 이전 대화 맥락(history)을 프롬프트에 함께 넣어 이어 감.",
    "StrOutputParser(문자열 파서)": "LLM의 응답에서 본문 텍스트만 뽑아내는 파서. 초안처럼 자유 문장 결과에 씀(구조화 출력과 대비됨).",
    "재현성(determinism)": "같은 입력이면 항상 같은 결과가 나오는 성질. 온도(temperature) 0으로 작성·판단을 일정하게 만듦.",
    "reasoning_format(추론 형식)": "LLM의 중간 추론 과정을 보일지 숨길지 정하는 설정. 'hidden'이면 과정을 숨기고 최종 텍스트만 받음.",
    "동기 래퍼(sync wrapper)": "비동기(async) 함수를 일반(동기) 코드에서 쓸 수 있게 asyncio.run으로 감싼 함수. LangGraph 동기 노드가 비동기 MCP 호출을 부를 때 씀.",
    "graceful(우아한 실패)": "오류가 나도 전체를 멈추지 않고 빈 결과 등으로 부드럽게 넘어가는 처리 방식. 컨텍스트 수집에 씀(verify는 반대로 fail-safe).",
    "메타데이터(metadata)": "본문이 아니라 그에 딸린 부가 정보(사건번호·날짜·법령ID 등). 검색 결과 텍스트에서 파싱해 뽑아냄.",
  },
};
