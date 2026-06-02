"""여행 플래너 MCP 비대화형 테스트 클라이언트 (Elicitation E2E 검증)

input() 기반 대화형 client.py는 자동 검증이 어렵고, MCP Inspector/Claude Code는
elicitation을 미지원함. 이 테스트 클라이언트는 elicitation_callback이 미리 정해둔
'캔드(canned) 응답'을 자동 반환하도록 하여 3단계 elicit → 서버 검증 → LLM 일정 생성을
사람 개입 없이 실제로 실행·검증함.

[검증 시나리오 2종]
- 시나리오 A (정상): 모든 입력이 유효 → 한 번에 통과 → 일정 생성
- 시나리오 B (검증-재요청): 1차에 국가-도시 불일치(일본+파리)와 예산 미달(5일/30만원)을
  보내 서버가 거부 → 2차에 올바른 값(도쿄, 180만원)으로 재요청 → 통과 → 일정 생성
  ※ 서버의 비즈니스 검증과 재요청 루프가 실제로 동작함을 입증함
"""

import asyncio
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.types import ElicitResult

# Windows 기본 콘솔(cp949)은 이모지 등 일부 유니코드를 출력하지 못해 크래시함.
# LLM 일정에 이모지가 섞여도 안전하도록 표준 출력을 UTF-8로 재설정함.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

SERVER_PATH = Path(__file__).resolve().parent.parent / "server" / "travel_server.py"


def identify_step(field_names: set[str]) -> str:
    """요청 스키마의 필드 이름으로 어느 단계인지 식별함."""
    if "country" in field_names:
        return "destination"
    if "days" in field_names:
        return "trip"
    return "preferences"


def make_callback(script: dict[str, list[dict]]):
    """단계별 캔드 응답 목록(script)을 순서대로 반환하는 elicitation_callback을 생성함.

    같은 단계가 여러 번 호출되면(=서버가 검증 실패로 재요청하면) 다음 응답을 사용함.
    이로써 '1차 잘못된 값 → 2차 올바른 값' 재요청 흐름을 자동 재현함.
    """
    # 단계별 호출 횟수를 세어 응답 목록의 인덱스로 사용함.
    counters: dict[str, int] = {}

    async def callback(context, params) -> ElicitResult:
        schema = getattr(params, "requestedSchema", {}) or {}
        fields = set(schema.get("properties", {}).keys())
        step = identify_step(fields)

        idx = counters.get(step, 0)
        counters[step] = idx + 1
        answers = script[step]
        # 응답이 부족하면 마지막 응답을 재사용함 (인덱스 초과 방지).
        content = answers[min(idx, len(answers) - 1)]

        retry_mark = " (재요청)" if "검증 실패" in (params.message or "") else ""
        print(f"  [자동응답:{step}{retry_mark}] {content}")
        return ElicitResult(action="accept", content=content)

    return callback


async def logging_callback(params) -> None:
    """서버가 ctx.info()로 보낸 로그를 출력함 (검증 실패 로그 확인용)."""
    # params.data: 서버 ctx.info(...) 문자열, params.level: 로그 레벨
    print(f"  [서버로그] {params.data}")


async def run_scenario(title: str, script: dict[str, list[dict]]) -> str:
    """하나의 시나리오를 독립 세션으로 실행하고 도구 결과 텍스트를 반환함."""
    print(f"\n{'#' * 56}\n#  {title}\n{'#' * 56}")

    server_params = StdioServerParameters(
        command=sys.executable,
        args=[str(SERVER_PATH)],
    )
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(
            read,
            write,
            elicitation_callback=make_callback(script),  # 시나리오별 캔드 응답 콜백
            logging_callback=logging_callback,            # 서버 로그 수신
        ) as session:
            await session.initialize()
            result = await session.call_tool(
                "plan_trip",
                arguments={"request": "여행 계획을 세워주세요"},
            )
            texts = [item.text for item in result.content if hasattr(item, "text")]
            output = "\n".join(texts)
            print(output)
            return output


async def main():
    """정상 시나리오와 검증-재요청 시나리오를 순차 실행함."""
    # 시나리오 A: 모든 값이 유효함 → 재요청 없이 통과
    scenario_a = {
        "destination": [{"country": "일본", "city": "오사카"}],
        "trip": [{"days": 4, "budget": 150}],
        "preferences": [{"style": "맛집 탐방", "companion": "커플"}],
    }
    out_a = await run_scenario("시나리오 A: 정상 입력 (재요청 없음)", scenario_a)

    # 시나리오 B: 1차 잘못된 값(국가-도시 불일치 + 예산 미달) → 서버 거부 → 2차 정상값
    scenario_b = {
        "destination": [
            {"country": "일본", "city": "파리"},   # ← 일본에 파리: 명백한 불일치 (거부 예상)
            {"country": "일본", "city": "도쿄"},   # ← 재요청 시 올바른 값
        ],
        "trip": [
            {"days": 5, "budget": 30},   # ← 일본 5일 최소 60만원 미달 (거부 예상)
            {"days": 5, "budget": 180},  # ← 재요청 시 충분한 예산
        ],
        "preferences": [{"style": "관광/명소", "companion": "가족"}],
    }
    out_b = await run_scenario("시나리오 B: 검증 실패 → 재요청 → 통과", scenario_b)

    # --- 자동 판정: 두 시나리오 모두 '여행 계획서'가 생성되고 중단되지 않았는지 확인 ---
    print(f"\n{'=' * 56}\n  테스트 판정\n{'=' * 56}")
    ok_a = "여행 계획서" in out_a and "[중단]" not in out_a
    ok_b = "여행 계획서" in out_b and "[중단]" not in out_b
    print(f"  시나리오 A (정상)       : {'PASS' if ok_a else 'FAIL'}")
    print(f"  시나리오 B (검증→재요청) : {'PASS' if ok_b else 'FAIL'}")
    if ok_a and ok_b:
        print("\n  ✅ 전체 PASS: Elicitation 3단계 + 서버 검증 + LLM 일정 생성 정상 동작")
    else:
        print("\n  ❌ 일부 FAIL: 위 로그를 확인할 것")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
