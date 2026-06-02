# Objects

## 개요

n8n에서 Objects는 JSON 형식의 key-value 쌍 데이터 구조를 의미함.
Workflow 내에서 데이터를 구조화하고 접근하며 변환하는 기본 단위로 활용됨.

## Object 기본 구조

### JSON Object

```json
{
  "name": "John Doe",
  "age": 30,
  "email": "john@example.com",
  "address": {
    "city": "Seoul",
    "country": "Korea"
  },
  "tags": ["customer", "premium"]
}
```

### n8n Item 구조

```json
[
  {
    "json": {
      "id": 1,
      "name": "Product A"
    },
    "binary": {}
  }
]
```

- `json`: 실제 데이터 객체
- `binary`: 바이너리 데이터 (파일, 이미지 등)

## Object 접근 방법

### Dot Notation

가장 일반적인 object 속성 접근 방법.

```javascript
// Expression에서
{{ $json.name }}
{{ $json.address.city }}

// Code node에서
const userName = item.json.name;
const city = item.json.address.city;
```

### Bracket Notation

동적 키 또는 특수문자 포함 키 접근.

```javascript
// 동적 키
{{ $json[$parameter.fieldName] }}

// 공백 포함 키
{{ $json["full name"] }}

// 숫자로 시작하는 키
{{ $json["2024-revenue"] }}
```

### Optional Chaining

존재하지 않을 수 있는 속성 안전하게 접근.

```javascript
// JavaScript optional chaining
{{ $json.user?.profile?.avatar }}

// Null인 경우 undefined 반환 (에러 없음)
```

## Object 조작

### 속성 추가/수정

```javascript
// Code node
for (const item of $input.all()) {
  item.json.newField = 'new value';
  item.json.existingField = 'updated value';
}
return $input.all();
```

### 속성 삭제

```javascript
// 특정 속성 제거
delete item.json.sensitiveData;

// 여러 속성 제거
const { password, ssn, ...cleanData } = item.json;
return [{ json: cleanData }];
```

### Object 병합

```javascript
// Spread operator
const merged = {
  ...item.json,
  ...additionalData,
  status: 'updated' // 명시적 override
};

// Object.assign
const result = Object.assign({}, item.json, { newField: 'value' });
```

### Nested Object 생성

```javascript
// Code node
return [{
  json: {
    user: {
      profile: {
        name: 'John',
        settings: {
          theme: 'dark',
          notifications: true
        }
      }
    }
  }
}];
```

## Object 변환 패턴

### Flattening (중첩 구조 평탄화)

```javascript
// 중첩된 object를 1단계로 평탄화
const flatten = (obj, prefix = '') => {
  return Object.keys(obj).reduce((acc, key) => {
    const newKey = prefix ? `${prefix}_${key}` : key;

    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(acc, flatten(obj[key], newKey));
    } else {
      acc[newKey] = obj[key];
    }
    return acc;
  }, {});
};

// 입력: { user: { name: "John", age: 30 } }
// 출력: { user_name: "John", user_age: 30 }
```

### Restructuring (구조 재구성)

```javascript
// 특정 필드만 추출하여 새 구조 생성
const restructured = {
  userId: item.json.id,
  fullName: `${item.json.firstName} ${item.json.lastName}`,
  contact: {
    email: item.json.email,
    phone: item.json.phoneNumber
  }
};
```

### Grouping (그룹화)

```javascript
// 배열을 특정 키로 그룹화
const grouped = $input.all().reduce((acc, item) => {
  const key = item.json.category;
  if (!acc[key]) acc[key] = [];
  acc[key].push(item.json);
  return acc;
}, {});

return [{ json: grouped }];
```

## 고급 Object 처리

### Deep Clone (깊은 복사)

```javascript
// 원본 수정 방지
const cloned = JSON.parse(JSON.stringify(item.json));
cloned.nested.value = 'modified'; // 원본에 영향 없음
```

### Object 비교

```javascript
// 간단한 비교
JSON.stringify(obj1) === JSON.stringify(obj2);

// 순서 무관 비교 (lodash 스타일)
const isEqual = (obj1, obj2) => {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  return keys1.every(key => obj1[key] === obj2[key]);
};
```

### Dynamic Key 생성

```javascript
// 계산된 속성명
const dynamicKey = 'user_' + item.json.id;
return [{
  json: {
    [dynamicKey]: item.json.data
  }
}];
```

### Object Validation

```javascript
// 필수 필드 검증
const requiredFields = ['name', 'email', 'phone'];
const isValid = requiredFields.every(field =>
  item.json[field] !== undefined && item.json[field] !== ''
);

if (!isValid) {
  throw new Error('Missing required fields');
}
```

## Set Node를 활용한 Object 조작

### 필드 매핑

UI에서 drag-and-drop으로 필드 매핑:

```
Source Field → Destination Field
$json.customer_name → name
$json.customer_email → email
$json.order_total → amount
```

### 계산 필드 추가

```javascript
// Expression에서 계산
{{ $json.price * $json.quantity }}
{{ $json.firstName + ' ' + $json.lastName }}
{{ new Date($json.timestamp).toISOString() }}
```

## 실전 활용 예제

### API 응답 변환

```javascript
// 외부 API 응답을 내부 스키마로 변환
const transformed = {
  id: item.json.userId,
  name: item.json.fullName,
  createdAt: new Date(item.json.created_timestamp).toISOString(),
  metadata: {
    source: 'external_api',
    importedAt: new Date().toISOString()
  }
};
```

### 조건부 Object 생성

```javascript
// 조건에 따라 다른 구조 반환
const result = {
  id: item.json.id,
  type: item.json.type,
  ...(item.json.type === 'premium' && {
    benefits: ['feature1', 'feature2']
  }),
  ...(item.json.verified && {
    badge: 'verified'
  })
};
```

### Object 배열 변환

```javascript
// Object를 배열로 변환
const entries = Object.entries(item.json).map(([key, value]) => ({
  field: key,
  value: value
}));

// 배열을 Object로 변환
const obj = items.reduce((acc, item) => {
  acc[item.json.key] = item.json.value;
  return acc;
}, {});
```

## Best Practice

### 1. 명확한 네이밍

```javascript
// Bad
const d = item.json.data;
const x = d.x;

// Good
const userData = item.json.user;
const userName = userData.name;
```

### 2. Null Safety

```javascript
// 항상 존재 여부 확인
const email = item.json?.user?.contact?.email ?? 'no-email@example.com';
```

### 3. 불변성 유지

```javascript
// Bad: 원본 수정
item.json.status = 'updated';

// Good: 새 객체 생성
return [{
  json: {
    ...item.json,
    status: 'updated'
  }
}];
```

### 4. 타입 체크

```javascript
// Object인지 확인
if (typeof item.json.data === 'object' && item.json.data !== null) {
  // Object 처리
}
```

## 주의사항

1. **순환 참조**: `JSON.stringify()`는 순환 참조 시 에러 발생
2. **프로토타입 체인**: `hasOwnProperty()` 사용하여 자체 속성만 체크
3. **성능**: 대량 Object 처리 시 메모리 사용량 고려
4. **타입 일관성**: 동일 키에 대해 일관된 타입 유지

## 참고사항

- n8n Expression에서는 JavaScript object 메서드 대부분 사용 가능
- `Object.keys()`, `Object.values()`, `Object.entries()` 활용 권장
- Lodash 라이브러리 메서드도 Code node에서 사용 가능 (일부 제한)
