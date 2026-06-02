window.EXPLAIN_DATA = {
  meta: { title: "LangChain + Neo4j GraphRAG 검색 파이프라인", entry: "app.py" },
  files: [
    { id: "app",       label: "app.py",                        role: "Streamlit 채팅 UI 진입점 — 질문 수신·처리·화면 렌더링 오케스트레이터" },
    { id: "settings",  label: "config/settings.py",            role: "Neo4j·Groq·Ollama 연결 정보와 Top-K·차원 등 전역 설정 관리" },
    { id: "graph",     label: "graph/neo4j_connection.py",     role: "Neo4j 연결(최대 3회 재시도)·스키마·통계·벡터 차원 검증" },
    { id: "router",    label: "query/router.py",               role: "질문 패턴 점수 → Auto 모드 시 vector/graph_qa/hybrid/cypher 결정" },
    { id: "condenser", label: "query/question_condenser.py",   role: "대화 이력 기반 타원형 후속 질문을 독립 질문으로 LLM 재작성" },
    { id: "engine",    label: "query/query_engine.py",         role: "4가지 검색 모드(Vector·Graph QA·Hybrid·Cypher Direct) 실행 엔진" },
    { id: "ui",        label: "ui/components.py",              role: "검색 결과·Neo4j 상태·KG 통계를 Streamlit UI로 렌더링" }
  ],
  flow: [
    {
      step: 1,
      title: "서비스 초기화",
      summary: "Settings·Neo4jConnection·QueryEngine·QueryRouter를 앱 시작 시 1회만 생성",
      detail: "@st.cache_resource로 감싸서 Streamlit이 페이지를 재실행할 때마다 Neo4j 연결을 새로 만들지 않습니다. Neo4jConnection은 연결 실패 시 최대 3회 재시도해서 Docker 컨테이너 기동 지연을 흡수합니다."
    },
    {
      step: 2,
      title: "질문 재작성(선택)",
      summary: "대화 이력이 있으면 후속 질문을 독립 질문으로 변환",
      detail: "\"그건 몇 개야?\" 같은 타원형 질문을 그대로 임베딩하면 벡터 검색 정확도가 크게 떨어집니다. condense_question()이 최근 6턴 이력을 LLM에 보내 완전한 문장으로 재작성합니다. Cypher Direct 모드는 Cypher를 그대로 전달하므로 재작성을 건너뜁니다."
    },
    {
      step: 3,
      title: "모드 라우팅",
      summary: "수동 선택이면 그대로, Auto면 패턴 점수 → LLM 폴백으로 검색 모드 결정",
      detail: "QueryRouter가 정규식 키워드 점수를 먼저 계산합니다. 최고 점수가 2 이상이고 2위를 명확히 앞서면 패턴 결과를 사용하고, 애매하면 LLM Few-shot 분류를 호출합니다. Cypher 문법으로 시작하는 입력(MATCH, RETURN 등)은 즉시 cypher 모드로 단락합니다."
    },
    {
      step: 4,
      title: "Neo4j 검색",
      summary: "결정된 모드에 따라 Vector·Graph QA·Hybrid·Cypher Direct 중 하나 실행",
      detail: "Vector는 Ollama qwen3-embedding으로 질문을 벡터화해 entity_embedding·doc_embedding 인덱스에서 유사 노드를 찾습니다. Graph QA는 GraphCypherQAChain이 자연어 질문을 Cypher로 변환해 실행합니다. Hybrid는 벡터로 시드 엔티티를 찾은 뒤 1-hop 그래프 관계까지 확장합니다. Cypher Direct는 읽기 전용 검증 후 사용자 쿼리를 그대로 실행합니다."
    },
    {
      step: 5,
      title: "답변 생성",
      summary: "검색 컨텍스트를 Groq LLM에 전달해 한국어 답변 생성",
      detail: "RESPONSE_PROMPT가 검색 결과를 컨텍스트로 넣고 Groq LPU LLM을 호출합니다. 최근 4턴의 대화 이력을 HumanMessage·AIMessage로 변환해 함께 전달해 다중 턴 대화를 지원합니다."
    },
    {
      step: 6,
      title: "결과 렌더링",
      summary: "답변·Cypher·출처·벡터 히트·그래프 관계를 Streamlit UI에 표시",
      detail: "display_result()가 모드·라우팅 이유를 캡션으로 보여주고, 답변 아래 접이식 영역(expander)에 Cypher·출처·벡터 점수·그래프 관계를 정리합니다. 교육생이 어떤 근거로 답변이 만들어졌는지 직접 확인할 수 있습니다."
    }
  ],
  functions: [
    {
      id: "fn_settings",
      name: "Settings",
      fileId: "settings",
      summary: "Neo4j·Groq·Ollama 연결 정보와 검색 파라미터를 한 곳에서 관리하는 설정 클래스",
      how: "@dataclass가 __init__을 자동 생성합니다. __post_init__에서 hands-on/.env와 retrieve/.env를 순서대로 읽어 API 키·URI 등을 주입합니다. 모든 경로는 __file__ 위치 기준으로 자동 계산됩니다.",
      terms: ["dataclass", "dotenv", "pathlib", "Neo4j", "Groq LPU", "Ollama"],
      lines: [
        { at: "neo4j_uri: str = \"bolt://localhost:7687\"", text: "Neo4j의 기본 접속 주소입니다. bolt://는 Neo4j 전용 바이너리 프로토콜로 HTTP보다 빠릅니다. 환경변수 NEO4J_URI가 있으면 덮어씁니다." },
        { at: "embedding_dim: int = 4096", text: "qwen3-embedding 모델이 반환하는 벡터 차원 수입니다. Neo4j 벡터 인덱스와 반드시 일치해야 검색이 가능합니다." },
        { at: "entity_top_k: int = 4", text: "엔티티 벡터 인덱스에서 가져올 상위 결과 수입니다. 값이 클수록 컨텍스트가 풍부하지만 LLM 토큰이 많이 소비됩니다." },
        { at: "if self.hands_on_env.exists():", text: "hands-on/.env 파일이 있을 때만 로드합니다. 파일이 없어도 오류 없이 기본값으로 동작합니다." },
        { at: "load_dotenv(self.local_env, override=True)", text: "retrieve/.env가 있으면 hands-on/.env보다 우선 적용합니다. 개발자가 로컬에서 다른 모델이나 URI를 테스트할 때 사용합니다." }
      ],
      code: `@dataclass
class Settings:
    """검색 파이프라인 전역 설정."""

    retrieve_dir: Path = field(default_factory=lambda: _RETRIEVE_DIR)
    neo4j_root: Path = field(default_factory=lambda: _NEO4J_ROOT)
    workspace_root: Path = field(default_factory=lambda: _WORKSPACE_ROOT)
    store_dir: Path = field(default_factory=lambda: _NEO4J_ROOT / "store" / "neo4j")
    hands_on_env: Path = field(default_factory=lambda: _HANDS_ON_DIR / ".env")
    local_env: Path = field(default_factory=lambda: _RETRIEVE_DIR / ".env")
    log_dir: Path = field(default_factory=lambda: _RETRIEVE_DIR / "logs")

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "password"

    ollama_base_url: str = "http://localhost:11434"
    embedding_model: str = "qwen3-embedding"
    embedding_dim: int = 4096

    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model: str = "openai/gpt-oss-120b"
    groq_timeout: int = 60
    groq_max_retries: int = 1
    groq_max_tokens: int = 2048
    groq_reasoning_effort: str = "low"

    entity_index_name: str = "entity_embedding"
    doc_index_name: str = "doc_embedding"
    entity_top_k: int = 4
    doc_top_k: int = 4
    hybrid_seed_top_k: int = 5
    hybrid_graph_limit: int = 25
    cypher_top_k: int = 20

    entity_labels: tuple[str, ...] = (
        "Concept", "Technology", "Framework", "Library", "Model", "Tool", "Task",
    )
    relationship_types: tuple[str, ...] = (
        "USES", "DEPENDS_ON", "IMPLEMENTS", "CONTAINS", "COMPARES", "EXTENDS", "PROVIDES",
        "MENTIONS",
    )

    def __post_init__(self) -> None:
        """공용 \`.env\`와 검색 전용 \`.env\`를 로드하고 환경변수로 기본값 오버라이드."""
        if self.hands_on_env.exists():
            load_dotenv(self.hands_on_env)
        if self.local_env.exists():
            load_dotenv(self.local_env, override=True)

        self.neo4j_uri = os.getenv("NEO4J_URI", self.neo4j_uri)
        self.neo4j_user = os.getenv("NEO4J_USER", self.neo4j_user)
        self.neo4j_password = os.getenv("NEO4J_PASSWORD", self.neo4j_password)
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", self.ollama_base_url)
        self.embedding_model = os.getenv("EMBEDDING_MODEL", self.embedding_model)
        self.groq_api_key = os.getenv("GROQ_API_KEY", self.groq_api_key)
        self.groq_base_url = os.getenv("GROQ_BASE_URL", self.groq_base_url)
        self.groq_model = os.getenv("GROQ_MODEL", self.groq_model)
        self.groq_timeout = _env_int("GROQ_TIMEOUT", self.groq_timeout)
        self.groq_max_retries = _env_int("GROQ_MAX_RETRIES", self.groq_max_retries)
        self.groq_max_tokens = _env_int("GROQ_MAX_TOKENS", self.groq_max_tokens)
        self.groq_reasoning_effort = os.getenv("GROQ_REASONING_EFFORT", self.groq_reasoning_effort)
        self.entity_top_k = _env_int("ENTITY_TOP_K", self.entity_top_k)
        self.doc_top_k = _env_int("DOC_TOP_K", self.doc_top_k)
        self.hybrid_seed_top_k = _env_int("HYBRID_SEED_TOP_K", self.hybrid_seed_top_k)
        self.hybrid_graph_limit = _env_int("HYBRID_GRAPH_LIMIT", self.hybrid_graph_limit)
        self.cypher_top_k = _env_int("CYPHER_TOP_K", self.cypher_top_k)

        self.log_dir.mkdir(exist_ok=True)

    @property
    def retrieve_log_file(self) -> Path:
        """검색 로그 파일 경로 반환 — 실행마다 새 파일 생성."""
        return self.log_dir / f"retrievelog_{_LOG_TIMESTAMP}.log"`
    },
    {
      id: "fn_connect_with_retry",
      name: "Neo4jConnection._connect_with_retry()",
      fileId: "graph",
      summary: "Neo4j 그래프 DB에 연결합니다. 연결 실패 시 지수 대기(1초→2초→4초)로 최대 3회 재시도",
      how: "Docker로 Neo4j를 띄울 때 컨테이너가 완전히 준비되기 전에 앱이 먼저 연결을 시도하면 실패할 수 있습니다. 재시도 간격을 2의 거듭제곱(exponential backoff)으로 늘려 안정적으로 연결될 때까지 기다립니다.",
      terms: ["Neo4j", "Neo4jGraph", "exponential_backoff"],
      lines: [
        { at: "for attempt in range(max_retries):", text: "0, 1, 2 순서로 총 3번 시도합니다. attempt 값으로 현재 몇 번째 시도인지 알 수 있습니다." },
        { at: "sanitize=True,", text: "Neo4j 노드 속성 중 파이썬 예약어와 충돌하는 이름을 자동으로 안전한 이름으로 바꿉니다. 충돌로 인한 파싱 오류를 방지합니다." },
        { at: "wait_seconds = 2 ** attempt", text: "실패할수록 대기 시간을 1초→2초→4초로 늘립니다. 서버가 준비되는 시간을 주기 위함입니다." },
        { at: "if attempt == max_retries - 1:", text: "마지막 시도(attempt=2)에서도 실패하면 예외를 다시 던져 앱 초기화를 중단시킵니다." }
      ],
      code: `    def _connect_with_retry(self, max_retries: int = 3) -> Neo4jGraph:
        """Neo4j 연결을 최대 3회 재시도."""
        for attempt in range(max_retries):
            try:
                graph = Neo4jGraph(
                    url=self.settings.neo4j_uri,
                    username=self.settings.neo4j_user,
                    password=self.settings.neo4j_password,
                    sanitize=True,
                )
                logger.info("Neo4j 연결 성공: %s", self.settings.neo4j_uri)
                return graph
            except Exception as exc:
                wait_seconds = 2 ** attempt
                logger.warning(
                    "Neo4j 연결 실패 (시도 %d/%d), %d초 후 재시도: %s",
                    attempt + 1,
                    max_retries,
                    wait_seconds,
                    exc,
                )
                if attempt == max_retries - 1:
                    logger.error("Neo4j 연결 최종 실패")
                    raise
                time.sleep(wait_seconds)
        raise RuntimeError("Neo4j 연결 재시도 실패")`
    },
    {
      id: "fn_get_stats",
      name: "Neo4jConnection.get_stats()",
      fileId: "graph",
      summary: "Neo4j 그래프 DB의 노드·관계·엔티티·Chunk 전체 현황을 Cypher로 조회",
      how: "Cypher MATCH 쿼리를 4개 실행해 노드 수·관계 수·엔티티 수·청크 수를 수집합니다. 사이드바 'KG 통계' 버튼을 누르면 이 메서드 결과가 Streamlit에 표시됩니다.",
      terms: ["Neo4j", "Cypher", "Knowledge Graph"],
      lines: [
        { at: "node_count = self.graph.query(\"MATCH (n) RETURN count(n) AS count\")[0][\"count\"]", text: "그래프 안의 모든 노드 수를 Cypher로 셉니다. [0][\"count\"]는 결과 첫 행의 count 컬럼 값을 꺼냅니다." },
        { at: "\"UNWIND labels(n) AS label \"", text: "노드 하나에 여러 라벨이 붙을 수 있어서, UNWIND로 라벨 목록을 행으로 펼친 뒤 라벨별로 집계합니다." },
        { at: "\"WHERE any(label IN labels(n) WHERE label IN $labels) \"", text: "Concept·Technology·Framework 등 엔티티 라벨을 가진 노드만 세는 조건입니다. Chunk·Document 같은 비엔티티 노드는 제외합니다." }
      ],
      code: `    def get_stats(self) -> dict[str, Any]:
        """노드·관계·라벨·관계 타입 통계 반환."""
        node_count = self.graph.query("MATCH (n) RETURN count(n) AS count")[0]["count"]
        relationship_count = self.graph.query("MATCH ()-[r]->() RETURN count(r) AS count")[0]["count"]
        node_labels = self.graph.query(
            "MATCH (n) "
            "UNWIND labels(n) AS label "
            "WITH label, count(*) AS count "
            "RETURN label, count "
            "ORDER BY count DESC"
        )
        relationship_types = self.graph.query(
            "MATCH ()-[r]->() "
            "WITH type(r) AS type, count(r) AS count "
            "RETURN type, count "
            "ORDER BY count DESC"
        )
        entity_count = self.graph.query(
            "MATCH (n) "
            "WHERE any(label IN labels(n) WHERE label IN $labels) "
            "RETURN count(n) AS count",
            params={"labels": list(self.settings.entity_labels)},
        )[0]["count"]
        chunk_count = self.graph.query("MATCH (n:Chunk) RETURN count(n) AS count")[0]["count"]
        return {
            "node_count": node_count,
            "relationship_count": relationship_count,
            "entity_count": entity_count,
            "chunk_count": chunk_count,
            "node_labels": node_labels,
            "relationship_types": relationship_types,
        }`
    },
    {
      id: "fn_validate_vector_dimensions",
      name: "Neo4jConnection.validate_vector_dimensions()",
      fileId: "graph",
      summary: "entity_embedding·doc_embedding 벡터 인덱스의 차원이 설정값(4096)과 일치하는지 사전 검증",
      how: "인덱스 차원과 임베딩 차원이 다르면 벡터 검색 쿼리가 오류를 냅니다. 검색 전 이 메서드로 미리 확인해 원인을 명확히 알 수 있습니다.",
      terms: ["Neo4j", "Vector", "Embedding"],
      lines: [
        { at: "dimensions = self.get_vector_dimensions()", text: "SHOW INDEXES 쿼리로 Neo4j의 각 벡터 인덱스 차원 수를 가져옵니다." },
        { at: "for index_name in [self.settings.entity_index_name, self.settings.doc_index_name]:", text: "entity_embedding과 doc_embedding 두 인덱스를 모두 검사합니다." },
        { at: "elif actual != self.settings.embedding_dim:", text: "Neo4j 인덱스 차원이 설정(4096)과 다르면 경고 메시지를 목록에 추가합니다. 인덱싱 때 다른 모델을 썼을 가능성이 높습니다." }
      ],
      code: `    def validate_vector_dimensions(self) -> list[str]:
        """벡터 인덱스 차원이 설정 임베딩 차원과 일치하는지 확인."""
        warnings: list[str] = []
        dimensions = self.get_vector_dimensions()
        for index_name in [self.settings.entity_index_name, self.settings.doc_index_name]:
            actual = dimensions.get(index_name)
            if actual is None:
                warnings.append(f"{index_name} 인덱스 차원 확인 실패")
            elif actual != self.settings.embedding_dim:
                warnings.append(
                    f"{index_name} 차원 불일치: Neo4j={actual}, 설정={self.settings.embedding_dim}"
                )
        return warnings`
    },
    {
      id: "fn_route",
      name: "QueryRouter.route()",
      fileId: "router",
      summary: "사용자가 수동으로 모드를 선택했으면 그대로 사용하고, Auto면 패턴 점수 → LLM 순으로 검색 모드를 결정",
      how: "먼저 Cypher 문법인지 감지하고, 아니면 정규식 키워드 점수를 계산합니다. 1위 점수가 충분히 높으면 바로 결정하고, 애매하면 LLM Few-shot 분류를 호출합니다.",
      terms: ["Router", "Cypher", "LLM_fallback"],
      lines: [
        { at: "if manual_mode != \"auto\":", text: "사용자가 사이드바에서 'Vector Search' 등을 직접 선택했으면 패턴 분석 없이 바로 해당 모드를 반환합니다." },
        { at: "if self._looks_like_cypher(query):", text: "MATCH나 RETURN으로 시작하는 입력은 Cypher 쿼리로 즉시 판단합니다. 점수 계산을 건너뛰어 빠릅니다." },
        { at: "if best_score >= 2 and best_score > second_score:", text: "1위 점수가 2점 이상이고 2위와 차이가 있으면 패턴 결과를 신뢰합니다. 점수 차이가 없으면 LLM에게 넘깁니다." }
      ],
      code: `    def route(self, query: str, selected_mode: str = "Auto") -> RouteDecision:
        """수동 선택 또는 Auto 규칙에 따라 검색 모드 결정."""
        manual_mode = self.MANUAL_MODE_MAP.get(selected_mode, selected_mode).lower()
        if manual_mode != "auto":
            return RouteDecision(manual_mode, "사용자 수동 선택", {})

        if self._looks_like_cypher(query):
            return RouteDecision("cypher", "Cypher 직접 입력 패턴 감지", {"cypher": 3})

        scores = self._score_patterns(query)
        best_mode, best_score = max(scores.items(), key=lambda item: item[1])
        sorted_scores = sorted(scores.values(), reverse=True)
        second_score = sorted_scores[1] if len(sorted_scores) > 1 else 0

        if best_score >= 2 and best_score > second_score:
            reason = f"패턴 매칭 확신도 높음 ({best_mode}={best_score})"
            logger.info("라우터 패턴 선택: %s, scores=%s", best_mode, scores)
            return RouteDecision(best_mode, reason, scores)

        llm_mode = self._llm_fallback(query)
        reason = f"패턴 확신도 낮음 → LLM Few-shot 분류 ({llm_mode})"
        return RouteDecision(llm_mode, reason, scores)`
    },
    {
      id: "fn_score_patterns",
      name: "QueryRouter._score_patterns()",
      fileId: "router",
      summary: "질문에 키워드가 몇 개 포함됐는지 모드별로 점수를 매겨 가장 적합한 검색 모드를 추천",
      how: "MODE_PATTERNS 딕셔너리에 모드별 키워드 목록이 정의돼 있습니다. 정규식으로 질문과 매칭해 일치한 키워드 수를 점수로 씁니다.",
      terms: ["Router"],
      lines: [
        { at: "normalized = query.lower()", text: "대소문자 구분 없이 매칭하기 위해 질문을 소문자로 변환합니다." },
        { at: "scores[mode] = sum(1 for pattern in patterns if re.search(pattern, normalized))", text: "각 키워드 패턴이 질문에 있으면 1점씩 더합니다. '관계', '연결'이 모두 있으면 graph_qa가 2점을 얻습니다." }
      ],
      code: `    def _score_patterns(self, query: str) -> dict[str, int]:
        """모드별 정규식 패턴 매칭 점수 계산."""
        normalized = query.lower()
        scores: dict[str, int] = {}
        for mode, patterns in self.MODE_PATTERNS.items():
            scores[mode] = sum(1 for pattern in patterns if re.search(pattern, normalized))
        return scores`
    },
    {
      id: "fn_llm_fallback",
      name: "QueryRouter._llm_fallback()",
      fileId: "router",
      summary: "패턴 점수로 모드를 확신할 수 없을 때 Groq LLM에게 Few-shot 분류를 요청해 최종 모드 결정",
      how: "LLM_CLASSIFY_PROMPT에 예시(vector/graph_qa/hybrid/cypher 각 1개)를 넣어 모델에게 단어 하나만 반환하도록 요청합니다. LLM 호출이 실패하면 가장 범용적인 vector로 폴백합니다.",
      terms: ["LLM_fallback", "Groq LPU"],
      lines: [
        { at: "response = self.llm.invoke(self.LLM_CLASSIFY_PROMPT.format(query=query))", text: "Few-shot 예시가 포함된 프롬프트에 사용자 질문을 넣어 LLM에게 모드 분류를 요청합니다." },
        { at: "for mode in (\"vector\", \"graph_qa\", \"hybrid\", \"cypher\"):", text: "LLM이 반환한 텍스트에 알려진 모드 이름이 포함돼 있는지 차례로 확인합니다. 첫 번째로 발견된 모드를 사용합니다." },
        { at: "logger.warning(\"라우터 LLM 분류 실패, vector 폴백: %s\", exc)", text: "LLM 호출 오류가 나도 앱이 중단되지 않고 가장 안전한 vector 모드로 계속 동작합니다." }
      ],
      code: `    def _llm_fallback(self, query: str) -> str:
        """패턴 분류가 애매할 때 LLM Few-shot 분류 수행."""
        try:
            response = self.llm.invoke(self.LLM_CLASSIFY_PROMPT.format(query=query))
            content = response.content.strip().lower()
            for mode in ("vector", "graph_qa", "hybrid", "cypher"):
                if mode in content:
                    logger.info("라우터 LLM 선택: %s", mode)
                    return mode
        except Exception as exc:
            logger.warning("라우터 LLM 분류 실패, vector 폴백: %s", exc)
        return "vector"`
    },
    {
      id: "fn_condense_question",
      name: "condense_question()",
      fileId: "condenser",
      summary: "대화 이력이 2턴 이상 쌓였을 때 후속 질문을 이전 대화 없이도 이해할 수 있는 독립 질문으로 LLM 재작성",
      how: "\"그럼 그건 몇 개야?\" 같은 타원형 질문은 벡터 임베딩이 부정확해집니다. 최근 6턴 이력을 요약해 LLM에게 완전한 질문으로 바꾸도록 요청하고, 실패하면 원본을 그대로 씁니다.",
      terms: ["condense", "Groq LPU"],
      lines: [
        { at: "if not history or len(history) < 2:", text: "대화 첫 턴이거나 이력이 없으면 재작성이 필요 없으므로 질문을 그대로 반환합니다." },
        { at: "for m in history[-6:]", text: "너무 오래된 대화는 관련성이 낮으므로 최근 6턴만 가져옵니다. 토큰 사용량도 줄입니다." },
        { at: "max_completion_tokens=256,", text: "재작성된 질문은 짧아야 하므로 최대 256토큰으로 제한합니다. 긴 답변이 나오면 낭비입니다." },
        { at: "condensed = response.content.strip()", text: "LLM이 반환한 재작성 질문의 앞뒤 공백을 제거합니다. 빈 문자열이면 원본을 사용합니다." }
      ],
      code: `def condense_question(
    question: str,
    history: list[dict[str, str]] | None,
    settings: Settings,
) -> str:
    """대화 이력이 있을 때 후속 질문을 독립 질문으로 재작성.

    retrieval 단계에서 타원형 후속 질문("그럼 그건 몇 개야?")이 잘못 임베딩되는 문제를
    LLM 재작성으로 수정함. 실패 시 원본 질문을 그대로 반환해 서비스를 유지함.
    """
    if not history or len(history) < 2:
        return question
    history_text = "\\n".join(
        f"{'사용자' if m['role'] == 'user' else '어시스턴트'}: {m['content'][:300]}"
        for m in history[-6:]
    )
    try:
        llm = ChatOpenAI(
            model=settings.groq_model,
            base_url=settings.groq_base_url,
            api_key=settings.groq_api_key,
            temperature=0,
            timeout=settings.groq_timeout,
            max_retries=1,
            max_completion_tokens=256,
        )
        response = llm.invoke([
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": f"대화 이력:\\n{history_text}\\n\\n후속 질문: {question}"},
        ])
        condensed = response.content.strip()
        if condensed:
            logger.info("질문 재작성: '%s' → '%s'", question, condensed)
            return condensed
    except Exception as exc:
        logger.warning("질문 재작성 실패, 원본 사용: %s", exc)
    return question`
    },
    {
      id: "fn_vector_search",
      name: "QueryEngine.vector_search()",
      fileId: "engine",
      summary: "질문을 벡터로 변환해 Neo4j의 entity_embedding·doc_embedding 인덱스에서 유사 항목을 검색하고 LLM 답변 생성",
      how: "두 개의 벡터 인덱스를 동시에 조회합니다. 엔티티 인덱스에서 관련 개념을 찾고, 문서 청크 인덱스에서 원문 근거를 찾습니다. 청크는 앞뒤 이웃 청크까지 확장해 문맥 연속성을 보장합니다.",
      terms: ["Vector", "Embedding", "Neo4j", "Knowledge Graph"],
      lines: [
        { at: "query_embedding = self._embed_query(question)", text: "Ollama qwen3-embedding으로 질문을 4096차원 벡터로 변환합니다. Neo4j 인덱스와 같은 모델·차원을 써야 유사도 계산이 맞습니다." },
        { at: "entity_hits = self._query_entity_vectors(query_embedding, self.settings.entity_top_k)", text: "엔티티(Concept·Technology 등) 벡터 인덱스에서 질문과 가장 유사한 상위 4개(entity_top_k)를 가져옵니다." },
        { at: "context_docs = self._expand_doc_neighbors(doc_hits)", text: "벡터로 찾은 청크의 앞뒤 청크도 가져옵니다. 청크 경계에서 문장이 잘릴 때 문맥을 보완합니다." },
        { at: "answer = self._generate_answer(question, context, history)", text: "수집한 엔티티와 청크를 컨텍스트로 정리해 Groq LLM에 전달하고 한국어 답변을 생성합니다." }
      ],
      code: `    def vector_search(self, question: str, history: list[dict[str, str]] | None = None) -> dict[str, Any]:
        """엔티티와 문서 청크 벡터 인덱스를 함께 검색."""
        try:
            query_embedding = self._embed_query(question)
            entity_hits = self._query_entity_vectors(query_embedding, self.settings.entity_top_k)
            doc_hits = self._query_doc_vectors(query_embedding, self.settings.doc_top_k)
            context_docs = self._expand_doc_neighbors(doc_hits)
        except Exception as exc:
            logger.error("벡터 검색 실패: %s", exc)
            return self._error_result("vector", f"벡터 검색 중 오류 발생: {exc}")

        if not entity_hits and not doc_hits:
            logger.warning("벡터 검색 결과 없음: %s", question)
            return {
                "mode": "vector",
                "answer": "벡터 검색 결과가 없습니다. 인덱싱 상태와 질문 표현을 확인하세요.",
                "sources": [],
                "vector_hits": [],
            }

        context = self._build_vector_context(entity_hits, context_docs or doc_hits)
        answer = self._generate_answer(question, context, history)
        return {
            "mode": "vector",
            "answer": answer,
            "sources": self._collect_sources(entity_hits + (context_docs or doc_hits)),
            "vector_hits": entity_hits + doc_hits,
            "context_chunks": context_docs,
        }`
    },
    {
      id: "fn_graph_qa",
      name: "QueryEngine.graph_qa()",
      fileId: "engine",
      summary: "GraphCypherQAChain이 자연어 질문을 Cypher로 자동 변환·실행해 그래프 기반 답변 생성. LLM 비결정성으로 Cypher가 잘못 생성되면 1회 재시도하고, 집계 질문은 직접 Cypher로 복구",
      how: "gpt-oss-20b가 가끔 Cypher 대신 안내 문장을 생성해 Neo4j SyntaxError가 납니다. max_retries는 이 다운스트림 오류를 잡지 못하므로 체인 수준에서 1회 재시도합니다. 그래도 실패하면 '몇 개' 같은 집계 질문은 결정적인 Cypher 집계로 복구합니다.",
      terms: ["GraphCypherQAChain", "Cypher", "Neo4j", "LLM_fallback"],
      lines: [
        { at: "for attempt in range(2):", text: "최대 2번 시도합니다. LLM이 잡담을 생성해 Cypher 실행이 실패하면 1번만 재시도로 흡수합니다." },
        { at: "result = self.graph_chain.invoke({\"query\": question})", text: "GraphCypherQAChain에 질문을 전달합니다. 체인 내부에서 Cypher 생성→Neo4j 실행→답변 생성이 순서대로 진행됩니다." },
        { at: "fallback = self._try_graph_aggregate_fallback(question, cypher, graph_context)", text: "집계 질문('몇 개')인데 Cypher가 잘못됐거나 결과가 비어 있으면 직접 Cypher 집계로 대신 답합니다." }
      ],
      code: `    def graph_qa(self, question: str) -> dict[str, Any]:
        """GraphCypherQAChain으로 Cypher 자동 생성·실행 후 답변 생성."""
        last_exc: Exception | None = None
        for attempt in range(2):  # 전이적 잡담 생성(SyntaxError)을 1회 재시도로 흡수
            try:
                result = self.graph_chain.invoke({"query": question})
                steps = result.get("intermediate_steps", [])
                cypher = self._extract_intermediate_value(steps, "query") or ""
                graph_context = self._extract_intermediate_value(steps, "context") or []
                fallback = self._try_graph_aggregate_fallback(question, cypher, graph_context)
                if fallback:
                    return fallback
                return {
                    "mode": "graph_qa",
                    "answer": result.get("result", "그래프 질의 결과가 없습니다."),
                    "cypher": cypher,
                    "graph_data": graph_context,
                    "sources": ["Neo4j KG"],
                }
            except Exception as exc:
                last_exc = exc
                logger.warning("GraphCypherQAChain 시도 %d/2 실패: %s", attempt + 1, exc)

        # 모든 시도 실패 → 집계 질문은 빈 컨텍스트를 강제해 Cypher 집계 폴백으로 결정적 복구 시도
        fallback = self._try_graph_aggregate_fallback(question, "", [])
        if fallback:
            return fallback
        logger.error("GraphCypherQAChain 최종 실패: %s", last_exc)
        return self._error_result("graph_qa", f"Graph QA Cypher 생성 또는 실행 실패: {last_exc}")`
    },
    {
      id: "fn_hybrid_search",
      name: "QueryEngine.hybrid_search()",
      fileId: "engine",
      summary: "벡터로 시드 엔티티를 찾은 뒤 1-hop 그래프 관계까지 확장해 문서 근거와 그래프 근거를 함께 수집",
      how: "Vector만 쓰면 직접 언급된 개념만 찾고, Graph QA만 쓰면 의미 유사도를 활용하지 못합니다. Hybrid는 둘을 결합해 '이 개념과 연결된 다른 개념'까지 포함한 풍부한 컨텍스트를 만듭니다.",
      terms: ["Vector", "Embedding", "Neo4j", "Knowledge Graph", "Cypher"],
      lines: [
        { at: "seed_entities = self._query_entity_vectors(query_embedding, self.settings.hybrid_seed_top_k)", text: "벡터 유사도로 시드 엔티티 상위 5개(hybrid_seed_top_k)를 찾습니다. 이 엔티티들이 그래프 확장의 시작점이 됩니다." },
        { at: "seed_ids = [hit[\"id\"] for hit in seed_entities if hit.get(\"id\")]", text: "시드 엔티티의 ID 목록을 추출합니다. Neo4j Cypher에서 이 ID로 1-hop 이웃을 조회합니다." },
        { at: "graph_rows = self._expand_graph(seed_ids)", text: "시드 엔티티에서 한 관계(1-hop)만 따라가 연결된 엔티티와 관계 타입을 가져옵니다. 최대 25건(hybrid_graph_limit)으로 제한합니다." },
        { at: "context = self._build_hybrid_context(seed_entities, graph_rows)", text: "벡터 시드 엔티티 설명과 그래프 관계를 하나의 컨텍스트 문자열로 합칩니다. LLM이 두 정보를 함께 활용할 수 있습니다." }
      ],
      code: `    def hybrid_search(self, question: str, history: list[dict[str, str]] | None = None) -> dict[str, Any]:
        """벡터로 시드 엔티티를 찾고 1-hop 그래프 관계를 확장."""
        try:
            query_embedding = self._embed_query(question)
            seed_entities = self._query_entity_vectors(query_embedding, self.settings.hybrid_seed_top_k)
        except Exception as exc:
            logger.error("하이브리드 시드 검색 실패: %s", exc)
            return self._error_result("hybrid", f"하이브리드 벡터 검색 중 오류 발생: {exc}")

        if not seed_entities:
            return {
                "mode": "hybrid",
                "answer": "하이브리드 검색을 위한 관련 엔티티를 찾지 못했습니다.",
                "sources": [],
                "vector_hits": [],
                "graph_data": [],
            }

        seed_ids = [hit["id"] for hit in seed_entities if hit.get("id")]
        graph_rows = self._expand_graph(seed_ids)
        context = self._build_hybrid_context(seed_entities, graph_rows)
        answer = self._generate_answer(question, context, history)
        return {
            "mode": "hybrid",
            "answer": answer,
            "sources": self._collect_sources(seed_entities),
            "vector_hits": seed_entities,
            "graph_data": graph_rows,
        }`
    },
    {
      id: "fn_build_graph_chain",
      name: "QueryEngine._build_graph_chain()",
      fileId: "engine",
      summary: "Neo4j 스키마와 Few-shot 예시를 포함한 Cypher 생성 프롬프트로 GraphCypherQAChain을 초기화",
      how: "프롬프트에 사용 가능한 노드 라벨·관계 타입·Cypher 규칙·예시 3개를 주입합니다. validate_cypher=True로 LLM이 만든 Cypher를 실행 전에 문법 검사해 SyntaxError를 줄입니다.",
      terms: ["GraphCypherQAChain", "Cypher", "Neo4j", "Knowledge Graph"],
      lines: [
        { at: "self.graph.refresh_schema()", text: "Neo4j 스키마(노드 라벨·속성·관계)를 최신 상태로 갱신합니다. 프롬프트의 {schema} 자리에 이 정보가 들어갑니다." },
        { at: "validate_cypher=True,", text: "LLM이 생성한 Cypher를 실행 전에 구문 검사합니다. 분명히 잘못된 쿼리는 Neo4j까지 보내지 않고 사전 차단합니다." },
        { at: "return_intermediate_steps=True,", text: "체인이 생성한 Cypher와 Neo4j 실행 결과를 중간 단계로 반환합니다. UI에서 어떤 Cypher가 실행됐는지 볼 수 있습니다." },
        { at: "allow_dangerous_requests=True,", text: "LangChain 최신 버전에서 임의 Cypher 실행에 명시적 동의가 필요합니다. 이 플래그 없이는 체인이 동작하지 않습니다." }
      ],
      code: `    def _build_graph_chain(self) -> GraphCypherQAChain:
        """GraphCypherQAChain 생성."""
        labels = ", ".join(self.settings.entity_labels)
        relationships = ", ".join(self.settings.relationship_types)
        cypher_prompt = PromptTemplate.from_template(
            f"""Task: Generate one read-only Neo4j Cypher query for the user question.

Schema:
{{schema}}

Rules:
- Use stored English node labels only: {labels}.
- Use relationship types only when they exist in the schema, such as: {relationships}.
- Use \`id\`, \`text\`, and \`description\` properties. Do not use a \`name\` property.
- For "entities connected to X" questions, require BOTH endpoints to carry an entity label and exclude the MENTIONS relationship, so source Document/Chunk nodes (hashed ids) are not returned.
- For broad/global questions, use Cypher aggregation such as count, collect, ORDER BY, LIMIT.
- Korean count expressions such as "몇 개", "개수", "수는" must use count().
- Neo4j Community Edition has no GDS plugin, so never use gds.* procedures.
- Never generate CREATE, MERGE, SET, DELETE, DETACH DELETE, DROP, LOAD CSV, or APOC writes.
- Return at most {self.settings.cypher_top_k} rows unless the question explicitly asks for a count.
- Return only the Cypher query, no prose.

Question:
{{question}}"""
        )
        self.graph.refresh_schema()
        # GraphCypherQAChain은 임의 Cypher 실행 가능성이 있어 최신 LangChain에서 명시적 opt-in이 필요함.
        return GraphCypherQAChain.from_llm(
            llm=self.llm,
            graph=self.graph,
            cypher_prompt=cypher_prompt,
            validate_cypher=True,
            top_k=self.settings.cypher_top_k,
            return_intermediate_steps=True,
            allow_dangerous_requests=True,
        )`
    },
    {
      id: "fn_validate_readonly_cypher",
      name: "QueryEngine._validate_readonly_cypher()",
      fileId: "engine",
      summary: "Cypher Direct 모드에서 사용자가 입력한 쿼리가 읽기 전용인지 검사해 데이터 변경 명령을 차단",
      how: "CREATE·MERGE·DELETE 등 16개 위험 키워드를 단어 경계(\\b) 정규식으로 검사합니다. MATCH·RETURN 등 허용 시작어로 시작해야 하고, LIMIT이 없으면 자동으로 추가해 대량 조회를 방지합니다.",
      terms: ["Cypher", "Neo4j"],
      lines: [
        { at: "stripped = stripped.rstrip(\";\").strip()", text: "Cypher 끝의 세미콜론을 제거합니다. 세미콜론 뒤에 다른 문장이 있으면 다중 쿼리로 거부됩니다." },
        { at: "pattern = r\"\\b\" + re.escape(keyword).replace(r\"\\ \", r\"\\s+\") + r\"\\b\"", text: "키워드를 단어 경계로 검사합니다. 'DETACH DELETE'처럼 공백이 포함된 키워드는 \\s+로 대체해 탭·줄바꿈도 잡습니다." },
        { at: "if not upper.startswith(allowed_starts):", text: "MATCH·WITH·RETURN·UNWIND·SHOW·CALL DB.INDEX...로 시작하지 않는 쿼리는 모두 거부합니다." },
        { at: "stripped = f\"{stripped} LIMIT {self.settings.cypher_top_k}\"", text: "LIMIT이 없는 MATCH 쿼리에 자동으로 LIMIT 20을 붙입니다. 수만 행이 반환되는 상황을 방지합니다." }
      ],
      code: `    def _validate_readonly_cypher(self, query: str) -> tuple[str, str | None]:
        """Cypher Direct 입력을 읽기 전용 쿼리로 제한."""
        stripped = query.strip()
        if not stripped:
            return "", "Cypher 쿼리를 입력하세요."
        stripped = stripped.rstrip(";").strip()
        if ";" in stripped:
            return stripped, "여러 Cypher 문장은 실행할 수 없습니다."

        blocked = (
            "CREATE", "MERGE", "SET", "DELETE", "DETACH", "REMOVE", "DROP", "LOAD",
            "ALTER", "GRANT", "DENY", "REVOKE", "START", "STOP", "CALL APOC",
            "DBMS",
        )
        upper = stripped.upper()
        for keyword in blocked:
            pattern = r"\\b" + re.escape(keyword).replace(r"\\ ", r"\\s+") + r"\\b"
            if re.search(pattern, upper):
                return stripped, f"읽기 전용 쿼리만 허용됩니다. 차단 키워드: {keyword}"

        allowed_starts = ("MATCH", "WITH", "RETURN", "UNWIND", "SHOW", "CALL DB.INDEX.VECTOR.QUERYNODES")
        if not upper.startswith(allowed_starts):
            return stripped, "MATCH/WITH/RETURN/UNWIND/SHOW 또는 벡터 조회 CALL만 허용됩니다."

        if upper.startswith(("MATCH", "WITH", "UNWIND")) and not re.search(r"\\bLIMIT\\b", upper):
            stripped = f"{stripped} LIMIT {self.settings.cypher_top_k}"
        return stripped, None`
    },
    {
      id: "fn_load_services",
      name: "load_services()",
      fileId: "app",
      summary: "검색 앱이 사용하는 Settings·Neo4jConnection·QueryEngine·QueryRouter를 앱 기동 시 1회만 생성하고 캐싱",
      how: "@st.cache_resource 덕분에 Streamlit이 페이지를 재실행해도 이 함수는 처음 한 번만 실행됩니다. Neo4j 연결과 LLM 클라이언트 생성 비용을 절약합니다.",
      terms: ["Neo4j", "Router", "Groq LPU"],
      lines: [
        { at: "@st.cache_resource(show_spinner=False)", text: "반환값을 Streamlit 앱 수명 동안 캐싱합니다. 사용자가 질문을 보낼 때마다 Neo4j에 재연결하지 않아 응답이 빠릅니다." },
        { at: "connection = Neo4jConnection(settings)", text: "Neo4j에 연결합니다. 연결 실패 시 내부에서 최대 3회 재시도합니다." },
        { at: "engine = QueryEngine(settings, connection.graph)", text: "4가지 검색 모드를 실행하는 QueryEngine을 만듭니다. Neo4jGraph 객체를 공유해 연결을 재사용합니다." }
      ],
      code: `@st.cache_resource(show_spinner=False)
def load_services() -> tuple[Settings, Neo4jConnection, QueryEngine, QueryRouter]:
    """설정, Neo4j 연결, 검색 엔진, 라우터를 지연 생성."""
    settings = Settings()
    connection = Neo4jConnection(settings)
    engine = QueryEngine(settings, connection.graph)
    router = QueryRouter(settings)
    return settings, connection, engine, router`
    },
    {
      id: "fn_process_query",
      name: "process_query()",
      fileId: "app",
      summary: "사용자 질문을 받아 재작성 → 라우팅 → 검색 → 결과 반환까지 전체 처리 흐름을 조율",
      how: "Cypher Direct 모드는 재작성 없이 쿼리를 그대로 전달합니다. 나머지 모드는 대화 이력이 있으면 condense_question으로 질문을 완성한 뒤 라우터에 보냅니다.",
      terms: ["Router", "Cypher", "condense"],
      lines: [
        { at: "if history and \"cypher\" not in selected_mode.lower():", text: "대화 이력이 있고 Cypher 모드가 아닐 때만 질문을 재작성합니다. Cypher 쿼리는 재작성하면 쿼리 문법이 깨질 수 있습니다." },
        { at: "decision = router.route(condensed, selected_mode)", text: "재작성된 질문과 사용자가 선택한 모드를 라우터에 전달해 최종 검색 모드를 결정합니다." },
        { at: "result[\"routing_reason\"] = decision.reason", text: "라우터가 어떤 근거로 모드를 선택했는지 결과에 추가합니다. UI의 캡션에 '라우팅: 패턴 매칭 확신도 높음' 형태로 표시됩니다." }
      ],
      code: `def process_query(question: str, selected_mode: str, history: list[dict[str, str]] | None = None) -> dict:
    """라우팅 후 검색 엔진 실행."""
    settings, _, engine, router = load_services()

    # cypher_direct 는 사용자 Cypher를 그대로 전달; 나머지 모드는 질문 재작성
    if history and "cypher" not in selected_mode.lower():
        condensed = condense_question(question, history, settings)
    else:
        condensed = question

    decision = router.route(condensed, selected_mode)
    result = engine.search(condensed, decision.mode, history)
    result["requested_mode"] = selected_mode
    result["routing_reason"] = decision.reason
    result["routing_scores"] = decision.scores
    logger.info(
        "질문 처리 완료: mode=%s, rewritten=%s, reason=%s",
        decision.mode,
        condensed != question,
        decision.reason,
    )
    return result`
    },
    {
      id: "fn_main",
      name: "main()",
      fileId: "app",
      summary: "Streamlit 앱의 전체 화면을 구성하고 사용자 질문을 받아 검색 결과를 채팅 형식으로 표시",
      how: "사이드바에 모드 선택·상태 버튼을 배치하고, 채팅 이력을 순서대로 렌더링합니다. 새 질문이 들어오면 process_query()를 호출해 결과를 화면에 추가합니다.",
      terms: ["Streamlit", "Neo4j", "Knowledge Graph"],
      lines: [
        { at: "st.set_page_config(page_title=\"LangChain + Neo4j GraphRAG\", layout=\"wide\")", text: "브라우저 탭 제목과 화면 레이아웃을 설정합니다. layout=\"wide\"는 화면을 최대한 넓게 씁니다." },
        { at: "if question := st.chat_input(\"질문 또는 Cypher 쿼리 입력\"):", text: ":=는 왈러스 연산자입니다. 사용자가 입력한 값을 question에 저장하면서 동시에 빈 문자열인지 조건을 검사합니다." },
        { at: "with st.spinner(\"검색 중...\"):", text: "검색이 완료될 때까지 로딩 스피너를 화면에 표시합니다. 사용자가 기다리고 있음을 알 수 있습니다." },
        { at: "\"content\": str(result.get(\"answer\", \"\"))", text: "답변 결과를 session_state에 저장합니다. 페이지가 재실행돼도 이전 대화가 유지됩니다." }
      ],
      code: `def main() -> None:
    """Streamlit 앱 엔트리포인트."""
    st.set_page_config(page_title="LangChain + Neo4j GraphRAG", layout="wide")
    initialize_messages()
    configure_logging(Settings())

    try:
        settings, connection, _, _ = load_services()
    except Exception as exc:
        st.error(f"초기화 실패: {exc}")
        st.stop()

    with st.sidebar:
        st.title("GraphRAG 검색")
        st.caption(f"LLM: {settings.groq_model}")
        selected_mode = st.radio("검색 모드", MODE_LABELS, index=0)
        st.divider()
        if st.button("Neo4j 상태"):
            display_neo4j_status(connection)
        if st.button("KG 통계"):
            display_kg_stats(connection)
        if st.button("대화 초기화"):
            st.session_state.messages = []
            st.rerun()

    st.title("LangChain + Neo4j GraphRAG")

    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            if message["role"] == "assistant" and message.get("result"):
                display_result(message["result"])
            else:
                st.markdown(message["content"])

    # st.chat_input: 채팅창 하단 입력란을 렌더링하고 입력값을 반환함.
    # := 는 조건 검사와 동시에 변수에 값을 할당함.
    if question := st.chat_input("질문 또는 Cypher 쿼리 입력"):
        history = build_history()  # 현재 턴 추가 전 이력 수집
        st.session_state.messages.append({"role": "user", "content": question})
        with st.chat_message("user"):
            st.markdown(question)

        with st.chat_message("assistant"):
            with st.spinner("검색 중..."):
                result = process_query(question, selected_mode, history)
                display_result(result)

        st.session_state.messages.append({
            "role": "assistant",
            "content": str(result.get("answer", "")),
            "result": result,
        })`
    }
  ],
  glossary: {
    "Neo4j":               "노드(개념·기술)와 관계(연결 선)를 저장하는 그래프 데이터베이스입니다. Cypher 언어로 '이 노드와 연결된 모든 노드'를 조회합니다.",
    "Neo4jGraph":          "LangChain에서 Neo4j 연결과 Cypher 실행을 감싸는 래퍼 클래스입니다. graph.query(cypher)로 Cypher를 실행합니다.",
    "Cypher":              "Neo4j 전용 그래프 조회 언어입니다. SQL이 테이블을 조회한다면 Cypher는 MATCH (n)-[r]->(m) 패턴으로 노드와 관계를 조회합니다.",
    "GraphCypherQAChain":  "자연어 질문을 Cypher로 자동 변환하고 Neo4j를 실행해 답변까지 만드는 LangChain 체인입니다.",
    "Knowledge Graph":     "사람·개념·기술 같은 엔티티를 노드로, 엔티티 간 관계를 선으로 표현한 지식 지도입니다.",
    "Vector":              "텍스트 의미를 숫자 목록으로 변환한 값입니다. 두 텍스트의 벡터가 가까울수록 의미가 비슷하다고 봅니다.",
    "Embedding":           "텍스트를 벡터로 변환하는 과정입니다. qwen3-embedding 모델이 문장을 4096개 숫자로 바꿉니다.",
    "Ollama":              "로컬에서 LLM·임베딩 모델을 실행하는 도구입니다. 외부 API 없이 PC에서 qwen3-embedding을 직접 구동합니다.",
    "Groq LPU":            "Groq사의 LPU 칩을 활용한 빠른 LLM 추론 서비스입니다. OpenAI 호환 API 형태로 호출합니다.",
    "Router":              "사용자 질문을 분석해 가장 적합한 검색 모드를 결정하는 판단기입니다.",
    "LLM_fallback":        "규칙 기반 판단이 애매할 때 LLM에게 한 번 더 결정을 맡기는 보완 방법입니다.",
    "condense":            "이전 대화 맥락을 참고해 후속 질문을 독립적으로 이해할 수 있는 완전한 문장으로 바꾸는 작업입니다.",
    "exponential_backoff": "실패할수록 재시도 간격을 2배씩 늘리는 방법입니다. 1초→2초→4초처럼 늘어납니다.",
    "Streamlit":           "파이썬 코드만으로 웹 UI를 빠르게 만드는 라이브러리입니다. st.write(), st.chat_input() 같은 함수로 화면을 구성합니다.",
    "session_state":       "Streamlit에서 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소입니다. 대화 이력을 여기에 보관합니다.",
    "dataclass":           "@dataclass 데코레이터가 __init__·__repr__ 등을 자동 생성합니다. 설정 값을 구조화할 때 자주 씁니다.",
    "dotenv":              "python-dotenv 라이브러리입니다. .env 파일의 KEY=VALUE를 읽어 os.environ에 등록해 API 키를 코드에 하드코딩하지 않게 합니다.",
    "pathlib":             "파이썬 표준 라이브러리의 파일 경로 모듈입니다. Path 객체로 경로를 표현하며 / 연산자로 경로를 이어 붙입니다.",
    "1-hop":               "그래프에서 한 노드에서 관계 하나를 따라가 도달하는 바로 인접한 노드를 말합니다."
  }
};
