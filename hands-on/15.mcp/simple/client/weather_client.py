"""날씨 서버 연결 테스트 클라이언트 — MCP Python SDK v2

wttr.in 외부 API를 호출하는 weather_server.py에 연결하여 도구 2종을 실행함.
네트워크가 필요하며, wttr.in이 일시적으로 응답하지 않으면 실패할 수 있음.
"""

import asyncio
import sys
from pathlib import Path

from mcp import Client, StdioServerParameters, stdio_client

SERVER_SCRIPT = Path(__file__).resolve().parent.parent / "server" / "weather_server.py"


def _text(blocks) -> str:
    return " ".join(getattr(item, "text", str(item)) for item in blocks)


async def main() -> None:
    params = StdioServerParameters(command=sys.executable, args=[str(SERVER_SCRIPT)])

    async with Client(stdio_client(params)) as client:
        print(f"서버 연결 완료: {client.server_info.name}")

        tools = await client.list_tools()
        print("\n=== 도구 목록 ===")
        for tool in tools.tools:
            print(f"  - {tool.name}: {tool.description}")

        print("\n=== get_weather('Seoul') ===")
        result = await client.call_tool("get_weather", {"city": "Seoul"})
        print(f"  is_error: {result.is_error}")
        print(_text(result.content))

        print("\n=== get_forecast('Busan', days=2) ===")
        result = await client.call_tool("get_forecast", {"city": "Busan", "days": 2})
        print(f"  is_error: {result.is_error}")
        print(_text(result.content))

        print("\n=== get_forecast('Busan', days=5)  → 검증 실패 기대 ===")
        result = await client.call_tool("get_forecast", {"city": "Busan", "days": 5})
        print(f"  is_error: {result.is_error}")
        print(f"  메시지  : {_text(result.content)}")


if __name__ == "__main__":
    asyncio.run(main())
