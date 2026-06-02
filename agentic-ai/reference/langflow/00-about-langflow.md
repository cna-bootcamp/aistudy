# What is Langflow?

Langflow는 AI 애플리케이션 구축을 위한 오픈소스, Python 기반, 커스터마이징 가능한 프레임워크.
에이전트와 Model Context Protocol(MCP) 같은 주요 AI 기능 지원.
특정 LLM이나 벡터 스토어 사용을 강제하지 않음.

비주얼 에디터로 애플리케이션 워크플로우 프로토타이핑을 단순화하여, 개발자가 아이디어를 빠르게 실제 솔루션으로 전환 가능.

## Application development and prototyping

Langflow로 개발 가능한 AI 애플리케이션:
- 챗봇
- 문서 분석 시스템
- 콘텐츠 생성기
- 에이전트 애플리케이션

사전 구축된 템플릿 제공 - 즉시 사용하거나 필요에 맞게 커스터마이징 가능.

### Create flows in minutes

Langflow의 주요 목적: Flow 생성 및 서빙
- Flow: 애플리케이션 워크플로우의 기능적 표현
- 컴포넌트 노드를 연결하고 설정하여 Flow 구축
- 각 컴포넌트는 워크플로우의 단일 단계

비주얼 에디터로 드래그 앤 드롭 방식으로 빠르게 AI 애플리케이션 워크플로우 구축 및 테스트 가능.

예시: 이커머스 스토어용 챗봇 Flow - LLM과 제품 데이터 스토어를 사용하여 고객이 제품에 대해 질문 가능.

### Test flows in real-time

**Playground**를 사용하여 전체 애플리케이션 스택 없이 Flow 테스트 가능.
- Flow와 상호작용하며 실시간 피드백 제공
- Flow 로직과 응답 생성에 대한 피드백
- 개별 컴포넌트를 실행하여 의존성을 격리 테스트 가능

### Run and serve flows

Flow 활용 방법:
1. 더 공식적인 애플리케이션 개발을 위한 프로토타입으로 사용
2. Langflow API를 사용하여 애플리케이션 코드에 Flow 임베드

더 광범위한 개발:
- Langflow를 의존성으로 빌드
- Langflow 서버를 배포하여 공개 인터넷으로 Flow 서빙

참고:
- [Trigger flows with the Langflow API](/concepts-publish)
- [Containerize a Langflow application](/develop-application)

## Endless modifications and integrations

Langflow 컴포넌트가 지원하는 것들:
- 다양한 서비스, 도구, AI 애플리케이션에 필요한 기능

컴포넌트 유형:
- **일반화된 컴포넌트**: 입력, 출력, 데이터 스토어
- **특수화된 컴포넌트**: 에이전트, 언어 모델, 임베딩 제공자

모든 컴포넌트는 고정 또는 변수 값으로 설정 가능한 파라미터 제공.
런타임에 tweaks를 사용하여 Flow 설정을 일시적으로 오버라이드 가능.

### Agent and MCP support

Langflow 내장 에이전트 및 MCP 기능:
- [Use Langflow Agents](/agents)
- [Use components and flows as agent tools](/agents-tools)
- [Use Langflow as an MCP server](/mcp-server)
- [Use Langflow as an MCP client](/mcp-client)

### Extensibility

핵심 컴포넌트 외에 커스텀 컴포넌트 지원:
- 다른 사람이 개발한 커스텀 컴포넌트 사용 가능
- 개인 사용 또는 다른 Langflow 사용자와 공유를 위한 자체 커스텀 컴포넌트 개발 가능

참고:
- [Contribute to Langflow](/contributing-how-to-contribute)
- [Create custom Python components](/components-custom-components)
- [Get help and request enhancements](/contributing-github-issues)

## Next steps

- [Install Langflow](/get-started-installation)
- [Quickstart](/get-started-quickstart)
