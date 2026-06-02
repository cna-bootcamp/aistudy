/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../08.function-call/claude/streaming/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "여행 플래너 (Claude Streaming) 예제 설명",
    entry: "travel_planner.py",
  },

  files: [
    { id: "main",    label: "travel_planner.py",      role: "메인 파일 · 스트리밍 채팅 흐름 전체 지휘" },
    { id: "tools",   label: "common/tools.py",         role: "외부 API 도구(날씨·관광지·맛집) + 함수 실행 디스패처" },
    { id: "prompts", label: "common/prompts.py",       role: "시스템 프롬프트 + 도구 스키마(JSON) 정의" },
    { id: "llm",     label: "common/llm.py",           role: "Claude 클라이언트 생성 및 API 키 헬퍼" },
    { id: "uitext",  label: "common/ui_text.py",       role: "화면에 표시할 안내 문구 상수 모음" },
  ],

  flow: [
    { step: 1, title: "앱 시작",
      summary: "main()이 실행되어 화면 제목·아이콘을 정하고, 기억 공간(session_state)을 준비함",
      detail: "프로그램의 '시작 버튼'이 main() 함수임. 식당으로 비유하면 문을 열고 간판을 거는 단계임. initialize_session_state()가 대화 내용·클라이언트·도구 기록·대화 횟수를 담을 빈 상자를 만들어 둠." },
    { step: 2, title: "화면 구성",
      summary: "왼쪽 사이드바(사용법·기술 흐름·도구 기록)와 이전 대화를 화면에 그림",
      detail: "손님이 앉기 전 메뉴판·안내문을 세팅하는 단계임. display_sidebar()는 왼쪽 도움말, display_chat_history()는 지금까지 오간 대화를 다시 그려줌. 아직 새 입력은 받기 전임." },
    { step: 3, title: "사용자 입력 대기",
      summary: "화면 맨 아래 채팅창(st.chat_input)에서 '서울', '도쿄 날씨' 같은 입력을 기다림",
      detail: "손님 주문을 기다리는 단계임. 사용자가 도시명이나 질문을 입력하고 Enter를 누르면 다음 단계로 넘어감. 입력이 없으면 여기서 계속 대기함." },
    { step: 4, title: "입력 저장·표시",
      summary: "입력한 문장을 대화 기록에 추가하고, 사용자 말풍선으로 화면에 보여줌",
      detail: "주문서를 받아 적고 손님에게 '주문 확인됐습니다'라고 보여주는 단계임. 입력은 messages 목록에 저장되어 이후 대화에서도 맥락으로 활용됨." },
    { step: 5, title: "스트리밍 시작",
      summary: "st.write_stream()이 stream_response() 제너레이터를 실행하며 글자를 실시간으로 화면에 표시함",
      detail: "주방에서 요리가 완성되는 대로 그릇에 담아 바로 내오는 단계임. 모든 텍스트가 완성될 때까지 기다리지 않고, AI가 생성하는 글자 조각(chunk)을 받는 즉시 화면에 보여줌. 이 실시간 출력을 스트리밍이라 함." },
    { step: 6, title: "첫 스트림 · stop_reason 확인",
      summary: "client.messages.stream()으로 API에 연결하고, 텍스트 청크를 yield 하면서 stop_reason을 확인함",
      detail: "AI에게 질문을 보내고 답변을 흘려받는 핵심 단계임. 텍스트가 있으면 즉시 화면에 출력하고, 스트림이 끝나면 get_final_message()로 'AI가 지금 답변을 끝냈는지(end_turn)' 아니면 '도구가 필요한지(tool_use)'를 확인함." },
    { step: 7, title: "도구 실행 (tool_use인 경우)",
      summary: "stop_reason이 tool_use면 run_tool_calls()가 함수를 실행하고 결과를 messages에 추가함",
      detail: "주방장(AI)이 '재료(외부 데이터)가 필요하다'고 신호를 보낸 단계임. execute_function()이 허용된 함수(get_weather·get_tourist_attractions·get_restaurants)만 골라 실제 API를 호출함. 결과는 tool_result 메시지로 포장해 messages에 추가함." },
    { step: 8, title: "재호출 반복 (최대 5회)",
      summary: "도구 결과를 담아 AI를 다시 호출하는 루프를 MAX_TOOL_ROUNDS까지 반복함",
      detail: "개발자가 직접 짠 for 루프가 도구 호출 → AI 재호출을 반복함. 09.langchain의 create_react_agent는 이 과정을 라이브러리가 자동으로 처리하지만, 이 예제는 수동으로 구현함. stop_reason이 end_turn이 되면 루프를 빠져나옴." },
    { step: 9, title: "결과 저장·사이드바 업데이트",
      summary: "완성된 답변을 대화 기록에 저장하고, 어떤 함수가 호출됐는지 사이드바에 표시함",
      detail: "완성된 요리를 손님에게 내고 주문 기록을 남기는 단계임. st.write_stream()이 누적된 전체 텍스트를 반환하면 messages에 저장함. 직전에 호출된 함수 기록(last_tool_trace)도 왼쪽 패널에 보여줌." },
    { step: 10, title: "반복",
      summary: "사용자가 새 입력을 하면 3번 단계부터 다시 진행함",
      detail: "추가 주문이 들어오면 같은 과정을 반복함. 이전 대화가 messages에 남아 있어 '거기 맛집은?' 같은 이어지는 질문도 맥락을 이해함." },
  ],

  functions: [
    // ===== travel_planner.py (메인) =====
    {
      id: "module_setup",
      name: "모듈 설정 (경로·sys.path)",
      fileId: "main",
      summary: "파일 맨 위에서 common/ 공통 모듈 경로를 Python 검색 경로에 추가하고, 스트리밍에 필요한 라이브러리를 임포트함.",
      how: "함수가 아닌 '프로그램 시작 시 한 번 준비하는 설정 코드'임. streaming/ 디렉터리 기준으로 위로 두 단계 올라가야 common/에 닿기 때문에 .parent.parent를 두 번 씀. sys.path.insert(0, ...)가 없으면 파이썬이 common/을 찾지 못해 import 오류가 남.",
      terms: ["Path(__file__)", "sys.path.insert", "제너레이터(Generator)", "타입 힌트", "from __future__ import annotations"],
      lines: [
        { at: 'from __future__ import annotations', text: "타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 하는 특별한 import 선언임. 파일 맨 첫 줄에 써야 함." },
        { at: 'CURRENT_DIR = Path(__file__).resolve().parent', text: "Path(__file__)은 '지금 이 파이썬 파일 자체'를 가리킴. .resolve().parent로 이 파일이 든 폴더(claude/streaming/)의 절대경로를 구함." },
        { at: 'COMMON_DIR = CURRENT_DIR.parent.parent / "common"', text: ".parent를 두 번 올라가 08.function-call 루트에 도달한 뒤 common/ 폴더를 가리킴." },
        { at: 'sys.path.insert(0, str(COMMON_DIR))', text: "파이썬이 모듈을 검색하는 경로 목록 맨 앞에 common/을 추가함. 이래야 'from llm import ...'처럼 common/ 안의 파일을 import할 수 있음." },
      ],
      code:
`from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import json
import sys
from pathlib import Path
from typing import Any, Generator

import streamlit as st


# ---------------------------------------------------------------------------
# 공통 모듈 import 경로 설정
# ---------------------------------------------------------------------------
# streaming/ 하위 디렉터리에서 실행하므로 parent를 두 번 올라가야 함.
# CURRENT_DIR: claude/streaming/
# COMMON_DIR:  08.function-call/common/
CURRENT_DIR = Path(__file__).resolve().parent  # 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
COMMON_DIR = CURRENT_DIR.parent.parent / "common"
if str(COMMON_DIR) not in sys.path:
    sys.path.insert(0, str(COMMON_DIR))  # 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 디렉터리를 추가함

from llm import create_claude_client, load_hands_on_env  # noqa: E402
from prompts import SYSTEM_PROMPT, get_claude_tools  # noqa: E402
from tools import execute_function  # noqa: E402
from ui_text import APP_ICON, APP_TITLE, TECH_GUIDE, USAGE_GUIDE, WELCOME_MESSAGE  # noqa: E402


MODEL_NAME = "claude-sonnet-4-6"
MAX_TOOL_ROUNDS = 5`,
    },
    {
      id: "initialize_session_state",
      name: "initialize_session_state()",
      fileId: "main",
      summary: "화면을 새로 그릴 때마다 사라지지 않고 유지해야 할 데이터(대화·클라이언트 등)를 위한 빈 저장 공간을 만듦.",
      how: "Streamlit은 사용자가 무언가 누를 때마다 코드를 처음부터 다시 실행함. 그래서 일반 변수는 매번 초기화됨. st.session_state라는 특별한 저장소에 넣어두면 탭이 열려 있는 동안 값이 유지됨. 'if 키가 없으면 만든다' 패턴으로, 이미 있으면 덮어쓰지 않음.",
      terms: ["st.session_state", "Streamlit", "딕셔너리(dict)"],
      lines: [
        { at: 'if "messages" not in st.session_state:', text: "messages(대화 내용)라는 항목이 아직 없을 때만 빈 목록 []으로 만듦. 이미 있으면 건드리지 않아 기존 대화가 보존됨." },
        { at: 'if "client" not in st.session_state:', text: "client는 Claude API와 통신하는 객체임. 비용과 속도를 위해 한 번만 만들어 재사용함." },
        { at: 'if "last_tool_trace" not in st.session_state:', text: "last_tool_trace는 직전에 어떤 함수를 호출했는지 기록을 담을 빈 목록임." },
        { at: 'if "turn_count" not in st.session_state:', text: "turn_count는 대화를 몇 번 주고받았는지 세는 숫자임. 0부터 시작." },
      ],
      code:
`def initialize_session_state() -> None:
    """Streamlit rerun 사이에 유지할 상태를 초기화함."""
    if "messages" not in st.session_state:  # st.session_state: 브라우저 탭이 열려 있는 동안 데이터를 유지하는 저장소
        st.session_state.messages = []
    if "client" not in st.session_state:
        st.session_state.client = None
    if "last_tool_trace" not in st.session_state:
        st.session_state.last_tool_trace = []
    if "turn_count" not in st.session_state:
        st.session_state.turn_count = 0`,
    },
    {
      id: "get_client",
      name: "get_client()",
      fileId: "main",
      summary: "Claude API와 통신할 클라이언트 객체를 한 번만 만들어 두고, 이후에는 저장해 둔 것을 재사용함.",
      how: "클라이언트를 만들 때마다 API 키를 읽고 연결을 설정하는 비용이 발생함. 처음 한 번만 만들어 st.session_state.client에 보관해 두고 재사용하는 '지연 생성 + 캐싱' 패턴임.",
      terms: ["지연 생성(lazy)", "캐싱(cache)", "Anthropic SDK"],
      lines: [
        { at: 'if st.session_state.client is None:', text: "client가 아직 없을(None) 때만 새로 만듦. 이미 있으면 이 블록을 건너뛰고 저장된 것을 그대로 씀." },
        { at: 'load_hands_on_env()', text: "hands-on/.env 파일을 읽어 CLAUDE_API_KEY 같은 환경변수를 프로그램에 등록함." },
        { at: 'st.session_state.client = create_claude_client()', text: "create_claude_client()가 API 키로 Anthropic 클라이언트를 만들어 저장함(캐싱)." },
        { at: 'return st.session_state.client', text: "준비된(또는 새로 만든) 클라이언트를 돌려줌." },
      ],
      code:
`def get_client() -> Any:
    """hands-on/.env 기반 Claude 클라이언트를 생성하고 재사용함."""
    if st.session_state.client is None:
        load_hands_on_env()
        st.session_state.client = create_claude_client()
    return st.session_state.client`,
    },
    {
      id: "build_chat_messages",
      name: "build_chat_messages(user_input)",
      fileId: "main",
      summary: "화면에 쌓인 대화와 새 입력을, Claude Messages API가 알아듣는 딕셔너리 목록으로 변환함.",
      how: "AI에게 보낼 '주문서'를 정리하는 함수임. 비용을 아끼기 위해 최근 10개 대화만 담고, 역할이 user/assistant인 것만 포함함. 마지막에 이번 새 입력을 붙임. 시스템 프롬프트는 별도로 stream() 호출 시 system= 인자로 전달함.",
      terms: ["딕셔너리(dict)", "리스트(list)", "타입 힌트"],
      lines: [
        { at: 'messages: list[dict[str, Any]] = []', text: "list[dict[str, Any]]는 '딕셔너리를 담는 목록' 타입임. 빈 목록으로 시작함." },
        { at: 'for message in st.session_state.messages[-10:]:', text: "[-10:]은 '뒤에서 10개만' 잘라오는 파이썬 문법임. 대화가 길어질수록 비용이 늘기 때문에 최근 것만 보냄." },
        { at: 'if message["role"] in {"user", "assistant"}:', text: "역할이 user 또는 assistant인 메시지만 포함함. 집합({ })으로 검사해 빠르게 확인함." },
        { at: 'messages.append({"role": "user", "content": user_input})', text: "마지막으로 이번에 새로 입력한 문장을 user 역할로 추가함." },
      ],
      code:
`def build_chat_messages(user_input: str) -> list[dict[str, Any]]:
    """Claude Messages API에 전달할 메시지 배열을 구성함."""
    messages: list[dict[str, Any]] = []
    for message in st.session_state.messages[-10:]:
        if message["role"] in {"user", "assistant"}:
            messages.append({"role": message["role"], "content": message["content"]})
    messages.append({"role": "user", "content": user_input})
    return messages`,
    },
    {
      id: "run_tool_calls",
      name: "run_tool_calls(response)",
      fileId: "main",
      summary: "AI가 요청한 도구 호출을 모두 실행하고, 결과를 담은 tool_result 메시지를 만들어 돌려줌.",
      how: "AI가 'get_weather를 Seoul로 호출해줘'라고 요청(tool_use 블록)하면, 이 함수가 실제 API를 호출하고 그 결과를 Claude가 이해하는 tool_result 형식으로 포장함. tool_use_id로 '어떤 요청의 결과인지'를 짝지어야 AI가 올바르게 이어갈 수 있음.",
      terms: ["tool_use 블록", "tool_result", "tool_use_id", "execute_function", "JSON", "타입 힌트"],
      lines: [
        { at: 'for block in (response.content or []):', text: "AI 응답(response.content)에 들어있는 블록들을 하나씩 확인함. None일 경우를 대비해 'or []'로 안전하게 처리함." },
        { at: 'if not (hasattr(block, "type") and block.type == "tool_use"):', text: "블록이 tool_use 타입인지 확인함. 아니면 건너뜀(continue). hasattr로 속성 존재 여부를 먼저 확인하는 안전 처리임." },
        { at: 'result = execute_function(function_name, function_args)', text: "execute_function이 허용된 함수 목록에서 해당 함수를 찾아 실제 API를 호출함." },
        { at: '"tool_use_id": block.id,', text: "tool_use_id는 어떤 tool_use 요청의 결과인지 AI가 매칭하는 필수 식별자임. 없으면 AI가 결과를 어떤 요청과 연결해야 할지 모름." },
        { at: 'tool_result_message = {"role": "user", "content": tool_result_blocks}', text: "모든 tool_result를 하나의 user 역할 메시지로 묶어 반환함. Claude API 규칙: tool_result는 반드시 role=user 메시지에 담아야 함." },
      ],
      code:
`def run_tool_calls(response: Any) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """assistant 턴의 모든 tool_use 블록을 실행하고 tool_result user 메시지를 반환함.

    streaming 버전에서도 tool_result 전달 방식은 동일함:
    - 모든 tool_result 블록을 단일 role="user" 메시지에 묶어 전달
    - tool_use_id로 assistant tool_use 블록과 함수 결과를 1:1 매칭
    """
    tool_result_blocks: list[dict[str, Any]] = []
    traces: list[dict[str, Any]] = []

    for block in (response.content or []):
        if not (hasattr(block, "type") and block.type == "tool_use"):
            continue

        function_name = block.name
        function_args = dict(block.input) if block.input else {}
        result = execute_function(function_name, function_args)

        traces.append({
            "function": function_name,
            "arguments": function_args,
            "has_error": isinstance(result, dict) and bool(result.get("error")),
        })

        tool_result_blocks.append({
            "type": "tool_result",
            "tool_use_id": block.id,
            "content": json.dumps(result, ensure_ascii=False),
        })

    tool_result_message = {"role": "user", "content": tool_result_blocks}
    return tool_result_message, traces`,
    },
    {
      id: "stream_response",
      name: "stream_response(user_input)",
      fileId: "main",
      summary: "AI 답변을 글자 조각(청크)으로 실시간 yield하는 제너레이터. 도구 호출이 필요하면 함수를 실행하고 다시 스트리밍함.",
      how: "이 함수가 스트리밍의 핵심임. 'yield'를 사용하는 제너레이터 함수라 호출하면 바로 실행되지 않고, st.write_stream()이 글자 조각을 하나씩 꺼낼 때마다 조금씩 실행됨. 내부에서 MAX_TOOL_ROUNDS 횟수만큼 루프를 돌며: ①스트림 열기→②청크 yield→③stop_reason 확인→④tool_use면 함수 실행→⑤루프 반복.",
      terms: ["제너레이터(Generator)", "yield", "client.messages.stream()", "text_stream", "get_final_message()", "stop_reason", "MAX_TOOL_ROUNDS", "컨텍스트 매니저(with)"],
      lines: [
        { at: 'for _ in range(MAX_TOOL_ROUNDS):', text: "최대 5번까지 AI 호출을 반복할 수 있는 루프임. 무한 루프 방지용 안전장치임." },
        { at: 'with client.messages.stream(', text: "★핵심★ client.messages.stream()은 스트리밍 응답을 관리하는 컨텍스트 매니저임. with 블록에 들어갈 때 API 연결을 열고, 나올 때 닫음." },
        { at: 'for text_chunk in stream.text_stream:', text: "text_stream은 AI가 생성하는 텍스트 조각을 하나씩 꺼낼 수 있는 이터레이터임. yield로 각 조각을 즉시 화면에 전달함." },
        { at: 'final_message = stream.get_final_message()', text: "스트림이 끝난 후 전체 메시지를 가져옴. 이 안의 stop_reason으로 AI가 왜 멈췄는지 알 수 있음." },
        { at: 'if final_message.stop_reason != "tool_use":', text: "stop_reason이 end_turn이면 AI가 답변을 완료한 것 → 루프를 빠져나옴. tool_use면 아래에서 함수를 실행하고 루프를 계속함." },
        { at: 'messages.append({"role": "assistant", "content": final_message.content})', text: "AI가 tool_use를 요청한 내용을 messages에 추가함. content를 그대로 보존해야 tool_use_id 매칭이 유지됨." },
        { at: 'yield "함수 호출이 반복되어 처리를 중단함', text: "MAX_TOOL_ROUNDS를 다 썼는데도 끝나지 않으면 루프를 탈출해 안내 메시지를 yield함." },
      ],
      code:
`def stream_response(user_input: str) -> Generator[str, None, None]:
    """텍스트 청크를 순서대로 yield하는 스트리밍 제너레이터.

    tool_use가 필요한 경우 내부에서 함수를 실행하고
    최종 답변을 스트리밍으로 이어서 반환함.

    핵심 흐름:
    1. client.messages.stream()으로 스트리밍 컨텍스트 진입
    2. stream.text_stream 이터레이터로 텍스트 청크를 순서대로 yield
    3. stream.get_final_message()로 stop_reason 확인
    4. stop_reason == "tool_use": 함수 실행 후 새 스트림 시작
    5. stop_reason == "end_turn": 스트리밍 완료
    """
    client = get_client()
    tools = get_claude_tools()
    messages = build_chat_messages(user_input)
    tool_trace: list[dict[str, Any]] = []

    for _ in range(MAX_TOOL_ROUNDS):
        # client.messages.stream()은 스트리밍 응답을 관리하는 컨텍스트 매니저임.
        # __enter__ 시점에 API 연결을 열고 __exit__ 시점에 닫음.
        with client.messages.stream(
            model=MODEL_NAME,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=tools,
            messages=messages,
        ) as stream:
            # text_stream은 type=="text" 블록의 내용을 청크 단위로 yield함.
            # tool_use 블록이 있는 턴에는 텍스트 청크가 없을 수 있음.
            for text_chunk in stream.text_stream:
                yield text_chunk

            # 스트림 완료 후 최종 메시지를 가져와 stop_reason을 확인함.
            # get_final_message()는 스트리밍이 끝난 후에만 호출 가능함.
            final_message = stream.get_final_message()

        if final_message.stop_reason != "tool_use":
            st.session_state.last_tool_trace = tool_trace
            return

        # tool_use: assistant content(블록 리스트)를 메시지 이력에 추가한 후 함수 실행
        # content를 그대로 보존해야 tool_use_id 매칭이 유지됨
        messages.append({"role": "assistant", "content": final_message.content})
        tool_result_message, traces = run_tool_calls(final_message)
        tool_trace.extend(traces)
        messages.append(tool_result_message)

    st.session_state.last_tool_trace = tool_trace
    yield "함수 호출이 반복되어 처리를 중단함. 요청을 더 구체적으로 입력해 주세요."`,
    },
    {
      id: "display_chat_history",
      name: "display_chat_history()",
      fileId: "main",
      summary: "저장된 지난 대화를 화면에 말풍선으로 다시 그려줌.",
      how: "Streamlit은 화면을 매번 새로 그리므로, 이전 대화도 매번 다시 그려야 함. messages에 저장된 각 항목을 역할(user/assistant)에 맞는 말풍선으로 출력함.",
      terms: ["st.chat_message", "st.markdown", "Streamlit"],
      lines: [
        { at: 'for message in st.session_state.messages:', text: "저장된 대화 하나하나를 순서대로 꺼냄." },
        { at: 'with st.chat_message(message["role"]):', text: "st.chat_message(역할)은 사람/AI 말풍선 모양의 영역을 만들어 줌. with 블록 안의 내용이 그 말풍선 안에 표시됨." },
        { at: 'st.markdown(message["content"])', text: "st.markdown은 글자를 굵게·목록·링크 등 서식과 함께 화면에 표시함." },
      ],
      code:
`def display_chat_history() -> None:
    """저장된 대화 이력을 Streamlit 채팅 UI에 표시함."""
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])`,
    },
    {
      id: "display_sidebar",
      name: "display_sidebar()",
      fileId: "main",
      summary: "왼쪽 사이드바에 사용법·기술 흐름·대화 턴 수·초기화 버튼·직전 함수 호출 기록을 표시함.",
      how: "화면 왼쪽의 보조 패널을 구성함. with st.sidebar 블록 안의 내용은 모두 왼쪽에 표시됨. '대화 초기화' 버튼을 누르면 저장된 대화를 비우고 st.rerun()으로 화면을 새로 그림. 직전에 호출된 함수가 있으면 성공/오류와 함께 보여줌.",
      terms: ["st.sidebar", "st.rerun", "JSON"],
      lines: [
        { at: 'with st.sidebar:', text: "with st.sidebar: 이 블록 안에서 출력하는 모든 것이 왼쪽 사이드바에 표시됨." },
        { at: 'st.metric("대화 턴"', text: "대화 턴(주고받은 횟수)을 숫자 지표로 보여줌." },
        { at: 'if st.button("대화 초기화"', text: "'대화 초기화' 버튼. 누르면 아래 줄들이 실행되어 기록을 모두 비움." },
        { at: 'st.rerun()', text: "st.rerun()은 화면(코드)을 처음부터 다시 실행하게 함(초기화 결과를 즉시 반영)." },
        { at: 'st.header("직전 함수 호출")', text: "직전에 호출된 함수 기록이 있으면, 함수명·인자·성공여부를 코드 블록으로 표시함." },
      ],
      code:
`def display_sidebar() -> None:
    """예제 사용법과 직전 Tool Use trace를 표시함."""
    with st.sidebar:
        st.header("사용 방법")
        st.markdown(USAGE_GUIDE)

        st.divider()
        st.header("기술 흐름")
        st.markdown(TECH_GUIDE)

        st.divider()
        st.metric("대화 턴", st.session_state.turn_count)

        if st.button("대화 초기화", use_container_width=True):
            st.session_state.messages = []
            st.session_state.last_tool_trace = []
            st.session_state.turn_count = 0
            st.rerun()

        if st.session_state.last_tool_trace:
            st.divider()
            st.header("직전 함수 호출")
            for trace in st.session_state.last_tool_trace:
                status = "오류" if trace["has_error"] else "성공"
                st.code(
                    f"{trace['function']}({json.dumps(trace['arguments'], ensure_ascii=False)})"
                    f" -> {status}",
                    language="text",
                )`,
    },
    {
      id: "main_func",
      name: "main()",
      fileId: "main",
      summary: "앱의 시작점. 화면을 세팅하고, 입력을 받고, 스트리밍 답변을 생성·표시하는 전체 흐름을 지휘함.",
      how: "프로그램의 '시작 버튼'에 해당함. 페이지 설정→상태 초기화→사이드바·환영문·이전 대화 표시→채팅창 입력 처리 순으로 진행함. 사용자가 입력하면 st.write_stream()이 stream_response 제너레이터를 받아 실시간으로 글자를 화면에 출력함.",
      terms: ["st.chat_input", "st.write_stream", ":= (바다코끼리)", "예외 처리(try/except)", "Streamlit", "if __name__"],
      lines: [
        { at: 'st.set_page_config(', text: "st.set_page_config는 브라우저 탭 제목·아이콘·레이아웃을 정함. 코드 맨 처음에 한 번 호출해야 함." },
        { at: 'if user_input := st.chat_input(', text: "★중요 문법★ := (바다코끼리 연산자)는 '입력값을 user_input에 담으면서 동시에 비었는지 검사'함. 입력이 있을 때만 if 블록이 실행됨." },
        { at: 'assistant_response = st.write_stream(stream_response(user_input))', text: "★핵심★ st.write_stream()은 stream_response 제너레이터에서 글자 조각을 받는 즉시 화면에 표시하고, 완료 후 전체 텍스트를 반환함." },
        { at: 'except Exception as exc:', text: "오류가 나도 앱이 멈추지 않도록 try/except로 감싸 오류 메시지로 대체함." },
        { at: 'if __name__ == "__main__":', text: "이 파일을 직접 실행할 때만 아래 코드를 수행함(import 시 미실행)." },
      ],
      code:
`def main() -> None:
    """Streamlit 앱 진입점."""
    st.set_page_config(
        page_title=f"{APP_TITLE} - Claude (Streaming)",
        page_icon=APP_ICON,
        layout="centered",
    )
    st.title(APP_TITLE)
    st.caption("Claude Messages API Tool Use + Streaming + Streamlit")

    initialize_session_state()
    display_sidebar()

    if not st.session_state.messages:
        with st.chat_message("assistant"):
            st.markdown(WELCOME_MESSAGE)

    display_chat_history()

    if user_input := st.chat_input("예: 서울, 도쿄 날씨, 파리 관광지, 부산 맛집"):  # st.chat_input: 채팅창 하단 입력란을 렌더링하고 입력값을 반환함 / := 는 조건 검사와 동시에 변수에 값을 할당함
        st.session_state.messages.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.markdown(user_input)

        with st.chat_message("assistant"):
            try:
                # st.write_stream()은 제너레이터에서 텍스트 청크를 받아
                # 실시간으로 화면에 렌더링하고 누적된 전체 텍스트를 반환함.
                assistant_response = st.write_stream(stream_response(user_input))
            except Exception as exc:
                assistant_response = f"오류가 발생함: {exc}"
                st.markdown(assistant_response)

        st.session_state.messages.append({"role": "assistant", "content": assistant_response})
        st.session_state.turn_count += 1


if __name__ == "__main__":  # 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
    main()`,
    },

    // ===== common/tools.py (도구) =====
    {
      id: "normalize_city_name",
      name: "normalize_city_name(city)",
      fileId: "tools",
      summary: "'서울', '도쿄' 같은 한글 도시명을 외부 API가 알아듣는 영문('Seoul', 'Tokyo')으로 바꿈.",
      how: "날씨·지도 API는 영문 도시명을 받음. 미리 만들어 둔 표(CITY_NAME_MAP)에서 한글을 찾아 영문으로 바꿔줌. 표에 없으면 입력을 그대로 돌려줌. 앞뒤 공백은 strip()으로 제거함.",
      terms: ["딕셔너리(dict)", ".get()", "타입 힌트"],
      lines: [
        { at: 'cleaned = (city or "").strip()', text: "(city or \"\")는 city가 비어있으면 빈 문자열을 쓰라는 안전장치임. .strip()은 앞뒤 공백을 제거함." },
        { at: 'if cleaned in CITY_NAME_MAP:', text: "정리한 도시명이 표(CITY_NAME_MAP)에 있는지 확인함. 없으면 맨 아래에서 입력을 그대로 반환함." },
        { at: 'return CITY_NAME_MAP[cleaned]', text: "표에 있으면 짝이 되는 영문 도시명을 돌려줌(예: 서울 → Seoul)." },
      ],
      code:
`def normalize_city_name(city: str) -> str:
    """한국어 또는 혼용 도시명을 API에서 사용하는 영문 도시명으로 변환하여 반환."""
    cleaned = (city or "").strip()
    if not cleaned:
        return cleaned
    if cleaned in CITY_NAME_MAP:
        return CITY_NAME_MAP[cleaned]
    return cleaned`,
    },
    {
      id: "execute_function",
      name: "execute_function(function_name, arguments)",
      fileId: "tools",
      summary: "AI가 요청한 함수 이름을 받아, 허용된 함수만 실행하는 '화이트리스트 디스패처'임.",
      how: "AI가 '이 함수를 호출해줘'라고 이름을 문자열로 보내면, 이 함수가 허용 목록(available_functions)에서 찾아 실행함. 목록에 없는 이름이면 오류를 반환해 임의 함수 실행을 막음(보안). 도시명 정규화도 여기서 일괄 처리함.",
      terms: ["화이트리스트(whitelist)", "딕셔너리(dict)", "예외 처리(try/except)", "타입 힌트"],
      lines: [
        { at: 'available_functions = {', text: "허용된 함수 이름과 실제 함수 객체를 짝지은 딕셔너리임. 여기 없는 이름은 절대 실행되지 않음(보안)." },
        { at: 'if function_name not in available_functions:', text: "AI가 보낸 함수 이름이 허용 목록에 없으면, 오류 딕셔너리를 반환하고 실행하지 않음." },
        { at: 'safe_arguments["city"] = normalize_city_name(str(safe_arguments["city"]))', text: "city 인자가 있으면 영문으로 변환함. AI가 한글 도시명을 보내더라도 API가 알아듣게 만들어줌." },
        { at: 'return available_functions[function_name](**safe_arguments)', text: "함수 이름으로 실제 함수를 찾아 **safe_arguments(인자 딕셔너리 펼치기)로 실행하고 결과를 반환함." },
      ],
      code:
`# LLM이 요청한 함수를 화이트리스트(허용 목록) 기반으로만 실행함
# (임의 함수 실행을 막아 코드 인젝션 등 보안 위협을 방지함)
def execute_function(function_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """LLM 도구 호출 요청에 따라 허용된 함수만 실행하여 결과 반환."""
    available_functions = {
        "get_weather": get_weather,
        "get_tourist_attractions": get_tourist_attractions,
        "get_restaurants": get_restaurants,
    }
    if function_name not in available_functions:
        return {"error": f"알 수 없는 함수임: {function_name}"}

    try:
        safe_arguments = dict(arguments or {})
        if "city" in safe_arguments:
            safe_arguments["city"] = normalize_city_name(str(safe_arguments["city"]))
        return available_functions[function_name](**safe_arguments)
    except TypeError as exc:
        return {"error": f"함수 인자 오류: {exc}"}
    except Exception as exc:
        return {"error": f"함수 실행 오류: {exc}"}`,
    },
    {
      id: "get_weather",
      name: "get_weather(city)",
      fileId: "tools",
      summary: "도시의 현재 날씨를 조회하여 기온·체감·습도·바람 정보를 딕셔너리로 돌려줌.",
      how: "OpenWeatherMap API를 호출해 날씨 데이터를 받아옴. API 키가 없으면 즉시 error 항목을 담아 반환함(멈추지 않음). 통신 오류가 나도 except로 잡아 error 항목을 담아 반환하므로 앱이 죽지 않음.",
      terms: ["requests", "raise_for_status()", "환경변수(.env)", "API 키", "예외 처리(try/except)", "딕셔너리(dict)"],
      lines: [
        { at: 'if not OPENWEATHER_API_KEY:', text: "날씨 API 키가 없으면, 멈추지 않고 error 메시지를 담은 결과를 돌려줌." },
        { at: 'city_en = normalize_city_name(city)', text: "도시명을 먼저 영문으로 변환해 API에 전달함." },
        { at: 'data = _request_json(', text: "_request_json이 실제 인터넷 요청을 보내고 JSON 응답을 받아옴." },
        { at: 'except requests.exceptions.HTTPError as exc:', text: "통신 오류가 나도 앱이 죽지 않게 error 항목을 담아 정상적으로 반환함." },
      ],
      code:
`def get_weather(city: str) -> dict[str, Any]:
    """OpenWeatherMap Current Weather API로 도시 현재 날씨를 조회하여 반환."""
    if not OPENWEATHER_API_KEY:
        return {"error": f"OPENWEATHER_API_KEY가 설정되지 않았습니다: {HANDS_ON_ENV_PATH}"}

    city_en = normalize_city_name(city)
    params = {
        "q": city_en,
        "appid": OPENWEATHER_API_KEY,
        "units": "metric",
        "lang": "kr",
    }

    try:
        data = _request_json(
            "GET",
            "https://api.openweathermap.org/data/2.5/weather",
            params=params,
        )
        weather = data.get("weather", [{}])[0]
        main = data.get("main", {})
        wind = data.get("wind", {})
        return {
            "city": city_en,
            "weather": weather.get("main", ""),
            "description": weather.get("description", ""),
            "temperature": main.get("temp"),
            "feels_like": main.get("feels_like"),
            "humidity": main.get("humidity"),
            "wind_speed": wind.get("speed"),
        }
    except requests.exceptions.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else "unknown"
        return {"error": f"OpenWeatherMap HTTP 오류: {status_code}", "city": city_en}
    except requests.exceptions.RequestException as exc:
        return {"error": f"OpenWeatherMap 네트워크 오류: {exc}", "city": city_en}`,
    },

    {
      id: "get_tourist_attractions",
      name: "get_tourist_attractions(city, max_results)",
      fileId: "tools",
      summary: "도시의 대표 관광지를 평점·주소·설명·지도 링크와 함께 검색하여 돌려줌.",
      how: "내부적으로 _search_places()를 호출해 구글 장소 API에서 관광지를 찾음. max_results 기본값이 DEFAULT_MAX_RESULTS(8)로 설정돼 있어, AI가 개수를 지정하지 않아도 자동으로 8개를 가져옴.",
      terms: ["딕셔너리(dict)", "예외 처리(try/except)", "타입 힌트"],
      lines: [
        { at: 'def get_tourist_attractions(city: str, max_results: int = DEFAULT_MAX_RESULTS)', text: "max_results: int = DEFAULT_MAX_RESULTS는 '값을 안 주면 기본 8개'라는 기본값 인자임." },
        { at: 'places = _search_places(f"top tourist attractions in {city_en}"', text: "공용 검색 함수 _search_places로 'top tourist attractions in 도시' 질의를 보냄." },
        { at: '"attractions": places,', text: "정리된 관광지 목록과 개수를 묶어 딕셔너리로 반환함." },
      ],
      code:
`def get_tourist_attractions(city: str, max_results: int = DEFAULT_MAX_RESULTS) -> dict[str, Any]:
    """Google Places Text Search(New)로 도시 관광지를 검색하여 반환."""
    city_en = normalize_city_name(city)
    try:
        places = _search_places(f"top tourist attractions in {city_en}", city_en, max_results)
        return {
            "city": city_en,
            "attractions": places,
            "count": len(places),
        }
    except Exception as exc:
        return {"error": f"Google Places 관광지 검색 오류: {exc}", "city": city_en}`,
    },
    {
      id: "get_restaurants",
      name: "get_restaurants(city, meal_type, keyword, max_results)",
      fileId: "tools",
      summary: "도시의 맛집을 검색하는 함수. 아침/점심/저녁(meal_type)이나 키워드로 좁혀 찾을 수 있음.",
      how: "meal_type·keyword는 None(없어도 됨) 인자라, AI가 상황에 따라 일부만 채워 호출할 수 있음. 채워진 값들만 모아 검색어를 조립한 뒤 _search_places로 검색함. 결과에 meal_type·keyword를 함께 담아 AI가 맥락을 확인할 수 있게 함.",
      terms: ["리스트 컴프리헨션", "예외 처리(try/except)", "타입 힌트"],
      lines: [
        { at: 'meal_type: str | None = None,', text: "meal_type·keyword는 str | None = None, 즉 '있어도 되고 없어도 되는' 선택 인자임." },
        { at: 'query_parts = [part for part in [meal_type, keyword, "restaurants"] if part]', text: "값이 채워진 항목만 골라(리스트 컴프리헨션) 검색어를 조립함." },
        { at: 'places = _search_places(query, city_en, max_results)', text: "조립한 검색어로 맛집을 검색함." },
      ],
      code:
`def get_restaurants(
    city: str,
    meal_type: str | None = None,
    keyword: str | None = None,
    max_results: int = DEFAULT_MAX_RESULTS,
) -> dict[str, Any]:
    """Google Places Text Search(New)로 도시 맛집을 검색하여 반환."""
    city_en = normalize_city_name(city)
    query_parts = [part for part in [meal_type, keyword, "restaurants"] if part]
    query = " ".join(query_parts) + f" in {city_en}"

    try:
        places = _search_places(query, city_en, max_results)
        return {
            "city": city_en,
            "meal_type": meal_type,
            "keyword": keyword,
            "restaurants": places,
            "count": len(places),
        }
    except Exception as exc:
        return {"error": f"Google Places 맛집 검색 오류: {exc}", "city": city_en}`,
    },

    // ===== common/prompts.py (지침서·도구 스키마) =====
    {
      id: "TOOL_DEFINITIONS",
      name: "TOOL_DEFINITIONS (도구 스키마)",
      fileId: "prompts",
      summary: "AI가 호출할 수 있는 함수들의 '사용 설명서(JSON Schema)'를 정의한 목록. AI가 이 스키마를 보고 언제 어떤 함수를 어떤 값으로 호출할지 판단함.",
      how: "도구 스키마는 함수명·설명·파라미터를 JSON 형식으로 적은 것임. AI는 이 설명서를 읽고 '날씨 물어보면 get_weather, city 인자 필요'라고 스스로 판단함. 코드 강제가 아니라 '설명으로 AI를 안내'하는 Function Calling의 핵심임. get_claude_tools()가 이를 Claude API 형식으로 변환함.",
      terms: ["도구 스키마(JSON Schema)", "Function Calling", "input_schema", "get_claude_tools()"],
      lines: [
        { at: 'DEFAULT_MAX_RESULTS = 8', text: "검색 결과 기본 개수. 도구들이 max_results 기본값으로 사용함." },
        { at: '"name": "get_weather"', text: "AI가 이 이름으로 함수 호출을 요청함. execute_function이 이 이름으로 실제 함수를 찾음." },
        { at: '"description": "Get current weather', text: "영문 설명이 'AI를 위한 사용 설명서'가 됨. AI가 이걸 읽고 언제 호출할지 판단함." },
        { at: '"description": "English city name, such as Seoul', text: "city는 get_weather의 필수 인자이며 영문 도시명을 받음. AI는 city 없이 이 함수를 호출하지 않음." },
      ],
      code:
`DEFAULT_MAX_RESULTS = 8

SYSTEM_PROMPT = """당신은 여행 중인 사용자를 돕는 오늘의 여행 플래너 AI임.

사용자는 아침에 오늘 하루의 여행 루트를 추천받고 싶어 함.

## 요청 처리 규칙
1. 사용자의 요청 유형을 먼저 판단함.
   - 날씨 요청: get_weather만 호출함
   - 관광지 요청: get_tourist_attractions만 호출함
   - 맛집 요청: get_restaurants만 호출함
   - 여행루트 요청 또는 도시명만 입력: get_weather, get_tourist_attractions, get_restaurants를 모두 호출함
2. 도시명이 없으면 함수를 호출하지 말고 도시명을 알려 달라고 요청함.
3. 함수 호출 시 city 값은 반드시 영문 도시명으로 전달함.
   - 예: 서울 -> Seoul, 도쿄 -> Tokyo, 파리 -> Paris, 제주 -> Jeju
4. 여행 루트는 오늘 날씨를 기준으로 추천함.
   - 비, 눈, 폭풍, 강풍: 실내 관광지 우선
   - 맑음, 구름 조금: 야외 관광지 우선
   - 흐림, 안개: 이동 부담이 낮은 장소 우선
5. 여행 루트에는 아침, 점심, 저녁 맛집을 각각 포함함.

## 장소 표기 형식
각 장소는 반드시 평점과 간략한 설명을 포함함.
구글맵 링크는 함수 결과의 google_maps_url 값을 우선 사용함.

예시:
**[Gyeongbokgung Palace](https://www.google.com/maps/search/?api=1&query=Gyeongbokgung+Palace+Seoul)** (평점 4.6★)
- 조선 왕조의 대표 궁궐로 오전 산책에 적합함
- 위치: 161 Sajik-ro, Jongno-gu, Seoul

## 구글맵 링크 규칙
- 링크 URL의 query 파라미터는 반드시 영문으로 작성함
- 형식: https://www.google.com/maps/search/?api=1&query=EnglishPlaceName+EnglishCityName
- 한글 query 파라미터 사용 금지

## 답변 톤
- 한국어로 답변함
- 실용적이고 간결하게 작성함
- 함수 결과에 error가 있으면 원인과 확인할 환경변수를 안내함
"""

# OpenAI/Claude/Gemini Function Calling에서 공통으로 사용하는 도구 스키마 정의
# (JSON Schema 형식으로 함수명·설명·파라미터를 기술하면 LLM이 호출 여부와 인자를 결정함)
TOOL_DEFINITIONS = [
    {
        "name": "get_weather",
        "description": "Get current weather for a city. Use this for weather-only requests or as part of a daily route plan.",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "English city name, such as Seoul, Tokyo, Paris, Busan.",
                }
            },
            "required": ["city"],
        },
    },
    {
        "name": "get_tourist_attractions",
        "description": "Search top tourist attractions in a city with rating, address, short description, and Google Maps URL.",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "English city name.",
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of attractions to return.",
                },
            },
            "required": ["city"],
        },
    },
    {
        "name": "get_restaurants",
        "description": "Search restaurants in a city. Use meal_type for breakfast, lunch, or dinner when useful.",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "English city name.",
                },
                "meal_type": {
                    "type": "string",
                    "description": "Optional meal type: breakfast, lunch, dinner, brunch, cafe.",
                },
                "keyword": {
                    "type": "string",
                    "description": "Optional food keyword such as Korean, seafood, ramen, vegan.",
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of restaurants to return.",
                },
            },
            "required": ["city"],
        },
    },
]


def get_claude_tools() -> list[dict]:
    """공통 도구 정의를 Claude Messages API tool 형식으로 변환하여 반환."""
    return [
        {
            "name": tool["name"],
            "description": tool["description"],
            "input_schema": tool["parameters"],
        }
        for tool in TOOL_DEFINITIONS
    ]`,
    },

    // ===== common/llm.py (클라이언트 헬퍼) =====
    {
      id: "load_hands_on_env",
      name: "load_hands_on_env()",
      fileId: "llm",
      summary: "공통 비밀 설정 파일(hands-on/.env)을 읽어, API 키 같은 값을 프로그램이 쓸 수 있게 함.",
      how: "API 키처럼 외부에 노출되면 안 되는 값은 코드에 직접 쓰지 않고 .env 파일에 따로 보관함. load_dotenv가 그 파일을 읽어 환경변수로 올려줌. 모든 예제가 같은 .env를 공유하도록 경로를 고정함.",
      terms: ["load_dotenv", "환경변수(.env)", "API 키", "Path(__file__)"],
      lines: [
        { at: 'HANDS_ON_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"', text: ".parents[2]는 이 파일(common/llm.py)에서 두 단계 위 폴더(hands-on/)를 뜻함. 거기 있는 .env 파일 경로를 구함." },
        { at: 'load_dotenv(HANDS_ON_ENV_PATH)', text: "load_dotenv가 .env 파일의 KEY=값들을 읽어 프로그램의 환경변수로 등록함." },
      ],
      code:
`# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
HANDS_ON_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


def load_hands_on_env() -> Path:
    """hands-on/.env를 로드하여 모든 예제가 공통 키 파일을 공유하도록 함."""
    # .env 파일에서 API 키 등 환경변수를 로드함
    load_dotenv(HANDS_ON_ENV_PATH)
    return HANDS_ON_ENV_PATH`,
    },
    {
      id: "create_claude_client",
      name: "create_claude_client()",
      fileId: "llm",
      summary: "CLAUDE_API_KEY를 읽어 Anthropic 클라이언트를 만들어 돌려줌.",
      how: "anthropic 라이브러리를 이 함수 안에서만 import함. 다른 예제에서 이 파일을 import해도 anthropic이 설치돼 있지 않으면 에러가 나지 않도록 하기 위한 '지연 import' 기법임.",
      terms: ["Anthropic SDK", "API 키", "지연 생성(lazy)"],
      lines: [
        { at: 'import anthropic', text: "anthropic 라이브러리를 함수 안에서 import함. 이렇게 하면 이 함수를 실제로 호출할 때만 라이브러리가 필요함(지연 import)." },
        { at: 'return anthropic.Anthropic(api_key=require_api_key("CLAUDE_API_KEY"))', text: "require_api_key()로 .env에서 CLAUDE_API_KEY를 읽어, Anthropic 클라이언트를 만들어 반환함." },
      ],
      code:
`def create_claude_client():
    """Anthropic 클라이언트를 지연 생성하여 반환. 다른 예제에서 불필요한 import 방지."""
    import anthropic

    return anthropic.Anthropic(api_key=require_api_key("CLAUDE_API_KEY"))`,
    },

    // ===== common/ui_text.py (화면 문구) =====
    {
      id: "ui_text_constants",
      name: "UI 텍스트 상수 (APP_TITLE 등)",
      fileId: "uitext",
      summary: "화면에 표시할 제목·아이콘·환영 인사·사용 안내 같은 '문구'들을 한 곳에 모아 둔 파일.",
      how: "코드 곳곳에 문구를 흩어 두면 수정이 번거로움. 자주 바뀌는 안내 문구를 상수(대문자 이름)로 모아두면 한 곳만 고쳐도 전체에 반영됨. 함수는 없고 문자열 상수들만 있는 파일임.",
      terms: [],
      lines: [
        { at: 'APP_TITLE = "여행 플래너"', text: "APP_TITLE·APP_ICON: 화면 상단 제목과 아이콘(이모지)." },
        { at: 'WELCOME_MESSAGE = """', text: "WELCOME_MESSAGE: 처음 화면에 보여줄 환영 인사 글(삼중 따옴표로 여러 줄 작성)." },
        { at: 'USAGE_GUIDE = """', text: "USAGE_GUIDE: 왼쪽 사이드바에 보여줄 사용 예시 안내. 백틱으로 강조한 예시들이 포함됨." },
        { at: 'TECH_GUIDE = """', text: "TECH_GUIDE: 핵심 흐름을 간단히 정리한 기술 안내." },
      ],
      code:
`"""여행 플래너 예제의 모델별 Streamlit 앱에서 공통으로 사용하는 UI 텍스트 상수 모음."""

APP_TITLE = "여행 플래너"
APP_ICON = "🗺️"

WELCOME_MESSAGE = """안녕하세요. 오늘 여행 루트를 함께 정리하는 AI 여행 플래너임.

도시명을 알려주면 날씨, 관광지, 맛집 정보를 함수 호출로 조회한 뒤 오늘 일정으로 추천함.

예시
- 서울
- 도쿄 날씨
- 파리 관광지
- 부산 맛집
"""

USAGE_GUIDE = """### 사용 예시
- \`서울\`
- \`도쿄 날씨\`
- \`파리 관광지\`
- \`부산 맛집\`
- \`제주 여행 루트\`

### 요청 유형
- 날씨
- 관광지
- 맛집
- 여행루트

도시명만 입력하면 오늘의 여행 루트 추천 수행.
"""

TECH_GUIDE = """### 핵심 흐름
1. 사용자 요청 분석
2. 필요한 함수 선택
3. 외부 API 호출
4. 함수 결과를 모델에 전달
5. 최종 답변 생성
"""`,
    },
  ],

  glossary: {
    "Streamlit": "파이썬 코드 몇 줄로 웹 화면을 만들어 주는 도구. 버튼·입력창·채팅 UI를 함수 호출만으로 그릴 수 있어, 웹 개발을 몰라도 앱을 만들 수 있음.",
    "st.session_state": "Streamlit의 '메모장'. 화면을 다시 그려도 사라지지 않게 값을 보관하는 특별한 저장소임. 여기 없는 일반 변수는 화면을 그릴 때마다 초기화됨.",
    "st.chat_input": "화면 맨 아래에 채팅 입력창을 만들어 주고, 사용자가 입력한 글을 돌려주는 Streamlit 기능.",
    "st.chat_message": "사람/AI 말풍선 모양의 영역을 만들어 주는 기능. with 블록 안에 쓴 내용이 그 말풍선 안에 표시됨.",
    "st.markdown": "글자를 굵게·목록·링크 등 서식과 함께 화면에 표시하는 기능.",
    "st.rerun": "화면(코드)을 처음부터 다시 실행하게 만드는 기능. 값이 바뀐 걸 즉시 화면에 반영할 때 씀.",
    "st.sidebar": "화면 왼쪽의 보조 패널. with st.sidebar 블록 안에서 출력한 것은 모두 왼쪽에 표시됨.",
    "st.write_stream": "제너레이터(yield 함수)에서 텍스트 조각을 받아 실시간으로 화면에 표시하는 Streamlit 기능. 완료 후 전체 텍스트를 반환함.",
    "Anthropic SDK": "Anthropic이 만든 파이썬 라이브러리. anthropic.Anthropic()으로 클라이언트를 만들어 Claude API를 호출할 수 있음.",
    "client.messages.stream()": "Claude Messages API를 스트리밍 모드로 호출하는 컨텍스트 매니저. with 블록으로 사용하며, 응답을 조각조각 받을 수 있음.",
    "text_stream": "스트리밍 응답에서 텍스트 조각(chunk)만 하나씩 꺼낼 수 있는 이터레이터. for 루프로 순서대로 받아 yield할 수 있음.",
    "get_final_message()": "스트리밍이 완전히 끝난 후 전체 응답 메시지를 가져오는 메서드. stop_reason과 content(블록 목록)를 담고 있음.",
    "stop_reason": "AI가 응답을 멈춘 이유를 나타내는 값. 'end_turn'은 답변 완료, 'tool_use'는 함수 호출이 필요한 상태임.",
    "MAX_TOOL_ROUNDS": "도구 호출 루프의 최대 반복 횟수(기본 5회). 무한 루프를 방지하는 안전장치임.",
    "tool_use 블록": "AI가 '이 함수를 이런 값으로 호출해줘'라고 요청한 내용을 담은 블록. 응답 content 안에 들어 있음.",
    "tool_result": "함수를 실제로 실행한 결과를 AI에게 돌려주는 메시지 블록. Claude API에서는 role=user 메시지에 담아 전달해야 함.",
    "tool_use_id": "도구 호출 하나하나에 붙는 고유 번호(영수증 번호). tool_use 요청과 tool_result를 짝지을 때 사용함.",
    "execute_function": "AI가 요청한 함수 이름을 받아 허용 목록에서 찾아 실행하는 디스패처 함수. 목록에 없는 함수는 실행하지 않아 보안을 지킴.",
    "화이트리스트(whitelist)": "허용된 것들만 적어 둔 목록. 여기선 AI가 호출할 수 있는 함수 이름만 등록해 둬, 임의 함수 실행을 막음.",
    "Function Calling": "AI가 '이 함수를 호출해줘'라고 요청하면, 개발자 코드가 실제로 함수를 실행하고 결과를 AI에게 다시 주는 방식. AI가 외부 데이터를 가져올 수 있게 해줌.",
    "도구 스키마(JSON Schema)": "AI에게 '이런 함수가 있고, 이런 인자가 필요하다'고 알려주는 설명서. JSON 형식으로 함수명·설명·파라미터 타입을 기술함.",
    "input_schema": "Claude API에서 도구 정의 시 파라미터 명세를 담는 필드(OpenAI의 parameters와 같은 역할).",
    "get_claude_tools()": "공통 TOOL_DEFINITIONS를 Claude API 형식(name, description, input_schema)으로 변환해 반환하는 함수.",
    "제너레이터(Generator)": "yield 키워드를 사용하는 특별한 함수. 호출해도 바로 실행되지 않고, 값을 하나씩 꺼낼 때마다 조금씩 실행됨. 텍스트를 실시간으로 흘려보내는 스트리밍에 사용함.",
    "yield": "제너레이터 함수에서 값을 하나 '내보내는' 키워드. yield를 만나면 잠시 멈춰 값을 전달하고, 다음 요청이 오면 이어서 실행함.",
    "컨텍스트 매니저(with)": "with 블록에 들어갈 때 준비하고(열기), 나올 때 정리하는(닫기) 관리 도구. 파일·네트워크 연결 등 자원 관리에 씀.",
    "from __future__ import annotations": "타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 하는 특별한 import 선언. 파일 맨 첫 줄에 써야 함.",
    "Path(__file__)": "'지금 이 파이썬 파일 자체'를 가리키는 경로 객체. .resolve().parent로 이 파일이 든 폴더의 절대경로를 구할 수 있음.",
    "sys.path.insert": "파이썬이 모듈을 검색하는 경로 목록에 새 경로를 추가하는 명령. 맨 앞(0번)에 넣어야 다른 경로보다 먼저 탐색됨.",
    "지연 생성(lazy)": "필요해질 때까지 만들지 않고 미뤘다가, 처음 쓸 때 한 번만 만드는 방식. 불필요한 작업과 비용을 줄임.",
    "캐싱(cache)": "한 번 만든 결과를 저장해 두고, 다음에 또 필요하면 다시 만들지 않고 저장본을 재사용하는 것.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env 파일에 KEY=값 형태로 적어둠.",
    "API 키": "외부 서비스(날씨·지도·Claude 등)를 쓸 때 '나는 허가된 사용자'임을 증명하는 비밀 열쇠. 노출되면 안 됨.",
    "requests": "파이썬에서 인터넷 주소로 요청을 보내고 응답을 받는 대표적인 라이브러리(HTTP 통신 도구).",
    "raise_for_status()": "인터넷 응답이 실패(예: 404 없음, 500 서버오류)면 오류를 발생시키는 점검 장치. 잘못된 응답을 그냥 쓰지 않게 함.",
    "JSON": "데이터를 주고받는 표준 글자 형식. {\"key\": \"value\"} 모양으로, 파이썬 딕셔너리와 거의 똑같이 생김.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"도시\": \"서울\"}처럼 이름표를 붙여 값을 저장함.",
    "리스트(list)": "여러 값을 순서대로 담는 목록. [\"a\", \"b\"]처럼 대괄호로 표현함.",
    ".get()": "딕셔너리에서 값을 '안전하게' 꺼내는 방법. 열쇠가 없어도 오류를 내지 않고, 정해둔 기본값을 돌려줌.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "타입 힌트": "변수나 함수에 '이건 문자열(str)이야, 결과는 목록(list)이야'처럼 자료의 종류를 적어두는 표시. 실행에 꼭 필요하진 않지만, 코드를 읽고 점검하기 쉽게 함.",
    ":= (바다코끼리)": "값을 변수에 '담으면서 동시에' 그 값을 검사하는 연산자. 모양이 바다코끼리 눈·엄니를 닮아 붙은 별명. 예: if (x := 입력값): 는 입력을 x에 담고 비었는지 바로 확인함.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
    "리스트 컴프리헨션": "[표현식 for 항목 in 목록 if 조건] 형태로, 반복문을 한 줄로 짧게 써서 새 목록을 만드는 파이썬 문법.",
  },
};
