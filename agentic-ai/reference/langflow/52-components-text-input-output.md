# Text Input and Output

단순 텍스트 문자열 수신 또는 출력을 위한 컴포넌트.
완전한 대화형 상호작용 미지원.

> **Warning**: **Text Input and Output** 컴포넌트는 **Playground**에서 지원되지 않음.
> 데이터가 채팅 메시지 형식이 아니므로 Playground에 표시되지 않으며, Flow와 채팅 불가.
>
> Playground에서 Flow와 채팅하려면 [Chat Input and Output](/chat-input-and-output) 컴포넌트 사용 필수.

**참고:** 채팅 유사 메타데이터를 Text Input/Output 컴포넌트에 전달해도 동작 변경 없음.
결과는 여전히 단순 텍스트 문자열.

## Text Input

텍스트 문자열 입력 수신.

**출력:** `Message` 데이터
- `text` 속성에 제공된 입력 텍스트 문자열만 포함

**파라미터:**
| Name | Display Name | 설명 |
|------|--------------|------|
| `input_value` | Text | 컴포넌트에 공급되는 텍스트. 직접 입력 또는 다른 컴포넌트에서 `Message` 데이터로 전달 |

> **Note**: 초기 입력은 완전한 `Message` 객체로 제공하면 안 됨.
> Text Input 컴포넌트가 `Message` 객체를 구성하여 다른 컴포넌트로 전달.

## Text Output

다른 컴포넌트에서 `Message` 데이터 수신.
`text` 속성만 포함하는 단순화된 `Message` 객체로 출력.

**파라미터:**
| Name | Display Name | 설명 |
|------|--------------|------|
| `input_value` | Text | 수신하여 문자열로 출력할 텍스트. 직접 입력 또는 다른 컴포넌트에서 `Message` 데이터로 전달 |

