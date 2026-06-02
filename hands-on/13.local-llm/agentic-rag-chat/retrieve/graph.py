#!/usr/bin/env python3
"""특허/지식재산권 Agentic RAG 그래프 (LangGraph StateGraph + Groq gpt-oss-120b)

2-Stage Retrieval(retrieval.py)을 검색 엔진으로 삼아, LangGraph로 자기 성찰 루프와 멀티소스 라우팅을
결합한 Agentic RAG 워크플로우를 정의함. Agent가 스스로 (1) 법률 DB 검색 필요 여부와 (2) 검색 소스
(특허법 벡터DB·웹·YouTube)를 판단하고, 답변 유용성을 자체 평가해 미흡하면 질문을 재작성해 재검색함.

[노드 구성]
  check_retrieval : 법률 DB 검색 필요 여부 + 소스 + 소스별 최적 쿼리 판단 (Pydantic json_schema 구조화 출력)
  search          : 선택 소스에서 검색 (벡터DB=2-stage 재정렬 / 웹 / YouTube), 소스별 쿼리로 최적화
  generate        : 검색 컨텍스트 기반 답변 생성 (스트리밍) + 코드로 출처 부착
  generate_direct : 법률 DB 불필요 시에도 웹 검색을 수행한 뒤 답변 (특허 외/일반 질문 경로)
  evaluate        : 답변 유용성 평가 (json_schema 구조화 출력) — 재검색 루프 분기 기준
  rewrite         : 유용성 미달 시 질문 재작성 (최대 2회, 재시도 가드는 조건부 엣지에서 검사)

[검색 스택]
  LLM     : ChatGroq(openai/gpt-oss-120b) — 구조화 판단은 temperature=0, 답변 생성은 reasoning_format="hidden"
  벡터DB  : retrieval.TwoStageRetriever (KaLM Bi-encoder top-20 → BGE Cross-encoder top-5)
  웹      : DuckDuckGoSearchAPIWrapper + WebBaseLoader/BeautifulSoup 본문 추출 (실패 시 스니펫 폴백)
  YouTube : scrapetube 검색 + oembed 유효성 검증 + youtube-transcript-api(YT_WEBSHARE 프록시) 타임스탬프 청킹
            (자막 실패 시 메타데이터만 사용하는 graceful fallback)
  메모리  : MemorySaver 체크포인터 + thread_id로 멀티턴 대화 관리
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Literal, Optional, TypedDict

# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from dotenv import load_dotenv
from pydantic import BaseModel, Field

# ChatGroq: Groq LPU 채팅 모델 래퍼 (llm.invoke()로 대화 요청 전송, GROQ_API_KEY 자동 참조)
from langchain_groq import ChatGroq
from langchain_core.documents import Document             # page_content + metadata를 담는 LangChain 문서 객체
from langchain_core.prompts import ChatPromptTemplate     # system/human 메시지 템플릿 구성
from langchain_core.output_parsers import StrOutputParser  # AIMessage에서 본문 텍스트만 추출

# DuckDuckGoSearchAPIWrapper: 무료 웹 검색 유틸리티 (API 키 불필요, .results()로 링크 포함 결과 반환)
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper

# scrapetube: YouTube 검색 결과 페이지를 스크래핑해 영상 메타데이터를 반환하는 라이브러리 (API 키 불필요)
import scrapetube

# StateGraph: 상태(State)를 노드 사이로 흘려보내며 워크플로우를 구성하는 LangGraph 그래프
# START/END: 그래프의 가상 시작·종료 지점을 나타내는 특수 노드
from langgraph.graph import StateGraph, START, END
# MemorySaver: 그래프 상태를 thread_id 별로 메모리에 저장하는 체크포인터 (멀티턴 대화 지속)
from langgraph.checkpoint.memory import MemorySaver

# 2-stage 검색기를 같은 패키지의 retrieval 모듈에서 가져옴 (벡터DB 검색 담당)
from retrieval import TwoStageRetriever

# ---------------------------------------------------------------------------
# 경로 / 환경변수 설정
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent          # 이 파일이 위치한 디렉터리(retrieve/)
HANDS_ON_DIR = SCRIPT_DIR.parents[2]                  # retrieve → agentic-rag-chat → 13.local-llm → hands-on
ENV_PATH = HANDS_ON_DIR / ".env"                      # hands-on/.env (API 키·프록시 보관)

# .env에서 GROQ_API_KEY(LLM)·YT_WEBSHARE_*(YouTube 자막 프록시)를 로드함
load_dotenv(ENV_PATH)

# ---------------------------------------------------------------------------
# 상수 정의
# ---------------------------------------------------------------------------
DEFAULT_LLM_MODEL = "openai/gpt-oss-120b"   # 기본 Groq LPU LLM (사이드바에서 변경 가능)
WEB_MAX_RESULTS = 5                         # 웹(DuckDuckGo) 검색 결과 수
WEB_PAGE_MAX_CHARS = 2000                   # 웹 본문에서 컨텍스트로 사용할 최대 문자 수 (페이지당)
WEB_FETCH_TIMEOUT = 10                      # 웹 본문 다운로드 HTTP 타임아웃(초)
YOUTUBE_MAX_RESULTS = 3                     # 최종 유지할 유효한 YouTube 영상 수 (자막 추출 비용 고려)
YOUTUBE_SCRAPE_LIMIT = 10                   # scrapetube에서 가져올 후보 수 (유효성·자막 탈락분 감안 여유 확보)
TRANSCRIPT_LANGUAGES = ["ko", "en"]         # 자막 언어 우선순위 (한국어 → 영어)
TRANSCRIPT_CHUNK_SECONDS = 120              # 자막 타임스탬프 청킹 단위(초)
TRANSCRIPT_CHUNKS_PER_VIDEO = 3             # 컨텍스트에 포함할 영상별 자막 청크 수 (토큰 절약)
OEMBED_TIMEOUT = 5                          # 영상 유효성(oembed) 확인 HTTP 타임아웃(초)
MAX_RETRIES = 2                             # 유용성 미달 시 Query Rewriting 재시도 최대 횟수
HISTORY_TURNS = 6                           # 프롬프트에 포함할 직전 대화 메시지 수 (멀티턴 맥락)
RECURSION_LIMIT = 50                        # 재시도 루프가 그래프 기본 한계(25)에 걸리지 않도록 상향

# 기본 Webshare 프록시 엔드포인트 (YT_WEBSHARE_* 환경변수가 있을 때만 사용)
DEFAULT_WEBSHARE_DOMAIN = "p.webshare.io"
DEFAULT_WEBSHARE_PORT = 80
DEFAULT_WEBSHARE_RETRIES = 10

# 법령 조항(제29조, 제42조의2 등)을 본문에서 추출하기 위한 정규식 (출처 표기에 사용)
ARTICLE_PATTERN = re.compile(r"제\d+조(?:의\d+)?")


# ---------------------------------------------------------------------------
# 라우팅 / 평가 토큰 스키마 정의 (Pydantic)
# ---------------------------------------------------------------------------
# with_structured_output(method="json_schema")이 아래 스키마대로 LLM 출력을 강제해 안정적으로 파싱함

class CheckRetrieval(BaseModel):
    """check_retrieval 결과: 법률 DB 검색 필요 여부 + 선택 소스 + 소스별 최적 쿼리."""
    needs_retrieval: bool = Field(description="특허/지식재산권(법률 DB) 검색이 필요한 도메인 질문인지 여부")
    sources: list[Literal["vectordb", "web", "youtube"]] = Field(
        description="검색에 사용할 소스 목록 (vectordb=특허법 조문, web=최신/비용/사례, youtube=영상/튜토리얼)"
    )
    vectordb_query: str = Field(description="벡터DB(특허법 조문) 검색용 쿼리. 정확한 법률 용어 중심으로 작성")
    web_query: str = Field(description="웹 검색용 쿼리. 핵심 키워드 중심, 연도·시간 표현 제외 (예: '2024' 금지)")
    youtube_query: str = Field(description="YouTube 검색용 쿼리. 쉼표 없이 짧은 키워드로 작성")
    reasoning: str = Field(description="판단 근거 (한국어 한 문장)")


class UsefulnessGrade(BaseModel):
    """evaluate 결과: 답변 유용성 평가."""
    is_useful: bool = Field(description="답변이 사용자 질문에 유용한지 여부")
    reasoning: str = Field(description="유용성 판단 이유 (한국어 한 문장)")


class RewrittenQuery(BaseModel):
    """rewrite 결과: 검색에 최적화되도록 다시 작성된 질문."""
    rewritten_query: str = Field(description="검색에 최적화되도록 다시 작성된 질문")
    reasoning: str = Field(description="질문을 다시 작성한 이유 (한국어 한 문장)")


# ---------------------------------------------------------------------------
# LangGraph 상태 정의
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    """그래프 전체에서 노드 사이로 공유·갱신되는 상태 데이터.

    각 노드는 이 딕셔너리의 일부 키만 갱신해 반환하면, LangGraph가 기존 상태에 병합함.
    체크포인터(MemorySaver)와 함께 쓰므로, 매 턴 invoke 시 모든 키를 초기화한 값을 전달해
    이전 턴의 transient 값(재시도 횟수·이전 검색 결과 등)이 새 턴으로 누수되지 않게 함.
    """
    question: str               # 현재 처리 중 질문 (Query Rewriting 시 갱신됨)
    original_question: str      # 최초 사용자 질문 (유용성 평가·재작성의 기준)
    history: list               # 이전 대화 맥락 [{"role": ..., "content": ...}] (멀티턴)
    needs_retrieval: bool       # 법률 DB 검색 필요 여부 (check_retrieval 판단)
    sources: list               # 선택된 검색 소스 ["vectordb", "web", "youtube"]
    vectordb_query: str         # 벡터DB 검색용 쿼리 (법률 용어 중심)
    web_query: str              # 웹 검색용 쿼리 (연도 제외)
    youtube_query: str          # YouTube 검색용 쿼리 (짧은 키워드)
    route_reasoning: str        # 라우팅 판단 근거
    vector_docs: list           # 2-stage 재정렬 상위 top-5 문서 (rerank_score 포함)
    web_results: list           # 웹 검색 결과 [{title, snippet, link, content}]
    youtube_results: list       # YouTube 검색 결과 [{title, channel, url, published, transcript_chunks}]
    answer: str                 # 출처 섹션이 포함된 최종 답변 (본문 + 출처)
    sources_md: str             # 출처 섹션 마크다운만 분리 보관 (UI에서 본문 스트리밍 후 별도 렌더)
    is_useful: Optional[bool]   # 유용성 평가 결과
    usefulness_reasoning: str   # 유용성 판단 근거
    retry_count: int            # 현재까지 Query Rewriting 재시도 횟수
    rewrites: list              # Query Rewriting 이력 [{from, to, reasoning}]


# ---------------------------------------------------------------------------
# LLM 빌더
# ---------------------------------------------------------------------------

def build_structured_llm(model: str) -> ChatGroq:
    """구조화 판단(라우팅·평가·재작성)용 Groq LLM을 생성함 (temperature=0).

    GROQ_API_KEY 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(f"GROQ_API_KEY가 설정되지 않음. {ENV_PATH}를 확인하세요.")
    return ChatGroq(model=model, temperature=0, api_key=api_key)


