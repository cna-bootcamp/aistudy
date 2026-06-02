"""로깅 설정 모듈

프로젝트 전반에서 일관된 로그 포맷을 제공하는 유틸리티임.
"""
import logging
import sys


def get_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """일관된 포맷의 로거 인스턴스를 생성함.

    중복 핸들러 방지를 위해 핸들러가 없을 때만 추가함.

    Args:
        name: 로거 이름 (보통 모듈명 사용)
        level: 로깅 레벨 (DEBUG/INFO/WARNING/ERROR/CRITICAL)

    Returns:
        설정된 로거 인스턴스
    """
    # 지정된 이름으로 로거를 가져옴 (없으면 새로 생성)
    logger = logging.getLogger(name)

    # 핸들러가 이미 있으면 중복 추가를 방지함
    if not logger.handlers:
        logger.setLevel(level)

        # 콘솔 핸들러: 표준 출력으로 로그를 내보냄
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(level)

        # 로그 메시지 형식: "2026-06-01 12:34:56 - name - INFO - 메시지"
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    return logger
