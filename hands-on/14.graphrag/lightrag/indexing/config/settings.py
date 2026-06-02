"""인덱싱 파이프라인 전역 설정 모듈 (LightRAG)

데이터소스 경로(교재·예제코드), Groq LPU LLM, Ollama 임베딩, LightRAG 저장소 설정을 한곳에 모음.
경로는 모두 이 파일 위치(__file__) 기준으로 도출해 어느 OS·작업 디렉터리에서 실행해도 동일하게 동작함.
"""
import os
from dataclasses import dataclass, field
from pathlib import Path

# load_dotenv: .env 파일의 키=값을 읽어 os.environ에 등록함
from dotenv import load_dotenv

# 이 파일 위치 기준 경로 도출
# config/settings.py → config/ → indexing/ → lightrag/ → 14.graphrag/ → hands-on/ → aistudy(워크스페이스 루트)
_CONFIG_DIR = Path(__file__).resolve().parent          # 이 파일이 위치한 디렉터리(config/)를 절대경로로 구함
_INDEXING_DIR = _CONFIG_DIR.parent                     # indexing/ (인덱싱 소스 루트, logs·check 출력 위치)
_LIGHTRAG_ROOT = _INDEXING_DIR.parent                  # lightrag/ (store/ 위치)
_HANDS_ON_DIR = _LIGHTRAG_ROOT.parent.parent           # hands-on/ (예제코드 루트 + 공용 .env)
_WORKSPACE_ROOT = _HANDS_ON_DIR.parent                 # aistudy/ (워크스페이스 루트)


@dataclass  # 설정을 구조화된 객체로 관리해 타입 안정성과 IDE 자동완성을 제공함
class Settings:
    """인덱싱 전역 설정 (경로 + Groq + Ollama + LightRAG 저장소)"""

    # --- 경로 (모두 __file__ 기준 자동 도출) ---
    # field(default_factory=...): 가변 기본값(Path)이 인스턴스 간 공유되지 않도록 인스턴스마다 새로 생성함
    indexing_dir: Path = field(default_factory=lambda: _INDEXING_DIR)
    lightrag_root: Path = field(default_factory=lambda: _LIGHTRAG_ROOT)
    workspace_root: Path = field(default_factory=lambda: _WORKSPACE_ROOT)
    # 교재(KG + Vector 인덱싱 대상): agentic-ai/textbook/*.md
    textbook_dir: Path = field(default_factory=lambda: _WORKSPACE_ROOT / "agentic-ai" / "textbook")
    # 예제코드(Vector 인덱싱 대상): hands-on/**/*.py
    examples_dir: Path = field(default_factory=lambda: _HANDS_ON_DIR)
    # 공용 .env (GROQ_API_KEY 등): hands-on/.env
    hands_on_env: Path = field(default_factory=lambda: _HANDS_ON_DIR / ".env")
    # LightRAG working_dir: GraphML KG + nano-vectordb 교재 벡터 + KV Store JSON이 자동 생성되는 위치
    kg_dir: Path = field(default_factory=lambda: _LIGHTRAG_ROOT / "store" / "kg")
    # 예제코드 전용 nano-vectordb 벡터 인덱스 저장 디렉터리 (KG 미생성)
    code_vector_dir: Path = field(default_factory=lambda: _LIGHTRAG_ROOT / "store" / "vector" / "code")

    # --- Ollama 임베딩 설정 ---
    ollama_base_url: str = "http://localhost:11434"
    # qwen3-embedding: 4096차원 로컬 임베딩 모델 (Ollama). 벡터 인덱스 차원과 반드시 일치해야 함
    embedding_model: str = "qwen3-embedding"
    embedding_dim: int = 4096
    embedding_max_token_size: int = 8192

    # --- Groq LPU LLM 설정 (OpenAI 호환 API) ---
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    # Groq LPU에서 서빙하는 OpenAI gpt-oss 120B 모델 (LightRAG의 엔티티/관계 추출용)
    # 20B 대비 대형 추출 프롬프트(다수 few-shot)에서 빈 content 반환 위험이 낮고 추출 품질이 높음
    groq_model: str = "openai/gpt-oss-120b"
    # 동시 LLM 호출 수: Groq TPM(분당 토큰) 한도 초과를 막기 위해 보수적으로 설정
    llm_max_async: int = 2

    # --- LightRAG 청킹 (교재 KG 구축, 토큰 기준) ---
    chunk_token_size: int = 1200
    chunk_overlap_token_size: int = 100

    # --- 예제코드 청킹 (nano-vectordb, 문자 기준) ---
    code_chunk_size: int = 1200       # 청크당 문자 수
    code_chunk_overlap: int = 150     # 청크 간 겹침 문자 수 (문맥 연속성 유지)
    embed_batch_size: int = 16        # 임베딩 1회 요청당 청크 수

    def __post_init__(self):
        """공용 .env 로드 후 환경변수로 기본값을 오버라이드함"""
        # hands-on/.env에서 GROQ_API_KEY 등 민감 정보 로드 (코드에 키 하드코딩 방지)
        if self.hands_on_env.exists():
            load_dotenv(self.hands_on_env)
        # 인덱싱 디렉터리에 .env가 따로 있으면 추가 로드 (모델·엔드포인트 로컬 오버라이드용)
        local_env = self.indexing_dir / ".env"
        if local_env.exists():
            load_dotenv(local_env, override=True)

        # 환경변수가 있으면 우선 적용 (없으면 위의 기본값 유지)
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", self.ollama_base_url)
        self.embedding_model = os.getenv("EMBEDDING_MODEL", self.embedding_model)
        self.groq_api_key = os.getenv("GROQ_API_KEY", self.groq_api_key)
        self.groq_base_url = os.getenv("GROQ_BASE_URL", self.groq_base_url)
        self.groq_model = os.getenv("GROQ_MODEL", self.groq_model)

        # logs 디렉터리 생성 (인덱싱 로그 파일 출력 위치)
        (self.indexing_dir / "logs").mkdir(exist_ok=True)

    @property
    def code_vdb_file(self) -> Path:
        """예제코드 nano-vectordb JSON 파일 경로."""
        return self.code_vector_dir / "vdb_code.json"

    @property
    def test_textbook_files(self) -> list:
        """테스트 모드 교재 파일 1개 (소량으로 빠른 KG 검증)."""
        return [self.textbook_dir / "05.STT.md"]

    @property
    def test_code_files(self) -> list:
        """테스트 모드 예제코드 파일 2개 (서로 다른 코드 청킹·임베딩 검증)."""
        return [
            self.examples_dir / "01.문서요약" / "summarize.py",
            self.examples_dir / "01.문서요약" / "summarize_simple.py",
        ]
