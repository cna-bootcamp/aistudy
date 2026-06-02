"""Streamlit 결과 표시 컴포넌트.

검색 모드, 답변, 생성된 Cypher, 출처, 벡터 히트, 그래프 관계를 일관된 방식으로 렌더링함.
"""
from typing import Any

import pandas as pd
import streamlit as st


def display_neo4j_status(connection) -> None:
    """Neo4j 연결 상태와 스키마 표시."""
    try:
        st.success("Neo4j 연결 정상")
        with st.expander("스키마"):
            st.code(connection.get_schema(), language="text")
        warnings = connection.validate_vector_dimensions()
        if warnings:
            for warning in warnings:
                st.warning(warning)
        else:
            st.info("벡터 인덱스 차원 정상: 4096")
    except Exception as exc:
        st.error(f"Neo4j 상태 확인 실패: {exc}")


def display_kg_stats(connection) -> None:
    """KG와 벡터 검색 대상 통계 표시."""
    try:
        stats = connection.get_stats()
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("전체 노드", stats["node_count"])
        col2.metric("엔티티", stats["entity_count"])
        col3.metric("Chunk", stats["chunk_count"])
        col4.metric("관계", stats["relationship_count"])

        with st.expander("라벨 분포"):
            st.dataframe(pd.DataFrame(stats["node_labels"]), width="stretch")
        with st.expander("관계 타입 분포"):
            st.dataframe(pd.DataFrame(stats["relationship_types"]), width="stretch")
        with st.expander("인덱스"):
            index_rows = []
            for row in connection.get_index_info():
                index_rows.append({
                    "name": row.get("name"),
                    "state": row.get("state"),
                    "type": row.get("type"),
                    "labelsOrTypes": ", ".join(row.get("labelsOrTypes") or []),
                    "properties": ", ".join(row.get("properties") or []),
                })
            st.dataframe(pd.DataFrame(index_rows), width="stretch")
    except Exception as exc:
        st.error(f"KG 통계 조회 실패: {exc}")


def display_result(result: dict[str, Any]) -> None:
    """검색 결과를 모드별로 표시."""
    mode = result.get("mode", "unknown")
    requested = result.get("requested_mode")
    reason = result.get("routing_reason")
    caption = f"검색 모드: {mode}"
    if requested and requested != mode:
        caption += f" | 요청: {requested}"
    if reason:
        caption += f" | 라우팅: {reason}"
    st.caption(caption)

    answer = result.get("answer", "")
    if isinstance(answer, list):
        if answer:
            st.dataframe(pd.DataFrame(answer), width="stretch")
        else:
            st.info("결과 없음")
    elif result.get("error"):
        st.warning(str(answer))
    else:
        st.markdown(str(answer))

    cypher = result.get("cypher")
    if cypher:
        with st.expander("Cypher"):
            st.code(cypher, language="cypher")

    sources = result.get("sources") or []
    if sources:
        with st.expander("출처"):
            for source in sources:
                st.write(f"- {source}")

    vector_hits = result.get("vector_hits") or []
    if vector_hits:
        with st.expander("벡터 검색 결과"):
            rows = []
            for hit in vector_hits:
                rows.append({
                    "kind": hit.get("kind"),
                    "id/source": hit.get("id") or hit.get("source"),
                    "labels": ", ".join(hit.get("labels") or []),
                    "score": round(float(hit.get("score", 0)), 4),
                    "preview": (hit.get("description") or hit.get("text") or "")[:160],
                })
            st.dataframe(pd.DataFrame(rows), width="stretch")

    graph_data = result.get("graph_data") or []
    if graph_data:
        with st.expander("그래프 관계/결과"):
            st.dataframe(pd.DataFrame(graph_data), width="stretch")