def build_gen_llm(model: str) -> ChatGroq:
    """답변 생성용 Groq LLM을 생성함 (낮은 temperature + 추론 과정 숨김 + 스트리밍).

    gpt-oss는 추론 모델이라 사고 과정이 답변에 섞일 수 있으므로 reasoning_format="hidden"으로 최종
    답변만 받음. reasoning_format은 gpt-oss 계열만 지원하므로 모델명에 'gpt-oss'가 있을 때만 지정함.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(f"GROQ_API_KEY가 설정되지 않음. {ENV_PATH}를 확인하세요.")
    kwargs = {"model": model, "temperature": 0.3, "api_key": api_key}
    if "gpt-oss" in model:
        kwargs["reasoning_format"] = "hidden"  # 추론 과정을 숨기고 최종 답변 텍스트만 스트리밍
    return ChatGroq(**kwargs)


# ---------------------------------------------------------------------------
# 웹 검색 (DuckDuckGo + WebBaseLoader/BeautifulSoup 본문 추출)
# ---------------------------------------------------------------------------

def _extract_web_content(url: str) -> str:
    """WebBaseLoader로 페이지를 받아 BeautifulSoup으로 노이즈 태그를 제거하고 본문 텍스트만 추출함.

    WebBaseLoader.scrape()는 페이지를 requests로 받아 BeautifulSoup 객체로 파싱해 반환함. script·style·
    nav 등 검색에 불필요한 태그를 decompose()로 제거한 뒤 get_text로 본문만 남겨 컨텍스트 품질을 높임.
    실패(타임아웃·차단 등) 시 빈 문자열을 반환해 호출부에서 스니펫으로 폴백하게 함.
    """
    from langchain_community.document_loaders import WebBaseLoader  # 웹페이지 로더 (내부적으로 BeautifulSoup 사용)

    loader = WebBaseLoader(
        web_paths=[url],
        # 일부 사이트가 기본 User-Agent를 차단하므로 브라우저 UA를 지정함
        header_template={"User-Agent": "Mozilla/5.0"},
        requests_kwargs={"timeout": WEB_FETCH_TIMEOUT},
    )
    # scrape(): 페이지를 받아 BeautifulSoup 객체로 반환함 (load()는 get_text까지 끝낸 Document를 줌)
    soup = loader.scrape()
    # 검색에 불필요한 노이즈 태그를 통째로 제거함 (decompose: 태그와 내용 삭제)
    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form", "noscript"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    # 연속 공백·과도한 빈 줄을 정규화해 토큰을 절약함
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()[:WEB_PAGE_MAX_CHARS]


def search_web(query: str) -> list[dict]:
    """DuckDuckGo로 최근 1년 웹 문서를 검색하고, 각 링크의 본문을 추출해 반환함.

    DuckDuckGoSearchAPIWrapper.results()는 title·snippet·link를 담은 딕셔너리 리스트를 반환함.
    각 링크는 WebBaseLoader/BeautifulSoup으로 본문을 추출하되, 실패하면 검색 스니펫으로 폴백함.
    time="y"로 최근 1년만 검색하므로 쿼리에는 연도·시간 표현을 넣지 않음.
    """
    wrapper = DuckDuckGoSearchAPIWrapper(region="ko-kr", time="y", max_results=WEB_MAX_RESULTS)
    raw_results = wrapper.results(query, WEB_MAX_RESULTS)  # 상세 결과 리스트(title/snippet/link) 반환

    normalized = []
    for item in raw_results:
        link = item.get("link", "")
        # 웹 결과에 섞인 YouTube 링크는 제외함 (영상은 별도 YouTube 검색이 담당, 소스 분리)
        if "youtube.com" in link or "youtu.be" in link:
            continue
        snippet = item.get("snippet", "")
        # 본문 추출 시도 → 실패하면 스니펫으로 폴백 (graceful degradation)
        content = ""
        if link:
            try:
                content = _extract_web_content(link)
            except Exception:
                content = ""
        normalized.append({
            "title": item.get("title", "제목 없음"),
            "snippet": snippet,
            "link": link,
            "content": content or snippet,  # 본문 우선, 없으면 스니펫 사용
        })
    return normalized


# ---------------------------------------------------------------------------
# YouTube 검색 (scrapetube + oembed 유효성 + 자막 타임스탬프 청킹)
# ---------------------------------------------------------------------------

def _extract_runs_text(node: Optional[dict]) -> str:
    """scrapetube 반환 구조({'runs': [{'text': ...}]} 또는 {'simpleText': ...})에서 텍스트만 추출함."""
    if not node:
        return ""
    if "simpleText" in node:
        return node["simpleText"]
    runs = node.get("runs") or []
    return "".join(run.get("text", "") for run in runs)


def is_valid_video(url: str) -> bool:
    """YouTube oembed 엔드포인트로 영상 주소가 유효(공개·재생 가능)한지 확인함.

    oembed는 공개 영상이면 200(JSON 메타데이터)을, 비공개·삭제·존재하지 않는 영상이면 401/404를 반환함.
    API 키 없이 동작하며, 스크래핑 결과에 섞일 수 있는 유효하지 않은 주소를 출처 표기 전에 걸러냄.
    """
    # url을 oembed 쿼리 파라미터로 안전하게 인코딩함 (특수문자가 깨지지 않도록 safe="")
    oembed_url = f"https://www.youtube.com/oembed?url={urllib.parse.quote(url, safe='')}&format=json"
    # 일부 환경에서 기본 User-Agent가 차단될 수 있어 브라우저 UA를 지정함
    request = urllib.request.Request(oembed_url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(request, timeout=OEMBED_TIMEOUT) as response:
            return response.status == 200
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        # 401/404(HTTPError)·네트워크 오류·타임아웃 등은 모두 유효하지 않은 주소로 간주함
        return False


def build_transcript_client():
    """youtube-transcript-api 클라이언트를 생성함 (YT_WEBSHARE_* 환경변수가 있으면 프록시 적용).

    YouTube가 짧은 시간 대량 요청을 IP 차단(RequestBlocked)하므로 Webshare 레지덴셜 프록시로 우회함.
    LangChain YoutubeLoader는 프록시 인자를 받지 못하므로, 프록시 지원을 위해 youtube-transcript-api를
    직접 사용함(타임스탬프 청킹은 _chunk_transcript로 동일하게 구현). 적용 우선순위:
      1) YT_PROXY_HTTP / YT_PROXY_HTTPS      → 검증된 HTTP(S) 프록시 URL을 그대로 사용
      2) YT_WEBSHARE_USER + YT_WEBSHARE_PASS → Webshare 레지덴셜 프록시 (IP 차단에 가장 효과적)
      3) 둘 다 없으면 → 프록시 없이 직결 (차단 시 자막 없이 메타데이터만 사용)
    """
    from youtube_transcript_api import YouTubeTranscriptApi  # 인스턴스 API: .fetch(video_id, languages=...)
    from youtube_transcript_api.proxies import GenericProxyConfig, WebshareProxyConfig

    proxy_http = os.getenv("YT_PROXY_HTTP")
    proxy_https = os.getenv("YT_PROXY_HTTPS")
    webshare_user = os.getenv("YT_WEBSHARE_USER")
    webshare_pass = os.getenv("YT_WEBSHARE_PASS")

    if proxy_http or proxy_https:
        proxy_config = GenericProxyConfig(
            http_url=proxy_http or proxy_https,
            https_url=proxy_https or proxy_http,
        )
    elif webshare_user and webshare_pass:
        # 쉼표로 구분한 국가 목록(예: "kr,jp")이 있으면 해당 지역 IP로 필터링함
        raw_locations = os.getenv("YT_WEBSHARE_LOCATIONS", "")
        locations = [loc.strip().lower() for loc in raw_locations.split(",") if loc.strip()] or None
        proxy_config = WebshareProxyConfig(
            proxy_username=webshare_user,
            proxy_password=webshare_pass,
            filter_ip_locations=locations,
            retries_when_blocked=DEFAULT_WEBSHARE_RETRIES,
            domain_name=DEFAULT_WEBSHARE_DOMAIN,
            proxy_port=DEFAULT_WEBSHARE_PORT,
        )
    else:
        proxy_config = None

    return YouTubeTranscriptApi(proxy_config=proxy_config)


def _chunk_transcript(pieces: list[dict]) -> list[dict]:
    """raw 자막 스니펫([{text,start,duration}])을 TRANSCRIPT_CHUNK_SECONDS 단위 청크로 묶음.

    LangChain YoutubeLoader의 CHUNKS 모드와 동일 로직: 스니펫 끝 시각이 현재 청크 경계를 넘으면
    버퍼를 한 청크로 확정하고 경계를 한 단계(120초) 전진함. 각 청크의 start_seconds는 경계값
    (0, 120, 240 …)으로 부여되어 타임스탬프 바로가기 URL(&t=초) 계산 기준이 됨.
    """
    chunks: list[dict] = []
    buffer: list[dict] = []
    chunk_start = 0
    time_limit = TRANSCRIPT_CHUNK_SECONDS
    for piece in pieces:
        piece_end = piece["start"] + piece["duration"]
        # 경계를 넘는 순간 직전까지 모은 버퍼를 한 청크로 확정함
        if piece_end > time_limit and buffer:
            text = " ".join(p["text"].strip() for p in buffer)
            chunks.append({"start_seconds": chunk_start, "text": text})
            buffer = []
            chunk_start = time_limit
            time_limit += TRANSCRIPT_CHUNK_SECONDS
        buffer.append(piece)
    # 마지막 남은 버퍼를 청크로 확정함
    if buffer:
        text = " ".join(p["text"].strip() for p in buffer)
        chunks.append({"start_seconds": chunk_start, "text": text})
    return chunks


def _fetch_transcript_chunks(ytt_api, video_id: str, url: str) -> list[dict]:
    """영상 한 건의 자막을 받아 120초 타임스탬프 청크로 변환함 (실패 시 빈 리스트로 graceful fallback).

    fetch(video_id, languages=...): ko→en 우선순위로 자막을 찾아 가져옴.
    to_raw_data(): FetchedTranscript를 [{text,start,duration}] 리스트로 변환함.
    """
    try:
        fetched = ytt_api.fetch(video_id, languages=TRANSCRIPT_LANGUAGES)
        pieces = fetched.to_raw_data()
    except Exception:
        # 자막 미존재·비활성·IP 차단 등은 모두 자막 없이 메타데이터만 사용하도록 빈 리스트 반환
        return []

    chunks = []
    for chunk in _chunk_transcript(pieces)[:TRANSCRIPT_CHUNKS_PER_VIDEO]:
        start_seconds = int(chunk["start_seconds"])
        minutes, seconds = divmod(start_seconds, 60)  # divmod: 몫(분)과 나머지(초)를 한 번에 반환
        chunks.append({
            "start_seconds": start_seconds,
            "timestamp_display": f"{minutes}:{seconds:02d}",  # 02d: 두 자리 0 패딩 (예: 2:05)
            "timestamp_url": f"{url}&t={start_seconds}",       # &t=초: 해당 시점부터 재생되는 바로가기 URL
            "text": chunk["text"],
        })
    return chunks


def search_youtube(query: str) -> list[dict]:
    """scrapetube로 영상을 검색하고, oembed로 유효성을 검증한 뒤 자막을 타임스탬프 청크로 추출함.

    각 영상은 is_valid_video()로 유효성을 확인하고, 유효한 영상만 자막 추출을 시도함. 자막이 없거나
    차단되면 transcript_chunks를 빈 리스트로 두어 메타데이터(제목·채널·URL)만 활용함(graceful fallback).
    유효한 영상이 YOUTUBE_MAX_RESULTS개에 도달하면 즉시 중단해 불필요한 호출을 줄임.
    """
    ytt_api = build_transcript_client()  # 자막 클라이언트(프록시 포함)를 1회 생성
    results: list[dict] = []
    # get_search는 제너레이터를 반환하므로, 유효성·자막 탈락을 감안해 limit을 여유 있게 잡고 순회함
    videos = scrapetube.get_search(query, limit=YOUTUBE_SCRAPE_LIMIT, sort_by="relevance")
    for video in videos:
        video_id = video.get("videoId")
        if not video_id:
            continue
        url = f"https://www.youtube.com/watch?v={video_id}"
        # 유효하지 않은(비공개·삭제·존재하지 않는) 영상 주소를 oembed로 걸러냄
        if not is_valid_video(url):
            continue
        results.append({
            "title": _extract_runs_text(video.get("title")),
            "channel": _extract_runs_text(video.get("longBylineText")) or _extract_runs_text(video.get("ownerText")),
            "url": url,
            "published": _extract_runs_text(video.get("publishedTimeText")),
            "transcript_chunks": _fetch_transcript_chunks(ytt_api, video_id, url),
        })
        # 유효한 영상이 목표 개수에 도달하면 중단함
        if len(results) >= YOUTUBE_MAX_RESULTS:
            break
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
    """벡터DB·웹·YouTube 검색 결과를 답변 생성용 단일 컨텍스트 문자열로 합침."""
    sections = []
    # 1) 특허법 벡터DB (2-stage 재정렬 상위 문서, 법률 근거)
    if state["vector_docs"]:
        law_parts = []
        for i, doc in enumerate(state["vector_docs"], 1):
            source = doc.metadata.get("source", "특허법")
            chunk_index = doc.metadata.get("chunk_index", "?")
            law_parts.append(f"[법률 {i}] (출처: {source} #{chunk_index})\n{doc.page_content}")
        sections.append("=== 특허법 조문 (벡터DB, 2-stage 재정렬) ===\n" + "\n\n".join(law_parts))
    # 2) 웹 검색 결과 (최신 정보·비용·사례)
    if state["web_results"]:
        web_parts = []
        for i, item in enumerate(state["web_results"], 1):
            web_parts.append(f"[웹 {i}] {item['title']}\n{item['content']}\nURL: {item['link']}")
        sections.append("=== 웹 검색 결과 (DuckDuckGo, 최근 1년) ===\n" + "\n\n".join(web_parts))
    # 3) YouTube 검색 결과 (튜토리얼·영상 + 자막 타임스탬프 발췌)
    if state["youtube_results"]:
        yt_parts = []
        for i, item in enumerate(state["youtube_results"], 1):
            published = f", {item['published']}" if item.get("published") else ""
            header = f"[영상 {i}] {item['title']} ({item['channel']}{published})\nURL: {item['url']}"
            # 자막 청크가 있으면 타임스탬프와 함께 발췌를 덧붙여 "몇 분부터 보면 되는지" 안내가 가능하게 함
            if item.get("transcript_chunks"):
                excerpt = "\n".join(
                    f"  - ({chunk['timestamp_display']}) {chunk['text'][:200]}"
                    for chunk in item["transcript_chunks"]
                )
                header += "\n자막 발췌:\n" + excerpt
            yt_parts.append(header)
        sections.append("=== YouTube 검색 결과 (scrapetube + 자막) ===\n" + "\n\n".join(yt_parts))
    return "\n\n".join(sections) if sections else "(검색 결과 없음)"


def build_sources_section(state: AgentState) -> str:
    """수집된 검색 결과 메타데이터로 '출처' 섹션을 코드에서 직접 구성함.

    URL 누락을 막기 위해 LLM 출력에 의존하지 않고, 검색 단계에서 모은 링크를 그대로 표기함.
    법률은 본문에서 추출한 조항(제29조 등), 웹·YouTube는 제목+URL 링크를 마크다운으로 출력함.
    """
    blocks = []

    # 법률 출처: 문서 출처(법령명)별로 본문에서 조항 번호를 추출해 묶음
    if state["vector_docs"]:
        law_articles: dict[str, list[str]] = {}
        for doc in state["vector_docs"]:
            # 메타데이터 source는 PDF 파일명이므로 확장자를 떼어 법령명으로 사용 (예: 특허법.pdf → 특허법)
            law_name = Path(doc.metadata.get("source", "특허법")).stem or "특허법"
            law_articles.setdefault(law_name, [])
            for article in ARTICLE_PATTERN.findall(doc.page_content):
                # 같은 조항이 여러 청크에 걸쳐 등장할 수 있으므로 중복은 제외하고 순서를 보존함
                if article not in law_articles[law_name]:
                    law_articles[law_name].append(article)
        law_lines = []
        for law_name, articles in law_articles.items():
            law_lines.append(f"- {law_name} {', '.join(articles)}" if articles else f"- {law_name}")
        blocks.append("**법률**\n" + "\n".join(law_lines))

    # 웹 출처: 제목 + URL 링크
    if state["web_results"]:
        web_lines = [f"- [{item['title']}]({item['link']})" for item in state["web_results"] if item["link"]]
        if web_lines:
            blocks.append("**웹**\n" + "\n".join(web_lines))

    # YouTube 출처: 제목 + URL 링크 (유효성 검증을 통과한 주소만 표기됨)
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

class TwoStageAgenticRAG:
    """2-Stage Retrieval을 검색 엔진으로 쓰는 LangGraph 기반 Agentic RAG 워크플로우.

    LLM(구조화·생성)·2-stage 검색기를 보유하고, 각 노드 메서드를 그래프에 등록해 MemorySaver
    체크포인터와 함께 컴파일함. stream_events()로 노드 진행 상황과 답변 토큰을 함께 스트리밍함.

    엣지 구성:
      START → check_retrieval
      check_retrieval ─(법률 DB 필요)→ search / ─(불필요)→ generate_direct
      search → generate → evaluate
      evaluate ─(유용/재시도 소진)→ END / ─(유용 미달)→ rewrite → check_retrieval (재검색 루프)
      generate_direct → END
    """

    def __init__(self, retriever: TwoStageRetriever, model: str = DEFAULT_LLM_MODEL):
        self.model = model
        self.retriever = retriever
        # 구조화 판단용 LLM(temperature=0)에 각 스키마를 json_schema 모드로 바인딩함.
        # with_structured_output(method="json_schema"): LLM 응답을 Pydantic 스키마(JSON)로 강제함.
        # gpt-oss-120b는 기본 function_calling 모드에서 도구 이름을 잘못 생성해 실패할 수 있어,
        # 도구 이름이 없는 json_schema 방식으로 안정성을 확보함 (Self-RAG 예제에서 검증된 설정).
        structured_llm = build_structured_llm(model)
        self.retrieval_checker = structured_llm.with_structured_output(CheckRetrieval, method="json_schema")
        self.usefulness_grader = structured_llm.with_structured_output(UsefulnessGrade, method="json_schema")
        self.query_rewriter = structured_llm.with_structured_output(RewrittenQuery, method="json_schema")
        # 답변 생성용 LLM (스트리밍 + 추론 숨김)
        self.gen_llm = build_gen_llm(model)
        # 노드·엣지를 연결하고 MemorySaver 체크포인터와 함께 컴파일함
        self.graph = self._build_graph()

    # ===== 노드 1: check_retrieval (법률 DB 검색 필요 여부 + 소스 + 쿼리) =====
    def check_retrieval(self, state: AgentState) -> dict:
        """법률 DB 검색 필요 여부·소스를 판단하고 소스별 최적 쿼리를 생성함 (구조화 출력)."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 특허/지식재산권 전문 챗봇의 검색 라우터입니다. 사용자 질문을 분석해 검색 전략을 결정하세요.

