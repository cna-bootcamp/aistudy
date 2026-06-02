"""Claude Messages API Tool Use 여행 플래너 - Streaming 버전.

기존 예제와 동일한 기능에 Streaming 출력 방식을 추가함.

학습 포인트:
- client.messages.stream() 컨텍스트 매니저로 스트리밍 응답 수신
- stream.text_stream으로 텍스트 청크를 순서대로 yield
- stream.get_final_message()로 stop_reason 및 tool_use 블록 확인
- st.write_stream()으로 Streamlit에 실시간 텍스트 렌더링
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import json
import sys
from pathlib import Path
from typing import Any, Generator

import streamlit as st


# ---------------------------------------------------------------------------
# 공통 모듈 import 경로 설정
# ---------------------------------------------------------------------------
# streaming/ 하위 디렉터리에서 실행하므로 parent를 두 번 올라가야 함.
# CURRENT_DIR: claude/streaming/
# COMMON_DIR:  08.function-call/common/
CURRENT_DIR = Path(__file__).resolve().parent  # 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
COMMON_DIR = CURRENT_DIR.parent.parent / "common"
if str(COMMON_DIR) not in sys.path:
    sys.path.insert(0, str(COMMON_DIR))  # 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 디렉터리를 추가함

from llm import create_claude_client, load_hands_on_env  # noqa: E402
from prompts import SYSTEM_PROMPT, get_claude_tools  # noqa: E402
from tools import execute_function  # noqa: E402
from ui_text import APP_ICON, APP_TITLE, TECH_GUIDE, USAGE_GUIDE, WELCOME_MESSAGE  # noqa: E402


MODEL_NAME = "claude-sonnet-4-6"
MAX_TOOL_ROUNDS = 5


def initialize_session_state() -> None:
    """Streamlit rerun 사이에 유지할 상태를 초기화함."""
    if "messages" not in st.session_state:  # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
        st.session_state.messages = []
    if "client" not in st.session_state:
        st.session_state.client = None
    if "last_tool_trace" not in st.session_state:
        st.session_state.last_tool_trace = []
    if "turn_count" not in st.session_state:
        st.session_state.turn_count = 0


def get_client() -> Any:
    """hands-on/.env 기반 Claude 클라이언트를 생성하고 재사용함."""
    if st.session_state.client is None:
        load_hands_on_env()
        st.session_state.client = create_claude_client()
    return st.session_state.client


def build_chat_messages(user_input: str) -> list[dict[str, Any]]:
    """Claude Messages API에 전달할 메시지 배열을 구성함."""
    messages: list[dict[str, Any]] = []
    for message in st.session_state.messages[-10:]:
        if message["role"] in {"user", "assistant"}:
            messages.append({"role": message["role"], "content": message["content"]})
    messages.append({"role": "user", "content": user_input})
    return messages


def run_tool_calls(response: Any) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """assistant 턴의 모든 tool_use 블록을 실행하고 tool_result user 메시지를 반환함.

    streaming 버전에서도 tool_result 전달 방식은 동일함:
    - 모든 tool_result 블록을 단일 role="user" 메시지에 묶어 전달
    - tool_use_id로 assistant tool_use 블록과 함수 결과를 1:1 매칭
    """
    tool_result_blocks: list[dict[str, Any]] = []
    traces: list[dict[str, Any]] = []

    for block in (response.content or []):
        if not (hasattr(block, "type") and block.type == "tool_use"):
            continue

        function_name = block.name
        function_args = dict(block.input) if block.input else {}
        result = execute_function(function_name, function_args)

        traces.append({
            "function": function_name,
            "arguments": function_args,
            "has_error": isinstance(result, dict) and bool(result.get("error")),
        })

        tool_result_blocks.append({
            "type": "tool_result",
            "tool_use_id": block.id,
            "content": json.dumps(result, ensure_ascii=False),
        })

    tool_result_message = {"role": "user", "content": tool_result_blocks}
    return tool_result_message, traces


def stream_response(user_input: str) -> Generator[str, None, None]:
    """텍스트 청크를 순서대로 yield하는 스트리밍 제너레이터.

    tool_use가 필요한 경우 내부에서 함수를 실행하고
    최종 답변을 스트리밍으로 이어서 반환함.

    핵심 흐름:
    1. client.messages.stream()으로 스트리밍 컨텍스트 진입
    2. stream.text_stream 이터레이터로 텍스트 청크를 순서대로 yield
    3. stream.get_final_message()로 stop_reason 확인
    4. stop_reason == "tool_use": 함수 실행 후 새 스트림 시작
    5. stop_reason == "end_turn": 스트리밍 완료
    """
    client = get_client()
    tools = get_claude_tools()
    messages = build_chat_messages(user_input)
    tool_trace: list[dict[str, Any]] = []

    for _ in range(MAX_TOOL_ROUNDS):
        # client.messages.stream()은 스트리밍 응답을 관리하는 컨텍스트 매니저임.
        # __enter__ 시점에 API 연결을 열고 __exit__ 시점에 닫음.
        with client.messages.stream(
            model=MODEL_NAME,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=tools,
            messages=messages,
        ) as stream:
            # text_stream은 type=="text" 블록의 내용을 청크 단위로 yield함.
            # tool_use 블록이 있는 턴에는 텍스트 청크가 없을 수 있음.
            for text_chunk in stream.text_stream:
                yield text_chunk

            # 스트림 완료 후 최종 메시지를 가져와 stop_reason을 확인함.
            # get_final_message()는 스트리밍이 끝난 후에만 호출 가능함.
            final_message = stream.get_final_message()

        if final_message.stop_reason != "tool_use":
            st.session_state.last_tool_trace = tool_trace
            return

        # tool_use: assistant content(블록 리스트)를 메시지 이력에 추가한 후 함수 실행
        # content를 그대로 보존해야 tool_use_id 매칭이 유지됨
        messages.append({"role": "assistant", "content": final_message.content})
        tool_result_message, traces = run_tool_calls(final_message)
        tool_trace.extend(traces)
        messages.append(tool_result_message)

    st.session_state.last_tool_trace = tool_trace
    yield "함수 호출이 반복되어 처리를 중단함. 요청을 더 구체적으로 입력해 주세요."


def display_chat_history() -> None:
    """저장된 대화 이력을 Streamlit 채팅 UI에 표시함."""
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])


def display_sidebar() -> None:
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
                )


def main() -> None:
    """Streamlit 앱 진입점."""
    st.set_page_config(
        page_title=f"{APP_TITLE} - Claude (Streaming)",
        page_icon=APP_ICON,
        layout="centered",
    )
    st.title(APP_TITLE)
    st.caption("Claude Messages API Tool Use + Streaming + Streamlit")

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
    main()
