# Webhook

HTTP POST 요청 수신 시 Flow를 실행하는 웹훅 트리거 정의.

## 웹훅 트리거

**Webhook** 컴포넌트를 Flow에 추가하면 **API Access** 패널에 **Webhook curl** 탭 추가.
HTTP POST 요청 코드 스니펫 자동 생성.

**예시:**
```bash
curl -X POST \
  "http://$LANGFLOW_SERVER_ADDRESS/api/v1/webhook/$FLOW_ID" \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: $LANGFLOW_API_KEY' \
  -d '{"any": "data"}'
```

참조: [Trigger flows with webhooks](/webhook)

## Webhook 파라미터

| Name | Display Name | 설명 |
|------|--------------|------|
| `data` | Payload | HTTP POST 요청을 통해 외부 시스템에서 페이로드 수신 |
| `curl` | curl | 이 웹훅에 요청하기 위한 curl 명령 템플릿 |
| `endpoint` | Endpoint | 이 웹훅이 요청을 수신하는 엔드포인트 URL |
| `output_data` | Data | (출력) 웹훅 입력에서 처리된 데이터. 입력 없으면 빈 `Data` 객체 반환. 입력이 유효한 JSON이 아니면 `payload` 객체로 래핑하여 Flow 트리거 입력으로 수신 가능하게 처리 |

