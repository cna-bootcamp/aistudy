# Agentic RAG — 로컬 LLM 버전 (특허/지식재산권 예제)

**LangGraph StateGraph**로 Self-RAG의 자기 성찰 루프와 **멀티소스 라우팅**을 결합한 Agentic RAG 예제임.  
클라우드 LLM(Groq `gpt-oss-120b`)을 **로컬 LLM `gemma3:12b`(Ollama 런타임)** 로 교체하고,  
YouTube 검색을 **`scrapetube`(API 키 불필요)** 로 대체한 버전임.  
Agent가 스스로 (1) 검색 필요 여부와 (2) 검색 소스(특허법 벡터DB·웹·YouTube)를 선택하고,  
소스별로 질의어를 최적화해 검색한 뒤, 답변 품질을 자체 평가(근거성·유용성)하여 미흡하면 질문을 재작성해 재검색함.

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| 패턴 | Agentic RAG (Self-RAG 자기 성찰 + 멀티소스 Query Routing) |
| 프레임워크 | LangGraph `StateGraph` (노드·엣지로 워크플로우 구성) |
| LLM | **로컬 `gemma3:12b`** (Ollama 런타임, API 키 불필요) |
| 임베딩 모델 | OpenAI `text-embedding-3-small` (1536차원, **질의 벡터화 전용**) |
| 검색 소스 | 특허법 벡터DB(ChromaDB) · 웹(DuckDuckGo) · YouTube(`scrapetube`) |
| 벡터 DB | `../../10.rag/vectordb` 로드 (컬렉션 `patent_law`, 임베딩 없이 검색 전용) |
| 영상 검색 | `scrapetube` 스크래핑 + **유효하지 않은 영상 주소 검증**(oembed) |
| 멀티턴 | 이전 대화 맥락 기억, `clear` 명령으로 초기화 |
| 재시도 | `[IsUse]` 실패 시 Query Rewriting 후 처음부터 재검색 (최대 3회) |

> **로컬화 범위**: 이 예제는 **생성 LLM만 로컬(`gemma3:12b`)** 로 전환함. 질의 임베딩은 기존 공용 벡터DB  
> (10.rag/vectordb, OpenAI 1536차원)와의 호환을 위해 `text-embedding-3-small`을 그대로 사용하므로  
> `OPENAI_API_KEY`가 필요함. 임베딩까지 완전 로컬화하려면 별도 로컬 임베딩 모델로 벡터DB를 재구축해야 함  
> (본 예제 스코프 밖).

> **특허 전문 챗봇 스코프**: 특허 관련 질문에만 검색을 수행하고, 그 외 주제(일반 IT·다른 법률·개발 주제 등)는  
> 검색 없이 LLM 지식으로 직접 답변함.

---

## 2. 원본(12.web-youtube-search/agentic-rag) 대비 핵심 변경 사항

| 구분 | 원본 (클라우드) | 본 예제 (로컬 LLM) |
|------|------------------|----------------------|
| LLM | `ChatGroq(openai/gpt-oss-120b)` (클라우드 API) | **`ChatOllama(gemma3:12b)`** (로컬 추론, 키·비용 없음) |
| YouTube 검색 | YouTube Data API v3 (`YOUTUBE_API_KEY` 필요) | **`scrapetube` 스크래핑** (API 키 불필요) |
| 영상 유효성 | (없음) | **oembed로 유효하지 않은 영상 주소 검증** (비공개·삭제 영상 제거) |
| 질의어 최적화 | `web_query`·`youtube_query` 2종 | **`vectordb_query`·`web_query`·`youtube_query` 3종** (소스별 최적화) |
| 임베딩 | OpenAI `text-embedding-3-small` | 동일 (벡터DB 호환 유지) |

> **YouTube 날짜 필터 차이**: 원본은 Data API v3의 `publishedAfter`로 '최근 1년'만 검색했으나, `scrapetube`는  
> 날짜 필터를 지원하지 않음. 따라서 `sort_by="relevance"`(관련도 순)로 수집하고, 게시 시점은 상대 표기  
> (`publishedTimeText`, 예: `1 year ago`)만 보존함. 즉 영상은 최근 1년 보장이 아님(의도된 차이, 날짜 위조 금지).

---

## 3. LLM 모델 — `gemma3:12b`

