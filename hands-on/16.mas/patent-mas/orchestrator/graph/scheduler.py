"""Scheduler — 질문 의도 분류 → 단위 MAS 라우팅 (패턴 매칭 + LLM 폴백).

라우팅 패턴 예제(hands-on/15.mcp/graphrag/query/router.py)와 동일한 2단계 전략:
  1) 도메인 키워드로 의도를 점수화 — 확신도가 높으면 그대로 결정(LLM 호출 생략 → 저비용·저지연)
  2) 확신도가 낮으면 LLM Few-shot 구조화 분류로 폴백(IntentDecision, json_schema)

의도 → 단위 MAS 매핑(교재 §9.2):
  law_knowledge   (법령 개념·요건·조문)  → A 단독
  prior_art_trend (선행기술·판례·동향)   → B (법령 근거 단서가 함께 보이면 A 병렬 보강)
  opinion_drafting(의견서·서면 작성)     → A∥B 병렬 → C 취합
  chitchat        (인사·특허 외 잡담)    → 단위 MAS 미호출, 직접 답변
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import logging
import re
from dataclasses import dataclass

from config.llm import build_structured_llm
from graph.state import (
    INTENT_CHITCHAT, INTENT_LAW, INTENT_OPINION, INTENT_TREND, IntentDecision,
)

logger = logging.getLogger("orchestrator.scheduler")


@dataclass
class RouteDecision:
    """Scheduler 결정: 의도 + 활성 단위 + C 필요 여부 + 근거 + 결정 방식."""

    intent: str
    active_units: list[str]
    needs_c: bool
    reason: str
    method: str  # "pattern" | "llm"


# 의도 = opinion 을 가리키는 강한 신호 — 하나라도 있으면 의견서 작성으로 직행(A∥B→C)
_OPINION_STRONG = ("의견서", "서면", "답변서", "보정서", "준비서면", "의견 제출")
# 의견서 '작성/대응' 동사와 결합되는 신호 (위 강신호와 함께 점수 보강)
_OPINION_WEAK = ("초안", "작성", "대응", "거절이유", "거절 이유", "통지", "검토 의견")

# 법령 지식(MAS A) 신호 — 조문·요건·개념·정의
_LAW_PATTERNS = (
    "조문", "요건", "신규성", "진보성", "특허요건", "존속기간", "정의", "개념", "무엇",
    "뜻", "의미", "설명", "인용", "제\\s*\\d+\\s*조", "항을", "규정", "권리범위",
)
# 선행기술·동향(MAS B) 신호 — 판례·동향·최신·강의
_TREND_PATTERNS = (
    "판례", "선행기술", "선행 기술", "동향", "트렌드", "최근", "업계", "사례", "뉴스",
    "시장", "강의", "영상", "유튜브", "해석례", "흐름", "조사", "현황",
)
# 인사·잡담 신호
_CHITCHAT_PATTERNS = ("안녕", "고마워", "감사", "누구야", "뭐 해", "잘 지내", "테스트입니다")

_LLM_PROMPT = """You are an intent router for a distributed patent-law multi-agent system.
Classify the user question into exactly one intent and pick active unit MAS.

Intents and routing:
- law_knowledge: statute concepts/requirements/article citation → active_units=["A"], needs_c=false
- prior_art_trend: prior art, precedents, market/industry trends → active_units=["B"] (add "A" if legal grounding is clearly needed), needs_c=false
- opinion_drafting: drafting an opinion/written response/brief → active_units=["A","B"], needs_c=true
- chitchat: greeting or non-patent small talk → active_units=[], needs_c=false

Use the conversation context to resolve follow-up questions (e.g. "그럼 판례는?", "더 자세히")
by inheriting the topic of the previous turn before classifying.

[Conversation context]
{history}

[Current question]
{question}

