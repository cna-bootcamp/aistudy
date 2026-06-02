# Hybrid Search RAG 예제 (BM25 + Dense)

8.0 인덱싱으로 구축된 공용 벡터 DB를 **재임베딩 없이** 로드하여, **BM25(Sparse) 키워드 검색**과  
**임베딩(Dense) 의미 검색**을 `EnsembleRetriever`로 융합(Hybrid Search)한 RAG 예제임.  
Naive RAG(8.1)의 의미 검색 단독 구조를 개선하여, 정확한 키워드 매칭과 의미 유사도의 장점을 모두 수용함.

## 개요

| 항목 | 내용 |
|------|------|
| 패턴 | Hybrid Search (Sparse + Dense → RRF 융합) |
| Sparse 검색 | BM25 (키워드 빈도 기반, 임베딩 불필요) + 한국어 형태소 토크나이저(kiwipiepy) |
| Dense 검색 | 질의 임베딩 기반 유사도 검색 |
| 융합기 | `langchain_classic.retrievers.EnsembleRetriever` (가중치 + RRF) |
| 가중치 | Dense 0.5 / BM25 0.5 (균형, 교재 기본값) |
| 벡터 DB | ChromaDB (공용 `../vectordb`, 컬렉션 `patent_law`, 246개 벡터) |
| 질의 임베딩 | OpenAI `text-embedding-3-small` (1536차원, 인덱싱과 동일) |
| LLM | Groq LPU `openai/gpt-oss-120b` (추론 모델) |
| 대상 문서 | 대한민국 특허법 PDF |

> **"임베딩하지 않음"의 의미**  
> 문서를 다시 인덱싱(임베딩 후 저장)하지 않는다는 뜻임. Dense 검색은 질의어를 벡터로 바꿔  
> 유사도를 계산하므로 **질의 임베딩은 필요**하며, 인덱싱과 동일한 임베딩 모델을 사용해야 함.

## 왜 Hybrid Search인가?

단일 검색 방식은 각각 약점이 있음. Hybrid는 두 방식을 결합해 서로의 약점을 보완함.

| 질의 유형 | BM25 (Sparse) | 임베딩 (Dense) |
|-----------|---------------|----------------|
| "특허법 제42조" (정확한 용어) | ✅ 정확히 찾음 | △ 관련 조문도 섞임 |
| "특허 신청 잘하는 방법" (자연어) | △ 키워드 불일치 | ✅ 의미로 찾음 |
| 오타·동의어 | ✗ 취약 | ✅ 강건 |

**RRF (Reciprocal Rank Fusion)**: 두 검색기의 순위를 결합하는 알고리즘임.

```
RRF_score(d) = Σ weight_i / (k + rank_i(d))     (k=60 기본)
```

두 검색기가 **공통으로 찾은 청크**는 점수가 합산되어 상위로 올라감 → Hybrid의 핵심 이득.

## 공용 벡터 DB에서 BM25를 구성하는 방법 (이 예제의 핵심)

BM25는 벡터가 아니라 **원문 텍스트**로 인덱스를 만드는 **메모리 기반** 검색기임.  
공용 벡터 DB는 Dense 검색용으로 만들어졌지만 청크 **원문과 메타데이터도 함께 저장**하므로,  
이를 그대로 꺼내(`_collection.get(include=["documents","metadatas"])`) BM25 코퍼스로 재사용함.  
→ 문서를 **다시 임베딩하지 않고** 동일한 246개 청크로 Sparse 인덱스를 메모리에 구축함.

> 참조 예제(`agentic-ai/examples/rag/hybrid-search`)는 BM25용 청크를 별도 `chunks.pkl`로 저장하지만,  
> 본 예제는 **공용 DB 하나만** 사용하라는 제약에 맞춰 DB에서 원문을 직접 추출함.

## 한국어 BM25 토크나이저

