"""AI 에이전트 개발 지원 서비스 — GraphRAG MCP 서버.

FastMCP + Streamable HTTP 전송으로 사내 교재 Knowledge Graph를 검색하는 MCP 서버임.
Claude Code 같은 바이브 코딩 도구에 연결하면 LLM이 일반 지식 대신 조직 내부 지식(교재/예제)을
참조해 더 정확한 답변·코드를 생성할 수 있음.

[MCP 3대 프리미티브 데모]
  - Tool     : ask_dev_ai(question, mode)  → 요청 접수 → 검색방법 결정 → 검색 → LLM 답변 (핵심 흐름)
  - Resource : graphrag://stats, graphrag://schema  → KG 통계/스키마 읽기 전용 조회
  - Prompt   : dev_assist(topic)  → 사내 교재 기반 구현 가이드 작성 워크플로 템플릿

실행: python server.py  → http://{MCP_HOST}:{MCP_PORT}/mcp  (기본 127.0.0.1:8000)
"""
import json
import logging
import sys
from pathlib import Path
from typing import Any

# Windows 콘솔 기본 인코딩(cp949)은 한글 로그 출력 시 깨지므로 stdout/stderr를 UTF-8로 재설정함.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# 이 파일이 위치한 프로젝트 디렉터리 경로를 절대경로로 구함.
_PROJECT_DIR = Path(__file__).resolve().parent
# 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 프로젝트 디렉터리를 추가함
# (python server.py로 직접 실행할 때 config/graph/query/search_service import용).
sys.path.insert(0, str(_PROJECT_DIR))

from mcp.server.fastmcp import FastMCP

from config.settings import Settings
from search_service import SearchService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("graphrag-mcp")

_settings = Settings()

# FastMCP: MCP 서버 개발 라이브러리. 타입 힌트 + docstring으로 도구/리소스/프롬프트의
# JSON Schema를 자동 생성함. host/port는 Streamable HTTP 바인딩 주소임 (엔드포인트 기본 /mcp).
mcp = FastMCP("graphrag-dev-ai", host=_settings.mcp_host, port=_settings.mcp_port)

# 무거운 초기화(Neo4j 연결, 임베딩 래퍼, GraphCypherQAChain 빌드)는 첫 호출 시 한 번만 수행함.
_service: SearchService | None = None


def get_service() -> SearchService:
    """SearchService 싱글턴을 지연 생성해 반환 (서버 기동은 빠르게, 연결은 첫 호출 때)."""
    global _service
    if _service is None:
        logger.info("SearchService 최초 초기화 시작")
        _service = SearchService(_settings)
    return _service


def _shape_tool_result(result: dict[str, Any]) -> dict[str, Any]:
    """엔진 내부 결과(임베딩·대용량 텍스트 포함 가능)를 MCP 응답용으로 간결하게 정리함.

    벡터 히트 원문/스코어 같은 대형 필드는 개수 요약만 남겨, LLM 컨텍스트를 절약하면서도
    "어떤 모드로 무엇을 근거로 답했는지"는 그대로 관찰 가능하게 함.
    """
    evidence = {
        "vector_hits": len(result.get("vector_hits") or []),
        "graph_rows": len(result.get("graph_data") or []),
        "context_chunks": len(result.get("context_chunks") or []),
    }
    shaped: dict[str, Any] = {
        "answer": result.get("answer"),
        "requested_mode": result.get("requested_mode"),
        "resolved_mode": result.get("resolved_mode"),
        "route_reason": result.get("route_reason"),
        "sources": result.get("sources", []),
        "evidence": evidence,
        "error": bool(result.get("error", False)),
    }
    # Cypher 생성·집계 폴백 시에만 존재하는 부가 정보를 조건부로 포함
    if result.get("cypher"):
        shaped["cypher"] = result["cypher"]
    if result.get("row_count") is not None:
        shaped["row_count"] = result["row_count"]
    if result.get("fallback"):
        shaped["fallback"] = result["fallback"]
    return shaped


# @mcp.tool(): 이 함수를 MCP 도구로 등록함. LLM이 호출 여부를 판단하고 AI 앱이 실제 호출함.
@mcp.tool()
def ask_dev_ai(question: str, mode: str = "auto") -> dict[str, Any]:
    """AI 에이전트 개발 교재 Knowledge Graph를 검색해 한국어 답변을 생성함.

    질문을 접수하면 검색 방법을 결정(auto면 자동 라우팅)하고, 그 방법으로 KG/벡터 DB를 검색한 뒤
    결과를 LLM에 보내 근거 기반 답변을 반환함. 답변과 함께 선택된 검색 모드/근거/출처도 함께 돌려줌.

    Args:
        question: 개발 관련 질문 또는 직접 입력한 Cypher 쿼리.
        mode: 검색 방법. auto(자동 결정) | vector(개념·정의·예제) | graph_qa(엔티티 관계·집계)
              | hybrid(전체 흐름·구조 요약) | cypher(읽기 전용 Cypher 직접 실행). 기본값 auto.
    """
    logger.info("ask_dev_ai 호출: mode=%s, question=%s", mode, question[:80])
    result = get_service().answer(question, mode)
    return _shape_tool_result(result)


# @mcp.resource("URI"): 읽기 전용 데이터를 URI로 노출함. 부작용이 없어 안전하게 참조 가능함.
@mcp.resource("graphrag://stats")
def kg_stats_resource() -> str:
    """KG 노드/관계/라벨 통계를 JSON 문자열로 반환 (인덱싱된 교재 규모 확인용)."""
    stats = get_service().kg_stats()
    return json.dumps(stats, ensure_ascii=False, indent=2)


@mcp.resource("graphrag://schema")
def kg_schema_resource() -> str:
    """Neo4j KG 스키마(노드 라벨·속성·관계 타입)를 문자열로 반환."""
    return get_service().kg_schema()


# @mcp.prompt(): 재사용 가능한 프롬프트 템플릿을 등록함. 사용자가 슬래시 명령 등으로 선택함.
@mcp.prompt()
def dev_assist(topic: str) -> str:
    """사내 교재를 근거로 구현 가이드를 작성하게 하는 개발 지원 프롬프트 템플릿."""
    return (
        f"'{topic}' 주제로 AI 에이전트 기능을 구현하려고 합니다.\n"
        f"먼저 graphrag-dev-ai MCP 서버의 ask_dev_ai 도구로 사내 교재 Knowledge Graph를 검색해 "
        f"관련 개념·예제·관계를 수집하세요.\n"
        f"그다음 검색 결과의 출처(sources)를 인용하면서, 일반 지식이 아닌 사내 교재 기준으로 "
        f"구현 단계와 주의사항을 한국어로 정리해 주세요."
    )


if __name__ == "__main__":
    # 이 파일을 직접 실행할 때만 서버를 기동함 (import 시 미실행).
    logger.info(
        "GraphRAG MCP 서버 기동: http://%s:%d/mcp (model=%s)",
        _settings.mcp_host, _settings.mcp_port, _settings.groq_model,
    )
    # Streamable HTTP 전송으로 실행 — 원격/로컬 모두 단일 /mcp 엔드포인트로 양방향 통신
    mcp.run(transport="streamable-http")
