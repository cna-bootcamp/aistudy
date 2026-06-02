# Chat Input and Output

대화형 상호작용 처리를 위한 컴포넌트.

> **Warning**: **Chat Input and Output** 컴포넌트는 **Playground**에서 Flow와 채팅하기 위해 필수.
> 참조: [Test flows in the Playground](/concepts-playground)

## Chat Input

텍스트 및 파일 입력 수신 (채팅 메시지 또는 파일).

**출력:** `Message` 데이터
- 제공된 입력
- 관련 채팅 메타데이터 (발신자, 세션 ID, 타임스탬프, 파일 첨부)

> **Note**: 초기 입력은 완전한 `Message` 객체로 제공하면 안 됨.
> Chat Input 컴포넌트가 `Message` 객체를 구성하여 다른 컴포넌트로 전달.

### Chat Input 파라미터

| Name | Display Name | 설명 |
|------|--------------|------|
| `input_value` | Input Text | 입력으로 전달할 메시지 텍스트 문자열 |
| `sender` | Sender Type | 발신자 식별: `User` 또는 `Language Model` |
| `sender_name` | Sender Name | 발신자 이름. 미지정 시 기본값: User 또는 Language Model |
| `session_id` | Session ID | 채팅 세션 고유 식별자. 비어 있으면 현재 세션 ID 사용 |
| `files` | Files | 메시지와 함께 전송할 파일 |
| `background_color` | Background Color | 아이콘 배경색 |
| `chat_icon` | Icon | 메시지 아이콘 |
| `should_store_message` | Store Messages | 채팅 기록에 메시지 저장 여부 |
| `text_color` | Text Color | 이름 텍스트 색상 |

## Chat Output

다른 컴포넌트에서 `Message`, `Data`, `DataFrame` 데이터 수신.
필요 시 `Message` 데이터로 변환 후 채팅 메시지로 최종 출력.

**Playground에서의 출력:**
- 채팅 인터페이스 관련 부분만 표시 (텍스트 응답, 발신자 이름, 파일 첨부)
- 메타데이터 확인: Playground 메시지 로그 검사

**Langflow API 사용 시:**
- API 응답에 Chat Output `Message` 객체 및 Flow 실행 데이터 포함
- 응답이 상세하므로 관련 데이터 추출 코드 필요

### Chat Output 파라미터

| Name | Display Name | 설명 |
|------|--------------|------|
| `input_value` | Inputs | 출력으로 전달할 메시지 텍스트 문자열 |
| `should_store_message` | Store Messages | 채팅 기록에 메시지 저장 여부 |
| `sender` | Sender Type | 발신자 식별: `User` 또는 `Language Model` |
| `sender_name` | Sender Name | 발신자 이름. 미지정 시 기본값: User 또는 Language Model |
| `session_id` | Session ID | 채팅 세션 고유 식별자. 비어 있으면 현재 세션 ID 사용 |
| `data_template` | Data Template | `Data` 입력을 텍스트로 변환하는 템플릿. 비어 있으면 Data 객체의 text 키로 동적 설정 |
| `background_color` | Background Color | 아이콘 배경색 |
| `chat_icon` | Icon | 메시지 아이콘 |
| `text_color` | Text Color | 이름 텍스트 색상 |
| `clean_data` | Basic Clean Data | 활성화 시 DataFrame 입력을 텍스트 변환할 때 정리 (빈 행, 셀 내 빈 줄, 다중 줄바꿈 제거) |

## Flow에서 사용

`Message` 데이터를 수신하거나 출력하는 컴포넌트에 연결.

**기본 예시:** Chat Input → Language Model → Chat Output
- 간단한 LLM 기반 채팅 Flow 생성

**관련 예시:**
- [Langflow quickstart](/get-started-quickstart): 기본 에이전트 Flow 생성 및 실행
- **Basic Prompting** 템플릿: 채팅 입력 + LLM 추가 지시 프롬프트
- [Connect applications to agents](/agent-tutorial): 에이전트 Flow 및 프롬프팅 고급 개념

## Langflow API로 채팅 입력 전송

```bash
curl --request POST \
  --url "http://$LANGFLOW_SERVER_ADDRESS/api/v1/run/$FLOW_ID" \
  --header "Content-Type: application/json" \
  --header "x-api-key: $LANGFLOW_API_KEY" \
  --data '{
    "input_value": "What's the recommended way to install Docker on Mac M1?",
    "output_type": "chat",
    "input_type": "chat"
  }'
```

**필수 파라미터:** `input_value` 등 Chat Input 컴포넌트의 입력 파라미터 값.

**선택 파라미터:** `session_id` (생략 시 Flow 기본 세션 ID 사용)

```bash
# 커스텀 세션 ID 사용 예시
curl --request POST \
  --url "http://$LANGFLOW_SERVER_ADDRESS/api/v1/run/$FLOW_ID" \
  --header "Content-Type: application/json" \
  --header "x-api-key: $LANGFLOW_API_KEY" \
  --data '{
    "input_value": "Whats the recommended way to install Docker on Mac M1",
    "session_id": "$USER_ID",
    "output_type": "chat",
    "input_type": "chat"
  }'
```

참조: [Trigger flows with the Langflow API](/concepts-publish)

