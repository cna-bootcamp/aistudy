# Gemini Function Calling 여행 플래너 - Streaming 버전

Gemini Function Calling을 활용한 Streamlit 스트리밍 웹채팅 예제.  
기존 예제와 동일한 기능을 유지하면서, 응답 텍스트를 실시간으로 렌더링하는 Streaming 방식으로 출력함.

## 파일 구조

```text
hands-on/08.function-call/
├── common/
│   ├── llm.py                          # hands-on/.env 로드 및 Gemini 클라이언트 생성 함수
│   ├── prompts.py                      # 공통 시스템 프롬프트 및 Gemini FunctionDeclaration schema
│   ├── tools.py                        # OpenWeatherMap, Google Places 외부 API 함수
│   └── ui_text.py                      # Streamlit 공통 화면 텍스트
└── gemini/
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
| `initialize_session_state()` | Streamlit 대화 이력, Gemini 클라이언트, 함수 호출 로그 초기화 |
| `get_client()` | `hands-on/.env`의 `GEMINI_API_KEY`로 Gemini 클라이언트 생성 |
| `build_contents()` | Streamlit 채팅 이력을 Gemini Content 배열로 변환 (assistant → model role) |
| `stream_response()` | 텍스트 청크를 yield하는 스트리밍 제너레이터, function_calls 내부 처리 포함 |
| `display_sidebar()` | 사용 예시, 기술 흐름, 최근 함수 호출 로그 표시 |

## 처리 흐름

```text
1. 사용자 입력 수신

2. client.models.generate_content_stream() 호출
   model, contents, GenerateContentConfig(tools, system_instruction) 전달

3. 청크 이터레이터 순회
   chunk.text 있음 → yield (실시간 텍스트 렌더링)
   마지막 candidates[0].content 저장 (function_calls 확인용)

4. 스트리밍 완료 후 function_calls 확인
   없음: 텍스트 응답 완료
   있음: 함수 실행 후 대화 이력에 추가

5. common.tools.execute_function() 호출
   get_weather, get_tourist_attractions, get_restaurants 중 whitelist 함수만 실행

6. 모델 content + role="tool" Content를 contents에 추가
   function_response는 단일 role="tool" Content에 묶어 전달

7. 새 스트림 시작 (2번으로 반복)
   최종 답변 텍스트를 실시간 스트리밍으로 렌더링
```

## Streaming 방식 핵심 설명

### 비스트리밍 vs. 스트리밍 비교

| 항목 | 비스트리밍 (`travel_planner.py`) | 스트리밍 (`streaming/travel_planner.py`) |
|---|---|---|
| API 호출 | `generate_content()` | `generate_content_stream()` |
| 텍스트 수신 | `response.text` | `chunk.text` 청크 단위 수신 |
| 화면 렌더링 | 완성 후 일괄 표시 | `st.write_stream()`으로 실시간 표시 |
| function_calls 확인 | `response.function_calls` | 마지막 `chunk.candidates[0].content` |
| 대화 이력 추가 | `response.candidates[0].content` | `last_candidate_content` |

### Gemini 스트리밍 특성

Gemini는 텍스트 응답과 function_call 응답을 같은 턴에 혼합하지 않음.

- **function_call 턴**: `chunk.text`가 없으므로 화면 출력 없이 내부 처리만 진행
- **최종 텍스트 턴**: `chunk.text` 청크가 실시간으로 출력됨
- function_call 응답은 청크에 분리되지 않고 완전한 형태로 도착함

### stream_response() 제너레이터

`stream_response()`는 `Generator[str, None, None]` 타입의 제너레이터 함수임.  
텍스트 청크를 `yield`하면서 function_calls가 발생하면 내부에서 함수를 실행하고 새 스트림을 시작함.

```python
def stream_response(user_input: str) -> Generator[str, None, None]:
    for _ in range(MAX_FUNCTION_CALL_ROUNDS):
        # function_call이 포함된 청크만 추적 (빈 청크가 덮어쓰는 문제 방지)
        accumulated_function_calls: list[Any] = []
        model_content_with_fc = None

        for chunk in client.models.generate_content_stream(
            model=MODEL_NAME, contents=contents,
            config=types.GenerateContentConfig(tools=tools, system_instruction=SYSTEM_PROMPT),
        ):
            if chunk.text:
                yield chunk.text              # 실시간 텍스트 전달

            if chunk.candidates and chunk.candidates[0].content:
                content = chunk.candidates[0].content
                new_fcs = [
                    part.function_call
                    for part in (content.parts or [])
                    if hasattr(part, "function_call") and part.function_call
                ]
                if new_fcs:
                    accumulated_function_calls.extend(new_fcs)
                    model_content_with_fc = content  # function_call 포함 content만 보존

        if not accumulated_function_calls:
            return                            # 스트리밍 완료

        # function_calls 실행 후 루프 계속
```

### Function Response 전달 방식

모든 function_response를 단일 `role="tool"` Content에 묶어 전달함.  
`role="user"`로 보내면 최신 google-genai SDK에서 후속 응답이 멈출 수 있음.

```python
# 1. 모델의 function_call content를 대화 이력에 먼저 추가
contents.append(last_candidate_content)

# 2. 모든 function_response를 단일 role="tool" Content로 묶어 추가
contents.append(
    types.Content(
        role="tool",
        parts=[
            types.Part.from_function_response(name=fn, response={"result": result})
            for fn, result in results
        ],
    )
)
```

## 환경변수

예제는 `hands-on/.env` 파일을 사용함.

```env
GEMINI_API_KEY=your_google_ai_api_key
OPENWEATHER_API_KEY=your_openweathermap_api_key
GOOGLE_PLACES_API_KEY=your_google_places_api_key
```

## 가상환경 설정 및 실행

streaming 버전은 상위 `gemini/` 디렉터리와 동일한 requirements.txt를 사용함.

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\08.function-call\gemini
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/08.function-call/gemini
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/08.function-call/gemini
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

- [Google Gen AI Streaming](https://googleapis.github.io/python-genai/#streaming)
- [Gemini Function Calling](https://ai.google.dev/gemini-api/docs/function-calling)
- [Google Gen AI Python SDK](https://googleapis.github.io/python-genai/)
