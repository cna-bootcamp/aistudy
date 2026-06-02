# 특허법 RAG (Re-ranking / 2-stage Retrieval)

공용 벡터 DB를 **재인덱싱 없이** 로드하여 검색하고, **Cross-Encoder Re-ranking**으로 검색 품질을 높이는 RAG 예제임.  
1차 검색(Bi-Encoder)으로 후보를 넓게 가져온 뒤, 정밀한 Cross-Encoder로 재정렬하여 최종 컨텍스트만 LLM에 전달함.

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| 입력 | 공용 벡터 DB `hands-on/10.rag/vectordb` (8.0 인덱싱으로 구축) |
| 컬렉션명 | `patent_law` (인덱싱이 저장한 이름과 반드시 일치) |
| 쿼리 임베딩 | OpenAI `text-embedding-3-small` (1536차원, 인덱싱 시와 동일 모델) |
| Re-ranking 모델 | `dragonkue/bge-reranker-v2-m3-ko` (한국어 최적화 Cross-Encoder) |
| LLM | Groq LPU `openai/gpt-oss-120b` |
| 1차 검색 수 | `INITIAL_K = 50` |
| 최종 문서 수 | `RERANK_K = 5` |

> **재인덱싱 없음**: 코퍼스는 이미 임베딩되어 저장돼 있으므로 다시 임베딩하지 않음.  
> 다만 **쿼리**는 검색을 위해 인덱싱 시와 동일한 임베딩 모델로 벡터화해야 함(Dense Retrieval의 본질).

---

## 2. 처리 흐름

```
질문 → [1차 검색] Bi-Encoder Top-50 → [Re-ranking] Cross-Encoder Top-5 → [답변 생성] LLM
        ↑ 빠름·넓게(recall)            ↑ 느림·정밀(precision)              ↑ Top-5만 컨텍스트로 사용
```

| 단계 | 함수 | 설명 |
|------|------|------|
| 준비 | `load_vectorstore()` | 공용 벡터 DB를 컬렉션명 `patent_law`로 로드. 적재 건수 0이면 연결 실패로 보고 중단 |
| 준비 | `load_reranker()` | `dragonkue/bge-reranker-v2-m3-ko` Cross-Encoder 로드 (최초 1회 모델 다운로드) |
| 준비 | `load_llm()` | Groq `openai/gpt-oss-120b` LLM 초기화 |
| 1단계 | `retrieve_initial()` | 벡터 유사도(Bi-Encoder)로 상위 50건을 빠르게 추출 |
| 2단계 | `rerank_documents()` | 쿼리-문서 쌍을 Cross-Encoder로 정밀 평가하여 상위 5건 재선정 |
| 3단계 | `build_chain()` → `chain.invoke()` | 재정렬 Top-5를 컨텍스트로 LLM이 답변 생성 |

---

## 3. Re-ranking 동작 원리 (Bi-Encoder vs Cross-Encoder)

| 구분 | Bi-Encoder (1차 검색) | Cross-Encoder (Re-ranking) |
|------|----------------------|---------------------------|
| 입력 | 질문·문서를 **각각 독립** 인코딩 | 질문+문서를 **하나로 결합**하여 입력 |
| 출력 | 벡터 (코사인 유사도 계산용) | 관련도 점수 (Sigmoid로 0~1 정규화) |
| 속도 | 빠름 (벡터 사전 계산 가능) | 느림 (쌍마다 매번 계산) |
| 정확도 | 상대적 낮음 | 높음 (단어 간 상호작용 분석) |
| 용도 | 대량 후보 추출 | 후보 정밀 재정렬 |

> **Retrieve More, Rerank Better** 전략임.  
> Bi-Encoder는 빠르지만 관련 문서를 상위권에서 놓칠 수 있음.  
> 넓게(Top-50) 가져온 뒤 Cross-Encoder로 재정렬하면 recall과 precision을 동시에 확보함.  
> LLM에는 최종 5건만 전달되므로 토큰 비용은 그대로 유지되고, 재정렬 처리 시간만 약간 증가함.

---

## 4. 주요 함수

- **`load_vectorstore()`**: 공용 벡터 DB를 임베딩 없이 로드함. `collection_name="patent_law"`를 **반드시 명시**  
  (미명시 시 langchain_chroma 기본값 `langchain`으로 빈 컬렉션이 오류 없이 열려 검색 0건이 되는 침묵 실패 발생).  
  로드 직후 `_collection.count()`로 적재 건수를 검증함.
