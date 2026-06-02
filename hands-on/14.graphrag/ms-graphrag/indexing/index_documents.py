#!/usr/bin/env python
"""GraphRAG 3.0 인덱싱 메인 스크립트

교재(KG + Vector)와 예제코드(Vector 전용)를 분리 전략으로 인덱싱함.

사용법:
    python index_documents.py              # 전체 인덱싱
    python index_documents.py --force      # 인덱스 초기화 후 재인덱싱
    python index_documents.py --mode test  # 테스트용 소량 인덱싱 (교재 1 + 예제코드 2)

[전체 흐름]
  1. prepare_input_documents(): 교재(*.md)를 data/input/*.txt로 변환
  2. run_graphrag_index():      graphrag CLI로 교재 KG+Vector 인덱싱
  3. verify_index():            store/parquet 산출물 검증
  4. finalize_indexing():       엔티티/커뮤니티 임베딩 후처리 (DRIFT 지원)
  5. index_code():              예제코드(*.py)를 별도 벡터 인덱스로 구축 (KG 미생성)

[데이터소스 분리 근거]
  - 교재: 개념·기술 간 관계가 풍부 → KG 구축이 효과적
  - 예제코드: 절차적 특성 → 벡터 유사도 검색이 적합
"""
import argparse
import io
import re
import shutil
import subprocess
import sys
import threading
from pathlib import Path

import pandas as pd
from tqdm import tqdm

# ── Windows 콘솔 인코딩 설정 ──
# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 UTF-8로 재설정함
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ── 모듈 검색 경로 등록 ──
# 이 파일이 위치한 indexing/ 디렉터리를 경로에 추가해 하위 모듈을 import함
PROJECT_INDEXING_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_INDEXING_DIR))

from config.settings import settings
from document_loader import GraphRAGDocumentLoader, GraphRAGDocument
from finalize_indexing import finalize_indexing
from code_indexer import index_code
from utils.logger import get_logger
from utils.helpers import ensure_dir

logger = get_logger("index_documents")


# ---------------------------------------------------------------------------
# 1단계: 입력 문서 준비 (교재 → data/input/*.txt)
# ---------------------------------------------------------------------------
def prepare_input_documents(textbook_docs: list[GraphRAGDocument]) -> int:
    """교재 청크를 GraphRAG가 읽는 data/input/*.txt로 내보냄.

    GraphRAG CLI는 input_storage.base_dir(data/input)의 txt 파일만 입력으로 사용함.

    Args:
        textbook_docs: 교재 GraphRAGDocument 리스트

    Returns:
        내보낸 txt 파일 수
    """
    input_dir = settings.input_dir
    ensure_dir(input_dir)

    # 기존 txt를 모두 삭제해 깨끗한 상태에서 시작함
    for old_file in input_dir.glob("*.txt"):
        old_file.unlink()

    exported = 0
    pbar = tqdm(textbook_docs, desc="교재 내보내기", unit="doc", ncols=80)
    for doc in pbar:
        output_path = input_dir / doc.get_output_filename()
        pbar.set_postfix_str(output_path.name[:25])
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(doc.to_text())
            exported += 1
        except Exception as e:
            pbar.write(f"내보내기 실패: {output_path.name} - {e}")

    print(f"교재 내보내기 완료: {exported}개 txt 파일 → {input_dir}")
    return exported


# ---------------------------------------------------------------------------
# 2단계: GraphRAG CLI 인덱싱 (진행바 표시)
# ---------------------------------------------------------------------------
class ProgressTracker:
    """GraphRAG CLI stdout을 파싱하여 tqdm 진행바로 표시함.

    GraphRAG는 "Starting workflow: xxx" / "N / M" / "Workflow complete: xxx" 형태로
    진행 상황을 출력하므로 이를 파싱해 워크플로우·아이템 2단계 진행바를 갱신함.
    """

    # GraphRAG 3.0 표준 워크플로우 순서 (진행바 총량 계산용)
    WORKFLOWS = [
        "load_input_documents", "create_base_text_units", "create_final_documents",
        "extract_graph", "finalize_graph", "create_communities",
        "create_community_reports", "create_final_text_units", "generate_text_embeddings",
    ]

    def __init__(self):
        self.current_workflow = None
        self.item_pbar = None
        self.completed = 0
        # 정규식: "3 / 10" 진행 / "Starting workflow: x" / "Workflow complete: x"
        self.progress_re = re.compile(r"^\s*(\d+)\s*/\s*(\d+)\s*[.\s]*$")
        self.start_re = re.compile(r"Starting workflow:\s*(\w+)")
        self.complete_re = re.compile(r"Workflow complete:\s*(\w+)")
        # 상단 워크플로우 진행바
        self.workflow_pbar = tqdm(
            total=len(self.WORKFLOWS), desc="전체 진행", unit="wf", ncols=80,
            position=0, leave=True,
            bar_format="{desc}: {percentage:3.0f}%|{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]",
        )

    def process_line(self, line: str):
        """CLI 출력 한 줄을 파싱하여 진행바를 갱신함."""
        line = line.rstrip()
        if not line:
            return
        # 워크플로우 시작
        if (m := self.start_re.search(line)):
            self._close_item()
            self.current_workflow = m.group(1)
            self.workflow_pbar.set_postfix_str(self.current_workflow[:25])
            return
        # 워크플로우 완료
        if self.complete_re.search(line):
            self._close_item()
            self.completed += 1
            if self.completed <= len(self.WORKFLOWS):
                self.workflow_pbar.update(1)
            return
        # 아이템 진행 (N / M)
        if (m := self.progress_re.match(line)):
            current, total = int(m.group(1)), int(m.group(2))
            if self.item_pbar is None or self.item_pbar.total != total:
                self._close_item()
                desc = self.current_workflow or "처리중"
                self.item_pbar = tqdm(
                    total=total, desc=f"  {desc[:18]}", unit="item", ncols=80,
                    position=1, leave=False,
                    bar_format="{desc}: {percentage:3.0f}%|{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]",
                )
            if current > self.item_pbar.n:
                self.item_pbar.update(current - self.item_pbar.n)
            return

    @property
    def pbar(self):
        """현재 활성 진행바 반환."""
        return self.item_pbar or self.workflow_pbar

    def _close_item(self):
        if self.item_pbar:
            self.item_pbar.close()
            self.item_pbar = None

    def close(self):
        self._close_item()
        if self.workflow_pbar:
            self.workflow_pbar.close()
            self.workflow_pbar = None


