# MCP Elicitation 예제 - 여행 플래너 서비스

MCP **Elicitation**으로 서버가 사용자에게 여행 정보를 3단계로 역요청하고, 단계마다 서버가
입력값을 검증한 뒤 Groq LLM(`openai/gpt-oss-120b`)으로 맞춤 여행 일정을 생성하는 예제임.

## Elicitation이란

일반 MCP 흐름은 **클라이언트 → 서버** 요청이지만, Elicitation은 **서버 → 클라이언트(사용자)**
로 추가 정보를 요청하는 역방향 기능임 (2025-03-26 스펙 추가).

| 항목 | 내용 |
|------|------|
| 요청자 | MCP 서버 |
| 중개자 | MCP 클라이언트 |
| 응답자 | **사용자(사람)** |
| 응답 형태 | 정형 데이터 (JSON Schema 기반 타입/검증 포함) |
| 핵심 API | 서버 `ctx.elicit(message, schema)` ↔ 클라이언트 `elicitation_callback` |

> **검증 2계층**: ① 클라이언트/스키마가 타입·enum·범위를 1차로 거름  
> ② **서버**가 스키마로 못 막는 교차필드·비즈니스 규칙을 2차로 검증하고 실패 시 재요청함

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Client (client.py)                   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │            elicitation_callback()                    │    │
│  │  서버의 ctx.elicit() 요청 수신                       │    │
│  │  → requestedSchema(JSON Schema)로 CLI 폼 렌더링     │    │
│  │  → 사용자 입력 1차 검증 → ElicitResult 반환         │    │
│  └────────────────────────────────────────────────────┘    │
└───────────────┬──────────────────────────────────────────────┘
                │ STDIO (stdin/stdout, JSON-RPC 2.0)
                │   ▲ Elicitation 요청 (서버→클라이언트, 역방향)
                ▼   │
┌─────────────────────────────────────────────────────────────┐
│                  MCP Server (travel_server.py)               │
│                                                              │
│  Tool: plan_trip()                                           │
│   1. ctx.elicit(DestinationSchema)  → 국가/도시 요청         │
│        └─ validate_destination()    → 서버 검증 (국가-도시) │
│   2. ctx.elicit(TripDetailsSchema)  → 기간/예산 요청         │
│        └─ validate_trip_details()   → 서버 검증 (예산 타당)  │
│   3. ctx.elicit(PreferencesSchema)  → 스타일/동행자 요청     │
│        └─ validate_preferences()    → 서버 검증 (enum 방어)  │
│   4. generate_itinerary()           → Groq LLM 일정 생성     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │      Groq LPU (OpenAI 호환 API)                      │    │
│  │      openai/gpt-oss-120b                             │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Elicitation + 검증 흐름 상세

```
  Client                                   Server
    │   call_tool("plan_trip")               │
    │ ─────────────────────────────────────► │
    │                                        │ [Step 1] ctx.elicit(국가/도시)
    │   Elicitation 요청 + JSON Schema        │
    │ ◄───────────────────────────────────── │
    │ elicitation_callback() 실행             │
    │ → CLI 폼 렌더링 → 입력 → ElicitResult   │
    │ ─────────────────────────────────────► │ validate_destination()
    │                                        │   ├─ 통과 → 다음 단계
    │   (검증 실패 시) 오류 + 재요청          │   └─ 실패 → 같은 단계 재요청(최대 3회)
    │ ◄───────────────────────────────────── │
    │              ...                       │ [Step 2] 기간/예산 → validate_trip_details()
    │              ...                       │ [Step 3] 스타일/동행자 → validate_preferences()
    │                                        │ [Step 4] generate_itinerary() → Groq LLM
    │   도구 실행 결과 (여행 계획서)          │
    │ ◄───────────────────────────────────── │
```

## 디렉토리 구조