[needs_retrieval = True] — 특허·실용신안·상표·디자인권 등 지식재산권 관련 질문 (법률 DB 검색 필요)
  사용할 소스를 선택하세요 (복수 선택 가능, vectordb는 가능한 한 포함):
  - vectordb : 특허법 조문·요건·절차 등 '법률 근거'가 필요할 때
  - web      : 비용·통계·최신 동향·사례 등 '최신 정보'가 필요할 때
  - youtube  : 강의·튜토리얼·시각적 설명 등 '영상'을 원할 때

[needs_retrieval = False] — 법률 DB가 필요 없는 질문 (인사·잡담·특허와 무관한 일반/IT/다른 법률 주제)
  → 이 경우에도 웹 검색으로 최신 정보를 보강해 답변하므로, web_query에는 적절한 웹 검색 키워드를 넣으세요.

[검색 방식별 질의어 최적화 규칙] (소스마다 검색 엔진 특성이 달라 쿼리를 각각 따로 최적화)
  - vectordb_query : 특허법 '조문' 검색용. 구어체를 정확한 법률 용어로 변환 (예: '특허 등록 요건 신규성 진보성').
  - web_query      : 웹 검색용 핵심 키워드. 연도·시간 표현(2024 등)은 절대 금지. (needs_retrieval=False일 때도 작성)
  - youtube_query  : 영상 검색용. 쉼표 없이 짧고 구체적인 키워드 (예: '특허 출원 방법').
  - 사용하지 않는 소스의 쿼리는 빈 문자열로 두어도 됩니다.

