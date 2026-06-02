# 환경 변수 관리

n8n Source Control 환경에서 변수를 관리하고 환경별로 다른 값을 사용하는 방법

## 환경 변수 개요

### 환경 변수란?
```
정의: 환경별로 다른 값을 가질 수 있는 설정 값

사용 사례:
- API 엔드포인트 URL
- 데이터베이스 연결 정보
- 알림 채널
- 기능 플래그
- 환경 식별자
```

### 필요성
```
문제: 하드코딩된 값
워크플로우에 "https://api.company.com" 직접 입력
→ 환경마다 수동으로 변경 필요

해결: 환경 변수 사용
워크플로우에 $env.API_URL 사용
→ 각 환경에서 자동으로 다른 값 사용
```

## n8n 변수 설정

### Cloud에서 변수 설정
```
1. Settings > Variables
2. "Add Variable" 클릭
3. 정보 입력:
   Key: API_BASE_URL
   Value: https://api-dev.company.com
   Type: String
4. Save
```

### Self-hosted에서 변수 설정

**환경 변수 파일 (.env):**
```bash
# .env
API_BASE_URL=https://api-dev.company.com
DATABASE_HOST=dev-db.company.com
SLACK_CHANNEL=#dev-alerts
ENVIRONMENT=development
LOG_LEVEL=debug
```

**Docker Compose:**
```yaml
services:
  n8n-dev:
    image: n8nio/n8n
    environment:
      - API_BASE_URL=https://api-dev.company.com
      - DATABASE_HOST=dev-db.company.com
      - SLACK_CHANNEL=#dev-alerts
      - ENVIRONMENT=development
    env_file:
      - .env
```

**Docker run:**
```bash
docker run -d \
  -e API_BASE_URL=https://api-dev.company.com \
  -e DATABASE_HOST=dev-db.company.com \
  -e ENVIRONMENT=development \
  --name n8n \
  n8nio/n8n
```

## 환경별 변수 설정

### Development 환경
```
ENVIRONMENT=development
API_BASE_URL=https://api-dev.company.com
DATABASE_HOST=dev-db.company.com
DATABASE_NAME=test_db
SLACK_WEBHOOK_URL=https://hooks.slack.com/dev-webhook
SLACK_CHANNEL=#dev-alerts
LOG_LEVEL=debug
FEATURE_NEW_UI=true
RATE_LIMIT=1000
TIMEOUT=30000
```

### Staging 환경
```
ENVIRONMENT=staging
API_BASE_URL=https://api-staging.company.com
DATABASE_HOST=staging-db.company.com
DATABASE_NAME=staging_db
SLACK_WEBHOOK_URL=https://hooks.slack.com/staging-webhook
SLACK_CHANNEL=#staging-alerts
LOG_LEVEL=info
FEATURE_NEW_UI=true
RATE_LIMIT=500
TIMEOUT=20000
```

### Production 환경
```
ENVIRONMENT=production
API_BASE_URL=https://api.company.com
DATABASE_HOST=prod-db.company.com
DATABASE_NAME=production_db
SLACK_WEBHOOK_URL=https://hooks.slack.com/prod-webhook
SLACK_CHANNEL=#production-alerts
LOG_LEVEL=warn
FEATURE_NEW_UI=false
RATE_LIMIT=100
TIMEOUT=10000
```

## 워크플로우에서 변수 사용

### Expression에서 사용
```javascript
// HTTP Request 노드의 URL
$env.API_BASE_URL + '/api/customers'

// If 노드의 조건
$env.ENVIRONMENT === 'production'

// Code 노드에서
const apiUrl = $env.API_BASE_URL;
const environment = $env.ENVIRONMENT;

if (environment === 'production') {
  // 프로덕션 로직
} else {
  // 개발/테스트 로직
}
```

### 노드 설정에서 사용

**HTTP Request 노드:**
```
URL: {{$env.API_BASE_URL}}/api/endpoint
Timeout: {{$env.TIMEOUT}}
```

**Slack 노드:**
```
Channel: {{$env.SLACK_CHANNEL}}
```

**Database 노드:**
```
Host: {{$env.DATABASE_HOST}}
Database: {{$env.DATABASE_NAME}}
```

### Code 노드 예시
```javascript
// 환경별 로직 분기
const env = $env.ENVIRONMENT;
const apiUrl = $env.API_BASE_URL;

// API 호출
const response = await fetch(`${apiUrl}/api/data`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${$env.API_TOKEN}`
  },
  timeout: parseInt($env.TIMEOUT)
});

// 환경별 처리
if (env === 'production') {
  // 프로덕션: 실제 데이터 처리
  return items;
} else {
  // 개발/스테이징: 로깅 추가
  console.log('Response:', response);
  return items;
}
```

## 변수 타입

### String (문자열)
```
Key: API_BASE_URL
Value: https://api.company.com
Type: String

사용: $env.API_BASE_URL
```

### Number (숫자)
```
Key: RATE_LIMIT
Value: 100
Type: Number

사용: $env.RATE_LIMIT
변환: parseInt($env.RATE_LIMIT)
```

### Boolean (불리언)
```
Key: FEATURE_FLAG
Value: true
Type: Boolean

사용: $env.FEATURE_FLAG
변환: $env.FEATURE_FLAG === 'true'
```

### JSON
```
Key: CONFIG
Value: {"timeout":30000,"retries":3}
Type: JSON

