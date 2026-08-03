"""서버 측 Tasks 확장 구현 (io.modelcontextprotocol/tasks)

SDK가 제공하는 확장 프레임워크(mcp.server.extension.Extension) 위에 직접 구현함.

동작:
  1) 클라이언트가 확장을 선언(capabilities.extensions)한 상태에서
     '오래 걸리는 도구'를 호출하면 → intercept_tool_call이 가로채서
     즉시 TaskCreatedResult(resultType="task")를 반환하고 작업을 백그라운드로 돌림.
  2) 클라이언트가 확장을 선언하지 않았으면 가로채지 않고 그대로 동기 실행함
     (스펙: 지원을 선언하지 않은 클라이언트에게 task를 반환하면 안 됨).
  3) tasks/get   → 현재 상태 조회 (폴링)
     tasks/cancel → 협조적 취소 요청

주의: 상태는 프로세스 메모리에 보관함. 실제 운영에서는 재시작·다중 인스턴스를 견디도록
      외부 저장소(Redis, DB 등)에 내구성 있게 저장해야 함.
"""

from __future__ import annotations

import asyncio
import contextvars
import sys
import traceback
import uuid
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass, field
from typing import Any

import mcp_types as types
from mcp.server.context import CallNext, HandlerResult, ServerRequestContext
from mcp.server.extension import Extension, MethodBinding
from mcp.shared.exceptions import MCPError

from task_protocol import (
    EXTENSION_ID,
    CancelTaskRequest,  # noqa: F401  (클라이언트와 형태를 맞추기 위해 함께 노출)
    GetTaskRequest,  # noqa: F401
    TaskCreatedResult,
    TaskIdParams,
    TaskStateResult,
    TaskStatus,
)


def _log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


# 진행 상황 보고 통로.
# 도구 함수의 시그니처를 건드리면 입력 스키마가 오염되므로(그리고 SDK는 '_' 로 시작하는
# 파라미터를 거부함) ContextVar로 전달함. 백그라운드 작업 안에서만 값이 설정됨.
_progress_reporter: contextvars.ContextVar[Callable[[str], None] | None] = contextvars.ContextVar(
    "mcp_task_progress", default=None
)


def report_progress(message: str) -> None:
    """도구 구현부에서 호출하는 진행 보고 함수.

    작업(task)으로 실행 중이면 상태 메시지를 갱신하고, 동기 실행 중이면 아무 일도 하지 않음.
    """
    reporter = _progress_reporter.get()
    if reporter is not None:
        reporter(message)


@dataclass
class TaskRecord:
    """서버가 보관하는 작업 1건의 상태."""

    task_id: str
    status: TaskStatus = "working"
    status_message: str | None = None
    result: dict[str, Any] | None = None
    error: dict[str, Any] | None = None
    runner: asyncio.Task[None] | None = field(default=None, repr=False)


