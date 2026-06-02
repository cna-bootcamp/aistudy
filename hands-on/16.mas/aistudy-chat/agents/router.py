"""Router (SAS 패턴의 Scheduler 역할)

사용자 질문을 "code"(코드 작성) 또는 "qa"(질의응답)로 분류함.
1단계 키워드 분류(빠름)로 확실한 경우 즉시 결정하고, 애매하면 2단계 LLM 분류로 위임함.
"""
from __future__ import annotations

from typing import Literal, Optional

from config.settings import QUESTION_TYPE_TRIGGERS, AGENTS
from llm.ollama_llm import OllamaLLM
from utils.logger import get_logger

logger = get_logger("agents.router")


class Router:
    """질문 유형 분류 담당 (code/qa)."""

    def __init__(self, llm: Optional[OllamaLLM] = None) -> None:
        """Router 초기화 — 키워드 분류 실패 시 사용할 LLM 준비."""
        self.llm = llm or OllamaLLM()
        self.triggers = QUESTION_TYPE_TRIGGERS

    def classify_question(self, question: str) -> Literal["code", "qa"]:
        """2단계 전략으로 질문을 분류함 (키워드 → LLM)."""
        keyword_result = self._classify_by_keywords(question)
        if keyword_result:
            logger.info(f"[Router] 키워드 분류: {keyword_result}")
            return keyword_result

        logger.debug("[Router] 키워드 분류 실패 → LLM 분류 시도")
        llm_result = self._classify_by_llm(question)
        logger.info(f"[Router] LLM 분류: {llm_result}")
        return llm_result

    def _classify_by_keywords(self, question: str) -> Optional[Literal["code", "qa"]]:
        """키워드 점수 기반 분류 — 명확한 경우만 결정하고 애매하면 None 반환."""
        q = question.lower()

        # 강한 코드 트리거가 있으면 무조건 code
        for strong in self.triggers.get("code_strong", []):
            if strong in q:
                return "code"

        # 일반 키워드 점수 집계
        code_score = sum(1 for kw in self.triggers.get("code", []) if kw in q)
        qa_score = sum(1 for kw in self.triggers.get("qa", []) if kw in q)
        logger.debug(f"[Router] 키워드 점수: code={code_score}, qa={qa_score}")

        # 한쪽만 키워드가 있으면 그쪽으로 분류
        if code_score > 0 and qa_score == 0:
            return "code"
        if qa_score > 0 and code_score == 0:
            return "qa"
        # 양쪽 모두 있으면 2개 이상이고 더 많은 쪽으로 분류
        if code_score >= 2 and code_score > qa_score:
            return "code"
        if qa_score >= 2 and qa_score > code_score:
            return "qa"
        # 애매하면 LLM에 위임
        return None

    def _classify_by_llm(self, question: str) -> Literal["code", "qa"]:
        """LLM 의미 이해 기반 분류 (키워드로 애매한 경우)."""
        agent_descriptions = "\n".join(
            f"- {info['name']}: {info['description']}" for info in AGENTS.values()
        )
        system_prompt = f"""당신은 질문 분류 전문가임.
사용자 질문을 다음 두 유형 중 하나로 분류함:

1. "code": 실행 가능한 코드를 작성/생성/구현해 달라는 요청
   - "~하는 코드 작성해줘", "~ 예제 만들어줘", "~를 구현해줘", "~를 ~로 변환하는 예제"
2. "qa": 개념 설명/정보/비교/추천 요청
   - "~가 뭐야?", "~는 어떻게 동작해?", "~와 ~의 차이?", "~ 추천해줘"

참고 에이전트:
{agent_descriptions}

반드시 "code" 또는 "qa" 중 하나의 단어만 출력함."""
        prompt = f"질문: {question}\n\n분류 결과:"
        try:
            response = self.llm.generate(
                prompt=prompt, system_prompt=system_prompt, temperature=0.1, max_tokens=10
            )
            return "code" if "code" in response.strip().lower() else "qa"
        except Exception as e:
            logger.error(f"[Router] LLM 분류 실패, qa로 폴백: {e}")
            return "qa"
