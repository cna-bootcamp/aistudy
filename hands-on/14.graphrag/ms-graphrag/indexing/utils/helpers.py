"""헬퍼 함수 모듈 (디렉터리 생성 등 공통 유틸)."""
from pathlib import Path


def ensure_dir(path: Path) -> Path:
    """디렉터리를 생성함 (없을 때만).

    Args:
        path: 생성할 디렉터리 경로

    Returns:
        생성된(또는 기존) 디렉터리 경로
    """
    # parents=True: 상위 디렉터리도 자동 생성, exist_ok=True: 이미 있으면 무시
    path.mkdir(parents=True, exist_ok=True)
    return path
