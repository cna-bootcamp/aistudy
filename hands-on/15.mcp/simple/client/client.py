"""MCP 클라이언트 예제 (계산기 서버 연결 테스트) — MCP Python SDK v2

서버를 별도로 실행하지 않아도 됨. STDIO 전송에서는 클라이언트가 서버 스크립트를
자식 프로세스로 직접 실행하고 stdin/stdout 파이프로 연결함.

흐름:
  1) 서버 연결 (initialize 없음 — 2026-07-28은 stateless)
  2) 서버 정보/능력 확인 (server/discover)
  3) 도구/리소스/프롬프트 목록 조회
  4) 도구 호출(add, divide) 및 에러 도구 호출(divide by zero)
  5) 리소스 읽기(calc://history)
  6) 프롬프트 조회(math_prompt)

[v1 -> v2 변경점]
  - stdio_client(...) + ClientSession(read, write) 3계층  ->  Client(transport) 단일 진입점
  - await session.initialize()                            ->  불필요 (stateless 프로토콜)
  - result.isError / tools.nextCursor (camelCase)         ->  result.is_error / next_cursor (snake_case)

주의: Client에 '문자열'을 넘기면 Streamable HTTP URL로 해석됨.
      STDIO 서버를 붙일 때는 아래처럼 stdio_client 전송 객체를 넘겨야 함.
"""

import asyncio
import sys
from pathlib import Path

from mcp import Client, StdioServerParameters, stdio_client

# Path(__file__).resolve().parent: 이 파일(client.py)이 위치한 디렉터리의 절대경로.
# 거기서 한 단계 위로 올라가 server/calc_server.py의 절대경로를 구함.
# 절대경로를 쓰는 이유: 클라이언트를 어느 위치에서 실행해도 서버를 항상 찾게 하기 위함.
SERVER_SCRIPT = Path(__file__).resolve().parent.parent / "server" / "calc_server.py"


def _text(blocks) -> str:
    """call_tool/read_resource 결과의 콘텐츠 리스트에서 텍스트만 추출함.

    MCP 응답은 여러 콘텐츠 조각(ContentBlock)의 리스트이며 각 조각에 .text 속성이 있을 수 있음.
    """
    return " ".join(getattr(item, "text", str(item)) for item in blocks)


async def main() -> None:
    """계산기 MCP 서버에 연결하여 Tools/Resources/Prompts를 차례로 호출함."""

    # StdioServerParameters: 어떤 명령으로 서버를 실행할지 정의함.
    #   command=sys.executable → 지금 client.py를 실행 중인 동일 파이썬(venv) 사용.
    #   args=[서버 스크립트 절대경로] → CWD에 의존하지 않고 서버를 안정적으로 실행.
    params = StdioServerParameters(command=sys.executable, args=[str(SERVER_SCRIPT)])

    # stdio_client(params): 서버를 자식 프로세스로 띄우는 '전송(Transport)'을 만듦.
    # Client가 이 전송을 감싸 JSON-RPC 요청/응답을 처리함. initialize 호출은 없음.
    async with Client(stdio_client(params)) as client:
        print("서버 연결 완료 (initialize 없이 바로 사용 — stateless)")

        # 1) 서버 신원/능력 — server/discover 결과가 Client 속성으로 노출됨
        print("\n=== 서버 정보 (server/discover) ===")
        print(f"  이름/버전 : {client.server_info}")
        print(f"  프로토콜  : {client.protocol_version}")
        print(f"  지시문    : {client.instructions}")

        # 2) 도구 목록 조회
        tools = await client.list_tools()
        print("\n=== 사용 가능한 도구 ===")
        for tool in tools.tools:
            print(f"  - {tool.name}: {tool.description}")

        # 3) 리소스 목록 조회
        resources = await client.list_resources()
        print("\n=== 사용 가능한 리소스 ===")
        for res in resources.resources:
            print(f"  - {res.uri}: {res.description}")

        # 4) 도구 호출: add(3, 5)
        print("\n=== 도구 호출: add(3, 5) ===")
        result = await client.call_tool("add", {"a": 3, "b": 5})
        print(f"  content          : {_text(result.content)}")
        print(f"  structured_content: {result.structured_content}")  # snake_case

        # 5) 도구 호출: divide(10, 3)
        print("\n=== 도구 호출: divide(10, 3) ===")
        result = await client.call_tool("divide", {"a": 10, "b": 3})
        print(f"  결과: {_text(result.content)}")

        # 6) 에러 처리 확인: divide(1, 0) → 서버가 ValueError를 던짐 → is_error=True
        print("\n=== 도구 호출(에러): divide(1, 0) ===")
        result = await client.call_tool("divide", {"a": 1, "b": 0})
        print(f"  is_error: {result.is_error}")
        print(f"  메시지  : {_text(result.content)}")

        # 7) 리소스 읽기: 위 계산들이 누적된 이력
        print("\n=== 리소스 읽기: calc://history ===")
        resource = await client.read_resource("calc://history")
        print(f"  {_text(resource.contents)}")

        # 8) 프롬프트 목록 조회
        prompts = await client.list_prompts()
        print("\n=== 사용 가능한 프롬프트 ===")
        for p in prompts.prompts:
            print(f"  - {p.name}: {p.description}")

        # 9) 프롬프트 조회: math_prompt (완성된 프롬프트 텍스트를 반환, LLM 실행 아님)
        print("\n=== 프롬프트 조회: math_prompt ===")
        prompt = await client.get_prompt(
            "math_prompt", arguments={"problem": "사과 3개와 5개를 더하면?"}
        )
        print(f"  {prompt.messages[0].content.text}")


# 이 파일을 직접 실행할 때만 main()을 수행함.
if __name__ == "__main__":
    # asyncio.run: async 함수 main()을 이벤트 루프에서 실행하고 끝나면 루프를 정리함.
    asyncio.run(main())
