# 특허법 GraphRAG 인덱싱 파이프라인 (KG + Vector)

Microsoft GraphRAG 3.x 기반 인덱싱 파이프라인임.  
단일 데이터소스(`hands-on/10.rag/data/특허법.pdf`)를 Knowledge Graph + Vector로 인덱싱함.  
추출·요약·리포트 LLM은 Groq LPU `openai/gpt-oss-120b`를 유지하고,  
임베딩만 로컬(Ollama qwen3-embedding 4096d) → **OpenAI `text-embedding-3-small`(1536d)** 로 교체함.

- [특허법 GraphRAG 인덱싱 파이프라인 (KG + Vector)](#특허법-graphrag-인덱싱-파이프라인-kg--vector)
  - [1. 개요](#1-개요)
  - [2. 아키텍처](#2-아키텍처)
  - [3. 인덱싱 처리 흐름](#3-인덱싱-처리-흐름)
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
  - [9. 인덱싱 결과 (검증 완료)](#9-인덱싱-결과-검증-완료)

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| GraphRAG 프레임워크 | Microsoft GraphRAG 3.x (`graphrag` CLI + `graphrag.api`) |
| LLM (추출·요약·리포트) | Groq LPU `openai/gpt-oss-120b` (OpenAI 호환 API, 클라우드) |
| 임베딩 모델 | OpenAI `text-embedding-3-small` (1536차원, 클라우드) |
| 벡터 스토어 | LanceDB (로컬 파일) |
| 데이터소스 | `hands-on/10.rag/data/특허법.pdf` (단일 PDF) |
| API 키 | `hands-on/.env`의 `GROQ_API_KEY`, `OPENAI_API_KEY` |

> 제약: 로컬 AI 모델 사용 금지 — 임베딩·LLM 모두 클라우드 API를 사용함.  
> 특허법은 조문·권리·절차·요건 간 관계가 풍부하여 Knowledge Graph 구축이 효과적임.

---

## 2. 아키텍처

```
                          hands-on/.env
                    (GROQ_API_KEY, OPENAI_API_KEY)
                               │ load_dotenv (os.environ 상속)
                               ▼
  ┌──────────────┐   pdf_loader   ┌──────────────────┐   graphrag index --root .
  │ 특허법.pdf    │ ─────────────► │ data/input/*.txt │ ───────────────────────────┐
  │ (10.rag/data)│  PyPDFLoader   │ (조문 경계 청킹)  │                             │
  └──────────────┘  + clean_text  └──────────────────┘                             ▼
                                                          ┌───────────────────────────────────┐
                                                          │  Microsoft GraphRAG 파이프라인       │
                                                          │  ┌────────────────────────────────┐ │
   Groq LPU gpt-oss-120b ◄──── 엔티티/관계 추출 ─────────│─►│ extract_graph                  │ │
   (추출·요약·리포트)    ◄──── 커뮤니티 리포트 ──────────│─►│ create_communities (Leiden)    │ │
                                                          │  │ create_community_reports        │ │
   OpenAI text-embedding ◄──── 임베딩(1536d) ────────────│─►│ generate_text_embeddings        │ │
   -3-small (1536차원)                                    │  └────────────────────────────────┘ │
                                                          └──────────────────┬──────────────────┘
                                                                             ▼
                                          ┌──────────────────────────────────────────────────┐
                                          │ store/parquet/*.parquet                            │
                                          │   entities · relationships · communities ·         │
                                          │   community_reports · text_units · documents       │
                                          │ store/vector/graphrag/*.lance                      │
                                          │   entity_description · text_unit_text ·            │
                                          │   community_full_content (index_name 분리)         │
                                          └──────────────────┬─────────────────────────────────┘
                                                             ▼
                                                  validate_index.py (검증/보정)
```

---

## 3. 인덱싱 처리 흐름

```
                    ┌───────────── 특허법.pdf (단일 PDF) ──────────────┐
                    │                                                  │
  10.rag/data/      ▼                                                  │
  특허법.pdf  ┌─────────────────────┐   graphrag index --root .        │
  ───────────►│ 1. prepare_input     │──► data/input/특허법_NNNN.txt    │
              │  (PyPDFLoader 로드    │         │                       │
              │   + 노이즈 제거       │         ▼                       │
              │   + 조문 경계 청킹)   │   ┌──────────────────────┐      │
              └─────────────────────┘   │ 2. GraphRAG CLI       │      │
                                         │  엔티티/관계 추출      │      │
                                         │  → 커뮤니티(Leiden)    │      │
                                         │  → 커뮤니티 리포트     │      │
                                         │  → 임베딩(OpenAI)      │      │
                                         └──────────┬───────────┘      │
                                                    ▼                   │
                                     store/parquet/*.parquet            │
                                     store/vector/graphrag/*.lance      │
                                                    │                   │
                                                    ▼                   │
                                         ┌──────────────────────┐      │
                                         │ 3. verify_index       │      │
                                         │ 4. validate_index.py  │      │
                                         └──────────────────────┘      │
                    └─────────────────────────────────────────────────┘
```

| 단계 | 함수/스크립트 | 설명 |
|------|---------------|------|
| 1 | `pdf_loader.prepare_input()` | 특허법 PDF 로드 → 노이즈 제거 → 조문 경계 청킹 → `data/input/*.txt` |
| 2 | `index_documents.run_graphrag_index()` | `graphrag index --root .` 실행 (KG + Vector, 진행바 표시) |
| 3 | `index_documents.verify_index()` | `store/parquet` 산출물 존재·행 수 검증 |
| 4 | `validate_index.py` | 인덱싱 검증(CRITICAL/WARNING/INFO) + `--fix` 자동 보정 |

> GraphRAG 3.x는 3종 임베딩 테이블(`entity_description`/`text_unit_text`/`community_full_content`)을  
> 네이티브로 생성하며, OpenAI 임베딩은 로컬 OOM 위험이 없어 별도 후처리가 통상 불필요함.

---

## 4. 설정 옵션

### 4.1 settings.yaml 주요 옵션

| 키 | 값 | 설명 |
|----|----|----|
| `completion_models.default_completion_model.model` | `openai/gpt-oss-120b` | Groq LPU 생성 모델 (유지) |
| `completion_models.default_completion_model.model_provider` | `groq` | litellm Groq 프로바이더 |
| `completion_models...concurrent_requests` | `5` | Groq LPU 병렬 요청 수 |
| `completion_models...retry.type` | `exponential_backoff` | 추출 단계 실패 시 지수 백오프 재시도 |
| `embedding_models.default_embedding_model.model_provider` | `openai` | OpenAI 프로바이더 (클라우드) |
| `embedding_models.default_embedding_model.model` | `text-embedding-3-small` | 임베딩 모델(1536차원) |
| `chunking.size` / `overlap` | `2500` / `100` | GraphRAG 토큰 청킹 (입력 청크가 작아 재분할 안 됨) |
| `extract_graph.entity_types` | `[concept, legal_provision, right, procedure, organization, requirement, person, period]` | 특허법 도메인 엔티티 |
| `extract_graph.max_gleanings` | `0` | 재추출 비활성화(속도 약 2배) |
| `output_storage.base_dir` | `store/parquet` | Parquet 출력 경로 (--root 하위) |
| `vector_store.db_uri` | `store/vector/graphrag` | GraphRAG LanceDB 경로 |
| `vector_store.index_schema` | 3종 index_name 분리 | `entity_description`/`text_unit_text`/`community_full_content` (충돌 방지: MUST) |
| `vector_store...vector_size` | `1536` | 임베딩 차원 (모델 실제 차원으로 자동 검증·보정됨) |
| `community_reports` | 활성화 | Global/DRIFT Search용 리포트(Groq 지원, MUST) |
| `snapshots.graphml` | `false` | 시각화 파일 생략(속도 향상) |

> `--root`가 `indexing/graphrag/`이므로 `store`는 이 디렉터리 하위에 생성됨.

### 4.2 실행 옵션

| 명령 | 설명 |
|------|------|
| `python index_documents.py` | 전체 인덱싱 (특허법 PDF 전체) |
| `python index_documents.py --force` | 인덱스 초기화 후 재인덱싱 |
| `python index_documents.py --limit 4` | 앞쪽 4개 청크만 인덱싱 (파이프라인 검증 슬라이스) |

---

## 5. 주요 소스 설명

| 파일 | 역할 |
|------|------|
| `settings.yaml` | GraphRAG CLI 설정 (모델·청킹·스토리지·엔티티 타입·커뮤니티 리포트) |
| `index_documents.py` | 인덱싱 메인 (입력 준비 → CLI 인덱싱 → 검증 → 후처리) |
| `pdf_loader.py` | 특허법 PDF 로드·정제·조문 경계 청킹 → `data/input/*.txt` 내보내기 |
| `validate_index.py` | 인덱싱 검증(CRITICAL/WARNING/INFO) + `--fix` 자동 보정 |
| `config/settings.py` | 경로·상수 정의 (settings.yaml 값 재사용, `.env` 로드) |
| `utils/` | logger, helpers (디렉터리 생성) |

---

## 6. 디렉터리 구조

```
hands-on/16.mas/patent-mas/indexing/graphrag/
├── settings.yaml          # GraphRAG CLI 설정
├── index_documents.py     # 인덱싱 메인
├── pdf_loader.py          # 특허법 PDF → txt 변환기
├── validate_index.py      # 검증/보정 도구
├── requirements.txt
├── README.md              # 본 문서
├── config/settings.py     # 경로·상수
├── utils/                 # logger, helpers
├── check/                 # 검증 리포트 저장 (자동 생성)
├── cache/                 # GraphRAG LLM 응답 캐시 (자동 생성)
├── logs/                  # GraphRAG 실행 로그 (자동 생성)
├── data/input/            # 특허법 txt 입력 (자동 생성)
└── store/
    ├── parquet/           # GraphRAG Parquet 산출물 (entities, relationships, ...)
    └── vector/graphrag/   # LanceDB (entity_description, text_unit_text, community_full_content)
```

---

## 7. 가상환경 설정 및 실행

### 7.1 사전 준비

```bash
# hands-on/.env 에 API 키 설정 (이미 설정되어 있으면 생략)
GROQ_API_KEY=gsk_...
OPENAI_API_KEY=sk-...
```

### 7.2 가상환경 설정 (Windows / PowerShell)
```powershell
cd hands-on/16.mas/patent-mas/indexing/graphrag
python -m venv venv
venv\Scripts\Activate.ps1
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

### 7.3 가상환경 설정 (Windows / GitBash)
```bash
cd hands-on/16.mas/patent-mas/indexing/graphrag
python -m venv venv
source venv/Scripts/activate
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

### 7.4 가상환경 설정 (macOS / Linux)
```bash
cd hands-on/16.mas/patent-mas/indexing/graphrag
python -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

### 7.5 실행 예시

```bash
# 슬라이스 인덱싱 (앞쪽 4개 청크) — 최초 동작 확인 권장
python index_documents.py --limit 4 --force

# 전체 인덱싱
python index_documents.py

# 인덱스 초기화 후 재인덱싱
python index_documents.py --force

# 인덱싱 검증
python validate_index.py

# 검증 + 자동 보정 (엔티티 임베딩·community_full_content 누락 시)
python validate_index.py --fix
```

---

## 8. 검증/보정

`validate_index.py`는 심각도별로 인덱싱 결과를 검증함.

| 심각도 | 항목(예) | 의미 |
|--------|----------|------|
| CRITICAL | C1 엔티티, C2 관계, C3 엔티티 임베딩, C4 entity_description 테이블 | 없으면 검색 불가 → 재인덱싱 권고 |
| WARNING | W1 텍스트유닛, W2 커뮤니티, W3 리포트, W4 LanceDB, W4b/W9 community_full_content, W5 description, W6 임베딩 차원, W8 text_unit_text | 일부 기능 영향 |
| INFO | I1 고아 엔티티 비율 | 참고 통계 |

자동 보정(`--fix`)은 `finalize_indexing` 모듈이 있을 때만 동작함:
- **C3**: 엔티티 임베딩 누락 → OpenAI로 수동 생성
- **W4b**: `community_full_content` 테이블 누락 → 커뮤니티 리포트 임베딩 + 테이블 생성
- **W5**: 빈 `description` → `title` 값으로 채움

검증 결과는 `check/validation_<타임스탬프>.txt`로 저장됨.  
종료 코드: CRITICAL 발견=2, WARNING 발견=1, 정상=0.

> GraphRAG 3.x + OpenAI 임베딩은 3종 임베딩 테이블을 네이티브로 안정 생성하므로  
> `finalize_indexing` 모듈은 기본 제공하지 않음. 부분 실패가 잦은 환경에서만 추가 작성하면 됨.

---

## 9. 인덱싱 결과 (검증 완료)

특허법.pdf 전체(68페이지 → 86 청크)를 인덱싱한 실측 결과임. `validate_index.py` 종료 코드 0(이슈 없음).

| 산출물 | 수량 | 비고 |
|--------|------|------|
| 엔티티 | 1,122 | LEGAL_PROVISION 585 · CONCEPT 155 · PERIOD 109 · PROCEDURE 97 · REQUIREMENT 60 · PERSON 42 · RIGHT 36 · ORGANIZATION 36 |
| 관계 | 1,242 | 조문↔개념↔권리 간 관계 |
| 커뮤니티 | 182 | Leiden 군집 |
| 커뮤니티 리포트 | 181 | Global/DRIFT Search용 |
| 텍스트 유닛 | 86 | 조문 경계 청크 |
| LanceDB 테이블 | 3종 | `entity_description`(1,122) · `text_unit_text`(86) · `community_full_content`(181), **모두 1536차원** |

### (중요) gpt-oss 추출 출력 잘림 대응

특허법은 조문당 엔티티가 많고 설명이 길어, 기본 출력 토큰 한도(약 3,072)에서 엔티티 나열 도중  
출력이 잘리면 관계(relationships) 섹션에 도달하지 못해 `No relationships detected`로 파이프라인이 중단됨.  
이를 막기 위해 `settings.yaml`의 완성 모델에 `call_args.max_tokens: 16000`(출력 한도 상향)과  
`call_args.reasoning_effort: low`(gpt-oss reasoning 토큰 최소화)를 지정함.  
재추출 실패에 대비해 두 모델 모두 `retry.type: exponential_backoff`(지수 백오프)를 유지함.
