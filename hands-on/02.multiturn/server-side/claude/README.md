# Claude 멀티턴 여행 플래너 — 전체 히스토리 전송 방식

## 개요

Anthropic `claude-sonnet-4-6`을 사용하여 멀티턴 대화로 여행지 관광지를 추천하는 예제임.  
**전체 히스토리 전송 방식**: 매 API 호출 시 대화 시작부터 현재까지 모든 메시지를 전송함.  
여행지, 여행 기간(몇박 며칠), 여행 인원을 순차적으로 입력받은 후 관광지 5곳 이상을 추천함.

| 항목 | 내용 |
|------|------|
| 실행 위치 | `hands-on/02.multiturn/server-side/claude/` |
| 실행 파일 | `travel_planner.py` |
| API | Anthropic Messages API |
| 모델 | `claude-sonnet-4-6` |
| 대화 방식 | 전체 히스토리 전송 (Full History) |

## 파일 구조

```text
hands-on/02.multiturn/server-side/claude/
├── travel_planner.py   # 멀티턴 여행 플래너 메인 프로그램
├── requirements.txt    # 의존 패키지 목록
└── README.md           # 실행 안내 문서
```

## 소스 코드 설명

### 전체 흐름

```text
프로그램 시작
    → 시작 메시지로 API 호출 → AI 첫 인사 수신
    → [멀티턴 루프]
        → 사용자 입력
        → messages 리스트에 추가
        → Anthropic API 호출 (전체 messages 전송)
        → 응답 messages 리스트에 추가
        → 응답 출력 + 대화 기록 수 표시
    → 3가지 정보 수집 완료 시 관광지 추천
    → quit/exit/종료 입력 시 종료
```

### Claude 전체 히스토리 방식 핵심

OpenAI와 달리 Claude API는 `system`을 별도 파라미터로 분리하고,  
`messages`에는 `user`/`assistant` 메시지만 포함함.  
매 API 호출 시 이전 모든 대화 이력을 그대로 전송함.  
대화가 길어질수록 토큰 사용량이 증가하는 특징이 있음.

```python
# Claude API: system은 별도 파라미터, messages에는 user/assistant만 포함
response = client.messages.create(
    model="claude-sonnet-4-6",
    system=SYSTEM_PROMPT,      # system 별도 파라미터
    messages=messages,          # user/assistant 메시지만 포함
    max_tokens=1024,
)
reply = response.content[0].text
```

### Claude API와 OpenAI API 비교

| 항목 | Claude API | OpenAI API |
|------|-----------|------------|
| system 위치 | 별도 파라미터 `system=` | `messages` 내 `{"role": "system", ...}` |
| messages 구성 | `user`/`assistant`만 | `system`/`user`/`assistant` 모두 |
| 응답 추출 | `response.content[0].text` | `response.choices[0].message.content` |
| 첫 메시지 제약 | `user` role 필수 | 제약 없음 |

### 첫 인사 처리 방식

Claude API는 `messages`의 첫 항목이 반드시 `user` role이어야 함.  
따라서 시작 트리거 메시지를 `user`로 전송하여 AI 첫 인사를 유도하고,  
응답을 `assistant` 메시지로 히스토리에 추가한 뒤 루프를 시작함.

```python
# Claude API: messages는 반드시 user로 시작
messages = [{"role": "user", "content": "여행 계획을 도와주세요."}]
first_reply = chat(messages)
messages.append({"role": "assistant", "content": first_reply})
```

### 수집 정보

AI가 시스템 프롬프트 지시에 따라 아래 3가지를 자연스럽게 질문함.

| 항목 | 예시 |
|------|------|
| 여행지 | 도쿄, 제주도, 파리 |
| 여행 기간 | 2박 3일, 5일, 이번 주말 |
| 여행 인원 | 2명, 4인 가족 |

## 환경 설정

### API Key 설정

`hands-on/.env` 파일에 Anthropic API Key 설정 필요함.

```env
CLAUDE_API_KEY=sk-ant-...
```

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\02.multiturn\server-side\claude
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/02.multiturn/server-side/claude
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/02.multiturn/server-side/claude
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 실행

```bash
python travel_planner.py
```

### 실행 예시

```text
==================================================
  여행 플래너 (멀티턴 · 전체 히스토리 방식)
  종료하려면 'quit', 'exit', '종료' 입력
==================================================

[AI] 안녕하세요! 여행 플래너입니다. 어디로 여행을 계획하고 계신가요?

[나] 도쿄요

[AI] 도쿄 좋은 선택이에요! 여행 기간은 어떻게 생각하고 계신가요?
  (대화 기록: 3턴)

[나] 3박 4일

[AI] 알겠습니다! 몇 명이서 여행하실 예정인가요?
  (대화 기록: 5턴)

[나] 2명

[AI] 도쿄 3박 4일 2인 여행 추천 관광지입니다!

1. 아사쿠사 (浅草) ...
  (대화 기록: 7턴)
```

### 종료 방법

대화 중 `quit`, `exit`, `종료` 중 하나를 입력하면 프로그램이 종료됨.
