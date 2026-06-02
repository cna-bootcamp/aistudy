# SambaNova

**번들(Bundles)**은 Langflow와 특정 타사 통합을 지원하는 사용자 정의 컴포넌트를 포함함.

이 페이지는 **SambaNova** 번들에서 사용 가능한 컴포넌트를 설명함.

SambaNova 컴포넌트에서 사용되는 SambaNova 기능에 대한 자세한 정보는 SambaNova Cloud 문서 참조.

## SambaNova 텍스트 생성

이 컴포넌트는 SambaNova LLM을 사용하여 텍스트를 생성함.

**Model Response**(`Message`) 또는 **Language Model**(`LanguageModel`) 중 하나를 출력 가능.

**Agent** 또는 **Smart Transform** 컴포넌트와 같은 다른 LLM 기반 컴포넌트의 LLM으로
SambaNova 모델을 사용하려면 **Language Model** 출력 사용.

자세한 정보는 "언어 모델 컴포넌트" 참조.

## SambaNova 텍스트 생성 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨겨져 있음.
컴포넌트 헤더 메뉴의 **Controls**를 통해 모든 파라미터 수정 가능.

| 이름 | 타입 | 설명 |
|------|------|------|
| sambanova_url | String | 입력 파라미터. API 요청을 위한 기본 URL 경로.  <br>기본값: `https://api.sambanova.ai/v1/chat/completions` |
| sambanova_api_key | SecretString | 입력 파라미터. SambaNova API 키 |
| model_name | String | 입력 파라미터. 사용할 SambaNova 모델 이름.  <br>옵션에는 다양한 Llama 모델 포함 |
| max_tokens | Integer | 입력 파라미터. 생성할 최대 토큰 수.  <br>무제한 토큰의 경우 0으로 설정 |
| temperature | Float | 입력 파라미터. 출력의 무작위성 제어.  <br>범위: [0.0, 1.0]. 기본값: 0.07 |
