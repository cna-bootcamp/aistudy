"""GraphRAG 검색 CLI 테스트 + 단계별 Tracing

검색이 어디서 멈추는지(Ollama 임베딩·Groq LLM·Neo4j Cypher) 단계별 경과 시간과
중간 결과를 콘솔 + 로그 파일에 남겨 디버깅을 돕는 단독 실행 스크립트임.

각 단계: 설정 로드 → Neo4j 연결 → 임베딩 → 벡터/그래프 검색 → LLM 답변 생성
모든 단계에 단계별 타임아웃 및 elapsed 시간이 표시됨.

사용법:
  python search_test.py --query "RAG란 무엇인가?"
  python search_test.py --query "Openai와 연결된 엔티티" --mode graph_qa
  python search_test.py --query "GraphRAG 처리 흐름" --mode hybrid
  python search_test.py --query "MATCH (n:Concept) RETURN n.id LIMIT 5" --mode cypher
  python search_test.py --query "RAG란?" --mode auto --step-timeout 30

옵션:
  --query          검색할 질문 또는 Cypher 쿼리 (필수)
  --mode           auto | vector | graph_qa | hybrid | cypher  (기본: auto)
  --step-timeout   단계별 최대 대기 시간(초), 초과 시 경고 후 계속 (기본: 60)
  --no-llm         LLM 답변 생성 생략, 검색 결과 원본만 출력 (빠른 연결 확인용)
  --top-k          벡터 검색 최대 결과 수 (기본: 설정값 사용)
"""
import argparse
import concurrent.futures
import json
import logging
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

# ── 경로·인코딩 설정 ─────────────────────────────────────────────────────────
# Windows cp949 콘솔에서 한글·특수문자가 깨지지 않도록 UTF-8로 강제 설정
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

_RETRIEVE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_RETRIEVE_DIR))

# ── Tracing 로거 설정 ────────────────────────────────────────────────────────
_LOG_DIR = _RETRIEVE_DIR / "logs"
_LOG_DIR.mkdir(exist_ok=True)
_TRACE_FILE = _LOG_DIR / f"search_trace_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

# 콘솔: INFO 이상 / 파일: DEBUG 이상 (LangChain·httpx·neo4j 내부 로그도 파일에 기록)
_fmt = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
logging.basicConfig(
    level=logging.DEBUG,
    format=_fmt,
    handlers=[
        logging.FileHandler(_TRACE_FILE, encoding="utf-8"),
    ],
)
# 콘솔 핸들러는 INFO만
_console = logging.StreamHandler(sys.stdout)
_console.setLevel(logging.INFO)
_console.setFormatter(logging.Formatter(_fmt))
logging.getLogger().addHandler(_console)

# 3rd-party 라이브러리 로그 레벨 조정
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("neo4j").setLevel(logging.WARNING)
logging.getLogger("langchain").setLevel(logging.DEBUG)      # 파일에는 상세 기록
logging.getLogger("openai").setLevel(logging.DEBUG)

logger = logging.getLogger("search_test")


# ── Tracing 유틸 ─────────────────────────────────────────────────────────────

def _sep(char: str = "─", width: int = 70) -> str:
    return char * width


class StepTimer:
    """단계별 elapsed 시간 측정 + 로그 출력 컨텍스트 매니저."""

    def __init__(self, name: str, timeout: int = 60):
        self.name = name
        self.timeout = timeout
        self._start: float = 0.0

    def __enter__(self):
        self._start = time.perf_counter()
        logger.info(_sep())
        logger.info("▶ STEP 시작: %s  (최대 %ds)", self.name, self.timeout)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        elapsed = time.perf_counter() - self._start
        if exc_type is None:
            logger.info("✔ STEP 완료: %s  (%.2fs)", self.name, elapsed)
        else:
            logger.error("✖ STEP 실패: %s  (%.2fs)  오류=%s: %s",
                         self.name, elapsed, exc_type.__name__, exc_val)
        return False  # 예외 재발생

    @property
    def elapsed(self) -> float:
        return time.perf_counter() - self._start


