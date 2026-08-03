# 실습 4. 변경 알림 구독 — `subscriptions/listen`

MCP 2026-07-28이 서버→클라이언트 알림을 어떻게 정리했는지 확인하는 예제임.
**두 개의 실행 스크립트**로 구성됨.

| 스크립트 | 주제 | 교재 |
|----------|------|------|
| `client.py` | 변경 알림 구독 — 다중 구독과 demux | 3.4.1 |
| `request_scoped_client.py` | **요청 스코프 알림** — 진행률·로그는 구독 스트림이 아니라 그 요청의 응답 스트림으로 옴 | 3.4.2 |

교재: `agentic-ai/textbook/15.MCP.md` 3.4절

---

## 1. 무엇이 바뀌었나

| 항목 | 2025-11-25 이하 | 2026-07-28 |
|------|-----------------|------------|
| 서버 발신 알림 채널 | HTTP **GET** 스트림(독립 SSE) | **제거** |
| 리소스 구독 | `resources/subscribe` / `resources/unsubscribe` RPC | **제거** |
| 통합 방식 | — | **`subscriptions/listen`** 단일 롱리브 요청 |
| 필터 | 없음(전부 수신) | 클라이언트가 **받을 종류를 명시**. 서버는 요청하지 않은 종류를 보내면 안 됨 |
| 상관관계 | 채널로 구분 | `_meta.io.modelcontextprotocol/subscriptionId` |

`subscriptions/listen`은 request/response임. 응답이 **닫히지 않는 알림 스트림**일 뿐이며,
상태는 커넥션이 아니라 **그 요청에 스코프**됨.

```
클라이언트                                   서버
   │  subscriptions/listen (id:1)             │
   │  { notifications: { resourceSubscriptions: ["watch://notes"] } }
   │ ───────────────────────────────────────► │
   │◄─ notifications/subscriptions/acknowledged│  ← 반드시 첫 메시지
   │   _meta.subscriptionId = 1                │
   │        ... 스트림 유지 ...                 │
   │◄─ notifications/resources/updated         │
   │   _meta.subscriptionId = 1                │
```

---

## 2. 시나리오

두 구독을 **동시에** 열고, 각자 자기가 요청한 알림만 받는지 확인함.

| 구독 | 필터 | 받는 알림 |
|------|------|-----------|
| A | `resource_subscriptions=["watch://notes"]` | `notifications/resources/updated` |
| B | `tools_list_changed=True` | `notifications/tools/list_changed` |

서버는 4가지 변경을 순서대로 일으킴 → **A는 1·3번만, B는 2·4번만** 수신해야 정상임.

| # | 변경 | 기대 반응 |
|---|------|----------|
| 1 | 메모 추가 | 구독 A |
| 2 | 도구 추가 | 구독 B |
| 3 | 메모 추가 | 구독 A |
| 4 | 도구 제거 | 구독 B |

---

## 3. 디렉터리 구조

```
hands-on/15.mcp/subscriptions/
├── server/
│   ├── watch_server.py            # 리소스/도구 변경 알림 + 진행률/로그 발송
│   └── data/notes.txt             # 감시 대상 메모 파일 (서버 기동 시 초기화)
└── client/
    ├── client.py                  # [3.4.1] 두 구독을 동시에 열고 이벤트 수신
    ├── request_scoped_client.py   # [3.4.2] 진행률·로그가 어느 스트림으로 오는지 확인
    ├── requirements.txt
    ├── README.md                  # (이 문서)
    └── venv/
```

---

## 4. 소스 코드 설명

### 4.1 서버 — 변경을 일으키고 알림 발송

```python
@mcp.tool()
async def append_note(text: str, ctx: Context) -> str:
    """메모 파일에 한 줄을 덧붙이고 리소스 변경 알림을 발송함."""
    ...
    await ctx.notify_resource_updated("watch://notes")   # → resources/updated
```

