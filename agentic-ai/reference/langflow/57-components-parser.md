# Parser

구조화된 데이터 (`DataFrame` 또는 `Data`)에서 템플릿 또는 직접 문자열화를 사용하여 텍스트 추출.
출력: 파싱된 텍스트가 포함된 `Message`.

데이터 추출 및 조작을 위한 다용도 컴포넌트.

**사용 예시:**
- [Batch Run](/batch-run) 컴포넌트 예시
- [Structured Output](/structured-output) 컴포넌트 예시
- **Financial Report Parser** 템플릿
- [Trigger flows with webhooks](/webhook)
- [Create a vector RAG chatbot](/chat-with-rag)

## 파싱 모드

### Parser (템플릿) 모드

텍스트 출력용 템플릿 생성. 리터럴 문자열과 추출할 키 변수 포함 가능.

**변수 정의:** 템플릿 어디서나 중괄호 사용
- 변수는 `DataFrame` 또는 `Data` 입력의 키(열 이름 등)와 일치해야 함
- 예: `{name}` → `name` 키의 값 추출

**리터럴 중괄호:** 이중 중괄호로 이스케이프
```
This is a template with {{literal text in curly braces}} and a {variable}
```

**동작:** Flow 실행 시 Parser 컴포넌트가 입력을 반복하며 각 파싱된 항목에 대해 `Message` 생성.
- 예: `DataFrame` 파싱 → 각 행에 대해 `Message` 생성, 해당 행의 고유 값으로 채움

**템플릿 예시:**
```
# 직원 요약
{employee_first_name} {employee_last_name} - {job_title}

# 직원 프로필
Name: {employee_first_name} {employee_last_name}
Position: {job_title}
Department: {department}
Grade: {grade}
```

**Parser 모드 파라미터:**

| Name | Display Name | 설명 |
|------|--------------|------|
| `input_data` | Data or DataFrame | 파싱할 `Data` 또는 `DataFrame` 입력 |
| `pattern` | Template | 일반 텍스트와 키 변수(`{KEY_NAME}`)를 사용한 포맷팅 템플릿 |
| `sep` | Separator | 행 또는 줄 구분자. 기본값: `\n` (줄바꿈) |
| `clean_data` | Clean Data | `DataFrame` 또는 `Data` 입력에서 빈 행과 줄 제거 여부. 기본값: 활성화 |

### Stringify 모드

입력 데이터를 직접 문자열로 변환.

## 테스트 및 문제 해결

**테스트:**
1. **Run component** 클릭
2. **Inspect output**으로 파싱된 텍스트가 포함된 `Message` 출력 확인
3. 또는 **Chat Output** 컴포넌트 연결로 Playground에서 확인

**빈 값 또는 예상치 못한 값 발생 시:**
- 입력과 파싱 모드 간 매핑 오류
- 입력에 빈 값 존재
- 입력이 일반 텍스트 추출에 적합하지 않음

**예시:** 다음 템플릿으로 파싱 시
```
{employee_first_name} {employee_last_name} is a {job_title} ({grade}).
```

`employee_first_name`이 비어 있고 `grade`가 `null`인 행의 결과:
```
Smith is a Software Engineer (null).
```

**문제 해결 방법:**

1. **변수-키 매핑 확인:** 템플릿 변수가 들어오는 `Data` 또는 `DataFrame`의 키와 일치하는지 확인
   - Parser에 데이터를 보내는 컴포넌트에서 **Inspect output**으로 확인

2. **소스 데이터 확인:** 누락되거나 잘못된 값 확인
   - 소스 데이터 직접 수정
   - **Data Operations**, **Structured Output**, **Smart Transform** 등으로 이상값 수정/필터링
   - **Clean Data** 파라미터 활성화로 빈 행/줄 건너뛰기