이전 대화 맥락을 참고해 후속 질문(예: '그럼 비용은?')의 의도를 정확히 파악하세요.
판단 근거(reasoning)는 한국어로 작성하세요."""),
            ("human", "이전 대화:\n{history}\n\n현재 질문: {question}\n\n검색 전략을 결정하세요."),
        ])
        decision: CheckRetrieval = (prompt | self.retrieval_checker).invoke({
            "history": format_history(state.get("history", [])),
            "question": state["question"],
        })
        # 법률 DB 검색이 필요할 때만 소스를 채움 (불필요하면 generate_direct 경로로 흐름)
        sources = decision.sources if decision.needs_retrieval else []
        return {
            "needs_retrieval": decision.needs_retrieval,
            "sources": sources,
            "vectordb_query": decision.vectordb_query,
            "web_query": decision.web_query,
            "youtube_query": decision.youtube_query,
            "route_reasoning": decision.reasoning,
        }

    # ===== 노드 2: search (선택 소스에서 검색) =====
    def search(self, state: AgentState) -> dict:
        """선택 소스에서 검색을 수행함 (벡터DB=2-stage 재정렬 / 웹 / YouTube).

        외부 검색(웹·YouTube)은 각각 try/except로 감싸 한 소스가 실패해도 나머지로 답변을 생성할 수
        있게 함 (graceful degradation).
        """
        sources = state["sources"]
        vector_docs, web_results, youtube_results = [], [], []

        # 특허법 벡터DB 2-stage 검색 (법률 용어 중심 쿼리, 없으면 현재 질문으로 대체)
        if "vectordb" in sources:
            vector_query = state["vectordb_query"] or state["question"]
            vector_docs = self.retriever.retrieve(vector_query)

        # 웹 검색 (DuckDuckGo + 본문 추출)
        if "web" in sources:
            try:
                web_results = search_web(state["web_query"] or state["question"])
            except Exception as error:
                print(f"[search] 웹 검색 실패(무시): {error}", file=sys.stderr)

        # YouTube 검색 (scrapetube + 자막)
        if "youtube" in sources:
            try:
                youtube_results = search_youtube(state["youtube_query"] or state["question"])
            except Exception as error:
                print(f"[search] YouTube 검색 실패(무시): {error}", file=sys.stderr)

        return {
            "vector_docs": vector_docs,
            "web_results": web_results,
            "youtube_results": youtube_results,
        }

    # ===== 노드 3: generate (검색 컨텍스트 기반 답변 생성, 스트리밍) =====
    def generate(self, state: AgentState) -> dict:
        """검색 컨텍스트로 답변을 생성하고 코드로 출처 섹션을 부착함.

        gen_llm 호출은 LangGraph의 stream_mode='messages'가 토큰 단위로 가로채 UI에 스트리밍함.
        본문 생성 후, URL 누락을 막기 위해 출처 섹션은 코드에서 직접 구성해 덧붙임.
        """
        context = build_context(state)
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 특허/지식재산권 전문 상담 AI입니다.

## 역할
- 아래 검색 컨텍스트(특허법 조문·웹·YouTube 자막)와 이전 대화 맥락을 종합해 질문에 답변합니다.
- 법률 용어는 일반인이 이해하기 쉽게 풀어서 설명합니다.

## 규칙
1. 컨텍스트의 정보를 우선 활용하되, 핵심을 요약해 명확히 전달
2. 영상을 검색한 경우 어떤 영상의 몇 분 지점이 도움이 되는지 간단히 안내
3. '출처' 섹션은 시스템이 자동으로 덧붙이므로 답변 본문에 직접 작성하지 마세요

## 이전 대화 맥락
{history}

## 검색 컨텍스트
{context}"""),
            ("human", "{question}"),
        ])
        # prompt | gen_llm | StrOutputParser: 토큰이 콜백으로 흐르며 LangGraph가 이를 스트리밍으로 노출함
        answer_body = (prompt | self.gen_llm | StrOutputParser()).invoke({
            "history": format_history(state.get("history", [])),
            "context": context,
            "question": state["original_question"],
        })
        sources_section = build_sources_section(state)
        full_answer = f"{answer_body}\n\n{sources_section}".strip() if sources_section else answer_body
        return {"answer": full_answer, "sources_md": sources_section}

    # ===== 노드 4: generate_direct (법률 DB 불필요 → 웹 검색 후 답변) =====
    def generate_direct(self, state: AgentState) -> dict:
        """법률 DB가 불필요한 질문도 웹 검색으로 최신 정보를 보강한 뒤 답변함 (스트리밍)."""
        # 법률 DB 경로(search)를 거치지 않으므로, 여기서 직접 웹 검색을 수행함
        web_results = []
        try:
            web_results = search_web(state["web_query"] or state["original_question"])
        except Exception as error:
            print(f"[generate_direct] 웹 검색 실패(무시): {error}", file=sys.stderr)

        # 웹 결과만 담긴 임시 상태로 컨텍스트·출처를 구성함 (벡터DB·YouTube는 사용하지 않음)
        direct_state: AgentState = {**state, "web_results": web_results, "vector_docs": [], "youtube_results": []}
        context = build_context(direct_state)

        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 특허/지식재산권 전문 챗봇이지만, 이번 질문은 특허법 조문 검색이 필요 없는 질문입니다.

