# If-Else

두 문자열을 비교하여 메시지를 라우팅하는 조건부 라우터.
지정된 연산자를 사용하여 두 텍스트 입력을 비교하고, 평가 결과에 따라 메시지를 `true_result` 또는 `false_result`로 라우팅.

## 연산자

| 연산자 | 설명 |
|--------|------|
| **equals** | 정확한 일치 비교 |
| **not equals** | 정확한 일치의 반대 |
| **contains** | `match_text`가 `input_text` 내에 있는지 확인 |
| **starts with** | `input_text`가 `match_text`로 시작하는지 확인 |
| **ends with** | `input_text`가 `match_text`로 끝나는지 확인 |
| **regex** | 대소문자 구분 패턴 매칭 |

기본적으로 **regex**를 제외한 모든 연산자는 대소문자 구분 안 함.
**regex**는 항상 대소문자 구분, 다른 연산자는 파라미터에서 대소문자 구분 활성화 가능.

## Flow에서 사용 예시

정규식 매칭으로 들어오는 채팅 메시지를 확인하고, 매치 여부에 따라 다른 응답 출력.

1. **If-Else 컴포넌트 추가 및 구성:**
   - **Text Input**: **Chat Input** 또는 다른 `Message` 입력에 연결
     - `Message` 형식이 아닌 경우 **Type Convert** 또는 **Parser** 컴포넌트로 변환
     - `Message` 형식에 적합하지 않으면 **Data Operations** 등 다른 조건부 라우팅 컴포넌트 고려
   - **Match Text**: `.*(urgent|warning|caution).*` 입력 (정규식은 대소문자 구분)
   - **Operator**: **regex** 선택
   - **Case True**: Controls에서 활성화 후 `New Message Detected` 입력
     - True 출력 포트에서 조건이 참일 때 전송되는 메시지

2. **True 결과를 위한 컴포넌트 추가:**
   - **Language Model**, **Prompt Template**, **Chat Output** 컴포넌트 추가
   - Language Model에 API 키 입력
   - If-Else의 **True** 출력 → Language Model의 **Input** 연결
   - Prompt Template에 참일 때 지시사항 입력 (예: `Send a message that a new warning, caution, or urgent message was received`)
   - Prompt Template → Language Model의 **System Message** 연결
   - Language Model 출력 → Chat Output 연결

3. **False 결과를 위한 동일한 프로세스 반복:**
   - If-Else의 **False** 출력 → 두 번째 Language Model 연결
   - 두 번째 Prompt Template에 거짓일 때 지시사항 입력 (예: `Send a message that a new low-priority message was received`)

4. **테스트:**
   Playground에서 정규식 문자열이 있는 메시지와 없는 메시지 전송.
   ```
   User: A new user was created.
   AI: A new low-priority message was received.

   User: Sign-in warning: new user locked out.
   AI: A new warning, caution, or urgent message was received. Please review it at your earliest convenience.
   ```

## If-Else 파라미터

| Name | Type | 설명 |
|------|------|------|
| `input_text` | String | 작업의 기본 텍스트 입력 |
| `match_text` | String | 비교할 텍스트 |
| `operator` | Dropdown | 텍스트 비교에 사용할 연산자: `equals`, `not equals`, `contains`, `starts with`, `ends with`, `regex`. 기본값: `equals` |
| `case_sensitive` | Boolean | `true`이면 대소문자 구분 비교. 기본값: `false`. regex 비교에는 적용 안 됨 |
| `max_iterations` | Integer | 조건부 라우터의 최대 반복 횟수. 기본값: 10 |
| `default_route` | Dropdown | 최대 반복 도달 시 사용할 경로: `true_result` 또는 `false_result`. 기본값: `false_result` |
| `true_result` | Message | (출력) 조건이 참일 때 생성되는 출력 |
| `false_result` | Message | (출력) 조건이 거짓일 때 생성되는 출력 |

