# 여행 플래너 — LangChain + OpenAI (Streaming)

LangChain `create_agent`와 OpenAI `gpt-5.5`를 사용하는 스트리밍 여행 플래너 예제.  
`@tool` 데코레이터와 ReAct 에이전트로 08.function-call의 수동 도구 루프를 대체함.

---

## 디렉터리 구조

```
09.langchain/
├── common/
│   ├── llm.py          # 환경변수 로드 · API 키 헬퍼
│   ├── prompts.py      # SYSTEM_PROMPT
│   ├── tools.py        # @tool 데코레이터 · TRAVEL_TOOLS 목록
│   └── ui_text.py      # Streamlit UI 텍스트 상수
└── openai/
    ├── requirements.txt
    └── streaming/
        └── travel_planner.py
```

---

## 주요 소스 코드 설명

### `common/tools.py` — @tool 데코레이터

```python
@tool
def get_weather(city: str) -> dict:
    """Get current weather for a city. ..."""
    ...
```

- `@tool` 데코레이터가 함수 시그니처·docstring으로 JSON 스키마를 자동 생성함
- `TRAVEL_TOOLS = [get_weather, get_tourist_attractions, get_restaurants]` 목록을 에이전트에 전달

### `get_agent()` — 에이전트 생성 및 캐싱

```python
@st.cache_resource
def get_agent():
    llm = ChatOpenAI(model=MODEL_NAME, openai_api_key=api_key, temperature=0)
    return create_agent(llm, TRAVEL_TOOLS, system_prompt=SYSTEM_PROMPT)
```

- `@st.cache_resource`: 앱 재시작 전까지 에이전트를 한 번만 생성함
- `create_agent`: LLM + 도구 목록으로 ReAct 루프 그래프를 컴파일함 (`langchain.agents`, LangChain 1.0 표준)

### `stream_response()` — 스트리밍 제너레이터

```python
for chunk, metadata in agent.stream(
    {"messages": [*history, HumanMessage(content=user_input)]},
    stream_mode="messages",
    config={"recursion_limit": 25},
):
    if isinstance(chunk, AIMessageChunk) and chunk.content:
        ...yield text...
    elif isinstance(chunk, ToolMessage):
        ...trace 갱신...
```

- `stream_mode="messages"`: (메시지 청크, 메타데이터) 튜플을 순서대로 yield함
- `ToolMessage`: 도구 실행 결과로 사이드바 trace를 갱신함

### 처리 흐름

```
사용자 입력
  → build_history() → HumanMessage 변환
  → agent.stream() 호출
  → AIMessageChunk yield → st.write_stream() 실시간 렌더링
  → ToolMessage → tool_trace 갱신
  → 최종 응답 저장
```

---

## 가상환경 설정 및 실행

### 환경변수 설정

`hands-on/.env` 파일에 아래 키 설정:

```env
OPENAI_API_KEY=your_openai_api_key
OPENWEATHER_API_KEY=your_openweather_api_key
GOOGLE_PLACES_API_KEY=your_google_places_api_key
```

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

### 앱 실행

```bash
streamlit run streaming/travel_planner.py
```

---

## 08.function-call 대비 변경 사항

| 항목 | 08.function-call | 09.langchain |
|---|---|---|
| 도구 스키마 정의 | `TOOL_DEFINITIONS` JSON Schema 딕셔너리 | `@tool` 데코레이터 (자동 생성) |
| 도구 디스패처 | `execute_function()` 화이트리스트 함수 | 불필요 (LangChain이 자동 실행) |
| 모델별 변환 | `get_openai_tools()` 변환 함수 | 불필요 |
| 도구 루프 | `for _ in range(MAX_TOOL_ROUNDS):` 수동 루프 | `create_agent` 내부 자동 처리 |
| 스트리밍 | `chat.completions.create(stream=True)` + delta.tool_calls 누적 | `agent.stream(stream_mode="messages")` |
| 메시지 타입 | `dict` (role/content) | `HumanMessage` / `AIMessage` / `ToolMessage` |
