# 핵심 개념 (Key Concepts)

Dify의 필수 개념에 대한 간략한 개요임.

## Dify 앱

Dify는 에이전틱 앱 구축을 위해 설계됨.
Studio에서 드래그 앤 드롭 인터페이스를 통해 에이전틱 워크플로우를 빠르게 구축하고 앱으로 배포 가능.
배포된 앱은 API, 웹, 또는 MCP 서버로 접근 가능.
Dify는 두 가지 주요 앱 유형을 제공: **Workflow**와 **Chatflow**.

추가로 3가지 기본 앱 유형도 제공: Chatbot, Agent, Text Generator.
이들은 동일한 워크플로우 엔진에서 실행되지만, 더 간단한 레거시 인터페이스를 제공함.

### Workflow

단일 턴 작업을 처리하는 워크플로우 앱 구축용.
웹앱 인터페이스와 API를 통해 다수의 작업을 한 번에 일괄 실행 가능.

워크플로우는 Dify의 모든 앱 유형의 기반이 됨.

시작 노드 유형:
- **User Input**: 사용자 상호작용 또는 API 호출로 앱 실행
- **Trigger**: 스케줄 또는 특정 서드파티 이벤트에 응답하여 자동 실행

> User Input과 Trigger 시작 노드는 상호 배타적으로 동일 캔버스에서 사용 불가.

User Input으로 시작된 워크플로우만 독립 웹 앱이나 MCP 서버로 배포,
백엔드 서비스 API로 노출, 또는 다른 Dify 앱의 도구로 사용 가능.

### Chatflow

대화의 매 턴마다 트리거되는 특별한 워크플로우 앱 유형임.
워크플로우 기능 외에도 대화별 사용자 정의 변수 저장/업데이트,
LLM 노드의 메모리 활성화, 스트림 포맷 텍스트/이미지/파일 제공 기능이 있음.

> Chatflow는 Trigger로 시작할 수 없음.

### Dify DSL

모든 Dify 앱을 Dify 고유의 DSL(Domain-Specific Language)로 YAML 파일로 내보내기 가능.
DSL 파일에서 직접 Dify 앱을 생성할 수 있어 다른 Dify 인스턴스로의 이식 및 공유가 용이함.

## 변수 (Variables)

변수는 정보를 저장하는 레이블이 지정된 컨테이너로, 이름을 참조하여 나중에 사용 가능.

### 변수 유형

| 유형 | 설명 |
|------|------|
| **Inputs** | User Input 노드에서 최종 사용자가 작성할 입력 변수 지정 |
| **Outputs** | 각 노드가 생성하는 하나 이상의 출력으로 후속 노드에서 참조 가능 |
| **Environment Variables** | API 키 등 민감한 정보를 저장하는 환경 변수 (상수, 업데이트 불가) |
| **Conversation Variables** | Chatflow 전용, 대화별 지속 변수 (Variable Assigner 노드로 업데이트 가능) |

### 시스템 변수 (Workflow)

| 변수명 | 데이터 타입 | 설명 |
|--------|------------|------|
| sys.user_id | String | 사용자 ID: 시스템이 자동 할당하는 고유 식별자 |
| sys.app_id | String | 앱 ID: 시스템이 각 앱에 자동 할당하는 고유 식별자 |
| sys.workflow_id | String | 워크플로우 ID: 현재 워크플로우의 모든 노드 정보 기록 |
| sys.workflow_run_id | String | 워크플로우 실행 ID: 런타임 상태 및 실행 로그 기록 |
| sys.timestamp | Number | 각 워크플로우 실행의 시작 시간 |

### 변수 참조

입력 필드 구성 시 드롭다운에서 선택하여 어떤 노드에든 변수를 쉽게 전달 가능.
복잡한 텍스트 입력에 `/`(슬래시)를 입력하여 드롭다운에서 원하는 변수 선택 가능.
