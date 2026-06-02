# SAML 설정

## 개요

n8n에서 SAML 인증을 구성하는 단계별 가이드.
SAML을 활성화하고 Identity Provider (IdP)와 통합하여 Single Sign-On (SSO) 기능 구현.

## SAML 활성화

### n8n에서 SAML 기능 활성화
SAML 인증을 사용하기 위한 초기 설정:
- 관리자 권한으로 n8n 인스턴스 접속
- 사용자 관리 설정 메뉴 이동
- SAML 인증 옵션 활성화
- 기본 SAML 설정 구성

### 라이선스 확인
SAML 기능 사용 가능 여부 확인:
- n8n 플랜 또는 라이선스 검토
- 엔터프라이즈 기능 활성화 상태 확인
- 필요 시 라이선스 업그레이드

## 일반 IdP 설정

### Identity Provider 구성
표준 SAML 2.0 호환 Identity Provider 설정:

#### 1. Service Provider 메타데이터 수집
n8n의 Service Provider 정보 확인:
- Entity ID (엔티티 ID)
- Assertion Consumer Service (ACS) URL
- Single Logout Service URL
- 메타데이터 XML 다운로드

#### 2. IdP에 Service Provider 등록
Identity Provider에 n8n 애플리케이션 등록:
- 새 SAML 애플리케이션 생성
- n8n 메타데이터 업로드 또는 수동 입력
- ACS URL 및 Entity ID 구성
- Single Logout URL 설정 (선택사항)

#### 3. IdP 메타데이터 수집
Identity Provider의 메타데이터 획득:
- IdP 메타데이터 XML 다운로드
- SSO URL 확인
- 서명 인증서 획득
- IdP Entity ID 확인

#### 4. n8n에 IdP 메타데이터 등록
n8n에 Identity Provider 정보 입력:
- IdP 메타데이터 XML 업로드
- 또는 수동으로 SSO URL, 인증서, Entity ID 입력
- 서명 검증 옵션 설정
- 암호화 설정 (선택사항)

## 인스턴스 및 프로젝트 액세스 프로비저닝

### n8n_instance_role 속성 구성
사용자의 n8n 인스턴스 수준 역할 정의:

#### 속성 설정
SAML 응답에 `n8n_instance_role` 속성 포함:
- IdP에서 사용자 속성 매핑 설정
- n8n 인스턴스 역할 값 지정
- 속성 이름: `n8n_instance_role`

#### 역할 값
지원되는 인스턴스 수준 역할:
- `admin`: 인스턴스 관리자 권한
- `member`: 일반 사용자 권한
- `viewer`: 읽기 전용 권한 (해당하는 경우)

#### 예시 구성
```xml
<saml:Attribute Name="n8n_instance_role">
  <saml:AttributeValue>admin</saml:AttributeValue>
</saml:Attribute>
```

#### 역할 매핑 설정
IdP 그룹을 n8n 역할로 매핑:
- IdP 그룹 멤버십 확인
- 그룹별 역할 할당 규칙 정의
- 기본 역할 설정

### n8n_projects 속성 구성
사용자의 프로젝트 액세스 및 역할 정의:

#### 속성 설정
SAML 응답에 `n8n_projects` 속성 포함:
- 프로젝트별 역할 매핑
- 다중 프로젝트 액세스 지정
- 속성 이름: `n8n_projects`

#### 프로젝트 역할 값
프로젝트 수준에서 지원되는 역할:
- `project:admin`: 프로젝트 관리자
- `project:editor`: 프로젝트 편집자
- `project:viewer`: 프로젝트 뷰어

#### 형식
프로젝트 이름과 역할을 조합한 형식:
```
프로젝트명:역할
```

#### 다중 프로젝트 예시
```xml
<saml:Attribute Name="n8n_projects">
  <saml:AttributeValue>Marketing:project:editor</saml:AttributeValue>
  <saml:AttributeValue>Sales:project:viewer</saml:AttributeValue>
  <saml:AttributeValue>IT:project:admin</saml:AttributeValue>
</saml:Attribute>
```

#### 프로젝트 자동 생성
프로젝트가 존재하지 않는 경우:
- 자동으로 프로젝트 생성 (설정에 따라)
- 또는 오류 반환 및 수동 생성 필요
- 프로젝트 생성 정책 확인

## 일반 IdP를 위한 설정 리소스

### 주요 Identity Provider별 가이드
다양한 IdP에 대한 구성 참조:

#### Okta
- Okta Workforce Identity SAML 설정 가이드
- Okta 관리 콘솔에서 애플리케이션 구성
- 사용자 및 그룹 할당

