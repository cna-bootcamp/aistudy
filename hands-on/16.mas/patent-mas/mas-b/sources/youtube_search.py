"""YouTube 소스: Data API v3 영상 검색 + LangChain YoutubeLoader 자막 로드 + 임베딩 청크 선별.

[처리 흐름]
  1. search_videos     : YouTube Data API v3로 최근 1년 한국어 영상 검색 (제목·채널·URL 확보)
  2. YoutubeLoader     : 상위 영상의 자막을 120초 청크 Document로 로드 (CHUNKS 모드)
  3. 임베딩 청크 선별   : 질의와 자막 청크를 OpenAI 임베딩으로 벡터화 → 코사인 유사도 상위 K개만 선별
                          ('질의 벡터화 시' 임베딩 사용 — 답변 근거가 될 핵심 구간만 컨텍스트에 넣음)
  각 청크에 타임스탬프 URL(&t=초)을 부여해 "몇 분부터 보면 되는지" 정확한 시점을 인용함.

[설계 메모]
  - 자막 로드는 LangChain YoutubeLoader를 사용함 — Webshare 프록시 같은 추가 비용·복잡성 없이
    youtube-transcript-api를 LangChain 표준 방식으로 호출함. 자막이 없거나 차단되면 해당 영상은
    건너뛰고(graceful degradation) 영상 메타데이터(제목·URL)만으로 답변·출처를 구성함.
  - 같은 영상이 Self-RAG 재시도 루프에서 중복 로드되지 않도록 프로세스 수명 인메모리 캐시를 둠.
"""

from __future__ import annotations

import html
import sys
from datetime import datetime, timedelta, timezone

import numpy as np                                  # 코사인 유사도 계산 (영속 벡터스토어 없이 인메모리)
from googleapiclient.discovery import build         # YouTube Data API v3 클라이언트 팩토리
from langchain_community.document_loaders import YoutubeLoader
from langchain_community.document_loaders.youtube import TranscriptFormat
from langchain_openai import OpenAIEmbeddings

from config import settings

# 프로세스 수명 자막 캐시: video_id → 120초 청크 Document 리스트 (재시도 루프 중복 로드 방지)
_TRANSCRIPT_CACHE: dict[str, list] = {}


