window.EXPLAIN_DATA = {
  meta: { title: "LightRAG GraphRAG 검색 파이프라인", entry: "app.py" },
  files: [
    { id: "app",      label: "app.py",                role: "Streamlit 검색 UI — 사이드바·채팅·출처 표시 진입점" },
    { id: "service",  label: "search_service.py",      role: "라우팅·교재 검색·코드 검색을 하나의 동기 서비스로 묶음" },
    { id: "router",   label: "query_router.py",        role: "질문을 naive/local/global/hybrid/mix/code 모드로 자동 분류" },
    { id: "rag",      label: "lightrag_retriever.py",  role: "LightRAG working_dir 기반 교재 KG+Vector 검색" },
    { id: "code",     label: "code_vector_search.py",  role: "코드 전용 nano-vectordb 검색과 Groq 답변 생성" },
    { id: "llm",      label: "llm_client.py",          role: "Groq LPU LLM 호출 — LightRAG용 비동기 함수와 동기 클라이언트" },
    { id: "embed",    label: "embeddings.py",          role: "Ollama qwen3-embedding 호출 — 동기/비동기 래퍼 제공" },
    { id: "utils",    label: "async_utils.py",         role: "동기 코드에서 비동기 코루틴을 안전하게 실행하는 헬퍼" },
    { id: "models",   label: "models.py",              role: "RouterDecision·Source·SearchResult 데이터 구조 정의" },
    { id: "settings", label: "config/settings.py",    role: "경로·LLM·임베딩·Top-K 전역 설정 관리" }
  ],
  flow: [
    { step: 1, title: "앱 초기화",    label: "앱 초기화", refs: ["fn_get_service"],   summary: "SearchService를 @st.cache_resource로 한 번만 생성",   detail: "Streamlit은 사용자가 질문을 보낼 때마다 스크립트를 재실행합니다. @st.cache_resource를 붙이면 LightRAG 객체·코드 벡터 DB·LLM 클라이언트가 처음 한 번만 만들어지고, 이후 재실행에서는 캐시된 인스턴스를 재사용합니다." },
    { step: 2, title: "모드 선택",    label: "모드 선택", summary: "사이드바에서 auto/naive/local/global/hybrid/mix/code 선택", detail: "auto를 고르면 QueryRouter가 질문 내용을 보고 검색 모드를 자동 결정합니다. 그 외 모드는 사용자 지정 값이 그대로 사용됩니다." },
    { step: 3, title: "쿼리 라우팅",  label: "쿼리 라우팅", refs: ["fn_route", "fn_pattern_route", "fn_llm_route"], summary: "패턴 점수 → 임계값 비교 → LLM fallback 순서로 모드 결정", detail: "키워드 패턴으로 각 모드에 점수를 매깁니다. 최고 점수가 임계값(0.72) 이상이면 확정, 낮으면 Groq LPU few-shot으로 보정합니다. 두 단계 모두 실패하면 hybrid를 기본값으로 씁니다." },
    { step: 4, title: "교재 검색",    label: "교재 검색", refs: ["fn_service_search", "fn_retriever_search", "fn_get_rag", "fn_extract_sources"], summary: "LightRAGRetriever가 QueryParam(mode=...)으로 KG+Vector 쿼리 실행", detail: "store/kg 폴더의 GraphML·KV Store·nano-vectordb를 읽어 답변과 출처(엔티티·관계·청크·레퍼런스)를 반환합니다. Windows 호환을 위해 하나의 영속 이벤트 루프를 재사용합니다." },
    { step: 5, title: "코드 검색",    label: "코드 검색", refs: ["fn_code_search", "fn_format_context"], summary: "CodeVectorSearch가 vdb_code.json에서 유사 코드 청크 탐색", detail: "질문을 임베딩해 코드 전용 벡터 DB에서 코사인 유사도로 가장 가까운 청크를 찾습니다. LightRAG KG를 전혀 거치지 않고 단독으로 동작합니다." },
    { step: 6, title: "결과 표시",    label: "결과 표시", refs: ["fn_render_sources"],          summary: "답변·모드·라우팅 근거·출처를 채팅 UI에 렌더링",          detail: "st.expander 안에 모드, 라우팅 전략, 신뢰도, 소요 시간, 출처 테이블을 보여줍니다. 어떤 근거로 어떤 모드가 선택됐는지 학습자가 직접 확인할 수 있습니다." }
  ],
  functions: [
    {
      id: "fn_get_service",
      name: "get_service()",
      fileId: "app",
      summary: "SearchService를 앱 생애주기 동안 단 한 번만 생성해 재사용",
      how: "@st.cache_resource 덕분에 Streamlit이 스크립트를 재실행할 때마다 LightRAG 객체·코드 DB·LLM 클라이언트를 새로 만드는 비용을 피합니다.",
      terms: ["st_cache_resource", "SearchService"],
      lines: [
        { at: "@st.cache_resource", text: "이 데코레이터가 핵심입니다. Streamlit은 사용자 입력 때마다 전체 스크립트를 재실행하는데, @st.cache_resource가 없으면 LightRAG 인스턴스가 매번 새로 만들어져 수 초의 초기화 지연이 반복됩니다." },
        { at: "return SearchService(settings)", text: "LightRAG 검색기, 코드 벡터 검색기, 라우터, LLM 클라이언트를 모두 포함하는 서비스 객체를 생성합니다. 이 객체 생성이 무거운 작업이므로 캐싱이 중요합니다." }
      ],
      code: `@st.cache_resource
def get_service() -> SearchService:
    """검색 서비스와 LightRAG/nano-vectordb 리소스를 캐싱."""
    settings = Settings()
    configure_logging(settings)
    logger.info("검색 서비스 초기화: log_file=%s", settings.retrieve_log_file)
    return SearchService(settings)`
    },
    {
      id: "fn_build_history",
      name: "build_history()",
      fileId: "app",
      summary: "최근 8개 메시지를 LightRAG 대화 이력 형식으로 변환",
      how: "st.session_state.messages 전체를 넘기면 토큰이 넘칩니다. 최근 8개만 잘라 role/content 딕셔너리로 변환해 LightRAG conversation_history에 전달합니다.",
      terms: ["st_session_state"],
      lines: [
        { at: "for message in st.session_state.messages[-8:]:", text: "대화 이력 전체를 넘기면 컨텍스트 길이 한도를 초과합니다. [-8:]로 최근 8개만 슬라이싱해 토큰 낭비를 막습니다." },
        { at: "if message[\"role\"] in (\"user\", \"assistant\"):", text: "Streamlit이 내부적으로 저장하는 system 역할 메시지 등을 제외하고, LightRAG가 인식하는 user/assistant만 필터링합니다." }
      ],
      code: `def build_history() -> list[dict[str, str]]:
    """LightRAG에 전달할 최근 대화 이력 생성."""
    history = []
    for message in st.session_state.messages[-8:]:
        if message["role"] in ("user", "assistant"):
            history.append({"role": message["role"], "content": message["content"]})
    return history`
    },
    {
      id: "fn_render_sources",
      name: "render_sources()",
      fileId: "app",
      summary: "검색 모드·라우팅 근거·출처 목록을 접이식 패널에 표시",
      how: "st.expander를 사용해 기본으로 접혀 있고, 출처 Source 리스트를 DataFrame으로 변환해 표 형태로 보여줍니다.",
      terms: ["SearchResult", "st_expander"],
      lines: [
        { at: "with st.expander(\"검색 정보\", expanded=False):", text: "기본으로 접혀 있어 답변 가독성을 해치지 않으면서도 클릭 한 번으로 '어떤 모드·근거로 검색했는지'를 확인할 수 있게 합니다." },
        { at: "item[\"content\"] = (item.get(\"content\") or \"\")[:240]", text: "출처 본문 전체를 표에 표시하면 너무 길어집니다. 240자로 잘라 미리보기만 제공합니다." },
        { at: "st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)", text: "출처 목록을 Streamlit 인터랙티브 테이블로 렌더링합니다. hide_index=True로 행 번호를 숨겨 출처 데이터만 깔끔하게 보입니다." }
      ],
      code: `def render_sources(result: SearchResult) -> None:
    """답변 아래에 검색 모드와 출처를 표시."""
    with st.expander("검색 정보", expanded=False):
        st.markdown(
            f"- 모드: \`{result.mode}\`\n"
            f"- 라우팅: \`{result.decision.strategy}\` / confidence \`{result.decision.confidence:.2f}\`\n"
            f"- 근거: {result.decision.reason}\n"
            f"- 시간: \`{result.elapsed_seconds:.2f}s\`"
        )
        if not result.sources:
            st.info("표시할 출처 없음")
            return

        rows = []
        for source in result.sources:
            item = asdict(source)
            item["content"] = (item.get("content") or "")[:240]
            rows.append(item)
        st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)`
    },
    {
      id: "fn_route",
      name: "QueryRouter.route()",
      fileId: "router",
      summary: "수동 모드는 그대로, auto 모드는 패턴 → LLM fallback 2단계로 검색 모드 결정",
      how: "패턴 점수가 임계값(0.72) 미만일 때만 LLM을 호출해 비용과 지연을 최소화합니다.",
      terms: ["RouterDecision", "llm_fallback"],
      lines: [
        { at: "return RouterDecision(selected_mode, 1.0, \"사용자 수동 선택\", \"manual\")", text: "수동 모드는 신뢰도를 1.0(완전 확신)으로 설정합니다. 패턴·LLM 단계를 모두 건너뛰어 불필요한 처리를 피합니다." },
        { at: "if decision.confidence >= self.settings.router_confidence_threshold:", text: "패턴 점수가 임계값(기본 0.72) 이상이면 LLM을 호출하지 않고 즉시 확정합니다. 명확한 질문은 LLM 비용 없이 빠르게 처리됩니다." },
        { at: "return RouterDecision(\"hybrid\", 0.5, \"명확한 패턴 없음, 권장 기본값 사용\", \"default\")", text: "패턴도 LLM도 모두 판단에 실패하면 hybrid를 안전 기본값으로 씁니다. hybrid는 그래프와 벡터를 모두 활용하므로 범용성이 높습니다." }
      ],
      code: `def route(self, question: str, selected_mode: str = "auto") -> RouterDecision:
        """수동 모드는 그대로 사용하고, Auto 모드는 패턴 → LLM fallback 순서로 결정."""
        if selected_mode != "auto":
            if selected_mode not in ALL_MODES:
                raise ValueError(f"지원하지 않는 검색 모드: {selected_mode}")
            return RouterDecision(selected_mode, 1.0, "사용자 수동 선택", "manual")

        decision = self._pattern_route(question)
        if decision.confidence >= self.settings.router_confidence_threshold:
            return decision

        fallback = self._llm_route(question)
        if fallback:
            return fallback

        logger.warning("라우터 fallback 실패, 패턴 결과 사용: %s", decision)
        if decision.confidence > 0:
            return decision
        return RouterDecision("hybrid", 0.5, "명확한 패턴 없음, 권장 기본값 사용", "default")`
    },
    {
      id: "fn_pattern_route",
      name: "QueryRouter._pattern_route()",
      fileId: "router",
      summary: "키워드 패턴 매칭으로 각 검색 모드에 점수를 매겨 최고점 모드 선택",
      how: "정규식(`\\b` 포함)과 단순 부분문자열 매칭을 구분해 처리합니다. 하나라도 매칭되면 해당 모드 점수를 갱신합니다.",
      terms: ["RouterDecision"],
      lines: [
        { at: "scores = {mode: 0.0 for mode in (\"naive\", \"local\", \"global\", \"hybrid\", \"mix\", \"code\")}", text: "모든 모드를 0점에서 시작합니다. 매칭된 패턴이 없는 모드는 0점 그대로 남아 선택되지 않습니다." },
        { at: "self._add_score(q, scores, reasons, \"code\", 0.95, [", text: "코드 관련 키워드(def, class, 함수, 파일 등)가 매칭되면 code 모드에 0.95점을 부여합니다. 점수가 가장 높아 임계값(0.72)을 훌쩍 넘으므로 LLM fallback 없이 즉시 확정됩니다." },
        { at: "self._add_score(q, scores, reasons, \"hybrid\", 0.86, [", text: "비교·관계·trade-off 키워드를 hybrid 모드(0.86점)에 연결합니다. hybrid는 그래프 로컬 검색과 벡터 검색을 함께 사용해 관계 질문에 강합니다." },
        { at: "mode, score = max(scores.items(), key=lambda item: item[1])", text: "모든 모드의 점수 중 최고값을 가진 모드를 선택합니다. 동점이면 dict 선언 순서(naive가 먼저)가 기준이 되지만, 실제로는 패턴이 겹치는 경우가 드뭅니다." }
      ],
      code: `def _pattern_route(self, question: str) -> RouterDecision:
        """키워드와 문장 패턴으로 1차 검색 모드 판단."""
        q = question.lower().strip()
        scores = {mode: 0.0 for mode in ("naive", "local", "global", "hybrid", "mix", "code")}
        reasons: dict[str, list[str]] = {mode: [] for mode in scores}

        self._add_score(q, scores, reasons, "code", 0.95, [
            r"\\.py\\b", r"\\bdef\\b", r"\\bclass\\b", r"\\bimport\\b", "예제코드", "소스", "구현", "streamlit",
            "fastapi", "함수", "클래스", "파일", "코드",
        ])
        self._add_score(q, scores, reasons, "global", 0.82, [
            "전체", "전반", "흐름", "트렌드", "핵심 주제", "큰 그림", "요약", "로드맵", "테마", "동향",
        ])
        self._add_score(q, scores, reasons, "hybrid", 0.86, [
            "차이", "비교", "장단점", "관계", "연계", "적용 시나리오", "언제", "왜", "trade-off", "트레이드오프",
        ])
        self._add_score(q, scores, reasons, "local", 0.78, [
            "무엇", "정의", "구성요소", "원리", "동작 방식", "설명", "란?", "란 무엇", "어떻게 동작",
        ])
        self._add_score(q, scores, reasons, "naive", 0.80, [
            "단순 벡터", "벡터 검색", "키워드 검색", "원문 청크", "기존 rag", "naive",
        ])
        self._add_score(q, scores, reasons, "mix", 0.76, [
            "종합", "관련 패턴", "연결 구조", "그래프와 벡터", "전체 결합", "mix",
        ])

        mode, score = max(scores.items(), key=lambda item: item[1])
        reason = ", ".join(reasons[mode]) if reasons[mode] else "명확한 규칙 매칭 없음"
        return RouterDecision(mode, min(score, 0.95), reason, "pattern")`
    },
    {
      id: "fn_llm_route",
      name: "QueryRouter._llm_route()",
      fileId: "router",
      summary: "패턴 확신도가 낮을 때 Groq LPU few-shot으로 모드를 보정",
      how: "4개의 예시 Q&A를 프롬프트에 포함해 LLM이 JSON({mode, confidence, reason})을 반환하도록 유도합니다. 응답을 파싱하고 유효성을 검사합니다.",
      terms: ["llm_fallback", "RouterDecision", "groq_lpu"],
      lines: [
        { at: "data = self.llm_client.complete_json(system_prompt, user_prompt)", text: "LLM에게 JSON만 반환하도록 지시하고, 응답을 파싱합니다. LLM이 마크다운 코드블록이나 설명을 섞어 반환해도 complete_json이 정규식으로 JSON 부분만 추출합니다." },
        { at: "if mode not in (\"naive\", \"local\", \"global\", \"hybrid\", \"mix\", \"code\"):", text: "LLM이 유효하지 않은 모드명을 반환하면 None을 돌려줍니다. 잘못된 모드로 검색이 실패하는 것보다 패턴 결과나 기본값을 쓰는 것이 안전합니다." },
        { at: "return RouterDecision(mode, max(0.0, min(confidence, 1.0)), reason, \"llm-few-shot\")", text: "LLM이 1.0을 초과하거나 음수 신뢰도를 반환하는 경우를 막기 위해 0.0~1.0으로 클램핑합니다." }
      ],
      code: `def _llm_route(self, question: str) -> RouterDecision | None:
        """Groq LPU Few-shot 프롬프트로 낮은 확신도 질문 라우팅."""
        if self.llm_client is None:
            return None

        system_prompt = (
            "검색 라우터입니다. 질문을 다음 모드 중 하나로 분류하고 JSON만 반환하세요: "
            "naive, local, global, hybrid, mix, code. "
            "code는 예제 Python 코드 검색, local은 구체 개념, global은 넓은 주제, "
            "hybrid는 비교/관계, mix는 그래프+벡터 종합, naive는 단순 청크 벡터 검색입니다."
        )
        user_prompt = f"""
예시:
Q: REST API와 gRPC의 차이와 적용 시나리오는?
{{"mode":"hybrid","confidence":0.90,"reason":"비교와 적용 시나리오 질문"}}
Q: Streamlit 채팅 예제 코드는 어디에 있나?
{{"mode":"code","confidence":0.95,"reason":"예제코드 검색 질문"}}
Q: GraphRAG 전체 흐름을 요약해줘
{{"mode":"global","confidence":0.88,"reason":"전체 흐름 질문"}}
Q: LightRAG의 QueryParam은 무엇인가?
{{"mode":"local","confidence":0.82,"reason":"구체 개념 설명 질문"}}

분류할 질문:
{question}
"""
        try:
            data = self.llm_client.complete_json(system_prompt, user_prompt)
        except Exception as exc:
            logger.warning("LLM 라우터 실패: %s", exc)
            return None

        mode = str(data.get("mode", "")).strip().lower()
        if mode not in ("naive", "local", "global", "hybrid", "mix", "code"):
            return None
        try:
            confidence = float(data.get("confidence", 0.7))
        except (TypeError, ValueError):
            confidence = 0.7
        reason = str(data.get("reason", "LLM Few-shot 라우팅"))
        return RouterDecision(mode, max(0.0, min(confidence, 1.0)), reason, "llm-few-shot")`
    },
    {
      id: "fn_service_search",
      name: "SearchService.search()",
      fileId: "service",
      summary: "라우팅 결과에 따라 교재 검색 또는 코드 검색으로 분기",
      how: "code 모드는 CodeVectorSearch, 나머지 5가지 DOC_MODES는 LightRAGRetriever로 보냅니다. 소요 시간을 perf_counter로 측정합니다.",
      terms: ["SearchResult", "RouterDecision"],
      lines: [
        { at: "started = time.perf_counter()", text: "검색 전체 소요 시간을 측정하기 위해 시작 시각을 기록합니다. time.time()보다 perf_counter()가 정밀도가 높아 밀리초 단위 측정에 적합합니다." },
        { at: "decision = self.router.route(question, selected_mode)", text: "라우터가 어떤 모드를 선택했는지(mode), 무슨 전략으로(strategy), 얼마나 확신하는지(confidence)를 RouterDecision 객체로 돌려줍니다. 이 정보가 UI의 '검색 정보' 패널에 그대로 표시됩니다." },
        { at: "if decision.mode == \"code\":", text: "code 모드는 LightRAG KG를 전혀 거치지 않습니다. 코드 전용 nano-vectordb만 조회하므로 분기 기준이 'code냐 아니냐'로 단순하게 나뉩니다." },
        { at: "result.elapsed_seconds = time.perf_counter() - started", text: "라우팅부터 답변 생성까지 전체 시간을 result에 담아 UI에서 성능을 확인할 수 있게 합니다." }
      ],
      code: `def search(
        self,
        question: str,
        selected_mode: str = "auto",
        top_k: int | None = None,
        chunk_top_k: int | None = None,
        code_top_k: int | None = None,
        history: list[dict[str, str]] | None = None,
    ) -> SearchResult:
        """검색 모드를 결정한 뒤 해당 검색기로 분기."""
        started = time.perf_counter()
        decision = self.router.route(question, selected_mode)
        logger.info(
            "검색 시작: selected_mode=%s, routed_mode=%s, strategy=%s, confidence=%.2f, question=%s",
            selected_mode,
            decision.mode,
            decision.strategy,
            decision.confidence,
            question,
        )

        if decision.mode == "code":
            result = self.code_search.search(question, decision, top_k=code_top_k)
        elif decision.mode in DOC_MODES:
            result = self.lightrag_retriever.search(
                question,
                decision.mode,
                decision,
                top_k=top_k,
                chunk_top_k=chunk_top_k,
                history=history,
            )
        else:
            result = SearchResult(
                question=question,
                answer=f"지원하지 않는 검색 모드임: {decision.mode}",
                mode=decision.mode,
                decision=decision,
                error=f"unsupported mode: {decision.mode}",
            )

        result.elapsed_seconds = time.perf_counter() - started
        if result.error:
            logger.warning(
                "검색 완료(오류): mode=%s, elapsed=%.2fs, error=%s",
                result.mode,
                result.elapsed_seconds,
                result.error,
            )
        else:
            logger.info(
                "검색 완료: mode=%s, sources=%d, elapsed=%.2fs",
                result.mode,
                len(result.sources),
                result.elapsed_seconds,
            )
        return result`
    },
    {
      id: "fn_retriever_init",
      name: "LightRAGRetriever.__init__()",
      fileId: "rag",
      summary: "LightRAG 검색기 초기화 — Windows 호환 영속 이벤트 루프와 직렬화 Lock 생성",
      how: "Windows의 ProactorEventLoop는 스레드 비친화적이라 루프를 새로 만들면 내부 워커가 죽습니다. 루프를 인스턴스 변수에 고정해 재사용합니다.",
      terms: ["asyncio_loop", "threading_lock"],
      lines: [
        { at: "self._loop = asyncio.new_event_loop()", text: "LightRAG 내부 비동기 워커가 묶인 이벤트 루프를 고정합니다. 루프가 바뀌면 워커들이 죽은 루프에 묶여 2번째 쿼리부터 hang이 걸립니다. 이 한 줄이 Windows 환경의 핵심 호환성 처리입니다." },
        { at: "self._lock = threading.Lock()  # 동시 쿼리 직렬화 (ProactorEventLoop 스레드 비친화성 방지)", text: "Streamlit은 멀티스레드로 요청을 처리할 수 있는데, 동시에 두 쿼리가 같은 이벤트 루프에 들어가면 ProactorEventLoop에서 충돌이 납니다. Lock으로 한 번에 하나의 쿼리만 실행하도록 직렬화합니다." }
      ],
      code: `def __init__(self, settings: Settings):
        self.settings = settings
        self._rag: LightRAG | None = None
        # 요청 간 이벤트 루프를 재사용해 LightRAG 워커 풀이 살아있도록 유지
        # (루프가 바뀌면 closure 내 workers가 죽은 루프에 묶여 2번째 쿼리가 hang됨)
        self._loop = asyncio.new_event_loop()
        self._lock = threading.Lock()  # 동시 쿼리 직렬화 (ProactorEventLoop 스레드 비친화성 방지)`
    },
    {
      id: "fn_retriever_search",
      name: "LightRAGRetriever.search()",
      fileId: "rag",
      summary: "LightRAG QueryParam으로 교재 KG+Vector 검색을 실행하고 답변·출처 반환",
      how: "Lock 안에서 영속 루프에 이벤트 루프를 바인딩한 뒤 query_llm()을 호출합니다. 응답에서 llm_response.content와 references·entities 등을 분리합니다.",
      terms: ["QueryParam", "asyncio_loop", "threading_lock"],
      lines: [
        { at: "asyncio.set_event_loop(self._loop)", text: "현재 스레드에 영속 루프를 바인딩합니다. LightRAG 내부의 always_get_an_event_loop()가 이 루프를 재사용하므로, 요청마다 새 루프가 생성되지 않아 워커 풀이 유지됩니다." },
        { at: "param = QueryParam(", text: "mode, top_k, conversation_history 등 검색 옵션을 한 객체에 담아 LightRAG에 전달합니다. response_type='한국어 기술 설명'으로 설정해 한국어 답변을 유도합니다." },
        { at: "raw = rag.query_llm(question, param)", text: "LightRAG가 KG+Vector 검색과 LLM 답변 생성을 한 번에 처리합니다. 결과는 {status, llm_response, data{references, chunks, entities, relationships}} 구조의 딕셔너리입니다." },
        { at: "answer = (raw.get(\"llm_response\") or {}).get(\"content\") or \"\"", text: "llm_response가 None이거나 content가 빈 문자열인 경우를 모두 처리합니다. reasoning 모델은 추론 토큰 초과 시 content가 비어 반환될 수 있어 빈 값 처리가 중요합니다." }
      ],
      code: `def search(
        self,
        question: str,
        mode: str,
        decision: RouterDecision,
        top_k: int | None = None,
        chunk_top_k: int | None = None,
        history: list[dict[str, str]] | None = None,
    ) -> SearchResult:
        """LightRAG 검색 모드로 질문을 실행하고 답변·출처 반환."""
        try:
            with self._lock:
                # 현재 스레드에 영속 루프 바인딩 → always_get_an_event_loop()가 이 루프를 재사용
                asyncio.set_event_loop(self._loop)
                rag = self._get_rag()
                param = QueryParam(
                    mode=mode,
                    response_type="한국어 기술 설명",
                    top_k=top_k or self.settings.top_k,
                    chunk_top_k=chunk_top_k or self.settings.chunk_top_k,
                    max_entity_tokens=self.settings.max_entity_tokens,
                    max_relation_tokens=self.settings.max_relation_tokens,
                    max_total_tokens=self.settings.max_total_tokens,
                    conversation_history=history or [],
                    enable_rerank=False,
                    include_references=True,
                )
                logger.info("LightRAG query_llm 실행: mode=%s, question=%s", mode, question)
                raw = rag.query_llm(question, param)
        except Exception as exc:
            logger.error("LightRAG query 실패: %s", exc, exc_info=True)
            return SearchResult(
                question=question,
                answer=f"검색 중 오류가 발생함: {exc}",
                mode=mode,
                decision=decision,
                error=str(exc),
            )

        if raw.get("status") != "success":
            message = raw.get("message", "검색 결과 없음")
            logger.warning("LightRAG 검색 실패 응답: %s", message)
            return SearchResult(
                question=question,
                answer=f"검색 결과를 찾지 못함. ({message})",
                mode=mode,
                decision=decision,
                raw=raw,
            )

        answer = (raw.get("llm_response") or {}).get("content") or ""
        sources = self._extract_sources(raw)
        if not answer.strip():
            logger.warning("LightRAG 답변 비어 있음")
            answer = "검색 결과는 수집되었지만 답변 생성 결과가 비어 있음."

        return SearchResult(
            question=question,
            answer=answer,
            mode=mode,
            decision=decision,
            sources=sources,
            raw=raw,
        )`
    },
    {
      id: "fn_get_rag",
      name: "LightRAGRetriever._get_rag()",
      fileId: "rag",
      summary: "LightRAG 인스턴스를 지연 생성하고 Windows 안전 초기화 수행",
      how: "처음 검색 시에만 생성하고 이후 재사용합니다. Windows의 multiprocessing spawn 문제를 막기 위해 initialize_share_data(1)을 먼저 호출합니다.",
      terms: ["LightRAG", "initialize_share_data"],
      lines: [
        { at: "initialize_share_data(1)", text: "Windows에서 LightRAG가 내부적으로 멀티프로세싱 Manager를 spawn하면 핸드셰이크 실패로 EOFError가 납니다. workers=1로 미리 초기화하면 이후 호출이 가드에 막혀 Manager spawn이 발생하지 않습니다." },
        { at: "self._loop.run_until_complete(rag.initialize_storages())", text: "영속 루프로 스토리지를 초기화합니다. asyncio.run()을 쓰면 새 루프가 생성되어 이후 query_llm이 다른 루프에서 실행되는 불일치가 생깁니다." }
      ],
      code: `def _get_rag(self) -> LightRAG:
        """LightRAG 인스턴스를 지연 생성하고 스토리지 초기화."""
        if self._rag is not None:
            return self._rag

        self._validate_store()
        asyncio.set_event_loop(self._loop)  # 직접 호출 경로(search_test.py)에서도 루프 보장
        # Windows에서 multiprocessing Manager 생성을 피하기 위해 단일 worker 공유 저장소를 먼저 초기화함
        initialize_share_data(1)
        rag = LightRAG(
            working_dir=str(self.settings.kg_dir),
            llm_model_func=create_lightrag_llm_func(self.settings),
            llm_model_name=self.settings.groq_model,
            llm_model_max_async=self.settings.llm_max_async,
            embedding_func=create_embedding_func(self.settings),
            chunk_token_size=self.settings.chunk_token_size,
            chunk_overlap_token_size=self.settings.chunk_overlap_token_size,
        )
        # self._loop는 search()의 with self._lock 안에서 이미 set_event_loop됨
        self._loop.run_until_complete(rag.initialize_storages())
        self._rag = rag
        return rag`
    },
    {
      id: "fn_extract_sources",
      name: "LightRAGRetriever._extract_sources()",
      fileId: "rag",
      summary: "LightRAG 응답 dict에서 4가지 출처(레퍼런스·청크·엔티티·관계)를 추출해 중복 제거",
      how: "seen 집합으로 (source_type, file_path, label) 삼중키 중복을 제거하고 최대 20개로 제한합니다.",
      terms: ["LightRAG", "Source"],
      lines: [
        { at: "seen: set[tuple[str, str, str]] = set()", text: "같은 파일의 같은 엔티티가 references와 entities 양쪽에 모두 나올 수 있습니다. (type, path, label) 삼중키를 set으로 관리해 중복 출처가 UI에 두 번 표시되는 것을 방지합니다." },
        { at: "if key in seen or not source.file_path:", text: "file_path가 빈 문자열인 출처는 UI에 표시해도 클릭할 경로가 없어 무의미합니다. 중복과 빈 경로를 한 줄에서 동시에 걸러냅니다." },
        { at: "return sources[:20]", text: "출처가 수십 개가 되면 UI 테이블이 너무 길어집니다. 상위 20개만 반환해 가독성과 렌더링 성능을 유지합니다." }
      ],
      code: `@staticmethod
    def _extract_sources(raw: dict[str, Any]) -> list[Source]:
        """LightRAG 구조화 응답에서 출처 목록 추출."""
        data = raw.get("data") or {}
        sources: list[Source] = []
        seen: set[tuple[str, str, str]] = set()

        def add(source: Source) -> None:
            key = (source.source_type, source.file_path, source.label or source.chunk_id)
            if key in seen or not source.file_path:
                return
            seen.add(key)
            sources.append(source)

        for ref in data.get("references", []) or []:
            add(Source("reference", ref.get("file_path", ""), label=str(ref.get("reference_id", ""))))
        for chunk in data.get("chunks", []) or []:
            add(Source(
                "chunk",
                chunk.get("file_path", ""),
                label=str(chunk.get("reference_id", "")),
                content=chunk.get("content", ""),
                chunk_id=chunk.get("chunk_id", ""),
            ))
        for entity in data.get("entities", []) or []:
            add(Source(
                "entity",
                entity.get("file_path", ""),
                label=entity.get("entity_name", ""),
                content=entity.get("description", ""),
            ))
        for rel in data.get("relationships", []) or []:
            add(Source(
                "relationship",
                rel.get("file_path", ""),
                label=f"{rel.get('src_id', '')} -> {rel.get('tgt_id', '')}",
                content=rel.get("description", ""),
            ))
        return sources[:20]`
    },
    {
      id: "fn_code_search",
      name: "CodeVectorSearch.search()",
      fileId: "code",
      summary: "질문 임베딩으로 코드 벡터 DB를 검색하고 Groq LPU로 답변 생성",
      how: "질문을 numpy 벡터로 변환한 뒤 NanoVectorDB.query()로 코사인 유사도 기반 상위 K개 코드 청크를 찾습니다. 찾은 청크를 컨텍스트로 묶어 LLM에 전달합니다.",
      terms: ["nano_vectordb", "groq_lpu", "Source"],
      lines: [
        { at: "vectors = embed_texts([question], self.settings)", text: "질문을 qwen3-embedding으로 4096차원 벡터로 변환합니다. 인덱싱 때와 동일한 임베딩 모델을 써야 벡터 공간이 일치해 유사도 검색이 의미 있습니다." },
        { at: "query_vector = np.asarray(vectors[0], dtype=np.float32)", text: "nano-vectordb는 numpy float32 배열을 입력으로 받습니다. embed_texts가 반환하는 배열에서 첫 번째 벡터(질문 1개)를 꺼내 타입을 맞춥니다." },
        { at: "better_than_threshold=self.settings.code_score_threshold,", text: "코사인 유사도가 임계값(기본 0.15) 미만인 결과는 반환하지 않습니다. 완전히 무관한 코드가 답변에 포함되어 혼란을 주는 것을 막습니다." },
        { at: "context = self._format_context(sources)", text: "검색된 청크들을 [Code 1], [Code 2] 형식의 번호 붙은 블록으로 정리합니다. LLM이 출처를 인용하며 답변하기 쉽도록 구조화된 컨텍스트를 만듭니다." }
      ],
      code: `def search(
        self,
        question: str,
        decision: RouterDecision,
        top_k: int | None = None,
    ) -> SearchResult:
        """질문 임베딩으로 예제코드 벡터 인덱스를 검색하고 Groq LPU로 답변 생성."""
        try:
            db = self._get_db()
            vectors = embed_texts([question], self.settings)
            query_vector = np.asarray(vectors[0], dtype=np.float32)
            results = db.query(
                query_vector,
                top_k=top_k or self.settings.code_top_k,
                better_than_threshold=self.settings.code_score_threshold,
            )
        except Exception as exc:
            logger.error("코드 벡터 검색 실패: %s", exc, exc_info=True)
            return SearchResult(
                question=question,
                answer=f"코드 검색 중 오류가 발생함: {exc}",
                mode="code",
                decision=decision,
                error=str(exc),
            )

        if not results:
            logger.warning("코드 벡터 검색 결과 없음: %s", question)
            return SearchResult(
                question=question,
                answer="예제코드 벡터 인덱스에서 관련 결과를 찾지 못함.",
                mode="code",
                decision=decision,
            )

        sources = [
            Source(
                source_type="code",
                file_path=item.get("file_path", ""),
                label=f"chunk {item.get('chunk_index', '')}",
                score=float(item.get("__metrics__", 0.0)),
                content=item.get("content", ""),
                chunk_id=item.get("__id__", ""),
            )
            for item in results
        ]
        context = self._format_context(sources)
        try:
            answer = self.llm_client.answer_from_context(question, context)
        except Exception as exc:
            logger.error("코드 답변 생성 실패: %s", exc, exc_info=True)
            return SearchResult(
                question=question,
                answer=f"코드 검색은 완료되었지만 답변 생성 중 오류가 발생함: {exc}",
                mode="code",
                decision=decision,
                sources=sources,
                error=str(exc),
            )

        return SearchResult(
            question=question,
            answer=answer,
            mode="code",
            decision=decision,
            sources=sources,
            raw={"results": results},
        )`
    },
    {
      id: "fn_format_context",
      name: "CodeVectorSearch._format_context()",
      fileId: "code",
      summary: "검색된 코드 청크를 총 글자 수를 제한하며 LLM 컨텍스트 문자열로 조립",
      how: "누적 글자 수가 code_context_max_chars를 넘는 순간 루프를 종료합니다. 토큰 초과 없이 LLM에 보낼 수 있는 최대한의 코드를 담습니다.",
      terms: ["groq_lpu"],
      lines: [
        { at: "total_chars = 0", text: "LLM 컨텍스트 길이를 토큰이 아닌 문자 수로 관리합니다. 정확한 토큰 계산 없이도 입력 한도 초과를 예방할 수 있는 실용적인 접근입니다." },
        { at: "if total_chars + len(block) > self.settings.code_context_max_chars:", text: "이 청크를 추가하면 한도를 넘는다면 즉시 중단합니다. 이미 추가된 청크들만 LLM에 전달되어 중간이 잘리는 일 없이 온전한 블록만 포함됩니다." }
      ],
      code: `def _format_context(self, sources: list[Source]) -> str:
        """검색된 코드 청크를 LLM 입력 컨텍스트 문자열로 변환."""
        blocks: list[str] = []
        total_chars = 0
        for idx, source in enumerate(sources, start=1):
            content = source.content.strip()
            block = (
                f"[Code {idx}]\\n"
                f"file_path: {source.file_path}\\n"
                f"chunk: {source.label}\\n"
                f"score: {source.score:.4f}\\n"
                f"content:\\n{content}\\n"
            )
            if total_chars + len(block) > self.settings.code_context_max_chars:
                break
            blocks.append(block)
            total_chars += len(block)
        return "\\n---\\n".join(blocks)`
    },
    {
      id: "fn_create_lightrag_llm_func",
      name: "create_lightrag_llm_func()",
      fileId: "llm",
      summary: "LightRAG query 내부에서 호출할 Groq LPU 비동기 LLM 함수 생성",
      how: "클로저 패턴으로 settings를 캡처합니다. reasoning_effort='low'를 기본으로 설정해 추론 토큰 과다로 content가 빈 채로 반환되는 문제를 방지합니다.",
      terms: ["LightRAG", "groq_lpu", "reasoning_effort"],
      lines: [
        { at: "kwargs.setdefault(\"reasoning_effort\", \"low\")", text: "추론 노력을 낮게 고정합니다. gpt-oss 같은 reasoning 모델은 추론 토큰이 max_completion_tokens를 다 써버리면 실제 답변(content)이 비어 LightRAG가 'empty content' 오류를 냅니다. setdefault로 호출부에서 명시적으로 지정하면 우선 적용됩니다." },
        { at: "kwargs.setdefault(\"max_completion_tokens\", settings.groq_max_tokens)", text: "응답 토큰 한도를 충분히 확보합니다. reasoning_effort='low'와 함께 설정해야 추론에 소비되지 않은 토큰이 실제 답변에 쓰입니다." },
        { at: "return await openai_complete_if_cache(", text: "LightRAG가 제공하는 캐시 지원 OpenAI 호환 래퍼를 호출합니다. 동일 프롬프트가 반복되면 캐시에서 즉시 반환해 API 비용을 절약합니다." }
      ],
      code: `def create_lightrag_llm_func(settings: Settings):
    """LightRAG query가 사용할 Groq OpenAI 호환 LLM 함수 생성."""
    async def llm_model_func(
        prompt,
        system_prompt=None,
        history_messages=None,
        keyword_extraction=False,
        **kwargs,
    ) -> str:
        """LightRAG 내부 LLM 호출을 Groq LPU로 전달."""
        kwargs.setdefault("reasoning_effort", "low")
        kwargs.setdefault("max_completion_tokens", settings.groq_max_tokens)
        return await openai_complete_if_cache(
            settings.groq_model,
            prompt,
            system_prompt=system_prompt,
            history_messages=history_messages or [],
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
            **kwargs,
        )

    return llm_model_func`
    },
    {
      id: "fn_complete_json",
      name: "GroqChatClient.complete_json()",
      fileId: "llm",
      summary: "LLM 응답 텍스트에서 JSON만 추출해 파싱 — 마크다운 코드블록도 처리",
      how: "먼저 전체 응답을 json.loads()로 파싱하고, 실패하면 정규식으로 {...} 부분만 추출해 재시도합니다.",
      terms: ["groq_lpu"],
      lines: [
        { at: "text = self.complete(system_prompt, user_prompt, max_tokens=256)", text: "라우터 JSON 응답은 작으므로 256토큰으로 제한합니다. 토큰을 낭비하지 않으면서도 {mode, confidence, reason} 구조를 담기에 충분합니다." },
        { at: "match = re.search(r\"\\{.*\\}\", text, flags=re.DOTALL)", text: "LLM이 ```json\\n{...}\\n``` 형식으로 감싸거나 앞뒤에 설명 텍스트를 붙이는 경우가 많습니다. DOTALL 플래그로 여러 줄에 걸친 JSON 블록도 추출합니다." }
      ],
      code: `def complete_json(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        """LLM 응답에서 JSON 객체를 추출해 dict로 반환."""
        text = self.complete(system_prompt, user_prompt, max_tokens=256)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r"\\{.*\\}", text, flags=re.DOTALL)
            if not match:
                logger.warning("JSON 추출 실패: %s", text[:300])
                return {}
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                logger.warning("JSON 파싱 실패: %s", match.group(0)[:300])
                return {}`
    },
    {
      id: "fn_create_embedding_func",
      name: "create_embedding_func()",
      fileId: "embed",
      summary: "LightRAG가 요구하는 EmbeddingFunc 래퍼를 생성해 동일한 Ollama 임베딩 함수 연결",
      how: "EmbeddingFunc는 임베딩 차원(4096)과 최대 토큰 크기를 함께 선언하므로, LightRAG가 벡터 저장소 크기를 사전에 알 수 있습니다.",
      terms: ["EmbeddingFunc", "ollama"],
      lines: [
        { at: "_RAW_OLLAMA_EMBED = getattr(ollama_embed, \"func\", ollama_embed)", text: "LightRAG의 ollama_embed 데코레이터가 차원을 1024로 강제하는 경우가 있습니다. .func 속성으로 원본 함수를 꺼내 그 제약을 우회하고, 설정의 embedding_dim(4096)을 그대로 사용합니다." },
        { at: "return EmbeddingFunc(", text: "embedding_dim과 max_token_size를 함께 전달해야 LightRAG가 벡터 저장소의 크기를 미리 알고 올바른 인덱스를 생성합니다. 함수만 넘기면 차원 정보가 빠져 오류가 납니다." }
      ],
      code: `# LightRAG의 ollama_embed 래퍼에는 기본 1024차원 메타데이터가 있으므로 원본 함수에 접근함
_RAW_OLLAMA_EMBED = getattr(ollama_embed, "func", ollama_embed)


def create_embedding_func(settings: Settings) -> EmbeddingFunc:
    """LightRAG가 요구하는 EmbeddingFunc 래퍼 생성."""
    async def _embed(texts: list[str]):
        """LightRAG 내부 비동기 호출용 임베딩 함수."""
        return await ollama_embedding(texts, settings)

    return EmbeddingFunc(
        embedding_dim=settings.embedding_dim,
        max_token_size=settings.embedding_max_token_size,
        func=_embed,
    )`
    },
    {
      id: "fn_run_async",
      name: "run_async()",
      fileId: "utils",
      summary: "동기 코드에서 비동기 코루틴을 안전하게 실행 — 중첩 루프 문제 해결",
      how: "이미 이벤트 루프가 돌고 있으면(Jupyter·테스트 환경) 별도 스레드에서 asyncio.run()을 실행해 중첩을 피합니다.",
      terms: ["asyncio_loop", "ThreadPoolExecutor"],
      lines: [
        { at: "loop = asyncio.get_running_loop()", text: "현재 스레드에 이미 돌고 있는 이벤트 루프가 있는지 확인합니다. RuntimeError가 나면 루프가 없다는 뜻이므로 asyncio.run()으로 직접 실행합니다." },
        { at: "return asyncio.run(coro)", text: "Streamlit 일반 실행 경로에서는 이벤트 루프가 없으므로 여기서 종료됩니다. asyncio.run()이 새 루프를 만들고 코루틴을 실행한 뒤 루프를 닫습니다." },
        { at: "return executor.submit(lambda: asyncio.run(coro)).result()", text: "이미 루프가 돌고 있을 때(Jupyter Notebook 등) 같은 루프에서 또 코루틴을 실행하면 'This event loop is already running' 오류가 납니다. 새 스레드에서 독립적인 루프를 생성해 중첩을 피합니다." }
      ],
      code: `def run_async(coro: Coroutine[Any, Any, Any]) -> Any:
    """코루틴을 동기 코드에서 실행하고 결과 반환.

    Streamlit은 보통 실행 중인 이벤트 루프가 없지만, 노트북·테스트 환경에서 이미 루프가 돌 수 있음.
    이 경우 별도 스레드에서 \`asyncio.run()\`을 수행해 중첩 이벤트 루프 오류를 피함.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)

    if loop.is_running():
        with ThreadPoolExecutor(max_workers=1) as executor:
            return executor.submit(lambda: asyncio.run(coro)).result()
    return loop.run_until_complete(coro)`
    },
    {
      id: "fn_search_result",
      name: "SearchResult",
      fileId: "models",
      summary: "교재 검색과 코드 검색의 결과를 하나의 형식으로 통일해 UI가 분기 없이 렌더링",
      how: "code 모드와 KG 5가지 모드가 서로 다른 검색기를 쓰지만, 둘 다 SearchResult를 반환해 render_sources()가 동일한 코드로 처리합니다. ok 프로퍼티는 error 필드에서 성공 여부를 파생합니다.",
      terms: ["RouterDecision", "Source"],
      lines: [
        { at: "sources: list[Source] = field(default_factory=list)", text: "기본값을 []로 설정할 때 field(default_factory=list)를 씁니다. sources=[]처럼 가변 기본값을 직접 쓰면 모든 인스턴스가 같은 리스트를 공유하는 버그가 생깁니다." },
        { at: "elapsed_seconds: float = 0.0", text: "SearchService가 검색 완료 후 이 필드를 채웁니다. 초기값을 0.0으로 두어 오류 반환 경로에서도 필드가 항상 존재하게 합니다." },
        { at: "return not self.error", text: "error 문자열이 비어 있으면 True, 오류 메시지가 있으면 False입니다. 호출부가 if result.ok:로 성공 여부를 간결하게 확인할 수 있습니다." }
      ],
      code: `@dataclass
class SearchResult:
    """검색과 답변 생성을 마친 최종 결과."""

    question: str
    answer: str
    mode: str
    decision: RouterDecision
    sources: list[Source] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)
    error: str = ""
    elapsed_seconds: float = 0.0

    @property
    def ok(self) -> bool:
        """검색이 오류 없이 완료되었는지 여부 반환."""
        return not self.error`
    },
    {
      id: "fn_settings_post_init",
      name: "Settings.__post_init__()",
      fileId: "settings",
      summary: ".env 파일을 단계적으로 로드하고 환경변수로 기본값을 오버라이드",
      how: "먼저 공용 hands-on/.env, 그 다음 로컬 retrieve/.env를 로드합니다. 로컬 설정이 공용 설정을 덮어쓰도록 우선순위를 설계했습니다.",
      terms: ["dotenv", "dataclass"],
      lines: [
        { at: "if self.hands_on_env.exists():", text: "GROQ_API_KEY 같은 민감 정보를 코드에 하드코딩하지 않고 .env 파일로 관리합니다. 파일이 없어도 오류 없이 넘어가 설치 직후 환경에서도 동작합니다." },
        { at: "load_dotenv(local_env, override=True)", text: "로컬 .env는 override=True로 로드합니다. 공용 .env로 설정한 모델명을 retrieve/.env에서 실험용으로 바꾸는 것처럼, 하위 .env가 상위를 덮어쓸 수 있습니다." },
        { at: "self.router_confidence_threshold = _env_float(", text: "임계값을 환경변수로 조정할 수 있습니다. 코드 변경 없이 ROUTER_CONFIDENCE_THRESHOLD=0.8으로 설정하면 라우터가 더 엄격하게 패턴을 요구합니다." }
      ],
      code: `def __post_init__(self) -> None:
        """공용 .env와 로컬 .env를 로드한 뒤 환경변수로 기본값 오버라이드."""
        # hands-on/.env에서 GROQ_API_KEY 등 민감 정보를 로드함
        if self.hands_on_env.exists():
            load_dotenv(self.hands_on_env)

        local_env = self.retrieve_dir / ".env"
        if local_env.exists():
            load_dotenv(local_env, override=True)

        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", self.ollama_base_url)
        self.embedding_model = os.getenv("EMBEDDING_MODEL", self.embedding_model)
        self.groq_api_key = os.getenv("GROQ_API_KEY", self.groq_api_key)
        self.groq_base_url = os.getenv("GROQ_BASE_URL", self.groq_base_url)
        self.groq_model = os.getenv("GROQ_MODEL", self.groq_model)

        self.groq_timeout = _env_int("GROQ_TIMEOUT", self.groq_timeout)
        self.groq_max_retries = _env_int("GROQ_MAX_RETRIES", self.groq_max_retries)
        self.groq_max_tokens = _env_int("GROQ_MAX_TOKENS", self.groq_max_tokens)
        self.top_k = _env_int("LIGHTRAG_TOP_K", self.top_k)
        self.chunk_top_k = _env_int("LIGHTRAG_CHUNK_TOP_K", self.chunk_top_k)
        self.code_top_k = _env_int("CODE_TOP_K", self.code_top_k)
        self.code_score_threshold = _env_float("CODE_SCORE_THRESHOLD", self.code_score_threshold)
        self.router_confidence_threshold = _env_float(
            "ROUTER_CONFIDENCE_THRESHOLD", self.router_confidence_threshold
        )

        self.log_dir.mkdir(parents=True, exist_ok=True)`
    }
  ],
  glossary: {
    "LightRAG":            "가벼운 파일 기반 GraphRAG 구현체. GraphML KG, nano-vectordb, KV Store를 함께 사용해 교재를 지식 그래프로 변환하고 검색합니다.",
    "SearchResult":        "검색 완료 후 UI에 전달되는 공통 결과 객체. 답변, 출처 목록, 라우팅 결정, 오류, 소요 시간을 한 곳에 담습니다.",
    "RouterDecision":      "QueryRouter가 선택한 검색 모드와 판단 근거를 담는 값 객체. mode, confidence, reason, strategy 필드를 가집니다.",
    "Source":              "검색에 사용된 출처 하나를 표현하는 데이터 구조. 출처 유형(reference/chunk/entity/relationship/code), 파일 경로, 본문 일부를 포함합니다.",
    "QueryParam":          "LightRAG query()에 전달하는 검색 설정 객체. mode, top_k, conversation_history, include_references 등을 담습니다.",
    "groq_lpu":            "Groq사의 LPU(Language Processing Unit) 기반 LLM API. OpenAI 호환 엔드포인트를 제공해 OpenAI SDK로 그대로 호출할 수 있습니다.",
    "reasoning_effort":    "추론형 LLM 모델의 추론량을 제어하는 파라미터. 'low'로 낮추면 추론 토큰 소비를 줄여 실제 답변(content)이 빈 채로 반환되는 문제를 방지합니다.",
    "nano_vectordb":       "JSON 단일 파일 기반 초경량 벡터 DB. NanoVectorDB 클래스로 upsert·query를 수행하며 별도 서버 없이 동작합니다.",
    "asyncio_loop":        "Python 비동기 이벤트 루프. asyncio.new_event_loop()로 생성하면 기존 루프와 독립적으로 동작해 Windows ProactorEventLoop 충돌을 피할 수 있습니다.",
    "threading_lock":      "threading.Lock() — 한 번에 하나의 스레드만 임계 구역을 실행하도록 보장합니다. 멀티스레드 Streamlit 환경에서 LightRAG 쿼리를 직렬화할 때 사용합니다.",
    "initialize_share_data": "LightRAG 내부 공유 스토리지를 초기화하는 함수. workers=1로 호출하면 멀티프로세싱 없이 asyncio 락만 사용하므로 Windows EOFError를 방지합니다.",
    "llm_fallback":        "패턴 점수가 임계값 미만일 때 LLM에게 모드 선택을 맡기는 2단계 보정 방식. 패턴이 모호한 질문도 사람이 읽을 수 있는 이유와 함께 모드를 결정합니다.",
    "ollama":              "로컬에서 LLM과 임베딩 모델을 실행하는 도구. 이 파이프라인에서는 qwen3-embedding 4096차원 임베딩 모델을 제공합니다.",
    "EmbeddingFunc":       "LightRAG가 요구하는 임베딩 함수 래퍼. embedding_dim과 max_token_size를 함께 선언해야 LightRAG가 벡터 저장소 크기를 사전에 알고 올바른 인덱스를 생성합니다.",
    "dotenv":              "python-dotenv 라이브러리. .env 파일의 KEY=VALUE를 읽어 os.environ에 등록합니다. API 키를 코드에 하드코딩하지 않고 파일로 관리할 때 씁니다.",
    "dataclass":           "@dataclass 데코레이터. 클래스의 __init__, __repr__ 등을 자동 생성합니다. Settings처럼 설정 데이터를 구조화하고 타입 힌트와 함께 관리할 때 씁니다.",
    "st_cache_resource":   "@st.cache_resource — Streamlit이 스크립트를 재실행할 때도 반환 객체를 캐싱합니다. LightRAG처럼 초기화 비용이 큰 리소스에 사용합니다.",
    "st_session_state":    "Streamlit 앱이 재실행되어도 브라우저 탭 안에서 유지되는 임시 저장소. 채팅 메시지 이력을 저장하는 데 사용합니다.",
    "st_expander":         "st.expander() — 기본으로 접혀 있다가 클릭하면 펼쳐지는 Streamlit UI 컴포넌트. 부가 정보를 숨겨 두고 필요할 때만 보이게 합니다.",
    "SearchService":       "라우팅·LightRAG 검색·코드 벡터 검색을 하나로 묶은 동기 서비스 클래스. Streamlit UI에서 단일 .search() 호출로 전체 파이프라인을 실행합니다.",
    "ThreadPoolExecutor":  "concurrent.futures의 스레드 풀 실행기. 이미 이벤트 루프가 돌고 있는 환경에서 별도 스레드에 asyncio.run()을 위임해 중첩 루프 오류를 피할 때 사용합니다."
  }
};
