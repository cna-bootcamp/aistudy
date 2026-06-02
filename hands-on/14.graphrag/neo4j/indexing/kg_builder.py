"""LLMGraphTransformer 기반 KG 구축 모듈 (비동기 병렬)

교재 청크에서 엔티티/관계를 추출해 Neo4j Knowledge Graph를 구축함.

핵심 설정:
- strict_mode=False: allowed_* 목록을 힌트로만 사용해 그 외 엔티티/관계도 허용 (재현율 우선)
- ignore_tool_usage=True: gpt-oss-20b의 tool-calling 불안정성을 피해 프롬프트 기반 추출 사용
- aconvert_to_graph_documents(): 비동기 병렬 처리로 LLM 대기 시간을 줄여 5~10배 속도 향상
"""
import asyncio
import inspect
import logging

# tqdm: 장시간 작업의 진행률을 막대 그래프로 표시하는 라이브러리
from tqdm import tqdm
from langchain_core.documents import Document
# LLMGraphTransformer: 텍스트를 LLM에 보내 엔티티(노드)·관계(엣지)를 추출하는 LangChain 변환기
from langchain_experimental.graph_transformers import LLMGraphTransformer
# Neo4jGraph: Cypher 실행·그래프 저장을 감싼 Neo4j 래퍼
from langchain_neo4j import Neo4jGraph
# ChatOpenAI: OpenAI 호환 채팅 모델 래퍼. base_url만 바꿔 Groq LPU를 그대로 사용함
from langchain_openai import ChatOpenAI

from config.settings import Settings

logger = logging.getLogger(__name__)


