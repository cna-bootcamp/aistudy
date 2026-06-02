"""LangChain + Neo4j GraphRAG 검색 Streamlit 앱.

채팅 UI에서 질문을 받고 Auto/Vector/Graph QA/Hybrid/Cypher Direct 모드로 Neo4j 인덱싱 결과를 검색함.
검색 컨텍스트는 Groq LPU LLM으로 답변 생성에 사용됨.
"""
import logging
import sys
from pathlib import Path

import streamlit as st

# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함.
_RETRIEVE_DIR = Path(__file__).resolve().parent
# 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 디렉터리를 추가함.
sys.path.insert(0, str(_RETRIEVE_DIR))

from config.settings import Settings
from graph.neo4j_connection import Neo4jConnection
from logging_config import configure_logging
from query.question_condenser import condense_question
from query.query_engine import QueryEngine
from query.router import QueryRouter
from ui.components import display_kg_stats, display_neo4j_status, display_result

logger = logging.getLogger(__name__)

MODE_LABELS = ["Auto", "Vector Search", "Graph QA", "Hybrid Search", "Cypher Direct"]


# 앱 재시작 전까지 한 번만 실행하여 결과를 캐싱함.
@st.cache_resource(show_spinner=False)
def load_services() -> tuple[Settings, Neo4jConnection, QueryEngine, QueryRouter]:
    """설정, Neo4j 연결, 검색 엔진, 라우터를 지연 생성."""
    settings = Settings()
    connection = Neo4jConnection(settings)
    engine = QueryEngine(settings, connection.graph)
    router = QueryRouter(settings)
    return settings, connection, engine, router


def initialize_messages() -> None:
    """Streamlit 세션의 채팅 메시지 목록 초기화."""
    # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소.
    if "messages" not in st.session_state:
        st.session_state.messages = []


def build_history() -> list[dict[str, str]]:
    """현재 턴 이전까지의 대화 이력 반환 — condense_question 입력용."""
    return [
        {"role": m["role"], "content": m["content"]}
        for m in st.session_state.messages[-8:]
        if m["role"] in ("user", "assistant")
    ]


def process_query(question: str, selected_mode: str, history: list[dict[str, str]] | None = None) -> dict:
    """라우팅 후 검색 엔진 실행."""
    settings, _, engine, router = load_services()

    # cypher_direct 는 사용자 Cypher를 그대로 전달; 나머지 모드는 질문 재작성
    if history and "cypher" not in selected_mode.lower():
        condensed = condense_question(question, history, settings)
    else:
        condensed = question

    decision = router.route(condensed, selected_mode)
    result = engine.search(condensed, decision.mode, history)
    result["requested_mode"] = selected_mode
    result["routing_reason"] = decision.reason
    result["routing_scores"] = decision.scores
    logger.info(
        "질문 처리 완료: mode=%s, rewritten=%s, reason=%s",
        decision.mode,
        condensed != question,
        decision.reason,
    )
    return result


def main() -> None:
    """Streamlit 앱 엔트리포인트."""
    st.set_page_config(page_title="LangChain + Neo4j GraphRAG", layout="wide")
    initialize_messages()
    configure_logging(Settings())

    try:
        settings, connection, _, _ = load_services()
    except Exception as exc:
        st.error(f"초기화 실패: {exc}")
        st.stop()

    with st.sidebar:
        st.title("GraphRAG 검색")
        st.caption(f"LLM: {settings.groq_model}")
        selected_mode = st.radio("검색 모드", MODE_LABELS, index=0)
        st.divider()
        if st.button("Neo4j 상태"):
            display_neo4j_status(connection)
        if st.button("KG 통계"):
            display_kg_stats(connection)
        if st.button("대화 초기화"):
            st.session_state.messages = []
            st.rerun()

    st.title("LangChain + Neo4j GraphRAG")

    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            if message["role"] == "assistant" and message.get("result"):
                display_result(message["result"])
            else:
                st.markdown(message["content"])

    # st.chat_input: 채팅창 하단 입력란을 렌더링하고 입력값을 반환함.
    # := 는 조건 검사와 동시에 변수에 값을 할당함.
    if question := st.chat_input("질문 또는 Cypher 쿼리 입력"):
        history = build_history()  # 현재 턴 추가 전 이력 수집
        st.session_state.messages.append({"role": "user", "content": question})
        with st.chat_message("user"):
            st.markdown(question)

        with st.chat_message("assistant"):
            with st.spinner("검색 중..."):
                result = process_query(question, selected_mode, history)
                display_result(result)

        st.session_state.messages.append({
            "role": "assistant",
            "content": str(result.get("answer", "")),
            "result": result,
        })


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행).
if __name__ == "__main__":
    main()