- **`load_reranker()`**: `FlagReranker`로 한국어 Cross-Encoder를 로드 (`use_fp16=True`로 GPU 메모리 절약·가속).
- **`load_llm()`**: `ChatGroq`로 Groq LPU LLM을 초기화 (`GROQ_API_KEY` 필요).
- **`retrieve_initial()`**: `similarity_search(query, k=50)`로 Bi-Encoder 1차 후보를 순위 순으로 반환.
- **`rerank_documents()`**: 쿼리-문서 쌍을 `compute_score(pairs, normalize=True)`로 평가 후 점수 내림차순 상위 5건 반환.  
  각 결과에 **1차 검색 순위**를 함께 담아 재정렬에 따른 순위 변화를 출력 단계에서 비교함.
- **`build_chain()`**: `프롬프트 | LLM | StrOutputParser`의 LCEL 체인을 구성.
- **`run_query()`**: 1차 검색 → Re-ranking → 답변 생성의 전체 흐름을 1회 수행.

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
cd hands-on/10.rag/re-ranking
python -m venv venv --system-site-packages
venv\Scripts\Activate.ps1
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)
```bash
cd hands-on/10.rag/re-ranking
python -m venv venv --system-site-packages
source venv/Scripts/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)
```bash
cd hands-on/10.rag/re-ranking
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

---

## 6. 실행 결과 예시

```
======================================================================
특허법 RAG 예제 (Re-ranking)
설정: 1차 검색 Top-50 → Re-ranking → Top-5 / LLM: openai/gpt-oss-120b
======================================================================

[준비] 리소스 로드
  - 공용 벡터 DB 로드 완료: 컬렉션 'patent_law', 저장 벡터 246건
  - Re-ranker 로드: dragonkue/bge-reranker-v2-m3-ko

질문: 특허를 받을 수 있는 조건은 ?

----------------------------------------------------------------------
[1차 검색] Bi-Encoder Top-50 (상위 10건 미리보기)
----------------------------------------------------------------------
   1. 특허법.pdf #32: 제37조(특허를 받을 수 있는 권리의 이전 등) ...
   2. 특허법.pdf #68: 제62조(특허거절결정) 심사관은 특허출원이 ...
   ...
   5. 특허법.pdf #20: 제29조(특허요건) ① 산업상 이용할 수 있는 발명으로서 ...

======================================================================
[Re-ranking] Cross-Encoder Top-5 (1차 순위 → 재정렬 순위)
======================================================================
  1. (1차  5위 ▲4) [점수 0.9998] 특허법.pdf #20
     제29조(특허요건) ① 산업상 이용할 수 있는 발명으로서 ...
  2. (1차  2위 ─)  [점수 0.9727] 특허법.pdf #68
     제62조(특허거절결정) ...
  3. (1차  7위 ▲4) [점수 0.9628] 특허법.pdf #35
     제42조(특허출원) ...
  4. (1차 46위 ▲42) [점수 0.9170] 특허법.pdf #27
     제32조(특허를 받을 수 없는 발명) ...
  5. (1차 10위 ▲5) [점수 0.9110] 특허법.pdf #41
     제44조(공동출원) ...

답변 생성 중...

----------------------------------------------------------------------
특허를 받을 수 있으려면 다음과 같은 기본 요건을 모두 만족해야 합니다.
1. 산업적으로 이용할 수 있는 발명이어야 함 (특허법 제29조)
2. 새로워야 함(신규성) (특허법 제29조)
3. 공공질서·선량한 풍속에 반하지 않아야 함 (특허법 제32조)
4. 특허를 받을 권리가 있는 사람이어야 함 (특허법 제33조)
5. 정해진 절차와 서류를 갖추어 출원해야 함 (특허법 제42조)
----------------------------------------------------------------------
```

> **재정렬 효과 관찰 포인트**:  
> 가장 핵심 조문인 **제29조(특허요건)**가 1차 5위 → **1위**(점수 0.9998)로 상승함.  
> 특히 **제32조(특허를 받을 수 없는 발명)**는 1차 **46위 → 4위(▲42)**로 회복됨 —  
> Naive RAG처럼 1차 Top-5만 사용했다면 **누락**되었을 문서를 Re-ranking이 끌어올린 사례임.

---

## 7. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 검색 0건 / "문서에서 찾을 수 없습니다" | `collection_name` 미지정으로 빈 컬렉션 연결 | `collection_name="patent_law"` 확인 (코드에 반영됨) |
| GPU 미인식 (CPU로 느림) | venv가 전역 CUDA torch를 공유하지 않음 | venv를 `--system-site-packages`로 재생성 |
| `XLMRobertaTokenizer has no attribute prepare_for_model` | transformers 5.x가 FlagEmbedding이 쓰는 내부 메서드를 제거 | requirements의 `transformers<5.0` 핀 적용 |
| 종료 시 Segmentation fault(exit 139) | torch·onnxruntime의 OpenMP 런타임 중복 로드 (Windows 종료 시점 간헐 발생) | `KMP_DUPLICATE_LIB_OK=TRUE` 완화책 적용 (코드 상단). 답변은 종료 전에 출력되므로 결과에는 영향 없음 |
