"""MAS B/C 통신 클라이언트 — 서브프로세스 JSON RPC (API / Function Calling).

분산 MAS에서 MAS B/C는 '그 단위의 venv 파이썬'으로 실행되는 워커 프로세스임(외부 프로세스).
오케스트레이터는 이 모듈의 비동기 함수로 워커를 1회 기동하고, stdin/stdout 으로 JSON을 주고받음.
교재 §2.3 분류상 '외부 연동: API/Function Calling'에 해당하며, 단위 MAS의 공개 API
(PatentTrendRAG.invoke / PatentOpinionMAS 그래프)를 워커 경계에서 함수처럼 호출하는 구조임.

[왜 서브프로세스인가] mas-b 와 mas-c 는 둘 다 config·graph·sources 라는 같은 이름의 패키지를
가짐 → 한 프로세스에 동시 import 하면 충돌함. 프로세스를 분리하면 충돌이 원천 차단되고,
각 단위가 자기 venv 의존성을 그대로 쓸 수 있어 오케스트레이터 venv 가 가벼워짐.

[왜 asyncio.to_thread인가] A∥B 병렬 분기에서 블로킹 subprocess.run 을 워커 스레드로 보내
이벤트 루프를 막지 않게 함(Windows에서 async 서브프로세스보다 견고함). 상위 노드가 다시
asyncio.wait_for 로 감싸 분기별 타임아웃을 건다(계층적 타임아웃, 교재 §7.7).
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import asyncio
import json
import subprocess

from config.settings import MAS_B_DIR, MAS_C_DIR, settings


def _run_worker_sync(python_exe: str, script, request: dict, timeout: int, cwd) -> dict:
    """워커를 1회 기동해 JSON 요청을 stdin 으로 주고 stdout 의 JSON 응답을 파싱해 반환함(블로킹).

    subprocess.run 핵심 옵션:
      - input=payload, text=True, encoding="utf-8": 요청 문자열을 UTF-8로 인코딩해 자식 stdin에 전달
        (자식 워커도 stdin을 UTF-8로 재설정해 인코딩을 일치시킴)
      - capture_output=True: stdout(JSON 응답)·stderr(워커 진행 로그)를 각각 캡처
      - timeout=timeout: 초과 시 TimeoutExpired 를 던지고 자식 프로세스를 종료함(분기 타임아웃)
    실패(타임아웃·빈 출력·JSON 파싱 오류)는 예외 대신 {"ok": False, ...} 로 정규화해
    상위 Supervisor 가 graceful degradation 으로 처리하게 함.
    """
    payload = json.dumps(request, ensure_ascii=False)
    try:
        proc = subprocess.run(
            [python_exe, str(script)],
            input=payload,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            cwd=str(cwd),
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"worker timeout ({timeout}s)", "answer": "",
                "context_items": [], "final_output": ""}
    except Exception as error:  # noqa: BLE001 - 기동 실패(파이썬 경로 오류 등)도 정규화
        return {"ok": False, "error": f"worker spawn failed: {type(error).__name__}: {error}",
                "answer": "", "context_items": [], "final_output": ""}

    out = (proc.stdout or "").strip()
    if not out:
        # stdout 이 비면 워커가 JSON을 못 냈다는 뜻 — stderr 끝부분을 디버깅 힌트로 첨부
        tail = (proc.stderr or "")[-400:]
        return {"ok": False, "error": f"empty worker stdout (rc={proc.returncode})",
                "stderr_tail": tail, "answer": "", "context_items": [], "final_output": ""}
    try:
        return json.loads(out)
    except json.JSONDecodeError as error:
        return {"ok": False, "error": f"worker JSON parse error: {error}",
                "stdout_head": out[:200], "answer": "", "context_items": [], "final_output": ""}


async def call_mas_b(question: str, history: list, timeout: int | None = None) -> dict:
    """MAS B 워커를 비동기로 호출함 (선행기술·동향 리서치, Self-RAG)."""
    return await asyncio.to_thread(
        _run_worker_sync,
        settings.mas_b_python, settings.worker_b_script,
        {"question": question, "history": history},
        timeout or settings.timeout_mas_b, MAS_B_DIR,
    )


async def call_mas_c(question: str, history: list, provided_context: list,
                     timeout: int | None = None) -> dict:
    """MAS C 워커를 비동기로 호출함 (의견서 작성·검증). provided_context = A∥B fan-in 결과."""
    return await asyncio.to_thread(
        _run_worker_sync,
        settings.mas_c_python, settings.worker_c_script,
        {"question": question, "history": history, "provided_context": provided_context},
        timeout or settings.timeout_mas_c, MAS_C_DIR,
    )
