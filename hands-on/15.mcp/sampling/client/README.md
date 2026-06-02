# MCP Sampling 예제 — 고객 문의 자동 분류·라우팅

온라인 쇼핑몰 고객 문의를 **MCP Sampling**으로 자동 분류하고, JSON 티켓 생성 및  
담당부서별 Slack 채널 알림 발송까지 수행하는 예제임.

## Sampling이란

일반적인 MCP 흐름은 클라이언트가 서버에 요청하지만, **Sampling은 서버가 클라이언트에 요청**하는  
역방향 기능임. 서버가 자체 LLM API 없이도 **클라이언트의 LLM을 빌려** 추론을 수행함.

| 항목 | 내용 |
|---|---|
| 요청자 | MCP 서버 |
| 중개자 | MCP 클라이언트 |
| 응답자 | AI 모델 (LLM) |
| 본 예제의 LLM | Groq LPU `llama-3.3-70b-versatile` (OpenAI 호환 API) |

> 참고: Sampling은 Claude Code/Desktop이 아직 미지원함. 따라서 `sampling_callback`을 직접  
> 등록한 커스텀 클라이언트(`client.py`)로만 실습 가능함.

---

## 아키텍처

```
┌────────────────────────────────────────────────────────────────────────┐
│                          MCP Client (client.py)                         │
│                                                                          │
│   csr/*.json ──▶ call_tool("classify_inquiry", {문의 텍스트})            │
│                                                                          │
│                  ┌──────────────────────────────────────┐               │
│                  │  sampling_callback (이 예제의 핵심)    │               │
│                  │  MCP 요청 → Groq Chat 형식 변환 → 호출 │──┐            │
│                  └──────────────────────────────────────┘  │            │
└──────────────▲──────────────────────────────────┬─────────┼────────────┘
   ③ Sampling 요청  │                    ④ 분류 결과(JSON)  │   Groq LPU   │
   (create_message) │                                      │  OpenAI 호환 │
                    │       STDIO (stdin/stdout, JSON-RPC)  │   ▼          │
┌───────────────────┴──────────────────────────────────────┼──────────────┐
│                          MCP Server (server.py)           │              │
│                                                           ▼              │
│   ② classify_inquiry 도구 실행                                           │
│      └─ ① 문의 수신 → ③ Sampling 요청 → ⑤ 분류 파싱                      │
│            → ⑥ ticket/*.json 생성 → ⑦ Slack Webhook 발송                 │
│                                                                          │
│                          ⑦ 담당부서별 채널                               │
│            #cs-결제(결제팀) · #cs-배달(배달팀) · #cs-일반(일반팀)         │
└──────────────────────────────────────────────────────────────────────────┘
```

처리 순서:  
① 클라이언트가 고객 문의 텍스트로 `classify_inquiry` 도구 호출  
② 서버가 도구 실행 시작  
③ 서버가 `ctx.session.create_message()`로 Sampling 요청 (서버→클라이언트)  
④ 클라이언트의 `sampling_callback`이 Groq LLM 호출 후 분류 결과 반환  
⑤ 서버가 분류 JSON 파싱 (실패 시 최대 3회 재시도)  
⑥ 서버가 `ticket/TKT-XXX.json` 생성  
⑦ 서버가 담당부서 채널로 Slack 알림 발송  

---

## 디렉토리 구조

```
sampling/
├── generate_ticket.py        # 고객 문의 샘플 생성기 (csr/에 9건 생성)
├── csr/                       # [입력] 고객 문의 JSON (generate_ticket.py가 생성)
│   ├── CSR-001.json ~ CSR-003.json   # 결제 관련
│   ├── CSR-004.json ~ CSR-006.json   # 배달 관련
│   └── CSR-007.json ~ CSR-009.json   # 일반 관련
├── ticket/                    # [출력] JSON 티켓 (server.py가 실행 중 생성)
│   └── TKT-001.json ~ TKT-009.json
├── server/
│   └── server.py              # MCP 서버 (Sampling 요청 + 티켓 + Slack 발송)
└── client/
    ├── client.py              # MCP 클라이언트 (sampling_callback = Groq 호출)
    ├── requirements.txt        # 서버·클라이언트 공통 의존성
    └── README.md               # (이 문서)
```

---

## 소스 코드 설명

### `server/server.py` — MCP 서버

