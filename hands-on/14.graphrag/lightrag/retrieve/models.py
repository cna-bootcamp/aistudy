"""검색 결과와 라우팅 결정을 표현하는 데이터 모델."""
from dataclasses import dataclass, field
from typing import Any


DOC_MODES = ("naive", "local", "global", "hybrid", "mix")
ALL_MODES = ("auto", "naive", "local", "global", "hybrid", "mix", "code")


# @dataclass: 검색 라우팅 결과를 값 객체로 다루기 위한 보일러플레이트를 자동 생성함
@dataclass
class RouterDecision:
    """사용자 질문에 대해 선택된 검색 모드와 판단 근거."""

    mode: str
    confidence: float
    reason: str
    strategy: str


# @dataclass: 출처 정보를 구조화해 Streamlit 표시에 재사용함
@dataclass
class Source:
    """검색에 사용된 출처 단위."""

    source_type: str
    file_path: str
    label: str = ""
    score: float | None = None
    content: str = ""
    chunk_id: str = ""


# @dataclass: 검색 응답, 출처, 오류 상태를 하나의 객체로 전달함
@dataclass
class SearchResult:
    """검색과 답변 생성을 마친 최종 결과."""

    question: str
    answer: str
    mode: str
    decision: RouterDecision
    sources: list[Source] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)
    error: str = ""
    elapsed_seconds: float = 0.0

    @property
    def ok(self) -> bool:
        """검색이 오류 없이 완료되었는지 여부 반환."""
        return not self.error
