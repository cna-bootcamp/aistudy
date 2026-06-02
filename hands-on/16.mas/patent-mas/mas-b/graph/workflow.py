"""MAS B(선행기술·동향 리서치) Self-RAG 워크플로우 — LangGraph StateGraph.

외부 동적 소스(korean-law MCP 판례·해석례·최신법령 + 웹 + YouTube)만 검색하는 단위 MAS임.
특허법 조문 벡터 RAG는 MAS A 전담이므로 여기서는 다루지 않음(중복 금지).

노드 구성:
  route            : 검색 필요 여부 + 소스(law/web/youtube) + 소스별 쿼리 결정 (Route)
  retrieve         : 선택 소스에서 검색 → 통합 항목 리스트 구성 (law은 MCP 클라이언트로 호출)
  grade_documents  : 검색 항목 관련성 일괄 평가 (IsRel)
  generate         : 관련 항목 기반 답변 생성 + 근거성 검증·재생성 (IsSup) + 코드기반 출처 부착
  grade_generation : 답변 유용성 평가 (IsUse)
  rewrite          : 유용성 미달 시 질문 재작성 (Query Rewriting)
  direct_answer    : 특허 외 질문·인사는 검색 없이 LLM 지식으로 답변

엣지 구성:
  START → route
  route ─(검색 필요)→ retrieve / ─(불필요)→ direct_answer
  retrieve → grade_documents → generate → grade_generation
  grade_generation ─(유용/재시도 소진)→ END / ─(유용 미달)→ rewrite → route (재검색 루프)
  direct_answer → END
"""

from __future__ import annotations

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END
from typing import Literal, Optional

from config import settings
from graph.state import (
    AgentState,
    BatchRelevanceGrade,
    RewrittenQuery,
    RouteDecision,
    SupportGrade,
    UsefulnessGrade,
)
from sources.law_client import run_law_search
from sources.web_search import search_web
from sources.youtube_search import search_youtube

# 컨텍스트 길이 제한 (법령 본문·종합검색 결과가 매우 길 수 있어 프롬프트 비용을 제한함)
LAW_TEXT_MAX_CHARS = 2000      # 법령 조문 본문 최대 길이
CHAIN_RESEARCH_MAX_CHARS = 3000  # 종합검색(chain) 결과 최대 길이
RELEVANCE_PREVIEW_CHARS = 400  # 관련성 평가 시 LLM에 보여줄 항목 본문 미리보기 길이


# ---------------------------------------------------------------------------
# 보조 함수 (대화 맥락 / 통합 항목 / 컨텍스트 / 출처)
# ---------------------------------------------------------------------------

def build_llm() -> ChatGroq:
    """Groq LPU의 gpt-oss-120b 인스턴스를 생성함 (라우팅·평가·생성 공용).

    reasoning_format='hidden'으로 추론 과정을 숨기고 최종 텍스트만 받음(MUST).
    스모크 테스트로 with_structured_output(method='json_schema')와 공존 가능함을 확인함.
    temperature=0으로 구조화 판단을 재현 가능하게 함.
    """
    api_key = settings.require_env("GROQ_API_KEY")
    return ChatGroq(
        model=settings.LLM_MODEL,
        temperature=settings.LLM_TEMPERATURE,
        reasoning_format=settings.LLM_REASONING_FORMAT,
        api_key=api_key,
        # 일시적 오류(429/503 over capacity)에 지수 백오프로 재시도해 그래프 전체가 죽지 않게 함
        max_retries=settings.LLM_MAX_RETRIES,
    )


def format_history(history: list) -> str:
    """직전 대화 메시지를 프롬프트용 텍스트로 변환함 (멀티턴 맥락 제공)."""
    if not history:
        return "(이전 대화 없음)"
    recent = history[-settings.HISTORY_TURNS:]  # 최근 N개 메시지만 사용해 토큰·비용 제한
    lines = []
    for message in recent:
        speaker = "사용자" if message["role"] == "user" else "어시스턴트"
        lines.append(f"{speaker}: {message['content']}")
    return "\n".join(lines)


