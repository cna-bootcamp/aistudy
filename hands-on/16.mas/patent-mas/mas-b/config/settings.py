"""MAS B(선행기술·동향 리서치) 전역 설정 모듈.

모든 경로·모델명·검색 파라미터·MCP 접속 정보를 한곳에 모아 관리함.
다른 모듈은 이 모듈의 상수를 import 하여 사용하므로, 값을 바꿀 때 여기만 수정하면 됨.
(MUST: 이 파일의 주석은 한글로 설정의 의미를 설명함)
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가 (전방 참조 허용)

import os
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)
# ---------------------------------------------------------------------------
# 이 파일: hands-on/16.mas/patent-mas/mas-b/config/settings.py
# parents[1] = mas-b/, parents[4] = hands-on/
SETTINGS_DIR = Path(__file__).resolve().parent          # config/ 디렉터리
PROJECT_DIR = SETTINGS_DIR.parent                       # mas-b/ 프로젝트 루트
HANDS_ON_DIR = SETTINGS_DIR.parents[3]                  # hands-on/ (공용 .env 위치)
ENV_PATH = HANDS_ON_DIR / ".env"                        # hands-on/.env (API 키·LAW_OC 보관)

# .env에서 GROQ_API_KEY(LLM)·OPENAI_API_KEY(임베딩)·YOUTUBE_API_KEY(영상)·LAW_OC(법제처)를 로드함
load_dotenv(ENV_PATH)

# ---------------------------------------------------------------------------
# LLM / 임베딩 모델
# ---------------------------------------------------------------------------
# Groq LPU에서 서빙하는 gpt-oss-120b — 라우팅·평가·답변 생성을 모두 담당함
LLM_MODEL = "openai/gpt-oss-120b"
# 추론(reasoning) 과정을 응답에서 숨기고 최종 텍스트만 받음 (MUST: reasoning_format='hidden')
# 스모크 테스트로 with_structured_output(method='json_schema')와 공존 가능함을 확인함
LLM_REASONING_FORMAT = "hidden"
# 라우팅·평가 등 구조화 판단을 재현 가능하게 하기 위해 온도 0으로 고정함
LLM_TEMPERATURE = 0
# Groq 일시적 오류(429 rate limit · 503 over capacity) 대비 재시도 횟수 (SDK가 지수 백오프 적용)
# Self-RAG는 한 질문에 LLM을 여러 번 호출하므로, 일시 용량 초과로 전체 그래프가 죽지 않게 넉넉히 둠
LLM_MAX_RETRIES = 5
# YouTube 자막 청크를 질의와의 유사도로 선별할 때 쓰는 임베딩 모델 (질의 벡터화 시에만 사용, 1536차원)
EMBEDDING_MODEL = "text-embedding-3-small"

# ---------------------------------------------------------------------------
# korean-law MCP (원격 Streamable HTTP 서버) 접속 정보
# ---------------------------------------------------------------------------
# 법제처 Open API 인증키. MCP 서버 URL의 oc 쿼리 파라미터로 전달됨 (.env의 LAW_OC 값)
LAW_OC = os.environ.get("LAW_OC", "")
# korean-law MCP 원격 서버 기본 엔드포인트 (Streamable HTTP, /mcp 경로)
LAW_MCP_BASE_URL = "https://korean-law-mcp.fly.dev/mcp"
# 법제처 사이트 기본 주소 — MCP가 돌려주는 상대 링크(/DRF/...)를 절대 URL로 만들 때 앞에 붙임
LAW_GO_KR_BASE = "https://www.law.go.kr"
# 판례·해석례 검색 시 가져올 결과 수 (선행기술·동향 리서치에 충분한 범위)
LAW_SEARCH_DISPLAY = 5
# MCP 도구 호출 1건의 타임아웃(초). 원격 법제처 API가 느릴 수 있어 넉넉히 둠
LAW_MCP_TIMEOUT_SECONDS = 60


def build_law_mcp_url() -> str:
    """korean-law MCP 접속 URL을 구성함 (기본 URL + oc 인증키 쿼리 파라미터).

    LAW_OC가 비어 있으면 실행 초기에 명확한 오류를 내 디버깅을 쉽게 함.
    """
    if not LAW_OC:
        raise RuntimeError(f"LAW_OC가 설정되지 않음. {ENV_PATH}의 LAW_OC 값을 확인하세요.")
    return f"{LAW_MCP_BASE_URL}?oc={LAW_OC}"


# ---------------------------------------------------------------------------
# 웹 검색 (DuckDuckGo)
# ---------------------------------------------------------------------------
WEB_MAX_RESULTS = 5          # 웹 검색 결과 수 (뉴스·시장 동향)
WEB_REGION = "ko-kr"         # 한국어/한국 지역 결과 우선
WEB_TIME = "y"               # 최근 1년 필터 (동향 리서치는 최신성이 중요)

# ---------------------------------------------------------------------------
# YouTube 검색 (Data API v3) + 자막 로드 (LangChain YoutubeLoader)
# ---------------------------------------------------------------------------
YOUTUBE_MAX_RESULTS = 5            # 영상 검색 결과 수 (강의·해설)
YOUTUBE_RECENT_DAYS = 365          # 최근 1년 영상만 검색 (publishedAfter 필터)
YOUTUBE_RELEVANCE_LANGUAGE = "ko"  # 한국어 관련 영상 우선
VIDEOS_FOR_TRANSCRIPT = 3          # 자막을 실제로 로드해 분석할 상위 영상 수 (전부 로드하면 느림)
TRANSCRIPT_LANGUAGES = ["ko", "en"]  # 자막 언어 우선순위: 한국어 → 영어
TRANSCRIPT_CHUNK_SECONDS = 120     # 자막 청킹 단위(초). 각 청크에 타임스탬프 URL(&t=초)을 부여함
TRANSCRIPT_TOP_K = 4               # 질의-청크 임베딩 코사인 유사도로 선별할 최종 자막 청크 수

# ---------------------------------------------------------------------------
# Self-RAG 워크플로우 제어
# ---------------------------------------------------------------------------
MAX_RETRIES = 3        # [IsUse] 실패 시 Query Rewriting 재시도 최대 횟수
HISTORY_TURNS = 6      # 프롬프트에 포함할 직전 대화 메시지 수 (멀티턴 맥락 유지)
RECURSION_LIMIT = 50   # 재시도 루프가 LangGraph 기본 단계 한계(25)에 걸리지 않도록 상향함


def require_env(name: str) -> str:
    """필수 환경변수를 읽고, 없으면 명확한 오류를 발생시킴 (실행 초기 빠른 실패)."""
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name}가 설정되지 않음. {ENV_PATH}를 확인하세요.")
    return value
