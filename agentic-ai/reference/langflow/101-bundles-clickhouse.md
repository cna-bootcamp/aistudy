# ClickHouse

**ClickHouse** 번들은 ClickHouse 벡터 스토어와의 통합을 지원하는 컴포넌트 제공.

## ClickHouse Vector Store

`ClickHouse` 벡터 스토어 인스턴스를 사용하여 ClickHouse 벡터 스토어에 읽기/쓰기.

- **출력**: [Data](/data-types#data) 객체 목록 또는 [DataFrame](/data-types#dataframe)으로 검색 결과 반환

> **Tip**: 벡터 데이터베이스를 사용하는 Flow 튜토리얼: [Create a vector RAG chatbot](/chat-with-rag)

### 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

자세한 정보: [ClickHouse 문서](https://clickhouse.com/docs/en/intro)

| Name | Display Name | 설명 |
|------|--------------|------|
| `host` | hostname | (입력) ClickHouse 서버 호스트명. 필수. 기본값: `localhost` |
| `port` | port | (입력) ClickHouse 서버 포트. 필수. 기본값: `8123` |
| `database` | database | (입력) ClickHouse 데이터베이스 이름. 필수. |
| `table` | Table name | (입력) ClickHouse 테이블 이름. 필수. |
| `username` | Username | (입력) ClickHouse 인증 사용자명. 필수. |
| `password` | Password | (입력) ClickHouse 인증 비밀번호. 필수. |
| `index_type` | index_type | (입력) 인덱스 유형. `annoy`(기본값) 또는 `vector_similarity` |
| `metric` | metric | (입력) 유사도 검색 거리 계산 메트릭. 옵션: `angular`(기본값), `euclidean`, `manhattan`, `hamming`, `dot` |
| `secure` | Use HTTPS/TLS | (입력) true 시 ClickHouse 서버에 HTTPS/TLS 활성화하고 인터페이스 또는 포트 인수의 추론 값 재정의. 기본값: `false` |
| `index_param` | Param of the index | (입력) 인덱스 파라미터. 기본값: `100,'L2Distance'` |
| `index_query_params` | index query params | (입력) 추가 인덱스 쿼리 파라미터 |
| `search_query` | Search Query | (입력) 유사도 검색 쿼리 문자열. 읽기에만 해당. |
| `ingest_data` | Ingest Data | (입력) 벡터 스토어에 로드할 레코드 |
| `cache_vector_store` | Cache Vector Store | (입력) true 시 빠른 읽기를 위해 벡터 스토어를 메모리에 캐시. 기본값: `true` |
| `embedding` | Embedding | (입력) 사용할 임베딩 모델 |
| `number_of_results` | Number of Results | (입력) 반환할 검색 결과 수. 기본값: `4`. 읽기에만 해당. |
| `score_threshold` | Score threshold | (입력) 유사도 점수 비교 임계값. 기본값: 미설정 (임계값 없음). 읽기에만 해당. |

