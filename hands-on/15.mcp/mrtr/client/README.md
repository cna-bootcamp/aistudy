# 실습 3. MRTR 실습 — 여행 플래너

MCP 2026-07-28의 핵심 변화인 **MRTR(Multi Round-Trip Requests)** 를 직접 확인하는 예제임.

교재: `agentic-ai/textbook/15.MCP.md` 3.3절

---

## 1. MRTR이란

2025-11-25까지 서버는 클라이언트에게 **역방향 JSON-RPC 요청**(`elicitation/create` 등)을
직접 보냈음. 이 구조는 서버→클라이언트 채널이 열려 있어야 하고, 서버가 응답을 기다리는 동안
상태를 유지해야 했음.

2026-07-28은 이를 뒤집었음.

```
[이전 방식 - 2025-11-25 이하]           [MRTR - 2026-07-28]

 Client            Server                Client              Server
   │  tools/call     │                     │  tools/call(id:1)│
   │ ───────────────►│                     │ ────────────────►│
   │◄─ elicitation/  │  ← 서버가 요청 발신  │◄─ InputRequired  │  ← 서버는 '응답'만 함
   │   create (id:2) │                     │   Result(id:1)   │     (resultType=input_required)
   │─► 결과(id:2)     │  ← 서버 대기 상태    │  사용자 입력 수집  │
   │◄─ 최종결과(id:1) │     유지 필요        │  tools/call(id:2)│  ← 새 id로 재요청
                                           │  + inputResponses│
                                           │  + requestState  │
                                           │ ────────────────►│  ← 서버 상태 불필요
                                           │◄─ 최종 결과(id:2) │
```

---

## 2. 시나리오

여행 계획에 필요한 정보를 **3단계로 나누어** 물어봄. 각 단계가 앞 단계 답에 의존하므로
한 번에 묶어 물을 수 없고 **라운드가 3번** 발생함.

| 라운드 | 질문 | 입력 스키마 |
|--------|------|-------------|
| 1 | 어느 국가, 어느 도시로 여행하시나요? | `country`, `city` |
| 2 | {국가} {도시} 여행의 기간과 예산은? | `days`, `budget_manwon` |
| 3 | {N}일 일정의 스타일과 동행자 수는? | `style`(enum), `companions` |

---

## 3. 디렉터리 구조

```
hands-on/15.mcp/mrtr/
├── server/
│   └── travel_server.py     # Resolve/Elicit + RequestStateSecurity
└── client/
    ├── client.py            # elicitation_callback 등록 + 라운드 출력
    ├── requirements.txt
    ├── README.md            # (이 문서)
    └── venv/                # 가상환경 (설치 후 생성됨)
```

---

## 4. 소스 코드 설명

### 4.1 서버: `Resolve()` 의존성 주입

```python
async def ask_destination() -> Elicit[Destination]:
    return Elicit("어느 국가, 어느 도시로 여행하시나요?", Destination)

async def ask_budget(
    destination: Annotated[Destination, Resolve(ask_destination)],   # ← 앞 단계에 의존
) -> Elicit[Budget]:
    return Elicit(f"{destination.country} {destination.city} 여행의 기간과 예산은?", Budget)

@mcp.tool()
async def plan_trip(
    traveler: str,                                                   # ← LLM이 채움
    destination: Annotated[Destination, Resolve(ask_destination)],   # ← 사용자에게 물어서 채움
    budget: Annotated[Budget, Resolve(ask_budget)],
    style: Annotated[ElicitationResult[Style], Resolve(ask_style)],
    ctx: Context,
) -> str: ...
```

핵심 포인트:

| 항목 | 설명 |
|------|------|
| **스키마 은닉** | `Resolve()`로 선언한 파라미터는 도구의 `inputSchema`에 **나타나지 않음** → LLM이 값을 지어낼 수 없음. 실제로 `plan_trip`의 입력 필드는 `['traveler']` 하나뿐임 |
| **라운드 분할** | 리졸버가 앞 리졸버에 의존하면 그 값을 알기 전에는 질문을 만들 수 없으므로 라운드가 나뉨. 독립적인 리졸버들은 **한 라운드에 묶여** 발송됨 |
| **결과 타입 선택** | `Annotated[T, Resolve(fn)]` → accept 값만 주입, decline/cancel이면 호출 중단.<br>`Annotated[ElicitationResult[T], Resolve(fn)]` → accept/decline/cancel을 직접 분기 |
| **리졸버 재실행** | 라운드마다 리졸버 본문이 다시 실행됨(로그로 확인 가능). 이미 답을 받은 질문은 `requestState`에 기록된 결과가 사용되므로 **같은 질문을 두 번 묻지 않음** |

### 4.2 requestState 무결성 보호

스펙은 클라이언트가 되돌려주는 `requestState`를 **공격자 통제 입력**으로 취급하고,
인가·자원 접근·비즈니스 로직에 영향을 준다면 HMAC 또는 AEAD로 보호하도록 요구함.

```python
from mcp.server.request_state import RequestStateSecurity

key = os.environ.get("MCP_REQUEST_STATE_KEY")
security = RequestStateSecurity(keys=[key], ttl=300.0) if key \
           else RequestStateSecurity.ephemeral()

mcp = MCPServer("TravelPlanner", request_state_security=security)
```

- `keys=[...]` → **AES-256-GCM**으로 봉인. `keys[0]`이 봉인, 모든 키가 해제(무중단 키 로테이션)
- 프레임워크가 **만료(ttl)·요청 바인딩·audience·principal**까지 검증함 (양방향 fail-closed)
- `ephemeral()` → 프로세스 로컬 임시 키. 학습·단일 프로세스용
- **서버가 여러 대인 운영 환경에서는 반드시 고정 키를 주입**해야 다른 인스턴스가 상태를 풀 수 있음