def search_videos(query: str) -> list[dict]:
    """YouTube Data API v3로 최근 1년 한국어 영상을 검색해 메타데이터를 반환함.

    제목·채널은 자막에 없으므로 Data API 검색 결과에서 확보함 (YoutubeLoader add_video_info=False).
    반환: [{video_id, title, channel, description, url, published_at}]
    """
    api_key = settings.require_env("YOUTUBE_API_KEY")
    youtube = build("youtube", "v3", developerKey=api_key)

    # 최근 1년 경계 시각을 UTC ISO 8601(...Z)로 만들어 publishedAfter에 사용함
    published_after = (
        datetime.now(timezone.utc) - timedelta(days=settings.YOUTUBE_RECENT_DAYS)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")

    response = youtube.search().list(
        q=query,
        part="snippet",                                   # 제목·채널·설명 등 기본 메타데이터
        type="video",                                     # 영상만 (채널·재생목록 제외)
        order="relevance",
        publishedAfter=published_after,                   # 최근 1년 영상만
        maxResults=settings.YOUTUBE_MAX_RESULTS,
        relevanceLanguage=settings.YOUTUBE_RELEVANCE_LANGUAGE,  # 한국어 관련 영상 우선
    ).execute()

    videos = []
    for item in response.get("items", []):
        video_id = item["id"]["videoId"]
        snippet = item["snippet"]
        videos.append({
            "video_id": video_id,
            # html.unescape: API가 제목/설명에 넣는 HTML 엔티티(&#39; 등)를 일반 문자로 복원함
            "title": html.unescape(snippet["title"]),
            "channel": html.unescape(snippet["channelTitle"]),
            "description": html.unescape(snippet.get("description", "")),
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "published_at": snippet.get("publishedAt", ""),
        })
    return videos


def _load_transcript_chunks(video: dict) -> list:
    """YoutubeLoader로 한 영상의 자막을 120초 청크 Document로 로드함 (캐시 + graceful).

    자막이 없거나(NoTranscriptFound)·비활성·차단된 영상은 빈 리스트로 처리해 전체 흐름을 막지 않음.
    """
    video_id = video["video_id"]
    if video_id in _TRANSCRIPT_CACHE:                     # 재시도 루프에서 같은 영상 재로드 방지
        return _TRANSCRIPT_CACHE[video_id]

    chunks = []
    try:
        loader = YoutubeLoader.from_youtube_url(
            video["url"],
            add_video_info=False,                         # pytube 의존 메타 조회 비활성 (제목·채널은 Data API에서 확보)
            language=settings.TRANSCRIPT_LANGUAGES,        # ko → en 우선
            transcript_format=TranscriptFormat.CHUNKS,     # 120초 단위 청크 Document로 분할
            chunk_size_seconds=settings.TRANSCRIPT_CHUNK_SECONDS,
        )
        chunks = loader.load()
    except Exception as error:  # noqa: BLE001 - 자막 미존재·차단 등은 영상 단위로 건너뜀
        print(f"  ! [youtube] 자막 로드 실패(건너뜀): {video['title'][:40]} — {type(error).__name__}",
              file=sys.stderr)
        chunks = []

    _TRANSCRIPT_CACHE[video_id] = chunks
    return chunks


def _cosine_scores(query_vector: list[float], chunk_matrix: list[list[float]]) -> np.ndarray:
    """질의 벡터와 청크 벡터 행렬 사이의 코사인 유사도를 한 번에 계산함."""
    query = np.asarray(query_vector, dtype=np.float32)
    matrix = np.asarray(chunk_matrix, dtype=np.float32)
    query_norm = query / (np.linalg.norm(query) + 1e-9)
    matrix_norm = matrix / (np.linalg.norm(matrix, axis=1, keepdims=True) + 1e-9)
    return matrix_norm @ query_norm                       # (N,) 유사도 벡터


def _select_relevant_chunks(videos: list[dict], query: str) -> list[dict]:
    """상위 영상들의 자막 청크를 모아 질의와의 임베딩 코사인 유사도 상위 K개를 선별함.

    반환: [{video_id, title, channel, text, timestamp_display, timestamp_url, score}]
    """
    # 상위 VIDEOS_FOR_TRANSCRIPT개 영상의 자막 청크를 후보로 수집함
    candidates: list[tuple[dict, str, int]] = []          # (video, 청크 텍스트, 시작 초)
    for video in videos[:settings.VIDEOS_FOR_TRANSCRIPT]:
        for doc in _load_transcript_chunks(video):
            text = doc.page_content.strip()
            if not text:
                continue
            start_seconds = int(doc.metadata.get("start_seconds", 0))
            candidates.append((video, text, start_seconds))

    if not candidates:                                    # 모든 영상에 자막이 없으면 빈 결과
        return []

    # 질의 + 후보 청크를 임베딩해 코사인 유사도 상위 K개를 고름 (질의 벡터화 사용 지점)
    embeddings = OpenAIEmbeddings(model=settings.EMBEDDING_MODEL)
    chunk_vectors = embeddings.embed_documents([text for _, text, _ in candidates])
    query_vector = embeddings.embed_query(query)
    scores = _cosine_scores(query_vector, chunk_vectors)

    # 유사도 내림차순 상위 K개 인덱스 (argsort는 오름차순이라 뒤집음)
    top_indices = np.argsort(scores)[::-1][:settings.TRANSCRIPT_TOP_K]

    results = []
    for index in top_indices:
        video, text, start_seconds = candidates[int(index)]
        minutes, seconds = divmod(start_seconds, 60)      # divmod: 몫(분)·나머지(초)를 한 번에
        results.append({
            "video_id": video["video_id"],
            "title": video["title"],
            "channel": video["channel"],
            "text": text,
            "timestamp_display": f"{minutes}:{seconds:02d}",
            # &t=초: 해당 시점부터 재생되는 YouTube 바로가기 URL
            "timestamp_url": f"{video['url']}&t={start_seconds}",
            "score": float(scores[int(index)]),
        })
    return results


def search_youtube(query: str) -> dict:
    """YouTube 소스 진입점: 영상 검색 + 자막 청크 선별을 함께 수행함.

    반환:
        {"videos": [영상 메타데이터...], "chunks": [관련 자막 청크...]}
        videos는 항상 채워지고(검색 성공 시), chunks는 자막이 있는 경우에만 채워짐.
    """
    try:
        videos = search_videos(query)
    except Exception as error:  # noqa: BLE001 - 할당량 초과·네트워크 오류는 빈 결과로 흡수
        print(f"  ! [youtube] 영상 검색 실패(무시하고 진행): {type(error).__name__}: {str(error)[:120]}",
              file=sys.stderr)
        return {"videos": [], "chunks": []}

    chunks = _select_relevant_chunks(videos, query) if videos else []
    return {"videos": videos, "chunks": chunks}


# ---------------------------------------------------------------------------
# 독립 실행 스모크 테스트: python -m sources.youtube_search  (mas-b 디렉터리에서)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    result = search_youtube("특허 출원 방법")
    print(f"\n영상 {len(result['videos'])}건:")
    for video in result["videos"]:
        print(f"  - {video['title'][:50]} ({video['channel']}) {video['url']}")
    print(f"\n선별된 자막 청크 {len(result['chunks'])}개:")
    for chunk in result["chunks"]:
        print(f"  - [{chunk['score']:.3f}] {chunk['title'][:35]} @ {chunk['timestamp_display']}")
        print(f"    {chunk['timestamp_url']}")
        print(f"    {chunk['text'][:90]}...")
