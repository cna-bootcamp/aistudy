"""
Gemini Function Calling 여행 플래너 예제.

사용자가 여행 중인 도시를 입력하면 Gemini가 요청 유형을 판단하고,
필요한 외부 API 도구를 함수 호출로 실행한 뒤 Streamlit 웹채팅으로 답변함.

학습 포인트:
- Google Gen AI SDK의 FunctionDeclaration 기반 도구 등록
- response.function_calls 감지 후 로컬 함수 실행
- types.Part.from_function_response로 함수 결과 생성
- Gemini Function Response 전달 시 role="tool" 사용
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import sys
from pathlib import Path
from typing import Any

import streamlit as st
from google.genai import types


# ---------------------------------------------------------------------------
# 공통 모듈 import 경로 설정
# ---------------------------------------------------------------------------
# 이 예제는 hands-on/08.function-call/common 모듈을 그대로 재사용함.
# common/tools.py 내부 import가 "from prompts import ..." 형태이므로,
# common 디렉터리 자체를 sys.path에 추가해야 함.
CURRENT_DIR = Path(__file__).resolve().parent  # 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
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
)


def initialize_session_state() -> None:
    """Streamlit 재실행 사이에 유지할 채팅 상태와 Gemini 클라이언트 저장소 초기화."""
    if "messages" not in st.session_state:  # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
        st.session_state.messages = []
    if "gemini_client" not in st.session_state:
        st.session_state.gemini_client = None
    if "function_logs" not in st.session_state:
        st.session_state.function_logs = []


def get_client():
    """hands-on/.env의 GEMINI_API_KEY를 사용하여 Gemini 클라이언트를 지연 생성."""
    if st.session_state.gemini_client is None:
        # 공통 LLM 모듈이 hands-on/.env 경로를 알고 있으므로, 예제별 env 중복 로드를 피함.
        load_hands_on_env()
        st.session_state.gemini_client = create_gemini_client()
    return st.session_state.gemini_client


def build_contents(user_input: str) -> list[types.Content]:
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
    return contents


def response_text(response: Any) -> str:
    """Gemini 응답에서 안전하게 텍스트 추출."""
    return response.text or "응답을 생성할 수 없습니다."


def run_function_calls(response: Any, contents: list[types.Content]) -> list[dict[str, Any]]:
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
    return logs


def generate_response(user_input: str) -> tuple[str, list[dict[str, Any]]]:
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
    )


def display_chat_history() -> None:
    """저장된 대화 이력을 Streamlit 채팅 메시지로 렌더링."""
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])


def display_sidebar() -> None:
    """사용 예시와 실행 상태를 사이드바에 표시."""
    with st.sidebar:
        st.header("사용 방법")
        st.markdown(USAGE_GUIDE)
        st.divider()
        st.header("핵심 흐름")
        st.markdown(TECH_GUIDE)
        st.divider()
        st.caption(f"Model: `{MODEL_NAME}`")

        if st.session_state.function_logs:
            st.subheader("최근 함수 호출")
            for log in st.session_state.function_logs[-8:]:
                status = "오류" if log["has_error"] else "성공"
                st.code(f"{log['name']}({log['args']}) -> {status}", language="text")

        if st.button("대화 초기화", use_container_width=True):
            st.session_state.messages = []
            st.session_state.function_logs = []
            st.rerun()


def main() -> None:
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
    main()
