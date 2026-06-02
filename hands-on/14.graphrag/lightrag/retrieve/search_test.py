"""LightRAG 검색 CLI 테스트 + 단계별 Tracing

검색이 어디서 멈추는지(LightRAG 초기화·Ollama 임베딩·Groq LLM) 단계별 경과 시간과
중간 결과를 콘솔 + 로그 파일에 남겨 디버깅을 돕는 단독 실행 스크립트임.

단계: 설정 로드 → store 파일 검증 → 라우팅 → LightRAG 초기화 → 검색 실행 → 결과 출력

사용법:
  python search_test.py --query "RAG란 무엇인가?"
  python search_test.py --query "LangChain 구현 예제" --mode code
  python search_test.py --query "GraphRAG 전체 흐름" --mode global
  python search_test.py --query "RAG란?" --step-timeout 30

옵션:
  --query          검색 질문 (필수)
  --mode           auto | naive | local | global | hybrid | mix | code  (기본: auto)
  --step-timeout   단계별 최대 대기 시간(초) (기본: 90)
  --no-llm         LightRAG 초기화 후 LLM 없이 store 파일만 확인 (빠른 연결 확인용)
"""
import argparse
import asyncio
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

# 프로세스 종료 시 LightRAG 워커 태스크 GC 정리 과정의 asyncio 노이즈 억제
# (검색 결과는 정상 반환되며 exit code 0 — 아래는 종료 시점 경고만 해당)
_ASYNCIO_EXIT_MSGS = ("no running event loop", "Event loop is closed")


def _suppress_asyncio_cleanup(unraisable) -> None:
    if isinstance(unraisable.exc_value, RuntimeError) and any(
        m in str(unraisable.exc_value) for m in _ASYNCIO_EXIT_MSGS
    ):
        return
    sys.__unraisablehook__(unraisable)


sys.unraisablehook = _suppress_asyncio_cleanup

_RETRIEVE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_RETRIEVE_DIR))

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
logging.getLogger("lightrag").setLevel(logging.DEBUG)
logging.getLogger("openai").setLevel(logging.WARNING)
logging.getLogger("asyncio").setLevel(logging.CRITICAL)  # 종료 시 "Task was destroyed" 노이즈 억제

logger = logging.getLogger("search_test")

ALL_MODES = ("auto", "naive", "local", "global", "hybrid", "mix", "code")


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


