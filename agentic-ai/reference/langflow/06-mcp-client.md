# Use Langflow as an MCP client

Langflow는 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction)과 MCP 서버 및 MCP 클라이언트 양쪽으로 통합.

이 페이지에서는 **MCP Tools** 컴포넌트와 연결된 MCP 서버를 사용하여 Langflow를 MCP 클라이언트로 사용하는 방법 설명.

MCP 서버로 Langflow 사용: [Use Langflow as an MCP server](/mcp-server) 참조.

## Use the MCP Tools component

**MCP Tools** 컴포넌트는 MCP 서버에 연결하여 [Langflow agent](/agents)가 사용자 쿼리에 응답할 때 서버의 도구를 사용할 수 있게 함.

두 가지 모드:
- **비-Langflow MCP 서버 연결**: JSON 설정 파일, 서버 시작 명령, HTTP/SSE URL
- **Langflow MCP 서버 연결**: [Langflow 프로젝트](/concepts-flows#projects)의 Flow를 MCP 도구로 사용

### Connect to a non-Langflow MCP server

1. **MCP Tools** 컴포넌트를 Flow에 추가

2. **MCP Server** 필드에서 이전에 연결한 서버 선택 또는 **Add MCP Server** 클릭

   **새 서버 추가 방법:**

   | 모드 | 설정 |
   |------|------|
   | **JSON** | MCP 서버의 JSON 설정 객체 붙여넣기 (필수/선택 파라미터 포함) → **Add Server** |
   | **STDIO** | **Name**, **Command**, **Arguments**, **Environment Variables** 입력 → **Add Server** |
   | **HTTP/SSE** | **Name**, **URL**, **Headers**, **Environment Variables** 입력 → **Add Server** |

   예시 - Fetch 서버 시작:
   - **Command**: `uvx mcp-server-fetch`

   Langflow MCP 서버 기본 URL:
   - `http://localhost:7860/api/v1/mcp/project/PROJECT_ID/streamable`
   - `http://localhost:7860/api/v1/mcp/streamable`

   > **Tip**: `uvx`는 Langflow 패키지의 `uv`에 포함됨.
   > `npx` 서버 명령 사용 시 먼저 [Node.js](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) LTS 설치 필요.

3. 환경 변수 사용 시 **Env** 필드에 키-값 쌍으로 입력

   > **Tip**: Langflow는 `.env` 파일의 환경 변수를 MCP에 전달하지만, **Settings**에 선언된 전역 변수는 전달하지 않음.

4. **Tool** 필드에서 사용할 도구 선택 (빈칸 시 MCP 서버의 모든 도구 접근 가능)

5. 컴포넌트 헤더 메뉴에서 **Tool Mode** 활성화

6. **MCP Tools** 컴포넌트의 **Toolset** 포트를 **Agent** 컴포넌트의 **Tools** 포트에 연결

7. **Chat Input**과 **Chat Output** 컴포넌트도 **Agent**에 연결

8. **Playground**에서 테스트
   - 예: `mcp-server-fetch`와 `fetch` 도구 사용 시, 최근 기술 뉴스 요약 요청
   - 에이전트가 MCP 서버 함수 `fetch` 호출 후 응답 반환

9. 더 많은 도구 사용 필요 시 다른 서버/도구로 단계 반복

### Connect a Langflow MCP server

모든 Langflow 프로젝트는 프로젝트의 Flow를 MCP 도구로 노출하는 별도의 MCP 서버 실행.

Langflow MCP 서버 지원 전송:
- **streamable HTTP** 전송
- **Server-Sent Events (SSE)** 폴백

Flow를 도구로 활용하기 위해 **MCP Tools** 컴포넌트로 프로젝트의 MCP 엔드포인트에 연결:

1. **MCP Tools** 컴포넌트 추가 → **Add MCP Server** → **HTTP/SSE** 모드 선택

2. **MCP URL** 필드에 Langflow 서버의 MCP 엔드포인트 입력:
   - 프로젝트별 서버: `http://localhost:7860/api/v1/mcp/project/PROJECT_ID/streamable`
   - 전역 MCP 서버: `http://localhost:7860/api/v1/mcp/streamable`
   - Langflow Desktop 기본: `http://localhost:7868/`

3. 컴포넌트 헤더 메뉴에서 **Tool Mode** 활성화

4. **MCP Tools**의 **Toolset** 포트를 **Agent**의 **Tools** 포트에 연결

5. **Chat Input**과 **Chat Output** 컴포넌트도 연결

6. **Playground**에서 테스트

## MCP Tools parameters

| Name | Type | Description |
|------|------|-------------|
| `mcp_server` | String | 연결할 MCP 서버. 이전 설정 서버 선택 또는 새로 추가 |
| `tool` | String | 실행할 특정 도구. 빈칸 시 모든 도구 접근 가능 |
| `use_cache` | Boolean | MCP 서버 및 도구 캐싱으로 성능 향상. 기본: `false` |
| `verify_ssl` | Boolean | HTTPS 연결용 SSL 인증서 검증. 기본: `true` |
| `response` | DataFrame | 실행된 도구의 응답을 포함하는 [DataFrame](/data-types#dataframe) |

## Manage connected MCP servers

모든 MCP 서버 연결 관리:
- 비주얼 에디터에서 **MCP servers** 클릭
- 또는 프로필 아이콘 → **Settings** → **MCP Servers**

새 MCP 서버 추가: **Add MCP Server** 클릭 후 연결 설정.

**More** 클릭하여 MCP 서버 연결 편집 또는 삭제.

## See also

- [Use Langflow as an MCP server](/mcp-server)
- [Use a DataStax Astra DB MCP server with the MCP Tools component](/mcp-component-astra)
