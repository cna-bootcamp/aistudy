"""Ollama LLM 클라이언트 (qwen3:8b)

Ollama HTTP API로 qwen3:8b 모델을 호출하여 텍스트를 생성함.

qwen3 thinking 모드 대응 (#1 함정):
  qwen3는 기본으로 추론 과정을 <think>...</think>로 감싸 출력하므로,
  Router/Supervisor/CodeGen의 JSON·점수·코드 파싱이 비결정적으로 깨질 수 있음.
  → ① payload에 "think": False 로 Ollama 레벨에서 thinking 비활성화
     ② 응답에서 <think> 잔여 태그를 정규식으로 제거 (이중 방어)
"""
from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import re
from typing import Optional

import requests

from config.settings import settings
from utils.logger import get_logger

logger = get_logger("llm.ollama")


def strip_thinking_tags(text: str) -> str:
    """qwen3 응답의 <think>...</think> 추론 블록을 제거하고 본문만 반환함.

    "think": False 로도 드물게 태그가 남을 수 있어 호출 결과를 한 번 더 정제함.
    """
    if not text:
        return ""
    # </think> 가 있으면 그 이후(실제 답변)만 취함
    if "</think>" in text:
        text = text.split("</think>")[-1]
    # 열고 닫힌 <think>...</think> 블록 제거 (DOTALL: 줄바꿈 포함 매칭)
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    # 닫히지 않은 <think> 이후 잔여 제거
    text = re.sub(r"<think>.*", "", text, flags=re.DOTALL)
    return text.strip()


class OllamaLLM:
    """Ollama 기반 qwen3:8b LLM 클라이언트."""

    def __init__(
        self,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> None:
        """LLM 클라이언트 초기화 (값 미지정 시 settings 기본값 사용)."""
        self.model = model or settings.llm_model
        self.base_url = base_url or settings.ollama_base_url
        self.temperature = temperature if temperature is not None else settings.temperature
        self.max_tokens = max_tokens or settings.max_tokens

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        """프롬프트로 텍스트를 생성하고 thinking 태그가 제거된 본문을 반환함.

        Ollama /api/generate 를 stream=False 로 호출해 전체 응답을 한 번에 받음.
        """
        url = f"{self.base_url}/api/generate"

        # 시스템 프롬프트가 있으면 본문 앞에 결합
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt

        payload = {
            "model": self.model,
            "prompt": full_prompt,
            "stream": False,   # 스트리밍 비활성화 — 전체 응답을 한 번에 수신
            "think": False,    # qwen3 thinking 비활성화 (파싱 안정성 확보)
            "options": {
                "temperature": temperature if temperature is not None else self.temperature,
                "num_predict": max_tokens or self.max_tokens,
            },
        }

        try:
            logger.debug(f"LLM 생성 요청: model={self.model}, prompt_len={len(full_prompt)}")
            response = requests.post(url, json=payload, timeout=settings.llm_timeout)
            response.raise_for_status()
            result = response.json()
            generated = result.get("response", "")
            # think:False 가 무시되어 response가 비고 thinking에만 내용이 온 경우 대비
            if not generated and result.get("thinking"):
                generated = result["thinking"]
            cleaned = strip_thinking_tags(generated)
            logger.debug(f"LLM 생성 완료: response_len={len(cleaned)}")
            return cleaned
        except requests.exceptions.RequestException as e:
            logger.error(f"Ollama API 호출 실패: {e}")
            raise RuntimeError(f"Ollama API 호출 실패: {e}")

    def is_available(self) -> bool:
        """Ollama 서버 접근 가능 여부 확인."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False

    def check_model(self) -> bool:
        """설정된 LLM 모델이 Ollama에 설치되어 있는지 확인."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code != 200:
                return False
            names = [m.get("name", "") for m in response.json().get("models", [])]
            return self.model in names or f"{self.model}:latest" in names
        except requests.exceptions.RequestException:
            return False
