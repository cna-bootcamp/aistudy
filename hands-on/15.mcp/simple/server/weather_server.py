"""날씨 조회 MCP 서버 (FastMCP + STDIO 전송)

외부 API Open-Meteo(무료, API 키 불필요)와 연동하는 비동기 MCP 서버 예제임.
도시 이름 → 위경도(Geocoding API) → 현재 날씨/예보(Forecast API)의 2단계로 조회함.

  - Tools : get_weather(현재 날씨), get_forecast(일별 예보)
  - 호출 API
    - Geocoding : https://geocoding-api.open-meteo.com/v1/search  (도시명 → 위경도)
    - Forecast  : https://api.open-meteo.com/v1/forecast          (위경도 → 날씨)

STDIO 전송에서는 stdout이 JSON-RPC 채널이므로 print() 등 stdout 출력 금지.
"""
from mcp.server.fastmcp import FastMCP

# httpx: 동기/비동기를 모두 지원하는 HTTP 클라이언트. 여기서는 async 방식으로 사용함.
import httpx

mcp = FastMCP("Weather")

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

# WMO 날씨 코드 → 한국어 설명 매핑. Open-Meteo는 날씨를 숫자 코드(weather_code)로 반환함.
# 참고: https://open-meteo.com/en/docs (WMO Weather interpretation codes)
WMO_CODE: dict[int, str] = {
    0: "맑음",
    1: "대체로 맑음",
    2: "부분적으로 흐림",
    3: "흐림",
    45: "안개",
    48: "서리 안개",
    51: "약한 이슬비",
    53: "이슬비",
    55: "강한 이슬비",
    56: "약한 어는 이슬비",
    57: "강한 어는 이슬비",
    61: "약한 비",
    63: "비",
    65: "강한 비",
    66: "약한 어는 비",
    67: "강한 어는 비",
    71: "약한 눈",
    73: "눈",
    75: "강한 눈",
    77: "싸락눈",
    80: "약한 소나기",
    81: "소나기",
    82: "강한 소나기",
    85: "약한 소낙눈",
    86: "강한 소낙눈",
    95: "뇌우",
    96: "약한 우박 동반 뇌우",
    99: "강한 우박 동반 뇌우",
}


# ---------------------------------------------------------------------------
# 내부 헬퍼
# ---------------------------------------------------------------------------

async def _geocode(client: httpx.AsyncClient, city: str) -> dict | None:
    """도시 이름을 Open-Meteo Geocoding API로 위경도 등 좌표 정보로 변환함.

    결과가 없으면 None을 반환함. 반환 dict에는 latitude/longitude/name/country가 들어 있음.
    """
    resp = await client.get(
        GEOCODING_URL,
        params={"name": city, "count": 1, "language": "ko", "format": "json"},
        timeout=10.0,
    )
    resp.raise_for_status()
    # 검색 결과가 없으면 응답에 "results" 키 자체가 없음. get()으로 안전하게 접근함.
    results = resp.json().get("results")
    if not results:
        return None
    return results[0]


def _describe(code: int) -> str:
    """WMO 날씨 코드를 한국어 설명으로 변환함. 미정의 코드는 코드 번호를 그대로 표기함."""
    return WMO_CODE.get(code, f"알 수 없음(코드 {code})")


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

# @mcp.tool(): 함수를 MCP 도구로 등록함. async 함수도 그대로 도구로 등록 가능함.
@mcp.tool()
async def get_weather(city: str) -> str:
    """도시의 현재 날씨를 조회함.

    Args:
        city: 도시 이름 (예: Seoul, 서울, Tokyo, London)
    """
    # async with: 블록을 벗어나면 HTTP 연결이 자동으로 정리됨.
    async with httpx.AsyncClient() as client:
        try:
            location = await _geocode(client, city)
            if location is None:
                return f"'{city}' 도시를 찾을 수 없습니다."

            resp = await client.get(
                FORECAST_URL,
                params={
                    "latitude": location["latitude"],
                    "longitude": location["longitude"],
                    "current": (
                        "temperature_2m,relative_humidity_2m,"
                        "apparent_temperature,weather_code,wind_speed_10m"
                    ),
                    # timezone=auto: 해당 좌표의 현지 시각 기준으로 결과를 반환함.
                    "timezone": "auto",
                },
                timeout=10.0,
            )
            resp.raise_for_status()
            current = resp.json()["current"]

            name = location.get("name", city)
            country = location.get("country", "")
            return (
                f"도시: {name} ({country})\n"
                f"시각: {current['time']}\n"
                f"날씨: {_describe(current['weather_code'])}\n"
                f"온도: {current['temperature_2m']}°C\n"
                f"체감: {current['apparent_temperature']}°C\n"
                f"습도: {current['relative_humidity_2m']}%\n"
                f"풍속: {current['wind_speed_10m']}km/h"
            )
        except httpx.HTTPStatusError as e:
            return f"날씨 조회 실패: HTTP {e.response.status_code}"
        except Exception as e:
            return f"날씨 조회 실패: {e}"


@mcp.tool()
async def get_forecast(city: str, days: int = 3) -> str:
    """도시의 일별 날씨 예보를 조회함.

    Args:
        city: 도시 이름
        days: 예보 일수 (1~7, 기본값 3)
    """
    # 입력값을 1~7 범위로 보정함 (Open-Meteo의 forecast_days 허용 범위).
    days = min(max(days, 1), 7)
    async with httpx.AsyncClient() as client:
        try:
            location = await _geocode(client, city)
            if location is None:
                return f"'{city}' 도시를 찾을 수 없습니다."

            resp = await client.get(
                FORECAST_URL,
                params={
                    "latitude": location["latitude"],
                    "longitude": location["longitude"],
                    "daily": "weather_code,temperature_2m_max,temperature_2m_min",
                    "forecast_days": days,
                    "timezone": "auto",
                },
                timeout=10.0,
            )
            resp.raise_for_status()
            daily = resp.json()["daily"]

            name = location.get("name", city)
            lines = [f"=== {name} {days}일 예보 ==="]
            # zip으로 날짜·최고·최저·코드 4개 리스트를 같은 인덱스끼리 묶어 순회함.
            for date, tmax, tmin, code in zip(
                daily["time"],
                daily["temperature_2m_max"],
                daily["temperature_2m_min"],
                daily["weather_code"],
            ):
                lines.append(
                    f"\n날짜: {date}\n"
                    f"  날씨: {_describe(code)}\n"
                    f"  최고: {tmax}°C / 최저: {tmin}°C"
                )
            return "\n".join(lines)
        except Exception as e:
            return f"예보 조회 실패: {e}"


# 이 파일을 직접 실행할 때만 서버를 구동함 (import 시에는 실행되지 않음).
if __name__ == "__main__":
    mcp.run()
