# DuckDuckGo

**DuckDuckGo** 번들은 DuckDuckGo 검색 엔진과의 통합을 지원하는 컴포넌트 제공.

## DuckDuckGo Search

**DuckDuckGo Search** 컴포넌트는 [DuckDuckGo](https://www.duckduckgo.com) 검색 엔진을 사용하여 웹 검색 수행.
결과 수 제한 기능 포함.

- **출력**: [DataFrame](/data-types#dataframe) 형태의 검색 결과 목록
- `text` 키에 검색 결과를 단일 문자열로 포함

### 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Type | 설명 |
|------|------|------|
| **Input Value** (`input_value`) | String | (입력) DuckDuckGo로 실행할 검색 쿼리 |
| **Max Results** (`max_results`) | Integer | (입력) 반환할 최대 검색 결과 수. 기본값: `5` |
| **Max Snippet Length** (`max_snippet_length`) | Integer | (입력) 각 결과 스니펫의 최대 길이. 기본값: `100` |

## 관련 항목

- [Web Search](/web-search) 컴포넌트
- [SearchApi](/bundles-searchapi) 번들
