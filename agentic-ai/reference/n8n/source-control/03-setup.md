# Source Control 설정

n8n에서 Git 기반 Source Control을 설정하고 구성하는 단계별 가이드

## 사전 요구사항

### 필요 항목
```
✓ Git 리포지토리 (GitHub, GitLab, Bitbucket 등)
✓ Git 계정 및 접근 권한
✓ n8n Cloud Pro 플랜 이상 또는 Self-hosted
✓ SSH 키 또는 Personal Access Token
```

### Git 리포지토리 준비
```bash
# 새 리포지토리 생성
git init n8n-workflows
cd n8n-workflows

# README 생성
echo "# n8n Workflows" > README.md

# .gitignore 생성
cat > .gitignore << EOF
.env
*.log
credentials/
node_modules/
EOF

# 초기 커밋
git add .
git commit -m "Initial commit"

# 원격 리포지토리에 푸시
git remote add origin git@github.com:company/n8n-workflows.git
git push -u origin main
```

## n8n Cloud 설정

### 1단계: Source Control 활성화

**접근 방법:**
```
1. n8n Cloud 로그인
2. Settings 클릭 (우측 상단)
3. Source Control 메뉴 선택
4. "Connect to Git" 버튼 클릭
```

### 2단계: Git 제공자 선택

**지원되는 제공자:**
```
- GitHub
- GitLab
- Bitbucket
- Azure DevOps
- Generic Git (자체 호스팅)
```

**GitHub 연결 예시:**
```
1. "GitHub" 선택
2. "Authorize n8n" 클릭
3. GitHub 로그인
4. n8n 권한 승인
5. 리포지토리 선택
```

### 3단계: 리포지토리 설정

**리포지토리 정보 입력:**
```
Repository URL: https://github.com/company/n8n-workflows.git
Branch: main (또는 develop)
Directory: / (선택사항, 리포지토리 내 하위 폴더)
```

**SSH 키 방식 (권장):**
```
1. n8n에서 제공하는 Public SSH 키 복사
2. Git 제공자에 SSH 키 등록:

GitHub:
- Settings > SSH and GPG keys
- New SSH key
- 키 붙여넣기 및 저장

3. n8n에서 "Test Connection" 클릭
4. 성공 확인
```

**Personal Access Token 방식:**
```
1. Git 제공자에서 Token 생성:

GitHub:
- Settings > Developer settings > Personal access tokens
- Generate new token
- 권한 선택: repo (전체)
- Token 복사

2. n8n에 Token 입력:
- Authentication: Personal Access Token
- Token: [복사한 토큰]

3. Test Connection
```

### 4단계: 동기화 설정

**초기 동기화 방향 선택:**
```
옵션 1: Push to Git (n8n → Git)
- 현재 n8n 워크플로우를 Git에 푸시
- 기존 워크플로우가 있을 때

옵션 2: Pull from Git (Git → n8n)
- Git의 워크플로우를 n8n으로 가져오기
- 새 인스턴스 설정 시

옵션 3: Skip initial sync
- 수동으로 나중에 동기화
```

**동기화 옵션:**
```
□ Auto-push on save: 저장 시 자동 푸시
□ Auto-pull on start: 시작 시 자동 풀
□ Require commit message: 커밋 메시지 필수
```

### 5단계: 워크플로우 매핑

**파일 구조 설정:**
```
Workflow storage:
  Format: JSON
  Naming: [workflow-name].json
  Location: /workflows/

Variables storage:
  Location: /variables/

Tags:
  Include tags: Yes/No
```

## Self-hosted 설정

### Docker Compose 설정

**docker-compose.yml 예시:**
```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    environment:
      # Source Control 설정
      - N8N_VERSION_CONTROL_ENABLED=true
      - N8N_VERSION_CONTROL_GIT_REPOSITORY_URL=git@github.com:company/n8n-workflows.git
      - N8N_VERSION_CONTROL_GIT_BRANCH=main
      - N8N_VERSION_CONTROL_GIT_SSH_KEY_PATH=/data/.ssh/id_rsa

      # 기타 설정
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=secure_password

    volumes:
      - n8n_data:/home/node/.n8n
      - ./ssh:/data/.ssh:ro

volumes:
  n8n_data:
```

### SSH 키 생성 및 설정

**키 생성:**
```bash
# SSH 키 생성
ssh-keygen -t ed25519 -C "n8n@company.com" -f ./ssh/id_rsa

# Public 키 확인
cat ./ssh/id_rsa.pub
```

**Git 제공자에 키 등록:**
```bash
# GitHub
gh ssh-key add ./ssh/id_rsa.pub --title "n8n Production"

# 또는 웹 인터페이스에서 수동 등록
```

### 환경 변수 설정

**필수 환경 변수:**
```bash
# .env 파일
N8N_VERSION_CONTROL_ENABLED=true
N8N_VERSION_CONTROL_GIT_REPOSITORY_URL=git@github.com:company/n8n-workflows.git
N8N_VERSION_CONTROL_GIT_BRANCH=main
N8N_VERSION_CONTROL_GIT_SSH_KEY_PATH=/home/node/.ssh/id_rsa

# 선택적 환경 변수
N8N_VERSION_CONTROL_AUTO_PUSH=true
N8N_VERSION_CONTROL_AUTO_PULL=false
N8N_VERSION_CONTROL_REQUIRE_COMMIT_MESSAGE=true
```

