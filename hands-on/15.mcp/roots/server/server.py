"""
파일 읽기 MCP 서버 (Roots 기반 디렉토리 접근 통제)

클라이언트가 제공한 Roots(허용 디렉토리)를 기준으로 파일 시스템 접근을 통제하는 MCP 서버임.
서버는 파일을 읽기 전에 ① 클라이언트에 허용 루트 목록을 요청(list_roots)하고,
② 요청 경로가 허용 루트 범위 안에 있는지 검증한 뒤, ③ 허용된 경우에만 내용을 반환함.

[보안 설계 포인트]
  - realpath로 심볼릭 링크·'..' 상위 이동을 해소한 뒤 검증 → 경로 우회(traversal) 차단
  - commonpath로 "루트의 하위 경로인지"를 정확히 판정 → naive startswith의 접두사 오판 방지
"""

import os
import sys
from typing import Annotated
from urllib.parse import unquote, urlparse

# url2pathname: file:// URI의 경로 부분을 현재 OS의 실제 파일 경로로 변환함
from urllib.request import url2pathname

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.session import ServerSession

# ---------------------------------------------------------------------------
# 1. FastMCP 서버 생성
# ---------------------------------------------------------------------------
# FastMCP("이름"): 타입 힌트와 docstring만으로 도구의 JSON Schema를 자동 생성하는 서버 객체
mcp = FastMCP("File-Reader")


# ---------------------------------------------------------------------------
# 2. URI → 경로 변환
# ---------------------------------------------------------------------------
def uri_to_path(uri: str) -> str:
    """file:// URI를 현재 OS의 실제 파일 경로로 변환.

    urlparse로 URI에서 경로 부분만 떼어낸 뒤 url2pathname으로 OS별 경로로 바꿈.
      - Windows : 'file:///C:/dir' → 경로 '/C:/dir' → 'C:\\dir'
      - mac/Linux: 'file:///home/u' → 경로 '/home/u' → '/home/u'
    unquote는 URI에 인코딩된 문자(예: 공백 '%20')를 원래 문자로 복원함.
    """
    parsed = urlparse(uri)
    return url2pathname(unquote(parsed.path))


# ---------------------------------------------------------------------------
# 3. Roots 조회 및 경로 검증
# ---------------------------------------------------------------------------
async def get_allowed_roots(
    ctx: Context[ServerSession, None, None],
) -> list[str]:
    """클라이언트에 허용 루트 목록을 요청하고 OS 경로 리스트로 변환해 반환.

    ctx.session.list_roots(): 서버 → 클라이언트로 보내는 roots/list 역방향 요청.
    클라이언트가 list_roots_callback에서 돌려준 Root 목록을 받아옴.
    """
    result = await ctx.session.list_roots()
    paths: list[str] = []
    for root in result.roots:
        # str(root.uri): pydantic FileUrl 객체를 문자열로 변환 (예: 'file:///C:/...')
        raw_uri = str(root.uri)
        path = uri_to_path(raw_uri)
        # file:// URI가 OS 경로로 어떻게 변환되는지 확인용 로그.
        # stdout은 JSON-RPC 채널이므로 서버 로그는 반드시 stderr로 출력해야 함.
        print(f"[server] root uri={raw_uri!r} -> path={path!r}", file=sys.stderr)
        paths.append(path)
    return paths


def is_path_allowed(filepath: str, allowed_roots: list[str]) -> bool:
    """요청 경로가 허용 루트 중 하나의 하위(또는 자신)인지 검증.

    os.path.realpath : '..'·심볼릭 링크를 모두 해소한 정규 절대경로를 구함 → traversal 방지.
    os.path.commonpath([경로, 루트]): 두 경로의 공통 상위 경로를 구함.
      공통 경로가 루트와 같으면 → 요청 경로는 루트의 하위임 → 허용.
    서로 다른 드라이브(Windows)면 commonpath가 ValueError → 해당 루트는 건너뜀.
    """
    abs_path = os.path.realpath(filepath)
    for root in allowed_roots:
        abs_root = os.path.realpath(root)
        try:
            if os.path.commonpath([abs_path, abs_root]) == abs_root:
                return True
        except ValueError:
            # 드라이브가 다르면 공통 경로가 없어 ValueError가 발생함
            continue
    return False


# ---------------------------------------------------------------------------
# 4. 도구(Tool) 정의
# ---------------------------------------------------------------------------
@mcp.tool()
async def read_file(
    filepath: Annotated[str, "읽을 파일의 절대 경로"],
    ctx: Context[ServerSession, None, None],
) -> str:
    """파일 내용을 읽어 반환. 허용 루트 범위 밖이면 권한 오류를 반환함.

    클라이언트가 제공한 Roots 범위 내의 파일만 접근 가능하며,
    범위를 벗어나면 파일을 열지 않고 권한 오류 메시지를 돌려줌.
    """
    # ctx.info(): 진행 상황을 로그 알림으로 클라이언트에 전송함
    await ctx.info("클라이언트에 허용 루트 목록 요청 중...")
    allowed_roots = await get_allowed_roots(ctx)

    if not allowed_roots:
        return "[오류] 클라이언트가 허용한 루트가 없음"

    await ctx.info(f"허용된 루트: {allowed_roots}")

    # 경로 검증: 허용 범위를 벗어나면 파일을 열지 않고 즉시 차단
    if not is_path_allowed(filepath, allowed_roots):
        await ctx.warning(f"접근 차단: '{filepath}'는 허용 범위 밖")
        return (
            f"[권한 오류] '{filepath}'는 허용된 루트 범위를 벗어남\n"
            f"허용된 루트: {allowed_roots}"
        )

    # 존재·종류 확인
    if not os.path.exists(filepath):
        return f"[오류] 파일을 찾을 수 없음: {filepath}"
    if not os.path.isfile(filepath):
        return f"[오류] '{filepath}'는 파일이 아님"

    # 파일 읽기
    try:
        # with 블록을 벗어나면 파일이 자동으로 닫힘
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        await ctx.info(f"파일 읽기 성공: {filepath}")
        return content
    except UnicodeDecodeError:
        return "[오류] 텍스트 파일이 아님 (바이너리 파일)"
    except Exception as e:
        return f"[오류] {e}"


# ---------------------------------------------------------------------------
# 5. 서버 실행
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # 이 파일을 직접 실행할 때만 서버를 STDIO 전송으로 기동 (import 시 미실행)
    mcp.run()
