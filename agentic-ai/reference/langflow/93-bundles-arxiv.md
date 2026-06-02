# arXiv

**arXiv** 번들은 arXiv.org와의 통합을 지원하는 컴포넌트 제공.

## arXiv Search

[arXiv.org](https://arXiv.org)에서 논문 검색 및 조회.

- **출력**: [DataFrame](/data-types#dataframe) - 검색 결과 목록

### 파라미터

| Name | Type | 설명 |
|------|------|------|
| `search_query` | String | (입력) arXiv 논문 검색 쿼리. 예: `quantum computing` |
| `search_type` | String | (입력) 검색할 필드 |
| `max_results` | Integer | (입력) 반환할 최대 결과 수 |

## 관련 항목

- [Web Search](/web-search) 컴포넌트

