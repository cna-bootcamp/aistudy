"""LightRAG GraphRAG 인덱싱 엔트리포인트

이중 인덱싱 파이프라인:
  [Phase 1] 교재(.md) → LightRAG insert() → store/kg/ (GraphML KG + 교재 벡터 + KV Store)
  [Phase 2] 예제코드(.py) → qwen3-embedding → store/vector/code/ (nano-vectordb, KG 미생성)

사용법:
  python index_documents.py              # 전체 인덱싱
  python index_documents.py --force      # 인덱스 초기화 후 재인덱싱
  python index_documents.py --mode test  # 테스트용 소량 인덱싱 (교재 1 + 예제코드 2)
"""
import argparse
import asyncio
import logging
import shutil
import sys
from pathlib import Path

# Windows 콘솔 기본 인코딩(cp949)에서 한글·기호(— 등) 출력이 깨지지 않도록 표준 출력을 UTF-8로 재설정함
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# 이 파일이 위치한 indexing/ 디렉터리를 모듈 검색 경로 맨 앞에 추가함 (config 등 패키지 import용)
sys.path.insert(0, str(Path(__file__).resolve().parent))

from code_vector_index import CodeVectorIndexer
from config.settings import Settings
from document_loader import DocumentLoader
from kg_builder import KGBuilder
from llm_func import check_groq_key, check_ollama, create_embed_callable

