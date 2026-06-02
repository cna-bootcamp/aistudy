"""GraphRAG and code-vector retrieval services."""

from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import lancedb
import pandas as pd
import requests
from graphrag.api import basic_search, drift_search, global_search, local_search

from config import CODE_VECTOR_DIR, PARQUET_DIR, settings, validate_paths, load_query_config
from llm import GraphRAGCompletion
from router import ResolvedMode, RouteDecision


@dataclass(frozen=True)
class SourceItem:
    """One source shown below a retrieval answer."""

    source_type: str
    title: str
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SearchResult:
    """Unified response returned to the Streamlit app."""

    answer: str
    mode: ResolvedMode
    requested_mode: ResolvedMode
    route: RouteDecision
    sources: list[SourceItem]
    context_data: Any = None
    fallback_reason: str | None = None


class RetrievalError(RuntimeError):
    """Raised when retrieval cannot run because required stores are missing."""


class GraphRAGRetriever:
    """Run Microsoft GraphRAG API searches over existing Parquet/LanceDB outputs."""

    def __init__(
        self,
        *,
        query_model: str | None = None,
        response_type: str | None = None,
        community_level: int | None = None,
        dynamic_global_selection: bool | None = None,
        drift_json_retries: int | None = None,
    ) -> None:
        missing = validate_paths()
        if missing:
            raise RetrievalError("필수 인덱싱 산출물이 없음: " + ", ".join(missing))

        self.config = load_query_config(query_model)
        self.response_type = response_type or settings.response_type
        self.community_level = settings.community_level if community_level is None else community_level
        self.dynamic_global_selection = (
            settings.dynamic_global_selection
            if dynamic_global_selection is None
            else dynamic_global_selection
        )
        self.drift_json_retries = (
            settings.drift_json_retries if drift_json_retries is None else drift_json_retries
        )
        self._frames: dict[str, pd.DataFrame] = {}

    def search(self, query: str, route: RouteDecision) -> SearchResult:
        """Synchronous entry point for Streamlit."""

        return run_async(self.search_async(query, route))

    async def search_async(self, query: str, route: RouteDecision) -> SearchResult:
        """Run the selected GraphRAG search mode."""

        mode = route.mode
        if mode == "basic":
            answer, context = await basic_search(
                config=self.config,
                text_units=self.frame("text_units"),
                response_type=self.response_type,
                query=query,
            )
        elif mode == "local":
            answer, context = await self._local(query)
        elif mode == "global":
            answer, context = await global_search(
                config=self.config,
                entities=self.frame("entities"),
                communities=self.frame("communities"),
                community_reports=self.frame("community_reports"),
                community_level=self.community_level,
                dynamic_community_selection=self.dynamic_global_selection,
                response_type=self.response_type,
                query=query,
            )
        elif mode == "drift":
            return await self._drift_with_retry(query, route)
        else:
            raise ValueError(f"GraphRAGRetriever does not handle mode: {mode}")

        return SearchResult(
            answer=str(answer).strip(),
            mode=mode,
            requested_mode=mode,
            route=route,
            sources=collect_sources(context),
            context_data=context,
        )

    async def _local(self, query: str) -> tuple[Any, Any]:
        return await local_search(
            config=self.config,
            entities=self.frame("entities"),
            communities=self.frame("communities"),
            community_reports=self.frame("community_reports"),
            text_units=self.frame("text_units"),
            relationships=self.frame("relationships"),
            covariates=self.optional_frame("covariates"),
            community_level=self.community_level,
            response_type=self.response_type,
            query=query,
        )

    async def _drift_with_retry(self, query: str, route: RouteDecision) -> SearchResult:
        errors: list[str] = []
        for attempt in range(self.drift_json_retries + 1):
            try:
                answer, context = await drift_search(
                    config=self.config,
                    entities=self.frame("entities"),
                    communities=self.frame("communities"),
                    community_reports=self.frame("community_reports"),
                    text_units=self.frame("text_units"),
                    relationships=self.frame("relationships"),
                    community_level=self.community_level,
                    response_type=self.response_type,
                    query=query,
                )
                return SearchResult(
                    answer=str(answer).strip(),
                    mode="drift",
                    requested_mode="drift",
                    route=route,
                    sources=collect_sources(context),
                    context_data=context,
                )
            except Exception as exc:
                if not is_json_parse_error(exc):
                    raise
                errors.append(f"attempt={attempt + 1}: {exc}")

        answer, context = await self._local(query)
        reason = (
            f"DRIFT JSON 파싱 실패가 {len(errors)}회 반복되어"
            f"(초기 1회 + 재시도 {self.drift_json_retries}회) Local Search로 폴백함"
        )
        fallback_route = RouteDecision(
            mode="local",
            confidence=route.confidence,
            reason=f"{route.reason}; {reason}",
            used_llm_fallback=route.used_llm_fallback,
        )
        return SearchResult(
            answer=str(answer).strip(),
            mode="local",
            requested_mode="drift",
            route=fallback_route,
            sources=collect_sources(context),
            context_data=context,
            fallback_reason=reason,
        )

    def frame(self, name: str) -> pd.DataFrame:
        """Read a required Parquet frame lazily."""

        if name not in self._frames:
            path = PARQUET_DIR / f"{name}.parquet"
            if not path.exists():
                raise RetrievalError(f"필수 Parquet 파일 없음: {path}")
            self._frames[name] = pd.read_parquet(path)
        return self._frames[name]

    def optional_frame(self, name: str) -> pd.DataFrame | None:
        """Read an optional Parquet frame lazily."""

        path = PARQUET_DIR / f"{name}.parquet"
        if not path.exists():
            return None
        return self.frame(name)


