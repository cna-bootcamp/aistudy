# Smart Router

**If-Else** 컴포넌트의 LLM 기반 변형.
문자열 매칭 대신 연결된 **Language Model** 컴포넌트를 사용하여 수신 메시지를 분류하고 라우팅.

## 사용 방법

**If-Else** 컴포넌트를 사용하는 모든 곳에서 **Smart Router** 사용 가능.
정규식 대신 **Routes** 테이블을 사용하여 메시지 출력 정의.

## Routes 테이블

라우팅을 위한 카테고리 정의. 감정 분석 예시:

| Route Name | Route Description | Route Message |
|------------|-------------------|---------------|
| Positive | 긍정적 피드백, 만족, 칭찬 | |
| Negative | 불만, 문제, 불만족 | |
| Neutral | 질문, 정보 요청, 중립적 진술 | Thank you for your inquiry! |

- **Positive**, **Negative**, **Neutral** 라우트에 대한 포트 생성
- LLM이 입력 텍스트를 분류하면 라우트 이름에 맞는 출력 포트로 라우팅
- Positive/Negative 라우트: 원본 입력 텍스트 전달
- Neutral 라우트: `"Thank you for your inquiry!"` 라우트 메시지 전송 (입력 텍스트 대신)

## Override Output

**Override Output** 파라미터 설정 시, LLM이 어떤 라우트를 매칭하든 단일 메시지 전송.
오버라이드 메시지는 다른 모든 출력 옵션보다 우선하며 원본 입력 텍스트와 커스텀 라우트 메시지 모두 대체.

예: `"Message received"`로 설정하면 모든 라우트가 동일 메시지 전송.

## Additional Instructions

LLM에 추가 지침 제공. 플레이스홀더:
- `{input_text}`: 분류 중인 입력 텍스트 참조
- `{routes}`: 라우트 이름의 쉼표 구분 목록 참조

예시 (도메인 특정 컨텍스트 추가):
```
The text "{input_text}" is from a customer support context.
Consider the urgency and emotional tone when choosing from {routes}.
```

## Smart Router 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Type | 설명 |
|------|------|------|
| Language Model | [LanguageModel](/data-types#languagemodel) | (입력, 필수) 분류에 사용할 언어 모델. 입력 텍스트와 사용 가능한 카테고리를 받아 일치하는 정확한 카테고리 이름 반환 |
| Input | String | (입력, 필수) 분류를 위한 기본 텍스트 입력 |
| Routes | Table | (입력, 필수) 라우팅을 위한 카테고리 정의 테이블. 각 행: 라우트 이름(필수), 라우트 설명(선택, LLM 이해 지원), 커스텀 출력 메시지(선택). 각 라우트 카테고리에 대해 출력 포트 생성 |
| Override Output | Message | (입력, 고급) 다른 모든 출력 옵션보다 우선하는 선택적 오버라이드 메시지. 모든 라우트에서 원본 입력 텍스트와 커스텀 라우트 메시지 모두 대체 |
| Additional Instructions | String | (입력) LLM 기반 분류를 위한 추가 지침. 기본 분류 프롬프트에 추가됨. `{input_text}`로 입력 텍스트, `{routes}`로 라우트 이름 목록 참조 |
| Include Else Output | Boolean | (입력) 어떤 라우트도 매칭되지 않는 경우를 위한 Else 출력 포함 여부. 비활성화 시 매칭 없으면 출력 없음. 기본값: `false` |
| Else | Message | (출력) Else 출력. **Include Else Output**이 `true`일 때만 사용 가능. 라우트 매칭 없을 때 오버라이드 메시지(설정 시) 또는 원본 입력 텍스트 사용 |

