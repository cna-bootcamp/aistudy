"""
PyMuPDF(fitz) 라이브러리를 활용한 PDF → 마크다운 변환 예제

fitz.open()으로 PDF를 열어 페이지별 텍스트 블록을 추출하고,
폰트 크기 기반 헤딩 추론과 반복 헤더·푸터 제거를 수행하여 마크다운 파일로 저장함.

기본 입력: ../AI GARAGE Proposal.pdf
기본 출력: ./result.md
"""

from __future__ import annotations

import argparse
import math
import re
import statistics
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

try:
    # fitz: PyMuPDF 라이브러리의 핵심 모듈. PDF 페이지에서 텍스트·이미지·도형을 추출함
    import fitz
except ImportError as exc:
    raise SystemExit(
        "PyMuPDF is required. Install it with: pip install PyMuPDF"
    ) from exc


# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = SCRIPT_DIR.parent / "AI GARAGE Proposal.pdf"
DEFAULT_OUTPUT = SCRIPT_DIR / "result.md"
# 불릿 기호 유니코드 문자 집합 (•, ●, ▪, ◦)
BULLET_MARKERS = {"•", "●", "▪", "◦"}


@dataclass(frozen=True)
class TextLine:
    """PDF 페이지에서 추출한 텍스트 줄 1개와 위치·폰트 크기 정보."""

    page_index: int
    page_height: float
    x0: float
    y0: float
    x1: float
    y1: float
    text: str
    font_size: float


