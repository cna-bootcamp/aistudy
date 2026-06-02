# n8n 내장 편의 함수

## 개요

n8n은 일반적인 작업을 쉽게 수행할 수 있도록 다양한 편의 함수를 제공함.
이러한 함수들은 표현식과 Code 노드에서 복잡한 로직을 간결하게 작성할 수 있게 도와줌.

## 날짜/시간 편의 함수 (Luxon)

### Luxon DateTime 생성

n8n은 Luxon 라이브러리를 사용하여 날짜/시간을 처리함.

```javascript
// 현재 시간
{{ $now }}

// 오늘 자정
{{ $today }}

// ISO 문자열에서 생성
{{ DateTime.fromISO("2024-01-15T10:30:00") }}

// 형식 지정 문자열에서 생성
{{ DateTime.fromFormat("15/01/2024", "dd/MM/yyyy") }}

// 밀리초 타임스탬프에서
{{ DateTime.fromMillis(1705315800000) }}

// 초 타임스탬프에서
{{ DateTime.fromSeconds(1705315800) }}

// SQL 날짜에서
{{ DateTime.fromSQL("2024-01-15 10:30:00") }}
```

### 날짜 형식화

```javascript
// 기본 ISO 형식
{{ $now.toISO() }}
// "2024-01-15T10:30:00.000+09:00"

// 날짜만
{{ $now.toISODate() }}
// "2024-01-15"

// 시간만
{{ $now.toISOTime() }}
// "10:30:00.000+09:00"

// 커스텀 형식
{{ $now.toFormat("yyyy-MM-dd HH:mm:ss") }}
// "2024-01-15 10:30:00"

{{ $now.toFormat("yyyy년 MM월 dd일") }}
// "2024년 01월 15일"

{{ $now.toFormat("EEE, MMM d, yyyy") }}
// "Mon, Jan 15, 2024"

// 로케일 형식
{{ $now.toLocaleString(DateTime.DATE_FULL) }}
// "January 15, 2024"

{{ $now.toLocaleString(DateTime.DATETIME_MED) }}
// "Jan 15, 2024, 10:30 AM"
```

### 날짜 계산

```javascript
// 더하기
{{ $now.plus({ days: 7 }) }}
{{ $now.plus({ hours: 2, minutes: 30 }) }}
{{ $now.plus({ weeks: 1, days: 3 }) }}

// 빼기
{{ $now.minus({ months: 1 }) }}
{{ $now.minus({ years: 1, days: 5 }) }}

// 특정 단위의 시작
{{ $now.startOf("day") }}
// 오늘 00:00:00

{{ $now.startOf("month") }}
// 이번 달 1일 00:00:00

{{ $now.startOf("week") }}
// 이번 주 월요일 00:00:00

{{ $now.startOf("year") }}
// 올해 1월 1일 00:00:00

// 특정 단위의 끝
{{ $now.endOf("day") }}
// 오늘 23:59:59.999

{{ $now.endOf("month") }}
// 이번 달 마지막 날 23:59:59.999
```

### 날짜 비교

```javascript
// 차이 계산
{{ $now.diff($json.createdAt, "days") }}
// 일 단위 차이

{{ $now.diff($json.startDate, ["years", "months", "days"]) }}
// { years: 1, months: 2, days: 15 }

// 비교
{{ $now > $json.deadline }}
{{ $json.startDate <= $json.endDate }}

// 동일 여부
{{ $now.hasSame($json.otherDate, "day") }}
// 같은 날인지
```

### 날짜 속성

```javascript
// 년/월/일
{{ $now.year }}
{{ $now.month }}
// 1-12

{{ $now.day }}
// 1-31

// 요일
{{ $now.weekday }}
// 1(월요일) - 7(일요일)

{{ $now.weekdayLong }}
// "Monday"

// 시간
{{ $now.hour }}
// 0-23

{{ $now.minute }}
// 0-59

{{ $now.second }}
// 0-59

// 분기
{{ $now.quarter }}
// 1-4

// 주차
{{ $now.weekNumber }}
// 1-53
```

