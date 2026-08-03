"""변경 알림 구독 MCP 서버 — subscriptions/listen 실습

MCP 2026-07-28은 서버→클라이언트 변경 알림 경로를 하나로 통합했음.
  - 제거: HTTP GET 스트림, resources/subscribe / resources/unsubscribe RPC
  - 신설: subscriptions/listen  — 클라이언트가 '받고 싶은 알림 종류'를 지정해 여는 롱리브 스트림

이 서버는 두 종류의 변경을 만들어 냄.
  1) 리소스 변경 : 메모 파일에 내용을 덧붙이고 notifications/resources/updated 발송
  2) 도구 목록 변경 : 런타임에 도구를 등록/삭제하고 notifications/tools/list_changed 발송

클라이언트는 이 둘을 **서로 다른 구독**으로 열고 subscriptionId로 구분해 처리함.

STDIO 전송이므로 stdout 출력 금지. 로그는 stderr로만 남김.
"""

from __future__ import annotations

import asyncio
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

from mcp import MCPDeprecationWarning
from mcp.server.mcpserver import Context, MCPServer

# Logging 기능(ctx.info/ctx.log)은 2026-07-28에서 폐기 예정(SEP-2577)이라
# 호출할 때마다 MCPDeprecationWarning이 발생함.
# 이 예제는 "로그 알림이 어느 스트림으로 가는가"를 보여주기 위해 의도적으로 사용하므로
# 출력이 지저분해지지 않도록 경고만 끔. 신규 구현은 stderr 또는 OpenTelemetry를 쓸 것.
warnings.simplefilter("ignore", MCPDeprecationWarning)

DATA_DIR = Path(__file__).resolve().parent / "data"
NOTES_FILE = DATA_DIR / "notes.txt"

NOTES_URI = "watch://notes"
STATUS_URI = "watch://status"


def _log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


mcp = MCPServer(
    "WatchServer",
    instructions="메모 파일과 도구 목록의 변경을 알림으로 알려주는 학습용 서버",
)


def _ensure_files() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not NOTES_FILE.exists():
        NOTES_FILE.write_text("(메모 없음)\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# Resources — 클라이언트가 변경 알림을 구독할 대상
# ---------------------------------------------------------------------------
@mcp.resource(NOTES_URI)
def read_notes() -> str:
    """메모 파일의 현재 내용을 반환함."""
    _ensure_files()
    return NOTES_FILE.read_text(encoding="utf-8")


@mcp.resource(STATUS_URI)
def read_status() -> str:
    """메모 개수 등 상태 요약을 반환함 (구독하지 않은 리소스와 비교용)."""
    _ensure_files()
    lines = [ln for ln in NOTES_FILE.read_text(encoding="utf-8").splitlines() if ln.strip()]
    return f"메모 {len(lines)}줄"


# ---------------------------------------------------------------------------
# Tools — 변경을 일으키고 알림을 발송함
# ---------------------------------------------------------------------------
@mcp.tool()
async def append_note(text: str, ctx: Context) -> str:
    """메모 파일에 한 줄을 덧붙이고 리소스 변경 알림을 발송함."""
    _ensure_files()
    stamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
    with NOTES_FILE.open("a", encoding="utf-8") as f:
        f.write(f"[{stamp}] {text}\n")

    # 이 호출이 notifications/resources/updated 를 발생시킴.
    # 해당 URI를 resource_subscriptions에 넣어 구독한 클라이언트에게만 전달됨.
    await ctx.notify_resource_updated(NOTES_URI)
    _log(f"[watch] 메모 추가 + resources/updated 발송: {text}")
    return f"메모를 추가했습니다: {text}"


@mcp.tool()
async def add_greeting_tool(name: str, ctx: Context) -> str:
    """런타임에 인사 도구를 추가하고 도구 목록 변경 알림을 발송함."""
    tool_name = f"greet_{name}"

    def _greet() -> str:
        return f"안녕하세요, {name}님!"

    _greet.__name__ = tool_name
    _greet.__doc__ = f"{name}님에게 인사함 (런타임 등록 도구)."
    mcp.add_tool(_greet, name=tool_name)

    # 이 호출이 notifications/tools/list_changed 를 발생시킴.
    # tools_list_changed=True로 구독한 클라이언트에게만 전달됨.
    await ctx.notify_tools_changed()
    _log(f"[watch] 도구 추가 + tools/list_changed 발송: {tool_name}")
    return f"도구를 추가했습니다: {tool_name}"


@mcp.tool()
async def remove_greeting_tool(name: str, ctx: Context) -> str:
    """런타임에 추가한 인사 도구를 제거하고 도구 목록 변경 알림을 발송함."""
    tool_name = f"greet_{name}"
    mcp.remove_tool(tool_name)
    await ctx.notify_tools_changed()
    _log(f"[watch] 도구 제거 + tools/list_changed 발송: {tool_name}")
    return f"도구를 제거했습니다: {tool_name}"


# ---------------------------------------------------------------------------
# 요청 스코프 알림(진행률·로그)을 발생시키는 도구
# ---------------------------------------------------------------------------
# 스펙: notifications/progress 와 notifications/message 는 '구독 스트림'이 아니라
#       **그 알림이 관계된 요청의 응답 스트림**으로만 전달됨.
#       subscriptions/listen 스트림에는 절대 실리지 않음.
@mcp.tool()
async def long_task(steps: int = 4, delay: float = 0.3, ctx: Context = None) -> str:  # type: ignore[assignment]
    """steps단계로 진행되는 작업. 단계마다 진행률과 로그를 보고함.

    - ctx.report_progress() → notifications/progress
      클라이언트가 progressToken을 넣어 옵트인한 경우에만 전달됨.
    - ctx.info() → notifications/message
      요청 _meta에 logLevel이 있는 경우에만 전달됨(스펙: 없으면 서버가 보내면 안 됨).
    둘 다 이 tools/call 요청의 응답 스트림으로만 흐름.
    """
    for i in range(1, steps + 1):
        await asyncio.sleep(delay)
        await ctx.report_progress(i, steps, f"{i}/{steps} 단계 완료")
        await ctx.info({"message": "단계 처리", "step": i, "of": steps})
        _log(f"[watch] long_task {i}/{steps} (progress + log 발송)")
    return f"작업 완료: {steps}단계"


if __name__ == "__main__":
    # 실습 재현성을 위해 서버 기동 시 메모 파일을 초기화함.
    # (클라이언트가 서버를 자식 프로세스로 띄우므로 실행할 때마다 깨끗한 상태에서 시작)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    NOTES_FILE.write_text("(메모 없음)\n", encoding="utf-8")
    mcp.run(transport="stdio")
