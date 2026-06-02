"""인덱싱 검증/보정 도구

인덱싱 결과를 심각도별(CRITICAL/WARNING/INFO)로 검증하고, 보정 가능한 항목은 --fix로 자동 수정함.
결과 리포트는 check/ 디렉터리에 타임스탬프 파일로 저장함.

검증 항목:
  C1 엔티티 노드 존재 / C2 entity_embedding 인덱스 존재 / C3 임베딩 보유율(>0)
  W1 text 속성(보정가능) / W2 고아 노드 / W3 임베딩 누락율 / W4 임베딩 차원 일치 /
  W5 중복 ID / W6 doc_embedding 인덱스 존재

사용법:
  python validate_index.py        # 검증만
  python validate_index.py --fix  # 검증 + 자동 보정(W1 text 속성)
"""
import argparse
import logging
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

# neo4j 드라이버의 스키마 알림(예: description 속성 미존재)은 의도된 상황이라 ERROR 이상만 표시
logging.getLogger("neo4j").setLevel(logging.ERROR)
logging.getLogger("neo4j.notifications").setLevel(logging.ERROR)

# 이 파일이 위치한 indexing/ 디렉터리를 모듈 검색 경로 맨 앞에 추가함
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config.settings import Settings
from graph.neo4j_connection import Neo4jConnection


@dataclass
class CheckResult:
    """개별 검증 결과 (구조화하여 일관된 리포트·자동 보정 판단에 사용)"""
    name: str               # 검증 코드 (C1, W1 등)
    severity: str           # CRITICAL / WARNING / INFO
    passed: bool            # 통과 여부
    message: str            # 사용자 표시 메시지
    fixable: bool = False   # --fix로 자동 보정 가능 여부
    detail: dict = field(default_factory=dict)


@dataclass
class ValidationReport:
    """전체 검증 리포트"""
    checks: list = field(default_factory=list)
    stats: dict = field(default_factory=dict)
    indexes: list = field(default_factory=list)
    samples: list = field(default_factory=list)

    @property
    def critical_count(self) -> int:
        return sum(1 for c in self.checks if c.severity == "CRITICAL" and not c.passed)

    @property
    def warning_count(self) -> int:
        return sum(1 for c in self.checks if c.severity == "WARNING" and not c.passed)

    @property
    def fixable_issues(self) -> list:
        return [c for c in self.checks if not c.passed and c.fixable]


