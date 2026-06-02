# Structured Output

LLM을 사용하여 자연어 포맷팅 지시사항과 출력 스키마 정의를 기반으로 모든 입력을 구조화된 데이터(`Data` 또는 `DataFrame`)로 변환.
문서(이메일 메시지, 과학 논문 등)에서 특정 세부 정보 추출에 활용.

## Flow에서 사용 방법

1. **Input Message 제공:**
   - 구조화된 데이터를 추출할 소스 자료
   - 일반적으로 **Chat Input**, **Read File** 또는 비구조화/반구조화 입력을 제공하는 컴포넌트에서 연결

   > **Tip**: 모든 소스 자료가 구조화된 출력이 될 필요는 없음. **Structured Output** 컴포넌트의 강점은 추출할 정보를 지정하면 LLM이 지시사항을 사용하여 소스 자료를 분석하고, 관련 데이터를 추출하여 사양에 따라 포맷팅. 관련 없는 소스 자료는 구조화된 출력에 포함되지 않음.

2. **Format Instructions 및 Output Schema 정의:**
   - **Format Instructions**: LLM에게 추출할 데이터, 포맷팅 방법, 예외 처리 방법 등을 지시하는 프롬프트
   - **Output Schema**: LLM이 추출한 데이터를 구조화된 `Data` 또는 `DataFrame` 객체로 정리하기 위한 필드(키)와 데이터 타입을 정의하는 테이블

3. **Language Model 컴포넌트 연결:**
   - `LanguageModel` 출력을 내보내도록 설정된 Language Model 컴포넌트 연결
   - LLM이 **Input Message**와 **Format Instructions**를 사용하여 입력 텍스트에서 특정 데이터 추출
   - 출력 스키마가 모델 응답에 적용되어 최종 `Data` 또는 `DataFrame` 구조화 객체 생성

4. **(선택) 다운스트림 컴포넌트 연결:**
   - 추출된 데이터를 다른 프로세스에 사용 (예: **Parser**, **Data Operations** 컴포넌트)

## Structured Output 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Type | 설명 |
|------|------|------|
| Language Model (`llm`) | `LanguageModel` | (입력) 분석, 추출, 구조화된 출력 준비에 사용할 LLM을 정의하는 Language Model 컴포넌트의 LanguageModel 출력 |
| Input Message (`input_value`) | String | (입력) 추출을 위한 소스 자료가 포함된 입력 메시지 |
| Format Instructions (`system_prompt`) | String | (입력) 출력 추출 및 포맷팅을 위한 언어 모델 지시사항 |
| Schema Name (`schema_name`) | String | (입력) Output Schema의 선택적 제목 |
| Output Schema (`output_schema`) | Table | (입력) 원하는 구조화된 출력의 스키마를 설명하는 테이블. `Data` 또는 `DataFrame` 출력의 내용 결정 |
| Structured Output (`structured_output`) | Data/DataFrame | (출력) 컴포넌트가 생성한 최종 구조화된 출력. 출력 포트 근처에서 **Structured Output Data** 또는 **Structured Output DataFrame** 선택 가능 |

## Output Schema 옵션

LLM이 **Input Message**와 **Format Instructions**에서 관련 데이터를 추출한 후, **Output Schema**에 따라 데이터 정리.

스키마는 최종 `Data` 또는 `DataFrame` 출력의 필드(키)와 데이터 타입을 정의하는 테이블.
기본 스키마: 단일 `field` 문자열.

스키마에 키 추가: **Add a new row** 클릭 후 각 열 편집:

| 열 | 설명 |
|----|------|
| **Name** | 출력 필드 이름. 일반적으로 값을 추출할 특정 키. 다운스트림 컴포넌트에서 변수로 참조 가능 (예: 스키마 키 `NET_INCOME` → 변수 `{NET_INCOME}`) |
| **Description** | 필드 내용과 목적에 대한 선택적 메타데이터 설명 |
| **Type** | 필드에 저장되는 값의 데이터 타입. 지원 타입: `str` (기본값), `int`, `float`, `bool`, `dict` |
| **As List** | 단일 값 대신 값 리스트를 포함하려면 활성화 |

간단한 스키마는 몇 개의 `string` 또는 `int` 필드만 추출.
복잡한 스키마(리스트, 딕셔너리 포함)는 [Langflow 데이터 타입](/data-types)의 `Data`와 `DataFrame` 구조 및 속성 참조 권장.
대략적인 `Data` 또는 `DataFrame`을 내보낸 후 **Data Operations** 등 다운스트림 컴포넌트에서 추가 정제 가능.

