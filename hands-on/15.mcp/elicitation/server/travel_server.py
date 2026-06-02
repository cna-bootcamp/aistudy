"""여행 플래너 MCP 서버 (Elicitation 예제)

MCP Elicitation으로 사용자에게 여행 정보를 3단계로 요청하고, 단계마다 서버가
입력값을 검증한 뒤 Groq LLM(openai/gpt-oss-120b)으로 맞춤 일정을 생성하는 서버임.

[핵심 개념]
- Elicitation: 서버가 도구 실행 도중 클라이언트(사용자)에게 구조화된 정보를 역으로 요청
- ctx.elicit(message, schema): Pydantic 모델 → JSON Schema 자동 변환 후 클라이언트에 전달
- 반환값은 Union 타입 (accept → data 보유 / decline / cancel)
- 서버측 비즈니스 검증: 스키마(타입·enum·범위)로 못 막는 교차필드 규칙을 서버가 직접 검사

[검증 2계층]
1) 스키마 검증(자동): 타입, enum 선택지, 숫자 범위
2) 서버 비즈니스 검증(명시): enum 방어 재확인, 국가-도시 정합성, 기간 대비 예산 타당성
   → 실패 시 오류 메시지를 붙여 같은 단계를 재요청 (무한루프 방지 위해 최대 횟수 제한)
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI                      # Groq는 OpenAI 호환 API를 제공함
from pydantic import BaseModel, Field          # Pydantic 모델 → JSON Schema 자동 변환

from mcp.server.fastmcp import Context, FastMCP  # FastMCP: MCP 서버 프레임워크
from mcp.server.session import ServerSession     # ServerSession: 서버 세션 타입 (Context 제네릭 인자)

# ---------------------------------------------------------------------------
# 환경 변수 로드 및 LLM 클라이언트 초기화
# ---------------------------------------------------------------------------

# Path(__file__).resolve()는 이 파일의 절대경로를 구함.
# parents[3]는 server → elicitation → 15.mcp → hands-on 순으로 3단계 상위 디렉터리임.
# 즉 hands-on/.env 경로를 가리킴 (server/ 하위로 한 단계 내려갔으므로 parents[3] 필요).
HANDS_ON_ENV = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(HANDS_ON_ENV)

# GROQ_API_KEY 미설정 시 실행 초기에 명확한 오류를 발생시켜 가짜 일정 생성을 방지함.
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError(
        f"GROQ_API_KEY가 설정되지 않음. {HANDS_ON_ENV} 파일을 확인할 것."
    )

# OpenAI SDK를 그대로 쓰되 base_url만 Groq 엔드포인트로 교체함.
llm = OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")

# Groq LPU에서 제공하는 OpenAI 호환 GPT-OSS 120B 모델
MODEL_NAME = "openai/gpt-oss-120b"

# FastMCP 서버 인스턴스 (서버 이름은 클라이언트 initialize 응답에 표시됨)
mcp = FastMCP("TravelPlanner")

# ---------------------------------------------------------------------------
# 선택지 상수 및 검증 기준 데이터
# ---------------------------------------------------------------------------

# enum 선택지를 상수로 분리 (스키마와 서버 검증이 같은 출처를 참조하도록 함)
COUNTRIES = [
    "일본", "태국", "베트남", "대만",
    "미국", "영국", "프랑스", "이탈리아", "스페인", "호주",
]
STYLES = ["맛집 탐방", "관광/명소", "쇼핑", "휴양/힐링", "액티비티/모험"]
COMPANIONS = ["혼자", "커플", "가족", "친구"]

# 국가별 대표 도시 (국가-도시 정합성 검증용). 목록에 없는 도시는 '미상'으로 보고 통과시킴.
KNOWN_CITIES = {
    "일본": ["도쿄", "오사카", "교토", "후쿠오카", "삿포로", "나고야", "오키나와"],
    "태국": ["방콕", "치앙마이", "푸켓", "파타야"],
    "베트남": ["하노이", "호치민", "다낭", "나트랑", "호이안"],
    "대만": ["타이베이", "가오슝", "타이중", "화롄"],
    "미국": ["뉴욕", "로스앤젤레스", "샌프란시스코", "라스베이거스", "하와이", "시애틀", "시카고"],
    "영국": ["런던", "맨체스터", "에든버러", "리버풀"],
    "프랑스": ["파리", "니스", "리옹", "마르세유"],
    "이탈리아": ["로마", "베네치아", "밀라노", "피렌체", "나폴리"],
    "스페인": ["바르셀로나", "마드리드", "세비야", "발렌시아"],
    "호주": ["시드니", "멜버른", "브리즈번", "케언즈", "골드코스트"],
}


def _normalize(text: str) -> str:
    """도시명 비교용 정규화 (공백 제거 + 소문자화)."""
    return text.replace(" ", "").lower()


# 도시 → 소속 국가 역방향 인덱스 (오기재 도시의 '명백한 불일치' 탐지에 사용)
CITY_TO_COUNTRY = {
    _normalize(city): country
    for country, cities in KNOWN_CITIES.items()
    for city in cities
}

# 국가 그룹별 왕복 항공료 최저선 (만원 단위, 1인 기준 대략값) — 예산 타당성 검증 기준
AIRFARE_FLOOR = {
    "일본": 35, "태국": 40, "베트남": 40, "대만": 35,   # 아시아 근거리
    "영국": 90, "프랑스": 90, "이탈리아": 90, "스페인": 90,  # 유럽
    "미국": 110, "호주": 110,                              # 장거리
}
# 1일 최소 체류 비용(만원). 항공료 + 기간×이 값을 예산 최저선으로 봄.
DAILY_FLOOR = 5

# ---------------------------------------------------------------------------
# Elicitation 스키마 정의 (Pydantic → JSON Schema 자동 변환)
# ---------------------------------------------------------------------------
# ※ Elicitation은 primitive 타입(str, int, float, bool, list[str])만 허용함.
#   Literal은 미지원이므로 enum 제약은 Field의 json_schema_extra로 지정함.


class DestinationSchema(BaseModel):
    """Step 1: 여행 국가/도시 수집 스키마."""

    # str 필드에 enum 제약을 추가 → JSON Schema의 {"enum": [...]}로 변환됨.
    country: str = Field(description="여행 국가", json_schema_extra={"enum": COUNTRIES})
    # 도시는 자유 입력 (국가별 도시가 매우 다양하므로 enum 대신 텍스트로 받음).
    city: str = Field(description="여행 도시 (예: 도쿄, 방콕, 파리)")


class TripDetailsSchema(BaseModel):
    """Step 2: 여행 기간/예산 수집 스키마."""

    # ge(이상)/le(이하)는 JSON Schema의 minimum/maximum으로 변환됨.
    days: int = Field(description="여행 기간 (일수)", ge=1, le=30, default=3)
    budget: int = Field(description="예산 (만원 단위, 1인 기준)", ge=10, default=100)


class PreferencesSchema(BaseModel):
    """Step 3: 여행 스타일/동행자 수집 스키마."""

    style: str = Field(description="여행 스타일", json_schema_extra={"enum": STYLES})
    companion: str = Field(description="동행자", json_schema_extra={"enum": COMPANIONS})


# ---------------------------------------------------------------------------
# 서버측 비즈니스 검증 함수 (스키마로 못 막는 교차필드 규칙)
# ---------------------------------------------------------------------------
# 각 검증 함수는 오류 메시지 리스트를 반환함 (빈 리스트 = 통과).


def validate_destination(data: DestinationSchema) -> list[str]:
    """국가/도시 정합성 검증.

    - enum 방어: 클라이언트가 스키마를 우회해 임의 국가를 보낼 수 있으므로 서버가 재확인함.
    - 도시 sanity: 공백/2글자 미만/숫자만 입력 차단.
    - 국가-도시 명백한 불일치: 도시가 '다른 국가'의 대표 도시로 알려진 경우 거부 (예: 일본+파리).
    """
    errors: list[str] = []

    if data.country not in COUNTRIES:
        errors.append(f"지원하지 않는 국가임: {data.country}")

    city = data.city.strip()
    if len(city) < 2:
        errors.append("도시명은 2글자 이상 입력해야 함")
    elif city.isdigit():
        errors.append("도시명에 숫자만 입력할 수 없음")
    else:
        # 입력 도시가 다른 국가의 대표 도시로 등록돼 있으면 명백한 불일치로 판단함.
        matched_country = CITY_TO_COUNTRY.get(_normalize(city))
        if matched_country and matched_country != data.country:
            errors.append(
                f"'{city}'는 {matched_country}의 도시임. "
                f"{data.country}의 도시를 입력할 것"
            )

    return errors


def validate_trip_details(data: TripDetailsSchema, country: str) -> list[str]:
    """기간 대비 예산 타당성 검증 (교차필드: 국가 + 기간 → 예산).

    항공료 최저선 + (기간 × 1일 최소 체류비) 보다 예산이 적으면 비현실적이라 판단해 거부함.
    """
    errors: list[str] = []

    airfare = AIRFARE_FLOOR.get(country, 40)
    min_budget = airfare + data.days * DAILY_FLOOR
    if data.budget < min_budget:
        errors.append(
            f"{country} {data.days}일 여행의 현실적 최소 예산은 약 {min_budget}만원임 "
            f"(항공료 {airfare} + 체류 {data.days}일×{DAILY_FLOOR}). "
            f"입력한 예산 {data.budget}만원으로는 일정 작성이 어려움"
        )

    return errors


def validate_preferences(data: PreferencesSchema) -> list[str]:
    """스타일/동행자 enum 방어 검증 (클라이언트 입력을 신뢰하지 않음)."""
    errors: list[str] = []
    if data.style not in STYLES:
        errors.append(f"지원하지 않는 스타일임: {data.style}")
    if data.companion not in COMPANIONS:
        errors.append(f"지원하지 않는 동행자 유형임: {data.companion}")
    return errors


# ---------------------------------------------------------------------------
# Elicitation + 검증 루프 헬퍼
# ---------------------------------------------------------------------------

# 검증 실패 시 같은 단계를 재요청하는 최대 횟수 (무한루프 방지)
MAX_RETRY = 3


class ElicitOutcome:
    """elicit_with_validation의 결과 래퍼.

    - ok: 검증까지 통과했는지 여부
    - data: 통과 시 검증된 Pydantic 인스턴스
    - reason: 중단 사유 ("declined"/"cancelled"/"validation_failed")
    """

    def __init__(self, ok: bool, data=None, reason: str = ""):
        self.ok = ok
        self.data = data
        self.reason = reason


async def elicit_with_validation(
    ctx: Context[ServerSession, None],
    message: str,
    schema: type[BaseModel],
    validator,
) -> ElicitOutcome:
    """한 단계의 정보를 elicit → 서버 검증하고, 실패 시 오류를 붙여 재요청함.

    처리 흐름:
    1. ctx.elicit(message, schema)로 클라이언트에 구조화된 입력을 요청
    2. action이 accept가 아니면(decline/cancel) 즉시 중단
    3. validator(data)로 서버 비즈니스 규칙 검사
    4. 오류가 있으면 오류 메시지를 message 앞에 붙여 다시 요청 (최대 MAX_RETRY회)
    """
    current_message = message

    for attempt in range(1, MAX_RETRY + 1):
        # ★ Elicitation 핵심: 서버 → 클라이언트로 입력 요청. 반환은 Union 타입임.
        result = await ctx.elicit(message=current_message, schema=schema)

        # accept가 아니면 사용자가 거절(decline) 또는 취소(cancel)한 것임.
        if result.action != "accept" or result.data is None:
            return ElicitOutcome(False, reason=result.action)

        # 서버측 비즈니스 검증 수행 (스키마가 못 막는 교차필드 규칙)
        errors = validator(result.data)
        if not errors:
            return ElicitOutcome(True, data=result.data)

        # 검증 실패 → 진행 로그 남기고 오류 안내를 덧붙여 재요청 준비
        await ctx.info(f"[검증 실패 {attempt}/{MAX_RETRY}] {' / '.join(errors)}")
        current_message = (
            "⚠ 입력값 검증 실패:\n- "
            + "\n- ".join(errors)
            + f"\n\n다시 입력해 주세요.\n\n{message}"
        )

    # MAX_RETRY회 모두 검증 실패
    return ElicitOutcome(False, reason="validation_failed")


# ---------------------------------------------------------------------------
# LLM 일정 생성
# ---------------------------------------------------------------------------


def generate_itinerary(
    country: str, city: str, days: int, budget: int, style: str, companion: str
) -> str:
    """수집·검증된 정보로 Groq LLM을 호출해 일차별 여행 일정을 생성함.

    gpt-oss 계열은 간헐적으로 빈 응답을 줄 수 있어 최대 2회까지 재시도함.
    """
    prompt = (
        "다음 조건에 맞는 여행 일정을 한국어로 작성해 주세요.\n\n"
        "조건:\n"
        f"- 국가: {country}\n"
        f"- 도시: {city}\n"
        f"- 기간: {days}일\n"
        f"- 예산: {budget}만원 (1인, 한화)\n"
        f"- 스타일: {style}\n"
        f"- 동행자: {companion}\n\n"
        "일차별로 구체적인 일정(장소, 활동, 예상 비용)을 포함하고,\n"
        "마지막에 총 예상 비용 요약을 추가해 주세요."
    )

    last_error = ""
    for _ in range(2):
        try:
            response = llm.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {
                        "role": "system",
                        "content": "당신은 전문 여행 플래너임. 실용적이고 구체적인 일정을 작성함.",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=2048,
            )
            # response.choices[0].message.content: 응답 후보 중 첫 번째의 본문 텍스트
            content = (response.choices[0].message.content or "").strip()
            if content:
                return content
        except Exception as e:  # 네트워크/인증 오류 등을 메시지로 노출
            last_error = str(e)

    return f"(일정 생성 실패: {last_error or '빈 응답'}) 잠시 후 다시 시도해 주세요."


# ---------------------------------------------------------------------------
# Tool: 여행 계획 생성 (3단계 Elicitation + 검증 + LLM 호출)
# ---------------------------------------------------------------------------


@mcp.tool()  # @mcp.tool(): 이 함수를 클라이언트가 call_tool()로 호출 가능한 MCP 도구로 등록함
async def plan_trip(
    request: str,                         # 도구 호출 트리거 (자유 텍스트)
    ctx: Context[ServerSession, None],    # MCP 컨텍스트 → elicit(), info(), report_progress() 제공
) -> str:
    """사용자와 대화하며 맞춤형 여행 계획을 세움.

    3단계 Elicitation(목적지 → 기간/예산 → 스타일/동행자)으로 정보를 수집하고,
    각 단계에서 서버가 입력값을 검증한 뒤 Groq LLM으로 일정을 생성함.
    """
    # --- Step 1: 목적지 수집 + 검증 ---
    await ctx.report_progress(1, 4)  # 진행률 보고 (1/4)
    step1 = await elicit_with_validation(
        ctx,
        "어디로 여행을 가고 싶으신가요? 국가와 도시를 선택해 주세요.",
        DestinationSchema,
        validate_destination,
    )
    if not step1.ok:
        return f"[중단] 목적지 단계에서 종료됨 (사유: {step1.reason})"
    country, city = step1.data.country, step1.data.city.strip()

    # --- Step 2: 기간/예산 수집 + 검증 (국가 기준 예산 타당성 교차검증) ---
    await ctx.report_progress(2, 4)
    step2 = await elicit_with_validation(
        ctx,
        f"{country} {city} 여행이군요! 여행 기간과 예산(1인)을 알려주세요.",
        TripDetailsSchema,
        lambda d: validate_trip_details(d, country),  # country를 검증에 주입
    )
    if not step2.ok:
        return f"[중단] 기간/예산 단계에서 종료됨 (사유: {step2.reason})"
    days, budget = step2.data.days, step2.data.budget

    # --- Step 3: 스타일/동행자 수집 + 검증 ---
    await ctx.report_progress(3, 4)
    step3 = await elicit_with_validation(
        ctx,
        f"{days}일간 예산 {budget}만원으로 계획하겠습니다. 여행 스타일과 동행자를 알려주세요.",
        PreferencesSchema,
        validate_preferences,
    )
    if not step3.ok:
        return f"[중단] 스타일/동행자 단계에서 종료됨 (사유: {step3.reason})"
    style, companion = step3.data.style, step3.data.companion

    # --- Step 4: 검증 통과 정보로 LLM 일정 생성 ---
    await ctx.report_progress(4, 4)
    await ctx.info("입력 검증 완료 → LLM으로 일정 생성 중...")
    itinerary = generate_itinerary(country, city, days, budget, style, companion)

    # 수집·검증한 요약 + LLM 생성 일정을 합쳐 반환함.
    return (
        f"\n{'=' * 50}\n  여행 계획서\n{'=' * 50}\n"
        f"목적지 : {country} {city}\n"
        f"기간   : {days}일\n"
        f"예산   : {budget}만원 (1인)\n"
        f"스타일 : {style}\n"
        f"동행자 : {companion}\n"
        f"{'=' * 50}\n\n{itinerary}"
    )


# if __name__ == "__main__": 이 파일을 직접 실행할 때만 아래를 수행함 (import 시 미실행).
if __name__ == "__main__":
    # STDIO 전송 모드로 서버 실행. 클라이언트가 이 스크립트를 자식 프로세스로 띄워
    # stdin/stdout으로 JSON-RPC 메시지를 주고받음.
    mcp.run()
