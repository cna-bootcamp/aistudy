"""YouTube Agent

scrapetube로 영상을 검색하고, youtube-transcript-api(1.x)로 자막을 직접 추출함.
YouTube는 대량 요청 시 IP를 차단(RequestBlocked)하므로 .env의 Webshare 프록시(YT_WEBSHARE_*)가
있으면 자동 적용함. 자막 없음·차단·검색 실패는 모두 흡수하여 빈 결과를 반환함 (그래프 중단 금지).

youtube-transcript-api 1.x API 사용 (버전 churn 주의):
  api = YouTubeTranscriptApi(proxy_config=...)
  fetched = api.fetch(video_id, languages=["ko", "en"])
  pieces = fetched.to_raw_data()   # [{text, start, duration}, ...]
"""
from __future__ import annotations

import os
from typing import Optional

import scrapetube  # YouTube 검색 (YouTube Data API 키 불필요)

from config.settings import settings, AGENTS
from utils.logger import get_logger

logger = get_logger("agents.youtube")


def _build_transcript_client(use_proxy: bool = True):
    """youtube-transcript-api 클라이언트를 생성함 (use_proxy + Webshare 자격증명이 있으면 프록시 적용).

    Webshare 레지덴셜 프록시는 YouTube IP 차단 우회에 효과적임. 자격증명이 없거나 use_proxy=False면 직결로 동작함.
    """
    from youtube_transcript_api import YouTubeTranscriptApi  # 1.x 인스턴스 API
    from youtube_transcript_api.proxies import WebshareProxyConfig  # Webshare 프록시 설정 클래스

    user = os.getenv("YT_WEBSHARE_USER")
    password = os.getenv("YT_WEBSHARE_PASS")
    if use_proxy and user and password:
        proxy_config = WebshareProxyConfig(proxy_username=user, proxy_password=password)
        logger.debug("[YouTube] Webshare 프록시 적용")
        return YouTubeTranscriptApi(proxy_config=proxy_config), True
    logger.debug("[YouTube] 프록시 없이 직결")
    return YouTubeTranscriptApi(), False


def _extract_video_title(video: dict) -> str:
    """scrapetube 검색 결과(중첩 dict 구조)에서 영상 제목을 추출함."""
    title = video.get("title", {})
    if isinstance(title, dict):
        return title.get("runs", [{}])[0].get("text", "제목 없음")
    return str(title) if title else "제목 없음"


def _chunk_transcript(pieces: list[dict], chunk_seconds: int) -> list[dict]:
    """raw 자막 스니펫([{text,start,duration}])을 chunk_seconds 단위 청크로 묶음.

    스니펫 끝 시각이 현재 청크 경계를 넘으면 버퍼를 한 청크로 확정하고 경계를 한 단계 전진함.
    각 청크에 타임스탬프 표시·바로가기 URL 정보를 함께 부여함.
    """
    chunks: list[dict] = []
    buffer: list[dict] = []
    chunk_start = 0
    time_limit = chunk_seconds
    for piece in pieces:
        piece_end = piece.get("start", 0) + piece.get("duration", 0)
        if piece_end > time_limit:
            if buffer:
                chunks.append(_make_chunk(buffer, chunk_start))
            buffer = []
            chunk_start = time_limit
            time_limit += chunk_seconds
        buffer.append(piece)
    if buffer:
        chunks.append(_make_chunk(buffer, chunk_start))
    return chunks


def _make_chunk(buffer: list[dict], start_seconds: int) -> dict:
    """버퍼의 스니펫들을 한 청크 dict로 합침 (타임스탬프 표시 포함)."""
    text = " ".join(p.get("text", "").strip() for p in buffer)
    minutes, seconds = divmod(int(start_seconds), 60)  # divmod: 몫(분)과 나머지(초)를 한 번에 반환
    return {
        "content": text,
        "timestamp_display": f"{minutes}:{seconds:02d}",  # 02d: 두 자리 0 패딩 (예: 2:05)
        "start_seconds": int(start_seconds),
    }


