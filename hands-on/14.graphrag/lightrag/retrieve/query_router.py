"""질문을 LightRAG 검색 모드로 라우팅하는 모듈.

Auto 모드는 규칙 기반 패턴 매칭을 먼저 수행하고, 확신도가 낮으면 Groq LPU Few-shot 라우터로 보정함.
"""
# 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함
from __future__ import annotations

import logging
import re

from config.settings import Settings
from llm_client import GroqChatClient
from models import ALL_MODES, RouterDecision

logger = logging.getLogger(__name__)


class QueryRouter:
    """사용자 질문에 적합한 검색 모드 선택."""

    def __init__(self, settings: Settings, llm_client: GroqChatClient | None = None):
        self.settings = settings
        self.llm_client = llm_client

    def route(self, question: str, selected_mode: str = "auto") -> RouterDecision:
        """수동 모드는 그대로 사용하고, Auto 모드는 패턴 → LLM fallback 순서로 결정."""
        if selected_mode != "auto":
            if selected_mode not in ALL_MODES:
                raise ValueError(f"지원하지 않는 검색 모드: {selected_mode}")
            return RouterDecision(selected_mode, 1.0, "사용자 수동 선택", "manual")

        decision = self._pattern_route(question)
        if decision.confidence >= self.settings.router_confidence_threshold:
            return decision

        fallback = self._llm_route(question)
        if fallback:
            return fallback

        logger.warning("라우터 fallback 실패, 패턴 결과 사용: %s", decision)
        if decision.confidence > 0:
            return decision
        return RouterDecision("hybrid", 0.5, "명확한 패턴 없음, 권장 기본값 사용", "default")

    def _pattern_route(self, question: str) -> RouterDecision:
        """키워드와 문장 패턴으로 1차 검색 모드 판단."""
        q = question.lower().strip()
        scores = {mode: 0.0 for mode in ("naive", "local", "global", "hybrid", "mix", "code")}
        reasons: dict[str, list[str]] = {mode: [] for mode in scores}

        self._add_score(q, scores, reasons, "code", 0.95, [
            r"\.py\b", r"\bdef\b", r"\bclass\b", r"\bimport\b", "예제코드", "소스", "구현", "streamlit",
            "fastapi", "함수", "클래스", "파일", "코드",
        ])
        self._add_score(q, scores, reasons, "global", 0.82, [
            "전체", "전반", "흐름", "트렌드", "핵심 주제", "큰 그림", "요약", "로드맵", "테마", "동향",
        ])
        self._add_score(q, scores, reasons, "hybrid", 0.86, [
            "차이", "비교", "장단점", "관계", "연계", "적용 시나리오", "언제", "왜", "trade-off", "트레이드오프",
        ])
        self._add_score(q, scores, reasons, "local", 0.78, [
            "무엇", "정의", "구성요소", "원리", "동작 방식", "설명", "란?", "란 무엇", "어떻게 동작",
        ])
        self._add_score(q, scores, reasons, "naive", 0.80, [
            "단순 벡터", "벡터 검색", "키워드 검색", "원문 청크", "기존 rag", "naive",
        ])
        self._add_score(q, scores, reasons, "mix", 0.76, [
            "종합", "관련 패턴", "연결 구조", "그래프와 벡터", "전체 결합", "mix",
        ])

        mode, score = max(scores.items(), key=lambda item: item[1])
        reason = ", ".join(reasons[mode]) if reasons[mode] else "명확한 규칙 매칭 없음"
        return RouterDecision(mode, min(score, 0.95), reason, "pattern")

    @staticmethod
    def _add_score(
        q: str,
        scores: dict[str, float],
        reasons: dict[str, list[str]],
        mode: str,
        score: float,
        patterns: list[str],
    ) -> None:
        """패턴이 하나라도 매칭되면 해당 모드 점수와 사유 추가."""
        for pattern in patterns:
            matched = re.search(pattern, q) if pattern.startswith("\\") or "\\b" in pattern else pattern in q
            if matched:
                scores[mode] = max(scores[mode], score)
                reasons[mode].append(pattern.replace("\\b", ""))

    def _llm_route(self, question: str) -> RouterDecision | None:
        """Groq LPU Few-shot 프롬프트로 낮은 확신도 질문 라우팅."""
        if self.llm_client is None:
            return None

        system_prompt = (
            "검색 라우터입니다. 질문을 다음 모드 중 하나로 분류하고 JSON만 반환하세요: "
            "naive, local, global, hybrid, mix, code. "
            "code는 예제 Python 코드 검색, local은 구체 개념, global은 넓은 주제, "
            "hybrid는 비교/관계, mix는 그래프+벡터 종합, naive는 단순 청크 벡터 검색입니다."
        )
        user_prompt = f"""
예시:
Q: REST API와 gRPC의 차이와 적용 시나리오는?
{{"mode":"hybrid","confidence":0.90,"reason":"비교와 적용 시나리오 질문"}}
Q: Streamlit 채팅 예제 코드는 어디에 있나?
{{"mode":"code","confidence":0.95,"reason":"예제코드 검색 질문"}}
Q: GraphRAG 전체 흐름을 요약해줘
{{"mode":"global","confidence":0.88,"reason":"전체 흐름 질문"}}
Q: LightRAG의 QueryParam은 무엇인가?
{{"mode":"local","confidence":0.82,"reason":"구체 개념 설명 질문"}}

분류할 질문:
{question}
"""
        try:
            data = self.llm_client.complete_json(system_prompt, user_prompt)
        except Exception as exc:
            logger.warning("LLM 라우터 실패: %s", exc)
            return None

        mode = str(data.get("mode", "")).strip().lower()
        if mode not in ("naive", "local", "global", "hybrid", "mix", "code"):
            return None
        try:
            confidence = float(data.get("confidence", 0.7))
        except (TypeError, ValueError):
            confidence = 0.7
        reason = str(data.get("reason", "LLM Few-shot 라우팅"))
        return RouterDecision(mode, max(0.0, min(confidence, 1.0)), reason, "llm-few-shot")
