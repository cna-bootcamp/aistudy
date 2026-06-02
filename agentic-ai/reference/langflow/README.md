# Langflow Documentation Summary

Langflow 공식 문서 (https://docs.langflow.org/)를 기반으로 정리한 매뉴얼.

## 목차

### Get Started
- [00-about-langflow.md](./00-about-langflow.md) - Langflow 소개
- [01-installation.md](./01-installation.md) - 설치 가이드
- [02-quickstart.md](./02-quickstart.md) - 빠른 시작 가이드

### Flows
- [03-flows-visual-editor.md](./03-flows-visual-editor.md) - 비주얼 에디터 사용법
- [04-flows-build.md](./04-flows-build.md) - Flow 빌드 가이드

### Agents
- [05-agents.md](./05-agents.md) - Langflow 에이전트 사용법

### Model Context Protocol (MCP)
- [06-mcp-client.md](./06-mcp-client.md) - MCP 클라이언트로 사용
- [07-mcp-server.md](./07-mcp-server.md) - MCP 서버로 사용

---

## 문서 구조 (공식 사이트 기준)

### 1. Get started
- About Langflow
- Install Langflow
- Quickstart
- Tutorials

### 2. Flows
- Use the visual editor
- Build flows
- Run flows
- Test flows
- Import and export flows

### 3. Agents
- Use Langflow agents
- Configure tools for agents

### 4. Model Context Protocol (MCP)
- Use Langflow as an MCP client
- Use Langflow as an MCP server
- Connect an Astra DB MCP server to Langflow

### 5. Develop
- API keys and authentication
- Install custom dependencies
- Global variables
- Environment variables
- Storage and memory
- Observability
- Use Langflow data types
- Use voice mode
- Use the Langflow CLI

### 6. Deploy
- Langflow deployment overview
- Deploy a public Langflow server
- Deploy Langflow with Nginx and SSL
- Containerized deployments
- Cloud platforms
- Security

### 7. Components reference
- Components overview
- Core components
- Bundles
- Create custom Python components

### 8. API reference
- Get started with the Langflow API
- Use the TypeScript client
- Flow trigger endpoints
- OpenAI Responses endpoints
- Flow management endpoints
- Files endpoints
- Projects endpoints
- Logs endpoints
- Monitor endpoints
- Build endpoints
- Users endpoints
- Langflow API specification

### 9. Contribute
- How to contribute

### 10. Support
- Troubleshooting
- FAQ

---

## 핵심 개념 요약

### Langflow란?
- AI 애플리케이션 구축을 위한 오픈소스, Python 기반 프레임워크
- 드래그 앤 드롭 비주얼 에디터로 복잡한 AI 워크플로우 생성
- 에이전트와 MCP(Model Context Protocol) 지원
- 특정 LLM이나 벡터 스토어에 종속되지 않음

### Flow
- 애플리케이션 워크플로우의 기능적 표현
- 컴포넌트 노드를 연결하여 구성
- Playground에서 실시간 테스트 가능
- API를 통해 외부 애플리케이션에서 호출 가능

### Agent
- Agent 컴포넌트로 에이전트 Flow 구축
- 여러 LLM 제공자, 도구 호출, 커스텀 지침 지원
- Tool Mode로 컴포넌트를 도구로 변환

### MCP 통합
- **MCP 클라이언트**: MCP Tools 컴포넌트로 외부 MCP 서버 도구 사용
- **MCP 서버**: Flow를 MCP 도구로 노출하여 외부 클라이언트가 사용

---

## 주요 URL

- 공식 문서: https://docs.langflow.org/
- GitHub: https://github.com/langflow-ai/langflow
- Desktop 다운로드: https://www.langflow.org/desktop
- Discord: https://discord.gg/EqksyE2EX9

---

## 설치 방법 요약

### Desktop (권장)
```bash
# https://www.langflow.org/desktop에서 다운로드
```

### Docker
```bash
docker run -p 7860:7860 langflowai/langflow:latest
```

### Python
```bash
uv pip install langflow
uv run langflow run
```

접속: http://localhost:7860
