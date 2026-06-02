# 특허법 인덱싱 (KaLM-Embedding 4-bit · MRL 1024차원)

특허법 PDF를 로드·전처리·청킹·임베딩하여 ChromaDB 공용 벡터 DB를 구축하는 인덱싱 프로그램임.  
문서검색(retrieve) 프로그램이 동일 벡터 DB를 소비하므로, 임베딩 모델·차원·지시문·컬렉션명·경로는  
`common.py`에 **단일 출처(공유 계약)**로 정의하여 양쪽이 어긋나지 않게 함.

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| 임베딩 모델 | `tencent/KaLM-Embedding-Gemma3-12B-2511` (Gemma 3 12B 백본 instruct 임베더) |
| 양자화 | bitsandbytes 4-bit (nf4, compute dtype bfloat16) → VRAM 실측 **7.05GB** |
| 차원 | MRL 1024 (네이티브 3840 → `truncate_dim=1024` 절단 후 L2 재정규화) |
| 벡터 DB | ChromaDB, 영속 경로 `../vectordb/` (컬렉션 `patent_law_kalm1024`) |
| 대상 문서 | `../../../10.rag/data/특허법.pdf` (10.rag 예제와 공유) |
| 전처리·청킹 | `10.rag/indexing.py` 로직 재사용 (clean_text, LAW_SEPARATORS, chunk 800/overlap 200) |
| 검증 결과 | 68페이지 → 246청크 → 246벡터, 차원 1024, 테스트 쿼리 on-topic 검색 확인 |

---

## 2. 임베딩 모델 — KaLM-Embedding-Gemma3-12B-2511

| 항목 | 내용 |
|------|------|
| 개발 | Tencent |
| 백본 | Gemma 3 12B (`model_type: gemma3_text`, 텍스트 전용) |
| 파라미터 | 11.76B |
| 네이티브 차원 | 3840 |
| 최대 입력 | 32K 토큰 (sentence_bert_config 상 max_seq_length 131072) |
| 풀링 | last-token pooling |
| 특징 | MMTEB SOTA급 다국어 임베딩 (한국어 포함) |

- **MRL (Matryoshka Representation Learning)**: 앞쪽 차원만 잘라도 의미가 보존되도록 학습된 중첩 임베딩임.  
  지원 차원은 3840·2048·**1024**·512·256·128·64이며, 본 예제는 VRAM·저장 효율을 위해 **1024차원**을 사용함.  
  단, 모델 내부 `Normalize` 모듈은 3840차원 기준이라 **1024 절단 후 반드시 L2 재정규화**해야 코사인 검색이 정상 동작함  
  (`normalize_embeddings=True`가 절단 이후 정규화를 적용함).
- **instruct 임베더 (비대칭 인코딩)**: query에는 지시문 프리픽스를 붙이고 document에는 붙이지 않음.  
  인덱싱(document)과 검색(query)이 동일 프롬프트 규약을 지켜야 검색 정확도가 유지됨.
  - query 프롬프트: `"Instruct: Given a query, retrieve documents that answer the query \nQuery: "`
  - document 프롬프트: `""` (빈 문자열)
- **4-bit 양자화**: bf16 원본은 약 24GB로 16GB GPU에 올릴 수 없으나, bitsandbytes 4-bit(nf4)로 **~7GB**까지 줄여 적재함.

> **버전 고정 이유**: 이 모델은 `transformers 4.55.0` / `sentence-transformers 4.1.0`로 게시됨.  
> transformers 5.x는 `gemma3_text` 백본을 멀티모달 `AutoProcessor` 경로로 잘못 적재하여 이미지 프로세서  
> 로드 오류가 발생하므로, requirements에서 두 패키지를 해당 버전으로 핀 고정함.

---

## 3. 파일 구조

```
agentic-rag-chat/
├── indexing/
│   ├── common.py          # 공유 계약(모델·차원·지시문·컬렉션명·경로) + KaLMEmbeddings 래퍼
│   ├── indexing.py        # 인덱싱 파이프라인 (로드→전처리→청킹→임베딩→저장→검증)
│   ├── requirements.txt   # 의존성 (주석 영문)
│   ├── README.md          # 본 문서
│   └── venv/              # 가상환경 (직접 생성)
└── vectordb/              # indexing.py가 생성하는 공용 ChromaDB (retrieve가 소비)
```

---

## 4. 소스 코드 설명

### 4.1 common.py — 공유 계약 + 임베딩 래퍼

| 구성 요소 | 역할 |
|-----------|------|
| 상수 | `EMBEDDING_MODEL`·`EMBED_DIM`(1024)·`COLLECTION_NAME`·`QUERY_PROMPT`·`DOCUMENT_PROMPT`·`VECTORDB_DIR` |
| `KaLMEmbeddings` | LangChain `Embeddings` 구현. document/query에 비대칭 프롬프트 적용, 1024차원 L2 정규화 벡터 반환 |
| `KaLMEmbeddings._ensure_model()` | SentenceTransformer를 4-bit·`truncate_dim=1024`로 **지연 로딩**(첫 호출 시 1회 적재) |
| `embed_documents()` | `prompt=DOCUMENT_PROMPT`로 청크 목록 임베딩 (인덱싱이 호출) |
| `embed_query()` | `prompt=QUERY_PROMPT`로 단일 질의 임베딩 (검색이 호출) |

