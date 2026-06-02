# 여행 플래너 - LangChain OpenAI

## 개요

LangChain `ChatOpenAI`와 `create_react_agent`로 구현한 여행 플래너.  
사용자가 도시명을 입력하면 날씨·관광지·맛집 도구를 자동으로 호출해 오늘의 여행 루트를 추천함.  
`create_react_agent`가 ReAct 루프를 자동 처리하므로 수동 tool_calls 루프 코드가 불필요함.

## 08.function-call 대비 핵심 변경점

| 구분 | Before (08.function-call) | After (09.langchain) |
|------|--------------------------|----------------------|
| LLM 호출 | `client.chat.completions.create()` | `ChatOpenAI` + `agent.invoke()` |
| 도구 루프 | `tool_calls` 감지 → `run_tool_call()` → 재호출 (수동 for 루프) | `create_react_agent`가 ReAct 루프 자동 처리 |
| 도구 스키마 | `TOOL_DEFINITIONS` (JSON Schema 수동 작성) | `@tool` 데코레이터가 함수 시그니처에서 자동 생성 |
| 메시지 타입 | `dict` (`role`, `content` 키) | `HumanMessage` / `AIMessage` / `SystemMessage` / `ToolMessage` 객체 |

## 환경 설정

`hands-on/.env` 파일에 아래 키를 설정함.

```
OPENAI_API_KEY=sk-...
OPENWEATHER_API_KEY=...
GOOGLE_PLACES_API_KEY=...
```

## 가상환경 설정

### 가상환경 설정 (Windows / PowerShell)
```powershell
cd hands-on/09.langchain/openai
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)
```bash
cd hands-on/09.langchain/openai
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)
```bash
cd hands-on/09.langchain/openai
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 실행

```bash
streamlit run travel_planner.py
```

## 학습 포인트

| 항목 | 설명 |
|------|------|
| `ChatOpenAI` | LangChain OpenAI 채팅 모델 래퍼. `llm.invoke()`로 대화 요청을 전송함 |
| `create_react_agent` | LLM + 도구 목록을 받아 컴파일된 ReAct 루프 그래프를 반환함 |
| `@tool` 데코레이터 | 일반 함수를 LangChain 도구로 변환. 함수 시그니처와 docstring으로 JSON 스키마를 자동 생성함 |
| ReAct 루프 | LLM이 tool_calls를 생성 → 도구 실행 → ToolMessage 추가 → tool_calls가 없을 때까지 반복 |