class CodeVectorRetriever:
    """Search the code-only LanceDB index and answer with Groq via GraphRAG LLM."""

    def __init__(
        self,
        *,
        top_k: int | None = None,
        query_model: str | None = None,
        ollama_base_url: str | None = None,
        embedding_model: str | None = None,
    ) -> None:
        self.top_k = top_k or settings.code_top_k
        self.ollama_base_url = (ollama_base_url or settings.ollama_base_url).rstrip("/")
        self.embedding_model = embedding_model or settings.embedding_model
        self.llm = GraphRAGCompletion(query_model)
        self.db = lancedb.connect(str(CODE_VECTOR_DIR))
        if "code_chunks" not in self.db.table_names():
            raise RetrievalError(f"code_chunks LanceDB 테이블 없음: {CODE_VECTOR_DIR}")
        self.table = self.db.open_table("code_chunks")

    def search(self, query: str, route: RouteDecision, history: list[dict[str, str]] | None = None) -> SearchResult:
        """Run code-vector search and synthesize an answer."""

        query_vector = self.embed_query(query)
        rows = self.table.search(query_vector).limit(self.top_k).to_pandas()
        sources = [
            SourceItem(
                source_type="code",
                title=f"{row.get('filename', 'code')}::{row.get('section_title', '')}",
                content=str(row.get("text", ""))[:2500],
                metadata={
                    "source": row.get("source", ""),
                    "chunk_index": int(row.get("chunk_index", 0)),
                    "distance": float(row.get("_distance", 0.0)),
                },
            )
            for _, row in rows.iterrows()
        ]
        answer = self._answer_from_code_context(query, sources, history)
        return SearchResult(
            answer=answer,
            mode="code",
            requested_mode="code",
            route=route,
            sources=sources,
            context_data=rows,
        )

    def embed_query(self, query: str) -> list[float]:
        """Embed a query with Ollama qwen3-embedding."""

        url = f"{self.ollama_base_url}/api/embeddings"
        response = requests.post(
            url,
            json={"model": self.embedding_model, "prompt": query},
            timeout=120,
        )
        if response.status_code != 200:
            raise RetrievalError(
                f"Ollama 임베딩 실패(status={response.status_code}): {response.text[:200]}"
            )
        embedding = response.json().get("embedding")
        if not embedding:
            raise RetrievalError("Ollama 응답에 embedding 필드가 없음")
        return embedding

    def _answer_from_code_context(self, query: str, sources: list[SourceItem], history: list[dict[str, str]] | None = None) -> str:
        context = "\n\n".join(
            f"[{idx}] {src.metadata.get('source')} :: {src.title}\n{src.content}"
            for idx, src in enumerate(sources, start=1)
        )
        messages: list[dict[str, str]] = [
            {
                "role": "system",
                "content": (
                    "You are an AI boot camp code-search assistant. Answer in Korean. "
                    "Use only the provided code context. Cite source numbers like [1]. "
                    "If context is insufficient, say what is missing."
                ),
            },
        ]
        if history:
            messages.extend(
                {"role": m["role"], "content": m["content"][:400]}
                for m in history[-4:]
            )
        messages.append({
            "role": "user",
            "content": f"질문:\n{query}\n\n코드 컨텍스트:\n{context}",
        })
        return self.llm.complete(messages, temperature=0.0, max_tokens=1400)


