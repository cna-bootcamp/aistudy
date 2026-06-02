"""MS-GraphRAG 검색 CLI 테스트 + 단계별 Tracing

검색이 어디서 멈추는지(Parquet 로드·Ollama 임베딩·GraphRAG API 호출) 단계별 경과 시간과
중간 결과를 콘솔 + 로그 파일에 남겨 디버깅을 돕는 단독 실행 스크립트임.

단계: 환경 로드 → 경로 검증 → 라우팅 → Retriever 초기화 → 검색 실행 → 결과 출력

사용법:
  python search_test.py --query "GraphRAG의 전체 흐름을 설명해줘"
  python search_test.py --query "GraphRAG란?" --mode local
  python search_test.py --query "GraphRAG와 벡터 RAG의 관계" --mode drift
  python search_test.py --query "app.py 구현 예제" --mode code
  python search_test.py --query "GraphRAG란?" --step-timeout 30 --no-llm

옵션:
  --query          검색 질문 (필수)
  --mode           auto | basic | local | global | drift | code  (기본: auto)
  --step-timeout   단계별 최대 대기 시간(초) (기본: 90)
  --no-llm         Parquet 로드·경로 검증·라우팅만 실행, LLM 호출 생략
"""
import argparse
import concurrent.futures
import logging
import sys
import time
from datetime import datetime
from pathlib import Path

# ── 경로·인코딩 설정 ─────────────────────────────────────────────────────────
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

_RETRIEVE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_RETRIEVE_DIR))

# LiteLLM 자체 색상 콘솔 출력(botocore 경고 등)을 ERROR 이상으로 억제
import os
os.environ.setdefault("LITELLM_LOG", "ERROR")

# ── 로거 설정 ────────────────────────────────────────────────────────────────
_LOG_DIR = _RETRIEVE_DIR / "logs"
_LOG_DIR.mkdir(parents=True, exist_ok=True)
_TRACE_FILE = _LOG_DIR / f"search_trace_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

_fmt = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
logging.basicConfig(
    level=logging.DEBUG,
    format=_fmt,
    handlers=[logging.FileHandler(_TRACE_FILE, encoding="utf-8")],
)
_console = logging.StreamHandler(sys.stdout)
_console.setLevel(logging.INFO)
_console.setFormatter(logging.Formatter(_fmt))
logging.getLogger().addHandler(_console)

logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("graphrag").setLevel(logging.DEBUG)
logging.getLogger("openai").setLevel(logging.WARNING)
# LiteLLM은 DEBUG 메시지를 콘솔에서 숨김 (파일 trace에만 기록)
logging.getLogger("LiteLLM").setLevel(logging.WARNING)
logging.getLogger("litellm").setLevel(logging.WARNING)

logger = logging.getLogger("search_test")

SEARCH_MODES = ("auto", "basic", "local", "global", "drift", "code")


# ── 유틸 ─────────────────────────────────────────────────────────────────────

def _sep(char: str = "─", width: int = 70) -> str:
    return char * width


class StepTimer:
    """단계별 elapsed 시간 측정 컨텍스트 매니저."""

    def __init__(self, name: str, timeout: int = 90):
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
            logger.error("✖ STEP 실패: %s  (%.2fs)  %s: %s",
                         self.name, elapsed, exc_type.__name__, exc_val)
        return False


