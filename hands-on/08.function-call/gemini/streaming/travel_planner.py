"""Gemini Function Calling 여행 플래너 - Streaming 버전.

기존 예제와 동일한 기능에 Streaming 출력 방식을 추가함.

학습 포인트:
- client.models.generate_content_stream()으로 스트리밍 응답 수신
- chunk.text로 텍스트 청크를 순서대로 yield
- 모든 청크를 순회하며 function_call 파트를 누적하여 확인 (빈 청크 덮어쓰기 방지)
- function_calls가 있는 턴은 내부 실행 후 새 스트림으로 최종 답변 수신
- st.write_stream()으로 Streamlit에 실시간 텍스트 렌더링
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

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
)


def initialize_session_state() -> None:
    """Streamlit 재실행 사이에 유지할 채팅 상태와 Gemini 클라이언트 저장소 초기화."""
    if "messages" not in st.session_state:  # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
        st.session_state.messages = []
    if "gemini_client" not in st.session_state:
        st.session_state.gemini_client = None
    if "function_logs" not in st.session_state:
        st.session_state.function_logs = []


def get_client() -> Any:
    """hands-on/.env의 GEMINI_API_KEY를 사용하여 Gemini 클라이언트를 지연 생성."""
    if st.session_state.gemini_client is None:
        load_hands_on_env()
        st.session_state.gemini_client = create_gemini_client()
    return st.session_state.gemini_client


def build_contents(user_input: str) -> list[types.Content]:
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
    return contents


def stream_response(user_input: str) -> Generator[str, None, None]:
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
    yield "함수 호출이 반복되어 처리를 중단함. 요청을 더 구체적으로 입력해 주세요."


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
    main()
