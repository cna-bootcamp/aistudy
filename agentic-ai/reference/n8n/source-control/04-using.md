# Source Control 사용하기

n8n에서 Source Control 기능을 실제로 사용하여 워크플로우를 관리하는 방법

## Source Control 패널

### 패널 열기
```
방법 1: 메뉴에서
- 좌측 사이드바 하단
- "Source Control" 아이콘 클릭

방법 2: 단축키
- Ctrl/Cmd + Shift + G
```

### 패널 구조
```
┌─ Source Control ─────────────┐
│ ├── Status                   │
│ │   └── Current Branch       │
│ │   └── Uncommitted Changes │
│ │                            │
│ ├── Push to Git              │
│ │   └── Changed Files        │
│ │   └── Commit Message       │
│ │                            │
│ ├── Pull from Git            │
│ │   └── Remote Changes       │
│ │   └── Conflicts            │
│ │                            │
│ └── History                  │
│     └── Recent Commits       │
└──────────────────────────────┘
```

## 변경 사항 Push

### 기본 Push 워크플로우

**1단계: 변경 사항 확인**
```
Source Control 패널에서 "Push to Git" 탭

변경된 파일 목록:
✓ workflows/customer-onboarding.json (Modified)
✓ workflows/email-notification.json (New)
✗ workflows/test-workflow.json (Deleted)
```

**2단계: 파일 선택**
```
옵션:
□ Select All (모두 선택)
□ Select by Status
  ☑ New files
  ☑ Modified files
  ☑ Deleted files

개별 선택:
☑ customer-onboarding.json
☑ email-notification.json
☐ test-workflow.json (제외)
```

**3단계: 커밋 메시지 작성**
```
좋은 커밋 메시지 예시:

feat: Add email notification workflow
- Implemented customer welcome email
- Added retry logic for failed sends
- Connected to SendGrid API

fix: Correct customer onboarding flow
- Fixed condition logic in decision node
- Updated Slack channel reference
- Resolved timeout issue

refactor: Optimize database queries
- Reduced API calls by batching
- Added caching layer
- Improved error handling
```

**4단계: Push 실행**
```
1. "Push to Git" 버튼 클릭
2. Push 진행 상태 확인
3. 완료 메시지 확인
4. Git 리포지토리에서 검증
```

### 자동 Push

**설정:**
```
Settings > Source Control
☑ Auto-push on save

효과:
- 워크플로우 저장 시 자동으로 Git에 Push
- 커밋 메시지 자동 생성
- 빠른 변경 추적
```

**자동 커밋 메시지 형식:**
```
Auto-commit: Update [workflow-name]
- Changed by: [username]
- Timestamp: [datetime]
```

## 변경 사항 Pull

### 기본 Pull 워크플로우

**1단계: 원격 변경 확인**
```
Source Control 패널에서 "Pull from Git" 탭

Remote changes:
+ workflows/new-integration.json (New)
~ workflows/existing-workflow.json (Modified)
- workflows/old-workflow.json (Deleted)

Commits:
- feat: Add Salesforce integration (John, 2 hours ago)
- fix: Update API endpoint (Jane, 1 day ago)
```

**2단계: 변경 사항 미리보기**
```
파일 클릭하여 Diff 보기:

workflows/existing-workflow.json:
- Old: "trigger": "webhook"
+ New: "trigger": "schedule"

- Old: "interval": "1h"
+ New: "interval": "30m"
```

**3단계: 충돌 확인**
```
충돌 없음:
✓ Safe to pull

충돌 있음:
⚠ Conflicts detected
  - workflows/shared-workflow.json
  - 수동 해결 필요
```

**4단계: Pull 실행**
```
1. "Pull from Git" 버튼 클릭
2. Pull 진행 상태 확인
3. 워크플로우 목록 새로고침
4. 변경된 워크플로우 검토
```

### 자동 Pull

**설정:**
```
Settings > Source Control
☑ Auto-pull on start

효과:
- n8n 시작 시 자동 Pull
- 최신 워크플로우 유지
- 팀 변경사항 자동 동기화
```

## 충돌 해결

### 충돌 감지
```
Pull 시 충돌 발생:

⚠ Merge Conflict
File: workflows/customer-sync.json

Local changes:
- Modified 1 hour ago
- Changed by: You

Remote changes:
- Modified 2 hours ago
- Changed by: Team member
```

### 충돌 해결 옵션

**옵션 1: Keep Local (로컬 유지)**
```
선택 시:
- 로컬 변경 사항 유지
- 원격 변경 사항 무시
- 수동으로 원격에 Push 필요
```

**옵션 2: Use Remote (원격 사용)**
```
선택 시:
- 원격 변경 사항 적용
- 로컬 변경 사항 덮어쓰기
- 로컬 변경 사항 백업 권장
```

**옵션 3: Manual Merge (수동 병합)**
```
1. 워크플로우 Export (백업)
2. 원격 버전 Pull
3. 필요한 로컬 변경사항 수동 적용
4. 테스트
5. Push
```

