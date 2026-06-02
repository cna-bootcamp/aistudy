# Oh My ClaudeCode 프로토콜 & 고급 기능

- [Oh My ClaudeCode 프로토콜 & 고급 기능](#oh-my-claudecode-프로토콜--고급-기능)
  - [1. 위임 우선 철학](#1-위임-우선-철학)
    - [1.1 핵심 규칙 4가지](#11-핵심-규칙-4가지)
    - [1.2 직접 수행 vs 위임 판단 기준](#12-직접-수행-vs-위임-판단-기준)
    - [1.3 필수 스킬 호출 패턴](#13-필수-스킬-호출-패턴)
    - [1.4 경로 기반 쓰기 규칙](#14-경로-기반-쓰기-규칙)
    - [1.5 스마트 모델 라우팅](#15-스마트-모델-라우팅)
  - [2. 검증 프로토콜](#2-검증-프로토콜)
    - [2.1 완료 전 검증 (Iron Law)](#21-완료-전-검증-iron-law)
    - [2.2 아키텍트 검증 (Mandatory)](#22-아키텍트-검증-mandatory)
    - [2.3 검증 모듈 (v3.4)](#23-검증-모듈-v34)
  - [3. 상태 관리](#3-상태-관리)
    - [3.1 디렉토리 구조](#31-디렉토리-구조)
    - [3.2 상태 파일 규칙](#32-상태-파일-규칙)
  - [4. Notepad Wisdom 시스템](#4-notepad-wisdom-시스템)
    - [4.1 개념](#41-개념)
    - [4.2 파일 구조](#42-파일-구조)
    - [4.3 API](#43-api)
  - [5. 컨텍스트 지속성](#5-컨텍스트-지속성)
    - [5.1 remember 태그 사용법](#51-remember-태그-사용법)
    - [5.2 저장 가이드라인](#52-저장-가이드라인)
  - [6. 병렬화 규칙](#6-병렬화-규칙)
    - [6.1 병렬 실행 조건](#61-병렬-실행-조건)
    - [6.2 백그라운드 vs 포그라운드](#62-백그라운드-vs-포그라운드)
  - [7. 계속 실행 강제](#7-계속-실행-강제)
    - [7.1 세션 종료 전 체크리스트](#71-세션-종료-전-체크리스트)
  - [8. 세션 재개](#8-세션-재개)
  - [9. 취소 프로토콜](#9-취소-프로토콜)
    - [9.1 통합 cancel 스킬](#91-통합-cancel-스킬)
    - [9.2 강제 취소 옵션](#92-강제-취소-옵션)
  - [10. 알림 프로토콜](#10-알림-프로토콜)
    - [10.1 주요 행동 활성화 시 알림 예시](#101-주요-행동-활성화-시-알림-예시)
  - [11. Broad Request 탐지](#11-broad-request-탐지)
    - [11.1 BROAD 판단 기준](#111-broad-판단-기준)
    - [11.2 BROAD 요청 처리 절차](#112-broad-요청-처리-절차)
  - [12. 위임 카테고리 (v3.1)](#12-위임-카테고리-v31)
    - [12.1 자동 매핑 테이블](#121-자동-매핑-테이블)
  - [13. 디렉토리 진단 도구 (v3.1)](#13-디렉토리-진단-도구-v31)
    - [13.1 전략](#131-전략)
    - [13.2 사용 시점](#132-사용-시점)
  - [14. 실행 모드 우선순위](#14-실행-모드-우선순위)
    - [14.1 키워드 충돌 해결 규칙](#141-키워드-충돌-해결-규칙)
    - [14.2 우선순위 테이블](#142-우선순위-테이블)
  - [15. AskUserQuestion 프로토콜](#15-askuserquestion-프로토콜)
    - [15.1 적용 대상](#151-적용-대상)
    - [15.2 질문 유형](#152-질문-유형)
  - [참고 자료](#참고-자료)

---

## 1. 위임 우선 철학

OMC의 핵심 철학은 **ORCHESTRATE specialists, not do work yourself**.
Orchestrator는 지휘자이며 연주자가 아님.

### 1.1 핵심 규칙 4가지

```
RULE 1: ALWAYS delegate substantive work to specialized agents
RULE 2: ALWAYS invoke appropriate skills for recognized patterns
RULE 3: NEVER do code changes directly - delegate to executor
RULE 4: NEVER complete without Architect verification
```

### 1.2 직접 수행 vs 위임 판단 기준

| 작업 | 직접 수행 | 위임 대상 |
|------|-----------|-----------|
| 파일 읽기 (컨텍스트 파악) | Yes | - |
| 빠른 상태 확인 | Yes | - |
| TODO 생성/업데이트 | Yes | - |
| 사용자 커뮤니케이션 | Yes | - |
| 간단한 질문 응답 | Yes | - |
| **단일 라인 코드 변경** | NEVER | `executor-low` |
| **다중 파일 변경** | NEVER | `executor` / `executor-high` |
| **복잡한 디버깅** | NEVER | `architect` |
| **UI/프론트엔드 작업** | NEVER | `designer` |
| **문서화** | NEVER | `writer` |
| **심층 분석** | NEVER | `architect` / `analyst` |
| **코드베이스 탐색** | NEVER | `explore` 시리즈 |
| **연구 태스크** | NEVER | `researcher` |
| **데이터 분석** | NEVER | `scientist` 시리즈 |
| **시각 분석** | NEVER | `vision` |

### 1.3 필수 스킬 호출 패턴

특정 패턴 감지 시 해당 스킬을 **반드시** 호출해야 함.

| 패턴 감지 | 필수 호출 스킬 |
|-----------|----------------|
| "autopilot", "build me", "I want a" | `autopilot` |
| 광범위/모호한 요청 | `plan` (explore 후) |
| "don't stop", "must complete", "ralph" | `ralph` |
| "ulw", "ultrawork" | `ultrawork` |
| "eco", "ecomode", "efficient", "save-tokens", "budget" | `ecomode` |
| "fast", "parallel" (명시적 모드 키워드 없음) | config 확인 → default 모드 |
| "ultrapilot", "parallel build", "swarm build" | `ultrapilot` |
| "swarm", "coordinated agents" | `swarm` |
| "pipeline", "chain agents" | `pipeline` |
| "plan this", "plan the" | `plan` |
| "ralplan" | `ralplan` |
| UI/컴포넌트/스타일 작업 | `frontend-ui-ux` (silent) |
| Git/commit 작업 | `git-master` (silent) |
| "analyze", "debug", "investigate" | `analyze` |
| "search", "find in codebase" | `deepsearch` |
| "research", "analyze data", "statistics" | `research` |
| "tdd", "test first", "red green" | `tdd` |
| "setup mcp", "configure mcp" | `mcp-setup` |
| "stop", "cancel", "abort" | `cancel` (unified) |

### 1.4 경로 기반 쓰기 규칙

소스 파일 직접 쓰기는 소프트 강제(soft enforcement) 적용.
감사 로그: `.omc/logs/delegation-audit.jsonl`

**허용 경로 (Direct Write OK)**

| 경로 | 용도 |
|------|------|
| `~/.claude/**` | 시스템 설정 |
| `.omc/**` | OMC 상태 및 설정 |
| `.claude/**` | 로컬 Claude 설정 |
| `CLAUDE.md` | 사용자 지침 |
| `AGENTS.md` | AI 문서 |

**경고 경로 (Should Delegate)**

| 확장자 | 타입 |
|--------|------|
| `.ts`, `.tsx`, `.js`, `.jsx` | JavaScript/TypeScript |
| `.py` | Python |
| `.go`, `.rs`, `.java` | 컴파일 언어 |
| `.c`, `.cpp`, `.h` | C/C++ |
| `.svelte`, `.vue` | 프론트엔드 프레임워크 |

**소스 파일 변경 위임 방법**

```python
Task(subagent_type="oh-my-claudecode:executor",
     model="sonnet",
     prompt="Edit src/file.ts to add validation...")
```

### 1.5 스마트 모델 라우팅

위임 시 **항상** `model` 파라미터를 명시적으로 전달하여 토큰 절약.

| 작업 복잡도 | 모델 | 사용 시점 |
|-------------|------|-----------|
| 간단한 조회 | `haiku` | "이것이 무엇을 반환하나?", "X의 정의 찾기" |
| 표준 작업 | `sonnet` | "에러 핸들링 추가", "기능 구현" |
| 복잡한 추론 | `opus` | "레이스 컨디션 디버그", "아키텍처 리팩토링" |

[Top](#oh-my-claudecode-프로토콜--고급-기능)

---

## 2. 검증 프로토콜

### 2.1 완료 전 검증 (Iron Law)

**Iron Law**: NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE

에이전트가 "done", "fixed", "complete"라고 주장하기 전 **반드시** 실행해야 할 4단계.

| 단계 | 액션 |
|------|------|
| 1. IDENTIFY | 이 주장을 증명할 명령어는 무엇인가? |
| 2. RUN | 검증 명령 실행 |
| 3. READ | 출력 확인 - 실제로 통과했는가? |
| 4. CLAIM | 증거와 함께 주장 |

**Red Flags (에이전트는 멈추고 검증해야 함)**

- "should", "probably", "seems to" 같은 표현 사용
- 검증 전 만족감 표현
- 최신 테스트/빌드 출력 없이 완료 주장

**증거 유형**

| 주장 | 필수 증거 |
|------|-----------|
| "Fixed" | 이제 통과하는 테스트 |
| "Implemented" | lsp_diagnostics clean + 빌드 통과 |
| "Refactored" | 모든 테스트 여전히 통과 |
| "Debugged" | file:line과 함께 근본 원인 식별 |

### 2.2 아키텍트 검증 (Mandatory)

**HARD RULE: Architect 승인 없이 완료 주장 금지**

```
1. 모든 작업 완료
2. Architect 호출: Task(subagent_type="oh-my-claudecode:architect",
                        model="opus",
                        prompt="Verify...")
3. 응답 대기
4. APPROVED → 완료 출력
5. REJECTED → 이슈 수정 및 재검증
```

### 2.3 검증 모듈 (v3.4)

워크플로우를 위한 재사용 가능 검증 프로토콜.

**표준 검사 항목**

- BUILD: 빌드 통과 여부
- TEST: 테스트 통과 여부
- LINT: 린트 통과 여부
- FUNCTIONALITY: 요청 기능 동작 여부
- ARCHITECT: 아키텍트 검증 통과 여부
- TODO: TODO 리스트 완료 여부
- ERROR_FREE: 에러 0건 여부

**증거 유효성 검사**

- 증거 신선도: 5분 이내
- 통과/실패 추적

[Top](#oh-my-claudecode-프로토콜--고급-기능)

---

## 3. 상태 관리

### 3.1 디렉토리 구조

`.omc/` 디렉토리 내 표준 구조.

```
.omc/
├── state/
│   ├── ultrapilot-state.json       # Ultrapilot 세션 상태
│   ├── ultrapilot-ownership.json   # 파일 소유권
│   └── subagent-tracking.json      # 서브에이전트 추적
├── plans/                           # 작업 계획서
├── sessions/                        # 세션 데이터
└── logs/
    └── delegation-audit.jsonl       # 위임 감사 로그
```

### 3.2 상태 파일 규칙

**표준 경로**

- 로컬: `.omc/state/{name}.json`
- 글로벌: `~/.omc/state/{name}.json`

**레거시 위치 자동 마이그레이션**

이전 위치의 상태 파일은 읽기 시 자동으로 표준 경로로 이동됨.

[Top](#oh-my-claudecode-프로토콜--고급-기능)

---

## 4. Notepad Wisdom 시스템

### 4.1 개념

Plan-scoped wisdom capture.
계획 범위 내에서 학습한 내용, 결정사항, 이슈, 문제를 체계적으로 기록.

### 4.2 파일 구조

**디렉토리**: `.omc/notepads/{plan-name}/`

| 파일 | 목적 |
|------|------|
| `learnings.md` | 기술적 발견 및 패턴 |
| `decisions.md` | 아키텍처 및 설계 결정 |
| `issues.md` | 알려진 이슈 및 해결 방법 |
| `problems.md` | 블로커 및 과제 |

### 4.3 API

| 함수 | 설명 |
|------|------|
| `initPlanNotepad()` | 계획별 노트패드 초기화 |
| `addLearning()` | 학습 내용 추가 |
| `addDecision()` | 결정 사항 추가 |
| `addIssue()` | 이슈 추가 |
| `addProblem()` | 문제 추가 |
| `getWisdomSummary()` | 지혜 요약 조회 |
| `readPlanWisdom()` | 계획 지혜 읽기 |

[Top](#oh-my-claudecode-프로토콜--고급-기능)

---

## 5. 컨텍스트 지속성

### 5.1 remember 태그 사용법

대화 압축(conversation compaction)에서 살아남기 위한 `<remember>` 태그 사용.

| 태그 | 수명 | 용도 |
|------|------|------|
| `<remember>info</remember>` | 7일 | 세션별 컨텍스트 |
| `<remember priority>info</remember>` | 영구 | 중요 패턴/사실 |

### 5.2 저장 가이드라인

**DO (저장해야 할 것)**

- 아키텍처 결정
- 에러 해결 방법
- 사용자 선호도

**DON'T (저장하지 말아야 할 것)**

- 진행상황 (TODO 사용)
- 임시 상태
- AGENTS.md에 이미 있는 정보

[Top](#oh-my-claudecode-프로토콜--고급-기능)

---

## 6. 병렬화 규칙

### 6.1 병렬 실행 조건

| 조건 | 실행 방식 |
|------|-----------|
| 2개 이상의 독립 태스크 + 30초 이상 작업 | 병렬 실행 |
| 순차 의존성 존재 | 순서대로 실행 |
| 빠른 태스크 (10초 미만) | 직접 수행 (read, status check) |

### 6.2 백그라운드 vs 포그라운드

**백그라운드 실행 (`run_in_background: true`)**

- npm install, pip install, cargo build
- npm run build, make, tsc
- npm test, pytest, cargo test

**포그라운드 실행 (블로킹)**

- git status, ls, pwd
- 파일 읽기/편집
- 빠른 명령어

**최대 동시 백그라운드 태스크**: 5개

[Top](#oh-my-claudecode-프로토콜--고급-기능)

---

## 7. 계속 실행 강제

Orchestrator는 작업 목록에 **바인드**됨.
모든 태스크가 COMPLETE 상태가 될 때까지 멈추지 않음.

### 7.1 세션 종료 전 체크리스트

```
- [ ] TODO LIST: Zero pending/in_progress tasks
- [ ] FUNCTIONALITY: All requested features work
- [ ] TESTS: All tests pass (if applicable)
- [ ] ERRORS: Zero unaddressed errors
- [ ] ARCHITECT: Verification passed
```

**하나라도 미체크 → 작업 계속**

[Top](#oh-my-claudecode-프로토콜--고급-기능)

---

## 8. 세션 재개

백그라운드 에이전트는 `resume-session` 도구를 통해 전체 컨텍스트와 함께
재개 가능.

**사용법**

- `resume` 파라미터에 에이전트 ID 전달
- 이전 컨텍스트 복원

[Top](#oh-my-claudecode-프로토콜--고급-기능)

---

## 9. 취소 프로토콜

### 9.1 통합 cancel 스킬

사용자가 "stop", "cancel", "abort" 입력 시 → 활성 모드를 자동 감지하여
통합 취소 스킬 호출.

**감지 및 취소 대상 모드**

- autopilot
- ultrapilot
- ralph
- ultrawork
- ultraqa
- ecomode
- swarm
- pipeline

**플래닝 중**: 인터뷰 종료
**불명확**: 사용자에게 질문

### 9.2 강제 취소 옵션

- `--force` 또는 `--all`: 모든 상태 일괄 제거

[Top](#oh-my-claudecode-프로토콜--고급-기능)

---

## 10. 알림 프로토콜

주요 행동 활성화 시 사용자에게 알림하여 피처 요청 없이 정보 제공.

### 10.1 주요 행동 활성화 시 알림 예시

```
"I'm activating autopilot for full autonomous execution from idea to
working code."

"I'm activating ralph-loop to ensure this task completes fully."

"I'm activating ultrawork for maximum parallel execution."

"I'm starting a planning session - I'll interview you about requirements."

"I'm delegating this to the architect agent for deep analysis."
```

[Top](#oh-my-claudecode-프로토콜--고급-기능)

---

## 11. Broad Request 탐지

### 11.1 BROAD 판단 기준

다음 중 **하나라도** 해당 시 BROAD 요청으로 판단:

- 모호한 동사 사용: "improve", "enhance", "fix", "refactor" (구체적 타겟 없이)
- 구체적 파일/함수 언급 없음
- 3개 이상의 무관한 영역 건드림
- 명확한 산출물 없는 단일 문장

### 11.2 BROAD 요청 처리 절차

```
1. explore 에이전트 호출 → 코드베이스 이해
2. (선택) architect 호출 → 가이드 확보
3. plan 스킬 호출 (수집된 컨텍스트와 함께)
4. plan 스킬은 사용자 선호 질문만 수행
```

[Top](#oh-my-claudecode-프로토콜--고급-기능)

---

## 12. 위임 카테고리 (v3.1)

의미론적 태스크 카테고리화.
모델 티어, 온도, 생각 예산으로 자동 매핑.

### 12.1 자동 매핑 테이블

| 카테고리 | 티어 | 온도 | Thinking | 사용처 |
|----------|------|------|----------|--------|
| `visual-engineering` | HIGH | 0.7 | high | UI/UX, 프론트엔드, 디자인 시스템 |
| `ultrabrain` | HIGH | 0.3 | max | 복잡 추론, 아키텍처, 심층 디버깅 |
| `artistry` | MEDIUM | 0.9 | medium | 창의적 솔루션, 브레인스토밍 |
| `quick` | LOW | 0.1 | low | 간단 조회, 기본 작업 |
| `writing` | MEDIUM | 0.5 | medium | 문서화, 기술 작성 |

**자동 탐지**: 프롬프트 키워드로부터 카테고리 자동 탐지.

[Top](#oh-my-claudecode-프로토콜--고급-기능)

---

## 13. 디렉토리 진단 도구 (v3.1)

`lsp_diagnostics_directory` 도구를 통한 프로젝트 레벨 타입 체킹.

### 13.1 전략

| 전략 | 설명 |
|------|------|
| `auto` (기본) | 최적 전략 자동 선택, tsconfig.json 존재 시 tsc 선호 |
| `tsc` | 빠름, TypeScript 컴파일러 사용 |
| `lsp` | 폴백, Language Server를 통한 파일 순회 |

### 13.2 사용 시점

- 커밋 전 전체 프로젝트 에러 체크
- 리팩토링 후 검증

[Top](#oh-my-claudecode-프로토콜--고급-기능)

---

## 14. 실행 모드 우선순위

사용자가 "parallel" 또는 "fast"를 명시적 모드 키워드 **없이** 사용할 때.

### 14.1 키워드 충돌 해결 규칙

1. **명시적 모드 키워드 우선 확인**:
   - "ulw", "ultrawork" → 즉시 `ultrawork` 활성화
   - "eco", "ecomode", "efficient", "save-tokens", "budget" → 즉시 `ecomode`
     활성화

2. **명시적 키워드 없으면 설정 파일 확인**:
   ```bash
   CONFIG_FILE="$HOME/.claude/.omc-config.json"
   if [[ -f "$CONFIG_FILE" ]]; then
     DEFAULT_MODE=$(cat "$CONFIG_FILE" | jq -r '.defaultExecutionMode // "ultrawork"')
   else
     DEFAULT_MODE="ultrawork"
   fi
   ```

3. **해결된 모드 활성화**:
   - `"ultrawork"` → ultrawork 스킬
   - `"ecomode"` → ecomode 스킬

### 14.2 우선순위 테이블

| 우선순위 | 조건 | 결과 |
|----------|------|------|
| 1 (최고) | 두 명시적 키워드 모두 존재 | `ecomode` 승리 (더 제한적) |
| 2 | 단일 명시적 키워드 | 해당 모드 승리 |
| 3 | "fast"/"parallel"만 있음 | 설정 파일에서 읽기 |
| 4 (최하) | 설정 파일 없음 | 기본값 `ultrawork` |

**사용자 선호 설정**: `/oh-my-claudecode:omc-setup`

[Top](#oh-my-claudecode-프로토콜--고급-기능)

---

## 15. AskUserQuestion 프로토콜

플래닝/인터뷰 모드에서는 `AskUserQuestion` 도구를 사용하여 선호도 질문.
클릭 가능한 UI로 빠른 사용자 응답 가능.

### 15.1 적용 대상

- Plan 스킬
- 플래닝 인터뷰

### 15.2 질문 유형

- Preference (선호도)
- Requirement (요구사항)
- Scope (범위)
- Constraint (제약사항)
- Risk tolerance (리스크 허용도)

[Top](#oh-my-claudecode-프로토콜--고급-기능)

---

## 참고 자료

- 소스: `~/.claude/CLAUDE.md` (프로토콜 전체 정의)
- 소스: 프로젝트 루트 `CLAUDE.md`

[Top](#oh-my-claudecode-프로토콜--고급-기능)
