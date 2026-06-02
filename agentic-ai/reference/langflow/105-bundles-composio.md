# Composio

**Composio** 번들은 Composio 플랫폼과의 통합을 지원하는 컴포넌트 제공.

자세한 정보: [Composio 문서](https://docs.composio.dev/introduction/intro/overview)

## 개요

Composio 컴포넌트는 주로 [에이전트용 도구](/agents-tools)로 사용.

**Composio** 번들 구성:
- **Composio Tools** 컴포넌트: 여러 Composio 서비스에 대한 통합 접근점
- 단일 서비스 컴포넌트: Gmail, Slack 등 개별 서비스 컴포넌트

**권장 사용**: 단일 서비스 컴포넌트 사용 권장 (Composio Tools보다 선호).

**사용 모드**:
- 단일 서비스 컴포넌트: **Tool Mode**로 에이전트와 연결하거나 비에이전트 액션으로 Flow에서 사용 가능
- **Composio Tools** 컴포넌트: 에이전트 도구로만 사용 가능 (비에이전트 사용 불가)

## Flow에서 Composio 컴포넌트 사용

**Gmail** 컴포넌트를 **Agent** 컴포넌트의 도구로 사용하는 예시:

1. **Simple Agent** 템플릿 기반 Flow 생성
2. **Bundles**에서 **Composio** 번들의 **Gmail** 컴포넌트 추가
3. **Composio API Key** 필드에 API 키 입력 또는 `COMPOSIO_API_KEY` 글로벌 변수 사용
   - 유효한 키 제공 시 **Alert**가 **Success** 표시로 변경되고 **Actions** 목록 자동 채워짐
4. [컴포넌트 헤더 메뉴](/concepts-components#component-menus)에서 **Tool Mode** 활성화
   - **Composio Tools** 컴포넌트 사용 시 이미 도구로 구성되어 있으므로 생략
5. **Actions** 목록에서 에이전트에 제공할 Gmail 액션 구성
   - 허용할 액션 선택 및 각 액션의 slug(에이전트 라벨)와 설명 편집 가능
6. **Gmail** 컴포넌트의 **Toolset** 출력을 **Agent** 컴포넌트의 **Tools** 입력에 연결
7. **Agent** 컴포넌트에 OpenAI API 키 입력 또는 다른 LLM 구성

**연결 구조**:
- **Chat Input** → **Agent**의 **Input** 포트: 사용자/애플리케이션의 프롬프트로 Flow 트리거
- **Gmail** → **Agent**의 **Tools** 포트: 에이전트가 필요시 Gmail 도구 사용
- **Agent**의 **Output** → **Chat Output**: 최종 응답 반환

**테스트**:
1. **Playground**에서 에이전트에게 사용 가능한 도구 질문
2. 특정 도구 테스트: 에이전트에게 해당 도구 사용 액션 요청 (예: 이메일 초안 작성)

## 파라미터

모든 단일 서비스 Composio 컴포넌트는 동일한 파라미터 사용.
**Composio Tools** 컴포넌트는 하나의 추가 파라미터 포함.

| Name | Type | 설명 |
|------|------|------|
| `entity_id` | String | (입력) Composio 계정의 엔티티 ID. 기본값: `default`. 비주얼 에디터에서 기본적으로 숨김. |
| `api_key` | SecretString | (입력) Composio 플랫폼 인증을 위한 API 키. 사용하려는 특정 서비스에 대한 권한 필요. |
| `tool_name` | Connection | (입력) **Composio Tools** 컴포넌트 전용. 연결할 Composio 서비스(도구) 선택. |
| `action` | List | (입력) 사용할 액션 선택. 서비스별로 사용 가능한 액션 상이. 일부 액션은 프리미엄 액세스 필요. |

## Composio 인증

Composio 컴포넌트는 Composio API 키로 Composio 플랫폼 인증 필요.

**API 키 제공 방법**:
- 컴포넌트에 직접 입력
- `COMPOSIO_API_KEY` [글로벌 변수](/configuration-global-variables) 사용 (`.env` 파일에서 자동 로드)

> **참고**: Composio API 키는 Composio 연결만 처리. 서비스 제공자 인증은 사용하려는 각 서비스에 대해 Composio 플랫폼에서 관리.

**요구사항**: Composio API 키가 Flow의 컴포넌트에 필요한 서비스에 대한 액세스 권한 보유 필요.
예: **Gmail** 컴포넌트 사용 시 Composio API 키가 Gmail 서비스 액세스 권한 필요.

## 출력

**에이전트 도구로 사용 시**:
- 출력: [Tools](/data-types#tool) - 에이전트가 사용할 도구 목록
- 에이전트 호출 시 Composio 서비스 응답은 에이전트에 의해 처리되며 사용자/애플리케이션에 직접 전달되지 않음

**비에이전트 사용 시**:
- 출력: [DataFrame](/data-types#dataframe) - 사용된 컴포넌트와 액션에 따른 Composio 서비스 응답

**주의**: **Composio Tools** 컴포넌트는 에이전트 전용으로 `DataFrame` 출력 불가.
모든 단일 서비스 Composio 컴포넌트는 `DataFrame` 또는 `Tools` 출력 가능.

