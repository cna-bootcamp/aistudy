# n8n 외부 시크릿 관리

## 개요

외부 시크릿(External Secrets) 기능은 n8n이 외부 시크릿 스토어와 연동하여
민감한 인증 정보를 중앙 집중식으로 관리할 수 있게 하는 Enterprise 기능임

## 주요 개념

### 외부 시크릿 스토어
Credential 정보를 n8n 데이터베이스 외부의 전문 보안 시스템에 저장

**장점**:
- 중앙 집중식 시크릿 관리
- 강화된 보안 및 암호화
- 자동 키 로테이션
- 규정 준수 용이
- 감사 로그 통합

**지원 시크릿 스토어**:
- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault
- Google Secret Manager
- Infisical
- 기타 시크릿 관리 시스템

## 작동 원리

### 기본 흐름
```
1. n8n Credential 생성
2. 외부 시크릿 소스 지정
3. n8n이 런타임에 시크릿 스토어에서 값 조회
4. 조회된 값으로 API 인증
5. 시크릿은 메모리에만 존재, 저장 안 됨
```

### 아키텍처
```
n8n 워크플로우
    ↓
Credential 참조
    ↓
외부 시크릿 스토어 조회
    ↓
시크릿 값 반환 (런타임)
    ↓
외부 API 인증
```

## n8n을 외부 시크릿 스토어에 연결

### 사전 요구사항
- n8n Enterprise 라이선스
- 지원되는 시크릿 스토어 계정
- 인스턴스 소유자 또는 관리자 권한
- 네트워크 접근 권한

### 연결 설정

**STEP 1. 시크릿 스토어 설정**
시크릿 스토어에서 n8n 접근을 위한 설정 완료:
- API 키 또는 액세스 토큰 생성
- n8n이 읽을 수 있는 권한 부여
- 필요한 시크릿 경로 생성

**STEP 2. n8n 환경 변수 설정**
n8n 인스턴스에 시크릿 스토어 연결 정보 구성:

```bash
# HashiCorp Vault 예시
N8N_EXTERNAL_SECRETS_PROVIDER=vault
N8N_VAULT_URL=https://vault.example.com
N8N_VAULT_TOKEN=your-vault-token
N8N_VAULT_NAMESPACE=your-namespace

# AWS Secrets Manager 예시
N8N_EXTERNAL_SECRETS_PROVIDER=aws
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Infisical 예시
N8N_EXTERNAL_SECRETS_PROVIDER=infisical
INFISICAL_URL=https://app.infisical.com
INFISICAL_TOKEN=your-token
```

**STEP 3. n8n 재시작**
환경 변수 적용을 위해 n8n 재시작

**STEP 4. 연결 확인**
- n8n 로그에서 연결 상태 확인
- 테스트 Credential로 연결 검증

### Infisical 통합

**Infisical 설정**:
1. Infisical 계정 생성 및 프로젝트 설정
2. Service Token 생성
3. 시크릿 추가 (Key-Value 형식)

**n8n 설정**:
```bash
N8N_EXTERNAL_SECRETS_PROVIDER=infisical
INFISICAL_URL=https://app.infisical.com
INFISICAL_TOKEN=st.xxxx.yyyy.zzzz
INFISICAL_WORKSPACE_ID=workspace-id
INFISICAL_ENVIRONMENT=production
```

**버전 호환성**:
- Infisical v3.0+ 필요
- 이전 버전은 API 변경으로 호환성 문제 발생 가능
- 최신 버전 사용 권장

## Credential에서 외부 시크릿 사용

### 시크릿 참조 구성

**STEP 1. Credential 생성**
- 일반적인 방법으로 Credential 생성
- 서비스 타입 선택 (예: Slack, Google Sheets)

**STEP 2. 외부 시크릿 활성화**
- Credential 설정에서 "Use external secret" 옵션 선택
- 시크릿 스토어 소스 선택

**STEP 3. 시크릿 경로 지정**
시크릿 스토어의 경로를 참조 형식으로 입력:

```
# HashiCorp Vault
secret/data/n8n/slack-token

# AWS Secrets Manager
n8n/credentials/slack-api-key

# Infisical
/production/slack/bot-token
```

**STEP 4. 필드 매핑**
- Credential의 각 필드를 시크릿 키에 매핑
- 예: API Key 필드 → `apiKey` 키

