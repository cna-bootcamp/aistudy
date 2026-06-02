"""MAS C 서브프로세스 워커 — 오케스트레이터가 '외부 프로세스'로 호출하는 진입점.

분산 MAS에서 MAS C(의견서 작성·검증)는 자체 venv·자체 의존성을 가진 독립 단위임.
mas-b 와 동일한 이유(패키지명 충돌·의존성 격리)로 'C의 venv 파이썬'으로 실행하는 서브프로세스로 격리함.

[입출력 계약 — stdio JSON RPC]
  입력(stdin) : {"question": str, "history": [...], "provided_context": [{source,title,content,citation}]}
  출력(stdout): {"ok": bool, "final_output": str, "draft": str, "gate_passed": bool, "escalated": bool, ...}

[HITL 위치] C 내부의 interrupt_before(human_review)는 여기서 '자동 승인'으로 통과시킴.
실제 사람 승인 게이트는 상위 오케스트레이터가 가짐 — C가 escalated=True 를 돌려주면 상위 Supervisor가
사람 검토로 승급함(교재 §9.2: 글로벌 Supervisor의 HITL). 즉 게이트는 한 곳(상위)에만 둠.

실행: <mas-c/venv 파이썬> mas_c_worker.py   (오케스트레이터가 자동 기동, 직접 실행 불필요)
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import json
import sys
import traceback
import uuid
from pathlib import Path

# 이 파일 기준으로 단위 MAS C 경로를 도출함
# 이 파일: patent-mas/orchestrator/workers/mas_c_worker.py
_WORKER_DIR = Path(__file__).resolve().parent          # 이 파일이 위치한 디렉터리 절대경로
MAS_C_DIR = _WORKER_DIR.parents[1] / "mas-c"           # 단위 MAS C 프로젝트 루트

# Windows 기본 인코딩(cp949)에서 한글이 깨지지 않도록 표준입출력 3종을 모두 UTF-8로 재설정함.
# stdin 까지 반드시 포함해야 함 — 부모가 UTF-8로 보낸 요청을 자식이 cp949로 읽으면 글자가
# surrogate 로 깨져 Groq 요청 인코딩 단계에서 UnicodeEncodeError 가 발생함.
for _stream in (sys.stdin, sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# 파이썬 모듈 검색 경로 맨 앞에 mas-c 를 추가함 → `from graph.workflow import ...` 가 C를 가리킴
sys.path.insert(0, str(MAS_C_DIR))


def _run(request: dict) -> dict:
    """요청 1건으로 MAS C 그래프를 끝까지 구동하고(HITL 자동 승인) 최종 상태를 dict로 반환함.

    C 그래프는 checkpointer + interrupt_before(['human_review'])로 컴파일되어 있어,
    사람 승인 직전에 멈춤. 워커는 update_state 로 '자동 승인'을 기록한 뒤 invoke(None)으로 재개함
    (mas-c/app.py 의 run_with_hitl 과 동일한 구동 방식, 승인 콜백만 자동화).
    """
    from config import settings
    from graph.workflow import PatentOpinionMAS, build_llm

    question = request.get("question", "")
    history = request.get("history", []) or []
    # 오케스트레이터가 A∥B fan-in 결과를 주입함. 있으면 C는 자체 MCP 수집을 건너뜀.
    provided_context = request.get("provided_context", []) or []

    agent = PatentOpinionMAS(build_llm())
    # thread_id: 이 요청의 체크포인트 식별자(요청마다 고유). recursion_limit 로 재작성 루프 여유 확보
    config = {"configurable": {"thread_id": str(uuid.uuid4())},
              "recursion_limit": settings.RECURSION_LIMIT}
    initial = agent.initial_state(question, history, provided_context)

    agent.graph.invoke(initial, config)  # human_review 직전(interrupt_before)에서 멈춤
    while True:
        snapshot = agent.graph.get_state(config)
        if not snapshot.next:            # 더 실행할 노드가 없으면 종료
            state = snapshot.values
            break
        # 워커 단계의 사람 승인은 자동 통과 — 실제 HITL 게이트는 상위 오케스트레이터가 가짐
        agent.graph.update_state(config, {"approved": True, "review_feedback": ""})
        agent.graph.invoke(None, config)

    report = state.get("citation_report") or {}
    return {
        "ok": True,
        "final_output": state.get("final_output", ""),
        "draft": state.get("draft", ""),
        "gate_passed": state.get("gate_passed"),
        "gate_reason": state.get("gate_reason", ""),
        "escalated": bool(state.get("escalated")),
        "is_supported": state.get("is_supported"),
        "retry_count": state.get("retry_count", 0),
        # 인용 검증 요약 (상위 Supervisor 출력 검증·UI 표시용)
        "citation_summary": {
            "verdict": ("판정불가" if report.get("ok") is None
                        else ("정상" if report.get("ok") else "환각탐지")),
            "total": report.get("total", 0),
            "errors": report.get("errors", 0),
            "hallucinated": report.get("hallucinated", []),
        },
        "dlp_findings_count": len(state.get("dlp_findings", [])),
        "context_items_count": len(state.get("context_items", [])),
    }


def main() -> int:
    """stdin JSON 요청을 처리하고 stdout 으로 JSON 응답 1줄을 기록함."""
    # 원래 stdout 을 보관하고, 그래프 실행 동안 출력 채널을 stderr 로 돌려 JSON 오염을 막음
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        raw = sys.stdin.read()  # EOF까지 전체를 읽어 1개 JSON으로 파싱함
        request = json.loads(raw) if raw and raw.strip() else {}
        response = _run(request)
    except Exception as error:  # noqa: BLE001 - 어떤 실패도 JSON 오류로 변환해 오케스트레이터가 graceful 처리하게 함
        response = {
            "ok": False,
            "final_output": "",
            "draft": "",
            "error": f"{type(error).__name__}: {error}",
            "trace": traceback.format_exc()[-1500:],
        }
    finally:
        sys.stdout = real_stdout  # 최종 JSON 기록 전에 출력 채널 복구

    real_stdout.write(json.dumps(response, ensure_ascii=False))
    real_stdout.flush()
    return 0 if response.get("ok") else 1


# 이 파일을 직접 실행할 때만 main 을 수행함 (import 시 미실행)
if __name__ == "__main__":
    sys.exit(main())
