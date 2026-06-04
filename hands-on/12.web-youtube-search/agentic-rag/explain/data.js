window.EXPLAIN_DATA = {
  "meta": {
    "title": "Agentic RAG — LangGraph로 검색 소스를 스스로 고르고 답을 자가검증하는 챗봇",
    "entry": "app.py"
  },
  "files": [
    {
      "id": "main",
      "label": "app.py",
      "role": "특허/지식재산권 질문을 받아 검색 소스(벡터DB·웹·YouTube)를 스스로 고르고, 멀티소스 검색 후 관련성·근거성·유용성을 자체 검증하며, 부족하면 질문을 고쳐 재검색하는 LangGraph 기반 Agentic RAG 챗봇 전체"
    }
  ],
  "flow": [
    {
      "step": 1,
      "title": "실행 & 환경 준비",
      "label": "실행·환경 준비",
      "refs": ["setup"],
      "summary": "python app.py 로 실행하고, .env 의 API 키 3종을 불러옴",
      "detail": "터미널에서 'python app.py'(대화형 챗봇) 또는 'python app.py --demo'(검증 질의 3건 자동 실행)로 시작함. 시작과 동시에 load_dotenv() 가 hands-on/.env 에 적어 둔 GROQ_API_KEY(LLM용)·OPENAI_API_KEY(질의 임베딩용)·YOUTUBE_API_KEY(영상 검색용)를 읽어 둠. 한글 출력이 깨지지 않게 표준출력을 UTF-8로 맞추는 처리도 함. 비유하면, 똑똑한 특허 상담원(앱)이 출근해 세 개의 열쇠(답변·검색·영상 열쇠)를 책상에 챙겨 두는 단계."
    },
    {
      "step": 2,
      "title": "LangGraph 그래프 조립",
      "label": "그래프 조립",
      "refs": ["build_llm", "init", "build_graph"],
      "summary": "공용 벡터 DB·LLM·검색 도구를 준비하고, 노드와 엣지를 연결한 실행 그래프를 미리 컴파일함",
      "detail": "이 예제는 PDF를 새로 읽거나 쪼개지 않음. 그 작업(인덱싱)은 10.rag/indexing 이 미리 해 두었고, 여기서는 결과물인 공용 ChromaDB(컬렉션 patent_law)를 연결만 함. 그다음 답변·평가를 맡을 Groq LLM(gpt-oss-120b)을 만들고, AgenticRAG 가 7개의 노드(route·retrieve·grade_documents·generate·grade_generation·rewrite·direct_answer)와 그 사이를 잇는 엣지를 _build_graph 로 연결해 '실행 가능한 그래프'로 컴파일함. 비유하면, 작업 공정도(노드=작업장, 엣지=컨베이어)를 미리 그려 두고 전원을 켜 두는 것. Self-RAG가 재귀 함수로 흐름을 제어했다면, 여기서는 그 흐름을 눈에 보이는 그래프로 그린 것이 핵심 차이."
    },
    {
      "step": 3,
      "title": "[Route] 검색 필요 여부 + 소스 판단",
      "label": "라우팅 (Route)",
      "refs": ["route"],
      "summary": "질문을 보고 '검색이 필요한가? 어떤 소스로?'를 LLM이 스스로 결정하고 소스별 쿼리까지 만듦",
      "detail": "그래프의 첫 노드임. 인사말이나 특허 외 주제(예: Claude Code)는 검색하지 않고 LLM 지식으로 바로 답함(direct_answer 경로). 특허/지식재산권 질문이면 검색을 켜되, 어떤 소스(vectordb=법률 근거·web=최신/비용·youtube=영상)를 쓸지 복수 선택하고, 웹/유튜브 각각에 최적화된 검색어(web_query·youtube_query)까지 생성함. 멀티턴 대화 맥락을 참고해 '그럼 비용은?' 같은 후속 질문의 의도도 파악함. 비유하면, 손님 질문을 듣고 어느 서가(법전·신문·영상자료실)를 뒤질지 고르고, 각 자료실에 맞는 검색어를 미리 적어 두는 안내데스크."
    },
    {
      "step": 4,
      "title": "[Retrieve] 멀티소스 검색",
      "label": "멀티소스 검색",
      "refs": ["retrieve", "search_web", "search_youtube"],
      "summary": "라우터가 고른 소스에서만 검색하고, 한 소스가 실패해도 나머지로 진행함",
      "detail": "route 가 고른 소스에서만 검색함. vectordb 는 질문을 임베딩해 의미가 가까운 청크 상위 5개(top-k)를 꺼내고, web 은 DuckDuckGo로 최근 1년 문서를, youtube 는 YouTube Data API v3로 최근 1년 영상을 가져옴. 외부 API(웹·유튜브)는 각각 try/except로 감싸 한 소스가 실패해도 나머지 소스로 답변을 만들 수 있게 함(graceful degradation). 비유하면, 여러 자료실에 동시에 사람을 보내되, 한 자료실이 문을 닫았어도 나머지가 가져온 자료로 보고서를 쓰는 것."
    },
    {
      "step": 5,
      "title": "[IsRel] 관련성 일괄 평가",
      "label": "관련성 평가 (IsRel)",
      "refs": ["grade_documents"],
      "summary": "벡터DB 문서 5개를 1회 호출로 묶어 채점해 정말 관련된 것만 골라냄",
      "detail": "벡터DB 검색 문서를 한 프롬프트에 묶어 1회 LLM 호출로 '관련 있음/없음'을 일괄 채점하고 관련 문서만 추림(호출 수·비용 절감). 웹·유튜브 결과는 검색 자체가 키워드 기반이라 별도 관련성 평가 없이 그대로 사용함. 비유하면, 법전 서가에서 뽑아 온 5장의 카드를 한 번에 훑어보며 진짜 쓸 카드만 남기는 것."
    },
    {
      "step": 6,
      "title": "답변 생성 + [IsSup] 근거성 검증",
      "label": "답변 생성·근거성 (IsSup)",
      "refs": ["generate"],
      "summary": "멀티소스 컨텍스트로 답을 쓰고, 그 답이 근거에 충실한지(환각 없는지) 점검 후 출처를 자동 부착함",
      "detail": "벡터DB·웹·유튜브 결과를 하나의 컨텍스트로 합쳐 답변을 생성함. 이어 [IsSup] 단계에서 '이 답이 컨텍스트로 뒷받침되는가, 지어낸 내용은 없는가'를 LLM이 검사하고, 근거가 부족하면 '컨텍스트에 있는 내용만 써라'는 엄격한 프롬프트로 다시 생성함(환각 방지). 마지막으로 출처 섹션을 LLM이 아닌 코드에서 직접 만들어 붙여 URL 누락을 막음. 비유하면, 직원이 쓴 답안을 검사관이 자료와 대조해 근거 없는 문장을 걸러내고, 참고문헌 목록은 자료 담당이 직접 정확히 붙이는 것."
    },
    {
      "step": 7,
      "title": "[IsUse] 유용성 평가 → 재검색 루프 → 출력",
      "label": "유용성 평가·출력 (IsUse)",
      "refs": ["grade_generation", "rewrite", "edges", "output_run"],
      "summary": "답이 쓸모 있는지 보고, 미흡하면 질문을 고쳐 route 부터 다시 돌리고(최대 3회), 결과를 요약해 출력함",
      "detail": "[IsUse] 에서 답이 질문에 직접·명확하게 답하는지 평가함. 유용하면 종료(END)하고, 유용하지 않으면 rewrite 노드가 질문을 검색에 더 좋게 고친 뒤 route 로 되돌아가 처음부터 다시 검색함(최대 3회). 이 분기는 decide_after_generation 조건부 엣지가 결정함. 끝나면 format_summary 가 라우팅·검색·평가 결과를 표로 요약하고 print_result 가 답변과 함께 출력함. 비유하면, 답이 부실하면 질문 자체를 더 정확히 바꿔 안내데스크로 돌아가 다시 자료를 뒤지는 끈질긴 상담원, 그리고 마지막에 '어떤 검사를 통과했는지' 체크리스트를 함께 제출하는 것."
    }
  ],
  "functions": [
    {
      "id": "setup",
      "name": "임포트·경로·상수 설정",
      "fileId": "main",
      "summary": "필요한 모듈을 가져오고, 파일 위치 기준으로 경로를 잡고, .env 키와 핵심 상수·정규식을 준비하는 부분.",
      "how": "함수가 아니라 파일 위쪽의 준비 코드 모음임. ① from __future__ import annotations 로 타입 힌트를 가볍게 쓰고, 표준출력을 UTF-8로 맞춤. ② LangChain 의 LLM·벡터DB·임베딩·프롬프트 도구, 웹 검색(DuckDuckGo)·YouTube(build)·LangGraph(StateGraph/START/END), Pydantic 을 가져옴. ③ 모든 경로를 이 파일 위치(__file__) 기준으로 계산하되, 벡터DB는 두 단계 상위(hands-on/) 아래 10.rag/vectordb 를 가리킴(이 예제는 11/12장 폴더에 있지만 10장의 공용 DB를 빌려 씀). ④ load_dotenv 로 키 3종을 올리고, 컬렉션명·임베딩 모델·LLM·TOP_K·웹/유튜브 결과 수·최근 1년·MAX_RETRIES·HISTORY_TURNS·RECURSION_LIMIT 같은 상수와 조항 추출용 정규식을 정함.",
      "terms": [
        "from __future__ import annotations",
        "Path(__file__).resolve().parent",
        "load_dotenv",
        "Pydantic",
        "ChatGroq",
        "Chroma",
        "OpenAIEmbeddings",
        "ChatPromptTemplate",
        "StrOutputParser",
        "DuckDuckGoSearchAPIWrapper",
        "DuckDuckGo",
        "build()",
        "YouTube Data API v3",
        "LangGraph",
        "StateGraph",
        "START",
        "END",
        "컬렉션",
        "영속화",
        "text-embedding-3-small",
        "TOP_K",
        "MAX_RETRIES",
        "recursion_limit",
        "멀티턴",
        "html.unescape"
      ],
      "lines": [
        {
          "at": "from __future__ import annotations",
          "text": "타입 힌트를 문자열로 평가해 가볍게 쓰게 하는 파이썬 설정."
        },
        {
          "at": "sys.stdout.reconfigure(encoding",
          "text": "윈도우 콘솔에서 한글이 깨지지 않도록 출력 인코딩을 UTF-8로 바꿈."
        },
        {
          "at": "from pydantic import BaseModel, Field",
          "text": "LLM 출력을 정해진 형식으로 강제하기 위한 Pydantic 스키마 도구를 가져옴."
        },
        {
          "at": "from langchain_groq import ChatGroq",
          "text": "Groq 클라우드에 채팅 요청을 보내는 LLM 래퍼를 가져옴."
        },
        {
          "at": "from langchain_community.utilities import DuckDuckGoSearchAPIWrapper",
          "text": "API 키 없이 쓰는 무료 웹 검색 도구(DuckDuckGo) 래퍼를 가져옴."
        },
        {
          "at": "from googleapiclient.discovery import build",
          "text": "YouTube Data API v3 클라이언트를 만드는 build 함수를 가져옴."
        },
        {
          "at": "from langgraph.graph import StateGraph, START, END",
          "text": "상태를 노드 사이로 흘려보내는 LangGraph 그래프(StateGraph)와 시작·종료 지점(START/END)을 가져옴."
        },
        {
          "at": "SCRIPT_DIR = Path(__file__)",
          "text": "이 파일이 있는 폴더(agentic-rag/)를 절대경로로 구함 — 실행 위치와 무관하게 동작."
        },
        {
          "at": "HANDS_ON_DIR = SCRIPT_DIR.parent.parent",
          "text": "두 단계 상위인 hands-on/ 폴더를 가리킴(이 예제는 12장 폴더에 있음)."
        },
        {
          "at": "VECTORDB_DIR = HANDS_ON_DIR",
          "text": "10.rag/vectordb 의 공용 특허법 ChromaDB를 빌려 가리킴(별도로 인덱싱하지 않음)."
        },
        {
          "at": "load_dotenv(ENV_PATH)",
          "text": ".env 에서 GROQ·OPENAI·YOUTUBE API 키를 실제로 읽어 환경변수로 올림."
        },
        {
          "at": "COLLECTION_NAME = \"patent_law\"",
          "text": "검색할 벡터 DB의 컬렉션 이름 — 인덱싱 때와 같아야 함."
        },
        {
          "at": "TOP_K = 5",
          "text": "벡터DB 검색으로 가져올 비슷한 청크 개수를 5개로 정함(top-k)."
        },
        {
          "at": "WEB_MAX_RESULTS = 5",
          "text": "웹(DuckDuckGo) 검색 결과를 최근 5개로 제한함."
        },
        {
          "at": "RECENT_DAYS = 365",
          "text": "웹·유튜브 검색을 최근 1년(365일)으로 필터링하는 기준."
        },
        {
          "at": "MAX_RETRIES = 3",
          "text": "[IsUse] 실패 시 질문을 고쳐 다시 검색하는 최대 횟수(3회)."
        },
        {
          "at": "HISTORY_TURNS = 6",
          "text": "프롬프트에 포함할 직전 대화 메시지 수 — 멀티턴 맥락 제공용."
        },
        {
          "at": "RECURSION_LIMIT = 50",
          "text": "재검색 루프가 그래프 기본 한계(25)에 걸리지 않도록 상향한 단계 상한."
        },
        {
          "at": "ARTICLE_PATTERN = re.compile(",
          "text": "본문에서 '제29조'·'제42조의2' 같은 법령 조항을 뽑아내는 정규식(출처 표기용)."
        }
      ],
      "code": "from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함\n\nimport html\nimport os\nimport re\nimport sys\nfrom datetime import datetime, timedelta, timezone\nfrom pathlib import Path\nfrom typing import Annotated, Literal, Optional, TypedDict\n\n# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함\nif hasattr(sys.stdout, \"reconfigure\"):\n    sys.stdout.reconfigure(encoding=\"utf-8\")\n\nfrom dotenv import load_dotenv\nfrom pydantic import BaseModel, Field\n\n# ChatGroq: Groq LPU 채팅 모델 래퍼 (llm.invoke()로 대화 요청 전송)\nfrom langchain_groq import ChatGroq\nfrom langchain_chroma import Chroma                       # ChromaDB 벡터 스토어 래퍼\nfrom langchain_openai import OpenAIEmbeddings             # OpenAI 임베딩 모델 (질의 벡터화)\nfrom langchain_core.documents import Document             # LangChain 문서 객체 타입\nfrom langchain_core.prompts import ChatPromptTemplate     # LLM 프롬프트 템플릿\nfrom langchain_core.output_parsers import StrOutputParser  # LLM 출력에서 문자열만 추출\n\n# DuckDuckGoSearchAPIWrapper: 무료 웹 검색 유틸리티 (API 키 불필요, .results()로 링크 포함 결과 반환)\nfrom langchain_community.utilities import DuckDuckGoSearchAPIWrapper\n\n# build: YouTube Data API v3 클라이언트를 생성하는 google-api-python-client 함수\nfrom googleapiclient.discovery import build\n\n# StateGraph: 상태(State)를 노드 사이로 흘려보내며 워크플로우를 구성하는 LangGraph 그래프\n# START/END: 그래프의 가상 시작·종료 지점을 나타내는 특수 노드\nfrom langgraph.graph import StateGraph, START, END\n\n# ---------------------------------------------------------------------------\n# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)\n# ---------------------------------------------------------------------------\nSCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(agentic-rag/)를 절대경로로 구함\nHANDS_ON_DIR = SCRIPT_DIR.parent.parent         # hands-on/\nVECTORDB_DIR = HANDS_ON_DIR / \"10.rag\" / \"vectordb\"  # 특허법 공용 ChromaDB 영속 디렉터리 (10.rag/vectordb)\nENV_PATH = HANDS_ON_DIR / \".env\"                # hands-on/.env (API 키 보관)\n\n# .env에서 GROQ_API_KEY(LLM)·OPENAI_API_KEY(임베딩)·YOUTUBE_API_KEY(영상 검색)를 로드함\nload_dotenv(ENV_PATH)\n\n# ---------------------------------------------------------------------------\n# 상수 정의\n# ---------------------------------------------------------------------------\nCOLLECTION_NAME = \"patent_law\"               # 특허법 벡터 DB 컬렉션명 (indexing과 반드시 동일해야 검색됨)\nEMBEDDING_MODEL = \"text-embedding-3-small\"   # 인덱싱과 동일 임베딩 모델 (1536차원, 다르면 검색 불가)\nLLM_MODEL = \"openai/gpt-oss-120b\"            # Groq LPU에서 서빙하는 OpenAI gpt-oss 120B 모델\nTOP_K = 5                                    # 벡터DB 유사도 검색 시 가져올 문서 수\nWEB_MAX_RESULTS = 5                          # 웹(DuckDuckGo) 검색 결과 수 (MUST: 최신 5개)\nYOUTUBE_MAX_RESULTS = 5                      # YouTube 검색 결과 수\nRECENT_DAYS = 365                            # 웹·YouTube 검색 최근 1년 필터 (MUST)\nMAX_RETRIES = 3                              # [IsUse] 실패 시 Query Rewriting 재시도 최대 횟수\nHISTORY_TURNS = 6                            # 프롬프트에 포함할 직전 대화 메시지 수 (멀티턴 맥락)\nRECURSION_LIMIT = 50                         # 재시도 루프가 그래프 기본 한계(25)에 걸리지 않도록 상향\n\n# 법령 조항(제29조, 제42조의2 등)을 본문에서 추출하기 위한 정규식 (출처 표기에 사용)\nARTICLE_PATTERN = re.compile(r\"제\\d+조(?:의\\d+)?\")"
    },
    {
      "id": "schemas",
      "name": "라우팅·Reflection 스키마 (Pydantic 5종)",
      "fileId": "main",
      "summary": "라우팅 결정과 4가지 자기성찰 판단([Route]·[IsRel]·[IsSup]·[IsUse]) 및 질문 재작성 결과를 담을 '정해진 답안지 양식'을 정의함.",
      "how": "LLM에게 자유 문장 대신 '이 칸을 채워라'는 양식(스키마)을 주면 결과를 안정적으로 읽을 수 있음. 각 클래스는 with_structured_output() 과 짝을 이뤄 LLM이 반드시 이 형식(JSON)으로 답하도록 강제함. RouteDecision=검색 필요+소스+소스별 쿼리(Self-RAG의 단순 검색여부 판단을 확장한 핵심), RelevanceGrade/BatchRelevanceGrade=문서 관련성(여러 건 묶음), SupportGrade=근거성, UsefulnessGrade=유용성, RewrittenQuery=고쳐 쓴 질문을 각각 담음.",
      "terms": [
        "Pydantic",
        "with_structured_output",
        "RouteDecision",
        "Reflection",
        "멀티소스 라우팅",
        "문서 관련성 평가",
        "환각 점검",
        "답변 유용성 평가",
        "질문 재작성"
      ],
      "lines": [
        {
          "at": "class RouteDecision",
          "text": "[Route] 결과 양식: 검색 필요 여부 + 선택 소스 + 소스별 쿼리 + 근거를 담음(Self-RAG 확장)."
        },
        {
          "at": "needs_retrieval: bool = Field",
          "text": "특허/지식재산권 질문이라 외부 검색이 필요한지 참/거짓으로 표시하는 칸."
        },
        {
          "at": "sources: list[Literal[\"vectordb\", \"web\", \"youtube\"]]",
          "text": "검색에 쓸 소스 목록을 vectordb·web·youtube 중에서 복수로 고르는 칸."
        },
        {
          "at": "web_query: str = Field",
          "text": "웹 검색용 키워드. 연도·시간 표현은 넣지 않도록 지시하는 칸."
        },
        {
          "at": "youtube_query: str = Field",
          "text": "YouTube 검색용 짧은 키워드를 담는 칸."
        },
        {
          "at": "class RelevanceGrade",
          "text": "[IsRel] 결과 양식(문서 1건): 몇 번 문서가 관련 있는지 담음."
        },
        {
          "at": "class BatchRelevanceGrade",
          "text": "[IsRel] 결과를 여러 문서분 한꺼번에 담는 양식(1회 호출 일괄 평가용)."
        },
        {
          "at": "class SupportGrade",
          "text": "[IsSup] 결과 양식: 답변이 컨텍스트에 근거하는지(환각 없는지) 담음."
        },
        {
          "at": "is_supported: bool = Field",
          "text": "답변이 검색 컨텍스트로 뒷받침되는지 참/거짓으로 표시하는 칸."
        },
        {
          "at": "class UsefulnessGrade",
          "text": "[IsUse] 결과 양식: 답변이 질문에 유용한지 담음."
        },
        {
          "at": "is_useful: bool = Field",
          "text": "답변이 질문에 실질적으로 도움이 되는지 참/거짓으로 표시하는 칸."
        },
        {
          "at": "class RewrittenQuery",
          "text": "질문 재작성 결과 양식: 검색에 더 좋게 고친 질문을 담음."
        },
        {
          "at": "rewritten_query: str = Field",
          "text": "검색 최적화를 위해 다시 작성한 질문 문장을 담는 칸."
        }
      ],
      "code": "class RouteDecision(BaseModel):\n    \"\"\"라우터 결과: 검색 필요 여부 + 선택 소스 + 소스별 최적 쿼리 (Retrieve 토큰 확장).\"\"\"\n    needs_retrieval: bool = Field(description=\"특허/지식재산권 질문이라 외부 검색이 필요한지 여부\")\n    sources: list[Literal[\"vectordb\", \"web\", \"youtube\"]] = Field(\n        description=\"검색에 사용할 소스 목록 (vectordb=특허법 조문, web=최신/비용/사례, youtube=영상/튜토리얼)\"\n    )\n    web_query: str = Field(description=\"웹 검색용 쿼리. 연도·시간 표현 제외 (예: '2024' 금지)\")\n    youtube_query: str = Field(description=\"YouTube 검색용 쿼리. 쉼표 없이 짧은 키워드로 작성\")\n    reasoning: str = Field(description=\"판단 근거 (한국어 한 문장)\")\n\n\nclass RelevanceGrade(BaseModel):\n    \"\"\"[IsRel] 토큰 결과: 벡터DB 문서 한 건의 관련성 평가.\"\"\"\n    document_index: int = Field(description=\"평가 대상 문서의 인덱스 (0부터 시작)\")\n    is_relevant: bool = Field(description=\"해당 문서가 질문과 관련 있는지 여부\")\n\n\nclass BatchRelevanceGrade(BaseModel):\n    \"\"\"[IsRel] 토큰 결과: 여러 문서의 관련성 일괄 평가 (1회 LLM 호출로 전체 평가).\"\"\"\n    results: list[RelevanceGrade] = Field(description=\"각 문서의 관련성 평가 결과 리스트\")\n\n\nclass SupportGrade(BaseModel):\n    \"\"\"[IsSup] 토큰 결과: 답변의 근거성 평가.\"\"\"\n    is_supported: bool = Field(description=\"생성된 답변이 검색 컨텍스트에 근거하는지 여부\")\n    reasoning: str = Field(description=\"근거성 판단 이유 (한국어 한 문장)\")\n\n\nclass UsefulnessGrade(BaseModel):\n    \"\"\"[IsUse] 토큰 결과: 답변 유용성 평가.\"\"\"\n    is_useful: bool = Field(description=\"답변이 사용자 질문에 유용한지 여부\")\n    reasoning: str = Field(description=\"유용성 판단 이유 (한국어 한 문장)\")\n\n\nclass RewrittenQuery(BaseModel):\n    \"\"\"Query Rewriting 결과: 검색에 최적화되도록 다시 작성된 질문.\"\"\"\n    rewritten_query: str = Field(description=\"검색에 최적화되도록 다시 작성된 질문\")\n    reasoning: str = Field(description=\"질문을 다시 작성한 이유 (한국어 한 문장)\")"
    },
    {
      "id": "agent_state",
      "name": "AgentState (TypedDict)",
      "fileId": "main",
      "summary": "LangGraph 그래프 전체에서 노드 사이로 공유·갱신되는 상태 데이터의 '서식'을 정의함.",
      "how": "LangGraph는 하나의 딕셔너리(상태)를 노드들 사이로 흘려보냄. AgentState 는 그 딕셔너리에 어떤 칸(키)이 있는지 TypedDict 로 적어 둔 '서식'임. 각 노드는 이 딕셔너리의 일부 키만 갱신해 반환하면 LangGraph가 기존 상태에 자동 병합함. question(현재 질문, 재작성 시 갱신)·original_question(최초 질문, 평가 기준)·history(멀티턴 맥락)·sources/web_query/youtube_query(라우팅 결과)·vector_docs/web_results/youtube_results(검색 결과)·answer·is_supported·is_useful·retry_count·rewrites 등을 담음.",
      "terms": [
        "AgentState",
        "TypedDict",
        "StateGraph",
        "노드(Node)",
        "멀티턴"
      ],
      "lines": [
        {
          "at": "class AgentState(TypedDict)",
          "text": "노드 사이로 공유되는 상태의 서식을 TypedDict로 정의함."
        },
        {
          "at": "question: str               # 현재 처리 중 질문",
          "text": "현재 처리 중인 질문 — 질문 재작성 시 이 값이 갱신됨."
        },
        {
          "at": "original_question: str",
          "text": "최초 사용자 질문 — 유용성 평가·재작성의 기준으로 보존함."
        },
        {
          "at": "history: list",
          "text": "이전 대화 맥락 목록 — 멀티턴 대화에서 후속 질문 의도 파악용."
        },
        {
          "at": "sources: list               # 선택된 검색 소스",
          "text": "라우터가 고른 검색 소스 목록(vectordb/web/youtube)을 담음."
        },
        {
          "at": "vector_docs_raw: list",
          "text": "벡터DB 원본 검색 결과 — 관련성 평가를 거치기 전 상태."
        },
        {
          "at": "vector_docs: list           # 관련성 평가를 통과한",
          "text": "[IsRel] 관련성 평가를 통과한 특허법 문서만 담음."
        },
        {
          "at": "answer: str                 # 출처 섹션이 포함된",
          "text": "출처 섹션까지 붙은 최종 답변 문자열을 담음."
        },
        {
          "at": "retry_count: int",
          "text": "현재까지 질문 재작성으로 재검색한 횟수를 담음(루프 가드용)."
        },
        {
          "at": "rewrites: list              # Query Rewriting 이력",
          "text": "질문 재작성 이력[{from, to, reasoning}]을 누적해 담음."
        }
      ],
      "code": "class AgentState(TypedDict):\n    \"\"\"그래프 전체에서 노드 사이로 공유·갱신되는 상태 데이터.\n\n    각 노드는 이 딕셔너리의 일부 키만 갱신해 반환하면, LangGraph가 기존 상태에 병합함.\n    \"\"\"\n    question: str               # 현재 처리 중 질문 (Query Rewriting 시 갱신됨)\n    original_question: str      # 최초 사용자 질문 (유용성 평가·재작성의 기준)\n    history: list               # 이전 대화 맥락 [{\"role\": ..., \"content\": ...}] (멀티턴)\n    needs_retrieval: bool       # 검색 필요 여부 (라우터 판단)\n    sources: list               # 선택된 검색 소스 [\"vectordb\", \"web\", \"youtube\"]\n    web_query: str              # 웹 검색용 쿼리 (연도 제외)\n    youtube_query: str          # YouTube 검색용 쿼리 (짧은 키워드)\n    route_reasoning: str        # 라우팅 판단 근거\n    vector_docs_raw: list       # 벡터DB 원본 검색 결과 (관련성 평가 전)\n    vector_docs: list           # 관련성 평가를 통과한 특허법 문서\n    web_results: list           # 웹 검색 결과 [{title, snippet, link}]\n    youtube_results: list       # YouTube 검색 결과 [{title, channel, url}]\n    answer: str                 # 출처 섹션이 포함된 최종 답변\n    is_supported: Optional[bool]   # [IsSup] 근거성 평가 결과\n    is_useful: Optional[bool]      # [IsUse] 유용성 평가 결과\n    usefulness_reasoning: str   # 유용성 판단 근거\n    retry_count: int            # 현재까지 Query Rewriting 재시도 횟수\n    rewrites: list              # Query Rewriting 이력 [{from, to, reasoning}]"
    },
    {
      "id": "build_llm",
      "name": "build_llm() / load_vectorstore()",
      "fileId": "main",
      "summary": "답변·평가를 맡을 Groq LLM을 만들고, 이미 만들어진 공용 ChromaDB를 검색 전용으로 연결하는 두 준비 함수.",
      "how": "외부 자원을 준비함. build_llm 은 Groq의 gpt-oss-120b 를 temperature=0(같은 질문엔 같은 판단)으로 만들고, 키가 없으면 즉시 명확한 오류를 냄. load_vectorstore 는 새로 인덱싱하지 않고 10.rag/indexing 이 만들어 둔 영속 컬렉션을 그대로 연결함 — 폴더가 없으면 인덱싱부터 하라는 오류를 내고, 인덱싱과 동일한 임베딩 모델로 OpenAIEmbeddings 를 만들어 질의를 1536차원 벡터로 바꿀 준비를 한 뒤 persist_directory·collection_name 으로 디스크 컬렉션에 접근함.",
      "terms": [
        "ChatGroq",
        "Groq LPU",
        "gpt-oss-120b",
        "temperature",
        "API 키 검사",
        "Chroma",
        "ChromaDB",
        "영속화",
        "컬렉션",
        "OpenAIEmbeddings",
        "text-embedding-3-small",
        "유사도 검색"
      ],
      "lines": [
        {
          "at": "def build_llm",
          "text": "답변·평가용 Groq LLM을 만드는 함수 정의."
        },
        {
          "at": "api_key = os.environ.get(\"GROQ_API_KEY\")",
          "text": "환경변수에서 Groq API 키를 읽음."
        },
        {
          "at": "return ChatGroq(model=LLM_MODEL",
          "text": "모델 이름과 temperature=0 설정으로 Groq 채팅 모델을 만들어 돌려줌."
        },
        {
          "at": "def load_vectorstore",
          "text": "공용 특허법 벡터 DB를 검색 전용으로 연결하는 함수 정의."
        },
        {
          "at": "if not VECTORDB_DIR.exists()",
          "text": "인덱싱이 먼저 돼 있어야 하므로 벡터 DB 폴더 존재를 확인함."
        },
        {
          "at": "embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL",
          "text": "인덱싱과 같은 모델로 질의 임베딩기를 준비함(차원·의미공간 일치)."
        },
        {
          "at": "return Chroma(",
          "text": "신규 생성이 아니라 기존 컬렉션을 '연결'만 해서 돌려줌."
        },
        {
          "at": "persist_directory=str(VECTORDB_DIR)",
          "text": "디스크에 저장된 벡터 폴더를 가리켜 재임베딩 없이 재사용."
        }
      ],
      "code": "def build_llm() -> ChatGroq:\n    \"\"\"Groq LPU의 gpt-oss-120b 모델 인스턴스를 생성함.\n\n    temperature=0으로 고정해 라우팅·평가 등 구조화 판단을 재현 가능하게 함.\n    GROQ_API_KEY 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함.\n    \"\"\"\n    api_key = os.environ.get(\"GROQ_API_KEY\")\n    if not api_key:\n        raise RuntimeError(\"GROQ_API_KEY가 설정되지 않음. hands-on/.env를 확인하세요.\")\n    return ChatGroq(model=LLM_MODEL, temperature=0, api_key=api_key)\n\n\ndef load_vectorstore() -> Chroma:\n    \"\"\"특허법 공용 벡터 DB를 임베딩 없이 로드함 (검색 전용).\n\n    인덱싱과 동일한 컬렉션명(patent_law)·임베딩 모델(text-embedding-3-small)을 지정해야\n    질의 벡터와 저장 벡터의 차원·의미 공간이 일치하여 검색이 정상 동작함.\n    \"\"\"\n    if not VECTORDB_DIR.exists():\n        raise FileNotFoundError(\n            f\"특허법 벡터 DB를 찾을 수 없음: {VECTORDB_DIR}\\n\"\n            f\"먼저 'hands-on/10.rag/indexing/indexing.py'를 실행하여 벡터 DB를 구축하세요.\"\n        )\n    # 질의를 1536차원 벡터로 변환 (OPENAI_API_KEY 환경변수 자동 사용)\n    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL, api_key=os.environ.get(\"OPENAI_API_KEY\"))\n    return Chroma(\n        persist_directory=str(VECTORDB_DIR),\n        collection_name=COLLECTION_NAME,\n        embedding_function=embeddings,\n    )"
    },
    {
      "id": "search_web",
      "name": "search_web() — 웹 검색",
      "fileId": "main",
      "summary": "DuckDuckGo로 최근 1년 웹 문서를 검색해 제목·요약·링크를 정리해 돌려주는 함수.",
      "how": "DuckDuckGoSearchAPIWrapper 의 .results() 는 .run()(텍스트만)과 달리 title·snippet·link 가 든 딕셔너리 리스트를 줘서, 출처 URL 표기가 필요한 이 예제에 적합함. region=\"ko-kr\"로 한국 결과를, time=\"y\"로 최근 1년만 검색함(그래서 쿼리에 연도를 넣지 않음). 결과에 섞여 들어온 YouTube 링크는 걸러냄 — 영상은 YouTube Data API가 담당하므로 '웹' 출처와 '영상' 출처를 분리하기 위함.",
      "terms": [
        "DuckDuckGo",
        "DuckDuckGoSearchAPIWrapper",
        "멀티소스 라우팅",
        "graceful degradation"
      ],
      "lines": [
        {
          "at": "def search_web",
          "text": "DuckDuckGo로 최근 1년 웹 문서를 검색하는 함수 정의."
        },
        {
          "at": "wrapper = DuckDuckGoSearchAPIWrapper(",
          "text": "한국 지역·최근 1년·최대 5건 설정으로 웹 검색 도구를 만듦."
        },
        {
          "at": "raw_results = wrapper.results(query, WEB_MAX_RESULTS)",
          "text": "제목·요약·링크가 담긴 상세 결과 리스트를 받아옴."
        },
        {
          "at": "if \"youtube.com\" in link or \"youtu.be\" in link:",
          "text": "웹 결과에 섞인 YouTube 링크는 제외해 소스(웹/영상)를 분리함."
        },
        {
          "at": "normalized.append({",
          "text": "제목·요약·링크만 깔끔히 추려 표준 형식으로 모음."
        }
      ],
      "code": "def search_web(query: str) -> list[dict]:\n    \"\"\"DuckDuckGo로 최근 1년 웹 문서를 검색하여 링크 포함 결과를 반환함.\n\n    DuckDuckGoSearchAPIWrapper의 .results()는 .run()(텍스트만)과 달리 title·snippet·link를\n    담은 딕셔너리 리스트를 반환하므로, 출처 URL 표기가 필요한 본 예제에 적합함.\n    time=\"y\"로 최근 1년만 검색하므로 쿼리에는 연도·시간 표현을 넣지 않음.\n    \"\"\"\n    wrapper = DuckDuckGoSearchAPIWrapper(\n        region=\"ko-kr\",            # 한국어/한국 지역 결과 우선\n        time=\"y\",                  # 최근 1년 필터 (MUST)\n        max_results=WEB_MAX_RESULTS,\n    )\n    # results(query, max_results): 상세 결과 리스트 반환 (생성자 외에 호출 시에도 개수를 명시)\n    raw_results = wrapper.results(query, WEB_MAX_RESULTS)\n    normalized = []\n    for item in raw_results:\n        link = item.get(\"link\", \"\")\n        # 웹 결과에 섞여 들어온 YouTube 페이지는 제외함. 영상은 YouTube Data API 검색이 담당하므로,\n        # '웹' 출처에 YouTube 링크가 표기되어 소스가 뒤섞이는 것을 막음 (웹/영상 소스 분리).\n        if \"youtube.com\" in link or \"youtu.be\" in link:\n            continue\n        normalized.append({\n            \"title\": item.get(\"title\", \"제목 없음\"),\n            \"snippet\": item.get(\"snippet\", \"\"),\n            \"link\": link,\n        })\n    return normalized"
    },
    {
      "id": "search_youtube",
      "name": "search_youtube() — 영상 검색",
      "fileId": "main",
      "summary": "YouTube Data API v3로 최근 1년 영상을 검색해 제목·채널·URL을 돌려주는 함수.",
      "how": "build(\"youtube\", \"v3\", ...) 로 YouTube Data API v3 클라이언트를 만들고, publishedAfter 에 '지금(UTC)에서 365일 전' 시각을 ISO 8601 문자열로 넣어 최신 영상만 검색함. relevanceLanguage=\"ko\"로 한국어 영상을 우선하고, type=\"video\"로 영상만 가져옴. 제목에 든 HTML 엔티티(&#39; 같은 코드)는 html.unescape 로 사람이 읽는 형태로 복원함. videoId 로 시청 URL을 조립함.",
      "terms": [
        "build()",
        "YouTube Data API v3",
        "html.unescape",
        "멀티소스 라우팅"
      ],
      "lines": [
        {
          "at": "def search_youtube",
          "text": "YouTube Data API v3로 최근 1년 영상을 검색하는 함수 정의."
        },
        {
          "at": "api_key = os.environ.get(\"YOUTUBE_API_KEY\")",
          "text": "환경변수에서 YouTube API 키를 읽음(없으면 명확한 오류)."
        },
        {
          "at": "youtube = build(\"youtube\", \"v3\"",
          "text": "API 키로 YouTube Data API v3 호출용 클라이언트를 만듦."
        },
        {
          "at": "published_after = (",
          "text": "현재(UTC)에서 365일을 뺀 시각을 계산해 최근 1년 필터를 만듦."
        },
        {
          "at": "request = youtube.search().list(",
          "text": "검색어·영상만·관련성순·최근 1년·한국어 우선 조건으로 검색 요청을 구성."
        },
        {
          "at": "response = request.execute()",
          "text": "구성한 검색 요청을 실제로 YouTube 서버에 보내 결과를 받음."
        },
        {
          "at": "\"title\": html.unescape(item[\"snippet\"][\"title\"])",
          "text": "제목 속 HTML 엔티티(&#39; 등)를 사람이 읽는 글자로 복원함."
        }
      ],
      "code": "def search_youtube(query: str) -> list[dict]:\n    \"\"\"YouTube Data API v3로 최근 1년 영상을 검색하여 제목·채널·URL을 반환함.\n\n    publishedAfter에 1년 전 시각(ISO 8601)을 지정해 최신 영상만 검색하고, relevanceLanguage=\"ko\"로\n    한국어 영상을 우선함. 제목의 HTML 엔티티(&#39; 등)는 html.unescape로 사람이 읽는 형태로 복원함.\n    \"\"\"\n    api_key = os.environ.get(\"YOUTUBE_API_KEY\")\n    if not api_key:\n        raise RuntimeError(\"YOUTUBE_API_KEY가 설정되지 않음. hands-on/.env를 확인하세요.\")\n    # build(\"youtube\", \"v3\", ...): YouTube Data API v3 호출용 클라이언트 객체 생성\n    youtube = build(\"youtube\", \"v3\", developerKey=api_key)\n    # 최근 1년 필터: 현재(UTC)에서 365일을 뺀 시각을 API가 요구하는 ISO 8601 문자열로 변환\n    published_after = (\n        datetime.now(timezone.utc) - timedelta(days=RECENT_DAYS)\n    ).strftime(\"%Y-%m-%dT%H:%M:%SZ\")\n    request = youtube.search().list(\n        q=query,\n        part=\"snippet\",            # 제목·채널명 등 기본 메타데이터 반환\n        type=\"video\",              # 영상만 검색 (채널·재생목록 제외)\n        order=\"relevance\",         # 관련성 순 정렬\n        publishedAfter=published_after,  # 최근 1년 영상만 (MUST)\n        maxResults=YOUTUBE_MAX_RESULTS,\n        relevanceLanguage=\"ko\",    # 한국어 영상 우선\n    )\n    response = request.execute()\n    results = []\n    for item in response.get(\"items\", []):\n        video_id = item[\"id\"][\"videoId\"]\n        results.append({\n            \"title\": html.unescape(item[\"snippet\"][\"title\"]),\n            \"channel\": html.unescape(item[\"snippet\"][\"channelTitle\"]),\n            \"url\": f\"https://www.youtube.com/watch?v={video_id}\",\n        })\n    return results"
    },
    {
      "id": "helpers",
      "name": "보조 함수 (format_history / build_context / build_sources_section)",
      "fileId": "main",
      "summary": "대화 맥락·검색 컨텍스트·출처 섹션을 텍스트로 만들어 주는 세 도우미 함수.",
      "how": "프롬프트와 답변에 들어갈 텍스트를 조립함. ① format_history: 직전 대화 메시지(최근 HISTORY_TURNS개)를 '사용자:/어시스턴트:' 형태 텍스트로 바꿔 멀티턴 맥락을 제공함. ② build_context: 벡터DB·웹·유튜브 검색 결과를 섹션별로 묶어 답변 생성용 단일 컨텍스트 문자열로 합침. ③ build_sources_section: 출처 섹션을 LLM이 아닌 코드에서 직접 만듦 — 법률은 본문에서 정규식으로 조항(제29조 등)을 뽑고, 웹·유튜브는 제목+URL을 마크다운 링크로 출력해 URL 누락을 원천 차단함(MUST).",
      "terms": [
        "멀티턴",
        "Document",
        "metadata",
        "html.unescape"
      ],
      "lines": [
        {
          "at": "def format_history",
          "text": "직전 대화를 프롬프트용 텍스트로 바꾸는 멀티턴 맥락 함수 정의."
        },
        {
          "at": "recent = history[-HISTORY_TURNS:]",
          "text": "최근 HISTORY_TURNS개 메시지만 잘라 토큰·비용을 제한함."
        },
        {
          "at": "def build_context",
          "text": "검색 결과 3종을 하나의 컨텍스트 문자열로 합치는 함수 정의."
        },
        {
          "at": "sections.append(\"=== 특허법 조문 (벡터DB) ===",
          "text": "벡터DB 법률 근거를 한 섹션으로 묶음."
        },
        {
          "at": "sections.append(\"=== 웹 검색 결과 (DuckDuckGo, 최근 1년) ===",
          "text": "웹 검색 결과(최신/비용/사례)를 한 섹션으로 묶음."
        },
        {
          "at": "def build_sources_section",
          "text": "출처 섹션을 코드에서 직접 구성하는 함수 정의(LLM에 맡기지 않음)."
        },
        {
          "at": "for article in ARTICLE_PATTERN.findall(doc.page_content):",
          "text": "본문에서 정규식으로 조항 번호(제29조 등)를 뽑아 법률 출처로 묶음."
        },
        {
          "at": "web_lines = [f\"- [{item['title']}]({item['link']})\"",
          "text": "웹 출처를 '제목+URL' 마크다운 링크로 만들어 URL 누락을 막음(MUST)."
        }
      ],
      "code": "def format_history(history: list) -> str:\n    \"\"\"직전 대화 메시지를 프롬프트에 넣을 텍스트로 변환함 (멀티턴 맥락 제공).\"\"\"\n    if not history:\n        return \"(이전 대화 없음)\"\n    # 최근 HISTORY_TURNS개 메시지만 사용해 토큰·비용을 제한함\n    recent = history[-HISTORY_TURNS:]\n    lines = []\n    for message in recent:\n        speaker = \"사용자\" if message[\"role\"] == \"user\" else \"어시스턴트\"\n        lines.append(f\"{speaker}: {message['content']}\")\n    return \"\\n\".join(lines)\n\n\ndef build_context(state: AgentState) -> str:\n    \"\"\"벡터DB·웹·YouTube 검색 결과를 답변 생성용 단일 컨텍스트 문자열로 합침.\"\"\"\n    sections = []\n    # 1) 특허법 벡터DB (법률 근거)\n    if state[\"vector_docs\"]:\n        law_parts = []\n        for i, doc in enumerate(state[\"vector_docs\"], 1):\n            source = doc.metadata.get(\"source\", \"특허법\")\n            chunk_index = doc.metadata.get(\"chunk_index\", \"?\")\n            law_parts.append(f\"[법률 {i}] (출처: {source} #{chunk_index})\\n{doc.page_content}\")\n        sections.append(\"=== 특허법 조문 (벡터DB) ===\\n\" + \"\\n\\n\".join(law_parts))\n    # 2) 웹 검색 결과 (최신 정보·비용·사례)\n    if state[\"web_results\"]:\n        web_parts = []\n        for i, item in enumerate(state[\"web_results\"], 1):\n            web_parts.append(f\"[웹 {i}] {item['title']}\\n{item['snippet']}\\nURL: {item['link']}\")\n        sections.append(\"=== 웹 검색 결과 (DuckDuckGo, 최근 1년) ===\\n\" + \"\\n\\n\".join(web_parts))\n    # 3) YouTube 검색 결과 (튜토리얼·영상)\n    if state[\"youtube_results\"]:\n        yt_parts = []\n        for i, item in enumerate(state[\"youtube_results\"], 1):\n            yt_parts.append(f\"[영상 {i}] {item['title']} ({item['channel']})\\nURL: {item['url']}\")\n        sections.append(\"=== YouTube 검색 결과 (최근 1년) ===\\n\" + \"\\n\\n\".join(yt_parts))\n    return \"\\n\\n\".join(sections) if sections else \"(검색 결과 없음)\"\n\n\ndef build_sources_section(state: AgentState) -> str:\n    \"\"\"수집된 검색 결과 메타데이터로 '출처' 섹션을 코드에서 직접 구성함.\n\n    URL 누락을 막기 위해 LLM 출력에 의존하지 않고, 검색 단계에서 모은 링크를 그대로 표기함(MUST).\n    법률은 본문에서 추출한 조항(제29조 등), 웹·YouTube는 제목+URL 링크를 마크다운으로 출력함.\n    \"\"\"\n    blocks = []\n\n    # 법률 출처: 문서 출처(법령명)별로 본문에서 조항 번호를 추출해 묶음\n    if state[\"vector_docs\"]:\n        law_articles: dict[str, list[str]] = {}\n        for doc in state[\"vector_docs\"]:\n            # 메타데이터 source는 PDF 파일명이므로 확장자를 떼어 법령명으로 사용 (예: 특허법.pdf → 특허법)\n            law_name = Path(doc.metadata.get(\"source\", \"특허법\")).stem or \"특허법\"\n            law_articles.setdefault(law_name, [])\n            for article in ARTICLE_PATTERN.findall(doc.page_content):\n                # 같은 조항이 여러 청크에 걸쳐 등장할 수 있으므로 중복은 제외하고 순서를 보존함\n                if article not in law_articles[law_name]:\n                    law_articles[law_name].append(article)\n        law_lines = []\n        for law_name, articles in law_articles.items():\n            if articles:\n                law_lines.append(f\"- {law_name} {', '.join(articles)}\")\n            else:\n                law_lines.append(f\"- {law_name}\")\n        blocks.append(\"**법률**\\n\" + \"\\n\".join(law_lines))\n\n    # 웹 출처: 제목 + URL 링크 (반드시 포함)\n    if state[\"web_results\"]:\n        web_lines = [f\"- [{item['title']}]({item['link']})\" for item in state[\"web_results\"] if item[\"link\"]]\n        if web_lines:\n            blocks.append(\"**웹**\\n\" + \"\\n\".join(web_lines))\n\n    # YouTube 출처: 제목 + URL 링크 (반드시 포함)\n    if state[\"youtube_results\"]:\n        yt_lines = [f\"- [{item['title']}]({item['url']})\" for item in state[\"youtube_results\"] if item[\"url\"]]\n        if yt_lines:\n            blocks.append(\"**YouTube**\\n\" + \"\\n\".join(yt_lines))\n\n    if not blocks:\n        return \"\"\n    return \"## 출처\\n\" + \"\\n\\n\".join(blocks)"
    },
    {
      "id": "init",
      "name": "AgenticRAG.__init__()",
      "fileId": "main",
      "summary": "검색기와 5개의 '구조화 출력 평가기'를 만들고, 노드를 연결한 그래프를 미리 컴파일해 두는 초기화 부분.",
      "how": "Agentic RAG 본체의 부품을 준비함. ① 벡터 스토어를 유사도 기반 검색기(retriever)로 바꿔 상위 TOP_K개를 찾게 함. ② with_structured_output(method=\"json_schema\") 로 LLM 을 5개의 전용 평가기(라우터·관련성·근거성·유용성·질문재작성)로 감쌈. json_schema 를 쓰는 이유: gpt-oss-120b 는 기본 도구호출 모드에서 도구 이름을 잘못 만들어 실패할 수 있어, 도구 이름이 없는 json_schema 방식으로 안정성을 확보함. ③ 마지막에 _build_graph() 로 노드·엣지를 연결한 실행 그래프를 미리 컴파일해 self.graph 에 둠.",
      "terms": [
        "retriever",
        "as_retriever",
        "유사도 검색",
        "TOP_K",
        "with_structured_output",
        "json_schema",
        "멀티소스 라우팅",
        "문서 관련성 평가",
        "환각 점검",
        "답변 유용성 평가",
        "질문 재작성",
        "StateGraph"
      ],
      "lines": [
        {
          "at": "def __init__(self, llm: ChatGroq, vectorstore: Chroma)",
          "text": "검색기·평가기·그래프를 준비하는 초기화 메서드 정의."
        },
        {
          "at": "self.retriever = vectorstore.as_retriever(",
          "text": "벡터 스토어를 유사도 기반 검색기로 바꿔 보관."
        },
        {
          "at": "search_kwargs={\"k\": TOP_K}",
          "text": "검색 시 상위 TOP_K(5)개 청크만 가져오도록 설정."
        },
        {
          "at": "self.router = llm.with_structured_output(RouteDecision",
          "text": "[Route] 결정을 RouteDecision 양식으로 강제하는 라우터를 만듦."
        },
        {
          "at": "self.relevance_grader = llm.with_structured_output",
          "text": "[IsRel] 일괄 관련성 평가를 BatchRelevanceGrade 양식으로 강제하는 평가기를 만듦."
        },
        {
          "at": "self.support_grader = llm.with_structured_output",
          "text": "[IsSup] 근거성 평가를 SupportGrade 양식으로 강제하는 평가기를 만듦."
        },
        {
          "at": "self.usefulness_grader = llm.with_structured_output",
          "text": "[IsUse] 유용성 평가를 UsefulnessGrade 양식으로 강제하는 평가기를 만듦."
        },
        {
          "at": "self.query_rewriter = llm.with_structured_output",
          "text": "질문 재작성을 RewrittenQuery 양식으로 강제하는 평가기를 만듦."
        },
        {
          "at": "self.graph = self._build_graph()",
          "text": "노드·엣지를 연결한 실행 가능한 그래프를 미리 컴파일해 보관."
        }
      ],
      "code": "    def __init__(self, llm: ChatGroq, vectorstore: Chroma):\n        self.llm = llm\n        # 코사인 유사도 기반으로 가장 유사한 TOP_K개 문서를 반환하는 검색기\n        self.retriever = vectorstore.as_retriever(\n            search_type=\"similarity\",\n            search_kwargs={\"k\": TOP_K},\n        )\n        # with_structured_output(method=\"json_schema\"): LLM 응답을 Pydantic 스키마(JSON)로 강제함.\n        # gpt-oss-120b는 기본 function_calling 모드에서 도구 이름을 잘못 생성해 호출이 실패할 수 있어,\n        # 도구 이름이 없는 json_schema 방식으로 안정성을 확보함 (Self-RAG 예제에서 검증된 설정).\n        self.router = llm.with_structured_output(RouteDecision, method=\"json_schema\")\n        self.relevance_grader = llm.with_structured_output(BatchRelevanceGrade, method=\"json_schema\")\n        self.support_grader = llm.with_structured_output(SupportGrade, method=\"json_schema\")\n        self.usefulness_grader = llm.with_structured_output(UsefulnessGrade, method=\"json_schema\")\n        self.query_rewriter = llm.with_structured_output(RewrittenQuery, method=\"json_schema\")\n        # 노드들을 연결한 실행 가능한 그래프를 미리 컴파일해 둠\n        self.graph = self._build_graph()"
    },
    {
      "id": "route",
      "name": "route 노드 — [Route]",
      "fileId": "main",
      "summary": "질문을 보고 검색 필요 여부·검색 소스·소스별 쿼리를 결정하는 그래프의 첫 노드.",
      "how": "그래프의 첫 노드임. 시스템 프롬프트로 '특허/지식재산권이면 vectordb·web·youtube 중 적절히 고르고, 인사·특허 외 주제면 검색하지 말라'는 기준과 쿼리 작성 규칙(web_query에 연도 금지 등)을 줌. 이전 대화 맥락(format_history)을 함께 넣어 후속 질문 의도를 파악함. prompt | self.router 로 RouteDecision 결과를 받고, 검색 불필요면 소스를 비워 direct_answer 경로로 흐르게 함. 갱신할 상태 키만 딕셔너리로 반환하면 LangGraph가 병합함.",
      "terms": [
        "노드(Node)",
        "멀티소스 라우팅",
        "RouteDecision",
        "ChatPromptTemplate",
        "파이프(|)",
        "invoke",
        "멀티턴"
      ],
      "lines": [
        {
          "at": "# ===== 노드 1: Route",
          "text": "검색 필요 여부·소스·쿼리를 정하는 첫 노드임을 표시하는 구분 헤더."
        },
        {
          "at": "def route(self, state: AgentState) -> dict:",
          "text": "라우터 노드 메서드 정의 — 상태를 받아 갱신할 키만 돌려줌."
        },
        {
          "at": "print(\"\\n[Route] 검색 필요 여부 및 소스 판단 중...\")",
          "text": "라우팅을 시작한다는 진행 로그를 출력함."
        },
        {
          "at": "당신은 특허/지식재산권 전문 챗봇의 라우터입니다",
          "text": "검색 전략(필요 여부·소스·쿼리)을 정하라는 라우터 역할 시스템 프롬프트."
        },
        {
          "at": "decision: RouteDecision = (prompt | self.router).invoke({",
          "text": "프롬프트와 라우터를 연결해 RouteDecision 결과를 받음."
        },
        {
          "at": "sources = decision.sources if decision.needs_retrieval else []",
          "text": "검색 불필요면 소스를 비워 direct_answer 경로로 보내도록 함."
        },
        {
          "at": "\"route_reasoning\": decision.reasoning,",
          "text": "라우팅 결과(필요·소스·쿼리·근거)를 상태에 반영하도록 반환함."
        }
      ],
      "code": "    # ===== 노드 1: Route (검색 필요 여부 + 소스 + 소스별 쿼리) =====\n    def route(self, state: AgentState) -> dict:\n        \"\"\"라우터 노드: 특허 질문인지·어떤 소스로 검색할지 판단하고 소스별 쿼리를 생성함.\"\"\"\n        print(\"\\n[Route] 검색 필요 여부 및 소스 판단 중...\")\n        prompt = ChatPromptTemplate.from_messages([\n            (\"system\", \"\"\"당신은 특허/지식재산권 전문 챗봇의 라우터입니다. 사용자 질문을 분석해 검색 전략을 결정하세요.\n\n[검색 필요 = True] — 특허·실용신안·상표·디자인권 등 지식재산권 관련 질문\n  사용 가능한 소스를 적절히 선택하세요 (복수 선택 가능):\n  - vectordb : 특허법 조문·요건·절차 등 '법률 근거'가 필요할 때\n  - web      : 비용·통계·최신 동향·사례 등 '최신 정보'가 필요할 때\n  - youtube  : 강의·튜토리얼·시각적 설명 등 '영상'을 원할 때\n\n[검색 불필요 = False] — 아래는 검색하지 않고 LLM 지식으로 직접 답변\n  - 인사·잡담 (예: 안녕하세요)\n  - 특허/지식재산권과 무관한 주제 (예: 일반 IT 기술, 다른 법률, RAG 같은 개발 주제)\n    → 이 챗봇은 특허 전문이므로 그 외 주제는 검색하지 않음\n\n[쿼리 작성 규칙]\n  - web_query  : 검색에 적합한 핵심 키워드. 연도·시간 표현(2024 등)은 절대 넣지 마세요.\n  - youtube_query : 쉼표 없이 짧은 키워드로 작성 (예: '특허 출원 방법').\n  - 검색 불필요(False)면 web_query·youtube_query는 빈 문자열로 두세요.\n\n이전 대화 맥락을 참고해 후속 질문(예: '그럼 비용은?')의 의도를 정확히 파악하세요.\n판단 근거(reasoning)는 한국어로 작성하세요.\"\"\"),\n            (\"human\", \"이전 대화:\\n{history}\\n\\n현재 질문: {question}\\n\\n검색 전략을 결정하세요.\"),\n        ])\n        decision: RouteDecision = (prompt | self.router).invoke({\n            \"history\": format_history(state.get(\"history\", [])),\n            \"question\": state[\"question\"],\n        })\n        # 검색 불필요로 판단되면 소스를 비워 direct_answer 경로로 흐르게 함\n        sources = decision.sources if decision.needs_retrieval else []\n        print(f\"  → 검색 필요: {decision.needs_retrieval} / 소스: {sources or '없음'}\")\n        print(f\"  → 근거: {decision.reasoning}\")\n        if sources:\n            print(f\"  → web_query: '{decision.web_query}' / youtube_query: '{decision.youtube_query}'\")\n        return {\n            \"needs_retrieval\": decision.needs_retrieval,\n            \"sources\": sources,\n            \"web_query\": decision.web_query,\n            \"youtube_query\": decision.youtube_query,\n            \"route_reasoning\": decision.reasoning,\n        }"
    },
    {
      "id": "retrieve",
      "name": "retrieve 노드 — 멀티소스 검색",
      "fileId": "main",
      "summary": "라우터가 고른 소스(벡터DB·웹·YouTube)에서만 검색하고, 한 소스가 실패해도 나머지로 진행하는 노드.",
      "how": "state[\"sources\"] 에 든 소스에서만 검색함. vectordb 면 retriever 로 유사 청크를, web 이면 search_web 으로, youtube 면 search_youtube 로 결과를 가져옴. 외부 API(웹·유튜브) 호출은 각각 try/except로 감싸 한 소스가 실패해도 예외를 삼키고 진행해, 나머지 소스로 답변을 만들 수 있게 함(graceful degradation). 결과 3종을 상태 키로 반환함.",
      "terms": [
        "노드(Node)",
        "멀티소스 라우팅",
        "graceful degradation",
        "retriever",
        "DuckDuckGo",
        "YouTube Data API v3"
      ],
      "lines": [
        {
          "at": "# ===== 노드 2: Retrieve",
          "text": "선택 소스에서 검색을 수행하는 두 번째 노드임을 표시하는 구분 헤더."
        },
        {
          "at": "def retrieve(self, state: AgentState) -> dict:",
          "text": "멀티소스 검색 노드 메서드 정의."
        },
        {
          "at": "if \"vectordb\" in sources:",
          "text": "소스에 vectordb가 있을 때만 특허법 벡터DB를 검색함."
        },
        {
          "at": "vector_docs_raw = self.retriever.invoke(state[\"question\"])",
          "text": "재작성된 현재 질문으로 유사 청크 top-k를 가져옴."
        },
        {
          "at": "if \"web\" in sources:",
          "text": "소스에 web이 있을 때만 DuckDuckGo 웹 검색을 함."
        },
        {
          "at": "web_results = search_web(state[\"web_query\"] or state[\"question\"])",
          "text": "라우터가 만든 web_query로 웹을 검색함(없으면 원 질문 사용)."
        },
        {
          "at": "if \"youtube\" in sources:",
          "text": "소스에 youtube가 있을 때만 영상 검색을 함."
        },
        {
          "at": "youtube_results = search_youtube(state[\"youtube_query\"] or state[\"question\"])",
          "text": "라우터가 만든 youtube_query로 영상을 검색함(없으면 원 질문 사용)."
        }
      ],
      "code": "    # ===== 노드 2: Retrieve (선택 소스에서 검색) =====\n    def retrieve(self, state: AgentState) -> dict:\n        \"\"\"검색 노드: 라우터가 선택한 소스에서만 검색을 수행함.\n\n        외부 API(웹·YouTube) 호출은 각각 try/except로 감싸 한 소스가 실패해도 나머지 소스로\n        답변을 생성할 수 있게 함 (graceful degradation).\n        \"\"\"\n        sources = state[\"sources\"]\n        vector_docs_raw, web_results, youtube_results = [], [], []\n\n        # 특허법 벡터DB 검색 (재작성된 질문 기준)\n        if \"vectordb\" in sources:\n            print(\"\\n[Retrieve:벡터DB] 특허법 문서 검색 중...\")\n            vector_docs_raw = self.retriever.invoke(state[\"question\"])\n            print(f\"  → {len(vector_docs_raw)}개 문서 검색됨\")\n\n        # 웹 검색 (DuckDuckGo, 연도 제외 쿼리)\n        if \"web\" in sources:\n            print(f\"\\n[Retrieve:웹] DuckDuckGo 검색 중... (쿼리: '{state['web_query']}')\")\n            try:\n                web_results = search_web(state[\"web_query\"] or state[\"question\"])\n                print(f\"  → {len(web_results)}개 결과\")\n            except Exception as error:\n                print(f\"  ! 웹 검색 실패(무시하고 진행): {error}\")\n\n        # YouTube 검색 (Data API v3, 짧은 키워드 쿼리)\n        if \"youtube\" in sources:\n            print(f\"\\n[Retrieve:YouTube] 영상 검색 중... (쿼리: '{state['youtube_query']}')\")\n            try:\n                youtube_results = search_youtube(state[\"youtube_query\"] or state[\"question\"])\n                print(f\"  → {len(youtube_results)}개 영상\")\n            except Exception as error:\n                print(f\"  ! YouTube 검색 실패(무시하고 진행): {error}\")\n\n        return {\n            \"vector_docs_raw\": vector_docs_raw,\n            \"web_results\": web_results,\n            \"youtube_results\": youtube_results,\n        }"
    },
    {
      "id": "grade_documents",
      "name": "grade_documents 노드 — [IsRel]",
      "fileId": "main",
      "summary": "벡터DB 검색 문서의 관련성을 1회 LLM 호출로 일괄 채점해 관련 문서만 선별하는 노드.",
      "how": "문서를 하나씩 평가하면 호출 수가 문서 수만큼 늘어나므로, 모든 문서에 번호를 붙여 한 프롬프트로 묶어 1회에 평가함(비용·지연 절감). 웹·유튜브 결과는 검색 자체가 키워드 기반이라 별도 관련성 평가 없이 그대로 씀. 구조화 출력이 잘못된 인덱스를 줄 수 있어 범위를 검사해 안전하게 매핑하고, 관련 있다고 채점된 문서만 vector_docs 로 돌려줌.",
      "terms": [
        "노드(Node)",
        "문서 관련성 평가",
        "청크",
        "Document",
        "ChatPromptTemplate",
        "파이프(|)",
        "invoke"
      ],
      "lines": [
        {
          "at": "# ===== 노드 3: Grade Documents",
          "text": "벡터DB 문서 관련성을 평가하는 세 번째 노드임을 표시하는 구분 헤더."
        },
        {
          "at": "def grade_documents(self, state: AgentState) -> dict:",
          "text": "관련성 일괄 평가 노드 메서드 정의."
        },
        {
          "at": "docs = state[\"vector_docs_raw\"]",
          "text": "관련성 평가 전 원본 벡터DB 검색 결과를 꺼냄."
        },
        {
          "at": "docs_text = \"\\n\\n\".join(f\"[문서 {i}]",
          "text": "각 문서에 번호를 붙여 한 덩어리 텍스트로 합침(LLM이 번호로 매핑)."
        },
        {
          "at": "당신은 검색된 특허법 문서들이 질문과 관련 있는지 평가하는 전문가입니다",
          "text": "문서 관련성을 판정하라는 역할의 시스템 프롬프트."
        },
        {
          "at": "if 0 <= grade.document_index < len(docs) and grade.is_relevant:",
          "text": "인덱스 범위를 검사하고 관련 있다고 채점된 문서만 모음."
        },
        {
          "at": "return {\"vector_docs\": relevant_docs}",
          "text": "관련 문서만 추려 vector_docs 상태로 돌려줌."
        }
      ],
      "code": "    # ===== 노드 3: Grade Documents (IsRel) =====\n    def grade_documents(self, state: AgentState) -> dict:\n        \"\"\"[IsRel] 노드: 벡터DB 검색 문서의 관련성을 1회 LLM 호출로 일괄 평가해 선별함.\n\n        웹·YouTube 결과는 검색 자체가 키워드 기반이므로 별도 관련성 평가 없이 그대로 사용함.\n        \"\"\"\n        docs = state[\"vector_docs_raw\"]\n        if not docs:\n            return {\"vector_docs\": []}\n\n        print(\"\\n[IsRel] 벡터DB 문서 관련성 일괄 평가 중...\")\n        docs_text = \"\\n\\n\".join(f\"[문서 {i}]\\n{doc.page_content}\" for i, doc in enumerate(docs))\n        prompt = ChatPromptTemplate.from_messages([\n            (\"system\", \"\"\"당신은 검색된 특허법 문서들이 질문과 관련 있는지 평가하는 전문가입니다.\n\n문서가 질문에 답하는 데 직접 도움이 되는 정보를 포함하면 관련 있음(True)으로 판단합니다.\n부분적·간접적으로만 관련되면 관련 없음(False)으로 판단합니다.\n입력된 각 문서를 그 인덱스(document_index)와 함께 개별적으로 평가하여 모두 반환하세요.\"\"\"),\n            (\"human\", \"질문: {question}\\n\\n검색된 문서들:\\n{documents}\\n\\n각 문서의 관련성을 평가해 주세요.\"),\n        ])\n        batch: BatchRelevanceGrade = (prompt | self.relevance_grader).invoke({\n            \"question\": state[\"question\"],\n            \"documents\": docs_text,\n        })\n        relevant_docs = []\n        for grade in batch.results:\n            # 구조화 출력이 잘못된 인덱스를 줄 수 있으므로 범위를 검사해 안전하게 매핑함\n            if 0 <= grade.document_index < len(docs) and grade.is_relevant:\n                relevant_docs.append(docs[grade.document_index])\n        print(f\"  → 관련 문서 {len(relevant_docs)}/{len(docs)}개 선별\")\n        return {\"vector_docs\": relevant_docs}"
    },
    {
      "id": "generate",
      "name": "generate 노드 (+_generate_answer / _grade_support) — [IsSup]",
      "fileId": "main",
      "summary": "멀티소스 컨텍스트로 답을 생성하고, 근거성([IsSup])이 부족하면 엄격 재생성한 뒤 출처를 부착하는 노드와 두 도우미.",
      "how": "generate 노드는 build_context 로 검색 결과를 합쳐 _generate_answer(strict=False) 로 답을 만듦. 검색 컨텍스트가 있을 때만 _grade_support 로 근거성([IsSup])을 검사하고, 부족하면 _generate_answer(strict=True)(컨텍스트만 쓰라는 엄격 프롬프트)로 재생성함(환각 방지). 마지막에 build_sources_section 으로 만든 출처를 코드에서 직접 붙임. _generate_answer 는 대화 맥락·컨텍스트를 넣어 prompt | self.llm | StrOutputParser 로 답변 본문을 얻고, _grade_support 는 SupportGrade 양식으로 근거성 결과를 돌려줌.",
      "terms": [
        "노드(Node)",
        "환각 점검",
        "ChatPromptTemplate",
        "LCEL",
        "파이프(|)",
        "StrOutputParser",
        "프롬프트",
        "invoke",
        "멀티턴"
      ],
      "lines": [
        {
          "at": "# ===== 노드 4: Generate",
          "text": "답변 생성·근거성 검증·출처 부착을 맡는 네 번째 노드임을 표시하는 구분 헤더."
        },
        {
          "at": "def generate(self, state: AgentState) -> dict:",
          "text": "답변 생성 노드 메서드 정의."
        },
        {
          "at": "answer = self._generate_answer(state, context, strict=False)",
          "text": "먼저 일반 모드로 멀티소스 컨텍스트 기반 답변을 생성함."
        },
        {
          "at": "support: SupportGrade = self._grade_support(answer, context)",
          "text": "컨텍스트가 있을 때 답변의 근거성([IsSup])을 검사함."
        },
        {
          "at": "answer = self._generate_answer(state, context, strict=True)",
          "text": "근거가 부족하면 컨텍스트만 쓰는 엄격 모드로 답을 재생성함."
        },
        {
          "at": "sources_section = build_sources_section(state)",
          "text": "출처 섹션을 코드에서 직접 만들어 답변 뒤에 붙임(URL 누락 방지)."
        },
        {
          "at": "def _generate_answer(self, state: AgentState, context: str, strict: bool)",
          "text": "검색 컨텍스트·대화 맥락으로 답변 본문을 만드는 도우미 정의."
        },
        {
          "at": "strict_rule = (",
          "text": "strict=True면 '컨텍스트에 있는 내용만 써라'는 엄격 규칙 문구를 끼워 넣음."
        },
        {
          "at": "def _grade_support(self, answer: str, context: str) -> SupportGrade:",
          "text": "답변이 컨텍스트에 근거하는지 검증하는 [IsSup] 도우미 정의."
        },
        {
          "at": "return (prompt | self.support_grader).invoke({\"context\": context, \"answer\": answer})",
          "text": "프롬프트와 근거성 평가기를 연결해 SupportGrade 결과를 돌려줌."
        }
      ],
      "code": "    # ===== 노드 4: Generate (답변 생성 + IsSup + 출처) =====\n    def generate(self, state: AgentState) -> dict:\n        \"\"\"생성 노드: 검색 컨텍스트로 답변을 생성하고, 근거성([IsSup])이 부족하면 엄격 재생성 후 출처를 부착함.\"\"\"\n        context = build_context(state)\n        has_context = bool(state[\"vector_docs\"] or state[\"web_results\"] or state[\"youtube_results\"])\n\n        print(\"\\n[Generate] 검색 결과 기반 답변 생성 중...\")\n        answer = self._generate_answer(state, context, strict=False)\n\n        is_supported: Optional[bool] = None\n        # 검색 컨텍스트가 있을 때만 근거성([IsSup])을 검증함 (없으면 LLM 지식 답변이라 평가 불가)\n        if has_context:\n            print(\"\\n[IsSup] 답변 근거성 평가 중...\")\n            support: SupportGrade = self._grade_support(answer, context)\n            is_supported = support.is_supported\n            print(f\"  → 근거 있음: {support.is_supported} ({support.reasoning})\")\n            if not support.is_supported:\n                print(\"\\n[Generate] 근거 부족 → 엄격 근거 기반으로 답변 재생성 중...\")\n                answer = self._generate_answer(state, context, strict=True)\n\n        # 출처 섹션을 코드에서 직접 구성해 URL 누락을 방지함 (MUST)\n        sources_section = build_sources_section(state)\n        full_answer = f\"{answer}\\n\\n{sources_section}\".strip() if sources_section else answer\n        return {\"answer\": full_answer, \"is_supported\": is_supported}\n\n    def _generate_answer(self, state: AgentState, context: str, strict: bool) -> str:\n        \"\"\"검색 컨텍스트와 대화 맥락을 근거로 답변 본문을 생성함 (strict=True면 컨텍스트만 사용).\"\"\"\n        strict_rule = (\n            \"\\n## 중요: 엄격한 근거 기반 답변\\n- 반드시 아래 컨텍스트에 있는 정보만 사용하세요.\\n\"\n            \"- 컨텍스트에 없는 내용은 추가하지 말고 '확인되지 않음'이라고 명시하세요.\"\n            if strict else \"\"\n        )\n        prompt = ChatPromptTemplate.from_messages([\n            (\"system\", \"\"\"당신은 특허/지식재산권 전문 상담 AI입니다.\n\n## 역할\n- 아래 검색 컨텍스트(특허법 조문·웹·YouTube)와 이전 대화 맥락을 종합해 질문에 답변합니다.\n- 법률 용어는 일반인이 이해하기 쉽게 풀어서 설명합니다.\n\n## 규칙\n1. 컨텍스트의 정보를 우선 활용하되, 핵심을 요약해 명확히 전달\n2. 영상을 검색한 경우 어떤 영상이 도움이 되는지 간단히 안내\n3. '출처' 섹션은 시스템이 자동으로 덧붙이므로 답변 본문에 직접 작성하지 마세요{strict_rule}\n\n## 이전 대화 맥락\n{history}\n\n## 검색 컨텍스트\n{context}\"\"\"),\n            (\"human\", \"{question}\"),\n        ])\n        return (prompt | self.llm | StrOutputParser()).invoke({\n            \"history\": format_history(state.get(\"history\", [])),\n            \"context\": context,\n            \"question\": state[\"original_question\"],\n            \"strict_rule\": strict_rule,\n        })\n\n    def _grade_support(self, answer: str, context: str) -> SupportGrade:\n        \"\"\"[IsSup]: 생성된 답변이 검색 컨텍스트에 근거하는지(환각이 없는지) 검증함.\"\"\"\n        prompt = ChatPromptTemplate.from_messages([\n            (\"system\", \"\"\"당신은 생성된 답변이 제공된 컨텍스트에 근거하는지 평가하는 전문가입니다.\n\n답변의 주요 주장과 정보가 컨텍스트에서 직접 확인 가능해야 근거 있음(True)입니다.\n컨텍스트에 없는 정보를 추가하거나 왜곡했으면 근거 없음(False)으로 판단합니다.\n판단 이유(reasoning)는 한국어로 작성하세요.\"\"\"),\n            (\"human\", \"컨텍스트:\\n{context}\\n\\n생성된 답변:\\n{answer}\\n\\n이 답변이 컨텍스트에 근거하고 있나요?\"),\n        ])\n        return (prompt | self.support_grader).invoke({\"context\": context, \"answer\": answer})"
    },
    {
      "id": "grade_generation",
      "name": "grade_generation 노드 — [IsUse]",
      "fileId": "main",
      "summary": "최종 답변이 사용자 질문에 유용한지 평가하는 노드(재검색 루프 분기의 기준).",
      "how": "질문에 직접·명확히 답하고 실질적 도움이 되면 유용함(True), 회피·모호·일반적이면 유용하지 않음(False)으로 판정함. 평가 기준은 최초 질문(original_question)임. 결과(is_useful)와 이유(usefulness_reasoning)를 상태로 돌려주면, 이어지는 decide_after_generation 엣지가 종료/재작성을 가름.",
      "terms": [
        "노드(Node)",
        "답변 유용성 평가",
        "조건부 엣지",
        "ChatPromptTemplate",
        "파이프(|)",
        "invoke"
      ],
      "lines": [
        {
          "at": "# ===== 노드 5: Grade Generation",
          "text": "답변 유용성을 평가하는 다섯 번째 노드임을 표시하는 구분 헤더."
        },
        {
          "at": "def grade_generation(self, state: AgentState) -> dict:",
          "text": "유용성 평가 노드 메서드 정의."
        },
        {
          "at": "당신은 생성된 답변이 사용자 질문에 유용한지 평가하는 전문가입니다",
          "text": "답변이 질문에 유용한지 판정하라는 시스템 프롬프트."
        },
        {
          "at": "[유용함 = True] 질문에 직접 답하고",
          "text": "질문에 직접 답하고 명확·도움이 되면 유용함으로 보라는 기준."
        },
        {
          "at": "grade: UsefulnessGrade = (prompt | self.usefulness_grader).invoke({",
          "text": "프롬프트와 유용성 평가기를 연결해 UsefulnessGrade 결과를 받음."
        },
        {
          "at": "return {\"is_useful\": grade.is_useful, \"usefulness_reasoning\": grade.reasoning}",
          "text": "유용성 결과와 이유를 상태로 돌려줘 다음 분기의 기준으로 씀."
        }
      ],
      "code": "    # ===== 노드 5: Grade Generation (IsUse) =====\n    def grade_generation(self, state: AgentState) -> dict:\n        \"\"\"[IsUse] 노드: 최종 답변이 사용자 질문에 유용한지 평가함 (재검색 루프의 분기 기준).\"\"\"\n        print(\"\\n[IsUse] 답변 유용성 평가 중...\")\n        prompt = ChatPromptTemplate.from_messages([\n            (\"system\", \"\"\"당신은 생성된 답변이 사용자 질문에 유용한지 평가하는 전문가입니다.\n\n[유용함 = True] 질문에 직접 답하고, 내용이 명확하며 실질적으로 도움이 됨\n[유용하지 않음 = False] 질문을 회피·모호하게 답하거나, 관련 없는 정보만 나열하거나, 너무 일반적임\n\n판단 이유(reasoning)는 한국어로 작성하세요.\"\"\"),\n            (\"human\", \"질문: {question}\\n\\n답변:\\n{answer}\\n\\n이 답변이 질문에 유용하게 답하고 있나요?\"),\n        ])\n        grade: UsefulnessGrade = (prompt | self.usefulness_grader).invoke({\n            \"question\": state[\"original_question\"],\n            \"answer\": state[\"answer\"],\n        })\n        print(f\"  → 유용함: {grade.is_useful} ({grade.reasoning})\")\n        return {\"is_useful\": grade.is_useful, \"usefulness_reasoning\": grade.reasoning}"
    },
    {
      "id": "rewrite",
      "name": "rewrite 노드 — Query Rewriting",
      "fileId": "main",
      "summary": "유용성 미달 시 더 나은 검색을 위해 질문을 다시 쓰고 재시도 횟수를 늘리는 노드.",
      "how": "유용한 답을 못 만든 원인(usefulness_reasoning)을 받아, 모호한 표현을 구체적 특허 용어로·구어체를 전문 용어로 바꾸고 핵심 키워드를 명확히 포함하도록 질문을 고침. 고친 질문(rewritten_query)을 다음 route 부터 쓰도록 question 키를 갱신하고, retry_count 를 1 늘리며, 재작성 이력(rewrites)을 누적함. 이 노드는 횟수만 늘리고 종료 판단은 하지 않음(그 판단은 조건부 엣지가 함).",
      "terms": [
        "노드(Node)",
        "질문 재작성",
        "재시도 루프",
        "ChatPromptTemplate",
        "파이프(|)",
        "invoke"
      ],
      "lines": [
        {
          "at": "# ===== 노드 6: Rewrite",
          "text": "유용성 미달 시 질문을 재작성하는 여섯 번째 노드임을 표시하는 구분 헤더."
        },
        {
          "at": "def rewrite(self, state: AgentState) -> dict:",
          "text": "질문 재작성 노드 메서드 정의."
        },
        {
          "at": "당신은 검색 쿼리를 최적화하는 전문가입니다",
          "text": "검색이 잘 되도록 질문을 다시 쓰라는 시스템 프롬프트."
        },
        {
          "at": "1. 모호한 표현을 구체적인 특허 용어로 변환",
          "text": "막연한 말을 구체적 특허 용어로 바꾸라는 재작성 전략."
        },
        {
          "at": "rewritten: RewrittenQuery = (prompt | self.query_rewriter).invoke({",
          "text": "프롬프트와 재작성기를 연결해 고쳐 쓴 질문을 받음."
        },
        {
          "at": "\"question\": rewritten.rewritten_query,           # 다음 route부터",
          "text": "다음 route 부터 이 재작성 질문으로 재검색하도록 question을 갱신."
        },
        {
          "at": "\"retry_count\": state[\"retry_count\"] + 1,",
          "text": "재시도 횟수를 1 늘려 루프 한도 판단의 근거로 씀."
        }
      ],
      "code": "    # ===== 노드 6: Rewrite (Query Rewriting) =====\n    def rewrite(self, state: AgentState) -> dict:\n        \"\"\"Query Rewriting 노드: 유용성 미달 시 더 나은 검색을 위해 질문을 재작성하고 재시도 횟수를 늘림.\"\"\"\n        print(\"\\n[Query Rewriting] 유용성 미달 → 질문 재작성 중...\")\n        prompt = ChatPromptTemplate.from_messages([\n            (\"system\", \"\"\"당신은 검색 쿼리를 최적화하는 전문가입니다.\n\n원래 질문으로 시도했으나 유용한 답변을 생성하지 못했습니다. 더 나은 검색을 위해 질문을 다시 작성하세요.\n\n## 재작성 전략\n1. 모호한 표현을 구체적인 특허 용어로 변환\n2. 구어체를 문어체/전문 용어로 변환\n3. 특허/지식재산권 관련 정확한 핵심 키워드를 명확히 포함\n\n재작성 이유(reasoning)는 한국어로 작성하세요.\"\"\"),\n            (\"human\", \"\"\"원래 질문: {original_question}\n\n이전 답변(유용하지 않음): {failed_answer}\n\n유용하지 않은 이유: {failure_reason}\n\n더 나은 검색 결과를 위해 질문을 다시 작성해 주세요.\"\"\"),\n        ])\n        rewritten: RewrittenQuery = (prompt | self.query_rewriter).invoke({\n            \"original_question\": state[\"original_question\"],\n            \"failed_answer\": state[\"answer\"],\n            \"failure_reason\": state.get(\"usefulness_reasoning\", \"\"),\n        })\n        print(f\"  → 재작성 질문: {rewritten.rewritten_query}\")\n        return {\n            \"question\": rewritten.rewritten_query,           # 다음 route부터 이 질문으로 재검색\n            \"retry_count\": state[\"retry_count\"] + 1,\n            \"rewrites\": state[\"rewrites\"] + [{\n                \"from\": state[\"question\"],\n                \"to\": rewritten.rewritten_query,\n                \"reasoning\": rewritten.reasoning,\n            }],\n        }"
    },
    {
      "id": "direct_answer",
      "name": "direct_answer 노드 — 검색 불필요",
      "fileId": "main",
      "summary": "특허 외 질문·인사 등을 검색 없이 LLM 지식과 대화 맥락으로 바로 답하는 노드.",
      "how": "route 에서 검색 불필요로 판단되면 이 노드로 흐름. 시스템 프롬프트로 '특허 챗봇이지만 이번엔 검색이 필요 없으니 대화 맥락을 고려해 친절·정확히 답하라'고 지시함. 특허 무관 주제는 일반 지식으로 간단히 답하되 필요하면 특허 질문을 안내함. prompt | self.llm | StrOutputParser 로 답변 문자열을 얻어 상태로 돌려줌.",
      "terms": [
        "노드(Node)",
        "ChatPromptTemplate",
        "파이프(|)",
        "StrOutputParser",
        "멀티턴"
      ],
      "lines": [
        {
          "at": "# ===== 노드 7: Direct Answer",
          "text": "검색 없이 직접 답하는 일곱 번째 노드임을 표시하는 구분 헤더."
        },
        {
          "at": "def direct_answer(self, state: AgentState) -> dict:",
          "text": "검색 불필요 시 직접 답하는 노드 메서드 정의."
        },
        {
          "at": "print(\"\\n[Direct] 검색 불필요 → LLM 지식으로 직접 답변 중...\")",
          "text": "검색 없이 직접 답한다는 진행 로그를 출력함."
        },
        {
          "at": "이번 질문은 검색이 필요 없는 질문입니다",
          "text": "검색 없이 대화 맥락만으로 친절·정확히 답하라는 시스템 프롬프트."
        },
        {
          "at": "answer = (prompt | self.llm | StrOutputParser()).invoke({",
          "text": "프롬프트·LLM·파서를 연결해 직접 답변 문자열을 만듦."
        },
        {
          "at": "return {\"answer\": answer}",
          "text": "생성한 답변을 상태로 돌려주고 곧장 종료(END)로 향함."
        }
      ],
      "code": "    # ===== 노드 7: Direct Answer (검색 불필요) =====\n    def direct_answer(self, state: AgentState) -> dict:\n        \"\"\"직접 답변 노드: 특허 외 질문·인사 등은 검색 없이 LLM 지식과 대화 맥락으로 답변함.\"\"\"\n        print(\"\\n[Direct] 검색 불필요 → LLM 지식으로 직접 답변 중...\")\n        prompt = ChatPromptTemplate.from_messages([\n            (\"system\", \"\"\"당신은 특허/지식재산권 전문 챗봇입니다. 다만 이번 질문은 검색이 필요 없는 질문입니다.\n\n이전 대화 맥락을 고려해 친절하고 정확하게 답변하세요.\n특허/지식재산권과 무관한 주제라면 일반 지식으로 간단히 답하되, 필요하면 특허 관련 질문을 안내해도 좋습니다.\n\n## 이전 대화 맥락\n{history}\"\"\"),\n            (\"human\", \"{question}\"),\n        ])\n        answer = (prompt | self.llm | StrOutputParser()).invoke({\n            \"history\": format_history(state.get(\"history\", [])),\n            \"question\": state[\"question\"],\n        })\n        return {\"answer\": answer}"
    },
    {
      "id": "edges",
      "name": "조건부 엣지 (decide_search_path / decide_after_generation)",
      "fileId": "main",
      "summary": "그래프의 두 갈림길을 결정하는 함수: route 후 검색/직접 분기, 생성 후 재작성/종료 분기.",
      "how": "조건부 엣지(conditional edge)는 노드 실행 후 상태를 보고 다음에 어느 노드로 갈지 고르는 분기 판단 함수임. decide_search_path 는 route 직후 호출되어 검색이 필요하고 소스가 있으면 'retrieve', 아니면 'direct'를 돌려줌. decide_after_generation 은 grade_generation 직후 호출되어 유용하면 'end', 유용 미달이고 재시도가 남았으면 'rewrite'를 돌려줌 — 재시도 한도(retry_count) 가드를 여기서 직접 검사해 그래프가 무한 루프(GraphRecursionError)에 빠지지 않게 함.",
      "terms": [
        "조건부 엣지",
        "엣지(Edge)",
        "노드(Node)",
        "재시도 루프",
        "recursion_limit"
      ],
      "lines": [
        {
          "at": "# ===== 조건부 엣지",
          "text": "분기 판단 함수 묶음임을 표시하는 구분 헤더."
        },
        {
          "at": "def decide_search_path(self, state: AgentState) -> Literal[\"retrieve\", \"direct\"]:",
          "text": "route 직후 검색/직접 경로를 고르는 분기 함수 정의."
        },
        {
          "at": "if state[\"needs_retrieval\"] and state[\"sources\"]:",
          "text": "검색이 필요하고 선택된 소스가 있으면 retrieve로 보냄."
        },
        {
          "at": "return \"direct\"",
          "text": "그 외에는 direct_answer 경로로 보냄."
        },
        {
          "at": "def decide_after_generation(self, state: AgentState) -> Literal[\"rewrite\", \"end\"]:",
          "text": "생성·유용성 평가 후 재작성/종료를 고르는 분기 함수 정의."
        },
        {
          "at": "if state[\"is_useful\"]:",
          "text": "답이 유용하면 곧장 종료(end) 경로를 돌려줌."
        },
        {
          "at": "if state[\"retry_count\"] >= MAX_RETRIES:",
          "text": "재시도 한도에 도달하면 마지막 답을 그대로 두고 종료함(무한 루프 방지)."
        },
        {
          "at": "return \"rewrite\"",
          "text": "유용 미달이고 재시도가 남았으면 질문 재작성 경로로 보냄."
        }
      ],
      "code": "    # ===== 조건부 엣지 (분기 판단 함수) =====\n    def decide_search_path(self, state: AgentState) -> Literal[\"retrieve\", \"direct\"]:\n        \"\"\"route 직후 분기: 검색이 필요하고 선택된 소스가 있으면 retrieve, 아니면 direct_answer로 보냄.\"\"\"\n        if state[\"needs_retrieval\"] and state[\"sources\"]:\n            return \"retrieve\"\n        return \"direct\"\n\n    def decide_after_generation(self, state: AgentState) -> Literal[\"rewrite\", \"end\"]:\n        \"\"\"grade_generation 직후 분기: 유용하면 종료, 유용 미달이고 재시도가 남았으면 rewrite로 보냄.\n\n        재시도 횟수(retry_count) 가드를 이 엣지에서 직접 검사해 그래프가 무한 루프(GraphRecursionError)에\n        빠지지 않도록 함 (rewrite 노드는 횟수만 증가시키고 종료 판단은 하지 않음).\n        \"\"\"\n        if state[\"is_useful\"]:\n            return \"end\"\n        if state[\"retry_count\"] >= MAX_RETRIES:\n            print(f\"\\n[경고] 최대 재시도({MAX_RETRIES}회) 도달 → 마지막 답변을 그대로 반환함.\")\n            return \"end\"\n        return \"rewrite\""
    },
    {
      "id": "build_graph",
      "name": "_build_graph() — 그래프 조립",
      "fileId": "main",
      "summary": "7개 노드와 그 사이를 잇는 엣지(고정·조건부)를 연결해 실행 가능한 StateGraph로 컴파일하는 부분.",
      "how": "LangGraph의 핵심 조립 단계임. StateGraph(AgentState) 로 상태 서식 기반 그래프를 만들고, add_node 로 7개 노드(이름→실행 함수)를 등록함. 이어 엣지를 연결함: START→route, route 뒤에는 add_conditional_edges 로 decide_search_path 결과에 따라 retrieve/direct_answer 로 갈라짐. retrieve→grade_documents→generate→grade_generation 은 고정 엣지로 잇고, grade_generation 뒤에는 다시 조건부 엣지로 rewrite/END 로 갈라짐. rewrite→route(재검색 루프), direct_answer→END 로 닫음. 마지막 compile() 로 실행 가능한 앱이 됨.",
      "terms": [
        "StateGraph",
        "노드(Node)",
        "엣지(Edge)",
        "조건부 엣지",
        "START",
        "END",
        "AgentState"
      ],
      "lines": [
        {
          "at": "def _build_graph(self):",
          "text": "노드·엣지를 연결해 그래프를 컴파일하는 메서드 정의."
        },
        {
          "at": "workflow = StateGraph(AgentState)",
          "text": "상태 서식(AgentState) 기반의 빈 그래프를 만듦."
        },
        {
          "at": "workflow.add_node(\"route\", self.route)",
          "text": "이름 'route'에 route 함수를 묶어 노드로 등록함(이런 식으로 7개 등록)."
        },
        {
          "at": "workflow.add_edge(START, \"route\")",
          "text": "그래프 시작점(START)에서 route로 가는 첫 엣지를 연결함."
        },
        {
          "at": "self.decide_search_path,",
          "text": "route 뒤에 검색/직접 분기를 조건부 엣지로 연결함."
        },
        {
          "at": "workflow.add_edge(\"generate\", \"grade_generation\")",
          "text": "답변 생성 다음에 유용성 평가로 가는 고정 엣지를 연결함."
        },
        {
          "at": "self.decide_after_generation,",
          "text": "유용성 평가 뒤에 재작성/종료 분기를 조건부 엣지로 연결함."
        },
        {
          "at": "workflow.add_edge(\"rewrite\", \"route\")",
          "text": "재작성 후 route로 되돌아가는 재검색 루프 엣지를 연결함."
        },
        {
          "at": "return workflow.compile()",
          "text": "연결한 그래프를 실행 가능한 앱으로 컴파일해 돌려줌."
        }
      ],
      "code": "    # ===== 그래프 구성 =====\n    def _build_graph(self):\n        \"\"\"노드와 엣지를 연결해 실행 가능한 StateGraph로 컴파일함.\"\"\"\n        workflow = StateGraph(AgentState)        # 상태 스키마(AgentState) 기반 그래프 생성\n        # 노드 등록 (이름 → 실행 함수)\n        workflow.add_node(\"route\", self.route)\n        workflow.add_node(\"retrieve\", self.retrieve)\n        workflow.add_node(\"grade_documents\", self.grade_documents)\n        workflow.add_node(\"generate\", self.generate)\n        workflow.add_node(\"grade_generation\", self.grade_generation)\n        workflow.add_node(\"rewrite\", self.rewrite)\n        workflow.add_node(\"direct_answer\", self.direct_answer)\n\n        # 엣지 연결\n        workflow.add_edge(START, \"route\")        # 시작 → route\n        workflow.add_conditional_edges(          # route 후 검색 필요 여부로 분기\n            \"route\",\n            self.decide_search_path,\n            {\"retrieve\": \"retrieve\", \"direct\": \"direct_answer\"},\n        )\n        workflow.add_edge(\"retrieve\", \"grade_documents\")     # 검색 → 관련성 평가\n        workflow.add_edge(\"grade_documents\", \"generate\")     # 관련성 평가 → 답변 생성\n        workflow.add_edge(\"generate\", \"grade_generation\")    # 답변 생성 → 유용성 평가\n        workflow.add_conditional_edges(          # 유용성 평가 후 재검색/종료 분기\n            \"grade_generation\",\n            self.decide_after_generation,\n            {\"rewrite\": \"rewrite\", \"end\": END},\n        )\n        workflow.add_edge(\"rewrite\", \"route\")    # 재작성 → route로 돌아가 재검색 (루프)\n        workflow.add_edge(\"direct_answer\", END)  # 직접 답변 → 종료\n        return workflow.compile()                # 실행 가능한 앱으로 컴파일"
    },
    {
      "id": "invoke",
      "name": "invoke() — 그래프 실행",
      "fileId": "main",
      "summary": "질문 한 건의 초기 상태를 만들고 컴파일된 그래프를 실행해 최종 상태를 돌려주는 메서드.",
      "how": "AgentState 의 모든 키를 초기값으로 채운 딕셔너리를 만들어 self.graph.invoke 에 넣어 실행함. question·original_question 에 같은 질문을, history 에 멀티턴 기록을 넣고 나머지는 빈 값으로 시작함. config 의 recursion_limit 을 RECURSION_LIMIT(50)으로 올려, 재검색 루프가 그래프 기본 단계 한계(25)에 걸려 중단되지 않게 함. 그래프가 노드들을 돌고 난 최종 상태(answer 등 포함)를 돌려줌.",
      "terms": [
        "AgentState",
        "StateGraph",
        "invoke",
        "recursion_limit",
        "멀티턴"
      ],
      "lines": [
        {
          "at": "def invoke(self, question: str, history: list) -> dict:",
          "text": "질문 한 건에 대해 그래프를 실행하는 공개 진입 메서드 정의."
        },
        {
          "at": "initial_state: AgentState = {",
          "text": "AgentState의 모든 키를 초기값으로 채운 시작 상태를 만듦."
        },
        {
          "at": "\"original_question\": question,",
          "text": "최초 질문을 별도로 보존해 평가·재작성의 기준으로 둠."
        },
        {
          "at": "\"history\": history,",
          "text": "멀티턴 대화 기록을 초기 상태에 넣어 맥락을 제공함."
        },
        {
          "at": "return self.graph.invoke(initial_state, config={\"recursion_limit\": RECURSION_LIMIT})",
          "text": "단계 한계를 50으로 올려 그래프를 실행하고 최종 상태를 돌려줌."
        }
      ],
      "code": "    def invoke(self, question: str, history: list) -> dict:\n        \"\"\"질문 한 건에 대해 그래프를 실행하고 최종 상태를 반환함 (멀티턴 history 전달).\"\"\"\n        initial_state: AgentState = {\n            \"question\": question,\n            \"original_question\": question,\n            \"history\": history,\n            \"needs_retrieval\": False,\n            \"sources\": [],\n            \"web_query\": \"\",\n            \"youtube_query\": \"\",\n            \"route_reasoning\": \"\",\n            \"vector_docs_raw\": [],\n            \"vector_docs\": [],\n            \"web_results\": [],\n            \"youtube_results\": [],\n            \"answer\": \"\",\n            \"is_supported\": None,\n            \"is_useful\": None,\n            \"usefulness_reasoning\": \"\",\n            \"retry_count\": 0,\n            \"rewrites\": [],\n        }\n        # recursion_limit: 재시도 루프가 그래프 기본 단계 한계(25)에 걸리지 않도록 상향함\n        return self.graph.invoke(initial_state, config={\"recursion_limit\": RECURSION_LIMIT})"
    },
    {
      "id": "output_run",
      "name": "출력·실행 (format_summary / print_result / run_demo / chat / main)",
      "fileId": "main",
      "summary": "라우팅·검색·평가 결과를 요약·출력하고, 데모/대화형 모드로 Agentic RAG 그래프를 실행하는 진입부.",
      "how": "결과 표시와 실행 진입을 담당함. format_summary 는 라우팅([Route])·검색 건수·근거성([IsSup])·유용성([IsUse])·재작성 이력을 표로 요약하고, print_result 가 요약·최종 답변을 출력함. run_demo 는 검증 질의 3건(통합 검색·소스 라우팅·특허 외 직접 답변)을 멀티턴으로 자동 실행함. chat 은 대화형 루프를 돌며 'clear'로 맥락 초기화, 'quit'으로 종료함. main 은 벡터DB·LLM·AgenticRAG 를 준비한 뒤 --demo 인자 유무로 모드를 고르고, 맨 아래 if __name__ 관용구로 직접 실행 시에만 main 을 부름.",
      "terms": [
        "Reflection",
        "재시도 루프",
        "멀티턴",
        "AgentState",
        "if __name__ == \"__main__\""
      ],
      "lines": [
        {
          "at": "def format_summary(result: dict) -> str:",
          "text": "라우팅·검색·평가 결과를 한눈에 보이는 요약 문자열로 만드는 함수 정의."
        },
        {
          "at": "for step, rewrite in enumerate(result.get(\"rewrites\", []), 1):",
          "text": "질문 재작성 이력을 단계별로 표시함."
        },
        {
          "at": "lines.append(f\"[Route ] 검색 수행",
          "text": "검색을 수행했는지와 고른 소스를 요약 줄에 표시함."
        },
        {
          "at": "def print_result(result: dict) -> None:",
          "text": "요약과 최종 답변을 콘솔에 출력하는 함수 정의."
        },
        {
          "at": "def run_demo(agent: AgenticRAG) -> None:",
          "text": "검증 질의 3건을 멀티턴으로 자동 실행하는 함수 정의(--demo)."
        },
        {
          "at": "demo_questions = [",
          "text": "통합 검색·소스 라우팅·특허 외 주제 3종 검증 질의를 정의함."
        },
        {
          "at": "def chat(agent: AgenticRAG) -> None:",
          "text": "대화형 챗봇 루프를 실행하는 함수 정의."
        },
        {
          "at": "if question.lower() in (\"clear\", \"초기화\"):",
          "text": "'clear' 입력 시 멀티턴 대화 맥락을 모두 비움."
        },
        {
          "at": "def main() -> None:",
          "text": "벡터DB·LLM·그래프를 준비하고 모드에 따라 실행하는 진입점 정의."
        },
        {
          "at": "agent = AgenticRAG(llm, vectorstore)",
          "text": "LLM과 벡터 스토어로 Agentic RAG 그래프 엔진을 만듦."
        },
        {
          "at": "if \"--demo\" in sys.argv[1:]:",
          "text": "--demo 인자가 있으면 데모, 없으면 대화형으로 분기함."
        },
        {
          "at": "if __name__ == \"__main__\":",
          "text": "이 파일을 직접 실행할 때만 main()을 수행하는 관용구."
        }
      ],
      "code": "def format_summary(result: dict) -> str:\n    \"\"\"그래프 처리 결과(라우팅·검색·평가)를 한눈에 보이도록 요약 문자열로 만듦.\"\"\"\n    lines = [\"=\" * 60, \"Agentic RAG 처리 결과 요약\", \"=\" * 60]\n    if result.get(\"retry_count\", 0) > 0:\n        lines.append(f\"[Retry ] 재시도 횟수 : {result['retry_count']}\")\n        for step, rewrite in enumerate(result.get(\"rewrites\", []), 1):\n            lines.append(f\"[Rewrite {step}] {rewrite['from']} → {rewrite['to']}\")\n    lines.append(f\"[Route ] 검색 수행 : {result['needs_retrieval']} / 소스: {result['sources'] or '없음'}\")\n    if result[\"needs_retrieval\"]:\n        lines.append(f\"[검색  ] 벡터DB {len(result['vector_docs'])}개 / 웹 {len(result['web_results'])}개 / \"\n                     f\"YouTube {len(result['youtube_results'])}개\")\n    if result[\"is_supported\"] is not None:\n        lines.append(f\"[IsSup ] 근거 있음 : {result['is_supported']}\")\n    if result[\"is_useful\"] is not None:\n        lines.append(f\"[IsUse ] 유용함   : {result['is_useful']}\")\n    lines.append(\"=\" * 60)\n    return \"\\n\".join(lines)\n\n\ndef print_result(result: dict) -> None:\n    \"\"\"처리 요약과 최종 답변을 콘솔에 출력함.\"\"\"\n    print(\"\\n\" + format_summary(result))\n    print(\"\\n\" + \"-\" * 60)\n    print(\"답변:\")\n    print(\"-\" * 60)\n    print(result[\"answer\"])\n    print(\"-\" * 60)\n\n\ndef run_demo(agent: AgenticRAG) -> None:\n    \"\"\"교재 검증 질의를 비대화형으로 순차 실행함 (--demo). 멀티턴 맥락도 누적 검증함.\"\"\"\n    demo_questions = [\n        \"특허 요건에 대해 법률, 웹, 영상을 검색해서 알려줘\",  # 벡터DB + 웹 + YouTube 통합\n        \"특허 출원 비용은 ?\",                                  # 소스 라우팅 (웹 중심)\n        \"Claude Code란?\",                                      # 특허 외 주제 → 직접 답변\n    ]\n    history: list = []\n    for idx, question in enumerate(demo_questions, 1):\n        print(\"\\n\" + \"#\" * 60)\n        print(f\"# 데모 질의 {idx}/{len(demo_questions)}: {question}\")\n        print(\"#\" * 60)\n        result = agent.invoke(question, history)\n        print_result(result)\n        # 멀티턴 맥락 누적 (다음 질의가 이전 대화를 참고할 수 있게 함)\n        history.append({\"role\": \"user\", \"content\": question})\n        history.append({\"role\": \"assistant\", \"content\": result[\"answer\"]})\n\n\ndef chat(agent: AgenticRAG) -> None:\n    \"\"\"대화형 챗봇 루프를 실행함 (멀티턴 대화 + 'clear' 초기화).\"\"\"\n    print(\"\\n\" + \"=\" * 60)\n    print(\"특허/지식재산권 Agentic RAG 챗봇\")\n    print(\"=\" * 60)\n    print(\"특허 질문은 법률(벡터DB)·웹·YouTube를 스스로 골라 검색하고, 답변 품질을 자체 검증합니다.\")\n    print(\"멀티턴 대화를 기억합니다. 'clear' 입력 시 대화 초기화, 'quit'/'q' 입력 시 종료.\")\n    print(\"=\" * 60 + \"\\n\")\n\n    history: list = []  # 멀티턴 대화 기록 (사용자/어시스턴트 메시지 누적)\n    while True:\n        try:\n            question = input(\"질문: \").strip()\n            if not question:\n                continue\n            if question.lower() in (\"quit\", \"q\", \"exit\", \"종료\"):\n                print(\"\\n챗봇을 종료합니다. 감사합니다!\")\n                break\n            # clear: 이전 대화 맥락을 모두 비워 새 주제로 시작함\n            if question.lower() in (\"clear\", \"초기화\"):\n                history.clear()\n                print(\"\\n[대화 맥락을 초기화했습니다.]\\n\")\n                continue\n            result = agent.invoke(question, history)\n            print_result(result)\n            # 이번 질문·답변을 기록에 추가해 다음 턴이 맥락을 참고하게 함\n            history.append({\"role\": \"user\", \"content\": question})\n            history.append({\"role\": \"assistant\", \"content\": result[\"answer\"]})\n            print()\n        except KeyboardInterrupt:\n            print(\"\\n\\n챗봇을 종료합니다.\")\n            break\n        except Exception as error:\n            print(f\"\\n오류가 발생했습니다: {error}\\n\")\n\n\ndef main() -> None:\n    \"\"\"벡터 DB·LLM·Agentic RAG 그래프를 준비하고, 모드(데모/대화형)에 따라 실행함.\"\"\"\n    print(\"\\n\" + \"=\" * 60)\n    print(\"특허/지식재산권 Agentic RAG 예제 (LangGraph + Groq gpt-oss-120b)\")\n    print(\"=\" * 60)\n    try:\n        vectorstore = load_vectorstore()\n        print(f\"벡터 DB 로드 완료: {VECTORDB_DIR} (컬렉션 {COLLECTION_NAME}, \"\n              f\"{vectorstore._collection.count()}개 청크)\")\n        llm = build_llm()\n        agent = AgenticRAG(llm, vectorstore)\n\n        # 명령행 인자에 --demo가 있으면 비대화형 데모, 없으면 대화형 챗봇으로 동작함\n        if \"--demo\" in sys.argv[1:]:\n            run_demo(agent)\n        else:\n            chat(agent)\n    except (FileNotFoundError, RuntimeError) as error:\n        print(f\"\\n[오류] {error}\", file=sys.stderr)\n        sys.exit(1)\n\n\n# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)\nif __name__ == \"__main__\":\n    main()"
    }
  ],
  "glossary": {
    "Agentic RAG": "Agent가 스스로 (1)검색 필요 여부와 (2)검색 소스(벡터DB·웹·YouTube)를 고르고, 답변 품질을 자체 평가해 미흡하면 질문을 고쳐 재검색하는 RAG. 이 예제는 Self-RAG의 자기성찰 루프를 LangGraph 그래프로 표현하고 검색 소스를 여러 개로 확장한 형태임.",
    "Self-RAG": "Self-Reflective RAG. LLM이 '검색이 필요한가 / 문서가 관련 있나 / 답이 근거 있나 / 답이 유용한가'를 스스로 판단(Reflection)하며 검색·생성·재시도를 제어하는 RAG 방식. 이 예제(Agentic RAG)는 여기서 파생되어 멀티소스 검색과 LangGraph 그래프 표현을 더함.",
    "RAG": "Retrieval-Augmented Generation. 외부 문서에서 관련 내용을 먼저 찾아(검색) 그 근거로 LLM이 답하게 하는 방식. 모델이 모르는 전문·최신 정보도 문서만 있으면 답할 수 있게 함.",
    "Reflection": "LLM이 워크플로우 각 단계마다 스스로 내리는 판단(자기성찰). 이 예제의 [Route]·[IsRel]·[IsSup]·[IsUse]가 검색전략·관련성·근거성·유용성을 차례로 점검함.",
    "멀티소스 라우팅": "질문에 맞게 검색 소스(vectordb=법률 근거·web=최신/비용·youtube=영상)를 골라 쓰는 것. 라우터(route 노드)가 어떤 소스를 쓸지와 소스별 검색어까지 정함. 검색 소스가 특허법 벡터DB 하나뿐이던 Self-RAG와의 핵심 차이.",
    "RouteDecision": "라우터(route 노드)의 결정을 담는 Pydantic 양식. 검색 필요 여부(needs_retrieval)·소스 목록(sources)·웹/유튜브 검색어(web_query/youtube_query)·근거(reasoning)를 한꺼번에 담음.",
    "LangGraph": "워크플로우를 노드(작업)와 엣지(연결)로 이뤄진 '그래프'로 표현하는 LangChain 계열 라이브러리. 분기·반복(루프)이 있는 복잡한 Agent 흐름을 코드의 if/재귀 대신 눈에 보이는 그래프로 그릴 수 있음.",
    "StateGraph": "LangGraph의 핵심 클래스. 하나의 상태(State) 딕셔너리를 노드 사이로 흘려보내며 워크플로우를 구성함. add_node로 노드를, add_edge/add_conditional_edges로 연결을 등록하고 compile()로 실행 앱을 만듦.",
    "START": "LangGraph 그래프의 가상 시작 지점을 나타내는 특수 노드. 'START → route'처럼 첫 노드로 가는 엣지를 연결할 때 씀.",
    "END": "LangGraph 그래프의 가상 종료 지점을 나타내는 특수 노드. 이 노드로 가는 엣지를 만나면 그래프 실행이 끝남.",
    "노드(Node)": "그래프에서 하나의 작업 단위(함수). 이 예제의 route·retrieve·grade_documents·generate·grade_generation·rewrite·direct_answer가 각각 노드임. 상태를 받아 갱신할 일부 키만 돌려줌.",
    "엣지(Edge)": "노드와 노드를 잇는 연결선(흐름 방향). 항상 같은 곳으로 가는 고정 엣지(add_edge)와, 상태에 따라 다음 노드를 고르는 조건부 엣지(add_conditional_edges)가 있음.",
    "조건부 엣지": "노드 실행 후 상태를 보고 다음 노드를 고르는 분기. 이 예제는 decide_search_path(검색/직접)와 decide_after_generation(재작성/종료) 두 개를 add_conditional_edges로 등록함.",
    "AgentState": "LangGraph 그래프 전체에서 노드 사이로 공유·갱신되는 상태 데이터의 서식. TypedDict로 어떤 칸(질문·검색결과·평가결과 등)이 있는지 정의하고, 각 노드는 일부 키만 갱신해 반환함.",
    "TypedDict": "딕셔너리에 어떤 키가 어떤 타입으로 들어갈지 미리 적어 두는 파이썬 타입 도구. 여기서는 AgentState의 '서식'을 정의하는 데 사용.",
    "recursion_limit": "LangGraph 그래프가 한 번 실행에서 밟을 수 있는 최대 단계 수. 기본값(25)은 재검색 루프에 부족할 수 있어 이 예제는 50으로 올림(RECURSION_LIMIT).",
    "멀티턴": "여러 번 주고받는 대화. 이 예제는 직전 대화(history)를 프롬프트에 넣어 '그럼 비용은?' 같은 후속 질문의 의도를 이전 맥락으로 이해함.",
    "DuckDuckGo": "API 키 없이 쓸 수 있는 웹 검색 엔진. 이 예제는 최신 정보·비용·사례를 찾는 '웹' 소스로 사용함.",
    "DuckDuckGoSearchAPIWrapper": "DuckDuckGo 웹 검색을 파이썬에서 쓰게 해 주는 LangChain 유틸리티. .results()는 제목·요약·링크가 든 딕셔너리 리스트를 돌려줘 출처 URL 표기에 적합함.",
    "YouTube Data API v3": "유튜브 영상·채널 정보를 검색·조회하는 구글 공식 API. 이 예제는 최근 1년 한국어 영상을 검색하는 'youtube' 소스로 사용함(YOUTUBE_API_KEY 필요).",
    "build()": "google-api-python-client의 함수. build(\"youtube\", \"v3\", developerKey=...)처럼 호출해 YouTube Data API v3를 다루는 클라이언트 객체를 만듦.",
    "html.unescape": "&#39;·&amp; 같은 HTML 엔티티(특수문자 코드)를 사람이 읽는 글자('·& 등)로 되돌리는 파이썬 표준 함수. 영상 제목에 섞인 엔티티를 복원하는 데 사용.",
    "graceful degradation": "일부 기능이 실패해도 전체가 멈추지 않고 가능한 범위에서 계속 동작하는 것. 이 예제는 웹·유튜브 검색을 try/except로 감싸 한 소스가 실패해도 나머지로 답변을 만듦.",
    "Pydantic": "파이썬에서 데이터의 '형식(스키마)'을 클래스로 정의하고 검증하는 라이브러리. 여기서는 LLM이 정해진 칸을 채워 답하도록 양식을 정하는 데 사용.",
    "with_structured_output": "LLM 응답을 자유 문장이 아니라 지정한 Pydantic 스키마(JSON)로 강제해 안정적으로 파싱하게 하는 LangChain 기능. 이 예제는 라우터+4개 평가기를 이 방식으로 만듦.",
    "json_schema": "with_structured_output의 출력 방식 중 하나. 도구 이름 없이 JSON 스키마만으로 출력을 강제함. gpt-oss-120b는 기본 도구호출 모드에서 도구 이름을 잘못 만들어 실패할 수 있어 이 방식을 씀.",
    "문서 관련성 평가": "[IsRel] 단계. 검색해 온 벡터DB 문서들이 질문에 실제로 도움이 되는지 채점해 관련 있는 것만 추리는 것. 이 예제는 여러 문서를 1회 LLM 호출로 일괄 평가함.",
    "환각 점검": "[IsSup] 단계. 생성된 답변이 검색 컨텍스트에 근거하는지, 지어낸(환각) 내용은 없는지 검증하는 것. 근거가 부족하면 컨텍스트만 쓰도록 엄격히 제약해 다시 생성함.",
    "답변 유용성 평가": "[IsUse] 단계. 최종 답이 질문에 직접·명확히 답하며 실질적으로 도움이 되는지 평가하는 것. 미흡하면 질문을 고쳐 재검색함.",
    "질문 재작성": "Query Rewriting. [IsUse]에서 답이 유용하지 않다고 판정되면, 더 나은 검색을 위해 질문을 구체적·전문적 용어로 다시 쓰는 것(rewrite 노드).",
    "재시도 루프": "[IsUse] 실패 시 질문을 재작성해 route부터 전체 과정을 처음부터 다시 실행하는 자기교정 반복. 이 예제는 최대 MAX_RETRIES(3)회 반복함.",
    "임베딩": "텍스트를 의미가 담긴 숫자 벡터(여러 숫자의 나열)로 바꾼 것. 뜻이 비슷한 글은 벡터도 가깝게 위치해, 컴퓨터가 '비슷한 내용'을 계산으로 찾을 수 있음.",
    "벡터 DB": "임베딩(숫자 벡터)을 저장하고, 질문 벡터와 가장 가까운 것들을 빠르게 찾아 주는 데이터베이스. 여기서는 ChromaDB를 사용함.",
    "ChromaDB": "오픈소스 벡터 데이터베이스. 임베딩을 저장하고 유사도 검색을 해 줌. 로컬 폴더에 영속화(저장)되어 재실행 시 그대로 재사용 가능.",
    "Chroma": "ChromaDB를 LangChain에서 다루는 래퍼 클래스. 여기서는 from_documents(신규 생성)가 아니라 생성자로 기존 컬렉션을 '연결'만 함.",
    "컬렉션": "벡터 DB 안에서 벡터들을 묶어 두는 단위(여기서는 patent_law). 인덱싱과 검색이 같은 컬렉션 이름을 써야 검색이 됨.",
    "영속화": "persist. 메모리에만 두지 않고 디스크 폴더에 저장해, 프로그램을 껐다 켜도 데이터가 남아 재사용되게 하는 것.",
    "청크": "chunk. 긴 문서를 검색하기 좋게 잘게 나눈 한 조각. 이 예제는 이미 나뉘어 저장된 청크를 검색해서 사용함.",
    "Document": "LangChain에서 한 청크를 담는 객체. 본문 텍스트(page_content)와 출처 등 부가정보(metadata)를 함께 가짐.",
    "metadata": "청크에 딸린 부가정보(예: 출처 파일명 source, 청크 번호 chunk_index). 답변의 출처를 표시하는 데 사용함.",
    "OpenAIEmbeddings": "OpenAI 임베딩 모델 호출 래퍼. 텍스트를 숫자 벡터로 변환함. 여기서는 질의(질문)를 벡터로 바꾸는 데 사용.",
    "text-embedding-3-small": "OpenAI의 임베딩 모델 이름(1536차원). 인덱싱 때 쓴 모델과 검색 때 쓰는 모델이 같아야 의미 공간이 맞아 검색이 됨.",
    "retriever": "검색기. 벡터 DB에서 질문과 가장 비슷한 청크 몇 개(top-k)를 찾아 돌려주는 역할.",
    "as_retriever": "벡터 저장소(vectorstore)를 LCEL 체인에 꽂을 수 있는 검색기(retriever) 객체로 바꿔 주는 메서드.",
    "TOP_K": "검색에서 가져올 상위 청크 개수를 정한 상수. 이 예제에서는 5.",
    "유사도 검색": "similarity search. 질문 벡터와 문서 벡터의 '가까운 정도'를 계산해 가장 가까운 것부터 찾는 검색 방식.",
    "MAX_RETRIES": "[IsUse] 실패 시 질문을 고쳐 재검색하는 최대 횟수를 정한 상수. 이 예제에서는 3.",
    "ChatGroq": "Groq 클라우드의 채팅 LLM을 호출하는 LangChain 래퍼. GROQ_API_KEY를 자동/명시 참조함.",
    "Groq LPU": "Groq사가 만든 LLM 추론 전용 칩(Language Processing Unit). 매우 빠른 응답 속도가 특징.",
    "gpt-oss-120b": "Groq LPU에서 서빙하는 오픈 가중치 LLM(약 1200억 파라미터). 이 예제의 답변 생성·라우팅·자체 검증 모델.",
    "temperature": "LLM 답변의 무작위성 정도. 0에 가까울수록 매번 비슷하고 일관된(보수적인) 답을 냄. 이 예제는 0으로 고정해 판단을 재현 가능하게 함.",
    "ChatPromptTemplate": "LLM에 보낼 프롬프트(지시문)의 틀. {context}·{question} 같은 빈칸에 실제 값을 채워 완성된 프롬프트를 만듦.",
    "프롬프트": "LLM에게 주는 지시문. 이 예제는 노드마다 '검색 전략을 정하라', '근거 있는지 평가하라' 같은 서로 다른 시스템 프롬프트를 씀.",
    "LCEL": "LangChain Expression Language. 파이프 기호(|)로 단계들을 왼쪽→오른쪽으로 연결해 하나의 처리 흐름(체인)을 만드는 문법.",
    "파이프(|)": "LCEL에서 앞 단계의 결과를 다음 단계의 입력으로 흘려보내는 연결 기호. 'prompt | router'나 'prompt | llm | parser'처럼 씀.",
    "StrOutputParser": "LLM 응답 객체에서 사람이 읽을 본문 문자열만 깔끔히 뽑아 주는 출력 파서.",
    "invoke": "LangChain 체인/검색기/평가기나 LangGraph 그래프를 '실행'하는 메서드. 입력을 넣으면 끝까지 돌려 결과를 돌려줌.",
    "load_dotenv": ".env 파일에 적어 둔 비밀값(예: GROQ_API_KEY, OPENAI_API_KEY, YOUTUBE_API_KEY)을 프로그램의 환경변수로 불러오는 함수.",
    "from __future__ import annotations": "타입 힌트를 즉시 평가하지 않고 문자열로 두게 하는 파이썬 선언. 순환 참조 없이 가볍게 타입 힌트를 쓰게 해 줌.",
    "Path(__file__).resolve().parent": "지금 이 파이썬 파일이 있는 폴더의 절대경로를 구하는 관용구. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "if __name__ == \"__main__\"": "이 파일을 직접 실행할 때만 특정 코드를 돌리고, 다른 곳에서 import할 때는 돌리지 않게 하는 파이썬 관용구.",
    "API 키 검사": "필요한 API 키가 환경변수에 없으면 실행 초기에 명확한 오류를 내는 패턴. 한참 뒤에 엉뚱한 곳에서 실패하는 것을 막아 디버깅을 쉽게 함."
  }
};
