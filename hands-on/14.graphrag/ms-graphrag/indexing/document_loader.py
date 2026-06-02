"""GraphRAG 문서 로더

데이터소스별 청킹 전략을 분리하여 적용함.
  - 교재(*.md):    마크다운 헤더 기반 섹션 분할 + 작은 섹션(500자 미만) 병합
  - 예제코드(*.py): AST(Abstract Syntax Tree) 기반 함수/클래스 단위 청킹

교재는 GraphRAG 파이프라인(KG + Vector) 입력으로, 예제코드는 별도 벡터 인덱스로 사용됨.
GraphRAG input 디렉터리(data/input)로 .txt 내보내기를 지원함.
"""
import ast                                      # 파이썬 소스를 AST로 파싱하기 위한 표준 모듈
import os
import re
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

from tqdm import tqdm                           # 터미널 진행바 라이브러리

# config 패키지를 import할 수 있도록 indexing 디렉터리를 경로에 추가
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))  # 파이썬 모듈 검색 경로 맨 앞에 indexing/ 추가
from config.settings import settings


@dataclass
class GraphRAGDocument:
    """GraphRAG용 문서 데이터 클래스 (청크 1개 = 문서 1개)."""
    content: str
    metadata: dict = field(default_factory=dict)

    def __post_init__(self):
        # 메타데이터 기본 키를 채워 누락 시 KeyError를 방지함
        defaults = {
            "source": "",
            "source_type": "",
            "filename": "",
            "chunk_index": 0,
            "section_title": "",
        }
        for key, value in defaults.items():
            if key not in self.metadata:
                self.metadata[key] = value

    def to_text(self) -> str:
        """GraphRAG 입력 형식 텍스트로 변환함 (메타데이터 헤더 + 본문).

        GraphRAG가 출처를 구분할 수 있도록 헤더에 출처 유형·파일명·섹션 정보를 넣음.

        Returns:
            메타데이터 헤더 + 본문 내용
        """
        header_lines = [
            f"[Source: {self.metadata['source_type']}]",  # 출처 유형 (교재/예제코드)
            f"[File: {self.metadata['filename']}]",        # 원본 파일명
        ]
        # 섹션 정보가 있으면 추가 (마크다운 헤더 또는 파이썬 함수/클래스명)
        if self.metadata.get("section_title"):
            header_lines.append(f"[Section: {self.metadata['section_title']}]")
        header = "\n".join(header_lines)
        return f"{header}\n\n{self.content}"

    def get_output_filename(self) -> str:
        """출력 txt 파일명을 생성함: {source_type}_{filename}_{chunk_index}.txt

        예: "교재_14_GraphRAG_0001.txt"

        Returns:
            생성된 파일명 문자열
        """
        source_type = self.metadata["source_type"].replace("/", "_").replace(" ", "_")
        filename = Path(self.metadata["filename"]).stem  # 확장자 제거
        # 특수문자 제거 (한글·영문·숫자·하이픈·언더스코어만 허용)
        filename = re.sub(r"[^\w가-힣\-_]", "_", filename)
        chunk_index = self.metadata["chunk_index"]
        # 4자리 숫자로 청크 인덱스를 0 패딩함
        return f"{source_type}_{filename}_{chunk_index:04d}.txt"


