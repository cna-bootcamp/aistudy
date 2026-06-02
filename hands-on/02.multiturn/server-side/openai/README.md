# 멀티턴 여행 플래너 — OpenAI Responses API (서버 측 상태 관리)

## 개요

| 항목 | 내용 |
|------|------|
| 실행 위치 | `hands-on/02.multiturn/server-side/openai/` |
| 실행 파일 | `travel_planner.py` |
| API | OpenAI Responses API |
| 모델 | `gpt-4o-mini` |
| 대화 방식 | Response API (서버 측 상태 관리) |

OpenAI **Responses API**의 `previous_response_id`를 활용한 멀티턴 여행 플래너.  
클라이언트는 이전 응답의 ID만 보관하며, 대화 이력(히스토리)은 서버 측에서 자동 관리됨.

---

## 파일 구조

```
hands-on/02.multiturn/server-side/openai/
├── travel_planner.py   # 메인 실행 파일
├── requirements.txt    # 의존성 패키지 목록
└── README.md           # 실행 가이드 (이 파일)
```

---

## 소스 코드 설명

### Responses API 핵심 흐름

**첫 번째 호출** — `instructions`(시스템 프롬프트)와 초기 `input` 전달

```python
response = client.responses.create(
    model="gpt-4o-mini",
    instructions=SYSTEM_PROMPT,   # 시스템 프롬프트
    input="안녕하세요, 여행 계획을 도와주세요.",
)
previous_response_id = response.id   # 응답 ID 저장
```

**후속 호출** — `previous_response_id`로 이전 응답에 연결

```python
response = client.responses.create(
    model="gpt-4o-mini",
    instructions=SYSTEM_PROMPT,                  # 매 호출마다 반드시 전달
    previous_response_id=previous_response_id,   # 이전 응답 ID로 연결
    input=user_input,
)
previous_response_id = response.id   # ID 업데이트
```

> **주의**: `previous_response_id` 사용 시 이전 호출의 `instructions`는 자동으로 이어지지 않음.  
> 시스템 프롬프트를 유지하려면 매 호출마다 `instructions`를 함께 전달해야 함.

### Chat Completions API와의 차이점

| 구분 | Chat Completions API | Responses API |
|------|----------------------|---------------|
| 상태 관리 위치 | 클라이언트 (messages 배열 누적) | 서버 (`previous_response_id` 연결) |
| 클라이언트 보관 데이터 | 전체 대화 히스토리 | 응답 ID 1개 |
| 네트워크 전송량 | 턴이 늘수록 증가 | 매 턴 동일 (사용자 입력만 전송) |
| 시스템 프롬프트 전달 | 매 요청 `system` 역할로 포함 | 첫 호출 `instructions` 파라미터로 전달 |

---

## 환경 설정

### 1. API Key 설정

`hands-on/.env` 파일에 OpenAI API Key 설정

```env
OPENAI_API_KEY=sk-...
```

### 2. 가상환경 설정

#### Windows / PowerShell

```powershell
cd hands-on\02.multiturn\server-side\openai
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

#### Windows / GitBash

```bash
cd hands-on/02.multiturn/server-side/openai
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

#### macOS / Linux

```bash
cd hands-on/02.multiturn/server-side/openai
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 실행

```bash
python travel_planner.py
```

---

## 실행 예시

```
============================================================
  여행 플래너 AI  (Responses API — 서버 측 상태 관리)
  종료하려면 'quit', 'exit', 또는 '종료' 를 입력하세요.
============================================================

[AI] 안녕하세요! 여행 계획을 도와드리게 되어 반갑습니다.
     먼저 어떤 여행지를 생각하고 계신가요? (국내/해외 도시나 지역을 알려주세요.)

[Turn 1] 나: 일본 오사카요
[AI] 오사카 좋은 선택이세요! 몇 박 며칠 일정을 생각하고 계신가요?

[Turn 2] 나: 3박 4일이요
[AI] 3박 4일이군요! 몇 명이서 여행하실 예정인가요?

[Turn 3] 나: 2명이요
[AI] 오사카 2인 3박 4일 여행 플랜을 추천해 드릴게요!

1. 도톤보리(道頓堀) — 오사카를 대표하는 번화가 ...
2. 오사카성(大阪城) — 도요토미 히데요시가 축성한 역사 명소 ...
...
```

---

## 종료 방법

대화 중 아래 중 하나를 입력하면 종료됨

- `quit`
- `exit`
- `종료`
