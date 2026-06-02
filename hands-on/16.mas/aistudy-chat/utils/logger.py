"""로깅 유틸리티

파일과 콘솔에 동시에 로그를 남기는 표준 로거를 생성함.
실행마다 새 로그 파일을 만들어 워크플로 추적(Supervisor 진행 추적)을 쉽게 함.
"""
from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import logging
from datetime import datetime

from config.settings import settings

# 프로세스 시작 시각을 한 번만 기록 — Streamlit 재실행 시에도 동일한 타임스탬프 유지
_LOG_TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

# 이미 생성한 로거를 재사용하기 위한 캐시 (중복 핸들러 부착 방지)
_loggers: dict[str, logging.Logger] = {}


def get_logger(name: str) -> logging.Logger:
    """이름별 로거를 반환 — 콘솔과 파일 핸들러를 함께 부착함.

    같은 이름으로 다시 호출하면 캐시된 로거를 반환하여 핸들러가 중복 부착되지 않게 함.
    """
    if name in _loggers:
        return _loggers[name]

    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    logger.propagate = False  # 루트 로거로의 전파를 막아 로그 중복 출력 방지

    # 로그 디렉터리 보장 (없으면 생성)
    settings.logs_dir.mkdir(parents=True, exist_ok=True)
    log_file = settings.logs_dir / f"mas_{_LOG_TIMESTAMP}.log"

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%H:%M:%S",
    )

    # 파일 핸들러: 상세 로그(DEBUG 이상)를 파일에 기록 — UTF-8로 한글 깨짐 방지
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    # 콘솔 핸들러: 진행 상황(INFO 이상)만 화면에 표시
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    _loggers[name] = logger
    return logger
