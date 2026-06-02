#!/usr/bin/env python3
"""질문 유형에 따라 소스를 선택하는 멀티소스 RAG 예제 (벡터 DB + 웹검색)

질문 라우팅으로 "특허법 질문 → 특허법 벡터 DB", "최신 트렌드 질문 → 웹검색"을 분기하여
하나의 파이프라인에서 두 소스를 모두 활용함.

[10.rag/naive 대비 핵심 변경 사항]
  Before: 항상 특허법 벡터 DB만 검색 (단일 소스)
  After : 질문을 LLM으로 분류(라우팅)하여 벡터 DB 또는 DuckDuckGo 웹검색을 선택 (멀티소스)

핵심 개념:
  - Query Routing : 질문을 분석해 적합한 검색 소스를 고르는 패턴 (교재 5.4.1)
  - 특허법 벡터 DB : 8.0 인덱싱으로 구축된 공용 컬렉션 `patent_law`를 재임베딩 없이 로드
  - 웹검색         : DuckDuckGo (무료, API 키 불필요). 최근 1년·상위 5건으로 최신성 확보

Embed   : OpenAI   text-embedding-3-small (1536차원, 벡터 DB 질의 임베딩 전용)
VectorDB: ChromaDB (로컬 영속화, ../../10.rag/vectordb / 컬렉션 patent_law)
WebSearch: DuckDuckGo (DuckDuckGoSearchAPIWrapper, region=ko-kr / time=y / max_results=5)
LLM     : Groq LPU openai/gpt-oss-120b (라우팅·답변 생성 공용, reasoning_format="hidden")

사용법:
    python app.py                          # 인자 없음 → 대화형 입력(소스별 예시 질문 제공)
    python app.py "특허 출원 절차는?"       # 특허법 질문 → 벡터 DB 검색
    python app.py "2025 AI 에이전트 트렌드"  # 최신 트렌드 질문 → 웹검색
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import sys
from pathlib import Path

# Windows 콘솔 기본 인코딩(cp949)에서 한글이 깨지지 않도록 표준출력·표준입력을 UTF-8로 재설정함
# (대화형 입력에서 한글 질문을 정상적으로 읽기 위해 stdin도 함께 재설정함)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stdin, "reconfigure"):
    sys.stdin.reconfigure(encoding="utf-8")

# ---------------------------------------------------------------------------
# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(web-rag/)를 절대경로로 구함
HANDS_ON_DIR = SCRIPT_DIR.parent.parent          # hands-on/ (12.web-youtube-search의 부모의 부모)
VECTORDB_DIR = HANDS_ON_DIR / "10.rag" / "vectordb"  # 특허법 공용 ChromaDB 영속화 디렉터리 (재임베딩 없이 로드)
ENV_PATH = HANDS_ON_DIR / ".env"                 # hands-on/.env (API 키 보관)

# ---------------------------------------------------------------------------
# 환경변수 로드
# ---------------------------------------------------------------------------
from dotenv import load_dotenv

load_dotenv(ENV_PATH)  # .env에서 OPENAI_API_KEY(질의 임베딩)·GROQ_API_KEY(LLM)를 로드함

# ---------------------------------------------------------------------------
# 상수 정의
# ---------------------------------------------------------------------------
COLLECTION_NAME = "patent_law"               # 특허법 벡터 DB 컬렉션명 (인덱싱과 동일해야 검색 가능)
EMBEDDING_MODEL = "text-embedding-3-small"   # 질의 임베딩 모델 (인덱싱과 반드시 동일, 1536차원)
LLM_MODEL = "openai/gpt-oss-120b"            # Groq LPU에서 서빙하는 라우팅·답변 생성용 LLM
TOP_K = 5                                    # 벡터 DB 유사도 검색으로 가져올 상위 청크 수
WEB_REGION = "ko-kr"                         # DuckDuckGo 검색 지역 (한국어 우선)
WEB_TIME = "y"                               # DuckDuckGo 시간 필터 ("y"=최근 1년, 최신성 확보)
WEB_MAX_RESULTS = 5                          # DuckDuckGo 최신 결과 개수 (상위 5건으로 답변 생성)
DEFAULT_QUERY = "특허를 받을 수 있는 조건은 ?"  # 대화형에서 빈 입력 시 사용할 기본 질의어(특허법)

# 대화형 입력에서 사용자에게 보여줄 소스별 예시 질문 (어떤 질문이 어느 소스로 가는지 학습용)
# 웹검색 예시에는 PATENT_KEYWORDS가 섞이지 않도록 해 라우팅이 라벨과 일치하게 함
PATENT_EXAMPLES = (
    "특허를 받기 위한 요건은 무엇인가요?",
    "특허 출원 절차는 어떻게 되나요?",
    "특허권 침해에 대한 구제 방법은?",
)
WEB_EXAMPLES = (
    "2025년 최신 AI 에이전트 트렌드는?",
    "요즘 주목받는 RAG 프레임워크는?",
    "최근 LLM 모델 동향을 알려줘",
)

# 라우팅 키워드: LLM 분류가 모호할 때 사용하는 폴백 휴리스틱
# 질의에 특허 관련 단어가 하나라도 있으면 벡터 DB(patent)로 보냄
PATENT_KEYWORDS = (
    "특허", "출원", "발명", "청구항", "심사", "등록", "침해",
    "실용신안", "우선권", "명세서", "거절", "무효", "특허청", "특허법",
)

# 질문을 두 소스 중 하나로 분류하도록 지시하는 라우팅 프롬프트
# 응답을 한 단어(patent/web)로 강제해 파싱을 단순화함
ROUTER_SYSTEM_PROMPT = (
    "당신은 질문을 분석해 검색 소스를 고르는 라우터임. "
    "다음 두 단어 중 하나로만 답할 것: patent 또는 web. "
    "patent = 대한민국 특허법 관련 질문(특허 요건·출원 절차·발명·청구항·심사·침해 등). "
    "web = 최신 트렌드·동향·뉴스·최근 기술처럼 실시간 웹 정보가 필요한 질문. "
    "설명 없이 patent 또는 web 한 단어만 출력할 것."
)

# 특허법 벡터 DB 검색 결과에 근거해 답하도록 제약하는 RAG 프롬프트
PATENT_SYSTEM_PROMPT = (
    "당신은 대한민국 특허법 문서를 근거로 답변하는 RAG 어시스턴트임. "
    "반드시 아래 [참고 문서]에 있는 내용만 근거로 답변하고, 문서에 없는 내용은 추측하지 말 것. "
    "근거를 찾을 수 없으면 '제공된 문서에서 관련 내용을 찾을 수 없습니다.'라고 답할 것. "
    "답변은 한국어로 간결하게 작성하고, 가능하면 근거가 된 조문을 함께 언급할 것."
)

# 웹검색 결과에 근거해 답하도록 제약하는 RAG 프롬프트 (출처 URL 인용 요구)
WEB_SYSTEM_PROMPT = (
    "당신은 웹 검색 결과를 근거로 최신 정보를 답변하는 RAG 어시스턴트임. "
    "반드시 아래 [웹 검색 결과]에 있는 내용만 근거로 한국어로 간결하게 답변할 것. "
    "답변 끝에 참고한 출처를 '[출처] 제목 - URL' 형식으로 함께 제시할 것. "
    "검색 결과가 비어 있으면 '웹 검색 결과를 가져오지 못했습니다.'라고 답할 것."
)

HUMAN_PROMPT = "[참고 문서]\n{context}\n\n[질문]\n{question}\n\n[답변]"
WEB_HUMAN_PROMPT = "[웹 검색 결과]\n{context}\n\n[질문]\n{question}\n\n[답변]"


# ---------------------------------------------------------------------------
# 1. 특허법 벡터 DB 로드 (검색기 생성)
# ---------------------------------------------------------------------------

def load_retriever():
    """특허법 공용 ChromaDB를 재임베딩 없이 로드하여 Dense Retriever를 반환함.

    Chroma(...) 생성자: from_documents(신규 인덱싱)와 달리 이미 영속화된 컬렉션을 그대로 연결함.
    embedding_function에 인덱싱과 동일한 모델을 지정해야 질의 임베딩 차원·의미 공간이 일치하여
    유사도 검색이 정상 동작함. ("임베딩하지 않음"은 문서 재인덱싱을 하지 않는다는 의미이며,
    질의 임베딩은 검색을 위해 필요함)
    """
    import os

    from langchain_chroma import Chroma
    from langchain_openai import OpenAIEmbeddings

    # 질의 임베딩에 OpenAI API가 필요하므로 키 부재 시 즉시 명확한 오류를 발생시킴
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError(f"OPENAI_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요")

    # 인덱싱이 선행되어야 검색 가능하므로 영속 디렉터리 존재 여부를 먼저 확인함
    if not VECTORDB_DIR.exists():
        raise FileNotFoundError(
            f"특허법 벡터 DB가 없음: {VECTORDB_DIR}\n"
            f"먼저 10.rag/indexing/indexing.py 로 인덱싱을 수행해야 함"
        )

    # OpenAIEmbeddings: 텍스트를 1536차원 벡터로 변환 (질의 임베딩에 사용, OPENAI_API_KEY 자동 참조)
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)

    # Chroma: 영속화된 벡터 컬렉션을 연결하는 LangChain 벡터 저장소 래퍼
    vectorstore = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embeddings,
        persist_directory=str(VECTORDB_DIR),
    )

    # ._collection.count(): 컬렉션에 저장된 벡터 개수. 0이면 인덱싱이 비었음을 뜻함
    count = vectorstore._collection.count()
    if count == 0:
        raise ValueError(f"벡터 DB가 비어 있음 (컬렉션 '{COLLECTION_NAME}'). 인덱싱 재실행 필요")
    print(f"  - 특허법 벡터 DB 로드 완료: {count}개 벡터 (컬렉션 '{COLLECTION_NAME}')")

    # search_kwargs={"k": TOP_K}: 유사도 상위 TOP_K개 청크만 반환하도록 설정함
    return vectorstore.as_retriever(search_kwargs={"k": TOP_K})


# ---------------------------------------------------------------------------
# 2. LLM 생성 (라우팅·답변 생성 공용)
# ---------------------------------------------------------------------------

def create_llm():
    """Groq LPU의 openai/gpt-oss-120b 채팅 모델을 생성하여 반환함.

    ChatGroq: Groq Cloud LPU에 채팅 요청을 보내는 LangChain 모델 래퍼 (GROQ_API_KEY 자동 참조).
    gpt-oss-120b는 추론(reasoning) 모델이라 사고 과정이 답변 본문에 섞일 수 있으므로
    reasoning_format="hidden"으로 최종 답변만 받도록 함.
    temperature=0: 라우팅 분류와 답변을 재현 가능(결정적)하게 함.
    """
    import os

    from langchain_groq import ChatGroq

    if not os.getenv("GROQ_API_KEY"):
        raise RuntimeError(f"GROQ_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요")

    return ChatGroq(
        model=LLM_MODEL,
        temperature=0,
        reasoning_format="hidden",  # 추론 과정을 숨기고 최종 답변 텍스트만 반환
    )


# ---------------------------------------------------------------------------
# 3. 질문 라우팅 (소스 선택)
# ---------------------------------------------------------------------------

def keyword_route(query: str) -> str:
    """질의에 특허 관련 키워드가 있으면 'patent', 없으면 'web'을 반환하는 폴백 분류기.

    LLM 라우팅이 모호한 단어를 반환할 때를 대비한 결정적(규칙 기반) 분류로,
    any(...) 제너레이터로 PATENT_KEYWORDS 중 하나라도 질의에 포함되는지 검사함.
    """
    if any(keyword in query for keyword in PATENT_KEYWORDS):
        return "patent"
    return "web"


def route_query(query: str, llm) -> str:
    """질문을 'patent'(벡터 DB) 또는 'web'(웹검색)으로 분류함.

    1차로 LLM에 한 단어 분류를 요청하고, 응답이 patent/web으로 명확하지 않으면
    keyword_route()의 규칙 기반 결과로 폴백하여 항상 둘 중 하나를 보장함.
    """
    from langchain_core.messages import HumanMessage, SystemMessage

    # SystemMessage / HumanMessage: LangChain 메시지 타입 (role을 객체로 표현)
    response = llm.invoke(
        [SystemMessage(content=ROUTER_SYSTEM_PROMPT), HumanMessage(content=query)]
    )
    # 응답 텍스트를 소문자·공백 제거로 정규화해 분류 라벨을 추출함
    label = response.content.strip().lower()

    # LLM이 명확히 한 소스를 지목하면 그대로 사용함 (web을 먼저 검사해 'patent web' 혼입 시 우선순위 부여 X)
    if "patent" in label and "web" not in label:
        return "patent"
    if "web" in label and "patent" not in label:
        return "web"

    # 라벨이 모호하면(둘 다 포함하거나 둘 다 없음) 키워드 휴리스틱으로 폴백함
    return keyword_route(query)


# ---------------------------------------------------------------------------
# 4. 소스별 검색
# ---------------------------------------------------------------------------

def search_vectordb(query: str, retriever) -> list:
    """특허법 벡터 DB에서 질의와 유사한 청크 Top K를 검색해 Document 리스트로 반환함.

    retriever.invoke(query): 질의를 임베딩한 뒤 의미적으로 가까운 청크를 유사도순으로 가져옴.
    """
    return retriever.invoke(query)


def search_web(query: str) -> list:
    """DuckDuckGo로 웹을 검색해 [{title, snippet, link}, ...] 리스트를 반환함.

    DuckDuckGoSearchAPIWrapper: API 키 없이 동작하는 무료 웹검색 유틸리티.
    results() 메서드는 run()과 달리 제목·요약뿐 아니라 출처 link(URL)까지 포함해 반환하므로
    답변에 출처를 명시할 수 있음. time="y"로 최근 1년 결과만, max_results=5로 상위 5건만 사용함.
    """
    from langchain_community.utilities import DuckDuckGoSearchAPIWrapper

    wrapper = DuckDuckGoSearchAPIWrapper(
        region=WEB_REGION,
        time=WEB_TIME,            # 최근 1년 결과로 최신성 확보
        max_results=WEB_MAX_RESULTS,
    )
    try:
        # results(): 소스 링크를 포함한 상세 결과 반환 (run()은 텍스트만 반환해 출처 누락)
        return wrapper.results(query, max_results=WEB_MAX_RESULTS)
    except Exception as error:
        # 무료 검색은 일시적 rate limit·네트워크 오류가 날 수 있으므로 빈 결과로 처리하고 경고만 남김
        print(f"  - [경고] 웹검색 실패(일시적): {error}", file=sys.stderr)
        return []


# ---------------------------------------------------------------------------
# 5. 검색 결과 → 컨텍스트 문자열 변환
# ---------------------------------------------------------------------------

def format_patent_docs(docs: list) -> str:
    """특허법 검색 Document 리스트를 LLM 프롬프트용 단일 문자열로 합침.

    각 청크 앞에 [출처 N] 라벨과 메타데이터(파일명·청크 번호)를 붙여
    LLM이 근거 조문을 인용하기 쉽게 하고, 사람도 출처를 식별할 수 있게 함.
    """
    blocks = []
    for index, doc in enumerate(docs, start=1):
        source = doc.metadata.get("source", "unknown")
        chunk_index = doc.metadata.get("chunk_index", "?")
        blocks.append(f"[출처 {index}] {source} #{chunk_index}\n{doc.page_content}")
    # 청크 사이를 구분선으로 띄워 LLM이 문서 경계를 인식하기 쉽게 함
    return "\n\n---\n\n".join(blocks)


def format_web_results(results: list) -> str:
    """웹검색 결과 dict 리스트를 LLM 프롬프트용 단일 문자열로 합침.

    각 결과 앞에 [출처 N] 라벨과 제목·요약·링크를 붙여 LLM이 출처 URL을 인용하게 함.
    """
    if not results:
        return ""
    blocks = []
    for index, item in enumerate(results, start=1):
        title = item.get("title", "제목 없음")
        snippet = item.get("snippet", "")
        link = item.get("link", "")
        blocks.append(f"[출처 {index}] {title}\n{snippet}\n링크: {link}")
    return "\n\n---\n\n".join(blocks)


# ---------------------------------------------------------------------------
# 6. RAG 파이프라인 (라우팅 → 검색 → 생성)
# ---------------------------------------------------------------------------

def answer_query(query: str, retriever, llm) -> tuple[str, str, list]:
    """질문을 라우팅해 적합한 소스로 검색하고, 검색 결과를 근거로 LLM 답변을 생성함.

    처리 흐름:
      1. 라우팅: route_query()로 'patent'(벡터 DB) / 'web'(웹검색) 결정
      2. 탐색  : 선택된 소스에서 검색 (search_vectordb 또는 search_web)
      3. 생성  : 소스에 맞는 프롬프트로 (prompt | llm | StrOutputParser) 체인 실행
    출력 시 라우팅 결과·근거를 함께 보여주기 위해 (route, answer, sources)를 반환함.
    """
    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.prompts import ChatPromptTemplate

    # 1) 라우팅: 질문 유형에 따라 검색 소스를 선택함
    route = route_query(query, llm)

    # 2) 탐색 + 컨텍스트/프롬프트 구성: 소스별로 다른 검색기·프롬프트를 사용함
    if route == "patent":
        sources = search_vectordb(query, retriever)
        context = format_patent_docs(sources)
        system_prompt, human_prompt = PATENT_SYSTEM_PROMPT, HUMAN_PROMPT
    else:
        sources = search_web(query)
        context = format_web_results(sources)
        system_prompt, human_prompt = WEB_SYSTEM_PROMPT, WEB_HUMAN_PROMPT

    # 3) 생성: LCEL 파이프 연산자(|)로 프롬프트 → LLM → 문자열 파서를 연결함
    # ChatPromptTemplate.from_messages: system/human 메시지 템플릿을 묶어 프롬프트를 구성함
    prompt = ChatPromptTemplate.from_messages(
        [("system", system_prompt), ("human", human_prompt)]
    )
    # StrOutputParser: LLM의 AIMessage 응답에서 본문 텍스트만 추출함
    chain = prompt | llm | StrOutputParser()

    answer = chain.invoke({"context": context, "question": query})
    return route, answer, sources


# ---------------------------------------------------------------------------
# 7. 결과 출력
# ---------------------------------------------------------------------------

def print_result(query: str, route: str, answer: str, sources: list) -> None:
    """질의어·선택된 소스·생성 답변·검색 출처를 보기 좋게 콘솔에 출력함."""
    route_label = "특허법 벡터 DB" if route == "patent" else "웹검색(DuckDuckGo)"
    print("\n" + "=" * 70)
    print(f"[질문] {query}")
    print(f"[선택된 소스] {route_label}")
    print("=" * 70)
    print(f"[답변]\n{answer}")
    print("\n" + "-" * 70)
    print(f"[검색 출처] {len(sources)}건")

    if route == "patent":
        # 벡터 DB: 파일명·청크 번호와 본문 미리보기로 근거 청크를 보여줌
        for index, doc in enumerate(sources, start=1):
            source = doc.metadata.get("source", "unknown")
            chunk_index = doc.metadata.get("chunk_index", "?")
            snippet = doc.page_content[:60].replace("\n", " ")
            print(f"  [{index}] {source} #{chunk_index}: {snippet}...")
    else:
        # 웹검색: 제목과 출처 URL을 보여줌
        for index, item in enumerate(sources, start=1):
            title = item.get("title", "제목 없음")
            link = item.get("link", "")
            print(f"  [{index}] {title}\n      {link}")
    print("=" * 70)


# ---------------------------------------------------------------------------
# 8. 대화형 질문 입력 (소스별 예시 질문 제공)
# ---------------------------------------------------------------------------

def prompt_user_query() -> str:
    """소스별 예시 질문을 보여주고 사용자로부터 질문을 입력받아 반환함.

    번호를 입력하면 해당 예시 질문을, 문장을 입력하면 그 문장을 질의어로 사용함.
    빈 입력이나 입력 종료(EOF)면 기본 질의어(DEFAULT_QUERY)로 폴백함.
    """
    print("\n" + "=" * 70)
    print("질문을 입력하세요. 아래 예시 번호를 고르거나 직접 질문을 입력할 수 있음.")
    print("-" * 70)

    # 예시 질문을 소스별로 묶어 통합 번호를 매겨 출력함 (어떤 질문이 어느 소스로 가는지 학습)
    examples: list[str] = []  # list[str]: 문자열 원소를 담는 리스트 타입 명시
    print("[특허법 벡터 DB 예시] (특허 요건·출원 절차·침해 구제 등)")
    for example in PATENT_EXAMPLES:
        examples.append(example)
        print(f"  {len(examples)}. {example}")
    print("[웹검색 예시] (최신 트렌드·동향·뉴스 등)")
    for example in WEB_EXAMPLES:
        examples.append(example)
        print(f"  {len(examples)}. {example}")
    print("=" * 70)

    try:
        # input(): 콘솔에서 한 줄 입력을 문자열로 읽어옴 (stdin UTF-8 재설정으로 한글 입력 지원)
        user_input = input("질문 (번호 또는 직접 입력, 빈 입력 시 기본 질의): ").strip()
    except EOFError:
        # 파이프 입력 등으로 읽을 줄이 없으면 기본 질의로 폴백해 비대화형 환경에서도 동작하게 함
        return DEFAULT_QUERY

    if not user_input:
        return DEFAULT_QUERY

    # 입력이 숫자이고 예시 범위(1~len) 안이면 해당 예시 질문을 사용함
    if user_input.isdigit():
        index = int(user_input)
        if 1 <= index <= len(examples):
            return examples[index - 1]
        # 범위를 벗어난 숫자면 입력값 자체를 질의어로 간주함

    # 그 외에는 사용자가 직접 입력한 문장을 질의어로 사용함
    return user_input


# ---------------------------------------------------------------------------
# 메인 파이프라인
# ---------------------------------------------------------------------------

def main() -> None:
    """벡터 DB 로드 → LLM 생성 → 라우팅·검색·답변 → 출력 순으로 멀티소스 RAG를 실행함."""
    # 명령줄 인자가 있으면 질의어로 사용하고, 없으면 대화형으로 사용자에게 입력받음
    arg_query = " ".join(sys.argv[1:]).strip()
    query = arg_query if arg_query else prompt_user_query()

    print("[1/3] 특허법 벡터 DB 로드 (재임베딩 없음)")
    retriever = load_retriever()

    print("[2/3] LLM 생성 (Groq openai/gpt-oss-120b)")
    llm = create_llm()

    print("[3/3] 질문 라우팅 + 검색 + 답변 생성")
    route, answer, sources = answer_query(query, retriever, llm)

    print_result(query, route, answer, sources)


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # 실행 중 오류를 명확히 출력하고 비정상 종료 코드로 빠져나감
        print(f"\n[오류] 멀티소스 RAG 실행 실패: {error}", file=sys.stderr)
        sys.exit(1)