### 충돌 방지 전략

**방법 1: 잦은 동기화**
```
- 작업 시작 전 Pull
- 작업 완료 후 즉시 Push
- 팀과 변경 사항 공유
```

**방법 2: 워크플로우 분리**
```
- 각자 다른 워크플로우 작업
- 공유 워크플로우는 사전 조율
- Feature 브랜치 사용
```

**방법 3: 커뮤니케이션**
```
- Slack/Teams에서 변경 사항 알림
- 중요 워크플로우 수정 전 공지
- 코드 리뷰 프로세스
```

## 브랜치 작업

### 현재 브랜치 확인
```
Source Control 패널 상단:
Current Branch: develop

또는
Settings > Source Control
Connected Branch: develop
```

### 브랜치 전환

**n8n Cloud:**
```
주의: n8n 인스턴스는 하나의 브랜치만 추적

브랜치 전환:
1. Settings > Source Control
2. Branch 필드 변경
3. Save
4. Pull from Git 실행
```

**Self-hosted (Git 직접 사용):**
```bash
# n8n 데이터 디렉토리로 이동
cd ~/.n8n/workflows

# 브랜치 전환
git checkout feature/new-integration

# n8n 재시작
docker restart n8n
```

## 워크플로우 히스토리

### 히스토리 조회
```
Source Control > History 탭

Recent Commits:
┌─────────────────────────────────────┐
│ feat: Add customer notification     │
│ By: John Doe, 2 hours ago           │
│ Branch: develop                     │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ fix: Correct API endpoint           │
│ By: Jane Smith, 1 day ago           │
│ Branch: develop                     │
└─────────────────────────────────────┘
```

### 특정 커밋으로 롤백

**방법 1: Git에서 롤백 후 Pull**
```bash
# Git에서 롤백
git revert <commit-hash>
git push

# n8n에서 Pull
# Source Control > Pull from Git
```

**방법 2: 특정 버전 Checkout**
```bash
# Git에서
git checkout <commit-hash> workflows/specific-workflow.json
git commit -m "Revert workflow to previous version"
git push

# n8n에서 Pull
```

## 변경 사항 비교

### Diff 보기

**n8n UI에서:**
```
Source Control > Pull from Git
파일 클릭하여 변경 사항 확인

표시 형식:
- 빨간색: 삭제된 줄
+ 초록색: 추가된 줄
~ 노란색: 수정된 줄
```

**Git에서:**
```bash
# 최근 변경 사항
git diff HEAD~1

# 특정 파일
git diff workflows/customer-onboarding.json

# 두 브랜치 비교
git diff develop..main workflows/
```

## 워크플로우 태그 동기화

### 태그 Push
```
Source Control 설정에서:
☑ Include tags in sync

효과:
- 워크플로우 태그도 Git에 저장
- 환경 간 태그 일관성 유지
- 워크플로우 분류 정보 공유
```

### 태그 파일 형식
```json
{
  "workflows": {
    "customer-onboarding.json": ["production", "critical"],
    "test-workflow.json": ["development", "experimental"]
  }
}
```

## 일괄 작업

### 여러 워크플로우 동시 Push
```
1. Source Control > Push to Git
2. "Select All" 체크
3. 커밋 메시지 작성
4. Push

커밋 메시지 예시:
chore: Sync all workflows
- Updated 15 workflows
- Fixed credential references
- Standardized naming
```

### 선택적 Pull
```
현재는 전체 Pull만 지원

선택적 Pull이 필요한 경우:
1. Git에서 특정 파일만 Checkout
2. n8n에서 Import
```

## 모범 사례

### 커밋 빈도
```
권장:
✓ 기능 완성 시마다 커밋
✓ 의미있는 변경 단위로 커밋
✓ 하루 작업 종료 시 커밋

비권장:
✗ 모든 저장마다 자동 커밋 (Auto-push)
✗ 너무 큰 변경사항을 한 번에 커밋
✗ 며칠 작업을 한 번에 커밋
```

### 커밋 메시지 규칙
```
형식:
<type>: <subject>

<body>

Types:
- feat: 새 기능
- fix: 버그 수정
- refactor: 리팩토링
- docs: 문서 변경
- test: 테스트
- chore: 기타

예시:
feat: Add Salesforce lead sync workflow

- Syncs leads every 15 minutes
- Includes duplicate detection
- Sends Slack notification on errors
```

### Pull 전략
```
작업 시작 전:
1. Pull from Git
2. 충돌 확인 및 해결
3. 테스트 실행
4. 작업 시작

작업 완료 후:
1. 로컬 테스트
2. Pull (최신 변경 확인)
3. Push
4. 원격에서 검증
```

## 관련 문서

- [브랜치 패턴](./05-branch-patterns.md)
- [충돌 해결 가이드](./conflict-resolution.md)
- [팀 협업](../manage-cloud/05-collaboration.md)
- [워크플로우 비교](./compare-changes.md)
