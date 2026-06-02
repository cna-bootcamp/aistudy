# RAGAS 청킹 사이즈 스윕 평가 예제

인덱싱 파라미터인 **청킹 사이즈(chunk_size)를 변화시키며** naive RAG의 검색·생성 품질을 RAGAS로  
평가·비교하여 **최적 청킹 사이즈를 도출**하는 예제임. 교재 1. 핵심 원칙(한 번에 하나의 변수만 변경)과  
2.5 파라미터 최적화(RAGAS + Grid Search)의 구체적 구현에 해당함.

## 개요

| 항목 | 내용 |
|------|------|
| 목적 | chunk_size별 RAG 품질 비교 → 최적 청킹 사이즈 선정 |
| 변화 변수 | `chunk_size` (기본 후보 400 / 800 / 1200) |
| 고정 규칙 | `chunk_overlap = int(chunk_size × 0.2)` (청킹 사이즈의 20%) |
| 고정 조건 | 임베딩 모델·`LAW_SEPARATORS`·`top_k`·생성 LLM 전부 동일 |
| 대상 문서 | 대한민국 특허법 PDF (`../data/특허법.pdf`) |
| RAG 생성 LLM | Groq LPU `openai/gpt-oss-120b` (naive와 동일) |
| RAGAS 평가자 LLM | OpenAI `gpt-4o-mini` |
| RAGAS 임베딩 | OpenAI `text-embedding-3-small` (인덱싱과 동일) |

> **왜 공용 벡터 DB를 쓰지 않는가?**  
> 청킹 사이즈를 바꾸려면 문서를 **다시 청킹·임베딩**해야 함. 따라서 후보마다 임시 벡터 DB를 새로  
> 만들어 평가하며, 공용 DB(`../vectordb`)는 **읽지도 덮어쓰지도 않음**(다른 예제가 의존하므로 보호).

## 처리 흐름

```
[준비] 테스트셋 로드 → PDF 로드·전처리(1회) → 생성 LLM(Groq)·평가자 LLM(OpenAI) 초기화
   │
   ▼
chunk_size 후보별 반복 (예: 400 → 800 → 1200)
   │   ├─ 재청킹      split_documents_with()  : overlap = int(size × 0.2), LAW_SEPARATORS 재사용
   │   ├─ 노이즈 필터 filter_chunks()         : indexing.py 로직 재사용
   │   ├─ 임시 인덱싱 build_temp_index()      : %TEMP%에 고유 컬렉션(patent_law_csXXX)으로 임베딩
   │   ├─ RAG 실행    run_rag_pipeline()      : 검색(Top K) → 생성(Groq)
   │   ├─ RAGAS 평가  evaluate_chunk_size()   : 평가자 LLM(gpt-4o-mini)으로 메트릭 계산
   │   └─ 임시 정리   cleanup_temp_index()    : 임시 DB 삭제(공용 DB 무관)
   ▼
[비교] chunk_size별 종합 점수 → 최적값 선정 → results/ 저장(summary·detail·comparison)
```

## 평가 메트릭

### 검색(Retrieval) — 모두 정답(reference) 기반으로 청킹의 "검색" 효과를 분리 측정

| 메트릭 | 설명 | 해석 |
|--------|------|------|
| **Context Precision** | 검색 청크가 정답과 관련 있는 비율 (`LLMContextPrecisionWithReference`) | 높을수록 노이즈 적음 |
| **Context Recall** | 정답에 필요한 정보가 검색되었는지 | 높을수록 누락 적음 |
| **Context Entity Recall** | 정답의 핵심 엔티티가 검색되었는지 | 높을수록 핵심 정보 포착 |

> **Context Precision은 `WithReference` 버전을 사용함**  
> 정답이 아닌 *생성 답변* 기준으로 점수를 매기는 `WithoutReference`는 생성 품질이 섞여 청킹 비교를  
> 흐림. 본 예제는 `ground_truth`가 있으므로 정답 기준 버전으로 검색 효과만 분리함.

### 생성(Generation)

| 메트릭 | 설명 | 해석 |
|--------|------|------|
| **Faithfulness** | 답변이 검색 컨텍스트에 근거하는지 | 높을수록 환각 적음 |
| **Answer Relevancy** | 답변이 질문과 관련 있는지 | 높을수록 적절한 답변 |
| **Factual Correctness** | 답변이 정답과 사실적으로 일치하는지 | 높을수록 정확 |

> 모든 점수는 0.0 ~ 1.0 범위이며 1.0에 가까울수록 좋음.

### 최적 청킹 사이즈 선정 기준

chunk_size는 **검색 품질에 직접 영향**을 주므로, 검색 메트릭 3종(reference 기반)의 평균을 **종합 점수**로  
삼아 가장 높은 chunk_size를 최적값으로 선정함. (`--generation`만 실행한 경우에는 생성 메트릭 평균 사용)  
선정과 무관하게 6개 메트릭 전체를 비교 표로 출력·저장함.

## 소스 코드 설명

