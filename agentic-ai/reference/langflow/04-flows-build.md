# Build flows

*Flow*는 애플리케이션 워크플로우의 기능적 표현.
입력을 받아 처리하고 출력을 생성.

Flow는 워크플로우의 개별 단계를 나타내는 *컴포넌트*로 구성.

Langflow Flow는 완전히 직렬화 가능하며, Langflow가 설치된 파일 시스템에서 저장 및 로드 가능.

> **Tip**: 몇 분 만에 Flow를 빌드하고 실행하려면 [Langflow quickstart](/get-started-quickstart) 참조.

## Create a flow

**Projects** 페이지에서 Flow 생성 방법 4가지:

| 방법 | 설명 |
|------|------|
| **빈 Flow 생성** | 프로젝트 선택 → **New Flow** → **Blank Flow** |
| **템플릿에서 생성** | 프로젝트 선택 → **New Flow** → 원하는 템플릿 선택 |
| **기존 Flow 복제** | Flow의 **More** 메뉴 → **Duplicate** |
| **Flow 가져오기** | [Import and export flows](/concepts-flows-import) 참조 |

[Langflow API](/api-flows)로도 Flow 생성 가능하나, Flow 생성에 익숙해질 때까지 [visual editor](/concepts-overview) 사용 권장.

### Add components

Flow는 [워크스페이스](/concepts-overview#workspace)에서 설정하고 연결하는 노드인 [컴포넌트](/concepts-components)로 구성.
각 컴포넌트는 AI 모델 서빙이나 데이터 소스 연결 같은 특정 작업 수행.

**Core components**와 **Bundles** 메뉴에서 컴포넌트를 드래그 앤 드롭하여 Flow에 추가.
컴포넌트 설정 구성 후 연결.

각 컴포넌트에는 공통 설정과 컴포넌트별 고유 설정 존재.

컴포넌트 연결 방법: *edges* 또는 *ports*
- 특정 데이터 타입을 수신/송신
- 예: 메시지 포트는 컴포넌트 간 텍스트 문자열 전송

포트 타입 및 기본 컴포넌트 코드 등 자세한 정보: [Components overview](/concepts-components)

### Run a flow

프로토타입 Flow 빌드 후 [Playground](/concepts-playground)에서 테스트.

애플리케이션 개발에 Langflow 사용 준비 시:
- [Langflow API로 Flow 트리거](/concepts-publish)
- [커스텀 의존성](/install-custom-dependencies) 같은 고급 설정 탐색
- [Langflow 애플리케이션 컨테이너화](/develop-application)

프로덕션 또는 공개 인터넷 접근 MCP 서버 배포 시: [Langflow deployment overview](/deployment-overview)

#### Flow graphs

Flow 실행 시 Langflow가 노드(컴포넌트)와 엣지(연결)에서 Directed Acyclic Graph(DAG) 객체 빌드.
노드는 실행 순서 결정을 위해 정렬.

그래프 빌드는 각 컴포넌트의 `def_build` 함수를 호출하여 노드 검증 및 준비.
그래프는 의존성 순서로 처리되며, 각 노드가 순차적으로 빌드 및 실행.
빌드된 노드의 결과는 해당 노드 결과에 의존하는 노드로 전달.

## Manage flows in projects

**Projects** 페이지: Langflow 실행 시 도착하는 곳.
Flow 및 프로젝트의 [MCP 서버](/mcp-server) 관리.

Langflow 프로젝트: 관련 Flow를 정리하는 폴더 역할.
- 기본 프로젝트: **Starter Project**
- 다른 프로젝트 생성하지 않으면 Flow는 여기에 저장
- 프로젝트 생성: **Create new project** 클릭

> **Tip**: Flow 편집 후 **Projects** 페이지로 돌아가려면 헤더의 프로젝트 이름 또는 Langflow 아이콘 클릭.

### Edit flow details

1. **Projects** 페이지에서 편집할 Flow 찾기
2. **More** → **Edit details** 선택
3. **Name**과 **Description** 편집 후 **Save**

### Lock a flow

Flow 변경 방지를 위해 잠금:

1. **Projects** 페이지에서 잠글 Flow 찾기
2. **More** → **Edit details** 선택
3. **Lock Flow** 활성화 후 **Save**

잠금 해제: **Lock Flow** 비활성화.

Flow 편집 중 **Lock Status**로 잠금 상태 확인 (Locked/Unlocked).
편집 중에는 잠금 상태 변경 불가.

### Move a flow

프로젝트 간 Flow 이동:

1. **Projects** 페이지에서 이동할 Flow 찾기
2. Flow를 프로젝트 목록의 대상 프로젝트 이름으로 클릭 및 드래그

### Delete a flow

1. **Projects** 페이지에서 삭제할 Flow 찾기
2. **More** → **Delete** 선택

## Flow storage and logs

기본적으로 Flow와 Flow 실행 데이터는 Langflow 데이터베이스에 저장.
Flow 로그는 Langflow config 디렉토리의 다른 Langflow 로그와 함께 저장.

자세한 정보: [Memory management options](/memory) 및 [Logging](/logging)

## See also

- [Share and embed flows](/concepts-publish)
- [Import and export flows](/concepts-flows-import)
- [Langflow environment variables](/environment-variables)
