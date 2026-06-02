# Google 컴포넌트

**Bundles**는 Langflow와 특정 서드파티 통합을 지원하는 커스텀 컴포넌트를 포함함.

본 페이지는 **Google** 번들에서 사용 가능한 컴포넌트를 설명함.

## BigQuery

Langflow는 **BigQuery** 컴포넌트를 통해 Google BigQuery와 통합되며, BigQuery 데이터셋에서 SQL 쿼리를 실행하고 데이터를 검색할 수 있음.

### Flow에서 BigQuery 컴포넌트 사용

BigQuery 컴포넌트를 flow에서 사용하려면 다음이 필요함:

- BigQuery API가 활성화된 Google Cloud 프로젝트
- **BigQuery Job User** 역할을 가진 서비스 계정
- BigQuery 데이터셋 및 테이블
- 실행 중인 Langflow 서버

### BigQuery 액세스 권한이 있는 서비스 계정 생성

1. Google Cloud 프로젝트를 선택하고 활성화함
2. Google Cloud 프로젝트에서 서비스 계정을 생성함
3. 새 계정에 **BigQuery Job User** 역할을 할당함
4. 서비스 계정으로 이동하여 새 JSON 키를 생성함
5. **Add Key**를 클릭한 다음 **Create new key**를 클릭함
6. **Key type**에서 **JSON**을 선택한 다음 **Create**를 클릭함. JSON 비공개 키 파일이 머신에 다운로드됨

### Langflow 컴포넌트에서 인증 정보 구성

1. Langflow에서 새 flow를 생성함
2. **Bundles**에서 Google **BigQuery** 컴포넌트를 찾아 flow에 추가함
3. **BigQuery** 컴포넌트의 **Upload Service Account JSON** 필드에서 **Select file**을 클릭함
4. **My Files** 창에서 **Click or drag files here**를 선택함
5. 파일 브라우저에서 서비스 계정 JSON 파일을 선택하고 **Open**을 클릭함
6. **My Files** 창에서 서비스 계정 JSON 파일을 선택하고 **Select files**를 클릭함

### BigQuery 데이터셋 쿼리

1. **Chat Input** 및 **Chat Output** 컴포넌트를 **BigQuery** 컴포넌트에 연결함
2. **Playground**를 열고 유효한 SQL 쿼리를 제출함

예시 쿼리:
```sql
SELECT film, category, year_film
FROM `big-query-langflow-project.the_oscar_award.oscar_winners`
WHERE winner = TRUE
LIMIT 10
```

## Google Generative AI

Google Generative AI 모델을 사용하여 텍스트를 생성하는 컴포넌트.

지원 모델에는 Gemini 1.5, 2.0, 2.5, 3.0 시리즈가 포함됨. 최신 Gemini 3.0 모델(`gemini-3-pro-preview`,
`gemini-3-flash-preview`, `gemini-3-pro-image-preview`)은 고급 추론 및 멀티모달 기능을 제공함.

### Google Generative AI 파라미터

| Name | Type | Description |
|------|------|-------------|
| Google API Key | SecretString | 입력 파라미터. Google Generative AI에 사용할 Google API 키 |
| Model | String | 입력 파라미터. 사용할 모델 이름 (예: "gemini-1.5-pro" 또는 "gemini-3-pro-preview") |
| Max Output Tokens | Integer | 입력 파라미터. 생성할 최대 토큰 수 |
| Temperature | Float | 입력 파라미터. 추론 실행 시 사용할 temperature |
| Top K | Integer | 입력 파라미터. 가장 확률이 높은 상위 K개 토큰 세트 고려 |
| Top P | Float | 입력 파라미터. 샘플링 시 고려할 토큰의 최대 누적 확률 |
| N | Integer | 입력 파라미터. 각 프롬프트에 대해 생성할 채팅 완성 수 |
| model | LanguageModel | 출력 파라미터. 지정된 파라미터로 구성된 ChatGoogleGenerativeAI 인스턴스 |

## Google Generative AI Embeddings

**Google Generative AI Embeddings** 컴포넌트는 `langchain-google-genai` 패키지의 GoogleGenerativeAIEmbeddings 클래스를
사용하여 Google의 생성형 AI 임베딩 서비스에 연결함.

### Google Generative AI Embeddings 파라미터

| Name | Display Name | Info |
|------|--------------|------|
| api_key | API Key | 입력 파라미터. Google의 생성형 AI 서비스에 액세스하기 위한 비밀 API 키. 필수 |
| model_name | Model Name | 입력 파라미터. 사용할 임베딩 모델 이름. 기본값: "models/text-embedding-004" |
| embeddings | Embeddings | 출력 파라미터. 빌드된 GoogleGenerativeAIEmbeddings 객체 |

## Google Search API

Google Search API를 호출하는 컴포넌트.

### Google Search API 파라미터

| Name | Type | Description |
|------|------|-------------|
| google_api_key | SecretString | 입력 파라미터. 인증을 위한 Google API 키 |
| google_cse_id | SecretString | 입력 파라미터. Google Custom Search Engine ID |
| input_value | String | 입력 파라미터. 검색 쿼리 입력 |
| k | Integer | 입력 파라미터. 반환할 검색 결과 수 |
| results | List[Data] | 출력 파라미터. 검색 결과 목록 |
| tool | Tool | 출력 파라미터. LangChain에서 사용할 Google Search 도구 |

### 기타 Google Search 컴포넌트

Langflow는 Google Search를 지원하는 여러 컴포넌트를 포함함:

- **Apify Actors** 컴포넌트
- **SearchApi** 컴포넌트
- **Serper Google Search API** 컴포넌트
- **Web Search** 컴포넌트

## Google Vertex AI

Vertex AI 컴포넌트에 대한 정보는 **Vertex AI** 번들을 참조.

## Legacy Google 컴포넌트

Legacy 컴포넌트는 더 이상 지원되지 않으며 향후 릴리스에서 제거될 수 있음. 기존 flow에서 계속 사용할 수 있지만 가능한 한
빨리 지원되는 컴포넌트로 교체하는 것이 권장됨.

다음 Google 컴포넌트는 legacy 상태임:

### Google OAuth Token

Langflow 1.4.0에서 deprecated됨. Google OAuth 서비스에 flow를 연결하려면 Composio 컴포넌트를 사용함.

### Gmail Loader

Service Account JSON 인증 정보 및 레이블 ID 필터를 사용하여 Gmail에서 이메일을 로드하는 컴포넌트.
대안으로 Composio 컴포넌트를 사용하여 Google 서비스에 flow를 연결할 수 있음.

### Google Drive Loader

Service Account JSON 인증 정보 및 문서 ID 필터를 사용하여 Google Drive에서 문서를 로드하는 컴포넌트.
직접적인 대체는 없지만 **API Request** 컴포넌트를 사용하여 Google Drive API를 호출하는 것을 고려함.

### Google Drive Search

Service Account JSON 인증 정보 및 다양한 쿼리 문자열과 필터를 사용하여 Google Drive를 검색하는 컴포넌트.
직접적인 대체는 없지만 **API Request** 컴포넌트를 사용하여 Google Drive API를 호출하는 것을 고려함.

## 참고

- **Composio** 번들
- **Vertex AI** 번들