전체 코드는 [evaluate_ragas.py](evaluate_ragas.py)에 있음. 주요 함수는 다음과 같음.

### 재사용 모듈 (동일 조건 보장)

- `indexing.py`에서 `load_pdfs` · `preprocess_documents` · `filter_chunks` · `attach_metadata` ·  
  `LAW_SEPARATORS` · `EMBEDDING_MODEL`을 가져와 **인덱싱 로직을 동일하게** 유지함.
- `naive_rag.py`에서 `create_llm`(Groq) · `format_docs` · `SYSTEM_PROMPT` · `HUMAN_PROMPT` · `TOP_K`를  
  가져와 **생성 파이프라인을 naive와 동일하게** 유지함.
- ⚠️ `indexing.py`의 `build_vectordb()`는 `shutil.rmtree`로 대상 디렉터리를 통째 삭제하므로 **재사용하지 않음**  
  (공용 DB 파괴 방지). 대신 임시 디렉터리 전용 `build_temp_index()`를 별도 구현함.

### `split_documents_with(documents, chunk_size, chunk_overlap)`

`chunk_size`·`chunk_overlap`을 인자로 받는 분할기. `indexing.py`의 `split_documents()`는 모듈 상수를  
읽어 고정 크기로만 분할하므로 스윕에 쓸 수 없어, 동일한 `LAW_SEPARATORS`로 크기만 파라미터화함.

### `build_temp_index(chunks, chunk_size)` / `cleanup_temp_index(...)`

- `build_temp_index`: `tempfile.mkdtemp`로 만든 **OS 임시 폴더**에 고유 컬렉션명(`patent_law_csXXX`)으로  
  임베딩·저장함. 임시 경로가 공용 DB 경로와 같으면 즉시 중단하는 방어 장치를 둠.
- `cleanup_temp_index`: Windows에서 ChromaDB(SQLite)가 파일 핸들을 늦게 놓아 `rmtree`가 실패할 수 있어,  
  참조 해제 + `gc` 회수 후 최대 3회 재시도하고, 끝내 실패하면 경고만 남기고 스윕을 계속함.

### `run_rag_pipeline(questions, retriever, chain)`

각 질문에 대해 검색(Top K)→생성을 수행하여 `(질문, 검색 컨텍스트, 답변)`을 모음.  
생성 호출은 `invoke_with_retry`로 감싸 Groq 분당 한도 등 일시 오류 시 지수 백오프 재시도함.

### `select_metrics(eval_type)` / `evaluate_chunk_size(...)` / `extract_scores(result)`

- `select_metrics`: `all`/`retrieval`/`generation`에 맞는 RAGAS 메트릭 인스턴스 목록 반환.
- `evaluate_chunk_size`: `SingleTurnSample`(질문·검색컨텍스트·답변·정답)을 묶은 `EvaluationDataset`을  
  `evaluate()`로 평가.
- `extract_scores`: `result.to_pandas()`에서 메트릭 컬럼만 골라 NaN 제외 평균을 냄(버전 호환).

### `compute_selection_score(...)` / `print_comparison(...)` / `save_results(...)`

종합 점수 계산 → 비교 표 출력 → `results/{timestamp}/`에 chunk_size별 `summary.json`·`detail.csv`와  
전체 `comparison.json`·`comparison.csv` 저장.

## 사전 요구사항

> 1. **테스트 데이터셋(11.1)**: `test_dataset.py`가 같은 디렉터리에 있어야 함 (질문·정답).  
> 2. **인덱싱 대상 PDF**: `../data/특허법.pdf`가 존재해야 함 (스크립트가 직접 청킹·임베딩함).  
> 3. **재사용 모듈**: `../indexing/indexing.py`, `../naive/naive_rag.py`가 존재해야 함(로직 import).  
> 4. **API 키** (`hands-on/.env`): `OPENAI_API_KEY`(임베딩·평가자 LLM)와 `GROQ_API_KEY`(생성 LLM).

> ℹ️ 공용 벡터 DB(`../vectordb`)는 **필요 없음** — 본 예제는 chunk_size마다 PDF를 직접 재인덱싱함.

## 가상환경 설정 및 실행 방법

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\11.rag-tuning\ragas
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/11.rag-tuning/ragas
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/11.rag-tuning/ragas
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 실행

```bash
# 기본 후보(400,800,1200) 전체(검색+생성) 평가
python evaluate_ragas.py

# 검색 메트릭만 / 생성 메트릭만
python evaluate_ragas.py --retrieval
python evaluate_ragas.py --generation

# chunk_size 후보 재정의
python evaluate_ragas.py --chunk-sizes 500,1000

# 저비용 스모크 테스트 (테스트 케이스 수 제한)
python evaluate_ragas.py --chunk-sizes 400 --limit 2
```

> ⚠️ **비용·시간 주의**  
> chunk_size 후보 수 N배만큼 인덱싱·임베딩·RAG·평가가 반복됨. 기본 3개 후보 × 22개 케이스는  
> Groq 생성 약 66회 + 평가자 LLM 다수 호출이 발생함. 처음에는 `--chunk-sizes 400 --limit 2`로  
> 파이프라인을 가볍게 검증한 뒤 전체 스윕을 실행하는 것을 권장함.