class YouTubeAgent:
    """YouTube 영상 검색 + 자막 추출 Agent."""

    def __init__(self, max_results: Optional[int] = None) -> None:
        """YouTube Agent 초기화."""
        self.max_results = max_results or settings.youtube_max_results
        self.name = AGENTS.get("youtube_agent", {}).get("name", "YouTube Agent")
        self.languages = list(settings.youtube_languages)
        self.chunk_seconds = settings.youtube_chunk_seconds

    def _load_transcript(self, api, video_id: str) -> tuple[list[dict], bool]:
        """단일 영상의 자막을 추출하여 (청크 리스트, 프록시오류여부)를 반환함 (실패 시 빈 리스트).

        프록시 연결 자체가 실패(ProxyError)하면 두 번째 값을 True로 반환하여 호출부가 직결 폴백하도록 함.
        """
        try:
            fetched = api.fetch(video_id, languages=self.languages)
            pieces = fetched.to_raw_data()  # [{text, start, duration}, ...]
            return _chunk_transcript(pieces, self.chunk_seconds), False
        except Exception as e:
            # 자막 없음·비활성·차단 등은 영상 단위로 건너뜀 (전체 흐름은 계속)
            is_proxy_error = "Proxy" in type(e).__name__
            logger.warning(f"[YouTube] 자막 추출 실패({video_id}): {type(e).__name__}")
            return [], is_proxy_error

    def search(self, query: str, max_results: Optional[int] = None) -> list[dict]:
        """영상을 검색하고 자막이 있는 영상만 결과로 반환함.

        반환 각 dict: {title, url, channel, transcript_chunks, has_transcript}
        """
        max_results = max_results or self.max_results
        try:
            # 우선 Webshare 프록시로 시도하고, 프록시 연결이 실패하면 직결 클라이언트로 한 번 전환함
            api, proxy_active = _build_transcript_client(use_proxy=True)
            # 자막 없는 영상을 감안해 목표의 3배를 검색
            videos = scrapetube.get_search(query, limit=max_results * 3, sort_by="relevance")

            results: list[dict] = []
            for video in videos:
                if len(results) >= max_results:
                    break
                video_id = video.get("videoId", "")
                if not video_id or len(video_id) < 5:
                    continue
                title = _extract_video_title(video)
                if not title or title == "제목 없음" or len(title) < 2:
                    continue
                channel = video.get("ownerText", {}).get("runs", [{}])[0].get("text", "알 수 없음")

                chunks, proxy_error = self._load_transcript(api, video_id)
                # 프록시 자체가 죽은 경우(ProxyError) 직결로 1회 전환 후 같은 영상을 재시도함
                if proxy_error and proxy_active:
                    logger.info("[YouTube] 프록시 실패 → 직결로 전환하여 재시도")
                    api, proxy_active = _build_transcript_client(use_proxy=False)
                    chunks, _ = self._load_transcript(api, video_id)
                results.append({
                    "title": title,
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "channel": channel,
                    "transcript_chunks": chunks,
                    "has_transcript": len(chunks) > 0,
                })
            logger.info(f"[YouTube] 검색 결과: {len(results)}건")
            return results
        except Exception as e:
            logger.error(f"YouTube 검색 실패(빈 결과 반환): {e}")
            return []

    def format_results(self, results: list[dict]) -> str:
        """검색 결과를 LLM 프롬프트용 문자열로 포맷함 (자막 일부 + URL)."""
        if not results:
            return "YouTube 검색 결과 없음."
        parts = []
        for i, r in enumerate(results, 1):
            chunks = r.get("transcript_chunks", [])
            header = f"[YouTube {i}] {r.get('title', '제목 없음')} ({r.get('channel', '')})"
            if chunks:
                # 앞쪽 청크 3개·각 200자만 컨텍스트로 사용 (토큰 절약)
                body = "\n".join(f"  [{c['timestamp_display']}] {c['content'][:200]}" for c in chunks[:3])
                parts.append(f"{header}\n자막:\n{body}\nURL: {r.get('url', '')}")
            else:
                parts.append(f"{header}\n(자막 없음)\nURL: {r.get('url', '')}")
        return "\n\n".join(parts)
