# Cassandra

**Cassandra** 번들은 Apache Cassandra 클러스터(OSS Cassandra, Astra DB 등)에 읽기/쓰기를 지원하는 컴포넌트 제공.

## Cassandra Vector Store

`CassandraVectorStore` 인스턴스를 사용하여 Cassandra 기반 벡터 스토어에 읽기/쓰기.

- **출력**: 벡터 데이터베이스 쿼리 시 [Data](/data-types#data) 객체 목록 또는 [DataFrame](/data-types#dataframe)으로 검색 결과 반환
- 비주얼 에디터에서 출력 포트 근처에서 형식 설정 가능

> **Tip**: 벡터 데이터베이스를 사용하는 Flow 튜토리얼: [Create a vector RAG chatbot](/chat-with-rag)

### 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

자세한 정보: [Vector search in Cassandra](https://cassandra.apache.org/doc/latest/cassandra/vector-search/overview.html)

| Name | Type | 설명 |
|------|------|------|
| `database_ref` | String | (입력) 데이터베이스 연결 지점 또는 Astra 데이터베이스 ID |
| `username` | String | (입력) 데이터베이스 사용자명. Astra DB는 비워둠. |
| `token` | SecretString | (입력) 데이터베이스 비밀번호 또는 Astra 애플리케이션 토큰 |
| `keyspace` | String | (입력) 벡터 스토어가 포함된 키스페이스 이름 |
| `table_name` | String | (입력) 벡터 스토어인 테이블 또는 컬렉션 이름 |
| `ttl_seconds` | Integer | (입력) 추가된 텍스트의 TTL. 쓰기에만 해당. |
| `batch_size` | Integer | (입력) 단일 배치에서 처리할 레코드 수 |
| `setup_mode` | String | (입력) Cassandra 테이블 설정 구성 모드 |
| `cluster_kwargs` | Dict | (입력) Cassandra 클러스터의 추가 키워드 인수 |
| `search_query` | String | (입력) 유사도 검색 쿼리 문자열. 읽기에만 해당. |
| `ingest_data` | Data | (입력) 원시 청크 및 임베딩으로 벡터 스토어에 로드할 데이터. 쓰기에만 해당. |
| `embedding` | Embeddings | (입력) 사용할 임베딩 함수 |
| `number_of_results` | Integer | (입력) 검색에서 반환할 결과 수. 읽기에만 해당. |
| `search_type` | String | (입력) 수행할 검색 유형. 읽기에만 해당. |
| `search_score_threshold` | Float | (입력) 검색 결과의 최소 유사도 점수. 읽기에만 해당. |
| `search_filter` | Dict | (입력) 벡터 검색 외에 적용할 메타데이터 검색 필터. 읽기에만 해당. |
| `body_search` | String | (입력) 문서 텍스트 검색어. 읽기에만 해당. |
| `enable_body_search` | Boolean | (입력) 본문 검색 활성화 플래그. 읽기에만 해당. |

## Cassandra Chat Memory

Apache Cassandra 기반 데이터베이스를 사용하여 채팅 메시지 조회 및 저장.

- **출력**: [Memory](/data-types#memory) - `CassandraChatMessageHistory` 인스턴스

외부 채팅 메모리 사용 방법: [Message History](/message-history) 컴포넌트 참조.

### 파라미터

| Name | Type | 설명 |
|------|------|------|
| `database_ref` | MessageText | (입력) Cassandra 연결 지점 또는 Astra DB 데이터베이스 ID. 필수. |
| `username` | MessageText | (입력) Cassandra 사용자명. Astra DB는 비워둠. |
| `token` | SecretString | (입력) Cassandra 비밀번호 또는 Astra DB 토큰. 필수. |
| `keyspace` | MessageText | (입력) Cassandra 키스페이스 또는 Astra DB 네임스페이스. 필수. |
| `table_name` | MessageText | (입력) 메시지 저장용 테이블 또는 컬렉션 이름. 필수. |
| `session_id` | MessageText | (입력) 채팅 세션 고유 식별자. 선택. |
| `cluster_kwargs` | Dictionary | (입력) Cassandra 클러스터 구성의 추가 키워드 인수. 선택. |

## Cassandra Graph

`CassandraGraphVectorStore`([LangChain graph vector store](https://python.langchain.com/api_reference/community/graph_vectorstores.html) 인스턴스)를 사용하여 호환 Cassandra 기반 클러스터에서 그래프 탐색 및 그래프 기반 문서 검색. 벡터 스토어 쓰기도 지원.

- **출력**: [Data](/data-types#data) 객체 목록 또는 [DataFrame](/data-types#dataframe)

### 파라미터

| Name | Display Name | 설명 |
|------|--------------|------|
| `database_ref` | Contact Points / Astra Database ID | (입력) 데이터베이스 연결 지점 또는 Astra 데이터베이스 ID. 필수. |
| `username` | Username | (입력) 데이터베이스 사용자명. Astra DB는 비워둠. |
| `token` | Password / Astra DB Token | (입력) 데이터베이스 비밀번호 또는 Astra 애플리케이션 토큰. 필수. |
| `keyspace` | Keyspace | (입력) 벡터 스토어가 포함된 키스페이스 이름. 필수. |
| `table_name` | Table Name | (입력) 벡터 스토어인 테이블 또는 컬렉션 이름. 필수. |
| `setup_mode` | Setup Mode | (입력) Cassandra 테이블 설정 구성 모드. 옵션: `Sync`(기본값), `Off` |
| `cluster_kwargs` | Cluster arguments | (입력) Cassandra 클러스터의 추가 키워드 인수. 선택. |
| `search_query` | Search Query | (입력) 유사도 검색 쿼리 문자열. 읽기에만 해당. |
| `ingest_data` | Ingest Data | (입력) 원시 청크 및 임베딩으로 벡터 스토어에 로드할 데이터. 쓰기에만 해당. |
| `embedding` | Embedding | (입력) 사용할 임베딩 모델 |
| `number_of_results` | Number of Results | (입력) 유사도 검색에서 반환할 결과 수. 읽기에만 해당. 기본값: 4 |
| `search_type` | Search Type | (입력) 사용할 검색 유형. 옵션: `Traversal`(기본값), `MMR Traversal`, `Similarity`, `Similarity with score threshold`, `MMR (Max Marginal Relevance)` |
| `depth` | Depth of traversal | (입력) 탐색할 최대 에지 깊이. 검색 유형이 `Traversal` 또는 `MMR Traversal`일 때만 해당. 기본값: 1 |
| `search_score_threshold` | Search Score Threshold | (입력) 검색 결과의 최소 유사도 점수 임계값. `Similarity with score threshold` 검색 유형에만 해당. |
| `search_filter` | Search Metadata Filter | (입력) 그래프 탐색 및 유사도 검색 외에 적용할 메타데이터 검색 필터 |

## 관련 항목

- [DataStax](/bundles-datastax) 번들

