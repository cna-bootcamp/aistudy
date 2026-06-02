# 여행 플래너 - LangChain Gemini

## 개요

LangChain `ChatGoogleGenerativeAI`와 `create_react_agent`를 사용하여 여행 플래너 구현.  
사용자가 도시명을 입력하면 날씨·관광지·맛집 도구를 자동 호출하여 오늘의 여행 루트 추천.  
`create_react_agent`가 ReAct 루프를 자동 처리하므로 수동 tool-call 루프 불필요.

## 08.function-call 대비 핵심 변경점

| 구분 | Before (08.function-call) | After (09.langchain) |
|------|--------------------------|----------------------|
| LLM 호출 | `client.models.generate_content()` | `ChatGoogleGenerativeAI.invoke()` |
| 도구 스키마 | JSON Schema 수동 정의 | `@tool` 데코레이터 자동 생성 |
| 도구 실행 | `execute_function()` 화이트리스트 디스패처 | LangChain 자동 실행 |
| 반복 루프 | `function_calls` 감지 → `Part.from_function_response()` → 재호출 (수동 for 루프) | `create_react_agent`가 ReAct 루프 자동 처리 |
| 메시지 구성 | `Content` / `Part` 객체 수동 조립 | `HumanMessage` / `AIMessage` / `ToolMessage` |

## 환경 설정

`hands-on/.env` 파일에 아래 API 키 설정 필요.

```
GEMINI_API_KEY=your_gemini_api_key
OPENWEATHER_API_KEY=your_openweather_api_key
GOOGLE_PLACES_API_KEY=your_google_places_api_key
```

## 가상환경 설정

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on/09.langchain/gemini
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/09.langchain/gemini
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/09.langchain/gemini
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 실행

```bash
streamlit run travel_planner.py
```

## 학습 포인트

### ChatGoogleGenerativeAI

LangChain Google Generative AI 채팅 모델 래퍼.  
`google_api_key` 파라미터로 인증하고 `llm.invoke(messages)`로 대화 요청 전송.  
`bind_tools(tools)` 호출 시 도구 스키마를 LLM에 바인딩하여 tool_calls 생성 가능.

### create_react_agent

`langgraph.prebuilt` 제공 함수. `create_react_agent(llm, tools)`로 ReAct 루프 그래프 컴파일.  
LLM 호출 → tool_calls 감지 → 도구 실행 → ToolMessage 추가 → tool_calls 없을 때까지 반복.  
08.function-call의 수동 for 루프를 한 줄로 대체.

### @tool 데코레이터

`langchain_core.tools.tool` 데코레이터. 함수 시그니처와 docstring에서 JSON 스키마 자동 생성.  
LLM이 인식하는 도구 목록(`TRAVEL_TOOLS`)에 추가하면 에이전트가 자동 호출·실행.

### ReAct 루프

Reasoning + Acting 패턴. LLM이 추론(Thought) → 도구 호출(Action) → 결과 관찰(Observation)을  
반복하며 최종 답변 생성. `create_react_agent`가 이 루프를 그래프 형태로 구현함.
