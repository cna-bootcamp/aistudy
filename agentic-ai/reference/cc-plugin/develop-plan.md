# Claude Code Plugin 작성 가이드 - 개발 계획서

## 1. 개요

### 1.1 목표
Claude Code Plugin 시스템의 전체 구조와 작성 방법을 교육하는 한국어 기술 문서 작성.
개발자와 아키텍트가 플러그인을 직접 설계하고 구현할 수 있도록 체계적인 가이드 제공.

### 1.2 배경
- Claude Code는 플러그인 시스템을 통해 기능 확장 가능
- 기존 예제(`ai-model-textbook-writer`)는 존재하나 공식 문서 부재
- Boot Camp 교육 참여자들이 자체 플러그인 개발 역량 필요

### 1.3 범위
- 플러그인 아키텍처 이해
- 스킬(SKILL.md) 작성법
- 훅(Hooks) 시스템 활용
- 에이전트(Agents) 정의
- MCP/LSP 서버 연동
- 실전 예제 및 배포 방법

## 2. 대상 독자

### 2.1 주 대상
- **풀스택 개발자**: 플러그인 구현 및 배포 담당
- **아키텍트**: 플러그인 아키텍처 설계 및 시스템 연동
- **AI/ML 엔지니어**: AI 기능 확장 플러그인 개발

### 2.2 선수 지식
- Markdown 문법 기초
- JSON 스키마 이해
- JavaScript/TypeScript 기본 (선택)
- Git 버전 관리 기초

## 3. 문서 구성

```
agentic-ai/reference/ccplugin/
├── README.md                     # 목차 및 개요, 빠른 시작 가이드
├── 01.플러그인-개요.md            # Plugin 개념, 아키텍처, 핵심 구성요소
├── 02.프로젝트-구조.md            # 디렉토리 구조, plugin.json 스키마
├── 03.스킬-작성법.md              # SKILL.md 작성, frontmatter, 본문 구조
├── 04.훅-시스템.md                # Hooks 이벤트, 타입, 설정 방법
├── 05.에이전트-정의.md            # Agent 마크다운 작성법, 역할 정의
├── 06.MCP-LSP-서버.md            # MCP/LSP 서버 연동, 설정 방법
├── 07.설치와-배포.md              # 설치 방법, 스코프, 마켓플레이스
├── 08.실전-예제.md                # 실습 - 플러그인 처음부터 만들기
└── 09.베스트-프랙티스.md          # 설계 원칙, 보안, 성능, 디버깅
```

### 3.1 README.md
- Claude Code Plugin 시스템 소개
- 문서 전체 목차
- 빠른 시작 가이드 (5분 내 플러그인 실행)
- 추천 학습 경로

### 3.2 01.플러그인-개요.md
- Plugin이란 무엇인가
- Claude Code 확장 아키텍처
- 핵심 구성요소 (Skills, Agents, Hooks, MCP/LSP)
- Plugin의 동작 원리
- 사용 사례 및 활용 시나리오

### 3.3 02.프로젝트-구조.md
- 표준 디렉토리 구조
- plugin.json 스키마 상세 (필수/선택 필드)
- 파일 명명 규칙
- 버전 관리 전략

### 3.4 03.스킬-작성법.md
- SKILL.md 구조 (frontmatter + 본문)
- frontmatter 필수 필드 (name, description, version)
- frontmatter 선택 필드 (allowed-tools, context, model, temperature 등)
- 본문 작성 가이드 (Progressive Disclosure 원칙)
- 토큰 예산 관리 (15K 제한)
- 스킬 호출 메커니즘

### 3.5 04.훅-시스템.md
- Hooks 개념 및 이벤트 라이프사이클
- 주요 이벤트 (PreToolUse, PostToolUse, SessionStart, SessionEnd 등)
- Hook 타입 (command, prompt, agent)
- Hook 설정 방법 (plugin.json)
- 실전 Hook 예제 (로깅, 검증, 변환)

### 3.6 05.에이전트-정의.md
- Agent 개념 및 역할
- Agent 마크다운 파일 작성법
- frontmatter 구조 (name, description, model 등)
- Agent 본문 작성 (지시문, 제약사항)
- Agent 호출 방법

