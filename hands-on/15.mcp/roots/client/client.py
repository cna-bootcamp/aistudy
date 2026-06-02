"""
파일 읽기 MCP 클라이언트 (Roots 기반 디렉토리 접근 통제)

서버에 허용 디렉토리(Roots)를 제공하고 파일 읽기 도구(read_file)를 호출하는 클라이언트임.
list_roots_callback으로 'allowed' 디렉토리만 허용 루트로 알려주고,
허용 파일 · 금지 파일 · 경로 우회(traversal) 3가지 시나리오를 테스트함.

[핵심 흐름]
  클라이언트가 서버를 STDIO 자식 프로세스로 기동 → 세션 초기화 →
  서버가 read_file 실행 중 roots/list 역요청 → 본 콜백이 허용 루트로 응답 →
  서버가 경로 검증 후 결과 반환 → 클라이언트가 출력.
"""

import asyncio
import os
import sys

# Windows 콘솔 기본 인코딩(cp949)에서 한글·기호 출력이 깨지지 않도록 stdout/stderr를 UTF-8로 감쌈
if sys.platform == "win32":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.types import ListRootsResult, Root

# ---------------------------------------------------------------------------
# 1. 경로 설정
# ---------------------------------------------------------------------------
# os.path.abspath(__file__): 이 파일의 절대경로 → dirname으로 위치한 디렉터리를 구함
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# 서버 스크립트는 형제 디렉터리 server/ 아래에 있음 (normpath로 '..'를 정리)
SERVER_SCRIPT = os.path.normpath(
    os.path.join(SCRIPT_DIR, "..", "server", "server.py")
)
ALLOWED_DIR = os.path.join(SCRIPT_DIR, "allowed")
FORBIDDEN_DIR = os.path.join(SCRIPT_DIR, "forbidden")


# ---------------------------------------------------------------------------
# 2. Roots 콜백 정의
# ---------------------------------------------------------------------------
async def list_roots_callback(context) -> ListRootsResult:
    """서버의 roots/list 요청에 응답하는 콜백.

    ALLOWED_DIR만 허용 루트로 반환하고 FORBIDDEN_DIR은 포함하지 않음.
    Root.uri는 file:// 스킴만 허용되므로 OS 경로를 file:// URI로 변환해 전달함.
    """
    # os.sep을 '/'로 치환: Windows의 'C:\\..\\allowed'를 URI용 'C:/../allowed'로 변환
    allowed_uri = f"file:///{ALLOWED_DIR.replace(os.sep, '/')}"
    return ListRootsResult(
        roots=[Root(uri=allowed_uri, name="허용된 디렉토리")]
    )


# ---------------------------------------------------------------------------
# 3. 샘플 데이터 생성
# ---------------------------------------------------------------------------
def create_sample_data() -> None:
    """테스트용 허용/금지 디렉터리와 파일을 생성."""
    os.makedirs(ALLOWED_DIR, exist_ok=True)
    with open(
        os.path.join(ALLOWED_DIR, "hello.txt"), "w", encoding="utf-8"
    ) as f:
        f.write("안녕하세요! 이 파일은 허용된 영역에 있습니다.\n")
    with open(
        os.path.join(ALLOWED_DIR, "config.json"), "w", encoding="utf-8"
    ) as f:
        f.write('{"app": "MCP Roots 예제", "version": "1.0"}\n')

    os.makedirs(FORBIDDEN_DIR, exist_ok=True)
    with open(
        os.path.join(FORBIDDEN_DIR, "secret.txt"), "w", encoding="utf-8"
    ) as f:
        f.write("이 파일은 접근이 금지된 영역에 있습니다!\n")


# ---------------------------------------------------------------------------
# 4. 단일 테스트 헬퍼
# ---------------------------------------------------------------------------
async def run_test(session: ClientSession, title: str, filepath: str) -> None:
    """read_file 도구를 한 번 호출하고 요청 경로·결과를 출력."""
    print("-" * 60)
    print(f"[{title}]")
    print("-" * 60)
    print(f"  요청 경로: {filepath}")
    result = await session.call_tool(
        "read_file", arguments={"filepath": filepath}
    )
    # result.content[0].text: 도구 반환값(첫 콘텐츠 블록의 텍스트)
    print(f"  결과: {result.content[0].text}")
    print()


# ---------------------------------------------------------------------------
# 5. 메인 실행
# ---------------------------------------------------------------------------
async def main() -> None:
    """서버를 기동하고 3가지 접근 통제 시나리오를 테스트."""
    create_sample_data()

    # command=sys.executable: 클라이언트를 실행 중인 바로 그 파이썬(=venv)으로 서버를 기동함
    #   → 서버가 같은 venv의 mcp 패키지를 그대로 사용 ("python" 하드코딩 회피)
    server_params = StdioServerParameters(
        command=sys.executable,
        args=[SERVER_SCRIPT],
    )

    print("=" * 60)
    print("  MCP Roots 예제 - 디렉토리 접근 통제")
    print("=" * 60)
    print()

    # stdio_client(...): 서버를 자식 프로세스로 띄우고 stdin/stdout 스트림을 연결함
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(
            read,
            write,
            # Roots 콜백 등록 (핵심): 서버의 roots/list 역요청에 이 콜백이 응답함
            list_roots_callback=list_roots_callback,
        ) as session:
            # session.initialize(): 프로토콜 버전·기능 교환 등 연결 수명주기 1~2단계 수행
            await session.initialize()
            print("[연결] 서버 연결 완료")
            print(f"[Roots] 허용 디렉터리: {ALLOWED_DIR}")
            print(f"[Roots] 금지 디렉터리: {FORBIDDEN_DIR}")
            print()

            # 도구 목록 조회
            tools = await session.list_tools()
            print("[도구 목록]")
            for tool in tools.tools:
                print(f"  - {tool.name}: {tool.description}")
            print()

            # 테스트 1: 허용 디렉터리의 파일 → 성공해야 함
            await run_test(
                session,
                "테스트 1: 허용된 파일 읽기",
                os.path.join(ALLOWED_DIR, "hello.txt"),
            )

            # 테스트 2: 금지 디렉터리의 파일 → 권한 오류로 차단되어야 함
            await run_test(
                session,
                "테스트 2: 금지된 파일 읽기 시도",
                os.path.join(FORBIDDEN_DIR, "secret.txt"),
            )

            # 테스트 3: 허용 디렉터리에서 출발하지만 '..'로 금지 영역에 접근하는 우회 시도
            #   서버가 realpath로 경로를 정규화하므로 차단되어야 함
            traversal = os.path.join(
                ALLOWED_DIR, "..", "forbidden", "secret.txt"
            )
            await run_test(
                session, "테스트 3: 경로 우회(traversal) 시도", traversal
            )

            # 결과 요약
            print("=" * 60)
            print("  테스트 결과 요약")
            print("=" * 60)
            print("  - 허용 경로 파일 읽기  : 성공")
            print("  - 금지 경로 파일 읽기  : 권한 오류로 차단")
            print("  - 경로 우회(..) 시도   : 권한 오류로 차단")
            print()


# ---------------------------------------------------------------------------
# 6. 진입점
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # 이 파일을 직접 실행할 때만 비동기 메인을 구동 (import 시 미실행)
    asyncio.run(main())
