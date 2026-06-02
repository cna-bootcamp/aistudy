#!/usr/bin/env python3
"""오프라인 RAGAS 평가용 테스트셋 로더 — 11.rag-tuning/ragas 의 검증된 테스트셋을 재사용함.

[왜 재사용인가]
  hands-on/11.rag-tuning/ragas/test_dataset.py 의 22개 케이스는 특허법.pdf 원문 조문과 대조
  확인된 (질문+정답) 세트임. MAS A 검색 품질(Context Precision/Recall)과 MAS C 답변 환각률
  (Faithfulness)을 같은 기준으로 측정하기 위해 동일 테스트셋을 그대로 가져와 씀(중복 작성 금지).

[로딩 방식]
  두 파일 모두 이름이 test_dataset.py 라 sys.path import 시 충돌하므로, importlib 로 원본 파일
  경로를 직접 지정해 로드함(이름 충돌 회피, 의존성 없음 — 순수 dict 리스트만 반환).
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

# evaluate/ → parents[0]=evaluate, [1]=mas-c, [2]=patent-mas, [3]=16.mas, [4]=hands-on
_HANDS_ON = Path(__file__).resolve().parents[4]
_RAGAS_TESTSET = _HANDS_ON / "11.rag-tuning" / "ragas" / "test_dataset.py"


def _load_source_module():
    """11.rag-tuning/ragas/test_dataset.py 를 고유 모듈명으로 로드함(이름 충돌 회피)."""
    if not _RAGAS_TESTSET.exists():
        raise FileNotFoundError(
            f"재사용할 테스트셋을 찾을 수 없음: {_RAGAS_TESTSET}\n"
            f"hands-on/11.rag-tuning/ragas/test_dataset.py 가 있는지 확인하세요."
        )
    spec = importlib.util.spec_from_file_location("ragas_testset_source", _RAGAS_TESTSET)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def get_test_dataset() -> list[dict]:
    """질문·정답 테스트 케이스 리스트를 반환함 (각 원소: question/ground_truth/...)."""
    return _load_source_module().get_test_dataset()


if __name__ == "__main__":
    import sys

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    cases = get_test_dataset()
    print(f"재사용 테스트셋 로드 완료: {len(cases)}개 케이스 (출처: 11.rag-tuning/ragas)")
    for i, c in enumerate(cases[:5], 1):
        print(f"  {i}. {c['question']}")
