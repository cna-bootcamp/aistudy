# 멀티소스 RAG 예제 (벡터DB + 웹검색 + YouTube검색)

LLM이 질문을 분석하여 적합한 소스를 스스로 선택(**Query Router**)하고, 각 소스에 맞게 검색어를 다시 쓴 뒤  
(**Query Rewriting**) 선택된 소스를 순차 검색하여 결과를 종합(**Synthesis**)하는 멀티소스 RAG 예제임.  
`10.rag/naive`의 단일 소스(특허법 벡터DB) RAG를 3개 소스 통합 구조로 확장함.

## 개요

| 항목 | 내용 |
|------|------|
| 패턴 | Multi-Source RAG (Query Router → Query Rewriting → 멀티소스 검색 → Synthesis) |
| 라우팅 | LLM 구조화 출력(Pydantic)으로 소스 선택 + 소스별 검색어 동시 생성 (복수 선택 가능) |
| 소스 1 | **특허법 벡터DB** — ChromaDB(`10.rag/vectordb`, 컬렉션 `patent_law`), 재임베딩 없이 로드 |
| 소스 2 | **웹검색** — DuckDuckGo(최근 1년 필터, 최신 5건, 소스 링크 포함) |
| 소스 3 | **YouTube** — YouTube Data API v3(최근 1년 필터, 5건, 한국어 우선) |
| 질의 임베딩 | OpenAI `text-embedding-3-small` (벡터DB 검색 전용, 1536차원) |
| LLM | Groq LPU `openai/gpt-oss-120b` (라우팅 + 종합) |

> **`10.rag/naive` 대비 변경점**  
> Before: 항상 특허법 벡터DB만 검색 (검색 → 생성)  
> After: 질문 분석 → 소스 선택(복수 가능) → 소스별 검색어 재작성 → 멀티소스 검색 → 종합

## 처리 흐름

```
질의어 입력
   │
   ▼
[1/3] Query Router          route_query()        : LLM 구조화 출력 → 소스 선택 + 소스별 검색어 생성
   │                                                (라우팅 + Query Rewriting을 한 번의 호출로 처리)
   ▼
[2/3] 멀티소스 검색          dispatch_searches()  : 선택된 소스만 각자의 재작성 검색어로 검색
   │     ├─ vectorstore : search_vectorstore()   → 특허법 벡터DB 유사도 검색 (재임베딩 X)
   │     ├─ web         : search_web()           → DuckDuckGo 최근 1년, 링크 포함(results())
   │     └─ youtube     : search_youtube()       → YouTube Data API v3 최근 1년
   ▼
[3/3] Synthesis             synthesize_answer()  : 수집 결과를 컨텍스트로 LLM이 종합 답변 생성
   │                                                (조문/URL 출처 인용, 검색 결과만 근거)
   ▼
결과 출력                   print_result()       : 라우팅 결정 + 종합 답변 + 소스별 출처 표시
```

## Query Router 스키마 및 동작 원리

### 스키마 (Pydantic `RouteDecision`)

LLM이 자유 텍스트가 아니라 아래 스키마 형태로 응답하도록 강제함(structured output). 자연어 파싱 없이  
라우팅 결정과 소스별 검색어를 안정적으로 동시에 얻음.

```python
class RouteDecision(BaseModel):
    sources: list[Literal["vectorstore", "web", "youtube"]]  # 검색할 소스 목록 (복수 선택 가능)
    vectorstore_query: str = ""   # 특허법 벡터DB 검색어 (미선택 시 빈 문자열)
    web_query: str = ""           # 웹 검색어 (미선택 시 빈 문자열)
    youtube_query: str = ""       # YouTube 검색어 (미선택 시 빈 문자열)
    reasoning: str                # 소스 선택 이유
```

| 필드 | 역할 |
|------|------|
| `sources` | `Literal`로 허용 소스명만 받아 오타·잘못된 소스를 차단함. 질문 의도에 따라 복수 선택 |
| `vectorstore_query` | 특허법 조문 검색에 맞게 재작성된 검색어 |
| `web_query` | 웹 검색에 맞게 재작성된 검색어 (연도/시간 표현 제외) |
| `youtube_query` | YouTube 검색에 맞게 재작성된 검색어 (쉼표 없는 짧은 키워드) |
| `reasoning` | 라우팅 근거 (디버깅·설명 가능성 확보) |

### 동작 원리

