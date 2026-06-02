"""비동기 라이브러리를 동기 Streamlit 코드에서 호출하기 위한 유틸리티."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Coroutine


def run_async(coro: Coroutine[Any, Any, Any]) -> Any:
    """코루틴을 동기 코드에서 실행하고 결과 반환.

    Streamlit은 보통 실행 중인 이벤트 루프가 없지만, 노트북·테스트 환경에서 이미 루프가 돌 수 있음.
    이 경우 별도 스레드에서 `asyncio.run()`을 수행해 중첩 이벤트 루프 오류를 피함.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)

    if loop.is_running():
        with ThreadPoolExecutor(max_workers=1) as executor:
            return executor.submit(lambda: asyncio.run(coro)).result()
    return loop.run_until_complete(coro)