def _stream_output(pipe, tracker: ProgressTracker, is_stderr: bool):
    """subprocess 파이프를 실시간으로 읽어 진행바에 반영함 (스레드에서 실행)."""
    # pipe.readline()은 블로킹이므로 stdout/stderr를 각각 별도 스레드로 처리함
    for line in iter(pipe.readline, ""):
        if not line:
            continue
        if is_stderr:
            stripped = line.rstrip()
            if stripped:
                (tracker.pbar.write if tracker.pbar else print)(f"[WARN] {stripped}")
        else:
            tracker.process_line(line)
    pipe.close()


def run_graphrag_index() -> bool:
    """graphrag CLI로 교재 KG+Vector 인덱싱을 실행함.

    실행 명령: graphrag index --root <indexing_dir>

    Returns:
        성공 여부
    """
    ensure_dir(settings.parquet_dir)
    logger.info("GraphRAG 인덱싱 시작 (Groq LPU: %s)", settings.llm_model)

    print("\n" + "=" * 60)
    print("GraphRAG 인덱싱 진행 상황")
    print("=" * 60)

    try:
        # graphrag를 'python -m graphrag'로 실행해 현재 인터프리터(venv)의 graphrag를 보장함.
        # (PATH의 graphrag.exe가 다른 인터프리터를 가리켜도 영향받지 않음)
        # bufsize=1: 라인 버퍼링으로 실시간 진행 상황 파싱
        process = subprocess.Popen(
            [sys.executable, "-m", "graphrag", "index", "--root", str(settings.indexing_dir)],
            cwd=str(settings.indexing_dir),
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding="utf-8", errors="replace", bufsize=1,
        )
    except FileNotFoundError:
        logger.error("graphrag 모듈을 찾을 수 없음. 'pip install -r requirements.txt' 후 다시 실행하세요.")
        return False

    tracker = ProgressTracker()
    threads = [
        threading.Thread(target=_stream_output, args=(process.stdout, tracker, False)),
        threading.Thread(target=_stream_output, args=(process.stderr, tracker, True)),
    ]
    for t in threads:
        t.start()
    try:
        returncode = process.wait()
    except KeyboardInterrupt:
        process.kill()
        logger.error("사용자 취소로 인덱싱 중단")
        return False
    for t in threads:
        t.join()
    tracker.close()

    print("\n" + "=" * 60)
    if returncode != 0:
        logger.warning("GraphRAG 인덱싱 경고 (returncode=%s)", returncode)
    return True


# ---------------------------------------------------------------------------
# 3단계: 결과 검증
# ---------------------------------------------------------------------------
def verify_index() -> bool:
    """store/parquet 산출물의 존재와 행 수를 검증함.

    Returns:
        필수 파일이 모두 존재하면 True
    """
    parquet_dir = settings.parquet_dir
    print("\n=== 인덱싱 결과 검증 ===")

    required = ["entities.parquet", "relationships.parquet", "communities.parquet",
                "text_units.parquet", "documents.parquet"]
    missing = []
    for filename in required:
        filepath = parquet_dir / filename
        if filepath.exists():
            print(f"  [OK] {filename}: {len(pd.read_parquet(filepath))} rows")
        else:
            print(f"  [FAIL] {filename}: 없음")
            missing.append(filename)

    # GraphRAG LanceDB 벡터 인덱스 확인
    lance_files = list(settings.graphrag_vector_dir.rglob("*.lance")) if settings.graphrag_vector_dir.exists() else []
    print(f"  [{'OK' if lance_files else 'WARN'}] GraphRAG LanceDB: {len(lance_files)}개 인덱스")

    # 예제코드 벡터 인덱스 확인
    code_lance = list(settings.code_vector_dir.rglob("*.lance")) if settings.code_vector_dir.exists() else []
    print(f"  [{'OK' if code_lance else 'WARN'}] 예제코드 LanceDB: {len(code_lance)}개 인덱스")

    if missing:
        logger.error("필수 파일 누락: %s", missing)
        return False
    return True


