"""고객 문의 자동 분류·라우팅 MCP 서버 (Sampling 예제).

업무: 온라인 쇼핑몰 고객 문의 자동 분류 및 라우팅.
서버가 고객 문의 텍스트를 받아, 자체 LLM 없이 **Sampling**으로 클라이언트의 LLM을 빌려
카테고리/긴급도/담당부서를 분류함. 분류 결과로 JSON 티켓을 생성하고, 담당부서별
Slack 채널(#cs-결제 / #cs-배달 / #cs-일반)로 알림을 발송함.

[Sampling 핵심 흐름]
  서버 ── create_message() ──▶ 클라이언트 ── sampling_callback() ──▶ LLM(Groq)
  서버 ◀── CreateMessageResult ── 클라이언트 ◀── 분류 결과 텍스트 ──

[STDIO 전송 주의]
  stdout은 JSON-RPC 통신 채널이므로 print()로 stdout에 출력하면 프로토콜이 깨짐.
  모든 서버 진단 출력은 반드시 stderr로 보냄 (log() 헬퍼 사용).
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import json
import os
import sys
from datetime import datetime
from pathlib import Path

import httpx  # 비동기 HTTP 클라이언트. Slack Incoming Webhook 호출에 사용함
from dotenv import load_dotenv

# FastMCP: 데코레이터로 도구를 등록하는 고수준 MCP 서버 API
# Context: 도구 실행 컨텍스트. ctx.session으로 Sampling(create_message) 요청 가능
from mcp.server.fastmcp import Context, FastMCP

# SamplingMessage: Sampling 요청에 담는 대화 메시지 타입
# TextContent: 텍스트 콘텐츠 타입 (role+text)
from mcp.types import SamplingMessage, TextContent

# Windows 콘솔(cp949)에서도 한글 진단 로그가 깨지지 않도록 stderr를 UTF-8로 고정함.
# stdout은 JSON-RPC 통신 채널이므로 절대 건드리지 않음 (MCP가 직접 관리).
try:
    sys.stderr.reconfigure(encoding="utf-8")  # reconfigure: 스트림의 인코딩을 런타임에 변경함
except (AttributeError, ValueError):
    pass


# ---------------------------------------------------------------------------
# 경로 및 환경 변수 설정
# ---------------------------------------------------------------------------
# 이 파일이 위치한 디렉터리(.../sampling/server)를 절대경로로 구함
SERVER_DIR = Path(__file__).resolve().parent
# 프로젝트 루트(.../sampling). 티켓 출력 디렉터리의 기준이 됨
PROJECT_DIR = SERVER_DIR.parent
# hands-on/.env 경로. parents[3] = server→sampling→15.mcp→hands-on 순으로 3단계 상위임
HANDS_ON_ENV_PATH = SERVER_DIR.parents[2] / ".env"

# .env 파일에서 Slack Webhook URL 등 환경변수를 로드함
load_dotenv(HANDS_ON_ENV_PATH)

# JSON 티켓 파일을 저장할 디렉터리 (.../sampling/ticket)
TICKET_DIR = PROJECT_DIR / "ticket"

# Slack 알림 발송 여부. 클라이언트가 --no-slack로 실행하면 SLACK_ENABLED=false가 전달되어
# 분류·티켓 생성만 수행하고 실제 채널 발송은 건너뜀 (분류 로직을 반복 검증할 때 유용함).
# 도구 인자 notify_slack과 함께 동작하며, 둘 중 하나라도 비활성이면 발송하지 않음.
SLACK_ENABLED = os.getenv("SLACK_ENABLED", "true").lower() not in ("false", "0", "no")

# 담당부서 → (Slack 채널 표시명, Webhook URL 환경변수명) 매핑.
# LLM이 분류한 department 값으로 발송할 채널을 결정함.
DEPARTMENT_ROUTING: dict[str, tuple[str, str]] = {
    "결제팀": ("#cs-결제", "SLACK_WEBHOOK_PAYMENT"),
    "배달팀": ("#cs-배달", "SLACK_WEBHOOK_SHIPPING"),
    "일반팀": ("#cs-일반", "SLACK_WEBHOOK_GENERAL"),
}

# 긴급도별 Slack 메시지 머리 이모지
URGENCY_EMOJI: dict[str, str] = {
    "높음": ":rotating_light:",
    "보통": ":large_yellow_circle:",
    "낮음": ":large_green_circle:",
}


def log(message: str) -> None:
    """서버 진단 메시지를 stderr로 출력함.

    STDIO 전송에서는 stdout이 클라이언트와의 JSON-RPC 통신 채널이므로,
    print()로 stdout에 출력하면 프로토콜 메시지가 깨져 연결이 실패함.
    따라서 모든 진단 출력은 stderr로 보내며, stderr는 부모 프로세스(클라이언트) 터미널로 전달됨.
    """
    print(message, file=sys.stderr, flush=True)


# FastMCP 서버 인스턴스. 이름은 클라이언트 initialize 응답에 표시됨
mcp = FastMCP("CSR-Classifier")


# ---------------------------------------------------------------------------
# 분류 프롬프트 (Sampling으로 LLM에 전달)
# ---------------------------------------------------------------------------
# system_prompt: LLM의 역할과 출력 규칙을 고정함 (JSON만 반환하도록 강제)
CLASSIFY_SYSTEM_PROMPT = """\
당신은 온라인 쇼핑몰의 고객 문의 분류 전문가입니다.
고객 문의를 읽고 아래 4개 항목을 판단하여 JSON 객체 하나만 반환하세요.

