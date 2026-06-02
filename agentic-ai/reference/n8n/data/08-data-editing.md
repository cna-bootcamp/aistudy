# Data Editing

## 개요

n8n에서 Data Editing은 workflow의 node 간 데이터를 변환하고 수정하는 핵심 기능임.
각 node의 출력 데이터를 다음 node에 맞게 가공하여 자동화 프로세스를 구축함.

## 주요 편집 방법

### Expression 사용

- `{{ }}` 구문으로 데이터 참조 및 변환 가능
- JavaScript 표현식 지원으로 복잡한 로직 구현
- 예시: `{{ $json.name.toUpperCase() }}`

### Code Node 활용

- JavaScript 또는 Python 코드로 복잡한 데이터 처리 수행
- 전체 데이터셋에 대한 반복 작업 가능
- 외부 라이브러리 import 지원

### Set Node로 필드 매핑

- 입력 데이터의 특정 필드를 추출하여 새로운 구조로 재구성
- 필드 이름 변경, 값 변환, 조건부 매핑 지원
- UI 기반 drag-and-drop 인터페이스 제공

### Function 및 Function Item Node

- 각 item별로 또는 전체 데이터에 대해 커스텀 JavaScript 함수 실행
- `$item()`, `$input()` 등 헬퍼 함수 사용 가능

## 데이터 구조 이해

### JSON 기본 구조

```json
[
  {
    "json": {
      "field1": "value1",
      "field2": "value2"
    }
  }
]
```

### Binary Data

- 파일, 이미지 등 바이너리 데이터는 별도 `binary` 필드에 저장
- `$binary` 표현식으로 접근

## 편집 Best Practice

1. **단순함 유지**: 가능한 built-in node 활용 (Set, Split, Merge 등)
2. **재사용성**: 공통 로직은 Code node로 모듈화
3. **테스트**: Pinned data로 편집 결과 즉시 확인
4. **에러 처리**: try-catch 구문으로 예외 상황 대비

## 주요 Helper 함수

| 함수 | 설명 |
|------|------|
| `$json` | 현재 item의 JSON 데이터 |
| `$binary` | 현재 item의 binary 데이터 |
| `$item(index)` | 특정 index의 item 참조 |
| `$input` | 전체 input 데이터 배열 |
| `$now` | 현재 timestamp |
| `$workflow` | Workflow metadata |

## 실전 예제

### 이름 대문자 변환

```javascript
// Code node
for (const item of $input.all()) {
  item.json.name = item.json.name.toUpperCase();
}
return $input.all();
```

### 조건부 필드 추가

```javascript
// Expression in Set node
{{ $json.age >= 18 ? 'adult' : 'minor' }}
```

### 배열 필터링

```javascript
// Code node
return $input.all().filter(item => item.json.status === 'active');
```

## 참고사항

- Expression editor에서 자동완성 기능 활용
- 복잡한 변환은 여러 node로 분할하여 가독성 향상
- 성능 고려: 대용량 데이터는 streaming 방식 검토