```python
@mcp.tool()
async def add_greeting_tool(name: str, ctx: Context) -> str:
    """런타임에 도구를 추가하고 도구 목록 변경 알림을 발송함."""
    mcp.add_tool(_greet, name=f"greet_{name}")
    await ctx.notify_tools_changed()                     # → tools/list_changed
```

`Context`가 제공하는 알림 발송 메서드:

| 메서드 | 발송 알림 |
|--------|-----------|
| `ctx.notify_resource_updated(uri)` | `notifications/resources/updated` |
| `ctx.notify_resources_changed()` | `notifications/resources/list_changed` |
| `ctx.notify_tools_changed()` | `notifications/tools/list_changed` |
| `ctx.notify_prompts_changed()` | `notifications/prompts/list_changed` |

### 4.2 클라이언트 — `client.listen()`

```python
async with client.listen(resource_subscriptions=["watch://notes"]) as sub:
    print(sub.honored)          # 서버가 실제로 수락한 필터 (미지원 종류는 생략됨)
    async for event in sub:
        # 알림은 '변경되었다'는 신호일 뿐 → 실제 내용은 재조회해야 함
        content = await client.read_resource("watch://notes")
```

| 항목 | 설명 |
|------|------|
| 컨텍스트 진입 | 서버의 **ack 수신 완료**까지 대기함 |
| `sub.honored` | 서버가 수락한 필터. 요청한 것과 대조해 미지원 항목을 처리할 것 |
| 이벤트 타입 | `ResourceUpdated`, `ToolsListChanged`, `PromptsListChanged`, `ResourcesListChanged` |
| 정상 종료 | 서버가 빈 결과로 응답 → `async for` 루프가 끝남 |
| 비정상 종료 | **`SubscriptionLost`** 예외 → 재구독 후 **재조회** 필요 (재전송/replay 없음) |
| demux | STDIO는 한 채널을 공유하므로 `subscriptionId`로 구분. **SDK가 대신 처리**함 |

> `subscriptions/listen`은 2026-07-28 전용임. 그 이전 버전으로 연결되면
> `ListenNotSupportedError`가 발생하며, 구버전에서는 `subscribe_resource()`를 사용해야 함.

---

## 4.5 요청 스코프 알림 (`request_scoped_client.py`)

스펙은 알림을 **두 갈래**로 명확히 나눔.

```
┌─ 요청 스코프 알림 ──────────────────────────────────────────────┐
│ notifications/progress, notifications/message                   │
│ → 그 알림이 관계된 **요청의 응답 스트림**으로만 전달됨            │
│ → subscriptions/listen 스트림에는 절대 실리지 않음               │
└─────────────────────────────────────────────────────────────────┘
┌─ 변경 알림 ─────────────────────────────────────────────────────┐
│ tools/list_changed, resources/updated 등                        │
│ → subscriptions/listen 응답 스트림으로 전달됨                    │
└─────────────────────────────────────────────────────────────────┘
```

`request_scoped_client.py`는 **구독 스트림을 열어 둔 채로** 진행률·로그를 발생시키는 도구를
호출하여, 구독 스트림에 아무것도 오지 않는다는 것을 **건수로 증명**함.

### 두 알림 모두 옵트인

| 알림 | 옵트인 방법 | 서버 측 |
|------|-------------|---------|
| `notifications/progress` | 클라이언트가 `progress_callback`을 주면 SDK가 `_meta.progressToken`을 실어 보냄 | `await ctx.report_progress(i, total, message)` |
| `notifications/message` | 클라이언트가 `log_level`을 지정 → `_meta.io.modelcontextprotocol/logLevel` | `await ctx.info(...)` / `ctx.log(level, data)` |

> **스펙 규칙**: 서버는 `logLevel`을 포함하지 **않은** 요청에 대해 `notifications/message`를
> 보내면 안 됨. 진행률도 `progressToken`이 없으면 보내지 않음.
>
> 참고: Logging 기능 자체는 2026-07-28에서 **폐기 예정**(SEP-2577)이라 `ctx.info()` 호출 시
> `MCPDeprecationWarning`이 발생함. 이 예제는 "어느 스트림으로 가는가"를 보이기 위해
> 의도적으로 사용하며 서버에서 경고만 끔. 신규 구현은 stderr 또는 OpenTelemetry를 쓸 것.

