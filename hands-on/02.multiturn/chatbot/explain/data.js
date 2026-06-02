/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../02.multiturn/chatbot/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "멀티턴 여행 플래너 (Gemini + Streamlit) 예제 설명",
    entry: "travel_planner.py",
  },

  files: [
    { id: "main", label: "travel_planner.py", role: "단일 파일 · Gemini 채팅 세션 + Streamlit 웹 UI" },
  ],

  flow: [
    {
      step: 1,
      title: "앱 시작",
      summary: "main()이 호출되어 페이지 제목·아이콘을 설정하고 init_session()으로 초기화 진행",
      detail: "프로그램의 '시작 버튼'이 main()임. 식당 문을 열고 간판을 거는 단계임. Streamlit은 사용자가 뭔가 누를 때마다 코드 전체를 다시 실행하는 특성이 있어서, 최초 진입인지 판별하는 장치(initialized 플래그)가 필요함.",
    },
    {
      step: 2,
      title: "세션 초기화",
      summary: "init_session()이 Gemini 클라이언트·채팅 세션을 만들고, 첫 AI 메시지를 받아 화면에 준비",
      detail: "초기화는 탭을 처음 열었을 때 딱 한 번만 실행됨(initialized 플래그로 보호). Gemini 서버에 채팅 세션(client.chats.create)을 만들면, 이후 대화 이력이 서버 쪽에 자동 누적됨 — 개발자가 이전 대화를 직접 관리할 필요 없음. 첫 AI 인사말은 '대화를 시작합니다' 메시지를 보내 받음.",
    },
    {
      step: 3,
      title: "이전 대화 표시",
      summary: "st.session_state.messages에 저장된 대화를 말풍선으로 화면에 다시 그림",
      detail: "Streamlit은 화면을 매번 새로 그리므로 지난 대화도 항상 다시 그려야 함. messages 목록을 순서대로 꺼내 역할(user/assistant)에 맞는 말풍선으로 출력함. 아직 새 입력을 받기 전 단계임.",
    },
    {
      step: 4,
      title: "사용자 입력 대기",
      summary: "채팅창(st.chat_input)에서 여행지·기간·인원 등 사용자 입력을 기다림",
      detail: "손님의 주문을 기다리는 단계임. 사용자가 '도쿄', '3박 4일', '2명' 같은 내용을 입력하고 Enter를 누르면 다음 단계로 넘어감. 입력이 없으면 여기서 계속 대기함.",
    },
    {
      step: 5,
      title: "입력 저장·표시",
      summary: "입력한 문장을 messages에 추가하고 사용자 말풍선으로 화면에 보여줌",
      detail: "주문서를 받아 적고 손님에게 '확인됐습니다'를 보여주는 단계임. 입력은 messages 목록에 저장되어, 화면을 다시 그릴 때 이전 대화로 표시됨.",
    },
    {
      step: 6,
      title: "AI 응답 생성 (스트리밍)",
      summary: "chat.send_message_stream()이 Gemini에 메시지를 보내고 답변을 조각씩 받아 실시간 출력",
      detail: "주방장(AI)에게 주문서를 넘기고 요리 과정을 실시간으로 보여주는 단계임. 스트리밍 방식이라 답변 전체가 다 만들어지길 기다리지 않고, 조각이 도착할 때마다 화면에 이어 붙임. '▌' 커서가 타이핑 중임을 표시하다가, 완성되면 깔끔한 최종 텍스트로 교체됨.",
    },
    {
      step: 7,
      title: "응답 저장·반복",
      summary: "완성된 답변을 messages에 추가하고, 다음 입력을 기다리기 위해 4번 단계로 돌아감",
      detail: "완성된 요리를 손님에게 내는 단계임. 답변을 messages에 넣어두면, 다음 화면 갱신 때 이전 대화로 표시됨. 핵심은 대화 이력이 Gemini 서버에도 자동 유지되어, 다음 질문에서 이전 맥락을 기억한다는 점임.",
    },
  ],

  functions: [
    // ===== travel_planner.py (모듈 수준 설정) =====
    {
      id: "module_setup",
      name: "모듈 설정 (import · SYSTEM_PROMPT)",
      fileId: "main",
      summary: "파일 맨 위에서 라이브러리를 가져오고, .env에서 API 키를 로드하고, AI에게 줄 지침(SYSTEM_PROMPT)을 정의함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 실행되는 준비 코드'임. load_dotenv가 .env 파일의 API 키를 환경변수로 올려줌. SYSTEM_PROMPT는 AI에게 '너는 여행 플래너야, 이렇게 행동해'라고 알려주는 긴 지침서임. 함수가 아니라 모듈 수준 상수로 정의하여 어디서든 참조할 수 있게 함.",
      terms: ["load_dotenv", "환경변수(.env)", "SYSTEM_PROMPT", "Path(__file__)", "Google Gemini", "system_instruction"],
      lines: [
        { at: "load_dotenv(Path(__file__).resolve().parents[2]", text: "Path(__file__).resolve().parents[2]는 '이 파일에서 2단계 위 폴더'를 뜻함. travel_planner.py → chatbot → 02.multiturn → hands-on 순으로 거슬러 올라가 .env를 찾음." },
        { at: 'SYSTEM_PROMPT = """당신은 친절한 여행 플래너', text: "삼중 따옴표(\"\"\"...\"\"\"로 둘러싼 긴 글 전체가 AI에게 주는 지침임. 여행지·기간·인원 3가지를 파악한 뒤 관광지를 추천하라는 규칙이 담겨 있음." },
      ],
      code:
`"""
Streamlit + Gemini Chat Session을 활용한 멀티턴 여행 플래너 예제

gemini.Client.chats.create()로 서버 측 대화 이력을 유지함.
Streamlit의 st.session_state로 브라우저 탭 생명주기 동안 채팅 세션과 메시지를 보존함.
"""
import os
from pathlib import Path

import streamlit as st
from dotenv import load_dotenv
from google import genai
from google.genai import types

# 이 파일 위치 기준으로 상위 2단계 디렉터리 절대경로를 구함
# .env 파일에서 API 키 등 환경변수를 로드함
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

SYSTEM_PROMPT = """당신은 친절한 여행 플래너 AI입니다.

사용자로부터 아래 3가지 정보를 아직 모두 파악하지 못했다면 한 번에 하나씩 자연스럽게 질문하세요.
1. 여행지 (국내/해외 도시 또는 지역)
2. 여행 기간 (몇박 며칠)
3. 여행 인원 (몇 명)

3가지 정보를 모두 파악하면, 해당 여행지의 관광지를 5곳 이상 추천하고
각 관광지에 대해 간단한 소개와 추천 이유를 설명해 주세요.

대화는 한국어로 진행하세요."""`,
    },

    // ===== init_session() =====
    {
      id: "init_session",
      name: "init_session()",
      fileId: "main",
      summary: "Gemini 채팅 세션을 딱 한 번만 만들고, 첫 AI 인사말을 받아 메시지 저장소에 넣어둠.",
      how: "Streamlit은 화면을 그릴 때마다 코드 전체를 다시 실행함. 그래서 API 키 확인·클라이언트 생성을 매번 하지 않도록 'initialized' 플래그로 보호함. 핵심은 client.chats.create(): 이 함수가 Gemini 서버에 채팅 세션을 열어주고, 이후 대화 이력이 서버 쪽에 자동으로 쌓임 — 개발자가 이전 메시지를 직접 모아서 보낼 필요가 없음. 첫 AI 메시지는 '대화를 시작합니다'를 보내서 받은 인사말임.",
      terms: ["st.session_state", "Streamlit", "Google Gemini", "genai.Client", "chats.create", "system_instruction", "send_message", "API 키", "환경변수(.env)", "st.error", "st.stop"],
      lines: [
        { at: 'if "initialized" in st.session_state:', text: "'initialized'라는 키가 이미 있으면(= 이미 초기화됨) 즉시 return으로 함수를 끝냄. 탭을 처음 열 때 딱 한 번만 초기화하게 하는 보호 장치임." },
        { at: 'api_key = os.environ.get("GEMINI_API_KEY")', text: "os.environ.get으로 환경변수에서 Gemini API 키를 꺼냄. 없으면 None이 됨." },
        { at: 'if not api_key:', text: "키가 없으면 st.error로 빨간 안내를 보여주고, st.stop()으로 코드 실행을 멈춤(오류를 분명하게 알려줌)." },
        { at: 'client = genai.Client(api_key=api_key)', text: "Gemini API와 통신할 '전화기'(클라이언트 객체)를 만듦." },
        { at: 'chat = client.chats.create(', text: "★핵심★ Gemini 서버에 채팅 세션을 여는 가장 중요한 줄임. 이 세션이 열려 있는 동안 대화 이력이 서버에 자동으로 쌓여, 다음 메시지에서 이전 내용을 기억함." },
        { at: 'config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),', text: "system_instruction에 SYSTEM_PROMPT를 넣으면, 모든 대화에 이 지침이 적용됨. AI에게 '넌 여행 플래너야'라고 역할을 부여하는 것임." },
        { at: 'first_response = chat.send_message("대화를 시작합니다.")', text: "채팅 세션을 연 직후 '대화를 시작합니다'를 보내 AI 첫 인사말을 받아옴. 이 첫 메시지가 화면에 가장 먼저 표시됨." },
        { at: 'st.session_state.client = client', text: "st.session_state: 화면을 다시 그려도 사라지지 않는 저장소. 클라이언트·채팅 세션·메시지 목록을 여기에 보관해야 다음 화면 갱신에서도 살아남음." },
        { at: 'st.session_state.initialized = True', text: "초기화가 완료됐다는 표시를 남겨, 다음 실행 때 if문에 걸려 초기화를 건너뜀." },
      ],
      code:
`def init_session():
    """Streamlit 세션 최초 진입 시 Gemini 채팅 세션과 초기 메시지를 설정함"""
    if "initialized" in st.session_state:
        return

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        st.error("GEMINI_API_KEY가 설정되지 않았습니다. hands-on/.env 파일을 확인하세요.")
        st.stop()

    # Google Gemini API 클라이언트 생성
    client = genai.Client(api_key=api_key)
    # 서버 측에서 대화 이력을 관리하는 채팅 세션 생성
    chat = client.chats.create(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
    )

    first_response = chat.send_message("대화를 시작합니다.")

    # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
    st.session_state.client = client
    st.session_state.chat = chat
    st.session_state.messages = [
        {"role": "assistant", "content": first_response.text}
    ]
    st.session_state.initialized = True`,
    },

    // ===== main() =====
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "앱 진입점. 페이지를 꾸미고, 세션을 초기화하고, 대화를 표시·처리하는 전체 흐름을 지휘함.",
      how: "Streamlit 앱이 실행될 때마다(사용자가 뭔가 누를 때마다) 이 함수가 처음부터 끝까지 다시 실행됨. 따라서 'init_session()'은 항상 호출되지만 initialized 플래그 덕분에 초기화는 한 번만 됨. 사용자 입력이 있으면 말풍선을 띄우고, send_message_stream()으로 Gemini에 보내 조각씩 받아 실시간으로 화면에 이어 붙임.",
      terms: ["st.set_page_config", "st.chat_input", "st.chat_message", "st.markdown", "st.empty", ":= (바다코끼리)", "send_message_stream", "스트리밍(streaming)", "Streamlit"],
      lines: [
        { at: 'st.set_page_config(page_title="여행 플래너 AI"', text: "브라우저 탭 제목·아이콘·레이아웃을 정하는 함수. 코드 실행 맨 처음에 한 번만 호출해야 함." },
        { at: 'init_session()', text: "Gemini 채팅 세션 초기화를 시도함. 이미 초기화됐으면 바로 return됨." },
        { at: 'for msg in st.session_state.messages:', text: "저장된 모든 대화를 하나씩 꺼내 말풍선으로 그림. Streamlit은 화면을 매번 새로 그리므로 이전 대화도 항상 다시 그려야 함." },
        { at: 'with st.chat_message(msg["role"]):', text: "msg[\"role\"]이 'user'이면 사람 말풍선, 'assistant'이면 AI 말풍선 모양으로 표시됨." },
        { at: 'st.markdown(msg["content"])', text: "대화 내용을 서식(굵기·목록 등)과 함께 화면에 표시함." },
        { at: 'if prompt := st.chat_input("메시지를 입력하세요...")', text: ":= (바다코끼리 연산자)는 '입력값을 prompt에 담으면서 동시에 비었는지 검사'함. 입력이 있을 때만 아래 블록 실행." },
        { at: 'st.session_state.messages.append({"role": "user"', text: "사용자 입력을 messages 목록에 저장. 다음 화면 갱신 때 이전 대화로 표시됨." },
        { at: 'with st.chat_message("user"):', text: "사용자 말풍선 영역을 만들어 방금 입력한 문장을 표시함." },
        { at: 'with st.chat_message("assistant"):', text: "AI 말풍선 영역을 만들어, 아래 코드의 결과(스트리밍 답변)를 여기 안에 표시함." },
        { at: 'placeholder = st.empty()', text: "st.empty()는 '나중에 내용을 채울 빈 자리'임. 스트리밍 조각이 올 때마다 이 자리를 계속 갱신함." },
        { at: 'for chunk in st.session_state.chat.send_message_stream(prompt):', text: "★핵심★ send_message_stream()이 Gemini에 메시지를 보내고, 응답 조각(chunk)을 하나씩 받아오는 스트리밍 반복문임. 답변 전체를 기다리지 않고 실시간으로 보여줄 수 있음." },
        { at: 'full_response += chunk.text', text: "각 조각의 텍스트를 full_response에 이어 붙임. 모든 조각이 끝나면 full_response가 완전한 답변이 됨." },
        { at: 'placeholder.markdown(full_response + "▌")', text: "'▌' 커서를 붙여 '아직 타이핑 중'임을 시각적으로 표시함. 조각이 올 때마다 같은 자리(placeholder)를 계속 갱신하여 실시간 효과를 만듦." },
        { at: 'placeholder.markdown(full_response)', text: "스트리밍이 끝나면 커서('▌') 없이 완성된 답변으로 교체함." },
        { at: 'st.session_state.messages.append({"role": "assistant"', text: "완성된 AI 답변을 messages에 저장. 다음 화면 갱신 때 이전 대화로 표시됨." },
      ],
      code:
`def main():
    """Streamlit 앱 진입점 — 페이지 구성, 세션 초기화, 채팅 UI 렌더링 수행"""
    st.set_page_config(page_title="여행 플래너 AI", page_icon="✈️", layout="centered")
    st.title("✈️ 여행 플래너 AI")
    st.caption("여행지, 기간, 인원을 알려주시면 맞춤 관광지를 추천해 드립니다.")

    init_session()

    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    # st.chat_input: 채팅창 하단 입력란을 렌더링하고 입력값을 반환함
    # := 는 조건 검사와 동시에 변수에 값을 할당함
    if prompt := st.chat_input("메시지를 입력하세요..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            placeholder = st.empty()
            full_response = ""
            for chunk in st.session_state.chat.send_message_stream(prompt):
                if chunk.text:
                    full_response += chunk.text
                    placeholder.markdown(full_response + "▌")
            placeholder.markdown(full_response)

        st.session_state.messages.append({"role": "assistant", "content": full_response})


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()`,
    },
  ],

  glossary: {
    "Streamlit": "파이썬 코드 몇 줄로 웹 화면을 만들어 주는 도구. 버튼·입력창·채팅 UI를 함수 호출만으로 그릴 수 있어, 웹 개발을 몰라도 앱을 만들 수 있음.",
    "st.session_state": "Streamlit의 '메모장'. 화면을 다시 그려도 사라지지 않게 값을 보관하는 특별한 저장소임. 여기 없는 일반 변수는 화면을 그릴 때마다 초기화됨.",
    "st.set_page_config": "브라우저 탭의 제목·아이콘·레이아웃을 정하는 Streamlit 함수. 코드 실행 맨 처음에 딱 한 번만 호출해야 함.",
    "st.chat_input": "화면 맨 아래에 채팅 입력창을 만들어 주고, 사용자가 입력한 글을 돌려주는 Streamlit 기능.",
    "st.chat_message": "사람/AI 말풍선 모양의 영역을 만들어 주는 기능. with 블록 안에 쓴 내용이 그 말풍선 안에 표시됨.",
    "st.markdown": "글자를 굵게·목록·링크 등 서식과 함께 화면에 표시하는 Streamlit 기능.",
    "st.empty": "'나중에 내용을 채울 빈 자리'를 만들어 두는 기능. 스트리밍처럼 내용이 계속 바뀔 때, 같은 자리를 반복적으로 갱신하는 데 씀.",
    "st.error": "빨간색 오류 안내 메시지를 화면에 표시하는 Streamlit 기능.",
    "st.stop": "이 줄부터 아래 코드 실행을 멈추는 Streamlit 기능. API 키가 없는 등 치명적 오류 시 사용함.",
    "Google Gemini": "Google이 만든 AI 모델 시리즈. 여기서는 gemini-2.5-flash 모델로 여행 플래너 대화를 처리함.",
    "genai.Client": "Google Gemini API와 통신하는 '전화기' 역할의 객체. api_key로 인증하여 만듦.",
    "chats.create": "Gemini 서버에 채팅 세션을 여는 함수. 이 세션 안에서 대화하면 이전 대화 이력이 서버에 자동으로 관리됨 — 개발자가 직접 이력을 모아 보낼 필요 없음.",
    "system_instruction": "AI에게 역할과 행동 규칙을 알려주는 지침. 채팅 세션을 만들 때 설정하면 모든 대화에 자동 적용됨.",
    "send_message": "채팅 세션에 메시지를 보내고 완성된 응답을 한 번에 받는 함수.",
    "send_message_stream": "채팅 세션에 메시지를 보내고 응답을 조각(chunk)씩 받는 함수. 전체 응답이 완성되기 전에 먼저 도착하는 조각부터 화면에 표시할 수 있어 '실시간 타이핑' 효과를 만들 수 있음.",
    "스트리밍(streaming)": "데이터를 전부 받은 뒤 처리하는 게 아니라, 도착하는 조각부터 순서대로 처리하는 방식. 여기서는 AI 답변이 만들어지는 동시에 화면에 표시되어 빠른 느낌을 줌.",
    "SYSTEM_PROMPT": "AI에게 주는 역할과 규칙을 적은 긴 문장. 여기서는 여행지·기간·인원을 파악한 뒤 관광지를 추천하라는 규칙이 담겨 있음.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(Gemini 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'의 경로를 나타냄. .resolve().parents[2]를 붙이면 2단계 위 폴더의 절대경로가 됨.",
    ":= (바다코끼리)": "값을 변수에 '담으면서 동시에' 그 값을 검사하는 연산자. 모양이 바다코끼리 눈·엄니를 닮아 붙은 별명. 예: if prompt := 입력값: 은 입력을 prompt에 담고 비었는지 바로 확인함.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
    "멀티턴(Multi-turn)": "여러 번 주고받는 대화. 이전에 무슨 말을 했는지 기억하며 이어지는 대화 방식임. 여기서는 Gemini 서버가 이력을 관리해줌.",
  },
};
