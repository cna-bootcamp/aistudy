# Use Session IDs

Session ID를 사용하여 컴포넌트 간 통신 관리.

## Session ID 개요

Session ID: 클라이언트/서버 연결을 위한 고유 식별자.
단일 세션 = 클라이언트가 서버에 연결된 기간.

**Playground에서의 Session ID:**
- 현재 세션이 Playground 왼쪽 패널에 목록으로 표시

**Session ID 용도:**
- Flow 내 다양한 채팅 상호작용 추적
- 단일 Flow에서 여러 채팅 세션 존재 가능
- 메시지가 Session ID를 참조로 데이터베이스에 저장

**Session ID의 중요성:**
- 클라이언트/서버 연결 관리에 유용
- 단일 Flow 내에서 별도의 대화 컨텍스트 유지에 중요
- LLM은 과거 상호작용에 의존하여 응답 생성
- 대화가 분리되지 않으면 응답이 덜 유용하거나 혼란스러워짐

## Customize session ID

커스텀 Session ID 설정 방법:

| 방법 | 설명 |
|------|------|
| **API 호출** | 페이로드의 일부로 Session ID 설정 |
| **컴포넌트 설정** | 개별 컴포넌트의 고급 설정에서 설정 |

**우선순위:**
1. API Session ID 값 (최우선)
2. 컴포넌트 설정 값
3. 기본값: Flow ID

### API에서 Session ID 설정

커스텀 Session ID를 페이로드에 설정하면 모든 다운스트림 컴포넌트가 업스트림 컴포넌트의 Session ID 값 사용.

```bash
curl --request POST \
  --url "http://LANGFLOW_SERVER_ADDRESS/api/v1/run/FLOW_ID" \
  --header "Content-Type: application/json" \
  --header "x-api-key: $LANGFLOW_API_KEY" \
  --data '{
    "input_value": "Hello",
    "output_type": "chat",
    "input_type": "chat",
    "session_id": "my_custom_session_value"
  }'
```

**결과:**
- `my_custom_session_value` 값이 이를 허용하는 컴포넌트에서 사용
- Flow의 저장된 메시지가 해당 `session_id` 값과 함께 `langflow.db`에 저장

## Retrieval of messages from memory by session ID

### Message History 컴포넌트 사용

로컬 Langflow 메모리에서 메시지 검색:

1. Flow에 **Message History** 컴포넌트 추가
2. `sessionID`를 필터 파라미터로 수락
3. 업스트림의 Session ID 값을 자동으로 사용하여 저장소에서 메시지 히스토리 검색

### API를 통한 메시지 검색

`session_id`로 메시지 검색:

```
GET /v1/monitor/messages
```

자세한 정보: [Monitor endpoints](https://docs.langflow.org/api-monitor)

## Session ID 활용 예시

| 시나리오 | Session ID 전략 |
|----------|----------------|
| **단일 사용자** | Flow ID 사용 (기본값) |
| **다중 사용자** | 사용자별 고유 ID 사용 (예: user_123) |
| **대화 분리** | 대화별 고유 ID 사용 |
| **디바이스별 세션** | 디바이스 ID + 타임스탬프 조합 |

## See also

- [Message History component](/message-history)
- [Monitor endpoints](https://docs.langflow.org/api-monitor)
