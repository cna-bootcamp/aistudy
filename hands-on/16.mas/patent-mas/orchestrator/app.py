"""특허법 분산 MAS 오케스트레이터 — Streamlit 챗봇 UI (멀티턴 + 글로벌 HITL).

상위 SAS Orchestrator(graph/workflow.py)를 웹 채팅으로 노출함. 질문이 들어오면 Scheduler 가
의도를 분류해 단위 MAS(A=MCP / B·C=워커)를 라우팅하고, 글로벌 Supervisor 가 Budget·검증·HITL 을
통제함. 의견서 작성이 게이트 미통과로 승급(escalated)되면 화면에서 사람 승인(HITL)을 받아 재개함.

[멀티턴] 대화 맥락은 history(누적 메시지)로 그래프에 전달함. 턴마다 새 thread_id 를 써서
턴별 작업 상태(병렬 분기 결과 등 reducer 누적값)가 다음 턴으로 새지 않게 함. checkpointer 는
'턴 내' HITL 인터럽트/재개와 상태 영속에 사용함.

실행: streamlit run app.py   (사전: mas-a 서버 :8010 기동 + mas-b/mas-c venv 준비)
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import asyncio
import sys
import uuid
from pathlib import Path

import streamlit as st

# Windows 기본 인코딩(cp949)에서 노드의 진행 로그 print(한글·'—'·'→' 등)가 터미널에 찍힐 때
# UnicodeEncodeError 로 그래프 실행이 중단되지 않도록 표준출력/표준에러를 UTF-8로 재설정함.
# (run_cli.py 와 동일 — Streamlit ScriptRunner 스레드의 stdout 도 cp949 이므로 여기서 반드시 처리)
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

# streamlit run app.py 로 실행할 때 config/graph/clients 패키지를 찾도록 프로젝트 경로를 추가함
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config.settings import settings
from graph.workflow import build_graph

st.set_page_config(page_title="특허법 분산 MAS", page_icon="⚖️", layout="centered")


# @st.cache_resource: 앱 재시작 전까지 한 번만 실행해 결과를 캐싱함 (그래프·LLM 재생성 방지)
@st.cache_resource
def get_graph():
    """오케스트레이터 그래프를 1회 컴파일해 캐싱함 (체크포인터 포함)."""
    settings.ensure_api_keys()
    return build_graph()


def _new_thread_config() -> dict:
    """이번 질문(턴)용 체크포인트 설정 — 턴마다 고유 thread_id 로 작업 상태 격리."""
    return {"configurable": {"thread_id": str(uuid.uuid4())},
            "recursion_limit": settings.recursion_limit}


def _ainvoke(graph, inputs, config) -> None:
    """비동기 그래프 1스텝 실행 — Streamlit 스크립트 스레드에서 asyncio.run 으로 구동함.

    inputs=None 이면 인터럽트 지점부터 재개함. (seam 검증으로 Windows 스레드+asyncio 안전 확인)
    """
    asyncio.run(graph.ainvoke(inputs, config))


def initialize_session_state() -> None:
    """Streamlit 재실행 사이에 유지할 상태 초기화."""
    # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
    if "messages" not in st.session_state:
        st.session_state.messages = []          # 화면 표시용 [{role, content}]
    if "history" not in st.session_state:
        st.session_state.history = []            # 그래프 전달용 [{role, content}]
    if "pending" not in st.session_state:
        st.session_state.pending = None          # HITL 대기 상태 {config, values}


def render_sidebar() -> None:
    """사이드바: 분산 구성·라우팅 안내·대화 초기화."""
    with st.sidebar:
        st.header("⚖️ 특허법 분산 MAS")
        st.caption("상위 SAS Orchestrator + 단위 MAS A/B/C (2계층 SAS)")
        st.markdown(
            "- **MAS A** 법령지식 · MCP(:%d)\n"
            "- **MAS B** 선행기술·동향 · 워커\n"
            "- **MAS C** 의견서 작성·검증 · 워커\n" % settings.mcp_a_port
        )
        st.divider()
        st.markdown(
            "**라우팅 예시**\n"
            "- 요건/조문 → A\n"
            "- 판례/동향 → B\n"
            "- 의견서 작성 → A∥B → C"
        )
        st.divider()
        if st.button("🗑️ 대화 초기화"):
            st.session_state.messages = []
            st.session_state.history = []
            st.session_state.pending = None
            st.rerun()


def render_review_panel() -> None:
    """글로벌 HITL 승인 패널 — C가 게이트 미통과로 승급된 초안을 사람이 검토·승인/반려함."""
    pending = st.session_state.pending
    values = pending["values"]
    mas_c = values.get("mas_c_result") or {}

    st.warning("🙋 글로벌 HITL: 의견서가 자동 검증 게이트를 통과하지 못해 사람 검토가 필요합니다.")
    st.caption(f"사유: {mas_c.get('gate_reason', '(미상)')}")
    with st.expander("검토 대상 초안 보기", expanded=True):
        st.markdown(mas_c.get("draft") or mas_c.get("final_output") or "(초안 없음)")

    feedback = st.text_input("반려 시 피드백(선택)", key="hitl_feedback")
    col_ok, col_no = st.columns(2)
    approved = None
    if col_ok.button("✅ 승인", use_container_width=True):
        approved = True
    if col_no.button("✋ 반려", use_container_width=True):
        approved = False

    if approved is not None:
        graph = get_graph()
        config = pending["config"]
        # 사람 결정을 기록하고 그래프를 재개 (인터럽트 → finalize 경로)
        graph.update_state(config, {"approved": approved, "review_feedback": feedback})
        _drive_to_completion(graph, config, resume=True)


def _drive_to_completion(graph, config, resume: bool, inputs=None) -> None:
    """그래프를 끝까지 구동함. 글로벌 HITL 인터럽트를 만나면 pending 에 저장 후 패널로 넘김."""
    with st.spinner("단위 MAS 라우팅·실행·취합 중... (병렬 fan-out → 취합)"):
        _ainvoke(graph, None if resume else inputs, config)
        snapshot = graph.get_state(config)
        # interrupt_before(human_review)로 멈췄으면 사람 승인을 받기 위해 패널로 전환
        if snapshot.next:
            st.session_state.pending = {"config": config, "values": snapshot.values}
            st.rerun()

    # 완료 — 최종 답변을 대화에 기록
    values = graph.get_state(config).values
    answer = values.get("final_answer", "(응답 없음)")
    st.session_state.pending = None
    st.session_state.messages.append({"role": "assistant", "content": answer})
    st.session_state.history.append({"role": "assistant", "content": answer})
    st.rerun()


def main() -> None:
    initialize_session_state()
    render_sidebar()
    st.title("특허법 분산 MAS 챗봇")
    st.caption("법령 지식·선행기술·의견서 작성을 단위 MAS로 분담하고, 글로벌 Supervisor가 통제합니다.")

    # 지난 대화 렌더링
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    # HITL 대기 중이면 승인 패널을 우선 렌더링 (입력은 잠시 막힘)
    if st.session_state.pending is not None:
        render_review_panel()
        return

    # st.chat_input: 채팅창 하단 입력란을 렌더링하고 입력값을 반환함
    if user_input := st.chat_input("예: 특허 요건을 설명해줘 / 직무발명 판례 동향 / 거절이유 대응 의견서 작성"):
        st.session_state.messages.append({"role": "user", "content": user_input})
        st.session_state.history.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.markdown(user_input)

        graph = get_graph()
        config = _new_thread_config()
        # 멀티턴 맥락은 history 로 전달(턴별 thread_id 는 작업 상태 격리용)
        inputs = {"question": user_input, "history": st.session_state.history[:-1]}
        _drive_to_completion(graph, config, resume=False, inputs=inputs)


# streamlit 은 스크립트를 매번 위에서 실행하므로 함수 호출만 둠
main()
