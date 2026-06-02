# n8n Expressions

## 개요

n8n 표현식은 워크플로우에서 데이터를 동적으로 처리하고 변환하기 위한 강력한 도구임.
표현식을 통해 노드 간 데이터 매핑, 조건부 로직 처리, 복잡한 데이터 변환을 수행할 수 있음.

## 표현식 기본 구조

### 기본 문법

모든 표현식은 `{{ }}` 괄호 내에 작성됨.

```javascript
{{ $json.fieldName }}
{{ $now.toFormat("yyyy-MM-dd") }}
{{ condition ? "yes" : "no" }}
```

### 템플릿 언어

n8n은 Tournament라는 템플릿 언어를 사용하며, 커스텀 메서드 및 변수와 데이터 변환 함수로 확장됨.
표준 JavaScript와 n8n 내장 메서드 및 변수, 데이터 변환 함수를 모두 사용 가능함.

## 핵심 개념

### 데이터 매핑

표현식 에디터를 통해 동적 데이터 매핑 가능. 이는 한 노드의 출력을 다른 노드의 입력으로 연결할 때 사용됨.

**주요 기능:**
- UI 기반 데이터 매핑
- 표현식 에디터를 활용한 고급 매핑
- 데이터 항목 링킹(Item Linking)을 통한 정확한 데이터 참조

### 데이터 접근

- **현재 노드의 데이터**: `$json` 변수를 통해 접근
- **이전 노드의 데이터**: `$("NodeName")` 형식으로 접근
- **환경 변수**: `$vars.variableName`을 통한 전역 데이터 사용

## 주요 변수

### 현재 데이터 접근

| 변수 | 설명 | 예시 |
|------|------|------|
| `$json` | 현재 항목의 JSON 데이터 | `{{ $json.email }}` |
| `$json.fieldName` | 특정 필드 접근 | `{{ $json.user.name }}` |
| `$itemIndex` | 현재 항목의 인덱스 (0부터 시작) | `{{ $itemIndex }}` |
| `$binary` | 현재 항목의 바이너리 데이터 | `{{ $binary }}` |

### 노드 데이터 접근

| 메서드 | 설명 | 예시 |
|--------|------|------|
| `$("NodeName").first()` | 지정된 노드의 첫 번째 항목 | `{{ $("HTTP Request").first().json }}` |
| `$("NodeName").all()` | 모든 항목을 배열로 반환 | `{{ $("HTTP Request").all() }}` |
| `$("NodeName").last()` | 마지막 항목 반환 | `{{ $("HTTP Request").last().json }}` |
| `$("NodeName").item` | 연결된 항목 | `{{ $("HTTP Request").item.json }}` |

### 날짜/시간 처리

| 변수/메서드 | 설명 | 예시 |
|-------------|------|------|
| `$now` | 현재 타임스탬프 (Luxon DateTime 객체) | `{{ $now }}` |
| `$today` | 자정의 오늘 날짜 | `{{ $today }}` |
| `$now.toFormat()` | 날짜 형식화 | `{{ $now.toFormat("yyyy-MM-dd") }}` |
| `$now.plus()` | 날짜 더하기 | `{{ $now.plus({days: 7}) }}` |
| `$now.minus()` | 날짜 빼기 | `{{ $now.minus({hours: 2}) }}` |

### 워크플로우 메타데이터

| 변수 | 설명 | 예시 |
|------|------|------|
| `$execution.id` | 현재 실행 ID | `{{ $execution.id }}` |
| `$workflow.id` | 워크플로우 ID | `{{ $workflow.id }}` |
| `$workflow.name` | 워크플로우 이름 | `{{ $workflow.name }}` |
| `$prevNode.name` | 이전 노드 이름 | `{{ $prevNode.name }}` |
| `$runIndex` | 현재 실행 인덱스 | `{{ $runIndex }}` |
| `$vars.variableName` | 사용자 정의 변수 접근 | `{{ $vars.apiKey }}` |

## 조건문 및 연산자

### 삼항 연산자

```javascript
{{ $json.status === "active" ? "활성" : "비활성" }}
{{ $json.age >= 18 ? "성인" : "미성년" }}
```

### Null 병합 연산자

```javascript
{{ $json.value ?? "기본값" }}
{{ $json.user?.name ?? "이름 없음" }}
```

### 논리 OR 폴백

```javascript
{{ $json.title || "제목 없음" }}
{{ $json.email || $json.username || "Unknown" }}
```

### n8n if 헬퍼 함수

