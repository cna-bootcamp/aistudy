"""korean-law MCP (원격 Streamable HTTP) 클라이언트 + 응답 파서.

MAS B는 외부 동적 법령 소스(판례·해석례·최신 법령)를 korean-law MCP 서버에서 가져옴.
서버는 https://korean-law-mcp.fly.dev/mcp?oc=<LAW_OC> 에 Streamable HTTP로 노출되며,
이 모듈은 mcp 파이썬 SDK의 ClientSession으로 그 서버의 MCP '클라이언트'로 동작함.

[설계 메모]
  - LangGraph 그래프는 동기(.invoke)로 동작하고, MCP 호출은 비동기임.
    동기 retrieve 노드 안에서 asyncio.run(run_law_search 내부)으로 브리지함.
    (그래프가 동기 컨텍스트라 실행 중인 이벤트 루프가 없어 asyncio.run이 안전함)
  - 비동기 진입점(search_law_sources)을 한 함수로 격리해 두어, 추후 오케스트레이터가
    async에서 호출할 때 동기 래퍼 대신 이 함수를 await 하도록 쉽게 교체 가능함.
  - 한 번의 retrieve = 한 번의 MCP 세션 — 그 안에서 필요한 도구를 순차 호출하고 닫음.

[korean-law MCP 응답 형식]
  도구는 JSON이 아닌 '사람이 읽는 텍스트'를 반환함. 따라서 정규식으로 핵심 메타데이터
  (판례 ID·사건번호·선고일·링크, 법령 ID·MST·공포일)를 파싱해 출처(citation)를 코드에서
  직접 구성함 — LLM이 인용 URL/번호를 지어내는 환각을 막기 위함(MUST: 출처 명시).
"""

from __future__ import annotations

import asyncio
import html
import re

from mcp import ClientSession                              # MCP 프로토콜 세션 (initialize·call_tool)
from mcp.client.streamable_http import streamablehttp_client  # Streamable HTTP 전송 클라이언트

from config import settings

# ---------------------------------------------------------------------------
# 응답 파싱용 정규식
# ---------------------------------------------------------------------------
# 판례/해석례 항목 머리글: "[607079] (제목 ...)" — 대괄호 안 숫자 ID + 뒤따르는 제목
_ITEM_HEADER = re.compile(r"^\[(\d+)\]\s*(.*)$")
# "키: 값" 형태의 메타데이터 라인 (사건번호: ..., 선고일: ..., 링크: ...). 콜론은 반각/전각 모두 허용
_FIELD_LINE = re.compile(r"^\s*([^:：]+)[:：]\s*(.+)$")
# 법령 검색 항목 머리글: "1. 특허법" — 순번 + 법령명
_LAW_HEADER = re.compile(r"^\s*\d+\.\s+(.+)$")
# 법령 메타데이터 라인: "- 법령ID: 001455"
_LAW_FIELD = re.compile(r"^\s*[-•]\s*([^:：]+)[:：]\s*(.+)$")
# 안내/장식 라인(💡 팁, 📍/📂 매칭 구분, 구분선)은 파싱에서 건너뜀
_SKIP_PREFIXES = ("💡", "📍", "📂", "===", "---")


def _text_of(call_result) -> str:
    """MCP 도구 호출 결과(CallToolResult)에서 사람이 읽는 텍스트만 이어 붙여 반환함."""
    chunks = []
    for block in getattr(call_result, "content", []) or []:
        text = getattr(block, "text", None)
        if text:
            chunks.append(text)
    return "\n".join(chunks)


def _absolute_url(link: str) -> str:
    """MCP가 돌려준 링크를 절대 URL로 변환함.

    판례 링크는 '/DRF/lawService.do?...&amp;ID=...' 같은 상대경로 + HTML 엔티티 형태이므로,
    html.unescape로 &amp;→& 복원 후 법제처 기본 주소를 앞에 붙여 클릭 가능한 인용 URL을 만듦.
    """
    link = html.unescape(link.strip())
    if link.startswith("http"):
        return link
    if link.startswith("/"):
        return settings.LAW_GO_KR_BASE + link
    return link