### 실행 결과 예시 (스모크 테스트 `--chunk-sizes 400,800 --limit 2` 실제 출력 발췌)

```
======================================================================
RAGAS 청킹 사이즈 스윕 평가
  평가 유형 : all  |  chunk_size 후보 : [400, 800]  |  overlap : 20% 고정
======================================================================

[준비] 테스트 케이스 2개 로드
[준비] PDF 로드 및 전처리 (1회)
  - 특허법.pdf: 68페이지 로드
  - 전처리 후 페이지 수: 68
[준비] 생성 LLM(Groq) · 평가자 LLM(OpenAI gpt-4o-mini) 초기화

----------------------------------------------------------------------
[chunk_size=400] overlap=80 — 인덱싱→RAG→평가
  - 생성된 청크 수: 521
  [chunk_size=400, overlap=80] 점수
    - 검색: Context Precision 0.5000, Context Recall 0.5000, Context Entity Recall 0.2500
    - 생성: Faithfulness 0.5000, Answer Relevancy 0.1034, Factual Correctness 0.4000

----------------------------------------------------------------------
[chunk_size=800] overlap=160 — 인덱싱→RAG→평가
  - 생성된 청크 수: 245
  [chunk_size=800, overlap=160] 점수
    - 검색: Context Precision 0.6667, Context Recall 1.0000, Context Entity Recall 0.3750
    - 생성: Faithfulness 1.0000, Answer Relevancy 0.3524, Factual Correctness 1.0000

======================================================================
청킹 사이즈별 비교 결과
======================================================================
선정 기준: 검색 메트릭 평균 (chunk_size는 검색 품질에 직접 영향)
----------------------------------------------------------------------
   chunk_size | overlap |     종합점수 | 비고
----------------------------------------------------------------------
          400 |      80 |   0.4167 |
          800 |     160 |   0.6806 | ← 최적
======================================================================
최적 청킹 사이즈: 800 (overlap=160)
```

> 위는 2개 케이스만 사용한 스모크 테스트 출력임. 표본이 작아 점수가 거칠지만, chunk_size=800이  
> 400보다 검색 품질이 높게 나오는 경향을 보여줌. 전체 22개 케이스 × 3개 후보로 실행하면 더 안정적인  
> 비교가 가능함. (전체 메트릭은 `results/{timestamp}/comparison.csv`에 저장됨)

> **참고 — 알려진 동작**  
> - `ragas`가 import 시 제거된 langchain 경로(`...chat_models.vertexai`)를 참조하여 `evaluate_ragas.py`  
>   상단에서 더미 모듈을 주입하는 호환 셰임을 둠(평가에는 Vertex AI를 쓰지 않음).  
> - 평가 중 `LLM returned 1 generations instead of requested 3` 경고는 RAGAS가 Answer Relevancy 계산 시  
>   다중 생성을 요청하나 평가자 LLM이 1개만 반환해 발생함. 점수는 정상 산출되며 동작에 영향 없음.

## 결과 해석 및 최적값 선정 가이드

### 점수 범위 해석

| 점수 범위 | 해석 |
|-----------|------|
| 0.9 ~ 1.0 | 매우 우수 |
| 0.7 ~ 0.9 | 양호 |
| 0.5 ~ 0.7 | 개선 필요 |
| 0.0 ~ 0.5 | 심각한 문제 |

### 청킹 사이즈와 메트릭의 관계

| 현상 | 해석 / 대응 |
|------|------------|
| 작은 chunk에서 Context Precision↑·Recall↓ | 청크가 정밀하나 정답이 여러 청크에 흩어져 누락 → Top-K 증가 검토 |
| 큰 chunk에서 Recall↑·Precision↓ | 관련 정보를 포함하나 노이즈가 늘어 정밀도 하락 → 리랭킹 검토 |
| chunk가 과도하게 크면 Faithfulness↓ | 컨텍스트가 길어 LLM이 근거를 벗어나기 쉬움 |
| 종합 점수가 후보 간 큰 차이 없음 | 문서 구조가 견고함 → 비용 낮은(큰) chunk_size 선택 가능 |

### 다음 단계

- 최적 chunk_size를 확정했다면 `--chunk-sizes`로 그 주변값(예: 최적이 800이면 700,800,900)을  
  좁혀 재탐색하면 더 정밀하게 최적화 가능함.
- chunk_size 외 파라미터(Top-K, 리랭킹 등)는 **한 번에 하나씩** 바꿔가며 동일 방식으로 평가함  
  (교재 1. 핵심 원칙).

## 참고 자료

- [RAG 품질 튜닝 가이드](../../../agentic-ai/textbook/11.RAG%20품질%20튜닝.md) (8.1 RAGAS, 2.5 파라미터 최적화)
- [RAGAS 공식 문서](https://docs.ragas.io/)
- [RAGAS GitHub](https://github.com/explodinggradients/ragas)
