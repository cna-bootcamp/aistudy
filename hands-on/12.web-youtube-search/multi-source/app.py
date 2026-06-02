#!/usr/bin/env python3
"""멀티소스 RAG 예제 (벡터DB + 웹검색 + YouTube검색 통합)

LLM이 질문을 분석하여 적합한 소스를 스스로 선택(Query Router)하고, 각 소스에 맞게
검색어를 다시 쓴 뒤(Query Rewriting) 선택된 소스를 순차 검색하여 결과를 종합(Synthesis)하는 RAG임.

[10.rag/naive 대비 핵심 변경 사항]
  Before: 항상 특허법 벡터DB만 검색 → 단일 소스 RAG (검색 → 생성)
  After : 질문 분석 → 소스 선택(복수 가능) → 소스별 검색어 재작성 → 멀티소스 검색 → 종합

핵심 개념:
  - Query Router : LLM이 질문 의도를 분석해 어떤 소스로 보낼지 결정 (Pydantic 구조화 출력)
  - Query Rewriting : 같은 질문이라도 소스마다 최적의 검색어가 다르므로 소스별로 재작성
  - Multi-Source : 법률(벡터DB) + 최신정보(웹) + 강의(YouTube)를 한 질문에 조합

소스별 역할:
  - vectorstore : 대한민국 특허법 (10.rag/vectordb, 재임베딩 없이 로드)
  - web         : DuckDuckGo (최근 1년 필터, 최신 정보)
  - youtube     : YouTube Data API v3 (최근 1년 필터, 튜토리얼/강의)

Embed   : OpenAI text-embedding-3-small (벡터DB 질의 임베딩 전용)
LLM     : Groq LPU openai/gpt-oss-120b (라우팅 + 종합)

사용법:
    python app.py                              # 기본 질의어로 실행
    python app.py "특허 출원 절차와 최신 동향, 관련 강의 알려줘"
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ---------------------------------------------------------------------------
# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(multi-source/)를 절대경로로 구함
# multi-source → 12.web-youtube-search → hands-on (.parent 2회로 hands-on 루트에 도달)
HANDS_ON_DIR = SCRIPT_DIR.parent.parent
VECTORDB_DIR = HANDS_ON_DIR / "10.rag" / "vectordb"  # 공용 특허법 ChromaDB (재임베딩 없이 로드)
ENV_PATH = HANDS_ON_DIR / ".env"                     # hands-on/.env (API 키 보관)

# ---------------------------------------------------------------------------
# 환경변수 로드
# ---------------------------------------------------------------------------
from dotenv import load_dotenv

# .env에서 OPENAI_API_KEY(질의 임베딩)·GROQ_API_KEY(LLM)·YOUTUBE_API_KEY(YouTube 검색)를 로드함
load_dotenv(ENV_PATH)

# ---------------------------------------------------------------------------
# 상수 정의
# ---------------------------------------------------------------------------
COLLECTION_NAME = "patent_law"               # 공용 벡터 DB 컬렉션명 (인덱싱과 동일해야 검색 가능)
EMBEDDING_MODEL = "text-embedding-3-small"   # 질의 임베딩 모델 (인덱싱과 반드시 동일, 1536차원)
LLM_MODEL = "openai/gpt-oss-120b"            # Groq LPU에서 서빙하는 라우팅·종합용 LLM
TOP_K = 5                                    # 벡터DB 유사도 검색으로 가져올 상위 청크 수
MAX_WEB_RESULTS = 5                          # DuckDuckGo 웹 검색 결과 수 (제약: 최신 5개)
MAX_YOUTUBE_RESULTS = 5                      # YouTube 검색 결과 수
RECENT_DAYS = 365                            # 웹·YouTube 최신 필터 기간 (최근 1년)

DEFAULT_QUERY = "특허 출원 절차를 알려주고, 최신 특허 동향과 관련 강의 영상도 찾아줘"

# Query Router 시스템 프롬프트
#   - 어떤 질문을 어떤 소스로 보낼지(라우팅) + 소스별 검색어를 어떻게 다시 쓸지(리라이팅)를 함께 지시함
#   - 소스별 리라이팅 규칙(웹은 연도 제외, 유튜브는 쉼표 없는 짧은 키워드)을 명시해 제약을 지킴
ROUTER_SYSTEM_PROMPT = """당신은 멀티소스 RAG의 Query Router임. 사용자 질문을 분석하여
(1) 검색할 소스를 선택하고 (2) 각 소스에 최적화된 검색어를 생성함.