사용: JSON.parse($env.CONFIG)
```

## Git과 변수 동기화

### 변수 파일 구조
```
n8n-workflows/
├── variables/
│   ├── development.json
│   ├── staging.json
│   └── production.json
└── .gitignore
```

### 변수 파일 예시

**variables/development.json:**
```json
{
  "ENVIRONMENT": "development",
  "API_BASE_URL": "https://api-dev.company.com",
  "LOG_LEVEL": "debug",
  "FEATURE_NEW_UI": true
}
```

**variables/production.json:**
```json
{
  "ENVIRONMENT": "production",
  "API_BASE_URL": "https://api.company.com",
  "LOG_LEVEL": "warn",
  "FEATURE_NEW_UI": false
}
```

### .gitignore 설정
```gitignore
# 민감한 변수는 Git에서 제외
variables/*-secrets.json
.env
.env.local
*.key
```

## 민감한 정보 관리

### 비밀 정보 분리
```
공개 가능 (Git에 포함):
✓ API_BASE_URL
✓ ENVIRONMENT
✓ LOG_LEVEL
✓ FEATURE_FLAG

민감 정보 (Git 제외):
✗ API_TOKEN
✗ DATABASE_PASSWORD
✗ WEBHOOK_SECRET
✗ ENCRYPTION_KEY
```

### 비밀 관리 전략

**옵션 1: n8n Credentials 사용 (권장)**
```
민감한 값은 n8n Credentials로 저장
- 암호화되어 저장
- 환경별로 분리
- Git에 포함 안 됨
```

**옵션 2: 외부 비밀 관리 서비스**
```
- AWS Secrets Manager
- Azure Key Vault
- HashiCorp Vault
- Google Secret Manager

워크플로우에서 API로 가져오기
```

**옵션 3: 환경 변수 (Self-hosted)**
```bash
# 민감한 정보는 직접 환경 변수로
docker run -d \
  -e DATABASE_PASSWORD=secure_password \
  -e API_SECRET_KEY=secret_key \
  n8nio/n8n
```

## 변수 명명 규칙

### 권장 규칙
```
형식: SCREAMING_SNAKE_CASE

좋은 예:
✓ API_BASE_URL
✓ DATABASE_HOST
✓ MAX_RETRY_COUNT
✓ FEATURE_NEW_UI

나쁜 예:
✗ apiUrl (camelCase)
✗ api-url (kebab-case)
✗ ApiUrl (PascalCase)
```

### 접두사 사용
```
용도별 접두사:

API_*
- API_BASE_URL
- API_TIMEOUT
- API_VERSION

DB_*
- DB_HOST
- DB_PORT
- DB_NAME

FEATURE_*
- FEATURE_NEW_UI
- FEATURE_BETA_ACCESS
- FEATURE_ANALYTICS

SLACK_*
- SLACK_WEBHOOK_URL
- SLACK_CHANNEL
- SLACK_USERNAME
```

## 조건부 로직

### 환경 감지
```javascript
// Code 노드에서 환경별 분기
const env = $env.ENVIRONMENT;

switch(env) {
  case 'production':
    // 프로덕션 로직
    break;
  case 'staging':
    // 스테이징 로직
    break;
  default:
    // 개발 로직
}
```

### Feature Flag
```javascript
// 기능 플래그로 기능 제어
if ($env.FEATURE_NEW_UI === 'true') {
  // 새 UI 사용
} else {
  // 기존 UI 사용
}

// 환경별 기능 활성화
const enableAdvancedLogging =
  $env.ENVIRONMENT !== 'production' &&
  $env.FEATURE_DEBUG === 'true';
```

## 변수 검증

### 필수 변수 체크
```javascript
// Code 노드에서 필수 변수 확인
const requiredVars = [
  'API_BASE_URL',
  'DATABASE_HOST',
  'ENVIRONMENT'
];

const missing = requiredVars.filter(v => !$env[v]);

if (missing.length > 0) {
  throw new Error(`Missing required variables: ${missing.join(', ')}`);
}
```

### 값 검증
```javascript
// 환경 값 검증
const validEnvironments = ['development', 'staging', 'production'];
if (!validEnvironments.includes($env.ENVIRONMENT)) {
  throw new Error(`Invalid environment: ${$env.ENVIRONMENT}`);
}

// 숫자 범위 검증
const timeout = parseInt($env.TIMEOUT);
if (timeout < 1000 || timeout > 60000) {
  throw new Error(`Timeout out of range: ${timeout}`);
}
```

## 문제 해결

### 변수가 undefined
```
증상: $env.MY_VAR가 undefined

원인:
1. 변수가 설정되지 않음
2. 변수 이름 오타
3. 대소문자 불일치

해결:
1. Settings > Variables 확인
2. 변수 이름 재확인
3. 대문자로 통일
```

### 변수가 문자열로 반환
```
증상: $env.RATE_LIMIT가 "100" (문자열)

원인: 환경 변수는 기본적으로 문자열

해결: 타입 변환
parseInt($env.RATE_LIMIT)
parseFloat($env.PRICE)
$env.ENABLED === 'true'
```

## 모범 사례

### Do's (권장)
```
✓ 명확한 변수명 사용
✓ 환경별로 일관된 변수 세트
✓ 민감한 정보는 Credentials 사용
✓ 변수 문서화
✓ 기본값 설정
✓ 변수 검증 구현
```

### Don'ts (비권장)
```
✗ 하드코딩
✗ 민감 정보를 Git에 커밋
✗ 일관성 없는 명명
✗ 필수 변수 누락
✗ 변수 과다 사용
```

## 관련 문서

- [환경 관리](./02-environments.md)
- [Source Control 설정](./03-setup.md)
- [자격 증명 관리](../manage-cloud/credentials.md)
- [보안 모범 사례](../security/)
