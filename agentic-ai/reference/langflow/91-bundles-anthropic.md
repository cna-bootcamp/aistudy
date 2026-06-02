# Anthropic

**Anthropic** 번들은 Anthropic Claude 모델과의 통합을 지원하는 컴포넌트 제공.

자세한 정보: [Anthropic 문서](https://docs.anthropic.com/en/docs/intro)

## Anthropic Text Generation

Anthropic Chat 및 Language 모델(Claude)을 사용하여 텍스트 생성.

### 출력 타입

| 출력 | 설명 |
|------|------|
| **Model Response** | [Message](/data-types#message) - 모델 응답 텍스트 |
| **Language Model** | [LanguageModel](/data-types#languagemodel) - [ChatAnthropic](https://docs.langchain.com/oss/python/integrations/chat/anthropic) 인스턴스 |

**Language Model** 출력: **Agent**, **Smart Transform** 등 다른 LLM 기반 컴포넌트의 LLM으로 사용 시 선택.

자세한 정보: [Language model components](/components-models)

### 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Type | 설명 |
|------|------|------|
| `max_tokens` | Integer | (입력) 생성할 최대 토큰 수. 0 설정 시 무제한. 기본값: `4096` |
| `model` | String | (입력) 사용할 Anthropic 모델 이름. 다양한 Claude 3 모델 옵션 포함. |
| `anthropic_api_key` | SecretString | (입력) 인증용 Anthropic API 키 |
| `temperature` | Float | (입력) 출력 무작위성 제어. 기본값: `0.1` |
| `anthropic_api_url` | String | (입력) Anthropic API 엔드포인트. 미지정 시 `https://api.anthropic.com` 기본값. |
| `prefill` | String | (입력) 모델 응답을 안내하는 prefill 텍스트 |

