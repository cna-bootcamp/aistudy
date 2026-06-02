# 학습 예제 코드 주석 표준

## 개요

### 적용 범위
- `hands-on/` 하위 모든 Python 학습 예제 파일 대상
- 프로덕션 코드에는 적용하지 않음

### 핵심 원칙: 일반 코딩 가이드와 반대 방향

| 구분 | 일반(프로덕션) 코드 | 학습 예제 코드 |
|---|---|---|
| 주석 대상 | WHAT 금지, WHY만 기록 | **WHAT도 설명** (파이썬 관용구는 비전공자에게 WHAT 자체가 불명) |
| 생략 기준 | 함수명이 자명하면 생략 | 자명해 보여도 **처음 등장하는 개념**은 1줄 부연 필수 |

---

## 주석 4가지 유형

### 유형 1 — 모듈 Docstring (파일 맨 위)

**목적**: 이 파일이 무엇을 학습하는 예제인지, 핵심 개념 요약

**규칙**
- 한국어 작성, 명사체 종결 (예: `~함`, `~예제임`)
- 핵심 기술·개념을 1~3줄로 요약
- 전 단계 대비 변경점이 있으면 `[Before/After]` 형식으로 기술

**예시**
```python
"""LangChain + OpenAI 여행 플래너 (Streamlit 웹채팅)

[08.function-call 대비 핵심 변경 사항]
  Before: call_openai_chat() → tool_calls 감지 → execute_function() → 재호출 (수동 루프)
  After : create_react_agent(llm, tools) → agent.invoke() 한 번으로 루프 자동 처리
"""
```

---

### 유형 2 — 함수/클래스 Docstring

**목적**: 함수가 하는 일, 비전공자가 모를 수 있는 기술 개념 부연

**규칙**
- 한국어 작성, 명사체 종결
- 첫 줄: 함수가 하는 일을 1줄 요약
- 복잡한 알고리즘·외부 라이브러리 동작 원리 포함 시 줄바꿈 후 세부 설명 추가
- 함수명이 완전히 자명한 단순 getter는 생략 가능

**예시 — 기본형**
```python
def initialize_session_state() -> None:
    """Streamlit 재실행 사이에 유지할 상태 초기화."""
```

**예시 — 라이브러리 동작 원리 포함형**
```python
def get_agent():
    """ChatOpenAI + TRAVEL_TOOLS 로 ReAct 에이전트를 지연 생성 후 캐싱.

    create_react_agent(llm, tools) 동작 원리:
    1. llm.bind_tools(tools) 로 LLM에 도구 스키마를 바인딩
    2. LLM 호출 → tool_calls 있으면 도구 실행 → 결과를 ToolMessage로 추가
    3. tool_calls가 없을 때까지 2번 반복 (ReAct 루프)
    4. 최종 AIMessage 반환
    → 08.function-call의 수동 for 루프가 완전히 대체됨
    """
```

---

### 유형 3 — 섹션 구분선

**목적**: 긴 파일에서 논리적 블록을 시각적으로 구분

**규칙**
- 함수 5개 이상인 파일에만 사용 (짧은 파일에서 남용 금지)
- 75자 대시(`# ---...---`) + 한국어 섹션 제목 줄 + 75자 대시 형식

**예시**
```python
# ---------------------------------------------------------------------------
# 공통 모듈 경로 등록
# ---------------------------------------------------------------------------
```

---

### 유형 4 — 인라인 주석

**목적**: 코드 줄의 맥락·이유·주의사항 설명

**규칙**
- 코드 줄 **위**에 독립 줄로 작성 (같은 줄 뒤 주석은 짧은 단어 수준에만 허용)
- 파이썬 관용구 첫 등장 시: 구문이 하는 일을 1줄 부연
- 라이브러리·API 특이사항: "왜 이렇게 해야 하는지" 포함
- 자명한 코드 반복 절대 금지

**좋은 예**
```python
# load_hands_on_env()는 hands-on/.env를 로드함. API 키가 없으면
# create_openai_client() 내부에서 RuntimeError를 발생시켜 Streamlit 화면에 안내 가능함.
load_hands_on_env()

# 비용과 토큰 사용량을 줄이기 위해 최근 대화만 포함함.
# 여행 플래너 예제는 단일 요청 완결성이 중요하므로 최근 10개 메시지만으로 충분함.
for message in st.session_state.messages[-10:]:

# OpenAI Chat Completions에서 tool 결과는 반드시 role="tool" 메시지로 반환해야 함.
# tool_call_id는 어떤 함수 호출의 결과인지 모델이 매칭하는 필수 식별자임.
tool_message = {"role": "tool", "tool_call_id": tool_call.id, ...}
```

**나쁜 예**
```python
# 클라이언트 생성   ← 함수명으로 이미 자명
client = create_openai_client()

# 리스트에 추가    ← 코드를 한국어로 번역한 것에 불과
messages.append({"role": "user", "content": user_input})
```

