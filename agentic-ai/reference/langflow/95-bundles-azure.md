# Azure

**Azure** 번들은 Azure OpenAI 서비스와의 통합을 지원하는 컴포넌트 제공.

## Azure OpenAI

[Azure OpenAI LLM](https://learn.microsoft.com/en-us/azure/ai-services/openai/)을 사용하여 텍스트 생성.

### 출력 타입

| 출력 | 설명 |
|------|------|
| **Model Response** | [Message](/data-types#message) - 모델 응답 텍스트 |
| **Language Model** | [LanguageModel](/data-types#languagemodel) - [AzureChatOpenAI](https://docs.langchain.com/oss/python/integrations/chat/azure_chat_openai) 인스턴스 |

**Language Model** 출력: **Agent**, **Smart Transform** 등 다른 LLM 기반 컴포넌트의 LLM으로 사용 시 선택.

자세한 정보: [Language model components](/components-models)

### 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Type | 설명 |
|------|------|------|
| Model Name | String | (입력) 텍스트 생성에 사용할 Azure OpenAI 모델 이름 |
| Azure Endpoint | String | (입력) 리소스를 포함한 Azure 엔드포인트 |
| Deployment Name | String | (입력) 배포 이름 |
| API Version | String | (입력) 사용할 Azure OpenAI API 버전 |
| API Key | SecretString | (입력) Azure OpenAI API 키 |
| Temperature | Float | (입력) 샘플링 온도. 기본값: `0.7` |
| Max Tokens | Integer | (입력) 생성할 최대 토큰 수. 기본값: `1000` |
| Input Value | String | (입력) 텍스트 생성을 위한 입력 텍스트 |
| Stream | Boolean | (입력) 모델 응답 스트리밍 여부. 기본값: `false` |

## Azure OpenAI Embeddings

Azure OpenAI 모델을 사용하여 임베딩 생성.

Flow에서 임베딩 모델 컴포넌트 사용 방법: [Embedding model components](/components-embedding-models) 참조.

### 파라미터

| Name | Type | 설명 |
|------|------|------|
| Model | String | (입력) 사용할 모델 이름. 기본값: `text-embedding-3-small` |
| Azure Endpoint | String | (입력) 리소스를 포함한 Azure 엔드포인트. 예: `https://example-resource.azure.openai.com/` |
| Deployment Name | String | (입력) 배포 이름 |
| API Version | String | (입력) 사용할 API 버전. 다양한 날짜 옵션 포함. |
| API Key | String | (입력) Azure OpenAI 서비스 접근에 필요한 API 키 |

