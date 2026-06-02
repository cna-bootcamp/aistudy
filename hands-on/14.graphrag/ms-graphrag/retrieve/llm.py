"""Small helpers around GraphRAG's built-in LLM completion factory."""

from __future__ import annotations

from functools import cached_property
from typing import Any

from graphrag_llm.completion import create_completion
from graphrag_llm.utils import gather_completion_response

from config import load_query_config


class GraphRAGCompletion:
    """Completion wrapper using GraphRAG's own LLM factory and model config."""

    def __init__(self, query_model: str | None = None) -> None:
        self.config = load_query_config(query_model)

    @cached_property
    def model(self) -> Any:
        model_config = self.config.get_completion_model_config(
            self.config.basic_search.completion_model_id
        )
        return create_completion(model_config)

    def complete(
        self,
        messages: str | list[dict[str, str]],
        *,
        temperature: float = 0.0,
        max_tokens: int = 1200,
    ) -> str:
        """Run a non-streaming completion and return text."""

        response = self.model.completion(
            messages=messages,
            temperature=temperature,
            max_completion_tokens=max_tokens,
        )
        return gather_completion_response(response).strip()

