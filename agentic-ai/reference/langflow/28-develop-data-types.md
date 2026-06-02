# Langflow data types

Langflow 컴포넌트는 특정 유형의 입력과 출력을 수락하고 생성하도록 설계.
입력 및 출력 데이터 유형은 컴포넌트 간 정보의 구조와 흐름 정의.

[컴포넌트 포트](/concepts-components#component-ports)는 각 컴포넌트가 보내고 받을 수 있는 데이터 유형 표현.
[포트 색상](/concepts-components#port-colors)은 포트의 데이터 유형 표시.

Flow 구축 시 동일한 유형(색상)의 출력 포트를 입력 포트에 연결하여 두 컴포넌트 간 해당 유형의 데이터 전송.

> **Tip**:
> - 워크스페이스에서 포트 위에 마우스를 올리면 해당 포트의 연결 세부 정보 표시
> - 포트 클릭 시 호환 컴포넌트 검색
> - 두 컴포넌트의 데이터 유형이 호환되지 않으면 **Type Convert** 컴포넌트로 데이터 변환

## Data

**Data** 포트 (빨간색 🔴): `Data` 유형 수락 또는 생성.
API에 보내는 JSON 페이로드와 같은 구조화된 데이터 객체.
사용자 프로필, 설정 또는 기타 구조화된 정보와 같은 키-값 쌍 전달에 사용.

`Data` 객체는 `text_key`로 표시되는 기본 텍스트 필드와 추가 메타데이터 포함.

### Schema and attributes

스키마: [data.py](https://github.com/langflow-ai/langflow/blob/main/src/backend/base/langflow/schema/data.py)

| 속성 | 설명 |
|------|------|
| `data` | 키-값 쌍 저장. `Data` 객체의 핵심 딕셔너리 |
| `text_key` | `data`에서 기본 텍스트 값으로 간주되는 키 |
| `default_value` | `text_key` 누락 시 폴백. 기본값: `"text"` |

**Python 예시:**
```python
data_obj = Data(
    text_key="text",
    data={
        "text": "Hello world",
        "name": "Charlie",
        "age": 28
    },
    default_value=""
)
```

**JSON 직렬화:**
```json
{
  "text_key": "text",
  "data": {
    "text": "Hello world",
    "name": "Charlie",
    "age": 28
  },
  "default_value": ""
}
```

## DataFrame

**DataFrame** 포트 (분홍색 🩷): [pandas DataFrames](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.html) 수락 또는 생성.
CSV 데이터와 유사한 테이블 형식 데이터.

여러 행 또는 레코드가 포함된 데이터 작업에 `DataFrame` 유형 사용.

### Schema and attributes

스키마: [dataframe.py](https://github.com/langflow-ai/langflow/blob/main/src/backend/base/langflow/schema/dataframe.py)

**특징:**
- **완전한 pandas 호환성**: 모든 pandas DataFrame 메서드 및 기능 지원
- **Langflow 통합**: `Data` 객체 목록, 딕셔너리, 기존 DataFrame 수락
- **편의 메서드**: `to_data_list()`, `add_row()`, `add_rows()`, `to_lc_documents()`, `to_data()`, `to_message()`
- **Text key 지원**: `Data` 객체 호환을 위한 `text_key` 및 `default_value` 속성 유지

**DataFrame 구조:**
```json
[
  {"name": "Charlie Lastname", "age": 28, "email": "charlie.lastname@example.com"},
  {"name": "Alexandra Example", "age": 34, "email": "alexandra@example.com"}
]
```

**테이블 형식:**
| name | age | email |
|------|-----|-------|
| Charlie Lastname | 28 | charlie.lastname@example.com |
| Alexandra Example | 34 | alexandra@example.com |

## Embeddings

**Embeddings** 포트 (에메랄드색 💚): 유사성 검색과 같은 기능 지원을 위한 벡터 임베딩 생성 또는 수집.

[임베딩 모델 컴포넌트](/components-embedding-models) 및 벡터 스토어 컴포넌트에서 사용.

예: 임베딩 모델 컴포넌트가 `Embeddings` 데이터 출력 → 벡터 스토어 컴포넌트의 **Embedding** 입력 포트에 연결.

## LanguageModel

`LanguageModel` 유형: 언어 모델 컴포넌트가 생성하고 LLM을 사용하는 컴포넌트가 수락하는 특정 데이터 유형.

**LanguageModel** 포트 (자홍색 💜): 언어 모델 컴포넌트의 출력 유형을 **Model Response**에서 **Language Model**로 변경 시 표시.

자세한 정보: [Language model components](/components-models#language-model-output-types)

## Memory

**Memory** 포트 (주황색 🟠): **Message History** 컴포넌트를 외부 채팅 메모리 저장소와 통합하는 데 사용.

자세한 정보: [Message History component](/message-history)

## Message

**Message** 포트 (남색 💙): `Message` 데이터 수락 또는 생성.
`Data` 유형을 확장하여 채팅 Flow에서 일반적으로 사용되는 텍스트 입력을 위한 추가 필드 및 메서드 포함.

### Schema, structure, and attributes

스키마: [message.py](https://github.com/langflow-ai/langflow/blob/main/src/backend/base/langflow/schema/message.py)

**JSON 예시:**
```json
{
  "text": "Name: Charlie Lastname, Age: 28, Email: charlie.lastname@example.com",
  "sender": "User",
  "sender_name": "Charlie Lastname",
  "session_id": "some-session-id",
  "timestamp": "2024-06-01T12:00:00Z",
  "files": [],
  "content_blocks": [],
  "category": "message"
}
```

**주요 속성:**

| 속성 | 설명 |
|------|------|
| `text` | 메인 메시지 내용 |
| `sender` | 채팅 메시지 발신자 식별 (`User` 또는 `Language Model`) |
| `sender_name` | 발신자 표시 이름. 기본값: `User` 또는 `Language Model` |
| `session_id` | 채팅 [세션 식별자](/session-id) |
| `flow_id` | 메시지가 연결된 Flow의 ID |
| `timestamp` | 메시지 전송 UTC 타임스탬프 |
| `files` | 메시지에 포함된 파일 경로 또는 이미지 목록 |
| `content_blocks` | 리치 콘텐츠 입력 컨테이너 (텍스트, 미디어, 코드). 오류 메시지 정보도 포함 |
| `category` | `"message"`, `"error"`, `"warning"`, `"info"` 중 하나 |

### Message data in Input and Output components

**Chat Input/Output 컴포넌트가 있는 Flow:**
- `Message` 데이터가 채팅 상호작용을 위한 일관된 구조 제공
- 챗봇, 대화 분석 및 LLM/에이전트와의 대화 기반 사용 사례에 적합
- Playground 채팅 인터페이스는 대화에 관련된 `Message` 속성만 출력

**Text Input/Output 컴포넌트가 있는 Flow:**
- `Message` 데이터가 채팅 관련 메타데이터 없이 단순 텍스트 문자열 전달
- 독립적인 텍스트 문자열로 처리, 진행 중인 대화의 일부가 아님

## Tool

**Tool** 포트 (시안색 🩵): 도구를 **Agent** 컴포넌트에 연결.

도구 유형:
- **Tool Mode** 활성화된 다른 컴포넌트
- 전용 **MCP Tools** 컴포넌트
- **Tool Mode**만 지원하는 기타 컴포넌트

여러 도구를 동일한 포트에서 동일한 **Agent** 컴포넌트에 연결 가능.

기능적으로 `Tool` 데이터는 에이전트 Flow에서 사용 가능한 LangChain `StructuredTool` 객체.

자세한 정보: [Configure tools for agents](/agents-tools), [Use Langflow as an MCP client](/mcp-client)

## Unknown or multiple types

포트가 여러 데이터 유형을 수락하거나 생성할 수 있는 경우 회색 포트 아이콘 (⚪)으로 표시.
포트 위에 마우스를 올리면 수락 또는 생성되는 데이터 유형 표시.

## View data types in flows

Langflow에서 **Inspect output**을 사용하여 개별 컴포넌트의 출력 확인 가능.
다양한 데이터 유형 학습 및 유효하지 않거나 잘못된 형식의 입출력 문제 디버깅에 유용.

## See also

- [Custom components](/components-custom-components)
- [Pydantic Models](https://docs.pydantic.dev/latest/api/base_model/)
- [pandas.DataFrame](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.html)
