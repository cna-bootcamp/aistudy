#!/usr/bin/env python3
"""LangChain 기반 Naive RAG 예제 (공용 벡터 DB 검색 + 답변 생성)

8.0 인덱싱으로 구축된 공용 벡터 DB(컬렉션 `patent_law`)를 재임베딩 없이 로드하여
"문의(질의 임베딩) → 탐색(유사도 검색) → 생성(LLM 답변)"의 단방향 파이프라인을 구현함.

핵심 개념:
  - Naive RAG : 검색 → 생성의 단순 구조 (Query Transformation·Re-ranking 없음)
  - Dense Retrieval : 질의를 임베딩하여 의미적으로 가까운 청크를 검색
  - 인덱싱 시 사용한 임베딩 모델(text-embedding-3-small)로 "질의"를 임베딩해야 검색이 성립함
    ("임베딩하지 않음"은 문서 재인덱싱을 하지 않는다는 의미이며, 질의 임베딩은 필요함)

Embed   : OpenAI   text-embedding-3-small (1536차원, 질의 임베딩 전용)
VectorDB: ChromaDB (로컬 영속화, ../vectordb / 컬렉션 patent_law)
LLM     : Groq LPU openai/gpt-oss-120b (추론 모델, reasoning_format="hidden")

사용법:
    python naive_rag.py                       # 기본 질의어로 실행
    python naive_rag.py "특허 출원 절차는?"    # 임의 질의어로 실행
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import sys
from pathlib import Path

# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ---------------------------------------------------------------------------
# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(naive/)를 절대경로로 구함
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
TOP_K = 5                                    # 유사도 검색으로 가져올 상위 청크 수 (Naive RAG 통상값)
DEFAULT_QUERY = "특허를 받을 수 있는 조건은 ?"  # 인자 미지정 시 사용할 기본 질의어 (교재 8.1 테스트 질의어)

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
# 1. 벡터 DB 로드 (검색기 생성)
# ---------------------------------------------------------------------------

def load_retriever():
    """공용 ChromaDB를 재임베딩 없이 로드하여 Dense Retriever를 반환함.

    Chroma(...) 생성자: from_documents(신규 인덱싱)와 달리 이미 영속화된 컬렉션을 그대로 연결함.
    embedding_function에 인덱싱과 동일한 모델을 지정해야 질의 임베딩 차원·의미 공간이 일치하여
    유사도 검색이 정상 동작함.
    as_retriever(): 벡터 저장소를 LCEL 체인에 꽂을 수 있는 Retriever 객체로 변환함.
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

    # search_kwargs={"k": TOP_K}: 유사도 상위 TOP_K개 청크만 반환하도록 설정함
    return vectorstore.as_retriever(search_kwargs={"k": TOP_K})


# ---------------------------------------------------------------------------
# 2. LLM 생성
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
# 3. 검색 결과 → 컨텍스트 문자열 변환
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
# 4. RAG 파이프라인 (문의 → 탐색 → 생성)
# ---------------------------------------------------------------------------

def answer_query(query: str, retriever, llm) -> tuple[str, list]:
    """질의어로 검색을 수행하고 검색 결과를 근거로 LLM 답변을 생성함.

    처리 흐름:
      1. 탐색: retriever.invoke(query) → 질의 임베딩 후 유사 청크 Top K 반환
      2. 생성: (prompt | llm | StrOutputParser) LCEL 체인에 context·question 주입
    검색 청크를 별도로 반환하여 답변과 함께 출처를 출력할 수 있게 함.
    """
    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.prompts import ChatPromptTemplate

    # 1) 탐색: 질의어를 임베딩하여 의미적으로 유사한 청크를 검색함
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
# 5. 결과 출력
# ---------------------------------------------------------------------------

def print_result(query: str, answer: str, docs: list) -> None:
    """질의어·생성 답변·검색 출처를 보기 좋게 콘솔에 출력함."""
    print("\n" + "=" * 70)
    print(f"[질문] {query}")
    print("=" * 70)
    print(f"[답변]\n{answer}")
    print("\n" + "-" * 70)
    print(f"[검색 출처] {len(docs)}건")
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
    """벡터 DB 로드 → LLM 생성 → 검색·답변 → 출력 순으로 Naive RAG를 실행함."""
    # 명령줄 인자가 있으면 질의어로 사용하고, 없으면 기본 질의어를 사용함
    query = " ".join(sys.argv[1:]).strip() or DEFAULT_QUERY

    print("[1/3] 공용 벡터 DB 로드 (재임베딩 없음)")
    retriever = load_retriever()

    print("[2/3] LLM 생성 (Groq openai/gpt-oss-120b)")
    llm = create_llm()

    print("[3/3] 검색 + 답변 생성")
    answer, docs = answer_query(query, retriever, llm)

    print_result(query, answer, docs)


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # 실행 중 오류를 명확히 출력하고 비정상 종료 코드로 빠져나감
        print(f"\n[오류] Naive RAG 실행 실패: {error}", file=sys.stderr)
        sys.exit(1)
