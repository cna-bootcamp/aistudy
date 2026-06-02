# DeepSeek

**DeepSeek** 번들은 DeepSeek 언어 모델과의 통합을 지원하는 컴포넌트 제공.

DeepSeek 기능에 대한 자세한 내용은 [DeepSeek 문서](https://api-docs.deepseek.com/) 참조.

## DeepSeek 텍스트 생성

**DeepSeek** 컴포넌트는 DeepSeek의 언어 모델을 사용하여 텍스트 생성.

- **출력**: [Message](/data-types#message) 또는 [LanguageModel](/data-types#languagemodel) 반환
- **Language Model** 출력은 **Agent** 또는 **Smart Transform** 같은 LLM 기반 컴포넌트에서 DeepSeek 모델을 사용할 때 활용

자세한 내용은 [Language model components](/components-models) 참조.

### 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Type | 설명 |
|------|------|------|
| **Max Tokens** (`max_tokens`) | Integer | (입력) 생성할 최대 토큰 수. `0`으로 설정 시 무제한. 범위: `0-128000` |
| **Model Kwargs** (`model_kwargs`) | Dictionary | (입력) 모델에 전달할 추가 키워드 인자 |
| **JSON Mode** (`json_mode`) | Boolean | (입력) `true` 시 스키마 전달 여부와 관계없이 JSON 출력 |
| **Model Name** (`model_name`) | String | (입력) 사용할 DeepSeek 모델. 기본값: `deepseek-chat` |
| **API Base** (`api_base`) | String | (입력) API 요청을 위한 Base URL. 기본값: `https://api.deepseek.com` |
| **API Key** (`api_key`) | SecretString | (입력) 인증을 위한 DeepSeek API 키 |
| **Temperature** (`temperature`) | Float | (입력) 응답의 무작위성 제어. 범위: `[0.0, 2.0]`. 기본값: `1.0` |
| **Seed** (`seed`) | Integer | (입력) 난수 생성을 위해 초기화된 숫자. 동일한 seed 정수 사용 시 재현 가능한 결과, 다른 seed 번호 사용 시 더 무작위적 결과 |
