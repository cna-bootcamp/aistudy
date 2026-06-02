"""Groq LPU 채팅 모델 공용 팩토리.

라우팅(Scheduler)·벡터 답변 생성·Supervisor 평가가 동일한 방식으로 ChatGroq를 만들도록
한곳에 모음. 두 가지 미묘한 파라미터를 일관되게 처리함.

  - reasoning_format="hidden" : gpt-oss 계열 '추론 모델' 전용. 사고 과정을 숨기고 최종 답변만
    반환함. 일반 모델에 전달하면 안 되므로 모델명에 'gpt-oss'가 있을 때만 조건부로 추가함.
  - with_structured_output(method="json_schema") : 구조화 출력(라우팅 결정·충분성 판정)에 사용.
    gpt-oss-120b가 이 방식을 지원함(실측 확인). 미지원 모델은 첫 호출에서 400으로 크래시함.
"""
from __future__ import annotations

from typing import Any

from langchain_groq import ChatGroq

from config.settings import Settings


def build_chat_llm(settings: Settings, *, max_tokens: int | None = None,
                   temperature: float | None = None) -> ChatGroq:
    """Groq LPU에 연결된 ChatGroq 인스턴스를 생성함.

    Args:
        settings: 전역 설정(모델명·키·온도).
        max_tokens: 응답 토큰 한도(미지정 시 모델 기본값).
        temperature: 샘플링 온도(미지정 시 settings.llm_temperature).
    """
    kwargs: dict[str, Any] = {
        "model": settings.llm_model,
        "api_key": settings.groq_api_key,
        "temperature": settings.llm_temperature if temperature is None else temperature,
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    # gpt-oss 계열에만 reasoning_format을 전달 (다른 모델에 넣으면 무시되거나 오류)
    if "gpt-oss" in settings.llm_model:
        kwargs["reasoning_format"] = "hidden"
    return ChatGroq(**kwargs)


def build_structured_llm(settings: Settings, schema: Any):
    """구조화 출력 전용 LLM을 생성함 — with_structured_output(method="json_schema").

    라우팅 결정·근거 충분성 판정처럼 '정해진 키를 가진 JSON'을 안정적으로 받아야 하는 곳에서 사용함.
    method="json_schema"는 모델에 JSON 스키마를 강제해, 자연어에서 JSON을 파싱하는 불안정성을 제거함.
    """
    return build_chat_llm(settings, max_tokens=512).with_structured_output(
        schema, method="json_schema"
    )
