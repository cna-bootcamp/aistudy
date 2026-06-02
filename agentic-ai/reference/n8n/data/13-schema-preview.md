# Schema Preview

## 개요

Schema Preview는 n8n에서 workflow의 데이터 구조를 시각적으로 미리 확인하는 기능임.
각 node의 입출력 데이터 형태를 사전에 파악하여 데이터 매핑 및 변환 작업을 효율적으로 수행 가능.

## Schema Preview의 목적

### 데이터 구조 이해

- Node 실행 전에 예상 데이터 형태 확인
- 필드명, 데이터 타입, 중첩 구조 파악
- API 응답 스키마 사전 검토

### 매핑 효율성 향상

- Drag-and-drop 필드 매핑 시 정확한 경로 확인
- 오타 및 잘못된 참조 사전 방지
- 복잡한 nested object 탐색 용이

### 개발 속도 향상

- 실제 실행 없이 구조 확인
- 빠른 프로토타이핑
- 데이터 변환 로직 사전 설계

## Schema 확인 방법

### 자동 스키마 감지

```
Node 설정 → Input/Output Schema 탭 → 자동 생성된 스키마 확인
```

- 이전 node의 실행 결과 기반 자동 추론
- Pinned data 기반 스키마 생성
- Sample data 제공 시 즉시 반영

### Manual Schema 정의

```json
// 수동으로 예상 스키마 정의
{
  "type": "object",
  "properties": {
    "userId": { "type": "number" },
    "userName": { "type": "string" },
    "email": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" }
  }
}
```

### Sample Data 활용

```javascript
// Code node에 sample data 제공
// 스키마가 자동으로 추론됨
const sampleOutput = {
  id: 1,
  name: "Sample User",
  metadata: {
    registered: true,
    score: 95.5
  }
};
```

## Schema 구조

### 기본 데이터 타입

| 타입 | 설명 | 예시 |
|------|------|------|
| `string` | 문자열 | "Hello" |
| `number` | 숫자 (정수/실수) | 42, 3.14 |
| `boolean` | 불린 | true, false |
| `object` | 객체 | { "key": "value" } |
| `array` | 배열 | [1, 2, 3] |
| `null` | null 값 | null |

### Nested Schema

```json
{
  "user": {
    "type": "object",
    "properties": {
      "profile": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "age": { "type": "number" }
        }
      },
      "tags": {
        "type": "array",
        "items": { "type": "string" }
      }
    }
  }
}
```

### Array Schema

```json
{
  "users": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "id": { "type": "number" },
        "name": { "type": "string" }
      }
    }
  }
}
```

## Schema 활용

### Set Node에서 필드 매핑

Schema preview를 보면서 drag-and-drop으로 필드 연결:

```
Source Schema          →    Destination Schema
user.profile.name      →    fullName
user.contact.email     →    email
user.metadata.score    →    rating
```

### IF Node 조건 설정

```javascript
// Schema를 보고 정확한 경로 확인
{{ $json.user.subscription.status === 'active' }}

// 중첩된 배열 체크
{{ $json.orders.length > 0 }}
```

### Code Node 자동완성

```javascript
// Schema 기반 IntelliSense 제공 (일부 환경)
const userName = item.json.user.profile.name; // 자동완성
const isActive = item.json.status === 'active';
```

## 실전 활용 시나리오

### API 통합 사전 설계

```
1. API 문서에서 응답 예시 복사
2. Sample data로 node에 붙여넣기
3. Schema 자동 생성 확인
4. 매핑 작업 수행
```

### 복잡한 데이터 변환

```
HTTP Request (API 호출)
  ↓ Schema: { data: { users: [...] } }
Code Node (추출)
  ↓ Schema: { userId, userName, email }
Set Node (재구성)
  ↓ Schema: { id, name, contact: { email } }
Database Insert
```

### 다중 Source 병합

```
Source A Schema: { orderId, amount }
Source B Schema: { userId, userName }
Merge Node
  ↓ Schema: { orderId, amount, userId, userName }
```

## Schema Validation

### 데이터 검증

