"""Neo4j 벡터 인덱스 관리 모듈

Neo4j는 KG와 벡터 인덱스를 하나의 DB에 통합 저장함 (별도 벡터 저장소 불필요).
이 모듈이 만드는 벡터 인덱스 2개:
- entity_embedding: 교재 엔티티의 id+description 임베딩 (KG 노드 대상, from_existing_graph)
- doc_embedding   : 교재 청크 + 예제코드 텍스트 임베딩 (신규 Chunk 노드, from_documents)
"""
import logging

from langchain_core.documents import Document
# Neo4jVector: Neo4j를 벡터 스토어로 쓰는 LangChain 래퍼 (임베딩 저장 + 벡터 인덱스 생성)
from langchain_neo4j import Neo4jVector
# OllamaEmbeddings: 로컬 Ollama 서버로 텍스트를 임베딩하는 래퍼 (API 비용 0, 오프라인 가능)
from langchain_ollama import OllamaEmbeddings

from config.settings import Settings

logger = logging.getLogger(__name__)


class VectorIndexManager:
    """Neo4j 이중 벡터 인덱스(entity_embedding / doc_embedding) 관리"""

    def __init__(self, settings: Settings):
        self.settings = settings
        # qwen3-embedding(4096차원) 로컬 임베딩 — 인덱스 차원과 반드시 일치해야 검색이 동작함
        self.embeddings = OllamaEmbeddings(
            model=settings.embedding_model,
            base_url=settings.ollama_base_url,
        )

    def create_entity_vector_index(self) -> Neo4jVector:
        """entity_embedding: 교재 엔티티의 id+description 임베딩 인덱스 생성

        from_existing_graph(): 이미 Neo4j에 저장된 노드를 대상으로 임베딩과 벡터 인덱스를 추가함.
        - node_label="__Entity__": KG의 모든 엔티티 노드를 타입 무관하게 일괄 대상화
        - text_node_properties=["id", "description"]: 두 속성을 합친 텍스트를 임베딩 입력으로 사용
        - embedding_node_property="embedding": 생성된 벡터를 각 노드의 embedding 속성에 저장
        → 벡터 검색으로 진입 엔티티를 찾고, 그 엔티티에서 그래프를 확장 탐색하는 하이브리드 검색의 기반
        """
        logger.info("entity_embedding 벡터 인덱스 생성 중...")
        vector_store = Neo4jVector.from_existing_graph(
            embedding=self.embeddings,
            url=self.settings.neo4j_uri,
            username=self.settings.neo4j_user,
            password=self.settings.neo4j_password,
            index_name="entity_embedding",
            node_label="__Entity__",
            text_node_properties=["id", "description"],
            embedding_node_property="embedding",
        )
        logger.info("entity_embedding 벡터 인덱스 생성 완료")
        return vector_store

    def create_doc_vector_index(self, documents: list[Document]) -> Neo4jVector:
        """doc_embedding: 교재 청크 + 예제코드 텍스트 임베딩 인덱스 생성

        from_documents(): Document 리스트를 Neo4j에 신규 노드(기본 라벨 Chunk)로 만들고 임베딩함.
        - 교재 엔티티(KG)와 분리된 별도 Chunk 노드라 검색 대상이 섞이지 않음
        - metadata(source, source_type, chunk_index)가 노드 속성으로 저장되어 출처 추적 가능
        → "개념 설명"(교재 원문)·"X 구현 예제"(코드) 질문을 원문 단위 벡터 유사도로 직접 매칭함
        """
        logger.info("doc_embedding 벡터 인덱스 생성 중 (%d개 청크)...", len(documents))
        vector_store = Neo4jVector.from_documents(
            documents=documents,
            embedding=self.embeddings,
            url=self.settings.neo4j_uri,
            username=self.settings.neo4j_user,
            password=self.settings.neo4j_password,
            index_name="doc_embedding",
        )
        logger.info("doc_embedding 벡터 인덱스 생성 완료")
        return vector_store
