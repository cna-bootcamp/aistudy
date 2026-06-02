"""GraphRAG 검색 엔진 — "결정된 검색 방법에 따라 검색"하고 "결과를 LLM에 보내" 답변을 생성하는 단계.

`entity_embedding`·`doc_embedding` 벡터 검색, `GraphCypherQAChain` 그래프 질의,
벡터 시드 기반 1-hop 그래프 확장, 사용자 Cypher 직접 실행을 제공함. (Neo4j retrieve 예제와 동일 로직)

[Neo4j retrieve 예제 대비 변경 사항]
  - ChatOpenAI 직접 생성 → config.llm.build_chat_llm 사용 (llama-3.3-70b-versatile, reasoning_effort 미사용)
"""
import logging
import re
from typing import Any

from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_neo4j import GraphCypherQAChain, Neo4jGraph
from langchain_ollama import OllamaEmbeddings

from config.llm import build_chat_llm
from config.settings import Settings

logger = logging.getLogger(__name__)

# 검색 컨텍스트만으로 한국어 답변을 생성하도록 강제하는 시스템 프롬프트
RESPONSE_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are a GraphRAG teaching assistant for an enterprise AI Boot Camp. "
        "The user question is clear; do not ask the user to clarify. "
        "Answer directly in Korean using only the retrieved context. "
        "If the context is insufficient, state the missing information in Korean.",
    ),
    (
        "human",
        "User question:\n{question}\n\nRetrieved context:\n{context}\n\n"
        "Write a concise Korean answer with the conclusion, evidence, and source filenames when available.",
    ),
])


