"""데이터소스별 분리 로더 모듈

인덱싱 전략(교재와 예제코드를 다르게 취급):
- 교재(agentic-ai/textbook/*.md)  → KG + Vector 인덱싱 (개념·기술 간 관계가 풍부)
- 예제코드(hands-on/**/*.py)       → Vector 인덱싱만 (절차적 특성상 엔티티 추출 효용 낮음)

로드 API:
- load_for_kg()       : 교재만 → LLMGraphTransformer 입력 (KG 구축)
- load_for_vector()   : 교재 + 예제코드 → Neo4jVector.from_documents 입력 (doc_embedding)
- load_specific_files(): 지정 파일만 로드 (--mode test)
"""
import logging
import os
from pathlib import Path

# Document: LangChain 표준 문서 객체 (page_content + metadata). KGBuilder·Neo4jVector가 공통으로 소비함
from langchain_core.documents import Document
# RecursiveCharacterTextSplitter: 문단·문장 경계를 우선해 의미 단위로 텍스트를 분할하는 청커
from langchain_text_splitters import RecursiveCharacterTextSplitter

from config.settings import Settings

logger = logging.getLogger(__name__)

# 예제코드 스캔 시 건너뛸 디렉터리 (가상환경·캐시는 외부 라이브러리 코드라 인덱싱 노이즈가 됨)
_EXCLUDE_DIR_PARTS = {"venv", ".venv", "__pycache__", "node_modules", ".git"}


class DocumentLoader:
    """교재/예제코드를 LangChain Document로 로드·청킹하는 분리 로더"""

    def __init__(self, settings: Settings):
        self.settings = settings
        # chunk_size: 청크 최대 문자 수, chunk_overlap: 인접 청크 간 중복 문자 수(문맥 연속성 유지)
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )

    # ===== 전체 모드 로더 =====

    def load_for_kg(self) -> list[Document]:
        """KG 인덱싱 대상: 교재(마크다운)만 로드

        교재는 "RAG는 LLM의 한계를 보완"처럼 개념 간 관계 서술이 풍부해
        LLMGraphTransformer로 엔티티(개념)·관계를 추출하면 멀티홉 추론용 지식 그래프를 만들 수 있음.
        """
        if not self.settings.textbook_dir.exists():
            logger.warning("교재 디렉토리 없음: %s", self.settings.textbook_dir)
            return []
        docs = self._load_markdown(self.settings.textbook_dir, "교재")
        logger.info("KG 인덱싱용 교재 문서 %d개 청크 로드", len(docs))
        return docs

    def load_for_vector(self) -> list[Document]:
        """Vector 인덱싱 대상: 교재 청크 + 예제코드

        doc_embedding 인덱스(Neo4jVector.from_documents)에 들어갈 원문 청크임.
        - 교재 청크: "개념 설명" 검색에 사용 (KG 엔티티 검색과 별개로 원문 단위 검색 보강)
        - 예제코드: "X 구현 예제" 질문에 코드 텍스트 임베딩으로 직접 매칭 (KG 미구축)
        """
        docs: list[Document] = []
        if self.settings.textbook_dir.exists():
            docs.extend(self._load_markdown(self.settings.textbook_dir, "교재"))
        else:
            logger.warning("교재 디렉토리 없음: %s", self.settings.textbook_dir)

        if self.settings.examples_dir.exists():
            docs.extend(self._load_python(self.settings.examples_dir, "예제코드"))
        else:
            logger.warning("예제코드 디렉토리 없음: %s", self.settings.examples_dir)

        logger.info("Vector 인덱싱용 문서 %d개 청크 로드 (교재 청크 + 예제코드)", len(docs))
        return docs

    # ===== 테스트 모드 로더 =====

    def load_specific_files(
        self,
        textbook_files: list[Path],
        code_files: list[Path],
    ) -> tuple[list[Document], list[Document]]:
        """지정된 파일만 로드 (--mode test)

        전체 모드와 동일한 분리 전략을 소량으로 재현함:
        - kg_docs     = 교재 파일 청크 (KG 구축용)
        - vector_docs = 교재 파일 청크 + 예제코드 파일 청크 (doc_embedding용)
        즉 교재는 KG와 doc_embedding 양쪽에 동일하게 들어감.
        """
        textbook_docs: list[Document] = []
        for f in textbook_files:
            if f.exists():
                textbook_docs.extend(self._load_single_file(f, "교재"))
            else:
                logger.warning("교재 파일 없음: %s", f)

        code_docs: list[Document] = []
        for f in code_files:
            if f.exists():
                code_docs.extend(self._load_single_file(f, "예제코드"))
            else:
                logger.warning("예제코드 파일 없음: %s", f)

        kg_docs = textbook_docs
        vector_docs = textbook_docs + code_docs
        logger.info(
            "테스트 모드 로드: KG %d청크 / Vector %d청크(교재 %d + 코드 %d)",
            len(kg_docs), len(vector_docs), len(textbook_docs), len(code_docs),
        )
        return kg_docs, vector_docs

    # ===== 내부 헬퍼 =====

    def _load_markdown(self, dir_path: Path, source_type: str) -> list[Document]:
        """디렉터리 하위 모든 .md 파일을 로드·청킹함"""
        docs: list[Document] = []
        # rglob("*.md"): 하위 디렉터리까지 재귀 탐색하여 모든 마크다운 수집
        md_files = sorted(dir_path.rglob("*.md"))
        logger.info("[%s] 마크다운 %d개 발견: %s", source_type, len(md_files), dir_path)
        for md_file in md_files:
            docs.extend(self._load_single_file(md_file, source_type))
        return docs

    def _load_python(self, dir_path: Path, source_type: str) -> list[Document]:
        """디렉터리 하위 모든 .py 파일을 로드·청킹함 (가상환경·캐시 디렉터리는 탐색 자체를 생략)"""
        # os.walk + dirs[:] in-place 가지치기: rglob과 달리 제외 디렉터리로 '내려가지 않음'.
        # 예제마다 있는 venv(수천 파일)를 통째로 건너뛰어 전체 모드 파일 열거 속도를 크게 높임.
        py_files: list[Path] = []
        for root, dirs, files in os.walk(dir_path):
            dirs[:] = [d for d in dirs if d not in _EXCLUDE_DIR_PARTS]  # 하위 탐색에서 제외 디렉터리 제거
            for name in files:
                if name.endswith(".py"):
                    py_files.append(Path(root) / name)
        py_files.sort()
        logger.info("[%s] Python %d개 발견: %s", source_type, len(py_files), dir_path)
        docs: list[Document] = []
        for py_file in py_files:
            docs.extend(self._load_single_file(py_file, source_type))
        return docs

    def _load_single_file(self, file_path: Path, source_type: str) -> list[Document]:
        """단일 파일을 읽어 청크 단위 Document 리스트로 변환함"""
        try:
            content = file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            # 일부 파일은 cp949 등 다른 인코딩일 수 있어 폴백 (에러 무시하고 utf-8로 읽음)
            content = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception as e:
            logger.warning("파일 로드 실패 %s: %s", file_path.name, e)
            return []

        if not content.strip():
            return []

        chunks = self.splitter.split_text(content)
        # metadata 구조: source(파일명, 출처 추적) / source_type(교재·예제코드 분류) / chunk_index(원본 내 순서)
        return [
            Document(
                page_content=chunk,
                metadata={
                    "source": file_path.name,
                    "source_type": source_type,
                    "chunk_index": i,
                },
            )
            for i, chunk in enumerate(chunks)
        ]
