#!/usr/bin/env python3
"""특허/지식재산권 Agentic GraphRAG 챗봇 (LangGraph StateGraph + Groq gpt-oss-120b)

LangGraph StateGraph로 Self-RAG의 자기 성찰 루프와 멀티소스 라우팅을 결합한 Agentic RAG 예제임.
Agent가 스스로 (1) 검색 필요 여부와 (2) 검색 소스(특허법 GraphRAG·웹·YouTube)를 선택하고,
답변 품질을 자체 평가(근거성·유용성)하여 미흡하면 질문을 재작성해 재검색함.

[12.web-youtube-search/agentic-rag 대비 핵심 변경 사항 — "Vector DB만 LangChain+Neo4j GraphRAG로 교체"]
  Before: 법률 소스 = ChromaDB 벡터 DB(컬렉션 patent_law)에 대한 단순 유사도 검색
  After : 법률 소스 = Neo4j GraphRAG 하이브리드 검색
          (1) doc_embedding 벡터 검색으로 관련 조문 청크 확보 (조문 원문)
          (2) entity_embedding 벡터 검색으로 진입 엔티티 확보 → 1-hop 그래프 확장으로 관계 추론 근거 확보
          → 조문 원문(Vector) + 엔티티 관계(Graph)를 결합해 멀티홉 질문에 강함
  나머지(Self-RAG 성찰 루프·웹·YouTube·라우팅·출처 구성)는 그대로 유지함 (검색 백엔드만 교체).

[Reflection / 라우팅 신호]
  Route   : 특허/지식재산권 질문인지(검색 필요) + 어떤 소스로 검색할지 판단 (Retrieve 토큰 확장)
  IsRel   : GraphRAG 검색 결과(조문 청크·그래프 관계)가 질문과 관련 있는지 일괄 평가 (관련 문서만 선별)
  IsSup   : 생성된 답변이 컨텍스트에 근거하는지 검증 (환각 방지, 미흡 시 엄격 근거 기반 재생성)
  IsUse   : 최종 답변이 유용한지 평가 (미흡 시 Query Rewriting 후 처음부터 재검색, 최대 3회)

사전 요구사항:
  1) docker compose up -d --wait 로 Neo4j(graphrag-simple-neo4j) 기동
  2) indexing/index_documents.py 로 특허법.pdf KG + 벡터 인덱스 구축

사용법:
  python app.py            # 대화형 챗봇 (멀티턴 대화, 'clear' 초기화, 'quit' 종료)
  python app.py --demo     # 교재 검증 질의를 비대화형으로 순차 실행
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import html
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any, Literal, Optional, TypedDict

# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from dotenv import load_dotenv
from pydantic import BaseModel, Field

# ChatGroq: Groq LPU 채팅 모델 래퍼 (llm.invoke()로 대화 요청 전송)
from langchain_groq import ChatGroq
# Neo4jGraph: Cypher 실행을 감싼 LangChain Neo4j 래퍼 (벡터 검색·그래프 탐색에 사용)
from langchain_neo4j import Neo4jGraph
from langchain_openai import OpenAIEmbeddings             # OpenAI 임베딩 모델 (질의 벡터화)
from langchain_core.documents import Document             # LangChain 문서 객체 타입
from langchain_core.prompts import ChatPromptTemplate     # LLM 프롬프트 템플릿
from langchain_core.output_parsers import StrOutputParser  # LLM 출력에서 문자열만 추출

# DuckDuckGoSearchAPIWrapper: 무료 웹 검색 유틸리티 (API 키 불필요, .results()로 링크 포함 결과 반환)
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper

# build: YouTube Data API v3 클라이언트를 생성하는 google-api-python-client 함수
from googleapiclient.discovery import build

# StateGraph: 상태(State)를 노드 사이로 흘려보내며 워크플로우를 구성하는 LangGraph 그래프
# START/END: 그래프의 가상 시작·종료 지점을 나타내는 특수 노드
from langgraph.graph import StateGraph, START, END

# ---------------------------------------------------------------------------
# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(agentic-rag/)를 절대경로로 구함
SIMPLE_ROOT = SCRIPT_DIR.parent                 # 14.graphrag/simple/
HANDS_ON_DIR = SIMPLE_ROOT.parent.parent        # hands-on/
ENV_PATH = HANDS_ON_DIR / ".env"                # hands-on/.env (API 키 보관)

# .env에서 GROQ_API_KEY(LLM)·OPENAI_API_KEY(임베딩)·YOUTUBE_API_KEY(영상 검색)를 로드함
load_dotenv(ENV_PATH)
# agentic-rag/.env가 있으면 Neo4j 접속정보 등을 로컬 오버라이드함
if (SCRIPT_DIR / ".env").exists():
    load_dotenv(SCRIPT_DIR / ".env", override=True)

# ---------------------------------------------------------------------------
# 상수 정의
# ---------------------------------------------------------------------------
LLM_MODEL = "openai/gpt-oss-120b"            # Groq LPU에서 서빙하는 OpenAI gpt-oss 120B 모델
EMBEDDING_MODEL = "text-embedding-3-small"   # 인덱싱과 동일 임베딩 모델 (1536차원, 다르면 검색 불가)
EMBEDDING_DIM = 1536                         # 임베딩 차원 (인덱싱 벡터 인덱스와 일치해야 함)

# Neo4j 접속 (docker-compose.yml·indexing settings 기본값과 일치 — 7688 Bolt)
NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7688")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "password")

# GraphRAG 벡터 인덱스 이름 (인덱싱에서 생성한 이름과 동일해야 함)
ENTITY_INDEX_NAME = "entity_embedding"       # KG 엔티티(id+description) 벡터 인덱스
DOC_INDEX_NAME = "doc_embedding"             # 조문 청크 텍스트 벡터 인덱스

ENTITY_TOP_K = 8                             # entity_embedding 진입 엔티티 검색 수 (멀티홉 커버리지 위해 5→8 상향)
DOC_TOP_K = 5                                # doc_embedding 조문 청크 검색 수
GRAPH_EXPAND_LIMIT = 40                      # 진입 엔티티의 1-hop 관계 확장 최대 건수 (멀티홉 위해 20→40 상향)

WEB_MAX_RESULTS = 5                          # 웹(DuckDuckGo) 검색 결과 수 (MUST: 최신 5개)
YOUTUBE_MAX_RESULTS = 5                      # YouTube 검색 결과 수
RECENT_DAYS = 365                            # 웹·YouTube 검색 최근 1년 필터 (MUST)
MAX_RETRIES = 3                              # [IsUse] 실패 시 Query Rewriting 재시도 최대 횟수
HISTORY_TURNS = 6                            # 프롬프트에 포함할 직전 대화 메시지 수 (멀티턴 맥락)
RECURSION_LIMIT = 50                         # 재시도 루프가 그래프 기본 한계(25)에 걸리지 않도록 상향

# KG 합성 문서의 출처 표기 (조문 원문과 구분해 '그래프 관계 근거'임을 명시)
KG_SOURCE_LABEL = "특허법 지식그래프(KG)"

# 법령 조항(제29조, 제42조의2 등)을 본문에서 추출하기 위한 정규식 (출처 표기에 사용)
ARTICLE_PATTERN = re.compile(r"제\d+조(?:의\d+)?")


# ---------------------------------------------------------------------------
# 라우팅 / Reflection 토큰 스키마 정의 (Pydantic)
# ---------------------------------------------------------------------------
# with_structured_output()이 아래 스키마대로 LLM 출력을 강제해 안정적으로 파싱함

class RouteDecision(BaseModel):
    """라우터 결과: 검색 필요 여부 + 선택 소스 + 소스별 최적 쿼리 (Retrieve 토큰 확장)."""
    needs_retrieval: bool = Field(description="특허/지식재산권 질문이라 외부 검색이 필요한지 여부")
    sources: list[Literal["graphrag", "web", "youtube"]] = Field(
        description="검색에 사용할 소스 목록 (graphrag=특허법 조문·관계, web=최신/비용/사례, youtube=영상/튜토리얼)"
    )
    web_query: str = Field(description="웹 검색용 쿼리. 연도·시간 표현 제외 (예: '2024' 금지)")
    youtube_query: str = Field(description="YouTube 검색용 쿼리. 쉼표 없이 짧은 키워드로 작성")
    reasoning: str = Field(description="판단 근거 (한국어 한 문장)")


class RelevanceGrade(BaseModel):
    """[IsRel] 토큰 결과: GraphRAG 검색 문서 한 건의 관련성 평가."""
    document_index: int = Field(description="평가 대상 문서의 인덱스 (0부터 시작)")
    is_relevant: bool = Field(description="해당 문서가 질문과 관련 있는지 여부")


class BatchRelevanceGrade(BaseModel):
    """[IsRel] 토큰 결과: 여러 문서의 관련성 일괄 평가 (1회 LLM 호출로 전체 평가)."""
    results: list[RelevanceGrade] = Field(description="각 문서의 관련성 평가 결과 리스트")


class SupportGrade(BaseModel):
    """[IsSup] 토큰 결과: 답변의 근거성 평가."""
    is_supported: bool = Field(description="생성된 답변이 검색 컨텍스트에 근거하는지 여부")
    reasoning: str = Field(description="근거성 판단 이유 (한국어 한 문장)")


class UsefulnessGrade(BaseModel):
    """[IsUse] 토큰 결과: 답변 유용성 평가."""
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

    각 노드는 이 딕셔너리의 일부 키만 갱신해 반환하면, LangGraph가 기존 상태에 병합함.
    """
    question: str               # 현재 처리 중 질문 (Query Rewriting 시 갱신됨)
    original_question: str      # 최초 사용자 질문 (유용성 평가·재작성의 기준)
    history: list               # 이전 대화 맥락 [{"role": ..., "content": ...}] (멀티턴)
    needs_retrieval: bool       # 검색 필요 여부 (라우터 판단)
    sources: list               # 선택된 검색 소스 ["graphrag", "web", "youtube"]
    web_query: str              # 웹 검색용 쿼리 (연도 제외)
    youtube_query: str          # YouTube 검색용 쿼리 (짧은 키워드)
    route_reasoning: str        # 라우팅 판단 근거
    vector_docs_raw: list       # GraphRAG 원본 검색 결과 (관련성 평가 전, 조문 청크 + KG 관계)
    vector_docs: list           # 관련성 평가를 통과한 특허법 문서
    web_results: list           # 웹 검색 결과 [{title, snippet, link}]
    youtube_results: list       # YouTube 검색 결과 [{title, channel, url}]
    answer: str                 # 출처 섹션이 포함된 최종 답변
    is_supported: Optional[bool]   # [IsSup] 근거성 평가 결과
    is_useful: Optional[bool]      # [IsUse] 유용성 평가 결과
    usefulness_reasoning: str   # 유용성 판단 근거
    retry_count: int            # 현재까지 Query Rewriting 재시도 횟수
    rewrites: list              # Query Rewriting 이력 [{from, to, reasoning}]


