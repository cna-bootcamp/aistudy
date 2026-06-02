"""Query router for GraphRAG retrieval modes."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Literal

from llm import GraphRAGCompletion


SearchMode = Literal["auto", "basic", "local", "global", "drift", "code"]
ResolvedMode = Literal["basic", "local", "global", "drift", "code"]


MODE_LABELS: dict[str, str] = {
    "auto": "Auto",
    "basic": "Basic",
    "local": "Local",
    "global": "Global",
    "drift": "DRIFT",
    "code": "Code",
}


@dataclass(frozen=True)
class RouteDecision:
    """Final retrieval route selected for a user query."""

    mode: ResolvedMode
    confidence: float
    reason: str
    used_llm_fallback: bool = False


class QueryRouter:
    """Pattern-first router with LLM few-shot fallback for ambiguous questions."""

    def __init__(self, min_confidence: float = 0.65, llm: GraphRAGCompletion | None = None) -> None:
        self.min_confidence = min_confidence
        self.llm = llm or GraphRAGCompletion()

    def route(self, query: str, selected_mode: SearchMode) -> RouteDecision:
        """Resolve manual or auto mode into one executable retrieval mode."""

        if selected_mode != "auto":
            return RouteDecision(
                mode=selected_mode,
                confidence=1.0,
                reason=f"사용자가 {MODE_LABELS[selected_mode]} 모드를 직접 선택함",
            )

        decision = self._route_by_pattern(query)
        if decision.confidence >= self.min_confidence:
            return decision

        fallback = self._route_by_llm(query)
        if fallback is not None:
            return fallback

        return decision

    def _route_by_pattern(self, query: str) -> RouteDecision:
        normalized = query.lower()
        scores: dict[ResolvedMode, float] = {
            "basic": 0.0,
            "local": 0.0,
            "global": 0.0,
            "drift": 0.0,
            "code": 0.0,
        }
        reasons: dict[ResolvedMode, list[str]] = {mode: [] for mode in scores}

        keyword_sets: dict[ResolvedMode, list[str]] = {
            "code": [
                "코드", "예제", "소스", "함수", "클래스", "import", "streamlit",
                "app.py", ".py", "구현", "실행", "에러", "traceback", "code",
                "function", "class",
            ],
            "global": [
                "전체", "전반", "요약", "흐름", "공통", "트렌드", "주요", "핵심",
                "비교", "차이", "목록", "정리", "아키텍처", "큰 그림",
                "global", "global search", "overview", "summary",
            ],
            "drift": [
                "관계", "연결", "영향", "역할", "전략", "시사점", "종합", "복합",
                "왜", "어떻게 연결", "멀티홉", "관점", "drift", "hybrid",
                "multi-hop", "multihop",
            ],
            "local": [
                "무엇", "설명", "정의", "방법", "구성", "특징", "장점", "단점",
                "사용법", "원리", "개념", "local", "local search", "entity",
                "엔티티",
            ],
            "basic": [
                "언제", "몇", "버전", "경로", "모델명", "이름", "값", "여부",
                "설립", "단답", "간단히", "basic", "basic search",
            ],
        }

        for mode, keywords in keyword_sets.items():
            for keyword in keywords:
                if keyword in normalized:
                    scores[mode] += 1.0
                    reasons[mode].append(keyword)

        if re.search(r"\b[a-zA-Z_][\w_]*\(", query):
            scores["code"] += 1.5
            reasons["code"].append("함수 호출 형태")
        if len(query) <= 24 and scores["code"] == 0:
            scores["basic"] += 0.4
            reasons["basic"].append("짧은 단순 질의")
        if "?" in query and scores["global"] == 0 and scores["drift"] == 0:
            scores["local"] += 0.2
            reasons["local"].append("일반 설명형 질문")

        best_mode = max(scores, key=scores.get)
        best_score = scores[best_mode]
        total = sum(scores.values()) or 1.0
        confidence = min(0.95, max(0.3, best_score / total))
        reason = (
            f"패턴 매칭: {', '.join(reasons[best_mode])}"
            if reasons[best_mode]
            else "패턴 근거 부족"
        )
        return RouteDecision(best_mode, confidence, reason)

    def _route_by_llm(self, query: str) -> RouteDecision | None:
        prompt = [
            {
                "role": "system",
                "content": (
                    "You route Korean GraphRAG queries. Return only JSON with keys "
                    "mode, confidence, reason. mode must be one of basic, local, "
                    "global, drift, code. basic is simple fact/vector text-unit search. "
                    "local is entity-centered detail. global is corpus-wide theme/summary. "
                    "drift combines global primer and local follow-up. code searches Python examples."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Examples:\n"
                    "Q: GraphRAG의 전체 처리 흐름을 요약해줘\n"
                    "{\"mode\":\"global\",\"confidence\":0.86,\"reason\":\"전체 흐름 요약\"}\n"
                    "Q: Local Search는 어떤 엔티티를 중심으로 동작해?\n"
                    "{\"mode\":\"local\",\"confidence\":0.82,\"reason\":\"특정 검색 모드 상세\"}\n"
                    "Q: 예제 app.py에서 Streamlit 채팅은 어디서 처리해?\n"
                    "{\"mode\":\"code\",\"confidence\":0.91,\"reason\":\"예제 코드 위치 질의\"}\n"
                    "Q: GraphRAG와 벡터 RAG의 관계를 종합적으로 설명해줘\n"
                    "{\"mode\":\"drift\",\"confidence\":0.78,\"reason\":\"관계와 종합 추론\"}\n"
                    f"Q: {query}"
                ),
            },
        ]
        try:
            raw = self.llm.complete(prompt, temperature=0.0, max_tokens=250)
            data = self._parse_json(raw)
            mode = data.get("mode")
            if mode not in {"basic", "local", "global", "drift", "code"}:
                return None
            confidence = float(data.get("confidence", self.min_confidence))
            reason = str(data.get("reason", "LLM few-shot 라우팅"))
            return RouteDecision(mode, min(max(confidence, 0.0), 1.0), reason, True)
        except Exception:
            return None

    @staticmethod
    def _parse_json(raw: str) -> dict[str, object]:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            raise ValueError("router LLM returned no JSON object")
        return json.loads(match.group(0))
