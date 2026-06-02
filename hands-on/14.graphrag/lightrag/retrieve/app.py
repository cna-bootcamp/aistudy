"""LightRAG GraphRAG 검색 Streamlit 앱.

교재 KG+Vector 검색(naive/local/global/hybrid/mix)과 예제코드 벡터 검색(code)을
하나의 채팅 인터페이스에서 실행함.
"""
# 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함
from __future__ import annotations

from dataclasses import asdict
import logging

import pandas as pd
import streamlit as st

from config.settings import Settings
from logging_config import configure_logging
from models import ALL_MODES, SearchResult
from search_service import SearchService


logger = logging.getLogger(__name__)


# @st.cache_resource: 앱 재시작 전까지 한 번만 실행하여 결과를 캐싱함
@st.cache_resource
def get_service() -> SearchService:
    """검색 서비스와 LightRAG/nano-vectordb 리소스를 캐싱."""
    settings = Settings()
    configure_logging(settings)
    logger.info("검색 서비스 초기화: log_file=%s", settings.retrieve_log_file)
    return SearchService(settings)


def init_session() -> None:
    """Streamlit 채팅 메시지 세션 상태 초기화."""
    # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
    if "messages" not in st.session_state:
        st.session_state.messages = []


def render_sources(result: SearchResult) -> None:
    """답변 아래에 검색 모드와 출처를 표시."""
    with st.expander("검색 정보", expanded=False):
        st.markdown(
            f"- 모드: `{result.mode}`\n"
            f"- 라우팅: `{result.decision.strategy}` / confidence `{result.decision.confidence:.2f}`\n"
            f"- 근거: {result.decision.reason}\n"
            f"- 시간: `{result.elapsed_seconds:.2f}s`"
        )
        if not result.sources:
            st.info("표시할 출처 없음")
            return

        rows = []
        for source in result.sources:
            item = asdict(source)
            item["content"] = (item.get("content") or "")[:240]
            rows.append(item)
        st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)


def build_history() -> list[dict[str, str]]:
    """LightRAG에 전달할 최근 대화 이력 생성."""
    history = []
    for message in st.session_state.messages[-8:]:
        if message["role"] in ("user", "assistant"):
            history.append({"role": message["role"], "content": message["content"]})
    return history


def main() -> None:
    """Streamlit 앱 진입점."""
    settings = Settings()
    configure_logging(settings)
    logger.info("Streamlit 앱 실행: log_file=%s", settings.retrieve_log_file)

    st.set_page_config(page_title="LightRAG GraphRAG 검색", layout="wide")
    st.title("LightRAG GraphRAG 검색")
    init_session()

    try:
        service = get_service()
    except RuntimeError as exc:
        st.error(str(exc))
        st.stop()
    settings = service.settings

    with st.sidebar:
        selected_mode = st.selectbox("검색 모드", ALL_MODES, index=0)
        top_k = st.slider("교재 Top-K", min_value=1, max_value=20, value=settings.top_k)
        chunk_top_k = st.slider("청크 Top-K", min_value=1, max_value=20, value=settings.chunk_top_k)
        code_top_k = st.slider("코드 Top-K", min_value=1, max_value=10, value=settings.code_top_k)
        if st.button("대화 초기화", use_container_width=True):
            st.session_state.messages = []
            st.rerun()

    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
            if message["role"] == "assistant" and message.get("result"):
                render_sources(message["result"])

    # st.chat_input: 채팅창 하단 입력란을 렌더링하고 입력값을 반환함
    if question := st.chat_input("질문 입력"):
        logger.info(
            "사용자 질문 수신: selected_mode=%s, top_k=%s, chunk_top_k=%s, code_top_k=%s, question=%s",
            selected_mode,
            top_k,
            chunk_top_k,
            code_top_k,
            question,
        )
        st.session_state.messages.append({"role": "user", "content": question})
        with st.chat_message("user"):
            st.markdown(question)

        with st.chat_message("assistant"):
            with st.spinner("검색 중"):
                result = service.search(
                    question,
                    selected_mode=selected_mode,
                    top_k=top_k,
                    chunk_top_k=chunk_top_k,
                    code_top_k=code_top_k,
                    history=build_history(),
                )
            st.markdown(result.answer)
            render_sources(result)

        st.session_state.messages.append({
            "role": "assistant",
            "content": result.answer,
            "result": result,
        })


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
