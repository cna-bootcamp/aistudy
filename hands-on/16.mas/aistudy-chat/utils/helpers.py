"""유틸리티 함수 모음

쿼리 재작성(LLM), 출처 포맷, 질문-답변 관련성 점수(휴리스틱)를 제공함.
관련성 점수는 추가 LLM 호출 없이 키워드 겹침으로 계산하여 로컬 qwen3:8b 환경의 지연을 줄임.
"""
from __future__ import annotations

import re
from typing import Optional

from llm.ollama_llm import OllamaLLM
from utils.logger import get_logger

logger = get_logger("utils.helpers")


def rewrite_query(original_query: str, llm: Optional[OllamaLLM] = None) -> str:
    """검색 효율을 높이도록 쿼리를 재작성함 (재시도 시 사용)."""
    llm = llm or OllamaLLM()
    prompt = f"""다음 질문을 검색에 더 효과적인 형태로 재작성함.
- 핵심 키워드를 추출하고 명확하게 표현
- 불필요한 조사/어미 제거
- 기술 용어는 영어 병기
- 재작성된 쿼리만 한 줄로 출력

원본 질문: {original_query}

재작성된 쿼리:"""
    try:
        rewritten = llm.generate(prompt=prompt, temperature=0.3, max_tokens=200).strip()
        # 여러 줄이 와도 첫 비어있지 않은 줄만 사용
        rewritten = next((line.strip() for line in rewritten.splitlines() if line.strip()), "")
        if rewritten:
            return rewritten
    except Exception as e:
        logger.warning(f"쿼리 재작성 실패: {e}")
    return original_query


def calculate_relevance_score(question: str, answer: str) -> float:
    """질문과 답변의 관련성을 키워드 겹침 비율로 계산함 (0.0~1.0, LLM 미사용).

    질문에서 2글자 이상 토큰을 뽑아 답변에 등장하는 비율을 점수로 사용함 — 빠르고 결정적임.
    """
    # 한글/영문/숫자만 남기고 토큰화
    tokens = [t for t in re.findall(r"[0-9A-Za-z가-힣]+", question.lower()) if len(t) >= 2]
    if not tokens:
        return 0.5
    answer_lower = answer.lower()
    matched = sum(1 for t in set(tokens) if t in answer_lower)
    return round(matched / len(set(tokens)), 4)


def format_sources(rag_results: list[dict], web_results: list[dict], youtube_results: list[dict]) -> str:
    """RAG/웹/YouTube 검색 결과를 사용자 표시용 출처 목록으로 포맷함."""
    sources: list[str] = []
    for i, r in enumerate(rag_results[:3], 1):
        label = r.get("filename") or r.get("source", "교재")
        section = r.get("section", "")
        sources.append(f"[교재 {i}] {label}" + (f" · {section}" if section else ""))
    for i, r in enumerate(web_results[:3], 1):
        sources.append(f"[웹 {i}] {r.get('title', 'unknown')} - {r.get('url', '')}")
    for i, r in enumerate(youtube_results[:2], 1):
        sources.append(f"[영상 {i}] {r.get('title', 'unknown')} - {r.get('url', '')}")
    return "\n".join(sources) if sources else "출처 없음"
