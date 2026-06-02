"""MAS C(의견서 작성·검증) 전역 설정 모듈.

모든 경로·모델명·MCP 접속 정보·게이트 제어 파라미터를 한곳에 모아 관리함.
다른 모듈은 이 모듈의 상수를 import 하여 사용하므로, 값을 바꿀 때 여기만 수정하면 됨.
(MUST: 이 파일의 주석은 한글로 설정의 의미를 설명함)

[런타임 / 오프라인 분리 — 매우 중요]
  - 런타임(배포 경로): 순수 Groq gpt-oss-120b 만 사용함. RAGAS·OpenAI 평가자는 절대 import 하지 않음.
  - 오프라인(RAGAS 배치): evaluate/ 하위 스크립트에서만 OpenAI gpt-4o-mini 평가자를 씀(런타임 의존성 아님).
  이 settings.py 는 '런타임 전용' 설정만 담음. 오프라인 평가 상수는 evaluate/evaluate_ragas.py 에 둠.
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가 (전방 참조 허용)

import os
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)
# ---------------------------------------------------------------------------
# 이 파일: hands-on/16.mas/patent-mas/mas-c/config/settings.py
# parents[0]=config, parents[1]=mas-c, parents[2]=patent-mas, parents[3]=16.mas, parents[4]=hands-on
SETTINGS_DIR = Path(__file__).resolve().parent          # config/ 디렉터리
PROJECT_DIR = SETTINGS_DIR.parent                       # mas-c/ 프로젝트 루트
HANDS_ON_DIR = SETTINGS_DIR.parents[3]                  # hands-on/ (공용 .env 위치)
ENV_PATH = HANDS_ON_DIR / ".env"                        # hands-on/.env (API 키·LAW_OC 보관)

# .env에서 GROQ_API_KEY(LLM)·LAW_OC(법제처 MCP)를 로드함
load_dotenv(ENV_PATH)

# ---------------------------------------------------------------------------
# LLM 모델 (런타임 전용 — Groq LPU, 클라우드)
# ---------------------------------------------------------------------------
# Groq LPU에서 서빙하는 gpt-oss-120b — 초안 작성·근거성 평가·재작성을 모두 담당함
LLM_MODEL = "openai/gpt-oss-120b"
# 추론(reasoning) 과정을 응답에서 숨기고 최종 텍스트만 받음 (MUST: reasoning_format='hidden')
# mas-a/mas-b 스모크 테스트로 with_structured_output(method='json_schema')와 공존 가능함을 확인함
LLM_REASONING_FORMAT = "hidden"
# 작성·평가를 재현 가능하게(결정적으로) 하기 위해 온도 0으로 고정함
LLM_TEMPERATURE = 0
# Groq 일시적 오류(429 rate limit · 503 over capacity) 대비 재시도 횟수 (SDK가 지수 백오프 적용)
# 한 요청에 LLM을 여러 번 호출(작성·IsSup·재작성)하므로 일시 용량 초과로 전체 그래프가 죽지 않게 넉넉히 둠
LLM_MAX_RETRIES = 5

# ---------------------------------------------------------------------------
# korean-law MCP (원격 Streamable HTTP 서버) 접속 정보
# ---------------------------------------------------------------------------
# 본 MAS는 korean-law MCP를 두 용도로 사용함 (클라이언트 하나, 용도 둘):
#   1) 컨텍스트 수집(standalone 데모 프록시) : search_decisions·search_law·get_law_text
#   2) 인용 환각 탐지(런타임 게이트, MUST)    : verify_citations
LAW_OC = os.environ.get("LAW_OC", "")                   # 법제처 Open API 인증키 (MCP URL의 oc 파라미터)
LAW_MCP_BASE_URL = "https://korean-law-mcp.fly.dev/mcp"  # korean-law MCP 원격 엔드포인트 (/mcp 경로)
LAW_GO_KR_BASE = "https://www.law.go.kr"                 # 상대 링크(/DRF/...)를 절대 URL로 만들 때 앞에 붙임
LAW_SEARCH_DISPLAY = 4                                   # 판례·해석례 검색 시 가져올 결과 수
LAW_MCP_TIMEOUT_SECONDS = 60                             # MCP 도구 호출 1건의 타임아웃(초). 원격 API가 느릴 수 있어 넉넉히 둠
VERIFY_MAX_CITATIONS = 15                                # verify_citations가 검증할 최대 인용 개수 (많을수록 느림)

# 컨텍스트 길이 제한 (법령 본문이 매우 길 수 있어 프롬프트 비용을 제한함)
LAW_TEXT_MAX_CHARS = 3000      # get_law_text로 가져온 법령 조문 본문 최대 길이
CONTEXT_ITEM_MAX_CHARS = 1500  # 컨텍스트 항목 1건의 본문 최대 길이 (초안 작성 프롬프트 비용 제한)


def build_law_mcp_url() -> str:
    """korean-law MCP 접속 URL을 구성함 (기본 URL + oc 인증키 쿼리 파라미터).

    LAW_OC가 비어 있으면 실행 초기에 명확한 오류를 내 디버깅을 쉽게 함.
    """
    if not LAW_OC:
        raise RuntimeError(f"LAW_OC가 설정되지 않음. {ENV_PATH}의 LAW_OC 값을 확인하세요.")
    return f"{LAW_MCP_BASE_URL}?oc={LAW_OC}"


# ---------------------------------------------------------------------------
# 인라인 게이트 / 워크플로우 제어
# ---------------------------------------------------------------------------
# 근거 미달([IsSup]=False) 또는 인용 환각(verify_citations ✗>0) 시 재작성하는 최대 횟수.
# 이 횟수를 넘으면 무한 루프 대신 HITL로 승급(escalate)하여 사람이 판단하게 함.
MAX_REWRITES = 2
# LangGraph 기본 단계 한계(25)에 재작성 루프가 걸리지 않도록 상향함
RECURSION_LIMIT = 50
# 프롬프트에 포함할 직전 대화 메시지 수 (멀티턴 맥락 유지, 토큰·비용 제한)
HISTORY_TURNS = 6

# ---------------------------------------------------------------------------
# HITL (Human-in-the-Loop) — 법적 책임 고지문
# ---------------------------------------------------------------------------
# 의견서 확정 전 사람 승인 단계에서 함께 노출하는 법적 책임 고지.
# AI 생성물이 법률 자문을 대체하지 않음을 명시해 오·남용을 방지함(교재 §7.11 권한 오남용 / HITL).
LEGAL_DISCLAIMER = (
    "⚠️ 본 의견서 초안은 AI가 생성한 참고용 자료이며, 법적 효력이 있는 변리사·변호사의 자문을 "
    "대체하지 않습니다. 인용된 법령·판례는 자동 검증을 거쳤으나, 확정·제출 전 반드시 전문가의 "
    "최종 검토를 받으시기 바랍니다."
)


def require_env(name: str) -> str:
    """필수 환경변수를 읽고, 없으면 명확한 오류를 발생시킴 (실행 초기 빠른 실패)."""
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name}가 설정되지 않음. {ENV_PATH}를 확인하세요.")
    return value
