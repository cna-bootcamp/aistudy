# CUGA

**CUGA (ConfigUrable Generalist Agent)** 번들은 도구, 브라우저 자동화, 구조화된 출력 생성을 사용하여 복잡한 작업을 실행하는 고급 AI 에이전트 컴포넌트 제공.

자세한 정보: [CUGA 프로젝트 저장소](https://github.com/cuga-project/cuga-agent)

> **모델 제공자 제한**: **CUGA** 컴포넌트는 **OpenAI**와 **watsonx** 모델만 지원.
> 다른 모델 제공자 사용 시 코어 [Agent 컴포넌트](/agents) 사용 권장.

## 개요

**CUGA** 컴포넌트는 Flow에서 [Agent 컴포넌트](/agents) 대신 사용 가능.

코어 **Agent** 컴포넌트와 동일하게:
- **Tools** 포트에 연결된 도구 사용 가능
- 자체적으로 도구로 사용 가능

**추가 기능**:
- **브라우저 자동화**: [Playwright](https://playwright.dev/docs/intro)를 사용한 웹 스크래핑
  - `browser_enabled` 파라미터를 `true`로 설정
  - `web_apps` 파라미터에 단일 URL 지정 (형식: `https://example.com`)
- **커스텀 지침 로드**: 에이전트 실행 지침이 포함된 마크다운 파일 첨부
  - **Instructions** 입력에 마크다운 파일 연결

## Flow에서 CUGA 컴포넌트 사용

1. **Simple Agent** 템플릿 기반 Flow 생성 후 **Agent** 컴포넌트를 **CUGA** 컴포넌트로 교체
2. [MCP Tools 컴포넌트](/mcp-client)와 [Calculator 컴포넌트](/calculator)를 **CUGA** 컴포넌트의 **Tools** 포트에 연결
3. [Read File 컴포넌트](/read-file)를 **CUGA** 컴포넌트의 **Instructions** 포트에 연결
   또는 **Edit text**를 클릭하여 지침을 직접 입력
4. 컴퓨터에 `instructions.md` 마크다운 파일 생성:
   ```markdown
   ## Plan

   - Break down complex queries into subtasks
   - Prioritize information gathering before execution
   - Consider dependencies between actions
   - Validate intermediate results before proceeding

   ## Answer

   - Provide concise summaries with key findings
   - Include relevant data points and metrics
   - Cite sources when using MCP tool results
   - Use clear structure and formatting for readability
   ```
   > **중요**: 에이전트가 지침을 이해하도록 `## Plan`과 `## Answer` 형식으로 명확히 포맷팅
5. **Read File** 컴포넌트에 `instructions.md` 파일 첨부
6. **Playground**에서 연결된 MCP 서버 관련 질문으로 테스트

## 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Type | 설명 |
|------|------|------|
| `agent_llm` | Dropdown | 에이전트용 모델 제공자 |
| `instructions` | Multiline String | 에이전트의 계획 및 응답을 정의하는 커스텀 지침. 직접 입력 또는 마크다운 파일로 제공. |
| `n_messages` | Integer | 검색할 채팅 기록 메시지 수. `session_id`로 식별되는 진행 중인 대화의 컨텍스트 유지에 유용. 기본값: `100` |
| `format_instructions` | Multiline String | 구조화된 출력용 템플릿 |
| `output_schema` | Table | 제공 시 구조화된 응답을 동적으로 빌드된 스키마에 대해 검증. 필드: `name`, `description`, `type`(str, int, float, bool, dict), `multiple`(리스트로) |
| `add_current_date_tool` | Boolean | true 시 현재 날짜를 반환하는 도구 추가. 기본값: `true` |
| `lite_mode` | Boolean | CugaLite 모드 활성화로 적은 수의 도구 사용 시 빠른 실행. 기본값: `true` |
| `lite_mode_tool_threshold` | Integer | CugaLite 자동 활성화 임계값. 연결된 도구 수가 이 임계값보다 적으면 CugaLite 활성화. 기본값: `25` |
| `decomposition_strategy` | Dropdown | 작업 분해 전략. `flexible`: 앱당 여러 하위 작업 허용. `exact`: 앱당 하나의 하위 작업 강제. 기본값: `flexible` |
| `browser_enabled` | Boolean | 웹 스크래핑 및 검색을 위한 내장 브라우저 활성화. 응답에서 일반 웹 검색 사용 허용. 기본값: `false` |
| `web_apps` | Multiline String | `browser_enabled`가 true일 때 에이전트가 내장 브라우저로 열 수 있는 단일 URL 지정 (예: `https://example.com`). 공용 및 사설 인터넷 리소스 모두 접근 가능. |

