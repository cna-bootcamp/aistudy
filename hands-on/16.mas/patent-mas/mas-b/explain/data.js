window.EXPLAIN_DATA = {
  meta: {
    title: "특허 선행기술·동향 리서치 MAS B — 다중 소스 Self-RAG (법령 MCP·웹·YouTube)",
    entry: "app.py",
  },

  // 좌측 그룹 = 파일 (진입점 → 상태정의 → 워크플로 → 소스 3종 → 설정)
  files: [
    { id: "main",     label: "app.py",                  role: "CLI 대화형 진입점 — LLM·Self-RAG 그래프를 준비하고 대화형/데모 모드로 실행" },
    { id: "state",    label: "graph/state.py",          role: "그래프 상태(AgentState)와 Self-RAG 판단 토큰(Route·IsRel·IsSup·IsUse) 스키마 정의" },
    { id: "workflow", label: "graph/workflow.py",       role: "Self-RAG 본체 — 검색→평가→재검색 LangGraph 워크플로(라우팅·검색·관련성·근거성·유용성)" },
    { id: "law",      label: "sources/law_client.py",   role: "법령 MCP 클라이언트 — 원격 서버(Streamable HTTP)에 접속해 판례·해석례·최신법령 수집" },
    { id: "web",      label: "sources/web_search.py",   role: "웹 검색 소스 — DuckDuckGo로 최근 1년 뉴스·시장 동향 수집" },
    { id: "youtube",  label: "sources/youtube_search.py", role: "YouTube 소스 — 영상 검색 + 자막 로드 + 질의 유사도로 핵심 자막 구간 선별" },
    { id: "settings", label: "config/settings.py",      role: "전역 설정 — 모델명·MCP 접속정보·검색 파라미터·재시도 한계를 한곳에서 관리" },
  ],

  // 전체 처리 흐름 (질문 → 라우팅 → 다중 소스 검색 → 관련성 → 답변+근거성 → 유용성 → 재검색 루프)
  flow: [
    {
      step: 1,
      title: "라우팅 (Route) — 무엇을 어디서 찾을지 결정",
      label: "라우팅(Route)",
      refs: ["route"],
      summary: "route(): 검색이 필요한지, 어떤 소스(law/web/youtube)를 쓸지, 소스별 쿼리를 LLM이 결정",
      detail: "질문이 들어오면 먼저 '이건 검색이 필요한 질문인가? 필요하면 어디서 찾아야 하나?'를 LLM이 판단합니다. 판례·해석례가 필요하면 law(법령 MCP), 최신 뉴스·동향이면 web, 강의·해설 영상이면 youtube를 고르고, 각 소스에 맞는 검색어까지 만들어 줍니다. 인사·잡담이나 특허와 무관한 질문이면 검색을 건너뜁니다. 비유하면 '도서관 사서가 질문을 듣고 어느 서가로 갈지 정하는' 단계입니다.",
    },
    {
      step: 2,
      title: "다중 소스 검색 (Retrieve) — 여러 출처를 동시에 모음",
      label: "다중 소스 검색",
      refs: ["retrieve","law_search","search_web","search_youtube"],
      summary: "retrieve(): 선택된 소스에서만 검색 — 한 소스가 실패해도 나머지로 계속(장애 격리)",
      detail: "라우터가 고른 소스에서만 실제로 검색합니다. 법령은 원격 MCP 서버(인터넷 너머의 도구 제공자)에 접속해 판례·해석례를 받고, 웹은 DuckDuckGo, 영상은 YouTube에서 자막까지 가져옵니다. 핵심은 '장애 격리'입니다 — 한 출처가 먹통이 돼도 그 소스만 빈 결과로 두고 나머지 출처로 답변을 만듭니다. 비유하면 '세 곳의 자료실에 동시에 사람을 보내되, 한 곳이 닫혀 있어도 나머지 두 곳 자료로 보고서를 쓰는' 것입니다.",
    },
    {
      step: 3,
      title: "관련성 평가 (IsRel) — 가져온 자료를 거름",
      label: "관련성 평가(IsRel)",
      refs: ["grade_documents"],
      summary: "grade_documents(): 모은 항목이 질문과 정말 관련 있는지 LLM이 한 번에 일괄 평가해 선별",
      detail: "검색은 키워드만 스쳐도 엉뚱한 자료를 끌고 옵니다. 그래서 모은 항목 하나하나가 '이 질문에 실제로 답이 되는가?'를 LLM이 점검(IsRel)해 관련 있는 것만 남깁니다. 비유하면 '자료실에서 한 아름 가져온 책 중, 주제에 맞는 책만 책상에 올려놓는' 작업입니다. 이렇게 걸러야 다음 단계의 답변이 정확해집니다.",
    },
    {
      step: 4,
      title: "답변 생성 + 근거성 검증 (IsSup)",
      label: "답변 생성·근거검증",
      refs: ["generate","generate_answer","grade_support"],
      summary: "generate(): 관련 자료로 답변 생성 → 컨텍스트에 근거하는지(IsSup) 검증 → 부족하면 엄격 재생성 + 코드 기반 출처 부착",
      detail: "걸러진 자료만 근거로 LLM이 답변을 씁니다. 그 뒤 '이 답변이 실제 자료에 근거하는가, 지어낸 말은 없는가?'를 다시 LLM이 검사(IsSup)합니다. 근거가 부족하면 '자료에 있는 내용만 써라'는 엄격 모드로 다시 씁니다. 출처(판례 링크·영상 타임스탬프)는 LLM이 아니라 코드가 직접 붙여 인용을 지어내는 환각을 막습니다. 비유하면 '초안을 쓴 뒤 각주가 실제 출처와 맞는지 편집자가 대조하는' 것입니다.",
    },
    {
      step: 5,
      title: "유용성 평가 → 재검색 루프 (IsUse → Rewrite → Route)",
      label: "유용성 평가·재검색",
      refs: ["grade_generation","rewrite"],
      summary: "grade_generation()이 유용성(IsUse) 미달로 판정하면 질문을 다시 써(Rewrite) 라우팅부터 재검색",
      detail: "마지막으로 '이 답변이 사용자에게 정말 쓸모 있는가?'를 평가(IsUse)합니다. 미흡하면 질문을 더 검색 친화적인 표현으로 고쳐 쓰고(Query Rewriting), 1단계 라우팅으로 되돌아가 다시 검색합니다. 무한 반복을 막기 위해 재시도 횟수에 상한을 둡니다. 이 '검색→평가→재검색' 되먹임이 바로 Self-RAG의 핵심 — AI가 스스로 자기 답을 점검하고 부족하면 다시 찾는 구조입니다.",
    },
    {
      step: 6,
      title: "직접 답변 (Direct) — 검색 불필요 경로",
      label: "직접 답변(Direct)",
      refs: ["direct_answer"],
      summary: "direct_answer(): 인사·잡담·특허 무관 질문은 검색 없이 LLM 지식으로 바로 답변",
      detail: "1단계에서 '검색 불필요'로 판정된 질문(인사, 다른 분야 질문 등)은 외부 검색을 건너뛰고 LLM이 가진 지식과 대화 맥락만으로 바로 답합니다. 불필요한 검색 비용·지연을 줄이는 우회로입니다. 비유하면 '굳이 자료실에 갈 필요 없는 질문은 그 자리에서 바로 대답하는' 것입니다.",
    },
  ],

  functions: [
    // ───────────────────────── app.py ─────────────────────────
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "LLM과 Self-RAG 그래프를 준비하고, 실행 모드(대화형/데모)에 따라 챗봇을 시작하는 진입점",
      how: "프로그램이 시작되면 가장 먼저 호출되는 '지휘자' 함수입니다. (1) 법령 MCP 접속 URL을 미리 만들어 인증키 누락을 초기에 잡고, (2) Groq LLM을 만든 뒤, (3) 그 LLM으로 Self-RAG 에이전트(그래프)를 구성합니다. 그다음 실행 옵션에 '--demo'가 있으면 정해진 검증 질문을 순서대로 돌리고, 없으면 사용자와 주고받는 대화형 루프를 실행합니다. 설정 오류가 나면 메시지를 출력하고 비정상 종료 코드로 끝냅니다.",
      terms: ["MCP(Model Context Protocol)", "Self-RAG", "LangGraph", "진입점(main)", "Streamable HTTP"],
      lines: [
        { at: "print(f\"korean-law MCP: {settings.LAW_MCP_BASE_URL}", text: "어느 법령 MCP 서버에 붙는지 콘솔에 안내합니다(인증키는 ***로 가림)." },
        { at: "settings.build_law_mcp_url()", text: "MCP 접속 URL을 미리 만들어 LAW_OC(인증키) 누락을 실행 초기에 잡습니다(빠른 실패)." },
        { at: "llm = build_llm()", text: "라우팅·평가·답변 생성에 공용으로 쓸 Groq LLM 인스턴스를 만듭니다." },
        { at: "agent = PatentTrendRAG(llm)", text: "그 LLM으로 Self-RAG 워크플로(그래프)를 가진 에이전트를 구성합니다." },
        { at: "if \"--demo\" in sys.argv[1:]:", text: "실행 옵션에 '--demo'가 있으면 정해진 검증 질문을 비대화형으로 순차 실행합니다." },
        { at: "chat(agent)", text: "옵션이 없으면 사용자와 멀티턴으로 대화하는 챗봇 루프를 실행합니다." },
        { at: "except (RuntimeError, ValueError) as error:", text: "설정·인증 오류가 나면 메시지를 출력하고 비정상 종료 코드(1)로 빠져나갑니다." },
      ],
      code: `def main() -> None:
    """LLM·Self-RAG 그래프를 준비하고, 모드(데모/대화형)에 따라 실행함."""
    print("\\n" + "=" * 60)
    print("MAS B — 특허 선행기술·동향 리서치 (LangGraph + Groq gpt-oss-120b)")
    print("=" * 60)
    try:
        # MCP 접속 URL을 미리 구성해 LAW_OC 누락을 실행 초기에 잡음
        print(f"korean-law MCP: {settings.LAW_MCP_BASE_URL}?oc=*** (Streamable HTTP)")
        settings.build_law_mcp_url()
        llm = build_llm()
        agent = PatentTrendRAG(llm)

        if "--demo" in sys.argv[1:]:
            run_demo(agent)
        else:
            chat(agent)
    except (RuntimeError, ValueError) as error:
        print(f"\\n[오류] {error}", file=sys.stderr)
        sys.exit(1)`,
    },

    // ───────────────────────── graph/state.py ─────────────────────────
    {
      id: "selfrag_schemas",
      name: "RouteDecision · 평가 토큰 · AgentState",
      fileId: "state",
      summary: "Self-RAG의 4대 판단 토큰(Route·IsRel·IsSup·IsUse)과 그래프가 공유하는 상태 데이터의 형태를 정의",
      how: "이 파일은 'AI가 무엇을 판단해 어떤 모양으로 답해야 하는지'를 미리 정해 둔 설계도입니다. RouteDecision은 '검색 필요 여부+소스 선택+소스별 쿼리'를, SupportGrade/UsefulnessGrade 등은 '근거 있음/유용함'의 참·거짓을 담습니다. 이렇게 Pydantic 스키마로 모양을 강제하면(with_structured_output) LLM이 제멋대로 문장으로 답하지 않고 정해진 칸을 채워 줘서 코드가 안정적으로 읽을 수 있습니다. AgentState는 그래프의 노드들이 서로 주고받는 '공용 작업판'으로, 각 노드는 필요한 칸만 채워 반환하면 LangGraph가 기존 상태에 합쳐 줍니다.",
      terms: ["Self-RAG", "Pydantic", "구조화 출력(structured output)", "IsRel", "IsSup", "IsUse", "TypedDict", "LangGraph", "멀티턴(multi-turn)"],
      lines: [
        { at: "needs_retrieval: bool = Field(description=\"특허", text: "[Route] 외부 검색이 필요한 질문인지 참/거짓으로 담습니다." },
        { at: "sources: list[Literal[\"law\", \"web\", \"youtube\"]]", text: "[Route] 쓸 소스 목록 — 셋(law/web/youtube) 중에서만 고르도록 제한합니다." },
        { at: "class SupportGrade(BaseModel):", text: "[IsSup] 답변이 검색 컨텍스트에 근거하는지(환각 없는지)를 담는 평가 스키마입니다." },
        { at: "class UsefulnessGrade(BaseModel):", text: "[IsUse] 답변이 사용자에게 유용한지를 담는 평가 스키마입니다(재검색 분기의 기준)." },
        { at: "class AgentState(TypedDict):", text: "그래프 전체에서 노드 사이로 공유·갱신되는 상태(공용 작업판) 정의입니다." },
        { at: "history: list               # 이전 대화 맥락", text: "이전 대화 기록 — 멀티턴(여러 턴에 걸친) 대화 맥락을 유지합니다." },
        { at: "retry_count: int", text: "지금까지 질문을 다시 쓴 재시도 횟수 — 무한 루프를 막는 데 씁니다." },
      ],
      code: `# (일부 발췌) graph/state.py — Self-RAG 토큰 스키마 + 그래프 상태

class RouteDecision(BaseModel):
    """라우터 결과: 검색 필요 여부 + 선택 소스 + 소스별 최적 쿼리 (외부 동적 소스 전용)."""

    needs_retrieval: bool = Field(description="특허 선행기술·동향 질문이라 외부 검색이 필요한지 여부")
    sources: list[Literal["law", "web", "youtube"]] = Field(
        description="검색에 사용할 소스 목록 (law=판례·해석례·최신법령, web=뉴스·시장동향, youtube=강의·해설)"
    )
    reasoning: str = Field(description="판단 근거 (한국어 한 문장)")


class SupportGrade(BaseModel):
    """[IsSup] 답변의 근거성 평가."""

    is_supported: bool = Field(description="생성된 답변이 검색 컨텍스트에 근거하는지 여부")
    reasoning: str = Field(description="근거성 판단 이유 (한국어 한 문장)")


class UsefulnessGrade(BaseModel):
    """[IsUse] 답변 유용성 평가."""

    is_useful: bool = Field(description="답변이 사용자 질문에 유용한지 여부")
    reasoning: str = Field(description="유용성 판단 이유 (한국어 한 문장)")


class AgentState(TypedDict):
    """그래프 전체에서 노드 사이로 공유·갱신되는 상태 데이터."""

    question: str               # 현재 처리 중 질문 (Query Rewriting 시 갱신됨)
    original_question: str      # 최초 사용자 질문 (유용성 평가·재작성의 기준)
    history: list               # 이전 대화 맥락 [{"role", "content"}] (멀티턴)

    sources: list               # 선택된 소스 ["law", "web", "youtube"]
    retrieved_items: list       # 모든 소스를 합친 통합 항목 (IsRel 평가 대상)
    relevant_items: list        # 관련성 평가를 통과한 항목 (컨텍스트·출처 구성)

    answer: str                    # 출처 섹션이 포함된 최종 답변
    is_supported: Optional[bool]   # [IsSup] 근거성 평가 결과
    is_useful: Optional[bool]      # [IsUse] 유용성 평가 결과

    retry_count: int            # 현재까지 Query Rewriting 재시도 횟수
    rewrites: list              # Query Rewriting 이력 [{from, to, reasoning}]`,
    },

    {
      id: "state_schemas",
      name: "RelevanceGrade · BatchRelevanceGrade · RewrittenQuery",
      fileId: "state",
      summary: "관련성(IsRel) 항목별·일괄 평가 스키마와, 질문 재작성(Query Rewriting) 결과 스키마 정의",
      how: "selfrag_schemas가 다루지 않은 나머지 판단 스키마들입니다. RelevanceGrade는 항목 한 건의 관련성을 '몇 번 항목인가(인덱스)+관련 있나(참/거짓)'로 담고, BatchRelevanceGrade는 그 결과를 리스트로 묶어 한 번의 LLM 호출로 여러 항목을 일괄 평가하게 합니다(비용 절감). RewrittenQuery는 유용성 미달 시 LLM이 더 검색하기 좋게 고쳐 쓴 질문과 그 이유를 담습니다. 모두 Pydantic 스키마라 LLM이 정해진 칸을 채워 돌려줘 코드가 안정적으로 읽습니다.",
      terms: ["IsRel", "Pydantic", "구조화 출력(structured output)", "인덱스(index)", "Query Rewriting", "Self-RAG"],
      lines: [
        { at: "class RelevanceGrade(BaseModel):", text: "[IsRel] 검색 항목 한 건의 관련성 평가 스키마입니다." },
        { at: "document_index: int = Field(description=\"평가 대상 항목의 인덱스", text: "어느 항목을 평가했는지 인덱스(0부터 시작)로 가리킵니다." },
        { at: "class BatchRelevanceGrade(BaseModel):", text: "여러 항목의 관련성을 한 번의 LLM 호출로 일괄 평가하는 스키마입니다." },
        { at: "results: list[RelevanceGrade] = Field(", text: "각 항목의 관련성 결과를 리스트로 모아 담습니다." },
        { at: "class RewrittenQuery(BaseModel):", text: "유용성 미달 시 검색 친화적으로 다시 쓴 질문을 담는 스키마입니다." },
        { at: "rewritten_query: str = Field(description=\"검색에 최적화되도록", text: "재작성된 질문 문자열을 담습니다(다음 라우팅의 입력)." },
      ],
      code: `# (일부 발췌) graph/state.py — IsRel 평가 + Query Rewriting 스키마

class RelevanceGrade(BaseModel):
    """[IsRel] 검색 항목 한 건의 관련성 평가."""

    document_index: int = Field(description="평가 대상 항목의 인덱스 (0부터 시작)")
    is_relevant: bool = Field(description="해당 항목이 질문과 관련 있는지 여부")


class BatchRelevanceGrade(BaseModel):
    """[IsRel] 여러 항목의 관련성 일괄 평가 (1회 LLM 호출로 전체 평가)."""

    results: list[RelevanceGrade] = Field(description="각 항목의 관련성 평가 결과 리스트")


class RewrittenQuery(BaseModel):
    """Query Rewriting 결과: 검색에 최적화되도록 다시 작성된 질문."""

    rewritten_query: str = Field(description="검색에 최적화되도록 다시 작성된 질문")
    reasoning: str = Field(description="질문을 다시 작성한 이유 (한국어 한 문장)")`,
    },

    // ───────────────────────── graph/workflow.py ─────────────────────────
    {
      id: "init_graders",
      name: "PatentTrendRAG.__init__()",
      fileId: "workflow",
      summary: "공용 LLM에 4대 판단 스키마를 입혀 라우터·관련성·근거성·유용성·재작성 전용 도구를 만들고 그래프를 컴파일",
      how: "Self-RAG 에이전트가 처음 만들어질 때 한 번 실행됩니다. 같은 LLM 하나에 with_structured_output(method='json_schema')로 서로 다른 스키마를 입혀, 같은 모델을 '라우터·관련성 평가자·근거성 평가자·유용성 평가자·질문 재작성기'라는 5개의 전용 도구로 분화시킵니다. gpt-oss-120b는 function_calling 모드에서 도구명을 잘못 만들어 실패할 수 있어 json_schema 방식으로 안정화합니다. 마지막에 _build_graph()로 노드·엣지를 연결한 실행 그래프를 만들어 보관합니다.",
      terms: ["Self-RAG", "구조화 출력(structured output)", "json_schema", "StateGraph", "Pydantic"],
      lines: [
        { at: "self.router = llm.with_structured_output(RouteDecision", text: "같은 LLM을 RouteDecision 스키마에 묶어 '라우터' 전용으로 만듭니다." },
        { at: "self.relevance_grader = llm.with_structured_output(BatchRelevanceGrade", text: "관련성(IsRel) 일괄 평가 전용 도구를 만듭니다." },
        { at: "self.support_grader = llm.with_structured_output(SupportGrade", text: "근거성(IsSup) 평가 전용 도구를 만듭니다." },
        { at: "self.usefulness_grader = llm.with_structured_output(UsefulnessGrade", text: "유용성(IsUse) 평가 전용 도구를 만듭니다." },
        { at: "self.query_rewriter = llm.with_structured_output(RewrittenQuery", text: "질문 재작성(Query Rewriting) 전용 도구를 만듭니다." },
        { at: "self.graph = self._build_graph()", text: "노드·엣지를 연결한 실행 가능한 그래프를 만들어 보관합니다." },
      ],
      code: `# (일부 발췌)
    def __init__(self, llm: ChatGroq):
        self.llm = llm
        # with_structured_output(method='json_schema'): LLM 응답을 Pydantic 스키마(JSON)로 강제함.
        # gpt-oss-120b는 function_calling 모드에서 도구명을 잘못 생성해 실패할 수 있어 json_schema로 안정화함.
        self.router = llm.with_structured_output(RouteDecision, method="json_schema")
        self.relevance_grader = llm.with_structured_output(BatchRelevanceGrade, method="json_schema")
        self.support_grader = llm.with_structured_output(SupportGrade, method="json_schema")
        self.usefulness_grader = llm.with_structured_output(UsefulnessGrade, method="json_schema")
        self.query_rewriter = llm.with_structured_output(RewrittenQuery, method="json_schema")
        self.graph = self._build_graph()`,
    },
    {
      id: "build_llm_helpers",
      name: "build_llm() · format_history()",
      fileId: "workflow",
      summary: "Groq gpt-oss-120b 공용 인스턴스 생성(추론 숨김·온도0·재시도)과, 직전 대화를 프롬프트용 텍스트로 변환",
      how: "그래프가 쓰는 두 가지 준비 도구입니다. build_llm()은 라우팅·평가·생성에 공용으로 쓸 Groq LLM 하나를 만듭니다 — 추론 과정은 숨기고(reasoning_format='hidden') 최종 텍스트만 받으며, 구조화 판단을 재현 가능하게 온도를 0으로 고정하고, 일시적 오류(429/503)에 지수 백오프로 재시도해 그래프 전체가 죽지 않게 합니다. format_history()는 이전 대화 메시지를 '사용자:/어시스턴트:' 형태의 텍스트로 바꿔 멀티턴 맥락을 프롬프트에 넣어 줍니다(최근 N개만 써 토큰을 아낌).",
      terms: ["지수 백오프(exponential backoff)", "재시도(retry)", "재현성", "멀티턴(multi-turn)", "환경변수(environment variable)"],
      lines: [
        { at: "def build_llm() -> ChatGroq:", text: "라우팅·평가·생성에 공용으로 쓸 Groq LLM을 만드는 함수입니다." },
        { at: "api_key = settings.require_env(\"GROQ_API_KEY\")", text: "필수 환경변수에서 Groq API 키를 읽습니다(없으면 즉시 오류)." },
        { at: "max_retries=settings.LLM_MAX_RETRIES,", text: "일시적 오류(429/503)에 지수 백오프로 재시도해 그래프가 죽지 않게 합니다." },
        { at: "def format_history(history: list) -> str:", text: "직전 대화를 프롬프트용 텍스트로 바꾸는 함수입니다(멀티턴 맥락)." },
        { at: "recent = history[-settings.HISTORY_TURNS:]", text: "최근 N개 메시지만 사용해 토큰·비용을 제한합니다." },
        { at: "speaker = \"사용자\" if message[\"role\"] == \"user\" else \"어시스턴트\"", text: "각 메시지의 화자를 '사용자/어시스턴트'로 표기합니다." },
      ],
      code: `def build_llm() -> ChatGroq:
    """Groq LPU의 gpt-oss-120b 인스턴스를 생성함 (라우팅·평가·생성 공용).

    reasoning_format='hidden'으로 추론 과정을 숨기고 최종 텍스트만 받음(MUST).
    스모크 테스트로 with_structured_output(method='json_schema')와 공존 가능함을 확인함.
    temperature=0으로 구조화 판단을 재현 가능하게 함.
    """
    api_key = settings.require_env("GROQ_API_KEY")
    return ChatGroq(
        model=settings.LLM_MODEL,
        temperature=settings.LLM_TEMPERATURE,
        reasoning_format=settings.LLM_REASONING_FORMAT,
        api_key=api_key,
        # 일시적 오류(429/503 over capacity)에 지수 백오프로 재시도해 그래프 전체가 죽지 않게 함
        max_retries=settings.LLM_MAX_RETRIES,
    )


def format_history(history: list) -> str:
    """직전 대화 메시지를 프롬프트용 텍스트로 변환함 (멀티턴 맥락 제공)."""
    if not history:
        return "(이전 대화 없음)"
    recent = history[-settings.HISTORY_TURNS:]  # 최근 N개 메시지만 사용해 토큰·비용 제한
    lines = []
    for message in recent:
        speaker = "사용자" if message["role"] == "user" else "어시스턴트"
        lines.append(f"{speaker}: {message['content']}")
    return "\\n".join(lines)`,
    },
    {
      id: "build_retrieved_items",
      name: "build_retrieved_items()",
      fileId: "workflow",
      summary: "law/web/youtube 검색 결과를 {source,title,content,citation} 통합 항목으로 변환 — 출처를 코드가 직접 구성(인용 환각 방지)",
      how: "세 소스의 제각각인 결과를 하나의 공통 형태로 합치는 변환기입니다. 판례·해석례·법령조문·종합검색·웹·YouTube 자막청크를 차례로 돌며, 각각 {source, title, content(답변 생성용 본문), citation(출처 한 줄)} 형태의 항목으로 만듭니다. 핵심은 citation(출처 링크·사건번호·타임스탬프)을 LLM이 아니라 코드가 직접 조립한다는 점입니다 — LLM이 인용을 지어내는 환각을 원천 차단합니다. 자막이 있는 영상은 청크로, 자막이 없는 영상은 설명으로 보강합니다(중복 영상은 제외).",
      terms: ["인용 환각 방지", "마크다운(markdown)", "타임스탬프 URL", "graceful degradation"],
      lines: [
        { at: "# 1) 판례 (사건번호·선고일·링크가 핵심 출처)", text: "판례를 통합 항목으로 변환합니다(사건번호·링크가 출처 핵심)." },
        { at: "# 3) 최신 법령 조문 본문", text: "특정 법령명이 드러난 질문에서만 수집된 최신 조문 본문을 항목으로 만듭니다." },
        { at: "# 4) 종합검색(chain_full_research)", text: "폭넓은 질문·폴백에서 모은 종합검색 결과를 항목으로 추가합니다." },
        { at: "# 5) 웹 (뉴스·시장 동향)", text: "DuckDuckGo 웹 결과를 제목·요약·링크 항목으로 변환합니다." },
        { at: "# 6) YouTube — 자막 청크 우선", text: "YouTube는 자막 청크를 우선 항목화하고, 자막 없는 영상은 설명으로 보강합니다." },
        { at: "if video[\"video_id\"] in chunk_video_ids:", text: "이미 자막 청크로 들어간 영상은 중복 추가하지 않습니다." },
      ],
      code: `# (일부 발췌)
def build_retrieved_items(state: AgentState) -> list[dict]:
    """law/web/youtube 검색 결과를 IsRel 평가·컨텍스트·출처 구성에 쓸 통합 항목으로 변환함.

    각 항목: {source, title, content, citation}
      - content : 답변 생성용 본문 (LLM 컨텍스트)
      - citation: '출처' 섹션용 마크다운 한 줄 (코드에서 직접 구성 → 인용 환각 방지, MUST)
    """
    items: list[dict] = []
    law = state.get("law_raw") or {}

    # 1) 판례 (사건번호·선고일·링크가 핵심 출처)
    for precedent in law.get("precedents", []):
        if precedent["url"]:
            citation = (f"- [{precedent['title']}]({precedent['url']}) "
                        f"(사건번호 {precedent['case_number'] or 'N/A'}, 선고일 {precedent['date'] or 'N/A'})")
        else:
            citation = f"- {precedent['summary']}"
        items.append({"source": "판례", "title": precedent["title"],
                      "content": precedent["summary"], "citation": citation})

    # 3) 최신 법령 조문 본문 (특정 법령명이 드러난 질문에서만 수집됨)
    for law_text in law.get("law_texts", []):
        items.append({
            "source": "법령",
            "title": law_text["name"],
            "content": law_text["text"][:LAW_TEXT_MAX_CHARS],
            "citation": f"- {law_text['name']} (최신 조문, 출처: 법제처 국가법령정보센터)",
        })

    # 4) 종합검색(chain_full_research) — 폭넓은 질문/폴백에서 수집된 종합 결과
    if law.get("chain_research"):
        items.append({
            "source": "종합검색",
            "title": "법제처 종합검색 결과",
            "content": law["chain_research"][:CHAIN_RESEARCH_MAX_CHARS],
            "citation": "- 법제처 종합검색 (korean-law MCP chain_full_research)",
        })

    # 5) 웹 (뉴스·시장 동향)
    for web in state.get("web_results", []):
        citation = f"- [{web['title']}]({web['link']})" if web["link"] else f"- {web['title']}"
        items.append({"source": "웹", "title": web["title"],
                      "content": web["snippet"], "citation": citation})

    # 6) YouTube — 자막 청크 우선, 자막 없는 영상은 설명(description)으로 보강(graceful)
    chunk_video_ids = set()
    for chunk in state.get("youtube_chunks", []):
        chunk_video_ids.add(chunk["video_id"])
        items.append({
            "source": "YouTube",
            "title": chunk["title"],
            "content": chunk["text"],
            "citation": f"- [{chunk['title']}]({chunk['timestamp_url']}) @ {chunk['timestamp_display']}",
        })
    for video in state.get("youtube_videos", []):
        if video["video_id"] in chunk_video_ids:
            continue  # 이미 자막 청크로 포함된 영상은 중복 추가하지 않음

    return items`,
    },
    {
      id: "build_context",
      name: "build_context()",
      fileId: "workflow",
      summary: "관련 항목들을 소스별로 묶어 답변 생성용 단일 컨텍스트 문자열로 합침",
      how: "관련성 평가를 통과한 항목들을 LLM에 넣기 좋은 하나의 긴 글로 합칩니다. 같은 소스(판례/웹/YouTube 등)끼리 묶고, 각 소스 안에서 '=== 판례 ===' 같은 머리글과 번호를 붙여 LLM이 어떤 출처의 내용인지 구분하게 합니다. 등장 순서는 그대로 보존합니다. 항목이 하나도 없으면 '(검색 결과 없음)'을 돌려줍니다. 이렇게 정리된 컨텍스트가 답변 생성의 근거가 됩니다.",
      terms: ["컨텍스트(context)", "Self-RAG"],
      lines: [
        { at: "def build_context(items: list[dict]) -> str:", text: "관련 항목들을 답변 생성용 단일 컨텍스트로 합치는 함수입니다." },
        { at: "return \"(검색 결과 없음)\"", text: "항목이 하나도 없으면 '(검색 결과 없음)'을 돌려줍니다." },
        { at: "grouped.setdefault(item[\"source\"], []).append(item)", text: "같은 소스끼리 묶습니다(등장 순서 보존)." },
        { at: "lines = [f\"=== {source} ===\"]", text: "각 소스 블록 앞에 '=== 소스명 ===' 머리글을 답니다." },
        { at: "return \"\\n\\n\".join(blocks)", text: "소스별 블록을 빈 줄로 이어 하나의 컨텍스트 문자열로 만듭니다." },
      ],
      code: `def build_context(items: list[dict]) -> str:
    """관련 항목을 소스별로 묶어 답변 생성용 단일 컨텍스트 문자열로 합침."""
    if not items:
        return "(검색 결과 없음)"
    # 소스별 그룹화 (등장 순서 보존)
    grouped: dict[str, list[dict]] = {}
    for item in items:
        grouped.setdefault(item["source"], []).append(item)

    blocks = []
    for source, group in grouped.items():
        lines = [f"=== {source} ==="]
        for index, item in enumerate(group, 1):
            lines.append(f"[{source} {index}] {item['title']}\\n{item['content']}")
        blocks.append("\\n\\n".join(lines))
    return "\\n\\n".join(blocks)`,
    },
    {
      id: "build_sources_section",
      name: "build_sources_section()",
      fileId: "workflow",
      summary: "관련 항목의 citation을 소스별로 묶어 '출처' 섹션을 코드가 직접 구성(인용 환각 방지)",
      how: "답변 끝에 붙는 '## 출처' 섹션을 코드가 직접 조립합니다. 각 항목이 이미 들고 있는 citation(링크·사건번호·타임스탬프)을 소스별로 묶고, 같은 출처가 중복되면 순서를 보존하며 한 번만 남깁니다. 출처를 LLM이 아니라 코드가 붙이는 이유는, LLM이 그럴듯한 가짜 URL·사건번호를 지어내는 인용 환각을 막기 위함입니다. 결과 문자열은 generate 노드가 답변 본문 뒤에 이어 붙입니다.",
      terms: ["인용 환각 방지", "마크다운(markdown)", "컨텍스트(context)"],
      lines: [
        { at: "def build_sources_section(items: list[dict]) -> str:", text: "항목들의 출처를 모아 '출처' 섹션 문자열을 만드는 함수입니다." },
        { at: "grouped.setdefault(item[\"source\"], []).append(item[\"citation\"])", text: "각 항목의 citation을 소스별로 묶어 모읍니다." },
        { at: "unique = list(dict.fromkeys(citations))", text: "같은 출처가 중복되면 순서를 보존하며 한 번만 남깁니다." },
        { at: "blocks.append(f\"**{source}**\\n\"", text: "소스명을 굵게 표시하고 그 아래 출처 줄들을 붙입니다." },
        { at: "return \"## 출처\\n\"", text: "맨 앞에 '## 출처' 제목을 달아 최종 섹션 문자열을 반환합니다." },
      ],
      code: `def build_sources_section(items: list[dict]) -> str:
    """관련 항목의 citation을 소스별로 묶어 '출처' 섹션을 코드에서 직접 구성함(인용 환각 방지)."""
    if not items:
        return ""
    grouped: dict[str, list[str]] = {}
    for item in items:
        if item["citation"]:
            grouped.setdefault(item["source"], []).append(item["citation"])

    blocks = []
    for source, citations in grouped.items():
        # 같은 출처가 중복되면 순서를 보존하며 한 번만 남김
        unique = list(dict.fromkeys(citations))
        blocks.append(f"**{source}**\\n" + "\\n".join(unique))
    if not blocks:
        return ""
    return "## 출처\\n" + "\\n\\n".join(blocks)`,
    },
    {
      id: "route",
      name: "route()",
      fileId: "workflow",
      summary: "라우터 노드 — 검색 필요 여부와 소스(law/web/youtube), 소스별 쿼리를 LLM이 한 번에 결정",
      how: "Self-RAG의 첫 관문입니다. 시스템 프롬프트로 '특허 동향 챗봇의 라우터'라는 역할과 판단 기준을 주고, 이전 대화 맥락과 현재 질문을 넣어 LLM을 호출합니다. LLM은 RouteDecision 스키마에 맞춰 '검색 필요?·어떤 소스?·각 소스 검색어'를 채워 돌려줍니다. 검색이 필요 없다고 판단하면 소스 목록을 비워, 뒤의 분기에서 검색을 건너뛰고 바로 답변하게 만듭니다.",
      terms: ["LangGraph", "노드(node)", "ChatPromptTemplate", "구조화 출력(structured output)", "Self-RAG", "멀티턴(multi-turn)"],
      lines: [
        { at: "def route(self, state: AgentState) -> dict:", text: "그래프의 라우팅 노드 — 입력은 공용 상태, 출력은 갱신할 칸만 담은 딕셔너리입니다." },
        { at: "prompt = ChatPromptTemplate.from_messages([", text: "라우터에게 줄 지시문(역할·소스 설명·쿼리 작성 규칙)을 프롬프트로 구성합니다." },
        { at: "decision: RouteDecision = (prompt | self.router).invoke({", text: "프롬프트와 구조화 LLM을 연결해 호출 → RouteDecision 형태의 결정을 받습니다." },
        { at: "\"history\": format_history(state.get(\"history\", [])),", text: "이전 대화를 텍스트로 만들어 후속 질문의 의도를 정확히 파악하게 돕습니다." },
        { at: "sources = decision.sources if decision.needs_retrieval else []", text: "검색 불필요로 판단되면 소스 목록을 비워 검색 단계를 건너뛰게 합니다." },
        { at: "return {", text: "라우팅 결과(검색 여부·소스·소스별 쿼리)를 상태에 합치도록 반환합니다." },
      ],
      code: `# (일부 발췌)
    def route(self, state: AgentState) -> dict:
        """라우터 노드: 검색 필요 여부·소스(law/web/youtube)·소스별 쿼리를 결정함."""
        print("\\n[Route] 검색 필요 여부 및 소스 판단 중...")
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 특허 '선행기술·동향 리서치' 챗봇의 라우터입니다.
사용자 질문을 분석해 외부 동적 소스 검색 전략을 결정하세요.
  - law     : 판례·법령해석례·최신 법령 조문이 필요할 때 (korean-law MCP)
  - web     : 뉴스·시장 동향·통계·업계 사례 등 '최신 정보'가 필요할 때 (DuckDuckGo)
  - youtube : 강의·해설·실무 팁 등 '영상 설명'을 원할 때
이전 대화 맥락을 참고해 후속 질문의 의도를 정확히 파악하세요."""),
            ("human", "이전 대화:\\n{history}\\n\\n현재 질문: {question}\\n\\n검색 전략을 결정하세요."),
        ])
        decision: RouteDecision = (prompt | self.router).invoke({
            "history": format_history(state.get("history", [])),
            "question": state["question"],
        })
        sources = decision.sources if decision.needs_retrieval else []
        print(f"  → 검색 필요: {decision.needs_retrieval} / 소스: {sources or '없음'}")
        return {
            "needs_retrieval": decision.needs_retrieval,
            "sources": sources,
            "law_query": decision.law_query,
            "law_name": decision.law_name,
            "use_chain_research": decision.use_chain_research,
            "web_query": decision.web_query,
            "youtube_query": decision.youtube_query,
            "route_reasoning": decision.reasoning,
        }`,
    },
    {
      id: "retrieve",
      name: "retrieve()",
      fileId: "workflow",
      summary: "검색 노드 — 선택된 소스(law/web/youtube)에서만 검색하고, 한 소스가 실패해도 나머지로 계속(장애 격리)",
      how: "이 함수가 '다중 소스 + 장애 격리'를 담당합니다. 라우터가 고른 소스에 대해서만 검색을 실행합니다. 법령은 원격 MCP 클라이언트(run_law_search)를 try/except로 감싸 호출하므로, MCP 서버가 응답을 못 해도 그 소스만 빈 결과로 두고 멈추지 않습니다. 웹·YouTube 검색 함수도 각자 내부에서 실패를 빈 리스트로 흡수합니다. 마지막에 세 소스의 결과를 하나의 '통합 항목 리스트'로 합쳐 다음 단계(관련성 평가)로 넘깁니다.",
      terms: ["노드(node)", "MCP(Model Context Protocol)", "장애 격리(failure isolation)", "graceful degradation", "try/except", "DuckDuckGo", "YouTube Data API"],
      lines: [
        { at: "sources = state[\"sources\"]", text: "라우터가 고른 소스 목록을 꺼냅니다(이 목록에 든 소스만 검색)." },
        { at: "if \"law\" in sources:", text: "law가 선택된 경우에만 법령 MCP 검색을 수행합니다." },
        { at: "law_raw = run_law_search(query, state[\"law_name\"], state[\"use_chain_research\"])", text: "원격 MCP 클라이언트로 판례·해석례·최신법령을 한 번에 수집합니다." },
        { at: "except Exception as error:  # noqa: BLE001", text: "법령 검색이 실패해도 예외를 흡수해 다른 소스로 계속 진행합니다(장애 격리 핵심)." },
        { at: "if \"web\" in sources:", text: "web이 선택된 경우에만 DuckDuckGo 웹 검색을 수행합니다." },
        { at: "if \"youtube\" in sources:", text: "youtube가 선택된 경우에만 영상 검색·자막 로드를 수행합니다." },
        { at: "items = build_retrieved_items({**state, **new_state})", text: "세 소스 결과를 하나의 통합 항목 리스트로 합쳐 평가 대상으로 만듭니다." },
      ],
      code: `# (일부 발췌)
    def retrieve(self, state: AgentState) -> dict:
        """검색 노드: 선택된 소스에서만 검색을 수행하고 통합 항목 리스트를 구성함.

        각 소스 호출을 try/except로 감싸 한 소스가 실패해도 나머지로 답변을 만들 수 있게 함.
        """
        sources = state["sources"]
        law_raw = {"precedents": [], "interpretations": [], "laws": [], "law_texts": [], "chain_research": ""}
        web_results, youtube_videos, youtube_chunks = [], [], []

        # 판례·해석례·최신법령 (korean-law MCP — Streamable HTTP 클라이언트)
        if "law" in sources:
            query = state["law_query"] or state["question"]
            try:
                law_raw = run_law_search(query, state["law_name"], state["use_chain_research"])
            except Exception as error:  # noqa: BLE001
                print(f"  ! law 검색 실패(무시하고 진행): {type(error).__name__}: {str(error)[:120]}")

        # 웹 (DuckDuckGo)
        if "web" in sources:
            web_results = search_web(state["web_query"] or state["question"])

        # YouTube (Data API v3 + YoutubeLoader 자막)
        if "youtube" in sources:
            yt = search_youtube(state["youtube_query"] or state["question"])
            youtube_videos, youtube_chunks = yt["videos"], yt["chunks"]

        # 통합 항목 구성 (IsRel·컨텍스트·출처 공용)
        new_state = {
            "law_raw": law_raw,
            "web_results": web_results,
            "youtube_videos": youtube_videos,
            "youtube_chunks": youtube_chunks,
        }
        items = build_retrieved_items({**state, **new_state})
        new_state["retrieved_items"] = items
        return new_state`,
    },
    {
      id: "grade_documents",
      name: "grade_documents()",
      fileId: "workflow",
      summary: "[IsRel] 관련성 평가 노드 — 모은 항목이 질문과 정말 관련 있는지 LLM이 한 번에 일괄 평가해 선별",
      how: "Self-RAG의 'IsRel' 단계입니다. 검색은 키워드만 스쳐도 엉뚱한 자료를 끌고 오므로, 모은 항목들을 LLM이 한 번의 호출로 일괄 채점(관련 있음/없음)합니다. 비용을 아끼려고 각 항목의 본문은 앞부분만 잘라 보여 줍니다. 평가 결과에서 '관련 있음'으로 표시된 인덱스의 항목만 골라 다음 단계(답변 생성)로 넘깁니다. 모은 게 하나도 없으면 평가를 건너뜁니다.",
      terms: ["IsRel", "Self-RAG", "노드(node)", "ChatPromptTemplate", "구조화 출력(structured output)", "인덱스(index)"],
      lines: [
        { at: "items = state[\"retrieved_items\"]", text: "이전 검색 단계가 모은 통합 항목들을 가져옵니다." },
        { at: "if not items:", text: "모은 항목이 하나도 없으면 평가를 건너뛰고 빈 결과를 돌려줍니다." },
        { at: "item['content'][:RELEVANCE_PREVIEW_CHARS]", text: "각 항목 본문을 앞부분만 잘라 보여 줘 평가 비용(토큰)을 제한합니다." },
        { at: "batch: BatchRelevanceGrade = (prompt | self.relevance_grader).invoke({", text: "한 번의 LLM 호출로 모든 항목의 관련성을 일괄 평가합니다." },
        { at: "if 0 <= grade.document_index < len(items) and grade.is_relevant:", text: "유효한 인덱스이면서 '관련 있음'으로 표시된 항목만 추립니다." },
        { at: "return {\"relevant_items\": relevant}", text: "관련성을 통과한 항목만 상태에 담아 답변 생성 단계로 넘깁니다." },
      ],
      code: `# (일부 발췌)
    def grade_documents(self, state: AgentState) -> dict:
        """[IsRel] 노드: 통합 검색 항목의 관련성을 1회 LLM 호출로 일괄 평가해 선별함."""
        items = state["retrieved_items"]
        if not items:
            return {"relevant_items": []}

        print("\\n[IsRel] 검색 항목 관련성 일괄 평가 중...")
        # 항목마다 소스·제목 + 본문 미리보기를 보여줌 (긴 본문은 잘라 평가 비용을 제한함)
        docs_text = "\\n\\n".join(
            f"[항목 {i}] ({item['source']}) {item['title']}\\n{item['content'][:RELEVANCE_PREVIEW_CHARS]}"
            for i, item in enumerate(items)
        )
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 검색된 항목들이 질문과 관련 있는지 평가하는 전문가입니다.
항목이 질문에 답하는 데 직접 도움이 되는 정보를 포함하면 관련 있음(True)으로 판단합니다."""),
            ("human", "질문: {question}\\n\\n검색된 항목들:\\n{documents}\\n\\n각 항목의 관련성을 평가해 주세요."),
        ])
        batch: BatchRelevanceGrade = (prompt | self.relevance_grader).invoke({
            "question": state["question"],
            "documents": docs_text,
        })
        relevant = []
        for grade in batch.results:
            if 0 <= grade.document_index < len(items) and grade.is_relevant:
                relevant.append(items[grade.document_index])
        print(f"  → 관련 항목 {len(relevant)}/{len(items)}개 선별")
        return {"relevant_items": relevant}`,
    },
    {
      id: "generate",
      name: "generate()",
      fileId: "workflow",
      summary: "생성 노드 — 관련 자료로 답변 생성 → 근거성([IsSup]) 부족 시 엄격 재생성 → 코드 기반 출처 부착",
      how: "Self-RAG의 'IsSup'(근거성) 단계입니다. 먼저 걸러진 관련 자료만 컨텍스트로 묶어 답변 초안을 만듭니다(strict=False). 자료가 있으면 '이 답변이 정말 컨텍스트에 근거하는가?'를 LLM이 검사하고, 근거가 부족하면 '컨텍스트에 있는 내용만 써라'는 엄격 모드(strict=True)로 다시 씁니다. 재생성 뒤에는 근거성을 한 번 더 평가해 요약 표시를 실제와 맞춥니다. 마지막으로 출처 섹션은 LLM이 아니라 코드가 직접 붙여(build_sources_section) 인용 URL·번호를 지어내는 환각을 막습니다.",
      terms: ["IsSup", "Self-RAG", "노드(node)", "환각(hallucination)", "컨텍스트(context)", "인용 환각 방지"],
      lines: [
        { at: "context = build_context(relevant)", text: "관련 항목들을 소스별로 묶어 답변 생성용 단일 컨텍스트로 만듭니다." },
        { at: "answer = self._generate_answer(state, context, strict=False)", text: "먼저 일반 모드로 답변 초안을 생성합니다." },
        { at: "print(\"\\n[IsSup] 답변 근거성 평가 중...\")", text: "[IsSup] 답변이 컨텍스트에 근거하는지(환각 없는지)를 검사하는 단계로 들어갑니다." },
        { at: "if not support.is_supported:", text: "근거가 부족하면 아래 엄격 재생성 분기로 들어갑니다." },
        { at: "answer = self._generate_answer(state, context, strict=True)", text: "'컨텍스트에 있는 내용만 써라'는 엄격 모드로 답변을 다시 생성합니다." },
        { at: "sources_section = build_sources_section(relevant)", text: "출처 섹션을 코드가 직접 구성합니다(LLM의 인용 환각 방지)." },
        { at: "return {\"answer\": full_answer, \"is_supported\": is_supported}", text: "출처가 붙은 최종 답변과 근거성 결과를 상태에 담아 반환합니다." },
      ],
      code: `# (일부 발췌)
    def generate(self, state: AgentState) -> dict:
        """생성 노드: 관련 항목으로 답변 생성 → 근거성([IsSup]) 부족 시 엄격 재생성 → 코드기반 출처 부착."""
        relevant = state["relevant_items"]
        context = build_context(relevant)
        has_context = bool(relevant)

        print("\\n[Generate] 검색 결과 기반 답변 생성 중...")
        answer = self._generate_answer(state, context, strict=False)

        is_supported: Optional[bool] = None
        if has_context:
            print("\\n[IsSup] 답변 근거성 평가 중...")
            support = self._grade_support(answer, context)
            is_supported = support.is_supported
            if not support.is_supported:
                print("\\n[Generate] 근거 부족 → 엄격 근거 기반으로 답변 재생성 중...")
                answer = self._generate_answer(state, context, strict=True)
                # 엄격 재생성 결과를 다시 근거성 평가해 is_supported를 갱신함
                support = self._grade_support(answer, context)
                is_supported = support.is_supported

        sources_section = build_sources_section(relevant)
        full_answer = f"{answer}\\n\\n{sources_section}".strip() if sources_section else answer
        return {"answer": full_answer, "is_supported": is_supported}`,
    },
    {
      id: "generate_answer",
      name: "_generate_answer()",
      fileId: "workflow",
      summary: "검색 컨텍스트와 대화 맥락을 근거로 답변 본문을 생성 — strict=True면 컨텍스트에 있는 내용만 쓰도록 강제",
      how: "generate 노드가 답변 초안과 엄격 재생성에 공통으로 쓰는 생성 헬퍼입니다. 시스템 프롬프트로 '특허 선행기술·동향 전문 AI' 역할과 규칙(판례 흐름 정리·임의 시점 금지·출처는 직접 쓰지 말 것)을 주고, 이전 대화 맥락과 검색 컨텍스트를 끼워 LLM을 호출합니다. strict=True면 '컨텍스트에 있는 정보만 쓰고, 없으면 확인되지 않음이라고 명시하라'는 엄격 규칙을 덧붙여 환각을 줄입니다. 출처는 본문에 쓰지 못하게 막고 시스템(코드)이 따로 붙입니다.",
      terms: ["컨텍스트(context)", "환각(hallucination)", "ChatPromptTemplate", "멀티턴(multi-turn)", "타임스탬프 URL"],
      lines: [
        { at: "def _generate_answer(self, state: AgentState, context: str, strict: bool) -> str:", text: "컨텍스트·대화 맥락을 근거로 답변 본문을 만드는 헬퍼입니다." },
        { at: "strict_rule = (", text: "strict=True일 때 덧붙일 '엄격한 근거 기반' 규칙 문구를 준비합니다." },
        { at: "if strict else \"\"", text: "strict=False면 엄격 규칙을 비워 일반 모드로 생성합니다." },
        { at: "만들어내지 마세요. 구체적 시점은 시스템이 출처 섹션의 타임스탬프 URL로 제공합니다.", text: "영상의 임의 시점(분:초)을 지어내지 말도록 막습니다(시점은 코드가 붙임)." },
        { at: "\"question\": state[\"original_question\"],", text: "답변은 재작성본이 아니라 최초 질문(original_question)에 답하게 합니다." },
      ],
      code: `# (일부 발췌)
    def _generate_answer(self, state: AgentState, context: str, strict: bool) -> str:
        """검색 컨텍스트와 대화 맥락을 근거로 답변 본문을 생성함 (strict=True면 컨텍스트만 사용)."""
        strict_rule = (
            "\\n## 중요: 엄격한 근거 기반 답변\\n- 반드시 아래 컨텍스트에 있는 정보만 사용하세요.\\n"
            "- 컨텍스트에 없는 내용은 추가하지 말고 '확인되지 않음'이라고 명시하세요."
            if strict else ""
        )
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 특허 선행기술·동향 리서치 전문 AI입니다.

## 규칙
1. 컨텍스트의 정보를 우선 활용하되, 핵심을 요약해 명확히 전달
2. 판례는 어떤 사건이 있는지, 최근 흐름이 어떤지 정리 (사건번호·선고일이 있으면 자연스럽게 언급)
3. 영상은 어떤 영상이 도움이 되는지 안내하되, 컨텍스트에 명시되지 않은 임의의 시점(분:초)을
   만들어내지 마세요. 구체적 시점은 시스템이 출처 섹션의 타임스탬프 URL로 제공합니다.
4. '출처' 섹션은 시스템이 자동으로 덧붙이므로 답변 본문에 직접 작성하지 마세요{strict_rule}

## 이전 대화 맥락
{history}

## 검색 컨텍스트
{context}"""),
            ("human", "{question}"),
        ])
        return (prompt | self.llm | StrOutputParser()).invoke({
            "history": format_history(state.get("history", [])),
            "context": context,
            "question": state["original_question"],
            "strict_rule": strict_rule,
        })`,
    },
    {
      id: "grade_support",
      name: "_grade_support()",
      fileId: "workflow",
      summary: "[IsSup] 생성된 답변이 검색 컨텍스트에 근거하는지(환각이 없는지)를 LLM으로 검증",
      how: "Self-RAG의 근거성(IsSup) 검사를 실제로 수행하는 헬퍼입니다. '답변의 주요 주장이 컨텍스트에서 직접 확인되는가?'를 LLM에게 묻고, 컨텍스트에 없는 내용을 추가·왜곡했으면 근거 없음(False)으로 판정하게 합니다. 결과는 SupportGrade 스키마(근거 있음 여부+이유)로 받아 generate 노드가 엄격 재생성 여부를 결정하는 근거로 씁니다.",
      terms: ["IsSup", "Self-RAG", "환각(hallucination)", "컨텍스트(context)", "ChatPromptTemplate", "구조화 출력(structured output)"],
      lines: [
        { at: "def _grade_support(self, answer: str, context: str) -> SupportGrade:", text: "답변이 컨텍스트에 근거하는지 검증하는 [IsSup] 헬퍼입니다." },
        { at: "답변의 주요 주장과 정보가 컨텍스트에서 직접 확인 가능해야 근거 있음(True)입니다.", text: "주요 주장이 컨텍스트에서 직접 확인돼야 '근거 있음'으로 판정합니다." },
        { at: "컨텍스트에 없는 정보를 추가하거나 왜곡했으면 근거 없음(False)으로 판단합니다.", text: "없는 정보를 더하거나 왜곡하면 '근거 없음'으로 판정합니다(환각 탐지)." },
        { at: "return (prompt | self.support_grader).invoke({\"context\": context, \"answer\": answer})", text: "근거성 평가 전용 LLM으로 호출해 SupportGrade 결과를 받습니다." },
      ],
      code: `# (일부 발췌)
    def _grade_support(self, answer: str, context: str) -> SupportGrade:
        """[IsSup]: 생성된 답변이 검색 컨텍스트에 근거하는지(환각이 없는지) 검증함."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 생성된 답변이 제공된 컨텍스트에 근거하는지 평가하는 전문가입니다.

답변의 주요 주장과 정보가 컨텍스트에서 직접 확인 가능해야 근거 있음(True)입니다.
컨텍스트에 없는 정보를 추가하거나 왜곡했으면 근거 없음(False)으로 판단합니다.
판단 이유(reasoning)는 한국어로 작성하세요."""),
            ("human", "컨텍스트:\\n{context}\\n\\n생성된 답변:\\n{answer}\\n\\n이 답변이 컨텍스트에 근거하고 있나요?"),
        ])
        return (prompt | self.support_grader).invoke({"context": context, "answer": answer})`,
    },
    {
      id: "grade_generation",
      name: "grade_generation()",
      fileId: "workflow",
      summary: "[IsUse] 유용성 평가 노드 — 최종 답변이 사용자 질문에 유용한지 LLM이 평가(재검색 루프의 분기 기준)",
      how: "Self-RAG의 마지막 평가 단계(IsUse)입니다. '이 답변이 질문에 직접 답하고, 명확하며, 실질적으로 도움이 되는가?'를 LLM에게 묻습니다. 질문을 회피하거나 모호하거나 너무 일반적이면 '유용하지 않음(False)'으로 판정합니다. 평가의 기준은 재작성본이 아니라 최초 질문(original_question)입니다. 이 결과(is_useful)가 바로 다음 분기에서 '종료할지 vs 질문을 다시 써 재검색할지'를 가릅니다.",
      terms: ["IsUse", "Self-RAG", "노드(node)", "ChatPromptTemplate", "구조화 출력(structured output)", "Query Rewriting"],
      lines: [
        { at: "def grade_generation(self, state: AgentState) -> dict:", text: "최종 답변의 유용성을 평가하는 [IsUse] 노드입니다." },
        { at: "[유용함 = True] 질문에 직접 답하고, 내용이 명확하며 실질적으로 도움이 됨", text: "질문에 직접 답하고 명확·유익하면 '유용함'으로 봅니다." },
        { at: "[유용하지 않음 = False] 질문을 회피·모호하게 답하거나", text: "회피·모호·일반적이면 '유용하지 않음'으로 판정합니다(재검색 트리거)." },
        { at: "\"question\": state[\"original_question\"],", text: "재작성본이 아니라 최초 질문을 기준으로 유용성을 따집니다." },
        { at: "return {\"is_useful\": grade.is_useful, \"usefulness_reasoning\": grade.reasoning}", text: "유용성 결과와 이유를 상태에 담아 분기 엣지로 넘깁니다." },
      ],
      code: `# (일부 발췌)
    def grade_generation(self, state: AgentState) -> dict:
        """[IsUse] 노드: 최종 답변이 사용자 질문에 유용한지 평가함 (재검색 루프의 분기 기준)."""
        print("\\n[IsUse] 답변 유용성 평가 중...")
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 생성된 답변이 사용자 질문에 유용한지 평가하는 전문가입니다.

[유용함 = True] 질문에 직접 답하고, 내용이 명확하며 실질적으로 도움이 됨
[유용하지 않음 = False] 질문을 회피·모호하게 답하거나, 관련 없는 정보만 나열하거나, 너무 일반적임

판단 이유(reasoning)는 한국어로 작성하세요."""),
            ("human", "질문: {question}\\n\\n답변:\\n{answer}\\n\\n이 답변이 질문에 유용하게 답하고 있나요?"),
        ])
        grade: UsefulnessGrade = (prompt | self.usefulness_grader).invoke({
            "question": state["original_question"],
            "answer": state["answer"],
        })
        print(f"  → 유용함: {grade.is_useful} ({grade.reasoning})")
        return {"is_useful": grade.is_useful, "usefulness_reasoning": grade.reasoning}`,
    },
    {
      id: "rewrite",
      name: "rewrite()",
      fileId: "workflow",
      summary: "Query Rewriting 노드 — 유용성 미달 시 더 나은 검색을 위해 질문을 전문 용어로 다시 작성하고 재시도 횟수를 올림",
      how: "유용성(IsUse) 미달로 판정되면 실행되는 노드입니다. '원래 질문으로는 좋은 답을 못 만들었으니, 더 잘 검색되게 질문을 고쳐 써라'고 LLM에 요청합니다. 모호한 표현을 구체적 특허·판례 용어로, 구어체를 문어체로 바꾸고 핵심 키워드를 명확히 넣습니다. 새 질문은 다음 라우팅의 입력이 되고, retry_count를 1 올려 무한 루프를 막는 가드의 카운터로 씁니다. 재작성 이력(rewrites)도 남겨 요약에서 추적할 수 있게 합니다.",
      terms: ["Query Rewriting", "노드(node)", "Self-RAG", "재시도(retry)", "ChatPromptTemplate"],
      lines: [
        { at: "def rewrite(self, state: AgentState) -> dict:", text: "유용성 미달 시 질문을 다시 쓰는 Query Rewriting 노드입니다." },
        { at: "1. 모호한 표현을 구체적인 특허/판례 용어로 변환", text: "모호한 표현을 구체적 특허·판례 용어로 바꿉니다." },
        { at: "rewritten: RewrittenQuery = (prompt | self.query_rewriter).invoke({", text: "재작성 전용 LLM으로 호출해 다시 쓴 질문을 받습니다." },
        { at: "\"question\": rewritten.rewritten_query,", text: "다음 라우팅의 입력이 될 새 질문으로 교체합니다." },
        { at: "\"retry_count\": state[\"retry_count\"] + 1,", text: "재시도 횟수를 1 올립니다(무한 루프 방지 가드의 카운터)." },
        { at: "\"rewrites\": state[\"rewrites\"] + [{", text: "어떤 질문을 어떻게 고쳤는지 재작성 이력을 누적합니다." },
      ],
      code: `# (일부 발췌)
    def rewrite(self, state: AgentState) -> dict:
        """Query Rewriting 노드: 유용성 미달 시 더 나은 검색을 위해 질문을 재작성함."""
        print("\\n[Query Rewriting] 유용성 미달 → 질문 재작성 중...")
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 검색 쿼리를 최적화하는 전문가입니다.

원래 질문으로 시도했으나 유용한 답변을 생성하지 못했습니다. 더 나은 검색을 위해 질문을 다시 작성하세요.

## 재작성 전략
1. 모호한 표현을 구체적인 특허/판례 용어로 변환
2. 구어체를 문어체/전문 용어로 변환
3. 선행기술·판례·동향 검색에 적합한 핵심 키워드를 명확히 포함

재작성 이유(reasoning)는 한국어로 작성하세요."""),
            ("human", """원래 질문: {original_question}

이전 답변(유용하지 않음): {failed_answer}

유용하지 않은 이유: {failure_reason}

더 나은 검색 결과를 위해 질문을 다시 작성해 주세요."""),
        ])
        rewritten: RewrittenQuery = (prompt | self.query_rewriter).invoke({
            "original_question": state["original_question"],
            "failed_answer": state["answer"],
            "failure_reason": state.get("usefulness_reasoning", ""),
        })
        print(f"  → 재작성 질문: {rewritten.rewritten_query}")
        return {
            "question": rewritten.rewritten_query,
            "retry_count": state["retry_count"] + 1,
            "rewrites": state["rewrites"] + [{
                "from": state["question"],
                "to": rewritten.rewritten_query,
                "reasoning": rewritten.reasoning,
            }],
        }`,
    },
    {
      id: "direct_answer",
      name: "direct_answer()",
      fileId: "workflow",
      summary: "직접 답변 노드 — 특허 외 질문·인사 등 검색 불필요 질문은 외부 검색 없이 LLM 지식·대화 맥락으로 바로 답변",
      how: "라우터가 '검색 불필요'로 판정한 질문(인사·잡담·특허 무관 주제)을 처리하는 우회로 노드입니다. 외부 검색을 건너뛰고 LLM이 가진 지식과 이전 대화 맥락만으로 친절하게 답합니다. 특허·지식재산권과 무관하면 일반 지식으로 간단히 답하되 필요하면 특허 질문을 안내합니다. 불필요한 검색 비용·지연을 줄이는 단계로, 답변 뒤 곧장 그래프를 종료합니다.",
      terms: ["노드(node)", "Self-RAG", "ChatPromptTemplate", "멀티턴(multi-turn)", "컨텍스트(context)"],
      lines: [
        { at: "def direct_answer(self, state: AgentState) -> dict:", text: "검색 없이 LLM 지식으로 바로 답하는 직접 답변 노드입니다." },
        { at: "다만 이번 질문은 검색이 필요 없는 질문입니다.", text: "이 노드는 라우터가 '검색 불필요'로 본 질문만 들어옵니다." },
        { at: "특허/지식재산권과 무관한 주제라면 일반 지식으로 간단히 답하되", text: "특허와 무관하면 일반 지식으로 간단히 답합니다." },
        { at: "answer = (prompt | self.llm | StrOutputParser()).invoke({", text: "구조화 없이 일반 LLM 체인으로 답변 텍스트를 생성합니다." },
        { at: "return {\"answer\": answer}", text: "생성한 답변만 상태에 담고 곧장 종료로 향합니다." },
      ],
      code: `# (일부 발췌)
    def direct_answer(self, state: AgentState) -> dict:
        """직접 답변 노드: 특허 외 질문·인사 등은 검색 없이 LLM 지식과 대화 맥락으로 답변함."""
        print("\\n[Direct] 검색 불필요 → LLM 지식으로 직접 답변 중...")
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 특허 선행기술·동향 리서치 챗봇입니다. 다만 이번 질문은 검색이 필요 없는 질문입니다.

이전 대화 맥락을 고려해 친절하고 정확하게 답변하세요.
특허/지식재산권과 무관한 주제라면 일반 지식으로 간단히 답하되, 필요하면 특허 관련 질문을 안내해도 좋습니다.

## 이전 대화 맥락
{history}"""),
            ("human", "{question}"),
        ])
        answer = (prompt | self.llm | StrOutputParser()).invoke({
            "history": format_history(state.get("history", [])),
            "question": state["question"],
        })
        return {"answer": answer}`,
    },
    {
      id: "decide_edges",
      name: "decide_search_path() · decide_after_generation()",
      fileId: "workflow",
      summary: "두 조건부 엣지 — route 후 retrieve/direct 분기, grade_generation 후 종료/재작성 분기(재시도 가드 포함)",
      how: "그래프의 흐름을 가르는 두 갈림길 함수입니다. decide_search_path는 route 직후 '검색이 필요하고 소스가 있으면 retrieve로, 아니면 direct_answer로' 보냅니다. decide_after_generation은 유용성(IsUse) 평가 직후 '유용하면 종료(end), 미달이면 rewrite로' 보내되, 재시도가 상한(MAX_RETRIES)에 닿았으면 더 돌지 않고 마지막 답변으로 종료합니다 — 이 가드가 무한 루프(GraphRecursionError)를 막습니다. 두 함수의 반환 문자열이 _build_graph의 분기 맵과 연결됩니다.",
      terms: ["조건부 엣지(conditional edge)", "노드(node)", "Self-RAG", "재시도(retry)", "Query Rewriting"],
      lines: [
        { at: "def decide_search_path(self, state: AgentState) -> Literal[\"retrieve\", \"direct\"]:", text: "route 직후 retrieve로 갈지 direct로 갈지 정하는 엣지입니다." },
        { at: "if state[\"needs_retrieval\"] and state[\"sources\"]:", text: "검색이 필요하고 소스가 있을 때만 검색 경로(retrieve)로 보냅니다." },
        { at: "def decide_after_generation(self, state: AgentState) -> Literal[\"rewrite\", \"end\"]:", text: "유용성 평가 직후 종료할지 재작성할지 정하는 엣지입니다." },
        { at: "if state[\"is_useful\"]:", text: "유용하면 더 돌지 않고 종료(end)로 보냅니다." },
        { at: "if state[\"retry_count\"] >= settings.MAX_RETRIES:", text: "재시도 상한에 닿으면 마지막 답변으로 종료해 무한 루프를 막습니다." },
        { at: "return \"rewrite\"", text: "유용 미달이고 재시도 여유가 있으면 질문 재작성으로 보냅니다." },
      ],
      code: `# (일부 발췌)
    def decide_search_path(self, state: AgentState) -> Literal["retrieve", "direct"]:
        """route 직후 분기: 검색 필요 + 소스 있으면 retrieve, 아니면 direct_answer."""
        if state["needs_retrieval"] and state["sources"]:
            return "retrieve"
        return "direct"

    def decide_after_generation(self, state: AgentState) -> Literal["rewrite", "end"]:
        """grade_generation 직후 분기: 유용하면 종료, 미달 + 재시도 남으면 rewrite.

        재시도 횟수 가드를 이 엣지에서 직접 검사해 무한 루프(GraphRecursionError)를 방지함.
        """
        if state["is_useful"]:
            return "end"
        if state["retry_count"] >= settings.MAX_RETRIES:
            print(f"\\n[경고] 최대 재시도({settings.MAX_RETRIES}회) 도달 → 마지막 답변을 그대로 반환함.")
            return "end"
        return "rewrite"`,
    },
    {
      id: "build_graph",
      name: "_build_graph()",
      fileId: "workflow",
      summary: "Self-RAG 그래프 배선 — 노드 7개와 엣지를 연결해 '검색→평가→재검색 루프'를 가진 StateGraph로 컴파일",
      how: "Self-RAG 워크플로의 전체 배선도입니다. 7개 노드(route·retrieve·grade_documents·generate·grade_generation·rewrite·direct_answer)를 등록하고 엣지로 잇습니다. START는 route로 가고, route에서 조건부 엣지로 retrieve 또는 direct_answer로 갈립니다. 검색 경로는 retrieve→grade_documents→generate→grade_generation으로 한 줄로 흐르다가, grade_generation에서 다시 조건부로 END 또는 rewrite로 갈립니다. 핵심은 rewrite→route로 되돌아가는 엣지로, 이것이 '검색→평가→재검색' 되먹임 루프를 만듭니다. 마지막에 compile()로 실행 가능한 그래프를 만듭니다.",
      terms: ["StateGraph", "노드(node)", "조건부 엣지(conditional edge)", "Self-RAG", "LangGraph"],
      lines: [
        { at: "def _build_graph(self):", text: "노드·엣지를 연결해 실행 가능한 그래프로 컴파일하는 함수입니다." },
        { at: "workflow = StateGraph(AgentState)", text: "공용 상태(AgentState)를 흐르게 할 빈 StateGraph를 만듭니다." },
        { at: "workflow.add_edge(START, \"route\")", text: "시작 지점을 라우터 노드에 연결합니다." },
        { at: "{\"retrieve\": \"retrieve\", \"direct\": \"direct_answer\"},", text: "route 분기 맵 — 검색이면 retrieve, 아니면 direct_answer로 갈립니다." },
        { at: "{\"rewrite\": \"rewrite\", \"end\": END},", text: "유용성 분기 맵 — 미달이면 rewrite, 유용하면 END로 갈립니다." },
        { at: "workflow.add_edge(\"rewrite\", \"route\")", text: "재작성 후 라우터로 되돌아가는 재검색 루프의 핵심 엣지입니다." },
        { at: "return workflow.compile()", text: "배선을 마쳐 실행 가능한 그래프로 컴파일해 돌려줍니다." },
      ],
      code: `# (일부 발췌)
    def _build_graph(self):
        """노드와 엣지를 연결해 실행 가능한 StateGraph로 컴파일함."""
        workflow = StateGraph(AgentState)
        workflow.add_node("route", self.route)
        workflow.add_node("retrieve", self.retrieve)
        workflow.add_node("grade_documents", self.grade_documents)
        workflow.add_node("generate", self.generate)
        workflow.add_node("grade_generation", self.grade_generation)
        workflow.add_node("rewrite", self.rewrite)
        workflow.add_node("direct_answer", self.direct_answer)

        workflow.add_edge(START, "route")
        workflow.add_conditional_edges(
            "route", self.decide_search_path,
            {"retrieve": "retrieve", "direct": "direct_answer"},
        )
        workflow.add_edge("retrieve", "grade_documents")
        workflow.add_edge("grade_documents", "generate")
        workflow.add_edge("generate", "grade_generation")
        workflow.add_conditional_edges(
            "grade_generation", self.decide_after_generation,
            {"rewrite": "rewrite", "end": END},
        )
        workflow.add_edge("rewrite", "route")
        workflow.add_edge("direct_answer", END)
        return workflow.compile()`,
    },
    {
      id: "invoke",
      name: "PatentTrendRAG.invoke()",
      fileId: "workflow",
      summary: "그래프 실행 진입점 — 질문 한 건의 초기 상태를 채워 그래프를 돌리고 최종 상태를 반환(멀티턴 history 전달)",
      how: "앱이 질문 하나를 처리할 때 부르는 실행 진입점입니다. AgentState의 모든 칸을 초기값으로 채운 뒤(현재 질문과 최초 질문에 같은 값, 재시도 0, 결과 칸은 비움), 멀티턴 맥락(history)을 함께 넣어 그래프를 실행합니다. recursion_limit을 넉넉히 줘 재검색 루프가 LangGraph 기본 단계 한계에 걸리지 않게 합니다. 그래프가 모든 노드를 거쳐 채운 최종 상태(답변·평가·재작성 이력 등)를 통째로 돌려줍니다.",
      terms: ["graph.invoke", "멀티턴(multi-turn)", "Self-RAG", "재시도(retry)", "StateGraph"],
      lines: [
        { at: "def invoke(self, question: str, history: list) -> dict:", text: "질문 한 건을 처리하는 그래프 실행 진입점입니다." },
        { at: "\"question\": question,", text: "현재 처리할 질문을 초기 상태에 넣습니다." },
        { at: "\"original_question\": question,", text: "유용성 평가·재작성의 기준이 될 최초 질문도 함께 저장합니다." },
        { at: "\"retry_count\": 0,", text: "재시도 횟수를 0에서 시작합니다." },
        { at: "return self.graph.invoke(initial_state, config={\"recursion_limit\": settings.RECURSION_LIMIT})", text: "초기 상태로 그래프를 실행하고 최종 상태를 반환합니다(단계 한계 상향)." },
      ],
      code: `# (일부 발췌)
    def invoke(self, question: str, history: list) -> dict:
        """질문 한 건에 대해 그래프를 실행하고 최종 상태를 반환함 (멀티턴 history 전달)."""
        initial_state: AgentState = {
            "question": question,
            "original_question": question,
            "history": history,
            "needs_retrieval": False,
            "sources": [],
            "law_query": "",
            "law_name": "",
            "use_chain_research": False,
            "web_query": "",
            "youtube_query": "",
            "route_reasoning": "",
            "law_raw": {},
            "web_results": [],
            "youtube_videos": [],
            "youtube_chunks": [],
            "retrieved_items": [],
            "relevant_items": [],
            "answer": "",
            "is_supported": None,
            "is_useful": None,
            "usefulness_reasoning": "",
            "retry_count": 0,
            "rewrites": [],
        }
        return self.graph.invoke(initial_state, config={"recursion_limit": settings.RECURSION_LIMIT})`,
    },

    // ───────────────────────── sources/law_client.py ─────────────────────────
    {
      id: "law_search",
      name: "search_law_sources() · run_law_search()",
      fileId: "law",
      summary: "법령 MCP 클라이언트 — 원격 서버에 한 세션으로 접속해 판례·해석례·최신법령을 수집(동기↔비동기 브리지)",
      how: "law 소스의 핵심입니다. korean-law MCP라는 원격 도구 서버에 Streamable HTTP로 접속해, 한 번의 세션 안에서 판례 검색·해석례 검색·(특정 법령명이 있으면) 최신 조문 조회·(폭넓은 질문이면) 종합검색을 순서대로 호출합니다. MCP 호출은 비동기인데 LangGraph 그래프는 동기로 돌기 때문에, run_law_search가 asyncio.run으로 둘 사이를 이어 줍니다(브리지). 개별 도구 호출은 내부에서 실패를 흡수하므로, 한 도구가 안 돼도 나머지 결과로 답을 만들 수 있습니다.",
      terms: ["MCP(Model Context Protocol)", "Streamable HTTP", "ClientSession", "asyncio.run", "동기/비동기(sync/async)", "세션(session)", "graceful degradation"],
      lines: [
        { at: "url = settings.build_law_mcp_url()", text: "MCP 서버 접속 URL(기본주소 + 인증키)을 구성합니다." },
        { at: "async with streamablehttp_client(url) as (read, write, _):", text: "Streamable HTTP 전송으로 원격 MCP 서버와의 통신 스트림을 엽니다." },
        { at: "await session.initialize()  # MCP 기능 교환", text: "MCP 세션을 초기화해 서버와 사용할 기능을 합의합니다(핸드셰이크)." },
        { at: "\"domain\": \"precedent\",", text: "판례(precedent) 도메인으로 search_decisions 도구를 호출합니다." },
        { at: "\"domain\": \"interpretation\",", text: "해석례(interpretation) 도메인으로 같은 도구를 한 번 더 호출합니다." },
        { at: "if law_name:", text: "질문에 특정 법령명이 있을 때만 최신 조문(get_law_text)을 추가로 조회합니다." },
        { at: "return asyncio.run(search_law_sources(law_query, law_name, use_chain_research))", text: "동기 그래프에서 비동기 MCP 검색을 실행하도록 asyncio.run으로 이어 줍니다(브리지)." },
      ],
      code: `# (일부 발췌)
async def search_law_sources(
    law_query: str,
    law_name: str = "",
    use_chain_research: bool = False,
) -> dict:
    """korean-law MCP에 한 세션으로 접속해 판례·해석례·(최신 법령)·(종합검색)을 수집함."""
    url = settings.build_law_mcp_url()
    collected = {"precedents": [], "interpretations": [], "laws": [], "law_texts": [], "chain_research": ""}

    # streamablehttp_client: (read, write, get_session_id) 스트림을 여는 Streamable HTTP 전송
    async with streamablehttp_client(url) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()  # MCP 기능 교환(capability negotiation)

            # 1) 판례 검색 (domain='precedent') — 선행기술·동향의 핵심 근거
            prec_text = await _call_tool(session, "search_decisions", {
                "domain": "precedent",
                "query": law_query,
                "display": settings.LAW_SEARCH_DISPLAY,
            })
            collected["precedents"] = parse_decisions(prec_text, "판례")

            # 2) 해석례 검색 (domain='interpretation') — 법령해석례(행정해석)
            interp_text = await _call_tool(session, "search_decisions", {
                "domain": "interpretation",
                "query": law_query,
                "display": settings.LAW_SEARCH_DISPLAY,
            })
            collected["interpretations"] = parse_decisions(interp_text, "해석례")

            # 3) 최신 법령 조문 — 특정 법령명이 드러난 질문에서만 조회
            if law_name:
                laws = parse_laws(await _call_tool(session, "search_law", {"query": law_name, "display": 5}))
                collected["laws"] = laws

    return collected


def run_law_search(law_query: str, law_name: str = "", use_chain_research: bool = False) -> dict:
    """동기 래퍼: 동기 LangGraph 노드에서 비동기 MCP 검색을 실행함 (asyncio.run으로 브리지)."""
    return asyncio.run(search_law_sources(law_query, law_name, use_chain_research))`,
    },
    {
      id: "parse_decisions",
      name: "parse_decisions()",
      fileId: "law",
      summary: "판례·해석례 검색 결과 텍스트를 정규식으로 파싱해 사건번호·선고일·링크 등 출처 메타데이터를 표준 항목으로 추출",
      how: "korean-law MCP 도구는 JSON이 아니라 '사람이 읽는 텍스트'를 돌려줍니다. 이 함수는 그 텍스트를 한 줄씩 훑으며 '[607079] 제목' 같은 항목 머리글과 그 아래 들여쓴 '키: 값' 메타데이터(사건번호·선고일·링크 등)를 정규식으로 뽑아냅니다. 도메인마다 날짜 필드명이 달라(선고일/회신일자/의결일) 우선순위로 탐색하고, 핵심 값만 표준 키(case_number·date·url·summary)로 승격합니다. 이렇게 코드가 직접 출처를 구성해 LLM의 인용 환각을 막습니다.",
      terms: ["정규식(regular expression)", "인용 환각 방지", "MCP(Model Context Protocol)", "마크다운(markdown)"],
      lines: [
        { at: "def parse_decisions(text: str, source_label: str) -> list[dict]:", text: "판례·해석례 텍스트를 표준 항목 리스트로 파싱하는 함수입니다." },
        { at: "header = _ITEM_HEADER.match(stripped)", text: "'[ID] 제목' 형태의 항목 머리글을 정규식으로 인식합니다." },
        { at: "# 새 항목 시작", text: "새 항목 머리글을 만나면 직전 항목을 확정해 리스트에 넣습니다." },
        { at: "field = _FIELD_LINE.match(line)", text: "'키: 값' 형태의 메타데이터 줄을 정규식으로 뽑아 현재 항목에 담습니다." },
        { at: "fields.get(\"선고일\")", text: "도메인마다 다른 날짜 필드명을 우선순위로 탐색합니다(선고일 우선)." },
        { at: "\"url\": _absolute_url(link) if link else \"\",", text: "상대경로 링크를 절대 URL로 바꿔 클릭 가능한 출처로 만듭니다." },
      ],
      code: `# (일부 발췌)
def parse_decisions(text: str, source_label: str) -> list[dict]:
    """판례/해석례 검색 결과 텍스트를 항목 리스트로 파싱함.

    각 항목은 '[ID] 제목' 머리글과 그 아래 들여쓴 '키: 값' 메타데이터로 구성됨.
    반환: [{id, title, source, case_number, date, url, raw}] (없는 필드는 빈 문자열)
    """
    items: list[dict] = []
    current: dict | None = None

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith(_SKIP_PREFIXES):
            continue

        header = _ITEM_HEADER.match(stripped)
        if header:
            # 새 항목 시작 — 직전 항목을 확정하고 새 dict를 만듦
            if current:
                items.append(current)
            current = {
                "id": header.group(1),
                "title": header.group(2).strip(),
                "source": source_label,
                "fields": {},
            }
            continue

        if current is not None:
            field = _FIELD_LINE.match(line)
            if field:
                current["fields"][field.group(1).strip()] = field.group(2).strip()

    if current:
        items.append(current)

    # 파싱된 fields에서 출처 구성에 필요한 핵심 값만 표준 키로 승격함
    normalized = []
    for item in items:
        fields = item["fields"]
        # 도메인마다 날짜 필드명이 달라(선고일/회신일자/의결일 등) 우선순위로 탐색함
        date = (
            fields.get("선고일")
            or fields.get("회신일자")
            or fields.get("의결일")
            or fields.get("결정일")
            or ""
        )
        link = fields.get("링크", "")
        normalized.append({
            "id": item["id"],
            "title": item["title"],
            "source": item["source"],
            "case_number": fields.get("사건번호", "") or fields.get("안건번호", ""),
            "court": fields.get("법원", ""),
            "date": date,
            "url": _absolute_url(link) if link else "",
            "summary": f"{item['title']} (사건번호 {fields.get('사건번호', 'N/A')}, 선고/회신일 {date or 'N/A'})",
        })
    return normalized`,
    },
    {
      id: "parse_laws",
      name: "parse_laws()",
      fileId: "law",
      summary: "법령 검색 결과 텍스트를 정규식으로 파싱해 법령명·법령ID·MST·공포일을 추출(최신 조문 조회의 입력)",
      how: "search_law 도구가 돌려준 텍스트에서 법령 목록을 뽑아냅니다. '1. 특허법' 같은 순번 머리글과 그 아래 '- 법령ID:', '- MST:', '- 공포일:' 메타데이터를 정규식으로 파싱합니다. 한 가지 함정 대비가 있는데, '- 키: 값' 라인을 머리글보다 먼저 검사합니다 — 그러지 않으면 머리글 정규식이 메타데이터 줄을 잘못 삼킬 수 있기 때문입니다. 여기서 뽑은 MST(법령일련번호)는 가장 정확히 매칭된 법령의 최신 조문 전문을 get_law_text로 가져오는 열쇠가 됩니다.",
      terms: ["정규식(regular expression)", "MCP(Model Context Protocol)", "MST(법령일련번호)"],
      lines: [
        { at: "def parse_laws(text: str) -> list[dict]:", text: "법령 검색 텍스트를 법령 목록으로 파싱하는 함수입니다." },
        { at: "field = _LAW_FIELD.match(line)  # '- 키: 값' 라인", text: "'- 키: 값' 메타데이터 줄을 머리글보다 먼저 검사합니다(혼동 방지)." },
        { at: "header = _LAW_HEADER.match(line)", text: "'1. 특허법' 형태의 법령명 머리글을 정규식으로 인식합니다." },
        { at: "\"law_id\": fields.get(\"법령ID\", \"\"),", text: "법령 고유 ID를 표준 키로 뽑습니다." },
        { at: "\"mst\": fields.get(\"MST\", \"\"),", text: "MST(법령일련번호) — 최신 조문 전문 조회의 열쇠를 뽑습니다." },
      ],
      code: `# (일부 발췌)
def parse_laws(text: str) -> list[dict]:
    """법령 검색(search_law) 결과 텍스트를 법령 리스트로 파싱함.

    각 항목은 '1. 특허법' 머리글과 '- 법령ID:', '- MST:', '- 공포일:', '- 구분:' 메타데이터로 구성됨.
    반환: [{name, law_id, mst, date, category}]
    """
    laws: list[dict] = []
    current: dict | None = None

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith(_SKIP_PREFIXES):
            continue

        field = _LAW_FIELD.match(line)  # '- 키: 값' 라인 (머리글보다 먼저 검사: 머리글 정규식과 혼동 방지)
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
            "name": law["name"],
            "law_id": fields.get("법령ID", ""),
            "mst": fields.get("MST", ""),
            "date": fields.get("공포일", ""),
            "category": fields.get("구분", ""),
        })
    return normalized`,
    },
    {
      id: "call_tool_helpers",
      name: "_call_tool() · _text_of() · _absolute_url()",
      fileId: "law",
      summary: "MCP 도구 호출(타임아웃·실패 흡수)·결과 텍스트 추출·상대링크 절대화 — 법령 소스의 저수준 보조 함수들",
      how: "law_client의 저수준 일꾼 3종입니다. _call_tool은 MCP 도구 하나를 타임아웃과 함께 호출하고, 어떤 원격 오류든 빈 문자열로 흡수해 한 도구가 실패해도 나머지로 진행하게 합니다(장애 격리). _text_of는 도구 결과(CallToolResult)에서 사람이 읽는 텍스트 블록만 골라 이어 붙입니다. _absolute_url은 MCP가 준 상대경로·HTML 엔티티가 섞인 링크를 html.unescape로 복원하고 법제처 기본 주소를 앞에 붙여 클릭 가능한 인용 URL로 만듭니다.",
      terms: ["MCP(Model Context Protocol)", "장애 격리(failure isolation)", "graceful degradation", "타임아웃(timeout)", "HTML 엔티티(HTML entity)"],
      lines: [
        { at: "async def _call_tool(session: ClientSession, name: str, args: dict) -> str:", text: "MCP 도구 하나를 호출하고 결과 텍스트를 반환하는 헬퍼입니다." },
        { at: "result = await asyncio.wait_for(", text: "asyncio.wait_for로 호출에 타임아웃을 걸어 무한 대기를 막습니다." },
        { at: "except Exception as error:  # noqa: BLE001 - 어떤 원격 오류든 빈 결과로 진행", text: "어떤 원격 오류든 빈 문자열로 흡수해 다른 도구·소스로 진행합니다." },
        { at: "def _text_of(call_result) -> str:", text: "도구 결과에서 사람이 읽는 텍스트 블록만 이어 붙이는 헬퍼입니다." },
        { at: "def _absolute_url(link: str) -> str:", text: "MCP가 준 상대 링크를 클릭 가능한 절대 URL로 바꾸는 헬퍼입니다." },
        { at: "link = html.unescape(link.strip())", text: "HTML 엔티티(&amp;→&)를 복원해 정상 URL로 만듭니다." },
      ],
      code: `# (일부 발췌)
def _text_of(call_result) -> str:
    """MCP 도구 호출 결과(CallToolResult)에서 사람이 읽는 텍스트만 이어 붙여 반환함."""
    chunks = []
    for block in getattr(call_result, "content", []) or []:
        text = getattr(block, "text", None)
        if text:
            chunks.append(text)
    return "\\n".join(chunks)


def _absolute_url(link: str) -> str:
    """MCP가 돌려준 링크를 절대 URL로 변환함.

    판례 링크는 '/DRF/lawService.do?...&amp;ID=...' 같은 상대경로 + HTML 엔티티 형태이므로,
    html.unescape로 &amp;→& 복원 후 법제처 기본 주소를 앞에 붙여 클릭 가능한 인용 URL을 만듦.
    """
    link = html.unescape(link.strip())
    if link.startswith("http"):
        return link
    if link.startswith("/"):
        return settings.LAW_GO_KR_BASE + link
    return link


async def _call_tool(session: ClientSession, name: str, args: dict) -> str:
    """MCP 도구를 호출하고 결과 텍스트를 반환함. 호출 실패는 빈 문자열로 graceful 처리함.

    한 소스(MCP)의 한 도구가 실패해도 나머지 도구·소스로 답변을 만들 수 있게 예외를 흡수함.
    """
    try:
        result = await asyncio.wait_for(
            session.call_tool(name, args),
            timeout=settings.LAW_MCP_TIMEOUT_SECONDS,
        )
        return _text_of(result)
    except Exception as error:  # noqa: BLE001 - 어떤 원격 오류든 빈 결과로 진행
        print(f"  ! [law MCP] {name} 호출 실패(무시하고 진행): {type(error).__name__}: {str(error)[:120]}")
        return ""`,
    },

    // ───────────────────────── sources/web_search.py ─────────────────────────
    {
      id: "search_web",
      name: "search_web()",
      fileId: "web",
      summary: "DuckDuckGo로 최근 1년 웹 문서를 검색해 출처 링크 포함 결과를 반환 — 실패는 빈 결과로 흡수",
      how: "web 소스입니다. API 키가 필요 없는 DuckDuckGo 래퍼로 최근 1년 한국어 결과를 검색합니다. .results()는 제목·요약·링크를 함께 주므로 출처 표기에 적합합니다. DuckDuckGo는 요청 제한(rate limit)이 잦으므로 실패하면 빈 리스트로 처리해 전체 흐름을 막지 않습니다(장애 격리). 결과 중 YouTube 페이지는 제외합니다 — 영상은 YouTube 소스가 전담하므로 출처를 분리합니다.",
      terms: ["DuckDuckGo", "rate limit(요청 제한)", "graceful degradation", "장애 격리(failure isolation)"],
      lines: [
        { at: "wrapper = DuckDuckGoSearchAPIWrapper(", text: "DuckDuckGo 검색 래퍼를 지역·기간·최대 결과 수 설정과 함께 만듭니다." },
        { at: "raw_results = wrapper.results(query, settings.WEB_MAX_RESULTS)", text: ".results()로 링크 포함 상세 결과 리스트를 받습니다(.run()은 텍스트만)." },
        { at: "except Exception as error:  # noqa: BLE001 - rate limit", text: "요청 제한·네트워크 오류를 빈 결과로 흡수해 전체 흐름을 막지 않습니다." },
        { at: "if \"youtube.com\" in link or \"youtu.be\" in link:", text: "웹 결과에 섞인 YouTube 링크는 제외합니다(영상은 YouTube 소스 전담)." },
        { at: "normalized.append({", text: "남은 결과를 제목·요약·링크 형태로 표준화해 모읍니다." },
      ],
      code: `def search_web(query: str) -> list[dict]:
    """DuckDuckGo로 최근 1년 웹 문서를 검색해 출처 링크 포함 결과를 반환함.

    time='y'로 최근 1년만 검색하므로 쿼리에는 연도·시간 표현을 넣지 않음(라우터에서 보장).
    DuckDuckGo는 RatelimitException이 잦으므로 실패 시 빈 리스트로 graceful 처리함.
    반환: [{"title", "snippet", "link"}]
    """
    wrapper = DuckDuckGoSearchAPIWrapper(
        region=settings.WEB_REGION,        # 한국어/한국 지역 결과 우선
        time=settings.WEB_TIME,            # 최근 1년 필터
        max_results=settings.WEB_MAX_RESULTS,
    )

    try:
        # results(query, max_results): 링크 포함 상세 결과 리스트 반환
        raw_results = wrapper.results(query, settings.WEB_MAX_RESULTS)
    except Exception as error:  # noqa: BLE001 - rate limit·네트워크 오류를 빈 결과로 흡수
        print(f"  ! [web] 검색 실패(무시하고 진행): {type(error).__name__}", file=sys.stderr)
        return []

    normalized = []
    for item in raw_results:
        link = item.get("link", "")
        # 웹 결과에 섞인 YouTube 페이지는 제외함 — 영상은 YouTube 소스가 전담함
        if "youtube.com" in link or "youtu.be" in link:
            continue
        normalized.append({
            "title": item.get("title", "제목 없음"),
            "snippet": item.get("snippet", ""),
            "link": link,
        })
    return normalized`,
    },

    // ───────────────────────── sources/youtube_search.py ─────────────────────────
    {
      id: "search_youtube",
      name: "search_youtube()",
      fileId: "youtube",
      summary: "YouTube 소스 진입점 — 영상 검색 + 자막 청크 선별을 함께 수행(검색 실패는 빈 결과로 흡수)",
      how: "youtube 소스의 진입점입니다. 먼저 YouTube Data API로 최근 1년 영상을 검색해 제목·채널·URL을 확보합니다(search_videos). 그다음 상위 영상의 자막을 120초 단위 청크로 로드하고, 질문과 각 자막 청크를 임베딩(의미를 숫자 벡터로 변환)해 코사인 유사도가 높은 핵심 구간만 골라냅니다. 각 청크엔 '몇 분부터 보면 되는지' 타임스탬프 URL을 붙입니다. 검색 자체가 실패(할당량 초과 등)하면 빈 결과로 흡수하고, 자막이 없는 영상은 건너뜁니다(graceful degradation).",
      terms: ["YouTube Data API", "임베딩(embedding)", "코사인 유사도(cosine similarity)", "자막 청크(transcript chunk)", "graceful degradation", "타임스탬프 URL"],
      lines: [
        { at: "videos = search_videos(query)", text: "YouTube Data API로 최근 1년 영상을 검색해 제목·채널·URL을 확보합니다." },
        { at: "except Exception as error:  # noqa: BLE001 - 할당량 초과", text: "검색이 실패하면(할당량 초과 등) 빈 결과로 흡수해 전체 흐름을 막지 않습니다." },
        { at: "return {\"videos\": [], \"chunks\": []}", text: "검색 실패 시 빈 영상·빈 청크를 돌려줘 다른 소스로 계속 진행하게 합니다." },
        { at: "chunks = _select_relevant_chunks(videos, query) if videos else []", text: "영상이 있으면 자막을 로드해 질의와 유사한 핵심 구간만 선별합니다." },
        { at: "return {\"videos\": videos, \"chunks\": chunks}", text: "영상 메타데이터와 선별된 자막 청크를 함께 돌려줍니다." },
      ],
      code: `def search_youtube(query: str) -> dict:
    """YouTube 소스 진입점: 영상 검색 + 자막 청크 선별을 함께 수행함.

    반환:
        {"videos": [영상 메타데이터...], "chunks": [관련 자막 청크...]}
        videos는 항상 채워지고(검색 성공 시), chunks는 자막이 있는 경우에만 채워짐.
    """
    try:
        videos = search_videos(query)
    except Exception as error:  # noqa: BLE001 - 할당량 초과·네트워크 오류는 빈 결과로 흡수
        print(f"  ! [youtube] 영상 검색 실패(무시하고 진행): {type(error).__name__}", file=sys.stderr)
        return {"videos": [], "chunks": []}

    chunks = _select_relevant_chunks(videos, query) if videos else []
    return {"videos": videos, "chunks": chunks}`,
    },

    // ───────────────────────── config/settings.py ─────────────────────────
    {
      id: "settings_consts",
      name: "주요 설정 상수 + build_law_mcp_url()",
      fileId: "settings",
      summary: "모델명·MCP 접속정보·검색 파라미터·Self-RAG 재시도 한계를 한곳에 모은 설정값들",
      how: "코드 곳곳에서 settings.XXX로 참조하는 값을 모두 이 파일 한곳에 모아 둡니다. LLM 모델·임베딩 모델·법령 MCP 주소·웹/YouTube 검색 범위·재시도 상한 같은 값을 바꾸려면 여기만 고치면 됩니다. build_law_mcp_url()은 MCP 접속 주소(기본주소+인증키)를 만들되, 인증키(LAW_OC)가 비어 있으면 실행 초기에 명확한 오류를 내 디버깅을 쉽게 합니다(빠른 실패).",
      terms: ["MCP(Model Context Protocol)", "Streamable HTTP", "text-embedding-3-small", "재시도(retry)", "빠른 실패(fail-fast)", "재현성"],
      lines: [
        { at: "LLM_MODEL = \"openai/gpt-oss-120b\"", text: "라우팅·평가·답변 생성을 모두 맡는 Groq LLM 모델명입니다." },
        { at: "LLM_TEMPERATURE = 0", text: "구조화 판단을 재현 가능하게 하려고 온도를 0으로 고정합니다." },
        { at: "LAW_MCP_BASE_URL = \"https://korean-law-mcp.fly.dev/mcp\"", text: "원격 법령 MCP 서버의 기본 엔드포인트(Streamable HTTP)입니다." },
        { at: "EMBEDDING_MODEL = \"text-embedding-3-small\"", text: "YouTube 자막 청크를 질의와 비교할 때 쓰는 임베딩 모델(1536차원)입니다." },
        { at: "MAX_RETRIES = 3", text: "[IsUse] 실패 시 질문을 다시 써 재검색하는 최대 횟수(무한 루프 방지)." },
        { at: "if not LAW_OC:", text: "인증키가 비어 있으면 실행 초기에 명확한 오류를 냅니다(빠른 실패)." },
      ],
      code: `# (일부 발췌) config/settings.py — MAS B 전역 설정

# Groq LPU에서 서빙하는 gpt-oss-120b — 라우팅·평가·답변 생성을 모두 담당함
LLM_MODEL = "openai/gpt-oss-120b"
# 라우팅·평가 등 구조화 판단을 재현 가능하게 하기 위해 온도 0으로 고정함
LLM_TEMPERATURE = 0
# YouTube 자막 청크를 질의와의 유사도로 선별할 때 쓰는 임베딩 모델 (1536차원)
EMBEDDING_MODEL = "text-embedding-3-small"

# korean-law MCP 원격 서버 기본 엔드포인트 (Streamable HTTP, /mcp 경로)
LAW_MCP_BASE_URL = "https://korean-law-mcp.fly.dev/mcp"

# Self-RAG 워크플로우 제어
MAX_RETRIES = 3        # [IsUse] 실패 시 Query Rewriting 재시도 최대 횟수
RECURSION_LIMIT = 50   # 재시도 루프가 LangGraph 기본 단계 한계에 걸리지 않도록 상향함


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
    "Self-RAG": "AI가 스스로 자기 답을 점검하는 RAG 방식. 검색한 자료가 충분한지·답변이 근거 있는지·유용한지를 LLM이 직접 평가(IsRel/IsSup/IsUse)하고, 부족하면 질문을 다시 써 재검색함.",
    "MCP(Model Context Protocol)": "AI가 외부 도구·데이터에 표준 방식으로 접속하게 해 주는 프로토콜. 여기선 원격 법령 서버(korean-law MCP)의 검색 도구를 호출함.",
    "Streamable HTTP": "MCP 서버에 HTTP로 접속해 스트림(흐름) 형태로 데이터를 주고받는 전송 방식. 원격 MCP 서버 연결에 사용함.",
    "ClientSession": "MCP 클라이언트가 서버와 한 번 연결해 도구를 호출하는 동안 유지하는 세션 객체(initialize·call_tool 제공).",
    "세션(session)": "서버에 한 번 접속해 작업을 마치고 닫을 때까지 유지되는 연결 단위. 여기선 한 번의 검색이 한 세션.",
    "LangGraph": "여러 처리 단계(노드)를 그래프로 연결해 LLM 워크플로(조건 분기·반복 포함)를 만드는 라이브러리.",
    "노드(node)": "LangGraph 그래프의 한 처리 단계. 상태를 입력받아 일부 칸만 갱신해 반환함.",
    "구조화 출력(structured output)": "LLM이 자유 문장 대신 정해진 스키마(JSON)의 칸을 채워 답하게 강제하는 것. 코드가 안정적으로 읽을 수 있음.",
    "Pydantic": "파이썬에서 데이터의 형태(타입·필드)를 클래스로 정의·검증하는 라이브러리. LLM의 구조화 출력 스키마로 씀.",
    "TypedDict": "딕셔너리의 각 키가 어떤 타입인지 미리 정의하는 파이썬 타입. 여기선 그래프 상태(AgentState)의 형태를 정의함.",
    "IsRel": "Self-RAG 토큰. 검색된 항목이 질문과 '관련 있는지(Relevant)'를 LLM이 평가하는 단계.",
    "IsSup": "Self-RAG 토큰. 생성된 답변이 검색 자료에 '근거하는지(Supported)' — 지어낸 말이 없는지 평가하는 단계.",
    "IsUse": "Self-RAG 토큰. 최종 답변이 사용자에게 '유용한지(Useful)'를 평가하는 단계. 미달이면 재검색.",
    "환각(hallucination)": "LLM이 자료에 없는 내용을 그럴듯하게 지어내는 현상. IsSup 평가와 코드 기반 출처로 막음.",
    "인용 환각 방지": "출처(링크·사건번호)를 LLM이 만들지 않고 코드가 직접 붙여, 인용을 지어내는 환각을 막는 기법.",
    "컨텍스트(context)": "LLM이 답을 만들 때 참고하도록 함께 넣어 주는 배경 자료. 여기선 걸러진 관련 항목들을 묶은 것.",
    "ChatPromptTemplate": "시스템·사용자 메시지에 변수를 끼워 프롬프트를 만드는 LangChain 템플릿.",
    "인덱스(index)": "목록에서 항목의 순번(0부터 시작). LLM이 어떤 항목을 평가했는지 가리키는 데 씀.",
    "장애 격리(failure isolation)": "한 부분이 실패해도 전체가 멈추지 않게 영향을 가두는 설계. 여기선 한 소스가 실패해도 나머지로 답변함.",
    "graceful degradation": "일부 기능이 안 돼도 빈 결과 등으로 우아하게 낮춰 전체 동작을 이어 가는 방식(점진적 성능 저하).",
    "try/except": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 처리하는 파이썬 예외 처리 구문.",
    "동기/비동기(sync/async)": "동기는 한 작업이 끝나야 다음으로 넘어가는 방식, 비동기는 기다리는 동안 다른 일을 할 수 있는 방식. MCP 호출은 비동기.",
    "asyncio.run": "비동기 함수를 새 이벤트 루프에서 실행해 결과를 받는 파이썬 함수. 동기 코드에서 비동기 호출을 잇는 다리 역할.",
    "DuckDuckGo": "API 키 없이 쓸 수 있는 검색 엔진. 여기선 최근 1년 뉴스·동향 웹 검색에 사용함.",
    "rate limit(요청 제한)": "짧은 시간에 너무 많이 요청하면 서버가 막는 제한. DuckDuckGo에서 자주 발생해 빈 결과로 흡수함.",
    "YouTube Data API": "YouTube 영상을 검색·조회하는 구글 공식 API. 제목·채널·URL 같은 메타데이터를 받음.",
    "자막 청크(transcript chunk)": "영상 자막을 일정 시간(여기선 120초) 단위로 자른 조각. 각 조각에 시작 시점이 붙음.",
    "임베딩(embedding)": "글의 의미를 숫자 목록(벡터)으로 바꾸는 것. 의미가 비슷하면 벡터도 가까움.",
    "코사인 유사도(cosine similarity)": "두 벡터가 가리키는 방향이 얼마나 비슷한지로 의미 유사도를 재는 척도(1에 가까울수록 유사).",
    "타임스탬프 URL": "영상의 특정 시점(&t=초)부터 재생되는 YouTube 링크. '몇 분부터 보면 되는지' 출처로 제공함.",
    "text-embedding-3-small": "OpenAI의 임베딩 모델 이름. 텍스트를 1536차원 벡터로 변환함.",
    "멀티턴(multi-turn)": "여러 번 주고받는 대화. 이전 대화 맥락을 기억해 후속 질문의 의도를 파악함.",
    "재시도(retry)": "일시적 오류가 났을 때 잠시 뒤 다시 시도하는 것. 여기선 LLM 일시 오류·유용성 미달 재검색에 적용.",
    "빠른 실패(fail-fast)": "설정·인증 오류를 실행 초기에 바로 드러내, 한참 돈 뒤 실패하는 낭비를 막는 방식.",
    "재현성": "같은 입력으로 다시 돌리면 같은 결과가 나오는 성질. 온도 0 고정 등으로 보장함.",
    "진입점(main)": "프로그램 실행이 시작되는 함수. 전체 흐름을 순서대로 호출함.",
    "Query Rewriting": "검색 결과가 부실할 때 질문을 더 검색 친화적인 표현으로 고쳐 다시 검색하는 것. Self-RAG에서 IsUse(유용성) 미달이면 수행함.",
    "json_schema": "LLM에게 정해진 JSON 구조를 강제하는 구조화 출력 방식(with_structured_output method='json_schema'). 자연어에서 JSON을 파싱하는 불안정성을 없앰.",
    "StateGraph": "LangGraph에서 공유 상태(State)를 기준으로 노드·엣지를 조립하는 그래프 빌더. compile하면 실행 가능한 그래프가 됨.",
    "지수 백오프(exponential backoff)": "재시도 간격을 1초→2초→4초처럼 점점 늘리는 재시도 전략. 일시적 오류·요청 제한에서 서버 부담을 줄이며 재시도함.",
    "환경변수(environment variable)": "운영체제나 .env 파일에 저장해 두고 코드가 읽어 쓰는 설정값(API 키·접속정보 등). 비밀값을 코드에 직접 박지 않게 함.",
    "마크다운(markdown)": "제목·목록·링크를 기호로 표현하는 경량 서식 문법(예: # 제목, - 목록, [텍스트](URL)). 답변·출처를 사람이 보기 좋게 정리하는 데 씀.",
    "조건부 엣지(conditional edge)": "상태(State) 값에 따라 다음에 갈 노드를 다르게 정하는 갈림길 엣지. 여기선 검색 경로 선택·재검색 여부를 가름.",
    "graph.invoke": "컴파일된 LangGraph 그래프를 시작 상태와 함께 처음부터 끝까지 한 번 실행하는 호출.",
    "정규식(regular expression)": "글자 패턴을 규칙으로 표현해 찾기·추출하는 도구. 여기선 판례 텍스트에서 사건번호·날짜·링크를 뽑는 데 씀.",
    "MST(법령일련번호)": "국가법령정보센터가 법령마다 부여하는 고유 일련번호(법령 마스터 ID). 특정 법령의 최신 조문을 정확히 조회할 때 사용함.",
    "타임아웃(timeout)": "응답을 기다리는 최대 시간. 그 안에 응답이 없으면 실패로 처리해 무한 대기를 막음.",
    "HTML 엔티티(HTML entity)": "&amp;·&lt; 처럼 특수문자를 안전하게 표현한 HTML 표기. 파싱할 때 원래 문자(&, <)로 되돌려 줌.",
  },
};
