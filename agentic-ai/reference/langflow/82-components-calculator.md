# Calculator

**Calculator** 컴포넌트는 수학 표현식에 대한 기본 산술 연산 수행.
덧셈, 뺄셈, 곱셈, 나눗셈, 거듭제곱 연산 지원.

Flow에서 사용 예시: [Python Interpreter 컴포넌트](/python-interpreter) 참조.

## Calculator 파라미터

| Name | Type | 설명 |
|------|------|------|
| `expression` | String | (입력) 평가할 산술 표현식. 예: `4*4*(33/22)+12-20` |
| `result` | Data | (출력) 평가된 표현식을 포함하는 `Data` 객체로 반환되는 계산 결과 |

