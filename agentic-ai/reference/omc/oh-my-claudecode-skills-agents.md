# Oh My ClaudeCode 스킬 & 에이전트 레퍼런스

- [Oh My ClaudeCode 스킬 & 에이전트 레퍼런스](#oh-my-claudecode-스킬--에이전트-레퍼런스)
  - [1. 실행 모드 개요](#1-실행-모드-개요)
    - [1.1 모드 선택 가이드](#11-모드-선택-가이드)
    - [1.2 모드 조합 예시](#12-모드-조합-예시)
  - [2. 주요 실행 모드 상세](#2-주요-실행-모드-상세)
    - [2.1 Autopilot](#21-autopilot)
    - [2.2 Ralph (지속 실행)](#22-ralph-지속-실행)
    - [2.3 Ultrawork (병렬 실행)](#23-ultrawork-병렬-실행)
    - [2.4 Ecomode (토큰 절약)](#24-ecomode-토큰-절약)
    - [2.5 Ultrapilot (병렬 Autopilot)](#25-ultrapilot-병렬-autopilot)
    - [2.6 Swarm (N개 에이전트 협업)](#26-swarm-n개-에이전트-협업)
    - [2.7 Pipeline (순차 체이닝)](#27-pipeline-순차-체이닝)
  - [3. 스킬 전체 목록](#3-스킬-전체-목록)
    - [3.1 자동 트리거 키워드 매핑](#31-자동-트리거-키워드-매핑)
  - [4. 에이전트 전체 목록](#4-에이전트-전체-목록)
    - [4.1 에이전트 티어 시스템](#41-에이전트-티어-시스템)
    - [4.2 도메인별 에이전트](#42-도메인별-에이전트)
    - [4.3 에이전트 선택 가이드](#43-에이전트-선택-가이드)
  - [5. 위임 카테고리](#5-위임-카테고리)
    - [5.1 카테고리별 설정](#51-카테고리별-설정)
    - [5.2 자동 감지 키워드](#52-자동-감지-키워드)
  - [6. 스마트 모델 라우팅](#6-스마트-모델-라우팅)
    - [6.1 모델 선택 기준](#61-모델-선택-기준)
    - [6.2 기본 실행 모드 설정](#62-기본-실행-모드-설정)
    - [6.3 키워드 충돌 해결 우선순위](#63-키워드-충돌-해결-우선순위)
  - [7. 실무 활용 예시](#7-실무-활용-예시)
    - [7.1 새 기능 개발](#71-새-기능-개발)
    - [7.2 버그 수정](#72-버그-수정)
    - [7.3 대규모 리팩토링](#73-대규모-리팩토링)
    - [7.4 코드 리뷰](#74-코드-리뷰)
    - [7.5 토큰 절약](#75-토큰-절약)
  - [참고 자료](#참고-자료)

OMC(Oh My ClaudeCode)의 스킬 기반 멀티 에이전트 오케스트레이션 시스템을
이해하고 활용하기 위한 전체 레퍼런스.

---

## 1. 실행 모드 개요

7가지 주요 실행 모드를 통해 작업 스타일과 리소스 제약에 최적화.

| 모드 | 용도 | 트리거 키워드 | 특징 |
|------|------|---------------|------|
| **autopilot** | 완전 자율 실행 | "autopilot", "build me", "I want a" | 기획부터 배포까지 자동화 |
| **ralph** | 검증 완료까지 지속 | "don't stop", "must complete", "ralph" | 중단 없이 완료 보장 |
| **ultrawork** | 최대 병렬 실행 | "ulw", "ultrawork", "fast"(설정) | 2개 이상 태스크 동시 처리 |
| **ecomode** | 토큰 절약 병렬 | "eco", "ecomode", "efficient", "budget" | 토큰 효율적 병렬 실행 |
| **ultrapilot** | 병렬 autopilot | "ultrapilot", "parallel build", "swarm build" | 5개 워커로 3~5배 속도 |
| **swarm** | N개 에이전트 협업 | "swarm N agents" | 공유 태스크 풀 방식 |
| **pipeline** | 순차 체이닝 | "pipeline", "chain agents" | 단계별 데이터 전달 |

### 1.1 모드 선택 가이드

```
작업 특성?
    |
    +-- 완전 자동화 필요 --> autopilot / ultrapilot
    |
    +-- 반드시 완료 필요 --> ralph
    |
    +-- 여러 독립 작업 --> ultrawork (빠름) / ecomode (토큰 절약)
    |
    +-- 순차 단계 필요 --> pipeline
    |
    +-- N개 에이전트 조율 --> swarm
```

### 1.2 모드 조합 예시

| 조합 | 명령 예시 | 효과 |
|------|-----------|------|
| ralph + ultrawork | "ralph ulw: migrate database" | 병렬 실행 + 완료 보장 |
| ralph + autopilot | "ralph autopilot: build API" | 자율 실행 + 완료 보장 |
| ecomode + ralph | "eco ralph: fix all errors" | 토큰 절약 + 완료 보장 |

[Top](#oh-my-claudecode-스킬--에이전트-레퍼런스)

---

## 2. 주요 실행 모드 상세

### 2.1 Autopilot

**개념**
플래그십 기능으로 아이디어부터 작동하는 코드까지 완전 자율 실행.

**트리거**
- "autopilot"
- "build me"
- "I want a"

**동작 방식**
1. 자동 기획 및 요구사항 수집
2. 여러 전문 에이전트 병렬 실행
3. 지속적 검증 및 테스트
4. 완료까지 자체 수정
5. 수동 개입 불필요

**예시**
```
사용자: "autopilot: build a todo app"
시스템: → Plan → Execute (병렬) → Test → Fix → Verify → Complete
```

### 2.2 Ralph (지속 실행)

**개념**
검증 완료까지 중단 없이 반복 실행하여 완료를 보장하는 지속성 모드.

**트리거**
- "don't stop"
- "must complete"
- "ralph"

**ralph-init**
구조화된 ralph 세션을 위한 PRD(Product Requirements Document) 초기화.

**예시**
```
사용자: "ralph: refactor authentication module"
시스템: → Work → Verify → Fix → Verify → ... → APPROVED (Architect)
```

### 2.3 Ultrawork (병렬 실행)

**개념**
2개 이상의 독립적 태스크를 동시 병렬 처리하여 속도를 최대화.

**트리거**
- "ulw"
- "ultrawork"
- "fast"(설정 기본값인 경우)
- "parallel"(설정 기본값인 경우)

**병렬화 규칙**
- 2개 이상 독립 태스크 + 작업 시간 >30초 → 병렬 실행
- 순차 의존성 있음 → 순서대로 실행
- 빠른 작업(<10초) → 직접 실행

**예시**
```
사용자: "ulw fix all TypeScript errors"
시스템: → [Task1: file-a.ts] | [Task2: file-b.ts] | [Task3: file-c.ts] (동시 실행)
```

### 2.4 Ecomode (토큰 절약)

**개념**
Ultrawork의 토큰 효율적 버전으로 병렬 실행하되 토큰 사용량 최소화.

**트리거**
- "eco"
- "ecomode"
- "efficient"
- "save-tokens"
- "budget"

**Ultrawork 대비 차이**
- 더 작은 모델 우선 사용 (haiku 우선)
- 병렬 태스크 수 제한
- 토큰 사용량 모니터링

**예시**
```
사용자: "eco fix all errors"
시스템: → 병렬 실행 (haiku 우선) + 토큰 사용량 추적
```

### 2.5 Ultrapilot (병렬 Autopilot)

**개념**
최대 5개의 동시 워커로 autopilot 작업을 3~5배 빠르게 수행.

**트리거**
- "ultrapilot"
- "parallel build"
- "swarm build"

**동작 방식**
1. 태스크 분해 엔진: 복잡한 작업을 병렬 가능한 서브태스크로 분해
2. 파일 소유권 조정: 겹치지 않는 파일 세트를 워커에 할당
3. 워커 병렬 실행: 조정자가 공유 파일 관리
4. 결과 통합: 충돌 감지 및 병합

**적합 작업**
- 다중 컴포넌트 시스템
- 풀스택 앱
- 대규모 리팩토링

**상태 파일**
- `.omc/state/ultrapilot-state.json`: 세션 상태
- `.omc/state/ultrapilot-ownership.json`: 파일 소유권

### 2.6 Swarm (N개 에이전트 협업)

**개념**
공유 태스크 풀에서 N개의 에이전트가 원자적으로 태스크를 클레임하여 협업.

**사용법**
```
/swarm 5:executor "fix all TypeScript errors"
```

**기능**
- 공유 태스크 리스트: pending/claimed/done 상태
- 5분 타임아웃: 태스크당 5분 제한, 초과 시 자동 릴리스
- 깔끔한 완료: 모든 태스크 완료 시 자동 종료

**예시**
```
사용자: /swarm 3:executor "implement REST API endpoints"
시스템:
  - Agent 1: Claim /users endpoint → Work → Done
  - Agent 2: Claim /posts endpoint → Work → Done
  - Agent 3: Claim /auth endpoint → Work → Done
```

### 2.7 Pipeline (순차 체이닝)

**개념**
에이전트를 순차 체이닝하여 단계별 데이터를 전달하는 파이프라인.

**빌트인 프리셋**

| 프리셋 | 단계 | 용도 |
|--------|------|------|
| `review` | explore → architect → critic → executor | 코드 리뷰 및 개선 |
| `implement` | planner → executor → tdd-guide | 기능 구현 |
| `debug` | explore → architect → build-fixer | 오류 수정 |
| `research` | parallel(researcher, explore) → architect → writer | 리서치 및 문서화 |
| `refactor` | explore → architect-medium → executor-high → qa-tester | 리팩토링 |
| `security` | explore → security-reviewer → executor → security-reviewer-low | 보안 검토 및 수정 |

**커스텀 파이프라인**
```
/pipeline explore:haiku -> architect:opus -> executor:sonnet
```

[Top](#oh-my-claudecode-스킬--에이전트-레퍼런스)

---

## 3. 스킬 전체 목록

30개의 스킬이 자동 트리거 또는 수동 호출로 동작.

| 스킬 | 용도 | 자동 트리거 | 수동 커맨드 |
|------|------|-------------|-------------|
| `autopilot` | 아이디어부터 작동 코드까지 완전 자율 실행 | "autopilot", "build me", "I want a" | `/oh-my-claudecode:autopilot` |
| `orchestrate` | 핵심 멀티 에이전트 오케스트레이션 | 항상 활성 | - |
| `ralph` | 검증 완료까지 지속 실행 | "don't stop", "must complete" | `/oh-my-claudecode:ralph` |
| `ultrawork` | 최대 병렬 실행 | "ulw", "ultrawork", "fast"/"parallel"(설정) | `/oh-my-claudecode:ultrawork` |
| `plan` | 인터뷰 워크플로우 기획 세션 | "plan this", "plan the", 광범위 요청 | `/oh-my-claudecode:plan` |
| `ralplan` | 반복 기획 (Planner+Architect+Critic) | "ralplan" | `/oh-my-claudecode:ralplan` |
| `review` | Critic으로 플랜 리뷰 | "review plan" | `/oh-my-claudecode:review` |
| `analyze` | 깊은 분석/조사 | "analyze", "debug", "why" | `/oh-my-claudecode:analyze` |
| `deepsearch` | 철저한 코드베이스 검색 | "search", "find", "where" | `/oh-my-claudecode:deepsearch` |
| `deepinit` | AGENTS.md 계층 생성 | "index codebase" | `/oh-my-claudecode:deepinit` |
| `frontend-ui-ux` | UI용 디자인 감각 | UI/컴포넌트 컨텍스트 | (자동) |
| `git-master` | Git 전문성, 원자적 커밋 | git/commit 컨텍스트 | (자동) |
| `ultraqa` | QA 사이클: test/fix/반복 | "test", "QA", "verify" | `/oh-my-claudecode:ultraqa` |
| `learner` | 세션에서 재사용 가능한 스킬 추출 | "extract skill" | `/oh-my-claudecode:learner` |
| `note` | 메모리용 노트패드에 저장 | "remember", "note" | `/oh-my-claudecode:note` |
| `hud` | HUD 상태 라인 설정 | - | `/oh-my-claudecode:hud` |
| `doctor` | 설치 문제 진단 | - | `/oh-my-claudecode:doctor` |
| `help` | OMC 사용 가이드 표시 | - | `/oh-my-claudecode:help` |
| `omc-setup` | 일회성 설정 마법사 | - | `/oh-my-claudecode:omc-setup` |
| `ralph-init` | 구조화 ralph용 PRD 초기화 | - | `/oh-my-claudecode:ralph-init` |
| `release` | 자동화된 릴리스 워크플로우 | - | `/oh-my-claudecode:release` |
| `ultrapilot` | 병렬 autopilot (3~5배 빠름) | "ultrapilot", "parallel build", "swarm build" | `/oh-my-claudecode:ultrapilot` |
| `swarm` | 태스크 클레임 방식 N개 조율 에이전트 | "swarm N agents" | `/oh-my-claudecode:swarm` |
| `pipeline` | 순차 에이전트 체이닝 | "pipeline", "chain" | `/oh-my-claudecode:pipeline` |
| `cancel` | 모든 모드에 대한 통합 취소 | "stop", "cancel" | `/oh-my-claudecode:cancel` |
| `ecomode` | 토큰 효율적 병렬 실행 | "eco", "efficient", "budget" | `/oh-my-claudecode:ecomode` |
| `research` | 병렬 scientist 오케스트레이션 | "research", "analyze data", "statistics" | `/oh-my-claudecode:research` |
| `tdd` | TDD 강제: 테스트 우선 개발 | "tdd", "test first" | `/oh-my-claudecode:tdd` |
| `mcp-setup` | 확장 기능용 MCP 서버 설정 | "setup mcp", "configure mcp" | `/oh-my-claudecode:mcp-setup` |
| `learn-about-omc` | 사용 패턴 분석 | - | `/oh-my-claudecode:learn-about-omc` |

### 3.1 자동 트리거 키워드 매핑

| 패턴 감지 | 자동 호출 스킬 |
|-----------|----------------|
| "autopilot", "build me", "I want a" | `autopilot` |
| 광범위/모호한 요청 | `plan` (explore 후) |
| "don't stop", "must complete", "ralph" | `ralph` |
| "ulw", "ultrawork" | `ultrawork` |
| "eco", "ecomode", "efficient", "save-tokens", "budget" | `ecomode` |
| "fast", "parallel" (명시 키워드 없음) | 설정 파일 기본값 확인 |
| "ultrapilot", "parallel build", "swarm build" | `ultrapilot` |
| "swarm", "coordinated agents" | `swarm` |
| "pipeline", "chain agents" | `pipeline` |
| "plan this", "plan the" | `plan` |
| "ralplan" | `ralplan` |
| UI/컴포넌트/스타일링 작업 | `frontend-ui-ux` |
| Git/커밋 작업 | `git-master` |
| "analyze", "debug", "investigate" | `analyze` |
| "search", "find in codebase" | `deepsearch` |
| "research", "analyze data", "statistics" | `research` |
| "tdd", "test first", "red green" | `tdd` |
| "setup mcp", "configure mcp" | `mcp-setup` |
| "stop", "cancel", "abort" | `cancel` |

[Top](#oh-my-claudecode-스킬--에이전트-레퍼런스)

---

## 4. 에이전트 전체 목록

32개의 전문 에이전트가 도메인별, 티어별로 구성.
항상 `oh-my-claudecode:` 접두사 사용.

### 4.1 에이전트 티어 시스템

| 티어 | 모델 | 용도 | 특징 |
|------|------|------|------|
| **LOW** | Haiku | 간단한 작업 | 빠르고 저렴 |
| **MEDIUM** | Sonnet | 표준 작업 | 균형잡힌 성능 |
| **HIGH** | Opus | 복잡한 분석/아키텍처 | 최고 품질 추론 |

### 4.2 도메인별 에이전트

16개 도메인, 32개 에이전트 전체 목록.

| 도메인 | LOW (Haiku) | MEDIUM (Sonnet) | HIGH (Opus) |
|--------|-------------|-----------------|-------------|
| **Analysis** | `architect-low` | `architect-medium` | `architect` |
| **Execution** | `executor-low` | `executor` | `executor-high` |
| **Search** | `explore` | `explore-medium` | `explore-high` |
| **Research** | `researcher-low` | `researcher` | - |
| **Frontend** | `designer-low` | `designer` | `designer-high` |
| **Docs** | `writer` | - | - |
| **Visual** | - | `vision` | - |
| **Planning** | - | - | `planner` |
| **Critique** | - | - | `critic` |
| **Pre-Planning** | - | - | `analyst` |
| **Testing** | - | `qa-tester` | `qa-tester-high` |
| **Security** | `security-reviewer-low` | - | `security-reviewer` |
| **Build** | `build-fixer-low` | `build-fixer` | - |
| **TDD** | `tdd-guide-low` | `tdd-guide` | - |
| **Code Review** | `code-reviewer-low` | - | `code-reviewer` |
| **Data Science** | `scientist-low` | `scientist` | `scientist-high` |

**에이전트 상세**

| 에이전트 | 티어 | 역할 |
|----------|------|------|
| `architect-low` | LOW | 간단한 이슈 디버깅 |
| `architect-medium` | MEDIUM | 중급 아키텍처 분석 |
| `architect` | HIGH | 복잡한 이슈 디버깅, 아키텍처 설계 |
| `executor-low` | LOW | 간단한 코드 변경 |
| `executor` | MEDIUM | 기능 구현 |
| `executor-high` | HIGH | 복잡한 리팩토링 |
| `explore` | LOW | 빠른 코드 탐색 |
| `explore-medium` | MEDIUM | 파일/패턴 검색 |
| `explore-high` | HIGH | 복잡한 아키텍처 검색 |
| `researcher-low` | LOW | 빠른 문서 확인 |
| `researcher` | MEDIUM | 문서/API 리서치 |
| `designer-low` | LOW | 간단한 UI 수정 |
| `designer` | MEDIUM | UI 컴포넌트 개발 |
| `designer-high` | HIGH | 복잡한 UI 시스템 설계 |
| `writer` | LOW | 문서/주석 작성 |
| `vision` | MEDIUM | 이미지/다이어그램 분석 |
| `planner` | HIGH | 전략적 기획 |
| `critic` | HIGH | 플랜 리뷰/비평 |
| `analyst` | HIGH | 사전 기획 분석 |
| `qa-tester` | MEDIUM | CLI 대화형 테스트 |
| `qa-tester-high` | HIGH | 복잡한 테스트 시나리오 |
| `security-reviewer-low` | LOW | 빠른 보안 스캔 |
| `security-reviewer` | HIGH | 보안 리뷰 |
| `build-fixer-low` | LOW | 간단한 빌드 수정 |
| `build-fixer` | MEDIUM | 빌드 오류 수정 |
| `tdd-guide-low` | LOW | 빠른 테스트 제안 |
| `tdd-guide` | MEDIUM | TDD 워크플로우 |
| `code-reviewer-low` | LOW | 빠른 코드 체크 |
| `code-reviewer` | HIGH | 코드 리뷰 |
| `scientist-low` | LOW | 빠른 데이터 확인 |
| `scientist` | MEDIUM | 데이터 분석/통계 |
| `scientist-high` | HIGH | 복잡한 ML/가설 검증 |

### 4.3 에이전트 선택 가이드

시나리오별 최적 에이전트.

| 작업 유형 | 최적 에이전트 | 모델 |
|-----------|---------------|------|
| 빠른 코드 탐색 | `explore` | haiku |
| 파일/패턴 검색 | `explore` 또는 `explore-medium` | haiku/sonnet |
| 복잡한 아키텍처 검색 | `explore-high` | opus |
| 간단한 코드 변경 | `executor-low` | haiku |
| 기능 구현 | `executor` | sonnet |
| 복잡한 리팩토링 | `executor-high` | opus |
| 간단한 이슈 디버깅 | `architect-low` | haiku |
| 복잡한 이슈 디버깅 | `architect` | opus |
| UI 컴포넌트 | `designer` | sonnet |
| 복잡한 UI 시스템 | `designer-high` | opus |
| 문서/주석 작성 | `writer` | haiku |
| 문서/API 리서치 | `researcher` | sonnet |
| 이미지/다이어그램 분석 | `vision` | sonnet |
| 전략적 기획 | `planner` | opus |
| 플랜 리뷰/비평 | `critic` | opus |
| 사전 기획 분석 | `analyst` | opus |
| CLI 대화형 테스트 | `qa-tester` | sonnet |
| 보안 리뷰 | `security-reviewer` | opus |
| 빠른 보안 스캔 | `security-reviewer-low` | haiku |
| 빌드 오류 수정 | `build-fixer` | sonnet |
| 간단한 빌드 수정 | `build-fixer-low` | haiku |
| TDD 워크플로우 | `tdd-guide` | sonnet |
| 빠른 테스트 제안 | `tdd-guide-low` | haiku |
| 코드 리뷰 | `code-reviewer` | opus |
| 빠른 코드 체크 | `code-reviewer-low` | haiku |
| 데이터 분석/통계 | `scientist` | sonnet |
| 빠른 데이터 확인 | `scientist-low` | haiku |
| 복잡한 ML/가설 검증 | `scientist-high` | opus |

[Top](#oh-my-claudecode-스킬--에이전트-레퍼런스)

---

## 5. 위임 카테고리

태스크 의미론적 분류로 모델 티어, 온도, 씽킹 버짓 자동 매핑.

### 5.1 카테고리별 설정

| 카테고리 | 티어 | 온도 | 씽킹 버짓 | 용도 |
|----------|------|------|-----------|------|
| `visual-engineering` | HIGH | 0.7 | high | UI/UX, 프론트엔드, 디자인 시스템 |
| `ultrabrain` | HIGH | 0.3 | max | 복잡한 추론, 아키텍처, 깊은 디버깅 |
| `artistry` | MEDIUM | 0.9 | medium | 창의적 솔루션, 브레인스토밍 |
| `quick` | LOW | 0.1 | low | 간단한 조회, 기본 작업 |
| `writing` | MEDIUM | 0.5 | medium | 문서화, 기술 문서 작성 |

### 5.2 자동 감지 키워드

카테고리는 프롬프트 키워드에서 자동 감지.

| 카테고리 | 감지 키워드 예시 |
|----------|------------------|
| `visual-engineering` | "UI", "component", "frontend", "design system" |
| `ultrabrain` | "architecture", "refactor", "debug race condition" |
| `artistry` | "brainstorm", "creative", "innovative solution" |
| `quick` | "what does", "find definition", "quick check" |
| `writing` | "document", "write docs", "technical writing" |

[Top](#oh-my-claudecode-스킬--에이전트-레퍼런스)

---

## 6. 스마트 모델 라우팅

### 6.1 모델 선택 기준

위임 시 항상 `model` 파라미터를 명시적으로 전달하여 토큰 절약.

| 작업 복잡도 | 모델 | 사용 시점 |
|-------------|------|-----------|
| 간단한 조회 | `haiku` | "이게 뭘 반환하나?", "X의 정의 찾기" |
| 표준 작업 | `sonnet` | "에러 핸들링 추가", "기능 구현" |
| 복잡한 추론 | `opus` | "레이스 컨디션 디버깅", "아키텍처 리팩토링" |

### 6.2 기본 실행 모드 설정

사용자가 "parallel" 또는 "fast"만 말할 때(명시적 모드 키워드 없음):

**설정 파일 확인**
```bash
CONFIG_FILE="$HOME/.claude/.omc-config.json"
if [[ -f "$CONFIG_FILE" ]]; then
  DEFAULT_MODE=$(cat "$CONFIG_FILE" | jq -r '.defaultExecutionMode // "ultrawork"')
else
  DEFAULT_MODE="ultrawork"
fi
```

**활성화**
- `"ultrawork"` → `ultrawork` 스킬 활성화
- `"ecomode"` → `ecomode` 스킬 활성화

사용자는 `/oh-my-claudecode:omc-setup`을 통해 선호도 설정.

### 6.3 키워드 충돌 해결 우선순위

| 우선순위 | 조건 | 결과 |
|----------|------|------|
| 1 (최고) | 명시적 키워드 둘 다 존재 (예: "ulw eco fix errors") | `ecomode` 승리 (더 제한적) |
| 2 | 명시적 키워드 하나만 존재 | 해당 모드 승리 |
| 3 | 제네릭 "fast"/"parallel"만 존재 | 설정 파일에서 읽음 |
| 4 (최저) | 설정 파일 없음 | `ultrawork` 기본값 |

**명시적 모드 키워드**
- `ulw`, `ultrawork` → `ultrawork` 즉시 활성화
- `eco`, `ecomode`, `efficient`, `save-tokens`, `budget` → `ecomode` 즉시 활성화

[Top](#oh-my-claudecode-스킬--에이전트-레퍼런스)

---

## 7. 실무 활용 예시

### 7.1 새 기능 개발

**시나리오**: Todo 앱 구축

**명령**
```
autopilot: build a todo app
```

**흐름**
```
1. Autopilot 활성화
2. Plan: 요구사항 수집 (자동)
3. Execute:
   - designer: UI 컴포넌트 설계
   - executor: 백엔드 API 구현
   - qa-tester: 테스트 작성 및 실행
4. Verify: Architect 검증
5. Complete: 작동하는 앱 완성
```

### 7.2 버그 수정

**시나리오**: 인증 모듈 오류 분석

**명령**
```
analyze: why is login failing?
```

**흐름**
```
1. analyze 스킬 활성화
2. explore: 관련 코드 탐색
3. architect: 근본 원인 분석
4. executor: 수정 적용
5. qa-tester: 회귀 테스트
```

### 7.3 대규모 리팩토링

**시나리오**: TypeScript 오류 전체 수정

**명령**
```
ulw fix all TypeScript errors
```

**흐름**
```
1. ultrawork 스킬 활성화
2. explore: 오류 파일 전체 스캔
3. 병렬 실행:
   - executor-low: file-a.ts 수정
   - executor-low: file-b.ts 수정
   - executor: file-c.ts (복잡) 수정
4. architect: 전체 검증
```

### 7.4 코드 리뷰

**시나리오**: 새로운 PR 리뷰

**명령**
```
/pipeline review
```

**흐름**
```
1. pipeline 스킬 활성화
2. 빌트인 프리셋 "review" 실행:
   - explore: 변경사항 탐색
   - architect: 아키텍처 검토
   - critic: 개선점 제안
   - executor: 제안 반영
```

### 7.5 토큰 절약

**시나리오**: 오류 수정하되 토큰 절약

**명령**
```
eco fix all errors
```

**흐름**
```
1. ecomode 스킬 활성화
2. explore (haiku): 오류 스캔
3. 병렬 실행 (haiku 우선):
   - executor-low: 간단한 오류
   - executor: 중급 오류
4. 토큰 사용량 추적 및 최소화
```

[Top](#oh-my-claudecode-스킬--에이전트-레퍼런스)

---

## 참고 자료

- **소스**: `~/.claude/CLAUDE.md` (스킬/에이전트 전체 정의)
- **마이그레이션**: `~/.claude/MIGRATION.md` (버전별 마이그레이션 가이드)
- **설정 파일**: `~/.claude/.omc-config.json` (기본 실행 모드 설정)
- **상태 디렉토리**: `.omc/state/` (로컬 상태 파일)
- **전역 상태**: `~/.omc/state/` (전역 상태 파일)

[Top](#oh-my-claudecode-스킬--에이전트-레퍼런스)