def clean_text(text: str) -> str:
    """비줄바꿈 공백과 연속 공백을 단일 공백으로 정규화하여 반환함."""
    text = text.replace(" ", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def repeat_key(text: str) -> str:
    """반복 헤더·푸터 감지용 비교 키를 생성하여 반환함.
    소문자 변환 후 공백 제거, 숫자를 {n}으로 치환하여 페이지 번호 차이를 무시함."""
    key = clean_text(text).lower()
    key = re.sub(r"\s+", "", key)
    key = re.sub(r"\d+", "{n}", key)
    return key


def is_edge_line(line: TextLine) -> bool:
    """텍스트 줄이 페이지 상단 또는 하단 가장자리 영역에 있으면 True를 반환함."""
    top_limit = min(45.0, line.page_height * 0.055)
    bottom_limit = line.page_height - min(45.0, line.page_height * 0.08)
    return line.y0 <= top_limit or line.y1 >= bottom_limit


def extract_lines(page: fitz.Page, page_index: int) -> list[TextLine]:
    """fitz 페이지에서 텍스트 줄을 바운딩박스·폰트 크기와 함께 추출하여 반환함."""
    page_dict = page.get_text("dict", sort=True)
    lines: list[TextLine] = []

    for block in page_dict.get("blocks", []):
        # type 0은 텍스트 블록을 의미함 (1은 이미지 블록)
        if block.get("type") != 0:
            continue

        for raw_line in block.get("lines", []):
            spans = raw_line.get("spans", [])
            text = clean_text("".join(span.get("text", "") for span in spans))
            if not text:
                continue

            x0, y0, x1, y1 = raw_line["bbox"]
            font_size = max((span.get("size", 0.0) for span in spans), default=0.0)
            lines.append(
                TextLine(
                    page_index=page_index,
                    page_height=page.rect.height,
                    x0=x0,
                    y0=y0,
                    x1=x1,
                    y1=y1,
                    text=text,
                    font_size=font_size,
                )
            )

    return sorted(lines, key=lambda line: (line.y0, line.x0))


def find_repeated_edge_keys(pages: list[list[TextLine]]) -> set[str]:
    """여러 페이지의 가장자리 영역에서 반복 등장하는 텍스트 키 집합을 반환함."""
    if len(pages) < 2:
        return set()

    counter: Counter[str] = Counter()
    for lines in pages:
        page_keys = {
            repeat_key(line.text)
            for line in lines
            if is_edge_line(line) and repeat_key(line.text)
        }
        counter.update(page_keys)

    min_count = max(2, math.ceil(len(pages) * 0.25))
    return {key for key, count in counter.items() if count >= min_count}


def remove_repeated_header_footer(
    pages: list[list[TextLine]], repeated_keys: set[str]
) -> list[list[TextLine]]:
    """각 페이지에서 반복 헤더·푸터에 해당하는 가장자리 줄을 제거하여 반환함."""
    filtered_pages: list[list[TextLine]] = []
    for lines in pages:
        filtered_pages.append(
            [
                line
                for line in lines
                if not (is_edge_line(line) and repeat_key(line.text) in repeated_keys)
            ]
        )
    return filtered_pages


def section_heading_level(text: str, font_size: float, body_size: float) -> int:
    """폰트 크기와 텍스트 패턴을 기반으로 마크다운 헤딩 수준(1~3)을 추론하여 반환함.
    헤딩에 해당하지 않으면 0을 반환함."""
    if re.match(r"^\d+(?:\.\d+){1,}\s+", text):
        return 2

    if font_size >= body_size * 1.65:
        return 1

    if font_size >= body_size * 1.35:
        return 2

    if font_size >= body_size * 1.18 and len(text) <= 80:
        return 3

    return 0


def line_to_markdown(line: TextLine, body_size: float) -> str:
    """추출된 텍스트 줄 1개를 마크다운 형식 문자열로 변환하여 반환함."""
    text = clean_text(line.text)
    if not text:
        return ""

    if text[0] in BULLET_MARKERS:
        return "- " + text[1:].strip()

    level = section_heading_level(text, line.font_size, body_size)
    if level:
        return f"{'#' * level} {text}"

    return text


def render_markdown(pages: list[list[TextLine]]) -> str:
    """필터링된 텍스트 줄 전체를 마크다운 문자열로 렌더링하여 반환함.
    페이지 경계마다 빈 줄을 삽입하고 헤딩 앞에도 빈 줄을 추가함."""
    all_lines = [line for page in pages for line in page]
    body_size = (
        statistics.median(line.font_size for line in all_lines) if all_lines else 10.0
    )

    markdown_lines: list[str] = []
    previous_page = -1

    for page in pages:
        for line in page:
            markdown = line_to_markdown(line, body_size)
            if not markdown:
                continue

            if previous_page != -1 and previous_page != line.page_index:
                if markdown_lines and markdown_lines[-1] != "":
                    markdown_lines.append("")

            if markdown.startswith("#") and markdown_lines and markdown_lines[-1] != "":
                markdown_lines.append("")

            markdown_lines.append(markdown)
            previous_page = line.page_index

    while markdown_lines and markdown_lines[-1] == "":
        markdown_lines.pop()

    return "\n".join(markdown_lines) + "\n"


def convert_pdf_to_markdown(input_path: Path, output_path: Path) -> None:
    """PDF 파일을 마크다운으로 변환하여 output_path에 저장함."""
    if not input_path.exists():
        raise FileNotFoundError(f"입력 PDF를 찾을 수 없습니다: {input_path}")

    # with 블록을 벗어나면 파일이 자동으로 닫힘
    with fitz.open(input_path) as document:
        pages = [extract_lines(page, index) for index, page in enumerate(document)]

    repeated_keys = find_repeated_edge_keys(pages)
    filtered_pages = remove_repeated_header_footer(pages, repeated_keys)
    markdown = render_markdown(filtered_pages)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    """명령줄 인자(입력 PDF, 출력 MD 경로)를 파싱하여 반환함."""
    parser = argparse.ArgumentParser(
        description="PyMuPDF를 이용한 PDF → 마크다운 변환"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help=f"입력 PDF 경로. 기본값: {DEFAULT_INPUT}",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"출력 마크다운 경로. 기본값: {DEFAULT_OUTPUT}",
    )
    return parser.parse_args()


def main() -> None:
    """PDF → 마크다운 변환 워크플로우를 실행함."""
    args = parse_args()
    input_path = args.input.expanduser().resolve()
    output_path = args.output.expanduser().resolve()

    print(f"입력: {input_path}")
    print(f"출력: {output_path}")

    convert_pdf_to_markdown(input_path, output_path)

    print("완료.")


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
