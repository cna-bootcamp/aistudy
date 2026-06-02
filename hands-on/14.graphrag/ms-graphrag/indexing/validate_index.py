#!/usr/bin/env python
"""GraphRAG 인덱싱 검증/보정 도구

Parquet + LanceDB 인덱싱 결과를 심각도별로 검증하고, 일부 항목은 자동 보정함.

사용법:
    python validate_index.py            # 검증만 수행 (CRITICAL/WARNING/INFO)
    python validate_index.py --fix      # 검증 + 자동 보정 (엔티티 임베딩·community_full_content)

검증 대상 경로:
    - Parquet:          store/parquet
    - GraphRAG LanceDB: store/vector/graphrag
    - 예제코드 LanceDB:  store/vector/code

결과는 check/ 디렉터리에 타임스탬프 파일로 저장됨.
"""
import argparse
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import lancedb
import pandas as pd

# indexing 디렉터리를 모듈 검색 경로에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent))
from config.settings import settings
from utils.logger import get_logger
from utils.helpers import ensure_dir

logger = get_logger("validate_index")


@dataclass
class CheckResult:
    """개별 검증 결과.

    Attributes:
        name: 검증 항목 ID (예: C1, W1, I1)
        severity: 심각도 ("CRITICAL"/"WARNING"/"INFO")
        passed: 통과 여부
        message: 결과 메시지
        fixable: 자동 보정 가능 여부
    """
    name: str
    severity: str
    passed: bool
    message: str
    fixable: bool = False


@dataclass
class ValidationReport:
    """전체 검증 리포트."""
    checks: list[CheckResult] = field(default_factory=list)
    parquet_info: list[dict] = field(default_factory=list)
    lancedb_info: dict = field(default_factory=dict)
    stats: dict = field(default_factory=dict)

    @property
    def critical_count(self) -> int:
        """실패한 CRITICAL 항목 수 (재인덱싱 권고 대상)."""
        return sum(1 for c in self.checks if c.severity == "CRITICAL" and not c.passed)

    @property
    def warning_count(self) -> int:
        """실패한 WARNING 항목 수."""
        return sum(1 for c in self.checks if c.severity == "WARNING" and not c.passed)

    @property
    def fixable_issues(self) -> list[CheckResult]:
        """자동 보정 가능한 미통과 항목."""
        return [c for c in self.checks if not c.passed and c.fixable]


