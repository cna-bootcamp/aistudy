/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../02.multiturn/full-history/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "멀티턴 여행 플래너 (전체 히스토리 방식) 예제 설명",
    entry: "travel_planner.py",
  },

  files: [
    { id: "main", label: "travel_planner.py", role: "단일 파일 CLI 예제 · 전체 대화 이력을 누적 전송하는 멀티턴 챗봇" },
  ],

  flow: [
    {
      step: 1, title: "환경 설정",
      summary: "파일 위치 기준으로 .env를 찾아 API 키를 읽고, OpenAI 클라이언트와 시스템 프롬프트를 준비함",
      detail: "프로그램이 시작되는 순간 코드 맨 위에서 한 번 실행되는 준비 단계임. .env 파일에서 비밀 API 키를 읽어 OpenAI 객체를 만들고, AI에게 줄 역할 지침(SYSTEM_PROMPT)을 문자열로 정의해 둠. 식당으로 비유하면 가게 문을 열기 전 재료와 메뉴판을 준비하는 단계임.",
    },
    {
      step: 2, title: "앱 시작 · 첫 인사",
      summary: "main()이 실행되어 안내 문구를 출력하고, AI가 먼저 대화를 시작함",
      detail: "터미널에서 'python travel_planner.py'를 입력하면 main()이 호출됨. 시스템 프롬프트가 담긴 messages 목록을 만든 뒤, AI에게 첫 호출을 해 '안녕하세요, 여행지를 알려주세요' 같은 첫 인사를 받아 화면에 보여줌.",
    },
    {
      step: 3, title: "사용자 입력 대기",
      summary: "터미널 입력창에서 사용자 응답을 기다림 (quit/exit/종료 입력 시 종료)",
      detail: "input()으로 키보드 입력을 기다림. 빈 줄이면 다시 기다리고, 종료 명령이면 안녕 메시지를 출력하고 프로그램을 끝냄. 그 외 입력은 다음 단계로 넘어감.",
    },
    {
      step: 4, title: "대화 이력에 추가",
      summary: "사용자 입력을 messages 목록에 role='user'로 추가함",
      detail: "★핵심★ 이 예제의 멀티턴 비결임. 단순히 새 입력만 보내는 게 아니라, 지금까지 쌓인 messages 목록 전체에 새 메시지를 덧붙임. 이렇게 하면 다음 API 호출 시 전체 대화 맥락이 함께 전달됨.",
    },
    {
      step: 5, title: "AI 호출 (전체 이력 전송)",
      summary: "chat(messages)가 누적된 전체 messages 목록을 OpenAI API에 보내 응답을 받음",
      detail: "chat() 함수가 messages 목록 전체를 API에 보냄. AI는 이 목록을 읽어 '이전에 여행지는 서울이라고 했고, 기간은 3박 4일이라 했으니…'처럼 맥락을 이해하고 답변을 만듦. [Before] 단일 호출은 매번 독립 요청이라 이전 대화를 기억 못함. [After] 전체 이력을 보내면 AI가 대화 흐름을 이어갈 수 있음.",
    },
    {
      step: 6, title: "응답 저장 · 출력",
      summary: "AI 응답을 messages에 role='assistant'로 추가하고 화면에 출력함",
      detail: "AI 답변도 messages 목록에 넣어둠. 이렇게 쌓인 messages는 다음 3단계에서 다시 전체가 전송됨. 대화 턴 수도 함께 표시해 얼마나 주고받았는지 확인할 수 있음.",
    },
    {
      step: 7, title: "반복",
      summary: "종료 명령 입력 전까지 3~6단계를 while True 루프로 반복함",
      detail: "while True 루프가 계속 돌면서 3~6단계를 반복함. messages 목록은 점점 길어지고, AI는 매번 그 전체를 받아 맥락을 이어감. 결국 '서울, 3박 4일, 2명'의 정보가 모이면 관광지 추천으로 이어짐.",
    },
  ],

  functions: [
    // ===== travel_planner.py =====
    {
      id: "module_setup",
      name: "모듈 설정 (import · 클라이언트 · 프롬프트)",
      fileId: "main",
      summary: "파일 맨 위에서 외부 라이브러리를 불러오고, API 클라이언트와 시스템 프롬프트를 전역으로 준비함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 실행되는 설정'임. Path(__file__)로 이 파일 위치를 기준으로 .env 경로를 자동 계산하고, load_dotenv로 API 키를 읽어 OpenAI 객체를 만듦. SYSTEM_PROMPT는 AI에게 줄 역할 지침을 긴 문자열(삼중 따옴표)로 정의함.",
      terms: ["Path(__file__)", "load_dotenv", "환경변수(.env)", "API 키", "OpenAI 클라이언트", "SYSTEM_PROMPT", "삼중 따옴표", "list[dict]"],
      lines: [
        { at: "from pathlib import Path", text: "pathlib은 파일 경로를 다루는 파이썬 표준 모듈임. Path 객체로 OS에 상관없이 경로를 안전하게 다룸." },
        { at: "from dotenv import load_dotenv", text: "load_dotenv는 .env 파일을 읽어 API 키 등을 환경변수로 올려주는 함수임." },
        { at: "from openai import OpenAI", text: "OpenAI는 OpenAI 서버와 통신하는 클라이언트 클래스임." },
        { at: "load_dotenv(Path(__file__).resolve().parents[2]", text: "Path(__file__)은 '이 파일의 절대경로'. .parents[2]는 2단계 위 폴더(hands-on/)를 뜻함. 그 아래 .env에서 키를 읽음." },
        { at: "client = OpenAI()", text: "환경변수에서 OPENAI_API_KEY를 자동으로 읽어 클라이언트를 생성함(인수 없이도 됨)." },
        { at: 'SYSTEM_PROMPT = """당신은 친절한 여행 플래너', text: "삼중 따옴표(\"\"\")로 둘러싼 긴 문자열이 AI에게 주는 역할 지침(시스템 프롬프트)임. 여행지·기간·인원을 순서대로 물어보고 관광지를 추천하게 안내함." },
      ],
      code:
`"""
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

대화는 한국어로 진행하세요."""`,
    },
    {
      id: "chat",
      name: "chat(messages)",
      fileId: "main",
      summary: "누적된 전체 messages 목록을 OpenAI API에 보내고 AI 응답 텍스트를 돌려줌. 멀티턴의 핵심.",
      how: "단 4줄이지만 이 예제의 핵심 함수임. messages 목록 전체(시스템 프롬프트 + 지금까지의 모든 대화)를 API에 보냄. API는 이 대화 흐름을 읽고 맥락에 맞는 답변을 만들어 줌. response.choices[0].message.content로 텍스트만 꺼내 반환함.",
      terms: ["chat.completions.create", "choices[0].message.content", "list[dict]", "role", "content"],
      lines: [
        { at: "def chat(messages: list[dict]) -> str:", text: "list[dict]는 '딕셔너리를 담는 목록' 타입. 각 딕셔너리는 {role: ..., content: ...} 형태의 메시지 한 건임." },
        { at: "response = client.chat.completions.create(", text: "client.chat.completions.create()가 실제로 OpenAI 서버에 요청을 보내는 핵심 API 호출임." },
        { at: 'model="gpt-4o-mini",', text: "어떤 AI 모델을 쓸지 지정. gpt-4o-mini는 빠르고 저렴한 소형 모델임." },
        { at: "messages=messages,", text: "★핵심★ 지금까지 쌓인 messages 전체를 그대로 보냄. 이 덕분에 AI가 이전 대화를 기억하고 맥락을 이어갈 수 있음." },
        { at: "return response.choices[0].message.content", text: "API 응답에서 첫 번째 후보(.choices[0])의 메시지 텍스트(.message.content)만 꺼내 돌려줌." },
      ],
      code:
`def chat(messages: list[dict]) -> str:
    """누적된 전체 messages를 OpenAI API에 전송하고 응답 텍스트를 반환함"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
    )
    return response.choices[0].message.content`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "전체 멀티턴 대화 루프를 지휘함. AI 첫 인사 → 사용자 입력 대기 → 이력 누적 → AI 호출 반복.",
      how: "프로그램의 '지휘자'임. messages 목록을 만들어 시스템 프롬프트를 넣고, AI가 먼저 인사를 함. 그 다음 while True 루프로 사용자 입력을 받아 messages에 쌓고, chat()으로 AI 응답을 받아 다시 messages에 넣는 과정을 반복함. messages가 매 턴 길어지는 것이 멀티턴의 핵심임.",
      terms: ["while True", "input()", ".strip()", "in (튜플)", "if __name__", "role", "content", "system", "user", "assistant"],
      lines: [
        { at: 'messages = [{"role": "system", "content": SYSTEM_PROMPT}]', text: "messages 목록을 시스템 프롬프트 한 건으로 시작함. 이후 대화가 이 목록에 쌓여감." },
        { at: "first_reply = chat(messages)", text: "대화 시작 전 AI가 먼저 인사를 하게 함. 사용자가 아무것도 입력하기 전에 AI가 먼저 말을 걸어오는 방식임." },
        { at: '{"role": "assistant", "content": first_reply}', text: "AI의 첫 인사도 messages에 저장함. 이후 대화에서 '이미 인사했다'는 맥락이 유지됨." },
        { at: 'print(f"\\n[AI] {first_reply}")', text: "\\n은 줄바꿈. AI의 첫 인사를 터미널에 출력함." },
        { at: "while True:", text: "while True:는 '조건 없이 계속 돌아라'는 무한 루프임. 안에서 break를 만나야 멈춤." },
        { at: 'user_input = input("\\n[나] ").strip()', text: "input()으로 키보드 입력을 기다림. .strip()은 앞뒤 공백·줄바꿈을 제거함." },
        { at: 'if user_input.lower() in ("quit", "exit", "종료"):', text: "in (튜플)은 '여러 값 중 하나인가?'를 검사함. .lower()는 'QUIT' 등 대문자 입력도 처리되게 함." },
        { at: '{"role": "user", "content": user_input}', text: "★핵심★ 사용자 입력을 messages에 추가함. 다음 chat() 호출 시 이 입력도 함께 전달됨." },
        { at: '{"role": "assistant", "content": reply}', text: "★핵심★ AI 응답도 messages에 저장함. 다음 chat() 호출 시 이 응답도 전체 이력에 포함되어 AI가 '내가 전에 이렇게 말했구나'를 알게 됨." },
        { at: 'print(f"\\n[AI] {reply}")', text: "이번 AI 답변을 화면에 출력함. {reply}에 실제 답변 텍스트가 들어감." },
        { at: '(대화 기록: {len(messages) - 1}턴)', text: "현재까지 주고받은 턴 수를 출력함. -1은 시스템 프롬프트를 제외한 것임." },
        { at: 'if __name__ == "__main__":', text: "이 파일을 직접 실행할 때만 main()을 호출함. 다른 파일이 import할 때는 실행되지 않음." },
      ],
      code:
`def main():
    """터미널 기반 멀티턴 채팅 루프 실행 — 종료 명령 입력 전까지 대화 반복"""
    print("=" * 50)
    print("  여행 플래너 (멀티턴 · 전체 히스토리 방식)")
    print("  종료하려면 'quit', 'exit', '종료' 입력")
    print("=" * 50)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # 첫 인사 — AI가 대화를 시작
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
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일의 경로'를 나타냄. .resolve()로 절대경로로 바꾸고, .parents[2]로 2단계 상위 폴더를 구할 수 있음. 어디서 실행해도 경로가 어긋나지 않게 해주는 안전한 방법임.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값 형태의 내용을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정 파일. 보통 .env라는 파일에 KEY=값 형태로 적어두고, Git에 올리지 않음.",
    "API 키": "외부 서비스(OpenAI 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 요금이 청구될 수 있어 주의해야 함.",
    "OpenAI 클라이언트": "OpenAI 서버와 통신하는 객체. client.chat.completions.create(...)처럼 이 객체를 통해 AI 모델에 요청을 보냄. OpenAI()를 호출하면 환경변수에서 API 키를 자동으로 읽음.",
    "SYSTEM_PROMPT": "AI에게 역할과 행동 규칙을 알려주는 지침 문자열. 대화 목록(messages)의 가장 첫 번째로 role='system'과 함께 전달됨. 사용자에게는 보이지 않지만 AI의 모든 응답에 영향을 줌.",
    "삼중 따옴표": "파이썬에서 '\"\"\"...\"\"\"' 또는 '''...'''로 묶으면 줄바꿈이 포함된 긴 문자열을 그대로 쓸 수 있음. 시스템 프롬프트처럼 여러 줄로 이루어진 텍스트를 담을 때 편리함.",
    "list[dict]": "'딕셔너리를 원소로 담는 목록' 타입. 여기서는 [{\"role\": \"user\", \"content\": \"...\"}] 형태로 대화 메시지를 관리함. 타입 힌트로 함수 인자의 형태를 알려줌.",
    "chat.completions.create": "OpenAI 클라이언트를 통해 AI 채팅 모델에 요청을 보내는 핵심 메서드. messages 목록과 모델명을 넘기면 AI 응답을 담은 객체를 돌려줌.",
    "choices[0].message.content": "API 응답 객체에서 첫 번째 후보 답변(.choices[0])의 메시지 텍스트(.message.content)를 꺼내는 표현. OpenAI API는 여러 후보를 줄 수 있지만 보통 첫 번째만 씀.",
    "role": "메시지가 누구의 말인지 나타내는 역할 구분자. 'system'(지침), 'user'(사용자), 'assistant'(AI) 세 가지가 있음. AI는 이 role을 보고 대화 흐름을 파악함.",
    "content": "메시지의 실제 내용(텍스트). role과 함께 {\"role\": \"user\", \"content\": \"서울 여행 가고 싶어요\"} 형태로 쌍을 이룸.",
    "system": "messages에서 AI에게 역할·규칙을 알려주는 특별한 메시지 유형. 대화 맨 처음에 한 번 넣어두면 이후 모든 응답에 적용됨.",
    "user": "messages에서 사람(사용자)이 입력한 말을 나타내는 role 값.",
    "assistant": "messages에서 AI가 한 말을 나타내는 role 값. AI 응답을 messages에 저장할 때 이 값을 씀.",
    "while True": "'조건 없이 계속 반복하라'는 무한 루프. 안에서 break를 만나거나 프로그램이 종료될 때까지 돔. 사용자 입력을 계속 기다릴 때 자주 씀.",
    "input()": "터미널(콘솔)에서 사용자가 키보드로 입력한 한 줄을 글자로 받아오는 함수. Enter를 누를 때까지 기다림.",
    ".strip()": "문자열 앞뒤의 공백, 탭, 줄바꿈을 제거하는 메서드. 사용자가 실수로 공백을 넣어도 깨끗하게 처리함.",
    "in (튜플)": "'값이 여러 항목 중 하나인지' 검사하는 표현. in (\"quit\", \"exit\", \"종료\")는 세 값 중 하나이면 True를 돌려줌. if/elif를 여러 번 쓰는 것보다 간결함.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함. 다른 파일이 import할 때는 실행되지 않아 재사용성이 높아짐.",
  },
};
