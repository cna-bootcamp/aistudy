#!/usr/bin/env python3
"""MAS B — 특허 선행기술·동향 리서치 단위 MAS (LangGraph Self-RAG + korean-law MCP 클라이언트).

외부 동적 소스(판례·해석례·최신법령 + 웹 + YouTube)만 검색하는 Agentic RAG 챗봇임.
Agent가 스스로 (1) 검색 필요 여부와 (2) 소스(law/web/youtube)를 선택하고, 소스별 쿼리를 최적화한 뒤,
답변 품질을 자체 평가(근거성·유용성)하여 미흡하면 질문을 재작성해 재검색함(Self-RAG).

소스:
  - law     : korean-law MCP (원격 Streamable HTTP 클라이언트) — search_decisions(판례·해석례) ·
              search_law/get_law_text(최신 법령) · chain_full_research(종합검색)
  - web     : DuckDuckGo (최근 1년 뉴스·시장 동향)
  - youtube : YouTube Data API v3 검색 + LangChain YoutubeLoader 자막 로드 → 임베딩 청크 선별

특허법 조문 벡터 RAG는 MAS A 전담이므로 본 MAS에서는 다루지 않음(중복 금지).

기술 스택:
  LLM        : Groq LPU openai/gpt-oss-120b (reasoning_format='hidden')
  임베딩      : OpenAI text-embedding-3-small (YouTube 자막 청크 선별 시 질의 벡터화)
  프레임워크  : LangGraph StateGraph
  통신        : korean-law MCP의 MCP 클라이언트 (Streamable HTTP)

사용법:
  python app.py            # 대화형 챗봇 (멀티턴 대화, 'clear' 초기화, 'quit' 종료)
  python app.py --demo     # 검증 질의를 비대화형으로 순차 실행
"""

from __future__ import annotations

import sys

# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from config import settings
from graph.workflow import PatentTrendRAG, build_llm


# ---------------------------------------------------------------------------
# 출력 / 실행
# ---------------------------------------------------------------------------

def format_summary(result: dict) -> str:
    """그래프 처리 결과(라우팅·검색·평가)를 한눈에 보이도록 요약 문자열로 만듦."""
    lines = ["=" * 60, "MAS B 처리 결과 요약 (선행기술·동향 리서치)", "=" * 60]
    if result.get("retry_count", 0) > 0:
        lines.append(f"[Retry ] 재시도 횟수 : {result['retry_count']}")
        for step, rewrite in enumerate(result.get("rewrites", []), 1):
            lines.append(f"[Rewrite {step}] {rewrite['from']} → {rewrite['to']}")
    lines.append(f"[Route ] 검색 수행 : {result['needs_retrieval']} / 소스: {result['sources'] or '없음'}")
    if result["needs_retrieval"]:
        law = result.get("law_raw") or {}
        lines.append(
            f"[검색  ] 판례 {len(law.get('precedents', []))} / 해석례 {len(law.get('interpretations', []))} / "
            f"법령조문 {len(law.get('law_texts', []))} / 웹 {len(result.get('web_results', []))} / "
            f"YouTube청크 {len(result.get('youtube_chunks', []))}"
        )
        lines.append(f"[IsRel ] 관련 항목 : {len(result.get('relevant_items', []))}/"
                     f"{len(result.get('retrieved_items', []))}")
    if result["is_supported"] is not None:
        lines.append(f"[IsSup ] 근거 있음 : {result['is_supported']}")
    if result["is_useful"] is not None:
        lines.append(f"[IsUse ] 유용함   : {result['is_useful']}")
    lines.append("=" * 60)
    return "\n".join(lines)


def print_result(result: dict) -> None:
    """처리 요약과 최종 답변을 콘솔에 출력함."""
    print("\n" + format_summary(result))
    print("\n" + "-" * 60)
    print("답변:")
    print("-" * 60)
    print(result["answer"])
    print("-" * 60)


def run_demo(agent: PatentTrendRAG) -> None:
    """검증 질의를 비대화형으로 순차 실행함 (--demo). 멀티턴 맥락도 누적 검증함."""
    demo_questions = [
        "직무발명 보상 관련 최근 판례와 업계 동향을 조사해줘",  # law(판례·해석례) + web + youtube 통합
        "그럼 관련 강의 영상도 있어?",                          # 멀티턴 후속 질문 (youtube 중심)
        "Claude Code란?",                                      # 특허 외 주제 → 직접 답변
    ]
    history: list = []
    for idx, question in enumerate(demo_questions, 1):
        print("\n" + "#" * 60)
        print(f"# 데모 질의 {idx}/{len(demo_questions)}: {question}")
        print("#" * 60)
        result = agent.invoke(question, history)
        print_result(result)
        # 멀티턴 맥락 누적 (다음 질의가 이전 대화를 참고할 수 있게 함)
        history.append({"role": "user", "content": question})
        history.append({"role": "assistant", "content": result["answer"]})


def chat(agent: PatentTrendRAG) -> None:
    """대화형 챗봇 루프를 실행함 (멀티턴 대화 + 'clear' 초기화)."""
    print("\n" + "=" * 60)
    print("특허 선행기술·동향 리서치 MAS B (Self-RAG)")
    print("=" * 60)
    print("판례·해석례(법제처 MCP)·웹 동향·YouTube 해설을 스스로 골라 검색하고, 답변 품질을 자체 검증합니다.")
    print("멀티턴 대화를 기억합니다. 'clear' 입력 시 대화 초기화, 'quit'/'q' 입력 시 종료.")
    print("=" * 60 + "\n")

    history: list = []
    while True:
        try:
            question = input("질문: ").strip()
            if not question:
                continue
            if question.lower() in ("quit", "q", "exit", "종료"):
                print("\n챗봇을 종료합니다. 감사합니다!")
                break
            if question.lower() in ("clear", "초기화"):
                history.clear()
                print("\n[대화 맥락을 초기화했습니다.]\n")
                continue
            result = agent.invoke(question, history)
            print_result(result)
            history.append({"role": "user", "content": question})
            history.append({"role": "assistant", "content": result["answer"]})
            print()
        except KeyboardInterrupt:
            print("\n\n챗봇을 종료합니다.")
            break
        except Exception as error:  # noqa: BLE001 - 한 질문의 오류로 루프가 죽지 않게 함
            print(f"\n오류가 발생했습니다: {error}\n")


def main() -> None:
    """LLM·Self-RAG 그래프를 준비하고, 모드(데모/대화형)에 따라 실행함."""
    print("\n" + "=" * 60)
    print("MAS B — 특허 선행기술·동향 리서치 (LangGraph + Groq gpt-oss-120b)")
    print("=" * 60)
    try:
        # MCP 접속 URL을 미리 구성해 LAW_OC 누락을 실행 초기에 잡음
        print(f"korean-law MCP: {settings.LAW_MCP_BASE_URL}?oc=*** (Streamable HTTP)")
        settings.build_law_mcp_url()
        llm = build_llm()
        agent = PatentTrendRAG(llm)

        if "--demo" in sys.argv[1:]:
            run_demo(agent)
        else:
            chat(agent)
    except (RuntimeError, ValueError) as error:
        print(f"\n[오류] {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
