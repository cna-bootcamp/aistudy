"""OpenAI Chat Completions Tool Calling 여행 플래너 예제.

Streamlit 웹채팅에서 OpenAI Chat Completions의 tool calling을 학습하기 위한 예제임.
실제 날씨/장소 조회 함수와 프롬프트는 상위 실습 폴더의 common 모듈을 그대로 import해서 사용함.

학습 포인트:
- OpenAI Chat Completions의 tools 파라미터로 도구 등록
- finish_reason == "tool_calls" 감지 후 로컬 함수 실행
- Tool 결과는 role="tool" + tool_call_id로 전달
- tool_calls 포함 assistant 메시지를 대화 이력에 먼저 추가 후 tool 결과 전달
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import json
import sys
from pathlib import Path
from typing import Any

import streamlit as st


# ---------------------------------------------------------------------------
# common 모듈 경로 연결
# ---------------------------------------------------------------------------
# 이 예제는 openai 디렉터리만 독립적으로 수정해야 하므로 공통 로직을
# 복사하지 않음. 대신 sibling 디렉터리인 ../common 을 import path에
# 추가하여 이미 준비된 LLM 호출 함수, 프롬프트, tool 실행 함수를 사용함.
CURRENT_DIR = Path(__file__).resolve().parent  # 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
COMMON_DIR = CURRENT_DIR.parent / "common"
if str(COMMON_DIR) not in sys.path:
    sys.path.insert(0, str(COMMON_DIR))  # 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 디렉터리를 추가함

from llm import call_openai_chat, create_openai_client, load_hands_on_env  # noqa: E402
from prompts import SYSTEM_PROMPT, get_openai_tools  # noqa: E402
from tools import execute_function  # noqa: E402
from ui_text import APP_ICON, APP_TITLE, TECH_GUIDE, USAGE_GUIDE, WELCOME_MESSAGE  # noqa: E402


MODEL_NAME = "gpt-4o-mini"
MAX_TOOL_ROUNDS = 4


def initialize_session_state() -> None:
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
        st.session_state.turn_count = 0


def get_client() -> Any:
    """hands-on/.env 기반 OpenAI 클라이언트를 생성하고 재사용함."""
    if st.session_state.client is None:
        # load_hands_on_env()는 hands-on/.env를 로드함. API 키가 없으면
        # create_openai_client() 내부에서 명확한 RuntimeError를 발생시켜
        # Streamlit 화면에 사용자 친화적으로 안내할 수 있음.
        load_hands_on_env()
        st.session_state.client = create_openai_client()
    return st.session_state.client


def build_chat_messages(user_input: str) -> list[dict[str, Any]]:
    """OpenAI Chat Completions에 전달할 메시지 배열을 구성함."""
    messages: list[dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]

    # 비용과 토큰 사용량을 줄이기 위해 최근 대화만 포함함. 여행 플래너 예제는
    # 단일 요청 완결성이 중요하므로 최근 10개 UI 메시지만으로 충분함.
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
        # 모델이 드물게 불완전한 JSON을 생성할 수 있으므로 함수 호출 자체가
        # 앱을 중단하지 않도록 빈 인자로 복구함. 이후 execute_function()이
        # 인자 오류를 구조화된 error로 반환함.
        return {}

    return parsed if isinstance(parsed, dict) else {}


def assistant_message_to_dict(assistant_message: Any) -> dict[str, Any]:
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

    return message_dict


def run_tool_call(tool_call: Any) -> dict[str, Any]:
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

    return {"trace": trace, "message": tool_message}


def generate_response(user_input: str) -> str:
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
    return "함수 호출이 반복되어 처리를 중단함. 요청을 더 구체적으로 입력해 주세요."


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
    main()
