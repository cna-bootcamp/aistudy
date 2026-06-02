"""검색 라우팅, 검색 실행, 결과 시간을 묶는 서비스 계층."""
# 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함
from __future__ import annotations

import logging
import time

from code_vector_search import CodeVectorSearch
from config.settings import Settings
from lightrag_retriever import LightRAGRetriever
from llm_client import GroqChatClient
from models import DOC_MODES, SearchResult
from query_router import QueryRouter


logger = logging.getLogger(__name__)


class SearchService:
    """Streamlit UI에서 호출하는 동기 검색 서비스."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.llm_client = GroqChatClient(settings)
        self.router = QueryRouter(settings, self.llm_client)
        self.lightrag_retriever = LightRAGRetriever(settings)
        self.code_search = CodeVectorSearch(settings, self.llm_client)

    def search(
        self,
        question: str,
        selected_mode: str = "auto",
        top_k: int | None = None,
        chunk_top_k: int | None = None,
        code_top_k: int | None = None,
        history: list[dict[str, str]] | None = None,
    ) -> SearchResult:
        """검색 모드를 결정한 뒤 해당 검색기로 분기."""
        started = time.perf_counter()
        decision = self.router.route(question, selected_mode)
        logger.info(
            "검색 시작: selected_mode=%s, routed_mode=%s, strategy=%s, confidence=%.2f, question=%s",
            selected_mode,
            decision.mode,
            decision.strategy,
            decision.confidence,
            question,
        )

        if decision.mode == "code":
            result = self.code_search.search(question, decision, top_k=code_top_k)
        elif decision.mode in DOC_MODES:
            result = self.lightrag_retriever.search(
                question,
                decision.mode,
                decision,
                top_k=top_k,
                chunk_top_k=chunk_top_k,
                history=history,
            )
        else:
            result = SearchResult(
                question=question,
                answer=f"지원하지 않는 검색 모드임: {decision.mode}",
                mode=decision.mode,
                decision=decision,
                error=f"unsupported mode: {decision.mode}",
            )

        result.elapsed_seconds = time.perf_counter() - started
        if result.error:
            logger.warning(
                "검색 완료(오류): mode=%s, elapsed=%.2fs, error=%s",
                result.mode,
                result.elapsed_seconds,
                result.error,
            )
        else:
            logger.info(
                "검색 완료: mode=%s, sources=%d, elapsed=%.2fs",
                result.mode,
                len(result.sources),
                result.elapsed_seconds,
            )
        return result
