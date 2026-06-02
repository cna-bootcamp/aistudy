/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../02.multiturn/server-side/gemini/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "멀티턴 여행 플래너 (Gemini Chat Session) 예제 설명",
    entry: "travel_planner.py",
  },

  files: [
    { id: "main", label: "travel_planner.py", role: "단일 파일 · Gemini Chat Session 기반 터미널 멀티턴 대화" },
  ],

  flow: [
    {
      step: 1,
      title: "앱 시작",
      summary: "main() 함수가 실행되어 GEMINI_API_KEY를 읽고, 없으면 안내 후 종료함",
      detail: "프로그램의 '전원 버튼'에 해당함. 먼저 .env 파일을 읽어 API 키를 꺼내고, 키가 없으면 '설정 안 됨'을 친절히 알려준 뒤 멈춤. 키가 있어야 다음 단계로 진행함.",
    },
    {
      step: 2,
      title: "Gemini 클라이언트 + Chat Session 생성",
      summary: "genai.Client로 Gemini 서버와 연결하고, client.chats.create()로 대화 세션을 열음",
      detail: "식당에 비유하면 주방(Gemini 서버)에 전화를 걸어 '오늘 예약'을 잡는 단계임. chat 객체 하나가 그 예약 자리임. system_instruction(지침서)을 이때 넘겨줘서, 이후 대화 내내 AI가 지침을 기억하게 함. 가장 중요한 점은 대화 이력(히스토리)을 서버(Gemini SDK)가 자동으로 관리해준다는 것 — 개발자가 직접 messages 목록을 조립할 필요가 없음.",
    },
    {
      step: 3,
      title: "AI 첫 인사 유도",
      summary: "빈 primer 메시지('대화를 시작합니다.')를 보내 AI가 먼저 인사하도록 유도함",
      detail: "손님이 자리에 앉자마자 직원이 먼저 인사하는 것과 같음. 사용자가 아무 말도 안 했지만, 짧은 신호를 보내 AI가 여행 플래너로서 첫 마디를 꺼내게 함.",
    },
    {
      step: 4,
      title: "멀티턴 대화 루프",
      summary: "while True 루프로 사용자 입력을 계속 받고, chat.send_message()로 AI와 주고받음",
      detail: "손님이 주문할 때마다 주방이 응답하는 과정을 계속 반복하는 것과 같음. 사용자가 'quit/exit/종료'를 입력하거나 Ctrl+C를 누를 때까지 대화가 이어짐. 핵심: chat.send_message()를 부를 때마다 SDK가 이전 대화 전체를 자동으로 함께 보내주므로, 개발자가 이전 대화를 직접 쌓을 필요가 없음.",
    },
    {
      step: 5,
      title: "히스토리 자동 관리",
      summary: "매 응답 뒤 chat.get_history()로 현재 쌓인 대화 턴 수를 확인할 수 있음",
      detail: "[Before/After 비교] 이전 방식(Before): 개발자가 messages = [] 목록에 사람 말·AI 말을 직접 append 하면서 매 턴마다 전체 목록을 API에 넘겼음. 현재 방식(After): chat 객체가 내부에서 히스토리를 자동 관리함. get_history()는 '지금까지 몇 턴 쌓였는지' 확인용 창구일 뿐, 직접 조립할 필요가 없음.",
    },
    {
      step: 6,
      title: "종료",
      summary: "'quit/exit/종료' 입력 또는 Ctrl+C 시 '즐거운 여행 되세요!' 메시지 후 종료함",
      detail: "식당에서 손님이 계산 후 나가는 단계임. KeyboardInterrupt(Ctrl+C)나 EOFError도 정상 종료로 처리해, 어떻게 끝내도 친절한 인사를 남기게 함.",
    },
  ],

  functions: [
    // ===== travel_planner.py (단일 파일) =====
    {
      id: "module_setup",
      name: "모듈 설정 (상수·환경변수)",
      fileId: "main",
      summary: "파일 맨 위에서 한글 출력 인코딩 설정, .env 파일 위치 계산, API 키 로드, 시스템 프롬프트 정의를 한꺼번에 준비함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 실행되는 초기 설정 구역'임. Path(__file__).resolve().parents[3]으로 이 파일 위치를 기준 삼아 .env 경로를 자동 계산하고, load_dotenv로 API 키를 환경변수로 올림. SYSTEM_PROMPT는 AI에게 줄 역할·규칙을 적은 긴 지침서임.",
      terms: ["sys.stdout.reconfigure", "Path(__file__).parents", "load_dotenv", "환경변수(.env)", "SYSTEM_PROMPT(시스템 프롬프트)"],
      lines: [
        { at: "sys.stdout.reconfigure(encoding", text: "윈도우 콘솔에서 한글 출력이 깨지지 않도록 출력 인코딩을 UTF-8로 설정함." },
        { at: "Path(__file__).resolve().parents[3]", text: "이 파일 위치를 기준으로 3단계 위 폴더(hands-on/)를 찾아 .env 경로를 자동 계산함. 어디서 실행해도 경로가 어긋나지 않음." },
        { at: "load_dotenv(dotenv_path=dotenv_path)", text: "load_dotenv가 .env 파일을 읽어 GEMINI_API_KEY 같은 비밀 값을 환경변수로 올려줌." },
        { at: 'SYSTEM_PROMPT = """당신은 친절한 여행 플래너 AI', text: "AI에게 '너는 여행 플래너야, 이렇게 행동해'를 알려주는 지침서. 삼중 따옴표(\"\"\")로 여러 줄 문자열을 작성함." },
      ],
      code:
`import os
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

대화는 한국어로 진행하세요."""`,
    },

    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "전체 프로그램의 시작점. API 키 확인 → Chat Session 생성 → 첫 인사 → 멀티턴 대화 루프 순으로 지휘함.",
      how: "이 함수 하나가 프로그램 전체를 담당함. 핵심은 client.chats.create()로 만든 chat 객체임. 이전 방식(Before)에서는 개발자가 매 턴마다 messages 목록 전체를 직접 조립해야 했지만, 이 방식(After)에서는 chat.send_message() 한 번이면 SDK가 이전 대화를 자동으로 함께 보내줌. 개발자는 '이번에 할 말'만 넘기면 됨.",
      terms: ["genai.Client", "client.chats.create", "GenerateContentConfig", "system_instruction", "Chat Session", "send_message", "get_history", "while True", "KeyboardInterrupt", "EOFError", "if __name__"],
      lines: [
        { at: "api_key = os.environ.get", text: "os.environ.get으로 환경변수에서 GEMINI_API_KEY를 읽음. 없으면 None을 받아 다음 줄의 if에서 걸러냄." },
        { at: "client = genai.Client(api_key=api_key)", text: "genai.Client는 Google Gemini 서버와 통신하는 '연결 객체'임. API 키로 인증함." },
        { at: "chat = client.chats.create(", text: "★핵심★ Chat Session 생성. 이 chat 객체가 이후 대화 이력 전체를 내부에서 자동 관리함. 개발자가 messages 목록을 직접 쌓지 않아도 됨." },
        { at: "system_instruction=SYSTEM_PROMPT,", text: "system_instruction은 AI에게 줄 역할·규칙 지침서. Chat Session 생성 시 한 번만 넘기면 이후 대화 내내 적용됨." },
        { at: 'first_response = chat.send_message("대화를 시작합니다.")', text: "빈 primer 메시지로 AI의 첫 인사를 유도함. 사용자가 아직 아무 말도 하지 않았지만, 이 신호로 AI가 먼저 여행 플래너 역할로 인사함." },
        { at: "first_response.text}", text: "first_response.text는 AI가 첫 인사로 보내온 답변 텍스트임. get_history()로 첫 응답 후 이미 2턴(사람+AI)이 쌓인 것을 확인함." },
        { at: "user_input = input(", text: "input()으로 사용자가 키보드로 입력한 한 줄을 받음. .strip()으로 앞뒤 공백을 제거함." },
        { at: 'if user_input.lower() in ("quit", "exit", "종료"):', text: "'quit', 'exit', '종료' 중 하나를 입력하면 대화를 끝냄. .lower()로 대소문자 구분 없이 비교함." },
        { at: "response = chat.send_message(user_input)", text: "★핵심★ 사용자 말을 보내면 SDK가 이전 대화 이력 전체를 자동으로 함께 전송함. 개발자는 이번 말만 넘기면 됨." },
        { at: "{response.text}", text: "매 응답 뒤 get_history()로 누적 턴 수를 확인함. SDK가 자동 관리하므로 개발자가 직접 messages에 추가하지 않아도 됨." },
        { at: "except (KeyboardInterrupt, EOFError):", text: "Ctrl+C(KeyboardInterrupt)나 입력 종료(EOFError) 시 오류로 멈추지 않고 친절한 종료 메시지를 출력함." },
      ],
      code:
`def main():
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
    print(f"\\n[AI] {first_response.text}")
    print(f"     (히스토리: {len(chat.get_history())}턴)\\n")

    # 멀티턴 루프
    while True:
        try:
            user_input = input("[나] ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\\n\\n대화를 종료합니다. 즐거운 여행 되세요!")
            break

        if not user_input:
            continue

        if user_input.lower() in ("quit", "exit", "종료"):
            print("\\n대화를 종료합니다. 즐거운 여행 되세요!")
            break

        response = chat.send_message(user_input)
        print(f"\\n[AI] {response.text}")
        print(f"     (히스토리: {len(chat.get_history())}턴)\\n")


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()`,
    },
  ],

  glossary: {
    "sys.stdout.reconfigure": "콘솔(터미널) 출력의 글자 인코딩을 바꾸는 기능. 윈도우에서 한글이 깨지지 않도록 UTF-8로 다시 설정함.",
    "Path(__file__).parents": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .parents[N]은 N단계 위 부모 폴더의 경로를 줌. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env라는 파일에 KEY=값 형태로 적어둠.",
    "SYSTEM_PROMPT(시스템 프롬프트)": "AI에게 '너는 이런 역할이야, 이렇게 행동해'를 알려주는 지침서. Chat Session 생성 시 system_instruction으로 넘겨 이후 모든 대화에 적용됨.",
    "genai.Client": "Google Gemini API 서버와 통신하는 '연결 객체'. API 키로 인증하고, 이 객체를 통해 모델을 호출하거나 Chat Session을 만듦.",
    "client.chats.create": "Gemini Chat Session을 생성하는 함수. 반환된 chat 객체가 이후 대화 이력을 내부에서 자동으로 관리함.",
    "GenerateContentConfig": "Gemini 모델 호출 시 설정값(system_instruction·temperature 등)을 담는 설정 객체. 파이썬 딕셔너리 대신 타입이 있는 객체로 설정을 전달함.",
    "system_instruction": "Chat Session 생성 시 AI에게 주는 역할·규칙 지침서. 대화 맨 앞에 들어가는 SystemMessage와 같은 역할이며, 이후 모든 대화 턴에 자동 적용됨.",
    "Chat Session": "Gemini SDK가 제공하는 '대화 세션'. 이 세션 안에서 주고받은 모든 메시지(히스토리)를 SDK가 내부에서 자동으로 누적 관리함. 개발자가 매 턴마다 이전 대화를 직접 쌓을 필요가 없어짐.",
    "send_message": "Chat Session에 새 메시지를 보내고 AI 응답을 받는 함수. 내부적으로 이전 대화 이력 전체를 자동으로 포함해 서버로 전송함.",
    "get_history": "Chat Session에 지금까지 쌓인 대화(사람 말·AI 말) 목록을 돌려주는 함수. 개수를 세거나 내용을 확인할 때 씀.",
    "while True": "'조건 없이 계속 반복'하는 루프. break 문을 만날 때까지 무한 반복함. 사용자가 종료 신호를 줄 때까지 대화를 이어가는 데 씀.",
    "KeyboardInterrupt": "사용자가 Ctrl+C를 누를 때 파이썬이 발생시키는 신호(예외). try/except로 잡아 친절한 종료 메시지를 출력할 수 있음.",
    "EOFError": "입력 스트림이 예상치 않게 끝났을 때 나는 오류. 터미널이 닫히거나 파이프 입력이 끝날 때 발생하며, KeyboardInterrupt와 함께 잡아 정상 종료 처리함.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
  },
};
