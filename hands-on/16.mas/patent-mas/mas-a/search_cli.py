"""단건 질의 CLI — SAS 워크플로를 커맨드라인에서 즉시 실행해 보는 도구.

MCP 서버를 띄우지 않고도 PatentLawMAS를 직접 호출해, 라우팅·검색·평가·융합 흐름과
선택된 모드/근거를 한눈에 확인함. 학습·디버깅·데모용.

사용법:
  python search_cli.py "특허를 받을 수 있는 요건은?"
  python search_cli.py "제29조 특허요건 원문" --mode vector
  python search_cli.py "무효심판과 정정심판의 관계" --mode drift
  python search_cli.py "신규성 요건과 절차"            # 기본 mode=auto

옵션:
  --mode   auto | vector | local | global | drift  (기본 auto)
"""
import argparse
import logging
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import os
os.environ.setdefault("LITELLM_LOG", "ERROR")

_PROJECT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_PROJECT_DIR))

# 진행 로그는 INFO로, 라이브러리 잡음은 억제
logging.basicConfig(level=logging.WARNING, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logging.getLogger("patent-mas").setLevel(logging.INFO)
logging.getLogger("mas.nodes").setLevel(logging.INFO)

from mas.graph import PatentLawMAS, VALID_REQUEST_MODES


def _print(result: dict) -> None:
    """검색 결과를 사람이 읽기 좋게 출력함."""
    print("\n" + "=" * 72)
    print(f"[질문] {result.get('question')}")
    print("=" * 72)
    print(f"[라우팅] requested={result.get('requested_mode')} → resolved={result.get('resolved_mode')}"
          f"  (LLM폴백={result.get('used_llm_fallback')})")
    print(f"  근거: {result.get('route_reason')}")
    print(f"[감독] sufficient={result.get('sufficient')}  reroutes={result.get('reroutes')}"
          f"  modes_used={result.get('modes_used')}")
    print(f"  근거: {result.get('supervisor_reason')}")
    if result.get("note"):
        print(f"[비고] {result.get('note')}")
    print("\n[답변]\n" + str(result.get("answer", "")))
    sources = result.get("sources", [])
    print("\n" + "-" * 72)
    print(f"[출처] {len(sources)}건")
    for index, src in enumerate(sources[:8], start=1):
        title = src.get("title", "")
        snippet = str(src.get("content", ""))[:70].replace("\n", " ")
        print(f"  [{index}] ({src.get('type')}) {title}: {snippet}...")
    print("=" * 72)


def main() -> int:
    parser = argparse.ArgumentParser(description="특허법 법령지식 MAS 단건 질의 CLI")
    parser.add_argument("query", nargs="+", help="특허법 질문")
    parser.add_argument("--mode", default="auto", choices=sorted(VALID_REQUEST_MODES),
                        help="검색 모드 (기본 auto)")
    args = parser.parse_args()
    query = " ".join(args.query).strip()

    print(f"PatentLawMAS 초기화 중... (mode={args.mode})")
    mas = PatentLawMAS()
    result = mas.answer(query, mode=args.mode)
    _print(result)
    return 1 if result.get("error") else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(f"\n[오류] 실행 실패: {error}", file=sys.stderr)
        sys.exit(1)
