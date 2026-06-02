# Couchbase

**Couchbase** 번들은 Couchbase 벡터 스토어와의 통합을 지원하는 컴포넌트 제공.

## Couchbase Vector Store

`CouchbaseSearchVectorStore` 인스턴스를 사용하여 Couchbase 벡터 스토어에 읽기/쓰기.

- **출력**: [Data](/data-types#data) 객체 목록 또는 [DataFrame](/data-types#dataframe)으로 검색 결과 반환

> **Tip**: 벡터 데이터베이스를 사용하는 Flow 튜토리얼: [Create a vector RAG chatbot](/chat-with-rag)

### 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

일부 파라미터는 조건부이며, 다른 파라미터 설정 또는 특정 옵션 선택 후에만 사용 가능.

자세한 정보: [Couchbase 문서](https://docs.couchbase.com/home/index.html)

| Name | Type | 설명 |
|------|------|------|
| `couchbase_connection_string` | SecretString | (입력) Couchbase 클러스터 연결 문자열. 필수. |
| `couchbase_username` | String | (입력) 인증을 위한 Couchbase 사용자명. 필수. |
| `couchbase_password` | SecretString | (입력) 인증을 위한 Couchbase 비밀번호. 필수. |
| `bucket_name` | String | (입력) Couchbase 버킷 이름. 필수. |
| `scope_name` | String | (입력) Couchbase 스코프 이름. 필수. |
| `collection_name` | String | (입력) Couchbase 컬렉션 이름. 필수. |
| `index_name` | String | (입력) Couchbase 인덱스 이름. 필수. |
| `ingest_data` | Data | (입력) 벡터 스토어에 로드할 레코드. 쓰기에만 해당. |
| `search_query` | String | (입력) 벡터 검색 쿼리 문자열. 읽기에만 해당. |
| `cache_vector_store` | Boolean | (입력) true 시 빠른 읽기를 위해 벡터 스토어를 메모리에 캐시. 기본값: `true` |
| `embedding` | Embeddings | (입력) 벡터 스토어에 사용할 임베딩 함수 |
| `number_of_results` | Integer | (입력) 반환할 최대 검색 결과 수. 기본값: `4`. 읽기에만 해당. |

