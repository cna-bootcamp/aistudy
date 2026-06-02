# Data Filtering

## 개요

Data Filtering은 workflow에서 특정 조건을 만족하는 데이터만 선택적으로 처리하는 기능임.
불필요한 데이터를 제거하고 필요한 항목만 다음 단계로 전달하여 효율적인 자동화 구현.

## 주요 Filtering 방법

### IF Node

조건에 따라 workflow를 분기하는 가장 기본적인 필터링 방법.

#### 기본 구조

```
Input → IF node → True branch
                → False branch
```

#### 조건 설정

- **Comparison**: 값 비교 (equals, not equals, larger, smaller 등)
- **Boolean**: true/false 체크
- **Existence**: 필드 존재 여부 확인
- **Expression**: 복잡한 JavaScript 표현식

#### 예시

```javascript
// Age가 18 이상인지 체크
{{ $json.age >= 18 }}

// Email 필드가 존재하는지 체크
{{ $json.email !== undefined }}

// Status가 'active' 또는 'pending'인지 체크
{{ ['active', 'pending'].includes($json.status) }}
```

### Switch Node

다중 조건 분기를 위한 고급 필터링.

#### 특징

- 3개 이상의 분기 처리
- Fall-through 옵션 지원
- Mode 선택: Rules 또는 Expression

#### 사용 예

```
Input → Switch node → Route 0 (status = 'new')
                    → Route 1 (status = 'processing')
                    → Route 2 (status = 'completed')
                    → Fallback (기타)
```

### Filter Node

배열 데이터에서 조건을 만족하는 항목만 추출.

#### 동작 방식

- 입력: 여러 item의 배열
- 조건: JavaScript expression 또는 comparison rules
- 출력: 조건을 만족하는 item만 포함된 배열

#### 예시

```javascript
// Code로 직접 필터링
return $input.all().filter(item => item.json.amount > 100);
```

### Code Node를 활용한 고급 필터링

복잡한 조건이나 다중 필드 검증 시 사용.

```javascript
// 복합 조건 필터링
const filtered = [];

for (const item of $input.all()) {
  const { status, amount, date } = item.json;

  // 복합 조건: 활성 상태 AND 금액 > 100 AND 최근 30일 이내
  const isRecent = new Date(date) > new Date(Date.now() - 30*24*60*60*1000);

  if (status === 'active' && amount > 100 && isRecent) {
    filtered.push(item);
  }
}

return filtered;
```

## 조건 연산자

### 비교 연산자

| 연산자 | 설명 | 예시 |
|--------|------|------|
| `===` | 일치 | `{{ $json.status === 'active' }}` |
| `!==` | 불일치 | `{{ $json.type !== 'spam' }}` |
| `>` | 초과 | `{{ $json.age > 18 }}` |
| `<` | 미만 | `{{ $json.price < 1000 }}` |
| `>=` | 이상 | `{{ $json.score >= 80 }}` |
| `<=` | 이하 | `{{ $json.quantity <= 100 }}` |

### 논리 연산자

```javascript
// AND 조건
{{ $json.status === 'active' && $json.verified === true }}

// OR 조건
{{ $json.type === 'urgent' || $json.priority > 5 }}

// NOT 조건
{{ !$json.deleted }}

// 복합 조건
{{ ($json.age >= 18 && $json.age < 65) || $json.veteran === true }}
```

### 존재 여부 체크

```javascript
// 필드 존재 확인
{{ $json.email !== undefined }}

// null/undefined 체크
{{ $json.value != null }}

// 빈 문자열 체크
{{ $json.name && $json.name.trim() !== '' }}

// 배열 비어있지 않음
{{ $json.items && $json.items.length > 0 }}
```

## 고급 Filtering 패턴

### 날짜 기반 필터링

```javascript
// 최근 7일 이내 데이터
const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000);
return $input.all().filter(item =>
  new Date(item.json.createdAt) > sevenDaysAgo
);
```

### 정규식 필터링

```javascript
// 이메일 형식 검증
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
return $input.all().filter(item =>
  emailRegex.test(item.json.email)
);
```

### 중복 제거

```javascript
// 특정 필드 기준 중복 제거
const seen = new Set();
return $input.all().filter(item => {
  const key = item.json.userId;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
```

### 범위 필터링

```javascript
// 가격 범위: 100 ~ 500
return $input.all().filter(item => {
  const price = item.json.price;
  return price >= 100 && price <= 500;
});
```

## 실전 활용 시나리오

### 이메일 필터링

```
Gmail → Filter (unread emails) → IF (has attachment) → Process
                                                      → Archive
```

### 데이터 검증

```
HTTP Request → Filter (valid records) → Database Insert
            → Filter (invalid records) → Error Notification
```

### 우선순위 처리

```
Webhook → Switch (priority level) → High → Immediate Action
                                  → Medium → Queue
                                  → Low → Batch Process
```

## Best Practice

### 성능 최적화

1. **조기 필터링**: Workflow 초반에 불필요한 데이터 제거
2. **인덱스 활용**: 데이터베이스 쿼리 시 WHERE 절 활용
3. **배치 처리**: 대량 데이터는 chunk 단위로 필터링

### 가독성 향상

```javascript
// Bad: 복잡한 한 줄 조건
{{ $json.a && $json.b || $json.c && ($json.d > 5 || $json.e) }}

// Good: Code node로 명확하게 표현
const meetsConditionA = item.json.a && item.json.b;
const meetsConditionB = item.json.c && (item.json.d > 5 || item.json.e);
return meetsConditionA || meetsConditionB;
```

### 에러 처리

```javascript
// 안전한 필터링 (null check 포함)
return $input.all().filter(item => {
  try {
    return item.json?.status === 'active' && item.json?.amount > 0;
  } catch (error) {
    console.error('Filter error:', error);
    return false; // 에러 발생 시 해당 item 제외
  }
});
```

## 주의사항

1. **빈 결과 처리**: Filter 결과가 비어있을 경우 downstream node 에러 가능성
2. **타입 체크**: 문자열 "100"과 숫자 100은 다름 (`===` 사용 권장)
3. **Case sensitivity**: 문자열 비교 시 대소문자 구분 (`toLowerCase()` 활용)
4. **Null 처리**: Optional chaining (`?.`) 또는 명시적 null check 필요

## 참고사항

- IF/Switch node는 단일 item을 분기하는 반면, Filter는 배열 전체를 필터링
- Expression에서 `$json`은 현재 item, `$input.all()`은 전체 배열
- Filter 조건은 재사용 가능하도록 Code node로 모듈화 권장
