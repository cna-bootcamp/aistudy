"""Self-RAG 워크플로우의 상태(State)와 구조화 출력 스키마(Pydantic) 정의.

[Reflection / 라우팅 신호 — Self-RAG 토큰]
  Route : 검색 필요 여부 + 소스 선택(law/web/youtube) + 소스별 최적 쿼리 (RouteDecision)
  IsRel : 검색된 항목들이 질문과 관련 있는지 일괄 평가 (BatchRelevanceGrade)
  IsSup : 생성된 답변이 컨텍스트에 근거하는지 검증 (SupportGrade, 환각 방지)
  IsUse : 최종 답변이 유용한지 평가 (UsefulnessGrade, 미흡 시 쿼리 재작성·재검색)

모든 스키마는 with_structured_output(method='json_schema')로 LLM 출력을 강제해 안정 파싱함(MUST).
"""

from __future__ import annotations

from typing import Literal, Optional, TypedDict

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# 라우팅 / Reflection 토큰 스키마
# ---------------------------------------------------------------------------

class RouteDecision(BaseModel):
    """라우터 결과: 검색 필요 여부 + 선택 소스 + 소스별 최적 쿼리 (외부 동적 소스 전용)."""

    needs_retrieval: bool = Field(description="특허 선행기술·동향 질문이라 외부 검색이 필요한지 여부")
    sources: list[Literal["law", "web", "youtube"]] = Field(
        description="검색에 사용할 소스 목록 (law=판례·해석례·최신법령, web=뉴스·시장동향, youtube=강의·해설)"
    )
    law_query: str = Field(
        default="",
        description="판례·해석례·종합검색용 핵심 법률 키워드. sources에 'law'가 없으면 빈 문자열.",
    )
    law_name: str = Field(
        default="",
        description="질문에 특정 법령명이 드러난 경우 그 이름(예: '특허법', '발명진흥법'). 없으면 빈 문자열.",
    )
    use_chain_research: bool = Field(
        default=False,
        description="법령명이 불명확하거나 폭넓은 자연어 질문이라 종합검색(chain)이 유익하면 True.",
    )
    web_query: str = Field(
        default="",
        description="웹 검색용 쿼리. 연도·시간 표현(2024 등) 제외. sources에 'web'이 없으면 빈 문자열.",
    )
    youtube_query: str = Field(
        default="",
        description="YouTube 검색용 쿼리. 쉼표 없이 짧은 키워드. sources에 'youtube'가 없으면 빈 문자열.",
    )
    reasoning: str = Field(description="판단 근거 (한국어 한 문장)")


class RelevanceGrade(BaseModel):
    """[IsRel] 검색 항목 한 건의 관련성 평가."""

    document_index: int = Field(description="평가 대상 항목의 인덱스 (0부터 시작)")
    is_relevant: bool = Field(description="해당 항목이 질문과 관련 있는지 여부")


class BatchRelevanceGrade(BaseModel):
    """[IsRel] 여러 항목의 관련성 일괄 평가 (1회 LLM 호출로 전체 평가)."""

    results: list[RelevanceGrade] = Field(description="각 항목의 관련성 평가 결과 리스트")


class SupportGrade(BaseModel):
    """[IsSup] 답변의 근거성 평가."""

    is_supported: bool = Field(description="생성된 답변이 검색 컨텍스트에 근거하는지 여부")
    reasoning: str = Field(description="근거성 판단 이유 (한국어 한 문장)")


class UsefulnessGrade(BaseModel):
    """[IsUse] 답변 유용성 평가."""

    is_useful: bool = Field(description="답변이 사용자 질문에 유용한지 여부")
    reasoning: str = Field(description="유용성 판단 이유 (한국어 한 문장)")


class RewrittenQuery(BaseModel):
    """Query Rewriting 결과: 검색에 최적화되도록 다시 작성된 질문."""

    rewritten_query: str = Field(description="검색에 최적화되도록 다시 작성된 질문")
    reasoning: str = Field(description="질문을 다시 작성한 이유 (한국어 한 문장)")


# ---------------------------------------------------------------------------
# LangGraph 상태 정의
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    """그래프 전체에서 노드 사이로 공유·갱신되는 상태 데이터.

    각 노드는 이 딕셔너리의 일부 키만 갱신해 반환하면 LangGraph가 기존 상태에 병합함.
    """

    question: str               # 현재 처리 중 질문 (Query Rewriting 시 갱신됨)
    original_question: str      # 최초 사용자 질문 (유용성 평가·재작성의 기준)
    history: list               # 이전 대화 맥락 [{"role", "content"}] (멀티턴)

    # 라우팅 결과
    needs_retrieval: bool       # 검색 필요 여부
    sources: list               # 선택된 소스 ["law", "web", "youtube"]
    law_query: str              # 판례·해석례·종합검색용 쿼리
    law_name: str               # 특정 법령명 (있으면 최신 조문 조회)
    use_chain_research: bool    # 종합검색(chain_full_research) 사용 여부
    web_query: str              # 웹 검색용 쿼리 (연도 제외)
    youtube_query: str          # YouTube 검색용 쿼리 (짧은 키워드)
    route_reasoning: str        # 라우팅 판단 근거

    # 검색 결과
    law_raw: dict               # korean-law MCP 원본 결과 {precedents, interpretations, laws, law_texts, chain_research}
    web_results: list           # 웹 검색 결과 [{title, snippet, link}]
    youtube_videos: list        # YouTube 영상 메타데이터 [{video_id, title, channel, url, ...}]
    youtube_chunks: list        # 선별된 자막 청크 [{title, text, timestamp_url, ...}]
    retrieved_items: list       # 모든 소스를 합친 통합 항목 리스트 (IsRel 평가 대상)
    relevant_items: list        # 관련성 평가를 통과한 항목 (컨텍스트·출처 구성에 사용)

    # 답변 / 평가
    answer: str                 # 출처 섹션이 포함된 최종 답변
    is_supported: Optional[bool]   # [IsSup] 근거성 평가 결과
    is_useful: Optional[bool]      # [IsUse] 유용성 평가 결과
    usefulness_reasoning: str   # 유용성 판단 근거

    # 재시도 루프
    retry_count: int            # 현재까지 Query Rewriting 재시도 횟수
    rewrites: list              # Query Rewriting 이력 [{from, to, reasoning}]
