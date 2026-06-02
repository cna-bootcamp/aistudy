"""
OpenAI Responses API를 사용한 멀티턴 여행 플래너 — 서버 측 상태 관리 방식

[Before] 전체 히스토리 전송 방식 — 클라이언트가 messages 리스트를 직접 누적·전송
[After]  Responses API 방식 — previous_response_id로 대화를 연결하여 서버가 이력 보관,
         클라이언트는 이전 응답 ID만 보관하면 됨 (히스토리 누적 불필요)
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

sys.stdout.reconfigure(encoding="utf-8")

# 이 파일 위치 기준으로 상위 3단계 디렉터리 절대경로를 구함
# .env 파일에서 API 키 등 환경변수를 로드함
env_path = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(env_path)

SYSTEM_PROMPT = """당신은 친절한 여행 플래너 AI입니다.

사용자로부터 아래 3가지 정보를 아직 모두 파악하지 못했다면 한 번에 하나씩 자연스럽게 질문하세요.
1. 여행지 (국내/해외 도시 또는 지역)
2. 여행 기간 (몇박 며칠)
3. 여행 인원 (몇 명)

3가지 정보를 모두 파악하면, 해당 여행지의 관광지를 5곳 이상 추천하고
각 관광지에 대해 간단한 소개와 추천 이유를 설명해 주세요.

대화는 한국어로 진행하세요."""


def main():
    """터미널 기반 멀티턴 채팅 루프 실행 — Responses API의 previous_response_id로 대화 상태 연결"""
    client = OpenAI()

    print("=" * 60)
    print("  여행 플래너 AI  (Responses API — 서버 측 상태 관리)")
    print("  종료하려면 'quit', 'exit', 또는 '종료' 를 입력하세요.")
    print("=" * 60)
    print()

    # 첫 번째 호출: instructions + 시작 메시지로 인사 유도
    response = client.responses.create(
        model="gpt-4o-mini",
        instructions=SYSTEM_PROMPT,
        input="안녕하세요, 여행 계획을 도와주세요.",
    )
    reply = response.output_text
    previous_response_id = response.id

    print(f"[AI] {reply}")
    print()

    turn = 1
    while True:
        user_input = input(f"[Turn {turn}] 나: ").strip()

        if not user_input:
            continue

        if user_input.lower() in ("quit", "exit", "종료"):
            print("\n여행 플래너를 종료합니다. 좋은 여행 되세요!")
            break

        # 후속 호출: previous_response_id로 서버 측 대화 상태 연결
        # instructions는 매 호출마다 전달해야 함 — previous_response_id 사용 시 자동 이어지지 않음
        response = client.responses.create(
            model="gpt-4o-mini",
            instructions=SYSTEM_PROMPT,
            previous_response_id=previous_response_id,
            input=user_input,
        )
        reply = response.output_text
        previous_response_id = response.id

        print(f"\n[AI] {reply}\n")
        turn += 1


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