# ---------------------------------------------------------------------------
# GraphRAG 검색기 (Neo4j 하이브리드: 조문 벡터 + 엔티티 벡터 → 1-hop 그래프)
# ---------------------------------------------------------------------------

class GraphRetriever:
    """Neo4j GraphRAG 하이브리드 검색기 — ChromaDB 검색기를 대체함.

    [기존 ChromaDB 검색기와의 차이]
      Before: vectorstore.as_retriever().invoke(question) → 유사 청크 List[Document]
      After : 아래 두 벡터 인덱스를 결합해 List[Document]를 반환 (다운스트림 코드 무변경)
        1) doc_embedding   : 질문과 유사한 조문 청크 (조문 원문 → ARTICLE_PATTERN으로 조항 추출)
        2) entity_embedding: 질문과 유사한 진입 엔티티 → 1-hop 그래프 확장으로 관계 추론 근거 확보
    반환 Document는 page_content(조문/관계 텍스트)와 metadata(source·chunk_index)를 채워,
    grade_documents·build_context·build_sources_section이 수정 없이 그대로 동작함.
    """

    def __init__(self, graph: Neo4jGraph, embeddings: OpenAIEmbeddings):
        self.graph = graph
        self.embeddings = embeddings

    def retrieve(self, question: str) -> list[Document]:
        """질문에 대한 GraphRAG 하이브리드 검색을 수행해 List[Document]로 반환함."""
        embedding = self.embeddings.embed_query(question)
        if len(embedding) != EMBEDDING_DIM:
            # 인덱싱과 질의 임베딩 차원이 다르면 Neo4j 벡터 검색이 실패하므로 조기에 오류를 알림
            raise ValueError(f"임베딩 차원 불일치: 실제 {len(embedding)} != 기대 {EMBEDDING_DIM}")

        doc_hits = self._query_doc_vectors(embedding, DOC_TOP_K)
        entity_hits = self._query_entity_vectors(embedding, ENTITY_TOP_K)
        relations = self._expand_graph([hit["id"] for hit in entity_hits if hit.get("id")])

        documents: list[Document] = []
        # 1) 조문 청크 → 법률 근거(원문). page_content가 조문 원문이라 ARTICLE_PATTERN이 조항을 추출함
        for hit in doc_hits:
            documents.append(Document(
                page_content=hit.get("text", ""),
                metadata={
                    "source": hit.get("source") or "특허법.pdf",
                    "source_type": hit.get("source_type") or "law",
                    "chunk_index": hit.get("chunk_index"),
                    "score": hit.get("score"),
                    "kind": "document",
                },
            ))
        # 2) 진입 엔티티 + 1-hop 관계 → 그래프 관계 근거(멀티홉 추론). 1건의 합성 Document로 묶음
        kg_text = self._build_kg_text(entity_hits, relations)
        if kg_text:
            documents.append(Document(
                page_content=kg_text,
                metadata={
                    "source": KG_SOURCE_LABEL,
                    "source_type": "graph",
                    "chunk_index": 0,
                    "kind": "graph",
                },
            ))
        return documents

    def _query_doc_vectors(self, embedding: list[float], limit: int) -> list[dict[str, Any]]:
        """doc_embedding 벡터 인덱스에서 유사 조문 청크를 검색함.

        db.index.vector.queryNodes(index, k, vector): Neo4j 내장 벡터 검색 프로시저로,
        주어진 임베딩과 코사인 유사도가 높은 상위 k개 노드와 score를 반환함.
        """
        return self.graph.query(
            "CALL db.index.vector.queryNodes($index, $limit, $embedding) "
            "YIELD node, score "
            "RETURN node.id AS id, "
            "       coalesce(node.text, '') AS text, "
            "       coalesce(node.source, '') AS source, "
            "       coalesce(node.source_type, '') AS source_type, "
            "       node.chunk_index AS chunk_index, "
            "       score "
            "ORDER BY score DESC",
            params={"index": DOC_INDEX_NAME, "limit": limit, "embedding": embedding},
        )

    def _query_entity_vectors(self, embedding: list[float], limit: int) -> list[dict[str, Any]]:
        """entity_embedding 벡터 인덱스에서 질문과 유사한 진입 엔티티를 검색함."""
        return self.graph.query(
            "CALL db.index.vector.queryNodes($index, $limit, $embedding) "
            "YIELD node, score "
            "RETURN node.id AS id, "
            "       coalesce(node.description, node.text, '') AS description, "
            "       [l IN labels(node) WHERE l <> '__Entity__'] AS labels, "
            "       score "
            "ORDER BY score DESC",
            params={"index": ENTITY_INDEX_NAME, "limit": limit, "embedding": embedding},
        )

    def _expand_graph(self, seed_ids: list[str]) -> list[dict[str, Any]]:
        """진입 엔티티의 1-hop 이웃 관계를 조회함 (그래프 기반 멀티홉 추론 근거).

        양쪽 끝이 모두 __Entity__인 관계만 남기고 MENTIONS(출처 Document→엔티티)는 제외해,
        해시 id를 가진 원본 Document 노드가 결과에 섞이지 않게 함.
        """
        if not seed_ids:
            return []
        try:
            return self.graph.query(
                "MATCH (n:__Entity__)-[r]-(m:__Entity__) "
                "WHERE n.id IN $seed_ids AND type(r) <> 'MENTIONS' "
                "WITH n, r, m, CASE WHEN startNode(r) = n THEN 'out' ELSE 'in' END AS direction "
                "RETURN n.id AS source, "
                "       type(r) AS relation, "
                "       direction, "
                "       m.id AS target, "
                "       coalesce(m.description, m.text, m.id) AS target_text "
                "LIMIT $limit",
                params={"seed_ids": seed_ids, "limit": GRAPH_EXPAND_LIMIT},
            )
        except Exception as error:
            print(f"  ! 1-hop 그래프 확장 실패(무시): {error}")
            return []

    @staticmethod
    def _build_kg_text(entity_hits: list[dict[str, Any]], relations: list[dict[str, Any]]) -> str:
        """진입 엔티티와 1-hop 관계를 LLM 컨텍스트용 텍스트로 합성함."""
        if not entity_hits and not relations:
            return ""
        parts: list[str] = []
        if entity_hits:
            parts.append("[지식그래프 관련 엔티티]")
            for hit in entity_hits:
                labels = ",".join(hit.get("labels") or []) or "Entity"
                description = (hit.get("description") or "").strip()
                parts.append(f"- {hit.get('id')} ({labels}): {description[:200]}")
        if relations:
            parts.append("[지식그래프 관계 (멀티홉 추론 근거)]")
            for row in relations:
                arrow = "->" if row.get("direction") == "out" else "<-"
                target_text = (row.get("target_text") or "").strip()
                parts.append(
                    f"- {row.get('source')} {arrow}[{row.get('relation')}] "
                    f"{row.get('target')} ({target_text[:120]})"
                )
        return "\n".join(parts)