def collect_sources(context_data: Any, max_items: int | None = None) -> list[SourceItem]:
    """Convert GraphRAG context data into compact display sources."""

    max_items = max_items or settings.graph_top_sources
    sources: list[SourceItem] = []

    for source_type, frame in iter_context_frames(context_data):
        if frame.empty:
            continue
        for _, row in frame.head(max_items).iterrows():
            sources.append(source_from_row(source_type, row))
            if len(sources) >= max_items:
                return sources
    return sources


def iter_context_frames(context_data: Any) -> list[tuple[str, pd.DataFrame]]:
    """Yield named DataFrames from GraphRAG callback context variants."""

    frames: list[tuple[str, pd.DataFrame]] = []
    if isinstance(context_data, pd.DataFrame):
        frames.append(("context", context_data))
    elif isinstance(context_data, dict):
        for name, value in context_data.items():
            if isinstance(value, pd.DataFrame):
                frames.append((str(name), value))
            elif isinstance(value, list) and value and isinstance(value[0], dict):
                frames.append((str(name), pd.DataFrame(value)))
            elif isinstance(value, dict):
                try:
                    frames.append((str(name), pd.DataFrame(value)))
                except ValueError:
                    continue
    elif isinstance(context_data, list):
        for idx, value in enumerate(context_data):
            if isinstance(value, pd.DataFrame):
                frames.append((f"context_{idx}", value))
    return frames


def source_from_row(source_type: str, row: pd.Series) -> SourceItem:
    """Build a display source from a GraphRAG context row."""

    data = row.to_dict()
    title = first_present(data, ["title", "source", "id", "community", "human_readable_id"])
    if "source" in data and "target" in data:
        title = f"{data.get('source')} -> {data.get('target')}"

    content = first_present(
        data,
        ["text", "full_content", "summary", "description", "content", "report"],
    )
    file_hint = extract_file_hint(content)
    metadata = {
        key: stringify_value(value)
        for key, value in data.items()
        if key not in {"text", "full_content", "summary", "description", "content", "report"}
    }
    if file_hint:
        metadata["file"] = file_hint

    return SourceItem(
        source_type=source_type,
        title=stringify_value(title)[:160],
        content=stringify_value(content)[:2500],
        metadata=metadata,
    )


def first_present(data: dict[str, Any], keys: list[str]) -> Any:
    """Return the first non-empty field from a dict."""

    for key in keys:
        value = data.get(key)
        if value is not None and str(value).strip():
            return value
    return ""


def stringify_value(value: Any) -> str:
    """Make values safe for Streamlit markdown display."""

    if isinstance(value, (dict, list, tuple)):
        return json.dumps(value, ensure_ascii=False, default=str)
    return str(value)


def extract_file_hint(text: str) -> str | None:
    """Extract document file metadata embedded by the indexing loader."""

    match = re.search(r"\[File:\s*([^\]]+)\]", text or "")
    return match.group(1).strip() if match else None


def is_json_parse_error(exc: Exception) -> bool:
    """Detect JSON parsing failures thrown by DRIFT primer/follow-up prompts."""

    if isinstance(exc, json.JSONDecodeError):
        return True
    text = f"{type(exc).__name__}: {exc}".lower()
    patterns = [
        "json",
        "expecting value",
        "unterminated string",
        "extra data",
        "invalid control character",
        "could not parse",
    ]
    return any(pattern in text for pattern in patterns)


def run_async(coro: Any) -> Any:
    """Run an async GraphRAG API call from a synchronous Streamlit callback."""

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        loop.set_exception_handler(_loop_exception_handler)
        try:
            asyncio.set_event_loop(loop)
            return loop.run_until_complete(coro)
        finally:
            pending = asyncio.all_tasks(loop)
            for task in pending:
                task.cancel()
            if pending:
                loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
            loop.run_until_complete(loop.shutdown_asyncgens())
            loop.run_until_complete(loop.shutdown_default_executor())
            asyncio.set_event_loop(None)
            loop.close()
    raise RuntimeError("이미 실행 중인 event loop 안에서는 동기 search()를 사용할 수 없음")


def _loop_exception_handler(loop: asyncio.AbstractEventLoop, context: dict[str, Any]) -> None:
    """Suppress noisy DRIFT JSON task logs while preserving other loop errors."""

    exc = context.get("exception")
    if isinstance(exc, Exception) and is_json_parse_error(exc):
        return
    loop.default_exception_handler(context)
