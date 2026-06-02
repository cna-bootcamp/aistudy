# Use Langflow as an MCP server

Langflow는 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction)과 MCP 서버 및 MCP 클라이언트 양쪽으로 통합.

이 페이지에서는 Flow를 [MCP 클라이언트](https://modelcontextprotocol.io/clients)가 응답 생성 시 사용할 수 있는 [도구](https://modelcontextprotocol.io/docs/concepts/tools)로 노출하는 MCP 서버로 Langflow 사용하는 방법 설명.

Langflow MCP 서버 지원 전송:
- **streamable HTTP** 전송
- **Server-Sent Events (SSE)** 폴백

MCP 클라이언트로 Langflow 사용: [Use Langflow as an MCP client](/mcp-client) 참조.

## Prerequisites

- **Chat Output** 컴포넌트가 있는 Flow가 최소 하나 이상 있는 [Langflow 프로젝트](/concepts-flows#projects)
- [Node.js](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) LTS 버전 (MCP Inspector 테스트/디버그 시)
- [ngrok](https://ngrok.com/docs/getting-started/#1-install-ngrok) 설치 및 [authtoken](https://dashboard.ngrok.com/get-started/your-authtoken) (공개 서버 배포 시)

## Serve flows as MCP tools

[Langflow 프로젝트](/concepts-flows#projects) 생성 시 Langflow가 자동으로:
- 프로젝트를 MCP 서버 설정에 추가
- 프로젝트의 Flow를 MCP 도구로 사용 가능하게 함

인증 활성화 시 (`AUTO_LOGIN=false`):
- 프로젝트의 MCP 서버가 자동으로 API 키 인증으로 설정
- 새 프로젝트의 Flow 접근용 새 API 키 생성

### Prevent automatic MCP server configuration for Langflow projects

새 프로젝트의 자동 MCP 서버 설정 비활성화:
```
LANGFLOW_ADD_PROJECTS_TO_MCP_SERVERS=false
```

### Selectively enable and disable MCP servers for Langflow projects

MCP 도구로 노출되는 프로젝트 선택적 활성화/비활성화:

1. **Projects** 페이지에서 **MCP Server** 탭 클릭
   - 또는 Flow 편집 중 **Share** → **MCP Server**

2. **Edit Tools** 클릭하여 도구로 노출할 Flow 선택
   - 체크박스 해제로 Flow의 도구 사용 방지

3. **MCP Server Tools** 대화상자 닫기 (변경사항 저장)

### Edit flow tool names and descriptions

도구 이름과 설명은 MCP 클라이언트가 Flow의 액션과 사용 시점을 결정하는 데 도움.
모든 도구에 명확하고 설명적인 이름과 설명 제공 권장.

1. **Projects** 페이지 → **MCP Server** 탭 (또는 **Share** → **MCP Server**)
2. **Edit Tools** 클릭
3. 편집할 **Description** 또는 **Tool** 클릭:
   - **Tool name**: 에이전트가 도구로 사용할 때 Flow의 기능을 명확히 하는 이름
   - **Tool description**: Flow가 수행하는 특정 액션을 완전하고 정확하게 설명
4. **MCP Server Tools** 대화상자 닫기 (변경사항 저장)

#### Importance of tool names and descriptions

MCP 클라이언트는 도구 이름과 설명으로 응답 생성 시 사용할 액션 결정.

Langflow 프로젝트의 모든 활성화된 Flow가 도구로 나열되므로, 불명확한 이름과 설명은 에이전트가 도구를 잘못 또는 일관성 없이 선택하게 할 수 있음.

예: Flow의 기본 도구 이름은 Flow ID (예: `adbbf8c7-0a34-493b-90ea-5e8b42f78b66`) - 에이전트에게 Flow 유형이나 목적에 대한 정보 제공 안 됨.

## Connect clients to your Langflow MCP server

Langflow는 자동 설치 및 코드 스니펫 제공으로 로컬 MCP 클라이언트에 배포 지원.

### JSON 방식

1. [MCP 호환 클라이언트](https://modelcontextprotocol.io/clients) 설치 (예: Cursor)

2. 클라이언트에서 새 MCP 서버 추가 (UI 또는 설정 파일)
   - Cursor: **Cursor Settings** → **MCP** → **Add New Global MCP Server**

3. [인증](#authentication) 설정 (권장)

4. Langflow의 **Projects** 페이지 → **MCP Server** 탭

5. **JSON** 탭에서 OS용 코드 스니펫 복사 후 클라이언트 MCP 설정 파일에 붙여넣기:

```json
{
  "mcpServers": {
    "PROJECT_NAME": {
      "command": "uvx",
      "args": [
        "mcp-proxy",
        "http://LANGFLOW_SERVER_ADDRESS/api/v1/mcp/project/PROJECT_ID/streamable"
      ]
    }
  }
}
```

환경 변수 포함:

```json
{
  "mcpServers": {
    "PROJECT_NAME": {
      "command": "uvx",
      "args": [
        "mcp-proxy",
        "http://LANGFLOW_SERVER_ADDRESS/api/v1/mcp/project/PROJECT_ID/streamable"
      ],
      "env": {
        "KEY": "VALUE"
      }
    }
  }
}
```

6. 설정 파일 저장 및 닫기

7. 클라이언트의 MCP 서버 목록에서 Langflow MCP 서버 확인 (필요 시 재시작)

## MCP server authentication

각 [Langflow 프로젝트](/concepts-flows#projects)는 자체 MCP 서버와 인증 설정 보유.

새 프로젝트 생성 시 Langflow가 서버 인증 설정에 따라 자동으로 인증 설정.
인증 활성화 시 (`AUTO_LOGIN=false`):
- API 키 인증으로 자동 설정
- 프로젝트 Flow 접근용 새 API 키 생성

인증 설정 변경:
**Projects** 페이지 → **MCP Server** 탭 → **Edit Auth** → 인증 방법 선택

**인증 방법:**
- **API key**: JSON 코드 스니펫과 Auto install 설정에 `--headers`와 `x-api-key` 인수 자동 포함
- **OAuth**: OAuth 설정
- **None**: 인증 없음

## MCP server environment variables

| Variable | Format | Default | Description |
|----------|--------|---------|-------------|
| `LANGFLOW_MCP_SERVER_ENABLED` | Boolean | `True` | 각 프로젝트에 MCP 서버 초기화 여부 |
| `LANGFLOW_MCP_SERVER_ENABLE_PROGRESS_NOTIFICATIONS` | Boolean | `False` | 진행 알림 전송 여부 |
| `LANGFLOW_MCP_SERVER_TIMEOUT` | Integer | `20` | MCP 서버 작업 만료 대기 시간(초) |
| `LANGFLOW_MCP_MAX_SESSIONS_PER_SERVER` | Integer | `10` | 서버당 최대 MCP 세션 수 |
| `LANGFLOW_ADD_PROJECTS_TO_MCP_SERVERS` | Boolean | `True` | 새 프로젝트를 MCP 서버 설정에 자동 추가 여부 |

### Deploy your Langflow MCP server externally

외부 배포: [Deploy a public Langflow server](/deployment-public-server) 참조.

## Use MCP Inspector to test and debug flows

> **Note**: MCP Inspector는 [Node.js](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) LTS 버전 필요.

[MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)는 MCP 서버 테스트 및 디버깅용 일반 도구.
Flow 모니터링 및 MCP 서버의 소비 방식에 대한 인사이트 제공.

1. MCP Inspector 설치:
   ```bash
   npx @modelcontextprotocol/inspector
   ```

2. 웹 브라우저에서 MCP Inspector UI 열기 (기본: `http://localhost:6274`)

3. Langflow 프로젝트 MCP 서버 연결 정보 입력:

   **API key 인증 시:**
   - **Transport Type**: STDIO
   - **Command**: `uvx`
   - **Arguments**:
     ```
     mcp-proxy --headers x-api-key YOUR_API_KEY http://LANGFLOW_SERVER_ADDRESS/api/v1/mcp/project/PROJECT_ID/streamable
     ```

4. **Connect** 클릭

5. 연결 성공 시 **Tools** 탭에서 프로젝트 Flow 확인
   - MCP에 도구로 등록되는 방식 모니터링
   - 커스텀 입력 값으로 도구 테스트

6. MCP Inspector 종료: 시작한 터미널에서 Control+C

## Troubleshoot Langflow MCP servers

MCP 서버/클라이언트 문제 해결: [Troubleshoot Langflow: MCP issues](/troubleshoot#mcp) 참조.

## See also

- [Use Langflow as an MCP client](/mcp-client)
- [Use a DataStax Astra DB MCP server](/mcp-component-astra)
- [MCP server environment variables](/environment-variables#mcp)
