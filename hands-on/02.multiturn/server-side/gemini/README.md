# 멀티턴 여행 플래너 — Gemini Chat Session 방식

## 개요

| 항목 | 내용 |
|------|------|
| 실행 위치 | `hands-on/02.multiturn/server-side/gemini/` |
| 실행 파일 | `travel_planner.py` |
| API | Google Gemini API |
| 모델 | `gemini-2.5-flash` |
| 대화 방식 | Chat Session (서버 측 히스토리 관리) |

Google Gemini `google-genai` 신규 SDK의 **Chat Session** 방식으로 구현한 멀티턴 여행 플래너.  
SDK의 `chat` 객체가 대화 히스토리를 내부 상태로 자동 관리함 — OpenAI 전체 히스토리 전송 방식과 달리,  
매 턴마다 전체 메시지 목록을 직접 구성·전달할 필요 없음.

## 파일 구조

```
hands-on/02.multiturn/server-side/gemini/
├── travel_planner.py   # 메인 실행 파일
├── requirements.txt    # 의존 패키지 목록
└── README.md           # 본 문서
```

## 소스 코드 설명

### Chat Session 생성

```python
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

chat = client.chats.create(
    model="gemini-2.0-flash",
    config=types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
    ),
)
```

`client.chats.create()`로 Chat Session 생성 시 `system_instruction`을 포함함.  
생성된 `chat` 객체가 이후 모든 대화 히스토리를 자동으로 누적·관리함.

### 메시지 전송

```python
response = chat.send_message(user_input)
reply = response.text
```

`send_message()` 호출 시 SDK가 내부적으로 이전 대화를 포함한 요청을 구성함.  
개발자는 단순히 현재 턴의 사용자 입력만 전달하면 됨.

### 히스토리 길이 확인

```python
len(chat.get_history())
```

현재까지 쌓인 대화 턴 수를 확인함 (사용자 발화 + AI 응답 각각 1턴으로 계산).

### 실행 흐름

```
프로그램 시작
  → Chat Session 생성 (system_instruction 포함)
  → AI 첫 인사 (여행지 질문)
  → [멀티턴 루프]
      → 사용자 입력
      → chat.send_message(user_input) 호출
      → response.text 출력 + 현재 히스토리 길이 표시
  → 3가지 정보(여행지·기간·인원) 수집 완료 시 관광지 추천
  → quit / exit / 종료 입력 시 종료
```

## 환경 설정

### API Key 설정

`hands-on/.env` 파일에 Gemini API Key를 설정함:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\02.multiturn\server-side\gemini
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/02.multiturn/server-side/gemini
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/02.multiturn/server-side/gemini
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 실행

```bash
python travel_planner.py
```

## 실행 예시

```
============================================================
  여행 플래너 AI (Gemini Chat Session 방식)
  종료: quit / exit / 종료 입력
============================================================

[AI] 안녕하세요! 여행 플래너 AI입니다. 어디로 여행을 계획하고 계신가요?
     (히스토리: 2턴)

[나] 일본 오사카요

[AI] 오사카로 여행을 계획하고 계시군요! 여행 기간은 어떻게 되시나요?
     (히스토리: 4턴)

[나] 3박 4일이요

[AI] 3박 4일 일정이군요! 몇 분이서 여행하실 예정인가요?
     (히스토리: 6턴)

[나] 2명이요

[AI] 오사카 3박 4일 2인 여행을 위한 관광지를 추천해 드릴게요!

1. 도톤보리 — 오사카의 상징적인 번화가...
     (히스토리: 8턴)
```

## 종료 방법

대화 중 아래 중 하나를 입력하면 종료됨:

- `quit`
- `exit`
- `종료`
- `Ctrl+C`
