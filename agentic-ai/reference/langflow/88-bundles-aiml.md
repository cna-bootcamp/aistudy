# AI/ML API

**AI/ML** 번들은 AI/ML API와의 통합을 지원하는 컴포넌트 제공.

자세한 정보: [AI/ML API Langflow 통합 문서](https://docs.aimlapi.com/integrations/langflow)

## AI/ML API Text Generation

AI/ML API를 사용하여 `ChatOpenAI` 모델 인스턴스 생성.

- **출력**: [LanguageModel](/data-types#languagemodel) 전용
- **연결 대상**: **Smart Transform** 등 LLM 기반 컴포넌트

### 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Type | 설명 |
|------|------|------|
| `max_tokens` | Integer | (입력) 생성할 최대 토큰 수. 0 설정 시 무제한. 범위: 0-128000 |
| `model_kwargs` | Dictionary | (입력) 모델의 추가 키워드 인수 |
| `model_name` | String | (입력) 사용할 AIML 모델 이름. `AIML_CHAT_MODELS`에 미리 정의된 옵션 |
| `aiml_api_base` | String | (입력) AIML API 기본 URL. 기본값: `https://api.aimlapi.com` |
| `api_key` | SecretString | (입력) 모델에 사용할 AIML API 키 |
| `temperature` | Float | (입력) 출력의 무작위성 제어. 기본값: `0.1` |

## AI/ML API Embeddings

[AI/ML API](https://docs.aimlapi.com/api-overview/embeddings)를 사용하여 임베딩 생성.

- **출력**: [Embeddings](/data-types#embeddings) (`AIMLEmbeddingsImpl` 인스턴스)

Flow에서 임베딩 모델 컴포넌트 사용 방법: [Embedding model components](/components-embedding-models) 참조.

### 파라미터

| Name | Type | 설명 |
|------|------|------|
| `model_name` | String | (입력) 사용할 AI/ML 임베딩 모델 이름 |
| `aiml_api_key` | SecretString | (입력) AI/ML 서비스 인증에 필요한 API 키 |

