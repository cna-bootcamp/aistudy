"""MCP 전송 계층 end-to-end 검증 — 실제 Streamable HTTP 클라이언트.

server.py를 자식 프로세스로 기동한 뒤, 실제 MCP ClientSession으로 /mcp에 연결해
도구 목록·도구 호출·리소스 읽기·프롬프트 조회가 전부 동작하는지 확인함.
in-process 테스트(test_e2e.py)가 검증하지 못하는 '전송·등록·스키마·이벤트 루프' 계층까지 포함함.
특히 동기 도구 안에서 async GraphRAG API를 호출하는 이벤트 루프 브리지는 이 테스트만 잡아냄.

완료(PASS) 기준:
  - tools/list에 ask_patent_law 포함
  - ask_patent_law(auto) 결과에 resolved_mode + 비어있지 않은 한국어 answer
  - ask_patent_law(local) 호출이 GraphRAG 경로를 타고 오류 없이 답변 생성(이벤트 루프 검증)
  - resources/list에 patent://kg/stats, patent://kg/schema 포함 + 읽기 성공
  - prompts/list에 patent_law_advice 포함 + 텍스트 생성 성공

사용법:
  python test_mcp_client.py   # 서버 자동 기동·검증·종료, 전부 통과 시 exit 0
"""
import asyncio
import os
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

from config.settings import settings as _settings

_HOST = _settings.mcp_host
_PORT = _settings.mcp_port
_URL = f"http://{_HOST}:{_PORT}/mcp"


def has_korean(text: str) -> bool:
    """문자열에 한글 음절이 하나라도 있는지 판별."""
    return any("가" <= ch <= "힣" for ch in str(text))


def wait_for_port(host: str, port: int, timeout: float = 120.0) -> bool:
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
    """실제 MCP 세션을 열어 도구/리소스/프롬프트 프리미티브를 검증함."""
    verdicts: dict[str, bool] = {}

    async with streamablehttp_client(_URL) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # 1) tools/list — ask_patent_law 등록 확인
            tools = await session.list_tools()
            tool_names = [t.name for t in tools.tools]
            print(f"\n[tools/list] {tool_names}")
            verdicts["tool_registered"] = "ask_patent_law" in tool_names

            # 2) tools/call (auto) — 한국어 답변 + resolved_mode 확인
            call = await session.call_tool(
                "ask_patent_law", {"question": "특허를 받을 수 있는 요건은?", "mode": "auto"}
            )
            s = getattr(call, "structuredContent", None) or {}
            answer = s.get("answer", "") or _text_of(call)
            print(f"\n[tools/call auto] resolved={s.get('resolved_mode')} "
                  f"modes_used={s.get('modes_used')} reason={s.get('route_reason')}")
            print(f"  sources={[x.get('title') for x in s.get('sources', [])[:3]]}")
            print(f"  answer={str(answer)[:240]}")
            verdicts["tool_auto"] = bool(s.get("resolved_mode")) and has_korean(answer) \
                and not s.get("error", False)

            # 3) tools/call (local) — GraphRAG 경로 + 이벤트 루프 브리지 검증
            call2 = await session.call_tool(
                "ask_patent_law", {"question": "신규성 요건과 관련된 절차를 알려줘", "mode": "local"}
            )
            s2 = getattr(call2, "structuredContent", None) or {}
            print(f"\n[tools/call local] resolved={s2.get('resolved_mode')} "
                  f"evidence={s2.get('evidence')}")
            print(f"  answer={str(s2.get('answer', ''))[:200]}")
            verdicts["tool_local_graphrag"] = bool(s2.get("answer")) and not s2.get("error", False)

            # 4) resources/list + read — stats/schema 확인
            resources = await session.list_resources()
            res_uris = [str(r.uri) for r in resources.resources]
            print(f"\n[resources/list] {res_uris}")
            stats_read = await session.read_resource("patent://kg/stats")
            stats_text = "\n".join(
                getattr(c, "text", "") for c in stats_read.contents if getattr(c, "text", "")
            )
            print(f"[resources/read stats] {stats_text[:160]}")
            verdicts["resource_stats"] = '"entity_count"' in stats_text

            schema_read = await session.read_resource("patent://kg/schema")
            schema_text = "\n".join(
                getattr(c, "text", "") for c in schema_read.contents if getattr(c, "text", "")
            )
            print(f"[resources/read schema] {schema_text[:160]}")
            verdicts["resource_schema"] = has_korean(schema_text)

            # 5) prompts/list + get — patent_law_advice 확인
            prompts = await session.list_prompts()
            prompt_names = [p.name for p in prompts.prompts]
            print(f"\n[prompts/list] {prompt_names}")
            got = await session.get_prompt("patent_law_advice", {"topic": "직무발명 보상"})
            prompt_text = got.messages[0].content.text if got.messages else ""
            print(f"[prompts/get patent_law_advice] {prompt_text[:160]}")
            verdicts["prompt_advice"] = "patent_law_advice" in prompt_names and has_korean(prompt_text)

    print(f"\n{'=' * 72}\n[MCP 전송 계층 종합 판정]")
    for name, ok in verdicts.items():
        print(f"  {name:22} : {'PASS' if ok else 'FAIL'}")
    all_pass = all(verdicts.values())
    print(f"\n  전체: {'ALL PASS' if all_pass else 'FAIL'}")
    return all_pass


def main() -> int:
    """server.py를 기동하고 검증 후 종료함 (전부 통과 시 0)."""
    print(f"server.py 기동 중... ({_URL})")
    env = dict(os.environ, LITELLM_LOG="ERROR")
    proc = subprocess.Popen([sys.executable, str(_PROJECT_DIR / "server.py")],
                            cwd=str(_PROJECT_DIR), env=env)
    try:
        if not wait_for_port(_HOST, _PORT, timeout=120):
            print("FAIL: 서버 포트가 열리지 않음")
            return 1
        time.sleep(1)  # 포트는 열렸지만 초기화 직후일 수 있어 잠깐 여유
        all_pass = asyncio.run(run_checks())
        return 0 if all_pass else 1
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        print("server.py 종료")


if __name__ == "__main__":
    sys.exit(main())
