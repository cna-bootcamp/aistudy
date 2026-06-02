# Global variables

전역 변수를 사용하여 모든 Flow에서 자격 증명과 일반 값을 저장 및 재사용.
전역 변수는 일반적으로 Flow의 컴포넌트에서 사용되며, 🌐 전역 변수 아이콘이 있는 모든 필드에서 사용 가능.

**환경 변수와의 차이:**
- 환경 변수(`LANGFLOW_PORT`, `LANGFLOW_LOG_LEVEL` 등): Langflow 실행 방식 구성
- 전역 변수: Flow에서 사용하는 자격 증명 및 값 저장 (환경 변수에서 소싱 가능)

Langflow는 전역 변수를 내부 데이터베이스에 저장하고 비밀 키로 값을 암호화.

## Create a global variable

1. 헤더에서 프로필 아이콘 클릭 → **Settings** 선택
2. **Global Variables** 클릭
3. **Add New** 클릭
4. **Create Variable** 대화 상자에서:
   - **Variable Name**: 변수 이름 입력
   - **Type** (선택사항):
     - **Generic** (기본값): 비주얼 에디터에서 마스킹되지 않음
     - **Credential**: 비주얼 에디터에서 마스킹됨
   - **Value**: 변수 값 입력
   - **Apply To Fields** (선택사항): 자동 적용할 필드 선택
     - 예: **OpenAI API Key** 선택 시 모든 OpenAI API Key 필드에 자동 적용
5. **Save Variable** 클릭

> **Note**: Langflow는 Generic과 Credential 타입 모두 암호화.
> **Session ID** 필드는 Credential(마스킹된) 변수를 허용하지 않음.

🌐 **Globe** 아이콘이 표시되는 모든 텍스트 입력 필드에서 전역 변수 선택 가능.

## Edit a global variable

1. **Settings** → **Global Variables**
2. 편집할 전역 변수 클릭
3. **Update Variable** 대화 상자에서 편집:
   - **Variable Name**
   - **Value**
   - **Apply To Fields**
4. **Update Variable** 클릭

## Delete a global variable

> **Warning**: 전역 변수 삭제 시 데이터베이스에서 영구 삭제됨.
> 삭제된 전역 변수를 참조하는 Flow는 실패함.

1. **Settings** → **Global Variables**
2. 삭제할 전역 변수의 체크박스 클릭
3. **Delete** 클릭

## Add custom global variables from the environment

Langflow는 런타임 환경에서 커스텀 전역 변수 소싱 가능.

### 자동 생성

Langflow는 `constants.py`에 정의된 환경 변수를 감지하면 자동으로 전역 변수 생성.
예: `OPENAI_API_KEY` 환경 변수 설정 시 해당 값으로 전역 변수 자동 생성.

### 추가 변수 선언

`LANGFLOW_VARIABLES_TO_GET_FROM_ENVIRONMENT`에 추가 변수 선언:

```bash
# 쉼표로 구분된 문자열 (공백 없음)
LANGFLOW_VARIABLES_TO_GET_FROM_ENVIRONMENT=VARIABLE1,VARIABLE2

# 또는 JSON 리스트 형식
LANGFLOW_VARIABLES_TO_GET_FROM_ENVIRONMENT=["VARIABLE1", "VARIABLE2"]
```

**예시:**
```
LANGFLOW_VARIABLES_TO_GET_FROM_ENVIRONMENT=WATSONX_PROJECT_ID,WATSONX_API_KEY
```

→ `WATSONX_PROJECT_ID`와 `WATSONX_API_KEY` 전역 변수가 Langflow 데이터베이스에 생성됨.

### 설정 방법 (로컬)

1. Langflow `.env` 파일 생성 또는 편집
2. `LANGFLOW_VARIABLES_TO_GET_FROM_ENVIRONMENT` 환경 변수 추가
3. 파일 저장
4. `.env` 파일로 Langflow 시작:

```bash
uv run langflow run --env-file .env
```

또는 명령줄에서 직접 환경 변수 설정:

```bash
VARIABLE1="VALUE1" VARIABLE2="VALUE2" uv run langflow run --env-file .env
```

> **Note**: 명령줄 변수가 `.env` 파일의 일치하는 변수를 덮어씀.

### 설정 방법 (Docker)

`docker-compose.yml`에서 환경 변수 설정:

```yaml
environment:
  - LANGFLOW_VARIABLES_TO_GET_FROM_ENVIRONMENT=VARIABLE1,VARIABLE2
  - VARIABLE1=VALUE1
  - VARIABLE2=VALUE2
```

### 확인 방법

1. **Settings** → **Global Variables**
2. 환경 변수가 **Global Variables** 목록에 표시되는지 확인

> **Note**: 환경에서 소싱된 전역 변수는 **Credential** 타입으로 할당되어 비주얼 에디터에서 값이 마스킹됨.

**Name**과 **Value**만 환경에서 가져옴.
**Apply To Fields** 등 추가 옵션은 **Settings**에서 편집 가능.

## Disallow global variables from the environment

환경에서 전역 변수 소싱을 명시적으로 방지:

```
LANGFLOW_STORE_ENVIRONMENT_VARIABLES=False
```

## Use environment variables for missing global variables

전역 변수에 대한 폴백 값을 환경 변수로 자동 설정:

```
LANGFLOW_FALLBACK_TO_ENV_VAR=True
```

이 설정 활성화 시:
- 전역 변수를 찾을 수 없으면 동일한 이름의 환경 변수를 백업으로 사용 시도

**예시:**

`.env` 파일:
```
LANGFLOW_FALLBACK_TO_ENV_VAR=True
WATSONX_PROJECT_ID=your_project_id
WATSONX_API_KEY=your_api_key
```

Flow가 `WATSONX_API_KEY` 전역 변수를 기대하지만 해당 전역 변수가 없는 경우,
Langflow는 `WATSONX_API_KEY` 환경 변수를 찾아 Flow 실행에 사용.