### 4.3 클라이언트: 콜백 하나만 등록

```python
async def on_elicit(context, params):
    # params.message          : 서버가 보낸 안내 문구
    # params.requested_schema : 채워야 할 JSON Schema (평면 객체 + 원시 타입)
    return {"action": "accept", "content": {...}}   # 또는 decline / cancel

async with Client(stdio_client(params), elicitation_callback=on_elicit) as client:
    result = await client.call_tool("plan_trip", {"traveler": "홍길동"})
```

MRTR 왕복(새 JSON-RPC id로 재요청, `requestState` 에코)은 **SDK가 대신 처리**함.
`input_required_max_rounds`(기본 10)로 재요청 횟수 상한을 둘 수 있음.

---

## 5. 가상환경 설정 및 실행

```bash
cd hands-on/15.mcp/mrtr/client
python -m venv venv
source venv/Scripts/activate      # Windows Git Bash
# source venv/bin/activate        # Linux / macOS
pip install -r requirements.txt
```

```bash
python client.py --auto          # 준비된 답변으로 자동 실행 (기본)
```

```bash
python client.py --interactive   # 콘솔에서 직접 입력
```

```bash
python client.py --decline       # 3단계에서 거절 → 분기 확인
```

운영 환경처럼 고정 키를 쓰려면:

```bash
export MCP_REQUEST_STATE_KEY="여기에-충분히-긴-비밀키"
python client.py --auto
```

---

## 6. 실행 결과 (실제 출력)

```
서버 연결 완료: TravelPlanner / protocol=2026-07-28

=== 도구 목록 (Resolve 파라미터는 스키마에 없음) ===
  - plan_trip: 입력 필드 ['traveler']
  - echo_protocol: 입력 필드 []

=== plan_trip 호출 시작 (LLM이 채우는 인자는 traveler 하나뿐) ===

  [MRTR 라운드 1] 서버가 추가 입력을 요청함 (resultType=input_required)
    질문: 어느 국가, 어느 도시로 여행하시나요?
    필요 필드: ['country', 'city']
    -> accept 반환: {'country': '일본', 'city': '오사카'}

  [MRTR 라운드 2] 서버가 추가 입력을 요청함 (resultType=input_required)
    질문: 일본 오사카 여행의 기간(일)과 1인 예산(만원)을 알려주세요.
    필요 필드: ['days', 'budget_manwon']
    -> accept 반환: {'days': 3, 'budget_manwon': 90}

  [MRTR 라운드 3] 서버가 추가 입력을 요청함 (resultType=input_required)
    질문: 3일 일정의 여행 스타일과 동행자 수를 알려주세요.
    필요 필드: ['style', 'companions']
    -> accept 반환: {'style': '미식', 'companions': 1}

=== 최종 결과 ===
  is_error: False
홍길동님을 위한 일정입니다.

=== 일본 오사카 3일 여행 일정 ===
- 스타일 : 미식
- 인원   : 2명 (동행 1명)
- 예산   : 1인 90만원 (1일 약 30.0만원)
- 총예산 : 180만원

[1일차] 현지 시장 아침
[2일차] 미슐랭/로컬 맛집 점심
[3일차] 디저트 카페
```

`--decline` 실행 시 마지막 부분:

```
    -> decline 반환 (사용자가 거절한 경우)

=== 최종 결과 ===
  is_error: False
여행 스타일 입력이 취소되어 일정을 생성하지 못했습니다.
```

서버 stderr 로그를 함께 보면 **라운드마다 리졸버 본문이 다시 실행**되는 것을 확인할 수 있음.

```
[travel] 1단계 질문 생성: 여행지
[travel] 1단계 질문 생성: 여행지          ← 2라운드: 1단계는 requestState의 기록을 사용
[travel] 2단계 질문 생성: 오사카 기간·예산
[travel] 1단계 질문 생성: 여행지          ← 3라운드
[travel] 2단계 질문 생성: 오사카 기간·예산
[travel] 3단계 질문 생성: 3일 일정 스타일
[travel] 모든 입력 수집 완료 (protocol=2026-07-28)
```

---

## 7. 확인해 볼 것 (심화)

1. `plan_trip`의 `inputSchema`에 `destination`/`budget`/`style`이 **없음**을 확인
2. 서버를 재시작한 뒤 이전 `requestState`로 재요청하면 검증 실패(ephemeral 키이므로)
3. `ask_budget`의 의존성을 제거하면 라운드가 **3회 → 2회**로 줄어드는지 확인
4. `MCP_REQUEST_STATE_KEY`를 지정하고 서버를 재시작해도 상태가 유효한지 확인

---

## 8. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `InputRequiredRoundsExceededError` | 라운드 상한 초과 | 리졸버 의존성을 줄이거나 `input_required_max_rounds` 상향 |
| 3단계가 오지 않고 바로 종료 | 1·2단계에서 decline/cancel 반환 | `Annotated[T, Resolve(...)]`는 decline 시 호출 중단됨 |
| 같은 질문이 반복됨 | 질문 문구가 라운드마다 달라짐 | 질문 렌더가 동일해야 기록된 답이 재사용됨 |
| `MCPDeprecationWarning` | Roots/Sampling/Logging 사용 | 본 예제는 Elicitation만 사용하므로 발생하지 않아야 정상 |
| 한글이 깨져 보임 (Windows) | 콘솔 인코딩 | `set PYTHONIOENCODING=utf-8` 후 실행 |