def build_retrieved_items(state: AgentState) -> list[dict]:
    """law/web/youtube 검색 결과를 IsRel 평가·컨텍스트·출처 구성에 쓸 통합 항목으로 변환함.

    각 항목: {source, title, content, citation}
      - content : 답변 생성용 본문 (LLM 컨텍스트)
      - citation: '출처' 섹션용 마크다운 한 줄 (코드에서 직접 구성 → 인용 환각 방지, MUST)
    """
    items: list[dict] = []
    law = state.get("law_raw") or {}

    # 1) 판례 (사건번호·선고일·링크가 핵심 출처)
    for precedent in law.get("precedents", []):
        if precedent["url"]:
            citation = (f"- [{precedent['title']}]({precedent['url']}) "
                        f"(사건번호 {precedent['case_number'] or 'N/A'}, 선고일 {precedent['date'] or 'N/A'})")
        else:
            citation = f"- {precedent['summary']}"
        items.append({"source": "판례", "title": precedent["title"],
                      "content": precedent["summary"], "citation": citation})

    # 2) 해석례 (법령해석례·행정해석)
    for interp in law.get("interpretations", []):
        if interp["url"]:
            citation = f"- [{interp['title']}]({interp['url']}) (회신일 {interp['date'] or 'N/A'})"
        else:
            citation = f"- {interp['title']} (회신일 {interp['date'] or 'N/A'})"
        items.append({"source": "해석례", "title": interp["title"],
                      "content": interp["summary"], "citation": citation})

    # 3) 최신 법령 조문 본문 (특정 법령명이 드러난 질문에서만 수집됨)
    for law_text in law.get("law_texts", []):
        items.append({
            "source": "법령",
            "title": law_text["name"],
            "content": law_text["text"][:LAW_TEXT_MAX_CHARS],
            "citation": f"- {law_text['name']} (최신 조문, 출처: 법제처 국가법령정보센터)",
        })
    # 법령 본문은 못 가져왔지만 검색 목록은 있는 경우, 관련 법령명만 출처로 안내함
    if law.get("laws") and not law.get("law_texts"):
        names = "; ".join(f"{item['name']}(공포 {item['date'] or 'N/A'})" for item in law["laws"][:3])
        items.append({"source": "법령", "title": "관련 법령",
                      "content": f"질문 관련 법령: {names}",
                      "citation": f"- 관련 법령: {names} (출처: 법제처)"})

    # 4) 종합검색(chain_full_research) — 폭넓은 질문/폴백에서 수집된 종합 결과
    if law.get("chain_research"):
        items.append({
            "source": "종합검색",
            "title": "법제처 종합검색 결과",
            "content": law["chain_research"][:CHAIN_RESEARCH_MAX_CHARS],
            "citation": "- 법제처 종합검색 (korean-law MCP chain_full_research)",
        })

    # 5) 웹 (뉴스·시장 동향)
    for web in state.get("web_results", []):
        citation = f"- [{web['title']}]({web['link']})" if web["link"] else f"- {web['title']}"
        items.append({"source": "웹", "title": web["title"],
                      "content": web["snippet"], "citation": citation})

    # 6) YouTube — 자막 청크 우선, 자막 없는 영상은 설명(description)으로 보강(graceful)
    chunk_video_ids = set()
    for chunk in state.get("youtube_chunks", []):
        chunk_video_ids.add(chunk["video_id"])
        items.append({
            "source": "YouTube",
            "title": chunk["title"],
            "content": chunk["text"],
            "citation": f"- [{chunk['title']}]({chunk['timestamp_url']}) @ {chunk['timestamp_display']}",
        })
    for video in state.get("youtube_videos", []):
        if video["video_id"] in chunk_video_ids:
            continue  # 이미 자막 청크로 포함된 영상은 중복 추가하지 않음
        if video.get("description"):
            items.append({
                "source": "YouTube",
                "title": video["title"],
                "content": video["description"],
                "citation": f"- [{video['title']}]({video['url']})",
            })

    return items


def build_context(items: list[dict]) -> str:
    """관련 항목을 소스별로 묶어 답변 생성용 단일 컨텍스트 문자열로 합침."""
    if not items:
        return "(검색 결과 없음)"
    # 소스별 그룹화 (등장 순서 보존)
    grouped: dict[str, list[dict]] = {}
    for item in items:
        grouped.setdefault(item["source"], []).append(item)

    blocks = []
    for source, group in grouped.items():
        lines = [f"=== {source} ==="]
        for index, item in enumerate(group, 1):
            lines.append(f"[{source} {index}] {item['title']}\n{item['content']}")
        blocks.append("\n\n".join(lines))
    return "\n\n".join(blocks)


