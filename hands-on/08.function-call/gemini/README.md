# Gemini Function Calling 여행 플래너

Streamlit 웹채팅에서 Google Gen AI Function Calling으로 오늘의 여행 루트 추천 예제 구현.

## 파일 구조
```text
hands-on/08.function-call/
├── common/
│   ├── llm.py          # Gemini 클라이언트 생성 및 generate_content 호출 공통 함수
│   ├── prompts.py      # 공통 시스템 프롬프트 및 Gemini Tool 선언 변환
│   ├── tools.py        # OpenWeatherMap, Google Places 외부 API 호출 함수
│   └── ui_text.py      # 공통 화면 문구
└── gemini/
    ├── travel_planner.py
    ├── README.md
    └── requirements.txt
```

## 주요 함수
| 함수 | 설명 |
| --- | --- |
| `initialize_session_state()` | Streamlit 채팅 이력, Gemini 클라이언트, 함수 호출 로그 초기화 |
| `get_client()` | `hands-on/.env`의 `GEMINI_API_KEY`로 Gemini 클라이언트 지연 생성 |
| `build_contents()` | Streamlit 메시지를 Gemini `types.Content` 배열로 변환 |
| `generate_response()` | 사용자 입력을 Gemini에 전달하고 함수 호출 여부에 따라 최종 답변 생성 |
| `run_function_calls()` | Gemini가 요청한 함수 실행 후 `role="tool"` Function Response 추가 |

## 처리 흐름
```text
1. 사용자 입력 수신
2. 공통 프롬프트와 Gemini Tool 정의를 포함하여 generate_content 호출
3. response.function_calls 확인
4. 함수 호출이 없으면 일반 텍스트 답변 표시
5. 함수 호출이 있으면 common.tools.execute_function으로 외부 API 실행
6. types.Part.from_function_response로 함수 결과 생성
7. types.Content(role="tool", parts=[...])로 Gemini에 함수 결과 전달
8. Gemini가 함수 결과를 바탕으로 최종 여행 답변 생성
```

## Function Calling 동작 방식
### 단일 함수 호출
요청 유형이 명확하면 필요한 함수 1개만 호출.

| 사용자 요청 | 호출 함수 | 결과 |
| --- | --- | --- |
| `서울 날씨` | `get_weather(city="Seoul")` | 현재 날씨, 온도, 습도, 풍속 안내 |
| `도쿄 관광지` | `get_tourist_attractions(city="Tokyo")` | 평점과 설명이 포함된 관광지 목록 |
| `부산 맛집` | `get_restaurants(city="Busan")` | 평점과 설명이 포함된 맛집 목록 |

### 다중 함수 호출
도시명만 입력하거나 여행 루트를 요청하면 여러 함수를 함께 호출.

```text
사용자: 서울
Gemini function_calls:
- get_weather(city="Seoul")
- get_tourist_attractions(city="Seoul")
- get_restaurants(city="Seoul")
```

모델은 날씨 결과를 보고 비 또는 눈이면 실내 관광지를 우선 추천하고, 맑으면 야외 관광지를 우선 추천함.  
아침, 점심, 저녁 식사는 맛집 결과에서 일정 흐름에 맞게 배치함.

## Gemini Function Response 주의사항
최신 `google-genai` SDK에서 함수 결과는 반드시 `role="tool"`로 전달.

```python
function_response_part = types.Part.from_function_response(
    name=function_name,
    response={"result": result},
)

contents.append(
    types.Content(
        role="tool",
        parts=[function_response_part],
    )
)
```

`role="user"`를 사용하면 Gemini가 함수 결과를 정상적인 Tool Result로 처리하지 못해 응답이 멈출 수 있음.

## 구글맵 링크 규칙
공통 `tools.py`가 장소별 `google_maps_url`을 생성함.  
URL의 `query` 파라미터는 영문 장소명과 영문 도시명을 사용함.

```text
[Gyeongbokgung Palace](https://www.google.com/maps/search/?api=1&query=Gyeongbokgung+Palace+Seoul)
```

## 가상환경 설정 및 실행
```bash
cd /Users/dreamondal/workspace/aistudy/hands-on/08.function-call/gemini

python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
streamlit run travel_planner.py
```

Windows Git Bash 사용 시:
```bash
source .venv/Scripts/activate
```

## 환경변수
예제는 `hands-on/.env`를 참조함.

필수 키:
```text
GEMINI_API_KEY=...
OPENWEATHER_API_KEY=...
GOOGLE_PLACES_API_KEY=...
```

## 참고 문서
- [Google Gen AI Python SDK](https://github.com/googleapis/python-genai)
- [OpenWeatherMap Current Weather API](https://openweathermap.org/current)
- [Google Places Text Search API](https://developers.google.com/maps/documentation/places/web-service/text-search)
