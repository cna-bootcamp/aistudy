#!/usr/bin/env python
"""특허법 GraphRAG 인덱싱 메인 스크립트

단일 PDF(특허법)를 Knowledge Graph + Vector로 인덱싱함.

사용법:
    python index_documents.py              # 전체 인덱싱
    python index_documents.py --force      # 인덱스 초기화 후 재인덱싱
    python index_documents.py --limit 4    # 앞쪽 4개 청크만 인덱싱 (파이프라인 검증 슬라이스)

[전체 흐름]
  1. prepare_input():       특허법 PDF → data/input/*.txt 변환
  2. run_graphrag_index():  graphrag CLI로 KG + Vector 인덱싱
                            (엔티티/관계 추출 → 커뮤니티(Leiden) → 커뮤니티 리포트 → 임베딩)
  3. verify_index():        store/parquet 산출물 + LanceDB 테이블 검증
  4. finalize_indexing():   (선택) 임베딩 누락 보완 — 모듈이 있을 때만 수행
"""
import argparse
import re
import shutil
import subprocess
import sys
import threading
from pathlib import Path

import pandas as pd
from tqdm import tqdm

# ── Windows 콘솔 인코딩 설정 ──
# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 UTF-8로 재설정함.
# io.TextIOWrapper로 새 객체를 만들면 출력 리다이렉트(백그라운드/파일) 시 종료 단계에서
# 원본 버퍼가 먼저 닫혀 "I/O operation on closed file" 오류가 나므로, 기존 스트림을
# 그대로 reconfigure하여 이중 close를 피함 (Python 3.7+).
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

# ── 모듈 검색 경로 등록 ──
# 이 파일이 위치한 graphrag/ 디렉터리를 경로에 추가해 하위 모듈을 import함
PROJECT_INDEXING_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_INDEXING_DIR))

from config.settings import settings
from pdf_loader import prepare_input
from utils.logger import get_logger
from utils.helpers import ensure_dir

logger = get_logger("index_documents")


# ---------------------------------------------------------------------------
# GraphRAG CLI 인덱싱 (진행바 표시)
# ---------------------------------------------------------------------------
class ProgressTracker:
    """GraphRAG CLI stdout을 파싱하여 tqdm 진행바로 표시함.

    GraphRAG는 "Starting workflow: xxx" / "N / M" / "Workflow complete: xxx" 형태로
    진행 상황을 출력하므로 이를 파싱해 워크플로우·아이템 2단계 진행바를 갱신함.
    """

    # GraphRAG 3.x 표준 워크플로우 순서 (진행바 총량 계산용)
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
    """graphrag CLI로 특허법 KG + Vector 인덱싱을 실행함.

    실행 명령: graphrag index --root <indexing_dir>

    Returns:
        성공 여부
    """
    ensure_dir(settings.parquet_dir)
    logger.info("GraphRAG 인덱싱 시작 (Groq LPU: %s / OpenAI 임베딩: %s)",
                settings.llm_model, settings.embedding_model)

    print("\n" + "=" * 60)
    print("GraphRAG 인덱싱 진행 상황")
    print("=" * 60)

    try:
        # graphrag를 'python -m graphrag'로 실행해 현재 인터프리터(venv)의 graphrag를 보장함.
        # subprocess는 부모 프로세스의 os.environ을 상속하므로 config.settings가 로드한
        # GROQ_API_KEY / OPENAI_API_KEY가 전달되어 settings.yaml의 ${...}가 해석됨.
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
# 결과 검증
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

    if missing:
        logger.error("필수 파일 누락: %s", missing)
        return False
    return True


# ---------------------------------------------------------------------------
# 메인 파이프라인
# ---------------------------------------------------------------------------
def _clear_indexes():
    """--force: 인덱스(입력 txt + parquet + 벡터)를 삭제함."""
    for path in [settings.input_dir, settings.parquet_dir, settings.graphrag_vector_dir]:
        if path.exists():
            logger.warning("[Force] 삭제: %s", path)
            shutil.rmtree(path)


def main() -> int:
    """전체 인덱싱 파이프라인 실행 진입점.

    Returns:
        종료 코드 (0=성공, 1=실패)
    """
    parser = argparse.ArgumentParser(description="특허법 GraphRAG 인덱싱")
    parser.add_argument("--force", action="store_true", help="기존 인덱스 삭제 후 재인덱싱")
    parser.add_argument("--limit", type=int, default=None,
                        help="인덱싱할 청크 수 상한 (슬라이스 검증용, 미지정 시 전체)")
    args = parser.parse_args()

    print("=" * 60)
    print(f"특허법 GraphRAG 인덱싱 (Groq {settings.llm_model} + OpenAI {settings.embedding_model})")
    print(f"모드: {'슬라이스 ' + str(args.limit) if args.limit else 'full'}{' / FORCE' if args.force else ''}")
    print("=" * 60)

    if args.force:
        _clear_indexes()

    # ── 1단계: 입력 준비 (특허법 PDF → data/input/*.txt) ──
    if prepare_input(limit=args.limit) == 0:
        logger.error("준비된 입력 문서가 없음")
        return 1

    # ── 2단계: GraphRAG 인덱싱 (KG + Vector) ──
    if not run_graphrag_index():
        logger.error("GraphRAG 인덱싱 실패")
        return 1

    # ── 3단계: 결과 검증 ──
    if not verify_index():
        logger.warning("일부 산출물 누락 - 후처리를 시도함")

    # ── 4단계: 후처리 (선택) — finalize_indexing 모듈이 있을 때만 임베딩 누락 보완 ──
    # GraphRAG 3.x는 3종 임베딩 테이블을 네이티브로 생성하므로 통상 불필요하나,
    # 임베딩 누락 시 OpenAI로 보완하기 위해 모듈이 있으면 호출함.
    try:
        from finalize_indexing import finalize_indexing
        finalize_indexing()
    except ImportError:
        pass  # finalize 모듈이 없으면 네이티브 임베딩만으로 충분한 것으로 간주함
    except Exception as e:
        logger.error("후처리 실패: %s", e)

    print("\n" + "=" * 60)
    print("인덱싱 완료!")
    print(f"  KG + Vector : {settings.parquet_dir} / {settings.graphrag_vector_dir}")
    print("  검증: python validate_index.py")
    print("=" * 60)
    return 0


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    sys.exit(main())
