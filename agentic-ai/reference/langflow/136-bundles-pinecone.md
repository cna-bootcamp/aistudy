# Pinecone

**Bundles**는 Langflow와 특정 서드파티 통합을 지원하는 커스텀 컴포넌트 포함

본 페이지는 **Pinecone** 번들에서 사용 가능한 컴포넌트 설명

## Pinecone 벡터 스토어

`PineconeVectorStore` 인스턴스를 사용하여 Pinecone 벡터 스토어에서 읽고 쓰기

### 벡터 스토어 인스턴스 정보

Langflow는 LangChain을 기반으로 하기 때문에 벡터 스토어 컴포넌트는 [LangChain 벡터 스토어](https://docs.langchain.com/oss/python/integrations/vectorstores) 인스턴스를 사용하여
기본 읽기 및 쓰기 함수 구동

이러한 인스턴스는 제공자별로 다르며 컴포넌트의 파라미터(연결 문자열, 인덱스 이름, 스키마 등)에 따라 구성됨

컴포넌트 코드에서 이는 종종 `vector_store`로 인스턴스화되지만, 일부 벡터 스토어 컴포넌트는 제공자 이름과 같은 다른 이름 사용

일부 LangChain 클래스는 모든 가능한 옵션을 컴포넌트 파라미터로 노출하지 않음
제공자에 따라 이러한 옵션은 기본값을 사용하거나 Langflow에서 지원되는 경우 환경 변수를 통해 수정 허용
특정 옵션에 대한 정보는 LangChain API 참조 및 벡터 스토어 제공자의 문서 참조

벡터 스토어 컴포넌트를 사용하여 벡터 데이터베이스를 쿼리하는 경우, 플로우의 다운스트림 컴포넌트에 `Data` 객체 목록 또는
테이블 형식의 `DataFrame`으로 전달할 수 있는 검색 결과 생성

두 타입이 모두 지원되는 경우, 비주얼 에디터에서 벡터 스토어 컴포넌트의 출력 포트 근처에서 형식 설정 가능

**팁**: 플로우에서 벡터 데이터베이스를 사용하는 튜토리얼은 [Create a vector RAG chatbot](https://docs.langflow.org/chat-with-rag) 참조

### Pinecone 벡터 스토어 파라미터

벡터 스토어 컴포넌트의 파라미터를 검사하여 수락하는 입력, 지원하는 기능 및 구성 방법에 대해 자세히 알아볼 수 있음

일부 파라미터는 비주얼 에디터에서 기본적으로 숨김
컴포넌트 헤더 메뉴의 **Controls**를 통해 모든 파라미터 수정 가능

일부 파라미터는 조건부이며, 다른 파라미터를 설정하거나 다른 파라미터에 대한 특정 옵션을 선택한 후에만 사용 가능
조건부 파라미터는 필요한 종속성을 설정할 때까지 **Controls** 패널에 표시되지 않을 수 있음

허용되는 값 및 기능에 대한 정보는 [Pinecone 문서](https://docs.pinecone.io/home)를 참조하거나 [컴포넌트 코드](https://docs.langflow.org/concepts-components#component-code) 검사

| Name | Type | Description |
|------|------|-------------|
| index_name | String | 입력 파라미터. Pinecone 인덱스 이름 |
| namespace | String | 입력 파라미터. 인덱스의 네임스페이스 |
| distance_strategy | String | 입력 파라미터. 벡터 간 거리 계산 전략 |
| pinecone_api_key | SecretString | 입력 파라미터. Pinecone API 키 |
| text_key | String | 입력 파라미터. 레코드에서 텍스트로 사용할 키 |
| search_query | String | 입력 파라미터. 유사도 검색을 위한 쿼리 |
| ingest_data | Data | 입력 파라미터. 벡터 스토어에 수집할 데이터 |
| embedding | Embeddings | 입력 파라미터. 사용할 임베딩 함수 |
| number_of_results | Integer | 입력 파라미터. 검색에서 반환할 결과 수 |