def build_sources_section(items: list[dict]) -> str:
    """관련 항목의 citation을 소스별로 묶어 '출처' 섹션을 코드에서 직접 구성함(인용 환각 방지)."""
    if not items:
        return ""
    grouped: dict[str, list[str]] = {}
    for item in items:
        if item["citation"]:
            grouped.setdefault(item["source"], []).append(item["citation"])

    blocks = []
    for source, citations in grouped.items():
        # 같은 출처가 중복되면 순서를 보존하며 한 번만 남김
        unique = list(dict.fromkeys(citations))
        blocks.append(f"**{source}**\n" + "\n".join(unique))
    if not blocks:
        return ""
    return "## 출처\n" + "\n\n".join(blocks)


# ---------------------------------------------------------------------------
# Self-RAG 본체 (LangGraph 노드 + 그래프 구성)
# ---------------------------------------------------------------------------

class PatentTrendRAG:
    """korean-law MCP·웹·YouTube를 검색하는 Self-RAG 단위 MAS (LangGraph StateGraph)."""

    def __init__(self, llm: ChatGroq):
        self.llm = llm
        # with_structured_output(method='json_schema'): LLM 응답을 Pydantic 스키마(JSON)로 강제함.
        # gpt-oss-120b는 function_calling 모드에서 도구명을 잘못 생성해 실패할 수 있어 json_schema로 안정화함.
        self.router = llm.with_structured_output(RouteDecision, method="json_schema")
        self.relevance_grader = llm.with_structured_output(BatchRelevanceGrade, method="json_schema")
        self.support_grader = llm.with_structured_output(SupportGrade, method="json_schema")
        self.usefulness_grader = llm.with_structured_output(UsefulnessGrade, method="json_schema")
        self.query_rewriter = llm.with_structured_output(RewrittenQuery, method="json_schema")
        self.graph = self._build_graph()

    # ===== 노드 1: Route =====
    def route(self, state: AgentState) -> dict:
        """라우터 노드: 검색 필요 여부·소스(law/web/youtube)·소스별 쿼리를 결정함."""
        print("\n[Route] 검색 필요 여부 및 소스 판단 중...")
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 특허 '선행기술·동향 리서치' 챗봇의 라우터입니다.
사용자 질문을 분석해 외부 동적 소스 검색 전략을 결정하세요.
(이 챗봇은 특허법 조문 자체보다 '판례·해석례·최신 동향·강의'를 다룹니다.)

[검색 필요 = True] — 특허·지식재산권의 선행기술·판례·동향·해설 관련 질문
  사용 가능한 소스를 적절히 선택하세요 (복수 선택 가능):
  - law     : 판례·법령해석례·최신 법령 조문이 필요할 때 (korean-law MCP)
  - web     : 뉴스·시장 동향·통계·업계 사례 등 '최신 정보'가 필요할 때 (DuckDuckGo)
  - youtube : 강의·해설·실무 팁 등 '영상 설명'을 원할 때

[검색 불필요 = False] — 검색 없이 LLM 지식으로 직접 답변
  - 인사·잡담 (예: 안녕하세요)
  - 특허/지식재산권과 무관한 주제 (예: 일반 IT, 다른 분야 법률)

[소스별 쿼리 작성 규칙]
  - law_query : 판례·해석례·종합검색용 핵심 법률 키워드 (예: '직무발명 보상금').
  - law_name  : 질문에 특정 법령명이 명시되면 그 이름(예: '특허법', '발명진흥법'). 없으면 빈 문자열.
  - use_chain_research : 법령명이 불명확하거나 폭넓은 자연어 질문이면 True (종합검색 활용).
  - web_query : 핵심 키워드. 연도·시간 표현(2024·최신·올해 등)은 절대 넣지 마세요.
  - youtube_query : 쉼표 없이 짧은 키워드 (예: '특허 출원 방법').
  - 선택하지 않은 소스의 쿼리는 빈 문자열로 두세요.

