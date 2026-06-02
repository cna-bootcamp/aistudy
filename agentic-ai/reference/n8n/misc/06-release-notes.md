# n8n 릴리스 노트

## 개요

n8n 릴리스 노트는 새로운 버전의 기능, 개선사항, 버그 수정 및 주요 변경사항을 문서화한 자료임

## 릴리스 노트 접근 방법

### 공식 웹사이트
- https://n8n.io/releases
- 최신 릴리스 정보
- 주요 기능 하이라이트
- 마이그레이션 가이드

### GitHub 저장소
- https://github.com/n8n-io/n8n/releases
- 상세 변경 사항
- 커밋 히스토리
- 이슈 링크

### n8n 에디터 내
- 설정 메뉴 > "About" 또는 "Help"
- 현재 버전 정보
- 업데이트 알림
- 릴리스 노트 링크

### 이메일 구독
- n8n 뉴스레터 구독
- 주요 릴리스 알림
- 새 기능 소개
- 베스트 프랙티스

## 릴리스 주기

### 정기 릴리스
- **메이저 버전** (예: 1.0.0 → 2.0.0): 연 1-2회
- **마이너 버전** (예: 1.20.0 → 1.21.0): 월 1-2회
- **패치 버전** (예: 1.20.0 → 1.20.1): 필요시 수시

### 릴리스 유형

**메이저 릴리스**:
- 중대한 아키텍처 변경
- Breaking Changes
- 새로운 핵심 기능
- API 변경

**마이너 릴리스**:
- 새로운 기능 추가
- 노드 추가/업데이트
- 성능 개선
- 하위 호환성 유지

**패치 릴리스**:
- 버그 수정
- 보안 패치
- 소규모 개선
- 긴급 수정

## 릴리스 노트 구조

### 주요 섹션

**🎉 New Features (새 기능)**:
```
- AI Agent Builder: 드래그 앤 드롭으로 AI 에이전트 구성
- 새로운 통합: Notion, Linear, Figma 노드 추가
- 향상된 Expression 에디터: 자동완성 및 문법 하이라이트
```

**⚡ Improvements (개선사항)**:
```
- 캔버스 성능 30% 향상
- 워크플로우 로딩 속도 개선
- UI/UX 개선: 더 직관적인 노드 설정 패널
```

**🐛 Bug Fixes (버그 수정)**:
```
- Webhook 노드 타임아웃 문제 수정
- Expression 에러 핸들링 개선
- 특정 조건에서 워크플로우 중단되는 문제 해결
```

**🔒 Security (보안)**:
```
- 인증 강화
- 의존성 보안 패치
- XSS 취약점 수정
```

**⚠️ Breaking Changes (호환성 깨지는 변경)**:
```
- 이전 버전과 호환되지 않는 변경
- 마이그레이션 필요 사항
- Deprecated API 제거
```

**📚 Documentation (문서)**:
```
- 새로운 튜토리얼 추가
- API 문서 업데이트
- 예제 워크플로우
```

## 버전 번호 체계

### Semantic Versioning
n8n은 Semantic Versioning (SemVer) 사용

**형식**: `MAJOR.MINOR.PATCH`

**예시**: `1.21.3`
- `1`: 메이저 버전
- `21`: 마이너 버전
- `3`: 패치 버전

### 버전별 의미

**메이저 (MAJOR)**:
- Breaking Changes 포함
- 대규모 리팩토링
- API 호환성 깨짐
- 마이그레이션 필요

**마이너 (MINOR)**:
- 새 기능 추가
- 하위 호환성 유지
- 새로운 노드 추가
- API 확장

**패치 (PATCH)**:
- 버그 수정
- 보안 패치
- 소규모 개선
- 하위 호환성 보장

## 주요 릴리스 히스토리 (예시)

### v1.0.0 (2024년 1월)
**주요 변경사항**:
- 새로운 UI/UX 디자인
- AI 기능 통합 (LangChain)
- 성능 대폭 개선
- 새로운 Enterprise 기능

**Breaking Changes**:
- API 엔드포인트 변경
- 환경 변수 이름 변경
- 레거시 노드 제거

### v0.230.0 (2023년 12월)
**새 기능**:
- 프로젝트 기능 추가
- 향상된 Credential 공유
- 새로운 로그 스트리밍

**개선사항**:
- 워크플로우 편집기 성능 향상
- Expression 에디터 개선

### v0.220.0 (2023년 11월)
**새 기능**:
- 외부 시크릿 관리 지원
- Insights 대시보드
- 새로운 노드 10개 추가

**버그 수정**:
- Webhook 안정성 개선
- 메모리 누수 문제 해결

## 업그레이드 가이드

### 업그레이드 준비

**사전 점검**:
1. 현재 버전 확인
2. 릴리스 노트 읽기
3. Breaking Changes 확인
4. 백업 생성

**호환성 확인**:
- 커스텀 노드 호환성
- 통합된 외부 시스템
- 환경 변수 변경사항
- API 변경사항

### 업그레이드 프로세스

**자체 호스팅 (Docker)**:
```bash
# 1. 백업
docker exec n8n n8n export:workflow --backup --output=/backup

# 2. 컨테이너 중지
docker stop n8n

# 3. 최신 이미지 가져오기
docker pull n8nio/n8n:latest

# 4. 새 버전으로 시작
docker start n8n

# 5. 로그 확인
docker logs -f n8n
```

**npm 설치**:
```bash
# 1. 백업
n8n export:workflow --backup --output=./backup

# 2. 업그레이드
npm install -g n8n@latest

# 3. 시작
n8n start
```

**n8n Cloud**:
- 자동 업그레이드
- 다운타임 없음
- 알림 수신

### 업그레이드 후 확인

