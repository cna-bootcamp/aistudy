# MCP 기본 예제 (Simple) — 계산기 & 날씨 서버

FastMCP + STDIO 전송으로 MCP 3대 핵심 기능(Tools, Resources, Prompts)과 외부 API 연동을 학습하는 예제임.  
계산기 서버, 날씨 조회 서버, 그리고 계산기 서버에 연결하는 클라이언트로 구성됨.

| 구성 | 파일 | 핵심 학습 포인트 |
|------|------|------------------|
| 계산기 서버 | `server/calc_server.py` | Tools + Resources + Prompts 3대 기능 |
| 날씨 서버 | `server/weather_server.py` | 외부 API(Open-Meteo) 연동, 비동기 도구 |
| 클라이언트 | `client/client.py` | ClientSession으로 서버 연결·도구 호출 |

---

## 디렉토리 구조

```
simple/
├── server/
│   ├── calc_server.py      # 계산기 MCP 서버 (Tools, Resources, Prompts)
│   └── weather_server.py   # 날씨 조회 MCP 서버 (Open-Meteo 연동)
├── client/
│   ├── client.py           # MCP 클라이언트 (계산기 서버 연결 테스트)
│   ├── requirements.txt     # 의존성 (mcp[cli], httpx)
│   └── README.md            # 본 문서
└── venv/                    # 가상환경 (설치 후 생성됨)
```

---

## 소스 코드 설명

### server/calc_server.py — 계산기 서버

MCP 3대 핵심 기능을 모두 포함하는 기본 서버임. `FastMCP("Calculator")` 인스턴스에 데코레이터로 기능을 등록함.

| 기능 | 등록 항목 | 설명 |
|------|----------|------|
| Tools | `add`, `subtract`, `multiply`, `divide` | 사칙연산. 호출마다 결과를 `history`에 누적 |
| Resources | `calc://history`, `calc://info` | 계산 이력, 서버 메타 정보 (읽기 전용) |
| Prompts | `math_prompt` | 수학 문제 풀이 프롬프트 템플릿 |

- `@mcp.tool()`: 타입 힌트(`a: float, b: float`)와 docstring을 JSON Schema로 자동 변환함.  
- `divide`: 0으로 나누면 `ValueError`를 발생시키며, MCP는 이를 결과의 `isError=True`로 전달함.  
- `@mcp.resource("calc://history")`: URI로 접근하는 읽기 전용 데이터로 등록함.  
- `@mcp.prompt()`: 인자를 받아 '완성된 프롬프트 텍스트'를 반환함 (LLM 실행 결과가 아님).  

### server/weather_server.py — 날씨 서버

외부 API **Open-Meteo**(무료, API 키 불필요)와 연동하는 비동기 서버임.  
도시 이름을 직접 받지 못하므로 **2단계**로 조회함.

```
도시 이름 ──(Geocoding API)──► 위경도 ──(Forecast API)──► 날씨 결과
```

| 기능 | 등록 항목 | 설명 |
|------|----------|------|
| Tools | `get_weather` | 현재 날씨 (온도/체감/습도/풍속/상태) |
| Tools | `get_forecast` | 일별 예보 (1~7일, 최고/최저/상태) |

주요 함수와 처리 흐름:

- `_geocode(client, city)`: Geocoding API로 도시명을 위경도로 변환함. 결과 없으면 `None` 반환.  
- `_describe(code)`: Open-Meteo가 반환하는 WMO 숫자 코드(`weather_code`)를 한국어 설명으로 변환함.  
- `get_weather(city)`: `_geocode` → Forecast API(`current=...`, `timezone=auto`) 호출 → 결과 포맷팅.  
- `get_forecast(city, days)`: `_geocode` → Forecast API(`daily=...`, `forecast_days`) 호출 → 날짜별 포맷팅.  

호출 API 엔드포인트:

| 단계 | URL |
|------|-----|
| Geocoding | `https://geocoding-api.open-meteo.com/v1/search` |
| Forecast | `https://api.open-meteo.com/v1/forecast` |

### client/client.py — MCP 클라이언트

계산기 서버에 STDIO로 연결하여 Tools/Resources/Prompts를 차례로 호출하는 예제임.

- `SERVER_SCRIPT`: `Path(__file__)` 기준 절대경로로 `../server/calc_server.py`를 가리킴.  
  실행 위치(CWD)와 무관하게 서버를 찾기 위함임.  
- `StdioServerParameters(command=sys.executable, args=[...])`: 클라이언트를 실행 중인 **동일 venv 파이썬**으로  
  서버를 자식 프로세스로 띄움. 별도 파이썬 경로 지정이 불필요함.  
- `_text(...)`: 응답 content 리스트에서 텍스트만 추출하는 헬퍼.  

