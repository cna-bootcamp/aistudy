#!/usr/bin/env python3
"""YouTube Data API v3 + Multi-Query 기반 YouTube 자막 RAG 예제

YouTube Data API v3로 최신 영상을 조건(최근 3개월·5분↑·조회수 1000회↑)에 맞춰 검색하고,
youtube-transcript-api로 자막을 추출해 ChromaDB에 인덱싱한 뒤, Groq LPU LLM으로 질문에 답하는 RAG 챗봇임.
타임스탬프 기반 청킹(120초)으로 "몇 분부터 보면 되나요?" 질문에 정확한 시점 URL을 제공함.

[기존 youtube-rag 예제(agentic-ai/examples) 대비 핵심 변경 사항]
  Before: YouTubeSearchTool(웹 스크래핑) 검색 + indexing.py/chatbot.py 분리 + OpenAI/Claude/Gemini 선택
  After : YouTube Data API v3(날짜·정렬·메타데이터) + Multi-Query 검색 + 단일 app.py + Groq LPU LLM

핵심 개념:
  - YouTube Data API v3: 날짜 필터·조회수 정렬·상세 메타데이터(길이·조회수)를 제공하는 공식 API
  - Multi-Query       : 한 토픽을 여러 관점(특징·활용·스킬·플러그인)으로 검색해 회수율(recall)을 높이는 기법
  - 검색 결과 캐시    : YouTube 검색·상세조회 결과를 24시간 TTL로 저장해 Data API 할당량을 절약
  - 자막 결과 캐시    : 영상별 자막 스니펫을 24시간 TTL로 저장해 반복 인덱싱 시 프록시 요청을 절약
  - 자막 직접 추출     : youtube-transcript-api 직접 호출(프록시·백오프로 IP 차단 대응) + 제목·조회수는 Data API로 주입
  - 타임스탬프 청킹   : 자막을 120초 단위로 잘라 각 청크에 바로가기 URL(&t=초)을 부여

Embed     : OpenAI text-embedding-3-small (1536차원, 인덱싱·질의 공용)
VectorDB  : ChromaDB (로컬 영속화, ./chroma_db / 컬렉션 youtube_transcripts)
Search    : YouTube Data API v3 (publishedAfter·order=relevance, relevanceLanguage 미지정, 24시간 캐시)
Transcript: youtube-transcript-api (ko→en 우선, 120초 청킹; YT_WEBSHARE_*/YT_PROXY_* 환경변수로 프록시 우회)
LLM       : Groq LPU openai/gpt-oss-120b (reasoning_format="hidden")

사용법:
    python app.py                 # 인덱싱: 3개 토픽 멀티쿼리 검색 → 자막 추출 → 벡터 DB 저장
    python app.py index --reset   # 기존 벡터 DB 삭제 후 재인덱싱 (토픽별 영상 수는 VIDEOS_PER_TOPIC 상수)
    python app.py index --refresh-search-cache  # 24시간 검색 캐시를 무시하고 새로 검색
    python app.py index --refresh-transcript-cache  # 24시간 자막 캐시를 무시하고 새로 추출
    python app.py check-proxy "영상URL또는ID"  # 자막 프록시 연결만 빠르게 점검
    python app.py chat            # 대화형 RAG 챗봇 (Groq)
    python app.py ask "질문"       # 단발성 질문 1회 답변
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

# Windows 콘솔 기본 인코딩(cp949)에서 한글·이모지 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ---------------------------------------------------------------------------
# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(youtube-rag/)를 절대경로로 구함
HANDS_ON_DIR = SCRIPT_DIR.parent.parent          # hands-on/ (youtube-rag → 12.web-youtube-search → hands-on)
ENV_PATH = HANDS_ON_DIR / ".env"                 # hands-on/.env (API 키 보관)
CHROMA_DIR = SCRIPT_DIR / "chroma_db"            # ChromaDB 영속화 디렉터리 (자동 생성)
SEARCH_CACHE_DIR = SCRIPT_DIR / ".cache"         # YouTube 검색 결과 캐시 디렉터리
SEARCH_CACHE_PATH = SEARCH_CACHE_DIR / "youtube_search_results.json"  # 최종 선정 영상 메타데이터 캐시 파일
TRANSCRIPT_CACHE_PATH = SEARCH_CACHE_DIR / "youtube_transcript_results.json"  # 영상별 자막 스니펫 캐시 파일

# ---------------------------------------------------------------------------
# 환경변수 로드
# ---------------------------------------------------------------------------
from dotenv import load_dotenv

load_dotenv(ENV_PATH)  # .env에서 YOUTUBE_API_KEY(검색)·OPENAI_API_KEY(임베딩)·GROQ_API_KEY(LLM)를 로드함

# ---------------------------------------------------------------------------
# 상수 정의
# ---------------------------------------------------------------------------
# 검색 토픽: {화면 표시 라벨: Data API 검색어}
# 'Antigravity'·'Codex'는 단어만으로는 의미가 모호(노래·의학 용어 등)하므로 검색어에 제공사를 붙여 명확화함
TOPICS = {
    "Claude Code": "Claude Code",
    "Antigravity": "Google Antigravity",
    "Codex": "OpenAI Codex",
}

# Multi-Query 관점: 토픽마다 아래 관점을 결합해 여러 검색어를 만들어 회수율을 높임
# 예) "Claude Code 특징", "Claude Code 활용 방법", "Claude Code 스킬 개발", "Claude Code 플러그인 개발"
ASPECTS = ["특징", "활용 방법", "스킬 개발", "플러그인 개발"]

RECENT_DAYS = 90                 # 영상 조회 기준: 오늘로부터 최근 90일(약 3개월) 이내 업로드
MIN_DURATION_SECONDS = 300       # 영상 조회 기준: 최소 길이 5분(300초) 이상 (쇼츠 제외)
MIN_VIEW_COUNT = 1000            # 영상 조회 기준: 최소 조회수 1000회 이상
VIDEOS_PER_TOPIC = 10            # 토픽별로 선정할 영상 수 (완료 기준: 토픽당 10개)
SEARCH_MAX_RESULTS = 25          # 멀티쿼리 1건당 가져올 후보 수 (최대 50, 토픽당 4쿼리 × 25 = 후보 충분)
SEARCH_CACHE_TTL_SECONDS = 24 * 60 * 60  # YouTube 검색 결과 캐시 유효시간(24시간)

CHUNK_SIZE_SECONDS = 120         # 자막 청킹 단위 2분(120초) (작으면 문맥 손실, 크면 시점 정확도 저하)
TRANSCRIPT_LANGUAGES = ["ko", "en"]  # 자막 언어 우선순위: 한국어 → 영어
TRANSCRIPT_CACHE_TTL_SECONDS = 24 * 60 * 60  # YouTube 자막 결과 캐시 유효시간(24시간)
TRANSCRIPT_DELAY_SECONDS = 1.0   # 영상 사이 간격(초) — 짧은 시간 대량 요청에 의한 IP 차단을 완화
TRANSCRIPT_MAX_RETRIES = 4       # 차단(RequestBlocked/IpBlocked) 시 재시도 횟수
TRANSCRIPT_BACKOFF_BASE = 3      # 차단 시 지수 백오프 기본 대기(초): 3 → 6 → 12 → 24
DEFAULT_WEBSHARE_RETRIES_WHEN_BLOCKED = 10  # Webshare 내부 IP 교체 재시도 횟수
DEFAULT_WEBSHARE_DOMAIN = "p.webshare.io"   # Webshare 레지덴셜 프록시 기본 엔드포인트
DEFAULT_WEBSHARE_PORT = 80                  # Webshare 기본 프록시 포트

EMBEDDING_MODEL = "text-embedding-3-small"   # 임베딩 모델 (인덱싱·질의 동일해야 검색 가능, 1536차원)
LLM_MODEL = "openai/gpt-oss-120b"            # Groq LPU에서 서빙하는 답변 생성용 LLM
COLLECTION_NAME = "youtube_transcripts"      # ChromaDB 컬렉션명 (인덱싱·질의 동일해야 함)

RETRIEVE_K = 10      # 최종 검색해 LLM에 넘길 청크 수
FETCH_K = 30         # MMR이 다양성 계산을 위해 먼저 가져올 후보 청크 수 (FETCH_K > RETRIEVE_K)
LAMBDA_MULT = 0.5    # MMR 관련성 vs 다양성 가중치 (1=관련성만, 0=다양성만, 0.5=균형)

# LLM에 역할·규칙·컨텍스트를 주입하는 시스템 프롬프트 ({context}에 검색된 자막 청크가 삽입됨)
SYSTEM_PROMPT = """당신은 YouTube 영상 자막을 근거로 답변하는 RAG 어시스턴트임.

