"""
Docling 라이브러리를 활용한 PDF → 마크다운 변환 예제

DocumentConverter를 사용하여 PDF에서 텍스트·표·수식·코드·이미지를 추출하고
헤더·푸터를 제거한 뒤 마크다운 파일로 저장함.
OCR(easyocr)과 TableFormer로 한국어 PDF 처리 품질을 높임.

기본 입력: ../AI GARAGE Proposal.pdf
기본 출력: ./result.md
"""

from __future__ import annotations

import argparse
import importlib.util
import os
import re
import shutil
import sys
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Any


os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
warnings.filterwarnings("ignore", category=UserWarning, module="huggingface_hub")
warnings.filterwarnings("ignore", message=".*pin_memory.*")

from docling.datamodel.accelerator_options import AcceleratorDevice, AcceleratorOptions
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import (
    EasyOcrOptions,
    PdfPipelineOptions,
    TableFormerMode,
    TableStructureOptions,
)
# DocumentConverter: PDF를 파싱하여 구조화된 문서 객체로 변환하는 Docling 핵심 클래스
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc.document import PictureItem, TableItem
from docling_core.types.doc.labels import DocItemLabel


# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = SCRIPT_DIR.parent / "AI GARAGE Proposal.pdf"
DEFAULT_OUTPUT = SCRIPT_DIR / "result.md"
DEFAULT_IMAGES_DIR = SCRIPT_DIR / "images"

REQUIRED_MODULES = {
    "docling": "docling",
    "easyocr": "easyocr",
    "hf_xet": "hf_xet",
}

EXCLUDED_LABELS = {
    DocItemLabel.PAGE_HEADER,
    DocItemLabel.PAGE_FOOTER,
}

FOOTER_PATTERNS = (
    "copyright",
    "all rights reserved",
    "ai garage bootcamp 제안서",
)


@dataclass
class ExportStats:
    """PDF 변환 결과의 요소별 카운터 (페이지·이미지·표·수식·코드 수 집계)."""

    skipped_header_footer: int = 0
    pages: int = 0
    page_images: int = 0
    pictures: int = 0
    tables: int = 0
    formulas: int = 0
    code_blocks: int = 0


def check_required_modules() -> None:
    """필수 패키지(docling, easyocr, hf_xet)가 설치되어 있는지 확인하고 없으면 오류를 발생시킴."""
    missing = [
        package_name
        for module_name, package_name in REQUIRED_MODULES.items()
        if importlib.util.find_spec(module_name) is None
    ]
    if missing:
        raise RuntimeError(
            "필수 라이브러리가 설치되지 않았습니다: "
            + ", ".join(missing)
            + "\n설치 명령: pip install docling easyocr hf_xet"
        )


def detect_torch_device() -> str:
    """사용 가능한 하드웨어 디바이스(cuda/mps/cpu)를 감지하여 문자열로 반환함."""
    try:
        import torch

        # GPU(CUDA) 사용 가능 여부 확인. 불가능하면 CPU 사용
        if torch.cuda.is_available():
            return "cuda"
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
    except Exception:
        return "cpu"

    return "cpu"


def warn_when_old_cuda() -> None:
    """CUDA가 존재하지만 PyTorch 빌드 버전이 12.1 미만인 경우 경고 메시지를 출력함."""
    try:
        import torch

        cuda_version = getattr(torch.version, "cuda", None)
        if not torch.cuda.is_available() or not cuda_version:
            return

        major, minor, *_ = [int(part) for part in cuda_version.split(".")]
        if (major, minor) < (12, 1):
            print(
                "[WARN] CUDA GPU가 감지되었지만 PyTorch CUDA 빌드가 "
                f"{cuda_version}입니다. GPU 사용 예제는 CUDA 12.1 이상 빌드 사용을 권장합니다."
            )
    except Exception:
        return


def create_pdf_pipeline_options() -> PdfPipelineOptions:
    """OCR·표·이미지·수식·코드 처리 옵션이 적용된 Docling PDF 파이프라인 옵션을 생성함."""
    options = PdfPipelineOptions()

    options.do_ocr = True
    options.ocr_options = EasyOcrOptions(
        lang=["ko", "en"],
        force_full_page_ocr=False,
        confidence_threshold=0.3,
    )

    options.do_table_structure = True
    options.table_structure_options = TableStructureOptions(
        mode=TableFormerMode.ACCURATE,
        do_cell_matching=True,
    )

    options.do_formula_enrichment = True
    options.do_code_enrichment = True
    options.generate_page_images = True
    options.generate_picture_images = True
    options.images_scale = 2.0
    options.accelerator_options = AcceleratorOptions(
        num_threads=4,
        device=AcceleratorDevice.AUTO,
    )

    return options


def create_converter() -> DocumentConverter:
    """PDF 입력 형식에 맞게 설정된 Docling DocumentConverter 인스턴스를 생성함."""
    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(
                pipeline_options=create_pdf_pipeline_options(),
            )
        }
    )


