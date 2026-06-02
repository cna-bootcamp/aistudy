"""동기 코드에서 async GraphRAG API를 안전하게 호출하기 위한 이벤트 루프 브리지.

GraphRAG의 검색 함수(local_search/global_search/drift_search)는 모두 코루틴(async)임.
이 MAS는 LangGraph를 동기(graph.invoke)로 돌리고, FastMCP 도구도 동기 함수로 노출함.
문제는 '이미 실행 중인 이벤트 루프'의 유무가 실행 맥락마다 다르다는 점임.

  - in-process 테스트 / graph.invoke : 실행 중 루프 없음 → 현재 스레드에 새 루프를 띄워 실행
  - FastMCP(Streamable HTTP) 워커     : 호출 스레드에 루프가 떠 있을 수 있음 → 별도 스레드에서 실행

run_async()는 두 경우를 모두 처리해, 어느 계층에서 불려도 'event loop is already running'으로
터지지 않게 함. (전송 계층 테스트만 잡아내는 함정이므로 처음부터 방어적으로 구현함.)
"""
from __future__ import annotations

import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Awaitable, TypeVar

T = TypeVar("T")


def run_async(coro: Awaitable[T]) -> T:
    """코루틴을 동기적으로 실행하고 결과를 반환함.

    현재 스레드에 실행 중인 이벤트 루프가 있으면(예: MCP 워커), 코루틴을 별도 스레드에서
    독립 루프로 실행해 충돌을 피함. 루프가 없으면 현재 스레드에 새 루프를 만들어 실행함.
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        # 실행 중 루프 없음 → 현재 스레드에서 직접 실행 (가장 일반적인 경로)
        return _run_in_new_loop(coro)

    # 실행 중 루프 있음 → 새 스레드에서 독립 루프로 실행 (블로킹 대기)
    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(_run_in_new_loop, coro).result()


def _run_in_new_loop(coro: Awaitable[T]) -> T:
    """전용 이벤트 루프를 만들어 코루틴을 끝까지 실행하고 깔끔히 정리함."""
    loop = asyncio.new_event_loop()
    # DRIFT의 JSON 파싱 실패가 백그라운드 태스크 로그로 시끄럽게 찍히는 것을 억제함
    loop.set_exception_handler(_quiet_json_errors)
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)
    finally:
        # 남은 태스크를 취소·수거한 뒤 루프를 닫아 리소스 누수를 방지함
        pending = asyncio.all_tasks(loop)
        for task in pending:
            task.cancel()
        if pending:
            loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
        loop.run_until_complete(loop.shutdown_asyncgens())
        asyncio.set_event_loop(None)
        loop.close()


def _quiet_json_errors(loop: asyncio.AbstractEventLoop, context: dict[str, Any]) -> None:
    """DRIFT primer JSON 파싱 실패 로그만 조용히 무시하고, 그 외 오류는 정상 출력함."""
    exc = context.get("exception")
    if isinstance(exc, Exception) and is_json_parse_error(exc):
        return
    loop.default_exception_handler(context)


def is_json_parse_error(exc: Exception) -> bool:
    """DRIFT Search primer/follow-up이 던지는 JSON 파싱 실패를 감지함."""
    if isinstance(exc, json.JSONDecodeError):
        return True
    text = f"{type(exc).__name__}: {exc}".lower()
    patterns = ("json", "expecting value", "unterminated string", "extra data",
                "invalid control character", "could not parse")
    return any(pattern in text for pattern in patterns)
