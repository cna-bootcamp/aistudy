#!/usr/bin/env python3
"""특허/지식재산권 Agentic RAG 챗봇 (Streamlit 웹 UI)

2-Stage Retrieval(retrieval.py) + LangGraph Agentic RAG(graph.py)를 Streamlit 채팅 앱으로 감싼 진입점임.
사용자 질의가 들어오면 그래프가 스스로 라우팅(법률DB·웹·YouTube)하고, 2-stage 검색·답변 생성·유용성
평가·재작성 루프를 거쳐 답변을 스트리밍함. 중간 단계(라우팅·재정렬 top-5·평가)는 st.status로 가시화함.

[실행]
    streamlit run app.py

[구성]
  - 사이드바  : LLM 모델 선택(Groq), 대화 초기화, 세션 정보
  - 본문      : st.chat_input/st.chat_message 채팅 + st.write_stream 토큰 스트리밍
  - 캐싱      : @st.cache_resource로 임베더·리랭커·컴파일 그래프를 모델명별로 1회만 적재
  - 세션 상태 : thread_id(멀티턴 식별)·messages(대화 이력)·current_model 관리
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import os

# OpenMP 런타임이 여러 패키지(torch·scikit-learn·onnxruntime 등)에서 중복 적재되면 Windows에서 네이티브
# 크래시(Segmentation fault)가 날 수 있어, 중복 적재를 허용해 충돌을 방지함 (torch 임포트 이전에 설정해야 효과 있음).
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import sys
import uuid
from pathlib import Path

import streamlit as st

# 같은 디렉터리의 retrieval/graph 모듈을 import 할 수 있도록 경로를 보정함
SCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(retrieve/)를 절대경로로 구함
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))  # 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 디렉터리를 추가함

from retrieval import TwoStageRetriever, load_reranker, load_vectorstore
from graph import DEFAULT_LLM_MODEL, TwoStageAgenticRAG

# ---------------------------------------------------------------------------
# 상수 정의
# ---------------------------------------------------------------------------
# 사이드바 드롭다운에 노출할 Groq LPU 모델 목록 (기본값은 gpt-oss-120b)
# 라우팅·평가·재작성이 with_structured_output(method="json_schema")에 의존하므로,
# Groq에서 json_schema 응답 형식을 지원하는 것으로 실제 검증된 모델만 포함함
# (llama-3.3-70b·qwen3·deepseek 등은 json_schema 미지원이라 제외).
GROQ_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "meta-llama/llama-4-scout-17b-16e-instruct",
]

APP_TITLE = "특허 Agentic RAG 챗봇"
APP_ICON = "⚖️"
WELCOME_MESSAGE = (
    "안녕하세요! 특허/지식재산권 전문 Agentic RAG 챗봇입니다.\n\n"
    "질문을 입력하면 **법률 벡터DB(2-stage 재정렬)·웹·YouTube**를 스스로 골라 검색하고, "
    "답변의 유용성을 자체 평가해 필요하면 질문을 재작성하여 다시 검색합니다.\n\n"
    "예) `특허 등록 요건을 법률과 영상으로 알려줘`, `특허 출원 비용은?`"
)


# ---------------------------------------------------------------------------
# 캐시된 리소스 (임베더·리랭커·컴파일 그래프)
# ---------------------------------------------------------------------------

@st.cache_resource(show_spinner="임베더·리랭커 적재 중... (최초 1회 KaLM 4-bit ~7GB 로딩, 수십 초 소요)")
def get_retriever() -> TwoStageRetriever:
    """2-stage 검색기를 1회만 적재·워밍업해 캐싱함 (KaLM 임베더 + BGE 리랭커).

    @st.cache_resource: 앱 재실행(rerun) 사이에도 반환값을 재사용해, 무거운 모델을 매 입력마다
    다시 적재하지 않게 함. 임베더·리랭커는 LLM 모델 선택과 무관하므로 인자 없이 단일 인스턴스로 공유함.
    """
    # ★ 반드시 리랭커(CrossEncoder)를 먼저 로드해야 함 ★
    # chromadb(벡터스토어)가 먼저 로드되면 onnxruntime + grpcio 가 CUDA 네이티브를 선점해,
    # 나중에 CrossEncoder 가 CUDA를 초기화할 때 access violation(Segmentation fault)이 발생함.
    # CrossEncoder → chromadb 순서로 로드하면 정상 동작함 (mintest11 로 검증됨).
    reranker = load_reranker()        # 1단계: CrossEncoder 가 CUDA 컨텍스트를 먼저 선점
    vectorstore = load_vectorstore()  # 2단계: chromadb / KaLM 로드 (CUDA 컨텍스트 이미 확보된 상태)
    retriever = TwoStageRetriever(vectorstore, reranker)
    # 스피너가 도는 지금 더미 질의 1회로 KaLM 임베더(7GB)를 미리 적재(워밍업)함.
    # 워밍업 없이 두면 첫 질의 중 화면이 멈춘 듯 보여 강제 종료 → VRAM 좀비 → 다음 실행 OOM 악순환.
    retriever.retrieve("워밍업")
    return retriever


@st.cache_resource(show_spinner="에이전트 그래프 컴파일 중...")
def get_agent(model: str) -> TwoStageAgenticRAG:
    """선택된 LLM 모델로 Agentic RAG 그래프를 구성해 캐싱함 (모델명으로 캐시 키 분리).

    cache_resource는 함수 인자(model)별로 결과를 따로 캐싱하므로, 모델을 바꾸면 해당 모델의
    그래프가 새로 컴파일되고 이전 모델 그래프는 그대로 재사용됨. 검색기는 공유 인스턴스를 받음.
    """
    return TwoStageAgenticRAG(get_retriever(), model=model)


# ---------------------------------------------------------------------------
# 세션 상태 / 사이드바
# ---------------------------------------------------------------------------

def initialize_session_state() -> None:
    """Streamlit 재실행 사이에 유지할 세션 상태(thread_id·messages·current_model)를 초기화함."""
    # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
    if "thread_id" not in st.session_state:
        # uuid4().hex: 멀티턴 대화를 식별하는 임의의 고유 thread_id (MemorySaver 체크포인터 키)
        st.session_state.thread_id = uuid.uuid4().hex
    if "messages" not in st.session_state:
        st.session_state.messages = []
    if "current_model" not in st.session_state:
        st.session_state.current_model = DEFAULT_LLM_MODEL
    if "turn_count" not in st.session_state:
        st.session_state.turn_count = 0


def render_sidebar() -> str:
    """사이드바를 그리고 선택된 LLM 모델명을 반환함 (모델 선택·대화 초기화·세션 정보)."""
    with st.sidebar:
        st.header("⚙️ 설정")
        # 모델 선택 드롭다운: 기본값은 현재 세션 모델 (없으면 gpt-oss-120b)
        default_index = GROQ_MODELS.index(st.session_state.current_model) \
            if st.session_state.current_model in GROQ_MODELS else 0
        selected_model = st.selectbox("LLM 모델 (Groq LPU)", GROQ_MODELS, index=default_index)
        st.caption("임베딩·리랭커는 로컬 GPU 모델로 고정됨 (KaLM / BGE-reranker-ko)")

        st.divider()
        if st.button("🗑️ 대화 초기화", use_container_width=True):
            # 새 thread_id를 발급해 체크포인터 상태와 대화 이력을 모두 비움
            st.session_state.thread_id = uuid.uuid4().hex
            st.session_state.messages = []
            st.session_state.turn_count = 0
            st.rerun()

        st.divider()
        st.metric("대화 턴", st.session_state.turn_count)
        st.caption(f"thread_id: `{st.session_state.thread_id[:8]}…`")
        st.caption(f"현재 모델: `{selected_model}`")

    return selected_model


# ---------------------------------------------------------------------------
# 중간 단계 가시화 (st.status)
# ---------------------------------------------------------------------------

def render_step(status, node: str, update: dict) -> None:
    """그래프 노드 완료 시점의 상태 변경을 st.status 안에 단계별로 표시함 (라우팅·검색·평가)."""
    if node == "check_retrieval":
        needs = update.get("needs_retrieval")
        sources = update.get("sources") or []
        status.update(label="🧭 검색 전략 판단 완료")
        status.markdown(
            f"**1) 라우팅** · 법률DB 필요: `{needs}` · 소스: `{', '.join(sources) or '없음 (웹 직접 답변)'}`"
        )
        status.caption(f"근거: {update.get('route_reasoning', '')}")

    elif node == "search":
        docs = update.get("vector_docs") or []
        web = update.get("web_results") or []
        youtube = update.get("youtube_results") or []
        status.update(label="🔎 2-stage 검색 완료")
        status.markdown(
            f"**2) 검색** · 벡터DB 재정렬 top-{len(docs)} · 웹 {len(web)}건 · YouTube {len(youtube)}건"
        )
        # 재정렬 상위 문서를 Cross-encoder 관련도 점수와 함께 표시함 (2-stage 효과 가시화)
        for rank, doc in enumerate(docs, 1):
            meta = doc.metadata
            score = meta.get("rerank_score", 0.0)
            preview = doc.page_content[:90].replace("\n", " ")
            status.markdown(f"&nbsp;&nbsp;`{rank}` {meta.get('source', '?')} #{meta.get('chunk_index', '?')} "
                            f"· 관련도 `{score:.3f}` — {preview}…")

    elif node in ("generate", "generate_direct"):
        status.update(label="✍️ 답변 생성 중...")

    elif node == "evaluate":
        useful = update.get("is_useful")
        status.markdown(f"**3) 유용성 평가** · 유용함: `{useful}`")
        status.caption(update.get("usefulness_reasoning", ""))

    elif node == "rewrite":
        rewrites = update.get("rewrites") or []
        if rewrites:
            status.markdown(f"**🔄 질문 재작성** → `{rewrites[-1]['to']}`")


# ---------------------------------------------------------------------------
# 처리 과정 로그 렌더링
# ---------------------------------------------------------------------------

def render_process_log(final_state: dict) -> None:
    """처리 과정 로그를 접이식 expander로 렌더링함.

    final_state 에 저장된 라우팅·검색·평가·재작성 정보를 학습용으로 정리해 표시함.
    graph.py 변경 없이 기존 final_state 데이터를 그대로 활용함.
    """
    # 표시할 항목이 하나도 없으면 expander 자체를 렌더링하지 않음
    has_routing = final_state.get("route_reasoning") is not None
    has_vector = bool(final_state.get("vector_docs"))
    has_web = bool(final_state.get("web_results"))
    has_youtube = bool(final_state.get("youtube_results"))
    has_eval = final_state.get("is_useful") is not None
    if not any([has_routing, has_vector, has_web, has_youtube, has_eval]):
        return

    with st.expander("🔍 처리 과정 로그", expanded=False):
        section = 0  # 섹션 번호를 동적으로 부여함

        # ── 1) 라우팅 결과 ──────────────────────────────────────────────────
        if has_routing:
            section += 1
            needs = final_state.get("needs_retrieval", False)
            sources = final_state.get("sources") or []
            st.markdown(f"**{section}) 라우팅**")

            col1, col2 = st.columns(2)
            with col1:
                st.metric("법률DB 검색", "✅ 필요" if needs else "⏭️ 불필요")
            with col2:
                st.metric("선택 소스", ", ".join(sources) if sources else "없음")

            # 소스별 최적화 쿼리 표시
            query_lines = []
            if final_state.get("vectordb_query"):
                query_lines.append(f"**vectordb**: `{final_state['vectordb_query']}`")
            if final_state.get("web_query"):
                query_lines.append(f"**web**: `{final_state['web_query']}`")
            if final_state.get("youtube_query"):
                query_lines.append(f"**youtube**: `{final_state['youtube_query']}`")
            if query_lines:
                st.markdown("  \n".join(query_lines))

            if final_state.get("route_reasoning"):
                st.caption(f"판단 근거: {final_state['route_reasoning']}")

        # ── 2) 벡터DB 2-Stage 재정렬 top-5 ───────────────────────────────
        if has_vector:
            section += 1
            vector_docs = final_state["vector_docs"]
            st.divider()
            st.markdown(f"**{section}) 벡터DB 2-Stage 재정렬 top-{len(vector_docs)}**")
            for rank, doc in enumerate(vector_docs, 1):
                meta = doc.metadata
                score = meta.get("rerank_score", 0.0)
                source = meta.get("source", "?")
                chunk_idx = meta.get("chunk_index", "?")
                preview = doc.page_content[:120].replace("\n", " ")
                # score 막대: ████ 형태로 관련도를 시각적으로 표현 (0~1 → 0~10칸)
                bar = "█" * round(score * 10) + "░" * (10 - round(score * 10))
                st.markdown(
                    f"`{rank}` **{source}** #{chunk_idx} &nbsp; "
                    f"`{bar}` `{score:.3f}`  \n"
                    f"<small>{preview}…</small>",
                    unsafe_allow_html=True,
                )

        # ── 3) 웹 검색 결과 ──────────────────────────────────────────────
        if has_web:
            section += 1
            web_results = final_state["web_results"]
            st.divider()
            st.markdown(f"**{section}) 웹 검색 결과 ({len(web_results)}건)**")
            for item in web_results:
                title = item.get("title", "제목 없음")
                link = item.get("link", "")
                if link:
                    st.markdown(f"- [{title}]({link})")
                else:
                    st.markdown(f"- {title}")

        # ── 4) YouTube 검색 결과 ─────────────────────────────────────────
        if has_youtube:
            section += 1
            youtube_results = final_state["youtube_results"]
            st.divider()
            st.markdown(f"**{section}) YouTube 검색 결과 ({len(youtube_results)}건)**")
            for item in youtube_results:
                title = item.get("title", "제목 없음")
                url = item.get("url", "")
                channel = item.get("channel", "")
                published = f" · {item['published']}" if item.get("published") else ""
                transcript_count = len(item.get("transcript_chunks") or [])
                transcript_note = f" · 자막 {transcript_count}청크" if transcript_count else " · 자막 없음"
                if url:
                    st.markdown(f"- [{title}]({url})  \n  <small>{channel}{published}{transcript_note}</small>",
                                unsafe_allow_html=True)
                else:
                    st.markdown(f"- {title}")

        # ── 5) 유용성 평가 + 재작성 이력 ─────────────────────────────────
        if has_eval:
            section += 1
            is_useful = final_state["is_useful"]
            retry_count = final_state.get("retry_count", 0)
            rewrites = final_state.get("rewrites") or []

            st.divider()
            st.markdown(f"**{section}) 유용성 평가**")
            st.markdown(f"유용함: {'✅ 예' if is_useful else '❌ 아니오 → 재작성'}")
            if final_state.get("usefulness_reasoning"):
                st.caption(final_state["usefulness_reasoning"])

            # 재작성 이력 (재시도가 있었을 때만 표시)
            if retry_count > 0 and rewrites:
                st.markdown(f"**질의 재작성 이력 ({retry_count}회)**")
                for i, rw in enumerate(rewrites, 1):
                    st.markdown(
                        f"`{i}회` `{rw.get('from', '')}` → `{rw.get('to', '')}`"
                    )
                    if rw.get("reasoning"):
                        st.caption(rw["reasoning"])


# ---------------------------------------------------------------------------
# 채팅 처리
# ---------------------------------------------------------------------------

def display_chat_history() -> None:
    """저장된 대화 이력을 Streamlit 채팅 UI에 표시함."""
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])


def handle_user_input(agent: TwoStageAgenticRAG, question: str) -> None:
    """사용자 질문을 처리해 라우팅·검색 단계를 가시화하고 답변을 스트리밍함."""
    # 사용자 메시지를 기록·표시함
    st.session_state.messages.append({"role": "user", "content": question})
    with st.chat_message("user"):
        st.markdown(question)

    # 이번 질문 이전까지의 대화만 맥락(history)으로 전달함 (현재 질문은 question 인자로 별도 전달)
    history = st.session_state.messages[:-1]

    with st.chat_message("assistant"):
        # st.status: 진행 단계를 접을 수 있는 상태 박스로 표시함 (라우팅·검색·평가 가시화)
        status = st.status("🧭 검색 전략을 판단하는 중...", expanded=True)

        def token_stream():
            """그래프를 스트리밍 실행하며 단계는 status에 그리고, 답변 토큰만 yield함."""
            for kind, node, payload in agent.stream_events(question, history, st.session_state.thread_id):
                if kind == "update":
                    render_step(status, node, payload)
                    # 재작성 루프가 발생하면 답변 흐름에 구분선을 넣어 재생성 사실을 알림
                    if node == "rewrite":
                        yield "\n\n---\n\n*🔄 답변을 개선하기 위해 다시 검색합니다...*\n\n"
                elif kind == "token":
                    yield payload

        # st.write_stream: 제너레이터가 yield하는 토큰을 실시간으로 누적 렌더링하고 전체 문자열을 반환함
        body = st.write_stream(token_stream())

        # 최종 상태에서 출처 섹션을 가져와 본문 아래에 덧붙임 (URL 누락 방지, 본문과 분리 렌더)
        final_state = agent.get_final_state(st.session_state.thread_id)
        sources_md = final_state.get("sources_md") or ""
        if sources_md:
            st.markdown(sources_md)

        # 처리 과정 로그: 라우팅·재정렬 top-5·웹/YouTube 결과·유용성 평가를 접이식으로 표시함
        render_process_log(final_state)

        # 대화 이력에는 본문 + 출처가 합쳐진 최종 답변을 저장함 (재실행 시 그대로 표시)
        full_answer = final_state.get("answer") or body

        status.update(label="✅ 처리 완료", state="complete", expanded=False)

    st.session_state.messages.append({"role": "assistant", "content": full_answer})
    st.session_state.turn_count += 1


# ---------------------------------------------------------------------------
# 메인
# ---------------------------------------------------------------------------

def main() -> None:
    """Streamlit 앱 진입점: 세션·사이드바·에이전트를 준비하고 채팅 루프를 구동함."""
    st.set_page_config(page_title=APP_TITLE, page_icon=APP_ICON, layout="centered")
    st.title(f"{APP_ICON} {APP_TITLE}")
    st.caption("2-Stage Retrieval (KaLM → BGE-reranker) + LangGraph Agentic RAG · LLM: Groq LPU")

    initialize_session_state()
    selected_model = render_sidebar()
    st.session_state.current_model = selected_model

    # 무거운 리소스·그래프를 준비함 (벡터DB 부재·API 키 미설정 등은 친절한 오류로 안내)
    try:
        agent = get_agent(selected_model)
    except (FileNotFoundError, RuntimeError) as error:
        st.error(f"초기화 실패: {error}")
        st.stop()

    # 첫 진입 시 환영 메시지를 표시함
    if not st.session_state.messages:
        with st.chat_message("assistant"):
            st.markdown(WELCOME_MESSAGE)

    display_chat_history()

    # st.chat_input: 채팅창 하단 입력란을 렌더링하고 입력값을 반환함 / := 는 검사와 동시에 값 할당
    if question := st.chat_input("특허/지식재산권에 대해 질문하세요"):
        handle_user_input(agent, question)


if __name__ == "__main__":  # 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
    main()
