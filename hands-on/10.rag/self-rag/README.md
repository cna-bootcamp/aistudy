# Self-RAG (특허법 예제)

LLM이 **Reflection Token**으로 RAG 워크플로우를 스스로 제어하는 **Self-RAG** 아키텍처 패턴 예제임.  
공용 벡터 DB(`../vectordb`, 컬렉션 `patent_law`)를 임베딩 없이 로드하여 검색에만 활용하며,  
검색 필요 여부 판단부터 답변 자체 검증·재시도까지 LLM이 자율적으로 수행함.

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| 패턴 | Self-RAG (Asai et al., 2023, ICLR 2024) |
| LLM | Groq LPU `openai/gpt-oss-120b` |
| 임베딩 모델 | OpenAI `text-embedding-3-small` (1536차원, 질의 벡터화 전용) |
| 벡터 DB | ChromaDB (`../vectordb` 로드, 컬렉션 `patent_law`) |
| 검색 문서 수 | Top-K = 5 |
| 재시도 | `[IsUse]` 실패 시 Query Rewriting 후 처음부터 재시도 (최대 3회) |

> **임베딩 없이 검색**: 이 예제는 인덱싱을 수행하지 않음. `../indexing/indexing.py`로 구축된 공용 벡터 DB를  
> 동일한 컬렉션명(`patent_law`)·임베딩 모델(`text-embedding-3-small`)로 로드해야 검색이 정상 동작함.

---

## 2. Self-RAG의 핵심 — Reflection Tokens

LLM이 워크플로우 각 단계에서 스스로 내리는 4가지 자기 성찰(self-reflection) 판단임.

| 토큰 | 의미 | 동작 |
|------|------|------|
| **`[Retrieve]`** | 검색 필요 여부 판단 | 특허법 질문 → 검색 / 인사·타 주제 → LLM 지식으로 직접 답변 |
| **`[IsRel]`** | Is Relevant (관련성) | 검색된 문서들을 **1회 LLM 호출로 일괄 평가**하여 관련 문서만 선별 |
| **`[IsSup]`** | Is Supported (근거성) | 생성된 답변이 문서에 근거하는지 검증 (환각 방지) → 실패 시 엄격 근거 기반 재생성 |
| **`[IsUse]`** | Is Useful (유용성) | 최종 답변이 유용한지 평가 → 실패 시 Query Rewriting 후 처음부터 재시도 |

> **검색 불필요 사례**: 공용 벡터 DB에는 **특허법만** 적재되어 있음. 따라서 `개인정보보호법` 등  
> 특허법 외 주제는 `[Retrieve]`에서 검색 불필요로 판단되어 LLM의 일반 지식으로 답변함.

---

## 3. 처리 흐름

```
질문
 │
 ▼
[Retrieve] 검색 필요?
 │
 ├─ No ─────────────────────────► LLM 지식으로 직접 답변 ─┐
 │                                                        │
 └─ Yes ─► 검색(Top-5) ─► [IsRel] 관련성 일괄 평가         │
              │                    │                       │
              │            관련 문서 있음 ─► 답변 생성       │
              │                    │                       │
              │            [IsSup] 근거성 검증               │
              │              │                              │
              │       근거 부족 ─► 엄격 근거 기반 재생성      │
              │                    │                       │
              └─ 관련 문서 없음 ─► LLM 지식으로 답변 ────────┤
                                                            ▼
                                              [IsUse] 유용성 평가
                                                  │
                                       유용함 ─► 최종 출력
                                                  │
                                  유용하지 않음 ─► Query Rewriting
                                                  └─► 처음부터 재시도 (최대 3회)
```

---

## 4. 주요 함수 / 클래스

| 구성 요소 | 역할 |
|-----------|------|
| `build_llm()` | Groq `gpt-oss-120b` LLM 생성 (temperature=0, `GROQ_API_KEY` 검증) |
| `load_vectorstore()` | 공용 벡터 DB를 컬렉션명·임베딩 모델 지정하여 검색 전용으로 로드 |
| `SelfRAGChain` | Self-RAG 워크플로우 오케스트레이션 본체 |
| ├ `check_retrieval_need()` | `[Retrieve]` — 검색 필요 여부 판단 |
| ├ `grade_relevance_batch()` | `[IsRel]` — 검색 문서 관련성 **1회 호출 일괄 평가** |
| ├ `generate_answer()` | 관련 문서 컨텍스트 기반 답변 생성 |
| ├ `generate_answer_without_context()` | 검색 불필요·관련 문서 없음 시 LLM 지식으로 답변 |
| ├ `grade_support()` | `[IsSup]` — 답변 근거성 검증 |
| ├ `regenerate_with_strict_grounding()` | `[IsSup]` 실패 시 엄격 근거 기반 재생성 |
| ├ `grade_usefulness()` | `[IsUse]` — 답변 유용성 평가 |
| ├ `rewrite_query()` | `[IsUse]` 실패 시 검색 최적화 질문 재작성 |
| └ `_invoke_with_retry()` | `[Retrieve]`~`[IsUse]` 1회 수행 + 재귀 재시도 (최대 `MAX_RETRIES`회) |

