# Embedding Model

지정된 대규모 언어 모델(LLM)을 사용하여 텍스트 임베딩 생성.

Langflow는 일부 LLM을 기본 지원하는 **Embedding Model** 코어 컴포넌트 제공.
또는 **Embedding Model** 코어 컴포넌트 대신 [추가 임베딩 모델](#추가-임베딩-모델) 사용 가능.

## Flow에서 사용 방법

Flow에서 임베딩을 생성해야 하는 모든 곳에서 Embedding Model 컴포넌트 사용 가능.

### 시맨틱 검색 시스템 예시

텍스트 파일 로드 → 텍스트를 청크로 분할 → 각 청크의 임베딩 생성 → 청크와 임베딩을 벡터 스토어에 로드.
입출력 컴포넌트로 사용자가 채팅 인터페이스를 통해 벡터 스토어 쿼리 가능.

1. Flow 생성 후 **Read File** 컴포넌트 추가, 테스트용 텍스트 데이터(PDF 등) 포함 파일 선택

2. **Embedding Model** 코어 컴포넌트 추가 후 유효한 OpenAI API 키 제공
   - API 키 직접 입력 또는 전역 변수 사용

   > 선호하는 제공자/모델이 목록에 없으면 [추가 임베딩 모델](#추가-임베딩-모델)로 코어 컴포넌트 대체 가능.
   > **Bundles** 또는 **Search**에서 제공자 검색 (예: **Hugging Face Embeddings Inference** 컴포넌트).

3. **Split Text** 컴포넌트 추가 (텍스트 입력을 임베딩 처리용 작은 청크로 분할)

4. 벡터 스토어 컴포넌트 추가 (예: **Chroma DB**), 벡터 데이터베이스 연결 구성
   - 유사도 검색용으로 생성된 임베딩 저장

5. 컴포넌트 연결:
   - **Read File**의 **Loaded Files** 출력 → **Split Text**의 **Data or DataFrame** 입력
   - **Split Text**의 **Chunks** 출력 → 벡터 스토어의 **Ingest Data** 입력
   - **Embedding Model**의 **Embeddings** 출력 → 벡터 스토어의 **Embedding** 입력

6. 벡터 스토어 쿼리용 **Chat Input** 및 **Chat Output** 컴포넌트 추가:
   - **Chat Input** → 벡터 스토어의 **Search Query** 입력
   - 벡터 스토어의 **Search Results** 출력 → **Chat Output**

7. **Playground**에서 검색 쿼리 입력하여 쿼리와 가장 의미적으로 유사한 텍스트 청크 검색

## Embedding Model 파라미터

**Embedding Model** 코어 컴포넌트의 파라미터. 다른 임베딩 모델 컴포넌트는 추가/다른 파라미터 가질 수 있음.

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Display Name | Type | 설명 |
|------|--------------|------|------|
| `provider` | Model Provider | List | (입력) 임베딩 모델 제공자 선택 |
| `model` | Model Name | List | (입력) 사용할 임베딩 모델 선택 |
| `api_key` | OpenAI API Key | Secret[String] | (입력) 제공자 인증에 필요한 API 키 |
| `api_base` | API Base URL | String | (입력) API 기본 URL. 기본값 사용 시 비워둠 |
| `dimensions` | Dimensions | Integer | (입력) 출력 임베딩의 차원 수 |
| `chunk_size` | Chunk Size | Integer | (입력) 처리할 텍스트 청크 크기. 기본값: `1000` |
| `request_timeout` | Request Timeout | Float | (입력) API 요청 타임아웃 |
| `max_retries` | Max Retries | Integer | (입력) 최대 재시도 횟수. 기본값: `3` |
| `show_progress_bar` | Show Progress Bar | Boolean | (입력) 임베딩 생성 중 진행률 표시줄 표시 여부 |
| `model_kwargs` | Model Kwargs | Dictionary | (입력) 모델에 전달할 추가 키워드 인수 |
| `embeddings` | Embeddings | Embeddings | (출력) 선택한 제공자를 사용하여 임베딩을 생성하는 인스턴스 |

## 추가 임베딩 모델

**Embedding Model** 코어 컴포넌트에서 제공자/모델이 지원되지 않으면 임베딩을 생성하는 다른 컴포넌트로 대체 가능.

**Bundles** 또는 **Search**에서 선호하는 제공자 검색.

## 벡터 스토어와 모델 연동

벡터 데이터는 챗봇, 에이전트 등 LLM 애플리케이션에 필수적.

LLM만으로 일반적인 채팅 상호작용과 공통 작업 가능하지만, 컨텍스트 감도(RAG 등)와 커스텀 데이터셋(내부 비즈니스 데이터 등)으로 애플리케이션 향상 가능. 이를 위해 추가 컨텍스트를 제공하고 의미 있는 쿼리를 정의하는 벡터 데이터베이스와 벡터 검색 통합 필요.

Langflow는 벡터 데이터 읽기/쓰기가 가능한 벡터 스토어 컴포넌트 포함:
- 임베딩 저장
- 유사도 검색
- Graph RAG 탐색
- OpenSearch 같은 전용 검색 인스턴스

상호 의존적 기능으로 인해 동일 Flow 또는 종속 Flow 시리즈에서 벡터 스토어, 언어 모델, 임베딩 모델 컴포넌트를 함께 사용하는 것이 일반적.

**Bundles** 또는 **Search**에서 선호하는 벡터 데이터베이스 제공자 검색.

