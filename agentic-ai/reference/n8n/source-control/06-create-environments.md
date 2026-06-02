# 환경 생성 튜토리얼

Source Control을 사용하여 Development, Staging, Production 환경을 처음부터 설정하는 단계별 가이드

## 튜토리얼 개요

### 목표
```
3개의 독립적인 n8n 환경 생성:
1. Development (개발)
2. Staging (스테이징)
3. Production (프로덕션)

각 환경은 Git의 다른 브랜치에 연결됨
```

### 사전 요구사항
```
✓ GitHub/GitLab 계정
✓ n8n Cloud 계정 (Pro 플랜 이상) 또는 Self-hosted 인스턴스 3개
✓ Git 기본 지식
✓ 30분 소요 시간
```

## STEP 1: Git 리포지토리 준비

### 리포지토리 생성
```bash
# 1. GitHub에서 리포지토리 생성
gh repo create company-workflows --private --description "n8n workflow repository"

# 2. 로컬에 클론
git clone git@github.com:yourcompany/company-workflows.git
cd company-workflows

# 3. 초기 구조 생성
mkdir -p workflows credentials variables docs

# 4. .gitignore 생성
cat > .gitignore << 'EOF'
# 민감 정보
.env
*.pem
*.key

# 실제 자격 증명 (ID만 저장)
credentials/*.json
!credentials/credential-mapping.json

# 로그
*.log
logs/

# 임시 파일
*.tmp
.DS_Store
EOF

# 5. README 생성
cat > README.md << 'EOF'
# Company n8n Workflows

## 환경
- Development: develop 브랜치
- Staging: staging 브랜치
- Production: main 브랜치

## 구조
- `workflows/`: 워크플로우 JSON 파일
- `variables/`: 환경 변수
- `docs/`: 문서

## 배포
[배포 프로세스 문서](docs/DEPLOYMENT.md)
EOF

# 6. 초기 커밋
git add .
git commit -m "Initial commit: Project structure"
git push -u origin main
```

### 브랜치 생성
```bash
# develop 브랜치 생성
git checkout -b develop
git push -u origin develop

# staging 브랜치 생성
git checkout -b staging
git push -u origin staging

# main을 기본 브랜치로 확인
git checkout main
```

### 브랜치 보호 설정
```bash
# main 브랜치 보호
gh api repos/yourcompany/company-workflows/branches/main/protection \
  --method PUT \
  --field required_pull_request_reviews='{"required_approving_review_count":1}' \
  --field restrictions=null

# staging 브랜치 보호
gh api repos/yourcompany/company-workflows/branches/staging/protection \
  --method PUT \
  --field required_pull_request_reviews='{"required_approving_review_count":1}' \
  --field restrictions=null
```

## STEP 2: Development 환경 설정

### n8n Cloud 워크스페이스 생성

**옵션 A: 새 워크스페이스 (권장)**
```
1. n8n Cloud 로그인
2. 워크스페이스 스위처 클릭 (좌측 상단)
3. "Create Workspace" 클릭
4. 이름: "Company Dev"
5. 플랜 선택: Pro
6. Create
```

**옵션 B: 기존 워크스페이스 사용**
```
기존 워크스페이스를 Development로 사용
```

### Source Control 연결
```
1. Settings > Source Control
2. "Connect to Git" 클릭
3. 설정 입력:
   Provider: GitHub
   Repository: yourcompany/company-workflows
   Branch: develop
   Authentication: SSH Key

4. SSH Key 등록:
   - n8n 제공 Public Key 복사
   - GitHub > Settings > SSH Keys
   - "New SSH key" 클릭
   - Title: "n8n Development"
   - Key 붙여넣기
   - Add SSH key

5. "Test Connection" 클릭
6. "Save" 클릭
```

### 초기 동기화
```
1. Source Control 패널 열기
2. "Push to Git" 탭
3. 옵션 선택:
   ☑ Push existing workflows (기존 워크플로우 있는 경우)
   ☐ Skip initial sync (비어있는 경우)
4. Commit message: "Initial sync from Development"
5. "Push" 클릭
```

### 환경 변수 설정
```
Settings > Variables

ENVIRONMENT: development
API_BASE_URL: https://api-dev.company.com
SLACK_CHANNEL: #dev-alerts
LOG_LEVEL: debug
```

### 자격 증명 생성
```
Credentials > New Credential

예시:
1. Slack_Dev
   Type: Slack
   Webhook URL: https://hooks.slack.com/dev-webhook

2. Database_Dev
   Type: PostgreSQL
   Host: dev-db.company.com
   Database: test_db
   User: dev_user
   Password: ********
```

## STEP 3: Staging 환경 설정

### n8n Cloud 워크스페이스 생성
```
1. 워크스페이스 스위처 클릭
2. "Create Workspace" 클릭
3. 이름: "Company Staging"
4. 플랜 선택: Pro
5. Create
```

### Source Control 연결
```
1. Settings > Source Control
2. "Connect to Git" 클릭
3. 설정 입력:
   Provider: GitHub
   Repository: yourcompany/company-workflows (동일)
   Branch: staging (다름!)
   Authentication: SSH Key

4. SSH Key 등록:
   - GitHub > Settings > SSH Keys
   - "New SSH key"
   - Title: "n8n Staging"
   - Key 붙여넣기 (Staging 워크스페이스의 키)

5. Test & Save
```

### 초기 동기화
```
1. Source Control 패널
2. "Pull from Git" 탭
3. "Pull" 클릭
   (develop에서 Push한 워크플로우들이 보임)
4. "Apply" 클릭
```

### 환경 변수 설정
```
Settings > Variables

ENVIRONMENT: staging
API_BASE_URL: https://api-staging.company.com
SLACK_CHANNEL: #staging-alerts
LOG_LEVEL: info
```

