# OpenCode LSP 설치 가이드

- [OpenCode LSP 설치 가이드](#opencode-lsp-설치-가이드)
  - [1. Why - LSP 필요성](#1-why---lsp-필요성)
    - [문제: AI의 코드 맥락 인식 한계](#문제-ai의-코드-맥락-인식-한계)
    - [해결: LSP를 통한 코드 인텔리전스 제공](#해결-lsp를-통한-코드-인텔리전스-제공)
    - [핵심 가치](#핵심-가치)
  - [2. How - 작동 방식](#2-how---작동-방식)
    - [작동 원리](#작동-원리)
    - [설치 방식 3가지](#설치-방식-3가지)
      - [방식별 사용자 작업](#방식별-사용자-작업)
    - [Oh My OpenCode 전역 설치 (권장)](#oh-my-opencode-전역-설치-권장)
      - [OpenCode vs Oh My OpenCode 비교](#opencode-vs-oh-my-opencode-비교)
      - [전역 설치 명령어](#전역-설치-명령어)
      - [주요 언어별 전역 설치 명령어](#주요-언어별-전역-설치-명령어)
      - [설치 확인](#설치-확인)
    - [설정 파일 구조](#설정-파일-구조)
    - [주요 설정 시나리오](#주요-설정-시나리오)
      - [시나리오 1: 특정 LSP 비활성화](#시나리오-1-특정-lsp-비활성화)
      - [시나리오 2: 모든 LSP 비활성화](#시나리오-2-모든-lsp-비활성화)
      - [시나리오 3: 커스텀 LSP 추가](#시나리오-3-커스텀-lsp-추가)
      - [시나리오 4: 자동 다운로드 비활성화](#시나리오-4-자동-다운로드-비활성화)
  - [3. What - 지원 목록](#3-what---지원-목록)
    - [주요 언어별 빠른 시작](#주요-언어별-빠른-시작)
    - [전체 LSP 서버 목록](#전체-lsp-서버-목록)
      - [자동 설치 - 사용자 작업: 없음](#자동-설치---사용자-작업-없음)
      - [의존성 기반 - 사용자 작업: 프로젝트에 패키지 추가](#의존성-기반---사용자-작업-프로젝트에-패키지-추가)
      - [시스템 설치 - 사용자 작업: 시스템에 도구 설치](#시스템-설치---사용자-작업-시스템에-도구-설치)
    - [특수 설정](#특수-설정)
      - [PHP Intelephense 프리미엄 기능](#php-intelephense-프리미엄-기능)
  - [요약](#요약)
    - [Quick Start](#quick-start)
  - [참고 링크](#참고-링크)


---

## 1. Why - LSP 필요성

### 문제: AI의 코드 맥락 인식 한계

AI 코딩 어시스턴트의 단독 사용 시 한계:
- 타입 에러 실시간 감지 불가
- 변수/함수 정의 위치 파악 불가
- 프로젝트 전체 구조 파악 어려움
- 코드 변경 후 문제 즉시 인지 불가

### 해결: LSP를 통한 코드 인텔리전스 제공

LSP(Language Server Protocol)가 AI에게 **실시간 코드 인텔리전스** 제공:

| LSP 미사용 | LSP 사용 |
|-----------|---------|
| AI 추측 기반 코드 작성 | 진단 정보 기반 정확한 코드 작성 |
| 에러 발생 후 문제 인지 | 코드 작성 중 즉시 문제 감지 |
| 수동 타입/심볼 확인 | 자동 정의, 참조, 타입 정보 제공 |

### 핵심 가치

> **LSP = AI가 IDE처럼 코드를 이해하게 하는 다리**

OpenCode + LSP 조합 효과:
- 정확한 코드 생성
- 빠른 버그 발견
- 스마트한 리팩토링

[Top](#opencode-lsp-설치-가이드)

---

## 2. How - 작동 방식

### 작동 원리

```
[파일 열기] → [확장자 감지] → [LSP 서버 자동 시작] → [진단 정보 AI 전달]
```

1. OpenCode가 `.py` 파일 열기
2. Python 확장자 감지
3. pyright LSP 서버 자동 시작
4. 실시간 타입 에러, 경고를 AI에게 전달

### 설치 방식 3가지

| 방식 | OpenCode 동작 | **사용자 작업** | 예시 |
|------|--------------|----------------|------|
| **자동** | LSP 서버 다운로드 + 설치 + 실행 | **없음** | Astro, Vue, PHP, Lua |
| **의존성 기반** | 프로젝트 패키지 감지 → LSP 실행 | **프로젝트에 패키지 추가** | TypeScript, ESLint |
| **시스템 설치** | 시스템 명령어 탐색 → LSP 실행 | **시스템에 도구 설치** | Go, Rust, Python |

#### 방식별 사용자 작업

**자동 설치** - 작업 없음
```bash
# 프로젝트 열기만 하면 됨
opencode .
```

**의존성 기반** - 프로젝트에 npm/pip 패키지 추가
```bash
# TypeScript LSP 사용 시
npm install typescript --save-dev

# ESLint LSP 사용 시
npm install eslint --save-dev
```

**시스템 설치** - 컴퓨터에 직접 설치
```bash
# Python LSP (pyright)
pip install pyright

# Go LSP (gopls) - go 설치 시 자동 포함
# Rust LSP
rustup component add rust-analyzer

# Java LSP - JDK 21+ 설치 필요
```

### Oh My OpenCode 전역 설치 (권장)

Oh My OpenCode는 OpenCode와 다른 LSP 설치 방식 사용.  
**프로젝트 의존성이 아닌 시스템 전역 설치** 방식 채택.

#### OpenCode vs Oh My OpenCode 비교

| 언어 | OpenCode | Oh My OpenCode |
|------|----------|----------------|
| TypeScript | 프로젝트 의존성 필요 | **전역 설치** |
| Python | 전역 설치 | **전역 설치** |

#### 전역 설치 명령어

**웹 개발 (TypeScript + Vue + Bash)**
```bash
npm i -g typescript-language-server typescript \
        @vue/language-server bash-language-server
```

**Python 개발**
```bash
pip install basedpyright ruff
# 또는
pip install pyright
```

**풀스택 개발**
```bash
# JavaScript/TypeScript 계열
npm i -g typescript-language-server typescript \
        @vue/language-server bash-language-server yaml-language-server

# Python 계열
pip install basedpyright
```

#### 주요 언어별 전역 설치 명령어

| 언어 | LSP 서버 | 설치 명령어 |
|------|----------|-------------|
| TypeScript/JS | typescript-language-server | `npm i -g typescript-language-server typescript` |
| React | (TypeScript LSP 사용) | 별도 설치 불필요 (.jsx, .tsx 자동 지원) |
| Python | basedpyright | `pip install basedpyright` |
| Python (대안) | pyright | `pip install pyright` |
| Go | gopls | `go install golang.org/x/tools/gopls@latest` |
| Rust | rust-analyzer | `rustup component add rust-analyzer` |
| Vue | vue-language-server | `npm i -g @vue/language-server` |
| Svelte | svelte-language-server | `npm i -g svelte-language-server` |
| Bash | bash-language-server | `npm i -g bash-language-server` |
| YAML | yaml-language-server | `npm i -g yaml-language-server` |
| PHP | intelephense | `npm i -g intelephense` |
| Ruby | ruby-lsp | `gem install ruby-lsp` |
| C# | csharp-ls | `dotnet tool install -g csharp-ls` |

#### 설치 확인

OpenCode 실행 후 LSP 서버 상태 확인:
```bash
lsp_servers
```
설치된 서버는 `[installed]`로 표시.

### 설정 파일 구조

`opencode.json`에서 LSP 제어.

**파일 위치:**

| 범위 | 경로 |
|------|------|
| 전역 (모든 프로젝트) | `~/.config/opencode/opencode.json` |
| 프로젝트별 | `<프로젝트 루트>/opencode.json` |

> Windows: `~` = `%USERPROFILE%` (예: `C:\Users\<사용자명>`)

**설정 형식:**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "lsp": {
    "<서버명>": {
      "disabled": false,
      "command": ["명령어", "--옵션"],
      "extensions": [".확장자"],
      "env": { "환경변수": "값" },
      "initialization": { "초기화옵션": "값" }
    }
  }
}
```

### 주요 설정 시나리오

#### 시나리오 1: 특정 LSP 비활성화
```json
{
  "lsp": {
    "typescript": { "disabled": true }
  }
}
```

#### 시나리오 2: 모든 LSP 비활성화
```json
{
  "lsp": false
}
```

#### 시나리오 3: 커스텀 LSP 추가
```json
{
  "lsp": {
    "my-custom": {
      "command": ["my-lsp-server", "--stdio"],
      "extensions": [".myext"]
    }
  }
}
```

#### 시나리오 4: 자동 다운로드 비활성화
```bash
export OPENCODE_DISABLE_LSP_DOWNLOAD=true
```

[Top](#opencode-lsp-설치-가이드)

---

## 3. What - 지원 목록

### 주요 언어별 빠른 시작

| 언어 | 사용자 작업 |
|------|-----------|
| **C/C++** | 없음 (자동) |
| **PHP** | 없음 (자동) |
| **Lua** | 없음 (자동) |
| **TypeScript/JS** | `npm install typescript -D` |
| **Python** | `pip install pyright` |
| **Go** | Go 설치 (gopls 자동 포함) |
| **Rust** | `rustup component add rust-analyzer` |
| **Java** | JDK 21+ 설치 |

### 전체 LSP 서버 목록

| 방식 | OpenCode 동작 | **사용자 작업** |
|------|--------------|-----------------|
| **자동** | LSP 다운로드 + 설치 + 실행 | 없음 |
| **의존성 기반** | package.json 감지 → LSP 실행 | `npm install <pkg> -D` |
| **시스템 설치** | 시스템 명령어 탐색 → LSP 실행 | 컴퓨터에 도구 직접 설치 |

#### 자동 설치 - 사용자 작업: 없음
> OpenCode가 LSP 서버 자동 다운로드 및 설치.

| LSP | 확장자 |
|-----|--------|
| astro | .astro |
| bash | .sh, .bash, .zsh, .ksh |
| clangd | .c, .cpp, .h, .hpp 등 |
| kotlin-ls | .kt, .kts |
| lua-ls | .lua |
| php intelephense | .php |
| svelte | .svelte |
| terraform | .tf, .tfvars |
| tinymist | .typ, .typc |
| vue | .vue |
| yaml-ls | .yaml, .yml |

#### 의존성 기반 - 사용자 작업: 프로젝트에 패키지 추가
> 프로젝트 package.json에 해당 패키지 필요.

| LSP | 확장자 | 실행 명령 |
|-----|--------|----------|
| typescript | .ts, .tsx, .js, .jsx 등 | `npm install typescript -D` |
| eslint | .ts, .tsx, .js, .jsx, .vue 등 | `npm install eslint -D` |
| oxlint | .ts, .tsx, .js, .jsx, .vue 등 | `npm install oxlint -D` |
| prisma | .prisma | `npm install prisma -D` |

#### 시스템 설치 - 사용자 작업: 시스템에 도구 설치
> 컴퓨터에 해당 언어/도구 설치 필요.

| LSP | 확장자 | 실행 명령 |
|-----|--------|----------|
| pyright | .py, .pyi | `pip install pyright` |
| gopls | .go | Go 설치 (https://go.dev) |
| rust | .rs | `rustup component add rust-analyzer` |
| jdtls | .java | JDK 21+ 설치 |
| csharp | .cs | .NET SDK 설치 |
| fsharp | .fs, .fsi, .fsx | .NET SDK 설치 |
| dart | .dart | Dart SDK 설치 |
| deno | .ts, .tsx, .js, .jsx | `curl -fsSL https://deno.land/install.sh \| sh` |
| elixir-ls | .ex, .exs | Elixir 설치 |
| gleam | .gleam | `cargo install gleam` |
| clojure-lsp | .clj, .cljs, .cljc | Clojure LSP 설치 |
| nixd | .nix | `nix-env -iA nixpkgs.nixd` |
| ocaml-lsp | .ml, .mli | `opam install ocaml-lsp-server` |
| ruby-lsp | .rb, .rake | Ruby + `gem install ruby-lsp` |
| sourcekit-lsp | .swift | Xcode (macOS) 또는 Swift 설치 |
| zls | .zig, .zon | Zig 설치 (https://ziglang.org) |

### 특수 설정

#### PHP Intelephense 프리미엄 기능
라이선스 키 파일 위치:
- **macOS/Linux**: `$HOME/intelephense/licence.txt`
- **Windows**: `%USERPROFILE%/intelephense/licence.txt`

[Top](#opencode-lsp-설치-가이드)

---

## 요약

```
자동 설치 언어 (C, PHP, Lua, Vue, Svelte...)
  → 작업 없음. 바로 사용 가능.

의존성 기반 언어 (TypeScript, ESLint...)
  → npm install <패키지> -D 실행

시스템 설치 언어 (Python, Go, Rust, Java...)
  → 해당 언어/도구 컴퓨터에 설치
```

### Quick Start

```bash
# 1. 프로젝트 폴더에서 OpenCode 실행
opencode .

# 2. 자동 설치 언어는 바로 작동.
#    다른 언어는 위 표 참고하여 필요한 것만 설치.
```

[Top](#opencode-lsp-설치-가이드)

---

## 참고 링크

- [공식 문서](https://opencode.ai/docs/lsp/)
- [GitHub](https://github.com/anomalyco/opencode)
- [Discord](https://opencode.ai/discord)

[Top](#opencode-lsp-설치-가이드)
