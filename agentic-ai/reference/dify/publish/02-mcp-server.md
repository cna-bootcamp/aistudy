# MCP 서버 배포 (MCP Server)

## 개요

Dify는 애플리케이션을 MCP(Model Context Protocol) 서버로 노출하여 Claude Desktop과 같은 AI 어시스턴트 및
Cursor와 같은 개발 환경과의 통합을 지원.

## 설정 프로세스

사용자는 애플리케이션 설정 내에서 MCP Server 구성 모듈에 접근. 기본적으로 비활성화 상태로 시작. 활성화하면 "Dify가
고유한 MCP Server 주소를 생성"하며 이는 외부 연결 지점으로 작동.

## 보안 주의사항

문서는 MCP Server URL을 신중하게 취급할 것을 강조: "MCP Server URL에는 인증 자격증명이 포함되므로 API 키처럼
취급해야 함." 노출된 경우 URL을 재생성하여 이전 URL을 즉시 무효화 가능.

## Claude Desktop 통합

Claude Desktop과 연결하려면 Claude Profile > Settings > Integrations > Add integration으로 이동한 후
Integration URL을 Dify 애플리케이션의 Server URL로 대체.

## Cursor 통합

프로젝트 루트에 `.cursor/mcp.json` 파일을 생성하거나 편집하여 다음 구조로 설정:

```json
{
  "mcpServers": {
    "your-server-name": {
      "url": "your-server-url"
    }
  }
}
```

여러 애플리케이션을 `mcpServers` 객체에 추가 항목을 더하여 통합 가능.

## 모범 사례

**명확한 설명:** 도구 및 매개변수에 대해 명확하고 구체적인 설명을 작성. 문서는 모호한 용어 대신 "필수 필드(name,
email, preferences)를 포함하는 사용자 프로필이 담긴 JSON 객체"와 같은 구체성을 권장.

**지연시간:** 애플리케이션 성능은 클라이언트 경험에 직접 영향. 30초의 처리 지연은 최종 사용자에게 그대로 전달됨.
