"""인덱싱 파이프라인 전역 설정 모듈

데이터소스 경로(교재·예제코드), Neo4j 연결, Groq LPU LLM, Ollama 임베딩 설정을 한곳에 모음.
경로는 모두 이 파일 위치(__file__) 기준으로 도출해 어느 OS·작업 디렉터리에서 실행해도 동일하게 동작함.
"""
import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# 이 파일 위치 기준 경로 도출
# config/settings.py → config/ → indexing/ → neo4j/ → 14.graphrag/ → hands-on/ → aistudy(워크스페이스 루트)
_CONFIG_DIR = Path(__file__).resolve().parent          # 이 파일이 위치한 디렉터리(config/)를 절대경로로 구함
_INDEXING_DIR = _CONFIG_DIR.parent                     # indexing/ (인덱싱 소스 루트, logs·check 출력 위치)
_NEO4J_ROOT = _INDEXING_DIR.parent                     # neo4j/ (docker-compose.yml·store/ 위치)
_HANDS_ON_DIR = _NEO4J_ROOT.parent.parent              # hands-on/ (예제코드 루트 + 공용 .env)
_WORKSPACE_ROOT = _HANDS_ON_DIR.parent                 # aistudy/ (워크스페이스 루트)


@dataclass  # 설정을 구조화된 객체로 관리해 타입 안정성과 IDE 자동완성을 제공함
class Settings:
    """인덱싱 전역 설정 (경로 + Neo4j + Groq + Ollama)"""

    # --- 경로 (모두 __file__ 기준 자동 도출) ---
    # field(default_factory=...): 가변 기본값(Path)이 인스턴스 간 공유되지 않도록 인스턴스마다 새로 생성함
    indexing_dir: Path = field(default_factory=lambda: _INDEXING_DIR)
    neo4j_root: Path = field(default_factory=lambda: _NEO4J_ROOT)
    workspace_root: Path = field(default_factory=lambda: _WORKSPACE_ROOT)
    # 교재(KG + Vector 인덱싱 대상): agentic-ai/textbook/*.md
    textbook_dir: Path = field(default_factory=lambda: _WORKSPACE_ROOT / "agentic-ai" / "textbook")
    # 예제코드(Vector 인덱싱 대상): hands-on/**/*.py
    examples_dir: Path = field(default_factory=lambda: _HANDS_ON_DIR)
    # Neo4j Docker 볼륨 마운트 루트 (검증·안내용, 실제 마운트는 docker-compose.yml이 담당)
    store_dir: Path = field(default_factory=lambda: _NEO4J_ROOT / "store" / "neo4j")
    # 공용 .env (GROQ_API_KEY 등): hands-on/.env
    hands_on_env: Path = field(default_factory=lambda: _HANDS_ON_DIR / ".env")

    # --- Neo4j 연결 설정 (docker-compose.yml 기본값과 일치) ---
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "password"

    # --- Ollama 임베딩 설정 ---
    ollama_base_url: str = "http://localhost:11434"
    # qwen3-embedding: 4096차원 로컬 임베딩 모델 (Ollama). 벡터 인덱스 차원과 반드시 일치해야 함
    embedding_model: str = "qwen3-embedding"
    embedding_dim: int = 4096

    # --- Groq LPU LLM 설정 (OpenAI 호환 API) ---
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    # Groq LPU에서 서빙하는 OpenAI gpt-oss 120B 모델 (LLMGraphTransformer의 엔티티/관계 추출용)
    groq_model: str = "openai/gpt-oss-120b"
    # Groq API 타임아웃(초) + 재시도 횟수 (네트워크 지연 대응)
    groq_timeout: int = 60
    groq_max_retries: int = 1

    # --- KG 구축 설정 ---
    # 청크 크기: LLMGraphTransformer는 작은 청크에서 추출 정확도가 높음 (800자 권장)
    chunk_size: int = 800
    # 청크 간 100자 중복으로 경계에서 잘린 개념의 문맥 연속성 유지
    chunk_overlap: int = 100
    # 배치 크기: 문서를 10건 단위로 비동기 변환 (메모리·요청 수 제어)
    batch_size: int = 10
    # 도메인 온톨로지(영어 필수) — LLMGraphTransformer 내부 프롬프트가 영어라 LLM이 영어 타입을 반환함.
    # 한국어로 지정하면 strict_mode 필터링에서 Silent Failure 발생
    allowed_nodes: list = field(default_factory=lambda: [
        "Concept", "Technology", "Framework", "Library", "Model", "Tool", "Task",
    ])
    allowed_relationships: list = field(default_factory=lambda: [
        "USES", "DEPENDS_ON", "IMPLEMENTS", "CONTAINS", "COMPARES", "EXTENDS", "PROVIDES",
    ])
    # strict_mode=False: allowed_* 목록을 힌트로만 사용해 그 외 엔티티/관계도 허용 (재현율 우선)
    strict_mode: bool = False
    # ignore_tool_usage=False: 네이티브 함수호출(tool calling) 경로로 추출 (node_properties 지원).
    # [모델별 차이] gpt-oss-20b는 함수호출 시 Groq 검증 실패(400 json_validate_failed)로 엔티티 0개였으나,
    #   gpt-oss-120b는 구조화 출력 능력이 높아 함수호출 경로가 동작함(실측). 이 모드에서만 node_properties
    #   (엔티티 description 추출)가 지원되어 entity_embedding 품질이 향상됨.
    # → 20b로 되돌릴 경우 함수호출이 다시 실패하므로 ignore_tool_usage=True(프롬프트 추출)로 바꿔야 함.
    ignore_tool_usage: bool = False

    def __post_init__(self):
        """공용 .env 로드 후 환경변수로 기본값을 오버라이드함"""
        # hands-on/.env에서 GROQ_API_KEY 등 민감 정보 로드 (코드에 키 하드코딩 방지)
        if self.hands_on_env.exists():
            load_dotenv(self.hands_on_env)
        # 인덱싱 디렉터리에 .env가 따로 있으면 추가 로드 (Neo4j 접속정보 등 로컬 오버라이드용)
        local_env = self.indexing_dir / ".env"
        if local_env.exists():
            load_dotenv(local_env, override=True)

        # 환경변수가 있으면 우선 적용 (없으면 위의 기본값 유지)
        self.neo4j_uri = os.getenv("NEO4J_URI", self.neo4j_uri)
        self.neo4j_user = os.getenv("NEO4J_USER", self.neo4j_user)
        self.neo4j_password = os.getenv("NEO4J_PASSWORD", self.neo4j_password)
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", self.ollama_base_url)
        self.embedding_model = os.getenv("EMBEDDING_MODEL", self.embedding_model)
        self.groq_api_key = os.getenv("GROQ_API_KEY", self.groq_api_key)
        self.groq_base_url = os.getenv("GROQ_BASE_URL", self.groq_base_url)
        self.groq_model = os.getenv("GROQ_MODEL", self.groq_model)

        # logs 디렉터리 생성 (인덱싱 로그 파일 출력 위치)
        (self.indexing_dir / "logs").mkdir(exist_ok=True)
