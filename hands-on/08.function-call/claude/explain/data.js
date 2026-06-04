/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../08.function-call/claude/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "여행 플래너 (Claude Messages API Tool Use) 예제 설명",
    entry: "travel_planner.py",
  },

  files: [
    { id: "main",    label: "travel_planner.py",       role: "메인 파일 · 화면과 수동 Tool Use 루프" },
    { id: "tools",   label: "common/tools.py",         role: "AI가 호출하는 도구(날씨·관광지·맛집) + 화이트리스트 실행" },
    { id: "prompts", label: "common/prompts.py",       role: "시스템 프롬프트 + 도구 JSON 스키마 정의" },
    { id: "llm",     label: "common/llm.py",           role: "Claude 클라이언트 생성 + Messages API 호출 헬퍼" },
    { id: "uitext",  label: "common/ui_text.py",       role: "화면에 표시할 안내 문구 상수 모음" },
  ],

  flow: [
    { step: 1, title: "앱 시작", label: "앱 시작", refs: ["main", "initialize_session_state"],
      summary: "main() 함수가 실행되어 화면 제목·아이콘을 정하고 기억 공간을 준비함",
      detail: "프로그램의 '시작 버튼'이 main() 함수임. 식당으로 비유하면 가게 문을 열고 간판을 거는 단계임. initialize_session_state()가 '대화 내용·Claude 클라이언트·도구 호출 기록·대화 횟수'를 담을 빈 상자(기억 공간)를 만들어 둠." },
    { step: 2, title: "화면 구성", label: "화면 구성", refs: ["display_sidebar", "display_chat_history"],
      summary: "왼쪽 사이드바(사용법·도구 기록)와 환영 인사, 이전 대화를 화면에 그림",
      detail: "손님이 앉기 전 메뉴판과 안내문을 세팅하는 단계임. display_sidebar()는 왼쪽 도움말을, display_chat_history()는 지금까지 오간 대화를 다시 그려줌. 아직 새 입력은 받기 전임." },
    { step: 3, title: "사용자 입력 대기", label: "사용자 입력 대기",
      summary: "화면 맨 아래 채팅창(st.chat_input)에서 '서울', '도쿄 날씨' 같은 입력을 기다림",
      detail: "손님의 주문을 기다리는 단계임. 사용자가 도시명이나 질문을 입력하고 Enter를 누르면 다음 단계로 넘어감. 입력이 없으면 여기서 계속 대기함." },
    { step: 4, title: "입력 저장·표시", label: "입력 저장·표시",
      summary: "입력한 문장을 대화 기록에 추가하고, 사용자 말풍선으로 화면에 보여줌",
      detail: "주문서를 받아 적고 손님에게 '주문 확인됐습니다'라고 보여주는 단계임. 입력은 messages 목록에 저장되어 다음 대화에서도 맥락으로 활용됨." },
    { step: 5, title: "메시지 준비", label: "메시지 준비", refs: ["build_chat_messages"],
      summary: "build_chat_messages()가 최근 대화를 Claude API 형식의 메시지 배열로 변환함",
      detail: "AI가 알아듣는 형식으로 주문서를 정리하는 단계임. role='user' / role='assistant' 형태의 딕셔너리 목록을 만듦. 시스템 지침(SYSTEM_PROMPT)은 별도 파라미터로 전달하므로 여기선 포함하지 않음." },
    { step: 6, title: "Claude API 첫 호출", label: "Claude API 첫 호출", refs: ["generate_response", "call_claude_messages"],
      summary: "call_claude_messages()로 Claude에게 '도구를 써야 할지 판단해줘'라고 요청함",
      detail: "주방장(Claude)에게 주문서를 넘기는 단계임. tools 파라미터에 get_weather·get_tourist_attractions·get_restaurants의 스키마를 넣어 '이 도구들을 쓸 수 있어'라고 알려줌. Claude는 응답에서 stop_reason을 통해 '도구 호출 필요(tool_use)' 또는 '바로 답변 가능(end_turn)'을 알려줌." },
    { step: 7, title: "도구 필요 여부 판단", label: "도구 필요 여부 판단", refs: ["generate_response"],
      summary: "response.stop_reason이 'tool_use'인지 확인해 루프를 계속할지 결정함",
      detail: "주방장이 '재료(외부 정보)가 필요하다'고 알려오면 도구를 호출함. 'end_turn'이면 바로 텍스트 답변을 추출해 반환함. MAX_TOOL_ROUNDS(5번)가 넘으면 강제로 루프를 종료함. 이 판단 루프가 09.langchain 예제에서 create_react_agent 한 줄로 대체되는 부분임." },
    { step: 8, title: "도구 실행", label: "도구 실행", refs: ["run_tool_calls", "execute_function"],
      summary: "run_tool_calls()가 tool_use 블록을 찾아 execute_function()으로 실제 함수를 실행함",
      detail: "주방장이 요청한 재료를 직접 가져오는 단계임. assistant 응답의 content에서 type='tool_use' 블록을 찾아, 허용된 함수(화이트리스트)만 실행함. 결과를 type='tool_result' 블록으로 만들어 단일 role='user' 메시지에 묶음." },
    { step: 9, title: "도구 결과 전달·재호출", label: "도구 결과 전달·재호출", refs: ["generate_response", "run_tool_calls"],
      summary: "tool_result 메시지를 대화에 추가하고 Claude를 다시 호출해 답변을 유도함",
      detail: "재료를 가져왔으니 주방장에게 다시 넘기는 단계임. assistant 응답(tool_use 블록 포함)과 tool_result 메시지를 차례로 messages에 추가한 뒤 Claude를 재호출함. 더 이상 도구가 필요 없으면 Claude가 최종 텍스트 답변을 생성함." },
    { step: 10, title: "응답 표시", label: "응답 표시", refs: ["extract_text"],
      summary: "extract_text()가 최종 AIMessage에서 텍스트만 뽑아 말풍선으로 보여줌",
      detail: "완성된 요리를 손님에게 내는 단계임. 답변 말풍선과 함께, 어떤 함수가 호출됐는지(run_tool_calls에서 추출한 traces) 왼쪽 사이드바에 보여줘 동작을 투명하게 확인할 수 있게 함." },
    { step: 11, title: "반복", label: "반복",
      summary: "사용자가 새 입력을 하면 3번 단계부터 다시 진행함",
      detail: "손님이 추가 주문을 하면 같은 과정을 반복함. 이전 대화가 기억(messages)에 남아 있어 이어지는 질문도 맥락을 이해함." },
  ],

  functions: [
    // ===== travel_planner.py (메인) =====
    {
      id: "initialize_session_state",
      name: "initialize_session_state()",
      fileId: "main",
      summary: "화면을 새로 그릴 때마다 사라지지 않고 유지해야 할 데이터를 위한 빈 저장 공간을 만듦.",
      how: "Streamlit은 사용자가 무언가 누를 때마다 코드를 처음부터 다시 실행함. 그래서 일반 변수는 매번 초기화되어 버림. st.session_state라는 특별한 저장소에 넣어두면 그 탭이 열려 있는 동안 값이 유지됨. 'if 키가 없으면 만든다' 패턴으로, 이미 있으면 덮어쓰지 않고 그대로 둠. tool_use 블록과 tool_result는 API 루프 내부에서만 쓰고 여기에 저장하지 않는 이유도 주석으로 설명돼 있음.",
      terms: ["st.session_state", "Streamlit", "딕셔너리(dict)", "tool_use 블록", "tool_result"],
      lines: [
        { at: 'if "messages" not in st.session_state:  # st.session_state:', text: "st.session_state는 '탭이 열려 있는 동안 유지되는 메모장'임. messages가 아직 없을 때만 빈 목록으로 만들어 기존 대화가 보존됨." },
        { at: 'if "client" not in st.session_state:', text: "Claude API 클라이언트를 한 번만 만들어 재사용하기 위한 저장소임. 처음엔 None으로 시작함." },
        { at: 'if "last_tool_trace" not in st.session_state:', text: "직전 응답에서 어떤 함수가 호출됐는지 학습자가 사이드바에서 확인할 수 있도록 기록을 담을 빈 목록임." },
        { at: 'if "turn_count" not in st.session_state:', text: "대화를 몇 번 주고받았는지 세는 숫자임. 0부터 시작함." },
      ],
      code:
`def initialize_session_state() -> None:
    """Streamlit rerun 사이에 유지할 상태를 초기화함."""
    if "messages" not in st.session_state:  # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
        # 화면에 표시할 사용자/assistant 텍스트 메시지만 저장함.
        # tool_use 블록과 tool_result 메시지는 API 호출 루프 내부에서만 사용하고
        # session_state에는 저장하지 않아 턴 간 tool_use_id 불일치를 방지함.
        # Claude Messages API는 첫 메시지가 반드시 role="user"여야 하므로
        # welcome 메시지를 session_state에 저장하지 않고 화면에만 렌더링함.
        st.session_state.messages = []
    if "client" not in st.session_state:
        st.session_state.client = None
    if "last_tool_trace" not in st.session_state:
        # 직전 응답에서 어떤 함수가 호출됐는지 학습자가 확인할 수 있도록 저장함.
        st.session_state.last_tool_trace = []
    if "turn_count" not in st.session_state:
        st.session_state.turn_count = 0`,
    },
    {
      id: "get_client",
      name: "get_client()",
      fileId: "main",
      summary: "Claude API와 통신할 클라이언트를 처음 한 번만 만들어 두고, 이후엔 저장된 것을 재사용함.",
      how: "클라이언트를 만드는 일은 매번 반복할 필요가 없음. client가 None일 때만 load_hands_on_env()·create_claude_client()를 호출하고, 만든 객체를 st.session_state.client에 보관함(지연 생성 + 캐싱). 이후에는 저장된 것을 그대로 반환함.",
      terms: ["지연 생성(lazy)", "캐싱(cache)", "st.session_state", "Anthropic 클라이언트", "load_hands_on_env"],
      lines: [
        { at: 'if st.session_state.client is None:', text: "client가 아직 없을(None) 때만 새로 만듦. 이미 있으면 이 블록을 건너뛰고 저장된 것을 그대로 씀(캐싱)." },
        { at: '# load_hands_on_env()는 hands-on/.env를 로드함.', text: "hands-on/.env를 읽어 CLAUDE_API_KEY 등 환경변수를 준비함. 주석이 이 호출의 목적을 설명하고 있음." },
        { at: 'st.session_state.client = create_claude_client()', text: "CLAUDE_API_KEY로 Anthropic 클라이언트를 만들어 저장(캐싱)함." },
        { at: 'return st.session_state.client', text: "준비된(또는 새로 만든) 클라이언트를 돌려줌." },
      ],
      code:
`def get_client() -> Any:
    """hands-on/.env 기반 Claude 클라이언트를 생성하고 재사용함."""
    if st.session_state.client is None:
        # load_hands_on_env()는 hands-on/.env를 로드함. CLAUDE_API_KEY가 없으면
        # create_claude_client() 내부에서 명확한 RuntimeError가 발생하여
        # Streamlit 화면에 사용자 친화적으로 안내할 수 있음.
        load_hands_on_env()
        st.session_state.client = create_claude_client()
    return st.session_state.client`,
    },
    {
      id: "build_chat_messages",
      name: "build_chat_messages(user_input)",
      fileId: "main",
      summary: "화면에 쌓인 대화를 Claude Messages API가 받는 메시지 배열 형식으로 변환함.",
      how: "Claude API는 messages 배열과 system 파라미터를 별도로 받음. 이 함수는 messages 부분만 만들고 system 지침은 포함하지 않음. 비용 절감을 위해 최근 10개만 포함하며, 사용자의 새 입력은 호출 전에 이미 session_state.messages에 추가돼 있으므로 여기서 다시 넣지 않음.",
      terms: ["딕셔너리(dict)", "리스트(list)", "타입 힌트"],
      lines: [
        { at: 'messages: list[dict[str, Any]] = []', text: "빈 메시지 배열을 만듦. 타입 힌트가 'dict 원소를 담는 리스트'라고 명시해 코드 읽기를 쉽게 함." },
        { at: 'for message in st.session_state.messages[-10:]:', text: "[-10:]은 '뒤에서 10개만' 잘라오는 파이썬 문법임. 대화가 길어질수록 비용이 늘기 때문에 최근 것만 보냄." },
        { at: 'if message["role"] in {"user", "assistant"}:', text: "'user' 또는 'assistant' 역할의 메시지만 포함함. 집합(set) in 검사로 두 값을 한 번에 확인함." },
        { at: 'messages.append({"role": message["role"], "content": message["content"]})', text: "role과 content만 딕셔너리로 뽑아 배열에 추가함. Claude API가 요구하는 최소 형식임." },
      ],
      code:
`def build_chat_messages(user_input: str) -> list[dict[str, Any]]:
    """Claude Messages API에 전달할 메시지 배열을 구성함.

    system은 별도 파라미터로 전달하므로 messages에는 user/assistant만 포함함.
    비용과 토큰 사용량을 줄이기 위해 최근 10개 UI 메시지만 포함함.
    main()에서 user_input을 session_state.messages에 먼저 추가한 뒤 이 함수를 호출하므로
    user_input을 별도로 append하지 않아도 됨. 중복 추가 시 동일 user 메시지가 연속되어
    Messages API가 role 교차 규칙 위반 오류를 반환함.
    """
    messages: list[dict[str, Any]] = []
    for message in st.session_state.messages[-10:]:
        if message["role"] in {"user", "assistant"}:
            messages.append({"role": message["role"], "content": message["content"]})
    return messages`,
    },
    {
      id: "extract_text",
      name: "extract_text(response)",
      fileId: "main",
      summary: "Claude 응답의 content 블록 목록에서 텍스트 부분만 골라 이어 붙여 돌려줌.",
      how: "Claude는 응답 content를 '블록 목록'으로 줌. 도구를 호출하는 턴에는 tool_use 블록이 섞여 있어 텍스트만 선별해야 함. hasattr로 type 속성이 있는지 먼저 확인하고, type이 'text'인 블록의 .text 값만 모아 이어 붙임.",
      terms: ["리스트 컴프리헨션", "hasattr()", "content 블록", "tool_use 블록"],
      lines: [
        { at: 'text_parts = [', text: "리스트 컴프리헨션으로 조건을 만족하는 블록의 텍스트만 한 번에 모음." },
        { at: 'for block in (response.content or [])', text: "(response.content or [])는 content가 None일 때를 대비한 안전장치임. content 안의 블록을 하나씩 훑음." },
        { at: 'if hasattr(block, "type") and block.type == "text"', text: "hasattr(block, 'type')는 'block에 type 속성이 있는가?'를 확인함. 있고 값이 'text'인 블록만 포함함." },
        { at: 'return "".join(text_parts) or "응답을 생성할 수 없습니다."', text: "텍스트 조각들을 이어 붙임. 결과가 빈 문자열이면 안내 메시지로 대체함." },
      ],
      code:
`def extract_text(response: Any) -> str:
    """Claude 응답의 content 블록 목록에서 텍스트를 추출함.

    tool_use 블록이 있는 턴에는 text 블록이 없을 수 있으므로
    type == "text"인 블록만 선택하여 이어 붙임.
    """
    text_parts = [
        block.text
        for block in (response.content or [])
        if hasattr(block, "type") and block.type == "text"
    ]
    return "".join(text_parts) or "응답을 생성할 수 없습니다."`,
    },
    {
      id: "run_tool_calls",
      name: "run_tool_calls(response)",
      fileId: "main",
      summary: "assistant 턴에 있는 모든 tool_use 블록을 실행하고, 결과를 담은 role='user' 메시지를 반환함.",
      how: "Claude Tool Use의 핵심 규칙: 한 턴의 모든 도구 결과를 각각 별도 메시지로 보내면 오류가 남. 반드시 하나의 role='user' 메시지 안에 tool_result 블록 목록으로 묶어야 함. 각 결과는 tool_use_id로 어떤 호출의 결과인지 짝지음. execute_function()은 화이트리스트를 통해서만 실행해 보안을 지킴.",
      terms: ["tool_use 블록", "tool_result", "tool_use_id", "화이트리스트", "JSON", "타입 힌트", "딕셔너리(dict)", "hasattr()"],
      lines: [
        { at: 'tool_result_blocks: list[dict[str, Any]] = []', text: "도구 결과 블록들을 모을 빈 목록임. 나중에 단일 메시지로 묶음." },
        { at: 'if not (hasattr(block, "type") and block.type == "tool_use"):', text: "tool_use 타입 블록이 아니면 건너뜀. hasattr로 type 속성 유무부터 확인함." },
        { at: 'result = execute_function(function_name, function_args)', text: "execute_function()이 화이트리스트를 통해 허용된 함수만 실행함. 모델이 이상한 함수명을 줘도 안전함." },
        { at: '"type": "tool_result",', text: "★핵심★ type='tool_result'로 도구 결과 블록을 만듦. tool_use_id로 어떤 호출의 결과인지 Claude가 매칭함." },
        { at: 'tool_result_message = {"role": "user", "content": tool_result_blocks}', text: "★핵심★ 모든 tool_result 블록을 하나의 role='user' 메시지에 묶어 반환함. 각각 별도 메시지로 보내면 API 오류가 남." },
      ],
      code:
`def run_tool_calls(response: Any) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """assistant 턴의 모든 tool_use 블록을 실행하고 tool_result user 메시지를 반환함.

    중요한 Claude Tool Use 흐름:
    1. assistant 응답의 content 블록에서 type == "tool_use" 블록을 찾음.
    2. 각 tool_use 블록을 execute_function()으로 실행함.
    3. 모든 결과를 하나의 role="user" 메시지 안에 type="tool_result" 블록 목록으로 묶음.
       tool_use 블록마다 별도 메시지를 보내면 Messages API가 구조 오류를 반환함.
    4. tool_use_id로 assistant tool_use 블록과 결과를 1:1 매칭함.
    """
    tool_result_blocks: list[dict[str, Any]] = []
    traces: list[dict[str, Any]] = []

    for block in (response.content or []):
        if not (hasattr(block, "type") and block.type == "tool_use"):
            continue

        function_name = block.name
        function_args = dict(block.input) if block.input else {}

        # execute_function()은 whitelist를 통해서만 실제 함수를 실행함.
        # 모델이 스키마 밖의 함수명을 생성해도 임의 코드가 실행되지 않도록 막는 안전 지점.
        result = execute_function(function_name, function_args)

        traces.append({
            "function": function_name,
            "arguments": function_args,
            "has_error": isinstance(result, dict) and bool(result.get("error")),
        })

        # Claude Tool Result: type="tool_result", tool_use_id로 매칭, content는 JSON 문자열.
        tool_result_blocks.append({
            "type": "tool_result",
            "tool_use_id": block.id,
            "content": json.dumps(result, ensure_ascii=False),
        })

    # 모든 tool_result 블록을 하나의 role="user" 메시지에 담아 반환함.
    tool_result_message = {"role": "user", "content": tool_result_blocks}
    return tool_result_message, traces`,
    },
    {
      id: "generate_response",
      name: "generate_response(user_input)",
      fileId: "main",
      summary: "사용자 입력을 받아 Claude를 반복 호출하면서 도구를 실행하고, 최종 텍스트 답변을 반환하는 '중심 함수'임.",
      how: "이 함수가 Tool Use 루프 전체를 담당함. for 반복문이 최대 MAX_TOOL_ROUNDS(5)번 돌면서: ①Claude 호출 → ②stop_reason 확인 → ③end_turn이면 텍스트 반환 → ④tool_use면 도구 실행 후 결과를 messages에 추가하고 다시 Claude 호출. 09.langchain 예제에서는 이 반복문 전체가 agent.invoke() 한 줄로 대체됨.",
      terms: ["stop_reason", "MAX_TOOL_ROUNDS", "Messages API", "content 블록", "리스트(list)", "예외 처리(try/except)"],
      lines: [
        { at: 'tools = get_claude_tools()', text: "Claude API 형식의 도구 스키마 목록을 가져옴(name·description·input_schema)." },
        { at: 'for _ in range(MAX_TOOL_ROUNDS):', text: "최대 5번까지 반복함. _ 는 '반복 횟수 변수가 필요 없다'는 파이썬 관용 표현임." },
        { at: 'if response.stop_reason != "tool_use":', text: "stop_reason이 'end_turn'이면 도구 호출 없이 바로 텍스트 답변을 반환함." },
        { at: 'messages.append({"role": "assistant", "content": response.content})', text: "tool_use 턴의 assistant 응답 content 블록 리스트를 그대로 이력에 추가함. JSON으로 변환하면 tool_use_id 매칭이 깨짐." },
        { at: 'tool_result_message, traces = run_tool_calls(response)', text: "모든 tool_use 블록을 실행하고 결과(단일 role='user' 메시지)와 호출 기록을 받음." },
      ],
      code:
`def generate_response(user_input: str) -> str:
    """사용자 입력을 처리하고 최종 assistant 응답을 반환함.

    단일 함수 호출 예:
    - "서울 날씨" → get_weather 1개 호출
    - "파리 관광지" → get_tourist_attractions 1개 호출
    - "부산 맛집" → get_restaurants 1개 호출

    다중 함수 호출 예:
    - "서울" 또는 "서울 여행 루트" → 날씨, 관광지, 맛집 함수를 함께 호출
    """
    client = get_client()
    tools = get_claude_tools()
    # 이 함수 내부에서만 사용하는 작업용 메시지 배열임.
    # session_state.messages에는 tool_use / tool_result 블록을 저장하지 않음.
    messages = build_chat_messages(user_input)
    tool_trace: list[dict[str, Any]] = []

    for _ in range(MAX_TOOL_ROUNDS):
        response = call_claude_messages(
            client,
            model=MODEL_NAME,
            system=SYSTEM_PROMPT,
            messages=messages,
            tools=tools,
        )

        # stop_reason이 "end_turn"이면 함수 호출 없이 텍스트 답변을 반환함.
        if response.stop_reason != "tool_use":
            st.session_state.last_tool_trace = tool_trace
            return extract_text(response)

        # tool_use 턴의 assistant 응답 content 블록 리스트를 그대로 메시지 이력에 추가함.
        # content 필드에 블록 리스트를 전달해야 Messages API가 다음 턴에서 연속성을 유지함.
        # JSON 문자열로 변환하거나 text만 추출하면 tool_use_id 매칭이 깨짐.
        messages.append({"role": "assistant", "content": response.content})

        # 모든 tool_use 블록을 실행하고 결과를 단일 role="user" 메시지로 추가함.
        tool_result_message, traces = run_tool_calls(response)
        tool_trace.extend(traces)
        messages.append(tool_result_message)

    st.session_state.last_tool_trace = tool_trace
    return "함수 호출이 반복되어 처리를 중단함. 요청을 더 구체적으로 입력해 주세요."`,
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
        { at: 'with st.chat_message(message["role"]):', text: "st.chat_message(역할)은 사람/AI 말풍선 모양을 만들어 줌. with 블록 안의 내용이 그 말풍선 안에 표시됨." },
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
      how: "화면 왼쪽의 보조 패널을 구성함. with st.sidebar 블록 안의 내용은 모두 왼쪽에 표시됨. '대화 초기화' 버튼을 누르면 저장된 대화를 비우고 st.rerun()으로 화면을 새로 그림. 직전에 호출된 함수가 있으면 성공/오류와 함께 보여줌.",
      terms: ["st.sidebar", "st.rerun", "JSON", "Streamlit"],
      lines: [
        { at: 'with st.sidebar:', text: "with st.sidebar: 이 블록 안에서 출력하는 모든 것이 왼쪽 사이드바에 표시됨." },
        { at: 'st.metric("대화 턴", st.session_state.turn_count)', text: "대화 턴(주고받은 횟수)을 숫자 지표로 보여줌." },
        { at: 'if st.button("대화 초기화", use_container_width=True):', text: "'대화 초기화' 버튼. 누르면 아래 줄들이 실행되어 기록을 모두 비움." },
        { at: 'st.rerun()', text: "st.rerun()은 화면을 처음부터 다시 그리게 함(초기화 결과를 즉시 반영)." },
        { at: 'st.header("직전 함수 호출")', text: "직전에 호출된 함수 기록이 있으면, 함수명·인자·성공여부를 코드 블록으로 표시함." },
      ],
      code:
`def display_sidebar() -> None:
    """예제 사용법과 직전 Tool Use trace를 표시함."""
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
      summary: "앱의 시작점. 화면을 세팅하고, 입력을 받고, 답변을 생성·표시하는 전체 흐름을 지휘함.",
      how: "프로그램의 '시작 버튼'에 해당함. 페이지 설정 → 상태 초기화 → 사이드바·환영문·이전 대화 표시 → 채팅창 입력 처리 순으로 진행함. 사용자가 입력하면(:= 로 받음) 답변을 만들어 말풍선으로 보여주고, 오류가 나도 멈추지 않게 try/except로 감쌈.",
      terms: ["st.chat_input", "st.chat_message", "st.empty", ":= (바다코끼리)", "예외 처리(try/except)", "Streamlit", "if __name__"],
      lines: [
        { at: 'st.set_page_config(', text: "st.set_page_config는 브라우저 탭 제목·아이콘·레이아웃을 정함. 코드 맨 처음에 한 번 호출해야 함." },
        { at: 'st.caption("Claude Messages API Tool Use + Streamlit")', text: "제목 아래 작은 글씨로 이 앱의 기술 스택을 표시함." },
        { at: 'if user_input := st.chat_input("예: 서울, 도쿄 날씨, 파리 관광지, 부산 맛집"):', text: "★중요 문법★ := (바다코끼리 연산자)는 '입력값을 user_input에 담으면서 동시에 비었는지 검사'함. 입력이 있을 때만 if 블록 실행." },
        { at: 'placeholder = st.empty()', text: "st.empty()는 '나중에 내용을 채울 빈 자리'를 만듦. 먼저 '판단하는 중...'을 보여주고 답이 오면 그 자리를 답변으로 바꿈." },
        { at: 'assistant_response = generate_response(user_input)', text: "generate_response 실행 중 오류가 나도 앱이 죽지 않도록 try/except로 감싸 오류 메시지로 대체함." },
      ],
      code:
`def main() -> None:
    """Streamlit 앱 진입점."""
    st.set_page_config(
        page_title=f"{APP_TITLE} - Claude",
        page_icon=APP_ICON,
        layout="centered",
    )
    st.title(APP_TITLE)
    st.caption("Claude Messages API Tool Use + Streamlit")

    initialize_session_state()
    display_sidebar()

    # 대화 이력이 없을 때만 welcome 메시지를 화면에 렌더링함.
    # session_state.messages에는 저장하지 않아 첫 user 턴에서 role 교차 규칙을 지킴.
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
            placeholder.markdown("함수 호출 여부를 판단하는 중...")
            try:
                assistant_response = generate_response(user_input)
            except Exception as exc:
                assistant_response = f"오류가 발생함: {exc}"

            placeholder.markdown(assistant_response)

        st.session_state.messages.append({"role": "assistant", "content": assistant_response})
        st.session_state.turn_count += 1


if __name__ == "__main__":  # 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
    main()`,
    },

    // ===== common/tools.py (도구) =====
    {
      id: "normalize_city_name",
      name: "normalize_city_name(city)",
      fileId: "tools",
      summary: "'서울', '도쿄' 같은 한글 도시명을 외부 API가 알아듣는 영문('Seoul', 'Tokyo')으로 바꿈.",
      how: "날씨·지도 API는 영문 도시명을 받음. 미리 만들어 둔 표(CITY_NAME_MAP)에서 한글을 찾아 영문으로 바꿔줌. 표에 없으면 입력을 그대로 돌려줌.",
      terms: ["딕셔너리(dict)", ".get()", "타입 힌트"],
      lines: [
        { at: 'cleaned = (city or "").strip()', text: "(city or \"\")는 'city가 None이면 빈 문자열을 쓰라'는 안전장치임. .strip()은 앞뒤 공백을 제거함." },
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
      how: "AI가 한글로 엉뚱한 링크를 만들지 않도록, 코드가 직접 정확한 구글 지도 URL을 만들어 결과에 넣어줌. quote_plus는 공백·특수문자를 URL에 넣어도 안전한 형태로 바꿔줌.",
      terms: ["quote_plus", "f-string"],
      lines: [
        { at: 'city_en = normalize_city_name(city)', text: "도시명을 먼저 영문으로 변환함." },
        { at: 'query = quote_plus(', text: "quote_plus는 공백을 +로 바꾸는 등, 글자를 URL에 안전하게 넣을 수 있게 인코딩함." },
        { at: 'return f"https://www.google.com/maps/search/', text: "f\"...\"(f-string)는 문자열 안에 {변수} 값을 끼워 넣는 파이썬 문법임." },
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
      how: "여러 도구가 공통으로 쓰는 'HTTP 요청 + 결과 받기' 함수임. timeout=12는 '12초 안에 응답이 없으면 포기'라는 뜻으로 무한 대기를 방지함. raise_for_status()는 응답이 실패(404 등)면 오류를 내게 함.",
      terms: ["requests", "raise_for_status()", "JSON", "타입 힌트"],
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
      summary: "구글 지도 API가 준 복잡한 장소 정보를, AI가 쓰기 좋은 간단한 형태로 정리함.",
      how: "API 응답은 항목이 많고 깊게 중첩돼 있음. 필요한 값만 .get()으로 안전하게 꺼내고, 없을 때 쓸 기본값을 정해둠. 구글 지도 링크도 여기서 미리 만들어 넣어줌.",
      terms: ["딕셔너리(dict)", ".get()", "리스트 컴프리헨션", "f-string"],
      lines: [
        { at: 'display_name = place.get("displayName", {}).get("text", "Unknown place")', text: ".get('displayName', {})는 'displayName이 없으면 빈 딕셔너리를 쓰라'는 안전한 꺼내기임. 연달아 .get으로 더 깊은 값을 꺼냄." },
        { at: 'type_hint = ", ".join(PLACE_TYPE_LABELS.get(item, item.replace("_", " ")) for item in types[:2])', text: "types[:2]는 앞 2개만 잘라옴. PLACE_TYPE_LABELS 표로 영문 분류를 한글 라벨로 바꿈." },
        { at: 'maps_url = build_google_maps_search_url(display_name, city)', text: "장소별 구글 지도 링크를 미리 만들어 둠." },
        { at: '"name": display_name,', text: "정리된 깔끔한 딕셔너리를 구성함(이름·평점·주소·설명·링크 등)." },
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
      how: "관광지·맛집 도구가 공통으로 쓰는 검색 엔진임. API 키가 없으면 즉시 명확한 오류를 냄. 요청 헤더에 키와 FieldMask(어떤 항목을 받을지 지정)를 넣고, _request_json으로 호출한 뒤 각 결과를 _compact_place로 정리함.",
      terms: ["RuntimeError", "FieldMask", "JSON", "리스트 컴프리헨션", "타입 힌트"],
      lines: [
        { at: 'if not GOOGLE_PLACES_API_KEY:', text: "API 키가 없으면 RuntimeError로 즉시 멈춰, 원인을 분명히 알려줌." },
        { at: '"X-Goog-FieldMask":', text: "X-Goog-FieldMask는 '응답에서 이 항목들만 보내달라'고 구글에 지정하는 것임(불필요한 데이터·비용 절감)." },
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
      id: "get_weather_tool",
      name: "get_weather(city)",
      fileId: "tools",
      summary: "도시의 현재 날씨를 조회하여 딕셔너리로 돌려주는 도구 함수.",
      how: "OpenWeatherMap API를 호출해 기온·체감·습도·바람 등을 정리해 돌려줌. 오류가 나도 멈추지 않고 error 항목을 담아 반환함. @tool 데코레이터 없이 일반 함수로 정의되고, execute_function()의 화이트리스트에 등록되어 Claude가 호출을 요청하면 실행됨.",
      terms: ["API 키", "예외 처리(try/except)", "딕셔너리(dict)", ".get()", "화이트리스트", "requests"],
      lines: [
        { at: 'def get_weather(city: str) -> dict[str, Any]:', text: "일반 파이썬 함수임. @tool 데코레이터 없이 정의하고, execute_function()이 화이트리스트로 관리함." },
        { at: 'if not OPENWEATHER_API_KEY:', text: "날씨 API 키가 없으면, 멈추지 않고 error 메시지를 담은 결과를 돌려줌." },
        { at: 'weather = data.get("weather", [{}])[0]', text: "응답에서 날씨 목록의 첫 번째 항목을 꺼냄. [{}]는 목록이 비어 있을 때 빈 딕셔너리를 대비한 기본값임." },
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
      id: "get_tourist_attractions_tool",
      name: "get_tourist_attractions(city, max_results)",
      fileId: "tools",
      summary: "도시의 대표 관광지를 평점·주소·설명·지도 링크와 함께 검색하는 도구 함수.",
      how: "max_results=DEFAULT_MAX_RESULTS처럼 '기본값이 있는 인자'를 써서, Claude가 개수를 안 정해도 기본값(8개)으로 동작함. 내부적으로 _search_places를 호출함.",
      terms: ["예외 처리(try/except)", "딕셔너리(dict)", "화이트리스트"],
      lines: [
        { at: 'def get_tourist_attractions(city: str, max_results: int = DEFAULT_MAX_RESULTS) -> dict[str, Any]:', text: "max_results: int = DEFAULT_MAX_RESULTS는 '값을 안 주면 기본 8개'라는 기본값 인자임." },
        { at: 'places = _search_places(f"top tourist attractions in {city_en}", city_en, max_results)', text: "공용 검색 함수 _search_places로 'top tourist attractions in 도시' 질의를 보냄." },
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
      id: "get_restaurants_tool",
      name: "get_restaurants(city, meal_type, keyword, max_results)",
      fileId: "tools",
      summary: "도시의 맛집을 검색하는 도구 함수. 아침/점심/저녁(meal_type)이나 키워드로 좁혀 찾을 수 있음.",
      how: "meal_type·keyword는 None이 기본값인 선택 인자라, Claude가 상황에 따라 일부만 채워 호출할 수 있음. 채워진 값들만 모아 검색어를 조립한 뒤 _search_places로 검색함.",
      terms: ["리스트 컴프리헨션", "예외 처리(try/except)", "딕셔너리(dict)"],
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
      summary: "Claude가 요청한 함수 이름과 인자를 받아, 허용된 함수(화이트리스트)만 실행하는 보안 관문.",
      how: "Claude가 'get_weather를 city=Seoul로 호출해줘'라고 요청하면 이 함수가 실행됨. available_functions 딕셔너리가 화이트리스트 역할을 함. 목록에 없는 함수명이 오면 오류를 반환하고, 있으면 **kwargs 형태로 인자를 풀어 실제 함수를 호출함. 이 구조가 09.langchain에서 @tool 데코레이터 + LangGraph로 대체되는 부분임.",
      terms: ["화이트리스트", "딕셔너리(dict)", "예외 처리(try/except)", "타입 힌트"],
      lines: [
        { at: 'available_functions = {', text: "화이트리스트: 실행 가능한 함수들을 '이름→함수객체' 딕셔너리로 등록함. 이 목록 밖의 함수는 절대 실행되지 않음." },
        { at: 'if function_name not in available_functions:', text: "Claude가 이상한 함수명을 주면 바로 오류를 반환함. 임의 코드가 실행되지 않는 핵심 안전장치임." },
        { at: 'safe_arguments["city"] = normalize_city_name(str(safe_arguments["city"]))', text: "city 인자를 영문으로 한 번 더 변환해 안전하게 함(Claude가 한글로 줄 수도 있음)." },
        { at: 'return available_functions[function_name](**safe_arguments)', text: "화이트리스트에서 찾은 함수를 **kwargs 형태로 실제 호출하고 결과를 반환함." },
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

    // ===== common/prompts.py (스키마) =====
    {
      id: "TOOL_DEFINITIONS",
      name: "TOOL_DEFINITIONS (상수) + get_claude_tools()",
      fileId: "prompts",
      summary: "Claude API에 등록할 도구(함수) 목록을 JSON 스키마 형식으로 정의하고, Claude 형식으로 변환해 돌려주는 파일.",
      how: "Claude는 도구를 쓰려면 '함수 이름·설명·파라미터 타입'을 JSON 형식으로 미리 받아야 함. TOOL_DEFINITIONS가 OpenAI·Claude·Gemini 공통 형식으로 정의하고, get_claude_tools()가 Claude용으로 변환함. Claude 형식은 input_schema라는 이름을 씀(OpenAI는 parameters). 이 스키마 정보를 보고 Claude가 어떤 함수를 언제 호출할지 판단함.",
      terms: ["JSON 스키마", "input_schema", "SystemMessage", "SYSTEM_PROMPT"],
      lines: [
        { at: 'DEFAULT_MAX_RESULTS = 8', text: "DEFAULT_MAX_RESULTS = 8: 검색 결과 기본 개수. 도구들이 이 값을 기본값으로 사용함." },
        { at: 'TOOL_DEFINITIONS = [', text: "OpenAI·Claude·Gemini 세 모델이 공유하는 도구 스키마 목록. 함수 이름·설명·파라미터를 JSON Schema 형식으로 기술함." },
        { at: '"name": "get_weather",', text: "도구 이름. Claude가 이 이름으로 'get_weather를 호출해줘'라고 요청함." },
        { at: '"input_schema": tool["parameters"],', text: "★핵심★ Claude API는 파라미터 키 이름이 'input_schema'임(OpenAI의 'parameters'와 다름). get_claude_tools()가 이 변환을 처리함." },
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
]


def get_claude_tools() -> list[dict]:
    """공통 도구 정의를 Claude Messages API tool 형식으로 변환하여 반환."""
    return [
        {
            "name": tool["name"],
            "description": tool["description"],
            "input_schema": tool["parameters"],
        }
        for tool in TOOL_DEFINITIONS
    ]`,
    },

    // ===== common/llm.py (헬퍼) =====
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
      id: "create_claude_client",
      name: "create_claude_client()",
      fileId: "llm",
      summary: "CLAUDE_API_KEY 환경변수로 Anthropic 클라이언트를 만들어 돌려줌.",
      how: "anthropic.Anthropic(api_key=...)가 Claude API와 통신할 클라이언트 객체를 만듦. require_api_key()로 키를 읽는데, 키가 없으면 즉시 RuntimeError를 냄. 지연 import(함수 안에서 import)를 써서 불필요한 패키지 로딩을 막음.",
      terms: ["Anthropic 클라이언트", "RuntimeError", "API 키", "환경변수(.env)"],
      lines: [
        { at: 'import anthropic', text: "함수 안에서 import해서 다른 예제(OpenAI·Gemini)가 이 파일을 쓸 때 anthropic 패키지를 불필요하게 불러오지 않게 함(지연 import)." },
        { at: 'return anthropic.Anthropic(api_key=require_api_key("CLAUDE_API_KEY"))', text: "CLAUDE_API_KEY를 읽어 Anthropic 클라이언트를 만들어 반환함. 키가 없으면 require_api_key()가 RuntimeError를 냄." },
      ],
      code:
`def create_claude_client():
    """Anthropic 클라이언트를 지연 생성하여 반환. 다른 예제에서 불필요한 import 방지."""
    import anthropic

    return anthropic.Anthropic(api_key=require_api_key("CLAUDE_API_KEY"))`,
    },
    {
      id: "call_claude_messages",
      name: "call_claude_messages(client, model, system, messages, tools, max_tokens)",
      fileId: "llm",
      summary: "Claude Messages API를 실제로 호출하는 헬퍼 함수. 도구 목록과 시스템 프롬프트를 함께 보냄.",
      how: "client.messages.create()가 실제 HTTP 요청을 보냄. system은 메시지 배열 밖 별도 파라미터로 전달하는 게 Claude API의 규칙임. tools 파라미터에 스키마를 넣으면 Claude가 어떤 함수를 쓸 수 있는지 알게 됨. 결과로 stop_reason·content 블록을 담은 응답 객체를 돌려줌.",
      terms: ["Messages API", "stop_reason", "content 블록", "Anthropic 클라이언트"],
      lines: [
        { at: 'return client.messages.create(', text: "client.messages.create()가 Claude Messages API를 실제 호출함. 응답으로 stop_reason과 content 블록 목록을 받음." },
        { at: 'max_tokens=max_tokens,', text: "max_tokens는 응답 최대 길이임. 기본값 4096 토큰(약 3,000자 정도)으로 설정돼 있음." },
      ],
      code:
`def call_claude_messages(
    client: Any,
    *,
    model: str,
    system: str,
    messages: list[dict],
    tools: list[dict],
    max_tokens: int = 4096,
):
    """Claude Messages API를 클라이언트 사이드 도구 사용 설정으로 호출하여 응답 반환."""
    return client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        tools=tools,
        messages=messages,
    )`,
    },

    // ===== common/ui_text.py (화면 문구) =====
    {
      id: "ui_text_constants",
      name: "UI 텍스트 상수 (APP_TITLE 등)",
      fileId: "uitext",
      summary: "화면에 표시할 제목·아이콘·환영 인사·사용 안내 같은 문구들을 한곳에 모아 둔 파일.",
      how: "코드 곳곳에 문구를 흩어 두면 수정이 번거로움. 자주 바뀌는 안내 문구를 상수(대문자 이름)로 모아두면 한 곳만 고쳐도 전체에 반영됨. 함수는 없고 문자열 상수들만 있는 파일임.",
      terms: [],
      lines: [
        { at: 'APP_TITLE = "여행 플래너"', text: "APP_TITLE·APP_ICON: 화면 상단 제목과 아이콘(이모지)." },
        { at: 'WELCOME_MESSAGE = """', text: "WELCOME_MESSAGE: 처음 화면에 보여줄 환영 인사 글(삼중 따옴표로 여러 줄 작성)." },
        { at: 'USAGE_GUIDE = """', text: "USAGE_GUIDE: 왼쪽 사이드바에 보여줄 사용 예시 안내." },
        { at: 'TECH_GUIDE = """', text: "TECH_GUIDE: Tool Use 핵심 흐름을 간단히 정리한 기술 안내." },
      ],
      code:
`"""여행 플래너 예제의 모델별 Streamlit 앱에서 공통으로 사용하는 UI 텍스트 상수 모음."""

APP_TITLE = "여행 플래너"
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
    "st.empty": "'나중에 채울 빈 자리'를 만들어 두는 기능. 먼저 '판단하는 중...'을 보여주고, 답이 오면 같은 자리를 답변으로 바꿀 수 있음.",
    "st.sidebar": "화면 왼쪽의 보조 패널. with st.sidebar 블록 안에서 출력한 것은 모두 왼쪽에 표시됨.",
    "Messages API": "Anthropic(Claude)이 제공하는 대화 API. messages 배열과 system 파라미터를 받아 assistant 응답을 돌려줌. stop_reason으로 '도구 호출 필요' 여부를 알려줌.",
    "stop_reason": "Claude 응답에서 '왜 생성이 멈췄는지'를 알려주는 값. 'end_turn'은 텍스트 답변 완료, 'tool_use'는 도구를 호출해야 함을 뜻함.",
    "tool_use 블록": "Claude가 응답 content 안에 넣는 '도구 호출 요청' 블록. type='tool_use', name(함수명), input(인자), id(고유번호)를 담고 있음.",
    "tool_result": "도구를 실행한 결과를 담아 Claude에게 돌려주는 블록. type='tool_result', tool_use_id(어떤 호출의 결과인지), content(JSON 결과)를 담음.",
    "tool_use_id": "도구 호출 하나하나에 붙는 고유 번호(영수증 번호). tool_use 블록의 id와 tool_result의 tool_use_id가 같아야 Claude가 어떤 호출의 결과인지 매칭할 수 있음.",
    "content 블록": "Claude 응답의 content 필드는 블록 목록임. 텍스트 답변이면 type='text' 블록, 도구 호출 요청이면 type='tool_use' 블록이 들어 있음.",
    "MAX_TOOL_ROUNDS": "도구 호출 루프의 최대 반복 횟수(기본 5). 무한 루프를 방지하기 위한 안전장치임.",
    "화이트리스트": "'허용 목록'을 뜻하는 보안 개념. execute_function()이 available_functions 딕셔너리에 등록된 함수만 실행하도록 제한해, Claude가 임의 코드를 실행하지 못하게 막음.",
    "Anthropic 클라이언트": "anthropic.Anthropic(api_key=...)로 만드는 객체. client.messages.create(...)처럼 이 객체를 통해 Claude API를 호출함.",
    "load_hands_on_env": "hands-on/.env 파일을 읽어 API 키 등 환경변수를 프로그램에 등록하는 함수. 모든 예제가 공통 .env를 공유하도록 경로를 고정함.",
    "지연 생성(lazy)": "필요해질 때까지 만들지 않고 미뤘다가, 처음 쓸 때 한 번만 만드는 방식. 불필요한 작업과 비용을 줄임.",
    "캐싱(cache)": "한 번 만든 결과를 저장해 두고, 다음에 또 필요하면 다시 만들지 않고 저장본을 재사용하는 것.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(날씨·지도·Claude 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "RuntimeError": "'실행 중 문제가 생겼다'고 알리는 오류의 한 종류. 여기서는 API 키가 없을 때 일부러 발생시켜 원인을 알려줌.",
    "requests": "파이썬에서 인터넷 주소로 요청을 보내고 응답을 받는 대표적인 라이브러리(HTTP 통신 도구).",
    "raise_for_status()": "인터넷 응답이 실패(예: 404 없음, 500 서버오류)면 오류를 발생시키는 점검 장치. 잘못된 응답을 그냥 쓰지 않게 함.",
    "JSON": "데이터를 주고받는 표준 글자 형식. {\"key\": \"value\"} 모양으로, 파이썬 딕셔너리와 거의 똑같이 생김.",
    "JSON 스키마": "함수의 '사용 설명서'를 JSON 형식으로 적은 것. 함수 이름·설명·파라미터 종류를 정해진 형식으로 기술하면 AI가 이를 읽고 언제 어떻게 호출할지 판단함.",
    "input_schema": "Claude Messages API에서 도구 파라미터를 기술하는 키 이름. OpenAI의 'parameters'와 같은 역할이지만 Claude는 'input_schema'로 부름.",
    "SYSTEM_PROMPT": "AI에게 '너는 여행 플래너야, 이렇게 행동해'라고 알려주는 지침서. Claude Messages API에서 system 파라미터로 별도 전달함.",
    "SystemMessage": "AI에게 역할과 규칙을 알려주는 '지침' 메시지. 대화 맨 앞에 넣음.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"도시\": \"서울\"}처럼 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    "리스트(list)": "여러 값을 순서대로 담는 목록. [\"a\", \"b\"]처럼 대괄호로 표현함.",
    "리스트 컴프리헨션": "[표현식 for 항목 in 목록 if 조건] 형태로, 반복문을 한 줄로 짧게 써서 새 목록을 만드는 파이썬 문법.",
    ".get()": "딕셔너리에서 값을 '안전하게' 꺼내는 방법. 열쇠가 없어도 오류를 내지 않고, 정해둔 기본값을 돌려줌.",
    "hasattr()": "어떤 객체에 특정 속성이 있는지 확인하는 함수. 예: hasattr(block, 'type')는 'block에 type 속성이 있는가?'를 True/False로 답함.",
    "isinstance()": "어떤 값이 특정 종류(타입)인지 확인하는 함수. 예: isinstance(x, dict)는 'x가 딕셔너리인가?'를 True/False로 답함.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "타입 힌트": "변수나 함수에 '이건 문자열(str)이야, 결과는 목록(list)이야'처럼 자료의 종류를 적어두는 표시. 실행에 꼭 필요하진 않지만, 코드를 읽고 점검하기 쉽게 함.",
    ":= (바다코끼리)": "값을 변수에 '담으면서 동시에' 그 값을 검사하는 연산자. 모양이 바다코끼리 눈·엄니를 닮아 붙은 별명. 예: if (x := 입력값): 은 입력을 x에 담고 비었는지 바로 확인함.",
    "quote_plus": "글자를 URL 주소에 안전하게 넣을 수 있는 형태로 바꿔주는 함수(공백을 +로 바꾸는 등).",
    "FieldMask": "API에 '응답에서 이 항목들만 보내줘'라고 지정하는 것. 불필요한 데이터 전송과 비용을 줄임.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
    "MAX_TOOL_ROUNDS": "도구 호출 루프의 최대 반복 횟수(기본 5). 무한 루프를 방지하기 위한 안전장치임.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
  },
};
