# Chroma

**Chroma** 번들은 Chroma 벡터 데이터베이스와의 통합을 지원하는 컴포넌트 제공.

## Chroma DB

`Chroma` 벡터 스토어 인스턴스를 사용하여 Chroma 데이터베이스에 읽기/쓰기.
원격 또는 인메모리 인스턴스 지원, 영속성 옵션 포함.

- 쓰기 시 지정된 위치에 새 데이터베이스 또는 컬렉션 생성 가능
- **출력**: [Data](/data-types#data) 객체 목록 또는 [DataFrame](/data-types#dataframe)으로 검색 결과 반환

> **Tip**: 임시(비영속) 로컬 Chroma 벡터 스토어는 데이터베이스 유지가 필요 없는 벡터 검색 Flow 테스트에 유용.

### Flow에서 사용 방법

**Chroma DB** 컴포넌트를 읽기와 쓰기 모두에 사용하는 예시:

**쓰기**:
1. [URL](/url) 컴포넌트에서 `Data`를 청크로 분할
2. 연결된 **Embedding Model** 컴포넌트로 임베딩 계산
3. 청크와 임베딩을 Chroma 벡터 스토어에 로드
4. 쓰기 트리거: **Chroma DB** 컴포넌트에서 **Run component** 클릭

**읽기**:
1. 채팅 입력으로 벡터 스토어에서 유사도 검색 수행
2. 검색 결과를 채팅에 출력
3. 읽기 트리거: **Playground**에서 채팅 메시지 입력

Flow 실행 후 각 컴포넌트에서 **Inspect Output**을 클릭하여 데이터 변환 과정 이해 가능.

### 파라미터

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김.
[컴포넌트 헤더 메뉴](/concepts-components#component-menus)의 **Controls**에서 모든 파라미터 수정 가능.

| Name | Type | 설명 |
|------|------|------|
| **Collection Name** (`collection_name`) | String | (입력) Chroma 벡터 스토어 컬렉션 이름. 기본값: `langflow` |
| **Persist Directory** (`persist_directory`) | String | (입력) Chroma 데이터베이스 영속화를 위한 `chroma.sqlite3` 파일 저장 디렉토리 경로. 임시 데이터베이스는 비워둠. 기존 영속 데이터베이스 읽기/쓰기 시 해당 경로 지정. |
| **Ingest Data** (`ingest_data`) | Data/DataFrame | (입력) 벡터 스토어에 쓸 레코드가 포함된 데이터. 쓰기에만 해당. |
| **Search Query** (`search_query`) | String | (입력) 벡터 검색에 사용할 쿼리. 읽기에만 해당. |
| **Cache Vector Store** (`cache_vector_store`) | Boolean | (입력) true 시 빠른 읽기를 위해 벡터 스토어를 메모리에 캐시. 기본값: `true` |
| **Embedding** (`embedding`) | Embeddings | (입력) 벡터 스토어에 사용할 임베딩 함수. 기본적으로 내장 임베딩 모델 사용 또는 **Embedding Model** 컴포넌트 연결. |
| **CORS Allow Origins** (`chroma_server_cors_allow_origins`) | String | (입력) Chroma 서버의 허용된 CORS 출처 |
| **Chroma Server Host** (`chroma_server_host`) | String | (입력) Chroma 서버 호스트 |
| **Chroma Server HTTP Port** (`chroma_server_http_port`) | Integer | (입력) Chroma 서버 HTTP 포트 |
| **Chroma Server gRPC Port** (`chroma_server_grpc_port`) | Integer | (입력) Chroma 서버 gRPC 포트 |
| **Chroma Server SSL Enabled** (`chroma_server_ssl_enabled`) | Boolean | (입력) Chroma 서버 SSL 활성화 |
| **Allow Duplicates** (`allow_duplicates`) | Boolean | (입력) true(기본값) 시 중복 확인 없이 동일 콘텐츠 여러 복사본 저장 허용. false 시 기존 문서와 일치하는 문서 추가 안 함. 쓰기에만 해당. |
| **Search Type** (`search_type`) | String | (입력) 수행할 검색 유형. `Similarity` 또는 `MMR`. 읽기에만 해당. |
| **Number of Results** (`number_of_results`) | Integer | (입력) 반환할 검색 결과 수. 기본값: `10`. 읽기에만 해당. |
| **Limit** (`limit`) | Integer | (입력) Allow Duplicates가 false일 때 비교할 레코드 수 제한. 대용량 컬렉션 쓰기 성능 향상에 도움. 쓰기에만 해당. |

## 관련 항목

- [Local DB](/components-bundle-components#vector-stores-bundle) 컴포넌트

