# Qdrant

**번들(Bundles)**은 Langflow와 특정 타사 통합을 지원하는 사용자 정의 컴포넌트를 포함함.

이 페이지는 **Qdrant** 번들에서 사용 가능한 컴포넌트를 설명함.

## Qdrant 벡터 스토어

**Qdrant** 컴포넌트는 `QdrantVectorStore` 인스턴스를 사용하여 Qdrant 벡터 스토어에 읽기/쓰기 수행.

### 벡터 스토어 인스턴스 정보

Langflow는 LangChain 기반이므로, 벡터 스토어 컴포넌트는 기본 읽기/쓰기 기능을 구동하기 위해
LangChain 벡터 스토어 인스턴스를 사용함.

이러한 인스턴스는 프로바이더별로 다르며 연결 문자열, 인덱스 이름, 스키마 등의 컴포넌트 파라미터에 따라 구성됨.
컴포넌트 코드에서 일반적으로 `vector_store`로 인스턴스화되지만, 일부 벡터 스토어 컴포넌트는
프로바이더 이름과 같은 다른 이름을 사용함.

일부 LangChain 클래스는 모든 가능한 옵션을 컴포넌트 파라미터로 노출하지 않음.
프로바이더에 따라 이러한 옵션은 기본값을 사용하거나 Langflow에서 지원되는 경우 환경 변수를 통해 수정 가능.

특정 옵션에 대한 정보는 LangChain API 참조 및 벡터 스토어 프로바이더 문서 참조.

벡터 스토어 컴포넌트를 사용하여 벡터 데이터베이스를 쿼리하면 검색 결과가 생성되며,
이를 `Data` 객체 목록 또는 테이블 형식 `DataFrame`으로 플로우의 다운스트림 컴포넌트에 전달 가능.
두 유형이 모두 지원되는 경우, 비주얼 에디터에서 벡터 스토어 컴포넌트의 출력 포트 근처에서 형식 설정 가능.

> **팁**: 플로우에서 벡터 데이터베이스를 사용하는 튜토리얼은 "벡터 RAG 챗봇 생성" 참조.

## Qdrant 벡터 스토어 파라미터

벡터 스토어 컴포넌트의 파라미터를 검사하여 수락하는 입력, 지원하는 기능 및 구성 방법에 대한 자세한 정보 확인 가능.

일부 파라미터는 비주얼 에디터에서 기본적으로 숨겨져 있음.
컴포넌트 헤더 메뉴의 **Controls**를 통해 모든 파라미터 수정 가능.

일부 파라미터는 조건부이며, 다른 파라미터를 설정하거나 다른 파라미터에 대한 특정 옵션을 선택한 후에만 사용 가능.
조건부 파라미터는 필요한 종속성을 설정할 때까지 **Controls** 패널에 표시되지 않을 수 있음.

허용되는 값 및 기능에 대한 정보는 Qdrant 문서를 참조하거나 컴포넌트 코드를 검사함.

| 이름 | 타입 | 설명 |
|------|------|------|
| collection_name | String | 입력 파라미터. Qdrant 컬렉션 이름 |
| host | String | 입력 파라미터. Qdrant 서버 호스트 |
| port | Integer | 입력 파라미터. Qdrant 서버 포트 |
| grpc_port | Integer | 입력 파라미터. Qdrant gRPC 포트 |
| api_key | SecretString | 입력 파라미터. Qdrant용 API 키 |
| prefix | String | 입력 파라미터. Qdrant용 접두사 |
| timeout | Integer | 입력 파라미터. Qdrant 작업 타임아웃 |
| path | String | 입력 파라미터. Qdrant용 경로 |
| url | String | 입력 파라미터. Qdrant용 URL |
| distance_func | String | 입력 파라미터. 벡터 유사도 계산을 위한 거리 함수 |
| content_payload_key | String | 입력 파라미터. 콘텐츠 페이로드 키 |
| metadata_payload_key | String | 입력 파라미터. 메타데이터 페이로드 키 |
| search_query | String | 입력 파라미터. 유사도 검색을 위한 쿼리 |
| ingest_data | Data | 입력 파라미터. 벡터 스토어에 수집될 데이터 |
| embedding | Embeddings | 입력 파라미터. 사용할 임베딩 함수 |
| number_of_results | Integer | 입력 파라미터. 검색에서 반환할 결과 수 |
