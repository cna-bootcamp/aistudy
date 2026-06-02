# Elastic

**Elastic** 번들은 Elasticsearch 및 OpenSearch 벡터 데이터베이스와의 통합을 지원하는 컴포넌트 제공.

## Elasticsearch

**Elasticsearch** 컴포넌트는 [`ElasticsearchStore`](https://docs.langchain.com/oss/python/integrations/vectorstores/elasticsearch)를
사용하여 Elasticsearch 인스턴스에 읽기/쓰기.

- **출력**: [Data](/data-types#data) 객체 목록 또는 [DataFrame](/data-types#dataframe)으로 검색 결과 반환

자세한 내용은 [Elasticsearch 문서](https://www.elastic.co/guide/en/elasticsearch/reference/current/dense-vector.html) 참조.

### 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

일부 파라미터는 조건부이며, 다른 파라미터 설정 후 사용 가능. 조건부 파라미터는 필수 종속성 설정 전까지 **Controls** 창에
표시되지 않을 수 있음.

| Name | Type | 설명 |
|------|------|------|
| **Elasticsearch URL** (`elasticsearch_url`) | String | (입력) Elasticsearch 서버 URL |
| **Cloud ID** (`cloud_id`) | String | (입력) Elasticsearch Cloud ID |
| **Index Name** (`index_name`) | String | (입력) Elasticsearch 인덱스 이름 |
| **Ingest Data** (`ingest_data`) | Data | (입력) 벡터 스토어에 로드할 레코드 |
| **Search Query** (`search_query`) | String | (입력) 유사도 검색을 위한 쿼리 문자열 |
| **Cache Vector Store** (`cache_vector_store`) | Boolean | (입력) `true` 시 빠른 읽기를 위해 벡터 스토어를 메모리에 캐시. 기본값: `true` |
| **Username** (`username`) | String | (입력) Elasticsearch 인증을 위한 사용자명. 모든 로컬 배포에 필수. 클라우드 배포 시 `api_key`가 비어있으면 필수 |
| **Password** (`password`) | SecretString | (입력) Elasticsearch 인증을 위한 비밀번호. 모든 로컬 배포에 필수. 클라우드 배포 시 `api_key`가 비어있으면 필수 |
| **Embedding** (`embedding`) | Embeddings | (입력) 사용할 임베딩 모델 |
| **Search Type** (`search_type`) | String | (입력) 수행할 검색 유형. 옵션: `similarity`(기본값) 또는 `mmr` |
| **Number of Results** (`number_of_results`) | Integer | (입력) 반환할 검색 결과 수. 기본값: `4` |
| **Search Score Threshold** (`search_score_threshold`) | Float | (입력) 검색 결과의 최소 유사도 점수 임계값. 기본값: `0` |
| **API Key** (`api_key`) | SecretString | (입력) Elastic Cloud 인증을 위한 API 키. 제공 시 `username` 및 `password` 불필요 |
| **Verify Certs** (`verify_certs`) | Boolean | (입력) Elasticsearch 연결 시 SSL 인증서 검증 여부. 기본값: `true` |

## OpenSearch

**OpenSearch** 컴포넌트는 [`OpenSearchVectorSearch`](https://docs.langchain.com/oss/python/integrations/vectorstores/opensearch)를
사용하여 OpenSearch 인스턴스에 읽기/쓰기.

자세한 내용은 [OpenSearch 문서](https://opensearch.org/platform/search/vector-database.html) 참조.

### 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Type | 설명 |
|------|------|------|
| **OpenSearch URL** (`opensearch_url`) | String | (입력) OpenSearch 클러스터 URL (예: `https://192.168.1.1:9200`) |
| **Index Name** (`index_name`) | String | (입력) OpenSearch 클러스터에서 벡터가 저장된 인덱스 이름. 기본값: `langflow` |
| **Ingest Data** (`ingest_data`) | Data | (입력) 벡터 스토어에 수집할 데이터 |
| **Search Input** (`search_input`) | String | (입력) 검색 쿼리. 모든 문서 검색 또는 하이브리드 검색 사용 시 비워둠 |
| **Cache Vector Store** (`cache_vector_store`) | Boolean | (입력) `true` 시 빠른 읽기를 위해 벡터 스토어를 메모리에 캐시. 기본값: `true` |
| **Embedding** (`embedding`) | Embeddings | (입력) 검색 쿼리에서 임베딩 생성에 사용할 임베딩 모델 컴포넌트 연결 |
| **Search Type** (`search_type`) | String | (입력) 수행할 검색 유형. 옵션: `similarity`(기본값), `similarity_score_threshold`, `mmr` |
| **Number of Results** (`number_of_results`) | Integer | (입력) 검색에서 반환할 결과 수. 기본값: `4` |
| **Search Score Threshold** (`search_score_threshold`) | Float | (입력) 검색 결과의 최소 유사도 점수 임계값. 기본값: `0` |
| **Username** (`username`) | String | (입력) OpenSearch 클러스터의 사용자명. 기본값: `admin` |
| **Password** (`password`) | SecretString | (입력) OpenSearch 클러스터의 비밀번호 |
| **Use SSL** (`use_ssl`) | Boolean | (입력) SSL 사용 여부. 기본값: `true` |
| **Verify Certs** (`verify_certs`) | Boolean | (입력) SSL 인증서 검증 여부. 기본값: `false` |
| **Hybrid Search Query** (`hybrid_search_query`) | String | (입력) JSON 형식의 사용자 정의 하이브리드 검색 쿼리. 벡터 유사도와 키워드 매칭 결합 가능 |

### 출력

- **출력**: [Data](/data-types#data) 객체 목록 또는 [DataFrame](/data-types#dataframe)으로 검색 결과 반환
- 비주얼 에디터에서 벡터 스토어 컴포넌트의 출력 포트 근처에서 형식 설정 가능
