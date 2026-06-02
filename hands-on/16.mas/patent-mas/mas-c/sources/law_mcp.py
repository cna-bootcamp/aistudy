"""korean-law MCP (원격 Streamable HTTP) 클라이언트 — 클라이언트 하나, 용도 둘.

용도 1) 컨텍스트 수집 (단독 실행 시 MAS A·B 프록시): search_decisions·search_law·get_law_text
용도 2) 인용 환각 탐지 (런타임 게이트, MUST): verify_citations

서버: https://korean-law-mcp.fly.dev/mcp?oc=<LAW_OC> (Streamable HTTP)
mcp 파이썬 SDK의 ClientSession 으로 그 서버의 MCP '클라이언트'로 동작함.

[가장 중요한 설계 — verify 경로의 fail-safe]
  컨텍스트 수집과 verify_citations 는 '에러 처리'가 달라야 함.
  - 컨텍스트 수집: 한 도구가 실패하면 빈 결과로 graceful 진행(다른 자료로 초안 작성 가능).
  - verify_citations: 실패를 '인용 정상'으로 절대 흡수하면 안 됨. 연결 실패·타임아웃·파싱 불가는
    '판정 없음(ok=None)'으로 보고하여 게이트가 통과시키지 않고 HITL 로 승급하게 함.
    (실측: ClientSession.call_tool 은 도구 isError=True 에서도 예외를 던지지 않고
     CallToolResult(.isError, .content) 를 반환함 → 텍스트를 파싱해 ✗ '오류' 건수로 판정함)

[korean-law MCP 응답 형식]
  도구는 JSON 이 아닌 '사람이 읽는 텍스트'를 반환함. 정규식으로 핵심 메타데이터를 파싱함.
  - verify_citations 요약: '총 N건 | ✓ X 실존 | ✗ Y 오류 | ⚠ Z 확인필요'
    · ✗(NOT_FOUND) = 환각 인용(차단 대상)  · ⚠ = 부분매칭/법령명 불명확(실존 조문도 나옴 → 차단 안 함)
  - 인용이 전혀 없으면 '[NO_CITATIONS_FOUND]' (검증할 것 없음 → ok=True)
"""

from __future__ import annotations

import asyncio
import html
import re

from mcp import ClientSession                              # MCP 프로토콜 세션 (initialize·call_tool)
from mcp.client.streamable_http import streamablehttp_client  # Streamable HTTP 전송 클라이언트

from config import settings

# ---------------------------------------------------------------------------
# 응답 파싱용 정규식 (컨텍스트 수집)
# ---------------------------------------------------------------------------
_ITEM_HEADER = re.compile(r"^\[(\d+)\]\s*(.*)$")          # 판례/해석례 머리글 "[607079] 제목"
_FIELD_LINE = re.compile(r"^\s*([^:：]+)[:：]\s*(.+)$")     # "키: 값" 메타데이터 (반각/전각 콜론)
_LAW_HEADER = re.compile(r"^\s*\d+\.\s+(.+)$")            # 법령 머리글 "1. 특허법"
_LAW_FIELD = re.compile(r"^\s*[-•]\s*([^:：]+)[:：]\s*(.+)$")  # 법령 메타 "- 법령ID: 001455"
_SKIP_PREFIXES = ("💡", "📍", "📂", "===", "---")          # 안내/장식 라인은 건너뜀

# verify_citations 요약 라인: '총 3건 | ✓ 0 실존 | ✗ 1 오류 | ⚠ 2 확인필요'
_VERIFY_SUMMARY = re.compile(
    r"총\s*(\d+)\s*건.*?✓\s*(\d+).*?✗\s*(\d+).*?⚠\s*(\d+)", re.DOTALL
)


# ---------------------------------------------------------------------------
# 공통 헬퍼
# ---------------------------------------------------------------------------

def _text_of(call_result) -> str:
    """MCP 도구 호출 결과(CallToolResult)에서 사람이 읽는 텍스트만 이어 붙여 반환함."""
    chunks = []
    for block in getattr(call_result, "content", []) or []:
        text = getattr(block, "text", None)
        if text:
            chunks.append(text)
    return "\n".join(chunks)


