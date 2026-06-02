# Agentic RAG (특허/지식재산권 예제)

**LangGraph StateGraph**로 Self-RAG의 자기 성찰 루프와 **멀티소스 라우팅**을 결합한 Agentic RAG 예제임.  
Agent가 스스로 (1) 검색 필요 여부와 (2) 검색 소스(특허법 벡터DB·웹·YouTube)를 선택하고,  
답변 품질을 자체 평가(근거성·유용성)하여 미흡하면 질문을 재작성해 재검색함. 멀티턴 대화 맥락도 기억함.

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| 패턴 | Agentic RAG (Self-RAG 자기 성찰 + 멀티소스 Query Routing) |
| 프레임워크 | LangGraph `StateGraph` (노드·엣지로 워크플로우 구성) |
| LLM | Groq LPU `openai/gpt-oss-120b` |
| 임베딩 모델 | OpenAI `text-embedding-3-small` (1536차원, 질의 벡터화 전용) |
| 검색 소스 | 특허법 벡터DB(ChromaDB) · 웹(DuckDuckGo) · YouTube(Data API v3) |
| 벡터 DB | `../../10.rag/vectordb` 로드 (컬렉션 `patent_law`, 임베딩 없이 검색 전용) |
| 멀티턴 | 이전 대화 맥락 기억, `clear` 명령으로 초기화 |
| 재시도 | `[IsUse]` 실패 시 Query Rewriting 후 처음부터 재검색 (최대 3회) |

> **특허 전문 챗봇 스코프**: 이 예제는 특허/지식재산권 전문 챗봇임. 특허 관련 질문에만 검색을 수행하고,  
> 그 외 주제(일반 IT·다른 법률·개발 주제 등)는 검색 없이 LLM 지식으로 직접 답변함.  
> 교재 8.4의 테스트 질의 중 `RAG 구현 튜토리얼 영상 추천`은 특허와 무관하므로, 본 스코프 규칙에 따라  
> **검색 없이 직접 답변**으로 처리됨(의도된 동작).

---

## 2. Self-RAG 대비 핵심 변경 사항

| 구분 | Self-RAG (`10.rag/self-rag`) | Agentic RAG (본 예제) |
|------|------------------------------|------------------------|
| 흐름 제어 | 단일 클래스의 재귀 함수(`_invoke_with_retry`) | LangGraph `StateGraph`의 노드·엣지(그래프) |
| 검색 소스 | 특허법 벡터DB 1개 | 벡터DB + 웹(DuckDuckGo) + YouTube(API v3) |
| 검색 판단 | `[Retrieve]` 필요 여부만 | 필요 여부 **+ 소스 선택 + 소스별 쿼리 생성** |
| 대화 | 단일 질의 | **멀티턴 대화 맥락 기억** (`clear` 초기화) |
| 출처 | 별도 미표기 | 답변 끝에 **법률·웹·YouTube 출처 섹션**(URL 링크 포함) |

---

## 3. 처리 흐름 (Reflection / 라우팅 신호)

| 신호 | 의미 | 동작 |
|------|------|------|
| **Route** | 검색 필요 여부 + 소스 선택 | 특허 질문 → 소스(`vectordb`/`web`/`youtube`) 선택 / 비특허 → 직접 답변 |
| **`[IsRel]`** | Is Relevant (관련성) | 벡터DB 검색 문서를 **1회 LLM 호출로 일괄 평가**하여 관련 문서만 선별 |
| **`[IsSup]`** | Is Supported (근거성) | 답변이 검색 컨텍스트에 근거하는지 검증 → 미흡 시 **엄격 근거 기반 재생성** |
| **`[IsUse]`** | Is Useful (유용성) | 최종 답변이 유용한지 평가 → 미흡 시 **Query Rewriting 후 재검색** |

