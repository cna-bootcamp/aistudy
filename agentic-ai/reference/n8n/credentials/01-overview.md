# n8n Credentials 개요

## Credentials란?

Credentials는 n8n이 외부 서비스 및 API에 접근하기 위해 사용하는 인증 정보임

## 주요 개념

### 재사용성
- 한 번 생성한 Credential을 여러 워크플로우에서 사용 가능
- 동일 서비스의 여러 계정 관리 가능
- 중앙 집중식 관리로 유지보수 용이

### 보안
- 암호화된 상태로 데이터베이스에 저장
- 워크플로우 실행 로그에 Credential 정보 노출 안 됨
- 접근 권한 제어 기능

## Credential 유형

### OAuth2
Google, Microsoft, Slack 등 OAuth2 프로토콜을 사용하는 서비스

**특징**:
- 사용자 권한 위임 방식
- 액세스 토큰 자동 갱신
- 안전한 인증 흐름

**설정 단계**:
1. 서비스에서 OAuth 앱 생성
2. Client ID 및 Client Secret 발급
3. n8n에 Redirect URL 등록
4. 인증 플로우 완료

### API Key
대부분의 REST API 서비스에서 사용

**특징**:
- 간단한 설정
- 단일 키로 인증
- 서비스별 키 형식 상이

**사용 예**:
- OpenAI API Key
- SendGrid API Key
- Stripe API Key

### Basic Auth
사용자명과 비밀번호 기반 인증

**특징**:
- 전통적인 인증 방식
- HTTP Basic Authentication
- 레거시 시스템에서 주로 사용

### Header Auth
커스텀 헤더를 통한 인증

**특징**:
- 커스텀 헤더 이름 지정
- 값 형식 자유
- API별 요구사항에 맞춤 설정

### Token Auth
Bearer Token 또는 기타 토큰 기반 인증

**특징**:
- JWT 토큰 지원
- Bearer Token 형식
- 만료 시간 관리

### Custom Auth
특수한 인증 방식이 필요한 경우

**특징**:
- 복합 인증 프로세스
- 다단계 인증
- 커스텀 로직 구현 가능

## Credential 생성

### 기본 프로세스

**STEP 1. Credential 타입 선택**
- 노드 설정에서 "Create New Credential" 클릭
- 서비스에 맞는 Credential 타입 선택

**STEP 2. 인증 정보 입력**
- 필수 필드 입력 (API Key, Username, Password 등)
- 선택적 설정 구성

**STEP 3. 연결 테스트**
- "Test" 버튼으로 연결 확인
- 성공 시 저장, 실패 시 설정 수정

**STEP 4. 저장 및 이름 지정**
- 알아보기 쉬운 이름 설정
- 여러 계정 사용 시 구분 가능한 이름 권장

### OAuth2 설정 예시

**Google OAuth2**:
```
1. Google Cloud Console에서 프로젝트 생성
2. OAuth2 Client ID 생성
3. Redirect URI에 n8n URL 추가
   예: https://your-n8n-instance.com/rest/oauth2-credential/callback
4. Client ID와 Secret을 n8n에 입력
5. Google 계정 인증 완료
```

## Credential 관리

### 수정 및 업데이트
- Credential 목록에서 수정 가능
- 변경 사항은 모든 사용 중인 워크플로우에 자동 반영
- 버전 이력 관리 (Enterprise)

### 삭제
- 사용 중인 Credential은 삭제 불가
- 삭제 전 의존성 확인 필요
- 삭제 후 복구 불가

### 복제
- 기존 Credential 복사하여 새로 생성
- 유사한 설정의 여러 계정 관리 시 유용

## 워크플로우에서 사용

### Credential 선택
- 노드 설정에서 Credential 드롭다운 선택
- 기존 Credential 사용 또는 새로 생성

### 여러 Credential 사용
- 하나의 워크플로우에서 여러 서비스의 Credential 사용 가능
- 동일 서비스의 다른 계정 Credential 동시 사용 가능

### Expression으로 동적 선택
고급 사용자는 Expression을 통해 런타임에 Credential 선택 가능

## 보안 모범 사례

### Credential 보호
- 최소 권한 원칙 적용
- API Key는 필요한 권한만 부여
- 정기적인 키 로테이션

### 접근 제어
- 팀원별 Credential 접근 권한 제한
- 프로덕션 Credential은 제한된 사용자만 접근
- 감사 로그 활성화

### 모니터링
- 비정상적인 API 사용 패턴 감지
- Credential 사용 이력 추적
- 만료 예정 토큰 알림

## 트러블슈팅

### 일반적인 문제

**인증 실패**:
- Credential 정보 재확인
- API Key 또는 토큰 만료 여부 확인
- 서비스 상태 점검

**OAuth2 연결 오류**:
- Redirect URL 정확성 확인
- Client ID/Secret 재확인
- 스코프(권한) 설정 확인

**권한 부족 오류**:
- API Key 권한 범위 확인
- 계정 역할 및 권한 점검
- 서비스별 제한사항 검토

### 디버깅 팁
- 노드 실행 시 에러 메시지 확인
- API 문서에서 요구사항 재확인
- n8n 커뮤니티 포럼 검색

## 고급 기능

### 외부 시크릿 관리 (Enterprise)
- 외부 시크릿 스토어 연동
- HashiCorp Vault, AWS Secrets Manager 등
- 중앙 집중식 보안 관리

### Credential 공유 (Enterprise)
- 팀 간 Credential 공유
- 역할 기반 접근 제어
- 공유 범위 설정

### 환경별 Credential
- 개발/스테이징/프로덕션 환경별 분리
- 환경 변수 활용
- 배포 시 자동 전환

## Credential 타입별 가이드

### 주요 서비스

**Slack**:
- OAuth2 또는 API Token
- Workspace별 Credential 필요
- Bot Token 권한 설정 중요

**Google Services**:
- OAuth2 인증
- Service Account 옵션
- Scope 설정 주의

**GitHub**:
- Personal Access Token
- OAuth App
- Fine-grained Token 지원

**AWS**:
- Access Key ID/Secret Access Key
- IAM Role 기반 인증
- STS Temporary Credentials

**Database**:
- Host, Port, Username, Password
- SSL/TLS 옵션
- Connection String 지원

## 참고사항

### 성능 고려사항
- Credential 조회는 캐시됨
- 대량 워크플로우 실행 시 병목 가능성 낮음
- OAuth2 토큰 갱신은 자동으로 처리

### 제한사항
- 일부 서비스는 Rate Limiting 적용
- OAuth2는 인터넷 연결 필요
- 자체 호스팅 시 방화벽 설정 필요

### 마이그레이션
- 다른 n8n 인스턴스로 Credential 이동 가능
- Export/Import 기능 활용
- 보안을 위해 암호화된 형태로 전송

## 추가 리소스

### 문서
- 서비스별 Credential 설정 가이드
- API 연동 튜토리얼
- 보안 베스트 프랙티스

### 지원
- 커뮤니티 포럼
- 이슈 트래커
- 엔터프라이즈 지원팀

### 개발
- 커스텀 Credential 타입 개발
- 노드 개발 시 Credential 통합
- API 문서
