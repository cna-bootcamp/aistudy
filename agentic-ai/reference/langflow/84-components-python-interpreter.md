# Python Interpreter

가져온 패키지와 함께 Python 코드 실행 가능.

**Python Interpreter** 컴포넌트는 Langflow 환경에 이미 설치된 패키지만 가져올 수 있음.
패키지 사용 시 `ImportError` 발생하면 먼저 설치 필요.

커스텀 패키지 설치 방법: [커스텀 의존성 설치](/install-custom-dependencies) 참조.

## Flow에서 사용 방법

1. **Global Imports** 필드에 가져올 패키지를 쉼표로 구분하여 추가 (예: `math,pandas`)
   - 최소 하나의 import 필수

2. **Python Code** 필드에 실행할 Python 코드 입력
   - `print()`를 사용하여 출력 확인

3. (선택) **Tool Mode** 활성화 후 **Agent** 컴포넌트에 도구로 연결
   - 예: **Python Interpreter**와 **Calculator** 컴포넌트를 **Agent**의 도구로 연결
   - 에이전트가 수학 문제 해결에 다른 도구를 선택하는 방식 테스트

### 예시 1: 간단한 수학
에이전트에게 쉬운 수학 질문을 하면 **Calculator** 도구(`evaluate_expression`)를 실행하여 정답 도출.

```
Executed evaluate_expression
Input:
{
  "expression": "2+5"
}
Output:
{
  "result": "7"
}
```

### 예시 2: Python 코드 실행
완전한 Python 코드 제공 시, 에이전트가 `run_python_repl` 도구 선택:

```python
import pandas as pd
import math

# Create a simple DataFrame
df = pd.DataFrame({
    'numbers': [1, 2, 3, 4, 5],
    'squares': [x**2 for x in range(1, 6)]
})

# Calculate the square root of the mean
result = math.sqrt(df['squares'].mean())
print(f"Square root of mean squares: {result}")
```

결과:
```
Executed run_python_repl
Output:
{
  "result": "Square root of mean squares: 3.3166247903554"
}
```

채팅에 패키지 import를 포함하지 않아도, **Global Imports** 필드에서 `pandas` 패키지가 전역으로 가져와져 있으므로 `pd.DataFrame` 사용 가능.

## Python Interpreter에 입력 전달

**Python Interpreter** 컴포넌트에 입력을 전달하려면 컴포넌트 코드를 커스터마이즈하여 입력 필드 추가 필요.

예: **Text** 컴포넌트를 연결하여 URL 값 전달:

1. Flow에 **Python Interpreter** 컴포넌트 추가
2. **Edit Code** 클릭하여 컴포넌트 코드 수정
3. 코드 변경:
   - `inputs` 목록에 URL 입력 필드 추가 (입력 포트 생성)
   - `get_globals` 메서드 업데이트하여 URL 값 추출 후 globals 딕셔너리에 추가
   - 기본 Python 코드 값을 `url` 변수 사용하도록 업데이트
4. **Check & Save** 클릭하여 수정사항 저장
5. **Text** 컴포넌트 추가 후 값 설정 (예: `google.com`)
6. **Text** 컴포넌트 출력 → **Python Interpreter**의 새 **URL** 입력 필드 연결

이제 **Python Interpreter** 컴포넌트가 실행하는 Python 코드에서 `url` 변수 사용 가능.

## Python Interpreter 파라미터

| Name | Type | 설명 |
|------|------|------|
| `global_imports` | String | (입력) 전역으로 가져올 모듈의 쉼표 구분 목록. 예: `math,pandas,numpy` |
| `python_code` | Code | (입력) 실행할 Python 코드. Global Imports에 지정된 모듈만 사용 가능 |
| `results` | Data | (출력) 실행된 Python 코드의 출력 (출력된 결과 또는 오류 포함) |