---

## 파이썬 관용구 설명 의무 목록

아래 관용구가 **파일 내 처음 등장**하는 위치에 반드시 1줄 인라인 주석 추가.

| 관용구 | 주석 예시 |
|---|---|
| `from __future__ import annotations` | `# 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함` |
| `Path(__file__).resolve().parent` | `# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함` |
| `sys.path.insert(0, ...)` | `# 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 디렉터리를 추가함` |
| `if __name__ == "__main__":` | `# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)` |
| `@데코레이터` | `# @tool: 이 함수를 LangChain이 인식하는 '도구'로 변환함` (데코레이터별 역할 기술) |
| `:=` (바다코끼리 연산자) | `# := 는 조건 검사와 동시에 변수에 값을 할당함` |
| 타입 힌트 `list[dict[str, Any]]` | `# list[dict[str, Any]]: dict 타입 원소를 담는 리스트 타입 명시` |
| 리스트 컴프리헨션 | 복잡한 경우에만 위 줄에 1줄 설명 추가 |
| `with open(...) as f:` | `# with 블록을 벗어나면 파일이 자동으로 닫힘` |
| `@st.cache_resource` | `# 앱 재시작 전까지 한 번만 실행하여 결과를 캐싱함` |
| `if not api_key: raise RuntimeError(...)` | `# API 키 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함` |

---

## 외부 라이브러리 용어 설명 규칙

다음 범주의 클래스·함수가 **파일 내 처음 등장**할 때 1줄 주석으로 역할 설명.

### LangChain / LangGraph
```python
# ChatOpenAI: LangChain OpenAI 채팅 모델 래퍼 (llm.invoke()로 대화 요청 전송)
llm = ChatOpenAI(model=MODEL_NAME, api_key=api_key, temperature=0)

# create_react_agent: LLM + 도구 목록 → 컴파일된 ReAct 루프 그래프
st.session_state.agent = create_react_agent(llm, TRAVEL_TOOLS)

# HumanMessage / AIMessage / ToolMessage: LangChain 메시지 타입 (role을 객체로 표현)
messages = [HumanMessage(content=user_input)]
```

### Streamlit
```python
# st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
if "messages" not in st.session_state:

# st.chat_input: 채팅창 하단 입력란을 렌더링하고 입력값을 반환함
if user_input := st.chat_input("예: 서울 날씨"):
```

### OpenAI SDK
```python
# response.choices[0].message: API 응답에서 첫 번째 후보 메시지를 꺼냄
assistant_message = response.choices[0].message

# tool_call_id: 어떤 함수 호출의 결과인지 모델이 매칭하는 필수 식별자
tool_message = {"role": "tool", "tool_call_id": tool_call.id, ...}
```

---

## 언어 규칙

| 항목 | 규칙 |
|---|---|
| 모든 주석 언어 | **한국어** 통일 (영문 주석 금지) |
| Docstring 언어 | **한국어** 통일 |
| 기술 용어 | 영문 원어 유지 (예: `ReAct`, `tool_calls`, `BaseMessage`, `Streamlit`) |
| 종결어미 | 명사체 (`~함`, `~반환`, `~처리`, `~추가`) |
| 1줄 길이 | 120자 이내, 넘으면 다음 줄로 이어서 작성 |

---

## 금지 패턴

| 금지 유형 | 나쁜 예 | 이유 |
|---|---|---|
| 식별자 번역 주석 | `# 메시지 리스트에 추가` (코드: `messages.append(...)`) | 코드를 한국어로 읽어준 것에 불과함 |
| 자명한 반복 | `# 클라이언트 반환` (함수명: `get_client`) | 함수명이 이미 설명함 |
| 영문 주석 | `# Returns the client` | 학습자가 한국어로 읽어야 집중됨 |
| 과도한 섹션 구분선 | 짧은 파일에서 3줄짜리 함수마다 구분선 | 가독성 저하 |
| 미완성 주석 | `# TODO: 나중에 수정` | 학습 예제에 미완성 신호 금지 |
| 구버전 스타일 | `"""Returns: str"""` 형태의 Google/NumPy Docstring | 간결한 1줄 설명으로 대체 |

---

## 작성 완료 체크리스트

- [ ] 파일 상단에 모듈 Docstring 있음 (한국어, 핵심 기술 요약 포함)
- [ ] 모든 public 함수에 Docstring 있음 (단순 getter 제외)
- [ ] 파이썬 관용구 의무 목록 중 해당 항목에 첫 등장 주석 있음
- [ ] 외부 라이브러리 주요 클래스·함수 첫 등장 시 역할 주석 있음
- [ ] 영문 주석 없음
- [ ] 식별자 번역 수준의 무의미한 주석 없음
- [ ] 섹션 구분선은 함수 5개 이상인 파일에만 사용됨
