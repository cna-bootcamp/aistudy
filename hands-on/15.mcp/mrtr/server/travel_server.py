"""여행 플래너 MCP 서버 — MRTR(Multi Round-Trip Requests) 실습

MCP 2026-07-28에서 서버는 클라이언트에게 '역방향 JSON-RPC 요청'을 보낼 수 없음.
추가 입력이 필요하면 `resultType: "input_required"`인 InputRequiredResult를 반환하고,
클라이언트가 입력을 담아 **원 요청을 다시 보내는** 것이 MRTR 패턴임.

이 서버는 여행 계획에 필요한 정보를 3단계로 나누어 물어봄.
  1단계) 여행지   : 국가 / 도시
  2단계) 기간·예산 : 며칠 / 총예산(만원)     ← 1단계 답을 알아야 질문을 만들 수 있음
  3단계) 스타일    : 여행 스타일 / 동행자 수  ← 2단계 답을 알아야 질문을 만들 수 있음

각 단계가 앞 단계의 답에 의존하므로 한 번에 묶어 물을 수 없고,
**InputRequiredResult가 3회 발생 + 클라이언트 재요청이 3회 발생**함.

[핵심 구현]
  - Resolve(fn) : 파라미터를 LLM 인자가 아니라 리졸버 함수로 채움.
                  Resolve로 선언한 파라미터는 도구의 input schema에 노출되지 않으므로
                  LLM이 값을 지어낼 수 없음.
  - Elicit(msg, schema) : 리졸버가 "이건 사용자에게 물어봐야 한다"고 알리는 마커.
  - RequestStateSecurity : 라운드 간 상태를 담는 requestState를 AES-256-GCM으로
                  봉인/검증함. 스펙이 요구하는 무결성 보호·만료·요청 바인딩을 프레임워크가 수행함.

STDIO 전송이므로 stdout 출력 금지. 로그는 stderr로만 남김.
"""

from __future__ import annotations

import os
import sys
from typing import Annotated, Literal

from mcp.server.mcpserver import (
    AcceptedElicitation,
    Context,
    Elicit,
    ElicitationResult,
    MCPServer,
    Resolve,
)
from mcp.server.request_state import RequestStateSecurity
from pydantic import BaseModel, Field


