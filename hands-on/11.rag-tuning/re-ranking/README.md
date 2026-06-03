# 특허법 RAG (Re-ranking / LangChain Compressor 방식)

`10.rag/re-ranking` 예제를 **LangChain 통합 프레임워크(교재 7.5)**로 재구성한 버전임.  
검색 품질을 높이는 Cross-Encoder Re-ranking 로직은 동일하나, `FlagReranker`를 직접 호출하던 수동 2단계 코드를  
**`ContextualCompressionRetriever` + `CrossEncoderReranker`(Compressor)**로 대체하여 "1차 검색 → 재정렬 → 압축"을  
하나의 retriever로 묶음.

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| 입력 | 공용 벡터 DB `hands-on/10.rag/vectordb` (8.0 인덱싱으로 구축, 재사용) |
| 컬렉션명 | `patent_law` (인덱싱이 저장한 이름과 반드시 일치) |
| 쿼리 임베딩 | OpenAI `text-embedding-3-small` (1536차원, 인덱싱 시와 동일 모델) |
| Re-ranking 모델 | `dragonkue/bge-reranker-v2-m3-ko` (한국어 최적화 Cross-Encoder) |
| Re-ranking 경유 | `HuggingFaceCrossEncoder` → `CrossEncoderReranker` (LangChain Compressor) |
| LLM | Groq LPU `openai/gpt-oss-120b` |
| 1차 검색 수 | `INITIAL_K = 50` |
| 최종 문서 수 | `RERANK_K = 5` (= `CrossEncoderReranker(top_n=5)`) |

> **재인덱싱 없음**: 코퍼스는 이미 임베딩되어 저장돼 있으므로 다시 임베딩하지 않음.  
> 다만 **쿼리**는 검색을 위해 인덱싱 시와 동일한 임베딩 모델로 벡터화해야 함(Dense Retrieval의 본질).

---

## 2. `10.rag/re-ranking`(수동 방식)과의 차이

| 구분 | 10.rag/re-ranking (수동) | 본 예제 (Compressor) |
|------|--------------------------|----------------------|
| 1차 검색 | `vectorstore.similarity_search(k=50)` | `vectorstore.as_retriever(search_kwargs={"k": 50})` |
| 리랭커 로드 | `FlagEmbedding.FlagReranker(...)` | `HuggingFaceCrossEncoder(model_name=...)` |
| 재정렬 | `reranker.compute_score(pairs)` + 수동 정렬·슬라이싱 | `CrossEncoderReranker(model, top_n=5)` |
| 통합 | 검색·재정렬을 별도 함수로 직접 호출 | `ContextualCompressionRetriever.invoke()` 한 번에 |
| 리랭크 교체 | 리랭커 코드 전반 수정 필요 | `base_compressor`만 교체 (ColBERT·Cohere 등) |
| 의존성 | `FlagEmbedding`, `transformers<5.0` | `langchain-community`, `sentence-transformers` |

> **결과는 동일**: 두 방식 모두 `dragonkue/bge-reranker-v2-m3-ko`로 점수를 내므로 재정렬 순위와 점수가 동일함  
> (아래 6. 실행 결과 예시 참고). 차이는 **코드 구조와 추상화 수준**일 뿐임.

---

## 3. 처리 흐름

```
질문 → [1차 검색] base_retriever Top-50 → [Re-ranking] CrossEncoderReranker Top-5 → [답변 생성] LLM
        ↑ 빠름·넓게(recall)               ↑ 느림·정밀(precision)                      ↑ Top-5만 컨텍스트로 사용
        └─────────── ContextualCompressionRetriever.invoke()가 ①+② 통합 수행 ───────────┘
```

| 단계 | 함수 | 설명 |
|------|------|------|
| 준비 | `load_vectorstore()` | 공용 벡터 DB를 컬렉션명 `patent_law`로 로드. 적재 건수 0이면 연결 실패로 보고 중단 |
| 준비 | `load_compressor()` | `HuggingFaceCrossEncoder` 로드 + `CrossEncoderReranker(top_n=5)` 구성 |
| 준비 | `build_compression_retriever()` | `base_retriever`(k=50)를 Compressor로 감싼 `ContextualCompressionRetriever` 구성 |
| 준비 | `load_llm()` | Groq `openai/gpt-oss-120b` LLM 초기화 |
| 1단계 | `retrieve_initial()` | retriever 내부 `base_retriever`로 상위 50건을 추출(재정렬 '전' 상태 노출용) |
| 2단계 | `rerank_with_scores()` | `retriever.invoke()`로 검색→재정렬→Top-5 압축 후, 표시용 점수를 `model.score()`로 부착 |
| 3단계 | `build_chain()` → `chain.invoke()` | 재정렬 Top-5를 컨텍스트로 LLM이 답변 생성 |