**STEP 5. 테스트 및 저장**
- "Test Connection" 클릭
- 성공 시 Credential 저장

### 예시: Slack Credential

**시크릿 스토어 (Infisical)**:
```json
{
  "path": "/production/slack",
  "secrets": {
    "bot-token": "xoxb-1234567890-...",
    "app-token": "xapp-1234567890-..."
  }
}
```

**n8n Credential 설정**:
```
Credential Type: Slack OAuth2 API
Use External Secret: ✓
Provider: Infisical
Secret Path: /production/slack
Token Field: bot-token
```

## 환경별 시크릿 관리

### 개발/스테이징/프로덕션 분리

**환경별 경로 구성**:
```
/development/service/api-key
/staging/service/api-key
/production/service/api-key
```

**n8n 환경 변수로 전환**:
```bash
# 개발 환경
N8N_EXTERNAL_SECRETS_PREFIX=/development

# 프로덕션 환경
N8N_EXTERNAL_SECRETS_PREFIX=/production
```

### 프로젝트별 시크릿

**프로젝트 구조**:
```
/projects/project-a/slack-token
/projects/project-b/slack-token
/shared/common-api-key
```

**Credential 설정**:
각 프로젝트에서 해당 경로의 시크릿 참조

## 환경 변수와 외부 시크릿 통합

### 환경 변수 사용

**시나리오**:
동일한 워크플로우를 여러 환경에서 실행하되 서로 다른 시크릿 사용

**구성**:
```bash
# 환경 변수 설정
ENVIRONMENT=production

# 시크릿 경로에 환경 변수 포함
/${ENVIRONMENT}/service/api-key
```

**n8n에서 사용**:
```javascript
// Expression에서 환경 변수 참조
{{ $env.ENVIRONMENT }}
```

## 프로젝트에서 외부 시크릿 사용

### 프로젝트 범위 설정

**프로젝트별 시크릿 격리**:
1. 프로젝트 생성
2. 프로젝트 전용 시크릿 경로 설정
3. 팀원에게 프로젝트 접근 권한 부여
4. 시크릿 스토어에서도 동일한 접근 제어

**장점**:
- 프로젝트 간 시크릿 격리
- 명확한 권한 경계
- 감사 추적 용이

## 보안 모범 사례

### 접근 제어

**시크릿 스토어 레벨**:
- 최소 권한 원칙 적용
- n8n 서비스 계정에 읽기 권한만 부여
- 정기적인 토큰 로테이션
- IP 화이트리스트 설정

**n8n 레벨**:
- 인스턴스 소유자 또는 관리자만 외부 시크릿 설정 가능
- Credential 소유자만 시크릿 경로 변경 가능
- 팀원은 시크릿 값 조회 불가

### 감사 및 모니터링

**로깅**:
- 시크릿 접근 이력 기록
- 실패한 접근 시도 모니터링
- 비정상 패턴 감지

**알림**:
- 시크릿 접근 실패 시 알림
- 권한 변경 알림
- 예상치 못한 접근 알림

### 네트워크 보안

**전송 중 암호화**:
- TLS/SSL 필수
- 신뢰할 수 있는 CA 인증서 사용
- 중간자 공격 방지

**방화벽 규칙**:
- n8n에서 시크릿 스토어로의 아웃바운드만 허용
- 필요한 포트만 개방
- VPC 피어링 또는 Private Link 사용

## 문제 해결

### 일반적인 오류

**연결 실패**:
```
Error: Cannot connect to external secrets provider
```

**해결책**:
1. 환경 변수 확인
2. 네트워크 연결 테스트
3. 시크릿 스토어 상태 확인
4. 인증 정보 유효성 검증

**시크릿 조회 실패**:
```
Error: Secret not found at path: /production/api-key
```

**해결책**:
1. 경로 정확성 확인
2. 시크릿 존재 여부 확인
3. 접근 권한 확인
4. 네임스페이스/환경 설정 확인

**권한 오류**:
```
Error: Only instance owners or admins can set external secrets
```

**해결책**:
- 인스턴스 소유자 또는 관리자에게 설정 요청
- 역할 확인 및 권한 부여

### Infisical 버전 문제

**증상**:
Infisical v2.x에서 작동하던 설정이 v3.x에서 실패

**원인**:
API 변경 및 인증 방식 업데이트