class IndexValidator:
    """인덱싱 결과 검증기 (Parquet + LanceDB)."""

    # 필수 parquet 파일 (없으면 검색 불가)
    REQUIRED_FILES = [
        "entities.parquet", "relationships.parquet",
        "text_units.parquet", "communities.parquet", "documents.parquet",
    ]
    # 임베딩 parquet 파일
    EMBEDDING_FILES = [
        "embeddings.entity_description.parquet",
        "embeddings.community_full_content.parquet",
        "embeddings.text_unit_text.parquet",
    ]

    def __init__(self):
        self.parquet_dir = settings.parquet_dir              # store/parquet
        self.lancedb_dir = settings.graphrag_vector_dir      # store/vector/graphrag
        self.code_vector_dir = settings.code_vector_dir      # store/vector/code

    # ------------------------------------------------------------------
    # 검증 수행
    # ------------------------------------------------------------------
    def validate(self) -> ValidationReport:
        """전체 검증을 수행하고 리포트를 생성함."""
        report = ValidationReport()
        report.parquet_info = self._collect_parquet_info()
        report.lancedb_info = self._collect_lancedb_info()
        report.stats = {e["filename"].replace(".parquet", ""): e["rows"] for e in report.parquet_info}

        # CRITICAL: 필수 데이터 존재 여부
        report.checks.append(self._check_rows("C1", "CRITICAL", "entities.parquet", "엔티티"))
        report.checks.append(self._check_rows("C2", "CRITICAL", "relationships.parquet", "관계"))
        report.checks.append(self._check_entity_embeddings())
        # CRITICAL/WARNING: 검색이 실제로 조회하는 LanceDB 벡터 테이블의 존재 + 적재율
        report.checks.extend(self._check_vector_tables())

        # WARNING: 품질·일관성
        report.checks.append(self._check_rows("W1", "WARNING", "text_units.parquet", "텍스트 유닛"))
        report.checks.append(self._check_rows("W2", "WARNING", "communities.parquet", "커뮤니티"))
        report.checks.append(self._check_community_reports())
        report.checks.append(self._check_graphrag_lancedb())
        report.checks.append(self._check_community_full_content())
        report.checks.append(self._check_description_coverage())
        report.checks.append(self._check_embedding_dimension())
        report.checks.append(self._check_code_vector_index())

        # INFO: 참고 통계
        report.checks.append(self._check_orphan_entities())
        return report

    # ------------------------------------------------------------------
    # 자동 보정
    # ------------------------------------------------------------------
    def fix(self, report: ValidationReport) -> list[str]:
        """자동 보정 가능 항목을 수정함.

        - C3: 엔티티 임베딩 누락 → Ollama로 수동 생성
        - W4b: community_full_content 테이블 누락 → 커뮤니티 리포트 임베딩 + 테이블 생성
        - W5: 빈 description → title 값으로 채움

        Returns:
            보정 결과 메시지 리스트
        """
        messages = []
        names = {c.name for c in report.fixable_issues}

        # 엔티티 임베딩 / community_full_content 보정은 finalize 모듈 재사용
        if "C3" in names or "W4b" in names:
            from finalize_indexing import (
                generate_missing_entity_embeddings,
                generate_community_report_embeddings,
            )
            if "C3" in names:
                if generate_missing_entity_embeddings(self.parquet_dir):
                    messages.append("C3 보정 완료: 엔티티 임베딩 생성")
            if "W4b" in names:
                if generate_community_report_embeddings(self.parquet_dir, self.lancedb_dir):
                    messages.append("W4b 보정 완료: community_full_content 테이블 생성")

        if "W5" in names:
            count = self._fix_empty_descriptions()
            messages.append(f"W5 보정 완료: {count}개 엔티티 description 보정")
        return messages

    # ------------------------------------------------------------------
    # 정보 수집
    # ------------------------------------------------------------------
    def _collect_parquet_info(self) -> list[dict]:
        info = []
        for filename in self.REQUIRED_FILES + self.EMBEDDING_FILES + ["community_reports.parquet"]:
            filepath = self.parquet_dir / filename
            entry = {"filename": filename, "exists": filepath.exists(), "rows": 0}
            if filepath.exists():
                try:
                    entry["rows"] = len(pd.read_parquet(filepath))
                except Exception as e:
                    entry["error"] = str(e)
            info.append(entry)
        return info

    def _collect_lancedb_info(self) -> dict:
        info = {"graphrag": {"exists": self.lancedb_dir.exists(), "lance_files": 0, "tables": []},
                "code": {"exists": self.code_vector_dir.exists(), "lance_files": 0}}
        if self.lancedb_dir.exists():
            info["graphrag"]["lance_files"] = len(list(self.lancedb_dir.rglob("*.lance")))
            info["graphrag"]["tables"] = [p.name for p in self.lancedb_dir.iterdir()
                                          if p.is_dir() and p.name != "_versions"]
        if self.code_vector_dir.exists():
            info["code"]["lance_files"] = len(list(self.code_vector_dir.rglob("*.lance")))
        return info

    def _read_parquet_safe(self, filename: str) -> pd.DataFrame | None:
        filepath = self.parquet_dir / filename
        if not filepath.exists():
            return None
        try:
            return pd.read_parquet(filepath)
        except Exception:
            return None

    # ------------------------------------------------------------------
    # 개별 검증 항목
    # ------------------------------------------------------------------
    def _check_rows(self, name: str, severity: str, filename: str, label: str) -> CheckResult:
        """파일 존재 + 행 수 > 0 검증 (공통)."""
        df = self._read_parquet_safe(filename)
        if df is None:
            return CheckResult(name, severity, False, f"{filename} 파일 없음")
        passed = len(df) > 0
        return CheckResult(name, severity, passed, f"{label} {'존재' if passed else '부재'}: {len(df):,}개")

    def _check_entity_embeddings(self) -> CheckResult:
        """C3: 엔티티 임베딩 존재 (없으면 --fix로 보정 가능)."""
        df = self._read_parquet_safe("embeddings.entity_description.parquet")
        if df is None or len(df) == 0:
            return CheckResult("C3", "CRITICAL", False, "엔티티 임베딩 없음", fixable=True)
        return CheckResult("C3", "CRITICAL", True, f"엔티티 임베딩 존재: {len(df):,}개")

    def _check_community_reports(self) -> CheckResult:
        """W3: community_reports 존재 (Groq LPU 활성화 시 생성됨)."""
        df = self._read_parquet_safe("community_reports.parquet")
        if df is None:
            return CheckResult("W3", "WARNING", False, "community_reports.parquet 없음")
        if len(df) == 0:
            return CheckResult("W3", "WARNING", False, "community_reports 비어있음 (community_reports 워크플로우 확인)")
        return CheckResult("W3", "WARNING", True, f"커뮤니티 리포트: {len(df):,}개")

    def _check_graphrag_lancedb(self) -> CheckResult:
        """W4: GraphRAG LanceDB 벡터 인덱스 존재."""
        if not self.lancedb_dir.exists():
            return CheckResult("W4", "WARNING", False, "GraphRAG LanceDB 디렉터리 없음")
        n = len(list(self.lancedb_dir.rglob("*.lance")))
        return CheckResult("W4", "WARNING", n > 0, f"GraphRAG LanceDB: {n}개 인덱스")

    def _check_community_full_content(self) -> CheckResult:
        """W4b: community_full_content 테이블 존재 (DRIFT Search용, --fix 보정 가능)."""
        table_dir = self.lancedb_dir / "community_full_content.lance"
        exists = table_dir.exists()
        return CheckResult("W4b", "WARNING", exists,
                           f"community_full_content 테이블 {'존재' if exists else '없음 (DRIFT용)'}",
                           fixable=not exists)

    def _check_vector_tables(self) -> list[CheckResult]:
        """C4/W8/W9: 검색이 실제 조회하는 LanceDB 벡터 테이블의 존재 + 적재율 검증.

        settings.yaml vector_store.index_schema의 index_name과 일치하는 테이블이
        실제로 존재하고, 행 수가 원본 parquet 대비 충분히 적재됐는지 확인함.
        (entity_description/text_unit_text가 같은 index_name을 공유하면 인덱싱 시
         서로 덮어써 한쪽이 누락되므로 - 이 검증으로 충돌·미완성 임베딩을 탐지함.)

        검증 대상 (테이블명 ← 원본 parquet, 심각도):
            - entity_description     ← entities.parquet        (CRITICAL: Local/DRIFT)
            - text_unit_text         ← text_units.parquet      (WARNING:  Basic)
            - community_full_content ← community_reports.parquet (WARNING: DRIFT Primer/Global)
        """
        specs = [
            ("C4", "CRITICAL", "entity_description", "entities.parquet", "Local/DRIFT"),
            ("W8", "WARNING", "text_unit_text", "text_units.parquet", "Basic"),
            ("W9", "WARNING", "community_full_content", "community_reports.parquet", "DRIFT/Global"),
        ]
        if not self.lancedb_dir.exists():
            return [CheckResult(n, s, False, f"{tbl} 검증 불가: LanceDB 디렉터리 없음 ({use})")
                    for n, s, tbl, _src, use in specs]
        try:
            db = lancedb.connect(str(self.lancedb_dir))
            existing = set(db.table_names())
        except Exception as e:
            return [CheckResult(n, s, False, f"{tbl} 검증 불가: LanceDB 연결 실패 ({e})")
                    for n, s, tbl, _src, use in specs]

        results: list[CheckResult] = []
        for name, severity, table, source_file, use in specs:
            src = self._read_parquet_safe(source_file)
            source_rows = len(src) if src is not None else 0
            if table not in existing:
                results.append(CheckResult(
                    name, severity, False,
                    f"{table} 테이블 없음 (검색 {use} 불가 - index_name 분리 후 재인덱싱 필요)"))
                continue
            try:
                rows = db.open_table(table).count_rows()
            except Exception as e:
                results.append(CheckResult(name, severity, False, f"{table} 행 수 조회 실패 ({e})"))
                continue
            # 적재율: 원본 대비 90% 이상이면 정상 (임베딩 일부 실패 허용 여유)
            coverage = (rows / source_rows * 100) if source_rows else 0.0
            passed = source_rows == 0 or coverage >= 90.0
            msg = (f"{table} 적재 {'정상' if passed else '미완성'}: "
                   f"{rows:,}/{source_rows:,} ({coverage:.1f}%) [{use}]")
            results.append(CheckResult(name, severity, passed, msg))
        return results

    def _check_description_coverage(self) -> CheckResult:
        """W5: 엔티티 description 누락 비율 (>30%면 보정 권고)."""
        df = self._read_parquet_safe("entities.parquet")
        if df is None or len(df) == 0 or "description" not in df.columns:
            return CheckResult("W5", "WARNING", True, "description 검증 스킵 (C1 참조)")
        missing = int(df["description"].isna().sum() + (df["description"] == "").sum())
        ratio = missing / len(df) * 100
        passed = ratio <= 30
        return CheckResult("W5", "WARNING", passed,
                           f"description {'완비' if passed else f'누락 {missing:,}/{len(df):,} ({ratio:.1f}%)'}",
                           fixable=not passed)

    def _check_embedding_dimension(self) -> CheckResult:
        """W6: 엔티티 임베딩 차원이 설정(4096)과 일치하는지 검증."""
        df = self._read_parquet_safe("embeddings.entity_description.parquet")
        if df is None or len(df) == 0:
            return CheckResult("W6", "WARNING", True, "임베딩 차원 검증 스킵 (C3 참조)")
        emb_col = next((c for c in df.columns if "embedding" in c.lower() or "vector" in c.lower()), None)
        if emb_col is None:
            return CheckResult("W6", "WARNING", True, "임베딩 컬럼 미발견 (스킵)")
        try:
            actual = len(df[emb_col].iloc[0])
        except Exception:
            return CheckResult("W6", "WARNING", True, "차원 검증 불가")
        passed = actual == settings.embedding_dim
        return CheckResult("W6", "WARNING", passed,
                           f"임베딩 차원 {'일치' if passed else '불일치'}: {actual} (설정 {settings.embedding_dim})")

    def _check_code_vector_index(self) -> CheckResult:
        """W7: 예제코드 벡터 인덱스 존재."""
        if not self.code_vector_dir.exists():
            return CheckResult("W7", "WARNING", False, "예제코드 LanceDB 디렉터리 없음")
        n = len(list(self.code_vector_dir.rglob("*.lance")))
        return CheckResult("W7", "WARNING", n > 0, f"예제코드 LanceDB: {n}개 인덱스")

    def _check_orphan_entities(self) -> CheckResult:
        """I1: 고아 엔티티(관계 없는 엔티티) 비율 (참고 정보)."""
        ent = self._read_parquet_safe("entities.parquet")
        rel = self._read_parquet_safe("relationships.parquet")
        if ent is None or rel is None or len(ent) == 0:
            return CheckResult("I1", "INFO", True, "고아 엔티티 검증 스킵")
        id_col = "title" if "title" in ent.columns else ("name" if "name" in ent.columns else "id")
        entity_ids = set(ent[id_col])
        connected = set()
        for col in ("source", "target", "source_id", "target_id"):
            if col in rel.columns:
                connected.update(rel[col])
        orphans = len(entity_ids - connected)
        ratio = orphans / len(entity_ids) * 100 if entity_ids else 0
        return CheckResult("I1", "INFO", True, f"고아 엔티티: {orphans:,}/{len(entity_ids):,} ({ratio:.1f}%)")

    def _fix_empty_descriptions(self) -> int:
        """W5 보정: 빈 description을 title 값으로 채움."""
        filepath = self.parquet_dir / "entities.parquet"
        df = pd.read_parquet(filepath)
        name_col = "title" if "title" in df.columns else "name"
        if "description" not in df.columns or name_col not in df.columns:
            return 0
        mask = df["description"].isna() | (df["description"] == "")
        count = int(mask.sum())
        if count > 0:
            df.loc[mask, "description"] = df.loc[mask, name_col]
            df.to_parquet(filepath)
        return count