| 함수 | 역할 |
|---|---|
| `classify_inquiry()` | `@mcp.tool()` 도구. 문의 수신 → Sampling 분류 → 티켓 생성 → Slack 발송 |
| `request_classification()` | `ctx.session.create_message()`로 Sampling 요청, JSON 파싱·재시도 |
| `_extract_json()` | LLM 응답에서 JSON 객체만 추출 (앞뒤 설명 제거) |
| `_normalize_classification()` | 분류값 검증·보정 (미지정 부서는 일반팀으로 보정) |
| `create_ticket()` | 분류 결과로 `ticket/TKT-XXX.json` 생성 |
| `send_slack()` | 담당부서 채널 Webhook으로 알림 발송 (httpx 비동기 POST) |
| `log()` | 진단 메시지를 **stderr**로 출력 (stdout은 JSON-RPC 채널이므로 오염 금지) |

분류 스키마: `category`(결제/배달/일반) · `urgency`(높음/보통/낮음) ·  
`department`(결제팀/배달팀/일반팀) · `summary`(40자 이내). `department`로 Slack 채널을 결정함.

### `client/client.py` — MCP 클라이언트

| 함수 | 역할 |
|---|---|
| `sampling_callback()` | **핵심**. 서버 Sampling 요청 → Groq(OpenAI 호환) 호출 → 결과 반환 |
| `load_inquiries()` | `csr/*.json`을 ID 순으로 로드 |
| `run()` | 서버를 STDIO 자식 프로세스로 띄우고 문의별 도구 호출 |
| `main()` | `--no-slack` 인자 파싱 후 `run()` 실행 |

`StdioServerParameters(command=sys.executable, ...)`로 **클라이언트와 동일한 venv**에서  
서버를 실행하여 의존성 일치를 보장함.

---

## 사전 준비

`hands-on/.env`에 아래 키가 설정되어 있어야 함:

```
GROQ_API_KEY=...              # Groq API 키 (필수)
SLACK_WEBHOOK_PAYMENT=...     # #cs-결제 채널 Webhook
SLACK_WEBHOOK_SHIPPING=...    # #cs-배달 채널 Webhook
SLACK_WEBHOOK_GENERAL=...     # #cs-일반 채널 Webhook
```

> Slack Webhook 설정 방법: [guide-slack-webhook.md](https://github.com/cna-bootcamp/aistudy/blob/main/agentic-ai/reference/guide-slack-webhook.md)  
> Webhook이 없어도 `--no-slack`으로 분류·티켓 생성까지는 실습 가능함.

---

## 가상환경 설정

작업 디렉토리는 `hands-on/15.mcp/sampling/client`임. 하나의 venv로 서버·클라이언트를 모두 실행함.

### Windows / PowerShell

```powershell
cd hands-on\15.mcp\sampling\client
python -m venv venv
venv\Scripts\Activate.ps1
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

### Windows / GitBash

```bash
cd hands-on/15.mcp/sampling/client
python -m venv venv
source venv/Scripts/activate
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

### macOS / Linux

```bash
cd hands-on/15.mcp/sampling/client
python -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

---

## 실행 방법

가상환경이 활성화된 상태(`client/`)에서 진행함.

### 1) 고객 문의 샘플 생성

```bash
python ../generate_ticket.py
```

→ `csr/`에 결제·배달·일반 각 3건, 총 9건 생성됨.

### 2) 분류·티켓 생성 (Slack 발송 없이 검증)

```bash
python client.py --no-slack
```

→ 서버가 자동 실행되며 9건을 Sampling 분류하고 `ticket/`에 티켓 9건 생성. Slack 발송은 생략됨.

### 3) 전체 실행 (Slack 알림 포함)

```bash
python client.py
```

→ 분류·티켓 생성 후 담당부서별 Slack 채널(#cs-결제 / #cs-배달 / #cs-일반)로 알림 발송.

> 서버를 따로 실행할 필요 없음. 클라이언트가 STDIO로 서버를 자식 프로세스로 띄움.  
> 서버 진단 로그는 stderr로 출력되어 터미널에 함께 표시됨.

---

## 실행 결과 예시

```
================================================================
  고객 문의 자동 분류·라우팅 (MCP Sampling)
  문의 9건 / Slack 발송: OFF
================================================================

서버 연결 완료

=== 사용 가능한 도구 ===
  - classify_inquiry: 고객 문의를 Sampling으로 분류하고 JSON 티켓 생성 + Slack 알림까지 수행함.

[1/9] CSR-001 처리 중...
   ↳ [Sampling] Groq LLM 호출 중 (llama-3.3-70b-versatile)...
      → 결제 / 높음 / 결제팀 (#cs-결제)  티켓 TKT-001

... (생략) ...

================================================================
  완료: 티켓 9건 생성 (ticket/ 디렉터리 확인)
================================================================
```