class TasksExtension(Extension):
    """오래 걸리는 도구 호출을 작업(task)으로 바꿔주는 확장."""

    identifier = EXTENSION_ID

    def __init__(
        self,
        long_running: dict[str, Callable[..., Awaitable[Any]]],
        *,
        poll_interval_ms: int = 300,
        ttl_ms: int = 600_000,
    ) -> None:
        # 어떤 도구를 비동기 작업으로 돌릴지: {도구이름: 실제 구현 코루틴}
        self._long_running = long_running
        self._poll_interval_ms = poll_interval_ms
        self._ttl_ms = ttl_ms
        self._tasks: dict[str, TaskRecord] = {}

    # -- 확장 광고 ---------------------------------------------------------
    def settings(self) -> dict[str, Any]:
        """capabilities.extensions["io.modelcontextprotocol/tasks"]에 실릴 설정."""
        return {"pollIntervalMs": self._poll_interval_ms}

    # -- tools/call 가로채기 ------------------------------------------------
    async def intercept_tool_call(
        self,
        params: types.CallToolRequestParams,
        ctx: ServerRequestContext[Any, Any],
        call_next: CallNext,
    ) -> HandlerResult:
        impl = self._long_running.get(params.name)
        if impl is None:
            return await call_next(ctx)  # 일반 도구는 그대로 통과

        if not self._client_declared(ctx):
            # 스펙 요구사항: 확장을 선언하지 않은 클라이언트에게 task를 돌려주면 안 됨.
            _log(f"[tasks] 클라이언트가 확장 미선언 → {params.name} 동기 실행")
            return await call_next(ctx)

        task_id = f"task-{uuid.uuid4().hex[:12]}"
        record = TaskRecord(task_id=task_id, status_message="작업을 시작했습니다.")
        self._tasks[task_id] = record

        arguments = dict(params.arguments or {})
        # 응답을 보내기 전에 작업을 '내구성 있게' 만들어야 한다는 것이 스펙 요구사항임.
        # 이 예제는 메모리 딕셔너리에 먼저 등록한 뒤 실행을 시작함.
        record.runner = asyncio.create_task(self._run(record, impl, arguments))
        _log(f"[tasks] {params.name} → 작업 생성 {task_id}")

        return TaskCreatedResult(
            task_id=task_id,
            status="working",
            status_message=record.status_message,
            ttl_ms=self._ttl_ms,
            poll_interval_ms=self._poll_interval_ms,
        )

    # -- 확장이 추가하는 RPC ------------------------------------------------
    def methods(self) -> Sequence[MethodBinding]:
        return (
            MethodBinding(method="tasks/get", params_type=TaskIdParams, handler=self._handle_get),
            MethodBinding(method="tasks/cancel", params_type=TaskIdParams, handler=self._handle_cancel),
        )

    async def _handle_get(
        self, ctx: ServerRequestContext[Any, Any], params: TaskIdParams
    ) -> HandlerResult:
        record = self._require(params.task_id)
        return self._state(record)

    async def _handle_cancel(
        self, ctx: ServerRequestContext[Any, Any], params: TaskIdParams
    ) -> HandlerResult:
        record = self._require(params.task_id)
        # 취소는 '협조적'임. 서버가 의사를 접수할 뿐 반드시 중단된다는 보장은 없음.
        if record.status not in {"completed", "failed", "cancelled"}:
            if record.runner is not None:
                record.runner.cancel()
            record.status = "cancelled"
            record.status_message = "클라이언트 요청으로 취소되었습니다."
            _log(f"[tasks] 취소 접수: {record.task_id}")
        return self._state(record)

    # -- 내부 헬퍼 ---------------------------------------------------------
    def _client_declared(self, ctx: ServerRequestContext[Any, Any]) -> bool:
        """클라이언트가 요청 _meta에서 이 확장을 선언했는지 확인함."""
        # require_client_extension은 미선언 시 -32021 MCPError를 던지므로 감싸서 bool로 변환함.
        from mcp.server.mcpserver import require_client_extension

        try:
            require_client_extension(ctx, EXTENSION_ID)
        except MCPError:
            return False
        return True

    def _require(self, task_id: str) -> TaskRecord:
        record = self._tasks.get(task_id)
        if record is None:
            raise MCPError(types.INVALID_PARAMS, f"알 수 없는 taskId: {task_id}")
        return record

    def _state(self, record: TaskRecord) -> TaskStateResult:
        return TaskStateResult(
            task_id=record.task_id,
            status=record.status,
            status_message=record.status_message,
            poll_interval_ms=self._poll_interval_ms,
            result=record.result,
            error=record.error,
        )

    async def _run(
        self,
        record: TaskRecord,
        impl: Callable[..., Awaitable[Any]],
        arguments: dict[str, Any],
    ) -> None:
        """백그라운드에서 실제 작업을 수행하고 상태를 갱신함."""

        def progress(message: str) -> None:
            record.status_message = message

        # 이 코루틴은 별도 asyncio Task에서 실행되므로 여기서 설정한 ContextVar가
        # 작업 실행 구간에만 적용됨.
        _progress_reporter.set(progress)

        try:
            value = await impl(**arguments)
        except asyncio.CancelledError:
            record.status = "cancelled"
            record.status_message = "작업이 취소되었습니다."
            _log(f"[tasks] 취소 완료: {record.task_id}")
            raise
        except Exception as exc:  # noqa: BLE001 - 어떤 예외든 failed로 기록
            record.status = "failed"
            record.status_message = str(exc)
            record.error = {"code": types.INTERNAL_ERROR, "message": str(exc)}
            _log(f"[tasks] 실패: {record.task_id} - {exc}")
            _log(traceback.format_exc())
            return

        # 완료: 원래 tools/call이 돌려줬을 결과를 그대로 담아둠.
        #
        # 주의: 도구에 반환 타입 힌트가 있으면 SDK가 outputSchema를 만들고,
        #       클라이언트는 structuredContent가 없는 결과를 거부함.
        #       따라서 비정형 content와 구조화 출력을 함께 채워야 함.
        #       (SDK는 스칼라 반환값을 {"result": 값} 형태로 감쌈)
        structured = value if isinstance(value, dict) else {"result": value}

        record.status = "completed"
        record.status_message = "작업이 완료되었습니다."
        record.result = types.CallToolResult(
            content=[types.TextContent(type="text", text=str(value))],
            structured_content=structured,
            is_error=False,
        ).model_dump(by_alias=True, mode="json", exclude_none=True)
        _log(f"[tasks] 완료: {record.task_id}")
