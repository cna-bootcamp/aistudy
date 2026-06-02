"""LangChain 여행 플래너 예제에서 공통으로 사용하는 환경변수 로드 헬퍼."""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import os
from pathlib import Path

from dotenv import load_dotenv

# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
HANDS_ON_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


def load_hands_on_env() -> None:
    """hands-on/.env를 로드하여 모든 예제가 공통 키 파일을 공유하도록 함."""
    # .env 파일에서 API 키 등 환경변수를 로드함
    load_dotenv(HANDS_ON_ENV_PATH)


def require_api_key(env_name: str) -> str:
    """환경변수에서 API 키를 읽어 반환. 미설정 시 Streamlit UI용 명확한 오류 발생."""
    load_hands_on_env()
    api_key = os.getenv(env_name, "")
    # API 키 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함
    if not api_key:
        raise RuntimeError(f"{env_name}가 설정되지 않았습니다: {HANDS_ON_ENV_PATH}")
    return api_key
