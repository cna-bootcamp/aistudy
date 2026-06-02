"""GraphRAG 검색 모드 라우터.

Auto 모드에서 규칙 기반 패턴 매칭으로 먼저 검색 모드를 고르고,
확신도가 낮으면 Groq LPU LLM Few-shot 분류로 폴백함.
"""
import logging
import re
from dataclasses import dataclass

from langchain_openai import ChatOpenAI

from config.settings import Settings

logger = logging.getLogger(__name__)


@dataclass
class RouteDecision:
    """라우터가 선택한 검색 모드와 선택 근거."""

    mode: str
    reason: str
    scores: dict[str, int]


class QueryRouter:
    """질문을 vector, graph_qa, hybrid, cypher 중 하나로 분류."""

    MODE_PATTERNS: dict[str, tuple[str, ...]] = {
        "vector": (
            "설명", "정의", "개념", "무엇", "뭐야", "뜻", "의미", "사용법", "예제", "코드",
            "what is", "define", "example",
        ),
        "graph_qa": (
            "관계", "연결", "연관", "관련", "의존", "비교", "차이", "어떤.*사용", "어떻게.*연결",
            "relationship", "compare", "depend",
        ),
        "hybrid": (
            "전체", "전반", "종합", "요약", "흐름", "구조", "주요", "모든", "정리", "overview",
            "summary", "architecture",
        ),
    }
    MANUAL_MODE_MAP = {
        "Auto": "auto",
        "Vector": "vector",
        "Vector Search": "vector",
        "Graph QA": "graph_qa",
        "Hybrid": "hybrid",
        "Hybrid Search": "hybrid",
        "Cypher": "cypher",
        "Cypher Direct": "cypher",
    }
    LLM_CLASSIFY_PROMPT = """You are a routing classifier for a GraphRAG search app.
Classify the user question into exactly one mode.

Modes:
- vector: definition, single concept lookup, implementation example, document chunk lookup
- graph_qa: relationship, connection, comparison, dependency between graph entities
- hybrid: broad summary requiring vector seed entities plus 1-hop graph expansion
- cypher: direct Cypher query written by the user

Examples:
Question: RAG란 무엇인가?
Answer: vector
Question: LangChain과 Neo4j는 어떤 관계인가?
Answer: graph_qa
Question: GraphRAG의 전체 처리 흐름을 요약해줘
Answer: hybrid
Question: MATCH (n:Concept) RETURN n.id LIMIT 5
Answer: cypher

Question: {query}
Answer with only one token: vector, graph_qa, hybrid, or cypher."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.llm = ChatOpenAI(
            model=settings.groq_model,
            base_url=settings.groq_base_url,
            api_key=settings.groq_api_key,
            temperature=0,
            timeout=settings.groq_timeout,
            max_retries=settings.groq_max_retries,
            max_completion_tokens=256,
            reasoning_effort=settings.groq_reasoning_effort,
        )

    def route(self, query: str, selected_mode: str = "Auto") -> RouteDecision:
        """수동 선택 또는 Auto 규칙에 따라 검색 모드 결정."""
        manual_mode = self.MANUAL_MODE_MAP.get(selected_mode, selected_mode).lower()
        if manual_mode != "auto":
            return RouteDecision(manual_mode, "사용자 수동 선택", {})

        if self._looks_like_cypher(query):
            return RouteDecision("cypher", "Cypher 직접 입력 패턴 감지", {"cypher": 3})

        scores = self._score_patterns(query)
        best_mode, best_score = max(scores.items(), key=lambda item: item[1])
        sorted_scores = sorted(scores.values(), reverse=True)
        second_score = sorted_scores[1] if len(sorted_scores) > 1 else 0

        if best_score >= 2 and best_score > second_score:
            reason = f"패턴 매칭 확신도 높음 ({best_mode}={best_score})"
            logger.info("라우터 패턴 선택: %s, scores=%s", best_mode, scores)
            return RouteDecision(best_mode, reason, scores)

        llm_mode = self._llm_fallback(query)
        reason = f"패턴 확신도 낮음 → LLM Few-shot 분류 ({llm_mode})"
        return RouteDecision(llm_mode, reason, scores)

    def _score_patterns(self, query: str) -> dict[str, int]:
        """모드별 정규식 패턴 매칭 점수 계산."""
        normalized = query.lower()
        scores: dict[str, int] = {}
        for mode, patterns in self.MODE_PATTERNS.items():
            scores[mode] = sum(1 for pattern in patterns if re.search(pattern, normalized))
        return scores

    def _llm_fallback(self, query: str) -> str:
        """패턴 분류가 애매할 때 LLM Few-shot 분류 수행."""
        try:
            response = self.llm.invoke(self.LLM_CLASSIFY_PROMPT.format(query=query))
            content = response.content.strip().lower()
            for mode in ("vector", "graph_qa", "hybrid", "cypher"):
                if mode in content:
                    logger.info("라우터 LLM 선택: %s", mode)
                    return mode
        except Exception as exc:
            logger.warning("라우터 LLM 분류 실패, vector 폴백: %s", exc)
        return "vector"

    @staticmethod
    def _looks_like_cypher(query: str) -> bool:
        """사용자 입력이 직접 Cypher 쿼리인지 간단히 판별."""
        stripped = query.strip()
        if not stripped:
            return False
        first_keyword = stripped.split(maxsplit=1)[0].upper()
        if first_keyword in {"SHOW", "RETURN", "WITH", "UNWIND"}:
            return True
        return first_keyword in {"MATCH", "CALL"} and bool(
            re.search(r"\bRETURN\b|\bYIELD\b", stripped, re.IGNORECASE)
        )
