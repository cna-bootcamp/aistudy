"""start-here/hands-on 예제 설명 페이지 로컬 웹서버.

각 예제의 `explain/index.html`(설명 페이지)을 로컬 웹서버로 띄워 브라우저에서
바로 열어 봄. (`hands-on/explain.py`와 동일한 방식이며, 이 트리에 맞춰 동작함.)

- 서버 루트: 이 스크립트가 있는 `hands-on/`의 상위 디렉터리 (실행 위치(CWD)와 무관)
  launcher(`explain/index.html`)가 URL 경로에서 `/hands-on/` 구간을 찾아
  상대경로를 계산하므로, URL에 반드시 `/hands-on/`이 포함되어야 함
- 설명 페이지는 launcher가 상대경로로 공용 셸 `explain-exam/`을 호출하므로,
  상위 디렉터리를 루트로 두면 설명 페이지가 동작함
- 진입 URL: `index.html`(예제 목록)이 있으면 그것을, 없으면 발견된 첫 설명
  페이지를 엶 (이 트리에는 아직 예제 목록 페이지가 없을 수 있음)

사용법:
    python explain.py            # 기본 포트로 띄우고 브라우저 자동 실행
    python explain.py 9000       # 포트 지정
    python explain.py --no-open  # 브라우저 자동 실행 안 함
"""

import http.server
import socketserver
import sys
import webbrowser
from functools import partial
from pathlib import Path

# launcher가 URL에서 `/hands-on/` 구간을 찾으므로, 서버 루트는 hands-on/의 상위로 둠
HANDS_ON_DIR = Path(__file__).resolve().parent
ROOT = HANDS_ON_DIR.parent
DEFAULT_PORT = 8123


class Handler(http.server.SimpleHTTPRequestHandler):
    """정적 파일 핸들러.

    Windows에서 http.server는 .js MIME을 레지스트리에서 읽어 종종 `text/plain`으로
    내려보냄. 모듈 스크립트(`type="module"`)는 이를 거부하므로, MIME 맵을 명시적으로
    지정해 어떤 환경에서도 올바른 Content-Type을 보장함.
    """

    extensions_map = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".ico": "image/x-icon",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".map": "application/json",
        "": "application/octet-stream",
    }


def parse_args(argv):
    """명령행 인자에서 (포트, 브라우저 자동 실행 여부)를 추출함."""
    port = DEFAULT_PORT
    open_browser = True
    for arg in argv:
        if arg in ("--no-open", "-n"):
            open_browser = False
        elif arg.isdigit():
            port = int(arg)
        else:
            print(f"무시된 인자: {arg}")
    return port, open_browser


def find_entry_path():
    """진입 URL로 쓸, ROOT 기준 상대경로를 정함.

    `hands-on/index.html`(예제 목록)이 있으면 그것을, 없으면 발견된 첫 번째
    `*/explain/index.html`(설명 페이지)을 씀. 둘 다 없으면 hands-on/ 자체를 엶.
    """
    index_html = HANDS_ON_DIR / "index.html"
    if index_html.exists():
        return index_html.relative_to(ROOT).as_posix()

    explain_pages = sorted(HANDS_ON_DIR.glob("*/explain/index.html"))
    if explain_pages:
        return explain_pages[0].relative_to(ROOT).as_posix()

    return HANDS_ON_DIR.relative_to(ROOT).as_posix() + "/"


def main():
    port, open_browser = parse_args(sys.argv[1:])

    # directory 인자로 루트를 hands-on/ 의 상위로 고정 (chdir 사용 안 함)
    handler = partial(Handler, directory=str(ROOT))

    # 포트 재사용 허용 (서버 재시작 시 "Address already in use" 방지)
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", port), handler) as httpd:
        entry_url = f"http://localhost:{port}/{find_entry_path()}"
        explain_pages = sorted(HANDS_ON_DIR.glob("*/explain/index.html"))

        print("=" * 60)
        print(" start-here/hands-on 예제 설명 웹서버 실행 중")
        print("=" * 60)
        print(f" 루트 디렉터리 : {ROOT}")
        print(f" 진입 URL      : {entry_url}")
        if explain_pages:
            print(" 설명 페이지   :")
            for page in explain_pages:
                rel = page.relative_to(ROOT).as_posix()
                print(f"   - http://localhost:{port}/{rel}")
        print(" 종료          : Ctrl+C")
        print("=" * 60)

        if open_browser:
            webbrowser.open(entry_url)

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 종료함.")


if __name__ == "__main__":
    main()
