"""
OpenAI 멀티턴 여행 플래너 — 전체 히스토리 전송 방식

[Before] 단순 단일 호출 — 매번 독립 요청으로 이전 대화 맥락 없음
[After]  매 API 호출 시 누적된 전체 messages 리스트를 함께 전송하여 대화 이력 유지
"""
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

# 이 파일 위치 기준으로 상위 2단계 디렉터리 절대경로를 구함
# .env 파일에서 API 키 등 환경변수를 로드함
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

client = OpenAI()

SYSTEM_PROMPT = """당신은 친절한 여행 플래너 AI입니다.

사용자로부터 아래 3가지 정보를 아직 모두 파악하지 못했다면 한 번에 하나씩 자연스럽게 질문하세요.
1. 여행지 (국내/해외 도시 또는 지역)
2. 여행 기간 (몇박 며칠)
3. 여행 인원 (몇 명)

3가지 정보를 모두 파악하면, 해당 여행지의 관광지를 5곳 이상 추천하고
각 관광지에 대해 간단한 소개와 추천 이유를 설명해 주세요.

대화는 한국어로 진행하세요."""

def chat(messages: list[dict]) -> str:
    """누적된 전체 messages를 OpenAI API에 전송하고 응답 텍스트를 반환함"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
    )
    return response.choices[0].message.content


def main():
    """터미널 기반 멀티턴 채팅 루프 실행 — 종료 명령 입력 전까지 대화 반복"""
    print("=" * 50)
    print("  여행 플래너 (멀티턴 · 전체 히스토리 방식)")
    print("  종료하려면 'quit', 'exit', '종료' 입력")
    print("=" * 50)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # 첫 인사 — AI가 대화를 시작
    first_reply = chat(messages)
    messages.append({"role": "assistant", "content": first_reply})
    print(f"\n[AI] {first_reply}")

    while True:
        user_input = input("\n[나] ").strip()

        if not user_input:
            continue

        if user_input.lower() in ("quit", "exit", "종료"):
            print("\n여행 플래너를 종료합니다. 좋은 여행 되세요!")
            break

        messages.append({"role": "user", "content": user_input})

        reply = chat(messages)
        messages.append({"role": "assistant", "content": reply})

        print(f"\n[AI] {reply}")
        print(f"  (대화 기록: {len(messages) - 1}턴)")


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