```
elicitation/
├── server/
│   └── travel_server.py    # MCP 서버 (3단계 Elicitation + 서버 검증 + LLM 호출)
└── client/
    ├── client.py           # 대화형 클라이언트 (CLI 폼으로 사용자 입력 수집)
    ├── test_client.py      # 비대화형 E2E 테스트 클라이언트 (캔드 응답 자동 주입)
    ├── requirements.txt    # 의존성 목록
    ├── README.md           # 본 문서
    └── venv/               # 가상환경 (생성물, 클라이언트·서버가 공유)
```

> **venv 공유 구조**: 클라이언트가 서버를 STDIO 자식 프로세스로 실행할 때 현재 venv의
> 파이썬(`sys.executable`)을 그대로 사용하므로, 가상환경 하나로 클라이언트·서버 모두 동작함.

## 소스 코드 설명

### server/travel_server.py - MCP 서버

3단계 Elicitation으로 정보를 수집하고 서버측 검증을 수행한 뒤 Groq LLM으로 일정을 생성함.

**Elicitation 스키마** (Pydantic → JSON Schema 자동 변환, primitive 타입만 허용):

| 스키마 | 필드 | 제약 |
|--------|------|------|
| `DestinationSchema` | `country`(enum), `city`(자유 텍스트) | country는 10개국 enum |
| `TripDetailsSchema` | `days`(int), `budget`(int) | days 1~30(기본 3), budget ≥10(기본 100) |
| `PreferencesSchema` | `style`(enum), `companion`(enum) | style 5종, companion 4종 enum |

**주요 함수**:

| 함수 | 역할 |
|------|------|
| `plan_trip()` | 도구 진입점. 3단계 Elicitation → 검증 → LLM 호출 오케스트레이션 |
| `elicit_with_validation()` | `ctx.elicit()` 호출 → 서버 검증 → 실패 시 재요청(최대 `MAX_RETRY=3`회) |
| `validate_destination()` | enum 방어, 도시 sanity, **국가-도시 명백한 불일치**(예: 일본+파리) 검사 |
| `validate_trip_details()` | **교차필드**: 국가 항공료 + 기간×1일 체류비 대비 예산 타당성 검사 |
| `validate_preferences()` | style/companion enum 방어 재확인 (클라이언트 입력 불신) |
| `generate_itinerary()` | 검증된 정보로 Groq LLM 호출 (빈 응답 대비 최대 2회 재시도) |

**처리 흐름** (`plan_trip`):

```
1. ctx.report_progress(1,4) → ctx.elicit(DestinationSchema) → validate_destination()
2. ctx.report_progress(2,4) → ctx.elicit(TripDetailsSchema) → validate_trip_details(country)
3. ctx.report_progress(3,4) → ctx.elicit(PreferencesSchema) → validate_preferences()
4. ctx.report_progress(4,4) → generate_itinerary() → 여행 계획서 반환
   (각 단계에서 decline/cancel 시 즉시 중단, 검증 3회 실패 시 중단)
```

**서버 검증 기준 데이터**:

- `KNOWN_CITIES`: 국가별 대표 도시 → 도시가 *다른 국가*의 대표 도시면 불일치로 거부
- `AIRFARE_FLOOR`: 국가 그룹별 왕복 항공료 최저선(아시아 35~40 / 유럽 90 / 미국·호주 110 만원)
- 예산 최저선 = 항공료 + 기간 × `DAILY_FLOOR`(1일 5만원)

### client/client.py - 대화형 클라이언트

`elicitation_callback`을 등록하여 서버의 정보 요청을 CLI 폼으로 렌더링하는 클라이언트임.

**핵심: `elicitation_callback()`**:

```python
async with ClientSession(
    read, write,
    elicitation_callback=elicitation_callback,  # ← 콜백 등록 = elicitation 지원 선언
) as session:
```

| 단계 | 동작 |
|------|------|
| 1 | 서버가 `ctx.elicit()` 호출 |
| 2 | 클라이언트의 `elicitation_callback()` 자동 실행 |
| 3 | `params.requestedSchema`(JSON Schema) 파싱 → 타입별 입력 UI 렌더링 |
| 4 | enum→번호 선택 / number→범위 검증 / string→자유 입력 (입력 중 `q` = 취소) |
| 5 | `ElicitResult(action="accept", content={...})`로 서버에 반환 |

