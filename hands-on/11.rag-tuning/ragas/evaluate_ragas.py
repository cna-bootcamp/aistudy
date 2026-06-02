#!/usr/bin/env python3
"""청킹 사이즈를 변화시키며 naive RAG 품질을 RAGAS로 평가·비교하는 예제

인덱싱 파라미터(청크 크기)를 바꿔가며 동일한 테스트셋으로 RAG를 실행하고,
RAGAS 메트릭으로 검색·생성 품질을 측정하여 최적 청킹 사이즈를 도출함.
교재 1. 핵심 원칙(한 번에 하나의 변수만 변경)과 2.5 파라미터 최적화(RAGAS + Grid Search)의 구체적 구현임.

[8.1 RAGAS 평가 예제 대비 핵심 변경 사항]
  Before: 공용 벡터 DB(../vectordb)를 재임베딩 없이 로드하여 1회 평가
  After : chunk_size 후보별로 PDF를 재청킹·임베딩(임시 DB)하여 N회 평가 후 비교 → 최적값 선정

평가 변수 / 고정 조건 (교재 1. 핵심 원칙):
  - 변화 변수 : chunk_size (예: 400 / 800 / 1200)
  - 고정 규칙 : chunk_overlap = int(chunk_size * 0.2)  (청킹 사이즈의 20%)
  - 고정 조건 : 임베딩 모델·LAW_SEPARATORS·top_k·생성 LLM은 전부 동일

LLM 구성 (생성용과 평가용을 혼동하지 말 것):
  - RAG 생성 LLM   : Groq LPU openai/gpt-oss-120b (naive_rag.py와 동일하게 재사용)
  - RAGAS 평가자 LLM: OpenAI gpt-4o-mini
  - RAGAS 임베딩    : OpenAI text-embedding-3-small (인덱싱과 동일)

사용법:
    python evaluate_ragas.py                          # 기본 후보(400,800,1200) 전체(검색+생성) 평가
    python evaluate_ragas.py --retrieval              # 검색 메트릭만 평가
    python evaluate_ragas.py --generation             # 생성 메트릭만 평가
    python evaluate_ragas.py --chunk-sizes 500,1000   # 후보 재정의
    python evaluate_ragas.py --limit 3                # 테스트 케이스 수 제한(저비용 스모크 테스트)
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import gc
import json
import shutil
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ---------------------------------------------------------------------------
# RAGAS 호환 셰임 (langchain 1.x 상위 호환성 깨짐 우회) — 반드시 `import ragas` 이전에 실행
# ---------------------------------------------------------------------------
# ragas는 모듈 로드 시 langchain_community.chat_models.vertexai.ChatVertexAI를 무조건 import하지만,
# langchain-community 1.x에서 해당 경로가 제거되어 `import ragas` 자체가 실패함. 본 예제의 평가 경로는
# Vertex AI를 전혀 사용하지 않으므로, 실제로 인스턴스화되지 않는 더미 클래스를 주입해 import만 성립시킴.
import types

_VERTEXAI_SHIM_MODULE = "langchain_community.chat_models.vertexai"
try:
    __import__(_VERTEXAI_SHIM_MODULE)  # 경로가 살아 있으면(구버전) 셰임 불필요
except ModuleNotFoundError:
    _shim_module = types.ModuleType(_VERTEXAI_SHIM_MODULE)
    # ragas가 참조만 하고 호출하지 않는 빈 더미 클래스 (이름만 존재하면 import 성립)
    _shim_module.ChatVertexAI = type("ChatVertexAI", (), {})
    sys.modules[_VERTEXAI_SHIM_MODULE] = _shim_module

# ---------------------------------------------------------------------------
# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(ragas/)를 절대경로로 구함
RAG_DIR = SCRIPT_DIR.parent                     # hands-on/10.rag/
DATA_DIR = RAG_DIR / "data"                     # 인덱싱 대상 PDF 디렉터리
INDEXING_DIR = RAG_DIR / "indexing"             # 인덱싱 파이프라인(전처리·분할 로직 재사용 대상)
NAIVE_DIR = RAG_DIR / "naive"                   # naive RAG 예제(생성 파이프라인 재사용 대상)
PUBLIC_VECTORDB_DIR = RAG_DIR / "vectordb"      # 공용 벡터 DB (절대 건드리지 않음, 보호 대상)
ENV_PATH = RAG_DIR.parent / ".env"              # hands-on/.env (API 키 보관)
RESULTS_DIR = SCRIPT_DIR / "results"            # 평가 결과 저장 디렉터리

# 재사용 모듈을 import 하기 위해 각 디렉터리를 모듈 검색 경로 맨 앞에 추가함
# (SCRIPT_DIR을 먼저 넣어 ragas/test_dataset.py가 우선 선택되도록 함)
for module_dir in (SCRIPT_DIR, INDEXING_DIR, NAIVE_DIR):
    # sys.path.insert(0, ...): 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 디렉터리를 추가함
    sys.path.insert(0, str(module_dir))

# ---------------------------------------------------------------------------
# 환경변수 로드
# ---------------------------------------------------------------------------
from dotenv import load_dotenv

load_dotenv(ENV_PATH)  # .env에서 OPENAI_API_KEY(임베딩·평가자)·GROQ_API_KEY(생성 LLM)를 로드함

# ---------------------------------------------------------------------------
# 재사용 모듈 import (인덱싱·생성 로직을 그대로 가져와 "동일 조건"을 보장)
# ---------------------------------------------------------------------------
# indexing.py: PDF 로드·전처리·노이즈 필터·메타데이터 로직과 법령 분할 구분자를 재사용함
# (단, build_vectordb()는 shutil.rmtree로 공용 DB를 삭제하므로 절대 import·호출하지 않음)
from indexing import (
    EMBEDDING_MODEL,        # "text-embedding-3-small" (인덱싱과 동일한 임베딩 모델)
    LAW_SEPARATORS,         # 법령 구조(조→항) 우선 분할 구분자
    attach_metadata,        # 청크에 source/chunk_index 등 메타데이터 부여
    filter_chunks,          # 머리글·개정 태그만 담긴 노이즈 청크 제거
    load_pdfs,              # data 디렉터리의 PDF를 Document 리스트로 로드
    preprocess_documents,   # 머리글·페이지번호 등 노이즈 제거(청크 크기와 무관, 1회만 수행)
)

# naive_rag.py: 검색→생성 파이프라인을 그대로 재사용 (RAG 생성 LLM·프롬프트가 naive와 동일해야 함)
from naive_rag import (
    HUMAN_PROMPT,    # [참고 문서]/[질문] 형식의 사용자 프롬프트 템플릿
    SYSTEM_PROMPT,   # 검색 문서 근거로만 답하도록 제약하는 시스템 프롬프트
    TOP_K,           # 유사도 검색 상위 청크 수 (고정 조건)
    create_llm,      # Groq openai/gpt-oss-120b 채팅 모델 생성 (reasoning_format="hidden")
    format_docs,     # 검색 청크를 [출처 N] 라벨이 붙은 단일 문자열로 변환
)

# test_dataset.py(11.1): 특허법.pdf 조문 대조로 작성한 질문·정답 테스트 케이스
from test_dataset import get_test_dataset

# ---------------------------------------------------------------------------
# 상수 정의
# ---------------------------------------------------------------------------
EVAL_LLM_MODEL = "gpt-4o-mini"               # RAGAS 평가자 LLM (생성 LLM과 별개, OpenAI)
DEFAULT_CHUNK_SIZES = [400, 800, 1200]       # 기본 chunk_size 후보 (스윕 대상)
OVERLAP_RATIO = 0.2                          # chunk_overlap = chunk_size * 0.2 (20% 고정)
COLLECTION_PREFIX = "patent_law_cs"          # 임시 컬렉션명 접두사 (예: patent_law_cs400)

# RAGAS 결과 컬럼명 ↔ 사람이 읽는 메트릭명 매핑 (메트릭 그룹별로 구분)
# 키는 result.to_pandas()의 컬럼명, 값은 출력용 한글 라벨임
RETRIEVAL_METRIC_LABELS = {
    "llm_context_precision_with_reference": "Context Precision",  # 검색 청크가 정답과 관련 있는 비율
    "context_recall": "Context Recall",                            # 정답에 필요한 정보가 검색되었는지
    "context_entity_recall": "Context Entity Recall",              # 정답의 핵심 엔티티가 검색되었는지
}
GENERATION_METRIC_LABELS = {
    "faithfulness": "Faithfulness",          # 답변이 검색 컨텍스트에 근거하는지(환각 여부)
    "answer_relevancy": "Answer Relevancy",  # 답변이 질문과 관련 있는지
    "factual_correctness": "Factual Correctness",  # 답변이 정답과 사실적으로 일치하는지
}


# ---------------------------------------------------------------------------
# 1. 인덱싱 (chunk_size별 임시 벡터 DB 구축)
# ---------------------------------------------------------------------------

def split_documents_with(documents: list, chunk_size: int, chunk_overlap: int) -> list:
    """chunk_size·chunk_overlap을 인자로 받아 문서를 청크로 분할함.

    indexing.py의 split_documents()는 모듈 상수 CHUNK_SIZE/CHUNK_OVERLAP을 읽어 고정 크기로만
    분할하므로 스윕에 사용할 수 없음. 동일한 LAW_SEPARATORS를 쓰되 크기만 파라미터화한 분할기임.
    """
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    # RecursiveCharacterTextSplitter: separators를 앞에서부터 순서대로 적용하며
    # chunk_size 이하가 될 때까지 재귀적으로 분할하는 분할기
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=LAW_SEPARATORS,
    )
    return splitter.split_documents(documents)


def build_temp_index(chunks: list, chunk_size: int) -> tuple:
    """청크를 임베딩하여 임시 디렉터리에 ChromaDB로 저장하고 (vectorstore, 임시경로)를 반환함.

    공용 벡터 DB 보호: persist_directory를 OS 임시 폴더(%TEMP%)로 지정하고 컬렉션명도 고유하게 두어
    공용 DB(../vectordb)를 절대 덮어쓰지 않음. 평가 후 cleanup_temp_index()로 정리함.
    Chroma.from_documents: 문서 리스트를 임베딩하여 새 컬렉션에 저장하는 LangChain 헬퍼.
    """
    from langchain_chroma import Chroma
    from langchain_openai import OpenAIEmbeddings

    # tempfile.mkdtemp: OS 임시 폴더 안에 고유한 빈 디렉터리를 만들고 그 경로를 반환함
    temp_dir = Path(tempfile.mkdtemp(prefix=f"ragas_cs{chunk_size}_"))

    # 방어 장치: 어떤 경우에도 임시 경로가 공용 DB 경로와 겹치면 즉시 중단함 (공용 DB 파괴 방지)
    if temp_dir.resolve() == PUBLIC_VECTORDB_DIR.resolve():
        raise RuntimeError("임시 인덱스 경로가 공용 벡터 DB 경로와 동일함 — 중단")

    collection_name = f"{COLLECTION_PREFIX}{chunk_size}"  # 예: patent_law_cs400
    # OpenAIEmbeddings: 텍스트를 1536차원 벡터로 변환 (인덱싱과 동일 모델, OPENAI_API_KEY 자동 참조)
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)

    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        collection_name=collection_name,
        persist_directory=str(temp_dir),
    )
    return vectorstore, temp_dir


def cleanup_temp_index(vectorstore, temp_dir: Path) -> None:
    """임시 벡터 DB의 파일 핸들을 해제하고 임시 디렉터리를 삭제함.

    Windows에서는 ChromaDB(SQLite)가 파일 핸들을 즉시 놓지 않아 rmtree가 PermissionError를 낼 수 있음.
    참조를 끊고 gc로 회수한 뒤 몇 차례 재시도하며, 끝내 실패해도 경고만 남기고 스윕을 계속 진행함
    (임시 폴더는 OS가 정리하므로 무해함).
    """
    try:
        # 내부 SQLite 클라이언트 연결을 끊어 파일 핸들을 조기에 반환하도록 시도함
        vectorstore._client._system.stop()  # type: ignore[attr-defined]
    except Exception:
        pass
    del vectorstore
    # gc.collect(): 더 이상 참조되지 않는 객체를 즉시 회수해 열린 파일 핸들을 해제함
    gc.collect()

    # rmtree를 짧은 간격으로 최대 3회 재시도 (핸들 반환 지연 흡수)
    for attempt in range(3):
        try:
            shutil.rmtree(temp_dir)
            return
        except (PermissionError, OSError):
            time.sleep(0.5)
    print(f"  - (경고) 임시 인덱스 정리 실패, OS 임시 폴더에 잔존: {temp_dir}")


# ---------------------------------------------------------------------------
# 2. RAG 파이프라인 실행 (검색 → 생성)
# ---------------------------------------------------------------------------

def build_rag_chain(llm):
    """naive RAG와 동일한 프롬프트 구성으로 (프롬프트 | LLM | 파서) LCEL 체인을 만듦.

    naive_rag.py의 SYSTEM_PROMPT·HUMAN_PROMPT를 그대로 사용해 생성 조건을 동일하게 맞춤.
    """
    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.prompts import ChatPromptTemplate

    # ChatPromptTemplate.from_messages: system/human 메시지 템플릿을 묶어 프롬프트를 구성함
    prompt = ChatPromptTemplate.from_messages(
        [("system", SYSTEM_PROMPT), ("human", HUMAN_PROMPT)]
    )
    # StrOutputParser: LLM의 AIMessage 응답에서 본문 텍스트만 추출함
    return prompt | llm | StrOutputParser()


def run_rag_pipeline(questions: list[str], retriever, chain) -> list[dict]:
    """각 질문에 대해 검색→생성을 수행하고 (질문·검색컨텍스트·답변) 리스트를 반환함.

    RAGAS는 검색된 컨텍스트(retrieved_contexts)와 생성 답변(response)을 입력으로 받으므로
    질문마다 둘을 모아 둠. 검색 청크 원문만 contexts로 추출함(메트릭이 텍스트 단위로 계산).
    """
    results = []
    total = len(questions)
    for index, question in enumerate(questions, start=1):
        # 진행 상황 표시 (질문이 길 수 있으므로 앞 40자만)
        print(f"    [{index}/{total}] {question[:40]}...")

        # 1) 탐색: 질의어를 임베딩하여 의미적으로 유사한 청크 Top K 검색
        docs = retriever.invoke(question)
        contexts = [doc.page_content for doc in docs]

        # 2) 생성: 검색 청크를 컨텍스트로 주입해 답변 생성 (Groq 호출, 일시적 오류 시 재시도)
        response = invoke_with_retry(chain, {"context": format_docs(docs), "question": question})

        results.append({"question": question, "contexts": contexts, "response": response})
    return results


def invoke_with_retry(chain, payload: dict, max_retries: int = 3):
    """LLM 체인 호출을 일시적 오류(예: Groq rate limit) 발생 시 지수 백오프로 재시도함.

    다수 질문을 연속 생성하면 분당 요청 한도에 걸릴 수 있어, 잠시 대기 후 재시도하여
    스윕 전체가 한 번의 일시 오류로 중단되지 않게 함.
    """
    for attempt in range(max_retries):
        try:
            return chain.invoke(payload)
        except Exception as error:
            # 마지막 시도까지 실패하면 호출자에게 예외를 그대로 전달함
            if attempt == max_retries - 1:
                raise
            wait = 2 ** attempt  # 1초 → 2초 → 4초로 대기 시간을 늘림
            print(f"    - (재시도 {attempt + 1}/{max_retries}) 생성 오류: {error} — {wait}초 대기")
            time.sleep(wait)


# ---------------------------------------------------------------------------
# 3. RAGAS 평가
# ---------------------------------------------------------------------------

def select_metrics(eval_type: str) -> list:
    """평가 유형(all/retrieval/generation)에 맞는 RAGAS 메트릭 인스턴스 목록을 반환함.

    검색 메트릭은 모두 reference(정답) 기반으로 구성해 chunk_size의 "검색" 효과를 분리 측정함.
    특히 Context Precision은 생성 답변이 아닌 정답을 기준으로 하는 WithReference 버전을 사용함
    (WithoutReference는 생성 품질이 섞여 청킹 비교를 흐림).
    """
    from ragas.metrics import (
        ContextEntityRecall,                # 정답 엔티티가 검색되었는지 (검색)
        FactualCorrectness,                 # 답변과 정답의 사실 일치도 (생성)
        Faithfulness,                       # 답변이 컨텍스트에 근거하는지 (생성)
        LLMContextPrecisionWithReference,   # 검색 청크가 정답과 관련 있는 비율 (검색, reference 기준)
        LLMContextRecall,                   # 정답에 필요한 정보가 검색되었는지 (검색)
        ResponseRelevancy,                  # 답변이 질문과 관련 있는지 (생성)
    )

    retrieval_metrics = [
        LLMContextPrecisionWithReference(),
        LLMContextRecall(),
        ContextEntityRecall(),
    ]
    generation_metrics = [
        Faithfulness(),
        ResponseRelevancy(),
        FactualCorrectness(),
    ]

    if eval_type == "retrieval":
        return retrieval_metrics
    if eval_type == "generation":
        return generation_metrics
    return retrieval_metrics + generation_metrics


def evaluate_chunk_size(rag_results: list[dict], ground_truths: list[str], metrics: list,
                        eval_llm_wrapper, eval_embeddings_wrapper):
    """단일 chunk_size의 RAG 실행 결과를 RAGAS로 평가하고 평가 결과 객체를 반환함.

    SingleTurnSample: 한 질문에 대한 입력(질문·검색컨텍스트·답변·정답)을 담는 RAGAS 표준 샘플.
    EvaluationDataset: 샘플들을 묶은 평가 데이터셋. evaluate()가 메트릭별 점수를 계산함.
    """
    from ragas import EvaluationDataset, SingleTurnSample, evaluate

    samples = []
    for result, ground_truth in zip(rag_results, ground_truths):
        sample = SingleTurnSample(
            user_input=result["question"],           # 질문
            retrieved_contexts=result["contexts"],    # 검색된 청크 원문 리스트
            response=result["response"],              # RAG가 생성한 답변
            reference=ground_truth,                   # 정답(ground_truth)
        )
        samples.append(sample)

    dataset = EvaluationDataset(samples=samples)
    # evaluate: 각 샘플·메트릭에 대해 평가자 LLM/임베딩을 호출해 점수를 산출함
    return evaluate(
        dataset=dataset,
        metrics=metrics,
        llm=eval_llm_wrapper,
        embeddings=eval_embeddings_wrapper,
    )


def extract_scores(result) -> dict[str, float]:
    """RAGAS 평가 결과에서 메트릭별 평균 점수 딕셔너리를 추출함 (버전 호환 방식).

    result.to_pandas(): 질문×메트릭 점수를 담은 DataFrame. 입력 컬럼을 제외한 메트릭 컬럼만
    골라 NaN을 제외하고 평균을 냄. RAGAS 버전에 따라 점수 접근 API가 달라 DataFrame 평균이 안전함.
    """
    import pandas as pd

    df = result.to_pandas()
    # 입력 컬럼(질문·컨텍스트·답변·정답)을 제외한 나머지를 메트릭 컬럼으로 간주함
    input_columns = {"user_input", "retrieved_contexts", "response", "reference"}
    scores: dict[str, float] = {}
    for column in df.columns:
        if column in input_columns:
            continue
        mean_value = df[column].dropna().mean()  # NaN(평가 실패 샘플)을 빼고 평균
        if not pd.isna(mean_value):
            # 일부 메트릭은 컬럼명에 모드 접미사가 붙음(예: "factual_correctness(mode=f1)").
            # 라벨 매핑·선정 로직의 키와 맞추기 위해 괄호 이후를 떼어 정규화함.
            key = column.split("(")[0]
            scores[key] = float(mean_value)
    return scores


def compute_selection_score(scores: dict[str, float], eval_type: str) -> float | None:
    """최적 chunk_size 선정용 종합 점수를 계산함.

    선정 기준(교재: chunk_size는 검색 품질에 직접 영향):
      - 검색 메트릭이 있으면 검색 메트릭(reference 기반 3종) 평균을 종합 점수로 사용함
      - 생성만 평가한 경우에는 생성 메트릭 평균을 사용함
    """
    if eval_type in ("all", "retrieval"):
        target_keys = RETRIEVAL_METRIC_LABELS.keys()
    else:
        target_keys = GENERATION_METRIC_LABELS.keys()

    # 존재하는 메트릭 점수만 모아 평균 (일부 메트릭이 빠져도 계산 가능)
    values = [scores[key] for key in target_keys if key in scores]
    if not values:
        return None
    return sum(values) / len(values)


# ---------------------------------------------------------------------------
# 4. 결과 출력 및 저장
# ---------------------------------------------------------------------------

def print_scores(chunk_size: int, chunk_overlap: int, scores: dict[str, float]) -> None:
    """단일 chunk_size의 메트릭 점수를 검색/생성 그룹으로 나눠 콘솔에 출력함."""
    print(f"\n  [chunk_size={chunk_size}, overlap={chunk_overlap}] 점수")
    for label_map, group_name in (
        (RETRIEVAL_METRIC_LABELS, "검색"),
        (GENERATION_METRIC_LABELS, "생성"),
    ):
        # 해당 그룹에서 실제 계산된 메트릭만 출력함
        group_scores = {k: scores[k] for k in label_map if k in scores}
        if not group_scores:
            continue
        print(f"    - {group_name}: " + ", ".join(
            f"{label_map[k]} {v:.4f}" for k, v in group_scores.items()
        ))


def print_comparison(comparison: list[dict], best_chunk_size: int | None, eval_type: str) -> None:
    """chunk_size별 종합 점수와 최적값을 비교 표로 출력함."""
    print("\n" + "=" * 70)
    print("청킹 사이즈별 비교 결과")
    print("=" * 70)
    criterion = "검색 메트릭 평균" if eval_type in ("all", "retrieval") else "생성 메트릭 평균"
    print(f"선정 기준: {criterion} (chunk_size는 검색 품질에 직접 영향)")
    print("-" * 70)
    print(f"  {'chunk_size':>11} | {'overlap':>7} | {'종합점수':>8} | 비고")
    print("-" * 70)
    for row in comparison:
        score = row["selection_score"]
        score_text = f"{score:.4f}" if score is not None else "   N/A"
        mark = " ← 최적" if row["chunk_size"] == best_chunk_size else ""
        print(f"  {row['chunk_size']:>11} | {row['chunk_overlap']:>7} | {score_text:>8} |{mark}")
    print("=" * 70)
    if best_chunk_size is not None:
        print(f"최적 청킹 사이즈: {best_chunk_size} (overlap={int(best_chunk_size * OVERLAP_RATIO)})")


def save_results(run_dir: Path, comparison: list[dict], detail_frames: dict,
                 best_chunk_size: int | None, eval_type: str) -> None:
    """chunk_size별 summary(JSON)·detail(CSV)와 전체 비교 요약을 results/ 하위에 저장함."""
    run_dir.mkdir(parents=True, exist_ok=True)

    # 1) chunk_size별 개별 결과 저장
    for row in comparison:
        size = row["chunk_size"]
        # summary(JSON): 파라미터 + 메트릭 점수 + 종합 점수
        summary_path = run_dir / f"cs{size}_summary.json"
        with open(summary_path, "w", encoding="utf-8") as f:  # with 블록을 벗어나면 파일이 자동으로 닫힘
            json.dump(row, f, ensure_ascii=False, indent=2)
        # detail(CSV): 질문별 메트릭 점수 (utf-8-sig로 저장해 Excel 한글 깨짐 방지)
        detail_frames[size].to_csv(run_dir / f"cs{size}_detail.csv", index=False, encoding="utf-8-sig")

    # 2) 전체 비교 요약 저장
    comparison_summary = {
        "eval_type": eval_type,
        "overlap_ratio": OVERLAP_RATIO,
        "best_chunk_size": best_chunk_size,
        "results": comparison,
    }
    with open(run_dir / "comparison.json", "w", encoding="utf-8") as f:
        json.dump(comparison_summary, f, ensure_ascii=False, indent=2)

    # 비교 표를 CSV로도 저장 (chunk_size를 행, 메트릭을 열로)
    import pandas as pd

    flat_rows = []
    for row in comparison:
        flat = {"chunk_size": row["chunk_size"], "chunk_overlap": row["chunk_overlap"]}
        flat.update(row["scores"])           # 메트릭 점수 전개
        flat["selection_score"] = row["selection_score"]
        flat_rows.append(flat)
    pd.DataFrame(flat_rows).to_csv(run_dir / "comparison.csv", index=False, encoding="utf-8-sig")

    print(f"\n결과 저장 위치: {run_dir}")
    print("  - chunk_size별: csXXX_summary.json, csXXX_detail.csv")
    print("  - 전체 비교   : comparison.json, comparison.csv")


# ---------------------------------------------------------------------------
# 5. 인자 파싱
# ---------------------------------------------------------------------------

def parse_args(argv: list[str]) -> dict:
    """명령줄 인자를 파싱하여 평가 유형·chunk_size 후보·케이스 제한을 결정함."""
    options = {"eval_type": "all", "chunk_sizes": DEFAULT_CHUNK_SIZES, "limit": None}

    if "--retrieval" in argv:
        options["eval_type"] = "retrieval"
    elif "--generation" in argv:
        options["eval_type"] = "generation"

    # --chunk-sizes 400,800,1200 형식 파싱
    if "--chunk-sizes" in argv:
        value = argv[argv.index("--chunk-sizes") + 1]
        options["chunk_sizes"] = [int(s) for s in value.split(",") if s.strip()]

    # --limit N: 저비용 스모크 테스트용으로 테스트 케이스 수를 N개로 제한
    if "--limit" in argv:
        options["limit"] = int(argv[argv.index("--limit") + 1])

    return options


# ---------------------------------------------------------------------------
# 메인 파이프라인
# ---------------------------------------------------------------------------

def main() -> None:
    """PDF 1회 로드·전처리 → chunk_size별 (재청킹·임베딩·RAG·RAGAS 평가) 반복 → 비교·저장."""
    options = parse_args(sys.argv[1:])
    eval_type = options["eval_type"]
    chunk_sizes = options["chunk_sizes"]
    limit = options["limit"]

    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from ragas.llms import LangchainLLMWrapper

    print("=" * 70)
    print("RAGAS 청킹 사이즈 스윕 평가")
    print(f"  평가 유형 : {eval_type}  |  chunk_size 후보 : {chunk_sizes}  |  overlap : 20% 고정")
    print("=" * 70)

    # 1) 테스트 데이터셋 로드 (질문·정답)
    test_cases = get_test_dataset()
    if limit is not None:
        test_cases = test_cases[:limit]  # 스모크 테스트: 앞 N개만 사용
    questions = [case["question"] for case in test_cases]
    ground_truths = [case["ground_truth"] for case in test_cases]
    print(f"\n[준비] 테스트 케이스 {len(test_cases)}개 로드")

    # 2) PDF 로드·전처리는 chunk_size와 무관하므로 1회만 수행함 (임베딩 비용 외 중복 작업 제거)
    print("[준비] PDF 로드 및 전처리 (1회)")
    documents = preprocess_documents(load_pdfs(DATA_DIR))
    print(f"  - 전처리 후 페이지 수: {len(documents)}")

    # 3) 생성 LLM(Groq)·평가자 LLM(OpenAI)·평가 임베딩을 준비함 (스윕 내내 고정)
    print("[준비] 생성 LLM(Groq) · 평가자 LLM(OpenAI gpt-4o-mini) 초기화")
    rag_chain = build_rag_chain(create_llm())          # 생성: naive와 동일한 Groq 모델
    eval_llm_wrapper = LangchainLLMWrapper(             # 평가자: OpenAI gpt-4o-mini
        ChatOpenAI(model=EVAL_LLM_MODEL, temperature=0)
    )
    eval_embeddings_wrapper = LangchainEmbeddingsWrapper(
        OpenAIEmbeddings(model=EMBEDDING_MODEL)        # 평가 임베딩: 인덱싱과 동일 모델
    )
    metrics = select_metrics(eval_type)

    # 4) chunk_size 후보별로 인덱싱→RAG→평가를 반복함
    comparison: list[dict] = []
    detail_frames: dict[int, object] = {}
    for chunk_size in chunk_sizes:
        chunk_overlap = int(chunk_size * OVERLAP_RATIO)  # 오버랩 = 청킹 사이즈의 20%
        print("\n" + "-" * 70)
        print(f"[chunk_size={chunk_size}] overlap={chunk_overlap} — 인덱싱→RAG→평가")

        # 4-1) 재청킹 → 노이즈 필터 → 메타데이터 부여 (indexing.py 로직 재사용)
        chunks = attach_metadata(filter_chunks(split_documents_with(documents, chunk_size, chunk_overlap)))
        print(f"  - 생성된 청크 수: {len(chunks)}")

        # 4-2) 임시 벡터 DB 구축 (공용 DB는 건드리지 않음)
        vectorstore, temp_dir = build_temp_index(chunks, chunk_size)
        try:
            retriever = vectorstore.as_retriever(search_kwargs={"k": TOP_K})

            # 4-3) RAG 파이프라인 실행 (검색 → 생성)
            print("  - RAG 실행 (검색 → 생성)")
            rag_results = run_rag_pipeline(questions, retriever, rag_chain)

            # 4-4) RAGAS 평가
            print("  - RAGAS 평가 (평가자 LLM 호출, 시간 소요)")
            result = evaluate_chunk_size(
                rag_results, ground_truths, metrics, eval_llm_wrapper, eval_embeddings_wrapper
            )
        finally:
            # 평가가 끝났거나 오류가 나도 임시 인덱스는 반드시 정리 시도함
            cleanup_temp_index(vectorstore, temp_dir)

        # 4-5) 점수 집계
        scores = extract_scores(result)
        selection_score = compute_selection_score(scores, eval_type)
        print_scores(chunk_size, chunk_overlap, scores)

        comparison.append({
            "chunk_size": chunk_size,
            "chunk_overlap": chunk_overlap,
            "num_chunks": len(chunks),
            "scores": scores,
            "selection_score": selection_score,
        })
        detail_frames[chunk_size] = result.to_pandas()

    # 5) 최적 chunk_size 선정 (종합 점수 최대) 및 출력·저장
    scored_rows = [row for row in comparison if row["selection_score"] is not None]
    best_chunk_size = (
        max(scored_rows, key=lambda r: r["selection_score"])["chunk_size"] if scored_rows else None
    )
    print_comparison(comparison, best_chunk_size, eval_type)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    save_results(RESULTS_DIR / timestamp, comparison, detail_frames, best_chunk_size, eval_type)


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # 실행 중 오류를 명확히 출력하고 비정상 종료 코드로 빠져나감
        print(f"\n[오류] RAGAS 평가 실패: {error}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)
