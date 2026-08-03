"""변경 알림 구독 클라이언트 — subscriptions/listen 실습

두 개의 구독을 **동시에** 열고, 각 구독이 자기가 요청한 알림만 받는 것을 확인함.

  구독 A : resource_subscriptions=["watch://notes"]  → 메모 파일 변경만 수신
  구독 B : tools_list_changed=True                   → 도구 목록 변경만 수신

STDIO는 모든 메시지가 한 채널을 공유하므로, 스펙상 서버는 모든 알림에
_meta.io.modelcontextprotocol/subscriptionId 를 붙이고 클라이언트는 그것으로 demux 함.
SDK의 listen()이 이 demux를 대신 수행하므로, 사용자는 구독별 async for 루프만 작성하면 됨.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from mcp import Client, StdioServerParameters, stdio_client
from mcp.client.subscriptions import SubscriptionLost

SERVER_SCRIPT = Path(__file__).resolve().parent.parent / "server" / "watch_server.py"

# 각 구독이 몇 건을 받으면 루프를 끝낼지 (자동 테스트가 끝나도록 하기 위함)
EXPECT_RESOURCE_EVENTS = 2
EXPECT_TOOLS_EVENTS = 2


def _text(blocks) -> str:
    return "".join(getattr(b, "text", str(b)) for b in blocks)


async def watch_resource(client: Client, done: asyncio.Event) -> None:
    """구독 A: 메모 리소스 변경만 수신함."""
    async with client.listen(resource_subscriptions=["watch://notes"]) as sub:
        # 컨텍스트 진입 = 서버의 ack 수신 완료. honored는 서버가 실제로 수락한 필터임.
        print(f"[구독 A] 열림. 서버가 수락한 필터: {sub.honored}")
        received = 0
        try:
            async for event in sub:
                received += 1
                print(f"[구독 A] 이벤트 #{received}: {type(event).__name__} {event}")
                # 알림은 '변경되었다'는 신호일 뿐이므로 실제 내용은 다시 읽어야 함(재조회).
                content = await client.read_resource("watch://notes")
                print(f"[구독 A] 재조회 결과:\n{_text(content.contents).rstrip()}")
                if received >= EXPECT_RESOURCE_EVENTS:
                    break
        except SubscriptionLost:
            print("[구독 A] 스트림이 정상 종료 없이 끊김 → 재구독 후 재조회 필요")
        finally:
            done.set()
            print("[구독 A] 종료")


async def watch_tools(client: Client, done: asyncio.Event) -> None:
    """구독 B: 도구 목록 변경만 수신함."""
    async with client.listen(tools_list_changed=True) as sub:
        print(f"[구독 B] 열림. 서버가 수락한 필터: {sub.honored}")
        received = 0
        try:
            async for event in sub:
                received += 1
                print(f"[구독 B] 이벤트 #{received}: {type(event).__name__} {event}")
                tools = await client.list_tools()
                names = [t.name for t in tools.tools]
                print(f"[구독 B] 재조회 결과: {names}")
                if received >= EXPECT_TOOLS_EVENTS:
                    break
        except SubscriptionLost:
            print("[구독 B] 스트림이 정상 종료 없이 끊김 → 재구독 후 재조회 필요")
        finally:
            done.set()
            print("[구독 B] 종료")


async def trigger_changes(client: Client) -> None:
    """구독이 열린 뒤 변경을 순서대로 일으킴."""
    await asyncio.sleep(0.5)  # 두 구독의 ack가 끝나기를 잠깐 기다림

    print("\n--- 변경 1: 메모 추가 (구독 A만 반응해야 함) ---")
    await client.call_tool("append_note", {"text": "MCP 2026-07-28 학습 시작"})
    await asyncio.sleep(0.3)

    print("\n--- 변경 2: 도구 추가 (구독 B만 반응해야 함) ---")
    await client.call_tool("add_greeting_tool", {"name": "hong"})
    await asyncio.sleep(0.3)

    print("\n--- 변경 3: 메모 추가 (구독 A만 반응해야 함) ---")
    await client.call_tool("append_note", {"text": "subscriptions/listen 확인 완료"})
    await asyncio.sleep(0.3)

    print("\n--- 변경 4: 도구 제거 (구독 B만 반응해야 함) ---")
    await client.call_tool("remove_greeting_tool", {"name": "hong"})
    await asyncio.sleep(0.3)


async def main() -> None:
    params = StdioServerParameters(command=sys.executable, args=[str(SERVER_SCRIPT)])

    async with Client(stdio_client(params)) as client:
        print(f"서버 연결 완료: {client.server_info.name} / protocol={client.protocol_version}")

        done_a = asyncio.Event()
        done_b = asyncio.Event()

        task_a = asyncio.create_task(watch_resource(client, done_a))
        task_b = asyncio.create_task(watch_tools(client, done_b))

        await trigger_changes(client)

        # 두 구독이 기대 건수를 모두 받을 때까지 잠시 대기 (테스트가 매달리지 않게 타임아웃)
        try:
            await asyncio.wait_for(asyncio.gather(task_a, task_b), timeout=10)
        except asyncio.TimeoutError:
            print("\n[경고] 기대한 알림을 모두 받지 못하고 타임아웃됨")
            task_a.cancel()
            task_b.cancel()

        print("\n=== 최종 도구 목록 ===")
        tools = await client.list_tools()
        print(f"  {[t.name for t in tools.tools]}")


if __name__ == "__main__":
    asyncio.run(main())
