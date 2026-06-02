# Loop

입력 리스트를 반복 처리하는 컴포넌트.
개별 항목을 **Item** 출력 포트로 전달하고, 모든 처리 완료 후 집계된 결과를 **Done** 포트로 전달.

## 루핑 프로세스

**Loop** 컴포넌트는 Flow 내의 미니 Flow처럼 동작:

1. **입력 수신:**
   - `Data` 또는 `DataFrame` 객체 리스트 (예: CSV 파일)를 **Inputs** 포트로 수신

2. **항목 분할:**
   - 입력을 개별 항목으로 분할 (예: CSV는 행 단위로 분할)
   - `Data` 또는 `DataFrame`에서 `text` 키로 항목을 반복 추출
   - 각 `item` 출력은 `Data` 객체

3. **항목 반복:**
   - 각 `item`을 **Item** 출력 포트로 전달
   - 연결된 컴포넌트에서 각 항목에 대한 작업 수행
   - **Item** 루프의 마지막 컴포넌트는 **Looping** 포트에 다시 연결하여 다음 항목 처리
   - **Item** 포트에는 하나의 컴포넌트만 연결 가능, 체인 구성은 가능

4. **결과 집계:**
   - 모든 항목 처리 후, 결과를 단일 `Data` 객체로 집계
   - **Done** 포트를 통해 다음 컴포넌트로 전달

## 의사 코드

```python
for i in input:            # 입력 데이터를 리스트로 수신
    process_item(i)        # Item 포트에 연결된 컴포넌트로 각 항목 처리
    if has_more_items():
        continue           # Looping 포트로 돌아가 다음 항목 처리
    else:
        break              # 더 이상 항목 없으면 루프 종료

done = aggregate_results() # 반환된 모든 항목 컴파일
print(done)                # Done 포트에서 다른 컴포넌트로 집계 결과 전송
```

## Flow에서 사용 예시

CSV 파일의 각 행을 구조화된 데이터로 변환하여 데이터베이스에 저장:

1. **Read File** → **Loop** 컴포넌트의 **Inputs** 포트 연결
2. **Loop**의 **Item** 포트 → **Type Convert** 컴포넌트 연결 (행을 `Message`로 변환)
3. **Type Convert** → **Structured Output** 컴포넌트 연결 (구조화된 데이터 생성)
4. **Structured Output** → **Loop**의 **Looping** 포트 연결 (다음 항목 처리)
5. **Loop**의 **Done** 포트 → **Chroma DB** 컴포넌트 연결 (집계된 데이터 저장)

> **Tip**: 더 많은 예시는 Langflow의 **Research Translation Loop** 템플릿 또는
> [Mastering the Loop Component & Agentic RAG in Langflow](https://www.youtube.com/watch?v=9Wx7WODSKTo) 영상 참조.

## 조건부 루핑

**If-Else** 컴포넌트는 **Loop** 컴포넌트와 호환되지 않음.

조건부 루프 이벤트가 필요한 경우:
- 루프 전에 조건 처리하도록 Flow 재설계
- 예: `DataFrame` 루핑 시, 여러 **DataFrame Operations** 컴포넌트로 데이터를 조건부 필터링
- 필터링된 각 데이터 세트에 대해 별도의 루프 실행

## Loop 파라미터

| Name | Type | 설명 |
|------|------|------|
| `inputs` | Data/DataFrame | (입력) 반복 처리할 데이터 리스트 |
| `item` | Data | (출력) 현재 처리 중인 개별 항목 |
| `looping` | Data | (입력) 루프 체인에서 반환된 처리 결과 |
| `done` | Data | (출력) 모든 항목 처리 완료 후 집계된 결과 |

