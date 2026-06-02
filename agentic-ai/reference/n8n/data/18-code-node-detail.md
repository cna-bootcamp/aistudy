# n8n Code 노드 상세 가이드

## 개요

Code 노드는 n8n 워크플로우 내에서 JavaScript 코드를 실행하여 데이터를 처리하는 핵심 기능을 제공함.
복잡한 데이터 변환, 비즈니스 로직 구현, 외부 라이브러리 활용 등이 가능함.

## 기본 구조

### Code 노드 추가

1. 워크플로우 캔버스에서 `+` 버튼 클릭
2. "Code" 검색
3. "Code" 노드 선택

### 기본 템플릿

```javascript
// Run Once for All Items (기본 모드)
// 입력: $input.all() - 모든 항목의 배열
// 출력: 항목 배열 반환

return $input.all();
```

```javascript
// Run Once for Each Item (항목별 실행 모드)
// 입력: $input.item - 현재 항목
// 출력: 단일 항목 반환

return $input.item;
```

## 실행 모드

### Run Once for All Items (모든 항목 일괄 실행)

코드가 한 번만 실행되며, 모든 입력 항목에 접근 가능함.

```javascript
// 모든 항목 접근
const items = $input.all();

// 처리 및 반환
return items.map(item => ({
  json: {
    ...item.json,
    processed: true,
    timestamp: new Date().toISOString()
  }
}));
```

**사용 사례:**
- 배열 전체를 한 번에 처리
- 집계 연산 (합계, 평균 등)
- 항목 간 비교 또는 그룹화
- API 호출 횟수 최소화

### Run Once for Each Item (항목별 실행)

각 항목마다 코드가 개별적으로 실행됨.

```javascript
// 현재 항목 접근
const item = $input.item;

// 처리 및 반환
return {
  json: {
    ...item.json,
    itemIndex: $itemIndex,
    processed: true
  }
};
```

**사용 사례:**
- 항목별 독립적인 처리
- 각 항목에 대한 API 호출
- 항목별 조건부 로직
- 개별 에러 처리

## 데이터 접근 방법

### $input 객체

Code 노드에서 입력 데이터에 접근하는 주요 객체

| 메서드 | 설명 | 반환 타입 | 사용 모드 |
|--------|------|-----------|-----------|
| `$input.all()` | 모든 항목 반환 | Array | All Items |
| `$input.first()` | 첫 번째 항목 반환 | Object | All Items |
| `$input.last()` | 마지막 항목 반환 | Object | All Items |
| `$input.item` | 현재 항목 반환 | Object | Each Item |

**항목 구조:**

```javascript
{
  json: {
    // JSON 데이터
  },
  binary: {
    // 바이너리 데이터 (선택)
  },
  pairedItem: {
    // 항목 연결 정보
  }
}
```

### 기본 변수 사용

```javascript
// JSON 데이터 접근
const data = $input.first().json;
const email = data.email;
const userName = data.user?.name;

// 모든 항목의 특정 필드 추출
const emails = $input.all().map(item => item.json.email);

// 항목 인덱스
console.log(`처리 중: ${$itemIndex + 1}번째 항목`);

// 바이너리 데이터 접근
const binary = $input.first().binary;
if (binary?.data) {
  const fileData = binary.data;
}
```

### 다른 노드 데이터 접근

```javascript
// 특정 노드의 데이터
const httpData = $("HTTP Request").all();
const firstResult = $("HTTP Request").first().json;

// 여러 노드 데이터 병합
const userData = $("Get User").first().json;
const orderData = $("Get Orders").all();

return [{
  json: {
    user: userData,
    orders: orderData.map(item => item.json)
  }
}];
```

## 데이터 반환 형식

### 단일 항목 반환

```javascript
// 객체 반환 (자동으로 래핑됨)
return {
  json: {
    result: "success",
    data: processedData
  }
};

// 배열로 래핑하여 반환
return [{
  json: {
    result: "success"
  }
}];
```

### 여러 항목 반환

```javascript
// 배열로 반환
return items.map(item => ({
  json: {
    ...item.json,
    processed: true
  }
}));

// 필터링 후 반환
return $input.all().filter(item => item.json.active);

// 변환 후 반환
return $input.all().map(item => ({
  json: {
    id: item.json.id,
    name: item.json.name.toUpperCase(),
    email: item.json.email.toLowerCase()
  }
}));
```

