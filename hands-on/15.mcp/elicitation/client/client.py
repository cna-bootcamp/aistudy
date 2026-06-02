"""여행 플래너 MCP 클라이언트 (Elicitation 예제, 대화형)

서버가 보낸 Elicitation 요청(JSON Schema 포함)을 받아 CLI 폼으로 렌더링하고,
사용자 입력을 수집·1차 검증한 뒤 서버에 반환하는 대화형 클라이언트임.

[핵심 개념]
- elicitation_callback: 서버의 ctx.elicit() 호출 시 자동 실행되는 콜백 (등록 시 elicitation 지원 선언)
- params.requestedSchema: 서버 Pydantic 모델이 변환된 JSON Schema (dict)
- ElicitResult(action, content): 클라이언트 응답 (accept/decline/cancel + 입력값 dict)

[검증 2계층 중 1계층]
- 클라이언트: enum 선택지·숫자 범위 등 입력 단계에서 1차 걸러줌
- 서버: 교차필드·비즈니스 규칙으로 2차 검증 (travel_server.py 참조)
"""

import asyncio
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters    # MCP 클라이언트 핵심 클래스
from mcp.client.stdio import stdio_client               # STDIO 전송 방식 클라이언트
from mcp.types import ElicitResult                      # Elicitation 응답 타입

# Windows 기본 콘솔(cp949)은 이모지 등 일부 유니코드를 출력하지 못해 크래시함.
# LLM 일정에 이모지가 섞여도 안전하도록 표준 출력을 UTF-8로 재설정함.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# 이 파일(client/client.py) 기준으로 ../server/travel_server.py 절대경로를 구함.
# Path(__file__).resolve().parent는 이 파일이 위치한 client/ 디렉터리임.
SERVER_PATH = Path(__file__).resolve().parent.parent / "server" / "travel_server.py"


# ---------------------------------------------------------------------------
# Elicitation 콜백: JSON Schema → CLI 폼 렌더링
# ---------------------------------------------------------------------------


async def elicitation_callback(context, params) -> ElicitResult:
    """서버의 Elicitation 요청을 CLI 폼으로 렌더링하고 사용자 입력을 수집함.

    처리 흐름:
    1. 서버 안내 메시지(params.message) 출력
    2. params.requestedSchema에서 필드/필수값 추출
    3. 필드 타입별 입력 UI 렌더링 (enum→번호 선택, number→범위, string→자유 입력)
    4. 입력값을 content dict로 모아 ElicitResult(action="accept")로 반환
    """
    # 서버가 ctx.elicit(message=...)로 보낸 안내 문구 출력
    print(f"\n{'=' * 50}")
    print(f"  {params.message}")
    print(f"{'=' * 50}")
    print("  (입력 중 'q' 입력 시 취소)")

    # 서버 Pydantic 모델이 변환된 JSON Schema (dict). 없으면 단순 확인만 요청함.
    schema = getattr(params, "requestedSchema", None)
    if not schema:
        answer = input("\n  계속하시겠습니까? (y/n): ").strip().lower()
        if answer in ("n", "no", "아니오"):
            return ElicitResult(action="decline")
        return ElicitResult(action="accept", content={})

    properties = schema.get("properties", {})   # {"country": {"type": "string", "enum": [...]}, ...}
    content: dict = {}                           # 사용자 입력을 모을 딕셔너리

    # 각 필드를 순회하며 타입별 입력 UI를 렌더링함.
    for name, prop in properties.items():
        description = prop.get("description", name)
        prop_type = prop.get("type", "string")
        enum_values = prop.get("enum")
        default = prop.get("default")

        # --- enum 타입: 번호 선택 UI ---
        if enum_values:
            print(f"\n  {description}:")
            for i, val in enumerate(enum_values, 1):
                print(f"    {i}. {val}")
            while True:  # 유효한 번호가 들어올 때까지 반복
                hint = f"  선택 (1-{len(enum_values)})"
                if default:
                    hint += f" [기본값: {default}]"
                choice = input(f"{hint}: ").strip()
                if choice.lower() in ("q", "취소"):
                    return ElicitResult(action="cancel")
                if not choice and default:
                    content[name] = default
                    break
                if choice.isdigit() and 1 <= int(choice) <= len(enum_values):
                    content[name] = enum_values[int(choice) - 1]
                    break
                print("    잘못된 선택임. 다시 입력할 것.")

        # --- number/integer 타입: 범위 검증 UI ---
        elif prop_type in ("number", "integer"):
            minimum = prop.get("minimum")    # Field(ge=..) → JSON Schema "minimum"
            maximum = prop.get("maximum")    # Field(le=..) → JSON Schema "maximum"
            hint_parts = [f"  {description}"]
            if minimum is not None and maximum is not None:
                hint_parts.append(f"({minimum}~{maximum})")
            elif minimum is not None:
                hint_parts.append(f"({minimum} 이상)")
            if default is not None:
                hint_parts.append(f"[기본값: {default}]")
            hint = " ".join(hint_parts)
            while True:  # 유효한 숫자가 들어올 때까지 반복
                raw = input(f"{hint}: ").strip()
                if raw.lower() in ("q", "취소"):
                    return ElicitResult(action="cancel")
                if not raw and default is not None:
                    content[name] = default
                    print(f"    → {default}")
                    break
                try:
                    num = int(raw) if prop_type == "integer" else float(raw)
                except ValueError:
                    print("    숫자를 입력할 것.")
                    continue
                if minimum is not None and num < minimum:
                    print(f"    최소값은 {minimum}임.")
                    continue
                if maximum is not None and num > maximum:
                    print(f"    최대값은 {maximum}임.")
                    continue
                content[name] = num
                break

        # --- boolean 타입: y/n 선택 ---
        elif prop_type == "boolean":
            raw = input(f"\n  {description} (y/n): ").strip().lower()
            if raw in ("q", "취소"):
                return ElicitResult(action="cancel")
            content[name] = raw in ("y", "yes", "예", "네")

        # --- string 타입: 자유 텍스트 입력 ---
        else:
            hint = f"\n  {description}"
            if default:
                hint += f" [기본값: {default}]"
            raw = input(f"{hint}: ").strip()
            if raw.lower() in ("q", "취소"):
                return ElicitResult(action="cancel")
            content[name] = raw if raw else (default or "")

    # action="accept" + content(dict)를 반환 → 서버 ctx.elicit()가 이 값을 Pydantic으로 변환해 받음.
    return ElicitResult(action="accept", content=content)