def clean_text(text: str) -> str:
    """연속 공백·비줄바꿈 공백을 단일 공백으로 정규화하여 반환함."""
    return re.sub(r"[ \t]+", " ", text.replace(" ", " ")).strip()


def should_skip_text(text: str) -> bool:
    """헤더·푸터 패턴에 해당하는 텍스트이면 True를 반환함."""
    normalized = clean_text(text).lower()
    if not normalized:
        return True
    return any(pattern in normalized for pattern in FOOTER_PATTERNS)


def write_clean_markdown(path: Path, content: str) -> None:
    """마크다운 내용을 UTF-8로 파일에 저장함. 출력 디렉터리가 없으면 자동 생성."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def reset_images_dir(images_dir: Path) -> None:
    """이미지 출력 디렉터리를 초기화함. 기존 디렉터리가 있으면 삭제 후 재생성."""
    if images_dir.exists():
        shutil.rmtree(images_dir)
    images_dir.mkdir(parents=True, exist_ok=True)


def save_page_images(conversion_result: Any, images_dir: Path) -> int:
    """Docling이 렌더링한 전체 페이지 이미지를 PNG 파일로 저장하고 저장 수를 반환함."""
    pages = getattr(conversion_result, "pages", None)
    if not pages:
        return 0

    page_items = pages.items() if isinstance(pages, dict) else enumerate(pages, start=1)
    saved_count = 0

    for page_no, (_page_key, page_obj) in enumerate(page_items, start=1):
        image = None
        if hasattr(page_obj, "get_image"):
            image = page_obj.get_image(scale=1.0)
        elif getattr(page_obj, "image", None) is not None:
            page_image = page_obj.image
            image = getattr(page_image, "pil_image", None) or page_image

        if image is None:
            continue

        image.save(images_dir / f"page_{page_no}.png")
        saved_count += 1

    return saved_count


def caption_text(item: PictureItem, item_by_ref: dict[str, Any]) -> str:
    """이미지 항목에 연결된 캡션 참조를 조회하여 캡션 텍스트를 반환함."""
    texts: list[str] = []
    for ref in getattr(item, "captions", []) or []:
        ref_key = getattr(ref, "cref", None) or str(ref)
        caption_item = item_by_ref.get(ref_key)
        text = clean_text(getattr(caption_item, "text", "") or "")
        if text:
            texts.append(text)
    return " ".join(texts)


def save_picture_image(
    item: PictureItem,
    doc: Any,
    images_dir: Path,
    picture_index: int,
) -> str | None:
    """추출된 이미지 1개를 PNG로 저장하고 마크다운용 상대 경로를 반환함.
    이미지가 없으면 None을 반환함."""
    image = None
    if getattr(item, "image", None) is not None:
        item_image = item.image
        image = getattr(item_image, "pil_image", None) or item_image

    if image is None and hasattr(item, "get_image"):
        image = item.get_image(doc=doc)

    if image is None:
        return None

    filename = f"image_{picture_index}.png"
    image.save(images_dir / filename)
    return f"images/{filename}"


def export_table_to_markdown(item: TableItem, doc: Any) -> str:
    """Docling 테이블 항목을 마크다운 표 문자열로 변환하여 반환함."""
    if hasattr(item, "export_to_markdown"):
        return item.export_to_markdown(doc=doc).strip()
    return clean_text(getattr(item, "text", "") or "")


def item_ref(item: Any) -> str | None:
    """Docling 항목의 self_ref 참조 문자열을 반환함. 없으면 None 반환."""
    ref = getattr(item, "self_ref", None)
    if ref is None:
        return None
    return getattr(ref, "cref", None) or str(ref)


def build_item_reference_map(doc: Any) -> dict[str, Any]:
    """문서 내 모든 항목을 참조 키로 조회할 수 있는 딕셔너리를 생성하여 반환함."""
    mapping: dict[str, Any] = {}
    for item, _level in doc.iterate_items():
        ref = item_ref(item)
        if ref:
            mapping[ref] = item
    return mapping


def build_caption_reference_set(doc: Any) -> set[str]:
    """이미지에 이미 연결된 캡션 항목의 참조 키 집합을 수집하여 반환함.
    중복 출력 방지 목적."""
    caption_refs: set[str] = set()
    for item, _level in doc.iterate_items():
        if getattr(item, "label", None) != DocItemLabel.PICTURE:
            continue
        for ref in getattr(item, "captions", []) or []:
            ref_key = getattr(ref, "cref", None) or str(ref)
            caption_refs.add(ref_key)
    return caption_refs


def markdown_for_item(
    item: Any,
    level: int,
    doc: Any,
    item_by_ref: dict[str, Any],
    caption_refs: set[str],
    images_dir: Path,
    stats: ExportStats,
) -> str:
    """Docling 문서 항목 1개를 마크다운 문자열로 직렬화하여 반환함.
    헤더·푸터·빈 항목은 빈 문자열을 반환함."""
    label = getattr(item, "label", None)
    text = clean_text(getattr(item, "text", "") or "")

    if label in EXCLUDED_LABELS:
        stats.skipped_header_footer += 1
        return ""

    if text and should_skip_text(text):
        stats.skipped_header_footer += 1
        return ""

    if label == DocItemLabel.TITLE and text:
        return f"# {text}"

    if label == DocItemLabel.SECTION_HEADER and text:
        heading_level = min(max(level + 1, 2), 6)
        return f"{'#' * heading_level} {text}"

    if label == DocItemLabel.LIST_ITEM and text:
        indent = "  " * max(level - 1, 0)
        return f"{indent}- {text.lstrip('-• ').strip()}"

    if label == DocItemLabel.TABLE:
        table_md = export_table_to_markdown(item, doc)
        if table_md:
            stats.tables += 1
            return table_md
        return ""

    if label == DocItemLabel.PICTURE:
        stats.pictures += 1
        caption = caption_text(item, item_by_ref) or f"Image {stats.pictures}"
        image_ref = save_picture_image(item, doc, images_dir, stats.pictures)
        if image_ref:
            return f"![{caption}]({image_ref})\n\n*{caption}*"
        return f"<!-- picture omitted: {caption} -->"

    if label == DocItemLabel.FORMULA and text:
        stats.formulas += 1
        return f"$$\n{text}\n$$"

    if label == DocItemLabel.CODE and text:
        stats.code_blocks += 1
        language = clean_text(getattr(item, "language", "") or "")
        return f"```{language}\n{text}\n```"

    if label == DocItemLabel.CAPTION and item_ref(item) in caption_refs:
        return ""

    if label == DocItemLabel.CAPTION and text:
        return f"*{text}*"

    if label == DocItemLabel.FOOTNOTE and text:
        return f"> {text}"

    if text:
        return text

    return ""


def export_filtered_markdown(doc: Any, images_dir: Path, stats: ExportStats) -> str:
    """헤더·푸터를 제외한 문서 전체를 마크다운 문자열로 변환하여 반환함."""
    item_by_ref = build_item_reference_map(doc)
    caption_refs = build_caption_reference_set(doc)
    parts: list[str] = []

    for item, level in doc.iterate_items():
        markdown = markdown_for_item(
            item,
            level,
            doc,
            item_by_ref,
            caption_refs,
            images_dir,
            stats,
        )
        if markdown:
            parts.append(markdown)

    return "\n\n".join(parts)


def convert_pdf_to_markdown(input_path: Path, output_path: Path, images_dir: Path) -> ExportStats:
    """PDF 파일 1개를 마크다운 파일과 이미지 파일로 변환하여 저장하고 통계를 반환함."""
    if not input_path.exists():
        raise FileNotFoundError(f"입력 PDF를 찾을 수 없습니다: {input_path}")

    check_required_modules()
    reset_images_dir(images_dir)
    warn_when_old_cuda()

    detected_device = detect_torch_device()
    print(f"[INFO] 하드웨어 감지: {detected_device.upper()} (Docling AcceleratorDevice.AUTO 사용)")
    print("[INFO] OCR: easyocr ko/en, TableFormer: ACCURATE")

    converter = create_converter()
    print(f"[INFO] PDF 변환 시작: {input_path}")
    result = converter.convert(input_path)
    print(f"[INFO] 변환 상태: {getattr(result, 'status', 'unknown')}")

    stats = ExportStats()
    doc = result.document
    stats.pages = len(getattr(result, "pages", {}) or [])
    stats.page_images = save_page_images(result, images_dir)

    markdown = export_filtered_markdown(doc, images_dir, stats)
    write_clean_markdown(output_path, markdown)

    return stats


def parse_args() -> argparse.Namespace:
    """명령줄 옵션(입력 PDF, 출력 MD, 이미지 디렉터리)을 파싱하여 반환함."""
    parser = argparse.ArgumentParser(description="Docling PDF to Markdown converter")
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
        help=f"출력 Markdown 경로. 기본값: {DEFAULT_OUTPUT}",
    )
    parser.add_argument(
        "--images-dir",
        type=Path,
        default=DEFAULT_IMAGES_DIR,
        help=f"이미지 출력 디렉터리. 기본값: {DEFAULT_IMAGES_DIR}",
    )
    return parser.parse_args()


def main() -> int:
    """변환 워크플로우를 실행하고 종료 코드를 반환함.
    성공 시 0, 오류 발생 시 1을 반환함."""
    args = parse_args()
    input_path = args.input.expanduser().resolve()
    output_path = args.output.expanduser().resolve()
    images_dir = args.images_dir.expanduser().resolve()

    try:
        stats = convert_pdf_to_markdown(input_path, output_path, images_dir)
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print(f"[OK] Markdown 저장: {output_path}")
    print(f"[OK] 이미지 디렉터리: {images_dir}")
    print(
        "[INFO] 통계: "
        f"pages={stats.pages}, page_images={stats.page_images}, "
        f"pictures={stats.pictures}, tables={stats.tables}, "
        f"formulas={stats.formulas}, code_blocks={stats.code_blocks}, "
        f"skipped_header_footer={stats.skipped_header_footer}"
    )
    return 0


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    raise SystemExit(main())
