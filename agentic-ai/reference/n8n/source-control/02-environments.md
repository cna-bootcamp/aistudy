# 환경 (Environments)

n8n에서 여러 환경을 설정하고 관리하여 안전하게 워크플로우를 개발, 테스트, 배포하는 방법

## 환경이란?

### 정의
환경(Environment)은 독립적인 n8n 인스턴스로, 각각 고유한 워크플로우, 설정, 데이터를 가짐

### 환경의 필요성
```
문제: 프로덕션에서 직접 테스트 → 서비스 중단 위험

해결: 환경 분리
Development → Staging → Production
```

## 표준 환경 구조

### 3-tier 환경
```
┌─────────────────┐
│  Development    │  개발 및 실험
│  (dev)          │
└────────┬────────┘
         │ 테스트 완료
         ↓
┌─────────────────┐
│  Staging        │  통합 테스트
│  (staging)      │
└────────┬────────┘
         │ 승인
         ↓
┌─────────────────┐
│  Production     │  실제 운영
│  (prod)         │
└─────────────────┘
```

### 2-tier 환경 (소규모)
```
┌─────────────────┐
│  Development    │
│  (dev)          │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Production     │
│  (prod)         │
└─────────────────┘
```

## 환경별 특성

### Development (개발 환경)

**목적:**
- 새 워크플로우 개발
- 실험 및 테스트
- 빠른 반복 개발

**특징:**
```
Git 브랜치: develop, feature/*
데이터: 테스트/더미 데이터
API: 테스트/샌드박스 API
알림: 개발자만
실행 빈도: 수동 또는 빈번
안정성: 낮음 (실험 허용)
```

**설정 예시:**
```
인스턴스 URL: dev.n8n.company.com
Git 브랜치: develop
자격 증명:
  - Slack: #dev-alerts
  - DB: test_database
  - API: sandbox_api_key
```

### Staging (스테이징 환경)

**목적:**
- 프로덕션 유사 환경에서 테스트
- 통합 테스트
- 성능 테스트
- UAT (사용자 수용 테스트)

**특징:**
```
Git 브랜치: staging, release/*
데이터: 프로덕션 복제본 (민감 데이터 마스킹)
API: 프로덕션 API (테스트 계정)
알림: QA 팀
실행 빈도: 예정된 테스트
안정성: 중간
```

**설정 예시:**
```
인스턴스 URL: staging.n8n.company.com
Git 브랜치: staging
자격 증명:
  - Slack: #staging-alerts
  - DB: staging_database (prod 복제)
  - API: test_account_api_key
```

### Production (프로덕션 환경)

**목적:**
- 실제 비즈니스 운영
- 최종 사용자 서비스
- 안정성 최우선

**특징:**
```
Git 브랜치: main, master
데이터: 실제 프로덕션 데이터
API: 프로덕션 API
알림: 운영팀, 이해관계자
실행 빈도: 실제 비즈니스 요구사항
안정성: 높음 (변경 통제 엄격)
```

**설정 예시:**
```
인스턴스 URL: n8n.company.com
Git 브랜치: main
자격 증명:
  - Slack: #production-alerts
  - DB: production_database
  - API: production_api_key
모니터링: 24/7
백업: 매일
```

## 환경 설정

### Cloud 환경 설정

**별도 워크스페이스 사용:**
```
1. 각 환경마다 별도 n8n Cloud 워크스페이스 생성
2. 각 워크스페이스를 동일 Git 리포지토리의 다른 브랜치에 연결
3. 환경별 자격 증명 별도 설정
```

**설정 단계:**
```
Development 워크스페이스:
1. 새 워크스페이스 생성: "Company Dev"
2. Settings > Source Control
3. Git URL 연결
4. Branch: develop
5. 자격 증명 설정 (테스트용)

Production 워크스페이스:
1. 새 워크스페이스 생성: "Company Prod"
2. Settings > Source Control
3. 동일 Git URL 연결
4. Branch: main
5. 자격 증명 설정 (프로덕션용)
```

### Self-hosted 환경 설정

**Docker Compose 예시:**
```yaml
version: '3.8'

services:
  n8n-dev:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=dev
      - N8N_BASIC_AUTH_PASSWORD=dev_password
      - WEBHOOK_URL=https://dev.n8n.company.com
    volumes:
      - n8n_dev_data:/home/node/.n8n

  n8n-staging:
    image: n8nio/n8n
    ports:
      - "5679:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=staging
      - N8N_BASIC_AUTH_PASSWORD=staging_password
      - WEBHOOK_URL=https://staging.n8n.company.com
    volumes:
      - n8n_staging_data:/home/node/.n8n

  n8n-prod:
    image: n8nio/n8n
    ports:
      - "5680:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=prod
      - N8N_BASIC_AUTH_PASSWORD=prod_password
      - WEBHOOK_URL=https://n8n.company.com
    volumes:
      - n8n_prod_data:/home/node/.n8n

volumes:
  n8n_dev_data:
  n8n_staging_data:
  n8n_prod_data:
```

