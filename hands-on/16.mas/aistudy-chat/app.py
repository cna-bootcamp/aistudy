"""Streamlit 채팅 UI (실행 진입점)

Agentic AI 학습지원 MAS 챗봇의 웹 채팅 화면.
사용자 질문을 LangGraph 워크플로(Router → Agents → Supervisor)에 통과시켜 답변을 표시하고,
질문 유형·품질 점수·재시도 횟수 등 Supervisor 관측 정보를 함께 보여줌.

실행: streamlit run app.py
"""
from __future__ import annotations

import streamlit as st

from graph.state import create_initial_state
from graph.workflow import compile_workflow
from llm.ollama_llm import OllamaLLM


# @st.cache_resource: 앱 재시작 전까지 한 번만 실행하여 결과를 캐싱함 (그래프 컴파일 비용 절감)
@st.cache_resource
def get_app():
    """컴파일된 LangGraph 워크플로를 캐싱하여 반환함."""
    return compile_workflow()


def render_sidebar() -> None:
    """사이드바에 시스템 정보와 Ollama 연결 상태를 표시함."""
    with st.sidebar:
        st.header("⚙️ 시스템 정보")
        st.markdown(
            "- **LLM**: qwen3:8b (Ollama)\n"
            "- **임베딩**: qwen3-embedding (4096)\n"
            "- **KG+Vector**: MS GraphRAG store\n"
            "- **패턴**: SAS (LangGraph)\n"
            "- **소스**: 교재(RAG) + Web + YouTube"
        )
        # Ollama 연결 점검 — 미연결 시 사용자에게 즉시 안내
        if OllamaLLM().is_available():
            st.success("Ollama 서버 연결됨")
        else:
            st.error("Ollama 서버에 연결할 수 없음 (ollama serve 확인)")

        st.markdown("---")
        st.caption("테스트 질의 예시")
        st.code(
            "LangGraph의 StateGraph 사용법 알려줘\n"
            "LangGraph로 간단한 ReAct 에이전트 코드 작성해줘\n"
            "Claude MCP란 무엇인가요?\n"
            "RAG 구현 튜토리얼 영상 추천해줘",
            language="text",
        )


def main() -> None:
    """Streamlit 앱 메인 — 대화 이력 렌더링 + 입력 처리."""
    st.set_page_config(page_title="Agentic AI 학습 MAS 챗봇", page_icon="🤖", layout="wide")
    st.title("🤖 Agentic AI 학습지원 MAS 챗봇")
    st.caption("LangGraph 멀티에이전트 · 교재(GraphRAG) + Web + YouTube 종합 답변")

    render_sidebar()

    # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
    if "messages" not in st.session_state:
        st.session_state.messages = []

    # 이전 대화 렌더링
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    # st.chat_input: 채팅창 하단 입력란을 렌더링하고 입력값을 반환함
    if user_input := st.chat_input("예: LangGraph의 StateGraph 사용법 알려줘"):
        st.session_state.messages.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.markdown(user_input)

        with st.chat_message("assistant"):
            with st.spinner("멀티에이전트가 검색·생성·평가 중... (로컬 qwen3:8b는 수십 초 소요될 수 있음)"):
                app = get_app()
                # recursion_limit: 재시도 루프 폭주 방지 안전장치
                final_state = app.invoke(
                    create_initial_state(user_input), config={"recursion_limit": 30}
                )
            answer = final_state.get("answer", "(답변을 생성하지 못함)")
            st.markdown(answer)

            # Supervisor 관측 정보 표시 (질문 유형·품질 점수·재시도)
            qtype = final_state.get("question_type", "-")
            score = final_state.get("evaluation_score", 0.0)
            passed = final_state.get("evaluation_passed", False)
            retries = final_state.get("retry_count", 0)
            st.caption(
                f"유형: `{qtype}` · 품질 점수: `{score:.2f}` "
                f"· 통과: `{passed}` · 재시도: `{retries}`"
            )

        st.session_state.messages.append({"role": "assistant", "content": answer})


# Streamlit은 상호작용마다 스크립트 전체를 위에서 아래로 재실행하므로 main()을 그대로 호출함
# (streamlit run app.py 실행 시 __name__ == "__main__")
main()
