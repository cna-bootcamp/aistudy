"""검색 서비스 end-to-end 동작 검증 (인-프로세스).

MCP 전송 계층 없이 SearchService.answer()를 직접 호출해 "요청 접수 → 검색방법 결정 →
검색 → LLM 답변" 흐름이 실제 KG/벡터 DB와 Groq LLM에 대해 동작하는지 빠르게 점검함.

완료(PASS) 기준: 오류 플래그 없음 + 비어있지 않은 답변(+기대 시 한국어) + 실제 검색 콘텐츠 존재.
주의: 검증 질문은 동봉된 교재 KG(예: "RAG", "Concept", "GraphRAG")를 기준으로 작성됨.

사용법:
  python test_e2e.py   # 전체 시나리오 검증, 전부 통과 시 exit 0
"""
import sys
from pathlib import Path

# Windows 콘솔 기본 인코딩(cp949)은 한글 출력 시 UnicodeEncodeError를 냄 → UTF-8로 재설정.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# 이 파일이 위치한 프로젝트 디렉터리를 모듈 검색 경로에 추가함.
_PROJECT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_PROJECT_DIR))

from search_service import SearchService


def has_korean(text: str) -> bool:
    """문자열에 한글 음절(가~힣)이 하나라도 있는지 판별 (한국어 답변 여부 확인용)."""
    return any("가" <= ch <= "힣" for ch in str(text))


def check(label: str, result: dict, expect_korean: bool = True) -> bool:
    """단일 검색 결과를 검증하고 PASS/FAIL을 출력함."""
    answer = result.get("answer", "")
    is_list = isinstance(answer, list)  # cypher 모드는 행 리스트를 답변으로 반환함
    answer_str = "" if is_list else str(answer)
    non_empty = bool(answer_str.strip()) or (is_list and len(answer) > 0)
    korean_ok = (not expect_korean) or is_list or has_korean(answer_str)
    has_content = bool(
        result.get("vector_hits")
        or result.get("graph_data")
        or result.get("context_chunks")
        or (is_list and len(answer) > 0)
        or result.get("row_count")
    )
    error = result.get("error", False)

    print(f"\n{'='*72}\n[{label}]")
    print(f"  requested={result.get('requested_mode')}  resolved={result.get('resolved_mode')}"
          f"  reason={result.get('route_reason')}")
    print(f"  sources={result.get('sources', [])[:3]}")
    if is_list:
        print(f"  answer = {len(answer)} rows; sample={answer[:1]}")
    else:
        print(f"  answer = {answer_str[:300]}")

    verdict = non_empty and korean_ok and has_content and not error
    flags = []
    if not non_empty:
        flags.append("EMPTY_ANSWER")
    if not korean_ok:
        flags.append("NOT_KOREAN")
    if not has_content:
        flags.append("NO_CONTENT")
    if error:
        flags.append("ERROR_FLAG")
    print(f"  VERDICT = {'PASS' if verdict else 'FAIL ' + ','.join(flags)}")
    return verdict


def main() -> int:
    """전체 검증 시나리오 실행 후 종합 판정 반환 (전부 통과 시 0)."""
    service = SearchService()
    health = service.health()
    print(f"model={health['groq_model']}  embedding={health['embedding_model']}")
    print(f"KG: 노드 {health['node_count']}, 엔티티 {health['entity_count']}, "
          f"Chunk {health['chunk_count']}, 관계 {health['relationship_count']}")
    print(f"벡터 차원: {health['vector_dim_warnings']}")

    verdicts: dict[str, bool] = {}

    # 1. auto → vector : 개념 정의 질문 (자동 라우팅이 vector를 고르는지 + 답변 생성)
    verdicts["auto_vector"] = check("auto / 개념정의", service.answer("RAG란 무엇인가?", "auto"))

    # 2. graph_qa : KG 실존 엔티티 관계 질문 (그래프 행 반환 기대)
    verdicts["graph_qa_rel"] = check(
        "graph_qa / 관계", service.answer("Openai와 연결된 엔티티를 보여줘", "graph_qa")
    )

    # 3. graph_qa : 집계(count) 질문 (Community Edition GDS 미지원 → Cypher count 처리)
    verdicts["graph_qa_count"] = check(
        "graph_qa / 집계", service.answer("Concept 노드는 몇 개인가?", "graph_qa")
    )

    # 4. auto → hybrid : 종합/구조 질문 (벡터 시드 + 1-hop 그래프 확장)
    verdicts["hybrid"] = check(
        "auto / 전체흐름", service.answer("GraphRAG의 전체 처리 흐름을 요약해줘", "auto")
    )

    # 5. cypher : 사용자 직접 Cypher (읽기 전용 검증 후 실행, 답변은 행 리스트)
    verdicts["cypher"] = check(
        "cypher / 직접실행",
        service.answer("MATCH (n:Concept) RETURN n.id AS id LIMIT 5", "auto"),
        expect_korean=False,
    )

    # ===== 종합 판정 =====
    print(f"\n{'='*72}\n[종합 판정]")
    for name, ok in verdicts.items():
        print(f"  {name:16} : {'PASS' if ok else 'FAIL'}")
    all_pass = all(verdicts.values())
    print(f"\n  전체: {'ALL PASS' if all_pass else 'FAIL'}")
    return 0 if all_pass else 1


if __name__ == "__main__":
    # 이 파일을 직접 실행할 때만 검증을 수행함 (import 시 미실행).
    sys.exit(main())
