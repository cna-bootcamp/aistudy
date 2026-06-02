#!/usr/bin/env python3
"""특허법 Self-RAG 예제 (Groq LPU gpt-oss-120b)

Self-RAG 아키텍처 패턴 구현 예제임. LLM이 Reflection Token으로 RAG 워크플로우를 스스로 제어함.
공용 벡터 DB(../vectordb, 컬렉션 patent_law)를 임베딩 없이 로드하여 검색에만 활용함.

Self-RAG의 핵심 Reflection Tokens (LLM의 자기 성찰 신호):
  [Retrieve] : 외부 문서 검색이 필요한지 스스로 판단 (특허법 질문 → 검색 / 인사·타 주제 → 직접 답변)
  [IsRel]    : Is Relevant - 검색된 문서가 질문과 관련 있는지 평가 (문서 전체를 1회 LLM 호출로 일괄 평가)
  [IsSup]    : Is Supported - 생성된 답변이 문서에 근거하는지 검증 (환각 방지, 근거 없으면 엄격 재생성)
  [IsUse]    : Is Useful - 최종 답변이 유용한지 평가 (실패 시 Query Rewriting 후 처음부터 재시도)

[Naive RAG 대비 핵심 변경 사항]
  Before: 항상 검색 → 검색 결과를 그대로 컨텍스트로 사용 → 1회 생성 (자체 검증 없음)
  After : [Retrieve] 검색 필요 판단 → [IsRel] 관련성 일괄 평가 → 생성 → [IsSup] 근거성 검증
          → [IsUse] 유용성 평가 → 실패 시 Query Rewriting 후 처음부터 재시도 (최대 3회)

사전 요구사항:
  공용 벡터 DB(../vectordb)가 존재해야 함 (없으면 ../indexing/indexing.py 먼저 실행)

사용법:
  python app.py            # 대화형 챗봇 (질문 입력 → Self-RAG 처리 → 답변)
  python app.py --demo     # 교재 검증 질의 3건을 비대화형으로 순차 실행
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import os
import sys
from pathlib import Path

# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from dotenv import load_dotenv
from pydantic import BaseModel, Field

# ChatGroq: Groq LPU 채팅 모델 래퍼 (llm.invoke()로 대화 요청 전송)
from langchain_groq import ChatGroq
from langchain_chroma import Chroma                       # ChromaDB 벡터 스토어 래퍼
from langchain_openai import OpenAIEmbeddings             # OpenAI 임베딩 모델 (질의 벡터화)
from langchain_core.documents import Document             # LangChain 문서 객체 타입
from langchain_core.prompts import ChatPromptTemplate     # LLM 프롬프트 템플릿
from langchain_core.output_parsers import StrOutputParser  # LLM 출력에서 문자열만 추출

# ---------------------------------------------------------------------------
# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(self-rag/)를 절대경로로 구함
RAG_DIR = SCRIPT_DIR.parent                     # hands-on/10.rag/
VECTORDB_DIR = RAG_DIR / "vectordb"             # 공용 ChromaDB 영속 디렉터리 (indexing으로 구축)
ENV_PATH = RAG_DIR.parent / ".env"              # hands-on/.env (API 키 보관)

# .env에서 GROQ_API_KEY(LLM)·OPENAI_API_KEY(임베딩) 등 환경변수를 로드함
load_dotenv(ENV_PATH)

# ---------------------------------------------------------------------------
# 상수 정의
# ---------------------------------------------------------------------------
COLLECTION_NAME = "patent_law"               # 공용 벡터 DB 컬렉션명 (indexing과 반드시 동일해야 검색됨)
EMBEDDING_MODEL = "text-embedding-3-small"   # 인덱싱과 동일 임베딩 모델 (1536차원, 다르면 검색 불가)
LLM_MODEL = "openai/gpt-oss-120b"            # Groq LPU에서 서빙하는 OpenAI gpt-oss 120B 모델
TOP_K = 5                                    # 유사도 검색 시 가져올 문서 수
MAX_RETRIES = 3                              # [IsUse] 실패 시 Query Rewriting 재시도 최대 횟수


# ---------------------------------------------------------------------------
# Reflection Token 스키마 정의 (Pydantic)
# ---------------------------------------------------------------------------
# with_structured_output()이 아래 스키마대로 LLM 출력을 강제해 안정적으로 파싱함

class RetrieveDecision(BaseModel):
    """[Retrieve] 토큰 결과: 검색 필요 여부와 판단 근거."""
    needs_retrieval: bool = Field(description="질문에 답하기 위해 외부 문서 검색이 필요한지 여부")
    reasoning: str = Field(description="판단 근거 (한국어 한 문장)")


class RelevanceGrade(BaseModel):
    """[IsRel] 토큰 결과: 개별 문서 한 건의 관련성 평가."""
    document_index: int = Field(description="평가 대상 문서의 인덱스 (0부터 시작)")
    is_relevant: bool = Field(description="해당 문서가 질문과 관련 있는지 여부")


class BatchRelevanceGrade(BaseModel):
    """[IsRel] 토큰 결과: 여러 문서의 관련성 일괄 평가 (1회 LLM 호출로 전체 평가)."""
    results: list[RelevanceGrade] = Field(description="각 문서의 관련성 평가 결과 리스트")


class SupportGrade(BaseModel):
    """[IsSup] 토큰 결과: 답변의 근거성 평가."""
    is_supported: bool = Field(description="생성된 답변이 검색된 문서에 근거하는지 여부")
    reasoning: str = Field(description="근거성 판단 이유 (한국어 한 문장)")


class UsefulnessGrade(BaseModel):
    """[IsUse] 토큰 결과: 답변 유용성 평가."""
    is_useful: bool = Field(description="답변이 사용자 질문에 유용한지 여부")
    reasoning: str = Field(description="유용성 판단 이유 (한국어 한 문장)")


class RewrittenQuery(BaseModel):
    """Query Rewriting 결과: 검색에 최적화되도록 다시 작성된 질문."""
    rewritten_query: str = Field(description="검색에 최적화되도록 다시 작성된 질문")
    reasoning: str = Field(description="질문을 다시 작성한 이유 (한국어 한 문장)")


# ---------------------------------------------------------------------------
# LLM / 벡터 스토어 준비
# ---------------------------------------------------------------------------

def build_llm() -> ChatGroq:
    """Groq LPU의 gpt-oss-120b 모델 인스턴스를 생성함.

    temperature=0으로 고정해 Reflection 판단(구조화 출력)과 답변을 재현 가능하게 함.
    GROQ_API_KEY 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY가 설정되지 않음. hands-on/.env를 확인하세요.")
    return ChatGroq(model=LLM_MODEL, temperature=0, api_key=api_key)


