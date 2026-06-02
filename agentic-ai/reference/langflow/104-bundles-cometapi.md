# CometAPI

**CometAPI** 번들은 CometAPI 서비스와의 통합을 지원하는 컴포넌트 제공.

자세한 정보: [CometAPI 문서](https://www.cometapi.com/)

## CometAPI Text Generation

CometAPI의 OpenAI 호환 엔드포인트를 통해 Language 모델로 텍스트 생성.

### 출력 타입

| 출력 | 설명 |
|------|------|
| **Model Response** | [Message](/data-types#message) - 모델 응답 텍스트 |
| **Language Model** | [LanguageModel](/data-types#languagemodel) |

**Language Model** 출력: **Agent**, **Smart Transform** 등 다른 LLM 기반 컴포넌트의 LLM으로 사용 시 선택.

자세한 정보: [Language model components](/components-models)

### 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Type | 설명 |
|------|------|------|
| `api_key` | SecretString | (입력) CometAPI API 키 |
| `model_name` | String | (입력) 사용할 CometAPI 모델 ID. 유효한 API 키 제공 시 자동으로 최신 모델 목록 가져옴. |
| `input_value` | String | (입력) 모델에 보낼 입력 텍스트 |
| `system_message` | String | (입력) 어시스턴트 동작 설정을 위한 시스템 메시지 |
| `max_tokens` | Integer | (입력) 생성할 최대 토큰 수. `0` 설정 시 무제한. |
| `temperature` | Float | (입력) 출력의 무작위성 제어. 범위: `[0.0, 2.0]`. 기본값: `0.7` |
| `seed` | Integer | (입력) 작업 재현성을 위한 시드 값 |
| `model_kwargs` | Dict | (입력) 모델에 전달할 추가 키워드 인수 |
| `json_mode` | Boolean | (입력) true 시 스키마 전달 여부와 관계없이 JSON 출력 |
| `stream` | Boolean | (입력) 응답 스트리밍 여부. 기본값: `false` |
| `model` | LanguageModel | (출력) CometAPI 파라미터로 구성된 ChatOpenAI 인스턴스 |

## Flow에서 CometAPI 사용

1. [CometAPI 계정](https://www.cometapi.com/) 가입
2. CometAPI 대시보드에서 API 키 획득
3. Langflow에서 **CometAPI** 컴포넌트를 Flow에 추가
4. **CometAPI API Key** 필드에 API 키 입력
5. **Model Name** 메뉴에서 선호하는 모델 선택
6. 사용 사례에 맞게 다른 파라미터 구성
7. 필요에 따라 다른 컴포넌트를 Flow에 추가

**기본 테스트**: **Chat Input**과 **Chat Output** 컴포넌트를 Flow에 추가하고 **CometAPI** 컴포넌트에 연결 후 **Playground**에서 테스트.

**고급 사용 사례**: **Prompt Template**, **Agent**, **Smart Transform** 등의 컴포넌트와 연결 가능.

