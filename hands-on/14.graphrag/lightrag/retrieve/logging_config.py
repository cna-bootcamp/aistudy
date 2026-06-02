"""검색 예제 공통 로깅 설정."""
import logging
from pathlib import Path
import sys

from config.settings import Settings


_RETRIEVE_HANDLER_ATTR = "_retrieve_log_handler"


def _is_same_log_file(handler: logging.Handler, log_file: Path) -> bool:
    """기존 FileHandler가 현재 검색 로그 파일을 가리키는지 확인."""
    base_filename = getattr(handler, "baseFilename", None)
    if not base_filename:
        return False
    return Path(base_filename).resolve() == log_file.resolve()


def configure_logging(settings: Settings) -> None:
    """콘솔과 파일에 INFO 이상 로그를 남기도록 설정.

    Streamlit은 스크립트를 여러 번 재실행하므로, 이전 검색 로그 핸들러를 제거하고
    새 파일 핸들러를 보장해 로그 누락과 중복 출력을 함께 방지함.
    """
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    log_file = settings.retrieve_log_file
    log_file.parent.mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s - %(message)s")
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    for handler in list(root_logger.handlers):
        is_retrieve_handler = getattr(handler, _RETRIEVE_HANDLER_ATTR, False)
        if is_retrieve_handler or _is_same_log_file(handler, log_file):
            root_logger.removeHandler(handler)
            handler.close()

    has_stdout_handler = any(
        isinstance(handler, logging.StreamHandler)
        and not isinstance(handler, logging.FileHandler)
        and getattr(handler, "stream", None) is sys.stdout
        for handler in root_logger.handlers
    )
    if not has_stdout_handler:
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setLevel(logging.INFO)
        stream_handler.setFormatter(formatter)
        setattr(stream_handler, _RETRIEVE_HANDLER_ATTR, True)
        root_logger.addHandler(stream_handler)

    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)
    setattr(file_handler, _RETRIEVE_HANDLER_ATTR, True)
    root_logger.addHandler(file_handler)

    for logger_name in ("httpx", "httpcore", "openai"):
        logging.getLogger(logger_name).setLevel(logging.WARNING)