이전 대화 맥락을 참고해 후속 질문(예: '그럼 판례는?')의 의도를 정확히 파악하세요.
판단 근거(reasoning)는 한국어로 작성하세요."""),
            ("human", "이전 대화:\n{history}\n\n현재 질문: {question}\n\n검색 전략을 결정하세요."),
        ])
        decision: RouteDecision = (prompt | self.router).invoke({
            "history": format_history(state.get("history", [])),
            "question": state["question"],
        })
        sources = decision.sources if decision.needs_retrieval else []
        print(f"  → 검색 필요: {decision.needs_retrieval} / 소스: {sources or '없음'}")
        print(f"  → 근거: {decision.reasoning}")
        if sources:
            print(f"  → law_query='{decision.law_query}' law_name='{decision.law_name}' "
                  f"chain={decision.use_chain_research}")
            print(f"  → web_query='{decision.web_query}' youtube_query='{decision.youtube_query}'")
        return {
            "needs_retrieval": decision.needs_retrieval,
            "sources": sources,
            "law_query": decision.law_query,
            "law_name": decision.law_name,
            "use_chain_research": decision.use_chain_research,
            "web_query": decision.web_query,
            "youtube_query": decision.youtube_query,
            "route_reasoning": decision.reasoning,
        }

    # ===== 노드 2: Retrieve =====
    def retrieve(self, state: AgentState) -> dict:
        """검색 노드: 선택된 소스에서만 검색을 수행하고 통합 항목 리스트를 구성함.

        각 소스 호출을 try/except로 감싸 한 소스가 실패해도 나머지로 답변을 만들 수 있게 함.
        law은 korean-law MCP 클라이언트(run_law_search)가 동기 래퍼로 비동기 MCP 호출을 수행함.
        """
        sources = state["sources"]
        law_raw = {"precedents": [], "interpretations": [], "laws": [], "law_texts": [], "chain_research": ""}
        web_results, youtube_videos, youtube_chunks = [], [], []

        # 판례·해석례·최신법령 (korean-law MCP — Streamable HTTP 클라이언트)
        if "law" in sources:
            query = state["law_query"] or state["question"]
            print(f"\n[Retrieve:law] korean-law MCP 검색 중... (쿼리: '{query}', 법령명: '{state['law_name']}')")
            try:
                law_raw = run_law_search(query, state["law_name"], state["use_chain_research"])
                print(f"  → 판례 {len(law_raw['precedents'])} / 해석례 {len(law_raw['interpretations'])} / "
                      f"법령 {len(law_raw['laws'])} / 조문 {len(law_raw['law_texts'])} / "
                      f"종합검색 {'있음' if law_raw['chain_research'] else '없음'}")
            except Exception as error:  # noqa: BLE001
                print(f"  ! law 검색 실패(무시하고 진행): {type(error).__name__}: {str(error)[:120]}")

        # 웹 (DuckDuckGo)
        if "web" in sources:
            print(f"\n[Retrieve:web] DuckDuckGo 검색 중... (쿼리: '{state['web_query']}')")
            web_results = search_web(state["web_query"] or state["question"])
            print(f"  → {len(web_results)}건")

        # YouTube (Data API v3 + YoutubeLoader 자막)
        if "youtube" in sources:
            print(f"\n[Retrieve:youtube] 영상 검색·자막 로드 중... (쿼리: '{state['youtube_query']}')")
            yt = search_youtube(state["youtube_query"] or state["question"])
            youtube_videos, youtube_chunks = yt["videos"], yt["chunks"]
            print(f"  → 영상 {len(youtube_videos)}건 / 관련 자막 청크 {len(youtube_chunks)}개")

        # 통합 항목 구성 (IsRel·컨텍스트·출처 공용)
        new_state = {
            "law_raw": law_raw,
            "web_results": web_results,
            "youtube_videos": youtube_videos,
            "youtube_chunks": youtube_chunks,
        }
        items = build_retrieved_items({**state, **new_state})
        new_state["retrieved_items"] = items
        print(f"  → 통합 검색 항목 {len(items)}개")
        return new_state

    # ===== 노드 3: Grade Documents (IsRel) =====
    def grade_documents(self, state: AgentState) -> dict:
        """[IsRel] 노드: 통합 검색 항목의 관련성을 1회 LLM 호출로 일괄 평가해 선별함."""
        items = state["retrieved_items"]
        if not items:
            return {"relevant_items": []}

        print("\n[IsRel] 검색 항목 관련성 일괄 평가 중...")
        # 항목마다 소스·제목 + 본문 미리보기를 보여줌 (긴 본문은 잘라 평가 비용을 제한함)
        docs_text = "\n\n".join(
            f"[항목 {i}] ({item['source']}) {item['title']}\n{item['content'][:RELEVANCE_PREVIEW_CHARS]}"
            for i, item in enumerate(items)
        )
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 검색된 항목들이 질문과 관련 있는지 평가하는 전문가입니다.

항목이 질문에 답하는 데 직접 도움이 되는 정보를 포함하면 관련 있음(True)으로 판단합니다.
주제가 겹치지만 질문의 초점과 다르거나, 단지 키워드만 스쳐 지나가면 관련 없음(False)으로 판단합니다.
입력된 각 항목을 그 인덱스(document_index)와 함께 개별적으로 평가하여 모두 반환하세요."""),
            ("human", "질문: {question}\n\n검색된 항목들:\n{documents}\n\n각 항목의 관련성을 평가해 주세요."),
        ])
        batch: BatchRelevanceGrade = (prompt | self.relevance_grader).invoke({
            "question": state["question"],
            "documents": docs_text,
        })
        relevant = []
        for grade in batch.results:
            if 0 <= grade.document_index < len(items) and grade.is_relevant:
                relevant.append(items[grade.document_index])
        print(f"  → 관련 항목 {len(relevant)}/{len(items)}개 선별")
        return {"relevant_items": relevant}

    # ===== 노드 4: Generate (답변 + IsSup + 출처) =====
    def generate(self, state: AgentState) -> dict:
        """생성 노드: 관련 항목으로 답변 생성 → 근거성([IsSup]) 부족 시 엄격 재생성 → 코드기반 출처 부착."""
        relevant = state["relevant_items"]
        context = build_context(relevant)
        has_context = bool(relevant)

        print("\n[Generate] 검색 결과 기반 답변 생성 중...")
        answer = self._generate_answer(state, context, strict=False)

        is_supported: Optional[bool] = None
        if has_context:
            print("\n[IsSup] 답변 근거성 평가 중...")
            support = self._grade_support(answer, context)
            is_supported = support.is_supported
            print(f"  → 근거 있음: {support.is_supported} ({support.reasoning})")
            if not support.is_supported:
                print("\n[Generate] 근거 부족 → 엄격 근거 기반으로 답변 재생성 중...")
                answer = self._generate_answer(state, context, strict=True)
                # 엄격 재생성 결과를 다시 근거성 평가해 is_supported를 갱신함.
                # (갱신하지 않으면 재생성으로 환각을 줄였어도 요약에 항상 'False'로 보고되어 실제와 어긋남)
                support = self._grade_support(answer, context)
                is_supported = support.is_supported
                print(f"  → 재평가 근거 있음: {support.is_supported} ({support.reasoning})")

        sources_section = build_sources_section(relevant)
        full_answer = f"{answer}\n\n{sources_section}".strip() if sources_section else answer
        return {"answer": full_answer, "is_supported": is_supported}

    def _generate_answer(self, state: AgentState, context: str, strict: bool) -> str:
        """검색 컨텍스트와 대화 맥락을 근거로 답변 본문을 생성함 (strict=True면 컨텍스트만 사용)."""
        strict_rule = (
            "\n## 중요: 엄격한 근거 기반 답변\n- 반드시 아래 컨텍스트에 있는 정보만 사용하세요.\n"
            "- 컨텍스트에 없는 내용은 추가하지 말고 '확인되지 않음'이라고 명시하세요."
            if strict else ""
        )
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 특허 선행기술·동향 리서치 전문 AI입니다.

