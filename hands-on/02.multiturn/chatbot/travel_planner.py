"""
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

대화는 한국어로 진행하세요."""


def init_session():
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
    st.session_state.initialized = True


def main():
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
    main()