[소스별 특징과 선택 기준]
- vectorstore : 대한민국 특허법 조문. 특허 요건·출원 절차·권리·심사 등 '법률/제도' 질문에 선택.
- web         : DuckDuckGo 웹 검색. 최신 동향·뉴스·통계·시장 정보 등 '최신 정보' 질문에 선택.
- youtube     : YouTube 영상 검색. 튜토리얼·강의·강연·실습 등 '배우는 영상' 질문에 선택.

[복수 선택]
- 한 질문이 여러 의도를 담으면 소스를 복수 선택함 (예: 법률 + 최신정보 + 강의).
- 관련 없는 소스는 선택하지 않음 (불필요한 검색 방지).

[소스별 검색어 재작성(Query Rewriting) 규칙]
- vectorstore_query : 특허법 조문 검색에 맞는 핵심 법률 용어 중심으로 작성. 미선택 시 빈 문자열.
- web_query : 핵심 키워드 중심. 연도/시간 표현(예: '2024', '최신', '올해', '요즘')은 제외함
  (웹 검색은 최근 1년 필터가 자동 적용되므로 시간 표현이 불필요). 미선택 시 빈 문자열.
- youtube_query : 쉼표 없이 짧은 키워드로 작성(예: '특허 출원 강의'). 미선택 시 빈 문자열.

