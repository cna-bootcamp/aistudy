# 특허 Agentic RAG 챗봇 (2-Stage Retrieval + LangGraph + Groq LPU)

2-Stage Retrieval(로컬 임베더 → 로컬 리랭커)과 LangGraph Agentic RAG를 결합한 특허/지식재산권 전문  
Streamlit 웹 챗봇임. 사용자 질의가 들어오면 Agent가 스스로 검색 소스(법률 벡터DB·웹·YouTube)를 고르고,  
2-stage 검색·답변 생성·유용성 평가·질의 재작성 루프를 거쳐 출처를 단 답변을 스트리밍함.  
답변 생성 LLM은 **Groq LPU(클라우드)**, 검색 임베더·리랭커는 **로컬 GPU 모델**을 사용함.

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| 답변 LLM | Groq LPU `openai/gpt-oss-120b` (클라우드, 사이드바에서 변경 가능) |
| 질의 임베더 | `tencent/KaLM-Embedding-Gemma3-12B-2511` (4-bit, MRL 1024차원, 로컬 GPU) |
| 리랭커 | `dragonkue/bge-reranker-v2-m3-ko` (Cross-encoder, 로컬 GPU) |
| 벡터 DB | ChromaDB `../vectordb/` (컬렉션 `patent_law_kalm1024`, 246청크) |
| 검색 방식 | 2-Stage Retrieval (Bi-encoder top-20 → Cross-encoder 재정렬 top-5) |
| 오케스트레이션 | LangGraph StateGraph + MemorySaver 체크포인터(멀티턴) |
| UI | Streamlit (`st.chat_input`/`st.chat_message`/`st.write_stream`/`st.status`) |

---

## 2. 지원 모델

### 2.1 답변 생성 LLM (Groq LPU · 클라우드)

| 모델 | 설명 | VRAM |
|------|------|------|
| `openai/gpt-oss-120b` (기본) | OpenAI gpt-oss 120B 추론 모델, 구조화 출력(json_schema)·한국어 답변 안정적 | N/A (클라우드) |
| `openai/gpt-oss-20b` | gpt-oss 20B, 더 빠르나 추론 품질은 120B보다 낮음 | N/A (클라우드) |
| `meta-llama/llama-4-scout-17b-16e-instruct` | Meta Llama 4 Scout MoE 모델 (json_schema 지원 확인) | N/A (클라우드) |

- 드롭다운에는 라우팅·평가·재작성이 의존하는 `with_structured_output(method="json_schema")`를 **실제로 지원하는  
  것으로 검증된 Groq 모델만** 포함함. `llama-3.3-70b-versatile`·`qwen3`·`deepseek-r1` 등은 json_schema 응답  
  형식을 지원하지 않아 제외함 (선택 시 라우터 호출에서 400 오류 발생).  
- LLM은 Groq Cloud LPU에서 서빙되므로 로컬 VRAM을 사용하지 않음 (N/A).  
- 구조화 판단(라우팅·평가·재작성)은 `temperature=0` + `with_structured_output(method="json_schema")`,  
  답변 생성은 `gpt-oss` 계열에 한해 `reasoning_format="hidden"`으로 사고 과정을 숨기고 최종 답변만 스트리밍함.

### 2.2 로컬 임베더·리랭커 (GPU)

| 모델 | 역할 | 정밀도 | VRAM (실측/추정) |
|------|------|--------|------------------|
| KaLM-Embedding-Gemma3-12B-2511 | 질의 인코딩(Stage 1) | 4-bit(nf4) | **약 7.05GB** (실측, 인덱싱 동일) |
| dragonkue/bge-reranker-v2-m3-ko | (질의,문서) 재정렬(Stage 2) | fp16 | **약 2.3GB** (추정, XLM-RoBERTa 568M) |
| **합계** | — | — | **약 9~10GB** (권장 12GB+ VRAM) |

- 질의 임베더는 인덱싱과 동일한 모델·차원·지시문을 `../indexing/common.py`에서 공유해 검색 정합성을 보장함.  
- CPU로도 동작하나 매우 느리므로 GPU(CUDA) 사용을 권장함.

---

## 3. 파일 구조

```
agentic-rag-chat/
├── indexing/
│   └── common.py            # 공유 계약(임베딩 모델·차원·지시문·컬렉션명) + KaLMEmbeddings 래퍼 (재사용)
├── vectordb/                # 인덱싱이 생성한 공용 ChromaDB (patent_law_kalm1024, 246청크)
└── retrieve/                # ★ 본 프로그램
    ├── retrieval.py         # 2-Stage Retrieval (KaLM Bi-encoder → BGE Cross-encoder)
    ├── graph.py             # LangGraph Agentic RAG (노드·검색 스택·MemorySaver)
    ├── app.py               # Streamlit 웹 챗봇 진입점
    ├── requirements.txt      # 의존성 (torch 제외 — 전역 CUDA torch 상속)
    └── README.md            # 본 문서
```