def run_with_timeout(fn, timeout: int, label: str):
    """fn을 ThreadPoolExecutor로 실행하고 timeout 초과 시 TimeoutError 발생."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
        future = ex.submit(fn)
        try:
            return future.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            raise TimeoutError(
                f"[{label}] {timeout}초 초과 — 서비스 상태를 확인하세요."
            )


def dump_result(result) -> None:
    """MS-GraphRAG SearchResult 요약 출력."""
    logger.info(_sep("═"))
    logger.info("【검색 결과 요약】")
    logger.info("  실행 모드    : %s  (요청=%s)", result.mode, result.requested_mode)
    if result.fallback_reason:
        logger.warning("  폴백 사유    : %s", result.fallback_reason)

    ans = result.answer or ""
    logger.info("  답변 길이    : %d자", len(ans))
    if ans.strip():
        logger.info("  답변:\n%s", ans[:600] + ("…" if len(ans) > 600 else ""))
    else:
        logger.warning("  답변 비어 있음 — GraphRAG API 결과 또는 LLM 응답 확인 필요")

    sources = result.sources or []
    logger.info("  출처         : %d건", len(sources))
    for src in sources[:5]:
        logger.info("    [%s] %s", src.source_type, src.title[:80] or "(제목 없음)")

    route = result.route
    logger.info("  라우팅       : mode=%s  confidence=%.2f  llm_fallback=%s",
                route.mode, route.confidence, route.used_llm_fallback)
    logger.info("  라우팅 이유  : %s", route.reason)
    logger.info(_sep("═"))


# ── 단계별 검색 실행 ──────────────────────────────────────────────────────────

def run_search(args: argparse.Namespace) -> int:
    step_to = args.step_timeout
    query = args.query
    mode_arg = args.mode

    logger.info(_sep("═"))
    logger.info("MS-GraphRAG CLI 검색 테스트")
    logger.info("  query  : %s", query)
    logger.info("  mode   : %s", mode_arg)
    logger.info("  no-llm : %s", args.no_llm)
    logger.info("  trace  : %s", _TRACE_FILE)
    logger.info(_sep("═"))

    # ── STEP 1: 환경 변수 로드 ────────────────────────────────────────────────
    from config import (
        load_environment, validate_paths, settings,
        PARQUET_DIR, GRAPHRAG_VECTOR_DIR, CODE_VECTOR_DIR,
    )
    with StepTimer("환경 변수 로드 (.env + settings.yaml)", step_to):
        load_environment()
        logger.info("  LLM 모델     : %s", settings.llm_model)
        logger.info("  Embedding    : %s  (url=%s)",
                    settings.embedding_model, settings.ollama_base_url)
        logger.info("  PARQUET_DIR  : %s", PARQUET_DIR)
        logger.info("  VECTOR_DIR   : %s", GRAPHRAG_VECTOR_DIR)
        logger.info("  CODE_DIR     : %s", CODE_VECTOR_DIR)

    # ── STEP 2: 경로·Parquet 검증 ─────────────────────────────────────────────
    # CODE_VECTOR_DIR는 code 모드 전용 선택 경로 — non-code 모드에서 없어도 진행함
    with StepTimer("경로·Parquet 파일 검증", step_to):
        missing = validate_paths()
        code_missing = [m for m in missing if "code" in m.lower()]
        graph_missing = [m for m in missing if "code" not in m.lower()]

        if graph_missing:
            for m in graph_missing:
                logger.error("  ❌ 없음 (필수): %s", m)
            logger.error("GraphRAG 필수 파일 누락 %d건 — 인덱싱이 완료되었는지 확인하세요.",
                         len(graph_missing))
            return 1

        if code_missing:
            for m in code_missing:
                logger.warning("  ⚠ 없음 (code 모드 전용): %s", m)
            if mode_arg == "code" or (mode_arg == "auto"):
                logger.warning("  code 모드 선택 시 위 경로가 필요합니다."
                               " code 인덱싱이 완료되었는지 확인하세요.")
        # Parquet 파일별 row 수 출력 — pyarrow metadata로 실제 데이터 로드 없이 빠르게 확인
        import pyarrow.parquet as pq
        parquet_names = ["entities", "relationships", "communities",
                         "community_reports", "text_units"]
        for name in parquet_names:
            path = PARQUET_DIR / f"{name}.parquet"
            if path.exists():
                rows = pq.read_metadata(path).num_rows
                logger.info("  %-22s  %s", f"{name}.parquet", f"{rows:,}행")
            else:
                logger.warning("  %-22s  ❌ 없음", f"{name}.parquet")

        # LanceDB 코드 벡터 테이블 확인
        import lancedb
        if CODE_VECTOR_DIR.exists():
            db = lancedb.connect(str(CODE_VECTOR_DIR))
            tables = db.table_names()
            logger.info("  code LanceDB 테이블: %s", tables)
        else:
            logger.warning("  code LanceDB 디렉터리 없음: %s", CODE_VECTOR_DIR)

        # GraphRAG 벡터 인덱스 확인
        if GRAPHRAG_VECTOR_DIR.exists():
            vec_files = list(GRAPHRAG_VECTOR_DIR.iterdir())
            logger.info("  graphrag 벡터 파일: %d개", len(vec_files))
        else:
            logger.warning("  graphrag 벡터 디렉터리 없음")

    # ── STEP 3: 라우팅 ────────────────────────────────────────────────────────
    from router import QueryRouter
    with StepTimer(f"쿼리 라우팅 (mode={mode_arg})", step_to):
        router = QueryRouter(min_confidence=settings.router_min_confidence)
        decision = run_with_timeout(
            lambda: router.route(query, mode_arg),
            step_to, "QueryRouter",
        )
        logger.info("  결정된 모드  : %s  confidence=%.2f  llm_fallback=%s",
                    decision.mode, decision.confidence, decision.used_llm_fallback)
        logger.info("  이유         : %s", decision.reason)

    resolved_mode = decision.mode

    if args.no_llm:
        logger.info(_sep())
        logger.info("--no-llm 지정됨 — Retriever 초기화 및 검색 생략")
        logger.info("경로 검증·라우팅만 완료. 실제 검색은 --no-llm 없이 실행하세요.")
        return 0

    # ── STEP 4: Retriever 초기화 (Parquet 지연 로드 + GraphRAG 설정 파싱) ────
    with StepTimer("Retriever 초기화 (Parquet·GraphRAG config 로드)", step_to):
        if resolved_mode == "code":
            from retriever import CodeVectorRetriever
            retriever = run_with_timeout(
                lambda: CodeVectorRetriever(),
                step_to, "CodeVectorRetriever 초기화",
            )
            logger.info("  CodeVectorRetriever 초기화 완료  top_k=%d", retriever.top_k)
        else:
            # GraphRAGRetriever.__init__() 내부에서도 validate_paths()를 호출함.
            # non-code 모드에서 CODE_VECTOR_DIR 미존재 시 RetrievalError 발생을 막기 위해
            # code 관련 경로만 임시로 제외하는 패치를 적용한 뒤 원복함.
            import config as _cfg
            _orig_validate = _cfg.validate_paths

            def _patched_validate():
                return [m for m in _orig_validate() if "code" not in m.lower()]

            _cfg.validate_paths = _patched_validate
            try:
                from retriever import GraphRAGRetriever
                retriever = run_with_timeout(
                    lambda: GraphRAGRetriever(),
                    step_to, "GraphRAGRetriever 초기화",
                )
            finally:
                _cfg.validate_paths = _orig_validate  # 항상 원복

            logger.info("  GraphRAGRetriever 초기화 완료  community_level=%d",
                        retriever.community_level)

    # ── STEP 5: code 모드 — Ollama 임베딩 사전 확인 ──────────────────────────
    if resolved_mode == "code":
        with StepTimer("Ollama 임베딩 테스트 (code 모드)", step_to):
            emb = run_with_timeout(
                lambda: retriever.embed_query(query),
                step_to, "Ollama embed_query",
            )
            logger.info("  임베딩 차원: %d  (처음 3값: %s)", len(emb), emb[:3])

    # ── STEP 6: 검색 실행 ─────────────────────────────────────────────────────
    # GraphRAG API는 async이므로 내부 run_async()가 새 event loop를 생성해 실행함.
    # local/global/drift 검색은 Parquet 데이터 + LLM 호출로 긴 시간이 걸릴 수 있음.
    search_label = f"GraphRAG 검색 ({resolved_mode})"
    with StepTimer(search_label, step_to * 3):
        result = run_with_timeout(
            lambda: retriever.search(query, decision),
            step_to * 3,
            search_label,
        )

    dump_result(result)

    # 답변이 비어있으면 실패로 처리
    if not result.answer.strip():
        logger.error("답변 비어 있음 — 검색 실패로 판정")
        return 1

    logger.info("검색 완료. 상세 trace: %s", _TRACE_FILE)
    return 0


# ── 진입점 ────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="MS-GraphRAG 검색 CLI 테스트 (단계별 Tracing)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
  python search_test.py --query "GraphRAG의 전체 흐름을 설명해줘"
  python search_test.py --query "GraphRAG란?" --mode local
  python search_test.py --query "GraphRAG와 벡터 RAG의 관계" --mode drift
  python search_test.py --query "커뮤니티 보고서란?" --mode global
  python search_test.py --query "app.py 구현 예제" --mode code
  python search_test.py --query "GraphRAG란?" --no-llm    # 경로·라우팅 확인만
  python search_test.py --query "GraphRAG란?" --step-timeout 30
""",
    )
    p.add_argument("--query", "-q", required=True, help="검색 질문")
    p.add_argument(
        "--mode", "-m",
        choices=list(SEARCH_MODES),
        default="auto",
        help="검색 모드 (기본: auto)",
    )
    p.add_argument(
        "--step-timeout", "-t",
        type=int, default=90, metavar="SEC",
        help="단계별 최대 대기 시간(초) (기본: 90)",
    )
    p.add_argument(
        "--no-llm",
        action="store_true",
        help="LLM 호출 생략, 경로 검증·라우팅만 실행 (빠른 환경 확인용)",
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
