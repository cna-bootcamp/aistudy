"""데이터소스별 분리 로더 모듈 (LightRAG)

인덱싱 전략(교재와 예제코드를 다르게 취급):
- 교재(agentic-ai/textbook/*.md) → LightRAG insert (KG + 교재 벡터). 개념·기술 간 관계가 풍부
- 예제코드(hands-on/**/*.py)      → 별도 nano-vectordb (Vector만, KG 미생성). 절차적 특성상 유사도 검색이 적합

반환 형식은 LangChain Document가 아닌 단순 dict임. 인덱싱 단계가 본문과 파일 경로만 필요로 하므로
의존성을 줄이고 직관성을 높임:
  {"file_path": str, "content": str, "doc_type": "textbook"|"code"}
"""
import logging
import os
from pathlib import Path

from config.settings import Settings

logger = logging.getLogger(__name__)

# 예제코드 스캔 시 건너뛸 디렉터리 (가상환경·캐시·산출물은 인덱싱 노이즈가 됨)
_EXCLUDE_DIR_PARTS = {"venv", ".venv", "__pycache__", "node_modules", ".git", "explain", ".omc", "store"}


class DocumentLoader:
    """교재/예제코드를 데이터소스별로 분리 로드하는 로더 (dict 반환)."""

    def __init__(self, settings: Settings):
        self.settings = settings

    # ===== 전체 모드 로더 =====

    def load_for_kg(self) -> list[dict]:
        """KG 인덱싱 대상: 교재(.md)만 로드 → LightRAG insert()로 KG+Vector 구축."""
        if not self.settings.textbook_dir.exists():
            logger.warning("교재 디렉터리 없음: %s", self.settings.textbook_dir)
            return []
        # rglob("*.md"): 하위 디렉터리까지 재귀 탐색하여 모든 마크다운 수집
        files = sorted(self.settings.textbook_dir.rglob("*.md"))
        docs = self._read_files(files, "textbook")
        logger.info("교재 로드 완료: %d개 파일", len(docs))
        return docs

    def load_for_vector(self) -> list[dict]:
        """Vector 인덱싱 대상: 예제코드(.py)만 로드 → 별도 nano-vectordb 구축 (KG 미생성).

        교재와 달리 코드는 LightRAG insert()를 거치지 않고 코드 벡터 인덱스에만 저장함.
        """
        if not self.settings.examples_dir.exists():
            logger.warning("예제코드 디렉터리 없음: %s", self.settings.examples_dir)
            return []
        files = self._collect_code_files()
        docs = self._read_files(files, "code")
        logger.info("예제코드 로드 완료: %d개 파일", len(docs))
        return docs

    # ===== 테스트 모드 로더 =====

    def load_specific_files(self) -> tuple[list[dict], list[dict]]:
        """테스트 모드: 지정된 교재 1 + 예제코드 2만 로드 (소량 검증용).

        지정한 코드 파일 경로가 존재하지 않으면(예: 한글 폴더명의 NFC/NFD 유니코드 정규화 차이로
        하드코딩 경로가 매칭 안 되는 경우) 실제 디렉터리 스캔 결과에서 2개를 보충해 견고성을 확보함.
        반환: (kg_docs, code_docs)
        """
        kg_docs = self._read_files(self.settings.test_textbook_files, "textbook")

        # 지정된 코드 파일 중 실제 존재하는 것만 우선 사용
        code_files = [Path(f) for f in self.settings.test_code_files if Path(f).exists()]
        if len(code_files) < 2:
            # 부족하면 실제 스캔 결과(rglob로 파일시스템이 알려준 정규화된 경로)에서 보충
            for f in self._collect_code_files():
                if f not in code_files:
                    code_files.append(f)
                if len(code_files) >= 2:
                    break
        code_docs = self._read_files(code_files[:2], "code")
        logger.info("테스트 로드 완료: 교재 %d, 예제코드 %d", len(kg_docs), len(code_docs))
        return kg_docs, code_docs

    # ===== 내부 헬퍼 =====

    def _collect_code_files(self) -> list[Path]:
        """examples 디렉터리를 순회하며 제외 폴더를 건너뛰고 .py 파일만 수집."""
        # os.walk + dirs[:] in-place 가지치기: venv 하위의 .py 파일은 열거 단계부터 제외함.
        files: list[Path] = []
        for root, dirs, filenames in os.walk(self.settings.examples_dir):
            dirs[:] = [d for d in dirs if d not in _EXCLUDE_DIR_PARTS]
            for name in filenames:
                if name.endswith(".py"):
                    files.append(Path(root) / name)
        return sorted(files)

    def _read_files(self, files, doc_type: str) -> list[dict]:
        """파일 목록을 읽어 dict 리스트로 변환. 읽기 실패·빈 파일은 WARNING 후 스킵."""
        docs: list[dict] = []
        for path in files:
            path = Path(path)
            if not path.exists():
                logger.warning("파일 없음, 스킵: %s", path)
                continue
            try:
                # encoding="utf-8": 한글 문서가 OS 기본 인코딩 차이로 깨지는 것을 방지함
                content = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                # 일부 파일은 cp949 등 다른 인코딩일 수 있어 폴백 (에러 무시하고 utf-8로 읽음)
                content = path.read_text(encoding="utf-8", errors="ignore")
            except Exception as exc:  # noqa: BLE001 - 학습 예제에서는 모든 읽기 오류를 스킵 처리
                logger.warning("파일 읽기 실패, 스킵: %s (%s)", path, exc)
                continue
            if not content.strip():
                logger.warning("빈 파일, 스킵: %s", path)
                continue
            docs.append({"file_path": str(path), "content": content, "doc_type": doc_type})
        return docs
