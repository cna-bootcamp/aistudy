"""
멀티턴 여행 플래너 — Google Gemini Chat Session 방식

[Before] 전체 히스토리 전송 방식 — 클라이언트가 매 턴마다 messages 리스트를 직접 구성
[After]  Gemini Chat Session 방식 — SDK의 chat 객체가 히스토리를 자동으로 내부 상태로 관리,
         매 턴마다 전체 히스토리를 직접 구성할 필요 없음
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

sys.stdout.reconfigure(encoding="utf-8")

# 이 파일 위치 기준으로 상위 3단계 디렉터리 절대경로를 구함
dotenv_path = Path(__file__).resolve().parents[3] / ".env"
# .env 파일에서 API 키 등 환경변수를 로드함
load_dotenv(dotenv_path=dotenv_path)

SYSTEM_PROMPT = """당신은 친절한 여행 플래너 AI입니다.

사용자로부터 아래 3가지 정보를 아직 모두 파악하지 못했다면 한 번에 하나씩 자연스럽게 질문하세요.
1. 여행지 (국내/해외 도시 또는 지역)
2. 여행 기간 (몇박 며칠)
3. 여행 인원 (몇 명)

3가지 정보를 모두 파악하면, 해당 여행지의 관광지를 5곳 이상 추천하고
각 관광지에 대해 간단한 소개와 추천 이유를 설명해 주세요.

대화는 한국어로 진행하세요."""


def main():
    """터미널 기반 멀티턴 채팅 루프 실행 — Gemini Chat Session으로 대화 이력 자동 관리"""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("오류: GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")
        print(f"  .env 파일 위치: {dotenv_path}")
        return

    # Google Gemini API 클라이언트 생성
    client = genai.Client(api_key=api_key)

    # Chat Session 생성 — system_instruction 포함
    # 서버 측에서 대화 이력을 관리하는 채팅 세션 생성
    chat = client.chats.create(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
        ),
    )

    print("=" * 60)
    print("  여행 플래너 AI (Gemini Chat Session 방식)")
    print("  종료: quit / exit / 종료 입력")
    print("=" * 60)

    # AI 첫 인사: 빈 primer 메시지로 첫 응답 유도
    first_response = chat.send_message("대화를 시작합니다.")
    print(f"\n[AI] {first_response.text}")
    print(f"     (히스토리: {len(chat.get_history())}턴)\n")

    # 멀티턴 루프
    while True:
        try:
            user_input = input("[나] ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\n\n대화를 종료합니다. 즐거운 여행 되세요!")
            break

        if not user_input:
            continue

        if user_input.lower() in ("quit", "exit", "종료"):
            print("\n대화를 종료합니다. 즐거운 여행 되세요!")
            break

        response = chat.send_message(user_input)
        print(f"\n[AI] {response.text}")
        print(f"     (히스토리: {len(chat.get_history())}턴)\n")


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
