# n8n 내장 데이터 변환 함수

## 개요

n8n은 표현식 내에서 데이터를 변환하고 조작하기 위한 다양한 내장 함수를 제공함.
이러한 함수들은 문자열, 배열, 날짜, 객체 등 다양한 데이터 타입을 처리할 수 있음.

## 문자열 변환 함수

### 대소문자 변환

```javascript
// 대문자 변환
{{ $json.name.toUpperCase() }}
// "JOHN DOE"

// 소문자 변환
{{ $json.email.toLowerCase() }}
// "user@example.com"

// 첫 글자만 대문자
{{ $json.name.charAt(0).toUpperCase() + $json.name.slice(1).toLowerCase() }}
// "John"
```

### 문자열 분할 및 결합

```javascript
// 분할 (split)
{{ $json.fullName.split(" ") }}
// ["John", "Doe"]

{{ $json.tags.split(",") }}
// ["tag1", "tag2", "tag3"]

// 결합 (join)
{{ $json.keywords.join(", ") }}
// "keyword1, keyword2, keyword3"

{{ $json.path.split("/").join("\\") }}
// 경로 구분자 변경
```

### 문자열 검색 및 치환

```javascript
// 포함 여부 확인
{{ $json.message.includes("error") }}
// true 또는 false

// 시작/종료 확인
{{ $json.filename.startsWith("temp_") }}
{{ $json.url.endsWith(".pdf") }}

// 치환 (replace)
{{ $json.text.replace("old", "new") }}
// 첫 번째 매칭만 치환

{{ $json.text.replaceAll("old", "new") }}
// 모든 매칭 치환

// 정규식 치환
{{ $json.phone.replace(/[^0-9]/g, "") }}
// 숫자만 추출
```

### 문자열 추출

```javascript
// 부분 문자열 (substring)
{{ $json.description.substring(0, 100) }}
// 처음 100자

// 슬라이스 (slice)
{{ $json.code.slice(-4) }}
// 마지막 4자

{{ $json.text.slice(10, 20) }}
// 10번째부터 20번째 전까지

// 정규식 매칭 (match)
{{ $json.email.match(/^[^@]+/) }}
// @ 이전 부분 추출

{{ $json.text.match(/\d+/g) }}
// 모든 숫자 추출
```

### 공백 처리

```javascript
// 양쪽 공백 제거
{{ $json.input.trim() }}

// 왼쪽 공백 제거
{{ $json.input.trimStart() }}

// 오른쪽 공백 제거
{{ $json.input.trimEnd() }}

// 여러 공백을 하나로
{{ $json.text.replace(/\s+/g, " ") }}
```

### 문자열 패딩

```javascript
// 왼쪽 패딩
{{ $json.id.padStart(5, "0") }}
// "00123"

// 오른쪽 패딩
{{ $json.code.padEnd(10, "-") }}
// "ABC-------"
```

### 문자열 반복 및 길이

```javascript
// 반복
{{ "-".repeat(50) }}
// "--------------------------------------------------"

// 길이
{{ $json.message.length }}
// 문자 수

// 특정 길이로 자르기
{{ $json.description.length > 100 ? $json.description.substring(0, 100) + "..." : $json.description }}
```

## 배열 변환 함수

### 배열 기본 조작

```javascript
// 길이
{{ $json.items.length }}

// 요소 접근
{{ $json.items[0] }}
{{ $json.items[$json.items.length - 1] }}

// 배열 결합
{{ $json.array1.concat($json.array2) }}

// 배열 복사
{{ [...$json.items] }}
```

### 배열 변환 (map)

```javascript
// 각 요소 변환
{{ $json.users.map(u => u.name) }}
// 이름만 추출

{{ $json.products.map(p => ({ id: p.id, name: p.name })) }}
// 특정 필드만 선택

{{ $json.numbers.map(n => n * 2) }}
// 각 숫자를 2배로

{{ $json.items.map((item, index) => ({ ...item, order: index + 1 })) }}
// 순서 번호 추가
```

