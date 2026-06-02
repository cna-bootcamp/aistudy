# Data Operations

`Data` 객체에 대한 작업 수행: 키와 값 추출, 필터링, 편집.
출력: 선택한 작업 실행 후 수정된 데이터가 포함된 새 `Data` 객체.

## Flow에서 사용 예시

**Webhook 페이로드 데이터 처리:**

1. **Flow 생성:** Webhook → Data Operations 연결
   - 모든 작업에 최소 하나의 `Data` 입력 필요
   - `Data` 출력이 없는 컴포넌트의 경우 **Type Convert** 컴포넌트로 변환
   - 또는 **Parser**, **DataFrame Operations** 등 원본 데이터 타입 처리 컴포넌트 사용

2. **Operations 선택:** 예시로 **Select Keys** 선택
   > **Tip**: 작업 하나만 선택 가능. 여러 작업 필요 시 Data Operations 컴포넌트 체이닝.
   > 복잡한 다단계 작업은 **Smart Transform** 컴포넌트 고려.

3. **키 추가:** `name`, `username`, `email` 키 추가 (**Add more** 클릭)

4. **(선택) 출력 확인:** Chat Output 컴포넌트 연결로 Playground에서 확인

5. **테스트:**
   ```bash
   curl -X POST "http://$LANGFLOW_SERVER_URL/api/v1/webhook/$FLOW_ID" \
     -H "Content-Type: application/json" \
     -H "x-api-key: $LANGFLOW_API_KEY" \
     -d '{
       "id": 1,
       "name": "Leanne Graham",
       "username": "Bret",
       "email": "Sincere@april.biz",
       "address": { ... }
     }'
   ```

6. **결과 확인:** Playground 또는 **Inspect output** 클릭

## Data Operations 파라미터

| Name | Display Name | 설명 |
|------|--------------|------|
| `data` | Data | 작업할 `Data` 객체 |
| `operation` | Operation | 데이터에 수행할 작업 |
| `select_keys_input` | Select Keys | 데이터에서 선택할 키 목록 |
| `filter_key` | Filter Key | 필터링할 키 |
| `operator` | Comparison Operator | 값 비교에 적용할 연산자 |
| `filter_values` | Filter Values | 필터링할 값 목록 |
| `append_update_data` | Append or Update | 기존 데이터에 추가/업데이트할 데이터 |
| `remove_keys_input` | Remove Keys | 데이터에서 제거할 키 목록 |
| `rename_keys_input` | Rename Keys | 데이터에서 이름 변경할 키 목록 |
| `mapped_json_display` | JSON to Map | Path Selection용 JSON 구조 |
| `selected_key` | Select Path | 값 추출을 위한 JSON 경로 표현식 |
| `query` | JQ Expression | 고급 JSON 필터링/변환을 위한 jq 표현식 |

## 사용 가능한 데이터 작업

| 작업명 | 필수 입력 | 처리 |
|--------|----------|------|
| **Select Keys** | `select_keys_input` | 데이터에서 특정 키 선택 |
| **Literal Eval** | 없음 | 문자열 값을 Python 리터럴로 평가 |
| **Combine** | 없음 | 여러 데이터 객체를 하나로 결합 |
| **Filter Values** | `filter_key`, `filter_values`, `operator` | 키-값 쌍 기반 데이터 필터링 |
| **Append or Update** | `append_update_data` | 키-값 쌍 추가 또는 업데이트 |
| **Remove Keys** | `remove_keys_input` | 데이터에서 지정된 키 제거 |
| **Rename Keys** | `rename_keys_input` | 데이터의 키 이름 변경 |
| **Path Selection** | `mapped_json_display`, `selected_key` | 경로 표현식으로 중첩 JSON에서 값 추출 |
| **JQ Expression** | `query` | jq 문법으로 고급 JSON 쿼리 수행 |

## Path Selection 작업 예시

점 표기법 경로로 중첩 JSON 구조에서 값 추출.

1. **Operations**에서 **Path Selection** 선택
2. **JSON to Map** 필드에 JSON 구조 입력:
   ```json
   {
     "user": {
       "profile": {
         "name": "John Doe",
         "email": "john@example.com"
       },
       "settings": {
         "theme": "dark"
       }
     }
   }
   ```
3. **Select Path** 드롭다운에서 경로 선택:
   - `.user.profile.name` → "John Doe" 추출
   - `.user.settings.theme` → "dark" 추출

## JQ Expression 작업 예시

[jq](https://jqlang.org/) 쿼리 언어로 고급 JSON 필터링 수행.

1. **Operations**에서 **JQ Expression** 선택
2. **JQ Expression** 필드에 jq 필터 입력:
   - `.user.profile.name` → "John Doe" 추출
   - `.user.profile | {name, email}` → 새 객체로 필드 프로젝션
   - `.user.profile | tostring` → 필드를 문자열로 변환