class GraphRAGDocumentLoader:
    """교재(md)·예제코드(py)를 GraphRAGDocument로 변환하는 로더."""

    # 예제코드 탐색 시 제외할 디렉터리 (가상환경·캐시·산출물 등 노이즈 제거)
    EXCLUDE_DIRS = [
        "venv", ".venv", "__pycache__", ".git", "node_modules",
        "build", "dist", ".omc", ".pytest_cache", "explain", "explain-exam",
        "14.graphrag",  # 본 프로젝트 자신을 인덱싱 대상에서 제외 (자기참조 방지)
    ]

    def __init__(
        self,
        textbook_dir: Optional[Path] = None,
        code_dir: Optional[Path] = None,
        chunk_size: int = 1200,
        chunk_overlap: int = 100,
    ):
        # 데이터소스 경로 (기본값은 settings에서 가져옴)
        self.textbook_dir = textbook_dir or settings.textbook_dir
        self.code_dir = code_dir or settings.code_dir
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        # 마크다운 헤더(#, ##, ###, ####) 매칭 정규식
        self.header_pattern = re.compile(r"^(#{1,4})\s+(.+)$", re.MULTILINE)

    # ---------------------------------------------------------------------
    # 파일 로드
    # ---------------------------------------------------------------------
    def load_file(self, file_path: Path) -> str:
        """여러 인코딩을 시도하여 파일을 읽음 (한글 파일 대비).

        Args:
            file_path: 읽을 파일 경로

        Returns:
            파일 내용 문자열
        """
        for encoding in ("utf-8", "cp949", "euc-kr", "latin-1"):
            try:
                with open(file_path, "r", encoding=encoding) as f:
                    return f.read()
            except UnicodeDecodeError:
                continue
        # 폴백: 디코드 오류를 무시하고 utf-8로 읽음
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

    # ---------------------------------------------------------------------
    # 마크다운(교재) 청킹: 헤더 기반 섹션 분할 + 작은 섹션 병합
    # ---------------------------------------------------------------------
    def extract_sections(self, text: str) -> list[tuple[str, str, int]]:
        """마크다운을 헤더 기준으로 섹션 분할함.

        Args:
            text: 마크다운 텍스트

        Returns:
            [(섹션제목, 내용, 헤더레벨), ...] 리스트
        """
        sections = []
        current_title = ""      # 현재 섹션 제목
        current_level = 0       # 헤더 레벨 (1~4)
        current_content = []    # 현재 섹션 내용 줄 모음

        for line in text.split("\n"):
            match = self.header_pattern.match(line)
            if match:
                # 이전 섹션을 먼저 저장
                if current_content or current_title:
                    content = "\n".join(current_content).strip()
                    if content or current_title:
                        sections.append((current_title, content, current_level))
                # 새 섹션 시작
                current_level = len(match.group(1))      # # 개수 = 헤더 레벨
                current_title = match.group(2).strip()   # 제목 텍스트
                current_content = []
            else:
                current_content.append(line)

        # 마지막 섹션 저장
        if current_content or current_title:
            content = "\n".join(current_content).strip()
            sections.append((current_title, content, current_level))
        return sections

    def split_section(self, title: str, content: str) -> list[tuple[str, str]]:
        """하나의 섹션을 chunk_size 이하 청크로 분할함.

        Returns:
            [(섹션제목, 청크내용), ...]
        """
        if not content:
            return []

        prefix = f"[{title}] " if title else ""
        chunks = []
        max_content_size = max(self.chunk_size - len(prefix), 100)

        # 문단(\n\n) 단위로 모아 청크를 구성함
        paragraphs = re.split(r"\n\n+", content)
        current_chunk = ""
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            if len(current_chunk) + len(para) + 2 <= max_content_size:
                current_chunk = current_chunk + "\n\n" + para if current_chunk else para
            else:
                if current_chunk:
                    chunks.append((title, prefix + current_chunk))
                # 한 문단이 청크 크기를 초과하면 단어 단위로 재분할
                if len(para) > max_content_size:
                    current_chunk = ""
                    for word in para.split():
                        if len(current_chunk) + len(word) + 1 <= max_content_size:
                            current_chunk = current_chunk + " " + word if current_chunk else word
                        else:
                            if current_chunk:
                                chunks.append((title, prefix + current_chunk))
                            current_chunk = word
                else:
                    current_chunk = para

        if current_chunk:
            chunks.append((title, prefix + current_chunk))
        return chunks

    def split_text_by_sections(self, text: str) -> list[tuple[str, str]]:
        """마크다운을 섹션 분할 후 작은 섹션(500자 미만)을 병합하여 청킹함.

        Returns:
            [(섹션제목, 청크내용), ...]
        """
        sections = self.extract_sections(text)

        merged_sections = []
        current_title = ""
        current_content = ""
        MIN_SECTION_SIZE = 500  # 이보다 작은 섹션은 다음 섹션과 병합

        for title, content, _ in sections:
            if not current_content:
                current_title = title
                current_content = content
                continue
            # 누적 내용이 작고 합쳐도 청크 크기 이내면 병합
            if len(current_content) < MIN_SECTION_SIZE and len(current_content) + len(content) < self.chunk_size:
                current_content += f"\n\n[{title}]\n{content}" if title else f"\n\n{content}"
                continue
            merged_sections.append((current_title, current_content))
            current_title = title
            current_content = content

        if current_content:
            merged_sections.append((current_title, current_content))

        all_chunks = []
        for title, content in merged_sections:
            all_chunks.extend(self.split_section(title, content))
        # 청크가 하나도 안 나오면 앞부분만이라도 반환
        return all_chunks if all_chunks else [("", text[:self.chunk_size])]

    # ---------------------------------------------------------------------
    # 파이썬(예제코드) 청킹: AST 기반 함수/클래스 단위 분할
    # ---------------------------------------------------------------------
    def split_python_code(self, code: str) -> list[tuple[str, str]]:
        """파이썬 코드를 AST로 파싱하여 함수/클래스 단위로 청킹함.

        Args:
            code: 파이썬 소스코드

        Returns:
            [(함수/클래스명, 코드내용), ...] 리스트
        """
        lines = code.split("\n")
        try:
            tree = ast.parse(code)  # 소스를 추상 구문 트리로 변환
        except SyntaxError:
            # 파싱 실패 시 앞부분을 단일 청크로 반환
            return [("", code[:self.chunk_size])]

        # import 문은 모든 함수/클래스가 참조하므로 별도 청크로 추출
        imports = []
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)) and hasattr(node, "lineno"):
                end_line = getattr(node, "end_lineno", node.lineno)
                imports.append("\n".join(lines[node.lineno - 1:end_line]))
        import_block = "\n".join(imports) if imports else ""

        chunks = []
        # 최상위 함수·클래스만 순회 (중첩 정의는 본문에 포함됨)
        for node in ast.iter_child_nodes(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                end_line = getattr(node, "end_lineno", node.lineno + 10)
                func_code = "\n".join(lines[node.lineno - 1:end_line])
                chunks.append((node.name, f"[def {node.name}]\n{func_code}"))
            elif isinstance(node, ast.ClassDef):
                end_line = getattr(node, "end_lineno", node.lineno + 20)
                class_code = "\n".join(lines[node.lineno - 1:end_line])
                chunks.append((node.name, f"[class {node.name}]\n{class_code}"))

        # import 블록이 의미있는 크기면 맨 앞 청크로 추가
        if import_block and len(import_block) > 50:
            chunks.insert(0, ("imports", f"[imports]\n{import_block}"))

        if not chunks:
            return [("", code[:self.chunk_size])]

        # chunk_size 초과 청크는 overlap을 두고 재분할
        final_chunks = []
        for name, content in chunks:
            if len(content) <= self.chunk_size:
                final_chunks.append((name, content))
            else:
                step = self.chunk_size - self.chunk_overlap
                for i in range(0, len(content), step):
                    final_chunks.append((name, content[i:i + self.chunk_size]))
        return final_chunks

    # ---------------------------------------------------------------------
    # 디렉터리 단위 로드
    # ---------------------------------------------------------------------
    def _collect_files(self, directory: Path, pattern: str) -> list[Path]:
        """제외 디렉터리를 거른 파일 목록을 수집함."""
        files = []
        for root, dirs, filenames in os.walk(directory):
            # venv 같은 제외 디렉터리는 하위 탐색 자체를 생략해 hands-on/**/venv/*.py를 열거하지 않음
            dirs[:] = [d for d in dirs if d not in self.EXCLUDE_DIRS]
            for name in filenames:
                if Path(name).match(pattern):
                    files.append(Path(root) / name)
        return sorted(files)

    def _chunk_file(self, file_path: Path, source_type: str) -> list[GraphRAGDocument]:
        """파일 1개를 읽어 청크 리스트(GraphRAGDocument)로 변환함."""
        content = self.load_file(file_path)
        if file_path.suffix == ".py":
            chunks = self.split_python_code(content)
        else:
            chunks = self.split_text_by_sections(content)

        docs = []
        for i, (section_title, chunk_content) in enumerate(chunks):
            docs.append(GraphRAGDocument(
                content=chunk_content,
                metadata={
                    "source": str(file_path),
                    "source_type": source_type,
                    "filename": file_path.name,
                    "chunk_index": i,
                    "section_title": section_title,
                },
            ))
        return docs

    def load_textbook(self) -> list[GraphRAGDocument]:
        """교재(agentic-ai/textbook/*.md)를 로드함 (KG + Vector 파이프라인 입력).

        Returns:
            GraphRAGDocument 리스트
        """
        print(f"\n=== 교재 로드 시작: {self.textbook_dir} ===")
        if not self.textbook_dir.exists():
            print(f"경고: 교재 디렉터리가 존재하지 않음: {self.textbook_dir}")
            return []
        files = self._collect_files(self.textbook_dir, "*.md")
        documents = []
        pbar = tqdm(files, desc="교재 로드", unit="file", ncols=80)
        for file_path in pbar:
            pbar.set_postfix_str(file_path.name[:20])
            try:
                documents.extend(self._chunk_file(file_path, "교재"))
            except Exception as e:
                pbar.write(f"파일 로드 실패: {file_path} - {e}")
        print(f"교재 청크 수: {len(documents)} ({len(files)}개 파일)")
        return documents

    def load_code(self) -> list[GraphRAGDocument]:
        """예제코드(hands-on/**/*.py)를 로드함 (Vector 전용, KG 미생성).

        Returns:
            GraphRAGDocument 리스트
        """
        print(f"\n=== 예제코드 로드 시작: {self.code_dir} ===")
        if not self.code_dir.exists():
            print(f"경고: 예제코드 디렉터리가 존재하지 않음: {self.code_dir}")
            return []
        files = self._collect_files(self.code_dir, "*.py")
        documents = []
        pbar = tqdm(files, desc="예제코드 로드", unit="file", ncols=80)
        for file_path in pbar:
            pbar.set_postfix_str(file_path.name[:20])
            try:
                documents.extend(self._chunk_file(file_path, "예제코드"))
            except Exception as e:
                pbar.write(f"파일 로드 실패: {file_path} - {e}")
        print(f"예제코드 청크 수: {len(documents)} ({len(files)}개 파일)")
        return documents

    def load_specific_files(self) -> tuple[list[GraphRAGDocument], list[GraphRAGDocument]]:
        """테스트 모드용 소량 파일 로드 (교재 1개 + 예제코드 2개).

        Returns:
            (교재 문서 리스트, 예제코드 문서 리스트) 튜플
        """
        print("\n=== 테스트 모드: 지정된 소량 파일 로드 ===")

        # 교재 1개 (KG 파이프라인 입력)
        textbook_targets = [self.textbook_dir / "14.GraphRAG.md"]
        # 예제코드 2개 (벡터 전용)
        code_targets = [
            self.code_dir / "12.web-youtube-search" / "agentic-rag" / "app.py",
            self.code_dir / "10.rag" / "indexing" / "indexing.py",
        ]

        textbook_docs, code_docs = [], []
        for file_path in textbook_targets:
            resolved = file_path.resolve()
            if not resolved.exists():
                print(f"  [SKIP] 교재 파일 없음: {resolved}")
                continue
            textbook_docs.extend(self._chunk_file(resolved, "교재"))
            print(f"  [OK] 교재: {resolved.name}")

        for file_path in code_targets:
            resolved = file_path.resolve()
            if not resolved.exists():
                print(f"  [SKIP] 예제코드 파일 없음: {resolved}")
                continue
            code_docs.extend(self._chunk_file(resolved, "예제코드"))
            print(f"  [OK] 예제코드: {resolved.name}")

        print(f"테스트 교재 청크: {len(textbook_docs)} / 예제코드 청크: {len(code_docs)}")
        return textbook_docs, code_docs


# 이 파일을 직접 실행하면 로드 동작을 점검함 (import 시 미실행)
if __name__ == "__main__":
    loader = GraphRAGDocumentLoader()
    tb = loader.load_textbook()
    code = loader.load_code()
    print(f"\n총 교재 청크: {len(tb)} / 예제코드 청크: {len(code)}")
