# DataStax 번들

DataStax 번들은 Astra DB Serverless 데이터베이스와의 통합을 지원하는 컴포넌트 모음임.

---

## 주요 컴포넌트

DataStax 번들에 포함된 5가지 핵심 컴포넌트:

- **Astra DB**: 벡터 스토어로 문서 읽기/쓰기 및 하이브리드 검색 지원
- **Astra DB CQL**: CQL 테이블 쿼리를 위한 에이전트 도구
- **Graph RAG**: GraphRetriever 기반 그래프 문서 검색
- **HCD (Hyper-Converged Database)**: Data API 서버를 통한 벡터 스토어 읽기/쓰기
- **Astra DB Chat Memory**: 채팅 메시지 저장 및 검색 (Agent 컴포넌트 내장 메모리 권장)

---

## Astra DB

AstraDBVectorStore 인스턴스를 생성하여 Astra DB Serverless 데이터베이스에서 문서를 읽고 쓸 수 있음.
벡터 검색과 하이브리드 검색을 모두 지원함.

### 주요 파라미터

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `collection_name` | String | Astra DB 컬렉션 이름 |
| `token` | String | Astra DB 애플리케이션 토큰 |
| `api_endpoint` | String | Astra DB API 엔드포인트 URL |
| `search_type` | String | 검색 유형 (similarity, mmr, similarity_score_threshold) |
| `embedding` | Embeddings | 임베딩 모델 인스턴스 |
| `number_of_results` | Integer | 반환할 검색 결과 수 |

### 사용 예시

```python
from langchain_astradb import AstraDBVectorStore

vector_store = AstraDBVectorStore(
    collection_name="my_collection",
    token="AstraCS:...",
    api_endpoint="https://xxx.apps.astra.datastax.com",
    embedding=embedding_model
)
```

---

## Astra DB CQL

Astra DB 또는 Apache Cassandra 데이터베이스의 CQL 테이블을 쿼리할 수 있는 에이전트 도구임.
CQL(Cassandra Query Language)을 사용하여 구조화된 데이터에 접근 가능.

### 주요 파라미터

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `token` | String | Astra DB 애플리케이션 토큰 |
| `api_endpoint` | String | Astra DB API 엔드포인트 URL |
| `keyspace` | String | CQL 키스페이스 이름 |
| `table` | String | 쿼리 대상 CQL 테이블 이름 |

### 사용 예시

```python
from langflow.components.datastax import AstraDBCQLTool

cql_tool = AstraDBCQLTool(
    token="AstraCS:...",
    api_endpoint="https://xxx.apps.astra.datastax.com",
    keyspace="my_keyspace",
    table="my_table"
)
```

---

## Graph RAG

GraphRetriever를 사용하여 그래프 기반 문서 검색을 수행함.
문서 간 관계를 활용한 고급 검색 기능 제공.

### 주요 파라미터

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `collection_name` | String | Astra DB 컬렉션 이름 |
| `token` | String | Astra DB 애플리케이션 토큰 |
| `api_endpoint` | String | Astra DB API 엔드포인트 URL |
| `embedding` | Embeddings | 임베딩 모델 인스턴스 |
| `graph_depth` | Integer | 그래프 탐색 깊이 |

### 사용 예시

```python
from langflow.components.datastax import GraphRAG

graph_rag = GraphRAG(
    collection_name="graph_docs",
    token="AstraCS:...",
    api_endpoint="https://xxx.apps.astra.datastax.com",
    embedding=embedding_model,
    graph_depth=2
)
```

---

## HCD (Hyper-Converged Database)

Data API 서버를 통해 HCD 벡터 스토어에서 문서를 읽고 쓸 수 있음.
온프레미스 또는 프라이빗 클라우드 환경에서 Astra DB와 유사한 기능 제공.

### 주요 파라미터

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `collection_name` | String | HCD 컬렉션 이름 |
| `token` | String | HCD 애플리케이션 토큰 |
| `api_endpoint` | String | Data API 서버 엔드포인트 URL |
| `embedding` | Embeddings | 임베딩 모델 인스턴스 |
| `number_of_results` | Integer | 반환할 검색 결과 수 |

### 사용 예시

```python
from langflow.components.datastax import HCDVectorStore

hcd_store = HCDVectorStore(
    collection_name="my_hcd_collection",
    token="token123",
    api_endpoint="https://hcd-server.example.com",
    embedding=embedding_model
)
```

---

## Astra DB Chat Memory

Astra DB에 채팅 메시지를 저장하고 검색할 수 있는 메모리 컴포넌트임.

**권장 사항**: Agent 컴포넌트에 내장된 메모리 기능 사용 권장.
별도 메모리 관리가 필요한 특수한 경우에만 이 컴포넌트 사용.

### 주요 파라미터

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `collection_name` | String | 채팅 메시지를 저장할 컬렉션 이름 |
| `token` | String | Astra DB 애플리케이션 토큰 |
| `api_endpoint` | String | Astra DB API 엔드포인트 URL |
| `session_id` | String | 채팅 세션 식별자 |

### 사용 예시

```python
from langflow.components.datastax import AstraDBChatMemory

chat_memory = AstraDBChatMemory(
    collection_name="chat_history",
    token="AstraCS:...",
    api_endpoint="https://xxx.apps.astra.datastax.com",
    session_id="user_session_123"
)
```

---

## 참고 사항

- 모든 DataStax 컴포넌트는 Astra DB 애플리케이션 토큰과 API 엔드포인트 필요
- 벡터 검색 기능 사용 시 적절한 임베딩 모델 선택 필요
- Graph RAG는 문서 간 관계가 중요한 복잡한 검색 시나리오에 유용
- HCD는 온프레미스 환경에서 Astra DB 기능을 사용하고자 할 때 활용
- Chat Memory는 Agent 내장 메모리로 대체 가능하므로 특별한 요구사항이 있을 때만 사용 권장