def load_vectorstore() -> Chroma:
    """공용 벡터 DB를 임베딩 없이 로드함 (검색 전용).

    인덱싱과 동일한 컬렉션명(patent_law)·임베딩 모델(text-embedding-3-small)을 지정해야
    질의 벡터와 저장 벡터의 차원·의미 공간이 일치하여 검색이 정상 동작함.
    """
    if not VECTORDB_DIR.exists():
        raise FileNotFoundError(
            f"벡터 DB를 찾을 수 없음: {VECTORDB_DIR}\n"
            f"먼저 '../indexing/indexing.py'를 실행하여 공용 벡터 DB를 구축하세요."
        )

    # 질의를 1536차원 벡터로 변환 (OPENAI_API_KEY 환경변수 자동 사용)
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL, api_key=os.environ.get("OPENAI_API_KEY"))

    # persist_directory + collection_name으로 영속 DB에 접근 (세그먼트 UUID는 하드코딩하지 않음)
    return Chroma(
        persist_directory=str(VECTORDB_DIR),
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
    )


# ---------------------------------------------------------------------------
# Self-RAG 체인
# ---------------------------------------------------------------------------

class SelfRAGChain:
    """Self-RAG 워크플로우 구현체.

    처리 흐름:
      1. [Retrieve] 검색 필요 여부 판단 → 불필요 시 LLM 지식으로 직접 답변
      2. 검색 수행 (필요한 경우 TOP_K개)
      3. [IsRel] 검색 결과 관련성 일괄 평가 (1회 LLM 호출)
      4. 관련 문서 컨텍스트로 답변 생성
      5. [IsSup] 답변의 근거성 검증 → 근거 부족 시 엄격 근거 기반 재생성
      6. [IsUse] 답변의 유용성 평가 → 실패 시 Query Rewriting 후 처음부터 재시도 (최대 MAX_RETRIES회)
    """

    def __init__(self, llm: ChatGroq, vectorstore: Chroma):
        self.llm = llm
        # 코사인 유사도 기반으로 가장 유사한 TOP_K개 문서를 반환하는 검색기
        self.retriever = vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs={"k": TOP_K},
        )
        # with_structured_output: LLM 응답을 Pydantic 스키마(JSON)로 강제해 안정적으로 파싱함.
        # method="json_schema": Groq 구조화 출력(response_format)을 사용함. gpt-oss-120b는 기본
        # function_calling 모드에서 도구 이름을 잘못 생성(예: 'IsSup')해 호출이 실패할 수 있어,
        # 도구 이름이 없는 json_schema 방식으로 안정성을 확보함.
        self.retrieve_grader = llm.with_structured_output(RetrieveDecision, method="json_schema")
        self.relevance_grader = llm.with_structured_output(BatchRelevanceGrade, method="json_schema")
        self.support_grader = llm.with_structured_output(SupportGrade, method="json_schema")
        self.usefulness_grader = llm.with_structured_output(UsefulnessGrade, method="json_schema")
        self.query_rewriter = llm.with_structured_output(RewrittenQuery, method="json_schema")

    # ----- [Retrieve] -----------------------------------------------------
    def check_retrieval_need(self, question: str) -> RetrieveDecision:
        """[Retrieve] 토큰: 외부 문서 검색이 필요한지 판단함."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 질문을 분석하여 외부 문서 검색이 필요한지 판단하는 전문가입니다.

이 시스템의 외부 문서는 '특허법' 한 가지뿐입니다. 따라서 다음 기준으로 판단하세요.

[검색 필요 = True]
- 특허법, 특허 요건, 특허 출원·심사·등록, 특허권 등 특허법 관련 질문

[검색 불필요 = False]
- 일반 인사말이나 잡담 (예: 안녕하세요)
- 특허법 이외의 법률·주제 질문 (예: 개인정보보호법, 민법) — 외부 문서에 없으므로 LLM 지식으로 답변
- 단순 계산·번역 등 LLM 일반 지식으로 답변 가능한 질문

판단 근거(reasoning)는 반드시 한국어로 작성하세요."""),
            ("human", "질문: {question}\n\n이 질문에 답하기 위해 특허법 문서 검색이 필요한가요?"),
        ])
        return (prompt | self.retrieve_grader).invoke({"question": question})

    # ----- [IsRel] --------------------------------------------------------
    def grade_relevance_batch(self, question: str, documents: list[Document]) -> BatchRelevanceGrade:
        """[IsRel] 토큰: 검색된 문서들의 관련성을 1회 LLM 호출로 일괄 평가함.

        문서를 개별 호출로 평가하면 호출 수가 문서 수만큼 늘어나므로, 모든 문서를
        하나의 프롬프트로 묶어 한 번에 평가하여 비용·지연을 줄임.
        """
        # 각 문서에 인덱스를 붙여 한 덩어리 텍스트로 합침 (LLM이 인덱스로 결과를 매핑)
        docs_text = "\n\n".join(
            f"[문서 {i}]\n{doc.page_content}" for i, doc in enumerate(documents)
        )
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 검색된 문서들이 질문과 관련 있는지 평가하는 전문가입니다.

