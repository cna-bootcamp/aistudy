/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../02.multiturn/server-side/claude/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "멀티턴 여행 플래너 (Claude Anthropic API) 예제 설명",
    entry: "travel_planner.py",
  },

  files: [
    { id: "main", label: "travel_planner.py", role: "단일 파일 · 터미널 기반 멀티턴 대화 루프" },
  ],

  flow: [
    { step: 1, title: "앱 시작",
      summary: "python travel_planner.py 실행 → main() 진입, 환영 메시지 출력",
      detail: "터미널에서 실행하면 맨 아래 if __name__ == \"__main__\": 이 main()을 호출함. 식당으로 비유하면 가게 문을 열고 손님을 맞이하는 단계임. 대화 목록(messages)을 빈 상자로 준비하고, 첫 인사를 유도하는 시작 메시지를 API에 보냄." },
    { step: 2, title: "첫 인사 생성",
      summary: "messages 에 시작 메시지를 담아 chat()을 호출 → Claude가 첫 인사말을 돌려줌",
      detail: "Claude API는 messages가 반드시 user로 시작해야 함. 그래서 '여행 계획을 도와주세요.' 라는 첫 메시지를 직접 넣어 Claude의 첫 인사를 이끌어냄. 이 방식으로 AI가 먼저 말을 거는 것처럼 보이게 함." },
    { step: 3, title: "사용자 입력 대기",
      summary: "input() 으로 터미널에서 사용자의 글자를 기다림",
      detail: "전화 통화처럼 한 번씩 번갈아 말하는 구조임. 사용자가 여행지·기간·인원을 입력하고 Enter를 누르면 다음 단계로 넘어감. 'quit', 'exit', '종료'를 입력하면 대화를 끝냄." },
    { step: 4, title: "대화 기록에 추가",
      summary: "입력한 문장을 role='user'로 messages 목록에 추가함",
      detail: "대화 내용을 메모해 두는 단계임. messages는 지금까지 오간 대화 전체를 담는 목록으로, 새 입력이 생길 때마다 추가됨. 이 기록 전체를 API에 매번 보내기 때문에, Claude는 이전 대화 맥락을 기억함." },
    { step: 5, title: "Claude API 호출",
      summary: "chat(messages) 가 누적된 전체 대화를 Claude API에 보내고 응답을 받음",
      detail: "AI에게 지금까지의 대화 전부를 주문서로 넘기는 단계임. system 파라미터에는 Claude의 역할·규칙을, messages에는 user/assistant가 번갈아 오간 대화 목록을 담음. Claude는 이 맥락을 보고 다음 말을 생성함." },
    { step: 6, title: "응답 추가 및 표시",
      summary: "Claude 응답을 role='assistant'로 messages에 추가하고 화면에 출력함",
      detail: "Claude의 답변을 기록하고 손님에게 보여주는 단계임. 응답을 messages에 추가해야 다음 대화에서도 맥락으로 활용됨. '(대화 기록: N턴)'으로 얼마나 오래 대화했는지 함께 보여줌." },
    { step: 7, title: "반복 또는 종료",
      summary: "사용자가 종료 명령을 입력하기 전까지 3번 단계부터 반복함",
      detail: "while True 반복문으로 대화가 계속 이어짐. '종료'를 입력하면 break로 루프를 빠져나옴. 여행지·기간·인원 3가지를 모두 말하면 Claude가 자동으로 여행 계획을 제안함." },
  ],

  functions: [
    // ===== travel_planner.py (메인) =====
    {
      id: "module_setup",
      name: "모듈 설정 (전역 상수·초기화)",
      fileId: "main",
      summary: "파일 맨 위에서 API 키 로드, 클라이언트 생성, 시스템 프롬프트 정의 등 프로그램 시작에 필요한 값들을 한 번에 준비함.",
      how: "함수가 아니라 '프로그램이 시작될 때 한 번 실행되는 준비 코드'임. .env 파일에서 Claude API 키를 읽어 환경변수로 올리고, anthropic.Anthropic 클라이언트를 만들어 둠. SYSTEM_PROMPT는 Claude에게 줄 역할 지침을 담은 긴 문장임.",
      terms: ["load_dotenv", "환경변수(.env)", "API 키", "Anthropic 클라이언트", "SYSTEM_PROMPT", "sys.stdout.reconfigure"],
      lines: [
        { at: 'sys.stdout.reconfigure(encoding="utf-8")', text: "윈도우 터미널에서 한글이 깨지지 않도록 출력 인코딩을 UTF-8로 설정함." },
        { at: 'load_dotenv(Path(__file__).resolve().parents[3] / ".env")', text: "이 파일 위치에서 3단계 위 디렉터리의 .env 파일을 읽어, 그 안의 CLAUDE_API_KEY를 환경변수로 올림." },
        { at: 'client = anthropic.Anthropic(api_key=os.environ.get("CLAUDE_API_KEY"))', text: "환경변수에서 API 키를 꺼내 Claude와 통신하는 클라이언트 객체를 만듦." },
        { at: 'SYSTEM_PROMPT = """당신은 친절한 여행 플래너 AI입니다.', text: "삼중 따옴표로 둘러싼 이 긴 문장 전체가 Claude에게 '너는 여행 플래너야, 이렇게 행동해'라고 알려주는 지침임." },
      ],
      code:
`import os
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

대화는 한국어로 진행하세요."""`,
    },
    {
      id: "chat",
      name: "chat(messages)",
      fileId: "main",
      summary: "누적된 전체 messages를 Claude API에 전송하고 응답 텍스트를 반환함.",
      how: "이 함수가 실제로 AI와 대화하는 핵심 부분임. client.messages.create()로 Claude API를 호출할 때, system(역할 지침)은 별도 파라미터로, messages(대화 기록)는 user/assistant 메시지만 담아 따로 전달함. 응답에서 텍스트만 꺼내 돌려줌.",
      terms: ["Anthropic 클라이언트", "SYSTEM_PROMPT", "멀티턴(multi-turn)", "max_tokens", "messages 파라미터", "response.content"],
      lines: [
        { at: 'response = client.messages.create(', text: "Claude API 호출 시작. 모델 이름·지침·대화 기록·최대 토큰 수를 함께 전달함." },
        { at: 'system=SYSTEM_PROMPT,', text: "Claude의 역할 지침을 system 파라미터로 따로 전달함. Anthropic API는 system을 messages 안에 넣지 않고 독립 파라미터로 받음." },
        { at: 'messages=messages,', text: "지금까지의 대화 기록 전체(user/assistant 번갈아 나오는 목록)를 보냄. 이게 '멀티턴'의 핵심 — 과거 대화를 같이 보내야 Claude가 맥락을 기억함." },
        { at: 'max_tokens=1024,', text: "Claude가 한 번에 생성할 수 있는 최대 글자 수(토큰) 제한. 너무 길면 비용이 늘어나므로 적절히 설정함." },
        { at: 'return response.content[0].text', text: "응답 객체의 첫 번째 내용 블록에서 텍스트만 꺼내 돌려줌." },
      ],
      code:
`def chat(messages: list[dict]) -> str:
    """누적된 전체 messages를 Claude API에 전송하고 응답 텍스트를 반환함"""
    response = client.messages.create(
        model="claude-sonnet-4-6",
        system=SYSTEM_PROMPT,   # system은 별도 파라미터 (messages에 포함하지 않음)
        messages=messages,       # user/assistant 메시지만 포함, 반드시 user로 시작
        max_tokens=1024,
    )
    return response.content[0].text`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "터미널 기반 멀티턴 채팅 루프 전체를 지휘하는 진입점 함수.",
      how: "프로그램의 '시작 버튼'에 해당함. 환영 메시지를 출력하고, Claude의 첫 인사를 유도한 뒤, while True 루프로 사용자 입력 → API 호출 → 응답 출력을 반복함. '종료' 입력 시 break로 루프를 빠져나옴. messages 목록이 쌓일수록 대화 맥락이 보존됨.",
      terms: ["while True", "break", "input()", "멀티턴(multi-turn)", "messages 파라미터", "if __name__"],
      lines: [
        { at: 'messages = [{"role": "user", "content": "여행 계획을 도와주세요."}]', text: "Claude API는 messages가 반드시 user로 시작해야 함. '여행 계획을 도와주세요.'로 Claude의 첫 인사를 자연스럽게 유도함." },
        { at: 'first_reply = chat(messages)', text: "첫 인사를 받아오기 위해 chat()을 즉시 호출함. Claude가 여행지·기간·인원을 물어보는 안내말을 돌려줌." },
        { at: 'messages.append({"role": "assistant", "content": first_reply})', text: "Claude의 첫 응답도 기록에 추가함. 이후 대화에서 맥락으로 활용됨." },
        { at: 'user_input = input("\\n[나] ").strip()', text: "input()으로 터미널에서 사용자 입력을 받음. .strip()은 앞뒤 공백을 제거함." },
        { at: 'if user_input.lower() in ("quit", "exit", "종료"):', text: "영문·한글 종료 명령을 모두 인식함. .lower()로 대소문자 구분 없이 'Quit', 'EXIT' 등도 처리함." },
        { at: '"content": reply})', text: "Claude 응답을 대화 기록에 추가함. 다음 요청 시 AI가 이전 말을 기억할 수 있도록, 응답도 messages에 넣어 누적시킴." },
        { at: 'print(f"  (대화 기록: {len(messages) - 1}턴)")', text: "몇 번 주고받았는지 표시함. -1 은 첫 시작 메시지를 제외하기 위한 것임." },
      ],
      code:
`def main():
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
    print(f"\\n[AI] {first_reply}")

    while True:
        user_input = input("\\n[나] ").strip()

        if not user_input:
            continue

        if user_input.lower() in ("quit", "exit", "종료"):
            print("\\n여행 플래너를 종료합니다. 좋은 여행 되세요!")
            break

        messages.append({"role": "user", "content": user_input})

        reply = chat(messages)
        messages.append({"role": "assistant", "content": reply})

        print(f"\\n[AI] {reply}")
        print(f"  (대화 기록: {len(messages) - 1}턴)")


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()`,
    },
  ],

  glossary: {
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env 파일에 KEY=값 형태로 적어두고, load_dotenv로 불러씀.",
    "API 키": "외부 서비스(Claude 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 코드에 직접 쓰면 안 됨.",
    "Anthropic 클라이언트": "Claude API 서버와 통신하는 객체. anthropic.Anthropic(api_key=...)로 만들고, client.messages.create(...)로 대화를 요청함.",
    "SYSTEM_PROMPT": "Claude에게 '너는 여행 플래너야, 이런 규칙으로 행동해'라고 알려주는 지침 문장. 매 요청 시 system 파라미터로 전달됨.",
    "sys.stdout.reconfigure": "콘솔(터미널) 출력의 글자 인코딩을 바꾸는 기능. 윈도우에서 한글이 깨지지 않도록 UTF-8로 다시 설정함.",
    "멀티턴(multi-turn)": "한 번으로 끝나지 않고 여러 번 주고받는 대화 방식. AI가 이전 말을 기억하려면 지나간 대화 전체를 매 요청마다 함께 보내야 함.",
    "messages 파라미터": "Claude API에 보내는 대화 기록 목록. {\"role\": \"user\" 또는 \"assistant\", \"content\": \"내용\"} 형태의 딕셔너리들을 순서대로 담음. 반드시 user로 시작해야 함.",
    "max_tokens": "Claude가 한 번에 생성할 수 있는 최대 글자 수(토큰). 1토큰은 대략 한글 0.5~1글자. 너무 크면 비용이 늘어남.",
    "response.content": "Claude API 응답 객체 안의 생성된 내용 목록. [0].text로 첫 번째 텍스트 블록을 꺼냄.",
    "while True": "조건 없이 무한히 도는 반복문. 내부에서 break를 만날 때까지 계속 반복함. 채팅처럼 '계속 대화'해야 하는 경우에 씀.",
    "break": "반복문(while/for)을 즉시 빠져나오는 명령. '종료'를 입력하면 break가 실행되어 while 루프를 끝냄.",
    "input()": "터미널에서 사용자가 키보드로 입력한 한 줄을 글자로 받아오는 함수.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함. 다른 파일이 import할 때는 실행되지 않음.",
  },
};