### 바이너리 데이터 포함 반환

```javascript
// JSON과 바이너리 함께 반환
return [{
  json: {
    fileName: "report.pdf",
    size: buffer.length
  },
  binary: {
    data: {
      data: buffer.toString('base64'),
      mimeType: 'application/pdf',
      fileName: 'report.pdf'
    }
  }
}];
```

## 내장 변수 및 함수

### 워크플로우 메타데이터

```javascript
// 실행 ID
const executionId = $execution.id;

// 워크플로우 정보
const workflowId = $workflow.id;
const workflowName = $workflow.name;

// 이전 노드 정보
const prevNodeName = $prevNode.name;

// 실행 횟수
const runCount = $runIndex;

console.log(`${workflowName} (${executionId}): ${prevNodeName} 완료`);
```

### 날짜/시간 (Luxon)

```javascript
// 현재 시간
const now = $now;
const today = $today;

// 날짜 생성
const { DateTime } = require('luxon');
const specificDate = DateTime.fromISO('2024-01-15');
const customDate = DateTime.fromFormat('15/01/2024', 'dd/MM/yyyy');

// 날짜 계산
const nextWeek = $now.plus({ days: 7 });
const lastMonth = $now.minus({ months: 1 });

// 날짜 형식화
const formatted = $now.toFormat('yyyy-MM-dd HH:mm:ss');
const isoString = $now.toISO();
```

### 환경 변수

```javascript
// 사용자 정의 변수 (읽기 전용)
const apiKey = $vars.apiKey;
const baseUrl = $vars.baseUrl;

// 안전한 접근
const timeout = $vars.timeout ?? 30;
const retries = $vars.maxRetries || 3;
```

## 외부 라이브러리 사용

### 내장 Node.js 모듈

```javascript
// crypto
const crypto = require('crypto');
const hash = crypto.createHash('sha256').update(data).digest('hex');

// fs (self-hosted만 가능)
const fs = require('fs');
const content = fs.readFileSync('/path/to/file', 'utf8');

// path
const path = require('path');
const fileName = path.basename($json.filePath);

// url
const { URL } = require('url');
const parsedUrl = new URL($json.url);
const hostname = parsedUrl.hostname;
```

### npm 패키지 (사전 설치 필요)

```javascript
// axios 예시
const axios = require('axios');

const response = await axios.get('https://api.example.com/data', {
  headers: {
    'Authorization': `Bearer ${$vars.apiToken}`
  }
});

return [{
  json: response.data
}];
```

**주의:** Cloud 버전에서는 npm 패키지 사용이 제한될 수 있음. Self-hosted 환경에서 자유롭게 사용 가능.

## 실용 예제

### 데이터 변환 및 정제

```javascript
// 모든 항목 변환
const items = $input.all();

return items.map(item => {
  const data = item.json;

  return {
    json: {
      // 필드명 변경
      userId: data.user_id,
      userName: data.user_name,

      // 데이터 정제
      email: data.email?.toLowerCase().trim(),
      phone: data.phone?.replace(/[^0-9]/g, ''),

      // 데이터 변환
      createdAt: new Date(data.created_at).toISOString(),
      isActive: data.status === 'active',

      // 계산 필드
      fullName: `${data.first_name} ${data.last_name}`,
      age: new Date().getFullYear() - new Date(data.birth_date).getFullYear()
    }
  };
});
```

### 조건부 처리

```javascript
const items = $input.all();

return items.map(item => {
  const data = item.json;

  // 상태에 따른 처리
  let status, priority;

  if (data.score >= 90) {
    status = 'excellent';
    priority = 'high';
  } else if (data.score >= 70) {
    status = 'good';
    priority = 'medium';
  } else {
    status = 'needs_improvement';
    priority = 'low';
  }

  return {
    json: {
      ...data,
      status,
      priority,
      processed_at: $now.toISO()
    }
  };
});
```

### 그룹화 및 집계

```javascript
const items = $input.all();

// 카테고리별 그룹화
const grouped = items.reduce((acc, item) => {
  const category = item.json.category;

  if (!acc[category]) {
    acc[category] = {
      category,
      items: [],
      total: 0,
      count: 0
    };
  }

  acc[category].items.push(item.json);
  acc[category].total += item.json.amount;
  acc[category].count += 1;

  return acc;
}, {});

// 객체를 배열로 변환
return Object.values(grouped).map(group => ({
  json: {
    ...group,
    average: group.total / group.count
  }
}));
```