def parse_decisions(text: str, source_label: str) -> list[dict]:
    """판례/해석례 검색 결과 텍스트를 항목 리스트로 파싱함.

    각 항목은 '[ID] 제목' 머리글과 그 아래 들여쓴 '키: 값' 메타데이터로 구성됨.
    반환: [{id, title, source, case_number, date, url, raw}] (없는 필드는 빈 문자열)
    """
    items: list[dict] = []
    current: dict | None = None

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith(_SKIP_PREFIXES):
            continue

        header = _ITEM_HEADER.match(stripped)
        if header:
            # 새 항목 시작 — 직전 항목을 확정하고 새 dict를 만듦
            if current:
                items.append(current)
            current = {
                "id": header.group(1),
                "title": header.group(2).strip(),
                "source": source_label,
                "fields": {},
            }
            continue

        if current is not None:
            field = _FIELD_LINE.match(line)
            if field:
                current["fields"][field.group(1).strip()] = field.group(2).strip()

    if current:
        items.append(current)

    # 파싱된 fields에서 출처 구성에 필요한 핵심 값만 표준 키로 승격함
    normalized = []
    for item in items:
        fields = item["fields"]
        # 도메인마다 날짜 필드명이 달라(선고일/회신일자/의결일 등) 우선순위로 탐색함
        date = (
            fields.get("선고일")
            or fields.get("회신일자")
            or fields.get("의결일")
            or fields.get("결정일")
            or ""
        )
        link = fields.get("링크", "")
        normalized.append({
            "id": item["id"],
            "title": item["title"],
            "source": item["source"],
            "case_number": fields.get("사건번호", "") or fields.get("안건번호", ""),
            "court": fields.get("법원", ""),
            "date": date,
            "url": _absolute_url(link) if link else "",
            # 컨텍스트용 1줄 요약 (LLM이 어떤 사건인지 파악하도록 메타데이터를 합침)
            "summary": f"{item['title']} (사건번호 {fields.get('사건번호', 'N/A')}, 선고/회신일 {date or 'N/A'})",
        })
    return normalized


def parse_laws(text: str) -> list[dict]:
    """법령 검색(search_law) 결과 텍스트를 법령 리스트로 파싱함.

    각 항목은 '1. 특허법' 머리글과 '- 법령ID:', '- MST:', '- 공포일:', '- 구분:' 메타데이터로 구성됨.
    반환: [{name, law_id, mst, date, category}]
    """
    laws: list[dict] = []
    current: dict | None = None

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith(_SKIP_PREFIXES):
            continue

        field = _LAW_FIELD.match(line)  # '- 키: 값' 라인 (머리글보다 먼저 검사: 머리글 정규식과 혼동 방지)
        if field and current is not None:
            current["fields"][field.group(1).strip()] = field.group(2).strip()
            continue

        header = _LAW_HEADER.match(line)
        if header:
            if current:
                laws.append(current)
            current = {"name": header.group(1).strip(), "fields": {}}

    if current:
        laws.append(current)

    normalized = []
    for law in laws:
        fields = law["fields"]
        normalized.append({
            "name": law["name"],
            "law_id": fields.get("법령ID", ""),
            "mst": fields.get("MST", ""),
            "date": fields.get("공포일", ""),
            "category": fields.get("구분", ""),
        })
    return normalized


async def _call_tool(session: ClientSession, name: str, args: dict) -> str:
    """MCP 도구를 호출하고 결과 텍스트를 반환함. 호출 실패는 빈 문자열로 graceful 처리함.

    한 소스(MCP)의 한 도구가 실패해도 나머지 도구·소스로 답변을 만들 수 있게 예외를 흡수함.
    """
    try:
        result = await asyncio.wait_for(
            session.call_tool(name, args),
            timeout=settings.LAW_MCP_TIMEOUT_SECONDS,
        )
        return _text_of(result)
    except Exception as error:  # noqa: BLE001 - 어떤 원격 오류든 빈 결과로 진행
        print(f"  ! [law MCP] {name} 호출 실패(무시하고 진행): {type(error).__name__}: {str(error)[:120]}")
        return ""


