"""검색기 공통 데이터 타입 — 출처 항목과 단일 검색 결과.

조문 벡터 RAG와 MS GraphRAG는 검색 메커니즘은 다르지만, 상위 워크플로(Agent)가 동일하게
다룰 수 있도록 같은 결과 타입(SearchOutput)으로 정규화함.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class SourceItem:
    """답변 근거가 된 출처 한 건 (조문 청크 또는 GraphRAG 컨텍스트 행)."""

    source_type: str                       # "vector" | "entity" | "relationship" | "community" | ...
    title: str                             # 표시용 제목 (예: "특허법 제29조(특허요건)")
    content: str                           # 근거 본문 (UI/LLM 인용용으로 길이 제한됨)
    metadata: dict[str, Any] = field(default_factory=dict)  # chapter/article/distance 등 부가 정보


@dataclass(frozen=True)
class SearchOutput:
    """한 번의 검색(한 모드)이 만든 답변·출처·근거 요약.

    evidence는 임베딩·대용량 원문을 그대로 노출하지 않고 '개수'만 담아 MCP 응답을 간결하게 유지함.
    """

    mode: str                              # 실제 실행된 모드 (vector/local/global/drift)
    answer: str                            # 이 모드가 생성한 답변
    sources: list[SourceItem] = field(default_factory=list)
    evidence: dict[str, int] = field(default_factory=dict)  # {"sources": n, ...} 개수 요약
    note: str | None = None                # 폴백 등 부가 설명 (예: DRIFT→Local 폴백 사유)
