"""GraphRAG 인덱싱 시스템 설정

settings.yaml을 단일 소스로 사용하며, Python 전용 설정(경로, 상수)만 추가 정의함.

데이터소스 인덱싱 전략 (분리):
  - 교재 (agentic-ai/textbook/*.md) → GraphRAG 파이프라인(KG + Vector) 입력
  - 예제코드 (hands-on/**/*.py)      → 별도 벡터 인덱스(Vector만, KG 미생성)

LLM: Groq LPU openai/gpt-oss-120b (빠른 추론)
Embeddings: Ollama qwen3-embedding (로컬 임베딩, 4096차원)

설정 우선순위: settings.yaml > 이 파일의 기본값
"""
import os                                      # 환경변수 접근용
from pathlib import Path                       # 파일 경로 처리용
from dataclasses import dataclass, field       # 데이터 클래스 정의용

import yaml                                     # settings.yaml 파싱용
from dotenv import load_dotenv                 # .env 로드용


# ---------------------------------------------------------------------------
# 경로 기준점 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)
# ---------------------------------------------------------------------------
# settings.py 위치: ms-graphrag/indexing/config/settings.py
# _CONFIG_DIR(=indexing/config) 기준 parents:
#   [0]=indexing, [1]=ms-graphrag, [2]=14.graphrag, [3]=hands-on, [4]=aistudy
_CONFIG_DIR = Path(__file__).resolve().parent  # 이 파일이 위치한 config 디렉터리를 절대경로로 구함
INDEXING_DIR = _CONFIG_DIR.parent              # indexing/ (graphrag index --root 대상)
PROJECT_ROOT = INDEXING_DIR.parent             # ms-graphrag/
HANDS_ON_DIR = _CONFIG_DIR.parents[3]          # hands-on/ (예제코드 루트 + .env 위치)
AISTUDY_DIR = _CONFIG_DIR.parents[4]           # aistudy/ (저장소 루트, 교재 경로 기준)

# hands-on/.env 로드 (GROQ_API_KEY 등). override=True로 셸 환경변수보다 .env를 우선함
_ENV_PATH = HANDS_ON_DIR / ".env"
load_dotenv(_ENV_PATH, override=True)


def _load_yaml_config() -> dict:
    """indexing/settings.yaml을 로드함.

    GraphRAG CLI가 사용하는 settings.yaml을 Python 코드에서도 동일하게 참조하기 위함.

    Returns:
        YAML 설정 딕셔너리 (파일 없으면 빈 딕셔너리)
    """
    yaml_path = INDEXING_DIR / "settings.yaml"
    if yaml_path.exists():
        # with 블록을 벗어나면 파일이 자동으로 닫힘
        with open(yaml_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}


_yaml = _load_yaml_config()  # 모듈 로드 시 한 번만 YAML을 읽어 전역에 캐싱함


def _get_yaml(key_path: str, default=None):
    """중첩 키를 점(.) 표기법으로 접근함.

    예: "completion_models.default_completion_model.model"
        → _yaml["completion_models"]["default_completion_model"]["model"]

    Args:
        key_path: 점으로 구분된 키 경로
        default: 키가 없을 때 반환할 기본값

    Returns:
        찾은 값 또는 기본값
    """
    value = _yaml
    for key in key_path.split("."):
        if isinstance(value, dict):
            value = value.get(key)
        else:
            return default
        if value is None:
            return default
    return value


@dataclass
class Settings:
    """시스템 전역 설정.

    yaml에 있는 값은 yaml에서 읽고, yaml에 없는 Python 전용 값만 직접 정의함.
    """

    # === 프로젝트 경로 (Python 전용) ===
    project_root: Path = field(default_factory=lambda: PROJECT_ROOT)         # ms-graphrag/
    indexing_dir: Path = field(default_factory=lambda: INDEXING_DIR)         # indexing/

    # GraphRAG 입력 디렉터리 (settings.yaml input_storage.base_dir="data/input" 과 일치)
    input_dir: Path = field(default_factory=lambda: INDEXING_DIR / "data" / "input")

    # 출력 스토어 경로 (settings.yaml output_storage.base_dir="../store/parquet" 과 일치)
    parquet_dir: Path = field(default_factory=lambda: PROJECT_ROOT / "store" / "parquet")
    # GraphRAG 벡터 스토어 (settings.yaml vector_store.db_uri="../store/vector/graphrag" 과 일치)
    graphrag_vector_dir: Path = field(default_factory=lambda: PROJECT_ROOT / "store" / "vector" / "graphrag")
    # 예제코드 전용 벡터 스토어 (KG 미생성, code_indexer.py가 구축)
    code_vector_dir: Path = field(default_factory=lambda: PROJECT_ROOT / "store" / "vector" / "code")

    # === 데이터소스 경로 (Python 전용) ===
    textbook_dir: Path = field(default_factory=lambda: AISTUDY_DIR / "agentic-ai" / "textbook")  # 교재(*.md)
    code_dir: Path = field(default_factory=lambda: HANDS_ON_DIR)                                  # 예제코드(*.py) 루트

    # === yaml에서 읽는 설정 ===
    # LLM 모델명 (Groq LPU, GraphRAG 인덱싱 시 엔티티/관계 추출·요약에 사용)
    llm_model: str = field(default_factory=lambda: _get_yaml(
        "completion_models.default_completion_model.model", "openai/gpt-oss-120b"))
    # 임베딩 모델명 (Ollama, 벡터 임베딩 생성용)
    embedding_model: str = field(default_factory=lambda: _get_yaml(
        "embedding_models.default_embedding_model.model", "qwen3-embedding"))
    # Ollama API 베이스 URL
    ollama_base_url: str = field(default_factory=lambda: _get_yaml(
        "embedding_models.default_embedding_model.api_base", "http://localhost:11434"))

    # === .env에서 읽는 설정 ===
    # 임베딩 벡터 차원 (LanceDB 스키마·검증과 일치해야 함, qwen3-embedding=4096)
    embedding_dim: int = field(default_factory=lambda: int(os.getenv("EMBEDDING_DIM", "4096")))
    # Groq API 키 (settings.yaml의 ${GROQ_API_KEY}와 동일 소스, CLI가 .env에서 읽음)
    groq_api_key: str = field(default_factory=lambda: os.getenv("GROQ_API_KEY", ""))


# 전역 설정 인스턴스 (모듈 임포트 시 자동 생성)
# 다른 모듈에서 'from config.settings import settings'로 사용
settings = Settings()
