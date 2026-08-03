"""여행 플래너 MCP 클라이언트 — MRTR 라운드를 눈으로 확인하는 예제

클라이언트는 elicitation_callback 하나만 등록하면 됨.
서버가 InputRequiredResult를 돌려주면 SDK가 이 콜백으로 사용자 입력을 받아
**원 요청을 새 JSON-RPC id로 다시 보내는** MRTR 왕복을 대신 처리함.

--auto 옵션(기본): 미리 준비한 답변을 순서대로 사용 (자동 테스트용)
--interactive   : 콘솔에서 직접 입력
--decline       : 3단계에서 decline을 반환하여 거절 분기 확인
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any

from mcp import Client, StdioServerParameters, stdio_client

SERVER_SCRIPT = Path(__file__).resolve().parent.parent / "server" / "travel_server.py"

# --auto 모드에서 사용할 단계별 준비 답변 (질문 순서와 1:1 대응)
AUTO_ANSWERS: list[dict[str, Any]] = [
    {"country": "일본", "city": "오사카"},
    {"days": 3, "budget_manwon": 90},
    {"style": "미식", "companions": 1},
]


def _text(blocks) -> str:
    return "\n".join(getattr(b, "text", str(b)) for b in blocks)


def _prompt_user(schema: dict[str, Any]) -> dict[str, Any]:
    """requested_schema를 보고 콘솔에서 값을 입력받음 (interactive 모드)."""
    answer: dict[str, Any] = {}
    for name, spec in (schema.get("properties") or {}).items():
        desc = spec.get("description", name)
        enum = spec.get("enum")
        hint = f" {enum}" if enum else ""
        raw = input(f"    - {desc}{hint}: ").strip()
        # 스키마 타입에 맞춰 최소한의 변환만 수행함.
        if spec.get("type") == "integer":
            answer[name] = int(raw)
        else:
            answer[name] = raw
    return answer


def make_callback(mode: str):
    """elicitation_callback을 만들어 반환함.

    콜백 시그니처: async (context, params) -> ElicitResult 형태의 dict
      params.message         : 서버가 보낸 안내 문구
      params.requested_schema: 응답으로 채워야 할 JSON Schema (평면 객체)
    """
    round_no = {"n": 0}

    async def on_elicit(context, params):  # noqa: ANN001 - SDK가 넘겨주는 타입
        round_no["n"] += 1
        n = round_no["n"]
        schema = params.requested_schema
        # requested_schema는 pydantic 모델이 아니라 dict임.
        schema_dict = schema if isinstance(schema, dict) else schema.model_dump(by_alias=True)

        print(f"\n  [MRTR 라운드 {n}] 서버가 추가 입력을 요청함 (resultType=input_required)")
        print(f"    질문: {params.message}")
        print(f"    필요 필드: {list((schema_dict.get('properties') or {}).keys())}")

        if mode == "decline" and n == 3:
            print("    -> decline 반환 (사용자가 거절한 경우)")
            return {"action": "decline"}

        if mode == "interactive":
            content = _prompt_user(schema_dict)
        else:
            content = AUTO_ANSWERS[n - 1]

        print(f"    -> accept 반환: {content}")
        return {"action": "accept", "content": content}

    return on_elicit


async def main(mode: str) -> None:
    params = StdioServerParameters(command=sys.executable, args=[str(SERVER_SCRIPT)])

    async with Client(
        stdio_client(params),
        elicitation_callback=make_callback(mode),
        # MRTR 재요청 횟수 상한. 3단계이므로 기본값(10)으로 충분하지만 의미를 드러내기 위해 명시함.
        input_required_max_rounds=10,
    ) as client:
        print(f"서버 연결 완료: {client.server_info.name} / protocol={client.protocol_version}")

        # 도구 목록: Resolve로 채워지는 파라미터는 input schema에 나타나지 않음을 확인
        tools = await client.list_tools()
        print("\n=== 도구 목록 (Resolve 파라미터는 스키마에 없음) ===")
        for tool in tools.tools:
            props = list((tool.input_schema.get("properties") or {}).keys())
            print(f"  - {tool.name}: 입력 필드 {props}")

        print("\n=== plan_trip 호출 시작 (LLM이 채우는 인자는 traveler 하나뿐) ===")
        result = await client.call_tool("plan_trip", {"traveler": "홍길동"})

        print("\n=== 최종 결과 ===")
        print(f"  is_error: {result.is_error}")
        print(_text(result.content))


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "--auto"
    mode = {"--auto": "auto", "--interactive": "interactive", "--decline": "decline"}.get(arg)
    if mode is None:
        print("사용법: python client.py [--auto | --interactive | --decline]")
        sys.exit(1)
    asyncio.run(main(mode))
