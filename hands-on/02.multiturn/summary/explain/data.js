/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../02.multiturn/summary/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "멀티턴 여행 플래너 (슬라이딩 윈도우 + 요약) 예제 설명",
    entry: "travel_planner.py",
  },

  files: [
    { id: "main", label: "travel_planner.py", role: "단일 파일 CLI 예제 · 슬라이딩 윈도우 + 요약 방식 멀티턴 대화" },
  ],

  flow: [
    {
      step: 1, title: "환경 설정 · 상수 정의",
      summary: "파일 맨 위에서 .env를 읽고, WINDOW_SIZE·SUMMARY_THRESHOLD·시스템 프롬프트를 설정함",
      detail: "식당을 열기 전 주방을 세팅하는 단계임. load_dotenv()로 비밀 API 키를 환경변수로 올리고, OpenAI 클라이언트를 만듦. WINDOW_SIZE(6)는 '최근 몇 개 대화를 기억할지', SUMMARY_THRESHOLD(8)는 '몇 개가 넘으면 요약할지'를 정하는 숫자임."
    },
    {
      step: 2, title: "앱 시작 · 첫 인사",
      summary: "main()이 빈 conversation과 summary로 시작하고, AI가 먼저 인사를 건넴",
      detail: "가게 문을 열고 손님에게 먼저 인사하는 단계임. conversation(대화 목록)과 summary(요약 문자열)를 빈 상태로 시작함. build_context()로 전송할 메시지를 구성하고, chat()으로 AI 첫 인사를 받아 화면에 출력함."
    },
    {
      step: 3, title: "사용자 입력 대기",
      summary: "input()으로 사용자가 여행지·기간·인원을 입력하기를 기다림",
      detail: "손님의 주문을 기다리는 단계임. input()이 키보드 입력을 한 줄 받아옴. 빈 입력이면 무시하고 다시 기다리며, 'quit'·'exit'·'종료'를 입력하면 프로그램이 끝남."
    },
    {
      step: 4, title: "대화 기록 · API 호출",
      summary: "입력을 conversation에 추가하고, build_context()로 메시지를 구성해 chat()으로 AI 응답을 받음",
      detail: "주문서를 적고 주방에 전달하는 단계임. 사용자 말을 conversation에 쌓고, build_context()가 [시스템] + [요약(있으면)] + [최근 대화]를 조합함. chat()이 이 메시지를 OpenAI API에 보내 AI 답변을 받아옴."
    },
    {
      step: 5, title: "응답 출력 · 상태 표시",
      summary: "AI 답변을 화면에 출력하고, 전체 턴 수·메모리 개수·API 전송 수·요약 여부를 괄호로 표시함",
      detail: "완성된 요리를 손님에게 내고 주방 상태를 알려주는 단계임. AI 답변과 함께 '전체 몇 턴, 메모리에 몇 개, API에 몇 개 보냈는지'를 보여줘, 슬라이딩 윈도우가 실제로 동작하는 모습을 직접 확인할 수 있음."
    },
    {
      step: 6, title: "슬라이딩 윈도우 압축 (maybe_compress)",
      summary: "conversation 개수가 SUMMARY_THRESHOLD(8)를 넘으면, 오래된 메시지를 summarize()로 요약하고 최근 WINDOW_SIZE(6)개만 유지함",
      detail: "메모장이 꽉 차면 오래된 내용을 한 줄 요약으로 바꿔 공간을 확보하는 단계임. summarize()가 LLM을 한 번 더 호출해 오래된 대화를 3~5문장으로 압축함. 이후 API에는 [요약 + 최근 6개]만 보내므로 대화가 아무리 길어져도 토큰 비용이 일정하게 유지됨."
    },
    {
      step: 7, title: "반복",
      summary: "사용자가 새 입력을 하면 3번 단계부터 다시 진행함",
      detail: "손님이 추가 질문을 하면 같은 과정을 반복함. 이전 대화가 conversation 또는 summary에 남아 있어, '그럼 제주도 맛집은?'처럼 이어지는 질문도 맥락을 이해함."
    },
  ],

  functions: [
    // ===== travel_planner.py (메인·유일 파일) =====
    {
      id: "module_setup",
      name: "모듈 설정 (상수·클라이언트)",
      fileId: "main",
      summary: "파일 맨 위에서 .env를 읽고 OpenAI 클라이언트를 만듦. 슬라이딩 윈도우 파라미터와 두 개의 프롬프트 상수를 정의함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 준비하는 값들'임. load_dotenv()가 .env 파일의 API 키를 환경변수로 올리면, OpenAI()가 그 키를 자동으로 읽어 클라이언트를 만듦. WINDOW_SIZE와 SUMMARY_THRESHOLD는 슬라이딩 윈도우의 동작을 조절하는 숫자임.",
      terms: ["load_dotenv", "환경변수(.env)", "API 키", "OpenAI 클라이언트", "WINDOW_SIZE", "SUMMARY_THRESHOLD", "시스템 프롬프트"],
      lines: [
        { at: "load_dotenv(Path(__file__).resolve().parents[2]", text: "Path(__file__).resolve().parents[2]는 '이 파일에서 2단계 위 폴더'의 절대경로임. 거기 있는 .env 파일을 읽어 API 키를 환경변수로 올림." },
        { at: "client = OpenAI()", text: "OpenAI 클라이언트를 만듦. API 키는 환경변수에서 자동으로 읽힘." },
        { at: "WINDOW_SIZE = 6", text: "메모리에 최근 몇 개 대화를 유지할지 정함. 6이면 최근 6개만 남김." },
        { at: "SUMMARY_THRESHOLD = 8", text: "conversation 개수가 이 숫자를 넘으면 요약 압축을 시작함. 8이면 9개째부터 요약함." },
        { at: 'SYSTEM_PROMPT = """당신은 친절한 여행 플래너', text: "AI에게 '너는 여행 플래너야, 이 3가지 정보를 모으면 관광지를 추천해'라고 알려주는 지침 문자열임." },
        { at: "SUMMARIZE_PROMPT = (", text: "요약 전용 지침임. AI가 대화를 3~5문장으로 압축할 때 여행지·기간·인원이 빠지지 않도록 명시함." },
      ],
      code:
`from pathlib import Path
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
)`,
    },
    {
      id: "chat",
      name: "chat(messages)",
      fileId: "main",
      summary: "준비된 메시지 목록을 OpenAI Chat Completions API에 보내고 AI 답변 텍스트를 돌려줌.",
      how: "이 함수가 실제로 AI와 통신하는 창구임. messages에는 시스템 지침·(요약)·대화 내역이 담겨 있고, client.chat.completions.create()가 OpenAI 서버에 보내 응답을 받아옴. 응답 구조에서 실제 텍스트만 꺼내 돌려줌.",
      terms: ["OpenAI 클라이언트", "Chat Completions API", "choices[0].message.content", "타입 힌트", "리스트(list)"],
      lines: [
        { at: "response = client.chat.completions.create(", text: "OpenAI API를 실제로 호출하는 줄임. messages를 서버에 보내고 응답(response)을 받음." },
        { at: 'model="gpt-4o-mini",', text: "어떤 AI 모델을 쓸지 지정함. gpt-4o-mini는 빠르고 저렴한 모델임." },
        { at: "return response.choices[0].message.content", text: "응답 구조에서 [0]번째 후보의 메시지 내용(텍스트)만 꺼내 돌려줌. AI가 여러 후보를 줄 수 있어 choices 목록으로 오지만, 보통 첫 번째([0])를 씀." },
      ],
      code:
`def chat(messages: list[dict]) -> str:
    """구성된 messages를 OpenAI Chat Completions API에 전송하고 응답 텍스트를 반환함"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
    )
    return response.choices[0].message.content`,
    },
    {
      id: "summarize",
      name: "summarize(prev_summary, to_evict)",
      fileId: "main",
      summary: "기존 요약 + 밀려나는 오래된 대화를 합쳐, AI에게 새로운 누적 요약을 만들게 함.",
      how: "메모장이 꽉 찼을 때 오래된 내용을 한 줄짜리로 압축하는 역할임. '기존 요약'과 '밀려나는 메시지들'을 하나의 텍스트로 합쳐, AI(summarize 전용 프롬프트)에게 3~5문장 요약을 요청함. 여행지·기간·인원이 빠지지 않게 프롬프트로 강제함.",
      terms: ["리스트(list)", "f-string", "Chat Completions API", "시스템 프롬프트", "누적 요약"],
      lines: [
        { at: "parts: list[str] = []", text: "요약 요청에 넣을 텍스트 조각들을 담을 빈 목록임." },
        { at: 'parts.append(f"[기존 요약]\\n{prev_summary}")', text: "이전에 이미 만들어 둔 요약이 있으면 '[기존 요약]' 섹션으로 앞에 붙임. 누적 요약이 되는 핵심 단계임." },
        { at: 'parts.append("[새로 요약할 대화]")', text: "'[새로 요약할 대화]' 제목을 붙여, AI가 이 아래 내용을 새로 요약해야 함을 알게 함." },
        { at: 'label = "사용자" if m["role"] == "user" else "AI"', text: "role이 'user'면 '사용자', 그 외면 'AI'로 라벨을 붙여 대화를 읽기 쉽게 텍스트로 변환함." },
        { at: '{"role": "system", "content": SUMMARIZE_PROMPT}', text: "요약 전용 지침(SUMMARIZE_PROMPT)을 시스템 메시지로 넣어, AI가 올바른 형식으로 요약하게 함." },
        { at: 'return response.choices[0].message.content', text: "AI가 만들어 준 요약 텍스트를 돌려줌. 이 값이 새로운 summary가 됨." },
      ],
      code:
`def summarize(prev_summary: str, to_evict: list[dict]) -> str:
    """이전 요약과 퇴거 메시지를 합쳐 새로운 누적 요약을 생성하고 반환함

    1. prev_summary가 있으면 '[기존 요약]' 섹션으로 포함
    2. to_evict 메시지를 '[새로 요약할 대화]' 섹션으로 포함
    3. 여행지/기간/인원 정보가 요약에서 소실되지 않도록 프롬프트에 명시
    """
    parts: list[str] = []
    if prev_summary:
        parts.append(f"[기존 요약]\\n{prev_summary}")
    parts.append("[새로 요약할 대화]")
    for m in to_evict:
        label = "사용자" if m["role"] == "user" else "AI"
        parts.append(f"{label}: {m['content']}")

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SUMMARIZE_PROMPT},
            {"role": "user", "content": "\\n".join(parts)},
        ],
    )
    return response.choices[0].message.content`,
    },
    {
      id: "build_context",
      name: "build_context(summary, conversation)",
      fileId: "main",
      summary: "API에 실제로 보낼 메시지 목록을 구성함. [시스템] + [요약(있으면)] + [최근 대화]를 순서대로 조립함.",
      how: "AI에게 보낼 '주문서'를 최적화해서 정리하는 함수임. 맨 앞에 시스템 지침을 넣고, 요약이 있으면 '[이전 대화 요약]'을 두 번째로 붙임. 마지막으로 conversation[-WINDOW_SIZE:]로 최근 대화만 이어붙임. 이 구조 덕분에 대화가 아무리 길어도 API에 보내는 메시지는 일정 크기로 유지됨.",
      terms: ["시스템 프롬프트", "슬라이딩 윈도우(WINDOW_SIZE)", "리스트(list)", "딕셔너리(dict)", "f-string"],
      lines: [
        { at: 'messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]', text: "시스템 지침을 첫 번째 메시지로 넣음. API 규격에서 시스템 메시지는 항상 맨 앞에 와야 함." },
        { at: 'messages.append({"role": "system", "content": f"[이전 대화 요약]', text: "요약이 있으면 시스템 메시지로 추가함. AI에게 '이전에 이런 내용을 얘기했어'라고 알려주는 역할임." },
        { at: "messages.extend(conversation[-WINDOW_SIZE:])", text: "conversation에서 최근 WINDOW_SIZE(6)개만 잘라 이어붙임. [-WINDOW_SIZE:]는 '뒤에서 6개만'이라는 파이썬 문법임." },
        { at: "return messages", text: "완성된 메시지 목록을 돌려줌. 이게 chat()에 전달되어 API로 전송됨." },
      ],
      code:
`def build_context(summary: str, conversation: list[dict]) -> list[dict]:
    """API에 전송할 메시지 목록을 구성하여 반환함

    구조: [system_prompt] + [요약(있으면)] + conversation[-WINDOW_SIZE:]
    """
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    if summary:
        messages.append({"role": "system", "content": f"[이전 대화 요약]\\n{summary}"})
    messages.extend(conversation[-WINDOW_SIZE:])
    return messages`,
    },
    {
      id: "maybe_compress",
      name: "maybe_compress(summary, conversation)",
      fileId: "main",
      summary: "conversation이 SUMMARY_THRESHOLD(8)를 넘으면, 오래된 메시지를 요약으로 압축하고 최근 WINDOW_SIZE(6)개만 남김.",
      how: "슬라이딩 윈도우의 핵심 함수임. 메모장이 8장을 넘으면, 앞의 오래된 장들(to_evict)을 summarize()로 한 덩어리 요약으로 바꿈. 남는 최근 6개만 conversation에 유지함. 이렇게 하면 대화가 100턴이 가도 API에 보내는 토큰 수는 항상 [요약 1개 + 최근 6개] 수준으로 일정함.",
      terms: ["슬라이딩 윈도우(WINDOW_SIZE)", "SUMMARY_THRESHOLD", "누적 요약", "tuple", "리스트(list)"],
      lines: [
        { at: "if len(conversation) > SUMMARY_THRESHOLD:", text: "conversation 개수가 8개를 넘을 때만 압축을 수행함. 넘지 않으면 그대로 돌려줌." },
        { at: "to_evict = conversation[:-WINDOW_SIZE]", text: "conversation에서 최근 6개를 제외한 나머지(오래된 메시지들)를 to_evict에 담음. 이것들이 요약으로 대체될 대상임." },
        { at: 'print(f"\\n  ┌─ [요약 실행]', text: "압축이 시작됨을 화면에 알림. 교육용으로 슬라이딩 윈도우가 실제로 동작하는 순간을 시각화함." },
        { at: "summary = summarize(summary, to_evict)", text: "summarize()를 호출해 기존 요약 + 오래된 대화 → 새 누적 요약을 만듦." },
        { at: "conversation = conversation[-WINDOW_SIZE:]", text: "conversation을 최근 6개만 남기도록 자름. 오래된 것은 summary에 녹아들었으므로 버려도 됨." },
        { at: "return summary, conversation", text: "갱신된 요약과 줄어든 conversation을 함께 돌려줌. 파이썬에서 두 값을 동시에 반환하는 tuple 형태임." },
      ],
      code:
`def maybe_compress(
    summary: str, conversation: list[dict]
) -> tuple[str, list[dict]]:
    """len(conversation) > SUMMARY_THRESHOLD 초과 시 슬라이딩 윈도우 압축을 수행하고 반환함

    1. conversation[:-WINDOW_SIZE] 를 summarize()로 압축하여 누적 요약 갱신
    2. conversation[-WINDOW_SIZE:] 만 메모리에 유지
    """
    if len(conversation) > SUMMARY_THRESHOLD:
        to_evict = conversation[:-WINDOW_SIZE]
        print(f"\\n  ┌─ [요약 실행] {len(to_evict)}개 메시지 압축 중...", flush=True)
        summary = summarize(summary, to_evict)
        conversation = conversation[-WINDOW_SIZE:]
        print(f"  └─ [요약 완료] 메모리 {len(conversation)}개 유지")
    return summary, conversation`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "터미널 채팅 루프 전체를 지휘하는 진입점. 초기화 → 첫 인사 → 입력 대기 → API 호출 → 압축을 반복함.",
      how: "프로그램의 '시작 버튼'이자 '지휘자'임. conversation(빈 목록)과 summary(빈 문자열)로 시작해, AI 첫 인사를 받고 나서 while True 루프를 돌며 사용자 입력을 처리함. 'quit' 등을 입력하면 break로 빠져나옴. 매 턴 마지막에 maybe_compress()를 호출해 메모리를 자동 관리함.",
      terms: ["while True 반복", "input()", "if __name__", "break", "tuple"],
      lines: [
        { at: "conversation: list[dict] = []", text: "user/assistant 메시지를 담는 대화 목록. 처음엔 비어있음." },
        { at: 'summary: str = ""', text: "압축된 이전 대화 요약 텍스트. 처음엔 비어있음(요약 없음)." },
        { at: "# 첫 인사 — AI가 대화를 시작", text: "첫 AI 인사를 받기 위해 컨텍스트를 구성함. 이 시점엔 summary·conversation 모두 비어 있어 시스템 메시지만 들어감." },
        { at: "first_reply = chat(context)", text: "AI가 먼저 인사를 건넴. '여행지가 어디인가요?'처럼 첫 질문을 받아옴." },
        { at: "while True:", text: "사용자가 종료 명령을 입력할 때까지 무한 반복함. break로만 빠져나올 수 있음." },
        { at: 'user_input = input("\\n[나] ").strip()', text: "터미널에서 사용자 입력 한 줄을 받음. .strip()은 앞뒤 공백·줄바꿈을 제거함." },
        { at: 'if user_input.lower() in ("quit", "exit", "종료"):', text: "입력을 소문자로 바꿔 종료 명령인지 확인함. 맞으면 루프를 빠져나가 프로그램이 끝남." },
        { at: "summary, conversation = maybe_compress(summary, conversation)", text: "매 턴 끝에 압축 여부를 자동 점검함. 8개를 넘었으면 요약하고, 아니면 그대로 둠." },
      ],
      code:
`def main():
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
    print(f"\\n[AI] {first_reply}")

    while True:
        user_input = input("\\n[나] ").strip()

        if not user_input:
            continue

        if user_input.lower() in ("quit", "exit", "종료"):
            print("\\n여행 플래너를 종료합니다. 좋은 여행 되세요!")
            break

        # 1. 사용자 메시지 기록
        conversation.append({"role": "user", "content": user_input})
        total_turns += 1

        # 2. 전체 context 구성 후 API 호출
        context = build_context(summary, conversation)
        reply = chat(context)
        conversation.append({"role": "assistant", "content": reply})

        # 3. 응답 출력 + 상태 표시
        print(f"\\n[AI] {reply}")
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
    main()`,
    },
  ],

  glossary: {
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(OpenAI 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "OpenAI 클라이언트": "OpenAI 서버와 통신하는 객체. client.chat.completions.create(...)처럼 이 객체를 통해 API를 호출함.",
    "Chat Completions API": "OpenAI에서 제공하는 대화형 AI 호출 방식. 메시지 목록(role + content)을 보내면 AI 답변을 돌려줌.",
    "choices[0].message.content": "API 응답에서 첫 번째 후보 메시지의 텍스트를 꺼내는 표현. choices는 AI가 줄 수 있는 후보들의 목록이고, 보통 첫 번째([0])를 씀.",
    "WINDOW_SIZE": "메모리에 유지할 최근 대화 개수. 이 숫자보다 오래된 대화는 요약으로 압축되어 버려짐.",
    "SUMMARY_THRESHOLD": "conversation 개수가 이 값을 넘으면 요약 압축을 시작하는 기준 숫자. 이 값보다 클 때만 maybe_compress()가 동작함.",
    "슬라이딩 윈도우(WINDOW_SIZE)": "긴 대화에서 '최근 몇 개'만 창문(윈도우)처럼 유지하고, 오래된 것은 밀어내는(요약하는) 방식. 토큰 비용을 일정하게 유지하는 핵심 기법임.",
    "누적 요약": "밀려난 오래된 대화를 LLM이 3~5문장으로 압축한 텍스트. 새로 밀려나는 대화가 생길 때마다 기존 요약 위에 덧붙여 점점 쌓임.",
    "시스템 프롬프트": "AI에게 역할·규칙을 알려주는 지침 메시지. 대화 맨 앞에 role='system'으로 넣어 매 요청마다 AI에게 전달됨.",
    "리스트(list)": "여러 값을 순서대로 담는 목록. [\"a\", \"b\"]처럼 대괄호로 표현함.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"role\": \"user\", \"content\": \"안녕\"}처럼 쌍으로 저장함.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
    "타입 힌트": "변수·함수에 자료의 종류(str, list, dict 등)를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "tuple": "여러 값을 묶어 한 번에 돌려주는 자료 구조. (summary, conversation)처럼 괄호로 묶고, a, b = func()처럼 한꺼번에 받을 수 있음.",
    "while True 반복": "조건을 True(항상 참)로 두어 break를 만날 때까지 무한 반복하는 루프. 사용자가 종료 명령을 입력할 때까지 계속 입력을 받을 때 씀.",
    "input()": "터미널(콘솔)에서 사용자가 키보드로 입력한 한 줄을 글자로 받아오는 함수.",
    "break": "반복문(while/for) 안에서 실행되면 즉시 그 반복을 끝내고 빠져나오게 하는 명령.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
  },
};