### 페이지네이션

```javascript
const allItems = $input.all();
const pageSize = 10;
const totalPages = Math.ceil(allItems.length / pageSize);

// 페이지별로 분할
const pages = [];
for (let i = 0; i < totalPages; i++) {
  const start = i * pageSize;
  const end = start + pageSize;
  const pageItems = allItems.slice(start, end);

  pages.push({
    json: {
      page: i + 1,
      totalPages,
      items: pageItems.map(item => item.json)
    }
  });
}

return pages;
```

### API 호출 (비동기)

```javascript
// async/await 사용
const items = $input.all();
const results = [];

for (const item of items) {
  try {
    const response = await fetch(`https://api.example.com/users/${item.json.userId}`, {
      headers: {
        'Authorization': `Bearer ${$vars.apiToken}`
      }
    });

    const data = await response.json();

    results.push({
      json: {
        ...item.json,
        apiData: data,
        success: true
      }
    });
  } catch (error) {
    results.push({
      json: {
        ...item.json,
        error: error.message,
        success: false
      }
    });
  }
}

return results;
```

### 배치 처리 (지연 포함)

```javascript
const items = $input.all();
const batchSize = 10;
const delayMs = 1000;

const results = [];

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);

  console.log(`Processing batch ${Math.floor(i / batchSize) + 1}...`);

  // 배치 처리
  const batchResults = batch.map(item => ({
    json: {
      ...item.json,
      processed: true,
      batchNumber: Math.floor(i / batchSize) + 1
    }
  }));

  results.push(...batchResults);

  // 다음 배치 전 지연
  if (i + batchSize < items.length) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}

return results;
```

### CSV 생성

```javascript
const items = $input.all();

// CSV 헤더
const headers = ['ID', 'Name', 'Email', 'Phone'];

// CSV 데이터
const csvRows = items.map(item => {
  const data = item.json;
  return [
    data.id,
    `"${data.name}"`,
    data.email,
    data.phone
  ].join(',');
});

// CSV 문자열 생성
const csv = [headers.join(','), ...csvRows].join('\n');

return [{
  json: {
    rowCount: items.length,
    fileName: `export_${$now.toFormat('yyyyMMdd')}.csv`
  },
  binary: {
    data: {
      data: Buffer.from(csv, 'utf-8').toString('base64'),
      mimeType: 'text/csv',
      fileName: `export_${$now.toFormat('yyyyMMdd')}.csv`
    }
  }
}];
```

### 에러 처리

```javascript
const items = $input.all();

return items.map((item, index) => {
  try {
    // 데이터 검증
    if (!item.json.email) {
      throw new Error('Email is required');
    }

    if (!item.json.email.includes('@')) {
      throw new Error('Invalid email format');
    }

    // 처리 로직
    const processed = {
      ...item.json,
      email: item.json.email.toLowerCase(),
      validated: true
    };

    return {
      json: processed
    };

  } catch (error) {
    // 에러 정보 포함하여 반환
    return {
      json: {
        ...item.json,
        error: error.message,
        validated: false,
        itemIndex: index
      }
    };
  }
});
```

## 디버깅

### Console 로그

```javascript
// 기본 로그
console.log('Processing started');
console.log('Item count:', $input.all().length);

// 객체 로그
console.log('Current item:', JSON.stringify($input.first().json, null, 2));

// 변수 확인
console.log({
  executionId: $execution.id,
  workflowName: $workflow.name,
  itemIndex: $itemIndex
});
```

### 중간 결과 반환

```javascript
const items = $input.all();

// 디버그 정보 포함
return items.map(item => ({
  json: {
    original: item.json,
    processed: processData(item.json),
    debug: {
      timestamp: $now.toISO(),
      itemIndex: $itemIndex,
      nodeExecution: $execution.id
    }
  }
}));
```

### Try-Catch 블록

```javascript
try {
  const result = complexOperation($input.all());
  return result;
} catch (error) {
  // 에러 정보 상세히 반환
  return [{
    json: {
      error: true,
      message: error.message,
      stack: error.stack,
      input: $input.all(),
      timestamp: $now.toISO()
    }
  }];
}
```

## 성능 최적화

### 불필요한 복사 피하기

```javascript
// 나쁜 예: 전체 객체 복사
return items.map(item => ({
  json: {
    ...item.json,  // 전체 복사
    newField: 'value'
  }
}));