## 역할
- 아래 검색 컨텍스트(판례·해석례·최신 법령·웹 동향·YouTube 해설)와 이전 대화 맥락을 종합해 답변합니다.
- 특허법 '조문 해설' 자체보다 판례 동향·업계 흐름·실무 해설을 중심으로 정리합니다.
- 법률 용어는 일반인이 이해하기 쉽게 풀어서 설명합니다.

## 규칙
1. 컨텍스트의 정보를 우선 활용하되, 핵심을 요약해 명확히 전달
2. 판례는 어떤 사건이 있는지, 최근 흐름이 어떤지 정리 (사건번호·선고일이 있으면 자연스럽게 언급)
3. 영상은 어떤 영상이 도움이 되는지 안내하되, 컨텍스트에 명시되지 않은 임의의 시점(분:초)을
   만들어내지 마세요. 구체적 시점은 시스템이 출처 섹션의 타임스탬프 URL로 제공합니다.
4. '출처' 섹션은 시스템이 자동으로 덧붙이므로 답변 본문에 직접 작성하지 마세요{strict_rule}

## 이전 대화 맥락
{history}

## 검색 컨텍스트
{context}"""),
            ("human", "{question}"),
        ])
        return (prompt | self.llm | StrOutputParser()).invoke({
            "history": format_history(state.get("history", [])),
            "context": context,
            "question": state["original_question"],
            "strict_rule": strict_rule,
        })

    def _grade_support(self, answer: str, context: str) -> SupportGrade:
        """[IsSup]: 생성된 답변이 검색 컨텍스트에 근거하는지(환각이 없는지) 검증함."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 생성된 답변이 제공된 컨텍스트에 근거하는지 평가하는 전문가입니다.

