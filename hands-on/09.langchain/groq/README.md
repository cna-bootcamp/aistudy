# 여행 플래너 — Groq gpt-oss-120b + LangGraph

## 앱 개요

### 목적
Groq LPU의 `gpt-oss-120b` reasoning 모델과 LangChain·LangGraph를 연동하여
멀티턴 대화 기반 여행 일정 생성 챗봇을 구현한 LangChain 학습 예제.

### 주요 기능
| 기능 | 설명 |
|------|------|
| 여행 루트 생성 | 도시명 입력 → 날씨·관광지·음식점 도구 호출 → 10:00~17:00 일정 제안 |
| 멀티턴 대화 | MemorySaver(thread_id)로 이전 대화 맥락 유지 |
| 슬라이딩 윈도우 + 요약 | HumanMessage 3개 초과 시 오래된 메시지를 요약으로 압축·삭제 |
| ReAct 루프 | chatbot → tools → chatbot 반복으로 여러 도구 자동 호출 |
| 구글맵 링크 | 음식점·관광지마다 구글맵 검색 URL 포함 |

### 09.langchain/openai 대비 변경 사항
| 항목 | openai 버전 | 이번 버전(groq) |
|------|------------|----------------|
| LLM | `gpt-5.5` (ChatOpenAI) | `gpt-oss-120b` (ChatGroq) |
| 에이전트 | `create_agent()` 단순 래퍼 | 커스텀 `StateGraph` (3-노드) |
| 메모리 | MemorySaver (기본) | MemorySaver + 슬라이딩 윈도우 요약 |
| 상태 | `messages` 단일 필드 | `messages` + `summary` 2개 필드 |

---

## 주요 소스 파일 설명

### `travel_planner.py` (이 예제 본체)
| 구성 요소 | 설명 |
|----------|------|
| `TravelState` | LangGraph 공유 상태 (`messages`, `summary`) |
| `build_agent()` | StateGraph 구성 및 컴파일 |
| `chatbot_node` | 슬라이딩 윈도우 적용 LLM 호출 노드 |
| `tool_node` | 날씨·관광지·맛집 도구 실행 노드 |
| `summarize_node` | 윈도우 초과 시 요약 및 RemoveMessage 노드 |
| `generate_response()` | Streamlit에서 에이전트 호출 및 응답 추출 |
| `main()` | Streamlit 앱 진입점 |

### `../common/` (공통 모듈)
| 파일 | 설명 |
|------|------|
| `llm.py` | `require_api_key()` — `hands-on/.env` 로드 및 API 키 반환 |
| `prompts.py` | `SYSTEM_PROMPT` — 여행 플래너 시스템 프롬프트 |
| `tools.py` | `TRAVEL_TOOLS` — `get_weather`, `get_tourist_attractions`, `get_restaurants` |
| `ui_text.py` | Streamlit UI 텍스트 상수 |

---

## LangGraph 워크플로우

```
START
  │
  ▼
chatbot ──(tool_calls 있음)──► tools ──► chatbot (ReAct 루프)
  │
  (tool_calls 없음)
  │
  ▼
summarize ──► END
  (HumanMessage > 3개면 오래된 메시지 요약·삭제)
  (3개 이하면 아무것도 하지 않음)
```

---

## 가상환경 설정

```bash
# 프로젝트 루트(hands-on/)에서 실행
cd C:/Users/hiond/workspace/aistudy/hands-on

# 가상환경 생성 (Python 3.11 이상 권장)
python -m venv .venv

# 활성화 (Windows)
.venv\Scripts\activate

# 의존성 설치
pip install -r 09.langchain/groq/requirements.txt
```

---

## 실행 방법

```bash
# hands-on/ 디렉터리에서 실행
streamlit run 09.langchain/groq/travel_planner.py
```

브라우저에서 `http://localhost:8501` 접속 후 도시명 입력.

### 필수 환경 변수 (`hands-on/.env`)
| 변수명 | 용도 | 취득처 |
|--------|------|--------|
| `GROQ_API_KEY` | Groq LPU API 키 | https://console.groq.com/keys |
| `OPENWEATHER_API_KEY` | 날씨 조회 | https://home.openweathermap.org/api_keys |
| `GOOGLE_PLACES_API_KEY` | 관광지·맛집 검색 | https://console.cloud.google.com/apis/credentials |

---

## Groq gpt-oss-120b reasoning 모델 특이점

| 항목 | 내용 |
|------|------|
| `content` None | 응답 생성 전 reasoning 단계에서 `content`가 `None`일 수 있음 → `or ""` 가드 필수 |
| `max_tokens` | reasoning + 출력 합산 예산 → 일정 생성은 8000 이상 권장 |
| 빈 choices | 스트리밍 시 keepalive 청크 올 수 있음 → `if not chunk.choices: continue` |
