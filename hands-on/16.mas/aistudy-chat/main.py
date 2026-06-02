"""CLI 실행 진입점 (빠른 테스트용)

명령행에서 질문 하나를 받아 MAS 워크플로를 실행하고 최종 답변을 출력함.
사용 예: python main.py "LangGraph의 StateGraph 사용법 알려줘"
"""
from __future__ import annotations

import sys

from graph.state import create_initial_state
from graph.workflow import compile_workflow


def run(question: str) -> None:
    """질문 하나를 워크플로에 통과시켜 결과를 출력함."""
    app = compile_workflow()
    # recursion_limit: 재시도 루프 안전장치 (Loop Guard 보조)
    final_state = app.invoke(create_initial_state(question), config={"recursion_limit": 30})

    print("\n" + "=" * 70)
    print(f"질문 유형 : {final_state.get('question_type')}")
    print(f"평가 점수 : {final_state.get('evaluation_score'):.2f} (통과={final_state.get('evaluation_passed')})")
    print(f"재시도    : {final_state.get('retry_count')}")
    print("=" * 70)
    print(final_state.get("answer", "(답변 없음)"))
    print("=" * 70)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    user_question = " ".join(sys.argv[1:]) or "LangGraph의 StateGraph 사용법 알려줘"
    run(user_question)
