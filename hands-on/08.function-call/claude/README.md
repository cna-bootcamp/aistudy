# Claude Function Calling 여행 플래너

Claude Messages API Tool Use를 활용한 Streamlit 웹채팅 예제.  
사용자가 여행 중 아침에 도시명을 입력하면 오늘의 날씨, 관광지, 맛집 정보를 조회하고  
날씨에 맞는 하루 여행 루트를 추천함.

## 파일 구조

```text
hands-on/08.function-call/
├── common/
│   ├── llm.py                 # hands-on/.env 로드 및 Claude 호출 공통 함수
│   ├── prompts.py             # 공통 시스템 프롬프트 및 Claude tool schema
│   ├── tools.py               # OpenWeatherMap, Google Places 외부 API 함수
│   └── ui_text.py             # Streamlit 공통 화면 텍스트
└── claude/
    ├── travel_planner.py      # Claude Streamlit 웹채팅 구현
    ├── README.md              # 예제 설명서
    └── requirements.txt       # 실행 의존성
```

## 주요 함수

| 함수 | 설명 |
|---|---|
| `initialize_session_state()` | Streamlit 대화 이력, Claude 클라이언트, 함수 호출 trace 초기화 |
| `get_client()` | `hands-on/.env`의 `CLAUDE_API_KEY`로 Claude 클라이언트 생성 |
| `build_chat_messages()` | 최근 대화와 현재 사용자 입력을 Messages API 메시지로 구성 |
| `generate_response()` | Messages API 호출, tool_use 처리, 최종 답변 생성 |
| `run_tool_calls()` | 모델이 요청한 모든 함수 실행 후 단일 `role="user"` tool_result 메시지 생성 |
| `extract_text()` | 응답 content 블록에서 `type == "text"` 블록만 추출하여 텍스트 반환 |
| `display_sidebar()` | 사용 예시, 기술 흐름, 직전 함수 호출 trace 표시 |

## 처리 흐름

```text
1. 사용자 입력 수신
   예: "서울", "도쿄 날씨", "파리 관광지", "부산 맛집"

2. Claude Messages API 1차 호출
   messages + system + tools 전달

3. response.stop_reason 확인
   "end_turn": 일반 텍스트 답변 표시
   "tool_use": content 블록에서 tool_use 블록 추출

4. common.tools.execute_function() 호출
   get_weather, get_tourist_attractions, get_restaurants 중 whitelist 함수만 실행

5. 함수 결과를 role="user" + type="tool_result" 메시지로 추가
   tool_use_id로 assistant tool_use 블록과 함수 결과 매칭
   모든 tool_result 블록을 단일 user 메시지에 묶어 전달

6. Messages API 재호출
   함수 결과를 바탕으로 한국어 최종 답변 생성
```

## Function Calling 동작 방식

### 단일 함수 호출

날씨, 관광지, 맛집 중 하나만 요청하면 해당 함수 하나만 호출함.

```text
사용자: "서울 날씨 알려줘"
모델 tool_use:
  get_weather(city="Seoul")
함수 결과:
  role="user", type="tool_result", tool_use_id="...", content="{...현재 날씨...}"
최종 답변:
  서울의 현재 날씨, 온도, 습도, 이동 팁 안내
```

```text
사용자: "파리 관광지 추천"
모델 tool_use:
  get_tourist_attractions(city="Paris")
최종 답변:
  평점, 간략 설명, 주소, 영문 query 기반 Google Maps 링크 포함
```

```text
사용자: "부산 맛집"
모델 tool_use:
  get_restaurants(city="Busan")
최종 답변:
  맛집 목록을 평점과 간략 설명 포함 형식으로 안내
```

### 다중 함수 호출

여행 루트 요청이거나 도시명만 입력하면 여러 함수를 함께 호출함.

```text
사용자: "서울"
모델 tool_use 블록 (content 리스트):
  get_weather(city="Seoul")
  get_tourist_attractions(city="Seoul")
  get_restaurants(city="Seoul", meal_type="breakfast")
  get_restaurants(city="Seoul", meal_type="lunch")
  get_restaurants(city="Seoul", meal_type="dinner")
```

모델은 함수 결과를 종합하여 오늘 날씨에 맞는 관광지를 선택함.  
비, 눈, 폭풍이면 실내 장소 우선, 맑음이면 야외 장소 우선으로 추천함.  
아침, 점심, 저녁 맛집은 각각 시간대별 일정에 포함함.

## Claude Tool Use 핵심 주의사항

### Tool Result 전달 방식

Claude Messages API에서 함수 결과는 반드시 `role="user"` + `type="tool_result"`로 전달함.  
한 assistant 턴의 여러 tool_use 블록은 **단일 user 메시지**에 묶어야 함.

```python
# 올바른 방식: 모든 tool_result를 하나의 user 메시지에 묶음
messages.append({
    "role": "user",
    "content": [
        {
            "type": "tool_result",
            "tool_use_id": "toolu_01...",
            "content": json.dumps(result1, ensure_ascii=False),
        },
        {
            "type": "tool_result",
            "tool_use_id": "toolu_02...",
            "content": json.dumps(result2, ensure_ascii=False),
        },
    ],
})
```

### Assistant Content 보존

tool_use 턴의 assistant 응답은 content 블록 리스트를 그대로 저장함.  
텍스트만 추출하면 tool_use_id 매칭이 깨짐.

```python
# 올바른 방식: response.content (블록 리스트)를 그대로 전달
messages.append({"role": "assistant", "content": response.content})

# 잘못된 방식: 텍스트만 추출하면 tool_use_id 매칭 불가
# messages.append({"role": "assistant", "content": response.content[0].text})
```

### stop_reason 확인

```python
# tool_use 여부를 stop_reason으로 판단함
if response.stop_reason == "tool_use":
    # tool_use 블록 처리
    ...
else:
    # "end_turn": 최종 텍스트 답변 반환
    return extract_text(response)
```

## Google Maps 링크 규칙

장소 링크는 함수 결과의 `google_maps_url` 값을 우선 사용함.  
URL의 `query` 파라미터는 반드시 영문으로 구성됨.

```markdown
[Gyeongbokgung Palace](https://www.google.com/maps/search/?api=1&query=Gyeongbokgung+Palace+Seoul)
```

## 환경변수

예제는 `hands-on/.env` 파일을 사용함.

```env
CLAUDE_API_KEY=your_anthropic_api_key
OPENWEATHER_API_KEY=your_openweathermap_api_key
GOOGLE_PLACES_API_KEY=your_google_places_api_key
```

## 가상환경 설정 및 실행

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

```bash
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

- [Anthropic Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [Claude Messages API](https://docs.anthropic.com/en/api/messages)
- [OpenWeatherMap Current Weather API](https://openweathermap.org/current)
- [Google Places Text Search API](https://developers.google.com/maps/documentation/places/web-service/text-search)
