"""LangChain + OpenAI 여행 플래너 (Streamlit 웹채팅).

[08.function-call 대비 핵심 변경 사항]
  Before: client.chat.completions.create() → tool_calls 감지 → run_tool_call() → 재호출 (수동 루프)
  After : create_react_agent(llm, TRAVEL_TOOLS) → agent.invoke() 한 번으로 ReAct 루프 자동 처리
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함
import json, sys
from pathlib import Path
from typing import Any

import streamlit as st
from langchain_openai import ChatOpenAI  # ChatOpenAI: LangChain OpenAI 채팅 모델 래퍼 (llm.invoke()로 대화 요청 전송)
from langgraph.prebuilt import create_react_agent  # create_react_agent: LLM + 도구 목록 → 컴파일된 ReAct 루프 그래프
# HumanMessage / AIMessage / SystemMessage / ToolMessage: LangChain 메시지 타입 (role을 객체로 표현)
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

CURRENT_DIR = Path(__file__).resolve().parent  # 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
COMMON_DIR = CURRENT_DIR.parent / "common"
if str(COMMON_DIR) not in sys.path:
    sys.path.insert(0, str(COMMON_DIR))  # 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 디렉터리를 추가함

from llm import require_api_key
from prompts import SYSTEM_PROMPT
from tools import TRAVEL_TOOLS
from ui_text import APP_ICON, APP_TITLE, TECH_GUIDE, USAGE_GUIDE, WELCOME_MESSAGE

MODEL_NAME = "gpt-5.5"


def initialize_session_state() -> None:
    """Streamlit rerun 사이에 유지할 상태 초기화."""
    if "messages" not in st.session_state:  # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
        st.session_state.messages = []
    if "agent" not in st.session_state:
        st.session_state.agent = None
    if "last_tool_trace" not in st.session_state:
        st.session_state.last_tool_trace = []
    if "turn_count" not in st.session_state:
        st.session_state.turn_count = 0


def get_agent():
    """ChatOpenAI + TRAVEL_TOOLS로 ReAct 에이전트를 지연 생성 후 캐싱.

    create_react_agent(llm, tools) 동작 원리:
    1. llm.bind_tools(tools)로 LLM에 도구 스키마를 바인딩
    2. LLM 호출 → tool_calls 있으면 도구 실행 → 결과를 ToolMessage로 추가
    3. tool_calls가 없을 때까지 2번 반복 (ReAct 루프)
    4. 최종 AIMessage 반환
    → 08.function-call의 수동 for 루프가 완전히 대체됨
    """
    if st.session_state.agent is None:
        api_key = require_api_key("OPENAI_API_KEY")
        llm = ChatOpenAI(model=MODEL_NAME, api_key=api_key, temperature=0)
        st.session_state.agent = create_react_agent(llm, TRAVEL_TOOLS)
    return st.session_state.agent


def build_messages(user_input: str) -> list:
    """Streamlit 채팅 이력과 현재 입력을 LangChain 메시지 목록으로 변환."""
    messages = [SystemMessage(content=SYSTEM_PROMPT)]
    # 비용과 토큰 사용량을 줄이기 위해 최근 10개 UI 메시지만 포함함
    for msg in st.session_state.messages[-10:]:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            messages.append(AIMessage(content=msg["content"]))
    messages.append(HumanMessage(content=user_input))
    return messages


def extract_tool_trace(messages: list) -> list[dict[str, Any]]:
    """agent.invoke() 결과 메시지 목록에서 도구 호출 기록을 추출함.

    AIMessage.tool_calls에서 함수명·인자를 수집하고 ToolMessage에서 오류 여부를 판단함.
    """
    traces = []
    call_map: dict[str, dict] = {}
    for msg in messages:
        if isinstance(msg, AIMessage) and msg.tool_calls:
            for tc in msg.tool_calls:
                call_map[tc["id"]] = {
                    "function": tc["name"],
                    "arguments": tc["args"],
                    "has_error": False,
                }
        elif isinstance(msg, ToolMessage):
            trace = call_map.get(msg.tool_call_id)
            if trace:
                try:
                    result = json.loads(msg.content) if isinstance(msg.content, str) else {}
                    trace["has_error"] = isinstance(result, dict) and bool(result.get("error"))
                except (json.JSONDecodeError, AttributeError):
                    pass
                traces.append(trace)
    return traces


def generate_response(user_input: str) -> str:
    """사용자 입력을 처리하고 최종 assistant 응답 텍스트를 반환함."""
    agent = get_agent()
    messages = build_messages(user_input)
    result = agent.invoke({"messages": messages})
    output_msgs = result["messages"]
    st.session_state.last_tool_trace = extract_tool_trace(output_msgs)
    content = output_msgs[-1].content
    return content or "응답을 생성할 수 없습니다."


def display_chat_history() -> None:
    """저장된 대화 이력을 Streamlit 채팅 UI에 표시함."""
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])


def display_sidebar() -> None:
    """예제 사용법과 직전 도구 호출 trace를 표시함."""
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
            st.header("직전 도구 호출")
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
        page_title=f"{APP_TITLE} - OpenAI",
        page_icon=APP_ICON,
        layout="centered",
    )
    st.title(f"{APP_ICON} {APP_TITLE}")
    st.caption("LangChain ChatOpenAI + create_react_agent + Streamlit")

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
            placeholder = st.empty()
            placeholder.markdown("ReAct 에이전트가 도구 호출 여부를 판단하는 중...")
            try:
                answer = generate_response(user_input)
            except Exception as exc:
                answer = f"오류가 발생함: {exc}"

            placeholder.markdown(answer)

        st.session_state.messages.append({"role": "assistant", "content": answer})
        st.session_state.turn_count += 1


if __name__ == "__main__":  # 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
    main()
