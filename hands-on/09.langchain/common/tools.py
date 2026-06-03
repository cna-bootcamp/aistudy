"""여행 플래너 LangChain 예제에서 에이전트가 호출하는 도구 정의.

[08.function-call 대비 핵심 변경 사항]
  Before: TOOL_DEFINITIONS(JSON Schema) + execute_function() 화이트리스트 디스패처
  After : @tool 데코레이터로 함수를 도구로 변환 → LangChain이 스키마 자동 생성·실행
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import os
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote_plus

import requests
from dotenv import load_dotenv

# @tool: 이 데코레이터가 적용된 함수를 LangChain이 인식하는 '도구'로 변환함.
# 함수 시그니처와 docstring으로 LLM에 전달할 JSON 스키마를 자동 생성함.
from langchain_core.tools import tool

from prompts import DEFAULT_MAX_RESULTS


# ---------------------------------------------------------------------------
# 환경 변수 및 API 키
# ---------------------------------------------------------------------------

# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
HANDS_ON_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
# .env 파일에서 API 키 등 환경변수를 로드함
load_dotenv(HANDS_ON_ENV_PATH)

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")

CITY_NAME_MAP = {
    "서울": "Seoul",
    "도쿄": "Tokyo",
    "동경": "Tokyo",
    "파리": "Paris",
    "부산": "Busan",
    "제주": "Jeju",
    "제주도": "Jeju",
    "오사카": "Osaka",
    "교토": "Kyoto",
    "후쿠오카": "Fukuoka",
    "방콕": "Bangkok",
    "타이베이": "Taipei",
    "싱가포르": "Singapore",
    "뉴욕": "New York",
    "런던": "London",
    "로마": "Rome",
    "바르셀로나": "Barcelona",
    "홍콩": "Hong Kong",
    "상하이": "Shanghai",
}

PLACE_TYPE_LABELS = {
    "tourist_attraction": "대표 관광지",
    "museum": "박물관",
    "park": "공원",
    "restaurant": "레스토랑",
    "cafe": "카페",
    "bakery": "베이커리",
    "point_of_interest": "주요 장소",
    "establishment": "상업 시설",
}


# ---------------------------------------------------------------------------
# 내부 헬퍼 함수
# ---------------------------------------------------------------------------


def normalize_city_name(city: str) -> str:
    """한국어 또는 혼용 도시명을 API에서 사용하는 영문 도시명으로 변환하여 반환."""
    cleaned = (city or "").strip()
    if not cleaned:
        return cleaned
    if cleaned in CITY_NAME_MAP:
        return CITY_NAME_MAP[cleaned]
    return cleaned


def build_google_maps_search_url(place_name: str, city: str) -> str:
    """query 파라미터를 영문으로 구성한 Google Maps 검색 URL 반환."""
    city_en = normalize_city_name(city)
    query = quote_plus(f"{place_name} {city_en}".strip())
    return f"https://www.google.com/maps/search/?api=1&query={query}"


def _request_json(method: str, url: str, **kwargs: Any) -> dict[str, Any]:
    """짧은 타임아웃으로 HTTP 요청을 실행하고 파싱된 JSON 딕셔너리 반환."""
    response = requests.request(method, url, timeout=12, **kwargs)
    response.raise_for_status()
    return response.json()


def _compact_place(place: dict[str, Any], city: str) -> dict[str, Any]:
    """Google Places(New) 응답 필드를 모델 친화적인 형태로 변환하여 반환."""
    display_name = place.get("displayName", {}).get("text", "Unknown place")
    address = place.get("formattedAddress", "Address unavailable")
    editorial = place.get("editorialSummary", {}).get("text", "")
    types = place.get("types", [])[:4]
    type_hint = ", ".join(PLACE_TYPE_LABELS.get(item, item.replace("_", " ")) for item in types[:2])

    # 모델이 구글맵 URL을 직접 받아 한글 query 문자열을 생성하지 않도록 미리 구성함
    maps_url = build_google_maps_search_url(display_name, city)

    return {
        "name": display_name,
        "rating": place.get("rating", 0),
        "address": address,
        "description": editorial or f"{type_hint}로 분류되는 장소임",
        "types": types,
        "google_maps_url": maps_url,
    }


def _search_places(query: str, city: str, max_results: int) -> list[dict[str, Any]]:
    """Google Places Text Search(New) API를 호출하여 정규화된 장소 목록 반환."""
    if not GOOGLE_PLACES_API_KEY:
        raise RuntimeError(f"GOOGLE_PLACES_API_KEY가 설정되지 않았습니다: {HANDS_ON_ENV_PATH}")

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": (
            "places.displayName,places.formattedAddress,places.rating,"
            "places.types,places.editorialSummary"
        ),
    }
    body = {
        "textQuery": query,
        "languageCode": "en",
        "maxResultCount": max(1, min(max_results, 20)),
    }
    data = _request_json(
        "POST",
        "https://places.googleapis.com/v1/places:searchText",
        headers=headers,
        json=body,
    )
    return [_compact_place(place, city) for place in data.get("places", [])]


# ---------------------------------------------------------------------------
# LangChain 도구 함수
# ---------------------------------------------------------------------------


@tool
def get_weather(city: str) -> dict:
    """Get current weather for a city. Use this for weather-only requests or as part of a daily route plan."""
    if not OPENWEATHER_API_KEY:
        return {"error": f"OPENWEATHER_API_KEY가 설정되지 않았습니다: {HANDS_ON_ENV_PATH}"}

    city_en = normalize_city_name(city)
    params = {
        "q": city_en,
        "appid": OPENWEATHER_API_KEY,
        "units": "metric",
        "lang": "kr",
    }

    try:
        data = _request_json(
            "GET",
            "https://api.openweathermap.org/data/2.5/weather",
            params=params,
        )
        weather = data.get("weather", [{}])[0]
        main = data.get("main", {})
        wind = data.get("wind", {})
        return {
            "city": city_en,
            "weather": weather.get("main", ""),
            "description": weather.get("description", ""),
            "temperature": main.get("temp"),
            "feels_like": main.get("feels_like"),
            "humidity": main.get("humidity"),
            "wind_speed": wind.get("speed"),
        }
    except requests.exceptions.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else "unknown"
        return {"error": f"OpenWeatherMap HTTP 오류: {status_code}", "city": city_en}
    except requests.exceptions.RequestException as exc:
        return {"error": f"OpenWeatherMap 네트워크 오류: {exc}", "city": city_en}


@tool
def get_tourist_attractions(city: str, max_results: int = DEFAULT_MAX_RESULTS) -> dict:
    """Search top tourist attractions in a city with rating, address, short description, and Google Maps URL."""
    city_en = normalize_city_name(city)
    try:
        places = _search_places(f"top tourist attractions in {city_en}", city_en, max_results)
        return {
            "city": city_en,
            "attractions": places,
            "count": len(places),
        }
    except Exception as exc:
        return {"error": f"Google Places 관광지 검색 오류: {exc}", "city": city_en}


@tool
def get_restaurants(
    city: str,
    meal_type: Optional[str] = None,
    keyword: Optional[str] = None,
    max_results: int = DEFAULT_MAX_RESULTS,
) -> dict:
    """Search restaurants in a city. Use meal_type for breakfast, lunch, or dinner when useful."""
    city_en = normalize_city_name(city)
    query_parts = [part for part in [meal_type, keyword, "restaurants"] if part]
    query = " ".join(query_parts) + f" in {city_en}"

    try:
        places = _search_places(query, city_en, max_results)
        return {
            "city": city_en,
            "meal_type": meal_type,
            "keyword": keyword,
            "restaurants": places,
            "count": len(places),
        }
    except Exception as exc:
        return {"error": f"Google Places 맛집 검색 오류: {exc}", "city": city_en}


# 에이전트에 전달할 도구 목록. create_agent(llm, TRAVEL_TOOLS)에 직접 사용함.
TRAVEL_TOOLS = [get_weather, get_tourist_attractions, get_restaurants]
