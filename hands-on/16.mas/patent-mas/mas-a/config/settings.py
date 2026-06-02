"""특허법 법령지식 MAS(mas-a) 전역 설정 모듈.

선행 구축된 두 인덱스를 '재임베딩 없이' 그대로 조회하는 데 필요한 경로·모델·검색
파라미터를 한곳에서 관리함. 두 인덱스는 서로 다른 역할로 공존함 (중복 검색 금지).

  - 조문 벡터 RAG  : ChromaDB 컬렉션 `patent_law` → 조문 원문 정밀 인용
                     (OpenAI text-embedding-3-small, 1536차원)
  - MS GraphRAG    : Parquet + LanceDB → 요건·권리·절차의 관계/커뮤니티 구조 질의
                     (Local / Global / DRIFT Search)

제약(MUST NOT): 로컬 AI 모델 사용 금지 — LLM(Groq LPU)·임베딩(OpenAI) 모두 클라우드 API.
"""
from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# 경로 기준점 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)
# ---------------------------------------------------------------------------
# settings.py 위치: hands-on/16.mas/patent-mas/mas-a/config/settings.py
# _CONFIG_DIR(=mas-a/config) 기준 parents:
#   [0]=mas-a, [1]=patent-mas, [2]=16.mas, [3]=hands-on, [4]=aistudy
_CONFIG_DIR = Path(__file__).resolve().parent       # mas-a/config
MAS_DIR = _CONFIG_DIR.parent                          # mas-a (이 MAS 프로젝트 루트)
PATENT_MAS_DIR = MAS_DIR.parent                       # patent-mas
INDEXING_DIR = PATENT_MAS_DIR / "indexing"            # patent-mas/indexing (선행 인덱싱 산출물)
HANDS_ON_DIR = _CONFIG_DIR.parents[3]                 # hands-on (.env 위치)

# 공용 .env (hands-on/.env) — OPENAI_API_KEY(임베딩), GROQ_API_KEY(LLM)를 보관함
ENV_PATH = HANDS_ON_DIR / ".env"

# --- 조문 벡터 RAG (ChromaDB) 인덱스 경로 ---
# indexing/vector/store 안에 chroma.sqlite3가 있음. naive RAG와 동일하게 영속 모드로 연결함.
VECTOR_STORE_DIR = INDEXING_DIR / "vector" / "store"

# --- MS GraphRAG 인덱스 경로 ---
# GraphRAG는 settings.yaml의 vector_store.db_uri(store/vector/graphrag)를 '루트' 기준 상대경로로
# 해석하므로, load_config()에는 반드시 이 루트의 '절대경로'를 넘겨야 함(빈 컨텍스트 트랩 방지).
GRAPHRAG_ROOT = INDEXING_DIR / "graphrag"                       # settings.yaml 위치 = --root
GRAPHRAG_PARQUET_DIR = GRAPHRAG_ROOT / "store" / "parquet"      # entities/relationships/communities 등
GRAPHRAG_VECTOR_DIR = GRAPHRAG_ROOT / "store" / "vector" / "graphrag"  # LanceDB 임베딩 테이블


