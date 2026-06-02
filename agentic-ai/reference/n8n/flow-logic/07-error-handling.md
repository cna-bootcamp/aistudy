# 오류 처리 (Error Handling)

흐름 로직을 설계할 때 잠재적인 오류를 고려하고 이를 우아하게 처리하는 방법을 설정하는 것이 좋은 관행임.
오류 workflow를 사용하면 workflow 실행 실패에 대해 n8n이 응답하는 방식을 제어할 수 있음

## 오류 조사

실패한 실행을 조사하려면:

- 단일 workflow 또는 액세스 권한이 있는 모든 workflow의 Executions를 검토함. 이전 실행에서 현재 workflow로
  데이터를 로드할 수 있음
- Log streaming을 활성화함

## 오류 workflow 생성 및 설정

각 workflow에 대해 Workflow Settings에서 오류 workflow를 설정할 수 있음. 실행이 실패하면 실행됨. 예를 들어
workflow 실행이 오류가 발생하면 이메일 또는 Slack 알림을 보낼 수 있음. 오류 workflow는 Error Trigger로
시작해야 함

동일한 오류 workflow를 여러 workflow에 사용할 수 있음

- Error Trigger를 첫 번째 node로 하는 새 workflow를 생성함
- Workflow에 이름을 지정함 (예: Error Handler)
- Save를 선택함
- 이 오류 workflow를 사용할 workflow에서:
  - Options > Settings를 선택함
  - Error workflow에서 방금 생성한 workflow를 선택함. 예를 들어 Error Handler라는 이름을 사용한 경우
    Error handler를 선택함
  - Save를 선택함

이제 이 workflow에 오류가 발생하면 관련 오류 workflow가 실행됨

## 오류 데이터

Error Trigger가 수신하는 기본 오류 데이터:

```json
[
  {
    "execution": {
      "id": "231",
      "url": "https://n8n.example.com/execution/231",
      "retryOf": "34",
      "error": {
        "message": "Example Error Message",
        "stack": "Stacktrace"
      },
      "lastNodeExecuted": "Node With Error",
      "mode": "manual"
    },
    "workflow": {
      "id": "1",
      "name": "Example Workflow"
    }
  }
]
```

모든 정보는 항상 존재하지만 다음은 예외임:

- `execution.id`: 실행이 데이터베이스에 저장되어야 함. 오류가 메인 workflow의 trigger node에 있는 경우
  workflow가 실행되지 않으므로 존재하지 않음
- `execution.url`: 실행이 데이터베이스에 저장되어야 함. 오류가 메인 workflow의 trigger node에 있는 경우
  workflow가 실행되지 않으므로 존재하지 않음
- `execution.retryOf`: 실행이 실패한 실행의 재시도인 경우에만 존재함

오류가 나중 단계가 아닌 메인 workflow의 trigger node로 인해 발생한 경우 오류 workflow로 전송되는 데이터가
다름. `execution{}`에는 정보가 적고 `trigger{}`에는 정보가 더 많음:

```json
{
  "trigger": {
    "error": {
      "context": {},
      "name": "WorkflowActivationError",
      "cause": {
        "message": "",
        "stack": ""
      },
      "timestamp": 1654609328787,
      "message": "",
      "node": {...}
    },
    "mode": "trigger"
  },
  "workflow": {
    "id": "",
    "name": ""
  }
}
```

## Stop And Error를 사용하여 workflow 실행 실패 유발

오류 workflow를 생성하고 설정하면 실행이 실패할 때 n8n이 이를 실행함. 일반적으로 이는 node 설정의 오류 또는
workflow의 메모리 부족과 같은 문제로 인한 것임

선택한 상황에서 실행이 강제로 실패하도록 하고 오류 workflow를 트리거하기 위해 workflow에 Stop And Error node를
추가할 수 있음
