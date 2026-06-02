"""
OpenAI 멀티턴 여행 플래너 — 슬라이딩 윈도우 + 요약 방식

[Before] 전체 히스토리 전송 방식 — 대화가 길어질수록 토큰 비용이 선형 증가
[After]  슬라이딩 윈도우 + 요약 방식 — 오래된 메시지를 LLM 요약으로 압축하여 토큰 절감

핵심 원리:
  - conversation: 현재 메모리에 유지 중인 user/assistant 메시지 (system 제외)
  - summary: 메모리 밖으로 밀려난 메시지를 LLM으로 압축한 누적 요약
  - len(conversation) > SUMMARY_THRESHOLD 초과 시 오래된 메시지를 요약으로 압축하고
    최근 WINDOW_SIZE 개만 conversation에 유지
  - API 전송: [system] + [요약(있으면)] + conversation[-WINDOW_SIZE:]
"""
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

# 이 파일 위치 기준으로 상위 2단계 디렉터리 절대경로를 구함
# .env 파일에서 API 키 등 환경변수를 로드함
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

client = OpenAI()

# ── 슬라이딩 윈도우 파라미터 ─────────────────────────────────
WINDOW_SIZE = 6        # 최근 유지할 메시지 수
SUMMARY_THRESHOLD = 8  # 요약 시작 기준 (conversation 메시지 수)
# ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """당신은 친절한 여행 플래너 AI입니다.

사용자로부터 아래 3가지 정보를 아직 모두 파악하지 못했다면 한 번에 하나씩 자연스럽게 질문하세요.
1. 여행지 (국내/해외 도시 또는 지역)
2. 여행 기간 (몇박 며칠)
3. 여행 인원 (몇 명)

3가지 정보를 모두 파악하면, 해당 여행지의 관광지를 5곳 이상 추천하고
각 관광지에 대해 간단한 소개와 추천 이유를 설명해 주세요.

대화는 한국어로 진행하세요."""

SUMMARIZE_PROMPT = (
    "아래 여행 플래너 대화를 3~5문장으로 요약하세요. "
    "여행지, 여행 기간(몇박 며칠), 여행 인원은 반드시 그대로 포함하세요. "
    "사용자의 선호도나 특별한 요청이 있으면 함께 포함하세요."
)


def chat(messages: list[dict]) -> str:
    """구성된 messages를 OpenAI Chat Completions API에 전송하고 응답 텍스트를 반환함"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
    )
    return response.choices[0].message.content


def summarize(prev_summary: str, to_evict: list[dict]) -> str:
    """이전 요약과 퇴거 메시지를 합쳐 새로운 누적 요약을 생성하고 반환함

    1. prev_summary가 있으면 '[기존 요약]' 섹션으로 포함
    2. to_evict 메시지를 '[새로 요약할 대화]' 섹션으로 포함
    3. 여행지/기간/인원 정보가 요약에서 소실되지 않도록 프롬프트에 명시
    """
    parts: list[str] = []
    if prev_summary:
        parts.append(f"[기존 요약]\n{prev_summary}")
    parts.append("[새로 요약할 대화]")
    for m in to_evict:
        label = "사용자" if m["role"] == "user" else "AI"
        parts.append(f"{label}: {m['content']}")

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SUMMARIZE_PROMPT},
            {"role": "user", "content": "\n".join(parts)},
        ],
    )
    return response.choices[0].message.content


def build_context(summary: str, conversation: list[dict]) -> list[dict]:
    """API에 전송할 메시지 목록을 구성하여 반환함

    구조: [system_prompt] + [요약(있으면)] + conversation[-WINDOW_SIZE:]
    """
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    if summary:
        messages.append({"role": "system", "content": f"[이전 대화 요약]\n{summary}"})
    messages.extend(conversation[-WINDOW_SIZE:])
    return messages


def maybe_compress(
    summary: str, conversation: list[dict]
) -> tuple[str, list[dict]]:
    """len(conversation) > SUMMARY_THRESHOLD 초과 시 슬라이딩 윈도우 압축을 수행하고 반환함

    1. conversation[:-WINDOW_SIZE] 를 summarize()로 압축하여 누적 요약 갱신
    2. conversation[-WINDOW_SIZE:] 만 메모리에 유지
    """
    if len(conversation) > SUMMARY_THRESHOLD:
        to_evict = conversation[:-WINDOW_SIZE]
        print(f"\n  ┌─ [요약 실행] {len(to_evict)}개 메시지 압축 중...", flush=True)
        summary = summarize(summary, to_evict)
        conversation = conversation[-WINDOW_SIZE:]
        print(f"  └─ [요약 완료] 메모리 {len(conversation)}개 유지")
    return summary, conversation


def main():
    """터미널 기반 멀티턴 채팅 루프 실행 — 임계값 초과 시 자동 요약·압축 수행"""
    print("=" * 58)
    print("  여행 플래너 (멀티턴 · 슬라이딩 윈도우 + 요약 방식)")
    print(f"  윈도우: {WINDOW_SIZE}개  |  요약 기준: {SUMMARY_THRESHOLD}개 초과 시")
    print("  종료하려면 'quit', 'exit', '종료' 입력")
    print("=" * 58)

    conversation: list[dict] = []  # 현재 메모리의 user/assistant 메시지
    summary: str = ""              # 압축된 이전 대화 요약
    total_turns: int = 0           # 누적 user 입력 횟수 (eviction 이후에도 감소 안 함)

    # 첫 인사 — AI가 대화를 시작
    context = build_context(summary, conversation)
    first_reply = chat(context)
    conversation.append({"role": "assistant", "content": first_reply})
    print(f"\n[AI] {first_reply}")

    while True:
        user_input = input("\n[나] ").strip()

        if not user_input:
            continue

        if user_input.lower() in ("quit", "exit", "종료"):
            print("\n여행 플래너를 종료합니다. 좋은 여행 되세요!")
            break

        # 1. 사용자 메시지 기록
        conversation.append({"role": "user", "content": user_input})
        total_turns += 1

        # 2. 전체 context 구성 후 API 호출
        context = build_context(summary, conversation)
        reply = chat(context)
        conversation.append({"role": "assistant", "content": reply})

        # 3. 응답 출력 + 상태 표시
        print(f"\n[AI] {reply}")
        api_sent = len(context) - 1  # system 메시지 제외한 전송 수
        print(
            f"  (전체: {total_turns}턴 | "
            f"메모리: {len(conversation)}개 | "
            f"API 전송: {api_sent}개 | "
            f"요약: {'있음' if summary else '없음'})"
        )

        # 4. 임계값 초과 시 슬라이딩 윈도우 압축 (API 호출 이후에 수행)
        summary, conversation = maybe_compress(summary, conversation)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
