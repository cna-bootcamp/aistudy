"""Step-Back 기법 RAG 예제 (Query Transformation)

구체적인 질문을 한 단계 추상화한 일반 질문으로 바꿔, 추상 질문(배경 지식)과
원본 질문(구체 정보) 양쪽으로 검색해 폭넓은 컨텍스트를 확보하는 예제임.

핵심 흐름: 원본 질문 → (LLM 추상화) → Step-Back 질문 + 원본 질문 → 각각 검색 → 병합 → 답변 생성
LLM: Groq LPU openai/gpt-oss-120b / 임베딩: OpenAI text-embedding-3-small (검색 시점에만 사용)
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import argparse
import os
import sys
from pathlib import Path
from typing import List

# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from dotenv import load_dotenv
from langchain_chroma import Chroma  # ChromaDB 벡터 스토어를 다루는 LangChain 래퍼
from langchain_openai import OpenAIEmbeddings  # OpenAI 임베딩 모델 (쿼리를 벡터로 변환)
from langchain_groq import ChatGroq  # Groq LPU 채팅 모델 래퍼 (llm.invoke()로 호출)
from langchain_core.documents import Document  # LangChain 표준 문서 객체
from langchain_core.prompts import ChatPromptTemplate  # LLM 프롬프트 템플릿 생성기
from langchain_core.output_parsers import StrOutputParser  # LLM 응답에서 문자열만 추출하는 파서

# ---------------------------------------------------------------------------
# 경로·상수 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)
# ---------------------------------------------------------------------------
# 이 파일 위치: hands-on/10.rag/query-transformation/step-back/app.py
SCRIPT_DIR = Path(__file__).resolve().parent       # 이 파일이 위치한 디렉터리 절대경로
VECTORDB_DIR = SCRIPT_DIR.parents[1] / "vectordb"  # hands-on/10.rag/vectordb (공용 벡터 DB)
ENV_PATH = SCRIPT_DIR.parents[2] / ".env"          # hands-on/.env (API 키 보관)

COLLECTION_NAME = "patent_law"               # 인덱싱 시 사용한 공용 컬렉션명 (반드시 일치해야 검색 가능)
EMBEDDING_MODEL = "text-embedding-3-small"   # 인덱싱과 동일한 임베딩 모델 (1536차원, 쿼리 임베딩용)
GROQ_MODEL = "openai/gpt-oss-120b"           # Groq LPU에서 제공하는 LLM
TOP_K = 5                                    # 검색 시 가져올 청크 수
TEST_QUERY = "특허 어떻게 받어?"               # 기본 데모/테스트 질의어

load_dotenv(ENV_PATH)  # .env에서 OPENAI_API_KEY·GROQ_API_KEY 등을 환경변수로 로드함

SYSTEM_PROMPT = """당신은 특허법 전문 법률 상담 AI입니다.

## 역할
- 주어진 컨텍스트를 기반으로 특허법 관련 질문에 답변합니다.
- 법조문을 그대로 인용하지 말고, 일반인이 이해하기 쉽도록 풀어서 설명합니다.

## 규칙
1. 법률 용어는 쉬운 말로 바꿔서 설명
2. 복잡한 조문은 핵심만 요약하여 전달
3. 컨텍스트에 없는 내용은 "해당 내용은 제공된 문서에서 찾을 수 없습니다"라고 답변

## 답변 형식
1. **쉬운 설명**: 질문에 대한 이해하기 쉬운 답변
2. **근거 조문**: 반드시 명시 (예: 특허법 제42조 제2항)
3. **참고사항**: 관련 정보나 주의할 점 (있는 경우)

