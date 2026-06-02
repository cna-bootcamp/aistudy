"""인덱싱 검증/보정 도구 (LightRAG)

인덱싱 결과(store/kg, store/vector/code)를 심각도별(CRITICAL/WARNING/INFO)로 검증하고,
보정 가능한 항목은 --fix로 자동 재구축함. 리포트는 check/ 디렉터리에 타임스탬프 파일로 저장함.

검증 항목:
  C1 KG GraphML 존재 / C2 교재 청크 벡터 존재·비어있지 않음 / C3 코드 벡터 인덱스 존재·비어있지 않음
  W1 엔티티 벡터 / W2 관계 벡터 / W3 원문 KV Store / W4 청크 KV Store / W5 코드 벡터 차원 일치

사용법:
  python validate_index.py        # 검증만
  python validate_index.py --fix  # 검증 + 누락분 자동 재구축(교재 KG·코드 벡터)
"""
import argparse
import json
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

# Windows 콘솔 기본 인코딩(cp949)에서 한글·기호(— 등) 출력이 깨지지 않도록 표준 출력을 UTF-8로 재설정함
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# 이 파일이 위치한 indexing/ 디렉터리를 모듈 검색 경로 맨 앞에 추가함
sys.path.insert(0, str(Path(__file__).resolve().parent))

from code_vector_index import CodeVectorIndexer
from config.settings import Settings
from document_loader import DocumentLoader
from kg_builder import KGBuilder

# LightRAG working_dir에 생성되는 파일명 (교재 KG+Vector+KV)
KG_GRAPHML = "graph_chunk_entity_relation.graphml"
KG_VDB_CHUNKS = "vdb_chunks.json"
KG_VDB_ENTITIES = "vdb_entities.json"
KG_VDB_RELATIONS = "vdb_relationships.json"
KG_KV_FULL_DOCS = "kv_store_full_docs.json"
KG_KV_TEXT_CHUNKS = "kv_store_text_chunks.json"
KG_KV_DOC_STATUS = "kv_store_doc_status.json"
KG_KV_LLM_CACHE = "kv_store_llm_response_cache.json"


@dataclass
class CheckResult:
    """개별 검증 결과 (구조화하여 일관된 리포트·자동 보정 판단에 사용)."""
    name: str               # 검증 코드 (C1, W1 등)
    severity: str           # CRITICAL / WARNING / INFO
    passed: bool            # 통과 여부
    message: str            # 사용자 표시 메시지
    fixable: bool = False   # --fix로 자동 보정 가능 여부
    fix_target: str = ""    # 보정 대상 ("kg" | "code")


@dataclass
class ValidationReport:
    """전체 검증 리포트."""
    checks: list = field(default_factory=list)
    info: list = field(default_factory=list)  # INFO 메시지 모음

    @property
    def critical_count(self) -> int:
        return sum(1 for c in self.checks if c.severity == "CRITICAL" and not c.passed)

    @property
    def warning_count(self) -> int:
        return sum(1 for c in self.checks if c.severity == "WARNING" and not c.passed)

    @property
    def fixable_issues(self) -> list:
        return [c for c in self.checks if not c.passed and c.fixable]


def _nano_vdb_count(path: Path) -> int:
    """nano-vectordb JSON 파일의 레코드 수를 반환 (없거나 파싱 실패 시 -1)."""
    if not path.exists():
        return -1
    try:
        # nano-vectordb 저장 포맷: {"embedding_dim":..., "data":[...], "matrix": "<base64>"}
        data = json.loads(path.read_text(encoding="utf-8"))
        return len(data.get("data", []))
    except Exception:
        return -1


def _nano_vdb_dim(path: Path) -> int:
    """nano-vectordb JSON 파일에 기록된 임베딩 차원을 반환 (없으면 -1)."""
    if not path.exists():
        return -1
    try:
        return int(json.loads(path.read_text(encoding="utf-8")).get("embedding_dim", -1))
    except Exception:
        return -1


def _graphml_counts(path: Path) -> tuple[int, int]:
    """GraphML 파일의 노드/엣지 수를 대략 집계 (태그 출현 횟수 기반)."""
    if not path.exists():
        return 0, 0
    try:
        text = path.read_text(encoding="utf-8")
        # GraphML은 노드를 <node ...>, 엣지를 <edge ...> 태그로 표현함
        return text.count("<node "), text.count("<edge ")
    except Exception:
        return 0, 0