# ---------------------------------------------------------------------------
# 메인: 서버 연결 → 도구 호출
# ---------------------------------------------------------------------------


async def main():
    """MCP 서버에 연결하여 plan_trip 도구를 호출함."""
    print("=" * 50)
    print("  여행 플래너 (MCP Elicitation 예제)")
    print("=" * 50)
    print(f"서버 연결: {SERVER_PATH.name}\n")

    # 서버 연결 파라미터: 현재 venv의 python으로 travel_server.py를 자식 프로세스로 실행함.
    server_params = StdioServerParameters(
        command=sys.executable,          # 현재 파이썬 인터프리터(venv) 경로
        args=[str(SERVER_PATH)],         # 실행할 서버 스크립트 절대경로
    )

    # stdio_client: 서버 서브프로세스를 띄우고 stdin/stdout 스트림(read, write)을 돌려줌.
    async with stdio_client(server_params) as (read, write):
        # ClientSession에 elicitation_callback을 등록하면 elicitation 지원을 서버에 선언함.
        async with ClientSession(
            read,
            write,
            elicitation_callback=elicitation_callback,
        ) as session:
            # initialize(): 프로토콜 협상 (capabilities 교환). 이후 통신 가능 상태가 됨.
            await session.initialize()
            print("서버 연결 완료\n")

            # 도구 목록 조회 (서버의 @mcp.tool() 등록 함수 확인)
            tools = await session.list_tools()
            print("=== 사용 가능한 도구 ===")
            for tool in tools.tools:
                print(f"  - {tool.name}: {tool.description.splitlines()[0]}")

            print("\n여행 계획을 시작합니다. 서버가 정보를 단계별로 요청합니다.\n")

            # plan_trip 호출 → 서버가 중간에 ctx.elicit()를 3번 호출하면
            # 그때마다 위 elicitation_callback이 자동 실행되어 입력을 수집함.
            result = await session.call_tool(
                "plan_trip",
                arguments={"request": "여행 계획을 세워주세요"},
            )

            # 도구 실행 결과(여행 계획서 텍스트) 출력
            print("\n")
            for item in result.content:
                if hasattr(item, "text"):
                    print(item.text)


if __name__ == "__main__":
    asyncio.run(main())