### 서버 코드

```python
@mcp.tool()
async def long_task(steps: int = 4, delay: float = 0.3, ctx: Context = None) -> str:
    for i in range(1, steps + 1):
        await asyncio.sleep(delay)
        await ctx.report_progress(i, steps, f"{i}/{steps} 단계 완료")   # → progress
        await ctx.info({"message": "단계 처리", "step": i, "of": steps})  # → message
    return f"작업 완료: {steps}단계"
```

### 클라이언트 코드

```python
async def on_progress(progress, total, message): ...
async def on_log(params): ...            # params.level / params.data

async with Client(transport, log_level="info", logging_callback=on_log) as client:
    async with client.listen(tools_list_changed=True, ...) as sub:   # 구독은 열어만 둠
        result = await client.call_tool(
            "long_task", {"steps": 4},
            progress_callback=on_progress,        # ← 이 요청의 응답 스트림으로 진행률 수신
        )
```

### 검증 시나리오 4종

| # | 조건 | 기대 |
|---|------|------|
| A | `progress_callback` O + `log_level` O | 진행률·로그 수신, **구독 스트림 0건** |
| B | `progress_callback` X + `log_level` O | 진행률 **0건**, 로그는 수신 |
| C | 실제 변경(`append_note`) 발생 | **구독 스트림이 수신** |
| D | `log_level` 미지정 클라이언트 | 로그 **0건** |

---

## 5. 가상환경 설정 및 실행

```bash
cd hands-on/15.mcp/subscriptions/client
python -m venv venv
source venv/Scripts/activate      # Windows Git Bash
# source venv/bin/activate        # Linux / macOS
pip install -r requirements.txt
```

```bash
python client.py
```

```bash
python request_scoped_client.py
```

---

## 6. 실행 결과 (실제 출력)

```
서버 연결 완료: WatchServer / protocol=2026-07-28
[구독 A] 열림. 서버가 수락한 필터: ... resource_subscriptions=['watch://notes']
[구독 B] 열림. 서버가 수락한 필터: tools_list_changed=True ...

--- 변경 1: 메모 추가 (구독 A만 반응해야 함) ---
[구독 A] 이벤트 #1: ResourceUpdated ResourceUpdated(uri='watch://notes')
[구독 A] 재조회 결과:
(메모 없음)
[15:35:52] MCP 2026-07-28 학습 시작

--- 변경 2: 도구 추가 (구독 B만 반응해야 함) ---
[구독 B] 이벤트 #1: ToolsListChanged ToolsListChanged()
[구독 B] 재조회 결과: ['append_note', 'add_greeting_tool', 'remove_greeting_tool', 'greet_hong']

--- 변경 3: 메모 추가 (구독 A만 반응해야 함) ---
[구독 A] 이벤트 #2: ResourceUpdated ResourceUpdated(uri='watch://notes')
[구독 A] 재조회 결과:
(메모 없음)
[15:35:52] MCP 2026-07-28 학습 시작
[15:35:53] subscriptions/listen 확인 완료
[구독 A] 종료

--- 변경 4: 도구 제거 (구독 B만 반응해야 함) ---
[구독 B] 이벤트 #2: ToolsListChanged ToolsListChanged()
[구독 B] 재조회 결과: ['append_note', 'add_greeting_tool', 'remove_greeting_tool']
[구독 B] 종료

=== 최종 도구 목록 ===
  ['append_note', 'add_greeting_tool', 'remove_greeting_tool']
```

**핵심 확인 포인트**: 구독 A는 메모 변경(1·3)만, 구독 B는 도구 변경(2·4)만 받았음.
서버는 클라이언트가 요청하지 않은 종류의 알림을 보내지 않음.

