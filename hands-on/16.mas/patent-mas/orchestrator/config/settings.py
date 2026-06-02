"""오케스트레이터(상위 SAS) 전역 설정 모듈.

분산 MAS의 상위 계층(Orchestrator)이 단위 MAS A/B/C를 조율하는 데 필요한
경로·모델·통신 엔드포인트·글로벌 Budget·타임아웃을 한곳에서 관리함.
다른 모듈은 이 모듈의 settings 인스턴스를 import 하여 사용하므로, 값 변경 시 여기만 수정하면 됨.
(MUST: 이 파일의 주석은 한글로 설정의 의미를 설명함)

[제약(MUST NOT)] 로컬 AI 모델 사용 금지 — LLM은 Groq LPU, 임베딩은 OpenAI(클라우드)만 사용함.
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# 경로 기준점 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)
# ---------------------------------------------------------------------------
# 이 파일: hands-on/16.mas/patent-mas/orchestrator/config/settings.py
#   _CONFIG_DIR(=orchestrator/config) 기준 parents:
#   [0]=orchestrator, [1]=patent-mas, [2]=16.mas, [3]=hands-on
_CONFIG_DIR = Path(__file__).resolve().parent          # 이 파일이 위치한 디렉터리(orchestrator/config)
ORCH_DIR = _CONFIG_DIR.parent                          # orchestrator/ (이 프로젝트 루트)
PATENT_MAS_DIR = ORCH_DIR.parent                       # patent-mas/ (단위 MAS들의 부모)
HANDS_ON_DIR = _CONFIG_DIR.parents[3]                  # hands-on/ (공용 .env 위치)
ENV_PATH = HANDS_ON_DIR / ".env"                       # 공용 .env (GROQ/OPENAI/LAW_OC/YOUTUBE 키)

# 단위 MAS 프로젝트 루트 (B/C 서브프로세스 워커 실행 시 sys.path·venv 도출에 사용)
MAS_A_DIR = PATENT_MAS_DIR / "mas-a"
MAS_B_DIR = PATENT_MAS_DIR / "mas-b"
MAS_C_DIR = PATENT_MAS_DIR / "mas-c"
# B/C 워커 스크립트 (오케스트레이터가 서브프로세스로 기동하는 진입점)
WORKER_B_SCRIPT = ORCH_DIR / "workers" / "mas_b_worker.py"
WORKER_C_SCRIPT = ORCH_DIR / "workers" / "mas_c_worker.py"


def _venv_python(mas_dir: Path) -> str:
    """단위 MAS 디렉터리에서 그 단위 'venv 파이썬' 실행 파일 경로를 찾음.

    분산 MAS의 핵심: 각 단위 워커를 '그 단위의 venv 파이썬'으로 실행해야 의존성·패키지명 충돌이 없음.
    Windows는 venv/Scripts/python.exe, macOS/Linux는 venv/bin/python 에 위치함.
    둘 다 없으면 현재 인터프리터로 폴백(권장하지 않음 — venv 미설정 신호).
    """
    candidates = [
        mas_dir / "venv" / "Scripts" / "python.exe",   # Windows
        mas_dir / "venv" / "bin" / "python",           # macOS/Linux
    ]
    for path in candidates:
        if path.exists():
            return str(path)
    import sys
    return sys.executable


@dataclass
class Settings:
    """상위 SAS 오케스트레이션 전역 설정 (환경변수로 일부 오버라이드 가능)."""

    # === 경로 / 워커 실행기 ===
    env_path: Path = field(default_factory=lambda: ENV_PATH)
    worker_b_script: Path = field(default_factory=lambda: WORKER_B_SCRIPT)
    worker_c_script: Path = field(default_factory=lambda: WORKER_C_SCRIPT)
    # 단위 MAS별 venv 파이썬 경로 (서브프로세스 워커 기동에 사용)
    mas_b_python: str = field(default_factory=lambda: _venv_python(MAS_B_DIR))
    mas_c_python: str = field(default_factory=lambda: _venv_python(MAS_C_DIR))

    # === LLM (Groq LPU, 클라우드) — Scheduler 의도분류·Supervisor 검증·답변 합성에 공통 사용 ===
    # gpt-oss-120b 는 with_structured_output(method="json_schema")를 지원함(단위 MAS에서 실측 확인)
    llm_model: str = "openai/gpt-oss-120b"
    llm_temperature: float = 0.0                       # 재현 가능한(결정적) 라우팅·검증 응답
    llm_max_tokens: int = 1400                         # 답변 합성 시 토큰 한도
    # gpt-oss 계열 추론 모델 전용 — 사고 과정을 숨기고 최종 텍스트만 받음 (MUST: 'hidden')
    llm_reasoning_format: str = "hidden"
    # Groq 일시 오류(429/503)에 지수 백오프 재시도 (의도분류·검증·합성이 여러 번 호출되므로 넉넉히)
    llm_max_retries: int = 5

    # === MAS A 통신 (MCP 클라이언트 — Streamable HTTP) ===
    mcp_a_host: str = "127.0.0.1"
    mcp_a_port: int = 8010                             # mas-a/server.py 기본 바인딩 포트와 동일해야 함

    # === 글로벌 Budget (교재 §7.5 — Agent 폭주/예산 초과 완화) ===
    # 한 요청(워크플로) 전체의 한도. 초과 시 Supervisor Kill-switch 가 분기 디스패치를 차단함.
    # max_calls 가 1차(결정적) 통제 기준이고, max_tokens 는 길이 기반 추정(보조 지표)임.
    budget_max_calls: int = 8                          # 단위 MAS 호출 총 횟수 한도 (A/B/C 합산)
    budget_max_tokens: int = 120_000                   # 추정 토큰 한도 (응답 길이÷4 누적, 보조 지표)
    budget_max_depth: int = 2                          # 호출 중첩 깊이 한도 (상위→단위 1단계)
    # 분기별 예산 분배 비율 — A∥B 병렬 분기에 각 35%, C(취합)에 30% 배정 (나머지는 Scheduler 여유)
    budget_ratio_per_branch: float = 0.35
    budget_ratio_mas_c: float = 0.30

    # === 계층적 타임아웃 (교재 §7.7) — 분기별 < 워크플로 ===
    timeout_mas_a: int = 180                           # MAS A(MCP) 1회 호출 타임아웃(초)
    timeout_mas_b: int = 240                           # MAS B(워커) 1회 호출 타임아웃(초, 웹·유튜브 검색 포함)
    timeout_mas_c: int = 240                           # MAS C(워커) 1회 호출 타임아웃(초, 작성·검증·재작성 포함)

    # === Loop Guard (교재 §7.3) ===
    # Supervisor가 부분 실패 시 재디스패치하는 최대 횟수 (무한 재시도 방지). 0=재시도 안 함.
    max_redispatch: int = 1

    # === HITL 데모/검증용 토글 (기본 off) ===
    # True 면 MAS C 결과를 무조건 escalated 로 표시해 글로벌 HITL(human_review interrupt)을 강제 발화함.
    # 실제 의견서는 보통 게이트를 통과해 HITL이 잘 안 걸리므로, HITL 승인 패널 흐름을 시연·검증할 때만 켬.
    # 환경변수 ORCH_FORCE_ESCALATE=1 로 활성화 (mas-c 의 reject_first 데모 토글과 같은 성격).
    force_escalate: bool = False

    # === 멀티턴 / 그래프 ===
    history_turns: int = 6                             # 프롬프트에 포함할 직전 대화 메시지 수
    recursion_limit: int = 50                          # LangGraph 단계 한계(기본 25) 상향 — 재디스패치 여유

    # === API 키 (.env에서 로드) ===
    groq_api_key: str = ""

    def __post_init__(self) -> None:
        """공용 .env를 로드하고 일부 기본값을 환경변수로 오버라이드함."""
        # override=True: 셸 환경변수보다 .env 값을 우선해 실행 환경 차이를 줄임
        if self.env_path.exists():
            load_dotenv(self.env_path, override=True)
        self.groq_api_key = os.getenv("GROQ_API_KEY", self.groq_api_key)
        self.llm_model = os.getenv("ORCH_LLM_MODEL", self.llm_model)
        self.mcp_a_host = os.getenv("MCP_HOST", self.mcp_a_host)
        self.mcp_a_port = _env_int("MCP_PORT", self.mcp_a_port)
        # ORCH_FORCE_ESCALATE 가 1/true/yes 면 HITL 강제 발화 (데모/검증용)
        self.force_escalate = os.getenv("ORCH_FORCE_ESCALATE", "").strip().lower() in ("1", "true", "yes")

    @property
    def mcp_a_url(self) -> str:
        """MAS A FastMCP 서버의 Streamable HTTP 엔드포인트 URL."""
        return f"http://{self.mcp_a_host}:{self.mcp_a_port}/mcp"

    def ensure_api_keys(self) -> None:
        """LLM 호출 전에 키 존재를 먼저 검증 — 미설정 시 즉시 명확한 오류를 냄."""
        if not self.groq_api_key.strip():
            raise RuntimeError(f"GROQ_API_KEY 미설정. {self.env_path} 파일을 확인하세요.")


def _env_int(name: str, default: int) -> int:
    """정수 환경변수를 읽고 값이 없거나 형식이 틀리면 기본값 반환."""
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


# 전역 설정 인스턴스 (모듈 임포트 시 1회 생성, 다른 모듈에서 'from config.settings import settings'로 사용)
settings = Settings()
