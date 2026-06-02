# Cleanlab

[Cleanlab](https://www.cleanlab.ai/)은 AI 및 RAG 솔루션의 모든 데이터 포인트와 예측에 자동화 및 신뢰성 추가.

Cleanlab 컴포넌트로 Langflow와 Cleanlab Evaluations 통합하여 신뢰할 수 있는 에이전트, RAG, LLM 파이프라인 구축.

**주요 기능:**
- LLM 응답의 신뢰도를 `0`~`1` 사이 점수로 정량화
- 응답의 장단점 설명
- 컨텍스트가 있는 RAG/에이전트 파이프라인의 컨텍스트 충분성, 근거성, 유용성, 쿼리 명확성 평가
- 낮은 신뢰 응답에 경고 또는 대체 답변으로 교정

**인증**: Cleanlab API 키 필요

## Cleanlab Evaluator

Cleanlab을 사용하여 프롬프트와 응답 쌍의 신뢰도를 평가하고 설명.

자세한 정보: [Cleanlab 문서](https://help.cleanlab.ai/tlm/)

### 파라미터

| Name | Type | 설명 |
|------|------|------|
| `system_prompt` | Message | (입력) 프롬프트 앞에 추가되는 시스템 메시지. 선택. |
| `prompt` | Message | (입력) LLM에 대한 사용자 입력 |
| `response` | Message | (입력) 평가할 모델의 응답 |
| `cleanlab_api_key` | Secret | (입력) Cleanlab API 키 |
| `cleanlab_evaluation_model` | Dropdown | (입력) Cleanlab이 사용하는 평가 모델 (GPT-4, Claude 등). 응답 생성 모델과 다를 수 있음. |
| `quality_preset` | Dropdown | (입력) 평가 속도와 정확도 간의 트레이드오프 |

### 출력

| Name | Type | 설명 |
|------|------|------|
| `score` | number, float | 0과 1 사이의 신뢰 점수 |
| `explanation` | Message | 신뢰 점수에 대한 설명 |
| `response` | Message | **Cleanlab Remediator** 컴포넌트와의 연결을 위한 원본 응답 |

## Cleanlab Remediator

[Cleanlab Evaluator](#cleanlab-evaluator) 컴포넌트의 신뢰 점수를 사용하여 LLM 응답을 표시, 경고 또는 대체할지 결정.

- **출력**: **Remediated Response** (`remediated_response`) - 교정 로직 적용 후 사용자에게 표시되는 최종 메시지 (`Message`)

### 파라미터

| Name | Type | 설명 |
|------|------|------|
| `response` | Message | (입력) 잠재적으로 교정할 응답 |
| `score` | Number | (입력) `CleanlabEvaluator`의 신뢰 점수 |
| `explanation` | Message | (입력) 경고 표시 시 첨부할 설명. 선택. |
| `threshold` | Float | (입력) 응답을 변경 없이 통과시키는 최소 신뢰 점수 |
| `show_untrustworthy_response` | Boolean | (입력) 신뢰할 수 없는 응답에 경고와 함께 원본 응답을 표시할지 숨길지 여부 |
| `untrustworthy_warning_text` | Prompt | (입력) 신뢰할 수 없는 응답에 대한 경고 텍스트 |
| `fallback_text` | Prompt | (입력) 응답이 숨겨질 경우 대체 메시지 |

## Cleanlab RAG Evaluator

[Cleanlab 평가 지표](https://help.cleanlab.ai/tlm/use-cases/tlm_rag/)를 사용하여 RAG 및 LLM 파이프라인 출력의 신뢰성, 컨텍스트 충분성, 응답 근거성, 유용성, 쿼리 용이성 평가.

[Cleanlab Remediator](#cleanlab-remediator) 컴포넌트와 결합하여 RAG 파이프라인의 낮은 신뢰 응답 교정 가능.

### 파라미터

| Name | Type | 설명 |
|------|------|------|
| `cleanlab_api_key` | Secret | (입력) Cleanlab API 키 |
| `cleanlab_evaluation_model` | Dropdown | (입력) Cleanlab이 사용하는 평가 모델 |
| `quality_preset` | Dropdown | (입력) 평가 속도와 정확도 간의 트레이드오프 |
| `context` | Message | (입력) RAG 시스템에서 검색된 컨텍스트 |
| `query` | Message | (입력) 원래 사용자 쿼리 |
| `response` | Message | (입력) 컨텍스트와 쿼리 기반 모델의 응답 |
| `run_context_sufficiency` | Boolean | (입력) 컨텍스트가 쿼리 응답을 지원하는지 평가 |
| `run_response_groundedness` | Boolean | (입력) 응답이 컨텍스트에 근거하는지 평가 |
| `run_response_helpfulness` | Boolean | (입력) 응답의 유용성 평가 |
| `run_query_ease` | Boolean | (입력) 쿼리가 모호하거나 복잡하거나 적대적인지 평가 |

### 출력

| Name | Type | 설명 |
|------|------|------|
| `trust_score` | Number | 전체 신뢰 점수 |
| `trust_explanation` | Message | 신뢰 점수에 대한 설명 |
| `other_scores` | Dictionary | 선택적으로 활성화된 RAG 평가 지표 딕셔너리 |
| `evaluation_summary` | Message | 쿼리, 컨텍스트, 응답 및 평가 결과의 Markdown 요약 |
| `response` | Message | **Cleanlab Remediator** 컴포넌트와의 연결을 위한 원본 응답 |

## 예시 Flow

### LLM 응답 평가 및 교정

**Cleanlab Evaluator**와 **Cleanlab Remediator** 컴포넌트로 모든 LLM의 응답 신뢰도 평가 및 교정.

[Evaluate and Remediate flow 다운로드](/assets/files/eval_and_remediate_cleanlab-5094d0a30081fdbe6d3933028c6b971c.json) 후 Langflow 인스턴스에 [가져오기](/concepts-flows-import).

**구성 방법:**
1. **Language Model** 또는 **Agent** 컴포넌트의 `Message` 출력 → **Cleanlab Evaluator** 컴포넌트의 **Response** 입력 연결
2. **Prompt Template** 컴포넌트 → **Cleanlab Evaluator** 컴포넌트의 **Prompt** 입력 연결

Flow 실행 시 **Cleanlab Evaluator**가 신뢰 점수와 설명 반환.
**Cleanlab Remediator**가 이 신뢰 점수를 사용하여 원본 응답 출력, 경고 또는 대체 답변 결정.

### RAG 파이프라인 평가

**Vector Store RAG** 템플릿 기반 Flow 생성 후 **Cleanlab RAG Evaluator** 컴포넌트 추가하여 Flow의 컨텍스트, 쿼리, 응답 평가.

RAG Flow의 다른 컴포넌트에서 **context**, **query**, **response** 출력을 **Cleanlab RAG Evaluator** 컴포넌트에 연결.

`Evaluation Summary` 출력에는 쿼리, 컨텍스트, 응답 및 모든 평가 결과 포함.

