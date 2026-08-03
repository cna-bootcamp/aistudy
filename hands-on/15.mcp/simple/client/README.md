# 실습 2. 간단한 MCP 구현 (MCP Python SDK v2)

MCP의 3대 핵심 기능(Tools / Resources / Prompts)과 외부 API 연동을 한 번에 익히는 예제임.
**MCP 2026-07-28 스펙 / `mcp` 2.x (`MCPServer`, `Client`) 기준**으로 작성되었음.

교재: `agentic-ai/textbook/15.MCP.md` 3.2절

| 구성 | 파일 | 핵심 학습 포인트 |
|------|------|------------------|
| 계산기 서버 | `server/calc_server.py` | Tools + Resources + Prompts 3대 기능 |
| 날씨 서버 | `server/weather_server.py` | 외부 API(wttr.in) 연동, 비동기 도구, per-request `_meta` |
| 클라이언트 | `client/client.py` | `Client`로 서버 연결·도구 호출 (initialize 없음) |
| 날씨 클라이언트 | `client/weather_client.py` | 외부 API 도구 호출 및 에러 처리 확인 |

---

## 1. 아키텍처

```
┌──────────────────────────────┐        STDIO (stdin/stdout)        ┌────────────────────────┐
│  client/client.py            │  ────────────────────────────────► │ server/calc_server.py  │
│  (mcp.Client)                │  ◄──────────────────────────────── │ (mcp.MCPServer)        │
│                              │      개행 구분 JSON-RPC 2.0        │  Tools/Resources/      │
│  - server/discover           │                                    │  Prompts               │
│  - tools/list, tools/call    │                                    └────────────────────────┘
│  - resources/list, read      │
│  - prompts/list, get         │        STDIO                       ┌────────────────────────┐
│                              │  ────────────────────────────────► │ server/weather_server  │
│  client/weather_client.py    │  ◄──────────────────────────────── │ (wttr.in 연동)         │
└──────────────────────────────┘                                    └───────────┬────────────┘
                                                                                │ HTTPS
                                                                                ▼
                                                                          https://wttr.in
```

**중요**: 클라이언트가 서버를 **자식 프로세스로 직접 실행**하므로 서버를 따로 띄울 필요가 없음.

---

## 2. 디렉터리 구조

```
hands-on/15.mcp/simple/
├── server/
│   ├── calc_server.py       # 계산기 서버: Tools + Resources + Prompts
│   └── weather_server.py    # 날씨 서버: 외부 API(wttr.in) 연동 Tools
└── client/
    ├── client.py            # 계산기 서버 연결 테스트
    ├── weather_client.py    # 날씨 서버 연결 테스트
    ├── requirements.txt
    ├── README.md            # (이 문서)
    └── venv/                # 가상환경 (설치 후 생성됨)
```

---

## 3. 소스 코드 설명

### 3.1 `server/calc_server.py`

| 구분 | 이름 | 설명 |
|------|------|------|
| Tool | `add`, `subtract`, `multiply`, `divide` | 사칙연산. 실행 결과를 `history`에 누적 |
| Resource | `calc://history` | 누적된 계산 이력 |
| Resource | `calc://info` | 서버 버전·지원 연산 |
| Prompt | `math_prompt(problem)` | 수학 문제 풀이 유도 프롬프트 생성 |

```python
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("Calculator", instructions="...")

@mcp.tool()
def add(a: float, b: float) -> float:
    """두 수를 더함."""
    ...

if __name__ == "__main__":
    mcp.run(transport="stdio")     # v2는 전송 방식을 run()에서 지정
```

- 타입 힌트(`a: float`)가 `inputSchema`로, docstring이 `description`으로 자동 변환됨
- `divide(1, 0)`은 `ValueError`를 던짐 → 클라이언트는 `result.is_error == True`로 수신

### 3.2 `server/weather_server.py`

| Tool | 설명 |
|------|------|
| `get_weather(city)` | wttr.in에서 현재 날씨 조회 |
| `get_forecast(city, days)` | 일별 예보 조회 (1~3일) |

- 외부 API: `https://wttr.in/{도시}?format=j1` (무료, **API 키 불필요**)
- HTTP 클라이언트는 v2 SDK 의존성인 **`httpx2`** 사용 (v1의 `httpx` + `httpx-sse` 대체)
- `ctx: Context`를 파라미터로 주입받아 **요청마다 실려 오는** `ctx.protocol_version`을 로그에 남김
  → stateless 프로토콜의 per-request 메타데이터를 눈으로 확인하는 지점
- **로그는 반드시 stderr로.** STDIO에서 stdout은 JSON-RPC 채널임.
  `ctx.info()`(Logging 기능)는 2026-07-28에서 폐기 예정(SEP-2577)이라 경고가 발생하므로 사용하지 않음

### 3.3 `client/client.py`

```python
from mcp import Client, StdioServerParameters, stdio_client

params = StdioServerParameters(command=sys.executable, args=[str(SERVER_SCRIPT)])

async with Client(stdio_client(params)) as client:
    tools = await client.list_tools()
    result = await client.call_tool("add", {"a": 3, "b": 5})
    print(result.structured_content)     # {'result': 8.0}
```