### 3.7 06.MCP-LSP-서버.md
- MCP(Model Context Protocol) 개요
- LSP(Language Server Protocol) 개요
- plugin.json에서 MCP/LSP 서버 설정
- 커스텀 서버 연동
- 보안 및 권한 관리

### 3.8 07.설치와-배포.md
- 로컬 설치 방법 (`--plugin-dir`)
- CLI 설치 (`claude plugin install`)
- 설치 스코프 (user/project/local)
- 마켓플레이스 배포 준비
- 버전 업데이트 전략

### 3.9 08.실전-예제.md
- 단계별 플러그인 생성 튜토리얼
- 예제 1: 단순 스킬 플러그인 (텍스트 변환기)
- 예제 2: Hook 활용 플러그인 (도구 사용 로깅)
- 예제 3: Agent 활용 플러그인 (코드 리뷰어)
- 예제 4: MCP 서버 연동 플러그인
- 테스트 및 디버깅 방법

### 3.10 09.베스트-프랙티스.md
- 설계 원칙 (Progressive Disclosure, Single Responsibility)
- 보안 고려사항 (도구 권한, 민감 정보)
- 성능 최적화 (토큰 예산, 컨텍스트 크기)
- 에러 처리 전략
- 디버깅 팁
- 유지보수 가이드

## 4. 각 문서별 상세 내용

### 4.1 README.md
```markdown
# Claude Code Plugin 작성 가이드

## 목차
(전체 문서 링크)

## 빠른 시작
- 플러그인이란?
- 5분 안에 첫 플러그인 실행하기
- 추천 학습 경로

## 학습 로드맵
- 초급: 01, 02, 03, 08 (기본 스킬 플러그인)
- 중급: 04, 05 (Hooks, Agents)
- 고급: 06, 09 (MCP/LSP, 최적화)
```

### 4.2 01.플러그인-개요.md
```markdown
# 1. 플러그인 개요

## 1.1 학습 목표
## 1.2 Plugin이란?
  - 정의 및 역할
  - Claude Code 확장 메커니즘
## 1.3 핵심 구성요소
  - Skills: 특정 작업 수행 단위
  - Agents: 독립적 AI 에이전트
  - Hooks: 이벤트 기반 확장점
  - MCP/LSP Servers: 외부 도구 연동
## 1.4 Plugin 아키텍처
  - 메타 도구(Meta-tool) 개념
  - 호출 메커니즘 (Prompt-based)
  - 컨텍스트 전달 방식
## 1.5 사용 사례
  - 코드 생성 자동화
  - 문서 작성 지원
  - 프로젝트 템플릿
  - 커스텀 워크플로우
```

### 4.3 02.프로젝트-구조.md
```markdown
# 2. 프로젝트 구조

## 2.1 학습 목표
## 2.2 표준 디렉토리 구조
  - .claude-plugin/ (manifest)
  - skills/ (스킬 정의)
  - agents/ (에이전트 정의)
  - hooks/ (훅 스크립트)
  - README.md, LICENSE
## 2.3 plugin.json 스키마
  - 필수 필드: name, version
  - 선택 필드: description, author, license, repository
  - skills 배열 구조
  - commands 배열 구조
  - agents 배열 구조
  - hooks 배열 구조
  - mcpServers, lspServers 설정
## 2.4 파일 명명 규칙
  - 스킬: SKILL.md
  - 참조 파일: references/, examples/
## 2.5 버전 관리
  - Semantic Versioning
  - 호환성 유지
```

### 4.4 03.스킬-작성법.md
```markdown
# 3. 스킬 작성법

## 3.1 학습 목표
## 3.2 SKILL.md 구조
  - frontmatter (YAML)
  - 본문 (Markdown)
## 3.3 Frontmatter 필수 필드
  - name: 스킬 고유 이름
  - description: 호출 조건 명시 (트리거 키워드)
  - version: 버전 번호
## 3.4 Frontmatter 선택 필드
  - allowed-tools: 허용 도구 목록
  - blocked-tools: 차단 도구 목록
  - context: 추가 컨텍스트 파일
  - model: 권장 모델 (haiku/sonnet/opus)
  - temperature: 창의성 수준
  - agent-type: 에이전트 타입
## 3.5 본문 작성 원칙
  - Progressive Disclosure (점진적 정보 제공)
  - 명확한 지시문
  - 예제 포함
## 3.6 토큰 예산 관리
  - 15K 글자 제한
  - 핵심 정보 우선 배치
  - 참조 파일 활용 (references/)
## 3.7 스킬 호출
  - 트리거 키워드 설계
  - 사용자 의도 감지
```

