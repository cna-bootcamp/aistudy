"""LangChain + Neo4j GraphRAG 인덱싱 엔트리포인트

이중 인덱싱 파이프라인:
  [Phase 1] 교재 → LLMGraphTransformer → Neo4j KG + entity_embedding 벡터 인덱스
  [Phase 2] 교재 청크 + 예제코드 → doc_embedding 벡터 인덱스

사용법:
  python index_documents.py              # 전체 인덱싱
  python index_documents.py --force      # 그래프 초기화 후 재인덱싱
  python index_documents.py --mode test  # 테스트용 소량 인덱싱(교재 1 + 예제코드 2)
"""
import argparse
import logging
import sys
from pathlib import Path

# 이 파일이 위치한 indexing/ 디렉터리를 모듈 검색 경로 맨 앞에 추가함 (config/graph 등 패키지 import용)
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config.settings import Settings
from graph.neo4j_connection import Neo4jConnection
from document_loader import DocumentLoader
from kg_builder import KGBuilder
from vector_index import VectorIndexManager

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
# httpx(HTTP 클라이언트)의 요청 로그는 너무 잦아 WARNING 이상만 표시
logging.getLogger("httpx").setLevel(logging.WARNING)
# neo4j 드라이버의 스키마 알림(예: description 속성 미존재)은 의도된 상황이라 ERROR 이상만 표시
logging.getLogger("neo4j").setLevel(logging.ERROR)
logging.getLogger("neo4j.notifications").setLevel(logging.ERROR)
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    """명령줄 인자 파싱 (--force / --mode)"""
    parser = argparse.ArgumentParser(description="LangChain + Neo4j GraphRAG 인덱싱")
    parser.add_argument(
        "--force", action="store_true",
        help="그래프(노드·관계·인덱스)를 초기화한 뒤 전체 재인덱싱",
    )
    parser.add_argument(
        "--mode", choices=["full", "test"], default="full",
        help="full=전체 인덱싱, test=소량 테스트(교재 1 + 예제코드 2)",
    )
    return parser.parse_args()


def log_resolved_paths(settings: Settings) -> None:
    """LLM·Neo4j를 띄우기 전에 도출된 경로를 먼저 출력해 off-by-one 경로 오류를 조기 발견함"""
    logger.info("-" * 60)
    logger.info("[경로 확인] 워크스페이스 루트 : %s", settings.workspace_root)
    tb = settings.textbook_dir
    ex = settings.examples_dir
    # 교재 .md 개수를 미리 세어 0개면 경로 오류임을 즉시 인지 (검색 실패와 혼동 방지)
    tb_count = len(list(tb.rglob("*.md"))) if tb.exists() else 0
    logger.info("[경로 확인] 교재 디렉터리     : %s (존재=%s, .md %d개)", tb, tb.exists(), tb_count)
    logger.info("[경로 확인] 예제코드 디렉터리 : %s (존재=%s)", ex, ex.exists())
    logger.info("[경로 확인] 공용 .env        : %s (존재=%s)", settings.hands_on_env, settings.hands_on_env.exists())
    logger.info("[경로 확인] store 마운트      : %s", settings.store_dir)
    if tb_count == 0:
        logger.warning("교재 .md가 0개입니다 — 경로 또는 파일 존재 여부를 먼저 확인하세요.")


def load_documents(settings: Settings, loader: DocumentLoader, mode: str):
    """모드에 따라 KG용/Vector용 문서를 로드해 (kg_documents, vector_documents) 반환"""
    if mode == "test":
        logger.info("문서 로드 (테스트 모드: 교재 1 + 예제코드 2)")
        # 테스트 대상 3개 파일 (교재 1: 작은 파일 / 예제코드 2: 서로 다른 단원)
        textbook_files = [settings.textbook_dir / "02.멀티턴.md"]
        code_files = [
            settings.examples_dir / "02.multiturn" / "chatbot" / "travel_planner.py",
            settings.examples_dir / "04.pdf" / "pdfplumber" / "pdf2md.py",
        ]
        return loader.load_specific_files(textbook_files, code_files)

    logger.info("문서 로드 (전체 모드)")
    kg_documents = loader.load_for_kg()       # 교재만 (KG 구축용)
    vector_documents = loader.load_for_vector()  # 교재 청크 + 예제코드 (doc_embedding용)
    return kg_documents, vector_documents


