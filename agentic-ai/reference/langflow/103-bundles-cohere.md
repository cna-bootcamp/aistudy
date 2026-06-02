# Cohere

**Cohere** 번들은 Cohere 서비스와의 통합을 지원하는 컴포넌트 제공.

자세한 정보: [Cohere 문서](https://cohere.ai/)

## Cohere Text Generation

Cohere의 Language 모델을 사용하여 텍스트 생성.

### 출력 타입

| 출력 | 설명 |
|------|------|
| **Model Response** | [Message](/data-types#message) - 모델 응답 텍스트 |
| **Language Model** | [LanguageModel](/data-types#languagemodel) |

**Language Model** 출력: **Agent**, **Smart Transform** 등 다른 LLM 기반 컴포넌트의 LLM으로 사용 시 선택.

자세한 정보: [Language model components](/components-models)

### 파라미터

| Name | Type | 설명 |
|------|------|------|
| Input | String | (입력) 텍스트 생성을 위한 입력 텍스트 |
| System Message | String | (입력) 모델에 전달할 [시스템 메시지](https://docs.cohere.com/docs/system-instructions) |
| Stream | Boolean | (입력) 응답 스트리밍 여부. 채팅에서만 작동. 기본값: `false` |
| Cohere API Key | SecretString | (입력) Cohere API 키 |
| Temperature | Float | (입력) 샘플링의 무작위성. 낮은 값(0 근처)은 결정적, 높은 값(1 근처)은 창의적. 기본값: `0.75` |

## Cohere Embeddings

Cohere에서 임베딩 모델 로드.

Flow에서 임베딩 모델 컴포넌트 사용 방법: [Embedding model components](/components-embedding-models) 참조.

### 파라미터

| Name | Type | 설명 |
|------|------|------|
| `cohere_api_key` | SecretString | (입력) Cohere 서비스 인증에 필요한 API 키 |
| `model` | String | (입력) 텍스트 문서 임베딩 및 쿼리 수행에 사용되는 Language 모델. 기본값: `embed-english-v2.0` |
| `truncate` | Boolean | (입력) 모델의 토큰 제한 초과 입력 처리 방법. `NONE`, `START`, `END`(기본값) 중 하나. [Cohere truncate API 참조](https://docs.cohere.com/reference/embed#request.body.truncate) 참조. |
| `max_retries` | Integer | (입력) 실패한 요청에 대한 최대 재시도 횟수. 기본값: `3` |
| `user_agent` | String | (입력) 요청에 포함할 사용자 에이전트 문자열. 기본값: `langchain` |
| `request_timeout` | Float | (입력) 요청 타임아웃 기간(초). 기본값: None |

## Cohere Rerank

Cohere API를 사용하여 문서를 찾고 리랭크.

- **출력**: `Data` - **Top N** 파라미터로 제한된 리랭크된 문서

### 파라미터

| Name | Type | 설명 |
|------|------|------|
| **Search Query** | String | (입력) 문서 리랭크를 위한 검색 쿼리 |
| **Search Results** | Data | (입력) 벡터 스토어 컴포넌트의 검색 결과 출력 연결. 벡터 데이터베이스에서 유사도 검색 실행 후 리랭크 적용에 사용. |
| **Top N** | Integer | (입력) 리랭크 후 반환할 문서 수. 기본값: `3` |
| **Cohere API Key** | SecretString | (입력) Cohere API 키 |
| **Model** | String | (입력) 사용할 리랭커 모델. 기본값: `rerank-english-v3.0` |

