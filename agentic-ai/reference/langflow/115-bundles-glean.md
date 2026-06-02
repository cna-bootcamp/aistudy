# Glean

**Bundles**는 Langflow와 특정 서드파티 통합을 지원하는 커스텀 컴포넌트를 포함함.

본 페이지는 **Glean** 번들에서 사용 가능한 컴포넌트를 설명함.

## Glean Search API

Glean Search API를 호출하는 컴포넌트.

검색 결과 목록을 `DataFrame`으로 반환함.

### Glean Search API 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨겨짐.
컴포넌트 헤더 메뉴의 **Controls**를 통해 모든 파라미터 수정 가능.

| Name | Type | Description |
|------|------|-------------|
| glean_api_url | String | 입력 파라미터. Glean API의 URL |
| glean_access_token | SecretString | 입력 파라미터. Glean API 인증을 위한 액세스 토큰 |
| query | String | 입력 파라미터. 검색 쿼리 입력 |
| page_size | Integer | 입력 파라미터. 페이지당 결과 수. 기본값: 10 |
| request_options | Dict | 입력 파라미터. API 요청에 대한 추가 옵션 |

## 참고

- **Web Search** 컴포넌트
