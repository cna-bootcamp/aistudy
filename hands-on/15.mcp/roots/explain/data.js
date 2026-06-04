window.EXPLAIN_DATA = {
  meta: { title: "MCP Roots — 디렉토리 접근 통제", entry: "client.py" },
  files: [
    { id: "client", label: "client.py", role: "MCP 클라이언트 — Roots 콜백 등록 + 3가지 접근 시나리오 테스트" },
    { id: "server", label: "server.py", role: "MCP 서버 — 허용 루트 검증 후 파일 읽기" }
  ],
  flow: [
    { step: 1, title: "테스트 파일 생성", label: "테스트 파일 생성", refs: ["create_sample_data"], summary: "allowed/ 와 forbidden/ 디렉터리에 테스트 파일 생성", detail: "실험용 파일을 미리 만들어 둡니다. allowed/에는 열어봐도 되는 파일, forbidden/에는 접근이 금지된 파일을 넣습니다." },
    { step: 2, title: "서버 연결 + Roots 콜백 등록", label: "Roots 콜백 등록", refs: ["main_client", "list_roots_callback"], summary: "ClientSession에 list_roots_callback을 등록", detail: "콜백을 등록하면 클라이언트가 서버에 'Roots 기능을 지원합니다'라고 선언합니다. 서버가 나중에 어떤 디렉터리가 허용되는지 물어볼 수 있게 됩니다." },
    { step: 3, title: "허용 경로 테스트", label: "허용 경로 테스트", refs: ["read_file_tool", "is_path_allowed"], summary: "allowed/hello.txt 읽기 → 성공", detail: "허용 디렉터리 안의 파일이므로 내용을 그대로 반환합니다." },
    { step: 4, title: "금지 경로 테스트", label: "금지 경로 테스트", refs: ["read_file_tool", "is_path_allowed"], summary: "forbidden/secret.txt 읽기 → 차단", detail: "허용 루트(allowed/) 범위 밖이므로 서버가 권한 오류를 반환합니다. 파일을 열지도 않습니다." },
    { step: 5, title: "경로 우회 테스트", label: "경로 우회 테스트", refs: ["is_path_allowed", "get_allowed_roots"], summary: "allowed/../forbidden/secret.txt → 차단", detail: "'..'으로 상위 폴더로 나간 뒤 forbidden/에 접근하려는 시도입니다. 서버가 realpath로 정규화하므로 차단됩니다." }
  ],
  functions: [
    {
      id: "list_roots_callback",
      name: "list_roots_callback()",
      fileId: "client",
      summary: "서버의 roots/list 역요청에 응답하는 콜백 — 허용 디렉터리 목록 반환",
      how: "서버가 read_file을 실행하다가 '어느 디렉터리가 허용돼?'라고 역방향으로 물어올 때 이 콜백이 자동 호출됩니다. ALLOWED_DIR만 허용 루트로 알려주고 FORBIDDEN_DIR은 포함하지 않습니다.",
      terms: ["Roots", "file_uri", "ListRootsResult"],
      lines: [
        { at: "async def list_roots_callback(context) -> ListRootsResult:", text: "서버의 roots/list 요청이 올 때 자동 호출되는 콜백 함수" },
        { at: 'allowed_uri = f"file:///{ALLOWED_DIR.replace(os.sep, \'/\')}"', text: "Windows 경로의 역슬래시를 /로 바꿔 file:// URI 형식으로 변환" },
        { at: 'roots=[Root(uri=allowed_uri, name="허용된 디렉토리")]', text: "ALLOWED_DIR만 허용 루트로 반환 — FORBIDDEN_DIR은 포함하지 않음" }
      ],
      code: `async def list_roots_callback(context) -> ListRootsResult:
    """서버의 roots/list 요청에 응답하는 콜백.

    ALLOWED_DIR만 허용 루트로 반환하고 FORBIDDEN_DIR은 포함하지 않음.
    """
    allowed_uri = f"file:///{ALLOWED_DIR.replace(os.sep, '/')}"
    return ListRootsResult(
        roots=[Root(uri=allowed_uri, name="허용된 디렉토리")]
    )`
    },
    {
      id: "create_sample_data",
      name: "create_sample_data()",
      fileId: "client",
      summary: "테스트용 허용/금지 디렉터리와 파일을 생성",
      how: "os.makedirs(exist_ok=True)로 디렉터리를 만들고(이미 있어도 오류 없음), open()으로 파일을 씁니다. allowed/에는 읽어도 되는 파일, forbidden/에는 접근이 금지된 파일을 넣습니다.",
      terms: ["makedirs_exist_ok", "open_with"],
      lines: [
        { at: "os.makedirs(ALLOWED_DIR, exist_ok=True)", text: "exist_ok=True: 디렉터리가 이미 있어도 오류 없이 통과" },
        { at: 'os.path.join(ALLOWED_DIR, "hello.txt"), "w"', text: "with open() 블록 — 블록을 나가면 파일이 자동으로 닫힘" },
        { at: 'f.write("안녕하세요! 이 파일은 허용된 영역에 있습니다.\\n")', text: "허용 영역 파일 내용 작성" },
        { at: 'f.write("이 파일은 접근이 금지된 영역에 있습니다!\\n")', text: "금지 영역 파일 — 서버가 이 파일 읽기를 차단해야 함" }
      ],
      code: `def create_sample_data() -> None:
    """테스트용 허용/금지 디렉터리와 파일을 생성."""
    os.makedirs(ALLOWED_DIR, exist_ok=True)
    with open(
        os.path.join(ALLOWED_DIR, "hello.txt"), "w", encoding="utf-8"
    ) as f:
        f.write("안녕하세요! 이 파일은 허용된 영역에 있습니다.\\n")
    with open(
        os.path.join(ALLOWED_DIR, "config.json"), "w", encoding="utf-8"
    ) as f:
        f.write('{"app": "MCP Roots 예제", "version": "1.0"}\\n')

    os.makedirs(FORBIDDEN_DIR, exist_ok=True)
    with open(
        os.path.join(FORBIDDEN_DIR, "secret.txt"), "w", encoding="utf-8"
    ) as f:
        f.write("이 파일은 접근이 금지된 영역에 있습니다!\\n")`
    },
    {
      id: "main_client",
      name: "main()",
      fileId: "client",
      summary: "서버를 기동하고 3가지 접근 통제 시나리오를 테스트",
      how: "ClientSession 생성 시 list_roots_callback을 등록하는 것이 핵심입니다. 서버가 나중에 허용 루트를 물어올 때 이 콜백이 자동 실행됩니다.",
      terms: ["ClientSession", "stdio_client", "list_roots_callback"],
      lines: [
        { at: "list_roots_callback=list_roots_callback,", text: "Roots 콜백 등록 — 서버의 roots/list 역요청에 이 함수가 응답함" },
        { at: "await session.initialize()", text: "프로토콜 협상 — capabilities 교환 (Roots 지원 선언 포함)" },
        { at: '"테스트 1: 허용된 파일 읽기"', text: "allowed/hello.txt — 허용 범위 안이므로 성공해야 함" },
        { at: '"테스트 2: 금지된 파일 읽기 시도"', text: "forbidden/secret.txt — 허용 범위 밖이므로 차단되어야 함" },
        { at: '"테스트 3: 경로 우회(traversal) 시도"', text: "allowed/../forbidden/secret.txt — '..'으로 우회 시도, 서버가 차단해야 함" }
      ],
      code: `async def main() -> None:
    """서버를 기동하고 3가지 접근 통제 시나리오를 테스트."""
    create_sample_data()

    server_params = StdioServerParameters(
        command=sys.executable,
        args=[SERVER_SCRIPT],
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(
            read,
            write,
            list_roots_callback=list_roots_callback,
        ) as session:
            await session.initialize()
            print("[연결] 서버 연결 완료")

            await run_test(
                session,
                "테스트 1: 허용된 파일 읽기",
                os.path.join(ALLOWED_DIR, "hello.txt"),
            )

            await run_test(
                session,
                "테스트 2: 금지된 파일 읽기 시도",
                os.path.join(FORBIDDEN_DIR, "secret.txt"),
            )

            traversal = os.path.join(
                ALLOWED_DIR, "..", "forbidden", "secret.txt"
            )
            await run_test(
                session, "테스트 3: 경로 우회(traversal) 시도", traversal
            )`
    },
    {
      id: "uri_to_path",
      name: "uri_to_path()",
      fileId: "server",
      summary: "file:// URI를 현재 OS의 실제 파일 경로로 변환",
      how: "클라이언트가 Root를 file:// URI 형식으로 보내기 때문에, 서버에서 실제 파일 시스템 경로로 변환해야 합니다. Windows는 'C:\\dir' 형태, macOS/Linux는 '/home/user' 형태로 변환됩니다.",
      terms: ["urlparse", "url2pathname", "unquote"],
      lines: [
        { at: "def uri_to_path(uri: str) -> str:", text: "file:// URI를 OS별 실제 경로로 변환하는 함수" },
        { at: "parsed = urlparse(uri)", text: "URI를 scheme/path 등 구성요소로 분해" },
        { at: "return url2pathname(unquote(parsed.path))", text: "URL 인코딩(%20 등) 해제 후 OS 경로 형식으로 변환" }
      ],
      code: `def uri_to_path(uri: str) -> str:
    """file:// URI를 현재 OS의 실제 파일 경로로 변환.

    - Windows : 'file:///C:/dir' → 'C:\\\\dir'
    - mac/Linux: 'file:///home/u' → '/home/u'
    """
    parsed = urlparse(uri)
    return url2pathname(unquote(parsed.path))`
    },
    {
      id: "get_allowed_roots",
      name: "get_allowed_roots()",
      fileId: "server",
      summary: "클라이언트에 허용 루트 목록을 역요청하고 OS 경로 리스트로 반환",
      how: "서버가 클라이언트에게 역방향으로 요청하는 것이 핵심입니다. ctx.session.list_roots()가 서버→클라이언트 방향의 요청을 보내고, 클라이언트의 list_roots_callback이 응답을 돌려줍니다.",
      terms: ["ctx_session", "list_roots_server_request", "stderr_log"],
      lines: [
        { at: "result = await ctx.session.list_roots()", text: "서버→클라이언트 역방향 요청 — 클라이언트의 list_roots_callback이 응답" },
        { at: "raw_uri = str(root.uri)", text: "pydantic FileUrl 객체를 문자열로 변환" },
        { at: 'print(f"[server] root uri={raw_uri!r} -> path={path!r}", file=sys.stderr)', text: "STDIO에서는 stdout이 JSON-RPC 채널 — 진단 로그는 반드시 stderr로 출력" }
      ],
      code: `async def get_allowed_roots(
    ctx: Context[ServerSession, None, None],
) -> list[str]:
    """클라이언트에 허용 루트 목록을 요청하고 OS 경로 리스트로 변환해 반환."""
    result = await ctx.session.list_roots()
    paths: list[str] = []
    for root in result.roots:
        raw_uri = str(root.uri)
        path = uri_to_path(raw_uri)
        print(f"[server] root uri={raw_uri!r} -> path={path!r}", file=sys.stderr)
        paths.append(path)
    return paths`
    },
    {
      id: "is_path_allowed",
      name: "is_path_allowed()",
      fileId: "server",
      summary: "요청 경로가 허용 루트의 하위 경로인지 검증 — 경로 우회 공격 차단",
      how: "os.path.realpath로 '..'과 심볼릭 링크를 완전히 해소한 뒤 commonpath로 비교합니다. 단순 startswith는 '/allowed2'가 '/allowed'로 시작한다고 통과시키는 오판을 일으킬 수 있어 commonpath를 사용합니다.",
      terms: ["realpath", "commonpath", "path_traversal"],
      lines: [
        { at: "abs_path = os.path.realpath(filepath)", text: "'..'과 심볼릭 링크를 해소한 정규 절대경로 — traversal 공격 차단" },
        { at: "abs_root = os.path.realpath(root)", text: "루트 경로도 동일하게 정규화" },
        { at: "if os.path.commonpath([abs_path, abs_root]) == abs_root:", text: "공통 상위 경로가 루트와 같으면 → 요청 경로는 루트의 하위임 → 허용" },
        { at: "except ValueError:", text: "Windows에서 드라이브가 다르면 commonpath가 ValueError → 해당 루트 건너뜀" },
        { at: "return False", text: "어느 허용 루트와도 일치하지 않으면 접근 거부" }
      ],
      code: `def is_path_allowed(filepath: str, allowed_roots: list[str]) -> bool:
    """요청 경로가 허용 루트 중 하나의 하위(또는 자신)인지 검증."""
    abs_path = os.path.realpath(filepath)
    for root in allowed_roots:
        abs_root = os.path.realpath(root)
        try:
            if os.path.commonpath([abs_path, abs_root]) == abs_root:
                return True
        except ValueError:
            continue
    return False`
    },
    {
      id: "read_file_tool",
      name: "read_file()",
      fileId: "server",
      summary: "허용 루트 범위 안의 파일만 읽어주는 MCP 도구",
      how: "실행 단계가 명확합니다. ① 클라이언트에 허용 루트 요청 → ② 경로 검증 → ③ 파일 읽기. 경로 검증을 통과하지 못하면 파일을 열지도 않고 즉시 오류 메시지를 반환합니다.",
      terms: ["mcp_tool", "ctx_info", "ctx_warning", "Annotated"],
      lines: [
        { at: "@mcp.tool()", text: "이 함수를 MCP 도구로 등록" },
        { at: 'filepath: Annotated[str, "읽을 파일의 절대 경로"]', text: "Annotated로 파라미터에 추가 설명을 붙임 — JSON Schema의 description으로 변환됨" },
        { at: 'await ctx.info("클라이언트에 허용 루트 목록 요청 중...")', text: "ctx.info(): 진행 상황을 로그 알림으로 클라이언트에 전송" },
        { at: "if not is_path_allowed(filepath, allowed_roots):", text: "경로 검증 실패 → 파일을 열지 않고 즉시 차단" },
        { at: 'await ctx.warning(f"접근 차단:', text: "ctx.warning(): 경고 수준의 알림을 클라이언트에 전송" },
        { at: 'with open(filepath, "r", encoding="utf-8") as f:', text: "검증 통과 시에만 파일을 열어 읽음" }
      ],
      code: `@mcp.tool()
async def read_file(
    filepath: Annotated[str, "읽을 파일의 절대 경로"],
    ctx: Context[ServerSession, None, None],
) -> str:
    """파일 내용을 읽어 반환. 허용 루트 범위 밖이면 권한 오류를 반환함."""
    await ctx.info("클라이언트에 허용 루트 목록 요청 중...")
    allowed_roots = await get_allowed_roots(ctx)

    if not allowed_roots:
        return "[오류] 클라이언트가 허용한 루트가 없음"

    await ctx.info(f"허용된 루트: {allowed_roots}")

    if not is_path_allowed(filepath, allowed_roots):
        await ctx.warning(f"접근 차단: '{filepath}'는 허용 범위 밖")
        return (
            f"[권한 오류] '{filepath}'는 허용된 루트 범위를 벗어남\\n"
            f"허용된 루트: {allowed_roots}"
        )

    if not os.path.exists(filepath):
        return f"[오류] 파일을 찾을 수 없음: {filepath}"
    if not os.path.isfile(filepath):
        return f"[오류] '{filepath}'는 파일이 아님"

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        await ctx.info(f"파일 읽기 성공: {filepath}")
        return content
    except UnicodeDecodeError:
        return "[오류] 텍스트 파일이 아님 (바이너리 파일)"
    except Exception as e:
        return f"[오류] {e}"`
    }
  ],
  glossary: {
    "Roots": "클라이언트가 서버에 알려주는 '허용 디렉터리 목록'. 서버는 이 범위 안의 파일만 접근할 수 있음",
    "file_uri": "file:// 스킴을 사용하는 URI. 예: file:///C:/Users/allowed — 로컬 파일 경로를 URI 형식으로 표현",
    "ListRootsResult": "Roots 콜백이 반환하는 타입. roots 리스트에 허용할 Root 객체들을 담음",
    "makedirs_exist_ok": "os.makedirs(path, exist_ok=True) — 디렉터리가 이미 있어도 오류 없이 통과하는 옵션",
    "open_with": "with open(path, mode, encoding) as f: — 블록을 나가면 파일이 자동으로 닫히는 파이썬 패턴",
    "ClientSession": "MCP 서버와 JSON-RPC 메시지를 주고받는 세션 객체. 콜백을 등록해 서버 역요청에 응답 가능",
    "stdio_client": "서버를 자식 프로세스로 실행하고 stdin/stdout 스트림을 연결하는 컨텍스트 매니저",
    "list_roots_callback": "서버가 roots/list를 역요청할 때 클라이언트가 응답하는 콜백 함수",
    "urlparse": "URL/URI를 scheme·path·query 등 구성요소로 분해하는 파이썬 표준 라이브러리 함수",
    "url2pathname": "file:// URI의 경로 부분을 현재 OS의 실제 파일 경로로 변환하는 함수",
    "unquote": "URI에 인코딩된 문자(예: 공백 '%20')를 원래 문자로 복원하는 함수",
    "ctx_session": "MCP 도구의 ctx 파라미터에서 접근하는 서버 세션. ctx.session.list_roots()로 역방향 요청 가능",
    "list_roots_server_request": "서버→클라이언트 방향의 roots/list 요청. 클라이언트의 콜백이 허용 루트 목록으로 응답",
    "stderr_log": "STDIO 전송에서 stdout은 JSON-RPC 채널 — 진단 로그는 반드시 sys.stderr로 출력해야 함",
    "realpath": "os.path.realpath(path) — '..'·심볼릭 링크를 모두 해소한 정규 절대경로를 반환",
    "commonpath": "os.path.commonpath([a, b]) — 두 경로의 공통 상위 경로를 반환. 하위 경로 판별에 사용",
    "path_traversal": "경로 우회 공격. '../' 등으로 허용 범위 밖 디렉터리에 접근하려는 시도",
    "mcp_tool": "LLM이 호출 여부를 결정하고 AI 앱이 실제 실행하는 함수. @mcp.tool()로 등록",
    "ctx_info": "ctx.info(message) — 진행 상황을 정보 알림으로 클라이언트에 전송",
    "ctx_warning": "ctx.warning(message) — 경고 수준의 알림을 클라이언트에 전송",
    "Annotated": "typing.Annotated[타입, 설명] — 파라미터에 추가 메타데이터를 붙이는 파이썬 타입 힌트"
  }
};