BM25 기본 토크나이저는 공백 분리(`text.split()`)라 한국어에 부적합함.  
한국어는 교착어라 "특허**를**/특허**는**/특허**의**"가 모두 다른 토큰이 되어 "특허" 매칭에 실패함.

본 예제는 형태소 분석기 **kiwipiepy**를 `preprocess_func`로 주입하여 "특허+를 → 특허"처럼  
어근을 분리함 → 키워드 매칭률이 크게 향상됨. (kiwipiepy 미설치 시 정규식 폴백 토크나이저 사용)

## 처리 흐름

```
질의어 입력
   │
   ▼
[1/4] 공용 벡터 DB 로드        load_vectorstore()             : Chroma(...) 생성자로 영속 컬렉션 연결 (재인덱싱 X)
   │                          load_corpus_from_vectorstore() : DB에서 원문 청크 추출 → BM25 코퍼스
   │
   ▼
[2/4] 검색기 구성             build_retrievers()
   │     ├─ Dense  : vectorstore.as_retriever(k=5)
   │     ├─ Sparse : BM25Retriever.from_documents(corpus, preprocess_func=한국어 토크나이저)
   │     └─ Hybrid : EnsembleRetriever([dense, bm25], weights=[0.5, 0.5])  ← langchain_classic
   │
   ▼
[3/4] LLM 생성                create_llm()      : ChatGroq(openai/gpt-oss-120b, reasoning_format="hidden")
   │
   ▼
[4/4] Hybrid 검색 + 답변 생성  answer_query()
   │     ├─ 탐색 : hybrid_retriever.invoke(query) → Dense+BM25 융합 결과
   │     └─ 생성 : (prompt | llm | StrOutputParser) 체인에 검색 청크 주입
   ▼
검색 비교 + 결과 출력          print_search_comparison() / print_result()
```

## 소스 코드 설명

전체 코드는 [app.py](app.py)에 있음. 주요 함수는 다음과 같음.

### `build_bm25_tokenizer()`

BM25용 한국어 토크나이저 함수를 생성함.

- kiwipiepy(`Kiwi`)로 형태소 분석하여 조사·어미를 분리한 어근 토큰을 추출함
- kiwipiepy 미설치 시 정규식(`[가-힣]+|[a-zA-Z0-9]+`) 폴백을 사용해 예제가 항상 실행되도록 함

### `load_vectorstore()`

공용 ChromaDB를 재임베딩 없이 로드함.

- `Chroma(collection_name=..., embedding_function=..., persist_directory=...)` 생성자 사용  
  (`from_documents`는 신규 인덱싱용이므로 사용하지 않음)
- `embedding_function`에 인덱싱과 **동일한** `text-embedding-3-small`을 지정해야 의미 공간이 일치함
- `OPENAI_API_KEY` 미설정·벡터 DB 부재·빈 컬렉션을 사전에 검증함

### `load_corpus_from_vectorstore(vectorstore)`

벡터 DB에 저장된 원문 청크 전체를 꺼내 `Document` 리스트로 복원함 (BM25 코퍼스).

- `_collection.get(include=["documents", "metadatas"])`로 임베딩을 제외한 원문·메타데이터만 일괄 조회
- 문서를 **다시 임베딩하지 않고** 기존 청크 원문을 재사용함

### `build_retrievers(vectorstore, corpus)`

Dense·Sparse(BM25)·Hybrid(Ensemble) 세 검색기를 구성함.

- **Dense**: `vectorstore.as_retriever(search_kwargs={"k": 5})`
- **Sparse**: `BM25Retriever.from_documents(corpus, preprocess_func=한국어 토크나이저)`, `k=5`
- **Hybrid**: `EnsembleRetriever(retrievers=[dense, bm25], weights=[0.5, 0.5])`  
  - **`EnsembleRetriever`는 `langchain_classic.retrievers`에서 import** (최신 langchain에서 분리됨)