### 구조화 출력 (Reflection Token 파싱)

각 Reflection 판단은 Pydantic 스키마(`RetrieveDecision`, `BatchRelevanceGrade`, `SupportGrade`,  
`UsefulnessGrade`, `RewrittenQuery`)로 정의하고 `llm.with_structured_output(..., method="json_schema")`로  
강제 파싱함.

> **`method="json_schema"`를 쓰는 이유**: `gpt-oss-120b`는 기본 `function_calling` 모드에서 도구 이름을  
> 잘못 생성(예: `IsSup`)하여 `tool_use_failed` 오류가 발생할 수 있음. 도구 이름이 없는 Groq 구조화 출력  
> (`response_format` 기반 `json_schema`)을 사용하여 이 문제를 회피함.

---

## 5. Naive RAG와의 차이

| 구분 | Naive RAG | Self-RAG (본 예제) |
|------|-----------|--------------------|
| 검색 | **항상** 수행 | `[Retrieve]`로 필요 시에만 수행 |
| 관련성 평가 | 없음 (검색 결과 그대로 사용) | `[IsRel]` 일괄 평가로 관련 문서만 선별 |
| 답변 검증 | 없음 | `[IsSup]` 근거성 + `[IsUse]` 유용성 자체 검증 |
| 실패 대응 | 없음 | 근거 부족 시 재생성 / 유용성 미달 시 Query Rewriting 재시도 |

---

## 6. 가상환경 설정 및 실행

### 가상환경 설정 (Windows / PowerShell)
```powershell
cd hands-on/10.rag/self-rag
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)
```bash
cd hands-on/10.rag/self-rag
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)
```bash
cd hands-on/10.rag/self-rag
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 환경변수

`hands-on/.env` 파일에 아래 키가 필요함.
```
GROQ_API_KEY=gsk_...      # LLM (gpt-oss-120b) 호출용
OPENAI_API_KEY=sk-...     # 질의 임베딩 (text-embedding-3-small) 호출용
```

### 실행
```bash
python app.py            # 대화형 챗봇 (질문 입력 → Self-RAG 처리 → 답변)
python app.py --demo     # 교재 검증 질의 3건을 비대화형으로 순차 실행
```

> 대화형 모드에서 `quit` / `q` / `exit` / `종료` 입력 시 종료됨.

---

## 7. 테스트 질의어

| 구분 | 질의 | 기대 동작 |
|------|------|-----------|
| 검색 불필요 | `안녕하세요?` | `[Retrieve]=False` → LLM 직접 답변 |
| 검색 불필요 | `개인정보보호법의 정의와 범위는 ?` | `[Retrieve]=False` (특허법 외 주제) → LLM 직접 답변 |
| 검색 필요 | `특허를 받을 수 있는 조건은 ?` | `[Retrieve]=True` → 검색 → `[IsRel]`·`[IsSup]`·`[IsUse]` 검증 → 답변 |

---

## 8. 실행 결과 예시 (`python app.py --demo`)

```
############################################################
# 데모 질의 3/3: 특허를 받을 수 있는 조건은 ?
############################################################

[Retrieve] 검색 필요 여부 판단 중...
  → 검색 필요: True (특허를 받을 수 있는 조건은 특허법에 규정된 요건이므로 문서 검색이 필요합니다.)

[검색] 관련 문서 검색 중...
  → 5개 문서 검색됨

[IsRel] 검색 문서 관련성 일괄 평가 중...
  문서 1: 관련 없음
  ...
  문서 5: 관련 있음
  → 관련 문서 1개 (1회 LLM 호출로 평가)

[생성] 컨텍스트 기반 답변 생성 중...

[IsSup] 답변의 근거성 평가 중...
  → 근거 있음: True (답변 내용이 문서의 제29조에서 제시한 요건을 정확히 반영함)

[IsUse] 답변의 유용성 평가 중...
  → 유용함: True (특허 요건의 핵심을 제시해 질문에 직접 답함)

============================================================
Self-RAG 처리 결과 요약
============================================================
[Retrieve] 검색 수행 : True
[검색  ] 검색 문서   : 5개
[IsRel ] 관련 문서   : 1개
[IsSup ] 근거 있음   : True
[IsUse ] 유용함     : True
============================================================
------------------------------------------------------------
답변:
------------------------------------------------------------
특허를 받으려면 두 가지 핵심 조건을 만족해야 합니다.
1. 산업적으로 활용할 수 있는 발명이어야 합니다 ...
2. 출원 전에 이미 알려져 있지 않아야 합니다 ...
------------------------------------------------------------
```

> 위 판단 결과(`[IsRel]` 관련 문서 수 등)는 LLM 비결정성에 따라 실행마다 달라질 수 있음.