# 로깅: 콘솔 + 파일(logs/indexing.log) 동시 출력. INFO/WARNING/ERROR 레벨 구분
_LOG_DIR = Path(__file__).resolve().parent / "logs"
_LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(_LOG_DIR / "indexing.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
# httpx·nano-vectordb의 잦은 로그는 WARNING 이상만 표시 (진행 상황을 보기 쉽게)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("nano-vectordb").setLevel(logging.WARNING)
logger = logging.getLogger("index")


def parse_args() -> argparse.Namespace:
    """명령줄 인자 파싱 (--force / --mode)."""
    parser = argparse.ArgumentParser(description="LightRAG GraphRAG 인덱싱 (교재 KG + 예제코드 벡터)")
    parser.add_argument(
        "--force", action="store_true",
        help="기존 인덱스(store/kg, store/vector/code)를 삭제한 뒤 재인덱싱",
    )
    parser.add_argument(
        "--mode", choices=["full", "test"], default="full",
        help="full=전체 인덱싱, test=소량 테스트(교재 1 + 예제코드 2)",
    )
    return parser.parse_args()


def log_resolved_paths(settings: Settings) -> None:
    """LLM·임베딩 호출 전에 도출된 경로를 먼저 출력해 경로 오류를 조기 발견함."""
    logger.info("-" * 60)
    logger.info("[경로 확인] 워크스페이스 루트 : %s", settings.workspace_root)
    tb = settings.textbook_dir
    # 교재 .md 개수를 미리 세어 0개면 경로 오류임을 즉시 인지
    tb_count = len(list(tb.rglob("*.md"))) if tb.exists() else 0
    logger.info("[경로 확인] 교재 디렉터리     : %s (존재=%s, .md %d개)", tb, tb.exists(), tb_count)
    logger.info("[경로 확인] 예제코드 디렉터리 : %s (존재=%s)", settings.examples_dir, settings.examples_dir.exists())
    logger.info("[경로 확인] KG 저장소         : %s", settings.kg_dir)
    logger.info("[경로 확인] 코드 벡터 저장소  : %s", settings.code_vector_dir)
    logger.info("[경로 확인] 공용 .env         : %s (존재=%s)", settings.hands_on_env, settings.hands_on_env.exists())
    if tb_count == 0:
        logger.warning("교재 .md가 0개입니다 — 경로 또는 파일 존재 여부를 먼저 확인하세요.")


def reset_stores(settings: Settings) -> None:
    """--force: 기존 KG·코드 벡터 저장소를 삭제하여 깨끗한 상태에서 재인덱싱."""
    for path in (settings.kg_dir, settings.code_vector_dir):
        if path.exists():
            shutil.rmtree(path)
            logger.info("저장소 삭제: %s", path)


def smoke_test_embedding(settings: Settings) -> None:
    """임베딩이 실제 설정 차원(4096)을 반환하는지 1건으로 사전 검증 (대량 실행 전 안전장치)."""
    embed = create_embed_callable(settings)
    # asyncio.run(): 동기 컨텍스트에서 비동기 임베딩 1회 실행
    vecs = asyncio.run(embed(["임베딩 차원 확인용 테스트 문장"]))
    dim = vecs.shape[1] if hasattr(vecs, "shape") else len(vecs[0])
    if dim != settings.embedding_dim:
        raise RuntimeError(f"임베딩 차원 불일치: 기대 {settings.embedding_dim}, 실제 {dim}")
    logger.info("임베딩 스모크 테스트 통과: %d차원", dim)


def load_documents(settings: Settings, loader: DocumentLoader, mode: str):
    """모드에 따라 (kg_docs, code_docs) 반환."""
    if mode == "test":
        logger.info("문서 로드 (테스트 모드: 교재 1 + 예제코드 2)")
        return loader.load_specific_files()
    logger.info("문서 로드 (전체 모드)")
    return loader.load_for_kg(), loader.load_for_vector()


def main() -> None:
    """문서 로드 → 교재 KG 구축 → 예제코드 벡터 인덱스 구축 → 통계 출력."""
    args = parse_args()
    logger.info("=" * 60)
    logger.info("LightRAG GraphRAG 인덱싱 시작 (mode=%s, force=%s)", args.mode, args.force)
    logger.info("=" * 60)

    # 1. 설정 로드 + 경로 검증 (LLM/임베딩 호출 전 경로부터 확인)
    settings = Settings()
    log_resolved_paths(settings)

    # 2. 사전 점검: 환경 미비 시 인덱싱 전에 명확히 중단
    check_groq_key(settings)
    check_ollama(settings)
    smoke_test_embedding(settings)

    # 3. --force면 저장소 초기화
    if args.force:
        logger.info("--force: 저장소 초기화")
        reset_stores(settings)

    # 4. 문서 로드 (cheap 단계 — LLM 호출 없음)
    loader = DocumentLoader(settings)
    kg_docs, code_docs = load_documents(settings, loader, args.mode)
    logger.info("KG 대상 교재: %d개 / 코드 벡터 대상 예제코드: %d개", len(kg_docs), len(code_docs))

    # 5. [Phase 1] 교재 KG 구축 (LightRAG insert — LLM 추출 단계)
    kg_stats = {"success": 0, "skipped": [], "total": 0, "kg_nodes": 0}
    if kg_docs:
        logger.info("-" * 60)
        logger.info("[Phase 1] 교재 KG 구축 시작 (%d개 파일)", len(kg_docs))
        kg_stats = KGBuilder(settings).build_from_documents(kg_docs)
    else:
        logger.warning("KG 인덱싱 대상 교재 없음 → Phase 1 스킵")

    # 6. [Phase 2] 예제코드 벡터 인덱스 구축 (nano-vectordb)
    code_stats = {"success": 0, "skipped": [], "chunks": 0, "total": 0}
    if code_docs:
        logger.info("-" * 60)
        logger.info("[Phase 2] 예제코드 벡터 인덱스 구축 시작 (%d개 파일)", len(code_docs))
        code_stats = CodeVectorIndexer(settings).build_from_documents(code_docs)
    else:
        logger.warning("코드 벡터 인덱싱 대상 예제코드 없음 → Phase 2 스킵")

    # 7. 최종 요약
    logger.info("=" * 60)
    logger.info("인덱싱 요약")
    logger.info("  교재 KG : insert 성공 %d / 스킵 %d / 추출 노드 %d개 / 전체 %d",
                kg_stats["success"], len(kg_stats["skipped"]), kg_stats.get("kg_nodes", 0), kg_stats["total"])
    logger.info("  코드 벡터: 성공 %d / 스킵 %d / 청크 %d / 전체 %d",
                code_stats["success"], len(code_stats["skipped"]),
                code_stats["chunks"], code_stats["total"])
    if kg_docs and kg_stats.get("kg_nodes", 0) == 0:
        logger.error("인덱싱 경고: 교재 KG 노드 0개(엔티티 추출 실패). LLM 모델/파라미터·로그를 확인하세요.")
    else:
        logger.info("인덱싱 완료! 검증: python validate_index.py")
    logger.info("=" * 60)


if __name__ == "__main__":  # 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
    try:
        main()
    except KeyboardInterrupt:
        logger.info("인덱싱이 사용자에 의해 중단되었습니다.")
        sys.exit(1)