# ---------------------------------------------------------------------------
# 메인 파이프라인
# ---------------------------------------------------------------------------
def _clear_indexes(code_only: bool = False):
    """--force: 인덱스 삭제.

    code_only=True이면 예제코드 벡터 인덱스만 삭제함.
    교재 KG(parquet/graphrag_vector)는 13분 이상 소요되므로 --code-only 시 보존함.
    """
    if code_only:
        if settings.code_vector_dir.exists():
            logger.warning("[Force/code-only] 삭제: %s", settings.code_vector_dir)
            shutil.rmtree(settings.code_vector_dir)
    else:
        for path in [settings.input_dir, settings.parquet_dir,
                     settings.graphrag_vector_dir, settings.code_vector_dir]:
            if path.exists():
                logger.warning("[Force] 삭제: %s", path)
                shutil.rmtree(path)


def main() -> int:
    """전체 인덱싱 파이프라인 실행 진입점.

    Returns:
        종료 코드 (0=성공, 1=실패)
    """
    parser = argparse.ArgumentParser(description="GraphRAG 3.0 문서 인덱싱")
    parser.add_argument("--force", action="store_true", help="기존 인덱스 삭제 후 재인덱싱")
    parser.add_argument("--mode", choices=["full", "test"], default="full",
                        help="인덱싱 모드: full(전체), test(소량)")
    parser.add_argument("--code-only", action="store_true",
                        help="예제코드 벡터 인덱스만 재구축 (교재 KG 건너뜀)")
    args = parser.parse_args()

    print("=" * 60)
    print(f"GraphRAG 3.0 인덱싱 (Groq {settings.llm_model} + Ollama {settings.embedding_model})")
    print(f"모드: {args.mode}{' / FORCE' if args.force else ''}{' / CODE-ONLY' if args.code_only else ''}")
    print("=" * 60)

    if args.force:
        _clear_indexes(code_only=args.code_only)

    # ── --code-only: 예제코드 인덱싱만 수행 ──
    if args.code_only:
        print("\n=== 예제코드 벡터 인덱싱 (Vector 전용) ===")
        try:
            index_code(mode=args.mode)
        except Exception as e:
            logger.error("예제코드 인덱싱 실패: %s", e)
            return 1
        verify_index()
        print("\n" + "=" * 60)
        print("예제코드 인덱싱 완료!")
        print(f"  예제코드 Vector : {settings.code_vector_dir}")
        print("  검증: python validate_index.py")
        print("=" * 60)
        return 0

    # ── 문서 로드 (모드별 분기) ──
    loader = GraphRAGDocumentLoader()
    if args.mode == "test":
        textbook_docs, code_docs = loader.load_specific_files()
    else:
        textbook_docs = loader.load_textbook()
        code_docs = None  # full 모드는 index_code 내부에서 별도 로드

    if not textbook_docs:
        logger.error("교재 문서가 없어 인덱싱을 중단함")
        return 1

    # ── 1단계: 교재 입력 준비 ──
    if prepare_input_documents(textbook_docs) == 0:
        logger.error("준비된 교재 문서가 없음")
        return 1

    # ── 2단계: GraphRAG 인덱싱 (교재 KG + Vector) ──
    if not run_graphrag_index():
        logger.error("GraphRAG 인덱싱 실패")
        return 1

    # ── 3단계: 결과 검증 ──
    if not verify_index():
        logger.warning("일부 산출물 누락 - 후처리를 시도함")

    # ── 4단계: 후처리 (엔티티/커뮤니티 임베딩, DRIFT 지원) ──
    try:
        finalize_indexing()
    except Exception as e:
        logger.error("후처리 실패: %s", e)

    # ── 5단계: 예제코드 벡터 인덱스 (KG 미생성) ──
    print("\n=== 예제코드 벡터 인덱싱 (Vector 전용) ===")
    try:
        index_code(mode=args.mode, documents=code_docs)
    except Exception as e:
        logger.error("예제코드 인덱싱 실패: %s", e)

    # ── 최종 검증 ──
    verify_index()

    print("\n" + "=" * 60)
    print("인덱싱 완료!")
    print(f"  교재 KG+Vector : {settings.parquet_dir} / {settings.graphrag_vector_dir}")
    print(f"  예제코드 Vector : {settings.code_vector_dir}")
    print("  검증: python validate_index.py")
    print("=" * 60)
    return 0


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    sys.exit(main())
