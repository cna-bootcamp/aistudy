# 여행 플래너 챗봇 — Streamlit + Gemini Chat Session

## 개요

| 항목 | 내용 |
|------|------|
| 실행 위치 | `hands-on/02.multiturn/chatbot/` |
| 실행 파일 | `travel_planner.py` |
| API | Google Gemini API |
| 모델 | `gemini-2.5-flash` |
| 대화 방식 | Chat Session (서버 측 히스토리 관리) |
| UI | Streamlit 웹 챗봇 |

Gemini Chat Session 방식을 Streamlit 웹 인터페이스로 구현한 여행 플래너 챗봇.  
실시간 스트리밍 응답과 대화 이력 유지를 지원함.

---

## 파일 구조

```
hands-on/02.multiturn/chatbot/
├── travel_planner.py   # 메인 실행 파일
├── requirements.txt    # 의존 패키지 목록
└── README.md           # 본 문서
```

---

## 소스 코드 설명

### 세션 초기화 (`init_session`)

앱 최초 로드 시 한 번만 실행됨. `st.session_state`에 Gemini 클라이언트와 Chat Session을 저장하여  
페이지 재렌더링 시에도 대화 상태가 유지됨.

```python
def init_session():
    if "initialized" in st.session_state:
        return                          # 이미 초기화된 경우 스킵

    client = genai.Client(api_key=api_key)
    chat = client.chats.create(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
    )
    first_response = chat.send_message("대화를 시작합니다.")  # 첫 인사 유도

    st.session_state.client = client    # Client 객체 보존
    st.session_state.chat = chat        # Chat Session 보존
    st.session_state.messages = [{"role": "assistant", "content": first_response.text}]
    st.session_state.initialized = True
```

### 실시간 스트리밍 응답

`send_message_stream()`으로 청크를 수신하고 `st.empty()` + `placeholder.markdown()`으로 표시함.  
`st.write()` 미사용 — 호출마다 새 줄이 추가되어 UI가 깨지는 문제 방지.  
응답 완료 후 `st.rerun()` 미호출 — 중복 실행 및 무한루프 방지.

```python
with st.chat_message("assistant"):
    placeholder = st.empty()
    full_response = ""
    for chunk in st.session_state.chat.send_message_stream(prompt):
        if chunk.text:
            full_response += chunk.text
            placeholder.markdown(full_response + "▌")   # 커서 표시
    placeholder.markdown(full_response)                  # 최종 응답 (커서 제거)
```

### 대화 이력 표시

`st.session_state.messages`에 누적된 대화를 매 렌더링마다 순서대로 표시함.

```python
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])
```

---

## 환경 설정

### API Key 설정

`hands-on/.env` 파일에 Gemini API Key 설정

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\02.multiturn\chatbot
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/02.multiturn/chatbot
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/02.multiturn/chatbot
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 실행

```bash
streamlit run travel_planner.py
```

브라우저에서 `http://localhost:8501` 자동으로 열림.

---

## 실행 예시

```
✈️ 여행 플래너 AI
여행지, 기간, 인원을 알려주시면 맞춤 관광지를 추천해 드립니다.

[AI] 안녕하세요! 어디로 여행을 계획하고 계신가요?

[나] 일본 오사카요

[AI] 오사카 좋은 선택이에요! 여행 기간은 어떻게 되시나요?

[나] 3박 4일이요

[AI] 3박 4일이군요! 몇 분이서 여행하실 예정인가요?

[나] 2명이요

[AI] 오사카 3박 4일 2인 여행을 위한 관광지를 추천해 드릴게요!

1. 도톤보리 — 오사카의 상징적인 번화가...
2. 오사카성 — 도요토미 히데요시가 축성한 역사 명소...
...
```

---

## 종료 방법

브라우저 탭을 닫거나 터미널에서 `Ctrl+C` 입력
