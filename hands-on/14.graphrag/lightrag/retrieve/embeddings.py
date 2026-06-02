"""Ollama qwen3-embedding 전용 임베딩 함수 모듈.

LightRAG와 예제코드 벡터 검색이 동일한 Ollama 임베딩 함수를 사용하도록 구성함.
"""
import numpy as np
from lightrag.llm.ollama import ollama_embed
from lightrag.utils import EmbeddingFunc

from async_utils import run_async
from config.settings import Settings

# LightRAG의 ollama_embed 래퍼에는 기본 1024차원 메타데이터가 있으므로 원본 함수에 접근함
_RAW_OLLAMA_EMBED = getattr(ollama_embed, "func", ollama_embed)


async def ollama_embedding(texts: list[str], settings: Settings):
    """Ollama qwen3-embedding으로 텍스트 목록을 4096차원 벡터로 변환."""
    return await _RAW_OLLAMA_EMBED(
        texts,
        embed_model=settings.embedding_model,
        host=settings.ollama_base_url,
    )


def embed_texts(texts: list[str], settings: Settings) -> np.ndarray:
    """동기 코드에서 Ollama 임베딩을 호출하고 numpy 배열로 반환."""
    vectors = run_async(ollama_embedding(texts, settings))
    return np.asarray(vectors, dtype=np.float32)


def create_embedding_func(settings: Settings) -> EmbeddingFunc:
    """LightRAG가 요구하는 EmbeddingFunc 래퍼 생성."""
    async def _embed(texts: list[str]):
        """LightRAG 내부 비동기 호출용 임베딩 함수."""
        return await ollama_embedding(texts, settings)

    return EmbeddingFunc(
        embedding_dim=settings.embedding_dim,
        max_token_size=settings.embedding_max_token_size,
        func=_embed,
    )
