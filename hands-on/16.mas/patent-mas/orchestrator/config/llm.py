"""Groq LPU 채팅 모델 공용 팩토리 (오케스트레이터 전용).

상위 SAS의 Scheduler(의도 분류)·Supervisor(출력 검증)·답변 합성이 동일한 방식으로 ChatGroq를
만들도록 한곳에 모음. 단위 MAS(mas-a/b/c)와 동일한 두 가지 규칙을 일관되게 적용함.

  - reasoning_format="hidden" : gpt-oss 계열 '추론 모델' 전용. 사고 과정을 숨기고 최종 답변만
    받음. 모델명에 'gpt-oss'가 있을 때만 조건부로 부여함(다른 모델에 넣으면 오류 가능).
  - with_structured_output(method="json_schema") : 구조화 출력(의도 분류·검증 판정)에 사용.
    gpt-oss-120b가 이 방식을 지원함(단위 MAS에서 실측 확인). function_calling 모드는 도구명
    오생성 위험이 있어 사용하지 않음.
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

from typing import Any

from langchain_groq import ChatGroq

from config.settings import settings


def build_chat_llm(*, max_tokens: int | None = None,
                   temperature: float | None = None) -> ChatGroq:
    """Groq LPU에 연결된 ChatGroq 인스턴스를 생성함.

    Args:
        max_tokens: 응답 토큰 한도(미지정 시 모델 기본값).
        temperature: 샘플링 온도(미지정 시 settings.llm_temperature).
    """
    # ChatGroq: LangChain Groq 채팅 모델 래퍼 (llm.invoke()로 대화 요청 전송)
    kwargs: dict[str, Any] = {
        "model": settings.llm_model,
        "api_key": settings.groq_api_key,
        "temperature": settings.llm_temperature if temperature is None else temperature,
        # Groq 일시 오류(429/503)에 지수 백오프 재시도 — 그래프 전체가 한 번 실패로 죽지 않게 함
        "max_retries": settings.llm_max_retries,
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    # gpt-oss 계열에만 reasoning_format을 전달함 (다른 모델에 넣으면 무시되거나 오류)
    if "gpt-oss" in settings.llm_model:
        kwargs["reasoning_format"] = settings.llm_reasoning_format
    return ChatGroq(**kwargs)


def build_structured_llm(schema: Any):
    """구조화 출력 전용 LLM을 생성함 — with_structured_output(method="json_schema").

    의도 분류 결과·출력 검증 판정처럼 '정해진 키를 가진 JSON'을 안정적으로 받아야 하는 곳에서 사용함.
    method="json_schema"는 모델에 JSON 스키마를 강제해, 자연어에서 JSON을 파싱하는 불안정성을 제거함.

    max_tokens=2048: gpt-oss 는 reasoning_format='hidden' 이어도 내부 추론 토큰을 소모함. 한도가 작으면
    JSON 생성 전에 토큰이 소진돼 'max completion tokens reached' 오류가 남(실측). 분류 JSON은 짧지만
    추론 여유를 넉넉히 둬 안정적으로 유효 JSON을 받음.
    """
    return build_chat_llm(max_tokens=2048).with_structured_output(schema, method="json_schema")
