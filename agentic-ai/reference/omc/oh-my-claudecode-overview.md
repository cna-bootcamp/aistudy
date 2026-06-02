# Oh My ClaudeCode(OMC) 개요

- [Oh My ClaudeCode(OMC) 개요](#oh-my-claudecodeomc-개요)
  - [1. OMC란?](#1-omc란)
  - [2. 핵심 특징](#2-핵심-특징)
  - [3. 초기 설정](#3-초기-설정)
  - [4. .omc 디렉토리 구조](#4-omc-디렉토리-구조)
  - [5. 퀵스타트](#5-퀵스타트)
  - [6. 다른 문서 안내](#6-다른-문서-안내)
  - [참고 자료](#참고-자료)

---

## 1. OMC란?

### OMC 정의

Claude Code용 멀티 에이전트 오케스트레이션 플러그인.
30개 스킬과 32개 전문 에이전트를 통해 복잡한 작업을 자동으로 분해하고 위임하여 실행함.

### 핵심 철학

**"지휘자(Conductor), 수행자(Performer) 아님"**

사용자는 직접 코드를 작성하거나 파일을 수정하지 않음.
OMC가 작업을 분석하여 적합한 전문 에이전트에게 자동으로 위임하고 조율함.

### 위임 우선(Delegation-First) 원칙

OMC의 4대 규칙:

1. **RULE 1**: 실질적인 작업은 항상 전문 에이전트에게 위임
2. **RULE 2**: 패턴 감지 시 적절한 스킬을 자동 호출
3. **RULE 3**: 코드 변경은 절대 직접 수행하지 않고 executor 에이전트에게 위임
4. **RULE 4**: Architect 에이전트의 검증 없이 완료를 선언하지 않음

### oh-my-opencode와의 차이점

| 구분 | oh-my-claudecode (OMC) | oh-my-opencode |
|------|------------------------|----------------|
| 용도 | Claude Code용 플러그인 | 별도의 독립 도구 |
| 에이전트 | 32개 전문 에이전트 내장 | - |
| 스킬 | 30개 스킬 자동 실행 | - |
| 모델 라우팅 | haiku/sonnet/opus 자동 선택 | - |

[Top](#oh-my-claudecodeomc-개요)

---

## 2. 핵심 특징

### 30개 스킬, 32개 에이전트

**스킬 예시** (일부):
- `autopilot`: 아이디어부터 동작 코드까지 완전 자율 실행
- `ralph`: 검증 완료까지 지속 실행 (Persistence mode)
- `ultrawork`: 최대 병렬 실행 모드
- `ecomode`: 토큰 절약형 병렬 실행
- `plan`: 요구사항 인터뷰 기반 계획 수립
- `analyze`: 심층 분석 및 디버깅
- `deepsearch`: 코드베이스 전체 검색
- `tdd`: 테스트 주도 개발 강제
- `swarm`: N개 에이전트 협력 작업
- `pipeline`: 에이전트 순차 체이닝

**에이전트 예시** (도메인별):
- **분석**: architect-low, architect-medium, architect (haiku/sonnet/opus)
- **실행**: executor-low, executor, executor-high
- **검색**: explore, explore-medium, explore-high
- **프론트엔드**: designer-low, designer, designer-high
- **테스팅**: qa-tester, qa-tester-high
- **보안**: security-reviewer-low, security-reviewer
- **데이터 과학**: scientist-low, scientist, scientist-high
- **문서화**: writer
- **비전**: vision

### 자동 감지 및 실행 (Zero Learning Curve)

명령어를 배울 필요 없이 자연어로 요청하면 자동으로 적절한 스킬과 에이전트가 활성화됨.

**자동 감지 예시**:

| 사용자 입력 | 자동 활성화 |
|-------------|-------------|
| "build me a todo app" | autopilot 스킬 |
| "don't stop until done" | ralph 스킬 (persistence) |
| "ulw fix all errors" | ultrawork 스킬 (최대 병렬) |
| "eco refactor code" | ecomode 스킬 (토큰 절약) |
| "plan the new API" | plan 스킬 (계획 인터뷰) |
| "analyze this bug" | analyze 스킬 → architect 에이전트 |
| "search for usage" | deepsearch 스킬 → explore 에이전트 |

### 스마트 모델 라우팅 (haiku/sonnet/opus)

작업 복잡도에 따라 최적의 모델을 자동 선택하여 토큰 비용 절감.

| 작업 복잡도 | 모델 | 사용 시기 |
|-------------|------|-----------|
| 단순 조회 | haiku | "X의 정의를 찾아줘", "이 함수가 뭐 반환해?" |
| 표준 작업 | sonnet | "에러 핸들링 추가", "기능 구현" |
| 복잡한 추론 | opus | "레이스 컨디션 디버깅", "아키텍처 리팩토링" |

**예시**:
- 단순 코드 검색 → `explore` (haiku)
- 일반 기능 구현 → `executor` (sonnet)
- 복잡한 아키텍처 분석 → `architect` (opus)

### 7가지 실행 모드

| 모드 | 트리거 | 특징 |
|------|--------|------|
| **autopilot** | "autopilot", "build me", "I want a" | 완전 자율 실행 |
| **ralph** | "ralph", "don't stop" | 완료까지 지속 실행 |
| **ultrawork** | "ulw", "ultrawork" | 최대 병렬화 |
| **ecomode** | "eco", "efficient", "budget" | 토큰 절약형 병렬 |
| **ultrapilot** | "ultrapilot", "parallel build" | 병렬 autopilot (3-5배 빠름) |
| **swarm** | "swarm 5 agents" | N개 에이전트 협력 |
| **pipeline** | "pipeline", "chain" | 에이전트 순차 실행 |

**모드 조합 가능**: "ralph ulw: migrate database" = 지속성 + 최대 병렬화

[Top](#oh-my-claudecodeomc-개요)

---

## 3. 초기 설정

### omc-setup 실행

최초 1회만 설정하면 이후 모든 기능이 자동으로 작동함.

**실행 방법**:
1. 자연어: "setup omc" 입력
2. 명령어: `/oh-my-claudecode:omc-setup` 실행

### 기본 실행 모드 설정

설정 파일 위치: `~/.claude/.omc-config.json`

**설정 예시**:
```json
{
  "defaultExecutionMode": "ultrawork"
}
```

또는

```json
{
  "defaultExecutionMode": "ecomode"
}
```

**적용 규칙**:
- "fast", "parallel" 키워드만 입력 시 → 설정값 사용
- "ulw", "eco" 같은 명시 키워드 → 설정 무시하고 해당 모드 사용
- 둘 다 있으면 → ecomode 우선 (더 제한적)
- 설정 파일 없으면 → ultrawork 기본값

### 트러블슈팅

**문제 진단 및 수정**: `/oh-my-claudecode:doctor`

**HUD 상태 표시줄 설치/수리**: `/oh-my-claudecode:hud setup`

[Top](#oh-my-claudecodeomc-개요)

---

## 4. .omc 디렉토리 구조

OMC는 프로젝트 루트의 `.omc/` 디렉토리에 모든 상태와 기록을 저장함.

### state/ - 상태 파일

활성 모드의 실행 상태를 JSON 형식으로 저장.

**주요 파일**:
- `ultrapilot-state.json`: Ultrapilot 세션 상태
- `ultrapilot-ownership.json`: 파일 소유권 정보
- `checkpoints/checkpoint-{timestamp}.json`: 체크포인트 백업

**경로 규칙**:
- 로컬: `.omc/state/{name}.json`
- 글로벌: `~/.omc/state/{name}.json`

### plans/ - 작업 계획서

`plan` 또는 `ralplan` 스킬이 생성한 계획서를 마크다운으로 저장.

**예시**: `.omc/plans/{plan-name}.md`

**READ ONLY**: 계획 파일은 Orchestrator만 관리하며 일반 에이전트는 읽기만 가능함.

### notepads/{plan-name}/ - 위즈덤 노트

계획별 학습 내용, 결정사항, 이슈, 문제를 기록하는 지식 베이스.

| 파일 | 용도 |
|------|------|
| `learnings.md` | 기술적 발견사항 및 패턴 |
| `decisions.md` | 아키텍처 및 설계 결정사항 |
| `issues.md` | 알려진 이슈 및 해결방법 |
| `problems.md` | 블로커 및 과제 |

**API**: `initPlanNotepad()`, `addLearning()`, `addDecision()`, `addIssue()`,
`addProblem()`, `getWisdomSummary()`, `readPlanWisdom()`

### logs/ - 위임 감사 로그

에이전트 위임 기록을 JSONL 형식으로 저장.

**파일**: `delegation-audit.jsonl`

### sessions/ - 세션 데이터

백그라운드 에이전트 세션 정보를 JSON으로 저장.

**예시**: `.omc/sessions/{session-id}.json`

**재개 가능**: `resume-session` 도구로 중단된 세션을 전체 컨텍스트와 함께 재개 가능.

### 루트 파일

- `continuation-count.json`: 연속 실행 카운트
- `subagent-tracking.json`: 서브 에이전트 추적 정보

[Top](#oh-my-claudecodeomc-개요)

---

## 5. 퀵스타트

### 기본 사용법

자연어로 원하는 작업을 요청하면 OMC가 자동으로 감지하여 실행함.

**예시**:
- "I want a REST API for managing tasks"
- "Build me a React dashboard with charts"
- "Create a CLI tool that processes CSV files"

### Autopilot 모드로 첫 프로젝트

가장 간단한 시작 방법. 아이디어부터 동작하는 코드까지 완전 자동 실행.

**실행**:
```
autopilot: build me a todo app
```

**자동 진행**:
1. 요구사항 분석 및 계획 수립
2. 병렬로 여러 전문 에이전트 실행
3. 지속적 검증 및 테스트
4. 오류 발견 시 자동 수정
5. 완료까지 사용자 개입 없이 진행

### 매직 키워드

| 키워드 | 효과 | 예시 |
|--------|------|------|
| `autopilot` | 완전 자율 실행 | "autopilot: build a todo app" |
| `ralph` | 지속 실행 모드 | "ralph: refactor auth" |
| `ulw` | 최대 병렬화 | "ulw fix all errors" |
| `eco` | 토큰 절약 병렬 | "eco fix all errors" |
| `plan` | 계획 인터뷰 | "plan the new API" |
| `ralplan` | 반복 계획 합의 | "ralplan this feature" |

### 자주 쓰는 시나리오 5가지

#### 1. 새 프로젝트 빠르게 시작

**입력**: "autopilot: create a REST API with user authentication"

**결과**: 계획 → 구현 → 테스트 → 문서화까지 자동 완료

#### 2. 복잡한 버그 디버깅

**입력**: "analyze why users can't log in"

**진행**: explore 에이전트가 코드 탐색 → architect 에이전트가 분석 →
executor 에이전트가 수정 → qa-tester가 검증

#### 3. 대규모 리팩토링

**입력**: "ralph ulw: migrate from REST to GraphQL"

**특징**: ralph(완료까지 지속) + ulw(최대 병렬) 조합으로 빠르고 확실하게 완료

#### 4. 토큰 절약하며 작업

**입력**: "eco: add input validation to all forms"

**효과**: ecomode가 토큰 효율적으로 병렬 실행하며 비용 절감

#### 5. 계획부터 차근차근

**입력**: "plan the e-commerce feature"

**진행**: 사용자 선호사항 인터뷰 → 계획서 생성 → 검토 및 조정 →
실행 (별도 명령)

[Top](#oh-my-claudecodeomc-개요)

---

## 6. 다른 문서 안내

### 스킬/에이전트 상세

**문서**: `oh-my-claudecode-skills-agents.md`

**내용**:
- 30개 스킬 전체 목록 및 트리거 조건
- 32개 에이전트 상세 설명 및 선택 가이드
- 도메인별 에이전트 매핑 (LOW/MEDIUM/HIGH)
- 작업 유형별 최적 에이전트 추천

### 프로토콜/고급 기능

**문서**: `oh-my-claudecode-protocols.md`

**내용**:
- 내부 프로토콜 (Broad Request Detection, Verification 등)
- 병렬화 규칙 및 백그라운드 실행
- 컨텍스트 지속성 (`<remember>` 태그)
- Continuation Enforcement (작업 완료 강제)
- 고급 기능 (Ultrapilot, Swarm, Pipeline, Verification Module 등)

[Top](#oh-my-claudecodeomc-개요)

---

## 참고 자료

**소스**: `~/.claude/CLAUDE.md` (OMC 전체 설정 및 규칙 정의)

**주요 섹션**:
- PART 1: Core Protocol - 위임 철학 및 규칙
- PART 2: User Experience - 자동 감지 및 매직 키워드
- PART 3: Complete Reference - 전체 스킬 및 에이전트 목록
- PART 4: New Features - v3.1~v3.4 신기능 (Notepad, Ultrapilot, Swarm 등)
- PART 5: Internal Protocols - 내부 동작 프로토콜
- PART 6: Announcements - 주요 동작 시 안내 메시지
- PART 7: Setup - 초기 설정 및 트러블슈팅

[Top](#oh-my-claudecodeomc-개요)
