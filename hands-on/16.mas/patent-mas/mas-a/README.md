# patent-mas / mas-a — 특허법 법령지식 MAS (MCP 서버)

대한민국 특허법 지식을 **조문 벡터 RAG**와 **MS GraphRAG**로 융합 검색하여, FastMCP(Streamable HTTP)
서버로 노출하는 멀티에이전트 시스템(MAS)임. LangGraph의 **SAS 패턴(Scheduler–Agent–Supervisor)** 으로
"검색 모드 라우팅 → 검색 실행 → 근거 충분성 평가 → 미흡 시 보완 검색·융합"을 오케스트레이션함.

- 두 검색은 **서로 다른 역할로 공존**하며, 한 질의에 동시에 둘 다 실행하지 않음 (중복 검색 금지).
  - **조문 벡터 RAG** : "특허법 제29조(특허요건)"처럼 **조문 원문을 정밀 인용** (ChromaDB `patent_law`)
  - **MS GraphRAG**   : 요건·권리·절차의 **관계/커뮤니티 구조** 질의 (Local / Global / DRIFT)
- Supervisor가 근거 부족을 감지할 때만 **상보적 모드**로 한 번 더 검색하고 결과를 융합함.

> 선행 인덱싱 산출물(`indexing/vector/store`, `indexing/graphrag/store`)을 **재인덱싱 없이** 조회함.

---

## 1. 아키텍처

### 1.1 SAS 워크플로 (LangGraph StateGraph)

```
                          ┌──────────────────────────────────────────────┐
   질문(question, mode)   │                  PatentLawMAS                  │
        │                 │                                                │
        ▼                 │   ┌───────────┐                                │
   ┌─────────┐  라우팅    │   │ Scheduler │  검색 모드 결정                │
   │  START  │──────────▶ │   │  (router) │  패턴 매칭 + LLM 폴백          │
   └─────────┘            │   └─────┬─────┘  vector/local/global/drift     │
                          │         ▼                                      │
                          │   ┌───────────┐  결정된 모드로 검색 실행       │
                          │   │   Agent   │  ├ vector  → ChromaDB 조문 인용 │
                          │   │           │  └ graphrag→ MS GraphRAG 구조   │
                          │   └─────┬─────┘                                │
                          │         ▼                                      │
                          │   ┌───────────┐  근거 충분성 평가(구조화 LLM)  │
                          │   │Supervisor │──(미흡)─▶ 보완 모드로 재검색 ──┐│
                          │   └─────┬─────┘   Loop Guard(max_reroutes=1)  ││
                          │         │ (충분/한도)                          ││
                          │         ▼                          ◀───────────┘│
                          │   ┌───────────┐  2패스면 조문+구조 근거 융합   │
                          │   │   Fuse    │  (단일 패스면 생략)            │
                          │   └─────┬─────┘                                │
                          └─────────┼──────────────────────────────────────┘
                                    ▼
                              답변 + 출처 + 근거 요약
```

### 1.2 MCP 노출 (FastMCP / Streamable HTTP)

```
   ┌──────────────┐   tools/call ask_patent_law      ┌──────────────────────┐
   │  AI 앱 /     │ ───────────────────────────────▶ │  patent-law-mas       │
   │  Claude Code │   resources/read patent://kg/*   │  FastMCP 서버         │
   │  (MCP Client)│ ◀─────────────────────────────── │  http://host:8010/mcp │
   └──────────────┘   prompts/get patent_law_advice  └──────────┬───────────┘
                                                                 ▼
                                                          PatentLawMAS(SAS)
                                          ┌──────────────────────┴───────────────────────┐
                                          ▼                                               ▼
                            ChromaDB `patent_law` (조문 245청크)         MS GraphRAG (엔티티 1,122 / 관계 1,242)
                            OpenAI text-embedding-3-small(1536d)         Parquet + LanceDB, Groq gpt-oss-120b
```

### 1.3 기술 스택

