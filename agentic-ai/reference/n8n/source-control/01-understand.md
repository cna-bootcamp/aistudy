# Source Control 이해하기

n8n의 Source Control 기능은 Git을 사용하여 워크플로우를 버전 관리하고 팀과 협업할 수 있게 해주는 기능

## 개요

### Source Control이란?
Git 리포지토리와 n8n을 통합하여 워크플로우를 코드처럼 관리하는 기능

**주요 이점:**
- 버전 히스토리 추적
- 변경 사항 비교 및 롤백
- 팀 협업 및 코드 리뷰
- 환경별 워크플로우 관리 (dev, staging, prod)
- 재해 복구 및 백업
- CI/CD 파이프라인 통합

### 지원 플랫폼
```
- GitHub
- GitLab
- Bitbucket
- Azure DevOps
- 자체 호스팅 Git 서버
- 모든 Git 호환 플랫폼
```

## 핵심 개념

### 리포지토리 구조
```
my-n8n-workflows/
├── .git/
├── workflows/
│   ├── workflow-1.json
│   ├── workflow-2.json
│   └── workflow-3.json
├── credentials/
│   └── credential-mapping.json (ID만 저장)
├── variables/
│   └── environment-variables.json
└── .n8nignore
```

### 워크플로우 파일
```json
{
  "name": "Customer Onboarding",
  "nodes": [...],
  "connections": {...},
  "settings": {...},
  "staticData": null,
  "tags": ["onboarding", "customers"],
  "triggerCount": 0,
  "versionId": "1"
}
```

### 자격 증명 처리
```
보안상 이유로 자격 증명은 Git에 저장되지 않음

저장되는 것:
- 자격 증명 ID (UUID)
- 자격 증명 타입
- 자격 증명 이름

저장되지 않는 것:
- 실제 비밀번호
- API 키
- 토큰
- 민감한 데이터
```

## 워크플로우

### 기본 워크플로우
```
1. 개발자가 n8n에서 워크플로우 생성/수정
2. "Push to Git" 버튼 클릭
3. 변경 사항이 Git 리포지토리에 커밋
4. 다른 환경에서 "Pull from Git" 실행
5. 워크플로우 동기화 완료
```

### 브랜치 전략
```
권장 Git Flow:

main (프로덕션)
  └── develop (개발)
       ├── feature/new-workflow
       ├── feature/update-integration
       └── hotfix/critical-bug
```

## Source Control vs 일반 백업

### Source Control (Git)
```
장점:
✓ 세밀한 버전 관리
✓ 변경 사항 추적
✓ 브랜치 및 머지
✓ 팀 협업
✓ 코드 리뷰
✓ CI/CD 통합

사용 사례:
- 팀 개발
- 멀티 환경
- 감사 추적 필요
```

### 일반 백업 (Export)
```
장점:
✓ 간단하고 빠름
✓ 전체 스냅샷
✓ Git 설정 불필요

사용 사례:
- 개인 사용
- 일회성 백업
- 재해 복구
```

## 환경 관리

### 환경 유형
```
Development (개발):
- 실험 및 테스트
- 빈번한 변경
- 데이터 영향 최소

Staging (스테이징):
- 프로덕션 유사 환경
- 통합 테스트
- 성능 테스트

Production (프로덕션):
- 실제 운영 환경
- 안정성 최우선
- 변경 통제 엄격
```

### 환경별 설정
```
각 환경마다 별도의 n8n 인스턴스:

Development Instance:
- Git 브랜치: develop
- 테스트 API 사용
- 테스트 데이터베이스

Production Instance:
- Git 브랜치: main
- 프로덕션 API
- 프로덕션 데이터베이스
```

## 변경 사항 동기화

### Push (밀어넣기)
```
로컬 변경 → Git 리포지토리

1. n8n에서 워크플로우 수정
2. Source Control 패널 열기
3. 변경된 파일 확인
4. 커밋 메시지 작성
5. Push to Git 클릭
```

### Pull (가져오기)
```
Git 리포지토리 → 로컬

1. Source Control 패널 열기
2. "Pull from Git" 클릭
3. 변경 사항 확인
4. 충돌 해결 (있는 경우)
5. Apply Changes
```

### 충돌 해결
```
충돌 발생 시:
1. 충돌된 워크플로우 확인
2. 변경 사항 비교
3. 해결 방법 선택:
   - Keep Local (로컬 유지)
   - Use Remote (원격 사용)
   - Manual Merge (수동 병합)
4. 충돌 해결 후 커밋
```

## 협업 패턴

### Feature Branch 워크플로우
```
1. Developer A:
   - feature/new-integration 브랜치 생성
   - 워크플로우 개발
   - Push to Git

2. Code Review:
   - Pull Request 생성
   - 팀원 리뷰
   - 승인

3. Merge:
   - develop 브랜치에 병합
   - CI/CD 자동 배포
```

### Hotfix 워크플로우
```
긴급 수정:
1. main 브랜치에서 hotfix 브랜치 생성
2. 버그 수정
3. 테스트
4. main과 develop에 병합
5. 즉시 배포
```

## 모범 사례

### 커밋 메시지
```
좋은 예:
✓ "feat: Add Slack notification to customer onboarding"
✓ "fix: Correct email template in welcome workflow"
✓ "refactor: Optimize database query in sync workflow"

나쁜 예:
✗ "update"
✗ "fixes"
✗ "changes"
```

### 브랜치 관리
```
규칙:
- 기능별로 브랜치 생성
- 짧은 생명주기 유지
- 정기적으로 메인 브랜치와 동기화
- 병합 후 브랜치 삭제
```

### 워크플로우 조직화
```
- 명확한 이름 사용
- 태그로 분류
- 프로젝트별 폴더 구조
- README 문서 작성
```

## 보안 고려사항

### 자격 증명 보호
```
절대 Git에 포함하지 말 것:
✗ API 키
✗ 비밀번호
✗ OAuth 토큰
✗ 데이터베이스 연결 문자열
✗ 민감한 환경 변수

대신 사용:
✓ n8n 자격 증명 저장소
✓ 환경 변수
✓ 비밀 관리 서비스
```

### 접근 제어
```
Git 리포지토리:
- Private 리포지토리 사용
- 팀원에게만 접근 권한
- 2FA 활성화
- SSH 키 사용
```

### 감사 추적
```
추적 가능한 정보:
- 누가 변경했는가
- 무엇을 변경했는가
- 언제 변경했는가
- 왜 변경했는가 (커밋 메시지)
```

## 제한 사항

### Source Control 제한
```
지원되지 않음:
- 자격 증명 동기화 (보안상)
- 실행 데이터
- 사용자 설정
- 워크스페이스 설정

지원됨:
- 워크플로우 정의
- 워크플로우 설정
- 태그
- 환경 변수 (선택적)
```

### 파일 크기 제한
```
일반적인 Git 제한:
- 파일당 100MB
- 리포지토리 1GB (GitHub)

권장사항:
- 큰 바이너리 파일 제외
- Git LFS 사용 (필요시)
```

## 다음 단계

### 학습 경로
```
1. [환경 설정 이해](./02-environments.md)
2. [Source Control 설정](./03-setup.md)
3. [실제 사용법](./04-using.md)
4. [브랜치 패턴](./05-branch-patterns.md)
```

## 관련 문서

- [Source Control 설정](./03-setup.md)
- [환경 관리](./02-environments.md)
- [변수 관리](./07-variables.md)
- [협업 가이드](../manage-cloud/05-collaboration.md)