Answer with the structured fields (intent, active_units, needs_c, reasoning in Korean)."""


class Scheduler:
    """의도 분류 + 라우팅 결정기 (패턴 우선, 확신도 낮으면 LLM 폴백)."""

    def __init__(self) -> None:
        # LLM 폴백은 확신도 낮을 때만 호출 — 지연 생성하지 않고 미리 구성해도 비용은 호출 시에만 발생
        self._router_llm = None

    def route(self, question: str, history: list | None = None) -> RouteDecision:
        """질문을 의도로 분류하고 활성 단위 MAS·C 필요 여부를 결정함."""
        normalized = question.lower()

        # 1) 의견서 강신호 — 가장 우선 (A∥B→C 전체 파이프라인을 트리거)
        if any(token in question for token in _OPINION_STRONG):
            return RouteDecision(INTENT_OPINION, ["A", "B"], True,
                                 "의견서/서면 작성 신호 감지 → A∥B 병렬 후 C 취합", "pattern")

        law_score = self._score(normalized, _LAW_PATTERNS)
        trend_score = self._score(normalized, _TREND_PATTERNS)
        chitchat_score = self._score(normalized, _CHITCHAT_PATTERNS)

        # 2) '작성/대응' 약신호 + 법령/판례 맥락이 동시에 강하면 의견서로 승격
        opinion_weak = self._score(normalized, _OPINION_WEAK)
        if opinion_weak >= 2 and (law_score + trend_score) >= 1:
            return RouteDecision(INTENT_OPINION, ["A", "B"], True,
                                 "작성·대응 신호 + 법령/판례 맥락 → 의견서 작성으로 승격", "pattern")

        # 3) 법령 vs 동향 — 점수 우위가 분명하면 패턴으로 확정
        best = max(law_score, trend_score, chitchat_score)
        if best >= 1 and best > _second_best(law_score, trend_score, chitchat_score):
            if best == chitchat_score and chitchat_score > max(law_score, trend_score):
                return RouteDecision(INTENT_CHITCHAT, [], False, "인사·잡담 신호", "pattern")
            if law_score >= trend_score:
                # 동향 단서가 함께 있으면 A에 B를 병렬 보강 (법령+동향 혼합 질문)
                units = ["A", "B"] if trend_score >= 1 else ["A"]
                return RouteDecision(INTENT_LAW if units == ["A"] else INTENT_TREND, units, False,
                                     f"법령 신호 우위(law={law_score},trend={trend_score})", "pattern")
            # 동향 우위 — 법령 근거 단서가 함께 있으면 A 병렬 보강
            units = ["B", "A"] if law_score >= 1 else ["B"]
            return RouteDecision(INTENT_TREND, units, False,
                                 f"동향 신호 우위(trend={trend_score},law={law_score})", "pattern")

        # 4) 확신도 낮음 → LLM Few-shot 구조화 분류 폴백 (대화 맥락으로 후속 질의 해소)
        return self._llm_fallback(question, history or [])

    def _llm_fallback(self, question: str, history: list) -> RouteDecision:
        """패턴 분류가 애매할 때 LLM 구조화 분류 수행(실패 시 안전하게 law_knowledge→A 폴백).

        대화 맥락(history)을 함께 넘겨 '그럼 판례는?'·'더 자세히' 같은 후속 질의를 직전 주제로 해석함.
        """
        try:
            if self._router_llm is None:
                self._router_llm = build_structured_llm(IntentDecision)
            decision: IntentDecision = self._router_llm.invoke(
                _LLM_PROMPT.format(question=question, history=_format_history(history))
            )
            units = [u for u in decision.active_units if u in ("A", "B")]
            # 잡담이 아닌데 활성 단위가 비면 최소한 A는 호출하도록 보정
            if decision.intent != INTENT_CHITCHAT and not units and not decision.needs_c:
                units = ["A"]
            logger.info("Scheduler LLM 분류: intent=%s units=%s needs_c=%s",
                        decision.intent, units, decision.needs_c)
            return RouteDecision(decision.intent, units, decision.needs_c,
                                 f"LLM 분류: {decision.reasoning}", "llm")
        except Exception as error:  # noqa: BLE001 - 분류 실패해도 그래프가 죽지 않게 안전 폴백
            logger.warning("Scheduler LLM 분류 실패, A 단독 폴백: %s", error)
            return RouteDecision(INTENT_LAW, ["A"], False,
                                 f"LLM 분류 실패 → A 단독 폴백({type(error).__name__})", "llm")

    @staticmethod
    def _score(text: str, patterns: tuple[str, ...]) -> int:
        """패턴(정규식)이 질문에 등장하는 횟수를 점수로 합산함."""
        return sum(1 for pattern in patterns if re.search(pattern, text))


def _second_best(*scores: int) -> int:
    """점수들 중 2등 값을 반환함 (1등과 동점이면 확신도 낮음으로 간주)."""
    ordered = sorted(scores, reverse=True)
    return ordered[1] if len(ordered) > 1 else 0


def _format_history(history: list) -> str:
    """직전 대화 메시지를 라우터 프롬프트용 텍스트로 변환함 (후속 질의 맥락 제공)."""
    if not history:
        return "(이전 대화 없음)"
    # 최근 4개 메시지만 사용 — 후속 질의 의도 파악에는 직전 맥락이면 충분하고 토큰도 아낌
    lines = []
    for message in history[-4:]:
        speaker = "사용자" if message.get("role") == "user" else "어시스턴트"
        # 어시스턴트 답변은 길 수 있어 앞부분만 — 주제 파악엔 충분함
        content = (message.get("content", "") or "")[:200]
        lines.append(f"{speaker}: {content}")
    return "\n".join(lines)