def _absolute_url(link: str) -> str:
    """MCP가 돌려준 상대 링크(/DRF/...&amp;...)를 절대 URL로 변환함 (html.unescape 후 도메인 결합)."""
    link = html.unescape(link.strip())
    if link.startswith("http"):
        return link
    if link.startswith("/"):
        return settings.LAW_GO_KR_BASE + link
    return link


async def _call_tool_graceful(session: ClientSession, name: str, args: dict) -> str:
    """[컨텍스트 수집 전용] 도구를 호출하고 실패는 빈 문자열로 graceful 처리함.

    한 도구가 실패해도 나머지 자료로 초안을 작성할 수 있게 예외를 흡수함.
    (verify_citations 에는 절대 쓰지 않음 — 거기서는 실패를 흡수하면 안 됨)
    """
    try:
        result = await asyncio.wait_for(
            session.call_tool(name, args), timeout=settings.LAW_MCP_TIMEOUT_SECONDS
        )
        return _text_of(result)
    except Exception as error:  # noqa: BLE001
        print(f"  ! [law MCP] {name} 호출 실패(무시하고 진행): {type(error).__name__}: {str(error)[:120]}")
        return ""


# ---------------------------------------------------------------------------
# 파서 (컨텍스트 수집)
# ---------------------------------------------------------------------------

def parse_decisions(text: str, source_label: str) -> list[dict]:
    """판례/해석례 검색 결과 텍스트를 [{title, source, case_number, date, url, summary}] 로 파싱함."""
    items: list[dict] = []
    current: dict | None = None
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith(_SKIP_PREFIXES):
            continue
        header = _ITEM_HEADER.match(stripped)
        if header:
            if current:
                items.append(current)
            current = {"id": header.group(1), "title": header.group(2).strip(),
                       "source": source_label, "fields": {}}
            continue
        if current is not None:
            field = _FIELD_LINE.match(line)
            if field:
                current["fields"][field.group(1).strip()] = field.group(2).strip()
    if current:
        items.append(current)

    normalized = []
    for item in items:
        fields = item["fields"]
        date = (fields.get("선고일") or fields.get("회신일자") or fields.get("의결일")
                or fields.get("결정일") or "")
        link = fields.get("링크", "")
        normalized.append({
            "id": item["id"], "title": item["title"], "source": item["source"],
            "case_number": fields.get("사건번호", "") or fields.get("안건번호", ""),
            "date": date,
            "url": _absolute_url(link) if link else "",
            "summary": f"{item['title']} (사건번호 {fields.get('사건번호', 'N/A')}, 선고/회신일 {date or 'N/A'})",
        })
    return normalized


def parse_laws(text: str) -> list[dict]:
    """법령 검색(search_law) 결과 텍스트를 [{name, law_id, mst, date, category}] 로 파싱함."""
    laws: list[dict] = []
    current: dict | None = None
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith(_SKIP_PREFIXES):
            continue
        field = _LAW_FIELD.match(line)  # '- 키: 값' 을 머리글보다 먼저 검사(혼동 방지)
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
            "name": law["name"], "law_id": fields.get("법령ID", ""),
            "mst": fields.get("MST", ""), "date": fields.get("공포일", ""),
            "category": fields.get("구분", ""),
        })
    return normalized


# ---------------------------------------------------------------------------
# 용도 1) 컨텍스트 수집 (단독 실행 시 MAS A·B 프록시)
# ---------------------------------------------------------------------------

