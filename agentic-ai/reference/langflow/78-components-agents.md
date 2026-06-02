# Agents

Langflow의 **Agent** 컴포넌트는 에이전트 Flow 구축의 핵심.
Flow에서 AI 에이전트의 동작과 기능 정의.

## 에이전트 Flow 예시

**Agent** 컴포넌트를 사용하는 Flow 예시:

- **[Langflow 빠른 시작](/get-started-quickstart)**: **Simple Agent** 템플릿으로 시작하여 도구를 수정하고, 애플리케이션에서 에이전트 Flow 사용법 학습
  - **Simple Agent** 템플릿: 두 개의 다른 Langflow 컴포넌트를 도구로 사용하는 기본 에이전트 Flow 생성
  - **Agent** 컴포넌트 설정에 지정된 LLM은 응답 생성 시 자체 내장 기능과 연결된 도구의 기능 모두 사용 가능

- **[에이전트를 도구로 사용](/agents-tools#use-an-agent-as-a-tool)**: 멀티 에이전트 Flow 생성

- **[Langflow를 MCP 클라이언트로 사용](/mcp-client)** 및 **[Langflow를 MCP 서버로 사용](/mcp-server)**: **Agent**와 **MCP Tools** 컴포넌트를 사용하여 Flow에서 Model Context Protocol(MCP) 구현

## Agent 컴포넌트

**Agent** 컴포넌트는 에이전트 Flow의 주요 에이전트 액터.
LLM 통합을 사용하여 채팅 메시지나 파일 업로드 같은 입력에 응답.

### 도구 연결

에이전트는 기본 LLM에서 이미 사용 가능한 도구와 **Agent** 컴포넌트의 **Tools** 포트에 연결하는 추가 도구 모두 사용 가능.

도구로 연결 가능한 컴포넌트:
- 모든 Langflow 컴포넌트
- 다른 **Agent** 컴포넌트
- **MCP Tools** 컴포넌트를 통한 MCP 서버

자세한 내용: [Langflow 에이전트 사용](/agents) 참조.

## 참고

- [MCP Tools 컴포넌트](/mcp-tools)
- [Message History 컴포넌트](/message-history)
- [채팅 메모리 저장](/memory#store-chat-memory)
- [Bundles](/components-bundle-components)
- [레거시 LangChain 컴포넌트](/bundles-langchain#legacy-langchain-components)