# ---------------------------------------------------------------------------
# 외부 자원 준비 (LLM / 그래프 검색기 / 검색 도구)
# ---------------------------------------------------------------------------

def build_llm() -> ChatGroq:
    """Groq LPU의 gpt-oss-120b 모델 인스턴스를 생성함.

    temperature=0으로 고정해 라우팅·평가 등 구조화 판단을 재현 가능하게 함.
    GROQ_API_KEY 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY가 설정되지 않음. hands-on/.env를 확인하세요.")
    return ChatGroq(model=LLM_MODEL, temperature=0, api_key=api_key)


def load_graph() -> tuple[Neo4jGraph, OpenAIEmbeddings]:
    """특허법 GraphRAG용 Neo4j 연결과 질의 임베딩을 준비함 (검색 전용).

    인덱싱과 동일한 임베딩 모델(text-embedding-3-small, 1536차원)을 지정해야
    질의 벡터와 저장 벡터의 차원·의미 공간이 일치하여 검색이 정상 동작함.
    벡터 인덱스(entity_embedding·doc_embedding)가 없으면 인덱싱 선행을 안내함.
    """
    try:
        graph = Neo4jGraph(url=NEO4J_URI, username=NEO4J_USER, password=NEO4J_PASSWORD)
    except Exception as error:
        raise RuntimeError(
            f"Neo4j 연결 실패: {error}\n"
            f"먼저 'docker compose up -d --wait'로 graphrag-simple-neo4j를 기동하세요 ({NEO4J_URI})."
        )
    # 벡터 인덱스 존재 여부 확인 — 없으면 인덱싱이 선행되지 않은 것
    index_names = {row["name"] for row in graph.query("SHOW INDEXES YIELD name RETURN name")}
    missing = {ENTITY_INDEX_NAME, DOC_INDEX_NAME} - index_names
    if missing:
        raise RuntimeError(
            f"벡터 인덱스 누락: {', '.join(sorted(missing))}\n"
            f"먼저 'indexing/index_documents.py'를 실행해 특허법 KG·벡터 인덱스를 구축하세요."
        )
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL, api_key=os.environ.get("OPENAI_API_KEY"))
    return graph, embeddings


def search_web(query: str) -> list[dict]:
    """DuckDuckGo로 최근 1년 웹 문서를 검색하여 링크 포함 결과를 반환함.

    DuckDuckGoSearchAPIWrapper의 .results()는 .run()(텍스트만)과 달리 title·snippet·link를
    담은 딕셔너리 리스트를 반환하므로, 출처 URL 표기가 필요한 본 예제에 적합함.
    time="y"로 최근 1년만 검색하므로 쿼리에는 연도·시간 표현을 넣지 않음.
    """
    wrapper = DuckDuckGoSearchAPIWrapper(
        region="ko-kr",            # 한국어/한국 지역 결과 우선
        time="y",                  # 최근 1년 필터 (MUST)
        max_results=WEB_MAX_RESULTS,
    )
    # results(query, max_results): 상세 결과 리스트 반환 (생성자 외에 호출 시에도 개수를 명시)
    raw_results = wrapper.results(query, WEB_MAX_RESULTS)
    normalized = []
    for item in raw_results:
        link = item.get("link", "")
        # 웹 결과에 섞여 들어온 YouTube 페이지는 제외함. 영상은 YouTube Data API 검색이 담당하므로,
        # '웹' 출처에 YouTube 링크가 표기되어 소스가 뒤섞이는 것을 막음 (웹/영상 소스 분리).
        if "youtube.com" in link or "youtu.be" in link:
            continue
        normalized.append({
            "title": item.get("title", "제목 없음"),
            "snippet": item.get("snippet", ""),
            "link": link,
        })
    return normalized


def search_youtube(query: str) -> list[dict]:
    """YouTube Data API v3로 최근 1년 영상을 검색하여 제목·채널·URL을 반환함.

    publishedAfter에 1년 전 시각(ISO 8601)을 지정해 최신 영상만 검색하고, relevanceLanguage="ko"로
    한국어 영상을 우선함. 제목의 HTML 엔티티(&#39; 등)는 html.unescape로 사람이 읽는 형태로 복원함.
    """
    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        raise RuntimeError("YOUTUBE_API_KEY가 설정되지 않음. hands-on/.env를 확인하세요.")
    # build("youtube", "v3", ...): YouTube Data API v3 호출용 클라이언트 객체 생성
    youtube = build("youtube", "v3", developerKey=api_key)
    # 최근 1년 필터: 현재(UTC)에서 365일을 뺀 시각을 API가 요구하는 ISO 8601 문자열로 변환
    published_after = (
        datetime.now(timezone.utc) - timedelta(days=RECENT_DAYS)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")
    request = youtube.search().list(
        q=query,
        part="snippet",            # 제목·채널명 등 기본 메타데이터 반환
        type="video",              # 영상만 검색 (채널·재생목록 제외)
        order="relevance",         # 관련성 순 정렬
        publishedAfter=published_after,  # 최근 1년 영상만 (MUST)
        maxResults=YOUTUBE_MAX_RESULTS,
        relevanceLanguage="ko",    # 한국어 영상 우선
    )
    response = request.execute()
    results = []
    for item in response.get("items", []):
        video_id = item["id"]["videoId"]
        results.append({
            "title": html.unescape(item["snippet"]["title"]),
            "channel": html.unescape(item["snippet"]["channelTitle"]),
            "url": f"https://www.youtube.com/watch?v={video_id}",
        })
    return results


# ---------------------------------------------------------------------------
# 보조 함수 (대화 맥락 / 컨텍스트 / 출처)
# ---------------------------------------------------------------------------

def format_history(history: list) -> str:
    """직전 대화 메시지를 프롬프트에 넣을 텍스트로 변환함 (멀티턴 맥락 제공)."""
    if not history:
        return "(이전 대화 없음)"
    # 최근 HISTORY_TURNS개 메시지만 사용해 토큰·비용을 제한함
    recent = history[-HISTORY_TURNS:]
    lines = []
    for message in recent:
        speaker = "사용자" if message["role"] == "user" else "어시스턴트"
        lines.append(f"{speaker}: {message['content']}")
    return "\n".join(lines)


def build_context(state: AgentState) -> str:
    """GraphRAG·웹·YouTube 검색 결과를 답변 생성용 단일 컨텍스트 문자열로 합침."""
    sections = []
    # 1) 특허법 GraphRAG (조문 원문 + 지식그래프 관계)
    if state["vector_docs"]:
        law_parts = []
        for i, doc in enumerate(state["vector_docs"], 1):
            source = doc.metadata.get("source", "특허법")
            chunk_index = doc.metadata.get("chunk_index", "?")
            law_parts.append(f"[법률 {i}] (출처: {source} #{chunk_index})\n{doc.page_content}")
        sections.append("=== 특허법 GraphRAG (조문 + 지식그래프) ===\n" + "\n\n".join(law_parts))
    # 2) 웹 검색 결과 (최신 정보·비용·사례)
    if state["web_results"]:
        web_parts = []
        for i, item in enumerate(state["web_results"], 1):
            web_parts.append(f"[웹 {i}] {item['title']}\n{item['snippet']}\nURL: {item['link']}")
        sections.append("=== 웹 검색 결과 (DuckDuckGo, 최근 1년) ===\n" + "\n\n".join(web_parts))
    # 3) YouTube 검색 결과 (튜토리얼·영상)
    if state["youtube_results"]:
        yt_parts = []
        for i, item in enumerate(state["youtube_results"], 1):
            yt_parts.append(f"[영상 {i}] {item['title']} ({item['channel']})\nURL: {item['url']}")
        sections.append("=== YouTube 검색 결과 (최근 1년) ===\n" + "\n\n".join(yt_parts))
    return "\n\n".join(sections) if sections else "(검색 결과 없음)"


def build_sources_section(state: AgentState) -> str:
    """수집된 검색 결과 메타데이터로 '출처' 섹션을 코드에서 직접 구성함.

    URL 누락을 막기 위해 LLM 출력에 의존하지 않고, 검색 단계에서 모은 링크를 그대로 표기함(MUST).
    법률은 본문에서 추출한 조항(제29조 등), 웹·YouTube는 제목+URL 링크를 마크다운으로 출력함.
    """
    blocks = []

    # 법률 출처: 문서 출처(법령명)별로 본문에서 조항 번호를 추출해 묶음
    if state["vector_docs"]:
        law_articles: dict[str, list[str]] = {}
        for doc in state["vector_docs"]:
            # 메타데이터 source는 PDF 파일명/그래프 라벨이므로 확장자를 떼어 출처명으로 사용
            law_name = Path(doc.metadata.get("source", "특허법")).stem or "특허법"
            law_articles.setdefault(law_name, [])
            for article in ARTICLE_PATTERN.findall(doc.page_content):
                # 같은 조항이 여러 청크에 걸쳐 등장할 수 있으므로 중복은 제외하고 순서를 보존함
                if article not in law_articles[law_name]:
                    law_articles[law_name].append(article)
        law_lines = []
        for law_name, articles in law_articles.items():
            if articles:
                law_lines.append(f"- {law_name} {', '.join(articles)}")
            else:
                law_lines.append(f"- {law_name}")
        blocks.append("**법률**\n" + "\n".join(law_lines))

    # 웹 출처: 제목 + URL 링크 (반드시 포함)
    if state["web_results"]:
        web_lines = [f"- [{item['title']}]({item['link']})" for item in state["web_results"] if item["link"]]
        if web_lines:
            blocks.append("**웹**\n" + "\n".join(web_lines))

    # YouTube 출처: 제목 + URL 링크 (반드시 포함)
    if state["youtube_results"]:
        yt_lines = [f"- [{item['title']}]({item['url']})" for item in state["youtube_results"] if item["url"]]
        if yt_lines:
            blocks.append("**YouTube**\n" + "\n".join(yt_lines))

    if not blocks:
        return ""
    return "## 출처\n" + "\n\n".join(blocks)


# ---------------------------------------------------------------------------
# Agentic RAG 본체 (LangGraph 노드 + 그래프 구성)
# ---------------------------------------------------------------------------

class AgenticRAG:
    """LangGraph StateGraph 기반 Agentic GraphRAG 워크플로우.

    LLM·GraphRAG 검색기·구조화 평가기를 보유하고, 각 노드 메서드를 그래프에 등록해 컴파일함.

    노드 구성:
      route            : 검색 필요 여부 + 검색 소스 + 소스별 쿼리 결정 (Route)
      retrieve         : 선택된 소스(GraphRAG·웹·YouTube)에서 검색 수행
      grade_documents  : GraphRAG 문서 관련성 일괄 평가 (IsRel)
      generate         : 검색 컨텍스트 기반 답변 생성 + 근거성 검증·재생성 (IsSup) + 출처 부착
      grade_generation : 답변 유용성 평가 (IsUse)
      rewrite          : 유용성 미달 시 질문 재작성 (Query Rewriting)
      direct_answer    : 특허 외 질문은 LLM 지식으로 직접 답변

    엣지 구성:
      START → route
      route ─(검색 필요)→ retrieve / ─(불필요)→ direct_answer
      retrieve → grade_documents → generate → grade_generation
      grade_generation ─(유용/재시도 소진)→ END / ─(유용 미달)→ rewrite → route (재검색 루프)
      direct_answer → END
    """

    def __init__(self, llm: ChatGroq, graph: Neo4jGraph, embeddings: OpenAIEmbeddings):
        self.llm = llm
        # ChromaDB 검색기 대신 Neo4j GraphRAG 하이브리드 검색기를 사용 (반환 타입은 동일 List[Document])
        self.graph_retriever = GraphRetriever(graph, embeddings)
        # with_structured_output(method="json_schema"): LLM 응답을 Pydantic 스키마(JSON)로 강제함.
        # gpt-oss-120b는 기본 function_calling 모드에서 도구 이름을 잘못 생성해 호출이 실패할 수 있어,
        # 도구 이름이 없는 json_schema 방식으로 안정성을 확보함 (Self-RAG 예제에서 검증된 설정).
        self.router = llm.with_structured_output(RouteDecision, method="json_schema")
        self.relevance_grader = llm.with_structured_output(BatchRelevanceGrade, method="json_schema")
        self.support_grader = llm.with_structured_output(SupportGrade, method="json_schema")
        self.usefulness_grader = llm.with_structured_output(UsefulnessGrade, method="json_schema")
        self.query_rewriter = llm.with_structured_output(RewrittenQuery, method="json_schema")
        # 노드들을 연결한 실행 가능한 그래프를 미리 컴파일해 둠
        self.graph = self._build_graph()

    # ===== 노드 1: Route (검색 필요 여부 + 소스 + 소스별 쿼리) =====
    def route(self, state: AgentState) -> dict:
        """라우터 노드: 특허 질문인지·어떤 소스로 검색할지 판단하고 소스별 쿼리를 생성함."""
        print("\n[Route] 검색 필요 여부 및 소스 판단 중...")
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 특허/지식재산권 전문 챗봇의 라우터입니다. 사용자 질문을 분석해 검색 전략을 결정하세요.

[검색 필요 = True] — 특허·실용신안·상표·디자인권 등 지식재산권 관련 질문
  사용 가능한 소스를 적절히 선택하세요 (복수 선택 가능):
  - graphrag : 특허법 조문·요건·절차나 개념 간 '관계'가 필요할 때 (조문 원문 + 지식그래프)
  - web      : 비용·통계·최신 동향·사례 등 '최신 정보'가 필요할 때
  - youtube  : 강의·튜토리얼·시각적 설명 등 '영상'을 원할 때

[검색 불필요 = False] — 아래는 검색하지 않고 LLM 지식으로 직접 답변
  - 인사·잡담 (예: 안녕하세요)
  - 특허/지식재산권과 무관한 주제 (예: 일반 IT 기술, 다른 법률, RAG 같은 개발 주제)
    → 이 챗봇은 특허 전문이므로 그 외 주제는 검색하지 않음

[쿼리 작성 규칙]
  - web_query  : 검색에 적합한 핵심 키워드. 연도·시간 표현(2024 등)은 절대 넣지 마세요.
  - youtube_query : 쉼표 없이 짧은 키워드로 작성 (예: '특허 출원 방법').
  - 검색 불필요(False)면 web_query·youtube_query는 빈 문자열로 두세요.

이전 대화 맥락을 참고해 후속 질문(예: '그럼 비용은?')의 의도를 정확히 파악하세요.
판단 근거(reasoning)는 한국어로 작성하세요."""),
            ("human", "이전 대화:\n{history}\n\n현재 질문: {question}\n\n검색 전략을 결정하세요."),
        ])
        decision: RouteDecision = (prompt | self.router).invoke({
            "history": format_history(state.get("history", [])),
            "question": state["question"],
        })
        # 검색 불필요로 판단되면 소스를 비워 direct_answer 경로로 흐르게 함
        sources = decision.sources if decision.needs_retrieval else []
        print(f"  → 검색 필요: {decision.needs_retrieval} / 소스: {sources or '없음'}")
        print(f"  → 근거: {decision.reasoning}")
        if sources:
            print(f"  → web_query: '{decision.web_query}' / youtube_query: '{decision.youtube_query}'")
        return {
            "needs_retrieval": decision.needs_retrieval,
            "sources": sources,
            "web_query": decision.web_query,
            "youtube_query": decision.youtube_query,
            "route_reasoning": decision.reasoning,
        }

    # ===== 노드 2: Retrieve (선택 소스에서 검색) =====
    def retrieve(self, state: AgentState) -> dict:
        """검색 노드: 라우터가 선택한 소스에서만 검색을 수행함.

        외부 API(웹·YouTube) 호출은 각각 try/except로 감싸 한 소스가 실패해도 나머지 소스로
        답변을 생성할 수 있게 함 (graceful degradation).
        """
        sources = state["sources"]
        vector_docs_raw, web_results, youtube_results = [], [], []

        # 특허법 GraphRAG 검색 (재작성된 질문 기준) — 조문 벡터 + 엔티티 벡터·1-hop 그래프
        if "graphrag" in sources:
            print("\n[Retrieve:GraphRAG] 특허법 조문·지식그래프 검색 중...")
            try:
                vector_docs_raw = self.graph_retriever.retrieve(state["question"])
                print(f"  → {len(vector_docs_raw)}개 문서 검색됨 (조문 청크 + 지식그래프)")
            except Exception as error:
                print(f"  ! GraphRAG 검색 실패(무시하고 진행): {error}")

        # 웹 검색 (DuckDuckGo, 연도 제외 쿼리)
        if "web" in sources:
            print(f"\n[Retrieve:웹] DuckDuckGo 검색 중... (쿼리: '{state['web_query']}')")
            try:
                web_results = search_web(state["web_query"] or state["question"])
                print(f"  → {len(web_results)}개 결과")
            except Exception as error:
                print(f"  ! 웹 검색 실패(무시하고 진행): {error}")

        # YouTube 검색 (Data API v3, 짧은 키워드 쿼리)
        if "youtube" in sources:
            print(f"\n[Retrieve:YouTube] 영상 검색 중... (쿼리: '{state['youtube_query']}')")
            try:
                youtube_results = search_youtube(state["youtube_query"] or state["question"])
                print(f"  → {len(youtube_results)}개 영상")
            except Exception as error:
                print(f"  ! YouTube 검색 실패(무시하고 진행): {error}")

        return {
            "vector_docs_raw": vector_docs_raw,
            "web_results": web_results,
            "youtube_results": youtube_results,
        }

    # ===== 노드 3: Grade Documents (IsRel) =====
    def grade_documents(self, state: AgentState) -> dict:
        """[IsRel] 노드: GraphRAG 검색 문서의 관련성을 1회 LLM 호출로 일괄 평가해 선별함.

        웹·YouTube 결과는 검색 자체가 키워드 기반이므로 별도 관련성 평가 없이 그대로 사용함.
        """
        docs = state["vector_docs_raw"]
        if not docs:
            return {"vector_docs": []}

        print("\n[IsRel] GraphRAG 문서 관련성 일괄 평가 중...")
        docs_text = "\n\n".join(f"[문서 {i}]\n{doc.page_content}" for i, doc in enumerate(docs))
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 검색된 특허법 문서들이 질문과 관련 있는지 평가하는 전문가입니다.

