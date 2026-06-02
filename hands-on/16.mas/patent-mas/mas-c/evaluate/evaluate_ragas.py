#!/usr/bin/env python3
"""MAS C 오프라인 품질 검증 (RAGAS 배치) — 런타임 경로 밖, 강사/회귀 검증용.

[런타임과의 분리 — 매우 중요]
  이 스크립트는 '배포 런타임'이 아님. RAGAS·OpenAI 평가자(gpt-4o-mini)는 여기서만 import 함.
  별도 venv(evaluate/requirements.txt)에 설치해 배포 런타임을 순수 gpt-oss-120b 로 유지함.

[무엇을 측정하나]
  - Faithfulness (reference-free)        : MAS C 답변(초안)이 검색 컨텍스트에 근거하는지 = 답변 환각률
  - Context Precision (WithReference)·Recall : MAS A 검색(특허법 벡터 인덱스)의 품질 (정답 reference 필요)
  왜 인라인 게이트로 안 쓰나: Context Precision 은 정답이 필요하고 RAGAS 는 배치 도구라 매 요청
  저지연 게이트로 부적합함. 런타임 게이트는 Self-RAG [IsSup] + verify_citations 가 담당함.

[파이프라인]  (11.rag-tuning/ragas 재사용 — 단, 청크사이즈 스윕 없이 고정 검색)
  테스트셋(질문+정답) → patent_law 벡터 검색(MAS A 프록시) → MAS C 초안 생성(런타임과 동일 프롬프트)
  → EvaluationDataset → evaluate(Faithfulness, ContextPrecisionWithReference, ContextRecall)

사용법(evaluate 전용 venv 활성화 후, mas-c 디렉터리에서):
  python -m evaluate.evaluate_ragas --smoke         # 2케이스 스모크 테스트(저비용)
  python -m evaluate.evaluate_ragas --limit 5       # 앞 5케이스
  python -m evaluate.evaluate_ragas                 # 전체(22케이스, 비용·시간 큼)
"""

from __future__ import annotations

import sys
import types
from datetime import datetime
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ---------------------------------------------------------------------------
# RAGAS 호환 셰임 (langchain 1.x 상위 호환 깨짐 우회) — 반드시 `import ragas` 이전에 실행
# ---------------------------------------------------------------------------
# ragas 는 로드 시 langchain_community.chat_models.vertexai.ChatVertexAI 를 무조건 import 하지만,
# langchain-community 1.x 에서 해당 경로가 제거되어 `import ragas` 자체가 실패함. 본 평가 경로는
# Vertex AI 를 쓰지 않으므로, 인스턴스화되지 않는 더미 클래스를 주입해 import 만 성립시킴.
_VERTEXAI_SHIM = "langchain_community.chat_models.vertexai"
try:
    __import__(_VERTEXAI_SHIM)
except ModuleNotFoundError:
    _mod = types.ModuleType(_VERTEXAI_SHIM)
    _mod.ChatVertexAI = type("ChatVertexAI", (), {})
    sys.modules[_VERTEXAI_SHIM] = _mod

# ---------------------------------------------------------------------------
# 경로 설정
# ---------------------------------------------------------------------------
# evaluate/ → [0]=evaluate, [1]=mas-c, [2]=patent-mas, [3]=16.mas, [4]=hands-on
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent                 # mas-c/ (config.settings·graph.prompts import 용)
HANDS_ON_DIR = SCRIPT_DIR.parents[3]            # hands-on/
VECTORDB_DIR = HANDS_ON_DIR / "10.rag" / "vectordb"  # 공용 특허법 벡터 DB (MAS A 검색 프록시)
ENV_PATH = HANDS_ON_DIR / ".env"
RESULTS_DIR = SCRIPT_DIR / "results"

sys.path.insert(0, str(PROJECT_DIR))  # mas-c 루트를 모듈 경로에 추가 (config·graph 패키지 import)

from dotenv import load_dotenv

load_dotenv(ENV_PATH)  # OPENAI_API_KEY(검색·평가) · GROQ_API_KEY(생성) 로드

from config import settings              # 런타임 LLM 설정 재사용 (gpt-oss-120b, hidden)
from graph.prompts import DRAFT_SYSTEM_PROMPT  # 런타임과 동일한 초안 작성 시스템 프롬프트 (측정 대표성)
from evaluate.test_dataset import get_test_dataset  # 11.rag-tuning 검증 테스트셋 재사용

