# LLM Selector

> **Tip**: Langflow 1.7 이전에는 **LLM Router**로 불림.

[OpenRouter](https://openrouter.ai/docs/quickstart) 모델 사양을 기반으로 가장 적합한 LLM으로 요청 라우팅.

## 동작 방식

1. 여러 Language Model 컴포넌트를 **LLM Selector**에 연결
2. 하나의 모델이 **Judge LLM**으로 입력 메시지를 분석하여 평가 컨텍스트 파악
3. 연결된 다른 LLM 풀에서 가장 적합한 모델 선택
4. 선택된 모델로 입력 라우팅 및 응답 생성

## Flow 예시

3개의 Language Model 컴포넌트 구성:
- 1개: Judge LLM (요청 라우팅 담당)
- 2개: LLM 풀 (요청 처리)
- 입출력 컴포넌트로 사용자가 라우팅을 인식하지 못하는 원활한 채팅 상호작용 생성

## LLM Selector 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Display Name | 설명 |
|------|--------------|------|
| `models` | **Language Models** | (입력) 여러 Language Model 컴포넌트의 `LanguageModel` 출력 연결하여 모델 풀 생성. `judge_llm`이 이 풀에서 모델 선택. 첫 번째 연결 모델이 선택/라우팅 문제 시 기본 모델 |
| `input_value` | **Input** | (입력) Judge LLM이 선택한 모델로 라우팅될 수신 쿼리 |
| `judge_llm` | **Judge LLM** | (입력) 요청 라우팅을 위한 Judge LLM으로 사용할 Language Model 컴포넌트의 `LanguageModel` 출력 연결 (1개만) |
| `optimization` | **Optimization** | (입력) Judge LLM의 모델 선택 기준. `quality` (최고 응답 품질), `speed` (가장 빠른 응답 시간), `cost` (가장 비용 효율적), `balanced` (품질/속도/비용 균등). 기본값: `balanced` |
| `use_openrouter_specs` | **Use OpenRouter Specs** | (입력) OpenRouter API에서 모델 사양 가져오기 여부. `false`이면 모델 이름만 Judge LLM에 제공. 기본값: `true` |
| `timeout` | **API Timeout** | (입력) 라우터의 API 요청 타임아웃 (초). 기본값: `10` |
| `fallback_to_first` | **Fallback to First Model** | (입력) 선택된 모델에 라우팅 실패 시 `models`의 첫 번째 LLM을 백업으로 사용. 기본값: `true` |

## LLM Selector 출력

컴포넌트 출력 포트 근처에서 원하는 출력 타입 설정 가능.

| 출력 | Type | 설명 |
|------|------|------|
| **Output** | Message | 선택된 LLM이 생성한 원본 쿼리에 대한 응답. 일반 채팅 상호작용에 사용 |
| **Selected Model Info** | Data | 선택된 모델 정보 (이름, 버전 등) |
| **Routing Decision** | Message | Judge 모델의 특정 모델 선택 이유 (입력 쿼리 길이, 고려된 모델 수 포함). 디버깅에 유용 |

### Routing Decision 예시
```
Model Selection Decision:
- Selected Model Index: 0
- Selected Langflow Model Name: gpt-4o-mini
- Selected API Model ID (if resolved): openai/gpt-4o-mini
- Optimization Preference: cost
- Input Query Length: 27 characters (~5 tokens)
- Number of Models Considered: 2
- Specifications Source: OpenRouter API
```