문서가 질문에 답하는 데 직접 도움이 되는 정보를 포함하면 관련 있음(True)으로 판단합니다.
부분적·간접적으로만 관련되면 관련 없음(False)으로 판단합니다.
입력된 각 문서를 그 인덱스(document_index)와 함께 개별적으로 평가하여 모두 반환하세요."""),
            ("human", "질문: {question}\n\n검색된 문서들:\n{documents}\n\n각 문서의 관련성을 평가해 주세요."),
        ])
        batch: BatchRelevanceGrade = (prompt | self.relevance_grader).invoke({
            "question": state["question"],
            "documents": docs_text,
        })
        relevant_docs = []
        for grade in batch.results:
            # 구조화 출력이 잘못된 인덱스를 줄 수 있으므로 범위를 검사해 안전하게 매핑함
            if 0 <= grade.document_index < len(docs) and grade.is_relevant:
                relevant_docs.append(docs[grade.document_index])
        print(f"  → 관련 문서 {len(relevant_docs)}/{len(docs)}개 선별")
        return {"vector_docs": relevant_docs}

    # ===== 노드 4: Generate (답변 생성 + IsSup + 출처) =====
    def generate(self, state: AgentState) -> dict:
        """생성 노드: 검색 컨텍스트로 답변을 생성하고, 근거성([IsSup])이 부족하면 엄격 재생성 후 출처를 부착함."""
        context = build_context(state)
        has_context = bool(state["vector_docs"] or state["web_results"] or state["youtube_results"])

        print("\n[Generate] 검색 결과 기반 답변 생성 중...")
        answer = self._generate_answer(state, context, strict=False)

        is_supported: Optional[bool] = None
        # 검색 컨텍스트가 있을 때만 근거성([IsSup])을 검증함 (없으면 LLM 지식 답변이라 평가 불가)
        if has_context:
            print("\n[IsSup] 답변 근거성 평가 중...")
            support: SupportGrade = self._grade_support(answer, context)
            is_supported = support.is_supported
            print(f"  → 근거 있음: {support.is_supported} ({support.reasoning})")
            if not support.is_supported:
                print("\n[Generate] 근거 부족 → 엄격 근거 기반으로 답변 재생성 중...")
                answer = self._generate_answer(state, context, strict=True)
                # 엄격 재생성한 답변(최종 반환 답변)을 다시 평가해 IsSup를 갱신함.
                # 재평가하지 않으면 첫 답변 기준 False가 그대로 보고되어, '실제 반환되는 답변'과
                # IsSup 토큰이 어긋남(Self-RAG의 IsSup는 반환되는 답변의 근거성을 기술해야 함).
                print("\n[IsSup] 재생성 답변 근거성 재평가 중...")
                support = self._grade_support(answer, context)
                is_supported = support.is_supported
                print(f"  → 재평가 근거 있음: {support.is_supported} ({support.reasoning})")

        # 출처 섹션을 코드에서 직접 구성해 URL 누락을 방지함 (MUST)
        sources_section = build_sources_section(state)
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
            ("system", """당신은 특허/지식재산권 전문 상담 AI입니다.

