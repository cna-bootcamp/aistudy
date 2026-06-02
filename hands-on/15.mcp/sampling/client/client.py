"""고객 문의 자동 분류 MCP 클라이언트 (Sampling 핸들러 포함).

이 클라이언트의 핵심은 sampling_callback임. MCP 서버가 ctx.session.create_message()로
Sampling을 요청하면, 클라이언트에 등록된 이 콜백이 자동 호출되어 Groq LLM(OpenAI 호환 API)을
실행하고 결과를 서버로 돌려줌. 즉, 서버는 자체 LLM 없이 클라이언트의 LLM을 빌려 추론함.

[동작 흐름]
  1) 클라이언트가 server/server.py를 STDIO 자식 프로세스로 띄움
  2) csr/ 디렉터리의 고객 문의(JSON)를 하나씩 읽어 classify_inquiry 도구를 호출
  3) 서버가 분류를 위해 Sampling 요청 → 이 클라이언트의 sampling_callback이 Groq 호출
  4) 서버가 티켓 생성 + Slack 발송 후 결과 티켓을 반환 → 클라이언트가 출력

[참고] Sampling은 Claude Code/Desktop이 아직 미지원하므로, 이렇게 직접 만든
       클라이언트(콜백 등록)로만 실습할 수 있음.

실행: python client.py [--no-slack]
  --no-slack: 실제 Slack 발송 없이 분류·티켓 생성만 수행 (분류 로직 반복 검증용)
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# ClientSession: MCP 서버와의 세션 (도구 호출·콜백 등록)
# StdioServerParameters: STDIO 전송으로 띄울 서버 실행 정보(명령·인자)
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client  # STDIO 전송 컨텍스트 매니저
from mcp.types import (
    CreateMessageRequestParams,  # 서버가 보낸 Sampling 요청 파라미터
    CreateMessageResult,  # 클라이언트가 돌려줄 Sampling 응답
    TextContent,
)
from openai import AsyncOpenAI  # Groq는 OpenAI 호환 API라 openai 라이브러리를 그대로 사용함

# Windows 콘솔(cp949)에서도 한글 출력이 깨지지 않도록 표준 출력/오류를 UTF-8로 고정함.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")  # reconfigure: 스트림의 인코딩을 런타임에 변경함
    except (AttributeError, ValueError):
        pass


# ---------------------------------------------------------------------------
# 경로 및 환경 변수 설정
# ---------------------------------------------------------------------------
# 이 파일이 위치한 디렉터리(.../sampling/client)를 절대경로로 구함
CLIENT_DIR = Path(__file__).resolve().parent
# 프로젝트 루트(.../sampling)
PROJECT_DIR = CLIENT_DIR.parent
# 고객 문의 입력 디렉터리, 서버 스크립트 경로
CSR_DIR = PROJECT_DIR / "csr"
SERVER_SCRIPT = PROJECT_DIR / "server" / "server.py"
# hands-on/.env (GROQ_API_KEY). parents[2] = client→sampling→15.mcp→hands-on
HANDS_ON_ENV_PATH = CLIENT_DIR.parents[2] / ".env"

load_dotenv(HANDS_ON_ENV_PATH)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
if not GROQ_API_KEY:
    # API 키 미설정 시 실행 초기에 명확한 오류를 내어 디버깅을 쉽게 함
    print(f"[오류] GROQ_API_KEY가 없습니다. 확인 경로: {HANDS_ON_ENV_PATH}", file=sys.stderr)
    sys.exit(1)

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_MODEL = "llama-3.3-70b-versatile"

# AsyncOpenAI: 비동기 OpenAI 클라이언트. base_url만 Groq로 바꾸면 Groq LPU에 연결됨.
# Sampling 콜백은 async 컨텍스트에서 실행되므로, 동기 클라이언트 대신 비동기 클라이언트로
# 호출해야 이벤트 루프를 막지 않음.
groq_client = AsyncOpenAI(api_key=GROQ_API_KEY, base_url=GROQ_BASE_URL)


# ---------------------------------------------------------------------------
# Sampling 콜백 (이 예제의 핵심)
# ---------------------------------------------------------------------------
async def sampling_callback(
    context,  # 요청 컨텍스트 (현재 세션 정보). 이 예제에서는 사용하지 않음
    params: CreateMessageRequestParams,  # 서버가 보낸 Sampling 요청
) -> CreateMessageResult:
    """서버의 Sampling 요청을 받아 Groq LLM을 호출하고 결과를 반환함.

    MCP의 SamplingMessage(서버 형식)를 OpenAI Chat 형식으로 변환하여 Groq에 전달함:
    - params.systemPrompt → role="system" 메시지
    - params.messages     → role="user"/"assistant" 메시지
    - params.maxTokens, params.temperature → 그대로 LLM 호출 파라미터로 전달
    """
    # MCP 요청을 OpenAI Chat Completions 형식의 메시지 리스트로 변환함
    messages: list[dict[str, str]] = []
    if params.systemPrompt:
        messages.append({"role": "system", "content": params.systemPrompt})
    for msg in params.messages:
        # msg.content는 TextContent. .text가 없으면 빈 문자열로 안전 처리함
        text = getattr(msg.content, "text", "") or ""
        messages.append({"role": msg.role, "content": text})

    print(f"   ↳ [Sampling] Groq LLM 호출 중 ({GROQ_MODEL})...", flush=True)

    # Groq 호출 (OpenAI 호환). 서버가 지정한 max_tokens/temperature를 존중하되,
    # 값이 없으면 분류에 적합한 기본값을 사용함
    response = await groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        max_tokens=params.maxTokens or 512,
        temperature=params.temperature if params.temperature is not None else 0.1,
    )
    result_text = response.choices[0].message.content or ""

    # CreateMessageResult로 서버에 반환함 (role/content/model/stopReason)
    return CreateMessageResult(
        role="assistant",
        content=TextContent(type="text", text=result_text),
        model=GROQ_MODEL,
        stopReason="endTurn",  # 정상 종료를 의미함
    )


# ---------------------------------------------------------------------------
# 입력 로딩
# ---------------------------------------------------------------------------
def load_inquiries() -> list[dict[str, str]]:
    """csr/ 디렉터리의 고객 문의 JSON 파일을 ID 순으로 읽어 리스트로 반환함."""
    if not CSR_DIR.exists():
        print(
            f"[오류] csr 디렉터리가 없습니다: {CSR_DIR}\n"
            f"       먼저 generate_ticket.py를 실행해 샘플 문의를 생성하세요.",
            file=sys.stderr,
        )
        sys.exit(1)

    inquiries: list[dict[str, str]] = []
    # sorted(): 파일명을 사전순으로 정렬해 CSR-001부터 순서대로 처리함
    for path in sorted(CSR_DIR.glob("*.json")):
        with open(path, "r", encoding="utf-8") as f:
            inquiries.append(json.load(f))
    return inquiries


# ---------------------------------------------------------------------------
# 메인 실행
# ---------------------------------------------------------------------------
async def run(notify_slack: bool) -> None:
    """서버에 연결하여 모든 고객 문의를 Sampling 분류·라우팅함."""
    inquiries = load_inquiries()
    print("=" * 64)
    print("  고객 문의 자동 분류·라우팅 (MCP Sampling)")
    print(f"  문의 {len(inquiries)}건 / Slack 발송: {'ON' if notify_slack else 'OFF'}")
    print("=" * 64)

    # STDIO 전송: 클라이언트가 현재 파이썬 인터프리터(sys.executable)로 server.py를 자식
    # 프로세스로 실행함. sys.executable을 쓰면 클라이언트와 서버가 동일한 venv를 공유하므로
    # 서버에서 mcp/httpx/dotenv import가 항상 보장됨 ("python"으로 띄우면 다른 환경이 잡힐 수 있음).
    server_params = StdioServerParameters(
        command=sys.executable,
        args=[str(SERVER_SCRIPT)],
    )

    # stdio_client(): 서버 프로세스를 띄우고 stdin/stdout 양방향 스트림(read, write)을 얻음
    async with stdio_client(server_params) as (read, write):
        # ClientSession 생성 시 sampling_callback을 등록하면 클라이언트가 Sampling 지원을 선언함.
        # 콜백을 등록하지 않으면 서버의 create_message() 요청은 "지원 안 함" 오류로 실패함.
        async with ClientSession(read, write, sampling_callback=sampling_callback) as session:
            # 초기화: 프로토콜 버전 협상 및 capability 교환
            await session.initialize()
            print("\n서버 연결 완료\n")

            # 등록된 도구 목록 조회 (학습 확인용)
            tools = await session.list_tools()
            print("=== 사용 가능한 도구 ===")
            for tool in tools.tools:
                print(f"  - {tool.name}: {tool.description.splitlines()[0]}")
            print()

            # 각 문의를 순회하며 classify_inquiry 도구 호출.
            # 이 호출 내부에서 서버가 Sampling을 일으키고, 위의 sampling_callback이 자동 실행됨.
            for index, inquiry in enumerate(inquiries, start=1):
                print(f"[{index}/{len(inquiries)}] {inquiry['id']} 처리 중...")
                result = await session.call_tool(
                    "classify_inquiry",
                    arguments={
                        "inquiry_id": inquiry["id"],
                        "subject": inquiry["subject"],
                        "content": inquiry["content"],
                        "customer_name": inquiry.get("customer_name", ""),
                        "customer_email": inquiry.get("customer_email", ""),
                        "notify_slack": notify_slack,
                    },
                )
                # result.content는 TextContent 리스트. 첫 항목이 서버가 반환한 티켓 JSON임
                ticket_json = result.content[0].text if result.content else "{}"
                ticket = json.loads(ticket_json)
                print(
                    f"      → {ticket['category']} / {ticket['urgency']} / "
                    f"{ticket['department']} ({ticket['channel']})  티켓 {ticket['ticket_id']}\n"
                )

    print("=" * 64)
    print(f"  완료: 티켓 {len(inquiries)}건 생성 (ticket/ 디렉터리 확인)")
    print("=" * 64)


def main() -> None:
    """CLI 인자를 파싱하고 비동기 run()을 실행함."""
    parser = argparse.ArgumentParser(description="MCP Sampling 고객 문의 분류 클라이언트")
    # --no-slack: 지정 시 Slack 발송을 끔 (분류·티켓 생성만 수행)
    parser.add_argument(
        "--no-slack",
        action="store_true",
        help="Slack 발송 없이 분류·티켓 생성만 수행",
    )
    args = parser.parse_args()

    # asyncio.run(): async 함수를 동기 진입점에서 실행함
    asyncio.run(run(notify_slack=not args.no_slack))


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
