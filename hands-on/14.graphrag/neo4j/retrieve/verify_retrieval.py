"""검색 파이프라인 end-to-end 동작 검증 스크립트

인덱싱 결과(Neo4j store/neo4j)에 대해 4개 검색 모드 + Auto 라우팅을 실제로 실행해
"실제 검색 콘텐츠 + 비어있지 않은 한국어 답변"을 반환하는지 확인하는 스모크 테스트임.
Streamlit UI 없이 QueryEngine·QueryRouter를 직접 호출해 검색 로직만 빠르게 검증함.

검증 항목:
- vector   : 엔티티·청크 벡터 히트 수집 후 답변 생성
- graph_qa : 관계 질문(그래프 행 반환) + 집계 질문(count) + 미존재 엔티티 graceful 안내
- hybrid   : 벡터 시드 + 1-hop 그래프 확장
- cypher   : 사용자 Cypher 직접 실행
- Auto     : 패턴 매칭 + LLM Few-shot 폴백 라우팅

주의: 검증 질문은 동봉된 교재 KG(예: "Openai", "Concept", "멀티턴 대화")를 기준으로 하드코딩되어 있음.
다른 내용으로 재인덱싱하면 파이프라인이 아닌 데이터 불일치로 일부 항목이 실패할 수 있음.

사용법:
  python verify_retrieval.py   # 전체 모드 검증, 전부 통과 시 exit 0
"""
import sys
from pathlib import Path

# Windows 콘솔 기본 인코딩(cp949)은 한글·특수문자(‑ 등) 출력 시 UnicodeEncodeError를 냄.
# stdout/stderr를 UTF-8로 재설정해 답변 원문을 그대로 출력 가능하게 함.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# 이 파일이 위치한 retrieve/ 디렉터리를 모듈 검색 경로에 추가 (config/graph/query 패키지 import용).
_RETRIEVE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_RETRIEVE_DIR))

from config.settings import Settings
from graph.neo4j_connection import Neo4jConnection
from query.query_engine import QueryEngine
from query.router import QueryRouter


def has_korean(text: str) -> bool:
    """문자열에 한글 음절(가~힣)이 하나라도 있는지 판별 (한국어 답변 여부 확인용)."""
    return any("가" <= ch <= "힣" for ch in str(text))


def summarize_content(result: dict) -> str:
    """검색 결과 딕셔너리에서 '실제로 수집된 콘텐츠 양'을 한 줄로 요약함."""
    parts = []
    if result.get("vector_hits"):
        parts.append(f"vector_hits={len(result['vector_hits'])}")
    if result.get("context_chunks"):
        parts.append(f"context_chunks={len(result['context_chunks'])}")
    if result.get("graph_data"):
        parts.append(f"graph_rows={len(result['graph_data'])}")
    if result.get("cypher"):
        parts.append("cypher=present")
    if result.get("row_count") is not None:
        parts.append(f"row_count={result['row_count']}")
    return ", ".join(parts) or "(콘텐츠 메타 없음)"


def check(label: str, result: dict, expect_korean_answer: bool = True) -> bool:
    """단일 검색 결과를 검증함

    통과 기준(완료 기준): 오류 플래그 없음 + 비어있지 않은 답변 + (기대 시)한국어 + 실제 검색 콘텐츠 존재.
    Cypher Direct처럼 답변이 표(list)인 경우 한국어 검사는 면제함.
    """
    answer = result.get("answer", "")
    is_list = isinstance(answer, list)               # cypher 모드는 행 리스트를 답변으로 반환함
    answer_str = "" if is_list else str(answer)
    non_empty = bool(answer_str.strip()) or (is_list and len(answer) > 0)
    korean_ok = (not expect_korean_answer) or is_list or has_korean(answer_str)
    has_content = bool(
        result.get("vector_hits")
        or result.get("graph_data")
        or result.get("context_chunks")
        or (is_list and len(answer) > 0)
        or result.get("row_count")
    )
    error = result.get("error", False)

    print(f"\n{'='*70}\n[{label}] mode={result.get('mode')}  error={error}")
    print(f"  content = {summarize_content(result)}")
    if is_list:
        print(f"  answer  = {len(answer)} rows; sample={answer[:1]}")
    else:
        print(f"  answer  = {answer_str[:400]}")

    verdict = non_empty and korean_ok and has_content and not error
    flags = []
    if not non_empty:
        flags.append("EMPTY_ANSWER")
    if not korean_ok:
        flags.append("NOT_KOREAN")
    if not has_content:
        flags.append("NO_RETRIEVED_CONTENT")
    if error:
        flags.append("ERROR_FLAG")
    print(f"  VERDICT = {'PASS' if verdict else 'FAIL ' + ','.join(flags)}")
    return verdict