async def search_law_sources(
    law_query: str,
    law_name: str = "",
    use_chain_research: bool = False,
) -> dict:
    """korean-law MCP에 한 세션으로 접속해 판례·해석례·(최신 법령)·(종합검색)을 수집함.

    Args:
        law_query: 판례·해석례·종합검색에 쓸 핵심 키워드 (라우터가 최적화한 법령 쿼리)
        law_name: 특정 법령명이 질문에 드러난 경우(예: '특허법') 그 이름. 있으면 최신 조문을 함께 조회함
        use_chain_research: 폭넓은/모호한 질문이라 종합검색(chain_full_research)이 유익할 때 True

    Returns:
        {"precedents": [...], "interpretations": [...], "laws": [...],
         "law_texts": [{"name","text"}], "chain_research": str}
    """
    url = settings.build_law_mcp_url()
    collected = {
        "precedents": [],
        "interpretations": [],
        "laws": [],
        "law_texts": [],
        "chain_research": "",
    }

    # streamablehttp_client: (read, write, get_session_id) 스트림을 여는 Streamable HTTP 전송
    async with streamablehttp_client(url) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()  # MCP 기능 교환(capability negotiation)

            # 1) 판례 검색 (domain='precedent') — 선행기술·동향의 핵심 근거
            prec_text = await _call_tool(session, "search_decisions", {
                "domain": "precedent",
                "query": law_query,
                "display": settings.LAW_SEARCH_DISPLAY,
            })
            collected["precedents"] = parse_decisions(prec_text, "판례")

            # 2) 해석례 검색 (domain='interpretation') — 법령해석례(행정해석)
            interp_text = await _call_tool(session, "search_decisions", {
                "domain": "interpretation",
                "query": law_query,
                "display": settings.LAW_SEARCH_DISPLAY,
            })
            collected["interpretations"] = parse_decisions(interp_text, "해석례")

            # 3) 최신 법령 조문 — 특정 법령명이 드러난 질문에서만 search_law → get_law_text
            if law_name:
                laws = parse_laws(await _call_tool(session, "search_law", {
                    "query": law_name,
                    "display": 5,
                }))
                collected["laws"] = laws
                if laws and laws[0]["mst"]:
                    # 가장 정확히 매칭된 법령의 최신 조문 전문을 가져옴 (mst = 법령일련번호)
                    law_text = await _call_tool(session, "get_law_text", {"mst": laws[0]["mst"]})
                    if law_text:
                        collected["law_texts"] = [{"name": laws[0]["name"], "text": law_text}]

            # 4) 종합검색(chain_full_research) — 폭넓은 질문이거나 판례·해석례가 모두 빈 경우 폴백
            if use_chain_research or (not collected["precedents"] and not collected["interpretations"]):
                collected["chain_research"] = await _call_tool(
                    session, "chain_full_research", {"query": law_query}
                )

    return collected


def run_law_search(law_query: str, law_name: str = "", use_chain_research: bool = False) -> dict:
    """동기 래퍼: 동기 LangGraph 노드에서 비동기 MCP 검색을 실행함 (asyncio.run으로 브리지).

    그래프가 동기(.invoke)로 돌아 실행 중 이벤트 루프가 없으므로 asyncio.run이 새 루프를 열어 안전함.
    """
    return asyncio.run(search_law_sources(law_query, law_name, use_chain_research))


# ---------------------------------------------------------------------------
# 독립 실행 스모크 테스트: python -m sources.law_client  (mas-b 디렉터리에서)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    print(f"[law MCP] 접속: {settings.LAW_MCP_BASE_URL}?oc=*** (LAW_OC 로드됨)")
    result = run_law_search("직무발명 보상금", law_name="특허법", use_chain_research=False)
    print(f"\n판례 {len(result['precedents'])}건:")
    for p in result["precedents"]:
        print(f"  - {p['summary']}\n    {p['url']}")
    print(f"\n해석례 {len(result['interpretations'])}건:")
    for p in result["interpretations"]:
        print(f"  - {p['summary']}")
    print(f"\n법령 {len(result['laws'])}건:")
    for law in result["laws"]:
        print(f"  - {law['name']} (법령ID {law['law_id']}, MST {law['mst']}, 공포 {law['date']})")
    print(f"\n법령 조문 본문: {len(result['law_texts'])}건 "
          f"({len(result['law_texts'][0]['text']) if result['law_texts'] else 0}자)")
    print(f"종합검색(chain) 길이: {len(result['chain_research'])}자")