```javascript
{{ $if($json.score > 80, "합격", "불합격") }}
{{ $if($itemIndex === 0, "첫 번째", "기타") }}
```

## 실용적 응용

### 조건부 로직

If 노드와 Switch 노드를 통해 표현식 기반 분기 처리 수행 가능함.

```javascript
// If 노드 조건
{{ $json.total > 1000 }}

// Switch 노드 조건
{{ $json.status }}
```

### 데이터 변환

- Edit Fields(Set) 노드에서 표현식으로 값 설정
- Code 노드를 통한 고급 데이터 처리
- 문자열, 날짜, 수치 데이터 변환

```javascript
// 문자열 변환
{{ $json.name.toUpperCase() }}

// 날짜 변환
{{ $json.createdAt.toFormat("yyyy-MM-dd") }}

// 숫자 변환
{{ Math.round($json.price * 1.1) }}
```

### 배열 처리

```javascript
// 배열 길이
{{ $json.items.length }}

// 배열 필터링
{{ $json.items.filter(item => item.active) }}

// 배열 맵핑
{{ $json.items.map(item => item.name) }}

// 배열 조인
{{ $json.tags.join(", ") }}
```

## 표현식 패턴 분류

### 초급 패턴

- 기본 속성 접근: `{{ $json.name }}`
- 문자열 조작: `{{ $json.text.toLowerCase() }}`
- JSON 변환: `{{ JSON.stringify($json) }}`
- Null 검사: `{{ $json.value ?? "default" }}`

### 중급 패턴

- 배열 변환: `{{ $json.items.map(i => i.id) }}`
- 정규식 활용: `{{ $json.email.match(/^[^@]+/) }}`
- 조건부 로직: `{{ $json.type === "premium" ? "VIP" : "일반" }}`
- 복잡한 문자열 처리: `{{ $json.text.split(" ").slice(0, 10).join(" ") }}`

### 고급 패턴

- 즉시 실행 함수(IIFE): `{{ (() => { /* 복잡한 로직 */ })() }}`
- JMESPath 통합: `{{ $jmespath($json, "items[?price > 100]") }}`
- 동적 코드 생성: 표현식 내에서 동적으로 로직 구성
- 강건한 오류 처리: try-catch 패턴 활용

## 오류 처리

### 안전한 접근

```javascript
// 옵셔널 체이닝
{{ $json.user?.address?.city }}

// 기본값 제공
{{ $json.user?.email ?? "no-email@example.com" }}

// 타입 체크
{{ typeof $json.age === "number" ? $json.age : 0 }}
```

### 유효성 검증

```javascript
// 배열 체크
{{ Array.isArray($json.items) ? $json.items.length : 0 }}

// 문자열 체크
{{ typeof $json.name === "string" && $json.name.length > 0 }}

// 숫자 체크
{{ !isNaN($json.value) && $json.value > 0 }}
```

## 데이터 항목 링킹

여러 항목을 처리할 때 각 항목과 해당 데이터의 정확한 관계 유지 가능함.
n8n은 자동으로 항목 간 연결을 추적하여 데이터 일관성을 보장함.

## 바이너리 데이터 처리

파일 및 이진 데이터를 표현식으로 조작 가능함.

```javascript
// 바이너리 데이터 접근
{{ $binary.data }}

// 파일명 접근
{{ $binary.fileName }}

// MIME 타입 접근
{{ $binary.mimeType }}
```

## 스키마 미리보기

데이터 구조를 사전에 확인하여 표현식 작성 시 오류 예방 가능함.
표현식 에디터에서 `$` 입력 시 자동완성 제안 목록이 표시됨.

## 주요 학습 경로

n8n 공식 문서의 **Level one 및 Level two 텍스트 과정**에서 표현식 활용법을 체계적으로 학습 가능.
데이터 구조 이해에서 시작하여 점진적으로 복잡한 표현식 사용 학습 가능.

## 참고 자료

- [n8n Expressions 공식 문서](https://docs.n8n.io/code/expressions/)
- [n8n Built-in Methods](https://docs.n8n.io/code/builtin/overview/)
- [n8n Expressions Cheat-Sheet](https://n8narena.com/guides/n8n-expression-cheatsheet/)
- [n8n Code Node](https://docs.n8n.io/code/code-node/)

## 결론

n8n 표현식은 워크플로우 자동화의 핵심 기능이며, 체계적인 학습을 통해 강력한 데이터 처리 능력 획득 가능함.
기본 변수 사용부터 복잡한 데이터 변환까지 다양한 수준의 표현식 활용 가능함.
