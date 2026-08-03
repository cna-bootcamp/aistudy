# 실습 4. 변경 알림 구독 — `subscriptions/listen`

MCP 2026-07-28이 서버→클라이언트 변경 알림 경로를 하나로 통합한 방식을 확인하는 예제임.

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
│   ├── watch_server.py      # 리소스/도구 변경 + 알림 발송
│   └── data/notes.txt       # 감시 대상 메모 파일 (서버 기동 시 초기화)
└── client/
    ├── client.py            # 두 구독을 동시에 열고 이벤트 수신
    ├── requirements.txt
    ├── README.md            # (이 문서)
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
