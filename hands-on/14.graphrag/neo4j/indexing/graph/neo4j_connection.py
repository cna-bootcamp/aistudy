"""Neo4j 연결 및 스키마 관리 모듈

지수 백오프 재시도로 안정적으로 연결하고, 인덱스/제약조건 생성·그래프 초기화·통계 조회를 제공함.
"""
import logging
import time

# Neo4jGraph: Cypher 실행과 스키마 조회를 감싼 LangChain Neo4j 래퍼 (graph.query()로 Cypher 실행)
from langchain_neo4j import Neo4jGraph

from config.settings import Settings

logger = logging.getLogger(__name__)


class Neo4jConnection:
    """Neo4j 연결 및 스키마 관리"""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.graph = self._connect_with_retry()

    def _connect_with_retry(self, max_retries: int = 3) -> Neo4jGraph:
        """지수 백오프(1초·2초·4초)로 최대 3회 재시도하며 Neo4j에 연결함.

        즉시 재연결은 일시 장애를 악화시킬 수 있어, 대기 시간을 2^attempt로 늘려 서버 복구 시간을 줌.
        콜드스타트(APOC 다운로드 포함 ~40초)는 docker-compose의 healthcheck + `up --wait`로 흡수하는 것이 원칙임.
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
            except Exception as e:
                wait = 2 ** attempt  # 1초 → 2초 → 4초로 대기 시간 증가
                logger.warning(
                    "Neo4j 연결 실패 (시도 %d/%d), %d초 후 재시도: %s",
                    attempt + 1, max_retries, wait, e,
                )
                if attempt < max_retries - 1:
                    time.sleep(wait)
                else:
                    logger.error("Neo4j 연결 최종 실패 — 컨테이너가 healthy 상태인지 확인하세요.")
                    raise

    def create_indexes(self):
        """엔티티 id 유니크 제약조건 생성 (중복 방지 + MERGE 성능 확보)

        UNIQUE 제약조건은 동일 엔티티가 여러 노드로 중복 생성되는 것을 막고,
        add_graph_documents()의 내부 MERGE 연산이 인덱스를 활용해 효율적으로 동작하게 함.
        """
        self.graph.query(
            "CREATE CONSTRAINT IF NOT EXISTS "
            "FOR (n:__Entity__) REQUIRE n.id IS UNIQUE"
        )
        logger.info("엔티티 id 유니크 제약조건 생성 완료")

    def clear_graph(self):
        """그래프 전체 삭제 (--force 재인덱싱용) — 제약조건 → 인덱스 → 노드/관계 순서로 제거함"""
        # 제약조건을 먼저 삭제 (제약조건이 걸린 노드를 먼저 지우면 무결성 위반 가능)
        constraints = self.graph.query("SHOW CONSTRAINTS")
        for c in constraints:
            self.graph.query(f"DROP CONSTRAINT {c['name']}")
        logger.info("제약조건 %d개 삭제", len(constraints))

        # LOOKUP 인덱스는 Neo4j 시스템 내부 인덱스라 삭제 대상에서 제외 (삭제 시도 시 오류)
        indexes = self.graph.query("SHOW INDEXES WHERE type <> 'LOOKUP'")
        for idx in indexes:
            self.graph.query(f"DROP INDEX {idx['name']}")
        logger.info("인덱스 %d개 삭제", len(indexes))

        # DETACH DELETE: 노드에 연결된 관계를 먼저 끊고 노드를 삭제 (일반 DELETE는 관계 있는 노드 삭제 시 오류)
        self.graph.query("MATCH (n) DETACH DELETE n")
        logger.info("그래프 전체 삭제 완료")

    def clear_doc_chunks(self):
        """doc_embedding 대상 Chunk 노드 삭제 (재인덱싱 시 중복 누적 방지)

        Chunk 노드는 from_documents가 매 실행마다 원본에서 새로 생성하는 doc_embedding 전용 노드라,
        --force 없이 재실행하면 누적 중복됨. 매번 먼저 비워 idempotent하게 만듦 (KG 엔티티엔 영향 없음).
        """
        self.graph.query("MATCH (n:Chunk) DETACH DELETE n")
        logger.info("기존 Chunk 노드 삭제 (doc_embedding 재생성 준비)")

    def get_stats(self) -> dict:
        """KG 통계(노드 수·관계 수·라벨 분포·관계 타입 분포) 반환"""
        node_count = self.graph.query(
            "MATCH (n) RETURN count(n) AS count"
        )[0]["count"]
        rel_count = self.graph.query(
            "MATCH ()-[r]->() RETURN count(r) AS count"
        )[0]["count"]
        node_labels = self.graph.query(
            "MATCH (n) WITH labels(n) AS lbls, count(n) AS cnt "
            "RETURN lbls, cnt ORDER BY cnt DESC"
        )
        rel_types = self.graph.query(
            "MATCH ()-[r]->() WITH type(r) AS rel_type, count(r) AS cnt "
            "RETURN rel_type, cnt ORDER BY cnt DESC"
        )
        return {
            "node_count": node_count,
            "relationship_count": rel_count,
            "node_labels": node_labels,
            "relationship_types": rel_types,
        }