class IndexValidator:
    """인덱싱 결과 검증 및 보정"""

    def __init__(self, settings: Settings, connection: Neo4jConnection):
        self.settings = settings
        self.graph = connection.graph
        self.connection = connection

    def validate(self) -> ValidationReport:
        """전체 검증 수행 후 리포트 반환"""
        report = ValidationReport()
        report.stats = self.connection.get_stats()       # INFO: KG 통계
        report.indexes = self._get_index_info()          # INFO: 인덱스 상태
        report.samples = self._get_sample_entities()     # INFO: 샘플 엔티티 5개

        # CRITICAL — 인덱싱 필수 요소
        report.checks.append(self._check_entity_count(report.stats))   # C1
        report.checks.append(self._check_entity_index(report.indexes)) # C2
        report.checks.append(self._check_embedding_existence())        # C3
        # WARNING — 품질·일관성
        report.checks.append(self._check_text_property())             # W1 (fixable)
        report.checks.append(self._check_orphan_nodes())              # W2
        report.checks.append(self._check_embeddings())                # W3
        report.checks.append(self._check_embedding_dimension())       # W4
        report.checks.append(self._check_duplicate_ids())             # W5
        report.checks.append(self._check_doc_index(report.indexes))   # W6
        return report

    def fix(self, report: ValidationReport) -> list:
        """보정 가능한 실패 항목 자동 수정 (현재 W1 text 속성)"""
        messages = []
        for check in report.fixable_issues:
            if check.name == "W1":
                count = self._fix_text_property()
                messages.append(f"W1 보정 완료: {count}개 엔티티 text 속성 설정")
        return messages

    # --- INFO 수집 ---

    def _get_index_info(self) -> list:
        """LOOKUP을 제외한 모든 인덱스(VECTOR/RANGE 등) 정보 조회"""
        try:
            rows = self.graph.query("SHOW INDEXES WHERE type <> 'LOOKUP'")
            return [
                {
                    "name": r.get("name", ""),
                    "state": r.get("state", ""),
                    "type": r.get("type", ""),
                    "labelsOrTypes": r.get("labelsOrTypes", []),
                    "properties": r.get("properties", []),
                }
                for r in rows
            ]
        except Exception:
            return []

    def _get_sample_entities(self) -> list:
        """__Entity__ 노드 5개 미리보기 (id/text/description)"""
        try:
            return self.graph.query(
                "MATCH (n:__Entity__) "
                "RETURN n.id AS id, n.text AS text, n.description AS description "
                "LIMIT 5"
            )
        except Exception:
            return []

    # --- CRITICAL ---

    def _check_entity_count(self, stats: dict) -> CheckResult:
        """C1: __Entity__ 노드가 1개 이상 존재하는지 (인덱싱 성공 최소 조건)

        엔티티는 타입별로 라벨 조합(__Entity__+Concept 등)이 달라 stats의 라벨 분포로는
        한 조합만 세기 쉬우므로, 전체 __Entity__ 수를 직접 질의해 정확히 집계함.
        """
        try:
            rows = self.graph.query("MATCH (n:__Entity__) RETURN count(n) AS cnt")
            entity_count = rows[0]["cnt"] if rows else 0
        except Exception:
            entity_count = 0
        passed = entity_count > 0
        return CheckResult(
            name="C1", severity="CRITICAL", passed=passed,
            message=f"엔티티 노드 {'존재' if passed else '부재'}: {entity_count:,}개",
            detail={"entity_count": entity_count},
        )

    def _check_entity_index(self, indexes: list) -> CheckResult:
        """C2: entity_embedding 벡터 인덱스 존재 여부 (벡터 검색 필수)"""
        names = [idx["name"] for idx in indexes]
        has_idx = any("entity_embedding" in n for n in names)
        if not has_idx:
            # 이름으로 못 찾으면 VECTOR 타입 + __Entity__ 라벨로 확인
            for idx in indexes:
                if idx.get("type") == "VECTOR" and "__Entity__" in (idx.get("labelsOrTypes") or []):
                    has_idx = True
                    break
        return CheckResult(
            name="C2", severity="CRITICAL", passed=has_idx,
            message=f"entity_embedding 인덱스 {'존재' if has_idx else '미존재'}",
            detail={"index_names": names},
        )

    def _check_embedding_existence(self) -> CheckResult:
        """C3: 임베딩 속성을 가진 엔티티 비율 (0%면 벡터 검색 불가 → CRITICAL)"""
        try:
            rows = self.graph.query(
                "MATCH (n:__Entity__) "
                "WITH count(n) AS total, count(n.embedding) AS with_emb "
                "RETURN total, with_emb, "
                "  CASE WHEN total = 0 THEN 0 ELSE toFloat(with_emb)/total*100 END AS ratio"
            )
            total = rows[0]["total"] if rows else 0
            with_emb = rows[0]["with_emb"] if rows else 0
            ratio = rows[0]["ratio"] if rows else 0
        except Exception:
            total, with_emb, ratio = 0, 0, 0
        if total == 0:
            return CheckResult("C3", "CRITICAL", True, "엔티티 없음 (C1 참조)")
        passed = ratio > 0
        return CheckResult(
            name="C3", severity="CRITICAL", passed=passed,
            message=f"임베딩 보유: {with_emb:,}/{total:,} ({ratio:.1f}%)",
            detail={"total": total, "with_embedding": with_emb, "ratio": ratio},
        )

    # --- WARNING ---

    def _check_text_property(self) -> CheckResult:
        """W1: text 속성 누락 확인 (벡터 결과 표시용, --fix로 보정 가능)"""
        try:
            missing = self.graph.query(
                "MATCH (n:__Entity__) WHERE n.text IS NULL OR n.text = '' RETURN count(n) AS cnt"
            )[0]["cnt"]
            total = self.graph.query("MATCH (n:__Entity__) RETURN count(n) AS cnt")[0]["cnt"]
        except Exception:
            missing, total = 0, 0
        passed = missing == 0
        ratio = (missing / total * 100) if total > 0 else 0
        return CheckResult(
            name="W1", severity="WARNING", passed=passed,
            message="text 속성 완비" if passed else f"text 누락: {missing:,}개 ({ratio:.1f}%)",
            fixable=True,
            detail={"missing": missing, "total": total},
        )

    def _check_orphan_nodes(self) -> CheckResult:
        """W2: 관계가 전혀 없는 고아 엔티티 비율 (50% 초과 시 KG 품질 경고)"""
        try:
            rows = self.graph.query(
                "MATCH (n:__Entity__) WHERE NOT (n)--() "
                "WITH count(n) AS orphans "
                "MATCH (m:__Entity__) WITH orphans, count(m) AS total "
                "RETURN orphans, total, "
                "  CASE WHEN total = 0 THEN 0 ELSE toFloat(orphans)/total*100 END AS ratio"
            )
            orphans = rows[0]["orphans"] if rows else 0
            total = rows[0]["total"] if rows else 0
            ratio = rows[0]["ratio"] if rows else 0
        except Exception:
            orphans, total, ratio = 0, 0, 0
        passed = ratio <= 50
        return CheckResult(
            name="W2", severity="WARNING", passed=passed,
            message=f"고아 노드: {orphans:,}개 ({ratio:.1f}%)",
            detail={"orphans": orphans, "total": total, "ratio": ratio},
        )

    def _check_embeddings(self) -> CheckResult:
        """W3: 임베딩 누락 비율 (10% 초과 시 경고 — C3는 0% 기준, W3는 품질 기준)"""
        try:
            rows = self.graph.query(
                "MATCH (n:__Entity__) "
                "WITH count(n) AS total, "
                "     sum(CASE WHEN n.embedding IS NULL THEN 1 ELSE 0 END) AS missing "
                "RETURN total, missing, "
                "  CASE WHEN total = 0 THEN 0 ELSE toFloat(missing)/total*100 END AS ratio"
            )
            total = rows[0]["total"] if rows else 0
            missing = rows[0]["missing"] if rows else 0
            ratio = rows[0]["ratio"] if rows else 0
        except Exception:
            total, missing, ratio = 0, 0, 0
        passed = ratio <= 10
        if total == 0:
            msg = "엔티티 없음"
        elif missing == 0:
            msg = f"임베딩 100% 완료 ({total:,}개)"
        else:
            msg = f"임베딩 누락: {missing:,}/{total:,} ({ratio:.1f}%)"
        return CheckResult(
            name="W3", severity="WARNING", passed=passed, message=msg,
            detail={"total": total, "missing": missing, "ratio": ratio},
        )

    def _check_embedding_dimension(self) -> CheckResult:
        """W4: 저장된 임베딩 차원이 설정값(embedding_dim)과 일치하는지"""
        expected = self.settings.embedding_dim
        try:
            rows = self.graph.query(
                "MATCH (n:__Entity__) WHERE n.embedding IS NOT NULL "
                "RETURN size(n.embedding) AS dim LIMIT 1"
            )
            if not rows:
                return CheckResult("W4", "WARNING", True, "임베딩 없음 (차원 검증 스킵)")
            actual = rows[0]["dim"]
        except Exception:
            return CheckResult("W4", "WARNING", True, "차원 검증 불가")
        passed = actual == expected
        return CheckResult(
            name="W4", severity="WARNING", passed=passed,
            message=(f"임베딩 차원 일치: {actual}" if passed
                     else f"임베딩 차원 불일치: 실제 {actual} != 설정 {expected}"),
            detail={"expected": expected, "actual": actual},
        )

    def _check_duplicate_ids(self) -> CheckResult:
        """W5: 동일 id를 가진 __Entity__ 노드 중복 여부 (정합성)"""
        try:
            rows = self.graph.query(
                "MATCH (n:__Entity__) WITH n.id AS eid, count(n) AS cnt "
                "WHERE cnt > 1 RETURN eid, cnt ORDER BY cnt DESC LIMIT 10"
            )
            dup_count = len(rows)
        except Exception:
            rows, dup_count = [], 0
        passed = dup_count == 0
        if passed:
            msg = "중복 ID 없음"
        else:
            samples = ", ".join(f"{r['eid']}({r['cnt']})" for r in rows[:5])
            msg = f"중복 ID {dup_count}건: {samples}"
        return CheckResult("W5", "WARNING", passed, msg, detail={"duplicates": rows})

    def _check_doc_index(self, indexes: list) -> CheckResult:
        """W6: doc_embedding 벡터 인덱스 존재 여부 (교재 청크 + 예제코드 Chunk 노드 대상)"""
        has_idx = any("doc_embedding" in idx.get("name", "") for idx in indexes)
        try:
            chunk_count = self.graph.query("MATCH (n:Chunk) RETURN count(n) AS cnt")[0]["cnt"]
        except Exception:
            chunk_count = 0
        if chunk_count == 0:
            return CheckResult(
                "W6", "WARNING", True, "Chunk 노드 없음 (doc_embedding 검증 스킵)",
                detail={"has_index": has_idx, "chunk_count": chunk_count},
            )
        return CheckResult(
            name="W6", severity="WARNING", passed=has_idx,
            message=f"doc_embedding 인덱스 {'존재' if has_idx else '미존재'} (Chunk {chunk_count:,}개)",
            detail={"has_index": has_idx, "chunk_count": chunk_count},
        )

    # --- 보정 ---

    def _fix_text_property(self) -> int:
        """W1 보정: text = id(+description) 설정 (KGBuilder._set_entity_text와 동일 로직)"""
        self.graph.query(
            "MATCH (n:__Entity__) "
            "WHERE n.description IS NOT NULL AND n.description <> '' "
            "AND (n.text IS NULL OR n.text = '') "
            "SET n.text = n.id + ': ' + n.description"
        )
        self.graph.query(
            "MATCH (n:__Entity__) WHERE n.text IS NULL OR n.text = '' SET n.text = n.id"
        )
        remaining = self.graph.query(
            "MATCH (n:__Entity__) WHERE n.text IS NULL OR n.text = '' RETURN count(n) AS cnt"
        )[0]["cnt"]
        total = self.graph.query("MATCH (n:__Entity__) RETURN count(n) AS cnt")[0]["cnt"]
        return total - remaining


