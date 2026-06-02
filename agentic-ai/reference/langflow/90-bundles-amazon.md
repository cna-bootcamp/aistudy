# Amazon

**Amazon** 번들은 AWS 서비스와의 통합을 지원하는 컴포넌트 제공.

## Amazon Bedrock Converse

[Amazon Bedrock LLM](https://docs.aws.amazon.com/bedrock)과 Bedrock Converse API를 사용하여 텍스트 생성.

### 출력 타입

| 출력 | 설명 |
|------|------|
| **Model Response** | [Message](/data-types#message) - 모델 응답 텍스트 |
| **Language Model** | [LanguageModel](/data-types#languagemodel) - [ChatBedrockConverse](https://docs.langchain.com/oss/python/integrations/chat/bedrock) 인스턴스 |

**Language Model** 출력: **Agent**, **Smart Transform** 등 다른 LLM 기반 컴포넌트의 LLM으로 사용 시 선택.

자세한 정보: [Language model components](/components-models)

### 파라미터

| Name | Type | 설명 |
|------|------|------|
| `input_value` | String | (입력) 텍스트 생성을 위한 입력 문자열 |
| `system_message` | String | (입력) 모델에 전달할 시스템 메시지 |
| `stream` | Boolean | (입력) 응답 스트리밍 여부. 채팅에서만 작동. 기본값: `false` |
| `model_id` | String | (입력) 사용할 Amazon Bedrock 모델 |
| `aws_access_key_id` | SecretString | (입력) 인증용 AWS Access Key. 필수. |
| `aws_secret_access_key` | SecretString | (입력) 인증용 AWS Secret Key. 필수. |
| `aws_session_token` | SecretString | (입력) AWS 계정 세션 키. 임시 자격 증명에만 필요. |
| `credentials_profile_name` | String | (입력) 사용할 AWS 자격 증명 프로필 이름. 미제공 시 기본 프로필 사용. |
| `region_name` | String | (입력) Bedrock 리소스가 있는 AWS 리전. 기본값: `us-east-1` |
| `endpoint_url` | String | (입력) Bedrock 서비스의 커스텀 엔드포인트 URL |
| `temperature` | Float | (입력) 출력 무작위성 제어. 높을수록 더 무작위. 기본값: `0.7` |
| `max_tokens` | Integer | (입력) 생성할 최대 토큰 수. 기본값: `4096` |
| `top_p` | Float | (입력) Nucleus 샘플링 파라미터. 출력 다양성 제어. 기본값: `0.9` |
| `top_k` | Integer | (입력) 고려할 최고 확률 어휘 토큰 수 제한. 일부 모델만 지원. 기본값: `250` |
| `disable_streaming` | Boolean | (입력) True 시 스트리밍 응답 비활성화. 배치 처리에 유용. 기본값: `false` |
| `additional_model_fields` | Dictionary | (입력) 동작 미세 조정을 위한 추가 모델별 파라미터 |

## Amazon Bedrock Embeddings

[Amazon Bedrock](https://aws.amazon.com/bedrock/)에서 임베딩 모델 로드.

Flow에서 임베딩 모델 컴포넌트 사용 방법: [Embedding model components](/components-embedding-models) 참조.

### 파라미터

| Name | Type | 설명 |
|------|------|------|
| `model_id` | String | (입력) 호출할 모델 ID. 예: `amazon.titan-embed-text-v1`. `list-foundation-models` API의 `modelId` 속성과 동일. |
| `aws_access_key_id` | SecretString | (입력) 인증용 AWS Access Key |
| `aws_secret_access_key` | SecretString | (입력) 인증용 AWS Secret Key |
| `aws_session_token` | SecretString | (입력) AWS 계정 세션 키 |
| `credentials_profile_name` | String | (입력) `~/.aws/credentials` 또는 `~/.aws/config`의 AWS 자격 증명 프로필 이름 |
| `region_name` | String | (입력) 사용할 AWS 리전. 예: `us-west-2`. 미제공 시 `AWS_DEFAULT_REGION` 환경 변수 또는 `~/.aws/config`의 리전 사용. |
| `endpoint_url` | String | (입력) 기본 AWS 엔드포인트 외 특정 서비스 엔드포인트 URL |

## S3 Bucket Uploader

Amazon S3 버킷에 파일 업로드.

- **Read File** 또는 **Directory** 컴포넌트의 `Data` 입력 처리용으로 설계
- 다른 컴포넌트의 `Data` 업로드 시 프로덕션 전 테스트 필요
- `boto3` 패키지 필요 (Langflow 설치에 포함)
- 로그 생성, Flow에 출력 없음

### 파라미터

| Name | Type | 설명 |
|------|------|------|
| **AWS Access Key ID** | SecretString | (입력) 인증용 AWS Access Key ID |
| **AWS Secret Key** | SecretString | (입력) 인증용 AWS Secret Key |
| **Bucket Name** | String | (입력) 파일 업로드할 S3 버킷 이름 |
| **Strategy for file upload** | String | (입력) 파일 업로드 전략. **Store Data**(기본값): `Data` 입력을 순회하며 파일 경로와 텍스트 내용이 모두 있으면 S3에 업로드. **Store Original File**: 데이터 입력의 파일 경로를 가져와 S3에 업로드. |
| **Data Inputs** | Data | (입력) 지정된 S3 버킷에 파일로 업로드할 `Data` 입력 |
| **S3 Prefix** | String | (입력) 파일 업로드할 S3 버킷 내 선택적 접두사 (폴더 경로) |
| **Strip Path** | Boolean | (입력) 업로드 시 파일 경로 제거 여부. 기본값: `false` |

## Legacy Amazon 컴포넌트

다음 Amazon 컴포넌트가 Legacy 상태:

- **Amazon Bedrock** - **Amazon Bedrock Converse**로 대체

