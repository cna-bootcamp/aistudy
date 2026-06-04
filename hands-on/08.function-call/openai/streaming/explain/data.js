/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../08.function-call/openai/streaming/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "여행 플래너 (OpenAI Streaming) 예제 설명",
    entry: "travel_planner.py",
  },

  files: [
    { id: "main",    label: "travel_planner.py",        role: "메인 파일 · 스트리밍 대화 흐름과 화면" },
    { id: "tools",   label: "common/tools.py",           role: "외부 API 도구 구현 (날씨·관광지·맛집)" },
    { id: "prompts", label: "common/prompts.py",         role: "시스템 프롬프트 및 도구 스키마 정의" },
    { id: "llm",     label: "common/llm.py",             role: "API 키 로드 및 클라이언트 생성 도우미" },
    { id: "uitext",  label: "common/ui_text.py",         role: "화면에 표시할 안내 문구 상수 모음" },
  ],

  flow: [
    { step: 1, title: "앱 시작", label: "앱 시작", refs: ["initialize_session_state"],
      summary: "main()이 실행되어 페이지 설정·상태 초기화·사이드바·이전 대화를 준비함",
      detail: "프로그램의 '시작 버튼'에 해당함. 브라우저 탭 제목·아이콘을 정하고, 대화 기록 같은 기억 공간을 빈 상자로 준비함. 식당으로 비유하면 가게 문을 열고 간판을 거는 단계임." },
    { step: 2, title: "사용자 입력 대기", label: "사용자 입력 대기",
      summary: "화면 맨 아래 채팅창(st.chat_input)에서 도시명이나 질문을 기다림",
      detail: "손님의 주문을 기다리는 단계임. 사용자가 '서울'이나 '도쿄 날씨' 같은 입력을 하고 Enter를 누르면 다음 단계로 넘어감. 입력이 없으면 여기서 계속 대기함." },
    { step: 3, title: "입력 저장·표시", label: "입력 저장·표시",
      summary: "입력한 문장을 대화 기록에 추가하고, 사용자 말풍선으로 화면에 보여줌",
      detail: "주문서를 받아 적고 손님에게 '주문 확인됐습니다'라고 보여주는 단계임. 입력은 messages 목록에 저장되어 다음 대화에서도 맥락으로 활용됨." },
    { step: 4, title: "메시지 구성", label: "메시지 구성", refs: ["build_chat_messages"],
      summary: "build_chat_messages()가 '시스템 지침 + 최근 대화 + 새 입력'을 OpenAI 형식으로 묶음",
      detail: "AI가 알아듣는 형식으로 주문서를 정리하는 단계임. 맨 앞에 시스템 지침(SYSTEM_PROMPT)을, 비용 절약을 위해 최근 10개 대화를, 마지막에 이번 입력을 함께 담음." },
    { step: 5, title: "스트리밍 API 호출", label: "스트리밍 호출", refs: ["stream_response"],
      summary: "stream=True로 API를 호출해, 응답 텍스트를 청크 단위로 실시간 받아 화면에 표시",
      detail: "일반 요청은 전체 답변이 완성될 때까지 기다린 뒤 한 번에 보여줌. stream=True를 쓰면 타이핑하듯 글자가 조금씩 화면에 나타남. 사용자 경험이 훨씬 빠르게 느껴지는 핵심 차이임." },
    { step: 6, title: "청크 누적 및 판단", label: "청크 누적", refs: ["stream_response", "parse_tool_arguments"],
      summary: "delta.content 청크는 yield(실시간 표시), delta.tool_calls 청크는 index별로 누적",
      detail: "스트리밍에서는 응답이 조각으로 나뉘어 도착함. 텍스트 조각은 바로 화면에 보내고, 도구 호출 정보는 여러 조각이 합쳐져야 완전한 내용이 되므로 하나씩 이어 붙임. 마지막 조각에만 finish_reason이 설정됨." },
    { step: 7, title: "도구 실행 (선택)", label: "도구 실행", refs: ["execute_function"],
      summary: "finish_reason='tool_calls'이면 누적된 도구를 execute_function으로 실행하고 결과를 메시지에 추가",
      detail: "AI가 '날씨 정보가 필요해'라고 판단하면 finish_reason이 'tool_calls'로 옴. 이때 누적해 둔 도구 호출 정보로 외부 API를 실제로 호출하고, 결과를 role='tool' 메시지로 기록해 다음 API 호출에 넘김." },
    { step: 8, title: "최종 답변 스트리밍", label: "최종 답변 스트리밍", refs: ["stream_response"],
      summary: "도구 결과를 포함한 메시지로 다시 API를 호출해 최종 답변을 스트리밍으로 표시",
      detail: "재료(날씨·관광지·맛집 정보)를 받은 AI가 여행 루트를 문장으로 작성함. 이 답변도 stream=True로 받아 글자가 흐르듯 실시간으로 화면에 나타남. MAX_TOOL_ROUNDS(4번)를 초과하면 무한 루프를 막고 안내 메시지를 냄." },
    { step: 9, title: "결과 저장 및 반복", label: "결과 저장·반복", refs: ["display_sidebar"],
      summary: "완성된 답변을 대화 기록에 저장하고, 도구 호출 기록을 사이드바에 표시함",
      detail: "완성된 요리를 손님에게 내는 단계임. 답변을 messages에 저장해 이어지는 대화에서 맥락으로 쓰고, 이번에 어떤 도구가 호출됐는지를 사이드바에 보여줌. 다음 입력이 오면 2번 단계부터 다시 진행함." },
  ],

  functions: [
    // ===== travel_planner.py (메인) =====
    {
      id: "initialize_session_state",
      name: "initialize_session_state()",
      fileId: "main",
      summary: "화면을 새로 그릴 때마다 사라지지 않는 데이터(대화·클라이언트 등)를 위한 저장 공간을 초기화함.",
      how: "Streamlit은 사용자가 무언가 누를 때마다 코드를 처음부터 다시 실행함. 일반 변수는 매번 초기화되어 사라짐. st.session_state라는 특별한 저장소에 넣으면 탭이 열려 있는 동안 값이 유지됨. 'if 키가 없으면 만든다' 패턴으로 이미 있으면 덮어쓰지 않음.",
      terms: ["st.session_state", "Streamlit", "딕셔너리(dict)"],
      lines: [
        { at: 'if "messages" not in st.session_state:', text: "messages(대화 내용)라는 항목이 아직 없을 때만 환영 메시지로 초기화함. 이미 있으면 건드리지 않아 기존 대화가 보존됨." },
        { at: 'if "client" not in st.session_state:', text: "OpenAI 클라이언트(서버와 통신하는 객체)를 보관할 공간. 아직 만들지 않았으므로 None으로 초기화함." },
        { at: 'if "last_tool_trace" not in st.session_state:', text: "last_tool_trace는 '직전에 어떤 도구를 호출했는지' 기록을 담을 빈 목록임." },
        { at: 'if "turn_count" not in st.session_state:', text: "turn_count는 대화를 몇 번 주고받았는지 세는 숫자임. 0부터 시작." },
      ],
      code:
`def initialize_session_state() -> None:
    """Streamlit rerun 사이에 유지할 상태를 초기화함."""
    if "messages" not in st.session_state:  # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
        st.session_state.messages = [{"role": "assistant", "content": WELCOME_MESSAGE}]
    if "client" not in st.session_state:
        st.session_state.client = None
    if "last_tool_trace" not in st.session_state:
        st.session_state.last_tool_trace = []
    if "turn_count" not in st.session_state:
        st.session_state.turn_count = 0`,
    },
    {
      id: "get_client",
      name: "get_client()",
      fileId: "main",
      summary: "OpenAI 클라이언트를 처음 한 번만 만들고, 이후에는 저장해 둔 것을 재사용함.",
      how: "클라이언트를 만드는 데 시간이 걸리므로, 처음 한 번만 만들어 st.session_state.client에 보관함(지연 생성 + 캐싱). None이 아니면 새로 만들지 않고 저장된 것을 돌려줌.",
      terms: ["지연 생성(lazy)", "캐싱(cache)", "OpenAI 클라이언트"],
      lines: [
        { at: 'if st.session_state.client is None:', text: "클라이언트가 아직 없을(None) 때만 새로 만듦. 이미 있으면 이 블록을 건너뛰고 저장된 것을 그대로 씀(캐싱)." },
        { at: 'load_hands_on_env()', text: "먼저 .env 파일을 읽어 환경변수(API 키 등)를 준비함." },
        { at: 'st.session_state.client = create_openai_client()', text: "create_openai_client()로 OpenAI 서버와 통신하는 객체를 만들어 저장(캐싱)함." },
      ],
      code:
`def get_client() -> Any:
    """hands-on/.env 기반 OpenAI 클라이언트를 생성하고 재사용함."""
    if st.session_state.client is None:
        load_hands_on_env()
        st.session_state.client = create_openai_client()
    return st.session_state.client`,
    },
    {
      id: "build_chat_messages",
      name: "build_chat_messages(user_input)",
      fileId: "main",
      summary: "화면에 쌓인 대화와 새 입력을, OpenAI Chat API가 알아듣는 메시지 배열로 변환함.",
      how: "AI에게 보낼 '주문서'를 정리하는 함수임. 맨 앞에 system 지침(SYSTEM_PROMPT)을 넣고, 그동안의 대화를 역할(user/assistant)에 따라 담음. 비용을 아끼려고 최근 10개만 포함하고, 마지막에 새 입력을 붙임.",
      terms: ["타입 힌트", "딕셔너리(dict)", "리스트(list)"],
      lines: [
        { at: 'messages: list[dict[str, Any]] = [{"role": "system"', text: "메시지 목록의 맨 앞에 시스템 지침을 넣음. role='system'은 AI에게 역할과 규칙을 알려주는 메시지 종류임." },
        { at: 'for message in st.session_state.messages[-10:]:', text: "[-10:]은 '뒤에서 10개만' 잘라오는 파이썬 문법임. 대화가 길어질수록 비용이 늘기 때문에 최근 것만 보냄." },
        { at: 'if message["role"] in {"user", "assistant"}:', text: "role이 user 또는 assistant인 메시지만 골라서 포함함(도구 결과 메시지 등은 제외)." },
        { at: 'messages.append({"role": "user", "content": user_input})', text: "마지막으로 이번에 새로 입력한 문장을 user 메시지로 추가함." },
      ],
      code:
`def build_chat_messages(user_input: str) -> list[dict[str, Any]]:
    """OpenAI Chat Completions에 전달할 메시지 배열을 구성함."""
    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for message in st.session_state.messages[-10:]:
        if message["role"] in {"user", "assistant"}:
            messages.append({"role": message["role"], "content": message["content"]})
    messages.append({"role": "user", "content": user_input})
    return messages`,
    },
    {
      id: "parse_tool_arguments",
      name: "parse_tool_arguments(raw_arguments)",
      fileId: "main",
      summary: "API가 보내온 도구 인자(JSON 문자열)를 파이썬 딕셔너리로 안전하게 변환함.",
      how: "스트리밍으로 조각조각 도착한 도구 인자는 JSON 형식의 문자열임. json.loads로 딕셔너리로 바꾸되, 형식이 깨졌거나 비어 있어도 멈추지 않도록 try/except로 감쌈. 딕셔너리가 아닌 결과는 빈 딕셔너리로 대체함.",
      terms: ["JSON", "예외 처리(try/except)", "딕셔너리(dict)", "isinstance()"],
      lines: [
        { at: 'parsed = json.loads(raw_arguments or "{}")', text: "raw_arguments가 비어 있으면 '{}'(빈 JSON)을 쓰는 안전장치. json.loads가 문자열을 딕셔너리로 변환함." },
        { at: 'except json.JSONDecodeError:', text: "JSON 형식이 올바르지 않으면(깨진 조각 등) 오류를 내지 않고 빈 딕셔너리를 돌려줌." },
        { at: 'return parsed if isinstance(parsed, dict) else {}', text: "파싱 결과가 딕셔너리가 아닐 때도 빈 딕셔너리로 안전하게 대체함." },
      ],
      code:
`def parse_tool_arguments(raw_arguments: str) -> dict[str, Any]:
    """OpenAI tool_call의 JSON 문자열 인자를 안전하게 dict로 변환함."""
    try:
        parsed = json.loads(raw_arguments or "{}")
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}`,
    },
    {
      id: "stream_response",
      name: "stream_response(user_input)",
      fileId: "main",
      summary: "텍스트 청크를 실시간으로 yield하는 스트리밍 제너레이터. 도구 호출이 필요하면 내부에서 실행하고 최종 답변을 이어서 스트리밍함.",
      how: "이 예제의 핵심 함수임. stream=True로 API를 호출해 응답을 조각으로 받으면서 텍스트는 바로 yield(실시간 전달)하고, 도구 호출 정보는 조각을 이어 붙여 완전한 내용을 만듦. finish_reason이 'tool_calls'면 도구를 실행하고 결과를 포함해 다시 스트리밍을 시작함. 이 과정을 MAX_TOOL_ROUNDS(4번)까지 반복함.",
      terms: ["제너레이터(Generator)", "yield", "stream=True", "finish_reason", "delta.content", "delta.tool_calls", "tool_call_id", "예외 처리(try/except)", "딕셔너리(dict)"],
      lines: [
        { at: 'for _ in range(MAX_TOOL_ROUNDS):', text: "최대 4번까지 도구 호출 루프를 허용함. 무한 루프를 막는 안전장치임." },
        { at: 'stream = client.chat.completions.create(', text: "stream=True를 주면 전체 응답이 완성될 때까지 기다리지 않고, 조각(chunk) 단위로 즉시 받기 시작함." },
        { at: 'accumulated_tool_calls: dict[int, dict[str, Any]] = {}', text: "도구 호출 정보가 여러 청크에 나뉘어 도착하므로 index를 열쇠로 각 조각을 이어 붙일 저장소임." },
        { at: 'if delta.content:', text: "텍스트 조각이 있으면 즉시 yield해 화면에 실시간으로 표시함." },
        { at: 'if delta.tool_calls:', text: "도구 호출 조각이 있으면 index별로 id·name·arguments를 이어 붙여 누적함." },
        { at: 'if finish_reason != "tool_calls" or not accumulated_tool_calls:', text: "finish_reason이 'stop'이거나 도구 호출이 없으면 스트리밍이 완료된 것임. 루프를 빠져나옴." },
        { at: 'tool_calls_list = [accumulated_tool_calls[i] for i in sorted(accumulated_tool_calls)]', text: "누적된 도구 호출을 index 순서대로 정렬해 목록으로 만듦(리스트 컴프리헨션)." },
        { at: 'result = execute_function(function_name, function_args)', text: "★핵심★ execute_function이 도구를 실제로 실행해 날씨·관광지·맛집 정보를 가져옴." },
        { at: '"role": "tool",', text: "OpenAI 규격상 도구 결과는 반드시 role='tool' + tool_call_id로 전달해야 AI가 어떤 호출의 결과인지 짝 지을 수 있음." },
        { at: 'yield "함수 호출이 반복되어 처리를 중단함', text: "MAX_TOOL_ROUNDS를 다 써도 끝나지 않으면 안내 메시지를 yield하고 루프를 완전히 종료함." },
      ],
      code:
`def stream_response(user_input: str) -> Generator[str, None, None]:
    """텍스트 청크를 순서대로 yield하는 스트리밍 제너레이터.

    tool_calls가 필요한 경우 내부에서 함수를 실행하고
    최종 답변을 스트리밍으로 이어서 반환함.

    핵심 흐름:
    1. stream=True로 스트리밍 응답 수신
    2. delta.content 청크를 순서대로 yield
    3. delta.tool_calls를 index별로 누적 (arguments는 여러 청크로 나뉘어 도착)
    4. finish_reason == "tool_calls": 누적된 tool_call을 실행 후 새 스트림 시작
    5. finish_reason == "stop": 스트리밍 완료
    """
    client = get_client()
    tools = get_openai_tools()
    messages = build_chat_messages(user_input)
    tool_trace: list[dict[str, Any]] = []

    for _ in range(MAX_TOOL_ROUNDS):
        # stream=True로 청크 단위 응답을 받음.
        # 각 chunk의 choices[0].delta에 텍스트 또는 tool_call 정보가 포함됨.
        stream = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            parallel_tool_calls=True,
            stream=True,
        )

        # tool_calls 정보는 여러 청크에 걸쳐 분할 전달됨.
        # index를 키로 사용하여 각 tool_call의 arguments 조각을 누적함.
        accumulated_tool_calls: dict[int, dict[str, Any]] = {}
        accumulated_text = ""
        finish_reason = None

        for chunk in stream:
            choice = chunk.choices[0] if chunk.choices else None
            if choice is None:
                continue

            # finish_reason은 마지막 청크에만 설정됨
            if choice.finish_reason:
                finish_reason = choice.finish_reason

            delta = choice.delta

            # 텍스트 청크: delta.content가 있으면 실시간 yield
            if delta.content:
                accumulated_text += delta.content
                yield delta.content

            # tool_calls 청크: index별로 id, name, arguments를 누적
            if delta.tool_calls:
                for tc_delta in delta.tool_calls:
                    idx = tc_delta.index
                    if idx not in accumulated_tool_calls:
                        accumulated_tool_calls[idx] = {
                            "id": "",
                            "type": "function",
                            "function": {"name": "", "arguments": ""},
                        }
                    tc = accumulated_tool_calls[idx]
                    if tc_delta.id:
                        tc["id"] += tc_delta.id
                    if tc_delta.function:
                        if tc_delta.function.name:
                            tc["function"]["name"] += tc_delta.function.name
                        if tc_delta.function.arguments:
                            tc["function"]["arguments"] += tc_delta.function.arguments

        # finish_reason이 "stop"이거나 tool_calls가 없으면 스트리밍 완료
        if finish_reason != "tool_calls" or not accumulated_tool_calls:
            st.session_state.last_tool_trace = tool_trace
            return

        # tool_calls 실행: assistant 메시지를 먼저 대화 기록에 추가해야 함.
        # 이 순서가 있어야 다음 API 호출에서 tool 결과를 올바른 요청의 응답으로 해석함.
        tool_calls_list = [accumulated_tool_calls[i] for i in sorted(accumulated_tool_calls)]
        assistant_msg: dict[str, Any] = {"role": "assistant", "tool_calls": tool_calls_list}
        if accumulated_text:
            assistant_msg["content"] = accumulated_text
        messages.append(assistant_msg)

        for tc in tool_calls_list:
            function_name = tc["function"]["name"]
            function_args = parse_tool_arguments(tc["function"]["arguments"])
            result = execute_function(function_name, function_args)

            tool_trace.append({
                "function": function_name,
                "arguments": function_args,
                "has_error": isinstance(result, dict) and bool(result.get("error")),
            })

            # OpenAI tool 결과는 반드시 role="tool" + tool_call_id로 전달함.
            # tool_call_id는 어떤 함수 호출의 결과인지 모델이 매칭하는 식별자임.
            messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": json.dumps(result, ensure_ascii=False),
            })

    st.session_state.last_tool_trace = tool_trace
    yield "함수 호출이 반복되어 처리를 중단함. 요청을 더 구체적으로 입력해 주세요."`,
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
        { at: 'st.markdown(message["content"])', text: "st.markdown은 글자를 굵게·목록 등 서식과 함께 화면에 표시함." },
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
      summary: "왼쪽 사이드바에 사용법·기술 흐름·대화 턴 수·초기화 버튼·직전 함수 호출 기록을 표시함.",
      how: "화면 왼쪽의 보조 패널을 구성함. with st.sidebar 블록 안의 내용은 모두 왼쪽에 표시됨. '대화 초기화' 버튼을 누르면 저장된 대화를 비우고 st.rerun()으로 화면을 새로 그림. 직전에 호출된 도구가 있으면 성공/오류와 함께 보여줌.",
      terms: ["st.sidebar", "st.rerun", "JSON"],
      lines: [
        { at: 'with st.sidebar:', text: "with st.sidebar: 이 블록 안에서 출력하는 모든 것이 왼쪽 사이드바에 표시됨." },
        { at: 'st.metric("대화 턴"', text: "대화 턴(주고받은 횟수)을 숫자 지표로 보여줌." },
        { at: 'if st.button("대화 초기화"', text: "'대화 초기화' 버튼. 누르면 아래 줄들이 실행되어 기록을 모두 비움." },
        { at: 'st.rerun()', text: "st.rerun()은 화면을 처음부터 다시 그리게 함(초기화 결과를 즉시 반영)." },
        { at: 'st.header("직전 함수 호출")', text: "직전에 호출된 도구 기록이 있으면, 함수명·인자·성공여부를 코드 블록으로 표시함." },
      ],
      code:
`def display_sidebar() -> None:
    """예제 사용법과 직전 Function Calling trace를 표시함."""
    with st.sidebar:
        st.header("사용 방법")
        st.markdown(USAGE_GUIDE)

        st.divider()
        st.header("기술 흐름")
        st.markdown(TECH_GUIDE)

        st.divider()
        st.metric("대화 턴", st.session_state.turn_count)

        if st.button("대화 초기화", use_container_width=True):
            st.session_state.messages = [{"role": "assistant", "content": WELCOME_MESSAGE}]
            st.session_state.last_tool_trace = []
            st.session_state.turn_count = 0
            st.rerun()

        if st.session_state.last_tool_trace:
            st.divider()
            st.header("직전 함수 호출")
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
      summary: "앱의 시작점. 화면을 세팅하고, 입력을 받고, 스트리밍 답변을 생성·표시하는 전체 흐름을 지휘함.",
      how: "프로그램의 '시작 버튼'에 해당함. 페이지 설정 → 상태 초기화 → 사이드바·이전 대화 표시 → 채팅창 입력 처리 순으로 진행함. 핵심은 st.write_stream(): 제너레이터(stream_response)에서 텍스트 청크를 받아 실시간으로 화면에 렌더링하고 완성된 전체 텍스트를 돌려줌.",
      terms: ["st.chat_input", "st.write_stream", ":= (바다코끼리)", "예외 처리(try/except)", "Streamlit", "제너레이터(Generator)"],
      lines: [
        { at: 'st.set_page_config(', text: "st.set_page_config는 브라우저 탭 제목·아이콘·레이아웃을 정함. 코드 맨 처음에 한 번 호출해야 함." },
        { at: 'if user_input := st.chat_input(', text: "★중요 문법★ := (바다코끼리 연산자)는 '입력값을 user_input에 담으면서 동시에 비었는지 검사'함. 입력이 있을 때만 if 블록 실행." },
        { at: 'assistant_response = st.write_stream(stream_response(user_input))', text: "★핵심★ st.write_stream()은 stream_response 제너레이터에서 텍스트 조각이 도착할 때마다 화면에 추가해 표시함. 타이핑 효과가 이 한 줄에서 나옴." },
        { at: 'except Exception as exc:', text: "스트리밍 도중 오류가 나도 앱이 죽지 않도록 오류 메시지로 대체함." },
      ],
      code:
`def main() -> None:
    """Streamlit 앱 진입점."""
    st.set_page_config(
        page_title=f"{APP_TITLE} - OpenAI (Streaming)",
        page_icon=APP_ICON,
        layout="centered",
    )
    st.title(APP_TITLE)
    st.caption("OpenAI Chat Completions Tool Calling + Streaming + Streamlit")

    initialize_session_state()
    display_sidebar()
    display_chat_history()

    if user_input := st.chat_input("예: 서울, 도쿄 날씨, 파리 관광지, 부산 맛집"):  # st.chat_input: 채팅창 하단 입력란을 렌더링하고 입력값을 반환함 / := 는 조건 검사와 동시에 변수에 값을 할당함
        st.session_state.messages.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.markdown(user_input)

        with st.chat_message("assistant"):
            try:
                # st.write_stream()은 제너레이터에서 텍스트 청크를 받아
                # 실시간으로 화면에 렌더링하고 누적된 전체 텍스트를 반환함.
                assistant_response = st.write_stream(stream_response(user_input))
            except Exception as exc:
                assistant_response = f"오류가 발생함: {exc}"
                st.markdown(assistant_response)

        st.session_state.messages.append({"role": "assistant", "content": assistant_response})
        st.session_state.turn_count += 1


if __name__ == "__main__":  # 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
    main()`,
    },

    // ===== common/tools.py (도구 구현) =====
    {
      id: "normalize_city_name",
      name: "normalize_city_name(city)",
      fileId: "tools",
      summary: "'서울', '도쿄' 같은 한글 도시명을 외부 API가 알아듣는 영문('Seoul', 'Tokyo')으로 바꿈.",
      how: "날씨·지도 API는 영문 도시명을 받음. 미리 만들어 둔 표(CITY_NAME_MAP)에서 한글을 찾아 영문으로 바꿔줌. 표에 없으면 입력을 그대로 돌려줌. 앞뒤 공백은 strip()으로 제거함.",
      terms: ["딕셔너리(dict)", ".get()"],
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
        { at: 'return f"https://www.google.com/maps/search/', text: "f-string으로 변수 값을 URL에 끼워 넣어 완성된 구글 지도 검색 링크를 반환함." },
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
      how: "여러 도구가 공통으로 쓰는 'HTTP 요청 + 결과 받기' 함수임. timeout=12는 '12초 안에 응답이 없으면 포기'라는 뜻으로, 무한 대기를 방지함. raise_for_status()는 응답이 실패(404 등)면 오류를 내게 함.",
      terms: ["requests", "raise_for_status()", "JSON"],
      lines: [
        { at: 'response = requests.request(method, url, timeout=12, **kwargs)', text: "requests.request가 실제로 인터넷에 요청을 보냄. timeout=12로 너무 오래 기다리지 않게 함." },
        { at: 'response.raise_for_status()', text: "응답이 실패 상태(예: 404, 500)면 여기서 오류를 발생시켜 잘못된 데이터를 쓰지 않게 함." },
        { at: 'return response.json()', text: "응답 본문을 JSON으로 해석해 파이썬 딕셔너리로 돌려줌." },
      ],
      code:
`def _request_json(method: str, url: str, **kwargs) -> dict[str, Any]:
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
      terms: ["딕셔너리(dict)", ".get()", "f-string"],
      lines: [
        { at: 'display_name = place.get("displayName", {}).get("text", "Unknown place")', text: ".get(\"displayName\", {})는 'displayName이 없으면 빈 딕셔너리를 쓰라'는 안전한 꺼내기임. 연달아 .get으로 더 깊은 값을 안전하게 꺼냄." },
        { at: 'type_hint = ", ".join(', text: "types[:2]는 앞 2개만 잘라옴. PLACE_TYPE_LABELS 표로 영문 분류를 한글 라벨로 바꿈." },
        { at: 'maps_url = build_google_maps_search_url(display_name, city)', text: "장소별 구글 지도 링크를 미리 만들어 둠." },
        { at: '"name": display_name,', text: "정리된 깔끔한 딕셔너리를 돌려줌(이름·평점·주소·설명·링크 등)." },
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
    # (Places API는 영문으로 결과를 반환하므로 display_name이 영문 검색 쿼리로 적합함)
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
      terms: ["RuntimeError", "FieldMask", "JSON", "리스트 컴프리헨션"],
      lines: [
        { at: 'if not GOOGLE_PLACES_API_KEY:', text: "API 키가 없으면 RuntimeError로 즉시 멈춰, 원인을 분명히 알려줌." },
        { at: '"X-Goog-FieldMask": (', text: "X-Goog-FieldMask는 '응답에서 이 항목들만 보내달라'고 구글에 지정하는 것임(불필요한 데이터·비용 절감)." },
        { at: '"maxResultCount": max(1, min(max_results, 20)),', text: "maxResultCount를 1~20 사이로 강제해, 과도한 요청을 막음." },
        { at: 'return [_compact_place(place, city) for place in data.get("places", [])]', text: "받은 장소들을 하나씩 _compact_place로 정리해 목록으로 만들어 돌려줌(리스트 컴프리헨션)." },
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
      name: "get_weather(city)",
      fileId: "tools",
      summary: "도시의 현재 날씨를 조회하는 도구 함수. AI가 '날씨' 관련 요청에 이 함수를 자동 선택함.",
      how: "OpenWeatherMap API를 호출해 기온·체감·습도·바람 등을 정리해 돌려줌. API 키가 없으면 error를 담아 반환해 앱이 멈추지 않게 함. 오류가 나도 멈추지 않고 error 항목을 담아 반환함.",
      terms: ["딕셔너리(dict)", ".get()", "예외 처리(try/except)", "API 키", "환경변수(.env)"],
      lines: [
        { at: 'if not OPENWEATHER_API_KEY:', text: "날씨 API 키가 없으면 멈추지 않고 error 메시지를 담은 결과를 돌려줌." },
        { at: 'city_en = normalize_city_name(city)', text: "도시명을 영문으로 변환한 뒤 API에 전달함." },
        { at: 'weather = data.get("weather", [{}])[0]', text: "응답에서 날씨 항목을 .get()으로 안전하게 꺼냄. 항목이 없으면 빈 딕셔너리를 써서 KeyError를 막음." },
        { at: 'except requests.exceptions.HTTPError as exc:', text: "통신 오류가 나도 앱이 죽지 않게, error 항목을 담아 정상적으로 반환함." },
      ],
      code:
`def get_weather(city: str) -> dict[str, Any]:
    """OpenWeatherMap Current Weather API로 도시 현재 날씨를 조회하여 반환."""
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
      name: "get_tourist_attractions(city, max_results)",
      fileId: "tools",
      summary: "도시의 대표 관광지를 평점·주소·설명·지도 링크와 함께 검색하는 도구 함수.",
      how: "관광지 검색 도구임. max_results=DEFAULT_MAX_RESULTS처럼 '기본값이 있는 인자'를 써서, AI가 개수를 안 정해도 기본값(8개)으로 동작함. 내부적으로 _search_places를 호출함.",
      terms: ["예외 처리(try/except)", "딕셔너리(dict)"],
      lines: [
        { at: 'def get_tourist_attractions(city: str, max_results: int = DEFAULT_MAX_RESULTS)', text: "max_results: int = DEFAULT_MAX_RESULTS는 '값을 안 주면 기본 8개'라는 기본값 인자임." },
        { at: 'places = _search_places(f"top tourist attractions in {city_en}"', text: "공용 검색 함수 _search_places로 'top tourist attractions in 도시' 질의를 보냄." },
        { at: 'except Exception as exc:', text: "오류가 나면 error 항목을 담아 반환(앱이 멈추지 않음)." },
      ],
      code:
`def get_tourist_attractions(city: str, max_results: int = DEFAULT_MAX_RESULTS) -> dict[str, Any]:
    """Google Places Text Search(New)로 도시 관광지를 검색하여 반환."""
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
      name: "get_restaurants(city, meal_type, keyword, max_results)",
      fileId: "tools",
      summary: "도시의 맛집을 검색하는 도구 함수. 아침/점심/저녁(meal_type)이나 키워드로 좁혀 찾을 수 있음.",
      how: "맛집 검색 도구임. meal_type·keyword는 None이 기본값인 선택 인자라, AI가 상황에 따라 일부만 채워 호출할 수 있음. 채워진 값들만 모아 검색어를 조립한 뒤 _search_places로 검색함.",
      terms: ["리스트 컴프리헨션", "예외 처리(try/except)"],
      lines: [
        { at: 'meal_type: str | None = None,', text: "meal_type·keyword는 str | None = None, 즉 '있어도 되고 없어도 되는' 선택 인자임." },
        { at: 'query_parts = [part for part in [meal_type, keyword, "restaurants"] if part]', text: "값이 채워진 항목만 골라(리스트 컴프리헨션) 검색어를 조립함." },
        { at: 'places = _search_places(query, city_en, max_results)', text: "조립한 검색어로 맛집을 검색함." },
      ],
      code:
`def get_restaurants(
    city: str,
    meal_type: str | None = None,
    keyword: str | None = None,
    max_results: int = DEFAULT_MAX_RESULTS,
) -> dict[str, Any]:
    """Google Places Text Search(New)로 도시 맛집을 검색하여 반환."""
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
    {
      id: "execute_function",
      name: "execute_function(function_name, arguments)",
      fileId: "tools",
      summary: "AI가 요청한 함수 이름과 인자를 받아, 허용된 함수만 안전하게 실행하는 관문(화이트리스트).",
      how: "AI가 요청했다고 해서 아무 함수나 실행하면 보안 위험이 생김. 미리 정해둔 허용 목록(화이트리스트)에 있는 함수만 실행하고, 없으면 error를 돌려줌. 도시명을 한 번 더 영문으로 변환해 안전하게 전달함.",
      terms: ["딕셔너리(dict)", "예외 처리(try/except)", "화이트리스트"],
      lines: [
        { at: 'available_functions = {', text: "허용된 함수들을 '이름→함수' 딕셔너리로 등록함(화이트리스트). 등록되지 않은 함수는 절대 실행되지 않음." },
        { at: 'if function_name not in available_functions:', text: "요청된 함수 이름이 허용 목록에 없으면 error를 돌려주고 실행하지 않음." },
        { at: 'safe_arguments["city"] = normalize_city_name(', text: "city 인자를 한 번 더 영문으로 변환해 API에 안전하게 전달함." },
        { at: 'return available_functions[function_name](**safe_arguments)', text: "허용된 함수를 **인자(키워드 인자 언패킹)로 호출함." },
      ],
      code:
`# LLM이 요청한 함수를 화이트리스트(허용 목록) 기반으로만 실행함
# (임의 함수 실행을 막아 코드 인젝션 등 보안 위협을 방지함)
def execute_function(function_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """LLM 도구 호출 요청에 따라 허용된 함수만 실행하여 결과 반환."""
    available_functions = {
        "get_weather": get_weather,
        "get_tourist_attractions": get_tourist_attractions,
        "get_restaurants": get_restaurants,
    }
    if function_name not in available_functions:
        return {"error": f"알 수 없는 함수임: {function_name}"}

    try:
        safe_arguments = dict(arguments or {})
        if "city" in safe_arguments:
            safe_arguments["city"] = normalize_city_name(str(safe_arguments["city"]))
        return available_functions[function_name](**safe_arguments)
    except TypeError as exc:
        return {"error": f"함수 인자 오류: {exc}"}
    except Exception as exc:
        return {"error": f"함수 실행 오류: {exc}"}`,
    },

    // ===== common/prompts.py (프롬프트·스키마) =====
    {
      id: "SYSTEM_PROMPT_AND_TOOLS",
      name: "SYSTEM_PROMPT + TOOL_DEFINITIONS (상수)",
      fileId: "prompts",
      summary: "AI에게 '너는 여행 플래너야'라고 알려주는 지침서와, AI가 쓸 수 있는 함수 목록(스키마)을 정의함.",
      how: "SYSTEM_PROMPT는 코드가 아닌 '자연어 규칙'임. 요청 유형 판단법, 도시명 영문 변환, 날씨에 따른 추천 기준 등을 자연어로 적어 둠. TOOL_DEFINITIONS는 각 함수의 이름·설명·파라미터를 JSON Schema 형식으로 적어 AI에게 '이런 함수들을 쓸 수 있어'라고 알려주는 역할을 함.",
      terms: ["JSON Schema", "Function Calling"],
      lines: [
        { at: 'SYSTEM_PROMPT = """당신은 여행 중인', text: "이 따옴표 세 개(\"\"\"...)로 둘러싼 긴 글 전체가 AI에게 주는 지침임. 역할·규칙·답변 형식을 자연어로 안내함." },
        { at: 'TOOL_DEFINITIONS = [', text: "TOOL_DEFINITIONS는 AI가 호출할 수 있는 함수들의 '명세서' 목록임. 이름·설명·파라미터를 JSON Schema로 기술함." },
        { at: '"name": "get_weather",', text: "각 항목은 하나의 함수를 나타냄. name은 함수명, description은 AI가 읽는 사용 설명서, parameters는 인자 정의임." },
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
"""

# OpenAI/Claude/Gemini Function Calling에서 공통으로 사용하는 도구 스키마 정의
# (JSON Schema 형식으로 함수명·설명·파라미터를 기술하면 LLM이 호출 여부와 인자를 결정함)
TOOL_DEFINITIONS = [
    {
        "name": "get_weather",
        "description": "Get current weather for a city. Use this for weather-only requests or as part of a daily route plan.",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "English city name, such as Seoul, Tokyo, Paris, Busan.",
                }
            },
            "required": ["city"],
        },
    },
    {
        "name": "get_tourist_attractions",
        "description": "Search top tourist attractions in a city with rating, address, short description, and Google Maps URL.",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "English city name.",
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of attractions to return.",
                },
            },
            "required": ["city"],
        },
    },
    {
        "name": "get_restaurants",
        "description": "Search restaurants in a city. Use meal_type for breakfast, lunch, or dinner when useful.",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "English city name.",
                },
                "meal_type": {
                    "type": "string",
                    "description": "Optional meal type: breakfast, lunch, dinner, brunch, cafe.",
                },
                "keyword": {
                    "type": "string",
                    "description": "Optional food keyword such as Korean, seafood, ramen, vegan.",
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of restaurants to return.",
                },
            },
            "required": ["city"],
        },
    },
]`,
    },
    {
      id: "get_openai_tools",
      name: "get_openai_tools()",
      fileId: "prompts",
      summary: "공통 도구 정의를 OpenAI Chat API의 tools 형식으로 변환해 돌려줌.",
      how: "OpenAI API는 도구를 {type: 'function', function: {...}} 형식으로 받음. TOOL_DEFINITIONS를 순회하며 이 형식으로 감싸 목록으로 만들어 줌.",
      terms: ["리스트 컴프리헨션", "JSON Schema", "Function Calling"],
      lines: [
        { at: 'return [', text: "TOOL_DEFINITIONS 목록을 순회하며 OpenAI 형식으로 감싸 새 목록을 만드는 리스트 컴프리헨션임." },
        { at: '"type": "function",', text: "OpenAI API가 요구하는 래퍼 형식. 안에 name·description·parameters를 담음." },
      ],
      code:
`def get_openai_tools() -> list[dict]:
    """공통 도구 정의를 OpenAI Chat Completions tool 형식으로 변환하여 반환."""
    return [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["parameters"],
            },
        }
        for tool in TOOL_DEFINITIONS
    ]`,
    },

    // ===== common/llm.py (클라이언트 도우미) =====
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
`def load_hands_on_env() -> Path:
    """hands-on/.env를 로드하여 모든 예제가 공통 키 파일을 공유하도록 함."""
    # .env 파일에서 API 키 등 환경변수를 로드함
    load_dotenv(HANDS_ON_ENV_PATH)
    return HANDS_ON_ENV_PATH`,
    },
    {
      id: "require_api_key",
      name: "require_api_key(env_name)",
      fileId: "llm",
      summary: "필요한 API 키를 읽어오고, 없으면 '키가 없다'고 분명한 오류를 내는 안전장치.",
      how: "키 없이 실행하면 한참 뒤 엉뚱한 곳에서 알 수 없는 오류가 남. 이 함수는 시작 시점에 키를 확인하고, 없으면 즉시 RuntimeError로 '어떤 키가 어디에 없는지'를 알려줘 문제를 빨리 찾게 함.",
      terms: ["환경변수(.env)", "API 키", "RuntimeError"],
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
    if not api_key:
        raise RuntimeError(f"{env_name}가 설정되지 않았습니다: {HANDS_ON_ENV_PATH}")
    return api_key`,
    },
    {
      id: "create_openai_client",
      name: "create_openai_client()",
      fileId: "llm",
      summary: "API 키를 읽어 OpenAI 서버와 통신하는 클라이언트 객체를 만들어 돌려줌.",
      how: "require_api_key로 OPENAI_API_KEY를 읽어 OpenAI 클라이언트를 만듦. from openai import OpenAI를 함수 내부에서 실행하는 이유는, 이 모듈을 import할 때 불필요하게 openai 라이브러리가 로드되지 않게 하기 위함임(지연 import).",
      terms: ["OpenAI 클라이언트", "지연 생성(lazy)", "API 키"],
      lines: [
        { at: 'from openai import OpenAI', text: "함수 내부에서 import해 다른 예제(Claude·Gemini)가 이 파일을 가져올 때 openai 라이브러리를 불필요하게 로드하지 않게 함(지연 import)." },
        { at: 'return OpenAI(api_key=require_api_key("OPENAI_API_KEY"))', text: "require_api_key로 키를 읽어 OpenAI 클라이언트를 만들어 돌려줌." },
      ],
      code:
`def create_openai_client():
    """OpenAI 클라이언트를 지연 생성하여 반환. 다른 예제에서 불필요한 import 방지."""
    from openai import OpenAI

    return OpenAI(api_key=require_api_key("OPENAI_API_KEY"))`,
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
        { at: 'TECH_GUIDE = """### 핵심 흐름', text: "TECH_GUIDE: Function Calling 동작 흐름을 간단히 정리한 기술 안내." },
      ],
      code:
`APP_TITLE = "여행 플래너"
APP_ICON = "🗺️"

WELCOME_MESSAGE = """안녕하세요. 오늘 여행 루트를 함께 정리하는 AI 여행 플래너임.

도시명을 알려주면 날씨, 관광지, 맛집 정보를 함수 호출로 조회한 뒤 오늘 일정으로 추천함.

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

TECH_GUIDE = """### 핵심 흐름
1. 사용자 요청 분석
2. 필요한 함수 선택
3. 외부 API 호출
4. 함수 결과를 모델에 전달
5. 최종 답변 생성
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
    "st.sidebar": "화면 왼쪽의 보조 패널. with st.sidebar 블록 안에서 출력한 것은 모두 왼쪽에 표시됨.",
    "st.write_stream": "제너레이터(또는 이터레이터)에서 텍스트 조각을 받아 화면에 실시간으로 표시하는 기능. 타이핑하듯 글자가 흘러나오는 효과를 냄.",
    "stream=True": "API 응답을 한 번에 받지 않고 조각(chunk) 단위로 실시간으로 받겠다는 옵션. 사용자가 기다리는 시간을 체감적으로 줄여줌.",
    "제너레이터(Generator)": "값을 한 번에 다 만들지 않고, 필요할 때 하나씩 만들어 주는 함수. yield로 값을 내보내며, 호출자가 next()를 부를 때마다 다음 값을 생성함.",
    "yield": "제너레이터 함수에서 값을 하나씩 '내보내는' 키워드. 함수가 멈추지 않고 값을 내보낸 뒤 다음 호출까지 상태를 유지함. 스트리밍 텍스트를 조각 단위로 전달할 때 씀.",
    "finish_reason": "API 응답이 왜 끝났는지를 알려주는 값. 'stop'이면 자연스럽게 완료된 것, 'tool_calls'이면 도구를 호출해야 한다는 신호임.",
    "delta.content": "스트리밍 응답에서 텍스트 조각을 담는 필드. 각 청크마다 조금씩 텍스트가 들어 있어 이어 붙이면 전체 답변이 됨.",
    "delta.tool_calls": "스트리밍 응답에서 도구 호출 조각을 담는 필드. 여러 청크에 나뉘어 도착하므로 index별로 이어 붙여야 완전한 도구 호출 정보가 됨.",
    "tool_call_id": "도구 호출 하나하나에 붙는 고유 번호(영수증 번호). 어떤 호출의 결과인지 짝지을 때 사용함.",
    "Function Calling": "AI가 응답 대신 '이 함수를 이런 인자로 호출해줘'라고 요청하는 기능. AI와 외부 API를 연결하는 핵심 메커니즘임.",
    "JSON Schema": "데이터 구조를 JSON 형식으로 기술하는 표준 방법. 함수의 파라미터 형태·필수 여부 등을 AI에게 알려줄 때 사용함.",
    "화이트리스트": "허용된 항목만 적어둔 목록. 목록에 없는 것은 무조건 거부함. 보안을 위해 AI가 요청한 함수를 그대로 실행하지 않고 허용 목록에서 확인 후 실행함.",
    ":= (바다코끼리)": "값을 변수에 '담으면서 동시에' 그 값을 검사하는 연산자. 모양이 바다코끼리 눈·엄니를 닮아 붙은 별명. 예: if (x := 입력값): 은 입력을 x에 담고 비었는지 바로 확인함.",
    "지연 생성(lazy)": "필요해질 때까지 만들지 않고 미뤘다가, 처음 쓸 때 한 번만 만드는 방식. 불필요한 작업과 비용을 줄임.",
    "캐싱(cache)": "한 번 만든 결과를 저장해 두고, 다음에 또 필요하면 다시 만들지 않고 저장본을 재사용하는 것.",
    "OpenAI 클라이언트": "OpenAI 서버와 통신하는 객체. client.chat.completions.create(...)처럼 이 객체를 통해 API를 호출함.",
    "requests": "파이썬에서 인터넷 주소로 요청을 보내고 응답을 받는 대표적인 라이브러리(HTTP 통신 도구).",
    "raise_for_status()": "인터넷 응답이 실패(예: 404 없음, 500 서버오류)면 오류를 발생시키는 점검 장치. 잘못된 응답을 그냥 쓰지 않게 함.",
    "JSON": "데이터를 주고받는 표준 글자 형식. {\"key\": \"value\"} 모양으로, 파이썬 딕셔너리와 거의 똑같이 생김.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"도시\": \"서울\"}처럼 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    "리스트(list)": "여러 값을 순서대로 담는 목록. [\"a\", \"b\"]처럼 대괄호로 표현함.",
    "리스트 컴프리헨션": "[표현식 for 항목 in 목록 if 조건] 형태로, 반복문을 한 줄로 짧게 써서 새 목록을 만드는 파이썬 문법.",
    ".get()": "딕셔너리에서 값을 '안전하게' 꺼내는 방법. 열쇠가 없어도 오류를 내지 않고, 정해둔 기본값을 돌려줌.",
    "isinstance()": "어떤 값이 특정 종류(타입)인지 확인하는 함수. 예: isinstance(x, dict)는 'x가 딕셔너리인가?'를 True/False로 답함.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "RuntimeError": "'실행 중 문제가 생겼다'고 알리는 오류의 한 종류. 여기서는 API 키가 없을 때 일부러 발생시켜 원인을 알려줌.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env라는 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(날씨·지도 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "quote_plus": "글자를 URL 주소에 안전하게 넣을 수 있는 형태로 바꿔주는 함수(공백을 +로 바꾸는 등).",
    "FieldMask": "API에 '응답에서 이 항목들만 보내줘'라고 지정하는 것. 불필요한 데이터 전송과 비용을 줄임.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
    "타입 힌트": "변수나 함수에 '이건 문자열(str)이야, 결과는 목록(list)이야'처럼 자료의 종류를 적어두는 표시. 실행에 꼭 필요하진 않지만, 코드를 읽고 점검하기 쉽게 함.",
  },
};
