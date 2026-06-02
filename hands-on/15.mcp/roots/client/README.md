# MCP Roots 예제 — 디렉토리 접근 통제

MCP의 **Roots** 기능을 활용하여 MCP 서버의 파일 시스템 접근 범위를 통제하는 예제임.  
클라이언트가 허용 디렉토리(Roots)를 서버에 전달하고, 서버는 파일을 읽기 전에 경로를 검증함.

---

## 1. 비즈니스 시나리오

- **업무명**: MCP 서버의 디렉토리 접근 통제
- **흐름**:
  1. 클라이언트가 서버의 `read_file` 툴을 호출하며 파일 경로를 넘김
  2. 서버가 클라이언트에게 허용된 루트 목록을 요청 (`roots/list`)
  3. 서버가 요청된 파일 경로가 허용된 루트에 있는지 검사
     - 허용된 경로면 → 파일 내용 반환
     - 금지된 경로면 → 권한 오류 반환
  4. 클라이언트가 결과를 출력

> **Roots의 성격**: 프로토콜 수준의 강제가 아닌 **권고(Advisory)** 수준임.  
> "잘 만들어진 서버"가 `list_roots()`를 호출하고 검증 로직을 구현해야 효과가 있음.  
> 본 예제처럼 서버가 직접 검증을 수행하면 사실상 강제 효과를 가짐.

---

## 2. 아키텍처 다이어그램

```
┌──────────────────────────────────────────────────────────────────────┐
│                         MCP Host (사용자 앱)                            │
│                                                                        │
│   client.py                                                            │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │  MCP Client (ClientSession)                                    │   │
│   │   - list_roots_callback 등록: allowed/ 만 허용 루트로 응답     │   │
│   │   - read_file 도구 호출 (filepath 전달)                        │   │
│   └──────────────────────────────────────────────────────────────┘   │
└───────────────┬────────────────────────────────────▲──────────────────┘
                │                                      │
       ① 도구 호출(tools/call)             ④ 결과(내용 또는 권한 오류)
       read_file(filepath)                          │
                │                                      │
                ▼                                      │
┌──────────────────────────────────────────────────────────────────────┐
│                       MCP Server (server.py, STDIO)                    │
│                                                                        │
│   @mcp.tool() read_file(filepath, ctx)                                 │
│       │                                                                │
│       │  ② 허용 루트 요청 (ctx.session.list_roots → roots/list)        │
│       │ ───────────────────────────────────────────────────►          │
│       │ ◄───────────────────────────────────────────────────          │
│       │     (클라이언트 콜백이 allowed/ 경로 반환)                      │
│       │                                                                │
│       │  ③ 경로 검증 (realpath + commonpath)                           │
│       │     - 허용 루트의 하위 경로인가?                               │
│       │       예 → 파일 읽기 / 아니오 → 권한 오류                       │
│       ▼                                                                │
└──────────────────────────────────────────────────────────────────────┘
                │
                ▼
   파일 시스템:  allowed/ (허용)        forbidden/ (금지)
                ├ hello.txt            └ secret.txt
                └ config.json
```

**연결 수명주기 (STDIO 전송)**

```
Client                                Server
  │  서버를 자식 프로세스로 기동(sys.executable server.py)         
  │  initialize() ───────────────────►│  (프로토콜/기능 교환)
  │  ◄─────────────────────────────── │
  │  call_tool("read_file", {...}) ──►│
  │                                   │  list_roots() 역요청
  │  ◄─── roots/list 요청 ─────────── │
  │  ─── allowed/ 루트 응답 ────────►│
  │                                   │  경로 검증 후 결과 생성
  │  ◄─── 파일 내용 / 권한 오류 ───── │
```

---

## 3. 디렉토리 구조

```
hands-on/15.mcp/roots/
├── server/
│   └── server.py            # MCP 서버: read_file 툴 + Roots 경로 검증
└── client/
    ├── client.py            # MCP 클라이언트: Roots 콜백 + 3종 테스트
    ├── requirements.txt     # 의존성 (mcp)
    ├── README.md            # 본 문서
    ├── venv/                # 가상환경 (직접 생성, 서버도 이 venv로 실행됨)
    ├── allowed/             # 허용 디렉토리 (client.py 실행 시 자동 생성)
    │   ├── hello.txt
    │   └── config.json
    └── forbidden/           # 금지 디렉토리 (client.py 실행 시 자동 생성)
        └── secret.txt
```

> `allowed/`·`forbidden/`와 그 안의 샘플 파일은 `client.py`의 `create_sample_data()`가  
> 실행 시점에 자동 생성하므로 미리 만들 필요 없음.

---

## 4. 소스 코드 설명

### 4.1 서버 (`server/server.py`)

| 함수 | 역할 |
|------|------|
| `uri_to_path(uri)` | `file://` URI를 현재 OS의 실제 파일 경로로 변환 (Windows/mac/Linux 공통) |
| `get_allowed_roots(ctx)` | `ctx.session.list_roots()`로 클라이언트에 허용 루트 목록을 역요청 후 경로 리스트로 변환 |
| `is_path_allowed(filepath, roots)` | `realpath`+`commonpath`로 요청 경로가 허용 루트의 하위인지 검증 |
| `read_file(filepath, ctx)` | `@mcp.tool()` 도구. 루트 요청 → 경로 검증 → 허용 시 내용 반환 / 금지 시 권한 오류 |

**핵심 처리 흐름** (`read_file`)