class QueryEngine:
    """4가지 검색 모드 실행 엔진."""

    def __init__(self, settings: Settings, graph: Neo4jGraph):
        self.settings = settings
        self.graph = graph
        # 답변·Cypher 생성용 LLM. 답변이 길 수 있으므로 max_completion_tokens를 설정값으로 둠
        self.llm = build_chat_llm(settings, max_completion_tokens=settings.groq_max_tokens)
        # OllamaEmbeddings: 로컬 Ollama 임베딩 서버에 쿼리 텍스트를 보내 벡터로 변환하는 래퍼.
        # 저장된 벡터가 qwen3-embedding(4096차원)이므로 검색 쿼리도 같은 모델로 임베딩해야 함.
        self.embeddings = OllamaEmbeddings(
            model=settings.embedding_model,
            base_url=settings.ollama_base_url,
        )
        self.graph_chain = self._build_graph_chain()

    def search(self, question: str, mode: str) -> dict[str, Any]:
        """선택된 모드로 검색 실행 (라우터가 정한 mode를 그대로 받음)."""
        if mode == "vector":
            return self.vector_search(question)
        if mode == "graph_qa":
            return self.graph_qa(question)
        if mode == "hybrid":
            return self.hybrid_search(question)
        if mode == "cypher":
            return self.cypher_direct(question)
        return self.vector_search(question)

    def vector_search(self, question: str) -> dict[str, Any]:
        """엔티티와 문서 청크 벡터 인덱스를 함께 검색."""
        try:
            query_embedding = self._embed_query(question)
            entity_hits = self._query_entity_vectors(query_embedding, self.settings.entity_top_k)
            doc_hits = self._query_doc_vectors(query_embedding, self.settings.doc_top_k)
            context_docs = self._expand_doc_neighbors(doc_hits)
        except Exception as exc:
            logger.error("벡터 검색 실패: %s", exc)
            return self._error_result("vector", f"벡터 검색 중 오류 발생: {exc}")

        if not entity_hits and not doc_hits:
            logger.warning("벡터 검색 결과 없음: %s", question)
            return {
                "mode": "vector",
                "answer": "벡터 검색 결과가 없습니다. 인덱싱 상태와 질문 표현을 확인하세요.",
                "sources": [],
                "vector_hits": [],
            }

        context = self._build_vector_context(entity_hits, context_docs or doc_hits)
        answer = self._generate_answer(question, context)
        return {
            "mode": "vector",
            "answer": answer,
            "sources": self._collect_sources(entity_hits + (context_docs or doc_hits)),
            "vector_hits": entity_hits + doc_hits,
            "context_chunks": context_docs,
        }

    def graph_qa(self, question: str) -> dict[str, Any]:
        """GraphCypherQAChain으로 Cypher 자동 생성·실행 후 답변 생성.

        LLM이 간헐적으로 Cypher 대신 안내 문장을 생성해 Neo4j SyntaxError를 유발하는 비결정성이 있음.
        LLM API 재시도(max_retries)는 이런 다운스트림 Cypher 실행 오류를 잡지 못하므로, 여기서 체인을
        한 번 더 재시도하고(전이적 실패 보정), 그래도 실패하면 집계(count) 질문은 정답이 결정적이라
        Cypher 집계 폴백으로 복구함.
        """
        last_exc: Exception | None = None
        for attempt in range(2):  # 전이적 잡담 생성(SyntaxError)을 1회 재시도로 흡수
            try:
                result = self.graph_chain.invoke({"query": question})
                steps = result.get("intermediate_steps", [])
                cypher = self._extract_intermediate_value(steps, "query") or ""
                graph_context = self._extract_intermediate_value(steps, "context") or []
                fallback = self._try_graph_aggregate_fallback(question, cypher, graph_context)
                if fallback:
                    return fallback
                return {
                    "mode": "graph_qa",
                    "answer": result.get("result", "그래프 질의 결과가 없습니다."),
                    "cypher": cypher,
                    "graph_data": graph_context,
                    "sources": ["Neo4j KG"],
                }
            except Exception as exc:
                last_exc = exc
                logger.warning("GraphCypherQAChain 시도 %d/2 실패: %s", attempt + 1, exc)

        # 모든 시도 실패 → 집계 질문은 빈 컨텍스트를 강제해 Cypher 집계 폴백으로 결정적 복구 시도
        fallback = self._try_graph_aggregate_fallback(question, "", [])
        if fallback:
            return fallback
        logger.error("GraphCypherQAChain 최종 실패: %s", last_exc)
        return self._error_result("graph_qa", f"Graph QA Cypher 생성 또는 실행 실패: {last_exc}")

    def hybrid_search(self, question: str) -> dict[str, Any]:
        """벡터로 시드 엔티티를 찾고 1-hop 그래프 관계를 확장."""
        try:
            query_embedding = self._embed_query(question)
            seed_entities = self._query_entity_vectors(query_embedding, self.settings.hybrid_seed_top_k)
        except Exception as exc:
            logger.error("하이브리드 시드 검색 실패: %s", exc)
            return self._error_result("hybrid", f"하이브리드 벡터 검색 중 오류 발생: {exc}")

        if not seed_entities:
            return {
                "mode": "hybrid",
                "answer": "하이브리드 검색을 위한 관련 엔티티를 찾지 못했습니다.",
                "sources": [],
                "vector_hits": [],
                "graph_data": [],
            }

        seed_ids = [hit["id"] for hit in seed_entities if hit.get("id")]
        graph_rows = self._expand_graph(seed_ids)
        context = self._build_hybrid_context(seed_entities, graph_rows)
        answer = self._generate_answer(question, context)
        return {
            "mode": "hybrid",
            "answer": answer,
            "sources": self._collect_sources(seed_entities),
            "vector_hits": seed_entities,
            "graph_data": graph_rows,
        }

    def cypher_direct(self, cypher_query: str) -> dict[str, Any]:
        """사용자 Cypher 쿼리를 읽기 전용 검증 후 직접 실행."""
        safe_query, error = self._validate_readonly_cypher(cypher_query)
        if error:
            logger.warning("Cypher Direct 검증 실패: %s", error)
            return {"mode": "cypher", "answer": error, "cypher": cypher_query, "sources": []}
        try:
            rows = self.graph.query(safe_query)
            return {
                "mode": "cypher",
                "answer": rows,
                "cypher": safe_query,
                "row_count": len(rows),
                "sources": ["Neo4j"],
            }
        except Exception as exc:
            logger.error("Cypher Direct 실행 실패: %s", exc)
            return {
                "mode": "cypher",
                "answer": f"Cypher 실행 오류: {exc}",
                "cypher": safe_query,
                "sources": [],
            }

    def _build_graph_chain(self) -> GraphCypherQAChain:
        """GraphCypherQAChain 생성 (Cypher 생성 프롬프트 + 답변 프롬프트 포함)."""
        labels = ", ".join(self.settings.entity_labels)
        relationships = ", ".join(self.settings.relationship_types)
        cypher_prompt = PromptTemplate.from_template(
            f"""Task: Generate one read-only Neo4j Cypher query for the user question.

Schema:
{{schema}}

Rules:
- Use stored English node labels only: {labels}.
- Use relationship types only when they exist in the schema, such as: {relationships}.
- Use `id`, `text`, and `description` properties. Do not use a `name` property.
- For "entities connected to X" questions, require BOTH endpoints to carry an entity label and exclude the MENTIONS relationship, so source Document/Chunk nodes (hashed ids) are not returned.
- For broad/global questions, use Cypher aggregation such as count, collect, ORDER BY, LIMIT.
- Korean count expressions such as "몇 개", "개수", "수는" must use count().
- Neo4j Community Edition has no GDS plugin, so never use gds.* procedures.
- Never generate CREATE, MERGE, SET, DELETE, DETACH DELETE, DROP, LOAD CSV, or APOC writes.
- Return at most {self.settings.cypher_top_k} rows unless the question explicitly asks for a count.
- Return only the Cypher query, no prose.

Examples:
Question: Concept 노드는 몇 개인가?
Cypher:
MATCH (n:Concept)
RETURN count(n) AS concept_count

Question: Technology 라벨의 주요 엔티티 10개를 보여줘
Cypher:
MATCH (n:Technology)
RETURN n.id AS id, n.text AS text, n.description AS description
LIMIT 10

Question: LangChain과 연결된 엔티티를 보여줘
Cypher:
MATCH (n)-[r]-(m)
WHERE any(label IN labels(n) WHERE label IN [{", ".join(f"'{label}'" for label in self.settings.entity_labels)}])
  AND any(label IN labels(m) WHERE label IN [{", ".join(f"'{label}'" for label in self.settings.entity_labels)}])
  AND type(r) <> 'MENTIONS'
  AND toLower(n.id) CONTAINS 'langchain'
RETURN n.id AS source, type(r) AS relation, m.id AS target
LIMIT {self.settings.cypher_top_k}

Question:
{{question}}"""
        )
        qa_prompt = PromptTemplate.from_template(
            """User question: {question}

Cypher query result:
{context}

Answer in Korean using only the query result. If the result is empty, say that no matching graph data was found."""
        )
        self.graph.refresh_schema()
        # GraphCypherQAChain은 임의 Cypher 실행 가능성이 있어 최신 LangChain에서 명시적 opt-in이 필요함.
        return GraphCypherQAChain.from_llm(
            llm=self.llm,
            graph=self.graph,
            cypher_prompt=cypher_prompt,
            qa_prompt=qa_prompt,
            validate_cypher=True,
            top_k=self.settings.cypher_top_k,
            return_intermediate_steps=True,
            allow_dangerous_requests=True,
        )

    def _embed_query(self, question: str) -> list[float]:
        """질문을 qwen3-embedding 벡터로 변환하고 차원 확인."""
        embedding = self.embeddings.embed_query(question)
        if len(embedding) != self.settings.embedding_dim:
            raise ValueError(
                f"임베딩 차원 불일치: 실제 {len(embedding)} != 설정 {self.settings.embedding_dim}"
            )
        return embedding

    def _query_entity_vectors(self, embedding: list[float], limit: int) -> list[dict[str, Any]]:
        """`entity_embedding` 벡터 인덱스에서 관련 엔티티 검색."""
        rows = self.graph.query(
            "CALL db.index.vector.queryNodes($index_name, $limit, $embedding) "
            "YIELD node, score "
            "WITH node, score "
            "WHERE any(label IN labels(node) WHERE label IN $entity_labels) "
            "RETURN coalesce(node.id, node.text) AS id, "
            "       coalesce(node.text, node.id, '') AS text, "
            "       coalesce(node.description, '') AS description, "
            "       [label IN labels(node) WHERE label IN $entity_labels] AS labels, "
            "       score "
            "ORDER BY score DESC",
            params={
                "index_name": self.settings.entity_index_name,
                "limit": limit,
                "embedding": embedding,
                "entity_labels": list(self.settings.entity_labels),
            },
        )
        return [{**row, "kind": "entity", "source": f"entity:{row.get('id', '')}"} for row in rows]

    def _query_doc_vectors(self, embedding: list[float], limit: int) -> list[dict[str, Any]]:
        """`doc_embedding` 벡터 인덱스에서 원문 청크와 코드 청크 검색."""
        rows = self.graph.query(
            "CALL db.index.vector.queryNodes($index_name, $limit, $embedding) "
            "YIELD node, score "
            "RETURN node.id AS id, "
            "       coalesce(node.text, '') AS text, "
            "       coalesce(node.source, '') AS source, "
            "       coalesce(node.source_type, '') AS source_type, "
            "       node.chunk_index AS chunk_index, "
            "       score "
            "ORDER BY score DESC",
            params={
                "index_name": self.settings.doc_index_name,
                "limit": limit,
                "embedding": embedding,
            },
        )
        for row in rows:
            row["kind"] = "document"
        return rows

    def _expand_graph(self, seed_ids: list[str]) -> list[dict[str, Any]]:
        """시드 엔티티의 1-hop 이웃 관계 조회."""
        if not seed_ids:
            return []
        try:
            return self.graph.query(
                "MATCH (n)-[r]-(m) "
                "WHERE n.id IN $seed_ids "
                "  AND any(label IN labels(n) WHERE label IN $entity_labels) "
                "  AND any(label IN labels(m) WHERE label IN $entity_labels) "
                "WITH n, r, m, CASE WHEN startNode(r) = n THEN 'out' ELSE 'in' END AS direction "
                "RETURN n.id AS source, "
                "       [label IN labels(n) WHERE label IN $entity_labels] AS source_labels, "
                "       type(r) AS relation, "
                "       direction, "
                "       m.id AS target, "
                "       [label IN labels(m) WHERE label IN $entity_labels] AS target_labels, "
                "       coalesce(m.description, m.text, m.id) AS target_text "
                "LIMIT $limit",
                params={
                    "seed_ids": seed_ids,
                    "entity_labels": list(self.settings.entity_labels),
                    "limit": self.settings.hybrid_graph_limit,
                },
            )
        except Exception as exc:
            logger.warning("1-hop 그래프 확장 실패: %s", exc)
            return []

    def _expand_doc_neighbors(self, doc_hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """벡터로 찾은 문서 청크의 앞뒤 청크를 함께 조회해 문맥을 넓힘."""
        seeds = [
            {
                "source": hit.get("source"),
                "chunk_index": hit.get("chunk_index"),
                "seed_score": hit.get("score", 0),
            }
            for hit in doc_hits
            if hit.get("source") and hit.get("chunk_index") is not None
        ]
        if not seeds:
            return doc_hits
        try:
            rows = self.graph.query(
                "UNWIND $seeds AS seed "
                "MATCH (c:Chunk {source: seed.source}) "
                "WHERE c.chunk_index >= seed.chunk_index - 1 "
                "  AND c.chunk_index <= seed.chunk_index + 1 "
                "RETURN c.id AS id, "
                "       coalesce(c.text, '') AS text, "
                "       coalesce(c.source, '') AS source, "
                "       coalesce(c.source_type, '') AS source_type, "
                "       c.chunk_index AS chunk_index, "
                "       max(seed.seed_score) AS score "
                "ORDER BY source, chunk_index",
                params={"seeds": seeds},
            )
        except Exception as exc:
            logger.warning("인접 청크 확장 실패: %s", exc)
            return doc_hits

        deduped: list[dict[str, Any]] = []
        seen: set[tuple[str, int]] = set()
        for row in rows:
            key = (row.get("source"), row.get("chunk_index"))
            if key in seen:
                continue
            seen.add(key)
            row["kind"] = "document"
            row["expanded"] = True
            deduped.append(row)
        return deduped[: max(len(doc_hits) * 3, self.settings.doc_top_k)]

    def _try_graph_aggregate_fallback(
        self, question: str, generated_cypher: str, graph_context: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        """LLM Cypher가 집계 질문을 놓친 경우 Cypher 집계로 결정적 보정."""
        normalized = question.lower()
        is_count_question = bool(re.search(r"몇\s*개|개수|수는|count|how many", normalized))
        broken_cypher = "???" in generated_cypher or (is_count_question and not graph_context)
        if not is_count_question or not broken_cypher:
            return None

        # := 는 조건 검사와 동시에 변수에 값을 할당함 (질문에 포함된 첫 엔티티 라벨을 찾음)
        matched_label = next(
            (label for label in self.settings.entity_labels if label.lower() in normalized),
            None,
        )
        if matched_label:
            cypher = f"MATCH (n:{matched_label}) RETURN count(n) AS count"
            rows = self.graph.query(cypher)
            count = rows[0]["count"] if rows else 0
            return {
                "mode": "graph_qa",
                "answer": f"{matched_label} 노드는 {count:,}개입니다.",
                "cypher": cypher,
                "graph_data": rows,
                "sources": ["Neo4j KG"],
                "fallback": "cypher_aggregate",
            }

        if "라벨" in question or "label" in normalized or "전체" in question:
            cypher = (
                "MATCH (n) "
                "UNWIND labels(n) AS label "
                "WITH label, count(*) AS count "
                "WHERE label IN $labels "
                "RETURN label, count "
                "ORDER BY count DESC"
            )
            rows = self.graph.query(cypher, params={"labels": list(self.settings.entity_labels)})
            lines = [f"- {row['label']}: {row['count']:,}개" for row in rows]
            return {
                "mode": "graph_qa",
                "answer": "라벨별 엔티티 개수입니다.\n" + "\n".join(lines),
                "cypher": cypher,
                "graph_data": rows,
                "sources": ["Neo4j KG"],
                "fallback": "cypher_aggregate",
            }
        return None

    def _build_vector_context(self, entity_hits: list[dict[str, Any]], doc_hits: list[dict[str, Any]]) -> str:
        """엔티티 결과와 문서 청크 결과를 LLM 컨텍스트 문자열로 변환."""
        parts: list[str] = []
        if entity_hits:
            parts.append("[엔티티 벡터 검색]")
            for hit in entity_hits:
                label_text = ",".join(hit.get("labels") or [])
                description = hit.get("description") or hit.get("text") or ""
                parts.append(
                    f"- {hit.get('id')} ({label_text}, score={hit.get('score', 0):.3f}): "
                    f"{description[:600]}"
                )
        if doc_hits:
            parts.append("[문서/코드 청크 벡터 검색]")
            for hit in doc_hits:
                source = self._format_doc_source(hit)
                parts.append(f"- {source} (score={hit.get('score', 0):.3f})\n{hit.get('text', '')[:900]}")
        return "\n\n".join(parts)

    def _build_hybrid_context(self, seed_entities: list[dict[str, Any]], graph_rows: list[dict[str, Any]]) -> str:
        """벡터 시드 엔티티와 1-hop 관계를 통합 컨텍스트 문자열로 변환."""
        parts: list[str] = ["[벡터 시드 엔티티]"]
        for hit in seed_entities:
            label_text = ",".join(hit.get("labels") or [])
            parts.append(
                f"- {hit.get('id')} ({label_text}, score={hit.get('score', 0):.3f}): "
                f"{(hit.get('description') or hit.get('text') or '')[:500]}"
            )
        if graph_rows:
            parts.append("[1-hop 그래프 관계]")
            for row in graph_rows:
                arrow = "->" if row.get("direction") == "out" else "<-"
                parts.append(
                    f"- {row.get('source')} {arrow}[{row.get('relation')}] {row.get('target')} "
                    f"({row.get('target_text', '')[:300]})"
                )
        else:
            parts.append("[1-hop 그래프 관계]\n- 연결 관계 없음")
        return "\n".join(parts)

    def _generate_answer(self, question: str, context: str) -> str:
        """Groq LPU LLM으로 컨텍스트 기반 한국어 답변 생성."""
        if not context.strip():
            return "관련 컨텍스트를 찾지 못했습니다."
        try:
            # 프롬프트 | LLM 형태의 LangChain 표현식(LCEL). invoke() 한 번으로 포맷팅+호출을 처리함
            chain = RESPONSE_PROMPT | self.llm
            response = chain.invoke({"question": question, "context": context})
            return response.content
        except Exception as exc:
            logger.error("Groq 답변 생성 실패: %s", exc)
            return f"Groq API 답변 생성 실패: {exc}"

    def _validate_readonly_cypher(self, query: str) -> tuple[str, str | None]:
        """Cypher Direct 입력을 읽기 전용 쿼리로 제한 (쓰기/위험 키워드 차단)."""
        stripped = query.strip()
        if not stripped:
            return "", "Cypher 쿼리를 입력하세요."
        stripped = stripped.rstrip(";").strip()
        if ";" in stripped:
            return stripped, "여러 Cypher 문장은 실행할 수 없습니다."

        blocked = (
            "CREATE", "MERGE", "SET", "DELETE", "DETACH", "REMOVE", "DROP", "LOAD",
            "ALTER", "GRANT", "DENY", "REVOKE", "START", "STOP", "CALL APOC", "DBMS",
        )
        upper = stripped.upper()
        for keyword in blocked:
            pattern = r"\b" + re.escape(keyword).replace(r"\ ", r"\s+") + r"\b"
            if re.search(pattern, upper):
                return stripped, f"읽기 전용 쿼리만 허용됩니다. 차단 키워드: {keyword}"

        allowed_starts = ("MATCH", "WITH", "RETURN", "UNWIND", "SHOW", "CALL DB.INDEX.VECTOR.QUERYNODES")
        if not upper.startswith(allowed_starts):
            return stripped, "MATCH/WITH/RETURN/UNWIND/SHOW 또는 벡터 조회 CALL만 허용됩니다."

        # LIMIT 누락 시 과도한 결과를 막기 위해 기본 제한을 자동 부착
        if upper.startswith(("MATCH", "WITH", "UNWIND")) and not re.search(r"\bLIMIT\b", upper):
            stripped = f"{stripped} LIMIT {self.settings.cypher_top_k}"
        return stripped, None

    @staticmethod
    def _extract_intermediate_value(steps: list[dict[str, Any]], key: str) -> Any:
        """GraphCypherQAChain 중간 단계 목록에서 특정 키 값 추출."""
        for step in steps:
            if key in step:
                return step[key]
        return None

    @staticmethod
    def _format_doc_source(hit: dict[str, Any]) -> str:
        """문서 청크 출처 문자열 생성 (`파일#청크 (타입)`)."""
        source = hit.get("source") or "unknown"
        chunk = hit.get("chunk_index")
        source_type = hit.get("source_type") or "unknown"
        if chunk is None:
            return f"{source} ({source_type})"
        return f"{source}#{chunk} ({source_type})"

    def _collect_sources(self, hits: list[dict[str, Any]]) -> list[str]:
        """검색 결과에서 중복 없는 출처 목록 생성."""
        sources: list[str] = []
        for hit in hits:
            if hit.get("kind") == "document":
                source = self._format_doc_source(hit)
            else:
                source = hit.get("source") or hit.get("id") or "unknown"
            if source and source not in sources:
                sources.append(source)
        return sources

    @staticmethod
    def _error_result(mode: str, message: str) -> dict[str, Any]:
        """오류 응답 딕셔너리 생성."""
        return {"mode": mode, "answer": message, "sources": [], "error": True}
