"""Ollama 임베딩 클라이언트 (qwen3-embedding)

쿼리 텍스트를 4096차원 벡터로 변환함.
중요: 기존 GraphRAG 스토어가 qwen3-embedding으로 인덱싱되었으므로, 쿼리도 반드시
동일 모델로 임베딩해야 벡터 공간이 일치하여 LanceDB 검색이 올바르게 동작함.
"""
from __future__ import annotations

from typing import Optional

import requests

from config.settings import settings
from utils.logger import get_logger

logger = get_logger("llm.embeddings")


class OllamaEmbeddings:
    """Ollama 기반 qwen3-embedding 임베딩 클라이언트."""

    def __init__(self, model: Optional[str] = None, base_url: Optional[str] = None) -> None:
        """임베딩 클라이언트 초기화."""
        self.model = model or settings.embedding_model
        self.base_url = base_url or settings.ollama_base_url
        self.embedding_dim = settings.embedding_dim

    def embed_query(self, text: str) -> list[float]:
        """단일 텍스트를 임베딩 벡터로 변환함 (LanceDB 검색 입력으로 사용).

        Ollama /api/embeddings 는 prompt 입력에 대해 단일 embedding 배열을 반환함.
        """
        url = f"{self.base_url}/api/embeddings"
        payload = {"model": self.model, "prompt": text}
        try:
            response = requests.post(url, json=payload, timeout=120)
            response.raise_for_status()
            embedding = response.json().get("embedding", [])
            if not embedding:
                raise RuntimeError("Ollama 응답에 embedding 필드가 없음")
            logger.debug(f"임베딩 완료: dim={len(embedding)}")
            return embedding
        except requests.exceptions.RequestException as e:
            logger.error(f"Ollama Embed API 호출 실패: {e}")
            raise RuntimeError(f"Ollama Embed API 호출 실패: {e}")

    def is_available(self) -> bool:
        """Ollama 서버 접근 가능 여부 확인."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
