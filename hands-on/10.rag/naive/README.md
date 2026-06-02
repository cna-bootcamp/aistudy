# Naive RAG 예제 (LangChain 기반)

8.0 인덱싱으로 구축된 공용 벡터 DB를 **재임베딩 없이** 로드하여, 질의 검색 후 LLM이 답변을 생성하는  
가장 기본적인 RAG(Naive RAG) 예제임. 검색 → 생성의 단방향 파이프라인을 LangChain으로 구현함.

## 개요

| 항목 | 내용 |
|------|------|
| 패턴 | Naive RAG (검색 → 생성, Query Transformation·Re-ranking 없음) |
| 검색 방식 | Dense Retrieval (질의 임베딩 기반 유사도 검색) |
| 벡터 DB | ChromaDB (공용 `../vectordb`, 컬렉션 `patent_law`, 246개 벡터) |
| 질의 임베딩 | OpenAI `text-embedding-3-small` (1536차원, 인덱싱과 동일) |
| LLM | Groq LPU `openai/gpt-oss-120b` (추론 모델) |
| 대상 문서 | 대한민국 특허법 PDF |

> **"임베딩하지 않음"의 의미**  
> 문서를 다시 인덱싱(임베딩 후 저장)하지 않는다는 뜻임. 단, Dense Retrieval은 질의어를 벡터로  
> 바꿔 유사도를 계산하므로 **질의 임베딩은 반드시 필요**하며, 인덱싱과 동일한 임베딩 모델을 사용해야 함.

## 처리 흐름

교재의 검색 메커니즘 "문탐생"(문의 → 탐색 → 생성)을 그대로 구현함.

```
질의어 입력
   │
   ▼
[1/3] 공용 벡터 DB 로드        load_retriever()  : Chroma(...) 생성자로 영속 컬렉션 연결 (재인덱싱 X)
   │
   ▼
[2/3] LLM 생성                create_llm()      : ChatGroq(openai/gpt-oss-120b, reasoning_format="hidden")
   │
   ▼
[3/3] 검색 + 답변 생성        answer_query()
   │     ├─ 문의/탐색 : retriever.invoke(query) → 질의 임베딩 → 유사 청크 Top 5 검색
   │     └─ 생성      : (prompt | llm | StrOutputParser) 체인에 검색 청크 주입
   ▼
결과 출력                     print_result()    : 답변 + 검색 출처(파일명·청크 번호) 표시
```

## 소스 코드 설명

전체 코드는 [naive_rag.py](naive_rag.py)에 있음. 주요 함수는 다음과 같음.

### `load_retriever()`

공용 ChromaDB를 재임베딩 없이 로드하여 Dense Retriever를 반환함.

- `Chroma(collection_name=..., embedding_function=..., persist_directory=...)` 생성자를 사용함  
  (`from_documents`는 신규 인덱싱용이므로 사용하지 않음)
- `embedding_function`에 인덱싱과 **동일한** `text-embedding-3-small`을 지정해야 의미 공간이 일치함
- `OPENAI_API_KEY` 미설정·벡터 DB 부재·빈 컬렉션을 사전에 검증하여 명확한 오류를 발생시킴
- `as_retriever(search_kwargs={"k": 5})`로 유사도 상위 5개 청크를 반환하도록 설정함

### `create_llm()`

Groq LPU의 `openai/gpt-oss-120b` 채팅 모델을 생성함.

- `ChatGroq`: Groq Cloud LPU에 요청을 보내는 LangChain 모델 래퍼 (`GROQ_API_KEY` 자동 참조)
- **`reasoning_format="hidden"`**: gpt-oss-120b는 추론 모델이라 사고 과정이 답변에 섞일 수 있으므로  
  최종 답변 텍스트만 받도록 함 (이 옵션이 없으면 `<think>...` 형태의 추론 과정이 노출될 수 있음)
- `temperature=0`: 동일 질의에 대해 재현 가능한(결정적) 답변을 생성함

### `format_docs(docs)`

검색된 `Document` 리스트를 LLM 프롬프트용 단일 문자열로 합침.

- 각 청크 앞에 `[출처 N]` 라벨과 메타데이터(파일명·청크 번호)를 붙여 LLM이 근거 조문을 인용하기 쉽게 함

### `answer_query(query, retriever, llm)`

검색과 생성을 수행하여 `(답변, 검색 청크)`를 반환함.

- 탐색: `retriever.invoke(query)`로 유사 청크 Top 5 검색
- 생성: `ChatPromptTemplate` → `ChatGroq` → `StrOutputParser`를 LCEL 파이프(`|`)로 연결한 체인 실행
- 프롬프트로 "참고 문서에 있는 내용만 근거로 답하고, 없으면 모른다고 답할 것"을 제약하여 할루시네이션을 억제함

### `print_result(query, answer, docs)`

질의어·생성 답변·검색 출처를 콘솔에 출력함. 어떤 청크가 근거인지 본문 미리보기와 함께 표시함.

## 가상환경 설정 및 실행 방법

> **선행 조건**: 공용 벡터 DB(`hands-on/10.rag/vectordb`)가 8.0 인덱싱으로 구축되어 있어야 함.  
> 없으면 먼저 `../indexing/indexing.py`를 실행하여 인덱싱을 수행해야 함.

> **API 키**: `hands-on/.env`에 `OPENAI_API_KEY`(질의 임베딩)와 `GROQ_API_KEY`(LLM)가 설정되어 있어야 함.

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\10.rag\naive
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/10.rag/naive
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/10.rag/naive
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 실행

```bash
# 기본 질의어로 실행 ("특허를 받을 수 있는 조건은 ?")
python naive_rag.py

# 임의 질의어로 실행
python naive_rag.py "특허 출원 절차는?"
```

### 실행 결과 예시 (실제 실행 출력 발췌)

```
[1/3] 공용 벡터 DB 로드 (재임베딩 없음)
  - 벡터 DB 로드 완료: 246개 벡터 (컬렉션 'patent_law')
[2/3] LLM 생성 (Groq openai/gpt-oss-120b)
[3/3] 검색 + 답변 생성

======================================================================
[질문] 특허를 받을 수 있는 조건은 ?
======================================================================
[답변]
특허를 받을 수 있는 요건은 다음과 같습니다.
- 산업상 이용할 수 있는 발명이어야 합니다.
- 다만, 출원 전에 공지·공연 실시되었거나 간행물에 게재된 발명은 제외됩니다.
(근거: 제29조(특허요건)①)

----------------------------------------------------------------------
[검색 출처] 5건
  [1] 특허법.pdf #32: 제37조(특허를 받을 수 있는 권리의 이전 등) ...
  ...
  [5] 특허법.pdf #20: 제29조(특허요건) ① 산업상 이용할 수 있는 발명으로서 ...
======================================================================
```

## Naive RAG의 한계 (다음 단계 학습 예고)

본 예제는 가장 단순한 구조이므로 다음 한계가 있음. 이후 8.2~8.5 예제에서 단계적으로 개선함.

| 한계 | 개선 기법 (교재 8.x) |
|------|----------------------|
| 항상 검색 수행, 모호한 질의에 취약 | Query Transformation (8.2) |
| 의미 검색만 사용, 정확한 키워드 매칭 약함 | Hybrid Search (BM25 결합, 8.3) |
| 1차 검색 순위를 그대로 사용 | Re-ranking (Cross-Encoder, 8.4) |
| 검색 필요 여부·결과 품질 검증 없음 | Self-RAG (8.5) |