## 규칙
1. 아래 [컨텍스트]의 자막 내용만 근거로 답변하고, 없는 내용은 추측하지 말 것
2. 답변에 사용한 영상의 제목과 타임스탬프 URL(&t=초)을 반드시 함께 제시할 것
3. "몇 분부터 보면 되나요?" 같은 질문에는 정확한 시점(분:초)과 바로가기 URL을 제공할 것
4. 근거를 찾을 수 없으면 "인덱싱된 영상에서 관련 내용을 찾을 수 없습니다."라고 답할 것
5. 한국어로 간결하게 답변할 것

## 컨텍스트
{context}
"""

HUMAN_PROMPT = "{question}"


# ---------------------------------------------------------------------------
# 1. YouTube Data API 검색 + 조건 필터
# ---------------------------------------------------------------------------

def build_youtube_client():
    """YOUTUBE_API_KEY로 YouTube Data API v3 클라이언트를 생성해 반환함.

    build("youtube", "v3", developerKey=...): google-api-python-client가 제공하는 팩토리로,
    REST 엔드포인트를 파이썬 메서드(youtube.search().list() 등)로 노출하는 서비스 객체를 만듦.
    """
    api_key = os.getenv("YOUTUBE_API_KEY")
    # API 키 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함
    if not api_key:
        raise RuntimeError(f"YOUTUBE_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요")

    from googleapiclient.discovery import build

    return build("youtube", "v3", developerKey=api_key)


def parse_duration_seconds(iso_duration: str) -> int:
    """ISO 8601 길이 문자열(예: 'PT1H2M3S')을 총 초로 변환함.

    YouTube Data API의 contentDetails.duration은 'PT15M33S'처럼 ISO 8601 기간 형식으로 옴.
    정규표현식으로 시(H)·분(M)·초(S)를 뽑아 초 단위 정수로 합산함.
    """
    # (?:(\d+)H)?: 시 부분이 있으면 숫자를 캡처(없으면 None). 분·초도 동일한 선택적 그룹임
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso_duration or "")
    if not match:
        return 0
    # 제너레이터로 세 그룹을 정수화: 매칭 안 된 그룹(None)은 0으로 처리함
    hours, minutes, seconds = (int(value) if value else 0 for value in match.groups())
    return hours * 3600 + minutes * 60 + seconds


def _chunked(items: list, size: int):
    """리스트를 size개씩 끊어 순회하는 제너레이터 (videos.list가 한 번에 최대 50개 ID만 받음)."""
    for start in range(0, len(items), size):
        yield items[start:start + size]


def get_search_cache_key() -> dict:
    """검색 조건을 캐시 키로 묶어 반환함."""
    return {
        "topics": [{"label": label, "query": query} for label, query in TOPICS.items()],
        "aspects": list(ASPECTS),
        "recent_days": RECENT_DAYS,
        "min_duration_seconds": MIN_DURATION_SECONDS,
        "min_view_count": MIN_VIEW_COUNT,
        "videos_per_topic": VIDEOS_PER_TOPIC,
        "search_max_results": SEARCH_MAX_RESULTS,
    }


def parse_cache_datetime(value: str) -> datetime:
    """캐시 파일의 ISO 8601 시각 문자열을 timezone-aware datetime으로 변환함."""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def load_search_cache() -> dict | None:
    """24시간 TTL이 남아 있고 검색 조건이 같은 YouTube 검색 캐시를 로드함."""
    if not SEARCH_CACHE_PATH.exists():
        return None

    try:
        with SEARCH_CACHE_PATH.open("r", encoding="utf-8") as file:
            cache = json.load(file)
    except (OSError, json.JSONDecodeError) as error:
        print(f"  [검색 캐시 무시] 캐시 파일을 읽을 수 없음: {type(error).__name__}")
        return None

    if cache.get("cache_key") != get_search_cache_key():
        print("  [검색 캐시 무시] 검색 조건이 변경됨")
        return None

    try:
        expires_at = parse_cache_datetime(cache["expires_at"])
    except (KeyError, ValueError, TypeError):
        print("  [검색 캐시 무시] 만료 시각 형식이 올바르지 않음")
        return None

    if datetime.now(timezone.utc) >= expires_at:
        print(f"  [검색 캐시 만료] {SEARCH_CACHE_PATH}")
        return None

    videos = cache.get("videos")
    if not isinstance(videos, list):
        print("  [검색 캐시 무시] 영상 목록 형식이 올바르지 않음")
        return None

    return cache


def save_search_cache(videos: list[dict], per_topic_selected: dict[str, int]) -> None:
    """YouTube 검색 결과를 TTL 24시간 캐시 파일로 저장함."""
    now = datetime.now(timezone.utc)
    cache = {
        "version": 1,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=SEARCH_CACHE_TTL_SECONDS)).isoformat(),
        "ttl_seconds": SEARCH_CACHE_TTL_SECONDS,
        "cache_key": get_search_cache_key(),
        "per_topic_selected": per_topic_selected,
        "videos": videos,
    }

    SEARCH_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with SEARCH_CACHE_PATH.open("w", encoding="utf-8") as file:
        json.dump(cache, file, ensure_ascii=False, indent=2)
    print(f"  [검색 캐시 저장] {SEARCH_CACHE_PATH}")


def print_search_summary(per_topic_selected: dict[str, int], unique_count: int) -> None:
    """토픽별 선정 개수와 전체 고유 영상 수를 출력함."""
    print("\n  [선정 요약]")
    all_met = True
    for label, count in per_topic_selected.items():
        status = "OK" if count >= VIDEOS_PER_TOPIC else "부족"
        if count < VIDEOS_PER_TOPIC:
            all_met = False
        print(f"    - {label}: {count}/{VIDEOS_PER_TOPIC}개 ({status})")
    print(f"  전체 고유 영상(토픽 중복 제거 후): {unique_count}개")
    if not all_met:
        print("  [경고] 일부 토픽이 목표 개수에 미달함 (조건을 만족하는 최근 영상이 부족)")


def search_topic_videos(youtube, label: str, base_query: str) -> list[dict]:
    """한 토픽을 Multi-Query로 검색하고 조건을 만족하는 상위 영상 메타데이터를 반환함.

    처리 흐름:
      1. ASPECTS를 결합한 여러 검색어로 search.list 호출(최근 RECENT_DAYS 이내) → 영상 ID 수집·중복 제거
      2. videos.list로 ID들의 상세 정보(길이·조회수·제목) 조회 (한 번에 최대 50개 배치)
      3. 길이 ≥ 5분, 조회수 ≥ 1000회 조건으로 필터
      4. 조회수 내림차순 정렬 후 상위 VIDEOS_PER_TOPIC개 선정

    Returns:
        영상 메타데이터 dict 리스트 [{video_id, title, channel, url, published_at, view_count, duration_seconds, topic}]
    """
    # 날짜 필터: 오늘(UTC) 기준 RECENT_DAYS 이전 시점을 ISO 8601(RFC 3339)로 만들어 publishedAfter에 사용함
    published_after = (
        datetime.now(timezone.utc) - timedelta(days=RECENT_DAYS)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")

    # 1) 멀티쿼리 검색 → 영상 ID 중복 제거 (dict로 모아 같은 영상이 여러 쿼리에서 나와도 1회만 유지)
    seen_ids: dict[str, str] = {}
    for aspect in ASPECTS:
        query = f"{base_query} {aspect}"
        # search.list: 검색어로 영상을 찾는 엔드포인트 (호출당 100 units 소비)
        # relevanceLanguage는 지정하지 않음 — 영어권 콘텐츠가 많은 토픽이라 한국어로 제한하면 회수율이 떨어짐
        response = youtube.search().list(
            q=query,
            part="id",                     # 상세 정보는 videos.list로 받으므로 검색에선 ID만 요청
            type="video",
            order="relevance",
            publishedAfter=published_after,  # 이 시점 이후 업로드된 영상만 (최근 3개월)
            maxResults=SEARCH_MAX_RESULTS,
        ).execute()
        for item in response.get("items", []):
            video_id = item["id"].get("videoId")
            if video_id:
                seen_ids.setdefault(video_id, query)  # 최초로 매칭된 검색어를 기록(없을 때만 추가)

    # 2) 상세 정보 조회: videos.list로 길이(contentDetails)·조회수(statistics)·제목(snippet)을 가져옴
    candidates: list[dict] = []
    for id_batch in _chunked(list(seen_ids.keys()), 50):
        detail = youtube.videos().list(
            part="contentDetails,statistics,snippet",
            id=",".join(id_batch),
        ).execute()
        for item in detail.get("items", []):
            duration_seconds = parse_duration_seconds(item["contentDetails"]["duration"])
            # 일부 영상은 조회수를 비공개로 두어 viewCount 키가 없을 수 있으므로 기본값 0으로 처리함
            view_count = int(item["statistics"].get("viewCount", 0))

            # 3) 조건 필터: 길이 5분 이상 + 조회수 1000회 이상 (최근 3개월은 publishedAfter로 이미 보장)
            if duration_seconds < MIN_DURATION_SECONDS or view_count < MIN_VIEW_COUNT:
                continue

            candidates.append({
                "video_id": item["id"],
                "title": item["snippet"]["title"],
                "channel": item["snippet"]["channelTitle"],
                "url": f"https://www.youtube.com/watch?v={item['id']}",
                "published_at": item["snippet"]["publishedAt"],
                "view_count": view_count,
                "duration_seconds": duration_seconds,
                "topic": label,
            })

    # 4) 조회수 내림차순 정렬 후 상위 N개 선정
    candidates.sort(key=lambda v: v["view_count"], reverse=True)
    selected = candidates[:VIDEOS_PER_TOPIC]

    print(f"  [{label}] 검색어 {len(ASPECTS)}개 → 후보 {len(seen_ids)}개 → 조건통과 {len(candidates)}개 → 선정 {len(selected)}개")
    return selected


def search_all_topics(youtube=None, refresh_cache: bool = False) -> list[dict]:
    """모든 토픽을 검색해 선정 영상을 합치고, 토픽 간 중복 영상은 제거해 반환함.

    한 영상이 여러 토픽(예: 'Claude Code vs Codex' 비교 영상)에서 동시에 선정될 수 있으므로,
    인덱싱 시 같은 자막이 두 번 저장되지 않도록 video_id 기준 전역 중복 제거를 수행함(처음 토픽 유지).
    토픽별 선정 개수는 완료 기준(토픽당 10개) 충족 여부를 보여주는 게이트로 로그에 출력함.
    TTL 24시간이 남은 검색 캐시가 있으면 YouTube Data API를 호출하지 않고 캐시를 재사용함.
    """
    print("\n" + "=" * 70)
    print(f"[1단계] YouTube Data API 검색 + 조건 필터 (최근 {RECENT_DAYS}일·{MIN_DURATION_SECONDS // 60}분↑·{MIN_VIEW_COUNT}회↑)")
    print("=" * 70)

    if not refresh_cache:
        cache = load_search_cache()
        if cache:
            videos = cache["videos"]
            expires_at = parse_cache_datetime(cache["expires_at"])
            print(f"  [검색 캐시 재사용] {len(videos)}개 영상, 만료: {expires_at.astimezone().strftime('%Y-%m-%d %H:%M:%S %Z')}")
            print_search_summary(cache.get("per_topic_selected", {}), len(videos))
            return videos

    if refresh_cache:
        print("  [검색 캐시 갱신] --refresh-search-cache 옵션으로 새로 검색함")

    if youtube is None:
        youtube = build_youtube_client()

    per_topic_selected: dict[str, int] = {}
    unique_videos: dict[str, dict] = {}  # video_id → 메타데이터 (전역 중복 제거용)
    for label, base_query in TOPICS.items():
        selected = search_topic_videos(youtube, label, base_query)
        per_topic_selected[label] = len(selected)
        for video in selected:
            unique_videos.setdefault(video["video_id"], video)  # 이미 다른 토픽에서 잡힌 영상은 건너뜀

    videos = list(unique_videos.values())
    print_search_summary(per_topic_selected, len(videos))
    save_search_cache(videos, per_topic_selected)

    return videos


# ---------------------------------------------------------------------------
# 2. 자막 추출 + 타임스탬프 메타데이터 부여
# ---------------------------------------------------------------------------

def get_env_int(name: str, default: int, minimum: int = 0) -> int:
    """정수형 환경변수를 읽고, 비어 있으면 기본값을 반환함."""
    raw_value = os.getenv(name)
    if not raw_value:
        return default

    try:
        value = int(raw_value)
    except ValueError as error:
        raise RuntimeError(f"{name}는 정수로 설정 필요: 현재값={raw_value}") from error

    if value < minimum:
        raise RuntimeError(f"{name}는 {minimum} 이상으로 설정 필요: 현재값={raw_value}")
    return value


def get_env_csv(name: str) -> list[str] | None:
    """쉼표로 구분한 환경변수를 리스트로 변환함."""
    raw_value = os.getenv(name)
    if not raw_value:
        return None

    values = [item.strip().lower() for item in raw_value.split(",") if item.strip()]
    return values or None


def normalize_youtube_video_id(video_ref: str) -> str:
    """YouTube 영상 URL 또는 ID에서 11자리 video_id를 추출함."""
    video_ref = video_ref.strip()
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", video_ref):
        return video_ref

    parsed = urlparse(video_ref)
    query_video_ids = parse_qs(parsed.query).get("v", [])
    if query_video_ids:
        return query_video_ids[0]

    path_parts = [part for part in parsed.path.split("/") if part]
    if parsed.netloc.endswith("youtu.be") and path_parts:
        return path_parts[0]
    if len(path_parts) >= 2 and path_parts[0] in {"shorts", "embed", "live"}:
        return path_parts[1]

    raise RuntimeError(f"YouTube 영상 URL 또는 11자리 video_id 필요: {video_ref}")


def has_webshare_username_parameters(username: str) -> bool:
    """Webshare username에 국가·도시·세션·rotate 파라미터가 이미 붙었는지 판단함."""
    lower_username = username.lower()
    return (
        bool(re.search(r"(?:^|-)[a-z]{2}(?:-|$)", lower_username))
        or "-city_" in lower_username
        or lower_username.endswith("-rotate")
        or bool(re.search(r"-\d+$", lower_username))
    )


def build_webshare_proxy_url(username: str, password: str, domain_name: str, proxy_port: int) -> str:
    """Webshare username/password/domain/port를 requests 프록시 URL로 조합함."""
    encoded_username = quote(username, safe="-_.~")
    encoded_password = quote(password, safe="")
    return f"http://{encoded_username}:{encoded_password}@{domain_name}:{proxy_port}/"


def build_rotating_generic_proxy_config(
    GenericProxyConfig,
    http_url: str | None,
    https_url: str | None,
    retries_when_blocked: int,
):
    """회전형 프록시 URL을 그대로 쓰면서 차단 재시도와 keep-alive 방지를 적용한 설정을 생성함."""

    class RotatingGenericProxyConfig(GenericProxyConfig):
        """GenericProxyConfig에 회전형 프록시용 동작을 추가한 로컬 설정 클래스."""

        @property
        def prevent_keeping_connections_alive(self) -> bool:
            """TCP 연결 재사용을 막아 요청마다 프록시 회전이 반영되도록 함."""
            return True

        @property
        def retries_when_blocked(self) -> int:
            """youtube-transcript-api 내부 RequestBlocked 재시도 횟수를 반환함."""
            return retries_when_blocked

    return RotatingGenericProxyConfig(http_url=http_url, https_url=https_url)


def build_transcript_client() -> tuple:
    """youtube-transcript-api 클라이언트를 생성함 (환경변수가 있으면 프록시 적용).

    YouTube가 짧은 시간 대량 요청을 IP 차단(RequestBlocked/IpBlocked)하므로 프록시로 우회할 수 있음.
    LangChain YoutubeLoader는 프록시 인자가 없어 youtube-transcript-api를 직접 사용함. 적용 우선순위:
      1) YT_PROXY_HTTP / YT_PROXY_HTTPS      → 검증된 HTTP(S) 프록시 URL을 그대로 사용
      2) YT_WEBSHARE_USER + YT_WEBSHARE_PASS → Webshare 레지덴셜 프록시 (IP 차단에 가장 효과적)
      3) 둘 다 없으면 → 프록시 없이 직결 (차단 시 백오프 재시도로 대응)

    참고: YouTube Data API의 captions.download는 OAuth + 본인 소유 영상만 가능해 제3자 영상 자막에는 쓸 수 없음.
    """
    from youtube_transcript_api import YouTubeTranscriptApi  # 1.x 인스턴스 API: .fetch(video_id, languages=...)
    from youtube_transcript_api.proxies import GenericProxyConfig, WebshareProxyConfig  # 프록시 설정 클래스

    webshare_user = os.getenv("YT_WEBSHARE_USER")
    webshare_pass = os.getenv("YT_WEBSHARE_PASS")
    proxy_http = os.getenv("YT_PROXY_HTTP")
    proxy_https = os.getenv("YT_PROXY_HTTPS")

    if proxy_http or proxy_https:
        # curl로 검증한 프록시 URL은 추가 변형 없이 그대로 사용함.
        proxy_config = build_rotating_generic_proxy_config(
            GenericProxyConfig,
            http_url=proxy_http or proxy_https,
            https_url=proxy_https or proxy_http,
            retries_when_blocked=get_env_int(
                "YT_PROXY_RETRIES_WHEN_BLOCKED",
                DEFAULT_WEBSHARE_RETRIES_WHEN_BLOCKED,
            ),
        )
        label = "일반/직접 프록시"
    elif webshare_user and webshare_pass:
        webshare_locations = get_env_csv("YT_WEBSHARE_LOCATIONS")
        webshare_domain = os.getenv("YT_WEBSHARE_DOMAIN") or DEFAULT_WEBSHARE_DOMAIN
        webshare_port = get_env_int("YT_WEBSHARE_PORT", DEFAULT_WEBSHARE_PORT, minimum=1)
        retries_when_blocked = get_env_int(
            "YT_WEBSHARE_RETRIES_WHEN_BLOCKED",
            DEFAULT_WEBSHARE_RETRIES_WHEN_BLOCKED,
        )

        if has_webshare_username_parameters(webshare_user):
            # Endpoint Generator에서 받은 username은 국가·세션 등이 이미 붙어 있으므로 그대로 사용함.
            proxy_url = build_webshare_proxy_url(webshare_user, webshare_pass, webshare_domain, webshare_port)
            proxy_config = build_rotating_generic_proxy_config(
                GenericProxyConfig,
                http_url=proxy_url,
                https_url=proxy_url,
                retries_when_blocked=retries_when_blocked,
            )
            label = "Webshare 프록시(직접 username)"
            if webshare_locations:
                print("  [프록시 설정] username에 국가/세션이 이미 있어 YT_WEBSHARE_LOCATIONS는 무시함")
        else:
            # WebshareProxyConfig는 기본 username에 국가 목록과 -rotate를 붙여 회전형 URL을 구성함.
            proxy_config = WebshareProxyConfig(
                proxy_username=webshare_user,
                proxy_password=webshare_pass,
                filter_ip_locations=webshare_locations,
                retries_when_blocked=retries_when_blocked,
                domain_name=webshare_domain,
                proxy_port=webshare_port,
            )
            label = "Webshare 프록시(자동 rotate)"
            if webshare_locations:
                label += f"({','.join(webshare_locations)})"
    elif webshare_user or webshare_pass:
        raise RuntimeError("YT_WEBSHARE_USER와 YT_WEBSHARE_PASS는 둘 다 설정 필요")
    else:
        proxy_config = None
        label = "직결(프록시 없음)"

    return YouTubeTranscriptApi(proxy_config=proxy_config), label


def get_transcript_cache_key(video_id: str) -> str:
    """video_id와 요청 언어 목록을 조합해 자막 캐시 키를 생성함."""
    return f"{video_id}|{','.join(TRANSCRIPT_LANGUAGES)}"


def load_transcript_cache_file() -> dict:
    """자막 캐시 파일 전체를 읽어 dict로 반환함."""
    if not TRANSCRIPT_CACHE_PATH.exists():
        return {"version": 1, "entries": {}}

    try:
        with TRANSCRIPT_CACHE_PATH.open("r", encoding="utf-8") as file:
            cache = json.load(file)
    except (OSError, json.JSONDecodeError) as error:
        print(f"       [자막 캐시 무시] 캐시 파일을 읽을 수 없음: {type(error).__name__}")
        return {"version": 1, "entries": {}}

    if not isinstance(cache.get("entries"), dict):
        print("       [자막 캐시 무시] entries 형식이 올바르지 않음")
        return {"version": 1, "entries": {}}
    return cache


def load_transcript_cache(video_id: str) -> list[dict] | None:
    """24시간 TTL이 남아 있는 영상 자막 캐시를 로드함."""
    cache = load_transcript_cache_file()
    entry = cache["entries"].get(get_transcript_cache_key(video_id))
    if not entry:
        return None

    try:
        expires_at = parse_cache_datetime(entry["expires_at"])
    except (KeyError, ValueError, TypeError):
        print("       [자막 캐시 무시] 만료 시각 형식이 올바르지 않음")
        return None

    if datetime.now(timezone.utc) >= expires_at:
        return None

    pieces = entry.get("pieces")
    if not isinstance(pieces, list):
        print("       [자막 캐시 무시] 자막 스니펫 형식이 올바르지 않음")
        return None

    print(f"       [자막 캐시] 재사용: {len(pieces)}개 스니펫")
    return pieces


def prune_transcript_cache_entries(entries: dict) -> dict:
    """만료되지 않은 자막 캐시 항목만 남겨 반환함."""
    now = datetime.now(timezone.utc)
    pruned = {}
    for key, entry in entries.items():
        try:
            expires_at = parse_cache_datetime(entry["expires_at"])
        except (KeyError, ValueError, TypeError):
            continue
        if now < expires_at:
            pruned[key] = entry
    return pruned


def save_transcript_cache(video_id: str, pieces: list[dict]) -> None:
    """영상별 자막 스니펫을 TTL 24시간 캐시 파일에 저장함."""
    now = datetime.now(timezone.utc)
    cache = load_transcript_cache_file()
    entries = prune_transcript_cache_entries(cache["entries"])
    entries[get_transcript_cache_key(video_id)] = {
        "video_id": video_id,
        "languages": list(TRANSCRIPT_LANGUAGES),
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=TRANSCRIPT_CACHE_TTL_SECONDS)).isoformat(),
        "ttl_seconds": TRANSCRIPT_CACHE_TTL_SECONDS,
        "piece_count": len(pieces),
        "pieces": pieces,
    }

    SEARCH_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with TRANSCRIPT_CACHE_PATH.open("w", encoding="utf-8") as file:
        json.dump({"version": 1, "entries": entries}, file, ensure_ascii=False, indent=2)
    print(f"       [자막 캐시] 저장: {len(pieces)}개 스니펫")


def _chunk_transcript(pieces: list[dict]) -> list:
    """raw 자막 스니펫([{text,start,duration}])을 CHUNK_SIZE_SECONDS 단위 Document로 묶음.

    LangChain YoutubeLoader의 CHUNKS 모드와 동일 로직: 스니펫 끝 시각이 현재 청크 경계를 넘으면
    버퍼를 한 청크로 확정하고 경계를 한 단계(CHUNK_SIZE_SECONDS) 전진함. 각 청크의 start_seconds는
    경계값(0, 120, 240 …)으로 부여되어 타임스탬프 URL 계산 기준이 됨.
    """
    from langchain_core.documents import Document  # page_content + metadata를 담는 LangChain 기본 문서 객체

    chunks = []
    buffer: list[dict] = []
    chunk_start = 0
    time_limit = CHUNK_SIZE_SECONDS
    for piece in pieces:
        piece_end = piece["start"] + piece["duration"]
        # 경계를 넘는 순간 직전까지 모은 버퍼를 한 청크로 확정함
        if piece_end > time_limit:
            if buffer:
                text = " ".join(p["text"].strip() for p in buffer)
                chunks.append(Document(page_content=text, metadata={"start_seconds": chunk_start}))
            buffer = []
            chunk_start = time_limit
            time_limit += CHUNK_SIZE_SECONDS
        buffer.append(piece)
    # 마지막 남은 버퍼를 청크로 확정함
    if buffer:
        text = " ".join(p["text"].strip() for p in buffer)
        chunks.append(Document(page_content=text, metadata={"start_seconds": chunk_start}))
    return chunks


def _fetch_transcript_pieces(
    ytt_api,
    video_id: str,
    use_cache: bool = True,
    refresh_cache: bool = False,
    delay_before_request: bool = False,
) -> list:
    """자막 스니펫을 조회함. 차단(RequestBlocked)이면 지수 백오프로 재시도하고, 영구 오류는 그대로 전파함.

    fetch(video_id, languages=...): TRANSCRIPT_LANGUAGES 우선순위(ko→en)로 자막을 찾아 가져옴.
    to_raw_data(): FetchedTranscript를 [{text,start,duration}] 리스트로 변환함.
    """
    from youtube_transcript_api import RequestBlocked  # IpBlocked의 상위 클래스 — 둘 다 이 except로 잡힘

    if use_cache and not refresh_cache:
        cached_pieces = load_transcript_cache(video_id)
        if cached_pieces is not None:
            return cached_pieces

    if delay_before_request:
        time.sleep(TRANSCRIPT_DELAY_SECONDS)

    for attempt in range(TRANSCRIPT_MAX_RETRIES + 1):
        try:
            fetched = ytt_api.fetch(video_id, languages=TRANSCRIPT_LANGUAGES)
            pieces = fetched.to_raw_data()
            if use_cache:
                save_transcript_cache(video_id, pieces)
            return pieces
        except RequestBlocked:
            # 마지막 시도까지 차단되면 예외를 상위로 전파해 '차단 지속'으로 처리함
            if attempt >= TRANSCRIPT_MAX_RETRIES:
                raise
            wait = TRANSCRIPT_BACKOFF_BASE * (2 ** attempt)  # 3 → 6 → 12 → 24초
            print(f"       [차단] 재시도 {attempt + 1}/{TRANSCRIPT_MAX_RETRIES} — {wait}초 대기")
            time.sleep(wait)


def load_transcripts(videos: list[dict], refresh_transcript_cache: bool = False) -> list:
    """영상별 자막을 120초 청크로 추출하고, 각 청크에 타임스탬프 URL·영상 메타데이터를 부여함.

    YoutubeLoader 대신 youtube-transcript-api를 직접 사용함 — 프록시 설정과 백오프 재시도로 IP 차단에 대응하기 위함.
    자막에는 video_id뿐이므로 제목·채널·조회수는 Data API 검색 결과(videos 인자)에서 가져와 주입함.
    자막이 없는 영상(쇼츠·특정 언어만 존재 등)은 건너뛰고, 차단이 끝까지 지속되면 프록시 설정을 권장함.
    성공한 자막 스니펫은 24시간 TTL 캐시에 저장하고, 캐시가 있으면 프록시 요청 없이 재사용함.

    Returns:
        Document 리스트 (각 Document = 120초 자막 청크 + 메타데이터)
    """
    from youtube_transcript_api import RequestBlocked  # 차단(IpBlocked 포함) — 끝까지 실패 시 프록시 권장 안내

    ytt_api, proxy_label = build_transcript_client()

    print("\n" + "=" * 70)
    print(f"[2단계] 자막 추출 (youtube-transcript-api, {CHUNK_SIZE_SECONDS}초 청킹, 언어 {TRANSCRIPT_LANGUAGES}, {proxy_label})")
    print("=" * 70)

    all_docs = []
    indexed_count = 0
    skipped_count = 0

    for index, video in enumerate(videos, start=1):
        video_id = video["video_id"]
        title = video["title"]
        print(f"  ({index}/{len(videos)}) [{video['topic']}] {title[:50]}")

        try:
            pieces = _fetch_transcript_pieces(
                ytt_api,
                video_id,
                refresh_cache=refresh_transcript_cache,
                delay_before_request=True,
            )
            docs = _chunk_transcript(pieces)                      # 120초 청크 Document로 변환

            # 자막 스니펫이 비어 청크가 없는 경우 건너뜀
            if not docs:
                print("       [자막 없음] 건너뜀")
                skipped_count += 1
                continue

            # 각 청크에 타임스탬프 URL과 Data API 메타데이터를 주입함
            for doc in docs:
                start_seconds = int(doc.metadata.get("start_seconds", 0))  # 청크 시작 시점(초)
                minutes, seconds = divmod(start_seconds, 60)  # divmod: 몫(분)과 나머지(초)를 한 번에 반환

                doc.metadata.update({
                    "video_id": video_id,
                    "title": title,
                    "channel": video["channel"],
                    "topic": video["topic"],
                    "view_count": video["view_count"],
                    "published_at": video["published_at"],
                    "video_url": video["url"],
                    # &t=초: 해당 시점부터 재생되는 YouTube 바로가기 URL
                    "timestamp_url": f"{video['url']}&t={start_seconds}",
                    "timestamp_display": f"{minutes}:{seconds:02d}",  # 02d: 두 자리로 0 패딩 (예: 2:05)
                })

            all_docs.extend(docs)
            indexed_count += 1
            print(f"       [OK] {len(docs)}개 청크")

        # 차단이 재시도 끝까지 지속된 경우: 건너뛰고 프록시 설정을 권장함
        except RequestBlocked:
            print("       [차단 지속] 건너뜀 — 프록시 설정 권장(YT_WEBSHARE_USER/PASS 또는 YT_PROXY_HTTP/HTTPS)")
            skipped_count += 1
            continue

        # 자막 미존재(NoTranscriptFound)·비활성(TranscriptsDisabled)·영상 불가 등은 개별 영상 단위로 건너뜀
        except Exception as error:
            print(f"       [실패] 건너뜀: {type(error).__name__}")
            skipped_count += 1
            continue

    print(f"\n  자막 추출 완료: 성공 {indexed_count}개 / 건너뜀 {skipped_count}개 / 총 청크 {len(all_docs)}개")
    return all_docs


def run_check_proxy(video_ref: str) -> None:
    """지정 영상 1건으로 youtube-transcript-api 프록시 연결을 점검함."""
    from youtube_transcript_api import RequestBlocked

    video_id = normalize_youtube_video_id(video_ref)
    ytt_api, proxy_label = build_transcript_client()

    print("\n" + "=" * 70)
    print(f"[프록시 점검] video_id={video_id} / 연결={proxy_label}")
    print("=" * 70)

    try:
        pieces = _fetch_transcript_pieces(ytt_api, video_id, use_cache=False)
    except RequestBlocked:
        print("[실패] YouTube가 현재 IP 또는 프록시 IP를 계속 차단함")
        print("       Webshare 레지덴셜 프록시 또는 회전형 HTTP(S) 프록시 설정 필요")
        return
    except Exception as error:
        if type(error).__name__ == "ProxyError" or "ProxyError" in repr(error):
            print(f"[실패] 프록시 연결 실패: {error}")
            print("       curl로 검증한 전체 프록시 URL은 YT_PROXY_HTTP/HTTPS에 그대로 설정 권장")
            print("       Webshare username에 국가/세션이 이미 있으면 YT_WEBSHARE_LOCATIONS는 제거 권장")
            return
        print(f"[실패] {type(error).__name__}: {error}")
        print("       영상에 ko/en 자막이 없거나, 프록시 인증/주소가 잘못되었을 수 있음")
        return

    preview = " ".join(piece["text"].strip() for piece in pieces[:3])
    print(f"[OK] 자막 스니펫 {len(pieces)}개 수신")
    print(f"     미리보기: {preview[:160]}")


# ---------------------------------------------------------------------------
# 3. 벡터 스토어 생성/추가 (자동 감지)
# ---------------------------------------------------------------------------

def get_embeddings():
    """OpenAI text-embedding-3-small 임베딩 모델을 생성해 반환함 (인덱싱·질의 공용).

    OpenAIEmbeddings: 텍스트를 1536차원 실수 벡터로 변환하는 LangChain 래퍼 (OPENAI_API_KEY 자동 참조).
    인덱싱과 질의에 반드시 같은 모델을 써야 벡터 공간이 일치해 유사도 검색이 정상 동작함.
    """
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError(f"OPENAI_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요")

    from langchain_openai import OpenAIEmbeddings

    return OpenAIEmbeddings(model=EMBEDDING_MODEL)


def create_or_update_vectorstore(docs: list):
    """자막 청크를 임베딩해 ChromaDB에 저장함. DB 없으면 최초 생성, 있으면 추가(자동 감지).

    - 최초 인덱싱: Chroma.from_documents()로 새 컬렉션 생성 후 디스크에 영속화
    - 추가 인덱싱: 기존 컬렉션을 열어 add_documents()로 청크를 누적
    """
    from langchain_chroma import Chroma  # 영속화된 벡터 컬렉션을 다루는 LangChain 벡터 저장소 래퍼

    print("\n" + "=" * 70)
    embeddings = get_embeddings()

    # CHROMA_DIR 존재 여부로 최초/추가 인덱싱을 자동 판별함
    if CHROMA_DIR.exists():
        print("[3단계] 추가 인덱싱 (기존 벡터 DB에 누적)")
        print("=" * 70)
        vectorstore = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=embeddings,
            persist_directory=str(CHROMA_DIR),
        )
        before = vectorstore._collection.count()  # _collection.count(): 컬렉션에 저장된 벡터 수
        vectorstore.add_documents(docs)           # add_documents(): 각 청크를 임베딩해 컬렉션에 추가
        after = vectorstore._collection.count()
        print(f"  기존 {before}개 → 추가 {len(docs)}개 → 총 {after}개 청크")
    else:
        print("[3단계] 최초 인덱싱 (벡터 DB 신규 생성)")
        print("=" * 70)
        # from_documents(): 문서들을 임베딩해 새 컬렉션을 만들고 persist_directory에 영속화함
        vectorstore = Chroma.from_documents(
            documents=docs,
            embedding=embeddings,
            collection_name=COLLECTION_NAME,
            persist_directory=str(CHROMA_DIR),
        )
        print(f"  생성 완료: {vectorstore._collection.count()}개 청크 → {CHROMA_DIR}")

    return vectorstore


# ---------------------------------------------------------------------------
# 4. 인덱싱 파이프라인
# ---------------------------------------------------------------------------

def run_indexing(
    reset: bool = False,
    refresh_search_cache: bool = False,
    refresh_transcript_cache: bool = False,
) -> None:
    """검색 → 자막 추출 → 벡터 DB 저장으로 이어지는 인덱싱 전체 파이프라인을 실행함."""
    # --reset: 기존 벡터 DB를 삭제하고 처음부터 다시 인덱싱함
    if reset and CHROMA_DIR.exists():
        import shutil  # 디렉터리 트리를 통째로 삭제하기 위한 표준 라이브러리

        shutil.rmtree(CHROMA_DIR)
        print(f"[reset] 기존 벡터 DB 삭제: {CHROMA_DIR}")

    videos = search_all_topics(refresh_cache=refresh_search_cache)
    if not videos:
        print("\n선정된 영상이 없음. 검색 조건을 확인해야 함.")
        return

    docs = load_transcripts(videos, refresh_transcript_cache=refresh_transcript_cache)
    if not docs:
        print("\n추출된 자막이 없음. (요청 언어 자막이 있는 영상이 없음)")
        return

    create_or_update_vectorstore(docs)

    print("\n" + "=" * 70)
    print("인덱싱 완료. 챗봇 실행: python app.py chat")
    print("=" * 70)


# ---------------------------------------------------------------------------
# 5. RAG 구성 요소 (벡터 DB 로드 · 검색기 · LLM · 체인)
# ---------------------------------------------------------------------------

def load_vectorstore():
    """인덱싱된 ChromaDB 컬렉션을 로드함 (질의 임베딩은 인덱싱과 동일한 모델 사용)."""
    from langchain_chroma import Chroma

    # 인덱싱이 선행되어야 검색 가능하므로 영속 디렉터리 존재 여부를 먼저 확인함
    if not CHROMA_DIR.exists():
        raise FileNotFoundError(
            f"벡터 DB가 없음: {CHROMA_DIR}\n먼저 'python app.py index'로 인덱싱을 수행해야 함"
        )

    vectorstore = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=get_embeddings(),
        persist_directory=str(CHROMA_DIR),
    )
    count = vectorstore._collection.count()
    if count == 0:
        raise ValueError(f"벡터 DB가 비어 있음 (컬렉션 '{COLLECTION_NAME}'). 인덱싱 재실행 필요")
    print(f"  - 벡터 DB 로드 완료: {count}개 청크")
    return vectorstore


def create_retriever(vectorstore):
    """벡터 스토어를 MMR 검색기로 변환함 (여러 영상에서 다양한 관점의 청크를 골고루 회수).

    MMR(Maximal Marginal Relevance): FETCH_K개 후보 중 관련성과 다양성을 함께 고려해 RETRIEVE_K개를 선택함.
    유사한 청크가 한 영상에 몰리는 것을 줄여 답변 근거의 다양성을 확보함.
    """
    return vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={"k": RETRIEVE_K, "fetch_k": FETCH_K, "lambda_mult": LAMBDA_MULT},
    )


def create_llm():
    """Groq LPU의 openai/gpt-oss-120b 채팅 모델을 생성해 반환함.

    ChatGroq: Groq Cloud LPU에 채팅 요청을 보내는 LangChain 모델 래퍼 (GROQ_API_KEY 자동 참조).
    gpt-oss-120b는 추론 모델이라 사고 과정이 답변에 섞일 수 있으므로 reasoning_format="hidden"으로 최종 답변만 받음.
    """
    if not os.getenv("GROQ_API_KEY"):
        raise RuntimeError(f"GROQ_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요")

    from langchain_groq import ChatGroq

    return ChatGroq(
        model=LLM_MODEL,
        temperature=0.3,            # 낮은 값으로 사실 중심·일관된 답변 유도
        reasoning_format="hidden",  # 추론 과정을 숨기고 최종 답변 텍스트만 반환
    )


def format_docs(docs: list) -> str:
    """검색된 청크들을 LLM 프롬프트용 컨텍스트 문자열로 합침 (제목·시점·바로가기 URL 포함)."""
    blocks = []
    for index, doc in enumerate(docs, start=1):
        meta = doc.metadata
        header = f"[청크 {index}] {meta.get('title', 'Unknown')} (채널: {meta.get('channel', '?')})"
        timestamp = f"  시작 시점: {meta.get('timestamp_display', '0:00')} | 바로가기: {meta.get('timestamp_url', '')}"
        blocks.append(f"{header}\n{timestamp}\n\n{doc.page_content}")
    # 청크 사이를 구분선으로 띄워 LLM이 문서 경계를 인식하기 쉽게 함
    return "\n\n---\n\n".join(blocks)


def format_chunks_for_display(docs: list) -> str:
    """검색된 청크를 사용자 확인용 요약(제목·시점·내용 미리보기)으로 포맷팅함."""
    lines = []
    for index, doc in enumerate(docs, start=1):
        meta = doc.metadata
        preview = doc.page_content[:80].replace("\n", " ")  # 줄바꿈을 공백으로 바꿔 한 줄로 미리보기
        lines.append(
            f"  [{index}] {meta.get('title', 'Unknown')[:40]} @ {meta.get('timestamp_display', '0:00')}\n"
            f"      {meta.get('timestamp_url', '')}\n"
            f"      {preview}..."
        )
    return "\n".join(lines)


def build_rag_chain(llm):
    """프롬프트 → LLM → 문자열 파서로 이어지는 LCEL 체인을 구성해 반환함."""
    from langchain_core.output_parsers import StrOutputParser  # AIMessage에서 본문 텍스트만 추출
    from langchain_core.prompts import ChatPromptTemplate      # system/human 메시지 템플릿 구성

    prompt = ChatPromptTemplate.from_messages(
        [("system", SYSTEM_PROMPT), ("human", HUMAN_PROMPT)]
    )
    # | 연산자(LCEL): prompt → llm → parser를 파이프라인으로 연결함
    return prompt | llm | StrOutputParser()


# ---------------------------------------------------------------------------
# 6. 질의 실행 (단발성 · 대화형)
# ---------------------------------------------------------------------------

def answer_question(question: str, retriever, chain, show_chunks: bool = True) -> str:
    """질문으로 자막 청크를 검색하고, 그 청크를 컨텍스트로 LLM 답변을 생성해 반환함."""
    docs = retriever.invoke(question)  # invoke(): 질문을 임베딩해 유사 청크를 회수
    if not docs:
        print("\n관련 청크를 찾지 못했습니다.")
        return ""

    if show_chunks:
        print(f"\n[검색된 청크 {len(docs)}개]")
        print(format_chunks_for_display(docs))

    print("\n[답변 생성 중...]\n")
    answer = chain.invoke({"context": format_docs(docs), "question": question})
    print("-" * 70)
    print(answer)
    print("-" * 70)
    return answer


def run_ask(question: str) -> None:
    """단발성 질문 1건을 처리함 (벡터 DB 로드 → 검색 → 답변)."""
    print("[1/2] 벡터 DB 로드")
    retriever = create_retriever(load_vectorstore())
    print("[2/2] LLM 생성 (Groq openai/gpt-oss-120b)")
    chain = build_rag_chain(create_llm())

    print("\n" + "=" * 70)
    print(f"[질문] {question}")
    print("=" * 70)
    answer_question(question, retriever, chain)


def run_chat() -> None:
    """대화형 RAG 챗봇 루프를 실행함 ('quit'/'q' 입력 시 종료)."""
    print("[1/2] 벡터 DB 로드")
    retriever = create_retriever(load_vectorstore())
    print("[2/2] LLM 생성 (Groq openai/gpt-oss-120b)")
    chain = build_rag_chain(create_llm())

    print("\n" + "=" * 70)
    print("YouTube RAG 챗봇 (Claude Code · Antigravity · Codex 영상 기반)")
    print("질문을 입력하세요. 종료: quit / q")
    print("=" * 70)

    while True:
        try:
            question = input("\n질문> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n챗봇을 종료합니다.")
            break

        if not question:
            continue
        if question.lower() in {"quit", "q", "exit", "종료"}:
            print("챗봇을 종료합니다.")
            break

        try:
            answer_question(question, retriever, chain)
        # 답변 1건의 오류(네트워크·API 등)로 루프 전체가 죽지 않도록 개별적으로 처리함
        except Exception as error:
            print(f"\n[오류] {type(error).__name__}: {error}")


# ---------------------------------------------------------------------------
# 메인 (CLI 모드 분기)
# ---------------------------------------------------------------------------

def main() -> None:
    """명령행 인자를 파싱해 index / check-proxy / chat / ask 모드를 실행함."""
    parser = argparse.ArgumentParser(description="YouTube Data API + Multi-Query 자막 RAG 예제")
    # 서브커맨드: index(기본) / check-proxy / chat / ask
    subparsers = parser.add_subparsers(dest="command")

    index_parser = subparsers.add_parser("index", help="영상 검색 → 자막 추출 → 벡터 DB 인덱싱")
    index_parser.add_argument("--reset", action="store_true", help="기존 벡터 DB 삭제 후 재생성")
    index_parser.add_argument("--refresh-search-cache", action="store_true", help="24시간 검색 캐시를 무시하고 새로 검색")
    index_parser.add_argument("--refresh-transcript-cache", action="store_true", help="24시간 자막 캐시를 무시하고 새로 추출")

    check_parser = subparsers.add_parser("check-proxy", help="자막 프록시 연결만 점검")
    check_parser.add_argument("video", help="자막이 있는 YouTube 영상 URL 또는 11자리 video_id")

    subparsers.add_parser("chat", help="대화형 RAG 챗봇 실행")

    ask_parser = subparsers.add_parser("ask", help="단발성 질문 1회 답변")
    ask_parser.add_argument("question", help="질문 내용")

    args = parser.parse_args()

    # 서브커맨드 미지정 시 기본은 인덱싱 (완료 기준이 인덱싱·테스트 검색이므로)
    if args.command in (None, "index"):
        run_indexing(
            reset=getattr(args, "reset", False),
            refresh_search_cache=getattr(args, "refresh_search_cache", False),
            refresh_transcript_cache=getattr(args, "refresh_transcript_cache", False),
        )
    elif args.command == "check-proxy":
        run_check_proxy(args.video)
    elif args.command == "chat":
        run_chat()
    elif args.command == "ask":
        run_ask(args.question)


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"\n[오류] 실행 실패: {error}", file=sys.stderr)
        sys.exit(1)