| 항목 | 내용 |
|------|------|
| 개발사 | Google DeepMind |
| 모델군 | Gemma 3 (오픈 가중치 경량 LLM 계열) |
| 파라미터 | 약 12B (120억) |
| 컨텍스트 | 최대 128K 토큰 (긴 검색 컨텍스트 처리에 유리) |
| 멀티모달 | 텍스트 + 이미지 입력 지원 (본 예제는 텍스트만 사용) |
| 다국어 | 140여 개 언어 지원 (한국어 포함) |
| 로컬 용량 | Ollama 기준 약 8.1GB (Q4 양자화) |
| 구조화 출력 | Ollama `format`(JSON 스키마) 기반 구조화 출력 지원 |

- **Ollama 런타임**: 로컬에서 LLM을 받아 실행하는 경량 서버임. `ollama pull`로 모델을 내려받고, OpenAI 호환  
  엔드포인트(`http://localhost:11434`)로 추론을 제공함. 클라우드 API와 달리 **키·비용·네트워크 호출 없이** 추론함.
- **gemma3 + 구조화 출력**: gemma3는 function-calling(도구 호출)을 지원하지 않으므로, 라우팅·평가 토큰은  
  도구 이름이 없는 `with_structured_output(method="json_schema")` 방식으로 강제 파싱함(Ollama의 문법 제약 기반  
  구조화 출력 활용). 중첩 스키마(`BatchRelevanceGrade`)도 안정적으로 파싱됨을 실측으로 확인함.
- **클라우드 대비 트레이드오프**: 비용·키가 없고 오프라인 추론이 가능한 대신, 120B급 클라우드 모델보다 추론  
  속도가 느리고, 질의당 LLM 호출이 여러 번(라우팅·관련성·생성·근거성·유용성, 재시도 시 ×3)이라 응답에  
  수십 초~수 분이 걸릴 수 있음.

---

## 4. 처리 흐름 (Reflection / 라우팅 신호)

| 신호 | 의미 | 동작 |
|------|------|------|
| **Route** | 검색 필요 여부 + 소스 선택 + **소스별 쿼리 최적화** | 특허 질문 → 소스 선택 + 쿼리 3종 생성 / 비특허 → 직접 답변 |
| **`[IsRel]`** | Is Relevant (관련성) | 벡터DB 검색 문서를 **1회 LLM 호출로 일괄 평가**하여 관련 문서만 선별 |
| **`[IsSup]`** | Is Supported (근거성) | 답변이 검색 컨텍스트에 근거하는지 검증 → 미흡 시 **엄격 근거 기반 재생성** |
| **`[IsUse]`** | Is Useful (유용성) | 최종 답변이 유용한지 평가 → 미흡 시 **Query Rewriting 후 재검색** |

```
질문 (+ 이전 대화 맥락)
 │
 ▼
[Route] 검색 필요? + 어떤 소스? + 소스별 쿼리(vectordb·web·youtube) 최적화
 │
 ├─ 불필요(비특허·인사) ───────────────► [Direct] LLM 지식으로 직접 답변 ─► END
 │
 └─ 필요(특허) ─► [Retrieve] 선택 소스 검색 (벡터DB / 웹 / YouTube+유효성검증)
                    │
                    ▼
              [IsRel] 벡터DB 문서 관련성 일괄 평가 (관련 문서 선별)
                    │
                    ▼
              [Generate] 컨텍스트 기반 답변 생성
                    │
              [IsSup] 근거성 검증 ─ 근거 부족 ─► 엄격 근거 기반 재생성
                    │
                    ▼  (+ 출처 섹션 부착)
              [IsUse] 유용성 평가
                    │
          유용함 ─► END
                    │
       유용하지 않음 ─► [Rewrite] Query Rewriting ─► (Route로 복귀, 최대 3회 재검색)
```

---

## 5. 주요 함수 / 클래스