### 자격 증명 생성
```
Credentials > New Credential

1. Slack_Staging
   Webhook URL: https://hooks.slack.com/staging-webhook

2. Database_Staging
   Host: staging-db.company.com
   Database: staging_db
   User: staging_user
   Password: ********
```

## STEP 4: Production 환경 설정

### n8n Cloud 워크스페이스 생성
```
1. "Create Workspace"
2. 이름: "Company Production"
3. 플랜: Pro 또는 Enterprise
4. Create
```

### Source Control 연결
```
Settings > Source Control

Repository: yourcompany/company-workflows
Branch: main (중요!)
Authentication: SSH Key
```

### 초기 동기화
```
중요: Production은 승인된 워크플로우만

1. Pull from Git 실행
2. 워크플로우 검토
3. 하나씩 테스트
4. 승인 후 활성화
```

### 환경 변수 설정
```
Settings > Variables

ENVIRONMENT: production
API_BASE_URL: https://api.company.com
SLACK_CHANNEL: #production-alerts
LOG_LEVEL: warn
```

### 자격 증명 생성
```
Credentials > New Credential

1. Slack_Production
   Webhook URL: https://hooks.slack.com/production-webhook

2. Database_Production
   Host: prod-db.company.com
   Database: production_db
   User: prod_user
   Password: ******** (안전한 비밀번호)
```

## STEP 5: 워크플로우 생성 및 테스트

### Development에서 워크플로우 생성
```
1. Development 워크스페이스로 전환
2. 새 워크플로우 생성: "Test Environment Setup"
3. 노드 추가:
   - Manual Trigger
   - Code Node (환경 정보 출력)
   - Slack (알림)

Code Node:
```javascript
return [{
  json: {
    environment: $env.ENVIRONMENT,
    apiUrl: $env.API_BASE_URL,
    timestamp: new Date().toISOString(),
    message: 'Environment test successful'
  }
}];
```
```
4. Save
5. Source Control > Push to Git
   Message: "feat: Add environment test workflow"
6. Push
```

### Staging으로 승격
```
1. Git에서 PR 생성:
git checkout staging
git merge develop
git push origin staging

또는 GitHub에서:
- Pull Request 생성
- Base: staging
- Compare: develop
- Merge

2. Staging 워크스페이스로 전환
3. Source Control > Pull from Git
4. 새 워크플로우 확인
5. 자격 증명 매핑 확인
6. 테스트 실행
7. 결과 검증
```

### Production으로 배포
```
1. Staging 테스트 완료 확인
2. Git에서 PR 생성:
   Base: main
   Compare: staging
   Reviewers 지정
3. 리뷰 및 승인
4. Merge
5. Production 워크스페이스로 전환
6. Source Control > Pull from Git
7. 워크플로우 검토
8. 프로덕션 자격 증명 매핑 확인
9. 조심스럽게 활성화
10. 모니터링
```

## STEP 6: 환경 검증

### 체크리스트

**Development 환경:**
```
□ Git 연결: develop 브랜치
□ 워크플로우 생성 가능
□ Push to Git 작동
□ 환경 변수 설정됨
□ 개발용 자격 증명 설정됨
□ Slack 알림 테스트 (#dev-alerts)
```

**Staging 환경:**
```
□ Git 연결: staging 브랜치
□ Pull from Git 작동
□ 워크플로우 동기화됨
□ 환경 변수 설정됨
□ 스테이징 자격 증명 설정됨
□ Slack 알림 테스트 (#staging-alerts)
□ 통합 테스트 수행
```

**Production 환경:**
```
□ Git 연결: main 브랜치
□ Pull from Git 작동
□ 승인된 워크플로우만 존재
□ 환경 변수 설정됨 (프로덕션 값)
□ 프로덕션 자격 증명 설정됨
□ Slack 알림 테스트 (#production-alerts)
□ 모니터링 설정됨
□ 백업 확인됨
```

## STEP 7: 일상 워크플로우 테스트

### 시나리오: 새 기능 개발 및 배포
```
1. Development (Day 1):
   - feature/slack-integration 브랜치 생성
   - 워크플로우 개발
   - Push to Git
   - PR to develop

2. Staging (Day 2):
   - develop → staging PR
   - Pull in Staging
   - 통합 테스트
   - 버그 수정 (있다면)

3. Production (Day 3):
   - staging → main PR
   - 리뷰 및 승인
   - Pull in Production
   - 활성화
   - 모니터링
```

## 문제 해결

### Development에서 Push 실패
```
증상: "Authentication failed"

해결:
1. SSH Key 확인
2. GitHub에 Key 등록 확인
3. "Test Connection" 재시도
4. 필요시 Key 재생성
```

### Staging에서 자격 증명 누락
```
증상: "Credential not found"

해결:
1. Credentials 메뉴에서 누락된 자격 증명 확인
2. Development와 동일한 이름으로 생성
3. Staging 환경에 맞는 값 입력
4. 워크플로우 재테스트
```

### Production Pull 충돌
```
증상: "Merge conflict detected"

해결:
1. Conflict 확인
2. 로컬 또는 원격 선택
3. 또는 Git에서 수동 해결
4. 재시도
```

## 다음 단계

### 개선 사항
```
1. CI/CD 파이프라인 추가
2. 자동 테스트 설정
3. 모니터링 및 알림 강화
4. 문서 자동화
5. 정기적인 동기화 스케줄링
```

### 학습 자료
```
- [브랜치 패턴](./05-branch-patterns.md)
- [변수 관리](./07-variables.md)
- [팀 협업](../manage-cloud/05-collaboration.md)
```

## 관련 문서

- [Source Control 이해](./01-understand.md)
- [환경 관리](./02-environments.md)
- [Source Control 설정](./03-setup.md)