`route_query()`는 `router_llm.with_structured_output(RouteDecision)`로 LLM 응답을 스키마에 맞춘 JSON으로  
강제함. 시스템 프롬프트에 소스별 특징·선택 기준·예시를 제공하면 LLM이 질문을 분석해 다음을 결정함.

- **법률/제도 질문** ("특허 요건은?") → `vectorstore`
- **최신 정보 질문** ("AI 반도체 특허 동향") → `web`
- **강의/튜토리얼 질문** ("특허 출원 절차 강의") → `youtube`
- **복합 질문** ("출원 절차 + 최신 통계 + 강의") → `["vectorstore", "web", "youtube"]` (복수 선택)

> **라우터 LLM 설정 주의**  
> 라우터는 `reasoning_format`을 지정하지 않은 기본 `ChatGroq`를 사용함. `gpt-oss-120b`는 추론 모델이라  
> `reasoning_format="hidden"`과 structured output(도구 호출 기반)이 충돌할 수 있어, 라우터는 기본값으로  
> 두고 종합 단계에서만 `reasoning_format="hidden"`을 사용함.

## Query Rewriting 동작 원리

같은 질문이라도 소스마다 최적의 검색어가 다름. 라우터는 소스를 선택하는 동시에 **각 소스에 최적화된**  
**검색어를 별도로 생성**함. 시스템 프롬프트에 소스별 재작성 규칙을 명시하여 제약을 지키게 함.

| 소스 | 재작성 규칙 | 이유 |
|------|------------|------|
| `vectorstore_query` | 핵심 법률 용어 중심 | 특허법 조문 임베딩과 의미적으로 가깝게 매칭하기 위함 |
| `web_query` | **연도/시간 표현 제외**(예: '2024', '최신', '올해') | DuckDuckGo `time="y"`로 최근 1년이 **자동 적용**되므로 시간 표현이 불필요·중복 |
| `youtube_query` | **쉼표 없이 짧은 키워드** | YouTube 검색은 짧은 키워드가 효과적이며, 쉼표는 검색 품질을 저해 |

**예시** ("특허 출원 절차와 최신 통계, 관련 강의 영상도 알려줘")

```
sources        : ['vectorstore', 'web', 'youtube']
vectorstore_q  : '특허 출원 절차'      ← 법률 용어 중심
web_q          : '특허 출원 통계'      ← 연도/시간 표현 없음
youtube_q      : '특허 출원 강의'      ← 쉼표 없는 짧은 키워드
```

## 소스 코드 설명

전체 코드는 [app.py](app.py)에 있음. 주요 함수는 다음과 같음.

### `route_query(query, router_llm)`

질문을 분석하여 소스 선택 + 소스별 검색어를 담은 `RouteDecision`을 반환함.

- `with_structured_output(RouteDecision)`로 LLM 응답을 스키마(JSON)로 강제하여 파싱 오류를 없앰
- 라우팅과 Query Rewriting을 **한 번의 LLM 호출**로 동시에 수행함

### `search_vectorstore(query)`

특허법 벡터DB를 **재임베딩 없이** 로드하여 유사 청크 Top 5를 검색함.

- `Chroma(...)` 생성자(`from_documents` 아님)로 영속화된 컬렉션을 그대로 연결함
- 인덱싱과 동일한 `text-embedding-3-small`로 질의를 임베딩해야 의미 공간이 일치함
- 결과를 소스 공통 형식(`title`/`snippet`/`link`)으로 정규화하여 종합 단계에서 일관되게 다룸

### `search_web(query)`

DuckDuckGo로 최근 1년 웹 문서를 검색하여 **소스 링크를 포함한** 결과를 반환함.

- `DuckDuckGoSearchAPIWrapper(region="ko-kr", time="y", max_results=5)`로 한국 지역·최근 1년·5건 설정
- `wrapper.results(query, max_results=5)`: `run()`과 달리 `title`·`snippet`·**`link`**를 모두 반환함
- DuckDuckGo는 `RatelimitException`이 잦으므로 실패 시 빈 리스트로 **graceful 처리**(코드 오류와 구분)

### `search_youtube(query)`

YouTube Data API v3로 최근 1년 영상을 검색하여 메타데이터를 반환함.

- `publishedAfter`에 (현재 − 365일) 시각을 ISO 8601로 지정해 최근 1년 영상만 검색함
- `order="relevance"`, `relevanceLanguage="ko"`로 한국어 관련 영상을 우선 정렬함
- `html.unescape()`로 제목·설명의 HTML 엔티티(`&#39;` 등)를 일반 문자로 복원함
- API 키 미설정·할당량 초과·네트워크 오류 시 빈 리스트로 graceful 처리함