## 컨텍스트
{context}
"""


# ---------------------------------------------------------------------------
# LLM·벡터 스토어 준비
# ---------------------------------------------------------------------------

def get_llm() -> ChatGroq:
    """Groq LPU의 openai/gpt-oss-120b 모델로 ChatGroq 인스턴스를 생성함."""
    api_key = os.environ.get("GROQ_API_KEY")
    # API 키 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함
    if not api_key:
        raise RuntimeError("GROQ_API_KEY가 설정되지 않음 (hands-on/.env 확인)")
    # ChatGroq: temperature 0.3으로 약간의 표현 다양성 허용, 최대 2048토큰 응답
    return ChatGroq(model=GROQ_MODEL, temperature=0.3, max_tokens=2048, api_key=api_key)


def load_vectorstore() -> Chroma:
    """공용 벡터 DB를 임베딩(재인덱싱) 없이 로드함.

    인덱싱 때와 동일한 컬렉션명(patent_law)·임베딩 모델(text-embedding-3-small)을
    지정해야 저장된 246개 벡터를 정상 검색할 수 있음. 컬렉션명을 빠뜨리면 ChromaDB가
    기본 컬렉션(langchain)을 새로 만들어 빈 검색 결과를 반환하므로 주의함.
    """
    if not VECTORDB_DIR.exists():
        raise FileNotFoundError(
            f"공용 벡터 DB를 찾을 수 없음: {VECTORDB_DIR}\n"
            f"hands-on/10.rag/indexing/indexing.py를 먼저 실행해 인덱싱을 수행하세요."
        )
    # OpenAIEmbeddings: 쿼리 문자열을 1536차원 벡터로 변환 (검색 시점에만 사용)
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL, api_key=os.environ.get("OPENAI_API_KEY"))
    print(f"공용 벡터 DB 로드: {VECTORDB_DIR} (컬렉션: {COLLECTION_NAME})")
    return Chroma(
        collection_name=COLLECTION_NAME,
        persist_directory=str(VECTORDB_DIR),
        embedding_function=embeddings,
    )


def get_retriever(vectorstore: Chroma):
    """코사인 유사도 기반으로 상위 TOP_K개 청크를 반환하는 검색기를 생성함."""
    return vectorstore.as_retriever(search_type="similarity", search_kwargs={"k": TOP_K})


# ---------------------------------------------------------------------------
# 공통 유틸 (포맷팅·중복 제거)
# ---------------------------------------------------------------------------

def format_docs(docs: List[Document]) -> str:
    """검색된 문서들을 LLM 컨텍스트용 문자열로 합침."""
    formatted = []
    for i, doc in enumerate(docs, 1):
        source = doc.metadata.get("source", "알 수 없음")
        chunk_index = doc.metadata.get("chunk_index", "?")
        formatted.append(f"[문서 {i}] {source} (청크 #{chunk_index})\n{doc.page_content}")
    return "\n\n---\n\n".join(formatted)


def format_chunks_for_display(docs: List[Document]) -> str:
    """검색된 청크를 콘솔 표시용으로 미리보기 형태로 포맷팅함."""
    lines = []
    for i, doc in enumerate(docs, 1):
        source = doc.metadata.get("source", "알 수 없음")
        chunk_index = doc.metadata.get("chunk_index", "?")
        # 청크 본문은 처음 150자만 미리보기로 표시함
        preview = doc.page_content[:150].replace("\n", " ")
        if len(doc.page_content) > 150:
            preview += "..."
        lines.append(f"[청크 {i}] {source} (#{chunk_index})\n  {preview}")
    return "\n".join(lines)


def deduplicate_docs(docs: List[Document]) -> List[Document]:
    """본문 내용이 동일한 중복 문서를 제거하여 고유 문서만 남김."""
    seen = set()
    unique = []
    for doc in docs:
        # 본문 해시로 동일 청크 여부를 판단함
        key = hash(doc.page_content)
        if key not in seen:
            seen.add(key)
            unique.append(doc)
    return unique


def create_llm_chain(llm):
    """프롬프트 → LLM → 문자열 추출로 이어지는 LCEL 답변 체인을 생성함."""
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "{question}"),
    ])
    # LCEL(|) 파이프: 프롬프트 렌더 → ChatGroq 호출 → StrOutputParser로 문자열만 추출
    return prompt | llm | StrOutputParser()


# ===========================================================================
# Step-Back 기법 (이 예제의 핵심)
# ===========================================================================

def step_back(llm, question: str) -> str:
    """구체적 질문을 한 단계 추상화한 일반적 질문으로 변환함 (Step-Back).

    세부 사례를 더 넓은 개념/원칙 수준의 질문으로 바꿔, 배경 지식이 담긴 문서까지
    함께 검색하도록 함.
    """
    step_back_prompt = ChatPromptTemplate.from_template("""당신은 법률 문서 검색을 위한 질문 분석 전문가입니다.

주어진 구체적인 질문에서 한 단계 뒤로 물러나, 더 일반적이고 추상적인 질문을 생성하세요.

## Step-Back 규칙:
1. 구체적 세부사항 → 일반적 원칙/개념
2. 특정 사례 → 해당 법률 영역의 기본 개념
3. 한 문장으로 작성

## 예시:
- 원본: "특허 출원 시 명세서에 무엇을 기재해야 하나요?"
- Step-Back: "특허 출원에 필요한 서류와 그 요건은 무엇인가요?"

## 원본 질문:
{question}