```
질문 (+ 이전 대화 맥락)
 │
 ▼
[Route] 검색 필요? + 어떤 소스?
 │
 ├─ 불필요(비특허·인사) ───────────────► [Direct] LLM 지식으로 직접 답변 ─► END
 │
 └─ 필요(특허) ─► [Retrieve] 선택 소스 검색 (벡터DB / 웹 / YouTube)
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

## 4. LangGraph 노드 / 엣지 구성

### 4.1 상태 (State)

`AgentState`(TypedDict)가 그래프 전체에서 노드 사이로 공유·갱신되는 데이터임. 각 노드는 일부 키만  
갱신해 반환하면 LangGraph가 기존 상태에 병합함. 주요 키: `question`(재작성 시 갱신), `original_question`,  
`history`(멀티턴), `sources`, `web_query`/`youtube_query`, `vector_docs`, `web_results`, `youtube_results`,  
`answer`, `is_supported`, `is_useful`, `retry_count`, `rewrites`.

### 4.2 노드 (Node)

| 노드 | 역할 |
|------|------|
| `route` | 검색 필요 여부 + 검색 소스 + 소스별 쿼리(연도 제외 `web_query`, 짧은 `youtube_query`) 결정 |
| `retrieve` | 선택된 소스에서만 검색 (외부 API는 각각 try/except로 감싸 부분 실패 시에도 진행) |
| `grade_documents` | `[IsRel]` — 벡터DB 문서 관련성 1회 호출 일괄 평가 후 선별 |
| `generate` | 컨텍스트 기반 답변 생성 + `[IsSup]` 근거성 검증·재생성 + 출처 섹션 부착 |
| `grade_generation` | `[IsUse]` — 답변 유용성 평가 (재검색 루프의 분기 기준) |
| `rewrite` | 유용성 미달 시 질문 재작성 (Query Rewriting), 재시도 횟수 증가 |
| `direct_answer` | 특허 외 질문·인사는 검색 없이 LLM 지식 + 대화 맥락으로 답변 |

### 4.3 엣지 (Edge)

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

> **무한 루프 방지**: 재시도 횟수 가드를 `rewrite` 노드가 아닌 **조건부 엣지(`decide_after_generation`)에서  
> 직접 검사**함. `retry_count >= MAX_RETRIES`이면 `END`로 보내며, 그래프 기본 단계 한계(25)를 넘지 않도록  
> `recursion_limit=50`을 적용함.

---

## 5. 주요 함수 / 클래스

| 구성 요소 | 역할 |
|-----------|------|
| `build_llm()` | Groq `gpt-oss-120b` LLM 생성 (temperature=0, `GROQ_API_KEY` 검증) |
| `load_vectorstore()` | 특허법 벡터 DB를 컬렉션명·임베딩 모델 지정하여 검색 전용으로 로드 |
| `search_web()` | DuckDuckGo `.results()`로 최근 1년(`time="y"`) 웹 검색 (제목·스니펫·링크 반환) |
| `search_youtube()` | YouTube Data API v3로 최근 1년(`publishedAfter`) 영상 검색 (제목·채널·URL 반환) |
| `format_history()` | 직전 대화 메시지를 프롬프트용 텍스트로 변환 (멀티턴 맥락) |
| `build_context()` | 벡터DB·웹·YouTube 결과를 답변 생성용 단일 컨텍스트로 합침 |
| `build_sources_section()` | 수집한 메타데이터로 '출처' 섹션을 **코드에서 직접 구성**(URL 누락 방지) |
| `AgenticRAG` | LangGraph 노드·엣지 보유 + 그래프 컴파일/실행 본체 |

### 구조화 출력 (라우팅·Reflection 파싱)

라우팅·평가 판단은 Pydantic 스키마(`RouteDecision`, `BatchRelevanceGrade`, `SupportGrade`,  
`UsefulnessGrade`, `RewrittenQuery`)로 정의하고 `llm.with_structured_output(..., method="json_schema")`로  
강제 파싱함.

> **`method="json_schema"`를 쓰는 이유**: `gpt-oss-120b`는 기본 `function_calling` 모드에서 도구 이름을  
> 잘못 생성하여 호출이 실패할 수 있음. 도구 이름이 없는 Groq 구조화 출력(`response_format` 기반)을 사용해  
> 이 문제를 회피함(Self-RAG 예제에서 검증된 설정).

---

## 6. 멀티턴 대화 기능

- 대화형 모드는 `history` 리스트에 사용자·어시스턴트 메시지를 누적함.
- `route`·`generate`·`direct_answer` 노드가 최근 `HISTORY_TURNS`(기본 6개) 메시지를 프롬프트에 포함해  
  **후속 질문의 의도를 정확히 파악**함.
  - 예: `특허 요건이 뭐야?` → (이어서) `그럼 출원 비용은?` → 라우터가 맥락을 보고 `특허 출원 비용`으로 검색.
- `clear`(또는 `초기화`) 입력 시 `history`를 비워 새 주제로 시작함.

---

## 7. 출처 표기 규칙

답변 마지막에 '출처' 섹션을 **코드에서 직접** 부착함(LLM 출력에 의존하지 않아 URL 누락을 방지).

- **법률**: 법령명(벡터DB 메타데이터 `source`) + 본문에서 추출한 조항(예: `특허법 제42조`)
- **웹**: `[제목](URL)` 마크다운 링크 (DuckDuckGo `.results()`의 `link`)
- **YouTube**: `[제목](URL)` 마크다운 링크 (Data API v3의 `videoId` → watch URL)

### 검색 MUST 규칙 반영

- DuckDuckGo: 최근 1년(`time="y"`) 필터 + 최신 5개(`max_results=5`) + `.results()`로 링크 포함
- `web_query`: 연도/시간 표현 제외 (DuckDuckGo `time` 필터가 자동 적용되므로)
- YouTube: Data API v3 + 최근 1년(`publishedAfter`) 필터
- `youtube_query`: 쉼표 없이 짧은 키워드

---

## 8. 가상환경 설정 및 실행

### 가상환경 설정 (Windows / PowerShell)
```powershell
cd hands-on/12.web-youtube-search/agentic-rag
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)
```bash
cd hands-on/12.web-youtube-search/agentic-rag
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)
```bash
cd hands-on/12.web-youtube-search/agentic-rag
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 환경변수