def format_report(report: ValidationReport) -> str:
    """검증 리포트를 사람이 읽기 쉬운 텍스트로 포맷 (콘솔·파일 공통)"""
    lines = ["=" * 60, "  LangChain + Neo4j 인덱싱 검증 리포트", "=" * 60, ""]

    stats = report.stats
    lines.append("[KG 통계]")
    lines.append(f"  노드: {stats.get('node_count', 0):,}개 | 관계: {stats.get('relationship_count', 0):,}개")
    labels = stats.get("node_labels", [])[:5]
    if labels:
        label_strs = []
        for l in labels:
            lbls = l.get("lbls", [])
            label_strs.append(f"{'+'.join(lbls) if isinstance(lbls, list) else lbls}({l.get('cnt', 0):,})")
        lines.append(f"  라벨 TOP5: {', '.join(label_strs)}")
    rels = stats.get("relationship_types", [])[:5]
    if rels:
        rel_strs = [f"{r['rel_type']}({r['cnt']:,})" for r in rels]
        lines.append(f"  관계 TOP5: {', '.join(rel_strs)}")
    lines.append("")

    lines.append("[인덱스 상태]")
    if report.indexes:
        for idx in report.indexes:
            label_str = ", ".join(idx.get("labelsOrTypes", []) or [])
            lines.append(f"  {idx.get('name', '?')}: {idx.get('state', '?')} ({idx.get('type', '')}, {label_str})")
    else:
        lines.append("  인덱스 없음")
    lines.append("")

    lines.append("[샘플 엔티티]")
    if report.samples:
        for i, s in enumerate(report.samples, 1):
            text = s.get("text") or s.get("description") or "-"
            preview = (text[:60] + "...") if len(text) > 60 else text
            lines.append(f"  {i}. {s.get('id', '?')}: {preview}")
    else:
        lines.append("  엔티티 없음")
    lines.append("")

    lines.append("[검증 결과]")
    for c in report.checks:
        if c.severity == "INFO":
            icon = "[INFO]"
        elif c.passed:
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

    recs = []
    if report.critical_count > 0:
        recs.append("CRITICAL 발견 — 재인덱싱 권고: python index_documents.py --force")
    if report.fixable_issues:
        recs.append(f"--fix 로 자동 보정 가능: {', '.join(c.name for c in report.fixable_issues)}")
    for c in report.checks:
        if not c.passed and not c.fixable and c.severity == "WARNING":
            hints = {
                "W2": "W2(고아 노드): KG 구축 품질 개선 필요",
                "W3": "W3(임베딩 누락): 벡터 인덱스 재생성 권고",
                "W4": "W4(차원 불일치): 임베딩 모델·재인덱싱 점검",
                "W5": "W5(중복 ID): 데이터 정합성 점검",
                "W6": "W6(doc_embedding 부재): 벡터 인덱스 재생성 필요",
            }
            if c.name in hints:
                recs.append(hints[c.name])
    lines.append("[권고사항]")
    if recs:
        lines.extend(f"  {r}" for r in recs)
    else:
        lines.append("  이슈 없음 — 인덱싱 상태 양호")
    lines.append("")
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="LangChain + Neo4j 인덱싱 검증/보정 도구")
    parser.add_argument("--fix", action="store_true", help="보정 가능 항목 자동 수정(W1 text)")
    return parser.parse_args()


def main() -> None:
    """검증 → (선택)보정 → 리포트 출력·저장 → 심각도별 종료코드 반환"""
    args = parse_args()

    settings = Settings()
    print(f"Neo4j 연결: {settings.neo4j_uri}")
    connection = Neo4jConnection(settings)

    validator = IndexValidator(settings, connection)
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
