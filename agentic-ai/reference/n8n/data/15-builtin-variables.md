# n8n 내장 변수

## 개요

n8n은 워크플로우 실행 중 데이터 접근 및 메타데이터 활용을 위한 다양한 내장 변수를 제공함.
이러한 변수들은 표현식 에디터와 Code 노드에서 `$variableName` 형식으로 사용 가능함.

## 변수 사용 문법

```javascript
// 표현식에서
{{ $variableName }}

// Code 노드에서
$variableName

// 자동완성 확인
표현식 에디터에서 $ 입력 시 사용 가능한 변수 목록 표시됨
```

## 현재 항목 데이터 변수

### $json

현재 항목의 JSON 형식 데이터에 접근함.

```javascript
// 표현식에서
{{ $json.email }}
{{ $json.user.name }}
{{ $json.items[0].price }}

// Code 노드에서
const email = $json.email;
const userName = $json.user.name;
```

**특징:**
- 가장 자주 사용되는 변수
- 이전 노드에서 전달된 구조화된 데이터 접근
- 중첩된 객체 및 배열 접근 가능

### $binary

현재 항목의 바이너리 데이터에 접근함.

```javascript
// 바이너리 데이터 접근
{{ $binary.data }}

// 파일 정보 접근
{{ $binary.fileName }}
{{ $binary.mimeType }}
{{ $binary.fileSize }}
```

**사용 사례:**
- 파일 업로드/다운로드
- 이미지 처리
- PDF 생성
- 첨부파일 처리

### $itemIndex

현재 처리 중인 항목의 인덱스 (0부터 시작)

```javascript
// 표현식에서
{{ $itemIndex }}

// 조건부 처리
{{ $itemIndex === 0 ? "첫 번째" : "기타" }}

// Code 노드에서
if ($itemIndex === 0) {
  // 첫 번째 항목 특별 처리
}
```

**활용 예시:**
- 첫 번째 항목만 다르게 처리
- 배치 번호 생성
- 진행률 계산

## 노드 입력 변수

### $input

현재 노드의 입력 데이터에 접근하는 객체

**주요 메서드:**

| 메서드 | 설명 | 반환 타입 |
|--------|------|-----------|
| `$input.first()` | 첫 번째 항목 반환 | Object |
| `$input.all()` | 모든 항목을 배열로 반환 | Array |
| `$input.last()` | 마지막 항목 반환 | Object |
| `$input.item` | 현재 항목 (반복 중) | Object |

```javascript
// Code 노드에서 모든 항목 처리
const allItems = $input.all();
return allItems.map(item => ({
  ...item.json,
  processed: true
}));

// 첫 번째 항목만 사용
const firstItem = $input.first().json;
```

### 다른 노드 데이터 접근

특정 노드의 출력 데이터에 접근함.

```javascript
// 표현식에서
{{ $("HTTP Request").first().json }}
{{ $("HTTP Request").all() }}
{{ $("Set Variable").item.json.value }}

// Code 노드에서
const httpData = $("HTTP Request").first().json;
const allData = $("HTTP Request").all();
```

**활용 패턴:**
- 여러 노드의 데이터 병합
- 특정 노드 결과 재사용
- 조건부 데이터 선택

## 날짜/시간 변수

### $now

현재 시간을 나타내는 Luxon DateTime 객체

```javascript
// 현재 타임스탬프
{{ $now }}

// ISO 형식
{{ $now.toISO() }}

// 커스텀 형식
{{ $now.toFormat("yyyy-MM-dd HH:mm:ss") }}
{{ $now.toFormat("yyyy년 MM월 dd일") }}

// 날짜 계산
{{ $now.plus({days: 7}) }}
{{ $now.minus({hours: 2}) }}
{{ $now.startOf('month') }}
{{ $now.endOf('week') }}
```

**주요 메서드:**

| 메서드 | 설명 | 예시 |
|--------|------|------|
| `toFormat(fmt)` | 지정된 형식으로 변환 | `toFormat("yyyy-MM-dd")` |
| `toISO()` | ISO 8601 형식 | `"2024-01-15T10:30:00.000Z"` |
| `plus(duration)` | 시간 더하기 | `plus({days: 1, hours: 2})` |
| `minus(duration)` | 시간 빼기 | `minus({weeks: 1})` |
| `startOf(unit)` | 단위 시작 시간 | `startOf('day')` |
| `endOf(unit)` | 단위 종료 시간 | `endOf('month')` |
| `diff(other)` | 시간 차이 계산 | `diff($json.createdAt)` |

### $today

오늘 날짜의 자정 (00:00:00)을 나타내는 Luxon DateTime 객체

```javascript
// 오늘 자정
{{ $today }}

// 오늘 날짜 형식화
{{ $today.toFormat("yyyy-MM-dd") }}

// 오늘부터 7일 후
{{ $today.plus({days: 7}) }}
```

**사용 사례:**
- 일일 리포트 생성
- 오늘 데이터 필터링
- 날짜 범위 설정

## 워크플로우 실행 변수

### $execution

현재 워크플로우 실행 정보

```javascript
// 실행 ID
{{ $execution.id }}

// 실행 모드 (manual, trigger, webhook, etc.)
{{ $execution.mode }}

// 재실행 여부
{{ $execution.resumeUrl }}
```

**주요 속성:**

