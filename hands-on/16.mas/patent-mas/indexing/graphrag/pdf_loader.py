#!/usr/bin/env python
"""특허법 PDF → GraphRAG 입력 텍스트 변환기

단일 데이터소스(hands-on/10.rag/data/특허법.pdf)를 GraphRAG가 읽는
data/input/*.txt 로 변환함. 법령 문서 구조(조→항)를 우선 경계로 청킹함.

[처리 흐름]
  1. PyPDFLoader: PDF를 페이지 단위 텍스트로 로드
  2. clean_text:  법제처 머리글, "- N -" 페이지 번호, 반복 법령명 머리글 등 노이즈 제거
  3. RecursiveCharacterTextSplitter(법령 구분자): 조문/항 경계 우선 청킹
  4. filter_chunks: 빈 청크·개정 태그만 담긴 청크 제거
  5. data/input/특허법_NNNN.txt 로 내보내기 (GraphRAG 파이프라인 입력)

사용법:
    python pdf_loader.py             # 전체 PDF를 txt로 변환
    python pdf_loader.py --limit 4   # 앞쪽 4개 청크만 변환 (파이프라인 검증용 슬라이스)
"""
import argparse
import re
import sys
from pathlib import Path

# ── Windows 콘솔 인코딩 설정 ──
# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 UTF-8로 재설정함.
# io.TextIOWrapper 재할당 대신 기존 스트림을 reconfigure하여 출력 리다이렉트 시
# "I/O operation on closed file" 오류를 피함 (Python 3.7+).
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

# 이 파일이 위치한 디렉터리(graphrag/)를 모듈 검색 경로에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent))
from config.settings import settings
from utils.logger import get_logger
from utils.helpers import ensure_dir

logger = get_logger("pdf_loader")

# ---------------------------------------------------------------------------
# 청킹 상수 (법령 문서 특화)
# ---------------------------------------------------------------------------
# KG 추출에 충분한 문맥을 담도록 RAG 검색용(800)보다 큰 청크를 사용함.
# settings.yaml chunking.size(2500 토큰)보다 작으므로 GraphRAG가 추가 분할하지 않음.
CHUNK_SIZE = 1800          # 청크 최대 크기 (문자 수)
CHUNK_OVERLAP = 200        # 청크 간 겹치는 문자 수 (맥락 보존)

# 법령 문서 구조를 우선 보존하기 위한 분할 구분자 (앞쪽 우선순위)
# "\n제"(조문) → "\n①~⑤"(항) → "\n\n"(단락) → "\n"(줄) → " "(어절) → ""(문자)
LAW_SEPARATORS = ["\n제", "\n①", "\n②", "\n③", "\n④", "\n⑤", "\n\n", "\n", " ", ""]

# 국가법령정보센터 PDF는 모든 페이지 상단에 법령명을 머리글로 반복 삽입함 (검색 노이즈)
RUNNING_HEADER = "특허법"

# 청크 본문이 개정 이력 태그·머리글만으로 이루어졌는지 판별하는 정규식
# 예: "[전문개정 2014. 6. 11.]", "[시행 ...] [법률 제21134호]" → 검색 가치가 없어 제거 대상
TAG_ONLY_PATTERN = re.compile(r"^(\[[^\]]*\]\s*)+$")


def clean_text(text: str) -> str:
    """PDF 추출 텍스트에서 머리글·바닥글·페이지 번호 등 노이즈를 제거함.

    PyPDFLoader는 페이지 단위로 텍스트를 추출하므로 법제처 머리글, "- 1 -" 형식의
    페이지 번호 등 검색에 불필요한 반복 텍스트가 섞임. 이를 정규식으로 정리함.

    Args:
        text: PDF 페이지에서 추출한 원본 텍스트

    Returns:
        노이즈를 제거한 정제 텍스트
    """
    # 페이지 번호 패턴 제거: "- 1 -", "1 / 50" 형식
    text = re.sub(r"-\s*\d+\s*-", "", text)
    text = re.sub(r"\d+\s*/\s*\d+", "", text)
    # 머리글·바닥글에 자주 등장하는 키워드가 포함된 줄과 반복 법령명 머리글 줄을 제거함
    lines = text.split("\n")
    noise_keywords = ["법제처", "국가법령정보센터"]
    cleaned_lines = []
    for line in lines:
        # "법제처 ... 국가법령정보센터" 형식의 페이지 머리글/바닥글 줄 제거
        if any(kw in line for kw in noise_keywords):
            continue
        # 줄 전체가 법령명("특허법")뿐인 반복 머리글 줄 제거 (본문 내 인용은 다른 글자와 함께 등장하므로 안전)
        if line.strip() == RUNNING_HEADER:
            continue
        cleaned_lines.append(line)
    text = "\n".join(cleaned_lines)
    # 연속 공백·과도한 빈 줄 정규화
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def load_pdf_text(pdf_path: Path) -> str:
    """특허법 PDF를 로드·정제하여 단일 정제 텍스트로 결합함.

    Args:
        pdf_path: 특허법 PDF 경로

    Returns:
        모든 페이지를 정제·결합한 전체 텍스트
    """
    # PyPDFLoader: PDF를 페이지 단위 Document로 변환하는 LangChain 로더
    from langchain_community.document_loaders import PyPDFLoader

    if not pdf_path.exists():
        raise FileNotFoundError(f"특허법 PDF를 찾을 수 없음: {pdf_path}")

    pages = PyPDFLoader(str(pdf_path)).load()
    logger.info("PDF 로드 완료: %s (%d페이지)", pdf_path.name, len(pages))

    # 페이지별 정제 후 빈 페이지를 제외하고 결합함
    cleaned_pages = [clean_text(p.page_content) for p in pages]
    full_text = "\n\n".join(t for t in cleaned_pages if t)

    if not full_text.strip():
        raise ValueError("PDF에서 텍스트를 추출하지 못함 (스캔 이미지 PDF 가능성)")
    logger.info("정제 후 전체 문자 수: %d", len(full_text))
    return full_text


