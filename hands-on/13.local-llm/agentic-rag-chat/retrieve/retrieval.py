#!/usr/bin/env python3
"""2-Stage Retrieval (KaLM Bi-encoder 초기검색 → BGE Cross-encoder 재정렬)

검색 정확도를 높이기 위해 '빠른 1차 회수 → 정밀 2차 재정렬'의 2단계 검색을 수행함.
  - Stage 1 (Bi-encoder)    : 인덱싱과 동일한 KaLM 임베딩(공용 common.py)으로 질의를 1024차원으로
                              인코딩해 ChromaDB에서 코사인 유사도 상위 top-20을 빠르게 회수함.
                              질의·문서를 각각 독립 벡터화하므로 대규모 컬렉션도 빠르나 정밀도는 낮음.
  - Stage 2 (Cross-encoder) : dragonkue/bge-reranker-v2-m3-ko로 (질의, 문서) 쌍을 함께 입력해 관련도를
                              직접 채점하고 상위 top-5만 남김. 한 쌍씩 보므로 느리지만 정밀도가 높아,
                              1차에서 넘어온 소수 후보(20개)만 재채점하는 것이 비용·정확도 균형에 유리함.

[10.rag 단일 검색 대비 변경점]
  Before: vectorstore.as_retriever(k=5) 단일 Bi-encoder 검색만 수행
  After : Bi-encoder top-20 → Cross-encoder 재정렬 top-5 (2-stage)로 상위 문서 정밀도를 끌어올림
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import math
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(retrieve/)를 절대경로로 구함
PROJECT_DIR = SCRIPT_DIR.parent                 # agentic-rag-chat/
INDEXING_DIR = PROJECT_DIR / "indexing"         # 공용 계약 모듈 common.py 가 있는 디렉터리
VECTORDB_DIR = PROJECT_DIR / "vectordb"         # 인덱싱이 생성한 공용 ChromaDB 영속 경로

# common.py(임베딩 모델·차원·지시문·컬렉션명을 정의한 단일 출처)를 import 하기 위해
# 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 indexing 디렉터리를 추가함
if str(INDEXING_DIR) not in sys.path:
    sys.path.insert(0, str(INDEXING_DIR))

# 인덱싱과 검색이 어긋나지 않도록 컬렉션명·차원·임베딩 래퍼를 공용 계약에서 그대로 가져옴
from common import COLLECTION_NAME, EMBED_DIM, KaLMEmbeddings

# Chroma 는 langchain_chroma import 시점에 chromadb → onnxruntime + grpcio 등 CUDA 네이티브 라이브러리를
# 대량으로 선점하여, 나중에 CrossEncoder(BGE 리랭커)가 CUDA를 초기화할 때 access violation(segfault)을
# 일으키는 것이 확인됨. 이를 방지하기 위해 지연 import 로 전환하고 load_vectorstore() 안에서만 로드함.
# (CrossEncoder 가 chromadb 보다 먼저 CUDA 컨텍스트를 선점해야 정상 동작 — mintest11 로 검증됨)
from langchain_core.documents import Document   # page_content + metadata를 담는 LangChain 기본 문서 객체

# ---------------------------------------------------------------------------
# 상수 정의
# ---------------------------------------------------------------------------
RERANKER_MODEL = "dragonkue/bge-reranker-v2-m3-ko"  # 한국어 특화 BGE Cross-encoder 리랭커 (HF 허브 ID)
STAGE1_TOP_K = 20            # Stage 1(Bi-encoder)에서 1차 회수할 후보 문서 수
STAGE2_TOP_K = 5             # Stage 2(Cross-encoder) 재정렬 후 최종 유지할 문서 수
RERANKER_MAX_LENGTH = 512    # 리랭커 입력 최대 토큰 길이 (질의+문서 합산; 초과분은 잘림)
RERANKER_BATCH_SIZE = 16     # 리랭커 추론 배치 크기 (VRAM 여유에 맞춘 보수적 값)


# ---------------------------------------------------------------------------
# 모델·벡터스토어 로더
# ---------------------------------------------------------------------------

def load_vectorstore():
    """공용 특허법 벡터 DB를 KaLM 질의 임베더와 함께 로드함 (검색 전용).

    Chroma에 embedding_function으로 KaLMEmbeddings를 지정하면, similarity_search(query)가 내부적으로
    embed_query(query)를 호출해 질의에 QUERY_PROMPT 지시문을 붙이고 1024차원(절단+L2 재정규화)으로
    인코딩함. 인덱싱(document)과 동일한 모델·차원·지시문 규약을 지켜야 코사인 비교가 성립함.

    Chroma import 를 이 함수 안에서 지연 로드함: 최상단에서 import 하면 chromadb 가 onnxruntime +
    grpcio 등 네이티브 라이브러리를 먼저 선점해 CrossEncoder(BGE 리랭커) CUDA 초기화 시 segfault 발생.
    """
    # langchain_chroma 는 이 함수 안에서만 import 함 (chromadb 지연 로드, segfault 방지)
    from langchain_chroma import Chroma  # noqa: PLC0415

    if not VECTORDB_DIR.exists():
        raise FileNotFoundError(
            f"벡터 DB를 찾을 수 없음: {VECTORDB_DIR}\n"
            f"먼저 'indexing/indexing.py'를 실행하여 공용 벡터 DB를 구축하세요."
        )
    return Chroma(
        persist_directory=str(VECTORDB_DIR),
        collection_name=COLLECTION_NAME,
        embedding_function=KaLMEmbeddings(),   # 질의 인코딩 = 인덱싱과 동일한 KaLM 1024차원 임베더
    )


def load_reranker():
    """dragonkue/bge-reranker-v2-m3-ko Cross-encoder 리랭커를 1회 적재함.

    CrossEncoder: (문장A, 문장B) 쌍을 한 번에 입력받아 둘의 관련도를 단일 점수로 출력하는
    sentence-transformers 래퍼. bge-reranker-v2-m3는 XLM-RoBERTa 기반 다국어 리랭커이며,
    dragonkue 버전은 한국어 검색 품질을 높이도록 파인튜닝됨. GPU가 있으면 cuda로 적재함.
    """
    # 지연 import: 무거운 ML 의존성을 실제 사용할 때만 로드함
    from sentence_transformers import CrossEncoder
    import torch

    # GPU(cuda) 사용 가능 시 GPU로, 아니면 CPU로 적재함 (CPU도 동작하나 느림)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    return CrossEncoder(RERANKER_MODEL, max_length=RERANKER_MAX_LENGTH, device=device)


# ---------------------------------------------------------------------------
# 2-Stage Retriever
# ---------------------------------------------------------------------------

class TwoStageRetriever:
    """KaLM Bi-encoder 1차 검색과 BGE Cross-encoder 2차 재정렬을 묶은 검색기.

    retrieve(query)를 호출하면 Stage 1으로 top-20을 회수하고 Stage 2로 재정렬해 top-5를 반환함.
    무거운 모델(임베더·리랭커)은 외부에서 1회 적재해 주입받음으로써 (Streamlit @st.cache_resource 등)
    질의마다 재적재되지 않게 함.
    """

    def __init__(
        self,
        vectorstore: Chroma,
        reranker,
        stage1_top_k: int = STAGE1_TOP_K,
        stage2_top_k: int = STAGE2_TOP_K,
    ):
        self.vectorstore = vectorstore
        self.reranker = reranker
        self.stage1_top_k = stage1_top_k
        self.stage2_top_k = stage2_top_k

    def retrieve(self, query: str) -> list[Document]:
        """질의에 대해 2-stage 검색을 수행하고 재정렬 상위 top-5 문서를 반환함.

        각 결과 문서의 metadata에 rerank_score(0~1로 정규화한 관련도)를 부착해, 상위 단계(UI 등)에서
        재정렬 결과를 가시화할 수 있게 함.
        """
        # ----- Stage 1: KaLM Bi-encoder 코사인 유사도 top-20 회수 -----
        candidates = self.vectorstore.similarity_search(query, k=self.stage1_top_k)
        if not candidates:
            return []

        # ----- Stage 2: BGE Cross-encoder로 (질의, 문서) 쌍을 재채점 -----
        # predict(pairs): 각 쌍의 관련도 logit(실수)을 반환함. 값이 클수록 관련도가 높음
        pairs = [(query, doc.page_content) for doc in candidates]
        scores = self.reranker.predict(
            pairs,
            batch_size=RERANKER_BATCH_SIZE,
            show_progress_bar=False,
        )

        # 점수 내림차순 정렬 후 상위 top-5만 선택함
        ranked = sorted(zip(candidates, scores), key=lambda pair: float(pair[1]), reverse=True)
        top_docs: list[Document] = []
        for doc, score in ranked[: self.stage2_top_k]:
            # 원본 metadata를 보존하면서 rerank_score를 더한 새 metadata로 교체함 (원본 사전 변형 방지)
            # 시그모이드로 logit을 0~1 관련도 확률로 변환해 사람이 읽기 쉽게 함 (정렬 순서는 동일)
            new_metadata = {**doc.metadata, "rerank_score": _sigmoid(float(score))}
            top_docs.append(Document(page_content=doc.page_content, metadata=new_metadata))
        return top_docs


def _sigmoid(value: float) -> float:
    """logit 점수를 0~1 범위의 관련도 확률로 변환함 (재정렬 점수 표기용)."""
    # 오버플로를 피하기 위해 큰 음수에서도 안전한 형태로 계산함
    if value >= 0:
        return 1.0 / (1.0 + math.exp(-value))
    exp_value = math.exp(value)
    return exp_value / (1.0 + exp_value)


# ---------------------------------------------------------------------------
# 단독 실행 스모크 테스트 (python retrieval.py "질의")
# ---------------------------------------------------------------------------

def _smoke_test(query: str) -> None:
    """벡터 DB·리랭커를 적재하고 한 질의로 2-stage 검색 동작을 콘솔에서 확인함."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # Windows 콘솔(cp949)에서 한글 깨짐 방지

    print(f"[1/3] 벡터 DB 로드: {VECTORDB_DIR} (컬렉션 {COLLECTION_NAME})")
    vectorstore = load_vectorstore()
    print(f"  - 저장된 청크 수: {vectorstore._collection.count()}")

    print(f"[2/3] 리랭커 로드: {RERANKER_MODEL}")
    reranker = load_reranker()

    print(f"[3/3] 2-stage 검색 (Stage1 top-{STAGE1_TOP_K} → Stage2 top-{STAGE2_TOP_K})")
    retriever = TwoStageRetriever(vectorstore, reranker)
    results = retriever.retrieve(query)

    print(f"\n질의: '{query}' → 재정렬 상위 {len(results)}건")
    for rank, doc in enumerate(results, start=1):
        source = doc.metadata.get("source", "?")
        chunk_index = doc.metadata.get("chunk_index", "?")
        score = doc.metadata.get("rerank_score", 0.0)
        snippet = doc.page_content[:70].replace("\n", " ")
        print(f"  [{rank}] {source} #{chunk_index} (관련도 {score:.3f}) {snippet}...")


if __name__ == "__main__":  # 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
    # 명령행 인자로 질의를 받되, 없으면 기본 검증 질의를 사용함
    test_query = sys.argv[1] if len(sys.argv) > 1 else "특허를 받을 수 있는 요건은?"
    _smoke_test(test_query)
