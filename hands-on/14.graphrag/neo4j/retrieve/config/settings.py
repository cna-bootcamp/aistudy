"""LangChain + Neo4j GraphRAG 검색 설정 모듈.

Neo4j 연결, Groq LPU LLM, Ollama 임베딩, 검색 Top K 값을 한곳에서 관리함.
인덱싱 결과와 같은 Docker 볼륨(`../store/neo4j`)을 조회하는 검색 전용 설정임.
"""
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

# 프로세스 시작 시각을 한 번만 기록 — Streamlit 재실행 시에도 동일한 타임스탬프 유지
_LOG_TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

from dotenv import load_dotenv

# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함.
_CONFIG_DIR = Path(__file__).resolve().parent
_RETRIEVE_DIR = _CONFIG_DIR.parent
_NEO4J_ROOT = _RETRIEVE_DIR.parent
_HANDS_ON_DIR = _NEO4J_ROOT.parent.parent
_WORKSPACE_ROOT = _HANDS_ON_DIR.parent


def _env_int(name: str, default: int) -> int:
    """정수 환경변수를 읽고 실패 시 기본값 반환."""
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass
class Settings:
    """검색 파이프라인 전역 설정."""

    retrieve_dir: Path = field(default_factory=lambda: _RETRIEVE_DIR)
    neo4j_root: Path = field(default_factory=lambda: _NEO4J_ROOT)
    workspace_root: Path = field(default_factory=lambda: _WORKSPACE_ROOT)
    store_dir: Path = field(default_factory=lambda: _NEO4J_ROOT / "store" / "neo4j")
    hands_on_env: Path = field(default_factory=lambda: _HANDS_ON_DIR / ".env")
    local_env: Path = field(default_factory=lambda: _RETRIEVE_DIR / ".env")
    log_dir: Path = field(default_factory=lambda: _RETRIEVE_DIR / "logs")

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "password"

    ollama_base_url: str = "http://localhost:11434"
    embedding_model: str = "qwen3-embedding"
    embedding_dim: int = 4096

    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model: str = "openai/gpt-oss-120b"
    groq_timeout: int = 60
    groq_max_retries: int = 1
    groq_max_tokens: int = 2048
    groq_reasoning_effort: str = "low"

    entity_index_name: str = "entity_embedding"
    doc_index_name: str = "doc_embedding"
    entity_top_k: int = 4
    doc_top_k: int = 4
    hybrid_seed_top_k: int = 5
    hybrid_graph_limit: int = 25
    cypher_top_k: int = 20

    entity_labels: tuple[str, ...] = (
        "Concept", "Technology", "Framework", "Library", "Model", "Tool", "Task",
    )
    relationship_types: tuple[str, ...] = (
        "USES", "DEPENDS_ON", "IMPLEMENTS", "CONTAINS", "COMPARES", "EXTENDS", "PROVIDES",
        "MENTIONS",
    )

    def __post_init__(self) -> None:
        """공용 `.env`와 검색 전용 `.env`를 로드하고 환경변수로 기본값 오버라이드."""
        if self.hands_on_env.exists():
            load_dotenv(self.hands_on_env)
        if self.local_env.exists():
            load_dotenv(self.local_env, override=True)

        self.neo4j_uri = os.getenv("NEO4J_URI", self.neo4j_uri)
        self.neo4j_user = os.getenv("NEO4J_USER", self.neo4j_user)
        self.neo4j_password = os.getenv("NEO4J_PASSWORD", self.neo4j_password)
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", self.ollama_base_url)
        self.embedding_model = os.getenv("EMBEDDING_MODEL", self.embedding_model)
        self.groq_api_key = os.getenv("GROQ_API_KEY", self.groq_api_key)
        self.groq_base_url = os.getenv("GROQ_BASE_URL", self.groq_base_url)
        self.groq_model = os.getenv("GROQ_MODEL", self.groq_model)
        self.groq_timeout = _env_int("GROQ_TIMEOUT", self.groq_timeout)
        self.groq_max_retries = _env_int("GROQ_MAX_RETRIES", self.groq_max_retries)
        self.groq_max_tokens = _env_int("GROQ_MAX_TOKENS", self.groq_max_tokens)
        self.groq_reasoning_effort = os.getenv("GROQ_REASONING_EFFORT", self.groq_reasoning_effort)
        self.entity_top_k = _env_int("ENTITY_TOP_K", self.entity_top_k)
        self.doc_top_k = _env_int("DOC_TOP_K", self.doc_top_k)
        self.hybrid_seed_top_k = _env_int("HYBRID_SEED_TOP_K", self.hybrid_seed_top_k)
        self.hybrid_graph_limit = _env_int("HYBRID_GRAPH_LIMIT", self.hybrid_graph_limit)
        self.cypher_top_k = _env_int("CYPHER_TOP_K", self.cypher_top_k)

        self.log_dir.mkdir(exist_ok=True)

    @property
    def retrieve_log_file(self) -> Path:
        """검색 로그 파일 경로 반환 — 실행마다 새 파일 생성."""
        return self.log_dir / f"retrievelog_{_LOG_TIMESTAMP}.log"
