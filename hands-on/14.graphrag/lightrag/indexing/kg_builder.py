"""교재 KG 구축 모듈 — LightRAG insert() 기반 (KG + 교재 벡터 동시 구축)

LightRAG는 ainsert() 한 번으로 (1) LLM 엔티티/관계 추출 → GraphML KG 구축,
(2) 청크/엔티티/관계 임베딩 → nano-vectordb 저장, (3) 원문/청크 → KV Store 저장을 모두 수행함.
working_dir(store/kg)에 결과 파일이 자동 생성됨.

[동기 인터페이스] 공개 메서드 build_from_documents()는 동기지만 내부에서 asyncio.run()으로
비동기 LightRAG를 구동함. LightRAG의 스토리지 초기화가 비동기 전용이라 인덱서 본체를 async로 두고,
호출부(Streamlit 등 동기 환경 포함)는 평소처럼 동기로 사용하게 함.
"""
import asyncio
import inspect
import logging

from lightrag import LightRAG
# initialize_pipeline_status: LightRAG 문서 처리 파이프라인의 전역 상태를 초기화하는 비동기 함수
# initialize_share_data: 공유 스토리지를 초기화하는 함수 (workers=1이면 단일 프로세스/asyncio 락 사용)
from lightrag.kg.shared_storage import initialize_pipeline_status, initialize_share_data

from config.settings import Settings
from llm_func import create_embedding_func, create_llm_func

logger = logging.getLogger(__name__)


class KGBuilder:
    """LightRAG insert()로 교재에서 KG+Vector를 구축하는 빌더."""

    def __init__(self, settings: Settings):
        self.settings = settings

    def build_from_documents(self, docs: list[dict]) -> dict:
        """교재 문서로 KG+Vector를 구축함 (동기 인터페이스로 비동기 처리를 감쌈).

        asyncio.run(): 비동기 코루틴을 동기 함수에서 실행해, 호출부는 평소처럼 사용하면서도
        내부에서는 LightRAG의 비동기 스토리지 초기화·insert를 정상 구동함.
        """
        return asyncio.run(self._build_async(docs))

    async def _build_async(self, docs: list[dict]) -> dict:
        """LightRAG 인스턴스 생성·초기화 후 문서를 한 건씩 ainsert."""
        rag = await self._create_rag()

        # ainsert가 file_paths 인자를 지원하는지 1회만 확인 (구버전 호환).
        # 지원 시 출처 경로를 함께 저장해 검색 결과의 인용 추적이 가능함.
        supports_file_paths = "file_paths" in inspect.signature(rag.ainsert).parameters

        success, skipped = 0, []
        for doc in docs:
            path = doc["file_path"]
            try:
                logger.info("KG insert 시작: %s", path)
                if supports_file_paths:
                    await rag.ainsert(doc["content"], file_paths=path)
                else:
                    await rag.ainsert(doc["content"])
                success += 1
            except Exception as exc:  # noqa: BLE001 - 한 파일 실패가 전체 인덱싱을 막지 않도록 스킵
                logger.warning("KG insert 실패, 스킵: %s (%s)", path, exc)
                skipped.append(path)

        # finalize_storages(): 열린 스토리지 핸들을 정리하여 파일 flush를 보장 (지원 시에만 호출)
        if hasattr(rag, "finalize_storages"):
            await rag.finalize_storages()

        # ainsert는 LLM 추출이 실패(엔티티 0개)해도 예외를 던지지 않으므로, insert 호출 성공만으로는
        # KG 생성을 보장할 수 없음. 실제 GraphML 노드 수를 세어 KG 구축 여부를 정직하게 판정함.
        graphml = self.settings.kg_dir / "graph_chunk_entity_relation.graphml"
        kg_nodes = graphml.read_text(encoding="utf-8").count("<node ") if graphml.exists() else 0

        logger.info("KG 인덱싱 완료: insert 성공 %d, 스킵 %d, 추출 노드 %d개", success, len(skipped), kg_nodes)
        if docs and kg_nodes == 0:
            logger.error(
                "KG 노드 0개 — LLM 엔티티 추출 실패(예: 빈 content 반환). LLM 모델/파라미터를 점검하세요."
            )
        return {"success": success, "skipped": skipped, "total": len(docs), "kg_nodes": kg_nodes}

    async def _create_rag(self) -> LightRAG:
        """LightRAG 인스턴스 생성 후 비동기 스토리지/파이프라인 초기화.

        initialize_storages()와 initialize_pipeline_status()는 비동기 전용이며,
        호출하지 않으면 내부 스토리지가 준비되지 않아 insert 시 오류가 발생함.
        """
        self.settings.kg_dir.mkdir(parents=True, exist_ok=True)
        # [Windows 필수] 단일 프로세스 모드를 가장 먼저 고정함.
        # LightRAG의 ainsert 파이프라인은 내부에서 initialize_share_data(workers>1)를 호출해
        # mp.Manager()를 spawn하는데, Windows의 multiprocessing 'spawn'에서 부트스트랩 핸드셰이크가
        # 깨져 'EOFError: Ran out of input'으로 인덱싱이 실패함.
        # 먼저 workers=1로 호출하면 _initialized=True가 되어 이후 호출이 가드(if _initialized: return)에
        # 막히므로 mp.Manager() spawn이 발생하지 않음 (is_multiprocess=False, asyncio 락 사용).
        initialize_share_data(1)
        rag = LightRAG(
            working_dir=str(self.settings.kg_dir),
            llm_model_func=create_llm_func(self.settings),
            llm_model_name=self.settings.groq_model,
            llm_model_max_async=self.settings.llm_max_async,
            embedding_func=create_embedding_func(self.settings),
            chunk_token_size=self.settings.chunk_token_size,
            chunk_overlap_token_size=self.settings.chunk_overlap_token_size,
        )
        await rag.initialize_storages()       # KG/벡터/KV 스토리지 파일 핸들 준비
        await initialize_pipeline_status()    # 문서 처리 파이프라인 상태(전역) 초기화
        return rag
