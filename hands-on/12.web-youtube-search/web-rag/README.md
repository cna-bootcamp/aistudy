# 멀티소스 RAG (특허법 벡터 DB + 웹검색)

질문 유형에 따라 검색 소스를 자동 선택하는 멀티소스 RAG 예제임.  
특허법 질문은 사전 구축된 **특허법 벡터 DB**로, 최신 트렌드 질문은 **DuckDuckGo 웹검색**으로 라우팅함.

- 특허법 질문 → 특허법 벡터 DB(`10.rag/vectordb`, 컬렉션 `patent_law`) 검색 → 답변
- 최신 트렌드 질문 → DuckDuckGo 웹검색(최근 1년·상위 5건) → 출처 URL 포함 답변

> `10.rag/naive`(단일 소스 RAG)에 **질문 라우팅 + 웹검색 소스**를 추가한 확장 예제임.

---

## 1. 동작 개요

```
                ┌──────────────────────────────┐
                │         사용자 질문           │
                └──────────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────────┐
                │   Query Router (LLM 분류)     │
                │  "patent" 인가 "web" 인가?     │
                └──────────────────────────────┘
                    │                      │
            patent  ▼                      ▼  web
       ┌─────────────────────┐   ┌─────────────────────┐
       │  특허법 벡터 DB       │   │  DuckDuckGo 웹검색   │
       │  (ChromaDB, Top 5)   │   │  (최근 1년, 5건)     │
       └─────────────────────┘   └─────────────────────┘
                    │                      │
                    └──────────┬───────────┘
                               ▼
                ┌──────────────────────────────┐
                │   답변 생성 (Groq gpt-oss-120b) │
                │   소스별 프롬프트로 근거 기반 답변 │
                └──────────────────────────────┘
```

- **라우팅**: LLM이 질문을 `patent`/`web` 한 단어로 분류. 응답이 모호하면 특허 키워드 휴리스틱으로 폴백  
- **검색**: 선택된 소스에서만 검색 (단일 소스 라우팅, 불필요한 호출 없음)  
- **생성**: 소스에 맞는 시스템 프롬프트로 답변. 웹검색은 답변에 출처 URL을 함께 제시  

---

## 2. 소스 코드 설명

파일: `app.py`

### 2.1 주요 함수

| 함수 | 역할 |
|------|------|
| `load_retriever()` | 특허법 공용 ChromaDB를 **재임베딩 없이** 로드해 Dense Retriever 반환 (질의 임베딩은 OpenAI 사용) |
| `create_llm()` | Groq LPU `openai/gpt-oss-120b` 채팅 모델 생성 (라우팅·답변 생성 공용) |
| `route_query()` | LLM으로 질문을 `patent`/`web` 분류. 모호 시 `keyword_route()`로 폴백 |
| `keyword_route()` | 특허 키워드 포함 여부로 분류하는 규칙 기반 폴백 분류기 |
| `search_vectordb()` | 특허법 벡터 DB에서 유사 청크 Top 5 검색 |
| `search_web()` | DuckDuckGo로 웹검색, `[{title, snippet, link}]` 반환 |
| `format_patent_docs()` | 벡터 DB 검색 결과를 프롬프트용 컨텍스트 문자열로 변환 |
| `format_web_results()` | 웹검색 결과를 출처 링크 포함 컨텍스트 문자열로 변환 |
| `answer_query()` | 라우팅 → 검색 → 생성 전체 파이프라인 실행 |
| `prompt_user_query()` | 소스별 예시 질문을 보여주고 사용자 질문을 입력받음 (번호 선택/직접 입력) |
| `print_result()` | 질문·선택 소스·답변·출처를 콘솔에 출력 |

### 2.2 처리 흐름

1. **벡터 DB 로드** (`load_retriever`): 영속화된 `patent_law` 컬렉션을 연결. 재인덱싱은 하지 않으나,
   검색을 위한 **질의 임베딩**에는 인덱싱과 동일한 `text-embedding-3-small`을 사용함
2. **LLM 생성** (`create_llm`): 추론 모델이므로 `reasoning_format="hidden"`으로 최종 답변만 받음
3. **라우팅** (`route_query`): 질문을 한 단어로 분류. 예) `특허 출원 절차` → patent, `2025 AI 트렌드` → web
4. **검색 + 생성** (`answer_query`): 선택된 소스에서 검색 후, 소스별 프롬프트로 근거 기반 답변 생성

---

## 3. 웹검색 도구 (DuckDuckGo) 사용법

무료이며 **API 키가 필요 없는** DuckDuckGo 검색을 사용함.  
LangChain의 `DuckDuckGoSearchAPIWrapper` 유틸리티를 활용함.

### 3.1 핵심 코드

```python
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper

wrapper = DuckDuckGoSearchAPIWrapper(
    region="ko-kr",     # 검색 지역 (한국어 우선)
    time="y",           # 시간 필터: "y"=최근 1년 (d=하루, w=주, m=월)
    max_results=5,      # 상위 5건 사용
)

# results(): 제목·요약·링크(URL) 포함 → 답변에 출처 명시 가능
results = wrapper.results("2025 AI 에이전트 트렌드", max_results=5)
for r in results:
    print(r["title"], r["snippet"], r["link"])
```

