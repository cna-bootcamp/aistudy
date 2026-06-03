"""특허법 PDF 로더 모듈 (PDF → 전처리 → 법령 구조 기반 청킹)

단일 데이터소스(특허법.pdf)를 로드해 LangChain Document 청크로 변환함.
같은 청크가 KG 구축(LLMGraphTransformer)과 doc_embedding(Neo4jVector) 양쪽에 동일하게 사용됨.

[전처리·청킹은 10.rag/indexing 예제와 동일한 전략을 사용]
- PyPDFLoader로 페이지 단위 로드 → 머리글/바닥글/페이지번호 노이즈 제거
- 법령 구조(조·항)를 우선 보존하는 구분자로 분할해 조문이 청크 중간에서 잘리지 않게 함
"""
import logging
import re
from pathlib import Path

# PyPDFLoader: PDF를 페이지 단위 Document로 변환하는 LangChain 로더 (metadata에 source·page 포함)
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
# RecursiveCharacterTextSplitter: 구분자 우선순위대로 텍스트를 의미 단위로 분할하는 청커
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)

# 법령 문서 구조를 우선 보존하기 위한 분할 구분자 (앞쪽 우선순위)
# "\n제"(조문) → "\n①~⑤"(항) → "\n\n"(단락) → "\n"(줄) → " "(어절) → ""(문자)
_LAW_SEPARATORS = ["\n제", "\n①", "\n②", "\n③", "\n④", "\n⑤", "\n\n", "\n", " ", ""]

# 국가법령정보센터 PDF는 모든 페이지 상단에 법령명을 머리글로 반복 삽입함 (검색 노이즈)
_RUNNING_HEADER = "특허법"


class DocumentLoader:
    """특허법 PDF를 전처리·청킹해 Document 리스트로 반환하는 로더"""

    def __init__(self, settings):
        self.settings = settings
        # separators: 법령 구조 구분자를 우선 적용해 조·항 경계에서 우선 분할함
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            separators=_LAW_SEPARATORS,
        )

    def load(self) -> list[Document]:
        """특허법 PDF를 로드·전처리·청킹해 Document 리스트로 반환함"""
        pdf_path = self.settings.pdf_path
        if not pdf_path.exists():
            raise FileNotFoundError(f"특허법 PDF를 찾을 수 없음: {pdf_path}")

        # PyPDFLoader(...).load(): PDF를 페이지 단위 Document 리스트로 읽어옴
        pages = PyPDFLoader(str(pdf_path)).load()
        logger.info("PDF 로드: %s (%d페이지)", pdf_path.name, len(pages))

        # 페이지별 추출 텍스트를 합치며 머리글/바닥글 노이즈를 제거함
        cleaned_pages = [self._clean_text(page.page_content) for page in pages]
        full_text = "\n".join(part for part in cleaned_pages if part)

        # 스캔 PDF(이미지) 등으로 텍스트가 전혀 추출되지 않은 경우를 조기에 감지함
        if not full_text.strip():
            raise ValueError("PDF에서 텍스트를 추출하지 못함 (스캔 이미지 PDF 가능성)")

        chunks = self.splitter.split_text(full_text)
        # metadata 구조: source(파일명, 출처 추적) / source_type(law 분류) / chunk_index(원본 내 순서)
        documents = [
            Document(
                page_content=chunk,
                metadata={
                    "source": pdf_path.name,
                    "source_type": "law",
                    "chunk_index": i,
                },
            )
            for i, chunk in enumerate(chunks)
        ]
        logger.info("청킹 완료: %d개 청크 (chunk_size=%d, overlap=%d)",
                    len(documents), self.settings.chunk_size, self.settings.chunk_overlap)
        return documents

    def load_specific(self, max_chunks: int) -> list[Document]:
        """앞쪽 max_chunks개 청크만 로드함 (--mode test 소량 인덱싱용)"""
        documents = self.load()
        sliced = documents[:max_chunks]
        logger.info("테스트 모드: 앞 %d개 청크만 사용 (전체 %d개 중)", len(sliced), len(documents))
        return sliced

    @staticmethod
    def _clean_text(text: str) -> str:
        """PDF 추출 텍스트에서 머리글·바닥글·페이지 번호 등 노이즈를 제거함

        법제처 PDF는 페이지마다 법령명 머리글, "- 1 -" 형식 페이지 번호, "법제처/국가법령정보센터"
        바닥글이 반복 삽입되어 검색·추출 노이즈가 됨. 이를 정규식으로 정리함.
        """
        # 페이지 번호 패턴 제거: "- 1 -", "1 / 50" 형식
        text = re.sub(r"-\s*\d+\s*-", "", text)
        text = re.sub(r"\d+\s*/\s*\d+", "", text)
        lines = text.split("\n")
        noise_keywords = ["법제처", "국가법령정보센터"]
        cleaned_lines = []
        for line in lines:
            # "법제처 ... 국가법령정보센터" 형식의 페이지 머리글/바닥글 줄 제거
            if any(kw in line for kw in noise_keywords):
                continue
            # 줄 전체가 법령명("특허법")뿐인 반복 머리글 줄 제거 (본문 내 인용은 다른 글자와 함께 등장하므로 안전)
            if line.strip() == _RUNNING_HEADER:
                continue
            cleaned_lines.append(line)
        text = "\n".join(cleaned_lines)
        # 연속 공백·과도한 빈 줄 정규화
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()
