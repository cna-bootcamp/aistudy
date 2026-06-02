"""웹 검색 소스 (DuckDuckGo) — 특허 관련 뉴스·시장 동향 수집.

API 키가 필요 없는 DuckDuckGoSearchAPIWrapper로 최근 1년 한국어 결과를 검색함.
.results()는 .run()(텍스트만)과 달리 title·snippet·link를 담은 딕셔너리를 반환하므로
출처 URL 표기가 필요한 동향 리서치에 적합함.
"""

from __future__ import annotations

import sys

# DuckDuckGoSearchAPIWrapper: DuckDuckGo 검색을 감싼 LangChain 유틸 (API 키 불필요)
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper

from config import settings


def search_web(query: str) -> list[dict]:
    """DuckDuckGo로 최근 1년 웹 문서를 검색해 출처 링크 포함 결과를 반환함.

    time='y'로 최근 1년만 검색하므로 쿼리에는 연도·시간 표현을 넣지 않음(라우터에서 보장).
    DuckDuckGo는 RatelimitException이 잦으므로 실패 시 빈 리스트로 graceful 처리함.
    반환: [{"title", "snippet", "link"}]
    """
    wrapper = DuckDuckGoSearchAPIWrapper(
        region=settings.WEB_REGION,        # 한국어/한국 지역 결과 우선
        time=settings.WEB_TIME,            # 최근 1년 필터
        max_results=settings.WEB_MAX_RESULTS,
    )

    try:
        # results(query, max_results): 링크 포함 상세 결과 리스트 반환
        raw_results = wrapper.results(query, settings.WEB_MAX_RESULTS)
    except Exception as error:  # noqa: BLE001 - rate limit·네트워크 오류를 빈 결과로 흡수
        print(f"  ! [web] 검색 실패(무시하고 진행): {type(error).__name__}: {str(error)[:120]}", file=sys.stderr)
        return []

    normalized = []
    for item in raw_results:
        link = item.get("link", "")
        # 웹 결과에 섞인 YouTube 페이지는 제외함 — 영상은 YouTube 소스가 전담하므로 출처를 분리함
        if "youtube.com" in link or "youtu.be" in link:
            continue
        normalized.append({
            "title": item.get("title", "제목 없음"),
            "snippet": item.get("snippet", ""),
            "link": link,
        })
    return normalized