### 타임존 처리

```javascript
// 타임존 설정
{{ $now.setZone("America/New_York") }}
{{ $now.setZone("Asia/Seoul") }}

// UTC로 변환
{{ $now.toUTC() }}

// 로컬 시간으로
{{ $now.toLocal() }}

// 타임존 정보
{{ $now.zoneName }}
// "Asia/Seoul"

{{ $now.offset }}
// 분 단위 오프셋 (예: 540)
```

## 조건부 편의 함수

### $if 함수

n8n 전용 조건부 헬퍼 함수

```javascript
// 기본 사용
{{ $if(condition, trueValue, falseValue) }}

// 예시
{{ $if($json.score >= 80, "합격", "불합격") }}
{{ $if($json.isPremium, "VIP", "일반") }}
{{ $if($itemIndex === 0, "첫 번째", "나머지") }}

// 중첩 사용
{{ $if($json.grade === "A", "최우수",
    $if($json.grade === "B", "우수",
    $if($json.grade === "C", "보통", "미흡"))) }}

// 객체 반환
{{ $if($json.hasDiscount, { price: $json.price * 0.9 }, { price: $json.price }) }}
```

### 삼항 연산자

JavaScript 표준 삼항 연산자도 사용 가능

```javascript
// 기본 형식
{{ condition ? trueValue : falseValue }}

// 예시
{{ $json.active ? "활성" : "비활성" }}
{{ $json.count > 0 ? `${$json.count}개` : "없음" }}

// 중첩
{{ $json.status === "success" ? "성공" :
   $json.status === "pending" ? "대기중" : "실패" }}
```

### Null 병합 및 옵셔널 체이닝

```javascript
// Null 병합 연산자 (??)
{{ $json.name ?? "이름 없음" }}
{{ $json.value ?? 0 }}
{{ $json.config?.timeout ?? 30 }}

// 논리 OR (||) - falsy 값 처리
{{ $json.title || "제목 없음" }}
{{ $json.count || 0 }}

// 옵셔널 체이닝 (?.)
{{ $json.user?.profile?.avatar?.url }}
{{ $json.items?.[0]?.name }}
{{ $json.callback?.() }}

// 조합
{{ $json.user?.email ?? $json.user?.username ?? "알 수 없음" }}
```

## 배열 편의 함수

### 배열 생성

```javascript
// 범위 생성
{{ Array.from({ length: 10 }, (_, i) => i) }}
// [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

{{ Array.from({ length: 5 }, (_, i) => i + 1) }}
// [1, 2, 3, 4, 5]

// 반복 값
{{ Array(3).fill("item") }}
// ["item", "item", "item"]

// 스프레드
{{ [...$json.array1, ...$json.array2] }}
```

### 배열 체이닝

```javascript
// 여러 메서드 체이닝
{{ $json.users
  .filter(u => u.active)
  .map(u => u.email)
  .sort()
  .slice(0, 10) }}

// 복잡한 변환
{{ $json.items
  .filter(item => item.quantity > 0)
  .map(item => ({
    ...item,
    total: item.price * item.quantity
  }))
  .sort((a, b) => b.total - a.total) }}
```

### 배열 유틸리티

```javascript
// 중복 제거
{{ [...new Set($json.tags)] }}

// 배열 평탄화
{{ $json.nested.flat() }}
{{ $json.deepNested.flat(Infinity) }}

// 배열 압축 (zip)
{{ $json.keys.map((key, i) => [key, $json.values[i]]) }}

// 배열 분할 (chunk)
{{ Array.from(
  { length: Math.ceil($json.items.length / 10) },
  (_, i) => $json.items.slice(i * 10, (i + 1) * 10)
) }}
```

## 문자열 편의 함수

### 템플릿 리터럴

