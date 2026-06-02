# Batch Run

`DataFrame`의 텍스트 열에서 *각 행*에 대해 언어 모델 실행.
원본 텍스트와 LLM 응답을 포함한 새 `DataFrame` 반환.

## 출력 열

| 열 | 설명 |
|----|------|
| `text_input` | 입력 `DataFrame`의 원본 텍스트 |
| `model_response` | 각 입력에 대한 모델 응답 |
| `batch_index` | `DataFrame`의 모든 행에 대한 0-indexed 처리 순서 |
| `metadata` | (선택) 처리에 대한 추가 정보 |

## Flow에서 사용 예시

**Batch Run** 출력을 **Parser** 컴포넌트에 전달하면 파싱 템플릿에서 `{text_input}`, `{model_response}` 등의 변수 사용 가능.

1. **Language Model** 컴포넌트 → **Batch Run**의 **Language model** 포트 연결

2. 다른 컴포넌트의 `DataFrame` 출력 (예: CSV 파일이 있는 **Read File**) → **Batch Run**의 **DataFrame** 입력 연결

3. **Batch Run**의 **Column Name** 필드에 처리할 텍스트가 포함된 열 이름 입력
   - 예: CSV의 `name` 열에서 텍스트 추출하려면 `name` 입력

4. **Batch Run**의 **Batch Results** 출력 → **Parser**의 **DataFrame** 입력 연결

5. (선택) **Batch Run**의 **Controls**에서 **System Message** 활성화 후 지시사항 입력
   - 예: `Create a business card for each name.`

6. **Parser**의 **Template** 필드에 배치 처리 후 `DataFrame` 열을 사용하는 템플릿 입력:
   ```
   record_number: {batch_index}, name: {text_input}, summary: {model_response}
   ```

7. **Parser** 컴포넌트에서 **Run component** 클릭 후 **Inspect output**으로 결과 확인
   - **Playground**에서 보려면 **Chat Output** 컴포넌트 연결

## Batch Run 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Type | 설명 |
|------|------|------|
| `model` | HandleInput | (입력, 필수) Language Model 컴포넌트의 'Language Model' 출력 연결 |
| `system_message` | MultilineInput | (입력) DataFrame의 모든 행에 적용할 멀티라인 시스템 지시사항 |
| `df` | DataFrameInput | (입력, 필수) `column_name`으로 지정된 열을 텍스트 메시지로 처리할 DataFrame |
| `column_name` | MessageTextInput | (입력) 텍스트 메시지로 처리할 DataFrame 열 이름. 비어있으면 모든 열을 TOML 형식으로 포맷팅 |
| `output_column_name` | MessageTextInput | (입력) 모델 응답이 저장될 열 이름. 기본값: `model_response` |
| `enable_metadata` | BoolInput | (입력) `True`이면 출력 DataFrame에 메타데이터 추가 |
| `batch_results` | DataFrame | (출력) 모든 원본 열과 모델 응답 열이 포함된 DataFrame |

