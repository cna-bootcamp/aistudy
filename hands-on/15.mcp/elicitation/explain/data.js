window.EXPLAIN_DATA = {
  meta: { title: "MCP Elicitation — 서버가 사용자에게 역요청", entry: "client.py" },
  files: [
    { id: "client", label: "client.py", role: "MCP 클라이언트 — elicitation 콜백 등록 + JSON Schema를 CLI 폼으로 렌더링" },
    { id: "server", label: "travel_server.py", role: "여행 플래너 MCP 서버 — 3단계 Elicitation + 서버 검증 + LLM 일정 생성" }
  ],
  flow: [
    { step: 1, title: "서버 연결 + 콜백 등록", label: "콜백 등록", refs: ["elicitation_callback"], summary: "elicitation_callback을 ClientSession에 등록", detail: "콜백을 등록하면 클라이언트가 서버에 'Elicitation 기능을 지원합니다'라고 선언합니다." },
    { step: 2, title: "plan_trip 도구 호출", label: "도구 호출", refs: ["plan_trip"], summary: "call_tool('plan_trip') 실행", detail: "도구를 호출하면 서버가 일정 생성 전에 사용자에게 정보를 3번 역으로 요청합니다." },
    { step: 3, title: "Step 1: 목적지 요청", label: "목적지 요청", refs: ["elicit_with_validation", "pydantic_schemas", "elicitation_callback"], summary: "서버가 ctx.elicit()로 국가/도시 입력 요청", detail: "서버가 DestinationSchema(국가·도시)를 JSON Schema로 변환해 클라이언트에 전달합니다. 클라이언트의 콜백이 CLI 폼을 렌더링합니다." },
    { step: 4, title: "서버 비즈니스 검증", label: "서버 검증", refs: ["elicit_with_validation"], summary: "국가-도시 정합성·enum 방어 검증", detail: "클라이언트가 유효한 값을 보내도 서버가 교차필드 규칙(예: 일본+파리)을 검사합니다. 실패하면 오류 메시지를 붙여 재요청합니다." },
    { step: 5, title: "Step 2·3 반복", label: "기간·스타일 요청", refs: ["elicit_with_validation", "pydantic_schemas"], summary: "기간/예산 → 스타일/동행자 순서로 요청", detail: "각 단계마다 elicit → 서버 검증 → (실패 시 재요청) 루프를 최대 3번까지 반복합니다." },
    { step: 6, title: "LLM 일정 생성", label: "LLM 일정 생성", summary: "검증된 정보로 Groq LLM 호출 → 여행 계획서 반환", detail: "모든 단계가 통과되면 수집된 정보를 Groq LPU에 보내 일차별 여행 일정을 생성합니다." }
  ],
  functions: [
    {
      id: "elicitation_callback",
      name: "elicitation_callback()",
      fileId: "client",
      summary: "서버의 Elicitation 요청을 CLI 폼으로 렌더링하고 사용자 입력을 수집",
      how: "params.requestedSchema에서 필드를 꺼내 타입별로 다른 UI를 렌더링합니다. enum이면 번호 선택, number면 범위 검증, string이면 자유 입력입니다. 마지막에 ElicitResult(action='accept')로 서버에 반환합니다.",
      terms: ["elicitation_callback_type", "requestedSchema", "ElicitResult", "JSON_Schema_enum"],
      lines: [
        { at: "async def elicitation_callback(context, params) -> ElicitResult:", text: "서버의 ctx.elicit() 호출 시 자동 실행되는 콜백" },
        { at: "print(f\"  {params.message}\")", text: "서버가 ctx.elicit(message=...)로 보낸 안내 문구 출력" },
        { at: "schema = getattr(params, \"requestedSchema\", None)", text: "서버 Pydantic 모델이 변환된 JSON Schema dict 가져오기" },
        { at: "properties = schema.get(\"properties\", {})", text: "필드 정의 목록 추출 — {필드명: {type, enum, description, ...}}" },
        { at: "if enum_values:", text: "enum 타입이면 번호 선택 UI 렌더링" },
        { at: 'elif prop_type in ("number", "integer"):', text: "숫자 타입이면 범위 검증 UI 렌더링" },
        { at: 'return ElicitResult(action="accept", content=content)', text: "수집한 입력을 accept 상태로 서버에 반환" }
      ],
      code: `# (일부 발췌) — boolean 타입 분기·hint_parts 힌트 계산 생략
async def elicitation_callback(context, params) -> ElicitResult:
    """서버의 Elicitation 요청을 CLI 폼으로 렌더링하고 사용자 입력을 수집함."""
    print(f"\\n{'=' * 50}")
    print(f"  {params.message}")
    print(f"{'=' * 50}")
    print("  (입력 중 'q' 입력 시 취소)")

    schema = getattr(params, "requestedSchema", None)
    if not schema:
        answer = input("\\n  계속하시겠습니까? (y/n): ").strip().lower()
        if answer in ("n", "no", "아니오"):
            return ElicitResult(action="decline")
        return ElicitResult(action="accept", content={})

    properties = schema.get("properties", {})
    content: dict = {}

    for name, prop in properties.items():
        description = prop.get("description", name)
        prop_type = prop.get("type", "string")
        enum_values = prop.get("enum")
        default = prop.get("default")

        if enum_values:
            print(f"\\n  {description}:")
            for i, val in enumerate(enum_values, 1):
                print(f"    {i}. {val}")
            while True:
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

        elif prop_type in ("number", "integer"):
            minimum = prop.get("minimum")
            maximum = prop.get("maximum")
            while True:
                raw = input(f"  {description}: ").strip()
                if raw.lower() in ("q", "취소"):
                    return ElicitResult(action="cancel")
                if not raw and default is not None:
                    content[name] = default
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
        else:
            raw = input(f"\\n  {description}: ").strip()
            if raw.lower() in ("q", "취소"):
                return ElicitResult(action="cancel")
            content[name] = raw if raw else (default or "")

    return ElicitResult(action="accept", content=content)`
    },
    {
      id: "pydantic_schemas",
      name: "Schema 클래스들",
      fileId: "server",
      summary: "Pydantic 모델로 정의한 Elicitation 입력 스키마 3종",
      how: "Pydantic BaseModel을 상속하면 JSON Schema로 자동 변환됩니다. Field(ge=1, le=30)은 최솟값·최댓값을 지정하고, json_schema_extra={'enum': [...]}로 선택지를 제한합니다.",
      terms: ["pydantic_basemodel", "Field_ge_le", "json_schema_extra_enum"],
      lines: [
        { at: "class DestinationSchema(BaseModel):", text: "Step 1용 스키마 — 국가(enum)·도시(자유 입력)" },
        { at: 'country: str = Field(description="여행 국가", json_schema_extra={"enum": COUNTRIES})', text: "json_schema_extra로 enum 선택지를 JSON Schema에 추가" },
        { at: "class TripDetailsSchema(BaseModel):", text: "Step 2용 스키마 — 기간(1~30일)·예산(10만원~)" },
        { at: 'days: int = Field(description="여행 기간 (일수)", ge=1, le=30, default=3)', text: "ge(이상)/le(이하)가 JSON Schema의 minimum/maximum으로 변환됨" },
        { at: "class PreferencesSchema(BaseModel):", text: "Step 3용 스키마 — 스타일·동행자 (둘 다 enum)" }
      ],
      code: `class DestinationSchema(BaseModel):
    """Step 1: 여행 국가/도시 수집 스키마."""
    country: str = Field(description="여행 국가", json_schema_extra={"enum": COUNTRIES})
    city: str = Field(description="여행 도시 (예: 도쿄, 방콕, 파리)")


class TripDetailsSchema(BaseModel):
    """Step 2: 여행 기간/예산 수집 스키마."""
    days: int = Field(description="여행 기간 (일수)", ge=1, le=30, default=3)
    budget: int = Field(description="예산 (만원 단위, 1인 기준)", ge=10, default=100)


class PreferencesSchema(BaseModel):
    """Step 3: 여행 스타일/동행자 수집 스키마."""
    style: str = Field(description="여행 스타일", json_schema_extra={"enum": STYLES})
    companion: str = Field(description="동행자", json_schema_extra={"enum": COMPANIONS})`
    },
    {
      id: "elicit_with_validation",
      name: "elicit_with_validation()",
      fileId: "server",
      summary: "한 단계의 정보를 elicit → 서버 검증 → 실패 시 재요청하는 루프",
      how: "ctx.elicit()로 클라이언트에 입력을 요청하고, validator()로 비즈니스 규칙을 검사합니다. 검증 실패 시 오류 메시지를 앞에 붙여 다시 요청합니다. 무한루프 방지를 위해 최대 3번까지만 시도합니다.",
      terms: ["ctx_elicit", "ElicitOutcome", "MAX_RETRY"],
      lines: [
        { at: "for attempt in range(1, MAX_RETRY + 1):", text: "최대 MAX_RETRY(3)번까지 입력 재요청 — 무한루프 방지" },
        { at: "result = await ctx.elicit(message=current_message, schema=schema)", text: "★ Elicitation 핵심 — 서버→클라이언트로 구조화된 입력 요청" },
        { at: "if result.action != \"accept\" or result.data is None:", text: "사용자가 거절(decline) 또는 취소(cancel)하면 즉시 중단" },
        { at: "errors = validator(result.data)", text: "서버 비즈니스 검증 수행 (스키마가 못 막는 교차필드 규칙)" },
        { at: "if not errors:", text: "검증 통과 → 유효한 Pydantic 인스턴스 반환" },
        { at: 'return ElicitOutcome(False, reason="validation_failed")', text: "MAX_RETRY 초과 → 검증 실패로 종료" }
      ],
      code: `async def elicit_with_validation(
    ctx: Context[ServerSession, None],
    message: str,
    schema: type[BaseModel],
    validator,
) -> ElicitOutcome:
    """한 단계의 정보를 elicit → 서버 검증하고, 실패 시 오류를 붙여 재요청함."""
    current_message = message

    for attempt in range(1, MAX_RETRY + 1):
        result = await ctx.elicit(message=current_message, schema=schema)

        if result.action != "accept" or result.data is None:
            return ElicitOutcome(False, reason=result.action)

        errors = validator(result.data)
        if not errors:
            return ElicitOutcome(True, data=result.data)

        await ctx.info(f"[검증 실패 {attempt}/{MAX_RETRY}] {' / '.join(errors)}")
        current_message = (
            "⚠ 입력값 검증 실패:\\n- "
            + "\\n- ".join(errors)
            + f"\\n\\n다시 입력해 주세요.\\n\\n{message}"
        )

    return ElicitOutcome(False, reason="validation_failed")`
    },
    {
      id: "plan_trip",
      name: "plan_trip()",
      fileId: "server",
      summary: "3단계 Elicitation + 검증 + LLM 호출로 맞춤 여행 계획을 생성하는 MCP 도구",
      how: "elicit_with_validation()을 3번 호출해 목적지→기간/예산→스타일/동행자 순으로 정보를 수집합니다. 각 단계에서 step1.ok가 False이면 즉시 중단합니다. 모든 단계 통과 후 LLM으로 일정을 생성합니다.",
      terms: ["mcp_tool", "ctx_report_progress", "lambda"],
      lines: [
        { at: "@mcp.tool()", text: "이 함수를 MCP 도구로 등록" },
        { at: "await ctx.report_progress(1, 4)", text: "진행률 보고 (1/4) — 클라이언트가 UI에 표시할 수 있음" },
        { at: "step1 = await elicit_with_validation(", text: "Step 1: 목적지 수집 + 검증" },
        { at: "if not step1.ok:", text: "단계 중단(거절/취소/검증 실패) 시 즉시 종료" },
        { at: "lambda d: validate_trip_details(d, country)", text: "lambda로 country를 검증 함수에 주입 — 교차필드 검증(국가+예산)" },
        { at: "itinerary = generate_itinerary(country, city, days, budget, style, companion)", text: "모든 단계 통과 → Groq LLM으로 일정 생성" }
      ],
      code: `@mcp.tool()
async def plan_trip(
    request: str,
    ctx: Context[ServerSession, None],
) -> str:
    """사용자와 대화하며 맞춤형 여행 계획을 세움."""
    await ctx.report_progress(1, 4)
    step1 = await elicit_with_validation(
        ctx,
        "어디로 여행을 가고 싶으신가요? 국가와 도시를 선택해 주세요.",
        DestinationSchema,
        validate_destination,
    )
    if not step1.ok:
        return f"[중단] 목적지 단계에서 종료됨 (사유: {step1.reason})"
    country, city = step1.data.country, step1.data.city.strip()

    await ctx.report_progress(2, 4)
    step2 = await elicit_with_validation(
        ctx,
        f"{country} {city} 여행이군요! 여행 기간과 예산(1인)을 알려주세요.",
        TripDetailsSchema,
        lambda d: validate_trip_details(d, country),
    )
    if not step2.ok:
        return f"[중단] 기간/예산 단계에서 종료됨 (사유: {step2.reason})"
    days, budget = step2.data.days, step2.data.budget

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

    await ctx.report_progress(4, 4)
    await ctx.info("입력 검증 완료 → LLM으로 일정 생성 중...")
    itinerary = generate_itinerary(country, city, days, budget, style, companion)

    return (
        f"\\n{'=' * 50}\\n  여행 계획서\\n{'=' * 50}\\n"
        f"목적지 : {country} {city}\\n"
        f"기간   : {days}일\\n"
        f"예산   : {budget}만원 (1인)\\n"
        f"스타일 : {style}\\n"
        f"동행자 : {companion}\\n"
        f"{'=' * 50}\\n\\n{itinerary}"
    )`
    }
  ],
  glossary: {
    "elicitation_callback_type": "서버의 ctx.elicit() 호출 시 자동 실행되는 클라이언트 콜백 함수. ClientSession 생성 시 등록함",
    "requestedSchema": "서버 Pydantic 모델이 변환된 JSON Schema dict. 필드명·타입·enum·범위 정보를 담음",
    "ElicitResult": "Elicitation 콜백이 반환하는 타입. action(accept/decline/cancel) + content(입력값 dict) 포함",
    "JSON_Schema_enum": "JSON Schema의 enum 제약. 선택 가능한 값 목록을 배열로 지정함. 예: {'enum': ['일본', '태국']}",
    "pydantic_basemodel": "파이썬 데이터 유효성 검사 라이브러리. BaseModel 상속 시 JSON Schema 자동 생성 가능",
    "Field_ge_le": "Pydantic Field(ge=최솟값, le=최댓값) — JSON Schema의 minimum/maximum으로 자동 변환됨",
    "json_schema_extra_enum": "Field(json_schema_extra={'enum': [...]}) — Pydantic이 직접 지원하지 않는 enum 제약을 JSON Schema에 추가",
    "ctx_elicit": "ctx.elicit(message, schema) — 서버가 도구 실행 중 클라이언트에게 구조화된 입력을 역요청하는 MCP 기능",
    "ElicitOutcome": "elicit_with_validation()의 반환 래퍼. ok(성공 여부)·data(Pydantic 인스턴스)·reason(중단 사유) 포함",
    "MAX_RETRY": "검증 실패 시 재요청 최대 횟수(3). 무한루프를 방지하기 위한 상수",
    "mcp_tool": "LLM이 호출 여부를 결정하고 AI 앱이 실제 실행하는 함수. @mcp.tool()로 등록",
    "ctx_report_progress": "ctx.report_progress(current, total) — 도구 실행 진행률을 클라이언트에 보고",
    "lambda": "lambda 인자: 표현식 — 이름 없는 간단한 함수를 한 줄로 만드는 파이썬 문법"
  }
};