> **주의**: `Client("문자열")`은 **Streamable HTTP URL**로 해석됨.
> STDIO 서버에 붙일 때는 위처럼 `stdio_client(params)` 전송 객체를 넘겨야 함.

`client.server_info` / `client.protocol_version` / `client.instructions`는
내부적으로 수행된 `server/discover` 결과에서 채워짐.

---

## 4. v1 → v2 변경 대응표

| 항목 | v1 (`mcp` 1.x) | v2 (`mcp` 2.x) |
|------|----------------|----------------|
| 서버 클래스 | `from mcp.server.fastmcp import FastMCP` | `from mcp.server.mcpserver import MCPServer` |
| 전송 지정 | 생성자 인자 | `mcp.run(transport="stdio")` |
| Context | `mcp.get_context()` | 핸들러 파라미터 `ctx: Context` |
| 클라이언트 | `stdio_client()` + `ClientSession()` 3계층 | `Client(stdio_client(params))` |
| 초기화 | `await session.initialize()` | **불필요** (stateless) |
| 결과 필드 | `result.isError` | `result.is_error` |
| HTTP | `httpx` | `httpx2` |

> `mcp` 2.x에는 `mcp.server.fastmcp` 모듈 자체가 **없음**(`ModuleNotFoundError`).

---

## 5. 가상환경 설정 및 실행

### Windows (Git Bash)

```bash
cd hands-on/15.mcp/simple/client
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### Linux / macOS

```bash
cd hands-on/15.mcp/simple/client
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 실행

```bash
python client.py
```

```bash
python weather_client.py
```

> `weather_client.py`는 인터넷 연결이 필요함 (wttr.in 호출).

---

## 6. 실행 결과 (실제 출력)

```
서버 연결 완료 (initialize 없이 바로 사용 — stateless)

=== 서버 정보 (server/discover) ===
  이름/버전 : name='Calculator' title=None version='' description=None website_url=None icons=None
  프로토콜  : 2026-07-28
  지시문    : 사칙연산과 계산 이력 조회를 제공하는 학습용 서버

=== 사용 가능한 도구 ===
  - add: 두 수를 더함.
  - subtract: 두 수를 뺌.
  - multiply: 두 수를 곱함.
  - divide: 두 수를 나눔. 0으로 나누면 ValueError 발생.

=== 도구 호출: add(3, 5) ===
  content          : 8.0
  structured_content: {'result': 8.0}

=== 도구 호출(에러): divide(1, 0) ===
  is_error: True
  메시지  : Error executing tool divide: 0으로 나눌 수 없음.

=== 리소스 읽기: calc://history ===
  1. 3.0 + 5.0 = 8.0
  2. 10.0 ÷ 3.0 = 3.3333333333333335
```

```
=== get_weather('Seoul') ===
  is_error: False
Chongdong, South Korea 현재 날씨
- 상태: Clear
- 기온: 30°C (체감 37°C)
- 습도: 74%
- 풍속: 4 km/h (NW)
- 관측 시각(UTC): 02:13 PM

=== get_forecast('Busan', days=5)  → 검증 실패 기대 ===
  is_error: True
  메시지  : Error executing tool get_forecast: days는 1에서 3 사이여야 함 ...
```

---

## 7. Claude Code 연동

```bash
SERVER_PATH="hands-on/15.mcp/simple/server"

if command -v cygpath &> /dev/null; then
  USER_HOME=$(cygpath -m "$HOME")
else
  USER_HOME="$HOME"
fi

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "mingw"* ]]; then
  PYTHON_PATH="$USER_HOME/hands-on/15.mcp/simple/client/venv/Scripts/python.exe"
else
  PYTHON_PATH="$USER_HOME/hands-on/15.mcp/simple/client/venv/bin/python"
fi
SCRIPT_PATH="$USER_HOME/$SERVER_PATH/weather_server.py"

claude mcp add-json weather \
  "{\"type\":\"stdio\",\"command\":\"$PYTHON_PATH\",\"args\":[\"$SCRIPT_PATH\"]}" \
  -s user
```

등록 후 Claude Code를 재시작하고 `/mcp`로 연결 상태를 확인함.

```bash
claude mcp list -s user
```

---

## 8. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `ModuleNotFoundError: No module named 'mcp.server.fastmcp'` | v1 코드를 v2 SDK로 실행 | `MCPServer`로 변환 (4절 표 참조) |
| `Client("server.py")`가 연결 실패 | 문자열은 HTTP URL로 해석됨 | `Client(stdio_client(params))` 사용 |
| 서버가 응답 없이 멈춤 | 서버가 stdout에 `print()` 함 | 로그는 `stderr`로만 출력 |
| `MCPDeprecationWarning: logging capability is deprecated` | `ctx.info()`/`ctx.log()` 사용 | stderr 로깅 또는 OpenTelemetry로 대체 |
| wttr.in 타임아웃 | 외부 서비스 일시 장애 | 잠시 후 재시도 |
| 한글이 깨져 보임 (Windows) | 콘솔 인코딩 | `set PYTHONIOENCODING=utf-8` 후 실행 |