# ---------------------------------------------------------------------------
# 상수
# ---------------------------------------------------------------------------
COLLECTION_NAME = "patent_law"            # 공용 벡터 DB 컬렉션 (인덱싱과 동일해야 검색됨)
EMBEDDING_MODEL = "text-embedding-3-small"  # 인덱싱과 동일 임베딩(1536d), 검색·평가 공용
EVAL_LLM_MODEL = "gpt-4o-mini"            # RAGAS 평가자 LLM (생성 LLM과 별개, OpenAI)
DEFAULT_TOP_K = 5                         # 검색 상위 청크 수 (MAS A 검색 프록시)

INPUT_COLUMNS = {"user_input", "retrieved_contexts", "response", "reference"}
METRIC_LABELS = {
    "faithfulness": "Faithfulness (답변 환각률, reference-free)",
    "llm_context_precision_with_reference": "Context Precision (MAS A 검색, WithReference)",
    "context_recall": "Context Recall (MAS A 검색)",
}


# ---------------------------------------------------------------------------
# 검색 (MAS A 프록시) · 생성 (MAS C 초안)
# ---------------------------------------------------------------------------

def load_retriever(top_k: int):
    """공용 patent_law 벡터 DB를 읽기 전용으로 로드해 검색기를 반환함 (MAS A 검색 프록시)."""
    from langchain_chroma import Chroma
    from langchain_openai import OpenAIEmbeddings

    if not VECTORDB_DIR.exists():
        raise FileNotFoundError(
            f"벡터 DB를 찾을 수 없음: {VECTORDB_DIR}\n"
            f"hands-on/10.rag/indexing 으로 patent_law 인덱스를 먼저 구축하세요."
        )
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)
    store = Chroma(persist_directory=str(VECTORDB_DIR),
                   collection_name=COLLECTION_NAME, embedding_function=embeddings)
    return store.as_retriever(search_type="similarity", search_kwargs={"k": top_k})


def build_generator():
    """MAS C 초안 생성 체인을 만듦 (런타임과 동일: Groq gpt-oss-120b + DRAFT_SYSTEM_PROMPT)."""
    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_groq import ChatGroq

    llm = ChatGroq(
        model=settings.LLM_MODEL, temperature=settings.LLM_TEMPERATURE,
        reasoning_format=settings.LLM_REASONING_FORMAT, max_retries=settings.LLM_MAX_RETRIES,
    )
    prompt = ChatPromptTemplate.from_messages([
        ("system", DRAFT_SYSTEM_PROMPT), ("human", "{question}"),
    ])
    return prompt | llm | StrOutputParser()


def format_contexts(docs: list) -> str:
    """검색된 특허법 청크들을 초안 작성용 단일 컨텍스트 문자열로 합침."""
    blocks = []
    for i, doc in enumerate(docs, 1):
        source = doc.metadata.get("source", "특허법")
        chunk = doc.metadata.get("chunk_index", "?")
        blocks.append(f"=== 법령 ===\n[법령 {i}] (출처: {source} #{chunk})\n{doc.page_content}")
    return "\n\n".join(blocks) if blocks else "(검색 컨텍스트 없음)"


def run_pipeline(test_cases: list[dict], retriever, generator) -> list[dict]:
    """각 케이스에 대해 검색 → MAS C 초안 생성을 수행하고 RAGAS 입력 레코드를 모음."""
    records = []
    total = len(test_cases)
    for idx, case in enumerate(test_cases, 1):
        question = case["question"]
        print(f"  [{idx}/{total}] {question[:42]}...")
        docs = retriever.invoke(question)
        contexts = [doc.page_content for doc in docs]
        response = generator.invoke({
            "history": "(이전 대화 없음)",          # 오프라인 평가는 단발 질문(멀티턴 없음)
            "context": format_contexts(docs),
            "question": question,
        })
        records.append({
            "question": question, "contexts": contexts,
            "response": response, "reference": case["ground_truth"],
        })
    return records


# ---------------------------------------------------------------------------
# RAGAS 평가
# ---------------------------------------------------------------------------