## Step-Back 질문:""")
    # 프롬프트 → LLM → 문자열 추출 체인으로 추상화된 질문을 얻음
    chain = step_back_prompt | llm | StrOutputParser()
    return chain.invoke({"question": question}).strip()


def retrieve_with_transformation(vectorstore: Chroma, llm, question: str):
    """추상화 질문과 원본 질문으로 각각 검색한 결과를 합쳐 배경+구체 문서를 모두 확보함."""
    retriever = get_retriever(vectorstore)
    step_back_q = step_back(llm, question)
    # 추상화 질문(배경 지식)과 원본 질문(구체 정보) 양쪽으로 검색함
    step_back_docs = retriever.invoke(step_back_q)
    original_docs = retriever.invoke(question)
    docs = deduplicate_docs(step_back_docs + original_docs)[:TOP_K]
    info = {"original": question, "step_back": step_back_q}
    return docs, info


def display_transform_info(info: dict) -> None:
    """원본 질문과 추상화된 Step-Back 질문을 표시함."""
    print("\n" + "=" * 60)
    print("Step-Back (추상화 질문)")
    print("=" * 60)
    print(f"원본 질문      : {info['original']}")
    print(f"Step-Back 질문 : {info['step_back']}")
    print("=" * 60)


# ---------------------------------------------------------------------------
# 질의 응답 파이프라인
# ---------------------------------------------------------------------------

def answer_question(vectorstore: Chroma, llm, llm_chain, question: str) -> None:
    """Query Transformation → 검색 → 컨텍스트 주입 → 답변 생성의 전체 흐름을 수행하고 출력함."""
    print("\nQuery Transformation 적용 중...")
    docs, info = retrieve_with_transformation(vectorstore, llm, question)

    display_transform_info(info)

    print("\n" + "=" * 60)
    print(f"검색된 청크 ({len(docs)}개)")
    print("=" * 60)
    print(format_chunks_for_display(docs))
    print("=" * 60)

    print("\n답변 생성 중...\n")
    context = format_docs(docs)
    response = llm_chain.invoke({"context": context, "question": question})
    print("-" * 60)
    print(response)
    print("-" * 60)


def run_once(vectorstore: Chroma, llm, llm_chain, question: str) -> None:
    """one-shot 모드: 질의 한 건을 처리하고 종료함 (비대화형 테스트·데모용)."""
    print("\n" + "=" * 60)
    print(f"[one-shot] 질의어: {question}")
    print("=" * 60)
    answer_question(vectorstore, llm, llm_chain, question)


def chat(vectorstore: Chroma, llm, llm_chain) -> None:
    """대화형 챗봇 루프 (입력이 없을 때까지 반복)."""
    print("\n" + "=" * 60)
    print("Step-Back RAG 챗봇")
    print("=" * 60)
    print("특허법에 대해 질문하세요. 종료하려면 'quit' 또는 'q' 입력.")
    print("=" * 60 + "\n")
    while True:
        try:
            question = input("질문: ").strip()
            if not question:
                continue
            if question.lower() in ["quit", "q", "exit", "종료"]:
                print("\n챗봇을 종료합니다.")
                break
            answer_question(vectorstore, llm, llm_chain, question)
            print()
        # EOFError: 비대화형(파이프) 실행 시 input()이 던지는 예외 — 무한 루프 방지를 위해 종료함
        except (KeyboardInterrupt, EOFError):
            print("\n\n챗봇을 종료합니다.")
            break
        except Exception as e:
            print(f"\n오류가 발생했습니다: {e}\n")


# ---------------------------------------------------------------------------
# 엔트리 포인트
# ---------------------------------------------------------------------------

def main() -> None:
    """--query 인자가 있으면 one-shot, 없으면 대화형으로 실행함."""
    parser = argparse.ArgumentParser(description="Step-Back Query Transformation RAG 예제")
    # --query 지정 시 비대화형 1회 실행 (자동 테스트·데모에 사용)
    parser.add_argument("--query", type=str, default=None, help="one-shot 질의어 (미지정 시 대화형 모드)")
    parser.add_argument("--demo", action="store_true", help="기본 테스트 질의어로 one-shot 실행")
    args = parser.parse_args()

    try:
        vectorstore = load_vectorstore()
        llm = get_llm()
        llm_chain = create_llm_chain(llm)
    except (FileNotFoundError, RuntimeError) as e:
        print(f"\n[오류] {e}")
        sys.exit(1)

    if args.demo:
        run_once(vectorstore, llm, llm_chain, TEST_QUERY)
    elif args.query is not None:
        run_once(vectorstore, llm, llm_chain, args.query)
    else:
        chat(vectorstore, llm, llm_chain)


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
