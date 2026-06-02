"""예제코드 전용 nano-vectordb 검색 모듈.

LightRAG KG를 거치지 않고 `store/vector/code/vdb_code.json`만 대상으로 유사도 검색함.
"""
# 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함
from __future__ import annotations

import logging

import numpy as np
from nano_vectordb import NanoVectorDB

from config.settings import Settings
from embeddings import embed_texts
from llm_client import GroqChatClient
from models import RouterDecision, SearchResult, Source

logger = logging.getLogger(__name__)


class CodeVectorSearch:
    """예제코드 벡터 인덱스 조회와 답변 생성."""

    def __init__(self, settings: Settings, llm_client: GroqChatClient):
        self.settings = settings
        self.llm_client = llm_client
        self._db: NanoVectorDB | None = None

    def search(
        self,
        question: str,
        decision: RouterDecision,
        top_k: int | None = None,
    ) -> SearchResult:
        """질문 임베딩으로 예제코드 벡터 인덱스를 검색하고 Groq LPU로 답변 생성."""
        try:
            db = self._get_db()
            vectors = embed_texts([question], self.settings)
            query_vector = np.asarray(vectors[0], dtype=np.float32)
            results = db.query(
                query_vector,
                top_k=top_k or self.settings.code_top_k,
                better_than_threshold=self.settings.code_score_threshold,
            )
        except Exception as exc:
            logger.error("코드 벡터 검색 실패: %s", exc, exc_info=True)
            return SearchResult(
                question=question,
                answer=f"코드 검색 중 오류가 발생함: {exc}",
                mode="code",
                decision=decision,
                error=str(exc),
            )

        if not results:
            logger.warning("코드 벡터 검색 결과 없음: %s", question)
            return SearchResult(
                question=question,
                answer="예제코드 벡터 인덱스에서 관련 결과를 찾지 못함.",
                mode="code",
                decision=decision,
            )

        sources = [
            Source(
                source_type="code",
                file_path=item.get("file_path", ""),
                label=f"chunk {item.get('chunk_index', '')}",
                score=float(item.get("__metrics__", 0.0)),
                content=item.get("content", ""),
                chunk_id=item.get("__id__", ""),
            )
            for item in results
        ]
        context = self._format_context(sources)
        try:
            answer = self.llm_client.answer_from_context(question, context)
        except Exception as exc:
            logger.error("코드 답변 생성 실패: %s", exc, exc_info=True)
            return SearchResult(
                question=question,
                answer=f"코드 검색은 완료되었지만 답변 생성 중 오류가 발생함: {exc}",
                mode="code",
                decision=decision,
                sources=sources,
                error=str(exc),
            )

        return SearchResult(
            question=question,
            answer=answer,
            mode="code",
            decision=decision,
            sources=sources,
            raw={"results": results},
        )

    def _get_db(self) -> NanoVectorDB:
        """nano-vectordb JSON 파일을 지연 로드."""
        if self._db is not None:
            return self._db
        if not self.settings.code_vdb_file.exists():
            raise FileNotFoundError(f"코드 벡터 인덱스 파일 없음: {self.settings.code_vdb_file}")
        self._db = NanoVectorDB(
            self.settings.embedding_dim,
            storage_file=str(self.settings.code_vdb_file),
        )
        return self._db

    def _format_context(self, sources: list[Source]) -> str:
        """검색된 코드 청크를 LLM 입력 컨텍스트 문자열로 변환."""
        blocks: list[str] = []
        total_chars = 0
        for idx, source in enumerate(sources, start=1):
            content = source.content.strip()
            block = (
                f"[Code {idx}]\n"
                f"file_path: {source.file_path}\n"
                f"chunk: {source.label}\n"
                f"score: {source.score:.4f}\n"
                f"content:\n{content}\n"
            )
            if total_chars + len(block) > self.settings.code_context_max_chars:
                break
            blocks.append(block)
            total_chars += len(block)
        return "\n---\n".join(blocks)
