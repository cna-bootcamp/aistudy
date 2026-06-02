"""LightRAG 검색 파이프라인 전역 설정 모듈

Streamlit 검색 UI, LightRAG working_dir, 예제코드 벡터 인덱스, Groq LPU LLM,
Ollama 임베딩 설정을 한곳에서 관리함.
"""
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

# 프로세스 시작 시각을 한 번만 기록 — Streamlit 재실행 시에도 동일한 타임스탬프 유지
_LOG_TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

from dotenv import load_dotenv

# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
_CONFIG_DIR = Path(__file__).resolve().parent
_RETRIEVE_DIR = _CONFIG_DIR.parent
_LIGHTRAG_ROOT = _RETRIEVE_DIR.parent
_HANDS_ON_DIR = _LIGHTRAG_ROOT.parent.parent
_WORKSPACE_ROOT = _HANDS_ON_DIR.parent


def _env_int(name: str, default: int) -> int:
    """환경변수를 정수로 변환하고, 값이 없거나 잘못되면 기본값 반환."""
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    """환경변수를 실수로 변환하고, 값이 없거나 잘못되면 기본값 반환."""
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


# @dataclass: 설정 필드를 가진 클래스를 초기화 가능한 데이터 객체로 변환함
@dataclass
class Settings:
    """검색 파이프라인 설정값 모음."""

    retrieve_dir: Path = field(default_factory=lambda: _RETRIEVE_DIR)
    lightrag_root: Path = field(default_factory=lambda: _LIGHTRAG_ROOT)
    hands_on_dir: Path = field(default_factory=lambda: _HANDS_ON_DIR)
    workspace_root: Path = field(default_factory=lambda: _WORKSPACE_ROOT)
    hands_on_env: Path = field(default_factory=lambda: _HANDS_ON_DIR / ".env")
    kg_dir: Path = field(default_factory=lambda: _LIGHTRAG_ROOT / "store" / "kg")
    code_vector_dir: Path = field(default_factory=lambda: _LIGHTRAG_ROOT / "store" / "vector" / "code")
    log_dir: Path = field(default_factory=lambda: _RETRIEVE_DIR / "logs")

    ollama_base_url: str = "http://localhost:11434"
    embedding_model: str = "qwen3-embedding"
    embedding_dim: int = 4096
    embedding_max_token_size: int = 8192

    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model: str = "openai/gpt-oss-120b"
    groq_timeout: int = 60
    groq_max_retries: int = 1
    groq_max_tokens: int = 2048

    llm_max_async: int = 2
    chunk_token_size: int = 1200
    chunk_overlap_token_size: int = 100

    top_k: int = 8
    chunk_top_k: int = 6
    max_entity_tokens: int = 4000
    max_relation_tokens: int = 6000
    max_total_tokens: int = 18000

    code_top_k: int = 5
    code_score_threshold: float = 0.15
    code_context_max_chars: int = 10000
    router_confidence_threshold: float = 0.72

    def __post_init__(self) -> None:
        """공용 .env와 로컬 .env를 로드한 뒤 환경변수로 기본값 오버라이드."""
        # hands-on/.env에서 GROQ_API_KEY 등 민감 정보를 로드함
        if self.hands_on_env.exists():
            load_dotenv(self.hands_on_env)

        local_env = self.retrieve_dir / ".env"
        if local_env.exists():
            load_dotenv(local_env, override=True)

        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", self.ollama_base_url)
        self.embedding_model = os.getenv("EMBEDDING_MODEL", self.embedding_model)
        self.groq_api_key = os.getenv("GROQ_API_KEY", self.groq_api_key)
        self.groq_base_url = os.getenv("GROQ_BASE_URL", self.groq_base_url)
        self.groq_model = os.getenv("GROQ_MODEL", self.groq_model)

        self.groq_timeout = _env_int("GROQ_TIMEOUT", self.groq_timeout)
        self.groq_max_retries = _env_int("GROQ_MAX_RETRIES", self.groq_max_retries)
        self.groq_max_tokens = _env_int("GROQ_MAX_TOKENS", self.groq_max_tokens)
        self.top_k = _env_int("LIGHTRAG_TOP_K", self.top_k)
        self.chunk_top_k = _env_int("LIGHTRAG_CHUNK_TOP_K", self.chunk_top_k)
        self.code_top_k = _env_int("CODE_TOP_K", self.code_top_k)
        self.code_score_threshold = _env_float("CODE_SCORE_THRESHOLD", self.code_score_threshold)
        self.router_confidence_threshold = _env_float(
            "ROUTER_CONFIDENCE_THRESHOLD", self.router_confidence_threshold
        )

        self.log_dir.mkdir(parents=True, exist_ok=True)

    @property
    def code_vdb_file(self) -> Path:
        """예제코드 nano-vectordb JSON 파일 경로 반환."""
        return self.code_vector_dir / "vdb_code.json"

    @property
    def retrieve_log_file(self) -> Path:
        """검색 로그 파일 경로 반환 — 실행마다 새 파일 생성."""
        return self.log_dir / f"retrievelog_{_LOG_TIMESTAMP}.log"
