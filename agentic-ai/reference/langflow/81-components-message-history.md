# Message History

**Message History** 컴포넌트는 채팅 기록과 메시지 저장 기능 통합 제공.
[Langflow 스토리지](/memory) *또는* Mem0, Redis 같은 전용 채팅 메모리 데이터베이스에서 채팅 메시지 저장 및 검색 가능.

> **Tip**: **Agent** 컴포넌트에는 기본 활성화된 내장 채팅 메모리가 있으며 Langflow 스토리지 사용.
> 이 내장 채팅 메모리 기능은 대부분의 사용 사례에 충분함.

**Message History** 컴포넌트 사용이 필요한 경우:
- Language Model 컴포넌트(에이전트가 아닌)의 채팅 메모리 저장 및 검색
- 채팅 컨텍스트 외부에서 채팅 메모리 검색 (예: 최근 저장된 메모리를 검색하여 분석하는 감정 분석 Flow)
- Langflow 스토리지와 분리된 특정 데이터베이스에 메모리 저장

자세한 내용: [채팅 메모리 저장](/memory#store-chat-memory) 참조.

## Flow에서 사용 방법

**Message History** 컴포넌트는 Flow에서 사용 위치에 따라 두 가지 모드:

| 모드 | 설명 |
|------|------|
| **Retrieve** | Langflow 데이터베이스 또는 외부 메모리에서 채팅 메시지 검색 |
| **Store** | Langflow 데이터베이스 또는 외부 메모리에 채팅 메시지 저장 |

채팅 메시지를 저장하고 검색하려면 Flow에 여러 **Message History** 컴포넌트 필요.

### Langflow 스토리지 사용 예시

1. 채팅 메모리를 사용할 Flow 생성/편집

2. Flow 시작 부분에 **Message History** 컴포넌트 추가 → **Retrieve** 모드 설정

3. (선택) **Controls**에서 메모리 정렬, 필터링, 제한 파라미터 활성화

4. **Prompt Template** 컴포넌트 추가:
   - **Template** 필드에 `{memory}` 변수 추가
   - **Message History** 출력 → **memory** 입력 연결

   템플릿 예시:
   ```
   You are a helpful assistant that answers questions.

   Use markdown to format your answer, properly embedding images and urls.

   History:

   {memory}
   ```

   `{memory}` 변수는 검색된 채팅 메모리로 채워지고, **Language Model** 또는 **Agent** 컴포넌트에 전달되어 LLM에 추가 컨텍스트 제공.

5. **Prompt Template** 출력 → **Language Model**의 **System Message** 입력 연결

6. **Chat Input** 컴포넌트 추가 → **Language Model**의 **Input** 연결

7. **Language Model** 출력 → **Chat Output** 컴포넌트 연결

8. Flow 끝에 다른 **Message History** 컴포넌트 추가 → **Store** 모드 설정
   - 이 컴포넌트는 메시지 검색이 아닌 저장용

9. **Chat Output** 출력 → **Message History**의 **Message** 입력 연결
   - LLM의 각 응답이 **Language Model** → **Chat Output** → 최종 **Message History** 컴포넌트로 전달되어 채팅 메모리에 저장

## Message History 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

사용 가능한 파라미터는 **Retrieve** 또는 **Store** 모드에 따라 다름.

### Retrieve 모드 파라미터

| Name | Type | 설명 |
|------|------|------|
| **Template** (`template`) | String | (입력) 데이터 포맷팅에 사용할 템플릿. `{text}`, `{sender}` 또는 메시지 데이터의 다른 키 포함 가능 |
| **External Memory** (`memory`) | External Memory | (입력) 외부 메모리에서 메시지 검색. 비어있으면 Langflow 스토리지 사용 |
| **Number of Messages** (`n_messages`) | Integer | (입력) 검색할 메시지 수. 기본값: 100 |
| **Order** (`order`) | String | (입력) 메시지 순서. 기본값: `Ascending` |
| **Sender Type** (`sender_type`) | String | (입력) 발신자 타입으로 필터링. `User`, `Machine`, `Machine and User` (기본값) |
| **Session ID** (`session_id`) | String | (입력) 검색할 채팅 메모리의 [세션 ID](/session-id). 생략하거나 비어있으면 현재 Flow 실행의 세션 ID 사용 |

## Message History 출력

메모리는 두 가지 형식 중 하나로 검색 가능:

| 출력 | 설명 |
|------|------|
| **Message** | 검색된 채팅 메시지 텍스트를 포함하는 `messages_text`가 있는 `Message` 객체로 메모리 검색. 메모리를 *채팅 메시지로* 다른 컴포넌트에 전달하는 일반적인 출력 형식 |
| **DataFrame** | 메시지 데이터를 포함하는 `DataFrame`으로 메모리 반환. 채팅 메시지가 아닌 테이블 형식으로 메모리 검색이 필요한 경우 유용 |

컴포넌트 출력 포트 근처에서 출력 타입 설정 가능.

