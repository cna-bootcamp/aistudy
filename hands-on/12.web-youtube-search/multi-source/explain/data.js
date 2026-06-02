window.EXPLAIN_DATA = {
  "meta": {
    "title": "멀티소스 RAG — 질문 라우팅으로 벡터DB·웹·YouTube를 골라 종합",
    "entry": "app.py"
  },
  "files": [
    {
      "id": "main",
      "label": "app.py",
      "role": "질문을 분석해 LLM이 검색할 소스를 스스로 고르고(Query Router), 소스별 검색어를 다시 쓴 뒤(Query Rewriting) 선택된 소스(벡터DB·웹·YouTube)만 검색해 하나의 답으로 종합(Synthesis)하는 멀티소스 RAG 전체"
    }
  ],
  "flow": [
    {
      "step": 1,
      "title": "실행 & 환경 준비",
      "summary": "python app.py 로 실행하고, .env 의 API 키를 불러옴",
      "detail": "터미널에서 'python app.py'(기본 질의) 또는 'python app.py \"질문\"'(직접 질문)으로 시작함. 시작과 동시에 load_dotenv() 가 hands-on/.env 의 OPENAI_API_KEY(벡터DB 질의 임베딩용)·GROQ_API_KEY(LLM용)·YOUTUBE_API_KEY(YouTube 검색용)를 읽어 둠. 한글이 깨지지 않게 표준출력을 UTF-8로 맞추는 처리도 함. 비유하면, 안내 데스크 직원(앱)이 출근해 세 개의 출입증(임베딩·LLM·유튜브 열쇠)을 미리 챙겨 두는 단계."
    },
    {
      "step": 2,
      "title": "[1단계] Query Router: 소스 선택 + 소스별 검색어 생성",
      "summary": "질문을 보고 어떤 소스를 검색할지 LLM이 스스로 고르고, 소스마다 맞는 검색어를 함께 만듦",
      "detail": "멀티소스 RAG의 핵심임. route_query 가 LLM을 with_structured_output 으로 감싸 RouteDecision 양식(JSON)으로 답하게 함. 한 번의 호출로 ① 검색할 소스 목록(법률→vectorstore, 최신정보→web, 강의→youtube, 복수 선택 가능)과 ② 소스별로 최적화한 검색어(웹은 연도 빼고, 유튜브는 쉼표 없는 짧은 키워드)를 동시에 얻음. 비유하면, 손님 질문을 듣고 '이건 법전 서가, 이건 최신 신문, 이건 강의 영상관에 물어봐야겠다'고 분류하면서 각 창구에 맞는 질문지까지 같이 써 주는 안내원."
    },
    {
      "step": 3,
      "title": "[2단계] 멀티소스 검색 (선택된 소스만)",
      "summary": "라우팅이 고른 소스만, 그 소스용으로 재작성된 검색어로 각각 검색함",
      "detail": "dispatch_searches 가 선택된 소스를 하나씩 돌며 SOURCE_REGISTRY 에서 해당 검색 함수와 검색어 속성을 찾아 실행함. 벡터DB는 특허법 청크를, 웹은 DuckDuckGo로 최근 1년 문서를, YouTube는 Data API v3로 최근 1년 영상을 가져옴. 웹·유튜브는 실패해도 빈 결과로 넘어가(graceful degradation) 전체가 멈추지 않음. 비유하면, 분류한 창구마다 각자의 질문지를 들고 가서 답을 받아 오되, 한 창구가 닫혀 있어도 나머지 창구의 답은 그대로 모으는 것."
    },
    {
      "step": 4,
      "title": "검색 결과 → 컨텍스트로 합치기",
      "summary": "소스별 검색 결과를 출처와 함께 하나의 글 덩어리로 묶음",
      "detail": "format_context 가 각 소스를 헤더로 구분하고, 항목마다 제목·본문·링크(출처)를 붙여 LLM이 인용하기 쉬운 단일 컨텍스트 문자열을 만듦. 소스가 서로 달라도 title/snippet/link 공통 형식으로 정규화해 두었기 때문에 일관되게 다룰 수 있음. 비유하면, 여러 창구에서 받아 온 답안지를 '법률 / 최신정보 / 강의'로 칸을 나눠 한 장의 종합 보고용지에 정리하는 것."
    },
    {
      "step": 5,
      "title": "[3단계] Synthesis: 종합 답변 생성",
      "summary": "모은 컨텍스트만 근거로, 소스를 구분하면서도 하나의 답으로 통합함",
      "detail": "synthesize_answer 가 reasoning_format=\"hidden\" 으로 사고 과정을 숨긴 Groq LLM에 (prompt | llm | StrOutputParser) 체인으로 컨텍스트·질문을 넣어 답을 만듦. '검색 결과에 있는 내용만 근거로, 특허법은 조문·웹/유튜브는 URL을 함께 제시'하라고 제약해 환각을 줄임. 검색 결과가 전부 비면 LLM을 부르지 않고 안내 문구를 돌려줌. 비유하면, 종합 보고용지만 보고 보고서를 쓰되 출처를 또박또박 달아 주는 작성자."
    },
    {
      "step": 6,
      "title": "결과 출력",
      "summary": "선택 소스·라우팅 이유·종합 답변·소스별 출처를 보기 좋게 콘솔에 보여 줌",
      "detail": "print_result 가 질문, 라우팅이 고른 소스와 그 이유, 종합 답변, 그리고 소스별로 몇 건을 어디서 가져왔는지(제목·링크)를 한눈에 출력함. 어떤 소스를 왜 골랐고 무엇을 근거로 답했는지 투명하게 보이는 것이 멀티소스 RAG의 신뢰성 장점임. 비유하면, 보고서와 함께 '어느 창구에서 무슨 자료를 받았는지' 출처 목록을 같이 제출하는 것."
    }
  ],
  "functions": [
    {
      "id": "setup",
      "name": "임포트·경로·환경·상수 설정",
      "fileId": "main",
      "summary": "필요한 모듈을 가져오고, 파일 위치 기준으로 경로를 잡고, .env 키와 핵심 상수를 준비하는 부분.",
      "how": "함수가 아니라 파일 위쪽의 준비 코드 모음임. ① from __future__ import annotations 로 타입 힌트를 가볍게 쓰고, 표준출력을 UTF-8로 맞춤. ② 모든 경로를 이 파일 위치(__file__) 기준으로 계산해 어디서 실행해도 같은 공용 벡터 DB(10.rag/vectordb)·.env 를 가리키게 함. ③ load_dotenv 로 OPENAI/GROQ/YOUTUBE 키를 환경변수로 올림. ④ 컬렉션명·임베딩 모델·LLM 모델·TOP_K·웹/유튜브 결과 수·최근 1년(RECENT_DAYS) 같은 상수와 기본 질의어를 정함.",
      "terms": [
        "from __future__ import annotations",
        "load_dotenv",
        "Path(__file__).resolve().parent",
        "컬렉션",
        "text-embedding-3-small",
        "TOP_K",
        "RECENT_DAYS",
        "DuckDuckGo",
        "YouTube Data API v3"
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
          "at": "SCRIPT_DIR = Path(__file__)",
          "text": "이 파일이 있는 폴더(multi-source/)를 절대경로로 구함 — 실행 위치와 무관하게 동작."
        },
        {
          "at": "VECTORDB_DIR = HANDS_ON_DIR",
          "text": "공용 특허법 ChromaDB(10.rag/vectordb)를 가리킴 — 재임베딩 없이 로드."
        },
        {
          "at": "ENV_PATH = HANDS_ON_DIR",
          "text": "API 키가 든 hands-on/.env 파일 경로를 잡음."
        },
        {
          "at": "load_dotenv(ENV_PATH)",
          "text": ".env 에서 OPENAI·GROQ·YOUTUBE 키를 실제로 읽어 환경변수로 올림."
        },
        {
          "at": "COLLECTION_NAME = \"patent_law\"",
          "text": "검색할 벡터 DB의 컬렉션 이름 — 인덱싱 때와 같아야 함."
        },
        {
          "at": "EMBEDDING_MODEL = \"text-embedding-3-small\"",
          "text": "질의를 벡터로 바꿀 임베딩 모델 — 인덱싱 때와 반드시 동일(1536차원)."
        },
        {
          "at": "LLM_MODEL = \"openai/gpt-oss-120b\"",
          "text": "라우팅·종합을 모두 맡을 LLM(Groq의 gpt-oss-120b) 이름."
        },
        {
          "at": "TOP_K = 5",
          "text": "벡터DB에서 가져올 비슷한 청크 개수를 5개로 정함(top-k)."
        },
        {
          "at": "RECENT_DAYS = 365",
          "text": "웹·YouTube 검색을 최근 1년으로 제한하는 기간 상수."
        },
        {
          "at": "DEFAULT_QUERY =",
          "text": "명령줄 인자가 없을 때 사용할 기본 질의어를 정함."
        }
      ],
      "code": "from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함\n\nimport sys\nfrom datetime import datetime, timedelta, timezone\nfrom pathlib import Path\n\n# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함\nif hasattr(sys.stdout, \"reconfigure\"):\n    sys.stdout.reconfigure(encoding=\"utf-8\")\n\n# ---------------------------------------------------------------------------\n# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)\n# ---------------------------------------------------------------------------\nSCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(multi-source/)를 절대경로로 구함\n# multi-source → 12.web-youtube-search → hands-on (.parent 2회로 hands-on 루트에 도달)\nHANDS_ON_DIR = SCRIPT_DIR.parent.parent\nVECTORDB_DIR = HANDS_ON_DIR / \"10.rag\" / \"vectordb\"  # 공용 특허법 ChromaDB (재임베딩 없이 로드)\nENV_PATH = HANDS_ON_DIR / \".env\"                     # hands-on/.env (API 키 보관)\n\n# ---------------------------------------------------------------------------\n# 환경변수 로드\n# ---------------------------------------------------------------------------\nfrom dotenv import load_dotenv\n\n# .env에서 OPENAI_API_KEY(질의 임베딩)·GROQ_API_KEY(LLM)·YOUTUBE_API_KEY(YouTube 검색)를 로드함\nload_dotenv(ENV_PATH)\n\n# ---------------------------------------------------------------------------\n# 상수 정의\n# ---------------------------------------------------------------------------\nCOLLECTION_NAME = \"patent_law\"               # 공용 벡터 DB 컬렉션명 (인덱싱과 동일해야 검색 가능)\nEMBEDDING_MODEL = \"text-embedding-3-small\"   # 질의 임베딩 모델 (인덱싱과 반드시 동일, 1536차원)\nLLM_MODEL = \"openai/gpt-oss-120b\"            # Groq LPU에서 서빙하는 라우팅·종합용 LLM\nTOP_K = 5                                    # 벡터DB 유사도 검색으로 가져올 상위 청크 수\nMAX_WEB_RESULTS = 5                          # DuckDuckGo 웹 검색 결과 수 (제약: 최신 5개)\nMAX_YOUTUBE_RESULTS = 5                      # YouTube 검색 결과 수\nRECENT_DAYS = 365                            # 웹·YouTube 최신 필터 기간 (최근 1년)\n\nDEFAULT_QUERY = \"특허 출원 절차를 알려주고, 최신 특허 동향과 관련 강의 영상도 찾아줘\""
    },
    {
      "id": "prompts",
      "name": "프롬프트 상수 (Router / Synthesis)",
      "fileId": "main",
      "summary": "라우터에게 '소스 선택 + 소스별 검색어 재작성' 규칙을 알려 주는 프롬프트와, 종합 답변의 제약을 정하는 프롬프트.",
      "how": "두 개의 시스템 프롬프트를 미리 글로 적어 둠. ① ROUTER_SYSTEM_PROMPT: 어떤 질문을 어떤 소스로 보낼지(라우팅) + 소스별 검색어를 어떻게 다시 쓸지(Query Rewriting) 규칙을 함께 지시함(웹은 연도 표현 제외, 유튜브는 쉼표 없는 짧은 키워드). ② SYNTHESIS_SYSTEM_PROMPT: 수집된 검색 결과만 근거로, 소스를 구분하되 자연스럽게 하나로 통합하고 출처(조문·URL)를 함께 제시하라고 제약함.",
      "terms": [
        "Query Router(질문 라우팅)",
        "Query Rewriting(검색어 재작성)",
        "Synthesis(종합)",
        "멀티소스 RAG",
        "프롬프트",
        "DuckDuckGo"
      ],
      "lines": [
        {
          "at": "ROUTER_SYSTEM_PROMPT = \"\"\"당신은 멀티소스 RAG의 Query Router임",
          "text": "라우터의 역할(소스 선택 + 소스별 검색어 생성)을 정의하는 시스템 프롬프트 시작."
        },
        {
          "at": "[소스별 특징과 선택 기준]",
          "text": "법률→vectorstore, 최신정보→web, 배우는 영상→youtube 선택 기준을 설명."
        },
        {
          "at": "[복수 선택]",
          "text": "한 질문에 여러 의도가 있으면 소스를 복수 선택하라는 규칙."
        },
        {
          "at": "[소스별 검색어 재작성(Query Rewriting) 규칙]",
          "text": "소스마다 최적 검색어가 다르므로 규칙대로 다시 쓰라는 지시."
        },
        {
          "at": "(웹 검색은 최근 1년 필터가 자동 적용되므로 시간 표현이 불필요)",
          "text": "웹은 연도/시간 표현을 빼라는 이유 — 최근 1년 필터가 이미 걸리기 때문."
        },
        {
          "at": "SYNTHESIS_SYSTEM_PROMPT = (",
          "text": "종합 답변용 시스템 프롬프트 정의 시작."
        },
        {
          "at": "반드시 아래 [검색 결과]에 있는 내용만 근거로 답하고",
          "text": "검색 결과 밖 내용을 지어내지 말라는 환각 차단 제약."
        },
        {
          "at": "특허법 근거는 조문을, 웹/YouTube 근거는 URL을 함께 제시할 것",
          "text": "소스별로 알맞은 출처(조문·URL)를 답변에 달라는 지시."
        }
      ],
      "code": "# Query Router 시스템 프롬프트\n#   - 어떤 질문을 어떤 소스로 보낼지(라우팅) + 소스별 검색어를 어떻게 다시 쓸지(리라이팅)를 함께 지시함\n#   - 소스별 리라이팅 규칙(웹은 연도 제외, 유튜브는 쉼표 없는 짧은 키워드)을 명시해 제약을 지킴\nROUTER_SYSTEM_PROMPT = \"\"\"당신은 멀티소스 RAG의 Query Router임. 사용자 질문을 분석하여\n(1) 검색할 소스를 선택하고 (2) 각 소스에 최적화된 검색어를 생성함.\n\n[소스별 특징과 선택 기준]\n- vectorstore : 대한민국 특허법 조문. 특허 요건·출원 절차·권리·심사 등 '법률/제도' 질문에 선택.\n- web         : DuckDuckGo 웹 검색. 최신 동향·뉴스·통계·시장 정보 등 '최신 정보' 질문에 선택.\n- youtube     : YouTube 영상 검색. 튜토리얼·강의·강연·실습 등 '배우는 영상' 질문에 선택.\n\n[복수 선택]\n- 한 질문이 여러 의도를 담으면 소스를 복수 선택함 (예: 법률 + 최신정보 + 강의).\n- 관련 없는 소스는 선택하지 않음 (불필요한 검색 방지).\n\n[소스별 검색어 재작성(Query Rewriting) 규칙]\n- vectorstore_query : 특허법 조문 검색에 맞는 핵심 법률 용어 중심으로 작성. 미선택 시 빈 문자열.\n- web_query : 핵심 키워드 중심. 연도/시간 표현(예: '2024', '최신', '올해', '요즘')은 제외함\n  (웹 검색은 최근 1년 필터가 자동 적용되므로 시간 표현이 불필요). 미선택 시 빈 문자열.\n- youtube_query : 쉼표 없이 짧은 키워드로 작성(예: '특허 출원 강의'). 미선택 시 빈 문자열.\n\n[예시]\n- \"특허 요건이 뭐야?\" → sources=[\"vectorstore\"]\n- \"AI 특허 최신 동향\" → sources=[\"web\"], web_query=\"AI 특허 동향\"\n- \"특허 출원 절차와 최신 통계, 관련 강의\" → sources=[\"vectorstore\",\"web\",\"youtube\"]\n\"\"\"\n\n# Synthesis 시스템 프롬프트: 수집된 멀티소스 결과만 근거로 답변하도록 제약함\nSYNTHESIS_SYSTEM_PROMPT = (\n    \"당신은 여러 소스의 검색 결과를 종합하여 답변하는 멀티소스 RAG 어시스턴트임. \"\n    \"반드시 아래 [검색 결과]에 있는 내용만 근거로 답하고, 없는 내용은 추측하지 말 것. \"\n    \"소스별로 정보를 구분하여 정리하되, 자연스럽게 하나의 답변으로 통합할 것. \"\n    \"특허법 근거는 조문을, 웹/YouTube 근거는 URL을 함께 제시할 것. \"\n    \"답변은 한국어로 간결하게 작성할 것.\"\n)"
    },
    {
      "id": "route_decision",
      "name": "RouteDecision (Pydantic 스키마)",
      "fileId": "main",
      "summary": "라우터가 채워 답할 '정해진 답안지 양식': 검색할 소스 목록 + 소스별 재작성 검색어 + 선택 이유.",
      "how": "LLM에게 자유 문장 대신 '이 칸을 채워라'는 양식(스키마)을 주면 결과를 안정적으로 읽을 수 있음. sources 는 Literal 로 허용된 세 소스명(vectorstore/web/youtube)만 받게 막아 잘못된 소스명을 원천 차단함. vectorstore_query·web_query·youtube_query 는 각 소스용으로 재작성된 검색어를 담고(미선택 시 빈 문자열), reasoning 은 선택 이유를 담음. with_structured_output 과 짝을 이뤄 라우팅과 Query Rewriting을 한 번에 받음.",
      "terms": [
        "RouteDecision",
        "Pydantic",
        "Literal",
        "with_structured_output",
        "Query Router(질문 라우팅)",
        "Query Rewriting(검색어 재작성)"
      ],
      "lines": [
        {
          "at": "class RouteDecision(BaseModel):",
          "text": "라우팅 결과를 담을 Pydantic 스키마(답안지 양식) 정의."
        },
        {
          "at": "sources: list[Literal[\"vectorstore\", \"web\", \"youtube\"]]",
          "text": "허용된 세 소스명만 받도록 Literal로 제한한 검색 소스 목록 칸."
        },
        {
          "at": "vectorstore_query: str = Field(",
          "text": "특허법 벡터DB용으로 재작성된 검색어 칸(미선택 시 빈 문자열)."
        },
        {
          "at": "web_query: str = Field(",
          "text": "웹용으로 재작성된 검색어 칸(연도 표현 제외, 미선택 시 빈 문자열)."
        },
        {
          "at": "youtube_query: str = Field(",
          "text": "YouTube용으로 재작성된 검색어 칸(짧은 키워드, 미선택 시 빈 문자열)."
        },
        {
          "at": "reasoning: str = Field(description=\"소스를 그렇게 선택한 이유 요약.\")",
          "text": "왜 그 소스들을 골랐는지 이유를 담는 칸."
        }
      ],
      "code": "from typing import Literal\n\nfrom pydantic import BaseModel, Field\n\n\nclass RouteDecision(BaseModel):\n    \"\"\"질문 분석 결과: 검색할 소스 목록 + 소스별 최적화 검색어(Query Rewriting).\n\n    LLM이 이 스키마 형태로 응답하도록 강제하여(structured output), 자연어 파싱 없이\n    안정적으로 라우팅 결정과 소스별 검색어를 동시에 얻음.\n    \"\"\"\n\n    # Literal[...]: 허용된 문자열만 값으로 받도록 제한함 (잘못된 소스명 방지)\n    sources: list[Literal[\"vectorstore\", \"web\", \"youtube\"]] = Field(\n        description=\"검색할 소스 목록. 질문 의도에 맞게 복수 선택 가능.\"\n    )\n    vectorstore_query: str = Field(\n        default=\"\",\n        description=\"특허법 벡터DB 검색어(법률 용어 중심). sources에 'vectorstore'가 없으면 빈 문자열.\",\n    )\n    web_query: str = Field(\n        default=\"\",\n        description=\"웹 검색어. 연도/시간 표현 제외. sources에 'web'이 없으면 빈 문자열.\",\n    )\n    youtube_query: str = Field(\n        default=\"\",\n        description=\"YouTube 검색어. 쉼표 없이 짧은 키워드. sources에 'youtube'가 없으면 빈 문자열.\",\n    )\n    reasoning: str = Field(description=\"소스를 그렇게 선택한 이유 요약.\")"
    },
    {
      "id": "create_router_llm",
      "name": "create_router_llm()",
      "fileId": "main",
      "summary": "질문 라우팅 전용 Groq LLM을 만들어 돌려주는 함수.",
      "how": "라우팅은 매번 같은 결정을 내려야 좋으므로 temperature=0 으로 결정적으로 둠. 추론 모델(gpt-oss-120b)의 reasoning_format 은 일부러 건드리지 않고 기본값으로 두어, 구조화 출력(도구 호출 기반)과 충돌할 가능성을 피함. Groq 키가 없으면 즉시 명확한 오류를 내(나중에 엉뚱한 곳에서 실패하는 것 방지) ChatGroq 모델을 만들어 돌려줌.",
      "terms": [
        "ChatGroq",
        "Groq LPU",
        "gpt-oss-120b",
        "temperature",
        "reasoning_format",
        "API 키 검사"
      ],
      "lines": [
        {
          "at": "def create_router_llm():",
          "text": "라우팅 전용 Groq LLM을 만드는 함수 정의."
        },
        {
          "at": "from langchain_groq import ChatGroq",
          "text": "Groq 클라우드에 채팅 요청을 보내는 LLM 래퍼를 가져옴."
        },
        {
          "at": "if not os.getenv(\"GROQ_API_KEY\"):",
          "text": "Groq 키가 없으면 초기에 명확한 오류를 내 디버깅을 쉽게 함."
        },
        {
          "at": "return ChatGroq(model=LLM_MODEL, temperature=0)",
          "text": "temperature=0(결정적 라우팅)으로 Groq 채팅 모델을 만들어 돌려줌."
        }
      ],
      "code": "def create_router_llm():\n    \"\"\"Query Router 전용 Groq LLM을 생성함.\n\n    추론 모델(gpt-oss-120b)의 reasoning_format을 지정하지 않고 기본값으로 두어\n    structured output(도구 호출 기반)과의 충돌 가능성을 피함. temperature=0으로 결정적 라우팅.\n    \"\"\"\n    import os\n\n    # ChatGroq: Groq Cloud LPU에 채팅 요청을 보내는 LangChain 모델 래퍼 (GROQ_API_KEY 자동 참조)\n    from langchain_groq import ChatGroq\n\n    # API 키 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함\n    if not os.getenv(\"GROQ_API_KEY\"):\n        raise RuntimeError(f\"GROQ_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요\")\n\n    return ChatGroq(model=LLM_MODEL, temperature=0)"
    },
    {
      "id": "route_query",
      "name": "route_query() — Query Router 실행",
      "fileId": "main",
      "summary": "질문을 분석해 소스 선택 + 소스별 검색어를 담은 RouteDecision을 한 번의 호출로 받는 함수.",
      "how": "router_llm.with_structured_output(RouteDecision) 로 LLM 응답을 RouteDecision 양식(JSON)으로 강제해 자연어 파싱 없이 안정적으로 결과를 받음. 시스템 프롬프트(ROUTER_SYSTEM_PROMPT)와 사용자 질문을 함께 넣어 invoke 하면, 라우팅(어떤 소스를 쓸지)과 Query Rewriting(소스별 검색어)을 동시에 한 번의 LLM 호출로 끝냄.",
      "terms": [
        "Query Router(질문 라우팅)",
        "Query Rewriting(검색어 재작성)",
        "with_structured_output",
        "RouteDecision",
        "invoke",
        "프롬프트"
      ],
      "lines": [
        {
          "at": "def route_query(query: str, router_llm) -> RouteDecision:",
          "text": "질문을 받아 라우팅 결정(RouteDecision)을 돌려주는 함수 정의."
        },
        {
          "at": "structured_llm = router_llm.with_structured_output(RouteDecision)",
          "text": "LLM 응답을 RouteDecision 양식으로 강제하는 구조화 출력 래퍼를 만듦."
        },
        {
          "at": "decision = structured_llm.invoke(",
          "text": "시스템 프롬프트와 질문을 넣어 라우팅+검색어 생성을 1회 호출로 수행."
        },
        {
          "at": "{\"role\": \"system\", \"content\": ROUTER_SYSTEM_PROMPT},",
          "text": "라우팅 규칙이 담긴 시스템 프롬프트를 메시지로 전달."
        },
        {
          "at": "return decision",
          "text": "소스 목록·소스별 검색어·이유가 채워진 RouteDecision을 돌려줌."
        }
      ],
      "code": "def route_query(query: str, router_llm) -> RouteDecision:\n    \"\"\"질문을 분석하여 소스 선택 + 소스별 검색어를 담은 RouteDecision을 반환함.\n\n    with_structured_output(RouteDecision): LLM 응답을 RouteDecision 스키마(JSON)로 강제하여\n    파싱 오류 없이 구조화된 결정을 받음. 라우팅과 Query Rewriting을 한 번의 호출로 동시에 수행함.\n    \"\"\"\n    structured_llm = router_llm.with_structured_output(RouteDecision)\n    decision = structured_llm.invoke(\n        [\n            {\"role\": \"system\", \"content\": ROUTER_SYSTEM_PROMPT},\n            {\"role\": \"user\", \"content\": query},\n        ]\n    )\n    return decision"
    },
    {
      "id": "search_vectorstore",
      "name": "search_vectorstore() — 특허법 벡터DB 검색",
      "fileId": "main",
      "summary": "이미 만들어진 공용 특허법 ChromaDB를 재임베딩 없이 연결해 유사 청크 Top K를 검색하는 함수.",
      "how": "새로 인덱싱하지 않고 ../../10.rag/vectordb 의 영속 컬렉션을 그대로 연결함. ① OPENAI 키·벡터DB 폴더 존재를 먼저 확인함. ② 인덱싱과 같은 임베딩 모델로 OpenAIEmbeddings 를 만들어 질의를 1536차원 벡터로 바꿈. ③ Chroma 생성자(from_documents 아님)로 기존 컬렉션을 연결하고, as_retriever 로 유사도 상위 TOP_K개만 가져옴. ④ 결과를 소스 공통 형식(title/snippet/link)으로 정규화해 종합 단계에서 일관되게 다루게 함.",
      "terms": [
        "Chroma",
        "ChromaDB",
        "영속화",
        "컬렉션",
        "OpenAIEmbeddings",
        "as_retriever",
        "retriever",
        "유사도 검색",
        "TOP_K",
        "청크",
        "metadata"
      ],
      "lines": [
        {
          "at": "def search_vectorstore(query: str) -> list[dict]:",
          "text": "특허법 벡터DB를 검색하는 함수 정의."
        },
        {
          "at": "if not VECTORDB_DIR.exists():",
          "text": "인덱싱이 먼저 돼 있어야 하므로 벡터 DB 폴더 존재를 확인함."
        },
        {
          "at": "embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)",
          "text": "인덱싱과 같은 모델로 질의 임베딩기를 준비함(차원·의미공간 일치)."
        },
        {
          "at": "vectorstore = Chroma(",
          "text": "from_documents(신규 생성)가 아니라 기존 영속 컬렉션을 '연결'만 함."
        },
        {
          "at": "persist_directory=str(VECTORDB_DIR),",
          "text": "디스크에 저장된 벡터 폴더를 가리켜 재임베딩 없이 재사용."
        },
        {
          "at": "retriever = vectorstore.as_retriever(search_kwargs={\"k\": TOP_K})",
          "text": "유사도 상위 TOP_K(5)개 청크만 반환하는 검색기로 바꿈."
        },
        {
          "at": "docs = retriever.invoke(query)",
          "text": "질의를 임베딩해 가장 비슷한 청크들을 실제로 검색함."
        },
        {
          "at": "source = doc.metadata.get(\"source\", \"unknown\")",
          "text": "각 청크의 출처 파일명을 메타데이터에서 꺼냄."
        },
        {
          "at": "\"title\": f\"{source} #{chunk_index}\",",
          "text": "소스 공통 형식의 제목으로 출처+청크 번호를 구성."
        }
      ],
      "code": "def search_vectorstore(query: str) -> list[dict]:\n    \"\"\"특허법 벡터DB를 재임베딩 없이 로드하여 유사 청크 Top K를 검색함.\n\n    Chroma(...) 생성자(from_documents가 아님)로 이미 영속화된 컬렉션을 그대로 연결함.\n    인덱싱과 동일한 임베딩 모델을 써야 의미 공간이 일치하여 유사도 검색이 성립함.\n    반환: [{\"title\": 조문 출처, \"snippet\": 본문, \"link\": 청크 식별자}, ...] (소스 공통 형식)\n    \"\"\"\n    import os\n\n    from langchain_chroma import Chroma\n    from langchain_openai import OpenAIEmbeddings\n\n    if not os.getenv(\"OPENAI_API_KEY\"):\n        raise RuntimeError(f\"OPENAI_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요\")\n    if not VECTORDB_DIR.exists():\n        raise FileNotFoundError(f\"특허법 벡터 DB가 없음: {VECTORDB_DIR}\")\n\n    # OpenAIEmbeddings: 질의를 1536차원 벡터로 변환 (검색용 질의 임베딩, OPENAI_API_KEY 자동 참조)\n    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)\n    vectorstore = Chroma(\n        collection_name=COLLECTION_NAME,\n        embedding_function=embeddings,\n        persist_directory=str(VECTORDB_DIR),\n    )\n\n    # as_retriever(search_kwargs={\"k\": TOP_K}): 유사도 상위 TOP_K개 청크만 반환하도록 설정함\n    retriever = vectorstore.as_retriever(search_kwargs={\"k\": TOP_K})\n    docs = retriever.invoke(query)\n\n    # 소스 공통 형식(title/snippet/link)으로 정규화하여 종합 단계에서 일관되게 다룸\n    results = []\n    for doc in docs:\n        source = doc.metadata.get(\"source\", \"unknown\")\n        chunk_index = doc.metadata.get(\"chunk_index\", \"?\")\n        results.append(\n            {\n                \"title\": f\"{source} #{chunk_index}\",\n                \"snippet\": doc.page_content,\n                \"link\": f\"{source}#{chunk_index}\",\n            }\n        )\n    return results"
    },
    {
      "id": "search_web",
      "name": "search_web() — 웹 검색(DuckDuckGo)",
      "fileId": "main",
      "summary": "DuckDuckGo로 최근 1년 웹 문서를 검색해 제목·본문·링크를 돌려주는 함수.",
      "how": "DuckDuckGoSearchAPIWrapper 를 한국 지역·최근 1년(time=\"y\")·최신 5개로 설정함. run() 대신 results() 를 써 출처 URL(link)까지 확보함. DuckDuckGo는 Rate limit(요청 과다 차단)이 잦아, 실패하면 코드 버그와 구분되도록 경고만 출력하고 빈 리스트로 넘어감(graceful degradation). 끝으로 키 이름을 소스 공통 형식(title/snippet/link)으로 정규화함(래퍼 버전 차이를 방어).",
      "terms": [
        "DuckDuckGo",
        "DuckDuckGoSearchAPIWrapper",
        "graceful degradation",
        "RECENT_DAYS"
      ],
      "lines": [
        {
          "at": "def search_web(query: str) -> list[dict]:",
          "text": "DuckDuckGo 웹 검색을 수행하는 함수 정의."
        },
        {
          "at": "from langchain_community.utilities import DuckDuckGoSearchAPIWrapper",
          "text": "DuckDuckGo 검색을 감싼 LangChain 유틸을 가져옴(API 키 불필요)."
        },
        {
          "at": "region=\"ko-kr\",   # 한국어/한국 지역 결과 우선",
          "text": "한국어/한국 지역 결과를 우선하도록 지역을 설정."
        },
        {
          "at": "time=\"y\",         # 최근 1년 필터 (제약 사항)",
          "text": "최근 1년 문서만 검색하도록 시간 필터를 설정."
        },
        {
          "at": "raw = wrapper.results(query, max_results=MAX_WEB_RESULTS)",
          "text": "run()과 달리 링크 포함 상세 결과(title/snippet/link)를 가져옴."
        },
        {
          "at": "print(f\"  [경고] 웹 검색 실패(빈 결과로 진행): {error}\", file=sys.stderr)",
          "text": "Rate limit·네트워크 오류를 버그와 구분해 경고만 내고 빈 결과로 진행."
        },
        {
          "at": "\"title\": item.get(\"title\", \"\"),",
          "text": "래퍼 버전 차이를 방어하며 소스 공통 형식으로 키를 정규화."
        }
      ],
      "code": "def search_web(query: str) -> list[dict]:\n    \"\"\"DuckDuckGo로 최근 1년 웹 문서를 검색하여 소스 링크 포함 결과를 반환함.\n\n    DuckDuckGoSearchAPIWrapper.results(): run()과 달리 title·snippet·link를 모두 반환하여\n    출처 URL을 확보함. time=\"y\"로 최근 1년, max_results로 최신 5개만 사용함.\n    DuckDuckGo는 RatelimitException이 잦으므로 실패 시 빈 리스트로 graceful 처리함.\n    \"\"\"\n    # DuckDuckGoSearchAPIWrapper: DuckDuckGo 검색을 감싼 LangChain 유틸 (API 키 불필요)\n    from langchain_community.utilities import DuckDuckGoSearchAPIWrapper\n\n    wrapper = DuckDuckGoSearchAPIWrapper(\n        region=\"ko-kr\",   # 한국어/한국 지역 결과 우선\n        time=\"y\",         # 최근 1년 필터 (제약 사항)\n        max_results=MAX_WEB_RESULTS,\n    )\n\n    try:\n        # results(query, max_results): 링크 포함 상세 결과 [{\"title\",\"snippet\",\"link\"}, ...] 반환\n        raw = wrapper.results(query, max_results=MAX_WEB_RESULTS)\n    except Exception as error:\n        # Rate limit·네트워크 오류를 코드 버그와 구분하기 위해 경고만 출력하고 빈 결과 반환\n        print(f\"  [경고] 웹 검색 실패(빈 결과로 진행): {error}\", file=sys.stderr)\n        return []\n\n    # 키 이름을 소스 공통 형식으로 정규화 (래퍼 버전에 따라 link/snippet 키가 다를 수 있어 방어적으로 처리)\n    results = []\n    for item in raw:\n        results.append(\n            {\n                \"title\": item.get(\"title\", \"\"),\n                \"snippet\": item.get(\"snippet\", \"\"),\n                \"link\": item.get(\"link\", \"\"),\n            }\n        )\n    return results"
    },
    {
      "id": "search_youtube",
      "name": "search_youtube() — YouTube 검색",
      "fileId": "main",
      "summary": "YouTube Data API v3로 최근 1년 영상을 검색해 제목·설명·영상 URL을 돌려주는 함수.",
      "how": "build() 로 YouTube Data API v3 클라이언트를 만들고 search().list() 로 영상을 검색함. publishedAfter 에 (현재-365일) 시각을 ISO 8601(...Z)로 넣어 최근 1년만, type=\"video\"·relevanceLanguage=\"ko\" 로 한국어 관련 영상을 우선함. 키가 없거나 할당량 초과·네트워크 오류면 경고만 내고 빈 리스트로 넘어감(graceful degradation). 제목·설명에 든 HTML 엔티티(&#39; 등)는 html.unescape() 로 보통 글자로 복원하고, 소스 공통 형식으로 정규화함.",
      "terms": [
        "YouTube Data API v3",
        "build()",
        "ISO 8601",
        "html.unescape",
        "graceful degradation",
        "RECENT_DAYS"
      ],
      "lines": [
        {
          "at": "def search_youtube(query: str) -> list[dict]:",
          "text": "YouTube Data API v3로 영상을 검색하는 함수 정의."
        },
        {
          "at": "from googleapiclient.discovery import build",
          "text": "YouTube API 클라이언트를 만드는 google-api-python-client의 build를 가져옴."
        },
        {
          "at": "api_key = os.getenv(\"YOUTUBE_API_KEY\")",
          "text": "환경변수에서 YouTube API 키를 읽음."
        },
        {
          "at": "published_after = (",
          "text": "(현재-365일) 경계 시각을 ISO 8601로 계산해 최근 1년만 검색하게 함."
        },
        {
          "at": "youtube = build(\"youtube\", \"v3\", developerKey=api_key)",
          "text": "build()로 YouTube Data API v3 클라이언트를 생성."
        },
        {
          "at": "publishedAfter=published_after,  # 최근 1년 필터 (제약 사항)",
          "text": "최근 1년 이후에 올라온 영상만 검색하도록 필터를 적용."
        },
        {
          "at": "relevanceLanguage=\"ko\",  # 한국어 우선",
          "text": "한국어 관련 영상을 우선 정렬하도록 지정."
        },
        {
          "at": "video_id = item[\"id\"][\"videoId\"]",
          "text": "각 항목에서 영상 ID를 꺼내 시청 URL을 만들 준비."
        },
        {
          "at": "title = html.unescape(snippet[\"title\"])",
          "text": "제목 속 HTML 엔티티(&#39; 등)를 보통 글자로 복원."
        },
        {
          "at": "\"link\": f\"https://www.youtube.com/watch?v={video_id}\",",
          "text": "영상 ID로 시청 URL을 만들어 소스 공통 형식의 link로 넣음."
        }
      ],
      "code": "def search_youtube(query: str) -> list[dict]:\n    \"\"\"YouTube Data API v3로 최근 1년 영상을 검색하여 메타데이터를 반환함.\n\n    publishedAfter에 (현재-365일) 시각을 ISO 8601로 지정해 최근 1년 영상만 검색함.\n    order=\"relevance\", relevanceLanguage=\"ko\"로 한국어 관련 영상을 우선 정렬함.\n    YOUTUBE_API_KEY 미설정·할당량 초과·네트워크 오류 시 빈 리스트로 graceful 처리함.\n    \"\"\"\n    import html\n    import os\n\n    # build: YouTube Data API v3 클라이언트를 생성하는 google-api-python-client 함수\n    from googleapiclient.discovery import build\n\n    api_key = os.getenv(\"YOUTUBE_API_KEY\")\n    if not api_key:\n        print(\"  [경고] YOUTUBE_API_KEY 미설정(빈 결과로 진행)\", file=sys.stderr)\n        return []\n\n    # 최근 1년 경계 시각을 UTC ISO 8601(...Z) 형식으로 계산함 (publishedAfter 요구 형식)\n    published_after = (\n        datetime.now(timezone.utc) - timedelta(days=RECENT_DAYS)\n    ).strftime(\"%Y-%m-%dT%H:%M:%SZ\")\n\n    try:\n        youtube = build(\"youtube\", \"v3\", developerKey=api_key)\n        request = youtube.search().list(\n            q=query,\n            part=\"snippet\",          # 제목·채널·설명 등 기본 메타데이터\n            type=\"video\",            # 영상만 (채널/재생목록 제외)\n            order=\"relevance\",\n            publishedAfter=published_after,  # 최근 1년 필터 (제약 사항)\n            maxResults=MAX_YOUTUBE_RESULTS,\n            relevanceLanguage=\"ko\",  # 한국어 우선\n        )\n        response = request.execute()\n    except Exception as error:\n        print(f\"  [경고] YouTube 검색 실패(빈 결과로 진행): {error}\", file=sys.stderr)\n        return []\n\n    # 소스 공통 형식으로 정규화 (title/snippet/link), 영상 URL을 link로 구성함\n    results = []\n    for item in response.get(\"items\", []):\n        snippet = item[\"snippet\"]\n        video_id = item[\"id\"][\"videoId\"]\n        # html.unescape(): YouTube API가 제목/설명에 넣는 HTML 엔티티(&#39; 등)를 일반 문자로 복원함\n        title = html.unescape(snippet[\"title\"])\n        channel = html.unescape(snippet[\"channelTitle\"])\n        results.append(\n            {\n                \"title\": f\"{title} ({channel})\",\n                \"snippet\": html.unescape(snippet.get(\"description\", \"\")),\n                \"link\": f\"https://www.youtube.com/watch?v={video_id}\",\n            }\n        )\n    return results"
    },
    {
      "id": "source_registry",
      "name": "SOURCE_REGISTRY (소스 매핑표)",
      "fileId": "main",
      "summary": "소스명을 (검색 함수, RouteDecision의 검색어 속성명, 한글 라벨)로 이어 주는 매핑표.",
      "how": "라우팅이 고른 소스명(vectorstore/web/youtube)만 가지고도, 그 소스에 맞는 검색 함수와 검색어가 들어 있는 RouteDecision 속성 이름, 화면용 한글 라벨을 한 번에 찾을 수 있게 미리 표로 정리함. 이 표 덕분에 dispatch_searches·format_context·print_result 가 소스마다 if 분기를 길게 쓰지 않고, 표만 보고 처리할 수 있음(코드가 간결·확장 쉬움).",
      "terms": [
        "SOURCE_REGISTRY",
        "Query Router(질문 라우팅)",
        "RouteDecision"
      ],
      "lines": [
        {
          "at": "SOURCE_REGISTRY = {",
          "text": "소스명 → (검색 함수, 검색어 속성명, 한글 라벨) 매핑표 정의."
        },
        {
          "at": "\"vectorstore\": (search_vectorstore, \"vectorstore_query\", \"특허법 벡터DB\"),",
          "text": "벡터DB 소스를 검색 함수·검색어 속성·라벨과 연결."
        },
        {
          "at": "\"web\": (search_web, \"web_query\", \"웹검색(DuckDuckGo)\"),",
          "text": "웹 소스를 검색 함수·검색어 속성·라벨과 연결."
        },
        {
          "at": "\"youtube\": (search_youtube, \"youtube_query\", \"YouTube\"),",
          "text": "YouTube 소스를 검색 함수·검색어 속성·라벨과 연결."
        }
      ],
      "code": "# 소스명 → (검색 함수, RouteDecision의 검색어 속성명, 한글 라벨) 매핑\nSOURCE_REGISTRY = {\n    \"vectorstore\": (search_vectorstore, \"vectorstore_query\", \"특허법 벡터DB\"),\n    \"web\": (search_web, \"web_query\", \"웹검색(DuckDuckGo)\"),\n    \"youtube\": (search_youtube, \"youtube_query\", \"YouTube\"),\n}"
    },
    {
      "id": "dispatch_searches",
      "name": "dispatch_searches() — 선택 소스만 검색",
      "fileId": "main",
      "summary": "라우팅 결정에 따라 선택된 소스만, 그 소스용 검색어로 각각 검색해 결과를 모으는 함수.",
      "how": "RouteDecision.sources 를 하나씩 돌며 SOURCE_REGISTRY 에서 (검색 함수, 검색어 속성명, 라벨)을 꺼냄. getattr(decision, query_attr) 로 그 소스용으로 재작성된 검색어를 RouteDecision 에서 동적으로 가져옴(if 분기 대신 속성명 문자열로 접근). 검색어가 비어 있으면 건너뛰고, 있으면 해당 함수를 호출해 {소스명: [결과...]} 형태로 모아 종합 단계에 전달함.",
      "terms": [
        "Query Rewriting(검색어 재작성)",
        "SOURCE_REGISTRY",
        "getattr",
        "RouteDecision",
        "graceful degradation"
      ],
      "lines": [
        {
          "at": "def dispatch_searches(decision: RouteDecision) -> dict[str, list[dict]]:",
          "text": "선택된 소스만 검색해 결과를 모으는 함수 정의."
        },
        {
          "at": "for source in decision.sources:",
          "text": "라우팅이 고른 소스 목록을 하나씩 순회."
        },
        {
          "at": "search_fn, query_attr, label = SOURCE_REGISTRY[source]",
          "text": "매핑표에서 그 소스의 검색 함수·검색어 속성명·라벨을 꺼냄."
        },
        {
          "at": "source_query = getattr(decision, query_attr).strip()",
          "text": "getattr로 그 소스용 재작성 검색어를 RouteDecision에서 동적으로 꺼냄."
        },
        {
          "at": "if not source_query:",
          "text": "그 소스용 검색어가 비어 있으면 검색을 건너뜀."
        },
        {
          "at": "collected[source] = search_fn(source_query)",
          "text": "재작성된 검색어로 해당 소스의 검색 함수를 실제로 실행."
        },
        {
          "at": "return collected",
          "text": "{소스명: [검색결과...]} 형태로 모아 종합 단계에 넘김."
        }
      ],
      "code": "def dispatch_searches(decision: RouteDecision) -> dict[str, list[dict]]:\n    \"\"\"RouteDecision에 따라 선택된 소스만 각자의 검색어로 검색하여 결과를 모음.\n\n    소스별로 재작성된 검색어(Query Rewriting 결과)를 사용함. 검색어가 비어 있으면 건너뜀.\n    반환: {소스명: [검색결과...]} 형태로 종합 단계에 전달함.\n    \"\"\"\n    collected: dict[str, list[dict]] = {}\n    for source in decision.sources:\n        if source not in SOURCE_REGISTRY:\n            continue  # 스키마가 Literal로 막지만, 방어적으로 알 수 없는 소스는 무시함\n        search_fn, query_attr, label = SOURCE_REGISTRY[source]\n        # getattr(decision, query_attr): RouteDecision에서 이 소스용으로 재작성된 검색어를 꺼냄\n        source_query = getattr(decision, query_attr).strip()\n        if not source_query:\n            print(f\"  - [{label}] 검색어 없음 → 건너뜀\")\n            continue\n        print(f\"  - [{label}] 검색어: '{source_query}'\")\n        collected[source] = search_fn(source_query)\n        print(f\"    → {len(collected[source])}건\")\n    return collected"
    },
    {
      "id": "format_context",
      "name": "format_context() — 컨텍스트 합치기",
      "fileId": "main",
      "summary": "소스별 검색 결과를 헤더로 구분해 LLM 종합용 단일 컨텍스트 문자열로 합치는 함수.",
      "how": "검색 결과는 {소스명: [결과...]} 딕셔너리지만 프롬프트에는 글자로 넣어야 함. 각 소스를 '## [라벨]' 헤더로 구분하고, 항목마다 번호·제목·본문·(출처) 링크를 붙여 LLM이 인용하기 쉽게 함. 결과가 없는 소스는 '검색 결과 없음'으로 표시함. 소스가 서로 달라도 title/snippet/link 공통 형식으로 정규화돼 있어 같은 방식으로 처리됨.",
      "terms": [
        "Synthesis(종합)",
        "SOURCE_REGISTRY",
        "프롬프트"
      ],
      "lines": [
        {
          "at": "def format_context(collected: dict[str, list[dict]]) -> str:",
          "text": "소스별 결과를 단일 컨텍스트 문자열로 합치는 함수 정의."
        },
        {
          "at": "label = SOURCE_REGISTRY[source][2]",
          "text": "매핑표에서 그 소스의 화면용 한글 라벨을 꺼냄."
        },
        {
          "at": "blocks.append(f\"## [{label}] 검색 결과 없음\")",
          "text": "결과가 없는 소스는 '검색 결과 없음' 헤더로 표시."
        },
        {
          "at": "lines = [f\"## [{label}]\"]",
          "text": "결과가 있는 소스는 라벨 헤더로 블록을 시작."
        },
        {
          "at": "for index, item in enumerate(results, start=1):",
          "text": "각 결과에 1번부터 번호를 매기며 하나씩 처리."
        },
        {
          "at": "f\"[{index}] {item['title']}\\n{item['snippet']}\\n(출처: {item['link']})\"",
          "text": "번호·제목·본문·출처 링크를 한 항목으로 묶어 인용하기 쉽게 함."
        }
      ],
      "code": "def format_context(collected: dict[str, list[dict]]) -> str:\n    \"\"\"소스별 검색 결과를 LLM 종합용 단일 컨텍스트 문자열로 합침.\n\n    각 소스를 헤더로 구분하고, 항목마다 제목·본문·링크를 붙여 LLM이 출처를 인용하기 쉽게 함.\n    \"\"\"\n    blocks = []\n    for source, results in collected.items():\n        label = SOURCE_REGISTRY[source][2]\n        if not results:\n            blocks.append(f\"## [{label}] 검색 결과 없음\")\n            continue\n        lines = [f\"## [{label}]\"]\n        for index, item in enumerate(results, start=1):\n            # 벡터DB 본문은 길 수 있으나 종합 정확도를 위해 그대로 사용함 (웹/유튜브 snippet은 짧음)\n            lines.append(\n                f\"[{index}] {item['title']}\\n{item['snippet']}\\n(출처: {item['link']})\"\n            )\n        blocks.append(\"\\n\\n\".join(lines))\n    return \"\\n\\n\".join(blocks)"
    },
    {
      "id": "create_synthesis_llm",
      "name": "create_synthesis_llm()",
      "fileId": "main",
      "summary": "종합 답변 생성 전용 Groq LLM을 만들어 돌려주는 함수.",
      "how": "추론 모델(gpt-oss-120b)은 사고 과정이 답변에 섞일 수 있으므로, reasoning_format=\"hidden\" 으로 최종 답변 텍스트만 받게 함(라우터용 LLM과 다른 점). temperature=0 으로 같은 입력엔 같은(재현 가능한) 답을 내게 고정해 ChatGroq 모델을 만들어 돌려줌.",
      "terms": [
        "ChatGroq",
        "Groq LPU",
        "gpt-oss-120b",
        "temperature",
        "reasoning_format",
        "Synthesis(종합)"
      ],
      "lines": [
        {
          "at": "def create_synthesis_llm():",
          "text": "종합 답변용 Groq LLM을 만드는 함수 정의."
        },
        {
          "at": "from langchain_groq import ChatGroq",
          "text": "Groq 클라우드 채팅 LLM 래퍼를 가져옴."
        },
        {
          "at": "return ChatGroq(model=LLM_MODEL, temperature=0, reasoning_format=\"hidden\")",
          "text": "사고 과정을 숨기고(reasoning_format=hidden) 결정적으로 답하는 모델을 돌려줌."
        }
      ],
      "code": "def create_synthesis_llm():\n    \"\"\"종합 답변 생성용 Groq LLM을 생성함.\n\n    gpt-oss-120b는 추론 모델이라 사고 과정이 답변에 섞일 수 있으므로\n    reasoning_format=\"hidden\"으로 최종 답변 텍스트만 받도록 함. temperature=0으로 결정적 답변.\n    \"\"\"\n    from langchain_groq import ChatGroq\n\n    return ChatGroq(model=LLM_MODEL, temperature=0, reasoning_format=\"hidden\")"
    },
    {
      "id": "synthesize_answer",
      "name": "synthesize_answer() — Synthesis 종합",
      "fileId": "main",
      "summary": "수집된 멀티소스 검색 결과만 근거로 하나의 종합 답변을 생성하는 함수.",
      "how": "먼저 모든 소스가 빈 결과면 토큰 낭비 없이 즉시 안내 문구를 돌려줌(DDG rate limit 등으로 전멸한 경우). 그렇지 않으면 format_context 로 컨텍스트를 만들고, (prompt | llm | StrOutputParser) LCEL 체인에 컨텍스트·질문을 주입해 답을 만듦. 시스템 프롬프트로 '검색 결과에 있는 내용만 근거로, 출처를 함께' 답하라 제약해 환각을 줄임.",
      "terms": [
        "Synthesis(종합)",
        "LCEL",
        "파이프(|)",
        "ChatPromptTemplate",
        "StrOutputParser",
        "invoke",
        "프롬프트"
      ],
      "lines": [
        {
          "at": "def synthesize_answer(query: str, collected: dict[str, list[dict]], llm) -> str:",
          "text": "멀티소스 결과를 근거로 종합 답변을 만드는 함수 정의."
        },
        {
          "at": "if not any(collected.values()):",
          "text": "모든 소스가 빈 결과면 LLM을 부르지 않고 즉시 안내 문구를 돌려줌."
        },
        {
          "at": "context = format_context(collected)",
          "text": "소스별 결과를 하나의 컨텍스트 문자열로 합침."
        },
        {
          "at": "prompt = ChatPromptTemplate.from_messages(",
          "text": "system(제약)+human(검색결과·질문) 메시지로 프롬프트를 구성."
        },
        {
          "at": "(\"system\", SYNTHESIS_SYSTEM_PROMPT),",
          "text": "검색 결과만 근거로 출처와 함께 답하라는 종합 제약을 넣음."
        },
        {
          "at": "chain = prompt | llm | StrOutputParser()",
          "text": "프롬프트→LLM→문자열 추출을 파이프로 잇는 LCEL 체인을 만듦."
        },
        {
          "at": "return chain.invoke({\"context\": context, \"question\": query})",
          "text": "컨텍스트·질문을 넣어 체인을 실행하고 종합 답변 문자열을 돌려줌."
        }
      ],
      "code": "def synthesize_answer(query: str, collected: dict[str, list[dict]], llm) -> str:\n    \"\"\"수집된 멀티소스 검색 결과를 근거로 종합 답변을 생성함.\n\n    (prompt | llm | StrOutputParser) LCEL 체인에 컨텍스트·질문을 주입함.\n    검색 결과가 하나도 없으면 LLM을 호출하지 않고 안내 메시지를 반환함.\n    \"\"\"\n    from langchain_core.output_parsers import StrOutputParser\n    from langchain_core.prompts import ChatPromptTemplate\n\n    # 모든 소스가 빈 결과면 토큰 낭비 없이 즉시 안내 (DDG rate limit 등으로 전멸한 경우)\n    if not any(collected.values()):\n        return \"선택된 소스에서 관련 정보를 찾지 못했습니다. 질문을 바꾸거나 잠시 후 다시 시도해 주세요.\"\n\n    context = format_context(collected)\n    prompt = ChatPromptTemplate.from_messages(\n        [\n            (\"system\", SYNTHESIS_SYSTEM_PROMPT),\n            (\"human\", \"[검색 결과]\\n{context}\\n\\n[질문]\\n{question}\\n\\n[답변]\"),\n        ]\n    )\n    # StrOutputParser: LLM의 AIMessage 응답에서 본문 텍스트만 추출함\n    chain = prompt | llm | StrOutputParser()\n    return chain.invoke({\"context\": context, \"question\": query})"
    },
    {
      "id": "print_result",
      "name": "print_result() — 결과 출력",
      "fileId": "main",
      "summary": "질문·라우팅 결정·종합 답변·소스별 출처를 보기 좋게 콘솔에 출력하는 함수.",
      "how": "구분선과 함께 ① 질문 ② 라우팅이 고른 소스(decision.sources)와 그 이유(reasoning) ③ 종합 답변 ④ 소스별로 몇 건을 어디서 가져왔는지(라벨·건수·각 항목의 제목 일부·링크)를 차례로 출력함. 어떤 소스를 왜 골랐고 무엇을 근거로 답했는지 투명하게 보여 주는 것이 멀티소스 RAG의 신뢰성 장점임.",
      "terms": [
        "Query Router(질문 라우팅)",
        "RouteDecision",
        "SOURCE_REGISTRY",
        "Synthesis(종합)"
      ],
      "lines": [
        {
          "at": "def print_result(query: str, decision: RouteDecision, collected: dict[str, list[dict]], answer: str) -> None:",
          "text": "질문·라우팅·답변·출처를 콘솔에 출력하는 함수 정의."
        },
        {
          "at": "print(f\"[질문] {query}\")",
          "text": "사용자 질문을 출력."
        },
        {
          "at": "print(f\"[라우팅] 선택 소스: {decision.sources}\")",
          "text": "라우터가 고른 소스 목록을 출력."
        },
        {
          "at": "print(f\"[라우팅] 이유: {decision.reasoning}\")",
          "text": "그 소스들을 고른 이유를 출력."
        },
        {
          "at": "print(f\"[답변]\\n{answer}\")",
          "text": "종합된 최종 답변을 출력."
        },
        {
          "at": "print(\"[검색 출처]\")",
          "text": "소스별 출처 목록의 시작을 알림."
        },
        {
          "at": "print(f\"    [{index}] {item['title'][:50]} | {item['link']}\")",
          "text": "각 항목의 제목 일부와 링크를 한 줄씩 출력."
        }
      ],
      "code": "def print_result(query: str, decision: RouteDecision, collected: dict[str, list[dict]], answer: str) -> None:\n    \"\"\"질의어·라우팅 결정·종합 답변·소스별 출처를 보기 좋게 콘솔에 출력함.\"\"\"\n    print(\"\\n\" + \"=\" * 70)\n    print(f\"[질문] {query}\")\n    print(\"=\" * 70)\n    print(f\"[라우팅] 선택 소스: {decision.sources}\")\n    print(f\"[라우팅] 이유: {decision.reasoning}\")\n    print(\"-\" * 70)\n    print(f\"[답변]\\n{answer}\")\n    print(\"\\n\" + \"-\" * 70)\n    print(\"[검색 출처]\")\n    for source, results in collected.items():\n        label = SOURCE_REGISTRY[source][2]\n        print(f\"  · {label}: {len(results)}건\")\n        for index, item in enumerate(results, start=1):\n            print(f\"    [{index}] {item['title'][:50]} | {item['link']}\")\n    print(\"=\" * 70)"
    },
    {
      "id": "main",
      "name": "main() / __main__ — 메인 파이프라인",
      "fileId": "main",
      "summary": "라우팅 → 소스별 검색 → 종합 → 출력 순으로 멀티소스 RAG 전체를 실행하는 진입부.",
      "how": "전체 흐름을 지휘함. ① 명령줄 인자가 있으면 질의어로, 없으면 기본 질의어를 씀. ② [1/3] create_router_llm·route_query 로 소스 선택+검색어 생성. ③ [2/3] dispatch_searches 로 선택된 소스만 검색. ④ [3/3] create_synthesis_llm·synthesize_answer 로 종합. ⑤ print_result 로 출력. 맨 아래 if __name__ 관용구로 직접 실행 시에만 main 을 부르고, 실행 중 오류는 잡아 메시지를 내고 비정상 종료 코드로 빠져나감.",
      "terms": [
        "멀티소스 RAG",
        "Query Router(질문 라우팅)",
        "Synthesis(종합)",
        "if __name__ == \"__main__\""
      ],
      "lines": [
        {
          "at": "def main() -> None:",
          "text": "멀티소스 RAG 전체를 실행하는 진입점 함수 정의."
        },
        {
          "at": "query = \" \".join(sys.argv[1:]).strip() or DEFAULT_QUERY",
          "text": "명령줄 인자가 있으면 질의어로, 없으면 기본 질의어를 사용."
        },
        {
          "at": "router_llm = create_router_llm()",
          "text": "[1/3] 라우팅 전용 LLM을 만듦."
        },
        {
          "at": "decision = route_query(query, router_llm)",
          "text": "[1/3] 질문을 분석해 소스 선택+소스별 검색어를 얻음."
        },
        {
          "at": "collected = dispatch_searches(decision)",
          "text": "[2/3] 선택된 소스만 각자의 검색어로 검색해 결과를 모음."
        },
        {
          "at": "synthesis_llm = create_synthesis_llm()",
          "text": "[3/3] 종합 답변용 LLM을 만듦."
        },
        {
          "at": "answer = synthesize_answer(query, collected, synthesis_llm)",
          "text": "[3/3] 모은 결과를 근거로 종합 답변을 생성."
        },
        {
          "at": "print_result(query, decision, collected, answer)",
          "text": "질문·라우팅·답변·출처를 콘솔에 출력."
        },
        {
          "at": "if __name__ == \"__main__\":",
          "text": "이 파일을 직접 실행할 때만 main()을 수행하는 관용구."
        },
        {
          "at": "print(f\"\\n[오류] 멀티소스 RAG 실행 실패: {error}\", file=sys.stderr)",
          "text": "실행 중 오류를 잡아 명확히 출력하고 비정상 종료로 빠져나감."
        }
      ],
      "code": "def main() -> None:\n    \"\"\"라우팅 → 소스별 검색 → 종합 → 출력 순으로 멀티소스 RAG를 실행함.\"\"\"\n    # 명령줄 인자가 있으면 질의어로 사용하고, 없으면 기본 질의어를 사용함\n    query = \" \".join(sys.argv[1:]).strip() or DEFAULT_QUERY\n\n    print(\"[1/3] Query Router: 질문 분석 → 소스 선택 + 소스별 검색어 생성\")\n    router_llm = create_router_llm()\n    decision = route_query(query, router_llm)\n    print(f\"  - 선택 소스: {decision.sources}\")\n\n    print(\"[2/3] 멀티소스 검색 (선택된 소스만)\")\n    collected = dispatch_searches(decision)\n\n    print(\"[3/3] Synthesis: 검색 결과 종합 답변 생성\")\n    synthesis_llm = create_synthesis_llm()\n    answer = synthesize_answer(query, collected, synthesis_llm)\n\n    print_result(query, decision, collected, answer)\n\n\n# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)\nif __name__ == \"__main__\":\n    try:\n        main()\n    except Exception as error:\n        # 실행 중 오류를 명확히 출력하고 비정상 종료 코드로 빠져나감\n        print(f\"\\n[오류] 멀티소스 RAG 실행 실패: {error}\", file=sys.stderr)\n        sys.exit(1)"
    }
  ],
  "glossary": {
    "멀티소스 RAG": "Multi-Source RAG. 한 질문을 여러 종류의 정보원(이 예제는 특허법 벡터DB·웹·YouTube)에서 검색해 하나의 답으로 종합하는 RAG. 질문에 맞는 소스를 골라(라우팅) 소스별 검색어를 다시 쓴 뒤 검색·종합함.",
    "RAG": "Retrieval-Augmented Generation. 외부 자료에서 관련 내용을 먼저 찾아(검색) 그 근거로 LLM이 답하게 하는 방식. 모델이 모르는 전문·최신 정보도 자료만 있으면 답할 수 있게 함.",
    "Query Router(질문 라우팅)": "질문을 분석해 '어느 소스에서 검색할지'를 LLM이 스스로 정하는 단계. 법률 질문은 벡터DB, 최신정보는 웹, 강의는 YouTube로 보내며, 한 질문이 여러 의도면 복수 소스를 고름.",
    "Query Rewriting(검색어 재작성)": "같은 질문이라도 소스마다 잘 통하는 검색어가 다르므로, 소스별로 검색어를 다시 쓰는 것. 이 예제는 웹은 연도/시간 표현을 빼고, 유튜브는 쉼표 없는 짧은 키워드로 바꿈.",
    "Synthesis(종합)": "여러 소스에서 모은 검색 결과를 근거로, 소스를 구분하면서도 자연스럽게 하나의 답으로 통합하는 마지막 단계. 검색 결과에 없는 내용은 지어내지 않도록 제약함.",
    "RouteDecision": "라우터가 채워 답하는 Pydantic 양식(스키마). 검색할 소스 목록(sources)·소스별 재작성 검색어(vectorstore_query/web_query/youtube_query)·선택 이유(reasoning)를 한 번에 담음.",
    "with_structured_output": "LLM 응답을 자유 문장이 아니라 지정한 Pydantic 스키마(JSON)로 강제해 안정적으로 파싱하게 하는 LangChain 기능. 이 예제는 라우팅 결정을 RouteDecision 양식으로 받는 데 씀.",
    "Literal": "파이썬 typing의 도구. 값으로 받을 수 있는 문자열을 '정해진 몇 가지'로만 제한함. 이 예제는 소스명을 vectorstore/web/youtube 셋으로만 막아 잘못된 소스명을 차단함.",
    "Pydantic": "파이썬에서 데이터의 '형식(스키마)'을 클래스로 정의하고 검증하는 라이브러리. 여기서는 LLM이 정해진 칸을 채워 답하도록 양식(RouteDecision)을 정하는 데 사용.",
    "SOURCE_REGISTRY": "소스명을 (검색 함수, RouteDecision의 검색어 속성명, 한글 라벨)로 이어 주는 매핑표. 소스마다 if 분기를 길게 쓰지 않고 표만 보고 검색·출력을 처리하게 해 줌.",
    "getattr": "파이썬 내장 함수. 객체의 속성을 '이름 문자열'로 꺼냄(예: getattr(decision, \"web_query\")는 decision.web_query와 같음). 소스마다 다른 검색어 속성을 동적으로 꺼낼 때 사용.",
    "DuckDuckGo": "추적 없이 쓰는 웹 검색 엔진. API 키 없이 검색할 수 있어 예제의 '최신 정보' 소스로 사용함. 다만 짧은 시간에 요청이 많으면 일시 차단(Rate limit)될 수 있음.",
    "DuckDuckGoSearchAPIWrapper": "DuckDuckGo 검색을 LangChain에서 다루기 쉽게 감싼 유틸. results()를 쓰면 제목·요약뿐 아니라 출처 링크(link)까지 받을 수 있어 출처 표기에 유리함.",
    "YouTube Data API v3": "구글이 제공하는 YouTube 공식 검색·조회 API. 영상 검색·메타데이터 조회 등을 할 수 있으며, 사용하려면 YOUTUBE_API_KEY가 필요하고 하루 사용량(할당량) 제한이 있음.",
    "build()": "google-api-python-client의 함수로, 'youtube'·'v3'·API 키를 주면 YouTube Data API v3에 요청을 보낼 수 있는 클라이언트 객체를 만들어 줌.",
    "html.unescape": "&#39;·&amp; 같은 HTML 엔티티(특수문자 표기)를 사람이 읽는 보통 글자(' · &)로 되돌리는 파이썬 표준 함수. YouTube 제목/설명에 섞여 오는 엔티티를 정리하는 데 사용.",
    "reasoning_format": "Groq의 추론 모델(gpt-oss-120b)에서 '사고 과정'을 어떻게 다룰지 정하는 옵션. 이 예제의 종합 LLM은 \"hidden\"으로 두어 사고 과정을 숨기고 최종 답변 텍스트만 받음.",
    "ISO 8601": "날짜·시각을 적는 국제 표준 형식(예: 2025-05-30T12:00:00Z). YouTube의 publishedAfter는 이 형식을 요구하므로, 최근 1년 경계 시각을 이 형식으로 만들어 넘김.",
    "graceful degradation": "일부 기능(예: 웹·YouTube 검색)이 실패해도 전체를 멈추지 않고, 그 부분만 빈 결과로 처리해 나머지로 계속 동작하게 하는 설계. 외부 서비스 장애에 견디게 해 줌.",
    "RECENT_DAYS": "웹·YouTube 검색을 최근 며칠 이내로 제한할지 정한 상수. 이 예제에서는 365(최근 1년)로, 오래된 정보 대신 최신 정보를 우선 받게 함.",
    "TOP_K": "벡터DB 유사도 검색에서 가져올 상위 청크 개수를 정한 상수. 이 예제에서는 5.",
    "임베딩": "텍스트를 의미가 담긴 숫자 벡터(여러 숫자의 나열)로 바꾼 것. 뜻이 비슷한 글은 벡터도 가깝게 위치해, 컴퓨터가 '비슷한 내용'을 계산으로 찾을 수 있음.",
    "벡터 DB": "임베딩(숫자 벡터)을 저장하고, 질문 벡터와 가장 가까운 것들을 빠르게 찾아 주는 데이터베이스. 여기서는 ChromaDB를 사용함.",
    "ChromaDB": "오픈소스 벡터 데이터베이스. 임베딩을 저장하고 유사도 검색을 해 줌. 로컬 폴더에 영속화(저장)되어 재실행 시 그대로 재사용 가능.",
    "Chroma": "ChromaDB를 LangChain에서 다루는 래퍼 클래스. 여기서는 from_documents(신규 생성)가 아니라 생성자로 기존 컬렉션을 '연결'만 함.",
    "컬렉션": "벡터 DB 안에서 벡터들을 묶어 두는 단위(여기서는 patent_law). 인덱싱과 검색이 같은 컬렉션 이름을 써야 검색이 됨.",
    "영속화": "persist. 메모리에만 두지 않고 디스크 폴더에 저장해, 프로그램을 껐다 켜도 데이터가 남아 재사용되게 하는 것.",
    "청크": "chunk. 긴 문서를 검색하기 좋게 잘게 나눈 한 조각. 이 예제는 이미 나뉘어 저장된 청크를 검색해서 사용함.",
    "metadata": "청크에 딸린 부가정보(예: 출처 파일명 source, 청크 번호 chunk_index). 답변의 출처를 표시하는 데 사용함.",
    "OpenAIEmbeddings": "OpenAI 임베딩 모델 호출 래퍼. 텍스트를 숫자 벡터로 변환함. 여기서는 질의(질문)를 벡터로 바꾸는 데 사용.",
    "text-embedding-3-small": "OpenAI의 임베딩 모델 이름(1536차원). 인덱싱 때 쓴 모델과 검색 때 쓰는 모델이 같아야 의미 공간이 맞아 검색이 됨.",
    "retriever": "검색기. 벡터 DB에서 질문과 가장 비슷한 청크 몇 개(top-k)를 찾아 돌려주는 역할.",
    "as_retriever": "벡터 저장소(vectorstore)를 검색기(retriever) 객체로 바꿔 주는 메서드. 유사도 상위 몇 개를 가져올지 등을 설정함.",
    "유사도 검색": "similarity search. 질문 벡터와 문서 벡터의 '가까운 정도'를 계산해 가장 가까운 것부터 찾는 검색 방식.",
    "ChatGroq": "Groq 클라우드의 채팅 LLM을 호출하는 LangChain 래퍼. GROQ_API_KEY를 자동 참조함.",
    "Groq LPU": "Groq사가 만든 LLM 추론 전용 칩(Language Processing Unit). 매우 빠른 응답 속도가 특징.",
    "gpt-oss-120b": "Groq LPU에서 서빙하는 오픈 가중치 LLM(약 1200억 파라미터). 이 예제의 라우팅·종합 모델.",
    "temperature": "LLM 답변의 무작위성 정도. 0에 가까울수록 매번 비슷하고 일관된(보수적인) 답을 냄. 이 예제는 0으로 고정해 라우팅·답변을 재현 가능하게 함.",
    "ChatPromptTemplate": "LLM에 보낼 프롬프트(지시문)의 틀. {context}·{question} 같은 빈칸에 실제 값을 채워 완성된 프롬프트를 만듦.",
    "프롬프트": "LLM에게 주는 지시문. 이 예제는 라우터용·종합용으로 서로 다른 시스템 프롬프트를 씀.",
    "LCEL": "LangChain Expression Language. 파이프 기호(|)로 단계들을 왼쪽→오른쪽으로 연결해 하나의 처리 흐름(체인)을 만드는 문법.",
    "파이프(|)": "LCEL에서 앞 단계의 결과를 다음 단계의 입력으로 흘려보내는 연결 기호. 'prompt | llm | parser'처럼 씀.",
    "StrOutputParser": "LLM 응답 객체에서 사람이 읽을 본문 문자열만 깔끔히 뽑아 주는 출력 파서.",
    "invoke": "LangChain 체인/검색기/모델을 '실행'하는 메서드. 입력을 넣으면 끝까지 돌려 결과를 돌려줌.",
    "load_dotenv": ".env 파일에 적어 둔 비밀값(예: OPENAI_API_KEY, GROQ_API_KEY, YOUTUBE_API_KEY)을 프로그램의 환경변수로 불러오는 함수.",
    "from __future__ import annotations": "타입 힌트를 즉시 평가하지 않고 문자열로 두게 하는 파이썬 선언. 순환 참조 없이 가볍게 타입 힌트를 쓰게 해 줌.",
    "Path(__file__).resolve().parent": "지금 이 파이썬 파일이 있는 폴더의 절대경로를 구하는 관용구. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "if __name__ == \"__main__\"": "이 파일을 직접 실행할 때만 특정 코드를 돌리고, 다른 곳에서 import할 때는 돌리지 않게 하는 파이썬 관용구.",
    "API 키 검사": "필요한 API 키가 환경변수에 없으면 실행 초기에 명확한 오류를 내는 패턴. 한참 뒤에 엉뚱한 곳에서 실패하는 것을 막아 디버깅을 쉽게 함."
  }
};
