# Groq

**Bundles**는 Langflow와 특정 서드파티 통합을 지원하는 커스텀 컴포넌트를 포함함.

본 페이지는 **Groq** 번들에서 사용 가능한 컴포넌트를 설명함.

자세한 내용은 [Groq 문서](https://groq.com/)를 참조.

## Groq 텍스트 생성

Groq의 언어 모델을 사용하여 텍스트를 생성하는 컴포넌트.

**Model Response**(`Message`) 또는 **Language Model**(`LanguageModel`)을 출력할 수 있음. 구체적으로
**Language Model** 출력은 컴포넌트의 파라미터에 따라 구성된 `ChatGroq` 인스턴스임.

Groq 모델을 **Agent** 또는 **Smart Transform** 컴포넌트와 같은 다른 LLM 기반 컴포넌트의 LLM으로 사용하려면
**Language Model** 출력을 사용함.

자세한 내용은 언어 모델 컴포넌트를 참조.

### Groq 텍스트 생성 파라미터

| Name | Type | Description |
|------|------|-------------|
| groq_api_key | SecretString | Groq API 키 |
| groq_api_base | String | API 요청을 위한 기본 URL 경로. 기본값: https://api.groq.com |
| max_tokens | Integer | 생성할 최대 토큰 수 |
| temperature | Float | 출력의 무작위성 제어. 범위: [0.0, 1.0]. 기본값: 0.1 |
| n | Integer | 각 프롬프트에 대해 생성할 채팅 완성 수 |
| model_name | String | 사용할 Groq 모델 이름. 옵션은 API 키 및 URL 입력 후 Groq API에서 동적으로 가져옴. 모델 목록을 새로 고치려면 Refresh를 클릭함 |
| tool_mode_enabled | Boolean | 활성화하면 도구와 함께 작동하는 모델만 표시함 |
