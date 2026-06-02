# Use Langflow agents

Langflow의 **Agent** 컴포넌트는 에이전트 Flow 구축의 핵심.
여러 LLM 제공자, 도구 호출, 커스텀 지침 등 에이전트 생성에 필요한 모든 것 제공.
에이전트 설정을 단순화하여 애플리케이션 개발에 집중 가능.

## Use the Agent component in a flow

빈 Flow에서 에이전트 Flow 생성 단계.
사전 구축 예제: **Simple Agent** 템플릿 또는 [Langflow quickstart](/get-started-quickstart).

### 기본 설정

1. **New Flow** → **Blank Flow** 클릭
2. **Agent** 컴포넌트를 Flow에 추가
3. 제공자와 모델 선택
   - 기본: OpenAI 모델
   - 다른 제공자 사용 시 **Model Provider**와 **Model Name** 필드 수정
   - 목록에 없는 모델: **Model Name** 필드에 전체 모델명 입력
4. 선택한 모델 제공자의 유효한 자격 증명 입력
5. **Chat Input**과 **Chat Output** 컴포넌트 추가 및 **Agent**에 연결

이 시점에서 기본 LLM 기반 채팅 Flow 완성. **Playground**에서 테스트 가능.
하지만 이것은 단순히 LLM과 채팅하는 것. 진정한 에이전트로 만들려면 도구 추가 필요.

### 도구 추가

6. **Web Search**, **URL**, **Calculator** 컴포넌트 추가
7. 각 컴포넌트에서 **Tool Mode** 활성화:
   - 컴포넌트 클릭하여 헤더 메뉴 노출
   - **Tool Mode** 활성화
   - 각 도구의 **Toolset** 포트를 **Agent**의 **Tools** 포트에 연결

**Tool Mode**: 컴포넌트를 도구로 변환하여 입력 수정.
**Tool Mode** 활성화 시 컴포넌트는 **Agent**로부터 요청을 받아 사용 가능한 액션을 도구로 사용 가능.

자세한 정보: [Configure tools for agents](/agents-tools)

### 테스트

8. **Playground** 열고 에이전트에게 질문: `What tools are you using to answer my questions?`
   - 에이전트가 연결된 도구 목록으로 응답

9. 특정 도구 테스트: `Summarize today's tech news`
   - **Playground**에서 에이전트의 도구 호출, 입력, 원시 출력 표시
   - **Web Search** 컴포넌트의 **Search Mode**가 **News**로 설정되어 호출

다른 도구 컴포넌트 연결하거나 [Langflow를 MCP 클라이언트로 사용](/mcp-client)하여 더 복잡한 작업 지원 가능.
멀티 에이전트 예제: [Use an agent as a tool](/agents-tools#use-an-agent-as-a-tool)

## Agent component parameters

**Agent** 컴포넌트를 원하는 제공자/모델, 커스텀 지침, 도구로 설정 가능.
일부 파라미터는 비주얼 에디터에서 기본적으로 숨겨짐.
모든 파라미터는 컴포넌트 헤더 메뉴의 **Controls**에서 수정 가능.

### Provider and model

| 설정 | 파라미터 | 설명 |
|------|----------|------|
| **Model Provider** | `agent_llm` | 모델 제공자 선택 |
| **Model Name** | `llm_model` | 에이전트가 사용할 LLM 선택 |

다른 제공자/모델 접근 방법:
- **Model Provider**를 **Connect other models**로 설정 후 [language model component](/components-models) 연결
- 원하는 제공자 선택 후 **Model Name** 필드에 전체 모델명 입력

임베딩 생성 필요 시 [embedding model component](/components-embedding-models) 사용.

### Model provider API key

**API Key** 필드에 모델 제공자의 유효한 인증 키 입력.

API 키 저장 권장 방법:
- [global variable](/configuration-global-variables)
- [environment variables](/environment-variables)

자세한 정보: [Add component API keys to Langflow](/api-keys-and-authentication#component-api-keys)

**Connect other models** 선택 시 인증은 들어오는 language model 컴포넌트에서 처리.

### Agent instructions and input

| 설정 | 파라미터 | 설명 |
|------|----------|------|
| **Agent Instructions** | `system_prompt` | 모든 대화에 사용할 커스텀 지침 |
| **Input** | `input_value` | 직접 입력 또는 다른 컴포넌트(예: Chat Input)에서 제공 |

### Tools

에이전트는 적절한 도구가 있을 때 가장 유용.

**Agent** 컴포넌트는 다른 에이전트와 MCP 서버를 포함한 모든 Langflow 컴포넌트를 도구로 사용 가능.

도구 연결 방법:
1. 연결할 컴포넌트에서 **Tool Mode** 활성화
2. **Agent** 컴포넌트의 **Tools** 포트에 연결

자세한 정보: [Configure tools for agents](/agents-tools)

> **Tip**: MCP 서버의 도구를 에이전트가 사용하려면 [MCP Tools component](/mcp-tools) 사용.

### Agent memory

Langflow 에이전트는 기본적으로 활성화된 내장 채팅 메모리 보유.
이전 대화의 메시지를 검색하고 참조하여 각 채팅 세션 ID별로 롤링 컨텍스트 윈도우 유지.

채팅 메모리는 [session ID](/session-id) (`session_id`)로 그룹화.
동일한 Flow를 실행하는 다른 사용자/애플리케이션의 채팅 메모리 분리 필요 시 커스텀 세션 ID 사용 권장.

기본적으로 **Agent** 컴포넌트는 Langflow 설치의 스토리지 사용.
**Number of Chat History Messages** 파라미터로 검색할 채팅 메시지 수 설정 가능.

**Message History** 컴포넌트:
- 기본 채팅 메모리에는 불필요
- Mem0 같은 외부 채팅 메모리 사용 시 필요
- 메모리 정렬, 필터링, 제한에 더 많은 옵션 제공

자세한 정보: [Store chat memory](/memory#store-chat-memory), [Message History component](/message-history)

### Additional parameters

제공자와 모델에 따라 사용 가능한 파라미터 변경.

| 파라미터 | 설정 | 설명 |
|----------|------|------|
| `add_current_date_tool` | **Current Date** | `true` 시 현재 날짜 검색 도구 추가 |
| `handle_parsing_errors` | **Handle Parse Errors** | `true` 시 사용자 입력 분석 시 오류(오타 등) 수정 |
| `verbose` | **Verbose** | `true` 시 디버깅/분석용 상세 로깅 출력 |

## Agent component output

**Agent** 컴포넌트 출력: **Response** (`response`)
- [Message data](/data-types#message) 타입
- 쿼리에 대한 에이전트의 원시 응답 포함

일반적으로 **Chat Output** 컴포넌트로 전달하여 사람이 읽을 수 있는 형식으로 반환.
사용자에게 반환하기 전/추가로 응답 처리가 필요하면 다른 컴포넌트로 전달 가능.

## See also

- [Agent and MCP Tools components](/components-agents)
- [Configure tools for agents](/agents-tools)
