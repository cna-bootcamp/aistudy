# Type Convert

데이터를 한 타입에서 다른 타입으로 변환.
지원 데이터 타입: `Data`, `DataFrame`, `Message`

## 데이터 타입 구조

### Data
기본 `text` 키와 기타 키-값 쌍이 포함된 구조화된 객체:
```json
{
  "text_key": "text",
  "data": {
    "text": "User Profile",
    "name": "Charlie Lastname",
    "age": 28,
    "email": "charlie.lastname@example.com"
  },
  "default_value": ""
}
```

### DataFrame
테이블 형식의 구조화된 데이터.

### Message
텍스트 메시지 데이터.

참조: [Langflow data types](/data-types)

## Flow에서 사용

**Type Convert** 컴포넌트: 다운스트림 컴포넌트가 요구하는 형식으로 데이터 변환.
- 예: 컴포넌트가 `Message` 출력 → 다음 컴포넌트가 `Data` 요구 → Type Convert로 변환

### 예시: Web Search 결과를 LLM에 전달

1. **Basic prompting** 템플릿 기반 Flow 생성

2. **Web Search** 컴포넌트 추가, 검색 쿼리 입력 (예: `environmental news`)

3. **Prompt Template** 컴포넌트의 **Template** 필드 수정:
   ```
   Answer the user's question using the {context}
   ```
   - 중괄호는 [prompt variable](/components-prompts#define-variables-in-prompts) 정의
   - `context` 필드로 검색 결과를 템플릿에 전달

4. **Type Convert** 컴포넌트 추가, **Output Type**을 **Message**로 설정
   - **Web Search**의 `DataFrame` 출력이 `context` 변수의 `Message` 입력과 비호환
   - Type Convert로 `DataFrame` → `Message` 변환 필요

5. **컴포넌트 연결:**
   - Web Search 출력 → Type Convert 입력
   - Type Convert 출력 → Prompt Template의 `context` 입력

6. **Language Model** 컴포넌트에 API 키 추가
   - 다른 제공자/모델 사용 시 **Model Provider**, **Model Name**, **API Key** 수정

7. **Playground**에서 검색 쿼리 관련 질문 (예: `latest news`, `what's the latest research on the environment?`)

## Type Convert 파라미터

| Name | Display Name | 설명 |
|------|--------------|------|
| `input_data` | Input Data | 변환할 데이터. `Data`, `DataFrame`, `Message` 입력 수신 |
| `output_type` | Output Type | 원하는 출력 타입: **Data**, **DataFrame**, **Message** |
| `output` | Output | (출력) 지정된 형식으로 변환된 데이터. 출력 포트는 선택한 Output Type에 따라 변경 |

