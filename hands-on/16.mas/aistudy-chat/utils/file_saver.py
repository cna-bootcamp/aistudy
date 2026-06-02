"""코드 파일 저장 유틸리티

Code Agent가 생성한 Python 코드를 output/ 디렉터리에 타임스탬프 파일명으로 저장함.
파일명은 요청에서 영문 슬러그를 추출해 구성하며(LLM 미사용), 추출 실패 시 기본값을 사용함.
"""
from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from config.settings import settings
from utils.logger import get_logger

logger = get_logger("utils.file_saver")


def _slug_from_request(request: str) -> str:
    """요청 문자열에서 영문 snake_case 슬러그를 추출함 (없으면 기본값)."""
    # 영문 단어만 추출하여 최대 3개를 밑줄로 연결
    words = re.findall(r"[A-Za-z]+", request.lower())
    slug = "_".join(words[:3])
    return slug if len(slug) >= 3 else "generated_code"


def save_code_to_file(code: str, request: Optional[str] = None, output_dir: Optional[Path] = None) -> tuple[bool, str]:
    """생성된 코드를 파일로 저장하고 (성공여부, 경로)를 반환함."""
    output_dir = output_dir or settings.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{_slug_from_request(request or 'code')}_{timestamp}.py"
    file_path = output_dir / filename
    try:
        # with 블록을 벗어나면 파일이 자동으로 닫힘
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
        logger.info(f"[FileSaver] 코드 저장: {file_path}")
        return True, str(file_path)
    except Exception as e:
        logger.error(f"코드 저장 실패: {e}")
        return False, f"파일 저장 실패: {e}"
