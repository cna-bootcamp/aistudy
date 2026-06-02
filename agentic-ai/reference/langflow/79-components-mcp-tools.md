# MCP Tools

**MCP Tools** 컴포넌트는 Model Context Protocol(MCP) 서버에 연결하고 MCP 서버의 함수를 Langflow 에이전트가 입력에 응답하는 데 사용할 수 있는 도구로 노출.

## 연결 가능한 MCP 서버

- 공개적으로 사용 가능한 MCP 서버
- 직접 만든 커스텀 MCP 서버
- Langflow MCP 서버 (에이전트가 Langflow Flow를 도구로 사용 가능)
  - **MCP Tools** 컴포넌트의 [HTTP/SSE 모드](/mcp-client#mcp-http-mode)를 사용하여 Langflow 프로젝트의 MCP 서버에 연결

자세한 내용:
- [Langflow를 MCP 클라이언트로 사용](/mcp-client)
- [Langflow를 MCP 서버로 사용](/mcp-server)

> **참고**: 기존 Flow 업그레이드 시 **MCP Tools** 컴포넌트에서 **Tool Mode** 옵션이 사라지면
> [MCP Tools 컴포넌트 Tool Mode 옵션 누락 문제 해결](/troubleshoot#mcp-tools-component-loses-tool-mode-option-after-upgrading-flows) 참조.

## MCP Tools 파라미터

| Name | Type | 설명 |
|------|------|------|
| `mcp_server` | String | (입력) 연결할 MCP 서버. 이전에 구성된 서버에서 선택하거나 새로 추가 |
| `tool` | String | (입력) 연결된 MCP 서버에서 실행할 특정 도구. 비워두면 모든 도구 접근 허용 |
| `use_cache` | Boolean | (입력) MCP 서버와 도구의 캐싱을 활성화하여 성능 향상. 기본값: `false` |
| `verify_ssl` | Boolean | (입력) HTTPS 연결에 대한 SSL 인증서 검증 활성화. 기본값: `true` |
| `response` | DataFrame | (출력) 실행된 도구의 응답을 포함하는 `DataFrame` |

