"""계산기 MCP 서버 (MCP Python SDK v2 / MCPServer + STDIO 전송)

MCP 3대 핵심 기능을 한 파일에서 모두 보여주는 예제임.
  - Tools     : 사칙연산 (add, subtract, multiply, divide) — LLM이 호출 판단
  - Resources : 계산 이력/서버 정보 조회 (calc://history, calc://info) — 읽기 전용 데이터
  - Prompts   : 수학 문제 풀이 프롬프트 템플릿 (math_prompt) — 사용자가 선택

[v1 -> v2 변경점]
  - from mcp.server.fastmcp import FastMCP   ->  from mcp.server.mcpserver import MCPServer
  - FastMCP("Calculator")                    ->  MCPServer("Calculator")
  - mcp.run()                                ->  mcp.run(transport="stdio")
  v2에서 mcp.server.fastmcp 모듈은 제거되었으므로 v1 코드는 임포트 단계에서 실패함.

STDIO 전송에서는 stdout이 JSON-RPC 채널이므로 print() 등 stdout 출력 금지.
디버깅 로그가 필요하면 반드시 stderr로만 출력해야 함.
"""

from mcp.server.mcpserver import MCPServer

# MCPServer: 타입 힌트 + docstring만으로 JSON Schema를 자동 생성하는 MCP 서버 헬퍼.
# 인자 "Calculator"는 server/discover 응답의 serverInfo.name으로 노출되는 서버 이름임.
mcp = MCPServer("Calculator", instructions="사칙연산과 계산 이력 조회를 제공하는 학습용 서버")

# 계산 이력 저장용 모듈 전역 리스트. 도구 실행마다 한 줄씩 누적되어 Resource로 노출됨.
history: list[str] = []


# ---------------------------------------------------------------------------
# Tools (실행 가능한 함수 — 호출 판단은 LLM, 실제 호출은 AI 앱)
# ---------------------------------------------------------------------------

# @mcp.tool(): 이 함수를 MCP '도구'로 등록함. 함수의 타입 힌트(a: float, b: float)와
# docstring이 tools/list 응답의 inputSchema/description으로 자동 변환됨.
@mcp.tool()
def add(a: float, b: float) -> float:
    """두 수를 더함."""
    result = a + b
    history.append(f"{a} + {b} = {result}")
    return result


@mcp.tool()
def subtract(a: float, b: float) -> float:
    """두 수를 뺌."""
    result = a - b
    history.append(f"{a} - {b} = {result}")
    return result


@mcp.tool()
def multiply(a: float, b: float) -> float:
    """두 수를 곱함."""
    result = a * b
    history.append(f"{a} × {b} = {result}")
    return result


@mcp.tool()
def divide(a: float, b: float) -> float:
    """두 수를 나눔. 0으로 나누면 ValueError 발생."""
    # 0 나눗셈은 ZeroDivisionError 대신 명시적 ValueError로 처리.
    # v2에서 MCPError가 아닌 일반 예외는 결과의 is_error=True로 클라이언트에 전달됨.
    if b == 0:
        raise ValueError("0으로 나눌 수 없음.")
    result = a / b
    history.append(f"{a} ÷ {b} = {result}")
    return result


# ---------------------------------------------------------------------------
# Resources (읽기 전용 데이터 — URI로 접근)
# ---------------------------------------------------------------------------

# @mcp.resource("URI"): 함수를 읽기 전용 리소스로 등록함. 클라이언트는 이 URI로
# read_resource()를 호출하여 반환 문자열을 받아감. calc:// 는 임의로 정한 스킴임.
@mcp.resource("calc://history")
def get_history() -> str:
    """지금까지의 계산 이력을 번호와 함께 반환함."""
    if not history:
        return "계산 기록이 없습니다."
    # enumerate(history)는 (인덱스, 값) 쌍을 반환하므로 1부터 시작하는 번호를 붙임.
    return "\n".join(f"{i + 1}. {h}" for i, h in enumerate(history))


@mcp.resource("calc://info")
def get_info() -> str:
    """계산기 서버의 버전·지원 연산 등 메타 정보를 반환함."""
    return "Calculator MCP Server v2.0 (MCP 2026-07-28)\n지원 연산: 덧셈, 뺄셈, 곱셈, 나눗셈"


# ---------------------------------------------------------------------------
# Prompts (재사용 가능한 프롬프트 템플릿 — 사용자가 선택)
# ---------------------------------------------------------------------------

# @mcp.prompt(): 함수를 프롬프트 템플릿으로 등록함. get_prompt() 호출 시 인자를 받아
# '완성된 프롬프트 텍스트'를 반환함 (LLM 실행 결과가 아니라 프롬프트 문자열 자체임).
@mcp.prompt()
def math_prompt(problem: str) -> str:
    """수학 문제를 단계별로 풀도록 유도하는 프롬프트를 생성함."""
    return (
        "다음 수학 문제를 단계별로 풀어주세요.\n"
        "계산이 필요하면 계산기 도구(add/subtract/multiply/divide)를 활용하세요.\n\n"
        f"문제: {problem}"
    )


# 이 파일을 직접 실행할 때만 서버를 구동함 (import 시에는 실행되지 않음).
if __name__ == "__main__":
    # v2에서는 전송 방식을 run()의 인자로 지정함 (v1은 생성자 인자였음).
    # stdin/stdout으로 개행 구분 JSON-RPC 메시지를 주고받음.
    mcp.run(transport="stdio")