---

## 4. 기술 스택

| 구분 | 기술 |
|------|------|
| 답변 LLM | Groq LPU `openai/gpt-oss-120b` (`langchain-groq`) |
| 임베딩 | KaLM-Embedding-Gemma3-12B-2511 (4-bit, `sentence-transformers` + `bitsandbytes`) |
| 리랭커 | dragonkue/bge-reranker-v2-m3-ko (`sentence-transformers` `CrossEncoder`) |
| 벡터 DB | ChromaDB (`langchain-chroma`) |
| 에이전트 | LangGraph StateGraph + MemorySaver (`langgraph`) |
| 웹 검색 | DuckDuckGo (`ddgs`/`duckduckgo-search`) + WebBaseLoader·BeautifulSoup 본문 추출 |
| YouTube | `scrapetube`(검색) + oembed 유효성 + `youtube-transcript-api`(자막, Webshare 프록시) |
| 구조화 출력 | Pydantic + `with_structured_output(method="json_schema")` |
| 웹 UI | Streamlit |

---

## 5. 소스 코드 설명

### 5.1 `retrieval.py` — 2-Stage Retrieval

| 함수/클래스 | 역할 |
|-------------|------|
| `load_vectorstore()` | 공용 벡터 DB를 KaLM 질의 임베더와 함께 로드 (질의에 지시문·1024차원 적용) |
| `load_reranker()` | `dragonkue/bge-reranker-v2-m3-ko` Cross-encoder를 GPU로 1회 적재 |
| `TwoStageRetriever.retrieve(query)` | Stage1 유사도 top-20 → Stage2 재정렬 top-5 반환 (rerank_score 부착) |
| `_sigmoid(value)` | 리랭커 logit을 0~1 관련도로 변환 (재정렬 점수 표기용) |

- **Stage 1 (Bi-encoder)**: KaLM으로 질의를 1024차원 인코딩 → ChromaDB 코사인 유사도 top-20을 빠르게 회수.  
- **Stage 2 (Cross-encoder)**: (질의, 문서) 쌍을 함께 입력해 관련도를 정밀 채점 → 상위 top-5만 유지.  
  1차에서 넘어온 소수 후보(20개)만 재채점하므로 비용·정확도 균형이 좋음.

### 5.2 `graph.py` — LangGraph Agentic RAG

**Pydantic 스키마 (json_schema 구조화 출력)**

| 스키마 | 용도 |
|--------|------|
| `CheckRetrieval` | 법률DB 필요 여부 + 소스(vectordb/web/youtube) + 소스별 최적 쿼리 + 근거 |
| `UsefulnessGrade` | 답변 유용성(is_useful) + 근거 |
| `RewrittenQuery` | 재작성 질의 + 근거 |

**노드**

| 노드 | 역할 |
|------|------|
| `check_retrieval` | 법률DB 검색 필요 여부·소스 판단, 소스별 질의어 최적화 (구조화 출력) |
| `search` | 선택 소스에서 검색 (벡터DB=2-stage 재정렬 / 웹 / YouTube) |
| `generate` | 검색 컨텍스트 기반 답변 생성(스트리밍) + 코드로 출처 부착 |
| `generate_direct` | 법률DB 불필요 시에도 웹 검색을 수행한 뒤 답변 |
| `evaluate` | 답변 유용성 평가 (재검색 루프 분기 기준, 구조화 출력) |
| `rewrite` | 유용성 미달 시 질의 재작성 (최대 2회, 가드는 조건부 엣지에서 검사) |

**검색 스택 (주요 함수)**

| 함수 | 역할 |
|------|------|
| `search_web(query)` | DuckDuckGo 검색 → `WebBaseLoader.scrape()` + BeautifulSoup 노이즈 제거(실패 시 스니펫 폴백) |
| `search_youtube(query)` | scrapetube 검색 → `is_valid_video()` oembed 검증 → 자막 타임스탬프 청킹(실패 시 메타데이터만) |
| `is_valid_video(url)` | oembed로 영상 공개·재생 가능 여부 확인 (비공개·삭제 영상 제외) |
| `build_transcript_client()` | `youtube-transcript-api` 클라이언트 생성 (YT_WEBSHARE 프록시 적용) |
| `_chunk_transcript(pieces)` | 자막을 120초 단위 타임스탬프 청크로 분할 (YoutubeLoader CHUNKS 모드 동일 로직) |
| `build_context()` / `build_sources_section()` | 검색 결과 → 컨텍스트 문자열 / 출처 마크다운 구성 (URL 누락 방지) |

