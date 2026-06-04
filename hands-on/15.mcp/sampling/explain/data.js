window.EXPLAIN_DATA = {
  meta: { title: "MCP Sampling — 서버가 클라이언트의 LLM을 빌려 추론", entry: "client.py" },
  files: [
    { id: "generate", label: "generate_ticket.py", role: "테스트 데이터 생성기 — 고객 문의 샘플 9건을 csr/ 디렉터리에 JSON으로 저장" },
    { id: "server", label: "server.py", role: "고객 문의 분류 MCP 서버 — Sampling으로 LLM 분류 요청 + 티켓 생성 + Slack 발송" },
    { id: "client", label: "client.py", role: "MCP 클라이언트 — sampling_callback으로 Groq LLM 호출 후 서버에 반환" }
  ],
  flow: [
    { step: 1, title: "샘플 데이터 생성", label: "샘플 데이터 생성", refs: ["write_inquiries"], summary: "generate_ticket.py 실행 → csr/*.json 생성", detail: "결제·배달·일반 3유형 × 3건 = 9건의 고객 문의 JSON 파일을 csr/ 디렉터리에 만듭니다." },
    { step: 2, title: "서버 연결 + Sampling 콜백 등록", label: "Sampling 콜백 등록", refs: ["client_run", "sampling_callback"], summary: "sampling_callback을 ClientSession에 등록", detail: "콜백을 등록하면 클라이언트가 서버에 'Sampling 기능을 지원합니다'라고 선언합니다. 등록하지 않으면 서버의 create_message() 요청이 오류로 실패합니다." },
    { step: 3, title: "classify_inquiry 도구 호출", label: "도구 호출", refs: ["client_run", "classify_inquiry_tool"], summary: "call_tool('classify_inquiry', ...) 실행", detail: "서버에 고객 문의 내용을 보내 분류를 요청합니다." },
    { step: 4, title: "서버가 Sampling 요청", label: "Sampling 요청", refs: ["request_classification", "sampling_callback"], summary: "ctx.session.create_message() → sampling_callback 자동 실행", detail: "서버가 자체 LLM 없이 클라이언트의 LLM을 빌립니다. 이것이 Sampling의 핵심입니다." },
    { step: 5, title: "클라이언트가 Groq 호출", label: "Groq 호출", refs: ["sampling_callback"], summary: "sampling_callback이 Groq LLM을 호출하고 결과를 서버에 반환", detail: "클라이언트가 LLM을 대신 실행해 분류 결과(JSON)를 서버에 돌려줍니다." },
    { step: 6, title: "티켓 생성 + Slack 발송", label: "티켓·Slack 발송", refs: ["classify_inquiry_tool"], summary: "분류 결과로 JSON 티켓 저장 + 담당부서 채널에 알림", detail: "결제팀→#cs-결제, 배달팀→#cs-배달, 일반팀→#cs-일반 채널로 Slack 알림을 발송합니다." }
  ],
  functions: [
    {
      id: "write_inquiries",
      name: "write_inquiries()",
      fileId: "generate",
      summary: "고객 문의 샘플 9건을 csr/ 디렉터리에 JSON 파일로 저장",
      how: "INQUIRIES 리스트를 순회하며 각 문의를 개별 JSON 파일로 저장합니다. ensure_ascii=False로 한글을 이스케이프 없이 그대로 저장합니다.",
      terms: ["ensure_ascii_false", "json_dump", "Path_mkdir"],
      lines: [
        { at: "CSR_DIR.mkdir(parents=True, exist_ok=True)", text: "csr/ 디렉터리 생성 — 중간 경로도 한 번에, 이미 있어도 오류 없이" },
        { at: "file_path = CSR_DIR / f\"{inquiry['id']}.json\"", text: "CSR-001.json, CSR-002.json ... 형태로 파일명 생성" },
        { at: "json.dump(inquiry, f, ensure_ascii=False, indent=2)", text: "ensure_ascii=False: 한글을 \\uXXXX로 변환하지 않고 그대로 저장" }
      ],
      code: `def write_inquiries() -> list[Path]:
    """INQUIRIES 정의를 csr/ 디렉터리에 JSON 파일로 저장하고 생성 경로 목록을 반환함."""
    CSR_DIR.mkdir(parents=True, exist_ok=True)

    created: list[Path] = []
    for inquiry in INQUIRIES:
        file_path = CSR_DIR / f"{inquiry['id']}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(inquiry, f, ensure_ascii=False, indent=2)
        created.append(file_path)
    return created`
    },
    {
      id: "request_classification",
      name: "request_classification()",
      fileId: "server",
      summary: "Sampling으로 클라이언트의 LLM에 분류를 요청하고 결과 dict 반환",
      how: "ctx.session.create_message()가 Sampling 요청의 핵심입니다. 서버는 자체 LLM API 키 없이도 클라이언트에 등록된 LLM을 빌려 추론할 수 있습니다. LLM 응답이 비어 있거나 JSON 파싱이 실패하면 최대 3번 재시도합니다.",
      terms: ["create_message", "SamplingMessage", "TextContent", "temperature_zero"],
      lines: [
        { at: "result = await ctx.session.create_message(", text: "★ Sampling 핵심 — 서버→클라이언트→LLM 방향으로 추론 요청" },
        { at: "system_prompt=CLASSIFY_SYSTEM_PROMPT,", text: "LLM의 역할과 출력 규칙을 고정 (JSON만 반환하도록 강제)" },
        { at: "temperature=0.0,", text: "분류 작업이므로 결정적 결과를 위해 온도 0 설정" },
        { at: 'response_text = getattr(result.content, "text", "") or ""', text: "result.content는 TextContent — .text로 LLM 응답 텍스트를 꺼냄" },
        { at: "parsed = _extract_json(response_text)", text: "LLM 응답에서 JSON 객체를 추출해 dict로 변환" },
        { at: 'log(f"  모든 재시도 실패 → 기본값(일반팀)으로 분류")', text: "3번 모두 실패하면 일반팀으로 안전하게 처리" }
      ],
      code: `async def request_classification(ctx: Context, subject: str, content: str) -> dict[str, str]:
    """Sampling으로 클라이언트의 LLM에 분류를 요청하고 결과 dict를 반환함."""
    user_prompt = CLASSIFY_USER_TEMPLATE.format(subject=subject, content=content)

    max_retries = 3
    for attempt in range(1, max_retries + 1):
        result = await ctx.session.create_message(
            messages=[
                SamplingMessage(
                    role="user",
                    content=TextContent(type="text", text=user_prompt),
                )
            ],
            system_prompt=CLASSIFY_SYSTEM_PROMPT,
            max_tokens=512,
            temperature=0.0,
        )

        response_text = getattr(result.content, "text", "") or ""
        log(f"  [시도 {attempt}/{max_retries}] LLM 응답: {response_text[:120]}")

        parsed = _extract_json(response_text)
        if parsed is not None:
            return _normalize_classification(parsed, fallback_summary=subject)

        log(f"  [시도 {attempt}/{max_retries}] JSON 파싱 실패, 재시도")

    log(f"  모든 재시도 실패 → 기본값(일반팀)으로 분류")
    return _normalize_classification({}, fallback_summary=subject)`
    },
    {
      id: "classify_inquiry_tool",
      name: "classify_inquiry()",
      fileId: "server",
      summary: "고객 문의를 Sampling으로 분류하고 JSON 티켓 생성 + Slack 알림까지 수행하는 MCP 도구",
      how: "3단계로 처리합니다: ① Sampling으로 LLM 분류 → ② JSON 티켓 파일 생성 → ③ Slack 알림 발송. ctx 파라미터는 FastMCP가 자동 주입하며 입력 스키마에서 제외됩니다.",
      terms: ["mcp_tool", "ctx_auto_inject"],
      lines: [
        { at: "@mcp.tool()", text: "이 비동기 함수를 MCP 도구로 등록" },
        { at: "ctx: Context = None,", text: "FastMCP가 실행 컨텍스트를 자동 주입 — 입력 스키마에서 제외됨" },
        { at: "classification = await request_classification(ctx, subject, content)", text: "Step 1: Sampling으로 LLM에 분류 요청" },
        { at: "ticket = create_ticket(inquiry, classification)", text: "Step 2: 분류 결과로 JSON 티켓 생성 및 저장" },
        { at: "slack_result = await send_slack(ticket, notify_slack)", text: "Step 3: 담당부서 채널로 Slack 알림 발송" }
      ],
      code: `@mcp.tool()
async def classify_inquiry(
    inquiry_id: str,
    subject: str,
    content: str,
    customer_name: str = "",
    customer_email: str = "",
    notify_slack: bool = True,
    ctx: Context = None,
) -> str:
    """고객 문의를 Sampling으로 분류하고 JSON 티켓 생성 + Slack 알림까지 수행함."""
    log(f"문의 접수: [{inquiry_id}] {subject}")

    inquiry = {
        "id": inquiry_id,
        "subject": subject,
        "content": content,
        "customer_name": customer_name,
        "customer_email": customer_email,
    }

    log("  LLM 분류 요청 중 (Sampling)...")
    classification = await request_classification(ctx, subject, content)
    log(
        f"  분류 결과: {classification['category']} / "
        f"{classification['urgency']} / {classification['department']}"
    )

    ticket = create_ticket(inquiry, classification)
    log(f"  티켓 생성: {ticket['ticket_id']}")

    slack_result = await send_slack(ticket, notify_slack)
    log(f"  {slack_result}")

    return json.dumps(ticket, ensure_ascii=False, indent=2)`
    },
    {
      id: "sampling_callback",
      name: "sampling_callback()",
      fileId: "client",
      summary: "서버의 Sampling 요청을 받아 Groq LLM을 호출하고 결과를 서버에 반환",
      how: "MCP의 SamplingMessage(서버 형식)를 OpenAI Chat 형식으로 변환해 Groq에 전달합니다. params.systemPrompt → role='system', params.messages → role='user'/'assistant'로 변환합니다. 이것이 Sampling 예제의 핵심 함수입니다.",
      terms: ["sampling_callback_type", "CreateMessageRequestParams", "CreateMessageResult", "AsyncOpenAI"],
      lines: [
        { at: "async def sampling_callback(", text: "서버의 create_message() 요청이 올 때 자동 실행되는 콜백" },
        { at: "if params.systemPrompt:", text: "서버가 지정한 system 프롬프트를 첫 메시지로 추가" },
        { at: "text = getattr(msg.content, \"text\", \"\") or \"\"", text: "SamplingMessage.content.text를 안전하게 꺼냄" },
        { at: "response = await groq_client.chat.completions.create(", text: "Groq LLM 호출 — OpenAI 호환 API라 동일한 SDK 사용" },
        { at: "result_text = response.choices[0].message.content or \"\"", text: "LLM 응답 텍스트 추출" },
        { at: "return CreateMessageResult(", text: "MCP Sampling 응답 형식으로 서버에 반환" }
      ],
      code: `async def sampling_callback(
    context,
    params: CreateMessageRequestParams,
) -> CreateMessageResult:
    """서버의 Sampling 요청을 받아 Groq LLM을 호출하고 결과를 반환함."""
    messages: list[dict[str, str]] = []
    if params.systemPrompt:
        messages.append({"role": "system", "content": params.systemPrompt})
    for msg in params.messages:
        text = getattr(msg.content, "text", "") or ""
        messages.append({"role": msg.role, "content": text})

    print(f"   ↳ [Sampling] Groq LLM 호출 중 ({GROQ_MODEL})...", flush=True)

    response = await groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        max_tokens=params.maxTokens or 512,
        temperature=params.temperature if params.temperature is not None else 0.1,
    )
    result_text = response.choices[0].message.content or ""

    return CreateMessageResult(
        role="assistant",
        content=TextContent(type="text", text=result_text),
        model=GROQ_MODEL,
        stopReason="endTurn",
    )`
    },
    {
      id: "client_run",
      name: "run()",
      fileId: "client",
      summary: "서버에 연결해 모든 고객 문의를 Sampling 분류·라우팅하는 메인 함수",
      how: "ClientSession에 sampling_callback을 등록하는 것이 핵심입니다. 등록 없이는 서버의 Sampling 요청이 '지원 안 함' 오류로 실패합니다. 각 문의를 순서대로 처리하며, 처리마다 서버가 Sampling을 통해 LLM을 호출합니다.",
      terms: ["ClientSession", "stdio_client", "sampling_callback_type"],
      lines: [
        { at: "async with ClientSession(read, write, sampling_callback=sampling_callback) as session:", text: "sampling_callback 등록 — 서버의 Sampling 지원 선언" },
        { at: "await session.initialize()", text: "프로토콜 협상 — Sampling 지원 capability 교환" },
        { at: "result = await session.call_tool(", text: "classify_inquiry 도구 호출 → 서버가 내부적으로 Sampling을 일으킴" },
        { at: 'ticket_json = result.content[0].text if result.content else "{}"', text: "서버가 반환한 티켓 JSON 텍스트 추출" }
      ],
      code: `async def run(notify_slack: bool) -> None:
    """서버에 연결하여 모든 고객 문의를 Sampling 분류·라우팅함."""
    inquiries = load_inquiries()
    print("=" * 64)
    print("  고객 문의 자동 분류·라우팅 (MCP Sampling)")
    print("=" * 64)

    server_params = StdioServerParameters(
        command=sys.executable,
        args=[str(SERVER_SCRIPT)],
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write, sampling_callback=sampling_callback) as session:
            await session.initialize()
            print("\\n서버 연결 완료\\n")

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
                ticket_json = result.content[0].text if result.content else "{}"
                ticket = json.loads(ticket_json)
                print(
                    f"      → {ticket['category']} / {ticket['urgency']} / "
                    f"{ticket['department']} ({ticket['channel']})  티켓 {ticket['ticket_id']}\\n"
                )`
    }
  ],
  glossary: {
    "ensure_ascii_false": "json.dump(ensure_ascii=False) — 한글·특수문자를 \\uXXXX로 변환하지 않고 원래 문자 그대로 저장",
    "json_dump": "json.dump(obj, f, indent=2) — 파이썬 객체를 JSON 파일로 저장. indent로 들여쓰기 지정",
    "Path_mkdir": "Path.mkdir(parents=True, exist_ok=True) — 중간 경로까지 한 번에 생성, 이미 있어도 오류 없음",
    "create_message": "ctx.session.create_message() — 서버가 클라이언트에 LLM 추론을 요청하는 Sampling 핵심 API",
    "SamplingMessage": "Sampling 요청에 담는 대화 메시지 타입. role(user/assistant) + content(TextContent) 포함",
    "TextContent": "MCP에서 텍스트 콘텐츠를 담는 타입. type='text' + text(문자열) 구조",
    "temperature_zero": "LLM의 temperature=0.0 설정 — 출력에 무작위성을 없애 매번 같은 결과를 유도 (분류 작업에 적합)",
    "mcp_tool": "LLM이 호출 여부를 결정하고 AI 앱이 실제 실행하는 함수. @mcp.tool()로 등록",
    "ctx_auto_inject": "FastMCP가 Context 타입 파라미터를 자동으로 주입 — 클라이언트가 별도로 전달하지 않아도 됨",
    "sampling_callback_type": "서버의 create_message() 요청이 올 때 자동 실행되는 클라이언트 콜백 함수",
    "CreateMessageRequestParams": "서버가 보낸 Sampling 요청 파라미터. messages·systemPrompt·maxTokens·temperature 포함",
    "CreateMessageResult": "클라이언트가 Sampling 응답으로 서버에 반환하는 타입. role·content·model·stopReason 포함",
    "AsyncOpenAI": "비동기 OpenAI 클라이언트. base_url만 Groq로 바꾸면 Groq LPU에 연결 가능 (OpenAI 호환 API)",
    "ClientSession": "MCP 서버와 JSON-RPC 메시지를 주고받는 세션 객체. 콜백 등록으로 서버 역요청에 응답 가능",
    "stdio_client": "서버를 자식 프로세스로 실행하고 stdin/stdout 스트림을 연결하는 컨텍스트 매니저"
  }
};
