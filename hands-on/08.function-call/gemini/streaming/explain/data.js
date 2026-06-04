/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../08.function-call/gemini/streaming/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "여행 플래너 (Gemini + Streaming) 예제 설명",
    entry: "travel_planner.py",
  },

  files: [
    { id: "main",    label: "travel_planner.py",         role: "메인 파일 · 스트리밍 대화 흐름 지휘" },
    { id: "tools",   label: "common/tools.py",            role: "외부 API 도구 구현 · LLM이 호출하는 함수들" },
    { id: "prompts", label: "common/prompts.py",          role: "시스템 프롬프트 · 도구 스키마 정의" },
    { id: "llm",     label: "common/llm.py",              role: "Gemini 클라이언트 생성 · API 키 도우미" },
    { id: "uitext",  label: "common/ui_text.py",          role: "화면에 표시할 안내 문구 모음" },
  ],

  flow: [
    { step: 1, title: "앱 시작", label: "앱 시작", refs: ["module_setup"],
      summary: "파일 맨 위 모듈 설정 코드가 실행되어 화면 구성(set_page_config)을 완료함",
      detail: "프로그램의 '준비 단계'임. 공통 모듈(common/) 경로를 sys.path에 등록하고 Gemini·도구·UI 관련 모듈을 불러옴. st.set_page_config로 브라우저 탭 제목·아이콘·레이아웃을 한 번에 설정함. 이 구성은 앱 실행 시 가장 먼저, 단 한 번 실행됨." },
    { step: 2, title: "상태 초기화·화면 구성", label: "상태 초기화·화면", refs: ["initialize_session_state","display_sidebar"],
      summary: "initialize_session_state()로 저장 공간 준비, display_sidebar()로 왼쪽 패널 구성",
      detail: "식당으로 비유하면 가게 문을 열고 메뉴판을 세팅하는 단계임. initialize_session_state()가 대화·클라이언트·함수 로그를 담을 빈 저장소를 만듦. display_sidebar()는 왼쪽에 사용법·모델명·함수 호출 기록·초기화 버튼을 그림." },
    { step: 3, title: "사용자 입력 대기", label: "사용자 입력 대기",
      summary: "화면 하단 채팅창(st.chat_input)에서 '서울', '도쿄 날씨' 같은 입력을 기다림",
      detail: "손님의 주문을 기다리는 단계임. 사용자가 도시명이나 질문을 입력하고 Enter를 누르면 다음 단계로 넘어감. 입력이 없으면 여기서 계속 대기함." },
    { step: 4, title: "입력 저장·표시", label: "입력 저장·표시",
      summary: "입력한 문장을 대화 기록에 추가하고 사용자 말풍선으로 화면에 보여줌",
      detail: "주문서를 받아 적고 '확인됐습니다'라고 보여주는 단계임. 입력은 messages 목록에 저장되어 다음 대화에서도 맥락으로 활용됨." },
    { step: 5, title: "Contents 변환", label: "Contents 변환", refs: ["build_contents"],
      summary: "build_contents()가 채팅 이력과 새 입력을 Gemini가 이해하는 Content 배열로 변환함",
      detail: "AI가 알아듣는 형식으로 주문서를 정리하는 단계임. 최근 10개 대화를 Gemini Content 객체(role+parts 구조)로 변환하고 새 입력을 맨 뒤에 추가함. Gemini는 AI 역할을 'assistant'가 아닌 'model'로 표현함에 주의." },
    { step: 6, title: "스트리밍 제너레이터 시작", label: "스트리밍 시작", refs: ["stream_response"],
      summary: "stream_response()가 generate_content_stream()으로 청크 단위 응답을 받기 시작함",
      detail: "주방에서 요리를 시작하는 단계임. generate_content_stream()은 응답이 완성되기 전에 만들어지는 조각(청크)을 순서대로 보내줌. st.write_stream()이 이 제너레이터를 받아 화면에 실시간으로 글자를 그려줌." },
    { step: 7, title: "텍스트 청크 실시간 출력", label: "청크 실시간 출력", refs: ["stream_response"],
      summary: "chunk.text가 있으면 즉시 yield → st.write_stream이 화면에 실시간 렌더링",
      detail: "요리가 접시에 하나씩 나오는 단계임. Gemini가 텍스트를 생성할 때마다 chunk.text가 채워지며, yield로 내보내면 st.write_stream이 글자를 하나씩 화면에 추가함. 답이 오기까지 기다리지 않아도 됨." },
    { step: 8, title: "함수 호출 감지", label: "함수 호출 감지", refs: ["stream_response"],
      summary: "모든 청크를 순회하며 function_call 파트를 누적 수집함(빈 청크 덮어쓰기 방지)",
      detail: "주방장이 '재료가 필요하다'고 메모를 남기는 단계임. Gemini에서 텍스트 응답과 함수 호출 요청은 서로 다른 턴에 발생함. 함수 호출 턴에는 chunk.text가 없고, 대신 function_call 파트가 있음. 빈 청크가 이전 기록을 덮어쓰지 않도록 function_call이 있는 청크만 따로 누적함." },
    { step: 9, title: "함수 실행 · 결과 추가", label: "함수 실행·결과", refs: ["execute_function","stream_response"],
      summary: "execute_function()으로 날씨·관광지·맛집 API를 호출하고 결과를 role='tool' Content로 묶음",
      detail: "주방장이 직접 재료를 가져오는 단계임. execute_function이 허용된 함수만 안전하게 실행함. 결과는 role='tool' Content 하나로 묶어 대화 이력에 추가함. role='user'로 보내면 최신 SDK에서 후속 응답이 멈출 수 있어 반드시 'tool'을 써야 함." },
    { step: 10, title: "최종 답변 스트리밍", label: "최종 답변 스트리밍", refs: ["stream_response"],
      summary: "함수 결과를 받은 Gemini가 최종 답변을 다시 스트리밍으로 생성함",
      detail: "완성된 요리를 손님에게 내는 단계임. 함수 결과를 포함한 대화 이력으로 새 스트림을 시작하면, 이번엔 function_call 없이 텍스트 청크만 yield되어 화면에 실시간으로 렌더링됨." },
    { step: 11, title: "반복", label: "반복",
      summary: "사용자가 새 입력을 하면 3번 단계부터 다시 진행함",
      detail: "손님이 추가 주문을 하면 같은 과정을 반복함. 이전 대화가 messages에 남아 있어 '거기 맛집은?' 같은 이어지는 질문도 맥락을 이해함." },
  ],

  functions: [
    // ===== travel_planner.py (메인) =====
    {
      id: "module_setup",
      name: "모듈 설정 (imports·경로·set_page_config)",
      fileId: "main",
      summary: "파일 맨 위에서 공통 모듈 경로 등록, 필요한 것들 불러오기, 화면 기본 설정을 한 번에 처리함.",
      how: "함수가 아니라 '앱 시작 시 자동으로 실행되는 준비 코드'임. streaming/ 디렉터리에서 실행하므로 parent를 두 번 올라가야 08.function-call/common/에 닿음. sys.path.insert로 그 경로를 파이썬 검색 목록 맨 앞에 넣어야 import가 됨. st.set_page_config은 코드 맨 앞에서 단 한 번만 호출해야 하므로 함수 바깥에 둠.",
      terms: ["sys.path.insert", "Path(__file__)", "st.set_page_config", "Streamlit", "Generator"],
      lines: [
        { at: "from __future__ import annotations", text: "타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 하는 미래 기능 활성화 선언임." },
        { at: "CURRENT_DIR = Path(__file__).resolve().parent", text: "Path(__file__)은 '지금 이 파일'. .resolve().parent로 이 파일이 든 폴더(streaming/)의 절대경로를 구함." },
        { at: "COMMON_DIR = CURRENT_DIR.parent.parent", text: "parent를 두 번 올라가면 08.function-call/에 닿고, 거기서 common/을 붙여 공통 모듈 경로를 만듦." },
        { at: 'sys.path.insert(0, str(COMMON_DIR))', text: "파이썬이 import할 때 찾는 경로 목록(sys.path) 맨 앞에 common/ 경로를 추가함. 이래야 common/ 안의 파일을 바로 import할 수 있음." },
        { at: "st.set_page_config(", text: "브라우저 탭 제목·아이콘·레이아웃을 정함. 반드시 코드 맨 앞에서 한 번만 호출해야 하므로 함수 바깥에 둠." },
      ],
      code:
`from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import sys
from pathlib import Path
from typing import Any, Generator

import streamlit as st
from google.genai import types


# ---------------------------------------------------------------------------
# 공통 모듈 import 경로 설정
# ---------------------------------------------------------------------------
# streaming/ 하위 디렉터리에서 실행하므로 parent를 두 번 올라가야 함.
# CURRENT_DIR: gemini/streaming/
# COMMON_DIR:  08.function-call/common/
CURRENT_DIR = Path(__file__).resolve().parent  # 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
COMMON_DIR = CURRENT_DIR.parent.parent / "common"
if str(COMMON_DIR) not in sys.path:
    sys.path.insert(0, str(COMMON_DIR))  # 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 디렉터리를 추가함

from llm import create_gemini_client, load_hands_on_env  # noqa: E402
from prompts import SYSTEM_PROMPT, get_gemini_tools  # noqa: E402
from tools import execute_function  # noqa: E402
from ui_text import APP_ICON, APP_TITLE, TECH_GUIDE, USAGE_GUIDE, WELCOME_MESSAGE  # noqa: E402


MODEL_NAME = "gemini-3.5-flash"
MAX_FUNCTION_CALL_ROUNDS = 5


st.set_page_config(
    page_title=f"{APP_TITLE} - Gemini (Streaming)",
    page_icon=APP_ICON,
    layout="centered",
)`,
    },
    {
      id: "initialize_session_state",
      name: "initialize_session_state()",
      fileId: "main",
      summary: "화면을 새로 그릴 때마다 사라지지 않고 유지해야 할 데이터(대화·클라이언트·함수 로그)를 위한 빈 저장 공간을 만듦.",
      how: "Streamlit은 사용자가 무언가 누를 때마다 코드를 처음부터 다시 실행함. 그래서 일반 변수는 매번 초기화됨. st.session_state라는 특별한 저장소에 넣어두면 탭이 열려 있는 동안 값이 유지됨. '키가 없으면 만든다' 패턴으로, 이미 있으면 덮어쓰지 않고 그대로 둠.",
      terms: ["st.session_state", "Streamlit", "딕셔너리(dict)"],
      lines: [
        { at: 'if "messages" not in st.session_state:', text: "messages(대화 내용)라는 항목이 아직 없을 때만 빈 목록 []으로 만듦. 이미 있으면 건드리지 않아 기존 대화가 보존됨." },
        { at: 'if "gemini_client" not in st.session_state:', text: "gemini_client는 Gemini API와 통신하는 객체임. 처음엔 None으로 초기화하고, get_client()가 처음 호출될 때 만들어 채워줌." },
        { at: 'if "function_logs" not in st.session_state:', text: "function_logs는 '직전 대화에서 어떤 함수를 호출했는지' 기록을 담을 빈 목록임. 사이드바에 표시됨." },
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
      summary: "Gemini 클라이언트를 처음 한 번만 만들어 두고 이후에는 저장해 둔 것을 재사용함.",
      how: "클라이언트를 만드는 일은 비용이 들기 때문에, 매번 만들지 않고 처음 한 번만 만들어 st.session_state.gemini_client에 보관함(지연 생성 + 캐싱). None일 때만 create_gemini_client()를 호출하고, 이미 있으면 그대로 반환함.",
      terms: ["지연 생성(lazy)", "캐싱(cache)", "Gemini 클라이언트"],
      lines: [
        { at: "if st.session_state.gemini_client is None:", text: "클라이언트가 아직 없을(None) 때만 새로 만듦. 이미 있으면 이 블록을 건너뛰고 저장된 것을 재사용함(캐싱)." },
        { at: "load_hands_on_env()", text: "hands-on/.env 파일에서 API 키를 읽어 환경변수로 올림." },
        { at: "st.session_state.gemini_client = create_gemini_client()", text: "GEMINI_API_KEY로 Gemini 클라이언트를 생성해 저장함. 이후 호출부터는 이 줄을 건너뜀." },
      ],
      code:
`def get_client() -> Any:
    """hands-on/.env의 GEMINI_API_KEY를 사용하여 Gemini 클라이언트를 지연 생성."""
    if st.session_state.gemini_client is None:
        load_hands_on_env()
        st.session_state.gemini_client = create_gemini_client()
    return st.session_state.gemini_client`,
    },
    {
      id: "build_contents",
      name: "build_contents(user_input)",
      fileId: "main",
      summary: "화면에 쌓인 대화와 새 입력을, Gemini가 알아듣는 Content 배열로 변환함.",
      how: "Gemini는 대화를 Content(역할+parts) 객체의 목록으로 받음. Streamlit 대화 기록의 role='assistant'를 Gemini 방식인 role='model'로 바꿔야 함. 비용 절약을 위해 최근 10개만 포함하고 새 입력을 맨 뒤에 추가함.",
      terms: ["types.Content", "types.Part", "리스트(list)", "타입 힌트"],
      lines: [
        { at: "contents: list[types.Content] = []", text: "빈 Content 목록을 만듦. list[types.Content]는 '각 원소가 Content 타입인 목록'이라는 타입 힌트임." },
        { at: 'role = "model" if message["role"] == "assistant"', text: "Streamlit은 AI 역할을 'assistant'로, Gemini는 'model'로 표현함. 여기서 변환해 줌." },
        { at: "for message in st.session_state.messages[-10:]:", text: "[-10:]는 '뒤에서 10개만' 잘라오는 파이썬 문법임. 대화가 길어질수록 비용이 늘기 때문에 최근 것만 보냄." },
        { at: 'parts=[types.Part.from_text(text=message["content"])]', text: "types.Part.from_text()는 문자열을 Gemini가 이해하는 'Part 객체'로 바꿔줌." },
      ],
      code:
`def build_contents(user_input: str) -> list[types.Content]:
    """Streamlit 채팅 이력을 Gemini generate_content_stream이 이해하는 Content 배열로 변환."""
    contents: list[types.Content] = []
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
      id: "stream_response",
      name: "stream_response(user_input)",
      fileId: "main",
      summary: "텍스트 청크를 실시간으로 yield하면서, 필요하면 내부에서 함수를 호출하고 최종 답변을 스트리밍으로 이어 반환하는 제너레이터 함수.",
      how: "이 함수는 '제너레이터'임. return 대신 yield를 써서 값을 하나씩 내보냄. st.write_stream()이 이 제너레이터에서 청크를 받아 화면에 실시간으로 그려줌. Gemini 특성상 텍스트 응답과 함수 호출 요청은 서로 다른 턴에 발생함. 함수 호출 턴에는 chunk.text가 없고 function_call 파트만 있음. 루프(for _ in range)로 최대 5번까지 '함수 실행 → 새 스트림' 과정을 반복함.",
      terms: ["Generator", "yield", "generate_content_stream", "chunk.text", "st.write_stream", "function_call", "types.Content", "role='tool'", "예외 처리(try/except)", "MAX_FUNCTION_CALL_ROUNDS"],
      lines: [
        { at: "tools = get_gemini_tools()", text: "Gemini에 전달할 도구 목록(FunctionDeclaration 형식)을 가져옴." },
        { at: "accumulated_function_calls: list[Any] = []", text: "청크를 순회하면서 발견한 function_call을 모아두는 목록임. 빈 청크가 기록을 덮어쓰지 않도록 별도 누적함." },
        { at: "for chunk in client.models.generate_content_stream(", text: "★핵심★ generate_content_stream()은 응답을 청크 단위로 순서대로 내보내는 스트리밍 API임. 완성될 때까지 기다리지 않고 글자가 생길 때마다 받아볼 수 있음." },
        { at: "if chunk.text:", text: "chunk.text가 있으면 텍스트 청크임. yield로 즉시 내보내면 st.write_stream이 화면에 추가함." },
        { at: "if new_fcs:", text: "function_call이 있는 청크면 누적 목록에 추가하고, 이 청크의 content를 대화 이력 후보로 보존함." },
        { at: "if not accumulated_function_calls:", text: "모든 청크를 순회했는데 함수 호출이 없으면 → 답변 완료. function_logs를 저장하고 return으로 제너레이터를 끝냄." },
        { at: "if model_content_with_fc:", text: "모델의 function_call 응답을 대화 이력에 추가함. 이 뒤에 올 'tool' 결과와 연결하기 위해 반드시 먼저 추가해야 함." },
        { at: 'role="tool",', text: "★주의★ 함수 결과는 role='tool' Content로 보내야 함. role='user'로 보내면 최신 google-genai SDK에서 후속 응답이 멈출 수 있음." },
        { at: 'yield "함수 호출이 반복', text: "MAX_FUNCTION_CALL_ROUNDS(5번)를 초과해도 끝나지 않으면 안전망으로 경고 메시지를 yield하고 종료함." },
      ],
      code:
`def stream_response(user_input: str) -> Generator[str, None, None]:
    """텍스트 청크를 순서대로 yield하는 스트리밍 제너레이터.

    function_calls가 필요한 경우 내부에서 함수를 실행하고
    최종 답변을 스트리밍으로 이어서 반환함.

    핵심 흐름:
    1. generate_content_stream()으로 청크 단위 응답 수신
    2. chunk.text가 있으면 실시간 yield (텍스트 스트리밍)
    3. 모든 청크를 순회하며 function_call 파트를 누적 (빈 청크 덮어쓰기 방지)
    4. function_calls 있음: 함수 실행 후 대화 이력에 추가, 새 스트림 시작
    5. function_calls 없음: 스트리밍 완료

    Gemini 특성:
    - 텍스트 응답과 function_call 응답은 서로 다른 턴에 발생함
    - function_call 턴에는 chunk.text가 없으므로 텍스트 출력 없이 함수만 실행됨
    - 최종 텍스트 답변 턴에서 스트리밍이 시작됨
    """
    client = get_client()
    tools = get_gemini_tools()
    contents = build_contents(user_input)
    all_logs: list[dict[str, Any]] = []

    for _ in range(MAX_FUNCTION_CALL_ROUNDS):
        # function_call이 포함된 청크만 별도로 추적하여 이후 빈 청크가
        # last_candidate_content를 덮어쓰는 문제를 방지함.
        accumulated_function_calls: list[Any] = []
        model_content_with_fc = None

        # generate_content_stream()은 청크 단위 응답 이터레이터를 반환함.
        for chunk in client.models.generate_content_stream(
            model=MODEL_NAME,
            contents=contents,
            config=types.GenerateContentConfig(
                tools=tools,
                system_instruction=SYSTEM_PROMPT,
            ),
        ):
            # 텍스트 청크: 최종 답변 턴에서 실시간으로 yield됨
            if chunk.text:
                yield chunk.text

            # 모든 청크를 순회하며 function_call을 누적함.
            # function_call이 있는 청크의 content만 대화 이력 후보로 보존함.
            if chunk.candidates and chunk.candidates[0].content:
                content = chunk.candidates[0].content
                new_fcs = [
                    part.function_call
                    for part in (content.parts or [])
                    if hasattr(part, "function_call") and part.function_call
                ]
                if new_fcs:
                    accumulated_function_calls.extend(new_fcs)
                    model_content_with_fc = content

        if not accumulated_function_calls:
            st.session_state.function_logs = all_logs
            return

        # 모델의 function_call 응답을 대화 이력에 추가함.
        # 이후 tool 결과와 연결하기 위해 모델 응답을 먼저 추가해야 함.
        if model_content_with_fc:
            contents.append(model_content_with_fc)

        # 모든 function_call을 실행하고 결과를 단일 role="tool" Content로 묶어 추가함.
        # role="user"로 보내면 최신 google-genai SDK에서 후속 응답이 멈출 수 있음.
        function_response_parts: list[types.Part] = []
        for fc in accumulated_function_calls:
            function_name = fc.name
            function_args = dict(fc.args) if fc.args else {}
            result = execute_function(function_name, function_args)

            all_logs.append({
                "name": function_name,
                "args": function_args,
                "has_error": isinstance(result, dict) and "error" in result,
            })

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

    st.session_state.function_logs = all_logs
    yield "함수 호출이 반복되어 처리를 중단함. 요청을 더 구체적으로 입력해 주세요."`,
    },
    {
      id: "display_chat_history",
      name: "display_chat_history()",
      fileId: "main",
      summary: "저장된 지난 대화를 화면에 말풍선으로 다시 그려줌.",
      how: "Streamlit은 화면을 매번 새로 그리므로 이전 대화도 매번 다시 그려야 함. messages에 저장된 각 항목을 역할(user/assistant)에 맞는 말풍선으로 출력함.",
      terms: ["st.chat_message", "st.markdown", "Streamlit"],
      lines: [
        { at: "for message in st.session_state.messages:", text: "저장된 대화 하나하나를 순서대로 꺼냄." },
        { at: 'with st.chat_message(message["role"]):', text: "st.chat_message(역할)은 사람/AI 말풍선 모양을 만들어 줌. with 블록 안의 내용이 그 말풍선 안에 들어감." },
        { at: 'st.markdown(message["content"])', text: "st.markdown은 글자를 서식(굵게·목록 등)과 함께 화면에 표시함." },
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
      summary: "왼쪽 사이드바에 사용법·모델명·최근 함수 호출 기록·초기화 버튼을 표시함.",
      how: "화면 왼쪽의 보조 패널을 구성함. with st.sidebar 블록 안의 내용은 모두 왼쪽에 표시됨. '대화 초기화' 버튼을 누르면 저장된 대화와 함수 로그를 비우고 st.rerun()으로 화면을 새로 그림. 최근 8개 함수 호출을 성공/오류 상태와 함께 표시함.",
      terms: ["st.sidebar", "st.rerun", "st.code"],
      lines: [
        { at: "with st.sidebar:", text: "with st.sidebar: 이 블록 안에서 출력하는 모든 것이 왼쪽 사이드바에 표시됨." },
        { at: 'st.caption(f"Model: `{MODEL_NAME}`")', text: "현재 사용 중인 Gemini 모델명을 작은 글씨로 표시함." },
        { at: 'if st.session_state.function_logs:', text: "직전 대화에서 함수 호출이 있었으면 최근 8개를 코드 블록으로 보여줌." },
        { at: 'if st.button("대화 초기화"', text: "'대화 초기화' 버튼. 누르면 대화와 함수 기록을 모두 비우고 st.rerun()으로 즉시 화면을 새로 그림." },
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
      summary: "앱의 시작점. 화면을 세팅하고 입력을 받아, 스트리밍 답변을 생성·표시하는 전체 흐름을 지휘함.",
      how: "프로그램의 '시작 버튼'에 해당함. 상태 초기화 → 사이드바·제목·이전 대화 표시 → 채팅창 입력 처리 순으로 진행함. 사용자가 입력하면 st.write_stream으로 스트리밍 제너레이터를 연결해 실시간으로 답변을 그려줌. 오류가 나도 멈추지 않게 try/except로 감쌈.",
      terms: ["st.chat_input", "st.write_stream", ":= (바다코끼리)", "예외 처리(try/except)", "if __name__"],
      lines: [
        { at: "initialize_session_state()", text: "저장 공간 준비 → 사이드바 → 제목 → 이전 대화 순으로 화면을 구성함." },
        { at: 'if prompt := st.chat_input("여행 중인', text: "★중요 문법★ := (바다코끼리 연산자)는 '입력값을 prompt에 담으면서 동시에 비었는지 검사'함. 입력이 있을 때만 if 블록 실행." },
        { at: "answer = st.write_stream(stream_response(prompt))", text: "★핵심★ st.write_stream()은 제너레이터(stream_response)에서 청크를 받아 화면에 실시간으로 렌더링하고, 완성된 전체 텍스트를 반환함." },
        { at: "except Exception as exc:", text: "스트리밍 중 오류가 나도 앱이 죽지 않도록 try/except로 감싸 오류 메시지로 대체함." },
        { at: 'if __name__ == "__main__":', text: "이 파일을 직접 실행할 때만 main()을 호출함. 다른 파일이 import할 때는 실행 안 됨." },
      ],
      code:
`def main() -> None:
    """Streamlit 웹채팅 앱 진입점."""
    initialize_session_state()
    display_sidebar()

    st.title(f"{APP_ICON} {APP_TITLE}")
    st.caption("Gemini Function Calling + Streaming + Streamlit")

    if not st.session_state.messages:
        with st.chat_message("assistant"):
            st.markdown(WELCOME_MESSAGE)

    display_chat_history()

    if prompt := st.chat_input("여행 중인 도시나 필요한 정보를 입력하세요"):  # st.chat_input: 채팅창 하단 입력란을 렌더링하고 입력값을 반환함 / := 는 조건 검사와 동시에 변수에 값을 할당함
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            try:
                # st.write_stream()은 제너레이터에서 텍스트 청크를 받아
                # 실시간으로 화면에 렌더링하고 누적된 전체 텍스트를 반환함.
                answer = st.write_stream(stream_response(prompt))
            except Exception as exc:
                answer = f"오류가 발생함: {exc}"
                st.markdown(answer)

        st.session_state.messages.append({"role": "assistant", "content": answer})


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
        { at: 'cleaned = (city or "").strip()', text: "(city or \"\")는 'city가 비어있으면 빈 문자열을 쓰라'는 안전장치임. .strip()은 앞뒤 공백을 제거함." },
        { at: "if cleaned in CITY_NAME_MAP:", text: "정리한 도시명이 표(CITY_NAME_MAP)에 있는지 확인함. 없으면 맨 아래에서 입력을 그대로 반환함." },
        { at: "return CITY_NAME_MAP[cleaned]", text: "표에 있으면 짝이 되는 영문 도시명을 돌려줌(예: 서울 → Seoul)." },
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
        { at: "city_en = normalize_city_name(city)", text: "도시명을 먼저 영문으로 변환함." },
        { at: "query = quote_plus(", text: "quote_plus는 공백을 +로 바꾸는 등, 글자를 URL에 안전하게 넣을 수 있게 인코딩함." },
        { at: 'return f"https://www.google.com/maps/search/', text: "f-string으로 구글 지도 검색 URL을 조합해 돌려줌." },
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
      how: "여러 도구가 공통으로 쓰는 'HTTP 요청 + 결과 받기' 함수임. requests가 실제 인터넷 통신을 담당함. timeout=12는 '12초 안에 응답이 없으면 포기'라는 뜻으로 무한 대기를 방지함. raise_for_status()는 응답이 실패(404 등)면 오류를 내게 함.",
      terms: ["requests", "raise_for_status()", "JSON", "타입 힌트"],
      lines: [
        { at: "response = requests.request(method, url, timeout=12", text: "requests.request가 실제로 인터넷에 요청을 보냄. timeout=12로 너무 오래 기다리지 않게 함." },
        { at: "response.raise_for_status()", text: "응답이 실패 상태(예: 404, 500)면 여기서 오류를 발생시켜 잘못된 데이터를 쓰지 않게 함." },
        { at: "return response.json()", text: "응답 본문을 JSON으로 해석해 파이썬 딕셔너리로 돌려줌." },
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
      how: "API 응답은 항목이 많고 깊게 중첩돼 있음. 필요한 값만 .get()으로 안전하게 꺼내고 없을 때 쓸 기본값을 정해둠. 구글 지도 링크도 여기서 미리 만들어 넣어줌.",
      terms: ["딕셔너리(dict)", ".get()", "리스트 컴프리헨션", "f-string"],
      lines: [
        { at: 'display_name = place.get("displayName", {}).get("text"', text: ".get(\"displayName\", {})는 'displayName이 없으면 빈 딕셔너리를 쓰라'는 안전한 꺼내기임. 연달아 .get으로 더 깊은 값을 안전하게 꺼냄." },
        { at: 'type_hint = ", ".join(', text: "types[:2]는 앞 2개만 잘라옴. PLACE_TYPE_LABELS 표로 영문 분류를 한글 라벨로 바꿈." },
        { at: "maps_url = build_google_maps_search_url(display_name, city)", text: "장소별 구글 지도 링크를 미리 만들어 둠." },
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
      summary: "구글 장소 검색(Places) API를 호출해 정리된 장소 목록을 돌려줌.",
      how: "관광지·맛집 도구가 공통으로 쓰는 검색 엔진임. API 키가 없으면 즉시 명확한 오류를 냄. 요청 헤더에 키와 'FieldMask'(어떤 항목을 받을지 지정)를 넣고 _request_json으로 호출한 뒤 각 결과를 _compact_place로 정리함.",
      terms: ["RuntimeError", "FieldMask", "JSON", "리스트 컴프리헨션", "타입 힌트"],
      lines: [
        { at: "if not GOOGLE_PLACES_API_KEY:", text: "API 키가 없으면 RuntimeError로 즉시 멈춰 원인을 분명히 알려줌." },
        { at: '"X-Goog-FieldMask":', text: "X-Goog-FieldMask는 '응답에서 이 항목들만 보내달라'고 구글에 지정하는 것임(불필요한 데이터·비용 절감)." },
        { at: '"maxResultCount": max(1, min(max_results, 20)),', text: "maxResultCount를 1~20 사이로 강제해 과도한 요청을 막음." },
        { at: "return [_compact_place(place, city) for place in", text: "받은 장소들을 하나씩 _compact_place로 정리해 목록으로 만들어 돌려줌(리스트 컴프리헨션)." },
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
      summary: "도시의 현재 날씨를 조회하는 함수. AI가 '날씨' 관련 요청에 이 함수를 호출하도록 TOOL_DEFINITIONS에 등록됨.",
      how: "OpenWeatherMap API를 호출해 기온·체감·습도·바람 등을 정리해 돌려줌. API 키가 없으면 멈추지 않고 error 항목을 담아 반환함. 데코레이터 없이 prompts.py의 TOOL_DEFINITIONS에 이름·설명·파라미터를 JSON으로 적어 AI에게 알려줌.",
      terms: ["환경변수(.env)", "API 키", "예외 처리(try/except)", "딕셔너리(dict)", ".get()", "TOOL_DEFINITIONS"],
      lines: [
        { at: "if not OPENWEATHER_API_KEY:", text: "날씨 API 키가 없으면 멈추지 않고 error 메시지를 담은 결과를 돌려줌." },
        { at: "city_en = normalize_city_name(city)", text: "한글 도시명이 들어와도 영문으로 변환해서 API에 보냄." },
        { at: 'weather = data.get("weather", [{}])[0]', text: "응답에서 필요한 값들을 .get()으로 안전하게 꺼내 깔끔한 딕셔너리로 정리함." },
        { at: "except requests.exceptions.HTTPError as exc:", text: "통신 오류가 나도 앱이 죽지 않게 error 항목을 담아 정상적으로 반환함." },
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
      how: "AI가 관광지 정보가 필요할 때 TOOL_DEFINITIONS를 보고 이 함수를 선택함. max_results=DEFAULT_MAX_RESULTS처럼 기본값이 있어 AI가 개수를 안 정해도 기본값(8개)으로 동작함. 내부적으로 _search_places를 호출함.",
      terms: ["예외 처리(try/except)", "딕셔너리(dict)", "TOOL_DEFINITIONS"],
      lines: [
        { at: "def get_tourist_attractions(city: str, max_results: int = DEFAULT_MAX_RESULTS)", text: "max_results: int = DEFAULT_MAX_RESULTS는 '값을 안 주면 기본 8개'라는 기본값 인자임." },
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
      how: "meal_type·keyword는 'str | None = None' 즉 없어도 되는 선택 인자임. 채워진 값들만 모아 검색어를 조립한 뒤 _search_places로 검색함.",
      terms: ["리스트 컴프리헨션", "예외 처리(try/except)", "TOOL_DEFINITIONS"],
      lines: [
        { at: "meal_type: str | None = None,", text: "meal_type·keyword는 str | None = None, 즉 '있어도 되고 없어도 되는' 선택 인자임." },
        { at: "query_parts = [part for part in [meal_type, keyword", text: "값이 채워진 항목만 골라(리스트 컴프리헨션) 검색어를 조립함." },
        { at: "places = _search_places(query, city_en, max_results)", text: "조립한 검색어로 맛집을 검색함." },
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
      summary: "AI가 요청한 함수 이름과 인자를 받아, 허용된 함수만 안전하게 실행하고 결과를 돌려주는 관문.",
      how: "AI가 반환한 function_call 정보(이름·인자)를 실제 파이썬 함수 호출로 연결하는 '중간 다리'임. 화이트리스트(available_functions)에 등록된 함수만 실행 가능해, 임의 코드 실행을 막음. 도시명은 여기서 한 번 더 영문 변환해 안전성을 높임.",
      terms: ["화이트리스트", "딕셔너리(dict)", "예외 처리(try/except)", "타입 힌트"],
      lines: [
        { at: "available_functions = {", text: "허용된 함수만 담은 목록(화이트리스트). 이 목록에 없는 함수는 실행 불가." },
        { at: 'if function_name not in available_functions:', text: "요청된 함수가 목록에 없으면 오류 메시지를 담아 반환(프로그램이 멈추지 않음)." },
        { at: 'safe_arguments["city"] = normalize_city_name(', text: "도시명을 한 번 더 영문으로 변환해 API에 안전하게 전달함." },
        { at: "return available_functions[function_name](**safe_arguments)", text: "**safe_arguments는 딕셔너리를 '함수의 키워드 인자'로 펼쳐 전달하는 파이썬 문법임." },
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

    // ===== common/prompts.py (지침서·도구 스키마) =====
    {
      id: "SYSTEM_PROMPT",
      name: "SYSTEM_PROMPT · TOOL_DEFINITIONS (상수)",
      fileId: "prompts",
      summary: "AI에게 주는 지침서(시스템 프롬프트)와, AI가 호출할 수 있는 함수 목록(도구 스키마)을 한 파일에 모아 둠.",
      how: "SYSTEM_PROMPT는 코드가 아니라 'AI에게 주는 긴 규칙 문장'임. 요청 유형 판단법·도시명 영문 변환 규칙·날씨에 따른 추천 기준·장소 표기 형식 등을 자연어로 적어 둠. TOOL_DEFINITIONS는 함수를 JSON으로 설명해 AI가 '어떤 함수를', '어떤 인자로' 호출할지 판단하는 근거가 됨. 이 정의를 get_gemini_tools()가 Gemini용 형식으로 변환함.",
      terms: ["TOOL_DEFINITIONS", "JSON 스키마", "FunctionDeclaration", "SystemMessage"],
      lines: [
        { at: "DEFAULT_MAX_RESULTS = 8", text: "검색 결과 기본 개수. 도구들이 이 값을 기본값으로 사용함." },
        { at: 'SYSTEM_PROMPT = """당신은 여행 중인', text: "이 따옴표 세 개(\"\"\")로 둘러싼 긴 글 전체가 AI에게 주는 지침임." },
        { at: "TOOL_DEFINITIONS = [", text: "AI가 호출할 수 있는 함수 목록을 JSON 형식으로 정의함. 이 정의를 보고 AI가 어떤 함수를 언제 호출할지 결정함." },
        { at: '"name": "get_weather"', text: "함수 이름·설명·파라미터를 JSON으로 적어두면, AI가 이 정보를 읽고 적절한 함수를 자동 선택함." },
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
      id: "get_gemini_tools",
      name: "get_gemini_tools()",
      fileId: "prompts",
      summary: "공통 도구 정의(TOOL_DEFINITIONS)를 Gemini가 이해하는 FunctionDeclaration 형식으로 변환해 돌려줌.",
      how: "OpenAI·Claude·Gemini는 각자 도구를 설명하는 방식이 다름. 이 함수는 JSON으로 적힌 공통 정의를 Gemini SDK의 FunctionDeclaration 객체로 변환해, generate_content_stream에 넘길 수 있게 함. types.Tool로 한 번 더 감싸야 Gemini가 도구 목록으로 인식함.",
      terms: ["FunctionDeclaration", "types.Tool", "리스트 컴프리헨션"],
      lines: [
        { at: "from google.genai import types", text: "Gemini SDK의 types 모듈을 여기서 불러옴(최상단이 아닌 함수 내부에 두어 다른 모델 예제에서 불필요한 import를 막음)." },
        { at: "declarations = [", text: "TOOL_DEFINITIONS의 각 항목을 FunctionDeclaration 객체로 변환함. AI가 '이 함수를 쓸 수 있다'고 인식하는 근거가 됨." },
        { at: "return [types.Tool(function_declarations=declarations)]", text: "선언 목록을 types.Tool로 감싸 반환함. Gemini는 이 형식의 목록을 generate_content_stream의 tools 인자로 받음." },
      ],
      code:
`def get_gemini_tools():
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

    // ===== common/llm.py (LLM 클라이언트) =====
    {
      id: "load_hands_on_env",
      name: "load_hands_on_env()",
      fileId: "llm",
      summary: "공통 비밀 설정 파일(hands-on/.env)을 읽어, API 키 같은 값을 프로그램이 쓸 수 있게 함.",
      how: "API 키처럼 외부에 노출되면 안 되는 값은 코드에 직접 쓰지 않고 .env 파일에 따로 보관함. load_dotenv가 그 파일을 읽어 환경변수로 올려줌. 모든 예제가 같은 .env를 공유하도록 경로를 고정함.",
      terms: ["load_dotenv", "환경변수(.env)", "API 키", "Path(__file__)"],
      lines: [
        { at: "HANDS_ON_ENV_PATH = Path(__file__).resolve().parents[2]", text: "parents[2]는 '두 단계 위 디렉터리'. common/에서 두 단계 올라가면 hands-on/ 폴더임." },
        { at: "load_dotenv(HANDS_ON_ENV_PATH)", text: "load_dotenv가 .env 파일의 KEY=값들을 읽어 프로그램의 환경변수로 등록함." },
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
      id: "require_api_key",
      name: "require_api_key(env_name)",
      fileId: "llm",
      summary: "필요한 API 키를 읽어오고, 없으면 '키가 없다'고 분명한 오류를 내는 안전장치.",
      how: "키 없이 실행하면 한참 뒤 엉뚱한 곳에서 알 수 없는 오류가 남. 이 함수는 시작 시점에 키를 확인하고, 없으면 즉시 RuntimeError로 '어떤 키가 어디에 없는지'를 알려줘 문제를 빨리 찾게 함.",
      terms: ["환경변수(.env)", "API 키", "RuntimeError"],
      lines: [
        { at: "load_hands_on_env()", text: "먼저 .env를 읽어 환경변수를 준비함." },
        { at: 'api_key = os.getenv(env_name, "")', text: "os.getenv로 키 값을 읽음. 없으면 빈 문자열을 받음." },
        { at: "if not api_key:", text: "키가 비어 있으면 즉시 RuntimeError로 멈춰 원인을 분명히 알려줌(디버깅 쉬움)." },
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
      id: "create_gemini_client",
      name: "create_gemini_client()",
      fileId: "llm",
      summary: "GEMINI_API_KEY를 읽어 Google Gen AI 클라이언트를 만들어 돌려줌.",
      how: "Google Gen AI SDK의 genai.Client를 생성하는 함수임. google-genai 패키지는 다른 모델 예제에서 설치돼 있지 않을 수 있어, 함수 내부에서만 import해 의존성 충돌을 막음.",
      terms: ["Gemini 클라이언트", "지연 import", "API 키"],
      lines: [
        { at: "from google import genai", text: "google-genai 라이브러리를 함수 안에서만 불러옴. 다른 모델 예제에서 이 모듈이 없어도 오류가 나지 않음." },
        { at: 'return genai.Client(api_key=require_api_key("GEMINI_API_KEY"))', text: "require_api_key로 GEMINI_API_KEY를 읽어 Client를 만듦. 키가 없으면 require_api_key가 오류를 냄." },
      ],
      code:
`def create_gemini_client():
    """Google Gen AI 클라이언트를 지연 생성하여 반환. 모델 간 의존성 충돌 방지."""
    from google import genai

    return genai.Client(api_key=require_api_key("GEMINI_API_KEY"))`,
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
        { at: "APP_TITLE =", text: "APP_TITLE·APP_ICON: 화면 상단 제목과 아이콘(이모지)." },
        { at: "WELCOME_MESSAGE =", text: "WELCOME_MESSAGE: 처음 화면에 보여줄 환영 인사 글(삼중 따옴표로 여러 줄 작성)." },
        { at: "USAGE_GUIDE =", text: "USAGE_GUIDE: 왼쪽 사이드바에 보여줄 사용 예시 안내." },
        { at: "TECH_GUIDE =", text: "TECH_GUIDE: 핵심 처리 흐름을 간단히 정리한 기술 안내." },
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
    "st.code": "입력한 내용을 코드 블록(등폭 글꼴) 형태로 화면에 표시하는 기능.",
    "st.sidebar": "화면 왼쪽의 보조 패널. with st.sidebar 블록 안에서 출력한 것은 모두 왼쪽에 표시됨.",
    "st.set_page_config": "브라우저 탭 제목·아이콘·레이아웃을 정하는 Streamlit 기능. 코드 맨 처음에 한 번 호출해야 함.",
    "st.write_stream": "제너레이터(yield로 값을 내보내는 함수)에서 텍스트를 받아 화면에 실시간으로 이어 그려주는 Streamlit 기능. AI 답변이 스트리밍으로 타이핑되는 효과를 만들어 줌.",
    "Generator": "return 대신 yield를 써서 값을 하나씩 내보내는 특별한 함수. 모든 값을 한 번에 만들지 않고 필요할 때마다 하나씩 만들어 전달함. Generator[str, None, None]은 '문자열을 yield하는 제너레이터' 타입 힌트임.",
    "yield": "제너레이터 함수에서 값을 하나씩 내보내는 키워드. yield를 만나면 그 값을 내보내고 잠깐 멈췄다가, 다음 값을 요청받으면 다시 실행됨.",
    "generate_content_stream": "Gemini가 응답을 청크(조각) 단위로 순서대로 내보내는 스트리밍 API. 답이 완성되기 전에 글자가 생길 때마다 받아볼 수 있어 실시간 렌더링이 가능함.",
    "chunk.text": "스트리밍 응답의 각 청크에서 텍스트 내용을 담는 속성. 텍스트 답변 턴에는 값이 있고, 함수 호출 턴에는 None이거나 비어 있음.",
    "function_call": "AI가 '이 함수를 이런 인자로 호출해 달라'고 요청하는 데이터. Gemini 스트리밍에서는 청크의 parts 안에 들어 있음.",
    "types.Content": "Gemini SDK에서 대화 메시지 하나를 표현하는 객체. role(누가 말했는지)과 parts(내용 조각들)로 구성됨.",
    "types.Part": "Content 안에 들어가는 내용 조각. 텍스트·함수 호출·함수 결과 등 다양한 종류가 있음.",
    "role='tool'": "Gemini에서 함수 실행 결과 메시지에 붙이는 역할 표시. role='user'로 보내면 최신 SDK에서 후속 응답이 멈출 수 있어 반드시 'tool'을 써야 함.",
    "MAX_FUNCTION_CALL_ROUNDS": "함수 호출을 최대 몇 번까지 반복할지 정하는 한계값(이 예제에서는 5). AI가 무한 루프에 빠지는 것을 방지하는 안전장치.",
    "FunctionDeclaration": "Gemini SDK에서 AI가 호출할 수 있는 함수를 설명하는 객체. 함수 이름·설명·파라미터 스키마를 담아 AI에게 알려줌.",
    "types.Tool": "FunctionDeclaration 목록을 감싸 Gemini generate_content_stream에 전달하는 컨테이너 객체.",
    "TOOL_DEFINITIONS": "OpenAI·Claude·Gemini가 공통으로 사용하는 도구 스키마. JSON 형식으로 함수 이름·설명·파라미터를 정의해 두고, 각 모델 형식으로 변환하여 사용함.",
    "JSON 스키마": "함수의 파라미터 이름·타입·설명을 JSON으로 적어둔 설명서. AI가 이걸 보고 어떤 값으로 함수를 호출할지 결정함.",
    "SystemMessage": "AI에게 역할과 규칙을 알려주는 '지침' 메시지. Gemini에서는 config의 system_instruction으로 전달함.",
    "화이트리스트": "허용된 항목만 미리 적어둔 목록. 여기서는 AI가 호출할 수 있는 함수만 담아, 목록에 없는 함수는 실행 불가능하게 만드는 보안 장치임.",
    "지연 생성(lazy)": "필요해질 때까지 만들지 않고 미뤘다가, 처음 쓸 때 한 번만 만드는 방식. 불필요한 작업과 비용을 줄임.",
    "캐싱(cache)": "한 번 만든 결과를 저장해 두고, 다음에 또 필요하면 다시 만들지 않고 저장본을 재사용하는 것.",
    "Gemini 클라이언트": "Google Gen AI 서버와 통신하는 객체. genai.Client(api_key=...)로 만들고, client.models.generate_content_stream(...)으로 스트리밍 응답을 요청함.",
    "지연 import": "파일 맨 위가 아니라 함수 안에서 필요할 때만 import하는 방식. 해당 라이브러리가 없어도 다른 기능은 정상 동작함.",
    "sys.path.insert": "파이썬이 import할 때 모듈을 찾는 경로 목록(sys.path) 맨 앞에 경로를 추가함. 이래야 같은 이름의 다른 패키지보다 우선 찾음.",
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .resolve().parent를 붙이면 이 파일이 든 폴더의 절대경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    ":= (바다코끼리)": "값을 변수에 '담으면서 동시에' 그 값을 검사하는 연산자. 모양이 바다코끼리 눈·엄니를 닮아 붙은 별명. 예: if (x := 입력값): 은 입력을 x에 담고 비었는지 바로 확인함.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env라는 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(날씨·지도·Gemini 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "RuntimeError": "'실행 중 문제가 생겼다'고 알리는 오류의 한 종류. 여기서는 API 키가 없을 때 일부러 발생시켜 원인을 알려줌.",
    "requests": "파이썬에서 인터넷 주소로 요청을 보내고 응답을 받는 대표적인 라이브러리(HTTP 통신 도구).",
    "raise_for_status()": "인터넷 응답이 실패(예: 404 없음, 500 서버오류)면 오류를 발생시키는 점검 장치. 잘못된 응답을 그냥 쓰지 않게 함.",
    "JSON": "데이터를 주고받는 표준 글자 형식. {\"key\": \"value\"} 모양으로, 파이썬 딕셔너리와 거의 똑같이 생김.",
    "quote_plus": "글자를 URL 주소에 안전하게 넣을 수 있는 형태로 바꿔주는 함수(공백을 +로 바꾸는 등).",
    "FieldMask": "API에 '응답에서 이 항목들만 보내줘'라고 지정하는 것. 불필요한 데이터 전송과 비용을 줄임.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"도시\": \"서울\"}처럼 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    "리스트(list)": "여러 값을 순서대로 담는 목록. [\"a\", \"b\"]처럼 대괄호로 표현함.",
    "리스트 컴프리헨션": "[표현식 for 항목 in 목록 if 조건] 형태로, 반복문을 한 줄로 짧게 써서 새 목록을 만드는 파이썬 문법.",
    ".get()": "딕셔너리에서 값을 '안전하게' 꺼내는 방법. 열쇠가 없어도 오류를 내지 않고, 정해둔 기본값을 돌려줌.",
    "isinstance()": "어떤 값이 특정 종류(타입)인지 확인하는 함수. 예: isinstance(result, dict)는 'result가 딕셔너리인가?'를 True/False로 답함.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "타입 힌트": "변수나 함수에 '이건 문자열(str)이야, 결과는 목록(list)이야'처럼 자료의 종류를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
  },
};
