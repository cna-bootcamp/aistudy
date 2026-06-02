# Legacy Core Components

**Legacy 컴포넌트**는 더 이상 지원되지 않으며 향후 릴리스에서 제거될 수 있음.
기존 Flow에서 계속 사용 가능하지만, 가능한 빨리 지원되는 컴포넌트로 교체 권장.
권장 대체 컴포넌트는 Flow 내 컴포넌트의 **Legacy** 배너에 표시됨.

## Legacy 컴포넌트 찾기 및 대체

- **검색** 기능으로 공급자, 서비스 또는 컴포넌트 이름으로 검색
- 완전히 새로운 컴포넌트, 유사 컴포넌트, 또는 다른 카테고리의 새 버전으로 대체되었을 수 있음
- 명확한 대체품이 없는 경우 다른 컴포넌트 적용 고려 (예: [API Request](/api-request) 같은 Core 컴포넌트)
- Legacy 컴포넌트 코드로 커스텀 컴포넌트 생성 가능
- 새 Flow에서 Legacy 컴포넌트 사용 방지를 위해 기본적으로 숨김
  - 비주얼 에디터에서 **Component settings** → **Legacy** 필터 토글로 표시 가능

## Legacy Data 컴포넌트

| Legacy 컴포넌트 | 대체 컴포넌트 |
|----------------|--------------|
| **Load CSV** | [Read File](/read-file) 컴포넌트 |
| **Load JSON** | [Read File](/read-file) 컴포넌트 |

**Read File** 컴포넌트는 CSV, JSON 외에도 다양한 파일 형식 지원.

## Legacy Helper 컴포넌트

| Legacy 컴포넌트 | 대체 컴포넌트 | 설명 |
|----------------|--------------|------|
| **Message Store** | [Message History](/message-history) | 채팅 메시지 저장/검색 |
| **Create List** | [Processing 컴포넌트](/concepts-components) | 리스트 생성 기능 |
| **ID Generator** | 커스텀 코드 | 임의 코드 실행 컴포넌트 또는 외부 애플리케이션 코드에 ID 생성 스크립트 포함 |
| **Output Parser** | [Structured Output](/structured-output) + [Parser](/parser) | 데이터 타입과 파싱 작업 복잡도에 따라 선택 |

### Output Parser 대체 상세

- **Output Parser**: LangChain의 `CommaSeparatedListOutputParser`를 사용하여 LLM 출력을 CSV 형식으로 변환
  - 예: `["item1", "item2", "item3"]`
- **Structured Output**: 커스텀 스키마 및 복잡한 파싱 지원으로 좋은 대안
- **Parser** 컴포넌트: 형식 지시와 파싱 기능만 제공 (프롬프트 미포함)
  - **Prompt Template** 컴포넌트와 연결하여 LLM이 사용할 프롬프트 생성 필요

## Legacy Logic 컴포넌트

| Legacy 컴포넌트 | 대체 방법 |
|----------------|----------|
| **Condition** | 새로운 Flow 제어 컴포넌트 사용 |
| **Pass** | 새로운 Flow 제어 컴포넌트 사용 |
| **Flow As Tool** | [Run Flow](/run-flow) 컴포넌트 |
| **Sub Flow** | [Run Flow](/run-flow) 컴포넌트 |

## Legacy Processing 컴포넌트

다음 Processing 컴포넌트들이 Legacy 상태:

- **Alter Metadata**
- **Combine Data**
- **Combine Text**
- **Create Data**
- **Data to DataFrame / Data to Message**
- **Extract Key**
- **Filter Data**
- **Filter Values**
- **JSON Cleaner**
- **Message to Data**
- **Parse DataFrame**
- **Parse JSON**
- **Regex Extractor**
- **Select Data**
- **Update Data**

이러한 컴포넌트들은 새로운 Core 컴포넌트나 Processing 컴포넌트로 대체 가능.

## Legacy Tools 컴포넌트

| Legacy 컴포넌트 | 대체 컴포넌트/번들 |
|----------------|------------------|
| **Calculator Tool** | [Calculator](/calculator) 컴포넌트 |
| **Python Code Structured** | [Python Interpreter](/python-interpreter) 컴포넌트 |
| **Python REPL** | [Python Interpreter](/python-interpreter) 컴포넌트 |
| **Search API** | [SearchApi](/bundles-searchapi) 번들 |
| **SearXNG Search** | 다른 공급자의 검색 컴포넌트, 커스텀 컴포넌트, 또는 [API Request](/api-request) 컴포넌트 |
| **Serp Search API** | **SerpApi** 번들 |
| **Tavily Search API** | **Tavily** 번들 |
| **Wikidata API** | [Wikipedia](/bundles-wikipedia) 번들 |
| **Wikipedia API** | [Wikipedia](/bundles-wikipedia) 번들 |
| **Yahoo! Finance** | **Yahoo! Search** 번들 |