> YouTube 자막은 LangChain `YoutubeLoader`가 프록시 인자를 받지 못해 IP 차단에 취약하므로,  
> 동일한 120초 타임스탬프 청킹을 유지하면서 프록시(Webshare)를 지원하는 `youtube-transcript-api`를 직접 사용함.

**실행 헬퍼**

| 메서드 | 역할 |
|--------|------|
| `stream_events(question, history, thread_id)` | 그래프를 스트리밍 실행, (노드 진행 업데이트, 답변 토큰)을 정규화해 yield |
| `get_final_state(thread_id)` | 마지막 체크포인트의 최종 상태 반환 (출처·요약 표기용) |
| `build_initial_state(question, history)` | 매 턴 transient 필드를 리셋한 초기 상태 구성 (멀티턴 상태 누수 방지) |

### 5.3 `app.py` — Streamlit 챗봇

| 함수 | 역할 |
|------|------|
| `get_retriever()` | `@st.cache_resource`로 임베더·리랭커 1회 적재 (모델 무관 공유) |
| `get_agent(model)` | `@st.cache_resource`로 모델명별 Agentic RAG 그래프 캐싱 |
| `render_sidebar()` | LLM 모델 드롭다운·대화 초기화·세션 정보 |
| `render_step()` | 라우팅·재정렬 top-5·평가 단계를 `st.status`로 가시화 |
| `handle_user_input()` | 질의 처리 + `st.write_stream` 토큰 스트리밍 + 출처 렌더 |

---

## 6. 처리 흐름

```
                          ┌─────────────────┐
   사용자 질의 ──────────▶│ check_retrieval │  법률DB 필요? + 소스 + 소스별 질의어 (json_schema)
                          └────────┬────────┘
                  법률DB 필요       │        법률DB 불필요
              ┌─────────────────────┴─────────────────────┐
              ▼                                             ▼
        ┌──────────┐                              ┌──────────────────┐
        │  search  │  Stage1 top-20 → Stage2 top-5 │ generate_direct  │ 웹 검색 후 직접 답변(스트리밍)
        │          │  + 웹 + YouTube(자막)          └─────────┬────────┘
        └────┬─────┘                                          ▼
             ▼                                               END
       ┌──────────┐
       │ generate │  컨텍스트 기반 답변 생성(스트리밍) + 출처 부착
       └────┬─────┘
            ▼
       ┌──────────┐   유용함 / 재시도 소진
       │ evaluate │ ───────────────────────▶ END
       └────┬─────┘
            │ 유용 미달 (재시도 < 2)
            ▼
       ┌──────────┐
       │ rewrite  │ ──▶ check_retrieval (재검색 루프)
       └──────────┘
```

---

## 7. 시스템 요구사항

| 항목 | 요구사항 |
|------|----------|
| GPU | NVIDIA CUDA GPU 권장 (임베더 4-bit + 리랭커, **VRAM 12GB+ 권장**) |
| VRAM | KaLM 약 7GB + 리랭커 약 2.3GB ≈ **약 9~10GB** |
| 디스크 | 모델 캐시 약 10GB+ (KaLM·리랭커 최초 다운로드) |
| 네트워크 | Groq API(LLM)·DuckDuckGo·YouTube 접근 필요 |
| 선행 작업 | `../indexing/indexing.py`로 공용 벡터 DB(`../vectordb/`)가 구축되어 있어야 함 |

`.env` (`hands-on/.env`) 필수/선택 키:

| 키 | 필수 | 용도 |
|----|------|------|
| `GROQ_API_KEY` | 필수 | Groq LPU LLM 호출 |
| `YT_WEBSHARE_USER` / `YT_WEBSHARE_PASS` | 선택 | YouTube 자막 IP 차단 우회 프록시 (없으면 자막 graceful fallback) |
| `YT_WEBSHARE_LOCATIONS` | 선택 | 프록시 국가 필터 (예: `kr,jp`) |

---

## 8. 가상환경 설정 및 실행

> **PyTorch(CUDA) 사전 설치 필요**: `nvidia-smi`로 CUDA 버전을 확인하고, 전역에 CUDA 빌드 torch를 설치한 뒤  
> 가상환경을 `--system-site-packages`로 만들어 전역 GPU torch를 상속함 (CPU 빌드 설치 방지).  
> 설치 가이드: <https://github.com/cna-bootcamp/aistudy/blob/main/agentic-ai/reference/install-pytorch.md>