@dataclass
class Settings:
    """검색 파이프라인 + MAS 워크플로 + MCP 서버 전역 설정.

    환경변수로 오버라이드 가능한 값은 __post_init__에서 .env/셸 환경변수로 덮어씀.
    """

    # === 경로 (Python 전용) ===
    env_path: Path = field(default_factory=lambda: ENV_PATH)               # 공용 .env
    vector_store_dir: Path = field(default_factory=lambda: VECTOR_STORE_DIR)  # ChromaDB 디렉터리
    graphrag_root: Path = field(default_factory=lambda: GRAPHRAG_ROOT)        # GraphRAG --root(절대경로)
    graphrag_parquet_dir: Path = field(default_factory=lambda: GRAPHRAG_PARQUET_DIR)
    graphrag_vector_dir: Path = field(default_factory=lambda: GRAPHRAG_VECTOR_DIR)

    # === 조문 벡터 RAG 설정 ===
    collection_name: str = "patent_law"               # 인덱싱과 동일해야 검색 가능 (컬렉션명 고정)
    embedding_model: str = "text-embedding-3-small"   # 질의 임베딩 모델 (인덱싱과 동일, 1536차원)
    embedding_dim: int = 1536                          # 임베딩 차원 (검증 시 기대값)
    vector_top_k: int = 5                              # 유사도 상위 K개 조문 청크 (Naive RAG 통상값)

    # === GraphRAG 설정 ===
    # 커뮤니티 계층 레벨 (작을수록 상위 요약, 클수록 세분화). Global/Local/DRIFT가 공통 사용
    community_level: int = 2
    graph_top_sources: int = 6                         # GraphRAG 컨텍스트에서 노출할 최대 출처 수
    # DRIFT Search는 LLM이 JSON primer를 생성하는데, gpt-oss가 가끔 깨진 JSON을 반환함.
    # 이 횟수만큼 재시도 후에도 실패하면 Local Search로 폴백함 (graceful degradation).
    drift_json_retries: int = 2
    # GraphRAG 답변 언어·형식 지시 (response_type으로 graphrag.api에 전달됨)
    response_type: str = "한국어로 근거가 된 엔티티/관계를 포함해 간결하게 답변"

    # === LLM 설정 (Groq LPU, 클라우드) ===
    # 라우팅(구조화 출력)·벡터 답변 생성·Supervisor 평가에 공통 사용하는 모델.
    # gpt-oss-120b는 with_structured_output(method="json_schema")를 지원함(실측 확인).
    llm_model: str = "openai/gpt-oss-120b"
    llm_temperature: float = 0.0                       # 재현 가능한(결정적) 응답
    llm_max_tokens: int = 1400                         # 답변 생성 시 토큰 한도

    # === MAS 워크플로(SAS) 설정 ===
    # Supervisor가 근거 부족 시 '보완 모드'로 전환·재검색하는 최대 횟수(Loop Guard).
    # 1이면 최대 2패스(1차 + 보완 1차)까지만 수행해 무한 모드 전환을 방지함.
    supervisor_max_reroutes: int = 1
    router_min_confidence: float = 0.55                # 패턴 라우팅 확신도 임계값(미만이면 LLM 폴백)

    # === MCP 서버 바인딩 ===
    mcp_host: str = "127.0.0.1"
    mcp_port: int = 8010                               # 15.mcp/graphrag(8000)와 충돌 방지용 포트

    # === API 키 (.env에서 로드) ===
    groq_api_key: str = ""
    openai_api_key: str = ""

    def __post_init__(self) -> None:
        """공용 .env를 로드하고 환경변수로 일부 기본값을 오버라이드함."""
        # override=True: 셸 환경변수보다 .env 값을 우선해 실행 환경 차이를 줄임
        if self.env_path.exists():
            load_dotenv(self.env_path, override=True)

        self.groq_api_key = os.getenv("GROQ_API_KEY", self.groq_api_key)
        self.openai_api_key = os.getenv("OPENAI_API_KEY", self.openai_api_key)
        self.llm_model = os.getenv("MAS_LLM_MODEL", self.llm_model)
        self.embedding_model = os.getenv("MAS_EMBEDDING_MODEL", self.embedding_model)
        self.mcp_host = os.getenv("MCP_HOST", self.mcp_host)
        self.mcp_port = _env_int("MCP_PORT", self.mcp_port)
        self.vector_top_k = _env_int("MAS_VECTOR_TOP_K", self.vector_top_k)
        self.community_level = _env_int("MAS_COMMUNITY_LEVEL", self.community_level)
        self.supervisor_max_reroutes = _env_int(
            "MAS_SUPERVISOR_MAX_REROUTES", self.supervisor_max_reroutes
        )

    def ensure_api_keys(self) -> None:
        """LLM/임베딩 호출 전에 키 존재를 먼저 검증 — 미설정 시 검색 단계 401 대신 즉시 실패시킴."""
        missing = []
        if not self.groq_api_key.strip():
            missing.append("GROQ_API_KEY(LLM)")
        if not self.openai_api_key.strip():
            missing.append("OPENAI_API_KEY(임베딩)")
        if missing:
            raise RuntimeError(
                f"필수 API 키 미설정: {', '.join(missing)}. "
                f"{self.env_path} 파일을 확인하세요."
            )

    def validate_stores(self) -> list[str]:
        """선행 인덱싱 산출물이 모두 존재하는지 검사해 누락 경로를 문자열 목록으로 반환함."""
        required = [
            self.vector_store_dir / "chroma.sqlite3",          # 조문 벡터 RAG
            self.graphrag_root / "settings.yaml",              # GraphRAG 설정
            self.graphrag_parquet_dir / "entities.parquet",    # KG 엔티티
            self.graphrag_parquet_dir / "relationships.parquet",
            self.graphrag_parquet_dir / "community_reports.parquet",
            self.graphrag_parquet_dir / "text_units.parquet",
            self.graphrag_vector_dir,                          # LanceDB 임베딩 테이블 디렉터리
        ]
        return [str(path) for path in required if not path.exists()]


def _env_int(name: str, default: int) -> int:
    """정수 환경변수를 읽고 값이 없거나 형식이 틀리면 기본값 반환."""
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


# 전역 설정 인스턴스 (모듈 임포트 시 1회 생성, 다른 모듈에서 'from config import settings'로 사용)
settings = Settings()