## 환경 간 워크플로우 이동

### Git을 통한 승격

**Development → Staging:**
```bash
# Development에서 작업 완료
git checkout develop
git commit -m "feat: Add customer notification workflow"
git push origin develop

# Pull Request 생성
gh pr create --base staging --head develop \
  --title "Deploy to Staging" \
  --body "New customer notification workflow"

# 승인 후 병합
gh pr merge --merge

# Staging 인스턴스에서 Pull
# n8n Staging > Source Control > Pull from Git
```

**Staging → Production:**
```bash
# Staging 테스트 완료 후
git checkout staging
git checkout -b release/v1.2.0
git push origin release/v1.2.0

# Production으로 Pull Request
gh pr create --base main --head release/v1.2.0 \
  --title "Release v1.2.0" \
  --body "Release notes..."

# 승인 후 병합
gh pr merge --merge

# Production 인스턴스에서 Pull
# n8n Production > Source Control > Pull from Git
```

### 수동 워크플로우 이동

**Export/Import 방식:**
```
1. Development에서 워크플로우 Export
2. JSON 파일 검토
3. Production에서 Import
4. 자격 증명 매핑 확인
5. 테스트 실행
6. 활성화
```

## 환경별 변수 관리

### 환경 변수 사용
```javascript
// 워크플로우에서 환경 감지
const environment = $env.ENVIRONMENT; // 'dev', 'staging', 'prod'

if (environment === 'prod') {
  // 프로덕션 로직
  const apiUrl = $env.PROD_API_URL;
} else if (environment === 'staging') {
  // 스테이징 로직
  const apiUrl = $env.STAGING_API_URL;
} else {
  // 개발 로직
  const apiUrl = $env.DEV_API_URL;
}
```

### 변수 설정 위치
```
Cloud:
Settings > Variables > Add Variable

Self-hosted:
Environment variables 또는 .env 파일

Docker:
environment:
  - ENVIRONMENT=production
  - PROD_API_URL=https://api.company.com
```

## 환경별 자격 증명 관리

### 자격 증명 전략

**환경별 별도 자격 증명:**
```
Development:
  Slack_Dev:
    - Webhook: dev_webhook_url
    - Channel: #dev-alerts

  DB_Dev:
    - Host: dev-db.company.com
    - Database: test_db

Production:
  Slack_Prod:
    - Webhook: prod_webhook_url
    - Channel: #production-alerts

  DB_Prod:
    - Host: prod-db.company.com
    - Database: production_db
```

**이름 규칙:**
```
좋은 예:
✓ Slack_Dev
✓ Slack_Prod
✓ Database_Staging

나쁜 예:
✗ Slack (환경 불명확)
✗ Prod1 (용도 불명확)
```

## 환경 동기화 전략

### 정기 동기화
```
일일 동기화 (자동):
- Development → Staging (nightly)
- Staging 테스트
- 문제 없으면 Production 대기

주간 릴리스:
- 매주 금요일 Staging → Production
- 릴리스 노트 작성
- 롤백 계획 수립
```

### Hotfix 프로세스
```
긴급 수정:
1. Production에서 이슈 확인
2. Development에서 수정
3. Staging에서 긴급 테스트
4. Production 즉시 배포
5. 모든 브랜치에 반영
```

## 환경 격리

### 네트워크 격리
```
Development:
- VPN 필요
- 내부 네트워크만 접근

Staging:
- 제한된 공개 접근
- 인증 필요

Production:
- 공개 또는 제한 접근
- 강력한 인증 및 모니터링
```

### 데이터 격리
```
- 환경 간 데이터 공유 금지
- 프로덕션 데이터는 마스킹 후 사용
- 개발/테스트 데이터는 더미 데이터
```

## 모니터링 및 알림

### 환경별 모니터링
```
Development:
- 오류 로그 개발자에게
- 느슨한 임계값

Staging:
- 상세 로깅
- 성능 메트릭 수집

Production:
- 실시간 모니터링
- 즉각적인 알림
- 온콜 대응
```

## 관련 문서

- [Source Control 이해](./01-understand.md)
- [환경 생성 튜토리얼](./06-create-environments.md)
- [변수 관리](./07-variables.md)
- [브랜치 패턴](./05-branch-patterns.md)