### 가상환경 설정 (Windows / PowerShell)
```powershell
cd hands-on/13.local-llm/agentic-rag-chat/retrieve
python -m venv venv --system-site-packages
venv\Scripts\Activate.ps1
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)
```bash
cd hands-on/13.local-llm/agentic-rag-chat/retrieve
python -m venv venv --system-site-packages
source venv/Scripts/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)
```bash
cd hands-on/13.local-llm/agentic-rag-chat/retrieve
python -m venv venv          # macOS는 pip install torch 로 MPS 자동 지원 (--system-site-packages 불필요)
source venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

### 실행
```bash
streamlit run app.py          # 웹 챗봇 (브라우저 자동 오픈)
python retrieval.py "특허 요건은?"   # 2-stage 검색 단독 스모크 테스트
python graph.py               # 그래프 전체 흐름 CLI 데모(비대화형)
```

> **bitsandbytes 주의**: 4-bit 양자화는 `bitsandbytes`의 CUDA 빌드가 필요함 (Windows는 CUDA 휠 제공).  
> CPU 전용 환경에서는 4-bit 적재가 실패할 수 있으므로 CUDA GPU 환경에서 실행해야 함.  
> `transformers==4.55.0` / `sentence-transformers==4.1.0`은 KaLM 모델 호환을 위해 고정된 버전이므로 변경하지 말 것.

---

## 9. 문제 해결 (Troubleshooting)

### 9.1 `Segmentation fault` 로 종료되고 브라우저에 `Failed to fetch dynamically imported module`

**증상**: `streamlit run app.py` 실행 후 `Loading checkpoint shards 5/5` 완료 직후 `Segmentation fault` 로 프로세스가 죽고,  
브라우저에 `Failed to fetch dynamically imported module ...ChatInput...` 오류가 표시됨.  
(JS 오류는 **결과**임 — 서버 프로세스가 죽어서 정적 파일을 못 받는 것)

**확정된 근본 원인 (실제 진단·검증 완료)**

`langchain_chroma`를 모듈 최상단에서 import 하면 `chromadb → onnxruntime + grpcio` 네이티브 라이브러리가  
streamlit 프로세스 시작 시점에 CUDA 네이티브 런타임을 먼저 선점함.  
이후 `CrossEncoder`(BGE 리랭커)가 CUDA를 초기화하려 할 때 이미 선점된 네이티브 런타임과 충돌해  
`Windows fatal exception: access violation` (= segfault) 이 발생함.

```
# 크래시 재현 패턴 (mintest 진단으로 확인)
import chromadb           # onnxruntime + grpcio 가 CUDA 네이티브를 선점
CrossEncoder(..., device="cuda")  # → access violation (segfault)

# 정상 패턴 (로드 순서 역전)
CrossEncoder(..., device="cuda")  # CUDA 컨텍스트 먼저 확보
import chromadb           # 이미 확보된 CUDA 컨텍스트 위에서 정상 로드
```

**적용된 수정 (이미 반영됨)**

| 파일 | 수정 내용 |
|------|----------|
| `retrieval.py` | `from langchain_chroma import Chroma` 를 최상단에서 `load_vectorstore()` 함수 내부로 이동 (지연 import) |
| `app.py` `get_retriever()` | `load_reranker()` (CrossEncoder) → `load_vectorstore()` (chromadb) 순서로 로드 |

> **일반 패턴**: `chromadb`, `onnxruntime-gpu`, `grpcio` 등 CUDA 네이티브를 포함하는 패키지와  
> PyTorch CUDA 모델을 같은 프로세스에서 함께 쓸 때는, **torch 모델을 반드시 먼저 초기화**한 뒤  
> chromadb 계열 패키지를 로드해야 함. streamlit 환경에서는 모듈 최상단 import 가 세션 연결 전에  
> 실행되므로 무거운 네이티브 패키지는 **지연 import** (함수 내부에서 import) 로 처리할 것.

### 9.2 좀비 프로세스·VRAM 확인 및 정리 (Windows / PowerShell)

비정상 종료된 python 프로세스가 VRAM을 점유한 채 남아있으면 다음 실행에서 VRAM 부족이 발생할 수 있음.

```powershell
# 현재 GPU 메모리 및 점유 프로세스 확인
nvidia-smi

# streamlit/app.py 관련 잔여 python 프로세스 종료 (VRAM 회수)
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -like '*streamlit*app.py*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

### 9.3 크래시 발생 시 원인 위치 확인
```bash
PYTHONFAULTHANDLER=1 streamlit run app.py
```
segfault 발생 시 `Windows fatal exception: access violation` 아래에 모든 스레드의 파이썬 스택 트레이스가 출력됨.  
어느 함수·어느 라이브러리에서 죽는지 확인 가능.
