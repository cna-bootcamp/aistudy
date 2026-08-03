# 실습 5. Tasks 실습 — 오래 걸리는 배치 작업

오래 걸리는 도구 호출을 동기로 붙잡지 않고 **작업 핸들(taskId)** 로 돌려준 뒤,
`tasks/get` 폴링으로 결과를 받아가는 흐름을 구현하고 확인하는 예제임.

교재: `agentic-ai/textbook/15.MCP.md` 3.5절

---

## 0. 먼저 알아둘 것 — 이 예제는 확장을 '직접 구현'함

MCP 2026-07-28에서 **Tasks는 코어 프로토콜이 아니라 공식 확장**임
(식별자 `io.modelcontextprotocol/tasks`, SEP-2663으로 코어에서 분리됨).

그리고 **Python SDK 2.0.0에는 이 확장의 구현이 들어 있지 않음**.
(`mcp_types`에 `Task`/`CreateTaskResult`가 있으나 docstring에 "2025-11-25 only"로 명시된 이전 실험 버전 타입임)

따라서 이 예제는 SDK가 제공하는 **확장 프레임워크** 위에 Tasks를 직접 구현함.
확장을 만드는 방법 자체가 이 실습의 학습 목표임.

| 측 | 사용하는 SDK API |
|----|------------------|
| 서버 | `mcp.server.extension.Extension`, `MethodBinding`, `intercept_tool_call` |
| 클라이언트 | `mcp.client.extension.ClientExtension`, `ResultClaim` |

---

## 1. 흐름

```
클라이언트                                        서버
   │  tools/call run_batch                          │
   │  _meta.clientCapabilities.extensions =         │
   │      { "io.modelcontextprotocol/tasks": {} }   │
   │ ─────────────────────────────────────────────► │
   │                                                │ intercept_tool_call
   │                                                │  → 작업 생성 + 백그라운드 실행
   │◄─ { "resultType":"task", "taskId":"task-...",  │
   │      "status":"working", "pollIntervalMs":300 }│
   │                                                │
   │  tasks/get { taskId }        (폴링 반복)        │
   │ ─────────────────────────────────────────────► │
   │◄─ { "status":"working", "statusMessage":"2/4 처리 중" }
   │  ...                                           │
   │◄─ { "status":"completed", "result": {...} }    │
```

취소는 `tasks/cancel`로 요청함. **협조적 취소**이므로 서버가 의사를 접수할 뿐
반드시 중단된다는 보장은 없음.

---

## 2. 디렉터리 구조

```
hands-on/15.mcp/tasks/
├── common/
│   └── task_protocol.py           # 공통 와이어 타입 (서버·클라이언트 공용)
├── server/
│   ├── tasks_extension.py         # 서버측 Extension 구현
│   └── batch_server.py            # 배치 도구 + 확장 등록
└── client/
    ├── tasks_client_extension.py  # 클라이언트측 ClientExtension 구현
    ├── client.py                  # 완료/실패/취소/대조 4가지 시나리오
    ├── requirements.txt
    ├── README.md                  # (이 문서)
    └── venv/
```

---

## 3. 소스 코드 설명

### 3.1 `common/task_protocol.py` — 와이어 타입

모든 모델이 `mcp_types.Result` / `RequestParams`를 상속하므로
snake_case 필드가 **자동으로 camelCase 와이어 키**로 직렬화됨.

| 모델 | 와이어 |
|------|--------|
| `TaskCreatedResult` | `{"resultType":"task","taskId":...,"status":...,"ttlMs":...,"pollIntervalMs":...}` |
| `TaskStateResult` | `{"resultType":"complete","taskId":...,"status":...,"result":{...}}` |
| `TaskIdParams` | `{"taskId": "..."}` |

`TASK_RESULT_TYPE = "task"`는 코어 어휘(`complete`/`input_required`)와 겹치면 안 됨.
겹치면 `ResultClaim` 생성 시 예외가 발생함.

### 3.2 `server/tasks_extension.py` — 서버 확장

```python
class TasksExtension(Extension):
    identifier = "io.modelcontextprotocol/tasks"

    async def intercept_tool_call(self, params, ctx, call_next):
        impl = self._long_running.get(params.name)
        if impl is None:
            return await call_next(ctx)              # 일반 도구는 통과

        if not self._client_declared(ctx):
            return await call_next(ctx)              # 확장 미선언 → 동기 실행

        record.runner = asyncio.create_task(self._run(record, impl, arguments))
        return TaskCreatedResult(task_id=task_id, status="working", ...)

    def methods(self):
        return (
            MethodBinding(method="tasks/get",    params_type=TaskIdParams, handler=self._handle_get),
            MethodBinding(method="tasks/cancel", params_type=TaskIdParams, handler=self._handle_cancel),
        )
```

핵심 포인트:

| 항목 | 설명 |
|------|------|
| **능력 확인 필수** | 스펙: 확장을 **선언하지 않은 클라이언트에게 task를 반환하면 안 됨**. `require_client_extension(ctx, id)`는 미선언 시 `-32021`을 던지므로 감싸서 bool로 씀 |
| **응답 전 생성** | 작업은 응답을 보내기 **전에** 등록되어야 함 (이 예제는 메모리 딕셔너리) |
| **메서드는 추가만 가능** | `MethodBinding`은 스펙이 정의한 메서드(`tools/list` 등)를 덮어쓸 수 없음. 생성 시점에 검증됨 |
| **진행 보고** | 도구 시그니처에 콜백 파라미터를 두면 입력 스키마가 오염되고, SDK는 `_`로 시작하는 파라미터를 **거부**함 → `ContextVar` 통로(`report_progress()`)를 사용 |
| **structuredContent** | 도구에 반환 타입 힌트가 있으면 SDK가 `outputSchema`를 만들고, 클라이언트는 `structuredContent` 없는 결과를 **거부**함. 완료 결과에 반드시 함께 채울 것 |

