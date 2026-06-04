window.EXPLAIN_DATA = {
  meta: {
    title: "Agentic AI 학습지원 MAS 챗봇 — LangGraph SAS 멀티에이전트",
    entry: "app.py",
  },

  // 좌측 그룹 = 파일 (메인 진입점 → 그래프 → 에이전트 → LLM → 유틸 → 설정)
  files: [
    { id: "app",       label: "app.py",                  role: "Streamlit 채팅 UI (실행 진입점) — 질문 입력 → 그래프 실행 → 답변·관측정보 표시" },
    { id: "main",      label: "main.py",                 role: "CLI 실행 진입점 — 명령행에서 질문 하나로 빠르게 테스트" },
    { id: "workflow",  label: "graph/workflow.py",       role: "StateGraph 노드·엣지 배선/컴파일 (SAS 흐름을 그래프로 표현)" },
    { id: "state",     label: "graph/state.py",          role: "공유 State(AgentState) 정의 — 노드 간 협업은 이 한 곳으로만" },
    { id: "nodes",     label: "graph/nodes.py",          role: "노드 함수(Agent/Supervisor 실행 단위) + 품질 채점 + 분기 판단" },
    { id: "router",    label: "agents/router.py",        role: "Scheduler: 질문을 code/qa로 분류 (키워드 → LLM 2단계)" },
    { id: "rag",       label: "agents/rag_agent.py",     role: "LanceDB 벡터검색 + Parquet 본문 조인 (KG 엔티티 + Vector 교재)" },
    { id: "web",       label: "agents/web_agent.py",     role: "DuckDuckGo 검색 + BeautifulSoup 본문 크롤링" },
    { id: "youtube",   label: "agents/youtube_agent.py", role: "scrapetube 검색 + youtube-transcript-api 자막 추출·청킹" },
    { id: "code",      label: "agents/code_agent.py",    role: "예제코드 참고 Python 코드 생성 + ast.parse 구문 검증·재생성" },
    { id: "llm",       label: "llm/ollama_llm.py",       role: "Ollama qwen3:8b 호출 (thinking 비활성화 + <think> 제거)" },
    { id: "embed",     label: "llm/ollama_embeddings.py",role: "Ollama qwen3-embedding 쿼리 임베딩 (4096차원)" },
    { id: "helpers",   label: "utils/helpers.py",        role: "쿼리 재작성·출처 포맷·질문-답변 관련성 점수(휴리스틱)" },
    { id: "filesaver", label: "utils/file_saver.py",     role: "생성 코드 파일 저장 (output/ 타임스탬프 파일명)" },
    { id: "logger",    label: "utils/logger.py",         role: "파일+콘솔 동시 로거 (실행마다 새 로그 파일)" },
    { id: "settings",  label: "config/settings.py",      role: "전역 설정 — 경로·LLM·검색·Supervisor 기준·라우팅 상수" },
  ],

  // 전체 처리 흐름 (실행 진입 → 분류 → 검색 → 생성/응답 → 평가 → 표시)
  flow: [
    {
      step: 1,
      title: "앱 시작 & 그래프 1회 컴파일",
      label: "그래프 컴파일",
      refs: ["get_app", "compile_workflow", "create_initial_state"],
      summary: "app.py: @st.cache_resource로 LangGraph 워크플로를 한 번만 컴파일해 캐싱함",
      detail: "Streamlit 앱이 열리면 get_app()이 compile_workflow()를 호출해 노드·엣지로 짜인 그래프를 1회 컴파일하고 캐싱합니다. 사용자가 채팅창에 질문을 입력하면 create_initial_state()로 '빈 메모지'(공유 State)를 만들어 그래프에 넣습니다. 이 메모지가 모든 단계를 거치며 채워집니다.",
    },
    {
      step: 2,
      title: "질문 분류 (Router = Scheduler)",
      label: "질문 분류",
      refs: ["router_node", "classify_question"],
      summary: "router_node → Router.classify_question(): 질문을 code(코드 작성) / qa(질의응답)로 나눔",
      detail: "맨 먼저 '이 질문이 코드를 만들어 달라는 건가, 설명을 원하는 건가?'를 판단합니다. 1단계로 빠른 키워드 점수(예: '코드 작성' → code, '뭐야' → qa)를 보고, 애매하면 2단계로 LLM에게 의미를 물어봅니다. SAS 패턴에서 작업을 어디로 보낼지 정하는 Scheduler 역할입니다.",
    },
    {
      step: 3,
      title: "RAG 검색 (KG + Vector DB)",
      label: "RAG 검색",
      refs: ["rag_node", "search_textbook", "search_entities", "search_code"],
      summary: "rag_node → 교재 텍스트(Vector) + KG 엔티티 검색, 코드 질문이면 예제코드 검색",
      detail: "질문을 qwen3-embedding으로 4096차원 숫자 벡터로 바꾼 뒤, 기존 GraphRAG 산출물(LanceDB)에서 의미가 가까운 조각을 찾습니다. 교재 질문은 '교재 청크(Vector)'와 '지식그래프 엔티티(KG)'를 함께 검색하고, 코드 질문은 '예제코드 청크'를 검색합니다. 무거운 GraphRAG API 대신 벡터검색을 직접 써서 로컬에서도 빠릅니다.",
    },
    {
      step: 4,
      title: "코드 경로 — 생성 & 구문 검증",
      label: "코드 생성·검증",
      refs: ["code_generation_node", "generate_with_retry"],
      summary: "code_generation_node → CodeAgent.generate_with_retry(): 코드 생성 후 ast.parse로 검증·재생성",
      detail: "코드 질문이면 RAG로 찾은 예제를 참고해 LLM이 Python 코드를 작성합니다. 작성된 코드를 실행하지 않고 ast.parse로 '문법이 맞는지'만 안전하게 검사하고, 틀리면 오류 메시지를 다시 알려줘 최대 2회까지 고쳐 씁니다. 문법이 통과한 코드는 output/ 폴더에 파일로 저장합니다.",
    },
    {
      step: 5,
      title: "Q&A 경로 — 웹·YouTube 검색",
      label: "웹·YouTube 검색",
      refs: ["web_search", "youtube_search"],
      summary: "web_node → youtube_node: DuckDuckGo 본문 크롤링 + YouTube 자막 추출",
      detail: "설명 질문이면 교재(RAG)에 더해 최신 정보를 웹에서, 강의/튜토리얼을 YouTube에서 보강합니다. 네트워크 실패·봇 차단·자막 없음은 자주 일어나므로, 각 검색 에이전트는 오류를 '삼켜서' 빈 결과를 돌려줍니다. 덕분에 한 소스가 실패해도 전체 흐름이 멈추지 않습니다(장애 격리).",
    },
    {
      step: 6,
      title: "Q&A 경로 — 종합 답변 생성",
      label: "종합 답변 생성",
      refs: ["qa_response_node", "format_sources"],
      summary: "qa_response_node: 교재+웹+YouTube를 가중치와 함께 묶어 한국어 답변 + 출처 작성",
      detail: "세 소스의 내용을 하나의 프롬프트로 합치되 교재(RAG)에 가장 큰 가중치(0.7)를 둡니다. LLM이 이를 종합해 답변을 쓰고, 맨 아래에 어디서 가져왔는지(출처)를 붙입니다. 교재만으로도 답변이 나오도록 설계되어 있습니다.",
    },
    {
      step: 7,
      title: "Supervisor 품질 평가 (0.75 기준)",
      label: "품질 평가",
      refs: ["supervisor_node", "evaluate_code", "evaluate_qa"],
      summary: "supervisor_node: 결과를 4개 항목(각 0.25)으로 0~1점 채점하고 통과/재시도/폴백 판단",
      detail: "만들어진 답변·코드가 충분한 품질인지 Supervisor가 채점합니다. 코드는 '문법/키워드 반영/RAG 참조/구조'를, Q&A는 '길이/소스/출처표기/관련성'을 봅니다. 0.75 이상이면 통과, 미만이면 재시도 전략을 정합니다. AI 결과를 사람 대신 다시 검사하는 품질 게이트입니다.",
    },
    {
      step: 8,
      title: "재시도 또는 폴백 (Loop Guard)",
      label: "재시도·폴백",
      refs: ["should_continue", "retry_node", "fallback_node"],
      summary: "should_continue → retry_node(쿼리 재작성/가중치 조정) 다시 RAG로 / 한도 초과 시 fallback",
      detail: "통과 못 하면 should_continue가 결정합니다. 재시도 여유가 있으면 쿼리를 더 명확히 다시 쓰거나 웹/유튜브 비중을 올려 RAG부터 다시 돕니다. 단, 최대 2회까지만(max_retries=2 = Loop Guard, 무한루프 방지). 그래도 안 되면 LLM 단독으로라도 최선의 답을 내는 폴백으로 끝냅니다(Graceful Degradation).",
    },
    {
      step: 9,
      title: "최종 응답 표시",
      label: "최종 응답 표시",
      refs: ["final_response_node", "app_main"],
      summary: "final_response_node / app.py: 답변 본문 + 유형·품질 점수·재시도 횟수를 화면에 표시",
      detail: "코드 유형은 final_response_node가 코드와 저장 위치를 보기 좋게 포맷합니다. app.py는 답변을 채팅 말풍선에 그리고, 그 아래에 '유형·품질 점수·통과 여부·재시도 횟수' 같은 Supervisor 관측 정보를 함께 보여줘 내부 동작을 투명하게 드러냅니다.",
    },
  ],

  functions: [
    // ───────────────────────── app.py ─────────────────────────
    {
      id: "get_app",
      name: "get_app()",
      fileId: "app",
      summary: "컴파일된 LangGraph 워크플로를 한 번만 만들어 캐싱하는 함수",
      how: "그래프 컴파일은 노드·엣지를 연결하는 비용이 드는 작업입니다. @st.cache_resource를 붙이면 앱이 살아 있는 동안 단 한 번만 실행되고, 이후 호출은 만들어 둔 그래프를 즉시 돌려줍니다. Streamlit은 입력마다 스크립트 전체를 다시 실행하므로 이 캐싱이 없으면 매번 새로 컴파일하게 됩니다.",
      terms: ["@st.cache_resource", "Streamlit", "LangGraph", "컴파일(compile)"],
      lines: [
        { at: "@st.cache_resource", text: "이 표시(데코레이터)를 붙이면 아래 함수가 앱 실행 중 한 번만 수행되고 결과가 저장(캐싱)됩니다." },
        { at: "return compile_workflow()", text: "노드·엣지로 구성된 그래프를 실행 가능한 형태로 컴파일해 돌려줍니다. (workflow.py에 정의)" },
      ],
      code: `@st.cache_resource
def get_app():
    """컴파일된 LangGraph 워크플로를 캐싱하여 반환함."""
    return compile_workflow()`,
    },
    {
      id: "render_sidebar",
      name: "render_sidebar()",
      fileId: "app",
      summary: "사이드바에 시스템 정보와 Ollama 연결 상태, 예시 질의를 표시하는 함수",
      how: "화면 왼쪽 사이드바에 어떤 모델·DB·패턴을 쓰는지 안내하고, Ollama 서버가 켜져 있는지 즉석에서 확인해 초록/빨강으로 알려줍니다. 미리 점검해 두면 '왜 답이 안 나오지?' 같은 혼란을 줄일 수 있습니다.",
      terms: ["Ollama", "SAS 패턴", "GraphRAG"],
      lines: [
        { at: "with st.sidebar:", text: "이 블록 안에서 그리는 요소들은 모두 화면 왼쪽 사이드바에 배치됩니다." },
        { at: "if OllamaLLM().is_available():", text: "Ollama 서버에 접속이 되는지 확인합니다. 되면 성공 메시지, 안 되면 오류 메시지를 띄웁니다." },
        { at: 'st.code(', text: "복사하기 좋은 코드/텍스트 박스로 예시 질의 4개를 보여줍니다." },
      ],
      code: `def render_sidebar() -> None:
    """사이드바에 시스템 정보와 Ollama 연결 상태를 표시함."""
    with st.sidebar:
        st.header("⚙️ 시스템 정보")
        st.markdown(
            "- **LLM**: qwen3:8b (Ollama)\\n"
            "- **임베딩**: qwen3-embedding (4096)\\n"
            "- **KG+Vector**: MS GraphRAG store\\n"
            "- **패턴**: SAS (LangGraph)\\n"
            "- **소스**: 교재(RAG) + Web + YouTube"
        )
        # Ollama 연결 점검 — 미연결 시 사용자에게 즉시 안내
        if OllamaLLM().is_available():
            st.success("Ollama 서버 연결됨")
        else:
            st.error("Ollama 서버에 연결할 수 없음 (ollama serve 확인)")

        st.markdown("---")
        st.caption("테스트 질의 예시")
        st.code(
            "LangGraph의 StateGraph 사용법 알려줘\\n"
            "LangGraph로 간단한 ReAct 에이전트 코드 작성해줘\\n"
            "Claude MCP란 무엇인가요?\\n"
            "RAG 구현 튜토리얼 영상 추천해줘",
            language="text",
        )`,
    },
    {
      id: "app_main",
      name: "main()",
      fileId: "app",
      summary: "대화 이력을 그리고, 새 입력을 받아 그래프를 실행한 뒤 답변과 관측정보를 표시하는 메인 함수",
      how: "이전 대화를 말풍선으로 다시 그린 뒤, 채팅창 입력(walrus 연산자로 받음)이 있으면 create_initial_state로 빈 State를 만들어 app.invoke()로 그래프를 한 번 실행합니다. 결과 State에서 답변과 함께 질문 유형·품질 점수·재시도 횟수를 꺼내 함께 보여줍니다.",
      terms: ["st.session_state", "st.chat_input", "바다코끼리 연산자(:=)", "recursion_limit", "Supervisor", "invoke"],
      lines: [
        { at: "render_sidebar()", text: "위에서 만든 사이드바를 화면에 그립니다." },
        { at: 'if "messages" not in st.session_state:', text: "대화 기록 저장소가 아직 없으면 빈 리스트로 초기화합니다." },
        { at: "if user_input := st.chat_input(", text: ":= 는 입력값을 받는 동시에 '입력이 있는지'를 검사합니다. 입력이 있을 때만 아래를 실행합니다." },
        { at: "final_state = app.invoke(", text: "그래프 전체를 한 번 실행합니다. 라우팅→검색→생성→평가가 이 한 줄 안에서 자동으로 진행됩니다." },
        { at: 'create_initial_state(user_input), config={"recursion_limit": 30}', text: "빈 State를 넣고, 재시도 루프가 폭주하지 않도록 최대 단계 수(30)를 제한합니다." },
        { at: 'qtype = final_state.get("question_type", "-")', text: "그래프가 끝난 뒤 결과 State에서 질문 유형을 꺼냅니다(이어서 점수·통과·재시도도 꺼냄)." },
        { at: 'f"유형: ', text: "Supervisor가 남긴 관측 정보(유형·품질 점수·통과·재시도)를 작은 글씨로 함께 표시합니다." },
      ],
      code: `def main() -> None:
    """Streamlit 앱 메인 — 대화 이력 렌더링 + 입력 처리."""
    st.set_page_config(page_title="Agentic AI 학습 MAS 챗봇", page_icon="🤖", layout="wide")
    st.title("🤖 Agentic AI 학습지원 MAS 챗봇")
    st.caption("LangGraph 멀티에이전트 · 교재(GraphRAG) + Web + YouTube 종합 답변")

    render_sidebar()

    # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
    if "messages" not in st.session_state:
        st.session_state.messages = []

    # 이전 대화 렌더링
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    # st.chat_input: 채팅창 하단 입력란을 렌더링하고 입력값을 반환함
    if user_input := st.chat_input("예: LangGraph의 StateGraph 사용법 알려줘"):
        st.session_state.messages.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.markdown(user_input)

        with st.chat_message("assistant"):
            with st.spinner("멀티에이전트가 검색·생성·평가 중... (로컬 qwen3:8b는 수십 초 소요될 수 있음)"):
                app = get_app()
                # recursion_limit: 재시도 루프 폭주 방지 안전장치
                final_state = app.invoke(
                    create_initial_state(user_input), config={"recursion_limit": 30}
                )
            answer = final_state.get("answer", "(답변을 생성하지 못함)")
            st.markdown(answer)

            # Supervisor 관측 정보 표시 (질문 유형·품질 점수·재시도)
            qtype = final_state.get("question_type", "-")
            score = final_state.get("evaluation_score", 0.0)
            passed = final_state.get("evaluation_passed", False)
            retries = final_state.get("retry_count", 0)
            st.caption(
                f"유형: \`{qtype}\` · 품질 점수: \`{score:.2f}\` "
                f"· 통과: \`{passed}\` · 재시도: \`{retries}\`"
            )

        st.session_state.messages.append({"role": "assistant", "content": answer})`,
    },

    // ───────────────────────── main.py ─────────────────────────
    {
      id: "cli_run",
      name: "run()",
      fileId: "main",
      summary: "질문 하나를 그래프에 통과시켜 결과를 터미널에 출력하는 CLI 실행 함수",
      how: "웹 UI 없이 빠르게 테스트할 때 씁니다. 그래프를 컴파일하고 app.invoke()로 한 번 실행한 뒤, 질문 유형·평가 점수·재시도 횟수와 최종 답변을 구분선과 함께 출력합니다.",
      terms: ["invoke", "recursion_limit", "f-string"],
      lines: [
        { at: "app = compile_workflow()", text: "노드·엣지로 구성된 그래프를 실행 가능한 형태로 컴파일합니다." },
        { at: "final_state = app.invoke(create_initial_state(question)", text: "빈 State를 넣어 그래프를 한 번 실행하고, 채워진 최종 State를 받습니다." },
        { at: 'print(f"질문 유형 :', text: "결과 State에서 분류된 질문 유형을 꺼내 출력합니다(이어서 점수·재시도·답변도 출력)." },
      ],
      code: `def run(question: str) -> None:
    """질문 하나를 워크플로에 통과시켜 결과를 출력함."""
    app = compile_workflow()
    # recursion_limit: 재시도 루프 안전장치 (Loop Guard 보조)
    final_state = app.invoke(create_initial_state(question), config={"recursion_limit": 30})

    print("\\n" + "=" * 70)
    print(f"질문 유형 : {final_state.get('question_type')}")
    print(f"평가 점수 : {final_state.get('evaluation_score'):.2f} (통과={final_state.get('evaluation_passed')})")
    print(f"재시도    : {final_state.get('retry_count')}")
    print("=" * 70)
    print(final_state.get("answer", "(답변 없음)"))
    print("=" * 70)`,
    },
    {
      id: "cli_entry",
      name: 'if __name__ == "__main__"',
      fileId: "main",
      summary: "이 파일을 직접 실행했을 때만 질문을 받아 run()을 호출하는 진입 구문",
      how: "python main.py \"질문\" 처럼 직접 실행하면 명령행 인자(sys.argv)를 모아 질문으로 쓰고, 인자가 없으면 기본 질문을 씁니다. 다른 파일이 import할 때는 실행되지 않아 안전합니다.",
      terms: ['if __name__ == "__main__"', "sys.argv", "바다코끼리 연산자(:=)"],
      lines: [
        { at: 'if __name__ == "__main__":', text: "이 파일을 직접 실행할 때만 아래 코드를 수행합니다(import될 때는 실행 안 됨)." },
        { at: "user_question = \" \".join(sys.argv[1:])", text: "명령행에서 입력한 단어들을 하나의 질문 문장으로 합칩니다. 없으면 뒤의 기본 질문을 사용합니다." },
        { at: "run(user_question)", text: "위에서 만든 질문으로 워크플로를 실행합니다." },
      ],
      code: `if __name__ == "__main__":
    user_question = " ".join(sys.argv[1:]) or "LangGraph의 StateGraph 사용법 알려줘"
    run(user_question)`,
    },

    // ───────────────────────── graph/workflow.py ─────────────────────────
    {
      id: "create_workflow",
      name: "create_workflow()",
      fileId: "workflow",
      summary: "노드(작업 단위)와 엣지(이동 경로)를 연결해 MAS 그래프를 조립하는 함수",
      how: "StateGraph에 노드 10개를 등록하고, 어떤 노드 다음에 어디로 갈지 엣지로 잇습니다. router 다음은 무조건 rag, rag 다음은 유형별로 갈라지고(code→code_generation, qa→web), supervisor 다음은 평가 결과에 따라 통과/재시도/폴백으로 갈립니다. 조건부 엣지는 '상황을 보고 다음 행선지를 정하는 함수'와 함께 등록합니다.",
      terms: ["StateGraph", "노드(Node)", "엣지(Edge)", "조건부 엣지", "진입점(entry point)", "SAS 패턴", "END"],
      lines: [
        { at: "workflow = StateGraph(AgentState)", text: "공유 State 형식(AgentState)을 따르는 빈 그래프를 만듭니다." },
        { at: 'workflow.set_entry_point("router")', text: "그래프 실행은 항상 router 노드부터 시작하도록 시작점을 지정합니다." },
        { at: 'workflow.add_conditional_edges("router", route_by_type, {"code": "rag", "qa": "rag"})', text: "router 다음 행선지를 route_by_type 함수의 반환값으로 정합니다(코드든 질문이든 일단 rag로)." },
        { at: 'workflow.add_edge("web", "youtube")', text: "Q&A 경로의 고정 순서: 웹 검색 다음은 항상 YouTube 검색으로 이어집니다." },
        { at: "def after_supervisor(state: AgentState) -> str:", text: "평가 결과를 보고 통과(코드는 final_response, 질문은 종료)/재시도/폴백 중 어디로 갈지 정하는 함수입니다." },
        { at: '"end": END,', text: "행선지 라벨 'end'를 그래프의 종료 지점(END)에 연결합니다." },
        { at: 'workflow.add_edge("fallback", END)', text: "폴백 노드가 끝나면 그래프를 종료합니다." },
      ],
      code: `def create_workflow() -> StateGraph:
    """노드와 엣지를 연결하여 MAS 워크플로 그래프를 구성함 (컴파일 전)."""
    workflow = StateGraph(AgentState)

    # === 노드 등록 ===
    workflow.add_node("router", router_node)               # 1. 질문 분류 (Scheduler)
    workflow.add_node("rag", rag_node)                     # 2. RAG 검색 (KG + Vector)
    workflow.add_node("web", web_node)                     # 3. 웹 검색 (Q&A 전용)
    workflow.add_node("youtube", youtube_node)             # 4. YouTube 검색 (Q&A 전용)
    workflow.add_node("code_generation", code_generation_node)  # 5. 코드 생성
    workflow.add_node("qa_response", qa_response_node)     # 6. Q&A 종합 응답
    workflow.add_node("supervisor", supervisor_node)       # 7. 품질 평가 (Supervisor)
    workflow.add_node("retry", retry_node)                 # 8. 재시도 준비
    workflow.add_node("fallback", fallback_node)           # 9. 폴백 응답
    workflow.add_node("final_response", final_response_node)  # 10. 코드 최종 포맷

    # === 시작점: 항상 router부터 ===
    workflow.set_entry_point("router")

    # router → rag (code/qa 모두 RAG부터)
    workflow.add_conditional_edges("router", route_by_type, {"code": "rag", "qa": "rag"})

    # rag 이후 유형별 분기
    def after_rag(state: AgentState) -> str:
        """RAG 이후 유형에 따라 코드 생성 또는 웹 검색으로 분기."""
        return state.get("question_type", "qa")

    workflow.add_conditional_edges(
        "rag", after_rag, {"code": "code_generation", "qa": "web"}
    )

    # Q&A 경로: rag → web → youtube → qa_response
    workflow.add_edge("web", "youtube")
    workflow.add_edge("youtube", "qa_response")

    # 코드/Q&A 모두 supervisor로 수렴
    workflow.add_edge("code_generation", "supervisor")
    workflow.add_edge("qa_response", "supervisor")

    # supervisor 이후 분기: 통과/재시도/폴백
    def after_supervisor(state: AgentState) -> str:
        """평가 결과에 따라 완료(코드는 final_response, Q&A는 END)/재시도/폴백 결정."""
        decision = should_continue(state)  # "end" | "retry" | "fallback"
        if decision == "end":
            # 코드 유형은 코드+저장경로 포맷이 필요하므로 final_response 경유
            return "final_response" if state.get("question_type") == "code" else "end"
        return decision

    workflow.add_conditional_edges(
        "supervisor",
        after_supervisor,
        {
            "final_response": "final_response",
            "retry": "retry",
            "fallback": "fallback",
            "end": END,
        },
    )

    # 재시도 경로: retry → rag (다시 검색부터)
    def after_retry(state: AgentState) -> str:
        """재시도 시 유형에 맞춰 다시 RAG로 진입."""
        return state.get("question_type", "qa")

    workflow.add_conditional_edges("retry", after_retry, {"code": "rag", "qa": "rag"})

    # 종료 엣지
    workflow.add_edge("fallback", END)
    workflow.add_edge("final_response", END)

    return workflow`,
    },
    {
      id: "compile_workflow",
      name: "compile_workflow()",
      fileId: "workflow",
      summary: "조립한 그래프를 실제로 실행할 수 있는 형태로 컴파일하는 함수",
      how: "create_workflow()로 짠 설계도를 .compile()로 실행 가능한 그래프 객체로 바꿉니다. 이 객체의 invoke()를 호출하면 그래프가 한 번 돕니다.",
      terms: ["컴파일(compile)", "StateGraph"],
      lines: [
        { at: "return create_workflow().compile()", text: "그래프 설계도를 만들고 곧바로 컴파일해 실행 가능한 그래프를 돌려줍니다." },
      ],
      code: `def compile_workflow():
    """StateGraph를 실행 가능한 CompiledGraph로 컴파일함."""
    return create_workflow().compile()`,
    },

    // ───────────────────────── graph/state.py ─────────────────────────
    {
      id: "agent_state",
      name: "AgentState (공유 State)",
      fileId: "state",
      summary: "모든 노드가 함께 읽고 쓰는 '공유 메모지'의 형식을 정의한 TypedDict",
      how: "SAS 패턴에서 에이전트들은 서로 직접 호출하지 않고, 오직 이 공유 State를 통해 협업합니다. 각 노드는 이 메모지를 받아 자기 담당 칸(예: rag_results)만 채워서 돌려줍니다. messages 칸은 add_messages 덕분에 덮어쓰지 않고 누적됩니다.",
      terms: ["TypedDict", "Shared State", "Annotated", "add_messages", "reducer", "Literal", "Optional"],
      lines: [
        { at: "messages: Annotated[list, add_messages]", text: "대화 메시지 칸. add_messages reducer가 붙어 새 메시지를 덮어쓰지 않고 자동으로 이어 붙입니다." },
        { at: 'question_type: Literal["code", "qa"]', text: "질문 유형 칸. 'code' 또는 'qa' 두 값만 허용됩니다(Literal)." },
        { at: "rag_results: list[dict]      # 교재/KG 검색 결과", text: "RAG 검색 결과를 담는 칸. 노드 사이에 결과를 공유하는 통로입니다." },
        { at: "evaluation_score: float    # 품질 점수 (0.0~1.0)", text: "Supervisor가 매긴 품질 점수(0~1)를 저장하는 칸입니다." },
        { at: "source_weights: dict       # Q&A 소스 가중치", text: "교재/웹/유튜브 각 소스의 중요도(가중치)를 담는 칸. 재시도 시 조정됩니다." },
      ],
      code: `class AgentState(TypedDict):
    """MAS 시스템 전체 공유 상태."""

    # === 대화 관리 ===
    # add_messages reducer로 노드가 추가한 메시지가 자동 누적됨 (덮어쓰지 않음)
    messages: Annotated[list, add_messages]

    # === 질문 정보 ===
    question: str                          # 원본 사용자 질문
    question_type: Literal["code", "qa"]   # Router가 분류한 유형

    # === 각 Agent 검색 결과 (Shared State로 노드 간 공유) ===
    rag_results: list[dict]      # 교재/KG 검색 결과
    web_results: list[dict]      # 웹 검색 결과
    youtube_results: list[dict]  # YouTube 검색 결과

    # === 코드 생성 결과 (code 유형) ===
    generated_code: str   # 생성된 Python 코드
    code_filename: str    # 저장된 파일 경로

    # === 최종 출력 ===
    answer: str           # 사용자에게 반환할 최종 답변

    # === Supervisor 평가 결과 ===
    evaluation_score: float    # 품질 점수 (0.0~1.0)
    evaluation_passed: bool    # 통과 여부 (score >= 0.75)
    retry_count: int           # 현재 재시도 횟수 (max 2 = Loop Guard)
    retry_strategy: str        # 재시도 전략 (query_rewrite / direct_generation / reweight_sources)

    # === 재시도/가중치 ===
    rewritten_query: str       # 재작성된 쿼리 (있으면 RAG에서 우선 사용)
    source_weights: dict       # Q&A 소스 가중치 {"rag":.., "web":.., "youtube":..}

    # === 에러 ===
    error: Optional[str]`,
    },
    {
      id: "create_initial_state",
      name: "create_initial_state()",
      fileId: "state",
      summary: "워크플로 시작용 '빈 메모지'를 모든 칸 기본값으로 만들어 주는 함수",
      how: "그래프 실행 전에 모든 칸을 기본값으로 채운 State를 만듭니다. question만 사용자 질문으로 채우고 나머지는 빈 값/0으로 둡니다. 노드들이 진행되며 이 칸들을 하나씩 채워 나갑니다.",
      terms: ["Shared State", "TypedDict"],
      lines: [
        { at: 'question_type="qa",', text: "유형의 임시 기본값을 'qa'로 둡니다. 실제 분류는 곧 Router가 정합니다." },
        { at: 'source_weights=SOURCE_WEIGHTS["default"].copy(),', text: "기본 소스 가중치를 복사해 넣습니다. .copy()로 원본 설정을 건드리지 않게 합니다." },
      ],
      code: `def create_initial_state(question: str) -> AgentState:
    """워크플로 시작용 초기 State를 생성함 (모든 필드 기본값)."""
    return AgentState(
        messages=[],
        question=question,
        question_type="qa",            # 기본값, Router가 실제 분류
        rag_results=[],
        web_results=[],
        youtube_results=[],
        generated_code="",
        code_filename="",
        answer="",
        evaluation_score=0.0,
        evaluation_passed=False,
        retry_count=0,
        retry_strategy="",
        rewritten_query="",
        source_weights=SOURCE_WEIGHTS["default"].copy(),
        error=None,
    )`,
    },
    {
      id: "get_current_query",
      name: "get_current_query()",
      fileId: "state",
      summary: "지금 검색에 쓸 쿼리를 고르는 함수 (재작성 쿼리가 있으면 그것 우선)",
      how: "재시도 단계에서 쿼리를 더 명확히 다시 썼다면 그 재작성 쿼리를, 없으면 원래 질문을 돌려줍니다. or 연산은 앞 값이 비어 있으면 뒤 값을 쓰는 파이썬 관용구입니다.",
      terms: ["쿼리 재작성"],
      lines: [
        { at: 'return state.get("rewritten_query") or state.get("question", "")', text: "재작성 쿼리가 있으면 그것을, 비어 있으면 원래 질문을 사용합니다." },
      ],
      code: `def get_current_query(state: AgentState) -> str:
    """현재 사용할 쿼리를 반환함 (재작성 쿼리가 있으면 우선)."""
    return state.get("rewritten_query") or state.get("question", "")`,
    },

    // ───────────────────────── graph/nodes.py ─────────────────────────
    {
      id: "singletons",
      name: "에이전트 싱글톤 (get_router 등)",
      fileId: "nodes",
      summary: "에이전트 인스턴스를 한 번만 만들어 재사용하는 싱글톤 패턴 (초기화 비용 절감)",
      how: "RAG 에이전트는 LanceDB 연결 등 무거운 준비가 필요합니다. 전역 변수에 인스턴스를 보관해 두고, 처음 필요할 때만 만들고(지연 초기화) 이후에는 같은 것을 돌려줍니다. 노드가 호출될 때마다 새로 만드는 낭비를 막습니다.",
      terms: ["싱글톤(Singleton)", "지연 초기화(Lazy Initialization)", "global", "LanceDB"],
      lines: [
        { at: "_router: Router | None = None", text: "에이전트를 담아둘 전역 변수. 아직 안 만들었다는 뜻으로 None으로 시작합니다." },
        { at: "if _router is None:", text: "아직 안 만들었으면(None) 새로 만들고, 이미 있으면 그대로 재사용합니다." },
        { at: "_rag_agent = RAGAgent()", text: "RAG 에이전트를 최초 1회만 생성합니다(LanceDB 연결을 이때 맺어 재사용)." },
      ],
      code: `# ---------------------------------------------------------------------------
# 전역 에이전트 싱글톤 (Lazy Initialization)
# ---------------------------------------------------------------------------
_router: Router | None = None
_rag_agent: RAGAgent | None = None
_web_agent: WebAgent | None = None
_youtube_agent: YouTubeAgent | None = None
_code_agent: CodeAgent | None = None
_llm: OllamaLLM | None = None


def get_router() -> Router:
    """Router 싱글톤 반환."""
    global _router
    if _router is None:
        _router = Router()
    return _router


def get_rag_agent() -> RAGAgent:
    """RAG Agent 싱글톤 반환 (LanceDB 연결 재사용)."""
    global _rag_agent
    if _rag_agent is None:
        _rag_agent = RAGAgent()
    return _rag_agent


# (이하 get_web_agent / get_youtube_agent / get_code_agent / get_llm 도 동일 패턴 — 일부 발췌)`,
    },
    {
      id: "router_node",
      name: "router_node()",
      fileId: "nodes",
      summary: "질문을 code/qa로 분류하는 노드 (Scheduler 진입점)",
      how: "Router 에이전트에게 질문 분류를 맡기고, 그 결과(question_type)와 사용자 메시지를 State에 적어 돌려줍니다. 노드는 받은 State 전체를 덮어쓰지 않고 '바뀐 칸만' dict로 반환합니다.",
      terms: ["노드(Node)", "Scheduler", "HumanMessage"],
      lines: [
        { at: "question_type = get_router().classify_question(question)", text: "Router 에이전트를 불러 질문을 'code' 또는 'qa'로 분류합니다." },
        { at: '"messages": [HumanMessage(content=question)],', text: "사용자 질문을 대화 기록(messages)에 메시지 객체로 추가합니다." },
      ],
      code: `def router_node(state: AgentState) -> dict:
    """질문을 code/qa로 분류함 (Scheduler 진입)."""
    question = state.get("question", "")
    logger.info("[Router] 질문 분류 시작")
    question_type = get_router().classify_question(question)
    logger.info(f"[Router] 분류 결과: {question_type}")
    return {
        "question_type": question_type,
        "messages": [HumanMessage(content=question)],
    }`,
    },
    {
      id: "rag_node",
      name: "rag_node()",
      fileId: "nodes",
      summary: "유형에 따라 예제코드 또는 교재+KG를 검색하는 RAG 노드",
      how: "현재 쿼리(재작성본 우선)를 가져와, 코드 질문이면 예제코드 청크를, 질문(qa)이면 교재 텍스트(Vector)와 지식그래프 엔티티(KG)를 함께 검색합니다. 두 검색 결과를 더해(+) '벡터와 KG 모두 사용' 요건을 충족합니다.",
      terms: ["RAG", "Vector DB", "Knowledge Graph(KG)", "엔티티(entity)", "벡터 검색"],
      lines: [
        { at: "query = get_current_query(state)", text: "재작성 쿼리가 있으면 그것을, 없으면 원래 질문을 검색어로 가져옵니다." },
        { at: "results = rag.search_code(query)", text: "코드 질문이면 예제코드 청크를 검색합니다." },
        { at: "results = rag.search_textbook(query) + rag.search_entities(query)", text: "질문(qa)이면 교재 청크(Vector)와 KG 엔티티를 둘 다 검색해 합칩니다." },
      ],
      code: `def rag_node(state: AgentState) -> dict:
    """RAG 검색 노드 — code는 예제코드, qa는 교재+KG 엔티티를 검색함."""
    query = get_current_query(state)
    question_type = state.get("question_type", "qa")
    rag = get_rag_agent()

    if question_type == "code":
        # 코드 작성: 예제코드 청크 검색
        results = rag.search_code(query)
    else:
        # Q&A: 교재 텍스트 유닛(Vector) + KG 엔티티(Knowledge Graph)를 함께 검색
        results = rag.search_textbook(query) + rag.search_entities(query)

    logger.info(f"[RAG] 검색 완료: {len(results)}건 (type={question_type})")
    return {"rag_results": results}`,
    },
    {
      id: "code_generation_node",
      name: "code_generation_node()",
      fileId: "nodes",
      summary: "RAG 결과를 참고해 코드를 생성·검증하고 유효하면 파일로 저장하는 노드",
      how: "RAG로 찾은 예제를 컨텍스트 문자열로 정리해 CodeAgent에 넘기고, 구문 검증을 통과할 때까지 재생성(generate_with_retry)합니다. 유효한 코드면 output/ 폴더에 파일로 저장하고 경로를 State에 기록합니다.",
      terms: ["RAG", "ast.parse", "노드(Node)"],
      lines: [
        { at: "context = get_rag_agent().format_context(rag_results)", text: "검색 결과들을 LLM이 읽기 좋은 한 덩어리 텍스트(컨텍스트)로 정리합니다." },
        { at: "code, is_valid = get_code_agent().generate_with_retry(question, context)", text: "코드를 생성하고 구문이 맞을 때까지 재시도합니다. (코드, 유효여부)를 받습니다." },
        { at: "if is_valid and code:", text: "구문이 유효하고 코드가 비어있지 않을 때만 파일로 저장합니다." },
      ],
      code: `def code_generation_node(state: AgentState) -> dict:
    """RAG 결과를 참고해 코드를 생성·검증하고 유효하면 파일로 저장함."""
    question = state.get("question", "")
    rag_results = state.get("rag_results", [])
    logger.info(f"[Code] 코드 생성 시작 (참조 {len(rag_results)}건)")

    context = get_rag_agent().format_context(rag_results)
    code, is_valid = get_code_agent().generate_with_retry(question, context)
    logger.info(f"[Code] 생성 완료: valid={is_valid}, length={len(code)}")

    filename = ""
    if is_valid and code:
        success, path = save_code_to_file(code, request=question)
        if success:
            filename = path
    return {"generated_code": code, "code_filename": filename}`,
    },
    {
      id: "qa_response_node",
      name: "qa_response_node()",
      fileId: "nodes",
      summary: "교재+웹+YouTube를 가중치와 함께 묶어 한국어 답변을 만들고 출처를 붙이는 노드",
      how: "세 소스를 각자 컨텍스트 문자열로 만들고, 가중치(교재 0.7 우선)와 답변 규칙을 담은 큰 프롬프트를 구성해 LLM에 답변을 요청합니다. 마지막에 어디서 가져왔는지 출처 목록을 본문 아래에 붙입니다.",
      terms: ["RAG", "가중치(weight)", "f-string", "프롬프트(prompt)", "AIMessage"],
      lines: [
        { at: 'weights = state.get("source_weights", SOURCE_WEIGHTS["default"])', text: "교재/웹/유튜브 가중치를 State에서 가져옵니다(없으면 기본값)." },
        { at: 'prompt = f"""다음 검색 결과를 종합하여', text: "세 소스 내용과 가중치, 작성 규칙을 한 프롬프트로 합칩니다(여러 줄 문자열)." },
        { at: "5. 설명에 도움이 되면", text: "필요하면 ```python 코드 블록으로 예시를 넣으라고 LLM에 지시합니다." },
        { at: "answer = get_llm().generate(prompt=prompt, temperature=0.7)", text: "구성한 프롬프트로 LLM에게 답변 생성을 요청합니다(temperature 0.7은 약간 유연하게)." },
        { at: "sources = format_sources(rag_results, web_results, youtube_results)", text: "세 소스의 출처를 사용자에게 보여줄 목록으로 정리합니다." },
        { at: 'full_answer = f"{answer}', text: "답변 본문 아래에 구분선과 출처 목록을 이어 붙여 최종 답변을 만듭니다." },
      ],
      code: `def qa_response_node(state: AgentState) -> dict:
    """RAG + Web + YouTube를 종합하여 Q&A 답변을 생성하고 출처를 첨부함."""
    question = state.get("question", "")
    rag_results = state.get("rag_results", [])
    web_results = state.get("web_results", [])
    youtube_results = state.get("youtube_results", [])
    weights = state.get("source_weights", SOURCE_WEIGHTS["default"])
    logger.info(
        f"[QA] 응답 생성: RAG={len(rag_results)}, Web={len(web_results)}, YouTube={len(youtube_results)}"
    )

    rag = get_rag_agent()
    rag_context = rag.format_context(rag_results) if rag_results else "교재 검색 결과 없음."
    web_context = get_web_agent().format_results(web_results)
    youtube_context = get_youtube_agent().format_results(youtube_results)

    prompt = f"""다음 검색 결과를 종합하여 질문에 한국어로 답변함.

## 질문
{question}

## 교재/KG 자료 (가중치 {weights.get('rag', 0.7)})
{rag_context}

## 웹 검색 결과 (가중치 {weights.get('web', 0.1)})
{web_context}

## YouTube 영상 (가중치 {weights.get('youtube', 0.2)})
{youtube_context}

## 답변 작성 규칙
1. 검색 결과를 종합하여 명확하고 구체적으로 답변
2. 가중치가 높은 소스(교재)를 우선 참조
3. 본문에 핵심 출처를 자연스럽게 언급
4. 관련 영상이 있으면 추천
5. 설명에 도움이 되면 \`\`\`python 코드 블록으로 예시 제공

## 답변:"""

    answer = get_llm().generate(prompt=prompt, temperature=0.7)
    sources = format_sources(rag_results, web_results, youtube_results)
    full_answer = f"{answer}\\n\\n---\\n**참고 출처:**\\n{sources}"

    logger.info(f"[QA] 응답 생성 완료 (길이 {len(full_answer)})")
    return {"answer": full_answer, "messages": [AIMessage(content=full_answer)]}`,
    },
    {
      id: "supervisor_node",
      name: "supervisor_node()",
      fileId: "nodes",
      summary: "결과 품질을 0~1점으로 채점하고 통과/재시도 전략을 정하는 Supervisor 노드",
      how: "유형에 맞는 채점 함수(_evaluate_code/_evaluate_qa)로 점수를 매기고, 0.75 이상이면 통과로 표시합니다. 통과 못 했고 재시도 여유가 있으면 점수대에 따라 재시도 전략(쿼리 재작성/가중치 조정 등)을 고릅니다.",
      terms: ["Supervisor", "품질 게이팅", "재시도 전략"],
      lines: [
        { at: 'score = _evaluate_code(state) if question_type == "code" else _evaluate_qa(state)', text: "코드면 코드 채점, 질문이면 Q&A 채점 함수를 골라 점수를 매깁니다." },
        { at: 'passed = score >= SUPERVISOR_CONFIG["pass_threshold"]', text: "점수가 통과 기준(0.75) 이상인지 판정합니다." },
        { at: 'if not passed and retry_count < SUPERVISOR_CONFIG["max_retries"]:', text: "통과 못 했고 재시도 한도(2회)가 남아 있을 때만 재시도 전략을 정합니다." },
        { at: 'return {"evaluation_score": score, "evaluation_passed": passed, "retry_strategy": strategy}', text: "점수·통과여부·재시도 전략을 State에 적어 돌려줍니다." },
      ],
      code: `def supervisor_node(state: AgentState) -> dict:
    """결과 품질을 평가(0.0~1.0)하고 통과/재시도 전략을 결정함 (Hybrid Supervisor)."""
    question_type = state.get("question_type", "qa")
    retry_count = state.get("retry_count", 0)
    logger.info(f"[Supervisor] 평가 시작 (type={question_type}, retry={retry_count})")

    score = _evaluate_code(state) if question_type == "code" else _evaluate_qa(state)
    passed = score >= SUPERVISOR_CONFIG["pass_threshold"]

    strategy = ""
    if not passed and retry_count < SUPERVISOR_CONFIG["max_retries"]:
        strategies = RETRY_STRATEGIES.get(question_type, {})
        if score >= SUPERVISOR_CONFIG["retry_threshold"]:
            strategy = strategies.get("score >= 0.5", "query_rewrite")
        else:
            strategy = strategies.get("score < 0.5", "query_rewrite")

    logger.info(f"[Supervisor] score={score:.2f}, passed={passed}, strategy={strategy or 'none'}")
    return {"evaluation_score": score, "evaluation_passed": passed, "retry_strategy": strategy}`,
    },
    {
      id: "evaluate_code",
      name: "_evaluate_code()",
      fileId: "nodes",
      summary: "생성된 코드를 4개 항목(각 0.25점)으로 채점하는 함수",
      how: "① 문법이 맞는지(ast.parse), ② 질문 키워드가 코드에 반영됐는지, ③ RAG 참조가 있었는지, ④ import와 함수/클래스 구조가 있는지 — 네 가지를 각 0.25점으로 더해 최대 1.0점을 만듭니다.",
      terms: ["ast.parse", "구문(syntax) 검증", "RAG"],
      lines: [
        { at: "# 1) 구문 유효성 (ast.parse 통과)", text: "① 코드 문법이 올바른지 검사하는 항목입니다." },
        { at: "ast.parse(code)", text: "코드를 실행하지 않고 문법만 분석합니다. 오류 없이 통과하면 0.25점을 줍니다." },
        { at: "# 2) 질문 키워드가 코드에 1개 이상 반영", text: "② 질문 속 단어가 코드에 반영됐는지 보는 항목입니다." },
        { at: "if any(kw in code.lower() for kw in question.lower().split()):", text: "질문을 단어로 쪼개 그중 하나라도 코드에 들어 있으면 0.25점을 줍니다." },
        { at: "# 4) import + 함수/클래스 구조 존재", text: "④ 실행 가능한 코드의 기본 골격이 있는지 보는 항목입니다." },
        { at: 'if "import" in code and ("def " in code or "class " in code):', text: "import가 있고 함수(def)나 클래스(class)가 있으면 0.25점을 줍니다." },
      ],
      code: `def _evaluate_code(state: AgentState) -> float:
    """코드 결과를 4개 항목(각 0.25)으로 채점함 — 구문/키워드/RAG참조/구조."""
    code = state.get("generated_code", "")
    question = state.get("question", "")
    rag_results = state.get("rag_results", [])
    score = 0.0

    # 1) 구문 유효성 (ast.parse 통과)
    if code.strip():
        try:
            ast.parse(code)
            score += 0.25
        except SyntaxError:
            pass
    # 2) 질문 키워드가 코드에 1개 이상 반영
    if any(kw in code.lower() for kw in question.lower().split()):
        score += 0.25
    # 3) RAG 참조가 있었음
    if rag_results and code:
        score += 0.25
    # 4) import + 함수/클래스 구조 존재
    if "import" in code and ("def " in code or "class " in code):
        score += 0.25
    return score`,
    },
    {
      id: "evaluate_qa",
      name: "_evaluate_qa()",
      fileId: "nodes",
      summary: "Q&A 답변을 4개 항목(각 0.25점)으로 채점하는 함수",
      how: "① 답변이 충분히 긴지(100자 이상), ② 검색 소스가 하나라도 있었는지, ③ 출처 표기가 들어갔는지, ④ 질문과 답변의 키워드가 겹치는지(관련성) — 네 가지를 각 0.25점으로 더합니다. 관련성은 LLM 없이 키워드 겹침으로 빠르게 계산합니다.",
      terms: ["휴리스틱(heuristic)", "관련성 점수"],
      lines: [
        { at: "# 1) 충분한 답변 길이", text: "① 답변이 너무 짧지 않은지 보는 항목입니다." },
        { at: "if len(answer) >= 100:", text: "답변 길이가 100자 이상이면 0.25점을 줍니다." },
        { at: "# 2) 검색 소스가 하나라도 존재", text: "② 근거가 될 검색 결과가 있었는지 보는 항목입니다." },
        { at: "if rag_results or web_results or youtube_results:", text: "교재/웹/유튜브 중 하나라도 결과가 있으면 0.25점을 줍니다." },
        { at: 'if "출처" in answer or "참고" in answer or "URL" in answer:', text: "③ 답변에 출처/참고 표기가 들어 있으면 0.25점을 줍니다." },
        { at: "if calculate_relevance_score(question, answer) >= 0.5:", text: "④ 질문-답변 키워드 겹침이 절반 이상이면 0.25점을 줍니다." },
      ],
      code: `def _evaluate_qa(state: AgentState) -> float:
    """Q&A 답변을 4개 항목(각 0.25)으로 채점함 — 길이/소스/출처표기/관련성."""
    answer = state.get("answer", "")
    question = state.get("question", "")
    rag_results = state.get("rag_results", [])
    web_results = state.get("web_results", [])
    youtube_results = state.get("youtube_results", [])
    score = 0.0

    # 1) 충분한 답변 길이
    if len(answer) >= 100:
        score += 0.25
    # 2) 검색 소스가 하나라도 존재
    if rag_results or web_results or youtube_results:
        score += 0.25
    # 3) 출처 표기 포함
    if "출처" in answer or "참고" in answer or "URL" in answer:
        score += 0.25
    # 4) 질문-답변 관련성 (키워드 겹침 휴리스틱)
    if calculate_relevance_score(question, answer) >= 0.5:
        score += 0.25
    return score`,
    },
    {
      id: "retry_node",
      name: "retry_node()",
      fileId: "nodes",
      summary: "재시도 전략에 따라 쿼리를 재작성하거나 소스 가중치를 바꾸고 재시도 횟수를 올리는 노드",
      how: "전략이 'query_rewrite'면 질문을 검색에 더 좋게 다시 쓰고, 'reweight_sources'면 웹/유튜브 비중을 올린 가중치로 바꿉니다. 어떤 경우든 retry_count를 1 올려 무한 반복을 막습니다.",
      terms: ["쿼리 재작성", "가중치(weight)", "Loop Guard"],
      lines: [
        { at: 'updates: dict = {"retry_count": retry_count + 1}', text: "재시도 횟수를 1 올립니다. 이 값이 한도(2)에 닿으면 더는 재시도하지 않습니다." },
        { at: 'if strategy == "query_rewrite":', text: "쿼리 재작성 전략이면 아래에서 질문을 더 명확하게 다시 씁니다." },
        { at: 'updates["rewritten_query"] = rewrite_query(question)', text: "LLM으로 질문을 검색하기 좋은 형태로 재작성해 State에 저장합니다." },
        { at: 'updates["source_weights"] = SOURCE_WEIGHTS["reweight"].copy()', text: "Q&A 재시도 시 웹/유튜브 비중을 올린 가중치로 교체합니다." },
      ],
      code: `def retry_node(state: AgentState) -> dict:
    """재시도 준비 노드 — 전략에 따라 쿼리 재작성 또는 소스 가중치 조정 후 retry_count 증가."""
    strategy = state.get("retry_strategy", "")
    question = state.get("question", "")
    question_type = state.get("question_type", "qa")
    retry_count = state.get("retry_count", 0)
    logger.info(f"[Retry] 재시도 준비 (strategy={strategy}, count={retry_count + 1})")

    updates: dict = {"retry_count": retry_count + 1}
    if strategy == "query_rewrite":
        updates["rewritten_query"] = rewrite_query(question)
        logger.info(f"[Retry] 쿼리 재작성: {updates['rewritten_query']}")
    elif strategy == "reweight_sources" and question_type == "qa":
        updates["source_weights"] = SOURCE_WEIGHTS["reweight"].copy()
        logger.info("[Retry] 소스 가중치 재조정(웹/유튜브 비중↑)")
    return updates`,
    },
    {
      id: "fallback_node",
      name: "fallback_node()",
      fileId: "nodes",
      summary: "재시도 한도를 넘으면 LLM 단독으로라도 최선의 답을 내는 폴백 노드",
      how: "검색 품질이 끝내 낮아도 빈손으로 끝내지 않습니다. 코드 질문은 LLM이 직접 코드를 만들어 저장하고, 일반 질문은 LLM 기본 지식으로 답하되 '검색 품질이 낮아 기본 지식으로 답함'을 알립니다. 시스템이 완전히 실패하는 대신 품질을 낮춰서라도 동작하는 Graceful Degradation입니다.",
      terms: ["폴백(fallback)", "Graceful Degradation", "AIMessage", "f-string"],
      lines: [
        { at: 'if question_type == "code":', text: "코드 질문이면 LLM이 직접 코드를 생성하는 경로로 갑니다." },
        { at: "code = get_code_agent().generate_code(", text: "RAG 없이 LLM 단독으로 코드를 생성합니다." },
        { at: 'answer = f"', text: "생성한 코드를 ```python 블록으로 감싸 답변을 만듭니다." },
        { at: 'answer = get_llm().generate(prompt=f"다음 질문에 한국어로 답변함', text: "일반 질문이면 LLM 기본 지식만으로 답변을 생성합니다." },
        { at: 'return {"answer": answer, "messages": [AIMessage(content=answer)]}', text: "폴백 답변을 State에 적고 대화 기록에도 추가합니다." },
      ],
      code: `def fallback_node(state: AgentState) -> dict:
    """재시도 한도 초과 시 LLM 단독으로 최선의 답변/코드를 생성하는 폴백 (Graceful Degradation)."""
    question = state.get("question", "")
    question_type = state.get("question_type", "qa")
    logger.warning(f"[Fallback] 폴백 응답 생성 (type={question_type})")

    if question_type == "code":
        code = get_code_agent().generate_code(f"다음 요청에 대한 Python 코드를 작성함: {question}", temperature=0.5)
        filename = ""
        if code:
            success, path = save_code_to_file(code, request=question)
            filename = path if success else ""
        answer = f"\`\`\`python\\n{code}\\n\`\`\`"
        if filename:
            answer += f"\\n\\n저장 위치: \`{filename}\`"
        return {"generated_code": code, "code_filename": filename, "answer": answer, "messages": [AIMessage(content=answer)]}

    answer = get_llm().generate(prompt=f"다음 질문에 한국어로 답변함: {question}", temperature=0.7)
    answer += "\\n\\n> (참고: 검색 품질이 낮아 LLM 기본 지식으로 답변함)"
    return {"answer": answer, "messages": [AIMessage(content=answer)]}`,
    },
    {
      id: "final_response_node",
      name: "final_response_node()",
      fileId: "nodes",
      summary: "코드 유형이 통과하면 코드와 저장 위치를 보기 좋게 포맷하는 노드",
      how: "코드 경로가 품질 평가를 통과하면 이 노드가 마지막으로 답변 모양을 다듬습니다. 저장 파일이 있으면 저장 위치 안내와 함께, 없으면 코드 블록만 답변으로 만듭니다.",
      terms: ["AIMessage", "f-string"],
      lines: [
        { at: "if filename:", text: "저장된 파일이 있으면 저장 위치 안내를 포함한 답변을 만듭니다." },
        { at: 'answer = f"코드를 생성하여 저장함.', text: "저장 위치와 코드 블록을 함께 담은 답변 문자열입니다." },
        { at: "else:", text: "저장 파일이 없으면 코드 블록만 답변으로 만듭니다." },
        { at: 'return {"answer": answer, "messages": [AIMessage(content=answer)]}', text: "완성된 답변을 State와 대화 기록에 적어 돌려줍니다." },
      ],
      code: `def final_response_node(state: AgentState) -> dict:
    """코드 유형 통과 시 최종 답변을 포맷함 (코드 + 저장 위치)."""
    code = state.get("generated_code", "")
    filename = state.get("code_filename", "")
    if filename:
        answer = f"코드를 생성하여 저장함.\\n\\n**저장 위치:** \`{filename}\`\\n\\n\`\`\`python\\n{code}\\n\`\`\`"
    else:
        answer = f"\`\`\`python\\n{code}\\n\`\`\`"
    return {"answer": answer, "messages": [AIMessage(content=answer)]}`,
    },
    {
      id: "should_continue",
      name: "should_continue()",
      fileId: "nodes",
      summary: "Supervisor 평가 후 완료/재시도/폴백 중 하나를 고르는 분기 함수",
      how: "통과했으면 'end', 재시도 한도(2회)를 넘었으면 'fallback', 재시도 전략이 정해져 있으면 'retry'를 돌려줍니다. 이 반환값이 그래프의 다음 행선지가 됩니다(Loop Guard로 무한루프 방지).",
      terms: ["조건부 엣지", "Loop Guard", "폴백(fallback)"],
      lines: [
        { at: 'if state.get("evaluation_passed", False):', text: "품질을 통과했으면 그래프를 끝냅니다('end')." },
        { at: 'if state.get("retry_count", 0) >= SUPERVISOR_CONFIG["max_retries"]:', text: "재시도 한도(2회)를 넘었으면 폴백으로 보냅니다." },
        { at: 'return "fallback"', text: "한도 초과 시 폴백 행선지를 반환합니다." },
        { at: 'if state.get("retry_strategy", ""):', text: "재시도 전략이 정해져 있으면 재시도로 보냅니다." },
        { at: 'return "retry"', text: "재시도 행선지를 반환합니다." },
      ],
      code: `def should_continue(state: AgentState) -> Literal["end", "retry", "fallback"]:
    """Supervisor 평가 후 완료/재시도/폴백을 결정함."""
    if state.get("evaluation_passed", False):
        return "end"
    # 최대 재시도 초과 → 폴백 (Loop Guard)
    if state.get("retry_count", 0) >= SUPERVISOR_CONFIG["max_retries"]:
        return "fallback"
    # 재시도 전략이 있으면 재시도
    if state.get("retry_strategy", ""):
        return "retry"
    return "end"`,
    },

    // ───────────────────────── agents/router.py ─────────────────────────
    {
      id: "classify_question",
      name: "Router.classify_question()",
      fileId: "router",
      summary: "질문을 code/qa로 분류하는 2단계 전략(키워드 → LLM)의 입구",
      how: "먼저 빠른 키워드 분류를 시도하고, 결과가 명확하면 그대로 씁니다. 키워드만으로 애매하면(None) LLM에게 의미를 물어 결정합니다. 빠른 규칙으로 대부분 처리하고 어려운 것만 LLM에 맡기는 비용 효율적 설계입니다.",
      terms: ["Scheduler", "키워드 분류", "LLM 분류"],
      lines: [
        { at: "keyword_result = self._classify_by_keywords(question)", text: "1단계: 키워드 점수로 빠르게 분류를 시도합니다." },
        { at: "if keyword_result:", text: "키워드만으로 결정됐으면 그 결과를 바로 돌려줍니다." },
        { at: "llm_result = self._classify_by_llm(question)", text: "애매하면 2단계: LLM에게 의미 기반 분류를 맡깁니다." },
      ],
      code: `def classify_question(self, question: str) -> Literal["code", "qa"]:
    """2단계 전략으로 질문을 분류함 (키워드 → LLM)."""
    keyword_result = self._classify_by_keywords(question)
    if keyword_result:
        logger.info(f"[Router] 키워드 분류: {keyword_result}")
        return keyword_result

    logger.debug("[Router] 키워드 분류 실패 → LLM 분류 시도")
    llm_result = self._classify_by_llm(question)
    logger.info(f"[Router] LLM 분류: {llm_result}")
    return llm_result`,
    },
    {
      id: "classify_by_keywords",
      name: "Router._classify_by_keywords()",
      fileId: "router",
      summary: "키워드 점수로 분류하되 명확할 때만 결정하고 애매하면 None을 돌려주는 함수",
      how: "강한 코드 트리거('코드 작성' 등)가 있으면 즉시 code로 봅니다. 그 외에는 code/qa 키워드 개수를 세서, 한쪽만 있거나 한쪽이 2개 이상으로 우세하면 그쪽으로 정합니다. 어느 쪽도 확실치 않으면 None을 돌려줘 LLM 단계로 넘깁니다.",
      terms: ["키워드 분류", "트리거(trigger)", "Optional"],
      lines: [
        { at: 'for strong in self.triggers.get("code_strong", []):', text: "'코드 작성'처럼 확실한 코드 신호가 있는지 먼저 검사합니다." },
        { at: 'code_score = sum(1 for kw in self.triggers.get("code", []) if kw in q)', text: "질문에 들어 있는 code 키워드 개수를 셉니다(qa도 같은 방식)." },
        { at: "if code_score > 0 and qa_score == 0:", text: "code 키워드만 있으면 code로 분류합니다." },
        { at: "if qa_score > 0 and code_score == 0:", text: "qa 키워드만 있으면 qa로 분류합니다." },
        { at: "if code_score >= 2 and code_score > qa_score:", text: "둘 다 있어도 code가 2개 이상이고 더 많으면 code로 봅니다." },
        { at: "return None", text: "어느 쪽도 확실치 않으면 None을 돌려줘 LLM 분류에 맡깁니다." },
      ],
      code: `def _classify_by_keywords(self, question: str) -> Optional[Literal["code", "qa"]]:
    """키워드 점수 기반 분류 — 명확한 경우만 결정하고 애매하면 None 반환."""
    q = question.lower()

    # 강한 코드 트리거가 있으면 무조건 code
    for strong in self.triggers.get("code_strong", []):
        if strong in q:
            return "code"

    # 일반 키워드 점수 집계
    code_score = sum(1 for kw in self.triggers.get("code", []) if kw in q)
    qa_score = sum(1 for kw in self.triggers.get("qa", []) if kw in q)
    logger.debug(f"[Router] 키워드 점수: code={code_score}, qa={qa_score}")

    # 한쪽만 키워드가 있으면 그쪽으로 분류
    if code_score > 0 and qa_score == 0:
        return "code"
    if qa_score > 0 and code_score == 0:
        return "qa"
    # 양쪽 모두 있으면 2개 이상이고 더 많은 쪽으로 분류
    if code_score >= 2 and code_score > qa_score:
        return "code"
    if qa_score >= 2 and qa_score > code_score:
        return "qa"
    # 애매하면 LLM에 위임
    return None`,
    },
    {
      id: "classify_by_llm",
      name: "Router._classify_by_llm()",
      fileId: "router",
      summary: "키워드로 애매할 때 LLM에게 의미를 물어 code/qa를 정하는 함수",
      how: "code/qa의 정의와 예시, 참고 에이전트 설명을 시스템 프롬프트로 주고, LLM이 'code' 또는 'qa' 한 단어만 답하게 합니다. 응답에 'code'가 들어 있으면 code, 아니면 qa로 처리하고, 실패하면 안전하게 qa로 폴백합니다.",
      terms: ["LLM 분류", "시스템 프롬프트(system prompt)", "f-string", "폴백(fallback)"],
      lines: [
        { at: "agent_descriptions =", text: "참고용 에이전트 설명들을 줄바꿈으로 이어 하나의 문자열로 만듭니다." },
        { at: 'system_prompt = f"""당신은 질문 분류 전문가임.', text: "분류 기준·예시를 담은 지시문(시스템 프롬프트)을 만듭니다." },
        { at: 'prompt = f"질문: {question}', text: "실제 분류할 질문을 LLM 입력으로 구성합니다." },
        { at: 'return "code" if "code" in response.strip().lower() else "qa"', text: "응답에 'code'가 있으면 code, 아니면 qa로 결정합니다." },
      ],
      code: `def _classify_by_llm(self, question: str) -> Literal["code", "qa"]:
    """LLM 의미 이해 기반 분류 (키워드로 애매한 경우)."""
    agent_descriptions = "\\n".join(
        f"- {info['name']}: {info['description']}" for info in AGENTS.values()
    )
    system_prompt = f"""당신은 질문 분류 전문가임.
사용자 질문을 다음 두 유형 중 하나로 분류함:

1. "code": 실행 가능한 코드를 작성/생성/구현해 달라는 요청
   - "~하는 코드 작성해줘", "~ 예제 만들어줘", "~를 구현해줘", "~를 ~로 변환하는 예제"
2. "qa": 개념 설명/정보/비교/추천 요청
   - "~가 뭐야?", "~는 어떻게 동작해?", "~와 ~의 차이?", "~ 추천해줘"

참고 에이전트:
{agent_descriptions}

반드시 "code" 또는 "qa" 중 하나의 단어만 출력함."""
    prompt = f"질문: {question}\\n\\n분류 결과:"
    try:
        response = self.llm.generate(
            prompt=prompt, system_prompt=system_prompt, temperature=0.1, max_tokens=10
        )
        return "code" if "code" in response.strip().lower() else "qa"
    except Exception as e:
        logger.error(f"[Router] LLM 분류 실패, qa로 폴백: {e}")
        return "qa"`,
    },

    // ───────────────────────── agents/rag_agent.py ─────────────────────────
    {
      id: "search_textbook",
      name: "RAGAgent.search_textbook()",
      fileId: "rag",
      summary: "교재 청크를 벡터검색하고 Parquet 본문과 id로 조인해 돌려주는 함수",
      how: "교재 임베딩 테이블(text_unit_text)에는 id와 벡터만 있어 본문이 없습니다. 질문을 임베딩해 가까운 청크의 id를 찾고, 그 id로 text_units.parquet에서 실제 본문을 가져옵니다(id 조인). 거리값은 0~1 유사도 점수로 바꿔 표시합니다.",
      terms: ["벡터 검색", "임베딩(embedding)", "LanceDB", "Parquet", "id 조인", "top_k", "_distance(거리)"],
      lines: [
        { at: "query_vector = self.embeddings.embed_query(query)", text: "질문을 qwen3-embedding으로 4096차원 숫자 벡터로 바꿉니다." },
        { at: 'table = self._graph_db.open_table("text_unit_text")', text: "교재 청크 임베딩이 들어있는 LanceDB 테이블을 엽니다." },
        { at: "hits = table.search(query_vector).limit(top_k).to_pandas()", text: "질문 벡터와 가까운 청크 상위 top_k개를 찾아 표로 받습니다." },
        { at: 'text_units = self._frame("text_units").set_index("id")', text: "본문이 담긴 Parquet을 불러와 id로 빠르게 찾을 수 있게 색인합니다." },
        { at: '"kind": "textbook",', text: "이 결과가 '교재' 출처임을 표시합니다." },
      ],
      code: `def search_textbook(self, query: str, top_k: Optional[int] = None) -> list[dict]:
    """교재 텍스트 유닛을 벡터검색하고 Parquet 본문과 조인하여 반환함.

    반환 각 dict: {content, source(파일명), section, score, kind="textbook"}
    """
    top_k = top_k or settings.textbook_top_k
    try:
        query_vector = self.embeddings.embed_query(query)
        # text_unit_text: id + vector만 보유 → 검색 결과 id로 text_units.parquet 조인
        table = self._graph_db.open_table("text_unit_text")
        hits = table.search(query_vector).limit(top_k).to_pandas()

        text_units = self._frame("text_units").set_index("id")
        results: list[dict] = []
        for _, hit in hits.iterrows():
            tid = hit["id"]
            if tid not in text_units.index:
                continue
            raw_text = str(text_units.loc[tid, "text"])
            results.append({
                "content": raw_text[: settings.context_chunk_max_chars],
                "source": _extract_meta(raw_text, "File") or "교재",
                "section": _extract_meta(raw_text, "Section") or "",
                # _distance(작을수록 유사) → 0~1 유사도 점수로 변환하여 표시·평가에 사용
                "score": _distance_to_score(float(hit.get("_distance", 1.0))),
                "kind": "textbook",
            })
        logger.info(f"[RAG] 교재 검색: {len(results)}건")
        return results
    except Exception as e:
        logger.error(f"교재 검색 실패: {e}")
        return []`,
    },
    {
      id: "search_entities",
      name: "RAGAgent.search_entities()",
      fileId: "rag",
      summary: "지식그래프(KG) 엔티티 설명을 벡터검색해 답변 근거를 보강하는 함수",
      how: "교재 청크뿐 아니라 지식그래프의 '엔티티(개념 노드) 설명'도 검색합니다. entity_description 테이블에서 가까운 엔티티 id를 찾고, entities.parquet에서 이름·설명·타입을 가져옵니다. 같은 주제를 KG 관점으로도 보강해 '벡터+KG 모두 사용'을 달성합니다.",
      terms: ["Knowledge Graph(KG)", "엔티티(entity)", "벡터 검색", "id 조인"],
      lines: [
        { at: 'table = self._graph_db.open_table("entity_description")', text: "KG 엔티티 설명 임베딩이 든 테이블을 엽니다." },
        { at: 'entities = self._frame("entities").set_index("id")', text: "엔티티 본문(이름·설명·타입) Parquet을 id로 색인해 둡니다." },
        { at: '"kind": "entity",', text: "이 결과가 'KG 엔티티' 출처임을 표시합니다." },
      ],
      code: `def search_entities(self, query: str, top_k: Optional[int] = None) -> list[dict]:
    """KG 엔티티 설명을 벡터검색하고 entities.parquet과 조인하여 반환함.

    Knowledge Graph(엔티티/관계 그래프)의 노드 설명을 검색에 활용하여 답변 근거를 보강함.
    반환 각 dict: {content, source(엔티티명), section(타입), score, kind="entity"}
    """
    top_k = top_k or settings.entity_top_k
    try:
        query_vector = self.embeddings.embed_query(query)
        # entity_description: id + vector만 보유 → entities.parquet과 id 조인
        table = self._graph_db.open_table("entity_description")
        hits = table.search(query_vector).limit(top_k).to_pandas()

        entities = self._frame("entities").set_index("id")
        results: list[dict] = []
        for _, hit in hits.iterrows():
            eid = hit["id"]
            if eid not in entities.index:
                continue
            row = entities.loc[eid]
            title = str(row.get("title", ""))
            description = str(row.get("description", ""))
            results.append({
                "content": description[: settings.context_chunk_max_chars],
                "source": title,
                "section": str(row.get("type", "")),
                "score": _distance_to_score(float(hit.get("_distance", 1.0))),
                "kind": "entity",
            })
        logger.info(f"[RAG] KG 엔티티 검색: {len(results)}건")
        return results
    except Exception as e:
        logger.error(f"엔티티 검색 실패: {e}")
        return []`,
    },
    {
      id: "search_code",
      name: "RAGAgent.search_code()",
      fileId: "rag",
      summary: "예제코드 청크를 벡터검색하는 함수 (code_chunks는 본문을 직접 보유)",
      how: "코드 질문일 때 사용합니다. code_chunks 테이블은 교재 테이블과 달리 본문(text)을 직접 가지고 있어 Parquet 조인이 필요 없습니다. 질문 벡터로 가까운 코드 청크 상위 몇 개를 찾아 그대로 돌려줍니다.",
      terms: ["벡터 검색", "청크(chunk)", "top_k", "_distance(거리)"],
      lines: [
        { at: 'table = self._code_db.open_table("code_chunks")', text: "예제코드 임베딩이 든 별도 LanceDB 테이블을 엽니다." },
        { at: '"content": str(hit.get("text", ""))[: settings.context_chunk_max_chars],', text: "이 테이블은 본문(text)을 직접 가지므로 조인 없이 바로 사용합니다." },
        { at: '"kind": "code",', text: "이 결과가 '예제코드' 출처임을 표시합니다." },
      ],
      code: `def search_code(self, query: str, top_k: Optional[int] = None) -> list[dict]:
    """예제코드 청크를 벡터검색하여 반환함 (code_chunks는 text를 직접 보유).

    반환 각 dict: {content, source(파일경로), section(섹션명), filename, score, kind="code"}
    """
    top_k = top_k or settings.code_top_k
    try:
        query_vector = self.embeddings.embed_query(query)
        table = self._code_db.open_table("code_chunks")
        hits = table.search(query_vector).limit(top_k).to_pandas()

        results: list[dict] = []
        for _, hit in hits.iterrows():
            results.append({
                "content": str(hit.get("text", ""))[: settings.context_chunk_max_chars],
                "source": str(hit.get("source", "")),
                "filename": str(hit.get("filename", "")),
                "section": str(hit.get("section_title", "")),
                "score": _distance_to_score(float(hit.get("_distance", 1.0))),
                "kind": "code",
            })
        logger.info(f"[RAG] 코드 검색: {len(results)}건")
        return results
    except Exception as e:
        logger.error(f"코드 검색 실패: {e}")
        return []`,
    },
    {
      id: "distance_to_score",
      name: "_distance_to_score()",
      fileId: "rag",
      summary: "LanceDB의 거리값(작을수록 유사)을 0~1 유사도 점수로 바꾸는 함수",
      how: "벡터 검색은 '거리'를 주는데, 거리는 작을수록 비슷합니다. 사람이 보기 편하게 1/(1+거리) 공식으로 뒤집어, 거리가 0이면 1.0(가장 유사), 멀수록 0에 가까운 점수로 변환합니다.",
      terms: ["_distance(거리)", "코사인 유사도", "관련성 점수"],
      lines: [
        { at: "return round(1.0 / (1.0 + max(distance, 0.0)), 4)", text: "거리가 작을수록 1.0에 가까운 점수가 되도록 변환하고 소수 4자리로 반올림합니다." },
      ],
      code: `def _distance_to_score(distance: float) -> float:
    """LanceDB의 _distance(작을수록 유사)를 0~1 유사도 점수로 변환함.

    cosine/L2 거리 d에 대해 1/(1+d)로 단조 감소 변환 — 거리가 0이면 1.0, 멀수록 0에 수렴.
    """
    return round(1.0 / (1.0 + max(distance, 0.0)), 4)`,
    },

    // ───────────────────────── agents/web_agent.py ─────────────────────────
    {
      id: "load_web_page",
      name: "load_web_page()",
      fileId: "web",
      summary: "웹 페이지를 받아 본문 텍스트만 추출하는 함수 (실패 시 None)",
      how: "브라우저인 척 요청해 HTML을 받고, BeautifulSoup으로 script·nav·footer 같은 군더더기 태그를 지운 뒤 본문 텍스트만 뽑습니다. 내용이 너무 짧거나 차단 페이지면 None을 돌려주고, 길면 적당히 잘라 반환합니다.",
      terms: ["크롤링", "BeautifulSoup", "User-Agent", "정규표현식(regex)"],
      lines: [
        { at: "response = requests.get(url, headers=_HEADERS, timeout=settings.web_request_timeout)", text: "브라우저처럼 보이는 헤더로 페이지를 요청합니다(봇 차단 완화)." },
        { at: 'soup = BeautifulSoup(response.text, "html.parser")', text: "받은 HTML을 분석할 수 있는 형태로 파싱합니다." },
        { at: "tag.decompose()", text: "본문이 아닌 script·nav·footer 등 군더더기 태그를 트리에서 삭제합니다." },
        { at: "content = re.sub(", text: "연속된 공백·줄바꿈을 하나의 공백으로 압축해 깔끔하게 만듭니다." },
        { at: "if not content or is_error_page(content):", text: "내용이 없거나 에러/차단 페이지면 None을 돌려줍니다." },
      ],
      code: `def load_web_page(url: str, max_chars: Optional[int] = None) -> Optional[str]:
    """웹 페이지를 받아 본문 텍스트만 추출하여 반환함 (실패 시 None)."""
    if max_chars is None:
        max_chars = settings.web_page_max_chars
    try:
        response = requests.get(url, headers=_HEADERS, timeout=settings.web_request_timeout)
        response.raise_for_status()
        # 인코딩 자동 추정으로 한글 깨짐 완화
        response.encoding = response.apparent_encoding or response.encoding

        soup = BeautifulSoup(response.text, "html.parser")
        # 본문이 아닌 구조/부가 요소를 제거하여 노이즈를 줄임
        for tag in soup.find_all(["script", "style", "nav", "footer", "header", "aside", "form", "noscript", "iframe", "svg"]):
            tag.decompose()  # 태그를 트리에서 완전히 삭제함

        content = soup.get_text(separator=" ", strip=True)
        content = re.sub(r"\\s+", " ", content)  # 연속 공백을 하나로 압축

        if not content or is_error_page(content):
            return None
        if len(content) > max_chars:
            content = content[:max_chars] + "..."
        return content
    except Exception as e:
        logger.warning(f"웹 페이지 로드 실패 ({url}): {e}")
        return None`,
    },
    {
      id: "web_search",
      name: "WebAgent.search()",
      fileId: "web",
      summary: "DuckDuckGo로 검색하고 각 결과 URL의 본문까지 가져오는 함수",
      how: "DuckDuckGo(API 키 불필요)로 검색해 결과 목록을 받고, 각 URL의 본문을 load_web_page로 추출합니다. 본문 추출 실패를 감안해 목표의 2배를 검색하고, 성공분만 목표 개수까지 모읍니다. 모든 예외는 흡수해 빈 결과로 흐름을 유지합니다.",
      terms: ["DuckDuckGo(ddgs)", "크롤링", "장애 격리"],
      lines: [
        { at: "from ddgs import DDGS", text: "DuckDuckGo 검색 클라이언트를 불러옵니다(공식 API 키 불필요)." },
        { at: 'raw = list(ddgs.text(query, max_results=max_results * 2, region="kr-kr"))', text: "본문 로드 실패를 감안해 목표의 2배를 한국 지역 기준으로 검색합니다." },
        { at: "content = load_web_page(url)", text: "각 결과 URL의 본문을 추출합니다(실패하면 None)." },
        { at: "if len(results) >= max_results:", text: "목표 개수를 채우면 더 이상 가져오지 않고 멈춥니다." },
      ],
      code: `def search(self, query: str, max_results: Optional[int] = None) -> list[dict]:
    """DuckDuckGo로 검색하고 각 결과 URL의 본문을 함께 추출하여 반환함.

    반환 각 dict: {title, snippet, url, content(본문 또는 None)}
    """
    max_results = max_results or self.max_results
    try:
        # ddgs: DuckDuckGo 검색 클라이언트 (공식 API 키 불필요)
        from ddgs import DDGS
        with DDGS() as ddgs:
            # 본문 로드 실패분을 감안해 목표의 2배를 받아 성공분만 사용
            raw = list(ddgs.text(query, max_results=max_results * 2, region="kr-kr"))

        results: list[dict] = []
        for item in raw:
            if len(results) >= max_results:
                break
            url = item.get("href") or item.get("url", "")
            if not url:
                continue
            content = load_web_page(url)
            results.append({
                "title": item.get("title", ""),
                "snippet": item.get("body", ""),
                "url": url,
                "content": content,
            })
        logger.info(f"[Web] 검색 결과: {len(results)}건")
        return results
    except Exception as e:
        logger.error(f"웹 검색 실패(빈 결과 반환): {e}")
        return []`,
    },

    // ───────────────────────── agents/youtube_agent.py ─────────────────────────
    {
      id: "build_transcript_client",
      name: "_build_transcript_client()",
      fileId: "youtube",
      summary: "자막 추출 클라이언트를 만드는 함수 (Webshare 프록시가 있으면 적용)",
      how: "YouTube는 요청이 많으면 IP를 차단합니다. .env에 Webshare 프록시 자격증명이 있고 use_proxy가 켜져 있으면 프록시를 단 클라이언트를, 없으면 직결 클라이언트를 만듭니다. (클라이언트, 프록시사용여부)를 함께 돌려줘 나중에 직결로 전환할 수 있게 합니다.",
      terms: ["youtube-transcript-api", "Webshare 프록시", "자막(transcript)"],
      lines: [
        { at: "from youtube_transcript_api import YouTubeTranscriptApi", text: "자막을 가져오는 라이브러리(1.x 버전)를 불러옵니다." },
        { at: 'user = os.getenv("YT_WEBSHARE_USER")', text: ".env에 저장된 Webshare 프록시 아이디를 읽습니다(없으면 None)." },
        { at: "if use_proxy and user and password:", text: "프록시 사용이 켜져 있고 자격증명이 있으면 프록시를 적용합니다." },
        { at: "return YouTubeTranscriptApi(proxy_config=proxy_config), True", text: "프록시를 단 클라이언트와 '프록시 사용 중(True)'을 함께 돌려줍니다." },
        { at: "return YouTubeTranscriptApi(), False", text: "프록시 없이 직결 클라이언트와 'False'를 돌려줍니다." },
      ],
      code: `def _build_transcript_client(use_proxy: bool = True):
    """youtube-transcript-api 클라이언트를 생성함 (use_proxy + Webshare 자격증명이 있으면 프록시 적용).

    Webshare 레지덴셜 프록시는 YouTube IP 차단 우회에 효과적임. 자격증명이 없거나 use_proxy=False면 직결로 동작함.
    """
    from youtube_transcript_api import YouTubeTranscriptApi  # 1.x 인스턴스 API
    from youtube_transcript_api.proxies import WebshareProxyConfig  # Webshare 프록시 설정 클래스

    user = os.getenv("YT_WEBSHARE_USER")
    password = os.getenv("YT_WEBSHARE_PASS")
    if use_proxy and user and password:
        proxy_config = WebshareProxyConfig(proxy_username=user, proxy_password=password)
        logger.debug("[YouTube] Webshare 프록시 적용")
        return YouTubeTranscriptApi(proxy_config=proxy_config), True
    logger.debug("[YouTube] 프록시 없이 직결")
    return YouTubeTranscriptApi(), False`,
    },
    {
      id: "chunk_transcript",
      name: "_chunk_transcript()",
      fileId: "youtube",
      summary: "잘게 쪼개진 자막 조각들을 일정 시간(예: 2분) 단위 청크로 묶는 함수",
      how: "자막은 몇 초짜리 조각으로 옵니다. 조각의 끝 시각이 현재 청크 경계(예: 120초)를 넘으면 그동안 모은 버퍼를 한 청크로 확정하고 경계를 다음 단계로 옮깁니다. 이렇게 묶으면 문맥이 보존되고 타임스탬프도 붙일 수 있습니다.",
      terms: ["청크(chunk)", "자막(transcript)", "버퍼(buffer)"],
      lines: [
        { at: "chunks: list[dict] = []", text: "완성된 청크들을 담을 리스트를 준비합니다." },
        { at: "time_limit = chunk_seconds", text: "첫 청크 경계 시각을 정합니다(예: 120초)." },
        { at: "piece_end = piece.get(\"start\", 0) + piece.get(\"duration\", 0)", text: "이 자막 조각이 끝나는 시각을 계산합니다(시작 + 길이)." },
        { at: "if piece_end > time_limit:", text: "조각 끝이 현재 경계를 넘으면 모아둔 버퍼를 한 청크로 확정합니다." },
        { at: "buffer.append(piece)", text: "현재 조각을 버퍼에 모읍니다." },
        { at: "return chunks", text: "완성된 청크 리스트를 돌려줍니다." },
      ],
      code: `def _chunk_transcript(pieces: list[dict], chunk_seconds: int) -> list[dict]:
    """raw 자막 스니펫([{text,start,duration}])을 chunk_seconds 단위 청크로 묶음.

    스니펫 끝 시각이 현재 청크 경계를 넘으면 버퍼를 한 청크로 확정하고 경계를 한 단계 전진함.
    각 청크에 타임스탬프 표시·바로가기 URL 정보를 함께 부여함.
    """
    chunks: list[dict] = []
    buffer: list[dict] = []
    chunk_start = 0
    time_limit = chunk_seconds
    for piece in pieces:
        piece_end = piece.get("start", 0) + piece.get("duration", 0)
        if piece_end > time_limit:
            if buffer:
                chunks.append(_make_chunk(buffer, chunk_start))
            buffer = []
            chunk_start = time_limit
            time_limit += chunk_seconds
        buffer.append(piece)
    if buffer:
        chunks.append(_make_chunk(buffer, chunk_start))
    return chunks`,
    },
    {
      id: "load_transcript",
      name: "YouTubeAgent._load_transcript()",
      fileId: "youtube",
      summary: "영상 하나의 자막을 추출해 (청크 리스트, 프록시오류여부)를 돌려주는 함수",
      how: "자막을 받아 청크로 묶어 돌려줍니다. 자막이 없거나 차단되면 영상 단위로 건너뛰되(빈 리스트), 오류가 프록시 연결 문제면 두 번째 값을 True로 줘 호출부가 직결로 전환해 재시도할 수 있게 합니다.",
      terms: ["자막(transcript)", "청크(chunk)", "Webshare 프록시"],
      lines: [
        { at: "fetched = api.fetch(video_id, languages=self.languages)", text: "선호 언어(한국어 우선, 없으면 영어)로 자막을 가져옵니다." },
        { at: "pieces = fetched.to_raw_data()", text: "자막을 {텍스트, 시작, 길이} 조각들의 목록으로 변환합니다." },
        { at: 'is_proxy_error = "Proxy" in type(e).__name__', text: "오류 종류 이름에 'Proxy'가 있으면 프록시 연결 문제로 판단합니다." },
        { at: "return [], is_proxy_error", text: "실패 시 빈 리스트와 프록시 오류 여부를 돌려줍니다." },
      ],
      code: `def _load_transcript(self, api, video_id: str) -> tuple[list[dict], bool]:
    """단일 영상의 자막을 추출하여 (청크 리스트, 프록시오류여부)를 반환함 (실패 시 빈 리스트).

    프록시 연결 자체가 실패(ProxyError)하면 두 번째 값을 True로 반환하여 호출부가 직결 폴백하도록 함.
    """
    try:
        fetched = api.fetch(video_id, languages=self.languages)
        pieces = fetched.to_raw_data()  # [{text, start, duration}, ...]
        return _chunk_transcript(pieces, self.chunk_seconds), False
    except Exception as e:
        # 자막 없음·비활성·차단 등은 영상 단위로 건너뜀 (전체 흐름은 계속)
        is_proxy_error = "Proxy" in type(e).__name__
        logger.warning(f"[YouTube] 자막 추출 실패({video_id}): {type(e).__name__}")
        return [], is_proxy_error`,
    },
    {
      id: "youtube_search",
      name: "YouTubeAgent.search()",
      fileId: "youtube",
      summary: "영상을 검색하고 자막을 추출해 결과로 모으는 함수 (프록시 실패 시 직결 전환)",
      how: "scrapetube로 영상을 검색하고(자막 없는 영상을 감안해 목표의 3배), 각 영상의 자막을 추출합니다. 프록시 연결이 죽으면 직결 클라이언트로 한 번 전환해 같은 영상을 재시도합니다. 모든 예외는 흡수해 빈 결과로 흐름을 유지합니다.",
      terms: ["scrapetube", "자막(transcript)", "Webshare 프록시", "장애 격리"],
      lines: [
        { at: "api, proxy_active = _build_transcript_client(use_proxy=True)", text: "먼저 프록시를 단 자막 클라이언트를 준비합니다." },
        { at: 'videos = scrapetube.get_search(query, limit=max_results * 3, sort_by="relevance")', text: "자막 없는 영상을 감안해 목표의 3배를 관련도순으로 검색합니다." },
        { at: "chunks, proxy_error = self._load_transcript(api, video_id)", text: "이 영상의 자막을 추출합니다(청크, 프록시오류여부)." },
        { at: "if proxy_error and proxy_active:", text: "프록시가 죽었으면 직결로 한 번 전환해 같은 영상을 재시도합니다." },
        { at: '"url": f"https://www.youtube.com/watch?v={video_id}",', text: "영상 바로가기 URL을 결과에 담습니다." },
      ],
      code: `def search(self, query: str, max_results: Optional[int] = None) -> list[dict]:
    """영상을 검색하고 자막이 있는 영상만 결과로 반환함.

    반환 각 dict: {title, url, channel, transcript_chunks, has_transcript}
    """
    max_results = max_results or self.max_results
    try:
        # 우선 Webshare 프록시로 시도하고, 프록시 연결이 실패하면 직결 클라이언트로 한 번 전환함
        api, proxy_active = _build_transcript_client(use_proxy=True)
        # 자막 없는 영상을 감안해 목표의 3배를 검색
        videos = scrapetube.get_search(query, limit=max_results * 3, sort_by="relevance")

        results: list[dict] = []
        for video in videos:
            if len(results) >= max_results:
                break
            video_id = video.get("videoId", "")
            if not video_id or len(video_id) < 5:
                continue
            title = _extract_video_title(video)
            if not title or title == "제목 없음" or len(title) < 2:
                continue
            channel = video.get("ownerText", {}).get("runs", [{}])[0].get("text", "알 수 없음")

            chunks, proxy_error = self._load_transcript(api, video_id)
            # 프록시 자체가 죽은 경우(ProxyError) 직결로 1회 전환 후 같은 영상을 재시도함
            if proxy_error and proxy_active:
                logger.info("[YouTube] 프록시 실패 → 직결로 전환하여 재시도")
                api, proxy_active = _build_transcript_client(use_proxy=False)
                chunks, _ = self._load_transcript(api, video_id)
            results.append({
                "title": title,
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "channel": channel,
                "transcript_chunks": chunks,
                "has_transcript": len(chunks) > 0,
            })
        logger.info(f"[YouTube] 검색 결과: {len(results)}건")
        return results
    except Exception as e:
        logger.error(f"YouTube 검색 실패(빈 결과 반환): {e}")
        return []`,
    },

    // ───────────────────────── agents/code_agent.py ─────────────────────────
    {
      id: "code_prompt",
      name: "CODE_GENERATION_PROMPT (상수)",
      fileId: "code",
      summary: "코드 생성용 프롬프트 틀 — 참고자료와 요청을 끼워 넣는 빈칸이 있는 문자열",
      how: "{context}(RAG 참고 자료)와 {request}(사용자 요청)를 나중에 채워 넣는 템플릿입니다. 실행 가능한 완전한 코드를 한국어 주석과 함께, 설명 없이 코드 블록 하나로만 출력하라고 규칙을 명시합니다.",
      terms: ["프롬프트(prompt)", "템플릿(template)"],
      lines: [
        { at: 'CODE_GENERATION_PROMPT = """당신은 Python 코드 생성 전문가임.', text: "코드 생성 지시문의 시작입니다(여러 줄 문자열)." },
        { at: "## 참고 자료(예제코드)", text: "이 아래 {context} 자리에 RAG로 찾은 예제가 채워집니다." },
        { at: "4. 반드시 ", text: "설명 문장 없이 ```python ... ``` 코드 블록 하나로만 출력하라고 못박습니다." },
      ],
      code: `CODE_GENERATION_PROMPT = """당신은 Python 코드 생성 전문가임.
아래 참고 자료(예제코드)와 요청을 바탕으로 실행 가능한 완전한 Python 코드를 작성함.

## 참고 자료(예제코드)
{context}

## 요청사항
{request}

## 작성 규칙
1. 실행 가능한 완전한 Python 코드 작성 (필요한 import 포함)
2. 주석은 한국어로 작성
3. 기본적인 에러 처리 포함
4. 반드시 \`\`\`python ... \`\`\` 코드 블록 하나로만 출력 (설명 문장 금지)

## 생성할 코드:
"""`,
    },
    {
      id: "generate_code",
      name: "CodeAgent.generate_code()",
      fileId: "code",
      summary: "프롬프트 틀에 자료·요청을 채워 LLM으로 코드를 생성하고 코드 블록만 추출하는 함수",
      how: "CODE_GENERATION_PROMPT의 빈칸을 채워 LLM에 보냅니다. 정확성을 위해 temperature를 낮게(0.3) 둡니다. 응답에서 마크다운 코드 블록 안의 코드만 _extract_code로 뽑아 돌려줍니다.",
      terms: ["프롬프트(prompt)", "temperature", "max_tokens"],
      lines: [
        { at: "prompt = CODE_GENERATION_PROMPT.format(", text: "프롬프트 틀의 {context}/{request} 빈칸을 실제 값으로 채웁니다." },
        { at: "response = self.llm.generate(prompt=prompt, temperature=temperature or 0.3, max_tokens=settings.max_tokens)", text: "낮은 temperature(0.3)로 일관적인 코드를 생성합니다." },
        { at: "return self._extract_code(response)", text: "응답에서 코드 블록 내부만 뽑아 돌려줍니다." },
      ],
      code: `def generate_code(self, request: str, context: str = "", temperature: Optional[float] = None) -> str:
    """요청과 참고 자료로 코드를 생성하고 코드 블록만 추출하여 반환함."""
    prompt = CODE_GENERATION_PROMPT.format(
        context=context or "참고 자료 없음",
        request=request,
    )
    try:
        # temperature=0.3: 낮게 설정해 일관적이고 정확한 코드 생성 (창의성보다 정확성 우선)
        response = self.llm.generate(prompt=prompt, temperature=temperature or 0.3, max_tokens=settings.max_tokens)
        return self._extract_code(response)
    except Exception as e:
        logger.error(f"코드 생성 실패: {e}")
        return ""`,
    },
    {
      id: "extract_code",
      name: "CodeAgent._extract_code()",
      fileId: "code",
      summary: "LLM 응답에서 마크다운 코드 블록(```python … ```) 안의 코드만 뽑아내는 함수",
      how: "LLM은 가끔 설명 문장을 덧붙입니다. 응답에서 ```python 표시 다음부터 닫는 ``` 전까지를 잘라 순수 코드만 얻습니다. 언어 표시가 없으면 일반 ``` 블록을, 블록 자체가 없으면 응답 전체를 코드로 봅니다.",
      terms: ["마크다운 코드 블록", "문자열 슬라이싱"],
      lines: [
        { at: 'if "```python" in response:', text: "응답에 ```python 표시가 있으면 그 블록을 우선으로 찾습니다." },
        { at: "start = response.find(\"```\") + 3", text: "언어 표시 없는 ``` 블록일 때, 여는 표시 다음 위치를 시작점으로 잡습니다." },
        { at: "# 코드 블록이 없으면 응답 전체를 코드로 간주", text: "어떤 코드 블록 표시도 없으면 응답 전체를 코드로 취급합니다." },
        { at: "return response.strip()", text: "앞뒤 공백을 정리한 전체 응답을 코드로 돌려줍니다." },
      ],
      code: `def _extract_code(self, response: str) -> str:
    """LLM 응답에서 마크다운 코드 블록(\`\`\`python ... \`\`\`) 내부 코드만 추출함."""
    if "\`\`\`python" in response:
        start = response.find("\`\`\`python") + len("\`\`\`python")
        end = response.find("\`\`\`", start)
        if end > start:
            return response[start:end].strip()
    if "\`\`\`" in response:
        start = response.find("\`\`\`") + 3
        end = response.find("\`\`\`", start)
        if end > start:
            return response[start:end].strip()
    # 코드 블록이 없으면 응답 전체를 코드로 간주
    return response.strip()`,
    },
    {
      id: "validate_code",
      name: "CodeAgent.validate_code()",
      fileId: "code",
      summary: "ast.parse로 코드 문법이 올바른지 검사하는 함수 (실행은 안 함)",
      how: "ast.parse는 코드를 실행하지 않고 문법 구조만 분석합니다. 위험한 실행 없이 '문법 오류 여부'만 안전하게 확인할 수 있습니다. 통과하면 (True, 메시지), 오류면 (False, 오류내용)을 돌려줍니다.",
      terms: ["ast.parse", "구문(syntax) 검증", "SyntaxError"],
      lines: [
        { at: "if not code.strip():", text: "코드가 비어 있으면 검증 실패로 처리합니다." },
        { at: "ast.parse(code)", text: "코드를 실행하지 않고 문법만 분석합니다(안전)." },
        { at: 'return True, "구문 검사 통과"', text: "문법 오류가 없으면 통과를 알립니다." },
        { at: "except SyntaxError as e:", text: "문법 오류가 나면 그 내용을 담아 실패를 돌려줍니다." },
      ],
      code: `def validate_code(self, code: str) -> tuple[bool, str]:
    """ast.parse로 코드 구문 유효성을 검증함 (실행하지 않으므로 안전)."""
    if not code.strip():
        return False, "코드가 비어있음"
    try:
        ast.parse(code)
        return True, "구문 검사 통과"
    except SyntaxError as e:
        return False, f"구문 오류: {e}"`,
    },
    {
      id: "generate_with_retry",
      name: "CodeAgent.generate_with_retry()",
      fileId: "code",
      summary: "문법 검증을 통과할 때까지 오류를 피드백하며 최대 2회 더 재생성하는 함수",
      how: "코드를 생성해 검증하고, 통과하면 즉시 (코드, True)를 돌려줍니다. 실패하면 이전 오류 메시지를 다음 프롬프트의 참고자료에 덧붙여 '같은 실수를 반복하지 마라'고 알려준 뒤 다시 생성합니다. 끝까지 실패하면 (마지막 코드, False)를 돌려줍니다.",
      terms: ["구문(syntax) 검증", "재시도(retry)", "ast.parse"],
      lines: [
        { at: "for attempt in range(max_retries + 1):", text: "최초 1회 + 재시도 2회 = 최대 3번 시도하는 반복문입니다." },
        { at: "is_valid, message = self.validate_code(code)", text: "생성한 코드의 문법을 검증합니다." },
        { at: "if is_valid:", text: "문법이 통과하면 바로 (코드, True)를 돌려주고 끝냅니다." },
        { at: "if attempt < max_retries:", text: "재시도 여유가 있으면 이전 오류를 다음 시도에 피드백합니다." },
        { at: "return code, False", text: "끝까지 통과 못 하면 마지막 코드와 False를 돌려줍니다." },
      ],
      code: `def generate_with_retry(self, request: str, context: str = "", max_retries: int = 2) -> tuple[str, bool]:
    """구문 검증을 통과할 때까지 최대 max_retries회 재생성함 (오류를 컨텍스트로 피드백)."""
    code = ""
    for attempt in range(max_retries + 1):
        code = self.generate_code(request, context)
        is_valid, message = self.validate_code(code)
        if is_valid:
            logger.info(f"[Code] 구문 검증 성공 (시도 {attempt + 1})")
            return code, True
        logger.warning(f"[Code] 구문 검증 실패 (시도 {attempt + 1}/{max_retries + 1}): {message}")
        # 다음 시도에 이전 오류를 알려 같은 실수를 반복하지 않게 함
        if attempt < max_retries:
            context += f"\\n\\n이전 시도 오류: {message}\\n이 오류를 수정하여 다시 작성함."
    return code, False`,
    },

    // ───────────────────────── llm/ollama_llm.py ─────────────────────────
    {
      id: "strip_thinking_tags",
      name: "strip_thinking_tags()",
      fileId: "llm",
      summary: "qwen3 응답의 <think>…</think> 추론 블록을 제거해 본문만 남기는 함수",
      how: "qwen3는 종종 생각 과정을 <think> 태그로 감싸 출력해 점수·코드 파싱을 깨뜨립니다. 닫는 </think>가 있으면 그 뒤(실제 답변)만 취하고, 정규표현식으로 남은 <think> 블록까지 지워 이중으로 방어합니다.",
      terms: ["thinking 모드", "<think> 태그", "정규표현식(regex)", "re.DOTALL"],
      lines: [
        { at: 'if "</think>" in text:', text: "닫는 </think>가 있으면 그 뒤(실제 답변)만 남깁니다." },
        { at: 'text = text.split("</think>")[-1]', text: "</think> 기준으로 잘라 마지막(답변) 조각만 취합니다." },
        { at: 'text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)', text: "열고 닫힌 <think>…</think> 블록을 통째로 지웁니다." },
        { at: 'text = re.sub(r"<think>.*", "", text, flags=re.DOTALL)', text: "닫히지 않은 <think> 이후의 잔여물도 지웁니다." },
      ],
      code: `def strip_thinking_tags(text: str) -> str:
    """qwen3 응답의 <think>...</think> 추론 블록을 제거하고 본문만 반환함.

    "think": False 로도 드물게 태그가 남을 수 있어 호출 결과를 한 번 더 정제함.
    """
    if not text:
        return ""
    # </think> 가 있으면 그 이후(실제 답변)만 취함
    if "</think>" in text:
        text = text.split("</think>")[-1]
    # 열고 닫힌 <think>...</think> 블록 제거 (DOTALL: 줄바꿈 포함 매칭)
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    # 닫히지 않은 <think> 이후 잔여 제거
    text = re.sub(r"<think>.*", "", text, flags=re.DOTALL)
    return text.strip()`,
    },
    {
      id: "ollama_generate",
      name: "OllamaLLM.generate()",
      fileId: "llm",
      summary: "Ollama로 qwen3:8b에 프롬프트를 보내 텍스트를 생성하는 핵심 호출 함수",
      how: "시스템 프롬프트가 있으면 본문 앞에 붙여 하나의 프롬프트로 만들고, think:False로 추론 출력을 끈 채 /api/generate를 호출합니다. 응답을 받아 혹시 남은 <think> 태그를 제거하고 깨끗한 본문만 돌려줍니다.",
      terms: ["Ollama", "qwen3:8b", "thinking 모드", "temperature", "max_tokens", "시스템 프롬프트(system prompt)"],
      lines: [
        { at: 'url = f"{self.base_url}/api/generate"', text: "Ollama의 텍스트 생성 API 주소를 만듭니다." },
        { at: "full_prompt = f\"{system_prompt}", text: "시스템 프롬프트가 있으면 본문 앞에 붙여 하나로 합칩니다." },
        { at: '"think": False,    # qwen3 thinking 비활성화 (파싱 안정성 확보)', text: "추론 출력을 꺼 점수·코드 파싱이 깨지지 않게 합니다." },
        { at: "response = requests.post(url, json=payload, timeout=settings.llm_timeout)", text: "구성한 요청을 Ollama 서버에 보냅니다(로컬은 느릴 수 있어 타임아웃 넉넉히)." },
        { at: 'if not generated and result.get("thinking"):', text: "본문이 비고 thinking에만 내용이 온 예외 상황을 보완합니다." },
        { at: "cleaned = strip_thinking_tags(generated)", text: "응답에서 남은 <think> 태그를 제거해 본문만 남깁니다." },
      ],
      code: `def generate(
    self,
    prompt: str,
    system_prompt: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
) -> str:
    """프롬프트로 텍스트를 생성하고 thinking 태그가 제거된 본문을 반환함.

    Ollama /api/generate 를 stream=False 로 호출해 전체 응답을 한 번에 받음.
    """
    url = f"{self.base_url}/api/generate"

    # 시스템 프롬프트가 있으면 본문 앞에 결합
    full_prompt = f"{system_prompt}\\n\\n{prompt}" if system_prompt else prompt

    payload = {
        "model": self.model,
        "prompt": full_prompt,
        "stream": False,   # 스트리밍 비활성화 — 전체 응답을 한 번에 수신
        "think": False,    # qwen3 thinking 비활성화 (파싱 안정성 확보)
        "options": {
            "temperature": temperature if temperature is not None else self.temperature,
            "num_predict": max_tokens or self.max_tokens,
        },
    }

    try:
        logger.debug(f"LLM 생성 요청: model={self.model}, prompt_len={len(full_prompt)}")
        response = requests.post(url, json=payload, timeout=settings.llm_timeout)
        response.raise_for_status()
        result = response.json()
        generated = result.get("response", "")
        # think:False 가 무시되어 response가 비고 thinking에만 내용이 온 경우 대비
        if not generated and result.get("thinking"):
            generated = result["thinking"]
        cleaned = strip_thinking_tags(generated)
        logger.debug(f"LLM 생성 완료: response_len={len(cleaned)}")
        return cleaned
    except requests.exceptions.RequestException as e:
        logger.error(f"Ollama API 호출 실패: {e}")
        raise RuntimeError(f"Ollama API 호출 실패: {e}")`,
    },
    {
      id: "ollama_is_available",
      name: "OllamaLLM.is_available()",
      fileId: "llm",
      summary: "Ollama 서버에 접속할 수 있는지 확인하는 함수",
      how: "Ollama의 모델 목록 API(/api/tags)에 가볍게 요청을 보내, 200 응답이 오면 서버가 살아 있다고 판단합니다. 접속 자체가 안 되면 False를 돌려줘 사이드바에서 빨간 경고를 띄웁니다.",
      terms: ["Ollama"],
      lines: [
        { at: 'response = requests.get(f"{self.base_url}/api/tags", timeout=5)', text: "모델 목록 API에 5초 제한으로 가볍게 요청을 보냅니다." },
        { at: "return response.status_code == 200", text: "정상(200) 응답이면 서버가 살아 있다고 판단합니다." },
      ],
      code: `def is_available(self) -> bool:
    """Ollama 서버 접근 가능 여부 확인."""
    try:
        response = requests.get(f"{self.base_url}/api/tags", timeout=5)
        return response.status_code == 200
    except requests.exceptions.RequestException:
        return False`,
    },

    // ───────────────────────── llm/ollama_embeddings.py ─────────────────────────
    {
      id: "embed_query",
      name: "OllamaEmbeddings.embed_query()",
      fileId: "embed",
      summary: "질문 텍스트를 4096차원 숫자 벡터로 바꾸는 함수 (검색의 입력)",
      how: "벡터 검색을 하려면 질문을 숫자 벡터로 바꿔야 합니다. Ollama의 /api/embeddings에 텍스트를 보내 qwen3-embedding으로 4096차원 벡터를 받습니다. 중요한 점: 스토어 인덱싱 때와 같은 모델을 써야 벡터 공간이 일치해 검색이 제대로 됩니다.",
      terms: ["임베딩(embedding)", "벡터(vector)", "4096차원", "qwen3-embedding"],
      lines: [
        { at: 'url = f"{self.base_url}/api/embeddings"', text: "Ollama의 임베딩 API 주소를 만듭니다." },
        { at: 'payload = {"model": self.model, "prompt": text}', text: "어떤 모델로 어떤 텍스트를 임베딩할지 요청 본문을 구성합니다." },
        { at: 'embedding = response.json().get("embedding", [])', text: "응답에서 임베딩 벡터(숫자 배열)를 꺼냅니다." },
        { at: "if not embedding:", text: "벡터가 비어 있으면 오류를 발생시켜 문제를 빨리 드러냅니다." },
      ],
      code: `def embed_query(self, text: str) -> list[float]:
    """단일 텍스트를 임베딩 벡터로 변환함 (LanceDB 검색 입력으로 사용).

    Ollama /api/embeddings 는 prompt 입력에 대해 단일 embedding 배열을 반환함.
    """
    url = f"{self.base_url}/api/embeddings"
    payload = {"model": self.model, "prompt": text}
    try:
        response = requests.post(url, json=payload, timeout=120)
        response.raise_for_status()
        embedding = response.json().get("embedding", [])
        if not embedding:
            raise RuntimeError("Ollama 응답에 embedding 필드가 없음")
        logger.debug(f"임베딩 완료: dim={len(embedding)}")
        return embedding
    except requests.exceptions.RequestException as e:
        logger.error(f"Ollama Embed API 호출 실패: {e}")
        raise RuntimeError(f"Ollama Embed API 호출 실패: {e}")`,
    },

    // ───────────────────────── utils/helpers.py ─────────────────────────
    {
      id: "rewrite_query",
      name: "rewrite_query()",
      fileId: "helpers",
      summary: "검색이 더 잘 되도록 질문을 LLM으로 다시 쓰는 함수 (재시도 시 사용)",
      how: "재시도 단계에서 원래 질문을 LLM에 보내 핵심 키워드 중심으로, 기술 용어는 영어 병기해 한 줄로 다시 씁니다. 여러 줄이 와도 첫 비어있지 않은 줄만 쓰고, 실패하면 원래 질문을 그대로 돌려줍니다.",
      terms: ["쿼리 재작성", "프롬프트(prompt)"],
      lines: [
        { at: 'prompt = f"""다음 질문을 검색에 더 효과적인 형태로 재작성함.', text: "질문을 검색하기 좋게 다듬으라는 지시문을 만듭니다." },
        { at: "rewritten = llm.generate(prompt=prompt, temperature=0.3, max_tokens=200).strip()", text: "LLM으로 재작성 결과를 받습니다." },
        { at: "rewritten = next((line.strip() for line in rewritten.splitlines() if line.strip()), \"\")", text: "여러 줄 중 비어있지 않은 첫 줄만 골라 씁니다." },
        { at: "return original_query", text: "재작성에 실패하면 원래 질문을 그대로 돌려줍니다." },
      ],
      code: `def rewrite_query(original_query: str, llm: Optional[OllamaLLM] = None) -> str:
    """검색 효율을 높이도록 쿼리를 재작성함 (재시도 시 사용)."""
    llm = llm or OllamaLLM()
    prompt = f"""다음 질문을 검색에 더 효과적인 형태로 재작성함.
- 핵심 키워드를 추출하고 명확하게 표현
- 불필요한 조사/어미 제거
- 기술 용어는 영어 병기
- 재작성된 쿼리만 한 줄로 출력

원본 질문: {original_query}

재작성된 쿼리:"""
    try:
        rewritten = llm.generate(prompt=prompt, temperature=0.3, max_tokens=200).strip()
        # 여러 줄이 와도 첫 비어있지 않은 줄만 사용
        rewritten = next((line.strip() for line in rewritten.splitlines() if line.strip()), "")
        if rewritten:
            return rewritten
    except Exception as e:
        logger.warning(f"쿼리 재작성 실패: {e}")
    return original_query`,
    },
    {
      id: "calculate_relevance_score",
      name: "calculate_relevance_score()",
      fileId: "helpers",
      summary: "질문과 답변의 키워드가 얼마나 겹치는지로 관련성을 빠르게 계산하는 함수",
      how: "추가 LLM 호출 없이 결정적으로 점수를 냅니다. 질문에서 2글자 이상 단어를 뽑아, 그중 몇 개가 답변에 등장하는지 비율을 0~1로 계산합니다. Supervisor의 Q&A 채점(④ 관련성)에 쓰입니다.",
      terms: ["휴리스틱(heuristic)", "관련성 점수", "정규표현식(regex)"],
      lines: [
        { at: "tokens = [t for t in re.findall(r\"[0-9A-Za-z가-힣]+\", question.lower()) if len(t) >= 2]", text: "질문에서 2글자 이상 단어(한글/영문/숫자)만 뽑습니다." },
        { at: "matched = sum(1 for t in set(tokens) if t in answer_lower)", text: "그 단어들 중 답변에 실제로 등장하는 개수를 셉니다." },
        { at: "return round(matched / len(set(tokens)), 4)", text: "등장 비율(0~1)을 관련성 점수로 돌려줍니다." },
      ],
      code: `def calculate_relevance_score(question: str, answer: str) -> float:
    """질문과 답변의 관련성을 키워드 겹침 비율로 계산함 (0.0~1.0, LLM 미사용).

    질문에서 2글자 이상 토큰을 뽑아 답변에 등장하는 비율을 점수로 사용함 — 빠르고 결정적임.
    """
    # 한글/영문/숫자만 남기고 토큰화
    tokens = [t for t in re.findall(r"[0-9A-Za-z가-힣]+", question.lower()) if len(t) >= 2]
    if not tokens:
        return 0.5
    answer_lower = answer.lower()
    matched = sum(1 for t in set(tokens) if t in answer_lower)
    return round(matched / len(set(tokens)), 4)`,
    },
    {
      id: "format_sources",
      name: "format_sources()",
      fileId: "helpers",
      summary: "교재/웹/YouTube 검색 결과를 사용자에게 보여줄 출처 목록으로 정리하는 함수",
      how: "각 소스에서 상위 몇 개씩(교재 3, 웹 3, 영상 2) 골라 '[교재 1] 파일명 · 섹션', '[웹 1] 제목 - URL'처럼 한 줄씩 만듭니다. 답변 본문 아래에 붙어 어디서 가져왔는지 투명하게 보여줍니다.",
      terms: ["출처(source)", "f-string"],
      lines: [
        { at: "for i, r in enumerate(rag_results[:3], 1):", text: "교재 결과 상위 3개를 번호와 함께 정리합니다." },
        { at: 'label = r.get("filename") or r.get("source", "교재")', text: "파일명이 있으면 그것을, 없으면 출처/기본값 '교재'를 라벨로 씁니다." },
        { at: "for i, r in enumerate(web_results[:3], 1):", text: "웹 결과 상위 3개를 제목·URL과 함께 정리합니다." },
        { at: "for i, r in enumerate(youtube_results[:2], 1):", text: "영상 결과 상위 2개를 제목·URL과 함께 정리합니다." },
      ],
      code: `def format_sources(rag_results: list[dict], web_results: list[dict], youtube_results: list[dict]) -> str:
    """RAG/웹/YouTube 검색 결과를 사용자 표시용 출처 목록으로 포맷함."""
    sources: list[str] = []
    for i, r in enumerate(rag_results[:3], 1):
        label = r.get("filename") or r.get("source", "교재")
        section = r.get("section", "")
        sources.append(f"[교재 {i}] {label}" + (f" · {section}" if section else ""))
    for i, r in enumerate(web_results[:3], 1):
        sources.append(f"[웹 {i}] {r.get('title', 'unknown')} - {r.get('url', '')}")
    for i, r in enumerate(youtube_results[:2], 1):
        sources.append(f"[영상 {i}] {r.get('title', 'unknown')} - {r.get('url', '')}")
    return "\\n".join(sources) if sources else "출처 없음"`,
    },

    // ───────────────────────── utils/file_saver.py ─────────────────────────
    {
      id: "save_code_to_file",
      name: "save_code_to_file()",
      fileId: "filesaver",
      summary: "생성된 코드를 output/ 폴더에 타임스탬프 파일명으로 저장하는 함수",
      how: "요청에서 영문 슬러그를 뽑고 현재 시각을 붙여 파일명을 만든 뒤(예: react_agent_20260601_120000.py), UTF-8로 저장합니다. with 블록을 쓰면 파일이 자동으로 닫힙니다. 성공 여부와 경로를 함께 돌려줍니다.",
      terms: ["타임스탬프(timestamp)", "with open() as f", "UTF-8"],
      lines: [
        { at: 'timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")', text: "현재 시각을 '20260601_120000' 같은 문자열로 만들어 파일명에 씁니다." },
        { at: "filename = f\"{_slug_from_request(request or 'code')}_{timestamp}.py\"", text: "요청 슬러그 + 시각으로 겹치지 않는 파일명을 만듭니다." },
        { at: 'with open(file_path, "w", encoding="utf-8") as f:', text: "파일을 UTF-8로 엽니다. with 블록을 벗어나면 자동으로 닫힙니다." },
        { at: "return True, str(file_path)", text: "저장에 성공하면 True와 파일 경로를 돌려줍니다." },
      ],
      code: `def save_code_to_file(code: str, request: Optional[str] = None, output_dir: Optional[Path] = None) -> tuple[bool, str]:
    """생성된 코드를 파일로 저장하고 (성공여부, 경로)를 반환함."""
    output_dir = output_dir or settings.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{_slug_from_request(request or 'code')}_{timestamp}.py"
    file_path = output_dir / filename
    try:
        # with 블록을 벗어나면 파일이 자동으로 닫힘
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
        logger.info(f"[FileSaver] 코드 저장: {file_path}")
        return True, str(file_path)
    except Exception as e:
        logger.error(f"코드 저장 실패: {e}")
        return False, f"파일 저장 실패: {e}"`,
    },

    // ───────────────────────── utils/logger.py ─────────────────────────
    {
      id: "get_logger",
      name: "get_logger()",
      fileId: "logger",
      summary: "콘솔과 파일에 동시에 로그를 남기는 로거를 이름별로 만들어 주는 함수",
      how: "같은 이름이면 캐시된 로거를 재사용해 핸들러가 중복으로 붙는 것을 막습니다. 파일에는 상세 로그(DEBUG 이상), 콘솔에는 진행상황(INFO 이상)을 남기고, 실행마다 새 로그 파일을 만들어 워크플로 흐름을 추적하기 쉽게 합니다.",
      terms: ["로거(logger)", "핸들러(handler)", "UTF-8"],
      lines: [
        { at: "if name in _loggers:", text: "이미 만든 로거가 있으면 그대로 재사용합니다(중복 방지)." },
        { at: "logger.propagate = False", text: "상위 로거로 전파를 막아 같은 로그가 두 번 찍히지 않게 합니다." },
        { at: 'log_file = settings.logs_dir / f"mas_{_LOG_TIMESTAMP}.log"', text: "실행 시작 시각으로 새 로그 파일 경로를 만듭니다." },
        { at: 'file_handler = logging.FileHandler(log_file, encoding="utf-8")', text: "파일에 UTF-8로 상세 로그를 남기는 핸들러입니다(한글 안 깨짐)." },
        { at: "console_handler = logging.StreamHandler()", text: "화면(콘솔)에 진행상황을 보여주는 핸들러입니다." },
      ],
      code: `def get_logger(name: str) -> logging.Logger:
    """이름별 로거를 반환 — 콘솔과 파일 핸들러를 함께 부착함.

    같은 이름으로 다시 호출하면 캐시된 로거를 반환하여 핸들러가 중복 부착되지 않게 함.
    """
    if name in _loggers:
        return _loggers[name]

    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    logger.propagate = False  # 루트 로거로의 전파를 막아 로그 중복 출력 방지

    # 로그 디렉터리 보장 (없으면 생성)
    settings.logs_dir.mkdir(parents=True, exist_ok=True)
    log_file = settings.logs_dir / f"mas_{_LOG_TIMESTAMP}.log"

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    )

    # 파일 핸들러: 상세 로그(DEBUG 이상)를 파일에 기록 — UTF-8로 한글 깨짐 방지
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    # 콘솔 핸들러: 진행 상황(INFO 이상)만 화면에 표시
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    _loggers[name] = logger
    return logger`,
    },

    // ───────────────────────── config/settings.py ─────────────────────────
    {
      id: "store_paths",
      name: "스토어 경로 계산 (모듈 상단)",
      fileId: "settings",
      summary: "이 파일 위치를 기준으로 기존 GraphRAG 스토어(KG+Vector) 경로를 자동으로 찾는 코드",
      how: "절대 경로를 직접 적지 않고 현재 파일 위치에서 상위 폴더로 거슬러 올라가 hands-on을 찾고, 거기서 14.graphrag/ms-graphrag/store를 가리킵니다. 어느 PC에서 받아도 경로가 자동으로 맞춰져 별도 인덱싱 없이 기존 산출물을 재사용합니다.",
      terms: ["Path(__file__).resolve().parent", "GraphRAG", "Vector DB", "Knowledge Graph(KG)"],
      lines: [
        { at: "_CONFIG_DIR = Path(__file__).resolve().parent", text: "이 파일(config/settings.py)이 있는 폴더의 절대경로를 구합니다." },
        { at: '_STORE_DIR = _HANDS_ON_DIR / "14.graphrag"', text: "기존 GraphRAG 산출물(KG+Vector) 폴더를 가리킵니다. 여기를 그대로 재사용합니다." },
      ],
      code: `# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함 (config/)
_CONFIG_DIR = Path(__file__).resolve().parent
# 프로젝트 루트 (aistudy-chat/)
_PROJECT_DIR = _CONFIG_DIR.parent
# hands-on 디렉터리 (aistudy-chat → 16.mas → hands-on)
_HANDS_ON_DIR = _PROJECT_DIR.parent.parent
# 기존 Microsoft GraphRAG 인덱싱 산출물 루트 (KG + Vector DB)
_STORE_DIR = _HANDS_ON_DIR / "14.graphrag" / "ms-graphrag" / "store"`,
    },
    {
      id: "post_init",
      name: "Settings.__post_init__()",
      fileId: "settings",
      summary: "환경변수로 기본 설정을 덮어쓰고 출력/로그 폴더를 보장하는 함수",
      how: "@dataclass로 만든 설정 객체가 생성된 직후 자동 실행됩니다. .env나 환경변수에 값이 있으면 모델·타임아웃·검색 개수 등 기본값을 그것으로 바꿉니다. 마지막으로 output/·logs/ 폴더가 없으면 만들어 둡니다.",
      terms: ["@dataclass", "환경변수(env)", "from __future__ import annotations"],
      lines: [
        { at: 'self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", self.ollama_base_url)', text: "환경변수에 Ollama 주소가 있으면 그것으로, 없으면 기본값을 유지합니다." },
        { at: "self.output_dir.mkdir(parents=True, exist_ok=True)", text: "생성 코드 저장 폴더가 없으면 만들어 둡니다(이미 있으면 그대로)." },
      ],
      code: `def __post_init__(self) -> None:
    """환경변수로 기본값을 오버라이드하고 출력 디렉터리를 보장함."""
    self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", self.ollama_base_url)
    self.llm_model = os.getenv("MAS_LLM_MODEL", self.llm_model)
    self.embedding_model = os.getenv("MAS_EMBEDDING_MODEL", self.embedding_model)
    self.llm_timeout = _env_int("MAS_LLM_TIMEOUT", self.llm_timeout)
    self.textbook_top_k = _env_int("MAS_TEXTBOOK_TOP_K", self.textbook_top_k)
    self.code_top_k = _env_int("MAS_CODE_TOP_K", self.code_top_k)
    self.web_max_results = _env_int("MAS_WEB_MAX_RESULTS", self.web_max_results)
    self.youtube_max_results = _env_int("MAS_YOUTUBE_MAX_RESULTS", self.youtube_max_results)

    # 생성 코드·로그 디렉터리는 실행 시점에 보장
    self.output_dir.mkdir(parents=True, exist_ok=True)
    self.logs_dir.mkdir(parents=True, exist_ok=True)`,
    },
    {
      id: "config_constants",
      name: "Supervisor·재시도·가중치 상수",
      fileId: "settings",
      summary: "품질 통과 기준(0.75), 재시도 한도(2), 소스 가중치 등 핵심 운영값 모음",
      how: "시스템의 행동을 정하는 숫자들을 한곳에 모았습니다. 통과 기준 0.75, 최대 재시도 2회(Loop Guard), 점수대별 재시도 전략, 교재 우선 가중치(0.7) 등을 바꾸면 코드 수정 없이 동작을 조정할 수 있습니다.",
      terms: ["Supervisor", "Loop Guard", "가중치(weight)", "재시도 전략"],
      lines: [
        { at: '"pass_threshold": 0.75,', text: "이 점수 이상이면 통과로 봅니다(요청 스펙 0.75)." },
        { at: '"max_retries": 2,', text: "재시도는 최대 2번까지만 — 무한루프를 막는 Loop Guard입니다." },
        { at: '"default": {"rag": 0.7,', text: "기본 소스 가중치: 교재(RAG)에 0.7로 가장 큰 비중을 둡니다." },
      ],
      code: `SUPERVISOR_CONFIG = {
    "pass_threshold": 0.75,   # 이 점수 이상이면 통과 (요청 스펙: 0.75)
    "retry_threshold": 0.5,   # 이 점수 이상이면 쿼리 재작성, 미만이면 다른 전략
    "max_retries": 2,         # 최대 재시도 횟수 (무한 루프 방지 = Loop Guard)
}


RETRY_STRATEGIES = {
    "code": {
        "score >= 0.5": "query_rewrite",       # 검색 쿼리 재작성 후 재시도
        "score < 0.5": "direct_generation",    # RAG 없이 직접 생성
    },
    "qa": {
        "score >= 0.5": "query_rewrite",        # 검색 쿼리 재작성
        "score < 0.5": "reweight_sources",      # 소스 가중치 변경 (웹/유튜브 비중↑)
    },
}


SOURCE_WEIGHTS = {
    "default": {"rag": 0.7, "web": 0.1, "youtube": 0.2},   # 기본: 교재(RAG) 우선
    "reweight": {"rag": 0.5, "web": 0.2, "youtube": 0.3},  # 재시도: 웹/유튜브 비중 증가
}`,
    },
  ],

  glossary: {
    "MAS": "Multi-Agent System(멀티에이전트 시스템). 역할이 다른 여러 AI 에이전트가 협업해 하나의 일을 처리하는 구조입니다.",
    "RAG": "Retrieval-Augmented Generation(검색 증강 생성). 먼저 관련 문서를 검색해 찾은 내용을 근거로 LLM이 답하게 하는 기법입니다.",
    "SAS 패턴": "Scheduler(작업 분배)–Agent(전문 작업)–Supervisor(품질 감독)로 역할을 나눈 멀티에이전트 설계 패턴입니다.",
    "Scheduler": "SAS의 '작업 분배자'. 들어온 질문을 어떤 경로(code/qa)로 보낼지 정합니다. 여기서는 Router가 그 역할입니다.",
    "Supervisor": "SAS의 '감독자'. 만들어진 결과의 품질을 채점하고 통과/재시도/폴백을 결정합니다.",
    "LangGraph": "노드(작업)와 엣지(이동)로 AI 워크플로를 그래프처럼 짜는 라이브러리입니다. 분기·반복이 있는 복잡한 흐름에 적합합니다.",
    "StateGraph": "LangGraph에서 '공유 State'를 들고 노드 사이를 이동하는 그래프 객체입니다.",
    "노드(Node)": "그래프에서 하나의 작업 단위(함수). 공유 State를 받아 일부를 채워 돌려줍니다.",
    "엣지(Edge)": "노드와 노드를 잇는 '이동 경로'. 어떤 노드 다음에 어디로 갈지 정합니다.",
    "조건부 엣지": "상황(State)을 보고 다음 행선지를 함수로 정하는 엣지. 분기·재시도 루프를 만듭니다.",
    "진입점(entry point)": "그래프 실행이 가장 먼저 시작되는 노드. 여기서는 router입니다.",
    "END": "LangGraph에서 그래프 실행을 끝내는 특별한 종료 지점입니다.",
    "컴파일(compile)": "노드·엣지로 짠 그래프 설계도를 실제로 실행할 수 있는 형태로 바꾸는 과정입니다.",
    "invoke": "컴파일된 그래프를 한 번 실행하는 메서드. 입력 State를 넣으면 끝까지 돌고 최종 State를 돌려줍니다.",
    "Shared State": "모든 노드가 함께 읽고 쓰는 공유 메모지. SAS에서 에이전트는 이 State로만 협업합니다(서로 직접 호출 안 함).",
    "TypedDict": "키마다 값의 타입을 정해 둔 딕셔너리. 어떤 칸에 무엇이 들어가는지 명시할 수 있습니다.",
    "Annotated": "타입에 부가 정보를 덧붙이는 표기. 여기서는 messages 칸에 add_messages 동작을 붙입니다.",
    "add_messages": "메시지 리스트를 덮어쓰지 않고 자동으로 이어 붙여 주는 LangGraph의 reducer(병합 규칙)입니다.",
    "reducer": "여러 노드가 같은 칸을 갱신할 때 어떻게 합칠지 정하는 규칙. add_messages가 그 예입니다.",
    "Literal": "값을 정해진 몇 가지로만 제한하는 타입. 예: Literal[\"code\", \"qa\"]는 둘 중 하나만 허용합니다.",
    "Optional": "값이 있을 수도, 없을 수도(None) 있음을 나타내는 타입 표기입니다.",
    "Ollama": "내 PC에서 LLM·임베딩 모델을 돌리는 로컬 실행 도구. HTTP API로 호출합니다(외부 API 키 불필요).",
    "qwen3:8b": "이 예제가 사용하는 80억 파라미터 규모의 로컬 LLM 모델 이름입니다.",
    "qwen3-embedding": "텍스트를 4096차원 벡터로 바꾸는 임베딩 모델. 인덱싱과 검색에 같은 모델을 써야 합니다.",
    "임베딩(embedding)": "글을 의미를 담은 숫자 벡터로 바꾸는 것. 비슷한 의미일수록 벡터가 가깝습니다.",
    "벡터(vector)": "숫자들의 나열(배열). 텍스트의 의미를 좌표처럼 표현한 것입니다.",
    "4096차원": "이 임베딩 벡터가 4096개의 숫자로 이루어졌다는 뜻입니다.",
    "벡터 검색": "질문 벡터와 가장 가까운(의미가 비슷한) 문서 벡터를 찾는 검색 방식입니다.",
    "LanceDB": "벡터를 저장하고 빠르게 유사도 검색을 해 주는 로컬 벡터 데이터베이스입니다.",
    "Vector DB": "임베딩 벡터를 저장하고 가까운 것을 찾아 주는 데이터베이스(여기서는 LanceDB)입니다.",
    "Parquet": "표 형태 데이터를 효율적으로 저장하는 파일 형식. 교재 본문·엔티티 정보가 들어 있습니다.",
    "id 조인": "검색으로 찾은 id를 열쇠로 다른 표(Parquet)에서 실제 본문을 찾아 붙이는 작업입니다.",
    "GraphRAG": "문서를 지식그래프(KG)와 벡터로 함께 인덱싱해 검색하는 기법. 이 예제는 기존 산출물을 재사용합니다.",
    "Knowledge Graph(KG)": "개념(엔티티)과 그 관계를 노드·엣지로 표현한 지식 그래프입니다.",
    "엔티티(entity)": "지식그래프의 개념 노드(예: 'LangGraph', 'RAG'). 이름·설명·타입을 가집니다.",
    "청크(chunk)": "긴 문서나 자막을 검색·처리하기 좋게 잘라 놓은 한 조각입니다.",
    "top_k": "검색에서 가장 가까운 상위 몇 개(k개)를 가져올지 정하는 값입니다.",
    "_distance(거리)": "벡터 검색이 돌려주는 '얼마나 먼가' 값. 작을수록 더 비슷합니다.",
    "코사인 유사도": "두 벡터가 이루는 각도로 유사도를 재는 방법. 방향이 비슷할수록 1에 가깝습니다.",
    "관련성 점수": "질문과 문서/답변이 얼마나 관련 있는지를 0~1로 나타낸 값입니다.",
    "DuckDuckGo(ddgs)": "API 키 없이 쓸 수 있는 검색 엔진/클라이언트. 웹 검색에 사용합니다.",
    "크롤링": "웹 페이지를 받아 그 안의 본문 텍스트를 뽑아내는 작업입니다.",
    "BeautifulSoup": "HTML을 분석해 원하는 부분(본문 등)을 골라내는 파이썬 라이브러리입니다.",
    "User-Agent": "요청을 보낼 때 '나는 이런 브라우저'라고 알리는 헤더. 봇 차단을 완화하려고 브라우저처럼 위장합니다.",
    "scrapetube": "YouTube Data API 키 없이 영상을 검색하게 해 주는 라이브러리입니다.",
    "youtube-transcript-api": "YouTube 영상의 자막을 직접 가져오는 라이브러리(1.x 버전 사용)입니다.",
    "자막(transcript)": "영상에서 말한 내용을 시간 정보와 함께 적어 둔 텍스트입니다.",
    "Webshare 프록시": "YouTube의 IP 차단을 우회하기 위해 거쳐 가는 중계 서버. 자격증명이 있을 때만 사용합니다.",
    "버퍼(buffer)": "결과를 한꺼번에 묶기 전 잠시 모아 두는 임시 저장 공간입니다.",
    "ast.parse": "파이썬 코드를 실행하지 않고 문법 구조만 분석하는 함수. 안전하게 문법 오류를 확인합니다.",
    "구문(syntax) 검증": "코드의 문법이 올바른지(실행 가능한 형태인지) 확인하는 것입니다.",
    "SyntaxError": "문법이 틀렸을 때 파이썬이 내는 오류입니다.",
    "마크다운 코드 블록": "```python … ``` 처럼 코드를 감싸 표시하는 마크다운 문법입니다.",
    "문자열 슬라이싱": "문자열의 일부 구간을 [시작:끝]으로 잘라 내는 파이썬 기능입니다.",
    "프롬프트(prompt)": "LLM에게 보내는 지시문/질문 텍스트입니다.",
    "시스템 프롬프트(system prompt)": "LLM의 역할·규칙을 미리 정해 두는 지시문. 본문 질문 앞에 붙습니다.",
    "템플릿(template)": "빈칸(자리표시자)을 두고 나중에 값을 채워 완성하는 틀입니다.",
    "temperature": "LLM 출력의 무작위성. 낮으면 일관적·정확, 높으면 다양·창의적입니다.",
    "max_tokens": "LLM이 한 번에 생성할 최대 길이(토큰 수). Ollama에서는 num_predict로 전달됩니다.",
    "thinking 모드": "qwen3가 생각 과정을 <think> 태그로 출력하는 기능. 파싱이 깨질 수 있어 끕니다.",
    "<think> 태그": "qwen3가 추론 과정을 감싸는 표시. 답변 본문이 아니므로 제거합니다.",
    "정규표현식(regex)": "문자열에서 특정 패턴을 찾거나 바꾸는 규칙 표기법입니다.",
    "re.DOTALL": "정규표현식에서 점(.)이 줄바꿈까지 포함해 매칭하도록 하는 옵션입니다.",
    "휴리스틱(heuristic)": "정확하진 않아도 빠르고 쓸 만한 결과를 주는 간단한 어림짐작 규칙입니다.",
    "쿼리 재작성": "검색이 더 잘 되도록 질문을 핵심 키워드 중심으로 다시 쓰는 것입니다.",
    "재시도 전략": "품질이 낮을 때 무엇을 바꿔 다시 시도할지(쿼리 재작성/가중치 조정 등) 정한 방법입니다.",
    "재시도(retry)": "원하는 품질이 안 나왔을 때 조건을 바꿔 다시 시도하는 것입니다.",
    "Loop Guard": "재시도가 무한히 반복되지 않도록 횟수를 제한하는 안전장치(여기서는 최대 2회)입니다.",
    "recursion_limit": "그래프가 너무 많은 단계를 도는 것을 막는 상한선. 재시도 폭주 방지용입니다.",
    "Graceful Degradation": "일부가 실패해도 완전히 멈추지 않고 품질을 낮춰서라도 동작을 이어가는 설계입니다.",
    "폴백(fallback)": "정상 경로가 실패했을 때 쓰는 대체 경로. 여기서는 LLM 단독 답변입니다.",
    "장애 격리": "한 부분(예: 웹 검색)이 실패해도 전체 흐름이 멈추지 않게 오류를 가두는 것입니다.",
    "품질 게이팅": "기준 점수를 넘어야 통과시키는 품질 검문소. Supervisor가 이 역할을 합니다.",
    "가중치(weight)": "여러 소스를 합칠 때 각 소스에 두는 중요도. 교재가 0.7로 가장 큽니다.",
    "출처(source)": "답변에 쓰인 정보가 어디서 왔는지(교재/웹/영상)를 밝히는 표기입니다.",
    "싱글톤(Singleton)": "객체를 한 번만 만들어 계속 재사용하는 패턴. 무거운 초기화 비용을 아낍니다.",
    "지연 초기화(Lazy Initialization)": "필요해지는 첫 순간에만 객체를 만드는 방식. 불필요한 준비를 미룹니다.",
    "global": "함수 안에서 전역 변수를 바꾸겠다고 선언하는 파이썬 키워드입니다.",
    "키워드 분류": "정해진 단어가 들어 있는지로 질문 유형을 빠르게 가르는 방법입니다.",
    "LLM 분류": "키워드로 애매할 때 LLM에게 의미를 물어 유형을 정하는 방법입니다.",
    "트리거(trigger)": "특정 동작을 촉발하는 신호 단어. 예: '코드 작성'은 code 분류를 촉발합니다.",
    "HumanMessage": "LangChain에서 '사용자가 한 말'을 나타내는 메시지 객체입니다.",
    "AIMessage": "LangChain에서 'AI가 한 말'을 나타내는 메시지 객체입니다.",
    "f-string": "f\"...{변수}...\" 형식으로 문자열 안에 값을 끼워 넣는 파이썬 문법입니다.",
    "바다코끼리 연산자(:=)": "값을 변수에 넣는 동시에 그 값을 바로 쓰게 해 주는 연산자(:=)입니다.",
    'if __name__ == "__main__"': "이 파일을 직접 실행할 때만 아래 코드를 수행하게 하는 관용구(import 시엔 실행 안 됨)입니다.",
    "sys.argv": "프로그램을 실행할 때 명령행에서 넘긴 인자들의 목록입니다.",
    "from __future__ import annotations": "타입 힌트를 문자열로 평가해 순환 참조 없이 쓰게 해 주는 선언입니다.",
    "@dataclass": "설정 같은 데이터 묶음 클래스를 간단히 만들어 주는 데코레이터입니다.",
    "Path(__file__).resolve().parent": "현재 파일이 있는 폴더의 절대경로를 구하는 관용구입니다.",
    "환경변수(env)": "OS나 .env 파일에 저장해 코드 밖에서 설정을 주입하는 값입니다.",
    "타임스탬프(timestamp)": "'20260601_120000'처럼 시각을 나타낸 문자열. 파일명이 겹치지 않게 합니다.",
    "with open() as f": "파일을 열고, 블록을 벗어나면 자동으로 닫아 주는 안전한 파일 사용 관용구입니다.",
    "UTF-8": "한글을 포함한 거의 모든 문자를 깨지지 않게 저장하는 표준 문자 인코딩입니다.",
    "로거(logger)": "프로그램 진행 상황·오류를 기록(로그)하는 도구입니다.",
    "핸들러(handler)": "로그를 어디에(파일/콘솔) 어떤 수준으로 내보낼지 정하는 로거의 부품입니다.",
    "@st.cache_resource": "Streamlit에서 무거운 자원을 앱 실행 중 한 번만 만들어 캐싱하는 데코레이터입니다.",
    "st.session_state": "Streamlit에서 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소입니다.",
    "st.chat_input": "채팅창 하단 입력란을 그리고 사용자가 입력한 값을 돌려주는 Streamlit 함수입니다.",
    "Streamlit": "파이썬만으로 웹 앱·대시보드를 빠르게 만드는 라이브러리입니다.",
  },
};
