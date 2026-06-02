# 브랜치 패턴

n8n Source Control에서 효과적인 Git 브랜치 전략 및 워크플로우 패턴

## 브랜치 전략 개요

### 브랜치 전략의 필요성
```
목적:
✓ 안정적인 프로덕션 유지
✓ 병렬 개발 지원
✓ 체계적인 릴리스 관리
✓ 빠른 Hotfix 배포
✓ 팀 협업 효율화
```

## Git Flow

### 구조
```
master/main (프로덕션)
  ↑
  └─ release/v1.2.0 (릴리스)
      ↑
      └─ develop (개발)
          ↑
          ├─ feature/customer-sync
          ├─ feature/slack-integration
          └─ feature/api-update

hotfix/critical-bug → master/main
                    → develop
```

### 브랜치 유형

**master/main (프로덕션):**
```
목적: 프로덕션 배포
수명: 영구
보호: 높음 (직접 Push 금지)
머지: release, hotfix만 허용

n8n 연결:
Instance: Production
Auto-pull: true
Auto-push: false
```

**develop (개발):**
```
목적: 개발 통합
수명: 영구
보호: 중간 (PR 필요)
머지: feature 브랜치들

n8n 연결:
Instance: Development
Auto-pull: false
Auto-push: true
```

**feature/* (기능):**
```
목적: 새 기능 개발
수명: 단기 (완료 후 삭제)
보호: 낮음
머지: develop으로

명명 규칙:
- feature/customer-onboarding
- feature/slack-notifications
- feature/api-integration
```

**release/* (릴리스):**
```
목적: 릴리스 준비
수명: 단기 (배포 후 삭제)
보호: 중간
머지: main과 develop으로

명명 규칙:
- release/v1.2.0
- release/2024-02-sprint
```

**hotfix/* (긴급 수정):**
```
목적: 프로덕션 긴급 수정
수명: 단기 (수정 후 삭제)
보호: 낮음
머지: main과 develop으로

명명 규칙:
- hotfix/api-timeout
- hotfix/data-corruption
```

### 워크플로우 예시

**Feature 개발:**
```bash
# 1. develop에서 feature 브랜치 생성
git checkout develop
git pull origin develop
git checkout -b feature/salesforce-integration

# 2. n8n에서 워크플로우 개발
# - Source Control > Connect to branch: feature/salesforce-integration
# - 워크플로우 생성 및 테스트
# - Push to Git

# 3. Feature 완료 후 PR 생성
git push origin feature/salesforce-integration
gh pr create --base develop --head feature/salesforce-integration \
  --title "Add Salesforce lead sync integration" \
  --body "Implements automatic lead synchronization..."

# 4. 리뷰 및 승인 후 머지
gh pr merge --squash

# 5. 브랜치 삭제
git branch -d feature/salesforce-integration
git push origin --delete feature/salesforce-integration
```

**Release 프로세스:**
```bash
# 1. develop에서 release 브랜치 생성
git checkout develop
git checkout -b release/v1.2.0

# 2. Staging 환경에서 테스트
# n8n Staging > Source Control > Branch: release/v1.2.0
# Pull from Git > Test workflows

# 3. 버그 수정 (있는 경우)
# - 수정사항을 release 브랜치에 커밋

# 4. main과 develop에 머지
git checkout main
git merge --no-ff release/v1.2.0
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin main --tags

git checkout develop
git merge --no-ff release/v1.2.0
git push origin develop

# 5. 브랜치 삭제
git branch -d release/v1.2.0
```

**Hotfix 프로세스:**
```bash
# 1. main에서 hotfix 브랜치 생성
git checkout main
git checkout -b hotfix/webhook-timeout

# 2. 수정 및 테스트
# n8n > 워크플로우 수정 > Push

# 3. main과 develop에 머지
git checkout main
git merge --no-ff hotfix/webhook-timeout
git tag -a v1.2.1 -m "Hotfix: Webhook timeout"
git push origin main --tags

git checkout develop
git merge --no-ff hotfix/webhook-timeout
git push origin develop

# 4. 즉시 프로덕션 배포
# n8n Production > Pull from Git

# 5. 브랜치 삭제
git branch -d hotfix/webhook-timeout
```

## GitHub Flow

### 구조 (간소화된 모델)
```
main (프로덕션/개발)
  ↑
  ├─ feature/new-workflow
  ├─ bugfix/api-error
  └─ enhancement/performance
```

### 특징
```
장점:
✓ 단순함
✓ 지속적 배포 용이
✓ 작은 팀에 적합

단점:
✗ 릴리스 관리 어려움
✗ Staging 환경 지원 약함
```

### 워크플로우
```bash
# 1. main에서 브랜치 생성
git checkout main
git pull origin main
git checkout -b feature/customer-notification

# 2. 개발 및 푸시
# n8n > 워크플로우 작성 > Push to Git

# 3. PR 생성 및 리뷰
gh pr create --base main --head feature/customer-notification

# 4. 승인 후 머지 및 배포
gh pr merge --squash
# 자동 배포 (CI/CD)

# 5. 브랜치 삭제
git branch -d feature/customer-notification
```

## Trunk-Based Development

### 구조
```
main/trunk (단일 브랜치)
  ↑
  ├─ 짧은 수명 feature 브랜치들
  └─ 직접 커밋 (작은 변경)
```

### 특징
```
원칙:
✓ 작은 단위 커밋
✓ 빈번한 통합
✓ Feature Flag 사용
✓ 지속적 배포

n8n 적용:
- main 브랜치만 사용
- 짧은 feature 브랜치 (1-2일)
- 워크플로우 비활성화로 Feature Flag 대체
```

### 워크플로우
```bash
# 1. 짧은 feature 브랜치
git checkout -b feature/quick-fix
# 개발 (몇 시간 내)
git commit -m "feat: Add quick notification"
git push origin feature/quick-fix

# 2. 즉시 PR 및 머지
gh pr create --base main
gh pr merge --squash

# 3. main에서 지속적 배포
# n8n > Pull from Git > Deploy
```

## 환경별 브랜치 매핑

### 3-환경 매핑 (Git Flow)
```
┌─────────────┬──────────────┬─────────────┐
│ Environment │ Branch       │ n8n Setup   │
├─────────────┼──────────────┼─────────────┤
│ Development │ develop      │ Auto-push   │
│ Staging     │ release/*    │ Manual      │
│ Production  │ main         │ Auto-pull   │
└─────────────┴──────────────┴─────────────┘
```

### 2-환경 매핑 (GitHub Flow)
```
┌─────────────┬──────────────┬─────────────┐
│ Environment │ Branch       │ n8n Setup   │
├─────────────┼──────────────┼─────────────┤
│ Development │ feature/*    │ Auto-push   │
│ Production  │ main         │ Pull on tag │
└─────────────┴──────────────┴─────────────┘
```

## 브랜치 보호 규칙

### GitHub 브랜치 보호
```yaml
# .github/branch-protection.yml
main:
  required_reviews: 2
  required_checks:
    - workflow-validation
    - credential-check
  block_force_push: true
  block_deletions: true
  required_signatures: false

develop:
  required_reviews: 1
  required_checks:
    - workflow-validation
  block_force_push: true
  block_deletions: false
```

### 설정 방법
```bash
# GitHub CLI로 설정
gh api repos/company/n8n-workflows/branches/main/protection \
  --method PUT \
  --field required_pull_request_reviews='{"required_approving_review_count":2}' \
  --field required_status_checks='{"strict":true,"contexts":["workflow-validation"]}' \
  --field enforce_admins=true \
  --field restrictions=null
```

## 명명 규칙

### 브랜치 이름
```
형식:
<type>/<description>

Types:
- feature/    새 기능
- bugfix/     버그 수정
- hotfix/     긴급 수정
- release/    릴리스
- refactor/   리팩토링
- docs/       문서
- test/       테스트

예시:
✓ feature/slack-notifications
✓ bugfix/api-timeout-error
✓ hotfix/critical-security-fix
✓ release/v1.2.0

✗ john-work (불명확)
✗ fix (너무 짧음)
✗ feature-new-stuff (일관성 없음)
```

### 태그 명명
```
Semantic Versioning:
v<major>.<minor>.<patch>

예시:
v1.0.0    초기 릴리스
v1.1.0    새 기능 추가
v1.1.1    버그 수정
v2.0.0    주요 변경 (Breaking)
```

## PR 템플릿

### Pull Request 템플릿
```markdown
## 변경 사항
<!-- 이 PR의 주요 변경사항을 설명하세요 -->

### 추가된 워크플로우
- [ ] workflow-name-1.json
- [ ] workflow-name-2.json

### 수정된 워크플로우
- [ ] existing-workflow.json

## 테스트
<!-- 테스트 방법을 설명하세요 -->

- [ ] Development 환경에서 테스트 완료
- [ ] Staging 환경에서 통합 테스트 완료
- [ ] 모든 자격 증명 확인

## 체크리스트
- [ ] 커밋 메시지가 명확함
- [ ] 워크플로우가 테스트됨
- [ ] 자격 증명이 환경별로 분리됨
- [ ] 문서 업데이트 (필요시)
- [ ] 태그 및 주석 추가

## 스크린샷
<!-- 필요시 워크플로우 스크린샷 추가 -->

## 관련 이슈
Closes #123
```

## 머지 전략

### Merge Commit
```bash
git merge --no-ff feature/new-workflow

장점:
✓ 전체 히스토리 보존
✓ 브랜치 구조 명확

단점:
✗ 히스토리 복잡
✗ 많은 머지 커밋
```

### Squash and Merge
```bash
git merge --squash feature/new-workflow

장점:
✓ 깔끔한 히스토리
✓ 한 커밋으로 요약

단점:
✗ 세부 커밋 손실
✗ 협업 히스토리 불명확
```

### Rebase and Merge
```bash
git rebase main
git checkout main
git merge feature/new-workflow

장점:
✓ 선형 히스토리
✓ 깔끔한 로그

단점:
✗ 커밋 해시 변경
✗ 협업 시 복잡
```

### n8n 권장
```
권장: Squash and Merge

이유:
- 워크플로우는 기능 단위로 관리
- 세부 개발 과정보다 최종 결과 중요
- 히스토리 단순화
```

## 모범 사례

### Do's (권장)
```
✓ 의미있는 브랜치 이름 사용
✓ 작은 단위로 자주 커밋
✓ PR에 명확한 설명 작성
✓ 코드 리뷰 요청
✓ 머지 전 테스트
✓ 사용하지 않는 브랜치 정리
✓ 브랜치 보호 규칙 설정
```

### Don'ts (비권장)
```
✗ main에 직접 Push
✗ 장기간 브랜치 유지
✗ 의미없는 커밋 메시지
✗ 테스트 없이 머지
✗ 충돌 무시
✗ 브랜치 네이밍 규칙 무시
```

## 팀 규모별 전략

### 소규모 팀 (1-3명)
```
전략: GitHub Flow

브랜치:
- main (프로덕션)
- feature/* (기능)

장점:
- 단순함
- 빠른 배포
```

### 중규모 팀 (4-10명)
```
전략: Simplified Git Flow

브랜치:
- main (프로덕션)
- develop (개발)
- feature/* (기능)

장점:
- 개발/프로덕션 분리
- 통합 관리 용이
```

### 대규모 팀 (10명 이상)
```
전략: Full Git Flow

브랜치:
- main (프로덕션)
- develop (개발)
- feature/* (기능)
- release/* (릴리스)
- hotfix/* (긴급수정)

장점:
- 체계적 관리
- 명확한 릴리스 프로세스
- 병렬 개발 지원
```

## 관련 문서

- [Source Control 설정](./03-setup.md)
- [Source Control 사용](./04-using.md)
- [환경 생성 튜토리얼](./06-create-environments.md)
- [팀 협업](../manage-cloud/05-collaboration.md)
