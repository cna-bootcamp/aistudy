# Import and export flows

Flow를 Langflow 인스턴스 간에 전송, 다른 사용자와 공유, 백업 생성을 위해 내보내기/가져오기 가능.

## Export a flow

Flow 내보내기 방법 3가지:

### 1. Projects 페이지에서 내보내기

1. **Projects** 페이지에서 내보낼 Flow 찾기
2. **More** 클릭 → **Export** 선택
3. 프로젝트의 모든 Flow 내보내기: **Options** → **Download**

### 2. Share 메뉴에서 내보내기

1. Flow 편집 중 **Share** 클릭
2. **Export** 클릭

### 3. Langflow API로 내보내기

- 단일 Flow: `/flows/download` 엔드포인트
- 전체 프로젝트: `/projects/download` 엔드포인트

내보낸 Flow는 `FLOW_NAME.json` 파일로 로컬에 다운로드.
프로젝트 전체 내보내기 시 ZIP 아카이브로 패키징.

### Save with my API keys

**Projects** 페이지 또는 **Share** 메뉴에서 내보내기 시 **Save with my API keys** 옵션 선택 가능:
- Flow와 함께 정의된 API 키 변수 내보내기
- 비-API 키 변수는 설정과 관계없이 항상 포함

> **Warning**:
> - 컴포넌트 API 키 필드에 리터럴 키 입력 시 → 리터럴 값 내보내기
> - Langflow 전역 변수에 키 저장 시 → 변수 이름만 내보내기

다른 Langflow 인스턴스로 가져올 때 동일한 이름의 전역 변수가 있어야 Flow 정상 실행.
변수가 없거나 유효하지 않으면 가져오기 후 생성 또는 편집 필요.

## Import a flow

로컬 머신의 Langflow JSON 파일 가져오기 방법 3가지:

### 1. Projects 페이지에서 가져오기

1. **Projects** 페이지에서 **Upload a flow** 클릭
2. 가져올 Langflow JSON 파일 선택

### 2. 드래그 앤 드롭

파일 탐색기에서 Langflow JSON 파일을 Langflow 창으로 드래그 앤 드롭.
모든 Langflow 페이지에서 가능.

### 3. Langflow API로 가져오기

- 단일 JSON 파일: `/flows/upload/` 엔드포인트
- ZIP 아카이브: `/projects/upload` 엔드포인트

### Run an imported flow

가져온 Flow는 바로 사용 가능.
전역 변수가 포함된 경우 동일한 이름과 유효한 값을 가진 전역 변수 필요.

## Langflow JSON file contents

내보낸 Flow는 `FLOW_NAME.json` 파일로 저장.

### 구성 요소

| 요소 | 설명 |
|------|------|
| **Nodes** | Flow를 구성하는 컴포넌트 |
| **Edges** | 노드 간 연결 |
| **Metadata** | Flow 및 프로젝트 정보 |

### Nodes

컴포넌트를 나타내는 노드. 예시 (Chat Input 컴포넌트):

```json
{
  "data": {
    "description": "Get chat inputs from the Playground.",
    "display_name": "Chat Input",
    "id": "ChatInput-jFwUm",
    "node": {
      "base_classes": ["Message"],
      "template": {
        "input_value": {
          "display_name": "Text",
          "value": "Hello"
        },
        "sender": {
          "value": "User",
          "options": ["Machine", "User"]
        }
      }
    },
    "type": "ChatInput"
  },
  "position": {
    "x": 689.57,
    "y": 765.15
  }
}
```

- 노드 식별자 형식: `NODE_NAME-UUID` (예: `ChatInput-jFwUm`)
- 엔트리포인트 노드(ChatInput 등)가 Flow 실행 시 첫 번째로 실행

### Edges

노드 간 연결을 나타냄. 예시 (ChatInput → OpenAIModel 연결):

```json
{
  "data": {
    "sourceHandle": {
      "dataType": "ChatInput",
      "id": "ChatInput-jFwUm",
      "name": "message",
      "output_types": ["Message"]
    },
    "targetHandle": {
      "fieldName": "input_value",
      "id": "OpenAIModel-OcXkl",
      "inputTypes": ["Message"],
      "type": "str"
    }
  },
  "source": "ChatInput-jFwUm",
  "target": "OpenAIModel-OcXkl"
}
```

Edge는 소스 컴포넌트의 출력 타입과 타겟 컴포넌트의 입력 필드를 연결.

### Additional metadata

루트 `data` 객체에 저장되는 추가 정보:

**1. 메타데이터 및 프로젝트 정보**

```json
{
  "name": "Basic Prompting",
  "description": "Perform basic prompting with an OpenAI model.",
  "tags": ["chatbots"],
  "id": "1511c230-d446-43a7-bfc3-539e69ce05b8",
  "last_tested_version": "1.0.19.post2"
}
```

**2. 뷰포트 정보**

워크스페이스에서 Flow 열 때 뷰포트 위치:

```json
{
  "viewport": {
    "x": -37.61,
    "y": -155.91,
    "zoom": 0.757
  }
}
```

**3. Notes**

Flow의 목적, 설정 세부사항 등을 설명하는 주석.
Markdown 형식으로 인코딩되어 `node` 객체로 저장:

```json
{
  "id": "undefined-kVLkG",
  "node": {
    "description": "## 📖 README\nPerform basic prompting..."
  }
}
```

## See also

- [Build flows](/concepts-flows)
- [Share and embed flows](/concepts-publish)