> **왜 1차 검색을 따로 호출하나?**  
> `ContextualCompressionRetriever.invoke()`는 최종 Top-5만 반환하여 "1차 순위 → 재정렬 순위" 변화를 알 수 없음.  
> 교육 목적으로 재정렬 효과(▲▼)를 보여주기 위해, 내부 `base_retriever`를 꺼내 1차 결과를 별도로 노출함.  
> (`base_retriever`는 결정적이므로 두 호출의 1차 검색 결과가 동일 → `(source, chunk_index)` 키로 대응 가능)

---

## 4. 주요 함수

- **`load_vectorstore()`**: 공용 벡터 DB를 임베딩 없이 로드함. `collection_name="patent_law"`를 **반드시 명시**  
  (미명시 시 langchain_chroma 기본값 `langchain`으로 빈 컬렉션이 오류 없이 열려 검색 0건이 되는 침묵 실패 발생).
- **`load_compressor()`**: `HuggingFaceCrossEncoder`로 Cross-Encoder를 로드하고 `CrossEncoderReranker(top_n=5)`로 감쌈.  
  `(model, compressor)`를 함께 반환 — `model`은 점수 표시용, `compressor`는 retriever 구성용.
- **`build_compression_retriever()`**: `as_retriever(k=50)`를 `base_retriever`로, `compressor`를 `base_compressor`로 하는  
  `ContextualCompressionRetriever`를 구성. **리랭크 방식 교체 시 `base_compressor`만 변경**하면 됨.
- **`retrieve_initial()`**: `retriever.base_retriever.invoke(query)`로 1차 후보(Top-50)를 순위 순으로 반환.
- **`rerank_with_scores()`**: `retriever.invoke(query)`로 압축 Top-5를 얻고, `model.score()`로 0~1 관련도 점수를 부착.  
  각 결과에 **1차 검색 순위**를 함께 담아 재정렬에 따른 순위 변화를 출력 단계에서 비교함.
- **`build_chain()`**: `프롬프트 | LLM | StrOutputParser`의 LCEL 체인을 구성.
- **`run_query()`**: 1차 검색 → Re-ranking(Compressor) → 답변 생성의 전체 흐름을 1회 수행.

---

## 5. 가상환경 설정 및 실행

> **중요(PyTorch/Windows)**: Re-ranker는 PyTorch 기반임. Windows에서는 전역 CUDA PyTorch를 공유하기 위해  
> 가상환경 생성 시 `--system-site-packages` 옵션을 **반드시** 추가함. 미적용 시 CPU 빌드가 설치되어 GPU 미인식 발생.  
> macOS는 `--system-site-packages` 없이도 동작함(MPS 자동 지원).

### PyTorch 설치 가이드 (Windows, 최초 1회)

가상환경 생성 전에 전역 Python에 CUDA 빌드 PyTorch가 설치돼 있어야 함.

1. CUDA 버전 확인: 터미널에서 `nvidia-smi` 실행 → 우측 상단 `CUDA Version` 확인  
2. 설치 가이드 참조: <https://github.com/cna-bootcamp/aistudy/blob/main/agentic-ai/reference/install-pytorch.md>  
3. 설치 검증: `python -c "import torch; print(torch.__version__, torch.cuda.is_available())"` → `True`면 정상

### 가상환경 설정 (Windows / PowerShell)
```powershell
cd hands-on/11.rag-tuning/re-ranking
python -m venv venv --system-site-packages
venv\Scripts\Activate.ps1
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)
```bash
cd hands-on/11.rag-tuning/re-ranking
python -m venv venv --system-site-packages
source venv/Scripts/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)
```bash
cd hands-on/11.rag-tuning/re-ranking
python -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

### 환경변수

`hands-on/.env`에 아래 키가 필요함.
```
OPENAI_API_KEY=sk-...     # 쿼리 임베딩 (text-embedding-3-small)
GROQ_API_KEY=gsk_...      # LLM (openai/gpt-oss-120b)
```

### 실행
```bash
python app.py
```

- 기본 질의어(`특허를 받을 수 있는 조건은 ?`)로 전체 파이프라인을 1회 시연한 뒤 대화형 입력 루프로 진입함.  
- 종료: `quit` / `q` / 빈 줄 입력.  
- **최초 실행 시** Re-ranker 모델(약 2GB) 다운로드로 수 분 소요될 수 있음(이후 캐시 재사용).  
- 선행 조건: 공용 벡터 DB(`hands-on/10.rag/vectordb`)가 존재해야 함(없으면 8.0 인덱싱 먼저 실행).

---

## 6. 실행 결과 예시

```
======================================================================
특허법 RAG 예제 (Re-ranking / LangChain Compressor)
설정: 1차 검색 Top-50 → Compressor 재정렬 → Top-5 / LLM: openai/gpt-oss-120b
======================================================================