`hands-on/.env` 파일에 아래 키가 필요함.
```
GROQ_API_KEY=gsk_...      # LLM (gpt-oss-120b) 호출용
OPENAI_API_KEY=sk-...     # 질의 임베딩 (text-embedding-3-small) 호출용
YOUTUBE_API_KEY=AI...     # YouTube Data API v3 영상 검색용
```
> 웹 검색(DuckDuckGo)은 API 키가 필요 없음.

### 실행
```bash
python app.py            # 대화형 챗봇 (멀티턴, 'clear' 초기화, 'quit'/'q' 종료)
python app.py --demo     # 교재 검증 질의를 비대화형으로 순차 실행
```

---

## 9. 테스트 질의어

| 구분 | 질의 | 기대 동작 |
|------|------|-----------|
| 통합 검색 | `특허 요건에 대해 법률, 웹, 영상을 검색해서 알려줘` | `vectordb`+`web`+`youtube` 모두 검색 |
| 소스 라우팅 | `특허 출원 비용은 ?` | `web`(+`vectordb`) 중심 검색 |
| 소스 라우팅 | `사례 중심의 특허 정보를 받고 싶어요.` | `web` 중심 검색 |
| 멀티턴 | (위 대화 후) `그럼 출원 비용은?` | 맥락으로 `특허 출원 비용` 검색 |
| 검색 불필요 | `RAG 구현 튜토리얼 영상 추천해줘` | 비특허 주제 → **직접 답변**(스코프 규칙) |
| 검색 불필요 | `Claude Code란?` | 비특허 주제 → **직접 답변** |

> `[IsRel]` 관련 문서 수, `[IsSup]` 근거성 등 판단 결과는 LLM 비결정성에 따라 실행마다 달라질 수 있음.

---

## 10. 디렉터리 구조

```
hands-on/12.web-youtube-search/agentic-rag/
├── app.py             # Agentic RAG 본체 (LangGraph StateGraph)
├── requirements.txt   # 의존성 정의 (주석 영문)
├── README.md          # 본 문서
└── venv/              # 가상환경 (직접 생성)
```