def evaluate_records(records: list[dict]):
    """레코드를 RAGAS EvaluationDataset 으로 묶어 3개 메트릭으로 평가함."""
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    from ragas import EvaluationDataset, SingleTurnSample, evaluate
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from ragas.llms import LangchainLLMWrapper
    from ragas.metrics import (
        Faithfulness,                       # 답변이 컨텍스트에 근거하는지 (생성, reference-free)
        LLMContextPrecisionWithReference,   # 검색 청크가 정답과 관련 있는 비율 (검색, reference)
        LLMContextRecall,                   # 정답에 필요한 정보가 검색되었는지 (검색, reference)
    )

    samples = [SingleTurnSample(
        user_input=r["question"], retrieved_contexts=r["contexts"],
        response=r["response"], reference=r["reference"],
    ) for r in records]

    eval_llm = LangchainLLMWrapper(ChatOpenAI(model=EVAL_LLM_MODEL, temperature=0))
    eval_emb = LangchainEmbeddingsWrapper(OpenAIEmbeddings(model=EMBEDDING_MODEL))
    metrics = [Faithfulness(), LLMContextPrecisionWithReference(), LLMContextRecall()]
    return evaluate(dataset=EvaluationDataset(samples=samples), metrics=metrics,
                    llm=eval_llm, embeddings=eval_emb)


def extract_scores(result) -> dict[str, float]:
    """RAGAS 결과에서 메트릭별 평균 점수를 추출함 (입력 컬럼 제외, NaN 제외 평균)."""
    import pandas as pd

    df = result.to_pandas()
    scores: dict[str, float] = {}
    for column in df.columns:
        if column in INPUT_COLUMNS:
            continue
        mean = df[column].dropna().mean()
        if not pd.isna(mean):
            scores[column.split("(")[0]] = float(mean)
    return scores


def save_results(run_dir: Path, scores: dict[str, float], result, num_cases: int) -> None:
    """메트릭 요약(JSON)과 케이스별 상세(CSV)를 results/타임스탬프/ 에 저장함."""
    import json

    run_dir.mkdir(parents=True, exist_ok=True)
    summary = {"num_cases": num_cases, "metrics": scores,
               "eval_llm": EVAL_LLM_MODEL, "gen_llm": settings.LLM_MODEL}
    with open(run_dir / "summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    result.to_pandas().to_csv(run_dir / "detail.csv", index=False, encoding="utf-8-sig")
    print(f"\n결과 저장: {run_dir}  (summary.json · detail.csv)")


# ---------------------------------------------------------------------------
# 메인
# ---------------------------------------------------------------------------

def parse_args(argv: list[str]) -> dict:
    """명령줄 인자 파싱: --smoke(2케이스) / --limit N / --top-k K."""
    options = {"limit": None, "top_k": DEFAULT_TOP_K}
    if "--smoke" in argv:
        options["limit"] = 2  # 저비용 스모크 테스트
    if "--limit" in argv:
        options["limit"] = int(argv[argv.index("--limit") + 1])
    if "--top-k" in argv:
        options["top_k"] = int(argv[argv.index("--top-k") + 1])
    return options


def main() -> None:
    options = parse_args(sys.argv[1:])
    print("=" * 70)
    print("MAS C 오프라인 RAGAS 평가 (런타임 경로 밖 — 배치 품질 검증)")
    print(f"  생성 LLM: {settings.LLM_MODEL} (런타임 동일)  |  평가자 LLM: {EVAL_LLM_MODEL}")
    print(f"  검색: patent_law (top-k={options['top_k']}, MAS A 프록시)")
    print("=" * 70)

    test_cases = get_test_dataset()
    if options["limit"] is not None:
        test_cases = test_cases[:options["limit"]]
    print(f"\n[준비] 테스트 케이스 {len(test_cases)}개")

    print("[준비] 검색기 로드 + 생성기(Groq) 초기화")
    retriever = load_retriever(options["top_k"])
    generator = build_generator()

    print("\n[1/2] 검색 → MAS C 초안 생성")
    records = run_pipeline(test_cases, retriever, generator)

    print("\n[2/2] RAGAS 평가 (평가자 LLM 호출, 시간 소요)")
    result = evaluate_records(records)
    scores = extract_scores(result)

    print("\n" + "=" * 70)
    print("RAGAS 점수")
    print("=" * 70)
    for key, label in METRIC_LABELS.items():
        if key in scores:
            print(f"  - {label}: {scores[key]:.4f}")
    print("=" * 70)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    save_results(RESULTS_DIR / timestamp, scores, result, len(test_cases))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001
        print(f"\n[오류] RAGAS 평가 실패: {error}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)
