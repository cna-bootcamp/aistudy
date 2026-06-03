#!/usr/bin/env python3
"""특허법 RAG 예제 (Re-ranking / LangChain Compressor 방식)

10.rag/re-ranking 예제를 LangChain 통합 프레임워크(교재 7.5)로 재구성한 버전임.
검색 품질을 높이는 Cross-Encoder Re-ranking 로직 자체는 동일하나, FlagReranker를 직접 호출하던
수동 2단계 코드를 LangChain의 표준 추상화(ContextualCompressionRetriever + CrossEncoderReranker)로
대체하여 "1차 검색 → 재정렬"을 하나의 retriever로 묶음.

[10.rag/re-ranking 대비 핵심 변경 사항]
  Before: vectorstore.similarity_search(k=50) + FlagReranker.compute_score()를 직접 호출해 수동 재정렬
  After : base_retriever(1차 검색) + CrossEncoderReranker(Compressor)를 ContextualCompressionRetriever로
          묶어 retriever.invoke(query) 한 번에 "검색 → 재정렬 → Top-K 압축"을 수행
          → 리랭크 방식 변경 시 Compressor 클래스만 교체하면 됨(ColBERT·Cohere 등으로 손쉽게 교체)

처리 흐름:
  1) 1차 검색 (base_retriever)        : OpenAI 임베딩 기반 벡터 유사도로 Top-50 후보를 빠르게 추출
  2) Re-ranking (CrossEncoderReranker): 쿼리-문서 쌍을 Cross-Encoder로 정밀 평가하여 Top-5로 압축
     → 위 1)+2)를 ContextualCompressionRetriever.invoke()가 내부에서 한 번에 처리
  3) 답변 생성 (LLM)                  : 압축된 Top-5 문서를 근거로 Groq LPU LLM이 답변 생성

구성 요소:
  VectorDB : ChromaDB  (공용 DB ../../10.rag/vectordb, 컬렉션 patent_law / 8.0 인덱싱으로 구축)
  Embed    : OpenAI    text-embedding-3-small (1536차원, 인덱싱 시와 동일 모델이어야 검색 가능)
  Rerank   : dragonkue/bge-reranker-v2-m3-ko (HuggingFaceCrossEncoder 경유 로드)
  LLM      : Groq LPU  openai/gpt-oss-120b

사용법:
    python app.py     # 기본 질의어 데모 실행 후 대화형 입력 루프 진입
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import os
import sys
from pathlib import Path

# torch(CUDA)와 chromadb(onnxruntime)가 각자 OpenMP 런타임(libiomp5md.dll)을 중복 로드하면
# Windows에서 프로세스 종료 시점에 세그폴트(exit 139)가 발생할 수 있음. 중복 로드를 허용해 회피함.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

# Windows 콘솔 기본 인코딩(cp949)에서 한글 청크 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ---------------------------------------------------------------------------
# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent        # 이 파일이 위치한 디렉터리(11.rag-tuning/re-ranking/)
RAG_DIR = SCRIPT_DIR.parent.parent / "10.rag"        # hands-on/10.rag/ (공용 자산 위치)
VECTORDB_DIR = RAG_DIR / "vectordb"                  # 공용 ChromaDB 영속 디렉터리 (8.0 인덱싱 산출물)
ENV_PATH = SCRIPT_DIR.parent.parent / ".env"          # hands-on/.env (API 키 보관)

# ---------------------------------------------------------------------------
# 환경변수 로드
# ---------------------------------------------------------------------------
from dotenv import load_dotenv

load_dotenv(ENV_PATH)  # .env에서 OPENAI_API_KEY(쿼리 임베딩)·GROQ_API_KEY(LLM)를 로드함

# ---------------------------------------------------------------------------
# 상수 정의
# ---------------------------------------------------------------------------
COLLECTION_NAME = "patent_law"               # 공용 벡터 DB 컬렉션명 (8.0 인덱싱이 저장한 이름과 반드시 일치)
EMBEDDING_MODEL = "text-embedding-3-small"   # 쿼리 임베딩 모델 (인덱싱 시와 동일해야 벡터 공간이 일치)
RERANKER_MODEL = "dragonkue/bge-reranker-v2-m3-ko"  # 한국어 최적화 Cross-Encoder Re-ranker
GROQ_MODEL = "openai/gpt-oss-120b"           # Groq LPU에서 서빙되는 LLM

INITIAL_K = 50   # 1차 검색(base_retriever)에서 넓게 가져올 후보 문서 수
RERANK_K = 5     # Re-ranking(Compressor) 후 LLM에 전달할 최종 문서 수(= CrossEncoderReranker의 top_n)

DEFAULT_QUERY = "특허를 받을 수 있는 조건은 ?"   # 데모용 기본 질의어

# LLM 시스템 프롬프트 (검색된 컨텍스트에만 근거하도록 제약)
SYSTEM_PROMPT = """당신은 특허법 전문 법률 상담 AI입니다.

