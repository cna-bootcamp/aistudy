"""Groq LPU LLM 생성 공용 팩토리.

라우터·답변 생성·Cypher 생성 등 여러 곳에서 동일한 방식으로 ChatOpenAI를 만들도록 한곳에 모음.
특히 `reasoning_effort` 파라미터를 모델 종류에 따라 조건부로만 전달하는 분기를 단일화함.
"""
from langchain_openai import ChatOpenAI

from config.settings import Settings


def build_chat_llm(settings: Settings, max_completion_tokens: int | None = None) -> ChatOpenAI:
    """Groq OpenAI 호환 API에 연결된 ChatOpenAI 인스턴스를 생성함.

    reasoning_effort는 gpt-oss 같은 추론 모델 전용 파라미터임. llama-3.3-70b-versatile 등
    일반 모델에 전달하면 Groq API가 400을 반환하거나 무시하므로, 모델명에 'gpt-oss'가 포함된
    경우에만 조건부로 추가함.
    """
    # ChatOpenAI: LangChain의 OpenAI 호환 채팅 모델 래퍼. base_url을 Groq로 지정하면
    # OpenAI SDK 그대로 Groq LPU를 호출함 (llm.invoke()로 대화 요청 전송).
    kwargs: dict = {
        "model": settings.groq_model,
        "base_url": settings.groq_base_url,
        "api_key": settings.groq_api_key,
        "temperature": 0,
        "timeout": settings.groq_timeout,
        "max_retries": settings.groq_max_retries,
    }
    if max_completion_tokens is not None:
        kwargs["max_completion_tokens"] = max_completion_tokens
    if settings.groq_reasoning_effort and "gpt-oss" in settings.groq_model:
        kwargs["reasoning_effort"] = settings.groq_reasoning_effort
    return ChatOpenAI(**kwargs)
