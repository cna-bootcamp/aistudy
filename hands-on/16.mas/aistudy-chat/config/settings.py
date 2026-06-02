"""aistudy-chat MAS 전역 설정 모듈

Agentic AI 학습지원 멀티에이전트 챗봇의 모든 경로·LLM·검색·Supervisor 설정을 한곳에서 관리함.
- LLM/임베딩 런타임: Ollama (qwen3:8b, qwen3-embedding)
- KG + Vector DB: 기존 Microsoft GraphRAG 산출물 재사용 (hands-on/14.graphrag/ms-graphrag/store)
- 워크플로: LangGraph StateGraph + SAS(Scheduler-Agent-Supervisor) 패턴
"""
from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv  # .env 파일의 환경변수를 로드하는 함수

# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함 (config/)
_CONFIG_DIR = Path(__file__).resolve().parent
# 프로젝트 루트 (aistudy-chat/)
_PROJECT_DIR = _CONFIG_DIR.parent
# hands-on 디렉터리 (aistudy-chat → 16.mas → hands-on)
_HANDS_ON_DIR = _PROJECT_DIR.parent.parent
# 기존 Microsoft GraphRAG 인덱싱 산출물 루트 (KG + Vector DB)
_STORE_DIR = _HANDS_ON_DIR / "14.graphrag" / "ms-graphrag" / "store"

# 공용 .env 로드 — GROQ_API_KEY, YT_WEBSHARE_* 등 민감 정보를 환경변수로 주입함
# .env 미존재 시에도 오류 없이 진행 (프록시·API 키는 선택 사항)
_ENV_PATH = _HANDS_ON_DIR / ".env"
if _ENV_PATH.exists():
    load_dotenv(_ENV_PATH)


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
    """시스템 전역 설정 — 경로, LLM, 검색 파라미터를 중앙에서 관리."""

    # === 프로젝트 경로 ===
    # 프로젝트 루트 (aistudy-chat/)
    project_dir: Path = field(default_factory=lambda: _PROJECT_DIR)
    # hands-on 디렉터리 (공용 .env 위치)
    hands_on_dir: Path = field(default_factory=lambda: _HANDS_ON_DIR)
    # 생성된 코드 저장 디렉터리 (Code Agent 출력)
    output_dir: Path = field(default_factory=lambda: _PROJECT_DIR / "output")
    # 로그 파일 저장 디렉터리
    logs_dir: Path = field(default_factory=lambda: _PROJECT_DIR / "logs")

    # === 기존 GraphRAG 스토어 경로 (KG + Vector DB 재사용) ===
    # Parquet 산출물 디렉터리 (text_units / entities / relationships / communities 등)
    parquet_dir: Path = field(default_factory=lambda: _STORE_DIR / "parquet")
    # 교재 임베딩 LanceDB (text_unit_text / entity_description / community_full_content 테이블)
    graphrag_vector_dir: Path = field(default_factory=lambda: _STORE_DIR / "vector" / "graphrag")
    # 예제코드 임베딩 LanceDB (code_chunks 테이블)
    code_vector_dir: Path = field(default_factory=lambda: _STORE_DIR / "vector" / "code")

    # === Ollama (모델 런타임) ===
    # Ollama 서버 주소 (로컬 설치 시 기본값)
    ollama_base_url: str = "http://localhost:11434"
    # 텍스트 생성 LLM 모델 — 요청 스펙에 따라 qwen3:8b 사용
    llm_model: str = "qwen3:8b"
    # 임베딩 모델 — 스토어 인덱싱과 동일해야 벡터 공간이 일치함 (qwen3-embedding=4096차원)
    embedding_model: str = "qwen3-embedding"
    # 임베딩 벡터 차원 (qwen3-embedding 고정값)
    embedding_dim: int = 4096

    # === LLM 생성 파라미터 ===
    # 생성 온도 (0.0~1.0, 높을수록 창의적/무작위, 낮을수록 일관적)
    temperature: float = 0.7
    # 최대 생성 토큰 수 (num_predict)
    max_tokens: int = 2048
    # Ollama HTTP 요청 타임아웃(초) — 로컬 qwen3:8b는 느릴 수 있어 넉넉히 설정
    llm_timeout: int = 300

    # === RAG 검색 (LanceDB 벡터 검색) ===
    # 교재 텍스트 유닛 검색 시 반환할 청크 수
    textbook_top_k: int = 6
    # KG 엔티티 검색 시 반환할 엔티티 수 (Local Search 스타일 보강)
    entity_top_k: int = 5
    # 예제코드 검색 시 반환할 코드 청크 수
    code_top_k: int = 5
    # 컨텍스트로 넘길 청크 1건의 최대 문자 수
    context_chunk_max_chars: int = 1800

    # === 웹 검색 (DuckDuckGo + BeautifulSoup) ===
    # 웹 검색 최대 결과 수
    web_max_results: int = 4
    # 웹 페이지 본문 최대 문자 수 (메모리·토큰 절약)
    web_page_max_chars: int = 4000
    # 유효한 웹 페이지로 인정할 최소 내용 길이 (이보다 짧으면 에러 페이지로 간주)
    web_min_content_length: int = 200
    # 웹 요청 타임아웃(초)
    web_request_timeout: int = 10

    # === YouTube 검색 (scrapetube + youtube-transcript-api) ===
    # YouTube 검색 최대 결과 수
    youtube_max_results: int = 3
    # 자막을 묶을 청크 단위(초) — 120초 = 2분 단위로 문맥 보존
    youtube_chunk_seconds: int = 120
    # 자막 차단(RequestBlocked) 시 재시도 횟수
    youtube_max_retries: int = 2
    # 선호 자막 언어 (한국어 우선, 없으면 영어)
    youtube_languages: tuple[str, ...] = ("ko", "en")

    def __post_init__(self) -> None:
        """환경변수로 기본값을 오버라이드하고 출력 디렉터리를 보장함."""
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", self.ollama_base_url)
        self.llm_model = os.getenv("MAS_LLM_MODEL", self.llm_model)
        self.embedding_model = os.getenv("MAS_EMBEDDING_MODEL", self.embedding_model)
        self.llm_timeout = _env_int("MAS_LLM_TIMEOUT", self.llm_timeout)
        self.textbook_top_k = _env_int("MAS_TEXTBOOK_TOP_K", self.textbook_top_k)
        self.code_top_k = _env_int("MAS_CODE_TOP_K", self.code_top_k)
        self.web_max_results = _env_int("MAS_WEB_MAX_RESULTS", self.web_max_results)
        self.youtube_max_results = _env_int("MAS_YOUTUBE_MAX_RESULTS", self.youtube_max_results)

        # 생성 코드·로그 디렉터리는 실행 시점에 보장
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)