아래 웹 검색 결과와 이전 대화 맥락, 그리고 당신의 지식을 종합해 친절하고 정확하게 답변하세요.
특허/지식재산권과 무관한 주제라면 일반 지식으로 간단히 답하되, 필요하면 특허 관련 질문을 안내해도 좋습니다.
'출처' 섹션은 시스템이 자동으로 덧붙이므로 답변 본문에 직접 작성하지 마세요.

## 이전 대화 맥락
{history}

## 웹 검색 결과
{context}"""),
            ("human", "{question}"),
        ])
        answer_body = (prompt | self.gen_llm | StrOutputParser()).invoke({
            "history": format_history(state.get("history", [])),
            "context": context,
            "question": state["original_question"],
        })
        sources_section = build_sources_section(direct_state)
        full_answer = f"{answer_body}\n\n{sources_section}".strip() if sources_section else answer_body
        return {"answer": full_answer, "sources_md": sources_section, "web_results": web_results}

    # ===== 노드 5: evaluate (답변 유용성 평가) =====
    def evaluate(self, state: AgentState) -> dict:
        """최종 답변이 사용자 질문에 유용한지 평가함 (재검색 루프의 분기 기준, 구조화 출력)."""
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
        return {"is_useful": grade.is_useful, "usefulness_reasoning": grade.reasoning}

    # ===== 노드 6: rewrite (Query Rewriting) =====
    def rewrite(self, state: AgentState) -> dict:
        """유용성 미달 시 더 나은 검색을 위해 질문을 재작성하고 재시도 횟수를 늘림."""
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
        return {
            "question": rewritten.rewritten_query,           # 다음 check_retrieval부터 이 질문으로 재검색
            "retry_count": state["retry_count"] + 1,
            "rewrites": state["rewrites"] + [{
                "from": state["question"],
                "to": rewritten.rewritten_query,
                "reasoning": rewritten.reasoning,
            }],
        }

    # ===== 조건부 엣지 (분기 판단 함수) =====
    def decide_search_path(self, state: AgentState) -> Literal["search", "direct"]:
        """check_retrieval 직후 분기: 법률 DB가 필요하면 search, 아니면 generate_direct로 보냄."""
        return "search" if state["needs_retrieval"] else "direct"

    def decide_after_eval(self, state: AgentState) -> Literal["rewrite", "end"]:
        """evaluate 직후 분기: 유용하면 종료, 유용 미달이고 재시도가 남았으면 rewrite로 보냄.

        재시도 횟수(retry_count) 가드를 이 엣지에서 검사해 무한 루프(GraphRecursionError)를 막음
        (rewrite 노드는 횟수만 증가시키고 종료 판단은 하지 않음).
        """
        if state["is_useful"]:
            return "end"
        if state["retry_count"] >= MAX_RETRIES:
            return "end"
        return "rewrite"

    # ===== 그래프 구성 =====
    def _build_graph(self):
        """노드와 엣지를 연결하고 MemorySaver 체크포인터와 함께 실행 가능한 그래프로 컴파일함."""
        workflow = StateGraph(AgentState)        # 상태 스키마(AgentState) 기반 그래프 생성
        # 노드 등록 (이름 → 실행 함수)
        workflow.add_node("check_retrieval", self.check_retrieval)
        workflow.add_node("search", self.search)
        workflow.add_node("generate", self.generate)
        workflow.add_node("generate_direct", self.generate_direct)
        workflow.add_node("evaluate", self.evaluate)
        workflow.add_node("rewrite", self.rewrite)

        # 엣지 연결
        workflow.add_edge(START, "check_retrieval")
        workflow.add_conditional_edges(          # 법률 DB 필요 여부로 분기
            "check_retrieval",
            self.decide_search_path,
            {"search": "search", "direct": "generate_direct"},
        )
        workflow.add_edge("search", "generate")          # 검색 → 답변 생성
        workflow.add_edge("generate", "evaluate")        # 답변 생성 → 유용성 평가
        workflow.add_conditional_edges(          # 유용성 평가 후 재검색/종료 분기
            "evaluate",
            self.decide_after_eval,
            {"rewrite": "rewrite", "end": END},
        )
        workflow.add_edge("rewrite", "check_retrieval")  # 재작성 → 다시 라우팅 (재검색 루프)
        workflow.add_edge("generate_direct", END)        # 직접 답변 → 종료
        # checkpointer=MemorySaver(): thread_id 별로 상태를 저장해 멀티턴 대화를 지속함
        return workflow.compile(checkpointer=MemorySaver())

    # ===== 실행 헬퍼 =====
    def stream_events(self, question: str, history: list, thread_id: str):
        """그래프를 스트리밍 실행하며 (노드 진행 업데이트, 답변 토큰)을 정규화해 순차로 yield함.

        stream_mode=["updates","messages"]:
          - "updates"  : 노드가 끝날 때마다 {노드명: 상태변경} 을 받아 진행 상황(라우팅·검색·평가)을 가시화
          - "messages" : 노드 안에서 LLM이 생성하는 토큰을 (메시지청크, 메타데이터)로 받아 스트리밍
        generate / generate_direct 노드의 토큰만 답변으로 흘려보내고, 구조화 판단 LLM 출력은 제외함.

        yield 형식: ("update", 노드명, 상태변경 dict) 또는 ("token", 노드명, 토큰 문자열)
        """
        initial_state = build_initial_state(question, history)
        config = {"configurable": {"thread_id": thread_id}, "recursion_limit": RECURSION_LIMIT}
        for mode, chunk in self.graph.stream(initial_state, config=config, stream_mode=["updates", "messages"]):
            if mode == "updates":
                # chunk = {노드명: 해당 노드가 반환한 상태 변경 dict}
                for node_name, update in chunk.items():
                    yield ("update", node_name, update)
            elif mode == "messages":
                message_chunk, metadata = chunk
                node_name = metadata.get("langgraph_node", "")
                # 답변 생성 노드의 토큰만 흘려보냄 (라우팅·평가 등 구조화 출력 토큰은 제외)
                if node_name in ("generate", "generate_direct") and getattr(message_chunk, "content", ""):
                    yield ("token", node_name, message_chunk.content)

    def get_final_state(self, thread_id: str) -> dict:
        """thread_id의 마지막 체크포인트에서 최종 상태(dict)를 가져옴 (출처·요약 표기용)."""
        config = {"configurable": {"thread_id": thread_id}}
        # get_state(config).values: 해당 thread의 최신 상태 채널 값들을 dict로 반환함
        return self.graph.get_state(config).values

    def invoke(self, question: str, history: list, thread_id: str) -> dict:
        """질문 한 건에 대해 그래프를 한 번에 실행하고 최종 상태를 반환함 (CLI 테스트용)."""
        initial_state = build_initial_state(question, history)
        config = {"configurable": {"thread_id": thread_id}, "recursion_limit": RECURSION_LIMIT}
        return self.graph.invoke(initial_state, config=config)


def build_initial_state(question: str, history: list) -> AgentState:
    """매 턴 그래프에 전달할 초기 상태를 구성함 (모든 transient 필드를 리셋).

    MemorySaver 체크포인터는 같은 thread_id의 이전 상태에 입력을 병합하므로, 모든 키를 명시적으로
    초기화해 전달함으로써 이전 턴의 재시도 횟수·검색 결과가 새 턴으로 누수되는 것을 방지함.
    멀티턴 대화 맥락은 history 인자로 직접 주입함.
    """
    return {
        "question": question,
        "original_question": question,
        "history": history,
        "needs_retrieval": False,
        "sources": [],
        "vectordb_query": "",
        "web_query": "",
        "youtube_query": "",
        "route_reasoning": "",
        "vector_docs": [],
        "web_results": [],
        "youtube_results": [],
        "answer": "",
        "sources_md": "",
        "is_useful": None,
        "usefulness_reasoning": "",
        "retry_count": 0,
        "rewrites": [],
    }


# ---------------------------------------------------------------------------
# 단독 실행 CLI 테스트 (python graph.py [--demo])
# ---------------------------------------------------------------------------

def _build_agent() -> TwoStageAgenticRAG:
    """벡터스토어·리랭커·LLM을 적재해 Agentic RAG 그래프를 구성함 (CLI 테스트 전용)."""
    from retrieval import load_vectorstore, load_reranker

    print("벡터 DB·리랭커 적재 중...")
    retriever = TwoStageRetriever(load_vectorstore(), load_reranker())
    return TwoStageAgenticRAG(retriever, model=DEFAULT_LLM_MODEL)


def _print_result(result: dict) -> None:
    """그래프 처리 결과(라우팅·검색·평가)와 최종 답변을 콘솔에 출력함."""
    print("\n" + "=" * 60)
    print(f"[Route ] 법률DB 검색 : {result['needs_retrieval']} / 소스: {result['sources'] or '없음'}")
    if result.get("retry_count", 0) > 0:
        print(f"[Retry ] 재시도 횟수 : {result['retry_count']}")
    if result["needs_retrieval"]:
        print(f"[검색  ] 벡터DB {len(result['vector_docs'])}개 / 웹 {len(result['web_results'])}개 / "
              f"YouTube {len(result['youtube_results'])}개")
    if result.get("is_useful") is not None:
        print(f"[평가  ] 유용함 : {result['is_useful']}")
    print("=" * 60)
    print(result["answer"])
    print("=" * 60)


def main() -> None:
    """데모 질의를 비대화형으로 실행해 그래프 전체 흐름을 검증함."""
    agent = _build_agent()
    demo_questions = [
        "특허 요건에 대해 법률과 영상을 검색해서 알려줘",   # 벡터DB(+YouTube) 통합 경로
        "Claude Code란?",                                  # 법률 DB 불필요 → generate_direct(웹) 경로
    ]
    history: list = []
    thread_id = "cli-demo"
    for idx, question in enumerate(demo_questions, 1):
        print("\n" + "#" * 60)
        print(f"# 데모 질의 {idx}/{len(demo_questions)}: {question}")
        print("#" * 60)
        result = agent.invoke(question, history, thread_id)
        _print_result(result)
        history.append({"role": "user", "content": question})
        history.append({"role": "assistant", "content": result["answer"]})


if __name__ == "__main__":  # 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
    main()