## 역할
- 주어진 컨텍스트(검색된 특허법 조문)를 기반으로 질문에 답변합니다.
- 법조문을 그대로 인용하지 말고, 일반인이 이해하기 쉽도록 풀어서 설명합니다.

## 규칙
1. 법률 용어는 쉬운 말로 바꿔서 설명 (예: "출원인" → "특허를 신청하는 사람")
2. 복잡한 조문은 핵심만 요약하여 전달
3. 컨텍스트에 없는 내용은 "해당 내용은 제공된 문서에서 찾을 수 없습니다"라고 답변
4. 답변 끝에 근거가 된 조문 번호를 명시 (예: 특허법 제29조)

## 컨텍스트
{context}
"""


# ---------------------------------------------------------------------------
# 1. 공용 벡터 DB 로드 (재인덱싱 없음)
# ---------------------------------------------------------------------------

def load_vectorstore():
    """8.0 인덱싱이 구축한 공용 벡터 DB를 임베딩 없이 로드하여 반환함.

    핵심 주의점: langchain_chroma의 기본 컬렉션명은 'langchain'이므로 collection_name을
    명시하지 않으면 오류 없이 빈 컬렉션이 열려 검색이 0건이 됨(침묵 실패). 따라서
    8.0 인덱싱이 저장한 컬렉션명(patent_law)을 반드시 지정하고, 적재 건수를 검증함.
    """
    from langchain_chroma import Chroma           # Chroma: ChromaDB 벡터 스토어 LangChain 래퍼
    from langchain_openai import OpenAIEmbeddings  # OpenAIEmbeddings: 텍스트를 1536차원 벡터로 변환

    if not VECTORDB_DIR.exists():
        raise FileNotFoundError(
            f"공용 벡터 DB를 찾을 수 없음: {VECTORDB_DIR}\n"
            f"먼저 8.0 인덱싱(hands-on/10.rag/indexing/indexing.py)을 실행하세요."
        )

    # 쿼리 임베딩에만 사용함 — 코퍼스는 이미 임베딩되어 저장돼 있으므로 재인덱싱하지 않음
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL, api_key=os.environ.get("OPENAI_API_KEY"))

    vectorstore = Chroma(
        persist_directory=str(VECTORDB_DIR),
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
    )

    # ._collection.count(): 컬렉션에 실제 저장된 벡터 개수 — 0이면 컬렉션 연결 실패로 간주하고 중단함
    count = vectorstore._collection.count()
    if count == 0:
        raise RuntimeError(
            f"컬렉션 '{COLLECTION_NAME}'에 문서가 없음(연결 실패 가능). "
            f"persist_directory/collection_name이 8.0 인덱싱과 일치하는지 확인하세요."
        )
    print(f"  - 공용 벡터 DB 로드 완료: 컬렉션 '{COLLECTION_NAME}', 저장 벡터 {count}건")
    return vectorstore


# ---------------------------------------------------------------------------
# 2. Re-ranker(Cross-Encoder) + Compressor 로드
# ---------------------------------------------------------------------------

def load_compressor():
    """Cross-Encoder 모델과 그것을 감싼 LangChain Compressor를 함께 로드하여 반환함.

    HuggingFaceCrossEncoder: sentence-transformers의 CrossEncoder를 LangChain 인터페이스로 감싼 래퍼.
        쿼리-문서 쌍을 함께 입력해 관련도를 평가하며, .score()는 0~1로 정규화된 점수(numpy 배열)를 반환함.
        (10.rag/re-ranking의 FlagReranker.compute_score(normalize=True)와 동일한 의미의 점수)
    CrossEncoderReranker: 위 모델을 LangChain DocumentCompressor로 만든 것. compress_documents()가
        1차 검색 결과를 재정렬한 뒤 상위 top_n개만 남겨 "압축(compression)"함.

    반환: (model, compressor) — model은 점수 표시(교육용)에, compressor는 retriever 구성에 사용함.
    """
    from langchain_community.cross_encoders import HuggingFaceCrossEncoder
    from langchain_classic.retrievers.document_compressors import CrossEncoderReranker

    print(f"  - Re-ranker 로드: {RERANKER_MODEL}")
    print("    (최초 실행 시 모델 다운로드로 수 분 소요될 수 있음)")
    model = HuggingFaceCrossEncoder(model_name=RERANKER_MODEL)
    compressor = CrossEncoderReranker(model=model, top_n=RERANK_K)  # 재정렬 후 Top-RERANK_K로 압축
    return model, compressor


def build_compression_retriever(vectorstore, compressor):
    """1차 검색 retriever를 Compressor로 감싼 ContextualCompressionRetriever를 구성하여 반환함.

    ContextualCompressionRetriever.invoke(query) 한 번이 내부적으로
      ① base_retriever로 1차 검색(Top-INITIAL_K) → ② base_compressor로 재정렬·압축(Top-RERANK_K)
    을 순차 수행함. 즉 10.rag 예제의 수동 2단계가 이 retriever 하나로 통합됨.

    리랭크 방식 교체는 base_compressor만 바꾸면 됨(예: ColBERTReranker, CohereRerank 등).
    """
    from langchain_classic.retrievers import ContextualCompressionRetriever

    # as_retriever: 벡터 스토어를 LangChain Retriever 인터페이스로 변환. k=INITIAL_K로 넓게 검색함
    base_retriever = vectorstore.as_retriever(search_kwargs={"k": INITIAL_K})
    return ContextualCompressionRetriever(
        base_retriever=base_retriever,   # 1단계: 초기 검색(Bi-Encoder)
        base_compressor=compressor,      # 2단계: 압축(Cross-Encoder 재정렬 + Top-N)  ← 여기만 교체하면 방식 변경
    )


# ---------------------------------------------------------------------------
# 3. LLM(Groq) 로드
# ---------------------------------------------------------------------------

def load_llm():
    """Groq LPU에서 서빙되는 LLM 인스턴스를 생성하여 반환함.

    ChatGroq: Groq API용 LangChain 채팅 모델 래퍼(llm.invoke()로 대화 요청 전송).
    temperature=0.3: 법률 답변의 일관성을 위해 낮은 무작위성 사용.
    """
    from langchain_groq import ChatGroq

    api_key = os.environ.get("GROQ_API_KEY")
    # API 키 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함
    if not api_key:
        raise RuntimeError("GROQ_API_KEY가 .env에 설정되지 않음")
    return ChatGroq(model=GROQ_MODEL, temperature=0.3, max_tokens=2048, api_key=api_key)


# ---------------------------------------------------------------------------
# 4. 검색 + Re-ranking (Compressor 방식)
# ---------------------------------------------------------------------------

def _doc_key(doc) -> tuple:
    """문서를 고유 식별하는 키(source, chunk_index) — 1차 순위와 재정렬 결과를 대응시키는 데 사용함."""
    return (doc.metadata.get("source"), doc.metadata.get("chunk_index"))


def retrieve_initial(retriever, query: str) -> list:
    """1차 검색(base_retriever): 벡터 유사도로 상위 INITIAL_K개 후보를 추출함.

    compression_retriever 내부의 base_retriever를 그대로 꺼내 호출함 — 재정렬 '전' 상태(1차 순위)를
    교육 목적으로 노출하기 위함임. 반환 리스트의 순서가 곧 Bi-Encoder 기준 순위(1위가 첫 원소)임.
    """
    base_retriever = retriever.base_retriever
    return base_retriever.invoke(query)


def rerank_with_scores(model, retriever, query: str, initial_docs: list) -> list:
    """compression_retriever로 재정렬·압축한 Top-K에 1차 순위와 관련도 점수를 부착해 반환함.

    - 재정렬·압축: retriever.invoke(query)가 내부에서 base_retriever 검색 + compressor 압축을 수행함.
      (initial_docs와 동일한 1차 검색을 거치므로 두 결과를 (source, chunk_index) 키로 대응시킬 수 있음)
    - 점수: ContextualCompressionRetriever는 점수를 메타데이터로 노출하지 않으므로, 표시용으로
      model.score()를 최종 Top-K에 대해서만 다시 계산함(5건뿐이라 비용 무시 가능).

    반환 형식: (원래_1차순위, doc, 관련도점수) 튜플 리스트 — 재정렬로 순위가 어떻게 바뀌었는지(교육 목적)
    출력 단계에서 비교할 수 있게 함.
    """
    # 1차 순위 조회용 인덱스: (source, chunk_index) → 1부터 시작하는 1차 검색 순위
    initial_rank_by_key = {_doc_key(doc): rank for rank, doc in enumerate(initial_docs, start=1)}

    # 통합 retriever 한 번 호출로 검색→재정렬→Top-K 압축까지 완료(이 예제의 핵심)
    reranked_docs = retriever.invoke(query)
    if not reranked_docs:
        return []

    # 표시용 관련도 점수: 최종 Top-K 쌍에 대해서만 Cross-Encoder 점수를 재계산함(0~1 정규화 값)
    pairs = [(query, doc.page_content) for doc in reranked_docs]
    scores = model.score(pairs)

    ranked = []
    for doc, score in zip(reranked_docs, scores):
        initial_rank = initial_rank_by_key.get(_doc_key(doc), -1)  # 못 찾으면 -1(이론상 발생하지 않음)
        ranked.append((initial_rank, doc, float(score)))
    return ranked


# ---------------------------------------------------------------------------
# 5. 출력 포맷팅
# ---------------------------------------------------------------------------

def _doc_label(doc) -> str:
    """문서 메타데이터(공용 DB는 source/chunk_index만 존재)를 짧은 라벨로 만듦."""
    source = doc.metadata.get("source", "알 수 없음")
    chunk_index = doc.metadata.get("chunk_index", "?")
    return f"{source} #{chunk_index}"


def print_initial_results(docs: list) -> None:
    """1차 검색(base_retriever) 결과 상위 일부를 미리보기로 출력함."""
    print("\n" + "-" * 70)
    print(f"[1차 검색] base_retriever Top-{len(docs)} (상위 10건 미리보기)")
    print("-" * 70)
    for rank, doc in enumerate(docs[:10], start=1):
        preview = doc.page_content[:60].replace("\n", " ")
        print(f"  {rank:2d}. {_doc_label(doc)}: {preview}...")


def print_reranked_results(reranked: list) -> None:
    """Re-ranking 결과를 출력하되, 1차 순위 → 재정렬 순위 변화를 함께 표시함."""
    print("\n" + "=" * 70)
    print(f"[Re-ranking] Compressor Top-{len(reranked)} (1차 순위 → 재정렬 순위)")
    print("=" * 70)
    for new_rank, (initial_rank, doc, score) in enumerate(reranked, start=1):
        # 1차 순위 대비 상승/하강/유지를 화살표로 표시해 재정렬 효과를 시각화함
        move = initial_rank - new_rank
        marker = f"▲{move}" if move > 0 else (f"▼{-move}" if move < 0 else "─")
        preview = doc.page_content[:70].replace("\n", " ")
        print(f"  {new_rank}. (1차 {initial_rank:2d}위 {marker}) [점수 {score:.4f}] {_doc_label(doc)}")
        print(f"     {preview}...")


def format_context(reranked: list) -> str:
    """재정렬된 문서들을 LLM 프롬프트에 넣을 컨텍스트 문자열로 합침."""
    blocks = []
    for new_rank, (_initial_rank, doc, score) in enumerate(reranked, start=1):
        header = f"[문서 {new_rank}] (출처: {_doc_label(doc)}, 관련도 {score:.4f})"
        blocks.append(f"{header}\n{doc.page_content}")
    return "\n\n---\n\n".join(blocks)


# ---------------------------------------------------------------------------
# 6. 답변 생성
# ---------------------------------------------------------------------------

def build_chain(llm):
    """프롬프트 → LLM → 문자열 추출로 이어지는 LCEL 체인을 구성함."""
    from langchain_core.prompts import ChatPromptTemplate   # 시스템/사용자 메시지 템플릿
    from langchain_core.output_parsers import StrOutputParser  # LLM 응답에서 본문 문자열만 추출

    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "{question}"),
    ])
    # LCEL 파이프: prompt가 만든 메시지를 llm에 전달하고 결과를 문자열로 파싱함
    return prompt | llm | StrOutputParser()


def run_query(model, retriever, chain, query: str) -> None:
    """질의 하나에 대해 1차 검색 → Re-ranking(Compressor) → 답변 생성의 전체 흐름을 수행함."""
    print(f"\n질문: {query}")

    # 1) 1차 검색 (base_retriever, 넓게) — 재정렬 '전' 상태를 교육 목적으로 노출
    initial_docs = retrieve_initial(retriever, query)
    print_initial_results(initial_docs)

    # 2) Re-ranking (Compressor, 정밀) — ContextualCompressionRetriever가 검색→재정렬→압축을 통합 수행
    reranked = rerank_with_scores(model, retriever, query, initial_docs)
    print_reranked_results(reranked)

    # 3) 답변 생성 (재정렬 Top-K만 컨텍스트로 사용)
    print("\n답변 생성 중...\n")
    context = format_context(reranked)
    answer = chain.invoke({"context": context, "question": query})
    print("-" * 70)
    print(answer)
    print("-" * 70)


# ---------------------------------------------------------------------------
# 메인
# ---------------------------------------------------------------------------

def main() -> None:
    """리소스 로드 후 기본 질의어 데모를 1회 실행하고 대화형 입력 루프로 진입함."""
    print("=" * 70)
    print("특허법 RAG 예제 (Re-ranking / LangChain Compressor)")
    print(f"설정: 1차 검색 Top-{INITIAL_K} → Compressor 재정렬 → Top-{RERANK_K} / LLM: {GROQ_MODEL}")
    print("=" * 70)

    print("\n[준비] 리소스 로드")
    vectorstore = load_vectorstore()
    model, compressor = load_compressor()
    retriever = build_compression_retriever(vectorstore, compressor)
    chain = build_chain(load_llm())

    # 기본 질의어로 전체 파이프라인을 1회 시연함
    run_query(model, retriever, chain, DEFAULT_QUERY)

    # 대화형 루프: 사용자가 직접 질문을 입력해 재정렬 효과를 체험할 수 있게 함
    print("\n" + "=" * 70)
    print("대화형 모드 — 질문을 입력하세요 (종료: quit / q / 빈 줄)")
    print("=" * 70)
    while True:
        try:
            question = input("\n질문> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n종료합니다.")
            break
        if not question or question.lower() in {"quit", "q", "exit", "종료"}:
            print("종료합니다.")
            break
        try:
            run_query(model, retriever, chain, question)
        except Exception as error:
            print(f"\n[오류] 질의 처리 실패: {error}")


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"\n[오류] 실행 실패: {error}", file=sys.stderr)
        sys.exit(1)