# === 전역 설정 인스턴스 — 다른 모듈에서 import하여 사용 ===
settings = Settings()


# ---------------------------------------------------------------------------
# Agent 정보 (SAS 패턴의 Agent 메타데이터, 라우팅/로깅용)
# ---------------------------------------------------------------------------
AGENTS = {
    "rag_agent": {
        "name": "RAG Agent",
        "role": "리서처",
        "description": "GraphRAG 교재 KG/Vector DB에서 관련 내용을 검색하여 제공",
    },
    "web_agent": {
        "name": "Web Search Agent",
        "role": "리서처",
        "description": "최신 정보·공식 문서를 DuckDuckGo로 검색하고 본문을 크롤링",
    },
    "youtube_agent": {
        "name": "YouTube Agent",
        "role": "리서처",
        "description": "튜토리얼/강의 영상을 검색하고 자막을 추출",
    },
    "code_agent": {
        "name": "Code Agent",
        "role": "개발자",
        "description": "RAG 검색 결과를 참고해 Python 코드를 생성하고 구문을 검증",
    },
}


# ---------------------------------------------------------------------------
# 질문 유형 분류 트리거 (Router/Scheduler가 code/qa 분류 시 사용하는 키워드)
# ---------------------------------------------------------------------------
QUESTION_TYPE_TRIGGERS = {
    # "code" 유형: 코드 작성 요청 키워드
    "code": [
        "코드", "작성", "구현", "만들어", "개발", "프로그램", "스크립트", "함수", "클래스",
        "예제", "샘플", "짜줘", "짜 줘", "보여줘", "보여 줘",
    ],
    # "qa" 유형: 질의응답 키워드
    "qa": [
        "설명", "뭐야", "무엇", "어떻게", "왜", "차이", "비교", "추천", "알려줘",
        "장단점", "원리", "개념", "의미",
    ],
    # "code_strong": 강한 코드 트리거 (이 키워드가 있으면 무조건 code)
    "code_strong": ["코드 작성", "코드 짜", "예제 작성", "샘플 작성", "구현해", "만들어줘", "개발해"],
}


# ---------------------------------------------------------------------------
# Supervisor 설정 (품질 평가 + 재시도 판단 기준)
# ---------------------------------------------------------------------------
SUPERVISOR_CONFIG = {
    "pass_threshold": 0.75,   # 이 점수 이상이면 통과 (요청 스펙: 0.75)
    "retry_threshold": 0.5,   # 이 점수 이상이면 쿼리 재작성, 미만이면 다른 전략
    "max_retries": 2,         # 최대 재시도 횟수 (무한 루프 방지 = Loop Guard)
}


# ---------------------------------------------------------------------------
# 재시도 전략 (Supervisor 평가 점수에 따른 재시도 방식)
# ---------------------------------------------------------------------------
RETRY_STRATEGIES = {
    "code": {
        "score >= 0.5": "query_rewrite",       # 검색 쿼리 재작성 후 재시도
        "score < 0.5": "direct_generation",    # RAG 없이 직접 생성
    },
    "qa": {
        "score >= 0.5": "query_rewrite",        # 검색 쿼리 재작성
        "score < 0.5": "reweight_sources",      # 소스 가중치 변경 (웹/유튜브 비중↑)
    },
}


# ---------------------------------------------------------------------------
# Q&A 소스 가중치 (RAG + Web + YouTube 종합 시 각 소스의 중요도)
# ---------------------------------------------------------------------------
SOURCE_WEIGHTS = {
    "default": {"rag": 0.7, "web": 0.1, "youtube": 0.2},   # 기본: 교재(RAG) 우선
    "reweight": {"rag": 0.5, "web": 0.2, "youtube": 0.3},  # 재시도: 웹/유튜브 비중 증가
}


# ---------------------------------------------------------------------------
# 웹 페이지 에러/차단 페이지 감지 정규표현식 패턴
# ---------------------------------------------------------------------------
ERROR_PAGE_PATTERNS = [
    r"access denied",
    r"403 forbidden",
    r"404 not found",
    r"page not found",
    r"please enable javascript",
    r"cloudflare",
    r"captcha",
]
