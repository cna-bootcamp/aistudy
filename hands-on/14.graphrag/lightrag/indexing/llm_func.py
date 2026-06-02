"""LLM·임베딩 함수 모듈 — Groq(OpenAI 호환) + Ollama(qwen3-embedding)

LightRAG와 코드 벡터 인덱서에 주입할 함수들을 구성함:
1) create_llm_func()       : Groq LPU의 OpenAI 호환 API로 엔티티/관계 추출 (LightRAG용)
2) create_embed_callable() : Ollama qwen3-embedding(4096차원) 임베딩 원시 함수 (공통 사용)
3) create_embedding_func() : 위 함수를 LightRAG가 요구하는 EmbeddingFunc으로 래핑

[2.6.3 주의] LightRAG의 ollama_embed에는 embedding_dim=1024 데코레이터가 기본 적용되어 있어
EmbeddingFunc(4096)과 충돌(벡터 수 불일치)함. .func로 원본 함수에 직접 접근하여 이중 래핑을 우회함.
"""
import logging

import httpx  # Ollama 서버 연결 점검용 경량 HTTP 클라이언트
from lightrag.llm.ollama import ollama_embed       # Ollama 임베딩 호출 함수
from lightrag.llm.openai import openai_complete_if_cache  # OpenAI 호환 LLM 호출 함수
from lightrag.utils import EmbeddingFunc           # 임베딩 함수를 차원 정보와 함께 감싸는 래퍼

from config.settings import Settings

logger = logging.getLogger(__name__)

# getattr(ollama_embed, "func", ollama_embed): 데코레이터가 노출한 원본 함수(.func)에 접근하되,
# 구버전처럼 .func가 없으면 원본 래퍼를 그대로 사용함 (이중 래핑 dim=1024 검증 우회)
_raw_ollama_embed = getattr(ollama_embed, "func", ollama_embed)


def create_llm_func(settings: Settings):
    """Groq OpenAI 호환 API를 호출하는 LightRAG용 LLM 함수를 생성·반환함."""

    async def llm_model_func(
        prompt,
        system_prompt=None,
        history_messages=None,
        keyword_extraction=False,  # LightRAG가 전달하는 플래그. OpenAI API로 흘려보내지 않도록 흡수
        **kwargs,
    ) -> str:
        """Groq LPU로 LLM 응답 생성 (LightRAG가 엔티티 추출 시 호출).

        gpt-oss-20b는 추론형(reasoning) 모델이라 추론 토큰이 응답 한도를 소진하면
        실제 답변(content)이 비어 LightRAG가 "Received empty content" 오류를 냄.
        reasoning_effort를 낮춰 추론량을 줄이고 max_tokens를 충분히 확보해
        추출 결과가 content로 정상 반환되도록 함. (setdefault로 호출부 지정값을 우선)
        """
        kwargs.setdefault("reasoning_effort", "low")
        kwargs.setdefault("max_tokens", 8192)
        # history_messages를 None→[]로 처리: 가변 기본인자(list) 공유 버그를 피하기 위함
        return await openai_complete_if_cache(
            settings.groq_model,
            prompt,
            system_prompt=system_prompt,
            history_messages=history_messages or [],
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
            **kwargs,
        )

    return llm_model_func


def create_embed_callable(settings: Settings):
    """qwen3-embedding 임베딩을 수행하는 비동기 함수를 생성·반환함 (LightRAG·코드 인덱서 공통)."""

    async def _embed(texts: list[str]):
        """텍스트 목록을 임베딩하여 (N, 4096) ndarray 반환."""
        # host: Ollama 서버 주소. embed_model: 사용할 임베딩 모델명
        return await _raw_ollama_embed(
            texts, embed_model=settings.embedding_model, host=settings.ollama_base_url
        )

    return _embed


def create_embedding_func(settings: Settings) -> EmbeddingFunc:
    """LightRAG가 요구하는 EmbeddingFunc 래퍼 생성.

    func에 직접 만든 _embed(데코레이터 없음)를 넘기므로 dim 충돌이 발생하지 않음.
    """
    return EmbeddingFunc(
        embedding_dim=settings.embedding_dim,
        max_token_size=settings.embedding_max_token_size,
        func=create_embed_callable(settings),
    )


def check_groq_key(settings: Settings) -> None:
    """GROQ_API_KEY 미설정 시 즉시 명확한 오류 발생 (인덱싱 초기 디버깅 용이)."""
    if not settings.groq_api_key:
        raise RuntimeError(
            "GROQ_API_KEY가 설정되지 않음. hands-on/.env에 GROQ_API_KEY를 추가하세요."
        )


def check_ollama(settings: Settings) -> None:
    """Ollama 서버 연결과 임베딩 모델 보유 여부를 점검. 실패 시 안내 메시지와 함께 중단."""
    try:
        # /api/tags: Ollama가 보유한 모델 목록을 반환하는 엔드포인트
        resp = httpx.get(f"{settings.ollama_base_url}/api/tags", timeout=5.0)
        resp.raise_for_status()
    except Exception as exc:  # noqa: BLE001 - 연결 실패 원인을 그대로 안내에 포함
        raise RuntimeError(
            f"Ollama 서버에 연결할 수 없음 ({settings.ollama_base_url}). "
            f"`ollama serve` 실행 여부를 확인하세요. 원인: {exc}"
        ) from exc
    names = [m.get("name", "") for m in resp.json().get("models", [])]
    # startswith 매칭: 'qwen3-embedding'이 'qwen3-embedding:latest' 형태로 저장될 수 있음
    if not any(n.startswith(settings.embedding_model) for n in names):
        raise RuntimeError(
            f"임베딩 모델 '{settings.embedding_model}'을 찾을 수 없음. "
            f"`ollama pull {settings.embedding_model}` 실행 필요. 현재 보유 모델: {names}"
        )