| 구분 | 사용 기술 |
|------|-----------|
| LLM | Groq LPU `openai/gpt-oss-120b` (`reasoning_format="hidden"`) |
| 구조화 출력 | `with_structured_output(method="json_schema")` (라우팅 결정·충분성 판정) |
| 임베딩 | OpenAI `text-embedding-3-small` (1536차원) |
| 워크플로 | LangGraph `StateGraph` (SAS 패턴) |
| 검색 | ChromaDB(조문 벡터) + Microsoft GraphRAG(KG: Local/Global/DRIFT) |
| 노출 | FastMCP, Streamable HTTP 전송 |

> 제약 준수: **로컬 AI 모델 미사용** — LLM(Groq)·임베딩(OpenAI) 모두 클라우드 API임.

---

## 2. 검색 모드

| 모드 | 검색기 | 역할 | 예시 질문 |
|------|--------|------|-----------|
| `vector` | ChromaDB | 조문 원문 정밀 인용 | "제29조 특허요건 원문을 알려줘" |
| `local`  | GraphRAG | 엔티티(요건·권리·절차) 관계 | "신규성 요건과 연결된 절차는?" |
| `global` | GraphRAG | 커뮤니티 단위 전체 구조 요약 | "특허 거절이유의 종류와 구조 요약" |
| `drift`  | GraphRAG | 복합·다단계 추론(primer+follow-up) | "무효심판과 정정심판의 관계 종합" |
| `auto`   | (라우터) | 패턴 매칭 + LLM 폴백으로 자동 선택 | (임의) |

DRIFT는 primer JSON 파싱이 반복 실패하면 Local Search로 자동 폴백함 (graceful degradation).

---

## 3. 디렉터리 구조

```
mas-a/
├── server.py                 # FastMCP 서버 (Tool/Resource/Prompt 등록·기동)
├── search_cli.py             # 단건 질의 CLI (서버 없이 SAS 흐름 즉시 실행)
├── test_e2e.py               # 인-프로세스 검색 검증 (GraphRAG 빈 컨텍스트 트랩 포함)
├── test_mcp_client.py        # MCP 전송 계층 검증 (실제 Streamable HTTP 클라이언트)
├── requirements.txt          # 의존성 (주석 영문)
├── .env.example              # 환경변수 예시
├── config/
│   ├── settings.py           # 경로·모델·검색 파라미터 (주석 한글)
│   └── llm.py                # ChatGroq 팩토리 + 구조화 출력 헬퍼
├── retrieval/
│   ├── types.py              # SourceItem / SearchOutput 공통 타입
│   ├── async_utils.py        # 동기↔async 이벤트 루프 브리지 (MCP 안전)
│   ├── vector_retriever.py   # 조문 벡터 RAG (ChromaDB patent_law)
│   └── graphrag_retriever.py # MS GraphRAG (local/global/drift + KG 통계)
└── mas/
    ├── state.py              # 공유 State(TypedDict, reducer)
    ├── router.py             # Scheduler 라우터 (패턴 + LLM 구조화 폴백)
    ├── nodes.py              # Scheduler/Agent/Supervisor/Fuse 노드
    └── graph.py              # StateGraph 조립 + PatentLawMAS 진입점
```

### 소스 코드 설명

- **config/settings.py** : 두 인덱스 경로(절대경로), 모델명, 검색·워크플로·MCP 파라미터를 한곳에서 관리함.
  GraphRAG는 `vector_store.db_uri`를 **루트 기준 상대경로**로 해석하므로 `load_config`에 절대경로를 넘겨
  빈 컨텍스트 트랩을 방지함.
- **config/llm.py** : `gpt-oss` 계열에만 `reasoning_format="hidden"`을 조건부로 부여하고, 구조화 출력은
  `with_structured_output(method="json_schema")`로 일원화함.
- **retrieval/vector_retriever.py** : ChromaDB `patent_law`를 재임베딩 없이 연결해 유사 조문을 검색하고,
  장/조/항 메타데이터로 "특허법 제○조(제목)" 인용 라벨을 만들어 정밀 인용을 보존함.
- **retrieval/graphrag_retriever.py** : Microsoft GraphRAG의 `local/global/drift_search` API를 호출함.
  `kg_stats()/kg_schema()`로 MCP Resource용 KG 통계도 제공함.
