"""대화 이력 기반 독립 질문 재작성 모듈."""
from __future__ import annotations

import logging

from langchain_openai import ChatOpenAI

from config.settings import Settings

logger = logging.getLogger(__name__)

_SYSTEM = (
    "주어진 대화 이력과 후속 질문을 보고, 후속 질문을 이전 대화 맥락 없이도 이해할 수 있는 "
    "독립적인 질문으로 한국어로 재작성하세요. 이미 독립적이면 그대로 반환하세요. "
    "재작성된 질문만 반환하고 설명은 생략하세요."
)


def condense_question(
    question: str,
    history: list[dict[str, str]] | None,
    settings: Settings,
) -> str:
    """대화 이력이 있을 때 후속 질문을 독립 질문으로 재작성.

    retrieval 단계에서 타원형 후속 질문("그럼 그건 몇 개야?")이 잘못 임베딩되는 문제를
    LLM 재작성으로 수정함. 실패 시 원본 질문을 그대로 반환해 서비스를 유지함.
    """
    if not history or len(history) < 2:
        return question
    history_text = "\n".join(
        f"{'사용자' if m['role'] == 'user' else '어시스턴트'}: {m['content'][:300]}"
        for m in history[-6:]
    )
    try:
        llm = ChatOpenAI(
            model=settings.groq_model,
            base_url=settings.groq_base_url,
            api_key=settings.groq_api_key,
            temperature=0,
            timeout=settings.groq_timeout,
            max_retries=1,
            max_completion_tokens=256,
        )
        response = llm.invoke([
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": f"대화 이력:\n{history_text}\n\n후속 질문: {question}"},
        ])
        condensed = response.content.strip()
        if condensed:
            logger.info("질문 재작성: '%s' → '%s'", question, condensed)
            return condensed
    except Exception as exc:
        logger.warning("질문 재작성 실패, 원본 사용: %s", exc)
    return question