def run_with_timeout(fn, timeout: int, label: str):
    """ThreadPoolExecutor로 fn을 실행하고, timeout초 초과 시 TimeoutError 발생."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(fn)
        try:
            return future.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            raise TimeoutError(
                f"[{label}] {timeout}초 초과 — Ollama/Groq/Neo4j 응답 없음. "
                "서비스 상태를 확인하세요."
            )


def dump_result(result: dict[str, Any], no_llm: bool = False) -> None:
    """검색 결과 요약을 콘솔에 출력."""
    logger.info(_sep("═"))
    logger.info("【검색 결과 요약】")
    logger.info("  모드         : %s", result.get("mode"))
    logger.info("  오류 여부    : %s", result.get("error", False))

    answer = result.get("answer", "")
    if isinstance(answer, list):
        logger.info("  답변(행 리스트): %d행", len(answer))
        for i, row in enumerate(answer[:5]):
            logger.info("    [%d] %s", i, row)
        if len(answer) > 5:
            logger.info("    ... (+%d행)", len(answer) - 5)
    else:
        ans_str = str(answer)
        logger.info("  답변 길이    : %d자", len(ans_str))
        if no_llm:
            logger.info("  (--no-llm: 답변 생성 생략)")
        else:
            # 400자까지 출력
            logger.info("  답변:\n%s", ans_str[:600] + ("…" if len(ans_str) > 600 else ""))

    cypher = result.get("cypher")
    if cypher:
        logger.info("  생성된 Cypher:\n    %s", cypher.replace("\n", "\n    "))

    vector_hits = result.get("vector_hits") or []
    logger.info("  vector_hits  : %d건", len(vector_hits))
    for h in vector_hits[:3]:
        logger.info("    score=%.4f  id=%s  kind=%s",
                    float(h.get("score", 0)), h.get("id", ""), h.get("kind", ""))

    graph_data = result.get("graph_data") or []
    logger.info("  graph_data   : %d행", len(graph_data))
    for row in graph_data[:3]:
        logger.info("    %s", json.dumps(row, ensure_ascii=False))

    sources = result.get("sources") or []
    logger.info("  출처         : %s", sources[:5])

    fallback = result.get("fallback")
    if fallback:
        logger.info("  폴백 사용    : %s", fallback)

    routing = result.get("routing_reason")
    if routing:
        logger.info("  라우팅 근거  : %s", routing)

    logger.info(_sep("═"))


# ── 단계별 검색 실행 ─────────────────────────────────────────────────────────

def run_search(args: argparse.Namespace) -> int:
    """설정 → 연결 → 라우팅 → 검색 → LLM 답변을 단계별로 실행하고 trace 로그를 남김."""
    step_to = args.step_timeout
    query = args.query
    mode_arg = args.mode

    logger.info(_sep("═"))
    logger.info("GraphRAG CLI 검색 테스트")
    logger.info("  query  : %s", query)
    logger.info("  mode   : %s", mode_arg)
    logger.info("  no-llm : %s", args.no_llm)
    logger.info("  trace  : %s", _TRACE_FILE)
    logger.info(_sep("═"))

    # ── STEP 1: 설정 로드 ───────────────────────────────────────────────────
    from config.settings import Settings
    with StepTimer("설정 로드", step_to):
        settings = Settings()
        if args.top_k:
            settings.entity_top_k = args.top_k
            settings.doc_top_k = args.top_k
            settings.hybrid_seed_top_k = args.top_k
        logger.info("  Neo4j    : %s", settings.neo4j_uri)
        logger.info("  LLM      : %s  (base=%s)", settings.groq_model, settings.groq_base_url)
        logger.info("  Embedding: %s  (dim=%d, url=%s)",
                    settings.embedding_model, settings.embedding_dim, settings.ollama_base_url)
        logger.info("  GROQ_KEY : %s", "설정됨" if settings.groq_api_key else "❌ 미설정")

    # ── STEP 2: Neo4j 연결 ──────────────────────────────────────────────────
    from graph.neo4j_connection import Neo4jConnection
    with StepTimer("Neo4j 연결", step_to):
        connection = run_with_timeout(
            lambda: Neo4jConnection(settings), step_to, "Neo4j 연결"
        )
        stats = connection.get_stats()
        logger.info("  노드=%d  엔티티=%d  Chunk=%d  관계=%d",
                    stats["node_count"], stats["entity_count"],
                    stats["chunk_count"], stats["relationship_count"])
        dim_warnings = connection.validate_vector_dimensions()
        if dim_warnings:
            for w in dim_warnings:
                logger.warning("  벡터 차원 경고: %s", w)
        else:
            logger.info("  벡터 차원 : entity_embedding & doc_embedding 모두 4096 정상")

    # ── STEP 3: Auto 라우팅 ─────────────────────────────────────────────────
    from query.router import QueryRouter
    with StepTimer(f"쿼리 라우팅 (mode={mode_arg})", step_to):
        router = QueryRouter(settings)
        decision = run_with_timeout(
            lambda: router.route(query, mode_arg.capitalize() if mode_arg != "auto" else "Auto"),
            step_to,
            "라우터 LLM",
        )
        resolved_mode = decision.mode
        logger.info("  결정된 모드: %s  이유: %s  점수: %s",
                    resolved_mode, decision.reason, decision.scores)

    # ── STEP 4: 검색 엔진 초기화 ─────────────────────────────────────────────
    from query.query_engine import QueryEngine
    with StepTimer("검색 엔진 초기화 (LLM·Embedding·GraphChain)", step_to):
        # GraphCypherQAChain._build_graph_chain()이 graph.refresh_schema()를 내부에서 호출하므로
        # 이 단계에서 Neo4j schema 쿼리가 한 번 실행됨
        engine = run_with_timeout(
            lambda: QueryEngine(settings, connection.graph), step_to, "엔진 초기화"
        )
        logger.info("  LLM·Embedding·GraphChain 초기화 완료")

    # ── STEP 5: 임베딩 테스트 (vector·hybrid 모드에서만) ───────────────────
    if resolved_mode in ("vector", "hybrid"):
        with StepTimer("Ollama 임베딩 테스트 (qwen3-embedding)", step_to):
            embedding = run_with_timeout(
                lambda: engine.embeddings.embed_query(query), step_to, "Ollama embed_query"
            )
            logger.info("  임베딩 차원: %d  (처음 3값: %s)",
                        len(embedding), embedding[:3])

    # ── STEP 6: 검색 실행 ───────────────────────────────────────────────────
    if args.no_llm and resolved_mode in ("vector", "hybrid"):
        # --no-llm: 벡터 검색 + 컨텍스트 수집만, LLM 답변 생략
        with StepTimer(f"벡터 검색 전용 ({resolved_mode}, LLM 생략)", step_to):
            if resolved_mode == "vector":
                emb = run_with_timeout(
                    lambda: engine._embed_query(query), step_to, "embed"
                )
                entity_hits = run_with_timeout(
                    lambda: engine._query_entity_vectors(emb, settings.entity_top_k),
                    step_to, "entity vector",
                )
                doc_hits = run_with_timeout(
                    lambda: engine._query_doc_vectors(emb, settings.doc_top_k),
                    step_to, "doc vector",
                )
                result = {
                    "mode": "vector (no-llm)",
                    "answer": "(LLM 답변 생략)",
                    "vector_hits": entity_hits + doc_hits,
                    "sources": [h.get("source", h.get("id", "")) for h in entity_hits],
                }
                logger.info("  엔티티 히트: %d건  문서 히트: %d건", len(entity_hits), len(doc_hits))
            else:  # hybrid
                emb = run_with_timeout(
                    lambda: engine._embed_query(query), step_to, "embed"
                )
                seed_entities = run_with_timeout(
                    lambda: engine._query_entity_vectors(emb, settings.hybrid_seed_top_k),
                    step_to, "entity seed",
                )
                seed_ids = [h.get("id") for h in seed_entities if h.get("id")]
                graph_rows = run_with_timeout(
                    lambda: engine._expand_graph(seed_ids), step_to, "graph expand"
                )
                result = {
                    "mode": "hybrid (no-llm)",
                    "answer": "(LLM 답변 생략)",
                    "vector_hits": seed_entities,
                    "graph_data": graph_rows,
                    "sources": [],
                }
                logger.info("  시드 엔티티: %d건  그래프 행: %d행",
                            len(seed_entities), len(graph_rows))
    elif resolved_mode == "cypher":
        with StepTimer("Cypher Direct 실행", step_to):
            result = run_with_timeout(
                lambda: engine.cypher_direct(query), step_to, "cypher_direct"
            )
    else:
        # vector / graph_qa / hybrid — 전체 파이프라인 (LLM 답변 포함)
        with StepTimer(f"전체 검색 + LLM 답변 ({resolved_mode})", step_to * 2):
            result = run_with_timeout(
                lambda: engine.search(query, resolved_mode), step_to * 2, "engine.search"
            )

    # 라우팅 정보 병합
    result["routing_reason"] = decision.reason
    result["routing_scores"] = decision.scores

    # ── 결과 출력 ─────────────────────────────────────────────────────────
    dump_result(result, no_llm=args.no_llm)

    if result.get("error"):
        logger.error("검색 실패 — 위 결과를 확인하세요.")
        return 1

    logger.info("검색 완료. 상세 trace: %s", _TRACE_FILE)
    return 0


# ── 진입점 ────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    """CLI 인자 파싱."""
    p = argparse.ArgumentParser(
        description="GraphRAG 검색 CLI 테스트 (단계별 Tracing)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
  python search_test.py --query "RAG란 무엇인가?"
  python search_test.py --query "Openai와 연결된 엔티티를 보여줘" --mode graph_qa
  python search_test.py --query "GraphRAG 처리 흐름" --mode hybrid
  python search_test.py --query "MATCH (n:Concept) RETURN n.id LIMIT 5" --mode cypher
  python search_test.py --query "RAG란?" --no-llm          # 임베딩·벡터 검색만 (LLM 생략)
  python search_test.py --query "RAG란?" --step-timeout 30  # 각 단계 30초 제한
""",
    )
    p.add_argument("--query", "-q", required=True, help="검색 질문 또는 Cypher 쿼리")
    p.add_argument(
        "--mode", "-m",
        choices=["auto", "vector", "graph_qa", "hybrid", "cypher"],
        default="auto",
        help="검색 모드 (기본: auto)",
    )
    p.add_argument(
        "--step-timeout", "-t",
        type=int, default=60, metavar="SEC",
        help="단계별 최대 대기 시간(초) — 초과 시 TimeoutError (기본: 60)",
    )
    p.add_argument(
        "--no-llm",
        action="store_true",
        help="LLM 답변 생성 생략, 벡터/그래프 검색 결과만 출력 (빠른 연결 확인용)",
    )
    p.add_argument(
        "--top-k", "-k",
        type=int, default=None, metavar="N",
        help="벡터 검색 Top K 오버라이드 (기본: settings 값 사용)",
    )
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    try:
        sys.exit(run_search(args))
    except TimeoutError as e:
        logger.error("⏱ TIMEOUT: %s", e)
        logger.error("상세 trace: %s", _TRACE_FILE)
        sys.exit(2)
    except KeyboardInterrupt:
        logger.warning("사용자 중단 (Ctrl+C)")
        sys.exit(130)
    except Exception as e:
        logger.exception("예상치 못한 오류: %s", e)
        logger.error("상세 trace: %s", _TRACE_FILE)
        sys.exit(1)