async def gather_law_context(law_query: str, law_name: str = "") -> list[dict]:
    """korean-law MCP 한 세션으로 판례·해석례·(최신 법령 조문)을 수집해 컨텍스트 항목으로 반환함.

    Returns: [{source, title, content, citation}]
      - content : 초안 작성용 본문(LLM 컨텍스트)
      - citation: 코드에서 직접 구성한 출처 한 줄(인용 환각 방지)
    """
    url = settings.build_law_mcp_url()
    items: list[dict] = []

    async with streamablehttp_client(url) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # 1) 판례
            prec_text = await _call_tool_graceful(session, "search_decisions", {
                "domain": "precedent", "query": law_query, "display": settings.LAW_SEARCH_DISPLAY,
            })
            for prec in parse_decisions(prec_text, "판례"):
                citation = (f"- [{prec['title']}]({prec['url']}) "
                            f"(사건번호 {prec['case_number'] or 'N/A'}, 선고일 {prec['date'] or 'N/A'})"
                            if prec["url"] else f"- {prec['summary']}")
                items.append({"source": "판례", "title": prec["title"],
                              "content": prec["summary"], "citation": citation})

            # 2) 해석례
            interp_text = await _call_tool_graceful(session, "search_decisions", {
                "domain": "interpretation", "query": law_query, "display": settings.LAW_SEARCH_DISPLAY,
            })
            for interp in parse_decisions(interp_text, "해석례"):
                citation = (f"- [{interp['title']}]({interp['url']}) (회신일 {interp['date'] or 'N/A'})"
                            if interp["url"] else f"- {interp['title']} (회신일 {interp['date'] or 'N/A'})")
                items.append({"source": "해석례", "title": interp["title"],
                              "content": interp["summary"], "citation": citation})

            # 3) 최신 법령 조문 — 특정 법령명이 드러난 경우만 search_law → get_law_text
            if law_name:
                laws = parse_laws(await _call_tool_graceful(session, "search_law", {
                    "query": law_name, "display": 5,
                }))
                if laws and laws[0]["mst"]:
                    law_text = await _call_tool_graceful(session, "get_law_text", {"mst": laws[0]["mst"]})
                    if law_text:
                        items.append({
                            "source": "법령", "title": laws[0]["name"],
                            "content": law_text[:settings.LAW_TEXT_MAX_CHARS],
                            "citation": f"- {laws[0]['name']} (최신 조문, 출처: 법제처 국가법령정보센터)",
                        })

    return items


def run_gather_context(law_query: str, law_name: str = "") -> list[dict]:
    """동기 래퍼: 동기 LangGraph 노드에서 비동기 컨텍스트 수집을 실행함(asyncio.run 브리지)."""
    return asyncio.run(gather_law_context(law_query, law_name))


# ---------------------------------------------------------------------------
# 용도 2) 인용 환각 탐지 (런타임 게이트, MUST) — verify_citations
# ---------------------------------------------------------------------------

def parse_verify_result(text: str) -> dict:
    """verify_citations 응답 텍스트를 파싱함.

    Returns: {parsed, total, exist, errors, warns, hallucinated[], warnings[], ok}
      - parsed : 응답을 신뢰성 있게 해석했는지 (False면 판정 불가 → 호출자가 fail-safe 처리)
      - ok     : 환각 인용(✗)이 0건이면 True (⚠ 는 차단하지 않음)
    """
    report = {"parsed": False, "total": 0, "exist": 0, "errors": 0, "warns": 0,
              "hallucinated": [], "warnings": [], "ok": None, "text": text}

    # 인용이 전혀 없는 경우: 검증할 대상이 없으므로 통과(환각 없음)
    if "[NO_CITATIONS_FOUND]" in text:
        report.update({"parsed": True, "total": 0, "ok": True})
        return report

    summary = _VERIFY_SUMMARY.search(text)
    if not summary:
        # 요약을 못 찾으면 신뢰성 있게 해석 불가 → 판정 보류(fail-safe)
        return report

    total, exist, errors, warns = (int(summary.group(i)) for i in range(1, 5))
    # 항목별 라인 수집: ✗(환각) / ⚠(부분매칭). '⚠️ [HALLUCINATION_DETECTED]' 안내 블록은 제외.
    hallucinated, warnings = [], []
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("✗"):
            hallucinated.append(s.lstrip("✗ ").strip())
        elif s.startswith("⚠") and "[HALLUCINATION_DETECTED]" not in s:
            warnings.append(s.lstrip("⚠️ ").strip())

    report.update({
        "parsed": True, "total": total, "exist": exist, "errors": errors, "warns": warns,
        "hallucinated": hallucinated, "warnings": warnings,
        "ok": errors == 0,   # ✗(NOT_FOUND) 0건이면 환각 없음 → 통과
    })
    return report


