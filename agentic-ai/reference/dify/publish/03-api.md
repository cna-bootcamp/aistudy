# API 개발 (Developing with APIs)

## 개요

Dify는 AI 애플리케이션을 백엔드 API 서비스로 통합할 수 있도록 지원. 워크플로우는 Dify Studio에서 앱을 구축하고,
보안 자격증명을 생성하며, 애플리케이션에서 API를 호출하고, 사용자가 사용자 정의 인터페이스를 통해 상호작용하는 동안
Dify가 AI 처리를 담당하는 방식으로 진행.

## 시작 프로세스

설정은 네 가지 주요 단계로 구성:

1. **API 설정 접근** - 앱의 왼쪽 사이드바에서 "API Access"로 이동
2. **API 자격증명 생성** - 다양한 환경 또는 사용자를 위한 새 키 생성
3. **문서 검토** - Dify에서 앱별 API 문서 접근
4. **앱에 구현** - 제공된 예제를 사용하여 통합

## 중요 보안 경고

"프론트엔드 코드나 클라이언트 측 요청에서 API 키를 절대 노출하지 말 것. 남용을 방지하고 보안을 유지하려면 항상 백엔드에서
Dify API를 호출해야 함."

## Text-Generation 애플리케이션

이러한 애플리케이션은 기사 및 요약과 같은 고품질 텍스트 콘텐츠를 생성. `completion-messages` API 엔드포인트를
사용하여 사용자 입력을 전송하고 생성된 결과를 수신. 구성은 Prompt Arrangement 페이지의 개발자 설정에 따라 결정됨.

엔드포인트: `https://api.dify.ai/v1/completion-messages`

필수 헤더는 bearer 토큰을 포함하는 Authorization과 application/json인 Content-Type을 포함.

요청 매개변수는 `inputs`, `response_mode`, `user` 식별자를 포함.

## Conversational 애플리케이션

대화형 앱은 지속적인 Q&A 대화를 지원. `chat-messages` API 엔드포인트 사용:
`https://api.dify.ai/v1/chat-messages`

### Conversation ID 관리

- **새 대화** - `conversation_id`를 비워 둠; 시스템이 생성하여 반환
- **기존 세션** - 연속성을 유지하려면 `conversation_id` 포함; 이 필드가 제공되면 새 `inputs`는 무시됨
- **중요 구분** - "Service API는 WebApp에서 생성된 대화를 공유하지 않음"
- **동적 변수** - 대화 변수는 세션 중간에 로직 또는 동작 조정을 가능하게 함