```javascript
// Code node - 스키마 준수 확인
const requiredFields = ['id', 'name', 'email'];

for (const item of $input.all()) {
  for (const field of requiredFields) {
    if (!(field in item.json)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}
```

### 타입 체크

```javascript
// 타입 검증
const validateSchema = (data) => {
  if (typeof data.id !== 'number') {
    throw new Error('id must be a number');
  }
  if (typeof data.name !== 'string') {
    throw new Error('name must be a string');
  }
  if (!Array.isArray(data.tags)) {
    throw new Error('tags must be an array');
  }
};
```

## Advanced Schema 기능

### Optional Fields

```json
{
  "properties": {
    "name": { "type": "string" },
    "email": { "type": "string" },
    "phone": {
      "type": "string",
      "optional": true
    }
  }
}
```

### Default Values

```json
{
  "properties": {
    "status": {
      "type": "string",
      "default": "pending"
    },
    "priority": {
      "type": "number",
      "default": 5
    }
  }
}
```

### Enum Values

```json
{
  "properties": {
    "status": {
      "type": "string",
      "enum": ["pending", "active", "completed", "cancelled"]
    }
  }
}
```

## Schema 문서화

### JSDoc 스타일 주석

```javascript
/**
 * User object schema
 * @typedef {Object} User
 * @property {number} id - User ID
 * @property {string} name - Full name
 * @property {string} email - Email address
 * @property {Object} metadata - Additional metadata
 * @property {boolean} metadata.verified - Verification status
 */
```

### Workflow 내 문서화

```
Sticky Note에 주요 schema 정보 기록:

Expected Input Schema:
{
  "orderId": "string",
  "amount": "number",
  "items": "array"
}

Expected Output Schema:
{
  "success": "boolean",
  "transactionId": "string"
}
```

## Best Practice

### 1. Pinned Data로 Schema 고정

```
1. 대표적인 실제 데이터로 node 실행
2. 결과 데이터 pin
3. Schema가 해당 구조로 고정됨
4. 이후 개발 시 일관된 schema 참조
```

### 2. 명확한 필드명 사용

```javascript
// Bad
{ "d": "2024-01-01", "x": 100 }

// Good
{ "orderDate": "2024-01-01", "totalAmount": 100 }
```

### 3. 일관된 네이밍 컨벤션

```javascript
// camelCase 또는 snake_case 일관되게 사용
{ "userId": 1, "userName": "John" }  // camelCase
{ "user_id": 1, "user_name": "John" }  // snake_case
```

### 4. Schema 버전 관리

```
// Workflow 주석에 schema 변경 이력 기록
v1.0: Initial schema
v1.1: Added 'metadata' field
v1.2: Changed 'date' from string to ISO 8601 format
```

## 주의사항

1. **동적 스키마**: 런타임에 필드가 추가/제거되는 경우 preview와 실제가 다를 수 있음
2. **빈 배열**: 빈 배열은 item 타입을 추론할 수 없음 (sample data 필요)
3. **null vs undefined**: JavaScript에서 구분되지만 JSON에서는 null만 유효
4. **대소문자**: 필드명의 대소문자 정확히 일치 필요

## Schema Tools

### JSON Schema Generator

외부 도구로 JSON Schema 자동 생성:

```
Sample JSON → JSON Schema Generator → n8n에 import
```

### Schema Diff

Schema 변경 사항 추적:

```javascript
// 이전 schema와 비교
const oldFields = Object.keys(oldSchema.properties);
const newFields = Object.keys(newSchema.properties);

const added = newFields.filter(f => !oldFields.includes(f));
const removed = oldFields.filter(f => !newFields.includes(f));

console.log('Added fields:', added);
console.log('Removed fields:', removed);
```

## 참고사항

- Schema preview는 개발 시 참고용이며 런타임 검증은 별도 필요
- 복잡한 스키마는 Code node에서 TypeScript interface로 정의 가능
- OpenAPI/Swagger 스키마와 호환 가능 (변환 필요)
- n8n Community nodes는 schema 정의 수준이 다를 수 있음