### 배열 필터링 (filter)

```javascript
// 조건에 맞는 요소만
{{ $json.users.filter(u => u.active) }}
// 활성 사용자만

{{ $json.products.filter(p => p.price > 1000) }}
// 가격이 1000 초과인 상품

{{ $json.items.filter((item, index) => index < 10) }}
// 처음 10개만

{{ $json.emails.filter(e => e.includes("@gmail.com")) }}
// Gmail 주소만
```

### 배열 검색

```javascript
// 첫 번째 매칭 요소 (find)
{{ $json.users.find(u => u.id === 123) }}

// 인덱스 찾기 (findIndex)
{{ $json.items.findIndex(i => i.status === "pending") }}

// 포함 여부 확인 (includes)
{{ $json.tags.includes("important") }}

// 조건 충족 여부 (some, every)
{{ $json.items.some(i => i.error) }}
// 하나라도 에러가 있는지

{{ $json.items.every(i => i.validated) }}
// 모두 검증되었는지
```

### 배열 정렬 (sort)

```javascript
// 숫자 오름차순
{{ $json.numbers.sort((a, b) => a - b) }}

// 숫자 내림차순
{{ $json.scores.sort((a, b) => b - a) }}

// 문자열 정렬
{{ $json.names.sort() }}

// 객체 배열 정렬
{{ $json.users.sort((a, b) => a.name.localeCompare(b.name)) }}
// 이름순

{{ $json.products.sort((a, b) => b.price - a.price) }}
// 가격 높은 순
```

### 배열 집계 (reduce)

```javascript
// 합계
{{ $json.numbers.reduce((sum, n) => sum + n, 0) }}

// 평균
{{ $json.scores.reduce((sum, s) => sum + s, 0) / $json.scores.length }}

// 객체로 변환
{{ $json.items.reduce((obj, item) => ({ ...obj, [item.id]: item }), {}) }}

// 그룹화
{{ $json.users.reduce((groups, user) => {
  const dept = user.department;
  return { ...groups, [dept]: [...(groups[dept] || []), user] };
}, {}) }}
```

### 배열 슬라이스 및 분할

```javascript
// 슬라이스
{{ $json.items.slice(0, 10) }}
// 처음 10개

{{ $json.items.slice(-5) }}
// 마지막 5개

// 페이징
{{ $json.allItems.slice($json.page * 20, ($json.page + 1) * 20) }}
// 20개씩 페이징

// 배열 평탄화 (flat)
{{ $json.nestedArray.flat() }}
// 1단계 평탄화

{{ $json.deeplyNested.flat(Infinity) }}
// 완전 평탄화
```

### 배열 중복 제거

```javascript
// Set 활용
{{ [...new Set($json.tags)] }}

// filter 활용
{{ $json.items.filter((item, index, arr) => arr.indexOf(item) === index) }}

// 객체 배열 중복 제거 (특정 키 기준)
{{ $json.users.filter((user, index, arr) =>
  arr.findIndex(u => u.email === user.email) === index
) }}
```

### 배열 결합 및 분리

```javascript
// join - 문자열로 결합
{{ $json.tags.join(", ") }}

// 다차원 배열 결합
{{ $json.matrix.map(row => row.join("\t")).join("\n") }}
// CSV/TSV 형식

// 배열 펼치기 (flatMap)
{{ $json.users.flatMap(u => u.tags) }}
// 모든 사용자의 태그를 하나의 배열로
```

## 숫자 변환 함수

### 기본 수학 연산

```javascript
// 반올림
{{ Math.round($json.price) }}
// 1234

{{ Math.round($json.value * 100) / 100 }}
// 소수점 2자리

// 올림/내림
{{ Math.ceil($json.value) }}
{{ Math.floor($json.value) }}

// 절대값
{{ Math.abs($json.difference) }}

// 최대/최소
{{ Math.max(...$json.numbers) }}
{{ Math.min(...$json.numbers) }}
```

