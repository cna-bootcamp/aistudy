# UI에서 매핑 (Mapping in the UI)

## 개요

데이터 매핑은 이전 노드의 데이터를 참조하는 것을 의미함.
데이터 변경(변환)은 포함하지 않으며, 참조만 해당됨.

## 매핑 방법

- **표현식 편집기** 사용
- INPUT에서 파라미터로 **드래그 앤 드롭** (표현식이 자동 생성됨)

매핑 및 아이템 링킹 오류에 대한 정보는 Item linking errors를 참조할 것.

## 드래그 앤 드롭 방법

1. 워크플로우를 실행하여 데이터를 로드
2. 데이터를 매핑할 노드를 열기
3. 뷰에 따른 드래그 방법:
   - **Table 뷰**: 테이블 헤딩을 클릭하여 최상위 데이터를, 필드를 클릭하여 중첩 데이터를 매핑
   - **JSON 뷰**: 키를 클릭하여 드래그
   - **Schema 뷰**: 키를 클릭하여 드래그
4. 데이터를 사용할 필드로 아이템을 드래그

## 드래그 앤 드롭의 이해

데이터 매핑은 키 경로를 매핑하고, 키의 값을 필드에 로드함.

예시 데이터:

```json
[
  {
    "fruit": "apples",
    "color": "green"
  }
]
```

`fruit`을 드래그 앤 드롭하면 `{{ $json.fruit }}` 표현식이 생성됨.
노드가 입력 아이템을 순회할 때 필드의 값은 각 아이템의 `fruit` 값이 됨.

## 중첩 데이터 이해

중첩 데이터 예시:

```json
[
  {
    "name": "First item",
    "nested": {
      "example-number-field": 1,
      "example-string-field": "apples"
    }
  },
  {
    "name": "Second item",
    "nested": {
      "example-number-field": 2,
      "example-string-field": "oranges"
    }
  }
]
```

n8n은 이를 테이블 형태로 표시하며, 중첩 필드도 드래그 앤 드롭으로 매핑 가능함.