- 세 검색기를 모두 반환하여 검색 결과를 비교 출력할 수 있게 함

### `create_llm()`

Groq LPU의 `openai/gpt-oss-120b` 채팅 모델을 생성함.

- `ChatGroq`: Groq Cloud LPU 모델 래퍼 (`GROQ_API_KEY` 자동 참조)
- **`reasoning_format="hidden"`**: 추론 모델의 사고 과정을 숨기고 최종 답변만 받음
- `temperature=0`: 재현 가능한(결정적) 답변 생성

### `answer_query(query, retriever, llm)`

Hybrid 검색 후 검색 결과를 근거로 LLM 답변을 생성함 → `(답변, 검색 청크)` 반환.

- 탐색: `hybrid_retriever.invoke(query)`로 Dense+BM25 융합 결과 검색
- 생성: `ChatPromptTemplate` → `ChatGroq` → `StrOutputParser`를 LCEL 파이프(`|`)로 연결한 체인 실행

### `print_search_comparison(...)` / `print_result(...)`

- `print_search_comparison`: Dense·BM25·Hybrid 검색 결과를 나란히 출력하여 Hybrid 효과를 시각화함  
  (특히 두 검색기가 공통으로 찾아 점수가 합산된 청크를 표시)
- `print_result`: 질의어·생성 답변·Hybrid 검색 출처를 출력함

## 가상환경 설정 및 실행 방법

> **선행 조건**: 공용 벡터 DB(`hands-on/10.rag/vectordb`)가 8.0 인덱싱으로 구축되어 있어야 함.  
> 없으면 먼저 `../indexing/indexing.py`를 실행하여 인덱싱을 수행해야 함.

> **API 키**: `hands-on/.env`에 `OPENAI_API_KEY`(질의 임베딩)와 `GROQ_API_KEY`(LLM)가 설정되어 있어야 함.

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\10.rag\hybrid-search
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/10.rag/hybrid-search
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/10.rag/hybrid-search
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 실행

```bash
# 기본 질의어로 실행 ("특허를 받을 수 있는 조건은 ?")
python app.py

# 임의 질의어로 실행
python app.py "특허 출원 절차는?"
```

### 실행 결과 예시

```
[1/4] 공용 벡터 DB 로드 (재임베딩 없음)
  - 벡터 DB 로드 완료: 246개 벡터 (컬렉션 'patent_law')
  - BM25 코퍼스 추출 완료: 246개 청크
[2/4] 검색기 구성 (Dense + BM25 → Hybrid)
  - BM25 토크나이저: kiwipiepy 형태소 분석 (한국어 최적화)
[3/4] LLM 생성 (Groq openai/gpt-oss-120b)
[4/4] Hybrid 검색 + 답변 생성

======================================================================
[검색 비교] 질의어: 특허를 받을 수 있는 조건은 ?
======================================================================
  Dense (의미)   Top 5: ['특허법.pdf#32', '특허법.pdf#68', '특허법.pdf#234', '특허법.pdf#152', '특허법.pdf#20']
  BM25  (키워드) Top 5: ['특허법.pdf#118', '특허법.pdf#14', '특허법.pdf#32', '특허법.pdf#27', '특허법.pdf#152']
  Hybrid(융합)        8건: ['특허법.pdf#32', '특허법.pdf#152', '특허법.pdf#118', '특허법.pdf#68', '특허법.pdf#14', '특허법.pdf#234', '특허법.pdf#27', '특허법.pdf#20']
  → Dense·BM25 공통 청크(점수 합산되어 상위): ['특허법.pdf#152', '특허법.pdf#32']

======================================================================
[질문] 특허를 받을 수 있는 조건은 ?
======================================================================
[답변]
특허를 받을 수 있는 조건은 다음과 같습니다.

1. **산업상 이용 가능한 발명이어야 함** — 제29조(특허요건)①
2. **다음에 해당하지 않아야 함(제외 사유)** — 제29조①제1·2호(공지·공연 실시, 간행물 게재),
   제32조(공공질서·선량한 풍속·공중위생을 해칠 우려가 있는 발명)
3. **특허를 받을 권리를 가진 자가 출원해야 함** — 제33조(발명자 또는 그 승계인)

요약하면, 산업적으로 이용 가능한 새롭고 공개되지 않은 발명이어야 하며, 공공질서·풍속·위생에
반하지 않아야 하고, 권리자(발명자·승계인)가 출원해야 특허를 받을 수 있습니다.
(근거: 제29조, 제32조, 제33조, 제37조)

----------------------------------------------------------------------
[검색 출처] 8건 (Hybrid: Dense + BM25)
  [1] 특허법.pdf #32: 제37조(특허를 받을 수 있는 권리의 이전 등) ...
  [2] 특허법.pdf #152: 제132조의17(특허거절결정 등에 대한 심판) ...
  [3] 특허법.pdf #118: 제107조(통상실시권 설정의 재정) ...
  [4] 특허법.pdf #68: 제62조(특허거절결정) ...
  [5] 특허법.pdf #14: 제24조(중단 또는 중지의 효과) ...
  [6] 특허법.pdf #234: 제223조(특허표시 및 특허출원표시) ...
  [7] 특허법.pdf #27: 제31조 삭제 ... 제32조(특허를 받을 수 없는 발명) ...
  [8] 특허법.pdf #20: 제29조(특허요건) ① 산업상 이용할 수 있는 발명으로서 ...
======================================================================
```

