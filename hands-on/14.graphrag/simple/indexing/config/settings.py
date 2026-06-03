"""간단 GraphRAG 인덱싱 설정 모듈 (특허법 단일 PDF 대상)

데이터소스(특허법.pdf)·Neo4j 연결·Groq LPU LLM·OpenAI 임베딩 설정을 한곳에 모음.
경로는 모두 이 파일 위치(__file__) 기준으로 도출해 어느 OS·작업 디렉터리에서 실행해도 동일하게 동작함.

[14.graphrag/neo4j/indexing 대비 핵심 변경 사항]
  Before: 데이터소스 = 교재(*.md) + 예제코드(*.py) / 임베딩 = Ollama qwen3-embedding(4096차원)
  After : 데이터소스 = 특허법.pdf 1개 / 임베딩 = OpenAI text-embedding-3-small(1536차원)
          → agentic-rag 챗봇과 동일 임베딩으로 통일해 Ollama 의존성을 제거함
"""
import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# 이 파일 위치 기준 경로 도출
# config/settings.py → config/ → indexing/ → simple/ → 14.graphrag/ → hands-on/ → aistudy(워크스페이스 루트)
_CONFIG_DIR = Path(__file__).resolve().parent          # 이 파일이 위치한 디렉터리(config/)를 절대경로로 구함
_INDEXING_DIR = _CONFIG_DIR.parent                     # indexing/ (인덱싱 소스 루트, logs·check 출력 위치)
_SIMPLE_ROOT = _INDEXING_DIR.parent                    # simple/ (docker-compose.yml·store/ 위치)
_HANDS_ON_DIR = _SIMPLE_ROOT.parent.parent             # hands-on/ (공용 .env + 10.rag 데이터 위치)
_WORKSPACE_ROOT = _HANDS_ON_DIR.parent                 # aistudy/ (워크스페이스 루트)


@dataclass  # 설정을 구조화된 객체로 관리해 타입 안정성과 IDE 자동완성을 제공함
class Settings:
    """인덱싱 전역 설정 (경로 + Neo4j + Groq + OpenAI 임베딩)"""

    # --- 경로 (모두 __file__ 기준 자동 도출) ---
    # field(default_factory=...): 가변 기본값(Path)이 인스턴스 간 공유되지 않도록 인스턴스마다 새로 생성함
    indexing_dir: Path = field(default_factory=lambda: _INDEXING_DIR)
    simple_root: Path = field(default_factory=lambda: _SIMPLE_ROOT)
    workspace_root: Path = field(default_factory=lambda: _WORKSPACE_ROOT)
    # 데이터소스: 특허법 PDF (10.rag 예제와 공유하는 원본 문서)
    pdf_path: Path = field(default_factory=lambda: _HANDS_ON_DIR / "10.rag" / "data" / "특허법.pdf")
    # Neo4j Docker 볼륨 마운트 루트 (검증·안내용, 실제 마운트는 docker-compose.yml이 담당)
    store_dir: Path = field(default_factory=lambda: _SIMPLE_ROOT / "store" / "neo4j")
    # 공용 .env (GROQ_API_KEY·OPENAI_API_KEY 등): hands-on/.env
    hands_on_env: Path = field(default_factory=lambda: _HANDS_ON_DIR / ".env")

    # --- Neo4j 연결 설정 (docker-compose.yml 기본값과 일치) ---
    # 14.graphrag/neo4j 예제(7474/7687)와 동시 실행해도 충돌하지 않도록 포트를 분리함 (7475/7688)
    neo4j_uri: str = "bolt://localhost:7688"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "password"

    # --- OpenAI 임베딩 설정 (agentic-rag 챗봇과 동일 모델) ---
    # text-embedding-3-small: 1536차원. 인덱싱과 질의 임베딩의 모델·차원이 반드시 일치해야 검색이 동작함
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536

    # --- Groq LPU LLM 설정 (OpenAI 호환 API) ---
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    # Groq LPU에서 서빙하는 OpenAI gpt-oss 120B 모델 (LLMGraphTransformer의 엔티티/관계 추출용)
    groq_model: str = "openai/gpt-oss-120b"
    # Groq API 타임아웃(초) + 재시도 횟수 (네트워크 지연 대응)
    groq_timeout: int = 60
    groq_max_retries: int = 1
    # gpt-oss는 추론(reasoning) 토큰을 소비하는 모델이라, 추론이 길면 함수호출 출력이 길이 제한에 걸려
    # "Could not parse response content as the length limit was reached" 오류로 추출이 0개가 됨(실측).
    # reasoning_effort="low"로 추론 토큰을 줄이고, max_completion_tokens를 넉넉히 줘 추출 결과가 잘리지 않게 함.
    groq_reasoning_effort: str = "low"
    groq_max_tokens: int = 8000

    # --- KG 구축 설정 ---
    # 청크 크기: LLMGraphTransformer는 작은 청크에서 추출 정확도가 높음 (법령 조문 기준 800자 권장)
    chunk_size: int = 800
    # 청크 간 120자 중복으로 경계에서 잘린 조문의 문맥 연속성 유지
    chunk_overlap: int = 120
    # 배치 크기: 문서를 10건 단위로 비동기 변환 (메모리·요청 수 제어)
    batch_size: int = 10
    # 도메인 온톨로지(영어 필수) — LLMGraphTransformer 내부 프롬프트가 영어라 LLM이 영어 타입을 반환함.
    # 한국어로 지정하면 strict_mode 필터링에서 Silent Failure 발생 (특허법 도메인 엔티티 타입)
    allowed_nodes: list = field(default_factory=lambda: [
        "Concept", "Requirement", "Procedure", "Right", "Organization", "Person", "Document",
    ])
    allowed_relationships: list = field(default_factory=lambda: [
        "REQUIRES", "DEFINES", "APPLIES_TO", "GRANTS", "REFERS_TO", "PART_OF", "PRECEDES",
    ])
    # strict_mode=False: allowed_* 목록을 힌트로만 사용해 그 외 엔티티/관계도 허용 (재현율 우선)
    strict_mode: bool = False
    # ignore_tool_usage=False: 네이티브 함수호출(tool calling) 경로로 추출 (node_properties 지원).
    # gpt-oss-120b는 구조화 출력 능력이 높아 함수호출 경로가 동작함(실측). 이 모드에서만 node_properties
    # (엔티티 description 추출)가 지원되어 entity_embedding 품질이 향상됨.
    # → gpt-oss-20b로 바꿀 경우 함수호출이 실패하므로 ignore_tool_usage=True(프롬프트 추출)로 바꿔야 함.
    ignore_tool_usage: bool = False

    def __post_init__(self):
        """공용 .env 로드 후 환경변수로 기본값을 오버라이드함"""
        # hands-on/.env에서 GROQ_API_KEY·OPENAI_API_KEY 등 민감 정보 로드 (코드에 키 하드코딩 방지)
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
        self.embedding_model = os.getenv("EMBEDDING_MODEL", self.embedding_model)
        self.groq_api_key = os.getenv("GROQ_API_KEY", self.groq_api_key)
        self.groq_base_url = os.getenv("GROQ_BASE_URL", self.groq_base_url)
        self.groq_model = os.getenv("GROQ_MODEL", self.groq_model)
        self.groq_reasoning_effort = os.getenv("GROQ_REASONING_EFFORT", self.groq_reasoning_effort)

        # logs 디렉터리 생성 (인덱싱 로그 파일 출력 위치)
        (self.indexing_dir / "logs").mkdir(exist_ok=True)
