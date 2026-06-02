window.EXPLAIN_DATA = {
  meta: { title: "MCP GraphRAG 서버 — 사내 교재 Knowledge Graph 검색", entry: "server.py" },
  files: [
    { id: "server", label: "server.py", role: "GraphRAG MCP 서버 — Streamable HTTP 전송으로 Tool·Resource·Prompt 3대 프리미티브 노출" },
    { id: "service", label: "search_service.py", role: "검색 오케스트레이터 — 4단계 파이프라인(접수→라우팅→검색→LLM 답변)" }
  ],
  flow: [
    { step: 1, title: "서버 기동", summary: "python server.py → http://127.0.0.1:8000/mcp", detail: "STDIO가 아닌 Streamable HTTP로 실행합니다. Claude Code 같은 MCP 클라이언트가 이 URL로 연결합니다." },
    { step: 2, title: "클라이언트 연결", summary: "Claude Code 등이 /mcp 엔드포인트에 연결", detail: "서버를 자식 프로세스로 띄우는 STDIO 방식과 달리, HTTP URL만 설정하면 원격에서도 연결할 수 있습니다." },
    { step: 3, title: "SearchService 지연 초기화", summary: "첫 도구 호출 시 Neo4j·임베딩 모델 연결", detail: "서버 기동을 빠르게 유지하기 위해 무거운 초기화(DB 연결, 모델 로드)는 첫 호출 시까지 미룹니다." },
    { step: 4, title: "ask_dev_ai 도구 호출", summary: "질문 → 검색 방법 결정 → KG/벡터 검색 → LLM 답변", detail: "auto 모드에서는 질문 패턴을 분석해 vector·graph_qa·hybrid·cypher 중 최적 검색 방법을 자동 선택합니다." },
    { step: 5, title: "리소스·프롬프트 조회", summary: "graphrag://stats, graphrag://schema, dev_assist 사용 가능", detail: "KG 통계·스키마를 URI로 조회하거나, 구현 가이드 작성을 돕는 프롬프트 템플릿을 사용할 수 있습니다." }
  ],
  functions: [
    {
      id: "server_init",
      name: "FastMCP 서버 생성",
      fileId: "server",
      summary: "Streamable HTTP 전송용 FastMCP 서버 인스턴스 생성",
      how: "STDIO 전송과 달리 host/port를 지정해 HTTP 바인딩 주소를 설정합니다. mcp.run(transport='streamable-http')로 실행하면 /mcp 엔드포인트가 열립니다. Settings는 Neo4j URI, API 키, 포트 번호 등 설정값을 담습니다.",
      terms: ["FastMCP", "streamable_http", "Settings_class"],
      lines: [
        { at: "_settings = Settings()", text: "환경변수·.env에서 Neo4j URI·API 키·포트 등 설정값 로드" },
        { at: "mcp = FastMCP(\"graphrag-dev-ai\", host=_settings.mcp_host, port=_settings.mcp_port)", text: "Streamable HTTP용 서버 생성 — host/port로 바인딩 주소 지정" },
        { at: "_service: SearchService | None = None", text: "싱글턴 패턴 — None으로 초기화하고 첫 호출 시 생성" }
      ],
      code: `_settings = Settings()

mcp = FastMCP("graphrag-dev-ai", host=_settings.mcp_host, port=_settings.mcp_port)

_service: SearchService | None = None`
    },
    {
      id: "get_service",
      name: "get_service()",
      fileId: "server",
      summary: "SearchService 싱글턴을 지연 생성해 반환 — 서버 기동을 빠르게 유지",
      how: "global 변수 _service가 None이면 처음 한 번만 SearchService를 생성합니다. 그 다음 호출부터는 이미 만들어진 인스턴스를 바로 반환합니다. 무거운 초기화(Neo4j 연결, 임베딩 모델 로드)를 서버 기동 시점이 아닌 첫 호출 시점으로 미루는 패턴입니다.",
      terms: ["singleton_pattern", "lazy_init", "global_keyword"],
      lines: [
        { at: "def get_service() -> SearchService:", text: "싱글턴 반환 함수 — 첫 호출 시에만 초기화" },
        { at: "global _service", text: "global 선언 — 함수 안에서 모듈 전역 변수를 수정할 때 필요" },
        { at: "if _service is None:", text: "아직 초기화되지 않았으면 처음 한 번만 생성" },
        { at: "logger.info(\"SearchService 최초 초기화 시작\")", text: "첫 호출 시 로그 — 이 메시지가 한 번만 나타나야 함" },
        { at: "_service = SearchService(_settings)", text: "Neo4j 연결·임베딩 모델·QueryEngine 빌드 등 무거운 초기화 수행" }
      ],
      code: `def get_service() -> SearchService:
    """SearchService 싱글턴을 지연 생성해 반환 (서버 기동은 빠르게, 연결은 첫 호출 때)."""
    global _service
    if _service is None:
        logger.info("SearchService 최초 초기화 시작")
        _service = SearchService(_settings)
    return _service`
    },
    {
      id: "ask_dev_ai",
      name: "ask_dev_ai()",
      fileId: "server",
      summary: "사내 교재 Knowledge Graph를 검색해 한국어 답변을 생성하는 MCP 도구",
      how: "질문을 받아 검색 방법을 결정(auto면 자동 라우팅)하고, KG와 벡터 DB를 검색한 뒤 LLM으로 근거 기반 답변을 생성합니다. _shape_tool_result()로 응답을 간결하게 정리해 반환합니다.",
      terms: ["mcp_tool", "search_mode", "shape_result"],
      lines: [
        { at: "@mcp.tool()", text: "이 함수를 MCP 도구로 등록 — LLM이 호출 여부를 결정함" },
        { at: "def ask_dev_ai(question: str, mode: str = \"auto\") -> dict[str, Any]:", text: "question: 질문 또는 Cypher 쿼리, mode: 검색 방법(기본 auto)" },
        { at: "result = get_service().answer(question, mode)", text: "SearchService에서 4단계 파이프라인(라우팅→검색→LLM 답변) 실행" },
        { at: "return _shape_tool_result(result)", text: "벡터 히트·그래프 행 등 대용량 필드를 개수 요약으로 정리해 반환" }
      ],
      code: `@mcp.tool()
def ask_dev_ai(question: str, mode: str = "auto") -> dict[str, Any]:
    """AI 에이전트 개발 교재 Knowledge Graph를 검색해 한국어 답변을 생성함.

    Args:
        question: 개발 관련 질문 또는 직접 입력한 Cypher 쿼리.
        mode: 검색 방법. auto(자동 결정) | vector(개념·정의·예제) | graph_qa(엔티티 관계·집계)
              | hybrid(전체 흐름·구조 요약) | cypher(읽기 전용 Cypher 직접 실행). 기본값 auto.
    """
    logger.info("ask_dev_ai 호출: mode=%s, question=%s", mode, question[:80])
    result = get_service().answer(question, mode)
    return _shape_tool_result(result)`
    },
    {
      id: "kg_resources",
      name: "kg_stats_resource() / kg_schema_resource()",
      fileId: "server",
      summary: "KG 통계·스키마를 URI로 노출하는 MCP 리소스 2종",
      how: "graphrag://stats로 노드/관계 개수를 확인하고, graphrag://schema로 KG의 노드 라벨·관계 타입을 확인할 수 있습니다. 리소스는 읽기 전용이므로 부작용 없이 안전하게 조회할 수 있습니다.",
      terms: ["mcp_resource", "URI", "json_dumps"],
      lines: [
        { at: '@mcp.resource("graphrag://stats")', text: "KG 노드/관계/라벨 통계를 graphrag://stats URI로 노출" },
        { at: "return json.dumps(stats, ensure_ascii=False, indent=2)", text: "JSON 문자열로 직렬화해 반환" },
        { at: '@mcp.resource("graphrag://schema")', text: "Neo4j KG 스키마를 graphrag://schema URI로 노출" }
      ],
      code: `@mcp.resource("graphrag://stats")
def kg_stats_resource() -> str:
    """KG 노드/관계/라벨 통계를 JSON 문자열로 반환 (인덱싱된 교재 규모 확인용)."""
    stats = get_service().kg_stats()
    return json.dumps(stats, ensure_ascii=False, indent=2)


@mcp.resource("graphrag://schema")
def kg_schema_resource() -> str:
    """Neo4j KG 스키마(노드 라벨·속성·관계 타입)를 문자열로 반환."""
    return get_service().kg_schema()`
    },
    {
      id: "dev_assist_prompt",
      name: "dev_assist()",
      fileId: "server",
      summary: "사내 교재를 근거로 구현 가이드를 작성하게 하는 MCP 프롬프트 템플릿",
      how: "이 프롬프트를 받은 LLM은 먼저 ask_dev_ai 도구로 KG를 검색하고, 검색 결과의 출처(sources)를 인용하면서 구현 가이드를 작성합니다. 일반 지식이 아닌 사내 교재 기준으로 답변을 유도합니다.",
      terms: ["mcp_prompt"],
      lines: [
        { at: "@mcp.prompt()", text: "이 함수를 재사용 가능한 프롬프트 템플릿으로 등록" },
        { at: "def dev_assist(topic: str) -> str:", text: "topic을 받아 완성된 프롬프트 문자열을 반환 (LLM 실행 아님)" },
        { at: "f\"먼저 graphrag-dev-ai MCP 서버의 ask_dev_ai 도구로", text: "LLM에게 KG 검색을 먼저 하도록 지시" }
      ],
      code: `@mcp.prompt()
def dev_assist(topic: str) -> str:
    """사내 교재를 근거로 구현 가이드를 작성하게 하는 개발 지원 프롬프트 템플릿."""
    return (
        f"'{topic}' 주제로 AI 에이전트 기능을 구현하려고 합니다.\\n"
        f"먼저 graphrag-dev-ai MCP 서버의 ask_dev_ai 도구로 사내 교재 Knowledge Graph를 검색해 "
        f"관련 개념·예제·관계를 수집하세요.\\n"
        f"그다음 검색 결과의 출처(sources)를 인용하면서, 일반 지식이 아닌 사내 교재 기준으로 "
        f"구현 단계와 주의사항을 한국어로 정리해 주세요."
    )`
    },
    {
      id: "search_service_answer",
      name: "SearchService.answer()",
      fileId: "service",
      summary: "질문을 받아 검색 방법 결정 → 검색 실행 → LLM 답변 생성의 4단계 파이프라인",
      how: "auto 모드면 QueryRouter가 질문 패턴을 분석해 최적 검색 방법을 자동 결정합니다. 그 외에는 호출자가 지정한 모드를 사용합니다. 반환 dict에는 답변뿐 아니라 어떤 방법으로 왜 검색했는지도 포함합니다.",
      terms: ["QueryRouter", "QueryEngine", "search_modes"],
      lines: [
        { at: "def answer(self, question: str, mode: str = \"auto\") -> dict[str, Any]:", text: "SearchService의 진입점 — 질문과 모드를 받아 전체 파이프라인 실행" },
        { at: "if requested_mode == \"auto\":", text: "auto 모드: QueryRouter가 질문 패턴 분석 후 최적 모드 자동 결정" },
        { at: "decision = self.router.route(question, \"Auto\")", text: "QueryRouter가 vector·graph_qa·hybrid·cypher 중 하나를 선택" },
        { at: "resolved_mode, route_reason = requested_mode, \"MCP 호출자 지정 모드\"", text: "호출자가 모드를 직접 지정한 경우 그대로 사용" },
        { at: "result = self.engine.search(question, resolved_mode)", text: "결정된 방법으로 KG/벡터 DB 검색 + LLM 답변 생성" },
        { at: "result[\"requested_mode\"] = requested_mode", text: "어떤 모드를 요청했고 실제로 무슨 모드가 실행됐는지 응답에 포함" }
      ],
      code: `def answer(self, question: str, mode: str = "auto") -> dict[str, Any]:
    """질문을 받아 검색 방법을 결정·실행하고 답변 결과 딕셔너리를 반환함."""
    question = (question or "").strip()
    if not question:
        return {
            "answer": "질문이 비어 있습니다. 검색할 내용을 입력하세요.",
            "requested_mode": mode,
            "resolved_mode": None,
            "route_reason": "빈 질문",
            "sources": [],
            "error": True,
        }

    requested_mode = (mode or "auto").lower().strip()
    if requested_mode not in VALID_MODES:
        logger.warning("알 수 없는 모드 '%s' → auto로 대체", requested_mode)
        requested_mode = "auto"

    if requested_mode == "auto":
        decision = self.router.route(question, "Auto")
        resolved_mode, route_reason = decision.mode, decision.reason
    else:
        resolved_mode, route_reason = requested_mode, "MCP 호출자 지정 모드"

    logger.info("질문='%s' → 모드=%s (%s)", question[:60], resolved_mode, route_reason)

    result = self.engine.search(question, resolved_mode)

    result.setdefault("sources", [])
    result["question"] = question
    result["requested_mode"] = requested_mode
    result["resolved_mode"] = resolved_mode
    result["route_reason"] = route_reason
    return result`
    }
  ],
  glossary: {
    "FastMCP": "MCP 서버를 간편하게 만드는 라이브러리. 타입 힌트와 docstring만으로 JSON Schema를 자동 생성함",
    "streamable_http": "MCP 전송 방식 중 하나. HTTP 단일 엔드포인트(/mcp)로 양방향 통신. STDIO와 달리 원격 연결 가능",
    "Settings_class": "환경변수·.env 파일에서 Neo4j URI·API 키·포트 번호 등을 읽어오는 설정 클래스",
    "singleton_pattern": "클래스 인스턴스를 하나만 만들고 재사용하는 디자인 패턴. 무거운 초기화 비용을 한 번만 지불",
    "lazy_init": "지연 초기화. 처음 필요한 시점까지 초기화를 미루는 기법. 서버 기동 시간을 단축함",
    "global_keyword": "파이썬에서 함수 안에서 모듈 전역 변수를 수정하려면 global 선언이 필요함",
    "mcp_tool": "LLM이 호출 여부를 결정하고 AI 앱이 실제 실행하는 함수. @mcp.tool()로 등록",
    "search_mode": "ask_dev_ai의 mode 파라미터. vector·graph_qa·hybrid·cypher·auto 5가지 검색 방법",
    "shape_result": "_shape_tool_result() — 내부 검색 결과에서 임베딩 벡터 등 대용량 필드를 개수 요약으로 축소해 LLM 컨텍스트 절약",
    "mcp_resource": "URI로 접근하는 읽기 전용 데이터. 부작용 없이 조회만 함. @mcp.resource('URI')로 등록",
    "URI": "Uniform Resource Identifier. graphrag://stats 처럼 리소스의 주소를 표현",
    "json_dumps": "json.dumps(obj, ensure_ascii=False, indent=2) — 파이썬 객체를 들여쓰기 포함 JSON 문자열로 변환",
    "mcp_prompt": "재사용 가능한 프롬프트 템플릿. LLM 실행이 아닌 완성된 프롬프트 문자열을 반환함",
    "QueryRouter": "질문 패턴을 분석해 최적 검색 방법(vector·graph_qa·hybrid·cypher)을 자동 결정하는 컴포넌트",
    "QueryEngine": "결정된 검색 방법으로 Neo4j KG·벡터 DB를 검색하고 Groq LLM으로 답변을 생성하는 컴포넌트",
    "search_modes": "vector: 개념·정의·예제 검색 | graph_qa: 엔티티 관계·집계 | hybrid: 전체 흐름·구조 | cypher: SQL처럼 직접 쿼리"
  }
};
