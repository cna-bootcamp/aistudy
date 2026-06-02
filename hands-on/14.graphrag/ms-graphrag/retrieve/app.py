"""Streamlit chat UI for Microsoft GraphRAG retrieval."""

from __future__ import annotations

import logging
import traceback

import streamlit as st

from config import settings, validate_paths
from llm import GraphRAGCompletion
from logging_config import configure_logging
from question_condenser import condense_question
from retriever import CodeVectorRetriever, GraphRAGRetriever, RetrievalError, SearchResult
from router import MODE_LABELS, QueryRouter

logger = logging.getLogger(__name__)


st.set_page_config(
    page_title="MS GraphRAG Search",
    layout="wide",
)


@st.cache_resource(show_spinner=False)
def get_router(min_confidence: float) -> QueryRouter:
    return QueryRouter(min_confidence=min_confidence)


@st.cache_resource(show_spinner=False)
def get_graph_retriever(
    query_model: str,
    response_type: str,
    community_level: int,
    dynamic_global_selection: bool,
    drift_json_retries: int,
) -> GraphRAGRetriever:
    return GraphRAGRetriever(
        query_model=query_model,
        response_type=response_type,
        community_level=community_level,
        dynamic_global_selection=dynamic_global_selection,
        drift_json_retries=drift_json_retries,
    )


@st.cache_resource(show_spinner=False)
def get_code_retriever(query_model: str, code_top_k: int) -> CodeVectorRetriever:
    return CodeVectorRetriever(query_model=query_model, top_k=code_top_k)


@st.cache_resource(show_spinner=False)
def get_condenser_llm() -> GraphRAGCompletion | None:
    """질문 재작성용 LLM 캐싱 — 초기화 실패 시 None 반환."""
    try:
        return GraphRAGCompletion()
    except Exception as exc:
        logger.warning("condenser LLM 초기화 실패: %s", exc)
        return None


def init_state() -> None:
    if "messages" not in st.session_state:
        st.session_state.messages = []


def build_history() -> list[dict[str, str]]:
    """현재 턴 이전까지의 대화 이력 반환 — condense_question 입력용."""
    return [
        {"role": m["role"], "content": m["content"]}
        for m in st.session_state.messages[-8:]
        if m["role"] in ("user", "assistant")
    ]


def render_sidebar() -> dict[str, object]:
    with st.sidebar:
        st.header("검색 설정")
        mode_label = st.selectbox(
            "검색 모드",
            ["Auto", "Basic", "Local", "Global", "DRIFT", "Code"],
            index=0,
        )
        query_model = st.text_input("Groq LLM", value=settings.llm_model)
        response_type = st.text_input("응답 형식", value=settings.response_type)
        community_level = st.number_input(
            "Community level",
            min_value=0,
            max_value=10,
            value=settings.community_level,
            step=1,
        )
        code_top_k = st.slider("Code Top-K", 1, 12, settings.code_top_k)
        router_min_confidence = st.slider(
            "Auto 라우터 최소 확신도",
            0.1,
            0.95,
            settings.router_min_confidence,
            0.05,
        )
        drift_json_retries = st.number_input(
            "DRIFT JSON 재시도",
            min_value=0,
            max_value=5,
            value=settings.drift_json_retries,
            step=1,
        )
        dynamic_global_selection = st.toggle(
            "Global 동적 커뮤니티 선택",
            value=settings.dynamic_global_selection,
        )
        show_trace = st.toggle("오류 상세 표시", value=False)

    selected_mode = mode_label.lower()
    return {
        "selected_mode": selected_mode,
        "query_model": query_model,
        "response_type": response_type,
        "community_level": int(community_level),
        "code_top_k": int(code_top_k),
        "router_min_confidence": float(router_min_confidence),
        "drift_json_retries": int(drift_json_retries),
        "dynamic_global_selection": bool(dynamic_global_selection),
        "show_trace": bool(show_trace),
    }


def render_result(result: SearchResult) -> None:
    st.markdown(result.answer or "검색 결과가 비어 있음")
    meta_bits = [
        f"mode={MODE_LABELS[result.mode]}",
        f"requested={MODE_LABELS[result.requested_mode]}",
        f"confidence={result.route.confidence:.2f}",
    ]
    if result.route.used_llm_fallback:
        meta_bits.append("router=LLM fallback")
    st.caption(" · ".join(meta_bits))

    if result.fallback_reason:
        st.warning(result.fallback_reason)

    with st.expander("출처 및 라우팅 근거", expanded=False):
        st.write(result.route.reason)
        if not result.sources:
            st.info("표시할 출처가 없음")
            return
        for idx, source in enumerate(result.sources, start=1):
            st.markdown(f"**[{idx}] {source.source_type} · {source.title}**")
            st.caption(source.metadata)
            st.code(source.content[:1800], language="text")


def run_query(prompt: str, options: dict[str, object], history: list[dict[str, str]] | None = None) -> SearchResult:
    # 대화 이력이 있으면 후속 질문을 독립 질문으로 재작성 (retrieval 임베딩 품질 향상)
    condensed = condense_question(prompt, history, get_condenser_llm()) if history else prompt
    logger.info("질문 수신: original=%s, rewritten=%s", prompt, condensed != prompt)

    router = get_router(float(options["router_min_confidence"]))
    route = router.route(condensed, options["selected_mode"])  # type: ignore[arg-type]

    if route.mode == "code":
        retriever = get_code_retriever(
            str(options["query_model"]),
            int(options["code_top_k"]),
        )
        result = retriever.search(condensed, route, history)
        logger.info("검색 완료: mode=%s, reason=%s", result.mode, result.route.reason)
        return result

    retriever = get_graph_retriever(
        str(options["query_model"]),
        str(options["response_type"]),
        int(options["community_level"]),
        bool(options["dynamic_global_selection"]),
        int(options["drift_json_retries"]),
    )
    result = retriever.search(condensed, route)
    logger.info("검색 완료: mode=%s, reason=%s", result.mode, result.route.reason)
    return result


def main() -> None:
    configure_logging()
    init_state()
    options = render_sidebar()
    missing = validate_paths()

    st.title("Microsoft GraphRAG 검색")
    if missing:
        st.error("필수 인덱싱 산출물이 없습니다.")
        st.code("\n".join(missing), language="text")
        st.stop()

    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            if message["role"] == "assistant" and isinstance(message.get("result"), SearchResult):
                render_result(message["result"])
            else:
                st.markdown(message["content"])

    prompt = st.chat_input("GraphRAG 교재 또는 예제코드에 대해 질문")
    if not prompt:
        return

    history = build_history()  # 현재 턴 추가 전 이력 수집
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        try:
            with st.spinner("검색 중"):
                result = run_query(prompt, options, history)
            render_result(result)
            st.session_state.messages.append(
                {"role": "assistant", "content": result.answer, "result": result}
            )
        except RetrievalError as exc:
            st.error(str(exc))
            st.session_state.messages.append({"role": "assistant", "content": str(exc)})
        except Exception as exc:
            st.error(f"검색 중 오류 발생: {exc}")
            if options["show_trace"]:
                st.code(traceback.format_exc(), language="text")
            st.session_state.messages.append({"role": "assistant", "content": str(exc)})


if __name__ == "__main__":
    main()
