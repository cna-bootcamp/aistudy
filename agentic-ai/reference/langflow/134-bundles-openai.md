# OpenAI

**Bundles**는 Langflow와 특정 서드파티 통합을 지원하는 커스텀 컴포넌트 포함

본 페이지는 **OpenAI** 번들에서 사용 가능한 컴포넌트 설명

OpenAI 기능에 대한 자세한 내용은 [OpenAI 문서](https://platform.openai.com/docs/overview) 참조

## OpenAI 텍스트 생성

[OpenAI 언어 모델](https://platform.openai.com/docs/models)을 사용하여 텍스트 생성

코어 **Language Model** 컴포넌트에서 사용 가능한 것과 동일한 OpenAI 모델에 대한 접근 제공하지만,
**OpenAI** 컴포넌트는 OpenAI API 요청을 커스터마이징하기 위한 추가 파라미터 제공

**Model Response** (`Message`) 또는 **Language Model** (`LanguageModel`) 출력 가능

특정 OpenAI 모델 구성을 다른 LLM 기반 컴포넌트(예: **Agent**, **Smart Transform**)의 LLM으로 사용하려면 **Language Model** 출력 사용

자세한 내용은 [Language model components](https://docs.langflow.org/components-models) 참조

### OpenAI 텍스트 생성 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김
컴포넌트 헤더 메뉴의 **Controls**를 통해 모든 파라미터 수정 가능

| Name | Type | Description |
|------|------|-------------|
| api_key | SecretString | 입력 파라미터. OpenAI API 키 |
| model | String | 입력 파라미터. 사용할 OpenAI 모델 이름. 옵션: "gpt-3.5-turbo", "gpt-4" 등 |
| max_tokens | Integer | 입력 파라미터. 생성할 최대 토큰 수. 무제한 토큰의 경우 0으로 설정 |
| temperature | Float | 입력 파라미터. 출력의 무작위성 제어. 범위: [0.0, 1.0]. 기본값: 0.7 |
| top_p | Float | 입력 파라미터. nucleus sampling 제어. 범위: [0.0, 1.0]. 기본값: 1.0 |
| frequency_penalty | Float | 입력 파라미터. frequency penalty 제어. 범위: [0.0, 2.0]. 기본값: 0.0 |
| presence_penalty | Float | 입력 파라미터. presence penalty 제어. 범위: [0.0, 2.0]. 기본값: 0.0 |

## OpenAI Embeddings

[OpenAI 임베딩 모델](https://platform.openai.com/docs/guides/embeddings)을 사용한 임베딩 생성

코어 **Embedding Model** 컴포넌트에서 사용 가능한 것과 동일한 OpenAI 모델에 대한 접근 제공하지만,
**OpenAI Embeddings** 컴포넌트는 OpenAI 임베딩 API 요청을 커스터마이징하기 위한 추가 파라미터 제공

플로우에서 임베딩 모델 컴포넌트 사용에 대한 자세한 내용은 [Embedding model components](https://docs.langflow.org/components-embedding-models) 참조

### OpenAI Embeddings 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김
컴포넌트 헤더 메뉴의 **Controls**를 통해 모든 파라미터 수정 가능

| Name | Type | Description |
|------|------|-------------|
| OpenAI API Key | String | 입력 파라미터. OpenAI API 접근에 사용할 API 키 |
| Default Headers | Dict | 입력 파라미터. HTTP 요청의 기본 헤더 |
| Default Query | NestedDict | 입력 파라미터. HTTP 요청의 기본 쿼리 파라미터 |
| Allowed Special | List | 입력 파라미터. 처리 허용되는 특수 토큰. 기본값: `[]` |
| Disallowed Special | List | 입력 파라미터. 처리 허용되지 않는 특수 토큰. 기본값: `["all"]` |
| Chunk Size | Integer | 입력 파라미터. 처리를 위한 청크 크기. 기본값: `1000` |
| Client | Any | 입력 파라미터. 요청을 위한 HTTP 클라이언트 |
| Deployment | String | 입력 파라미터. 모델의 배포 이름. 기본값: `text-embedding-3-small` |
| Embedding Context Length | Integer | 입력 파라미터. 임베딩 컨텍스트 길이. 기본값: `8191` |
| Max Retries | Integer | 입력 파라미터. 실패한 요청의 최대 재시도 횟수. 기본값: `6` |
| Model | String | 입력 파라미터. 사용할 모델 이름. 기본값: `text-embedding-3-small` |
| Model Kwargs | NestedDict | 입력 파라미터. 모델의 추가 키워드 인수 |
| OpenAI API Base | String | 입력 파라미터. OpenAI API의 기본 URL |
| OpenAI API Type | String | 입력 파라미터. OpenAI API 타입 |
| OpenAI API Version | String | 입력 파라미터. OpenAI API 버전 |
| OpenAI Organization | String | 입력 파라미터. API 키와 연결된 조직 |
| OpenAI Proxy | String | 입력 파라미터. 요청을 위한 프록시 서버 |
| Request Timeout | Float | 입력 파라미터. HTTP 요청의 타임아웃 |
| Show Progress Bar | Boolean | 입력 파라미터. 처리를 위한 진행 표시줄 표시 여부. 기본값: `false` |
| Skip Empty | Boolean | 입력 파라미터. 빈 입력을 건너뛸지 여부. 기본값: `false` |
| TikToken Enable | Boolean | 입력 파라미터. TikToken 활성화 여부. 기본값: `true` |
| TikToken Model Name | String | 입력 파라미터. TikToken 모델 이름 |

## 참고

- [Agent 컴포넌트](https://docs.langflow.org/components-agents)
- [LangChain OpenAI Tools Agent 컴포넌트](https://docs.langflow.org/bundles-langchain#openai-tools-agent)
