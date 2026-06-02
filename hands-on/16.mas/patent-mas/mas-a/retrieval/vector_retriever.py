"""조문 벡터 RAG 검색기 — ChromaDB `patent_law` 컬렉션으로 조문 원문을 정밀 인용함.

역할(GraphRAG와 구분): "특허법 제29조(특허요건)" 처럼 조문 단위 원문을 정확히 찾아 인용하는 검색.
선행 인덱싱(indexing/vector)이 부여한 장/조/항 메타데이터를 출처 제목으로 실어 인용 추적을 보존함.

  Embed   : OpenAI text-embedding-3-small (1536차원, 질의 임베딩 전용 — 문서 재인덱싱 없음)
  VectorDB: ChromaDB (영속, 컬렉션 patent_law)
  LLM     : Groq LPU openai/gpt-oss-120b (reasoning_format="hidden")
"""
from __future__ import annotations

import logging

from langchain_chroma import Chroma
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import OpenAIEmbeddings

from config.llm import build_chat_llm
from config.settings import Settings
from retrieval.types import SearchOutput, SourceItem

logger = logging.getLogger(__name__)

# 검색된 조문에 근거해서만 답하도록 제약하는 RAG 프롬프트 (정밀 인용 강조)
_SYSTEM_PROMPT = (
    "당신은 대한민국 특허법 조문을 근거로 답변하는 법령 RAG 어시스턴트임. "
    "반드시 아래 [참고 조문]에 있는 내용만 근거로 답변하고, 문서에 없는 내용은 추측하지 말 것. "
    "답변에는 근거가 된 조문 번호를 '제○○조' 형식으로 명시해 인용할 것. "
    "근거를 찾을 수 없으면 '제공된 조문에서 관련 내용을 찾을 수 없습니다.'라고 답할 것. "
    "답변은 한국어로 간결하게 작성할 것."
)
_HUMAN_PROMPT = "[참고 조문]\n{context}\n\n[질문]\n{question}\n\n[답변]"


class VectorRetriever:
    """ChromaDB 조문 인덱스를 재임베딩 없이 연결해 검색·답변하는 검색기."""

    def __init__(self, settings: Settings):
        self.settings = settings
        # 인덱싱과 동일한 임베딩 모델을 써야 질의 벡터의 차원·의미 공간이 일치해 검색이 성립함
        self._embeddings = OpenAIEmbeddings(
            model=settings.embedding_model,
            api_key=settings.openai_api_key,
        )
        # Chroma(...): from_documents(신규 인덱싱)와 달리 이미 영속화된 컬렉션을 그대로 연결함
        self._store = Chroma(
            collection_name=settings.collection_name,
            embedding_function=self._embeddings,
            persist_directory=str(settings.vector_store_dir),
        )
        count = self._store._collection.count()  # 컬렉션 벡터 개수 (0이면 인덱싱이 비었음)
        if count == 0:
            raise RuntimeError(
                f"벡터 컬렉션 '{settings.collection_name}'가 비어 있음. "
                f"indexing/vector 인덱싱을 먼저 수행하세요: {settings.vector_store_dir}"
            )
        logger.info("VectorRetriever 준비 완료: %d개 벡터 (%s)", count, settings.collection_name)
        self._llm = build_chat_llm(settings, max_tokens=settings.llm_max_tokens)

    def search(self, query: str) -> SearchOutput:
        """질의어로 유사 조문 청크를 검색하고, 그 근거로 LLM 답변을 생성함."""
        # 1) 탐색: 질의 임베딩 → 유사도 상위 K개 조문 청크
        docs = self._store.similarity_search(query, k=self.settings.vector_top_k)
        sources = [self._to_source(doc) for doc in docs]

        # 2) 생성: 검색 청크를 컨텍스트로 묶어 조문 인용 답변 생성 (LCEL 체인)
        prompt = ChatPromptTemplate.from_messages(
            [("system", _SYSTEM_PROMPT), ("human", _HUMAN_PROMPT)]
        )
        chain = prompt | self._llm | StrOutputParser()
        answer = chain.invoke({"context": self._format_context(sources), "question": query})

        return SearchOutput(
            mode="vector",
            answer=answer.strip(),
            sources=sources,
            evidence={"sources": len(sources)},
        )

    @staticmethod
    def _citation_label(meta: dict) -> str:
        """장/조 메타데이터로 '특허법 제29조(특허요건)' 형식의 정밀 인용 라벨을 만듦."""
        article = str(meta.get("article", "")).strip()
        article_title = str(meta.get("article_title", "")).strip()
        chapter = str(meta.get("chapter", "")).strip()
        if article:
            label = f"특허법 {article}"
            if article_title:
                label += f"({article_title})"
            return label
        if chapter:
            return f"특허법 {chapter}"
        return str(meta.get("source", "특허법"))

    def _to_source(self, doc) -> SourceItem:
        """검색된 Document를 표시용 SourceItem으로 변환 (조문 라벨 + 핵심 메타데이터)."""
        meta = doc.metadata or {}
        return SourceItem(
            source_type="vector",
            title=self._citation_label(meta),
            content=str(doc.page_content)[:1200],  # MCP 응답 간결화를 위해 원문 길이 제한
            metadata={
                "chapter": meta.get("chapter", ""),
                "article": meta.get("article", ""),
                "articles": meta.get("articles", ""),     # 한 청크에 여러 조가 병합된 경우
                "clauses": meta.get("clauses", ""),       # 청크에 등장한 항(①②③) 마커
                "chunk_index": meta.get("chunk_index", ""),
            },
        )

    @staticmethod
    def _format_context(sources: list[SourceItem]) -> str:
        """검색 청크들을 LLM 프롬프트용 단일 문자열로 합침 (각 청크에 인용 라벨 부여)."""
        blocks = []
        for index, src in enumerate(sources, start=1):
            blocks.append(f"[출처 {index}] {src.title}\n{src.content}")
        return "\n\n---\n\n".join(blocks) if blocks else "(검색 결과 없음)"
