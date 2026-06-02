# Test flows in the Playground

Langflow의 **Playground**는 LLM 기반 Flow를 실시간으로 테스트하는 동적 인터페이스.

기능:
- 다양한 입력에 대한 Flow 응답 테스트
- 메모리 검토 및 수정
- Flow 출력 및 로직 모니터링
- 에이전트 Flow가 적절한 도구를 사용하는지 확인

Flow의 로직과 동작을 빠르게 반복하여 프로토타이핑 및 애플리케이션 개선 용이.

## Run a flow in the Playground

1. Flow 열기
2. **Playground** 클릭
3. [Chat Input 컴포넌트](/chat-input-and-output)가 있으면 프롬프트 입력 또는 [voice mode](/concepts-voice-mode) 사용

> **Tip**: Playground에 메시지 입력 필드가 없으면 Flow에 **Chat Input** 컴포넌트가 있고,
> **Language Model** 또는 **Agent** 컴포넌트의 **Input** 포트에 직접/간접적으로 연결되어 있는지 확인.

Playground는 채팅봇이나 에이전트 같은 쿼리-응답 형식의 LLM Flow용으로 설계됨.
완전한 지원을 위해 **Chat Input**, **Language Model**/**Agent**, **Chat Output** 컴포넌트 필요.

다른 유형의 입력(웹훅 이벤트, 파일 업로드, 텍스트 입력)이 필요한 Flow:
- [Langflow API로 Flow 트리거](/api-flows-run)
- Playground에서 해당 Flow 실행의 LLM 활동 검토

기술적 세부사항: [Monitor endpoints](/api-monitor)

### Review agent logic

Flow에 **Agent** 컴포넌트가 있으면 Playground에서:
- 에이전트가 사용한 도구 출력
- 각 도구의 출력 표시

에이전트의 도구 사용 모니터링 및 응답 뒤의 로직 이해에 도움.

### View chat history

Playground에서 각 채팅 세션의 메시지 로그 확인:
- 타임스탬프
- 내용
- 발신자

확인 방법:
1. Playground 사이드바에서 검토할 채팅 세션 찾기
2. **Options** 클릭 → **Message Logs** 선택

메시지 로그는 각 채팅 메시지의 [Message 데이터](/data-types#message)를 분해하여 표시.
셀 클릭으로 전체 내용 확인.

### Modify memories in the Playground

디버그 및 테스트 지원:
- 메시지 로그에서 개별 메시지 편집 또는 삭제
- 더 이상 Flow에 포함되지 않는 컴포넌트 테스트 시 보낸 메시지 삭제 가능

전체 채팅 세션 삭제:
- 사이드바에서 **Options** → **Delete**

> **주의**: 메모리 수정은 채팅 세션을 계속하거나 여러 채팅 세션에 걸쳐 메모리를 보존하는 경우 챗봇 응답 동작에 영향.

메시지 로그 편집 = Langflow 내부 `messages` 테이블(기본 채팅 메모리 스토리지) 편집.

자세한 정보: [Use custom session IDs](#session-ids), [Memory management options](/memory)

## Set custom session IDs

채팅 세션은 session ID(`session_id`)로 식별 - Flow 실행의 고유 식별자.

기본 session ID = flow ID
→ Flow의 모든 채팅 메시지가 하나의 거대한 채팅 세션으로 동일한 session ID에 저장.

커스텀 `session_id` 설정이 유용한 경우:
- 여러 Flow 실행에 걸쳐 채팅 컨텍스트 보존
- 디버깅 시 채팅 세션 구분

### 커스텀 session ID 활용 사례

- 동시에 여러 사용자 상호작용이 있는 챗봇의 채팅 세션 분리
- 여러 Flow 실행에 걸쳐 또는 한 Flow에서 다른 Flow로 컨텍스트 전달 시 메모리 보존
- 동일 Flow 내 여러 사용자 활동 구분
- 디버깅/테스트 시 자신의 채팅 세션 식별

### Visual editor에서 설정

1. 커스텀 session ID를 설정할 컴포넌트 클릭
2. 컴포넌트 헤더 메뉴에서 **Controls** 클릭
3. **Session ID** 활성화
4. **Close** 클릭
5. 커스텀 session ID 입력 (빈 필드 = 기본 session ID 사용)
6. **Playground** 열어 커스텀 session ID로 채팅 시작

> **Tip**: 프로덕션 환경에서는 하드코딩 값 대신 session ID에 변수 사용 고려.
> - 인증된 사용자의 컨텍스트 보존: user ID 변수 사용
> - 모든 채팅을 고유하게: 각 session ID에 UUID 자동 생성

자세한 정보: [Use session ID to manage communication between components](/session-id)

## Share a flow's Playground

> **Warning**: **Shareable Playground**는 테스트 목적 전용.
> 애플리케이션에 Flow 임베딩용이 아님.
> Flow 실행 정보: [Trigger flows with the Langflow API](/concepts-publish)
> Langflow Desktop에서는 사용 불가.

**Shareable Playground**: 단일 Flow의 Playground를 `/public_flow/$FLOW_ID` 엔드포인트에 노출.

[공개 Langflow 서버 배포](/deployment-overview) 후 이 공개 URL을 다른 사용자와 공유하여
해당 Flow의 **Playground**에만 접근 허용.
- Langflow 설치 없이 Flow의 채팅 입출력과 상호작용
- Langflow API 키 생성 불필요

### 공유 방법

1. 공유할 Flow 열기
2. [워크스페이스](/concepts-overview#workspace)에서 **Share** 클릭 → **Shareable Playground** 활성화
3. **Shareable Playground** 다시 클릭하여 Playground 창 열기
   - 이 창의 URL이 Flow의 Shareable Playground 주소
   - 예: `https://3f7c-73-64-93-151.ngrok-free.app/playground/d764c4b8-5cec-4c0f-9de0-4b419b11901a`
4. 다른 사용자에게 URL 전송

## See also

- [Upload images](/concepts-file-management#upload-images)
- [Use voice mode](/concepts-voice-mode)
- [Trigger flows with the Langflow API](/concepts-publish)
- [Session ID](/session-id)
