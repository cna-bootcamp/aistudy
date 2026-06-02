"""
pdfplumber 라이브러리를 활용한 PDF → 마크다운 변환 예제

pdfplumber로 PDF 페이지에서 텍스트와 표를 추출하고 헤더·푸터를 자동으로 제거함.
표는 마크다운 테이블 형식으로 변환하며 텍스트는 페이지 순서대로 이어붙여 저장함.

기본 입력: ../AI GARAGE Proposal.pdf
기본 출력: ./result.md
"""

from __future__ import annotations

import argparse
import math
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Iterable, Sequence

# pdfplumber: PDF 페이지에서 텍스트·표·도형 정보를 추출하는 Python 라이브러리
import pdfplumber


# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = SCRIPT_DIR.parent / "AI GARAGE Proposal.pdf"
DEFAULT_OUTPUT = SCRIPT_DIR / "result.md"

# 페이지 상·하단 헤더/푸터 비율 (전체 높이 대비)
HEADER_RATIO = 0.07
FOOTER_RATIO = 0.07
# 전체 페이지 중 반복 텍스트로 판단하는 등장 비율 임계값
REPEATED_LINE_THRESHOLD = 0.6
MIN_REPEATED_PAGES = 2
MIN_SECTION_HEIGHT = 4

TABLE_SETTINGS = {
    "vertical_strategy": "lines",
    "horizontal_strategy": "lines",
    "snap_tolerance": 3,
    "join_tolerance": 3,
    "edge_min_length": 3,
    "intersection_tolerance": 5,
    "text_tolerance": 3,
}


def parse_args() -> argparse.Namespace:
    """명령줄 인자(입력 PDF, 출력 MD 경로)를 파싱하여 반환함."""
    parser = argparse.ArgumentParser(
        description="pdfplumber를 이용한 PDF → 마크다운 변환"
    )
    parser.add_argument(
        "--input",
        default=str(DEFAULT_INPUT),
        help=f"입력 PDF 경로. 기본값: {DEFAULT_INPUT}",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help=f"출력 마크다운 경로. 기본값: {DEFAULT_OUTPUT}",
    )
    return parser.parse_args()


def normalize_line(line: str) -> str:
    """연속 공백을 단일 공백으로 줄이고 앞뒤 공백을 제거하여 반환함."""
    return re.sub(r"\s+", " ", line).strip()


def extract_lines(page) -> list[str]:
    """페이지 또는 잘라낸 영역에서 비어 있지 않은 텍스트 줄 목록을 반환함."""
    text = page.extract_text(x_tolerance=1.5, y_tolerance=3, layout=False) or ""
    return [normalize_line(line) for line in text.splitlines() if normalize_line(line)]


def edge_crop(page, top: float, bottom: float):
    """페이지의 상단 또는 하단 가장자리 영역을 잘라낸 객체를 반환함."""
    return page.crop((0, top, page.width, bottom), strict=False)


def detect_repeated_edge_lines(pdf) -> set[str]:
    """여러 페이지의 헤더·푸터 영역에서 반복 등장하는 텍스트 줄 집합을 반환함."""
    page_count = len(pdf.pages)
    if page_count < MIN_REPEATED_PAGES:
        return set()

    repeated_minimum = max(
        MIN_REPEATED_PAGES,
        math.ceil(page_count * REPEATED_LINE_THRESHOLD),
    )
    counts: Counter[str] = Counter()

    for page in pdf.pages:
        header_bottom = page.height * HEADER_RATIO
        footer_top = page.height * (1 - FOOTER_RATIO)
        page_edge_lines = set()

        for crop in (
            edge_crop(page, 0, header_bottom),
            edge_crop(page, footer_top, page.height),
        ):
            page_edge_lines.update(extract_lines(crop))

        counts.update(page_edge_lines)

    return {line for line, count in counts.items() if count >= repeated_minimum}


def crop_body(page):
    """고정 헤더·푸터 영역을 제외한 본문 영역만 잘라낸 객체를 반환함."""
    top = page.height * HEADER_RATIO
    bottom = page.height * (1 - FOOTER_RATIO)
    return page.crop((0, top, page.width, bottom), strict=False)


def clean_text_lines(text: str, repeated_lines: set[str]) -> list[str]:
    """반복 헤더·푸터 줄을 제거하고 불릿 기호를 정규화한 텍스트 줄 목록을 반환함."""
    cleaned: list[str] = []
    blank_pending = False

    for raw_line in text.splitlines():
        line = normalize_line(raw_line)

        if not line:
            blank_pending = bool(cleaned)
            continue

        if line in repeated_lines:
            continue

        line = line.replace("•", "-")
        if line.startswith("-") and not line.startswith("- "):
            line = "- " + line[1:].strip()

        if blank_pending and cleaned[-1] != "":
            cleaned.append("")
        cleaned.append(line)
        blank_pending = False

    while cleaned and cleaned[-1] == "":
        cleaned.pop()

    return cleaned


