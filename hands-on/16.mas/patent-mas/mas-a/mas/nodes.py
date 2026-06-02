"""SAS 노드 구현 — Scheduler / Agent / Supervisor / Fuse.

  - Scheduler : 검색 모드 라우팅(패턴 + LLM 폴백). 한 패스는 정확히 한 모드만 실행함.
  - Agent     : 결정된 모드로 검색 실행(vector 또는 GraphRAG local/global/drift).
  - Supervisor: 근거 충분성을 평가하고, 미흡하면 '보완 모드'로 전환·재검색을 지시함(Loop Guard).
  - Fuse      : 2패스 이상일 때 조문 원문(vector) + 관계/구조(GraphRAG) 근거를 하나로 융합함.

설계 원칙(요구사항): 벡터 RAG와 GraphRAG는 서로 다른 역할로 공존하며, 한 질의에 동시에 둘 다
실행하지 않음(중복 검색 금지). Supervisor가 보완이 필요하다고 판단할 때만 두 번째(상보적) 모드를
실행하고 그 결과를 융합함.
"""
from __future__ import annotations

import logging

from pydantic import BaseModel, Field

from config.llm import build_chat_llm, build_structured_llm
from config.settings import Settings
from mas.router import GRAPHRAG_MODES, QueryRouter
from mas.state import PatentLawState
from retrieval.graphrag_retriever import GraphRAGRetriever
from retrieval.types import SourceItem
from retrieval.vector_retriever import VectorRetriever

logger = logging.getLogger(__name__)


class _Verdict(BaseModel):
    """Supervisor 충분성 판정 출력 스키마."""

    sufficient: bool = Field(description="답변이 충분하고 정확한 근거를 갖췄는지")
    reason: str = Field(description="판정 근거(한국어 한 문장)")


def _src_to_dict(src: SourceItem) -> dict:
    """SourceItem을 MCP 응답·State 저장용 간결한 dict로 직렬화함(원문 길이 추가 제한)."""
    return {
        "type": src.source_type,
        "title": src.title,
        "content": src.content[:600],
        "metadata": src.metadata,
    }