## 역할
- 아래 검색 컨텍스트(특허법 조문·지식그래프 관계·웹·YouTube)와 이전 대화 맥락을 종합해 질문에 답변합니다.
- 법률 용어는 일반인이 이해하기 쉽게 풀어서 설명합니다.

## 규칙
1. 컨텍스트의 정보를 우선 활용하되, 핵심을 요약해 명확히 전달
2. 지식그래프 관계가 있으면 엔티티 간 연결(요건·절차·권리 관계)을 활용해 설명
3. 영상을 검색한 경우 어떤 영상이 도움이 되는지 간단히 안내
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
        """Query Rewriting 노드: 유용성 미달 시 더 나은 검색을 위해 질문을 재작성하고 재시도 횟수를 늘림."""
        print("\n[Query Rewriting] 유용성 미달 → 질문 재작성 중...")
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 검색 쿼리를 최적화하는 전문가입니다.

원래 질문으로 시도했으나 유용한 답변을 생성하지 못했습니다. 더 나은 검색을 위해 질문을 다시 작성하세요.

## 재작성 전략
1. 모호한 표현을 구체적인 특허 용어로 변환
2. 구어체를 문어체/전문 용어로 변환
3. 특허/지식재산권 관련 정확한 핵심 키워드를 명확히 포함

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
            "question": rewritten.rewritten_query,           # 다음 route부터 이 질문으로 재검색
            "retry_count": state["retry_count"] + 1,
            "rewrites": state["rewrites"] + [{
                "from": state["question"],
                "to": rewritten.rewritten_query,
                "reasoning": rewritten.reasoning,
            }],
        }

    # ===== 노드 7: Direct Answer (검색 불필요) =====
    def direct_answer(self, state: AgentState) -> dict:
        """직접 답변 노드: 특허 외 질문·인사 등은 검색 없이 LLM 지식과 대화 맥락으로 답변함."""
        print("\n[Direct] 검색 불필요 → LLM 지식으로 직접 답변 중...")
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 특허/지식재산권 전문 챗봇입니다. 다만 이번 질문은 검색이 필요 없는 질문입니다.

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

    # ===== 조건부 엣지 (분기 판단 함수) =====
    def decide_search_path(self, state: AgentState) -> Literal["retrieve", "direct"]:
        """route 직후 분기: 검색이 필요하고 선택된 소스가 있으면 retrieve, 아니면 direct_answer로 보냄."""
        if state["needs_retrieval"] and state["sources"]:
            return "retrieve"
        return "direct"

    def decide_after_generation(self, state: AgentState) -> Literal["rewrite", "end"]:
        """grade_generation 직후 분기: 유용하면 종료, 유용 미달이고 재시도가 남았으면 rewrite로 보냄.

        재시도 횟수(retry_count) 가드를 이 엣지에서 직접 검사해 그래프가 무한 루프(GraphRecursionError)에
        빠지지 않도록 함 (rewrite 노드는 횟수만 증가시키고 종료 판단은 하지 않음).
        """
        if state["is_useful"]:
            return "end"
        if state["retry_count"] >= MAX_RETRIES:
            print(f"\n[경고] 최대 재시도({MAX_RETRIES}회) 도달 → 마지막 답변을 그대로 반환함.")
            return "end"
        return "rewrite"

    # ===== 그래프 구성 =====
    def _build_graph(self):
        """노드와 엣지를 연결해 실행 가능한 StateGraph로 컴파일함."""
        workflow = StateGraph(AgentState)        # 상태 스키마(AgentState) 기반 그래프 생성
        # 노드 등록 (이름 → 실행 함수)
        workflow.add_node("route", self.route)
        workflow.add_node("retrieve", self.retrieve)
        workflow.add_node("grade_documents", self.grade_documents)
        workflow.add_node("generate", self.generate)
        workflow.add_node("grade_generation", self.grade_generation)
        workflow.add_node("rewrite", self.rewrite)
        workflow.add_node("direct_answer", self.direct_answer)

        # 엣지 연결
        workflow.add_edge(START, "route")        # 시작 → route
        workflow.add_conditional_edges(          # route 후 검색 필요 여부로 분기
            "route",
            self.decide_search_path,
            {"retrieve": "retrieve", "direct": "direct_answer"},
        )
        workflow.add_edge("retrieve", "grade_documents")     # 검색 → 관련성 평가
        workflow.add_edge("grade_documents", "generate")     # 관련성 평가 → 답변 생성
        workflow.add_edge("generate", "grade_generation")    # 답변 생성 → 유용성 평가
        workflow.add_conditional_edges(          # 유용성 평가 후 재검색/종료 분기
            "grade_generation",
            self.decide_after_generation,
            {"rewrite": "rewrite", "end": END},
        )
        workflow.add_edge("rewrite", "route")    # 재작성 → route로 돌아가 재검색 (루프)
        workflow.add_edge("direct_answer", END)  # 직접 답변 → 종료
        return workflow.compile()                # 실행 가능한 앱으로 컴파일

    def invoke(self, question: str, history: list) -> dict:
        """질문 한 건에 대해 그래프를 실행하고 최종 상태를 반환함 (멀티턴 history 전달)."""
        initial_state: AgentState = {
            "question": question,
            "original_question": question,
            "history": history,
            "needs_retrieval": False,
            "sources": [],
            "web_query": "",
            "youtube_query": "",
            "route_reasoning": "",
            "vector_docs_raw": [],
            "vector_docs": [],
            "web_results": [],
            "youtube_results": [],
            "answer": "",
            "is_supported": None,
            "is_useful": None,
            "usefulness_reasoning": "",
            "retry_count": 0,
            "rewrites": [],
        }
        # recursion_limit: 재시도 루프가 그래프 기본 단계 한계(25)에 걸리지 않도록 상향함
        return self.graph.invoke(initial_state, config={"recursion_limit": RECURSION_LIMIT})


