"""클라이언트 측 Tasks 확장 구현 (io.modelcontextprotocol/tasks)

SDK의 mcp.client.extension.ClientExtension / ResultClaim 위에 직접 구현함.

ResultClaim은 "이 resultType을 내가 처리하겠다"는 선언임.
서버가 tools/call에 resultType="task"를 돌려주면 SDK가 resolve()를 호출하고,
resolve()는 tasks/get으로 종료 상태까지 폴링한 뒤 **평범한 CallToolResult**를 반환함.
덕분에 호출부는 await client.call_tool(...) 한 줄 그대로 유지됨.
"""

from __future__ import annotations

import asyncio
from collections.abc import Sequence
from typing import Any

import mcp_types as types
from mcp.client.extension import ClaimContext, ClientExtension, ResultClaim

from task_protocol import (
    EXTENSION_ID,
    TASK_RESULT_TYPE,
    TERMINAL_STATUSES,
    CancelTaskRequest,
    GetTaskRequest,
    TaskCreatedResult,
    TaskIdParams,
    TaskStateResult,
)


async def get_task(session: Any, task_id: str) -> TaskStateResult:
    """tasks/get 한 번 호출 (수동 폴링용)."""
    return await session.send_request(
        GetTaskRequest(params=TaskIdParams(task_id=task_id)),
        TaskStateResult,
    )


async def cancel_task(session: Any, task_id: str) -> TaskStateResult:
    """tasks/cancel 호출 (협조적 취소 요청)."""
    return await session.send_request(
        CancelTaskRequest(params=TaskIdParams(task_id=task_id)),
        TaskStateResult,
    )


def _to_call_tool_result(state: TaskStateResult) -> types.CallToolResult:
    """종료 상태의 작업을 평범한 CallToolResult로 변환함."""
    if state.status == "completed" and state.result is not None:
        return types.CallToolResult.model_validate(state.result)

    if state.status == "failed":
        message = (state.error or {}).get("message") or state.status_message or "작업 실패"
        text = f"[작업 실패] {message}"
    elif state.status == "cancelled":
        text = f"[작업 취소] {state.status_message or ''}".rstrip()
    else:
        text = f"[작업 상태 {state.status}] {state.status_message or ''}".rstrip()

    return types.CallToolResult(
        content=[types.TextContent(type="text", text=text)],
        is_error=state.status != "cancelled",
    )


class TasksClientExtension(ClientExtension):
    """resultType="task"를 받아 종료 상태까지 폴링하는 클라이언트 확장."""

    identifier = EXTENSION_ID

    def __init__(self, *, verbose: bool = True, max_polls: int = 200) -> None:
        self._verbose = verbose
        self._max_polls = max_polls

    def settings(self) -> dict[str, Any]:
        """capabilities.extensions에 실릴 클라이언트 설정 (빈 객체 = 설정 없이 지원)."""
        return {}

    def claims(self) -> Sequence[ResultClaim[Any]]:
        return (
            ResultClaim(
                result_type=TASK_RESULT_TYPE,
                model=TaskCreatedResult,
                resolve=self._resolve,
            ),
        )

    async def _resolve(
        self, created: TaskCreatedResult, ctx: ClaimContext
    ) -> types.CallToolResult:
        """작업 핸들을 받아 tasks/get으로 폴링하고 최종 결과를 반환함."""
        interval = max(created.poll_interval_ms, 50) / 1000
        if self._verbose:
            print(
                f"  [tasks] 작업 핸들 수신: taskId={created.task_id} "
                f"status={created.status} pollInterval={created.poll_interval_ms}ms"
            )

        for attempt in range(1, self._max_polls + 1):
            await asyncio.sleep(interval)
            state = await get_task(ctx.session, created.task_id)
            if self._verbose:
                print(f"  [tasks] 폴링 #{attempt}: status={state.status} ({state.status_message})")
            if state.status in TERMINAL_STATUSES:
                return _to_call_tool_result(state)

        return types.CallToolResult(
            content=[types.TextContent(type="text", text="[작업 시간초과] 폴링 상한 초과")],
            is_error=True,
        )
