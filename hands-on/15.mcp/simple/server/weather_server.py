"""날씨 조회 MCP 서버 (MCP Python SDK v2 / MCPServer + STDIO 전송)

외부 API 연동 도구를 보여주는 예제임.
  - 외부 API : wttr.in (무료, API 키 불필요)
               https://wttr.in/{도시}?format=j1  ->  JSON 형식 현재 날씨 + 3일 예보

도구 2종:
  - get_weather(city)        : 도시의 현재 날씨 조회
  - get_forecast(city, days) : 도시의 일별 예보 조회 (최대 3일)

[v1 -> v2 변경점]
  - from mcp.server.fastmcp import FastMCP  ->  from mcp.server.mcpserver import MCPServer, Context
  - mcp.get_context()                       ->  핸들러 파라미터로 ctx: Context 주입
  - httpx                                   ->  httpx2 (v2 SDK가 의존하는 차세대 httpx 포크)
  - mcp.run()                               ->  mcp.run(transport="stdio")

STDIO 전송에서는 stdout이 JSON-RPC 채널이므로 print() 금지. 로그는 stderr로만 출력함.
"""

from __future__ import annotations

import sys

import httpx2
from mcp.server.mcpserver import Context, MCPServer

mcp = MCPServer(
    "Weather",
    instructions="wttr.in을 이용해 도시별 현재 날씨와 예보를 제공하는 학습용 서버",
)

WTTR_BASE = "https://wttr.in"
TIMEOUT = 15.0


def _log(message: str) -> None:
    """STDIO 전송에서는 stdout을 쓸 수 없으므로 stderr로만 로그를 남김."""
    print(message, file=sys.stderr, flush=True)


async def _fetch_wttr(city: str) -> dict:
    """wttr.in에서 도시의 날씨 JSON을 가져옴.

    format=j1 은 wttr.in이 제공하는 JSON 출력 형식임(현재 날씨 + 3일 예보 포함).
    """
    url = f"{WTTR_BASE}/{city}"
    async with httpx2.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as http:
        response = await http.get(url, params={"format": "j1"})
        response.raise_for_status()
        return response.json()


@mcp.tool()
async def get_weather(city: str, ctx: Context) -> str:
    """도시 이름으로 현재 날씨를 조회함. 예: get_weather("Seoul")"""
    # Context는 v2에서 핸들러 파라미터로 주입받음 (v1의 mcp.get_context() 대체).
    # 2026-07-28은 stateless이므로 프로토콜 버전과 클라이언트 능력이 '요청마다' 실려 옴.
    # ctx로 그 값을 그대로 읽을 수 있음 — 세션에 저장된 값이 아님에 유의.
    #
    # 참고: ctx.info()/ctx.log()의 Logging 기능은 2026-07-28에서 폐기 예정(SEP-2577)이며
    #       호출 시 MCPDeprecationWarning이 발생함. 스펙 권고대로 stdio 서버는 stderr에 로그를 남김.
    _log(f"[weather] 요청 수신 city={city} protocol={ctx.protocol_version}")

    try:
        data = await _fetch_wttr(city)
    except httpx2.HTTPError as exc:
        # MCPError가 아닌 일반 예외는 결과의 is_error=True로 클라이언트에 전달됨.
        raise RuntimeError(f"날씨 조회 실패({city}): {exc}") from exc

    current = data["current_condition"][0]
    area = data["nearest_area"][0]
    area_name = area["areaName"][0]["value"]
    country = area["country"][0]["value"]
    description = current["weatherDesc"][0]["value"]

    _log(f"[weather] {city} -> {area_name}, {country}")

    return (
        f"{area_name}, {country} 현재 날씨\n"
        f"- 상태: {description}\n"
        f"- 기온: {current['temp_C']}°C (체감 {current['FeelsLikeC']}°C)\n"
        f"- 습도: {current['humidity']}%\n"
        f"- 풍속: {current['windspeedKmph']} km/h ({current['winddir16Point']})\n"
        f"- 관측 시각(UTC): {current['observation_time']}"
    )


@mcp.tool()
async def get_forecast(city: str, days: int = 3) -> str:
    """도시의 일별 예보를 조회함. days는 1~3만 유효함 (wttr.in 제공 범위)."""
    if not 1 <= days <= 3:
        raise ValueError("days는 1에서 3 사이여야 함 (wttr.in은 최대 3일 예보 제공).")

    try:
        data = await _fetch_wttr(city)
    except httpx2.HTTPError as exc:
        raise RuntimeError(f"예보 조회 실패({city}): {exc}") from exc

    area_name = data["nearest_area"][0]["areaName"][0]["value"]
    lines = [f"{area_name} {days}일 예보"]
    for day in data["weather"][:days]:
        # hourly는 3시간 간격 8개 구간이므로 인덱스 4가 정오 무렵임.
        desc = day["hourly"][4]["weatherDesc"][0]["value"]
        lines.append(
            f"- {day['date']}: {desc}, 최저 {day['mintempC']}°C / 최고 {day['maxtempC']}°C"
        )
    return "\n".join(lines)


if __name__ == "__main__":
    mcp.run(transport="stdio")
