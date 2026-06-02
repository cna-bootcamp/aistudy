# Run Flow

다른 Langflow Flow를 현재 Flow의 서브프로세스로 실행.

## 용도

- Flow 체이닝: 여러 Flow를 순차적으로 연결
- 조건부 실행: 조건에 따라 Flow 실행
- Agent 도구: **Agent** 컴포넌트에 연결하여 필요 시 실행되는 [도구](/agents-tools)로 활용

## 특징

- Agent와 함께 사용 시, 도구 등록에 필요한 `name`과 `description` 메타데이터 자동 생성
- Flow 선택 시, 대상 Flow의 그래프 구조를 기반으로 **Run Flow** 컴포넌트에 입출력 필드 동적 생성

## Run Flow 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Type | 설명 |
|------|------|------|
| `flow_name_selected` | Dropdown | (입력) 실행할 Flow 이름 |
| `session_id` | String | (입력) Flow 실행을 위한 세션 ID. 서브플로우에 커스텀 세션 ID 전달 시 사용 |
| `flow_tweak_data` | Dict | (입력) Flow 동작을 커스터마이즈하기 위한 tweak 딕셔너리. 사용 가능한 tweak은 선택한 Flow에 따라 다름 |
| `dynamic inputs` | Various | (입력) 선택한 Flow에 따라 추가 입력 필드 동적 생성 |
| `run_outputs` | List[Data/Message/DataFrame] | (출력) Flow 실행 결과로 생성된 모든 출력 |