- **retrieval/async_utils.py** : async GraphRAG API를 동기 코드/MCP 워커 양쪽에서 안전하게 실행함
  (실행 중 루프가 있으면 별도 스레드의 독립 루프로 처리).
- **mas/router.py** : 특허법 도메인 키워드로 모드를 점수화하고, 확신도가 낮으면 LLM 구조화 분류로 폴백함.
- **mas/nodes.py** : SAS 4노드. Supervisor는 보수적 충분성 평가 + Loop Guard로 무한 모드 전환을 방지함.
- **mas/graph.py** : `START→scheduler→agent→supervisor─(retry/fuse/end)` 그래프를 컴파일하고 `answer()` 제공.
- **server.py** : `ask_patent_law` 도구(동기 함수 — 이벤트 루프 브리지 유지가 핵심), KG 리소스 2종,
  자문 프롬프트 1종을 등록함. 응답은 원문 스니펫·개수 요약으로 간결화함.

---

## 4. 사전 준비

선행 인덱싱이 완료되어 있어야 함 (이 프로젝트는 인덱스를 **조회만** 함).

- 조문 벡터: `indexing/vector/store/chroma.sqlite3` (컬렉션 `patent_law`, 245청크)
- GraphRAG : `indexing/graphrag/store/parquet/*.parquet` + `indexing/graphrag/store/vector/graphrag/*.lance`

API 키는 공용 `hands-on/.env` 에서 로드됨.

```dotenv
GROQ_API_KEY=gsk_...     # LLM (Groq LPU openai/gpt-oss-120b)
OPENAI_API_KEY=sk-...    # 임베딩 (text-embedding-3-small)
```

---

## 5. 가상환경 설정 및 실행

### 가상환경 설정 (Windows / PowerShell)
```powershell
cd hands-on/16.mas/patent-mas/mas-a
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)
```bash
cd hands-on/16.mas/patent-mas/mas-a
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)
```bash
cd hands-on/16.mas/patent-mas/mas-a
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 5.1 단건 질의 (CLI, 서버 불필요)

```bash
python search_cli.py "특허를 받을 수 있는 요건은?"          # mode=auto
python search_cli.py "제29조 특허요건 원문" --mode vector
python search_cli.py "무효심판과 정정심판의 관계" --mode drift
```

라우팅·감독(충분성)·사용 모드·출처를 함께 출력해 SAS 흐름을 한눈에 확인 가능함.

### 5.2 검증 (테스트)

```bash
python test_e2e.py          # 인-프로세스 검색 검증 (모드별 답변·GraphRAG 컨텍스트·KG 통계)
python test_mcp_client.py   # MCP 전송 계층 검증 (서버 자동 기동·도구/리소스/프롬프트 호출·종료)
```

두 테스트 모두 마지막 줄에 `ALL PASS`가 출력되면 통과임.

### 5.3 MCP 서버 기동

```bash
python server.py
# → http://127.0.0.1:8010/mcp  (Streamable HTTP)
```

MCP 클라이언트(Claude Code 등)에서 위 URL을 등록하면 다음을 사용할 수 있음.

- **Tool** `ask_patent_law(question, mode="auto")` — 특허법 근거 기반 한국어 답변
- **Resource** `patent://kg/stats`, `patent://kg/schema` — KG 통계/스키마 조회
- **Prompt** `patent_law_advice(topic)` — 특허법 자문 작성 템플릿

---

## 6. 동작 원리 요약

1. **Scheduler**가 질문을 모드로 라우팅함 (패턴 우선, 확신도 낮으면 LLM 구조화 분류).
2. **Agent**가 해당 모드 검색기 1개만 실행함 (vector 또는 GraphRAG) — 중복 검색 없음.
3. **Supervisor**가 답변의 근거 충분성을 평가함.
   - 충분하면 종료, 미흡하면 **상보적 모드**(vector↔GraphRAG)로 1회 재검색 (Loop Guard).
4. 2패스가 발생하면 **Fuse**가 조문 원문 근거와 관계/구조 근거를 하나의 답변으로 융합함.
5. MCP 응답은 답변·선택 모드·근거 출처(스니펫)·근거 개수 요약으로 간결화함.
