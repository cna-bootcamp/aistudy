# Prompt Template

**Prompt Template** 코어 컴포넌트를 사용하여 LLM이나 에이전트에 지시사항과 컨텍스트를 제공하는 *프롬프트* 생성.
채팅 메시지나 파일 업로드 등 다른 입력과 분리.

## 프롬프트란

자연어, 고정 값, 동적 변수를 사용하여 LLM에 기본 컨텍스트를 제공하는 구조화된 입력.

### 사용 예시

- 사용자 쿼리의 일관된 구조 정의 → LLM이 이해하고 적절히 응답하기 쉬움
- LLM의 특정 출력 형식 정의 (JSON, 구조화된 텍스트 등)
- LLM의 역할 정의 (예: `You are a helpful assistant`, `You are an expert in microbiology`)
- LLM이 채팅 메모리 참조 가능

**Prompt Template** 컴포넌트는 Flow의 다른 컴포넌트에 변수 지시사항 출력 가능.

## Prompt Template 파라미터

| Name | Display Name | 설명 |
|------|--------------|------|
| `template` | Template | (입력) 중괄호 안에 동적 변수를 포함한 프롬프트 템플릿 생성 (예: `{VARIABLE_NAME}`). 리터럴 텍스트와 변수를 함께 사용할 때 이중 중괄호로 리터럴 중괄호 이스케이프 가능 (예: `This is a template with {{literal text in curly braces}} and a {variable}`) |
| `prompt` | Prompt Message | (출력) `build_prompt` 메서드가 반환하는 빌드된 프롬프트 메시지 |

## 프롬프트에서 변수 정의

**Prompt Template** 컴포넌트의 변수는 컴포넌트에 동적으로 필드를 추가하여 Flow가 다른 컴포넌트, Langflow 전역 변수, 고정 입력에서 값의 정의를 받을 수 있게 함.

예: **Message History** 컴포넌트와 함께 `{memory}` 변수를 사용하여 채팅 기록을 프롬프트에 전달.
단, **Agent** 컴포넌트에는 기본 활성화된 내장 채팅 메모리 포함.

### 변수 추가 방법

1. **Basic prompting** 템플릿 기반 Flow 생성
   - 기존 **Prompt Template**에는 자연어 지시사항만 포함:
     `Answer the user as if you were a GenAI expert, enthusiastic about helping them get started building something fresh.`
   - 이 프롬프트는 LLM 채팅 상호작용의 역할을 정의하지만, 사용자와 환경 변화에 동적으로 적응하는 변수 미포함

2. **Prompt Template** 컴포넌트 클릭 → **Template** 필드에 변수 추가
   - 변수 선언: 변수 이름을 중괄호로 감싸기 (예: `{variable_name}`)

   예시 (`context`와 `user_question` 변수 생성):
   ```
   Given the context:

   {context}

   Answer the question:

   {user_question}
   ```

   - 리터럴 텍스트와 변수 함께 사용 시 이중 중괄호로 이스케이프:
     `This is a template with {{literal text in curly braces}} and a {variable}`

3. **Check & Save** 클릭하여 템플릿 저장
   - 템플릿에 변수 추가 후, 각 변수에 대한 새 필드가 **Prompt Template** 컴포넌트에 추가됨

4. 변수 필드에 입력 제공:
   - 다른 컴포넌트에 연결하여 해당 컴포넌트의 출력을 변수로 전달
   - Langflow 전역 변수 사용
   - 필드에 고정 값 직접 입력

## 활용 팁

템플릿에 원하는 만큼 변수 추가 가능.
예: `{references}`와 `{instructions}` 변수 추가 후 **Text Input**, **URL**, **Read File** 컴포넌트 등에서 정보 연결.

## 참고

- [LangChain Prompt Hub 컴포넌트](/bundles-langchain#prompt-hub)
- [Processing 컴포넌트](/concepts-components)