### client/test_client.py - 비대화형 E2E 테스트 클라이언트

`input()` 없이 미리 정한 **캔드(canned) 응답**을 콜백이 자동 반환하여 전체 흐름을 사람 개입
없이 실행·검증함 (MCP Inspector/Claude Code는 elicitation 미지원이므로 자동 검증에 필수).

| 시나리오 | 입력 | 기대 결과 |
|----------|------|----------|
| **A (정상)** | 일본/오사카, 4일/150만원, 맛집 탐방/커플 | 재요청 없이 일정 생성 |
| **B (검증→재요청)** | 1차: 일본/**파리**, 5일/**30만원** → 2차: 도쿄, 180만원 | 서버가 1차 거부 후 재요청, 2차 통과 |

> `logging_callback`으로 서버의 검증 실패 로그를 수신해 출력하므로, 서버 검증이 실제로
> 동작했는지 눈으로 확인 가능함.

## 사전 준비

**Groq API 키**: 상위 `hands-on/.env` 파일에 `GROQ_API_KEY` 설정 필요.

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxx
```

> 서버는 `hands-on/.env`를 자동 로드함. 키가 없으면 실행 즉시 명확한 오류를 발생시킴.

## 가상환경 설정

> PyTorch를 사용하지 않으므로 `--system-site-packages` 옵션은 불필요함.

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\15.mcp\elicitation\client
python -m venv venv
venv\Scripts\Activate.ps1
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/15.mcp/elicitation/client
python -m venv venv
source venv/Scripts/activate
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/15.mcp/elicitation/client
python -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

## 실행 방법

> 서버를 별도로 실행할 필요 없음. 클라이언트가 `server/travel_server.py`를 STDIO 자식
> 프로세스로 자동 실행함.

### 1) 비대화형 E2E 테스트 (권장 - 자동 검증)

```bash
python test_client.py
```

정상/검증-재요청 두 시나리오를 자동 실행하고 PASS/FAIL을 판정함.

### 2) 대화형 실행

```bash
python client.py
```

서버가 단계별로 묻는 정보를 직접 입력함 (국가/도시 → 기간/예산 → 스타일/동행자).

## 실행 결과 예시 (test_client.py)

```
########################################################
#  시나리오 B: 검증 실패 → 재요청 → 통과
########################################################
  [자동응답:destination] {'country': '일본', 'city': '파리'}
  [서버로그] [검증 실패 1/3] '파리'는 프랑스의 도시임. 일본의 도시를 입력할 것
  [자동응답:destination (재요청)] {'country': '일본', 'city': '도쿄'}
  [자동응답:trip] {'days': 5, 'budget': 30}
  [서버로그] [검증 실패 1/3] 일본 5일 여행의 현실적 최소 예산은 약 60만원임
            (항공료 35 + 체류 5일×5). 입력한 예산 30만원으로는 일정 작성이 어려움
  [자동응답:trip (재요청)] {'days': 5, 'budget': 180}
  [자동응답:preferences] {'style': '관광/명소', 'companion': '가족'}
  [서버로그] 입력 검증 완료 → LLM으로 일정 생성 중...

========================================================
  테스트 판정
========================================================
  시나리오 A (정상)       : PASS
  시나리오 B (검증→재요청) : PASS

  ✅ 전체 PASS: Elicitation 3단계 + 서버 검증 + LLM 일정 생성 정상 동작
```

> **참고**: Elicitation은 현재 Claude Code/Claude Desktop, MCP Inspector 모두 미지원임.
> 서버가 `ctx.elicit()`를 호출해도 해당 도구들은 "Method not found"로 처리하지 못하므로,
> 본 예제의 `client.py`/`test_client.py`처럼 `elicitation_callback`을 등록한 전용
> 클라이언트로 실행해야 함.
