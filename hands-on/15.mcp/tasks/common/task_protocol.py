"""Tasks 확장의 공통 와이어 타입 (서버·클라이언트 공용)

MCP 2026-07-28에서 Tasks는 코어 프로토콜이 아니라 **공식 확장**임
(식별자: io.modelcontextprotocol/tasks).

중요: 파이썬 SDK 2.0.0에는 이 확장의 구현이 **포함되어 있지 않음**.
      (mcp_types에 Task/CreateTaskResult 등이 있으나 2025-11-25 실험 버전용 타입임)
      따라서 이 예제는 SDK가 제공하는 확장 프레임워크
        - 서버: mcp.server.extension.Extension / MethodBinding
        - 클라이언트: mcp.client.extension.ClientExtension / ResultClaim
      위에 Tasks를 **직접 구현**함. 확장을 만드는 방법 자체가 학습 목표임.

[와이어 형태]
  tools/call 응답(작업 생성):
    { "resultType": "task", "taskId": "...", "status": "working",
      "ttlMs": 600000, "pollIntervalMs": 300 }

  tasks/get 요청/응답(폴링):
    -> { "method": "tasks/get", "params": { "taskId": "..." } }
    <- { "resultType": "complete", "taskId": "...", "status": "completed",
         "result": { ...원래 tools/call 결과... } }

  tasks/cancel 요청/응답(협조적 취소):
    -> { "method": "tasks/cancel", "params": { "taskId": "..." } }
    <- { "resultType": "complete", "taskId": "...", "status": "cancelled" }

모델은 모두 mcp_types.Result / RequestParams를 상속하므로
snake_case 필드가 자동으로 camelCase 와이어 키로 직렬화됨.
"""

from __future__ import annotations

from typing import Any, Literal

import mcp_types as types

#: 확장 식별자. capabilities.extensions 아래에 광고됨.
EXTENSION_ID = "io.modelcontextprotocol/tasks"

#: tools/call 응답에서 '작업 핸들'을 나타내는 resultType. 코어 어휘(complete/input_required)와 겹치면 안 됨.
TASK_RESULT_TYPE = "task"

#: 작업 상태. completed/failed/cancelled는 종료 상태임.
TaskStatus = Literal["working", "input_required", "completed", "failed", "cancelled"]
TERMINAL_STATUSES: frozenset[str] = frozenset({"completed", "failed", "cancelled"})


class TaskCreatedResult(types.Result):
    """tools/call 응답: 최종 결과 대신 돌려주는 작업 핸들.

    와이어: {"resultType":"task","taskId":...,"status":...,"ttlMs":...,"pollIntervalMs":...}
    """

    result_type: Literal["task"] = "task"
    task_id: str
    status: TaskStatus = "working"
    status_message: str | None = None
    ttl_ms: int = 600_000
    poll_interval_ms: int = 300


class TaskStateResult(types.Result):
    """tasks/get · tasks/cancel 응답: 작업의 현재 상태.

    - status == "completed" 이면 result에 원래 tools/call 결과가 들어감
    - status == "failed"    이면 error에 JSON-RPC 에러가 들어감
    """

    result_type: Literal["complete"] = "complete"
    task_id: str
    status: TaskStatus
    status_message: str | None = None
    poll_interval_ms: int = 300
    result: dict[str, Any] | None = None
    error: dict[str, Any] | None = None


class TaskIdParams(types.RequestParams):
    """tasks/get · tasks/cancel 요청 파라미터. 와이어 키는 taskId."""

    task_id: str


class GetTaskRequest(types.Request[TaskIdParams, Literal["tasks/get"]]):
    method: Literal["tasks/get"] = "tasks/get"
    params: TaskIdParams


class CancelTaskRequest(types.Request[TaskIdParams, Literal["tasks/cancel"]]):
    method: Literal["tasks/cancel"] = "tasks/cancel"
    params: TaskIdParams