문서가 질문에 답하는 데 직접 도움이 되는 정보를 포함하면 관련 있음(True)으로 판단합니다.
부분적·간접적으로만 관련되면 관련 없음(False)으로 판단합니다.

입력된 각 문서를 그 인덱스(document_index)와 함께 개별적으로 평가하여 모두 반환하세요."""),
            ("human", "질문: {question}\n\n검색된 문서들:\n{documents}\n\n각 문서의 관련성을 평가해 주세요."),
        ])
        return (prompt | self.relevance_grader).invoke({"question": question, "documents": docs_text})

    # ----- 생성 -----------------------------------------------------------
    def generate_answer(self, question: str, context: str) -> str:
        """검색된 컨텍스트를 근거로 특허법 답변을 생성함."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 특허법 전문 법률 상담 AI입니다.

## 역할
- 주어진 컨텍스트를 기반으로 특허법 관련 질문에 답변합니다.
- 법조문을 그대로 인용하지 말고, 일반인이 이해하기 쉽도록 풀어서 설명합니다.

## 규칙
1. 법률 용어는 쉬운 말로 바꿔서 설명
2. 복잡한 조문은 핵심만 요약하여 전달
3. 컨텍스트에 없는 내용은 "해당 내용은 제공된 문서에서 찾을 수 없습니다"라고 답변

