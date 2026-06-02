# 루핑 (Looping)

루핑은 여러 항목을 처리하거나 작업을 반복적으로 수행하려는 경우 유용함. 예를 들어 주소록의 모든 연락처에
메시지를 전송하는 경우. n8n은 이러한 반복 처리를 자동으로 처리하므로 workflow에 명시적으로 루프를 구축할
필요가 없음. 일부 node는 예외가 존재함

## n8n에서 루프 사용

n8n node는 입력으로 임의 개수의 항목을 받아 처리하고 결과를 출력함. 각 항목을 단일 데이터 포인트 또는
node의 출력 테이블에서 단일 행으로 간주할 수 있음

Node는 일반적으로 각 항목에 대해 한 번씩 실행됨. 예를 들어 Customer Datastore node의 고객 이름 및 메모를
Slack 메시지로 전송하려는 경우:

- Slack node를 Customer Datastore node에 연결
- 매개변수 구성
- Node 실행

5개의 메시지를 수신함 (각 항목당 하나씩)

이것이 명시적으로 node를 루프로 연결하지 않고도 여러 항목을 처리할 수 있는 방법임

### Node를 한 번만 실행

모든 수신 항목을 처리하지 않으려는 상황의 경우 (예: 첫 번째 고객에게만 Slack 메시지 전송), 해당 node의
Settings 탭에서 Execute Once 매개변수를 토글하여 수행 가능. 이 설정은 들어오는 데이터에 여러 항목이 포함되어
있고 첫 번째 항목만 처리하려는 경우 유용함

## 루프 생성

n8n은 일반적으로 모든 들어오는 항목에 대한 반복을 처리함. 그러나 모든 항목을 반복하기 위해 루프를 생성해야
하는 특정 시나리오가 존재함. 자동으로 모든 들어오는 항목을 반복하지 않는 node 목록은 Node exceptions 참조

### 조건이 충족될 때까지 루프

n8n workflow에서 루프를 생성하려면 한 node의 출력을 이전 node의 입력에 연결함. 루프를 중지할 시기를 확인하기
위해 IF node를 추가함

IF node를 사용하여 루프를 구현하는 예제 workflow 참조

### 모든 항목이 처리될 때까지 루프

모든 항목이 처리될 때까지 루프하려면 Loop Over Items node를 사용함. 각 항목을 개별적으로 처리하려면
Batch Size를 1로 설정함

데이터를 그룹으로 일괄 처리하고 이러한 일괄 처리를 처리할 수 있음. 이 접근 방식은 대량의 들어오는 데이터를
처리할 때 API 속도 제한을 피하거나 반환된 항목의 특정 그룹을 처리하려는 경우 유용함

Loop Over Items node는 모든 들어오는 항목이 일괄 처리로 나뉘어 workflow의 다음 node로 전달된 후 실행을 중지함.
따라서 루프를 중지하기 위해 IF node를 추가할 필요가 없음

## Node 예외

workflow에 루프를 설계해야 하는 node 및 작업:

- CrateDB: insert 및 update에 대해 한 번 실행됨
- Code node (Run Once for All Items 모드): 입력된 코드 스니펫을 기반으로 모든 항목을 처리함
- Execute Workflow node (Run Once for All Items 모드)
- HTTP Request: 페이지네이션을 직접 처리해야 함. API 호출이 페이지네이션된 결과를 반환하는 경우 한 번에
  한 페이지씩 가져오기 위한 루프를 생성해야 함
- Microsoft SQL: insert, update, delete에 대해 한 번 실행됨
- MongoDB: insert 및 update에 대해 한 번 실행됨
- QuestDB: insert에 대해 한 번 실행됨
- Redis - Info: 이 작업은 들어오는 데이터의 항목 수에 관계없이 한 번만 실행됨
- RSS Read: 요청된 URL에 대해 한 번 실행됨
- TimescaleDB: insert 및 update에 대해 한 번 실행됨