# ---------------------------------------------------------------------------
# 출력 / 실행
# ---------------------------------------------------------------------------

def format_summary(result: dict) -> str:
    """그래프 처리 결과(라우팅·검색·평가)를 한눈에 보이도록 요약 문자열로 만듦."""
    lines = ["=" * 60, "Agentic GraphRAG 처리 결과 요약", "=" * 60]
    if result.get("retry_count", 0) > 0:
        lines.append(f"[Retry ] 재시도 횟수 : {result['retry_count']}")
        for step, rewrite in enumerate(result.get("rewrites", []), 1):
            lines.append(f"[Rewrite {step}] {rewrite['from']} → {rewrite['to']}")
    lines.append(f"[Route ] 검색 수행 : {result['needs_retrieval']} / 소스: {result['sources'] or '없음'}")
    if result["needs_retrieval"]:
        lines.append(f"[검색  ] GraphRAG {len(result['vector_docs'])}개 / 웹 {len(result['web_results'])}개 / "
                     f"YouTube {len(result['youtube_results'])}개")
    if result["is_supported"] is not None:
        lines.append(f"[IsSup ] 근거 있음 : {result['is_supported']}")
    if result["is_useful"] is not None:
        lines.append(f"[IsUse ] 유용함   : {result['is_useful']}")
    lines.append("=" * 60)
    return "\n".join(lines)


