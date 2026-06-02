# GraphRAG 인덱싱 파이프라인 (교재 KG+Vector / 예제코드 Vector)

Microsoft GraphRAG 3.x 기반 인덱싱 파이프라인임.  
교재는 Knowledge Graph + Vector로, 예제코드는 Vector 전용으로 **분리 인덱싱**함.

- [GraphRAG 인덱싱 파이프라인 (교재 KG+Vector / 예제코드 Vector)](#graphrag-인덱싱-파이프라인-교재-kgvector--예제코드-vector)
  - [1. 개요](#1-개요)
  - [2. 인덱싱 처리 흐름](#2-인덱싱-처리-흐름)
  - [3. 데이터소스 분리 전략](#3-데이터소스-분리-전략)
  - [4. 설정 옵션](#4-설정-옵션)
    - [4.1 settings.yaml 주요 옵션](#41-settingsyaml-주요-옵션)
    - [4.2 실행 옵션](#42-실행-옵션)
  - [5. 주요 소스 설명](#5-주요-소스-설명)
  - [6. 디렉터리 구조](#6-디렉터리-구조)
  - [7. 가상환경 설정 및 실행](#7-가상환경-설정-및-실행)
    - [7.1 사전 준비](#71-사전-준비)
    - [7.2 가상환경 설정 (Windows / PowerShell)](#72-가상환경-설정-windows--powershell)
    - [7.3 가상환경 설정 (Windows / GitBash)](#73-가상환경-설정-windows--gitbash)
    - [7.4 가상환경 설정 (macOS / Linux)](#74-가상환경-설정-macos--linux)
    - [7.5 실행 예시](#75-실행-예시)
  - [8. 검증/보정](#8-검증보정)

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| GraphRAG 프레임워크 | Microsoft GraphRAG 3.x (`graphrag` CLI) |
| LLM (생성) | Groq LPU `openai/gpt-oss-120b` (OpenAI 호환 API) |
| 임베딩 모델 | Ollama `qwen3-embedding` (4096차원, 로컬) |
| 벡터 스토어 | LanceDB (로컬) |
| 데이터소스 | 교재(`agentic-ai/textbook/*.md`), 예제코드(`hands-on/**/*.py`) |
| API 키 | `hands-on/.env`의 `GROQ_API_KEY` |

교재는 개념·기술 간 관계가 풍부하여 KG 구축이 효과적이고, 예제코드는 절차적 특성상  
벡터 유사도 검색이 적합하므로 인덱싱 전략을 분리함.

---

## 2. 인덱싱 처리 흐름

```
                    ┌──────────────────────── 교재 (*.md) ────────────────────────┐
                    │                                                              │
  agentic-ai/       ▼                                                              │
  textbook/*.md  ┌─────────────────────┐   graphrag index --root .                │
  ──────────────►│ 1. prepare_input    │──► data/input/*.txt                      │
                 │   (헤더 섹션 분할     │         │                                │
                 │    + 작은 섹션 병합)  │         ▼                                │
                 └─────────────────────┘   ┌──────────────────────┐               │
                                           │ 2. GraphRAG CLI       │               │
                                           │  엔티티/관계 추출       │               │
                                           │  → 커뮤니티(Leiden)    │               │
                                           │  → 커뮤니티 리포트      │               │
                                           │  → 임베딩(Ollama)      │               │
                                           └──────────┬───────────┘               │
                                                      ▼                            │
                                       store/parquet/*.parquet                     │
                                       store/vector/graphrag/*.lance               │
                                                      │                            │
                                                      ▼                            │
                                           ┌──────────────────────┐               │
                                           │ 3. verify_index       │               │
                                           │ 4. finalize_indexing  │               │
                                           │  엔티티 임베딩 보완     │               │
                                           │  + community_full_     │               │
                                           │    content (DRIFT)    │               │
                                           └──────────────────────┘               │
                    ┌───────────────── 예제코드 (*.py) ──────────────────┐         │
  hands-on/         ▼                                                    │         │
  **/*.py     ┌─────────────────────┐   5. index_code                   │         │
  ───────────►│  AST 기반 청킹        │──► qwen3-embedding ──► store/vector/code/   │
              │  (함수/클래스 단위)    │       (KG 미생성, Vector만)        │         │
              └─────────────────────┘                                              │
                                                                                   │
              ───────────────────────────────────────────────────────────────────┘
```

| 단계 | 함수 | 설명 |
|------|------|------|
| 1 | `prepare_input_documents()` | 교재(.md)를 헤더 기반 섹션 분할 → `data/input/*.txt` 내보내기 |
| 2 | `run_graphrag_index()` | `graphrag index --root .` 실행 (KG + Vector, 진행바 표시) |
| 3 | `verify_index()` | `store/parquet` 산출물 존재·행 수 검증 |
| 4 | `finalize_indexing()` | 엔티티 임베딩 누락 보완 + `community_full_content` 테이블(DRIFT) 생성 |
| 5 | `index_code()` | 예제코드(.py) AST 청킹 → `qwen3-embedding` → `store/vector/code` (KG 미생성) |

---

## 3. 데이터소스 분리 전략

| 소스 | 경로 | 인덱싱 | 청킹 방식 | 산출물 |
|------|------|--------|-----------|--------|
| 교재 | `agentic-ai/textbook/*.md` | **KG + Vector** | 헤더 섹션 분할 + 작은 섹션(500자 미만) 병합 | `store/parquet`, `store/vector/graphrag` |
| 예제코드 | `hands-on/**/*.py` | **Vector만** | AST 기반 함수/클래스 단위 | `store/vector/code` |

> 예제코드는 GraphRAG 파이프라인(`graphrag index`) 입력에서 **제외**되며, KG를 생성하지 않음.  
> `code_indexer.py`가 파이프라인 밖에서 `qwen3-embedding`으로 별도 벡터 인덱스를 구축함.

---

## 4. 설정 옵션

### 4.1 settings.yaml 주요 옵션

| 키 | 값 | 설명 |
|----|----|----|
| `completion_models.default_completion_model.model` | `openai/gpt-oss-120b` | Groq LPU 생성 모델 |
| `completion_models.default_completion_model.model_provider` | `groq` | litellm Groq 프로바이더 |
| `completion_models...concurrent_requests` | `5` | Groq LPU 병렬 요청 수 |
| `embedding_models.default_embedding_model.model_provider` | `ollama` | 임베딩 제공자(로컬 유지, MUST) |
| `embedding_models.default_embedding_model.model` | `qwen3-embedding` | 임베딩 모델(4096차원) |
| `embedding_models...api_base` | `http://localhost:11434` | Ollama 서버 주소 |
| `chunking.size` / `overlap` | `2500` / `100` | 청크 크기/겹침 |
| `extract_graph.entity_types` | `[concept, technology, framework, model, technique, organization]` | 교재 도메인 6종 엔티티 |
| `extract_graph.max_gleanings` | `0` | 재추출 비활성화(속도 약 2배) |
| `output_storage.base_dir` | `../store/parquet` | Parquet 출력 경로 |
| `vector_store.default_vector_store.db_uri` | `../store/vector/graphrag` | GraphRAG LanceDB 경로 |
| `community_reports` | 활성화 | Global/DRIFT Search용 리포트(Groq 지원, MUST) |
| `snapshots.graphml` | `false` | 시각화 파일 생략(속도 향상) |

> `--root`가 `indexing/`이므로 `../store`는 상위(`ms-graphrag/`) 기준 경로임.

### 4.2 실행 옵션

| 명령 | 설명 |
|------|------|
| `python index_documents.py` | 전체 인덱싱 (교재 KG+Vector + 예제코드 Vector) |
| `python index_documents.py --force` | 인덱스 초기화 후 재인덱싱 |
| `python index_documents.py --mode test` | 테스트용 소량 인덱싱 (교재 1 + 예제코드 2) |

---

## 5. 주요 소스 설명

| 파일 | 역할 |
|------|------|
| `settings.yaml` | GraphRAG CLI 설정 (모델·청킹·스토리지·엔티티 타입·커뮤니티 리포트) |
| `index_documents.py` | 인덱싱 메인 (문서 준비 → CLI 인덱싱 → 검증 → 후처리 → 코드 인덱싱) |
| `document_loader.py` | 교재(헤더 섹션 분할) / 예제코드(AST 청킹) 로더 |
| `code_indexer.py` | 예제코드 전용 벡터 인덱스 빌더 (Ollama 임베딩 → LanceDB, KG 미생성) |
| `finalize_indexing.py` | 엔티티 임베딩 보완 + `community_full_content` 임베딩/테이블(DRIFT) 생성 |
| `validate_index.py` | 인덱싱 검증(CRITICAL/WARNING/INFO) + `--fix` 자동 보정 |
| `config/settings.py` | 경로·상수 정의 (settings.yaml 값 재사용) |

---

## 6. 디렉터리 구조

```
hands-on/14.graphrag/ms-graphrag/
├── indexing/
│   ├── settings.yaml          # GraphRAG CLI 설정
│   ├── index_documents.py     # 인덱싱 메인
│   ├── document_loader.py     # 교재/예제코드 로더
│   ├── code_indexer.py        # 예제코드 벡터 인덱스 빌더
│   ├── finalize_indexing.py   # 후처리 (임베딩 보완, DRIFT)
│   ├── validate_index.py      # 검증/보정 도구
│   ├── requirements.txt
│   ├── README.md              # 본 문서
│   ├── config/settings.py     # 경로·상수
│   ├── utils/                 # logger, helpers
│   ├── prompts/               # (선택) 커스텀 프롬프트
│   ├── check/                 # 검증 리포트 저장
│   ├── cache/                 # GraphRAG LLM 응답 캐시
│   ├── logs/                  # GraphRAG 실행 로그
│   └── data/input/            # 교재 txt 입력 (자동 생성)
└── store/
    ├── parquet/               # GraphRAG Parquet 산출물 (entities, relationships, ...)
    ├── vector/graphrag/       # 교재 KG LanceDB (엔티티·청크·커뮤니티 임베딩)
    └── vector/code/           # 예제코드 전용 LanceDB
```

---

## 7. 가상환경 설정 및 실행

### 7.1 사전 준비

```bash
# 1) Ollama 실행 + 임베딩 모델 다운로드 (별도 터미널)
ollama serve
ollama pull qwen3-embedding

# 2) hands-on/.env 에 Groq API 키 설정
GROQ_API_KEY=gsk_...
```

### 7.2 가상환경 설정 (Windows / PowerShell)
```powershell
cd hands-on/14.graphrag/ms-graphrag/indexing
python -m venv venv
venv\Scripts\Activate.ps1
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

### 7.3 가상환경 설정 (Windows / GitBash)
```bash
cd hands-on/14.graphrag/ms-graphrag/indexing
python -m venv venv
source venv/Scripts/activate
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

### 7.4 가상환경 설정 (macOS / Linux)
```bash
cd hands-on/14.graphrag/ms-graphrag/indexing
python -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

### 7.5 실행 예시

```bash
# 테스트용 소량 인덱싱 (교재 1 + 예제코드 2) — 최초 동작 확인 권장
python index_documents.py --mode test

# 전체 인덱싱
python index_documents.py

# 인덱스 초기화 후 재인덱싱
python index_documents.py --force

# 인덱싱 검증
python validate_index.py

# 검증 + 자동 보정 (엔티티 임베딩·community_full_content 누락)
python validate_index.py --fix
```

---

## 8. 검증/보정

`validate_index.py`는 심각도별로 인덱싱 결과를 검증함.

| 심각도 | 항목(예) | 의미 |
|--------|----------|------|
| CRITICAL | C1 엔티티, C2 관계, C3 엔티티 임베딩 | 없으면 검색 불가 → 재인덱싱 권고 |
| WARNING | W1 텍스트유닛, W2 커뮤니티, W3 리포트, W4 LanceDB, W4b community_full_content, W5 description, W6 임베딩 차원, W7 예제코드 인덱스 | 일부 기능 영향 |
| INFO | I1 고아 엔티티 비율 | 참고 통계 |

자동 보정(`--fix`):
- **C3**: 엔티티 임베딩 누락 → Ollama로 수동 생성
- **W4b**: `community_full_content` 테이블 누락 → 커뮤니티 리포트 임베딩 + 테이블 생성
- **W5**: 빈 `description` → `title` 값으로 채움

검증 결과는 `check/validation_<타임스탬프>.txt`로 저장됨.  
종료 코드: CRITICAL 발견=2, WARNING 발견=1, 정상=0.
