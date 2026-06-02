# Quickstart

템플릿 Flow를 로드하고 실행한 후 `/run` API 엔드포인트로 서빙하는 방법.

## Prerequisites

- [Install and start Langflow](/get-started-installation)
- [OpenAI API key](https://platform.openai.com/api-keys) 생성
- [Langflow API key](/api-keys-and-authentication) 생성

> **Tip**: "An API key must be passed as query or header" 오류 발생 시 [Troubleshooting](/troubleshoot#an-api-key-must-be-passed-as-query-or-header) 참조.

## Run the Simple Agent template flow

1. Langflow에서 **New Flow** 클릭 후 **Simple Agent** 템플릿 선택

**Simple Agent** 템플릿 구성:
- **Agent** 컴포넌트: [Agent component](/agents)
- **Chat Input/Output** 컴포넌트: [Chat Input and Chat Output components](/chat-input-and-output)
- **Calculator** 컴포넌트: [Calculator component](/calculator)
- **URL** 컴포넌트: [URL component](/url)

동작 방식:
1. **Chat Input**으로 에이전트에 쿼리 제출
2. 에이전트가 **Calculator**와 **URL** 도구를 사용하여 응답 생성
3. **Chat Output**으로 응답 반환

많은 컴포넌트가 에이전트의 도구가 될 수 있음 ([MCP servers](/mcp-server) 포함).
에이전트는 주어진 쿼리의 컨텍스트에 따라 호출할 도구를 결정.

2. **Agent** 컴포넌트에 OpenAI API 키 입력 (직접 또는 [global variable](/configuration-global-variables) 사용)
   - 다른 제공자 사용 시 모델 제공자, 모델 이름, 자격 증명 수정
   - 목록에 없는 제공자/모델: **Model Provider**를 **Connect other models**로 설정 후 [language model component](/components-models#additional-language-models) 연결

3. Flow 실행: **Playground** 클릭

4. **Calculator** 도구 테스트: `I want to add 4 and 4.` 같은 수학 질문
   - Playground에서 에이전트의 추론 과정 표시 (프롬프트 분석 → 도구 선택 → 응답 생성)
   - 수학 질문 시 **Calculator** 도구의 `evaluate_expression` 액션 사용

5. **URL** 도구 테스트: 현재 이벤트에 대한 질문
   - **URL** 도구의 `fetch_content` 액션 사용하여 뉴스 헤드라인 요약 반환

6. 테스트 완료 후 **Close** 클릭

### Next steps

- **Simple Agent** Flow에 다른 도구 연결 또는 [components](/concepts-components) 추가
- [Build your own flows](/concepts-flows) - 처음부터 또는 다른 템플릿 수정
- 외부 애플리케이션에서 Flow 통합

## Run your flows from external applications

Langflow는 IDE이자 런타임. [Langflow API](/api-reference-api-examples)를 통해 Python, JavaScript, HTTP로 호출 가능.

로컬 실행 시 로컬 Langflow 서버로 요청 전송.
프로덕션 애플리케이션은 [stable Langflow instance](/deployment-overview) 배포 필요.

`/run` 엔드포인트로 Flow 실행 및 결과 획득.

### API 코드 스니펫 사용

1. Flow 편집 중 **Share** → **API access** 클릭
2. 기본 코드: Langflow 서버 `url`, `headers`, `payload` 구성
   - `LANGFLOW_SERVER_ADDRESS`, `FLOW_ID` 자동 포함
   - `LANGFLOW_API_KEY` 환경 변수 스크립트 포함
   - 기본 서버 주소: `http://localhost:7860`

**Python 예제:**
```python
import requests

url = "http://LANGFLOW_SERVER_ADDRESS/api/v1/run/FLOW_ID"

payload = {
    "output_type": "chat",
    "input_type": "chat",
    "input_value": "hello world!"
}

headers = {
    "Content-Type": "application/json",
    "x-api-key": "$LANGFLOW_API_KEY"
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

응답에는 세션 ID, 입력, 출력, 컴포넌트, 지속 시간 등 상세 정보 포함.

### Extract data from the response

응답에서 데이터 추출 예제 - 터미널에서 Q&A 채팅 및 이전 답변 저장:

```python
import requests
import json

url = "http://LANGFLOW_SERVER_ADDRESS/api/v1/run/FLOW_ID"

def ask_agent(question):
    payload = {
        "output_type": "chat",
        "input_type": "chat",
        "input_value": question,
    }
    headers = {
        "Content-Type": "application/json",
        "x-api-key": "LANGFLOW_API_KEY"
    }
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        message = data["outputs"][0]["outputs"][0]["outputs"]["message"]["message"]
        return message
    except Exception as e:
        return f"Error: {str(e)}"

previous_answer = None

while True:
    print("\nAsk the agent anything...")
    print("Type 'quit' to exit or 'compare' to see the previous answer")
    user_question = input("Your question: ")

    if user_question.lower() == 'quit':
        break
    elif user_question.lower() == 'compare':
        if previous_answer:
            print(f"\nPrevious answer was: {previous_answer}")
        else:
            print("\nNo previous answer to compare with!")
        continue

    result = ask_agent(user_question)
    print(f"\nAgent's answer: {result}")
    previous_answer = result
```

### Use tweaks to apply temporary overrides to a flow run

**Tweaks**: API 요청에 추가하여 Flow 파라미터를 일시적으로 수정.
- 단일 실행에만 컴포넌트 설정 오버라이드
- 기본 Flow 구성 수정하지 않음
- 실행 간 지속되지 않음

**Input Schema 사용:**
1. **API access** 패널에서 **Input Schema** 클릭
2. 다음 요청에서 수정할 파라미터 선택
3. 예: OpenAI → Groq 변경 시 **Model Providers**, **Model**, **Groq API Key** 선택

```python
payload = {
    "output_type": "chat",
    "input_type": "chat",
    "input_value": "hello world!",
    "tweaks": {
        "Agent-ZOknz": {
            "agent_llm": "Groq",
            "api_key": "GROQ_API_KEY",
            "model_name": "llama-3.1-8b-instant"
        }
    }
}
```

## Next steps

- [Trigger flows with the Langflow API](/concepts-publish)
- [Use Langflow as a Model Context Protocol (MCP) server](/mcp-server)
- [Containerize a Langflow application](/develop-application)
- [File management](/concepts-file-management)
