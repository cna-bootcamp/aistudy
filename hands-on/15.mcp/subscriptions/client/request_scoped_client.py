"""요청 스코프 알림 실습 — 진행률·로그는 '구독 스트림'이 아니라 '해당 요청의 응답 스트림'으로 온다

MCP 2026-07-28은 알림을 두 갈래로 명확히 나눔.

  ┌─ 요청 스코프 알림 ─────────────────────────────────────────────┐
  │ notifications/progress, notifications/message                  │
  │ → 그 알림이 관계된 **요청의 응답 스트림**으로만 전달됨          │
  │ → subscriptions/listen 스트림에는 절대 실리지 않음              │
  └────────────────────────────────────────────────────────────────┘
  ┌─ 변경 알림 ────────────────────────────────────────────────────┐
  │ tools/list_changed, resources/updated 등                       │
  │ → subscriptions/listen 응답 스트림으로 전달됨                   │
  └────────────────────────────────────────────────────────────────┘

이 스크립트는 **구독 스트림을 열어 둔 채로** 진행률·로그를 발생시키는 도구를 호출하여,
구독 스트림에는 아무것도 오지 않는다는 것을 건수로 증명함.

추가로 두 알림 모두 **옵트인**임을 확인함.
  - 진행률: 클라이언트가 progress_callback을 주면 SDK가 progressToken을 실어 보냄
  - 로그  : 클라이언트가 log_level을 지정해야 함
            (스펙: 서버는 logLevel이 없는 요청에 notifications/message를 보내면 안 됨)
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import mcp_types as types
from mcp import Client, StdioServerParameters, stdio_client

SERVER_SCRIPT = Path(__file__).resolve().parent.parent / "server" / "watch_server.py"


def _text(blocks) -> str:
    return "".join(getattr(b, "text", str(b)) for b in blocks)


def _transport():
    return stdio_client(StdioServerParameters(command=sys.executable, args=[str(SERVER_SCRIPT)]))


class Counters:
    """각 경로로 몇 건이 들어왔는지 세는 계수기."""

    def __init__(self) -> None:
        self.subscription_events = 0
        self.progress = 0
        self.logs = 0


async def watch_everything(client: Client, counters: Counters, stop: asyncio.Event) -> None:
    """모든 변경 종류를 구독해 두고 들어오는 건수를 셈.

    진행률·로그가 여기로 오지 않는다는 것을 보이기 위해 필터를 최대한 넓게 엶.
    """
    async with client.listen(
        tools_list_changed=True,
        prompts_list_changed=True,
        resources_list_changed=True,
        resource_subscriptions=["watch://notes", "watch://status"],
    ) as sub:
        print(f"[구독] 열림. 서버가 수락한 필터: {sub.honored}")

        async def pump() -> None:
            async for event in sub:
                counters.subscription_events += 1
                print(f"[구독] 이벤트 수신 #{counters.subscription_events}: {type(event).__name__}")

        task = asyncio.create_task(pump())
        await stop.wait()
        task.cancel()
        print("[구독] 종료")


async def main() -> None:
    counters = Counters()

    async def on_log(params: types.LoggingMessageNotificationParams) -> None:
        counters.logs += 1
        print(f"    [로그  ] level={params.level} data={params.data}")

    async def on_progress(progress: float, total: float | None, message: str | None) -> None:
        counters.progress += 1
        print(f"    [진행률] {progress}/{total} - {message}")

    async with Client(
        _transport(),
        # 로그 옵트인: 요청 _meta에 io.modelcontextprotocol/logLevel 이 실려 나감
        log_level="info",
        logging_callback=on_log,
    ) as client:
        print(f"서버 연결 완료: {client.server_info.name} / protocol={client.protocol_version}\n")

        stop = asyncio.Event()
        watcher = asyncio.create_task(watch_everything(client, counters, stop))
        await asyncio.sleep(0.5)  # ack 대기

        # ------------------------------------------------------------------
        print("\n" + "=" * 72)
        print("[A] 진행률·로그 옵트인 상태로 long_task 호출")
        print("     → 구독 스트림에는 오지 않고, 이 요청의 응답 스트림으로 전달되어야 함")
        print("=" * 72)
        before = counters.subscription_events
        result = await client.call_tool(
            "long_task", {"steps": 4, "delay": 0.25},
            progress_callback=on_progress,      # progressToken 옵트인
        )
        await asyncio.sleep(0.3)
        print(f"  결과: {_text(result.content)}")
        print(f"  → 진행률 수신 {counters.progress}건, 로그 수신 {counters.logs}건")
        print(f"  → 구독 스트림 수신 {counters.subscription_events - before}건  (0이어야 정상)")

        # ------------------------------------------------------------------
        print("\n" + "=" * 72)
        print("[B] 진행률 옵트인 없이 같은 도구 호출 (progress_callback 미지정)")
        print("     → progressToken이 없으므로 진행률 알림이 오지 않아야 함")
        print("=" * 72)
        p_before, l_before = counters.progress, counters.logs
        await client.call_tool("long_task", {"steps": 3, "delay": 0.2})
        await asyncio.sleep(0.3)
        print(f"  → 진행률 수신 {counters.progress - p_before}건  (0이어야 정상)")
        print(f"  → 로그 수신 {counters.logs - l_before}건  (log_level은 여전히 유효하므로 >0)")

        # ------------------------------------------------------------------
        print("\n" + "=" * 72)
        print("[C] 실제 '변경'을 일으킴 (append_note)")
        print("     → 이번에는 구독 스트림이 반응해야 함")
        print("=" * 72)
        before = counters.subscription_events
        await client.call_tool("append_note", {"text": "요청 스코프 알림 실습"})
        await asyncio.sleep(0.5)
        print(f"  → 구독 스트림 수신 {counters.subscription_events - before}건  (1 이상이어야 정상)")

        stop.set()
        await watcher

    # ----------------------------------------------------------------------
    print("\n" + "=" * 72)
    print("최종 집계")
    print("=" * 72)
    print(f"  진행률 알림(요청 응답 스트림) : {counters.progress}건")
    print(f"  로그 알림(요청 응답 스트림)   : {counters.logs}건")
    print(f"  구독 스트림 이벤트            : {counters.subscription_events}건")
    print("\n결론: 진행률·로그는 구독 스트림이 아니라 '그 요청의 응답 스트림'으로만 전달됨.")


async def main_without_log_level() -> None:
    """[D] log_level을 지정하지 않으면 로그 알림 자체가 오지 않음을 확인."""
    print("\n" + "=" * 72)
    print("[D] log_level 미지정 클라이언트로 long_task 호출")
    print("     → 서버는 logLevel 없는 요청에 notifications/message를 보내면 안 됨(스펙)")
    print("=" * 72)
    logs = {"n": 0}

    async def on_log(params: types.LoggingMessageNotificationParams) -> None:
        logs["n"] += 1

    # logging_callback은 등록하되 log_level은 주지 않음
    async with Client(_transport(), logging_callback=on_log) as client:
        await client.call_tool("long_task", {"steps": 2, "delay": 0.2})
        await asyncio.sleep(0.3)
    print(f"  → 로그 수신 {logs['n']}건  (0이어야 정상)")


if __name__ == "__main__":

    async def run() -> None:
        await main()
        await main_without_log_level()

    asyncio.run(run())