[준비] 리소스 로드
  - 공용 벡터 DB 로드 완료: 컬렉션 'patent_law', 저장 벡터 246건
  - Re-ranker 로드: dragonkue/bge-reranker-v2-m3-ko

질문: 특허를 받을 수 있는 조건은 ?

----------------------------------------------------------------------
[1차 검색] base_retriever Top-50 (상위 10건 미리보기)
----------------------------------------------------------------------
   1. 특허법.pdf #32: 제37조(특허를 받을 수 있는 권리의 이전 등) ...
   2. 특허법.pdf #68: 제62조(특허거절결정) 심사관은 특허출원이 ...
   ...
   5. 특허법.pdf #20: 제29조(특허요건) ① 산업상 이용할 수 있는 발명으로서 ...

======================================================================
[Re-ranking] Compressor Top-5 (1차 순위 → 재정렬 순위)
======================================================================
  1. (1차  5위 ▲4) [점수 0.9998] 특허법.pdf #20
     제29조(특허요건) ① 산업상 이용할 수 있는 발명으로서 ...
  2. (1차  2위 ─) [점수 0.9729] 특허법.pdf #68
     제62조(특허거절결정) ...
  3. (1차  7위 ▲4) [점수 0.9630] 특허법.pdf #35
     제42조(특허출원) ...
  4. (1차 46위 ▲42) [점수 0.9168] 특허법.pdf #27
     제32조(특허를 받을 수 없는 발명) ...
  5. (1차 10위 ▲5) [점수 0.9116] 특허법.pdf #41
     제44조(공동출원) ...

답변 생성 중...

----------------------------------------------------------------------
특허를 받으려면 다음과 같은 기본 조건을 모두 충족해야 합니다.
1. 산업적으로 이용할 수 있는 발명이어야 함 (특허법 제29조)
2. 새로워야 함(신규성) (특허법 제29조)
3. 공공질서·선량한 풍속에 반하지 않아야 함 (특허법 제32조)
4. 특허를 받을 권리가 있는 사람이어야 함 (특허법 제33조)
5. 정해진 양식대로 출원서를 제출해야 함 (특허법 제42조)
...
----------------------------------------------------------------------
```

> **재정렬 효과 관찰 포인트**:  
> 가장 핵심 조문인 **제29조(특허요건)**가 1차 5위 → **1위**(점수 0.9998)로 상승함.  
> 특히 **제32조(특허를 받을 수 없는 발명)**는 1차 **46위 → 4위(▲42)**로 회복됨 —  
> Naive RAG처럼 1차 Top-5만 사용했다면 **누락**되었을 문서를 Re-ranking이 끌어올린 사례임.  
> 이 순위·점수는 `10.rag/re-ranking`(FlagReranker 방식)과 동일함 — Compressor는 코드 구조만 바꿀 뿐 결과는 같음.

---

## 7. 리랭크 방식 교체 (확장 포인트)

`ContextualCompressionRetriever`의 장점은 **`base_compressor`만 바꾸면 리랭크 방식이 바뀐다**는 점임.

```python
# 현재: 로컬 Cross-Encoder
from langchain_classic.retrievers.document_compressors import CrossEncoderReranker
compressor = CrossEncoderReranker(model=model, top_n=5)

# Cohere API 리랭커로 교체하려면 compressor만 변경
# from langchain_cohere import CohereRerank
# compressor = CohereRerank(model="rerank-multilingual-v3.0", top_n=5)

# LLM 기반 압축(불필요 문장 제거)으로 교체하려면
# from langchain_classic.retrievers.document_compressors import LLMChainExtractor
# compressor = LLMChainExtractor.from_llm(llm)

# 나머지(build_compression_retriever)는 그대로 — base_compressor 인자만 교체됨
```

---

## 8. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 검색 0건 / "문서에서 찾을 수 없습니다" | `collection_name` 미지정으로 빈 컬렉션 연결 | `collection_name="patent_law"` 확인 (코드에 반영됨) |
| GPU 미인식 (CPU로 느림) | venv가 전역 CUDA torch를 공유하지 않음 | venv를 `--system-site-packages`로 재생성 |
| `No module named 'langchain.retrievers'` | langchain 1.x에서 클래식 retriever가 `langchain_classic`로 이동 | `from langchain_classic.retrievers ...` 사용 (코드에 반영됨) |
| 점수가 `None`으로 표시 | `ContextualCompressionRetriever`는 관련도 점수를 메타데이터로 노출하지 않음 | 표시용 점수를 `model.score()`로 별도 계산 (코드에 반영됨) |
| 종료 시 Segmentation fault(exit 139) | torch·onnxruntime의 OpenMP 런타임 중복 로드 (Windows 종료 시점 간헐 발생) | `KMP_DUPLICATE_LIB_OK=TRUE` 완화책 적용 (코드 상단). 답변은 종료 전에 출력되므로 결과에는 영향 없음 |
