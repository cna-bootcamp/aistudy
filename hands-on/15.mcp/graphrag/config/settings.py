"""GraphRAG MCP 서버 설정 모듈.

Neo4j 연결, Groq LPU LLM(llama-3.3-70b-versatile), Ollama 임베딩(qwen3-embedding 4096차원),
검색 Top K, MCP 서버 바인딩(host/port)을 한곳에서 관리함.

[Neo4j retrieve 예제 대비 변경 사항]
  - 위치가 `15.mcp/graphrag/config`로 바뀌어 hands-on/.env까지의 경로 깊이가 달라짐 → 경로 계산 수정
  - KG/벡터 DB는 새로 만들지 않고 기존 14.graphrag 스토어를 그대로 조회 → store_dir를 14.graphrag로 고정
  - 답변·라우팅 LLM을 gpt-oss → llama-3.3-70b-versatile로 교체 (reasoning_effort 미사용)
  - MCP 서버 바인딩(mcp_host/mcp_port) 설정 추가
"""
import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함.
_CONFIG_DIR = Path(__file__).resolve().parent
_PROJECT_DIR = _CONFIG_DIR.parent          # hands-on/15.mcp/graphrag
_MCP_DIR = _PROJECT_DIR.parent             # hands-on/15.mcp
_HANDS_ON_DIR = _MCP_DIR.parent            # hands-on
_WORKSPACE_ROOT = _HANDS_ON_DIR.parent     # 저장소 루트


def _env_int(name: str, default: int) -> int:
    """정수 환경변수를 읽고 값이 없거나 형식이 틀리면 기본값 반환."""
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass
class Settings:
    """검색 파이프라인 + MCP 서버 전역 설정."""

    project_dir: Path = field(default_factory=lambda: _PROJECT_DIR)
    workspace_root: Path = field(default_factory=lambda: _WORKSPACE_ROOT)
    # 기존 14.graphrag 인덱싱 결과(도커 볼륨)를 그대로 조회함 — 신규 인덱싱 없음
    store_dir: Path = field(
        default_factory=lambda: _HANDS_ON_DIR / "14.graphrag" / "neo4j" / "store" / "neo4j"
    )
    hands_on_env: Path = field(default_factory=lambda: _HANDS_ON_DIR / ".env")
    local_env: Path = field(default_factory=lambda: _PROJECT_DIR / ".env")

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "password"

    ollama_base_url: str = "http://localhost:11434"
    embedding_model: str = "qwen3-embedding"
    embedding_dim: int = 4096

    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model: str = "llama-3.3-70b-versatile"
    groq_timeout: int = 60
    groq_max_retries: int = 1
    groq_max_tokens: int = 2048
    # reasoning_effort는 gpt-oss 계열 추론 모델 전용 파라미터임. llama-3.3-70b에는 적용하지 않음
    # (config/llm.py의 build_chat_llm이 모델명에 'gpt-oss'가 있을 때만 조건부로 전달함)
    groq_reasoning_effort: str = "low"

    entity_index_name: str = "entity_embedding"
    doc_index_name: str = "doc_embedding"
    entity_top_k: int = 4
    doc_top_k: int = 4
    hybrid_seed_top_k: int = 5
    hybrid_graph_limit: int = 25
    cypher_top_k: int = 20

    mcp_host: str = "127.0.0.1"
    mcp_port: int = 8000

    # 인덱싱 시 저장된 영어 엔티티 라벨 — 벡터/그래프 검색에서 엔티티 노드를 식별하는 기준
    entity_labels: tuple[str, ...] = (
        "Concept", "Technology", "Framework", "Library", "Model", "Tool", "Task",
    )
    relationship_types: tuple[str, ...] = (
        "USES", "DEPENDS_ON", "IMPLEMENTS", "CONTAINS", "COMPARES", "EXTENDS", "PROVIDES",
        "MENTIONS",
    )

    def __post_init__(self) -> None:
        """공용 `.env`와 서버 전용 `.env`를 로드하고 환경변수로 기본값을 오버라이드함."""
        # hands-on/.env: GROQ_API_KEY 등 공용 키 (모든 예제 공유)
        if self.hands_on_env.exists():
            load_dotenv(self.hands_on_env)
        # graphrag/.env: 이 서버 전용 오버라이드 (있으면 공용 값을 덮어씀)
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
        self.mcp_host = os.getenv("MCP_HOST", self.mcp_host)
        self.mcp_port = _env_int("MCP_PORT", self.mcp_port)

    def ensure_groq_api_key(self) -> None:
        """GROQ_API_KEY 미설정 시 LLM 호출 전에 명확한 오류를 발생시켜 디버깅을 쉽게 함.

        키가 비어 있으면 답변 생성 단계에서야 401이 나므로, 서비스 초기화 시점에 먼저 차단함.
        """
        if not self.groq_api_key.strip():
            raise RuntimeError(
                "GROQ_API_KEY가 설정되지 않았습니다. "
                f"hands-on/.env 파일({self.hands_on_env})에 GROQ_API_KEY를 추가하세요."
            )