실행 흐름:

1. `session.initialize()` — 프로토콜 협상 (필수 첫 호출)  
2. `list_tools()` / `list_resources()` / `list_prompts()` — 목록 조회  
3. `call_tool("add"/"divide", ...)` — 도구 호출  
4. `read_resource("calc://history")` — 누적 이력 읽기  
5. `get_prompt("math_prompt", ...)` — 완성된 프롬프트 텍스트 조회  

---

## STDIO 동작 원리

MCP 서버는 STDIO(표준 입출력) 방식으로 통신함.  
**서버를 별도로 실행할 필요 없이**, 클라이언트가 서버를 자식 프로세스로 자동 실행하고 연결함.

```
python client/client.py 실행
   │
   ├── 1. server/calc_server.py를 자식 프로세스로 자동 실행
   ├── 2. stdin/stdout 파이프로 서버와 연결
   ├── 3. JSON-RPC 메시지 교환 (도구 호출, 리소스 읽기 등)
   └── 4. 종료 시 서버도 자동 종료
```

> **주의**: 서버를 직접 실행(`python server/calc_server.py`)하면 stdin에서 JSON-RPC 메시지를 대기함.  
> 키보드 입력은 유효한 JSON-RPC가 아니므로 파싱 에러가 발생함. 테스트는 클라이언트나 MCP Inspector로 수행할 것.  
> STDIO에서는 stdout이 통신 채널이므로 서버 코드에 `print()`를 넣으면 통신이 깨짐 (로그는 stderr로만).

---

## 가상환경 설정

가상환경은 `simple/` 디렉토리 기준으로 1개만 생성함 (서버·클라이언트 공용).  
의존성 목록은 `client/requirements.txt`에 정의됨.

### Windows / PowerShell

```powershell
cd hands-on\15.mcp\simple
python -m venv venv
venv\Scripts\Activate.ps1
pip install --upgrade pip setuptools
pip install -r client\requirements.txt
```

### Windows / Git Bash

```bash
cd hands-on/15.mcp/simple
python -m venv venv
source venv/Scripts/activate
pip install --upgrade pip setuptools
pip install -r client/requirements.txt
```

### macOS / Linux

```bash
cd hands-on/15.mcp/simple
python -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools
pip install -r client/requirements.txt
```

---

## 실행 방법

### 1) 클라이언트 실행 (계산기 서버 자동 연결)

```bash
# simple/ 디렉토리에서 (가상환경 활성화 상태)
python client/client.py
```

> **Windows에서 한글이 깨질 경우**: 콘솔 기본 코드페이지(cp949) 때문임. UTF-8을 강제하면 정상 출력됨.  
> - PowerShell: `$env:PYTHONIOENCODING="utf-8"; python client\client.py`  
> - Git Bash: `PYTHONIOENCODING=utf-8 python client/client.py`  

### 2) MCP Inspector로 서버 테스트 (브라우저 UI)

```bash
# 계산기 서버
mcp dev server/calc_server.py

# 날씨 서버
mcp dev server/weather_server.py
```

> **MCP Inspector**: 브라우저에서 도구·리소스·프롬프트를 시각적으로 테스트하는 개발 도구. `mcp dev` 실행 시 자동 구동됨.

---

## 실행 결과 예시

### 계산기 클라이언트 (`python client/client.py`)

```
서버 연결 완료

=== 사용 가능한 도구 ===
  - add: 두 수를 더함.
  - subtract: 두 수를 뺌.
  - multiply: 두 수를 곱함.
  - divide: 두 수를 나눔. 0으로 나누면 ValueError 발생.

=== 도구 호출: add(3, 5) ===
  결과: 8.0

=== 도구 호출: divide(10, 3) ===
  결과: 3.3333333333333335

=== 리소스 읽기: calc://history ===
  1. 3.0 + 5.0 = 8.0
  2. 10.0 ÷ 3.0 = 3.3333333333333335
```

### 날씨 서버 (`mcp dev server/weather_server.py` 또는 클라이언트로 `get_weather` 호출)

```
도시: 서울특별시 (대한민국)
시각: 2026-06-01T16:15
날씨: 부분적으로 흐림
온도: 26.2°C
체감: 26.7°C
습도: 47%
풍속: 5.7km/h
```

---

## (참고) Claude Code / Claude Desktop 연동

날씨 서버를 Claude Code/Desktop에 등록하는 방법은 교재  
[agentic-ai/textbook/15.MCP.md](../../../../agentic-ai/textbook/15.MCP.md) 의 `3.2.2 / 3.2.3` 절을 참조할 것.  
등록 시 `command`는 위 venv 파이썬 절대경로, `args`는 `server/weather_server.py` 절대경로를 지정함.
