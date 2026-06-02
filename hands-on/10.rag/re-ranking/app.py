#!/usr/bin/env python3
"""특허법 RAG 예제 (Re-ranking / 2-stage Retrieval)

공용 벡터 DB를 재인덱싱 없이 로드하여 검색하고, Cross-Encoder Re-ranking으로 검색 품질을 높이는 예제임.

[Naive RAG 대비 핵심 변경 사항]
  Before: 1차 Dense 검색(Bi-Encoder) 상위 5건을 그대로 LLM 컨텍스트로 사용
  After : 1차 검색을 넓게(Top-50) 가져온 뒤 Cross-Encoder로 정밀 재정렬하여 Top-5만 사용
          → "Retrieve More, Rerank Better" 전략으로 recall과 precision을 동시에 향상

처리 흐름:
  1) 1차 검색 (Bi-Encoder)  : OpenAI 임베딩 기반 벡터 유사도로 Top-50 후보를 빠르게 추출
  2) Re-ranking (Cross-Encoder): 쿼리-문서 쌍을 함께 입력해 관련도를 정밀 평가하여 Top-5 선정
  3) 답변 생성 (LLM)        : 재정렬된 Top-5 문서를 근거로 Groq LPU LLM이 답변 생성

구성 요소:
  VectorDB : ChromaDB  (공용 DB ../vectordb, 컬렉션 patent_law / 8.0 인덱싱으로 구축)
  Embed    : OpenAI    text-embedding-3-small (1536차원, 인덱싱 시와 동일 모델이어야 검색 가능)
  Rerank   : dragonkue/bge-reranker-v2-m3-ko (한국어 최적화 Cross-Encoder)
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
SCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(re-ranking/)를 절대경로로 구함
RAG_DIR = SCRIPT_DIR.parent                     # hands-on/10.rag/
VECTORDB_DIR = RAG_DIR / "vectordb"             # 공용 ChromaDB 영속 디렉터리 (8.0 인덱싱 산출물)
ENV_PATH = RAG_DIR.parent / ".env"              # hands-on/.env (API 키 보관)

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

INITIAL_K = 50   # 1차 검색(Bi-Encoder)에서 넓게 가져올 후보 문서 수
RERANK_K = 5     # Re-ranking(Cross-Encoder) 후 LLM에 전달할 최종 문서 수

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
# 2. Re-ranker(Cross-Encoder) 로드
# ---------------------------------------------------------------------------

def load_reranker():
    """한국어 최적화 Cross-Encoder Re-ranker를 로드하여 반환함.

    FlagReranker: 쿼리-문서 쌍을 하나의 입력으로 받아 관련도 점수를 산출하는 Cross-Encoder 래퍼.
    Bi-Encoder(임베딩)와 달리 두 텍스트의 토큰 상호작용까지 분석해 정확도가 높음(대신 느림).
    use_fp16=True: 16비트 부동소수점으로 GPU 메모리를 절약하고 추론 속도를 높임(CUDA GPU 환경 권장).
    """
    from FlagEmbedding import FlagReranker

    print(f"  - Re-ranker 로드: {RERANKER_MODEL}")
    print("    (최초 실행 시 모델 다운로드로 수 분 소요될 수 있음)")
    return FlagReranker(RERANKER_MODEL, use_fp16=True)


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
# 4. 검색 + Re-ranking
# ---------------------------------------------------------------------------

def retrieve_initial(vectorstore, query: str) -> list:
    """1차 검색(Bi-Encoder): 벡터 유사도로 상위 INITIAL_K개 후보를 빠르게 추출함.

    similarity_search는 쿼리를 임베딩한 뒤 코사인 유사도 순으로 Document를 반환하므로,
    반환 리스트의 순서가 곧 Bi-Encoder 기준 순위(1위가 리스트 첫 원소)임.
    """
    return vectorstore.similarity_search(query, k=INITIAL_K)


def rerank_documents(reranker, query: str, docs: list, top_k: int) -> list:
    """Cross-Encoder로 1차 검색 결과를 재정렬하여 상위 top_k개를 반환함.

    반환 형식: (원래_1차순위, doc, 관련도점수) 튜플 리스트 — 1차 순위를 함께 담아
    재정렬로 순위가 어떻게 바뀌었는지(교육 목적) 출력 단계에서 비교할 수 있게 함.
    """
    if not docs:
        return []

    # Cross-Encoder 입력 형식: [쿼리, 문서본문] 쌍의 리스트
    pairs = [[query, doc.page_content] for doc in docs]

    # normalize=True: 원시 로짓을 Sigmoid로 0~1 범위 관련도 점수로 정규화함
    scores = reranker.compute_score(pairs, normalize=True)

    # 후보가 1건이면 compute_score가 float를 반환하므로 리스트로 통일함
    if isinstance(scores, float):
        scores = [scores]

    # enumerate(start=1): 1차 검색 순위를 1부터 부여해 doc·점수와 함께 묶음
    ranked = [
        (initial_rank, doc, score)
        for initial_rank, (doc, score) in enumerate(zip(docs, scores), start=1)
    ]
    # 관련도 점수 내림차순으로 정렬 후 상위 top_k개만 선택함
    ranked.sort(key=lambda item: item[2], reverse=True)
    return ranked[:top_k]


# ---------------------------------------------------------------------------
# 5. 출력 포맷팅
# ---------------------------------------------------------------------------

def _doc_label(doc) -> str:
    """문서 메타데이터(공용 DB는 source/chunk_index만 존재)를 짧은 라벨로 만듦."""
    source = doc.metadata.get("source", "알 수 없음")
    chunk_index = doc.metadata.get("chunk_index", "?")
    return f"{source} #{chunk_index}"


def print_initial_results(docs: list) -> None:
    """1차 검색(Bi-Encoder) 결과 상위 일부를 미리보기로 출력함."""
    print("\n" + "-" * 70)
    print(f"[1차 검색] Bi-Encoder Top-{len(docs)} (상위 10건 미리보기)")
    print("-" * 70)
    for rank, doc in enumerate(docs[:10], start=1):
        preview = doc.page_content[:60].replace("\n", " ")
        print(f"  {rank:2d}. {_doc_label(doc)}: {preview}...")


def print_reranked_results(reranked: list) -> None:
    """Re-ranking 결과를 출력하되, 1차 순위 → 재정렬 순위 변화를 함께 표시함."""
    print("\n" + "=" * 70)
    print(f"[Re-ranking] Cross-Encoder Top-{len(reranked)} (1차 순위 → 재정렬 순위)")
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


def run_query(vectorstore, reranker, chain, query: str) -> None:
    """질의 하나에 대해 1차 검색 → Re-ranking → 답변 생성의 전체 흐름을 수행함."""
    print(f"\n질문: {query}")

    # 1) 1차 검색 (Bi-Encoder, 넓게)
    initial_docs = retrieve_initial(vectorstore, query)
    print_initial_results(initial_docs)

    # 2) Re-ranking (Cross-Encoder, 정밀)
    reranked = rerank_documents(reranker, query, initial_docs, RERANK_K)
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
    print("특허법 RAG 예제 (Re-ranking)")
    print(f"설정: 1차 검색 Top-{INITIAL_K} → Re-ranking → Top-{RERANK_K} / LLM: {GROQ_MODEL}")
    print("=" * 70)

    print("\n[준비] 리소스 로드")
    vectorstore = load_vectorstore()
    reranker = load_reranker()
    chain = build_chain(load_llm())

    # 기본 질의어로 전체 파이프라인을 1회 시연함
    run_query(vectorstore, reranker, chain, DEFAULT_QUERY)

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
            run_query(vectorstore, reranker, chain, question)
        except Exception as error:
            print(f"\n[오류] 질의 처리 실패: {error}")


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"\n[오류] 실행 실패: {error}", file=sys.stderr)
        sys.exit(1)
