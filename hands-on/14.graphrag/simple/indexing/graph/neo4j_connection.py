"""Neo4j 연결·초기화·통계 모듈

인덱싱 파이프라인이 Neo4j에 KG를 저장하기 위해 `Neo4jGraph`를 생성하고,
그래프 초기화(--force)·엔티티 제약조건 생성·통계 조회 기능을 제공함.
"""
import logging
import time

# Neo4jGraph: Cypher 실행·그래프 저장을 감싼 LangChain Neo4j 래퍼
from langchain_neo4j import Neo4jGraph

from config.settings import Settings

logger = logging.getLogger(__name__)


class Neo4jConnection:
    """Neo4j 연결과 그래프 관리 기능 제공"""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.graph = self._connect_with_retry()

    def _connect_with_retry(self, max_retries: int = 3) -> Neo4jGraph:
        """Neo4j 연결을 최대 3회 재시도 (지수 백오프 1초·2초·4초)

        Docker 콜드스타트 중에는 Bolt 포트가 잠깐 닫혀 있을 수 있어, 즉시 실패시키지 않고
        점점 긴 간격으로 재시도해 기동 직후에도 연결이 성립하도록 함.
        """
        for attempt in range(max_retries):
            try:
                graph = Neo4jGraph(
                    url=self.settings.neo4j_uri,
                    username=self.settings.neo4j_user,
                    password=self.settings.neo4j_password,
                )
                logger.info("Neo4j 연결 성공: %s", self.settings.neo4j_uri)
                return graph
            except Exception as exc:
                wait_seconds = 2 ** attempt   # 1, 2, 4초로 대기 시간을 두 배씩 늘림
                logger.warning(
                    "Neo4j 연결 실패 (시도 %d/%d), %d초 후 재시도: %s",
                    attempt + 1, max_retries, wait_seconds, exc,
                )
                if attempt == max_retries - 1:
                    logger.error("Neo4j 연결 최종 실패 — docker compose up 상태를 확인하세요.")
                    raise
                time.sleep(wait_seconds)
        raise RuntimeError("Neo4j 연결 재시도 실패")

    def clear_graph(self) -> None:
        """그래프의 모든 노드·관계·인덱스를 제거함 (--force 재인덱싱용)

        MATCH (n) DETACH DELETE n: 모든 노드와 그에 연결된 관계를 한 번에 삭제함.
        벡터 인덱스는 노드 삭제로 비워지지 않으므로 DROP INDEX로 별도 제거함.
        """
        logger.info("그래프 초기화: 모든 노드·관계 삭제")
        self.graph.query("MATCH (n) DETACH DELETE n")
        # 기존 벡터 인덱스 제거 (차원·내용이 바뀐 채로 재사용되면 검색 오류가 나므로 깨끗이 삭제)
        for index_name in ("entity_embedding", "doc_embedding"):
            try:
                self.graph.query(f"DROP INDEX {index_name} IF EXISTS")
            except Exception as exc:
                logger.warning("인덱스 %s 삭제 실패(무시): %s", index_name, exc)
        logger.info("그래프 초기화 완료")

    def create_indexes(self) -> None:
        """엔티티 id 유니크 제약조건 생성 (MERGE 중복 방지 + 조회 성능)

        __Entity__ 라벨 노드의 id에 유니크 제약을 걸면, add_graph_documents의 MERGE가
        같은 이름의 엔티티를 중복 생성하지 않고 하나로 병합함.
        """
        try:
            self.graph.query(
                "CREATE CONSTRAINT entity_id IF NOT EXISTS "
                "FOR (n:__Entity__) REQUIRE n.id IS UNIQUE"
            )
            logger.info("엔티티 id 유니크 제약조건 생성 완료")
        except Exception as exc:
            logger.warning("제약조건 생성 실패(무시): %s", exc)

    def clear_doc_chunks(self) -> None:
        """기존 Chunk 노드를 모두 삭제함 (--force 없는 재실행에서도 중복 누적 방지, idempotent)

        doc_embedding은 from_documents로 매번 새 Chunk 노드를 만들기 때문에,
        재실행 전에 기존 Chunk를 비워야 같은 청크가 누적 저장되지 않음.
        """
        self.graph.query("MATCH (c:Chunk) DETACH DELETE c")
        logger.info("기존 Chunk 노드 삭제 완료")

    def get_stats(self) -> dict:
        """노드·관계 수와 라벨·관계 타입 분포 통계 반환"""
        node_count = self.graph.query("MATCH (n) RETURN count(n) AS cnt")[0]["cnt"]
        relationship_count = self.graph.query("MATCH ()-[r]->() RETURN count(r) AS cnt")[0]["cnt"]
        # UNWIND labels(n): 노드마다 가진 라벨 리스트를 행으로 펼쳐 라벨별 개수를 집계함
        node_labels = self.graph.query(
            "MATCH (n) UNWIND labels(n) AS lbls "
            "RETURN lbls, count(*) AS cnt ORDER BY cnt DESC"
        )
        relationship_types = self.graph.query(
            "MATCH ()-[r]->() RETURN type(r) AS rel_type, count(r) AS cnt ORDER BY cnt DESC"
        )
        return {
            "node_count": node_count,
            "relationship_count": relationship_count,
            "node_labels": node_labels,
            "relationship_types": relationship_types,
        }
