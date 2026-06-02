"""Groq LPU OpenAI 호환 API 클라이언트 모듈."""
# 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함
from __future__ import annotations

import json
import logging
import re
from typing import Any

from lightrag.llm.openai import openai_complete_if_cache
from openai import OpenAI

from config.settings import Settings

logger = logging.getLogger(__name__)


def check_groq_key(settings: Settings) -> None:
    """GROQ_API_KEY 미설정 시 명확한 오류 발생."""
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY가 설정되지 않음. hands-on/.env 파일을 확인 필요")


def create_lightrag_llm_func(settings: Settings):
    """LightRAG query가 사용할 Groq OpenAI 호환 LLM 함수 생성."""
    async def llm_model_func(
        prompt,
        system_prompt=None,
        history_messages=None,
        keyword_extraction=False,
        **kwargs,
    ) -> str:
        """LightRAG 내부 LLM 호출을 Groq LPU로 전달."""
        kwargs.setdefault("reasoning_effort", "low")
        kwargs.setdefault("max_completion_tokens", settings.groq_max_tokens)
        return await openai_complete_if_cache(
            settings.groq_model,
            prompt,
            system_prompt=system_prompt,
            history_messages=history_messages or [],
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
            **kwargs,
        )

    return llm_model_func


class GroqChatClient:
    """라우터 fallback과 code 모드 답변 생성을 담당하는 동기 Groq 클라이언트."""

    def __init__(self, settings: Settings):
        self.settings = settings
        check_groq_key(settings)
        # OpenAI: Groq의 OpenAI 호환 API 엔드포인트를 호출하는 공식 SDK 클라이언트
        self.client = OpenAI(
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
            timeout=settings.groq_timeout,
            max_retries=settings.groq_max_retries,
        )

    def complete(self, system_prompt: str, user_prompt: str, max_tokens: int | None = None) -> str:
        """시스템/사용자 프롬프트를 Groq LPU에 보내고 텍스트 응답 반환."""
        response = self.client.chat.completions.create(
            model=self.settings.groq_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
            max_completion_tokens=max_tokens or self.settings.groq_max_tokens,
            reasoning_effort="low",
        )
        # response.choices[0].message: API 응답에서 첫 번째 후보 메시지를 꺼냄
        return response.choices[0].message.content or ""

    def complete_json(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        """LLM 응답에서 JSON 객체를 추출해 dict로 반환."""
        text = self.complete(system_prompt, user_prompt, max_tokens=256)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", text, flags=re.DOTALL)
            if not match:
                logger.warning("JSON 추출 실패: %s", text[:300])
                return {}
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                logger.warning("JSON 파싱 실패: %s", match.group(0)[:300])
                return {}

    def answer_from_context(self, question: str, context: str) -> str:
        """검색 컨텍스트만 근거로 한국어 답변 생성."""
        system_prompt = (
            "당신은 GraphRAG 교육 예제의 AI 개발자입니다. "
            "제공된 컨텍스트만 근거로 한국어로 답변하세요. "
            "컨텍스트에 없는 내용은 추정하지 말고, 부족하면 부족하다고 말하세요. "
            "코드 질문은 핵심 파일과 함수 흐름을 함께 설명하세요."
        )
        user_prompt = f"[질문]\n{question}\n\n[검색 컨텍스트]\n{context}"
        return self.complete(system_prompt, user_prompt)