def extract_clean_text(page, repeated_lines: set[str]) -> str:
    """페이지 영역에서 텍스트를 추출하고 반복 가장자리 줄을 제거하여 반환함."""
    text = page.extract_text(x_tolerance=1.5, y_tolerance=3, layout=False) or ""
    return "\n".join(clean_text_lines(text, repeated_lines))


def normalize_cell(cell: object) -> str:
    """표 셀 값을 마크다운 출력에 적합한 문자열로 정규화하여 반환함."""
    if cell is None:
        return ""

    value = normalize_line(str(cell).replace("\n", "<br>"))
    return value.replace("|", r"\|")


def table_to_markdown(table: Sequence[Sequence[object]]) -> str:
    """pdfplumber에서 추출한 표 데이터를 마크다운 테이블 문자열로 변환하여 반환함."""
    rows = [[normalize_cell(cell) for cell in row] for row in table if row]
    rows = [row for row in rows if any(cell for cell in row)]
    if not rows:
        return ""

    column_count = max(len(row) for row in rows)
    normalized_rows = [row + [""] * (column_count - len(row)) for row in rows]

    header = normalized_rows[0]
    if not any(header):
        header = [f"Column {index}" for index in range(1, column_count + 1)]

    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(["---"] * column_count) + " |",
    ]

    for row in normalized_rows[1:]:
        lines.append("| " + " | ".join(row) + " |")

    return "\n".join(lines)


def crop_vertical_band(page, top: float, bottom: float):
    """이미 잘라낸 본문 페이지에서 수직 방향 일부 영역을 다시 잘라 반환함.
    높이가 MIN_SECTION_HEIGHT 미만이면 None을 반환함."""
    x0, page_top, x1, page_bottom = page.bbox
    top = max(top, page_top)
    bottom = min(bottom, page_bottom)

    if bottom - top < MIN_SECTION_HEIGHT:
        return None

    return page.crop((x0, top, x1, bottom), strict=False)


def page_sections_to_markdown(page, repeated_lines: set[str]) -> list[str]:
    """페이지에서 표와 텍스트를 위→아래 순서로 추출하여 마크다운 섹션 목록을 반환함."""
    body_page = crop_body(page)
    body_top = body_page.bbox[1]
    body_bottom = body_page.bbox[3]
    sections: list[str] = []
    cursor = body_top

    tables = sorted(body_page.find_tables(table_settings=TABLE_SETTINGS), key=lambda t: t.bbox[1])

    for table_index, table in enumerate(tables, start=1):
        table_top = table.bbox[1]
        table_bottom = table.bbox[3]

        text_band = crop_vertical_band(body_page, cursor, table_top)
        if text_band is not None:
            text = extract_clean_text(text_band, repeated_lines)
            if text:
                sections.append(text)

        markdown_table = table_to_markdown(table.extract())
        if markdown_table:
            sections.append(f"### Table {table_index}\n\n{markdown_table}")

        cursor = max(cursor, table_bottom)

    remaining_band = crop_vertical_band(body_page, cursor, body_bottom)
    if remaining_band is not None:
        text = extract_clean_text(remaining_band, repeated_lines)
        if text:
            sections.append(text)

    if not sections:
        text = extract_clean_text(body_page, repeated_lines)
        if text:
            sections.append(text)

    return sections


def build_markdown(pdf_path: Path) -> str:
    """PDF 파일 전체를 읽어 페이지 순서대로 마크다운 문자열을 생성하여 반환함."""
    lines: list[str] = []

    # with 블록을 벗어나면 파일이 자동으로 닫힘
    with pdfplumber.open(pdf_path) as pdf:
        repeated_lines = detect_repeated_edge_lines(pdf)

        for page_number, page in enumerate(pdf.pages, start=1):
            if page_number > 1:
                lines.extend(["", "---", ""])
            sections = page_sections_to_markdown(page, repeated_lines)

            if sections:
                lines.append("\n\n".join(sections))

    return "\n".join(lines).rstrip() + "\n"


def resolve_path(path: str) -> Path:
    """사용자가 입력한 경로 문자열을 절대 Path 객체로 변환하여 반환함."""
    return Path(path).expanduser().resolve()


def write_markdown(content: str, output_path: Path) -> None:
    """마크다운 내용을 UTF-8로 파일에 저장함. 출력 디렉터리가 없으면 자동 생성."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")


def convert_pdf_to_markdown(input_path: Path, output_path: Path) -> None:
    """PDF 파일 1개를 마크다운 파일로 변환하여 저장함."""
    if not input_path.exists():
        raise FileNotFoundError(f"입력 PDF를 찾을 수 없습니다: {input_path}")

    markdown = build_markdown(input_path)
    write_markdown(markdown, output_path)


def main() -> int:
    """CLI 진입점. 변환을 실행하고 성공 시 0, 오류 시 1을 반환함."""
    args = parse_args()
    input_path = resolve_path(args.input)
    output_path = resolve_path(args.output)

    try:
        convert_pdf_to_markdown(input_path, output_path)
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print(f"[OK] 변환 완료: {input_path}")
    print(f"[OK] 마크다운 저장: {output_path}")
    return 0


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    raise SystemExit(main())
