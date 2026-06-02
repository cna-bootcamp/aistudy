"""OpenAI Chat Completions Tool Calling 여행 플래너 - Streaming 버전.

기존 예제와 동일한 기능에 Streaming 출력 방식을 추가함.

학습 포인트:
- chat.completions.create(stream=True)로 스트리밍 응답 수신
- delta.content로 텍스트 청크를 순서대로 yield
- delta.tool_calls를 index별로 누적하여 완전한 tool_call 복원
- finish_reason == "tool_calls"로 함수 호출 필요 여부 판단
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
# CURRENT_DIR: openai/streaming/
# COMMON_DIR:  08.function-call/common/
CURRENT_DIR = Path(__file__).resolve().parent  # 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
COMMON_DIR = CURRENT_DIR.parent.parent / "common"
if str(COMMON_DIR) not in sys.path:
    sys.path.insert(0, str(COMMON_DIR))  # 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 디렉터리를 추가함

from llm import create_openai_client, load_hands_on_env  # noqa: E402
from prompts import SYSTEM_PROMPT, get_openai_tools  # noqa: E402
from tools import execute_function  # noqa: E402
from ui_text import APP_ICON, APP_TITLE, TECH_GUIDE, USAGE_GUIDE, WELCOME_MESSAGE  # noqa: E402


MODEL_NAME = "gpt-5.5"
MAX_TOOL_ROUNDS = 4


def initialize_session_state() -> None:
    """Streamlit rerun 사이에 유지할 상태를 초기화함."""
    if "messages" not in st.session_state:  # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
        st.session_state.messages = [{"role": "assistant", "content": WELCOME_MESSAGE}]
    if "client" not in st.session_state:
        st.session_state.client = None
    if "last_tool_trace" not in st.session_state:
        st.session_state.last_tool_trace = []
    if "turn_count" not in st.session_state:
        st.session_state.turn_count = 0


def get_client() -> Any:
    """hands-on/.env 기반 OpenAI 클라이언트를 생성하고 재사용함."""
    if st.session_state.client is None:
        load_hands_on_env()
        st.session_state.client = create_openai_client()
    return st.session_state.client


def build_chat_messages(user_input: str) -> list[dict[str, Any]]:
    """OpenAI Chat Completions에 전달할 메시지 배열을 구성함."""
    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for message in st.session_state.messages[-10:]:
        if message["role"] in {"user", "assistant"}:
            messages.append({"role": message["role"], "content": message["content"]})
    messages.append({"role": "user", "content": user_input})
    return messages


def parse_tool_arguments(raw_arguments: str) -> dict[str, Any]:
    """OpenAI tool_call의 JSON 문자열 인자를 안전하게 dict로 변환함."""
    try:
        parsed = json.loads(raw_arguments or "{}")
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def stream_response(user_input: str) -> Generator[str, None, None]:
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
    yield "함수 호출이 반복되어 처리를 중단함. 요청을 더 구체적으로 입력해 주세요."


def display_chat_history() -> None:
    """저장된 대화 이력을 Streamlit 채팅 UI에 표시함."""
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])


def display_sidebar() -> None:
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
                )


def main() -> None:
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
    main()