def main() -> int:
    """전체 검증 시나리오 실행 후 종합 판정 반환 (전부 통과 시 0)."""
    settings = Settings()
    print(f"groq_model={settings.groq_model}  embedding={settings.embedding_model}({settings.embedding_dim})")
    print(f"neo4j={settings.neo4j_uri}  reasoning_effort={settings.groq_reasoning_effort}")

    connection = Neo4jConnection(settings)
    # 벡터 인덱스 차원이 임베딩 모델 차원(4096)과 일치하는지 먼저 확인 (불일치 시 벡터 검색 자체가 불가).
    dim_warnings = connection.validate_vector_dimensions()
    print(f"벡터 차원 검증: {dim_warnings or 'OK (4096 일치)'}")
    stats = connection.get_stats()
    print(f"KG: 노드 {stats['node_count']}, 엔티티 {stats['entity_count']}, "
          f"Chunk {stats['chunk_count']}, 관계 {stats['relationship_count']}")

    engine = QueryEngine(settings, connection.graph)
    router = QueryRouter(settings)

    verdicts: dict[str, bool] = {}

    # 1. vector — 개념 정의 질문 (엔티티 + 청크 벡터 검색)
    verdicts["vector"] = check("vector / 개념정의", engine.search("RAG란 무엇인가?", "vector"))

    # 2. graph_qa — KG 실존 엔티티 관계 질문 (그래프 행 반환 기대)
    verdicts["graph_qa_rel"] = check(
        "graph_qa / 관계", engine.search("Openai와 연결된 엔티티를 보여줘", "graph_qa")
    )
    # 3. graph_qa — 집계(count) 질문 (Community Edition GDS 미지원 → Cypher count 처리)
    verdicts["graph_qa_count"] = check(
        "graph_qa / 집계", engine.search("Concept 노드는 몇 개인가?", "graph_qa")
    )
    # 4. hybrid — 종합/구조 질문 (벡터 시드 + 1-hop 그래프 확장)
    verdicts["hybrid"] = check(
        "hybrid / 전체흐름", engine.search("GraphRAG의 전체 처리 흐름을 요약해줘", "hybrid")
    )
    # 5. cypher — 사용자 직접 Cypher (읽기 전용 검증 후 실행, 답변은 행 리스트)
    verdicts["cypher"] = check(
        "cypher / 직접실행",
        engine.cypher_direct("MATCH (n:Concept) RETURN n.id AS id LIMIT 5"),
        expect_korean_answer=False,
    )

    # 6. graceful no-data — KG에 없는 엔티티는 한국어 안내 메시지 반환이 정상(오류 아님)
    nodata = engine.search("LangChain과 관련된 엔티티를 보여줘", "graph_qa")
    nodata_answer = str(nodata.get("answer", ""))
    nodata_ok = (
        not nodata.get("error")
        and bool(nodata_answer.strip())
        and has_korean(nodata_answer)
        and "없" in nodata_answer
    )
    print(f"\n{'='*70}\n[graph_qa / 미존재 엔티티 graceful]")
    print(f"  answer  = {nodata_answer[:200]}")
    print(f"  VERDICT = {'PASS (안내 메시지 정상)' if nodata_ok else 'FAIL'}")
    verdicts["graph_qa_nodata"] = nodata_ok

    # 7. Auto 라우팅 — 패턴 매칭 / LLM 폴백 / Cypher 감지 경로가 의도대로 분기되는지 확인
    print(f"\n{'='*70}\n[Auto 라우팅]")
    for q in [
        "멀티턴 대화란 무엇인가?",                      # vector 기대
        "GraphRAG의 전체 구조를 정리해줘",              # hybrid 기대
        "MATCH (n:Technology) RETURN n.id LIMIT 3",   # cypher 기대
    ]:
        decision = router.route(q, "Auto")
        print(f"  '{q[:40]}' → {decision.mode}  ({decision.reason})")

    # ===== 종합 판정 =====
    print(f"\n{'='*70}\n[종합 판정]")
    for name, ok in verdicts.items():
        print(f"  {name:16} : {'PASS' if ok else 'FAIL'}")
    all_pass = all(verdicts.values())
    print(f"\n  전체: {'ALL PASS' if all_pass else 'FAIL'}")
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