### 4.2 indexing.py — 인덱싱 파이프라인

| 함수 | 역할 |
|------|------|
| `load_pdfs()` | PyPDFLoader로 특허법.pdf를 페이지 단위 Document로 로드 (빈 추출 조기 감지) |
| `clean_text()` | 법제처 머리글·페이지 번호 등 노이즈 제거 (10.rag/indexing.py 재사용) |
| `preprocess_documents()` | 각 페이지에 clean_text 적용 + 빈 페이지 제거 |
| `split_documents()` | RecursiveCharacterTextSplitter(LAW_SEPARATORS)로 조→항 경계 우선 청킹 |
| `filter_chunks()` | 개정 태그만 담긴 노이즈 청크 제거 |
| `attach_metadata()` | source/chunk_index/total_chunks/char_count 4개 메타데이터 부여 |
| `build_vectordb()` | KaLMEmbeddings로 임베딩하여 `../vectordb/`에 영속 저장 (기존 삭제 후 재생성, 멱등) |
| `verify_vectordb()` | 저장 건수·차원(=1024)·테스트 쿼리 on-topic 검색 결과 출력 |

### 4.3 처리 흐름

```
특허법.pdf
   │
   ▼
[1] 로드      PyPDFLoader → 68페이지 Document
   │
   ▼
[2] 전처리    clean_text (머리글·페이지번호 노이즈 제거)
   │
   ▼
[3] 청킹      RecursiveCharacterTextSplitter(LAW_SEPARATORS, 800/200)
              → filter_chunks(노이즈 제거) → attach_metadata → 246청크
   │
   ▼
[4] 임베딩    KaLMEmbeddings (4-bit, document 프롬프트, 1024차원 L2 정규화)
   │
   ▼
[5] 저장      Chroma.from_documents → ../vectordb/ (컬렉션 patent_law_kalm1024)
   │
   ▼
[6] 검증      벡터 수 246 / 차원 1024 / 테스트 쿼리 → 제29조(특허요건) 등 on-topic
```

---

## 5. 기술 스택

| 범주 | 사용 기술 |
|------|-----------|
| 임베딩 | KaLM-Embedding-Gemma3-12B-2511 + sentence-transformers 4.1.0 |
| 양자화 | bitsandbytes 4-bit (nf4) + accelerate |
| 추론 런타임 | PyTorch 2.6.0 + CUDA 12.4 |
| 문서 처리 | langchain-community(PyPDFLoader) + langchain-text-splitters + pypdf |
| 벡터 DB | ChromaDB + langchain-chroma |

---

## 6. 시스템 요구사항 및 VRAM

| 항목 | 요구사항 |
|------|----------|
| GPU | NVIDIA CUDA GPU (4-bit 적재 기준 VRAM **8GB 이상** 권장) |
| VRAM 실측 | KaLM 4-bit 적재 시 **7.05GB** (RTX 4090 Laptop 16GB에서 측정) |
| CUDA | torch가 CUDA 빌드여야 함 (CPU 빌드 시 4-bit 양자화 불가) |
| 디스크 | 모델 캐시 약 8GB + 벡터DB 약 4MB |

> 인덱싱 단계는 LLM·리랭커 없이 임베더만 적재하므로 8GB GPU에서도 동작함.

---

## 7. 가상환경 설정 및 실행

PyTorch는 CUDA 빌드를 **전역에 먼저 설치**한 뒤, venv를 `--system-site-packages`로 만들어 공유함.  
(전역 CPU 빌드가 잡히면 4-bit 양자화가 동작하지 않으므로 주의)  
PyTorch 설치 가이드: <https://github.com/cna-bootcamp/aistudy/blob/main/agentic-ai/reference/install-pytorch.md>

### 가상환경 설정 (Windows / PowerShell)
```powershell
cd hands-on/13.local-llm/agentic-rag-chat/indexing
python -m venv venv --system-site-packages
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)
```bash
cd hands-on/13.local-llm/agentic-rag-chat/indexing
python -m venv venv --system-site-packages
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)
```bash
cd hands-on/13.local-llm/agentic-rag-chat/indexing
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 실행
```bash
python indexing.py
```
> 최초 실행 시 KaLM 모델(~8GB)을 HuggingFace 허브에서 내려받음(이후 캐시 재사용).  
> 실행 후 `../vectordb/`에 ChromaDB가 생성되며, 문서검색 프로그램이 이를 사용함.

> **Windows bitsandbytes 주의**: bitsandbytes는 CUDA 버전과 맞는 Windows 휠이 필요함.  
> 설치 후 4-bit 로드 시 오류가 나면 `pip install -U bitsandbytes`로 최신 휠을 재설치함.
