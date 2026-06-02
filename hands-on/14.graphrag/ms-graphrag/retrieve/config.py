"""Runtime configuration for the Microsoft GraphRAG retrieval app."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from graphrag.config.load_config import load_config
from graphrag.config.models.graph_rag_config import GraphRagConfig


RETRIEVE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = RETRIEVE_DIR.parent
INDEXING_DIR = PROJECT_DIR / "indexing"
PARQUET_DIR = PROJECT_DIR / "store" / "parquet"
GRAPHRAG_VECTOR_DIR = PROJECT_DIR / "store" / "vector" / "graphrag"
CODE_VECTOR_DIR = PROJECT_DIR / "store" / "vector" / "code"
HANDS_ON_DIR = PROJECT_DIR.parents[1]
ENV_PATH = HANDS_ON_DIR / ".env"

# 프로세스 시작 시각을 한 번만 기록 — Streamlit 재실행 시에도 동일한 타임스탬프 유지
_LOG_TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_DIR = RETRIEVE_DIR / "logs"
RETRIEVE_LOG_FILE = LOG_DIR / f"retrievelog_{_LOG_TIMESTAMP}.log"


@dataclass(frozen=True)
class RetrieveSettings:
    """User-tunable settings for query-time retrieval."""

    llm_model: str = os.getenv("GRAPHRAG_QUERY_MODEL", "openai/gpt-oss-120b")
    embedding_model: str = os.getenv("GRAPHRAG_EMBEDDING_MODEL", "qwen3-embedding")
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    response_type: str = os.getenv(
        "GRAPHRAG_RESPONSE_TYPE",
        "한국어로 근거를 포함해 간결하게 답변",
    )
    community_level: int = int(os.getenv("GRAPHRAG_COMMUNITY_LEVEL", "2"))
    graph_top_sources: int = int(os.getenv("GRAPHRAG_GRAPH_TOP_SOURCES", "8"))
    code_top_k: int = int(os.getenv("GRAPHRAG_CODE_TOP_K", "5"))
    router_min_confidence: float = float(os.getenv("GRAPHRAG_ROUTER_MIN_CONFIDENCE", "0.65"))
    drift_json_retries: int = int(os.getenv("GRAPHRAG_DRIFT_JSON_RETRIES", "3"))
    dynamic_global_selection: bool = os.getenv("GRAPHRAG_DYNAMIC_GLOBAL_SELECTION", "false").lower() == "true"


settings = RetrieveSettings()


def load_environment() -> None:
    """Load hands-on/.env so GraphRAG can expand GROQ_API_KEY."""

    load_dotenv(ENV_PATH, override=True)


def load_query_config(query_model: str | None = None) -> GraphRagConfig:
    """Load GraphRAG settings.yaml and switch query-time LLM to the retrieval model."""

    load_environment()
    config = load_config(INDEXING_DIR)
    model_name = query_model or settings.llm_model

    for model_config in config.completion_models.values():
        model_config.model = model_name

    return config


def validate_paths() -> list[str]:
    """Return missing required paths as user-friendly strings."""

    required = [
        PARQUET_DIR / "entities.parquet",
        PARQUET_DIR / "relationships.parquet",
        PARQUET_DIR / "communities.parquet",
        PARQUET_DIR / "community_reports.parquet",
        PARQUET_DIR / "text_units.parquet",
        GRAPHRAG_VECTOR_DIR,
        CODE_VECTOR_DIR,
        ENV_PATH,
    ]
    return [str(path) for path in required if not path.exists()]

