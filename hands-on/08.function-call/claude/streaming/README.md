# Claude Function Calling 여행 플래너 - Streaming 버전

Claude Messages API Tool Use를 활용한 Streamlit 스트리밍 웹채팅 예제.  
기존 예제와 동일한 기능을 유지하면서, 응답 텍스트를 실시간으로 렌더링하는 Streaming 방식으로 출력함.

## 파일 구조

```text
hands-on/08.function-call/
├── common/
│   ├── llm.py                          # hands-on/.env 로드 및 Claude 클라이언트 생성 함수
│   ├── prompts.py                      # 공통 시스템 프롬프트 및 Claude tool schema
│   ├── tools.py                        # OpenWeatherMap, Google Places 외부 API 함수
│   └── ui_text.py                      # Streamlit 공통 화면 텍스트
└── claude/
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
| `initialize_session_state()` | Streamlit 대화 이력, Claude 클라이언트, 함수 호출 trace 초기화 |
| `get_client()` | `hands-on/.env`의 `CLAUDE_API_KEY`로 Claude 클라이언트 생성 |
| `build_chat_messages()` | 최근 대화와 현재 사용자 입력을 Messages API 메시지 배열로 구성 |
| `run_tool_calls()` | 모든 tool_use 블록을 실행하고 단일 `role="user"` tool_result 메시지 생성 |
| `stream_response()` | 텍스트 청크를 yield하는 스트리밍 제너레이터, tool_use 내부 처리 포함 |
| `display_sidebar()` | 사용 예시, 기술 흐름, 직전 함수 호출 trace 표시 |

## 처리 흐름

```text
1. 사용자 입력 수신

2. client.messages.stream() 컨텍스트 진입
   model, max_tokens, system, tools, messages 전달

3. stream.text_stream 이터레이터로 텍스트 청크 수신
   → st.write_stream()이 각 청크를 화면에 실시간 렌더링

4. stream.get_final_message()로 stop_reason 확인
   "end_turn": 스트리밍 완료, 전체 텍스트 반환
   "tool_use": content 블록에서 tool_use 블록 추출

5. common.tools.execute_function() 호출
   get_weather, get_tourist_attractions, get_restaurants 중 whitelist 함수만 실행

6. 함수 결과를 role="user" + type="tool_result" 메시지로 추가
   tool_use_id로 assistant tool_use 블록과 함수 결과 매칭
   모든 tool_result 블록을 단일 user 메시지에 묶어 전달

7. 새 스트림 시작 (2번으로 반복)
   최종 답변 텍스트를 실시간 스트리밍으로 렌더링
```

## Streaming 방식 핵심 설명

### 비스트리밍 vs. 스트리밍 비교

| 항목 | 비스트리밍 (`travel_planner.py`) | 스트리밍 (`streaming/travel_planner.py`) |
|---|---|---|
| API 호출 | `client.messages.create()` | `client.messages.stream()` 컨텍스트 |
| 텍스트 수신 | 완성된 전체 텍스트 반환 | `stream.text_stream`으로 청크 단위 수신 |
| 화면 렌더링 | 완성 후 일괄 표시 | `st.write_stream()`으로 실시간 표시 |
| stop_reason | `response.stop_reason` | `stream.get_final_message().stop_reason` |
| tool_use 처리 | 동일 | 동일 |

### stream_response() 제너레이터

`stream_response()`는 `Generator[str, None, None]` 타입의 제너레이터 함수임.  
텍스트 청크를 `yield`하면서 tool_use가 발생하면 내부에서 함수를 실행하고 새 스트림을 시작함.

```python
def stream_response(user_input: str) -> Generator[str, None, None]:
    for _ in range(MAX_TOOL_ROUNDS):
        with client.messages.stream(
            model=MODEL_NAME,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=tools,
            messages=messages,
        ) as stream:
            for text_chunk in stream.text_stream:
                yield text_chunk          # 실시간 텍스트 전달

            final_message = stream.get_final_message()

        if final_message.stop_reason != "tool_use":
            return                        # 스트리밍 완료

        # tool_use 처리 후 루프 계속
        messages.append({"role": "assistant", "content": final_message.content})
        tool_result_message, traces = run_tool_calls(final_message)
        messages.append(tool_result_message)
```

### st.write_stream() 사용

`st.write_stream()`은 제너레이터를 받아 청크를 실시간으로 렌더링하고  
스트리밍이 끝나면 누적된 전체 텍스트를 반환함.

```python
assistant_response = st.write_stream(stream_response(user_input))
# 반환값: 스트리밍 완료 후 전체 텍스트 문자열
```

### tool_use 턴의 동작

tool_use가 필요한 턴(날씨·관광지·맛집 조회)에서는:
- `stream.text_stream`에 텍스트 청크가 없으므로 화면 출력 없이 진행
- `stream.get_final_message()`로 tool_use 블록을 추출하여 함수 실행
- 함수 결과를 messages에 추가한 뒤 새 스트림을 시작
- 최종 답변 스트림에서 텍스트 청크가 실시간으로 출력됨

## Tool Use 핵심 주의사항

### streaming 버전에서 content 보존

`stream.get_final_message().content`에는 tool_use 블록이 포함되어 있음.  
이를 그대로 messages에 추가해야 tool_use_id 매칭이 유지됨.

```python
# 올바른 방식: final_message.content (블록 리스트)를 그대로 전달
messages.append({"role": "assistant", "content": final_message.content})

# 잘못된 방식: 스트리밍 텍스트만 저장하면 tool_use_id 매칭 불가
# messages.append({"role": "assistant", "content": accumulated_text})
```

### tool_result 전달 방식

여러 tool_use 블록의 결과는 단일 `role="user"` 메시지에 묶어 전달함.

```python
tool_result_message = {
    "role": "user",
    "content": [
        {"type": "tool_result", "tool_use_id": "toolu_01...", "content": "..."},
        {"type": "tool_result", "tool_use_id": "toolu_02...", "content": "..."},
    ],
}
```

## 환경변수

예제는 `hands-on/.env` 파일을 사용함.

```env
CLAUDE_API_KEY=your_anthropic_api_key
OPENWEATHER_API_KEY=your_openweathermap_api_key
GOOGLE_PLACES_API_KEY=your_google_places_api_key
```

## 가상환경 설정 및 실행

streaming 버전은 상위 `claude/` 디렉터리와 동일한 requirements.txt를 사용함.

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\08.function-call\claude
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/08.function-call/claude
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/08.function-call/claude
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

- [Anthropic Streaming](https://docs.anthropic.com/en/api/messages-streaming)
- [Anthropic Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [Claude Messages API](https://docs.anthropic.com/en/api/messages)