- category(카테고리): "결제", "배달", "일반" 중 하나
- urgency(긴급도): "높음", "보통", "낮음" 중 하나
    - 높음: 이중 결제, 금전 손실, 파손, 오배송 등 즉시 대응이 필요한 경우
    - 보통: 환불 지연, 배송 지연, 재입고 문의 등
    - 낮음: 단순 정보 요청, 절차 안내 등
- department(담당부서): "결제팀", "배달팀", "일반팀" 중 하나
    - 결제팀: 결제, 환불, 쿠폰, 카드 관련
    - 배달팀: 배송, 택배, 오배송, 파손 관련
    - 일반팀: 회원, 재입고, 마케팅 동의 등 그 외 문의
- summary(요약): 문의 내용을 40자 이내 한 문장으로 요약

반드시 아래 형식의 JSON 한 줄만 출력하고, 다른 설명은 붙이지 마세요.
{"category": "...", "urgency": "...", "department": "...", "summary": "..."}"""

# user 메시지 템플릿. {subject}/{content}는 실제 고객 문의로 치환됨
CLASSIFY_USER_TEMPLATE = """\
다음 고객 문의를 분류하세요.

제목: {subject}
내용: {content}"""


# ---------------------------------------------------------------------------
# 핵심 로직: Sampling으로 LLM 분류 요청
# ---------------------------------------------------------------------------
async def request_classification(ctx: Context, subject: str, content: str) -> dict[str, str]:
    """Sampling으로 클라이언트의 LLM에 분류를 요청하고 결과 dict를 반환함.

    ctx.session.create_message()가 Sampling 요청의 핵심임:
    - 서버는 자체 LLM API 키 없이도 클라이언트에 등록된 LLM을 빌려 추론함
    - 클라이언트의 sampling_callback이 자동 호출되어 LLM 응답을 돌려줌
    LLM 응답이 비었거나 JSON 파싱이 실패하면 최대 3회까지 재시도하고,
    그래도 실패하면 안전한 기본값(일반팀)으로 분류함.
    """
    user_prompt = CLASSIFY_USER_TEMPLATE.format(subject=subject, content=content)

    max_retries = 3
    for attempt in range(1, max_retries + 1):
        # === Sampling 요청 (서버 → 클라이언트 → LLM) ===
        result = await ctx.session.create_message(
            messages=[
                SamplingMessage(
                    role="user",
                    content=TextContent(type="text", text=user_prompt),
                )
            ],
            system_prompt=CLASSIFY_SYSTEM_PROMPT,  # LLM 역할·출력 규칙 고정
            max_tokens=512,
            temperature=0.0,  # 분류 작업이므로 결정적 결과를 위해 온도 0
        )

        # result.content는 TextContent 한 개. .text로 LLM 응답 텍스트를 꺼냄
        response_text = getattr(result.content, "text", "") or ""
        log(f"  [시도 {attempt}/{max_retries}] LLM 응답: {response_text[:120]}")

        parsed = _extract_json(response_text)
        if parsed is not None:
            return _normalize_classification(parsed, fallback_summary=subject)

        log(f"  [시도 {attempt}/{max_retries}] JSON 파싱 실패, 재시도")

    log("  모든 재시도 실패 → 기본값(일반팀)으로 분류")
    return _normalize_classification({}, fallback_summary=subject)


def _extract_json(text: str) -> dict | None:
    """LLM 응답 텍스트에서 첫 번째 JSON 객체를 추출해 dict로 반환함 (실패 시 None).

    LLM이 JSON 앞뒤에 설명을 덧붙이는 경우를 대비해, 첫 '{'와 마지막 '}' 사이를 잘라 파싱함.
    """
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None


def _normalize_classification(raw: dict, *, fallback_summary: str) -> dict[str, str]:
    """LLM이 반환한 분류 dict를 검증·보정하여 항상 유효한 값으로 만듦.

    department가 정의된 3개 부서가 아니면 "일반팀"으로 보정하여 라우팅 누락을 방지함.
    """
    category = str(raw.get("category", "")).strip() or "일반"
    urgency = str(raw.get("urgency", "")).strip() or "보통"
    department = str(raw.get("department", "")).strip()
    # 알 수 없는 부서명은 일반팀으로 보정 (Slack 라우팅 키가 항상 유효하도록 보장)
    if department not in DEPARTMENT_ROUTING:
        department = "일반팀"
    summary = str(raw.get("summary", "")).strip() or fallback_summary[:40]
    return {
        "category": category,
        "urgency": urgency,
        "department": department,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# 티켓 생성 및 Slack 알림
# ---------------------------------------------------------------------------
def create_ticket(inquiry: dict[str, str], classification: dict[str, str]) -> dict[str, str]:
    """분류 결과로 JSON 티켓 dict를 만들고 ticket/ 디렉터리에 파일로 저장 후 반환함."""
    # 문의 ID "CSR-001"의 뒤 번호를 떼어 티켓 ID "TKT-001"을 만듦
    ticket_no = inquiry["id"].split("-")[-1]
    department = classification["department"]
    # 부서명으로 채널 표시명을 조회 (라우팅 매핑에 항상 존재하도록 normalize에서 보정됨)
    channel = DEPARTMENT_ROUTING[department][0]

    ticket = {
        "ticket_id": f"TKT-{ticket_no}",
        "inquiry_id": inquiry["id"],
        "customer_name": inquiry.get("customer_name", ""),
        "customer_email": inquiry.get("customer_email", ""),
        "subject": inquiry.get("subject", ""),
        "category": classification["category"],
        "urgency": classification["urgency"],
        "department": department,
        "channel": channel,
        "summary": classification["summary"],
        "status": "open",
        # datetime.now().isoformat(): 현재 시각을 "2026-06-01T13:00:00" 형태 문자열로 만듦
        "created_at": datetime.now().isoformat(timespec="seconds"),
    }

    TICKET_DIR.mkdir(parents=True, exist_ok=True)
    ticket_path = TICKET_DIR / f"{ticket['ticket_id']}.json"
    with open(ticket_path, "w", encoding="utf-8") as f:
        json.dump(ticket, f, ensure_ascii=False, indent=2)

    return ticket


async def send_slack(ticket: dict[str, str], notify_slack: bool) -> str:
    """담당부서 채널의 Slack Webhook으로 티켓 알림을 발송하고 결과 메시지를 반환함.

    notify_slack(도구 인자)와 SLACK_ENABLED(환경변수)가 모두 활성일 때만 실제 발송함.
    Webhook URL이 비어 있으면 건너뜀 → 분류·티켓 생성은 항상 정상 동작함.
    """
    if not (notify_slack and SLACK_ENABLED):
        return "Slack 발송 생략 (비활성화됨)"

    department = ticket["department"]
    _, webhook_env = DEPARTMENT_ROUTING[department]
    webhook_url = os.getenv(webhook_env, "")
    if not webhook_url:
        return f"Slack Webhook 미설정: {webhook_env}"

    emoji = URGENCY_EMOJI.get(ticket["urgency"], ":white_circle:")
    # Slack Incoming Webhook은 {"text": ...} 형식의 JSON을 받음. *...*는 굵게 표시됨
    payload = {
        "text": (
            f"{emoji} *새 고객 문의 티켓* `{ticket['ticket_id']}`\n"
            f"> *고객*: {ticket['customer_name']}\n"
            f"> *제목*: {ticket['subject']}\n"
            f"> *카테고리*: {ticket['category']}  |  *긴급도*: {ticket['urgency']}\n"
            f"> *담당부서*: {ticket['department']} ({ticket['channel']})\n"
            f"> *요약*: {ticket['summary']}"
        )
    }

    # async with: 요청이 끝나면 HTTP 연결을 자동으로 정리함
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.post(webhook_url, json=payload)
        except httpx.HTTPError as exc:
            return f"Slack 발송 실패: {exc}"

    if response.status_code == 200:
        return f"Slack 발송 완료 → {ticket['channel']}"
    return f"Slack 발송 실패: HTTP {response.status_code} {response.text[:80]}"


# ---------------------------------------------------------------------------
# MCP 도구
# ---------------------------------------------------------------------------
# @mcp.tool(): 이 비동기 함수를 MCP 도구로 등록함. 클라이언트가 call_tool()로 호출함.
# ctx 파라미터는 Context 타입으로 선언하면 FastMCP가 자동 주입하며 입력 스키마에서 제외됨.
@mcp.tool()
async def classify_inquiry(
    inquiry_id: str,
    subject: str,
    content: str,
    customer_name: str = "",
    customer_email: str = "",
    notify_slack: bool = True,
    ctx: Context = None,  # FastMCP가 실행 컨텍스트를 주입함 (Sampling에 사용)
) -> str:
    """고객 문의를 Sampling으로 분류하고 JSON 티켓 생성 + Slack 알림까지 수행함.

    처리 흐름:
    1) Sampling으로 LLM에 분류 요청 (카테고리/긴급도/담당부서/요약)
    2) 분류 결과로 ticket/ 디렉터리에 JSON 티켓 생성
    3) 담당부서 채널로 Slack 알림 발송 (notify_slack=False면 생략)
    반환값은 생성된 티켓 JSON 문자열임.
    """
    log(f"문의 접수: [{inquiry_id}] {subject}")

    inquiry = {
        "id": inquiry_id,
        "subject": subject,
        "content": content,
        "customer_name": customer_name,
        "customer_email": customer_email,
    }

    # 1) Sampling 분류
    log("  LLM 분류 요청 중 (Sampling)...")
    classification = await request_classification(ctx, subject, content)
    log(
        f"  분류 결과: {classification['category']} / "
        f"{classification['urgency']} / {classification['department']}"
    )

    # 2) 티켓 생성
    ticket = create_ticket(inquiry, classification)
    log(f"  티켓 생성: {ticket['ticket_id']} -> {TICKET_DIR / (ticket['ticket_id'] + '.json')}")

    # 3) Slack 발송
    slack_result = await send_slack(ticket, notify_slack)
    log(f"  {slack_result}")

    # 도구 반환값. 클라이언트가 이 문자열을 받아 화면에 출력함
    return json.dumps(ticket, ensure_ascii=False, indent=2)


# 서버 실행 (STDIO 전송). 클라이언트가 이 스크립트를 자식 프로세스로 띄우고
# stdin/stdout으로 JSON-RPC 메시지를 교환함
if __name__ == "__main__":
    mcp.run()