def format_report(report: ValidationReport) -> str:
    """검증 리포트를 사람이 읽는 문자열로 포맷팅함."""
    lines = ["=" * 60, "  GraphRAG 인덱싱 검증 리포트", "=" * 60, ""]

    # Parquet 상태
    lines.append("[Parquet 파일 상태] (store/parquet)")
    for entry in report.parquet_info:
        mark = "OK" if entry["exists"] else "--"
        lines.append(f"  [{mark}] {entry['filename']}: {entry['rows']:,} rows" if entry["exists"]
                     else f"  [--] {entry['filename']}: 없음")
    lines.append("")

    # LanceDB 상태
    ldb = report.lancedb_info
    lines.append("[LanceDB 상태]")
    g = ldb.get("graphrag", {})
    lines.append(f"  GraphRAG (store/vector/graphrag): {g.get('lance_files', 0)}개 인덱스"
                 + (f" / 테이블: {', '.join(g.get('tables', []))}" if g.get("tables") else ""))
    c = ldb.get("code", {})
    lines.append(f"  예제코드 (store/vector/code): {c.get('lance_files', 0)}개 인덱스")
    lines.append("")

    # 통계
    s = report.stats
    lines.append("[인덱싱 통계]")
    lines.append(f"  엔티티: {s.get('entities', 0):,} | 관계: {s.get('relationships', 0):,}")
    lines.append(f"  텍스트 유닛: {s.get('text_units', 0):,} | 커뮤니티: {s.get('communities', 0):,}")
    lines.append("")

    # 검증 결과 (심각도별 아이콘)
    lines.append("[검증 결과]")
    for ch in report.checks:
        if ch.passed:
            icon = "[PASS]"
        elif ch.severity == "CRITICAL":
            icon = "[FAIL]"
        elif ch.severity == "INFO":
            icon = "[INFO]"
        else:
            icon = "[WARN]"
        hint = " [보정가능]" if ch.fixable and not ch.passed else ""
        lines.append(f"  {icon} {ch.name}. {ch.message}{hint}")
    lines.append("")

    # 심각도 요약 + 권고
    lines.append("[심각도 요약]")
    lines.append(f"  CRITICAL: {report.critical_count}건 | WARNING: {report.warning_count}건")
    lines.append("")
    lines.append("[권고사항]")
    if report.critical_count > 0:
        lines.append("  CRITICAL 발견 - 재인덱싱 권고: python index_documents.py --force")
    if report.fixable_issues:
        lines.append(f"  --fix 보정 가능: {', '.join(c.name for c in report.fixable_issues)}")
    if report.critical_count == 0 and not report.fixable_issues:
        lines.append("  이슈 없음 - 인덱싱 상태 양호")
    lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="GraphRAG 인덱싱 검증/보정 도구")
    parser.add_argument("--fix", action="store_true", help="자동 보정 가능 항목 수정")
    args = parser.parse_args()

    print(f"Parquet 경로: {settings.parquet_dir}")
    print(f"임베딩 모델: {settings.embedding_model} (dim={settings.embedding_dim})")

    validator = IndexValidator()
    report = validator.validate()

    fix_messages = []
    if args.fix and report.fixable_issues:
        print("\n자동 보정 실행 중...")
        fix_messages = validator.fix(report)
        report = validator.validate()  # 보정 후 재검증

    report_text = format_report(report)
    if fix_messages:
        report_text += "[보정 결과]\n" + "".join(f"  [OK] {m}\n" for m in fix_messages) + "\n"

    print(report_text)

    # check/ 디렉터리에 타임스탬프 리포트 저장
    check_dir = ensure_dir(Path(__file__).resolve().parent / "check")
    report_path = check_dir / f"validation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    report_path.write_text(report_text, encoding="utf-8")
    print(f"리포트 저장: {report_path}")

    # 종료 코드: CRITICAL=2, WARNING=1, 정상=0
    sys.exit(2 if report.critical_count > 0 else (1 if report.warning_count > 0 else 0))


if __name__ == "__main__":
    main()