| 속성 | 설명 | 예시 값 |
|------|------|---------|
| `id` | 고유 실행 ID | `"1234-5678-90ab"` |
| `mode` | 실행 모드 | `"manual"`, `"trigger"` |
| `resumeUrl` | 재실행 URL (대기 중일 때) | URL 문자열 |

### $workflow

워크플로우 메타데이터

```javascript
// 워크플로우 ID
{{ $workflow.id }}

// 워크플로우 이름
{{ $workflow.name }}

// 워크플로우가 활성화 상태인지
{{ $workflow.active }}
```

**주요 속성:**

| 속성 | 설명 | 타입 |
|------|------|------|
| `id` | 워크플로우 고유 ID | String |
| `name` | 워크플로우 이름 | String |
| `active` | 활성화 상태 | Boolean |

**활용 예시:**
- 로깅 시 워크플로우 식별
- 멀티 테넌트 환경에서 구분
- 조건부 로직 (워크플로우별 다른 동작)

### $prevNode

이전에 실행된 노드 정보

```javascript
// 이전 노드 이름
{{ $prevNode.name }}

// 이전 노드 타입
{{ $prevNode.type }}

// 이전 노드 출력 개수
{{ $prevNode.outputIndex }}
```

**사용 사례:**
- 동적 에러 메시지 생성
- 실행 흐름 추적
- 디버깅 정보 수집

### $runIndex

현재 워크플로우가 실행된 횟수 (0부터 시작)

```javascript
// 첫 실행인지 확인
{{ $runIndex === 0 }}

// 재시도 횟수 표시
{{ $runIndex }} 번째 시도
```

**활용 예시:**
- 재시도 로직
- 첫 실행 시 초기화 작업
- 실행 횟수 기반 조건 분기

## 환경 변수

### $vars

환경별 사용자 정의 변수에 접근 (읽기 전용)

```javascript
// API 키 접근
{{ $vars.apiKey }}

// 환경별 URL
{{ $vars.baseUrl }}

// 설정값 접근
{{ $vars.maxRetries }}
```

**특징:**
- UI에서 설정한 변수에 접근
- 읽기 전용 (표현식에서 수정 불가)
- 환경별 다른 값 설정 가능 (dev, staging, prod)

**설정 방법:**
1. n8n 설정 > Variables
2. 변수명과 값 입력
3. 환경 선택 (해당되는 경우)

### $env

시스템 환경 변수 접근 (self-hosted 환경)

```javascript
// 환경 변수 읽기
{{ $env.NODE_ENV }}
{{ $env.CUSTOM_CONFIG }}
```

**주의사항:**
- Cloud 버전에서는 제한적으로 사용 가능
- Self-hosted에서 주로 활용
- 민감한 정보는 $vars 사용 권장

## HTTP 노드 전용 변수

HTTP 노드에서만 사용 가능한 특수 변수들

### $request

HTTP 요청 정보 (HTTP Request 노드에서만 사용)

```javascript
{{ $request.headers }}
{{ $request.body }}
{{ $request.method }}
{{ $request.url }}
```

### $response

HTTP 응답 정보

```javascript
{{ $response.statusCode }}
{{ $response.headers }}
{{ $response.body }}
```

**주의:** 이러한 변수들은 HTTP 노드 외부에서는 사용 불가함.

## 변수 활용 패턴

### 안전한 접근

```javascript
// 옵셔널 체이닝
{{ $json?.user?.email }}

// 기본값 제공
{{ $json.name ?? "이름 없음" }}
{{ $vars.timeout ?? 30 }}

// 타입 체크
{{ typeof $json.age === "number" ? $json.age : 0 }}
```

### 동적 노드 참조

```javascript
// 동적으로 노드명 구성
{{ $("Node " + $itemIndex).first().json }}

// 조건부 노드 선택
{{ $json.type === "A" ? $("ProcessA").item.json : $("ProcessB").item.json }}
```

### 메타데이터 결합

```javascript
// 로깅용 메시지 생성
{{ `[${$workflow.name}] 실행 ${$execution.id}: ${$prevNode.name} 완료` }}

// 파일명 생성
{{ `${$workflow.name}_${$now.toFormat("yyyyMMdd")}_${$itemIndex}.csv` }}
```

## 디버깅 팁

### 변수 내용 확인

```javascript
// Code 노드에서 모든 변수 출력
return {
  json: $json,
  itemIndex: $itemIndex,
  execution: $execution,
  workflow: $workflow,
  now: $now.toISO(),
  vars: $vars
};
```

### 조건부 로깅

```javascript
// 개발 환경에서만 로그 출력
{{ $vars.environment === "dev" ? console.log($json) : null }}
```

## 참고 자료

- [n8n Built-in Variables 공식 문서](https://docs.n8n.io/code/builtin/overview/)
- [n8n Custom Variables](https://docs.n8n.io/code/variables/)
- [n8n HTTP Node Variables](https://docs.n8n.io/code/builtin/http-node-variables/)
- [Luxon Documentation](https://moment.github.io/luxon/)

## 결론

n8n 내장 변수는 워크플로우 내에서 데이터 접근, 메타데이터 활용, 동적 로직 구현을 위한 필수 도구임.
각 변수의 특성과 사용 범위를 이해하면 효율적이고 유지보수 가능한 워크플로우 구축 가능함.