답변의 주요 주장과 정보가 컨텍스트에서 직접 확인 가능해야 근거 있음(True)입니다.
컨텍스트에 없는 정보를 추가하거나 왜곡했으면 근거 없음(False)으로 판단합니다.
판단 이유(reasoning)는 한국어로 작성하세요."""),
            ("human", "컨텍스트:\n{context}\n\n생성된 답변:\n{answer}\n\n이 답변이 컨텍스트에 근거하고 있나요?"),
        ])
        return (prompt | self.support_grader).invoke({"context": context, "answer": answer})

    # ===== 노드 5: Grade Generation (IsUse) =====
    def grade_generation(self, state: AgentState) -> dict:
        """[IsUse] 노드: 최종 답변이 사용자 질문에 유용한지 평가함 (재검색 루프의 분기 기준)."""
        print("\n[IsUse] 답변 유용성 평가 중...")
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 생성된 답변이 사용자 질문에 유용한지 평가하는 전문가입니다.

[유용함 = True] 질문에 직접 답하고, 내용이 명확하며 실질적으로 도움이 됨
[유용하지 않음 = False] 질문을 회피·모호하게 답하거나, 관련 없는 정보만 나열하거나, 너무 일반적임

판단 이유(reasoning)는 한국어로 작성하세요."""),
            ("human", "질문: {question}\n\n답변:\n{answer}\n\n이 답변이 질문에 유용하게 답하고 있나요?"),
        ])
        grade: UsefulnessGrade = (prompt | self.usefulness_grader).invoke({
            "question": state["original_question"],
            "answer": state["answer"],
        })
        print(f"  → 유용함: {grade.is_useful} ({grade.reasoning})")
        return {"is_useful": grade.is_useful, "usefulness_reasoning": grade.reasoning}

    # ===== 노드 6: Rewrite (Query Rewriting) =====
    def rewrite(self, state: AgentState) -> dict:
        """Query Rewriting 노드: 유용성 미달 시 더 나은 검색을 위해 질문을 재작성함."""
        print("\n[Query Rewriting] 유용성 미달 → 질문 재작성 중...")
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 검색 쿼리를 최적화하는 전문가입니다.

원래 질문으로 시도했으나 유용한 답변을 생성하지 못했습니다. 더 나은 검색을 위해 질문을 다시 작성하세요.

## 재작성 전략
1. 모호한 표현을 구체적인 특허/판례 용어로 변환
2. 구어체를 문어체/전문 용어로 변환
3. 선행기술·판례·동향 검색에 적합한 핵심 키워드를 명확히 포함

재작성 이유(reasoning)는 한국어로 작성하세요."""),
            ("human", """원래 질문: {original_question}

이전 답변(유용하지 않음): {failed_answer}

유용하지 않은 이유: {failure_reason}