## 컨텍스트
{context}"""),
            ("human", "{question}"),
        ])
        return (prompt | self.llm | StrOutputParser()).invoke({"context": context, "question": question})

    def generate_answer_without_context(self, question: str) -> str:
        """검색 없이 LLM의 파라메트릭 지식만으로 답변을 생성함 (검색 불필요·관련 문서 없음 시)."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", "당신은 도움이 되는 한국어 AI 어시스턴트입니다. 친절하고 정확하게 답변해 주세요."),
            ("human", "{question}"),
        ])
        return (prompt | self.llm | StrOutputParser()).invoke({"question": question})

    def regenerate_with_strict_grounding(self, question: str, context: str) -> str:
        """[IsSup] 실패 시: 컨텍스트에 있는 정보만 사용하도록 엄격히 제약하여 답변을 재생성함."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 특허법 전문 법률 상담 AI입니다.

## 중요: 엄격한 근거 기반 답변
- 반드시 아래 컨텍스트에 있는 정보만 사용하여 답변하세요.
- 컨텍스트에 없는 내용은 절대 추가하지 마세요.
- 확실하지 않은 내용은 "확인되지 않음"이라고 명시하세요.

## 컨텍스트
{context}"""),
            ("human", "{question}"),
        ])
        return (prompt | self.llm | StrOutputParser()).invoke({"context": context, "question": question})

    # ----- [IsSup] --------------------------------------------------------
    def grade_support(self, answer: str, context: str) -> SupportGrade:
        """[IsSup] 토큰: 생성된 답변이 컨텍스트에 근거하는지(환각이 없는지) 검증함."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 생성된 답변이 제공된 컨텍스트에 근거하는지 평가하는 전문가입니다.

답변의 주요 주장과 정보가 컨텍스트에서 직접 확인 가능해야 근거 있음(True)입니다.
컨텍스트에 없는 정보를 추가하거나 왜곡했으면 근거 없음(False)으로 판단합니다.
판단 이유(reasoning)는 한국어로 작성하세요."""),
            ("human", "컨텍스트:\n{context}\n\n생성된 답변:\n{answer}\n\n이 답변이 컨텍스트에 근거하고 있나요?"),
        ])
        return (prompt | self.support_grader).invoke({"context": context, "answer": answer})

    # ----- [IsUse] --------------------------------------------------------
    def grade_usefulness(self, question: str, answer: str) -> UsefulnessGrade:
        """[IsUse] 토큰: 최종 답변이 사용자 질문에 유용한지 평가함."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 생성된 답변이 사용자 질문에 유용한지 평가하는 전문가입니다.

[유용함 = True]
- 질문에 직접 답하고, 내용이 명확하며 실질적으로 도움이 됨

[유용하지 않음 = False]
- 질문을 회피·모호하게 답하거나, 관련 없는 정보만 나열하거나, 너무 일반적임

판단 이유(reasoning)는 한국어로 작성하세요."""),
            ("human", "질문: {question}\n\n답변:\n{answer}\n\n이 답변이 질문에 유용하게 답하고 있나요?"),
        ])
        return (prompt | self.usefulness_grader).invoke({"question": question, "answer": answer})

    # ----- Query Rewriting -----------------------------------------------
    def rewrite_query(self, original_question: str, failed_answer: str, failure_reason: str) -> RewrittenQuery:
        """[IsUse] 실패 시: 더 나은 검색 결과를 얻도록 질문을 재작성함."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", """당신은 검색 쿼리를 최적화하는 전문가입니다.

