# Bing

**Bing** 번들은 Bing Search API와의 통합을 지원하는 컴포넌트 제공.

## Bing Search API

Bing Search API 호출.

- **출력**: [DataFrame](/data-types#dataframe) - 검색 결과 목록

### 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Type | 설명 |
|------|------|------|
| `bing_subscription_key` | SecretString | (입력) Bing API 구독 키 |
| `input_value` | String | (입력) 검색 쿼리 입력 |
| `bing_search_url` | String | (입력) 커스텀 Bing Search URL |
| `k` | Integer | (입력) 반환할 검색 결과 수 |

## 관련 항목

- [Web Search](/web-search) 컴포넌트
- [SearchApi](/bundles-searchapi) 번들