[예시]
- "특허 요건이 뭐야?" → sources=["vectorstore"]
- "AI 특허 최신 동향" → sources=["web"], web_query="AI 특허 동향"
- "특허 출원 절차와 최신 통계, 관련 강의" → sources=["vectorstore","web","youtube"]
"""

# Synthesis 시스템 프롬프트: 수집된 멀티소스 결과만 근거로 답변하도록 제약함
SYNTHESIS_SYSTEM_PROMPT = (
    "당신은 여러 소스의 검색 결과를 종합하여 답변하는 멀티소스 RAG 어시스턴트임. "
    "반드시 아래 [검색 결과]에 있는 내용만 근거로 답하고, 없는 내용은 추측하지 말 것. "
    "소스별로 정보를 구분하여 정리하되, 자연스럽게 하나의 답변으로 통합할 것. "
    "특허법 근거는 조문을, 웹/YouTube 근거는 URL을 함께 제시할 것. "
    "답변은 한국어로 간결하게 작성할 것."
)


# ---------------------------------------------------------------------------
# 1. Query Router (Pydantic 구조화 출력)
# ---------------------------------------------------------------------------

from typing import Literal

from pydantic import BaseModel, Field


class RouteDecision(BaseModel):
    """질문 분석 결과: 검색할 소스 목록 + 소스별 최적화 검색어(Query Rewriting).

    LLM이 이 스키마 형태로 응답하도록 강제하여(structured output), 자연어 파싱 없이
    안정적으로 라우팅 결정과 소스별 검색어를 동시에 얻음.
    """

    # Literal[...]: 허용된 문자열만 값으로 받도록 제한함 (잘못된 소스명 방지)
    sources: list[Literal["vectorstore", "web", "youtube"]] = Field(
        description="검색할 소스 목록. 질문 의도에 맞게 복수 선택 가능."
    )
    vectorstore_query: str = Field(
        default="",
        description="특허법 벡터DB 검색어(법률 용어 중심). sources에 'vectorstore'가 없으면 빈 문자열.",
    )
    web_query: str = Field(
        default="",
        description="웹 검색어. 연도/시간 표현 제외. sources에 'web'이 없으면 빈 문자열.",
    )
    youtube_query: str = Field(
        default="",
        description="YouTube 검색어. 쉼표 없이 짧은 키워드. sources에 'youtube'가 없으면 빈 문자열.",
    )
    reasoning: str = Field(description="소스를 그렇게 선택한 이유 요약.")


def create_router_llm():
    """Query Router 전용 Groq LLM을 생성함.

    추론 모델(gpt-oss-120b)의 reasoning_format을 지정하지 않고 기본값으로 두어
    structured output(도구 호출 기반)과의 충돌 가능성을 피함. temperature=0으로 결정적 라우팅.
    """
    import os

    # ChatGroq: Groq Cloud LPU에 채팅 요청을 보내는 LangChain 모델 래퍼 (GROQ_API_KEY 자동 참조)
    from langchain_groq import ChatGroq

    # API 키 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함
    if not os.getenv("GROQ_API_KEY"):
        raise RuntimeError(f"GROQ_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요")

    return ChatGroq(model=LLM_MODEL, temperature=0)


def route_query(query: str, router_llm) -> RouteDecision:
    """질문을 분석하여 소스 선택 + 소스별 검색어를 담은 RouteDecision을 반환함.

    with_structured_output(RouteDecision): LLM 응답을 RouteDecision 스키마(JSON)로 강제하여
    파싱 오류 없이 구조화된 결정을 받음. 라우팅과 Query Rewriting을 한 번의 호출로 동시에 수행함.
    """
    structured_llm = router_llm.with_structured_output(RouteDecision)
    decision = structured_llm.invoke(
        [
            {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
            {"role": "user", "content": query},
        ]
    )
    return decision


# ---------------------------------------------------------------------------
# 2. 소스별 검색 함수
# ---------------------------------------------------------------------------

def search_vectorstore(query: str) -> list[dict]:
    """특허법 벡터DB를 재임베딩 없이 로드하여 유사 청크 Top K를 검색함.

    Chroma(...) 생성자(from_documents가 아님)로 이미 영속화된 컬렉션을 그대로 연결함.
    인덱싱과 동일한 임베딩 모델을 써야 의미 공간이 일치하여 유사도 검색이 성립함.
    반환: [{"title": 조문 출처, "snippet": 본문, "link": 청크 식별자}, ...] (소스 공통 형식)
    """
    import os

    from langchain_chroma import Chroma
    from langchain_openai import OpenAIEmbeddings

    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError(f"OPENAI_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요")
    if not VECTORDB_DIR.exists():
        raise FileNotFoundError(f"특허법 벡터 DB가 없음: {VECTORDB_DIR}")

    # OpenAIEmbeddings: 질의를 1536차원 벡터로 변환 (검색용 질의 임베딩, OPENAI_API_KEY 자동 참조)
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    vectorstore = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=str(VECTORDB_DIR),
    )

    # as_retriever(search_kwargs={"k": TOP_K}): 유사도 상위 TOP_K개 청크만 반환하도록 설정함
    retriever = vectorstore.as_retriever(search_kwargs={"k": TOP_K})
    docs = retriever.invoke(query)

    # 소스 공통 형식(title/snippet/link)으로 정규화하여 종합 단계에서 일관되게 다룸
    results = []
    for doc in docs:
        source = doc.metadata.get("source", "unknown")
        chunk_index = doc.metadata.get("chunk_index", "?")
        results.append(
            {
                "title": f"{source} #{chunk_index}",
                "snippet": doc.page_content,
                "link": f"{source}#{chunk_index}",
            }
        )
    return results


def search_web(query: str) -> list[dict]:
    """DuckDuckGo로 최근 1년 웹 문서를 검색하여 소스 링크 포함 결과를 반환함.

    DuckDuckGoSearchAPIWrapper.results(): run()과 달리 title·snippet·link를 모두 반환하여
    출처 URL을 확보함. time="y"로 최근 1년, max_results로 최신 5개만 사용함.
    DuckDuckGo는 RatelimitException이 잦으므로 실패 시 빈 리스트로 graceful 처리함.
    """
    # DuckDuckGoSearchAPIWrapper: DuckDuckGo 검색을 감싼 LangChain 유틸 (API 키 불필요)
    from langchain_community.utilities import DuckDuckGoSearchAPIWrapper

    wrapper = DuckDuckGoSearchAPIWrapper(
        region="ko-kr",   # 한국어/한국 지역 결과 우선
        time="y",         # 최근 1년 필터 (제약 사항)
        max_results=MAX_WEB_RESULTS,
    )

    try:
        # results(query, max_results): 링크 포함 상세 결과 [{"title","snippet","link"}, ...] 반환
        raw = wrapper.results(query, max_results=MAX_WEB_RESULTS)
    except Exception as error:
        # Rate limit·네트워크 오류를 코드 버그와 구분하기 위해 경고만 출력하고 빈 결과 반환
        print(f"  [경고] 웹 검색 실패(빈 결과로 진행): {error}", file=sys.stderr)
        return []

    # 키 이름을 소스 공통 형식으로 정규화 (래퍼 버전에 따라 link/snippet 키가 다를 수 있어 방어적으로 처리)
    results = []
    for item in raw:
        results.append(
            {
                "title": item.get("title", ""),
                "snippet": item.get("snippet", ""),
                "link": item.get("link", ""),
            }
        )
    return results


def search_youtube(query: str) -> list[dict]:
    """YouTube Data API v3로 최근 1년 영상을 검색하여 메타데이터를 반환함.

    publishedAfter에 (현재-365일) 시각을 ISO 8601로 지정해 최근 1년 영상만 검색함.
    order="relevance", relevanceLanguage="ko"로 한국어 관련 영상을 우선 정렬함.
    YOUTUBE_API_KEY 미설정·할당량 초과·네트워크 오류 시 빈 리스트로 graceful 처리함.
    """
    import html
    import os

    # build: YouTube Data API v3 클라이언트를 생성하는 google-api-python-client 함수
    from googleapiclient.discovery import build

    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        print("  [경고] YOUTUBE_API_KEY 미설정(빈 결과로 진행)", file=sys.stderr)
        return []

    # 최근 1년 경계 시각을 UTC ISO 8601(...Z) 형식으로 계산함 (publishedAfter 요구 형식)
    published_after = (
        datetime.now(timezone.utc) - timedelta(days=RECENT_DAYS)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")

    try:
        youtube = build("youtube", "v3", developerKey=api_key)
        request = youtube.search().list(
            q=query,
            part="snippet",          # 제목·채널·설명 등 기본 메타데이터
            type="video",            # 영상만 (채널/재생목록 제외)
            order="relevance",
            publishedAfter=published_after,  # 최근 1년 필터 (제약 사항)
            maxResults=MAX_YOUTUBE_RESULTS,
            relevanceLanguage="ko",  # 한국어 우선
        )
        response = request.execute()
    except Exception as error:
        print(f"  [경고] YouTube 검색 실패(빈 결과로 진행): {error}", file=sys.stderr)
        return []

    # 소스 공통 형식으로 정규화 (title/snippet/link), 영상 URL을 link로 구성함
    results = []
    for item in response.get("items", []):
        snippet = item["snippet"]
        video_id = item["id"]["videoId"]
        # html.unescape(): YouTube API가 제목/설명에 넣는 HTML 엔티티(&#39; 등)를 일반 문자로 복원함
        title = html.unescape(snippet["title"])
        channel = html.unescape(snippet["channelTitle"])
        results.append(
            {
                "title": f"{title} ({channel})",
                "snippet": html.unescape(snippet.get("description", "")),
                "link": f"https://www.youtube.com/watch?v={video_id}",
            }
        )
    return results


# 소스명 → (검색 함수, RouteDecision의 검색어 속성명, 한글 라벨) 매핑
SOURCE_REGISTRY = {
    "vectorstore": (search_vectorstore, "vectorstore_query", "특허법 벡터DB"),
    "web": (search_web, "web_query", "웹검색(DuckDuckGo)"),
    "youtube": (search_youtube, "youtube_query", "YouTube"),
}


# ---------------------------------------------------------------------------
# 3. 검색 실행 (라우팅 결과에 따라 선택된 소스만 검색)
# ---------------------------------------------------------------------------

def dispatch_searches(decision: RouteDecision) -> dict[str, list[dict]]:
    """RouteDecision에 따라 선택된 소스만 각자의 검색어로 검색하여 결과를 모음.

    소스별로 재작성된 검색어(Query Rewriting 결과)를 사용함. 검색어가 비어 있으면 건너뜀.
    반환: {소스명: [검색결과...]} 형태로 종합 단계에 전달함.
    """
    collected: dict[str, list[dict]] = {}
    for source in decision.sources:
        if source not in SOURCE_REGISTRY:
            continue  # 스키마가 Literal로 막지만, 방어적으로 알 수 없는 소스는 무시함
        search_fn, query_attr, label = SOURCE_REGISTRY[source]
        # getattr(decision, query_attr): RouteDecision에서 이 소스용으로 재작성된 검색어를 꺼냄
        source_query = getattr(decision, query_attr).strip()
        if not source_query:
            print(f"  - [{label}] 검색어 없음 → 건너뜀")
            continue
        print(f"  - [{label}] 검색어: '{source_query}'")
        collected[source] = search_fn(source_query)
        print(f"    → {len(collected[source])}건")
    return collected


# ---------------------------------------------------------------------------
# 4. 검색 결과 → 컨텍스트 문자열 변환
# ---------------------------------------------------------------------------

def format_context(collected: dict[str, list[dict]]) -> str:
    """소스별 검색 결과를 LLM 종합용 단일 컨텍스트 문자열로 합침.

    각 소스를 헤더로 구분하고, 항목마다 제목·본문·링크를 붙여 LLM이 출처를 인용하기 쉽게 함.
    """
    blocks = []
    for source, results in collected.items():
        label = SOURCE_REGISTRY[source][2]
        if not results:
            blocks.append(f"## [{label}] 검색 결과 없음")
            continue
        lines = [f"## [{label}]"]
        for index, item in enumerate(results, start=1):
            # 벡터DB 본문은 길 수 있으나 종합 정확도를 위해 그대로 사용함 (웹/유튜브 snippet은 짧음)
            lines.append(
                f"[{index}] {item['title']}\n{item['snippet']}\n(출처: {item['link']})"
            )
        blocks.append("\n\n".join(lines))
    return "\n\n".join(blocks)


# ---------------------------------------------------------------------------
# 5. Synthesis (멀티소스 결과 종합 답변 생성)
# ---------------------------------------------------------------------------

def create_synthesis_llm():
    """종합 답변 생성용 Groq LLM을 생성함.

    gpt-oss-120b는 추론 모델이라 사고 과정이 답변에 섞일 수 있으므로
    reasoning_format="hidden"으로 최종 답변 텍스트만 받도록 함. temperature=0으로 결정적 답변.
    """
    from langchain_groq import ChatGroq

    return ChatGroq(model=LLM_MODEL, temperature=0, reasoning_format="hidden")


def synthesize_answer(query: str, collected: dict[str, list[dict]], llm) -> str:
    """수집된 멀티소스 검색 결과를 근거로 종합 답변을 생성함.

    (prompt | llm | StrOutputParser) LCEL 체인에 컨텍스트·질문을 주입함.
    검색 결과가 하나도 없으면 LLM을 호출하지 않고 안내 메시지를 반환함.
    """
    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.prompts import ChatPromptTemplate

    # 모든 소스가 빈 결과면 토큰 낭비 없이 즉시 안내 (DDG rate limit 등으로 전멸한 경우)
    if not any(collected.values()):
        return "선택된 소스에서 관련 정보를 찾지 못했습니다. 질문을 바꾸거나 잠시 후 다시 시도해 주세요."

    context = format_context(collected)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYNTHESIS_SYSTEM_PROMPT),
            ("human", "[검색 결과]\n{context}\n\n[질문]\n{question}\n\n[답변]"),
        ]
    )
    # StrOutputParser: LLM의 AIMessage 응답에서 본문 텍스트만 추출함
    chain = prompt | llm | StrOutputParser()
    return chain.invoke({"context": context, "question": query})


# ---------------------------------------------------------------------------
# 6. 결과 출력
# ---------------------------------------------------------------------------

def print_result(query: str, decision: RouteDecision, collected: dict[str, list[dict]], answer: str) -> None:
    """질의어·라우팅 결정·종합 답변·소스별 출처를 보기 좋게 콘솔에 출력함."""
    print("\n" + "=" * 70)
    print(f"[질문] {query}")
    print("=" * 70)
    print(f"[라우팅] 선택 소스: {decision.sources}")
    print(f"[라우팅] 이유: {decision.reasoning}")
    print("-" * 70)
    print(f"[답변]\n{answer}")
    print("\n" + "-" * 70)
    print("[검색 출처]")
    for source, results in collected.items():
        label = SOURCE_REGISTRY[source][2]
        print(f"  · {label}: {len(results)}건")
        for index, item in enumerate(results, start=1):
            print(f"    [{index}] {item['title'][:50]} | {item['link']}")
    print("=" * 70)


# ---------------------------------------------------------------------------
# 메인 파이프라인
# ---------------------------------------------------------------------------

def main() -> None:
    """라우팅 → 소스별 검색 → 종합 → 출력 순으로 멀티소스 RAG를 실행함."""
    # 명령줄 인자가 있으면 질의어로 사용하고, 없으면 기본 질의어를 사용함
    query = " ".join(sys.argv[1:]).strip() or DEFAULT_QUERY

    print("[1/3] Query Router: 질문 분석 → 소스 선택 + 소스별 검색어 생성")
    router_llm = create_router_llm()
    decision = route_query(query, router_llm)
    print(f"  - 선택 소스: {decision.sources}")

    print("[2/3] 멀티소스 검색 (선택된 소스만)")
    collected = dispatch_searches(decision)

    print("[3/3] Synthesis: 검색 결과 종합 답변 생성")
    synthesis_llm = create_synthesis_llm()
    answer = synthesize_answer(query, collected, synthesis_llm)

    print_result(query, decision, collected, answer)


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # 실행 중 오류를 명확히 출력하고 비정상 종료 코드로 빠져나감
        print(f"\n[오류] 멀티소스 RAG 실행 실패: {error}", file=sys.stderr)
        sys.exit(1)
