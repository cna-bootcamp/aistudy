#!/usr/bin/env python3
"""공유 계약 모듈 (인덱싱 ↔ 문서검색 공통)

KaLM-Embedding 기반 RAG에서 '인덱싱'과 '문서검색'이 반드시 동일하게 써야 하는 값·로직을 한곳에 모음.
임베딩 모델·차원·지시문·컬렉션명·벡터DB 경로가 양쪽에서 어긋나면 질의 벡터와 저장 벡터의 의미 공간이
달라져 검색이 붕괴하므로, 이 파일을 양쪽에서 import 하여 단일 출처(Single Source of Truth)로 사용함.

핵심 개념:
  - KaLM-Embedding-Gemma3-12B-2511 : Gemma 3 12B 백본의 instruct 임베딩 모델 (네이티브 3840차원)
  - 4-bit 양자화 (bitsandbytes)      : 11.76B 모델을 ~7GB VRAM으로 적재
  - MRL (Matryoshka)                 : 앞 1024차원만 잘라 써도 의미가 보존되는 중첩 임베딩 (truncate_dim=1024)
  - instruct 임베더                  : query에는 지시문 프리픽스를 붙이고 document에는 붙이지 않는 비대칭 인코딩
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

from pathlib import Path

import torch
from langchain_core.embeddings import Embeddings   # LangChain 임베딩 인터페이스 (embed_documents/embed_query 구현 대상)

# ---------------------------------------------------------------------------
# 공유 계약 상수 (★ 인덱싱·문서검색이 동일 값을 사용해야 함)
# ---------------------------------------------------------------------------
EMBEDDING_MODEL = "tencent/KaLM-Embedding-Gemma3-12B-2511"  # 임베딩 모델 (HF 허브 ID)
EMBED_DIM = 1024                       # MRL 절단 차원 (인덱싱·검색 동일해야 코사인 비교 성립)
COLLECTION_NAME = "patent_law_kalm1024"  # ChromaDB 컬렉션명 (양쪽 동일 문자열)

# instruct 임베더 프롬프트: query에만 지시문을 붙이고 document에는 빈 문자열을 사용함 (모델 카드 권장값)
# 이 비대칭을 인덱싱(document)과 검색(query)이 동일하게 지켜야 검색 정확도가 유지됨
QUERY_PROMPT = "Instruct: Given a query, retrieve documents that answer the query \nQuery: "
DOCUMENT_PROMPT = ""

ENCODE_BATCH_SIZE = 8                   # 임베딩 배치 크기 (VRAM 여유에 맞춘 보수적 값)

# 벡터DB 영속 경로: 이 파일(indexing/) 기준 상위의 공용 vectordb/ (인덱싱이 생성, 검색이 소비)
# Path(__file__).resolve().parent → indexing/ , 그 parent → agentic-rag-chat/
VECTORDB_DIR = Path(__file__).resolve().parent.parent / "vectordb"


# ---------------------------------------------------------------------------
# KaLM 임베딩 래퍼 (LangChain Embeddings 구현)
# ---------------------------------------------------------------------------

class KaLMEmbeddings(Embeddings):
    """KaLM-Embedding-Gemma3-12B-2511을 4-bit·MRL 1024차원으로 감싼 LangChain 임베딩.

    LangChain의 Chroma 등은 embed_documents()/embed_query() 두 메서드만 호출하므로 이를 구현함.
    instruct 임베더 특성상 document와 query에 서로 다른 프롬프트를 적용하는 것이 핵심임.

    모델 적재(~7GB)는 비용이 크므로, 생성 시점이 아니라 첫 임베딩 호출 시점에 1회만 적재함(지연 로딩).
    """

    def __init__(self, batch_size: int = ENCODE_BATCH_SIZE):
        self.batch_size = batch_size
        # 무거운 모델을 import/생성 즉시 올리지 않기 위해 placeholder로 두고 _ensure_model()에서 적재함
        self._model = None

    def _ensure_model(self):
        """SentenceTransformer 모델을 4-bit 양자화로 1회 적재함 (이후 호출은 재사용).

        SentenceTransformer: Transformer→Pooling(last-token)→Normalize 모듈 파이프라인을 캡슐화한 래퍼.
        truncate_dim=1024로 MRL 절단을 적용하고, BitsAndBytesConfig로 4-bit(nf4) 양자화하여 VRAM을 절감함.
        모델은 transformers 4.55.0 / sentence-transformers 4.1.0 조합에서 검증됨(상위 버전은 멀티모달 경로 오류).
        """
        if self._model is not None:
            return self._model
        # 지연 import: 무거운 의존성을 실제 사용할 때만 로드함
        from sentence_transformers import SentenceTransformer
        from transformers import BitsAndBytesConfig

        # BitsAndBytesConfig: 가중치를 4-bit(nf4)로 양자화하되 연산은 bfloat16으로 수행하는 설정
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_use_double_quant=True,
        )
        self._model = SentenceTransformer(
            EMBEDDING_MODEL,
            trust_remote_code=True,        # 모델 저장소의 커스텀 코드(gemma3_text 임베딩) 실행 허용
            truncate_dim=EMBED_DIM,        # MRL: 3840 → 1024 차원으로 절단
            model_kwargs={"quantization_config": quantization_config, "torch_dtype": torch.bfloat16},
        )
        return self._model

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """문서 청크 목록을 임베딩함 (document 프롬프트 사용, 1024차원 L2 정규화 벡터 반환)."""
        model = self._ensure_model()
        # normalize_embeddings=True는 truncate_dim 절단 '이후' 단계에서 L2 정규화를 적용함
        # (모델 내부 Normalize 모듈은 3840차원 기준이라, 1024 절단 후 재정규화가 반드시 필요함)
        vectors = model.encode(
            texts,
            prompt=DOCUMENT_PROMPT,
            normalize_embeddings=True,
            batch_size=self.batch_size,
            show_progress_bar=True,
        )
        # numpy 배열을 ChromaDB가 받는 순수 float 리스트로 변환함
        return vectors.tolist()

    def embed_query(self, text: str) -> list[float]:
        """단일 질의를 임베딩함 (query 지시문 프롬프트 사용, 1024차원 L2 정규화 벡터 반환)."""
        model = self._ensure_model()
        vector = model.encode(
            [text],
            prompt=QUERY_PROMPT,
            normalize_embeddings=True,
            batch_size=self.batch_size,
        )
        return vector[0].tolist()
