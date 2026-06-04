window.EXPLAIN_DATA = {
  meta: { title: "특허 Agentic RAG — 로컬 LLM gemma3:12b", entry: "app.py" },
  files: [
    { id: "main", label: "app.py", role: "Agentic RAG 챗봇 전체 — LangGraph StateGraph + Ollama 로컬 LLM" }
  ],
  flow: [
    {
      step: 1, title: "실행 진입 · 자원 준비",
      label: "실행·자원 준비",
      refs: ["main_fn", "check_ollama", "build_llm", "load_vectorstore", "rag_init"],
      summary: "main()이 Ollama 서버·벡터 DB·LLM을 준비하고 그래프를 컴파일함",
      detail: "카페를 열기 전 커피 머신을 점검하듯, main()은 Ollama 서버 접속·모델 존재 여부·특허법 ChromaDB를 차례로 확인합니다. 모두 준비되면 AgenticRAG 그래프를 생성합니다."
    },
    {
      step: 2, title: "라우팅 (Route)",
      label: "라우팅",
      refs: ["route_node"],
      summary: "route() 노드: LLM이 특허 질문인지 판단하고 검색 소스·소스별 쿼리를 결정함",
      detail: "LLM이 라우터 역할로 질문을 분석합니다. '특허 요건이 뭐야?'→vectordb+web, '안녕'→직접 답변. 소스마다 검색 엔진 특성이 달라 vectordb/web/YouTube 쿼리를 각각 따로 최적화합니다."
    },
    {
      step: 3, title: "검색 (Retrieve)",
      label: "검색",
      refs: ["retrieve_node"],
      summary: "retrieve() 노드: 선택된 소스에서 검색 실행 (벡터DB·DuckDuckGo·scrapetube)",
      detail: "선택된 소스에서만 소스별 최적화 쿼리로 검색합니다. 벡터DB는 코사인 유사도, 웹은 DuckDuckGo 무료 API, YouTube는 scrapetube 스크래핑 + oembed 유효성 검증입니다. 한 소스가 실패해도 나머지로 답변을 만들 수 있습니다."
    },
    {
      step: 4, title: "관련성 평가 (IsRel)",
      label: "관련성 평가",
      refs: ["grade_docs"],
      summary: "grade_documents() 노드: 벡터DB 문서를 LLM이 일괄 평가해 관련 없는 문서를 제거함",
      detail: "코사인 유사도로 뽑은 문서가 반드시 '좋은' 문서는 아닙니다. LLM이 각 문서를 보고 '이 질문에 직접 도움이 되는가?'를 판단해 관련 문서만 선별합니다. 1회 LLM 호출로 전체를 일괄 평가합니다."
    },
    {
      step: 5, title: "답변 생성 + 근거성 검증 (IsSup)",
      label: "답변 생성·근거성",
      refs: ["generate_node"],
      summary: "generate() 노드: 컨텍스트로 답변을 생성하고 환각 여부를 검증함",
      detail: "법률+웹+영상 결과를 하나의 컨텍스트로 합쳐 LLM에 답변을 요청합니다. 생성 후 '답변이 컨텍스트에 근거하는가?'(IsSup)를 검증하고, 근거 부족이면 '컨텍스트만 사용'하는 엄격 모드로 재생성합니다."
    },
    {
      step: 6, title: "유용성 평가 (IsUse)",
      label: "유용성 평가",
      refs: ["grade_gen"],
      summary: "grade_generation() 노드: 최종 답변이 질문에 실제로 유용한지 평가함",
      detail: "마지막 품질 관문입니다. LLM이 '답변이 질문을 회피하지 않고 실질적으로 답하는가?'를 평가합니다. 유용하지 않고 재시도 횟수가 남으면 rewrite → route 루프로 돌아갑니다."
    },
    {
      step: 7, title: "쿼리 재작성 (Rewrite)",
      label: "쿼리 재작성",
      refs: ["rewrite_node"],
      summary: "rewrite() 노드: 모호한 표현을 정확한 특허 용어로 바꿔 질문을 재작성함",
      detail: "'왜 유용하지 않았는가?'를 분석해 질문을 다시 씁니다. 예) '특허 어떻게 해요?' → '특허 출원 등록 요건 신규성 진보성 절차'. 재작성된 질문으로 route 노드부터 다시 실행합니다. 최대 3회까지 반복합니다."
    },
    {
      step: 8, title: "결과 출력",
      label: "결과 출력",
      summary: "처리 요약(라우팅·검색·IsSup·IsUse)과 출처 포함 최종 답변을 콘솔에 출력함",
      detail: "어떤 소스에서 몇 건을 검색했는지, 근거성·유용성 평가 결과, 재작성 이력을 한눈에 보여주는 요약 박스와 함께 법령·웹 URL·YouTube URL 출처가 포함된 최종 답변을 출력합니다."
    }
  ],
  functions: [
    {
      id: "agent_state",
      name: "AgentState (상태 정의)",
      fileId: "main",
      summary: "그래프 노드 사이를 흐르는 공유 데이터 컨테이너",
      how: "TypedDict로 정의된 딕셔너리 구조체입니다. 각 노드가 이 딕셔너리의 일부 키만 갱신해 반환하면 LangGraph가 기존 상태에 자동 병합합니다. 질문·검색 결과·평가 결과·재시도 횟수 등 모든 중간 데이터가 여기에 담깁니다.",
      terms: ["TypedDict", "LangGraph"],
      lines: [
        { at: "question: str               # 현재 처리 중 질문", text: "현재 처리 중인 질문. Query Rewriting이 일어나면 재작성된 질문으로 갱신됩니다." },
        { at: "original_question: str      # 최초 사용자 질문", text: "처음 입력한 질문. 재작성이 여러 번 일어나도 이 값은 변하지 않아 최종 평가 기준이 됩니다." },
        { at: "needs_retrieval: bool       # 검색 필요 여부", text: "라우터가 '특허 질문이므로 검색이 필요하다'고 판단했으면 True, 인사·잡담이면 False." },
        { at: "retry_count: int            # 현재까지 Query Rewriting 재시도 횟수", text: "재시도 횟수 카운터. MAX_RETRIES(3)에 도달하면 현재 답변을 그대로 반환하고 종료합니다." },
        { at: "rewrites: list              # Query Rewriting 이력", text: "재작성 이력 목록. from(이전 질문)·to(새 질문)·reasoning(이유)을 담은 딕셔너리 리스트입니다." }
      ],
      code: `class AgentState(TypedDict):
    """그래프 전체에서 노드 사이로 공유·갱신되는 상태 데이터.

    각 노드는 이 딕셔너리의 일부 키만 갱신해 반환하면, LangGraph가 기존 상태에 병합함.
    """
    question: str               # 현재 처리 중 질문 (Query Rewriting 시 갱신됨)
    original_question: str      # 최초 사용자 질문 (유용성 평가·재작성의 기준)
    history: list               # 이전 대화 맥락 [{"role": ..., "content": ...}] (멀티턴)
    needs_retrieval: bool       # 검색 필요 여부 (라우터 판단)
    sources: list               # 선택된 검색 소스 ["vectordb", "web", "youtube"]
    vectordb_query: str         # 벡터DB 검색용 쿼리 (법률 용어 중심)
    web_query: str              # 웹 검색용 쿼리 (연도 제외)
    youtube_query: str          # YouTube 검색용 쿼리 (짧은 키워드)
    route_reasoning: str        # 라우팅 판단 근거
    vector_docs_raw: list       # 벡터DB 원본 검색 결과 (관련성 평가 전)
    vector_docs: list           # 관련성 평가를 통과한 특허법 문서
    web_results: list           # 웹 검색 결과 [{title, snippet, link}]
    youtube_results: list       # YouTube 검색 결과 [{title, channel, url, published}]
    answer: str                 # 출처 섹션이 포함된 최종 답변
    is_supported: Optional[bool]   # [IsSup] 근거성 평가 결과
    is_useful: Optional[bool]      # [IsUse] 유용성 평가 결과
    usefulness_reasoning: str   # 유용성 판단 근거
    retry_count: int            # 현재까지 Query Rewriting 재시도 횟수
    rewrites: list              # Query Rewriting 이력 [{from, to, reasoning}]`
    },
    {
      id: "check_ollama",
      name: "check_ollama()",
      fileId: "main",
      summary: "Ollama 서버가 실행 중이고 gemma3:12b 모델이 다운로드됐는지 사전 확인함",
      how: "Ollama REST API의 /api/tags 엔드포인트에 HTTP 요청을 보내 설치된 모델 목록을 받아옵니다. 서버가 꺼져 있거나 모델이 없으면 명확한 안내 메시지와 함께 프로그램을 바로 종료합니다. 이를 통해 '나중에 LLM 호출 시 뜨는 알 수 없는 오류'를 방지합니다.",
      terms: ["Ollama", "REST API", "urllib"],
      lines: [
        { at: "tags_url = f", text: "Ollama API에서 설치된 모델 목록을 가져오는 URL을 만듭니다. 기본값은 http://localhost:11434/api/tags." },
        { at: "urllib.request.urlopen(tags_url", text: "파이썬 내장 urllib로 Ollama API에 HTTP GET 요청을 보냅니다. timeout=5초 안에 응답이 없으면 예외가 발생합니다." },
        { at: "payload = json.loads(response.read()", text: "응답 본문(JSON 텍스트)을 파이썬 딕셔너리로 변환합니다." },
        { at: "model_names = [model.get", text: "응답에서 모델 이름 목록만 추출합니다. 예) ['gemma3:12b', 'llama3.2:3b']." },
        { at: "name.startswith(LLM_MODEL)", text: "모델명이 'gemma3:12b' 또는 'gemma3:12b-instruct' 형태일 수 있어 접두어로 비교합니다." }
      ],
      code: `def check_ollama() -> None:
    """Ollama 서버가 실행 중이고 gemma3:12b 모델이 준비됐는지 사전 확인함.

    서버 미실행·모델 미다운로드 상태로 LLM을 호출하면 불명확한 연결 오류가 나므로,
    /api/tags로 모델 목록을 받아 실행 초기에 명확한 안내 메시지를 띄움 (디버깅 편의).
    """
    tags_url = f"{OLLAMA_BASE_URL}/api/tags"
    try:
        with urllib.request.urlopen(tags_url, timeout=OEMBED_TIMEOUT) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as error:
        raise RuntimeError(
            f"Ollama 서버에 연결할 수 없음({OLLAMA_BASE_URL}). 'ollama serve'로 서버를 먼저 실행하세요. ({error})"
        )
    # 모델명은 'gemma3:12b' 또는 'gemma3:12b-...' 형태일 수 있어 접두 일치로 확인함
    model_names = [model.get("name", "") for model in payload.get("models", [])]
    if not any(name == LLM_MODEL or name.startswith(LLM_MODEL) for name in model_names):
        raise RuntimeError(
            f"로컬에 '{LLM_MODEL}' 모델이 없음. 'ollama pull {LLM_MODEL}'로 모델을 먼저 받으세요.\\n"
            f"  (현재 설치된 모델: {', '.join(model_names) or '없음'})"
        )`
    },
    {
      id: "build_llm",
      name: "build_llm()",
      fileId: "main",
      summary: "로컬 Ollama 런타임의 gemma3:12b 인스턴스를 생성함 (API 키 불필요)",
      how: "ChatOllama는 LangChain이 Ollama 서버와 통신하는 래퍼입니다. temperature=0으로 설정해 라우팅·평가 등 구조화 판단 결과가 매 실행마다 같도록(재현 가능) 합니다. 클라우드 LLM과 달리 API 키가 필요 없습니다.",
      terms: ["ChatOllama", "temperature"],
      lines: [
        { at: "return ChatOllama(model=LLM_MODEL", text: "Ollama 서버(기본: localhost:11434)에서 gemma3:12b 모델을 사용하는 채팅 LLM 인스턴스를 만듭니다." },
        { at: "temperature=0, base_url=OLLAMA_BASE_URL", text: "temperature=0이면 LLM이 항상 가장 확률이 높은 답을 선택합니다. 라우팅·평가처럼 '정해진 판단'이 필요한 곳에 씁니다." },
        { at: "base_url=OLLAMA_BASE_URL", text: "Ollama 서버 주소. 환경변수 OLLAMA_BASE_URL이 없으면 기본값 http://localhost:11434를 씁니다." }
      ],
      code: `def build_llm() -> ChatOllama:
    """로컬 Ollama 런타임의 gemma3:12b 모델 인스턴스를 생성함.

    temperature=0으로 고정해 라우팅·평가 등 구조화 판단을 재현 가능하게 함.
    ChatGroq(클라우드) 대비 API 키가 필요 없고 모든 추론을 로컬에서 수행함.
    """
    return ChatOllama(model=LLM_MODEL, temperature=0, base_url=OLLAMA_BASE_URL)`
    },
    {
      id: "load_vectorstore",
      name: "load_vectorstore()",
      fileId: "main",
      summary: "특허법 공용 ChromaDB를 OpenAI 임베딩과 함께 로드함 (검색 전용)",
      how: "인덱싱 시 사용한 것과 동일한 컬렉션명(patent_law)과 임베딩 모델(text-embedding-3-small)을 지정해야 질의 벡터와 저장 벡터의 차원·의미 공간이 일치해 검색이 동작합니다. LLM은 로컬로 바꿨지만 기존 벡터DB와의 호환을 위해 임베딩은 OpenAI를 그대로 사용합니다.",
      terms: ["ChromaDB", "Chroma", "임베딩", "코사인 유사도"],
      lines: [
        { at: "if not VECTORDB_DIR.exists():", text: "벡터DB 디렉터리가 없으면 인덱싱을 먼저 실행하라는 안내와 함께 오류를 냅니다." },
        { at: "embeddings = OpenAIEmbeddings", text: "질의를 1536차원 벡터로 변환하는 임베딩 모델입니다. 인덱싱 때 쓴 것과 동일해야 합니다." },
        { at: "return Chroma(", text: "영속 디렉터리(persist_directory)에 저장된 ChromaDB를 불러옵니다. 이미 인덱싱된 문서를 다시 임베딩하지 않고 그대로 씁니다." },
        { at: "collection_name=COLLECTION_NAME", text: "컬렉션명(patent_law)이 인덱싱과 다르면 빈 컬렉션을 가리켜 검색 결과가 0건이 됩니다." }
      ],
      code: `def load_vectorstore() -> Chroma:
    """특허법 공용 벡터 DB를 임베딩 없이 로드함 (검색 전용).

    인덱싱과 동일한 컬렉션명(patent_law)·임베딩 모델(text-embedding-3-small)을 지정해야
    질의 벡터와 저장 벡터의 차원·의미 공간이 일치하여 검색이 정상 동작함.
    LLM은 로컬로 바꿨지만 임베딩은 기존 벡터DB(1536차원)와 호환을 위해 OpenAI 모델을 그대로 사용함.
    """
    if not VECTORDB_DIR.exists():
        raise FileNotFoundError(
            f"특허법 벡터 DB를 찾을 수 없음: {VECTORDB_DIR}\\n"
            f"먼저 'hands-on/10.rag/indexing/indexing.py'를 실행하여 벡터 DB를 구축하세요."
        )
    # 질의를 1536차원 벡터로 변환 (OPENAI_API_KEY 환경변수 자동 사용)
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL, api_key=os.environ.get("OPENAI_API_KEY"))
    return Chroma(
        persist_directory=str(VECTORDB_DIR),
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
    )`
    },
    {
      id: "rag_init",
      name: "AgenticRAG.__init__()",
      fileId: "main",
      summary: "LLM·검색기·구조화 평가기를 준비하고 그래프를 컴파일함",
      how: "with_structured_output(method='json_schema')는 LLM 출력을 Pydantic 스키마(JSON)에 맞게 강제해 파싱 오류를 없앱니다. gemma3는 함수 호출(function calling)을 지원하지 않으므로 json_schema 방식을 사용합니다. 모든 준비가 끝나면 _build_graph()로 그래프를 미리 컴파일해 둡니다.",
      terms: ["with_structured_output", "json_schema", "Pydantic", "as_retriever"],
      lines: [
        { at: "self.retriever = vectorstore.as_retriever(", text: "ChromaDB를 LangChain 검색기 인터페이스로 변환합니다. similarity=코사인 유사도, k=5개 반환." },
        { at: "self.router = llm.with_structured_output(RouteDecision", text: "라우팅용 LLM. 출력을 RouteDecision Pydantic 스키마에 맞게 강제합니다." },
        { at: "self.relevance_grader = llm.with_structured_output(BatchRelevanceGrade", text: "관련성 평가(IsRel)용 LLM. 문서 목록을 한 번에 평가한 결과를 BatchRelevanceGrade 스키마로 받습니다." },
        { at: "self.support_grader = llm.with_structured_output(SupportGrade", text: "근거성 평가(IsSup)용 LLM. 답변이 컨텍스트에 근거하는지 SupportGrade 스키마로 판단합니다." },
        { at: "self.usefulness_grader = llm.with_structured_output(UsefulnessGrade", text: "유용성 평가(IsUse)용 LLM. 답변이 질문에 유용한지 UsefulnessGrade 스키마로 판단합니다." },
        { at: "self.query_rewriter = llm.with_structured_output(RewrittenQuery", text: "질문 재작성용 LLM. 개선된 질문을 RewrittenQuery 스키마로 받습니다." },
        { at: "self.graph = self._build_graph()", text: "노드·엣지를 연결한 그래프를 미리 컴파일합니다. 이후 invoke()로 실행합니다." }
      ],
      code: `def __init__(self, llm: ChatOllama, vectorstore: Chroma):
    self.llm = llm
    # 코사인 유사도 기반으로 가장 유사한 TOP_K개 문서를 반환하는 검색기
    self.retriever = vectorstore.as_retriever(
        search_type="similarity",
        search_kwargs={"k": TOP_K},
    )
    # with_structured_output(method="json_schema"): LLM 응답을 Pydantic 스키마(JSON)로 강제함.
    # Ollama 0.5+는 format에 JSON 스키마를 전달해 문법 제약으로 출력을 강제하는 구조화 출력을 지원함.
    # gemma3는 function-calling(도구 호출)을 지원하지 않으므로, 도구 이름이 없는 json_schema 방식을 사용함.
    self.router = llm.with_structured_output(RouteDecision, method="json_schema")
    self.relevance_grader = llm.with_structured_output(BatchRelevanceGrade, method="json_schema")
    self.support_grader = llm.with_structured_output(SupportGrade, method="json_schema")
    self.usefulness_grader = llm.with_structured_output(UsefulnessGrade, method="json_schema")
    self.query_rewriter = llm.with_structured_output(RewrittenQuery, method="json_schema")
    # 노드들을 연결한 실행 가능한 그래프를 미리 컴파일해 둠
    self.graph = self._build_graph()`
    },
    {
      id: "route_node",
      name: "route() 노드",
      fileId: "main",
      summary: "특허 질문인지 판단하고, 검색 소스와 소스별 최적 쿼리를 결정함",
      how: "프롬프트 템플릿에 이전 대화(history)와 현재 질문을 넣어 router LLM에게 검색 전략을 결정하게 합니다. 결과는 RouteDecision Pydantic 객체로 파싱되어 needs_retrieval·sources·세 가지 쿼리가 상태에 저장됩니다.",
      terms: ["ChatPromptTemplate", "RouteDecision", "Pydantic"],
      lines: [
        { at: "[Route] 검색 필요 여부 및 소스 판단 중", text: "이 줄이 콘솔에 출력되면 route 노드가 실행 중임을 알 수 있습니다." },
        { at: "decision: RouteDecision = (prompt | self.router).invoke({", text: "프롬프트와 router LLM을 파이프(|)로 연결해 실행합니다. 결과가 RouteDecision 객체로 반환됩니다." },
        { at: "sources = decision.sources if decision.needs_retrieval else []", text: "검색이 필요 없으면 소스를 빈 목록으로 만들어 direct_answer 경로로 흐르게 합니다." },
        { at: "\"route_reasoning\": decision.reasoning,", text: "라우팅 판단 근거를 상태에 저장합니다. 나중에 '왜 이 소스를 선택했는가'를 추적하는 데 씁니다." }
      ],
      code: `def route(self, state: AgentState) -> dict:
    """라우터 노드: 특허 질문인지·어떤 소스로 검색할지 판단하고 소스별 쿼리를 생성함."""
    print("\\n[Route] 검색 필요 여부 및 소스 판단 중...")
    prompt = ChatPromptTemplate.from_messages([
        ("system", """당신은 특허/지식재산권 전문 챗봇의 라우터입니다. 사용자 질문을 분석해 검색 전략을 결정하세요.

[검색 필요 = True] — 특허·실용신안·상표·디자인권 등 지식재산권 관련 질문
  사용 가능한 소스를 적절히 선택하세요 (복수 선택 가능):
  - vectordb : 특허법 조문·요건·절차 등 '법률 근거'가 필요할 때
  - web      : 비용·통계·최신 동향·사례 등 '최신 정보'가 필요할 때
  - youtube  : 강의·튜토리얼·시각적 설명 등 '영상'을 원할 때

[검색 불필요 = False] — 아래는 검색하지 않고 LLM 지식으로 직접 답변
  - 인사·잡담 (예: 안녕하세요)
  - 특허/지식재산권과 무관한 주제
# ...(검색 방식별 질의어 최적화 규칙 및 예시 이하 생략)
"""),
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
        "vectordb_query": decision.vectordb_query,
        "web_query": decision.web_query,
        "youtube_query": decision.youtube_query,
        "route_reasoning": decision.reasoning,
    }`
    },
    {
      id: "retrieve_node",
      name: "retrieve() 노드",
      fileId: "main",
      summary: "라우터가 선택한 소스에서만, 소스별 최적화 쿼리로 검색을 수행함",
      how: "각 소스(vectordb·web·YouTube)는 독립적으로 실행되며, try/except로 감싸져 있어 한 소스가 실패해도 나머지 소스로 답변을 생성할 수 있습니다(graceful degradation). vectordb는 소스별 쿼리(vectordb_query), 웹은 web_query, YouTube는 youtube_query로 각각 따로 검색합니다.",
      terms: ["graceful degradation", "DuckDuckGo", "scrapetube", "oembed"],
      lines: [
        { at: "sources = state[\"sources\"]", text: "route 노드가 선택한 소스 목록을 가져옵니다. 예) ['vectordb', 'web']." },
        { at: "if \"vectordb\" in sources:", text: "라우터가 vectordb를 선택했을 때만 벡터DB 검색을 실행합니다." },
        { at: "vector_docs_raw = self.retriever.invoke(vector_query)", text: "ChromaDB에서 코사인 유사도로 상위 TOP_K(5)개 특허법 문서를 가져옵니다." },
        { at: "if \"web\" in sources:", text: "웹 소스가 선택됐을 때 DuckDuckGo로 최근 1년 웹 결과를 검색합니다." },
        { at: "if \"youtube\" in sources:", text: "YouTube 소스가 선택됐을 때 scrapetube로 영상을 검색하고 oembed로 유효성을 확인합니다." }
      ],
      code: `def retrieve(self, state: AgentState) -> dict:
    """검색 노드: 라우터가 선택한 소스에서만, 소스별 최적화된 쿼리로 검색을 수행함.

    외부 검색(웹·YouTube) 호출은 각각 try/except로 감싸 한 소스가 실패해도 나머지 소스로
    답변을 생성할 수 있게 함 (graceful degradation).
    """
    sources = state["sources"]
    vector_docs_raw, web_results, youtube_results = [], [], []

    # 특허법 벡터DB 검색 (법률 용어 중심 vectordb_query 사용, 없으면 현재 질문으로 대체)
    if "vectordb" in sources:
        vector_query = state["vectordb_query"] or state["question"]
        print(f"\\n[Retrieve:벡터DB] 특허법 문서 검색 중... (쿼리: '{vector_query}')")
        vector_docs_raw = self.retriever.invoke(vector_query)
        print(f"  → {len(vector_docs_raw)}개 문서 검색됨")

    # 웹 검색 (DuckDuckGo, 연도 제외 쿼리)
    if "web" in sources:
        print(f"\\n[Retrieve:웹] DuckDuckGo 검색 중... (쿼리: '{state['web_query']}')")
        try:
            web_results = search_web(state["web_query"] or state["question"])
            print(f"  → {len(web_results)}개 결과")
        except Exception as error:
            print(f"  ! 웹 검색 실패(무시하고 진행): {error}")

    # YouTube 검색 (scrapetube + 유효성 검증, 짧은 키워드 쿼리)
    if "youtube" in sources:
        print(f"\\n[Retrieve:YouTube] scrapetube 검색 중... (쿼리: '{state['youtube_query']}')")
        try:
            youtube_results = search_youtube(state["youtube_query"] or state["question"])
            print(f"  → 유효한 영상 {len(youtube_results)}개")
        except Exception as error:
            print(f"  ! YouTube 검색 실패(무시하고 진행): {error}")

    return {
        "vector_docs_raw": vector_docs_raw,
        "web_results": web_results,
        "youtube_results": youtube_results,
    }`
    },
    {
      id: "grade_docs",
      name: "grade_documents() [IsRel]",
      fileId: "main",
      summary: "벡터DB 검색 문서의 관련성을 LLM으로 일괄 평가해 관련 문서만 선별함",
      how: "문서 N개를 한 번에 LLM에게 보여주고 '각 문서가 질문과 관련 있는가?'를 인덱스별로 평가받습니다(1회 LLM 호출). 웹·YouTube는 키워드 검색이라 별도 평가 없이 그대로 사용합니다.",
      terms: ["BatchRelevanceGrade", "관련성 평가"],
      lines: [
        { at: "if not docs:", text: "벡터DB 검색 결과가 없으면(빈 리스트) 평가를 건너뛰고 빈 결과를 반환합니다." },
        { at: "[IsRel] 벡터DB 문서 관련성 일괄 평가 중", text: "IsRel 단계가 시작됐음을 알리는 로그입니다." },
        { at: "batch: BatchRelevanceGrade =", text: "LLM이 문서 전체를 한 번에 평가한 결과를 BatchRelevanceGrade 객체로 받습니다." },
        { at: "0 <= grade.document_index < len(docs) and grade.is_relevant", text: "인덱스가 유효한 범위인지 확인하고, 관련 있다고 판단된 문서만 추려냅니다." }
      ],
      code: `def grade_documents(self, state: AgentState) -> dict:
    """[IsRel] 노드: 벡터DB 검색 문서의 관련성을 1회 LLM 호출로 일괄 평가해 선별함.

    웹·YouTube 결과는 검색 자체가 키워드 기반이므로 별도 관련성 평가 없이 그대로 사용함.
    """
    docs = state["vector_docs_raw"]
    if not docs:
        return {"vector_docs": []}

    print("\\n[IsRel] 벡터DB 문서 관련성 일괄 평가 중...")
    docs_text = "\\n\\n".join(f"[문서 {i}]\\n{doc.page_content}" for i, doc in enumerate(docs))
    prompt = ChatPromptTemplate.from_messages([
        ("system", """당신은 검색된 특허법 문서들이 질문과 관련 있는지 평가하는 전문가입니다.

문서가 질문에 답하는 데 직접 도움이 되는 정보를 포함하면 관련 있음(True)으로 판단합니다.
부분적·간접적으로만 관련되면 관련 없음(False)으로 판단합니다.
입력된 각 문서를 그 인덱스(document_index)와 함께 개별적으로 평가하여 모두 반환하세요."""),
        ("human", "질문: {question}\\n\\n검색된 문서들:\\n{documents}\\n\\n각 문서의 관련성을 평가해 주세요."),
    ])
    batch: BatchRelevanceGrade = (prompt | self.relevance_grader).invoke({
        "question": state["question"],
        "documents": docs_text,
    })
    relevant_docs = []
    for grade in batch.results:
        # 구조화 출력이 잘못된 인덱스를 줄 수 있으므로 범위를 검사해 안전하게 매핑함
        if 0 <= grade.document_index < len(docs) and grade.is_relevant:
            relevant_docs.append(docs[grade.document_index])
    print(f"  → 관련 문서 {len(relevant_docs)}/{len(docs)}개 선별")
    return {"vector_docs": relevant_docs}`
    },
    {
      id: "generate_node",
      name: "generate() [IsSup]",
      fileId: "main",
      summary: "검색 컨텍스트로 답변을 생성하고, 환각(hallucination)이 없는지 검증함",
      how: "벡터DB·웹·YouTube 결과를 하나의 컨텍스트 문자열로 합쳐 LLM에 답변을 요청합니다. 생성 후 IsSup 평가로 '답변이 컨텍스트에 근거하는가?'를 확인하고, 근거가 부족하면 strict=True 모드(컨텍스트만 사용)로 재생성합니다. 마지막에 출처 섹션을 코드로 직접 구성해 URL 누락을 방지합니다.",
      terms: ["IsSup", "hallucination", "StrOutputParser"],
      lines: [
        { at: "context = build_context(state)", text: "벡터DB·웹·YouTube 결과를 하나의 긴 문자열로 합칩니다. LLM은 이 문자열을 보고 답변을 만듭니다." },
        { at: "answer = self._generate_answer(state, context, strict=False)", text: "먼저 '컨텍스트 우선, 그러나 LLM 지식도 활용 가능'인 일반 모드로 답변을 생성합니다." },
        { at: "[IsSup] 답변 근거성 평가 중", text: "근거성(IsSup) 평가 단계. 컨텍스트가 있을 때만 실행합니다." },
        { at: "answer = self._generate_answer(state, context, strict=True)", text: "근거가 부족하면 '컨텍스트에 있는 정보만 사용'하는 엄격 모드로 재생성합니다." },
        { at: "sources_section = build_sources_section(state)", text: "법령 조항·웹 URL·YouTube URL을 코드로 직접 구성합니다. LLM에 맡기면 URL을 빠뜨릴 수 있습니다." }
      ],
      code: `def generate(self, state: AgentState) -> dict:
    """생성 노드: 검색 컨텍스트로 답변을 생성하고, 근거성([IsSup])이 부족하면 엄격 재생성 후 출처를 부착함."""
    context = build_context(state)
    has_context = bool(state["vector_docs"] or state["web_results"] or state["youtube_results"])

    print("\\n[Generate] 검색 결과 기반 답변 생성 중...")
    answer = self._generate_answer(state, context, strict=False)

    is_supported: Optional[bool] = None
    # 검색 컨텍스트가 있을 때만 근거성([IsSup])을 검증함 (없으면 LLM 지식 답변이라 평가 불가)
    if has_context:
        print("\\n[IsSup] 답변 근거성 평가 중...")
        support: SupportGrade = self._grade_support(answer, context)
        is_supported = support.is_supported
        print(f"  → 근거 있음: {support.is_supported} ({support.reasoning})")
        if not support.is_supported:
            print("\\n[Generate] 근거 부족 → 엄격 근거 기반으로 답변 재생성 중...")
            answer = self._generate_answer(state, context, strict=True)

    # 출처 섹션을 코드에서 직접 구성해 URL 누락을 방지함 (MUST)
    sources_section = build_sources_section(state)
    full_answer = f"{answer}\\n\\n{sources_section}".strip() if sources_section else answer
    return {"answer": full_answer, "is_supported": is_supported}`
    },
    {
      id: "grade_gen",
      name: "grade_generation() [IsUse]",
      fileId: "main",
      summary: "최종 답변이 사용자 질문에 실제로 유용한지 LLM이 평가함 (재검색 루프 분기 기준)",
      how: "usefulness_grader LLM이 최초 질문(original_question)과 현재 답변을 보고 '실질적으로 도움이 되는가?'를 판단합니다. 이 결과가 재검색 루프의 분기 기준이 됩니다.",
      terms: ["IsUse", "UsefulnessGrade"],
      lines: [
        { at: "[IsUse] 답변 유용성 평가 중", text: "IsUse 평가 단계 시작 로그입니다." },
        { at: "grade: UsefulnessGrade = (prompt | self.usefulness_grader).invoke({", text: "유용성 평가 LLM을 실행합니다. 결과는 is_useful(bool)과 reasoning(이유)을 담은 객체입니다." },
        { at: "\"question\": state[\"original_question\"],", text: "재작성된 질문이 아니라 원래 질문(original_question)으로 유용성을 평가합니다. 원래 의도를 기준으로 삼습니다." },
        { at: "return {\"is_useful\": grade.is_useful", text: "평가 결과를 상태에 저장합니다. 이후 decide_after_generation()이 이 값을 보고 종료 또는 재작성을 결정합니다." }
      ],
      code: `def grade_generation(self, state: AgentState) -> dict:
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
    return {"is_useful": grade.is_useful, "usefulness_reasoning": grade.reasoning}`
    },
    {
      id: "rewrite_node",
      name: "rewrite() 노드",
      fileId: "main",
      summary: "유용성 미달 시 더 나은 검색을 위해 질문을 재작성하고 재시도 횟수를 늘림",
      how: "실패한 답변과 실패 이유를 query_rewriter LLM에게 보여주고, 모호한 표현을 구체적인 특허 용어로 바꿔 재작성된 질문을 받습니다. 재작성된 질문은 state['question']에 저장되고 route 노드로 돌아가 재검색이 시작됩니다.",
      terms: ["Query Rewriting", "RewrittenQuery"],
      lines: [
        { at: "[Query Rewriting] 유용성 미달 → 질문 재작성 중", text: "재작성 단계 시작 로그. 유용성 평가에서 False가 나온 경우에만 이 줄이 출력됩니다." },
        { at: "rewritten: RewrittenQuery =", text: "query_rewriter LLM이 개선된 질문(rewritten_query)과 재작성 이유(reasoning)를 RewrittenQuery 객체로 반환합니다." },
        { at: "\"question\": rewritten.rewritten_query,", text: "state['question']을 재작성된 질문으로 교체합니다. 이후 route 노드는 이 새 질문으로 다시 라우팅합니다." },
        { at: "\"retry_count\": state[\"retry_count\"] + 1,", text: "재시도 횟수를 1 올립니다. MAX_RETRIES(3)에 도달하면 decide_after_generation()이 루프를 종료합니다." }
      ],
      code: `def rewrite(self, state: AgentState) -> dict:
    """Query Rewriting 노드: 유용성 미달 시 더 나은 검색을 위해 질문을 재작성하고 재시도 횟수를 늘림."""
    print("\\n[Query Rewriting] 유용성 미달 → 질문 재작성 중...")
    prompt = ChatPromptTemplate.from_messages([
        ("system", """당신은 검색 쿼리를 최적화하는 전문가입니다.

원래 질문으로 시도했으나 유용한 답변을 생성하지 못했습니다. 더 나은 검색을 위해 질문을 다시 작성하세요.

## 재작성 전략
1. 모호한 표현을 구체적인 특허 용어로 변환
2. 구어체를 문어체/전문 용어로 변환
3. 특허/지식재산권 관련 정확한 핵심 키워드를 명확히 포함

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
    }`
    },
    {
      id: "build_graph",
      name: "_build_graph()",
      fileId: "main",
      summary: "노드·엣지를 연결해 실행 가능한 StateGraph로 컴파일함",
      how: "StateGraph에 노드를 등록하고 엣지(일반·조건부)로 연결합니다. 조건부 엣지는 함수의 반환값(문자열)에 따라 다음 노드를 결정합니다. compile()을 호출해야 invoke()로 실행할 수 있는 그래프가 됩니다.",
      terms: ["StateGraph", "START", "END", "add_conditional_edges"],
      lines: [
        { at: "workflow = StateGraph(AgentState)", text: "AgentState 스키마를 기반으로 빈 그래프를 만듭니다." },
        { at: "workflow.add_edge(START, \"route\")", text: "실행이 시작되면(START) 항상 route 노드로 먼저 이동합니다." },
        { at: "self.decide_search_path,", text: "route 이후 조건부 분기 함수. 'retrieve' 또는 'direct'를 반환해 다음 노드를 결정합니다." },
        { at: "workflow.add_edge(\"retrieve\", \"grade_documents\")", text: "검색(retrieve) 다음은 항상 관련성 평가(grade_documents)로 이동합니다." },
        { at: "workflow.add_edge(\"rewrite\", \"route\")", text: "재작성(rewrite) 후 route로 돌아가 새 질문으로 검색을 다시 시작합니다. 이것이 재검색 루프입니다." },
        { at: "return workflow.compile()", text: "연결된 그래프를 실행 가능한 형태로 컴파일합니다. 이후 .invoke()로 실행합니다." }
      ],
      code: `def _build_graph(self):
    """노드와 엣지를 연결해 실행 가능한 StateGraph로 컴파일함."""
    workflow = StateGraph(AgentState)        # 상태 스키마(AgentState) 기반 그래프 생성
    # 노드 등록 (이름 → 실행 함수)
    workflow.add_node("route", self.route)
    workflow.add_node("retrieve", self.retrieve)
    workflow.add_node("grade_documents", self.grade_documents)
    workflow.add_node("generate", self.generate)
    workflow.add_node("grade_generation", self.grade_generation)
    workflow.add_node("rewrite", self.rewrite)
    workflow.add_node("direct_answer", self.direct_answer)

    # 엣지 연결
    workflow.add_edge(START, "route")        # 시작 → route
    workflow.add_conditional_edges(          # route 후 검색 필요 여부로 분기
        "route",
        self.decide_search_path,
        {"retrieve": "retrieve", "direct": "direct_answer"},
    )
    workflow.add_edge("retrieve", "grade_documents")     # 검색 → 관련성 평가
    workflow.add_edge("grade_documents", "generate")     # 관련성 평가 → 답변 생성
    workflow.add_edge("generate", "grade_generation")    # 답변 생성 → 유용성 평가
    workflow.add_conditional_edges(          # 유용성 평가 후 재검색/종료 분기
        "grade_generation",
        self.decide_after_generation,
        {"rewrite": "rewrite", "end": END},
    )
    workflow.add_edge("rewrite", "route")    # 재작성 → route로 돌아가 재검색 (루프)
    workflow.add_edge("direct_answer", END)  # 직접 답변 → 종료
    return workflow.compile()                # 실행 가능한 앱으로 컴파일`
    },
    {
      id: "main_fn",
      name: "main()",
      fileId: "main",
      summary: "Ollama·벡터 DB·그래프를 준비하고 모드(데모/대화형)에 따라 실행함",
      how: "check_ollama()로 Ollama 서버를 먼저 확인하고, load_vectorstore()→build_llm()→AgenticRAG()로 모든 자원을 준비합니다. --demo 인자가 있으면 비대화형 데모를, 없으면 대화형 챗봇(chat())을 실행합니다.",
      terms: ["if __name__ == '__main__'", "sys.argv"],
      lines: [
        { at: "check_ollama()", text: "Ollama 서버와 모델이 준비됐는지 먼저 확인합니다. 실패하면 명확한 안내 메시지로 종료합니다." },
        { at: "vectorstore = load_vectorstore()", text: "특허법 ChromaDB를 메모리에 올립니다." },
        { at: "agent = AgenticRAG(llm, vectorstore)", text: "LLM과 벡터 스토어를 넘겨 Agentic RAG 그래프를 생성합니다." },
        { at: "if \"--demo\" in sys.argv[1:]:", text: "터미널에서 'python app.py --demo'로 실행했으면 데모 모드, 그냥 'python app.py'이면 대화형 챗봇 모드로 분기합니다." },
        { at: "run_demo(agent)", text: "미리 정의된 검증 질의 2건을 순서대로 실행해 전체 흐름을 확인합니다." }
      ],
      code: `def main() -> None:
    """Ollama·벡터 DB·Agentic RAG 그래프를 준비하고, 모드(데모/대화형)에 따라 실행함."""
    print("\\n" + "=" * 60)
    print("특허/지식재산권 Agentic RAG 예제 (LangGraph + 로컬 LLM gemma3:12b)")
    print("=" * 60)
    try:
        # Ollama 서버·모델 사전 점검 (미실행/미다운로드 시 명확한 안내로 조기 종료)
        check_ollama()
        print(f"Ollama 연결 확인: {OLLAMA_BASE_URL} (모델 {LLM_MODEL})")
        vectorstore = load_vectorstore()
        print(f"벡터 DB 로드 완료: {VECTORDB_DIR} (컬렉션 {COLLECTION_NAME}, "
              f"{vectorstore._collection.count()}개 청크)")
        llm = build_llm()
        agent = AgenticRAG(llm, vectorstore)

        # 명령행 인자에 --demo가 있으면 비대화형 데모, 없으면 대화형 챗봇으로 동작함
        if "--demo" in sys.argv[1:]:
            run_demo(agent)
        else:
            chat(agent)
    except (FileNotFoundError, RuntimeError) as error:
        print(f"\\n[오류] {error}", file=sys.stderr)
        sys.exit(1)


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()`
    }
  ],
  glossary: {
    "TypedDict": "파이썬의 딕셔너리(key-value 저장소)에 타입 정보를 붙인 구조체. LangGraph 상태 정의에 사용됩니다.",
    "LangGraph": "LLM 기반 워크플로우를 노드(처리 단계)와 엣지(연결)로 표현하는 오케스트레이션 프레임워크. 루프와 분기를 포함한 복잡한 흐름을 구성할 수 있습니다.",
    "Ollama": "LLM(대형 언어 모델)을 로컬 컴퓨터에서 실행할 수 있는 런타임. `ollama serve`로 서버를 띄우고 `ollama pull 모델명`으로 모델을 받습니다.",
    "ChatOllama": "LangChain이 Ollama 서버와 대화하기 위한 래퍼. `llm.invoke(프롬프트)`로 로컬 LLM을 호출합니다.",
    "temperature": "LLM 출력의 '창의성' 수준. 0이면 항상 가장 확률 높은 답을 선택(재현 가능), 1에 가까울수록 다양한 답을 냄. 라우팅·평가에는 0을 씁니다.",
    "ChromaDB": "벡터(숫자 배열)를 저장하고 유사도로 검색하는 데이터베이스. 텍스트를 임베딩 벡터로 변환해 저장하면 '의미적으로 비슷한' 문서를 빠르게 찾을 수 있습니다.",
    "Chroma": "LangChain에서 ChromaDB를 다루는 래퍼 클래스.",
    "임베딩": "텍스트를 수백~수천 개의 숫자 배열(벡터)로 변환하는 것. 의미가 비슷한 문장은 비슷한 벡터를 가집니다.",
    "코사인 유사도": "두 벡터가 얼마나 같은 방향을 가리키는지 측정한 값(0~1). 1에 가까울수록 의미가 비슷합니다.",
    "with_structured_output": "LLM 출력을 특정 Pydantic 스키마(JSON 구조)에 맞게 강제하는 LangChain 메서드. 파싱 오류를 방지합니다.",
    "json_schema": "with_structured_output의 방식 중 하나. LLM에게 JSON Schema를 전달해 출력을 구조화합니다. function_calling을 지원하지 않는 모델(gemma3 등)에 사용합니다.",
    "Pydantic": "파이썬 데이터 유효성 검증 라이브러리. BaseModel을 상속해 필드·타입·설명을 정의하면 LLM 구조화 출력의 스키마로 사용할 수 있습니다.",
    "as_retriever": "ChromaDB 벡터 스토어를 LangChain 검색기(Retriever) 인터페이스로 변환하는 메서드. `.invoke(질의)`를 호출하면 유사한 문서를 반환합니다.",
    "ChatPromptTemplate": "system(역할 지정)·human(사용자 입력)·ai(AI 응답) 메시지 구조로 LLM 프롬프트를 만드는 LangChain 클래스.",
    "StateGraph": "LangGraph의 핵심 클래스. 상태 스키마(TypedDict)를 기반으로 노드와 엣지를 연결해 워크플로우를 정의합니다.",
    "START": "LangGraph 그래프의 가상 시작 지점. `add_edge(START, '노드명')`으로 첫 번째 실행 노드를 지정합니다.",
    "END": "LangGraph 그래프의 가상 종료 지점. `add_edge('노드명', END)`으로 이 노드 실행 후 그래프를 종료합니다.",
    "add_conditional_edges": "LangGraph 메서드. 함수의 반환값(문자열)에 따라 다음 노드를 선택하는 분기 엣지를 추가합니다.",
    "DuckDuckGo": "무료로 사용할 수 있는 검색 엔진. API 키 없이 웹 검색 결과를 가져올 수 있어 예제에서 웹 검색 소스로 사용합니다.",
    "scrapetube": "YouTube 검색 결과 페이지를 스크래핑해 영상 메타데이터를 가져오는 파이썬 라이브러리. YouTube Data API와 달리 API 키가 필요 없습니다.",
    "oembed": "YouTube 등이 제공하는 공개 API. 영상 URL을 전달하면 영상이 유효(공개·재생 가능)한지 200/404로 알려줍니다. API 키가 필요 없습니다.",
    "graceful degradation": "'우아한 저하'. 일부 기능이 실패해도 나머지 기능으로 서비스를 계속하는 설계 방식. 웹 검색이 실패해도 벡터DB 결과만으로 답변을 생성합니다.",
    "IsSup": "(Is Supported) 생성된 답변이 검색 컨텍스트에 근거하는지(환각이 없는지) 검증하는 단계. Self-RAG의 핵심 자기 성찰 요소입니다.",
    "IsUse": "(Is Useful) 생성된 답변이 사용자 질문에 실제로 유용한지 평가하는 단계. 유용하지 않으면 질문을 재작성해 다시 검색합니다.",
    "Query Rewriting": "유용하지 않은 답변이 나왔을 때 모호한 질문을 정확한 전문 용어로 다시 작성하는 기법. 더 좋은 검색 결과를 위해 수행합니다.",
    "StrOutputParser": "LangChain 파서. LLM 응답에서 본문 텍스트만 추출합니다. `chain | StrOutputParser()`로 체인 끝에 붙입니다.",
    "urllib": "파이썬 내장 HTTP 라이브러리. 외부 라이브러리 없이 HTTP 요청을 보낼 수 있습니다.",
    "REST API": "HTTP 프로토콜로 데이터를 주고받는 서버 인터페이스. GET/POST 등의 방식으로 요청하고 JSON으로 응답받는 것이 일반적입니다.",
    "if __name__ == '__main__'": "이 파일을 직접 실행(`python app.py`)할 때만 아래 코드를 실행하라는 파이썬 관용구. 다른 파일에서 import할 때는 실행되지 않습니다.",
    "sys.argv": "터미널에서 파이썬 프로그램을 실행할 때 전달한 인자 목록. `python app.py --demo`이면 sys.argv = ['app.py', '--demo'].",
    "RouteDecision": "라우터 노드의 결과를 담는 Pydantic 스키마. needs_retrieval(검색 여부)·sources(소스 목록)·세 가지 최적화 쿼리·reasoning(판단 근거)를 포함합니다.",
    "BatchRelevanceGrade": "IsRel 평가 결과를 담는 Pydantic 스키마. 여러 문서의 관련성 평가를 한 번에 받기 위해 RelevanceGrade 리스트를 담습니다.",
    "관련성 평가": "검색된 문서가 질문과 실제로 관련 있는지 LLM이 판단하는 단계(IsRel). 코사인 유사도만으로는 무관한 문서가 섞일 수 있어 추가로 평가합니다.",
    "hallucination": "환각. LLM이 근거 없이 사실처럼 보이는 내용을 생성하는 현상. IsSup 단계에서 답변이 컨텍스트에 근거하는지 검증해 환각을 방지합니다.",
    "UsefulnessGrade": "IsUse 평가 결과를 담는 Pydantic 스키마. is_useful(유용 여부)과 reasoning(판단 이유)을 포함합니다.",
    "RewrittenQuery": "Query Rewriting 결과를 담는 Pydantic 스키마. rewritten_query(재작성된 질문)과 reasoning(재작성 이유)을 포함합니다."
  }
};
