# Configure tools for agents

기본적으로 Langflow 에이전트는 기본 LLM에 내장된 기능만 포함.
도구를 연결하여 추가적이고 타겟팅된 기능에 접근 가능.

**도구 활용 예시:**
- 고객 지원 에이전트: 회사 지식 베이스 접근
- 금융 에이전트: 주식 가격 조회
- 수학 튜터 에이전트: 고급 수학 함수로 복잡한 방정식 해결

## Attach tools

도구를 에이전트에 연결하는 방법:

1. 컴포넌트의 **Tool** 출력을 **Agent** 컴포넌트의 **Tools** 입력에 연결

**Tool Mode 활성화:**
- 일부 컴포넌트는 기본적으로 **Tool** 출력 제공
- 다른 컴포넌트는 헤더 메뉴에서 **Tool Mode** 활성화 필요

**특징:**
- 하나의 에이전트에 여러 도구 연결 가능
- 각 도구는 에이전트가 호출할 수 있는 여러 액션(함수) 보유
- Flow 실행 시 에이전트가 사용자 프롬프트에 응답하는 데 도움이 되는 도구를 판단하여 호출

### Edit a tool's actions

도구를 에이전트에 연결하면 각 도구에 여러 액션 사용 가능.
**Actions** 목록에서 사용 가능한 액션 확인.

액션의 레이블, 설명, 가용성을 변경하여:
- 에이전트가 도구 사용법을 이해하도록 지원
- 관련 없거나 원치 않는 액션 사용 방지

> **Tip**: 에이전트가 도구를 잘못 사용하는 경우:
> - 액션 메타데이터를 편집하여 도구 목적 명확화
> - 불필요한 액션 비활성화
> - **Prompt Template** 컴포넌트로 추가 지침이나 예시 전달

**액션 편집 방법:**
도구 컴포넌트에서 **Edit Tool Actions** 클릭

**액션 정보:**

| 필드 | 설명 |
|------|------|
| **Enabled** | 액션 활성화 여부 체크박스 |
| **Name** | 액션의 읽기 가능한 이름 (예: `Fetch Content`) - 변경 불가 |
| **Description** | 액션 목적 설명 (예: `Fetch content from web pages recursively`) - 편집 가능 |
| **Slug** | 인코딩된 액션 이름, 보통 스네이크 케이스 (예: `fetch_content`) - 편집 가능 |

일부 액션은 입력에 고정 값 제공 가능.
일반적으로 에이전트가 자체 값을 제공하도록 비워둠.
디버깅이나 특정 사용 사례에서 고정 입력 필요 시 사용.

## Use an agent as a tool

멀티 에이전트 Flow 생성을 위해 다른 **Agent** 컴포넌트를 도구로 사용 가능.

### 설정 방법

1. **Simple Agent** 템플릿 기반 Flow 생성
2. 두 번째 **Agent** 컴포넌트 추가
3. 두 **Agent** 컴포넌트에 **OpenAI API Key** 추가
4. 두 번째 **Agent**에서:
   - 모델을 `gpt-4.1`로 변경
   - **Tool Mode** 활성화
5. **Edit Tool Actions** 클릭하여 액션 편집:
   - Slug: `Agent-gpt-41`
   - Description: `Use the gpt-4.1 model for complex problem solving`
6. 새 에이전트의 **Toolset** 포트를 기존 에이전트의 **Tools** 포트에 연결

**활용 예시:**
- 특정 작업이나 도메인에 훈련된 전문화된 모델을 기본 에이전트에 연결
- 기본 에이전트가 쿼리에 응답할 때 필요에 따라 각 전문 에이전트 호출

## Add custom components as tools

에이전트는 커스텀 컴포넌트를 도구로 사용 가능.

### 설정 방법

1. **Core components** 또는 **Bundles** 메뉴에서 **New Custom Component** 클릭
2. **Code** 패널에 Python 코드 입력
3. 커스텀 컴포넌트에서 **Tool Mode** 활성화
4. 커스텀 컴포넌트의 도구 출력을 **Agent**의 **Tools** 입력에 연결
5. **Playground**에서 테스트

**예시 프롬프트:**
```
Use the text analyzer on this text: "Agents really are thinking machines!"
```

**예시 응답:**
```
Original Text: Agents really are thinking machines!
Word Count: 5
Character Count: 36
Sentence Count: 1
Reversed Text: !senihcam gnikniht era yllaer stnegA
Uppercase Text: AGENTS REALLY ARE THINKING MACHINES!
```

## Make any component a tool

**Tool Mode** 버튼이 없는 컴포넌트를 도구로 만드는 방법:

컴포넌트 입력 중 하나에 `tool_mode=True` 추가 후 새 **Toolset** 출력을 에이전트의 **Tools** 입력에 연결.

**Tool Mode 지원 데이터 타입:**
- `DataInput`
- `DataFrameInput`
- `PromptInput`
- `MessageTextInput`
- `MultilineInput`
- `DropdownInput`

**코드 예시:**

```python
inputs = [
    MessageTextInput(
        name="input_text",
        display_name="Input Text",
        info="Enter text to analyze",
        value="Hello, World!",
        tool_mode=True,
    ),
]
```

## Use flows as tools

에이전트는 **Run Flow** 컴포넌트로 다른 Flow를 도구로 사용 가능.

### 설정 방법

1. Flow에 **Run Flow** 컴포넌트 추가
2. 에이전트가 도구로 사용할 Flow 선택
3. **Tool Mode** 활성화 → 선택한 Flow가 **Run Flow** 컴포넌트의 액션이 됨
4. **Run Flow** 컴포넌트의 **Tool** 출력을 **Agent**의 **Tools** 입력에 연결
5. **Playground**에서 테스트:
   - `What tools are you using to answer my questions?` → 연결된 Flow가 사용 가능한 도구로 표시
   - 연결된 Flow를 사용하는 질문 → Flow 기반 응답 반환

## See also

- [Agent components](/components-agents)
- [Use Langflow as an MCP client](/mcp-client)
- [Use Langflow as an MCP server](/mcp-server)
