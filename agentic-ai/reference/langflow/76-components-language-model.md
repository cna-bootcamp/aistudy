# Language Model

지정된 대규모 언어 모델(LLM)을 사용하여 텍스트 생성.
채팅 메시지, 파일, 지시사항 등의 입력을 받아 텍스트 응답 생성.

Langflow는 다양한 LLM을 기본 지원하는 **Language Model** 코어 컴포넌트 제공.
또는 **Language Model** 코어 컴포넌트 대신 [추가 언어 모델](#추가-언어-모델) 사용 가능.

## Flow에서 사용 방법

Flow에서 LLM을 사용하는 모든 곳에서 Language Model 컴포넌트 사용 가능.

### Chat 예시 (Basic Prompting 템플릿과 유사)

1. **Language Model** 코어 컴포넌트 추가 후 OpenAI API 키 입력
   - 기본 OpenAI 모델 사용
   - 다른 제공자/모델 사용 시 **Model Provider**, **Model Name**, **API Key** 필드 수정

   > 선호하는 제공자/모델이 목록에 없으면 [추가 언어 모델](#추가-언어-모델)로 컴포넌트 대체 가능.
   > **Bundles** 또는 **Search**에서 제공자 검색.

2. 컴포넌트 헤더 메뉴 → **Controls** → **System Message** 활성화 → **Close**

3. **Prompt Template** 컴포넌트 추가

4. **Template** 필드에 LLM 지시사항 입력
   - 예: `You are an expert in geography who is tutoring high school students`

5. **Prompt Template** 출력 → **Language Model**의 **System Message** 입력 연결

6. **Chat Input** 및 **Chat Output** 컴포넌트 추가 (LLM과 직접 채팅 상호작용에 필수)

7. **Chat Input** → **Language Model**의 **Input** 연결
   **Language Model**의 **Message** 출력 → **Chat Output** 연결

8. **Playground**에서 질문하여 테스트
   - 예: `What is the capital of Utah?`

9. (선택) 다른 모델/제공자로 응답 차이 비교

## Language Model 파라미터

**Language Model** 코어 컴포넌트의 파라미터. 다른 Language Model 컴포넌트는 추가/다른 파라미터 가질 수 있음.

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Type | 설명 |
|------|------|------|
| `provider` | String | (입력) 사용할 모델 제공자 |
| `model_name` | String | (입력) 사용할 모델 이름. 선택한 제공자에 따라 옵션 다름 |
| `api_key` | SecretString | (입력) 선택한 제공자 인증을 위한 API 키 |
| `input_value` | String | (입력) 모델에 보낼 입력 텍스트 |
| `system_message` | String | (입력) 어시스턴트 동작 설정에 도움이 되는 시스템 메시지 |
| `stream` | Boolean | (입력) 응답 스트리밍 여부. 기본값: `false` |
| `temperature` | Float | (입력) 응답의 무작위성 제어. 범위: `[0.0, 1.0]`. 기본값: `0.1` |
| `model` | LanguageModel | (출력) 기본 `Message` 출력의 대안 출력 타입. 지정된 파라미터로 구성된 Chat 인스턴스 생성 |

## Language Model 출력 타입

코어 컴포넌트와 번들 컴포넌트를 포함한 Language Model 컴포넌트는 두 가지 출력 타입 생성 가능:

| 출력 타입 | 설명 |
|----------|------|
| **Model Response** | 기본 출력 타입. 모델이 생성한 응답을 `Message` 데이터로 내보냄. LLM이 주어진 입력을 기반으로 텍스트 응답을 생성하는 일반적인 LLM 상호작용에 사용 |
| **Language Model** | **Agent**나 **Smart Transform** 컴포넌트 등 Flow의 다른 컴포넌트에 LLM을 연결해야 할 때 `LanguageModel` 출력 타입으로 변경. 이 구성에서는 직접 채팅 상호작용이 아닌 다른 컴포넌트가 완료하는 작업 지원 |

## 추가 언어 모델

**Language Model** 코어 컴포넌트에서 제공자/모델이 지원되지 않으면 **Bundles**에서 추가 Language Model 컴포넌트 사용 가능.

코어 **Language Model** 컴포넌트와 동일한 방식으로 사용.

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

