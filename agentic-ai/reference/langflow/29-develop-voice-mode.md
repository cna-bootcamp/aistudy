# Use voice mode

Langflow의 음성 모드를 사용하여 마이크와 스피커를 통해 Flow와 음성으로 상호작용.

> **Note**: 음성 모드는 Langflow Desktop에서 사용 불가.
> 음성 모드 사용을 위해 [Langflow OSS Python 패키지 설치](/get-started-installation#install-and-run-the-langflow-oss-python-package) 필요.

## Prerequisites

음성 모드 요구사항:

| 항목 | 설명 |
|------|------|
| **Flow 구성** | **Chat Input**, **Language Model**, **Chat Output** 컴포넌트가 있는 Flow |
| **OpenAI 계정** | OpenAI API 키 필요 (음성 입력 처리 및 응답 생성에 사용) |
| **ElevenLabs API 키** | (선택사항) LLM 응답에 더 많은 음성 옵션 활성화 |
| **하드웨어** | 마이크 및 스피커 (고품질 마이크와 최소 배경 소음 권장) |

**Agent 컴포넌트가 있는 Flow의 경우:**
- 에이전트가 도구 선택에 도움이 되도록 정확한 이름과 설명 설정 필요
- 음성 모드는 **Agent Instructions** 필드의 타이핑된 지침을 재정의함

## Test voice mode in the Playground

**Playground**에서 마이크 아이콘 클릭하여 음성 모드 활성화.

### Simple Agent 템플릿으로 음성 모드 테스트

1. **Simple Agent** 템플릿 기반 Flow 생성

2. **Agent** 컴포넌트에 **OpenAI API key** 자격 증명 추가

3. **Playground** 클릭

4. 마이크 아이콘 클릭하여 **Voice mode** 대화 상자 열기

5. OpenAI API 키 입력 후 **Save** 클릭
   - Langflow가 키를 [전역 변수](/configuration-global-variables)로 저장

6. 마이크 액세스 허용 프롬프트 시 허용 필요
   - 마이크 액세스 차단 시 음성 입력 불가

7. **Audio Input**에서 음성 모드에 사용할 입력 장치 선택

8. (선택사항) ElevenLabs API 키 추가하여 LLM 응답에 더 많은 음성 활성화

9. **Preferred Language**에서 LLM과의 대화에 사용할 언어 선택
   - 예상 입력 언어와 응답 언어 모두 변경

10. 마이크에 대고 말하여 채팅 시작
    - 올바르게 구성된 경우 파형이 입력 등록
    - 에이전트의 로직과 응답이 음성 및 **Playground**에 설명됨

## Develop applications with websockets endpoints

Langflow는 Flow에 대해 두 개의 OpenAI Realtime API 호환 웹소켓 엔드포인트 노출.
[OpenAI Realtime API 웹소켓](https://platform.openai.com/docs/guides/realtime#connect-with-websockets)과 동일한 방식으로 애플리케이션 구축 가능.

**요구사항:**
- [OpenAI API 키](https://platform.openai.com/docs/overview) 인증 필요
- 선택적 [ElevenLabs](https://elevenlabs.io) 통합 (ElevenLabs API 키 사용)
- 두 엔드포인트 모두 엔드포인트 경로에 Flow ID 제공 필요

### Voice-to-voice audio streaming

**엔드포인트:** `/ws/flow_as_tool/$FLOW_ID`

OpenAI Realtime 음성에 연결 설정 후 [OpenAI Realtime 모델](https://platform.openai.com/docs/guides/realtime-conversations#handling-audio-with-websockets)에 따라 지정된 Flow를 도구로 호출.

**특징:**
- 저지연 애플리케이션에 적합
- OpenAI 음성-음성 모델이 Flow 호출 시점 결정하므로 결정적이지 않음

### Speech-to-text audio transcription

**엔드포인트:** `/ws/flow_tts/$FLOW_ID`

[OpenAI Realtime 음성 전사](https://platform.openai.com/docs/guides/realtime-transcription)를 사용하여 오디오를 텍스트로 변환 후 각 전사에 대해 지정된 Flow 직접 호출.

**특징:**
- 더 결정적
- 더 높은 지연 시간
- Langflow **Playground**에서 사용하는 모드

### Session IDs for websockets endpoints

두 엔드포인트 모두 선택적 `/$SESSION_ID` 경로 파라미터 허용하여 대화에 고유 ID 제공.
생략 시 Langflow가 Flow ID를 [세션 ID](/session-id)로 사용.

> **Note**: 음성 모드는 현재 대화 인스턴스 내에서만 컨텍스트 유지.
> **Playground** 닫거나 채팅 종료 시 음성 채팅 히스토리가 삭제되며 향후 채팅 세션에서 사용 불가.

## See also

- [Test flows in the Playground](/concepts-playground)
