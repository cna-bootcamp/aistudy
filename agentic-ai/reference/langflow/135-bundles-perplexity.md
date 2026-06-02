# Perplexity

**Bundles**는 Langflow와 특정 서드파티 통합을 지원하는 커스텀 컴포넌트 포함

본 페이지는 **Perplexity** 번들에서 사용 가능한 컴포넌트 설명

Perplexity 기능에 대한 자세한 내용은 [Perplexity 문서](https://perplexity.ai/) 참조

## Perplexity 텍스트 생성

Perplexity 언어 모델을 사용하여 텍스트 생성

**Model Response** (`Message`) 또는 **Language Model** (`LanguageModel`) 출력 가능

Perplexity 모델을 다른 LLM 기반 컴포넌트(예: **Agent**, **Smart Transform**)의 LLM으로 사용하려면 **Language Model** 출력 사용

자세한 내용은 [Language model components](https://docs.langflow.org/components-models) 참조

### Perplexity 텍스트 생성 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김
컴포넌트 헤더 메뉴의 **Controls**를 통해 모든 파라미터 수정 가능

| Name | Type | Description |
|------|------|-------------|
| model_name | String | 입력 파라미터. 사용할 Perplexity 모델 이름. 다양한 Llama 3.1 모델 옵션 포함 |
| max_tokens | Integer | 입력 파라미터. 생성할 최대 토큰 수 |
| api_key | SecretString | 입력 파라미터. 인증을 위한 Perplexity API 키 |
| temperature | Float | 입력 파라미터. 출력의 무작위성 제어. 기본값: 0.75 |
| top_p | Float | 입력 파라미터. 샘플링 시 고려할 토큰의 최대 누적 확률 |
| n | Integer | 입력 파라미터. 각 프롬프트에 대해 생성할 채팅 완성 수 |