> **Hybrid 효과 관찰**: Dense(의미)의 Top 5에는 핵심 조문인 **제32조**가 없었으나,  
> BM25(키워드)가 **#27(제32조 특허를 받을 수 없는 발명)** 을 발굴하여 융합 결과에 포함시킴.  
> 또한 두 검색기가 공통으로 찾은 **#32·#152**는 RRF에서 점수가 합산되어 상위로 올라감.  
> 결과적으로 답변이 제29조뿐 아니라 **제32조·제33조**까지 근거로 들어 단일 검색보다 풍부해짐.

> 답변 본문·검색 순위는 LLM/모델 버전에 따라 약간 달라질 수 있음. 위 출력은 `openai/gpt-oss-120b` 기준 실측 결과임.  
> `EnsembleRetriever`는 두 검색기 결과를 융합하므로 최종 건수가 `TOP_K`(5)보다 많을 수 있음(중복 제거 후 최대 10건).

## 가중치 조정 가이드

질의 유형과 문서 특성에 따라 `DENSE_WEIGHT` / `BM25_WEIGHT`를 조정함 (교재 8.3 기준).

| 상황 | BM25 가중치 | Dense 가중치 |
|------|-------------|--------------|
| 전문 용어가 많은 문서 (법률·의료) | 0.6~0.7 | 0.3~0.4 |
| 자연어 질문이 주로 들어옴 | 0.3~0.4 | 0.6~0.7 |
| 균형 잡힌 검색 필요 (본 예제 기본값) | 0.5 | 0.5 |

## Naive RAG 대비 개선점 및 다음 단계

| 구분 | Naive RAG (8.1) | Hybrid Search (8.3, 본 예제) |
|------|-----------------|------------------------------|
| 검색 방식 | Dense 단독 (의미 유사도) | Dense + BM25 융합 (의미 + 키워드) |
| 키워드 매칭 | 약함 | **강함** (조문 번호·전문 용어) |
| 검색기 | `as_retriever` | `EnsembleRetriever` (RRF) |

| 남은 한계 | 개선 기법 (교재 8.x) |
|-----------|----------------------|
| 1차 검색 순위를 그대로 사용 | Re-ranking (Cross-Encoder, 8.4) |
| 검색 필요 여부·결과 품질 검증 없음 | Self-RAG (8.5) |
