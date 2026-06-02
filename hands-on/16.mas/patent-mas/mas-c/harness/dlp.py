"""DLP (Data Loss Prevention) 출력 필터 — 개인정보(PII) 탐지·마스킹.

교재 §7.10 '보안 리스크: 데이터 유출 완화 방안'의 DLPFilter 구현임.
MAS C의 마지막 게이트로, 사람 승인을 거친 의견서를 외부로 내보내기 직전에 적용하여
주민등록번호·전화번호·이메일 등 개인 식별 정보가 결과물에 남지 않도록 마스킹함.

[설계 메모]
  - 정규식 기반 탐지·치환만 사용함(LLM 미사용) — 결정적이고 비용이 없으며, 마스킹 누락이
    LLM 비결정성에 좌우되지 않게 하기 위함. 출력 필터는 빠르고 확실해야 함.
  - scan()으로 '무엇이 몇 건 감지되었는지'를 먼저 보고하고(감사 로그·요약용),
    mask()로 실제 치환함. 게이트는 둘을 함께 사용함.
"""

from __future__ import annotations

import re


class DLPFilter:
    """텍스트에서 개인 식별 정보(PII)를 탐지·마스킹하는 출력 필터."""

    # PII(Personally Identifiable Information) 패턴 — 한국 환경에서 흔한 식별 정보를 다룸.
    # dict 순서대로 치환하므로, 더 구체적인 패턴(주민번호)을 일반 패턴(생략)보다 앞에 둠.
    PII_PATTERNS: dict[str, str] = {
        "주민등록번호": r"\d{6}-[1-4]\d{6}",                              # 901010-1234567
        "전화번호": r"01[016789]-?\d{3,4}-?\d{4}",                        # 010-1234-5678
        "카드번호": r"\b\d{4}-\d{4}-\d{4}-\d{4}\b",                       # 1234-5678-9012-3456
        "이메일": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",      # user@example.com
    }

    def scan(self, text: str) -> list[dict]:
        """텍스트에서 PII를 탐지해 [{type, value, position}] 목록을 반환함(치환은 하지 않음).

        감사 로그·요약 출력에 '어떤 유형이 몇 건' 감지되었는지 보고하는 용도임.
        """
        findings: list[dict] = []
        for pii_type, pattern in self.PII_PATTERNS.items():
            for match in re.finditer(pattern, text):
                findings.append({
                    "type": pii_type,
                    "value": match.group(),
                    "position": match.span(),
                })
        return findings

    def mask(self, text: str) -> str:
        """탐지된 PII를 '[유형_마스킹]' 형태로 치환한 안전한 텍스트를 반환함."""
        masked = text
        for pii_type, pattern in self.PII_PATTERNS.items():
            masked = re.sub(pattern, f"[{pii_type}_마스킹]", masked)
        return masked


# 모듈 단독 스모크 테스트: python -m harness.dlp  (mas-c 디렉터리에서)
if __name__ == "__main__":
    import sys

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    sample = (
        "의뢰인 정보: 홍길동(주민등록번호 900101-1234567), 연락처 010-1234-5678, "
        "이메일 hong@example.com, 카드 1234-5678-9012-3456 로 수임료 납부함."
    )
    dlp = DLPFilter()
    found = dlp.scan(sample)
    print("탐지 결과:")
    for f in found:
        print(f"  - {f['type']}: {f['value']}")
    print("\n마스킹 결과:")
    print(dlp.mask(sample))
