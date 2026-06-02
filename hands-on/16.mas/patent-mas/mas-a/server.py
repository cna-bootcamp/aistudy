"""특허법 법령지식 MAS — FastMCP 서버 (Streamable HTTP).

선행 구축된 두 인덱스(조문 벡터 RAG + MS GraphRAG)를 SAS 워크플로로 융합 검색하여,
바이브 코딩 도구/AI 앱이 특허법 지식을 정확히 참조하도록 MCP 3대 프리미티브로 노출함.

[MCP 3대 프리미티브]
  - Tool     : ask_patent_law(question, mode)  → 라우팅 → 검색 → (필요 시 보완·융합) → 한국어 답변
  - Resource : patent://kg/stats, patent://kg/schema  → KG 통계/스키마 읽기 전용 조회
  - Prompt   : patent_law_advice(topic)  → 특허법 자문 작성 워크플로 템플릿

실행: python server.py  → http://{MCP_HOST}:{MCP_PORT}/mcp  (기본 127.0.0.1:8010)

[이벤트 루프 주의] @mcp.tool()은 '동기' 함수로 둠. FastMCP가 동기 도구를 워커 스레드에서
호출하므로, 내부의 async GraphRAG API를 retrieval.async_utils.run_async가 안전하게 실행함.
도구를 async로 바꾸면 이 브리지가 깨지므로 동기 유지가 핵심임.
"""
import json
import logging
import sys
from pathlib import Path
from typing import Any

# Windows 콘솔 기본 인코딩(cp949)에서 한글 로그가 깨지지 않도록 stdout/stderr를 UTF-8로 재설정함.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# python server.py로 직접 실행할 때 config/mas/retrieval 패키지를 찾도록 프로젝트 경로를 추가함.
_PROJECT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_PROJECT_DIR))

from mcp.server.fastmcp import FastMCP

from config.settings import settings as _settings
from mas.graph import PatentLawMAS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("patent-mas")

# FastMCP: 타입 힌트 + docstring으로 도구/리소스/프롬프트 JSON Schema를 자동 생성함.
# host/port는 Streamable HTTP 바인딩 주소(엔드포인트 기본 /mcp).
mcp = FastMCP("patent-law-mas", host=_settings.mcp_host, port=_settings.mcp_port)

# 무거운 초기화(ChromaDB·GraphRAG·LLM)는 첫 호출 시 1회만 수행함 (서버 기동은 빠르게).
_mas: PatentLawMAS | None = None


def get_mas() -> PatentLawMAS:
    """PatentLawMAS 싱글턴을 지연 생성해 반환함."""
    global _mas
    if _mas is None:
        logger.info("PatentLawMAS 최초 초기화 시작")
        _mas = PatentLawMAS(_settings)
    return _mas


def _shape_tool_result(result: dict[str, Any]) -> dict[str, Any]:
    """엔진 결과를 MCP 응답용으로 간결화함 — 대용량 원문은 스니펫으로, 임베딩 수치는 개수 요약으로.

    "어떤 모드로 무엇을 근거로 답했는지"는 보존하면서 LLM 컨텍스트 비용을 줄임.
    """
    sources = [
        {
            "title": src.get("title", ""),
            "type": src.get("type", ""),
            "snippet": str(src.get("content", ""))[:300],
        }
        for src in (result.get("sources") or [])
    ]
    return {
        "answer": result.get("answer", ""),
        "requested_mode": result.get("requested_mode"),
        "resolved_mode": result.get("resolved_mode"),
        "modes_used": result.get("modes_used", []),
        "route_reason": result.get("route_reason", ""),
        "supervisor_reason": result.get("supervisor_reason", ""),
        "sufficient": result.get("sufficient"),
        "reroutes": result.get("reroutes", 0),
        "sources": sources,
        "evidence": result.get("evidence", {}),
        "note": result.get("note", ""),
        "error": bool(result.get("error", False)),
    }


# @mcp.tool(): 이 함수를 MCP 도구로 등록함. 동기 함수 유지가 필수(위 이벤트 루프 주의 참고).
@mcp.tool()
def ask_patent_law(question: str, mode: str = "auto") -> dict[str, Any]:
    """대한민국 특허법 지식을 검색해 근거 기반 한국어 답변을 생성함.

    질문을 접수하면 Scheduler가 검색 모드를 결정(auto면 자동 라우팅)하고, Agent가 그 모드로
    검색하며, Supervisor가 근거 충분성을 평가해 미흡하면 상보적 모드로 한 번 더 검색·융합함.

    Args:
        question: 특허법 관련 질문 (예: "특허를 받을 수 있는 요건은?").
        mode: 검색 모드. auto(자동 결정) | vector(조문 원문 정밀 인용)
              | local(엔티티 관계) | global(전체 구조 요약) | drift(복합 추론). 기본값 auto.
    """
    logger.info("ask_patent_law 호출: mode=%s, question=%s", mode, question[:80])
    result = get_mas().answer(question, mode)
    return _shape_tool_result(result)


# @mcp.resource("URI"): 읽기 전용 데이터를 URI로 노출함 (부작용 없음).
@mcp.resource("patent://kg/stats")
def kg_stats_resource() -> str:
    """특허법 KG 통계(엔티티/관계/커뮤니티/텍스트유닛 수 + 타입 분포)를 JSON으로 반환."""
    return json.dumps(get_mas().kg_stats(), ensure_ascii=False, indent=2)


@mcp.resource("patent://kg/schema")
def kg_schema_resource() -> str:
    """특허법 KG 스키마(엔티티 타입·관계·인덱스 구성)를 문자열로 반환."""
    return get_mas().kg_schema()


# @mcp.prompt(): 재사용 가능한 프롬프트 템플릿을 등록함 (슬래시 명령 등으로 선택).
@mcp.prompt()
def patent_law_advice(topic: str) -> str:
    """특허법 근거를 인용해 자문을 작성하게 하는 법령 자문 프롬프트 템플릿."""
    return (
        f"'{topic}' 에 대해 대한민국 특허법 관점에서 자문을 제공하려고 합니다.\n"
        f"먼저 patent-law-mas MCP 서버의 ask_patent_law 도구로 관련 조문·요건·절차를 검색하세요.\n"
        f"- 조문 원문이 필요하면 mode='vector', 요건·권리·절차의 관계가 필요하면 mode='local',\n"
        f"  전체 구조 요약이 필요하면 mode='global'을 사용하세요(불확실하면 'auto').\n"
        f"그다음 검색 결과의 출처(근거 조문)를 인용하면서, 일반 지식이 아닌 특허법 조문 기준으로\n"
        f"핵심 요건·절차·주의사항을 한국어로 정리해 주세요."
    )


if __name__ == "__main__":
    # 이 파일을 직접 실행할 때만 서버를 기동함 (import 시 미실행).
    logger.info(
        "특허법 MAS MCP 서버 기동: http://%s:%d/mcp (model=%s)",
        _settings.mcp_host, _settings.mcp_port, _settings.llm_model,
    )
    # Streamable HTTP 전송 — 원격/로컬 모두 단일 /mcp 엔드포인트로 양방향 통신
    mcp.run(transport="streamable-http")
