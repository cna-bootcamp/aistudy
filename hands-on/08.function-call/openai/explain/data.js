/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../08.function-call/openai/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "여행 플래너 (OpenAI Tool Calling) 예제 설명",
    entry: "travel_planner.py",
  },

  files: [
    { id: "main",    label: "travel_planner.py",   role: "메인 파일 · 화면과 함수 호출 흐름" },
    { id: "tools",   label: "common/tools.py",      role: "AI가 호출하는 실제 함수(날씨·관광지·맛집) + 화이트리스트 실행기" },
    { id: "prompts", label: "common/prompts.py",    role: "AI 지침서(시스템 프롬프트) + 도구 스키마 정의" },
    { id: "llm",     label: "common/llm.py",        role: "클라이언트 생성·API 호출 도우미" },
    { id: "uitext",  label: "common/ui_text.py",    role: "화면에 표시할 문구 모음" },
  ],

  flow: [
    { step: 1, title: "앱 시작",
      summary: "main()이 실행되어 화면 제목·아이콘을 정하고, 기억 공간(session_state)을 준비함",
      detail: "프로그램의 '시작 버튼'이 main() 함수임. 식당으로 비유하면 문을 열고 간판을 거는 단계임. initialize_session_state()가 대화 내용·클라이언트·도구 호출 기록·대화 횟수를 담을 빈 저장 공간을 만들어 둠." },
    { step: 2, title: "화면 구성",
      summary: "왼쪽 사이드바(사용법·도구 기록)와 이전 대화를 화면에 그림",
      detail: "손님이 앉기 전 메뉴판과 안내문을 세팅하는 단계임. display_sidebar()는 왼쪽 도움말과 사이드바를, display_chat_history()는 지금까지 오간 대화를 다시 그려줌." },
    { step: 3, title: "사용자 입력 대기",
      summary: "화면 맨 아래 채팅창(st.chat_input)에서 '서울', '도쿄 날씨' 같은 입력을 기다림",
      detail: "손님의 주문을 기다리는 단계임. 사용자가 도시명이나 질문을 입력하고 Enter를 누르면 다음 단계로 넘어감. 입력이 없으면 여기서 계속 대기함." },
    { step: 4, title: "입력 저장·표시",
      summary: "입력한 문장을 대화 기록에 추가하고, 사용자 말풍선으로 화면에 보여줌",
      detail: "주문서를 받아 적고 손님에게 '주문 확인됐습니다'라고 보여주는 단계임. 입력은 messages 목록에 저장되어 다음 대화에서도 맥락으로 활용됨." },
    { step: 5, title: "메시지 구성",
      summary: "build_chat_messages()가 '지침서 + 최근 대화 + 새 입력'을 OpenAI 형식 딕셔너리로 묶음",
      detail: "AI가 알아듣는 형식으로 주문서를 정리하는 단계임. 맨 앞에 시스템 지침(SYSTEM_PROMPT)을 넣고, 비용 절약을 위해 최근 10개 대화만 함께 담음. 모든 메시지는 {role, content} 딕셔너리 형태임." },
    { step: 6, title: "OpenAI API 첫 호출",
      summary: "call_openai_chat()이 tools 목록과 함께 OpenAI에 요청을 보내 모델 응답을 받음",
      detail: "주방장(AI)에게 '이 도구들을 써도 돼'라고 도구 목록(tools)을 건네며 주문서를 넘기는 단계임. 모델은 도구가 필요한지 판단하고, 필요하면 finish_reason='tool_calls'로 응답함." },
    { step: 7, title: "도구 호출 감지·실행",
      summary: "finish_reason이 'tool_calls'면 run_tool_call()이 실제 함수를 실행하고 결과를 messages에 추가함",
      detail: "모델이 '날씨 함수를 불러줘'라고 요청(tool_calls)하면, 코드가 그 함수를 실제로 실행해 날씨 정보를 받아오는 단계임. 09단계(LangChain)에서는 이 과정을 자동으로 처리하지만, 이 예제에서는 개발자가 직접 for 루프로 처리함. 보안을 위해 execute_function()의 화이트리스트를 통해서만 함수가 실행됨." },
    { step: 8, title: "OpenAI API 재호출",
      summary: "도구 결과를 messages에 담아 다시 OpenAI에 보내 최종 답변을 받음",
      detail: "재료(날씨·관광지·맛집)를 받은 주방장에게 '이 재료로 요리를 완성해줘'라고 다시 부탁하는 단계임. tool 결과 메시지가 추가된 messages를 다시 보내면, 모델이 정보를 종합해 최종 답변을 만듦. MAX_TOOL_ROUNDS(4) 안에 끝나지 않으면 안내 메시지를 반환함." },
    { step: 9, title: "결과 표시",
      summary: "최종 답변을 말풍선으로 보여주고, 어떤 함수를 호출했는지 사이드바에 기록함",
      detail: "완성된 요리를 손님에게 내는 단계임. 답변 말풍선과 함께, 방금 어떤 함수가 어떤 인자로 호출됐는지 왼쪽 사이드바에 보여줘 동작을 투명하게 확인할 수 있게 함. 대화 기록과 대화 턴 숫자도 갱신함." },
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
      summary: "화면을 새로 그릴 때마다 사라지지 않고 유지해야 할 데이터(대화·클라이언트 등)를 위한 빈 저장 공간을 만듦.",
      how: "Streamlit은 사용자가 무언가 누를 때마다 코드를 처음부터 다시 실행함. 그래서 일반 변수는 매번 초기화됨. st.session_state라는 특별한 저장소에 넣어두면 탭이 열려 있는 동안 값이 유지됨. 'if 키가 없으면 만든다' 패턴으로, 이미 있으면 덮어쓰지 않음.",
      terms: ["st.session_state", "Streamlit", "딕셔너리(dict)"],
      lines: [
        { at: 'if "messages" not in st.session_state:  # st.session_state:', text: "st.session_state는 '탭이 열려 있는 동안 유지되는 메모장'임. messages(대화 내용)라는 항목이 아직 없을 때만 만들어 기존 대화를 보존함." },
        { at: 'st.session_state.messages = [{"role": "assistant"', text: "시작할 때 AI 환영 인사(WELCOME_MESSAGE)가 담긴 메시지 하나를 미리 넣어 둠." },
        { at: 'if "client" not in st.session_state:', text: "client는 OpenAI 서버와 통신하는 객체. None으로 시작했다가 처음 쓸 때 만들어 재사용(캐싱)함." },
        { at: 'if "last_tool_trace" not in', text: "last_tool_trace는 '직전에 어떤 함수를 호출했는지' 기록을 담을 빈 목록임." },
        { at: 'if "turn_count" not in', text: "turn_count는 대화를 몇 번 주고받았는지 세는 숫자임. 0부터 시작." },
      ],
      code:
`def initialize_session_state() -> None:
    """Streamlit rerun 사이에 유지할 상태를 초기화함."""
    if "messages" not in st.session_state:  # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
        # 화면에 표시할 사용자/assistant 메시지만 저장함. tool 메시지는 모델 호출
        # 내부 맥락에는 필요하지만 사용자에게 그대로 노출하기에는 길고 기술적임.
        st.session_state.messages = [{"role": "assistant", "content": WELCOME_MESSAGE}]

    if "client" not in st.session_state:
        st.session_state.client = None

    if "last_tool_trace" not in st.session_state:
        # 직전 응답에서 어떤 함수가 어떤 인자로 호출됐는지 학습자가 확인할 수
        # 있도록 별도 trace에 저장함.
        st.session_state.last_tool_trace = []

    if "turn_count" not in st.session_state:
        st.session_state.turn_count = 0`,
    },
    {
      id: "get_client",
      name: "get_client()",
      fileId: "main",
      summary: "OpenAI 클라이언트를 처음 한 번만 만들어 두고, 이후에는 저장해 둔 것을 재사용함.",
      how: "클라이언트를 만드는 일은 비용이 들기 때문에, 매번 만들지 않고 처음 한 번만 만들어 st.session_state.client에 보관함(지연 생성 + 캐싱). load_hands_on_env()가 .env 파일의 API 키를 읽어오고, create_openai_client()가 그 키로 실제 클라이언트를 생성함.",
      terms: ["지연 생성(lazy)", "캐싱(cache)", "Streamlit", "API 키", "환경변수(.env)"],
      lines: [
        { at: 'if st.session_state.client is None:', text: "client가 아직 없을(None) 때만 새로 만듦. 이미 있으면 이 블록을 건너뛰고 저장된 것을 그대로 씀(캐싱)." },
        { at: '# Streamlit 화면에 사용자 친화적으로 안내할 수 있음.', text: "load_hands_on_env()가 hands-on/.env 파일을 읽어 API 키 등을 환경변수로 올려줌. 키가 없으면 create_openai_client() 내부에서 오류가 남." },
        { at: 'st.session_state.client = create_openai_client()', text: "API 키로 OpenAI 클라이언트를 만들어 저장함. 이후 호출에서는 이 줄을 건너뜀." },
        { at: 'return st.session_state.client', text: "준비된(또는 새로 만든) 클라이언트를 돌려줌." },
      ],
      code:
`def get_client() -> Any:
    """hands-on/.env 기반 OpenAI 클라이언트를 생성하고 재사용함."""
    if st.session_state.client is None:
        # load_hands_on_env()는 hands-on/.env를 로드함. API 키가 없으면
        # create_openai_client() 내부에서 명확한 RuntimeError를 발생시켜
        # Streamlit 화면에 사용자 친화적으로 안내할 수 있음.
        load_hands_on_env()
        st.session_state.client = create_openai_client()
    return st.session_state.client`,
    },
    {
      id: "build_chat_messages",
      name: "build_chat_messages(user_input)",
      fileId: "main",
      summary: "화면에 쌓인 대화와 새 입력을, OpenAI API가 알아듣는 메시지 딕셔너리 목록으로 변환함.",
      how: "OpenAI에 보낼 '주문서'를 정리하는 함수임. 맨 앞에 시스템 지침(SYSTEM_PROMPT)을 {role: 'system'} 딕셔너리로 넣고, 그동안의 대화를 역할에 따라 담음. 비용을 아끼려고 최근 10개만 포함하고, 마지막에 이번 새 입력을 붙임.",
      terms: ["딕셔너리(dict)", "리스트(list)", "타입 힌트", "role/content"],
      lines: [
        { at: 'messages: list[dict[str, Any]] = [{"role": "system"', text: "메시지 목록의 맨 앞에 시스템 지침을 넣음. role='system'은 'AI에게 주는 역할·규칙'을 담는 메시지 종류임." },
        { at: 'for message in st.session_state.messages[-10:]:', text: "[-10:]은 '뒤에서 10개만' 잘라오는 파이썬 문법임. 대화가 길어질수록 비용이 늘기 때문에 최근 것만 보냄." },
        { at: 'if message["role"] in {"user", "assistant"}:', text: "user(사람)와 assistant(AI) 메시지만 포함함. 내부 tool 메시지는 UI에 저장하지 않으므로 여기선 나오지 않음." },
        { at: 'messages.append({"role": "user", "content": user_input})', text: "마지막으로 이번에 새로 입력한 문장을 user 메시지로 추가함." },
      ],
      code:
`def build_chat_messages(user_input: str) -> list[dict[str, Any]]:
    """OpenAI Chat Completions에 전달할 메시지 배열을 구성함."""
    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]

    # 비용과 토큰 사용량을 줄이기 위해 최근 대화만 포함함. 여행 플래너 예제는
    # 단일 요청 완결성이 중요하므로 최근 10개 UI 메시지만으로 충분함.
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
      summary: "AI가 문자열로 준 함수 인자(JSON 형식)를 파이썬 딕셔너리로 안전하게 변환함.",
      how: "OpenAI 모델은 함수에 넘길 인자를 JSON 문자열 형태로 줌. 예: '{\"city\": \"Seoul\"}'. json.loads()로 파이썬 딕셔너리로 바꿔야 함. 모델이 드물게 불완전한 JSON을 만들 수 있어 try/except로 감싸고, 문제가 생기면 빈 딕셔너리를 돌려줌.",
      terms: ["JSON", "예외 처리(try/except)", "딕셔너리(dict)", "타입 힌트"],
      lines: [
        { at: 'parsed = json.loads(raw_arguments or "{}")', text: "raw_arguments가 비어 있으면 '{}'(빈 JSON)을 쓰는 안전장치. json.loads가 JSON 문자열을 파이썬 딕셔너리로 바꿔줌." },
        { at: 'except json.JSONDecodeError:', text: "모델이 잘못된 JSON을 만들어도 앱이 죽지 않게, 오류를 잡아 빈 딕셔너리로 복구함." },
        { at: 'return parsed if isinstance(parsed, dict) else {}', text: "파싱 결과가 딕셔너리일 때만 반환하고, 아니면 빈 딕셔너리를 돌려줌(안전 처리)." },
      ],
      code:
`def parse_tool_arguments(raw_arguments: str) -> dict[str, Any]:
    """OpenAI tool_call의 JSON 문자열 인자를 안전하게 dict로 변환함."""
    try:
        parsed = json.loads(raw_arguments or "{}")
    except json.JSONDecodeError:
        # 모델이 드물게 불완전한 JSON을 생성할 수 있으므로 함수 호출 자체가
        # 앱을 중단하지 않도록 빈 인자로 복구함. 이후 execute_function()이
        # 인자 오류를 구조화된 error로 반환함.
        return {}

    return parsed if isinstance(parsed, dict) else {}`,
    },
    {
      id: "assistant_message_to_dict",
      name: "assistant_message_to_dict(assistant_message)",
      fileId: "main",
      summary: "OpenAI SDK가 준 응답 메시지 객체를, API 재호출에 쓸 수 있는 딕셔너리 형태로 변환함.",
      how: "OpenAI SDK 응답은 파이썬 객체(Pydantic 모델)임. 다음 API 호출에서 messages 배열에 다시 넣으려면 딕셔너리({ role, content, tool_calls })로 바꿔야 함. tool_calls가 있으면 그것도 딕셔너리로 직접 변환해서 담음. 이 순서(assistant 메시지를 먼저 추가)가 없으면 API가 도구 결과를 제대로 연결하지 못함.",
      terms: ["딕셔너리(dict)", "tool_calls", "tool_call_id", "리스트 컴프리헨션"],
      lines: [
        { at: 'message_dict: dict[str, Any] = {"role": "assistant"}', text: "결과 딕셔너리를 role='assistant'로 시작함." },
        { at: 'if assistant_message.content:', text: "텍스트 내용이 있으면 content 항목을 추가함. tool_calls만 있는 응답은 content가 없을 수 있음." },
        { at: 'if assistant_message.tool_calls:', text: "AI가 도구 호출을 요청했으면(tool_calls), 각 호출을 딕셔너리 형태로 변환해 담음." },
        { at: '"id": tool_call.id,', text: "각 tool_call은 고유 id(영수증 번호)가 있음. 이 id로 결과와 요청을 짝지음." },
      ],
      code:
`def assistant_message_to_dict(assistant_message: Any) -> dict[str, Any]:
    """SDK 응답 메시지를 Chat Completions 재호출용 dict로 변환함."""
    message_dict: dict[str, Any] = {"role": "assistant"}

    if assistant_message.content:
        message_dict["content"] = assistant_message.content

    if assistant_message.tool_calls:
        message_dict["tool_calls"] = [
            {
                "id": tool_call.id,
                "type": tool_call.type,
                "function": {
                    "name": tool_call.function.name,
                    "arguments": tool_call.function.arguments,
                },
            }
            for tool_call in assistant_message.tool_calls
        ]

    return message_dict`,
    },
    {
      id: "run_tool_call",
      name: "run_tool_call(tool_call)",
      fileId: "main",
      summary: "AI가 요청한 단일 도구 호출(함수 실행)을 처리하고, trace 기록과 tool 결과 메시지를 만들어 돌려줌.",
      how: "AI가 '이 함수를 이 값으로 불러줘'라고 요청(tool_call)하면, 이 함수가 실제로 그걸 실행함. 실행은 반드시 execute_function() 화이트리스트를 통해서만 함(보안). 결과를 trace(사이드바용 기록)와 tool 메시지(API 재호출용)로 나눠 만들어 돌려줌.",
      terms: ["tool_call_id", "tool_calls", "화이트리스트", "JSON", "딕셔너리(dict)"],
      lines: [
        { at: 'function_name = tool_call.function.name', text: "AI가 호출하길 원하는 함수 이름을 꺼냄(예: 'get_weather')." },
        { at: 'function_args = parse_tool_arguments(tool_call.function.arguments)', text: "AI가 문자열로 준 인자를 딕셔너리로 변환함." },
        { at: 'result = execute_function(function_name, function_args)', text: "★핵심★ execute_function이 화이트리스트를 확인한 뒤 실제 함수를 실행함. 모델이 엉뚱한 함수명을 만들어도 이 안전장치가 막아줌." },
        { at: '"has_error": isinstance(result, dict) and bool(result.get("error")),', text: "결과에 'error' 항목이 있으면 오류로 표시함. 사이드바에서 성공/오류를 색으로 구분해 보여줌." },
        { at: '"role": "tool",', text: "OpenAI API에서 도구 실행 결과는 반드시 role='tool' 메시지로 전달해야 함. tool_call_id로 어떤 요청의 결과인지 짝지음." },
      ],
      code:
`def run_tool_call(tool_call: Any) -> dict[str, Any]:
    """단일 OpenAI tool_call을 실행하고 trace와 tool 메시지를 반환함."""
    function_name = tool_call.function.name
    function_args = parse_tool_arguments(tool_call.function.arguments)

    # execute_function()은 common/tools.py에 정의된 whitelist를 통해서만
    # 실제 함수를 실행함. 모델이 스키마 밖의 함수명을 생성해도 임의 함수가
    # 호출되지 않도록 막는 중요한 안전 지점임.
    result = execute_function(function_name, function_args)

    trace = {
        "function": function_name,
        "arguments": function_args,
        "has_error": isinstance(result, dict) and bool(result.get("error")),
    }

    # OpenAI Chat Completions에서 tool 결과는 반드시 role="tool" 메시지로
    # 반환해야 함. tool_call_id는 어떤 함수 호출의 결과인지 모델이 매칭하는
    # 필수 식별자임.
    tool_message = {
        "role": "tool",
        "tool_call_id": tool_call.id,
        "content": json.dumps(result, ensure_ascii=False),
    }

    return {"trace": trace, "message": tool_message}`,
    },
    {
      id: "generate_response",
      name: "generate_response(user_input)",
      fileId: "main",
      summary: "사용자 입력을 받아 OpenAI API를 반복 호출하면서 도구를 실행하고, 최종 답변 텍스트를 돌려주는 '중심 함수'임.",
      how: "이 함수가 전체 Tool Calling 흐름을 지휘함. for 루프(최대 MAX_TOOL_ROUNDS=4번)로 ①API 호출 → ②도구 호출 요청 감지 → ③도구 실행 → ④결과를 messages에 추가 → 다시 ①을 반복함. 도구 호출이 없으면(finish_reason이 'tool_calls'가 아님) 최종 답변을 바로 반환함. 09단계 LangChain에서는 이 수동 루프가 create_react_agent로 자동화됨.",
      terms: ["for 루프", "finish_reason", "tool_calls", "MAX_TOOL_ROUNDS", "invoke()", "리스트(list)", "타입 힌트"],
      lines: [
        { at: 'tools = get_openai_tools()', text: "OpenAI API 형식의 도구 스키마 목록을 가져옴(공통 TOOL_DEFINITIONS를 변환한 것)." },
        { at: 'for _ in range(MAX_TOOL_ROUNDS):', text: "★핵심★ 최대 4번까지 반복하는 수동 Tool Calling 루프. 09단계 LangChain의 create_react_agent는 이 루프를 자동으로 처리함." },
        { at: 'if not assistant_message.tool_calls:', text: "AI가 도구 호출 없이 바로 답했으면(tool_calls가 없으면) 이 답변이 최종 결과임. 즉시 반환." },
        { at: 'messages.append(assistant_message_to_dict(assistant_message))', text: "★순서 중요★ tool 결과를 보내기 전에 반드시 assistant 메시지를 먼저 추가해야 API가 tool 결과를 올바른 요청과 짝지을 수 있음." },
        { at: 'for tool_call in assistant_message.tool_calls:', text: "AI가 여러 도구를 동시에 요청할 수 있음. 각 tool_call을 하나씩 처리함." },
      ],
      code:
`def generate_response(user_input: str) -> str:
    """사용자 입력을 처리하고 최종 assistant 응답을 반환함."""
    client = get_client()
    tools = get_openai_tools()
    messages = build_chat_messages(user_input)
    tool_trace: list[dict[str, Any]] = []

    for _ in range(MAX_TOOL_ROUNDS):
        response = call_openai_chat(
            client,
            model=MODEL_NAME,
            messages=messages,
            tools=tools,
        )
        assistant_message = response.choices[0].message

        if not assistant_message.tool_calls:
            st.session_state.last_tool_trace = tool_trace
            return assistant_message.content or "응답 내용이 비어 있음"

        # tool_calls가 포함된 assistant 메시지를 먼저 대화 기록에 넣어야 함.
        # 이 순서가 있어야 다음 API 호출에서 tool 결과 메시지를 올바른
        # assistant tool_call의 결과로 해석함.
        messages.append(assistant_message_to_dict(assistant_message))

        for tool_call in assistant_message.tool_calls:
            tool_result = run_tool_call(tool_call)
            tool_trace.append(tool_result["trace"])
            messages.append(tool_result["message"])

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
        { at: 'with st.chat_message(message["role"]):', text: "st.chat_message(역할)은 사람/AI 말풍선 모양을 만들어 줌. with 블록 안의 내용이 그 말풍선 안에 들어감." },
        { at: 'st.markdown(message["content"])', text: "글자를 굵게·목록·링크 등 서식과 함께 화면에 표시함." },
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
        { at: 'with st.sidebar:', text: "이 블록 안에서 출력하는 모든 것이 왼쪽 사이드바에 표시됨." },
        { at: 'st.metric("대화 턴"', text: "대화 턴(주고받은 횟수)을 숫자 지표로 보여줌." },
        { at: 'if st.button("대화 초기화"', text: "'대화 초기화' 버튼. 누르면 아래 줄들이 실행되어 기록을 모두 비움." },
        { at: 'st.rerun()', text: "st.rerun()은 화면을 처음부터 다시 그리게 함(초기화 결과를 즉시 반영)." },
        { at: 'st.header("직전 함수 호출")', text: "직전에 호출된 함수 기록이 있으면, 함수명·인자·성공여부를 코드 블록으로 표시함." },
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
      summary: "앱의 시작점. 화면을 세팅하고, 입력을 받고, 답변을 생성·표시하는 전체 흐름을 지휘함.",
      how: "프로그램의 '시작 버튼'에 해당함. 페이지 설정 → 상태 초기화 → 사이드바·대화 표시 → 채팅창 입력 처리 순으로 진행함. 사용자가 입력하면(:= 로 받음) 답변을 만들어 말풍선으로 보여주고, 오류가 나도 멈추지 않게 try/except로 감쌈.",
      terms: ["st.chat_input", "st.empty", ":= (바다코끼리)", "예외 처리(try/except)", "Streamlit"],
      lines: [
        { at: 'st.set_page_config(page_title=', text: "st.set_page_config는 브라우저 탭 제목·아이콘·레이아웃을 정함. 코드 맨 처음에 한 번 호출해야 함." },
        { at: 'initialize_session_state()', text: "저장 공간을 준비하고, 사이드바·이전 대화를 그린 후 채팅창을 표시함." },
        { at: 'if user_input := st.chat_input(', text: "★중요 문법★ := (바다코끼리 연산자)는 '입력값을 user_input에 담으면서 동시에 비었는지 검사'함. 입력이 있을 때만 if 블록 실행." },
        { at: 'placeholder = st.empty()', text: "st.empty()는 '나중에 내용을 채울 빈 자리'를 만듦. 먼저 '판단 중...'을 보여주고 답이 오면 그 자리를 답변으로 바꿈." },
        { at: 'assistant_response = generate_response(user_input)', text: "generate_response 실행 중 오류가 나도 앱이 죽지 않도록 try/except로 감싸 오류 메시지로 대체함." },
      ],
      code:
`def main() -> None:
    """Streamlit 앱 진입점."""
    st.set_page_config(page_title=f"{APP_TITLE} - OpenAI", page_icon=APP_ICON, layout="centered")
    st.title(APP_TITLE)
    st.caption("OpenAI Chat Completions Tool Calling + Streamlit")

    initialize_session_state()
    display_sidebar()
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
            except Exception as exc:  # Streamlit UI에서 학습자가 원인을 바로 확인하도록 표시함.
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
      how: "날씨·지도 API는 영문 도시명을 받음. 미리 만들어 둔 표(CITY_NAME_MAP)에서 한글을 찾아 영문으로 바꿔줌. 표에 없으면 입력을 그대로 돌려줌. 앞뒤 공백은 strip()으로 제거함.",
      terms: ["딕셔너리(dict)", ".get()", "타입 힌트"],
      lines: [
        { at: 'cleaned = (city or "").strip()', text: "(city or \"\")는 city가 비어있으면 빈 문자열을 쓰라는 안전장치임. .strip()은 앞뒤 공백을 제거함." },
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
      how: "여러 도구가 공통으로 쓰는 'HTTP 요청 + 결과 받기' 함수임. requests가 실제 인터넷 통신을 담당함. timeout=12는 '12초 안에 응답이 없으면 포기'라는 뜻으로, 무한 대기를 방지함. raise_for_status()는 응답이 실패(404 등)면 오류를 내게 함.",
      terms: ["requests", "raise_for_status()", "JSON", "타입 힌트"],
      lines: [
        { at: 'response = requests.request(method, url, timeout=12,', text: "requests.request가 실제로 인터넷에 요청을 보냄. timeout=12로 너무 오래 기다리지 않게 함." },
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
      terms: ["딕셔너리(dict)", ".get()", "리스트 컴프리헨션", "f-string"],
      lines: [
        { at: 'display_name = place.get("displayName", {}).get("text",', text: ".get(\"displayName\", {})는 'displayName이 없으면 빈 딕셔너리를 쓰라'는 안전한 꺼내기임. 연달아 .get으로 더 깊은 값을 안전하게 꺼냄." },
        { at: 'type_hint = ", ".join(', text: "types[:2]는 앞 2개만 잘라옴. PLACE_TYPE_LABELS 표로 영문 분류를 한글 라벨로 바꿈." },
        { at: 'maps_url = build_google_maps_search_url(display_name, city)', text: "장소별 구글 지도 링크를 미리 만들어 둠." },
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
      id: "get_weather",
      name: "get_weather(city)",
      fileId: "tools",
      summary: "도시의 현재 날씨를 조회하는 함수. AI가 '날씨' 관련 요청에 이 함수를 선택해 호출함.",
      how: "OpenWeatherMap API를 호출해 기온·체감·습도·바람 등을 정리해 돌려줌. 오류가 나도 멈추지 않고 error 항목을 담아 반환함. LangChain 예제(09단계)의 @tool 데코레이터 대신, 이 예제에서는 TOOL_DEFINITIONS(JSON 스키마)로 AI에게 도구를 알려주는 방식을 씀.",
      terms: ["예외 처리(try/except)", "딕셔너리(dict)", ".get()", "API 키"],
      lines: [
        { at: 'if not OPENWEATHER_API_KEY:', text: "날씨 API 키가 없으면, 멈추지 않고 error 메시지를 담은 결과를 돌려줌." },
        { at: 'city_en = normalize_city_name(city)', text: "한글 도시명을 API가 알아듣는 영문으로 변환함." },
        { at: 'weather = data.get("weather", [{}])[0]', text: "응답에서 필요한 값들을 .get()으로 안전하게 꺼내 깔끔한 딕셔너리로 정리함." },
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
      summary: "도시의 대표 관광지를 평점·주소·설명·지도 링크와 함께 검색하는 함수.",
      how: "AI가 관광지 정보가 필요하면 선택하는 함수임. max_results=DEFAULT_MAX_RESULTS처럼 '기본값이 있는 인자'를 써서, AI가 개수를 안 정해도 기본값(8개)으로 동작함. 내부적으로 _search_places를 호출함.",
      terms: ["예외 처리(try/except)", "딕셔너리(dict)", "타입 힌트"],
      lines: [
        { at: 'city_en = normalize_city_name(city)', text: "한글 도시명을 영문으로 변환함." },
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
      summary: "도시의 맛집을 검색하는 함수. 아침/점심/저녁(meal_type)이나 키워드로 좁혀 찾을 수 있음.",
      how: "meal_type·keyword는 None이 기본값인 선택 인자라, AI가 상황에 따라 일부만 채워 호출할 수 있음. 채워진 값들만 모아 검색어를 조립한 뒤 _search_places로 검색함.",
      terms: ["리스트 컴프리헨션", "예외 처리(try/except)", "타입 힌트"],
      lines: [
        { at: 'meal_type: str | None = None,', text: "str | None = None 은 '문자열이거나 없어도 됨(None)'을 뜻하는 선택 인자임." },
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
      summary: "AI가 요청한 함수를 '허용 목록(화이트리스트)'에 있는 것만 실행하는 안전 실행기.",
      how: "AI(LLM)가 임의 함수를 실행할 수 없도록 막는 중요한 보안 장치임. available_functions 딕셔너리에 등록된 함수만 실행 가능함. 등록되지 않은 이름이 오면 오류를 반환함. 실행 전 city 인자는 자동으로 영문으로 변환함.",
      terms: ["화이트리스트", "딕셔너리(dict)", "예외 처리(try/except)", "타입 힌트"],
      lines: [
        { at: 'available_functions = {', text: "★핵심★ 이 딕셔너리가 화이트리스트임. 여기 없는 함수는 절대 실행되지 않음(보안)." },
        { at: 'if function_name not in available_functions:', text: "요청한 함수명이 허용 목록에 없으면 error를 담아 반환함." },
        { at: 'safe_arguments = dict(arguments or {})', text: "arguments가 None이어도 빈 딕셔너리로 처리하는 안전장치." },
        { at: 'if "city" in safe_arguments:', text: "city 인자가 있으면 자동으로 영문으로 변환함(AI가 한글 도시명을 보내도 처리)." },
        { at: 'return available_functions[function_name](**safe_arguments)', text: "**safe_arguments는 딕셔너리를 함수의 키워드 인자로 펼쳐서 전달하는 파이썬 문법임." },
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

    // ===== common/prompts.py (지침서) =====
    {
      id: "TOOL_DEFINITIONS",
      name: "TOOL_DEFINITIONS (상수)",
      fileId: "prompts",
      summary: "AI에게 '이런 함수들을 쓸 수 있어'라고 알려주는 도구 명세서(JSON Schema 형식).",
      how: "OpenAI Tool Calling의 핵심 요소임. 각 함수의 이름·설명·파라미터를 JSON Schema 형식으로 기술해 두면, AI가 이 명세서를 보고 언제 어떤 함수를 어떤 값으로 호출할지 스스로 판단함. @tool 데코레이터 없이도 함수를 AI에게 알릴 수 있는 방법임.",
      terms: ["JSON Schema", "딕셔너리(dict)", "리스트 컴프리헨션"],
      lines: [
        { at: 'TOOL_DEFINITIONS = [', text: "세 개의 도구(날씨·관광지·맛집)를 목록으로 정의함." },
        { at: '"name": "get_weather",', text: "함수 이름. AI가 이 이름으로 호출 요청을 보냄(tool_call.function.name과 일치해야 함)." },
        { at: '"description": "Get current weather', text: "함수 설명(영문). AI가 이 설명을 읽고 언제 이 도구를 쓸지 판단함." },
        { at: '"description": "English city name, such as Seoul, Tokyo, Paris, Busan."', text: "파라미터 스키마. 어떤 인자가 필요한지(type, description, required)를 기술함. city는 필수(required) 인자임." },
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
      summary: "공통 도구 정의(TOOL_DEFINITIONS)를 OpenAI API가 요구하는 형식({type: 'function', function: ...})으로 변환함.",
      how: "OpenAI Chat Completions API는 tools 파라미터를 받을 때 {type: 'function', function: {name, description, parameters}} 형식을 요구함. 공통 정의를 이 형식으로 감싸주는 변환 함수임.",
      terms: ["리스트 컴프리헨션", "딕셔너리(dict)", "타입 힌트"],
      lines: [
        { at: 'return [', text: "리스트 컴프리헨션으로 TOOL_DEFINITIONS의 각 항목을 OpenAI 형식으로 변환해 목록으로 만듦." },
        { at: '"type": "function",', text: "OpenAI API가 요구하는 고정 필드. 항상 'function'으로 지정함." },
        { at: 'for tool in TOOL_DEFINITIONS', text: "공통 TOOL_DEFINITIONS를 하나씩 꺼내 변환함." },
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
        { at: 'return HANDS_ON_ENV_PATH', text: ".env 파일의 경로를 돌려줌(호출자가 오류 메시지에 쓸 수 있도록)." },
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
      summary: "OpenAI 클라이언트를 만들어 돌려줌. 다른 모델 예제(Claude·Gemini)에 필요한 라이브러리를 불필요하게 불러오지 않도록 지연 import를 씀.",
      how: "파이썬의 import는 보통 파일 맨 위에서 하지만, 이 함수 안에서 하면 이 함수를 부를 때만 불러옴(지연 import). openai 라이브러리가 없는 환경에서 다른 예제가 이 파일을 import해도 오류가 나지 않음.",
      terms: ["지연 생성(lazy)", "API 키", "OpenAI 클라이언트"],
      lines: [
        { at: 'from openai import OpenAI', text: "함수 안에서 import해 필요할 때만 openai 라이브러리를 불러옴(지연 import)." },
        { at: 'return OpenAI(api_key=require_api_key("OPENAI_API_KEY"))', text: "require_api_key로 키를 확인하고 OpenAI 클라이언트를 만들어 돌려줌." },
      ],
      code:
`def create_openai_client():
    """OpenAI 클라이언트를 지연 생성하여 반환. 다른 예제에서 불필요한 import 방지."""
    from openai import OpenAI

    return OpenAI(api_key=require_api_key("OPENAI_API_KEY"))`,
    },
    {
      id: "call_openai_chat",
      name: "call_openai_chat(client, *, model, messages, tools)",
      fileId: "llm",
      summary: "OpenAI Chat Completions API를 도구 목록과 함께 호출하는 도우미 함수.",
      how: "tool_choice='auto'는 AI가 도구 사용 여부를 스스로 판단하게 함. parallel_tool_calls=True는 여러 도구를 동시에 요청할 수 있게 함(예: 날씨+관광지를 한 번에). * 뒤의 인자들은 키워드로만 전달해야 하는 '강제 키워드 인자'임.",
      terms: ["tool_choice", "parallel_tool_calls", "finish_reason", "타입 힌트"],
      lines: [
        { at: 'def call_openai_chat(client: Any, *, model: str,', text: "* 다음에 오는 model, messages, tools는 반드시 키워드로 전달해야 함(예: model='gpt-4o-mini'). 실수로 순서를 바꿔도 잘못 들어가지 않게 하는 안전장치임." },
        { at: 'tool_choice="auto",', text: "tool_choice='auto'는 AI가 도구가 필요한지 스스로 판단하게 함. 'none'이면 도구 사용 안 함, 특정 도구를 강제할 수도 있음." },
        { at: 'parallel_tool_calls=True,', text: "여러 도구를 동시에 요청하도록 허용함. 예: '서울 여행 루트' 요청 시 날씨·관광지·맛집 함수를 한 번에 요청함." },
      ],
      code:
`def call_openai_chat(client: Any, *, model: str, messages: list[dict], tools: list[dict]):
    """OpenAI Chat Completions API를 tool_choice=auto로 호출하여 응답 반환."""
    return client.chat.completions.create(
        model=model,
        messages=messages,
        tools=tools,
        tool_choice="auto",
        parallel_tool_calls=True,
    )`,
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
        { at: 'WELCOME_MESSAGE =', text: "WELCOME_MESSAGE: 처음 화면에 보여줄 환영 인사 글(삼중 따옴표로 여러 줄 작성)." },
        { at: 'USAGE_GUIDE =', text: "USAGE_GUIDE: 왼쪽 사이드바에 보여줄 사용 예시 안내." },
        { at: 'TECH_GUIDE =', text: "TECH_GUIDE: 핵심 Tool Calling 흐름을 간단히 정리한 기술 안내." },
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
    "st.empty": "'나중에 채울 빈 자리'를 만들어 두는 기능. 먼저 '판단 중...'을 보여주고, 답이 오면 같은 자리를 답변으로 바꿀 수 있음.",
    "st.sidebar": "화면 왼쪽의 보조 패널. with st.sidebar 블록 안에서 출력한 것은 모두 왼쪽에 표시됨.",
    "tool_calls": "AI가 '이 함수를 이런 값으로 호출해줘'라고 요청한 내역. 응답 메시지 안에 들어 있음.",
    "tool_call_id": "도구 호출 하나하나에 붙는 고유 번호(영수증 번호). 어떤 호출의 결과인지 짝지을 때 사용함.",
    "finish_reason": "AI 응답이 왜 끝났는지를 알려주는 값. 'stop'은 정상 종료, 'tool_calls'는 도구를 호출하고 싶어 멈춘 것임.",
    "role/content": "OpenAI 메시지의 두 핵심 필드. role은 발신자(system·user·assistant·tool), content는 내용임.",
    "MAX_TOOL_ROUNDS": "도구 호출을 최대 몇 번 반복할지 제한하는 상수. 무한 루프를 방지하는 안전장치임.",
    "for 루프": "목록의 항목을 하나씩 꺼내며 같은 코드를 반복 실행하는 구문. 여기서는 도구 호출 요청을 하나씩 처리함.",
    "invoke()": "LangChain에서 에이전트·체인을 실행할 때 쓰는 메서드. 09단계 LangChain에서 이 예제의 수동 for 루프를 대체함.",
    "화이트리스트": "허용된 것만 담아 둔 목록. 이 목록에 있는 것만 실행할 수 있어 보안 위협을 줄임.",
    "지연 생성(lazy)": "필요해질 때까지 만들지 않고 미뤘다가, 처음 쓸 때 한 번만 만드는 방식. 불필요한 작업과 비용을 줄임.",
    "캐싱(cache)": "한 번 만든 결과를 저장해 두고, 다음에 또 필요하면 다시 만들지 않고 저장본을 재사용하는 것.",
    "OpenAI 클라이언트": "OpenAI 서버와 통신하는 객체. client.chat.completions.create(...)처럼 이 객체를 통해 API를 호출함.",
    "tool_choice": "AI가 도구를 사용할지 여부를 지정하는 옵션. 'auto'는 AI가 스스로 판단, 'none'은 도구 사용 안 함.",
    "parallel_tool_calls": "여러 도구를 동시에 요청할 수 있게 허용하는 옵션. 예: 날씨+관광지+맛집 함수를 한 번에 요청함.",
    "JSON Schema": "데이터 구조를 정의하는 표준 형식. 함수의 파라미터 이름·타입·설명을 기술해 AI가 올바른 값을 생성하게 안내함.",
    "JSON": "데이터를 주고받는 표준 글자 형식. {\"key\": \"value\"} 모양으로, 파이썬 딕셔너리와 거의 똑같이 생김.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"도시\": \"서울\"}처럼 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    "리스트(list)": "여러 값을 순서대로 담는 목록. [\"a\", \"b\"]처럼 대괄호로 표현함.",
    "리스트 컴프리헨션": "[표현식 for 항목 in 목록 if 조건] 형태로, 반복문을 한 줄로 짧게 써서 새 목록을 만드는 파이썬 문법.",
    ".get()": "딕셔너리에서 값을 '안전하게' 꺼내는 방법. 열쇠가 없어도 오류를 내지 않고, 정해둔 기본값을 돌려줌.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "RuntimeError": "'실행 중 문제가 생겼다'고 알리는 오류의 한 종류. 여기서는 API 키가 없을 때 일부러 발생시켜 원인을 알려줌.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env라는 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(날씨·지도·OpenAI 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "requests": "파이썬에서 인터넷 주소로 요청을 보내고 응답을 받는 대표적인 라이브러리(HTTP 통신 도구).",
    "raise_for_status()": "인터넷 응답이 실패(예: 404 없음, 500 서버오류)면 오류를 발생시키는 점검 장치. 잘못된 응답을 그냥 쓰지 않게 함.",
    "FieldMask": "API에 '응답에서 이 항목들만 보내줘'라고 지정하는 것. 불필요한 데이터 전송과 비용을 줄임.",
    "quote_plus": "글자를 URL 주소에 안전하게 넣을 수 있는 형태로 바꿔주는 함수(공백을 +로 바꾸는 등).",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
    "타입 힌트": "변수나 함수에 '이건 문자열(str)이야, 결과는 목록(list)이야'처럼 자료의 종류를 적어두는 표시. 실행에 꼭 필요하진 않지만, 코드를 읽고 점검하기 쉽게 함.",
    ":= (바다코끼리)": "값을 변수에 '담으면서 동시에' 그 값을 검사하는 연산자. 모양이 바다코끼리 눈·엄니를 닮아 붙은 별명. 예: if (x := 입력값): 은 입력을 x에 담고 비었는지 바로 확인함.",
  },
};
