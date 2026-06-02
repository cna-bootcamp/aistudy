"""
Function Calling 예제에서 공통으로 사용하는 LLM 클라이언트 생성 및 API 호출 헬퍼 모음.

OpenAI, Claude, Gemini 세 가지 모델의 클라이언트 생성과 메시지 전송을 통합 제공함.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
HANDS_ON_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


def load_hands_on_env() -> Path:
    """hands-on/.env를 로드하여 모든 예제가 공통 키 파일을 공유하도록 함."""
    # .env 파일에서 API 키 등 환경변수를 로드함
    load_dotenv(HANDS_ON_ENV_PATH)
    return HANDS_ON_ENV_PATH


def require_api_key(env_name: str) -> str:
    """환경변수에서 API 키를 읽어 반환. 미설정 시 Streamlit UI용 명확한 오류 발생."""
    load_hands_on_env()
    api_key = os.getenv(env_name, "")
    if not api_key:
        raise RuntimeError(f"{env_name}가 설정되지 않았습니다: {HANDS_ON_ENV_PATH}")
    return api_key


def create_openai_client():
    """OpenAI 클라이언트를 지연 생성하여 반환. 다른 예제에서 불필요한 import 방지."""
    from openai import OpenAI

    return OpenAI(api_key=require_api_key("OPENAI_API_KEY"))


def create_claude_client():
    """Anthropic 클라이언트를 지연 생성하여 반환. 다른 예제에서 불필요한 import 방지."""
    import anthropic

    return anthropic.Anthropic(api_key=require_api_key("CLAUDE_API_KEY"))


def create_gemini_client():
    """Google Gen AI 클라이언트를 지연 생성하여 반환. 모델 간 의존성 충돌 방지."""
    from google import genai

    return genai.Client(api_key=require_api_key("GEMINI_API_KEY"))


def call_openai_chat(client: Any, *, model: str, messages: list[dict], tools: list[dict]):
    """OpenAI Chat Completions API를 tool_choice=auto로 호출하여 응답 반환."""
    return client.chat.completions.create(
        model=model,
        messages=messages,
        tools=tools,
        tool_choice="auto",
        parallel_tool_calls=True,
    )


def call_claude_messages(
    client: Any,
    *,
    model: str,
    system: str,
    messages: list[dict],
    tools: list[dict],
    max_tokens: int = 4096,
):
    """Claude Messages API를 클라이언트 사이드 도구 사용 설정으로 호출하여 응답 반환."""
    return client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        tools=tools,
        messages=messages,
    )


def call_gemini_content(client: Any, *, model: str, contents: list, tools: list, system: str):
    """Gemini generate_content API를 함수 선언(tool) 포함하여 호출하고 응답 반환."""
    from google.genai import types

    return client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            tools=tools,
            system_instruction=system,
        ),
    )