def print_result(result: dict) -> None:
    """처리 요약과 최종 답변을 콘솔에 출력함."""
    print("\n" + format_summary(result))
    print("\n" + "-" * 60)
    print("답변:")
    print("-" * 60)
    print(result["answer"])
    print("-" * 60)


def run_demo(agent: AgenticRAG) -> None:
    """교재 검증 질의를 비대화형으로 순차 실행함 (--demo). 멀티턴 맥락도 누적 검증함."""
    demo_questions = [
        "특허 요건에 대해 법률, 웹, 영상을 검색해서 알려줘",  # GraphRAG + 웹 + YouTube 통합
        "특허 출원 비용은 ?",                                  # 소스 라우팅 (웹 중심)
        "Claude Code란?",                                      # 특허 외 주제 → 직접 답변
    ]
    history: list = []
    for idx, question in enumerate(demo_questions, 1):
        print("\n" + "#" * 60)
        print(f"# 데모 질의 {idx}/{len(demo_questions)}: {question}")
        print("#" * 60)
        result = agent.invoke(question, history)
        print_result(result)
        # 멀티턴 맥락 누적 (다음 질의가 이전 대화를 참고할 수 있게 함)
        history.append({"role": "user", "content": question})
        history.append({"role": "assistant", "content": result["answer"]})


