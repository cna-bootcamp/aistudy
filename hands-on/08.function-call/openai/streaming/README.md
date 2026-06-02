# OpenAI Function Calling 여행 플래너 - Streaming 버전

OpenAI Chat Completions Tool Calling을 활용한 Streamlit 스트리밍 웹채팅 예제.  
기존 예제와 동일한 기능을 유지하면서, 응답 텍스트를 실시간으로 렌더링하는 Streaming 방식으로 출력함.

## 파일 구조

```text
hands-on/08.function-call/
├── common/
│   ├── llm.py                          # hands-on/.env 로드 및 OpenAI 클라이언트 생성 함수
│   ├── prompts.py                      # 공통 시스템 프롬프트 및 OpenAI tool schema
│   ├── tools.py                        # OpenWeatherMap, Google Places 외부 API 함수
│   └── ui_text.py                      # Streamlit 공통 화면 텍스트
└── openai/
    ├── travel_planner.py               # 비스트리밍 버전 (기존 예제)
    ├── streaming/
    │   ├── travel_planner.py           # Streaming 버전 (이 예제)
    │   └── README.md
    ├── README.md
    └── requirements.txt
```

## 주요 함수

| 함수 | 설명 |
|---|---|
| `initialize_session_state()` | Streamlit 대화 이력, OpenAI 클라이언트, 함수 호출 trace 초기화 |
| `get_client()` | `hands-on/.env`의 `OPENAI_API_KEY`로 OpenAI 클라이언트 생성 |
| `build_chat_messages()` | system 메시지 포함 최근 대화와 현재 입력을 메시지 배열로 구성 |
| `parse_tool_arguments()` | tool_call의 JSON 문자열 arguments를 안전하게 dict로 변환 |
| `stream_response()` | 텍스트 청크를 yield하는 스트리밍 제너레이터, tool_calls 내부 처리 포함 |
| `display_sidebar()` | 사용 예시, 기술 흐름, 직전 함수 호출 trace 표시 |

## 처리 흐름

```text
1. 사용자 입력 수신

2. chat.completions.create(stream=True) 호출
   model, messages, tools, stream=True 전달

3. 청크 이터레이터 순회
   delta.content 있음 → yield (실시간 텍스트 렌더링)
   delta.tool_calls 있음 → index별로 id/name/arguments 누적

4. finish_reason 확인 (마지막 청크)
   "stop":       텍스트 응답 완료
   "tool_calls": 누적된 tool_call을 실행

5. common.tools.execute_function() 호출
   get_weather, get_tourist_attractions, get_restaurants 중 whitelist 함수만 실행

6. assistant 메시지(tool_calls 포함) + role="tool" 메시지를 messages에 추가
   tool_call_id로 요청과 결과를 1:1 매칭

7. 새 스트림 시작 (2번으로 반복)
   최종 답변 텍스트를 실시간 스트리밍으로 렌더링
```

## Streaming 방식 핵심 설명

### 비스트리밍 vs. 스트리밍 비교

| 항목 | 비스트리밍 (`travel_planner.py`) | 스트리밍 (`streaming/travel_planner.py`) |
|---|---|---|
| API 호출 | `create()` | `create(stream=True)` |
| 텍스트 수신 | `assistant_message.content` | `delta.content` 청크 누적 |
| 화면 렌더링 | 완성 후 일괄 표시 | `st.write_stream()`으로 실시간 표시 |
| tool_calls 확인 | `assistant_message.tool_calls` | `finish_reason == "tool_calls"` |
| arguments 수신 | 완성된 JSON 문자열 | 여러 청크에 걸쳐 누적 필요 |

### tool_calls 청크 누적 방식

OpenAI 스트리밍에서 tool_call 정보는 여러 청크에 걸쳐 분할 전달됨.  
`index`를 키로 사용하여 각 tool_call의 `id`, `name`, `arguments` 조각을 누적해야 함.

```python
accumulated_tool_calls: dict[int, dict] = {}

for chunk in stream:
    if delta.tool_calls:
        for tc_delta in delta.tool_calls:
            idx = tc_delta.index
            if idx not in accumulated_tool_calls:
                accumulated_tool_calls[idx] = {
                    "id": "", "type": "function",
                    "function": {"name": "", "arguments": ""},
                }
            tc = accumulated_tool_calls[idx]
            if tc_delta.id:
                tc["id"] += tc_delta.id
            if tc_delta.function:
                if tc_delta.function.name:
                    tc["function"]["name"] += tc_delta.function.name
                if tc_delta.function.arguments:
                    tc["function"]["arguments"] += tc_delta.function.arguments
```

### stream_response() 제너레이터

`stream_response()`는 `Generator[str, None, None]` 타입의 제너레이터 함수임.  
텍스트 청크를 `yield`하면서 tool_calls가 발생하면 내부에서 함수를 실행하고 새 스트림을 시작함.

```python
def stream_response(user_input: str) -> Generator[str, None, None]:
    for _ in range(MAX_TOOL_ROUNDS):
        stream = client.chat.completions.create(
            model=MODEL_NAME, messages=messages,
            tools=tools, stream=True,
        )

        for chunk in stream:
            if delta.content:
                yield delta.content           # 실시간 텍스트 전달
            if delta.tool_calls:
                # index별로 tool_call 누적

        if finish_reason != "tool_calls":
            return                            # 스트리밍 완료

        # tool_calls 실행 후 루프 계속
```

### assistant 메시지 순서 규칙

tool_calls가 있는 assistant 메시지를 tool 결과보다 먼저 messages에 추가해야 함.  
이 순서가 있어야 다음 API 호출에서 tool 결과를 올바른 요청의 응답으로 해석함.

```python
# 1. tool_calls를 포함한 assistant 메시지를 먼저 추가
messages.append({"role": "assistant", "tool_calls": tool_calls_list})

# 2. 각 tool_call의 실행 결과를 role="tool"로 추가
messages.append({
    "role": "tool",
    "tool_call_id": tc["id"],
    "content": json.dumps(result, ensure_ascii=False),
})
```

## 환경변수

예제는 `hands-on/.env` 파일을 사용함.

```env
OPENAI_API_KEY=your_openai_api_key
OPENWEATHER_API_KEY=your_openweathermap_api_key
GOOGLE_PLACES_API_KEY=your_google_places_api_key
```

## 가상환경 설정 및 실행

streaming 버전은 상위 `openai/` 디렉터리와 동일한 requirements.txt를 사용함.

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\08.function-call\openai
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/08.function-call/openai
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/08.function-call/openai
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 실행

가상환경 활성화 후 streaming 디렉터리에서 실행함.

```bash
streamlit run streaming/travel_planner.py
```

실행 후 브라우저에서 `http://localhost:8501` 접속.

## 테스트 입력 예시

```text
서울
도쿄 날씨
파리 관광지
부산 맛집
제주 여행 루트
```

## 참고 공식 문서

- [OpenAI Streaming](https://platform.openai.com/docs/api-reference/streaming)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [OpenAI Chat Completions API](https://platform.openai.com/docs/api-reference/chat)