async def verify_citations(text: str) -> dict:
    """초안 텍스트의 '법령 조문' 인용을 korean-law MCP verify_citations 로 교차검증함.

    [검증 범위 — 정확히]
      verify_citations 는 '특허법 제29조' 같은 '법령 조문(article)' 인용만 추출·검증함(실측 확인).
      '대법원 2099다12345' 같은 '판례 사건번호'는 이 도구가 검증하지 않음(추출 대상 아님).
      → 본문에 지어낸 가짜 사건번호는 (a) IsSup 근거성 평가와 (b) 출처 섹션을 코드가 실제 검색
        결과로만 구성하는 build_sources_section 으로 보완함(본문 환각이 출처에 새지 않음).

    [fail-safe — 절대 실패를 '정상'으로 흡수하지 않음]
      - 정상 판정 : {reachable:True, ok:True/False, ...report}
      - 서비스 도달 실패/타임아웃/응답 파싱 불가 : {reachable:False, ok:None, note:...}
        → 게이트는 ok is True 일 때만 통과시키므로, 판정 없음은 통과하지 못하고 HITL 로 승급됨.
    """
    fallback = {"reachable": False, "ok": None, "total": 0, "exist": 0, "errors": 0, "warns": 0,
                "hallucinated": [], "warnings": [], "text": "", "note": ""}
    try:
        url = settings.build_law_mcp_url()
        async with streamablehttp_client(url) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await asyncio.wait_for(
                    session.call_tool("verify_citations",
                                      {"text": text, "maxCitations": settings.VERIFY_MAX_CITATIONS}),
                    timeout=settings.LAW_MCP_TIMEOUT_SECONDS,
                )
        report = parse_verify_result(_text_of(result))
        if not report["parsed"]:
            # 응답은 받았으나 해석 불가 → 신뢰할 판정이 없음(fail-safe로 미통과 처리)
            fallback["text"] = report["text"]
            fallback["note"] = "verify 응답을 파싱하지 못함(판정 보류)"
            return fallback
        report["reachable"] = True
        return report
    except Exception as error:  # noqa: BLE001 - 연결/타임아웃 등 어떤 실패든 '판정 없음'으로 보고
        fallback["note"] = f"verify 호출 실패(판정 보류): {type(error).__name__}: {str(error)[:120]}"
        print(f"  ! [verify] {fallback['note']}")
        return fallback


def run_verify_citations(text: str) -> dict:
    """동기 래퍼: 동기 LangGraph 노드에서 비동기 verify_citations 를 실행함(asyncio.run 브리지)."""
    return asyncio.run(verify_citations(text))


# ---------------------------------------------------------------------------
# 독립 실행 스모크 테스트: python -m sources.law_mcp  (mas-c 디렉터리에서)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    print(f"[law MCP] 접속: {settings.LAW_MCP_BASE_URL}?oc=*** (LAW_OC 로드됨)")

    print("\n[1] 컨텍스트 수집 스모크 (직무발명 보상금 / 특허법)")
    ctx = run_gather_context("직무발명 보상금", law_name="특허법")
    print(f"  → 컨텍스트 항목 {len(ctx)}개")
    for item in ctx[:3]:
        print(f"    - ({item['source']}) {item['title'][:50]}")

    print("\n[2] verify_citations 스모크 — 실존+환각 혼합 (제999조는 환각)")
    mixed = ("특허권의 존속기간은 특허법 제88조에 따라 출원일 후 20년이다. "
             "또한 특허법 제999조에 따라 즉시 구속된다.")
    rep = run_verify_citations(mixed)
    print(f"  → reachable={rep['reachable']} ok={rep['ok']} "
          f"총{rep['total']} ✓{rep['exist']} ✗{rep['errors']} ⚠{rep['warns']}")
    print(f"  → 환각 인용: {rep['hallucinated']}")
