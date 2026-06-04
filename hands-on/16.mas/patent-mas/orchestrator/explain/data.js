window.EXPLAIN_DATA = {
  meta: {
    title: "특허법 분산 MAS 오케스트레이터 — 한 지휘자가 3개 AI 팀(A·B·C)을 안전하게 조율하는 2계층 SAS",
    entry: "run_cli.py",
  },

  // 좌측 그룹 = 파일 (진입점 → 그래프 배선 → 노드 → 통제 로직 → 통신 → 워커 → 설정)
  files: [
    { id: "cli",        label: "run_cli.py",             role: "비대화형 검증 진입점 — 4종 질의를 순차 실행하고 HITL 인터럽트는 자동 승인으로 통과시켜 PASS/FAIL 집계" },
    { id: "app",        label: "app.py",                 role: "Streamlit 챗봇 진입점 — 사용자가 질문하면 그래프를 구동하고, HITL 승급 시 승인/반려 패널을 띄움" },
    { id: "workflow",   label: "graph/workflow.py",      role: "그래프 배선 — Send 기반 fan-out, reducer fan-in, Loop Guard, 글로벌 HITL interrupt 를 StateGraph 로 조립" },
    { id: "nodes",      label: "graph/nodes.py",         role: "그래프 노드 본체 — Scheduler/run_unit(A·B 호출)/Supervisor/run_mas_c(취합)/compose(합성)" },
    { id: "scheduler",  label: "graph/scheduler.py",     role: "의도 분류 라우터 — 키워드 점수화로 빠르게 판단하고, 애매하면 LLM 구조화 분류로 폴백" },
    { id: "supervisor", label: "graph/supervisor.py",    role: "거버넌스 순수 로직 — Budget(비용 상한)·can_afford(Kill-switch 점검)·validate_branch(출력 검증)" },
    { id: "state",      label: "graph/state.py",         role: "공유 State 정의 — 병렬 분기가 동시에 쓰는 키를 reducer(operator.add)로 안전 병합(fan-in)" },
    { id: "clientA",    label: "clients/mas_a_client.py", role: "MAS A 통신 — MCP 클라이언트로 원격 HTTP 서버의 도구를 호출하고 결과를 컨텍스트로 변환" },
    { id: "clientBC",   label: "clients/worker_client.py", role: "MAS B/C 통신 — 각 단위 venv 파이썬을 서브프로세스로 띄워 stdin/stdout JSON 으로 통신" },
    { id: "workerB",    label: "workers/mas_b_worker.py", role: "MAS B 격리 워커 진입점 — stdin JSON 요청을 받아 단위 MAS를 실행하고 최종 JSON 1줄만 stdout 으로 보냄" },
    { id: "workerC",    label: "workers/mas_c_worker.py", role: "MAS C 격리 워커 진입점 — A∥B 컨텍스트를 받아 의견서 작성·검증을 실행하고, C 내부 HITL은 자동 승인으로 통과시켜 최종 JSON 1줄만 보냄" },
    { id: "settings",   label: "config/settings.py",     role: "전역 설정 — 단위 MAS venv 경로·MCP URL·Budget·타임아웃·Loop Guard 한도를 한곳에서 관리" },
    { id: "llm",        label: "config/llm.py",          role: "LLM 팩토리 — Scheduler·합성·검증이 동일 규칙(Groq, json_schema 구조화 출력)으로 모델을 만들게 함" },
  ],

  // 전체 처리 흐름 (의도 분류 → 병렬 분배 → 통제 → 취합 → 합성)
  flow: [
    {
      step: 1,
      title: "의도 분류 (Scheduler)",
      summary: "scheduler_node → Scheduler.route(): 질문 의도를 정해 어느 AI 팀(A·B·C)을 부를지 결정",
      detail: "사용자 질문이 들어오면 먼저 '무엇을 원하는 질문인지'를 분류합니다. 법령 개념·요건이면 A팀, 판례·동향이면 B팀, 의견서 작성이면 A·B를 거쳐 C팀, 인사·잡담이면 팀을 안 부르고 직접 답합니다. 키워드 점수로 빠르게 판단하고, 애매하면 LLM에게 물어봅니다(폴백). 비유하면 '접수창구 직원이 민원을 보고 어느 부서로 보낼지 정하는' 단계입니다.",
    },
    {
      step: 2,
      title: "병렬 분배 (Send fan-out)",
      summary: "fan_out() → Send[run_unit]×N: 활성 팀(A·B)에게 작업을 동시에 나눠 보냄",
      detail: "정해진 팀이 여러 개면 Send라는 장치로 각 팀에 작업을 '동시에' 던집니다(fan-out, 부채살처럼 펼침). A팀(법령)과 B팀(동향)은 서로 독립이라 동시에 일해도 안전하고, 둘을 기다리는 시간이 겹쳐 전체가 빨라집니다. 비유하면 '지휘자가 여러 연주자에게 동시에 신호를 주는' 것입니다.",
    },
    {
      step: 3,
      title: "단위 MAS 호출 (run_unit)",
      summary: "run_unit_node(): A=MCP 원격 HTTP 호출 / B=서브프로세스 워커 호출 — 결과를 State에 누적",
      detail: "각 분기는 자기 팀 하나만 호출합니다. A팀은 MCP(원격 서버의 도구를 인터넷으로 부르는 방식)로, B팀은 그 팀 전용 파이썬(venv)을 별도 프로그램(서브프로세스)으로 띄워 메시지를 주고받습니다. 호출 방식이 다른 두 팀의 결과를 같은 그릇(State)에 차곡차곡 쌓습니다(reducer fan-in).",
    },
    {
      step: 4,
      title: "글로벌 Supervisor 통제",
      summary: "supervisor_node(): Budget·Kill-switch·출력 검증·Loop Guard로 결과를 점검하고 다음 길을 정함",
      detail: "병렬로 모은 결과를 한 명의 감독관이 검사합니다. (1)Budget=비용이 한도를 넘지 않았는지, (2)Kill-switch=예산 부족이면 다음 단계 생략, (3)출력 검증=팀 결과가 쓸 만한지, (4)Loop Guard=실패한 팀만 딱 1번까지 재시도(무한 반복 방지). 비유하면 '제출된 보고서를 검토관이 통과·반려·재작업 지시로 가르는' 단계입니다.",
    },
    {
      step: 5,
      title: "의견서 취합 (fan-in → MAS C)",
      summary: "run_mas_c_node(): A∥B가 모은 근거를 합쳐 C팀(의견서 작성·검증) 워커에 주입",
      detail: "의견서 요청일 때만, A팀과 B팀이 각자 모은 근거(context)를 한데 모아(fan-in) C팀에 건넵니다. C팀은 그 근거로 의견서를 쓰고 인용이 진짜인지 스스로 검증합니다. 비유하면 '자료조사 두 팀의 결과를 작성팀에 넘겨 초안을 쓰게 하는' 것입니다.",
    },
    {
      step: 6,
      title: "글로벌 HITL (사람 승인)",
      summary: "human_review_node(): C가 자동검증 게이트를 통과 못하면(escalated) 사람 승인 전까지 그래프가 멈춤",
      detail: "C팀 의견서가 자동 검증을 통과하지 못하면, 그래프가 사람 승인 직전에 멈춥니다(interrupt). 사람이 초안을 보고 승인/반려를 누르면 다시 진행합니다. 실제 사람 승인 게이트는 상위 오케스트레이터 단 한 곳에만 둡니다. 비유하면 '자동 통과가 안 된 서류만 책임자 결재로 올리는' 것입니다.",
    },
    {
      step: 7,
      title: "최종 합성 (compose)",
      summary: "compose_node(): 팀 결과를 합쳐 최종 답변을 만들고 통제 메모(예산·열화·HITL)를 덧붙임",
      detail: "여러 팀 결과를 라벨 섹션으로 묶어 하나의 답변으로 만들고, 감독관이 기록한 통제 메모(쓴 예산, 일부 실패 안내, 사람 승인 결과)를 끝에 붙여 사용자에게 돌려줍니다. 비유하면 '여러 부서 회신을 모아 한 장의 최종 답변서로 정리하는' 것입니다.",
    },
  ],

  functions: [
    // ───────────────────────── graph/workflow.py ─────────────────────────
    {
      id: "build_graph",
      name: "build_graph()",
      fileId: "workflow",
      summary: "상위 SAS 그래프를 조립·컴파일 — 노드 등록 + 엣지 배선 + checkpointer + 글로벌 HITL interrupt",
      how: "오케스트레이션의 '설계도'를 만드는 함수입니다. 7개 노드(scheduler·run_unit·supervisor·run_mas_c·human_review·compose·direct_answer)를 등록하고, 노드 사이를 잇는 화살표(엣지)를 답니다. 조건부 엣지에는 분기 함수(fan_out 등)를 연결해 상황에 따라 다른 길로 가게 합니다. 마지막에 checkpointer(상태 저장)와 interrupt_before(human_review 앞에서 멈춤)를 붙여 컴파일하면 실행 가능한 그래프가 됩니다.",
      terms: ["StateGraph", "노드(node)", "엣지(edge)", "조건부 엣지", "checkpointer", "interrupt_before", "HITL", "컴파일(compile)"],
      lines: [
        { at: "workflow = StateGraph(OrchestratorState)", text: "공유 State 스키마를 가진 빈 그래프(설계도)를 만듭니다." },
        { at: 'workflow.add_node("run_unit", nodes.run_unit_node)', text: "단위 MAS(A 또는 B) 1개를 호출하는 노드를 등록합니다 — 병렬 분기로 여러 개가 동시에 돕니다." },
        { at: 'workflow.add_conditional_edges("scheduler", fan_out, ["run_unit", "direct_answer"])', text: "scheduler 다음에 fan_out 결정 함수를 끼워 — 팀을 부르거나(run_unit) 직접 답하거나(direct_answer)로 갈림." },
        { at: 'workflow.add_edge("run_unit", "supervisor")', text: "모든 병렬 run_unit 인스턴스가 끝나면 supervisor가 1회만 실행되도록 합류(join)시킵니다." },
        { at: '"supervisor", route_after_supervisor, ["run_unit", "run_mas_c", "compose"]', text: "supervisor 결정에 따라 재시도(run_unit)·취합(run_mas_c)·합성(compose) 중 한 길로 보냅니다." },
        { at: "return workflow.compile(checkpointer=MemorySaver(), interrupt_before=[", text: "상태 저장기와 'human_review 앞에서 멈춤' 설정을 붙여 실행 가능한 그래프로 컴파일합니다." },
      ],
      code: `def build_graph():
    """오케스트레이터 StateGraph 를 조립·컴파일함 (checkpointer + 글로벌 HITL interrupt)."""
    workflow = StateGraph(OrchestratorState)

    # 노드 등록 (Scheduler / 병렬 분기 / 글로벌 Supervisor / C 취합 / HITL / 합성 / 직접답변)
    workflow.add_node("scheduler", nodes.scheduler_node)
    workflow.add_node("run_unit", nodes.run_unit_node)
    workflow.add_node("supervisor", nodes.supervisor_node)
    workflow.add_node("run_mas_c", nodes.run_mas_c_node)
    workflow.add_node("human_review", nodes.human_review_node)
    workflow.add_node("compose", nodes.compose_node)
    workflow.add_node("direct_answer", nodes.direct_answer_node)

    workflow.add_edge(START, "scheduler")
    # 조건부 fan-out: 활성 단위로 병렬 Send, 또는 직접 답변 (path 목록은 컴파일 검증용)
    workflow.add_conditional_edges("scheduler", fan_out, ["run_unit", "direct_answer"])
    # 병렬 분기 join: 모든 run_unit 인스턴스 완료 후 supervisor 1회 실행
    workflow.add_edge("run_unit", "supervisor")
    workflow.add_conditional_edges(
        "supervisor", route_after_supervisor, ["run_unit", "run_mas_c", "compose"]
    )
    workflow.add_conditional_edges("run_mas_c", decide_review, ["human_review", "compose"])
    workflow.add_edge("human_review", "compose")
    workflow.add_edge("compose", END)
    workflow.add_edge("direct_answer", END)

    # checkpointer + interrupt_before: 글로벌 HITL — human_review 실행 전 멈춰 사람 승인을 기다림
    return workflow.compile(checkpointer=MemorySaver(), interrupt_before=["human_review"])`,
    },
    {
      id: "fan_out",
      name: "fan_out() · _branch_send()",
      fileId: "workflow",
      summary: "Send API로 활성 팀(A·B)에게만 작업을 병렬 분배 — fan-out의 핵심",
      how: "이 예제의 핵심 장치인 'fan-out(부채살 펼치기)'입니다. Scheduler가 정한 활성 팀 목록을 보고, 팀이 없으면 직접 답변으로 보내고, 있으면 각 팀마다 Send 객체를 만들어 리스트로 돌려줍니다. LangGraph는 이 Send 리스트를 받아 같은 단계(superstep)에서 run_unit 노드를 '동시에' 여러 개 펼쳐 실행합니다. 각 Send에는 그 분기가 처리할 unit·question·history만 담아 메인 상태와 분리합니다.",
      terms: ["Send API", "fan-out", "병렬(parallel)", "superstep", "분기(branch)"],
      lines: [
        { at: 'return Send("run_unit", {', text: "분기 1개를 위한 Send를 만듦 — run_unit 노드에 이 입력만 담아 보냅니다." },
        { at: 'units = state.get("active_units", []) or []', text: "Scheduler가 정한 활성 팀 목록을 읽습니다." },
        { at: 'return "direct_answer"', text: "부를 팀이 없으면(잡담 등) 직접 답변 노드로 보냅니다." },
        { at: "return [_branch_send(state, unit) for unit in units]", text: "활성 팀마다 Send를 만들어 리스트로 돌려줌 → LangGraph가 이들을 병렬 실행(fan-out 핵심)." },
      ],
      code: `def _branch_send(state: dict, unit: str) -> Send:
    """run_unit 분기 1개를 위한 Send 를 만듦.

    Send(node, arg): arg 는 그 노드 인스턴스의 '입력 상태'임(메인 상태와 분리). 따라서 분기가
    필요로 하는 unit·question·history 를 직접 담아 보냄. 노드의 반환값만 메인 상태로 reducer 병합됨.
    """
    return Send("run_unit", {
        "unit": unit,
        "question": state["question"],
        "history": state.get("history", []),
    })


def fan_out(state: dict):
    """scheduler 직후 분기: 활성 단위가 있으면 Send 로 병렬 fan-out, 없으면 직접 답변."""
    units = state.get("active_units", []) or []
    if not units:
        return "direct_answer"
    # 활성 단위(A·B)만 동시 디스패치 — A와 B는 입력=질문으로 상호 독립이라 병렬 안전
    return [_branch_send(state, unit) for unit in units]`,
    },

    {
      id: "route_branches",
      name: "route_after_supervisor() · decide_review()",
      fileId: "workflow",
      summary: "조건부 엣지의 라우터 함수 — supervisor 후 길 가름(재시도/C/합성)과 C 후 HITL 여부 결정",
      how: "그래프의 '갈림길 표지판'을 읽어 다음 목적지를 정하는 두 라우터 함수입니다(조건부 엣지에 연결됨). route_after_supervisor는 Supervisor가 State에 적어 둔 next_route를 보고 — 'redispatch'면 실패 팀에게만 Send로 재분배, 'to_c'면 C 취합 노드, 그 외엔 합성으로 보냅니다. decide_review는 C 결과가 escalated(자동검증 미통과)면 글로벌 HITL로, 아니면 곧장 합성으로 보냅니다. 즉 '판단(Supervisor)'과 '이동(라우터)'을 분리한 구조입니다.",
      terms: ["라우터 함수", "조건부 엣지", "Send API", "재디스패치(redispatch)", "escalated(승급)", "HITL"],
      lines: [
        { at: 'route = state.get("next_route", "compose")', text: "Supervisor가 정해 둔 다음 경로 표지를 읽습니다(없으면 합성)." },
        { at: 'if route == "redispatch":', text: "재디스패치면 — 실패 팀에게만 다시 Send로 작업을 보냅니다." },
        { at: 'return [_branch_send(state, unit) for unit in state.get("redispatch_units", [])]', text: "실패 팀 목록만 골라 병렬 재분배(Loop Guard 한도 안에서)." },
        { at: 'if route == "to_c":', text: "취합 경로면 C 노드로 보내 의견서 작성을 시작합니다." },
        { at: 'return "human_review" if state.get("escalated") else "compose"', text: "C가 승급됐으면 사람 검토로, 아니면 바로 합성으로 가릅니다." },
      ],
      code: `def route_after_supervisor(state: dict):
    """supervisor 직후 분기: 실패 재디스패치(Loop Guard) / MAS C 취합 / 합성."""
    route = state.get("next_route", "compose")
    if route == "redispatch":
        return [_branch_send(state, unit) for unit in state.get("redispatch_units", [])]
    if route == "to_c":
        return "run_mas_c"
    return "compose"


def decide_review(state: dict) -> str:
    """run_mas_c 직후 분기: C가 게이트 미통과(escalated)면 글로벌 HITL, 아니면 바로 합성."""
    return "human_review" if state.get("escalated") else "compose"`,
    },

    // ───────────────────────── graph/scheduler.py ─────────────────────────
    {
      id: "route",
      name: "Scheduler.route()",
      fileId: "scheduler",
      summary: "질문 의도를 분류해 활성 팀·C 필요 여부를 결정 — 키워드 점수 우선, 애매하면 LLM 폴백",
      how: "접수창구 같은 함수입니다. (1)'의견서'·'서면' 같은 강한 신호가 있으면 곧장 의견서 경로(A·B→C)로 보냅니다. (2)법령/동향/잡담 키워드 점수를 매겨 우위가 분명하면 그대로 확정합니다(LLM을 안 불러 빠르고 쌈). (3)점수가 비슷해 애매하면 LLM에게 구조화 분류를 맡깁니다(폴백). 멀티턴 대화에서는 history를 함께 넘겨 '더 자세히' 같은 후속 질문을 직전 주제로 해석합니다.",
      terms: ["의도 분류(intent)", "라우팅(routing)", "패턴 매칭", "LLM 폴백", "RouteDecision", "정규식(re)"],
      lines: [
        { at: "if any(token in question for token in _OPINION_STRONG):", text: "'의견서'·'서면' 같은 강한 신호가 하나라도 있으면 곧장 의견서 경로로 보냅니다." },
        { at: "law_score = self._score(normalized, _LAW_PATTERNS)", text: "법령 관련 키워드가 몇 번 등장하는지 점수를 냅니다." },
        { at: "trend_score = self._score(normalized, _TREND_PATTERNS)", text: "판례·동향 관련 키워드 점수를 냅니다." },
        { at: "best = max(law_score, trend_score, chitchat_score)", text: "세 후보 중 가장 높은 점수를 고릅니다." },
        { at: "if best >= 1 and best > _second_best(", text: "1등 점수가 2등보다 분명히 높으면(확신도 충분) 패턴으로 확정합니다." },
        { at: "return self._llm_fallback(question, history or [])", text: "점수가 비슷해 애매하면 LLM 구조화 분류로 넘깁니다(폴백)." },
      ],
      code: `def route(self, question: str, history: list | None = None) -> RouteDecision:
    """질문을 의도로 분류하고 활성 단위 MAS·C 필요 여부를 결정함."""
    normalized = question.lower()

    # 1) 의견서 강신호 — 가장 우선 (A∥B→C 전체 파이프라인을 트리거)
    if any(token in question for token in _OPINION_STRONG):
        return RouteDecision(INTENT_OPINION, ["A", "B"], True,
                             "의견서/서면 작성 신호 감지 → A∥B 병렬 후 C 취합", "pattern")

    law_score = self._score(normalized, _LAW_PATTERNS)
    trend_score = self._score(normalized, _TREND_PATTERNS)
    chitchat_score = self._score(normalized, _CHITCHAT_PATTERNS)

    # 2) '작성/대응' 약신호 + 법령/판례 맥락이 동시에 강하면 의견서로 승격
    opinion_weak = self._score(normalized, _OPINION_WEAK)
    if opinion_weak >= 2 and (law_score + trend_score) >= 1:
        return RouteDecision(INTENT_OPINION, ["A", "B"], True,
                             "작성·대응 신호 + 법령/판례 맥락 → 의견서 작성으로 승격", "pattern")

    # 3) 법령 vs 동향 — 점수 우위가 분명하면 패턴으로 확정
    best = max(law_score, trend_score, chitchat_score)
    if best >= 1 and best > _second_best(law_score, trend_score, chitchat_score):
        if best == chitchat_score and chitchat_score > max(law_score, trend_score):
            return RouteDecision(INTENT_CHITCHAT, [], False, "인사·잡담 신호", "pattern")
        if law_score >= trend_score:
            # 동향 단서가 함께 있으면 A에 B를 병렬 보강 (법령+동향 혼합 질문)
            units = ["A", "B"] if trend_score >= 1 else ["A"]
            return RouteDecision(INTENT_LAW if units == ["A"] else INTENT_TREND, units, False,
                                 f"법령 신호 우위(law={law_score},trend={trend_score})", "pattern")
        # 동향 우위 — 법령 근거 단서가 함께 있으면 A 병렬 보강
        units = ["B", "A"] if law_score >= 1 else ["B"]
        return RouteDecision(INTENT_TREND, units, False,
                             f"동향 신호 우위(trend={trend_score},law={law_score})", "pattern")

    # 4) 확신도 낮음 → LLM Few-shot 구조화 분류 폴백 (대화 맥락으로 후속 질의 해소)
    return self._llm_fallback(question, history or [])`,
    },

    {
      id: "scheduler_internals",
      name: "Scheduler._score() · _second_best() · _llm_fallback()",
      fileId: "scheduler",
      summary: "라우팅 내부 도구 — 키워드 점수화(_score)·2등 비교(_second_best)·애매할 때 LLM 분류(_llm_fallback)",
      how: "Scheduler.route()가 판단에 쓰는 세 도우미입니다. _score는 정해진 키워드(정규식)가 질문에 몇 번 나오는지 세어 점수를 냅니다(빠르고 비용 0). _second_best는 점수들 중 2등을 돌려줘 '1등이 2등보다 분명히 큰지'(확신도)를 따지게 합니다. _llm_fallback은 점수가 비슷해 애매할 때만 LLM에게 구조화 분류(IntentDecision)를 맡기고, 그마저 실패하면 'A 단독'으로 안전하게 빠집니다(그래프가 죽지 않게).",
      terms: ["_score(점수화)", "패턴 매칭", "정규식(re)", "LLM 폴백", "Few-shot", "IntentDecision", "안전 폴백", "RouteDecision"],
      lines: [
        { at: "return sum(1 for pattern in patterns if re.search(pattern, text))", text: "키워드(정규식)가 등장한 개수를 합해 점수로 냅니다(_score)." },
        { at: "ordered = sorted(scores, reverse=True)", text: "점수를 내림차순 정렬해 2등 값을 꺼낼 준비를 합니다(_second_best)." },
        { at: "self._router_llm = build_structured_llm(IntentDecision)", text: "폴백이 처음 필요할 때만 구조화 분류 LLM을 만듭니다(지연 생성)." },
        { at: "if decision.intent != INTENT_CHITCHAT and not units and not decision.needs_c:", text: "잡담이 아닌데 팀이 비면 최소 A는 부르도록 보정합니다." },
        { at: "logger.warning(\"Scheduler LLM 분류 실패, A 단독 폴백: %s\", error)", text: "LLM 분류가 실패해도 죽지 않고 A 단독으로 안전하게 빠집니다." },
      ],
      code: `    def _llm_fallback(self, question: str, history: list) -> RouteDecision:
        """패턴 분류가 애매할 때 LLM 구조화 분류 수행(실패 시 안전하게 law_knowledge→A 폴백).

        대화 맥락(history)을 함께 넘겨 '그럼 판례는?'·'더 자세히' 같은 후속 질의를 직전 주제로 해석함.
        """
        try:
            if self._router_llm is None:
                self._router_llm = build_structured_llm(IntentDecision)
            decision: IntentDecision = self._router_llm.invoke(
                _LLM_PROMPT.format(question=question, history=_format_history(history))
            )
            units = [u for u in decision.active_units if u in ("A", "B")]
            # 잡담이 아닌데 활성 단위가 비면 최소한 A는 호출하도록 보정
            if decision.intent != INTENT_CHITCHAT and not units and not decision.needs_c:
                units = ["A"]
            logger.info("Scheduler LLM 분류: intent=%s units=%s needs_c=%s",
                        decision.intent, units, decision.needs_c)
            return RouteDecision(decision.intent, units, decision.needs_c,
                                 f"LLM 분류: {decision.reasoning}", "llm")
        except Exception as error:  # noqa: BLE001 - 분류 실패해도 그래프가 죽지 않게 안전 폴백
            logger.warning("Scheduler LLM 분류 실패, A 단독 폴백: %s", error)
            return RouteDecision(INTENT_LAW, ["A"], False,
                                 f"LLM 분류 실패 → A 단독 폴백({type(error).__name__})", "llm")

    @staticmethod
    def _score(text: str, patterns: tuple[str, ...]) -> int:
        """패턴(정규식)이 질문에 등장하는 횟수를 점수로 합산함."""
        return sum(1 for pattern in patterns if re.search(pattern, text))


def _second_best(*scores: int) -> int:
    """점수들 중 2등 값을 반환함 (1등과 동점이면 확신도 낮음으로 간주)."""
    ordered = sorted(scores, reverse=True)
    return ordered[1] if len(ordered) > 1 else 0`,
    },

    // ───────────────────────── graph/nodes.py ─────────────────────────
    {
      id: "run_unit_node",
      name: "run_unit_node()",
      fileId: "nodes",
      summary: "이 분기에 배정된 팀 1개(A=MCP / B=워커)를 호출해 결과를 State에 reducer로 누적",
      how: "병렬로 펼쳐진 각 분기가 실행하는 노드입니다. 자기 분기의 unit이 A면 MCP로, B면 워커로 호출합니다(다른 팀을 직접 부르지는 않음 — Agent 직접 호출 금지 원칙). 실패는 예외로 터뜨리지 않고 ok=False 결과로 정규화해, 나중에 Supervisor가 재시도/부분진행으로 다루게 합니다. 반환하는 키들(branch_results·spent_calls·spent_tokens)은 모두 reducer 대상이라 여러 분기가 동시에 써도 리스트로 안전하게 합쳐집니다.",
      terms: ["노드(node)", "reducer(operator.add)", "fan-in", "MCP", "워커(worker)", "graceful degradation", "토큰(token)"],
      lines: [
        { at: "if unit == \"A\":", text: "이 분기가 A팀이면 — MCP 경로로 호출합니다." },
        { at: "branch = await _run_mas_a(question)", text: "MAS A(법령지식)를 MCP 클라이언트로 비동기 호출합니다." },
        { at: "branch = await _run_mas_b(question, history)", text: "MAS B(선행기술·동향)를 서브프로세스 워커로 비동기 호출합니다." },
        { at: 'tokens = estimate_tokens(branch.get("answer", ""))', text: "답변 길이로 사용 토큰을 추정합니다(Budget 보조 지표)." },
        { at: 'return {"branch_results": [branch], "spent_calls": [1], "spent_tokens": [tokens]}', text: "결과를 리스트로 감싸 반환 → reducer가 다른 분기 결과와 누적 병합(fan-in)." },
      ],
      code: `async def run_unit_node(state: dict) -> dict:
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
    return {"branch_results": [branch], "spent_calls": [1], "spent_tokens": [tokens]}`,
    },
    {
      id: "run_mas_handlers",
      name: "_run_mas_a() · _run_mas_b()",
      fileId: "nodes",
      summary: "A=MCP 원격 호출 / B=서브프로세스 워커 호출 — 두 통신 방식의 대비 + 분기별 타임아웃",
      how: "두 팀의 '호출 방식이 다르다'는 점을 보여주는 한 쌍입니다. A는 mas_a_client(MCP 클라이언트)로 원격 HTTP 도구를 부르고, B는 worker_client로 별도 venv 파이썬 워커를 띄웁니다. 둘 다 asyncio.wait_for로 분기별 타임아웃을 걸어 한 팀이 늦어도 전체가 멈추지 않게 하고(계층적 타임아웃), 타임아웃·예외는 ok=False 결과로 바꿔 Supervisor에게 넘깁니다.",
      terms: ["MCP", "워커(worker)", "asyncio.wait_for", "타임아웃(timeout)", "계층적 타임아웃", "비동기(async/await)"],
      lines: [
        { at: 'mas_a_client.ask_patent_law_async(question, "auto"),', text: "A팀: MCP 클라이언트로 원격 서버의 ask_patent_law 도구를 비동기 호출합니다." },
        { at: "timeout=settings.timeout_mas_a,", text: "A 호출에 분기별 타임아웃을 걸어 늦으면 끊습니다." },
        { at: "\"context_items\": mas_a_client.to_context_items(res),", text: "A 결과를 C가 쓸 수 있는 컨텍스트 형태로 변환해 담습니다." },
        { at: "call_mas_b(question, history),", text: "B팀: worker_client로 서브프로세스 워커를 띄워 호출합니다(MCP가 아닌 외부 프로세스)." },
        { at: "timeout=settings.timeout_mas_b + 15,", text: "워커 내부 타임아웃보다 약간 길게 잡아 이중 가드를 만듭니다." },
      ],
      code: `async def _run_mas_a(question: str) -> dict:
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
                "error": f"MAS B 호출 실패: {type(error).__name__}: {error}"}`,
    },
    {
      id: "supervisor_node",
      name: "supervisor_node()",
      fileId: "nodes",
      summary: "병렬 결과를 검증하고 Budget·Kill-switch·Loop Guard로 다음 길(재시도/C취합/합성)을 결정",
      how: "거버넌스가 한곳에 모인 핵심 노드입니다(일부 발췌). 먼저 누적 사용량으로 WorkflowBudget을 만들고, validate_branch로 각 팀 결과가 쓸 만한지 검사해 실패 팀을 가려냅니다. (1)실패 팀이 있고 재시도 여유·예산이 있으면 Loop Guard 한도 안에서 재디스패치, (2)의견서가 필요하면 can_afford로 예산을 점검해 C로 보내되 예산이 모자라면 Kill-switch로 C를 생략, (3)그 외엔 합성으로 보냅니다.",
      terms: ["Supervisor", "Budget", "Kill-switch", "Loop Guard", "재디스패치(redispatch)", "can_afford", "validate_branch", "graceful degradation"],
      lines: [
        { at: "budget = WorkflowBudget(", text: "지금까지의 누적 호출수·토큰으로 예산 객체를 만듭니다." },
        { at: "valid, reason = validate_branch(result)", text: "각 팀 결과가 구조적으로 쓸 만한지(ok·본문 존재) 검사합니다." },
        { at: "if failed_units and redispatch_count < settings.max_redispatch and budget.can_afford(", text: "실패 팀이 있고 재시도 여유·예산이 있을 때만 재디스패치(Loop Guard)." },
        { at: '"next_route": "redispatch",', text: "실패 팀만 다시 보내도록 라우트를 재디스패치로 정합니다." },
        { at: 'if state.get("needs_c") and ok_units:', text: "의견서가 필요하고 쓸 만한 결과가 있으면 C 취합 경로를 검토합니다." },
        { at: "if budget.can_afford(1):", text: "C 호출 1회분 예산이 남았는지 점검(Kill-switch 사전 점검)." },
        { at: "killed = True", text: "예산이 모자라면 Kill-switch 작동 — C를 생략하고 부분 결과로 진행." },
      ],
      code: `# (일부 발췌) supervisor_node — Budget·검증·Loop Guard·Kill-switch 를 한 노드로 모음
def supervisor_node(state: dict) -> dict:
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

    notes: list[str] = []
    redispatch_count = state.get("redispatch_count", 0)
    killed = state.get("killed", False)

    # 1) Loop Guard + 부분 실패 재디스패치 (실패 단위가 있고, 재시도 여유·예산이 있을 때만)
    if failed_units and redispatch_count < settings.max_redispatch and budget.can_afford(len(failed_units)):
        redispatch_count += 1
        return {
            "failed_units": failed_units, "next_route": "redispatch",
            "redispatch_units": failed_units, "redispatch_count": redispatch_count,
            "budget_report": budget.report(), "supervisor_notes": notes,
        }

    # 2) MAS C 취합 분기 — 예산(Kill-switch) 점검 후 결정
    if state.get("needs_c") and ok_units:
        if budget.can_afford(1):
            return {"failed_units": failed_units, "next_route": "to_c",
                    "redispatch_count": redispatch_count, "budget_report": budget.report(),
                    "supervisor_notes": notes}
        # 예산 부족 → Kill-switch (C 생략, 부분 결과로 합성)
        killed = True
        notes.append("⛔ Kill-switch: 예산 부족으로 MAS C 취합 생략(부분 결과로 응답)")

    return {"failed_units": failed_units, "next_route": "compose", "killed": killed,
            "redispatch_count": redispatch_count, "budget_report": budget.report(),
            "supervisor_notes": notes}`,
    },
    {
      id: "run_mas_c_node",
      name: "run_mas_c_node()",
      fileId: "nodes",
      summary: "A∥B가 모은 컨텍스트를 합쳐 C팀(의견서 작성·검증) 워커에 주입 — fan-in 취합",
      how: "fan-in의 실제 동작을 보여주는 노드입니다. 성공한 A·B 분기의 context_items를 모두 모아 C팀의 provided_context로 넘깁니다(두 자료조사팀 결과를 작성팀에 합쳐 전달). C 호출도 타임아웃으로 감싸고, 실패하면 escalated=True로 표시해 사람 검토로 승급되게 합니다. 데모 토글(force_escalate)이 켜져 있으면 HITL 패널 시연을 위해 강제로 승급시킵니다.",
      terms: ["fan-in", "취합(aggregation)", "provided_context", "MAS C", "escalated(승급)", "HITL", "force_escalate"],
      lines: [
        { at: "provided_context: list = []", text: "A·B 결과를 모을 빈 바구니를 준비합니다." },
        { at: 'if result.get("ok") and result.get("unit") in ("A", "B"):', text: "성공한 A·B 분기만 골라 — 실패 팀 근거는 제외합니다." },
        { at: 'provided_context.extend(result.get("context_items", []))', text: "각 팀이 모은 근거를 하나의 컨텍스트로 합칩니다(fan-in 핵심)." },
        { at: "call_mas_c(state[\"question\"], _recent_history(state), provided_context),", text: "합친 컨텍스트를 C팀 워커에 주입해 의견서 작성·검증을 맡깁니다." },
        { at: "escalated = bool(res.get(\"escalated\")) or not res.get(\"ok\") or settings.force_escalate", text: "게이트 미통과·실패·데모토글이면 escalated 로 표시 → 글로벌 HITL 승급." },
        { at: 'return {"mas_c_result": res, "escalated": escalated,', text: "C 결과와 승급 여부를 State에 기록합니다." },
      ],
      code: `async def run_mas_c_node(state: dict) -> dict:
    """A∥B 의 검색 컨텍스트를 종합해 MAS C(의견서 작성·검증) 워커를 호출함(fan-in)."""
    # 성공 분기(A·B)의 context_items 를 모아 C의 provided_context 로 주입함
    provided_context: list = []
    for result in state.get("branch_results", []):
        if result.get("ok") and result.get("unit") in ("A", "B"):
            provided_context.extend(result.get("context_items", []))
    print(f"\\n[run_mas_c] A∥B 컨텍스트 {len(provided_context)}개 주입 → MAS C 호출")

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
    tokens = estimate_tokens(res.get("final_output", "") or res.get("draft", ""))
    return {"mas_c_result": res, "escalated": escalated,
            "spent_calls": [1], "spent_tokens": [tokens]}`,
    },
    {
      id: "compose_node",
      name: "compose_node()",
      fileId: "nodes",
      summary: "팀 결과를 최종 답변으로 합성하고 Supervisor 통제 메모(예산·열화·HITL)를 덧붙임",
      how: "맨 마지막 정리 노드입니다(일부 발췌). 의견서 경로면 C의 최종 출력을 본문으로 쓰되 반려된 초안이면 경고를 붙이고, 법령/동향 경로면 성공한 A·B 답변을 라벨 섹션으로 묶습니다. 사용자에게 정직한 사용량을 보이려고 C까지 포함한 예산을 다시 계산하고, 통제 메모(쓴 예산·부분 실패·HITL 승인 결과)를 본문 끝에 붙여 반환합니다.",
      terms: ["합성(compose)", "Budget", "통제 메모", "graceful degradation", "HITL"],
      lines: [
        { at: 'if state.get("needs_c"):', text: "의견서 경로인지 판단합니다." },
        { at: 'if mas_c.get("ok") and mas_c.get("final_output"):', text: "C가 성공했으면 그 최종 출력을 본문으로 씁니다." },
        { at: 'if state.get("approved") is False:', text: "사람이 반려한 초안이면 경고 문구를 먼저 붙입니다." },
        { at: "# 법령/동향 경로 — 성공 분기 답변을 라벨 섹션으로 합성", text: "법령/동향 경로는 성공한 A·B 답변을 라벨 섹션으로 묶습니다(인용 환각 방지)." },
        { at: "final_budget = WorkflowBudget(", text: "C까지 포함한 누적 예산을 다시 계산합니다(정직한 보고)." },
        { at: 'return {"final_answer": final, "budget_report": final_budget,', text: "최종 답변과 예산 리포트를 State에 기록해 사용자에게 반환합니다." },
      ],
      code: `# (일부 발췌) compose_node — 단위 결과 합성 + Supervisor 통제 메모 부착
def compose_node(state: dict) -> dict:
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

    # 최종 예산 리포트 재계산 — C까지 포함한 누적 호출수·토큰을 사용자에게 정직히 보여줌
    final_budget = WorkflowBudget(
        max_calls=settings.budget_max_calls, max_tokens=settings.budget_max_tokens,
        used_calls=sum(state.get("spent_calls", [])), used_tokens=sum(state.get("spent_tokens", [])),
    ).report()

    notes = _build_notes({**state, "budget_report": final_budget})
    final = "\\n\\n".join(p for p in parts if p).strip() or "죄송합니다. 답변을 생성하지 못했습니다."
    if notes:
        final = f"{final}\\n\\n---\\n{notes}"
    return {"final_answer": final, "budget_report": final_budget,
            "supervisor_notes": [notes] if notes else []}`,
    },

    {
      id: "direct_answer_node",
      name: "direct_answer_node()",
      fileId: "nodes",
      summary: "인사·잡담·특허 외 질문은 단위 MAS 없이 LLM 지식으로 바로 답변 — 불필요한 분산 호출 차단",
      how: "Scheduler가 '부를 팀이 없다(잡담)'고 판단했을 때 가는 지름길 노드입니다. A·B·C를 전혀 부르지 않고 LLM 한 번으로 친절히 답합니다. 왜 필요하냐면, '안녕하세요' 같은 인사에까지 비싼 분산 검색을 돌리면 시간·비용이 낭비되기 때문입니다(불필요한 호출 차단). 이전 대화 맥락을 프롬프트에 넣어 흐름을 잇고, 호출수 0회로 예산 리포트를 채워 사용자에게 정직하게 보여줍니다.",
      terms: ["direct_answer(직접 답변)", "노드(node)", "ChatPromptTemplate", "StrOutputParser", "Budget", "비동기(async/await)"],
      lines: [
        { at: "history_text = _format_history(_recent_history(state))", text: "이전 대화 맥락을 프롬프트에 넣을 텍스트로 만듭니다(흐름 유지)." },
        { at: '("human", "{question}"),', text: "사용자의 이번 질문을 프롬프트의 사람 메시지 자리에 넣습니다." },
        { at: "answer = (prompt | build_chat_llm(max_tokens=512) | StrOutputParser()).invoke(", text: "프롬프트→LLM→텍스트추출을 한 줄로 엮어(체인) 답변을 만듭니다." },
        { at: 'answer = f"답변 생성 중 오류가 발생했습니다: {type(error).__name__}"', text: "LLM 호출이 실패해도 죽지 않고 짧은 안내문으로 대체합니다." },
        { at: '"budget_report": {"used_calls": 0, "max_calls": settings.budget_max_calls},', text: "단위 MAS를 안 불렀으므로 호출수 0으로 예산 리포트를 채웁니다(정직한 보고)." },
      ],
      code: `async def direct_answer_node(state: dict) -> dict:
    """잡담·특허 외 질문은 단위 MAS 없이 LLM 지식으로 직접 답변함(불필요한 분산 호출 차단)."""
    print("\\n[direct_answer] 단위 MAS 미호출 → LLM 직접 답변")
    history_text = _format_history(_recent_history(state))
    prompt = ChatPromptTemplate.from_messages([
        ("system", "당신은 특허법 분산 MAS 챗봇입니다. 이번 질문은 검색이 필요 없는 인사·잡담이거나 "
                   "특허와 무관한 주제입니다. 이전 대화 맥락을 고려해 친절히 답하되, 필요하면 특허 관련 "
                   "질문을 안내하세요.\\n\\n## 이전 대화 맥락\\n{history}"),
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
            "supervisor_notes": []}`,
    },
    {
      id: "human_review_node",
      name: "human_review_node()",
      fileId: "nodes",
      summary: "글로벌 HITL 승인 지점 — interrupt_before로 이 노드 앞에서 그래프가 멈춰 사람 승인을 받음",
      how: "사람이 개입하는 단 하나의 '결재 게이트' 노드입니다. 노드 본체는 거의 비어 있는데, 핵심은 이 노드가 아니라 컴파일 때 붙인 interrupt_before=['human_review'] 설정입니다 — 그 설정 덕분에 그래프가 이 노드를 '실행하기 직전'에 멈춥니다. C가 자동 검증을 통과 못해 escalated가 되면 여기서 멈추고, 앱(또는 CLI)이 update_state로 approved 값을 써 넣은 뒤 재개하면 이 노드가 표식처럼 통과되고, 승인/반려 결과는 다음 compose 단계에서 반영됩니다.",
      terms: ["HITL", "interrupt_before", "interrupt(인터럽트)", "escalated(승급)", "update_state", "노드(node)"],
      lines: [
        { at: "interrupt_before=['human_review'] 로 실행 전 멈춤", text: "이 노드 '앞'에서 멈추게 하는 설정 — 멈춤의 실제 주체입니다." },
        { at: "기록한 뒤 재개하면 이 노드(표식)가 통과됨", text: "앱이 사람 승인 결과를 기록하고 재개하면 표식처럼 통과됩니다." },
        { at: "return {}", text: "노드 자체는 상태를 바꾸지 않음 — 멈춤은 interrupt_before가 담당합니다." },
      ],
      code: `def human_review_node(state: dict) -> dict:
    """글로벌 HITL 승인 지점. C가 게이트 미통과(escalated)면 이 앞에서 그래프가 멈춰 사람 승인을 받음.

    interrupt_before=['human_review'] 로 실행 전 멈춤 → 앱이 update_state 로 approved/feedback 을
    기록한 뒤 재개하면 이 노드(표식)가 통과됨. 승인 여부는 compose 분기에서 반영됨.
    """
    print(f"\\n[human_review] 글로벌 HITL 통과 — approved={state.get('approved')}")
    return {}`,
    },
    {
      id: "compose_helpers",
      name: "_combine_branch_answers() · _build_notes()",
      fileId: "nodes",
      summary: "compose 보조 헬퍼 — 성공 분기 답변을 라벨 섹션으로 묶고, 통제 결과를 사용자용 메모로 요약",
      how: "compose_node가 쓰는 두 도우미입니다. _combine_branch_answers는 성공한 A·B 답변을 '📘 법령 지식'·'🔎 선행기술·동향' 같은 라벨 섹션으로 묶되 본문은 단위 출력 그대로 보존합니다(LLM이 재작성하다 인용을 지어내는 환각 방지). _build_notes는 Supervisor의 통제 결과(쓴 예산·부분 실패·Kill-switch·HITL 승인 여부)를 사용자용 한 줄 메모로 요약해 답변 끝에 붙입니다.",
      terms: ["합성(compose)", "통제 메모", "graceful degradation", "인용 환각", "Budget", "Kill-switch"],
      lines: [
        { at: 'labels = {"A": "📘 법령 지식 (MAS A)", "B": "🔎 선행기술·동향 (MAS B)"}', text: "단위별로 보여줄 섹션 제목(라벨)을 정합니다." },
        { at: "single = len([u for u in ordered if by_unit.get(u)]) == 1", text: "성공한 팀이 하나뿐인지 따져 라벨 제목을 붙일지 정합니다." },
        { at: "if state.get(\"killed\"):", text: "Kill-switch가 작동했으면 '일부 단계 생략됨' 메모를 추가합니다." },
        { at: 'verdict = "승인됨" if state.get("approved") else ("반려됨" if state.get("approved") is False else "검토필요")', text: "HITL 승급 건은 사람 승인/반려 결과를 메모로 남깁니다." },
      ],
      code: `def _combine_branch_answers(state: dict) -> str:
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
            blocks.append(result["answer"] if single else f"## {header}\\n\\n{result['answer']}")
    return "\\n\\n".join(blocks)


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
    return "  \\n".join(lines)`,
    },

    // ───────────────────────── graph/supervisor.py ─────────────────────────
    {
      id: "budget",
      name: "WorkflowBudget · validate_branch()",
      fileId: "supervisor",
      summary: "거버넌스 순수 로직 — 예산 한도 점검(can_afford=Kill-switch)과 분기 출력 검증",
      how: "LangGraph에 의존하지 않는 '규칙'만 담은 순수 로직이라 테스트·이해가 쉽습니다. WorkflowBudget은 호출수(1차 기준)와 추정 토큰(보조)을 들고, can_afford(n)으로 'n번 더 호출해도 한도 안인지'를 점검합니다(Kill-switch 사전 점검). validate_branch는 팀 결과가 ok이고 본문이 비어있지 않은지를 결정적으로(LLM 없이) 검사해 실패 팀을 가려냅니다.",
      terms: ["Budget", "can_afford", "Kill-switch", "validate_branch", "출력 검증", "dataclass"],
      lines: [
        { at: "def can_afford(self, n_calls: int) -> bool:", text: "추가 n번 호출해도 호출수 한도를 넘지 않는지 — Kill-switch 사전 점검." },
        { at: "return (self.used_calls + n_calls) <= self.max_calls and self.used_tokens < self.max_tokens", text: "쓴 호출+추가분이 한도 이하이고 토큰도 남아야 True." },
        { at: 'if not result.get("ok"):', text: "워커가 ok=False(타임아웃·예외)면 실패로 판정합니다." },
        { at: 'body = result.get("answer") or result.get("final_output") or ""', text: "A·B는 answer, C는 final_output에서 본문을 꺼냅니다." },
        { at: 'return False, "빈 응답(본문 없음)"', text: "본문이 비어 있으면 실패로 판정(쓸 수 없는 결과)." },
      ],
      code: `# (일부 발췌) 거버넌스 순수 로직 — Budget 한도 점검 + 분기 출력 검증
@dataclass
class WorkflowBudget:
    max_calls: int = 8
    max_tokens: int = 120_000
    max_depth: int = 2
    used_calls: int = 0
    used_tokens: int = 0

    def can_afford(self, n_calls: int) -> bool:
        """추가로 n_calls 만큼 호출해도 호출수 한도를 넘지 않는지 (Kill-switch 사전 점검)."""
        return (self.used_calls + n_calls) <= self.max_calls and self.used_tokens < self.max_tokens


def validate_branch(result: dict) -> tuple[bool, str]:
    """단위 MAS 분기 결과의 사용 가능성을 구조적으로 검증함(LLM 미사용, 결정적)."""
    if not result.get("ok"):
        return False, result.get("error", "단위 MAS 호출 실패")
    # MAS A/B 는 answer, MAS C 는 final_output 에 본문이 담김
    body = result.get("answer") or result.get("final_output") or ""
    if not str(body).strip():
        return False, "빈 응답(본문 없음)"
    return True, "정상"`,
    },

    {
      id: "budget_methods",
      name: "Budget.can_proceed/record/report() · estimate_tokens()",
      fileId: "supervisor",
      summary: "예산 객체의 나머지 메서드 — 잔여 점검(can_proceed)·사용량 누적(record)·현황 요약(report)·토큰 추정",
      how: "WorkflowBudget이 거버넌스를 수행하는 데 쓰는 보조 메서드들입니다. can_proceed는 '아직 쓸 예산이 남았는지'(호출수·토큰 모두 한도 미만)를 봅니다. record는 분기가 끝날 때마다 쓴 호출수·토큰을 누적합니다. report는 'X/Y회, Z토큰' 같은 현황을 dict로 만들어 화면·로그에 보여줍니다(소진 여부 포함). estimate_tokens는 글자 수를 4로 나눠 토큰을 대략 추정합니다 — 정확치는 아니지만 비용 폭주를 막는 보조 지표로 충분합니다.",
      terms: ["Budget", "can_proceed", "record", "report", "estimate_tokens(토큰 추정)", "토큰(token)"],
      lines: [
        { at: "def can_proceed(self) -> bool:", text: "남은 예산이 있는지 — 호출수·토큰 모두 한도 미만일 때만 True." },
        { at: "def record(self, calls: int, tokens: int) -> None:", text: "분기 완료 후 쓴 호출수·토큰을 예산에 누적합니다." },
        { at: 'return {', text: "현재 예산 사용 현황을 dict로 모아 UI·로그에 보여줍니다(report)." },
        { at: '"exhausted": not self.can_proceed(),', text: "예산이 다 떨어졌는지(소진) 여부도 함께 담습니다." },
        { at: "def estimate_tokens(text: str) -> int:", text: "글자 수÷4로 토큰을 추정하는 보조 함수(정확치 아님)." },
        { at: "return max(1, len(text or \"\") // 4)", text: "빈 문자열도 최소 1토큰으로 봐 0 나눗셈·과소평가를 피합니다." },
      ],
      code: `# (일부 발췌) WorkflowBudget 의 보조 메서드 + 토큰 추정 함수
    def can_proceed(self) -> bool:
        """남은 예산이 있는지 (호출수·토큰 모두 한도 미만일 때만 True)."""
        return self.used_calls < self.max_calls and self.used_tokens < self.max_tokens

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
    return max(1, len(text or "") // 4)`,
    },

    // ───────────────────────── graph/state.py ─────────────────────────
    {
      id: "state",
      name: "OrchestratorState (reducer 키)",
      fileId: "state",
      summary: "공유 State 정의 — 병렬 분기가 동시에 쓰는 키를 reducer(operator.add)로 안전 병합(fan-in)",
      how: "그래프의 모든 노드가 함께 읽고 쓰는 '공유 그릇'입니다(일부 발췌). 핵심은 Annotated[list, operator.add] 표시입니다. A∥B 분기가 '동시에' branch_results 같은 같은 키에 결과를 쓰면 보통 충돌(경합)이 나는데, 이 표시를 붙이면 LangGraph가 두 결과를 리스트로 이어붙여(operator.add) 안전하게 병합합니다 — 이것이 fan-in의 기반입니다. supervisor_notes도 여러 노드가 누적하므로 같은 방식입니다.",
      terms: ["공유 State", "TypedDict", "Annotated", "reducer(operator.add)", "fan-in", "경합(race condition)"],
      lines: [
        { at: "branch_results: Annotated[list, operator.add]", text: "병렬 분기가 동시에 써도 리스트로 누적 병합되는 핵심 키(fan-in 기반)." },
        { at: "spent_calls: Annotated[list, operator.add]", text: "단위 호출 1건마다 [1]을 더해 Budget 호출수를 집계합니다." },
        { at: "spent_tokens: Annotated[list, operator.add]", text: "분기별 추정 토큰을 누적해 Budget 토큰 추정에 씁니다." },
        { at: "needs_c: bool", text: "MAS C 취합이 필요한지 — Scheduler가 정해 Supervisor가 참조합니다." },
        { at: "escalated: bool", text: "C가 게이트 미통과로 사람 검토(HITL)를 요청했는지 표시." },
        { at: "supervisor_notes: Annotated[list, operator.add]", text: "여러 노드가 남기는 통제 메모도 reducer로 누적 병합합니다." },
      ],
      code: `# (일부 발췌) OrchestratorState — 병렬 분기 결과를 reducer 로 누적 병합하는 공유 State
class OrchestratorState(TypedDict, total=False):
    # === 입력 ===
    question: str                    # 현재 사용자 질문
    history: list                    # 이전 대화 맥락 [{"role","content"}] (멀티턴)

    # === Scheduler 라우팅 결과 ===
    intent: str                      # INTENT_* 중 하나
    active_units: list               # 병렬 활성 단위 ["A","B"]
    needs_c: bool                    # MAS C 취합 필요 여부

    # === 병렬 분기 결과 (reducer=operator.add 로 누적 병합) ===
    branch_results: Annotated[list, operator.add]   # [{"unit","ok","answer","context_items",...}]
    spent_calls: Annotated[list, operator.add]      # 단위 호출 1건당 [1] 누적 (Budget 호출수 집계)
    spent_tokens: Annotated[list, operator.add]     # 분기별 추정 토큰 [n] 누적 (Budget 토큰 추정)

    # === MAS C 취합 / HITL ===
    mas_c_result: dict               # C 워커 결과 {final_output, gate_passed, escalated, ...}
    escalated: bool                  # C가 게이트 미통과로 HITL 승급을 요청했는지
    approved: Optional[bool]         # 사람 승인 결과 (None=미결정, True=승인, False=반려)

    # === 최종 출력 ===
    final_answer: str                # 사용자에게 보여줄 최종 합성 답변
    # 여러 노드가 누적하므로 reducer 로 병합
    supervisor_notes: Annotated[list, operator.add]`,
    },

    // ───────────────────────── clients/mas_a_client.py ─────────────────────────
    {
      id: "ask_patent_law",
      name: "ask_patent_law_async()",
      fileId: "clientA",
      summary: "MAS A를 MCP 클라이언트(Streamable HTTP)로 원격 호출 — 통신 방식 1: MCP",
      how: "A팀과의 통신 방식을 보여줍니다. MAS A는 별도 FastMCP 서버(:8010)로 떠 있고, 이 함수는 MCP 파이썬 SDK로 그 서버에 인터넷 연결(Streamable HTTP)을 열어 ask_patent_law라는 원격 도구를 호출합니다. 마치 '다른 건물의 전문가에게 전화로 일을 맡기는' 방식입니다. 비동기(async)라 A∥B 병렬에서 네트워크 대기 시간을 B와 겹칠 수 있습니다.",
      terms: ["MCP", "ClientSession", "streamablehttp_client", "원격 도구 호출", "structuredContent", "비동기(async/await)"],
      lines: [
        { at: "url = settings.mcp_a_url", text: "MAS A 서버의 /mcp 엔드포인트 주소를 가져옵니다(예: http://127.0.0.1:8010/mcp)." },
        { at: "async with streamablehttp_client(url) as (read, write, _):", text: "서버와 양방향 통신 채널(읽기·쓰기)을 엽니다." },
        { at: "await session.initialize()", text: "MCP 프로토콜 핸드셰이크로 세션을 시작합니다." },
        { at: 'call = await session.call_tool(', text: "원격 도구 ask_patent_law 를 인자와 함께 호출합니다." },
        { at: 'structured = getattr(call, "structuredContent", None) or {}', text: "도구가 돌려준 구조화 결과(dict)를 꺼냅니다(answer·sources 등)." },
      ],
      code: `async def ask_patent_law_async(question: str, mode: str = "auto") -> dict[str, Any]:
    """MAS A FastMCP 서버의 ask_patent_law 도구를 원격 호출하고 구조화 결과를 반환함.

    streamablehttp_client / ClientSession 동작:
      1. /mcp 엔드포인트로 Streamable HTTP 양방향 채널(read, write)을 엶
      2. session.initialize() 로 프로토콜 핸드셰이크 수행
      3. call_tool() 결과의 structuredContent 에 도구의 dict 반환값이 담겨 옴
    """
    url = settings.mcp_a_url
    async with streamablehttp_client(url) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            call = await session.call_tool(
                "ask_patent_law", {"question": question, "mode": mode}
            )
            # structuredContent: 도구가 반환한 dict (answer/resolved_mode/sources/evidence 등)
            structured = getattr(call, "structuredContent", None) or {}
            return structured`,
    },

    // ───────────────────────── clients/worker_client.py ─────────────────────────
    {
      id: "run_worker",
      name: "_run_worker_sync() · call_mas_b/c()",
      fileId: "clientBC",
      summary: "MAS B/C를 각 venv 파이썬 서브프로세스로 띄워 stdin UTF-8·stdout JSON 통신 — 통신 방식 2: 워커",
      how: "B·C팀과의 통신 방식입니다. A(MCP)와 달리, 각 팀의 전용 파이썬(venv)을 별도 프로그램(서브프로세스)으로 한 번 띄워 요청 JSON을 stdin으로 보내고 응답 JSON을 stdout으로 받습니다. 왜 분리하냐면 B와 C가 config·graph 같은 '같은 이름의 패키지'를 가져 한 프로세스에 함께 import하면 충돌하기 때문입니다. 블로킹 subprocess.run을 asyncio.to_thread로 워커 스레드에 보내 A∥B 병렬 대기를 겹칩니다. 실패는 예외 대신 ok=False로 정규화합니다.",
      terms: ["워커(worker)", "서브프로세스(subprocess)", "venv", "stdin/stdout JSON", "asyncio.to_thread", "UTF-8 인코딩", "JSON 직렬화"],
      lines: [
        { at: "payload = json.dumps(request, ensure_ascii=False)", text: "요청 dict를 한글 보존(ensure_ascii=False) JSON 문자열로 만듭니다." },
        { at: "[python_exe, str(script)],", text: "그 팀 전용 venv 파이썬으로 워커 스크립트를 실행합니다(의존성 격리)." },
        { at: 'encoding="utf-8",', text: "stdin/stdout을 UTF-8로 고정 — 부모·자식 인코딩을 일치시켜 한글 깨짐을 막습니다." },
        { at: "return json.loads(out)", text: "워커가 stdout으로 보낸 JSON 한 줄을 dict로 되돌립니다." },
        { at: "return await asyncio.to_thread(", text: "블로킹 호출을 워커 스레드로 보내 이벤트 루프를 막지 않음(A∥B 병렬 대기 겹침)." },
      ],
      code: `def _run_worker_sync(python_exe: str, script, request: dict, timeout: int, cwd) -> dict:
    """워커를 1회 기동해 JSON 요청을 stdin 으로 주고 stdout 의 JSON 응답을 파싱해 반환함(블로킹)."""
    payload = json.dumps(request, ensure_ascii=False)
    try:
        proc = subprocess.run(
            [python_exe, str(script)],
            input=payload,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            cwd=str(cwd),
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"worker timeout ({timeout}s)", "answer": "",
                "context_items": [], "final_output": ""}

    out = (proc.stdout or "").strip()
    if not out:
        tail = (proc.stderr or "")[-400:]
        return {"ok": False, "error": f"empty worker stdout (rc={proc.returncode})",
                "stderr_tail": tail, "answer": "", "context_items": [], "final_output": ""}
    try:
        return json.loads(out)
    except json.JSONDecodeError as error:
        return {"ok": False, "error": f"worker JSON parse error: {error}",
                "stdout_head": out[:200], "answer": "", "context_items": [], "final_output": ""}


async def call_mas_b(question: str, history: list, timeout: int | None = None) -> dict:
    """MAS B 워커를 비동기로 호출함 (선행기술·동향 리서치, Self-RAG)."""
    return await asyncio.to_thread(
        _run_worker_sync,
        settings.mas_b_python, settings.worker_b_script,
        {"question": question, "history": history},
        timeout or settings.timeout_mas_b, MAS_B_DIR,
    )`,
    },

    // ───────────────────────── workers/mas_b_worker.py ─────────────────────────
    {
      id: "worker_main",
      name: "mas_b_worker.main()",
      fileId: "workerB",
      summary: "격리 워커 진입점 — 진행 로그는 stderr로 돌리고 '최종 JSON만' stdout으로 보내 채널 오염 방지",
      how: "서브프로세스로 실행되는 B팀 워커의 본체입니다. 핵심 트릭은 '채널 분리'입니다. 단위 MAS가 진행 로그를 print하면 그게 stdout(JSON 채널)을 더럽혀 부모가 응답 파싱에 실패합니다. 그래서 그래프 실행 동안 sys.stdout을 stderr로 돌려놓고, 끝나면 '원래 stdout'에 최종 JSON 한 줄만 기록합니다. 어떤 실패도 예외로 죽지 않고 ok=False JSON으로 변환해 부모가 graceful 처리하게 합니다(파일 상단에서 stdin/stdout/stderr를 모두 UTF-8로 재설정).",
      terms: ["워커(worker)", "stdout 오염", "채널 분리", "stdin/stdout JSON", "UTF-8 인코딩", "JSON 직렬화"],
      lines: [
        { at: "real_stdout = sys.stdout", text: "최종 JSON을 쓸 '원래 stdout'을 따로 보관합니다." },
        { at: "sys.stdout = sys.stderr", text: "그래프 실행 동안 출력 채널을 stderr로 돌려 진행 로그가 JSON 채널을 더럽히지 않게 함." },
        { at: "raw = sys.stdin.read()", text: "부모가 보낸 요청 JSON 전체를 stdin에서 읽습니다." },
        { at: "response = _run(request)", text: "단위 MAS를 실행해 응답 dict를 만듭니다." },
        { at: "sys.stdout = real_stdout", text: "최종 JSON 기록 전에 출력 채널을 원래대로 복구합니다." },
        { at: "real_stdout.write(json.dumps(response, ensure_ascii=False))", text: "한글을 보존한 최종 JSON을 '원래 stdout'에 1회 기록합니다(부모가 이것만 파싱)." },
      ],
      code: `def main() -> int:
    """stdin 으로 들어온 JSON 요청을 처리하고 stdout 으로 JSON 응답 1줄을 기록함."""
    # 원래 stdout 을 보관하고, 그래프 실행 동안 출력 채널을 stderr 로 돌려 JSON 오염을 막음
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        raw = sys.stdin.read()  # EOF까지 전체를 읽어 1개 JSON으로 파싱함
        request = json.loads(raw) if raw and raw.strip() else {}
        response = _run(request)
    except Exception as error:  # noqa: BLE001 - 어떤 실패도 JSON 오류로 변환해 graceful 처리
        response = {
            "ok": False,
            "answer": "",
            "context_items": [],
            "error": f"{type(error).__name__}: {error}",
            "trace": traceback.format_exc()[-1500:],
        }
    finally:
        sys.stdout = real_stdout  # 최종 JSON 기록 전에 출력 채널 복구

    # ensure_ascii=False + UTF-8 stdout: 한글을 그대로 직렬화함 (양끝 모두 UTF-8 파이프로 일치)
    real_stdout.write(json.dumps(response, ensure_ascii=False))
    real_stdout.flush()
    return 0 if response.get("ok") else 1`,
    },

    // ───────────────────────── run_cli.py ─────────────────────────
    {
      id: "run_one",
      name: "run_one()",
      fileId: "cli",
      summary: "질의 1건을 실행하고 글로벌 HITL 인터럽트는 '자동 승인'으로 통과시켜 끝까지 구동",
      how: "검증 CLI가 질의 하나를 끝까지 굴리는 함수입니다. 그래프를 ainvoke로 실행한 뒤, get_state로 더 실행할 노드(snapshot.next)가 있는지 봅니다. 글로벌 HITL(human_review) 앞에서 멈췄으면 — 사람 대신 update_state로 approved=True를 기록하고 다시 ainvoke(None)으로 재개합니다. 멈춤이 없을 때까지 이 루프를 돌려 최종 상태를 돌려줍니다. 대화형 승인은 app.py가, 검증용 자동 승인은 여기가 담당합니다.",
      terms: ["HITL", "interrupt(인터럽트)", "ainvoke", "get_state", "update_state", "thread_id", "checkpointer"],
      lines: [
        { at: '"thread_id": str(uuid.uuid4())', text: "이 질의(턴)용 고유 식별자 — 턴마다 새로 만들어 작업 상태를 격리합니다." },
        { at: 'await graph.ainvoke({"question": question, "history": history or []}, config)', text: "질문과 대화 맥락을 넣어 그래프를 비동기로 1회 구동합니다." },
        { at: "snapshot = graph.get_state(config)", text: "현재 상태와 '다음에 실행할 노드'가 있는지 조회합니다." },
        { at: "if not snapshot.next:", text: "더 실행할 노드가 없으면(완료) 최종 상태를 돌려주고 끝냅니다." },
        { at: 'graph.update_state(config, {"approved": True, "review_feedback": ""})', text: "HITL에서 멈췄으면 사람 대신 자동 승인을 기록합니다(검증용)." },
        { at: "await graph.ainvoke(None, config)", text: "입력 None으로 인터럽트 지점부터 그래프를 재개합니다." },
      ],
      code: `async def run_one(graph, question: str, history: list | None = None) -> dict:
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
        await graph.ainvoke(None, config)`,
    },

    {
      id: "run_multiturn",
      name: "run_multiturn()",
      fileId: "cli",
      summary: "멀티턴 검증 러너 — 3턴 대화에서 history 누적과 후속 질의 맥락 라우팅을 자동 점검",
      how: "'대화 맥락이 제대로 이어지는지'를 확인하는 검증 코드입니다. 3턴짜리 시나리오를 차례로 돌리는데, 핵심은 매 턴 끝에 질문·답변을 history에 쌓아 다음 턴에 넘기는 것입니다. 그래서 3턴째 '방금 그 내용 더 자세히'처럼 맥락에 기댄 질문이 직전 주제(동향)로 올바로 라우팅되는지 봅니다. 각 턴은 run_one으로 실행하고, 의도가 기대와 맞고 답변이 비어있지 않으면 PASS로 집계해 마지막에 종합 판정합니다.",
      terms: ["멀티턴(multi-turn)", "검증 러너", "라우팅(routing)", "LLM 폴백", "HITL"],
      lines: [
        { at: "history: list = []", text: "대화 맥락을 빈 목록으로 시작해 턴마다 누적합니다." },
        { at: "state = await run_one(graph, question, history)", text: "이번 턴 질문과 '지금까지의 맥락'을 함께 넣어 실행합니다." },
        { at: 'history.append({"role": "user", "content": question})', text: "이번 질문을 맥락에 쌓습니다(다음 턴이 참조)." },
        { at: 'history.append({"role": "assistant", "content": answer})', text: "이번 답변도 맥락에 쌓아 후속 질의 해석에 씁니다." },
        { at: "verdicts.append((f\"T{turn}\", intent == expected_intent and bool(answer.strip())))", text: "의도 일치 + 답변 존재면 그 턴을 PASS로 기록합니다." },
        { at: "all_pass = all(ok for _, ok in verdicts) and len(history) == 2 * len(MULTITURN)", text: "모든 턴 PASS이고 history가 정확히 쌓였는지로 전체를 판정합니다." },
      ],
      code: `async def run_multiturn(graph) -> int:
    """멀티턴 대화에서 history 가 누적·전달되고, 맥락 의존 후속 질의가 직전 주제로 라우팅되는지 검증함."""
    print("\\n" + "=" * 72 + "\\n[멀티턴 검증] 3턴 대화 (history 누적 + 후속 질의 맥락 라우팅)")
    history: list = []
    verdicts: list[tuple[str, bool]] = []
    for turn, (question, expected_intent) in enumerate(MULTITURN, 1):
        print("\\n" + "#" * 72)
        print(f"# 턴 {turn}: {question}  (history {len(history)}개 전달)")
        print("#" * 72)
        state = await run_one(graph, question, history)
        intent, answer = state.get("intent"), state.get("final_answer", "")
        print(f"[턴 {turn}] intent={intent} (기대 {expected_intent}) units={state.get('active_units')} "
              f"method={state.get('route_method')}")
        print("-" * 72 + "\\n" + answer[:400] + ("..." if len(answer) > 400 else "") + "\\n" + "-" * 72)
        # 멀티턴 맥락 누적
        history.append({"role": "user", "content": question})
        history.append({"role": "assistant", "content": answer})
        verdicts.append((f"T{turn}", intent == expected_intent and bool(answer.strip())))

    print("\\n[멀티턴 종합]")
    for name, ok in verdicts:
        print(f"  {name} : {'PASS' if ok else 'FAIL'}")
    all_pass = all(ok for _, ok in verdicts) and len(history) == 2 * len(MULTITURN)
    print(f"  history 누적 {len(history)}개 / 전체: {'ALL PASS' if all_pass else 'FAIL'}")
    return 0 if all_pass else 1`,
    },

    // ───────────────────────── clients/mas_a_client.py (to_context_items) ─────────────────────────
    {
      id: "to_context_items",
      name: "to_context_items()",
      fileId: "clientA",
      summary: "MAS A 결과를 C가 쓸 컨텍스트({source,title,content,citation})로 변환 — 인용은 코드로 구성",
      how: "A팀이 돌려준 결과를 C팀이 근거로 쓸 수 있는 표준 형태로 바꾸는 함수입니다. A의 답변 본문 자체가 가장 응집된 법령 근거라 첫 항목으로 넣고, 개별 출처 스니펫을 뒤에 덧붙입니다. 핵심은 citation(인용 표기)을 LLM이 아니라 '코드에서 직접' 만든다는 점입니다 — 이렇게 해야 모델이 없는 조문을 지어내는 인용 환각을 막을 수 있습니다(단위 MAS와 동일 원칙).",
      terms: ["context_items", "provided_context", "citation(인용)", "인용 환각", "MAS C", "취합(aggregation)"],
      lines: [
        { at: "answer = result.get(\"answer\", \"\")", text: "A의 종합 답변 본문을 꺼냅니다(가장 응집된 근거)." },
        { at: '"title": "특허법 법령지식 종합",', text: "답변 본문을 첫 컨텍스트 항목으로 표준 형태에 담습니다." },
        { at: 'for src in result.get("sources", []) or []:', text: "개별 출처(조문 스니펫)를 하나씩 돌며 항목으로 추가합니다." },
        { at: "if not (title or snippet):", text: "제목·본문이 모두 빈 출처는 건너뜁니다(잡음 제거)." },
        { at: 'citation": f"- {title}" if title else "- 조문 근거(MAS A)",', text: "인용 표기를 코드로 직접 구성합니다 — 인용 환각 방지." },
      ],
      code: `def to_context_items(result: dict[str, Any]) -> list[dict]:
    """MAS A 결과를 MAS C 의 provided_context 형태({source,title,content,citation})로 변환함.

    A의 답변 본문 자체가 가장 응집된 법령 근거이므로 첫 항목으로 넣고, 개별 출처 스니펫을 뒤에 붙임.
    citation 은 코드에서 직접 구성해 인용 환각을 방지함(단위 MAS와 동일한 원칙).
    """
    items: list[dict] = []
    answer = result.get("answer", "")
    if answer:
        items.append({
            "source": "법령(MAS A)",
            "title": "특허법 법령지식 종합",
            "content": answer,
            "citation": "- 특허법 법령지식 MAS(MS GraphRAG + 조문 벡터 RAG)",
        })
    for src in result.get("sources", []) or []:
        title = src.get("title", "")
        snippet = src.get("snippet", "") or ""
        if not (title or snippet):
            continue
        items.append({
            "source": "법령(MAS A)",
            "title": title or "조문 근거",
            "content": snippet,
            "citation": f"- {title}" if title else "- 조문 근거(MAS A)",
        })
    return items`,
    },

    // ───────────────────────── app.py ─────────────────────────
    {
      id: "drive_to_completion",
      name: "_drive_to_completion()",
      fileId: "app",
      summary: "Streamlit에서 그래프를 끝까지 구동 — HITL 인터럽트를 만나면 승인 패널로 전환",
      how: "웹 챗봇이 그래프를 굴리는 함수입니다. CLI의 자동 승인과 달리, 글로벌 HITL에서 멈추면(snapshot.next가 있으면) 그 상태를 pending에 저장하고 화면을 다시 그려 사람이 보는 승인 패널을 띄웁니다. 사람이 승인/반려를 누르면 다른 함수가 그 결정을 기록하고 resume=True로 이 함수를 다시 불러 재개합니다. 완료되면 최종 답변을 대화 기록에 추가합니다.",
      terms: ["Streamlit", "HITL", "interrupt(인터럽트)", "get_state", "asyncio.run", "session_state", "rerun"],
      lines: [
        { at: "_ainvoke(graph, None if resume else inputs, config)", text: "재개면 None, 새 질문이면 inputs로 그래프를 1스텝 구동합니다." },
        { at: "snapshot = graph.get_state(config)", text: "구동 후 '다음에 실행할 노드'가 남았는지 조회합니다." },
        { at: "if snapshot.next:", text: "HITL(human_review) 앞에서 멈췄으면 — 사람 승인을 받기 위해 패널로 전환." },
        { at: 'st.session_state.pending = {"config": config, "values": snapshot.values}', text: "멈춘 상태를 저장해 두고(승인 패널이 이 초안을 보여줌)." },
        { at: 'answer = values.get("final_answer", "(응답 없음)")', text: "완료되면 최종 합성 답변을 꺼냅니다." },
        { at: 'st.session_state.messages.append({"role": "assistant", "content": answer})', text: "최종 답변을 대화 화면에 추가합니다." },
      ],
      code: `def _drive_to_completion(graph, config, resume: bool, inputs=None) -> None:
    """그래프를 끝까지 구동함. 글로벌 HITL 인터럽트를 만나면 pending 에 저장 후 패널로 넘김."""
    with st.spinner("단위 MAS 라우팅·실행·취합 중... (병렬 fan-out → 취합)"):
        _ainvoke(graph, None if resume else inputs, config)
        snapshot = graph.get_state(config)
        # interrupt_before(human_review)로 멈췄으면 사람 승인을 받기 위해 패널로 전환
        if snapshot.next:
            st.session_state.pending = {"config": config, "values": snapshot.values}
            st.rerun()

    # 완료 — 최종 답변을 대화에 기록
    values = graph.get_state(config).values
    answer = values.get("final_answer", "(응답 없음)")
    st.session_state.pending = None
    st.session_state.messages.append({"role": "assistant", "content": answer})
    st.session_state.history.append({"role": "assistant", "content": answer})
    st.rerun()`,
    },

    {
      id: "app_setup",
      name: "get_graph() · _ainvoke() · initialize_session_state()",
      fileId: "app",
      summary: "Streamlit 구동 헬퍼 — 그래프 1회 캐싱·비동기 1스텝 실행·세션 상태 초기화",
      how: "웹 챗봇이 매 상호작용마다 처음부터 다시 실행되는 Streamlit 위에서 그래프를 안전히 굴리기 위한 세 도우미입니다(일부 발췌). get_graph는 @st.cache_resource로 그래프를 '딱 한 번만' 컴파일해 재사용합니다(매번 재생성 방지). _ainvoke는 비동기 그래프를 스크립트 스레드에서 asyncio.run으로 1스텝 굴립니다(입력이 None이면 인터럽트 지점부터 재개). initialize_session_state는 화면 메시지·그래프용 history·HITL 대기상태(pending)를 재실행 사이에 유지되도록 준비합니다.",
      terms: ["Streamlit", "cache_resource(캐싱)", "asyncio.run", "1스텝 실행", "session_state", "interrupt(인터럽트)"],
      lines: [
        { at: "def get_graph():", text: "그래프를 1회 컴파일해 캐싱하는 함수(데코레이터가 재생성을 막음)." },
        { at: "asyncio.run(graph.ainvoke(inputs, config))", text: "비동기 그래프를 동기 스크립트에서 1스텝 실행합니다." },
        { at: 'if "pending" not in st.session_state:', text: "HITL 대기 상태 저장칸을 준비합니다(승급된 초안을 보관)." },
        { at: "st.session_state.pending = None          # HITL 대기 상태 {config, values}", text: "초기엔 대기 상태 없음(None)으로 둡니다." },
      ],
      code: `# (일부 발췌) Streamlit 구동 헬퍼 3종 (캐싱 · 비동기 1스텝 · 세션 초기화)
@st.cache_resource
def get_graph():
    """오케스트레이터 그래프를 1회 컴파일해 캐싱함 (체크포인터 포함)."""
    settings.ensure_api_keys()
    return build_graph()


def _ainvoke(graph, inputs, config) -> None:
    """비동기 그래프 1스텝 실행 — Streamlit 스크립트 스레드에서 asyncio.run 으로 구동함.

    inputs=None 이면 인터럽트 지점부터 재개함. (seam 검증으로 Windows 스레드+asyncio 안전 확인)
    """
    asyncio.run(graph.ainvoke(inputs, config))


def initialize_session_state() -> None:
    """Streamlit 재실행 사이에 유지할 상태 초기화."""
    # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
    if "messages" not in st.session_state:
        st.session_state.messages = []          # 화면 표시용 [{role, content}]
    if "history" not in st.session_state:
        st.session_state.history = []            # 그래프 전달용 [{role, content}]
    if "pending" not in st.session_state:
        st.session_state.pending = None          # HITL 대기 상태 {config, values}`,
    },
    {
      id: "render_review_panel",
      name: "render_review_panel()",
      fileId: "app",
      summary: "글로벌 HITL 승인 패널 — 승급된 의견서 초안을 사람이 보고 승인/반려하면 그래프 재개",
      how: "사람이 실제로 결재하는 화면입니다(_drive_to_completion이 멈춰서 넘긴 초안을 띄움). 게이트 미통과 사유와 초안을 보여 주고, 승인/반려 버튼을 그립니다. 사람이 버튼을 누르면 그 결정(approved)과 피드백을 update_state로 그래프에 써 넣고, _drive_to_completion(resume=True)로 인터럽트 지점부터 다시 굴려 마무리합니다. CLI의 '자동 승인'과 달리 여기서는 '사람의 클릭'이 승인 신호가 됩니다.",
      terms: ["HITL", "Streamlit", "interrupt(인터럽트)", "update_state", "escalated(승급)", "gate_passed(게이트 통과)"],
      lines: [
        { at: 'st.warning("🙋 글로벌 HITL: 의견서가 자동 검증 게이트를 통과하지 못해 사람 검토가 필요합니다.")', text: "왜 사람 검토가 필요한지 안내 배너를 띄웁니다." },
        { at: 'st.markdown(mas_c.get("draft") or mas_c.get("final_output") or "(초안 없음)")', text: "검토 대상인 C의 초안을 펼쳐 보여 줍니다." },
        { at: 'if col_ok.button("✅ 승인", use_container_width=True):', text: "사람이 승인 버튼을 누르면 approved=True가 됩니다." },
        { at: 'if col_no.button("✋ 반려", use_container_width=True):', text: "반려 버튼을 누르면 approved=False가 됩니다." },
        { at: 'graph.update_state(config, {"approved": approved, "review_feedback": feedback})', text: "사람 결정을 그래프 상태에 기록합니다(승인/반려+피드백)." },
        { at: "_drive_to_completion(graph, config, resume=True)", text: "인터럽트 지점부터 그래프를 재개해 최종 답변까지 마무리합니다." },
      ],
      code: `def render_review_panel() -> None:
    """글로벌 HITL 승인 패널 — C가 게이트 미통과로 승급된 초안을 사람이 검토·승인/반려함."""
    pending = st.session_state.pending
    values = pending["values"]
    mas_c = values.get("mas_c_result") or {}

    st.warning("🙋 글로벌 HITL: 의견서가 자동 검증 게이트를 통과하지 못해 사람 검토가 필요합니다.")
    st.caption(f"사유: {mas_c.get('gate_reason', '(미상)')}")
    with st.expander("검토 대상 초안 보기", expanded=True):
        st.markdown(mas_c.get("draft") or mas_c.get("final_output") or "(초안 없음)")

    feedback = st.text_input("반려 시 피드백(선택)", key="hitl_feedback")
    col_ok, col_no = st.columns(2)
    approved = None
    if col_ok.button("✅ 승인", use_container_width=True):
        approved = True
    if col_no.button("✋ 반려", use_container_width=True):
        approved = False

    if approved is not None:
        graph = get_graph()
        config = pending["config"]
        # 사람 결정을 기록하고 그래프를 재개 (인터럽트 → finalize 경로)
        graph.update_state(config, {"approved": approved, "review_feedback": feedback})
        _drive_to_completion(graph, config, resume=True)`,
    },

    // ───────────────────────── workers/mas_c_worker.py ─────────────────────────
    {
      id: "mas_c_worker",
      name: "mas_c_worker._run() · main()",
      fileId: "workerC",
      summary: "MAS C 격리 워커 — A∥B 컨텍스트 주입·C 내부 HITL 자동승인·인용검증 요약 반환(채널 분리)",
      how: "C팀을 별도 프로세스로 띄우는 진입점입니다(_run=실제 구동, main=stdin/stdout 입출력). _run은 부모가 준 provided_context(A∥B fan-in 결과)를 C에 넣어 자체 검색을 건너뛰게 하고, C 내부의 사람 승인 게이트는 여기서 '자동 승인'으로 통과시킵니다 — 실제 사람 승인은 상위 오케스트레이터 한 곳에만 두기 때문입니다(게이트 단일화). 결과는 인용검증 요약 등 메타까지 담아 돌려줍니다. main은 B 워커와 똑같이 진행 로그를 stderr로 돌리고 최종 JSON 한 줄만 stdout에 기록합니다(채널 분리).",
      terms: ["워커(worker)", "provided_context", "fan-in", "HITL", "자동 승인", "gate_passed(게이트 통과)", "채널 분리", "RECURSION_LIMIT"],
      lines: [
        { at: "provided_context = request.get(\"provided_context\", []) or []", text: "부모가 모아 준 A∥B 컨텍스트를 받습니다(있으면 C는 자체 수집 생략)." },
        { at: "agent.graph.invoke(initial, config)  # human_review 직전(interrupt_before)에서 멈춤", text: "C 그래프를 굴리면 사람 승인 직전에서 멈춥니다." },
        { at: 'agent.graph.update_state(config, {"approved": True, "review_feedback": ""})', text: "워커 단계의 승인은 자동 통과 — 실제 게이트는 상위에만 둡니다." },
        { at: '"escalated": bool(state.get("escalated")),', text: "C가 자동검증 미통과면 escalated=True로 상위에 승급을 알립니다." },
        { at: "sys.stdout = sys.stderr", text: "그래프 로그가 JSON 채널을 더럽히지 않게 출력을 stderr로 돌립니다(채널 분리)." },
        { at: "real_stdout.write(json.dumps(response, ensure_ascii=False))", text: "한글 보존 최종 JSON 한 줄만 원래 stdout에 기록합니다(부모가 이것만 파싱)." },
      ],
      code: `def _run(request: dict) -> dict:
    """요청 1건으로 MAS C 그래프를 끝까지 구동하고(HITL 자동 승인) 최종 상태를 dict로 반환함.

    C 그래프는 checkpointer + interrupt_before(['human_review'])로 컴파일되어 있어,
    사람 승인 직전에 멈춤. 워커는 update_state 로 '자동 승인'을 기록한 뒤 invoke(None)으로 재개함
    (mas-c/app.py 의 run_with_hitl 과 동일한 구동 방식, 승인 콜백만 자동화).
    """
    from config import settings
    from graph.workflow import PatentOpinionMAS, build_llm

    question = request.get("question", "")
    history = request.get("history", []) or []
    # 오케스트레이터가 A∥B fan-in 결과를 주입함. 있으면 C는 자체 MCP 수집을 건너뜀.
    provided_context = request.get("provided_context", []) or []

    agent = PatentOpinionMAS(build_llm())
    # thread_id: 이 요청의 체크포인트 식별자(요청마다 고유). recursion_limit 로 재작성 루프 여유 확보
    config = {"configurable": {"thread_id": str(uuid.uuid4())},
              "recursion_limit": settings.RECURSION_LIMIT}
    initial = agent.initial_state(question, history, provided_context)

    agent.graph.invoke(initial, config)  # human_review 직전(interrupt_before)에서 멈춤
    while True:
        snapshot = agent.graph.get_state(config)
        if not snapshot.next:            # 더 실행할 노드가 없으면 종료
            state = snapshot.values
            break
        # 워커 단계의 사람 승인은 자동 통과 — 실제 HITL 게이트는 상위 오케스트레이터가 가짐
        agent.graph.update_state(config, {"approved": True, "review_feedback": ""})
        agent.graph.invoke(None, config)

    report = state.get("citation_report") or {}
    return {
        "ok": True,
        "final_output": state.get("final_output", ""),
        "draft": state.get("draft", ""),
        "gate_passed": state.get("gate_passed"),
        "gate_reason": state.get("gate_reason", ""),
        "escalated": bool(state.get("escalated")),
        "is_supported": state.get("is_supported"),
        "retry_count": state.get("retry_count", 0),
        # 인용 검증 요약 (상위 Supervisor 출력 검증·UI 표시용)
        "citation_summary": {
            "verdict": ("판정불가" if report.get("ok") is None
                        else ("정상" if report.get("ok") else "환각탐지")),
            "total": report.get("total", 0),
            "errors": report.get("errors", 0),
            "hallucinated": report.get("hallucinated", []),
        },
        "dlp_findings_count": len(state.get("dlp_findings", [])),
        "context_items_count": len(state.get("context_items", [])),
    }


def main() -> int:
    """stdin JSON 요청을 처리하고 stdout 으로 JSON 응답 1줄을 기록함."""
    # 원래 stdout 을 보관하고, 그래프 실행 동안 출력 채널을 stderr 로 돌려 JSON 오염을 막음
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        raw = sys.stdin.read()  # EOF까지 전체를 읽어 1개 JSON으로 파싱함
        request = json.loads(raw) if raw and raw.strip() else {}
        response = _run(request)
    except Exception as error:  # noqa: BLE001 - 어떤 실패도 JSON 오류로 변환해 오케스트레이터가 graceful 처리하게 함
        response = {
            "ok": False,
            "final_output": "",
            "draft": "",
            "error": f"{type(error).__name__}: {error}",
            "trace": traceback.format_exc()[-1500:],
        }
    finally:
        sys.stdout = real_stdout  # 최종 JSON 기록 전에 출력 채널 복구

    real_stdout.write(json.dumps(response, ensure_ascii=False))
    real_stdout.flush()
    return 0 if response.get("ok") else 1`,
    },

    // ───────────────────────── config/settings.py ─────────────────────────
    {
      id: "settings_consts",
      name: "주요 설정 상수",
      fileId: "settings",
      summary: "단위 MAS venv 경로·MCP URL·Budget·타임아웃·Loop Guard 한도를 한곳에 모은 설정값",
      how: "코드 곳곳에서 settings.XXX로 참조하는 값을 한 파일에 모았습니다. _venv_python은 각 팀의 전용 파이썬(venv) 실행 파일 경로를 찾아 줍니다(분산의 핵심). Budget(호출수·토큰 상한), 타임아웃, Loop Guard 재시도 한도(max_redispatch), HITL 데모 토글(force_escalate)을 바꾸려면 여기만 고치면 됩니다.",
      terms: ["설정(settings)", "venv", "Budget", "타임아웃(timeout)", "Loop Guard", "force_escalate", "환경변수(env)"],
      lines: [
        { at: 'llm_model: str = "openai/gpt-oss-120b"', text: "Scheduler·합성·검증이 공통으로 쓰는 Groq LLM 모델." },
        { at: "budget_max_calls: int = 8", text: "한 요청 전체에서 단위 MAS를 부를 수 있는 총 호출수 상한(Budget 1차 기준)." },
        { at: "budget_max_tokens: int = 120_000", text: "추정 토큰 상한(보조 지표)." },
        { at: "timeout_mas_a: int = 180", text: "MAS A(MCP) 1회 호출 타임아웃(초)." },
        { at: "max_redispatch: int = 1", text: "실패 팀 재시도 최대 횟수 — Loop Guard(무한 재시도 방지)." },
        { at: "force_escalate: bool = False", text: "켜면 C 결과를 무조건 승급시켜 HITL 승인 패널을 시연(데모 토글, 기본 off)." },
      ],
      code: `# (일부 발췌) config/settings.py — 오케스트레이션 전역 설정
@dataclass
class Settings:
    # 단위 MAS별 venv 파이썬 경로 (서브프로세스 워커 기동에 사용)
    mas_b_python: str = field(default_factory=lambda: _venv_python(MAS_B_DIR))
    mas_c_python: str = field(default_factory=lambda: _venv_python(MAS_C_DIR))

    # === LLM (Groq LPU, 클라우드) ===
    llm_model: str = "openai/gpt-oss-120b"
    llm_temperature: float = 0.0       # 재현 가능한(결정적) 라우팅·검증 응답

    # === MAS A 통신 (MCP 클라이언트 — Streamable HTTP) ===
    mcp_a_host: str = "127.0.0.1"
    mcp_a_port: int = 8010             # mas-a/server.py 기본 바인딩 포트와 동일해야 함

    # === 글로벌 Budget (교재 §7.5 — Agent 폭주/예산 초과 완화) ===
    budget_max_calls: int = 8          # 단위 MAS 호출 총 횟수 한도 (A/B/C 합산)
    budget_max_tokens: int = 120_000   # 추정 토큰 한도 (응답 길이÷4 누적, 보조 지표)

    # === 계층적 타임아웃 (교재 §7.7) — 분기별 < 워크플로 ===
    timeout_mas_a: int = 180           # MAS A(MCP) 1회 호출 타임아웃(초)
    timeout_mas_b: int = 240           # MAS B(워커) 1회 호출 타임아웃(초)

    # === Loop Guard (교재 §7.3) ===
    max_redispatch: int = 1            # 부분 실패 시 재디스패치 최대 횟수 (무한 재시도 방지)

    # === HITL 데모/검증용 토글 (기본 off) ===
    force_escalate: bool = False       # True 면 C 결과를 무조건 escalated 로 표시(HITL 시연)`,
    },

    // ───────────────────────── config/llm.py ─────────────────────────
    {
      id: "build_llm",
      name: "build_chat_llm() · build_structured_llm()",
      fileId: "llm",
      summary: "Groq LLM 팩토리 — 추론모델 reasoning_format='hidden' + json_schema 구조화 출력 규칙",
      how: "Scheduler 분류, 잡담 답변, 의도 분류 폴백이 모두 같은 규칙으로 모델을 만들게 모은 팩토리입니다. gpt-oss 계열 추론 모델에는 reasoning_format='hidden'을 붙여 사고 과정을 숨기고 최종 답만 받습니다. build_structured_llm은 with_structured_output(method='json_schema')로 '정해진 키를 가진 JSON'을 강제해 자연어 파싱의 불안정을 없앱니다. max_tokens를 넉넉히 둬 추론 토큰 소진으로 JSON이 잘리는 실측 오류를 피합니다.",
      terms: ["ChatGroq", "reasoning_format(hidden)", "with_structured_output", "json_schema", "구조화 출력", "팩토리(factory)"],
      lines: [
        { at: '"model": settings.llm_model,', text: "설정의 Groq 모델(gpt-oss-120b)로 채팅 LLM을 구성합니다." },
        { at: '"max_retries": settings.llm_max_retries,', text: "Groq 일시 오류(429/503)에 지수 백오프 재시도를 둡니다." },
        { at: 'if "gpt-oss" in settings.llm_model:', text: "gpt-oss 계열일 때만 reasoning_format을 붙입니다(다른 모델엔 부작용 가능)." },
        { at: 'kwargs["reasoning_format"] = settings.llm_reasoning_format', text: "추론 과정을 숨기고 최종 텍스트만 받게 설정합니다." },
        { at: 'return build_chat_llm(max_tokens=2048).with_structured_output(schema, method="json_schema")', text: "json_schema로 정해진 키의 JSON 출력을 강제하는 구조화 LLM을 만듭니다." },
      ],
      code: `def build_chat_llm(*, max_tokens: int | None = None,
                   temperature: float | None = None) -> ChatGroq:
    """Groq LPU에 연결된 ChatGroq 인스턴스를 생성함."""
    kwargs: dict[str, Any] = {
        "model": settings.llm_model,
        "api_key": settings.groq_api_key,
        "temperature": settings.llm_temperature if temperature is None else temperature,
        # Groq 일시 오류(429/503)에 지수 백오프 재시도
        "max_retries": settings.llm_max_retries,
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    # gpt-oss 계열에만 reasoning_format을 전달함 (다른 모델에 넣으면 무시되거나 오류)
    if "gpt-oss" in settings.llm_model:
        kwargs["reasoning_format"] = settings.llm_reasoning_format
    return ChatGroq(**kwargs)


def build_structured_llm(schema: Any):
    """구조화 출력 전용 LLM — with_structured_output(method="json_schema").

    의도 분류 결과·출력 검증 판정처럼 '정해진 키를 가진 JSON'을 안정적으로 받아야 할 때 사용함.
    """
    return build_chat_llm(max_tokens=2048).with_structured_output(schema, method="json_schema")`,
    },
  ],

  glossary: {
    "StateGraph": "LangGraph에서 노드(작업)와 엣지(이동)로 작업 흐름을 그리는 상태 기반 그래프(설계도).",
    "노드(node)": "그래프에서 하나의 작업 단위. 여기선 scheduler·run_unit·supervisor 등 각 처리 단계.",
    "엣지(edge)": "한 노드에서 다음 노드로 이동하는 화살표(연결선).",
    "조건부 엣지": "상황(state)에 따라 다음에 갈 노드를 골라 주는 분기 화살표. 분기 함수가 목적지를 결정함.",
    "컴파일(compile)": "그래프 설계도를 실제로 실행 가능한 객체로 굳히는 단계.",
    "checkpointer": "그래프 실행 도중 상태를 저장하는 장치. 인터럽트 후 재개·멀티턴 상태 유지에 씀.",
    "interrupt_before": "특정 노드를 실행하기 '직전'에 그래프를 멈추는 설정. 여기선 human_review 앞에서 멈춰 사람 승인을 기다림.",
    "interrupt(인터럽트)": "그래프가 도중에 멈춰 외부 입력(사람 승인 등)을 기다리는 것.",
    "Send API": "LangGraph에서 한 노드를 여러 입력으로 '동시에' 펼쳐 실행하도록 보내는 장치. fan-out의 핵심.",
    "fan-out": "하나의 작업을 여러 워커에 부채살처럼 병렬로 나눠 보내는 것.",
    "fan-in": "병렬로 흩어져 처리된 결과를 다시 한곳으로 모으는 것.",
    "병렬(parallel)": "여러 작업을 동시에 진행하는 것. 대기 시간이 겹쳐 전체가 빨라짐.",
    "superstep": "LangGraph가 병렬 분기들을 한 묶음으로 동시에 처리하는 한 단계.",
    "분기(branch)": "병렬로 펼쳐진 각각의 작업 흐름 갈래(예: A 분기, B 분기).",
    "reducer(operator.add)": "병렬 분기가 같은 State 키에 동시에 쓸 때 충돌 없이 리스트로 이어붙여 합치는 병합 규칙.",
    "공유 State": "그래프 모든 노드가 함께 읽고 쓰는 데이터 그릇. 노드 간 조율은 이 State로만 함.",
    "TypedDict": "키마다 타입을 정해 둔 딕셔너리 형태. 여기선 State 구조 정의에 씀.",
    "Annotated": "타입에 부가 정보(여기선 reducer 병합 규칙)를 덧붙이는 파이썬 타입 표기.",
    "경합(race condition)": "여러 작업이 같은 자료를 동시에 고쳐 결과가 꼬이는 문제. reducer가 이를 막음.",
    "의도 분류(intent)": "사용자 질문이 무엇을 원하는지(법령·동향·의견서·잡담) 가려내는 것.",
    "라우팅(routing)": "분류된 의도에 따라 어느 팀(노드)으로 보낼지 길을 정하는 것.",
    "패턴 매칭": "미리 정한 키워드·정규식이 질문에 있는지 맞춰 보는 방식. 빠르고 비용이 낮음.",
    "LLM 폴백": "1차 방식(패턴)이 애매할 때 보조로 LLM에게 판단을 맡기는 것.",
    "RouteDecision": "Scheduler가 내린 결정(의도·활성 팀·C 필요 여부·근거)을 담는 자료 묶음.",
    "정규식(re)": "글자 패턴을 규칙으로 표현해 찾는 도구. 파이썬 표준 모듈 re.",
    "Supervisor": "병렬 결과를 검증하고 예산·재시도·다음 길을 정하는 감독관 노드(글로벌 통제).",
    "Budget": "한 요청에서 쓸 수 있는 호출수·토큰의 상한. 비용 폭주를 막는 거버넌스 장치.",
    "Kill-switch": "예산이 모자라면 다음 단계를 즉시 생략·중단하는 긴급 차단 장치.",
    "Loop Guard": "실패 재시도를 정해진 횟수로 제한해 무한 반복을 막는 장치.",
    "재디스패치(redispatch)": "실패한 팀에게만 작업을 다시 보내 재시도하는 것(Loop Guard 한도 안에서).",
    "can_afford": "추가 n번 호출해도 예산 한도를 넘지 않는지 미리 점검하는 함수(Kill-switch 판단 근거).",
    "validate_branch": "팀 결과가 쓸 만한지(ok·본문 존재) LLM 없이 결정적으로 검사하는 함수.",
    "출력 검증": "각 팀 결과가 사용 가능한 형태인지 구조적으로 판정하는 것.",
    "graceful degradation": "일부 팀이 실패해도 멈추지 않고 부분 결과로 진행하며 사용자에게 안내하는 것.",
    "dataclass": "필드를 간결히 선언하는 파이썬 클래스 데코레이터. 설정·예산 객체에 씀.",
    "MCP": "Model Context Protocol. AI 도구를 원격 서버로 노출하고 클라이언트가 표준 방식으로 호출하는 규약.",
    "ClientSession": "MCP 클라이언트가 서버와 주고받는 한 세션을 다루는 객체.",
    "streamablehttp_client": "MCP를 Streamable HTTP(스트리밍 가능한 HTTP)로 연결하는 전송 계층 함수.",
    "원격 도구 호출": "다른 프로세스·서버에 있는 함수(도구)를 네트워크로 불러 실행하는 것.",
    "structuredContent": "MCP 도구가 돌려준 구조화 결과(dict). 여기에 answer·sources 등이 담김.",
    "워커(worker)": "오케스트레이터가 외부 프로세스로 띄워 일을 시키는 단위 MAS 실행기(B·C).",
    "서브프로세스(subprocess)": "지금 프로그램이 별도로 띄우는 또 다른 프로그램(자식 프로세스).",
    "venv": "파이썬 가상환경. 프로젝트마다 의존성을 격리해 충돌을 막는 별도 파이썬 공간.",
    "stdin/stdout JSON": "표준입력으로 요청 JSON을 주고 표준출력으로 응답 JSON을 받는 프로세스 간 통신 방식.",
    "stdout 오염": "응답 JSON 채널(stdout)에 진행 로그 같은 다른 글이 섞여 파싱이 깨지는 문제.",
    "채널 분리": "로그는 stderr로, 결과 JSON은 stdout으로 분리해 오염을 막는 기법.",
    "asyncio.to_thread": "블로킹(기다리는) 함수를 별도 스레드로 보내 이벤트 루프를 막지 않게 하는 비동기 도구.",
    "asyncio.wait_for": "코루틴에 제한 시간을 걸어 초과하면 끊는 비동기 타임아웃 도구.",
    "타임아웃(timeout)": "정해진 시간을 넘으면 호출을 끊어 무한 대기를 막는 제한.",
    "계층적 타임아웃": "분기별 타임아웃 < 워크플로 전체처럼 단계마다 시간 한도를 겹겹이 두는 것.",
    "비동기(async/await)": "기다리는 동안 다른 일을 처리하게 하는 파이썬 동시성 문법. 병렬 대기를 겹치게 함.",
    "토큰(token)": "LLM이 글을 처리하는 최소 단위 조각. 비용·길이 추정의 기준.",
    "UTF-8 인코딩": "한글 등 모든 문자를 안전히 표현하는 표준 문자 인코딩. 부모·자식 인코딩을 맞춰 깨짐을 막음.",
    "JSON 직렬화": "딕셔너리 등을 저장·전송 가능한 JSON 문자열로 바꾸는 것. ensure_ascii=False로 한글 보존.",
    "MAS C": "의견서 작성·검증 단위 MAS. A·B가 모은 근거를 받아 초안 작성·인용 검증을 수행함.",
    "취합(aggregation)": "여러 팀의 결과를 한데 모아 다음 단계 입력으로 합치는 것(fan-in).",
    "provided_context": "오케스트레이터가 A∥B 근거를 모아 C에 미리 넣어 주는 컨텍스트.",
    "escalated(승급)": "C가 자동검증을 통과 못해 사람 검토(HITL)로 끌어올려진 상태.",
    "force_escalate": "C를 무조건 승급시켜 HITL 패널을 시연·검증하기 위한 데모 토글(기본 off).",
    "HITL": "Human-In-The-Loop. 자동 흐름 중간에 사람이 승인·반려로 개입하는 안전장치.",
    "ainvoke": "그래프를 비동기로 1회 실행하는 LangGraph 메서드.",
    "get_state": "현재 그래프 상태와 '다음에 실행할 노드'가 있는지 조회하는 메서드.",
    "update_state": "그래프 상태에 값을 써 넣는 메서드. 여기선 사람 승인 결과(approved)를 기록함.",
    "thread_id": "대화·요청을 구분하는 체크포인트 식별자. 턴마다 새로 만들어 작업 상태를 격리함.",
    "Streamlit": "파이썬으로 웹 UI를 빠르게 만드는 프레임워크. 여기선 챗봇 화면에 씀.",
    "asyncio.run": "비동기 코루틴을 동기 코드에서 끝까지 실행해 주는 진입 함수.",
    "session_state": "Streamlit이 브라우저 탭이 열린 동안 데이터를 유지하는 저장소.",
    "rerun": "Streamlit이 스크립트를 처음부터 다시 실행해 화면을 새로 그리는 것.",
    "합성(compose)": "여러 팀 결과를 하나의 최종 답변으로 묶어 정리하는 것.",
    "통제 메모": "Supervisor 통제 결과(예산·부분 실패·HITL 승인)를 사용자용 한 줄로 요약한 안내.",
    "설정(settings)": "경로·모델·예산·타임아웃 등 값을 한곳에 모은 설정 모음.",
    "환경변수(env)": "운영체제·.env 파일에 두는 설정값. 코드 수정 없이 동작을 바꿀 때 씀.",
    "ChatGroq": "Groq LPU의 채팅 모델을 LangChain에서 쓰게 해 주는 래퍼.",
    "reasoning_format(hidden)": "gpt-oss 추론 모델의 사고 과정을 숨기고 최종 답만 받게 하는 설정.",
    "with_structured_output": "LLM 출력을 정해진 스키마(키 구조)에 맞춰 받게 강제하는 LangChain 기능.",
    "json_schema": "with_structured_output의 한 방식. JSON 스키마를 모델에 강제해 안정적으로 유효 JSON을 받음.",
    "구조화 출력": "자유 문장이 아니라 정해진 키를 가진 JSON 형태로 받는 LLM 출력.",
    "팩토리(factory)": "같은 규칙으로 객체(여기선 LLM)를 만들어 주는 생성 함수.",
    "direct_answer(직접 답변)": "검색이 필요 없는 인사·잡담·특허 외 질문을 단위 MAS 없이 LLM 지식만으로 바로 답하는 경로.",
    "ChatPromptTemplate": "system·human 등 역할별 메시지로 LLM 프롬프트를 조립하는 LangChain 템플릿.",
    "StrOutputParser": "LLM 응답 객체에서 순수 텍스트 문자열만 뽑아 주는 LangChain 출력 파서.",
    "can_proceed": "남은 예산이 있는지(호출수·토큰 모두 한도 미만인지) 보는 함수. 예산 소진(exhausted) 판정에 씀.",
    "record": "분기 완료 후 사용한 호출수·토큰을 예산 객체에 누적해 더하는 메서드.",
    "report": "현재 예산 사용 현황(쓴 호출/한도·쓴 토큰/한도·소진 여부)을 dict로 요약해 UI·로그에 보여주는 메서드.",
    "estimate_tokens(토큰 추정)": "문자열 길이를 4로 나눠 대략의 토큰 수를 추정하는 함수. 정확치는 아니고 Budget 보조 지표용.",
    "라우터 함수": "조건부 엣지에 연결돼 현재 State를 보고 다음에 갈 노드(목적지)를 골라 돌려주는 분기 함수.",
    "Few-shot": "예시 몇 개를 프롬프트에 넣어 LLM이 원하는 형식·기준으로 답하도록 유도하는 방식.",
    "IntentDecision": "LLM 폴백 분류 결과(의도·활성 단위·C 필요 여부·근거)를 담는 구조화 출력 스키마.",
    "안전 폴백": "분류·호출이 실패해도 그래프가 죽지 않도록 미리 정한 기본값(여기선 A 단독)으로 빠지는 처리.",
    "멀티턴(multi-turn)": "여러 번 주고받는 대화. 이전 대화 맥락(history)을 누적해 후속 질의를 직전 주제로 해석함.",
    "검증 러너": "기대 결과가 정해진 시나리오들을 자동 실행하고 결과가 기대와 맞는지 PASS/FAIL로 집계하는 코드.",
    "context_items": "단위 MAS가 모은 근거 조각 목록({source,title,content,citation}). C의 provided_context로 재사용됨.",
    "citation(인용)": "답변 근거가 된 출처 표기. 코드에서 직접 구성해 LLM이 지어내는 인용 환각을 막음.",
    "인용 환각": "LLM이 실제로 없는 출처·조문을 그럴듯하게 지어내는 현상. 인용을 코드로 구성해 방지함.",
    "cache_resource(캐싱)": "Streamlit에서 비싼 객체(그래프·LLM)를 앱 시작 시 1회만 만들어 재실행마다 재사용하게 하는 데코레이터.",
    "1스텝 실행": "그래프를 끝까지가 아니라 인터럽트(멈춤 지점)까지만 한 번 굴리는 것. 멈추면 사람 입력을 기다림.",
    "gate_passed(게이트 통과)": "C의 자동 검증 게이트(인용 검증 등)를 통과했는지 여부. 미통과면 escalated로 사람 검토에 올림.",
    "RECURSION_LIMIT": "그래프가 노드를 도는 최대 횟수 상한. 재작성 루프 등이 무한히 돌지 않게 막는 안전값.",
    "_score(점수화)": "스케줄러가 의도 키워드(법령·동향·잡담)가 질문에 몇 번 등장하는지 정규식으로 세어 점수를 매기는 내부 함수. 점수 우위가 분명하면 LLM 없이 빠르게 라우팅함.",
    "자동 승인": "비대화형/워커 실행에서 사람 승인(HITL) 게이트를 자동으로 통과시키는 것. 실제 사람 승인은 상위 오케스트레이터 한 곳에만 두므로, 단위 워커의 승인 단계는 자동 통과시켜 게이트를 단일화함.",
  },
};