1. `ctx.session.list_roots()` 호출 → 클라이언트가 허용한 루트 목록 수신
2. `is_path_allowed()`로 경로 검증
   - `os.path.realpath()`: `..`·심볼릭 링크를 모두 해소한 정규 절대경로 산출 → 경로 우회 차단
   - `os.path.commonpath([경로, 루트])`: 공통 상위 경로가 루트와 같으면 "루트의 하위"로 판정
   - `startswith` 대신 `commonpath`를 쓰는 이유: `allowed_evil`이 `allowed`로 시작하는 접두사 오판 방지
3. 검증 통과 시 `open()`으로 파일을 읽어 내용 반환, 아니면 권한 오류 메시지 반환

> **stdout/stderr 주의**: STDIO 전송에서 **stdout은 JSON-RPC 통신 채널**이므로,  
> 서버의 로그·디버그 출력은 반드시 `stderr`로 보내야 함 (server.py의 `print(..., file=sys.stderr)`).

### 4.2 클라이언트 (`client/client.py`)

| 함수 | 역할 |
|------|------|
| `list_roots_callback(context)` | 서버의 `roots/list` 요청에 응답. `allowed/`만 허용 루트로 반환 (핵심) |
| `create_sample_data()` | 테스트용 `allowed/`·`forbidden/` 디렉토리와 샘플 파일 생성 |
| `run_test(session, title, filepath)` | `read_file` 도구를 한 번 호출하고 결과를 출력 |
| `main()` | 서버 기동 → 세션 초기화 → 3종 시나리오 테스트 |

**3가지 테스트 시나리오**

| 테스트 | 요청 경로 | 기대 결과 |
|--------|-----------|-----------|
| 테스트 1 | `allowed/hello.txt` | 파일 내용 반환 (성공) |
| 테스트 2 | `forbidden/secret.txt` | 권한 오류로 차단 |
| 테스트 3 | `allowed/../forbidden/secret.txt` | 경로 우회 — `realpath` 정규화로 차단 |

> **서버 기동 방식**: 클라이언트는 `command=sys.executable`로 자신을 실행 중인  
> 바로 그 파이썬(=venv)으로 서버를 자식 프로세스로 기동함.  
> 따라서 서버용 별도 가상환경이 필요 없고, 클라이언트 venv 하나만 구성하면 됨.

---

## 5. 가상환경 설정 및 실행 방법

> 가상환경은 `client/` 디렉토리에 구성함. 클라이언트가 서버를 같은 venv로 자동 실행하므로  
> 서버를 따로 띄울 필요 없음.

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\15.mcp\roots\client
python -m venv venv
venv\Scripts\Activate.ps1
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/15.mcp/roots/client
python -m venv venv
source venv/Scripts/activate
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/15.mcp/roots/client
python -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

### 실행

```bash
python client.py
```

### 실행 결과 예시

```
============================================================
  MCP Roots 예제 - 디렉토리 접근 통제
============================================================

[연결] 서버 연결 완료
[Roots] 허용 디렉터리: ...\roots\client\allowed
[Roots] 금지 디렉터리: ...\roots\client\forbidden

[도구 목록]
  - read_file: 파일 내용을 읽어 반환. 허용 루트 범위 밖이면 권한 오류를 반환함. ...

------------------------------------------------------------
[테스트 1: 허용된 파일 읽기]
------------------------------------------------------------
  요청 경로: ...\roots\client\allowed\hello.txt
  결과: 안녕하세요! 이 파일은 허용된 영역에 있습니다.

------------------------------------------------------------
[테스트 2: 금지된 파일 읽기 시도]
------------------------------------------------------------
  요청 경로: ...\roots\client\forbidden\secret.txt
  결과: [권한 오류] '...\forbidden\secret.txt'는 허용된 루트 범위를 벗어남
        허용된 루트: ['...\roots\client\allowed']

------------------------------------------------------------
[테스트 3: 경로 우회(traversal) 시도]
------------------------------------------------------------
  요청 경로: ...\roots\client\allowed\..\forbidden\secret.txt
  결과: [권한 오류] '...\allowed\..\forbidden\secret.txt'는 허용된 루트 범위를 벗어남
        허용된 루트: ['...\roots\client\allowed']

============================================================
  테스트 결과 요약
============================================================
  - 허용 경로 파일 읽기  : 성공
  - 금지 경로 파일 읽기  : 권한 오류로 차단
  - 경로 우회(..) 시도   : 권한 오류로 차단
```

> 서버 stderr에는 `Processing request of type ...`(FastMCP 기본 로그)와  
> `[server] root uri=... -> path=...`(URI→경로 변환 확인 로그)가 함께 출력됨.

---

## 6. 학습 포인트

- **Roots 동작 원리**: 클라이언트가 `list_roots_callback`을 등록 → 서버가 `list_roots()`로 역요청 → 허용 범위 수신
- **역방향 요청**: 일반 흐름(클라이언트→서버)과 반대로, 서버가 클라이언트에 정보를 요청하는 패턴
- **Roots는 권고 수준**: 강제력은 서버의 검증 구현에 달려 있음. 실제 보안은 OS 권한·샌드박스 등 별도 수단 병행 필요
- **경로 검증 견고화**: `realpath`(traversal 차단) + `commonpath`(접두사 오판 방지)로 안전한 범위 판정
- **STDIO 전송 주의**: stdout은 JSON-RPC 채널 → 서버 로그는 stderr로 출력