```javascript
// 기본 사용
{{ `안녕하세요, ${$json.name}님` }}
{{ `총 ${$json.count}개의 항목` }}

// 표현식 포함
{{ `합계: ${$json.items.reduce((sum, item) => sum + item.price, 0)}원` }}

// 여러 줄
{{ `이름: ${$json.name}
이메일: ${$json.email}
전화: ${$json.phone}` }}

// 중첩
{{ `사용자 ${$json.id}: ${$json.active ? "활성" : "비활성"}` }}
```

### 정규식 헬퍼

```javascript
// 매칭 테스트
{{ /^\d{3}-\d{4}-\d{4}$/.test($json.phone) }}

// 추출
{{ $json.text.match(/\d+/g) }}
// 모든 숫자 추출

{{ $json.email.match(/^(.+)@(.+)$/) }}
// 그룹 매칭

// 치환
{{ $json.text.replace(/\s+/g, " ") }}
// 여러 공백을 하나로

{{ $json.html.replace(/<[^>]*>/g, "") }}
// HTML 태그 제거
```

### URL 처리

```javascript
// URL 파싱
{{ new URL($json.url).hostname }}
{{ new URL($json.url).pathname }}
{{ new URL($json.url).searchParams.get("id") }}

// URL 생성
{{ `https://api.example.com/users/${$json.userId}?token=${$json.token}` }}

// 파라미터 인코딩
{{ encodeURIComponent($json.value) }}
{{ decodeURIComponent($json.encoded) }}

// Base64
{{ btoa($json.string) }}
// 인코딩

{{ atob($json.base64) }}
// 디코딩
```

## 객체 편의 함수

### 객체 디스트럭처링

```javascript
// 스프레드 연산자
{{ { ...$json.user, role: "admin" } }}
// 속성 추가/덮어쓰기

{{ { ...$json.defaults, ...$json.custom } }}
// 객체 병합

// Rest 파라미터 (Code 노드에서)
const { name, email, ...rest } = $json.user;
```

### 동적 속성

```javascript
// 계산된 속성명
{{ { [$json.key]: $json.value } }}

// 동적 객체 생성
{{ $json.fields.reduce((obj, field) =>
  ({ ...obj, [field.name]: field.value }), {}
) }}
```

### 객체 변환

```javascript
// 키 변환
{{ Object.fromEntries(
  Object.entries($json.data).map(([k, v]) => [k.toUpperCase(), v])
) }}

// 값 변환
{{ Object.fromEntries(
  Object.entries($json.prices).map(([k, v]) => [k, v * 1.1])
) }}

// 필터링
{{ Object.fromEntries(
  Object.entries($json.data).filter(([k, v]) => v !== null)
) }}
```

## 유효성 검증 함수

### 타입 검증

```javascript
// 타입 체크
{{ typeof $json.value === "string" }}
{{ typeof $json.count === "number" }}
{{ typeof $json.flag === "boolean" }}

// 배열 체크
{{ Array.isArray($json.items) }}

// Null/Undefined 체크
{{ $json.value !== null && $json.value !== undefined }}
{{ $json.value != null }}

// 객체 체크
{{ typeof $json.data === "object" && !Array.isArray($json.data) && $json.data !== null }}
```

### 값 검증

```javascript
// 이메일 형식
{{ /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($json.email) }}

// 전화번호 형식
{{ /^\d{3}-\d{3,4}-\d{4}$/.test($json.phone) }}

// URL 형식
{{ /^https?:\/\/.+/.test($json.url) }}

// 숫자 범위
{{ $json.age >= 0 && $json.age <= 150 }}

// 문자열 길이
{{ $json.password.length >= 8 }}

// 날짜 유효성
{{ !isNaN(new Date($json.date).getTime()) }}
```

### 빈 값 체크

```javascript
// 빈 문자열
{{ $json.text.trim() !== "" }}

// 빈 배열
{{ $json.items.length > 0 }}

// 빈 객체
{{ Object.keys($json.data).length > 0 }}

// Falsy 체크
{{ Boolean($json.value) }}
{{ !!$json.value }}
```

## 에러 처리 함수

### Try-Catch 패턴

```javascript
// IIFE 활용
{{ (() => {
  try {
    return JSON.parse($json.jsonString);
  } catch (error) {
    return {};
  }
})() }}