def _cancel_loop_tasks() -> None:
    """현재 스레드의 이벤트 루프에 남은 LightRAG 워커 태스크를 정리.

    query_llm() 직후, 같은 스레드에서 호출해야 루프가 아직 살아있음.
    루프가 GC되기 전에 태스크를 취소하면 'ERROR: Embedding func: Critical error'
    메시지 없이 깨끗하게 종료됨.
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        return
    if loop.is_closed() or loop.is_running():
        return
    # Python 3.13: asyncio.all_tasks(loop=loop)이 loop 인수 직접 지원
    try:
        pending = asyncio.all_tasks(loop=loop)
    except Exception:
        return
    if not pending:
        return
    for task in pending:
        task.cancel()
    try:
        loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
    except Exception:
        pass


def dump_result(result) -> None:
    """LightRAG SearchResult 요약 출력."""
    logger.info(_sep("═"))
    logger.info("【검색 결과 요약】")
    logger.info("  모드         : %s", result.mode)
    logger.info("  오류         : %s", result.error or "없음")
    logger.info("  소요 시간    : %.2fs", result.elapsed_seconds)

    ans = result.answer or ""
    logger.info("  답변 길이    : %d자", len(ans))
    if ans.strip():
        logger.info("  답변:\n%s", ans[:600] + ("…" if len(ans) > 600 else ""))
    else:
        logger.warning("  답변 비어 있음 — LightRAG context 수집 또는 LLM 응답 확인 필요")

    sources = result.sources or []
    logger.info("  출처         : %d건", len(sources))
    for src in sources[:5]:
        logger.info("    [%s] %s  %s",
                    src.source_type, src.file_path or "", src.label or src.chunk_id or "")

    raw = result.raw or {}
    if raw:
        data = raw.get("data") or {}
        logger.info("  raw.data 키  : %s", list(data.keys()))
        for key in ("entities", "relationships", "chunks"):
            items = data.get(key) or []
            logger.info("  raw.%s: %d건", key, len(items))

    decision = result.decision
    logger.info("  라우팅 모드  : %s  confidence=%.2f  [%s]  (%s)",
                decision.mode, decision.confidence, decision.strategy, decision.reason)
    logger.info(_sep("═"))


# ── 단계별 검색 실행 ──────────────────────────────────────────────────────────

def run_search(args: argparse.Namespace) -> int:
    step_to = args.step_timeout
    query = args.query
    mode_arg = args.mode

    logger.info(_sep("═"))
    logger.info("LightRAG CLI 검색 테스트")
    logger.info("  query  : %s", query)
    logger.info("  mode   : %s", mode_arg)
    logger.info("  no-llm : %s", args.no_llm)
    logger.info("  trace  : %s", _TRACE_FILE)
    logger.info(_sep("═"))

    # ── STEP 1: 설정 로드 ────────────────────────────────────────────────────
    from config.settings import Settings
    with StepTimer("설정 로드", step_to):
        settings = Settings()
        logger.info("  Embedding  : %s  (dim=%d, url=%s)",
                    settings.embedding_model, settings.embedding_dim, settings.ollama_base_url)
        logger.info("  LLM        : %s", settings.groq_model)
        logger.info("  GROQ_KEY   : %s", "설정됨" if settings.groq_api_key else "❌ 미설정")
        logger.info("  kg_dir     : %s", settings.kg_dir)
        logger.info("  code_vdb   : %s", settings.code_vdb_file)

    # ── STEP 2: Store 파일 검증 ───────────────────────────────────────────────
    with StepTimer("Store 파일 검증", step_to):
        kg_required = [
            settings.kg_dir / "graph_chunk_entity_relation.graphml",
            settings.kg_dir / "vdb_chunks.json",
            settings.kg_dir / "kv_store_text_chunks.json",
        ]
        for path in kg_required:
            size = path.stat().st_size if path.exists() else -1
            status = f"{size:,}B" if size >= 0 else "❌ 없음"
            logger.info("  %s  → %s", path.name, status)

        if mode_arg == "code" or mode_arg == "auto":
            code_ok = settings.code_vdb_file.exists()
            logger.info("  vdb_code.json  → %s",
                        f"{settings.code_vdb_file.stat().st_size:,}B" if code_ok else "❌ 없음")

    # ── STEP 3: 라우팅 ────────────────────────────────────────────────────────
    from query_router import QueryRouter
    from llm_client import GroqChatClient
    with StepTimer(f"쿼리 라우팅 (mode={mode_arg})", step_to):
        llm_client = GroqChatClient(settings)
        router = QueryRouter(settings, llm_client)
        decision = run_with_timeout(
            lambda: router.route(query, mode_arg),
            step_to, "QueryRouter",
        )
        logger.info("  결정된 모드: %s  confidence=%.2f  strategy=%s",
                    decision.mode, decision.confidence, decision.strategy)
        logger.info("  이유       : %s", decision.reason)

    resolved_mode = decision.mode

    if args.no_llm:
        # --no-llm: 연결·파일 확인만
        logger.info(_sep())
        logger.info("--no-llm 지정됨 — LightRAG 초기화 및 검색 생략")
        logger.info("Store 파일과 라우팅 결과만 확인 완료.")
        return 0

    # ── STEP 4: LightRAG 인스턴스 초기화 ─────────────────────────────────────
    # initialize_storages()가 내부적으로 graphml·json 파일을 파싱하므로 데이터가
    # 클수록 오래 걸림 (수십 초). 여기서 멈추는 것처럼 보일 수 있음.
    from lightrag_retriever import LightRAGRetriever
    with StepTimer("LightRAG 초기화 (graphml + vdb 파싱)", step_to * 2):
        retriever = run_with_timeout(
            lambda: _init_lightrag(settings),
            step_to * 2,
            "LightRAG initialize_storages",
        )
        logger.info("  LightRAG 인스턴스 초기화 완료")

    # ── STEP 5: code 모드 — Ollama 임베딩 테스트 ─────────────────────────────
    if resolved_mode == "code":
        from embeddings import create_embedding_func
        with StepTimer("Ollama 임베딩 테스트 (code 모드)", step_to):
            embed_fn = create_embedding_func(settings)
            result = run_with_timeout(
                lambda: embed_fn([query]),
                step_to, "Ollama embed",
            )
            dim = len(result[0]) if result else 0
            logger.info("  임베딩 차원: %d", dim)

    # ── STEP 6: 검색 실행 ─────────────────────────────────────────────────────
    from search_service import SearchService
    with StepTimer(f"전체 검색 + LLM 답변 ({resolved_mode})", step_to * 3):
        service = SearchService(settings)

        def _do_search():
            r = service.search(query, selected_mode=mode_arg)
            _cancel_loop_tasks()  # 워커 스레드 안에서 루프 태스크 정리
            return r

        result = run_with_timeout(_do_search, step_to * 3, "SearchService.search")

    dump_result(result)

    if result.error:
        logger.error("검색 실패 — 위 오류 내용을 확인하세요.")
        return 1

    logger.info("검색 완료. 상세 trace: %s", _TRACE_FILE)
    return 0


def _init_lightrag(settings):
    """LightRAGRetriever를 생성하고 내부적으로 _get_rag()를 호출해 스토리지를 초기화함."""
    from lightrag_retriever import LightRAGRetriever
    r = LightRAGRetriever(settings)
    r._get_rag()   # 명시적으로 초기화를 트리거해 elapsed 시간을 측정함
    return r


# ── 진입점 ────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="LightRAG 검색 CLI 테스트 (단계별 Tracing)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
  python search_test.py --query "RAG란 무엇인가?"
  python search_test.py --query "LangChain 구현 예제" --mode code
  python search_test.py --query "GraphRAG 전체 흐름 요약" --mode global
  python search_test.py --query "멀티턴 대화와 싱글턴의 차이" --mode local
  python search_test.py --query "RAG란?" --no-llm        # store 파일 확인만
  python search_test.py --query "RAG란?" --step-timeout 30
""",
    )
    p.add_argument("--query", "-q", required=True, help="검색 질문")
    p.add_argument(
        "--mode", "-m",
        choices=list(ALL_MODES),
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
        help="LightRAG 초기화 전까지만 실행 (Store 파일·라우팅만 확인)",
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
