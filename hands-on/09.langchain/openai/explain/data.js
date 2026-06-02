/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../09.langchain/openai/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "여행 플래너 (LangChain + OpenAI) 예제 설명",
    entry: "travel_planner.py",
  },

  files: [
    { id: "main",    label: "travel_planner.py",  role: "메인 파일 · 화면과 대화 흐름" },
    { id: "tools",   label: "common/tools.py",     role: "AI가 호출하는 도구(날씨·관광지·맛집)" },
    { id: "prompts", label: "common/prompts.py",   role: "AI에게 주는 지침서(시스템 프롬프트)" },
    { id: "llm",     label: "common/llm.py",       role: "API 키 읽기 도우미" },
    { id: "uitext",  label: "common/ui_text.py",   role: "화면에 표시할 안내 문구 모음" },
  ],

  flow: [
    { step: 1, title: "앱 시작",
      summary: "main() 함수가 실행되어 화면 제목·아이콘을 정하고, 기억 공간을 준비함",
      detail: "프로그램의 '시작 버튼'이 main() 함수임. 식당으로 비유하면 가게 문을 열고 간판을 거는 단계임. 이때 initialize_session_state()가 '대화 내용·AI 객체·도구 호출 기록·대화 횟수'를 담을 빈 상자(기억 공간)를 만들어 둠." },
    { step: 2, title: "화면 구성",
      summary: "왼쪽 사이드바(사용법·도구 기록)와 환영 인사, 이전 대화를 화면에 그림",
      detail: "손님이 앉기 전 메뉴판과 안내문을 세팅하는 단계임. display_sidebar()는 왼쪽 도움말을, display_chat_history()는 지금까지 오간 대화를 다시 그려줌. 아직 새 입력은 받기 전임." },
    { step: 3, title: "사용자 입력 대기",
      summary: "화면 맨 아래 채팅창(st.chat_input)에서 '서울', '도쿄 날씨' 같은 입력을 기다림",
      detail: "손님의 주문을 기다리는 단계임. 사용자가 도시명이나 질문을 입력하고 Enter를 누르면 다음 단계로 넘어감. 입력이 없으면 여기서 계속 대기함." },
    { step: 4, title: "입력 저장·표시",
      summary: "입력한 문장을 대화 기록에 추가하고, 사용자 말풍선으로 화면에 보여줌",
      detail: "주문서를 받아 적고 손님에게 '주문 확인됐습니다'라고 보여주는 단계임. 입력은 messages 목록에 저장되어 다음 대화에서도 맥락으로 활용됨." },
    { step: 5, title: "메시지 변환",
      summary: "build_messages()가 '지침서 + 최근 대화 + 새 입력'을 LangChain 메시지로 묶음",
      detail: "AI가 알아듣는 형식으로 주문서를 정리하는 단계임. 맨 앞에 시스템 지침(SYSTEM_PROMPT)을 넣고, 비용 절약을 위해 최근 10개 대화만 함께 담음. 사람 말은 HumanMessage, AI 말은 AIMessage 객체로 변환함." },
    { step: 6, title: "AI 에이전트 실행",
      summary: "get_agent()가 만든 ReAct 에이전트가 invoke() 한 번으로 '생각→도구 호출→관찰' 루프를 자동 수행",
      detail: "주방장(AI)에게 주문서를 넘기는 핵심 단계임. 예전 방식(08단계)에서는 개발자가 '도구 호출이 필요한가?'를 직접 반복 확인했지만, create_react_agent를 쓰면 이 반복(ReAct 루프)을 라이브러리가 알아서 처리함. 개발자는 invoke() 한 번만 부르면 됨." },
    { step: 7, title: "도구 자동 호출",
      summary: "에이전트가 필요한 도구(get_weather·get_tourist_attractions·get_restaurants)를 스스로 골라 호출함",
      detail: "주방장이 필요한 재료(외부 정보)를 직접 가져오는 단계임. '날씨'를 물으면 날씨 도구만, '여행 루트'를 물으면 세 도구를 모두 호출함. 도구는 인터넷 API(날씨·구글 지도)를 불러 실제 데이터를 받아옴." },
    { step: 8, title: "응답 생성",
      summary: "도구 결과를 종합해 최종 답변(AIMessage)을 만들고, 텍스트를 추출함",
      detail: "재료로 요리를 완성하는 단계임. AI가 날씨·관광지·맛집 정보를 묶어 하루 일정을 글로 작성함. generate_response()가 답변에서 화면에 표시할 텍스트를 꺼내 반환함." },
    { step: 9, title: "결과 표시",
      summary: "답변을 말풍선으로 보여주고, 어떤 도구를 호출했는지 사이드바에 기록함",
      detail: "완성된 요리를 손님에게 내는 단계임. 답변 말풍선과 함께, 방금 어떤 도구가 호출됐는지(extract_tool_trace로 추출) 왼쪽에 보여줘 동작을 투명하게 확인할 수 있게 함. 대화 기록과 '대화 턴' 숫자도 갱신함." },
    { step: 10, title: "반복",
      summary: "사용자가 새 입력을 하면 3번 단계부터 다시 진행함",
      detail: "손님이 추가 주문을 하면 같은 과정을 반복함. 이전 대화가 기억(messages)에 남아 있어, '거기 맛집은?' 같은 이어지는 질문도 맥락을 이해함." },
  ],

  functions: [
    // ===== travel_planner.py (메인) =====
    {
      id: "initialize_session_state",
      name: "initialize_session_state()",
      fileId: "main",
      summary: "화면을 새로 그릴 때마다 사라지지 않고 유지해야 할 데이터(대화·AI객체 등)를 위한 빈 저장 공간을 만듦.",
      how: "Streamlit은 사용자가 무언가 누를 때마다 코드를 처음부터 다시 실행함. 그래서 일반 변수는 매번 초기화되어 버림. st.session_state라는 특별한 저장소에 넣어두면 그 탭이 열려 있는 동안 값이 유지됨. 'if 키가 없으면 만든다' 패턴으로, 이미 있으면 덮어쓰지 않고 그대로 둠.",
      terms: ["st.session_state", "Streamlit", "딕셔너리(dict)"],
      lines: [
        { at: 'if "messages" not in st.session_state:  # st.session_state:', text: "st.session_state는 '탭이 열려 있는 동안 유지되는 메모장'임. 여기 넣은 값은 화면을 다시 그려도 살아남음." },
        { at: 'if "agent" not in st.session_state:', text: "agent(AI 에이전트 객체)가 아직 없을 때만 None으로 초기화함. 이미 있으면 건드리지 않아 에이전트가 보존됨." },
        { at: 'if "last_tool_trace" not in st.session_state:', text: "last_tool_trace는 '직전에 어떤 도구를 호출했는지' 기록을 담을 빈 목록임." },
        { at: 'if "turn_count" not in st.session_state:', text: "turn_count는 대화를 몇 번 주고받았는지 세는 숫자임. 0부터 시작." },
      ],
      code:
`def initialize_session_state() -> None:
    """Streamlit rerun 사이에 유지할 상태 초기화."""
    if "messages" not in st.session_state:  # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
        st.session_state.messages = []
    if "agent" not in st.session_state:
        st.session_state.agent = None
    if "last_tool_trace" not in st.session_state:
        st.session_state.last_tool_trace = []
    if "turn_count" not in st.session_state:
        st.session_state.turn_count = 0`,
    },
    {
      id: "get_agent",
      name: "get_agent()",
      fileId: "main",
      summary: "AI 모델과 도구들을 묶어 'ReAct 에이전트'를 한 번만 만들어 두고, 이후에는 저장해 둔 것을 재사용함.",
      how: "에이전트를 만드는 일은 비용이 들기 때문에, 매번 만들지 않고 처음 한 번만 만들어 st.session_state.agent에 보관함(이를 '지연 생성 + 캐싱'이라 함). 핵심은 create_react_agent(llm, TRAVEL_TOOLS): 이 한 줄이 'AI가 도구를 호출하고 결과를 보고 다시 판단하는' 반복 과정을 자동으로 처리하는 똑똑한 일꾼을 만들어 줌.",
      terms: ["지연 생성(lazy)", "캐싱(cache)", "LangChain", "LangGraph", "ChatOpenAI", "create_react_agent", "ReAct 루프", "bind_tools", "temperature", "tool_calls", "AIMessage", "ToolMessage"],
      lines: [
        { at: 'if st.session_state.agent is None:', text: "agent가 아직 없을(None) 때만 새로 만듦. 이미 있으면 이 블록을 건너뛰고 저장된 것을 그대로 씀(캐싱)." },
        { at: 'api_key = require_api_key("OPENAI_API_KEY")', text: "require_api_key()로 OpenAI API 키를 가져옴. 키가 없으면 여기서 친절한 오류를 냄." },
        { at: 'llm = ChatOpenAI(model=MODEL_NAME, api_key=api_key, temperature=0)', text: "ChatOpenAI는 OpenAI GPT 모델을 LangChain에서 쓰기 쉽게 감싼 객체임. temperature=0은 '매번 일관된(덜 창의적인) 답'을 내게 함." },
        { at: 'st.session_state.agent = create_react_agent(llm, TRAVEL_TOOLS)', text: "★핵심★ create_react_agent가 'AI + 도구목록'을 받아, 도구를 호출하고 결과를 다시 판단하는 반복(ReAct 루프)을 자동 처리하는 에이전트를 만들어 저장(캐싱)함." },
        { at: 'return st.session_state.agent', text: "준비된(또는 새로 만든) 에이전트를 돌려줌." },
      ],
      code:
`def get_agent():
    """ChatOpenAI + TRAVEL_TOOLS로 ReAct 에이전트를 지연 생성 후 캐싱.

    create_react_agent(llm, tools) 동작 원리:
    1. llm.bind_tools(tools)로 LLM에 도구 스키마를 바인딩
    2. LLM 호출 → tool_calls 있으면 도구 실행 → 결과를 ToolMessage로 추가
    3. tool_calls가 없을 때까지 2번 반복 (ReAct 루프)
    4. 최종 AIMessage 반환
    → 08.function-call의 수동 for 루프가 완전히 대체됨
    """
    if st.session_state.agent is None:
        api_key = require_api_key("OPENAI_API_KEY")
        llm = ChatOpenAI(model=MODEL_NAME, api_key=api_key, temperature=0)
        st.session_state.agent = create_react_agent(llm, TRAVEL_TOOLS)
    return st.session_state.agent`,
    },
    {
      id: "build_messages",
      name: "build_messages(user_input)",
      fileId: "main",
      summary: "화면에 쌓인 대화와 새 입력을, AI가 알아듣는 메시지 객체 목록으로 변환함.",
      how: "AI에게 보낼 '주문서'를 정리하는 함수임. 맨 앞에 시스템 지침(SYSTEM_PROMPT)을 SystemMessage로 넣고, 그동안의 대화를 역할에 따라 HumanMessage(사람)·AIMessage(AI)로 바꿔 담음. 비용을 아끼려고 최근 10개만 포함하고, 마지막에 이번 새 입력을 붙임.",
      terms: ["SystemMessage", "HumanMessage", "AIMessage", "리스트(list)", "타입 힌트"],
      lines: [
        { at: 'messages = [SystemMessage(content=SYSTEM_PROMPT)]', text: "메시지 목록의 맨 앞에 시스템 지침을 넣음. SystemMessage는 'AI에게 주는 역할·규칙'을 담는 메시지 종류임." },
        { at: 'for msg in st.session_state.messages[-10:]:', text: "[-10:]은 '뒤에서 10개만' 잘라오는 파이썬 문법임. 대화가 길어질수록 비용이 늘기 때문에 최근 것만 보냄." },
        { at: 'messages.append(HumanMessage(content=msg["content"]))', text: "역할이 'user'면 사람이 한 말 → HumanMessage 객체로 변환." },
        { at: 'messages.append(AIMessage(content=msg["content"]))', text: "역할이 'assistant'면 AI가 한 말 → AIMessage 객체로 변환." },
        { at: 'messages.append(HumanMessage(content=user_input))', text: "마지막으로 이번에 새로 입력한 문장을 HumanMessage로 추가함." },
      ],
      code:
`def build_messages(user_input: str) -> list:
    """Streamlit 채팅 이력과 현재 입력을 LangChain 메시지 목록으로 변환."""
    messages = [SystemMessage(content=SYSTEM_PROMPT)]
    # 비용과 토큰 사용량을 줄이기 위해 최근 10개 UI 메시지만 포함함
    for msg in st.session_state.messages[-10:]:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            messages.append(AIMessage(content=msg["content"]))
    messages.append(HumanMessage(content=user_input))
    return messages`,
    },
    {
      id: "extract_tool_trace",
      name: "extract_tool_trace(messages)",
      fileId: "main",
      summary: "AI가 작업하며 남긴 메시지들 속에서 '어떤 도구를 어떤 값으로 호출했고 성공/실패했는지'를 뽑아냄.",
      how: "AI의 작업 과정을 사이드바에 투명하게 보여주기 위한 기록 수집 함수임. 메시지들을 훑어서 AIMessage에 들어 있는 도구 호출 요청(tool_calls)을 모으고, 짝이 되는 ToolMessage(도구 실행 결과)를 찾아 오류 여부를 표시함. 호출과 결과는 tool_call_id라는 고유 번호로 짝지음.",
      terms: ["isinstance()", "tool_calls", "ToolMessage", "tool_call_id", "AIMessage", "JSON", "예외 처리(try/except)", "타입 힌트", "딕셔너리(dict)"],
      lines: [
        { at: 'if isinstance(msg, AIMessage) and msg.tool_calls:', text: "isinstance(msg, AIMessage)는 'msg가 AIMessage 종류인가?'를 확인함. AI가 도구를 호출했다면 msg.tool_calls에 그 요청이 들어 있음." },
        { at: 'call_map[tc["id"]] = {', text: "각 도구 호출을 고유 id를 열쇠로 하여 보관함. 나중에 결과와 짝지으려는 준비." },
        { at: 'elif isinstance(msg, ToolMessage):', text: "ToolMessage는 도구가 실제로 실행된 결과 메시지임. tool_call_id로 어떤 호출의 결과인지 찾음." },
        { at: 'result = json.loads(msg.content) if isinstance(msg.content, str) else {}', text: "결과 내용을 JSON으로 해석해 'error' 항목이 있으면 실패로 표시함. 형식이 깨져도 멈추지 않도록 try/except로 감쌈." },
      ],
      code:
`def extract_tool_trace(messages: list) -> list[dict[str, Any]]:
    """agent.invoke() 결과 메시지 목록에서 도구 호출 기록을 추출함.

    AIMessage.tool_calls에서 함수명·인자를 수집하고 ToolMessage에서 오류 여부를 판단함.
    """
    traces = []
    call_map: dict[str, dict] = {}
    for msg in messages:
        if isinstance(msg, AIMessage) and msg.tool_calls:
            for tc in msg.tool_calls:
                call_map[tc["id"]] = {
                    "function": tc["name"],
                    "arguments": tc["args"],
                    "has_error": False,
                }
        elif isinstance(msg, ToolMessage):
            trace = call_map.get(msg.tool_call_id)
            if trace:
                try:
                    result = json.loads(msg.content) if isinstance(msg.content, str) else {}
                    trace["has_error"] = isinstance(result, dict) and bool(result.get("error"))
                except (json.JSONDecodeError, AttributeError):
                    pass
                traces.append(trace)
    return traces`,
    },
    {
      id: "generate_response",
      name: "generate_response(user_input)",
      fileId: "main",
      summary: "사용자 입력을 받아 에이전트를 실행하고, 최종 답변 텍스트를 돌려주는 '중심 함수'임.",
      how: "이 함수가 전체를 지휘함: ①에이전트 준비 → ②메시지 정리 → ③invoke()로 한 번에 실행(도구 호출 루프 포함) → ④도구 기록 추출 → ⑤마지막 메시지에서 텍스트 추출.",
      terms: ["invoke()", "create_react_agent", "ReAct 루프", "AIMessage"],
      lines: [
        { at: 'agent = get_agent()', text: "준비된(또는 새로 만든) 에이전트를 가져옴." },
        { at: 'result = agent.invoke({"messages": messages})', text: "★핵심★ agent.invoke()를 단 한 번 호출하면, 내부에서 '판단→도구 호출→결과 반영'을 끝날 때까지 자동 반복함. 예전의 수동 반복문이 이 한 줄로 대체됨." },
        { at: 'st.session_state.last_tool_trace = extract_tool_trace(output_msgs)', text: "이번 실행에서 호출된 도구 기록을 뽑아 사이드바용으로 저장함." },
        { at: 'content = output_msgs[-1].content', text: "결과 메시지들 중 맨 마지막([-1])이 AI의 최종 답변임. 그 안의 content를 꺼냄." },
        { at: 'return content or "응답을 생성할 수 없습니다."', text: "content가 비어 있으면 안내 문구를 돌려줌." },
      ],
      code:
`def generate_response(user_input: str) -> str:
    """사용자 입력을 처리하고 최종 assistant 응답 텍스트를 반환함."""
    agent = get_agent()
    messages = build_messages(user_input)
    result = agent.invoke({"messages": messages})
    output_msgs = result["messages"]
    st.session_state.last_tool_trace = extract_tool_trace(output_msgs)
    content = output_msgs[-1].content
    return content or "응답을 생성할 수 없습니다."`,
    },
    {
      id: "display_chat_history",
      name: "display_chat_history()",
      fileId: "main",
      summary: "저장된 지난 대화를 화면에 말풍선으로 다시 그려줌.",
      how: "Streamlit은 화면을 매번 새로 그리므로, 이전 대화도 매번 다시 그려야 함. messages에 저장된 각 항목을 역할(user/assistant)에 맞는 말풍선으로 출력함.",
      terms: ["st.chat_message", "st.markdown", "Streamlit"],
      lines: [
        { at: 'for message in st.session_state.messages:', text: "저장된 대화 하나하나를 순서대로 꺼냄." },
        { at: 'with st.chat_message(message["role"]):', text: "st.chat_message(역할)은 사람/AI 말풍선 모양을 만들어 줌. with 블록 안의 내용이 그 말풍선 안에 들어감." },
        { at: 'st.markdown(message["content"])', text: "st.markdown은 글자를 (굵게·목록 등 서식과 함께) 화면에 표시함." },
      ],
      code:
`def display_chat_history() -> None:
    """저장된 대화 이력을 Streamlit 채팅 UI에 표시함."""
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])`,
    },
    {
      id: "display_sidebar",
      name: "display_sidebar()",
      fileId: "main",
      summary: "왼쪽 사이드바에 사용법·기술 흐름·대화 턴 수·초기화 버튼·직전 도구 호출 기록을 표시함.",
      how: "화면 왼쪽의 보조 패널을 구성함. with st.sidebar 블록 안의 내용은 모두 왼쪽에 표시됨. '대화 초기화' 버튼을 누르면 저장된 대화를 비우고 st.rerun()으로 화면을 새로 그림. 직전에 호출된 도구가 있으면 성공/오류와 함께 보여줌.",
      terms: ["st.sidebar", "st.rerun", "JSON"],
      lines: [
        { at: 'with st.sidebar:', text: "with st.sidebar: 이 블록 안에서 출력하는 모든 것이 왼쪽 사이드바에 표시됨." },
        { at: 'st.metric("대화 턴", st.session_state.turn_count)', text: "대화 턴(주고받은 횟수)을 숫자 지표로 보여줌." },
        { at: 'if st.button("대화 초기화", use_container_width=True):', text: "'대화 초기화' 버튼. 누르면 아래 줄들이 실행되어 기록을 모두 비움." },
        { at: 'st.rerun()', text: "st.rerun()은 화면을 처음부터 다시 그리게 함(초기화 결과를 즉시 반영)." },
        { at: 'st.header("직전 도구 호출")', text: "직전에 호출된 도구 기록이 있으면, 함수명·인자·성공여부를 코드 블록으로 표시함." },
      ],
      code:
`def display_sidebar() -> None:
    """예제 사용법과 직전 도구 호출 trace를 표시함."""
    with st.sidebar:
        st.header("사용 방법")
        st.markdown(USAGE_GUIDE)
        st.divider()
        st.header("기술 흐름")
        st.markdown(TECH_GUIDE)
        st.divider()
        st.metric("대화 턴", st.session_state.turn_count)

        if st.button("대화 초기화", use_container_width=True):
            st.session_state.messages = []
            st.session_state.last_tool_trace = []
            st.session_state.turn_count = 0
            st.rerun()

        if st.session_state.last_tool_trace:
            st.divider()
            st.header("직전 도구 호출")
            for trace in st.session_state.last_tool_trace:
                status = "오류" if trace["has_error"] else "성공"
                st.code(
                    f"{trace['function']}({json.dumps(trace['arguments'], ensure_ascii=False)})"
                    f" -> {status}",
                    language="text",
                )`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "앱의 시작점. 화면을 세팅하고, 입력을 받고, 답변을 생성·표시하는 전체 흐름을 지휘함.",
      how: "프로그램의 '시작 버튼'에 해당함. 페이지 설정 → 상태 초기화 → 사이드바·환영문·이전 대화 표시 → 채팅창 입력 처리 순으로 진행함. 사용자가 입력하면(:= 로 받음) 답변을 만들어 말풍선으로 보여주고, 오류가 나도 멈추지 않게 try/except로 감쌈.",
      terms: ["st.chat_input", "st.chat_message", "st.empty", ":= (바다코끼리)", "예외 처리(try/except)", "Streamlit"],
      lines: [
        { at: 'st.set_page_config(', text: "st.set_page_config는 브라우저 탭 제목·아이콘·레이아웃을 정함. 코드 맨 처음에 한 번 호출해야 함." },
        { at: 'initialize_session_state()', text: "앞서 본 함수들을 순서대로 불러 화면 기본 골격을 세움." },
        { at: 'if user_input := st.chat_input("예: 서울, 도쿄 날씨, 파리 관광지, 부산 맛집"):  # st.chat_input:', text: "★중요 문법★ := (바다코끼리 연산자)는 '입력값을 user_input에 담으면서 동시에 비었는지 검사'함. 입력이 있을 때만 if 블록 실행." },
        { at: 'placeholder = st.empty()', text: "st.empty()는 '나중에 내용을 채울 빈 자리'를 만듦. 먼저 '생각 중...'을 보여주고 답이 오면 그 자리를 답변으로 바꿈." },
        { at: 'answer = generate_response(user_input)', text: "generate_response 실행 중 오류가 나도 앱이 죽지 않도록 try/except로 감싸 오류 메시지로 대체함." },
      ],
      code:
`def main() -> None:
    """Streamlit 앱 진입점."""
    st.set_page_config(
        page_title=f"{APP_TITLE} - OpenAI",
        page_icon=APP_ICON,
        layout="centered",
    )
    st.title(f"{APP_ICON} {APP_TITLE}")
    st.caption("LangChain ChatOpenAI + create_react_agent + Streamlit")

    initialize_session_state()
    display_sidebar()

    if not st.session_state.messages:
        with st.chat_message("assistant"):
            st.markdown(WELCOME_MESSAGE)

    display_chat_history()

    if user_input := st.chat_input("예: 서울, 도쿄 날씨, 파리 관광지, 부산 맛집"):  # st.chat_input: 채팅창 하단 입력란을 렌더링하고 입력값을 반환함 / := 는 조건 검사와 동시에 변수에 값을 할당함
        st.session_state.messages.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.markdown(user_input)

        with st.chat_message("assistant"):
            placeholder = st.empty()
            placeholder.markdown("ReAct 에이전트가 도구 호출 여부를 판단하는 중...")
            try:
                answer = generate_response(user_input)
            except Exception as exc:
                answer = f"오류가 발생함: {exc}"

            placeholder.markdown(answer)

        st.session_state.messages.append({"role": "assistant", "content": answer})
        st.session_state.turn_count += 1`,
    },

    // ===== common/tools.py (도구) =====
    {
      id: "normalize_city_name",
      name: "normalize_city_name(city)",
      fileId: "tools",
      summary: "'서울', '도쿄' 같은 한글 도시명을 외부 API가 알아듣는 영문('Seoul', 'Tokyo')으로 바꿈.",
      how: "날씨·지도 API는 영문 도시명을 받음. 미리 만들어 둔 표(CITY_NAME_MAP)에서 한글을 찾아 영문으로 바꿔줌. 표에 없으면 입력을 그대로 돌려줌. 앞뒤 공백은 strip()으로 제거함.",
      terms: ["딕셔너리(dict)", ".get()", "타입 힌트"],
      lines: [
        { at: 'cleaned = (city or "").strip()', text: "(city or \"\")는 'city가 비어있으면 빈 문자열을 쓰라'는 안전장치임. .strip()은 앞뒤 공백을 제거함." },
        { at: 'if cleaned in CITY_NAME_MAP:', text: "정리한 도시명이 표(CITY_NAME_MAP)에 있는지 확인함. 없으면 맨 아래에서 입력을 그대로 반환함." },
        { at: 'return CITY_NAME_MAP[cleaned]', text: "표에 있으면 짝이 되는 영문 도시명을 돌려줌(예: 서울 → Seoul)." },
      ],
      code:
`def normalize_city_name(city: str) -> str:
    """한국어 또는 혼용 도시명을 API에서 사용하는 영문 도시명으로 변환하여 반환."""
    cleaned = (city or "").strip()
    if not cleaned:
        return cleaned
    if cleaned in CITY_NAME_MAP:
        return CITY_NAME_MAP[cleaned]
    return cleaned`,
    },
    {
      id: "build_google_maps_search_url",
      name: "build_google_maps_search_url(place_name, city)",
      fileId: "tools",
      summary: "장소명과 도시로 구글 지도 검색 링크(URL)를 만들어 줌.",
      how: "AI가 한글로 엉뚱한 링크를 만들지 않도록, 코드가 직접 정확한 구글 지도 URL을 만들어 결과에 넣어줌. quote_plus는 'Gyeongbokgung Palace Seoul' 같은 문장의 공백·특수문자를 URL에 넣어도 안전한 형태로 바꿔줌.",
      terms: ["quote_plus", "f-string"],
      lines: [
        { at: 'city_en = normalize_city_name(city)', text: "도시명을 먼저 영문으로 변환함." },
        { at: 'query = quote_plus(', text: "quote_plus는 공백을 +로 바꾸는 등, 글자를 URL에 안전하게 넣을 수 있게 인코딩함." },
        { at: 'return f"https://www.google.com/maps', text: "f\"...\"(f-string)는 문자열 안에 {변수} 값을 끼워 넣는 파이썬 문법임." },
      ],
      code:
`def build_google_maps_search_url(place_name: str, city: str) -> str:
    """query 파라미터를 영문으로 구성한 Google Maps 검색 URL 반환."""
    city_en = normalize_city_name(city)
    query = quote_plus(f"{place_name} {city_en}".strip())
    return f"https://www.google.com/maps/search/?api=1&query={query}"`,
    },
    {
      id: "_request_json",
      name: "_request_json(method, url, **kwargs)",
      fileId: "tools",
      summary: "인터넷 주소로 요청을 보내고, 돌아온 응답(JSON)을 파이썬 데이터로 바꿔 돌려주는 공용 도우미.",
      how: "여러 도구가 공통으로 쓰는 'HTTP 요청 + 결과 받기' 함수임. requests가 실제 인터넷 통신을 담당함. timeout=12는 '12초 안에 응답이 없으면 포기'라는 뜻으로, 멈춤(무한 대기)을 방지함. raise_for_status()는 응답이 실패(404 등)면 오류를 내게 함.",
      terms: ["requests", "raise_for_status()", "JSON", "타입 힌트"],
      lines: [
        { at: 'response = requests.request(method, url, timeout=12, **kwargs)', text: "requests.request가 실제로 인터넷에 요청을 보냄. timeout=12로 너무 오래 기다리지 않게 함." },
        { at: 'response.raise_for_status()', text: "응답이 실패 상태(예: 404, 500)면 여기서 오류를 발생시켜 잘못된 데이터를 쓰지 않게 함." },
        { at: 'return response.json()', text: "응답 본문을 JSON으로 해석해 파이썬 딕셔너리로 돌려줌." },
      ],
      code:
`def _request_json(method: str, url: str, **kwargs: Any) -> dict[str, Any]:
    """짧은 타임아웃으로 HTTP 요청을 실행하고 파싱된 JSON 딕셔너리 반환."""
    response = requests.request(method, url, timeout=12, **kwargs)
    response.raise_for_status()
    return response.json()`,
    },
    {
      id: "_compact_place",
      name: "_compact_place(place, city)",
      fileId: "tools",
      summary: "구글 지도 API가 준 복잡한 장소 정보를, AI가 쓰기 좋은 간단한 형태(이름·평점·주소·설명·링크)로 정리함.",
      how: "API 응답은 항목이 많고 깊게 중첩돼 있음. 필요한 값만 .get()으로 안전하게 꺼내고, 없을 때 쓸 기본값을 정해둠. 구글 지도 링크도 여기서 미리 만들어 넣어줌.",
      terms: ["딕셔너리(dict)", ".get()", "리스트 컴프리헨션", "f-string"],
      lines: [
        { at: 'display_name = place.get(', text: ".get(\"displayName\", {})는 'displayName이 없으면 빈 딕셔너리를 쓰라'는 안전한 꺼내기임. 연달아 .get으로 더 깊은 값을 안전하게 꺼냄." },
        { at: 'type_hint = ", ".join(', text: "types[:2]는 앞 2개만 잘라옴. PLACE_TYPE_LABELS 표로 영문 분류를 한글 라벨로 바꿈." },
        { at: 'maps_url = build_google_maps_search_url(', text: "장소별 구글 지도 링크를 미리 만들어 둠." },
        { at: 'return {', text: "정리된 깔끔한 딕셔너리를 돌려줌(이름·평점·주소·설명·링크 등)." },
      ],
      code:
`def _compact_place(place: dict[str, Any], city: str) -> dict[str, Any]:
    """Google Places(New) 응답 필드를 모델 친화적인 형태로 변환하여 반환."""
    display_name = place.get("displayName", {}).get("text", "Unknown place")
    address = place.get("formattedAddress", "Address unavailable")
    editorial = place.get("editorialSummary", {}).get("text", "")
    types = place.get("types", [])[:4]
    type_hint = ", ".join(PLACE_TYPE_LABELS.get(item, item.replace("_", " ")) for item in types[:2])

    # 모델이 구글맵 URL을 직접 받아 한글 query 문자열을 생성하지 않도록 미리 구성함
    maps_url = build_google_maps_search_url(display_name, city)

    return {
        "name": display_name,
        "rating": place.get("rating", 0),
        "address": address,
        "description": editorial or f"{type_hint}로 분류되는 장소임",
        "types": types,
        "google_maps_url": maps_url,
    }`,
    },
    {
      id: "_search_places",
      name: "_search_places(query, city, max_results)",
      fileId: "tools",
      summary: "구글 장소 검색(Places) API를 호출해, 정리된 장소 목록을 돌려줌.",
      how: "관광지·맛집 도구가 공통으로 쓰는 검색 엔진임. API 키가 없으면 즉시 명확한 오류를 냄. 요청 헤더에 키와 'FieldMask'(어떤 항목을 받을지 지정)를 넣고, _request_json으로 호출한 뒤 각 결과를 _compact_place로 깔끔히 정리함.",
      terms: ["RuntimeError", "FieldMask", "JSON", "리스트 컴프리헨션", "타입 힌트"],
      lines: [
        { at: 'if not GOOGLE_PLACES_API_KEY:', text: "API 키가 없으면 RuntimeError로 즉시 멈춰, 원인을 분명히 알려줌." },
        { at: '"X-Goog-FieldMask":', text: "X-Goog-FieldMask는 '응답에서 이 항목들만 보내달라'고 구글에 지정하는 것임(불필요한 데이터·비용 절감)." },
        { at: '"maxResultCount": max(1, min(max_results, 20)),', text: "maxResultCount를 1~20 사이로 강제해, 과도한 요청을 막음." },
        { at: 'return [_compact_place(', text: "받은 장소들을 하나씩 _compact_place로 정리해 목록으로 만들어 돌려줌(리스트 컴프리헨션)." },
      ],
      code:
`def _search_places(query: str, city: str, max_results: int) -> list[dict[str, Any]]:
    """Google Places Text Search(New) API를 호출하여 정규화된 장소 목록 반환."""
    if not GOOGLE_PLACES_API_KEY:
        raise RuntimeError(f"GOOGLE_PLACES_API_KEY가 설정되지 않았습니다: {HANDS_ON_ENV_PATH}")

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": (
            "places.displayName,places.formattedAddress,places.rating,"
            "places.types,places.editorialSummary"
        ),
    }
    body = {
        "textQuery": query,
        "languageCode": "en",
        "maxResultCount": max(1, min(max_results, 20)),
    }
    data = _request_json(
        "POST",
        "https://places.googleapis.com/v1/places:searchText",
        headers=headers,
        json=body,
    )
    return [_compact_place(place, city) for place in data.get("places", [])]`,
    },
    {
      id: "get_weather",
      name: "get_weather(city)  @tool",
      fileId: "tools",
      summary: "도시의 현재 날씨를 조회하는 도구. AI가 '날씨' 관련 요청에 이 도구를 자동 선택함.",
      how: "@tool 데코레이터가 이 함수를 'AI가 호출할 수 있는 도구'로 등록함. AI는 함수 위의 영문 설명(docstring)을 읽고 언제 쓸지 판단함. OpenWeatherMap API를 호출해 기온·체감·습도·바람 등을 정리해 돌려줌. 오류가 나도 멈추지 않고 error 항목을 담아 반환함.",
      terms: ["@tool", "데코레이터", "환경변수(.env)", "API 키", "예외 처리(try/except)", "딕셔너리(dict)", ".get()"],
      lines: [
        { at: '@tool', text: "★핵심★ @tool은 이 함수를 LangChain 도구로 변환하는 '데코레이터'임. 이 한 줄 덕분에 AI가 함수 이름·설명·인자를 보고 자동 호출할 수 있게 됨." },
        { at: '"""Get current weather', text: "함수 바로 아래 영문 문장(docstring)이 'AI를 위한 사용 설명서'가 됨. AI가 이걸 읽고 언제 호출할지 판단함." },
        { at: 'if not OPENWEATHER_API_KEY:', text: "날씨 API 키가 없으면, 멈추지 않고 error 메시지를 담은 결과를 돌려줌." },
        { at: 'weather = data.get("weather"', text: "응답에서 필요한 값들을 .get()으로 안전하게 꺼내 깔끔한 딕셔너리로 정리함." },
        { at: 'except requests.exceptions.HTTPError as exc:', text: "통신 오류가 나도 앱이 죽지 않게, error 항목을 담아 정상적으로 반환함." },
      ],
      code:
`@tool
def get_weather(city: str) -> dict:
    """Get current weather for a city. Use this for weather-only requests or as part of a daily route plan."""
    if not OPENWEATHER_API_KEY:
        return {"error": f"OPENWEATHER_API_KEY가 설정되지 않았습니다: {HANDS_ON_ENV_PATH}"}

    city_en = normalize_city_name(city)
    params = {
        "q": city_en,
        "appid": OPENWEATHER_API_KEY,
        "units": "metric",
        "lang": "kr",
    }

    try:
        data = _request_json(
            "GET",
            "https://api.openweathermap.org/data/2.5/weather",
            params=params,
        )
        weather = data.get("weather", [{}])[0]
        main = data.get("main", {})
        wind = data.get("wind", {})
        return {
            "city": city_en,
            "weather": weather.get("main", ""),
            "description": weather.get("description", ""),
            "temperature": main.get("temp"),
            "feels_like": main.get("feels_like"),
            "humidity": main.get("humidity"),
            "wind_speed": wind.get("speed"),
        }
    except requests.exceptions.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else "unknown"
        return {"error": f"OpenWeatherMap HTTP 오류: {status_code}", "city": city_en}
    except requests.exceptions.RequestException as exc:
        return {"error": f"OpenWeatherMap 네트워크 오류: {exc}", "city": city_en}`,
    },
    {
      id: "get_tourist_attractions",
      name: "get_tourist_attractions(city, max_results)  @tool",
      fileId: "tools",
      summary: "도시의 대표 관광지를 평점·주소·설명·지도 링크와 함께 검색하는 도구.",
      how: "@tool로 등록된 관광지 검색 도구임. max_results=DEFAULT_MAX_RESULTS처럼 '기본값이 있는 인자'를 써서, AI가 개수를 안 정해도 기본값(8개)으로 동작함. 내부적으로 _search_places를 호출함.",
      terms: ["@tool", "데코레이터", "예외 처리(try/except)", "딕셔너리(dict)"],
      lines: [
        { at: '@tool', text: "@tool로 관광지 검색을 AI 도구로 등록함." },
        { at: 'max_results: int = DEFAULT_MAX_RESULTS) -> dict:', text: "max_results: int = DEFAULT_MAX_RESULTS는 '값을 안 주면 기본 8개'라는 기본값 인자임." },
        { at: '_search_places(f"top tourist attractions', text: "공용 검색 함수 _search_places로 'top tourist attractions in 도시' 질의를 보냄." },
        { at: 'except Exception as exc:', text: "오류가 나면 error 항목을 담아 반환(앱이 멈추지 않음)." },
      ],
      code:
`@tool
def get_tourist_attractions(city: str, max_results: int = DEFAULT_MAX_RESULTS) -> dict:
    """Search top tourist attractions in a city with rating, address, short description, and Google Maps URL."""
    city_en = normalize_city_name(city)
    try:
        places = _search_places(f"top tourist attractions in {city_en}", city_en, max_results)
        return {
            "city": city_en,
            "attractions": places,
            "count": len(places),
        }
    except Exception as exc:
        return {"error": f"Google Places 관광지 검색 오류: {exc}", "city": city_en}`,
    },
    {
      id: "get_restaurants",
      name: "get_restaurants(city, meal_type, keyword, max_results)  @tool",
      fileId: "tools",
      summary: "도시의 맛집을 검색하는 도구. 아침/점심/저녁(meal_type)이나 키워드로 좁혀 찾을 수 있음.",
      how: "@tool로 등록된 맛집 검색 도구임. meal_type·keyword는 Optional(없어도 됨) 인자라, AI가 상황에 따라 일부만 채워 호출할 수 있음. 채워진 값들만 모아 검색어를 조립한 뒤 _search_places로 검색함.",
      terms: ["@tool", "데코레이터", "리스트 컴프리헨션", "예외 처리(try/except)"],
      lines: [
        { at: 'meal_type: Optional[str] = None,', text: "meal_type·keyword는 Optional[str] = None, 즉 '있어도 되고 없어도 되는' 선택 인자임." },
        { at: 'query_parts = [part for part in [meal_type, keyword, "restaurants"] if part]', text: "값이 채워진 항목만 골라(리스트 컴프리헨션) 검색어를 조립함." },
        { at: 'places = _search_places(query, city_en, max_results)', text: "조립한 검색어로 맛집을 검색함." },
      ],
      code:
`@tool
def get_restaurants(
    city: str,
    meal_type: Optional[str] = None,
    keyword: Optional[str] = None,
    max_results: int = DEFAULT_MAX_RESULTS,
) -> dict:
    """Search restaurants in a city. Use meal_type for breakfast, lunch, or dinner when useful."""
    city_en = normalize_city_name(city)
    query_parts = [part for part in [meal_type, keyword, "restaurants"] if part]
    query = " ".join(query_parts) + f" in {city_en}"

    try:
        places = _search_places(query, city_en, max_results)
        return {
            "city": city_en,
            "meal_type": meal_type,
            "keyword": keyword,
            "restaurants": places,
            "count": len(places),
        }
    except Exception as exc:
        return {"error": f"Google Places 맛집 검색 오류: {exc}", "city": city_en}`,
    },

    // ===== common/prompts.py (지침서) =====
    {
      id: "SYSTEM_PROMPT",
      name: "SYSTEM_PROMPT (상수)",
      fileId: "prompts",
      summary: "AI에게 '너는 여행 플래너야, 이렇게 행동해'라고 알려주는 지침서(시스템 프롬프트) 글임.",
      how: "코드가 아니라 'AI에게 주는 규칙을 적은 긴 문장'임. 요청 유형 판단법, 도시명 영문 변환 규칙, 날씨에 따른 추천 기준, 장소 표기 형식 등을 자연어로 적어 둠. build_messages()에서 SystemMessage로 맨 앞에 넣어 매 대화에 적용함. 도구 사용법을 코드로 강제하지 않고 '지침'으로 안내하는 점이 핵심임.",
      terms: ["SystemMessage", "create_react_agent"],
      lines: [
        { at: 'DEFAULT_MAX_RESULTS = 8', text: "DEFAULT_MAX_RESULTS = 8: 검색 결과 기본 개수. 도구들이 이 값을 기본값으로 사용함." },
        { at: 'SYSTEM_PROMPT = """당신은 여행 중인', text: "이 따옴표 세 개(\"\"\")로 둘러싼 긴 글 전체가 AI에게 주는 지침임." },
        { at: '3. 함수 호출 시 city', text: "도시명은 반드시 영문으로 넘기라는 규칙 등, AI의 행동을 자연어로 안내함." },
        { at: '## 장소 표기 형식', text: "답변에 장소를 어떻게 표기할지(평점·간단 설명·구글맵 링크) 형식을 예시와 함께 지정함." },
        { at: '## 구글맵 링크 규칙', text: "구글맵 링크의 query는 반드시 영문으로 쓰라고 못 박음(한글이면 깨질 수 있음)." },
      ],
      code:
`DEFAULT_MAX_RESULTS = 8

SYSTEM_PROMPT = """당신은 여행 중인 사용자를 돕는 오늘의 여행 플래너 AI임.

사용자는 아침에 오늘 하루의 여행 루트를 추천받고 싶어 함.

## 요청 처리 규칙
1. 사용자의 요청 유형을 먼저 판단함.
   - 날씨 요청: get_weather만 호출함
   - 관광지 요청: get_tourist_attractions만 호출함
   - 맛집 요청: get_restaurants만 호출함
   - 여행루트 요청 또는 도시명만 입력: get_weather, get_tourist_attractions, get_restaurants를 모두 호출함
2. 도시명이 없으면 함수를 호출하지 말고 도시명을 알려 달라고 요청함.
3. 함수 호출 시 city 값은 반드시 영문 도시명으로 전달함.
   - 예: 서울 -> Seoul, 도쿄 -> Tokyo, 파리 -> Paris, 제주 -> Jeju
4. 여행 루트는 오늘 날씨를 기준으로 추천함.
   - 비, 눈, 폭풍, 강풍: 실내 관광지 우선
   - 맑음, 구름 조금: 야외 관광지 우선
   - 흐림, 안개: 이동 부담이 낮은 장소 우선
5. 여행 루트에는 아침, 점심, 저녁 맛집을 각각 포함함.

## 장소 표기 형식
각 장소는 반드시 평점과 간략한 설명을 포함함.
구글맵 링크는 함수 결과의 google_maps_url 값을 우선 사용함.

예시:
**[Gyeongbokgung Palace](https://www.google.com/maps/search/?api=1&query=Gyeongbokgung+Palace+Seoul)** (평점 4.6★)
- 조선 왕조의 대표 궁궐로 오전 산책에 적합함
- 위치: 161 Sajik-ro, Jongno-gu, Seoul

## 구글맵 링크 규칙
- 링크 URL의 query 파라미터는 반드시 영문으로 작성함
- 형식: https://www.google.com/maps/search/?api=1&query=EnglishPlaceName+EnglishCityName
- 한글 query 파라미터 사용 금지

## 답변 톤
- 한국어로 답변함
- 실용적이고 간결하게 작성함
- 함수 결과에 error가 있으면 원인과 확인할 환경변수를 안내함
"""`,
    },

    // ===== common/llm.py (도우미) =====
    {
      id: "load_hands_on_env",
      name: "load_hands_on_env()",
      fileId: "llm",
      summary: "공통 비밀 설정 파일(hands-on/.env)을 읽어, API 키 같은 값을 프로그램이 쓸 수 있게 함.",
      how: "API 키처럼 외부에 노출되면 안 되는 값은 코드에 직접 쓰지 않고 .env 파일에 따로 보관함. load_dotenv가 그 파일을 읽어 환경변수로 올려줌. 모든 예제가 같은 .env를 공유하도록 경로를 고정함.",
      terms: ["load_dotenv", "환경변수(.env)", "API 키"],
      lines: [
        { at: 'load_dotenv(HANDS_ON_ENV_PATH)', text: "load_dotenv가 .env 파일의 KEY=값들을 읽어 프로그램의 환경변수로 등록함." },
      ],
      code:
`def load_hands_on_env() -> None:
    """hands-on/.env를 로드하여 모든 예제가 공통 키 파일을 공유하도록 함."""
    # .env 파일에서 API 키 등 환경변수를 로드함
    load_dotenv(HANDS_ON_ENV_PATH)`,
    },
    {
      id: "require_api_key",
      name: "require_api_key(env_name)",
      fileId: "llm",
      summary: "필요한 API 키를 읽어오고, 없으면 '키가 없다'고 분명한 오류를 내는 안전장치.",
      how: "키 없이 실행하면 한참 뒤 엉뚱한 곳에서 알 수 없는 오류가 남. 이 함수는 시작 시점에 키를 확인하고, 없으면 즉시 RuntimeError로 '어떤 키가 어디에 없는지'를 알려줘 문제를 빨리 찾게 함.",
      terms: ["환경변수(.env)", "API 키", "RuntimeError", ".get()"],
      lines: [
        { at: 'load_hands_on_env()', text: "먼저 .env를 읽어 환경변수를 준비함." },
        { at: 'api_key = os.getenv(env_name, "")', text: "os.getenv로 키 값을 읽음. 없으면 빈 문자열을 받음." },
        { at: 'if not api_key:', text: "키가 비어 있으면 즉시 RuntimeError로 멈춰, 원인을 분명히 알려줌(디버깅 쉬움)." },
      ],
      code:
`def require_api_key(env_name: str) -> str:
    """환경변수에서 API 키를 읽어 반환. 미설정 시 Streamlit UI용 명확한 오류 발생."""
    load_hands_on_env()
    api_key = os.getenv(env_name, "")
    # API 키 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함
    if not api_key:
        raise RuntimeError(f"{env_name}가 설정되지 않았습니다: {HANDS_ON_ENV_PATH}")
    return api_key`,
    },

    // ===== common/ui_text.py (화면 문구) =====
    {
      id: "ui_text_constants",
      name: "UI 텍스트 상수 (APP_TITLE 등)",
      fileId: "uitext",
      summary: "화면에 표시할 제목·아이콘·환영 인사·사용 안내 같은 '문구'들을 한곳에 모아 둔 파일.",
      how: "코드 곳곳에 문구를 흩어 두면 수정이 번거로움. 자주 바뀌는 안내 문구를 상수(대문자 이름)로 모아두면 한 곳만 고쳐도 전체에 반영됨. 함수는 없고 문자열 상수들만 있는 파일임.",
      terms: [],
      lines: [
        { at: 'APP_TITLE = "여행 플래너"', text: "APP_TITLE·APP_ICON: 화면 상단 제목과 아이콘(이모지)." },
        { at: 'WELCOME_MESSAGE = """안녕하세요', text: "WELCOME_MESSAGE: 처음 화면에 보여줄 환영 인사 글(삼중 따옴표로 여러 줄 작성)." },
        { at: 'USAGE_GUIDE = """### 사용 예시', text: "USAGE_GUIDE: 왼쪽 사이드바에 보여줄 사용 예시 안내." },
        { at: 'TECH_GUIDE = """### LangChain ReAct 흐름', text: "TECH_GUIDE: ReAct 동작 흐름을 간단히 정리한 기술 안내." },
      ],
      code:
`APP_TITLE = "여행 플래너"
APP_ICON = "🗺️"

WELCOME_MESSAGE = """안녕하세요. 오늘 여행 루트를 함께 정리하는 AI 여행 플래너임.

도시명을 알려주면 날씨, 관광지, 맛집 정보를 도구 호출로 조회한 뒤 오늘 일정으로 추천함.

예시
- 서울
- 도쿄 날씨
- 파리 관광지
- 부산 맛집
"""

USAGE_GUIDE = """### 사용 예시
- \`서울\`
- \`도쿄 날씨\`
- \`파리 관광지\`
- \`부산 맛집\`
- \`제주 여행 루트\`

### 요청 유형
- 날씨
- 관광지
- 맛집
- 여행루트

도시명만 입력하면 오늘의 여행 루트 추천 수행.
"""

TECH_GUIDE = """### LangChain ReAct 흐름
1. 사용자 요청 → HumanMessage 변환
2. create_react_agent가 LLM + 도구 루프 자동 실행
3. LLM이 tool_calls 생성 → 도구 실행 → ToolMessage로 결과 추가
4. tool_calls가 없을 때까지 3번 반복
5. 최종 AIMessage를 스트리밍으로 렌더링
"""`,
    },
  ],

  glossary: {
    "Streamlit": "파이썬 코드 몇 줄로 웹 화면을 만들어 주는 도구. 버튼·입력창·채팅 UI를 함수 호출만으로 그릴 수 있어, 웹 개발을 몰라도 앱을 만들 수 있음.",
    "st.session_state": "Streamlit의 '메모장'. 화면을 다시 그려도 사라지지 않게 값을 보관하는 특별한 저장소임. 여기 없는 일반 변수는 화면을 그릴 때마다 초기화됨.",
    "st.chat_input": "화면 맨 아래에 채팅 입력창을 만들어 주고, 사용자가 입력한 글을 돌려주는 Streamlit 기능.",
    "st.chat_message": "사람/AI 말풍선 모양의 영역을 만들어 주는 기능. with 블록 안에 쓴 내용이 그 말풍선 안에 표시됨.",
    "st.markdown": "글자를 굵게·목록·링크 등 서식과 함께 화면에 표시하는 기능.",
    "st.rerun": "화면(코드)을 처음부터 다시 실행하게 만드는 기능. 값이 바뀐 걸 즉시 화면에 반영할 때 씀.",
    "st.empty": "'나중에 채울 빈 자리'를 만들어 두는 기능. 먼저 '생각 중...'을 보여주고, 답이 오면 같은 자리를 답변으로 바꿀 수 있음.",
    "st.sidebar": "화면 왼쪽의 보조 패널. with st.sidebar 블록 안에서 출력한 것은 모두 왼쪽에 표시됨.",
    "LangChain": "여러 AI 모델과 도구를 한 방식으로 쉽게 다루게 해주는 인기 라이브러리. 모델이 바뀌어도 코드를 거의 그대로 쓸 수 있게 해줌.",
    "LangGraph": "LangChain 계열 도구로, AI의 작업 흐름을 '그래프(순서도)'처럼 구성하게 해줌. create_react_agent가 이 위에서 동작함.",
    "ChatOpenAI": "OpenAI의 GPT 모델을 LangChain에서 쓰기 쉽게 감싼 객체. llm.invoke()로 대화를 요청함.",
    "create_react_agent": "AI 모델과 도구 목록을 받아, '생각→도구 호출→결과 관찰'을 자동 반복하는 똑똑한 일꾼(에이전트)을 만들어 주는 함수. 개발자가 반복문을 직접 짤 필요가 없어짐.",
    "ReAct 루프": "'Reasoning(추론) + Acting(행동)'의 줄임말. AI가 생각하고 → 도구를 호출하고 → 결과를 보고 → 다시 생각하는 과정을, 더 할 일이 없을 때까지 반복하는 것.",
    "bind_tools": "AI 모델에게 '네가 쓸 수 있는 도구는 이것들이야'라고 도구 설명을 붙여주는 작업. 이래야 AI가 도구를 호출할 수 있음.",
    "invoke()": "'실행해!'에 해당하는 명령. 에이전트나 모델에게 입력을 주고 결과를 받을 때 invoke()를 부름.",
    "tool_calls": "AI가 '이 도구를 이런 값으로 호출해줘'라고 요청한 내역. AIMessage 안에 들어 있음.",
    "tool_call_id": "도구 호출 하나하나에 붙는 고유 번호(영수증 번호). 어떤 호출의 결과인지 짝지을 때 사용함.",
    "HumanMessage": "사람(사용자)이 한 말을 담는 메시지 객체.",
    "AIMessage": "AI가 한 말(또는 도구 호출 요청)을 담는 메시지 객체.",
    "SystemMessage": "AI에게 역할과 규칙을 알려주는 '지침' 메시지. 대화 맨 앞에 넣음.",
    "ToolMessage": "도구를 실제로 실행한 '결과'를 담는 메시지 객체.",
    "temperature": "AI 답변의 '창의성/무작위성' 정도(0~1 등). 0에 가까울수록 매번 비슷하고 일관된 답을, 높을수록 다양한 답을 냄.",
    "@tool": "함수 위에 붙이는 표식(데코레이터). 이걸 붙이면 평범한 파이썬 함수가 'AI가 호출할 수 있는 도구'로 바뀜. 함수 이름·설명·인자를 보고 AI가 알아서 호출함.",
    "데코레이터": "함수 위에 @이름 형태로 붙여, 그 함수에 새로운 능력을 더해주는 파이썬 문법. 선물 상자에 포장지를 한 겹 덧씌우는 것에 비유할 수 있음.",
    ":= (바다코끼리)": "값을 변수에 '담으면서 동시에' 그 값을 검사하는 연산자. 모양이 바다코끼리 눈·엄니를 닮아 붙은 별명. 예: if (x := 입력값): 은 입력을 x에 담고 비었는지 바로 확인함.",
    "타입 힌트": "변수나 함수에 '이건 문자열(str)이야, 결과는 목록(list)이야'처럼 자료의 종류를 적어두는 표시. 실행에 꼭 필요하진 않지만, 코드를 읽고 점검하기 쉽게 함.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"도시\": \"서울\"}처럼 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    "리스트(list)": "여러 값을 순서대로 담는 목록. [\"a\", \"b\"]처럼 대괄호로 표현함.",
    "리스트 컴프리헨션": "[표현식 for 항목 in 목록 if 조건] 형태로, 반복문을 한 줄로 짧게 써서 새 목록을 만드는 파이썬 문법.",
    ".get()": "딕셔너리에서 값을 '안전하게' 꺼내는 방법. 열쇠가 없어도 오류를 내지 않고, 정해둔 기본값을 돌려줌.",
    "isinstance()": "어떤 값이 특정 종류(타입)인지 확인하는 함수. 예: isinstance(x, list)는 'x가 리스트인가?'를 True/False로 답함.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "RuntimeError": "'실행 중 문제가 생겼다'고 알리는 오류의 한 종류. 여기서는 API 키가 없을 때 일부러 발생시켜 원인을 알려줌.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env라는 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(날씨·지도 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "requests": "파이썬에서 인터넷 주소로 요청을 보내고 응답을 받는 대표적인 라이브러리(HTTP 통신 도구).",
    "raise_for_status()": "인터넷 응답이 실패(예: 404 없음, 500 서버오류)면 오류를 발생시키는 점검 장치. 잘못된 응답을 그냥 쓰지 않게 함.",
    "JSON": "데이터를 주고받는 표준 글자 형식. {\"key\": \"value\"} 모양으로, 파이썬 딕셔너리와 거의 똑같이 생김.",
    "지연 생성(lazy)": "필요해질 때까지 만들지 않고 미뤘다가, 처음 쓸 때 한 번만 만드는 방식. 불필요한 작업과 비용을 줄임.",
    "캐싱(cache)": "한 번 만든 결과를 저장해 두고, 다음에 또 필요하면 다시 만들지 않고 저장본을 재사용하는 것.",
    "quote_plus": "글자를 URL 주소에 안전하게 넣을 수 있는 형태로 바꿔주는 함수(공백을 +로 바꾸는 등).",
    "FieldMask": "API에 '응답에서 이 항목들만 보내줘'라고 지정하는 것. 불필요한 데이터 전송과 비용을 줄임.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
  },
};