| 구성 요소 | 역할 |
|-----------|------|
| `check_ollama()` | Ollama 서버 실행 + `gemma3:12b` 다운로드 여부를 `/api/tags`로 사전 점검 (미준비 시 명확한 안내) |
| `build_llm()` | `ChatOllama(gemma3:12b)` LLM 생성 (temperature=0, 로컬 추론, 키 불필요) |
| `load_vectorstore()` | 특허법 벡터 DB를 컬렉션명·임베딩 모델 지정하여 검색 전용으로 로드 |
| `search_web()` | DuckDuckGo `.results()`로 최근 1년(`time="y"`) 웹 검색 (제목·스니펫·링크 반환) |
| `search_youtube()` | `scrapetube`로 영상 검색 후 **유효하지 않은 주소를 걸러** 제목·채널·URL 반환 |
| `is_valid_video()` | YouTube **oembed**로 영상 주소 유효성(공개·재생 가능) 확인 (200=유효, 그 외=무효) |
| `_extract_runs_text()` | scrapetube의 `{'runs':[{'text':...}]}`·`{'simpleText':...}` 구조에서 텍스트 추출 |
| `format_history()` | 직전 대화 메시지를 프롬프트용 텍스트로 변환 (멀티턴 맥락) |
| `build_context()` | 벡터DB·웹·YouTube 결과를 답변 생성용 단일 컨텍스트로 합침 |
| `build_sources_section()` | 수집한 메타데이터로 '출처' 섹션을 **코드에서 직접 구성**(URL 누락 방지) |
| `AgenticRAG` | LangGraph 노드·엣지 보유 + 그래프 컴파일/실행 본체 |

### 5.1 LangGraph 노드

| 노드 | 역할 |
|------|------|
| `route` | 검색 필요 여부 + 소스 + **소스별 쿼리 3종**(`vectordb_query`·`web_query`·`youtube_query`) 결정 |
| `retrieve` | 선택 소스에서 **각 소스 전용 쿼리**로 검색 (외부 API는 try/except로 부분 실패 시에도 진행) |
| `grade_documents` | `[IsRel]` — 벡터DB 문서 관련성 1회 호출 일괄 평가 후 선별 |
| `generate` | 컨텍스트 기반 답변 생성 + `[IsSup]` 근거성 검증·재생성 + 출처 섹션 부착 |
| `grade_generation` | `[IsUse]` — 답변 유용성 평가 (재검색 루프의 분기 기준) |
| `rewrite` | 유용성 미달 시 질문 재작성 (Query Rewriting), 재시도 횟수 증가 |
| `direct_answer` | 특허 외 질문·인사는 검색 없이 LLM 지식 + 대화 맥락으로 답변 |

### 5.2 엣지

```python
START → route
route ─(검색 필요)→ retrieve
route ─(검색 불필요)→ direct_answer        # 조건부 엣지: decide_search_path
retrieve → grade_documents → generate → grade_generation
grade_generation ─(유용 or 재시도 소진)→ END
grade_generation ─(유용 미달)→ rewrite      # 조건부 엣지: decide_after_generation
rewrite → route                            # 재검색 루프
direct_answer → END
```

> **무한 루프 방지**: 재시도 횟수 가드를 조건부 엣지(`decide_after_generation`)에서 직접 검사함.  
> `retry_count >= MAX_RETRIES`이면 `END`로 보내며, 그래프 기본 단계 한계(25)를 넘지 않도록 `recursion_limit=50`을 적용함.

---

## 6. 검색 방식별 질의어 최적화 (반드시 수행)

라우터(`route`)가 한 번의 LLM 호출로 소스별 특성에 맞춘 **3종 쿼리**를 생성하고, `retrieve`가 각 소스에  
해당 쿼리를 적용함. 소스마다 검색 엔진 특성이 다르므로 질의어를 따로 다듬음.

| 쿼리 | 대상 소스 | 최적화 방향 |
|------|-----------|-------------|
| `vectordb_query` | 특허법 벡터DB | 구어체를 **정확한 법률 용어**로 변환 (예: `특허 등록 요건 및 출원 절차`) |
| `web_query` | DuckDuckGo | 비용·통계·실무 키워드, **연도/시간 표현 제외** (예: `앱 아이디어 특허 출원 비용`) |
| `youtube_query` | scrapetube | **쉼표 없는 짧은 키워드** (예: `앱 특허 출원 방법`) |

> `특허 요건`처럼 이미 짧은 법률 키워드인 질문은 세 쿼리가 비슷해질 수 있으며, 이는 억지 차별화를  
> 피한 정상 동작임. 질문이 복합적일수록(예: "방법 + 비용 + 영상") 세 쿼리가 뚜렷이 분화됨.

---

## 7. 유효하지 않은 영상 주소 체크

`scrapetube` 검색 결과에는 비공개·삭제·존재하지 않는 영상이 섞일 수 있음. `is_valid_video()`가 각 영상을  
**YouTube oembed 엔드포인트**(`https://www.youtube.com/oembed?url=...&format=json`)로 조회하여,

