window.EXPLAIN_DATA = {
  meta: {
    title: "법령지식 MAS (MAS A) — 조문 벡터 RAG + MS GraphRAG 융합 검색을 FastMCP로 노출",
    entry: "server.py",
  },

  // 좌측 그룹 = 파일 (진입점 → SAS 워크플로 → 검색기 → 설정)
  files: [
    { id: "server",   label: "server.py",                      role: "FastMCP 서버 진입점 — 특허법 검색을 MCP 도구/리소스/프롬프트로 외부에 노출" },
    { id: "cli",      label: "search_cli.py",                  role: "CLI 진입점 — 서버 없이 커맨드라인에서 SAS 워크플로를 즉시 실행·확인(학습·디버깅용)" },
    { id: "graph",    label: "mas/graph.py",                   role: "SAS 워크플로 조립 — LangGraph로 Scheduler→Agent→Supervisor→Fuse를 연결한 진입 클래스" },
    { id: "nodes",    label: "mas/nodes.py",                   role: "SAS 노드 4종 구현 — 라우팅·검색·충분성 평가·융합을 담당하는 일꾼 함수들" },
    { id: "router",   label: "mas/router.py",                  role: "Scheduler 라우터 — 질문을 보고 어떤 검색 모드를 쓸지 결정(패턴 + LLM 폴백)" },
    { id: "vector",   label: "retrieval/vector_retriever.py",  role: "조문 벡터 RAG 검색기 — ChromaDB patent_law에서 조문 원문을 정밀 인용" },
    { id: "graphrag", label: "retrieval/graphrag_retriever.py",role: "MS GraphRAG 검색기 — 요건·권리·절차의 관계/구조를 질의(local/global/drift)" },
    { id: "async",    label: "retrieval/async_utils.py",       role: "이벤트 루프 브리지 — 동기 코드에서 async GraphRAG API를 안전하게 호출" },
    { id: "config",   label: "config/settings.py",             role: "전역 설정 — 인덱스 경로·모델·검색 파라미터·키 검증을 한곳에서 관리" },
    { id: "llm",      label: "config/llm.py",                  role: "LLM 공용 팩토리 — 라우팅·답변·평가가 같은 방식으로 Groq LLM(일반/구조화 출력)을 생성" },
  ],

  // 전체 처리 흐름 (MCP 진입 → 라우팅 → 검색 → 평가 → (필요 시 보완·융합) → 응답)
  flow: [
    {
      step: 1,
      title: "분산 MAS의 한 축 — MCP 서버로 노출",
      label: "MCP 서버로 노출",
      refs: ["ask_patent_law"],
      summary: "server.py: 특허법 검색 능력을 ask_patent_law 도구로 외부에 공개",
      detail: "이 예제는 '법령지식'을 전담하는 하나의 전문가 부서입니다. FastMCP로 검색 능력을 표준 규격(MCP)에 맞춰 노출하면, 상위 오케스트레이터나 다른 AI 앱이 마치 콘센트에 플러그를 꽂듯 이 부서를 호출할 수 있습니다. 비유하면 '특허법 상담 창구를 인터넷에 열어 두는' 단계로, 여러 부서가 모이는 분산 멀티에이전트의 한 축이 됩니다.",
    },
    {
      step: 2,
      title: "검색 모드 결정 (Scheduler)",
      label: "검색 모드 결정",
      refs: ["router_route"],
      summary: "scheduler_node → router.route(): 질문에 맞는 검색 방식 1개를 고름",
      detail: "질문을 받으면 먼저 '어떤 방법으로 찾을지'를 정합니다. 조문 원문을 정확히 인용해야 하면 벡터 검색(vector), 요건·권리의 관계를 봐야 하면 GraphRAG(local/global/drift)를 고릅니다. 키워드 규칙으로 먼저 판단하고 애매하면 LLM에게 분류를 맡깁니다. 비유하면 '민원을 보고 어느 창구로 보낼지 정하는 안내 데스크'입니다.",
    },
    {
      step: 3,
      title: "검색 실행 (Agent)",
      label: "검색 실행",
      refs: ["agent_node", "vector_search", "graphrag_search_async"],
      summary: "agent_node: 결정된 모드로 실제 검색을 수행해 답변·근거를 만듦",
      detail: "안내받은 한 가지 방법으로 실제 검색을 수행합니다. vector면 ChromaDB에서 비슷한 조문 청크를 찾아 LLM이 조문을 인용해 답하고, GraphRAG면 지식그래프(엔티티·관계·커뮤니티)를 질의합니다. 한 패스에서는 딱 한 가지 방법만 씁니다(두 방법을 무조건 동시에 돌리지 않음 = 중복 검색 금지).",
    },
    {
      step: 4,
      title: "근거 충분성 평가 (Supervisor)",
      label: "근거 충분성 평가",
      refs: ["supervisor_node"],
      summary: "supervisor_node: 답이 충분한지 LLM이 보수적으로 판정 → 종료/재검색/융합 분기",
      detail: "검색 결과가 질문에 충분히 답했는지 감독자가 점검합니다. 충분하면 마무리하고, 부족하면 '서로 다른 역할의 보완 모드'(예: 벡터로 부족했으면 GraphRAG)로 딱 한 번 더 검색하도록 지시합니다. 무한 반복을 막는 한도(Loop Guard)가 있어 안전합니다. 비유하면 '상담 결과를 검토해 미흡하면 다른 전문가에게 한 번 더 묻는 팀장'입니다.",
    },
    {
      step: 5,
      title: "두 근거 융합 (Fuse)",
      label: "두 근거 융합",
      refs: ["fuse_node"],
      summary: "fuse_node: 조문 원문(vector) + 관계/구조(GraphRAG) 두 답변을 하나로 종합",
      detail: "보완 검색까지 두 번 돌았다면, 조문 원문 근거와 관계/구조 근거를 하나의 모순 없는 한국어 답변으로 합칩니다. 이것이 이 MAS의 핵심 가치입니다 — 정밀한 조문 인용(벡터)과 넓은 맥락(그래프)을 합쳐 더 정확한 자문을 만듭니다. 비유하면 '두 전문가 소견서를 하나의 결론으로 정리하는' 단계입니다.",
    },
    {
      step: 6,
      title: "MCP 응답 정리 & 반환",
      label: "응답 정리·반환",
      summary: "_shape_tool_result(): 답변·사용 모드·근거를 간결한 JSON으로 호출자에게 돌려줌",
      detail: "최종 답변과 함께 '어떤 모드를 왜 골랐는지, 충분성 평가가 어땠는지, 근거 출처는 무엇인지'를 정리해 돌려줍니다. 대용량 원문은 짧은 스니펫으로 줄여 LLM 컨텍스트 비용을 아낍니다. 호출하는 쪽이 결과를 신뢰·추적할 수 있도록 처리 과정을 투명하게 노출하는 단계입니다.",
    },
  ],

  functions: [
    // ───────────────────────── server.py ─────────────────────────
    {
      id: "ask_patent_law",
      name: "ask_patent_law()",
      fileId: "server",
      summary: "특허법 질문을 받아 SAS 워크플로로 검색·답변하는 MCP 도구(분산 MAS의 공개 진입점)",
      how: "@mcp.tool()로 등록되어 외부에서 호출 가능한 함수입니다. 질문과 모드를 받아 PatentLawMAS의 answer()를 호출하면, 내부에서 라우팅→검색→평가→(필요 시 융합)이 일어납니다. 동기 함수로 둔 것이 핵심입니다 — FastMCP가 동기 도구를 워커 스레드에서 호출하고, 그 안에서 async GraphRAG가 안전하게 돌게 하기 위함입니다(async로 바꾸면 이벤트 루프 브리지가 깨짐).",
      terms: ["FastMCP", "MCP", "@mcp.tool()", "MCP 도구(Tool)", "SAS(Scheduler-Agent-Supervisor)", "동기/비동기(sync/async)", "싱글턴"],
      lines: [
        { at: "def ask_patent_law(question: str, mode: str = \"auto\")", text: "@mcp.tool()로 등록되어 외부 AI 앱/오케스트레이터가 호출할 수 있는 공개 함수입니다. 질문과 검색 모드를 받습니다(mode 기본 auto는 '알아서 모드를 정함')." },
        { at: "result = get_mas().answer(question, mode)", text: "싱글턴 MAS를 가져와 SAS 워크플로(라우팅→검색→평가→융합)를 실행합니다." },
        { at: "return _shape_tool_result(result)", text: "엔진 결과를 MCP 응답용으로 간결히 정리해 돌려줍니다." },
      ],
      code: `# @mcp.tool(): 이 함수를 MCP 도구로 등록함. 동기 함수 유지가 필수(위 이벤트 루프 주의 참고).
@mcp.tool()
def ask_patent_law(question: str, mode: str = "auto") -> dict[str, Any]:
    """대한민국 특허법 지식을 검색해 근거 기반 한국어 답변을 생성함.

    질문을 접수하면 Scheduler가 검색 모드를 결정(auto면 자동 라우팅)하고, Agent가 그 모드로
    검색하며, Supervisor가 근거 충분성을 평가해 미흡하면 상보적 모드로 한 번 더 검색·융합함.

    Args:
        question: 특허법 관련 질문 (예: "특허를 받을 수 있는 요건은?").
        mode: 검색 모드. auto(자동 결정) | vector(조문 원문 정밀 인용)
              | local(엔티티 관계) | global(전체 구조 요약) | drift(복합 추론). 기본값 auto.
    """
    logger.info("ask_patent_law 호출: mode=%s, question=%s", mode, question[:80])
    result = get_mas().answer(question, mode)
    return _shape_tool_result(result)`,
    },
    {
      id: "get_mas",
      name: "get_mas()",
      fileId: "server",
      summary: "무거운 MAS 객체를 첫 호출 때 1회만 만들어 재사용하는 '지연 싱글턴' 함수",
      how: "PatentLawMAS는 ChromaDB 연결·GraphRAG 로딩·LLM 준비처럼 시간이 오래 걸리는 초기화를 합니다. 서버를 띄울 때마다 이걸 하면 기동이 느려지므로, 첫 도구 호출이 들어왔을 때 딱 한 번만 만들고 전역 변수 _mas에 보관해 이후엔 재사용합니다(싱글턴 패턴). 덕분에 서버 기동은 빠르고, 두 번째 요청부터는 곧바로 검색됩니다.",
      terms: ["싱글턴", "지연 초기화(lazy init)", "global 변수"],
      lines: [
        { at: "global _mas", text: "함수 밖의 전역 변수 _mas를 이 함수 안에서 바꿀 수 있게 선언합니다." },
        { at: "if _mas is None:", text: "아직 한 번도 안 만들어졌을 때만(처음 호출 때만) 생성합니다." },
        { at: "_mas = PatentLawMAS(_settings)", text: "무거운 초기화를 수행해 MAS 객체를 만들고 전역에 보관합니다." },
        { at: "return _mas", text: "이미 있으면 그대로, 처음이면 방금 만든 것을 돌려줍니다(이후 재사용)." },
      ],
      code: `# 무거운 초기화(ChromaDB·GraphRAG·LLM)는 첫 호출 시 1회만 수행함 (서버 기동은 빠르게).
_mas: PatentLawMAS | None = None


def get_mas() -> PatentLawMAS:
    """PatentLawMAS 싱글턴을 지연 생성해 반환함."""
    global _mas
    if _mas is None:
        logger.info("PatentLawMAS 최초 초기화 시작")
        _mas = PatentLawMAS(_settings)
    return _mas`,
    },
    {
      id: "mcp_primitives",
      name: "kg_stats_resource() · patent_law_advice()",
      fileId: "server",
      summary: "MCP의 나머지 두 프리미티브 — 읽기 전용 Resource와 재사용 Prompt 템플릿",
      how: "MCP는 외부에 세 가지를 노출할 수 있습니다: 동작을 실행하는 Tool, 부작용 없이 데이터를 읽는 Resource, 재사용 가능한 Prompt 템플릿. 여기서는 KG 통계를 URI로 읽게 하는 Resource와, 특허법 자문 작성 절차를 안내하는 Prompt를 등록합니다. 도구뿐 아니라 '데이터'와 '지시문'까지 표준 규격으로 제공해 분산 환경에서 재사용성을 높입니다.",
      terms: ["MCP", "@mcp.resource()", "@mcp.prompt()", "MCP 리소스(Resource)", "MCP 프롬프트(Prompt)", "KG(지식그래프)", "URI"],
      lines: [
        { at: "@mcp.resource(\"patent://kg/stats\")", text: "이 함수를 'patent://kg/stats' 주소(URI)로 읽을 수 있는 읽기 전용 리소스로 등록합니다." },
        { at: "return json.dumps(get_mas().kg_stats()", text: "지식그래프 통계(엔티티·관계·커뮤니티 수 등)를 JSON 문자열로 돌려줍니다." },
        { at: "def patent_law_advice(topic: str)", text: "@mcp.prompt()로 등록되는 재사용 프롬프트 템플릿 함수 — 슬래시 명령 등으로 골라 쓸 수 있습니다." },
        { at: "f\"먼저 patent-law-mas MCP 서버의 ask_patent_law", text: "자문 작성 시 먼저 이 서버의 검색 도구를 쓰라고 안내하는 지시문입니다." },
      ],
      code: `# (일부 발췌) MCP의 Resource·Prompt 프리미티브 등록

# @mcp.resource("URI"): 읽기 전용 데이터를 URI로 노출함 (부작용 없음).
@mcp.resource("patent://kg/stats")
def kg_stats_resource() -> str:
    """특허법 KG 통계(엔티티/관계/커뮤니티/텍스트유닛 수 + 타입 분포)를 JSON으로 반환."""
    return json.dumps(get_mas().kg_stats(), ensure_ascii=False, indent=2)


# @mcp.prompt(): 재사용 가능한 프롬프트 템플릿을 등록함 (슬래시 명령 등으로 선택).
@mcp.prompt()
def patent_law_advice(topic: str) -> str:
    """특허법 근거를 인용해 자문을 작성하게 하는 법령 자문 프롬프트 템플릿."""
    return (
        f"'{topic}' 에 대해 대한민국 특허법 관점에서 자문을 제공하려고 합니다.\\n"
        f"먼저 patent-law-mas MCP 서버의 ask_patent_law 도구로 관련 조문·요건·절차를 검색하세요.\\n"
        f"그다음 검색 결과의 출처(근거 조문)를 인용하면서, 일반 지식이 아닌 특허법 조문 기준으로\\n"
        f"핵심 요건·절차·주의사항을 한국어로 정리해 주세요."
    )`,
    },
    {
      id: "server_run",
      name: "FastMCP 서버 기동",
      fileId: "server",
      summary: "FastMCP 객체를 만들고 Streamable HTTP 전송으로 /mcp 엔드포인트를 띄움",
      how: "FastMCP는 함수의 타입 힌트와 docstring을 읽어 도구의 입력/출력 규격(JSON Schema)을 자동으로 만들어 줍니다. mcp.run(transport=\"streamable-http\")는 하나의 /mcp 주소로 양방향 통신하는 HTTP 서버를 띄웁니다. 원격이든 로컬이든 같은 방식으로 붙을 수 있어 분산 MAS의 부서를 네트워크에 공개하기 좋습니다.",
      terms: ["FastMCP", "Streamable HTTP", "엔드포인트", "JSON Schema", "if __name__ == \"__main__\""],
      lines: [
        { at: "mcp = FastMCP(\"patent-law-mas\"", text: "서버 이름과 바인딩 주소(host/port)로 FastMCP 객체를 만듭니다." },
        { at: "if __name__ == \"__main__\":", text: "이 파일을 직접 실행할 때만 서버를 띄웁니다(import 시에는 안 띄움)." },
        { at: "mcp.run(transport=\"streamable-http\")", text: "Streamable HTTP 전송으로 /mcp 엔드포인트 서버를 기동합니다(원격/로컬 공용)." },
      ],
      code: `# (일부 발췌) FastMCP 객체 생성과 서버 기동

# FastMCP: 타입 힌트 + docstring으로 도구/리소스/프롬프트 JSON Schema를 자동 생성함.
# host/port는 Streamable HTTP 바인딩 주소(엔드포인트 기본 /mcp).
mcp = FastMCP("patent-law-mas", host=_settings.mcp_host, port=_settings.mcp_port)


if __name__ == "__main__":
    # 이 파일을 직접 실행할 때만 서버를 기동함 (import 시 미실행).
    logger.info(
        "특허법 MAS MCP 서버 기동: http://%s:%d/mcp (model=%s)",
        _settings.mcp_host, _settings.mcp_port, _settings.llm_model,
    )
    # Streamable HTTP 전송 — 원격/로컬 모두 단일 /mcp 엔드포인트로 양방향 통신
    mcp.run(transport="streamable-http")`,
    },

    // ───────────────────────── search_cli.py ─────────────────────────
    {
      id: "cli_main",
      name: "main() (search_cli.py)",
      fileId: "cli",
      summary: "MCP 서버 없이 커맨드라인에서 PatentLawMAS를 직접 실행해 보는 진입점",
      how: "서버를 띄우지 않고도 같은 SAS 워크플로를 즉시 돌려 볼 수 있는 학습·디버깅용 도구입니다. argparse로 질문과 --mode를 받아 mas.answer()를 호출하고 결과를 보기 좋게 출력합니다. server.py와 cli가 동일한 PatentLawMAS를 공유하므로, 검색 로직을 한 곳에서 작성해 두 진입점이 함께 쓰는 구조입니다.",
      terms: ["argparse", "CLI", "진입점(main)", "SAS(Scheduler-Agent-Supervisor)"],
      lines: [
        { at: "parser.add_argument(\"query\"", text: "커맨드라인에서 받을 질문 인자를 정의합니다." },
        { at: "parser.add_argument(\"--mode\"", text: "검색 모드 옵션(auto/vector/local/global/drift)을 정의합니다." },
        { at: "mas = PatentLawMAS()", text: "서버와 동일한 MAS 객체를 만듭니다(검색 로직 공유)." },
        { at: "result = mas.answer(query, mode=args.mode)", text: "SAS 워크플로를 실행해 답변·근거·사용 모드를 받습니다." },
        { at: "return 1 if result.get(\"error\") else 0", text: "오류면 종료코드 1, 정상이면 0을 돌려줍니다." },
      ],
      code: `def main() -> int:
    parser = argparse.ArgumentParser(description="특허법 법령지식 MAS 단건 질의 CLI")
    parser.add_argument("query", nargs="+", help="특허법 질문")
    parser.add_argument("--mode", default="auto", choices=sorted(VALID_REQUEST_MODES),
                        help="검색 모드 (기본 auto)")
    args = parser.parse_args()
    query = " ".join(args.query).strip()

    print(f"PatentLawMAS 초기화 중... (mode={args.mode})")
    mas = PatentLawMAS()
    result = mas.answer(query, mode=args.mode)
    _print(result)
    return 1 if result.get("error") else 0`,
    },

    // ───────────────────────── mas/graph.py ─────────────────────────
    {
      id: "build_graph",
      name: "_build_graph()",
      fileId: "graph",
      summary: "LangGraph StateGraph로 SAS 노드 4개를 노드·엣지로 연결해 워크플로 그래프를 만듦",
      how: "이 함수가 SAS의 '지도'를 그립니다. scheduler·agent·supervisor·fuse를 노드로 등록하고, START부터 차례로 잇습니다. 핵심은 supervisor 뒤의 '조건부 엣지'입니다 — supervisor가 State에 적어 둔 next_step 값('agent'면 재검색, 'fuse'면 융합, 'end'면 종료)을 보고 갈림길을 정합니다. 이렇게 분기·반복이 있는 흐름을 그래프로 표현하는 것이 LangGraph입니다.",
      terms: ["LangGraph", "StateGraph", "노드(node)", "엣지(edge)", "조건부 엣지(conditional edge)", "공유 State", "compile", "SAS(Scheduler-Agent-Supervisor)"],
      lines: [
        { at: "builder = StateGraph(PatentLawState)", text: "공유 State 타입을 기준으로 빈 그래프 빌더를 만듭니다." },
        { at: "builder.add_node(\"scheduler\", self.nodes.scheduler_node)", text: "'scheduler' 이름의 노드에 라우팅 함수를 연결합니다(나머지 노드도 동일)." },
        { at: "builder.add_edge(START, \"scheduler\")", text: "시작점을 scheduler에 잇습니다 — 모든 질문은 라우팅부터 시작합니다." },
        { at: "builder.add_conditional_edges(", text: "supervisor 뒤에 '조건에 따라 갈라지는' 엣지를 답니다(분기의 핵심)." },
        { at: "lambda state: state.get(\"next_step\", \"end\"),", text: "State의 next_step 값을 읽어 어느 길로 갈지 결정합니다." },
        { at: "{\"agent\": \"agent\", \"fuse\": \"fuse\", \"end\": END},", text: "next_step이 agent면 재검색, fuse면 융합, end면 종료로 이어집니다." },
        { at: "return builder.compile()", text: "설계도를 실행 가능한 그래프로 컴파일해 돌려줍니다." },
      ],
      code: `def _build_graph(self):
    """SAS StateGraph를 구성·컴파일함."""
    builder = StateGraph(PatentLawState)
    builder.add_node("scheduler", self.nodes.scheduler_node)
    builder.add_node("agent", self.nodes.agent_node)
    builder.add_node("supervisor", self.nodes.supervisor_node)
    builder.add_node("fuse", self.nodes.fuse_node)

    builder.add_edge(START, "scheduler")
    builder.add_edge("scheduler", "agent")
    builder.add_edge("agent", "supervisor")
    # Supervisor의 next_step에 따라 재검색/융합/종료로 분기 (Loop Guard는 supervisor 내부에서 보장)
    builder.add_conditional_edges(
        "supervisor",
        lambda state: state.get("next_step", "end"),
        {"agent": "agent", "fuse": "fuse", "end": END},
    )
    builder.add_edge("fuse", END)
    return builder.compile()`,
    },
    {
      id: "mas_answer",
      name: "answer()",
      fileId: "graph",
      summary: "질문을 받아 그래프를 실행하고 결과를 정리해 돌려주는 MAS의 동기 진입점",
      how: "외부(server.py·cli)가 호출하는 단일 진입점입니다. 빈 질문이나 알 수 없는 모드를 먼저 방어하고, graph.invoke()로 그래프를 처음부터 끝까지 실행합니다. 시작 State에 question과 requested_mode만 넣어 주면, 각 노드가 State를 갱신하며 흐릅니다. 결과에는 '어떤 모드를 왜 골랐고 충분성 평가가 어땠는지'를 함께 담아 호출자가 처리 과정을 관찰할 수 있게 합니다.",
      terms: ["공유 State", "graph.invoke", "LangGraph", "동기/비동기(sync/async)"],
      lines: [
        { at: "if not question:", text: "질문이 비어 있으면 그래프를 돌리지 않고 즉시 오류 응답을 돌려줍니다(방어)." },
        { at: "if requested not in VALID_REQUEST_MODES:", text: "허용된 모드가 아니면 auto로 안전하게 대체합니다." },
        { at: "final = self.graph.invoke({\"question\": question, \"requested_mode\": requested})", text: "시작 State를 넣고 그래프를 끝까지 실행 — 라우팅→검색→평가→(융합)이 일어납니다." },
        { at: "return self._shape(question, requested, final)", text: "최종 State를 외부 응답용 딕셔너리로 정리해 돌려줍니다." },
      ],
      code: `# (일부 발췌) answer() 본문 — 방어 검사 후 그래프 실행
def answer(self, question: str, mode: str = "auto") -> dict:
    """질문을 받아 SAS 워크플로를 실행하고 응답 딕셔너리를 반환함."""
    question = (question or "").strip()
    if not question:
        return {
            "answer": "질문이 비어 있습니다. 검색할 내용을 입력하세요.",
            "requested_mode": mode, "resolved_mode": None, "route_reason": "빈 질문",
            "sources": [], "evidence": {}, "error": True,
        }

    requested = (mode or "auto").lower().strip()
    if requested not in VALID_REQUEST_MODES:
        logger.warning("알 수 없는 모드 '%s' → auto로 대체", requested)
        requested = "auto"

    final = self.graph.invoke({"question": question, "requested_mode": requested})
    return self._shape(question, requested, final)`,
    },

    {
      id: "graph_shape",
      name: "_shape() (PatentLawMAS)",
      fileId: "graph",
      summary: "그래프 실행이 끝난 최종 State를 호출자에게 돌려줄 깔끔한 응답 딕셔너리로 정리하는 함수",
      how: "그래프가 흐르며 쌓인 공유 State에는 내부용 값이 많이 섞여 있습니다. answer()가 이 함수를 불러, 그중 외부에 보여 줄 항목만 골라 정돈된 딕셔너리로 만듭니다. 단순히 답만 주는 게 아니라 '어떤 모드를 왜 골랐는지(route_reason), LLM 폴백을 썼는지, 충분성 평가가 어땠는지(supervisor_reason), 어떤 모드들을 거쳤는지(modes_used), 근거 출처는 무엇인지'를 함께 담습니다. 덕분에 호출자가 결과를 신뢰하고 처리 과정을 되짚을 수 있습니다(관찰 가능성).",
      terms: ["공유 State", "관찰 가능성(observability)", "출처(source)", "충분성 평가", "LLM 폴백"],
      lines: [
        { at: "passes = state.get(\"passes\", [])", text: "그래프가 누적한 검색 패스 목록을 State에서 꺼냅니다." },
        { at: "\"resolved_mode\": state.get(\"mode\"),", text: "최종적으로 실제 사용된 검색 모드를 담습니다." },
        { at: "\"supervisor_reason\": state.get(\"supervisor_reason\", \"\"),", text: "충분성 평가 결과·이유를 담아 판단 과정을 투명하게 합니다." },
        { at: "\"modes_used\": [p.get(\"mode\") for p in passes],", text: "거쳐 간 모드들을 나열합니다(예: 벡터→보완 GraphRAG)." },
        { at: "\"error\": bool(state.get(\"error\", False)),", text: "검색 중 오류가 있었는지 여부를 참/거짓으로 표시합니다." },
      ],
      code: `@staticmethod
def _shape(question: str, requested: str, state: PatentLawState) -> dict:
    """그래프 최종 State를 외부 응답용으로 정리함."""
    passes = state.get("passes", [])
    return {
        "question": question,
        "answer": state.get("answer", ""),
        "requested_mode": requested,
        "resolved_mode": state.get("mode"),
        "route_reason": state.get("route_reason", ""),
        "used_llm_fallback": state.get("used_llm_fallback", False),
        "supervisor_reason": state.get("supervisor_reason", ""),
        "sufficient": state.get("sufficient"),
        "reroutes": state.get("reroutes", 0),
        "modes_used": [p.get("mode") for p in passes],
        "sources": state.get("sources", []),
        "evidence": state.get("evidence", {}),
        "note": state.get("note", ""),
        "error": bool(state.get("error", False)),
    }`,
    },
    {
      id: "kg_resource",
      name: "kg_stats() · kg_schema() (PatentLawMAS)",
      fileId: "graph",
      summary: "지식그래프의 규모 통계·스키마를 돌려주는 두 메서드 — MCP 리소스가 이 값을 노출함",
      how: "server.py의 MCP 리소스(patent://kg/stats 등)가 호출하는 진입점입니다. 둘 다 실제 계산은 GraphRAG 검색기에 위임하는 얇은 통로(delegation)입니다. kg_stats는 엔티티·관계·커뮤니티·텍스트유닛 개수와 엔티티 타입 분포를 딕셔너리로 돌려주고, kg_schema는 그 통계를 사람이 읽기 좋은 한 편의 설명 문자열로 만듭니다. 외부에서 '이 지식그래프가 얼마나 크고 어떤 모양인지'를 들여다볼 수 있게 하는 창입니다.",
      terms: ["KG(지식그래프)", "MCP 리소스(Resource)", "엔티티/관계/커뮤니티", "위임(delegation)"],
      lines: [
        { at: "def kg_stats(self) -> dict:", text: "지식그래프 규모 통계를 딕셔너리로 돌려주는 메서드입니다." },
        { at: "return self.graphrag.kg_stats()", text: "실제 집계는 GraphRAG 검색기에 위임합니다(얇은 통로)." },
        { at: "def kg_schema(self) -> str:", text: "지식그래프 스키마를 사람이 읽을 문자열로 돌려주는 메서드입니다." },
        { at: "return self.graphrag.kg_schema()", text: "스키마 문자열 생성도 GraphRAG 검색기에 위임합니다." },
      ],
      code: `# === MCP Resource 지원 ===============================================

def kg_stats(self) -> dict:
    """KG 통계(엔티티/관계/커뮤니티/텍스트유닛 수, 엔티티 타입 분포) 반환."""
    return self.graphrag.kg_stats()

def kg_schema(self) -> str:
    """KG 스키마(엔티티 타입·관계·인덱스 구성) 문자열 반환."""
    return self.graphrag.kg_schema()`,
    },

    // ───────────────────────── mas/nodes.py ─────────────────────────
    {
      id: "scheduler_node",
      name: "scheduler_node()",
      fileId: "nodes",
      summary: "질문을 받아 라우터로 검색 모드를 정하고 공유 State에 적어 두는 SAS의 첫 노드(Scheduler)",
      how: "그래프가 시작되면 가장 먼저 실행되는 노드입니다. 실제 모드 판단은 router.route()에 위임하고, 그 결과(고른 모드·이유·LLM 폴백 사용 여부)를 공유 State에 기록합니다. reroutes를 0으로 초기화하는 것이 핵심입니다 — 이번 질문에 대한 재검색 횟수를 새로 세기 시작한다는 뜻으로, Supervisor의 Loop Guard가 이 값을 보고 무한 반복을 막습니다. 비유하면 '민원을 어느 창구로 보낼지 정하고 접수증에 적는 안내 데스크'입니다.",
      terms: ["노드(node)", "Scheduler", "Router(라우터)", "공유 State", "local/global/drift", "Loop Guard(루프 가드)"],
      lines: [
        { at: "requested = state.get(\"requested_mode\", \"auto\")", text: "호출자가 지정한 모드를 읽습니다(없으면 auto = '알아서 정함')." },
        { at: "decision = self.router.route(question, requested)", text: "라우터에게 모드 결정을 위임합니다(패턴 점수 + 필요 시 LLM 폴백)." },
        { at: "\"mode\": decision.mode,", text: "결정된 모드를 State에 적어 다음 노드(Agent)가 읽게 합니다." },
        { at: "\"reroutes\": 0,", text: "재검색 횟수를 0으로 초기화 — 이 값이 나중에 Loop Guard의 기준이 됩니다." },
      ],
      code: `def scheduler_node(self, state: PatentLawState) -> dict:
    """검색 모드를 라우팅함 (auto면 패턴 + LLM, 그 외면 호출자 지정)."""
    question = state["question"]
    requested = state.get("requested_mode", "auto")
    decision = self.router.route(question, requested)
    logger.info("[Scheduler] mode=%s (%s)", decision.mode, decision.reason)
    return {
        "mode": decision.mode,
        "route_reason": decision.reason,
        "used_llm_fallback": decision.used_llm_fallback,
        "reroutes": 0,
    }`,
    },
    {
      id: "src_to_dict",
      name: "_src_to_dict()",
      fileId: "nodes",
      summary: "검색기가 돌려준 출처 객체(SourceItem)를 State·MCP 응답용 간결한 딕셔너리로 변환하는 헬퍼",
      how: "검색기는 출처를 SourceItem이라는 객체로 돌려주는데, 그래프 State에 담거나 MCP 응답으로 내보내려면 단순한 딕셔너리(키-값 묶음)가 편합니다. 이 함수가 그 변환을 담당하며, 원문(content)을 600자로 잘라 LLM 컨텍스트 비용과 응답 크기를 줄입니다. 비유하면 '두꺼운 서류를 요약 카드 한 장으로 옮겨 적는' 일입니다.",
      terms: ["직렬화(serialize)", "공유 State", "MCP 응답", "출처(source)"],
      lines: [
        { at: "def _src_to_dict(src: SourceItem) -> dict:", text: "출처 객체 하나를 받아 딕셔너리로 바꾸는 변환 함수입니다." },
        { at: "\"type\": src.source_type,", text: "출처 종류(vector/엔티티/관계 등)를 그대로 옮깁니다." },
        { at: "\"content\": src.content[:600],", text: "원문을 600자까지만 잘라 담습니다 — 응답을 가볍게 유지(컨텍스트 비용 절감)." },
        { at: "\"metadata\": src.metadata,", text: "장/조·출처 같은 부가 정보(메타데이터)를 함께 싣습니다." },
      ],
      code: `def _src_to_dict(src: SourceItem) -> dict:
    """SourceItem을 MCP 응답·State 저장용 간결한 dict로 직렬화함(원문 길이 추가 제한)."""
    return {
        "type": src.source_type,
        "title": src.title,
        "content": src.content[:600],
        "metadata": src.metadata,
    }`,
    },
    {
      id: "agent_node",
      name: "agent_node()",
      fileId: "nodes",
      summary: "현재 결정된 모드로 실제 검색을 수행하고 결과를 공유 State에 누적하는 노드",
      how: "Agent는 Scheduler가 정한 한 가지 모드로만 검색합니다 — vector면 조문 벡터 검색기, 그 외(local/global/drift)면 GraphRAG 검색기를 호출합니다. 결과를 passes·tried_modes에 '누적'으로 쌓는 것이 핵심입니다(보완 검색 시 2개가 쌓여 fuse가 융합). 검색이 실패해도 예외를 잡아 깔끔한 오류 답변으로 바꿔, 그래프 전체가 죽지 않게 방어합니다.",
      terms: ["노드(node)", "공유 State", "reducer(누적)", "벡터 검색", "GraphRAG", "예외 처리(try/except)"],
      lines: [
        { at: "mode = state[\"mode\"]", text: "Scheduler가 State에 적어 둔 현재 검색 모드를 읽습니다." },
        { at: "if mode == \"vector\":", text: "vector면 조문 벡터 검색기(ChromaDB)를 씁니다." },
        { at: "out = self.graphrag.search(question, mode)", text: "그 외(local/global/drift)면 GraphRAG 검색기를 씁니다." },
        { at: "\"passes\": [pass_dict],", text: "이번 패스 결과를 passes에 추가 — reducer가 기존 목록 뒤에 누적합니다(보완 검색 시 2개가 쌓여 fuse가 융합). 함께 쌓는 tried_modes가 '같은 모드 중복 검색'을 막습니다." },
        { at: "\"note\": out.note or \"\",", text: "현재 패스의 답변·출처·비고를 State 편의 필드에 갱신합니다." },
        { at: "except Exception as exc:  # 검색 실패를 잡아", text: "검색이 실패하면 예외를 잡아 오류 답변으로 변환(그래프 크래시 방지)." },
      ],
      code: `def agent_node(self, state: PatentLawState) -> dict:
    """현재 모드로 검색을 실행하고 결과를 State에 누적함."""
    mode = state["mode"]
    question = state["question"]
    try:
        if mode == "vector":
            out = self.vector.search(question)
        else:
            out = self.graphrag.search(question, mode)
        sources = [_src_to_dict(s) for s in out.sources]
        logger.info("[Agent] mode=%s → sources=%d", out.mode, len(sources))
        pass_dict = {
            "mode": out.mode,
            "requested_mode": mode,
            "answer": out.answer,
            "sources": sources,
            "evidence": dict(out.evidence),
            "note": out.note,
        }
        return {
            "passes": [pass_dict],
            "tried_modes": [mode],
            "answer": out.answer,
            "sources": sources,
            "evidence": dict(out.evidence),
            "note": out.note or "",
        }
    except Exception as exc:  # 검색 실패를 잡아 깔끔한 오류 답변으로 변환(그래프 크래시 방지)
        logger.exception("[Agent] 검색 실패: mode=%s", mode)
        note = f"'{mode}' 검색 실패: {exc}"
        return {
            "passes": [{"mode": mode, "requested_mode": mode, "answer": "",
                        "sources": [], "evidence": {"sources": 0}, "note": note}],
            "tried_modes": [mode],
            "answer": "",
            "sources": [],
            "evidence": {"sources": 0},
            "note": note,
            "error": True,
        }`,
    },
    {
      id: "supervisor_node",
      name: "supervisor_node()",
      fileId: "nodes",
      summary: "근거 충분성을 평가하고 종료/재검색/융합 중 하나로 분기를 결정하는 감독 노드",
      how: "검색 결과가 충분한지 LLM으로 보수적으로 판정합니다. 충분하면 마무리(다중 패스면 융합, 단일이면 종료)하고, 부족하면 '역할이 다른 보완 모드'로 한 번 더 검색하도록 next_step='agent'를 적습니다. reroutes 카운터로 재검색 한도를 지켜(Loop Guard) 무한 반복을 막습니다. 이것이 SAS의 'Supervisor'가 하는 일 — 일꾼(Agent)의 결과를 검수하고 다음 행동을 지시합니다.",
      terms: ["노드(node)", "Supervisor", "Loop Guard(루프 가드)", "보완 모드(상보적 검색)", "공유 State", "충분성 평가", "융합(fusion)"],
      lines: [
        { at: "sufficient, reason = self._judge(question, answer, sources)", text: "답변이 질문에 충분한지(근거가 있는지) LLM으로 판정합니다." },
        { at: "if sufficient:", text: "충분하면 마무리합니다(다중 패스면 융합, 단일이면 종료)." },
        { at: "if reroutes >= self.max_reroutes:", text: "재검색 한도에 도달했으면 더 전환하지 않고 마무리합니다(Loop Guard)." },
        { at: "comp = self._complementary_mode(current, tried, question)", text: "현재 모드와 역할이 다른 보완 모드를 고릅니다(이미 쓴 모드는 제외)." },
        { at: "\"next_step\": \"agent\",", text: "보완 모드로 재검색하도록 그래프에 'agent로 돌아가라'고 지시합니다." },
      ],
      code: `def supervisor_node(self, state: PatentLawState) -> dict:
    """근거 충분성을 평가하고 종료/재검색/융합 중 하나를 결정함."""
    question = state["question"]
    answer = state.get("answer", "")
    sources = state.get("sources", [])
    reroutes = state.get("reroutes", 0)
    tried = state.get("tried_modes", [])
    current = state["mode"]
    pass_count = len(state.get("passes", []))

    sufficient, reason = self._judge(question, answer, sources)

    # 충분하면 종료(단일 패스) 또는 융합(다중 패스)
    if sufficient:
        return self._finish(True, reason, pass_count)

    # 부족하지만 재검색 한도 도달 → 더 전환하지 않고 마무리
    if reroutes >= self.max_reroutes:
        return self._finish(False, f"{reason} (재검색 한도 {self.max_reroutes}회 도달)", pass_count)

    # 보완 모드 선택 (없으면 마무리)
    comp = self._complementary_mode(current, tried, question)
    if comp is None:
        return self._finish(False, f"{reason} (전환 가능한 보완 모드 없음)", pass_count)

    logger.info("[Supervisor] 근거 미흡 → 보완 모드 '%s'로 재검색", comp)
    return {
        "sufficient": False,
        "supervisor_reason": f"{reason} → 보완 모드 '{comp}'로 재검색",
        "mode": comp,
        "reroutes": reroutes + 1,
        "next_step": "agent",
    }`,
    },
    {
      id: "fuse_node",
      name: "fuse_node()",
      fileId: "nodes",
      summary: "조문 원문(vector)과 관계/구조(GraphRAG) 두 패스 답변을 하나로 융합하는 노드",
      how: "보완 검색까지 두 번 돌았을 때 실행됩니다. 두 패스의 출처를 제목 기준으로 중복 제거하며 합치고, _fuse_answer로 두 답변을 모순 없는 하나의 한국어 답변으로 종합합니다. 융합 프롬프트는 조문 번호를 인용하되 'vector·GraphRAG' 같은 내부 용어는 답변에 드러내지 말라고 지시해, 사용자에게는 자연스러운 법령 자문체로 보이게 합니다. 이것이 두 검색의 강점을 합치는 핵심 단계입니다.",
      terms: ["노드(node)", "융합(fusion)", "벡터 검색", "GraphRAG", "중복 제거(dedup)", "LLM"],
      lines: [
        { at: "merged.setdefault(s[\"title\"], s)", text: "출처를 제목 기준으로 모아 같은 조문이 중복 노출되지 않게 합니다." },
        { at: "fused = self._fuse_answer(state[\"question\"], passes)", text: "두 패스 답변을 하나의 정확한 한국어 답변으로 종합합니다." },
        { at: "modes = \" + \".join(p.get(\"mode\", \"?\") for p in passes)", text: "어떤 모드들이 융합됐는지(예: 'vector + local') 표시 문자열을 만듭니다." },
        { at: "\"note\": f\"{modes} 결과 융합\",", text: "융합에 쓰인 모드를 비고로 남겨 처리 과정을 투명하게 합니다." },
      ],
      code: `def fuse_node(self, state: PatentLawState) -> dict:
    """여러 패스(조문 원문 + 관계/구조)를 하나의 답변으로 융합함."""
    passes = state.get("passes", [])
    # 출처를 제목 기준으로 중복 제거하며 병합
    merged: dict[str, dict] = {}
    for p in passes:
        for s in p.get("sources", []):
            merged.setdefault(s["title"], s)
    sources = list(merged.values())

    fused = self._fuse_answer(state["question"], passes)
    modes = " + ".join(p.get("mode", "?") for p in passes)
    logger.info("[Fuse] %s 결과 융합 → sources=%d", modes, len(sources))
    return {
        "answer": fused,
        "sources": sources,
        "evidence": {"sources": len(sources), "passes": len(passes)},
        "note": f"{modes} 결과 융합",
    }`,
    },

    {
      id: "judge",
      name: "_judge()",
      fileId: "nodes",
      summary: "검색 답변이 질문에 충분한지 LLM으로 보수적으로 판정하는 Supervisor의 핵심 두뇌",
      how: "Supervisor가 '재검색이 필요한가?'를 정하려면 먼저 지금 답이 충분한지 알아야 합니다. 이 함수가 그 판정을 합니다 — 답이 비었거나 출처가 하나도 없으면 LLM을 부르지도 않고 즉시 '부족'으로 처리해 비용을 아낍니다(빠른 탈락). 그 외에는 구조화 출력 LLM에게 sufficient(true/false)와 이유를 받습니다. 기준을 '보수적'으로 둔 게 핵심입니다 — 핵심만 짚으면 충분으로 봐서 불필요한 재검색·중복을 막습니다. 평가 LLM 자체가 실패하면 무한 루프를 피하려고 '충분'으로 간주합니다(fail-safe).",
      terms: ["충분성 평가", "Supervisor", "구조화 출력(structured output)", "지연 초기화(lazy init)", "fail-safe(안전 우선)", "보완 모드(상보적 검색)"],
      lines: [
        { at: "if not answer or not str(answer).strip():", text: "답이 비어 있으면 LLM 호출 없이 즉시 '부족'으로 판정합니다(빠른 탈락)." },
        { at: "if not sources:", text: "근거 출처가 하나도 없어도 곧바로 '부족'으로 판정합니다." },
        { at: "self._verdict_llm = build_structured_llm(self.settings, _Verdict)", text: "평가용 구조화 LLM을 첫 호출 때 한 번만 만듭니다(지연 생성)." },
        { at: "verdict = self._verdict_llm.invoke(prompt)", text: "LLM에게 '충분한가'를 정해진 JSON(_Verdict) 형식으로 받습니다." },
        { at: "return True, f\"평가 LLM 실패로 현재 답변 채택({exc})\"", text: "평가 자체가 실패하면 무한 루프를 막기 위해 '충분'으로 처리합니다(fail-safe)." },
      ],
      code: `def _judge(self, question: str, answer: str, sources: list) -> tuple[bool, str]:
    """답변의 근거 충분성을 평가함 (빈 답/무출처는 LLM 호출 없이 부족 처리)."""
    if not answer or not str(answer).strip():
        return False, "답변이 비어 있음"
    if not sources:
        return False, "근거 출처가 없음"
    if self._verdict_llm is None:
        self._verdict_llm = build_structured_llm(self.settings, _Verdict)
    # 보수적 기준: 답변이 질문을 다루고 특허법 근거가 있으면 충분으로 봄(불필요한 재검색·비용 방지).
    # 명백히 부적합할 때만 보완 검색을 유발해, '서로 다른 역할의 두 검색'이 과하게 겹치지 않게 함.
    prompt = (
        "당신은 특허법 답변의 품질 감독자임. 아래 답변이 질문에 답하기에 '충분한지'만 보수적으로 판단하라.\\n"
        "- 질문의 핵심을 다루고 특허법 근거(조문/개념)가 조금이라도 제시되면 sufficient=true\\n"
        "- 질문과 무관하거나, 근거가 전혀 없거나, '관련 내용을 찾을 수 없다'는 취지면 sufficient=false\\n"
        "- 답변이 완벽히 망라적이지 않더라도 핵심을 짚었다면 sufficient=true (사소한 누락으로 false 금지)\\n\\n"
        f"질문: {question}\\n답변: {str(answer)[:1500]}\\n출처 수: {len(sources)}"
    )
    try:
        verdict = self._verdict_llm.invoke(prompt)
        return bool(verdict.sufficient), str(verdict.reason)
    except Exception as exc:  # 평가 실패 시 보수적으로 충분 처리(무한 루프 방지)
        logger.warning("[Supervisor] 평가 LLM 실패, 현재 답변 채택: %s", exc)
        return True, f"평가 LLM 실패로 현재 답변 채택({exc})"`,
    },
    {
      id: "complementary_finish",
      name: "_complementary_mode() · _finish()",
      fileId: "nodes",
      summary: "보완 모드를 고르는 함수와 종료 분기(융합/종료)를 정하는 함수 — Supervisor의 결정 보조 2종",
      how: "Supervisor가 '부족' 판정을 내린 뒤 쓰는 두 도우미입니다. _complementary_mode는 '역할이 다른' 두 번째 모드를 고릅니다 — 벡터(조문 원문)가 부족했으면 GraphRAG(관계/구조)로, GraphRAG가 부족했으면 벡터로 바꿉니다(이미 써 본 모드는 제외). _finish는 더 검색하지 않고 끝낼 때, 패스가 2개 이상이면 'fuse'(융합)로, 1개뿐이면 'end'(종료)로 가도록 다음 행동을 정합니다. 비유하면 '다른 전문가를 부를지 고르기'와 '여기서 마칠지·소견을 합칠지 정하기'입니다.",
      terms: ["보완 모드(상보적 검색)", "Supervisor", "벡터 검색", "GraphRAG", "융합(fusion)", "공유 State"],
      lines: [
        { at: "if current == \"vector\":", text: "현재 모드가 벡터였다면(조문 원문이 부족했다는 뜻)" },
        { at: "cand = self.router.best_graphrag_mode(question)", text: "GraphRAG 쪽에서 가장 어울리는 보완 모드를 고릅니다." },
        { at: "return \"vector\" if \"vector\" not in tried else None", text: "반대로 GraphRAG가 부족했으면 벡터로 보완(이미 썼으면 None=보완 불가)." },
        { at: "\"next_step\": \"fuse\" if pass_count > 1 else \"end\",", text: "패스가 2개 이상이면 융합(fuse), 1개뿐이면 종료(end)로 분기를 정합니다." },
      ],
      code: `@staticmethod
def _finish(sufficient: bool, reason: str, pass_count: int) -> dict:
    """종료 분기 결정 — 다중 패스면 융합, 단일 패스면 그대로 종료."""
    return {
        "sufficient": sufficient,
        "supervisor_reason": reason,
        "next_step": "fuse" if pass_count > 1 else "end",
    }

def _complementary_mode(self, current: str, tried: list[str], question: str) -> str | None:
    """현재 모드와 상보적인(역할이 다른) 모드를 고름 — 이미 시도한 모드는 제외함."""
    if current == "vector":
        # 벡터(조문 원문)가 부족 → GraphRAG(관계/구조)로 보완
        cand = self.router.best_graphrag_mode(question)
        if cand not in tried:
            return cand
        for m in GRAPHRAG_MODES:
            if m not in tried:
                return m
        return None
    # GraphRAG가 부족 → 벡터(조문 원문 정밀 인용)로 보완
    return "vector" if "vector" not in tried else None`,
    },
    {
      id: "fuse_answer",
      name: "_fuse_answer()",
      fileId: "nodes",
      summary: "여러 패스의 답변 후보를 LLM으로 종합해 하나의 모순 없는 한국어 답변을 만드는 함수",
      how: "fuse_node가 실제 융합을 맡기는 함수입니다. 두 패스(벡터·GraphRAG)의 답변을 '[모드 검색 답변]' 블록으로 묶어 LLM에게 주고, 모순 없이 하나로 합치게 합니다. 프롬프트가 두 가지를 강하게 지시하는 게 핵심입니다 — (1) 근거 조문 번호('제○○조')를 인용할 것, (2) 'vector·GraphRAG·검색' 같은 내부 처리 용어는 절대 답변에 드러내지 말 것. 그래서 사용자에게는 자연스러운 법령 자문으로 보입니다. 융합 LLM은 첫 호출 때 한 번만 만듭니다(지연 생성).",
      terms: ["융합(fusion)", "LLM", "조문 인용", "지연 초기화(lazy init)", "f-string"],
      lines: [
        { at: "self._fuse_llm = build_chat_llm(self.settings, max_tokens=self.settings.llm_max_tokens)", text: "융합용 일반 채팅 LLM을 첫 융합 때 한 번만 만듭니다(지연 생성)." },
        { at: "for p in passes if p.get(\"answer\", \"\").strip()", text: "비어 있지 않은 답변만 골라 융합 후보 블록으로 만듭니다." },
        { at: "if not blocks:", text: "합칠 답변이 하나도 없으면 '찾을 수 없다'는 안전한 문구를 돌려줍니다." },
        { at: "context = \"\\n\\n\".join(blocks)", text: "후보 답변들을 빈 줄로 구분해 하나의 컨텍스트 문자열로 합칩니다." },
        { at: "return self._fuse_llm.invoke(prompt).content.strip()", text: "종합 프롬프트로 LLM을 호출해 최종 한국어 답변을 얻습니다." },
      ],
      code: `def _fuse_answer(self, question: str, passes: list[dict]) -> str:
    """패스별 답변을 종합해 하나의 정확한 한국어 답변을 생성함."""
    if self._fuse_llm is None:
        self._fuse_llm = build_chat_llm(self.settings, max_tokens=self.settings.llm_max_tokens)
    # 비어있지 않은 답변만 융합 대상으로 사용
    blocks = [
        f"[{p.get('mode', '?')} 검색 답변]\\n{p.get('answer', '').strip()}"
        for p in passes if p.get("answer", "").strip()
    ]
    if not blocks:
        return "제공된 근거에서 관련 내용을 찾을 수 없습니다."
    context = "\\n\\n".join(blocks)
    prompt = (
        "다음은 동일한 특허법 질문에 대해 서로 다른 방식으로 얻은 답변 후보들임. "
        "이들을 종합해 모순 없이 하나의 정확한 한국어 답변을 작성하라.\\n"
        "- 근거가 된 조문 번호('제○○조')와 핵심 개념을 인용할 것\\n"
        "- 'vector'·'GraphRAG'·'검색' 같은 내부 처리 용어는 답변에 드러내지 말 것(자연스러운 법령 자문체)\\n\\n"
        f"질문: {question}\\n\\n{context}\\n\\n[종합 답변]"
    )
    return self._fuse_llm.invoke(prompt).content.strip()`,
    },

    // ───────────────────────── mas/router.py ─────────────────────────
    {
      id: "router_route",
      name: "route()",
      fileId: "router",
      summary: "질문을 보고 검색 모드를 결정 — 호출자 지정 우선, auto면 패턴→LLM 폴백",
      how: "Scheduler의 두뇌입니다. 호출자가 모드를 직접 지정했으면 그대로 따르고, auto면 먼저 키워드 패턴 점수로 모드를 고릅니다. 패턴 확신도가 임계값(0.55) 미만이면 LLM에게 분류를 맡기는 '폴백'으로 넘어갑니다. 규칙(빠르고 결정적) + LLM(유연함)을 합친 2단계 라우팅으로, 비용을 아끼면서도 애매한 질문을 잘 처리합니다.",
      terms: ["Router(라우터)", "Scheduler", "패턴 매칭", "LLM 폴백", "구조화 출력(structured output)", "확신도(confidence)"],
      lines: [
        { at: "if mode != \"auto\":", text: "호출자가 모드를 직접 지정했으면 라우팅 없이 그대로 따릅니다." },
        { at: "decision = self._route_by_pattern(query)", text: "auto면 먼저 키워드 패턴 점수로 모드를 정합니다(빠르고 비용 0)." },
        { at: "if decision.confidence >= self.min_confidence:", text: "패턴 확신도가 임계값 이상이면 그 결정을 채택합니다." },
        { at: "fallback = self._route_by_llm(query)", text: "확신도가 낮으면 LLM 분류로 폴백합니다(애매한 질문 처리)." },
        { at: "return fallback or decision", text: "LLM이 성공하면 그 결과를, 실패하면 패턴 결과를 씁니다." },
      ],
      code: `def route(self, query: str, requested_mode: str = "auto") -> RouteDecision:
    """수동 지정 또는 auto 규칙에 따라 검색 모드를 결정함."""
    mode = self.normalize_mode(requested_mode)
    if mode != "auto":
        return RouteDecision(mode, 1.0, "호출자가 모드를 직접 지정함")

    decision = self._route_by_pattern(query)
    if decision.confidence >= self.min_confidence:
        return decision

    fallback = self._route_by_llm(query)
    return fallback or decision`,
    },
    {
      id: "router_score",
      name: "_score()",
      fileId: "router",
      summary: "모드별 키워드가 질문에 몇 개 들어 있는지 세어 점수를 매기는 패턴 라우팅의 핵심",
      how: "각 모드(vector/local/global/drift)마다 대표 키워드 목록을 두고, 질문에 그 키워드가 등장할 때마다 점수를 1씩 올립니다. 추가로 '제29조'처럼 조문을 직접 가리키는 표현이 보이면 vector에 1.5점을 더 줍니다 — 조문 번호는 '원문을 정확히 인용해야 한다'는 강한 신호이기 때문입니다. 점수가 가장 높은 모드가 1차 후보가 됩니다.",
      terms: ["패턴 매칭", "정규식(re)", "키워드 점수", "벡터 검색"],
      lines: [
        { at: "scores: dict[str, float] = {mode: 0.0 for mode in RESOLVED_MODES}", text: "네 모드의 점수를 모두 0으로 초기화합니다." },
        { at: "if keyword in normalized:", text: "질문에 그 모드의 키워드가 들어 있으면" },
        { at: "scores[mode] += 1.0", text: "해당 모드 점수를 1점 올립니다." },
        { at: "if _ARTICLE_REF_RE.search(query):", text: "'제29조' 같은 조문 직접 참조가 있는지 정규식으로 확인합니다." },
        { at: "scores[\"vector\"] += 1.5", text: "조문 참조는 정밀 인용 신호이므로 vector에 가중치 1.5점을 더합니다." },
      ],
      code: `def _score(self, query: str) -> dict[str, float]:
    """모드별 키워드 매칭 점수를 계산함."""
    normalized = query.lower()
    scores: dict[str, float] = {mode: 0.0 for mode in RESOLVED_MODES}
    for mode, keywords in self.KEYWORDS.items():
        for keyword in keywords:
            if keyword in normalized:
                scores[mode] += 1.0
    # 조문 직접 참조는 정밀 인용(vector) 강한 신호로 가중
    if _ARTICLE_REF_RE.search(query):
        scores["vector"] += 1.5
    return scores`,
    },

    {
      id: "route_strategy",
      name: "_route_by_pattern() · _route_by_llm()",
      fileId: "router",
      summary: "route()가 쓰는 2단계 모드 결정 전략 — 빠른 키워드 패턴(1단계) + LLM 분류 폴백(2단계)",
      how: "라우팅을 두 단계로 나눕니다. 1단계 _route_by_pattern은 _score로 모드별 키워드 점수를 매겨 가장 높은 모드를 고르고, '점수/전체합'으로 확신도를 계산합니다 — 빠르고 비용이 0입니다. 확신도가 낮아 애매하면 2단계 _route_by_llm으로 넘어가, 네 모드의 정의를 설명한 프롬프트로 LLM에게 분류를 맡깁니다(구조화 출력). LLM 폴백이 실패해도 치명적이지 않게 None을 돌려 패턴 결과를 쓰게 합니다. '규칙 먼저, 애매하면 AI'라는 비용 효율적 설계입니다.",
      terms: ["패턴 매칭", "LLM 폴백", "키워드 점수", "확신도(confidence)", "구조화 출력(structured output)", "local/global/drift", "지연 초기화(lazy init)"],
      lines: [
        { at: "best_mode = max(scores, key=scores.get)", text: "키워드 점수가 가장 높은 모드를 1차 후보로 고릅니다." },
        { at: "confidence = min(0.95, max(0.3, best_score / total))", text: "'최고점/전체합'으로 확신도를 0.3~0.95 사이로 계산합니다." },
        { at: "self._llm = build_structured_llm(self.settings, _LLMRoute)", text: "폴백이 필요할 때만 분류용 구조화 LLM을 한 번 만듭니다(지연 생성)." },
        { at: "result = self._llm.invoke(prompt)", text: "네 모드 정의가 담긴 프롬프트로 LLM에게 모드를 분류받습니다." },
        { at: "return RouteDecision(result.mode, confidence, f\"LLM 분류: {result.reason}\", True)", text: "LLM 결정을 'used_llm_fallback=True' 표시와 함께 돌려줍니다." },
        { at: "return None", text: "폴백이 실패하면 None을 돌려 route()가 패턴 결과를 쓰게 합니다." },
      ],
      code: `def _route_by_pattern(self, query: str) -> RouteDecision:
    scores = self._score(query)
    best_mode = max(scores, key=scores.get)
    best_score = scores[best_mode]
    total = sum(scores.values()) or 1.0
    confidence = min(0.95, max(0.3, best_score / total))
    matched = [kw for kw in self.KEYWORDS[best_mode] if kw in query.lower()]
    reason = (
        f"패턴 매칭: {', '.join(matched) or '조문 참조'}"
        if best_score > 0 else "패턴 근거 부족"
    )
    return RouteDecision(best_mode, confidence, reason)

def _route_by_llm(self, query: str) -> RouteDecision | None:
    """패턴 확신도가 낮을 때 LLM 구조화 분류로 폴백함 (실패 시 None)."""
    if self._llm is None:
        self._llm = build_structured_llm(self.settings, _LLMRoute)
    prompt = (
        "당신은 한국 특허법 질의의 검색 모드 분류기임. 다음 중 하나로만 분류하라.\\n"
        "- vector: 특정 조문 원문/정의/문구 조회 (정밀 인용)\\n"
        "- local: 요건·권리·절차·기관 등 엔티티 사이의 관계/근접 컨텍스트\\n"
        "- global: 전체 주제·구조·유형의 요약 (커뮤니티 단위)\\n"
        "- drift: 복합·다단계 추론 (전체 primer + 세부 결합)\\n\\n"
        f"질문: {query}"
    )
    try:
        result = self._llm.invoke(prompt)
        confidence = min(max(float(result.confidence), 0.0), 1.0)
        return RouteDecision(result.mode, confidence, f"LLM 분류: {result.reason}", True)
    except Exception as exc:  # 폴백 실패는 치명적이지 않으므로 패턴 결과를 사용
        logger.warning("라우터 LLM 폴백 실패: %s", exc)
        return None`,
    },
    {
      id: "mode_resolve",
      name: "normalize_mode() · best_graphrag_mode()",
      fileId: "router",
      summary: "호출자 모드 문자열을 내부 키로 정규화하는 함수와, GraphRAG 보완 시 최적 하위 모드를 고르는 함수",
      how: "라우터의 작은 도우미 2종입니다. normalize_mode는 호출자가 넘긴 모드 문자열(대소문자·공백 섞일 수 있음)을 정해진 키로 맞추고, 모르는 값이면 안전하게 'auto'로 바꿉니다(잘못된 입력 방어). best_graphrag_mode는 Supervisor가 '벡터로 부족하니 GraphRAG로 보완'하기로 했을 때, local/global/drift 중 질문 키워드 점수가 가장 높은 하나를 고릅니다(전부 0점이면 기본 local). 보완 검색도 아무 모드나 쓰지 않고 질문에 맞춰 똑똑하게 고르게 합니다.",
      terms: ["정규화(normalize)", "보완 모드(상보적 검색)", "GraphRAG", "local/global/drift", "키워드 점수"],
      lines: [
        { at: "return self.MODE_ALIASES.get((mode or \"auto\").lower().strip(), \"auto\")", text: "입력을 소문자·공백제거 후 별칭표와 대조 — 모르는 값이면 auto로 안전 대체합니다." },
        { at: "graph_scores = {m: scores[m] for m in GRAPHRAG_MODES}", text: "GraphRAG의 세 모드(local/global/drift) 점수만 추립니다." },
        { at: "best = max(graph_scores, key=graph_scores.get)", text: "그중 키워드 점수가 가장 높은 모드를 보완 후보로 고릅니다." },
        { at: "return best if graph_scores[best] > 0 else \"local\"", text: "전부 0점이면(단서 없음) 기본값 local로 보완합니다." },
      ],
      code: `def normalize_mode(self, mode: str) -> str:
    """호출자 입력 모드를 내부 키로 정규화함 (알 수 없으면 auto)."""
    return self.MODE_ALIASES.get((mode or "auto").lower().strip(), "auto")

def best_graphrag_mode(self, query: str) -> str:
    """GraphRAG 보완 검색 시, local/global/drift 중 패턴 점수가 높은 모드를 고름(기본 local)."""
    scores = self._score(query)
    graph_scores = {m: scores[m] for m in GRAPHRAG_MODES}
    best = max(graph_scores, key=graph_scores.get)
    return best if graph_scores[best] > 0 else "local"`,
    },

    // ───────────────────────── retrieval/vector_retriever.py ─────────────────────────
    {
      id: "vector_search",
      name: "search() (VectorRetriever)",
      fileId: "vector",
      summary: "ChromaDB에서 비슷한 조문 청크를 찾아(탐색) 그 근거로 조문을 인용한 답변을 생성(생성)",
      how: "전형적인 RAG(검색 증강 생성)입니다. (1) 탐색: 질문을 임베딩해 ChromaDB patent_law 컬렉션에서 의미가 가까운 조문 청크 상위 K개를 찾습니다. (2) 생성: 찾은 청크를 컨텍스트로 묶어 LLM이 '제○○조'를 인용하며 답하게 합니다(LCEL 체인). 이 검색기의 역할은 '조문 원문을 정확히 집어 인용'하는 것으로, GraphRAG의 '관계/구조' 역할과 분명히 구분됩니다.",
      terms: ["벡터 검색", "RAG(검색 증강 생성)", "ChromaDB", "임베딩(embedding)", "similarity_search", "LCEL 체인", "조문 인용"],
      lines: [
        { at: "docs = self._store.similarity_search(query, k=self.settings.vector_top_k)", text: "(탐색) 질문과 의미가 가까운 조문 청크 상위 K개를 ChromaDB에서 찾습니다." },
        { at: "sources = [self._to_source(doc) for doc in docs]", text: "찾은 청크를 인용 라벨이 붙은 출처 객체로 변환합니다." },
        { at: "chain = prompt | self._llm | StrOutputParser()", text: "프롬프트→LLM→문자열 파서를 파이프(|)로 잇는 LCEL 체인을 만듭니다." },
        { at: "answer = chain.invoke({\"context\": self._format_context(sources), \"question\": query})", text: "(생성) 찾은 청크를 근거로 조문을 인용한 답변을 만듭니다." },
        { at: "mode=\"vector\",", text: "이 검색이 'vector' 모드 결과임을 표시해 상위 워크플로가 구분하게 합니다." },
      ],
      code: `def search(self, query: str) -> SearchOutput:
    """질의어로 유사 조문 청크를 검색하고, 그 근거로 LLM 답변을 생성함."""
    # 1) 탐색: 질의 임베딩 → 유사도 상위 K개 조문 청크
    docs = self._store.similarity_search(query, k=self.settings.vector_top_k)
    sources = [self._to_source(doc) for doc in docs]

    # 2) 생성: 검색 청크를 컨텍스트로 묶어 조문 인용 답변 생성 (LCEL 체인)
    prompt = ChatPromptTemplate.from_messages(
        [("system", _SYSTEM_PROMPT), ("human", _HUMAN_PROMPT)]
    )
    chain = prompt | self._llm | StrOutputParser()
    answer = chain.invoke({"context": self._format_context(sources), "question": query})

    return SearchOutput(
        mode="vector",
        answer=answer.strip(),
        sources=sources,
        evidence={"sources": len(sources)},
    )`,
    },
    {
      id: "citation_label",
      name: "_citation_label()",
      fileId: "vector",
      summary: "장/조 메타데이터로 '특허법 제29조(특허요건)' 형식의 정밀 인용 라벨을 만드는 도우미",
      how: "인덱싱 단계에서 각 청크에 붙여 둔 chapter·article·article_title 메타데이터를 읽어, 사람이 읽을 수 있는 출처 제목을 조립합니다. 조 번호가 있으면 '특허법 제29조(특허요건)', 없으면 장으로, 그것도 없으면 파일명으로 단계적으로 대체합니다. 이 라벨 덕분에 답변의 근거가 '어느 조문에서 나왔는지' 추적(citation tracing)이 됩니다.",
      terms: ["메타데이터", "조문 인용", "인용 추적(citation tracing)", "f-string"],
      lines: [
        { at: "article = str(meta.get(\"article\", \"\")).strip()", text: "청크 메타데이터에서 조 라벨(예: '제29조')을 꺼냅니다." },
        { at: "label = f\"특허법 {article}\"", text: "'특허법 제29조' 형식의 기본 라벨을 만듭니다." },
        { at: "label += f\"({article_title})\"", text: "조 제목이 있으면 괄호로 덧붙여 '(특허요건)'까지 넣습니다." },
        { at: "return f\"특허법 {chapter}\"", text: "조 정보가 없으면 장 라벨로 대체합니다." },
      ],
      code: `@staticmethod
def _citation_label(meta: dict) -> str:
    """장/조 메타데이터로 '특허법 제29조(특허요건)' 형식의 정밀 인용 라벨을 만듦."""
    article = str(meta.get("article", "")).strip()
    article_title = str(meta.get("article_title", "")).strip()
    chapter = str(meta.get("chapter", "")).strip()
    if article:
        label = f"특허법 {article}"
        if article_title:
            label += f"({article_title})"
        return label
    if chapter:
        return f"특허법 {chapter}"
    return str(meta.get("source", "특허법"))`,
    },

    {
      id: "vector_helpers",
      name: "_to_source() · _format_context()",
      fileId: "vector",
      summary: "검색된 조문 Document를 출처 객체로 바꾸는 함수와, 청크들을 LLM 프롬프트용 문자열로 합치는 함수",
      how: "조문 벡터 검색의 두 도우미입니다. _to_source는 ChromaDB가 돌려준 Document(원문+메타데이터)를 표시용 SourceItem으로 바꾸며, _citation_label로 '특허법 제29조' 같은 인용 라벨을 붙이고 장/조/항 메타데이터를 함께 싣습니다(인용 추적 보존). _format_context는 찾은 청크 여러 개를 '[출처 N] 라벨 + 본문' 형태로 번호를 매겨 하나의 문자열로 합칩니다 — 이게 LLM에게 줄 [참고 조문] 컨텍스트가 됩니다. 결과가 없으면 '(검색 결과 없음)'으로 표시합니다.",
      terms: ["출처(source)", "조문 인용", "인용 추적(citation tracing)", "메타데이터", "ChromaDB", "f-string"],
      lines: [
        { at: "meta = doc.metadata or {}", text: "검색된 Document에서 장/조 메타데이터를 꺼냅니다(없으면 빈 딕셔너리)." },
        { at: "title=self._citation_label(meta),", text: "메타데이터로 '특허법 제29조(특허요건)' 인용 라벨을 만들어 제목으로 씁니다." },
        { at: "\"articles\": meta.get(\"articles\", \"\"),     # 한 청크에 여러 조가 병합된 경우", text: "한 청크에 여러 조가 섞였을 때를 대비해 조 목록도 보존합니다." },
        { at: "for index, src in enumerate(sources, start=1):", text: "청크마다 1부터 번호를 매겨 출처 블록을 만듭니다." },
        { at: "return \"\\n\\n---\\n\\n\".join(blocks) if blocks else \"(검색 결과 없음)\"", text: "블록들을 구분선으로 이어 하나의 컨텍스트로 — 없으면 '(검색 결과 없음)'." },
      ],
      code: `def _to_source(self, doc) -> SourceItem:
    """검색된 Document를 표시용 SourceItem으로 변환 (조문 라벨 + 핵심 메타데이터)."""
    meta = doc.metadata or {}
    return SourceItem(
        source_type="vector",
        title=self._citation_label(meta),
        content=str(doc.page_content)[:1200],  # MCP 응답 간결화를 위해 원문 길이 제한
        metadata={
            "chapter": meta.get("chapter", ""),
            "article": meta.get("article", ""),
            "articles": meta.get("articles", ""),     # 한 청크에 여러 조가 병합된 경우
            "clauses": meta.get("clauses", ""),       # 청크에 등장한 항(①②③) 마커
            "chunk_index": meta.get("chunk_index", ""),
        },
    )

@staticmethod
def _format_context(sources: list[SourceItem]) -> str:
    """검색 청크들을 LLM 프롬프트용 단일 문자열로 합침 (각 청크에 인용 라벨 부여)."""
    blocks = []
    for index, src in enumerate(sources, start=1):
        blocks.append(f"[출처 {index}] {src.title}\\n{src.content}")
    return "\\n\\n---\\n\\n".join(blocks) if blocks else "(검색 결과 없음)"`,
    },

    // ───────────────────────── retrieval/graphrag_retriever.py ─────────────────────────
    {
      id: "graphrag_search_async",
      name: "_search_async()",
      fileId: "graphrag",
      summary: "모드(local/global/drift)에 따라 알맞은 MS GraphRAG 검색 API를 호출",
      how: "조문 벡터 RAG와 달리, 엔티티(요건·권리·절차·기관) 사이의 관계와 커뮤니티 요약을 활용하는 구조적 질의입니다. local은 특정 엔티티 중심의 관계, global은 전체 주제 요약, drift는 둘을 결합한 복합 추론을 합니다. 선행 인덱싱이 만든 Parquet·LanceDB를 재인덱싱 없이 그대로 조회합니다. 모두 async 함수라 동기 코드에서 부르려면 뒤의 run_async 브리지가 필요합니다.",
      terms: ["GraphRAG", "KG(지식그래프)", "엔티티/관계/커뮤니티", "local/global/drift", "Parquet", "LanceDB", "동기/비동기(sync/async)"],
      lines: [
        { at: "if mode == \"local\":", text: "local 모드면 특정 엔티티 중심의 관계·근접 컨텍스트를 질의합니다." },
        { at: "answer, context = await global_search(", text: "global 모드면 커뮤니티 리포트 기반의 전체 주제·요약을 질의합니다." },
        { at: "else:  # drift", text: "drift 모드면 전체 primer + 세부 결합의 복합 추론(폴백 포함)을 실행합니다." },
        { at: "sources = self._collect_sources(context)", text: "검색이 돌려준 컨텍스트(엔티티/관계/리포트)를 표시용 출처로 변환합니다." },
      ],
      code: `# (일부 발췌) 모드별 GraphRAG API 분기
async def _search_async(self, query: str, mode: str) -> SearchOutput:
    if mode == "local":
        answer, context = await self._local(query)
    elif mode == "global":
        answer, context = await global_search(
            config=self.config,
            entities=self._frame("entities"),
            communities=self._frame("communities"),
            community_reports=self._frame("community_reports"),
            community_level=self.community_level,
            dynamic_community_selection=False,
            response_type=self.response_type,
            query=query,
        )
    else:  # drift
        return await self._drift_with_fallback(query)

    sources = self._collect_sources(context)
    return SearchOutput(
        mode=mode,
        answer=str(answer).strip(),
        sources=sources,
        evidence={"sources": len(sources)},
    )`,
    },
    {
      id: "drift_fallback",
      name: "_drift_with_fallback()",
      fileId: "graphrag",
      summary: "DRIFT 검색을 시도하되, JSON primer 파싱이 반복 실패하면 Local 검색으로 우아하게 폴백",
      how: "DRIFT는 LLM이 먼저 JSON 형식의 primer를 만들어야 하는데, gpt-oss가 가끔 깨진 JSON을 반환합니다. 정해진 횟수만큼 재시도하고, 그래도 JSON 오류면 Local Search로 대체해 빈손으로 끝나지 않게 합니다(graceful degradation). 단, JSON 외의 진짜 오류는 그대로 전파해 숨기지 않습니다. 비결정적인 LLM을 실전에서 안전하게 다루는 방어 패턴입니다.",
      terms: ["DRIFT Search", "graceful degradation(우아한 성능 저하)", "폴백(fallback)", "JSON 파싱 오류", "비결정성"],
      lines: [
        { at: "for attempt in range(self.drift_json_retries + 1):", text: "정해진 횟수만큼 DRIFT 검색을 재시도합니다." },
        { at: "answer, context = await drift_search(", text: "DRIFT 검색(전체 primer + 세부 결합)을 시도합니다." },
        { at: "if not is_json_parse_error(exc):", text: "JSON 파싱 오류가 아니면(진짜 오류면) 숨기지 않고 그대로 전파합니다." },
        { at: "answer, context = await self._local(query)", text: "재시도를 다 쓰면 Local Search로 폴백해 결과를 확보합니다." },
        { at: "mode=\"local\",", text: "폴백했음을 결과 모드와 note에 정직하게 기록합니다." },
      ],
      code: `async def _drift_with_fallback(self, query: str) -> SearchOutput:
    """DRIFT Search를 시도하되, primer JSON 파싱이 반복 실패하면 Local Search로 폴백함."""
    errors: list[str] = []
    for attempt in range(self.drift_json_retries + 1):
        try:
            answer, context = await drift_search(
                config=self.config,
                entities=self._frame("entities"),
                communities=self._frame("communities"),
                community_reports=self._frame("community_reports"),
                text_units=self._frame("text_units"),
                relationships=self._frame("relationships"),
                community_level=self.community_level,
                response_type=self.response_type,
                query=query,
            )
            sources = self._collect_sources(context)
            return SearchOutput(
                mode="drift",
                answer=str(answer).strip(),
                sources=sources,
                evidence={"sources": len(sources)},
            )
        except Exception as exc:
            if not is_json_parse_error(exc):
                raise  # JSON 외 오류는 그대로 전파
            errors.append(f"attempt={attempt + 1}: {exc}")

    # 재시도 소진 → Local Search로 폴백 (graceful degradation)
    answer, context = await self._local(query)
    note = (
        f"DRIFT primer JSON 파싱 실패가 {len(errors)}회 반복되어 "
        f"Local Search로 폴백함"
    )
    logger.warning(note)
    return SearchOutput(
        mode="local",
        answer=str(answer).strip(),
        sources=self._collect_sources(context),
        note=note,
    )`,
    },

    {
      id: "graphrag_local",
      name: "_local() · _collect_sources()",
      fileId: "graphrag",
      summary: "Local Search 실제 호출 함수와, 검색 결과 컨텍스트를 표시용 출처로 변환하는 함수",
      how: "GraphRAG 검색의 두 부품입니다. _local은 Microsoft GraphRAG의 local_search API를 호출합니다 — 엔티티·관계·커뮤니티 리포트·텍스트유닛 같은 지식그래프 조각(Parquet 프레임)을 모두 넘겨 '특정 개념 주변의 관계와 근접 맥락'을 질의합니다(drift 폴백도 이걸 재사용). _collect_sources는 검색이 돌려준 컨텍스트(엔티티/관계/리포트 표)를 훑어 화면·응답에 보여 줄 출처 목록으로 바꾸되, 너무 많지 않게 상한(graph_top_sources)까지만 모읍니다.",
      terms: ["GraphRAG", "local/global/drift", "엔티티/관계/커뮤니티", "Parquet", "지연 로딩(lazy loading)", "출처(source)"],
      lines: [
        { at: "return await local_search(", text: "Microsoft GraphRAG의 Local Search API를 비동기로 호출합니다." },
        { at: "relationships=self._frame(\"relationships\"),", text: "엔티티 사이의 관계 표를 넘겨 '근접 맥락'을 함께 보게 합니다." },
        { at: "covariates=self._optional_frame(\"covariates\"),", text: "있으면 부가 정보(covariates)도 넘깁니다 — 없으면 None(선택적)." },
        { at: "for source_type, frame in _iter_context_frames(context_data):", text: "검색이 돌려준 여러 결과 표(엔티티/관계/리포트)를 하나씩 순회합니다." },
        { at: "if len(sources) >= max_items:", text: "출처가 상한에 도달하면 더 모으지 않고 즉시 반환합니다(응답 간결화)." },
      ],
      code: `async def _local(self, query: str) -> tuple[Any, Any]:
    return await local_search(
        config=self.config,
        entities=self._frame("entities"),
        communities=self._frame("communities"),
        community_reports=self._frame("community_reports"),
        text_units=self._frame("text_units"),
        relationships=self._frame("relationships"),
        covariates=self._optional_frame("covariates"),
        community_level=self.community_level,
        response_type=self.response_type,
        query=query,
    )

def _collect_sources(self, context_data: Any) -> list[SourceItem]:
    """GraphRAG 컨텍스트(엔티티/관계/리포트 프레임)를 간결한 표시용 출처로 변환함."""
    max_items = self.settings.graph_top_sources
    sources: list[SourceItem] = []
    for source_type, frame in _iter_context_frames(context_data):
        if frame.empty:
            continue
        for _, row in frame.head(max_items).iterrows():
            sources.append(_source_from_row(source_type, row))
            if len(sources) >= max_items:
                return sources
    return sources`,
    },

    {
      id: "graphrag_normalize",
      name: "_iter_context_frames() · _source_from_row()",
      fileId: "graphrag",
      summary: "GraphRAG 컨텍스트의 들쭉날쭉한 모양을 표준 표 목록으로 정리하고, 행 하나를 출처로 바꾸는 헬퍼",
      how: "GraphRAG는 검색 방식(콜백 변형)에 따라 결과 컨텍스트의 모양이 제각각입니다 — 단일 표일 수도, '이름→표' 딕셔너리일 수도, 표들의 목록일 수도 있습니다. _iter_context_frames가 이 셋을 모두 받아 '(이름, 표)' 목록으로 통일합니다(방어적 정규화). _source_from_row는 그렇게 정리된 표의 한 행을 표시용 출처로 바꿉니다 — 제목·본문이 될 컬럼을 후보 중 첫 번째 있는 것으로 고르고, source/target가 있으면 관계로 보아 'A -> B' 제목을 만들며, 본문은 너무 길지 않게 잘라 담습니다.",
      terms: ["GraphRAG", "정규화(normalize)", "엔티티/관계/커뮤니티", "출처(source)", "메타데이터", "예외 처리(try/except)"],
      lines: [
        { at: "if isinstance(context_data, pd.DataFrame):", text: "컨텍스트가 단일 표면 그대로 한 항목으로 담습니다." },
        { at: "elif isinstance(context_data, dict):", text: "'이름→표' 딕셔너리면 각 표를 이름과 함께 꺼냅니다." },
        { at: "if \"source\" in data and \"target\" in data:  # 관계(relationship) 행", text: "행에 source·target가 있으면 관계로 보아 'A -> B' 제목을 만듭니다." },
        { at: "if key not in {\"text\", \"full_content\", \"summary\", \"description\", \"content\", \"report\"}", text: "본문에 쓴 큰 컬럼은 빼고 나머지만 메타데이터로 담습니다(중복 방지)." },
        { at: "content=_stringify(content)[:1200],  # MCP 응답 간결화", text: "본문은 1200자까지만 잘라 응답을 가볍게 유지합니다." },
      ],
      code: `def _iter_context_frames(context_data: Any) -> list[tuple[str, pd.DataFrame]]:
    """GraphRAG 컨텍스트에서 이름 붙은 DataFrame 목록을 추출함."""
    frames: list[tuple[str, pd.DataFrame]] = []
    if isinstance(context_data, pd.DataFrame):
        frames.append(("context", context_data))
    elif isinstance(context_data, dict):
        for name, value in context_data.items():
            if isinstance(value, pd.DataFrame):
                frames.append((str(name), value))
            elif isinstance(value, list) and value and isinstance(value[0], dict):
                frames.append((str(name), pd.DataFrame(value)))
    elif isinstance(context_data, list):
        for idx, value in enumerate(context_data):
            if isinstance(value, pd.DataFrame):
                frames.append((f"context_{idx}", value))
    return frames


def _source_from_row(source_type: str, row: pd.Series) -> SourceItem:
    """GraphRAG 컨텍스트 행 하나를 표시용 SourceItem으로 변환함."""
    data = row.to_dict()
    title = _first_present(data, ["title", "source", "id", "community", "human_readable_id"])
    if "source" in data and "target" in data:  # 관계(relationship) 행
        title = f"{data.get('source')} -> {data.get('target')}"
    content = _first_present(
        data, ["description", "summary", "text", "full_content", "content", "report"]
    )
    metadata = {
        key: _stringify(value)
        for key, value in data.items()
        if key not in {"text", "full_content", "summary", "description", "content", "report"}
    }
    return SourceItem(
        source_type=source_type,
        title=_stringify(title)[:160],
        content=_stringify(content)[:1200],  # MCP 응답 간결화
        metadata=metadata,
    )`,
    },

    // ───────────────────────── retrieval/async_utils.py ─────────────────────────
    {
      id: "run_async",
      name: "run_async()",
      fileId: "async",
      summary: "동기 함수 안에서 async GraphRAG 코루틴을 안전하게 실행하는 이벤트 루프 브리지",
      how: "GraphRAG 검색은 모두 async(코루틴)인데, 이 MAS는 LangGraph도 MCP 도구도 동기로 돌립니다. 문제는 '실행 중인 이벤트 루프'가 있는지가 실행 맥락마다 다르다는 점입니다. 루프가 없으면 현재 스레드에 새 루프를 만들어 실행하고, 이미 루프가 떠 있으면(MCP 워커) 별도 스레드에서 독립 루프로 돌려 'event loop is already running' 충돌을 피합니다. 동기/비동기 세계를 잇는 다리입니다.",
      terms: ["코루틴(coroutine)", "이벤트 루프(event loop)", "동기/비동기(sync/async)", "asyncio", "ThreadPoolExecutor", "FastMCP"],
      lines: [
        { at: "asyncio.get_running_loop()", text: "지금 이 스레드에 실행 중인 이벤트 루프가 있는지 확인합니다." },
        { at: "except RuntimeError:", text: "루프가 없으면(가장 흔한 경우) 예외가 나고, 아래로 내려갑니다." },
        { at: "return _run_in_new_loop(coro)", text: "루프가 없으면 현재 스레드에 새 루프를 만들어 직접 실행합니다." },
        { at: "with ThreadPoolExecutor(max_workers=1) as pool:", text: "루프가 이미 떠 있으면(MCP 워커) 별도 스레드에서 독립 루프로 실행합니다." },
      ],
      code: `def run_async(coro: Awaitable[T]) -> T:
    """코루틴을 동기적으로 실행하고 결과를 반환함.

    현재 스레드에 실행 중인 이벤트 루프가 있으면(예: MCP 워커), 코루틴을 별도 스레드에서
    독립 루프로 실행해 충돌을 피함. 루프가 없으면 현재 스레드에 새 루프를 만들어 실행함.
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        # 실행 중 루프 없음 → 현재 스레드에서 직접 실행 (가장 일반적인 경로)
        return _run_in_new_loop(coro)

    # 실행 중 루프 있음 → 새 스레드에서 독립 루프로 실행 (블로킹 대기)
    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(_run_in_new_loop, coro).result()`,
    },

    {
      id: "async_helpers",
      name: "_run_in_new_loop() · is_json_parse_error()",
      fileId: "async",
      summary: "전용 이벤트 루프로 코루틴을 끝까지 돌리는 실행기와, DRIFT의 JSON 파싱 오류를 판별하는 함수",
      how: "run_async를 뒷받침하는 두 도우미입니다. _run_in_new_loop는 새 이벤트 루프를 만들어 코루틴을 끝까지 실행하고, 끝나면 남은 태스크를 취소·수거한 뒤 루프를 닫아 리소스 누수를 막습니다(뒷정리 철저). is_json_parse_error는 예외가 'JSON 파싱 실패'인지 판별합니다 — 진짜 JSONDecodeError이거나, 오류 메시지에 'json'·'expecting value' 같은 단서가 들어 있으면 참으로 봅니다. drift 폴백이 '이 오류는 폴백해도 되는 것'인지 가리는 데 이 판별이 쓰입니다.",
      terms: ["코루틴(coroutine)", "이벤트 루프(event loop)", "asyncio", "JSON 파싱 오류", "DRIFT Search", "폴백(fallback)"],
      lines: [
        { at: "loop = asyncio.new_event_loop()", text: "이 실행 전용으로 새 이벤트 루프를 만듭니다." },
        { at: "return loop.run_until_complete(coro)", text: "코루틴을 끝까지 실행하고 그 결과를 돌려줍니다." },
        { at: "task.cancel()", text: "끝난 뒤 남아 있는 비동기 태스크를 모두 취소합니다(뒷정리)." },
        { at: "if isinstance(exc, json.JSONDecodeError):", text: "예외가 진짜 JSON 디코드 오류면 곧바로 '맞다'고 판정합니다." },
        { at: "return any(pattern in text for pattern in patterns)", text: "메시지에 'json'·'expecting value' 등 단서가 있으면 JSON 오류로 봅니다." },
      ],
      code: `def _run_in_new_loop(coro: Awaitable[T]) -> T:
    """전용 이벤트 루프를 만들어 코루틴을 끝까지 실행하고 깔끔히 정리함."""
    loop = asyncio.new_event_loop()
    # DRIFT의 JSON 파싱 실패가 백그라운드 태스크 로그로 시끄럽게 찍히는 것을 억제함
    loop.set_exception_handler(_quiet_json_errors)
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)
    finally:
        # 남은 태스크를 취소·수거한 뒤 루프를 닫아 리소스 누수를 방지함
        pending = asyncio.all_tasks(loop)
        for task in pending:
            task.cancel()
        if pending:
            loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
        loop.run_until_complete(loop.shutdown_asyncgens())
        asyncio.set_event_loop(None)
        loop.close()


def is_json_parse_error(exc: Exception) -> bool:
    """DRIFT Search primer/follow-up이 던지는 JSON 파싱 실패를 감지함."""
    if isinstance(exc, json.JSONDecodeError):
        return True
    text = f"{type(exc).__name__}: {exc}".lower()
    patterns = ("json", "expecting value", "unterminated string", "extra data",
                "invalid control character", "could not parse")
    return any(pattern in text for pattern in patterns)`,
    },

    // ───────────────────────── config/settings.py ─────────────────────────
    {
      id: "settings_consts",
      name: "Settings 주요 설정값",
      fileId: "config",
      summary: "인덱스 경로·임베딩/LLM 모델·검색 파라미터·Loop Guard 한도를 한곳에 모은 설정",
      how: "코드 곳곳에서 settings.XXX로 참조하는 값을 이 한 파일에 모읍니다. 두 선행 인덱스(ChromaDB·GraphRAG)를 재임베딩 없이 조회하는 데 필요한 경로, OpenAI 임베딩·Groq LLM 모델명, 검색 상위 K, 그리고 Supervisor의 재검색 한도(supervisor_max_reroutes=1) 같은 핵심 값이 들어 있습니다. 값을 바꾸려면 코드를 뒤질 필요 없이 여기만 고치면 됩니다.",
      terms: ["설정(config)", "ChromaDB", "GraphRAG", "text-embedding-3-small", "gpt-oss-120b", "Loop Guard(루프 가드)", "컬렉션(collection)"],
      lines: [
        { at: "collection_name: str = \"patent_law\"", text: "조회할 ChromaDB 컬렉션 이름 — 인덱싱 때와 같아야 검색이 됩니다." },
        { at: "embedding_model: str = \"text-embedding-3-small\"", text: "질의 임베딩 모델 — 인덱싱과 동일(1536차원)해야 의미 공간이 맞습니다." },
        { at: "llm_model: str = \"openai/gpt-oss-120b\"", text: "라우팅·답변·평가에 공통 사용하는 Groq LPU LLM." },
        { at: "vector_top_k: int = 5", text: "벡터 검색에서 가져올 유사 조문 청크 개수." },
        { at: "supervisor_max_reroutes: int = 1", text: "Supervisor가 보완 모드로 재검색하는 최대 횟수(Loop Guard) — 무한 전환 방지." },
        { at: "community_level: int = 2", text: "GraphRAG 커뮤니티 계층 레벨(작을수록 상위 요약, 클수록 세분화)." },
      ],
      code: `# (일부 발췌) config/settings.py — MAS 전역 설정값

# === 조문 벡터 RAG 설정 ===
collection_name: str = "patent_law"               # 인덱싱과 동일해야 검색 가능 (컬렉션명 고정)
embedding_model: str = "text-embedding-3-small"   # 질의 임베딩 모델 (인덱싱과 동일, 1536차원)
vector_top_k: int = 5                              # 유사도 상위 K개 조문 청크 (Naive RAG 통상값)

# === GraphRAG 설정 ===
community_level: int = 2                            # 커뮤니티 계층 레벨

# === LLM 설정 (Groq LPU, 클라우드) ===
llm_model: str = "openai/gpt-oss-120b"
llm_temperature: float = 0.0                       # 재현 가능한(결정적) 응답

# === MAS 워크플로(SAS) 설정 ===
# 1이면 최대 2패스(1차 + 보완 1차)까지만 수행해 무한 모드 전환을 방지함.
supervisor_max_reroutes: int = 1`,
    },
    {
      id: "validate_stores",
      name: "validate_stores() · ensure_api_keys()",
      fileId: "config",
      summary: "검색 전에 선행 인덱스 산출물과 API 키가 모두 갖춰졌는지 미리 검증하는 함수",
      how: "이 MAS는 자체 인덱싱을 하지 않고 두 선행 인덱스(ChromaDB·GraphRAG Parquet/LanceDB)에 의존합니다. 그래서 초기화 시점에 필요한 파일이 다 있는지, API 키가 설정됐는지를 먼저 확인합니다. 검색 중간에 401(키 없음)이나 빈 결과로 실패하면 원인 파악이 어렵기 때문에, '문제를 일찍·명확하게' 드러내는 fail-fast 설계입니다.",
      terms: ["fail-fast(조기 실패)", "API 키 검증", "인덱싱 산출물", "Parquet", "LanceDB"],
      lines: [
        { at: "if not self.groq_api_key.strip():", text: "LLM용 GROQ_API_KEY가 비었는지 검사합니다." },
        { at: "missing.append(\"OPENAI_API_KEY(임베딩)\")", text: "임베딩용 OpenAI 키가 없으면 누락 목록에 추가합니다." },
        { at: "self.vector_store_dir / \"chroma.sqlite3\",", text: "조문 벡터 RAG 인덱스 파일이 있는지 확인합니다." },
        { at: "self.graphrag_parquet_dir / \"entities.parquet\",", text: "GraphRAG 지식그래프 엔티티 파일이 있는지 확인합니다." },
        { at: "return [str(path) for path in required if not path.exists()]", text: "존재하지 않는 경로만 모아 돌려줍니다(빈 목록이면 OK)." },
      ],
      code: `# (일부 발췌) 키·인덱스 사전 검증 (fail-fast)
def ensure_api_keys(self) -> None:
    """LLM/임베딩 호출 전에 키 존재를 먼저 검증 — 미설정 시 검색 단계 401 대신 즉시 실패시킴."""
    missing = []
    if not self.groq_api_key.strip():
        missing.append("GROQ_API_KEY(LLM)")
    if not self.openai_api_key.strip():
        missing.append("OPENAI_API_KEY(임베딩)")
    if missing:
        raise RuntimeError(
            f"필수 API 키 미설정: {', '.join(missing)}. "
            f"{self.env_path} 파일을 확인하세요."
        )

def validate_stores(self) -> list[str]:
    """선행 인덱싱 산출물이 모두 존재하는지 검사해 누락 경로를 문자열 목록으로 반환함."""
    required = [
        self.vector_store_dir / "chroma.sqlite3",          # 조문 벡터 RAG
        self.graphrag_root / "settings.yaml",              # GraphRAG 설정
        self.graphrag_parquet_dir / "entities.parquet",    # KG 엔티티
        self.graphrag_parquet_dir / "relationships.parquet",
        self.graphrag_parquet_dir / "community_reports.parquet",
        self.graphrag_parquet_dir / "text_units.parquet",
        self.graphrag_vector_dir,                          # LanceDB 임베딩 테이블 디렉터리
    ]
    return [str(path) for path in required if not path.exists()]`,
    },

    {
      id: "quiet_errors",
      name: "_quiet_json_errors()",
      fileId: "async",
      summary: "이벤트 루프의 예외 핸들러 — DRIFT의 JSON 파싱 오류 로그만 조용히 무시하고 나머지는 그대로 출력",
      how: "전용 루프(_run_in_new_loop)에 등록되는 예외 핸들러입니다. DRIFT 검색은 백그라운드에서 JSON 파싱에 가끔 실패하는데, 그 실패는 이미 상위에서 폴백으로 처리하므로 로그까지 시끄럽게 찍을 필요가 없습니다. 이 핸들러가 그런 'JSON 파싱 오류'만 골라 조용히 삼키고(무시), 그 외 진짜 오류는 파이썬 기본 핸들러로 넘겨 정상적으로 보이게 합니다. '예상된 소음만 끄고, 진짜 경보는 살려 두는' 필터입니다.",
      terms: ["이벤트 루프(event loop)", "JSON 파싱 오류", "DRIFT Search", "예외 처리(try/except)"],
      lines: [
        { at: "exc = context.get(\"exception\")", text: "이벤트 루프가 잡은 예외 객체를 꺼냅니다." },
        { at: "if isinstance(exc, Exception) and is_json_parse_error(exc):", text: "그 예외가 'JSON 파싱 오류'인지 판별합니다." },
        { at: "return", text: "JSON 오류면 아무것도 하지 않고 조용히 무시합니다(로그 억제)." },
        { at: "loop.default_exception_handler(context)", text: "그 외 진짜 오류는 기본 핸들러로 넘겨 정상 출력합니다." },
      ],
      code: `def _quiet_json_errors(loop: asyncio.AbstractEventLoop, context: dict[str, Any]) -> None:
    """DRIFT primer JSON 파싱 실패 로그만 조용히 무시하고, 그 외 오류는 정상 출력함."""
    exc = context.get("exception")
    if isinstance(exc, Exception) and is_json_parse_error(exc):
        return
    loop.default_exception_handler(context)`,
    },

    // ───────────────────────── config/llm.py ─────────────────────────
    {
      id: "llm_factory",
      name: "build_chat_llm() · build_structured_llm()",
      fileId: "llm",
      summary: "라우팅·답변·평가가 같은 방식으로 Groq LLM을 만들도록 모은 공용 팩토리 2종(일반·구조화 출력)",
      how: "MAS 곳곳에서 LLM이 필요한데, 매번 따로 만들면 설정이 어긋나기 쉽습니다. 그래서 '만드는 법'을 이 한곳에 모읍니다(팩토리). build_chat_llm은 모델명·키·온도로 ChatGroq를 만들되, gpt-oss 계열일 때만 reasoning_format=\"hidden\"을 넣어 사고 과정을 숨기고 최종 답만 받게 합니다(다른 모델에 넣으면 오류). build_structured_llm은 그 위에 with_structured_output(method=\"json_schema\")를 얹어, LLM이 자유 문장이 아니라 '정해진 키를 가진 JSON'으로만 답하게 강제합니다 — 라우팅 결정·충분성 판정처럼 결과를 안정적으로 파싱해야 하는 곳에 씁니다.",
      terms: ["LLM", "팩토리(factory)", "gpt-oss-120b", "reasoning_format", "구조화 출력(structured output)", "json_schema"],
      lines: [
        { at: "\"temperature\": settings.llm_temperature if temperature is None else temperature,", text: "온도(무작위성)를 지정 — 미지정 시 설정값(보통 0=재현 가능)을 씁니다." },
        { at: "if \"gpt-oss\" in settings.llm_model:", text: "gpt-oss 계열일 때만 reasoning_format을 추가합니다(다른 모델엔 넣지 않음)." },
        { at: "kwargs[\"reasoning_format\"] = \"hidden\"", text: "사고 과정을 숨기고 최종 답변만 반환하도록 설정합니다." },
        { at: "return build_chat_llm(settings, max_tokens=512).with_structured_output(", text: "일반 LLM 위에 구조화 출력을 얹어 'JSON으로만 답하는' LLM을 만듭니다." },
        { at: "schema, method=\"json_schema\"", text: "JSON 스키마를 모델에 강제해 자연어 파싱의 불안정성을 제거합니다." },
      ],
      code: `def build_chat_llm(settings: Settings, *, max_tokens: int | None = None,
                   temperature: float | None = None) -> ChatGroq:
    """Groq LPU에 연결된 ChatGroq 인스턴스를 생성함.

    Args:
        settings: 전역 설정(모델명·키·온도).
        max_tokens: 응답 토큰 한도(미지정 시 모델 기본값).
        temperature: 샘플링 온도(미지정 시 settings.llm_temperature).
    """
    kwargs: dict[str, Any] = {
        "model": settings.llm_model,
        "api_key": settings.groq_api_key,
        "temperature": settings.llm_temperature if temperature is None else temperature,
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    # gpt-oss 계열에만 reasoning_format을 전달 (다른 모델에 넣으면 무시되거나 오류)
    if "gpt-oss" in settings.llm_model:
        kwargs["reasoning_format"] = "hidden"
    return ChatGroq(**kwargs)


def build_structured_llm(settings: Settings, schema: Any):
    """구조화 출력 전용 LLM을 생성함 — with_structured_output(method="json_schema").

    라우팅 결정·근거 충분성 판정처럼 '정해진 키를 가진 JSON'을 안정적으로 받아야 하는 곳에서 사용함.
    method="json_schema"는 모델에 JSON 스키마를 강제해, 자연어에서 JSON을 파싱하는 불안정성을 제거함.
    """
    return build_chat_llm(settings, max_tokens=512).with_structured_output(
        schema, method="json_schema"
    )`,
    },
  ],

  glossary: {
    "MCP": "Model Context Protocol. AI 모델/앱이 외부 도구·데이터·프롬프트를 표준 규격으로 주고받게 하는 약속. '도구를 꽂는 표준 콘센트'에 비유됨.",
    "FastMCP": "MCP 서버를 파이썬으로 쉽게 만드는 라이브러리. 함수의 타입 힌트·docstring을 읽어 도구 규격(JSON Schema)을 자동 생성함.",
    "MCP 도구(Tool)": "MCP가 외부에 노출하는 '실행 가능한 동작'. 여기서는 특허법을 검색·답변하는 ask_patent_law.",
    "MCP 리소스(Resource)": "MCP가 노출하는 '읽기 전용 데이터'. URI로 조회하며 부작용이 없음. 여기서는 KG 통계/스키마.",
    "MCP 프롬프트(Prompt)": "MCP가 노출하는 '재사용 가능한 지시문 템플릿'. 슬래시 명령 등으로 골라 씀.",
    "@mcp.tool()": "함수를 MCP 도구로 등록하는 데코레이터(함수 위에 붙이는 표식).",
    "@mcp.resource()": "함수를 특정 URI의 읽기 전용 리소스로 등록하는 데코레이터.",
    "@mcp.prompt()": "함수를 재사용 프롬프트 템플릿으로 등록하는 데코레이터.",
    "Streamable HTTP": "MCP의 전송 방식 중 하나. 하나의 /mcp 주소로 양방향 통신함. 원격·로컬 모두 같은 방식으로 붙을 수 있음.",
    "엔드포인트": "서버에 접속하는 주소(URL 경로). 여기서는 /mcp.",
    "URI": "자원을 가리키는 주소 문자열. 여기서는 'patent://kg/stats'처럼 리소스를 식별함.",
    "JSON Schema": "데이터의 모양(어떤 키·타입이 있는지)을 정의하는 규격. FastMCP가 도구 입출력 규격을 이걸로 자동 생성함.",
    "SAS(Scheduler-Agent-Supervisor)": "조율자(Scheduler)가 작업을 나누고, 일꾼(Agent)이 실행하며, 감독자(Supervisor)가 결과를 검수·통제하는 멀티에이전트 구조(교재 §2.1). 이 예제는 Scheduler+Agent+Supervisor로 구성됨.",
    "MAS(멀티에이전트 시스템)": "여러 전문 에이전트(부서)가 협력해 문제를 푸는 시스템. 이 예제는 '법령지식'을 맡는 한 축임.",
    "LangGraph": "노드와 엣지로 'AI 워크플로'를 그래프처럼 표현·실행하는 라이브러리. 분기·반복·상태 공유가 쉬움.",
    "StateGraph": "LangGraph에서 공유 State를 기준으로 노드·엣지를 조립하는 그래프 빌더.",
    "노드(node)": "그래프의 한 처리 단계(함수). 여기선 scheduler/agent/supervisor/fuse.",
    "엣지(edge)": "노드와 노드를 잇는 화살표(다음에 갈 곳).",
    "조건부 엣지(conditional edge)": "State 값에 따라 다음 노드를 다르게 정하는 갈림길 엣지. 여기선 next_step으로 재검색/융합/종료를 가름.",
    "공유 State": "그래프의 모든 노드가 함께 읽고 쓰는 공용 메모장(딕셔너리). 노드가 결과를 여기에 적어 다음 노드에 전달함.",
    "reducer(누적)": "여러 노드/패스가 같은 State 필드에 값을 '덮어쓰지 않고 쌓도록' 합치는 규칙. 여기선 passes·tried_modes에 사용.",
    "compile": "그래프 설계도를 실제로 실행 가능한 객체로 만드는 단계.",
    "graph.invoke": "컴파일된 그래프를 시작 State와 함께 처음부터 끝까지 한 번 실행하는 호출.",
    "Router(라우터)": "질문을 보고 어떤 검색 모드로 보낼지 정하는 부품. 여기선 Scheduler의 두뇌.",
    "Scheduler": "SAS에서 '어떤 작업(모드)을 할지' 정하는 역할. 이 예제에선 검색 모드를 라우팅함.",
    "Supervisor": "SAS에서 일꾼의 결과를 검수하고 다음 행동(재검색/융합/종료)을 지시하는 감독 역할.",
    "보완 모드(상보적 검색)": "1차 검색이 부족할 때, 역할이 다른 두 번째 모드로 보충 검색하는 것(예: 벡터→GraphRAG).",
    "Loop Guard(루프 가드)": "재검색·모드 전환이 무한 반복되지 않도록 횟수를 제한하는 안전장치. 여기선 max_reroutes=1.",
    "충분성 평가": "검색 답변이 질문에 충분히 답했는지 판정하는 단계. 부족하면 보완 검색을 유발함.",
    "융합(fusion)": "조문 원문(벡터)과 관계/구조(GraphRAG)처럼 서로 다른 근거를 하나의 답변으로 합치는 것. 이 MAS의 핵심 가치.",
    "벡터 검색": "글의 의미를 숫자(벡터)로 바꿔, 의미가 가까운 문서를 찾는 검색 방식.",
    "RAG(검색 증강 생성)": "먼저 관련 문서를 검색(Retrieval)하고, 그 근거로 LLM이 답을 생성(Generation)하는 방식. 환각을 줄임.",
    "GraphRAG": "문서를 엔티티·관계·커뮤니티의 지식그래프로 만들어 검색하는 RAG의 한 갈래. 관계·전체 구조 질의에 강함.",
    "KG(지식그래프)": "개념(노드)과 그 사이 관계(엣지)로 지식을 표현한 그래프. 여기선 특허법 요건·권리·절차의 그물망.",
    "엔티티/관계/커뮤니티": "지식그래프의 구성요소 — 엔티티(개념), 관계(엔티티 간 연결), 커뮤니티(서로 밀접한 엔티티 묶음).",
    "local/global/drift": "GraphRAG의 세 검색 모드 — local(엔티티 중심 관계), global(전체 주제 요약), drift(둘을 결합한 복합 추론).",
    "DRIFT Search": "GraphRAG의 복합 검색. 전체 요약(primer)으로 방향을 잡고 세부 질의를 이어 붙임. primer를 JSON으로 만드는 단계가 불안정할 수 있음.",
    "ChromaDB": "벡터를 저장하고 '의미가 가까운 것'을 빠르게 찾아 주는 벡터 전용 데이터베이스.",
    "컬렉션(collection)": "벡터 DB 안에서 같은 종류 데이터를 모아 둔 묶음(테이블 같은 것). 여기 이름은 patent_law.",
    "similarity_search": "질문 벡터와 의미가 가까운 청크를 벡터 DB에서 찾아 주는 검색 함수.",
    "임베딩(embedding)": "글의 의미를 숫자 목록(벡터)으로 바꾸는 것. 의미가 비슷하면 벡터도 가까움.",
    "text-embedding-3-small": "OpenAI의 임베딩 모델 이름. 텍스트를 1536차원 벡터로 변환함.",
    "gpt-oss-120b": "Groq LPU에서 돌리는 오픈 LLM. 라우팅·답변·평가에 공통 사용. 구조화 출력(json_schema)을 지원함.",
    "조문 인용": "답변의 근거로 '특허법 제○○조'처럼 정확한 조문 번호를 함께 제시하는 것.",
    "인용 추적(citation tracing)": "답변이 어느 조문에서 나왔는지 출처를 되짚는 것. 메타데이터 라벨로 가능해짐.",
    "메타데이터": "본문에 붙는 부가 정보(장/조/항·출처 등). 인용 추적과 출처 표시에 씀.",
    "LCEL 체인": "LangChain에서 프롬프트|모델|파서를 파이프(|)로 이어 만든 처리 파이프라인.",
    "구조화 출력(structured output)": "LLM이 자유 문장이 아니라 '정해진 키를 가진 JSON'으로 답하게 강제하는 것. 라우팅 결정·충분성 판정에 사용.",
    "LLM 폴백": "규칙(패턴)만으로 결정이 애매할 때, LLM에게 판단을 맡겨 보충하는 것.",
    "패턴 매칭": "정해진 키워드·정규식 규칙으로 질문을 분류하는 방식. 빠르고 비용이 없음.",
    "키워드 점수": "각 모드의 대표 키워드가 질문에 몇 개 들어 있는지 세어 매긴 점수.",
    "확신도(confidence)": "라우팅 결정이 얼마나 확실한지 0~1로 나타낸 값. 낮으면 LLM 폴백으로 넘어감.",
    "정규식(re)": "글자 패턴을 규칙으로 표현해 찾기/바꾸기를 하는 도구(파이썬 표준 모듈 re). 예: '제\\d+조'.",
    "코루틴(coroutine)": "async def로 만든 '잠시 멈췄다 이어 실행할 수 있는' 함수. await로 결과를 기다림.",
    "이벤트 루프(event loop)": "코루틴들을 번갈아 실행·관리하는 비동기 엔진. 한 스레드에 하나만 돌 수 있음.",
    "동기/비동기(sync/async)": "동기는 한 줄씩 끝나야 다음으로 가는 방식, 비동기는 기다리는 동안 다른 일을 하는 방식.",
    "asyncio": "파이썬의 비동기 실행 표준 라이브러리(이벤트 루프·코루틴 관리).",
    "ThreadPoolExecutor": "여러 작업을 스레드 풀에서 실행하는 파이썬 도구. 여기선 별도 스레드로 독립 루프를 돌리는 데 씀.",
    "JSON 파싱 오류": "문자열을 JSON으로 해석하다 형식이 깨져 실패하는 것. DRIFT primer 생성에서 가끔 발생.",
    "graceful degradation(우아한 성능 저하)": "한 기능이 실패해도 빈손이 아니라 대안으로 부드럽게 내려앉는 것. 여기선 DRIFT→Local 폴백.",
    "폴백(fallback)": "기본 방법이 실패했을 때 쓰는 대비책.",
    "비결정성": "같은 입력이라도 결과가 매번 달라질 수 있는 성질. LLM의 특성이라 방어 코드가 필요함.",
    "Parquet": "표 데이터를 효율적으로 저장하는 파일 형식. GraphRAG가 엔티티·관계 등을 이 형식으로 저장함.",
    "LanceDB": "벡터를 저장·검색하는 데이터베이스. GraphRAG가 임베딩 테이블 저장에 사용.",
    "fail-fast(조기 실패)": "문제가 있으면 한참 뒤가 아니라 시작 시점에 곧바로 명확히 실패시키는 설계.",
    "API 키 검증": "외부 서비스 호출에 필요한 키가 설정됐는지 미리 확인하는 것.",
    "인덱싱 산출물": "선행 인덱싱이 만들어 둔 검색용 데이터(ChromaDB·Parquet·LanceDB 등).",
    "싱글턴": "객체를 딱 하나만 만들어 모두가 공유하는 설계. 여기선 무거운 MAS를 1회만 생성.",
    "지연 초기화(lazy init)": "필요해질 때(첫 호출 때)까지 미뤘다가 만드는 것. 서버 기동을 빠르게 함.",
    "지연 로딩(lazy loading)": "데이터를 미리 다 읽지 않고 실제로 쓸 때 읽는 것. Parquet 캐시에 사용.",
    "global 변수": "함수 밖에서 정의돼 여러 함수가 공유하는 변수. global 선언으로 함수 안에서 바꿈.",
    "예외 처리(try/except)": "오류가 나도 프로그램이 죽지 않게 try로 감싸고 except로 대응하는 것.",
    "중복 제거(dedup)": "같은 항목이 여러 번 나오지 않게 하나만 남기는 것.",
    "argparse": "커맨드라인 인자(옵션·값)를 파싱하는 파이썬 표준 라이브러리.",
    "CLI": "Command Line Interface. 터미널에 명령을 입력해 프로그램을 실행하는 방식.",
    "진입점(main)": "프로그램 실행이 시작되는 함수. 전체 흐름을 순서대로 호출함.",
    "if __name__ == \"__main__\"": "이 파일을 직접 실행할 때만 아래 코드를 돌리는 파이썬 관용구(import 시엔 실행 안 함).",
    "f-string": "파이썬에서 f\"...{변수}...\" 형태로 문자열 안에 값을 끼워 넣는 문법.",
    "설정(config)": "경로·모델·파라미터처럼 코드 동작을 좌우하는 값을 한곳에 모아 둔 것.",
    "LLM": "Large Language Model(대형 언어 모델). 여기선 답변 생성·라우팅·평가에 사용.",
    "직렬화(serialize)": "객체(예: SourceItem)를 저장·전송하기 쉬운 단순한 형태(딕셔너리/JSON)로 바꾸는 것.",
    "출처(source)": "답변의 근거가 된 자료(조문 청크·엔티티·관계 등). 화면·응답에 함께 표시해 신뢰를 높임.",
    "MCP 응답": "MCP 도구가 호출자에게 돌려주는 결과. 여기선 답변·사용 모드·근거를 담은 딕셔너리.",
    "fail-safe(안전 우선)": "어떤 단계가 실패해도 시스템이 멈추거나 무한 반복에 빠지지 않도록 안전한 쪽으로 처리하는 것.",
    "정규화(normalize)": "입력값(대소문자·공백 등이 제각각인)을 정해진 표준 형태로 통일하는 것.",
    "관찰 가능성(observability)": "시스템이 '무엇을 왜 했는지'를 밖에서 들여다볼 수 있는 정도. 모드·이유·평가 결과를 함께 노출해 높임.",
    "위임(delegation)": "어떤 일을 직접 하지 않고 그 일을 잘하는 다른 객체·함수에 넘겨 맡기는 것.",
    "팩토리(factory)": "객체를 일관된 방식으로 '만들어 주는' 함수. 설정이 흩어져 어긋나는 것을 막음.",
    "reasoning_format": "gpt-oss 같은 추론형 모델 전용 옵션. 'hidden'이면 사고 과정을 숨기고 최종 답변만 반환함.",
    "json_schema": "with_structured_output의 한 방식. LLM에 JSON 스키마를 강제해 정해진 키의 JSON으로만 답하게 함(자연어 파싱 불안정성 제거).",
  },
};
