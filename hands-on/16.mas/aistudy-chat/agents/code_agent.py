"""Code Agent

RAG 검색 결과(예제코드 청크)를 참고하여 Python 코드를 생성하고, ast.parse로 구문을 검증함.
구문 오류 시 오류 메시지를 컨텍스트에 추가하여 최대 max_retries회까지 재생성함.
"""
from __future__ import annotations

import ast  # Python 코드 구문 분석 (실행 없이 문법만 검증 → 안전)
from typing import Optional

from config.settings import settings, AGENTS
from llm.ollama_llm import OllamaLLM
from utils.logger import get_logger

logger = get_logger("agents.code")


# 코드 생성 프롬프트 — {context}: RAG 참고 자료, {request}: 사용자 요청
CODE_GENERATION_PROMPT = """당신은 Python 코드 생성 전문가임.
아래 참고 자료(예제코드)와 요청을 바탕으로 실행 가능한 완전한 Python 코드를 작성함.

## 참고 자료(예제코드)
{context}

## 요청사항
{request}

## 작성 규칙
1. 실행 가능한 완전한 Python 코드 작성 (필요한 import 포함)
2. 주석은 한국어로 작성
3. 기본적인 에러 처리 포함
4. 반드시 ```python ... ``` 코드 블록 하나로만 출력 (설명 문장 금지)

## 생성할 코드:
"""


class CodeAgent:
    """예제코드 기반 Python 코드 생성 Agent (구문 검증 포함)."""

    def __init__(self, llm: Optional[OllamaLLM] = None) -> None:
        """CodeAgent 초기화."""
        self.llm = llm or OllamaLLM()
        self.agent_info = AGENTS.get("code_agent", {})
        self.name = self.agent_info.get("name", "Code Agent")

    def generate_code(self, request: str, context: str = "", temperature: Optional[float] = None) -> str:
        """요청과 참고 자료로 코드를 생성하고 코드 블록만 추출하여 반환함."""
        prompt = CODE_GENERATION_PROMPT.format(
            context=context or "참고 자료 없음",
            request=request,
        )
        try:
            # temperature=0.3: 낮게 설정해 일관적이고 정확한 코드 생성 (창의성보다 정확성 우선)
            response = self.llm.generate(prompt=prompt, temperature=temperature or 0.3, max_tokens=settings.max_tokens)
            return self._extract_code(response)
        except Exception as e:
            logger.error(f"코드 생성 실패: {e}")
            return ""

    def _extract_code(self, response: str) -> str:
        """LLM 응답에서 마크다운 코드 블록(```python ... ```) 내부 코드만 추출함."""
        if "```python" in response:
            start = response.find("```python") + len("```python")
            end = response.find("```", start)
            if end > start:
                return response[start:end].strip()
        if "```" in response:
            start = response.find("```") + 3
            end = response.find("```", start)
            if end > start:
                return response[start:end].strip()
        # 코드 블록이 없으면 응답 전체를 코드로 간주
        return response.strip()

    def validate_code(self, code: str) -> tuple[bool, str]:
        """ast.parse로 코드 구문 유효성을 검증함 (실행하지 않으므로 안전)."""
        if not code.strip():
            return False, "코드가 비어있음"
        try:
            ast.parse(code)
            return True, "구문 검사 통과"
        except SyntaxError as e:
            return False, f"구문 오류: {e}"

    def generate_with_retry(self, request: str, context: str = "", max_retries: int = 2) -> tuple[str, bool]:
        """구문 검증을 통과할 때까지 최대 max_retries회 재생성함 (오류를 컨텍스트로 피드백)."""
        code = ""
        for attempt in range(max_retries + 1):
            code = self.generate_code(request, context)
            is_valid, message = self.validate_code(code)
            if is_valid:
                logger.info(f"[Code] 구문 검증 성공 (시도 {attempt + 1})")
                return code, True
            logger.warning(f"[Code] 구문 검증 실패 (시도 {attempt + 1}/{max_retries + 1}): {message}")
            # 다음 시도에 이전 오류를 알려 같은 실수를 반복하지 않게 함
            if attempt < max_retries:
                context += f"\n\n이전 시도 오류: {message}\n이 오류를 수정하여 다시 작성함."
        return code, False