### 4.5 04.훅-시스템.md
```markdown
# 4. 훅 시스템

## 4.1 학습 목표
## 4.2 Hooks 개념
  - 이벤트 기반 확장점
  - 라이프사이클
## 4.3 주요 이벤트
  - PreToolUse: 도구 사용 전
  - PostToolUse: 도구 사용 후
  - SessionStart: 세션 시작
  - SessionEnd: 세션 종료
  - PreMessageSent: 메시지 전송 전
  - PostMessageReceived: 메시지 수신 후
## 4.4 Hook 타입
  - command: 명령어 실행
  - prompt: 프롬프트 주입
  - agent: 에이전트 호출
## 4.5 Hook 설정
  - plugin.json 내 hooks 배열
  - event, type, 실행 내용 정의
## 4.6 실전 예제
  - 도구 사용 로깅 Hook
  - 입력 검증 Hook
  - 출력 변환 Hook
```

### 4.6 05.에이전트-정의.md
```markdown
# 5. 에이전트 정의

## 5.1 학습 목표
## 5.2 Agent 개념
  - 독립적 AI 에이전트
  - 역할 및 책임
## 5.3 Agent 마크다운 구조
  - frontmatter
  - 본문 (시스템 지시문)
## 5.4 Frontmatter 필드
  - name: 에이전트 이름
  - description: 역할 설명
  - model: 사용 모델
  - temperature: 창의성 수준
## 5.5 본문 작성
  - 역할 정의
  - 제약사항
  - 작업 지시
  - 예제
## 5.6 Agent 호출
  - Task 도구 사용
  - subagent_type 지정
```

### 4.7 06.MCP-LSP-서버.md
```markdown
# 6. MCP/LSP 서버

## 6.1 학습 목표
## 6.2 MCP(Model Context Protocol)
  - 개념 및 역할
  - 사용 사례
## 6.3 LSP(Language Server Protocol)
  - 개념 및 역할
  - 코드 인텔리전스 제공
## 6.4 plugin.json 설정
  - mcpServers 배열
  - lspServers 배열
## 6.5 커스텀 서버 연동
  - 서버 실행 명령 정의
  - 환경 변수 설정
  - 초기화 옵션
## 6.6 보안 및 권한
  - 도구 접근 제어
  - 민감 정보 처리
```

### 4.8 07.설치와-배포.md
```markdown
# 7. 설치와 배포

## 7.1 학습 목표
## 7.2 로컬 설치
  - --plugin-dir 플래그 사용
  - 개발 중 테스트
## 7.3 CLI 설치
  - claude plugin install 명령
  - 플러그인 경로 또는 URL
## 7.4 설치 스코프
  - user: 사용자 전역
  - project: 프로젝트별
  - local: 로컬 개발
## 7.5 마켓플레이스 배포
  - 준비 사항
  - 제출 프로세스
## 7.6 버전 업데이트
  - 버전 번호 변경
  - 변경 로그 작성
  - 호환성 유지
```

### 4.9 08.실전-예제.md
```markdown
# 8. 실전 예제

## 8.1 학습 목표
## 8.2 예제 1: 텍스트 변환기 (기본 스킬)
  - STEP 1: 프로젝트 구조 생성
  - STEP 2: plugin.json 작성
  - STEP 3: SKILL.md 작성
  - STEP 4: 로컬 테스트
## 8.3 예제 2: 도구 사용 로거 (Hook)
  - STEP 1: Hook 정의
  - STEP 2: plugin.json에 Hook 등록
  - STEP 3: 테스트
## 8.4 예제 3: 코드 리뷰어 (Agent)
  - STEP 1: Agent 마크다운 작성
  - STEP 2: plugin.json에 Agent 등록
  - STEP 3: 호출 및 테스트
## 8.5 예제 4: MCP 서버 연동
  - STEP 1: MCP 서버 설정
  - STEP 2: plugin.json에 서버 등록
  - STEP 3: 스킬에서 도구 사용
## 8.6 테스트 및 디버깅
  - 로그 확인
  - 에러 트러블슈팅
```

