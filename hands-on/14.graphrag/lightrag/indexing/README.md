# LightRAG GraphRAG 인덱싱 파이프라인

교재(Markdown)와 예제코드(Python)를 **데이터소스별로 분리 인덱싱**하는 LightRAG 기반 파이프라인임.  
교재는 Knowledge Graph + 벡터를 함께 구축하고, 예제코드는 별도 벡터 인덱스(Vector만)로 구축함.

- [LightRAG GraphRAG 인덱싱 파이프라인](#lightrag-graphrag-인덱싱-파이프라인)
  - [1. 개요](#1-개요)
  - [2. 인덱싱 처리 흐름](#2-인덱싱-처리-흐름)
  - [3. 설정 옵션](#3-설정-옵션)
  - [4. 주요 소스 설명](#4-주요-소스-설명)
  - [5. 산출물(저장소) 구조](#5-산출물저장소-구조)
  - [6. 가상환경 설정](#6-가상환경-설정)
  - [7. 사전 준비](#7-사전-준비)
  - [8. 실행 방법](#8-실행-방법)
  - [9. 실행 예시](#9-실행-예시)
  - [10. 검증 도구](#10-검증-도구)

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| GraphRAG 프레임워크 | LightRAG (lightrag-hku) — 외부 Graph DB 불필요, NetworkX + 파일 저장 |
| LLM 모델 | openai/gpt-oss-120b (Groq LPU, OpenAI 호환 API) |
| 임베딩 모델 | qwen3-embedding (4096차원, Ollama) |
| 교재 인덱싱 | LightRAG `insert()` → KG(엔티티/관계) + 벡터 동시 구축 |
| 예제코드 인덱싱 | qwen3-embedding → 별도 nano-vectordb (KG 미생성) |

**인덱싱 전략 분리 근거**  
- 교재: 개념·기술 간 관계가 풍부 → KG 구축이 효과적 (멀티홉 추론 가능)  
- 예제코드: 절차적 특성 → 벡터 유사도 기반 검색이 적합 (KG 효용 낮음)

---

## 2. 인덱싱 처리 흐름

```
                          python index_documents.py [--force] [--mode test|full]
                                              │
                                              ▼
                          ┌───────────────────────────────────┐
                          │  사전 점검                          │
                          │  - GROQ_API_KEY 존재 확인           │
                          │  - Ollama 연결 + qwen3-embedding 확인│
                          │  - 임베딩 차원(4096) 스모크 테스트   │
                          └───────────────────────────────────┘
                                              │
                          ┌───────────────────┴───────────────────┐
                          ▼                                         ▼
              [Phase 1] 교재 KG 구축                   [Phase 2] 예제코드 벡터 구축
              (agentic-ai/textbook/*.md)               (hands-on/**/*.py)
                          │                                         │
                          ▼                                         ▼
              DocumentLoader.load_for_kg()             DocumentLoader.load_for_vector()
                          │                                         │
                          ▼                                         ▼
              LightRAG.ainsert(교재 본문)              코드 청킹(문자 기반, 겹침)
                ├ 토큰 청킹                                         │
                ├ LLM 엔티티/관계 추출 (Groq)                       ▼
                ├ GraphML KG 구축                        qwen3-embedding 임베딩 (배치)
                └ 청크/엔티티/관계 임베딩 (qwen3)                   │
                          │                                         ▼
                          ▼                            nano-vectordb upsert + save
              store/kg/ 자동 저장                       store/vector/code/vdb_code.json
              (GraphML + nano-vectordb + KV Store)
                          │                                         │
                          └───────────────────┬───────────────────┘
                                              ▼
                                      인덱싱 요약 로그 출력
                                  (성공/스킵 건수, 청크 수)
```

> 파일별로 `ainsert`를 호출해 한 파일의 추출 실패가 전체를 막지 않도록 격리함 (스킵 후 계속 진행).

---

## 3. 설정 옵션

`config/settings.py`의 `Settings` 데이터클래스에서 관리함. 환경변수(`hands-on/.env` 또는 `indexing/.env`)로 오버라이드 가능.

| 설정 | 기본값 | 환경변수 | 설명 |
|------|--------|----------|------|
| `groq_model` | `openai/gpt-oss-120b` | `GROQ_MODEL` | KG 엔티티/관계 추출 LLM |
| `groq_base_url` | `https://api.groq.com/openai/v1` | `GROQ_BASE_URL` | Groq OpenAI 호환 엔드포인트 |
| `groq_api_key` | (없음) | `GROQ_API_KEY` | Groq API 키 (필수) |
| `llm_max_async` | `2` | — | 동시 LLM 호출 수 (Groq TPM 보호) |
| `embedding_model` | `qwen3-embedding` | `EMBEDDING_MODEL` | Ollama 임베딩 모델 |
| `embedding_dim` | `4096` | — | 임베딩 차원 (모델과 일치 필수) |
| `embedding_max_token_size` | `8192` | — | EmbeddingFunc 최대 토큰 |
| `ollama_base_url` | `http://localhost:11434` | `OLLAMA_BASE_URL` | Ollama 서버 주소 |
| `chunk_token_size` | `1200` | — | 교재 청크 크기 (토큰, LightRAG) |
| `chunk_overlap_token_size` | `100` | — | 교재 청크 겹침 (토큰) |
| `code_chunk_size` | `1200` | — | 예제코드 청크 크기 (문자) |
| `code_chunk_overlap` | `150` | — | 예제코드 청크 겹침 (문자) |
| `embed_batch_size` | `16` | — | 임베딩 1회 요청당 청크 수 |

**실행 옵션 (CLI)**

| 옵션 | 설명 |
|------|------|
| (없음) | 전체 인덱싱 (교재 전체 + 예제코드 전체) |
| `--force` | 기존 인덱스 삭제 후 재인덱싱 |
| `--mode test` | 소량 인덱싱 (교재 1 + 예제코드 2), 빠른 검증용 |

---

## 4. 주요 소스 설명

| 파일 | 역할 |
|------|------|
| `index_documents.py` | 엔트리포인트. 사전점검 → Phase 1(KG) → Phase 2(코드 벡터) → 요약 |
| `config/settings.py` | 경로·모델·청킹 설정 (`Settings` 데이터클래스, `.env` 로드) |
| `llm_func.py` | Groq LLM 함수 + Ollama 임베딩 함수(`EmbeddingFunc`) 생성, 연결 점검 |
| `document_loader.py` | 교재/예제코드 분리 로드 (dict 반환): `load_for_kg` / `load_for_vector` / `load_specific_files` |
| `kg_builder.py` | 교재 → LightRAG `ainsert` (KG+Vector). 동기 `build_from_documents` → 내부 `asyncio.run` |
| `code_vector_index.py` | 예제코드 → 청킹·임베딩 → nano-vectordb 저장 |
| `validate_index.py` | 산출물 검증(CRITICAL/WARNING/INFO) + `--fix` 누락분 재구축 |

**임베딩 이중 래핑 주의** (`llm_func.py`)  
LightRAG의 `ollama_embed`에는 `embedding_dim=1024` 데코레이터가 기본 적용되어 `EmbeddingFunc(4096)`과  
충돌(벡터 수 불일치)함. `ollama_embed.func`로 원본 함수에 직접 접근하여 우회함.

**동기 인터페이스 설계**  
LightRAG의 스토리지 초기화(`initialize_storages` / `initialize_pipeline_status`)는 비동기 전용임.  
이에 인덱서 본체는 async로 두고, 공개 메서드(`build_from_documents`)는 내부에서 `asyncio.run()`으로  
구동해 호출부(Streamlit 등 동기 환경 포함)는 동기로 사용 가능함.

---

## 5. 산출물(저장소) 구조

```
store/
├── kg/                                       # LightRAG working_dir (교재 KG+Vector+KV)
│   ├── graph_chunk_entity_relation.graphml   # Knowledge Graph (엔티티 노드 + 관계 엣지)
│   ├── vdb_chunks.json                        # 교재 청크 벡터 (nano-vectordb)
│   ├── vdb_entities.json                      # 엔티티 벡터
│   ├── vdb_relationships.json                 # 관계 벡터
│   ├── kv_store_full_docs.json                # 원문 KV Store
│   ├── kv_store_text_chunks.json             # 청크 KV Store
│   ├── kv_store_doc_status.json              # 문서 인덱싱 상태 (증분 업데이트용)
│   └── kv_store_llm_response_cache.json      # LLM 응답 캐시 (재인덱싱 비용 절감)
└── vector/
    └── code/
        └── vdb_code.json                      # 예제코드 전용 벡터 인덱스 (KG 미생성)
```

---

## 6. 가상환경 설정

> LightRAG는 PyTorch에 의존하지 않으므로 `--system-site-packages` 옵션이 필요 없음.

### 가상환경 설정 (Windows / PowerShell)
```powershell
cd hands-on/14.graphrag/lightrag/indexing
python -m venv venv
venv\Scripts\Activate.ps1
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)
```bash
cd hands-on/14.graphrag/lightrag/indexing
python -m venv venv
source venv/Scripts/activate
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)
```bash
cd hands-on/14.graphrag/lightrag/indexing
python -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

---

## 7. 사전 준비

1. **Groq API 키**: `hands-on/.env`에 `GROQ_API_KEY=gsk_...` 설정  
2. **Ollama 실행 + 임베딩 모델**:
   ```bash
   ollama serve              # 별도 터미널에서 실행
   ollama pull qwen3-embedding
   ```

---

## 8. 실행 방법

```bash
python index_documents.py              # 전체 인덱싱
python index_documents.py --force      # 인덱스 초기화 후 재인덱싱
python index_documents.py --mode test  # 소량 테스트 (교재 1 + 예제코드 2)
```

---

## 9. 실행 예시

```text
============================================================
LightRAG GraphRAG 인덱싱 시작 (mode=test, force=False)
============================================================
[경로 확인] 교재 디렉터리     : .../agentic-ai/textbook (존재=True, .md 17개)
[경로 확인] 예제코드 디렉터리 : .../hands-on (존재=True)
임베딩 스모크 테스트 통과: 4096차원
문서 로드 (테스트 모드: 교재 1 + 예제코드 2)
KG 대상 교재: 1개 / 코드 벡터 대상 예제코드: 2개
[Phase 1] 교재 KG 구축 시작 (1개 파일)
KG insert 시작: .../agentic-ai/textbook/05.STT.md
KG 인덱싱 완료: 성공 1, 스킵 0
[Phase 2] 예제코드 벡터 인덱스 구축 시작 (2개 파일)
코드 벡터 인덱싱 완료: 파일 성공 2, 스킵 0, 청크 3
============================================================
인덱싱 요약
  교재 KG : 성공 1 / 스킵 0 / 전체 1
  코드 벡터: 성공 2 / 스킵 0 / 청크 3 / 전체 2
인덱싱 완료! 검증: python validate_index.py
============================================================
```

---

## 10. 검증 도구

```bash
python validate_index.py        # 산출물 검증 (CRITICAL/WARNING/INFO)
python validate_index.py --fix  # 누락분 자동 재구축 (교재 KG·코드 벡터)
```

검증 결과는 `check/validation_<타임스탬프>.txt`로 저장됨.

| 코드 | 심각도 | 검증 항목 |
|------|--------|----------|
| C1 | CRITICAL | KG GraphML 존재 + 노드 1개 이상 |
| C2 | CRITICAL | 교재 청크 벡터(vdb_chunks.json) 존재·비어있지 않음 |
| C3 | CRITICAL | 코드 벡터 인덱스(vdb_code.json) 존재·비어있지 않음 |
| W1 | WARNING | 엔티티 벡터(vdb_entities.json) |
| W2 | WARNING | 관계 벡터(vdb_relationships.json) |
| W3 | WARNING | 원문 KV Store(kv_store_full_docs.json) |
| W4 | WARNING | 청크 KV Store(kv_store_text_chunks.json) |
| W5 | WARNING | 코드 벡터 임베딩 차원 일치(4096) |

> 종료코드: CRITICAL=2, WARNING=1, 정상=0 (CI·스크립트 연동용)