- **HTTP 200** → 공개·재생 가능 영상 → **유지**
- **그 외(400/401/404·네트워크 오류·타임아웃)** → 유효하지 않음 → **제외**

API 키 없이 동작하며, 유효성을 통과한 영상만 최대 `YOUTUBE_MAX_RESULTS`(5)개를 출처에 표기함  
(탈락분을 감안해 `YOUTUBE_SCRAPE_LIMIT`(12)개를 후보로 수집).

---

## 8. 멀티턴 대화 / 출처 표기

- **멀티턴**: `route`·`generate`·`direct_answer` 노드가 최근 `HISTORY_TURNS`(6) 메시지를 프롬프트에 포함해  
  후속 질문의 의도를 파악함. `clear`(또는 `초기화`) 입력 시 대화 맥락을 비움.
- **출처**: 답변 마지막에 '출처' 섹션을 **코드에서 직접** 부착함(LLM 출력에 의존하지 않아 URL 누락 방지).
  - **법률**: 법령명 + 본문에서 추출한 조항(예: `특허법 제42조`)
  - **웹**: `[제목](URL)` 마크다운 링크
  - **YouTube**: `[제목](URL)` 마크다운 링크 (유효성 검증 통과 영상만)

---

## 9. 가상환경 설정 및 실행

### 9.1 사전 요구사항 — Ollama

```bash
# 1) Ollama 설치 (https://ollama.com/download) 후 서버 실행
ollama serve

# 2) gemma3:12b 모델 다운로드 (약 8GB, 최초 1회)
ollama pull gemma3:12b
```

### 9.2 특허법 벡터 DB (최초 1회)

본 예제는 `10.rag/vectordb`의 공용 벡터 DB(컬렉션 `patent_law`)를 사용함. 없으면 먼저 구축함.
```bash
cd hands-on/10.rag/indexing
python indexing.py
```

### 9.3 가상환경 설정 (Windows / PowerShell)
```powershell
cd hands-on/13.local-llm/agentic-rag
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)
```bash
cd hands-on/13.local-llm/agentic-rag
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)
```bash
cd hands-on/13.local-llm/agentic-rag
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 9.4 환경변수

`hands-on/.env` 파일에 아래 키가 필요함.
```
OPENAI_API_KEY=sk-...     # 질의 임베딩(text-embedding-3-small) 전용
# (선택) OLLAMA_BASE_URL=http://localhost:11434   # Ollama 서버 주소 (기본값과 다를 때만 지정)
```
> LLM(`gemma3:12b`)은 로컬 Ollama라 키가 필요 없음. 웹(DuckDuckGo)·YouTube(`scrapetube`)도 키가 필요 없음.  
> 즉 클라우드 키는 **임베딩용 `OPENAI_API_KEY` 하나만** 필요함.

### 9.5 실행
```bash
python app.py            # 대화형 챗봇 (멀티턴, 'clear' 초기화, 'quit'/'q' 종료)
python app.py --demo     # 교재 검증 질의를 비대화형으로 순차 실행
```

---

## 10. 테스트 질의어

| 구분 | 질의 | 기대 동작 |
|------|------|-----------|
| 통합 검색 | `특허 요건에 대해 법률과 영상을 검색해서 알려줘` | `vectordb`+`web`+`youtube` 검색 |
| 멀티인텐트 | `내가 만든 앱 아이디어를 특허로 보호받는 방법이랑 출원 비용, 관련 영상도 보여줘` | 소스별 쿼리 분화 |
| 소스 라우팅 | `특허 출원 비용은 ?` | `web`(+`vectordb`) 중심 검색 |
| 멀티턴 | (위 대화 후) `그럼 출원 비용은?` | 맥락으로 `특허 출원 비용` 검색 |
| 검색 불필요 | `Claude Code란?` | 비특허 주제 → **직접 답변** |

> `[IsRel]` 관련 문서 수, `[IsSup]` 근거성, 라우팅 결과는 LLM 비결정성에 따라 실행마다 달라질 수 있음.

---

## 11. 디렉터리 구조

```
hands-on/13.local-llm/agentic-rag/
├── app.py             # Agentic RAG 본체 (LangGraph StateGraph + 로컬 LLM)
├── requirements.txt   # 의존성 정의 (주석 영문)
├── README.md          # 본 문서
└── venv/              # 가상환경 (직접 생성)
```