#### Azure AD (Microsoft Entra ID)
- 엔터프라이즈 애플리케이션으로 n8n 추가
- 사용자 클레임 구성
- 조건부 액세스 정책 설정

#### Google Workspace
- 커스텀 SAML 앱으로 n8n 추가
- 서비스 제공자 세부정보 입력
- 사용자 속성 매핑

#### OneLogin
- OneLogin에서 n8n 커넥터 구성
- 파라미터 및 매핑 설정
- 사용자 프로비저닝 활성화

#### Auth0
- Auth0에서 SAML 애플리케이션 생성
- 콜백 URL 및 설정 구성
- 사용자 속성 매핑

### 공통 구성 요소
대부분의 IdP에서 필요한 공통 설정:
- Entity ID / Application ID
- ACS URL / Reply URL
- Single Logout URL (선택사항)
- 서명 인증서
- 사용자 속성 매핑

## 테스트 및 검증

### SAML 인증 테스트
구성 완료 후 테스트 절차:

#### 1. 테스트 사용자 생성
IdP에서 테스트 사용자 계정 생성:
- 적절한 그룹 할당
- SAML 속성 확인
- 액세스 권한 부여

#### 2. SSO 로그인 시도
n8n 로그인 페이지에서 SSO 옵션 선택:
- SAML 로그인 버튼 클릭
- IdP 로그인 페이지로 리디렉션 확인
- 자격증명 입력

#### 3. 인증 흐름 확인
SAML 인증 프로세스 검증:
- IdP에서 n8n으로 리디렉션
- 사용자 계정 자동 생성 또는 매핑
- n8n 대시보드 액세스 확인

#### 4. 역할 및 권한 확인
사용자의 역할과 권한이 올바르게 할당되었는지 검증:
- 인스턴스 역할 확인
- 프로젝트 액세스 확인
- 권한 범위 테스트

### 문제 해결
인증 실패 시 확인 사항:
- SAML 응답 검사 (브라우저 개발자 도구 또는 IdP 로그)
- 인증서 유효성 확인
- ACS URL 정확성 검증
- 속성 매핑 확인
- n8n 로그 검토

## 관련 리소스

### 추가 문서
SAML 설정 관련 추가 자료:
- **Okta Workforce Identity SAML 설정**: Okta 특정 구성 가이드
- **SAML로 사용자 관리**: SAML을 통한 사용자 라이프사이클 관리
- **SAML 문제 해결**: 일반적인 문제 및 해결 방법

### 지원 채널
도움이 필요한 경우:
- n8n 커뮤니티 포럼
- 기술 지원 티켓
- 공식 문서 및 가이드

## 보안 모범 사례

### 인증서 관리
SAML 인증서의 안전한 관리:
- 강력한 암호화 알고리즘 사용 (최소 2048비트 RSA)
- 정기적인 인증서 갱신 (만료 전)
- 인증서 만료 알림 설정
- 안전한 키 저장

### 메타데이터 보안
메타데이터 파일의 보호:
- 메타데이터 서명 검증
- HTTPS를 통한 메타데이터 교환
- 정기적인 메타데이터 동기화

### 세션 및 토큰 관리
보안 세션 구성:
- 적절한 세션 타임아웃 설정
- 재인증 정책 구성
- Single Logout 활성화

### 액세스 제어
최소 권한 원칙 적용:
- 필요한 최소 역할 할당
- 정기적인 액세스 검토
- 미사용 계정 비활성화

## 프로덕션 배포

### 배포 전 체크리스트
- [ ] 모든 필수 속성 매핑 완료
- [ ] 테스트 사용자로 전체 흐름 검증
- [ ] 인증서 만료 날짜 확인
- [ ] 백업 인증 방법 준비
- [ ] 사용자 교육 자료 준비

### 단계적 배포
점진적인 SAML 활성화:
1. 파일럿 그룹으로 제한 배포
2. 피드백 수집 및 문제 해결
3. 단계적으로 사용자 그룹 확대
4. 전체 조직에 배포

### 모니터링
배포 후 모니터링:
- 인증 성공률 추적
- 오류 로그 모니터링
- 사용자 피드백 수집
- 성능 메트릭 확인

## 유지보수

### 정기 작업
SAML 구성의 지속적인 관리:
- 인증서 갱신
- 메타데이터 업데이트
- 사용자 속성 매핑 검토
- 액세스 권한 감사

### 변경 관리
SAML 구성 변경 시:
- 변경 사항 문서화
- 테스트 환경에서 사전 검증
- 롤백 계획 준비
- 사용자에게 변경 사항 공지
