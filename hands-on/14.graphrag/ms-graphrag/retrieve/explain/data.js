window.EXPLAIN_DATA = {
  meta: { title: "MS GraphRAG 검색 파이프라인 — Auto Router + 4가지 검색 모드 + 코드 벡터", entry: "app.py" },
  files: [
    { id: "app",      label: "app.py",                  role: "Streamlit 채팅 UI — 질문 입력부터 결과 표시까지 전체 흐름 조립" },
    { id: "config",   label: "config.py",               role: "경로 상수·검색 설정·GraphRAG config 로딩·산출물 경로 검증" },
    { id: "router",   label: "router.py",               role: "Auto 모드에서 질문을 Basic/Local/Global/DRIFT/Code 중 하나로 분류" },
    { id: "retriever",label: "retriever.py",            role: "GraphRAG API 4가지 검색 실행, DRIFT 재시도, 코드 LanceDB 검색" },
    { id: "llm",      label: "llm.py",                  role: "GraphRAG 내장 LLM completion factory 래퍼 — 라우터·condenser·코드 답변에 공통 사용" },
    { id: "condenser",label: "question_condenser.py",   role: "대화 이력 기반 후속 질문 재작성 — 임베딩 품질 향상" },
    { id: "logging",  label: "logging_config.py",       role: "Streamlit 재실행에도 중복 없는 로그 핸들러 설정" }
  ],
  flow: [
    { step: 1, title: "앱 시작·설정 로드",   label: "앱 시작·설정 로드", summary: "사이드바에서 검색 모드, LLM 모델, 세부 옵션 선택",          detail: "render_sidebar()가 검색 모드(Auto/Basic/Local/Global/DRIFT/Code), LLM 모델명, community level, DRIFT 재시도 수, Code Top-K 같은 옵션을 사이드바에 표시합니다. 사용자가 바꾸지 않으면 .env와 settings 기본값이 사용됩니다." },
    { step: 2, title: "산출물 검증",          label: "산출물 검증",       refs: ["fn_validate_paths"], summary: "Parquet·LanceDB·.env 파일 존재 여부 사전 확인",            detail: "validate_paths()가 엔티티·커뮤니티·텍스트 유닛 등 Parquet 5개, GraphRAG LanceDB 벡터 디렉터리, 코드 LanceDB 디렉터리, .env 파일이 모두 있는지 확인합니다. 하나라도 없으면 st.stop()으로 앱을 중단하고 빠진 경로를 화면에 표시합니다." },
    { step: 3, title: "질문 재작성",          label: "질문 재작성",       refs: ["fn_condense_question"], summary: "대화 이력이 있으면 후속 질문을 독립 질문으로 바꿈",          detail: "condense_question()이 '그건 왜 그래?' 같은 타원형 후속 질문을 '로컬 서치의 entity 탐색 방식은 왜 그래?' 처럼 맥락 없이도 의미가 완성된 독립 질문으로 재작성합니다. 임베딩·검색 정확도를 높이는 핵심 전처리입니다." },
    { step: 4, title: "라우팅",               label: "라우팅",            refs: ["fn_route", "fn_route_by_pattern", "fn_route_by_llm"], summary: "Auto이면 키워드 규칙 → LLM fallback으로 검색 모드 결정",   detail: "QueryRouter.route()가 수동 선택이면 그대로 쓰고, Auto이면 먼저 키워드 규칙으로 5가지 모드를 점수화합니다. 확신도가 min_confidence(기본 0.65) 미만이면 LLM few-shot으로 한 번 더 판단을 받습니다." },
    { step: 5, title: "검색 실행",            label: "검색 실행",         refs: ["fn_run_query", "fn_search_async", "fn_drift_with_retry", "fn_embed_query"], summary: "모드에 따라 GraphRAG API 또는 코드 LanceDB 검색 수행",      detail: "code 모드면 CodeVectorRetriever가 Ollama 임베딩 → LanceDB 벡터 검색 → LLM 답변 합성 순서로 처리합니다. 나머지 모드(basic/local/global/drift)는 GraphRAGRetriever가 해당 GraphRAG API를 비동기로 호출합니다. DRIFT 실패 시에는 Local Search로 자동 폴백합니다." },
    { step: 6, title: "결과 표시",            label: "결과 표시",         refs: ["fn_render_result"], summary: "답변·사용 모드·라우팅 이유·출처를 화면에 표시",             detail: "render_result()가 LLM 답변과 함께 실제 사용된 모드, 라우팅 확신도, fallback 여부를 캡션으로 보여줍니다. '출처 및 라우팅 근거' 확장 패널에서 엔티티·커뮤니티 리포트·텍스트 유닛 등 GraphRAG가 실제로 참조한 원문을 확인할 수 있어 교육 용도로 유용합니다." }
  ],
  functions: [
    {
      id: "fn_retrieve_settings",
      name: "RetrieveSettings",
      fileId: "config",
      summary: "검색 시간에 조정 가능한 모든 파라미터를 환경변수 기본값과 함께 정의",
      how: "@dataclass(frozen=True)로 불변 객체를 만듭니다. 각 필드는 os.getenv()로 환경변수 → 기본값 순으로 초기화됩니다. Streamlit 사이드바에서 실시간으로 바꾼 값이 우선 적용됩니다.",
      terms: ["dataclass", "dotenv"],
      lines: [
        { at: "llm_model: str = os.getenv(\"GRAPHRAG_QUERY_MODEL\"", text: "LLM 모델명을 환경변수에서 읽습니다. 없으면 gpt-oss-120b를 씁니다. Groq에서 서빙하는 OpenAI 호환 모델입니다." },
        { at: "community_level: int = int(os.getenv(\"GRAPHRAG_COMMUNITY_LEVEL\", \"2\"))", text: "GraphRAG가 분석한 커뮤니티 계층 중 어느 깊이까지 사용할지를 설정합니다. 숫자가 높을수록 더 세밀한 소규모 커뮤니티를 검색에 씁니다." },
        { at: "router_min_confidence: float = float(os.getenv(\"GRAPHRAG_ROUTER_MIN_CONFIDENCE\", \"0.65\"))", text: "패턴 라우팅 확신도가 이 값 미만이면 LLM에게 다시 판단을 맡깁니다. 너무 높으면 LLM fallback이 자주 일어나 느려집니다." },
        { at: "drift_json_retries: int = int(os.getenv(\"GRAPHRAG_DRIFT_JSON_RETRIES\", \"3\"))", text: "DRIFT 검색은 LLM이 내부에서 JSON을 생성하는데, 비결정적 LLM이 간혹 깨진 JSON을 반환합니다. 이 수만큼 재시도한 뒤에도 실패하면 Local Search로 폴백합니다." }
      ],
      code: `@dataclass(frozen=True)
class RetrieveSettings:
    """User-tunable settings for query-time retrieval."""

    llm_model: str = os.getenv("GRAPHRAG_QUERY_MODEL", "openai/gpt-oss-120b")
    embedding_model: str = os.getenv("GRAPHRAG_EMBEDDING_MODEL", "qwen3-embedding")
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    response_type: str = os.getenv(
        "GRAPHRAG_RESPONSE_TYPE",
        "한국어로 근거를 포함해 간결하게 답변",
    )
    community_level: int = int(os.getenv("GRAPHRAG_COMMUNITY_LEVEL", "2"))
    graph_top_sources: int = int(os.getenv("GRAPHRAG_GRAPH_TOP_SOURCES", "8"))
    code_top_k: int = int(os.getenv("GRAPHRAG_CODE_TOP_K", "5"))
    router_min_confidence: float = float(os.getenv("GRAPHRAG_ROUTER_MIN_CONFIDENCE", "0.65"))
    drift_json_retries: int = int(os.getenv("GRAPHRAG_DRIFT_JSON_RETRIES", "3"))
    dynamic_global_selection: bool = os.getenv("GRAPHRAG_DYNAMIC_GLOBAL_SELECTION", "false").lower() == "true"`
    },
    {
      id: "fn_load_query_config",
      name: "load_query_config()",
      fileId: "config",
      summary: "GraphRAG settings.yaml을 읽고 인덱싱 설정은 유지한 채 검색용 LLM 모델만 교체",
      how: "load_config()로 settings.yaml 전체를 불러온 뒤, completion_models를 순회해 model 필드만 사이드바에서 선택한 값으로 덮어씁니다. 인덱싱 때 쓴 임베딩·chunking 설정은 그대로 유지됩니다.",
      terms: ["GraphRAGConfig", "dotenv"],
      lines: [
        { at: "load_environment()", text: "hands-on/.env를 로드해 GROQ_API_KEY 같은 환경변수를 등록합니다. GraphRAG 내부가 os.environ에서 키를 읽기 때문에 config를 읽기 전에 반드시 먼저 실행해야 합니다." },
        { at: "config = load_config(INDEXING_DIR)", text: "인덱싱 때 만든 settings.yaml을 읽어 GraphRagConfig 객체로 파싱합니다. 검색 API에 넘길 공식 설정 객체입니다." },
        { at: "for model_config in config.completion_models.values():", text: "설정 안의 모든 completion 모델 항목을 순회합니다. settings.yaml에 여러 모델이 정의되어 있어도 일괄 교체합니다." },
        { at: "model_config.model = model_name", text: "사이드바에서 선택한 모델명(예: openai/gpt-oss-120b)으로 교체합니다. 인덱싱 때 썼던 모델이 아닌 검색용 모델로 답변을 생성하게 됩니다." }
      ],
      code: `def load_query_config(query_model: str | None = None) -> GraphRagConfig:
    """Load GraphRAG settings.yaml and switch query-time LLM to the retrieval model."""

    load_environment()
    config = load_config(INDEXING_DIR)
    model_name = query_model or settings.llm_model

    for model_config in config.completion_models.values():
        model_config.model = model_name

    return config`
    },
    {
      id: "fn_validate_paths",
      name: "validate_paths()",
      fileId: "config",
      summary: "검색에 필요한 인덱싱 산출물이 모두 있는지 검사하고 없는 경로 목록을 반환",
      how: "필요한 파일·디렉터리 경로를 목록으로 만들고, 존재하지 않는 것만 걸러 문자열 목록으로 반환합니다. 앱 시작 시 이 목록이 비어 있어야 검색이 시작됩니다.",
      terms: ["Parquet", "LanceDB"],
      lines: [
        { at: "PARQUET_DIR / \"entities.parquet\"", text: "GraphRAG 인덱싱이 추출한 엔티티(사람·개념·기술)를 저장한 Parquet 파일입니다. Local/Global/DRIFT 검색에 반드시 필요합니다." },
        { at: "GRAPHRAG_VECTOR_DIR,", text: "GraphRAG 자체 LanceDB 벡터 인덱스 디렉터리입니다. Basic·Local 검색의 벡터 유사도 탐색에 사용합니다." },
        { at: "CODE_VECTOR_DIR,", text: "예제코드 전용 LanceDB 인덱스 디렉터리입니다. Code 검색 모드에서만 사용합니다." },
        { at: "return [str(path) for path in required if not path.exists()]", text: "빠진 경로만 문자열 목록으로 반환합니다. 빈 목록이면 정상, 항목이 있으면 앱이 화면에 표시하고 중단합니다." }
      ],
      code: `def validate_paths() -> list[str]:
    """Return missing required paths as user-friendly strings."""

    required = [
        PARQUET_DIR / "entities.parquet",
        PARQUET_DIR / "relationships.parquet",
        PARQUET_DIR / "communities.parquet",
        PARQUET_DIR / "community_reports.parquet",
        PARQUET_DIR / "text_units.parquet",
        GRAPHRAG_VECTOR_DIR,
        CODE_VECTOR_DIR,
        ENV_PATH,
    ]
    return [str(path) for path in required if not path.exists()]`
    },
    {
      id: "fn_run_query",
      name: "run_query()",
      fileId: "app",
      summary: "질문 재작성 → 라우팅 → 검색기 선택 → 검색 실행을 하나로 묶은 핵심 함수",
      how: "condense_question으로 질문을 다듬고, router.route()로 모드를 결정한 뒤, code 모드이면 CodeVectorRetriever, 나머지이면 GraphRAGRetriever를 사용합니다. Streamlit은 동기 환경이므로 GraphRAG의 비동기 API는 run_async()를 통해 실행됩니다.",
      terms: ["condense", "QueryRouter", "GraphRAGRetriever", "CodeVectorRetriever"],
      lines: [
        { at: "condensed = condense_question(prompt, history, get_condenser_llm()) if history else prompt", text: "대화 이력이 있으면 '그건 왜?' 같은 타원형 질문을 독립 질문으로 바꿉니다. 이력이 없으면 원본 질문을 그대로 사용해 불필요한 LLM 호출을 건너뜁니다." },
        { at: "route = router.route(condensed, options[\"selected_mode\"])", text: "재작성된 질문과 사이드바 선택 모드를 라우터에 넘겨 최종 검색 모드와 확신도를 결정합니다." },
        { at: "if route.mode == \"code\":", text: "라우팅 결과가 code이면 GraphRAG 산출물이 아닌 LanceDB 코드 인덱스를 사용합니다. 두 검색기는 입력·출력 형태가 같아 SearchResult로 통일됩니다." },
        { at: "result = retriever.search(condensed, route)", text: "GraphRAG 검색기를 호출합니다. 내부에서 run_async()로 비동기 GraphRAG API를 동기 환경에서 실행합니다." }
      ],
      code: `def run_query(prompt: str, options: dict[str, object], history: list[dict[str, str]] | None = None) -> SearchResult:
    # 대화 이력이 있으면 후속 질문을 독립 질문으로 재작성 (retrieval 임베딩 품질 향상)
    condensed = condense_question(prompt, history, get_condenser_llm()) if history else prompt
    logger.info("질문 수신: original=%s, rewritten=%s", prompt, condensed != prompt)

    router = get_router(float(options["router_min_confidence"]))
    route = router.route(condensed, options["selected_mode"])  # type: ignore[arg-type]

    if route.mode == "code":
        retriever = get_code_retriever(
            str(options["query_model"]),
            int(options["code_top_k"]),
        )
        result = retriever.search(condensed, route, history)
        logger.info("검색 완료: mode=%s, reason=%s", result.mode, result.route.reason)
        return result

    retriever = get_graph_retriever(
        str(options["query_model"]),
        str(options["response_type"]),
        int(options["community_level"]),
        bool(options["dynamic_global_selection"]),
        int(options["drift_json_retries"]),
    )
    result = retriever.search(condensed, route)
    logger.info("검색 완료: mode=%s, reason=%s", result.mode, result.route.reason)
    return result`
    },
    {
      id: "fn_render_result",
      name: "render_result()",
      fileId: "app",
      summary: "검색 답변과 함께 실제 사용 모드·확신도·fallback 여부·출처를 화면에 표시",
      how: "st.markdown으로 LLM 답변을 표시하고, st.caption으로 mode/confidence 메타정보를 한 줄로 보여줍니다. 출처는 접기/펼치기 패널 안에 담아 기본 화면을 깔끔하게 유지합니다.",
      terms: ["Streamlit", "SearchResult"],
      lines: [
        { at: "st.markdown(result.answer or \"검색 결과가 비어 있음\")", text: "LLM 답변을 마크다운 형식으로 렌더링합니다. 답변이 없으면 사용자에게 빈 화면 대신 안내 문구를 보여줍니다." },
        { at: "f\"confidence={result.route.confidence:.2f}\"", text: "라우터가 계산한 확신도를 소수점 둘째 자리까지 보여줍니다. 교육생이 라우팅이 얼마나 확실했는지 확인할 수 있습니다." },
        { at: "if result.route.used_llm_fallback:", text: "패턴 규칙 확신도가 낮아 LLM에게 모드 판단을 맡겼을 때 'router=LLM fallback' 레이블을 추가합니다. 패턴 라우팅이 충분했는지 교육적으로 관찰할 수 있습니다." },
        { at: "st.code(source.content[:1800], language=\"text\")", text: "GraphRAG가 실제로 참조한 원문을 1800자까지 표시합니다. 답변 근거를 직접 확인할 수 있어 환각(hallucination) 여부를 검증할 수 있습니다." }
      ],
      code: `def render_result(result: SearchResult) -> None:
    st.markdown(result.answer or "검색 결과가 비어 있음")
    meta_bits = [
        f"mode={MODE_LABELS[result.mode]}",
        f"requested={MODE_LABELS[result.requested_mode]}",
        f"confidence={result.route.confidence:.2f}",
    ]
    if result.route.used_llm_fallback:
        meta_bits.append("router=LLM fallback")
    st.caption(" · ".join(meta_bits))

    if result.fallback_reason:
        st.warning(result.fallback_reason)

    with st.expander("출처 및 라우팅 근거", expanded=False):
        st.write(result.route.reason)
        if not result.sources:
            st.info("표시할 출처가 없음")
            return
        for idx, source in enumerate(result.sources, start=1):
            st.markdown(f"**[{idx}] {source.source_type} · {source.title}**")
            st.caption(source.metadata)
            st.code(source.content[:1800], language="text")`
    },
    {
      id: "fn_route",
      name: "QueryRouter.route()",
      fileId: "router",
      summary: "수동 선택이면 즉시 반환, Auto이면 패턴 → LLM fallback 순으로 검색 모드 결정",
      how: "selected_mode가 'auto'가 아니면 신뢰도 1.0으로 바로 반환합니다. auto이면 패턴 점수를 먼저 내고, 확신도가 min_confidence 미만일 때만 LLM을 추가 호출해 비용을 절약합니다.",
      terms: ["QueryRouter", "RouteDecision", "LLMfallback"],
      lines: [
        { at: "if selected_mode != \"auto\":", text: "사용자가 사이드바에서 직접 모드를 골랐으면 패턴·LLM 판단 없이 그 모드를 그대로 씁니다. confidence=1.0으로 설정해 '사용자가 확정했다'는 것을 표시합니다." },
        { at: "decision = self._route_by_pattern(query)", text: "키워드 규칙으로 5가지 모드를 점수화합니다. LLM 호출 없이 빠르게 판단합니다." },
        { at: "if decision.confidence >= self.min_confidence:", text: "패턴 점수가 충분히 확실하면 LLM 호출 없이 패턴 결과를 그대로 사용합니다. 비용과 지연을 줄이는 핵심 분기입니다." },
        { at: "fallback = self._route_by_llm(query)", text: "패턴 확신도가 낮을 때만 LLM에게 few-shot JSON으로 모드 선택을 요청합니다. LLM도 실패하면 패턴 결과를 최후 보루로 씁니다." }
      ],
      code: `    def route(self, query: str, selected_mode: SearchMode) -> RouteDecision:
        """Resolve manual or auto mode into one executable retrieval mode."""

        if selected_mode != "auto":
            return RouteDecision(
                mode=selected_mode,
                confidence=1.0,
                reason=f"사용자가 {MODE_LABELS[selected_mode]} 모드를 직접 선택함",
            )

        decision = self._route_by_pattern(query)
        if decision.confidence >= self.min_confidence:
            return decision

        fallback = self._route_by_llm(query)
        if fallback is not None:
            return fallback

        return decision`
    },
    {
      id: "fn_route_by_pattern",
      name: "QueryRouter._route_by_pattern()",
      fileId: "router",
      summary: "키워드 빈도와 보너스 규칙으로 5가지 검색 모드를 점수화해 가장 높은 모드를 반환",
      how: "각 모드별 키워드 목록을 순회하며 질문에 포함되면 +1점을 더합니다. 함수 호출 패턴(단어( 형태)이면 code +1.5 보너스를 줍니다. 최종 확신도는 최고점/전체합으로 계산합니다.",
      terms: ["QueryRouter", "RouteDecision"],
      lines: [
        { at: "normalized = query.lower()", text: "대소문자 구분 없이 키워드를 찾기 위해 질문 전체를 소문자로 바꿉니다." },
        { at: "reasons[\"code\"].append(\"함수 호출 형태\")", text: "함수 호출 패턴(단어 뒤에 괄호)이 질문에 있으면 Code 점수에 1.5를 추가합니다. 'run_query(' 같은 형태는 코드 관련 질문의 강한 신호입니다." },
        { at: "confidence = min(0.95, max(0.3, best_score / total))", text: "확신도를 0.3~0.95 사이로 클리핑합니다. 상한 0.95는 과잉 확신을 막고, LLM fallback을 촉발하는 것은 이 값이 아니라 best_score/total 비율이 min_confidence(0.65) 아래로 떨어질 때입니다." }
      ],
      code: `    def _route_by_pattern(self, query: str) -> RouteDecision:
        normalized = query.lower()
        scores: dict[ResolvedMode, float] = {
            "basic": 0.0,
            "local": 0.0,
            "global": 0.0,
            "drift": 0.0,
            "code": 0.0,
        }
        reasons: dict[ResolvedMode, list[str]] = {mode: [] for mode in scores}

        keyword_sets: dict[ResolvedMode, list[str]] = {
            "code": [
                "코드", "예제", "소스", "함수", "클래스", "import", "streamlit",
                "app.py", ".py", "구현", "실행", "에러", "traceback", "code",
                "function", "class",
            ],
            "global": [
                "전체", "전반", "요약", "흐름", "공통", "트렌드", "주요", "핵심",
                "비교", "차이", "목록", "정리", "아키텍처", "큰 그림",
                "global", "global search", "overview", "summary",
            ],
            "drift": [
                "관계", "연결", "영향", "역할", "전략", "시사점", "종합", "복합",
                "왜", "어떻게 연결", "멀티홉", "관점", "drift", "hybrid",
                "multi-hop", "multihop",
            ],
            "local": [
                "무엇", "설명", "정의", "방법", "구성", "특징", "장점", "단점",
                "사용법", "원리", "개념", "local", "local search", "entity",
                "엔티티",
            ],
            "basic": [
                "언제", "몇", "버전", "경로", "모델명", "이름", "값", "여부",
                "설립", "단답", "간단히", "basic", "basic search",
            ],
        }

        for mode, keywords in keyword_sets.items():
            for keyword in keywords:
                if keyword in normalized:
                    scores[mode] += 1.0
                    reasons[mode].append(keyword)

        if re.search(r"\b[a-zA-Z_][\w_]*\(", query):
            scores["code"] += 1.5
            reasons["code"].append("함수 호출 형태")
        if len(query) <= 24 and scores["code"] == 0:
            scores["basic"] += 0.4
            reasons["basic"].append("짧은 단순 질의")
        if "?" in query and scores["global"] == 0 and scores["drift"] == 0:
            scores["local"] += 0.2
            reasons["local"].append("일반 설명형 질문")

        best_mode = max(scores, key=scores.get)
        best_score = scores[best_mode]
        total = sum(scores.values()) or 1.0
        confidence = min(0.95, max(0.3, best_score / total))
        reason = (
            f"패턴 매칭: {', '.join(reasons[best_mode])}"
            if reasons[best_mode]
            else "패턴 근거 부족"
        )
        return RouteDecision(best_mode, confidence, reason)`
    },
    {
      id: "fn_route_by_llm",
      name: "QueryRouter._route_by_llm()",
      fileId: "router",
      summary: "패턴 확신도가 낮을 때 few-shot 예시와 함께 LLM에게 JSON으로 모드 선택을 요청",
      how: "시스템 프롬프트에 5가지 모드의 정의를 설명하고, 사용자 메시지에 4가지 예시 Q&A를 포함해 LLM이 같은 형식으로 답하도록 유도합니다. 응답에서 JSON 객체만 추출해 mode·confidence·reason을 파싱합니다.",
      terms: ["LLMfallback", "QueryRouter", "RouteDecision"],
      lines: [
        { at: "\"drift combines global primer and local follow-up.", text: "DRIFT의 동작 방식을 시스템 프롬프트에 명시합니다. LLM이 '관계·종합' 질문을 DRIFT로 분류하도록 안내합니다." },
        { at: "raw = self.llm.complete(prompt, temperature=0.0, max_tokens=250)", text: "temperature=0.0으로 설정해 항상 가장 확실한 선택을 하도록 합니다. max_tokens=250은 JSON 응답 이상의 내용이 나오지 않도록 제한합니다." },
        { at: "if mode not in {\"basic\", \"local\", \"global\", \"drift\", \"code\"}:", text: "LLM이 허용 범위 밖의 모드명을 반환하면 None을 돌려보냅니다. 호출부에서 None이면 패턴 결과를 폴백으로 사용합니다." },
        { at: "return RouteDecision(mode, min(max(confidence, 0.0), 1.0), reason, True)", text: "네 번째 인자 True는 used_llm_fallback=True를 뜻합니다. 화면에 'router=LLM fallback' 레이블이 표시되어 패턴이 아닌 LLM이 판단했음을 사용자에게 알립니다." }
      ],
      code: `    def _route_by_llm(self, query: str) -> RouteDecision | None:
        prompt = [
            {
                "role": "system",
                "content": (
                    "You route Korean GraphRAG queries. Return only JSON with keys "
                    "mode, confidence, reason. mode must be one of basic, local, "
                    "global, drift, code. basic is simple fact/vector text-unit search. "
                    "local is entity-centered detail. global is corpus-wide theme/summary. "
                    "drift combines global primer and local follow-up. code searches Python examples."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Examples:\n"
                    "Q: GraphRAG의 전체 처리 흐름을 요약해줘\n"
                    "{\"mode\":\"global\",\"confidence\":0.86,\"reason\":\"전체 흐름 요약\"}\n"
                    "Q: Local Search는 어떤 엔티티를 중심으로 동작해?\n"
                    "{\"mode\":\"local\",\"confidence\":0.82,\"reason\":\"특정 검색 모드 상세\"}\n"
                    "Q: 예제 app.py에서 Streamlit 채팅은 어디서 처리해?\n"
                    "{\"mode\":\"code\",\"confidence\":0.91,\"reason\":\"예제 코드 위치 질의\"}\n"
                    "Q: GraphRAG와 벡터 RAG의 관계를 종합적으로 설명해줘\n"
                    "{\"mode\":\"drift\",\"confidence\":0.78,\"reason\":\"관계와 종합 추론\"}\n"
                    f"Q: {query}"
                ),
            },
        ]
        try:
            raw = self.llm.complete(prompt, temperature=0.0, max_tokens=250)
            data = self._parse_json(raw)
            mode = data.get("mode")
            if mode not in {"basic", "local", "global", "drift", "code"}:
                return None
            confidence = float(data.get("confidence", self.min_confidence))
            reason = str(data.get("reason", "LLM few-shot 라우팅"))
            return RouteDecision(mode, min(max(confidence, 0.0), 1.0), reason, True)
        except Exception:
            return None`
    },
    {
      id: "fn_search_async",
      name: "GraphRAGRetriever.search_async()",
      fileId: "retriever",
      summary: "라우팅 결과에 따라 Basic·Local·Global·DRIFT 중 하나의 GraphRAG API를 비동기 호출",
      how: "각 모드는 참조하는 데이터 범위가 다릅니다. Basic은 텍스트 유닛, Local은 엔티티+관계, Global은 커뮤니티 리포트, DRIFT는 Global 시작 후 Local 심화입니다. 모두 같은 SearchResult 형태로 반환됩니다.",
      terms: ["BasicSearch", "LocalSearch", "GlobalSearch", "DRIFTSearch", "asyncio"],
      lines: [
        { at: "answer, context = await basic_search(", text: "Basic Search는 원본 텍스트 청크(text_units)를 벡터 검색합니다. 그래프 탐색 없이 가장 빠르지만, 엔티티 관계 추론은 불가합니다." },
        { at: "answer, context = await self._local(query)", text: "Local Search는 질문과 관련된 엔티티를 그래프에서 찾고 그 주변 관계·커뮤니티·텍스트를 모아 답합니다. 특정 개념의 상세한 설명에 적합합니다." },
        { at: "answer, context = await global_search(", text: "Global Search는 커뮤니티 리포트를 요약해 전체 문서의 큰 흐름이나 주요 테마를 답합니다. 개별 엔티티보다 전체 맥락을 파악할 때 씁니다." },
        { at: "return await self._drift_with_retry(query, route)", text: "DRIFT는 JSON 생성 과정에서 LLM 비결정성 때문에 파싱 오류가 생길 수 있어 별도 재시도 로직으로 분리했습니다." }
      ],
      code: `    async def search_async(self, query: str, route: RouteDecision) -> SearchResult:
        """Run the selected GraphRAG search mode."""

        mode = route.mode
        if mode == "basic":
            answer, context = await basic_search(
                config=self.config,
                text_units=self.frame("text_units"),
                response_type=self.response_type,
                query=query,
            )
        elif mode == "local":
            answer, context = await self._local(query)
        elif mode == "global":
            answer, context = await global_search(
                config=self.config,
                entities=self.frame("entities"),
                communities=self.frame("communities"),
                community_reports=self.frame("community_reports"),
                community_level=self.community_level,
                dynamic_community_selection=self.dynamic_global_selection,
                response_type=self.response_type,
                query=query,
            )
        elif mode == "drift":
            return await self._drift_with_retry(query, route)
        else:
            raise ValueError(f"GraphRAGRetriever does not handle mode: {mode}")

        return SearchResult(
            answer=str(answer).strip(),
            mode=mode,
            requested_mode=mode,
            route=route,
            sources=collect_sources(context),
            context_data=context,
        )`
    },
    {
      id: "fn_drift_with_retry",
      name: "GraphRAGRetriever._drift_with_retry()",
      fileId: "retriever",
      summary: "DRIFT 검색 실패 시 설정한 횟수만큼 재시도하고, 끝내 실패하면 Local Search로 안전하게 폴백",
      how: "DRIFT 내부에서 LLM이 JSON을 생성하는 단계가 있는데 gpt-oss 같은 추론 모델이 간혹 깨진 JSON을 반환합니다. JSON 파싱 오류만 잡아 재시도하고, 다른 오류는 즉시 상위로 전달합니다.",
      terms: ["DRIFTSearch", "LocalSearch", "asyncio", "JSONparsing"],
      lines: [
        { at: "for attempt in range(self.drift_json_retries + 1):", text: "설정값(기본 3)에 1을 더해 '초기 1회 + 재시도 3회' 총 4번 시도합니다. 0으로 설정하면 재시도 없이 한 번만 시도합니다." },
        { at: "if not is_json_parse_error(exc):", text: "JSON 파싱 오류가 아닌 네트워크 오류·API 오류는 재시도 없이 즉시 상위로 전파합니다. JSON 문제만 재시도 대상입니다." },
        { at: "answer, context = await self._local(query)", text: "모든 재시도가 실패하면 Local Search로 폴백합니다. DRIFT보다 품질은 낮지만 서비스가 끊기지 않습니다." },
        { at: "fallback_reason=reason,", text: "폴백 이유를 SearchResult에 담아 화면에 경고로 표시합니다. 사용자가 결과가 예상과 다른 이유를 알 수 있습니다." }
      ],
      code: `    async def _drift_with_retry(self, query: str, route: RouteDecision) -> SearchResult:
        errors: list[str] = []
        for attempt in range(self.drift_json_retries + 1):
            try:
                answer, context = await drift_search(
                    config=self.config,
                    entities=self.frame("entities"),
                    communities=self.frame("communities"),
                    community_reports=self.frame("community_reports"),
                    text_units=self.frame("text_units"),
                    relationships=self.frame("relationships"),
                    community_level=self.community_level,
                    response_type=self.response_type,
                    query=query,
                )
                return SearchResult(
                    answer=str(answer).strip(),
                    mode="drift",
                    requested_mode="drift",
                    route=route,
                    sources=collect_sources(context),
                    context_data=context,
                )
            except Exception as exc:
                if not is_json_parse_error(exc):
                    raise
                errors.append(f"attempt={attempt + 1}: {exc}")

        answer, context = await self._local(query)
        reason = (
            f"DRIFT JSON 파싱 실패가 {len(errors)}회 반복되어"
            f"(초기 1회 + 재시도 {self.drift_json_retries}회) Local Search로 폴백함"
        )
        fallback_route = RouteDecision(
            mode="local",
            confidence=route.confidence,
            reason=f"{route.reason}; {reason}",
            used_llm_fallback=route.used_llm_fallback,
        )
        return SearchResult(
            answer=str(answer).strip(),
            mode="local",
            requested_mode="drift",
            route=fallback_route,
            sources=collect_sources(context),
            context_data=context,
            fallback_reason=reason,
        )`
    },
    {
      id: "fn_frame",
      name: "GraphRAGRetriever.frame()",
      fileId: "retriever",
      summary: "Parquet 파일을 처음 요청할 때만 읽고 이후에는 메모리에서 재사용하는 지연 로딩 캐시",
      how: "self._frames 딕셔너리에 이름으로 캐싱합니다. 같은 Parquet을 여러 검색 모드에서 반복 요청해도 디스크 읽기는 한 번만 일어납니다.",
      terms: ["Parquet", "lazyload"],
      lines: [
        { at: "if name not in self._frames:", text: "이미 로드한 적이 있으면 딕셔너리에서 바로 꺼냅니다. 처음 요청할 때만 디스크에서 읽어 속도를 높입니다." },
        { at: "path = PARQUET_DIR / f\"{name}.parquet\"", text: "이름에 .parquet 확장자를 붙여 경로를 만듭니다. entities, relationships, communities 등 파일 이름이 규칙적입니다." },
        { at: "self._frames[name] = pd.read_parquet(path)", text: "Parquet 파일을 pandas DataFrame으로 읽습니다. GraphRAG API는 이 DataFrame을 직접 입력으로 받습니다." }
      ],
      code: `    def frame(self, name: str) -> pd.DataFrame:
        """Read a required Parquet frame lazily."""

        if name not in self._frames:
            path = PARQUET_DIR / f"{name}.parquet"
            if not path.exists():
                raise RetrievalError(f"필수 Parquet 파일 없음: {path}")
            self._frames[name] = pd.read_parquet(path)
        return self._frames[name]`
    },
    {
      id: "fn_embed_query",
      name: "CodeVectorRetriever.embed_query()",
      fileId: "retriever",
      summary: "사용자 질문을 Ollama qwen3-embedding으로 벡터화해 LanceDB 검색 입력으로 변환",
      how: "인덱싱 때 코드 청크를 임베딩한 모델과 동일한 모델을 써야 같은 벡터 공간에서 유사도 비교가 가능합니다. HTTP POST로 Ollama /api/embeddings를 호출합니다.",
      terms: ["Ollama", "embedding", "LanceDB"],
      lines: [
        { at: "url = f\"{self.ollama_base_url}/api/embeddings\"", text: "Ollama의 임베딩 전용 엔드포인트입니다. /api/generate(텍스트 생성)와 다른 주소입니다." },
        { at: "json={\"model\": self.embedding_model, \"prompt\": query},", text: "임베딩할 텍스트를 prompt 필드에 담습니다. Ollama는 단일 문자열만 받으므로 배치 처리가 아닌 질문 1개씩 보냅니다." },
        { at: "if response.status_code != 200:", text: "HTTP 200이 아니면 Ollama 오류로 판단해 RetrievalError를 발생시킵니다. 에러 메시지에 status code와 응답 앞 200자를 포함해 디버깅을 돕습니다." },
        { at: "embedding = response.json().get(\"embedding\")", text: "응답 JSON에서 embedding 키로 float 목록을 꺼냅니다. 이것이 LanceDB 벡터 검색에 넘길 질문 벡터입니다." }
      ],
      code: `    def embed_query(self, query: str) -> list[float]:
        """Embed a query with Ollama qwen3-embedding."""

        url = f"{self.ollama_base_url}/api/embeddings"
        response = requests.post(
            url,
            json={"model": self.embedding_model, "prompt": query},
            timeout=120,
        )
        if response.status_code != 200:
            raise RetrievalError(
                f"Ollama 임베딩 실패(status={response.status_code}): {response.text[:200]}"
            )
        embedding = response.json().get("embedding")
        if not embedding:
            raise RetrievalError("Ollama 응답에 embedding 필드가 없음")
        return embedding`
    },
    {
      id: "fn_run_async",
      name: "run_async()",
      fileId: "retriever",
      summary: "Streamlit 동기 환경에서 GraphRAG 비동기 API를 실행하기 위해 새 이벤트 루프를 만들어 실행",
      how: "Streamlit은 동기로 실행되지만 GraphRAG API는 async/await를 사용합니다. 이미 실행 중인 루프가 없으면 새 루프를 만들고, 완료 후 미완료 태스크를 정리해 'Task was destroyed but pending' 경고를 방지합니다.",
      terms: ["asyncio", "eventloop"],
      lines: [
        { at: "asyncio.get_running_loop()", text: "이미 실행 중인 이벤트 루프가 있는지 확인합니다. 있으면 RuntimeError가 발생하지 않아 예외 블록을 건너뜁니다. 없으면 예외가 발생해 새 루프를 만드는 블록으로 진입합니다." },
        { at: "loop = asyncio.new_event_loop()", text: "Streamlit은 동기 코드이므로 실행 중인 루프가 없습니다. 여기서 새 루프를 만들어 비동기 GraphRAG API를 실행합니다." },
        { at: "return loop.run_until_complete(coro)", text: "비동기 함수(coro)가 끝날 때까지 루프를 돌립니다. 이 한 줄이 async search_async()의 결과를 동기 코드로 가져오는 핵심입니다." },
        { at: "loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))", text: "메인 태스크가 끝난 뒤 남아 있는 백그라운드 태스크들을 취소하고 기다립니다. 이 정리를 안 하면 루프 종료 시 경고가 대량 출력됩니다." }
      ],
      code: `def run_async(coro: Any) -> Any:
    """Run an async GraphRAG API call from a synchronous Streamlit callback."""

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        loop.set_exception_handler(_loop_exception_handler)
        try:
            asyncio.set_event_loop(loop)
            return loop.run_until_complete(coro)
        finally:
            pending = asyncio.all_tasks(loop)
            for task in pending:
                task.cancel()
            if pending:
                loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
            loop.run_until_complete(loop.shutdown_asyncgens())
            loop.run_until_complete(loop.shutdown_default_executor())
            asyncio.set_event_loop(None)
            loop.close()
    raise RuntimeError("이미 실행 중인 event loop 안에서는 동기 search()를 사용할 수 없음")`
    },
    {
      id: "fn_complete",
      name: "GraphRAGCompletion.complete()",
      fileId: "llm",
      summary: "GraphRAG 내장 LLM factory로 만든 모델에 비스트리밍 completion 요청을 보내고 텍스트를 반환",
      how: "라우터 LLM fallback, 질문 재작성, 코드 답변 생성 세 곳에서 같은 래퍼를 사용합니다. @cached_property로 모델 객체는 한 번만 생성합니다.",
      terms: ["GraphRAGCompletion", "cachedproperty"],
      lines: [
        { at: "temperature: float = 0.0,", text: "기본 temperature를 0으로 설정합니다. 라우팅·재작성은 항상 일관된 결과가 필요하고, 코드 답변도 사실 기반이므로 창의성이 필요 없습니다." },
        { at: "max_tokens: int = 1200,", text: "기본 최대 토큰을 1200으로 설정합니다. 호출할 때 다른 값을 넘기면 덮어쓸 수 있습니다. 라우터 fallback은 250, 질문 재작성은 256으로 제한해 씁니다." },
        { at: "response = self.model.completion(", text: "GraphRAG가 내장한 completion 클라이언트를 호출합니다. OpenAI 호환 API를 사용하므로 Groq 모델에도 그대로 동작합니다." },
        { at: "return gather_completion_response(response).strip()", text: "GraphRAG 내부 헬퍼로 응답 객체에서 텍스트를 꺼내고 앞뒤 공백을 제거합니다. 스트리밍 응답도 이 함수로 통일해 받습니다." }
      ],
      code: `    def complete(
        self,
        messages: str | list[dict[str, str]],
        *,
        temperature: float = 0.0,
        max_tokens: int = 1200,
    ) -> str:
        """Run a non-streaming completion and return text."""

        response = self.model.completion(
            messages=messages,
            temperature=temperature,
            max_completion_tokens=max_tokens,
        )
        return gather_completion_response(response).strip()`
    },
    {
      id: "fn_condense_question",
      name: "condense_question()",
      fileId: "condenser",
      summary: "대화 이력 속 후속 질문을 맥락 없이도 검색 가능한 독립 질문으로 재작성",
      how: "최근 6턴 이력을 텍스트로 만들어 LLM에 넘겨 재작성을 요청합니다. 이력이 2개 미만이거나 LLM 호출이 실패해도 원본 질문을 그대로 반환해 서비스를 유지합니다.",
      terms: ["condense", "GraphRAGCompletion"],
      lines: [
        { at: "if not history or len(history) < 2:", text: "이력이 없거나 1개이면 후속 질문일 수 없습니다. LLM 호출 없이 원본 질문을 그대로 반환해 비용을 아낍니다." },
        { at: "for m in history[-6:]", text: "최근 6턴(3왕복)만 사용합니다. 오래된 이력은 재작성 품질 개선보다 토큰 낭비가 크기 때문입니다." },
        { at: "temperature=0.0,", text: "재작성은 창의적 생성이 아니라 의미 보존이 목적이므로 temperature를 0으로 설정합니다." },
        { at: "except Exception as exc:", text: "LLM 호출 실패, 타임아웃 등 어떤 예외가 생겨도 원본 질문을 반환합니다. 재작성 실패가 전체 검색 실패로 이어지지 않도록 막는 안전장치입니다." }
      ],
      code: `def condense_question(
    question: str,
    history: list[dict[str, str]] | None,
    llm: GraphRAGCompletion | None = None,
) -> str:
    """대화 이력이 있을 때 후속 질문을 독립 질문으로 재작성.

    retrieval 단계에서 타원형 후속 질문("그럼 그건 몇 개야?")이 잘못 임베딩되는 문제를
    LLM 재작성으로 수정함. 실패 시 원본 질문을 그대로 반환해 서비스를 유지함.
    """
    if not history or len(history) < 2:
        return question
    history_text = "\n".join(
        f"{'사용자' if m['role'] == 'user' else '어시스턴트'}: {m['content'][:300]}"
        for m in history[-6:]
    )
    try:
        _llm = llm or GraphRAGCompletion()
        condensed = _llm.complete(
            [
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": f"대화 이력:\n{history_text}\n\n후속 질문: {question}"},
            ],
            temperature=0.0,
            max_tokens=256,
        )
        if condensed:
            logger.info("질문 재작성: '%s' → '%s'", question, condensed)
            return condensed
    except Exception as exc:
        logger.warning("질문 재작성 실패, 원본 사용: %s", exc)
    return question`
    },
    {
      id: "fn_configure_logging",
      name: "configure_logging()",
      fileId: "logging",
      summary: "콘솔과 파일 로그를 설정하고 Streamlit 재실행 시 중복 핸들러를 제거",
      how: "Streamlit은 사용자 입력 때마다 파이썬 스크립트를 처음부터 재실행합니다. 핸들러를 매번 추가하면 같은 로그가 여러 번 출력됩니다. 기존 핸들러를 확인하고 제거한 뒤 새로 추가합니다.",
      terms: ["Streamlit", "logging"],
      lines: [
        { at: "if hasattr(sys.stdout, \"reconfigure\"):", text: "Windows에서 stdout 인코딩이 cp949일 때 한글 로그가 깨집니다. reconfigure()로 utf-8로 바꿉니다. 속성이 없는 환경(일부 CI)은 건너뜁니다." },
        { at: "for handler in list(root_logger.handlers):", text: "현재 등록된 핸들러를 복사본으로 순회합니다. 순회 중에 목록을 수정하면 항목을 건너뛸 수 있으므로 list()로 복사합니다." },
        { at: "if is_retrieve_handler or _is_same_log_file(handler, log_file):", text: "이 앱이 이전 실행에서 등록한 핸들러만 골라 제거합니다. 다른 라이브러리가 등록한 핸들러는 건드리지 않습니다." },
        { at: "for logger_name in (\"httpx\", \"httpcore\", \"openai\"):", text: "GraphRAG 내부에서 사용하는 HTTP 클라이언트 로그가 INFO 수준에서 대량으로 출력됩니다. WARNING으로 격상해 실제 로그가 묻히지 않도록 합니다." }
      ],
      code: `def configure_logging() -> None:
    """콘솔과 파일에 INFO 이상 로그를 남기도록 설정.

    Streamlit은 스크립트를 여러 번 재실행하므로, 이전 검색 로그 핸들러를 제거하고
    새 파일 핸들러를 보장해 로그 누락과 중복 출력을 함께 방지함.
    """
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    log_file = RETRIEVE_LOG_FILE
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s - %(message)s")
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    for handler in list(root_logger.handlers):
        is_retrieve_handler = getattr(handler, _RETRIEVE_HANDLER_ATTR, False)
        if is_retrieve_handler or _is_same_log_file(handler, log_file):
            root_logger.removeHandler(handler)
            handler.close()

    has_stdout_handler = any(
        isinstance(handler, logging.StreamHandler)
        and not isinstance(handler, logging.FileHandler)
        and getattr(handler, "stream", None) is sys.stdout
        for handler in root_logger.handlers
    )
    if not has_stdout_handler:
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setLevel(logging.INFO)
        stream_handler.setFormatter(formatter)
        setattr(stream_handler, _RETRIEVE_HANDLER_ATTR, True)
        root_logger.addHandler(stream_handler)

    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)
    setattr(file_handler, _RETRIEVE_HANDLER_ATTR, True)
    root_logger.addHandler(file_handler)

    for logger_name in ("httpx", "httpcore", "openai"):
        logging.getLogger(logger_name).setLevel(logging.WARNING)`
    }
  ],
  glossary: {
    "GraphRAGConfig":       "Microsoft GraphRAG 설정을 담은 객체. settings.yaml에서 읽어오며 LLM 모델·임베딩·검색 파라미터가 포함됩니다.",
    "dataclass":            "@dataclass 데코레이터 — 클래스의 __init__, __repr__ 등을 자동 생성합니다. 설정처럼 데이터를 담는 클래스에 자주 씁니다.",
    "dotenv":               "python-dotenv 라이브러리. .env 파일의 KEY=VALUE를 읽어 os.environ에 등록합니다. API 키를 코드에 하드코딩하지 않고 파일로 관리할 때 씁니다.",
    "Parquet":              "표 형태 데이터를 컬럼 단위로 압축 저장하는 파일 형식. GraphRAG 인덱싱 결과(엔티티·관계·커뮤니티 등)가 이 형식으로 저장됩니다.",
    "LanceDB":              "벡터와 메타데이터를 함께 저장·검색하는 경량 벡터 DB. 서버 없이 디렉터리만으로 동작합니다.",
    "Ollama":               "PC 로컬에서 LLM이나 임베딩 모델을 실행하는 도구. 여기서는 qwen3-embedding 임베딩 모델을 서빙합니다.",
    "embedding":            "텍스트를 숫자 벡터로 변환하는 과정. 비슷한 의미의 텍스트는 벡터 공간에서 가깝게 배치되어 유사도 검색이 가능합니다.",
    "Streamlit":            "파이썬 코드만으로 웹 앱을 만드는 라이브러리. 사용자 입력마다 스크립트 전체를 재실행하는 방식으로 동작합니다.",
    "asyncio":              "파이썬 표준 비동기 프로그래밍 라이브러리. async/await 키워드와 이벤트 루프로 I/O 대기 중에 다른 작업을 처리합니다.",
    "eventloop":            "비동기 작업을 순차로 스케줄링하는 루프. run_until_complete()로 비동기 함수를 동기 코드처럼 실행할 수 있습니다.",
    "QueryRouter":          "사용자 질문을 보고 5가지 GraphRAG 검색 모드(Basic/Local/Global/DRIFT/Code) 중 하나를 선택하는 클래스.",
    "RouteDecision":        "라우팅 결과를 담는 불변 객체. 선택된 모드, 확신도, 이유, LLM fallback 여부를 포함합니다.",
    "LLMfallback":          "패턴 규칙으로 판단이 불확실할 때 LLM에게 한 번 더 결정을 맡기는 보완 방법. 확신도가 min_confidence 미만일 때 발동합니다.",
    "BasicSearch":          "GraphRAG의 가장 단순한 검색 모드. 원본 텍스트 유닛(청크)을 벡터 검색해 답합니다. 그래프 탐색 없이 빠릅니다.",
    "LocalSearch":          "GraphRAG 검색 모드. 질문과 관련된 엔티티를 찾고 그 주변 관계·텍스트·커뮤니티를 모아 상세하게 답합니다.",
    "GlobalSearch":         "GraphRAG 검색 모드. 커뮤니티 리포트를 집계해 전체 문서의 주요 테마나 흐름을 요약해 답합니다.",
    "DRIFTSearch":          "GraphRAG 검색 모드. Global 관점으로 시작해 관련 엔티티를 따라 Local 심화 탐색을 합니다. JSON 생성 단계가 있어 파싱 오류 가능성이 있습니다.",
    "JSONparsing":          "문자열로 받은 JSON을 파이썬 딕셔너리로 변환하는 과정. LLM 출력이 형식을 벗어나면 파싱 오류가 발생합니다.",
    "SearchResult":         "모든 검색 모드가 공통으로 반환하는 결과 객체. 답변 텍스트, 실제 모드, 요청 모드, 라우팅 정보, 출처 목록을 포함합니다.",
    "condense":             "대화 이력 속 후속 질문을 독립된 완결 질문으로 바꾸는 과정. '그건 왜?' → 'Local Search가 엔티티를 탐색하는 이유는?' 처럼 맥락을 포함시킵니다.",
    "GraphRAGRetriever":    "GraphRAG API 4가지 검색 모드(Basic/Local/Global/DRIFT)를 실행하는 클래스. Parquet 파일을 지연 로딩합니다.",
    "CodeVectorRetriever":  "예제코드 전용 LanceDB 인덱스를 검색하는 클래스. Ollama 임베딩으로 질문을 벡터화해 코드 청크를 찾습니다.",
    "GraphRAGCompletion":   "GraphRAG 내장 LLM 클라이언트 래퍼 클래스. 라우터 fallback, 질문 재작성, 코드 답변 생성에 공통 사용합니다.",
    "cachedproperty":       "@cached_property — 처음 접근할 때만 값을 계산하고 이후에는 캐싱된 값을 반환합니다. LLM 모델 객체처럼 생성 비용이 큰 것에 씁니다.",
    "lazyload":             "필요할 때 처음으로 데이터를 읽는 방법. Parquet 파일은 해당 검색 모드가 선택됐을 때만 로드해 초기 구동 시간을 줄입니다.",
    "logging":              "파이썬 표준 로깅 모듈. INFO/WARNING/ERROR 수준으로 실행 상태를 콘솔과 파일에 기록합니다."
  }
};