def chat(agent: AgenticRAG) -> None:
    """대화형 챗봇 루프를 실행함 (멀티턴 대화 + 'clear' 초기화)."""
    print("\n" + "=" * 60)
    print("특허/지식재산권 Agentic GraphRAG 챗봇")
    print("=" * 60)
    print("특허 질문은 법률(Neo4j GraphRAG)·웹·YouTube를 스스로 골라 검색하고, 답변 품질을 자체 검증합니다.")
    print("멀티턴 대화를 기억합니다. 'clear' 입력 시 대화 초기화, 'quit'/'q' 입력 시 종료.")
    print("=" * 60 + "\n")

    history: list = []  # 멀티턴 대화 기록 (사용자/어시스턴트 메시지 누적)
    while True:
        try:
            question = input("질문: ").strip()
            if not question:
                continue
            if question.lower() in ("quit", "q", "exit", "종료"):
                print("\n챗봇을 종료합니다. 감사합니다!")
                break
            # clear: 이전 대화 맥락을 모두 비워 새 주제로 시작함
            if question.lower() in ("clear", "초기화"):
                history.clear()
                print("\n[대화 맥락을 초기화했습니다.]\n")
                continue
            result = agent.invoke(question, history)
            print_result(result)
            # 이번 질문·답변을 기록에 추가해 다음 턴이 맥락을 참고하게 함
            history.append({"role": "user", "content": question})
            history.append({"role": "assistant", "content": result["answer"]})
            print()
        except KeyboardInterrupt:
            print("\n\n챗봇을 종료합니다.")
            break
        except Exception as error:
            print(f"\n오류가 발생했습니다: {error}\n")


def main() -> None:
    """Neo4j GraphRAG·LLM·Agentic RAG 그래프를 준비하고, 모드(데모/대화형)에 따라 실행함."""
    print("\n" + "=" * 60)
    print("특허/지식재산권 Agentic GraphRAG 예제 (LangGraph + Neo4j + Groq gpt-oss-120b)")
    print("=" * 60)
    try:
        graph, embeddings = load_graph()
        # 인덱싱된 KG 규모를 출력해 검색 대상이 존재하는지 즉시 확인 (빈 그래프면 인덱싱 필요)
        entity_count = graph.query(
            "MATCH (n:__Entity__) RETURN count(n) AS cnt"
        )[0]["cnt"]
        chunk_count = graph.query("MATCH (c:Chunk) RETURN count(c) AS cnt")[0]["cnt"]
        print(f"Neo4j GraphRAG 로드 완료: {NEO4J_URI} (엔티티 {entity_count}개, 조문 청크 {chunk_count}개)")
        llm = build_llm()
        agent = AgenticRAG(llm, graph, embeddings)

        # 명령행 인자에 --demo가 있으면 비대화형 데모, 없으면 대화형 챗봇으로 동작함
        if "--demo" in sys.argv[1:]:
            run_demo(agent)
        else:
            chat(agent)
    except (RuntimeError, ValueError) as error:
        print(f"\n[오류] {error}", file=sys.stderr)
        sys.exit(1)


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