### 4.10 09.베스트-프랙티스.md
```markdown
# 9. 베스트 프랙티스

## 9.1 학습 목표
## 9.2 설계 원칙
  - Progressive Disclosure: 필요한 정보만 점진적 제공
  - Single Responsibility: 스킬/에이전트 단일 책임
  - Clear Naming: 명확한 이름 부여
## 9.3 보안 고려사항
  - 도구 권한 최소화 (allowed-tools, blocked-tools)
  - 민감 정보 노출 방지
  - 사용자 입력 검증
## 9.4 성능 최적화
  - 토큰 예산 관리 (15K 제한)
  - 컨텍스트 크기 최적화
  - 참조 파일 분할 (references/)
## 9.5 에러 처리
  - 명확한 에러 메시지
  - Fallback 전략
  - 사용자 가이드 제공
## 9.6 디버깅 팁
  - description 필드에 트리거 명시
  - 로그 활용
  - 단계별 테스트
## 9.7 유지보수 가이드
  - 버전 관리 전략
  - 변경 로그 작성
  - 문서 업데이트
```

## 5. 작성 순서

의존관계를 고려한 권장 작성 순서:

| 순서 | 문서 | 이유 |
|------|------|------|
| 1 | 01.플러그인-개요.md | 전체 아키텍처 이해 선행 필요 |
| 2 | 02.프로젝트-구조.md | plugin.json 스키마는 모든 문서의 기초 |
| 3 | 03.스킬-작성법.md | 가장 기본적인 플러그인 구성요소 |
| 4 | 08.실전-예제.md (예제 1) | 스킬 작성법 학습 직후 실습 |
| 5 | 04.훅-시스템.md | 중급 기능 (이벤트 확장) |
| 6 | 08.실전-예제.md (예제 2) | Hook 실습 |
| 7 | 05.에이전트-정의.md | 중급 기능 (독립 에이전트) |
| 8 | 08.실전-예제.md (예제 3) | Agent 실습 |
| 9 | 06.MCP-LSP-서버.md | 고급 기능 (외부 도구 연동) |
| 10 | 08.실전-예제.md (예제 4) | MCP 실습 |
| 11 | 07.설치와-배포.md | 배포는 개발 완료 후 |
| 12 | 09.베스트-프랙티스.md | 전체 경험 기반 종합 |
| 13 | README.md | 모든 문서 완성 후 목차 및 개요 작성 |

## 6. 참고 자료

### 6.1 기존 예제 코드
- `/Users/dreamondal/workspace/aistudy/.claude/plugins/ai-model-textbook-writer/`
  - `.claude-plugin/plugin.json`: 플러그인 매니페스트 예제
  - `skills/ai-model-textbook-writer/SKILL.md`: 스킬 작성 예제
  - `skills/ai-model-textbook-writer/references/`: 참조 파일 구조 예제

### 6.2 기존 참조 문서
- `/Users/dreamondal/workspace/aistudy/agentic-ai/reference/lsp.md`: LSP 설치 가이드
- `/Users/dreamondal/workspace/aistudy/agentic-ai/reference/omc/`: Oh My ClaudeCode 참조 문서
  - `oh-my-claudecode-overview.md`: 멀티 에이전트 시스템 개요
  - `oh-my-claudecode-protocols.md`: 프로토콜 및 규칙
  - `oh-my-claudecode-skills-agents.md`: 스킬 및 에이전트 정의

### 6.3 외부 자료
- Claude Code 공식 문서 (WebSearch 활용)
- Language Server Protocol 공식 스펙
- Model Context Protocol 공식 문서

### 6.4 연구 자료
- Comprehensive research summary (제공된 컨텍스트):
  - Plugin 구조: `.claude-plugin/plugin.json` + skills/, agents/, hooks/
  - SKILL.md frontmatter 필드
  - Skill 호출 메커니즘 (Prompt-based meta-tool)
  - Hook 이벤트 및 타입
  - 설치 스코프 (user/project/local)
  - Progressive Disclosure 원칙
  - 15K 토큰 예산 제한

### 6.5 작문 스타일 참조
- `CLAUDE.md`: 명사체 작문 규칙
  - "~한다" → "~함"
  - "~이다" → "~임"
  - 줄바꿈: 120자 이내, trailing space 2개 + 줄바꿈
- 기존 교재 패턴: 학습 목표 → 개요 → 상세 내용 → 실습