### 숫자 형식화

```javascript
// 고정 소수점
{{ $json.price.toFixed(2) }}
// "99.99"

// 지수 표기법
{{ $json.largeNumber.toExponential(2) }}

// 정밀도 지정
{{ $json.value.toPrecision(4) }}

// 천 단위 구분
{{ $json.amount.toLocaleString("ko-KR") }}
// "1,234,567"

// 통화 형식
{{ $json.price.toLocaleString("ko-KR", { style: "currency", currency: "KRW" }) }}
// "₩1,000"
```

### 숫자 변환

```javascript
// 문자열을 숫자로
{{ parseInt($json.stringNumber) }}
{{ parseFloat($json.decimalString) }}

// 숫자를 문자열로
{{ $json.number.toString() }}

// 진수 변환
{{ $json.decimal.toString(16) }}
// 16진수

{{ parseInt($json.hexString, 16) }}
// 16진수를 10진수로
```

### 난수 생성

```javascript
// 0~1 사이 난수
{{ Math.random() }}

// 범위 내 난수
{{ Math.floor(Math.random() * 100) }}
// 0~99

{{ Math.floor(Math.random() * (max - min + 1)) + min }}
// min~max 범위
```

## 객체 변환 함수

### 객체 키/값 추출

```javascript
// 키 목록
{{ Object.keys($json.data) }}

// 값 목록
{{ Object.values($json.data) }}

// 키-값 쌍 배열
{{ Object.entries($json.data) }}
// [["key1", "value1"], ["key2", "value2"]]

// 배열을 객체로
{{ Object.fromEntries($json.pairs) }}
```

### 객체 병합

```javascript
// 스프레드 연산자
{{ { ...$json.defaults, ...$json.overrides } }}

// Object.assign
{{ Object.assign({}, $json.base, $json.extension) }}

// 중첩 병합
{{ {
  ...$json.user,
  settings: { ...$json.user.settings, ...$json.newSettings }
} }}
```

### 객체 필터링

```javascript
// 특정 키만 선택
{{ Object.fromEntries(
  Object.entries($json.data).filter(([key]) =>
    ["name", "email", "phone"].includes(key)
  )
) }}

// 조건부 필터링
{{ Object.fromEntries(
  Object.entries($json.data).filter(([key, value]) => value !== null)
) }}
```

## JSON 변환 함수

### JSON 직렬화/역직렬화

```javascript
// 객체를 JSON 문자열로
{{ JSON.stringify($json.data) }}

// 포맷팅된 JSON
{{ JSON.stringify($json.data, null, 2) }}

// JSON 문자열을 객체로
{{ JSON.parse($json.jsonString) }}

// 안전한 파싱
{{ (() => {
  try {
    return JSON.parse($json.maybeJson);
  } catch {
    return {};
  }
})() }}
```

## JMESPath 함수

### $jmespath

JMESPath 쿼리 언어를 사용한 복잡한 데이터 추출

```javascript
// 기본 필드 선택
{{ $jmespath($json, "users[*].name") }}
// 모든 사용자 이름

// 필터링
{{ $jmespath($json, "products[?price > `100`]") }}
// 가격이 100 초과인 상품

// 정렬
{{ $jmespath($json, "sort_by(items, &price)") }}
// 가격순 정렬

// 복잡한 쿼리
{{ $jmespath($json, "users[?active && age > `18`].{name: name, email: email}") }}
// 활성 성인 사용자의 이름과 이메일만
```

**주요 JMESPath 연산:**

| 연산 | 설명 | 예시 |
|------|------|------|
| `[*]` | 배열 모든 요소 | `users[*].name` |
| `[?condition]` | 필터링 | `items[?price > 100]` |
| `{key: value}` | 프로젝션 | `{id: id, name: name}` |
| `sort_by(array, &key)` | 정렬 | `sort_by(items, &price)` |
| `length()` | 길이 | `length(items)` |
| `join()` | 결합 | `join(', ', names)` |
| `map()` | 변환 | `map(&price, items)` |