## Git 리포지토리 구조

### 권장 구조
```
n8n-workflows/
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD
├── workflows/
│   ├── production/
│   │   ├── customer-onboarding.json
│   │   └── daily-report.json
│   └── development/
│       └── test-workflow.json
├── credentials/
│   └── credential-mapping.json # ID만 저장
├── variables/
│   ├── production.json
│   └── development.json
├── docs/
│   ├── README.md
│   └── DEPLOYMENT.md
├── .gitignore
└── .n8nignore
```

### .gitignore 설정
```gitignore
# 민감한 정보
.env
*.pem
*.key
credentials/*.json
!credentials/credential-mapping.json

# 로그
*.log
logs/

# 임시 파일
*.tmp
.DS_Store
node_modules/

# IDE
.vscode/
.idea/
```

### .n8nignore 설정
```
# Source Control에서 제외할 워크플로우
**/test-*.json
**/draft-*.json
**/temp-*.json
```

## 브랜치 설정

### 기본 브랜치 구조
```bash
# Main 브랜치 (프로덕션)
git checkout -b main
git push -u origin main

# Develop 브랜치 (개발)
git checkout -b develop
git push -u origin develop

# 브랜치 보호 규칙 설정 (GitHub)
gh api repos/company/n8n-workflows/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":[]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1}'
```

### 환경별 브랜치 연결

**Development 인스턴스:**
```
Settings > Source Control
Branch: develop
Auto-push: true
Auto-pull: false
```

**Production 인스턴스:**
```
Settings > Source Control
Branch: main
Auto-push: false (수동 푸시 권장)
Auto-pull: true (배포 시)
```

## 자격 증명 매핑

### 자격 증명 처리
```
n8n은 보안을 위해 실제 자격 증명을 Git에 저장하지 않음

저장되는 정보:
{
  "id": "abc123",
  "name": "Slack Webhook",
  "type": "slackApi",
  "data": {} // 비어있음
}

각 환경에서 수동으로 자격 증명 생성 필요
```

### 자격 증명 동기화 체크리스트
```
워크플로우를 새 환경으로 이동 시:

□ Git에서 워크플로우 Pull
□ 필요한 자격 증명 목록 확인
□ 각 자격 증명을 환경에 맞게 생성
□ 자격 증명 ID 매핑 확인
□ 워크플로우 테스트
□ 활성화
```

## 초기 동기화

### 기존 워크플로우 Push
```
1. Source Control 패널 열기
2. "Push to Git" 탭 선택
3. 동기화할 워크플로우 선택
4. 커밋 메시지 입력:
   "Initial commit: Add existing workflows"
5. "Push" 버튼 클릭
6. Git 리포지토리에서 확인
```

### Git에서 워크플로우 Pull
```
1. Source Control 패널 열기
2. "Pull from Git" 탭 선택
3. 변경 사항 미리보기
4. 충돌 확인 (있는 경우)
5. "Pull" 버튼 클릭
6. 워크플로우 목록에서 확인
```

## 테스트 및 검증

### 연결 테스트
```
1. Settings > Source Control
2. "Test Connection" 버튼 클릭
3. 성공 메시지 확인

실패 시 확인 사항:
✗ SSH 키 또는 Token 유효성
✗ 리포지토리 접근 권한
✗ 브랜치 존재 여부
✗ 네트워크 연결
```

### Push/Pull 테스트
```
테스트 시나리오:
1. 새 워크플로우 생성
2. Git에 Push
3. Git 리포지토리에서 파일 확인
4. 워크플로우 수정
5. 다시 Push
6. 변경 사항 확인
```

## 문제 해결

### 일반적인 오류

**Authentication failed:**
```
원인: SSH 키 또는 Token 문제
해결:
1. SSH 키 재생성 및 등록
2. Token 권한 확인
3. 연결 테스트
```

**Branch not found:**
```
원인: 지정한 브랜치가 존재하지 않음
해결:
1. Git 리포지토리에서 브랜치 생성
2. n8n 설정에서 브랜치 이름 확인
```

**Merge conflicts:**
```
원인: 동일 워크플로우를 여러 곳에서 수정
해결:
1. Source Control 패널에서 충돌 확인
2. 수동으로 해결
3. 다시 커밋
```

### 로그 확인

**Self-hosted:**
```bash
# Docker 로그
docker logs n8n

# Source Control 관련 로그 필터링
docker logs n8n 2>&1 | grep -i "version-control"
```

**Cloud:**
```
Settings > System > Logs
Filter: Source Control
```

## 다음 단계

- [Source Control 사용법](./04-using.md)
- [브랜치 패턴](./05-branch-patterns.md)
- [환경 생성 튜토리얼](./06-create-environments.md)

## 관련 문서

- [Source Control 이해](./01-understand.md)
- [환경 관리](./02-environments.md)
- [Git 기초 학습](https://git-scm.com/book)