**검증 단계**:
1. n8n 버전 확인
2. 주요 워크플로우 테스트
3. Credential 연결 확인
4. 로그 에러 확인
5. 성능 모니터링

## Breaking Changes 처리

### Breaking Change 예시

**환경 변수 변경**:
```bash
# 이전 (v0.x)
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=password

# 이후 (v1.x)
N8N_SECURITY_BASIC_AUTH_ENABLED=true
N8N_SECURITY_BASIC_AUTH_USERNAME=admin
N8N_SECURITY_BASIC_AUTH_PASSWORD=password
```

**API 엔드포인트 변경**:
```bash
# 이전
GET /api/v1/workflows

# 이후
GET /api/v2/workflows
```

### 마이그레이션 스크립트

**자동 마이그레이션**:
n8n은 데이터베이스 스키마 변경 시 자동 마이그레이션 실행

**수동 마이그레이션**:
특정 Breaking Changes는 수동 조정 필요
- 릴리스 노트의 마이그레이션 가이드 참고
- 커뮤니티 포럼의 마이그레이션 스레드

## Deprecation Policy

### Deprecation 프로세스

**1. Deprecation 발표**:
- 릴리스 노트에 명시
- 코드에 경고 추가
- 문서 업데이트

**2. Deprecation 기간**:
- 최소 2개 메이저 버전
- 또는 최소 6개월

**3. 제거**:
- 다음 메이저 버전에서 제거
- 마이그레이션 가이드 제공

### Deprecated 기능 확인

**로그 확인**:
```
[WARN] Feature X is deprecated and will be removed in v2.0.0
      Please use Feature Y instead
      See migration guide: https://...
```

**문서 표시**:
```
⚠️ Deprecated
This feature is deprecated and will be removed in v2.0.0.
Use [New Feature](link) instead.
```

## 보안 업데이트

### 보안 릴리스 정책

**중대한 보안 문제**:
- 즉시 패치 릴리스
- 보안 권고 발표
- 긴급 업그레이드 권장

**일반 보안 개선**:
- 정기 릴리스에 포함
- CVE 번호 할당
- 영향도 평가

### 보안 알림 구독

**GitHub Security Advisories**:
- n8n 저장소 Watch
- Security Advisories만 알림 설정

**이메일 알림**:
- n8n 보안 메일링 리스트 구독
- 중요 보안 업데이트 수신

## 롤백 절차

### 업그레이드 실패 시 롤백

**Docker 롤백**:
```bash
# 1. 현재 컨테이너 중지
docker stop n8n

# 2. 이전 버전 이미지로 전환
docker run -d \
  --name n8n \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n:1.20.0

# 3. 백업 복원 (필요시)
docker exec n8n n8n import:workflow --input=/backup
```

**데이터베이스 롤백**:
```bash
# PostgreSQL 백업 복원
pg_restore -d n8n_db backup.dump

# SQLite 백업 복원
cp backup.db ~/.n8n/database.sqlite
```

## 베타 및 RC 버전

### 베타 버전 테스트

**베타 프로그램 참여**:
- 최신 기능 조기 접근
- 피드백 제공
- 버그 리포트

**베타 설치**:
```bash
# Docker
docker pull n8nio/n8n:next

# npm
npm install -g n8n@next
```

### Release Candidate (RC)

**RC 버전**:
- 정식 릴리스 전 후보
- 안정성 테스트
- 마지막 버그 수정

**RC 사용 시 주의사항**:
- 프로덕션에서 사용 금지
- 테스트 환경에서만 사용
- 이슈 발견 시 즉시 리포트

## 커뮤니티 기여

### 릴리스 노트 기여

**기여 방법**:
- GitHub Pull Request
- 변경사항 문서화
- 예제 추가
- 스크린샷 제공

**릴리스 노트 작성 가이드**:
- 명확하고 간결한 설명
- 사용자 관점에서 작성
- 예제 코드 포함
- 마이그레이션 가이드

## 추가 리소스

### 공식 채널
- 웹사이트: https://n8n.io/releases
- GitHub: https://github.com/n8n-io/n8n/releases
- 포럼: https://community.n8n.io
- Discord: https://discord.gg/n8n

### 학습 자료
- 릴리스 하이라이트 비디오
- 새 기능 튜토리얼
- 마이그레이션 가이드
- 베스트 프랙티스

### 지원
- 커뮤니티 포럼
- GitHub 이슈
- Enterprise 지원
- 이메일 지원

## 릴리스 모니터링

### 자동 알림 설정

**GitHub Watch**:
1. n8n 저장소 방문
2. "Watch" 버튼 클릭
3. "Releases only" 선택

**RSS 피드**:
- https://github.com/n8n-io/n8n/releases.atom
- RSS 리더에 추가

**트위터/소셜 미디어**:
- @n8n_io 팔로우
- 릴리스 공지 수신

### 업그레이드 계획

**정기 업그레이드 전략**:
- 월 1회 정기 업데이트 검토
- 분기별 메이저 업그레이드 계획
- 보안 패치는 즉시 적용

**테스트 환경**:
- 스테이징 환경 먼저 업그레이드
- 충분한 테스트 후 프로덕션 적용
- 롤백 계획 준비

## 참고사항

### 버전 지원 정책

**지원 버전**:
- 최신 메이저 버전
- 이전 메이저 버전 (6개월)
- 보안 패치만 제공

**지원 종료**:
- EOL(End of Life) 공지
- 최소 3개월 전 예고
- 마이그레이션 가이드 제공

### 라이선스 변경

릴리스 노트에서 라이선스 관련 변경사항도 확인:
- Fair-code 라이선스 업데이트
- 사용 조건 변경
- Enterprise 기능 추가/변경