### 3.3 `client/tasks_client_extension.py` — 클라이언트 확장

```python
class TasksClientExtension(ClientExtension):
    identifier = "io.modelcontextprotocol/tasks"

    def claims(self):
        return (ResultClaim(result_type="task", model=TaskCreatedResult, resolve=self._resolve),)

    async def _resolve(self, created, ctx) -> CallToolResult:
        while True:
            await asyncio.sleep(created.poll_interval_ms / 1000)
            state = await get_task(ctx.session, created.task_id)   # tasks/get
            if state.status in TERMINAL_STATUSES:
                return _to_call_tool_result(state)
```

`ResultClaim`은 "이 `resultType`은 내가 처리하겠다"는 선언임.
덕분에 **호출부는 `await client.call_tool(...)` 한 줄 그대로** 유지되고,
폴링은 확장 안에 숨겨짐.

수동으로 다루고 싶으면 저수준 API를 씀:

```python
created = await client.session.call_tool("run_batch", {...}, allow_claimed=True)
state   = await get_task(client.session, created.task_id)
await cancel_task(client.session, created.task_id)
```

---

## 4. 상태 전이

| 상태 | 의미 | 종료 |
|------|------|------|
| `working` | 진행 중 | |
| `input_required` | 클라이언트 입력 필요 (본 예제 미구현) | |
| `completed` | 완료. `result`에 원래 tools/call 결과 | ✔ |
| `failed` | 실행 중 오류. `error`에 JSON-RPC 에러 | ✔ |
| `cancelled` | 취소됨 (협조적) | ✔ |

---

## 5. 가상환경 설정 및 실행

```bash
cd hands-on/15.mcp/tasks/client
python -m venv venv
source venv/Scripts/activate      # Windows Git Bash
# source venv/bin/activate        # Linux / macOS
pip install -r requirements.txt
```

```bash
python client.py
```

---

## 6. 실행 결과 (실제 출력)

```
======================================================================
[시나리오 1] 완료 — taskId 발급 → tasks/get 폴링 → completed
======================================================================
  [tasks] 작업 핸들 수신: taskId=task-03dda4c67d9d status=working pollInterval=300ms
  [tasks] 폴링 #1: status=working (1/4 처리 중)
  [tasks] 폴링 #2: status=working (2/4 처리 중)
  [tasks] 폴링 #3: status=working (3/4 처리 중)
  [tasks] 폴링 #4: status=completed (작업이 완료되었습니다.)
  최종 is_error: False
  최종 결과   : 배치 완료: 4건 처리

======================================================================
[시나리오 2] 실패 — 2번째 항목에서 예외 → failed
======================================================================
  [tasks] 작업 핸들 수신: taskId=task-15fb9fc3dbfd status=working pollInterval=300ms
  [tasks] 폴링 #1: status=working (1/4 처리 중)
  [tasks] 폴링 #2: status=failed (2번째 항목 처리 중 오류 발생)
  최종 is_error: True
  최종 결과   : [작업 실패] 2번째 항목 처리 중 오류 발생

======================================================================
[시나리오 3] 취소 — 작업 핸들만 받고 tasks/cancel 호출
======================================================================
  작업 핸들: taskId=task-4820acbe1f8c status=working
  폴링 1회 : status=working (2/10 처리 중)
  취소 요청 : status=cancelled (클라이언트 요청으로 취소되었습니다.)
  최종 상태 : status=cancelled

======================================================================
[시나리오 4] 대조 — 확장을 선언하지 않으면 같은 도구가 동기 실행됨
======================================================================
  도구 목록: ['run_batch', 'ping']
  run_batch 동기 호출 (완료까지 블로킹)...
  결과: 배치 완료: 3건 처리

모든 시나리오 완료
```

---

## 7. 확인해 볼 것 (심화)

1. 시나리오 4에서 **같은 도구·같은 인자**인데 응답 형태가 다른 이유 설명하기
   (→ 클라이언트가 확장을 선언했는가에 따라 서버 동작이 달라짐)
2. `pollIntervalMs`를 늘리면 폴링 횟수가 어떻게 변하는지 확인
3. `tasks/list`를 추가로 구현해 보고, **2026-07-28 Tasks 확장이 왜 `tasks/list`를 제거했는지** 생각해 보기
4. `MethodBinding(method="tools/list", ...)`을 시도해 보고 왜 거부되는지 확인
5. 작업 상태를 메모리 대신 파일/Redis에 저장하도록 바꿔 서버 재시작 후에도 폴링이 되게 만들기

---

## 8. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `InvalidSignature: Parameter _x cannot start with '_'` | 도구 파라미터명이 `_`로 시작 | `ContextVar` 등 시그니처 밖 통로 사용 |
| `Tool X has an output schema but did not return structured content` | 완료 결과에 `structuredContent` 누락 | `CallToolResult(structured_content=...)` 채우기 |
| `UnexpectedClaimedResult` | 확장을 등록하지 않고 task 결과를 받음 | `Client(extensions=[...])` 또는 `allow_claimed=True` |
| `ValueError: resultType 'complete' is core protocol vocabulary` | claim이 코어 어휘를 사용 | 고유한 `resultType` 사용 (예: `"task"`) |
| `MethodBinding cannot bind spec method` | 스펙 정의 메서드를 확장에서 바인딩 | 확장 메서드는 **추가만** 가능. 코어 동작 변경은 미들웨어/인터셉터 사용 |
| 한글이 깨져 보임 (Windows) | 콘솔 인코딩 | `set PYTHONIOENCODING=utf-8` 후 실행 |
