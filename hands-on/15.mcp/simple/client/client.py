"""MCP 클라이언트 예제 (계산기 서버 연결 테스트)

서버를 별도로 실행하지 않아도 됨. STDIO 전송에서는 클라이언트가 서버 스크립트를
자식 프로세스로 직접 실행하고 stdin/stdout 파이프로 연결함.

흐름:
  1) 서버 연결 + 초기화(initialize)
  2) 도구/리소스/프롬프트 목록 조회
  3) 도구 호출(add, divide)
  4) 리소스 읽기(calc://history)
  5) 프롬프트 조회(math_prompt)
"""
import asyncio
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Path(__file__).resolve().parent: 이 파일(client.py)이 위치한 디렉터리의 절대경로.
# 거기서 한 단계 위로 올라가 server/calc_server.py의 절대경로를 구함.
# 절대경로를 쓰는 이유: 클라이언트를 어느 위치에서 실행해도 서버를 항상 찾게 하기 위함.
SERVER_SCRIPT = Path(__file__).resolve().parent.parent / "server" / "calc_server.py"


def _text(content_list) -> str:
    """call_tool/read_resource 결과의 content 리스트에서 텍스트만 추출함.

    MCP 응답은 여러 콘텐츠 조각의 리스트이며 각 조각에 .text 속성이 있을 수 있음.
    """
    parts = []
    for item in content_list:
        # getattr(item, "text", None): item에 text 속성이 있으면 그 값, 없으면 기본값 반환.
        parts.append(getattr(item, "text", str(item)))
    return " ".join(parts)


async def main():
    """계산기 MCP 서버에 연결하여 Tools/Resources/Prompts를 차례로 호출함."""

    # StdioServerParameters: 어떤 명령으로 서버를 실행할지 정의함.
    #   command=sys.executable → 지금 client.py를 실행 중인 동일 파이썬(venv) 사용.
    #   args=[서버 스크립트 절대경로] → CWD에 의존하지 않고 서버를 안정적으로 실행.
    params = StdioServerParameters(
        command=sys.executable,
        args=[str(SERVER_SCRIPT)],
    )

    # stdio_client: 서버를 자식 프로세스로 띄우고 (read, write) 스트림을 돌려줌.
    async with stdio_client(params) as (read, write):
        # ClientSession: 위 스트림 위에서 JSON-RPC 요청/응답을 주고받는 세션.
        async with ClientSession(read, write) as session:
            # 1) 초기화: 프로토콜 버전·기능을 서버와 교환함 (반드시 첫 호출).
            await session.initialize()
            print("서버 연결 완료")

            # 2) 도구 목록 조회
            tools = await session.list_tools()
            print("\n=== 사용 가능한 도구 ===")
            for tool in tools.tools:
                print(f"  - {tool.name}: {tool.description}")

            # 3) 리소스 목록 조회
            resources = await session.list_resources()
            print("\n=== 사용 가능한 리소스 ===")
            for res in resources.resources:
                print(f"  - {res.uri}: {res.description}")

            # 4) 도구 호출: add(3, 5)
            print("\n=== 도구 호출: add(3, 5) ===")
            result = await session.call_tool("add", arguments={"a": 3, "b": 5})
            print(f"  결과: {_text(result.content)}")

            # 5) 도구 호출: divide(10, 3)
            print("\n=== 도구 호출: divide(10, 3) ===")
            result = await session.call_tool("divide", arguments={"a": 10, "b": 3})
            print(f"  결과: {_text(result.content)}")

            # 6) 리소스 읽기: 위 두 번의 계산이 누적된 이력
            print("\n=== 리소스 읽기: calc://history ===")
            resource = await session.read_resource("calc://history")
            print(f"  {_text(resource.contents)}")

            # 7) 프롬프트 목록 조회
            prompts = await session.list_prompts()
            print("\n=== 사용 가능한 프롬프트 ===")
            for p in prompts.prompts:
                print(f"  - {p.name}: {p.description}")

            # 8) 프롬프트 조회: math_prompt (완성된 프롬프트 텍스트를 반환, LLM 실행 아님)
            print("\n=== 프롬프트 조회: math_prompt ===")
            prompt = await session.get_prompt(
                "math_prompt", arguments={"problem": "사과 3개와 5개를 더하면?"}
            )
            print(f"  {prompt.messages[0].content.text}")


# 이 파일을 직접 실행할 때만 main()을 수행함.
if __name__ == "__main__":
    # asyncio.run: async 함수 main()을 이벤트 루프에서 실행하고 끝나면 루프를 정리함.
    asyncio.run(main())