def split_into_chunks(text: str) -> list[str]:
    """법령 구조를 우선 보존하며 텍스트를 청크로 분할함.

    RecursiveCharacterTextSplitter: separators 목록을 앞에서부터 순서대로 적용하며
    chunk_size 이하가 될 때까지 재귀적으로 분할함. 법령 구조(조→항)를 우선 경계로
    삼아 의미 단위가 끊기지 않게 함.

    Args:
        text: 정제된 전체 텍스트

    Returns:
        노이즈 청크를 제거한 청크 문자열 리스트
    """
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=LAW_SEPARATORS,
    )
    raw_chunks = splitter.split_text(text)

    # 빈 청크 또는 개정 태그만으로 구성된 청크는 검색 가치가 없어 제외함
    chunks, dropped = [], 0
    for chunk in raw_chunks:
        content = chunk.strip()
        if not content or TAG_ONLY_PATTERN.match(content):
            dropped += 1
            continue
        chunks.append(content)
    if dropped:
        logger.info("노이즈 청크 제거: %d개", dropped)
    logger.info("생성된 청크 수: %d", len(chunks))
    return chunks


def to_input_text(chunk: str, index: int) -> str:
    """GraphRAG 입력 형식 텍스트로 변환함 (출처 헤더 + 본문).

    GraphRAG가 출처를 구분할 수 있도록 헤더에 법령명·파일명·청크 번호를 넣음.

    Args:
        chunk: 청크 본문
        index: 청크 인덱스

    Returns:
        메타데이터 헤더 + 본문
    """
    header = "\n".join([
        "[Source: 특허법]",          # 법령명
        "[File: 특허법.pdf]",        # 원본 파일명
        f"[Chunk: {index:04d}]",     # 청크 번호
    ])
    return f"{header}\n\n{chunk}"


def prepare_input(limit: int | None = None) -> int:
    """특허법 PDF를 data/input/*.txt 로 변환함.

    GraphRAG CLI는 input_storage.base_dir(data/input)의 txt 파일만 입력으로 사용함.

    Args:
        limit: 변환할 청크 수 상한 (None이면 전체, 슬라이스 검증 시 소량 지정)

    Returns:
        내보낸 txt 파일 수
    """
    input_dir = ensure_dir(settings.input_dir)

    # 기존 txt를 모두 삭제해 깨끗한 상태에서 시작함 (재실행 멱등성)
    for old_file in input_dir.glob("*.txt"):
        old_file.unlink()

    full_text = load_pdf_text(settings.pdf_path)
    chunks = split_into_chunks(full_text)

    if limit is not None:
        chunks = chunks[:limit]
        logger.info("슬라이스 모드: 앞쪽 %d개 청크만 변환", len(chunks))

    exported = 0
    for i, chunk in enumerate(chunks):
        output_path = input_dir / f"특허법_{i:04d}.txt"
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(to_input_text(chunk, i))
            exported += 1
        except Exception as e:
            logger.warning("내보내기 실패: %s - %s", output_path.name, e)

    logger.info("특허법 txt 내보내기 완료: %d개 → %s", exported, input_dir)
    return exported


def main() -> int:
    parser = argparse.ArgumentParser(description="특허법 PDF → GraphRAG 입력 텍스트 변환")
    parser.add_argument("--limit", type=int, default=None,
                        help="변환할 청크 수 상한 (슬라이스 검증용, 미지정 시 전체)")
    args = parser.parse_args()

    count = prepare_input(limit=args.limit)
    print(f"내보낸 txt 파일 수: {count}")
    return 0 if count > 0 else 1


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    sys.exit(main())
