"""Claude Messages API Tool Use 여행 플래너 예제.

사용자가 여행 중인 도시를 입력하면 Claude가 요청 유형을 판단하고,
필요한 외부 API 도구를 Tool Use로 실행한 뒤 Streamlit 웹채팅으로 답변함.

학습 포인트:
- Claude Messages API의 tools 파라미터로 도구 등록
- stop_reason == "tool_use" 감지 후 로컬 함수 실행
- Tool Result는 role="user" + type="tool_result"로 전달
- 한 assistant 턴의 모든 tool_use 블록을 단일 user 메시지에 묶어 반환
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import json
import sys
from pathlib import Path
from typing import Any

import streamlit as st


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

from llm import call_claude_messages, create_claude_client, load_hands_on_env  # noqa: E402
from prompts import SYSTEM_PROMPT, get_claude_tools  # noqa: E402
from tools import execute_function  # noqa: E402
from ui_text import APP_ICON, APP_TITLE, TECH_GUIDE, USAGE_GUIDE, WELCOME_MESSAGE  # noqa: E402


MODEL_NAME = "claude-sonnet-4-6"
MAX_TOOL_ROUNDS = 5


def initialize_session_state() -> None:
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
        st.session_state.turn_count = 0


def get_client() -> Any:
    """hands-on/.env 기반 Claude 클라이언트를 생성하고 재사용함."""
    if st.session_state.client is None:
        # load_hands_on_env()는 hands-on/.env를 로드함. CLAUDE_API_KEY가 없으면
        # create_claude_client() 내부에서 명확한 RuntimeError가 발생하여
        # Streamlit 화면에 사용자 친화적으로 안내할 수 있음.
        load_hands_on_env()
        st.session_state.client = create_claude_client()
    return st.session_state.client


def build_chat_messages(user_input: str) -> list[dict[str, Any]]:
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
    return messages


def extract_text(response: Any) -> str:
    """Claude 응답의 content 블록 목록에서 텍스트를 추출함.

    tool_use 블록이 있는 턴에는 text 블록이 없을 수 있으므로
    type == "text"인 블록만 선택하여 이어 붙임.
    """
    text_parts = [
        block.text
        for block in (response.content or [])
        if hasattr(block, "type") and block.type == "text"
    ]
    return "".join(text_parts) or "응답을 생성할 수 없습니다."


def run_tool_calls(response: Any) -> tuple[dict[str, Any], list[dict[str, Any]]]:
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
    return tool_result_message, traces


def generate_response(user_input: str) -> str:
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
    return "함수 호출이 반복되어 처리를 중단함. 요청을 더 구체적으로 입력해 주세요."


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
    main()
