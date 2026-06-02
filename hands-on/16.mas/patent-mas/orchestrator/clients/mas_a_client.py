"""MAS A 통신 클라이언트 — MCP 클라이언트 (Streamable HTTP).

분산 MAS에서 MAS A(법령지식)는 FastMCP 서버(mas-a/server.py, 기본 :8010)로 노출됨.
오케스트레이터는 이 모듈의 비동기 함수로 ask_patent_law 도구를 원격 호출함
(교재 §2.3 '외부 연동: MCP'). mas-a/test_mcp_client.py 와 동일한 전송 계층을 사용함.

[비동기 호출 이유] A∥B 병렬 분기에서 네트워크 대기를 겹치려면 await 가능한 코루틴이어야 함.
LangGraph 비동기 노드가 이 코루틴을 asyncio.wait_for 로 감싸 분기별 타임아웃을 건다.
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

from typing import Any

# MCP 파이썬 SDK — ClientSession(세션 추상) + streamablehttp_client(전송 계층)
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

from config.settings import settings


async def ask_patent_law_async(question: str, mode: str = "auto") -> dict[str, Any]:
    """MAS A FastMCP 서버의 ask_patent_law 도구를 원격 호출하고 구조화 결과를 반환함.

    streamablehttp_client / ClientSession 동작:
      1. /mcp 엔드포인트로 Streamable HTTP 양방향 채널(read, write)을 엶
      2. session.initialize() 로 프로토콜 핸드셰이크 수행
      3. call_tool() 결과의 structuredContent 에 도구의 dict 반환값이 담겨 옴
    """
    url = settings.mcp_a_url
    async with streamablehttp_client(url) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            call = await session.call_tool(
                "ask_patent_law", {"question": question, "mode": mode}
            )
            # structuredContent: 도구가 반환한 dict (answer/resolved_mode/sources/evidence 등)
            structured = getattr(call, "structuredContent", None) or {}
            return structured


def to_context_items(result: dict[str, Any]) -> list[dict]:
    """MAS A 결과를 MAS C 의 provided_context 형태({source,title,content,citation})로 변환함.

    A의 답변 본문 자체가 가장 응집된 법령 근거이므로 첫 항목으로 넣고, 개별 출처 스니펫을 뒤에 붙임.
    citation 은 코드에서 직접 구성해 인용 환각을 방지함(단위 MAS와 동일한 원칙).
    """
    items: list[dict] = []
    answer = result.get("answer", "")
    if answer:
        items.append({
            "source": "법령(MAS A)",
            "title": "특허법 법령지식 종합",
            "content": answer,
            "citation": "- 특허법 법령지식 MAS(MS GraphRAG + 조문 벡터 RAG)",
        })
    for src in result.get("sources", []) or []:
        title = src.get("title", "")
        snippet = src.get("snippet", "") or ""
        if not (title or snippet):
            continue
        items.append({
            "source": "법령(MAS A)",
            "title": title or "조문 근거",
            "content": snippet,
            "citation": f"- {title}" if title else "- 조문 근거(MAS A)",
        })
    return items
