# Deploy a public Langflow server

기본적으로 `http://localhost:7860`의 Langflow 서버는 공용 인터넷에 노출되지 않음.
[ngrok](https://ngrok.com/docs/getting-started/) 또는 [zrok](https://docs.zrok.io/docs/getting-started)과 같은
포워딩 플랫폼으로 서버 트래픽을 전달하여 서버를 공개할 수 있음.

**공개 서버로 가능한 작업:**
- MCP 서버 외부 배포
- API 요청 서비스
- Flow의 Playground 공개 공유

## Prerequisites

Langflow 설치 머신에 필요한 항목:
- [Langflow 설치](/get-started-installation)
- 리버스 프록시 또는 포워딩 서비스 (이 가이드에서는 ngrok 사용)

**ngrok 사용 시:**
- [ngrok 설치](https://ngrok.com/docs/getting-started/#1-install-ngrok)
- [ngrok authtoken 생성](https://dashboard.ngrok.com/get-started/your-authtoken)

## Expose your Langflow server with ngrok

1. **Langflow 시작:**
   ```bash
   uv run langflow run
   ```

2. **다른 터미널에서 ngrok 인증:**
   ```bash
   ngrok config add-authtoken NGROK_AUTHTOKEN
   ```

3. **ngrok으로 서버 노출:**
   ```bash
   ngrok http http://localhost:7860
   ```

   > **Note**: 기본 리스닝 주소가 `http://localhost:7860`이 아니면 명령 수정 필요.

4. **포워딩 주소 확인:**
   ```
   Forwarding https://94b1-76-64-171-14.ngrok-free.app -> http://localhost:7860
   ```

5. **공개 접근 확인:**
   포워딩 주소 URL (예: `https://94b1-76-64-171-14.ngrok-free.app`)로 이동하여 확인.

> **Note**: ngrok 세션은 인증 없는 임시 도메인으로 배포됨.
> 인증 추가 또는 정적 도메인 배포는 [ngrok 문서](https://ngrok.com/docs/) 참조.

## Use a public Langflow server

### Deploy your MCP server externally

공개 Langflow 서버 배포 후 프로젝트의 MCP 서버도 공개 접근 가능.

**사용 방법:**
- [클라이언트를 Langflow MCP 서버에 연결](/mcp-server#connect-clients-to-use-the-servers-actions) 시
  서버의 포워딩 주소 사용

### Serve API requests

공개 Langflow 서버의 [Langflow API](/api-reference-api-examples) 엔드포인트에 요청 시
서버 도메인을 [base URL](/api-reference-api-examples#base-url)로 사용.

**curl 예시:**
```bash
curl -X POST \
  "PUBLIC_SERVER_DOMAIN/api/v1/webhook/FLOW_ID" \
  -H "Content-Type: application/json" \
  -H "x-api-key: LANGFLOW_API_KEY" \
  -d '{"data": "example-data"}'
```

> **Tip**: 공개 Langflow 서버에서 Flow 생성 시 **API access** 패널의 코드 스니펫이
> 자동으로 공개 서버 도메인 사용.

**Python 예시:**
```python
import requests

url = "https://3f7c-73-64-93-151.ngrok-free.app/api/v1/run/d764c4b8-5cec-4c0f-9de0-4b419b11901a"

payload = {
    "output_type": "chat",
    "input_type": "chat",
    "input_value": "Hello"
}

headers = {
    "Content-Type": "application/json",
    "x-api-key": "LANGFLOW_API_KEY"
}

try:
    response = requests.request("POST", url, json=payload, headers=headers)
    response.raise_for_status()
    print(response.text)
except requests.exceptions.RequestException as e:
    print(f"Error making API request: {e}")
except ValueError as e:
    print(f"Error parsing response: {e}")
```

### Share a flow's Playground

**Shareable Playground** 옵션으로 Flow의 **Playground**를 공개 URL에서 사용 가능.

**특징:**
- 사용자가 Langflow 설치 없이 Flow와 상호작용 가능
- Langflow API 키 생성 불필요
- 채팅 입출력 및 결과 확인 가능

자세한 정보: [Share a flow's Playground](/concepts-playground#share-a-flows-playground)