class IndexValidator:
    """LightRAG 인덱싱 결과 파일 검증 및 누락분 재구축."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.kg_dir = settings.kg_dir

    def validate(self) -> ValidationReport:
        """전체 검증 수행 후 리포트 반환."""
        report = ValidationReport()
        self._collect_info(report)

        # CRITICAL — 검색 동작에 필수
        report.checks.append(self._check_graphml())            # C1
        report.checks.append(self._check_kg_chunks())          # C2
        report.checks.append(self._check_code_vectors())       # C3
        # WARNING — 품질·완전성
        report.checks.append(self._check_file(
            "W1", KG_VDB_ENTITIES, "엔티티 벡터", fixable=True, fix_target="kg"))
        report.checks.append(self._check_file(
            "W2", KG_VDB_RELATIONS, "관계 벡터", fixable=True, fix_target="kg"))
        report.checks.append(self._check_file(
            "W3", KG_KV_FULL_DOCS, "원문 KV Store", fixable=True, fix_target="kg"))
        report.checks.append(self._check_file(
            "W4", KG_KV_TEXT_CHUNKS, "청크 KV Store", fixable=True, fix_target="kg"))
        report.checks.append(self._check_code_dim())           # W5
        return report

    def fix(self, report: ValidationReport) -> list:
        """보정 가능한 실패 항목을 재구축 (교재 KG / 코드 벡터)."""
        messages = []
        targets = {c.fix_target for c in report.fixable_issues if c.fix_target}
        loader = DocumentLoader(self.settings)
        if "kg" in targets:
            kg_docs = loader.load_for_kg()
            # LightRAG는 MD5 해시 기반으로 이미 삽입된 문서를 자동 스킵하므로, 재실행 시 누락분만 보강됨
            stats = KGBuilder(self.settings).build_from_documents(kg_docs)
            messages.append(f"교재 KG 재구축: 성공 {stats['success']} / 스킵 {len(stats['skipped'])}")
        if "code" in targets:
            code_docs = loader.load_for_vector()
            stats = CodeVectorIndexer(self.settings).build_from_documents(code_docs)
            messages.append(f"코드 벡터 재구축: 성공 {stats['success']} / 청크 {stats['chunks']}")
        return messages

    # --- INFO 수집 ---

    def _collect_info(self, report: ValidationReport) -> None:
        nodes, edges = _graphml_counts(self.kg_dir / KG_GRAPHML)
        report.info.append(f"KG 노드 {nodes}개 / 엣지 {edges}개")
        report.info.append(f"교재 청크 벡터: {_nano_vdb_count(self.kg_dir / KG_VDB_CHUNKS)}개")
        report.info.append(f"엔티티 벡터: {_nano_vdb_count(self.kg_dir / KG_VDB_ENTITIES)}개")
        report.info.append(f"관계 벡터: {_nano_vdb_count(self.kg_dir / KG_VDB_RELATIONS)}개")
        report.info.append(f"코드 청크 벡터: {_nano_vdb_count(self.settings.code_vdb_file)}개")
        doc_status = self.kg_dir / KG_KV_DOC_STATUS
        if doc_status.exists():
            report.info.append(f"문서 상태 KV Store 존재: {KG_KV_DOC_STATUS}")
        if (self.kg_dir / KG_KV_LLM_CACHE).exists():
            report.info.append(f"LLM 캐시 KV Store 존재: {KG_KV_LLM_CACHE}")

    # --- CRITICAL ---

    def _check_graphml(self) -> CheckResult:
        """C1: KG GraphML 파일 존재 + 노드 1개 이상 (인덱싱 성공 최소 조건)."""
        path = self.kg_dir / KG_GRAPHML
        nodes, _ = _graphml_counts(path)
        passed = path.exists() and nodes > 0
        return CheckResult(
            "C1", "CRITICAL", passed,
            f"KG GraphML {'존재' if path.exists() else '부재'} (노드 {nodes}개)",
            fixable=True, fix_target="kg",
        )

    def _check_kg_chunks(self) -> CheckResult:
        """C2: 교재 청크 벡터(vdb_chunks.json)가 존재하고 비어있지 않은지."""
        count = _nano_vdb_count(self.kg_dir / KG_VDB_CHUNKS)
        passed = count > 0
        return CheckResult(
            "C2", "CRITICAL", passed,
            f"교재 청크 벡터: {count if count >= 0 else '부재'}개",
            fixable=True, fix_target="kg",
        )

    def _check_code_vectors(self) -> CheckResult:
        """C3: 코드 벡터 인덱스(vdb_code.json)가 존재하고 비어있지 않은지."""
        count = _nano_vdb_count(self.settings.code_vdb_file)
        passed = count > 0
        return CheckResult(
            "C3", "CRITICAL", passed,
            f"코드 청크 벡터: {count if count >= 0 else '부재'}개",
            fixable=True, fix_target="code",
        )

    # --- WARNING ---

    def _check_file(self, name: str, filename: str, label: str,
                    fixable: bool = False, fix_target: str = "") -> CheckResult:
        """지정한 KG 저장소 파일의 존재 여부를 검증."""
        path = self.kg_dir / filename
        passed = path.exists()
        return CheckResult(
            name, "WARNING", passed,
            f"{label} {'존재' if passed else '부재'} ({filename})",
            fixable=fixable, fix_target=fix_target,
        )

    def _check_code_dim(self) -> CheckResult:
        """W5: 코드 벡터의 임베딩 차원이 설정값(4096)과 일치하는지."""
        dim = _nano_vdb_dim(self.settings.code_vdb_file)
        if dim < 0:
            return CheckResult("W5", "WARNING", True, "코드 벡터 없음 (차원 검증 스킵)")
        expected = self.settings.embedding_dim
        passed = dim == expected
        return CheckResult(
            "W5", "WARNING", passed,
            f"코드 벡터 차원 {'일치' if passed else '불일치'}: 실제 {dim} / 설정 {expected}",
            fixable=passed is False, fix_target="code",
        )


def format_report(report: ValidationReport) -> str:
    """검증 리포트를 사람이 읽기 쉬운 텍스트로 포맷."""
    lines = ["=" * 60, "  LightRAG 인덱싱 검증 리포트", "=" * 60, ""]

    lines.append("[INFO]")
    for msg in report.info:
        lines.append(f"  - {msg}")
    lines.append("")

    lines.append("[검증 결과]")
    for c in report.checks:
        if c.passed:
            icon = "[PASS]"
        elif c.severity == "CRITICAL":
            icon = "[FAIL]"
        else:
            icon = "[WARN]"
        fix_hint = " [보정 가능]" if c.fixable and not c.passed else ""
        lines.append(f"  {icon} {c.name}. {c.message}{fix_hint}")
    lines.append("")

    lines.append("[심각도 요약]")
    lines.append(f"  CRITICAL: {report.critical_count}건 | WARNING: {report.warning_count}건")
    lines.append("")

    lines.append("[권고사항]")
    recs = []
    if report.critical_count > 0:
        recs.append("CRITICAL 발견 — 재인덱싱 권고: python index_documents.py --force")
    if report.fixable_issues:
        recs.append(f"--fix 로 누락분 자동 재구축 가능: {', '.join(c.name for c in report.fixable_issues)}")
    if recs:
        lines.extend(f"  {r}" for r in recs)
    else:
        lines.append("  이슈 없음 — 인덱싱 상태 양호")
    lines.append("")
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="LightRAG 인덱싱 검증/보정 도구")
    parser.add_argument("--fix", action="store_true", help="누락분 자동 재구축(교재 KG·코드 벡터)")
    return parser.parse_args()


def main() -> None:
    """검증 → (선택)보정 → 리포트 출력·저장 → 심각도별 종료코드 반환."""
    args = parse_args()
    settings = Settings()
    validator = IndexValidator(settings)
    report = validator.validate()

    fix_messages = []
    if args.fix and report.fixable_issues:
        print("\n자동 보정(재구축) 실행 중...")
        fix_messages = validator.fix(report)
        report = validator.validate()  # 보정 후 재검증

    report_text = format_report(report)
    if fix_messages:
        report_text += "[보정 결과]\n" + "".join(f"  [OK] {m}\n" for m in fix_messages) + "\n"
    print(report_text)

    # check/ 디렉터리에 타임스탬프 리포트 저장
    check_dir = Path(__file__).resolve().parent / "check"
    check_dir.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = check_dir / f"validation_{timestamp}.txt"
    report_path.write_text(report_text, encoding="utf-8")
    print(f"리포트 저장: {report_path}")

    # 종료코드: CRITICAL=2, WARNING=1, 정상=0 (CI·스크립트 연동용)
    if report.critical_count > 0:
        sys.exit(2)
    elif report.warning_count > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
