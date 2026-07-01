"""Groq gpt-oss-120b + LangChain + LangGraph 여행 플래너 (Streamlit 웹채팅).

[09.langchain/openai 대비 핵심 변경 사항]
  Before: create_agent() 단순 에이전트, OpenAI 모델
  After : 슬라이딩 윈도우(크기 3) + 요약 기법을 추가한 커스텀 StateGraph, Groq LPU

[학습 포인트]
- Groq LPU의 gpt-oss-120b reasoning 모델 연동 (None content 가드 필수)
- LangGraph StateGraph로 멀티턴 대화 상태 관리 (MemorySaver)
- 슬라이딩 윈도우(크기 3) + 요약 기법으로 컨텍스트 효율화
- ReAct 루프: chatbot → tools → chatbot 반복 후 summarize → END
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Annotated, Any

import streamlit as st
from langchain_groq import ChatGroq
from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    RemoveMessage,
    SystemMessage,
    ToolMessage,
)
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict


# ---------------------------------------------------------------------------
# common 모듈 경로 연결
# ---------------------------------------------------------------------------
CURRENT_DIR = Path(__file__).resolve().parent
COMMON_DIR = CURRENT_DIR / "common"
if str(COMMON_DIR) not in sys.path:
    sys.path.insert(0, str(COMMON_DIR))

from llm import require_api_key  # noqa: E402
from prompts import SYSTEM_PROMPT  # noqa: E402
from tools import TRAVEL_TOOLS  # noqa: E402
from ui_text import APP_ICON, APP_TITLE, TECH_GUIDE, USAGE_GUIDE, WELCOME_MESSAGE  # noqa: E402


# ---------------------------------------------------------------------------
# 상수
# ---------------------------------------------------------------------------
MODEL_NAME = "openai/gpt-oss-120b"
WINDOW_SIZE = 3    # 슬라이딩 윈도우 크기 (유지할 HumanMessage 수)
MAX_TOKENS = 8000  # reasoning 모델은 reasoning+출력 합산 예산 → 여유 있게 설정


# ---------------------------------------------------------------------------
# LangGraph 상태 정의
# ---------------------------------------------------------------------------

class TravelState(TypedDict):
    """LangGraph 노드 간 공유 상태."""
    messages: Annotated[list, add_messages]  # 대화 이력 (add_messages 리듀서로 누적)
    summary: str                              # 슬라이딩 윈도우로 압축된 이전 대화 요약


# ---------------------------------------------------------------------------
# 에이전트 빌더 (LangGraph 그래프 생성)
# ---------------------------------------------------------------------------

def build_agent():
    """Groq LLM + TRAVEL_TOOLS로 슬라이딩 윈도우 멀티턴 에이전트 구성."""
    api_key = require_api_key("GROQ_API_KEY")
    llm = ChatGroq(model=MODEL_NAME, api_key=api_key, max_tokens=MAX_TOKENS, temperature=0)
    llm_with_tools = llm.bind_tools(TRAVEL_TOOLS)
    tools_map = {t.name: t for t in TRAVEL_TOOLS}

    # --------------------------------------------------------
    # 노드 1: chatbot — LLM 호출 (슬라이딩 윈도우 적용)
    # --------------------------------------------------------
    def chatbot_node(state: TravelState) -> dict:
        """LLM을 호출하여 응답 또는 도구 호출 결정.

        슬라이딩 윈도우: 전체 대화 이력 중 최근 WINDOW_SIZE 쌍만 LLM에 전달.
        이전 맥락은 summary 필드를 시스템 메시지에 주입하여 보완.
        """
        summary = state.get("summary", "")
        system_content = SYSTEM_PROMPT
        if summary:
            system_content += f"\n\n[이전 대화 요약]\n{summary}"

        # 슬라이딩 윈도우: 현재 요청의 HumanMessage는 항상 포함 보장
        # tool call 메시지로 window가 밀려도 사용자 입력을 잃지 않음
        all_msgs = state["messages"]
        keep = WINDOW_SIZE * 2

        # 가장 최근 HumanMessage 위치 탐색
        recent_human_idx = next(
            (i for i in range(len(all_msgs) - 1, -1, -1) if isinstance(all_msgs[i], HumanMessage)),
            None,
        )
        if recent_human_idx is not None:
            # 현재 요청(HumanMessage~끝)은 항상 포함, 이전 컨텍스트만 window 제한
            current_request = all_msgs[recent_human_idx:]
            prev_context = all_msgs[:recent_human_idx]
            prev_windowed = prev_context[-keep:] if len(prev_context) > keep else prev_context
            windowed = prev_windowed + current_request
        else:
            windowed = all_msgs[-keep:] if len(all_msgs) > keep else all_msgs

        messages = [SystemMessage(content=system_content)] + list(windowed)
        response = llm_with_tools.invoke(messages)

        # Groq gpt-oss reasoning 모델: content가 None일 수 있음 → 빈 문자열로 대체
        if response.content is None:
            response.content = ""
        return {"messages": [response]}

    # --------------------------------------------------------
    # 노드 2: tools — 도구 실행 (ReAct 루프)
    # --------------------------------------------------------
    def tool_node(state: TravelState) -> dict:
        """LLM이 요청한 도구를 실행하고 결과를 ToolMessage로 반환."""
        last_ai = state["messages"][-1]
        results = []
        for tc in last_ai.tool_calls:
            fn = tools_map.get(tc["name"])
            result = fn.invoke(tc["args"]) if fn else {"error": f"Unknown tool: {tc['name']}"}
            results.append(ToolMessage(
                content=json.dumps(result, ensure_ascii=False),
                tool_call_id=tc["id"],
            ))
        return {"messages": results}

    # --------------------------------------------------------
    # 노드 3: summarize — 슬라이딩 윈도우 초과 시 오래된 메시지 요약 후 삭제
    # --------------------------------------------------------
    def summarize_node(state: TravelState) -> dict:
        """HumanMessage 수가 WINDOW_SIZE 초과 시 오래된 메시지를 요약으로 압축.

        - 오래된 메시지 텍스트를 LLM으로 요약
        - summary 필드에 저장
        - RemoveMessage로 상태에서 오래된 메시지 제거 → 슬라이딩 윈도우 유지
        """
        msgs = state["messages"]
        keep = WINDOW_SIZE * 2
        if len(msgs) <= keep:
            return {}  # 윈도우 내에 있으면 아무것도 하지 않음

        old_msgs = msgs[:-keep]
        old_text = "\n".join(
            f"{'사용자' if isinstance(m, HumanMessage) else 'AI'}: {m.content or ''}"
            for m in old_msgs
            if isinstance(m, (HumanMessage, AIMessage)) and m.content
        )

        existing = state.get("summary", "")
        prompt = (
            "다음 여행 대화를 핵심 정보 위주로 2~3문장으로 요약하세요.\n\n"
            + (f"기존 요약: {existing}\n\n새 대화:\n{old_text}" if existing else f"대화:\n{old_text}")
        )
        res = llm.invoke(prompt)
        new_summary = (res.content or "").strip()

        # 오래된 메시지를 상태에서 제거 (슬라이딩 윈도우 적용)
        delete_ops = [RemoveMessage(id=m.id) for m in old_msgs if getattr(m, "id", None)]
        return {"summary": new_summary, "messages": delete_ops}

    # --------------------------------------------------------
    # 라우팅 함수
    # --------------------------------------------------------
    def should_continue(state: TravelState) -> str:
        """chatbot 노드 이후 다음 노드를 결정."""
        last = state["messages"][-1]
        if isinstance(last, AIMessage) and last.tool_calls:
            return "tools"       # 도구 호출 필요 → tools 노드로
        return "summarize"       # 응답 완료 → 윈도우 크기 점검

    # --------------------------------------------------------
    # 그래프 구성 및 컴파일
    # --------------------------------------------------------
    builder = StateGraph(TravelState)
    builder.add_node("chatbot", chatbot_node)
    builder.add_node("tools", tool_node)
    builder.add_node("summarize", summarize_node)

    builder.add_edge(START, "chatbot")
    builder.add_conditional_edges(
        "chatbot",
        should_continue,
        {"tools": "tools", "summarize": "summarize"},
    )
    builder.add_edge("tools", "chatbot")   # ReAct 루프: 도구 실행 후 다시 LLM 호출
    builder.add_edge("summarize", END)

    # MemorySaver: thread_id로 세션을 구분하여 멀티턴 대화 이력 유지
    return builder.compile(checkpointer=MemorySaver())


# ---------------------------------------------------------------------------
# Streamlit 세션 상태 초기화
# ---------------------------------------------------------------------------

def initialize_session_state() -> None:
    """Streamlit rerun 사이에 유지할 상태 초기화."""
    if "messages" not in st.session_state:
        st.session_state.messages = []
    if "agent" not in st.session_state:
        st.session_state.agent = None
    if "thread_id" not in st.session_state:
        st.session_state.thread_id = "travel-session-1"
    if "turn_count" not in st.session_state:
        st.session_state.turn_count = 0
    if "last_tool_trace" not in st.session_state:
        st.session_state.last_tool_trace = []
    if "reset_count" not in st.session_state:
        st.session_state.reset_count = 0


def get_agent():
    """에이전트를 지연 생성 후 세션에 캐싱."""
    if st.session_state.agent is None:
        st.session_state.agent = build_agent()
    return st.session_state.agent


# ---------------------------------------------------------------------------
# 도구 호출 추적 (사이드바 표시용)
# ---------------------------------------------------------------------------

def extract_tool_trace(messages: list) -> list[dict[str, Any]]:
    """에이전트 결과 메시지에서 도구 호출 기록 추출."""
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


# ---------------------------------------------------------------------------
# 응답 생성
# ---------------------------------------------------------------------------

def generate_response(user_input: str) -> str:
    """사용자 입력을 LangGraph 에이전트에 전달하고 최종 응답 텍스트 반환."""
    agent = get_agent()
    config = {"configurable": {"thread_id": st.session_state.thread_id}}

    # 첫 번째 턴: summary 필드 초기화 (이후 MemorySaver가 유지)
    input_state: dict = {"messages": [HumanMessage(content=user_input)]}
    if st.session_state.turn_count == 0:
        input_state["summary"] = ""

    result = agent.invoke(input_state, config)
    output_msgs = result["messages"]
    st.session_state.last_tool_trace = extract_tool_trace(output_msgs)

    # 마지막 AIMessage의 content 반환 (Groq reasoning 모델 None 가드 포함)
    for msg in reversed(output_msgs):
        if isinstance(msg, AIMessage):
            return (msg.content or "").strip() or "응답을 생성할 수 없습니다."
    return "응답을 생성할 수 없습니다."


# ---------------------------------------------------------------------------
# Streamlit UI
# ---------------------------------------------------------------------------

def display_chat_history() -> None:
    """저장된 대화 이력을 Streamlit 채팅 UI에 표시."""
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])


def display_sidebar() -> None:
    """사용법·기술 흐름·직전 도구 호출 trace 표시."""
    with st.sidebar:
        st.header("사용 방법")
        st.markdown(USAGE_GUIDE)
        st.divider()
        st.header("기술 흐름")
        st.markdown(TECH_GUIDE)
        st.divider()

        col1, col2 = st.columns(2)
        col1.metric("대화 턴", st.session_state.turn_count)
        col2.metric("윈도우 크기", WINDOW_SIZE)

        if st.button("대화 초기화", use_container_width=True):
            st.session_state.messages = []
            st.session_state.last_tool_trace = []
            st.session_state.turn_count = 0
            st.session_state.reset_count += 1
            # 새 thread_id → MemorySaver에서 새 세션으로 시작
            st.session_state.thread_id = f"travel-session-{st.session_state.reset_count + 1}"
            st.session_state.agent = None
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
        page_title=f"{APP_TITLE} - Groq",
        page_icon=APP_ICON,
        layout="centered",
    )
    st.title(f"{APP_ICON} {APP_TITLE}")
    st.caption(
        f"ChatGroq ({MODEL_NAME}) + LangGraph + 슬라이딩 윈도우(크기 {WINDOW_SIZE}) + Streamlit"
    )

    initialize_session_state()
    display_sidebar()

    if not st.session_state.messages:
        with st.chat_message("assistant"):
            st.markdown(WELCOME_MESSAGE)

    display_chat_history()

    if user_input := st.chat_input("예: 서울, 도쿄 날씨, 파리 관광지, 부산 맛집"):
        st.session_state.messages.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.markdown(user_input)

        with st.chat_message("assistant"):
            placeholder = st.empty()
            placeholder.markdown("Groq LPU 추론 중...")
            try:
                answer = generate_response(user_input)
            except Exception as exc:
                answer = f"오류가 발생함: {exc}"
            placeholder.markdown(answer)

        st.session_state.messages.append({"role": "assistant", "content": answer})
        st.session_state.turn_count += 1


if __name__ == "__main__":
    main()
