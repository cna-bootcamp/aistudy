"""인-프로세스 검색 검증 — PatentLawMAS를 직접 호출해 SAS 워크플로 전체를 점검함.

전송 계층(MCP) 없이 검색 파이프라인 자체를 검증함. 특히 advisor가 지적한 'GraphRAG 빈 컨텍스트'
함정을 잡기 위해, GraphRAG 모드(local/global)가 '비어있지 않은 출처'를 돌려주는지 단언함.

완료(PASS) 기준:
  - vector  : 한국어 답변 + 조문 출처('제○조' 라벨) 존재
  - local   : 한국어 답변 + GraphRAG 출처 1건 이상 (빈 컨텍스트가 아님)
  - global  : 한국어 답변 + GraphRAG 출처 1건 이상
  - auto    : 라우팅이 모드를 선택하고 답변 생성
  - kg_stats: 엔티티/관계 수가 0보다 큼

사용법:
  python test_e2e.py
"""
import logging
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

_PROJECT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_PROJECT_DIR))

# LiteLLM의 botocore 경고 등 잡음을 줄임
import os
os.environ.setdefault("LITELLM_LOG", "ERROR")

logging.basicConfig(level=logging.WARNING, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logging.getLogger("patent-mas").setLevel(logging.INFO)
logging.getLogger("mas.nodes").setLevel(logging.INFO)

from mas.graph import PatentLawMAS


def has_korean(text: str) -> bool:
    """문자열에 한글 음절이 하나라도 있는지 판별."""
    return any("가" <= ch <= "힣" for ch in str(text))


def _print_result(label: str, result: dict) -> None:
    """검색 결과 요약을 보기 좋게 출력함."""
    print(f"\n{'─' * 72}")
    print(f"[{label}] requested={result.get('requested_mode')}  "
          f"resolved={result.get('resolved_mode')}  modes_used={result.get('modes_used')}")
    print(f"  route_reason : {result.get('route_reason')}")
    print(f"  supervisor   : {result.get('supervisor_reason')}  (sufficient={result.get('sufficient')})")
    print(f"  sources({len(result.get('sources', []))}) : "
          f"{[s.get('title') for s in result.get('sources', [])[:4]]}")
    print(f"  answer       : {str(result.get('answer', ''))[:280]}")


def run_checks(mas: PatentLawMAS) -> bool:
    """모드별 검색을 실행하고 PASS/FAIL을 집계함."""
    verdicts: dict[str, bool] = {}

    # 1) vector — 조문 원문 정밀 인용
    r = mas.answer("특허를 받을 수 있는 발명의 요건은 무엇인가?", mode="vector")
    _print_result("vector", r)
    has_article = any(re.search(r"제\s*\d+\s*조", s.get("title", "")) for s in r.get("sources", []))
    verdicts["vector_answer"] = has_korean(r.get("answer", "")) and not r.get("error", False)
    verdicts["vector_citation"] = bool(r.get("sources")) and has_article

    # 2) local — GraphRAG 엔티티 관계 (빈 컨텍스트가 아니어야 함: 핵심 검증)
    r = mas.answer("신규성 상실 사유와 관련된 요건과 절차를 알려줘", mode="local")
    _print_result("local", r)
    verdicts["local_answer"] = has_korean(r.get("answer", "")) and not r.get("error", False)
    verdicts["local_context_nonempty"] = len(r.get("sources", [])) > 0

    # 3) global — GraphRAG 커뮤니티 요약
    r = mas.answer("특허 거절이유의 전반적인 종류와 구조를 요약해줘", mode="global")
    _print_result("global", r)
    verdicts["global_answer"] = has_korean(r.get("answer", "")) and not r.get("error", False)
    verdicts["global_context_nonempty"] = len(r.get("sources", [])) > 0

    # 4) auto — 라우팅이 모드를 선택하고 답변 생성
    r = mas.answer("제29조의 특허요건 원문 내용을 알려줘", mode="auto")
    _print_result("auto", r)
    verdicts["auto_routed"] = r.get("resolved_mode") in {"vector", "local", "global", "drift"}
    verdicts["auto_answer"] = has_korean(r.get("answer", "")) and not r.get("error", False)

    # 5) kg_stats — KG 규모가 0보다 큼
    stats = mas.kg_stats()
    print(f"\n{'─' * 72}\n[kg_stats] {stats}")
    verdicts["kg_stats"] = stats.get("entity_count", 0) > 0 and stats.get("relationship_count", 0) > 0

    print(f"\n{'=' * 72}\n[인-프로세스 검색 종합 판정]")
    for name, ok in verdicts.items():
        print(f"  {name:24} : {'PASS' if ok else 'FAIL'}")
    all_pass = all(verdicts.values())
    print(f"\n  전체: {'ALL PASS' if all_pass else 'FAIL'}")
    return all_pass


def main() -> int:
    print("PatentLawMAS 초기화 중...")
    mas = PatentLawMAS()
    ok = run_checks(mas)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
