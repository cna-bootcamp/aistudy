# DataFrame Operations

`DataFrame` (테이블) 행과 열에 대한 작업 수행: 스키마 변경, 레코드 변경, 정렬, 필터링.
출력: 선택한 작업 실행 후 수정된 데이터가 포함된 새 `DataFrame`.

## Flow에서 사용

1. **Flow 생성:** 기존 Flow 사용 또는 새 Flow 생성
   - 선행 컴포넌트가 `DataFrame` 출력 생성 필요

2. **DataFrame Operations 추가:** 다른 컴포넌트의 `DataFrame` 출력을 입력에 연결
   - `DataFrame` 출력이 없는 컴포넌트의 경우 **Type Convert** 컴포넌트로 변환
   - 또는 **Parser**, **Data Operations** 등 원본 데이터 타입 처리 컴포넌트 사용

3. **Operations 선택:** 수행할 작업 선택 (예: **Filter**)
   > **Tip**: 작업 하나만 선택 가능. 여러 작업 필요 시 DataFrame Operations 컴포넌트 체이닝.
   > 복잡한 다단계 작업 (스키마 대폭 변경, 피벗 등)은 **Structured Output** 또는 **Smart Transform** 컴포넌트 고려.

4. **파라미터 구성:** 선택한 작업에 따른 파라미터 설정
   - 예: **Filter** 작업 → **Column Name**, **Filter Value**, **Filter Operator** 설정

5. **테스트:** **Run component** 클릭 → **Inspect output**으로 결과 확인
   - Playground에서 확인하려면 **Chat Output** 컴포넌트 연결

참조: [Conditional looping](/loop#conditional-looping)

## DataFrame Operations 파라미터

대부분의 파라미터는 조건부 (특정 작업에만 적용).

**기본 파라미터:**
| Name | Display Name | 설명 |
|------|--------------|------|
| `df` | DataFrame | 입력 `DataFrame` |
| `operation` | Operation | DataFrame에 수행할 작업 |

## 사용 가능한 작업

### Add Column
새 열을 상수 값으로 추가.

| 파라미터 | 설명 |
|----------|------|
| `new_column_name` | 새 열 이름 |
| `new_column_value` | 새 열 값 |

### Drop Column
지정된 열 제거.

| 파라미터 | 설명 |
|----------|------|
| `column_name` | 제거할 열 이름 |

### Filter
지정된 열과 값 기준으로 행 필터링.

| 파라미터 | 설명 |
|----------|------|
| `column_name` | 필터링할 열 이름 |
| `filter_value` | 필터 값 |
| `filter_operator` | 필터 연산자 (equals, contains, greater than 등) |

### Head
DataFrame의 처음 N개 행 반환.

| 파라미터 | 설명 |
|----------|------|
| `n_rows` | 반환할 행 수 |

### Rename Column
열 이름 변경.

| 파라미터 | 설명 |
|----------|------|
| `old_column_name` | 기존 열 이름 |
| `new_column_name` | 새 열 이름 |

### Replace Value
지정된 열의 값 교체.

| 파라미터 | 설명 |
|----------|------|
| `column_name` | 대상 열 이름 |
| `old_value` | 교체할 기존 값 |
| `new_value` | 새 값 |

### Select Columns
지정된 열만 선택.

| 파라미터 | 설명 |
|----------|------|
| `columns` | 선택할 열 목록 |

### Sort
지정된 열 기준으로 정렬.

| 파라미터 | 설명 |
|----------|------|
| `column_name` | 정렬 기준 열 |
| `ascending` | 오름차순 여부 |

### Tail
DataFrame의 마지막 N개 행 반환.

| 파라미터 | 설명 |
|----------|------|
| `n_rows` | 반환할 행 수 |

### Drop Duplicates
중복 행 제거.

| 파라미터 | 설명 |
|----------|------|
| `subset` | 중복 확인할 열 (선택적) |

