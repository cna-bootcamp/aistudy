"""
여행 플래너 Function Calling 예제에서 LLM이 호출하는 외부 API 도구 구현.

OpenWeatherMap(날씨)과 Google Places(관광지·맛집) API를 호출하여 결과를 반환함.
LLM 요청에 의해 실행될 함수는 execute_function을 통해서만 호출됨.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

import requests
from dotenv import load_dotenv

from prompts import DEFAULT_MAX_RESULTS


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


def _request_json(method: str, url: str, **kwargs) -> dict[str, Any]:
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
    # (Places API는 영문으로 결과를 반환하므로 display_name이 영문 검색 쿼리로 적합함)
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


def get_weather(city: str) -> dict[str, Any]:
    """OpenWeatherMap Current Weather API로 도시 현재 날씨를 조회하여 반환."""
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


def get_tourist_attractions(city: str, max_results: int = DEFAULT_MAX_RESULTS) -> dict[str, Any]:
    """Google Places Text Search(New)로 도시 관광지를 검색하여 반환."""
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


def get_restaurants(
    city: str,
    meal_type: str | None = None,
    keyword: str | None = None,
    max_results: int = DEFAULT_MAX_RESULTS,
) -> dict[str, Any]:
    """Google Places Text Search(New)로 도시 맛집을 검색하여 반환."""
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


# LLM이 요청한 함수를 화이트리스트(허용 목록) 기반으로만 실행함
# (임의 함수 실행을 막아 코드 인젝션 등 보안 위협을 방지함)
def execute_function(function_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """LLM 도구 호출 요청에 따라 허용된 함수만 실행하여 결과 반환."""
    available_functions = {
        "get_weather": get_weather,
        "get_tourist_attractions": get_tourist_attractions,
        "get_restaurants": get_restaurants,
    }
    if function_name not in available_functions:
        return {"error": f"알 수 없는 함수임: {function_name}"}

    try:
        safe_arguments = dict(arguments or {})
        if "city" in safe_arguments:
            safe_arguments["city"] = normalize_city_name(str(safe_arguments["city"]))
        return available_functions[function_name](**safe_arguments)
    except TypeError as exc:
        return {"error": f"함수 인자 오류: {exc}"}
    except Exception as exc:
        return {"error": f"함수 실행 오류: {exc}"}