// 좋은 예: 필요한 필드만 선택
return items.map(item => ({
  json: {
    id: item.json.id,
    name: item.json.name,
    newField: 'value'
  }
}));
```

### 대량 데이터 스트리밍

```javascript
// 한 번에 모든 데이터 처리하지 않기
const CHUNK_SIZE = 100;
const items = $input.all();

// 청크 단위로 처리
for (let i = 0; i < items.length; i += CHUNK_SIZE) {
  const chunk = items.slice(i, i + CHUNK_SIZE);
  // 처리...
}
```

### 캐싱

```javascript
// 반복 계산 피하기
const lookup = new Map();
items.forEach(item => {
  lookup.set(item.json.id, item.json);
});

// 빠른 조회
const user = lookup.get(userId);
```

## 모범 사례

### 1. 명확한 변수명 사용

```javascript
// 나쁜 예
const d = $input.first().json;
const r = process(d);

// 좋은 예
const userData = $input.first().json;
const validatedUser = validateAndTransform(userData);
```

### 2. 함수 분리

```javascript
// 재사용 가능한 함수 정의
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatPhone(phone) {
  return phone.replace(/[^0-9]/g, '');
}

// 메인 로직
const items = $input.all();
return items.map(item => ({
  json: {
    ...item.json,
    email: validateEmail(item.json.email) ? item.json.email : null,
    phone: formatPhone(item.json.phone)
  }
}));
```

### 3. 타입 체크

```javascript
function safeProcess(data) {
  // 타입 확인
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  if (!Array.isArray(data.items)) {
    return null;
  }

  // 안전한 처리
  return data.items.map(item => processItem(item));
}
```

### 4. 주석 활용

```javascript
// 사용자 데이터 검증 및 변환
const items = $input.all();

return items.map(item => {
  const user = item.json;

  // 필수 필드 검증
  if (!user.email || !user.name) {
    return null;
  }

  // 이메일 정규화 (소문자, 공백 제거)
  const normalizedEmail = user.email.toLowerCase().trim();

  // 전화번호 포맷팅 (숫자만 추출)
  const phone = user.phone?.replace(/[^0-9]/g, '') || '';

  // 최종 데이터 구성
  return {
    json: {
      id: user.id,
      name: user.name,
      email: normalizedEmail,
      phone: phone,
      createdAt: $now.toISO()
    }
  };
}).filter(item => item !== null);  // null 제거
```

## 키보드 단축키

| 단축키 | 기능 |
|--------|------|
| `Ctrl + Space` | 자동완성 표시 |
| `Ctrl + /` | 주석 토글 |
| `Ctrl + F` | 찾기 |
| `Ctrl + H` | 찾기 및 바꾸기 |
| `Ctrl + S` | 저장 |
| `Tab` | 들여쓰기 |
| `Shift + Tab` | 내어쓰기 |

## 일반적인 문제 해결

### 1. "Cannot read property of undefined"

```javascript
// 문제 코드
const email = $input.first().json.user.email;

// 해결: 옵셔널 체이닝 사용
const email = $input.first()?.json?.user?.email;

// 또는 기본값 제공
const email = $input.first()?.json?.user?.email ?? 'no-email@example.com';
```

### 2. "Expected array but got object"

```javascript
// 문제: 단일 객체 반환 시 배열로 래핑 필요
return { json: { result: 'success' } };

// 해결
return [{ json: { result: 'success' } }];
```

### 3. 비동기 작업 누락

```javascript
// 문제: await 누락
const data = fetch(url);  // Promise 객체 반환됨

// 해결
const response = await fetch(url);
const data = await response.json();
```

## 참고 자료

- [n8n Code Node 공식 문서](https://docs.n8n.io/code/code-node/)
- [n8n Code Node Reference](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.code/)
- [JavaScript MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- [Node.js Documentation](https://nodejs.org/docs/)
- [Luxon Documentation](https://moment.github.io/luxon/)

## 결론

Code 노드는 n8n에서 가장 강력하고 유연한 데이터 처리 도구임.
JavaScript의 전체 기능을 활용하여 복잡한 로직 구현, 외부 라이브러리 사용, 비동기 작업 처리 등이 가능함.
적절한 에러 처리, 명확한 코드 작성, 성능 최적화를 통해 안정적이고 효율적인 워크플로우 구축 가능함.