### 3.2 `run()` vs `results()`

| 메서드 | 반환 | 출처 링크 |
|--------|------|----------|
| `run()` | 요약 텍스트만 | ❌ 없음 |
| `results()` | `[{title, snippet, link}]` 리스트 | ✅ 포함 |

> 출처 URL을 답변에 포함해야 하므로 **`results()`** 를 사용함.

### 3.3 설치 패키지 주의

DuckDuckGo 백엔드는 `duckduckgo-search` 패키지가 `ddgs`로 이름이 바뀌는 과도기임.  
import 충돌을 피하기 위해 **두 패키지를 모두 설치**함 (`requirements.txt`에 포함).

```
duckduckgo-search>=6.0.0
ddgs>=6.0.0
```

> 무료 검색은 일시적 rate limit이 발생할 수 있음. 이 경우 `search_web()`은 빈 결과를 반환하고
> 경고만 출력하며, 잠시 후 재실행하면 정상 동작함 (코드 버그 아님).

---

## 4. 가상환경 설정 및 실행

### 가상환경 설정 (Windows / PowerShell)
```powershell
cd hands-on/12.web-youtube-search/web-rag
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)
```bash
cd hands-on/12.web-youtube-search/web-rag
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)
```bash
cd hands-on/12.web-youtube-search/web-rag
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 환경변수 (`hands-on/.env`)

| 변수 | 용도 | 필요 여부 |
|------|------|----------|
| `OPENAI_API_KEY` | 벡터 DB 질의 임베딩 (`text-embedding-3-small`) | 필수 |
| `GROQ_API_KEY` | LLM 라우팅·답변 생성 (`openai/gpt-oss-120b`) | 필수 |
| (DuckDuckGo) | 웹검색 | 불필요 (무료, 키 없음) |

### 실행

```bash
# 인자 없음 → 대화형 입력 (소스별 예시 질문을 보여주고 질문을 입력받음)
python app.py

# 특허법 질문 → 벡터 DB 검색 (인자로 직접 전달, 비대화형)
python app.py "특허 출원 절차는 어떻게 되나요?"

# 최신 트렌드 질문 → 웹검색 (인자로 직접 전달, 비대화형)
python app.py "2025년 AI 에이전트 최신 트렌드는?"
```

### 대화형 입력 모드

인자 없이 `python app.py`로 실행하면 소스별 예시 질문을 보여주고 질문을 입력받음.  
**번호**를 입력하면 해당 예시 질문을, **문장**을 입력하면 그 문장을 질의로 사용함.  
빈 입력이면 기본 질의(특허법)로 폴백함.

```
======================================================================
질문을 입력하세요. 아래 예시 번호를 고르거나 직접 질문을 입력할 수 있음.
----------------------------------------------------------------------
[특허법 벡터 DB 예시] (특허 요건·출원 절차·침해 구제 등)
  1. 특허를 받기 위한 요건은 무엇인가요?
  2. 특허 출원 절차는 어떻게 되나요?
  3. 특허권 침해에 대한 구제 방법은?
[웹검색 예시] (최신 트렌드·동향·뉴스 등)
  4. 2025년 최신 AI 에이전트 트렌드는?
  5. 요즘 주목받는 RAG 프레임워크는?
  6. 최근 LLM 모델 동향을 알려줘
======================================================================
질문 (번호 또는 직접 입력, 빈 입력 시 기본 질의): 4
```

> 웹검색 예시에는 특허 키워드를 넣지 않아, 키워드 폴백 라우팅이 발생해도 예시 라벨과 소스가 일치함.

### 실행 예시 (출력 형식)

```
[1/3] 특허법 벡터 DB 로드 (재임베딩 없음)
  - 특허법 벡터 DB 로드 완료: 246개 벡터 (컬렉션 'patent_law')
[2/3] LLM 생성 (Groq openai/gpt-oss-120b)
[3/3] 질문 라우팅 + 검색 + 답변 생성

======================================================================
[질문] 2025년 AI 에이전트 최신 트렌드는?
[선택된 소스] 웹검색(DuckDuckGo)
======================================================================
[답변]
... (웹 검색 결과 기반 답변) ...
[출처] 제목 - https://...

----------------------------------------------------------------------
[검색 출처] 5건
  [1] 제목 ...
      https://...
======================================================================
```

---

## 5. 전체 구성

| 항목 | 내용 |
|------|------|
| Embed | OpenAI `text-embedding-3-small` (1536차원, 벡터 DB 질의 임베딩 전용) |
| VectorDB | ChromaDB (`10.rag/vectordb`, 컬렉션 `patent_law`, 재임베딩 없이 로드) |
| WebSearch | DuckDuckGo (`region=ko-kr`, `time=y`, `max_results=5`) |
| LLM | Groq LPU `openai/gpt-oss-120b` (`reasoning_format="hidden"`) |
| 라우팅 | LLM 한 단어 분류 + 특허 키워드 폴백 |
