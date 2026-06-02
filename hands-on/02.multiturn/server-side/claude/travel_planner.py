"""
Claude Anthropic API를 사용한 멀티턴 여행 플래너 — 전체 히스토리 전송 방식

[Before] OpenAI Chat Completions 방식 (full-history) — system이 messages 리스트 내 포함
[After]  Anthropic API 방식 — system은 별도 파라미터, messages는 user로 시작해야 함
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import anthropic

sys.stdout.reconfigure(encoding="utf-8")

# 이 파일 위치 기준으로 상위 3단계 디렉터리 절대경로를 구함
# .env 파일에서 API 키 등 환경변수를 로드함
load_dotenv(Path(__file__).resolve().parents[3] / ".env")

client = anthropic.Anthropic(api_key=os.environ.get("CLAUDE_API_KEY"))

SYSTEM_PROMPT = """당신은 친절한 여행 플래너 AI입니다.

사용자로부터 아래 3가지 정보를 아직 모두 파악하지 못했다면 한 번에 하나씩 자연스럽게 질문하세요.
1. 여행지 (국내/해외 도시 또는 지역)
2. 여행 기간 (몇박 며칠)
3. 여행 인원 (몇 명)

3가지 정보를 모두 파악하면, 해당 여행지의 관광지를 5곳 이상 추천하고
각 관광지에 대해 간단한 소개와 추천 이유를 설명해 주세요.

대화는 한국어로 진행하세요."""


def chat(messages: list[dict]) -> str:
    """누적된 전체 messages를 Claude API에 전송하고 응답 텍스트를 반환함"""
    response = client.messages.create(
        model="claude-sonnet-4-6",
        system=SYSTEM_PROMPT,   # system은 별도 파라미터 (messages에 포함하지 않음)
        messages=messages,       # user/assistant 메시지만 포함, 반드시 user로 시작
        max_tokens=1024,
    )
    return response.content[0].text


def main():
    """터미널 기반 멀티턴 채팅 루프 실행 — 종료 명령 입력 전까지 대화 반복"""
    print("=" * 50)
    print("  여행 플래너 (멀티턴 · 전체 히스토리 방식)")
    print("  종료하려면 'quit', 'exit', '종료' 입력")
    print("=" * 50)

    # Claude API: messages는 반드시 user로 시작해야 함
    # 첫 인사를 유도하는 시작 메시지를 API에 전송
    messages = [{"role": "user", "content": "여행 계획을 도와주세요."}]
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
