#!/usr/bin/env python3
"""LangChain 기반 Hybrid Search RAG 예제 (BM25 + Dense 결합)

8.0 인덱싱으로 구축된 공용 벡터 DB(컬렉션 `patent_law`)를 재임베딩 없이 로드하여
Sparse(BM25 키워드) 검색과 Dense(임베딩 의미) 검색을 EnsembleRetriever로 융합함.

[Naive RAG(8.1) 대비 핵심 변경 사항]
  Before: Dense Retriever 단독 (의미 유사도만 사용 → 정확한 키워드 매칭 약함)
  After : BM25(Sparse) + Dense를 EnsembleRetriever(RRF)로 결합
          → 키워드 일치(법조문 번호·전문 용어)와 의미 유사도의 장점을 모두 수용

핵심 개념:
  - Sparse Retrieval(BM25) : 키워드 출현 빈도·희귀도 기반 검색 (임베딩 불필요)
  - Dense Retrieval        : 질의를 임베딩하여 의미적으로 가까운 청크를 검색
  - Hybrid Search          : 두 검색 결과 순위를 RRF(역순위 융합)로 결합
  - 공용 DB는 벡터+원문만 저장하므로, BM25 인덱스는 DB에서 원문을 꺼내 메모리에 구축함

Embed   : OpenAI   text-embedding-3-small (1536차원, 질의 임베딩 전용)
VectorDB: ChromaDB (로컬 영속화, ../vectordb / 컬렉션 patent_law)
Sparse  : BM25Retriever (rank-bm25) + 한국어 형태소 토크나이저(kiwipiepy)
Fusion  : langchain_classic.retrievers.EnsembleRetriever (가중치 + RRF)
LLM     : Groq LPU openai/gpt-oss-120b (추론 모델, reasoning_format="hidden")

사용법:
    python app.py                       # 기본 질의어로 실행
    python app.py "특허 출원 절차는?"    # 임의 질의어로 실행
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import re
import sys
import warnings
from pathlib import Path

# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# BM25Retriever는 아직 langchain_community에만 존재하여 import 시 패키지 sunset 경고가 출력됨.
# 기능에는 영향이 없으므로 학습용 콘솔이 깔끔하도록 해당 DeprecationWarning만 숨김.
warnings.filterwarnings("ignore", message=r".*langchain-community.*sunset.*")

# ---------------------------------------------------------------------------
# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(hybrid-search/)를 절대경로로 구함
RAG_DIR = SCRIPT_DIR.parent                     # hands-on/10.rag/
VECTORDB_DIR = RAG_DIR / "vectordb"             # 공용 ChromaDB 영속화 디렉터리 (8.0 인덱싱으로 생성)
ENV_PATH = RAG_DIR.parent / ".env"              # hands-on/.env (API 키 보관)

# ---------------------------------------------------------------------------
# 환경변수 로드
# ---------------------------------------------------------------------------
from dotenv import load_dotenv

load_dotenv(ENV_PATH)  # .env에서 OPENAI_API_KEY(질의 임베딩)·GROQ_API_KEY(LLM)를 로드함

# ---------------------------------------------------------------------------
# 상수 정의
# ---------------------------------------------------------------------------
COLLECTION_NAME = "patent_law"               # 공용 벡터 DB 컬렉션명 (인덱싱과 동일해야 검색 가능)
EMBEDDING_MODEL = "text-embedding-3-small"   # 질의 임베딩 모델 (인덱싱과 반드시 동일, 1536차원)
LLM_MODEL = "openai/gpt-oss-120b"            # Groq LPU에서 서빙하는 답변 생성용 LLM
TOP_K = 5                                    # 각 검색기가 반환할 상위 청크 수

# Hybrid 가중치: 두 검색기의 RRF 점수에 곱해지는 비중 (합이 1일 필요는 없으나 관례상 1.0으로 맞춤)
# 법령 문서는 조문 번호·전문 용어 등 정확한 키워드 매칭이 중요하므로 BM25에 비중을 약간 더 둘 수도 있음.
# 본 예제는 교재 기본값인 균형 가중치(0.5/0.5)를 사용함 (README의 가중치 조정 가이드 참고).
DENSE_WEIGHT = 0.5                           # Dense(임베딩 의미 검색) 가중치
BM25_WEIGHT = 0.5                            # Sparse(BM25 키워드 검색) 가중치

DEFAULT_QUERY = "특허를 받을 수 있는 조건은 ?"  # 인자 미지정 시 사용할 기본 질의어 (교재 8.3 테스트 질의어)

# 검색된 문서에 근거해서만 답하도록 제약하는 RAG 프롬프트
# context에는 검색된 청크들이, question에는 사용자 질의어가 주입됨
SYSTEM_PROMPT = (
    "당신은 대한민국 특허법 문서를 근거로 답변하는 RAG 어시스턴트임. "
    "반드시 아래 [참고 문서]에 있는 내용만 근거로 답변하고, 문서에 없는 내용은 추측하지 말 것. "
    "근거를 찾을 수 없으면 '제공된 문서에서 관련 내용을 찾을 수 없습니다.'라고 답할 것. "
    "답변은 한국어로 간결하게 작성하고, 가능하면 근거가 된 조문을 함께 언급할 것."
)
HUMAN_PROMPT = "[참고 문서]\n{context}\n\n[질문]\n{question}\n\n[답변]"


# ---------------------------------------------------------------------------
# 1. 한국어 BM25 토크나이저 (검색 품질 향상의 핵심)
# ---------------------------------------------------------------------------

def build_bm25_tokenizer():
    """BM25용 한국어 토크나이저 함수를 생성하여 반환함.

    BM25는 텍스트를 토큰(단어) 단위로 쪼개 빈도를 세는 알고리즘임. 기본 토크나이저는
    공백 분리(text.split())라 한국어에 부적합함. 한국어는 교착어라 "특허를/특허는/특허의"가
    모두 다른 토큰이 되어 "특허" 매칭에 실패하기 때문임.
    형태소 분석기(kiwipiepy)로 "특허+를 → 특허"처럼 어근을 분리하면 키워드 매칭률이 크게 향상됨.
    kiwipiepy 미설치 시에는 정규식 기반 폴백 토크나이저를 사용해 예제가 항상 실행되도록 함.
    """
    try:
        # Kiwi: 한국어 형태소 분석기 (조사·어미를 분리하여 어근 토큰을 추출)
        from kiwipiepy import Kiwi

        kiwi = Kiwi()

        def tokenize(text: str) -> list[str]:
            # kiwi.tokenize()는 형태소 객체 리스트를 반환하며, .form이 표면형 토큰 문자열임
            return [token.form for token in kiwi.tokenize(text)]

        print("  - BM25 토크나이저: kiwipiepy 형태소 분석 (한국어 최적화)")
        return tokenize
    except Exception as error:
        # 정규식 폴백: 한글 음절 덩어리와 영숫자 덩어리만 추출 (구두점 제거로 공백 분리보다 개선)
        print(f"  - BM25 토크나이저: 정규식 폴백 사용 (kiwipiepy 미사용: {error})")
        token_pattern = re.compile(r"[가-힣]+|[a-zA-Z0-9]+")

        def tokenize(text: str) -> list[str]:
            return token_pattern.findall(text)

        return tokenize


# ---------------------------------------------------------------------------
# 2. 공용 벡터 DB 로드 + BM25용 원문 코퍼스 추출
# ---------------------------------------------------------------------------

def load_vectorstore():
    """공용 ChromaDB를 재임베딩 없이 로드하여 vectorstore를 반환함.

    Chroma(...) 생성자: from_documents(신규 인덱싱)와 달리 이미 영속화된 컬렉션을 그대로 연결함.
    embedding_function에 인덱싱과 동일한 모델을 지정해야 질의 임베딩의 의미 공간이 일치하여
    Dense 검색이 정상 동작함.
    """
    import os

    from langchain_chroma import Chroma
    from langchain_openai import OpenAIEmbeddings

    # 질의 임베딩에 OpenAI API가 필요하므로 키 부재 시 즉시 명확한 오류를 발생시킴
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError(f"OPENAI_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요")

    # 인덱싱이 선행되어야 검색 가능하므로 영속 디렉터리 존재 여부를 먼저 확인함
    if not VECTORDB_DIR.exists():
        raise FileNotFoundError(
            f"공용 벡터 DB가 없음: {VECTORDB_DIR}\n"
            f"먼저 ../indexing/indexing.py 로 인덱싱을 수행해야 함"
        )

    # OpenAIEmbeddings: 텍스트를 1536차원 벡터로 변환 (질의 임베딩에 사용, OPENAI_API_KEY 자동 참조)
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)

    # Chroma: 영속화된 벡터 컬렉션을 연결하는 LangChain 벡터 저장소 래퍼
    vectorstore = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=str(VECTORDB_DIR),
    )

    # ._collection.count(): 컬렉션에 저장된 벡터 개수. 0이면 인덱싱이 비었음을 뜻함
    count = vectorstore._collection.count()
    if count == 0:
        raise ValueError(f"벡터 DB가 비어 있음 (컬렉션 '{COLLECTION_NAME}'). 인덱싱 재실행 필요")
    print(f"  - 벡터 DB 로드 완료: {count}개 벡터 (컬렉션 '{COLLECTION_NAME}')")

    return vectorstore


def load_corpus_from_vectorstore(vectorstore) -> list:
    """벡터 DB에 저장된 원문 청크 전체를 꺼내 Document 리스트로 복원함.

    BM25는 벡터가 아니라 원문 텍스트로 인덱스를 만드는 메모리 기반 검색기임. 공용 DB는
    Dense 검색용으로 만들어졌지만 청크 원문과 메타데이터도 함께 저장하므로, 이를 그대로
    꺼내 BM25 코퍼스로 재사용함 (문서를 다시 임베딩하지 않음).
    ._collection.get(include=[...]): ChromaDB에서 임베딩을 제외한 원문·메타데이터만 일괄 조회함.
    """
    from langchain_core.documents import Document  # Document: page_content + metadata를 담는 LangChain 표준 문서 객체

    # include에 "documents"(원문)와 "metadatas"(메타데이터)만 지정해 불필요한 임베딩 전송을 피함
    records = vectorstore._collection.get(include=["documents", "metadatas"])
    contents = records.get("documents") or []
    metadatas = records.get("metadatas") or []

    # 원문과 메타데이터를 짝지어 Document로 복원함 (메타데이터가 없으면 빈 dict로 대체)
    corpus = [
        Document(page_content=content, metadata=metadata or {})
        for content, metadata in zip(contents, metadatas)
    ]
    if not corpus:
        raise ValueError("벡터 DB에서 원문 청크를 가져오지 못함. 인덱싱 결과 확인 필요")
    print(f"  - BM25 코퍼스 추출 완료: {len(corpus)}개 청크")
    return corpus


# ---------------------------------------------------------------------------
# 3. 검색기 구성 (Dense + BM25 → Hybrid)
# ---------------------------------------------------------------------------

def build_retrievers(vectorstore, corpus: list):
    """Dense·Sparse(BM25)·Hybrid(Ensemble) 세 검색기를 구성하여 반환함.

    - Dense  : vectorstore.as_retriever() → 질의 임베딩 기반 유사도 검색
    - Sparse : BM25Retriever.from_documents() → 키워드 빈도 기반 검색 (한국어 토크나이저 주입)
    - Hybrid : EnsembleRetriever → 두 검색 순위를 RRF(역순위 융합)로 결합 후 가중치 적용
    세 검색기를 모두 반환하여 동일 질의에 대한 검색 결과를 비교 출력할 수 있게 함.
    """
    from langchain_community.retrievers import BM25Retriever  # BM25Retriever: 키워드 기반 Sparse 검색기
    # EnsembleRetriever는 langchain_classic.retrievers에 위치함 (최신 langchain에서 분리됨)
    from langchain_classic.retrievers import EnsembleRetriever

    # Dense: 유사도 상위 TOP_K개 청크를 반환하도록 설정함
    dense_retriever = vectorstore.as_retriever(
        search_type="similarity",
        search_kwargs={"k": TOP_K},
    )

    # Sparse: 코퍼스로 BM25 인덱스를 메모리에 구축함. preprocess_func로 한국어 형태소 토크나이저를 주입함
    bm25_retriever = BM25Retriever.from_documents(
        corpus,
        preprocess_func=build_bm25_tokenizer(),
    )
    bm25_retriever.k = TOP_K  # BM25가 반환할 상위 청크 수

    # Hybrid: 두 검색기 결과를 가중치로 융합함
    # EnsembleRetriever 동작 원리:
    #   1) 각 검색기를 독립 실행해 순위 목록을 얻음
    #   2) RRF(Reciprocal Rank Fusion)로 순위를 점수화: score = Σ weight / (k + rank)
    #   3) 동일 문서(page_content 일치)는 점수를 합산하고 최종 점수순으로 정렬함
    hybrid_retriever = EnsembleRetriever(
        retrievers=[dense_retriever, bm25_retriever],
        weights=[DENSE_WEIGHT, BM25_WEIGHT],
    )

    return dense_retriever, bm25_retriever, hybrid_retriever


# ---------------------------------------------------------------------------
# 4. LLM 생성
# ---------------------------------------------------------------------------

def create_llm():
    """Groq LPU의 openai/gpt-oss-120b 채팅 모델을 생성하여 반환함.

    ChatGroq: Groq Cloud LPU에 채팅 요청을 보내는 LangChain 모델 래퍼 (GROQ_API_KEY 자동 참조).
    gpt-oss-120b는 추론(reasoning) 모델이라 사고 과정이 답변 본문에 섞일 수 있으므로
    reasoning_format="hidden"으로 최종 답변만 받도록 함.
    temperature=0: 동일 질의에 대해 재현 가능한(결정적) 답변을 생성하도록 함.
    """
    import os

    from langchain_groq import ChatGroq

    if not os.getenv("GROQ_API_KEY"):
        raise RuntimeError(f"GROQ_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요")

    return ChatGroq(
        model=LLM_MODEL,
        temperature=0,
        reasoning_format="hidden",  # 추론 과정을 숨기고 최종 답변 텍스트만 반환
    )


# ---------------------------------------------------------------------------
# 5. 검색 결과 → 컨텍스트 문자열 변환
# ---------------------------------------------------------------------------

def format_docs(docs: list) -> str:
    """검색된 Document 리스트를 LLM 프롬프트용 단일 문자열로 합침.

    각 청크 앞에 [출처 N] 라벨과 메타데이터(파일명·청크 번호)를 붙여
    LLM이 근거 조문을 인용하기 쉽게 하고, 출력 시 사람도 출처를 식별할 수 있게 함.
    """
    blocks = []
    for index, doc in enumerate(docs, start=1):
        source = doc.metadata.get("source", "unknown")
        chunk_index = doc.metadata.get("chunk_index", "?")
        blocks.append(f"[출처 {index}] {source} #{chunk_index}\n{doc.page_content}")
    # 청크 사이를 구분선으로 띄워 LLM이 문서 경계를 인식하기 쉽게 함
    return "\n\n---\n\n".join(blocks)


# ---------------------------------------------------------------------------
# 6. Hybrid RAG 파이프라인 (검색 → 생성)
# ---------------------------------------------------------------------------

def answer_query(query: str, retriever, llm) -> tuple[str, list]:
    """질의어로 Hybrid 검색을 수행하고 검색 결과를 근거로 LLM 답변을 생성함.

    처리 흐름:
      1. 탐색: retriever.invoke(query) → Dense+BM25 융합 결과 반환
      2. 생성: (prompt | llm | StrOutputParser) LCEL 체인에 context·question 주입
    검색 청크를 별도로 반환하여 답변과 함께 출처를 출력할 수 있게 함.
    """
    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.prompts import ChatPromptTemplate

    # 1) 탐색: Hybrid 검색기로 Dense+BM25 융합 결과를 가져옴
    docs = retriever.invoke(query)

    # 2) 생성: LCEL 파이프 연산자(|)로 프롬프트 → LLM → 문자열 파서를 연결함
    # ChatPromptTemplate.from_messages: system/human 메시지 템플릿을 묶어 프롬프트를 구성함
    prompt = ChatPromptTemplate.from_messages(
        [("system", SYSTEM_PROMPT), ("human", HUMAN_PROMPT)]
    )
    # StrOutputParser: LLM의 AIMessage 응답에서 본문 텍스트만 추출함
    chain = prompt | llm | StrOutputParser()

    # 검색된 청크를 컨텍스트 문자열로 변환해 질의어와 함께 체인에 주입함
    answer = chain.invoke({"context": format_docs(docs), "question": query})
    return answer, docs


# ---------------------------------------------------------------------------
# 7. 결과 출력 (검색 비교 + 답변)
# ---------------------------------------------------------------------------

def _doc_ids(docs: list) -> list[str]:
    """Document 리스트를 'source#chunk_index' 형태의 짧은 식별자 리스트로 변환함 (검색 비교용)."""
    ids = []
    for doc in docs:
        source = doc.metadata.get("source", "unknown")
        chunk_index = doc.metadata.get("chunk_index", "?")
        ids.append(f"{source}#{chunk_index}")
    return ids


def print_search_comparison(query: str, dense_docs: list, bm25_docs: list, hybrid_docs: list) -> None:
    """Dense·BM25·Hybrid 검색 결과를 나란히 출력해 Hybrid의 효과를 시각적으로 보여줌.

    같은 질의에 대해 세 검색기가 각각 어떤 청크를 골랐는지 비교하면, Hybrid가
    의미 검색(Dense)과 키워드 검색(BM25)의 결과를 어떻게 통합하는지 직관적으로 이해할 수 있음.
    """
    print("\n" + "=" * 70)
    print(f"[검색 비교] 질의어: {query}")
    print("=" * 70)
    print(f"  Dense (의미)   Top {len(dense_docs)}: {_doc_ids(dense_docs)}")
    print(f"  BM25  (키워드) Top {len(bm25_docs)}: {_doc_ids(bm25_docs)}")
    print(f"  Hybrid(융합)        {len(hybrid_docs)}건: {_doc_ids(hybrid_docs)}")

    # Dense·BM25 각각의 결과 집합을 만들어 Hybrid가 어느 쪽에서 가져온 청크인지 표시함
    dense_set = set(_doc_ids(dense_docs))
    bm25_set = set(_doc_ids(bm25_docs))
    both = dense_set & bm25_set
    if both:
        # 두 검색기가 공통으로 찾은 청크는 RRF에서 점수가 합산되어 상위에 오름 (Hybrid의 핵심 이득)
        print(f"  → Dense·BM25 공통 청크(점수 합산되어 상위): {sorted(both)}")


def print_result(query: str, answer: str, docs: list) -> None:
    """질의어·생성 답변·Hybrid 검색 출처를 보기 좋게 콘솔에 출력함."""
    print("\n" + "=" * 70)
    print(f"[질문] {query}")
    print("=" * 70)
    print(f"[답변]\n{answer}")
    print("\n" + "-" * 70)
    print(f"[검색 출처] {len(docs)}건 (Hybrid: Dense + BM25)")
    for index, doc in enumerate(docs, start=1):
        source = doc.metadata.get("source", "unknown")
        chunk_index = doc.metadata.get("chunk_index", "?")
        # 본문 미리보기 60자만 한 줄로 보여 어떤 청크가 근거인지 확인 가능하게 함
        snippet = doc.page_content[:60].replace("\n", " ")
        print(f"  [{index}] {source} #{chunk_index}: {snippet}...")
    print("=" * 70)


# ---------------------------------------------------------------------------
# 메인 파이프라인
# ---------------------------------------------------------------------------

def main() -> None:
    """벡터 DB 로드 → 검색기 구성 → LLM 생성 → 검색 비교·답변 → 출력 순으로 Hybrid RAG를 실행함."""
    # 명령줄 인자가 있으면 질의어로 사용하고, 없으면 기본 질의어를 사용함
    query = " ".join(sys.argv[1:]).strip() or DEFAULT_QUERY

    print("[1/4] 공용 벡터 DB 로드 (재임베딩 없음)")
    vectorstore = load_vectorstore()
    corpus = load_corpus_from_vectorstore(vectorstore)

    print("[2/4] 검색기 구성 (Dense + BM25 → Hybrid)")
    dense_retriever, bm25_retriever, hybrid_retriever = build_retrievers(vectorstore, corpus)

    print("[3/4] LLM 생성 (Groq openai/gpt-oss-120b)")
    llm = create_llm()

    print("[4/4] Hybrid 검색 + 답변 생성")
    # 비교 출력을 위해 Dense·BM25 단독 결과도 함께 조회함 (학습용; 실제 답변은 Hybrid 결과만 사용)
    dense_docs = dense_retriever.invoke(query)
    bm25_docs = bm25_retriever.invoke(query)
    answer, hybrid_docs = answer_query(query, hybrid_retriever, llm)

    print_search_comparison(query, dense_docs, bm25_docs, hybrid_docs)
    print_result(query, answer, hybrid_docs)


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # 실행 중 오류를 명확히 출력하고 비정상 종료 코드로 빠져나감
        print(f"\n[오류] Hybrid Search RAG 실행 실패: {error}", file=sys.stderr)
        sys.exit(1)