**해결책**:
1. Infisical를 v3.0 이상으로 업데이트
2. Service Token 재생성
3. n8n 환경 변수 업데이트
4. 연결 재테스트

### 디버깅 팁

**로그 확인**:
```bash
# n8n 로그 레벨 설정
N8N_LOG_LEVEL=debug

# 시크릿 관련 로그 필터링
docker logs n8n | grep "external-secrets"
```

**연결 테스트**:
```bash
# Vault 예시
curl -H "X-Vault-Token: $N8N_VAULT_TOKEN" \
  $N8N_VAULT_URL/v1/secret/data/test

# AWS Secrets Manager 예시
aws secretsmanager get-secret-value \
  --secret-id n8n/test \
  --region us-east-1
```

## 마이그레이션

### 내부 Credential을 외부 시크릿으로 전환

**단계**:
1. 현재 Credential 정보 수집
2. 시크릿 스토어에 동일한 값 저장
3. n8n Credential을 외부 시크릿 참조로 변경
4. 테스트 워크플로우 실행
5. 검증 후 내부 Credential 삭제

**스크립트 예시**:
```bash
#!/bin/bash
# Credential을 시크릿 스토어로 마이그레이션

# 1. n8n에서 Credential Export
# 2. 시크릿 스토어에 업로드
for cred in credentials/*.json; do
  name=$(basename $cred .json)
  vault kv put secret/n8n/$name @$cred
done

# 3. n8n에서 외부 시크릿 참조 업데이트
```

### 시크릿 스토어 변경

**시나리오**:
HashiCorp Vault에서 AWS Secrets Manager로 전환

**단계**:
1. 새 시크릿 스토어에 모든 시크릿 복사
2. n8n 환경 변수 업데이트
3. n8n 재시작
4. Credential 연결 테스트
5. 이전 시크릿 스토어 비활성화

## 고급 구성

### 다중 시크릿 스토어

일부 Enterprise 설정에서는 여러 시크릿 스토어 동시 사용 가능:

```bash
# 기본 시크릿 스토어
N8N_EXTERNAL_SECRETS_PROVIDER=vault

# 보조 시크릿 스토어
N8N_EXTERNAL_SECRETS_PROVIDER_SECONDARY=aws
```

### 시크릿 캐싱

**성능 최적화**:
- 시크릿 값 일시적 캐싱
- TTL(Time To Live) 설정
- 민감도에 따라 캐싱 여부 결정

```bash
N8N_EXTERNAL_SECRETS_CACHE_TTL=300  # 5분
```

### 폴백 메커니즘

**시크릿 스토어 장애 대비**:
- 보조 시크릿 스토어 설정
- 로컬 폴백 Credential
- 우아한 에러 처리

## 규정 준수

### 감사 요구사항

**기록 항목**:
- 시크릿 접근 시간
- 접근한 사용자/워크플로우
- 접근 결과 (성공/실패)
- 변경 이력

### 데이터 레지던시

**지역별 시크릿 스토어**:
- EU 데이터는 EU 리전 시크릿 스토어
- 미국 데이터는 미국 리전
- 규정 준수 보장

### 암호화 표준

**전송 중**:
- TLS 1.2 이상
- 강력한 암호화 스위트

**저장 시**:
- 시크릿 스토어의 자체 암호화
- 추가 암호화 레이어 (옵션)

## 참고사항

### 성능 고려사항

**지연 시간**:
- 외부 시크릿 조회로 인한 약간의 지연
- 캐싱으로 완화 가능
- 네트워크 거리 최소화

**요청 제한**:
- 시크릿 스토어 API Rate Limit 고려
- 효율적인 시크릿 조회 패턴
- 불필요한 반복 조회 방지

### 비용

**시크릿 스토어 비용**:
- API 호출 횟수 기반 요금
- 저장 용량 기반 요금
- 네트워크 전송 비용

**최적화**:
- 시크릿 통합 및 재사용
- 캐싱 활용
- 불필요한 시크릿 정리

## 추가 리소스

### 문서
- 시크릿 스토어별 상세 가이드
- 보안 베스트 프랙티스
- 마이그레이션 가이드

### 지원
- Enterprise 지원팀
- 보안 컨설팅
- 온보딩 지원

### 도구
- 마이그레이션 스크립트
- 모니터링 대시보드
- 자동화 도구
