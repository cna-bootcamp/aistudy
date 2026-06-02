"""LightRAG working_dir 기반 교재 KG+Vector 검색 모듈."""
# 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함
from __future__ import annotations

import asyncio
import logging
import threading
from typing import Any

from lightrag import LightRAG, QueryParam
from lightrag.kg.shared_storage import initialize_share_data

from config.settings import Settings
from embeddings import create_embedding_func
from llm_client import create_lightrag_llm_func
from models import RouterDecision, SearchResult, Source

logger = logging.getLogger(__name__)


class LightRAGRetriever:
    """LightRAG `query` 계열 API로 교재 검색 수행."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._rag: LightRAG | None = None
        # 요청 간 이벤트 루프를 재사용해 LightRAG 워커 풀이 살아있도록 유지
        # (루프가 바뀌면 closure 내 workers가 죽은 루프에 묶여 2번째 쿼리가 hang됨)
        self._loop = asyncio.new_event_loop()
        self._lock = threading.Lock()  # 동시 쿼리 직렬화 (ProactorEventLoop 스레드 비친화성 방지)

    def search(
        self,
        question: str,
        mode: str,
        decision: RouterDecision,
        top_k: int | None = None,
        chunk_top_k: int | None = None,
        history: list[dict[str, str]] | None = None,
    ) -> SearchResult:
        """LightRAG 검색 모드로 질문을 실행하고 답변·출처 반환."""
        try:
            with self._lock:
                # 현재 스레드에 영속 루프 바인딩 → always_get_an_event_loop()가 이 루프를 재사용
                asyncio.set_event_loop(self._loop)
                rag = self._get_rag()
                param = QueryParam(
                    mode=mode,
                    response_type="한국어 기술 설명",
                    top_k=top_k or self.settings.top_k,
                    chunk_top_k=chunk_top_k or self.settings.chunk_top_k,
                    max_entity_tokens=self.settings.max_entity_tokens,
                    max_relation_tokens=self.settings.max_relation_tokens,
                    max_total_tokens=self.settings.max_total_tokens,
                    conversation_history=history or [],
                    enable_rerank=False,
                    include_references=True,
                )
                logger.info("LightRAG query_llm 실행: mode=%s, question=%s", mode, question)
                raw = rag.query_llm(question, param)
        except Exception as exc:
            logger.error("LightRAG query 실패: %s", exc, exc_info=True)
            return SearchResult(
                question=question,
                answer=f"검색 중 오류가 발생함: {exc}",
                mode=mode,
                decision=decision,
                error=str(exc),
            )

        if raw.get("status") != "success":
            message = raw.get("message", "검색 결과 없음")
            logger.warning("LightRAG 검색 실패 응답: %s", message)
            return SearchResult(
                question=question,
                answer=f"검색 결과를 찾지 못함. ({message})",
                mode=mode,
                decision=decision,
                raw=raw,
            )

        answer = (raw.get("llm_response") or {}).get("content") or ""
        sources = self._extract_sources(raw)
        if not answer.strip():
            logger.warning("LightRAG 답변 비어 있음")
            answer = "검색 결과는 수집되었지만 답변 생성 결과가 비어 있음."

        return SearchResult(
            question=question,
            answer=answer,
            mode=mode,
            decision=decision,
            sources=sources,
            raw=raw,
        )

    def _get_rag(self) -> LightRAG:
        """LightRAG 인스턴스를 지연 생성하고 스토리지 초기화."""
        if self._rag is not None:
            return self._rag

        self._validate_store()
        asyncio.set_event_loop(self._loop)  # 직접 호출 경로(search_test.py)에서도 루프 보장
        # Windows에서 multiprocessing Manager 생성을 피하기 위해 단일 worker 공유 저장소를 먼저 초기화함
        initialize_share_data(1)
        rag = LightRAG(
            working_dir=str(self.settings.kg_dir),
            llm_model_func=create_lightrag_llm_func(self.settings),
            llm_model_name=self.settings.groq_model,
            llm_model_max_async=self.settings.llm_max_async,
            embedding_func=create_embedding_func(self.settings),
            chunk_token_size=self.settings.chunk_token_size,
            chunk_overlap_token_size=self.settings.chunk_overlap_token_size,
        )
        # self._loop는 search()의 with self._lock 안에서 이미 set_event_loop됨
        self._loop.run_until_complete(rag.initialize_storages())
        self._rag = rag
        return rag

    def _validate_store(self) -> None:
        """LightRAG working_dir 필수 산출물 존재 여부 확인."""
        required = [
            self.settings.kg_dir / "graph_chunk_entity_relation.graphml",
            self.settings.kg_dir / "vdb_chunks.json",
            self.settings.kg_dir / "kv_store_text_chunks.json",
        ]
        missing = [str(path) for path in required if not path.exists()]
        if missing:
            raise FileNotFoundError("LightRAG 인덱싱 산출물 누락: " + ", ".join(missing))

    @staticmethod
    def _extract_sources(raw: dict[str, Any]) -> list[Source]:
        """LightRAG 구조화 응답에서 출처 목록 추출."""
        data = raw.get("data") or {}
        sources: list[Source] = []
        seen: set[tuple[str, str, str]] = set()

        def add(source: Source) -> None:
            key = (source.source_type, source.file_path, source.label or source.chunk_id)
            if key in seen or not source.file_path:
                return
            seen.add(key)
            sources.append(source)

        for ref in data.get("references", []) or []:
            add(Source("reference", ref.get("file_path", ""), label=str(ref.get("reference_id", ""))))
        for chunk in data.get("chunks", []) or []:
            add(Source(
                "chunk",
                chunk.get("file_path", ""),
                label=str(chunk.get("reference_id", "")),
                content=chunk.get("content", ""),
                chunk_id=chunk.get("chunk_id", ""),
            ))
        for entity in data.get("entities", []) or []:
            add(Source(
                "entity",
                entity.get("file_path", ""),
                label=entity.get("entity_name", ""),
                content=entity.get("description", ""),
            ))
        for rel in data.get("relationships", []) or []:
            add(Source(
                "relationship",
                rel.get("file_path", ""),
                label=f"{rel.get('src_id', '')} -> {rel.get('tgt_id', '')}",
                content=rel.get("description", ""),
            ))
        return sources[:20]
