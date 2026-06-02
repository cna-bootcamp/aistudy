# Dynamic Create Data

구성 가능한 필드로 `Data` 객체 또는 `Message` 생성.
**Input Configuration** 필드에서 테이블 정의 시 컴포넌트에 해당 입력/출력 핸들 생성.

## Flow에서 사용

1. **Dynamic Create Data** 컴포넌트를 Flow에 추가

2. **Input Configuration** 필드에서 **Open table** 클릭

3. **Add a new row** 클릭으로 행 추가
   - 새 행 추가 시 **Field Type**에 해당하는 입력/출력 핸들 생성
   - 예: `Text` 타입 필드 추가 → `Text` 입력/출력 핸들 추가

4. **각 행 구성:**

   **Field Name**: 내부 키 및 표시 레이블로 사용되는 필드 이름

   **Field Type**: 생성할 입력 필드 유형

   | 타입 | 설명 |
   |------|------|
   | **Text** | 직접 텍스트 입력 또는 다른 컴포넌트의 `Text`/`Message` 출력 수신 |
   | **Data** | 다른 컴포넌트의 `Data` 입력 수신 |
   | **Number** | 직접 숫자 입력 또는 다른 컴포넌트의 `Text`/`Message` 출력 수신 |
   | **Handle** | 다른 컴포넌트의 `Text`, `Data`, `Message` 출력 수신 |
   | **Boolean** | Boolean 값 수신. 다른 컴포넌트 입력 불가 |

   참조: [Langflow data types](/data-types)

5. **입력 연결 또는 값 입력:**
   - **Field Type** 선택에 따라 다른 컴포넌트 출력 연결로 동적 채우기
   - 또는 컴포넌트 필드에 수동 값 입력

6. **출력 타입 선택:**
   - **Data**: 컴포넌트 입력의 모든 필드 값이 포함된 `Data` 객체
   - **Message**: 모든 필드 값이 텍스트 문자열로 포맷된 `Message`

## Dynamic Create Data 파라미터

| Name | Display Name | 설명 |
|------|--------------|------|
| `form_fields` | Input Configuration | 동적 폼 필드를 정의하는 테이블 |
| `include_metadata` | Include Metadata | 출력에 폼 구성 메타데이터 포함 여부 |
| `form_data` | Data | (출력) 동적 입력의 모든 필드 값이 포함된 `Data` 객체 |
| `message` | Message | (출력) 모든 필드 값이 사람이 읽기 쉬운 형식으로 포맷된 `Text` 메시지 |

