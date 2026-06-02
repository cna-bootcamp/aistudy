"""LangChain + Gemini 여행 플래너 (Streamlit 웹채팅) - Streaming 버전.

[08.function-call 대비 핵심 변경 사항]
  Before: generate_content_stream() → function_call 청크 누적 → 수동 루프
  After : create_react_agent(llm, TRAVEL_TOOLS) → agent.stream() 한 번으로 루프 자동 처리
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import sys
from pathlib import Path
from typing import Any, Generator

import streamlit as st

# ---------------------------------------------------------------------------
# 공통 모듈 경로 등록
# ---------------------------------------------------------------------------
# streaming/ 하위 디렉터리에서 실행하므로 parent를 두 번 올라가야 함.
# CURRENT_DIR: gemini/streaming/
# COMMON_DIR:  09.langchain/common/
CURRENT_DIR = Path(__file__).resolve().parent  # 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
COMMON_DIR = CURRENT_DIR.parent.parent / "common"
if str(COMMON_DIR) not in sys.path:
    sys.path.insert(0, str(COMMON_DIR))  # 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 디렉터리를 추가함

# ChatGoogleGenerativeAI: LangChain Google Gemini 채팅 모델 래퍼 (llm.invoke()로 대화 요청 전송)
from langchain_google_genai import ChatGoogleGenerativeAI
# HumanMessage / AIMessage / ToolMessage: LangChain 메시지 타입 (role을 객체로 표현)
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, ToolMessage
# create_react_agent: LLM + 도구 목록 → 컴파일된 ReAct 루프 그래프
from langgraph.prebuilt import create_react_agent

from llm import require_api_key
from prompts import SYSTEM_PROMPT
from tools import TRAVEL_TOOLS
from ui_text import APP_ICON, APP_TITLE, TECH_GUIDE, USAGE_GUIDE, WELCOME_MESSAGE

MODEL_NAME = "gemini-3.5-flash"


# ---------------------------------------------------------------------------
# 에이전트 초기화
# ---------------------------------------------------------------------------

# @st.cache_resource: 앱 재시작 전까지 한 번만 실행하여 결과를 캐싱함
@st.cache_resource
def get_agent():
    """ChatGoogleGenerativeAI + TRAVEL_TOOLS로 ReAct 에이전트를 지연 생성 후 캐싱.

    create_react_agent(llm, tools) 동작 원리:
    1. llm.bind_tools(tools)로 LLM에 도구 스키마를 바인딩
    2. LLM 호출 → tool_calls 있으면 도구 실행 → 결과를 ToolMessage로 추가
    3. tool_calls가 없을 때까지 2번 반복 (ReAct 루프)
    4. 최종 AIMessage 반환
    → 08.function-call의 수동 for 루프가 완전히 대체됨
    """
    api_key = require_api_key("GEMINI_API_KEY")
    llm = ChatGoogleGenerativeAI(model=MODEL_NAME, google_api_key=api_key, temperature=0)
    return create_react_agent(llm, TRAVEL_TOOLS, prompt=SYSTEM_PROMPT)


# ---------------------------------------------------------------------------
# Streamlit 상태 관리
# ---------------------------------------------------------------------------

def initialize_session_state() -> None:
    """Streamlit rerun 사이에 유지할 상태를 초기화함."""
    if "messages" not in st.session_state:  # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
        st.session_state.messages = []
    if "last_tool_trace" not in st.session_state:
        st.session_state.last_tool_trace = []
    if "turn_count" not in st.session_state:
        st.session_state.turn_count = 0


def build_history() -> list[Any]:
    """st.session_state.messages를 LangChain HumanMessage / AIMessage 배열로 변환.

    에이전트는 매 턴 메시지 배열 전체를 받아 도구 호출 흐름을 재구성하므로
    ToolMessage는 제외하고 사용자-어시스턴트 대화만 전달함.
    """
    result = []
    # 비용과 토큰 사용량을 줄이기 위해 최근 대화만 포함함
    for message in st.session_state.messages[-10:]:
        if message["role"] == "user":
            result.append(HumanMessage(content=message["content"]))
        elif message["role"] == "assistant":
            result.append(AIMessage(content=message["content"]))
    return result


def stream_response(user_input: str) -> Generator[str, None, None]:
    """에이전트 응답을 텍스트 청크로 yield하는 스트리밍 제너레이터.

    agent.stream(stream_mode="messages") 핵심 흐름:
    1. 메시지 배열을 에이전트에 전달
    2. AIMessageChunk: 텍스트 청크를 실시간 yield
    3. ToolMessage: 도구 실행 결과로 tool_trace 갱신
    4. 에이전트가 ReAct 루프를 내부적으로 처리하므로 수동 루프 불필요
    """
    agent = get_agent()
    history = build_history()
    tool_trace: list[dict[str, Any]] = []

    # stream_mode="messages"는 (메시지 청크, 메타데이터) 튜플을 순서대로 yield함
    for chunk, metadata in agent.stream(
        {"messages": [*history, HumanMessage(content=user_input)]},
        stream_mode="messages",
        config={"recursion_limit": 25},
    ):
        # AIMessageChunk: 모델이 생성하는 텍스트 스트림 단위
        if isinstance(chunk, AIMessageChunk) and chunk.content:
            if isinstance(chunk.content, str):
                yield chunk.content
            else:
                for block in chunk.content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        yield block.get("text", "")
        # ToolMessage: 도구 실행 결과. 텍스트 출력 없이 trace만 갱신함
        elif isinstance(chunk, ToolMessage):
            content_str = chunk.content if isinstance(chunk.content, str) else str(chunk.content)
            tool_trace.append({
                "function": getattr(chunk, "name", "tool"),
                "has_error": "'error'" in content_str or '"error"' in content_str,
            })

    st.session_state.last_tool_trace = tool_trace


# ---------------------------------------------------------------------------
# UI 렌더링
# ---------------------------------------------------------------------------

def display_chat_history() -> None:
    """저장된 대화 이력을 Streamlit 채팅 UI에 표시함."""
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])


def display_sidebar() -> None:
    """사용 방법, 기술 흐름, 도구 호출 이력을 사이드바에 표시함."""
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
                st.code(f"{trace['function']}() -> {status}", language="text")


def main() -> None:
    """Streamlit 앱 진입점."""
    st.set_page_config(
        page_title=f"{APP_TITLE} - Gemini (Streaming)",
        page_icon=APP_ICON,
        layout="centered",
    )
    st.title(APP_TITLE)
    st.caption("LangChain + Gemini + create_react_agent + Streaming + Streamlit")

    initialize_session_state()
    display_sidebar()

    if not st.session_state.messages:
        with st.chat_message("assistant"):
            st.markdown(WELCOME_MESSAGE)

    display_chat_history()

    if user_input := st.chat_input("예: 서울, 도쿄 날씨, 파리 관광지, 부산 맛집"):  # := 는 조건 검사와 동시에 변수에 값을 할당함
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
