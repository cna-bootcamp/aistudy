window.EXPLAIN_DATA = {
  meta: { title: "MCP 기본 예제 — 계산기 + 날씨 서버", entry: "client.py" },
  files: [
    { id: "calc", label: "calc_server.py", role: "계산기 MCP 서버 — Tools·Resources·Prompts 3대 프리미티브 구현" },
    { id: "weather", label: "weather_server.py", role: "날씨 MCP 서버 — 비동기 도구·외부 API(Open-Meteo) 연동" },
    { id: "client", label: "client.py", role: "MCP 클라이언트 — 서버 연결 후 Tools·Resources·Prompts 호출 데모" }
  ],
  flow: [
    { step: 1, title: "서버 프로세스 실행", label: "서버 프로세스 실행", summary: "calc_server.py를 자식 프로세스로 실행", detail: "전화를 거는 것처럼 클라이언트가 서버를 직접 켜고 stdin/stdout 파이프로 연결합니다. 서버를 따로 실행할 필요가 없어요." },
    { step: 2, title: "연결 초기화", label: "연결 초기화", summary: "session.initialize()로 프로토콜 버전·기능 교환", detail: "악수처럼 클라이언트와 서버가 서로 지원하는 기능(capability)을 교환합니다. 이 단계 이후에만 도구 호출이 가능합니다." },
    { step: 3, title: "목록 조회", label: "목록 조회", summary: "list_tools / list_resources / list_prompts 확인", detail: "메뉴판을 받는 것처럼, 서버가 어떤 도구·리소스·프롬프트를 제공하는지 확인합니다." },
    { step: 4, title: "도구 호출", label: "도구 호출", refs: ["tool_add", "tool_divide"], summary: "call_tool('add'), call_tool('divide') 실행", detail: "서버의 함수를 원격으로 호출합니다. LLM이 어떤 도구를 쓸지 결정하고, AI 앱(클라이언트)이 실제로 호출합니다." },
    { step: 5, title: "리소스 읽기", label: "리소스 읽기", refs: ["resource_history"], summary: "read_resource('calc://history') 조회", detail: "calc://history라는 URI로 계산 이력을 읽어옵니다. URL로 파일을 여는 것처럼 URI로 데이터를 가져옵니다." },
    { step: 6, title: "프롬프트 조회", label: "프롬프트 조회", refs: ["prompt_math"], summary: "get_prompt('math_prompt') 조회", detail: "수학 문제를 단계별로 풀도록 유도하는 프롬프트 템플릿을 받아옵니다. LLM 실행이 아니라 프롬프트 문자열 자체를 반환합니다." }
  ],
  functions: [
    {
      id: "server_setup",
      name: "서버 초기화",
      fileId: "calc",
      summary: "FastMCP 서버 인스턴스와 계산 이력 저장소를 준비함",
      how: "FastMCP('Calculator')는 'Calculator'라는 이름의 MCP 서버 객체를 만듭니다. history 리스트는 계산할 때마다 기록이 쌓이는 메모장 역할을 합니다.",
      terms: ["FastMCP", "JSON_Schema"],
      lines: [
        { at: 'mcp = FastMCP("Calculator")', text: "서버 인스턴스 생성 — 이름 'Calculator'는 클라이언트 연결 시 표시됨" },
        { at: "history: list[str] = []", text: "계산 이력을 담는 빈 리스트 — 도구 실행마다 한 줄씩 추가됨" }
      ],
      code: `mcp = FastMCP("Calculator")

history: list[str] = []`
    },
    {
      id: "tool_add",
      name: "add()",
      fileId: "calc",
      summary: "두 수를 더하는 MCP 도구 — @mcp.tool() 등록 기본 패턴",
      how: "@mcp.tool() 데코레이터가 이 함수를 MCP 도구로 등록합니다. 타입 힌트(a: float, b: float)와 docstring이 자동으로 JSON Schema로 변환되어 클라이언트에 전달됩니다.",
      terms: ["mcp_tool", "JSON_Schema", "docstring"],
      lines: [
        { at: "@mcp.tool()", text: "이 함수를 MCP 도구로 등록하는 데코레이터 — 타입 힌트·docstring을 JSON Schema로 자동 변환" },
        { at: "def add(a: float, b: float) -> float:", text: "타입 힌트(float)가 LLM에게 전달되는 입력 명세서가 됨" },
        { at: "result = a + b", text: "실제 덧셈 수행" },
        { at: 'history.append(f"{a} + {b} = {result}")', text: "이력 목록에 계산식 추가 — 나중에 리소스로 조회 가능" },
        { at: "return result", text: "계산 결과를 MCP 응답으로 반환" }
      ],
      code: `@mcp.tool()
def add(a: float, b: float) -> float:
    """두 수를 더함."""
    result = a + b
    history.append(f"{a} + {b} = {result}")
    return result`
    },
    {
      id: "tool_divide",
      name: "divide()",
      fileId: "calc",
      summary: "0 나눗셈을 방어하는 MCP 도구 — 예외 처리 패턴",
      how: "0으로 나누면 ValueError를 발생시킵니다. MCP는 도구에서 발생한 예외를 isError=True로 표시해 클라이언트에 전달하므로 서버 전체가 멈추지 않습니다.",
      terms: ["mcp_tool", "isError", "ValueError"],
      lines: [
        { at: "def divide(a: float, b: float) -> float:", text: "나눗셈 도구 — 나누는 수(b)가 0인지 먼저 확인함" },
        { at: "if b == 0:", text: "0으로 나누면 수학적으로 정의되지 않으므로 사전 차단" },
        { at: 'raise ValueError("0으로 나눌 수 없음.")', text: "예외를 발생시키면 MCP가 isError=True로 클라이언트에 전달" },
        { at: "result = a / b", text: "b가 0이 아닌 경우에만 나눗셈 수행" }
      ],
      code: `@mcp.tool()
def divide(a: float, b: float) -> float:
    """두 수를 나눔. 0으로 나누면 ValueError 발생."""
    if b == 0:
        raise ValueError("0으로 나눌 수 없음.")
    result = a / b
    history.append(f"{a} ÷ {b} = {result}")
    return result`
    },
    {
      id: "resource_history",
      name: "get_history()",
      fileId: "calc",
      summary: "계산 이력을 URI(calc://history)로 노출하는 MCP 리소스",
      how: "@mcp.resource('calc://history')가 이 함수를 읽기 전용 데이터로 등록합니다. 도구(Tool)는 실행·부작용이 있지만, 리소스(Resource)는 조회만 합니다.",
      terms: ["mcp_resource", "URI", "enumerate"],
      lines: [
        { at: '@mcp.resource("calc://history")', text: "calc://history URI로 접근하는 읽기 전용 데이터로 등록" },
        { at: "if not history:", text: "이력이 비어 있으면 안내 메시지 반환" },
        { at: "enumerate(history)", text: "enumerate가 (0,'식1'), (1,'식2')... 쌍을 만들어 1번부터 번호를 붙임" }
      ],
      code: `@mcp.resource("calc://history")
def get_history() -> str:
    """지금까지의 계산 이력을 번호와 함께 반환함."""
    if not history:
        return "계산 기록이 없습니다."
    return "\\n".join(f"{i + 1}. {h}" for i, h in enumerate(history))`
    },
    {
      id: "prompt_math",
      name: "math_prompt()",
      fileId: "calc",
      summary: "수학 문제 풀이 가이드 프롬프트 템플릿 — @mcp.prompt() 등록 예시",
      how: "@mcp.prompt()는 함수를 재사용 가능한 프롬프트 템플릿으로 등록합니다. get_prompt() 호출 시 문제 내용을 받아 완성된 프롬프트 문자열을 반환합니다. LLM 실행이 아니라, LLM에게 줄 '질문지'를 만드는 것입니다.",
      terms: ["mcp_prompt"],
      lines: [
        { at: "@mcp.prompt()", text: "이 함수를 재사용 가능한 프롬프트 템플릿으로 등록" },
        { at: "def math_prompt(problem: str) -> str:", text: "problem 인자를 받아 완성된 프롬프트 문자열을 반환" },
        { at: 'f"문제: {problem}"', text: "인자로 받은 실제 문제를 프롬프트 끝에 삽입" }
      ],
      code: `@mcp.prompt()
def math_prompt(problem: str) -> str:
    """수학 문제를 단계별로 풀도록 유도하는 프롬프트를 생성함."""
    return (
        "다음 수학 문제를 단계별로 풀어주세요.\\n"
        "계산이 필요하면 계산기 도구(add/subtract/multiply/divide)를 활용하세요.\\n\\n"
        f"문제: {problem}"
    )`
    },
    {
      id: "geocode",
      name: "_geocode()",
      fileId: "weather",
      summary: "도시 이름을 위경도 좌표로 변환하는 비동기 헬퍼",
      how: "Open-Meteo Geocoding API에 도시명을 보내면 위도·경도 등 좌표 정보를 반환합니다. 결과가 없으면 None을 반환해 호출자가 '찾을 수 없는 도시'를 처리하게 합니다.",
      terms: ["async_await", "httpx", "raise_for_status"],
      lines: [
        { at: "async def _geocode(client: httpx.AsyncClient, city: str)", text: "비동기 함수 — HTTP 응답을 기다리는 동안 다른 작업을 막지 않음" },
        { at: "resp = await client.get(", text: "Geocoding API에 도시명을 보내 위경도 조회" },
        { at: "resp.raise_for_status()", text: "HTTP 오류(4xx, 5xx)면 예외를 발생시켜 호출자에게 알림" },
        { at: 'results = resp.json().get("results")', text: "결과 없으면 'results' 키 자체가 없으므로 get()으로 안전하게 접근" },
        { at: "return results[0]", text: "첫 번째 검색 결과(위도·경도·도시명·국가명 포함)를 반환" }
      ],
      code: `async def _geocode(client: httpx.AsyncClient, city: str) -> dict | None:
    """도시 이름을 Open-Meteo Geocoding API로 위경도 좌표로 변환함."""
    resp = await client.get(
        GEOCODING_URL,
        params={"name": city, "count": 1, "language": "ko", "format": "json"},
        timeout=10.0,
    )
    resp.raise_for_status()
    results = resp.json().get("results")
    if not results:
        return None
    return results[0]`
    },
    {
      id: "get_weather",
      name: "get_weather()",
      fileId: "weather",
      summary: "도시 이름을 받아 현재 날씨를 조회하는 비동기 MCP 도구",
      how: "두 단계로 작동합니다. ① _geocode()로 도시명을 위경도로 변환하고, ② Open-Meteo Forecast API로 날씨를 가져옵니다. async with로 HTTP 클라이언트를 열고, 블록을 나가면 연결이 자동 정리됩니다.",
      terms: ["mcp_tool", "async_await", "httpx", "WMO_code"],
      lines: [
        { at: "async with httpx.AsyncClient() as client:", text: "HTTP 클라이언트를 열고, 블록을 나가면 자동으로 연결 정리" },
        { at: "location = await _geocode(client, city)", text: "도시명 → 위경도 변환 (없으면 None 반환)" },
        { at: "if location is None:", text: "존재하지 않는 도시면 바로 안내 메시지 반환" },
        { at: '"timezone": "auto"', text: "timezone=auto — 해당 좌표의 현지 시각 기준으로 결과 반환" },
        { at: "resp.raise_for_status()", text: "HTTP 오류 응답이면 예외 발생" }
      ],
      code: `@mcp.tool()
async def get_weather(city: str) -> str:
    """도시의 현재 날씨를 조회함."""
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
                    "timezone": "auto",
                },
                timeout=10.0,
            )
            resp.raise_for_status()
            current = resp.json()["current"]
            name = location.get("name", city)
            country = location.get("country", "")
            return (
                f"도시: {name} ({country})\\n"
                f"시각: {current['time']}\\n"
                f"날씨: {_describe(current['weather_code'])}\\n"
                f"온도: {current['temperature_2m']}°C\\n"
                f"체감: {current['apparent_temperature']}°C\\n"
                f"습도: {current['relative_humidity_2m']}%\\n"
                f"풍속: {current['wind_speed_10m']}km/h"
            )
        except httpx.HTTPStatusError as e:
            return f"날씨 조회 실패: HTTP {e.response.status_code}"
        except Exception as e:
            return f"날씨 조회 실패: {e}"`
    },
    {
      id: "get_forecast",
      name: "get_forecast()",
      fileId: "weather",
      summary: "도시의 일별 날씨 예보를 조회하는 비동기 MCP 도구",
      how: "zip()으로 날짜·최고·최저·코드 4개 리스트를 같은 인덱스끼리 묶어 순회합니다. min(max(days, 1), 7)로 입력값을 1~7 범위로 안전하게 보정합니다.",
      terms: ["zip_func", "min_max_clamp"],
      lines: [
        { at: "days = min(max(days, 1), 7)", text: "입력값을 1~7 범위로 강제 보정 — Open-Meteo의 허용 범위" },
        { at: '"daily": "weather_code,temperature_2m_max,temperature_2m_min"', text: "일별 날씨코드·최고기온·최저기온 3가지를 요청" },
        { at: "for date, tmax, tmin, code in zip(", text: "4개 리스트를 같은 인덱스끼리 묶어 한 번에 순회" }
      ],
      code: `@mcp.tool()
async def get_forecast(city: str, days: int = 3) -> str:
    """도시의 일별 날씨 예보를 조회함."""
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
            for date, tmax, tmin, code in zip(
                daily["time"],
                daily["temperature_2m_max"],
                daily["temperature_2m_min"],
                daily["weather_code"],
            ):
                lines.append(
                    f"\\n날짜: {date}\\n"
                    f"  날씨: {_describe(code)}\\n"
                    f"  최고: {tmax}°C / 최저: {tmin}°C"
                )
            return "\\n".join(lines)
        except Exception as e:
            return f"예보 조회 실패: {e}"`
    },
    {
      id: "client_text",
      name: "_text()",
      fileId: "client",
      summary: "MCP 응답의 content 리스트에서 텍스트를 추출하는 헬퍼",
      how: "MCP 응답은 여러 콘텐츠 조각의 리스트입니다. 각 조각에 .text 속성이 있을 수 있어요. getattr(item, 'text', str(item))은 속성이 없어도 오류가 나지 않는 안전한 방법입니다.",
      terms: ["getattr"],
      lines: [
        { at: "def _text(content_list) -> str:", text: "content 리스트를 받아 텍스트 문자열로 합치는 헬퍼" },
        { at: 'parts.append(getattr(item, "text", str(item)))', text: "item에 text 속성이 있으면 그 값, 없으면 str(item)으로 대체" },
        { at: 'return " ".join(parts)', text: "여러 텍스트 조각을 공백으로 이어 붙임" }
      ],
      code: `def _text(content_list) -> str:
    """call_tool/read_resource 결과의 content 리스트에서 텍스트만 추출함."""
    parts = []
    for item in content_list:
        parts.append(getattr(item, "text", str(item)))
    return " ".join(parts)`
    },
    {
      id: "client_main",
      name: "main()",
      fileId: "client",
      summary: "calc_server에 연결해 Tools·Resources·Prompts를 순서대로 호출하는 메인 함수",
      how: "StdioServerParameters로 서버 실행 방법을 정의하고 stdio_client로 서버를 자식 프로세스로 띄웁니다. ClientSession으로 JSON-RPC 요청을 주고받습니다. with 블록을 나가면 서버도 자동 종료됩니다.",
      terms: ["StdioServerParameters", "ClientSession", "stdio_client", "asyncio_run", "JSON_RPC"],
      lines: [
        { at: "params = StdioServerParameters(", text: "서버를 어떻게 실행할지 정의 — 현재 venv의 python으로 서버 스크립트 실행" },
        { at: "async with stdio_client(params) as (read, write):", text: "서버 자식 프로세스를 띄우고 stdin/stdout 스트림을 연결함" },
        { at: "async with ClientSession(read, write) as session:", text: "스트림 위에서 JSON-RPC 세션 시작" },
        { at: "await session.initialize()", text: "반드시 첫 번째 호출 — 프로토콜 버전·기능을 서버와 교환" },
        { at: 'result = await session.call_tool("add", arguments={"a": 3, "b": 5})', text: "add 도구 호출 — 서버의 add(a=3, b=5) 함수가 실행됨" },
        { at: 'resource = await session.read_resource("calc://history")', text: "리소스 URI로 이력 조회 — 앞의 두 계산이 담겨 있음" },
        { at: "prompt = await session.get_prompt(", text: "프롬프트 템플릿 조회 — LLM 실행이 아닌 프롬프트 문자열 반환" }
      ],
      code: `async def main():
    """계산기 MCP 서버에 연결하여 Tools/Resources/Prompts를 차례로 호출함."""

    params = StdioServerParameters(
        command=sys.executable,
        args=[str(SERVER_SCRIPT)],
    )

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            print("서버 연결 완료")

            tools = await session.list_tools()
            print("\\n=== 사용 가능한 도구 ===")
            for tool in tools.tools:
                print(f"  - {tool.name}: {tool.description}")

            resources = await session.list_resources()
            print("\\n=== 사용 가능한 리소스 ===")
            for res in resources.resources:
                print(f"  - {res.uri}: {res.description}")

            print("\\n=== 도구 호출: add(3, 5) ===")
            result = await session.call_tool("add", arguments={"a": 3, "b": 5})
            print(f"  결과: {_text(result.content)}")

            print("\\n=== 도구 호출: divide(10, 3) ===")
            result = await session.call_tool("divide", arguments={"a": 10, "b": 3})
            print(f"  결과: {_text(result.content)}")

            print("\\n=== 리소스 읽기: calc://history ===")
            resource = await session.read_resource("calc://history")
            print(f"  {_text(resource.contents)}")

            prompts = await session.list_prompts()
            print("\\n=== 사용 가능한 프롬프트 ===")
            for p in prompts.prompts:
                print(f"  - {p.name}: {p.description}")

            print("\\n=== 프롬프트 조회: math_prompt ===")
            prompt = await session.get_prompt(
                "math_prompt", arguments={"problem": "사과 3개와 5개를 더하면?"}
            )
            print(f"  {prompt.messages[0].content.text}")`
    }
  ],
  glossary: {
    "FastMCP": "MCP 서버를 간편하게 만드는 라이브러리. 타입 힌트와 docstring만으로 JSON Schema를 자동 생성함",
    "JSON_Schema": "함수의 입력·출력 구조를 JSON으로 표현한 명세서. LLM이 도구 사용법을 이해하는 데 쓰임",
    "mcp_tool": "LLM이 호출 여부를 결정하고 AI 앱이 실제 실행하는 함수. @mcp.tool()로 등록함",
    "mcp_resource": "URI로 접근하는 읽기 전용 데이터. 부작용 없이 조회만 함. @mcp.resource('URI')로 등록",
    "mcp_prompt": "재사용 가능한 프롬프트 템플릿. LLM 실행이 아닌 완성된 프롬프트 문자열을 반환함",
    "URI": "Uniform Resource Identifier. 리소스의 주소. calc://history 처럼 웹 URL과 비슷한 형태로 표현",
    "docstring": "함수 바로 아래 작성하는 설명 문자열(\"\"\"...\"\"\"). MCP에서 도구 설명으로 자동 사용됨",
    "isError": "MCP 도구에서 예외 발생 시 응답에 포함되는 플래그. True이면 오류 결과임",
    "ValueError": "잘못된 값이 입력됐을 때 파이썬이 던지는 예외. 0 나눗셈, 범위 초과 등에 사용",
    "enumerate": "리스트를 순회할 때 (인덱스, 값) 쌍을 만들어 주는 파이썬 내장 함수",
    "async_await": "비동기 처리 키워드. await가 붙은 작업이 완료될 때까지 기다리되 다른 작업을 막지 않음",
    "httpx": "파이썬용 HTTP 클라이언트 라이브러리. 동기·비동기 모두 지원함",
    "raise_for_status": "HTTP 응답 코드가 4xx·5xx면 예외를 발생시키는 메서드. 오류를 자동 감지함",
    "WMO_code": "세계기상기구(WMO) 날씨 숫자 코드. 0=맑음, 61=비, 95=뇌우 등 국제 표준",
    "zip_func": "여러 리스트를 같은 인덱스끼리 묶어 주는 파이썬 내장 함수. zip([1,2],[3,4]) → (1,3),(2,4)",
    "min_max_clamp": "min(max(value, 최솟값), 최댓값) 패턴으로 값을 특정 범위 안으로 강제 보정하는 파이썬 관용구",
    "getattr": "getattr(obj, 'attr', default) — obj에 attr 속성이 없으면 default를 반환하는 파이썬 내장 함수",
    "StdioServerParameters": "STDIO 전송으로 서버를 실행할 때 필요한 설정값(명령어, 인자) 묶음",
    "ClientSession": "MCP 서버와 JSON-RPC 메시지를 주고받는 세션 객체. 도구 호출·리소스 읽기 등 제공",
    "stdio_client": "서버를 자식 프로세스로 실행하고 stdin/stdout 스트림을 연결하는 컨텍스트 매니저",
    "asyncio_run": "asyncio.run(coro) — async 함수를 동기 진입점에서 실행하는 표준 방법",
    "JSON_RPC": "JSON 형식으로 원격 함수를 호출하는 통신 규약. MCP 내부에서 서버-클라이언트 통신에 사용됨"
  }
};
