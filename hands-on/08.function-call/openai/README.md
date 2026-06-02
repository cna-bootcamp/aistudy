# OpenAI Function Calling 여행 플래너

OpenAI Chat Completions tool calling을 활용한 Streamlit 웹채팅 예제임.  
사용자가 여행 중 아침에 도시명을 입력하면 오늘의 날씨, 관광지, 맛집 정보를 조회하고  
날씨에 맞는 하루 여행 루트를 추천함.

## 파일 구조

```text
hands-on/08.function-call/
├── common/
│   ├── llm.py                 # hands-on/.env 로드 및 OpenAI 호출 공통 함수
│   ├── prompts.py             # 공통 시스템 프롬프트 및 OpenAI tool schema
│   ├── tools.py               # OpenWeatherMap, Google Places 외부 API 함수
│   └── ui_text.py             # Streamlit 공통 화면 텍스트
└── openai/
    ├── travel_planner.py      # OpenAI Streamlit 웹채팅 구현
    ├── README.md              # 예제 설명서
    └── requirements.txt       # 실행 의존성
```

## 주요 함수

| 함수 | 설명 |
|---|---|
| `initialize_session_state()` | Streamlit 대화 이력, OpenAI 클라이언트, 함수 호출 trace 초기화 |
| `get_client()` | `hands-on/.env`의 `OPENAI_API_KEY`로 OpenAI 클라이언트 생성 |
| `build_chat_messages()` | 시스템 프롬프트, 최근 대화, 현재 사용자 입력을 Chat Completions 메시지로 구성 |
| `generate_response()` | Chat Completions 호출, tool calls 처리, 최종 답변 생성 |
| `run_tool_call()` | 모델이 요청한 함수 실행 후 `role="tool"` 결과 메시지 생성 |
| `display_sidebar()` | 사용 예시, 기술 흐름, 직전 함수 호출 trace 표시 |

## 처리 흐름

```text
1. 사용자 입력 수신
   예: "서울", "도쿄 날씨", "파리 관광지", "부산 맛집"

2. Chat Completions 1차 호출
   messages + tools + tool_choice="auto" 전달

3. 모델의 tool_calls 여부 확인
   tool_calls 없음: 일반 답변 표시
   tool_calls 있음: 함수명과 JSON 인자 추출

4. common.tools.execute_function() 호출
   get_weather, get_tourist_attractions, get_restaurants 중 whitelist 함수만 실행

5. 함수 결과를 role="tool" 메시지로 추가
   tool_call_id로 assistant tool_call과 함수 결과 매칭

6. Chat Completions 재호출
   함수 결과를 바탕으로 한국어 최종 답변 생성
```

## Function Calling 동작 방식

### 단일 함수 호출

날씨, 관광지, 맛집 중 하나만 요청하면 해당 함수 하나만 호출함.

```text
사용자: "서울 날씨 알려줘"
모델 tool_calls:
  get_weather(city="Seoul")
함수 결과:
  role="tool", tool_call_id="...", content="{...현재 날씨...}"
최종 답변:
  서울의 현재 날씨, 온도, 습도, 이동 팁 안내
```

```text
사용자: "파리 관광지 추천"
모델 tool_calls:
  get_tourist_attractions(city="Paris")
최종 답변:
  평점, 간략 설명, 주소, 영문 query 기반 Google Maps 링크 포함
```

```text
사용자: "부산 맛집"
모델 tool_calls:
  get_restaurants(city="Busan")
최종 답변:
  맛집 목록을 평점과 간략 설명 포함 형식으로 안내
```

### 다중 함수 호출

여행 루트 요청이거나 도시명만 입력하면 여러 함수를 함께 호출함.

```text
사용자: "서울"
모델 tool_calls:
  get_weather(city="Seoul")
  get_tourist_attractions(city="Seoul")
  get_restaurants(city="Seoul", meal_type="breakfast")
  get_restaurants(city="Seoul", meal_type="lunch")
  get_restaurants(city="Seoul", meal_type="dinner")
```

모델은 함수 결과를 종합하여 오늘 날씨에 맞는 관광지를 선택함.  
비, 눈, 폭풍이면 실내 장소 우선, 맑음이면 야외 장소 우선으로 추천함.  
아침, 점심, 저녁 맛집은 각각 시간대별 일정에 포함함.

## Google Maps 링크 규칙

장소 링크는 함수 결과의 `google_maps_url` 값을 우선 사용함.  
URL의 `query` 파라미터는 반드시 영문으로 구성됨.

```markdown
[Gyeongbokgung Palace](https://www.google.com/maps/search/?api=1&query=Gyeongbokgung+Palace+Seoul)
```

## 환경변수

예제는 `hands-on/.env` 파일을 사용함.

```env
OPENAI_API_KEY=your_openai_api_key
OPENWEATHER_API_KEY=your_openweathermap_api_key
GOOGLE_PLACES_API_KEY=your_google_places_api_key
```

## 가상환경 설정 및 실행

```bash
cd /Users/dreamondal/workspace/aistudy/hands-on/08.function-call/openai

python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

streamlit run travel_planner.py
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

- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling?api-mode=chat)
- [OpenAI Chat Completions API](https://platform.openai.com/docs/api-reference/chat/create-chat-completion)
- [OpenWeatherMap Current Weather API](https://openweathermap.org/current)
- [Google Places Text Search API](https://developers.google.com/maps/documentation/places/web-service/text-search)