class KGBuilder:
    """LLMGraphTransformer로 교재에서 KG를 구축하는 빌더 (비동기 배치)

    LLMGraphTransformer가 만드는 노드 구조:
    - 라벨: __Entity__ 공통 라벨 + 엔티티 타입 라벨(Technology, Concept 등)
    - 속성: id(엔티티 이름, 필수), description(설명, 선택)
    """

    def __init__(self, settings: Settings, graph: Neo4jGraph):
        self.settings = settings
        self.graph = graph
        # Groq LPU를 OpenAI 호환 인터페이스로 사용 — base_url·api_key만 Groq로 지정하면
        # LLMGraphTransformer 내부 ChatOpenAI 클라이언트가 그대로 Groq의 초고속 추론(LPU)을 활용함
        self.llm = ChatOpenAI(
            model=settings.groq_model,
            base_url=settings.groq_base_url,
            api_key=settings.groq_api_key,
            temperature=0,              # 결정적 추출(재현성)을 위해 0 고정
            timeout=settings.groq_timeout,
            max_retries=settings.groq_max_retries,
        )

        # LLMGraphTransformer 생성 인자 구성
        # - allowed_nodes/allowed_relationships: 도메인 온톨로지(영어) — 추출 타입을 안내
        # - strict_mode=False: 허용 목록 외 타입도 저장 (재현율 우선)
        transformer_kwargs = dict(
            llm=self.llm,
            allowed_nodes=settings.allowed_nodes,
            allowed_relationships=settings.allowed_relationships,
            strict_mode=settings.strict_mode,
        )
        # node_properties(엔티티 description 추출)는 네이티브 함수호출 모드에서만 지원됨.
        # ignore_tool_usage=True(프롬프트 추출)와 node_properties를 함께 쓰면 ValueError가 나므로 상호 배타 처리:
        # - 함수호출 모드(기본): node_properties=["description"] 포함 → entity_embedding 품질 향상
        # - 프롬프트 추출 모드: node_properties 생략 (gpt-oss 0개 추출 시 폴백 경로)
        supports_ignore = "ignore_tool_usage" in inspect.signature(LLMGraphTransformer.__init__).parameters
        if settings.ignore_tool_usage and supports_ignore:
            transformer_kwargs["ignore_tool_usage"] = True
            logger.info("프롬프트 기반 추출 모드 — node_properties(description) 생략")
        else:
            transformer_kwargs["node_properties"] = ["description"]
            if settings.ignore_tool_usage and not supports_ignore:
                logger.warning("설치된 LLMGraphTransformer가 ignore_tool_usage 미지원 — 함수호출 모드 사용")
        self.transformer = LLMGraphTransformer(**transformer_kwargs)

    def build_from_documents(self, documents: list[Document]) -> dict:
        """교재 청크에서 KG를 구축함 (동기 인터페이스로 비동기 처리를 감쌈)

        asyncio.run(): 비동기 코루틴을 동기 함수에서 실행해, 호출부는 평소처럼 사용하면서도
        내부에서는 LLM 호출을 병렬 처리하여 전체 시간을 단축함.
        """
        return asyncio.run(self._build_async(documents))

    async def _build_async(self, documents: list[Document]) -> dict:
        """배치 단위 비동기 변환으로 KG를 구축함"""
        total = len(documents)
        success_count = 0
        fail_count = 0
        extracted_node_total = 0
        # 배치 시작 인덱스 목록 (예: 0, 10, 20, ...). 메모리·요청 수 제어를 위해 batch_size씩 나눔
        batch_starts = list(range(0, total, self.settings.batch_size))

        pbar = tqdm(
            total=len(batch_starts),
            desc="KG 구축",
            unit="batch",
            bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]",
        )

        for start in batch_starts:
            batch = documents[start:start + self.settings.batch_size]
            batch_end = min(start + len(batch), total)
            pbar.set_postfix(docs=f"{batch_end}/{total}", ok=success_count, fail=fail_count)

            try:
                # aconvert_to_graph_documents(): 청크들을 비동기로 LLM에 보내 엔티티/관계를 추출
                graph_documents = await self.transformer.aconvert_to_graph_documents(batch)

                # 추출된 노드 집계 — 0개면 LLM이 엔티티를 못 찾았거나 추출 경로가 실패한 것
                extracted_nodes = [n for doc in graph_documents for n in doc.nodes]
                if not extracted_nodes:
                    logger.warning(
                        "청크 %d-%d: 엔티티 0개 추출 (LLM 추출 실패 또는 빈 청크)",
                        start + 1, batch_end,
                    )
                    fail_count += len(batch)
                    continue
                extracted_node_total += len(extracted_nodes)

                # 첫 배치는 추출 샘플(노드·관계 타입)을 로그로 남겨 추출이 살아있는지 즉시 확인
                if start == 0:
                    sample_types = sorted({n.type for n in extracted_nodes})[:8]
                    sample_rels = sorted({
                        r.type for doc in graph_documents for r in doc.relationships
                    })[:8]
                    logger.info("추출 샘플 — 노드 타입: %s", sample_types)
                    logger.info("추출 샘플 — 관계 타입: %s", sample_rels)

                # add_graph_documents() 저장 옵션:
                # - baseEntityLabel=True: 모든 엔티티에 __Entity__ 공통 라벨 부여
                #   → 타입과 무관하게 MATCH (n:__Entity__)로 일괄 조회 (벡터 인덱스 생성에 필수)
                # - include_source=True: 각 엔티티/관계에 출처 문서를 연결해 검색 결과의 출처 추적 가능
                self.graph.add_graph_documents(
                    graph_documents,
                    baseEntityLabel=True,
                    include_source=True,
                )
                success_count += len(batch)
            except Exception as e:
                # 한 배치 실패가 전체를 막지 않도록 스킵하고 다음 배치 계속 진행 (WARNING 로그)
                logger.warning("청크 %d-%d 변환 실패, 스킵: %s", start + 1, batch_end, e)
                fail_count += len(batch)
            finally:
                pbar.update(1)

        pbar.close()

        # 엔티티 노드에 벡터 검색용 text 속성 설정 (Neo4jVector가 임베딩 대상 텍스트로 요구)
        self._set_entity_text()

        logger.info(
            "KG 구축 완료: 성공 %d, 실패 %d (총 %d), 추출 엔티티 %d개",
            success_count, fail_count, total, extracted_node_total,
        )
        return {
            "success": success_count,
            "fail": fail_count,
            "extracted_nodes": extracted_node_total,
        }

    def _set_entity_text(self):
        """__Entity__ 노드에 text 속성 설정 (벡터 검색용)

        Neo4jVector.from_existing_graph()는 임베딩·결과 표시에 text 속성을 사용하는데
        LLMGraphTransformer는 id·description만 생성하므로, 여기서 text = id(+description)로 채움.
        """
        # description이 있으면 "엔티티명: 설명" (풍부한 문맥으로 검색 정확도 향상)
        self.graph.query(
            "MATCH (n:__Entity__) "
            "WHERE n.description IS NOT NULL AND n.description <> '' "
            "AND (n.text IS NULL OR n.text = '') "
            "SET n.text = n.id + ': ' + n.description"
        )
        # description이 없으면 "엔티티명"만 (최소한의 검색 가능성 확보)
        self.graph.query(
            "MATCH (n:__Entity__) "
            "WHERE n.text IS NULL OR n.text = '' "
            "SET n.text = n.id"
        )
        logger.info("__Entity__ text 속성 설정 완료")
