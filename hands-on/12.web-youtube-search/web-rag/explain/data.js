window.EXPLAIN_DATA = {
  "meta": {
    "title": "질문 라우팅 RAG — 특허법은 벡터DB로, 최신 트렌드는 웹검색으로",
    "entry": "app.py"
  },
  "files": [
    {
      "id": "main",
      "label": "app.py",
      "role": "질문을 LLM으로 분류(라우팅)해 특허법 질문은 벡터 DB로, 최신 트렌드 질문은 DuckDuckGo 웹검색으로 보내 답하는 멀티소스 RAG 전체"
    }
  ],
  "flow": [
    {
      "step": 1,
      "title": "실행 & 환경 준비",
      "label": "실행·환경 준비",
      "refs": ["setup", "env_load"],
      "summary": "python app.py 로 실행하고, .env 의 API 키와 한글 인코딩을 준비함",
      "detail": "터미널에서 'python app.py'(대화형 입력) 또는 'python app.py \"질문\"'(인자로 바로 질의)로 시작함. 시작과 동시에 load_dotenv() 가 hands-on/.env 에 적어 둔 OPENAI_API_KEY(질의 임베딩용)와 GROQ_API_KEY(LLM용)를 읽어 둠. 윈도우 콘솔에서 한글이 깨지지 않게 표준출력·표준입력을 UTF-8로 맞추는 처리도 함. 비유하면, 안내 데스크 직원(앱)이 출근해 두 개의 열쇠(검색 열쇠·답변 열쇠)를 챙기고 한글 명패를 켜 두는 단계."
    },
    {
      "step": 2,
      "title": "벡터 DB 로드 + LLM 생성",
      "label": "벡터 DB·LLM 준비",
      "refs": ["load_retriever", "create_llm"],
      "summary": "공용 특허법 벡터 DB를 검색 전용으로 연결하고, 라우팅·답변 공용 LLM을 만듦",
      "detail": "이 예제는 PDF를 새로 읽거나 쪼개지 않음. 그 작업(인덱싱)은 10.rag/indexing 이 미리 해 두었고, 여기서는 결과물인 공용 ChromaDB(컬렉션 patent_law)를 재임베딩 없이 연결만 함. 그다음 질문 분류(라우팅)와 최종 답변을 모두 맡을 Groq LLM(gpt-oss-120b)을 하나 만듦. 비유하면, 정리된 특허법 서가에 접근 권한을 얻고, '안내도 하고 답변도 쓰는' 만능 직원 한 명을 채용하는 것."
    },
    {
      "step": 3,
      "title": "질문 라우팅 (patent / web, 폴백)",
      "label": "질문 라우팅",
      "refs": ["route_query", "keyword_route"],
      "summary": "질문을 보고 '특허법인가, 최신 트렌드인가'를 LLM이 한 단어로 분류함",
      "detail": "Query Routing 단계임. LLM에게 'patent 또는 web 한 단어로만 답하라'고 시켜 질문 유형을 가름. patent=대한민국 특허법 질문, web=최신 트렌드·뉴스처럼 실시간 웹 정보가 필요한 질문. 만약 LLM 답이 모호하면(둘 다 포함하거나 둘 다 없음) 키워드 휴리스틱(특허·출원·발명 같은 단어가 있나 검사)으로 폴백해 항상 둘 중 하나를 보장함. 비유하면, 안내 데스크가 손님 질문을 듣고 '법률 자료실로 갈지, 인터넷 검색대로 갈지'를 정해 주는 것."
    },
    {
      "step": 4,
      "title": "선택된 소스 검색",
      "label": "선택 소스 검색",
      "refs": ["search_vectordb", "search_web"],
      "summary": "patent면 벡터 DB에서 유사 청크를, web이면 DuckDuckGo에서 최신 결과를 가져옴",
      "detail": "라우팅 결과에 따라 한쪽만 검색함. patent면 질문을 임베딩해 의미가 가까운 특허법 청크 상위 5개(top-k)를 꺼냄. web이면 DuckDuckGo로 최근 1년·상위 5건 결과(제목·요약·링크)를 가져옴(API 키 불필요). 웹검색은 일시적 오류가 날 수 있어 실패해도 빈 결과로 처리하고 경고만 남김. 비유하면, 안내받은 손님이 법률 자료실 책장 또는 인터넷 검색대 중 한 곳에서만 자료를 모아 오는 것."
    },
    {
      "step": 5,
      "title": "컨텍스트 → 프롬프트 → 답변 생성",
      "label": "컨텍스트·답변 생성",
      "refs": ["answer_query", "format_patent_docs", "format_web_results"],
      "summary": "검색 결과를 글로 정리해 소스별 프롬프트에 넣고 LLM이 답을 작성함",
      "detail": "검색 결과(문서 또는 웹 결과)를 각각 출처 라벨이 붙은 하나의 글(컨텍스트)로 합침. 그다음 소스에 맞는 시스템 프롬프트(특허법용/웹검색용)를 골라 'prompt | llm | StrOutputParser' 파이프 체인으로 답변을 생성함. 특허법은 문서 근거만으로, 웹은 출처 URL을 함께 인용하도록 지시함. 비유하면, 모아 온 자료를 깔끔히 묶어 직원에게 건네며 '이 자료만 근거로, 출처를 밝혀서 답을 써 달라'고 부탁하는 것."
    },
    {
      "step": 6,
      "title": "결과·출처 출력",
      "label": "결과·출처 출력",
      "refs": ["print_result"],
      "summary": "질문·선택된 소스·답변·검색 출처를 보기 좋게 콘솔에 출력함",
      "detail": "print_result 가 어떤 질문이 어느 소스(특허법 벡터 DB / 웹검색)로 갔는지, 생성된 답변, 그리고 근거가 된 출처 목록을 표 형태로 보여 줌. patent면 파일명·청크 번호와 본문 미리보기를, web이면 제목과 URL을 표시함. 어떤 소스를 썼는지 투명하게 드러내는 것이 멀티소스 RAG의 신뢰성 장점임. 비유하면, 답안과 함께 '어느 자료실에서 어떤 자료를 참고했는지' 출처 목록을 같이 제출하는 것."
    }
  ],
  "functions": [
    {
      "id": "setup",
      "name": "임포트·인코딩·경로 설정",
      "fileId": "main",
      "summary": "필요한 모듈을 가져오고, 한글 출력·입력을 UTF-8로 맞추고, 파일 위치 기준으로 경로를 잡는 준비 코드.",
      "how": "함수가 아니라 파일 위쪽의 준비 코드 모음임. ① from __future__ import annotations 로 타입 힌트를 가볍게 씀. ② 윈도우 콘솔에서 한글이 깨지지 않도록 표준출력(stdout)과 표준입력(stdin)을 모두 UTF-8로 다시 설정함(대화형에서 한글 질문을 정상적으로 읽기 위함). ③ 모든 경로를 이 파일 위치(__file__) 기준으로 계산해 어디서 실행해도 같은 공용 벡터 DB(../../10.rag/vectordb)와 .env(hands-on/.env)를 가리키게 함.",
      "terms": [
        "from __future__ import annotations",
        "reconfigure",
        "EOFError",
        "대화형 입력",
        "Path(__file__).resolve().parent"
      ],
      "lines": [
        {
          "at": "from __future__ import annotations",
          "text": "타입 힌트를 문자열로 평가해 가볍게 쓰게 하는 파이썬 설정."
        },
        {
          "at": "sys.stdout.reconfigure(encoding",
          "text": "윈도우 콘솔에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 바꿈."
        },
        {
          "at": "sys.stdin.reconfigure(encoding",
          "text": "대화형 입력에서 한글 질문을 정상적으로 읽도록 표준입력도 UTF-8로 바꿈."
        },
        {
          "at": "SCRIPT_DIR = Path(__file__)",
          "text": "이 파일이 있는 폴더(web-rag/)를 절대경로로 구함 — 실행 위치와 무관하게 동작."
        },
        {
          "at": "VECTORDB_DIR = HANDS_ON_DIR",
          "text": "공용 특허법 ChromaDB가 저장된 폴더(../../10.rag/vectordb)를 가리킴."
        },
        {
          "at": "ENV_PATH = HANDS_ON_DIR",
          "text": "API 키가 든 hands-on/.env 파일 경로를 잡음."
        }
      ],
      "code": "from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함\n\nimport sys\nfrom pathlib import Path\n\n# Windows 콘솔 기본 인코딩(cp949)에서 한글이 깨지지 않도록 표준출력·표준입력을 UTF-8로 재설정함\n# (대화형 입력에서 한글 질문을 정상적으로 읽기 위해 stdin도 함께 재설정함)\nif hasattr(sys.stdout, \"reconfigure\"):\n    sys.stdout.reconfigure(encoding=\"utf-8\")\nif hasattr(sys.stdin, \"reconfigure\"):\n    sys.stdin.reconfigure(encoding=\"utf-8\")\n\n# ---------------------------------------------------------------------------\n# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)\n# ---------------------------------------------------------------------------\nSCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(web-rag/)를 절대경로로 구함\nHANDS_ON_DIR = SCRIPT_DIR.parent.parent          # hands-on/ (12.web-youtube-search의 부모의 부모)\nVECTORDB_DIR = HANDS_ON_DIR / \"10.rag\" / \"vectordb\"  # 특허법 공용 ChromaDB 영속화 디렉터리 (재임베딩 없이 로드)\nENV_PATH = HANDS_ON_DIR / \".env\"                 # hands-on/.env (API 키 보관)"
    },
    {
      "id": "env_load",
      "name": "환경변수 로드 (load_dotenv)",
      "fileId": "main",
      "summary": ".env 파일에 적어 둔 API 키를 프로그램의 환경변수로 불러오는 부분.",
      "how": "import load_dotenv 로 도구를 가져온 뒤, ENV_PATH(hands-on/.env)를 지정해 호출하면 그 파일에 적힌 OPENAI_API_KEY(질의 임베딩용)와 GROQ_API_KEY(LLM용)가 프로그램의 환경변수로 올라감. 이후 OpenAIEmbeddings·ChatGroq 가 이 환경변수를 자동으로 참조함.",
      "terms": [
        "load_dotenv",
        "환경변수",
        "API 키"
      ],
      "lines": [
        {
          "at": "from dotenv import load_dotenv",
          "text": ".env 파일을 읽어 환경변수로 올려 주는 도구를 가져옴."
        },
        {
          "at": "load_dotenv(ENV_PATH)",
          "text": ".env 에서 OPENAI_API_KEY·GROQ_API_KEY 를 실제로 읽어 환경변수로 올림."
        }
      ],
      "code": "from dotenv import load_dotenv\n\nload_dotenv(ENV_PATH)  # .env에서 OPENAI_API_KEY(질의 임베딩)·GROQ_API_KEY(LLM)를 로드함"
    },
    {
      "id": "constants",
      "name": "상수·예시 질문 정의",
      "fileId": "main",
      "summary": "컬렉션명·모델명·검색 개수 등 핵심 상수와, 대화형에서 보여줄 소스별 예시 질문을 정함.",
      "how": "프로그램 전반에서 쓰는 값들을 한곳에 모아 둠. ① COLLECTION_NAME·EMBEDDING_MODEL 은 인덱싱과 반드시 같아야 검색이 됨. ② LLM_MODEL·TOP_K 는 LLM 이름과 벡터 검색 개수. ③ WEB_REGION·WEB_TIME·WEB_MAX_RESULTS 는 DuckDuckGo 웹검색 설정(한국어·최근 1년·상위 5건). ④ DEFAULT_QUERY 는 대화형에서 빈 입력 시 쓸 기본 질문. ⑤ PATENT_EXAMPLES·WEB_EXAMPLES 는 어떤 질문이 어느 소스로 가는지 학습용으로 보여줄 예시 질문 묶음.",
      "terms": [
        "컬렉션",
        "text-embedding-3-small",
        "TOP_K",
        "DuckDuckGo",
        "웹검색",
        "DEFAULT_QUERY"
      ],
      "lines": [
        {
          "at": "COLLECTION_NAME = \"patent_law\"",
          "text": "검색할 벡터 DB의 컬렉션 이름 — 인덱싱 때와 같아야 함."
        },
        {
          "at": "EMBEDDING_MODEL =",
          "text": "질의를 벡터로 바꿀 임베딩 모델 — 인덱싱 때와 반드시 동일(1536차원)."
        },
        {
          "at": "LLM_MODEL =",
          "text": "라우팅·답변을 모두 맡을 LLM(Groq의 gpt-oss-120b) 이름."
        },
        {
          "at": "TOP_K = 5",
          "text": "벡터 DB에서 가져올 비슷한 청크 개수를 5개로 정함(top-k)."
        },
        {
          "at": "WEB_TIME = \"y\"",
          "text": "DuckDuckGo 시간 필터 — \"y\"=최근 1년 결과만 받아 최신성을 확보."
        },
        {
          "at": "WEB_MAX_RESULTS = 5",
          "text": "웹검색에서 가져올 상위 결과 개수를 5건으로 정함."
        },
        {
          "at": "DEFAULT_QUERY =",
          "text": "대화형에서 빈 입력이 들어오면 사용할 기본 특허법 질문."
        },
        {
          "at": "PATENT_EXAMPLES = (",
          "text": "벡터 DB로 갈 특허법 예시 질문 묶음(요건·절차·침해 구제 등)."
        },
        {
          "at": "WEB_EXAMPLES = (",
          "text": "웹검색으로 갈 최신 트렌드 예시 질문 묶음(동향·뉴스 등)."
        }
      ],
      "code": "COLLECTION_NAME = \"patent_law\"               # 특허법 벡터 DB 컬렉션명 (인덱싱과 동일해야 검색 가능)\nEMBEDDING_MODEL = \"text-embedding-3-small\"   # 질의 임베딩 모델 (인덱싱과 반드시 동일, 1536차원)\nLLM_MODEL = \"openai/gpt-oss-120b\"            # Groq LPU에서 서빙하는 라우팅·답변 생성용 LLM\nTOP_K = 5                                    # 벡터 DB 유사도 검색으로 가져올 상위 청크 수\nWEB_REGION = \"ko-kr\"                         # DuckDuckGo 검색 지역 (한국어 우선)\nWEB_TIME = \"y\"                               # DuckDuckGo 시간 필터 (\"y\"=최근 1년, 최신성 확보)\nWEB_MAX_RESULTS = 5                          # DuckDuckGo 최신 결과 개수 (상위 5건으로 답변 생성)\nDEFAULT_QUERY = \"특허를 받을 수 있는 조건은 ?\"  # 대화형에서 빈 입력 시 사용할 기본 질의어(특허법)\n\n# 대화형 입력에서 사용자에게 보여줄 소스별 예시 질문 (어떤 질문이 어느 소스로 가는지 학습용)\n# 웹검색 예시에는 PATENT_KEYWORDS가 섞이지 않도록 해 라우팅이 라벨과 일치하게 함\nPATENT_EXAMPLES = (\n    \"특허를 받기 위한 요건은 무엇인가요?\",\n    \"특허 출원 절차는 어떻게 되나요?\",\n    \"특허권 침해에 대한 구제 방법은?\",\n)\nWEB_EXAMPLES = (\n    \"2025년 최신 AI 에이전트 트렌드는?\",\n    \"요즘 주목받는 RAG 프레임워크는?\",\n    \"최근 LLM 모델 동향을 알려줘\",\n)"
    },
    {
      "id": "prompts",
      "name": "라우팅·키워드·프롬프트 상수",
      "fileId": "main",
      "summary": "폴백용 특허 키워드 목록과, 라우터·특허법·웹검색 시스템 프롬프트, 휴먼 프롬프트 틀을 정의함.",
      "how": "이 프로그램의 '지시문(프롬프트)'들을 모아 둠. ① PATENT_KEYWORDS: LLM 분류가 모호할 때 쓰는 폴백 휴리스틱용 단어 목록(특허·출원·발명 등). ② ROUTER_SYSTEM_PROMPT: 질문을 patent/web 한 단어로만 분류하라는 라우팅 지시(파싱을 단순화). ③ PATENT_SYSTEM_PROMPT: 특허법 문서 근거로만 답하라는 지시. ④ WEB_SYSTEM_PROMPT: 웹검색 결과 근거로 답하고 출처 URL을 인용하라는 지시. ⑤ HUMAN_PROMPT·WEB_HUMAN_PROMPT: 컨텍스트와 질문을 끼워 넣는 사용자 메시지 틀.",
      "terms": [
        "키워드 휴리스틱(폴백)",
        "Query Routing(질문 라우팅)",
        "프롬프트",
        "환각",
        "웹검색"
      ],
      "lines": [
        {
          "at": "PATENT_KEYWORDS = (",
          "text": "LLM 분류가 모호할 때 폴백으로 검사할 특허 관련 단어 목록."
        },
        {
          "at": "ROUTER_SYSTEM_PROMPT = (",
          "text": "질문을 patent 또는 web 한 단어로만 분류하라는 라우팅 지시문."
        },
        {
          "at": "PATENT_SYSTEM_PROMPT = (",
          "text": "특허법 [참고 문서]에 있는 내용만 근거로 답하라는 지시문(환각 방지)."
        },
        {
          "at": "WEB_SYSTEM_PROMPT = (",
          "text": "웹 검색 결과를 근거로 답하고 출처 URL을 인용하라는 지시문."
        },
        {
          "at": "HUMAN_PROMPT = \"[참고",
          "text": "특허법용 사용자 메시지 틀 — 컨텍스트와 질문을 끼워 넣음."
        },
        {
          "at": "WEB_HUMAN_PROMPT = \"[웹",
          "text": "웹검색용 사용자 메시지 틀 — 웹 결과와 질문을 끼워 넣음."
        }
      ],
      "code": "# 라우팅 키워드: LLM 분류가 모호할 때 사용하는 폴백 휴리스틱\n# 질의에 특허 관련 단어가 하나라도 있으면 벡터 DB(patent)로 보냄\nPATENT_KEYWORDS = (\n    \"특허\", \"출원\", \"발명\", \"청구항\", \"심사\", \"등록\", \"침해\",\n    \"실용신안\", \"우선권\", \"명세서\", \"거절\", \"무효\", \"특허청\", \"특허법\",\n)\n\n# 질문을 두 소스 중 하나로 분류하도록 지시하는 라우팅 프롬프트\n# 응답을 한 단어(patent/web)로 강제해 파싱을 단순화함\nROUTER_SYSTEM_PROMPT = (\n    \"당신은 질문을 분석해 검색 소스를 고르는 라우터임. \"\n    \"다음 두 단어 중 하나로만 답할 것: patent 또는 web. \"\n    \"patent = 대한민국 특허법 관련 질문(특허 요건·출원 절차·발명·청구항·심사·침해 등). \"\n    \"web = 최신 트렌드·동향·뉴스·최근 기술처럼 실시간 웹 정보가 필요한 질문. \"\n    \"설명 없이 patent 또는 web 한 단어만 출력할 것.\"\n)\n\n# 특허법 벡터 DB 검색 결과에 근거해 답하도록 제약하는 RAG 프롬프트\nPATENT_SYSTEM_PROMPT = (\n    \"당신은 대한민국 특허법 문서를 근거로 답변하는 RAG 어시스턴트임. \"\n    \"반드시 아래 [참고 문서]에 있는 내용만 근거로 답변하고, 문서에 없는 내용은 추측하지 말 것. \"\n    \"근거를 찾을 수 없으면 '제공된 문서에서 관련 내용을 찾을 수 없습니다.'라고 답할 것. \"\n    \"답변은 한국어로 간결하게 작성하고, 가능하면 근거가 된 조문을 함께 언급할 것.\"\n)\n\n# 웹검색 결과에 근거해 답하도록 제약하는 RAG 프롬프트 (출처 URL 인용 요구)\nWEB_SYSTEM_PROMPT = (\n    \"당신은 웹 검색 결과를 근거로 최신 정보를 답변하는 RAG 어시스턴트임. \"\n    \"반드시 아래 [웹 검색 결과]에 있는 내용만 근거로 한국어로 간결하게 답변할 것. \"\n    \"답변 끝에 참고한 출처를 '[출처] 제목 - URL' 형식으로 함께 제시할 것. \"\n    \"검색 결과가 비어 있으면 '웹 검색 결과를 가져오지 못했습니다.'라고 답할 것.\"\n)\n\nHUMAN_PROMPT = \"[참고 문서]\\n{context}\\n\\n[질문]\\n{question}\\n\\n[답변]\"\nWEB_HUMAN_PROMPT = \"[웹 검색 결과]\\n{context}\\n\\n[질문]\\n{question}\\n\\n[답변]\""
    },
    {
      "id": "load_retriever",
      "name": "load_retriever()",
      "fileId": "main",
      "summary": "이미 만들어진 공용 특허법 ChromaDB를 재임베딩 없이 연결해 검색기(retriever)로 돌려주는 함수.",
      "how": "새로 인덱싱하지 않고, 10.rag/indexing 이 만들어 둔 영속 컬렉션을 그대로 연결함. ① OPENAI_API_KEY 가 없으면(질의 임베딩에 필요) 즉시 명확한 오류를 냄. ② 벡터 DB 폴더가 없으면 인덱싱부터 하라는 오류를 냄. ③ 인덱싱과 동일한 임베딩 모델로 OpenAIEmbeddings 를 만들고, Chroma 생성자로 영속 컬렉션에 연결함. ④ 저장된 벡터 개수가 0이면 비어 있다고 알림. ⑤ as_retriever 로 상위 TOP_K개만 반환하는 검색기를 돌려줌.",
      "terms": [
        "Chroma",
        "ChromaDB",
        "영속화",
        "컬렉션",
        "OpenAIEmbeddings",
        "text-embedding-3-small",
        "retriever",
        "as_retriever",
        "유사도 검색",
        "API 키 검사"
      ],
      "lines": [
        {
          "at": "def load_retriever",
          "text": "공용 특허법 벡터 DB를 검색 전용으로 연결하는 함수 정의."
        },
        {
          "at": "if not os.getenv(\"OPENAI_API_KEY\")",
          "text": "질의 임베딩에 OpenAI 키가 필요하므로 없으면 초기에 명확히 오류를 냄."
        },
        {
          "at": "if not VECTORDB_DIR.exists()",
          "text": "인덱싱이 먼저 돼 있어야 하므로 벡터 DB 폴더 존재를 확인함."
        },
        {
          "at": "embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)",
          "text": "인덱싱과 같은 모델로 질의 임베딩기를 준비함(차원·의미공간 일치)."
        },
        {
          "at": "vectorstore = Chroma(",
          "text": "from_documents(신규)가 아니라 영속화된 기존 컬렉션을 '연결'만 함."
        },
        {
          "at": "persist_directory=str(VECTORDB_DIR)",
          "text": "디스크에 저장된 벡터 폴더를 가리켜 재임베딩 없이 재사용."
        },
        {
          "at": "count = vectorstore._collection.count()",
          "text": "컬렉션에 저장된 벡터 개수를 셈 — 0이면 인덱싱이 비었다는 뜻."
        },
        {
          "at": "return vectorstore.as_retriever",
          "text": "유사도 상위 TOP_K개 청크만 반환하는 검색기로 바꿔 돌려줌."
        }
      ],
      "code": "def load_retriever():\n    \"\"\"특허법 공용 ChromaDB를 재임베딩 없이 로드하여 Dense Retriever를 반환함.\n\n    Chroma(...) 생성자: from_documents(신규 인덱싱)와 달리 이미 영속화된 컬렉션을 그대로 연결함.\n    embedding_function에 인덱싱과 동일한 모델을 지정해야 질의 임베딩 차원·의미 공간이 일치하여\n    유사도 검색이 정상 동작함. (\"임베딩하지 않음\"은 문서 재인덱싱을 하지 않는다는 의미이며,\n    질의 임베딩은 검색을 위해 필요함)\n    \"\"\"\n    import os\n\n    from langchain_chroma import Chroma\n    from langchain_openai import OpenAIEmbeddings\n\n    # 질의 임베딩에 OpenAI API가 필요하므로 키 부재 시 즉시 명확한 오류를 발생시킴\n    if not os.getenv(\"OPENAI_API_KEY\"):\n        raise RuntimeError(f\"OPENAI_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요\")\n\n    # 인덱싱이 선행되어야 검색 가능하므로 영속 디렉터리 존재 여부를 먼저 확인함\n    if not VECTORDB_DIR.exists():\n        raise FileNotFoundError(\n            f\"특허법 벡터 DB가 없음: {VECTORDB_DIR}\\n\"\n            f\"먼저 10.rag/indexing/indexing.py 로 인덱싱을 수행해야 함\"\n        )\n\n    # OpenAIEmbeddings: 텍스트를 1536차원 벡터로 변환 (질의 임베딩에 사용, OPENAI_API_KEY 자동 참조)\n    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)\n\n    # Chroma: 영속화된 벡터 컬렉션을 연결하는 LangChain 벡터 저장소 래퍼\n    vectorstore = Chroma(\n        collection_name=COLLECTION_NAME,\n        embedding_function=embeddings,\n        persist_directory=str(VECTORDB_DIR),\n    )\n\n    # ._collection.count(): 컬렉션에 저장된 벡터 개수. 0이면 인덱싱이 비었음을 뜻함\n    count = vectorstore._collection.count()\n    if count == 0:\n        raise ValueError(f\"벡터 DB가 비어 있음 (컬렉션 '{COLLECTION_NAME}'). 인덱싱 재실행 필요\")\n    print(f\"  - 특허법 벡터 DB 로드 완료: {count}개 벡터 (컬렉션 '{COLLECTION_NAME}')\")\n\n    # search_kwargs={\"k\": TOP_K}: 유사도 상위 TOP_K개 청크만 반환하도록 설정함\n    return vectorstore.as_retriever(search_kwargs={\"k\": TOP_K})"
    },
    {
      "id": "create_llm",
      "name": "create_llm()",
      "fileId": "main",
      "summary": "질문 라우팅과 답변 생성을 모두 맡을 Groq LLM(gpt-oss-120b)을 만들어 돌려주는 함수.",
      "how": "이 예제는 하나의 LLM 으로 분류(라우팅)도 하고 답변도 씀. ① GROQ_API_KEY 가 없으면 즉시 명확한 오류를 냄. ② ChatGroq 로 모델을 만들되, temperature=0 으로 같은 질문엔 같은(재현 가능한) 분류·답변을 내도록 고정함. ③ gpt-oss-120b 는 추론(reasoning) 모델이라 사고 과정이 답변 본문에 섞일 수 있어, reasoning_format=\"hidden\" 으로 최종 답변 텍스트만 받음.",
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
          "at": "def create_llm",
          "text": "라우팅·답변용 Groq LLM을 만드는 함수 정의."
        },
        {
          "at": "if not os.getenv(\"GROQ_API_KEY\")",
          "text": "Groq 키가 없으면 초기에 명확한 오류를 내 디버깅을 쉽게 함."
        },
        {
          "at": "return ChatGroq(",
          "text": "모델 이름·temperature·reasoning_format 설정으로 Groq 채팅 모델을 만들어 돌려줌."
        },
        {
          "at": "reasoning_format=\"hidden\",  #",
          "text": "추론 과정을 숨기고 최종 답변 텍스트만 받도록 함(본문 오염 방지)."
        }
      ],
      "code": "def create_llm():\n    \"\"\"Groq LPU의 openai/gpt-oss-120b 채팅 모델을 생성하여 반환함.\n\n    ChatGroq: Groq Cloud LPU에 채팅 요청을 보내는 LangChain 모델 래퍼 (GROQ_API_KEY 자동 참조).\n    gpt-oss-120b는 추론(reasoning) 모델이라 사고 과정이 답변 본문에 섞일 수 있으므로\n    reasoning_format=\"hidden\"으로 최종 답변만 받도록 함.\n    temperature=0: 라우팅 분류와 답변을 재현 가능(결정적)하게 함.\n    \"\"\"\n    import os\n\n    from langchain_groq import ChatGroq\n\n    if not os.getenv(\"GROQ_API_KEY\"):\n        raise RuntimeError(f\"GROQ_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요\")\n\n    return ChatGroq(\n        model=LLM_MODEL,\n        temperature=0,\n        reasoning_format=\"hidden\",  # 추론 과정을 숨기고 최종 답변 텍스트만 반환\n    )"
    },
    {
      "id": "keyword_route",
      "name": "keyword_route() — 폴백 분류기",
      "fileId": "main",
      "summary": "질문에 특허 관련 키워드가 있으면 'patent', 없으면 'web'을 돌려주는 규칙 기반 폴백 분류기.",
      "how": "LLM 라우팅이 모호한 답을 줄 때를 대비한 결정적(규칙 기반) 분류임. any(...) 제너레이터로 PATENT_KEYWORDS(특허·출원·발명 등) 중 하나라도 질문 문장에 들어 있는지 검사해, 하나라도 있으면 'patent', 전혀 없으면 'web'을 돌려줌. LLM 호출 없이 단어 포함 여부만 보므로 빠르고 항상 같은 결과를 냄.",
      "terms": [
        "키워드 휴리스틱(폴백)",
        "any()",
        "폴백(fallback)"
      ],
      "lines": [
        {
          "at": "def keyword_route",
          "text": "키워드 포함 여부로 소스를 정하는 규칙 기반 폴백 분류기 정의."
        },
        {
          "at": "if any(keyword in query for keyword in PATENT_KEYWORDS)",
          "text": "특허 키워드 중 하나라도 질문에 포함되는지 any()로 검사함."
        },
        {
          "at": "return \"patent\"",
          "text": "특허 키워드가 있으면 벡터 DB 소스(patent)로 보냄."
        },
        {
          "at": "    return \"web\"",
          "text": "특허 키워드가 전혀 없으면 웹검색 소스(web)로 보냄."
        }
      ],
      "code": "def keyword_route(query: str) -> str:\n    \"\"\"질의에 특허 관련 키워드가 있으면 'patent', 없으면 'web'을 반환하는 폴백 분류기.\n\n    LLM 라우팅이 모호한 단어를 반환할 때를 대비한 결정적(규칙 기반) 분류로,\n    any(...) 제너레이터로 PATENT_KEYWORDS 중 하나라도 질의에 포함되는지 검사함.\n    \"\"\"\n    if any(keyword in query for keyword in PATENT_KEYWORDS):\n        return \"patent\"\n    return \"web\""
    },
    {
      "id": "route_query",
      "name": "route_query() — 질문 라우팅",
      "fileId": "main",
      "summary": "LLM에게 한 단어 분류를 요청해 질문을 'patent'(벡터 DB) 또는 'web'(웹검색)으로 나누고, 모호하면 폴백함.",
      "how": "Query Routing 의 핵심임. ① SystemMessage(라우터 지시)와 HumanMessage(질문)를 LLM 에 넣어 한 단어 답을 받음. ② 응답을 소문자·공백 제거로 정규화함. ③ 'patent'만 있으면 patent, 'web'만 있으면 web 으로 확정함(둘 중 하나만 명확할 때). ④ 답이 모호하면(둘 다 포함하거나 둘 다 없음) keyword_route() 의 규칙 기반 결과로 폴백해 항상 둘 중 하나를 보장함.",
      "terms": [
        "Query Routing(질문 라우팅)",
        "SystemMessage",
        "HumanMessage",
        "키워드 휴리스틱(폴백)",
        "폴백(fallback)",
        "invoke"
      ],
      "lines": [
        {
          "at": "def route_query",
          "text": "LLM 분류 + 폴백으로 질문 소스를 정하는 함수 정의."
        },
        {
          "at": "from langchain_core.messages import HumanMessage, SystemMessage",
          "text": "역할을 객체로 표현하는 LangChain 메시지 타입을 가져옴."
        },
        {
          "at": "response = llm.invoke(",
          "text": "라우터 지시(System)와 질문(Human)을 LLM에 보내 한 단어 답을 받음."
        },
        {
          "at": "label = response.content.strip().lower()",
          "text": "응답을 소문자·공백 제거로 정규화해 분류 라벨을 추출함."
        },
        {
          "at": "if \"patent\" in label and \"web\" not in label",
          "text": "라벨에 patent만 있으면 벡터 DB 소스로 확정."
        },
        {
          "at": "if \"web\" in label and \"patent\" not in label",
          "text": "라벨에 web만 있으면 웹검색 소스로 확정."
        },
        {
          "at": "return keyword_route(query)",
          "text": "라벨이 모호하면 키워드 휴리스틱으로 폴백해 둘 중 하나를 보장함."
        }
      ],
      "code": "def route_query(query: str, llm) -> str:\n    \"\"\"질문을 'patent'(벡터 DB) 또는 'web'(웹검색)으로 분류함.\n\n    1차로 LLM에 한 단어 분류를 요청하고, 응답이 patent/web으로 명확하지 않으면\n    keyword_route()의 규칙 기반 결과로 폴백하여 항상 둘 중 하나를 보장함.\n    \"\"\"\n    from langchain_core.messages import HumanMessage, SystemMessage\n\n    # SystemMessage / HumanMessage: LangChain 메시지 타입 (role을 객체로 표현)\n    response = llm.invoke(\n        [SystemMessage(content=ROUTER_SYSTEM_PROMPT), HumanMessage(content=query)]\n    )\n    # 응답 텍스트를 소문자·공백 제거로 정규화해 분류 라벨을 추출함\n    label = response.content.strip().lower()\n\n    # LLM이 명확히 한 소스를 지목하면 그대로 사용함 (web을 먼저 검사해 'patent web' 혼입 시 우선순위 부여 X)\n    if \"patent\" in label and \"web\" not in label:\n        return \"patent\"\n    if \"web\" in label and \"patent\" not in label:\n        return \"web\"\n\n    # 라벨이 모호하면(둘 다 포함하거나 둘 다 없음) 키워드 휴리스틱으로 폴백함\n    return keyword_route(query)"
    },
    {
      "id": "search_vectordb",
      "name": "search_vectordb()",
      "fileId": "main",
      "summary": "특허법 벡터 DB에서 질문과 유사한 청크 상위 K개를 검색해 Document 리스트로 돌려주는 함수.",
      "how": "patent 로 라우팅된 질문에서만 호출됨. retriever.invoke(query) 한 줄로, 질문을 임베딩한 뒤 의미적으로 가까운 청크를 유사도순으로 가져와 Document 객체 목록으로 돌려줌. 검색기에 이미 'top-k=5' 설정이 들어 있어 상위 5개만 반환됨.",
      "terms": [
        "retriever",
        "invoke",
        "유사도 검색",
        "Document",
        "청크"
      ],
      "lines": [
        {
          "at": "def search_vectordb",
          "text": "특허법 벡터 DB 유사도 검색을 수행하는 함수 정의."
        },
        {
          "at": "return retriever.invoke(query)",
          "text": "질문을 임베딩해 가까운 청크를 유사도순으로 가져와 돌려줌."
        }
      ],
      "code": "def search_vectordb(query: str, retriever) -> list:\n    \"\"\"특허법 벡터 DB에서 질의와 유사한 청크 Top K를 검색해 Document 리스트로 반환함.\n\n    retriever.invoke(query): 질의를 임베딩한 뒤 의미적으로 가까운 청크를 유사도순으로 가져옴.\n    \"\"\"\n    return retriever.invoke(query)"
    },
    {
      "id": "search_web",
      "name": "search_web()",
      "fileId": "main",
      "summary": "DuckDuckGo로 웹을 검색해 제목·요약·링크가 담긴 결과 리스트를 돌려주는 함수.",
      "how": "web 으로 라우팅된 질문에서만 호출됨. ① DuckDuckGoSearchAPIWrapper(API 키 불필요)를 한국어·최근 1년·상위 5건 설정으로 만듦. ② results() 메서드로 검색함 — run()과 달리 출처 link(URL)까지 포함해 답변에 출처를 명시할 수 있음. ③ 무료 검색은 일시적 rate limit·네트워크 오류가 날 수 있어, try/except 로 실패해도 빈 리스트로 처리하고 경고만 남겨 프로그램이 멈추지 않게 함.",
      "terms": [
        "DuckDuckGo",
        "DuckDuckGoSearchAPIWrapper",
        "웹검색",
        "폴백(fallback)"
      ],
      "lines": [
        {
          "at": "def search_web",
          "text": "DuckDuckGo 웹검색을 수행하는 함수 정의."
        },
        {
          "at": "from langchain_community.utilities import DuckDuckGoSearchAPIWrapper",
          "text": "API 키 없이 동작하는 무료 웹검색 유틸리티를 가져옴."
        },
        {
          "at": "wrapper = DuckDuckGoSearchAPIWrapper(",
          "text": "한국어·최근 1년·상위 5건 설정으로 웹검색 래퍼를 만듦."
        },
        {
          "at": "return wrapper.results(query",
          "text": "results()로 출처 링크까지 포함한 상세 결과를 받아 돌려줌."
        },
        {
          "at": "except Exception as error:",
          "text": "검색 실패 시 빈 결과로 처리하고 경고만 남겨 프로그램 중단을 막음."
        }
      ],
      "code": "def search_web(query: str) -> list:\n    \"\"\"DuckDuckGo로 웹을 검색해 [{title, snippet, link}, ...] 리스트를 반환함.\n\n    DuckDuckGoSearchAPIWrapper: API 키 없이 동작하는 무료 웹검색 유틸리티.\n    results() 메서드는 run()과 달리 제목·요약뿐 아니라 출처 link(URL)까지 포함해 반환하므로\n    답변에 출처를 명시할 수 있음. time=\"y\"로 최근 1년 결과만, max_results=5로 상위 5건만 사용함.\n    \"\"\"\n    from langchain_community.utilities import DuckDuckGoSearchAPIWrapper\n\n    wrapper = DuckDuckGoSearchAPIWrapper(\n        region=WEB_REGION,\n        time=WEB_TIME,            # 최근 1년 결과로 최신성 확보\n        max_results=WEB_MAX_RESULTS,\n    )\n    try:\n        # results(): 소스 링크를 포함한 상세 결과 반환 (run()은 텍스트만 반환해 출처 누락)\n        return wrapper.results(query, max_results=WEB_MAX_RESULTS)\n    except Exception as error:\n        # 무료 검색은 일시적 rate limit·네트워크 오류가 날 수 있으므로 빈 결과로 처리하고 경고만 남김\n        print(f\"  - [경고] 웹검색 실패(일시적): {error}\", file=sys.stderr)\n        return []"
    },
    {
      "id": "format_patent_docs",
      "name": "format_patent_docs()",
      "fileId": "main",
      "summary": "특허법 검색 Document 리스트를 출처 라벨·메타데이터 헤더와 함께 하나의 컨텍스트 문자열로 합치는 함수.",
      "how": "검색기는 Document 객체 목록을 주는데 프롬프트에는 글자로 넣어야 함. 각 청크 앞에 [출처 N] 라벨과 메타데이터(파일명 source·청크 번호 chunk_index)를 붙여 LLM 이 근거 조문을 인용하기 쉽게 하고, 사람도 출처를 식별하게 함. 청크 사이는 구분선(---)으로 띄워 문서 경계를 분명히 함.",
      "terms": [
        "Document",
        "metadata",
        "청크",
        "프롬프트"
      ],
      "lines": [
        {
          "at": "def format_patent_docs",
          "text": "특허법 검색 문서를 컨텍스트 문자열로 합치는 함수 정의."
        },
        {
          "at": "for index, doc in enumerate(docs, start=1)",
          "text": "검색된 문서를 1번부터 번호를 매기며 하나씩 처리."
        },
        {
          "at": "source = doc.metadata.get(\"source\"",
          "text": "문서의 출처 파일명을 메타데이터에서 꺼냄."
        },
        {
          "at": "chunk_index = doc.metadata.get(\"chunk_index\"",
          "text": "청크가 문서에서 몇 번째 조각인지 번호를 꺼냄."
        },
        {
          "at": "return \"\\n\\n---\\n\\n\".join(blocks)",
          "text": "각 청크 블록을 구분선으로 이어 하나의 컨텍스트 문자열로 만듦."
        }
      ],
      "code": "def format_patent_docs(docs: list) -> str:\n    \"\"\"특허법 검색 Document 리스트를 LLM 프롬프트용 단일 문자열로 합침.\n\n    각 청크 앞에 [출처 N] 라벨과 메타데이터(파일명·청크 번호)를 붙여\n    LLM이 근거 조문을 인용하기 쉽게 하고, 사람도 출처를 식별할 수 있게 함.\n    \"\"\"\n    blocks = []\n    for index, doc in enumerate(docs, start=1):\n        source = doc.metadata.get(\"source\", \"unknown\")\n        chunk_index = doc.metadata.get(\"chunk_index\", \"?\")\n        blocks.append(f\"[출처 {index}] {source} #{chunk_index}\\n{doc.page_content}\")\n    # 청크 사이를 구분선으로 띄워 LLM이 문서 경계를 인식하기 쉽게 함\n    return \"\\n\\n---\\n\\n\".join(blocks)"
    },
    {
      "id": "format_web_results",
      "name": "format_web_results()",
      "fileId": "main",
      "summary": "웹검색 결과 dict 리스트를 출처 라벨·제목·요약·링크와 함께 하나의 컨텍스트 문자열로 합치는 함수.",
      "how": "웹검색은 [{title, snippet, link}, ...] 형태의 딕셔너리 목록을 줌. ① 결과가 비어 있으면 빈 문자열을 돌려줌(프롬프트에서 '결과 없음'으로 처리). ② 각 결과 앞에 [출처 N] 라벨과 제목·요약·링크(URL)를 붙여 LLM 이 출처 URL을 인용하게 함. ③ 결과 사이는 구분선(---)으로 띄움.",
      "terms": [
        "웹검색",
        "프롬프트"
      ],
      "lines": [
        {
          "at": "def format_web_results",
          "text": "웹검색 결과를 컨텍스트 문자열로 합치는 함수 정의."
        },
        {
          "at": "if not results:",
          "text": "검색 결과가 비어 있으면 빈 문자열을 돌려줌."
        },
        {
          "at": "title = item.get(\"title\"",
          "text": "각 결과의 제목을 꺼냄(없으면 '제목 없음')."
        },
        {
          "at": "link = item.get(\"link\"",
          "text": "각 결과의 출처 URL을 꺼내 LLM이 인용하게 함."
        },
        {
          "at": "    return \"\\n\\n---\\n\\n\".join(blocks)",
          "text": "각 결과 블록을 구분선으로 이어 하나의 컨텍스트 문자열로 만듦."
        }
      ],
      "code": "def format_web_results(results: list) -> str:\n    \"\"\"웹검색 결과 dict 리스트를 LLM 프롬프트용 단일 문자열로 합침.\n\n    각 결과 앞에 [출처 N] 라벨과 제목·요약·링크를 붙여 LLM이 출처 URL을 인용하게 함.\n    \"\"\"\n    if not results:\n        return \"\"\n    blocks = []\n    for index, item in enumerate(results, start=1):\n        title = item.get(\"title\", \"제목 없음\")\n        snippet = item.get(\"snippet\", \"\")\n        link = item.get(\"link\", \"\")\n        blocks.append(f\"[출처 {index}] {title}\\n{snippet}\\n링크: {link}\")\n    return \"\\n\\n---\\n\\n\".join(blocks)"
    },
    {
      "id": "answer_query",
      "name": "answer_query() — 라우팅→검색→생성",
      "fileId": "main",
      "summary": "질문을 라우팅해 적합한 소스로 검색하고, 검색 결과를 근거로 LLM 답변을 생성하는 본체 함수.",
      "how": "멀티소스 RAG 의 핵심 파이프라인임. ① route_query() 로 patent/web 을 결정함. ② patent면 벡터 DB 검색 후 format_patent_docs 로 컨텍스트를 만들고 특허법 프롬프트를 고름; web이면 웹검색 후 format_web_results 로 컨텍스트를 만들고 웹검색 프롬프트를 고름. ③ ChatPromptTemplate 로 system/human 메시지를 묶고, LCEL 파이프(prompt | llm | StrOutputParser)로 답변을 생성함. ④ 출력 시 보여주려고 (route, answer, sources) 세 값을 함께 돌려줌.",
      "terms": [
        "Query Routing(질문 라우팅)",
        "ChatPromptTemplate",
        "LCEL",
        "파이프(|)",
        "StrOutputParser",
        "invoke",
        "프롬프트"
      ],
      "lines": [
        {
          "at": "def answer_query",
          "text": "라우팅→검색→생성을 한 번에 수행하는 본체 함수 정의."
        },
        {
          "at": "route = route_query(query, llm)",
          "text": "①라우팅: 질문 유형에 따라 patent/web 소스를 선택함."
        },
        {
          "at": "if route == \"patent\":",
          "text": "patent면 벡터 DB 검색·특허법 프롬프트 분기로 들어감."
        },
        {
          "at": "sources = search_vectordb(query, retriever)",
          "text": "②탐색: 특허법 벡터 DB에서 유사 청크를 검색함."
        },
        {
          "at": "sources = search_web(query)",
          "text": "②탐색: web이면 DuckDuckGo 웹검색을 수행함."
        },
        {
          "at": "chain = prompt | llm | StrOutputParser()",
          "text": "③생성: LCEL 파이프로 프롬프트→LLM→문자열 파서를 연결함."
        },
        {
          "at": "answer = chain.invoke(",
          "text": "컨텍스트와 질문을 넣어 체인을 실행해 답변을 받음."
        },
        {
          "at": "return route, answer, sources",
          "text": "출력용으로 선택 소스·답변·검색 출처 세 값을 함께 돌려줌."
        }
      ],
      "code": "def answer_query(query: str, retriever, llm) -> tuple[str, str, list]:\n    \"\"\"질문을 라우팅해 적합한 소스로 검색하고, 검색 결과를 근거로 LLM 답변을 생성함.\n\n    처리 흐름:\n      1. 라우팅: route_query()로 'patent'(벡터 DB) / 'web'(웹검색) 결정\n      2. 탐색  : 선택된 소스에서 검색 (search_vectordb 또는 search_web)\n      3. 생성  : 소스에 맞는 프롬프트로 (prompt | llm | StrOutputParser) 체인 실행\n    출력 시 라우팅 결과·근거를 함께 보여주기 위해 (route, answer, sources)를 반환함.\n    \"\"\"\n    from langchain_core.output_parsers import StrOutputParser\n    from langchain_core.prompts import ChatPromptTemplate\n\n    # 1) 라우팅: 질문 유형에 따라 검색 소스를 선택함\n    route = route_query(query, llm)\n\n    # 2) 탐색 + 컨텍스트/프롬프트 구성: 소스별로 다른 검색기·프롬프트를 사용함\n    if route == \"patent\":\n        sources = search_vectordb(query, retriever)\n        context = format_patent_docs(sources)\n        system_prompt, human_prompt = PATENT_SYSTEM_PROMPT, HUMAN_PROMPT\n    else:\n        sources = search_web(query)\n        context = format_web_results(sources)\n        system_prompt, human_prompt = WEB_SYSTEM_PROMPT, WEB_HUMAN_PROMPT\n\n    # 3) 생성: LCEL 파이프 연산자(|)로 프롬프트 → LLM → 문자열 파서를 연결함\n    # ChatPromptTemplate.from_messages: system/human 메시지 템플릿을 묶어 프롬프트를 구성함\n    prompt = ChatPromptTemplate.from_messages(\n        [(\"system\", system_prompt), (\"human\", human_prompt)]\n    )\n    # StrOutputParser: LLM의 AIMessage 응답에서 본문 텍스트만 추출함\n    chain = prompt | llm | StrOutputParser()\n\n    answer = chain.invoke({\"context\": context, \"question\": query})\n    return route, answer, sources"
    },
    {
      "id": "print_result",
      "name": "print_result()",
      "fileId": "main",
      "summary": "질문·선택된 소스·생성 답변·검색 출처를 소스 종류에 맞춰 보기 좋게 콘솔에 출력하는 함수.",
      "how": "결과를 사람이 읽기 좋게 표시함. ① route 값을 사람이 읽을 라벨('특허법 벡터 DB' 또는 '웹검색(DuckDuckGo)')로 바꿈. ② 질문·선택된 소스·답변을 구분선과 함께 출력함. ③ 출처는 소스 종류에 따라 다르게 표시 — patent면 파일명·청크 번호와 본문 60자 미리보기(줄바꿈을 공백으로 치환)를, web이면 제목과 출처 URL을 보여줌. 어떤 소스를 썼는지 투명하게 드러냄.",
      "terms": [
        "Document",
        "metadata",
        "웹검색"
      ],
      "lines": [
        {
          "at": "def print_result",
          "text": "결과를 콘솔에 보기 좋게 출력하는 함수 정의."
        },
        {
          "at": "route_label = ",
          "text": "route 값을 사람이 읽을 소스 라벨로 변환함."
        },
        {
          "at": "print(f\"[질문] {query}\")",
          "text": "어떤 질문이었는지 출력함."
        },
        {
          "at": "print(f\"[선택된 소스] {route_label}\")",
          "text": "라우팅으로 선택된 소스(특허법 벡터 DB/웹검색)를 출력함."
        },
        {
          "at": "print(f\"[검색 출처] {len(sources)}건\")",
          "text": "근거가 된 출처가 몇 건인지 출력함."
        },
        {
          "at": "snippet = doc.page_content[:60].replace(\"\\n\", \" \")",
          "text": "patent: 본문 앞 60자를 줄바꿈 없이 미리보기로 만듦."
        },
        {
          "at": "title = item.get(\"title\"",
          "text": "web: 각 결과의 제목을 꺼내 출력 준비함."
        }
      ],
      "code": "def print_result(query: str, route: str, answer: str, sources: list) -> None:\n    \"\"\"질의어·선택된 소스·생성 답변·검색 출처를 보기 좋게 콘솔에 출력함.\"\"\"\n    route_label = \"특허법 벡터 DB\" if route == \"patent\" else \"웹검색(DuckDuckGo)\"\n    print(\"\\n\" + \"=\" * 70)\n    print(f\"[질문] {query}\")\n    print(f\"[선택된 소스] {route_label}\")\n    print(\"=\" * 70)\n    print(f\"[답변]\\n{answer}\")\n    print(\"\\n\" + \"-\" * 70)\n    print(f\"[검색 출처] {len(sources)}건\")\n\n    if route == \"patent\":\n        # 벡터 DB: 파일명·청크 번호와 본문 미리보기로 근거 청크를 보여줌\n        for index, doc in enumerate(sources, start=1):\n            source = doc.metadata.get(\"source\", \"unknown\")\n            chunk_index = doc.metadata.get(\"chunk_index\", \"?\")\n            snippet = doc.page_content[:60].replace(\"\\n\", \" \")\n            print(f\"  [{index}] {source} #{chunk_index}: {snippet}...\")\n    else:\n        # 웹검색: 제목과 출처 URL을 보여줌\n        for index, item in enumerate(sources, start=1):\n            title = item.get(\"title\", \"제목 없음\")\n            link = item.get(\"link\", \"\")\n            print(f\"  [{index}] {title}\\n      {link}\")\n    print(\"=\" * 70)"
    },
    {
      "id": "prompt_user_query",
      "name": "prompt_user_query() — 대화형 입력",
      "fileId": "main",
      "summary": "소스별 예시 질문을 보여주고 사용자에게서 질문을 입력받아 돌려주는 대화형 입력 함수.",
      "how": "명령줄 인자가 없을 때 호출됨. ① 특허법·웹검색 예시 질문을 통합 번호로 출력해, 어떤 질문이 어느 소스로 가는지 학습하게 함. ② input() 으로 한 줄을 입력받음 — 입력 종료(EOF)면 EOFError 를 잡아 기본 질의로 폴백해 파이프 입력 같은 비대화형 환경에서도 동작함. ③ 빈 입력이면 기본 질의(DEFAULT_QUERY)로 폴백. ④ 입력이 예시 범위 안의 숫자면 해당 예시 질문을, 그 외에는 사용자가 직접 친 문장을 질의어로 씀.",
      "terms": [
        "대화형 입력",
        "EOFError",
        "폴백(fallback)",
        "DEFAULT_QUERY"
      ],
      "lines": [
        {
          "at": "def prompt_user_query",
          "text": "예시를 보여주고 사용자 질문을 입력받는 함수 정의."
        },
        {
          "at": "for example in PATENT_EXAMPLES:",
          "text": "특허법 예시 질문들을 통합 번호로 출력함."
        },
        {
          "at": "for example in WEB_EXAMPLES:",
          "text": "웹검색 예시 질문들을 이어서 통합 번호로 출력함."
        },
        {
          "at": "user_input = input(",
          "text": "콘솔에서 한 줄 입력을 문자열로 읽어옴(UTF-8 한글 입력 지원)."
        },
        {
          "at": "except EOFError:",
          "text": "읽을 줄이 없으면(EOF) 기본 질의로 폴백해 비대화형에서도 동작."
        },
        {
          "at": "if not user_input:",
          "text": "빈 입력이면 기본 질의(DEFAULT_QUERY)로 폴백함."
        },
        {
          "at": "if user_input.isdigit():",
          "text": "숫자이고 예시 범위 안이면 해당 예시 질문을 사용함."
        },
        {
          "at": "    return user_input",
          "text": "그 외에는 사용자가 직접 입력한 문장을 질의어로 사용함."
        }
      ],
      "code": "def prompt_user_query() -> str:\n    \"\"\"소스별 예시 질문을 보여주고 사용자로부터 질문을 입력받아 반환함.\n\n    번호를 입력하면 해당 예시 질문을, 문장을 입력하면 그 문장을 질의어로 사용함.\n    빈 입력이나 입력 종료(EOF)면 기본 질의어(DEFAULT_QUERY)로 폴백함.\n    \"\"\"\n    print(\"\\n\" + \"=\" * 70)\n    print(\"질문을 입력하세요. 아래 예시 번호를 고르거나 직접 질문을 입력할 수 있음.\")\n    print(\"-\" * 70)\n\n    # 예시 질문을 소스별로 묶어 통합 번호를 매겨 출력함 (어떤 질문이 어느 소스로 가는지 학습)\n    examples: list[str] = []  # list[str]: 문자열 원소를 담는 리스트 타입 명시\n    print(\"[특허법 벡터 DB 예시] (특허 요건·출원 절차·침해 구제 등)\")\n    for example in PATENT_EXAMPLES:\n        examples.append(example)\n        print(f\"  {len(examples)}. {example}\")\n    print(\"[웹검색 예시] (최신 트렌드·동향·뉴스 등)\")\n    for example in WEB_EXAMPLES:\n        examples.append(example)\n        print(f\"  {len(examples)}. {example}\")\n    print(\"=\" * 70)\n\n    try:\n        # input(): 콘솔에서 한 줄 입력을 문자열로 읽어옴 (stdin UTF-8 재설정으로 한글 입력 지원)\n        user_input = input(\"질문 (번호 또는 직접 입력, 빈 입력 시 기본 질의): \").strip()\n    except EOFError:\n        # 파이프 입력 등으로 읽을 줄이 없으면 기본 질의로 폴백해 비대화형 환경에서도 동작하게 함\n        return DEFAULT_QUERY\n\n    if not user_input:\n        return DEFAULT_QUERY\n\n    # 입력이 숫자이고 예시 범위(1~len) 안이면 해당 예시 질문을 사용함\n    if user_input.isdigit():\n        index = int(user_input)\n        if 1 <= index <= len(examples):\n            return examples[index - 1]\n        # 범위를 벗어난 숫자면 입력값 자체를 질의어로 간주함\n\n    # 그 외에는 사용자가 직접 입력한 문장을 질의어로 사용함\n    return user_input"
    },
    {
      "id": "main",
      "name": "main() / __main__ — 실행 진입부",
      "fileId": "main",
      "summary": "벡터 DB 로드→LLM 생성→라우팅·검색·답변→출력 순으로 멀티소스 RAG를 실행하는 진입점.",
      "how": "프로그램 전체 흐름을 지휘함. ① 명령줄 인자가 있으면 질의어로, 없으면 prompt_user_query() 로 대화형 입력을 받음. ② [1/3] load_retriever() 로 특허법 벡터 DB를 로드(재임베딩 없음). ③ [2/3] create_llm() 로 LLM 생성. ④ [3/3] answer_query() 로 라우팅·검색·답변을 한 번에 수행. ⑤ print_result() 로 결과를 출력함. 맨 아래 if __name__ 관용구로 직접 실행 시에만 main 을 부르고, 오류가 나면 명확히 출력 후 비정상 종료 코드로 빠져나감.",
      "terms": [
        "if __name__ == \"__main__\"",
        "invoke"
      ],
      "lines": [
        {
          "at": "def main() -> None:",
          "text": "멀티소스 RAG 전체를 실행하는 진입점 함수 정의."
        },
        {
          "at": "arg_query = \" \".join(sys.argv[1:]).strip()",
          "text": "명령줄 인자들을 합쳐 질의어 후보로 만듦."
        },
        {
          "at": "query = arg_query if arg_query else prompt_user_query()",
          "text": "인자가 있으면 그걸, 없으면 대화형 입력을 질의어로 씀."
        },
        {
          "at": "retriever = load_retriever()",
          "text": "[1/3] 특허법 벡터 DB를 검색기로 로드함."
        },
        {
          "at": "llm = create_llm()",
          "text": "[2/3] 라우팅·답변용 Groq LLM을 생성함."
        },
        {
          "at": "route, answer, sources = answer_query(query, retriever, llm)",
          "text": "[3/3] 라우팅·검색·답변 생성을 한 번에 수행함."
        },
        {
          "at": "print_result(query, route, answer, sources)",
          "text": "질문·소스·답변·출처를 콘솔에 출력함."
        },
        {
          "at": "if __name__ == \"__main__\":",
          "text": "이 파일을 직접 실행할 때만 main()을 수행하는 관용구."
        },
        {
          "at": "except Exception as error:",
          "text": "실행 중 오류를 명확히 출력하고 비정상 종료 코드로 빠져나감."
        }
      ],
      "code": "def main() -> None:\n    \"\"\"벡터 DB 로드 → LLM 생성 → 라우팅·검색·답변 → 출력 순으로 멀티소스 RAG를 실행함.\"\"\"\n    # 명령줄 인자가 있으면 질의어로 사용하고, 없으면 대화형으로 사용자에게 입력받음\n    arg_query = \" \".join(sys.argv[1:]).strip()\n    query = arg_query if arg_query else prompt_user_query()\n\n    print(\"[1/3] 특허법 벡터 DB 로드 (재임베딩 없음)\")\n    retriever = load_retriever()\n\n    print(\"[2/3] LLM 생성 (Groq openai/gpt-oss-120b)\")\n    llm = create_llm()\n\n    print(\"[3/3] 질문 라우팅 + 검색 + 답변 생성\")\n    route, answer, sources = answer_query(query, retriever, llm)\n\n    print_result(query, route, answer, sources)\n\n\n# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)\nif __name__ == \"__main__\":\n    try:\n        main()\n    except Exception as error:\n        # 실행 중 오류를 명확히 출력하고 비정상 종료 코드로 빠져나감\n        print(f\"\\n[오류] 멀티소스 RAG 실행 실패: {error}\", file=sys.stderr)\n        sys.exit(1)"
    }
  ],
  "glossary": {
    "RAG": "Retrieval-Augmented Generation. 외부 자료에서 관련 내용을 먼저 찾아(검색) 그 근거로 LLM이 답하게 하는 방식. 모델이 모르는 전문·최신 정보도 자료만 있으면 답할 수 있게 함.",
    "Query Routing(질문 라우팅)": "질문을 분석해 어느 검색 소스로 보낼지 고르는 패턴. 이 예제는 LLM에게 patent/web 한 단어로 분류시켜 특허법 질문은 벡터 DB로, 최신 트렌드 질문은 웹검색으로 나눔.",
    "키워드 휴리스틱(폴백)": "LLM 분류가 모호할 때를 대비한 규칙 기반 보조 분류. 질문에 특허 관련 단어(특허·출원·발명 등)가 하나라도 있으면 patent, 없으면 web으로 정해 항상 둘 중 하나를 보장함.",
    "폴백(fallback)": "기본 동작이 실패하거나 모호할 때 대신 쓰는 대비책. 이 예제는 LLM 분류가 애매하면 키워드 규칙으로, 웹검색이 실패하면 빈 결과로, 입력이 없으면 기본 질의로 폴백함.",
    "any()": "여러 항목 중 하나라도 조건을 만족하면 참(True)을 돌려주는 파이썬 내장 함수. 여기서는 특허 키워드 중 하나라도 질문에 들어 있는지 검사하는 데 씀.",
    "DuckDuckGo": "개인정보 추적을 하지 않는 검색 엔진. 이 예제는 API 키 없이 무료로 웹검색을 할 수 있어 최신 트렌드 질문의 정보원으로 사용함.",
    "DuckDuckGoSearchAPIWrapper": "LangChain에서 DuckDuckGo 웹검색을 호출하는 유틸리티. results() 메서드는 제목·요약뿐 아니라 출처 링크(URL)까지 포함해 돌려줘 답변에 출처를 명시할 수 있음.",
    "웹검색": "인터넷에서 최신 정보를 찾아오는 검색. 벡터 DB(고정된 특허법 문서)와 달리 실시간으로 바뀌는 트렌드·뉴스 같은 정보를 가져올 수 있음.",
    "reasoning_format": "ChatGroq에서 추론(reasoning) 모델의 사고 과정을 어떻게 처리할지 정하는 설정. \"hidden\"으로 두면 사고 과정을 숨기고 최종 답변 텍스트만 받아 본문이 깔끔해짐.",
    "SystemMessage": "LangChain 메시지 타입의 하나로, LLM에게 역할·규칙을 지시하는 시스템 메시지를 객체로 표현함. 여기서는 라우터 지시문을 담는 데 씀.",
    "HumanMessage": "LangChain 메시지 타입의 하나로, 사용자 발화(질문)를 객체로 표현함. 여기서는 라우팅할 질문을 담는 데 씀.",
    "대화형 입력": "명령줄 인자 없이 실행했을 때 콘솔에서 사용자가 직접 질문을 타이핑해 넣는 방식. 예시 번호를 고르거나 문장을 직접 입력할 수 있음.",
    "EOFError": "input()으로 더 읽을 입력 줄이 없을 때(End Of File) 발생하는 파이썬 오류. 파이프 입력 같은 비대화형 환경에서 나며, 이 예제는 잡아서 기본 질의로 폴백함.",
    "DEFAULT_QUERY": "대화형에서 빈 입력이나 입력 종료(EOF)가 들어왔을 때 대신 사용할 기본 질문 문장(특허법 질문).",
    "Chroma": "ChromaDB를 LangChain에서 다루는 래퍼 클래스. 여기서는 from_documents(신규 생성)가 아니라 생성자로 기존 컬렉션을 '연결'만 함.",
    "ChromaDB": "오픈소스 벡터 데이터베이스. 임베딩을 저장하고 유사도 검색을 해 줌. 로컬 폴더에 영속화(저장)되어 재실행 시 그대로 재사용 가능.",
    "영속화": "persist. 메모리에만 두지 않고 디스크 폴더에 저장해, 프로그램을 껐다 켜도 데이터가 남아 재사용되게 하는 것.",
    "컬렉션": "벡터 DB 안에서 벡터들을 묶어 두는 단위(여기서는 patent_law). 인덱싱과 검색이 같은 컬렉션 이름을 써야 검색이 됨.",
    "OpenAIEmbeddings": "OpenAI 임베딩 모델 호출 래퍼. 텍스트를 숫자 벡터로 변환함. 여기서는 질의(질문)를 벡터로 바꾸는 데 사용.",
    "text-embedding-3-small": "OpenAI의 임베딩 모델 이름(1536차원). 인덱싱 때 쓴 모델과 검색 때 쓰는 모델이 같아야 의미 공간이 맞아 검색이 됨.",
    "retriever": "검색기. 벡터 DB에서 질문과 가장 비슷한 청크 몇 개(top-k)를 찾아 돌려주는 역할.",
    "as_retriever": "벡터 저장소(vectorstore)를 검색기(retriever) 객체로 바꿔 주는 메서드. 상위 몇 개를 가져올지(k) 같은 검색 설정을 함께 줌.",
    "TOP_K": "벡터 DB 검색에서 가져올 상위 청크 개수를 정한 상수. 이 예제에서는 5.",
    "유사도 검색": "similarity search. 질문 벡터와 문서 벡터의 '가까운 정도'를 계산해 가장 가까운 것부터 찾는 검색 방식.",
    "청크": "chunk. 긴 문서를 검색하기 좋게 잘게 나눈 한 조각. 이 예제는 이미 나뉘어 저장된 청크를 검색해서 사용함.",
    "Document": "LangChain에서 한 청크를 담는 객체. 본문 텍스트(page_content)와 출처 등 부가정보(metadata)를 함께 가짐.",
    "metadata": "청크에 딸린 부가정보(예: 출처 파일명 source, 청크 번호 chunk_index). 답변의 출처를 표시하는 데 사용함.",
    "임베딩": "텍스트를 의미가 담긴 숫자 벡터(여러 숫자의 나열)로 바꾼 것. 뜻이 비슷한 글은 벡터도 가깝게 위치해, 컴퓨터가 '비슷한 내용'을 계산으로 찾을 수 있음.",
    "벡터 DB": "임베딩(숫자 벡터)을 저장하고, 질문 벡터와 가장 가까운 것들을 빠르게 찾아 주는 데이터베이스. 여기서는 ChromaDB를 사용함.",
    "ChatGroq": "Groq 클라우드의 채팅 LLM을 호출하는 LangChain 래퍼. GROQ_API_KEY를 자동 참조함.",
    "Groq LPU": "Groq사가 만든 LLM 추론 전용 칩(Language Processing Unit). 매우 빠른 응답 속도가 특징.",
    "gpt-oss-120b": "Groq LPU에서 서빙하는 오픈 가중치 LLM(약 1200억 파라미터). 이 예제의 라우팅·답변 생성 모델.",
    "temperature": "LLM 답변의 무작위성 정도. 0에 가까울수록 매번 비슷하고 일관된(보수적인) 답을 냄. 이 예제는 0으로 고정해 분류·답변을 재현 가능하게 함.",
    "ChatPromptTemplate": "LLM에 보낼 프롬프트(지시문)의 틀. {context}·{question} 같은 빈칸에 실제 값을 채워 완성된 프롬프트를 만듦.",
    "프롬프트": "LLM에게 주는 지시문. 이 예제는 라우터·특허법·웹검색마다 서로 다른 시스템 프롬프트를 씀.",
    "LCEL": "LangChain Expression Language. 파이프 기호(|)로 단계들을 왼쪽→오른쪽으로 연결해 하나의 처리 흐름(체인)을 만드는 문법.",
    "파이프(|)": "LCEL에서 앞 단계의 결과를 다음 단계의 입력으로 흘려보내는 연결 기호. 'prompt | llm | parser'처럼 씀.",
    "StrOutputParser": "LLM 응답 객체에서 사람이 읽을 본문 문자열만 깔끔히 뽑아 주는 출력 파서.",
    "invoke": "LangChain 체인/검색기/LLM을 '실행'하는 메서드. 입력을 넣으면 끝까지 돌려 결과를 돌려줌.",
    "load_dotenv": ".env 파일에 적어 둔 비밀값(예: OPENAI_API_KEY, GROQ_API_KEY)을 프로그램의 환경변수로 불러오는 함수.",
    "환경변수": "운영체제나 .env로 프로그램에 전달하는 설정값. API 키처럼 코드에 직접 적기 곤란한 비밀값을 담는 데 자주 씀.",
    "API 키": "외부 서비스(OpenAI·Groq 등)를 쓸 때 본인을 증명하는 비밀 문자열. 이 예제는 .env에 보관하고 환경변수로 불러와 사용함.",
    "from __future__ import annotations": "타입 힌트를 즉시 평가하지 않고 문자열로 두게 하는 파이썬 선언. 순환 참조 없이 가볍게 타입 힌트를 쓰게 해 줌.",
    "reconfigure": "이미 열린 표준출력·표준입력 스트림의 설정(여기서는 인코딩)을 바꾸는 메서드. 윈도우 콘솔에서 한글이 깨지지 않게 UTF-8로 맞추는 데 씀.",
    "Path(__file__).resolve().parent": "지금 이 파이썬 파일이 있는 폴더의 절대경로를 구하는 관용구. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "if __name__ == \"__main__\"": "이 파일을 직접 실행할 때만 특정 코드를 돌리고, 다른 곳에서 import할 때는 돌리지 않게 하는 파이썬 관용구.",
    "API 키 검사": "필요한 API 키가 환경변수에 없으면 실행 초기에 명확한 오류를 내는 패턴. 한참 뒤에 엉뚱한 곳에서 실패하는 것을 막아 디버깅을 쉽게 함.",
    "환각": "hallucination. LLM이 근거 없는 내용을 사실처럼 지어내는 현상. 이 예제는 '주어진 문서·검색 결과에 있는 내용만 근거로 답하라'는 프롬프트로 환각을 억제함."
  }
};
