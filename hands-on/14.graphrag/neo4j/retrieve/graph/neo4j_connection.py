"""Neo4j 검색 연결 및 상태 조회 모듈.

검색 앱이 기존 인덱싱 결과를 읽기 위해 `Neo4jGraph`를 생성하고,
스키마·통계·벡터 인덱스 차원 검증 정보를 제공함.
"""
import logging
import time
from typing import Any

from langchain_neo4j import Neo4jGraph

from config.settings import Settings

logger = logging.getLogger(__name__)


class Neo4jConnection:
    """Neo4j 연결과 조회 편의 기능 제공."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.graph = self._connect_with_retry()

    def _connect_with_retry(self, max_retries: int = 3) -> Neo4jGraph:
        """Neo4j 연결을 최대 3회 재시도."""
        for attempt in range(max_retries):
            try:
                graph = Neo4jGraph(
                    url=self.settings.neo4j_uri,
                    username=self.settings.neo4j_user,
                    password=self.settings.neo4j_password,
                    sanitize=True,
                )
                logger.info("Neo4j 연결 성공: %s", self.settings.neo4j_uri)
                return graph
            except Exception as exc:
                wait_seconds = 2 ** attempt
                logger.warning(
                    "Neo4j 연결 실패 (시도 %d/%d), %d초 후 재시도: %s",
                    attempt + 1,
                    max_retries,
                    wait_seconds,
                    exc,
                )
                if attempt == max_retries - 1:
                    logger.error("Neo4j 연결 최종 실패")
                    raise
                time.sleep(wait_seconds)
        raise RuntimeError("Neo4j 연결 재시도 실패")

    def get_schema(self) -> str:
        """Neo4j 스키마를 새로고침 후 문자열로 반환."""
        self.graph.refresh_schema()
        return self.graph.schema

    def get_stats(self) -> dict[str, Any]:
        """노드·관계·라벨·관계 타입 통계 반환."""
        node_count = self.graph.query("MATCH (n) RETURN count(n) AS count")[0]["count"]
        relationship_count = self.graph.query("MATCH ()-[r]->() RETURN count(r) AS count")[0]["count"]
        node_labels = self.graph.query(
            "MATCH (n) "
            "UNWIND labels(n) AS label "
            "WITH label, count(*) AS count "
            "RETURN label, count "
            "ORDER BY count DESC"
        )
        relationship_types = self.graph.query(
            "MATCH ()-[r]->() "
            "WITH type(r) AS type, count(r) AS count "
            "RETURN type, count "
            "ORDER BY count DESC"
        )
        entity_count = self.graph.query(
            "MATCH (n) "
            "WHERE any(label IN labels(n) WHERE label IN $labels) "
            "RETURN count(n) AS count",
            params={"labels": list(self.settings.entity_labels)},
        )[0]["count"]
        chunk_count = self.graph.query("MATCH (n:Chunk) RETURN count(n) AS count")[0]["count"]
        return {
            "node_count": node_count,
            "relationship_count": relationship_count,
            "entity_count": entity_count,
            "chunk_count": chunk_count,
            "node_labels": node_labels,
            "relationship_types": relationship_types,
        }

    def get_index_info(self) -> list[dict[str, Any]]:
        """LOOKUP을 제외한 Neo4j 인덱스 정보 반환."""
        return self.graph.query(
            "SHOW INDEXES "
            "YIELD name, state, type, labelsOrTypes, properties, options "
            "WHERE type <> 'LOOKUP' "
            "RETURN name, state, type, labelsOrTypes, properties, options "
            "ORDER BY name"
        )

    def get_vector_dimensions(self) -> dict[str, int | None]:
        """벡터 인덱스별 차원 정보 반환."""
        dimensions: dict[str, int | None] = {}
        for index in self.get_index_info():
            if index.get("type") != "VECTOR":
                continue
            options = index.get("options") or {}
            index_config = options.get("indexConfig") or {}
            dimensions[index["name"]] = index_config.get("vector.dimensions")
        return dimensions

    def validate_vector_dimensions(self) -> list[str]:
        """벡터 인덱스 차원이 설정 임베딩 차원과 일치하는지 확인."""
        warnings: list[str] = []
        dimensions = self.get_vector_dimensions()
        for index_name in [self.settings.entity_index_name, self.settings.doc_index_name]:
            actual = dimensions.get(index_name)
            if actual is None:
                warnings.append(f"{index_name} 인덱스 차원 확인 실패")
            elif actual != self.settings.embedding_dim:
                warnings.append(
                    f"{index_name} 차원 불일치: Neo4j={actual}, 설정={self.settings.embedding_dim}"
                )
        return warnings

