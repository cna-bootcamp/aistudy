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
  ],

  // 전체 처리 흐름 (MCP 진입 → 라우팅 → 검색 → 평가 → (필요 시 보완·융합) → 응답)
  flow: [
    {
      step: 1,
      title: "분산 MAS의 한 축 — MCP 서버로 노출",
      summary: "server.py: 특허법 검색 능력을 ask_patent_law 도구로 외부에 공개",
      detail: "이 예제는 '법령지식'을 전담하는 하나의 전문가 부서입니다. FastMCP로 검색 능력을 표준 규격(MCP)에 맞춰 노출하면, 상위 오케스트레이터나 다른 AI 앱이 마치 콘센트에 플러그를 꽂듯 이 부서를 호출할 수 있습니다. 비유하면 '특허법 상담 창구를 인터넷에 열어 두는' 단계로, 여러 부서가 모이는 분산 멀티에이전트의 한 축이 됩니다.",
    },
    {
      step: 2,
      title: "검색 모드 결정 (Scheduler)",
      summary: "scheduler_node → router.route(): 질문에 맞는 검색 방식 1개를 고름",
      detail: "질문을 받으면 먼저 '어떤 방법으로 찾을지'를 정합니다. 조문 원문을 정확히 인용해야 하면 벡터 검색(vector), 요건·권리의 관계를 봐야 하면 GraphRAG(local/global/drift)를 고릅니다. 키워드 규칙으로 먼저 판단하고 애매하면 LLM에게 분류를 맡깁니다. 비유하면 '민원을 보고 어느 창구로 보낼지 정하는 안내 데스크'입니다.",
    },
    {
      step: 3,
      title: "검색 실행 (Agent)",
      summary: "agent_node: 결정된 모드로 실제 검색을 수행해 답변·근거를 만듦",
      detail: "안내받은 한 가지 방법으로 실제 검색을 수행합니다. vector면 ChromaDB에서 비슷한 조문 청크를 찾아 LLM이 조문을 인용해 답하고, GraphRAG면 지식그래프(엔티티·관계·커뮤니티)를 질의합니다. 한 패스에서는 딱 한 가지 방법만 씁니다(두 방법을 무조건 동시에 돌리지 않음 = 중복 검색 금지).",
    },
    {
      step: 4,
      title: "근거 충분성 평가 (Supervisor)",
      summary: "supervisor_node: 답이 충분한지 LLM이 보수적으로 판정 → 종료/재검색/융합 분기",
      detail: "검색 결과가 질문에 충분히 답했는지 감독자가 점검합니다. 충분하면 마무리하고, 부족하면 '서로 다른 역할의 보완 모드'(예: 벡터로 부족했으면 GraphRAG)로 딱 한 번 더 검색하도록 지시합니다. 무한 반복을 막는 한도(Loop Guard)가 있어 안전합니다. 비유하면 '상담 결과를 검토해 미흡하면 다른 전문가에게 한 번 더 묻는 팀장'입니다.",
    },
    {
      step: 5,
      title: "두 근거 융합 (Fuse)",
      summary: "fuse_node: 조문 원문(vector) + 관계/구조(GraphRAG) 두 답변을 하나로 종합",
      detail: "보완 검색까지 두 번 돌았다면, 조문 원문 근거와 관계/구조 근거를 하나의 모순 없는 한국어 답변으로 합칩니다. 이것이 이 MAS의 핵심 가치입니다 — 정밀한 조문 인용(벡터)과 넓은 맥락(그래프)을 합쳐 더 정확한 자문을 만듭니다. 비유하면 '두 전문가 소견서를 하나의 결론으로 정리하는' 단계입니다.",
    },
    {
      step: 6,
      title: "MCP 응답 정리 & 반환",
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
      terms: ["FastMCP", "MCP", "@mcp.tool()", "MCP 도구(Tool)", "SAS(Supervisor-Agent-System)", "동기/비동기(sync/async)", "싱글턴"],
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
      terms: ["argparse", "CLI", "진입점(main)", "SAS(Supervisor-Agent-System)"],
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
      terms: ["LangGraph", "StateGraph", "노드(node)", "엣지(edge)", "조건부 엣지(conditional edge)", "공유 State", "compile", "SAS(Supervisor-Agent-System)"],
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

    // ───────────────────────── mas/nodes.py ─────────────────────────
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
    "SAS(Supervisor-Agent-System)": "감독자(Supervisor)가 일꾼(Agent)에게 작업을 시키고 결과를 검수·조정하는 멀티에이전트 구조. 여기선 Scheduler+Agent+Supervisor로 구성됨.",
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
  },
};