원래 질문으로 시도했으나 유용한 답변을 생성하지 못했습니다. 더 나은 검색을 위해 질문을 다시 작성하세요.

## 재작성 전략
1. 모호한 표현을 구체적인 용어로 변환
2. 구어체를 문어체/전문 용어로 변환
3. 특허법 관련 정확한 법률 용어와 핵심 키워드를 명확히 포함

재작성 이유(reasoning)는 한국어로 작성하세요."""),
            ("human", """원래 질문: {original_question}

이전 답변(유용하지 않음): {failed_answer}

유용하지 않은 이유: {failure_reason}

더 나은 검색 결과를 위해 질문을 다시 작성해 주세요."""),
        ])
        return (prompt | self.query_rewriter).invoke({
            "original_question": original_question,
            "failed_answer": failed_answer,
            "failure_reason": failure_reason,
        })

    # ----- 오케스트레이션 -------------------------------------------------
    def invoke(self, question: str) -> dict:
        """질문 한 건에 대해 Self-RAG 전체 워크플로우를 실행함 (재시도 포함)."""
        return self._invoke_with_retry(question, original_question=question, retry_count=0, rewrites=[])

    def _invoke_with_retry(self, question: str, original_question: str, retry_count: int, rewrites: list) -> dict:
        """[Retrieve]부터 [IsUse]까지 1회 수행하고, [IsUse] 실패 시 재귀로 처음부터 재시도함.

        rewrites: 재귀 호출 사이에 공유되는 Query Rewriting 이력 누적 리스트. 재귀 프레임마다
        result를 새로 만들어도 이 리스트를 그대로 전달하여 전체 재작성 체인이 최종 결과에 남도록 함.
        """
        result = {
            "original_question": original_question,
            "current_question": question,
            "used_retrieval": False,
            "retrieved_docs": [],
            "relevant_docs": [],
            "answer": "",
            "support_grade": None,
            "usefulness_grade": None,
            "retry_count": retry_count,
            "rewritten_queries": rewrites,
        }

        if retry_count > 0:
            print(f"\n{'=' * 60}")
            print(f"[재시도 {retry_count}/{MAX_RETRIES}] Query Rewriting 후 처음부터 재시도")
            print(f"  원래 질문  : {original_question}")
            print(f"  재작성 질문: {question}")
            print(f"{'=' * 60}")

        # 1. [Retrieve] 검색 필요 여부 판단
        print("\n[Retrieve] 검색 필요 여부 판단 중...")
        decision = self.check_retrieval_need(question)
        print(f"  → 검색 필요: {decision.needs_retrieval} ({decision.reasoning})")

        if decision.needs_retrieval:
            result["used_retrieval"] = True

            # 2. 검색 수행
            print("\n[검색] 관련 문서 검색 중...")
            docs = self.retriever.invoke(question)
            result["retrieved_docs"] = docs
            print(f"  → {len(docs)}개 문서 검색됨")

            # 3. [IsRel] 관련성 일괄 평가 (1회 LLM 호출)
            print("\n[IsRel] 검색 문서 관련성 일괄 평가 중...")
            batch = self.grade_relevance_batch(question, docs)
            relevant_docs = []
            for grade in batch.results:
                # 구조화 출력이 잘못된 인덱스를 줄 수 있으므로 범위를 검사해 안전하게 매핑함
                if not 0 <= grade.document_index < len(docs):
                    continue
                mark = "관련 있음" if grade.is_relevant else "관련 없음"
                print(f"  문서 {grade.document_index + 1}: {mark}")
                if grade.is_relevant:
                    relevant_docs.append(docs[grade.document_index])
            result["relevant_docs"] = relevant_docs
            print(f"  → 관련 문서 {len(relevant_docs)}개 (1회 LLM 호출로 평가)")

            if relevant_docs:
                context = self._format_docs(relevant_docs)

                # 4. 답변 생성
                print("\n[생성] 컨텍스트 기반 답변 생성 중...")
                answer = self.generate_answer(question, context)

                # 5. [IsSup] 근거성 검증 → 실패 시 엄격 근거 기반 재생성
                print("\n[IsSup] 답변의 근거성 평가 중...")
                support = self.grade_support(answer, context)
                result["support_grade"] = support
                print(f"  → 근거 있음: {support.is_supported} ({support.reasoning})")
                if not support.is_supported:
                    print("\n[재생성] 근거 부족 → 엄격 근거 기반으로 답변 재생성 중...")
                    answer = self.regenerate_with_strict_grounding(question, context)
            else:
                # 검색은 필요했으나 관련 문서가 없으면 LLM 지식으로 답변
                print("\n[생성] 관련 문서 없음 → LLM 지식으로 답변 생성 중...")
                answer = self.generate_answer_without_context(question)
        else:
            # 검색 불필요 → 파라메트릭 지식으로 직접 답변
            print("\n[생성] 검색 불필요 → LLM 지식으로 답변 생성 중...")
            answer = self.generate_answer_without_context(question)

        result["answer"] = answer

        # 6. [IsUse] 유용성 평가 → 실패 시 Query Rewriting 후 처음부터 재시도
        print("\n[IsUse] 답변의 유용성 평가 중...")
        usefulness = self.grade_usefulness(original_question, answer)
        result["usefulness_grade"] = usefulness
        print(f"  → 유용함: {usefulness.is_useful} ({usefulness.reasoning})")

        if not usefulness.is_useful and retry_count < MAX_RETRIES:
            print("\n[Query Rewriting] 유용성 미달 → 질문 재작성 중...")
            rewritten = self.rewrite_query(original_question, answer, usefulness.reasoning)
            print(f"  → 재작성 질문: {rewritten.rewritten_query} ({rewritten.reasoning})")
            rewrites.append({
                "from": question,
                "to": rewritten.rewritten_query,
                "reasoning": rewritten.reasoning,
            })
            # 재작성한 질문으로 [Retrieve]부터 다시 실행 (처음부터 재시도). 누적 이력(rewrites)을 함께 전달함
            return self._invoke_with_retry(rewritten.rewritten_query, original_question, retry_count + 1, rewrites)

        if not usefulness.is_useful:
            print(f"\n[경고] 최대 재시도 횟수({MAX_RETRIES}회)에 도달함. 마지막 답변을 그대로 반환함.")

        return result

    def _format_docs(self, docs: list[Document]) -> str:
        """관련 문서들을 출처·청크 번호 헤더와 함께 하나의 컨텍스트 문자열로 합침."""
        formatted = []
        for i, doc in enumerate(docs, 1):
            # 공용 벡터 DB의 메타데이터 키는 source/chunk_index/total_chunks/char_count임
            source = doc.metadata.get("source", "알 수 없음")
            chunk_index = doc.metadata.get("chunk_index", "?")
            formatted.append(f"[문서 {i}] (출처: {source} #{chunk_index})\n{doc.page_content}")
        return "\n\n---\n\n".join(formatted)


# ---------------------------------------------------------------------------
# 출력 / 실행
# ---------------------------------------------------------------------------

def format_reflection_summary(result: dict) -> str:
    """Reflection Token들의 판단 결과를 한눈에 보이도록 요약 문자열로 만듦."""
    lines = ["=" * 60, "Self-RAG 처리 결과 요약", "=" * 60]
    if result.get("retry_count", 0) > 0:
        lines.append(f"[Retry ] 재시도 횟수 : {result['retry_count']}")
        lines.append(f"[Query ] 원래 질문   : {result.get('original_question', '')}")
        lines.append(f"[Query ] 최종 질문   : {result.get('current_question', '')}")
        # Query Rewriting으로 질문이 바뀐 이력을 단계별로 표시함
        for step, rewrite in enumerate(result.get("rewritten_queries", []), 1):
            lines.append(f"[Rewrite {step}] {rewrite['from']} → {rewrite['to']}")
    lines.append(f"[Retrieve] 검색 수행 : {result['used_retrieval']}")
    if result["used_retrieval"]:
        lines.append(f"[검색  ] 검색 문서   : {len(result['retrieved_docs'])}개")
        lines.append(f"[IsRel ] 관련 문서   : {len(result['relevant_docs'])}개")
    if result["support_grade"] is not None:
        lines.append(f"[IsSup ] 근거 있음   : {result['support_grade'].is_supported}")
    if result["usefulness_grade"] is not None:
        lines.append(f"[IsUse ] 유용함     : {result['usefulness_grade'].is_useful}")
    lines.append("=" * 60)
    return "\n".join(lines)


def print_result(result: dict) -> None:
    """처리 요약과 최종 답변을 콘솔에 출력함."""
    print("\n" + format_reflection_summary(result))
    print("\n" + "-" * 60)
    print("답변:")
    print("-" * 60)
    print(result["answer"])
    print("-" * 60)


def run_demo(chain: SelfRAGChain) -> None:
    """교재 검증 질의 3건을 비대화형으로 순차 실행함 (--demo)."""
    demo_questions = [
        "안녕하세요?",                       # 검색 불필요 (인사)
        "개인정보보호법의 정의와 범위는 ?",   # 검색 불필요 (특허법 외 주제)
        "특허를 받을 수 있는 조건은 ?",       # 검색 필요 (특허법)
    ]
    for idx, question in enumerate(demo_questions, 1):
        print("\n" + "#" * 60)
        print(f"# 데모 질의 {idx}/{len(demo_questions)}: {question}")
        print("#" * 60)
        print_result(chain.invoke(question))


def chat(chain: SelfRAGChain) -> None:
    """대화형 챗봇 루프를 실행함."""
    print("\n" + "=" * 60)
    print("특허법 Self-RAG 챗봇")
    print("=" * 60)
    print("검색 필요 여부를 스스로 판단하고, 답변 품질을 자체 검증합니다.")
    print("종료하려면 'quit' 또는 'q'를 입력하세요.")
    print("=" * 60 + "\n")

    while True:
        try:
            question = input("질문: ").strip()
            if not question:
                continue
            if question.lower() in ("quit", "q", "exit", "종료"):
                print("\n챗봇을 종료합니다. 감사합니다!")
                break
            print_result(chain.invoke(question))
            print()
        except KeyboardInterrupt:
            print("\n\n챗봇을 종료합니다.")
            break
        except Exception as error:
            print(f"\n오류가 발생했습니다: {error}\n")


def main() -> None:
    """벡터 DB·LLM·Self-RAG 체인을 준비하고, 모드(데모/대화형)에 따라 실행함."""
    print("\n" + "=" * 60)
    print("특허법 Self-RAG 예제 (Groq gpt-oss-120b)")
    print("=" * 60)
    try:
        vectorstore = load_vectorstore()
        print(f"벡터 DB 로드 완료: {VECTORDB_DIR} (컬렉션 {COLLECTION_NAME}, {vectorstore._collection.count()}개 청크)")
        llm = build_llm()
        chain = SelfRAGChain(llm, vectorstore)

        # 명령행 인자에 --demo가 있으면 비대화형 데모, 없으면 대화형 챗봇으로 동작함
        if "--demo" in sys.argv[1:]:
            run_demo(chain)
        else:
            chat(chain)
    except (FileNotFoundError, RuntimeError) as error:
        print(f"\n[오류] {error}", file=sys.stderr)
        sys.exit(1)


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
