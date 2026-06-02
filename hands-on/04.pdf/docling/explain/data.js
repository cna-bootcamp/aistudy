/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../04.pdf/docling/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "Docling PDF → 마크다운 변환 예제 설명",
    entry: "pdf2md.py",
  },

  files: [
    { id: "main", label: "pdf2md.py", role: "단일 파일 CLI 예제 · PDF를 마크다운으로 변환" },
  ],

  flow: [
    { step: 1, title: "실행 시작",
      summary: "python pdf2md.py 실행 → main()이 진입점으로 호출됨",
      detail: "이 예제는 명령줄 프로그램임. 터미널에서 실행하면 맨 아래 if __name__ == '__main__': 가 main()을 호출함. main()이 전체 변환 작업을 순서대로 지휘함." },
    { step: 2, title: "명령줄 옵션 읽기",
      summary: "parse_args()로 --input(PDF 경로)·--output(MD 경로)·--images-dir 옵션을 읽음",
      detail: "식당 주문서를 받는 단계와 비슷함. argparse가 '--input 파일.pdf' 같은 명령줄 입력을 해석해, 어떤 PDF를 변환하고 어디에 저장할지 정함. 옵션을 생략하면 기본값을 씀." },
    { step: 3, title: "PDF 변환",
      summary: "convert_pdf_to_markdown()이 필수 모듈 확인·이미지 초기화·변환기 생성·변환 실행을 순서대로 처리함",
      detail: "핵심 변환 단계임. 순서대로: 필수 패키지(docling, easyocr, hf_xet) 설치 여부 확인 → 이미지 폴더 초기화 → GPU/CPU 장치 감지 → DocumentConverter(변환기) 생성 → PDF 변환 → 페이지 이미지 저장." },
    { step: 4, title: "문서 항목 순회",
      summary: "export_filtered_markdown()이 문서 모든 항목을 돌며 항목별로 마크다운 문자열을 만듦",
      detail: "PDF의 각 요소(제목·표·이미지·수식 등)를 하나씩 꺼내 마크다운으로 변환하는 단계임. 헤더·푸터는 건너뛰고, 표는 마크다운 표로, 이미지는 PNG로 저장 후 링크로, 수식은 $$...$$로 변환함." },
    { step: 5, title: "마크다운 저장",
      summary: "write_clean_markdown()이 변환된 마크다운 내용을 UTF-8 파일로 저장함",
      detail: "완성된 마크다운 텍스트를 파일로 저장하는 단계임. 저장 디렉터리가 없으면 자동으로 만들고 UTF-8 인코딩으로 저장함(한글이 깨지지 않게 인코딩 필수)." },
    { step: 6, title: "통계 출력 후 종료",
      summary: "변환된 페이지·이미지·표·수식·코드 수를 출력하고 종료 코드 0(성공)을 반환함",
      detail: "작업이 끝나면 어디에 저장했는지와 변환 통계를 출력하고 끝남. 도중에 오류가 나면 메시지를 출력하고 종료 코드 1(실패)을 돌려줌." },
  ],

  functions: [
    {
      id: "module_setup",
      name: "모듈 설정 (경로·상수·dataclass)",
      fileId: "main",
      summary: "파일 맨 위에서 경고 억제, 기본 경로, 필수 모듈 목록, 제외 라벨, 푸터 패턴, 통계 dataclass를 준비함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 준비하는 값들'임. 이 파일 위치를 기준으로 기본 입력·출력·이미지 경로를 자동으로 계산하고, Docling이 건너뛸 헤더·푸터 패턴을 상수로 정의함. ExportStats는 변환 결과를 항목별로 세는 카운터 클래스임.",
      terms: ["Path(__file__).resolve().parent", "from __future__ import annotations", "@dataclass", "set(집합)", "os.environ.setdefault"],
      lines: [
        { at: "from __future__ import annotations", text: "타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함. 파이썬 3.10 미만에서도 최신 타입 힌트 문법을 쓸 수 있음." },
        { at: 'os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")', text: "HuggingFace 허브 라이브러리가 출력하는 불필요한 심볼릭 링크 경고를 끄는 환경변수를 설정함." },
        { at: "SCRIPT_DIR = Path(__file__).resolve().parent", text: "Path(__file__)은 '이 파일의 위치'. .resolve().parent로 이 파일이 든 폴더의 절대경로를 구함. 어디서 실행해도 경로가 어긋나지 않음." },
        { at: "REQUIRED_MODULES = {", text: "프로그램이 반드시 필요한 외부 패키지 목록임. 키는 import 이름, 값은 pip 설치 이름임." },
        { at: "EXCLUDED_LABELS = {", text: "Docling이 분류한 라벨 중 헤더(PAGE_HEADER)·푸터(PAGE_FOOTER)는 건너뛸 라벨 집합임." },
        { at: "FOOTER_PATTERNS = (", text: "텍스트 내용으로 추가 필터링할 푸터 패턴 문자열 목록임. 이 문자열이 포함된 줄은 건너뜀." },
        { at: "@dataclass", text: "@dataclass는 데이터를 담는 클래스를 짧게 만들어주는 데코레이터임. 각 항목에 기본값 0을 줘 카운터로 사용함." },
      ],
      code:
`from __future__ import annotations

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
    code_blocks: int = 0`,
    },
    {
      id: "check_required_modules",
      name: "check_required_modules()",
      fileId: "main",
      summary: "필수 패키지(docling, easyocr, hf_xet)가 설치되어 있는지 확인하고 없으면 오류를 발생시킴.",
      how: "importlib.util.find_spec()으로 각 패키지가 설치됐는지 조용히 확인함. 없는 게 하나라도 있으면 RuntimeError로 '어떤 패키지를 설치해야 하는지' 분명하게 알려줌. 이렇게 하면 변환 도중 알 수 없는 오류가 나는 대신 시작할 때 바로 알 수 있음.",
      terms: ["리스트 컴프리헨션", "importlib.util.find_spec", "RuntimeError"],
      lines: [
        { at: "missing = [", text: "리스트 컴프리헨션으로 설치되지 않은(find_spec이 None을 반환하는) 패키지만 골라 목록을 만듦." },
        { at: "if importlib.util.find_spec(module_name) is None", text: "find_spec()은 패키지를 실제로 import하지 않고 설치 여부만 조용히 확인하는 함수임. 없으면 None을 반환함." },
        { at: "if missing:", text: "빠진 패키지가 하나라도 있으면 RuntimeError로 어떤 것을 설치해야 하는지 알려줌." },
      ],
      code:
`def check_required_modules() -> None:
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
            + "\\n설치 명령: pip install docling easyocr hf_xet"
        )`,
    },
    {
      id: "detect_torch_device",
      name: "detect_torch_device()",
      fileId: "main",
      summary: "사용 가능한 하드웨어 디바이스(cuda/mps/cpu)를 감지하여 문자열로 반환함.",
      how: "딥러닝 작업은 GPU(그래픽 카드)를 쓰면 훨씬 빠름. 이 함수는 NVIDIA GPU(CUDA), Apple Silicon GPU(MPS), 일반 CPU 순서로 사용 가능한 것을 확인해 문자열로 알려줌. torch가 설치되지 않았거나 오류가 나면 cpu를 반환함.",
      terms: ["CUDA", "MPS", "예외 처리(try/except)", "타입 힌트"],
      lines: [
        { at: "import torch", text: "torch(PyTorch)는 딥러닝 라이브러리임. 이 함수 안에서만 필요하므로 함수 내부에서 import함." },
        { at: "if torch.cuda.is_available():", text: "NVIDIA GPU(CUDA)가 사용 가능하면 'cuda'를 반환함. GPU가 있으면 변환 속도가 크게 빨라짐." },
        { at: 'if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():', text: "Apple Silicon(M1/M2/M3 등) GPU(MPS)가 사용 가능하면 'mps'를 반환함." },
        { at: 'except Exception:', text: "torch가 없거나 오류가 나면 가장 기본인 'cpu'를 반환함(안전 처리)." },
      ],
      code:
`def detect_torch_device() -> str:
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

    return "cpu"`,
    },
    {
      id: "warn_when_old_cuda",
      name: "warn_when_old_cuda()",
      fileId: "main",
      summary: "CUDA가 존재하지만 PyTorch 빌드 버전이 12.1 미만인 경우 경고 메시지를 출력함.",
      how: "GPU 가속 예제는 CUDA 12.1 이상 버전의 PyTorch가 필요함. 낮은 버전을 쓰면 동작은 하지만 성능이 나쁘거나 일부 기능이 안 될 수 있음. 이 함수는 그 경우를 미리 감지해 사용자에게 알려줌.",
      terms: ["CUDA", "예외 처리(try/except)", "타입 힌트"],
      lines: [
        { at: "cuda_version = getattr(torch.version, \"cuda\", None)", text: "PyTorch에 함께 포함된 CUDA 버전 문자열을 가져옴. 없으면 None." },
        { at: "major, minor, *_ = [int(part) for part in cuda_version.split(\".\")]", text: "버전 문자열 '12.1'을 점(.)으로 쪼개 숫자로 변환함. *_는 '나머지는 무시' 뜻임." },
        { at: 'if (major, minor) < (12, 1):', text: "파이썬에서 튜플끼리 비교하면 첫 번째 원소부터 순서대로 비교함. (12,1) 미만이면 경고를 출력함." },
      ],
      code:
`def warn_when_old_cuda() -> None:
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
        return`,
    },
    {
      id: "create_pdf_pipeline_options",
      name: "create_pdf_pipeline_options()",
      fileId: "main",
      summary: "OCR·표·이미지·수식·코드 처리 옵션이 적용된 Docling PDF 파이프라인 옵션을 생성함.",
      how: "Docling이 PDF를 어떻게 분석할지 세부 설정을 담은 '설정 묶음'을 만드는 함수임. OCR은 한국어·영어를 인식하도록 easyocr을 쓰고, 표는 TableFormer ACCURATE 모드로 정밀하게 인식하며, 수식·코드·이미지도 추출하도록 설정함. 이미지 배율 2.0은 화질을 높이기 위한 것임.",
      terms: ["OCR", "EasyOCR", "TableFormer", "AcceleratorDevice", "PdfPipelineOptions"],
      lines: [
        { at: "options = PdfPipelineOptions()", text: "Docling PDF 파이프라인의 기본 옵션 객체를 만듦. 아래에서 하나씩 설정을 덮어씀." },
        { at: "options.do_ocr = True", text: "OCR(광학 문자 인식)을 켬. 이미지로 된 텍스트도 읽어냄." },
        { at: "options.ocr_options = EasyOcrOptions(", text: "EasyOCR을 한국어(ko)·영어(en) 인식으로 설정함. confidence_threshold=0.3은 인식 확신도가 30% 이상인 것만 채택함." },
        { at: "options.do_table_structure = True", text: "PDF의 표 구조를 인식하도록 TableFormer를 켬." },
        { at: "mode=TableFormerMode.ACCURATE,", text: "ACCURATE 모드는 속도보다 정확도를 우선함. 복잡한 표도 잘 인식함." },
        { at: "options.do_formula_enrichment = True", text: "수식(LaTeX 등)을 인식해 마크다운 수식 형식으로 변환함." },
        { at: "options.images_scale = 2.0", text: "페이지·이미지를 2배 배율로 저장해 화질을 높임." },
        { at: "options.accelerator_options = AcceleratorOptions(", text: "병렬 처리 스레드 수와 장치(GPU/CPU)를 설정함. AUTO는 사용 가능한 장치를 자동 선택함." },
      ],
      code:
`def create_pdf_pipeline_options() -> PdfPipelineOptions:
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

    return options`,
    },
    {
      id: "create_converter",
      name: "create_converter()",
      fileId: "main",
      summary: "PDF 입력 형식에 맞게 설정된 Docling DocumentConverter 인스턴스를 생성함.",
      how: "DocumentConverter는 Docling의 핵심 변환기임. PDF 형식에 대해 어떤 파이프라인 옵션을 쓸지 지정해서 만듦. 이렇게 만든 converter에 PDF 경로를 주면 변환을 실행함.",
      terms: ["DocumentConverter", "InputFormat", "딕셔너리(dict)"],
      lines: [
        { at: "return DocumentConverter(", text: "DocumentConverter를 생성함. format_options로 PDF 형식에 대한 상세 옵션을 지정함." },
        { at: "InputFormat.PDF: PdfFormatOption(", text: "PDF 형식(InputFormat.PDF)에 대해 앞서 만든 파이프라인 옵션을 연결함." },
      ],
      code:
`def create_converter() -> DocumentConverter:
    """PDF 입력 형식에 맞게 설정된 Docling DocumentConverter 인스턴스를 생성함."""
    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(
                pipeline_options=create_pdf_pipeline_options(),
            )
        }
    )`,
    },
    {
      id: "clean_text",
      name: "clean_text(text)",
      fileId: "main",
      summary: "연속 공백·비줄바꿈 공백을 단일 공백으로 정규화하여 반환함.",
      how: "PDF에서 추출한 텍스트는 특수 공백 문자(줄바꿈이 아닌 공백, 탭 등)가 섞여 있을 수 있음. 정규식으로 이런 공백들을 모두 단일 공백으로 정리하고 앞뒤 공백을 제거함.",
      terms: ["정규식(re)", "타입 힌트"],
      lines: [
        { at: 'return re.sub(r"[ \\t]+", " ", text.replace(', text: "r'[ \\t]+'는 공백·탭이 1개 이상 연속된 패턴임. 이를 단일 공백으로 바꿈. text.replace로 비줄바꿈 공백( )도 일반 공백으로 먼저 변환함." },
      ],
      code:
`def clean_text(text: str) -> str:
    """연속 공백·비줄바꿈 공백을 단일 공백으로 정규화하여 반환함."""
    return re.sub(r"[ \\t]+", " ", text.replace("\\u00a0", " ")).strip()`,
    },
    {
      id: "should_skip_text",
      name: "should_skip_text(text)",
      fileId: "main",
      summary: "헤더·푸터 패턴에 해당하는 텍스트이면 True를 반환함.",
      how: "PDF에는 모든 페이지 상단·하단에 같은 문구(회사명, 저작권 등)가 반복되는 경우가 많음. 이런 반복 문구를 걸러내기 위해 FOOTER_PATTERNS에 있는 문자열이 포함됐는지 확인함. any()는 '하나라도 해당되면 True'를 반환함.",
      terms: [".lower()", "any()", "타입 힌트"],
      lines: [
        { at: "normalized = clean_text(text).lower()", text: "텍스트를 정규화한 뒤 소문자로 바꿈. 대소문자 구분 없이 패턴을 비교하기 위함." },
        { at: "if not normalized:", text: "정규화 후 빈 문자열이면 건너뛸 대상으로 간주함(True 반환)." },
        { at: "return any(pattern in normalized for pattern in FOOTER_PATTERNS)", text: "any()는 패턴 목록 중 하나라도 텍스트에 들어있으면 True를 반환함(푸터로 판단)." },
      ],
      code:
`def should_skip_text(text: str) -> bool:
    """헤더·푸터 패턴에 해당하는 텍스트이면 True를 반환함."""
    normalized = clean_text(text).lower()
    if not normalized:
        return True
    return any(pattern in normalized for pattern in FOOTER_PATTERNS)`,
    },
    {
      id: "write_clean_markdown",
      name: "write_clean_markdown(path, content)",
      fileId: "main",
      summary: "마크다운 내용을 UTF-8로 파일에 저장함. 출력 디렉터리가 없으면 자동 생성.",
      how: "변환된 마크다운 텍스트를 파일로 저장하는 함수임. 저장할 폴더가 없으면 parents=True로 중간 폴더까지 한꺼번에 만들어 줌. content.rstrip() + '\\n'은 파일 끝에 빈 줄이 여러 개 생기는 것을 방지하고 마지막 줄바꿈 하나를 보장함.",
      terms: ["mkdir", "write_text", "타입 힌트"],
      lines: [
        { at: "path.parent.mkdir(parents=True, exist_ok=True)", text: "저장할 파일의 상위 폴더가 없으면 만들어 둠. parents=True는 중간 폴더도 모두 생성, exist_ok=True는 이미 있어도 오류 없이 넘어감." },
        { at: 'path.write_text(content.rstrip() + "\\n", encoding="utf-8")', text: "마크다운 내용을 UTF-8로 파일에 씀. rstrip()으로 끝 공백·빈줄을 제거하고 줄바꿈 하나를 붙임." },
      ],
      code:
`def write_clean_markdown(path: Path, content: str) -> None:
    """마크다운 내용을 UTF-8로 파일에 저장함. 출력 디렉터리가 없으면 자동 생성."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\\n", encoding="utf-8")`,
    },
    {
      id: "reset_images_dir",
      name: "reset_images_dir(images_dir)",
      fileId: "main",
      summary: "이미지 출력 디렉터리를 초기화함. 기존 디렉터리가 있으면 삭제 후 재생성.",
      how: "변환을 다시 실행할 때 이전 이미지 파일이 남아 있으면 혼란을 줄 수 있음. 이 함수는 이미지 폴더를 깨끗하게 비우고 새로 만들어 항상 최신 결과만 남게 함.",
      terms: ["shutil.rmtree", "mkdir", "타입 힌트"],
      lines: [
        { at: "if images_dir.exists():", text: "이미지 폴더가 이미 있으면 삭제함. 없으면 이 블록을 건너뜀." },
        { at: "shutil.rmtree(images_dir)", text: "shutil.rmtree()는 폴더와 그 안의 모든 파일을 한꺼번에 삭제함(폴더 통째 삭제)." },
        { at: "images_dir.mkdir(parents=True, exist_ok=True)", text: "삭제 후 새 이미지 폴더를 만듦." },
      ],
      code:
`def reset_images_dir(images_dir: Path) -> None:
    """이미지 출력 디렉터리를 초기화함. 기존 디렉터리가 있으면 삭제 후 재생성."""
    if images_dir.exists():
        shutil.rmtree(images_dir)
    images_dir.mkdir(parents=True, exist_ok=True)`,
    },
    {
      id: "save_page_images",
      name: "save_page_images(conversion_result, images_dir)",
      fileId: "main",
      summary: "Docling이 렌더링한 전체 페이지 이미지를 PNG 파일로 저장하고 저장 수를 반환함.",
      how: "PDF의 각 페이지를 이미지로 저장하는 함수임. Docling 버전마다 페이지 객체 구조가 다를 수 있어, dict인지 리스트인지에 따라 다르게 처리함. 각 페이지에서 이미지를 꺼내(get_image 또는 .image) page_N.png로 저장함.",
      terms: ["getattr()", "isinstance()", "enumerate()", "타입 힌트"],
      lines: [
        { at: "pages = getattr(conversion_result, \"pages\", None)", text: "getattr()은 객체에서 속성을 안전하게 꺼내는 함수임. pages 속성이 없으면 None을 반환함." },
        { at: "page_items = pages.items() if isinstance(pages, dict) else enumerate(pages, start=1)", text: "pages가 딕셔너리이면 .items()로, 리스트이면 enumerate로 순서와 함께 꺼냄. Docling 버전 차이를 흡수함." },
        { at: "if hasattr(page_obj, \"get_image\"):", text: "페이지 객체에 get_image 메서드가 있으면 그걸 써서 이미지를 가져옴." },
        { at: "image.save(images_dir / f\"page_{page_no}.png\")", text: "PIL 이미지 객체의 save()로 페이지 이미지를 PNG 파일로 저장함." },
      ],
      code:
`def save_page_images(conversion_result: Any, images_dir: Path) -> int:
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

    return saved_count`,
    },
    {
      id: "caption_text",
      name: "caption_text(item, item_by_ref)",
      fileId: "main",
      summary: "이미지 항목에 연결된 캡션 참조를 조회하여 캡션 텍스트를 반환함.",
      how: "PDF에서 이미지 아래에 적힌 그림 설명(캡션)은 이미지 항목과 별도로 저장되고 참조로 연결되어 있음. 이 함수는 이미지 항목의 captions 목록을 돌며 참조 키로 item_by_ref 딕셔너리에서 캡션 항목을 찾아 텍스트를 이어 붙여 반환함.",
      terms: ["getattr()", "딕셔너리(dict)", ".get()", "타입 힌트"],
      lines: [
        { at: "for ref in getattr(item, \"captions\", []) or []:", text: "이미지 항목의 captions 목록을 꺼냄. 없으면 빈 목록으로 안전하게 처리함." },
        { at: "ref_key = getattr(ref, \"cref\", None) or str(ref)", text: "캡션 참조의 키(cref)를 가져옴. 없으면 문자열로 변환해 씀." },
        { at: "caption_item = item_by_ref.get(ref_key)", text: "참조 키로 캡션 항목을 딕셔너리에서 찾음. 없으면 None." },
        { at: "return \" \".join(texts)", text: "여러 캡션이 있으면 공백으로 이어 붙여 반환함." },
      ],
      code:
`def caption_text(item: PictureItem, item_by_ref: dict[str, Any]) -> str:
    """이미지 항목에 연결된 캡션 참조를 조회하여 캡션 텍스트를 반환함."""
    texts: list[str] = []
    for ref in getattr(item, "captions", []) or []:
        ref_key = getattr(ref, "cref", None) or str(ref)
        caption_item = item_by_ref.get(ref_key)
        text = clean_text(getattr(caption_item, "text", "") or "")
        if text:
            texts.append(text)
    return " ".join(texts)`,
    },
    {
      id: "save_picture_image",
      name: "save_picture_image(item, doc, images_dir, picture_index)",
      fileId: "main",
      summary: "추출된 이미지 1개를 PNG로 저장하고 마크다운용 상대 경로를 반환함. 이미지가 없으면 None을 반환함.",
      how: "Docling이 추출한 이미지 항목에서 실제 PIL 이미지 객체를 꺼내 저장함. 이미지를 꺼내는 방법이 Docling 버전마다 다를 수 있어 두 가지 방식을 순서대로 시도함(item.image → item.get_image()). 저장 후 마크다운에 넣을 상대경로를 반환함.",
      terms: ["getattr()", "타입 힌트"],
      lines: [
        { at: "if getattr(item, \"image\", None) is not None:", text: "이미지 항목에 image 속성이 있으면 그 속성에서 PIL 이미지를 꺼냄." },
        { at: "if image is None and hasattr(item, \"get_image\"):", text: "첫 번째 방법으로 이미지를 못 찾으면 get_image() 메서드를 시도함." },
        { at: "if image is None:", text: "두 가지 방법 모두 실패하면 None을 반환해 이미지 없음을 알림." },
        { at: "return f\"images/{filename}\"", text: "마크다운 이미지 링크에 쓸 상대경로를 반환함(이미지 파일 저장 후)." },
      ],
      code:
`def save_picture_image(
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
    return f"images/{filename}"`,
    },
    {
      id: "export_table_to_markdown",
      name: "export_table_to_markdown(item, doc)",
      fileId: "main",
      summary: "Docling 테이블 항목을 마크다운 표 문자열로 변환하여 반환함.",
      how: "TableItem에는 export_to_markdown() 메서드가 있으면 그걸 써서 마크다운 표를 만들고, 없으면 텍스트만 꺼내 반환함. Docling 버전 호환성을 위해 hasattr로 메서드 존재 여부를 먼저 확인함.",
      terms: ["hasattr()", "타입 힌트"],
      lines: [
        { at: "if hasattr(item, \"export_to_markdown\"):", text: "TableItem에 export_to_markdown 메서드가 있으면 그걸 써서 마크다운 표로 변환함." },
        { at: "return item.export_to_markdown(doc=doc).strip()", text: "마크다운 표 문자열을 앞뒤 공백 제거 후 반환함." },
        { at: "return clean_text(getattr(item, \"text\", \"\") or \"\")", text: "메서드가 없으면 item의 text를 정규화해 반환함(폴백 처리)." },
      ],
      code:
`def export_table_to_markdown(item: TableItem, doc: Any) -> str:
    """Docling 테이블 항목을 마크다운 표 문자열로 변환하여 반환함."""
    if hasattr(item, "export_to_markdown"):
        return item.export_to_markdown(doc=doc).strip()
    return clean_text(getattr(item, "text", "") or "")`,
    },
    {
      id: "item_ref",
      name: "item_ref(item)",
      fileId: "main",
      summary: "Docling 항목의 self_ref 참조 문자열을 반환함. 없으면 None 반환.",
      how: "Docling 문서의 각 항목은 고유 참조 키(self_ref)를 가짐. 이 키로 항목들 사이 관계(이미지-캡션 등)를 연결함. getattr을 두 번 써서 None이 나와도 오류 없이 처리함.",
      terms: ["getattr()", "타입 힌트"],
      lines: [
        { at: "ref = getattr(item, \"self_ref\", None)", text: "항목에서 self_ref 속성을 안전하게 꺼냄. 없으면 None." },
        { at: "return getattr(ref, \"cref\", None) or str(ref)", text: "ref.cref가 있으면 그걸, 없으면 문자열로 변환해 반환함." },
      ],
      code:
`def item_ref(item: Any) -> str | None:
    """Docling 항목의 self_ref 참조 문자열을 반환함. 없으면 None 반환."""
    ref = getattr(item, "self_ref", None)
    if ref is None:
        return None
    return getattr(ref, "cref", None) or str(ref)`,
    },
    {
      id: "build_item_reference_map",
      name: "build_item_reference_map(doc)",
      fileId: "main",
      summary: "문서 내 모든 항목을 참조 키로 조회할 수 있는 딕셔너리를 생성하여 반환함.",
      how: "이미지 캡션처럼 참조로 연결된 항목을 빠르게 찾기 위해 '키→항목' 딕셔너리를 미리 만들어 두는 함수임. iterate_items()로 문서의 모든 항목을 순회하면서 참조 키가 있는 것만 딕셔너리에 넣음.",
      terms: ["딕셔너리(dict)", "iterate_items", "타입 힌트"],
      lines: [
        { at: "mapping: dict[str, Any] = {}", text: "빈 딕셔너리로 시작함. 참조 키 → 항목 객체를 담을 예정임." },
        { at: "for item, _level in doc.iterate_items():", text: "doc.iterate_items()는 문서의 모든 항목과 그 깊이(레벨)를 순서대로 꺼내 주는 Docling 메서드임. _level은 이 함수에서 사용하지 않아 _로 표시함." },
        { at: "mapping[ref] = item", text: "참조 키를 열쇠로 해서 항목 객체를 딕셔너리에 넣음. 나중에 O(1)로 빠르게 찾을 수 있음." },
      ],
      code:
`def build_item_reference_map(doc: Any) -> dict[str, Any]:
    """문서 내 모든 항목을 참조 키로 조회할 수 있는 딕셔너리를 생성하여 반환함."""
    mapping: dict[str, Any] = {}
    for item, _level in doc.iterate_items():
        ref = item_ref(item)
        if ref:
            mapping[ref] = item
    return mapping`,
    },
    {
      id: "build_caption_reference_set",
      name: "build_caption_reference_set(doc)",
      fileId: "main",
      summary: "이미지에 이미 연결된 캡션 항목의 참조 키 집합을 수집하여 반환함. 중복 출력 방지 목적.",
      how: "이미지의 캡션은 이미지를 처리할 때 이미 마크다운에 포함됨. 캡션 항목이 독립 항목으로도 등장하면 같은 내용이 두 번 출력됨. 이 집합(set)에 이미 처리된 캡션 참조 키를 모아두어 중복 출력을 방지함.",
      terms: ["set(집합)", "iterate_items", "DocItemLabel", "타입 힌트"],
      lines: [
        { at: "caption_refs: set[str] = set()", text: "중복 없는 캡션 참조 키 집합을 빈 set으로 시작함." },
        { at: "if getattr(item, \"label\", None) != DocItemLabel.PICTURE:", text: "이미지(PICTURE) 항목만 처리함. 다른 항목은 건너뜀." },
        { at: "caption_refs.add(ref_key)", text: "이 이미지에 연결된 캡션의 참조 키를 집합에 추가함. 나중에 이 키의 항목은 독립 출력을 건너뜀." },
      ],
      code:
`def build_caption_reference_set(doc: Any) -> set[str]:
    """이미지에 이미 연결된 캡션 항목의 참조 키 집합을 수집하여 반환함.
    중복 출력 방지 목적."""
    caption_refs: set[str] = set()
    for item, _level in doc.iterate_items():
        if getattr(item, "label", None) != DocItemLabel.PICTURE:
            continue
        for ref in getattr(item, "captions", []) or []:
            ref_key = getattr(ref, "cref", None) or str(ref)
            caption_refs.add(ref_key)
    return caption_refs`,
    },
    {
      id: "markdown_for_item",
      name: "markdown_for_item(item, level, doc, item_by_ref, caption_refs, images_dir, stats)",
      fileId: "main",
      summary: "Docling 문서 항목 1개를 마크다운 문자열로 직렬화하여 반환함. 헤더·푸터·빈 항목은 빈 문자열을 반환함.",
      how: "PDF의 각 항목(제목·표·이미지·수식·코드·목록·각주 등)을 마크다운으로 변환하는 핵심 함수임. 라벨(DocItemLabel)에 따라 다른 마크다운 형식을 적용함. 헤더·푸터는 건너뛰고 stats로 카운터를 올림.",
      terms: ["DocItemLabel", "getattr()", "f-string", "타입 힌트"],
      lines: [
        { at: "label = getattr(item, \"label\", None)", text: "항목의 라벨(제목·표·이미지 등 항목 종류)을 안전하게 꺼냄." },
        { at: "if label in EXCLUDED_LABELS:", text: "헤더·푸터 라벨이면 카운터를 올리고 빈 문자열로 건너뜀." },
        { at: "if label == DocItemLabel.TITLE and text:", text: "제목(TITLE) 항목이면 마크다운 # 제목으로 변환함." },
        { at: "if label == DocItemLabel.SECTION_HEADER and text:", text: "섹션 헤더이면 깊이(level)에 따라 ##~###### 헤더로 변환함." },
        { at: "if label == DocItemLabel.LIST_ITEM and text:", text: "목록 항목이면 들여쓰기와 - 를 붙여 마크다운 목록으로 변환함." },
        { at: "if label == DocItemLabel.TABLE:", text: "표 항목이면 export_table_to_markdown()으로 마크다운 표로 변환하고 카운터를 올림." },
        { at: "if label == DocItemLabel.PICTURE:", text: "이미지 항목이면 PNG로 저장하고 마크다운 이미지 링크로 변환함." },
        { at: "if label == DocItemLabel.FORMULA and text:", text: "수식 항목이면 $$...$$로 감싸 마크다운 수식 형식으로 변환함." },
        { at: "if label == DocItemLabel.CODE and text:", text: "코드 블록 항목이면 백틱 세 개(\`)로 감싸 마크다운 코드 블록으로 변환함." },
        { at: "if label == DocItemLabel.CAPTION and item_ref(item) in caption_refs:", text: "이미 이미지에 포함된 캡션이면 중복 출력을 막기 위해 빈 문자열 반환." },
        { at: "if label == DocItemLabel.FOOTNOTE and text:", text: "각주 항목이면 인용 블록(>) 형식으로 변환함." },
      ],
      code:
`def markdown_for_item(
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
            return f"![{caption}]({image_ref})\\n\\n*{caption}*"
        return f"<!-- picture omitted: {caption} -->"

    if label == DocItemLabel.FORMULA and text:
        stats.formulas += 1
        return f"$$\\n{text}\\n$$"

    if label == DocItemLabel.CODE and text:
        stats.code_blocks += 1
        language = clean_text(getattr(item, "language", "") or "")
        return f"\`\`\`{language}\\n{text}\\n\`\`\`"

    if label == DocItemLabel.CAPTION and item_ref(item) in caption_refs:
        return ""

    if label == DocItemLabel.CAPTION and text:
        return f"*{text}*"

    if label == DocItemLabel.FOOTNOTE and text:
        return f"> {text}"

    if text:
        return text

    return ""`,
    },
    {
      id: "export_filtered_markdown",
      name: "export_filtered_markdown(doc, images_dir, stats)",
      fileId: "main",
      summary: "헤더·푸터를 제외한 문서 전체를 마크다운 문자열로 변환하여 반환함.",
      how: "문서의 모든 항목을 순서대로 꺼내 markdown_for_item()으로 각각 변환하고, 내용이 있는 것만 목록에 모아 두 줄 빈칸(\\n\\n)으로 이어 붙임. 마크다운에서 단락 구분은 빈 줄 하나가 표준임.",
      terms: ["iterate_items", "리스트(list)", "타입 힌트"],
      lines: [
        { at: "item_by_ref = build_item_reference_map(doc)", text: "먼저 항목 참조 딕셔너리와 캡션 집합을 만들어 두고, 항목을 순회할 때 빠르게 조회함." },
        { at: "parts: list[str] = []", text: "내용이 있는 마크다운 조각들을 담을 빈 목록을 만듦." },
        { at: "for item, level in doc.iterate_items():", text: "문서의 모든 항목을 깊이(level)와 함께 순서대로 꺼냄." },
        { at: "if markdown:", text: "변환 결과가 빈 문자열이 아닌 경우만 목록에 추가함(건너뛴 항목은 제외)." },
        { at: 'return "\\n\\n".join(parts)', text: "모든 마크다운 조각을 빈 줄(\\n\\n) 하나로 이어 붙여 하나의 마크다운 문자열로 반환함." },
      ],
      code:
`def export_filtered_markdown(doc: Any, images_dir: Path, stats: ExportStats) -> str:
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

    return "\\n\\n".join(parts)`,
    },
    {
      id: "convert_pdf_to_markdown",
      name: "convert_pdf_to_markdown(input_path, output_path, images_dir)",
      fileId: "main",
      summary: "PDF 파일 1개를 마크다운 파일과 이미지 파일로 변환하여 저장하고 통계를 반환함.",
      how: "변환 전체를 지휘하는 함수임. 순서대로: PDF 파일 존재 확인 → 필수 모듈 확인 → 이미지 폴더 초기화 → GPU/CPU 감지 → DocumentConverter 생성 → PDF 변환 실행 → 페이지 이미지 저장 → 마크다운 변환·저장 → 통계 반환.",
      terms: ["FileNotFoundError", "DocumentConverter", "ExportStats", "타입 힌트"],
      lines: [
        { at: "if not input_path.exists():", text: "입력 PDF 파일이 없으면 FileNotFoundError로 즉시 알려줌." },
        { at: "converter = create_converter()", text: "OCR·표·이미지·수식 옵션이 적용된 DocumentConverter를 생성함." },
        { at: "result = converter.convert(input_path)", text: "★핵심★ converter.convert()가 PDF를 파싱해 Docling 문서 객체로 변환함. 이 한 줄이 OCR·표 인식·이미지 추출을 모두 수행함." },
        { at: "stats = ExportStats()", text: "변환 통계를 담을 카운터 객체를 만듦." },
        { at: "doc = result.document", text: "변환 결과에서 문서 객체를 꺼냄. 이 객체로 항목을 순회함." },
        { at: "stats.page_images = save_page_images(result, images_dir)", text: "페이지 이미지를 저장하고 저장 수를 통계에 기록함." },
        { at: "markdown = export_filtered_markdown(doc, images_dir, stats)", text: "문서 전체를 마크다운으로 변환함(헤더·푸터 제외)." },
        { at: "write_clean_markdown(output_path, markdown)", text: "변환된 마크다운을 UTF-8 파일로 저장함." },
      ],
      code:
`def convert_pdf_to_markdown(input_path: Path, output_path: Path, images_dir: Path) -> ExportStats:
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

    return stats`,
    },
    {
      id: "parse_args",
      name: "parse_args()",
      fileId: "main",
      summary: "명령줄 옵션(입력 PDF, 출력 MD, 이미지 디렉터리)을 파싱하여 반환함.",
      how: "argparse는 'python pdf2md.py --input 파일.pdf' 같은 명령줄 입력을 처리하는 표준 파이썬 도구임. 각 옵션의 타입·기본값·도움말을 정의한 뒤 parse_args()로 실제 입력을 해석함.",
      terms: ["argparse", "Path(__file__).resolve().parent", "타입 힌트"],
      lines: [
        { at: "parser = argparse.ArgumentParser(description=\"Docling PDF to Markdown converter\")", text: "argparse 파서를 만듦. 명령줄 옵션을 정의·해석하는 표준 도구임." },
        { at: '"--input"', text: "--input 옵션 정의: 변환할 PDF 파일 경로(생략하면 기본값 사용)." },
        { at: '"--output"', text: "--output 옵션 정의: 마크다운 출력 경로(기본값 result.md)." },
        { at: '"--images-dir"', text: "--images-dir 옵션 정의: 이미지 저장 디렉터리(기본값 images/)." },
        { at: "return parser.parse_args()", text: "실제 명령줄을 해석해, 옵션 값들을 담은 객체를 돌려줌." },
      ],
      code:
`def parse_args() -> argparse.Namespace:
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
    return parser.parse_args()`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "변환 워크플로우를 실행하고 종료 코드를 반환함. 성공 시 0, 오류 발생 시 1을 반환함.",
      how: "프로그램의 '지휘자'임. 명령줄 옵션을 읽고, 경로를 절대경로로 확정한 뒤, convert_pdf_to_markdown()을 호출해 변환을 실행함. 전체를 try/except로 감싸 어떤 오류가 나도 메시지를 출력하고 실패(1)로 끝냄.",
      terms: ["예외 처리(try/except)", "sys.stderr", "raise SystemExit", "if __name__"],
      lines: [
        { at: "args = parse_args()", text: "먼저 명령줄 옵션을 읽음." },
        { at: "input_path = args.input.expanduser().resolve()", text: "~ 같은 단축 경로를 펴고(expanduser) 절대경로로 확정함(resolve). 어디서 실행해도 경로가 올바름." },
        { at: "stats = convert_pdf_to_markdown(input_path, output_path, images_dir)", text: "★핵심★ 변환 함수를 호출해 PDF → 마크다운+이미지로 변환하고 통계를 받음." },
        { at: "except Exception as exc:", text: "변환 도중 어떤 오류가 나도 메시지를 stderr에 출력하고 종료 코드 1을 반환함." },
        { at: 'print(f"[OK] Markdown 저장: {output_path}")', text: "성공하면 결과 파일 위치와 통계를 출력함." },
      ],
      code:
`def main() -> int:
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
    raise SystemExit(main())`,
    },
  ],

  glossary: {
    "from __future__ import annotations": "타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함. 파이썬 3.10 미만에서도 최신 타입 힌트 문법(str | None 등)을 쓸 수 있게 해주는 선언.",
    "Path(__file__).resolve().parent": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .resolve().parent를 붙이면 이 파일이 든 폴더의 절대경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "@dataclass": "데이터를 담는 클래스를 짧게 만들어주는 파이썬 데코레이터. 필드 선언만 하면 __init__·__repr__ 등을 자동으로 만들어 줌.",
    "set(집합)": "{ }로 묶은 '중복 없는 값들의 모음'. 'x in 집합'으로 포함 여부를 매우 빠르게 확인할 수 있어, 라벨 필터링·참조 키 중복 방지에 사용함.",
    "os.environ.setdefault": "환경변수가 아직 없을 때만 기본값을 설정하는 함수. 이미 설정된 경우에는 덮어쓰지 않음.",
    "DocumentConverter": "Docling 라이브러리의 핵심 클래스. PDF를 입력받아 OCR·표·이미지·수식 인식을 수행하고 구조화된 문서 객체로 변환함.",
    "OCR": "Optical Character Recognition(광학 문자 인식)의 약자. 이미지나 스캔된 PDF의 글자를 컴퓨터가 읽을 수 있는 텍스트로 변환하는 기술.",
    "EasyOCR": "파이썬 오픈소스 OCR 라이브러리. 한국어·영어를 포함한 80개 이상의 언어를 인식할 수 있음. Docling이 PDF 내 이미지 글자 인식에 사용함.",
    "TableFormer": "Docling이 PDF 표 구조를 인식하는 AI 모델. ACCURATE 모드는 복잡한 표도 정밀하게 인식함(속도 대비 정확도 우선).",
    "AcceleratorDevice": "Docling이 연산에 사용할 하드웨어 장치를 지정하는 설정. AUTO는 사용 가능한 최적 장치(GPU/CPU)를 자동으로 선택함.",
    "PdfPipelineOptions": "Docling PDF 변환 파이프라인의 세부 설정을 담는 객체. OCR·표·이미지·수식 처리 여부와 방법을 여기서 지정함.",
    "InputFormat": "Docling이 지원하는 입력 파일 형식을 나타내는 열거형(enum). InputFormat.PDF는 PDF 형식을 의미함.",
    "DocItemLabel": "Docling이 문서 항목에 붙이는 분류 라벨. TITLE·SECTION_HEADER·TABLE·PICTURE·FORMULA 등 항목 종류를 나타냄.",
    "iterate_items": "Docling 문서 객체의 메서드. 문서의 모든 항목을 (항목, 깊이) 쌍으로 순서대로 꺼내줌.",
    "CUDA": "NVIDIA GPU에서 병렬 연산을 수행하는 기술. PyTorch와 함께 써서 딥러닝 모델을 CPU보다 훨씬 빠르게 실행할 수 있음.",
    "MPS": "Metal Performance Shaders의 약자. Apple Silicon(M1/M2/M3) Mac에서 GPU 가속을 사용하는 기술.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "타입 힌트": "변수·함수에 자료의 종류(str, Path, list 등)를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "리스트 컴프리헨션": "[표현식 for 항목 in 목록 if 조건] 형태로, 반복문을 한 줄로 짧게 써서 새 목록을 만드는 파이썬 문법.",
    "importlib.util.find_spec": "패키지를 실제로 import하지 않고 설치 여부만 조용히 확인하는 함수. 없으면 None을 반환함.",
    "RuntimeError": "'실행 중 문제가 생겼다'고 알리는 오류의 한 종류. 필수 패키지가 없거나 API 키가 없을 때 일부러 발생시켜 원인을 알려줌.",
    "FileNotFoundError": "찾는 파일이 없을 때 나는 오류. 여기서는 입력 PDF가 없을 때 분명히 알려주려고 일부러 발생시킴.",
    "getattr()": "객체에서 속성을 안전하게 꺼내는 함수. 속성이 없으면 오류 대신 기본값을 반환함. 예: getattr(obj, 'name', None).",
    "hasattr()": "객체에 특정 속성·메서드가 있는지 True/False로 확인하는 함수. 버전 호환성 처리에 유용함.",
    "isinstance()": "어떤 값이 특정 종류(타입)인지 확인하는 함수. 예: isinstance(pages, dict)는 'pages가 딕셔너리인가?'를 True/False로 답함.",
    "enumerate()": "목록을 돌면서 '번호와 값'을 함께 꺼내 주는 함수. start=1을 주면 1번부터 셈.",
    ".lower()": "문자열을 모두 소문자로 바꾸는 메서드. 대소문자 구분 없이 비교할 때 씀.",
    "any()": "iterable(목록 등)의 원소 중 하나라도 True이면 True를 반환하는 함수. '하나라도 해당되면'을 간결하게 표현함.",
    "정규식(re)": "특정 패턴을 가진 문자열을 찾거나 바꾸는 강력한 도구. re.sub(패턴, 교체값, 대상)으로 패턴에 맞는 부분을 한꺼번에 바꿀 수 있음.",
    "shutil.rmtree": "폴더와 그 안의 모든 파일·하위 폴더를 한꺼번에 삭제하는 함수. 폴더 통째로 지울 때 씀.",
    "mkdir": "폴더를 만드는 명령. parents=True는 중간 폴더까지, exist_ok=True는 이미 있어도 오류 없이 넘어가게 함.",
    "write_text": "문자열을 파일에 통째로 쓰는 Path의 기능. encoding='utf-8'로 한글이 깨지지 않게 저장함.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"이름\": \"값\"} 형태로 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    ".get()": "딕셔너리에서 값을 '안전하게' 꺼내는 방법. 열쇠가 없어도 오류를 내지 않고 정해둔 기본값을 돌려줌.",
    "리스트(list)": "여러 값을 순서대로 담는 목록. ['a', 'b'] 처럼 대괄호로 표현함.",
    "f-string": "문자열 앞에 f를 붙이고 f'안녕 {이름}'처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
    "argparse": "'python 파일.py --옵션 값' 형태의 명령줄 입력을 정의하고 해석해 주는 파이썬 표준 도구.",
    "sys.stderr": "오류 메시지를 내보내는 통로(표준 에러). 일반 출력(stdout)과 구분해 오류만 따로 보낼 수 있음.",
    "raise SystemExit": "프로그램을 끝내면서 종료 코드를 운영체제에 알림. main()의 반환값(0=성공, 1=실패)을 종료 코드로 씀.",
    "if __name__": "if __name__ == '__main__': 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
    "ExportStats": "PDF 변환 결과의 페이지·이미지·표·수식·코드 수를 항목별로 세는 카운터 클래스. @dataclass로 간단하게 만들어짐.",
  },
};
