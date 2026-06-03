# 여행 플래너 - LangChain Claude

## 개요

LangChain `ChatAnthropic`과 `create_agent`를 사용하여 여행 플래너를 구현한 예제.  
에이전트가 날씨·관광지·맛집 도구를 자동 호출하고 ReAct 루프를 자동 처리함.

## 08.function-call 대비 핵심 변경점

| 구분 | Before (08.function-call) | After (09.langchain) |
|---|---|---|
| LLM 호출 | `client.messages.create()` (raw SDK) | `ChatAnthropic` (LangChain 래퍼) |
| 도구 정의 | JSON Schema 딕셔너리 수동 작성 | `@tool` 데코레이터로 함수 시그니처에서 자동 생성 |
| 도구 실행 | `execute_function()` 화이트리스트 디스패처 | LangChain이 도구 함수 직접 실행 |
| 루프 처리 | `stop_reason == "tool_use"` 수동 감지 후 재호출 | `create_agent`가 ReAct 루프 자동 처리 |
| 메시지 타입 | `{"role": "user", "content": ...}` 딕셔너리 | `HumanMessage` / `AIMessage` / `ToolMessage` 객체 |

## 환경 설정

`hands-on/.env` 파일에 아래 키를 설정함.

```
CLAUDE_API_KEY=your_anthropic_api_key
OPENWEATHER_API_KEY=your_openweather_api_key
GOOGLE_PLACES_API_KEY=your_google_places_api_key
```

## 가상환경 설정

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on/09.langchain/claude
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/09.langchain/claude
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/09.langchain/claude
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 실행

```bash
streamlit run travel_planner.py
```

## 학습 포인트

| 개념 | 설명 |
|---|---|
| `ChatAnthropic` | LangChain Anthropic 채팅 모델 래퍼. `llm.invoke()`로 대화 요청 전송 |
| `create_agent` | LLM + 도구 목록을 받아 ReAct 루프를 자동 실행하는 LangChain 1.0 표준 에이전트 생성자 (`langchain.agents`, 내부적으로 LangGraph 그래프로 컴파일) |
| `@tool` 데코레이터 | 함수 시그니처와 docstring으로 LLM에 전달할 JSON 스키마를 자동 생성 |
| ReAct 루프 | LLM이 `tool_calls`를 생성하면 도구를 실행하고 결과를 `ToolMessage`로 추가. `tool_calls`가 없을 때까지 반복 |
