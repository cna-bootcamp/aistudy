# Smart Transform

> 이전 이름: **Lambda Filter**, **Smart Function**

LLM을 사용하여 자연어 지시사항 기반으로 구조화된 데이터를 필터링하거나 변환하는 Lambda 함수 생성.

## 동작 방식

1. **Language Model** 컴포넌트에 연결 필수
2. **Instructions** 파라미터에 자연어 지시사항 입력
3. LLM이 지시사항 기반으로 함수 생성
4. 함수를 데이터 입력에 실행
5. 결과를 `Data`로 출력

## 지시사항 작성 팁

- 간결하고 명확한 지시사항 제공 (원하는 결과 또는 특정 작업에 집중)
- 예: `Filter the data to only include items where the 'status' is 'active'`
- 한 문장 이하 권장 (마침표 같은 문장 부호가 오류나 예상치 못한 동작 유발 가능)
- Lambda 함수와 직접 관련 없는 상세 지시사항은 **Language Model** 컴포넌트의 **Input** 필드 또는 **Prompt Template** 컴포넌트에 입력

## Flow에서 사용 예시

**API Request** 컴포넌트로 `https://jsonplaceholder.typicode.com/users` 엔드포인트에서 JSON 데이터 전달:

1. **API Request** → **Smart Transform**의 데이터 입력 연결
2. **Smart Transform**의 **Instructions**에 `extract emails` 입력
3. **Language Model** 컴포넌트 연결
4. LLM이 JSON 데이터에서 이메일 주소를 추출하는 필터 함수 생성
5. 필터링된 데이터를 채팅 출력으로 반환

## Smart Transform 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Display Name | 설명 |
|------|--------------|------|
| `data` | **Data** | (입력) Lambda 함수를 사용하여 필터링하거나 변환할 구조화된 데이터 |
| `llm` | **Language Model** | (입력) Language Model 컴포넌트의 `LanguageModel` 출력 연결 |
| `filter_instruction` | **Instructions** | (입력) 데이터를 필터링하거나 변환하는 방법에 대한 자연어 지시사항. LLM이 이 지시사항으로 Lambda 함수 생성 |
| `sample_size` | **Sample Size** | (입력) 대용량 데이터셋의 경우 head와 tail에서 샘플링할 문자 수. `max_size` 이상일 때만 적용. 기본값: `1000` |
| `max_size` | **Max Size** | (입력) 대용량으로 간주하여 `sample_size`로 샘플링을 트리거하는 데이터셋 문자 수. 기본값: `30000` |

