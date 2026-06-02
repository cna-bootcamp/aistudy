/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../08.function-call/gemini/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "여행 플래너 (Gemini Function Calling) 예제 설명",
    entry: "travel_planner.py",
  },

  files: [
    { id: "main",    label: "travel_planner.py",   role: "메인 파일 · 화면과 수동 Function Calling 루프" },
    { id: "llm",     label: "common/llm.py",        role: "Gemini 클라이언트 생성 및 API 호출 헬퍼" },
    { id: "prompts", label: "common/prompts.py",    role: "시스템 프롬프트 + 도구 스키마 정의" },
    { id: "tools",   label: "common/tools.py",      role: "외부 API 도구 구현 + 화이트리스트 실행기" },
    { id: "uitext",  label: "common/ui_text.py",    role: "화면에 표시할 안내 문구 모음" },
  ],

  flow: [
    { step: 1, title: "앱 시작",
      summary: "main()이 호출되어 채팅 상태와 Gemini 클라이언트 저장소를 초기화함",
      detail: "식당 문을 열고 준비하는 단계임. initialize_session_state()가 대화 기록·클라이언트·함수 호출 로그를 담을 빈 상자를 만들어 둠." },
    { step: 2, title: "화면 구성",
      summary: "display_sidebar()가 왼쪽 사이드바(사용법·함수 로그·초기화)를 표시하고, 이전 대화를 화면에 그림",
      detail: "손님을 맞기 전 메뉴판과 안내문을 세팅하는 단계임. 아직 새 입력은 받기 전임." },
    { step: 3, title: "사용자 입력 대기",
      summary: "st.chat_input에서 '서울', '도쿄 날씨' 같은 입력을 기다림",
      detail: "손님이 주문할 때까지 기다리는 단계임. 입력이 있으면 다음 단계로 넘어감." },
    { step: 4, title: "대화 이력 변환",
      summary: "build_contents()가 지난 대화와 새 입력을 Gemini용 Content 배열로 정리함",
      detail: "AI가 알아듣는 '주문서' 형식으로 정리하는 단계임. Streamlit의 문자열 메시지를 types.Content 객체로 변환함." },
    { step: 5, title: "Gemini 첫 호출",
      summary: "call_gemini_content()로 Gemini에 도구 목록과 함께 요청을 보냄",
      detail: "주방(Gemini)에 주문서를 넘기는 단계임. Gemini는 '직접 답변'할지, '도구를 호출'할지 판단함. 도구 스키마(TOOL_DEFINITIONS)를 함께 보내 어떤 함수를 쓸 수 있는지 알려줌." },
    { step: 6, title: "함수 호출 여부 판단",
      summary: "response.function_calls가 있으면 도구 실행, 없으면 바로 답변을 반환함",
      detail: "Gemini가 '도구가 필요해!'라고 응답하면 function_calls에 호출할 함수명과 인자가 담겨 옴. 비어 있으면 이미 최종 답변이 온 것임." },
    { step: 7, title: "도구 실행 (수동 루프)",
      summary: "run_function_calls()가 요청된 함수를 execute_function으로 실행하고, 결과를 role='tool' Content로 대화에 추가함",
      detail: "주방보조(코드)가 직접 외부 API를 호출하는 단계임. LangChain처럼 라이브러리가 자동으로 하지 않고, 개발자가 for 루프로 직접 처리함. 함수 실행 결과는 Part.from_function_response로 감싸 Gemini에 돌려줌." },
    { step: 8, title: "Gemini 재호출 + 루프",
      summary: "도구 결과를 포함한 대화 이력으로 Gemini를 다시 호출. function_calls가 없을 때까지 최대 5라운드 반복함",
      detail: "재료를 받은 주방장이 다시 생각하는 단계임. 여전히 도구가 필요하면 다시 실행하고, 최대 5번 반복해 무한 루프를 방지함. 자동 루프가 아닌 개발자가 명시적으로 짠 for 반복문임." },
    { step: 9, title: "최종 답변 표시",
      summary: "response_text()로 텍스트를 꺼내 말풍선으로 표시하고, 함수 호출 로그를 사이드바에 기록함",
      detail: "완성된 요리를 손님에게 내는 단계임. 답변 말풍선과 함께, 어떤 함수가 호출됐는지(성공/오류)를 사이드바에 투명하게 보여줌." },
    { step: 10, title: "반복",
      summary: "사용자가 새 입력을 하면 3번 단계부터 다시 진행함",
      detail: "손님이 추가 주문을 하면 같은 과정을 반복함. 이전 대화가 기억에 남아 맥락 있는 대화가 가능함." },
  ],

  functions: [
    // ===== travel_planner.py (메인) =====
    {
      id: "module_setup",
      name: "모듈 설정 (경로·상수)",
      fileId: "main",
      summary: "파일 맨 위에서 공통 모듈 경로를 등록하고, 모델명·최대 라운드 수·Streamlit 페이지 설정을 준비함.",
      how: "travel_planner.py는 상위 common/ 폴더의 모듈을 import함. 파이썬이 common/을 못 찾으면 오류가 나므로, sys.path.insert로 검색 경로에 직접 추가함. MAX_FUNCTION_CALL_ROUNDS=5는 무한 함수 호출 루프를 막는 안전장치임.",
      terms: ["sys.path.insert", "Path(__file__)", "Streamlit", "st.set_page_config"],
      lines: [
        { at: "CURRENT_DIR = Path(__file__).resolve().parent", text: "이 파일이 있는 폴더의 절대 경로를 구함. 어디서 실행해도 경로가 어긋나지 않게 함." },
        { at: 'sys.path.insert(0, str(COMMON_DIR))', text: "파이썬이 모듈을 찾는 경로 목록 맨 앞에 common/ 폴더를 추가함. 이래야 'from llm import ...'가 동작함." },
        { at: 'MODEL_NAME = "gemini-3.5-flash"', text: "사용할 Gemini 모델 이름을 상수로 정의함. 바꾸고 싶으면 이 한 줄만 수정하면 됨." },
        { at: 'MAX_FUNCTION_CALL_ROUNDS = 5', text: "함수 호출 루프를 최대 5번까지만 반복함. 무한 루프 방지 안전장치임." },
        { at: 'st.set_page_config(', text: "Streamlit 앱의 브라우저 탭 제목·아이콘·레이아웃을 정함. 코드 맨 처음에 한 번 호출해야 함." },
      ],
      code:
`CURRENT_DIR = Path(__file__).resolve().parent  # 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
COMMON_DIR = CURRENT_DIR.parent / "common"
if str(COMMON_DIR) not in sys.path:
    sys.path.insert(0, str(COMMON_DIR))  # 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 디렉터리를 추가함

from llm import call_gemini_content, create_gemini_client, load_hands_on_env  # noqa: E402
from prompts import SYSTEM_PROMPT, get_gemini_tools  # noqa: E402
from tools import execute_function  # noqa: E402
from ui_text import APP_ICON, APP_TITLE, TECH_GUIDE, USAGE_GUIDE, WELCOME_MESSAGE  # noqa: E402


MODEL_NAME = "gemini-3.5-flash"
MAX_FUNCTION_CALL_ROUNDS = 5


st.set_page_config(
    page_title=f"{APP_TITLE} - Gemini",
    page_icon=APP_ICON,
    layout="centered",
)`,
    },
    {
      id: "initialize_session_state",
      name: "initialize_session_state()",
      fileId: "main",
      summary: "화면을 다시 그릴 때마다 사라지지 않아야 할 데이터(대화·클라이언트·함수 로그)를 위한 빈 저장 공간을 만듦.",
      how: "Streamlit은 사용자가 무언가 누를 때마다 코드를 처음부터 다시 실행함. 그래서 일반 변수는 매번 초기화됨. st.session_state에 넣어두면 그 탭이 열려 있는 동안 값이 유지됨. '이미 있으면 건드리지 않는다' 패턴으로, 기존 대화를 보존함.",
      terms: ["st.session_state", "Streamlit", "딕셔너리(dict)"],
      lines: [
        { at: 'if "messages" not in st.session_state:', text: "messages(대화 기록)가 아직 없을 때만 빈 목록으로 만듦. 이미 있으면 건드리지 않아 기존 대화가 보존됨." },
        { at: 'if "gemini_client" not in st.session_state:', text: "gemini_client는 Gemini API와 통신하는 객체임. None으로 초기화해 두었다가 처음 쓸 때 만듦(지연 생성)." },
        { at: 'if "function_logs" not in st.session_state:', text: "function_logs는 이번 대화에서 호출된 함수 기록을 담는 목록임. 사이드바에 표시하는 데 사용함." },
      ],
      code:
`def initialize_session_state() -> None:
    """Streamlit 재실행 사이에 유지할 채팅 상태와 Gemini 클라이언트 저장소 초기화."""
    if "messages" not in st.session_state:  # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
        st.session_state.messages = []
    if "gemini_client" not in st.session_state:
        st.session_state.gemini_client = None
    if "function_logs" not in st.session_state:
        st.session_state.function_logs = []`,
    },
    {
      id: "get_client",
      name: "get_client()",
      fileId: "main",
      summary: "Gemini API와 통신할 클라이언트를 처음 한 번만 만들어 두고 이후에는 저장해 둔 것을 재사용함.",
      how: "클라이언트를 만드는 일은 비용이 들기 때문에, 매번 만들지 않고 st.session_state.gemini_client에 보관함(지연 생성 + 캐싱). load_hands_on_env()로 .env를 먼저 읽어 API 키를 준비한 뒤 create_gemini_client()로 만듦.",
      terms: ["지연 생성(lazy)", "캐싱(cache)", "환경변수(.env)", "API 키"],
      lines: [
        { at: 'if st.session_state.gemini_client is None:', text: "클라이언트가 아직 없을 때만 새로 만듦. 이미 있으면 저장된 것을 그대로 씀(캐싱)." },
        { at: 'load_hands_on_env()', text: ".env 파일을 읽어 GEMINI_API_KEY 등을 환경변수로 올림." },
        { at: 'st.session_state.gemini_client = create_gemini_client()', text: "Gemini 클라이언트를 만들어 저장함. 다음 호출부터는 이것을 그대로 씀." },
        { at: 'return st.session_state.gemini_client', text: "준비된(또는 새로 만든) 클라이언트를 돌려줌." },
      ],
      code:
`def get_client():
    """hands-on/.env의 GEMINI_API_KEY를 사용하여 Gemini 클라이언트를 지연 생성."""
    if st.session_state.gemini_client is None:
        # 공통 LLM 모듈이 hands-on/.env 경로를 알고 있으므로, 예제별 env 중복 로드를 피함.
        load_hands_on_env()
        st.session_state.gemini_client = create_gemini_client()
    return st.session_state.gemini_client`,
    },
    {
      id: "build_contents",
      name: "build_contents(user_input)",
      fileId: "main",
      summary: "Streamlit 채팅 이력과 새 입력을 Gemini가 이해하는 Content 객체 목록으로 변환함.",
      how: "Streamlit은 대화를 {role, content} 딕셔너리로 저장하지만, Gemini는 types.Content 객체를 원함. 역할을 'model'(Gemini쪽)과 'user'(사람쪽)로 매핑하고, 비용 절약을 위해 최근 10개 대화만 포함함.",
      terms: ["types.Content", "types.Part", "딕셔너리(dict)", "리스트(list)"],
      lines: [
        { at: 'contents: list[types.Content] = []', text: "Gemini에 보낼 Content 목록을 빈 상태로 준비함." },
        { at: 'role = "model" if message["role"] == "assistant" else "user"', text: "Streamlit의 'assistant' 역할을 Gemini가 인식하는 'model' 역할로 변환함." },
        { at: 'parts=[types.Part.from_text(text=message["content"])]', text: "이전 대화 내용을 텍스트 Part로 감싸 Content에 넣음." },
        { at: 'parts=[types.Part.from_text(text=user_input)]', text: "마지막으로 이번 새 입력을 user Content로 추가함." },
      ],
      code:
`def build_contents(user_input: str) -> list[types.Content]:
    """Streamlit 채팅 이력을 Gemini generate_content가 이해하는 Content 배열로 변환."""
    contents: list[types.Content] = []

    # 교육 예제에서는 최근 대화만 전달하여 토큰 사용량을 제어함.
    # assistant는 Gemini에서 model role로 전달해야 이전 모델 발화로 인식됨.
    for message in st.session_state.messages[-10:]:
        role = "model" if message["role"] == "assistant" else "user"
        contents.append(
            types.Content(
                role=role,
                parts=[types.Part.from_text(text=message["content"])],
            )
        )

    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_input)],
        )
    )
    return contents`,
    },
    {
      id: "response_text",
      name: "response_text(response)",
      fileId: "main",
      summary: "Gemini 응답 객체에서 텍스트 내용을 안전하게 꺼내 돌려주는 작은 도우미 함수.",
      how: "response.text가 None이거나 비어 있을 때 빈 문자열 대신 안내 메시지를 돌려줌. 짧지만 빈 화면이 뜨는 것을 막는 중요한 안전장치임.",
      terms: ["타입 힌트"],
      lines: [
        { at: 'return response.text or "응답을 생성할 수 없습니다."', text: "response.text가 비어 있으면(None·빈 문자열) 대신 안내 문구를 돌려줌." },
      ],
      code:
`def response_text(response: Any) -> str:
    """Gemini 응답에서 안전하게 텍스트 추출."""
    return response.text or "응답을 생성할 수 없습니다."`,
    },
    {
      id: "run_function_calls",
      name: "run_function_calls(response, contents)",
      fileId: "main",
      summary: "Gemini가 요청한 함수(들)를 실행하고, 결과를 role='tool' Content로 대화 이력에 추가함.",
      how: "Gemini가 '이 함수를 실행해줘'라고 요청하면 response.function_calls에 목록이 담김. 각 함수를 execute_function으로 실행하고 결과를 Part.from_function_response로 감쌈. 중요: 함수 결과는 반드시 role='tool' Content로 보내야 함(role='user'로 보내면 Gemini가 응답을 중단할 수 있음).",
      terms: ["function_calls", "execute_function", "Part.from_function_response", "role='tool'", "딕셔너리(dict)", "리스트(list)"],
      lines: [
        { at: 'if not response.candidates:', text: "응답에 후보(candidates)가 없으면 빈 목록을 돌려줌(안전 처리)." },
        { at: 'contents.append(response.candidates[0].content)', text: "★중요★ 모델이 반환한 function_call Content를 먼저 대화 이력에 추가함. 그래야 Gemini가 맥락을 이해함." },
        { at: 'for function_call in response.function_calls or []:', text: "Gemini가 요청한 함수 호출 목록을 하나씩 처리함." },
        { at: 'result = execute_function(function_name, function_args)', text: "execute_function이 허용된 함수만 안전하게 실행함(화이트리스트 방식)." },
        { at: 'types.Part.from_function_response(', text: "함수 실행 결과를 Gemini가 이해하는 형식으로 감쌈." },
        { at: 'role="tool",', text: "★핵심★ 함수 결과 Content는 반드시 role='tool'로 보내야 함. role='user'로 보내면 Gemini가 응답을 멈출 수 있음." },
      ],
      code:
`def run_function_calls(response: Any, contents: list[types.Content]) -> list[dict[str, Any]]:
    """
    Gemini가 요청한 모든 function_call을 실행하고 tool 응답 Content를 contents에 추가.

    중요한 흐름:
    1. 모델이 반환한 function_call content를 먼저 대화 이력에 추가함.
    2. 각 function_call을 execute_function으로 실행함.
    3. 실행 결과를 Part.from_function_response로 변환함.
    4. Function Response는 반드시 role="tool" Content로 전달함.
       role="user"로 보내면 최신 google-genai SDK에서 후속 응답이 멈출 수 있음.
    """
    if not response.candidates:
        return []

    contents.append(response.candidates[0].content)

    logs: list[dict[str, Any]] = []
    function_response_parts: list[types.Part] = []

    for function_call in response.function_calls or []:
        function_name = function_call.name
        function_args = dict(function_call.args) if function_call.args else {}
        result = execute_function(function_name, function_args)

        logs.append(
            {
                "name": function_name,
                "args": function_args,
                "has_error": isinstance(result, dict) and "error" in result,
            }
        )

        # Gemini Function Response는 함수명과 결과 딕셔너리를 구조화하여 반환함.
        # result 키로 감싸면 모델이 도구 실행 결과와 에러를 안정적으로 구분 가능함.
        function_response_parts.append(
            types.Part.from_function_response(
                name=function_name,
                response={"result": result},
            )
        )

    contents.append(
        types.Content(
            role="tool",
            parts=function_response_parts,
        )
    )
    return logs`,
    },
    {
      id: "generate_response",
      name: "generate_response(user_input)",
      fileId: "main",
      summary: "사용자 입력을 받아 Gemini에 요청하고, 함수 호출이 필요하면 수동 루프로 처리해 최종 답변을 반환함.",
      how: "이 함수가 핵심 흐름을 지휘함. Gemini 첫 호출 후 function_calls가 있으면 run_function_calls로 실행하고 다시 Gemini를 호출하는 과정을 반복함. LangChain의 create_react_agent처럼 라이브러리가 자동으로 하지 않고, 개발자가 for 루프로 직접 짠 '수동 Function Calling 루프'임. 5라운드 초과 시 안내 메시지를 돌려줌.",
      terms: ["Function Calling", "수동 루프", "call_gemini_content", "function_calls", "예외 처리(try/except)"],
      lines: [
        { at: 'client = get_client()', text: "준비된(또는 새로 만든) Gemini 클라이언트를 가져옴." },
        { at: 'tools = get_gemini_tools()', text: "Gemini에 넘길 도구 목록(FunctionDeclaration)을 가져옴." },
        { at: 'contents = build_contents(user_input)', text: "지난 대화 + 새 입력을 Gemini용 Content 배열로 변환함." },
        { at: 'for _ in range(MAX_FUNCTION_CALL_ROUNDS):', text: "함수 호출 루프를 최대 MAX_FUNCTION_CALL_ROUNDS(5)번까지만 돌려 무한 루프를 방지함." },
        { at: 'if not response.function_calls:', text: "function_calls가 비어 있으면 Gemini가 최종 답변을 준 것임 → 바로 반환." },
        { at: 'function_logs.extend(run_function_calls(response, contents))', text: "함수를 실행하고 결과를 대화 이력에 추가함. 로그도 모음." },
      ],
      code:
`def generate_response(user_input: str) -> tuple[str, list[dict[str, Any]]]:
    """
    사용자 입력에 대한 최종 답변 생성.

    단일 함수 호출 예:
    - "서울 날씨" -> get_weather 1개 호출
    - "파리 관광지" -> get_tourist_attractions 1개 호출
    - "부산 맛집" -> get_restaurants 1개 호출

    다중 함수 호출 예:
    - "서울" 또는 "서울 여행 루트" -> 날씨, 관광지, 맛집 함수를 함께 호출
    """
    client = get_client()
    tools = get_gemini_tools()
    contents = build_contents(user_input)
    function_logs: list[dict[str, Any]] = []

    response = call_gemini_content(
        client,
        model=MODEL_NAME,
        contents=contents,
        tools=tools,
        system=SYSTEM_PROMPT,
    )

    # Function Calling은 모델이 더 필요한 도구를 요청할 수 있으므로 반복 처리함.
    # 무한 루프를 막기 위해 최대 라운드를 제한함.
    for _ in range(MAX_FUNCTION_CALL_ROUNDS):
        if not response.function_calls:
            return response_text(response), function_logs

        function_logs.extend(run_function_calls(response, contents))
        response = call_gemini_content(
            client,
            model=MODEL_NAME,
            contents=contents,
            tools=tools,
            system=SYSTEM_PROMPT,
        )

    return (
        "함수 호출이 반복되어 처리를 중단함. 요청을 더 구체적으로 입력해 주세요.",
        function_logs,
    )`,
    },
    {
      id: "display_chat_history",
      name: "display_chat_history()",
      fileId: "main",
      summary: "저장된 지난 대화를 화면에 말풍선으로 다시 그려줌.",
      how: "Streamlit은 화면을 매번 새로 그리므로, 이전 대화도 매번 다시 그려야 함. messages에 저장된 각 항목을 역할(user/assistant)에 맞는 말풍선으로 출력함.",
      terms: ["st.chat_message", "st.markdown", "Streamlit"],
      lines: [
        { at: 'for message in st.session_state.messages:', text: "저장된 대화를 순서대로 꺼냄." },
        { at: 'with st.chat_message(message["role"]):', text: "역할(user/assistant)에 맞는 말풍선 모양을 만듦. with 블록 안의 내용이 그 말풍선 안에 들어감." },
        { at: 'st.markdown(message["content"])', text: "글자를 서식과 함께 화면에 표시함." },
      ],
      code:
`def display_chat_history() -> None:
    """저장된 대화 이력을 Streamlit 채팅 메시지로 렌더링."""
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])`,
    },
    {
      id: "display_sidebar",
      name: "display_sidebar()",
      fileId: "main",
      summary: "왼쪽 사이드바에 사용법·핵심 흐름·최근 함수 호출 기록·초기화 버튼을 표시함.",
      how: "with st.sidebar 블록 안의 내용은 모두 화면 왼쪽에 표시됨. 최근 8개 함수 호출 로그를 성공/오류 표시와 함께 보여줌. '대화 초기화' 버튼을 누르면 기록을 비우고 화면을 새로 그림.",
      terms: ["st.sidebar", "st.rerun", "st.code"],
      lines: [
        { at: 'with st.sidebar:', text: "이 블록 안에서 출력하는 모든 것이 왼쪽 사이드바에 표시됨." },
        { at: 'for log in st.session_state.function_logs[-8:]:', text: "최근 8개 함수 호출 로그만 표시함(오래된 것은 생략)." },
        { at: 'status = "오류" if log["has_error"] else "성공"', text: "함수 실행 결과에 error가 있으면 '오류', 없으면 '성공'으로 표시함." },
        { at: 'if st.button("대화 초기화"', text: "'대화 초기화' 버튼. 누르면 대화 기록과 함수 로그를 모두 비움." },
        { at: 'st.rerun()', text: "화면을 처음부터 다시 그려 초기화 결과를 즉시 반영함." },
      ],
      code:
`def display_sidebar() -> None:
    """사용 예시와 실행 상태를 사이드바에 표시."""
    with st.sidebar:
        st.header("사용 방법")
        st.markdown(USAGE_GUIDE)
        st.divider()
        st.header("핵심 흐름")
        st.markdown(TECH_GUIDE)
        st.divider()
        st.caption(f"Model: \`{MODEL_NAME}\`")

        if st.session_state.function_logs:
            st.subheader("최근 함수 호출")
            for log in st.session_state.function_logs[-8:]:
                status = "오류" if log["has_error"] else "성공"
                st.code(f"{log['name']}({log['args']}) -> {status}", language="text")

        if st.button("대화 초기화", use_container_width=True):
            st.session_state.messages = []
            st.session_state.function_logs = []
            st.rerun()`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "앱의 시작점. 상태 초기화·사이드바·대화 표시·입력 처리·응답 생성·결과 표시 순으로 전체 흐름을 지휘함.",
      how: "프로그램의 '시작 버튼'에 해당함. st.chat_input으로 입력을 받고(:= 로 바로 검사), generate_response로 답변을 만들어 말풍선으로 표시함. 오류가 나도 앱이 죽지 않도록 try/except로 감쌈.",
      terms: ["st.chat_input", "st.chat_message", "st.spinner", ":= (바다코끼리)", "예외 처리(try/except)", "Streamlit"],
      lines: [
        { at: 'initialize_session_state()', text: "상태 초기화를 먼저 수행함." },
        { at: 'display_sidebar()', text: "사이드바를 구성함." },
        { at: 'if prompt := st.chat_input(', text: "★중요 문법★ := (바다코끼리 연산자)는 입력값을 prompt에 담으면서 동시에 비었는지 검사함. 입력이 있을 때만 if 블록 실행." },
        { at: 'with st.spinner(', text: "st.spinner는 처리 중 '로딩' 표시를 보여줌. 그 안에서 generate_response를 호출함." },
        { at: 'answer, logs = generate_response(prompt)', text: "수동 Function Calling 루프가 담긴 핵심 함수를 호출함. 최종 답변과 함수 로그를 함께 받음." },
        { at: 'except Exception as exc:', text: "오류가 나도 앱이 죽지 않게, 오류 메시지를 answer로 대체함." },
      ],
      code:
`def main() -> None:
    """Streamlit 웹채팅 앱 진입점."""
    initialize_session_state()
    display_sidebar()

    st.title(f"{APP_ICON} {APP_TITLE}")
    st.caption("Gemini Function Calling + Streamlit")

    if not st.session_state.messages:
        with st.chat_message("assistant"):
            st.markdown(WELCOME_MESSAGE)

    display_chat_history()

    if prompt := st.chat_input("여행 중인 도시나 필요한 정보를 입력하세요"):  # st.chat_input: 채팅창 하단 입력란을 렌더링하고 입력값을 반환함 / := 는 조건 검사와 동시에 변수에 값을 할당함
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            with st.spinner("함수 호출이 필요한지 판단하고 여행 정보를 조회하는 중..."):
                try:
                    answer, logs = generate_response(prompt)
                    st.session_state.function_logs = logs
                except Exception as exc:
                    answer = f"오류가 발생함: {exc}"
                    st.session_state.function_logs = []

            st.markdown(answer)

        st.session_state.messages.append({"role": "assistant", "content": answer})


if __name__ == "__main__":  # 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
    main()`,
    },

    // ===== common/llm.py (LLM 헬퍼) =====
    {
      id: "load_hands_on_env",
      name: "load_hands_on_env()",
      fileId: "llm",
      summary: "공통 비밀 설정 파일(hands-on/.env)을 읽어, API 키 같은 값을 프로그램이 쓸 수 있게 함.",
      how: "API 키처럼 외부에 노출되면 안 되는 값은 코드에 직접 쓰지 않고 .env 파일에 따로 보관함. load_dotenv가 그 파일을 읽어 환경변수로 올려줌. 모든 예제가 같은 .env를 공유하도록 경로를 고정함.",
      terms: ["load_dotenv", "환경변수(.env)", "API 키", "Path(__file__)"],
      lines: [
        { at: 'HANDS_ON_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"', text: "이 파일(common/llm.py)의 위치에서 두 단계 위로 올라가 hands-on/.env 경로를 구함." },
        { at: 'load_dotenv(HANDS_ON_ENV_PATH)', text: "load_dotenv가 .env 파일의 KEY=값들을 읽어 환경변수로 등록함." },
      ],
      code:
`# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
HANDS_ON_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


def load_hands_on_env() -> Path:
    """hands-on/.env를 로드하여 모든 예제가 공통 키 파일을 공유하도록 함."""
    # .env 파일에서 API 키 등 환경변수를 로드함
    load_dotenv(HANDS_ON_ENV_PATH)
    return HANDS_ON_ENV_PATH`,
    },
    {
      id: "create_gemini_client",
      name: "create_gemini_client()",
      fileId: "llm",
      summary: "GEMINI_API_KEY를 읽어 Google Gen AI 클라이언트를 만들어 반환함.",
      how: "require_api_key()로 키를 확인한 뒤 genai.Client를 만듦. 다른 모델(OpenAI, Claude) 클라이언트도 같은 패턴으로 만들어져 있어, 모델이 바뀌어도 코드 구조가 동일함.",
      terms: ["API 키", "require_api_key", "지연 생성(lazy)"],
      lines: [
        { at: 'from google import genai', text: "Google Gen AI SDK를 함수 안에서 import함. 이 예제에서만 필요하므로 전역 import 대신 함수 내 지연 import함." },
        { at: 'return genai.Client(api_key=require_api_key("GEMINI_API_KEY"))', text: "require_api_key()로 키를 읽어 클라이언트를 만듦. 키가 없으면 require_api_key가 즉시 오류를 냄." },
      ],
      code:
`def create_gemini_client():
    """Google Gen AI 클라이언트를 지연 생성하여 반환. 모델 간 의존성 충돌 방지."""
    from google import genai

    return genai.Client(api_key=require_api_key("GEMINI_API_KEY"))`,
    },
    {
      id: "call_gemini_content",
      name: "call_gemini_content(client, *, model, contents, tools, system)",
      fileId: "llm",
      summary: "Gemini generate_content API를 도구 목록과 시스템 지침을 포함해 호출하고 응답을 반환함.",
      how: "generate_response()에서 반복 호출하는 Gemini API 요청 함수임. GenerateContentConfig에 tools(함수 선언)와 system_instruction(지침서)을 담아 요청함. 이 설정이 있어야 Gemini가 어떤 함수를 쓸 수 있는지 알고, 어떻게 행동할지 기준을 잡음.",
      terms: ["GenerateContentConfig", "system_instruction", "FunctionDeclaration"],
      lines: [
        { at: 'from google.genai import types', text: "Gemini types 모듈을 함수 내에서 지연 import함." },
        { at: 'config=types.GenerateContentConfig(', text: "GenerateContentConfig에 도구 목록과 시스템 지침을 담아 요청함. 이 설정으로 Gemini가 함수 호출 여부와 행동 방식을 결정함." },
      ],
      code:
`def call_gemini_content(client: Any, *, model: str, contents: list, tools: list, system: str):
    """Gemini generate_content API를 함수 선언(tool) 포함하여 호출하고 응답 반환."""
    from google.genai import types

    return client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            tools=tools,
            system_instruction=system,
        ),
    )`,
    },

    // ===== common/prompts.py (프롬프트 + 도구 스키마) =====
    {
      id: "SYSTEM_PROMPT",
      name: "SYSTEM_PROMPT (상수)",
      fileId: "prompts",
      summary: "AI에게 '너는 여행 플래너야, 이렇게 행동해'라고 알려주는 지침서(시스템 프롬프트) 글임.",
      how: "코드가 아니라 'AI에게 주는 규칙을 적은 긴 문장'임. 요청 유형 판단법, 도시명 영문 변환 규칙, 날씨에 따른 추천 기준, 장소 표기 형식 등을 자연어로 적어 둠. call_gemini_content()에 system 인자로 전달해 매 대화에 적용함.",
      terms: ["SystemMessage", "Function Calling"],
      lines: [
        { at: 'DEFAULT_MAX_RESULTS = 8', text: "DEFAULT_MAX_RESULTS = 8: 검색 결과 기본 개수. 도구들이 이 값을 기본값으로 사용함." },
        { at: 'SYSTEM_PROMPT = """', text: "이 따옴표 세 개로 둘러싼 긴 글 전체가 AI에게 주는 지침임." },
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
    {
      id: "TOOL_DEFINITIONS",
      name: "TOOL_DEFINITIONS + get_gemini_tools()",
      fileId: "prompts",
      summary: "Gemini에게 '사용 가능한 함수들'을 알려주는 도구 스키마 정의와 변환 함수.",
      how: "TOOL_DEFINITIONS는 함수명·설명·파라미터를 JSON Schema 형식으로 기술한 목록임. get_gemini_tools()가 이것을 FunctionDeclaration으로 변환해 Gemini에 넘김. Gemini는 이 설명을 보고 언제 어떤 함수를 호출할지 스스로 판단함. @tool 데코레이터 방식(LangChain)과 달리, 여기서는 딕셔너리로 명시적으로 정의함.",
      terms: ["TOOL_DEFINITIONS", "FunctionDeclaration", "JSON Schema", "get_gemini_tools"],
      lines: [
        { at: 'TOOL_DEFINITIONS = [', text: "세 가지 함수(날씨·관광지·맛집)의 이름·설명·파라미터를 JSON Schema 형식으로 정의한 목록임." },
        { at: '"name": "get_weather"', text: "get_weather 도구: 도시 현재 날씨를 조회함. 도시명(city)을 영문으로 받음." },
        { at: '"name": "get_tourist_attractions"', text: "get_tourist_attractions 도구: 도시 관광지를 검색함." },
        { at: '"name": "get_restaurants"', text: "get_restaurants 도구: 도시 맛집을 검색함. meal_type·keyword는 선택 인자임." },
        { at: 'def get_gemini_tools():', text: "TOOL_DEFINITIONS를 Gemini SDK의 FunctionDeclaration으로 변환해 반환함." },
        { at: 'types.FunctionDeclaration(', text: "FunctionDeclaration은 Gemini가 인식하는 도구 등록 객체임. 함수명·설명·파라미터 스키마를 담음." },
        { at: 'return [types.Tool(function_declarations=declarations)]', text: "선언들을 Tool 객체로 묶어 반환함. call_gemini_content의 tools 인자로 전달됨." },
      ],
      code:
`# OpenAI/Claude/Gemini Function Calling에서 공통으로 사용하는 도구 스키마 정의
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


def get_gemini_tools():
    """공통 도구 정의를 Google Gen AI FunctionDeclaration 형식으로 변환하여 반환."""
    from google.genai import types

    declarations = [
        types.FunctionDeclaration(
            name=tool["name"],
            description=tool["description"],
            parameters_json_schema=tool["parameters"],
        )
        for tool in TOOL_DEFINITIONS
    ]
    return [types.Tool(function_declarations=declarations)]`,
    },

    // ===== common/tools.py (도구 구현) =====
    {
      id: "normalize_city_name",
      name: "normalize_city_name(city)",
      fileId: "tools",
      summary: "'서울', '도쿄' 같은 한글 도시명을 외부 API가 알아듣는 영문('Seoul', 'Tokyo')으로 바꿈.",
      how: "날씨·지도 API는 영문 도시명을 받음. 미리 만들어 둔 표(CITY_NAME_MAP)에서 한글을 찾아 영문으로 바꿔줌. 표에 없으면 입력을 그대로 돌려줌.",
      terms: ["딕셔너리(dict)", ".get()", "타입 힌트"],
      lines: [
        { at: 'cleaned = (city or "").strip()', text: "(city or \"\")는 city가 None이면 빈 문자열을 쓰는 안전장치임. .strip()으로 앞뒤 공백을 제거함." },
        { at: 'if cleaned in CITY_NAME_MAP:', text: "정리한 도시명이 표(CITY_NAME_MAP)에 있는지 확인함." },
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
      how: "AI가 한글로 링크를 만들지 않도록, 코드가 직접 정확한 구글 지도 URL을 만들어 결과에 넣어줌. quote_plus는 공백·특수문자를 URL에 안전한 형태로 바꿔줌.",
      terms: ["quote_plus", "f-string"],
      lines: [
        { at: 'city_en = normalize_city_name(city)', text: "도시명을 먼저 영문으로 변환함." },
        { at: 'query = quote_plus(', text: "quote_plus는 공백을 +로 바꾸는 등, 글자를 URL에 안전하게 넣을 수 있게 인코딩함." },
        { at: 'return f"https://www.google.com/maps', text: "f-string으로 구글 지도 검색 URL을 조립해 반환함." },
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
        { at: 'response = requests.request(', text: "requests.request가 실제로 인터넷에 요청을 보냄. timeout=12로 너무 오래 기다리지 않게 함." },
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
        { at: 'display_name = place.get(', text: ".get(\"displayName\", {})는 'displayName이 없으면 빈 딕셔너리를 쓰라'는 안전한 꺼내기임. 연달아 .get으로 더 깊은 값을 꺼냄." },
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
      how: "관광지·맛집 도구가 공통으로 쓰는 검색 엔진임. API 키가 없으면 즉시 명확한 오류를 냄. 요청 헤더에 키와 'FieldMask'(어떤 항목을 받을지 지정)를 넣고, _request_json으로 호출한 뒤 각 결과를 _compact_place로 정리함.",
      terms: ["RuntimeError", "FieldMask", "JSON", "리스트 컴프리헨션", "타입 힌트"],
      lines: [
        { at: 'if not GOOGLE_PLACES_API_KEY:', text: "API 키가 없으면 RuntimeError로 즉시 멈춰, 원인을 분명히 알려줌." },
        { at: '"X-Goog-FieldMask":', text: "X-Goog-FieldMask는 '응답에서 이 항목들만 보내달라'고 구글에 지정하는 것(불필요한 데이터·비용 절감)." },
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
      name: "get_weather(city)",
      fileId: "tools",
      summary: "도시의 현재 날씨를 조회하는 함수. Gemini가 날씨 관련 요청에 이 함수를 자동 선택해 호출함.",
      how: "TOOL_DEFINITIONS의 get_weather 스키마에 맞춰 정의된 함수임. @tool 데코레이터 없이 일반 함수로 만들어져 있고, execute_function이 화이트리스트로 실행함. OpenWeatherMap API를 호출해 기온·체감·습도·바람 등을 정리해 돌려줌. 오류가 나도 멈추지 않고 error 항목을 담아 반환함.",
      terms: ["환경변수(.env)", "API 키", "예외 처리(try/except)", "딕셔너리(dict)", ".get()"],
      lines: [
        { at: 'if not OPENWEATHER_API_KEY:', text: "날씨 API 키가 없으면, 멈추지 않고 error 메시지를 담은 결과를 돌려줌." },
        { at: 'city_en = normalize_city_name(city)', text: "도시명을 영문으로 변환해 API에 전달함." },
        { at: 'data = _request_json(', text: "_request_json으로 OpenWeatherMap API를 호출해 날씨 데이터를 받음." },
        { at: 'weather = data.get("weather", [{}])[0]', text: "응답에서 날씨 항목을 .get()으로 안전하게 꺼냄. 없으면 빈 딕셔너리를 씀." },
        { at: 'except requests.exceptions.HTTPError as exc:', text: "통신 오류가 나도 앱이 죽지 않게, error 항목을 담아 정상 반환함." },
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
      how: "max_results=DEFAULT_MAX_RESULTS처럼 기본값이 있는 인자를 써서, Gemini가 개수를 안 정해도 기본값(8개)으로 동작함. 내부적으로 _search_places를 호출함.",
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
      summary: "도시의 맛집을 검색하는 함수. 아침/점심/저녁(meal_type)이나 키워드로 좁혀 찾을 수 있음.",
      how: "meal_type·keyword는 None이 기본값인 선택 인자라, Gemini가 상황에 따라 일부만 채워 호출할 수 있음. 채워진 값들만 모아 검색어를 조립한 뒤 _search_places로 검색함.",
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
      summary: "Gemini가 호출을 요청한 함수를 '허용 목록(화이트리스트)'에 있는 것만 안전하게 실행하는 관문 함수.",
      how: "Gemini가 '이 함수를 이런 인자로 실행해줘'라고 요청하면, 이 함수가 먼저 이름이 허용 목록에 있는지 확인함. 없는 이름이면 오류를 반환해 임의 함수 실행을 막음(보안). 있는 이름이면 인자를 정리(도시명 영문 변환 포함)해 실제 함수를 호출함.",
      terms: ["화이트리스트", "딕셔너리(dict)", "예외 처리(try/except)", "타입 힌트"],
      lines: [
        { at: 'available_functions = {', text: "허용된 함수들을 '이름: 함수객체' 딕셔너리로 만들어 화이트리스트를 구성함." },
        { at: 'if function_name not in available_functions:', text: "요청된 함수 이름이 허용 목록에 없으면 즉시 오류를 반환함(보안 관문)." },
        { at: 'safe_arguments = dict(arguments or {})', text: "인자를 복사해 안전하게 처리함. None이면 빈 딕셔너리를 씀." },
        { at: 'if "city" in safe_arguments:', text: "도시명 인자가 있으면 영문으로 한 번 더 정규화함. Gemini가 한글로 넘기는 경우를 대비함." },
        { at: 'return available_functions[function_name](**safe_arguments)', text: "화이트리스트에서 함수를 찾아 인자를 풀어서(**) 호출하고 결과를 반환함." },
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

    // ===== common/ui_text.py (화면 문구) =====
    {
      id: "ui_text_constants",
      name: "UI 텍스트 상수 (APP_TITLE 등)",
      fileId: "uitext",
      summary: "화면에 표시할 제목·아이콘·환영 인사·사용 안내 같은 '문구'들을 한곳에 모아 둔 파일.",
      how: "코드 곳곳에 문구를 흩어 두면 수정이 번거로움. 자주 바뀌는 안내 문구를 상수(대문자 이름)로 모아두면 한 곳만 고쳐도 전체에 반영됨. 함수는 없고 문자열 상수들만 있는 파일임.",
      terms: [],
      lines: [
        { at: 'APP_TITLE = "여행 플래너"', text: "APP_TITLE: 화면 상단에 표시할 앱 제목." },
        { at: 'WELCOME_MESSAGE = """', text: "WELCOME_MESSAGE: 처음 화면에 보여줄 환영 인사 글(삼중 따옴표로 여러 줄 작성)." },
        { at: 'USAGE_GUIDE = """', text: "USAGE_GUIDE: 왼쪽 사이드바에 보여줄 사용 예시 안내." },
        { at: 'TECH_GUIDE = """', text: "TECH_GUIDE: 수동 Function Calling 핵심 흐름을 간단히 정리한 기술 안내." },
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
    "st.spinner": "처리 중임을 알리는 '로딩' 표시를 보여주는 기능. with st.spinner(...): 블록 안의 코드가 실행되는 동안 화면에 안내 문구를 보여줌.",
    "st.sidebar": "화면 왼쪽의 보조 패널. with st.sidebar 블록 안에서 출력한 것은 모두 왼쪽에 표시됨.",
    "st.code": "코드 블록 형식으로 고정폭 글자를 화면에 표시하는 기능. 함수 호출 기록 표시에 씀.",
    "st.set_page_config": "Streamlit 앱의 브라우저 탭 제목·아이콘·레이아웃을 설정하는 함수. 코드 맨 처음에 한 번만 호출해야 함.",
    "Function Calling": "AI 모델이 '이 함수를 이런 값으로 실행해줘'라고 요청하는 기능. 모델이 직접 함수를 실행하는 게 아니라, 요청만 하면 코드가 실제로 실행하고 결과를 돌려줌.",
    "수동 루프": "라이브러리가 자동으로 처리하지 않고, 개발자가 직접 for 반복문으로 '함수 호출 감지 → 실행 → 결과 전달'을 반복하는 방식.",
    "function_calls": "Gemini 응답에서 AI가 요청한 함수 호출 목록. 이 목록이 비어 있으면 AI가 최종 답변을 준 것임.",
    "execute_function": "Gemini가 요청한 함수를 화이트리스트 방식으로 안전하게 실행하는 관문 함수. 허용되지 않은 함수 이름은 거부함.",
    "Part.from_function_response": "함수 실행 결과를 Gemini가 이해하는 형식(Part 객체)으로 감싸는 메서드. 이 형식으로 줘야 Gemini가 결과를 인식함.",
    "role='tool'": "함수 실행 결과를 Gemini에 돌려줄 때 사용하는 역할 이름. 반드시 'tool'로 줘야 Gemini가 올바르게 처리함(role='user'로 주면 응답이 멈출 수 있음).",
    "types.Content": "Gemini SDK의 대화 메시지 객체. role(발화자)과 parts(내용)로 구성됨.",
    "types.Part": "Content 안의 내용 조각. 텍스트(from_text), 함수 응답(from_function_response) 등 다양한 형식을 지원함.",
    "TOOL_DEFINITIONS": "Gemini에게 사용 가능한 함수들을 알려주는 스키마 목록. 함수명·설명·파라미터를 JSON Schema 형식으로 기술함.",
    "FunctionDeclaration": "Gemini SDK에서 AI가 호출할 수 있는 함수를 선언하는 객체. 이름·설명·파라미터 스키마를 담음.",
    "GenerateContentConfig": "Gemini API 요청에 도구 목록·시스템 지침 등 추가 설정을 담는 구성 객체.",
    "system_instruction": "Gemini에게 역할과 행동 규칙을 알려주는 지침 문자열. call_gemini_content의 system 인자로 전달됨.",
    "call_gemini_content": "Gemini generate_content API를 도구 목록과 시스템 지침을 포함해 호출하는 헬퍼 함수. generate_response에서 반복 호출함.",
    "화이트리스트": "허용된 것들만 목록으로 적어두고, 그 목록에 있는 것만 실행하는 보안 방식. 임의 함수가 실행되는 것을 막음.",
    "지연 생성(lazy)": "필요해질 때까지 만들지 않고 미뤘다가, 처음 쓸 때 한 번만 만드는 방식. 불필요한 작업과 비용을 줄임.",
    "캐싱(cache)": "한 번 만든 결과를 저장해 두고, 다음에 또 필요하면 다시 만들지 않고 저장본을 재사용하는 것.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env라는 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(날씨·지도·Gemini 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "require_api_key": "환경변수에서 API 키를 읽고, 없으면 즉시 RuntimeError로 오류를 내는 안전장치 함수. 시작 시점에 키를 확인해 빠르게 문제를 찾게 함.",
    "requests": "파이썬에서 인터넷 주소로 요청을 보내고 응답을 받는 대표적인 라이브러리(HTTP 통신 도구).",
    "raise_for_status()": "인터넷 응답이 실패(예: 404 없음, 500 서버오류)면 오류를 발생시키는 점검 장치. 잘못된 응답을 그냥 쓰지 않게 함.",
    "JSON": "데이터를 주고받는 표준 글자 형식. {\"key\": \"value\"} 모양으로, 파이썬 딕셔너리와 거의 똑같이 생김.",
    "JSON Schema": "JSON 데이터의 구조(어떤 항목이 있어야 하고, 어떤 타입인지)를 기술하는 표준 형식. TOOL_DEFINITIONS의 parameters 정의에 사용됨.",
    "RuntimeError": "'실행 중 문제가 생겼다'고 알리는 오류의 한 종류. API 키가 없을 때 일부러 발생시켜 원인을 알려줌.",
    "FieldMask": "API에 '응답에서 이 항목들만 보내줘'라고 지정하는 것. 불필요한 데이터 전송과 비용을 줄임.",
    "quote_plus": "글자를 URL 주소에 안전하게 넣을 수 있는 형태로 바꿔주는 함수(공백을 +로 바꾸는 등).",
    "sys.path.insert": "파이썬이 모듈을 검색하는 경로 목록 맨 앞에 폴더를 추가하는 방법. 이래야 common/ 같은 로컬 폴더의 모듈을 import할 수 있음.",
    "Path(__file__)": "지금 이 파이썬 파일의 경로를 나타냄. .resolve().parent를 붙이면 이 파일이 든 폴더의 절대경로가 됨.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"도시\": \"서울\"}처럼 이름표를 붙여 값을 저장함.",
    "리스트(list)": "여러 값을 순서대로 담는 목록. [\"a\", \"b\"]처럼 대괄호로 표현함.",
    "리스트 컴프리헨션": "[표현식 for 항목 in 목록 if 조건] 형태로, 반복문을 한 줄로 짧게 써서 새 목록을 만드는 파이썬 문법.",
    ".get()": "딕셔너리에서 값을 '안전하게' 꺼내는 방법. 열쇠가 없어도 오류를 내지 않고, 정해둔 기본값을 돌려줌.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "타입 힌트": "변수나 함수에 '이건 문자열(str)이야, 결과는 목록(list)이야'처럼 자료의 종류를 적어두는 표시. 실행에 꼭 필요하진 않지만, 코드를 읽고 점검하기 쉽게 함.",
    ":= (바다코끼리)": "값을 변수에 '담으면서 동시에' 그 값을 검사하는 연산자. 모양이 바다코끼리 눈·엄니를 닮아 붙은 별명. 예: if (prompt := 입력값): 은 입력을 prompt에 담고 비었는지 바로 확인함.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
    "SystemMessage": "AI에게 역할과 규칙을 알려주는 '지침' 메시지. LangChain 계열에서 쓰는 객체이며, Gemini 예제에서는 system_instruction 인자로 같은 역할을 수행함.",
    "get_gemini_tools": "TOOL_DEFINITIONS를 Gemini SDK의 FunctionDeclaration으로 변환해 반환하는 함수. Gemini에게 사용 가능한 함수 목록을 알려주는 역할을 함.",
  },
};
