"""Web Search Agent

DuckDuckGo(ddgs)로 웹을 검색하고, 결과 URL의 본문을 requests + BeautifulSoup으로 크롤링함.
네트워크 실패·차단·자막 없음은 흔하므로 모든 예외를 흡수하여 빈 결과를 반환함 (그래프 중단 금지).
"""
from __future__ import annotations

import re
from typing import Optional

import requests
from bs4 import BeautifulSoup  # HTML 파싱 — 불필요 태그 제거 후 본문 텍스트만 추출

from config.settings import settings, AGENTS, ERROR_PAGE_PATTERNS
from utils.logger import get_logger

logger = get_logger("agents.web")

# 브라우저처럼 보이게 하여 일부 사이트의 봇 차단을 완화함
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    )
}


def is_error_page(content: str, min_length: Optional[int] = None) -> bool:
    """본문이 에러/차단 페이지인지 판단함 (너무 짧거나 에러 패턴 매칭)."""
    if min_length is None:
        min_length = settings.web_min_content_length
    if len(content) < min_length:
        return True
    lowered = content.lower()
    for pattern in ERROR_PAGE_PATTERNS:
        if re.search(pattern, lowered, re.IGNORECASE):
            return True
    return False


def load_web_page(url: str, max_chars: Optional[int] = None) -> Optional[str]:
    """웹 페이지를 받아 본문 텍스트만 추출하여 반환함 (실패 시 None)."""
    if max_chars is None:
        max_chars = settings.web_page_max_chars
    try:
        response = requests.get(url, headers=_HEADERS, timeout=settings.web_request_timeout)
        response.raise_for_status()
        # 인코딩 자동 추정으로 한글 깨짐 완화
        response.encoding = response.apparent_encoding or response.encoding

        soup = BeautifulSoup(response.text, "html.parser")
        # 본문이 아닌 구조/부가 요소를 제거하여 노이즈를 줄임
        for tag in soup.find_all(["script", "style", "nav", "footer", "header", "aside", "form", "noscript", "iframe", "svg"]):
            tag.decompose()  # 태그를 트리에서 완전히 삭제함

        content = soup.get_text(separator=" ", strip=True)
        content = re.sub(r"\s+", " ", content)  # 연속 공백을 하나로 압축

        if not content or is_error_page(content):
            return None
        if len(content) > max_chars:
            content = content[:max_chars] + "..."
        return content
    except Exception as e:
        logger.warning(f"웹 페이지 로드 실패 ({url}): {e}")
        return None


class WebAgent:
    """DuckDuckGo 기반 웹 검색 + 본문 크롤링 Agent."""

    def __init__(self, max_results: Optional[int] = None) -> None:
        """Web Agent 초기화."""
        self.max_results = max_results or settings.web_max_results
        self.name = AGENTS.get("web_agent", {}).get("name", "Web Search Agent")

    def search(self, query: str, max_results: Optional[int] = None) -> list[dict]:
        """DuckDuckGo로 검색하고 각 결과 URL의 본문을 함께 추출하여 반환함.

        반환 각 dict: {title, snippet, url, content(본문 또는 None)}
        """
        max_results = max_results or self.max_results
        try:
            # ddgs: DuckDuckGo 검색 클라이언트 (공식 API 키 불필요)
            from ddgs import DDGS
            with DDGS() as ddgs:
                # 본문 로드 실패분을 감안해 목표의 2배를 받아 성공분만 사용
                raw = list(ddgs.text(query, max_results=max_results * 2, region="kr-kr"))

            results: list[dict] = []
            for item in raw:
                if len(results) >= max_results:
                    break
                url = item.get("href") or item.get("url", "")
                if not url:
                    continue
                content = load_web_page(url)
                results.append({
                    "title": item.get("title", ""),
                    "snippet": item.get("body", ""),
                    "url": url,
                    "content": content,
                })
            logger.info(f"[Web] 검색 결과: {len(results)}건")
            return results
        except Exception as e:
            logger.error(f"웹 검색 실패(빈 결과 반환): {e}")
            return []

    def format_results(self, results: list[dict]) -> str:
        """검색 결과를 LLM 프롬프트용 문자열로 포맷함."""
        if not results:
            return "웹 검색 결과 없음."
        parts = []
        for i, r in enumerate(results, 1):
            content = r.get("content") or r.get("snippet", "")
            parts.append(f"[웹 {i}] {r.get('title', '제목 없음')}\n{content[:1000]}\nURL: {r.get('url', '')}")
        return "\n\n".join(parts)
