/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../02.multiturn/server-side/openai/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "멀티턴 여행 플래너 (OpenAI Responses API — 서버 측 상태 관리) 예제 설명",
    entry: "travel_planner.py",
  },

  files: [
    { id: "main", label: "travel_planner.py", role: "단일 파일 CLI 예제 · Responses API로 서버가 대화 이력을 관리" },
  ],

  flow: [
    {
      step: 1,
      title: "환경 준비",
      summary: "파일 위치 기준으로 .env를 찾아 OPENAI_API_KEY 등 환경변수를 로드함",
      detail: "프로그램 실행 전 '재료 준비' 단계임. Path(__file__).resolve().parents[3]으로 이 파일에서 세 단계 위 폴더를 계산하고, 거기 있는 .env 파일의 API 키를 load_dotenv로 환경변수에 올림. 이후 OpenAI()가 자동으로 그 키를 읽음.",
    },
    {
      step: 2,
      title: "시스템 프롬프트 정의",
      summary: "SYSTEM_PROMPT 상수에 'AI 역할 · 수집할 3가지 정보 · 답변 형식'을 적어둠",
      detail: "AI에게 주는 '지침서'를 미리 글로 작성해 두는 단계임. 여행지·기간·인원 세 가지를 하나씩 차례로 물어보고, 다 파악하면 관광지 5곳 이상을 추천하라는 규칙을 담고 있음. 이 문자열이 매 API 호출의 instructions 파라미터로 전달됨.",
    },
    {
      step: 3,
      title: "첫 번째 AI 호출",
      summary: "OpenAI 클라이언트를 만들고, 첫 인사 메시지로 Responses API를 최초 호출함",
      detail: "대화의 '시작' 버튼을 누르는 단계임. client.responses.create()에 모델명·지침·시작 메시지를 넣어 첫 응답을 받음. 이때 응답 객체의 id(previous_response_id)를 저장해 두는 것이 핵심임. 이 ID가 '대화 연결 고리' 역할을 함.",
    },
    {
      step: 4,
      title: "AI 인사 출력",
      summary: "response.output_text로 AI의 첫 답변을 꺼내 화면에 출력함",
      detail: "response.output_text는 Responses API 응답에서 텍스트만 바로 꺼내는 편리한 속성임. 이 값을 '[AI] ...' 형태로 출력하고, 이어질 사용자 입력을 기다림.",
    },
    {
      step: 5,
      title: "사용자 입력 대기",
      summary: "while 루프 안에서 input()으로 사용자의 문장을 받고, 종료 명령을 감지함",
      detail: "전화 통화처럼 한 사람이 말하고 상대방이 답하는 반복 단계임. 빈 입력은 건너뛰고, 'quit'·'exit'·'종료'를 입력하면 while 루프를 빠져나와 프로그램이 끝남.",
    },
    {
      step: 6,
      title: "후속 AI 호출 (핵심)",
      summary: "previous_response_id를 넘겨 서버가 이전 대화를 기억한 채 이어 답변하게 함",
      detail: "이 예제의 핵심 차별점임. 일반적인 방법(클라이언트 측 상태 관리)은 이전 대화 내용 전체를 매번 messages 리스트로 전송해야 함. Responses API는 이전 응답 ID 하나만 previous_response_id에 넘기면 서버가 알아서 대화를 이어 줌. 비용·전송량이 줄고 코드가 단순해짐. instructions는 이 경우에도 매 호출마다 반복 전달해야 함.",
    },
    {
      step: 7,
      title: "AI 답변 출력 및 ID 갱신",
      summary: "새 응답 텍스트를 출력하고, 다음 호출을 위해 previous_response_id를 갱신함",
      detail: "대화가 이어지려면 '가장 최신 응답 ID'를 항상 갱신해야 함. response.id를 previous_response_id에 덮어써서 다음 턴에서 서버가 올바른 대화 맥락을 찾을 수 있게 함. turn 카운터를 1씩 올려 몇 번째 대화인지 표시함.",
    },
    {
      step: 8,
      title: "반복 또는 종료",
      summary: "종료 명령이 없으면 5번 단계로 돌아가 대화를 계속하고, 종료 명령이면 인사 후 끝냄",
      detail: "while True 루프가 계속 돌면서, 사용자가 종료를 입력하기 전까지 대화를 무한 반복함. 서버 측 상태 관리 덕분에 클라이언트(이 코드)는 ID 하나만 기억하고 있으면 됨.",
    },
  ],

  functions: [
    // ===== travel_planner.py (메인) =====
    {
      id: "module_setup",
      name: "모듈 설정 (환경변수 · 시스템 프롬프트)",
      fileId: "main",
      summary: "파일 맨 위에서 .env 로드, 한글 출력 설정, SYSTEM_PROMPT 상수 정의를 한꺼번에 처리함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 준비하는 설정들'임. Path(__file__).resolve().parents[3]으로 이 파일에서 세 단계 위 폴더(hands-on/)의 .env를 찾아 load_dotenv로 읽음. sys.stdout.reconfigure는 윈도우에서 한글이 깨지지 않게 출력 인코딩을 UTF-8로 바꾸는 설정임. SYSTEM_PROMPT는 AI에게 주는 긴 지침 문자열임.",
      terms: ["Path(__file__)", "load_dotenv", "환경변수(.env)", "API 키", "sys.stdout.reconfigure"],
      lines: [
        { at: "sys.stdout.reconfigure(encoding=\"utf-8\")", text: "윈도우 콘솔에서 한글 출력이 깨지지 않도록 출력 인코딩을 UTF-8로 바꿈." },
        { at: "env_path = Path(__file__).resolve().parents[3]", text: "Path(__file__)은 '이 파일 자신의 경로'. .parents[3]은 세 단계 위 폴더(hands-on/)를 가리킴." },
        { at: "load_dotenv(env_path)", text: "load_dotenv가 .env 파일의 KEY=값들을 읽어 프로그램의 환경변수로 등록함. OpenAI()가 나중에 이 값을 자동으로 씀." },
        { at: "SYSTEM_PROMPT = \"\"\"", text: "삼중 따옴표(\"\"\")로 감싼 긴 문자열 전체가 AI에게 주는 '역할 지침'임. 여행지·기간·인원을 수집하고 관광지를 추천하라는 규칙을 담음." },
      ],
      code:
`import os
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

대화는 한국어로 진행하세요."""`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "터미널 기반 멀티턴 채팅을 실행함. 첫 AI 인사 → 사용자 입력 반복 → previous_response_id로 대화 연결.",
      how: "이 함수가 전체 대화를 지휘함. 핵심은 previous_response_id 하나로 서버 측 대화 상태를 유지하는 것임. 첫 호출 후 response.id를 저장하고, 이후 매 호출마다 그 ID를 previous_response_id로 넘기면 서버가 이전 대화를 기억하고 이어서 답변함. 클라이언트(이 코드)는 대화 내용을 쌓아둘 필요가 없어 코드가 단순함.",
      terms: ["OpenAI 클라이언트", "Responses API", "previous_response_id", "response.output_text", "response.id", "while 반복", "input()", "if __name__"],
      lines: [
        { at: "client = OpenAI()", text: "OpenAI 클라이언트를 만듦. 앞서 load_dotenv로 올린 OPENAI_API_KEY를 자동으로 읽어 사용함." },
        { at: "input=\"안녕하세요, 여행 계획을 도와주세요.\",", text: "★첫 호출★ Responses API를 처음 부름. instructions에 시스템 프롬프트, input에 첫 인사 메시지를 전달함." },
        { at: "print(f\"[AI] {reply}\")", text: "response.output_text로 꺼낸 AI 첫 답변을 화면에 출력함. output_text는 응답 텍스트를 바로 꺼내는 편리한 속성임." },
        { at: "turn = 1", text: "응답 ID를 저장해 둠. 이 ID가 다음 호출에서 '이전 대화와 연결' 역할을 함. 대화 횟수를 세는 turn 변수도 여기서 초기화함." },
        { at: "user_input = input(", text: "input()으로 사용자가 키보드로 입력한 한 줄을 받아옴. 콘솔 프로그램의 입력 방법임." },
        { at: "if user_input.lower() in (\"quit\", \"exit\", \"종료\"):", text: "종료 명령어를 감지해 while 루프를 빠져나감. .lower()로 소문자 변환해 대소문자 구분 없이 비교함." },
        { at: "previous_response_id=previous_response_id,", text: "★핵심★ 이전 응답 ID를 넘기면 서버가 해당 대화의 이력을 찾아 이어줌. messages 리스트를 매번 보낼 필요가 없음." },
        { at: "turn += 1", text: "루프 내 AI 답변 출력 후 새 응답 ID로 갱신함. 항상 '가장 최신 ID'를 유지해야 대화가 올바르게 이어짐. turn을 1 늘려 몇 번째 대화인지 표시함." },
        { at: "if __name__ == \"__main__\":", text: "이 파일을 직접 실행할 때만 main()을 호출함. 다른 파일이 import할 때는 실행되지 않음." },
      ],
      code:
`def main():
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
            print("\\n여행 플래너를 종료합니다. 좋은 여행 되세요!")
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

        print(f"\\n[AI] {reply}\\n")
        turn += 1


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()`,
    },
  ],

  glossary: {
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .resolve()로 절대경로로 바꾸고 .parents[N]으로 N단계 위 폴더를 구함. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(OpenAI 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "sys.stdout.reconfigure": "콘솔(터미널) 출력의 글자 인코딩을 바꾸는 기능. 윈도우에서 한글이 깨지지 않도록 UTF-8로 다시 설정함.",
    "OpenAI 클라이언트": "OpenAI 서버와 통신하는 객체. OpenAI()로 만들고, client.responses.create(...)처럼 이 객체를 통해 API를 호출함.",
    "Responses API": "OpenAI의 새로운 API 방식. previous_response_id 하나로 서버가 이전 대화 이력을 보관하고 이어주므로, 클라이언트가 전체 messages 리스트를 매번 전송할 필요가 없음.",
    "previous_response_id": "직전 API 응답의 고유 ID. 이 값을 다음 호출에 넘기면 서버가 해당 응답에 이어지는 맥락으로 대화를 계속함. 대화 연결 고리 역할.",
    "response.output_text": "Responses API 응답 객체에서 AI가 생성한 텍스트를 바로 꺼내는 속성. 내부 구조를 직접 탐색하지 않아도 됨.",
    "response.id": "각 Responses API 응답에 붙는 고유 번호. 다음 호출에서 previous_response_id로 사용하여 대화를 연결함.",
    "while 반복": "조건이 참인 동안 계속 도는 반복문. while True는 break를 만날 때까지 무한 반복함. 여기서는 사용자가 종료 명령을 입력할 때까지 대화를 반복함.",
    "input()": "콘솔(터미널)에서 사용자가 키보드로 입력한 한 줄을 글자로 받아오는 함수. .strip()으로 앞뒤 공백을 제거함.",
    "if __name__": "if __name__ == \"__main__\": 는 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함. 다른 파일이 import할 때는 실행되지 않음.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
  },
};
