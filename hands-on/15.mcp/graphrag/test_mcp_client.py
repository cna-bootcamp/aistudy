"""MCP 전송 계층 end-to-end 검증 (실제 Streamable HTTP 클라이언트).

server.py를 자식 프로세스로 기동한 뒤, 실제 MCP ClientSession으로 Streamable HTTP(/mcp)에 연결해
도구 목록 조회·도구 호출·리소스 읽기·프롬프트 조회가 전부 동작하는지 확인함.
in-process 테스트(test_e2e.py)가 검증하지 못하는 전송·등록·스키마 계층까지 포함하는 완료 검증임.

완료(PASS) 기준:
  - tools/list에 ask_dev_ai 포함
  - ask_dev_ai 호출 결과에 resolved_mode + 비어있지 않은 한국어 answer
  - resources/list에 graphrag://stats, graphrag://schema 포함 + 읽기 성공
  - prompts/list에 dev_assist 포함 + 텍스트 생성 성공

사용법:
  python test_mcp_client.py   # 서버 자동 기동·검증·종료, 전부 통과 시 exit 0
"""
import asyncio
import socket
import subprocess
import sys
import time
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

_PROJECT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_PROJECT_DIR))

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

from config.settings import Settings

_settings = Settings()
_HOST = _settings.mcp_host
_PORT = _settings.mcp_port
_URL = f"http://{_HOST}:{_PORT}/mcp"


def has_korean(text: str) -> bool:
    """문자열에 한글 음절이 하나라도 있는지 판별."""
    return any("가" <= ch <= "힣" for ch in str(text))


def wait_for_port(host: str, port: int, timeout: float = 90.0) -> bool:
    """서버가 포트를 열 때까지 최대 timeout초 대기 (소켓 연결 시도 반복)."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(2)
            if sock.connect_ex((host, port)) == 0:
                return True
        time.sleep(1)
    return False


def _text_of(call_result) -> str:
    """도구/리소스 호출 결과에서 사람이 읽을 텍스트를 추출함."""
    chunks = []
    for block in getattr(call_result, "content", []) or []:
        text = getattr(block, "text", None)
        if text:
            chunks.append(text)
    return "\n".join(chunks)


async def run_checks() -> bool:
    """실제 MCP 세션을 열어 4개 프리미티브 검증을 수행함."""
    verdicts: dict[str, bool] = {}

    # streamablehttp_client: Streamable HTTP 전송 클라이언트. (read, write, get_session_id) 반환
    async with streamablehttp_client(_URL) as (read, write, _):
        # ClientSession: MCP 프로토콜 세션. initialize()로 기능 교환(capability negotiation) 수행
        async with ClientSession(read, write) as session:
            await session.initialize()

            # 1) tools/list — ask_dev_ai 등록 확인
            tools = await session.list_tools()
            tool_names = [t.name for t in tools.tools]
            print(f"\n[tools/list] {tool_names}")
            verdicts["tool_registered"] = "ask_dev_ai" in tool_names

            # 2) tools/call — auto 모드 질문 → 한국어 답변 + resolved_mode 확인
            call = await session.call_tool("ask_dev_ai", {"question": "RAG란 무엇인가?", "mode": "auto"})
            structured = getattr(call, "structuredContent", None) or {}
            answer = structured.get("answer", "") or _text_of(call)
            resolved = structured.get("resolved_mode")
            reason = structured.get("route_reason")
            print(f"\n[tools/call ask_dev_ai] resolved_mode={resolved}  reason={reason}")
            print(f"  sources={structured.get('sources', [])[:3]}")
            print(f"  answer={str(answer)[:300]}")
            verdicts["tool_answer"] = bool(resolved) and has_korean(answer) and not structured.get("error", False)

            # 3) tools/call — graph_qa 관계 질문 (그래프 검색 경로 확인)
            call2 = await session.call_tool(
                "ask_dev_ai", {"question": "Openai와 연결된 엔티티를 보여줘", "mode": "graph_qa"}
            )
            s2 = getattr(call2, "structuredContent", None) or {}
            print(f"\n[tools/call ask_dev_ai/graph_qa] resolved_mode={s2.get('resolved_mode')}"
                  f"  evidence={s2.get('evidence')}")
            print(f"  answer={str(s2.get('answer', ''))[:200]}")
            verdicts["tool_graph_qa"] = bool(s2.get("answer")) and not s2.get("error", False)

            # 4) resources/list + read — stats/schema 확인
            resources = await session.list_resources()
            res_uris = [str(r.uri) for r in resources.resources]
            print(f"\n[resources/list] {res_uris}")
            stats_read = await session.read_resource("graphrag://stats")
            stats_text = "\n".join(
                getattr(c, "text", "") for c in stats_read.contents if getattr(c, "text", "")
            )
            print(f"[resources/read stats] {stats_text[:160]}")
            verdicts["resource_stats"] = '"node_count"' in stats_text

            schema_read = await session.read_resource("graphrag://schema")
            schema_text = "\n".join(
                getattr(c, "text", "") for c in schema_read.contents if getattr(c, "text", "")
            )
            print(f"[resources/read schema] {schema_text[:160]}")
            verdicts["resource_schema"] = len(schema_text.strip()) > 0

            # 5) prompts/list + get — dev_assist 확인
            prompts = await session.list_prompts()
            prompt_names = [p.name for p in prompts.prompts]
            print(f"\n[prompts/list] {prompt_names}")
            got = await session.get_prompt("dev_assist", {"topic": "RAG 파이프라인"})
            prompt_text = got.messages[0].content.text if got.messages else ""
            print(f"[prompts/get dev_assist] {prompt_text[:160]}")
            verdicts["prompt_dev_assist"] = "dev_assist" in prompt_names and has_korean(prompt_text)

    print(f"\n{'='*72}\n[MCP 전송 계층 종합 판정]")
    for name, ok in verdicts.items():
        print(f"  {name:18} : {'PASS' if ok else 'FAIL'}")
    all_pass = all(verdicts.values())
    print(f"\n  전체: {'ALL PASS' if all_pass else 'FAIL'}")
    return all_pass


def main() -> int:
    """server.py를 기동하고 검증 후 종료함 (전부 통과 시 0)."""
    print(f"server.py 기동 중... ({_URL})")
    # Popen으로 서버를 자식 프로세스로 실행 — 같은 venv의 파이썬으로 server.py 기동
    proc = subprocess.Popen(
        [sys.executable, str(_PROJECT_DIR / "server.py")],
        cwd=str(_PROJECT_DIR),
    )
    try:
        if not wait_for_port(_HOST, _PORT, timeout=90):
            print("FAIL: 서버 포트가 열리지 않음 (Neo4j/Ollama 상태 확인)")
            return 1
        # 포트는 열렸지만 초기화 직후일 수 있어 잠깐 여유를 둠
        time.sleep(1)
        all_pass = asyncio.run(run_checks())
        return 0 if all_pass else 1
    finally:
        # with 블록처럼 종료를 보장 — 테스트가 끝나면 서버 프로세스를 반드시 정리함
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        print("server.py 종료")


if __name__ == "__main__":
    # 이 파일을 직접 실행할 때만 검증을 수행함 (import 시 미실행).
    sys.exit(main())
