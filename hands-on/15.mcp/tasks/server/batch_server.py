"""배치 작업 MCP 서버 — Tasks 확장 실습

오래 걸리는 배치 작업을 동기로 붙잡고 있지 않고 **작업 핸들(taskId)** 로 돌려준 뒤,
클라이언트가 tasks/get으로 폴링하여 결과를 받아가는 흐름을 보여줌.

도구:
  - run_batch(items, delay, fail_at) : 오래 걸리는 배치. Tasks 확장이 가로채 작업으로 실행함
  - ping()                           : 일반(즉시 응답) 도구. 가로채지 않음

STDIO 전송이므로 stdout 출력 금지. 로그는 stderr로만 남김.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# common/ 디렉터리의 공용 와이어 타입을 임포트하기 위한 경로 추가
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "common"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from mcp.server.mcpserver import MCPServer  # noqa: E402
from tasks_extension import TasksExtension, report_progress  # noqa: E402


def _log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


async def run_batch(items: int = 5, delay: float = 0.4, fail_at: int | None = None) -> str:
    """items개 항목을 처리하는 배치 작업. 항목당 delay초가 걸림.

    fail_at을 지정하면 그 번째 항목에서 실패함(실패 상태 확인용).

    진행 보고는 report_progress()로 함. 도구 시그니처에 콜백 파라미터를 두면
    입력 스키마가 오염되고, SDK는 '_'로 시작하는 파라미터도 거부하므로
    ContextVar 기반 통로를 사용함. 동기 실행 중이면 아무 일도 하지 않음.
    """
    processed = 0
    for i in range(1, items + 1):
        await asyncio.sleep(delay)
        if fail_at is not None and i == fail_at:
            raise RuntimeError(f"{i}번째 항목 처리 중 오류 발생")
        processed += 1
        report_progress(f"{processed}/{items} 처리 중")
        _log(f"[batch] {processed}/{items} 처리")
    return f"배치 완료: {processed}건 처리"


mcp = MCPServer(
    "BatchServer",
    instructions="오래 걸리는 배치 작업을 Tasks 확장으로 비동기 실행하는 학습용 서버",
    # 확장 등록: run_batch 도구 호출을 가로채 작업으로 실행함
    extensions=[TasksExtension({"run_batch": run_batch}, poll_interval_ms=300)],
)

# run_batch를 '도구'로도 등록함 → tools/list에 스키마가 노출되고,
# 확장을 선언하지 않은 클라이언트에게는 이 함수가 그대로 동기 실행됨.
# _progress는 키워드 전용(*, 표시) 파라미터라 입력 스키마에 포함되지 않음.
mcp.add_tool(run_batch, name="run_batch")


@mcp.tool()
def ping() -> str:
    """즉시 응답하는 일반 도구 (가로채지 않음)."""
    return "pong"


if __name__ == "__main__":
    mcp.run(transport="stdio")
