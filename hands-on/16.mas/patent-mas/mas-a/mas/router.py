"""Scheduler 라우터 — "요청에 따라 적절한 검색 모드를 결정"하는 단계.

규칙 기반 패턴 매칭으로 먼저 모드를 고르고, 확신도가 낮으면 Groq LPU LLM 구조화 분류로 폴백함.
노출 모드는 과제 명세대로 4종: vector / local / global / drift (+ 호출자 auto).
키워드는 특허법 도메인에 맞춤 — 조문 원문/정의는 vector, 요건·권리·절차의 관계/구조는 GraphRAG.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field

from config.llm import build_structured_llm
from config.settings import Settings

logger = logging.getLogger(__name__)

# 노출되는 검색 모드 (auto는 라우터가 자동 결정)
RESOLVED_MODES = ("vector", "local", "global", "drift")
GRAPHRAG_MODES = ("local", "global", "drift")

# 조문 직접 참조 패턴 ("제29조", "제 132 조의2") → 정밀 인용(vector) 강한 신호
_ARTICLE_REF_RE = re.compile(r"제\s*\d+\s*조")


@dataclass(frozen=True)
class RouteDecision:
    """라우터가 선택한 검색 모드와 근거."""

    mode: str
    confidence: float
    reason: str
    used_llm_fallback: bool = False


class _LLMRoute(BaseModel):
    """LLM 구조화 분류 출력 스키마 (with_structured_output method='json_schema')."""

    mode: Literal["vector", "local", "global", "drift"] = Field(description="검색 모드")
    confidence: float = Field(description="0.0~1.0 확신도")
    reason: str = Field(description="선택 근거(한국어 한 문장)")


class QueryRouter:
    """패턴 우선 + LLM 폴백 라우터 (특허법 도메인)."""

    # 모드별 키워드 — 질문에 등장하면 해당 모드 점수를 1씩 올림
    KEYWORDS: dict[str, tuple[str, ...]] = {
        # 조문 원문 정밀 인용: 특정 조문/정의/문구 조회
        "vector": (
            "조문", "원문", "조항", "정의", "무엇", "뭐야", "뜻", "의미", "규정",
            "몇 조", "몇조", "인용", "문구", "내용은", "어떻게 규정", "명시",
        ),
        # 엔티티 관계/근접 컨텍스트: 요건·권리·절차 사이의 연결
        "local": (
            "관계", "연결", "연관", "관련", "의존", "요건", "권리", "절차", "처분",
            "기관", "주체", "누가", "사이", "영향", "조건", "해당",
        ),
        # 커뮤니티 요약/전체 구조
        "global": (
            "전체", "전반", "요약", "흐름", "구조", "개요", "종류", "유형", "목록",
            "비교", "차이", "정리", "주요", "큰 그림", "체계",
        ),
        # 복합·다단계 추론
        "drift": (
            "종합", "복합", "단계별", "다단계", "관점", "시사점", "왜", "근거를 종합",
            "전 과정", "통합적",
        ),
    }

    # 호출자 모드 문자열 → 내부 모드 키 정규화
    MODE_ALIASES = {
        "auto": "auto", "vector": "vector", "local": "local",
        "global": "global", "drift": "drift",
    }

    def __init__(self, settings: Settings):
        self.settings = settings
        self.min_confidence = settings.router_min_confidence
        self._llm = None  # 구조화 LLM 지연 생성 (auto 폴백이 필요할 때만)

    def normalize_mode(self, mode: str) -> str:
        """호출자 입력 모드를 내부 키로 정규화함 (알 수 없으면 auto)."""
        return self.MODE_ALIASES.get((mode or "auto").lower().strip(), "auto")

    def route(self, query: str, requested_mode: str = "auto") -> RouteDecision:
        """수동 지정 또는 auto 규칙에 따라 검색 모드를 결정함."""
        mode = self.normalize_mode(requested_mode)
        if mode != "auto":
            return RouteDecision(mode, 1.0, "호출자가 모드를 직접 지정함")

        decision = self._route_by_pattern(query)
        if decision.confidence >= self.min_confidence:
            return decision

        fallback = self._route_by_llm(query)
        return fallback or decision

    def best_graphrag_mode(self, query: str) -> str:
        """GraphRAG 보완 검색 시, local/global/drift 중 패턴 점수가 높은 모드를 고름(기본 local)."""
        scores = self._score(query)
        graph_scores = {m: scores[m] for m in GRAPHRAG_MODES}
        best = max(graph_scores, key=graph_scores.get)
        return best if graph_scores[best] > 0 else "local"

    # -- 내부 구현 ----------------------------------------------------------

    def _score(self, query: str) -> dict[str, float]:
        """모드별 키워드 매칭 점수를 계산함."""
        normalized = query.lower()
        scores: dict[str, float] = {mode: 0.0 for mode in RESOLVED_MODES}
        for mode, keywords in self.KEYWORDS.items():
            for keyword in keywords:
                if keyword in normalized:
                    scores[mode] += 1.0
        # 조문 직접 참조는 정밀 인용(vector) 강한 신호로 가중
        if _ARTICLE_REF_RE.search(query):
            scores["vector"] += 1.5
        return scores

    def _route_by_pattern(self, query: str) -> RouteDecision:
        scores = self._score(query)
        best_mode = max(scores, key=scores.get)
        best_score = scores[best_mode]
        total = sum(scores.values()) or 1.0
        confidence = min(0.95, max(0.3, best_score / total))
        matched = [kw for kw in self.KEYWORDS[best_mode] if kw in query.lower()]
        reason = (
            f"패턴 매칭: {', '.join(matched) or '조문 참조'}"
            if best_score > 0 else "패턴 근거 부족"
        )
        return RouteDecision(best_mode, confidence, reason)

    def _route_by_llm(self, query: str) -> RouteDecision | None:
        """패턴 확신도가 낮을 때 LLM 구조화 분류로 폴백함 (실패 시 None)."""
        if self._llm is None:
            self._llm = build_structured_llm(self.settings, _LLMRoute)
        prompt = (
            "당신은 한국 특허법 질의의 검색 모드 분류기임. 다음 중 하나로만 분류하라.\n"
            "- vector: 특정 조문 원문/정의/문구 조회 (정밀 인용)\n"
            "- local: 요건·권리·절차·기관 등 엔티티 사이의 관계/근접 컨텍스트\n"
            "- global: 전체 주제·구조·유형의 요약 (커뮤니티 단위)\n"
            "- drift: 복합·다단계 추론 (전체 primer + 세부 결합)\n\n"
            f"질문: {query}"
        )
        try:
            result = self._llm.invoke(prompt)
            confidence = min(max(float(result.confidence), 0.0), 1.0)
            return RouteDecision(result.mode, confidence, f"LLM 분류: {result.reason}", True)
        except Exception as exc:  # 폴백 실패는 치명적이지 않으므로 패턴 결과를 사용
            logger.warning("라우터 LLM 폴백 실패: %s", exc)
            return None
