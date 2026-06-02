# 모델 프로바이더 (Model Providers)

## 핵심 개념

모델 프로바이더는 워크스페이스에 AI 모델 접근 권한을 부여하며,
모든 Dify 애플리케이션의 기초 역할을 수행함.
팀 멤버가 프로젝트 전반에서 AI 기능을 활용할 수 있도록 지원함.

## 프로바이더 유형

### System Providers

Dify가 관리하는 서비스로 즉시 접근 가능, 구독 기반 결제, 자동 업데이트 제공.
빠른 프로토타이핑에 이상적임.

### Custom Providers

OpenAI, Anthropic, Google 등의 서비스에 개인 API 키 사용.
완전한 제어, 직접 결제, 일반적으로 높은 속도 제한 제공하며 프로덕션 환경에 적합함.

두 유형 모두 워크스페이스 내에서 동시 운영 가능.

## 설정 프로세스

워크스페이스 admin/owner 권한 필요:

1. Settings → Model Providers 접근
2. 원하는 프로바이더 선택
3. API 자격 증명 및 필수 설정 입력
4. Dify 테스트 시스템을 통한 자격 증명 검증

## 지원 모델 카테고리

플랫폼이 수용하는 모델 유형:

- **LLM**: OpenAI (GPT-4, GPT-3.5), Anthropic (Claude 변형), Google (Gemini), Cohere, Ollama
- **Embeddings**: OpenAI, Cohere, Azure OpenAI, 로컬 모델
- **특수 모델**: 이미지 생성 (DALL-E, Stable Diffusion), 음성 서비스 (Whisper, ElevenLabs), moderation API

## 자격 증명 관리

프로바이더당 다중 자격 증명 지원으로 다음 기능 제공:

- 환경 분리 (개발 vs. 프로덕션)
- 쿼터 로테이션을 통한 비용 최적화
- 모델 테스트 및 성능 평가

커스텀 모델은 전용 인터페이스를 통한 개별 또는 일괄 자격 증명 관리 지원.

## 로드 밸런싱 (프리미엄 기능)

유료 기능으로 라운드 로빈 라우팅을 사용하여 여러 자격 증명에 요청 분산.
속도 제한 중단 방지 및 응답 시간 개선.

## 접근 제어 및 결제

Owner/admin이 설정 제어하고, editor/member는 사용 가능한 프로바이더 활용 가능.
System provider는 Dify 구독을 통해 결제되며,
Custom provider는 각 서비스로부터 직접 요금 청구됨.