// 안전한 파싱
{{ (() => {
  try {
    return new Date($json.dateString).toISOString();
  } catch {
    return null;
  }
})() }}
```

### 기본값 제공

```javascript
// Null 체크 후 기본값
{{ $json.value ?? "기본값" }}

// Falsy 체크 후 기본값
{{ $json.value || "기본값" }}

// 안전한 체이닝
{{ $json.user?.profile?.bio ?? "자기소개 없음" }}

// 배열 안전 접근
{{ $json.items?.[0] ?? { name: "기본 항목" } }}
```

## 수학 편의 함수

### 통계 함수

```javascript
// 평균
{{ $json.numbers.reduce((sum, n) => sum + n, 0) / $json.numbers.length }}

// 중앙값
{{ (() => {
  const sorted = [...$json.numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
})() }}

// 최빈값
{{ (() => {
  const freq = {};
  $json.numbers.forEach(n => freq[n] = (freq[n] || 0) + 1);
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
})() }}
```

### 범위 및 클램핑

```javascript
// 클램핑 (범위 제한)
{{ Math.max(min, Math.min($json.value, max)) }}

// 정규화 (0-1 범위로)
{{ ($json.value - min) / (max - min) }}

// 퍼센트 계산
{{ Math.round(($json.current / $json.total) * 100) }}
```

## 포맷팅 함수

### 숫자 포맷팅

```javascript
// 천 단위 구분
{{ $json.amount.toLocaleString("ko-KR") }}
// "1,234,567"

// 통화 형식
{{ $json.price.toLocaleString("ko-KR", {
  style: "currency",
  currency: "KRW"
}) }}
// "₩1,000"

// 소수점 고정
{{ $json.value.toFixed(2) }}
// "99.99"

// 백분율
{{ ($json.rate * 100).toFixed(1) + "%" }}
// "85.5%"
```

### 파일 크기 포맷팅

```javascript
// 바이트를 읽기 쉬운 형식으로
{{ (() => {
  const bytes = $json.fileSize;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i];
})() }}
```

### 시간 경과 표시

```javascript
// 상대 시간
{{ (() => {
  const seconds = $now.diff($json.createdAt, "seconds").seconds;
  if (seconds < 60) return `${Math.floor(seconds)}초 전`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  return `${Math.floor(seconds / 86400)}일 전`;
})() }}
```

## 고급 유틸리티

### 랜덤 ID 생성

```javascript
// UUID 형식 (간단 버전)
{{ `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }}

// 랜덤 문자열
{{ Math.random().toString(36).substring(2, 15) }}
```

### 해시 함수 (Code 노드)

```javascript
// SHA-256 예시 (crypto 모듈 사용)
const crypto = require('crypto');
return {
  hash: crypto.createHash('sha256').update($json.data).digest('hex')
};
```

### 디바운스/스로틀 (Code 노드)

```javascript
// 단순 지연
await new Promise(resolve => setTimeout(resolve, 1000));

// 배치 처리 간 지연
for (let i = 0; i < items.length; i += 10) {
  const batch = items.slice(i, i + 10);
  // 배치 처리
  await new Promise(resolve => setTimeout(resolve, 500));
}
```

## 참고 자료

- [Luxon Documentation](https://moment.github.io/luxon/)
- [n8n Built-in Methods](https://docs.n8n.io/code/builtin/overview/)
- [n8n Date and Time with Luxon](https://docs.n8n.io/code/cookbook/luxon/)
- [MDN JavaScript Reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

## 결론

n8n 내장 편의 함수를 활용하면 복잡한 로직을 간결하게 표현 가능함.
날짜/시간 처리, 조건부 로직, 배열/문자열/객체 조작 등 다양한 작업을 효율적으로 수행 가능함.
이러한 함수들을 조합하여 강력하고 유지보수 가능한 워크플로우 구축 가능함.