def main() -> None:
    """문서 로드 → KG 구축 → 이중 벡터 인덱스 생성 → 통계 출력"""
    args = parse_args()
    logger.info("=" * 60)
    logger.info("LangChain + Neo4j GraphRAG 인덱싱 시작 (mode=%s, force=%s)", args.mode, args.force)
    logger.info("=" * 60)

    # 1. 설정 로드 + 경로 검증 (LLM/Neo4j 호출 전에 경로부터 확인)
    settings = Settings()
    log_resolved_paths(settings)

    # 2. 문서 로드 (cheap 단계 — LLM 호출 없음)
    loader = DocumentLoader(settings)
    kg_documents, vector_documents = load_documents(settings, loader, args.mode)
    logger.info("KG 인덱싱 청크: %d개 / Vector 인덱싱 청크: %d개", len(kg_documents), len(vector_documents))

    # 3. Neo4j 연결 (재시도 백오프 포함)
    logger.info("Neo4j 연결 중...")
    connection = Neo4jConnection(settings)

    # 4. --force면 그래프 전체 초기화 (재인덱싱 시 중복·잔존 데이터 제거)
    if args.force:
        logger.info("--force: 그래프 초기화")
        connection.clear_graph()

    # 5. 엔티티 id 유니크 제약조건 생성 (MERGE 중복 방지 + 성능)
    connection.create_indexes()

    # 6. [Phase 1] KG 구축 (교재) — LLM 추출 단계
    kg_result = {"extracted_nodes": 0}
    if kg_documents:
        logger.info("-" * 60)
        logger.info("[Phase 1] KG 구축 시작 (교재 %d청크)", len(kg_documents))
        kg_builder = KGBuilder(settings, connection.graph)
        kg_result = kg_builder.build_from_documents(kg_documents)
        logger.info(
            "[Phase 1] 완료 — 성공 %d, 실패 %d, 추출 엔티티 %d개",
            kg_result["success"], kg_result["fail"], kg_result["extracted_nodes"],
        )
    else:
        logger.warning("KG 인덱싱 대상 문서 없음 → Phase 1 스킵")

    # 7. [Phase 2] 벡터 인덱스 생성
    logger.info("-" * 60)
    logger.info("[Phase 2] 벡터 인덱스 생성")
    vector_manager = VectorIndexManager(settings)

    # 7-1. entity_embedding (KG 엔티티 id+description)
    try:
        vector_manager.create_entity_vector_index()
    except Exception as e:
        logger.warning("entity_embedding 인덱스 생성 실패: %s", e)

    # 7-2. doc_embedding (교재 청크 + 예제코드)
    if vector_documents:
        try:
            # 기존 Chunk 노드를 먼저 비워 --force 없는 재실행에서도 중복 누적을 방지 (idempotent)
            connection.clear_doc_chunks()
            vector_manager.create_doc_vector_index(vector_documents)
        except Exception as e:
            logger.warning("doc_embedding 인덱스 생성 실패: %s", e)
    else:
        logger.warning("Vector 인덱싱 대상 문서 없음 → doc_embedding 스킵")

    # 8. 최종 통계 + 완료 판정 (성공 기준은 'exit 0'이 아니라 '비어있지 않은 KG')
    logger.info("-" * 60)
    stats = connection.get_stats()
    logger.info("[통계] 노드 %d개 / 관계 %d개", stats["node_count"], stats["relationship_count"])
    for label in stats["node_labels"][:10]:
        logger.info("  라벨 %s = %d", label["lbls"], label["cnt"])
    for rel in stats["relationship_types"][:10]:
        logger.info("  관계 %s = %d", rel["rel_type"], rel["cnt"])

    logger.info("=" * 60)
    if kg_documents and kg_result["extracted_nodes"] == 0:
        # KG 대상 문서가 있었는데 엔티티가 0개면 추출 경로 실패 — 명확히 경고
        logger.error("인덱싱 경고: 추출 엔티티 0개. LLM 추출 경로(ignore_tool_usage)·GROQ_API_KEY를 확인하세요.")
    else:
        logger.info("인덱싱 완료!")
    logger.info("=" * 60)


if __name__ == "__main__":
    # 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
    try:
        main()
    except KeyboardInterrupt:
        logger.info("인덱싱이 사용자에 의해 중단되었습니다.")
        sys.exit(1)