더 나은 검색 결과를 위해 질문을 다시 작성해 주세요."""),
        ])
        rewritten: RewrittenQuery = (prompt | self.query_rewriter).invoke({
            "original_question": state["original_question"],
            "failed_answer": state["answer"],
            "failure_reason": state.get("usefulness_reasoning", ""),
        })
        print(f"  → 재작성 질문: {rewritten.rewritten_query}")
        return {
            "question": rewritten.rewritten_query,
            "retry_count": state["retry_count"] + 1,
            "rewrites": state["rewrites"] + [{
                "from": state["question"],
                "to": rewritten.rewritten_query,
                "reasoning": rewritten.reasoning,
            }],
        }

    # ===== 노드 7: Direct Answer =====
    def direct_answer(self, state: AgentState) -> dict:
        """직접 답변 노드: 특허 외 질문·인사 등은 검색 없이 LLM 지식과 대화 맥락으로 답변함."""
        print("\n[Direct] 검색 불필요 → LLM 지식으로 직접 답변 중...")
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 특허 선행기술·동향 리서치 챗봇입니다. 다만 이번 질문은 검색이 필요 없는 질문입니다.

이전 대화 맥락을 고려해 친절하고 정확하게 답변하세요.
특허/지식재산권과 무관한 주제라면 일반 지식으로 간단히 답하되, 필요하면 특허 관련 질문을 안내해도 좋습니다.

## 이전 대화 맥락
{history}"""),
            ("human", "{question}"),
        ])
        answer = (prompt | self.llm | StrOutputParser()).invoke({
            "history": format_history(state.get("history", [])),
            "question": state["question"],
        })
        return {"answer": answer}

    # ===== 조건부 엣지 =====
    def decide_search_path(self, state: AgentState) -> Literal["retrieve", "direct"]:
        """route 직후 분기: 검색 필요 + 소스 있으면 retrieve, 아니면 direct_answer."""
        if state["needs_retrieval"] and state["sources"]:
            return "retrieve"
        return "direct"

    def decide_after_generation(self, state: AgentState) -> Literal["rewrite", "end"]:
        """grade_generation 직후 분기: 유용하면 종료, 미달 + 재시도 남으면 rewrite.

        재시도 횟수 가드를 이 엣지에서 직접 검사해 무한 루프(GraphRecursionError)를 방지함.
        """
        if state["is_useful"]:
            return "end"
        if state["retry_count"] >= settings.MAX_RETRIES:
            print(f"\n[경고] 최대 재시도({settings.MAX_RETRIES}회) 도달 → 마지막 답변을 그대로 반환함.")
            return "end"
        return "rewrite"

    # ===== 그래프 구성 =====
    def _build_graph(self):
        """노드와 엣지를 연결해 실행 가능한 StateGraph로 컴파일함."""
        workflow = StateGraph(AgentState)
        workflow.add_node("route", self.route)
        workflow.add_node("retrieve", self.retrieve)
        workflow.add_node("grade_documents", self.grade_documents)
        workflow.add_node("generate", self.generate)
        workflow.add_node("grade_generation", self.grade_generation)
        workflow.add_node("rewrite", self.rewrite)
        workflow.add_node("direct_answer", self.direct_answer)

        workflow.add_edge(START, "route")
        workflow.add_conditional_edges(
            "route", self.decide_search_path,
            {"retrieve": "retrieve", "direct": "direct_answer"},
        )
        workflow.add_edge("retrieve", "grade_documents")
        workflow.add_edge("grade_documents", "generate")
        workflow.add_edge("generate", "grade_generation")
        workflow.add_conditional_edges(
            "grade_generation", self.decide_after_generation,
            {"rewrite": "rewrite", "end": END},
        )
        workflow.add_edge("rewrite", "route")
        workflow.add_edge("direct_answer", END)
        return workflow.compile()

    def invoke(self, question: str, history: list) -> dict:
        """질문 한 건에 대해 그래프를 실행하고 최종 상태를 반환함 (멀티턴 history 전달)."""
        initial_state: AgentState = {
            "question": question,
            "original_question": question,
            "history": history,
            "needs_retrieval": False,
            "sources": [],
            "law_query": "",
            "law_name": "",
            "use_chain_research": False,
            "web_query": "",
            "youtube_query": "",
            "route_reasoning": "",
            "law_raw": {},
            "web_results": [],
            "youtube_videos": [],
            "youtube_chunks": [],
            "retrieved_items": [],
            "relevant_items": [],
            "answer": "",
            "is_supported": None,
            "is_useful": None,
            "usefulness_reasoning": "",
            "retry_count": 0,
            "rewrites": [],
        }
        return self.graph.invoke(initial_state, config={"recursion_limit": settings.RECURSION_LIMIT})