## Boolean 변환 함수

### 논리 연산

```javascript
// AND
{{ $json.isActive && $json.isVerified }}

// OR
{{ $json.hasEmail || $json.hasPhone }}

// NOT
{{ !$json.isDeleted }}

// 복합 조건
{{ ($json.age >= 18 && $json.country === "KR") || $json.verified }}
```

### Falsy 값 처리

```javascript
// Boolean으로 변환
{{ Boolean($json.value) }}

// Double NOT
{{ !!$json.value }}

// Null 병합
{{ $json.value ?? "기본값" }}

// OR 폴백
{{ $json.value || "기본값" }}
```

## 타입 변환 함수

### 타입 체크

```javascript
// 타입 확인
{{ typeof $json.value }}

// 배열 확인
{{ Array.isArray($json.items) }}

// Null/Undefined 확인
{{ $json.value === null }}
{{ $json.value === undefined }}
{{ $json.value == null }}
// null 또는 undefined

// NaN 확인
{{ isNaN($json.number) }}
```

### 안전한 타입 변환

```javascript
// 숫자 변환 (실패 시 기본값)
{{ Number($json.value) || 0 }}

// 문자열 변환
{{ String($json.value) }}
{{ $json.value?.toString() ?? "" }}

// 배열로 변환
{{ Array.isArray($json.data) ? $json.data : [$json.data] }}

// 객체 보장
{{ typeof $json.value === "object" && $json.value !== null ? $json.value : {} }}
```

## 유틸리티 함수

### $if 헬퍼

n8n의 조건부 헬퍼 함수

```javascript
// 기본 사용
{{ $if($json.score >= 80, "합격", "불합격") }}

// 중첩
{{ $if($json.grade === "A", "최우수",
    $if($json.grade === "B", "우수", "보통")) }}
```

### 안전한 체이닝

```javascript
// 옵셔널 체이닝
{{ $json.user?.profile?.avatar?.url }}

// 배열 안전 접근
{{ $json.items?.[0]?.name }}

// 함수 안전 호출
{{ $json.callback?.() }}
```

## 실용 예제

### 이메일 마스킹

```javascript
{{ $json.email.replace(/^(.{2})(.*)(@.*)$/, (match, p1, p2, p3) =>
  p1 + "*".repeat(p2.length) + p3
) }}
// "jo****@example.com"
```

### 전화번호 포맷팅

```javascript
{{ $json.phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3") }}
// "010-1234-5678"
```

### URL 파라미터 추출

```javascript
{{ new URL($json.url).searchParams.get("id") }}

{{ Object.fromEntries(new URL($json.url).searchParams) }}
// 모든 파라미터를 객체로
```

### CSV 생성

```javascript
{{ $json.users.map(u =>
  [u.id, u.name, u.email].map(v => `"${v}"`).join(",")
).join("\n") }}
```

## 참고 자료

- [n8n Data Transformation - Strings](https://docs.n8n.io/code/builtin/data-transformation-functions/strings/)
- [n8n Data Transformation - Arrays](https://docs.n8n.io/code/builtin/data-transformation-functions/arrays/)
- [n8n Data Transformation - Dates](https://docs.n8n.io/code/builtin/data-transformation-functions/dates/)
- [JMESPath in n8n](https://docs.n8n.io/code/builtin/jmespath/)
- [JMESPath Tutorial](https://jmespath.org/tutorial.html)

## 결론

n8n 내장 데이터 변환 함수를 활용하면 복잡한 데이터 처리를 표현식만으로 수행 가능함.
문자열, 배열, 객체, 날짜 등 다양한 데이터 타입에 대한 변환 함수를 숙지하면 효율적인 워크플로우 구축 가능함.