### `dispatch_searches(decision)`

`RouteDecision`에 따라 **선택된 소스만** 각자의 재작성 검색어로 검색하여 `{소스명: [결과...]}`로 모음.

- `SOURCE_REGISTRY`(소스명 → 검색 함수·검색어 속성·라벨 매핑)로 분기를 간결하게 처리함
- 검색어가 비어 있으면 해당 소스를 건너뜀

### `synthesize_answer(query, collected, llm)`

수집된 멀티소스 검색 결과를 근거로 종합 답변을 생성함.

- `format_context()`로 소스별 결과를 헤더 구분된 단일 컨텍스트 문자열로 합침
- `(prompt | llm | StrOutputParser)` LCEL 체인에 컨텍스트·질문을 주입함
- 시스템 프롬프트로 "검색 결과만 근거로, 특허법은 조문·웹/YouTube는 URL을 함께 제시"하도록 제약함
- 모든 소스가 빈 결과면 LLM을 호출하지 않고 안내 메시지를 반환함

## 가상환경 설정 및 실행 방법

> **선행 조건**: 특허법 벡터DB(`hands-on/10.rag/vectordb`)가 구축되어 있어야 함  
> (`10.rag/indexing/indexing.py`로 인덱싱). `naive_rag.py`와 동일한 공용 DB를 사용함.

> **API 키** (`hands-on/.env`에 설정):  
> `OPENAI_API_KEY`(벡터DB 질의 임베딩), `GROQ_API_KEY`(라우팅·종합), `YOUTUBE_API_KEY`(YouTube 검색).  
> DuckDuckGo 웹검색은 API 키가 불필요함.

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\12.web-youtube-search\multi-source
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/12.web-youtube-search/multi-source
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/12.web-youtube-search/multi-source
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 실행

```bash
# 기본 질의어로 실행 (복합 질문: 출원 절차 + 최신 동향 + 강의 영상)
python app.py

# 임의 질의어로 실행
python app.py "특허권의 존속기간은 몇 년이야?"        # → 벡터DB 단독 라우팅
python app.py "AI 반도체 특허 최신 동향 알려줘"        # → 웹검색 단독 라우팅
python app.py "특허 출원 절차 강의 영상 찾아줘"        # → YouTube 단독 라우팅
```

### 실행 결과 예시 (실제 실행 출력 발췌)

```
[1/3] Query Router: 질문 분석 → 소스 선택 + 소스별 검색어 생성
  - 선택 소스: ['vectorstore', 'web', 'youtube']
[2/3] 멀티소스 검색 (선택된 소스만)
  - [특허법 벡터DB] 검색어: '특허 출원 절차'      → 5건
  - [웹검색(DuckDuckGo)] 검색어: '특허 동향'      → 5건
  - [YouTube] 검색어: '특허 출원 강의'            → 5건
[3/3] Synthesis: 검색 결과 종합 답변 생성

======================================================================
[질문] 특허 출원 절차를 알려주고, 최신 특허 동향과 관련 강의 영상도 찾아줘
======================================================================
[라우팅] 선택 소스: ['vectorstore', 'web', 'youtube']
[답변]
1. 특허 출원 절차 (특허법 근거) ... (제55조·제52조·제62조·제82조 등)
2. 최신 특허 동향 (웹) ... (KIPO·KISTA·KIIP 등 URL)
3. 특허 관련 강의 영상 (YouTube) ... (영상 제목 + URL)
----------------------------------------------------------------------
[검색 출처]
  · 특허법 벡터DB: 5건
  · 웹검색(DuckDuckGo): 5건
  · YouTube: 5건
======================================================================
```

## 소스별 검색 도구 비교

| 소스 | 도구 | API 키 | 최신 필터 | 출처 링크 |
|------|------|--------|----------|----------|
| 특허법 | ChromaDB + OpenAI Embeddings | `OPENAI_API_KEY` | — (정적 문서) | 조문(파일·청크) |
| 웹 | `DuckDuckGoSearchAPIWrapper.results()` | 불필요 | `time="y"` (최근 1년) | ✅ URL |
| YouTube | YouTube Data API v3 | `YOUTUBE_API_KEY` | `publishedAfter` (최근 1년) | ✅ URL |