### `request_scoped_client.py` 실행 결과

```
[구독] 열림. 서버가 수락한 필터: tools_list_changed=True prompts_list_changed=True
       resources_list_changed=True resource_subscriptions=['watch://notes', 'watch://status']

========================================================================
[A] 진행률·로그 옵트인 상태로 long_task 호출
     → 구독 스트림에는 오지 않고, 이 요청의 응답 스트림으로 전달되어야 함
========================================================================
    [진행률] 1.0/4.0 - 1/4 단계 완료
    [로그  ] level=info data={'message': '단계 처리', 'step': 1, 'of': 4}
    [진행률] 2.0/4.0 - 2/4 단계 완료
    [로그  ] level=info data={'message': '단계 처리', 'step': 2, 'of': 4}
    [진행률] 3.0/4.0 - 3/4 단계 완료
    [로그  ] level=info data={'message': '단계 처리', 'step': 3, 'of': 4}
    [진행률] 4.0/4.0 - 4/4 단계 완료
    [로그  ] level=info data={'message': '단계 처리', 'step': 4, 'of': 4}
  결과: 작업 완료: 4단계
  → 진행률 수신 4건, 로그 수신 4건
  → 구독 스트림 수신 0건  (0이어야 정상)

========================================================================
[B] 진행률 옵트인 없이 같은 도구 호출 (progress_callback 미지정)
========================================================================
    [로그  ] level=info data={'message': '단계 처리', 'step': 1, 'of': 3}
    [로그  ] level=info data={'message': '단계 처리', 'step': 2, 'of': 3}
    [로그  ] level=info data={'message': '단계 처리', 'step': 3, 'of': 3}
  → 진행률 수신 0건  (0이어야 정상)
  → 로그 수신 3건  (log_level은 여전히 유효하므로 >0)

========================================================================
[C] 실제 '변경'을 일으킴 (append_note)
========================================================================
[구독] 이벤트 수신 #1: ResourceUpdated
  → 구독 스트림 수신 1건  (1 이상이어야 정상)

========================================================================
최종 집계
========================================================================
  진행률 알림(요청 응답 스트림) : 4건
  로그 알림(요청 응답 스트림)   : 7건
  구독 스트림 이벤트            : 1건

결론: 진행률·로그는 구독 스트림이 아니라 '그 요청의 응답 스트림'으로만 전달됨.

========================================================================
[D] log_level 미지정 클라이언트로 long_task 호출
========================================================================
  → 로그 수신 0건  (0이어야 정상)
```

---

## 7. 확인해 볼 것 (심화)

1. 구독 A의 필터에 `tools_list_changed=True`를 추가하면 A도 도구 변경을 받는지 확인
2. 서버 프로세스를 강제 종료하면 `SubscriptionLost`가 발생하는지 확인
3. 서버가 지원하지 않는 종류를 요청했을 때 `sub.honored`에서 빠지는지 확인
4. 알림을 받고도 **재조회하지 않으면** 최신 내용을 알 수 없다는 점 확인
   (알림은 무효화 신호이지 데이터 전달이 아님)

---

## 8. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `ListenNotSupportedError` | 협상된 프로토콜이 2026-07-28 미만 | 서버/클라이언트 모두 `mcp>=2.0.0` 사용 |
| 알림이 오지 않음 | 구독 필터에 해당 종류를 넣지 않음 | `listen()` 인자 확인 (`sub.honored`로 대조) |
| `SubscriptionLost` | 스트림이 graceful close 없이 끊김 | 재구독 후 **재조회**. 재전송(replay)은 스펙상 없음 |
| 이벤트가 중복 수신됨 | 같은 필터로 구독을 여러 번 열었음 | 구독 수를 확인하거나 `subscriptionId`로 구분 |
| 한글이 깨져 보임 (Windows) | 콘솔 인코딩 | `set PYTHONIOENCODING=utf-8` 후 실행 |