class MASNodes:
    """검색기·라우터·LLM을 보유하고 SAS 노드 함수를 제공하는 컨테이너."""

    def __init__(self, settings: Settings, vector: VectorRetriever,
                 graphrag: GraphRAGRetriever, router: QueryRouter):
        self.settings = settings
        self.vector = vector
        self.graphrag = graphrag
        self.router = router
        self.max_reroutes = settings.supervisor_max_reroutes
        self._verdict_llm = None   # 지연 생성(첫 평가 시)
        self._fuse_llm = None      # 지연 생성(첫 융합 시)

    # === Scheduler ========================================================

    def scheduler_node(self, state: PatentLawState) -> dict:
        """검색 모드를 라우팅함 (auto면 패턴 + LLM, 그 외면 호출자 지정)."""
        question = state["question"]
        requested = state.get("requested_mode", "auto")
        decision = self.router.route(question, requested)
        logger.info("[Scheduler] mode=%s (%s)", decision.mode, decision.reason)
        return {
            "mode": decision.mode,
            "route_reason": decision.reason,
            "used_llm_fallback": decision.used_llm_fallback,
            "reroutes": 0,
        }

    # === Agent ============================================================

    def agent_node(self, state: PatentLawState) -> dict:
        """현재 모드로 검색을 실행하고 결과를 State에 누적함."""
        mode = state["mode"]
        question = state["question"]
        try:
            if mode == "vector":
                out = self.vector.search(question)
            else:
                out = self.graphrag.search(question, mode)
            sources = [_src_to_dict(s) for s in out.sources]
            logger.info("[Agent] mode=%s → sources=%d", out.mode, len(sources))
            pass_dict = {
                "mode": out.mode,
                "requested_mode": mode,
                "answer": out.answer,
                "sources": sources,
                "evidence": dict(out.evidence),
                "note": out.note,
            }
            return {
                "passes": [pass_dict],
                "tried_modes": [mode],
                "answer": out.answer,
                "sources": sources,
                "evidence": dict(out.evidence),
                "note": out.note or "",
            }
        except Exception as exc:  # 검색 실패를 잡아 깔끔한 오류 답변으로 변환(그래프 크래시 방지)
            logger.exception("[Agent] 검색 실패: mode=%s", mode)
            note = f"'{mode}' 검색 실패: {exc}"
            return {
                "passes": [{"mode": mode, "requested_mode": mode, "answer": "",
                            "sources": [], "evidence": {"sources": 0}, "note": note}],
                "tried_modes": [mode],
                "answer": "",
                "sources": [],
                "evidence": {"sources": 0},
                "note": note,
                "error": True,
            }

    # === Supervisor =======================================================

    def supervisor_node(self, state: PatentLawState) -> dict:
        """근거 충분성을 평가하고 종료/재검색/융합 중 하나를 결정함."""
        question = state["question"]
        answer = state.get("answer", "")
        sources = state.get("sources", [])
        reroutes = state.get("reroutes", 0)
        tried = state.get("tried_modes", [])
        current = state["mode"]
        pass_count = len(state.get("passes", []))

        sufficient, reason = self._judge(question, answer, sources)

        # 충분하면 종료(단일 패스) 또는 융합(다중 패스)
        if sufficient:
            return self._finish(True, reason, pass_count)

        # 부족하지만 재검색 한도 도달 → 더 전환하지 않고 마무리
        if reroutes >= self.max_reroutes:
            return self._finish(False, f"{reason} (재검색 한도 {self.max_reroutes}회 도달)", pass_count)

        # 보완 모드 선택 (없으면 마무리)
        comp = self._complementary_mode(current, tried, question)
        if comp is None:
            return self._finish(False, f"{reason} (전환 가능한 보완 모드 없음)", pass_count)

        logger.info("[Supervisor] 근거 미흡 → 보완 모드 '%s'로 재검색", comp)
        return {
            "sufficient": False,
            "supervisor_reason": f"{reason} → 보완 모드 '{comp}'로 재검색",
            "mode": comp,
            "reroutes": reroutes + 1,
            "next_step": "agent",
        }

    @staticmethod
    def _finish(sufficient: bool, reason: str, pass_count: int) -> dict:
        """종료 분기 결정 — 다중 패스면 융합, 단일 패스면 그대로 종료."""
        return {
            "sufficient": sufficient,
            "supervisor_reason": reason,
            "next_step": "fuse" if pass_count > 1 else "end",
        }

    def _complementary_mode(self, current: str, tried: list[str], question: str) -> str | None:
        """현재 모드와 상보적인(역할이 다른) 모드를 고름 — 이미 시도한 모드는 제외함."""
        if current == "vector":
            # 벡터(조문 원문)가 부족 → GraphRAG(관계/구조)로 보완
            cand = self.router.best_graphrag_mode(question)
            if cand not in tried:
                return cand
            for m in GRAPHRAG_MODES:
                if m not in tried:
                    return m
            return None
        # GraphRAG가 부족 → 벡터(조문 원문 정밀 인용)로 보완
        return "vector" if "vector" not in tried else None

    def _judge(self, question: str, answer: str, sources: list) -> tuple[bool, str]:
        """답변의 근거 충분성을 평가함 (빈 답/무출처는 LLM 호출 없이 부족 처리)."""
        if not answer or not str(answer).strip():
            return False, "답변이 비어 있음"
        if not sources:
            return False, "근거 출처가 없음"
        if self._verdict_llm is None:
            self._verdict_llm = build_structured_llm(self.settings, _Verdict)
        # 보수적 기준: 답변이 질문을 다루고 특허법 근거가 있으면 충분으로 봄(불필요한 재검색·비용 방지).
        # 명백히 부적합할 때만 보완 검색을 유발해, '서로 다른 역할의 두 검색'이 과하게 겹치지 않게 함.
        prompt = (
            "당신은 특허법 답변의 품질 감독자임. 아래 답변이 질문에 답하기에 '충분한지'만 보수적으로 판단하라.\n"
            "- 질문의 핵심을 다루고 특허법 근거(조문/개념)가 조금이라도 제시되면 sufficient=true\n"
            "- 질문과 무관하거나, 근거가 전혀 없거나, '관련 내용을 찾을 수 없다'는 취지면 sufficient=false\n"
            "- 답변이 완벽히 망라적이지 않더라도 핵심을 짚었다면 sufficient=true (사소한 누락으로 false 금지)\n\n"
            f"질문: {question}\n답변: {str(answer)[:1500]}\n출처 수: {len(sources)}"
        )
        try:
            verdict = self._verdict_llm.invoke(prompt)
            return bool(verdict.sufficient), str(verdict.reason)
        except Exception as exc:  # 평가 실패 시 보수적으로 충분 처리(무한 루프 방지)
            logger.warning("[Supervisor] 평가 LLM 실패, 현재 답변 채택: %s", exc)
            return True, f"평가 LLM 실패로 현재 답변 채택({exc})"

    # === Fuse =============================================================

    def fuse_node(self, state: PatentLawState) -> dict:
        """여러 패스(조문 원문 + 관계/구조)를 하나의 답변으로 융합함."""
        passes = state.get("passes", [])
        # 출처를 제목 기준으로 중복 제거하며 병합
        merged: dict[str, dict] = {}
        for p in passes:
            for s in p.get("sources", []):
                merged.setdefault(s["title"], s)
        sources = list(merged.values())

        fused = self._fuse_answer(state["question"], passes)
        modes = " + ".join(p.get("mode", "?") for p in passes)
        logger.info("[Fuse] %s 결과 융합 → sources=%d", modes, len(sources))
        return {
            "answer": fused,
            "sources": sources,
            "evidence": {"sources": len(sources), "passes": len(passes)},
            "note": f"{modes} 결과 융합",
        }

    def _fuse_answer(self, question: str, passes: list[dict]) -> str:
        """패스별 답변을 종합해 하나의 정확한 한국어 답변을 생성함."""
        if self._fuse_llm is None:
            self._fuse_llm = build_chat_llm(self.settings, max_tokens=self.settings.llm_max_tokens)
        # 비어있지 않은 답변만 융합 대상으로 사용
        blocks = [
            f"[{p.get('mode', '?')} 검색 답변]\n{p.get('answer', '').strip()}"
            for p in passes if p.get("answer", "").strip()
        ]
        if not blocks:
            return "제공된 근거에서 관련 내용을 찾을 수 없습니다."
        context = "\n\n".join(blocks)
        prompt = (
            "다음은 동일한 특허법 질문에 대해 서로 다른 방식으로 얻은 답변 후보들임. "
            "이들을 종합해 모순 없이 하나의 정확한 한국어 답변을 작성하라.\n"
            "- 근거가 된 조문 번호('제○○조')와 핵심 개념을 인용할 것\n"
            "- 'vector'·'GraphRAG'·'검색' 같은 내부 처리 용어는 답변에 드러내지 말 것(자연스러운 법령 자문체)\n\n"
            f"질문: {question}\n\n{context}\n\n[종합 답변]"
        )
        return self._fuse_llm.invoke(prompt).content.strip()