def _log(message: str) -> None:
    """STDIO에서 stdout은 JSON-RPC 채널이므로 로그는 stderr로만 출력함."""
    print(message, file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------
# requestState 보호 정책
# ---------------------------------------------------------------------------
# 스펙: 서버는 클라이언트가 되돌려주는 requestState를 '공격자 통제 입력'으로 취급해야 하며,
#       인가/자원접근/비즈니스 로직에 영향을 준다면 HMAC 또는 AEAD로 무결성을 보호해야 함.
# SDK: RequestStateSecurity(keys=[...])를 주면 AES-256-GCM으로 봉인하고,
#      만료(ttl)·요청 바인딩·audience·principal 검증까지 프레임워크가 대신 수행함.
_KEY = os.environ.get("MCP_REQUEST_STATE_KEY")
if _KEY:
    # 운영 환경: 고정 키를 주입해야 서버 인스턴스가 여러 대여도 서로의 상태를 풀 수 있음.
    request_state_security = RequestStateSecurity(keys=[_KEY], ttl=300.0)
    _log("[travel] requestState 보호: 고정 키(AES-256-GCM), ttl=300s")
else:
    # 학습/단일 프로세스용: 프로세스 로컬 임시 키.
    # 프로세스를 재시작하면 이전 requestState는 검증에 실패함(= 재전송 공격 방어와 동일 효과).
    request_state_security = RequestStateSecurity.ephemeral()
    _log("[travel] requestState 보호: 임시 키(ephemeral). 운영에서는 MCP_REQUEST_STATE_KEY 사용 권장")

mcp = MCPServer(
    "TravelPlanner",
    instructions="여행 계획에 필요한 정보를 단계별로 물어보고 일정을 생성하는 서버",
    request_state_security=request_state_security,
)


# ---------------------------------------------------------------------------
# 각 단계에서 사용자에게 받을 입력 스키마
# ---------------------------------------------------------------------------
# 주의: form 모드 elicitation 스키마는 '평면 객체 + 원시 타입'만 허용됨.
#       중첩 객체나 객체 배열은 스펙상 사용할 수 없음.
class Destination(BaseModel):
    """1단계: 여행지"""

    country: str = Field(description="여행할 국가 (예: 일본)")
    city: str = Field(description="여행할 도시 (예: 오사카)")


class Budget(BaseModel):
    """2단계: 기간과 예산"""

    days: int = Field(ge=1, le=30, description="여행 기간(일)")
    budget_manwon: int = Field(ge=10, le=5000, description="1인 총예산(만원)")


class Style(BaseModel):
    """3단계: 여행 스타일과 동행자"""

    style: Literal["휴양", "관광", "미식", "액티비티"] = Field(description="여행 스타일")
    companions: int = Field(ge=0, le=10, description="동행자 수(본인 제외)")


# ---------------------------------------------------------------------------
# 리졸버 — 앞 단계 결과에 의존하므로 라운드가 순차로 나뉨
# ---------------------------------------------------------------------------
async def ask_destination() -> Elicit[Destination]:
    """1단계 질문. 의존성이 없으므로 첫 라운드에 바로 발송됨."""
    _log("[travel] 1단계 질문 생성: 여행지")
    return Elicit("어느 국가, 어느 도시로 여행하시나요?", Destination)


async def ask_budget(
    destination: Annotated[Destination, Resolve(ask_destination)],
) -> Elicit[Budget]:
    """2단계 질문. 질문 문구에 1단계 답이 들어가므로 1단계가 끝나야 만들 수 있음."""
    _log(f"[travel] 2단계 질문 생성: {destination.city} 기간·예산")
    return Elicit(
        f"{destination.country} {destination.city} 여행의 기간(일)과 1인 예산(만원)을 알려주세요.",
        Budget,
    )


async def ask_style(
    budget: Annotated[Budget, Resolve(ask_budget)],
) -> Elicit[Style]:
    """3단계 질문. 2단계 답에 의존하므로 다시 한 라운드가 더 필요함."""
    _log(f"[travel] 3단계 질문 생성: {budget.days}일 일정 스타일")
    return Elicit(
        f"{budget.days}일 일정의 여행 스타일과 동행자 수를 알려주세요.",
        Style,
    )


# ---------------------------------------------------------------------------
# 일정 생성 (LLM 없이 규칙 기반 — 실습의 초점은 MRTR 프로토콜임)
# ---------------------------------------------------------------------------
_ACTIVITY: dict[str, list[str]] = {
    "휴양": ["호텔 조식 후 늦은 기상", "스파·온천", "해변/공원 산책", "루프탑 바"],
    "관광": ["랜드마크 투어", "박물관·미술관", "구시가지 도보 여행", "야경 명소"],
    "미식": ["현지 시장 아침", "미슐랭/로컬 맛집 점심", "디저트 카페", "이자카야·펍 저녁"],
    "액티비티": ["트레킹", "자전거 투어", "수상 레저", "야간 러닝"],
}


def _build_itinerary(dest: Destination, budget: Budget, style: Style) -> str:
    per_day = budget.budget_manwon / budget.days
    people = style.companions + 1
    plans = _ACTIVITY[style.style]

    lines = [
        f"=== {dest.country} {dest.city} {budget.days}일 여행 일정 ===",
        f"- 스타일 : {style.style}",
        f"- 인원   : {people}명 (동행 {style.companions}명)",
        f"- 예산   : 1인 {budget.budget_manwon}만원 (1일 약 {per_day:.1f}만원)",
        f"- 총예산 : {budget.budget_manwon * people}만원",
        "",
    ]
    for day in range(1, budget.days + 1):
        activity = plans[(day - 1) % len(plans)]
        lines.append(f"[{day}일차] {activity}")
    lines.append("")
    lines.append("※ 본 일정은 학습용 규칙 기반 생성 결과임.")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 도구
# ---------------------------------------------------------------------------
@mcp.tool()
async def plan_trip(
    traveler: str,
    destination: Annotated[Destination, Resolve(ask_destination)],
    budget: Annotated[Budget, Resolve(ask_budget)],
    style: Annotated[ElicitationResult[Style], Resolve(ask_style)],
    ctx: Context,
) -> str:
    """여행 일정을 만듦. 필요한 정보는 사용자에게 단계별로 물어봄.

    LLM이 채우는 인자는 traveler 하나뿐임.
    destination/budget/style은 Resolve로 채워지므로 input schema에 나타나지 않음.
    """
    # Annotated[Destination, ...]처럼 모델 타입을 그대로 쓰면 accept된 값이 바로 주입되고,
    # decline/cancel이면 도구 호출 자체가 중단됨.
    # 반대로 Annotated[ElicitationResult[Style], ...]처럼 쓰면 accept/decline/cancel을 직접 분기할 수 있음.
    if not isinstance(style, AcceptedElicitation):
        _log(f"[travel] 3단계 거절/취소: {type(style).__name__}")
        return "여행 스타일 입력이 취소되어 일정을 생성하지 못했습니다."

    _log(f"[travel] 모든 입력 수집 완료 (protocol={ctx.protocol_version})")
    return f"{traveler}님을 위한 일정입니다.\n\n" + _build_itinerary(
        destination, budget, style.data
    )


@mcp.tool()
def echo_protocol(ctx: Context) -> str:
    """이 요청의 프로토콜 버전과 클라이언트 능력을 그대로 돌려줌 (stateless 확인용)."""
    return (
        f"protocol_version={ctx.protocol_version}\n"
        f"client_capabilities={ctx.client_capabilities}"
    )


if __name__ == "__main__":
    mcp.run(transport="stdio")
