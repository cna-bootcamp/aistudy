# 서브 워크플로우 (Sub-workflows)

한 workflow에서 다른 workflow를 호출할 수 있음. 이를 통해 모듈식 마이크로서비스와 같은 workflow를 구축 가능.
workflow가 메모리 문제를 발생시킬 만큼 커진 경우에도 도움이 됨. 서브 워크플로우 생성에는 Execute Workflow 및
Execute Sub-workflow Trigger node를 사용함

서브 워크플로우 실행은 플랜의 월간 실행 또는 활성 workflow 제한에 포함되지 않음

## 서브 워크플로우 설정 및 사용

이 섹션은 부모 workflow와 서브 워크플로우 모두의 설정 과정을 안내함

### 서브 워크플로우 생성

- 새 workflow를 생성함

**기존 workflow에서 서브 워크플로우 생성**

Execute Sub-workflow node를 사용하여 기존 부모 workflow에서 직접 서브 워크플로우를 선택적으로 생성 가능.
Node에서 Database 및 From list 옵션을 선택하고 목록에서 Create a sub-workflow를 선택함

컨텍스트 메뉴에서 Sub-workflow conversion을 사용하여 선택한 node를 직접 추출할 수도 있음

- 선택사항: 어떤 workflow가 서브 워크플로우를 호출할 수 있는지 구성
  - Options 메뉴 > Settings 선택. n8n이 Workflow settings 모달을 엶
  - This workflow can be called by 설정을 변경함
  - Workflow settings에서 workflow 구성에 대한 자세한 정보 참조

- Execute Sub-workflow trigger node를 추가함 (trigger node에서 검색하는 경우 "When Executed by Another Workflow"
  라는 제목으로도 표시됨)

- Input data mode를 설정하여 서브 워크플로우의 입력 데이터를 정의하는 방법을 선택함:
  - Define using fields below: 호출하는 workflow가 제공해야 하는 개별 입력 이름 및 데이터 유형을 정의하는 모드.
    호출하는 workflow의 Execute Sub-workflow node 또는 Call n8n Workflow Tool node가 여기에 정의된 필드를
    자동으로 가져옴
  - Define using JSON example: 예상 입력 항목 및 해당 유형을 보여주는 예제 JSON 객체를 제공하는 모드
  - Accept all data: 무조건 모든 데이터를 수락하는 모드. 서브 워크플로우는 필수 입력 항목을 정의하지 않음.
    이 서브 워크플로우는 입력 불일치 또는 누락된 값을 처리해야 함

- 서브 워크플로우 기능을 구축하는 데 필요한 다른 node를 추가함
- 서브 워크플로우를 저장함

**서브 워크플로우에 오류가 없어야 함**

서브 워크플로우에 오류가 있으면 부모 workflow가 이를 트리거할 수 없음

**구축하기 전에 서브 워크플로우에 데이터 로드**

이전 실행에서 데이터를 로드하는 기능이 필요함 (n8n Cloud 및 등록된 Community 플랜에서 사용 가능)

구축하는 동안 사용할 서브 워크플로우에 데이터를 로드하려는 경우:

- 서브 워크플로우를 생성하고 Execute Sub-workflow Trigger를 추가함
- Node의 Input data mode를 Accept all data로 설정하거나 이미 알려진 경우 필드 또는 JSON을 사용하여 입력
  항목을 정의함
- 서브 워크플로우 settings에서 Save successful production executions를 Save로 설정함
- 부모 workflow 설정으로 건너뛰고 실행함
- 이전 실행에서 데이터를 로드하는 단계를 따름
- 필요한 경우 부모 workflow가 전송한 입력과 일치하도록 Input data mode를 조정함

이제 trigger node에 예제 데이터를 고정할 수 있어 workflow의 나머지 부분을 구성하는 동안 실제 데이터로 작업 가능

### 서브 워크플로우 호출

- 서브 워크플로우를 호출할 workflow를 엶
- Execute Sub-workflow node를 추가함
- Execute Sub-workflow node에서 호출할 서브 워크플로우를 설정함. ID로 workflow를 호출하거나, 로컬 파일에서
  workflow를 로드하거나, node에 매개변수로 workflow JSON을 추가하거나, URL로 workflow를 대상으로 지정할 수 있음

**Workflow ID 찾기**

서브 워크플로우의 ID는 URL 끝에 있는 영숫자 문자열임

- 서브 워크플로우에서 정의한 필수 입력 항목을 입력함
- Workflow를 저장함

Workflow가 실행되면 서브 워크플로우에 데이터를 전송하고 실행함

Execute Sub-workflow node를 열고 View sub-execution 링크를 선택하여 부모 workflow에서 서브 워크플로우로의
실행 흐름을 따를 수 있음. 마찬가지로 서브 워크플로우의 실행에는 다른 방향으로 이동하기 위한 부모 workflow의
실행에 대한 링크가 포함되어 있음

## Workflow 간 데이터 전달 방식

예를 들어 Workflow A에 Execute Sub-workflow node가 있다고 가정. Execute Sub-workflow node는 Workflow B라는
다른 workflow를 호출함:

- Execute Sub-workflow node는 Workflow B의 Execute Sub-workflow Trigger node (캔버스에서 "When executed by
  another node"로 표시됨)에 데이터를 전달함
- Workflow B의 마지막 node는 데이터를 Workflow A의 Execute Sub-workflow node로 다시 전송함

## 서브 워크플로우 변환

기존 workflow를 서브 워크플로우로 나누는 방법은 sub-workflow conversion 참조
