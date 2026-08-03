"""Tasks 확장 클라이언트 — 완료 / 실패 / 취소 3가지 상태를 모두 확인함

시나리오
  1) 완료 : run_batch(items=4) → taskId 발급 → tasks/get 폴링 → completed
  2) 실패 : run_batch(items=4, fail_at=2) → failed + 에러 메시지
  3) 취소 : 작업 핸들만 받아두고 tasks/cancel 호출 → cancelled
  4) 대조 : 확장을 선언하지 않은 클라이언트는 같은 도구가 '동기'로 실행됨
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# common/ 의 공용 와이어 타입을 임포트하기 위한 경로 추가
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "common"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from mcp import Client, StdioServerParameters, stdio_client  # noqa: E402

from task_protocol import TaskCreatedResult  # noqa: E402
from tasks_client_extension import (  # noqa: E402
    TasksClientExtension,
    cancel_task,
    get_task,
)

SERVER_SCRIPT = Path(__file__).resolve().parent.parent / "server" / "batch_server.py"


def _text(blocks) -> str:
    return "".join(getattr(b, "text", str(b)) for b in blocks)


def _transport():
    """서버를 자식 프로세스로 띄우는 STDIO 전송을 만듦.

    Client에 StdioServerParameters를 그대로 넘기면 안 되고,
    반드시 stdio_client(...)로 감싼 전송 객체를 넘겨야 함.
    (문자열을 넘기면 Streamable HTTP URL로 해석됨)
    """
    return stdio_client(StdioServerParameters(command=sys.executable, args=[str(SERVER_SCRIPT)]))


async def scenario_completed() -> None:
    print("\n" + "=" * 70)
    print("[시나리오 1] 완료 — taskId 발급 → tasks/get 폴링 → completed")
    print("=" * 70)
    async with Client(_transport(), extensions=[TasksClientExtension()]) as client:
        result = await client.call_tool("run_batch", {"items": 4, "delay": 0.3})
        print(f"  최종 is_error: {result.is_error}")
        print(f"  최종 결과   : {_text(result.content)}")


async def scenario_failed() -> None:
    print("\n" + "=" * 70)
    print("[시나리오 2] 실패 — 2번째 항목에서 예외 → failed")
    print("=" * 70)
    async with Client(_transport(), extensions=[TasksClientExtension()]) as client:
        result = await client.call_tool(
            "run_batch", {"items": 4, "delay": 0.2, "fail_at": 2}
        )
        print(f"  최종 is_error: {result.is_error}")
        print(f"  최종 결과   : {_text(result.content)}")


async def scenario_cancelled() -> None:
    print("\n" + "=" * 70)
    print("[시나리오 3] 취소 — 작업 핸들만 받고 tasks/cancel 호출")
    print("=" * 70)
    # 확장을 등록하되 자동 폴링을 피하기 위해 저수준 session.call_tool(allow_claimed=True)를 사용함.
    # allow_claimed=True를 주면 SDK가 resolve()를 돌리지 않고 원본 결과를 그대로 넘겨줌.
    async with Client(_transport(), extensions=[TasksClientExtension()]) as client:
        created = await client.session.call_tool(
            "run_batch", {"items": 10, "delay": 0.4}, allow_claimed=True
        )
        assert isinstance(created, TaskCreatedResult), type(created)
        print(f"  작업 핸들: taskId={created.task_id} status={created.status}")

        await asyncio.sleep(0.9)
        state = await get_task(client.session, created.task_id)
        print(f"  폴링 1회 : status={state.status} ({state.status_message})")

        cancelled = await cancel_task(client.session, created.task_id)
        print(f"  취소 요청 : status={cancelled.status} ({cancelled.status_message})")

        await asyncio.sleep(0.5)
        final = await get_task(client.session, created.task_id)
        print(f"  최종 상태 : status={final.status}")


async def scenario_no_extension() -> None:
    print("\n" + "=" * 70)
    print("[시나리오 4] 대조 — 확장을 선언하지 않으면 같은 도구가 동기 실행됨")
    print("=" * 70)
    async with Client(_transport()) as client:  # extensions 미지정
        tools = await client.list_tools()
        print(f"  도구 목록: {[t.name for t in tools.tools]}")
        print("  run_batch 동기 호출 (완료까지 블로킹)...")
        result = await client.call_tool("run_batch", {"items": 3, "delay": 0.2})
        print(f"  결과: {_text(result.content)}")


async def main() -> None:
    await scenario_completed()
    await scenario_failed()
    await scenario_cancelled()
    await scenario_no_extension()
    print("\n모든 시나리오 완료")


if __name__ == "__main__":
    asyncio.run(main())
