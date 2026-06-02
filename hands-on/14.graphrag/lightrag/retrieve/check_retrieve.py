"""LightRAG 검색 예제 오프라인 검증 스크립트.

외부 API 호출 없이 설정, 인덱스 파일, 라우터 기본 동작, 모듈 import 가능 여부를 점검함.
"""
# 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함
from __future__ import annotations

import json
import sys
from pathlib import Path

# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
RETRIEVE_DIR = Path(__file__).resolve().parent
# 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 디렉터리를 추가함
sys.path.insert(0, str(RETRIEVE_DIR))

from config.settings import Settings
from logging_config import configure_logging
from query_router import QueryRouter


def _nano_count(path: Path) -> int:
    """nano-vectordb JSON 파일 레코드 수 반환."""
    if not path.exists():
        return -1
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return len(data.get("data", []))
    except Exception:
        return -1


def _nano_dim(path: Path) -> int:
    """nano-vectordb JSON 파일 임베딩 차원 반환."""
    if not path.exists():
        return -1
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return int(data.get("embedding_dim", -1))
    except Exception:
        return -1


def main() -> None:
    """오프라인 검증 실행."""
    settings = Settings()
    configure_logging(settings)

    checks = [
        ("KG GraphML", settings.kg_dir / "graph_chunk_entity_relation.graphml"),
        ("교재 청크 벡터", settings.kg_dir / "vdb_chunks.json"),
        ("코드 벡터", settings.code_vdb_file),
        ("교재 청크 KV", settings.kg_dir / "kv_store_text_chunks.json"),
    ]

    failed = 0
    print("=" * 60)
    print("LightRAG 검색 예제 오프라인 검증")
    print("=" * 60)
    for label, path in checks:
        ok = path.exists()
        failed += 0 if ok else 1
        print(f"[{'PASS' if ok else 'FAIL'}] {label}: {path}")

    kg_count = _nano_count(settings.kg_dir / "vdb_chunks.json")
    code_count = _nano_count(settings.code_vdb_file)
    code_dim = _nano_dim(settings.code_vdb_file)
    print(f"[INFO] 교재 청크 벡터: {kg_count}개")
    print(f"[INFO] 코드 청크 벡터: {code_count}개 / 차원 {code_dim}")
    if code_dim not in (-1, settings.embedding_dim):
        failed += 1
        print(f"[FAIL] 코드 벡터 차원 불일치: {code_dim} != {settings.embedding_dim}")

    router = QueryRouter(settings)
    samples = [
        "GraphRAG와 Vector RAG의 차이는?",
        "LightRAG 전체 검색 흐름을 요약해줘",
        "Streamlit 예제코드는 어떻게 구현돼?",
    ]
    for sample in samples:
        decision = router.route(sample)
        print(f"[ROUTE] {sample} -> {decision.mode} ({decision.strategy}, {decision.confidence:.2f})")

    if failed:
        print(f"[결과] FAIL {failed}건")
        sys.exit(1)
    print("[결과] PASS")


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
