window.EXPLAIN_DATA = {
  "meta": {
    "title": "YouTube 자막 RAG — Data API로 영상 찾고, 자막을 시점별로 잘라 답하기",
    "entry": "app.py"
  },
  "files": [
    {
      "id": "main",
      "label": "app.py",
      "role": "YouTube Data API v3로 최신 영상을 조건 검색하고(멀티쿼리), 자막을 120초 단위로 잘라 ChromaDB에 인덱싱한 뒤, Groq LLM으로 시점 URL과 함께 답하는 YouTube 자막 RAG 전체"
    }
  ],
  "flow": [
    {
      "step": 1,
      "title": "실행 & CLI 모드 분기",
      "label": "실행·CLI 분기",
      "refs": ["main", "setup"],
      "summary": "python app.py 뒤에 index / chat / ask / check-proxy 중 하나를 골라 실행함",
      "detail": "터미널에서 'python app.py index'(영상 검색→자막→벡터 DB 저장), 'python app.py chat'(대화형 챗봇), 'python app.py ask \"질문\"'(질문 1회), 'python app.py check-proxy URL'(자막 프록시 점검)로 시작함. 인자를 안 주면 기본은 index임. 시작과 동시에 load_dotenv() 가 hands-on/.env 의 YOUTUBE_API_KEY(검색)·OPENAI_API_KEY(임베딩)·GROQ_API_KEY(답변) 세 열쇠를 챙겨 둠. 비유하면, 식당에 들어온 손님이 '재료 준비(index)'·'주문 받기(chat/ask)'·'배달 경로 점검(check-proxy)' 중 무엇을 시킬지 먼저 고르고, 주방장은 세 개의 열쇠를 허리춤에 차는 단계."
    },
    {
      "step": 2,
      "title": "[1단계] Data API 멀티쿼리 검색 + 조건 필터 (+24h 캐시)",
      "label": "영상 검색·필터",
      "refs": ["search_all_topics", "search_topic_videos", "search_cache", "build_youtube_client", "parse_duration_chunked"],
      "summary": "한 토픽을 여러 관점으로 검색하고, 최근 90일·5분↑·조회수 1000회↑만 골라냄",
      "detail": "YouTube Data API v3 의 search.list 로 'Claude Code 특징', 'Claude Code 활용 방법'처럼 한 토픽을 여러 관점(ASPECTS)으로 검색해 후보를 넓게 모음(멀티쿼리=회수율↑). 그다음 videos.list 로 길이·조회수를 받아 '최근 90일·5분 이상·조회수 1000회 이상'만 남기고, 조회수 순으로 토픽당 10개를 뽑음. 같은 검색 조건의 결과는 24시간 동안 캐시 파일에 저장해 두어 API 할당량을 아낌. 비유하면, 한 주제를 여러 키워드로 도서관 검색대에 넣어 책을 잔뜩 뽑은 뒤, '최근에 나온·충분히 두껍고·많이 읽힌' 책만 골라 책상에 올리는 것. 같은 검색을 하루 안에 또 하면 어제 메모를 그대로 씀."
    },
    {
      "step": 3,
      "title": "[2단계] 자막 추출(프록시·백오프) + 120초 타임스탬프 청킹",
      "label": "자막 추출·청킹",
      "refs": ["load_transcripts", "fetch_transcript_pieces", "chunk_transcript", "transcript_cache", "build_transcript_client", "webshare_helpers"],
      "summary": "youtube-transcript-api로 자막을 받아 120초 단위로 자르고, 각 조각에 바로가기 URL을 붙임",
      "detail": "youtube-transcript-api 로 영상마다 자막(한국어→영어 우선)을 직접 가져옴. YouTube가 짧은 시간 대량 요청을 IP 차단하므로 프록시(Webshare 등)를 쓸 수 있고, 차단되면 3→6→12→24초로 기다리며 재시도함(지수 백오프). 가져온 자막은 120초(2분) 단위로 잘라(타임스탬프 청킹) 각 조각에 '몇 초부터 보면 되는지'를 알려 주는 &t=초 형식의 바로가기 URL과 제목·조회수 메타데이터를 붙임. 성공한 자막은 24시간 캐시에 저장함. 비유하면, 강연 녹취록을 2분짜리 토막으로 잘라 토막마다 '영상 12분 0초로 점프' 같은 북마크를 달아 두는 것. 문지기가 막으면 잠깐 기다렸다 다시 두드림."
    },
    {
      "step": 4,
      "title": "[3단계] ChromaDB 인덱싱 (최초/추가 자동 감지)",
      "label": "ChromaDB 인덱싱",
      "refs": ["vectorstore_build", "run_indexing"],
      "summary": "자막 토막을 숫자 벡터로 바꿔 ChromaDB에 저장함 — DB가 없으면 새로, 있으면 누적",
      "detail": "120초 토막들을 OpenAI 임베딩으로 숫자 벡터(1536차원)로 바꿔 ChromaDB 에 저장함. chroma_db 폴더가 없으면 from_documents() 로 새 컬렉션을 만들고, 이미 있으면 add_documents() 로 기존 컬렉션에 토막을 더함(자동 감지). --reset 을 주면 기존 DB를 지우고 처음부터 다시 함. 비유하면, 토막마다 '내용 지문'을 떠서 거대한 색인 서랍에 정리해 넣는 것. 서랍이 없으면 새로 짜고, 있으면 빈칸에 더 끼워 넣음."
    },
    {
      "step": 5,
      "title": "질의 시 MMR 검색",
      "label": "MMR 검색",
      "refs": ["rag_components"],
      "summary": "질문을 벡터로 바꿔 비슷하면서도 서로 겹치지 않는 자막 토막 10개를 골라옴",
      "detail": "chat/ask 모드에서 질문이 들어오면 같은 임베딩 모델로 질문을 벡터로 바꾼 뒤, MMR(Maximal Marginal Relevance) 방식으로 자막 토막을 회수함. 먼저 후보 30개(fetch_k)를 가져온 뒤 '질문과 관련 있으면서도 서로 내용이 겹치지 않는' 10개(k)를 고름. 한 영상에만 답이 쏠리지 않고 여러 영상의 다양한 시점을 골고루 모음. 비유하면, 서랍에서 비슷한 카드 30장을 꺼낸 뒤 '비슷하지만 똑같지는 않은' 10장만 추려 책상에 펴는 것."
    },
    {
      "step": 6,
      "title": "LLM 답변 (타임스탬프 URL 포함)",
      "label": "LLM 답변",
      "refs": ["formatters_chain", "query_run"],
      "summary": "고른 토막을 근거로 Groq LLM이 답을 쓰고, '몇 분부터 보세요' 시점 URL을 함께 제시함",
      "detail": "고른 자막 토막들을 제목·시점·바로가기 URL과 함께 컨텍스트 문자열로 묶어 시스템 프롬프트에 넣고, Groq LPU 의 gpt-oss-120b 가 한국어로 답함. 시스템 프롬프트가 '자막 내용만 근거로, 영상 제목과 &t=초 URL을 반드시 함께 제시하라'고 지시하므로 답에 '12:00부터 보세요' 같은 정확한 시점이 붙음. 비유하면, 추려낸 토막 카드만 보고 답을 쓰되 '이 내용은 어느 영상 몇 분에 있다'는 출처 쪽지를 꼭 같이 적어 주는 것."
    },
    {
      "step": 7,
      "title": "출력",
      "label": "출력",
      "refs": ["query_run"],
      "summary": "검색된 토막 미리보기와 최종 답변을 콘솔에 보여 줌",
      "detail": "answer_question 이 먼저 검색된 토막들을 '제목 @ 시점 / URL / 내용 미리보기' 형태로 보여 주고, 이어 LLM 답변을 구분선과 함께 출력함. ask 는 한 번 답하고 끝나고, chat 은 quit/q 를 입력할 때까지 질문을 계속 받는 루프를 돔. 비유하면, 손님에게 '이 답은 이 카드들에서 나왔어요'라며 근거 목록을 먼저 보여 주고 최종 답을 또박또박 읽어 주는 것."
    }
  ],
  "functions": [
    {
      "id": "setup",
      "name": "임포트·경로·상수 설정 (TOPICS·ASPECTS·필터·청킹/프록시·SYSTEM_PROMPT)",
      "fileId": "main",
      "summary": "필요한 모듈을 가져오고, 파일 위치 기준 경로를 잡고, .env 키와 검색·청킹·프록시·검색기 상수, 시스템 프롬프트를 준비하는 부분.",
      "how": "함수가 아니라 파일 위쪽의 준비 코드 모음임. ① 표준 라이브러리(argparse·json·re·time·datetime·urllib)를 가져오고, 윈도우 한글 출력이 깨지지 않게 표준출력을 UTF-8로 맞춤. ② 모든 경로를 이 파일 위치(__file__) 기준으로 계산해 어디서 실행해도 같은 .env·chroma_db·캐시를 가리키게 함. ③ load_dotenv 로 키를 올림. ④ 검색할 토픽(TOPICS)·멀티쿼리 관점(ASPECTS)·조건 필터(최근 90일·5분·1000회)·청킹 단위(120초)·프록시 설정·임베딩/LLM 모델명·MMR 검색 상수(RETRIEVE_K·FETCH_K·LAMBDA_MULT)와 LLM에게 줄 시스템 프롬프트를 정함.",
      "terms": [
        "from __future__ import annotations",
        "argparse",
        "정규표현식",
        "Path(__file__).resolve().parent",
        "load_dotenv",
        "Multi-Query(멀티쿼리)",
        "회수율(recall)",
        "TTL 캐시",
        "타임스탬프 청킹",
        "프록시(proxy)",
        "Webshare",
        "지수 백오프",
        "text-embedding-3-small",
        "gpt-oss-120b",
        "MMR",
        "fetch_k",
        "lambda_mult",
        "컬렉션",
        "프롬프트"
      ],
      "lines": [
        {
          "at": "from __future__ import annotations",
          "text": "타입 힌트를 문자열로 평가해 가볍게 쓰게 하는 파이썬 설정."
        },
        {
          "at": "import argparse",
          "text": "명령행 인자(index/chat/ask 등)를 파싱하는 표준 라이브러리를 가져옴."
        },
        {
          "at": "    sys.stdout.reconfigure(encoding=\"utf-8\")",
          "text": "윈도우 콘솔에서 한글·이모지가 깨지지 않도록 출력 인코딩을 UTF-8로 바꿈."
        },
        {
          "at": "SCRIPT_DIR = Path(__file__).resolve().parent",
          "text": "이 파일이 있는 폴더(youtube-rag/)를 절대경로로 구함 — 실행 위치와 무관하게 동작."
        },
        {
          "at": "CHROMA_DIR = SCRIPT_DIR / \"chroma_db\"",
          "text": "벡터 DB를 저장할 로컬 폴더 경로를 잡음(자동 생성)."
        },
        {
          "at": "load_dotenv(ENV_PATH)",
          "text": ".env 에서 검색·임베딩·LLM 세 가지 API 키를 환경변수로 올림."
        },
        {
          "at": "TOPICS = {",
          "text": "검색할 세 토픽(Claude Code·Antigravity·Codex)과 실제 검색어를 정의함."
        },
        {
          "at": "ASPECTS = [\"특징\", \"활용 방법\"",
          "text": "토픽마다 결합할 멀티쿼리 관점 4종을 정의함(회수율을 높임)."
        },
        {
          "at": "RECENT_DAYS = 90",
          "text": "최근 90일(약 3개월) 이내 업로드된 영상만 검색하도록 정함."
        },
        {
          "at": "MIN_DURATION_SECONDS = 300",
          "text": "최소 길이 5분(300초) 이상만 선정해 쇼츠를 제외함."
        },
        {
          "at": "MIN_VIEW_COUNT = 1000",
          "text": "최소 조회수 1000회 이상만 선정함."
        },
        {
          "at": "CHUNK_SIZE_SECONDS = 120",
          "text": "자막을 2분(120초) 단위로 잘라 시점별 토막을 만듦."
        },
        {
          "at": "TRANSCRIPT_MAX_RETRIES = 4",
          "text": "자막 요청이 차단될 때 다시 시도할 최대 횟수."
        },
        {
          "at": "TRANSCRIPT_BACKOFF_BASE = 3",
          "text": "차단 시 기다리는 시간의 기준(초): 3→6→12→24로 늘어남(지수 백오프)."
        },
        {
          "at": "EMBEDDING_MODEL = \"text-embedding-3-small\"",
          "text": "자막을 벡터로 바꿀 임베딩 모델 — 인덱싱·질의가 같아야 검색됨(1536차원)."
        },
        {
          "at": "LLM_MODEL = \"openai/gpt-oss-120b\"",
          "text": "답변을 생성할 Groq LPU LLM 이름."
        },
        {
          "at": "RETRIEVE_K = 10",
          "text": "최종 검색해 LLM에 넘길 자막 토막 수(k)."
        },
        {
          "at": "FETCH_K = 30",
          "text": "MMR이 다양성 계산을 위해 먼저 가져올 후보 토막 수(fetch_k)."
        },
        {
          "at": "LAMBDA_MULT = 0.5",
          "text": "MMR의 관련성↔다양성 가중치(0.5=균형)."
        },
        {
          "at": "SYSTEM_PROMPT = \"\"\"당신은 YouTube 영상 자막을",
          "text": "LLM에게 '자막만 근거로, 시점 URL을 함께 제시하라'고 지시하는 시스템 프롬프트."
        }
      ],
      "code": "from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함\n\nimport argparse\nimport json\nimport os\nimport re\nimport sys\nimport time\nfrom datetime import datetime, timedelta, timezone\nfrom pathlib import Path\nfrom urllib.parse import parse_qs, quote, urlparse\n\n# Windows 콘솔 기본 인코딩(cp949)에서 한글·이모지 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함\nif hasattr(sys.stdout, \"reconfigure\"):\n    sys.stdout.reconfigure(encoding=\"utf-8\")\n\n# ---------------------------------------------------------------------------\n# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)\n# ---------------------------------------------------------------------------\nSCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(youtube-rag/)를 절대경로로 구함\nHANDS_ON_DIR = SCRIPT_DIR.parent.parent          # hands-on/ (youtube-rag → 12.web-youtube-search → hands-on)\nENV_PATH = HANDS_ON_DIR / \".env\"                 # hands-on/.env (API 키 보관)\nCHROMA_DIR = SCRIPT_DIR / \"chroma_db\"            # ChromaDB 영속화 디렉터리 (자동 생성)\nSEARCH_CACHE_DIR = SCRIPT_DIR / \".cache\"         # YouTube 검색 결과 캐시 디렉터리\nSEARCH_CACHE_PATH = SEARCH_CACHE_DIR / \"youtube_search_results.json\"  # 최종 선정 영상 메타데이터 캐시 파일\nTRANSCRIPT_CACHE_PATH = SEARCH_CACHE_DIR / \"youtube_transcript_results.json\"  # 영상별 자막 스니펫 캐시 파일\n\n# ---------------------------------------------------------------------------\n# 환경변수 로드\n# ---------------------------------------------------------------------------\nfrom dotenv import load_dotenv\n\nload_dotenv(ENV_PATH)  # .env에서 YOUTUBE_API_KEY(검색)·OPENAI_API_KEY(임베딩)·GROQ_API_KEY(LLM)를 로드함\n\n# ---------------------------------------------------------------------------\n# 상수 정의\n# ---------------------------------------------------------------------------\n# 검색 토픽: {화면 표시 라벨: Data API 검색어}\n# 'Antigravity'·'Codex'는 단어만으로는 의미가 모호(노래·의학 용어 등)하므로 검색어에 제공사를 붙여 명확화함\nTOPICS = {\n    \"Claude Code\": \"Claude Code\",\n    \"Antigravity\": \"Google Antigravity\",\n    \"Codex\": \"OpenAI Codex\",\n}\n\n# Multi-Query 관점: 토픽마다 아래 관점을 결합해 여러 검색어를 만들어 회수율을 높임\n# 예) \"Claude Code 특징\", \"Claude Code 활용 방법\", \"Claude Code 스킬 개발\", \"Claude Code 플러그인 개발\"\nASPECTS = [\"특징\", \"활용 방법\", \"스킬 개발\", \"플러그인 개발\"]\n\nRECENT_DAYS = 90                 # 영상 조회 기준: 오늘로부터 최근 90일(약 3개월) 이내 업로드\nMIN_DURATION_SECONDS = 300       # 영상 조회 기준: 최소 길이 5분(300초) 이상 (쇼츠 제외)\nMIN_VIEW_COUNT = 1000            # 영상 조회 기준: 최소 조회수 1000회 이상\nVIDEOS_PER_TOPIC = 10            # 토픽별로 선정할 영상 수 (완료 기준: 토픽당 10개)\nSEARCH_MAX_RESULTS = 25          # 멀티쿼리 1건당 가져올 후보 수 (최대 50, 토픽당 4쿼리 × 25 = 후보 충분)\nSEARCH_CACHE_TTL_SECONDS = 24 * 60 * 60  # YouTube 검색 결과 캐시 유효시간(24시간)\n\nCHUNK_SIZE_SECONDS = 120         # 자막 청킹 단위 2분(120초) (작으면 문맥 손실, 크면 시점 정확도 저하)\nTRANSCRIPT_LANGUAGES = [\"ko\", \"en\"]  # 자막 언어 우선순위: 한국어 → 영어\nTRANSCRIPT_CACHE_TTL_SECONDS = 24 * 60 * 60  # YouTube 자막 결과 캐시 유효시간(24시간)\nTRANSCRIPT_DELAY_SECONDS = 1.0   # 영상 사이 간격(초) — 짧은 시간 대량 요청에 의한 IP 차단을 완화\nTRANSCRIPT_MAX_RETRIES = 4       # 차단(RequestBlocked/IpBlocked) 시 재시도 횟수\nTRANSCRIPT_BACKOFF_BASE = 3      # 차단 시 지수 백오프 기본 대기(초): 3 → 6 → 12 → 24\nDEFAULT_WEBSHARE_RETRIES_WHEN_BLOCKED = 10  # Webshare 내부 IP 교체 재시도 횟수\nDEFAULT_WEBSHARE_DOMAIN = \"p.webshare.io\"   # Webshare 레지덴셜 프록시 기본 엔드포인트\nDEFAULT_WEBSHARE_PORT = 80                  # Webshare 기본 프록시 포트\n\nEMBEDDING_MODEL = \"text-embedding-3-small\"   # 임베딩 모델 (인덱싱·질의 동일해야 검색 가능, 1536차원)\nLLM_MODEL = \"openai/gpt-oss-120b\"            # Groq LPU에서 서빙하는 답변 생성용 LLM\nCOLLECTION_NAME = \"youtube_transcripts\"      # ChromaDB 컬렉션명 (인덱싱·질의 동일해야 함)\n\nRETRIEVE_K = 10      # 최종 검색해 LLM에 넘길 청크 수\nFETCH_K = 30         # MMR이 다양성 계산을 위해 먼저 가져올 후보 청크 수 (FETCH_K > RETRIEVE_K)\nLAMBDA_MULT = 0.5    # MMR 관련성 vs 다양성 가중치 (1=관련성만, 0=다양성만, 0.5=균형)\n\n# LLM에 역할·규칙·컨텍스트를 주입하는 시스템 프롬프트 ({context}에 검색된 자막 청크가 삽입됨)\nSYSTEM_PROMPT = \"\"\"당신은 YouTube 영상 자막을 근거로 답변하는 RAG 어시스턴트임.\n\n## 규칙\n1. 아래 [컨텍스트]의 자막 내용만 근거로 답변하고, 없는 내용은 추측하지 말 것\n2. 답변에 사용한 영상의 제목과 타임스탬프 URL(&t=초)을 반드시 함께 제시할 것\n3. \"몇 분부터 보면 되나요?\" 같은 질문에는 정확한 시점(분:초)과 바로가기 URL을 제공할 것\n4. 근거를 찾을 수 없으면 \"인덱싱된 영상에서 관련 내용을 찾을 수 없습니다.\"라고 답할 것\n5. 한국어로 간결하게 답변할 것\n\n## 컨텍스트\n{context}\n\"\"\"\n\nHUMAN_PROMPT = \"{question}\""
    },
    {
      "id": "build_youtube_client",
      "name": "build_youtube_client()",
      "fileId": "main",
      "summary": "YOUTUBE_API_KEY로 YouTube Data API v3에 접속하는 클라이언트(서비스 객체)를 만들어 돌려주는 함수.",
      "how": "google-api-python-client 의 build() 팩토리를 호출해, REST 엔드포인트를 youtube.search().list() 같은 파이썬 메서드로 쓸 수 있는 서비스 객체를 만듦. API 키가 없으면 실행 초기에 바로 명확한 오류를 내 디버깅을 쉽게 함(나중에 엉뚱한 곳에서 실패하는 것 방지).",
      "terms": [
        "YouTube Data API v3",
        "build()",
        "API 키 검사"
      ],
      "lines": [
        {
          "at": "def build_youtube_client():",
          "text": "YouTube Data API 클라이언트를 만드는 함수 정의."
        },
        {
          "at": "api_key = os.getenv(\"YOUTUBE_API_KEY\")",
          "text": "환경변수에서 YouTube 검색용 API 키를 읽음."
        },
        {
          "at": "    if not api_key:",
          "text": "키가 없으면 초기에 명확한 오류를 내 디버깅을 쉽게 함."
        },
        {
          "at": "    return build(\"youtube\", \"v3\"",
          "text": "build() 팩토리로 v3 서비스 객체를 만들어 돌려줌."
        }
      ],
      "code": "def build_youtube_client():\n    \"\"\"YOUTUBE_API_KEY로 YouTube Data API v3 클라이언트를 생성해 반환함.\n\n    build(\"youtube\", \"v3\", developerKey=...): google-api-python-client가 제공하는 팩토리로,\n    REST 엔드포인트를 파이썬 메서드(youtube.search().list() 등)로 노출하는 서비스 객체를 만듦.\n    \"\"\"\n    api_key = os.getenv(\"YOUTUBE_API_KEY\")\n    # API 키 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함\n    if not api_key:\n        raise RuntimeError(f\"YOUTUBE_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요\")\n\n    from googleapiclient.discovery import build\n\n    return build(\"youtube\", \"v3\", developerKey=api_key)"
    },
    {
      "id": "parse_duration_chunked",
      "name": "parse_duration_seconds() · _chunked()",
      "fileId": "main",
      "summary": "영상 길이 문자열(PT15M33S)을 초로 바꾸는 함수와, 긴 리스트를 일정 개수씩 끊어 주는 도우미 함수.",
      "how": "둘 다 검색 단계의 작은 도우미임. ① parse_duration_seconds: YouTube가 영상 길이를 'PT15M33S'(ISO 8601 기간) 형식으로 주므로, 정규표현식으로 시·분·초를 뽑아 총 초로 합산함(없는 단위는 0). ② _chunked: videos.list 가 한 번에 ID 50개까지만 받으므로, 긴 ID 목록을 50개씩 끊어 차례로 내주는 제너레이터임.",
      "terms": [
        "ISO 8601 duration(PT15M33S)",
        "정규표현식",
        "re.match",
        "videos.list"
      ],
      "lines": [
        {
          "at": "def parse_duration_seconds(iso_duration: str) -> int:",
          "text": "ISO 8601 길이 문자열을 총 초로 바꾸는 함수 정의."
        },
        {
          "at": "    match = re.match(r\"PT(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+)S)?\", iso_duration or \"\")",
          "text": "정규표현식으로 시(H)·분(M)·초(S)를 뽑음 — 각 단위는 선택적 그룹."
        },
        {
          "at": "    hours, minutes, seconds = (int(value) if value else 0 for value in match.groups())",
          "text": "매칭 안 된 단위(None)는 0으로 처리하며 세 그룹을 정수화."
        },
        {
          "at": "    return hours * 3600 + minutes * 60 + seconds",
          "text": "시·분·초를 초 단위로 합산해 돌려줌."
        },
        {
          "at": "def _chunked(items: list, size: int):",
          "text": "리스트를 size개씩 끊어 순회하는 제너레이터 함수 정의."
        },
        {
          "at": "    for start in range(0, len(items), size):",
          "text": "0부터 size 간격으로 인덱스를 옮기며 부분 리스트를 내줌."
        }
      ],
      "code": "def parse_duration_seconds(iso_duration: str) -> int:\n    \"\"\"ISO 8601 길이 문자열(예: 'PT1H2M3S')을 총 초로 변환함.\n\n    YouTube Data API의 contentDetails.duration은 'PT15M33S'처럼 ISO 8601 기간 형식으로 옴.\n    정규표현식으로 시(H)·분(M)·초(S)를 뽑아 초 단위 정수로 합산함.\n    \"\"\"\n    # (?:(\\d+)H)?: 시 부분이 있으면 숫자를 캡처(없으면 None). 분·초도 동일한 선택적 그룹임\n    match = re.match(r\"PT(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+)S)?\", iso_duration or \"\")\n    if not match:\n        return 0\n    # 제너레이터로 세 그룹을 정수화: 매칭 안 된 그룹(None)은 0으로 처리함\n    hours, minutes, seconds = (int(value) if value else 0 for value in match.groups())\n    return hours * 3600 + minutes * 60 + seconds\n\n\ndef _chunked(items: list, size: int):\n    \"\"\"리스트를 size개씩 끊어 순회하는 제너레이터 (videos.list가 한 번에 최대 50개 ID만 받음).\"\"\"\n    for start in range(0, len(items), size):\n        yield items[start:start + size]"
    },
    {
      "id": "search_cache",
      "name": "검색 캐시 (cache_key / parse_cache_datetime / load / save)",
      "fileId": "main",
      "summary": "YouTube 검색 결과를 24시간 동안 파일에 저장·재사용해 Data API 호출(할당량)을 아끼는 함수 묶음.",
      "how": "검색 조건이 같으면 어제 결과를 그대로 쓰자는 아이디어임(TTL 캐시). ① get_search_cache_key: 토픽·관점·필터 조건을 묶어 '이 결과가 어떤 조건으로 만들어졌는지' 표시하는 키를 만듦. ② parse_cache_datetime: 저장된 ISO 8601 시각 문자열을 시간대 정보가 있는 시각으로 되돌림. ③ load_search_cache: 파일이 있고·조건이 같고·24시간이 안 지났으면 캐시를 읽어 옴(아니면 None). ④ save_search_cache: 새 검색 결과를 만료 시각과 함께 JSON으로 저장함.",
      "terms": [
        "TTL 캐시",
        "ISO 8601",
        "publishedAfter",
        "Multi-Query(멀티쿼리)"
      ],
      "lines": [
        {
          "at": "def get_search_cache_key() -> dict:",
          "text": "검색 조건(토픽·관점·필터)을 묶어 캐시 키로 만드는 함수 정의."
        },
        {
          "at": "def parse_cache_datetime(value: str) -> datetime:",
          "text": "저장된 ISO 8601 시각 문자열을 시간대 정보가 있는 datetime으로 되돌리는 함수 정의."
        },
        {
          "at": "def load_search_cache() -> dict | None:",
          "text": "TTL이 남고 조건이 같은 검색 캐시를 읽어 오는 함수 정의."
        },
        {
          "at": "    if not SEARCH_CACHE_PATH.exists():",
          "text": "캐시 파일이 아예 없으면 None을 돌려줌(캐시 미스)."
        },
        {
          "at": "    if cache.get(\"cache_key\") != get_search_cache_key():",
          "text": "검색 조건이 바뀌었으면 캐시를 무시함."
        },
        {
          "at": "    if datetime.now(timezone.utc) >= expires_at:",
          "text": "만료 시각이 지났으면 캐시를 무시함."
        },
        {
          "at": "def save_search_cache(videos: list[dict], per_topic_selected: dict[str, int]) -> None:",
          "text": "검색 결과를 만료 시각과 함께 JSON 파일로 저장하는 함수 정의."
        },
        {
          "at": "        \"expires_at\": (now + timedelta(seconds=SEARCH_CACHE_TTL_SECONDS)).isoformat(),",
          "text": "지금 시각에 24시간을 더해 만료 시각을 기록함."
        }
      ],
      "code": "def get_search_cache_key() -> dict:\n    \"\"\"검색 조건을 캐시 키로 묶어 반환함.\"\"\"\n    return {\n        \"topics\": [{\"label\": label, \"query\": query} for label, query in TOPICS.items()],\n        \"aspects\": list(ASPECTS),\n        \"recent_days\": RECENT_DAYS,\n        \"min_duration_seconds\": MIN_DURATION_SECONDS,\n        \"min_view_count\": MIN_VIEW_COUNT,\n        \"videos_per_topic\": VIDEOS_PER_TOPIC,\n        \"search_max_results\": SEARCH_MAX_RESULTS,\n    }\n\n\ndef parse_cache_datetime(value: str) -> datetime:\n    \"\"\"캐시 파일의 ISO 8601 시각 문자열을 timezone-aware datetime으로 변환함.\"\"\"\n    return datetime.fromisoformat(value.replace(\"Z\", \"+00:00\"))\n\n\ndef load_search_cache() -> dict | None:\n    \"\"\"24시간 TTL이 남아 있고 검색 조건이 같은 YouTube 검색 캐시를 로드함.\"\"\"\n    if not SEARCH_CACHE_PATH.exists():\n        return None\n\n    try:\n        with SEARCH_CACHE_PATH.open(\"r\", encoding=\"utf-8\") as file:\n            cache = json.load(file)\n    except (OSError, json.JSONDecodeError) as error:\n        print(f\"  [검색 캐시 무시] 캐시 파일을 읽을 수 없음: {type(error).__name__}\")\n        return None\n\n    if cache.get(\"cache_key\") != get_search_cache_key():\n        print(\"  [검색 캐시 무시] 검색 조건이 변경됨\")\n        return None\n\n    try:\n        expires_at = parse_cache_datetime(cache[\"expires_at\"])\n    except (KeyError, ValueError, TypeError):\n        print(\"  [검색 캐시 무시] 만료 시각 형식이 올바르지 않음\")\n        return None\n\n    if datetime.now(timezone.utc) >= expires_at:\n        print(f\"  [검색 캐시 만료] {SEARCH_CACHE_PATH}\")\n        return None\n\n    videos = cache.get(\"videos\")\n    if not isinstance(videos, list):\n        print(\"  [검색 캐시 무시] 영상 목록 형식이 올바르지 않음\")\n        return None\n\n    return cache\n\n\ndef save_search_cache(videos: list[dict], per_topic_selected: dict[str, int]) -> None:\n    \"\"\"YouTube 검색 결과를 TTL 24시간 캐시 파일로 저장함.\"\"\"\n    now = datetime.now(timezone.utc)\n    cache = {\n        \"version\": 1,\n        \"created_at\": now.isoformat(),\n        \"expires_at\": (now + timedelta(seconds=SEARCH_CACHE_TTL_SECONDS)).isoformat(),\n        \"ttl_seconds\": SEARCH_CACHE_TTL_SECONDS,\n        \"cache_key\": get_search_cache_key(),\n        \"per_topic_selected\": per_topic_selected,\n        \"videos\": videos,\n    }\n\n    SEARCH_CACHE_DIR.mkdir(parents=True, exist_ok=True)\n    with SEARCH_CACHE_PATH.open(\"w\", encoding=\"utf-8\") as file:\n        json.dump(cache, file, ensure_ascii=False, indent=2)\n    print(f\"  [검색 캐시 저장] {SEARCH_CACHE_PATH}\")"
    },
    {
      "id": "print_search_summary",
      "name": "print_search_summary()",
      "fileId": "main",
      "summary": "토픽별 선정 영상 개수와 전체 고유 영상 수를 보기 좋게 출력하고, 목표 미달이면 경고하는 함수.",
      "how": "인덱싱 '완료 기준'(토픽당 10개)이 채워졌는지 눈으로 확인하게 해 주는 보고용 함수임. 토픽마다 '10개 중 몇 개'를 OK/부족 표시와 함께 찍고, 토픽 중복을 뺀 전체 고유 영상 수를 출력함. 하나라도 부족하면 마지막에 경고를 남겨, 조건을 만족하는 최근 영상이 모자랐음을 알림.",
      "terms": [
        "회수율(recall)"
      ],
      "lines": [
        {
          "at": "def print_search_summary(per_topic_selected: dict[str, int], unique_count: int) -> None:",
          "text": "선정 요약을 출력하는 함수 정의."
        },
        {
          "at": "        status = \"OK\" if count >= VIDEOS_PER_TOPIC else \"부족\"",
          "text": "토픽별 선정 수가 목표(10개)를 채웠는지 OK/부족으로 표시."
        },
        {
          "at": "    print(f\"  전체 고유 영상(토픽 중복 제거 후): {unique_count}개\")",
          "text": "토픽 간 중복을 뺀 전체 고유 영상 수를 출력."
        },
        {
          "at": "    if not all_met:",
          "text": "한 토픽이라도 목표에 미달하면 경고를 출력함."
        }
      ],
      "code": "def print_search_summary(per_topic_selected: dict[str, int], unique_count: int) -> None:\n    \"\"\"토픽별 선정 개수와 전체 고유 영상 수를 출력함.\"\"\"\n    print(\"\\n  [선정 요약]\")\n    all_met = True\n    for label, count in per_topic_selected.items():\n        status = \"OK\" if count >= VIDEOS_PER_TOPIC else \"부족\"\n        if count < VIDEOS_PER_TOPIC:\n            all_met = False\n        print(f\"    - {label}: {count}/{VIDEOS_PER_TOPIC}개 ({status})\")\n    print(f\"  전체 고유 영상(토픽 중복 제거 후): {unique_count}개\")\n    if not all_met:\n        print(\"  [경고] 일부 토픽이 목표 개수에 미달함 (조건을 만족하는 최근 영상이 부족)\")"
    },
    {
      "id": "search_topic_videos",
      "name": "search_topic_videos()",
      "fileId": "main",
      "summary": "한 토픽을 멀티쿼리로 검색하고, 조건을 통과한 상위 영상의 메타데이터를 뽑아 돌려주는 함수.",
      "how": "[1단계]의 핵심임. ① ASPECTS 를 붙인 여러 검색어로 search.list 를 호출해(최근 90일 이후) 영상 ID를 모으고 중복을 제거함. ② videos.list 로 ID들의 길이·조회수·제목을 한 번에 최대 50개씩 받아 옴. ③ 길이 5분↑·조회수 1000회↑ 조건으로 거름. ④ 조회수 내림차순으로 정렬해 상위 10개를 선정함. 결과는 제목·채널·URL·조회수·길이 등이 담긴 dict 리스트임.",
      "terms": [
        "Multi-Query(멀티쿼리)",
        "search.list",
        "videos.list",
        "publishedAfter",
        "ISO 8601",
        "회수율(recall)"
      ],
      "lines": [
        {
          "at": "def search_topic_videos(youtube, label: str, base_query: str) -> list[dict]:",
          "text": "한 토픽을 멀티쿼리 검색·필터·선정하는 함수 정의."
        },
        {
          "at": "    ).strftime(\"%Y-%m-%dT%H:%M:%SZ\")",
          "text": "최근 90일 이전 시점을 ISO 8601 형식 문자열로 만들어 publishedAfter에 씀."
        },
        {
          "at": "    for aspect in ASPECTS:",
          "text": "토픽에 4가지 관점을 결합해 멀티쿼리 검색어를 만듦."
        },
        {
          "at": "        response = youtube.search().list(",
          "text": "search.list 엔드포인트로 검색어에 맞는 영상 ID를 받아 옴."
        },
        {
          "at": "                seen_ids.setdefault(video_id, query)",
          "text": "같은 영상이 여러 쿼리에서 나와도 1회만 유지(중복 제거)."
        },
        {
          "at": "        detail = youtube.videos().list(",
          "text": "videos.list로 ID들의 길이·조회수·제목 상세 정보를 가져옴."
        },
        {
          "at": "            duration_seconds = parse_duration_seconds(item[\"contentDetails\"][\"duration\"])",
          "text": "ISO 8601 길이 문자열을 초로 변환함."
        },
        {
          "at": "            if duration_seconds < MIN_DURATION_SECONDS or view_count < MIN_VIEW_COUNT:",
          "text": "길이 5분 미만 또는 조회수 1000회 미만이면 제외(조건 필터)."
        },
        {
          "at": "    candidates.sort(key=lambda v: v[\"view_count\"], reverse=True)",
          "text": "조회수 내림차순으로 정렬함."
        },
        {
          "at": "    selected = candidates[:VIDEOS_PER_TOPIC]",
          "text": "정렬된 후보에서 상위 10개를 선정함."
        }
      ],
      "code": "def search_topic_videos(youtube, label: str, base_query: str) -> list[dict]:\n    \"\"\"한 토픽을 Multi-Query로 검색하고 조건을 만족하는 상위 영상 메타데이터를 반환함.\n\n    처리 흐름:\n      1. ASPECTS를 결합한 여러 검색어로 search.list 호출(최근 RECENT_DAYS 이내) → 영상 ID 수집·중복 제거\n      2. videos.list로 ID들의 상세 정보(길이·조회수·제목) 조회 (한 번에 최대 50개 배치)\n      3. 길이 ≥ 5분, 조회수 ≥ 1000회 조건으로 필터\n      4. 조회수 내림차순 정렬 후 상위 VIDEOS_PER_TOPIC개 선정\n\n    Returns:\n        영상 메타데이터 dict 리스트 [{video_id, title, channel, url, published_at, view_count, duration_seconds, topic}]\n    \"\"\"\n    # 날짜 필터: 오늘(UTC) 기준 RECENT_DAYS 이전 시점을 ISO 8601(RFC 3339)로 만들어 publishedAfter에 사용함\n    published_after = (\n        datetime.now(timezone.utc) - timedelta(days=RECENT_DAYS)\n    ).strftime(\"%Y-%m-%dT%H:%M:%SZ\")\n\n    # 1) 멀티쿼리 검색 → 영상 ID 중복 제거 (dict로 모아 같은 영상이 여러 쿼리에서 나와도 1회만 유지)\n    seen_ids: dict[str, str] = {}\n    for aspect in ASPECTS:\n        query = f\"{base_query} {aspect}\"\n        # search.list: 검색어로 영상을 찾는 엔드포인트 (호출당 100 units 소비)\n        # relevanceLanguage는 지정하지 않음 — 영어권 콘텐츠가 많은 토픽이라 한국어로 제한하면 회수율이 떨어짐\n        response = youtube.search().list(\n            q=query,\n            part=\"id\",                     # 상세 정보는 videos.list로 받으므로 검색에선 ID만 요청\n            type=\"video\",\n            order=\"relevance\",\n            publishedAfter=published_after,  # 이 시점 이후 업로드된 영상만 (최근 3개월)\n            maxResults=SEARCH_MAX_RESULTS,\n        ).execute()\n        for item in response.get(\"items\", []):\n            video_id = item[\"id\"].get(\"videoId\")\n            if video_id:\n                seen_ids.setdefault(video_id, query)  # 최초로 매칭된 검색어를 기록(없을 때만 추가)\n\n    # 2) 상세 정보 조회: videos.list로 길이(contentDetails)·조회수(statistics)·제목(snippet)을 가져옴\n    candidates: list[dict] = []\n    for id_batch in _chunked(list(seen_ids.keys()), 50):\n        detail = youtube.videos().list(\n            part=\"contentDetails,statistics,snippet\",\n            id=\",\".join(id_batch),\n        ).execute()\n        for item in detail.get(\"items\", []):\n            duration_seconds = parse_duration_seconds(item[\"contentDetails\"][\"duration\"])\n            # 일부 영상은 조회수를 비공개로 두어 viewCount 키가 없을 수 있으므로 기본값 0으로 처리함\n            view_count = int(item[\"statistics\"].get(\"viewCount\", 0))\n\n            # 3) 조건 필터: 길이 5분 이상 + 조회수 1000회 이상 (최근 3개월은 publishedAfter로 이미 보장)\n            if duration_seconds < MIN_DURATION_SECONDS or view_count < MIN_VIEW_COUNT:\n                continue\n\n            candidates.append({\n                \"video_id\": item[\"id\"],\n                \"title\": item[\"snippet\"][\"title\"],\n                \"channel\": item[\"snippet\"][\"channelTitle\"],\n                \"url\": f\"https://www.youtube.com/watch?v={item['id']}\",\n                \"published_at\": item[\"snippet\"][\"publishedAt\"],\n                \"view_count\": view_count,\n                \"duration_seconds\": duration_seconds,\n                \"topic\": label,\n            })\n\n    # 4) 조회수 내림차순 정렬 후 상위 N개 선정\n    candidates.sort(key=lambda v: v[\"view_count\"], reverse=True)\n    selected = candidates[:VIDEOS_PER_TOPIC]\n\n    print(f\"  [{label}] 검색어 {len(ASPECTS)}개 → 후보 {len(seen_ids)}개 → 조건통과 {len(candidates)}개 → 선정 {len(selected)}개\")\n    return selected"
    },
    {
      "id": "search_all_topics",
      "name": "search_all_topics()",
      "fileId": "main",
      "summary": "모든 토픽을 검색해 선정 영상을 합치고, 토픽 간 중복 영상을 제거하며, 캐시가 있으면 재사용하는 함수.",
      "how": "[1단계]의 지휘부임. 먼저 24시간 캐시가 살아 있으면 API를 안 부르고 캐시 영상을 그대로 돌려줌(--refresh-search-cache 면 무시). 캐시가 없으면 build_youtube_client 로 클라이언트를 만들고 토픽마다 search_topic_videos 를 돌려, video_id 기준으로 전역 중복을 제거함(한 영상이 여러 토픽에서 잡혀도 1회만). 마지막에 선정 요약을 출력하고 결과를 캐시에 저장함.",
      "terms": [
        "TTL 캐시",
        "Multi-Query(멀티쿼리)",
        "YouTube Data API v3"
      ],
      "lines": [
        {
          "at": "def search_all_topics(youtube=None, refresh_cache: bool = False) -> list[dict]:",
          "text": "전 토픽 검색·중복 제거·캐시 관리를 지휘하는 함수 정의."
        },
        {
          "at": "    if not refresh_cache:",
          "text": "캐시 갱신 옵션이 없으면 먼저 캐시를 확인함."
        },
        {
          "at": "            print(f\"  [검색 캐시 재사용] {len(videos)}개 영상",
          "text": "캐시가 살아 있으면 API 호출 없이 캐시 영상을 재사용함."
        },
        {
          "at": "    if youtube is None:",
          "text": "캐시가 없을 때만 실제 YouTube 클라이언트를 만듦."
        },
        {
          "at": "    for label, base_query in TOPICS.items():",
          "text": "토픽마다 search_topic_videos로 영상을 검색·선정함."
        },
        {
          "at": "            unique_videos.setdefault(video[\"video_id\"], video)",
          "text": "video_id 기준으로 토픽 간 중복 영상을 제거함(처음 토픽 유지)."
        },
        {
          "at": "    save_search_cache(videos, per_topic_selected)",
          "text": "선정 결과를 24시간 캐시에 저장함."
        }
      ],
      "code": "def search_all_topics(youtube=None, refresh_cache: bool = False) -> list[dict]:\n    \"\"\"모든 토픽을 검색해 선정 영상을 합치고, 토픽 간 중복 영상은 제거해 반환함.\n\n    한 영상이 여러 토픽(예: 'Claude Code vs Codex' 비교 영상)에서 동시에 선정될 수 있으므로,\n    인덱싱 시 같은 자막이 두 번 저장되지 않도록 video_id 기준 전역 중복 제거를 수행함(처음 토픽 유지).\n    토픽별 선정 개수는 완료 기준(토픽당 10개) 충족 여부를 보여주는 게이트로 로그에 출력함.\n    TTL 24시간이 남은 검색 캐시가 있으면 YouTube Data API를 호출하지 않고 캐시를 재사용함.\n    \"\"\"\n    print(\"\\n\" + \"=\" * 70)\n    print(f\"[1단계] YouTube Data API 검색 + 조건 필터 (최근 {RECENT_DAYS}일·{MIN_DURATION_SECONDS // 60}분↑·{MIN_VIEW_COUNT}회↑)\")\n    print(\"=\" * 70)\n\n    if not refresh_cache:\n        cache = load_search_cache()\n        if cache:\n            videos = cache[\"videos\"]\n            expires_at = parse_cache_datetime(cache[\"expires_at\"])\n            print(f\"  [검색 캐시 재사용] {len(videos)}개 영상, 만료: {expires_at.astimezone().strftime('%Y-%m-%d %H:%M:%S %Z')}\")\n            print_search_summary(cache.get(\"per_topic_selected\", {}), len(videos))\n            return videos\n\n    if refresh_cache:\n        print(\"  [검색 캐시 갱신] --refresh-search-cache 옵션으로 새로 검색함\")\n\n    if youtube is None:\n        youtube = build_youtube_client()\n\n    per_topic_selected: dict[str, int] = {}\n    unique_videos: dict[str, dict] = {}  # video_id → 메타데이터 (전역 중복 제거용)\n    for label, base_query in TOPICS.items():\n        selected = search_topic_videos(youtube, label, base_query)\n        per_topic_selected[label] = len(selected)\n        for video in selected:\n            unique_videos.setdefault(video[\"video_id\"], video)  # 이미 다른 토픽에서 잡힌 영상은 건너뜀\n\n    videos = list(unique_videos.values())\n    print_search_summary(per_topic_selected, len(videos))\n    save_search_cache(videos, per_topic_selected)\n\n    return videos"
    },
    {
      "id": "env_helpers",
      "name": "get_env_int() · get_env_csv()",
      "fileId": "main",
      "summary": "프록시 설정에 쓰는 환경변수를 안전하게 읽는 도우미: 정수형 변수와 쉼표 목록형 변수를 각각 처리함.",
      "how": "프록시 관련 환경변수를 다루는 작은 도우미 두 개임. ① get_env_int: 정수 환경변수를 읽되 비어 있으면 기본값을 쓰고, 숫자가 아니거나 최소값보다 작으면 명확한 오류를 냄. ② get_env_csv: 'kr, us' 처럼 쉼표로 적은 값을 다듬어 ['kr','us'] 리스트로 바꿔 줌(비어 있으면 None).",
      "terms": [
        "프록시(proxy)",
        "Webshare",
        "API 키 검사"
      ],
      "lines": [
        {
          "at": "def get_env_int(name: str, default: int, minimum: int = 0) -> int:",
          "text": "정수형 환경변수를 안전하게 읽는 함수 정의(기본값·최소값 검사)."
        },
        {
          "at": "        value = int(raw_value)",
          "text": "문자열 환경변수를 정수로 변환함."
        },
        {
          "at": "    if value < minimum:",
          "text": "최소값보다 작으면 명확한 오류를 냄."
        },
        {
          "at": "def get_env_csv(name: str) -> list[str] | None:",
          "text": "쉼표로 구분한 환경변수를 리스트로 바꾸는 함수 정의."
        },
        {
          "at": "    values = [item.strip().lower() for item in raw_value.split(\",\") if item.strip()]",
          "text": "쉼표로 나눠 공백을 다듬고 소문자로 만든 리스트를 만듦."
        }
      ],
      "code": "def get_env_int(name: str, default: int, minimum: int = 0) -> int:\n    \"\"\"정수형 환경변수를 읽고, 비어 있으면 기본값을 반환함.\"\"\"\n    raw_value = os.getenv(name)\n    if not raw_value:\n        return default\n\n    try:\n        value = int(raw_value)\n    except ValueError as error:\n        raise RuntimeError(f\"{name}는 정수로 설정 필요: 현재값={raw_value}\") from error\n\n    if value < minimum:\n        raise RuntimeError(f\"{name}는 {minimum} 이상으로 설정 필요: 현재값={raw_value}\")\n    return value\n\n\ndef get_env_csv(name: str) -> list[str] | None:\n    \"\"\"쉼표로 구분한 환경변수를 리스트로 변환함.\"\"\"\n    raw_value = os.getenv(name)\n    if not raw_value:\n        return None\n\n    values = [item.strip().lower() for item in raw_value.split(\",\") if item.strip()]\n    return values or None"
    },
    {
      "id": "normalize_youtube_video_id",
      "name": "normalize_youtube_video_id()",
      "fileId": "main",
      "summary": "여러 형태의 YouTube 주소나 ID에서 11자리 영상 ID만 깔끔히 뽑아내는 함수.",
      "how": "check-proxy 처럼 사용자가 URL 또는 ID를 자유롭게 넣을 수 있어, 입력을 표준 11자리 ID로 통일함. ① 이미 11자리 ID 형태면 정규표현식으로 확인해 그대로 반환함. ② watch?v=... 주소는 쿼리에서 v 값을 꺼냄. ③ youtu.be/..., /shorts/, /embed/, /live/ 형태는 경로에서 ID를 꺼냄. 어디서도 못 찾으면 명확한 오류를 냄.",
      "terms": [
        "정규표현식",
        "&t=초(타임스탬프 URL)"
      ],
      "lines": [
        {
          "at": "def normalize_youtube_video_id(video_ref: str) -> str:",
          "text": "URL/ID에서 11자리 영상 ID를 뽑는 함수 정의."
        },
        {
          "at": "    if re.fullmatch(r\"[A-Za-z0-9_-]{11}\", video_ref):",
          "text": "이미 11자리 ID 형태면 정규표현식으로 확인해 그대로 반환."
        },
        {
          "at": "    query_video_ids = parse_qs(parsed.query).get(\"v\", [])",
          "text": "watch?v=... 주소의 쿼리에서 v 값을 꺼냄."
        },
        {
          "at": "    if parsed.netloc.endswith(\"youtu.be\") and path_parts:",
          "text": "youtu.be 단축 주소는 경로 첫 조각이 영상 ID임."
        },
        {
          "at": "    if len(path_parts) >= 2 and path_parts[0] in {\"shorts\", \"embed\", \"live\"}:",
          "text": "shorts/embed/live 경로는 두 번째 조각이 영상 ID임."
        }
      ],
      "code": "def normalize_youtube_video_id(video_ref: str) -> str:\n    \"\"\"YouTube 영상 URL 또는 ID에서 11자리 video_id를 추출함.\"\"\"\n    video_ref = video_ref.strip()\n    if re.fullmatch(r\"[A-Za-z0-9_-]{11}\", video_ref):\n        return video_ref\n\n    parsed = urlparse(video_ref)\n    query_video_ids = parse_qs(parsed.query).get(\"v\", [])\n    if query_video_ids:\n        return query_video_ids[0]\n\n    path_parts = [part for part in parsed.path.split(\"/\") if part]\n    if parsed.netloc.endswith(\"youtu.be\") and path_parts:\n        return path_parts[0]\n    if len(path_parts) >= 2 and path_parts[0] in {\"shorts\", \"embed\", \"live\"}:\n        return path_parts[1]\n\n    raise RuntimeError(f\"YouTube 영상 URL 또는 11자리 video_id 필요: {video_ref}\")"
    },
    {
      "id": "webshare_helpers",
      "name": "Webshare 프록시 헬퍼 (has_params / build_url / build_rotating_config)",
      "fileId": "main",
      "summary": "Webshare 레지덴셜 프록시 설정을 만드는 도우미 묶음: 파라미터 판별·URL 조합·회전형 설정 생성.",
      "how": "IP 차단을 피하기 위한 프록시 설정 부품들임. ① has_webshare_username_parameters: Webshare username 에 이미 국가·세션·rotate 같은 파라미터가 붙었는지 정규표현식으로 판별함. ② build_webshare_proxy_url: 아이디·비밀번호·도메인·포트를 requests 가 쓰는 'http://id:pw@host:port/' 형태로 안전하게 조합함. ③ build_rotating_generic_proxy_config: 요청마다 프록시 IP가 바뀌도록(연결 재사용 방지) 회전형 설정 클래스를 즉석에서 만들어 돌려줌.",
      "terms": [
        "프록시(proxy)",
        "Webshare",
        "정규표현식",
        "RequestBlocked"
      ],
      "lines": [
        {
          "at": "def has_webshare_username_parameters(username: str) -> bool:",
          "text": "username에 국가·세션·rotate 파라미터가 이미 있는지 판별하는 함수 정의."
        },
        {
          "at": "        bool(re.search(r\"(?:^|-)[a-z]{2}(?:-|$)\", lower_username))",
          "text": "정규표현식으로 두 글자 국가 코드가 붙어 있는지 검사."
        },
        {
          "at": "def build_webshare_proxy_url(username: str, password: str, domain_name: str, proxy_port: int) -> str:",
          "text": "아이디·비밀번호·도메인·포트를 프록시 URL로 조합하는 함수 정의."
        },
        {
          "at": "    return f\"http://{encoded_username}:{encoded_password}@{domain_name}:{proxy_port}/\"",
          "text": "requests가 쓰는 인증 포함 프록시 URL 형태로 만들어 돌려줌."
        },
        {
          "at": "def build_rotating_generic_proxy_config(",
          "text": "회전형 프록시 설정 클래스를 즉석에서 만드는 함수 정의."
        },
        {
          "at": "        def prevent_keeping_connections_alive(self) -> bool:",
          "text": "TCP 연결 재사용을 막아 요청마다 프록시 IP가 바뀌게 함."
        }
      ],
      "code": "def has_webshare_username_parameters(username: str) -> bool:\n    \"\"\"Webshare username에 국가·도시·세션·rotate 파라미터가 이미 붙었는지 판단함.\"\"\"\n    lower_username = username.lower()\n    return (\n        bool(re.search(r\"(?:^|-)[a-z]{2}(?:-|$)\", lower_username))\n        or \"-city_\" in lower_username\n        or lower_username.endswith(\"-rotate\")\n        or bool(re.search(r\"-\\d+$\", lower_username))\n    )\n\n\ndef build_webshare_proxy_url(username: str, password: str, domain_name: str, proxy_port: int) -> str:\n    \"\"\"Webshare username/password/domain/port를 requests 프록시 URL로 조합함.\"\"\"\n    encoded_username = quote(username, safe=\"-_.~\")\n    encoded_password = quote(password, safe=\"\")\n    return f\"http://{encoded_username}:{encoded_password}@{domain_name}:{proxy_port}/\"\n\n\ndef build_rotating_generic_proxy_config(\n    GenericProxyConfig,\n    http_url: str | None,\n    https_url: str | None,\n    retries_when_blocked: int,\n):\n    \"\"\"회전형 프록시 URL을 그대로 쓰면서 차단 재시도와 keep-alive 방지를 적용한 설정을 생성함.\"\"\"\n\n    class RotatingGenericProxyConfig(GenericProxyConfig):\n        \"\"\"GenericProxyConfig에 회전형 프록시용 동작을 추가한 로컬 설정 클래스.\"\"\"\n\n        @property\n        def prevent_keeping_connections_alive(self) -> bool:\n            \"\"\"TCP 연결 재사용을 막아 요청마다 프록시 회전이 반영되도록 함.\"\"\"\n            return True\n\n        @property\n        def retries_when_blocked(self) -> int:\n            \"\"\"youtube-transcript-api 내부 RequestBlocked 재시도 횟수를 반환함.\"\"\"\n            return retries_when_blocked\n\n    return RotatingGenericProxyConfig(http_url=http_url, https_url=https_url)"
    },
    {
      "id": "build_transcript_client",
      "name": "build_transcript_client()",
      "fileId": "main",
      "summary": "환경변수에 따라 프록시를 적용한 youtube-transcript-api 자막 클라이언트를 만들어 돌려주는 함수.",
      "how": "자막을 가져올 클라이언트를 준비하되, IP 차단에 대응할 프록시를 우선순위로 고름. ① YT_PROXY_HTTP/HTTPS 가 있으면 검증된 프록시 URL을 그대로 씀. ② 없고 YT_WEBSHARE_USER/PASS 가 있으면 Webshare 레지덴셜 프록시를 씀(username에 파라미터가 이미 있으면 그대로, 없으면 자동 rotate). ③ 둘 다 없으면 프록시 없이 직결함. 어떤 방식을 골랐는지 라벨과 함께 클라이언트를 돌려줌.",
      "terms": [
        "youtube-transcript-api",
        "프록시(proxy)",
        "Webshare",
        "RequestBlocked",
        "자막(transcript)"
      ],
      "lines": [
        {
          "at": "def build_transcript_client() -> tuple:",
          "text": "프록시 우선순위에 따라 자막 클라이언트를 만드는 함수 정의."
        },
        {
          "at": "    from youtube_transcript_api import YouTubeTranscriptApi  # 1.x 인스턴스 API: .fetch(video_id, languages=...)",
          "text": "자막을 가져오는 youtube-transcript-api 클래스를 가져옴."
        },
        {
          "at": "    if proxy_http or proxy_https:",
          "text": "①검증된 HTTP(S) 프록시 URL이 있으면 그대로 사용함."
        },
        {
          "at": "    elif webshare_user and webshare_pass:",
          "text": "②Webshare 아이디·비밀번호가 있으면 Webshare 프록시를 사용함."
        },
        {
          "at": "        if has_webshare_username_parameters(webshare_user):",
          "text": "username에 국가·세션이 이미 있으면 그대로, 없으면 자동 rotate로 분기."
        },
        {
          "at": "            proxy_config = WebshareProxyConfig(",
          "text": "WebshareProxyConfig로 자동 회전형 프록시 설정을 만듦."
        },
        {
          "at": "        proxy_config = None",
          "text": "③프록시 정보가 전혀 없으면 직결(프록시 없음)로 둠."
        },
        {
          "at": "    return YouTubeTranscriptApi(proxy_config=proxy_config), label",
          "text": "프록시가 적용된 자막 클라이언트와 라벨을 함께 돌려줌."
        }
      ],
      "code": "def build_transcript_client() -> tuple:\n    \"\"\"youtube-transcript-api 클라이언트를 생성함 (환경변수가 있으면 프록시 적용).\n\n    YouTube가 짧은 시간 대량 요청을 IP 차단(RequestBlocked/IpBlocked)하므로 프록시로 우회할 수 있음.\n    LangChain YoutubeLoader는 프록시 인자가 없어 youtube-transcript-api를 직접 사용함. 적용 우선순위:\n      1) YT_PROXY_HTTP / YT_PROXY_HTTPS      → 검증된 HTTP(S) 프록시 URL을 그대로 사용\n      2) YT_WEBSHARE_USER + YT_WEBSHARE_PASS → Webshare 레지덴셜 프록시 (IP 차단에 가장 효과적)\n      3) 둘 다 없으면 → 프록시 없이 직결 (차단 시 백오프 재시도로 대응)\n\n    참고: YouTube Data API의 captions.download는 OAuth + 본인 소유 영상만 가능해 제3자 영상 자막에는 쓸 수 없음.\n    \"\"\"\n    from youtube_transcript_api import YouTubeTranscriptApi  # 1.x 인스턴스 API: .fetch(video_id, languages=...)\n    from youtube_transcript_api.proxies import GenericProxyConfig, WebshareProxyConfig  # 프록시 설정 클래스\n\n    webshare_user = os.getenv(\"YT_WEBSHARE_USER\")\n    webshare_pass = os.getenv(\"YT_WEBSHARE_PASS\")\n    proxy_http = os.getenv(\"YT_PROXY_HTTP\")\n    proxy_https = os.getenv(\"YT_PROXY_HTTPS\")\n\n    if proxy_http or proxy_https:\n        # curl로 검증한 프록시 URL은 추가 변형 없이 그대로 사용함.\n        proxy_config = build_rotating_generic_proxy_config(\n            GenericProxyConfig,\n            http_url=proxy_http or proxy_https,\n            https_url=proxy_https or proxy_http,\n            retries_when_blocked=get_env_int(\n                \"YT_PROXY_RETRIES_WHEN_BLOCKED\",\n                DEFAULT_WEBSHARE_RETRIES_WHEN_BLOCKED,\n            ),\n        )\n        label = \"일반/직접 프록시\"\n    elif webshare_user and webshare_pass:\n        webshare_locations = get_env_csv(\"YT_WEBSHARE_LOCATIONS\")\n        webshare_domain = os.getenv(\"YT_WEBSHARE_DOMAIN\") or DEFAULT_WEBSHARE_DOMAIN\n        webshare_port = get_env_int(\"YT_WEBSHARE_PORT\", DEFAULT_WEBSHARE_PORT, minimum=1)\n        retries_when_blocked = get_env_int(\n            \"YT_WEBSHARE_RETRIES_WHEN_BLOCKED\",\n            DEFAULT_WEBSHARE_RETRIES_WHEN_BLOCKED,\n        )\n\n        if has_webshare_username_parameters(webshare_user):\n            # Endpoint Generator에서 받은 username은 국가·세션 등이 이미 붙어 있으므로 그대로 사용함.\n            proxy_url = build_webshare_proxy_url(webshare_user, webshare_pass, webshare_domain, webshare_port)\n            proxy_config = build_rotating_generic_proxy_config(\n                GenericProxyConfig,\n                http_url=proxy_url,\n                https_url=proxy_url,\n                retries_when_blocked=retries_when_blocked,\n            )\n            label = \"Webshare 프록시(직접 username)\"\n            if webshare_locations:\n                print(\"  [프록시 설정] username에 국가/세션이 이미 있어 YT_WEBSHARE_LOCATIONS는 무시함\")\n        else:\n            # WebshareProxyConfig는 기본 username에 국가 목록과 -rotate를 붙여 회전형 URL을 구성함.\n            proxy_config = WebshareProxyConfig(\n                proxy_username=webshare_user,\n                proxy_password=webshare_pass,\n                filter_ip_locations=webshare_locations,\n                retries_when_blocked=retries_when_blocked,\n                domain_name=webshare_domain,\n                proxy_port=webshare_port,\n            )\n            label = \"Webshare 프록시(자동 rotate)\"\n            if webshare_locations:\n                label += f\"({','.join(webshare_locations)})\"\n    elif webshare_user or webshare_pass:\n        raise RuntimeError(\"YT_WEBSHARE_USER와 YT_WEBSHARE_PASS는 둘 다 설정 필요\")\n    else:\n        proxy_config = None\n        label = \"직결(프록시 없음)\"\n\n    return YouTubeTranscriptApi(proxy_config=proxy_config), label"
    },
    {
      "id": "transcript_cache",
      "name": "자막 캐시 (cache_key / load_file / load / prune / save)",
      "fileId": "main",
      "summary": "영상별 자막 스니펫을 24시간 동안 파일에 저장·재사용해 반복 인덱싱 시 프록시 요청을 아끼는 함수 묶음.",
      "how": "검색 캐시와 같은 아이디어를 자막에도 적용함(TTL 캐시). ① get_transcript_cache_key: video_id 와 요청 언어를 묶어 영상별 캐시 키를 만듦. ② load_transcript_cache_file: 자막 캐시 파일 전체를 읽어 옴(없으면 빈 구조). ③ load_transcript_cache: 그 영상의 캐시가 24시간 안이면 자막 스니펫을 돌려줌. ④ prune_transcript_cache_entries: 저장 전에 만료된 항목을 솎아냄. ⑤ save_transcript_cache: 새 자막 스니펫을 만료 시각과 함께 저장함.",
      "terms": [
        "TTL 캐시",
        "자막(transcript)",
        "프록시(proxy)",
        "ISO 8601"
      ],
      "lines": [
        {
          "at": "def get_transcript_cache_key(video_id: str) -> str:",
          "text": "영상 ID와 언어 목록을 묶어 자막 캐시 키를 만드는 함수 정의."
        },
        {
          "at": "def load_transcript_cache_file() -> dict:",
          "text": "자막 캐시 파일 전체를 읽어 dict로 돌려주는 함수 정의."
        },
        {
          "at": "def load_transcript_cache(video_id: str) -> list[dict] | None:",
          "text": "24시간 TTL이 남은 영상 자막 캐시를 읽는 함수 정의."
        },
        {
          "at": "    print(f\"       [자막 캐시] 재사용: {len(pieces)}개 스니펫\")",
          "text": "캐시가 살아 있으면 자막 스니펫을 재사용함."
        },
        {
          "at": "def prune_transcript_cache_entries(entries: dict) -> dict:",
          "text": "만료되지 않은 캐시 항목만 남기는 함수 정의."
        },
        {
          "at": "def save_transcript_cache(video_id: str, pieces: list[dict]) -> None:",
          "text": "영상별 자막 스니펫을 만료 시각과 함께 저장하는 함수 정의."
        },
        {
          "at": "    entries = prune_transcript_cache_entries(cache[\"entries\"])",
          "text": "저장 전에 만료된 캐시 항목을 솎아냄."
        }
      ],
      "code": "def get_transcript_cache_key(video_id: str) -> str:\n    \"\"\"video_id와 요청 언어 목록을 조합해 자막 캐시 키를 생성함.\"\"\"\n    return f\"{video_id}|{','.join(TRANSCRIPT_LANGUAGES)}\"\n\n\ndef load_transcript_cache_file() -> dict:\n    \"\"\"자막 캐시 파일 전체를 읽어 dict로 반환함.\"\"\"\n    if not TRANSCRIPT_CACHE_PATH.exists():\n        return {\"version\": 1, \"entries\": {}}\n\n    try:\n        with TRANSCRIPT_CACHE_PATH.open(\"r\", encoding=\"utf-8\") as file:\n            cache = json.load(file)\n    except (OSError, json.JSONDecodeError) as error:\n        print(f\"       [자막 캐시 무시] 캐시 파일을 읽을 수 없음: {type(error).__name__}\")\n        return {\"version\": 1, \"entries\": {}}\n\n    if not isinstance(cache.get(\"entries\"), dict):\n        print(\"       [자막 캐시 무시] entries 형식이 올바르지 않음\")\n        return {\"version\": 1, \"entries\": {}}\n    return cache\n\n\ndef load_transcript_cache(video_id: str) -> list[dict] | None:\n    \"\"\"24시간 TTL이 남아 있는 영상 자막 캐시를 로드함.\"\"\"\n    cache = load_transcript_cache_file()\n    entry = cache[\"entries\"].get(get_transcript_cache_key(video_id))\n    if not entry:\n        return None\n\n    try:\n        expires_at = parse_cache_datetime(entry[\"expires_at\"])\n    except (KeyError, ValueError, TypeError):\n        print(\"       [자막 캐시 무시] 만료 시각 형식이 올바르지 않음\")\n        return None\n\n    if datetime.now(timezone.utc) >= expires_at:\n        return None\n\n    pieces = entry.get(\"pieces\")\n    if not isinstance(pieces, list):\n        print(\"       [자막 캐시 무시] 자막 스니펫 형식이 올바르지 않음\")\n        return None\n\n    print(f\"       [자막 캐시] 재사용: {len(pieces)}개 스니펫\")\n    return pieces\n\n\ndef prune_transcript_cache_entries(entries: dict) -> dict:\n    \"\"\"만료되지 않은 자막 캐시 항목만 남겨 반환함.\"\"\"\n    now = datetime.now(timezone.utc)\n    pruned = {}\n    for key, entry in entries.items():\n        try:\n            expires_at = parse_cache_datetime(entry[\"expires_at\"])\n        except (KeyError, ValueError, TypeError):\n            continue\n        if now < expires_at:\n            pruned[key] = entry\n    return pruned\n\n\ndef save_transcript_cache(video_id: str, pieces: list[dict]) -> None:\n    \"\"\"영상별 자막 스니펫을 TTL 24시간 캐시 파일에 저장함.\"\"\"\n    now = datetime.now(timezone.utc)\n    cache = load_transcript_cache_file()\n    entries = prune_transcript_cache_entries(cache[\"entries\"])\n    entries[get_transcript_cache_key(video_id)] = {\n        \"video_id\": video_id,\n        \"languages\": list(TRANSCRIPT_LANGUAGES),\n        \"created_at\": now.isoformat(),\n        \"expires_at\": (now + timedelta(seconds=TRANSCRIPT_CACHE_TTL_SECONDS)).isoformat(),\n        \"ttl_seconds\": TRANSCRIPT_CACHE_TTL_SECONDS,\n        \"piece_count\": len(pieces),\n        \"pieces\": pieces,\n    }\n\n    SEARCH_CACHE_DIR.mkdir(parents=True, exist_ok=True)\n    with TRANSCRIPT_CACHE_PATH.open(\"w\", encoding=\"utf-8\") as file:\n        json.dump({\"version\": 1, \"entries\": entries}, file, ensure_ascii=False, indent=2)\n    print(f\"       [자막 캐시] 저장: {len(pieces)}개 스니펫\")"
    },
    {
      "id": "chunk_transcript",
      "name": "_chunk_transcript()",
      "fileId": "main",
      "summary": "잘게 흩어진 자막 스니펫을 120초 단위로 묶어 시점 정보가 붙은 Document 토막으로 만드는 함수.",
      "how": "[2단계]의 청킹 핵심임. 자막은 '몇 초에 무슨 말'이 잘게 흩어져 있는데, 이를 120초 경계마다 한 덩어리로 모음. 스니펫 끝 시각이 현재 경계를 넘으면 그때까지 모은 버퍼를 한 청크로 확정하고, 경계를 120초씩 전진함. 각 청크의 start_seconds 는 0, 120, 240… 경계값으로 부여돼 나중에 타임스탬프 URL 계산의 기준이 됨.",
      "terms": [
        "타임스탬프 청킹",
        "자막(transcript)",
        "Document",
        "&t=초(타임스탬프 URL)"
      ],
      "lines": [
        {
          "at": "def _chunk_transcript(pieces: list[dict]) -> list:",
          "text": "자막 스니펫을 120초 단위 Document로 묶는 함수 정의."
        },
        {
          "at": "    from langchain_core.documents import Document  # page_content + metadata를 담는 LangChain 기본 문서 객체",
          "text": "본문과 메타데이터를 담는 LangChain Document 객체를 가져옴."
        },
        {
          "at": "        piece_end = piece[\"start\"] + piece[\"duration\"]",
          "text": "각 스니펫이 끝나는 시각을 계산함."
        },
        {
          "at": "        if piece_end > time_limit:",
          "text": "경계를 넘는 순간 직전까지 모은 버퍼를 한 청크로 확정함."
        },
        {
          "at": "            chunk_start = time_limit",
          "text": "다음 청크의 시작 시점을 현재 경계값으로 옮김."
        },
        {
          "at": "            time_limit += CHUNK_SIZE_SECONDS",
          "text": "경계를 120초만큼 전진시킴."
        }
      ],
      "code": "def _chunk_transcript(pieces: list[dict]) -> list:\n    \"\"\"raw 자막 스니펫([{text,start,duration}])을 CHUNK_SIZE_SECONDS 단위 Document로 묶음.\n\n    LangChain YoutubeLoader의 CHUNKS 모드와 동일 로직: 스니펫 끝 시각이 현재 청크 경계를 넘으면\n    버퍼를 한 청크로 확정하고 경계를 한 단계(CHUNK_SIZE_SECONDS) 전진함. 각 청크의 start_seconds는\n    경계값(0, 120, 240 …)으로 부여되어 타임스탬프 URL 계산 기준이 됨.\n    \"\"\"\n    from langchain_core.documents import Document  # page_content + metadata를 담는 LangChain 기본 문서 객체\n\n    chunks = []\n    buffer: list[dict] = []\n    chunk_start = 0\n    time_limit = CHUNK_SIZE_SECONDS\n    for piece in pieces:\n        piece_end = piece[\"start\"] + piece[\"duration\"]\n        # 경계를 넘는 순간 직전까지 모은 버퍼를 한 청크로 확정함\n        if piece_end > time_limit:\n            if buffer:\n                text = \" \".join(p[\"text\"].strip() for p in buffer)\n                chunks.append(Document(page_content=text, metadata={\"start_seconds\": chunk_start}))\n            buffer = []\n            chunk_start = time_limit\n            time_limit += CHUNK_SIZE_SECONDS\n        buffer.append(piece)\n    # 마지막 남은 버퍼를 청크로 확정함\n    if buffer:\n        text = \" \".join(p[\"text\"].strip() for p in buffer)\n        chunks.append(Document(page_content=text, metadata={\"start_seconds\": chunk_start}))\n    return chunks"
    },
    {
      "id": "fetch_transcript_pieces",
      "name": "_fetch_transcript_pieces()",
      "fileId": "main",
      "summary": "한 영상의 자막 스니펫을 가져오되, 차단되면 점점 더 오래 기다리며 재시도하는 함수.",
      "how": "[2단계]의 자막 호출부임. 먼저 캐시가 있으면 그대로 쓰고, 없으면 ytt_api.fetch() 로 ko→en 우선순위 자막을 받아 [{text,start,duration}] 리스트로 바꿈. YouTube가 차단(RequestBlocked)하면 3→6→12→24초로 대기 시간을 두 배씩 늘리며 재시도하고(지수 백오프), 마지막 시도까지 막히면 예외를 위로 전파해 '차단 지속'으로 처리함.",
      "terms": [
        "자막(transcript)",
        "youtube-transcript-api",
        "지수 백오프",
        "RequestBlocked",
        "TTL 캐시"
      ],
      "lines": [
        {
          "at": "def _fetch_transcript_pieces(",
          "text": "한 영상의 자막 스니펫을 캐시·재시도와 함께 가져오는 함수 정의."
        },
        {
          "at": "        cached_pieces = load_transcript_cache(video_id)",
          "text": "캐시가 있고 갱신 옵션이 없으면 캐시 자막을 그대로 씀."
        },
        {
          "at": "    for attempt in range(TRANSCRIPT_MAX_RETRIES + 1):",
          "text": "최대 재시도 횟수만큼 자막 호출을 반복 시도함."
        },
        {
          "at": "            fetched = ytt_api.fetch(video_id, languages=TRANSCRIPT_LANGUAGES)",
          "text": "ko→en 우선순위로 자막을 실제로 가져옴."
        },
        {
          "at": "            pieces = fetched.to_raw_data()",
          "text": "받은 자막을 [{text,start,duration}] 리스트로 변환함."
        },
        {
          "at": "            wait = TRANSCRIPT_BACKOFF_BASE * (2 ** attempt)  # 3 → 6 → 12 → 24초",
          "text": "차단 시 대기 시간을 두 배씩 늘림(지수 백오프)."
        }
      ],
      "code": "def _fetch_transcript_pieces(\n    ytt_api,\n    video_id: str,\n    use_cache: bool = True,\n    refresh_cache: bool = False,\n    delay_before_request: bool = False,\n) -> list:\n    \"\"\"자막 스니펫을 조회함. 차단(RequestBlocked)이면 지수 백오프로 재시도하고, 영구 오류는 그대로 전파함.\n\n    fetch(video_id, languages=...): TRANSCRIPT_LANGUAGES 우선순위(ko→en)로 자막을 찾아 가져옴.\n    to_raw_data(): FetchedTranscript를 [{text,start,duration}] 리스트로 변환함.\n    \"\"\"\n    from youtube_transcript_api import RequestBlocked  # IpBlocked의 상위 클래스 — 둘 다 이 except로 잡힘\n\n    if use_cache and not refresh_cache:\n        cached_pieces = load_transcript_cache(video_id)\n        if cached_pieces is not None:\n            return cached_pieces\n\n    if delay_before_request:\n        time.sleep(TRANSCRIPT_DELAY_SECONDS)\n\n    for attempt in range(TRANSCRIPT_MAX_RETRIES + 1):\n        try:\n            fetched = ytt_api.fetch(video_id, languages=TRANSCRIPT_LANGUAGES)\n            pieces = fetched.to_raw_data()\n            if use_cache:\n                save_transcript_cache(video_id, pieces)\n            return pieces\n        except RequestBlocked:\n            # 마지막 시도까지 차단되면 예외를 상위로 전파해 '차단 지속'으로 처리함\n            if attempt >= TRANSCRIPT_MAX_RETRIES:\n                raise\n            wait = TRANSCRIPT_BACKOFF_BASE * (2 ** attempt)  # 3 → 6 → 12 → 24초\n            print(f\"       [차단] 재시도 {attempt + 1}/{TRANSCRIPT_MAX_RETRIES} — {wait}초 대기\")\n            time.sleep(wait)"
    },
    {
      "id": "load_transcripts",
      "name": "load_transcripts()",
      "fileId": "main",
      "summary": "선정 영상마다 자막을 120초 청크로 추출하고, 각 청크에 타임스탬프 URL과 영상 메타데이터를 붙이는 함수.",
      "how": "[2단계]의 지휘부임. build_transcript_client 로 클라이언트를 만들고, 영상마다 _fetch_transcript_pieces 로 자막을 받아 _chunk_transcript 로 120초 청크로 만듦. 각 청크에 청크 시작 초를 분:초로 바꾼 표시와 &t=초 바로가기 URL, 제목·채널·조회수 등(자막엔 video_id뿐이라 검색 결과에서 가져와 주입)을 붙임. 자막이 없으면 건너뛰고, 차단이 끝까지 지속되면 프록시 설정을 권장함. 모든 청크를 모은 Document 리스트를 돌려줌.",
      "terms": [
        "자막(transcript)",
        "타임스탬프 청킹",
        "&t=초(타임스탬프 URL)",
        "divmod",
        "RequestBlocked",
        "프록시(proxy)",
        "Document"
      ],
      "lines": [
        {
          "at": "def load_transcripts(videos: list[dict], refresh_transcript_cache: bool = False) -> list:",
          "text": "선정 영상들의 자막을 추출·청킹·메타데이터 주입하는 함수 정의."
        },
        {
          "at": "    ytt_api, proxy_label = build_transcript_client()",
          "text": "프록시가 적용된 자막 클라이언트를 준비함."
        },
        {
          "at": "    for index, video in enumerate(videos, start=1):",
          "text": "선정된 영상들을 1번부터 차례로 처리함."
        },
        {
          "at": "            docs = _chunk_transcript(pieces)                      # 120초 청크 Document로 변환",
          "text": "받은 자막 스니펫을 120초 청크 Document로 변환함."
        },
        {
          "at": "                minutes, seconds = divmod(start_seconds, 60)  # divmod: 몫(분)과 나머지(초)를 한 번에 반환",
          "text": "divmod로 시작 초를 분·초로 한 번에 나눔."
        },
        {
          "at": "                    \"timestamp_url\": f\"{video['url']}&t={start_seconds}\",",
          "text": "&t=초 형식의 해당 시점 바로가기 URL을 메타데이터에 넣음."
        },
        {
          "at": "        except RequestBlocked:",
          "text": "차단이 재시도 끝까지 지속되면 건너뛰고 프록시 설정을 권장함."
        }
      ],
      "code": "def load_transcripts(videos: list[dict], refresh_transcript_cache: bool = False) -> list:\n    \"\"\"영상별 자막을 120초 청크로 추출하고, 각 청크에 타임스탬프 URL·영상 메타데이터를 부여함.\n\n    YoutubeLoader 대신 youtube-transcript-api를 직접 사용함 — 프록시 설정과 백오프 재시도로 IP 차단에 대응하기 위함.\n    자막에는 video_id뿐이므로 제목·채널·조회수는 Data API 검색 결과(videos 인자)에서 가져와 주입함.\n    자막이 없는 영상(쇼츠·특정 언어만 존재 등)은 건너뛰고, 차단이 끝까지 지속되면 프록시 설정을 권장함.\n    성공한 자막 스니펫은 24시간 TTL 캐시에 저장하고, 캐시가 있으면 프록시 요청 없이 재사용함.\n\n    Returns:\n        Document 리스트 (각 Document = 120초 자막 청크 + 메타데이터)\n    \"\"\"\n    from youtube_transcript_api import RequestBlocked  # 차단(IpBlocked 포함) — 끝까지 실패 시 프록시 권장 안내\n\n    ytt_api, proxy_label = build_transcript_client()\n\n    print(\"\\n\" + \"=\" * 70)\n    print(f\"[2단계] 자막 추출 (youtube-transcript-api, {CHUNK_SIZE_SECONDS}초 청킹, 언어 {TRANSCRIPT_LANGUAGES}, {proxy_label})\")\n    print(\"=\" * 70)\n\n    all_docs = []\n    indexed_count = 0\n    skipped_count = 0\n\n    for index, video in enumerate(videos, start=1):\n        video_id = video[\"video_id\"]\n        title = video[\"title\"]\n        print(f\"  ({index}/{len(videos)}) [{video['topic']}] {title[:50]}\")\n\n        try:\n            pieces = _fetch_transcript_pieces(\n                ytt_api,\n                video_id,\n                refresh_cache=refresh_transcript_cache,\n                delay_before_request=True,\n            )\n            docs = _chunk_transcript(pieces)                      # 120초 청크 Document로 변환\n\n            # 자막 스니펫이 비어 청크가 없는 경우 건너뜀\n            if not docs:\n                print(\"       [자막 없음] 건너뜀\")\n                skipped_count += 1\n                continue\n\n            # 각 청크에 타임스탬프 URL과 Data API 메타데이터를 주입함\n            for doc in docs:\n                start_seconds = int(doc.metadata.get(\"start_seconds\", 0))  # 청크 시작 시점(초)\n                minutes, seconds = divmod(start_seconds, 60)  # divmod: 몫(분)과 나머지(초)를 한 번에 반환\n\n                doc.metadata.update({\n                    \"video_id\": video_id,\n                    \"title\": title,\n                    \"channel\": video[\"channel\"],\n                    \"topic\": video[\"topic\"],\n                    \"view_count\": video[\"view_count\"],\n                    \"published_at\": video[\"published_at\"],\n                    \"video_url\": video[\"url\"],\n                    # &t=초: 해당 시점부터 재생되는 YouTube 바로가기 URL\n                    \"timestamp_url\": f\"{video['url']}&t={start_seconds}\",\n                    \"timestamp_display\": f\"{minutes}:{seconds:02d}\",  # 02d: 두 자리로 0 패딩 (예: 2:05)\n                })\n\n            all_docs.extend(docs)\n            indexed_count += 1\n            print(f\"       [OK] {len(docs)}개 청크\")\n\n        # 차단이 재시도 끝까지 지속된 경우: 건너뛰고 프록시 설정을 권장함\n        except RequestBlocked:\n            print(\"       [차단 지속] 건너뜀 — 프록시 설정 권장(YT_WEBSHARE_USER/PASS 또는 YT_PROXY_HTTP/HTTPS)\")\n            skipped_count += 1\n            continue\n\n        # 자막 미존재(NoTranscriptFound)·비활성(TranscriptsDisabled)·영상 불가 등은 개별 영상 단위로 건너뜀\n        except Exception as error:\n            print(f\"       [실패] 건너뜀: {type(error).__name__}\")\n            skipped_count += 1\n            continue\n\n    print(f\"\\n  자막 추출 완료: 성공 {indexed_count}개 / 건너뜀 {skipped_count}개 / 총 청크 {len(all_docs)}개\")\n    return all_docs"
    },
    {
      "id": "run_check_proxy",
      "name": "run_check_proxy()",
      "fileId": "main",
      "summary": "지정한 영상 1건으로 자막 프록시 연결이 잘 되는지 빠르게 점검하는 함수(check-proxy 모드).",
      "how": "본격 인덱싱 전에 프록시·자막 접근이 동작하는지 한 영상으로 미리 확인하는 진단 도구임. 입력을 normalize_youtube_video_id 로 11자리 ID로 바꾸고, 캐시 없이 _fetch_transcript_pieces 로 자막을 받아 봄. 차단되면 프록시 설정을 권장하고, 프록시 연결 실패면 URL/위치 설정을 점검하라고 안내함. 성공하면 받은 스니펫 수와 앞부분 미리보기를 출력함.",
      "terms": [
        "프록시(proxy)",
        "자막(transcript)",
        "RequestBlocked",
        "서브커맨드"
      ],
      "lines": [
        {
          "at": "def run_check_proxy(video_ref: str) -> None:",
          "text": "영상 1건으로 자막 프록시 연결을 점검하는 함수 정의."
        },
        {
          "at": "    video_id = normalize_youtube_video_id(video_ref)",
          "text": "입력한 URL/ID를 11자리 영상 ID로 표준화함."
        },
        {
          "at": "        pieces = _fetch_transcript_pieces(ytt_api, video_id, use_cache=False)",
          "text": "캐시 없이 실제로 자막을 가져와 연결을 점검함."
        },
        {
          "at": "        print(\"[실패] YouTube가 현재 IP 또는 프록시 IP를 계속 차단함\")",
          "text": "차단이 지속되면 프록시 설정을 권장함."
        },
        {
          "at": "        if type(error).__name__ == \"ProxyError\" or \"ProxyError\" in repr(error):",
          "text": "프록시 연결 자체가 실패하면 URL/위치 설정 점검을 안내함."
        },
        {
          "at": "    preview = \" \".join(piece[\"text\"].strip() for piece in pieces[:3])",
          "text": "성공 시 앞 스니펫 3개로 미리보기 문자열을 만듦."
        }
      ],
      "code": "def run_check_proxy(video_ref: str) -> None:\n    \"\"\"지정 영상 1건으로 youtube-transcript-api 프록시 연결을 점검함.\"\"\"\n    from youtube_transcript_api import RequestBlocked\n\n    video_id = normalize_youtube_video_id(video_ref)\n    ytt_api, proxy_label = build_transcript_client()\n\n    print(\"\\n\" + \"=\" * 70)\n    print(f\"[프록시 점검] video_id={video_id} / 연결={proxy_label}\")\n    print(\"=\" * 70)\n\n    try:\n        pieces = _fetch_transcript_pieces(ytt_api, video_id, use_cache=False)\n    except RequestBlocked:\n        print(\"[실패] YouTube가 현재 IP 또는 프록시 IP를 계속 차단함\")\n        print(\"       Webshare 레지덴셜 프록시 또는 회전형 HTTP(S) 프록시 설정 필요\")\n        return\n    except Exception as error:\n        if type(error).__name__ == \"ProxyError\" or \"ProxyError\" in repr(error):\n            print(f\"[실패] 프록시 연결 실패: {error}\")\n            print(\"       curl로 검증한 전체 프록시 URL은 YT_PROXY_HTTP/HTTPS에 그대로 설정 권장\")\n            print(\"       Webshare username에 국가/세션이 이미 있으면 YT_WEBSHARE_LOCATIONS는 제거 권장\")\n            return\n        print(f\"[실패] {type(error).__name__}: {error}\")\n        print(\"       영상에 ko/en 자막이 없거나, 프록시 인증/주소가 잘못되었을 수 있음\")\n        return\n\n    preview = \" \".join(piece[\"text\"].strip() for piece in pieces[:3])\n    print(f\"[OK] 자막 스니펫 {len(pieces)}개 수신\")\n    print(f\"     미리보기: {preview[:160]}\")"
    },
    {
      "id": "vectorstore_build",
      "name": "get_embeddings() · create_or_update_vectorstore()",
      "fileId": "main",
      "summary": "임베딩 모델을 만들고, 자막 청크를 벡터로 바꿔 ChromaDB에 최초 생성 또는 추가 저장하는 함수 묶음([3단계]).",
      "how": "[3단계]의 핵심임. ① get_embeddings: OpenAI text-embedding-3-small 임베딩 모델을 만듦(인덱싱·질의가 같아야 검색됨). ② create_or_update_vectorstore: chroma_db 폴더가 있으면 기존 컬렉션을 열어 add_documents() 로 청크를 누적하고, 없으면 from_documents() 로 새 컬렉션을 만들어 디스크에 영속화함(폴더 존재로 최초/추가를 자동 판별).",
      "terms": [
        "임베딩",
        "OpenAIEmbeddings",
        "text-embedding-3-small",
        "Chroma",
        "ChromaDB",
        "컬렉션",
        "영속화",
        "add_documents",
        "from_documents",
        "Document"
      ],
      "lines": [
        {
          "at": "def get_embeddings():",
          "text": "질의·인덱싱 공용 임베딩 모델을 만드는 함수 정의."
        },
        {
          "at": "    if not os.getenv(\"OPENAI_API_KEY\"):",
          "text": "임베딩용 OpenAI 키가 없으면 초기에 명확한 오류를 냄."
        },
        {
          "at": "    return OpenAIEmbeddings(model=EMBEDDING_MODEL)",
          "text": "지정한 임베딩 모델로 OpenAIEmbeddings를 만들어 돌려줌."
        },
        {
          "at": "def create_or_update_vectorstore(docs: list):",
          "text": "자막 청크를 ChromaDB에 최초 생성 또는 추가하는 함수 정의."
        },
        {
          "at": "    if CHROMA_DIR.exists():",
          "text": "DB 폴더 존재 여부로 최초/추가 인덱싱을 자동 판별함."
        },
        {
          "at": "        vectorstore.add_documents(docs)           # add_documents(): 각 청크를 임베딩해 컬렉션에 추가",
          "text": "기존 컬렉션이면 add_documents로 청크를 누적함."
        },
        {
          "at": "        vectorstore = Chroma.from_documents(",
          "text": "DB가 없으면 from_documents로 새 컬렉션을 만들어 영속화함."
        }
      ],
      "code": "def get_embeddings():\n    \"\"\"OpenAI text-embedding-3-small 임베딩 모델을 생성해 반환함 (인덱싱·질의 공용).\n\n    OpenAIEmbeddings: 텍스트를 1536차원 실수 벡터로 변환하는 LangChain 래퍼 (OPENAI_API_KEY 자동 참조).\n    인덱싱과 질의에 반드시 같은 모델을 써야 벡터 공간이 일치해 유사도 검색이 정상 동작함.\n    \"\"\"\n    if not os.getenv(\"OPENAI_API_KEY\"):\n        raise RuntimeError(f\"OPENAI_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요\")\n\n    from langchain_openai import OpenAIEmbeddings\n\n    return OpenAIEmbeddings(model=EMBEDDING_MODEL)\n\n\ndef create_or_update_vectorstore(docs: list):\n    \"\"\"자막 청크를 임베딩해 ChromaDB에 저장함. DB 없으면 최초 생성, 있으면 추가(자동 감지).\n\n    - 최초 인덱싱: Chroma.from_documents()로 새 컬렉션 생성 후 디스크에 영속화\n    - 추가 인덱싱: 기존 컬렉션을 열어 add_documents()로 청크를 누적\n    \"\"\"\n    from langchain_chroma import Chroma  # 영속화된 벡터 컬렉션을 다루는 LangChain 벡터 저장소 래퍼\n\n    print(\"\\n\" + \"=\" * 70)\n    embeddings = get_embeddings()\n\n    # CHROMA_DIR 존재 여부로 최초/추가 인덱싱을 자동 판별함\n    if CHROMA_DIR.exists():\n        print(\"[3단계] 추가 인덱싱 (기존 벡터 DB에 누적)\")\n        print(\"=\" * 70)\n        vectorstore = Chroma(\n            collection_name=COLLECTION_NAME,\n            embedding_function=embeddings,\n            persist_directory=str(CHROMA_DIR),\n        )\n        before = vectorstore._collection.count()  # _collection.count(): 컬렉션에 저장된 벡터 수\n        vectorstore.add_documents(docs)           # add_documents(): 각 청크를 임베딩해 컬렉션에 추가\n        after = vectorstore._collection.count()\n        print(f\"  기존 {before}개 → 추가 {len(docs)}개 → 총 {after}개 청크\")\n    else:\n        print(\"[3단계] 최초 인덱싱 (벡터 DB 신규 생성)\")\n        print(\"=\" * 70)\n        # from_documents(): 문서들을 임베딩해 새 컬렉션을 만들고 persist_directory에 영속화함\n        vectorstore = Chroma.from_documents(\n            documents=docs,\n            embedding=embeddings,\n            collection_name=COLLECTION_NAME,\n            persist_directory=str(CHROMA_DIR),\n        )\n        print(f\"  생성 완료: {vectorstore._collection.count()}개 청크 → {CHROMA_DIR}\")\n\n    return vectorstore"
    },
    {
      "id": "run_indexing",
      "name": "run_indexing()",
      "fileId": "main",
      "summary": "검색 → 자막 추출 → 벡터 DB 저장으로 이어지는 인덱싱 전체 파이프라인을 실행하는 함수.",
      "how": "[1]~[3]단계를 순서대로 묶는 지휘부임. --reset 이면 기존 벡터 DB를 통째로 지우고 시작함. search_all_topics 로 영상을 고르고(없으면 종료), load_transcripts 로 자막 청크를 만들고(없으면 종료), create_or_update_vectorstore 로 ChromaDB에 저장함. 마지막에 챗봇 실행 방법을 안내함.",
      "terms": [
        "Multi-Query(멀티쿼리)",
        "타임스탬프 청킹",
        "ChromaDB",
        "서브커맨드"
      ],
      "lines": [
        {
          "at": "def run_indexing(",
          "text": "인덱싱 전체 파이프라인을 실행하는 함수 정의."
        },
        {
          "at": "    if reset and CHROMA_DIR.exists():",
          "text": "--reset이면 기존 벡터 DB를 통째로 삭제함."
        },
        {
          "at": "        shutil.rmtree(CHROMA_DIR)",
          "text": "디렉터리 트리를 통째로 지움."
        },
        {
          "at": "    videos = search_all_topics(refresh_cache=refresh_search_cache)",
          "text": "[1단계] 영상 검색·선정을 수행함."
        },
        {
          "at": "    docs = load_transcripts(videos, refresh_transcript_cache=refresh_transcript_cache)",
          "text": "[2단계] 자막을 120초 청크로 추출함."
        },
        {
          "at": "    create_or_update_vectorstore(docs)",
          "text": "[3단계] 청크를 ChromaDB에 저장함."
        }
      ],
      "code": "def run_indexing(\n    reset: bool = False,\n    refresh_search_cache: bool = False,\n    refresh_transcript_cache: bool = False,\n) -> None:\n    \"\"\"검색 → 자막 추출 → 벡터 DB 저장으로 이어지는 인덱싱 전체 파이프라인을 실행함.\"\"\"\n    # --reset: 기존 벡터 DB를 삭제하고 처음부터 다시 인덱싱함\n    if reset and CHROMA_DIR.exists():\n        import shutil  # 디렉터리 트리를 통째로 삭제하기 위한 표준 라이브러리\n\n        shutil.rmtree(CHROMA_DIR)\n        print(f\"[reset] 기존 벡터 DB 삭제: {CHROMA_DIR}\")\n\n    videos = search_all_topics(refresh_cache=refresh_search_cache)\n    if not videos:\n        print(\"\\n선정된 영상이 없음. 검색 조건을 확인해야 함.\")\n        return\n\n    docs = load_transcripts(videos, refresh_transcript_cache=refresh_transcript_cache)\n    if not docs:\n        print(\"\\n추출된 자막이 없음. (요청 언어 자막이 있는 영상이 없음)\")\n        return\n\n    create_or_update_vectorstore(docs)\n\n    print(\"\\n\" + \"=\" * 70)\n    print(\"인덱싱 완료. 챗봇 실행: python app.py chat\")\n    print(\"=\" * 70)"
    },
    {
      "id": "rag_components",
      "name": "load_vectorstore() · create_retriever() · create_llm()",
      "fileId": "main",
      "summary": "질의에 필요한 세 부품을 만드는 함수 묶음: 인덱싱된 벡터 DB 로드·MMR 검색기·Groq LLM.",
      "how": "질의(chat/ask)에 쓸 부품을 준비함. ① load_vectorstore: 인덱싱이 끝난 ChromaDB 컬렉션을 (질의도 같은 임베딩으로) 열어 옴(폴더 없거나 비면 오류). ② create_retriever: 벡터 스토어를 MMR 검색기로 바꿈 — 후보 30개(fetch_k) 중 관련성과 다양성을 함께 보고 10개(k)를 골라 여러 영상의 관점을 골고루 회수함. ③ create_llm: Groq의 gpt-oss-120b 채팅 모델을 만듦 — 추론 과정이 답에 섞이지 않게 reasoning_format=\"hidden\" 으로 최종 답만 받음.",
      "terms": [
        "Chroma",
        "ChromaDB",
        "영속화",
        "컬렉션",
        "MMR",
        "fetch_k",
        "lambda_mult",
        "retriever",
        "as_retriever",
        "ChatGroq",
        "Groq LPU",
        "gpt-oss-120b",
        "reasoning_format",
        "temperature"
      ],
      "lines": [
        {
          "at": "def load_vectorstore():",
          "text": "인덱싱된 ChromaDB 컬렉션을 여는 함수 정의."
        },
        {
          "at": "    if not CHROMA_DIR.exists():",
          "text": "인덱싱이 선행돼야 하므로 벡터 DB 폴더 존재를 확인함."
        },
        {
          "at": "    count = vectorstore._collection.count()",
          "text": "컬렉션에 저장된 청크 수를 셈."
        },
        {
          "at": "    if count == 0:",
          "text": "컬렉션이 비어 있으면 인덱싱 재실행을 요구하는 오류를 냄."
        },
        {
          "at": "def create_retriever(vectorstore):",
          "text": "벡터 스토어를 MMR 검색기로 바꾸는 함수 정의."
        },
        {
          "at": "    return vectorstore.as_retriever(",
          "text": "as_retriever로 MMR 검색기를 만들어 돌려줌."
        },
        {
          "at": "        search_kwargs={\"k\": RETRIEVE_K, \"fetch_k\": FETCH_K, \"lambda_mult\": LAMBDA_MULT},",
          "text": "MMR 설정: 후보 30개 중 관련성·다양성을 보고 10개를 고름."
        },
        {
          "at": "def create_llm():",
          "text": "Groq LLM을 만드는 함수 정의."
        },
        {
          "at": "        reasoning_format=\"hidden\",  # 추론 과정을 숨기고 최종 답변 텍스트만 반환",
          "text": "추론 과정을 숨기고 최종 답변 텍스트만 받도록 설정."
        }
      ],
      "code": "def load_vectorstore():\n    \"\"\"인덱싱된 ChromaDB 컬렉션을 로드함 (질의 임베딩은 인덱싱과 동일한 모델 사용).\"\"\"\n    from langchain_chroma import Chroma\n\n    # 인덱싱이 선행되어야 검색 가능하므로 영속 디렉터리 존재 여부를 먼저 확인함\n    if not CHROMA_DIR.exists():\n        raise FileNotFoundError(\n            f\"벡터 DB가 없음: {CHROMA_DIR}\\n먼저 'python app.py index'로 인덱싱을 수행해야 함\"\n        )\n\n    vectorstore = Chroma(\n        collection_name=COLLECTION_NAME,\n        embedding_function=get_embeddings(),\n        persist_directory=str(CHROMA_DIR),\n    )\n    count = vectorstore._collection.count()\n    if count == 0:\n        raise ValueError(f\"벡터 DB가 비어 있음 (컬렉션 '{COLLECTION_NAME}'). 인덱싱 재실행 필요\")\n    print(f\"  - 벡터 DB 로드 완료: {count}개 청크\")\n    return vectorstore\n\n\ndef create_retriever(vectorstore):\n    \"\"\"벡터 스토어를 MMR 검색기로 변환함 (여러 영상에서 다양한 관점의 청크를 골고루 회수).\n\n    MMR(Maximal Marginal Relevance): FETCH_K개 후보 중 관련성과 다양성을 함께 고려해 RETRIEVE_K개를 선택함.\n    유사한 청크가 한 영상에 몰리는 것을 줄여 답변 근거의 다양성을 확보함.\n    \"\"\"\n    return vectorstore.as_retriever(\n        search_type=\"mmr\",\n        search_kwargs={\"k\": RETRIEVE_K, \"fetch_k\": FETCH_K, \"lambda_mult\": LAMBDA_MULT},\n    )\n\n\ndef create_llm():\n    \"\"\"Groq LPU의 openai/gpt-oss-120b 채팅 모델을 생성해 반환함.\n\n    ChatGroq: Groq Cloud LPU에 채팅 요청을 보내는 LangChain 모델 래퍼 (GROQ_API_KEY 자동 참조).\n    gpt-oss-120b는 추론 모델이라 사고 과정이 답변에 섞일 수 있으므로 reasoning_format=\"hidden\"으로 최종 답변만 받음.\n    \"\"\"\n    if not os.getenv(\"GROQ_API_KEY\"):\n        raise RuntimeError(f\"GROQ_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요\")\n\n    from langchain_groq import ChatGroq\n\n    return ChatGroq(\n        model=LLM_MODEL,\n        temperature=0.3,            # 낮은 값으로 사실 중심·일관된 답변 유도\n        reasoning_format=\"hidden\",  # 추론 과정을 숨기고 최종 답변 텍스트만 반환\n    )"
    },
    {
      "id": "formatters_chain",
      "name": "format_docs() · format_chunks_for_display() · build_rag_chain()",
      "fileId": "main",
      "summary": "검색된 청크를 LLM용 컨텍스트와 사용자용 미리보기로 포맷팅하고, 프롬프트→LLM→파서 체인을 만드는 함수 묶음.",
      "how": "답변 직전의 가공·조립부임. ① format_docs: 청크들을 제목·시작 시점·바로가기 URL 헤더와 함께 하나의 컨텍스트 문자열로 합쳐 LLM이 출처를 인용하기 쉽게 함(청크 사이는 구분선). ② format_chunks_for_display: 같은 청크를 '제목 @ 시점 / URL / 내용 미리보기' 형태로 사람이 보기 좋게 요약함. ③ build_rag_chain: 시스템·휴먼 프롬프트를 묶고 'prompt | llm | parser' 파이프(LCEL)로 답변 문자열을 뽑는 체인을 만듦.",
      "terms": [
        "metadata",
        "&t=초(타임스탬프 URL)",
        "프롬프트",
        "ChatPromptTemplate",
        "LCEL",
        "파이프(|)",
        "StrOutputParser"
      ],
      "lines": [
        {
          "at": "def format_docs(docs: list) -> str:",
          "text": "검색 청크들을 LLM 컨텍스트 문자열로 합치는 함수 정의."
        },
        {
          "at": "        header = f\"[청크 {index}] {meta.get('title', 'Unknown')} (채널: {meta.get('channel', '?')})\"",
          "text": "청크마다 제목·채널 헤더를 붙임."
        },
        {
          "at": "    return \"\\n\\n---\\n\\n\".join(blocks)",
          "text": "청크 블록들을 구분선으로 이어 하나의 컨텍스트로 만듦."
        },
        {
          "at": "def format_chunks_for_display(docs: list) -> str:",
          "text": "검색 청크를 사용자 확인용 요약으로 포맷팅하는 함수 정의."
        },
        {
          "at": "        preview = doc.page_content[:80].replace(\"\\n\", \" \")  # 줄바꿈을 공백으로 바꿔 한 줄로 미리보기",
          "text": "본문 앞 80자를 한 줄 미리보기로 만듦."
        },
        {
          "at": "def build_rag_chain(llm):",
          "text": "프롬프트→LLM→파서 LCEL 체인을 만드는 함수 정의."
        },
        {
          "at": "    return prompt | llm | StrOutputParser()",
          "text": "파이프(|)로 prompt→llm→파서를 연결해 답변 문자열을 뽑음."
        }
      ],
      "code": "def format_docs(docs: list) -> str:\n    \"\"\"검색된 청크들을 LLM 프롬프트용 컨텍스트 문자열로 합침 (제목·시점·바로가기 URL 포함).\"\"\"\n    blocks = []\n    for index, doc in enumerate(docs, start=1):\n        meta = doc.metadata\n        header = f\"[청크 {index}] {meta.get('title', 'Unknown')} (채널: {meta.get('channel', '?')})\"\n        timestamp = f\"  시작 시점: {meta.get('timestamp_display', '0:00')} | 바로가기: {meta.get('timestamp_url', '')}\"\n        blocks.append(f\"{header}\\n{timestamp}\\n\\n{doc.page_content}\")\n    # 청크 사이를 구분선으로 띄워 LLM이 문서 경계를 인식하기 쉽게 함\n    return \"\\n\\n---\\n\\n\".join(blocks)\n\n\ndef format_chunks_for_display(docs: list) -> str:\n    \"\"\"검색된 청크를 사용자 확인용 요약(제목·시점·내용 미리보기)으로 포맷팅함.\"\"\"\n    lines = []\n    for index, doc in enumerate(docs, start=1):\n        meta = doc.metadata\n        preview = doc.page_content[:80].replace(\"\\n\", \" \")  # 줄바꿈을 공백으로 바꿔 한 줄로 미리보기\n        lines.append(\n            f\"  [{index}] {meta.get('title', 'Unknown')[:40]} @ {meta.get('timestamp_display', '0:00')}\\n\"\n            f\"      {meta.get('timestamp_url', '')}\\n\"\n            f\"      {preview}...\"\n        )\n    return \"\\n\".join(lines)\n\n\ndef build_rag_chain(llm):\n    \"\"\"프롬프트 → LLM → 문자열 파서로 이어지는 LCEL 체인을 구성해 반환함.\"\"\"\n    from langchain_core.output_parsers import StrOutputParser  # AIMessage에서 본문 텍스트만 추출\n    from langchain_core.prompts import ChatPromptTemplate      # system/human 메시지 템플릿 구성\n\n    prompt = ChatPromptTemplate.from_messages(\n        [(\"system\", SYSTEM_PROMPT), (\"human\", HUMAN_PROMPT)]\n    )\n    # | 연산자(LCEL): prompt → llm → parser를 파이프라인으로 연결함\n    return prompt | llm | StrOutputParser()"
    },
    {
      "id": "query_run",
      "name": "answer_question() · run_ask() · run_chat()",
      "fileId": "main",
      "summary": "질문으로 청크를 검색·답변하는 핵심 함수와, 단발성(ask)·대화형(chat) 두 실행 모드 함수 묶음.",
      "how": "질의 실행부임. ① answer_question: 질문으로 청크를 회수(없으면 종료)하고, 검색 청크 미리보기를 보여 준 뒤 컨텍스트를 체인에 넣어 답변을 생성·출력함. ② run_ask: 벡터 DB 로드→검색기·체인 준비 후 질문 1건을 처리하고 끝남. ③ run_chat: 같은 준비를 한 뒤 quit/q 입력 전까지 질문을 계속 받는 루프를 돌고, 한 질문의 오류로 루프 전체가 죽지 않게 개별 처리함.",
      "terms": [
        "retriever",
        "invoke",
        "서브커맨드",
        "gpt-oss-120b",
        "MMR"
      ],
      "lines": [
        {
          "at": "def answer_question(question: str, retriever, chain, show_chunks: bool = True) -> str:",
          "text": "질문으로 청크를 검색해 답변을 생성·출력하는 함수 정의."
        },
        {
          "at": "    docs = retriever.invoke(question)  # invoke(): 질문을 임베딩해 유사 청크를 회수",
          "text": "질문을 임베딩해 MMR로 유사 청크를 회수함."
        },
        {
          "at": "        print(format_chunks_for_display(docs))",
          "text": "검색된 청크 미리보기를 먼저 보여 줌."
        },
        {
          "at": "    answer = chain.invoke({\"context\": format_docs(docs), \"question\": question})",
          "text": "청크를 컨텍스트로 넣어 체인으로 답변을 생성함."
        },
        {
          "at": "def run_ask(question: str) -> None:",
          "text": "단발성 질문 1건을 처리하는 함수 정의(ask)."
        },
        {
          "at": "def run_chat() -> None:",
          "text": "대화형 챗봇 루프를 실행하는 함수 정의(chat)."
        },
        {
          "at": "        if question.lower() in {\"quit\", \"q\", \"exit\", \"종료\"}:",
          "text": "quit/q 등을 입력하면 챗봇 루프를 종료함."
        },
        {
          "at": "        except Exception as error:",
          "text": "한 질문의 오류로 루프 전체가 죽지 않게 개별 처리함."
        }
      ],
      "code": "def answer_question(question: str, retriever, chain, show_chunks: bool = True) -> str:\n    \"\"\"질문으로 자막 청크를 검색하고, 그 청크를 컨텍스트로 LLM 답변을 생성해 반환함.\"\"\"\n    docs = retriever.invoke(question)  # invoke(): 질문을 임베딩해 유사 청크를 회수\n    if not docs:\n        print(\"\\n관련 청크를 찾지 못했습니다.\")\n        return \"\"\n\n    if show_chunks:\n        print(f\"\\n[검색된 청크 {len(docs)}개]\")\n        print(format_chunks_for_display(docs))\n\n    print(\"\\n[답변 생성 중...]\\n\")\n    answer = chain.invoke({\"context\": format_docs(docs), \"question\": question})\n    print(\"-\" * 70)\n    print(answer)\n    print(\"-\" * 70)\n    return answer\n\n\ndef run_ask(question: str) -> None:\n    \"\"\"단발성 질문 1건을 처리함 (벡터 DB 로드 → 검색 → 답변).\"\"\"\n    print(\"[1/2] 벡터 DB 로드\")\n    retriever = create_retriever(load_vectorstore())\n    print(\"[2/2] LLM 생성 (Groq openai/gpt-oss-120b)\")\n    chain = build_rag_chain(create_llm())\n\n    print(\"\\n\" + \"=\" * 70)\n    print(f\"[질문] {question}\")\n    print(\"=\" * 70)\n    answer_question(question, retriever, chain)\n\n\ndef run_chat() -> None:\n    \"\"\"대화형 RAG 챗봇 루프를 실행함 ('quit'/'q' 입력 시 종료).\"\"\"\n    print(\"[1/2] 벡터 DB 로드\")\n    retriever = create_retriever(load_vectorstore())\n    print(\"[2/2] LLM 생성 (Groq openai/gpt-oss-120b)\")\n    chain = build_rag_chain(create_llm())\n\n    print(\"\\n\" + \"=\" * 70)\n    print(\"YouTube RAG 챗봇 (Claude Code · Antigravity · Codex 영상 기반)\")\n    print(\"질문을 입력하세요. 종료: quit / q\")\n    print(\"=\" * 70)\n\n    while True:\n        try:\n            question = input(\"\\n질문> \").strip()\n        except (EOFError, KeyboardInterrupt):\n            print(\"\\n챗봇을 종료합니다.\")\n            break\n\n        if not question:\n            continue\n        if question.lower() in {\"quit\", \"q\", \"exit\", \"종료\"}:\n            print(\"챗봇을 종료합니다.\")\n            break\n\n        try:\n            answer_question(question, retriever, chain)\n        # 답변 1건의 오류(네트워크·API 등)로 루프 전체가 죽지 않도록 개별적으로 처리함\n        except Exception as error:\n            print(f\"\\n[오류] {type(error).__name__}: {error}\")"
    },
    {
      "id": "main",
      "name": "main() / __main__ (CLI 모드 분기)",
      "fileId": "main",
      "summary": "명령행 인자를 파싱해 index / check-proxy / chat / ask 서브커맨드를 실행하는 진입부.",
      "how": "프로그램의 출입문임. argparse 로 서브커맨드(index/check-proxy/chat/ask)와 각 옵션(--reset 등)을 정의·파싱함. 인자가 없거나 index 면 인덱싱을, check-proxy/chat/ask 면 해당 함수를 부름. 맨 아래 if __name__ 관용구로 직접 실행할 때만 main 을 돌리고, 전체를 try로 감싸 실패 시 오류를 표준에러로 찍고 종료 코드 1로 끝냄.",
      "terms": [
        "argparse",
        "서브커맨드",
        "if __name__ == \"__main__\""
      ],
      "lines": [
        {
          "at": "def main() -> None:",
          "text": "CLI 인자를 파싱해 모드를 분기하는 진입점 함수 정의."
        },
        {
          "at": "    subparsers = parser.add_subparsers(dest=\"command\")",
          "text": "index/check-proxy/chat/ask 서브커맨드를 등록함."
        },
        {
          "at": "    index_parser.add_argument(\"--reset\"",
          "text": "index 모드에 --reset 등 옵션을 추가함."
        },
        {
          "at": "    args = parser.parse_args()",
          "text": "실제 명령행 인자를 파싱함."
        },
        {
          "at": "    if args.command in (None, \"index\"):",
          "text": "인자가 없거나 index면 인덱싱 파이프라인을 실행함."
        },
        {
          "at": "    elif args.command == \"check-proxy\":",
          "text": "check-proxy면 프록시 점검 함수를 부름."
        },
        {
          "at": "if __name__ == \"__main__\":",
          "text": "이 파일을 직접 실행할 때만 main()을 수행하는 관용구."
        },
        {
          "at": "        print(f\"\\n[오류] 실행 실패: {error}\", file=sys.stderr)",
          "text": "실패 시 오류를 표준에러로 찍고 종료 코드 1로 끝냄."
        }
      ],
      "code": "def main() -> None:\n    \"\"\"명령행 인자를 파싱해 index / check-proxy / chat / ask 모드를 실행함.\"\"\"\n    parser = argparse.ArgumentParser(description=\"YouTube Data API + Multi-Query 자막 RAG 예제\")\n    # 서브커맨드: index(기본) / check-proxy / chat / ask\n    subparsers = parser.add_subparsers(dest=\"command\")\n\n    index_parser = subparsers.add_parser(\"index\", help=\"영상 검색 → 자막 추출 → 벡터 DB 인덱싱\")\n    index_parser.add_argument(\"--reset\", action=\"store_true\", help=\"기존 벡터 DB 삭제 후 재생성\")\n    index_parser.add_argument(\"--refresh-search-cache\", action=\"store_true\", help=\"24시간 검색 캐시를 무시하고 새로 검색\")\n    index_parser.add_argument(\"--refresh-transcript-cache\", action=\"store_true\", help=\"24시간 자막 캐시를 무시하고 새로 추출\")\n\n    check_parser = subparsers.add_parser(\"check-proxy\", help=\"자막 프록시 연결만 점검\")\n    check_parser.add_argument(\"video\", help=\"자막이 있는 YouTube 영상 URL 또는 11자리 video_id\")\n\n    subparsers.add_parser(\"chat\", help=\"대화형 RAG 챗봇 실행\")\n\n    ask_parser = subparsers.add_parser(\"ask\", help=\"단발성 질문 1회 답변\")\n    ask_parser.add_argument(\"question\", help=\"질문 내용\")\n\n    args = parser.parse_args()\n\n    # 서브커맨드 미지정 시 기본은 인덱싱 (완료 기준이 인덱싱·테스트 검색이므로)\n    if args.command in (None, \"index\"):\n        run_indexing(\n            reset=getattr(args, \"reset\", False),\n            refresh_search_cache=getattr(args, \"refresh_search_cache\", False),\n            refresh_transcript_cache=getattr(args, \"refresh_transcript_cache\", False),\n        )\n    elif args.command == \"check-proxy\":\n        run_check_proxy(args.video)\n    elif args.command == \"chat\":\n        run_chat()\n    elif args.command == \"ask\":\n        run_ask(args.question)\n\n\n# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)\nif __name__ == \"__main__\":\n    try:\n        main()\n    except Exception as error:\n        print(f\"\\n[오류] 실행 실패: {error}\", file=sys.stderr)\n        sys.exit(1)"
    }
  ],
  "glossary": {
    "RAG": "Retrieval-Augmented Generation. 외부 자료에서 관련 내용을 먼저 찾아(검색) 그 근거로 LLM이 답하게 하는 방식. 모델이 모르는 전문·최신 정보도 자료만 있으면 답할 수 있게 함. 이 예제는 YouTube 자막을 자료로 씀.",
    "YouTube Data API v3": "구글이 제공하는 공식 YouTube API. 영상 검색·날짜 필터·조회수 정렬·길이/조회수 같은 상세 메타데이터를 제공함. 웹 스크래핑과 달리 안정적이고 정확함(단, 일일 호출 할당량이 있음).",
    "build()": "google-api-python-client의 팩토리 함수. build(\"youtube\",\"v3\",developerKey=...)처럼 부르면 REST API를 youtube.search().list() 같은 파이썬 메서드로 쓸 수 있는 서비스 객체를 만들어 줌.",
    "search.list": "YouTube Data API의 검색 엔드포인트. 검색어(q)·날짜(publishedAfter)·정렬(order) 등으로 영상을 찾아 ID 목록을 돌려줌. 이 예제는 멀티쿼리로 여러 번 호출해 후보를 넓게 모음.",
    "videos.list": "YouTube Data API의 상세 조회 엔드포인트. 영상 ID들을 주면 길이(contentDetails)·조회수(statistics)·제목(snippet)을 돌려줌. 한 번에 최대 50개 ID까지 받음.",
    "Multi-Query(멀티쿼리)": "한 주제를 '특징'·'활용 방법'처럼 여러 관점의 검색어로 나눠 검색하는 기법. 한 검색어로는 놓칠 영상까지 넓게 모아 회수율(찾아내는 비율)을 높임.",
    "회수율(recall)": "찾아야 할 것 중 실제로 찾아낸 비율. 멀티쿼리로 검색어를 늘리면 관련 영상을 더 많이 건져 회수율이 올라감.",
    "publishedAfter": "search.list에 주는 날짜 필터. 이 시점 이후에 업로드된 영상만 검색함. 이 예제는 '오늘 - 90일'을 넣어 최근 3개월 영상만 모음.",
    "ISO 8601": "날짜·시각을 적는 국제 표준 형식(예: 2026-05-30T12:00:00Z). publishedAfter나 캐시 만료 시각을 이 형식 문자열로 주고받음.",
    "ISO 8601 duration(PT15M33S)": "ISO 8601의 '기간' 표기법. PT15M33S는 15분 33초, PT1H2M3S는 1시간 2분 3초를 뜻함. YouTube가 영상 길이를 이 형식으로 주므로 초로 바꿔 써야 함.",
    "정규표현식": "글자 패턴을 규칙으로 적어 문자열에서 원하는 부분을 찾거나 검사하는 도구. 이 예제는 영상 길이(PT15M33S)나 11자리 영상 ID 같은 패턴을 뽑는 데 씀.",
    "re.match": "파이썬 정규표현식 함수. 문자열의 '맨 앞'부터 패턴이 맞는지 보고, 맞으면 캡처한 조각들을 돌려줌. 여기서는 PT…에서 시·분·초 숫자를 뽑는 데 사용.",
    "divmod": "두 수의 몫과 나머지를 한 번에 돌려주는 파이썬 내장 함수. divmod(125, 60)=(2, 5)처럼, 시작 초를 분·초로 나눠 '2:05' 같은 시점 표시를 만드는 데 씀.",
    "TTL 캐시": "Time To Live 캐시. 결과를 파일에 저장해 두고 정해진 시간(이 예제는 24시간) 동안 재사용하는 것. YouTube API 할당량과 자막 프록시 요청을 아낌.",
    "youtube-transcript-api": "유튜브 영상의 자막을 가져오는 파이썬 라이브러리. video_id와 언어를 주면 '몇 초에 무슨 말'이 담긴 자막 조각 목록을 돌려줌. 프록시 설정도 지원함.",
    "자막(transcript)": "영상 속 말을 글로 옮긴 텍스트. 이 예제는 자막을 RAG의 '자료'로 삼아, 영상을 직접 보지 않고도 내용에 근거해 답하게 함.",
    "타임스탬프 청킹": "자막을 120초(2분) 같은 시간 단위로 잘라 조각(청크)으로 만드는 것. 각 조각이 '영상 몇 분 지점'인지 알 수 있어 '몇 분부터 보세요' 답이 가능해짐.",
    "&t=초(타임스탬프 URL)": "유튜브 영상 주소 끝에 &t=120을 붙이면 120초(2분) 지점부터 재생됨. 이 예제는 각 자막 청크에 이 바로가기 URL을 붙여 정확한 시점을 안내함.",
    "프록시(proxy)": "내 컴퓨터 대신 요청을 대신 보내 주는 중간 서버. YouTube가 한 IP의 대량 자막 요청을 차단하므로, 프록시를 거쳐 IP를 바꿔 가며 자막을 받아 차단을 피함.",
    "Webshare": "레지덴셜(가정용) 프록시를 제공하는 서비스. 여러 나라의 IP를 회전시켜 줘 YouTube의 IP 차단을 피하는 데 효과적임. 이 예제가 기본으로 지원하는 프록시.",
    "지수 백오프": "재시도할 때마다 대기 시간을 두 배씩 늘리는 전략(3→6→12→24초). 차단됐을 때 무작정 빨리 재시도하지 않고 점점 더 기다려 상대 서버의 부담과 추가 차단을 줄임.",
    "RequestBlocked": "youtube-transcript-api가 'YouTube가 요청을 차단함'을 알릴 때 내는 예외. IpBlocked의 상위 분류라 둘 다 이 예외로 잡아 재시도·프록시 권장으로 대응함.",
    "MMR": "Maximal Marginal Relevance. 검색 시 '질문과 관련 있으면서도 서로 내용이 겹치지 않는' 조각을 고르는 방식. 한 영상에만 답이 쏠리지 않고 여러 영상의 다양한 시점을 모음.",
    "fetch_k": "MMR이 다양성을 계산하려고 처음에 넉넉히 가져오는 후보 조각 수(이 예제는 30). 이 후보들 중에서 최종 k개를 골라냄.",
    "lambda_mult": "MMR에서 관련성과 다양성의 비중을 정하는 값(0~1). 1이면 관련성만, 0이면 다양성만, 이 예제는 0.5로 둘의 균형을 맞춤.",
    "argparse": "파이썬 표준 라이브러리. 'python app.py index --reset'처럼 명령행에 적은 서브커맨드와 옵션을 읽어 분석해 줌.",
    "서브커맨드": "한 프로그램 안의 하위 명령. 이 예제는 index(인덱싱)·check-proxy(프록시 점검)·chat(대화형)·ask(단발 질문) 네 가지를 골라 실행함.",
    "reasoning_format": "Groq의 추론형 모델(gpt-oss-120b)에 주는 설정. \"hidden\"으로 두면 모델의 사고 과정은 숨기고 최종 답변 텍스트만 받아, 답에 군더더기가 섞이지 않게 함.",
    "add_documents": "이미 있는 ChromaDB 컬렉션에 새 청크들을 임베딩해 추가하는 메서드. 이 예제는 벡터 DB가 이미 있을 때 자막 청크를 누적하는 데 씀.",
    "from_documents": "문서들을 임베딩해 ChromaDB 컬렉션을 '새로' 만들고 디스크에 저장하는 메서드. 이 예제는 벡터 DB가 아직 없을 때 최초 인덱싱에 씀.",
    "임베딩": "텍스트를 의미가 담긴 숫자 벡터(여러 숫자의 나열)로 바꾼 것. 뜻이 비슷한 글은 벡터도 가깝게 위치해, 컴퓨터가 '비슷한 내용'을 계산으로 찾을 수 있음.",
    "벡터 DB": "임베딩(숫자 벡터)을 저장하고, 질문 벡터와 가장 가까운 것들을 빠르게 찾아 주는 데이터베이스. 여기서는 ChromaDB를 사용함.",
    "ChromaDB": "오픈소스 벡터 데이터베이스. 임베딩을 저장하고 유사도 검색을 해 줌. 로컬 폴더에 영속화(저장)되어 재실행 시 그대로 재사용 가능.",
    "Chroma": "ChromaDB를 LangChain에서 다루는 래퍼 클래스. 새 컬렉션 생성(from_documents)도, 기존 컬렉션 연결(생성자)도 할 수 있음.",
    "컬렉션": "벡터 DB 안에서 벡터들을 묶어 두는 단위(여기서는 youtube_transcripts). 인덱싱과 검색이 같은 컬렉션 이름을 써야 검색이 됨.",
    "영속화": "persist. 메모리에만 두지 않고 디스크 폴더에 저장해, 프로그램을 껐다 켜도 데이터가 남아 재사용되게 하는 것.",
    "Document": "LangChain에서 한 청크를 담는 객체. 본문 텍스트(page_content)와 출처·시점 등 부가정보(metadata)를 함께 가짐.",
    "metadata": "청크에 딸린 부가정보(예: 제목 title, 시작 시점 timestamp_display, 바로가기 timestamp_url). 답변의 출처와 시점을 표시하는 데 사용함.",
    "OpenAIEmbeddings": "OpenAI 임베딩 모델 호출 래퍼. 텍스트를 숫자 벡터로 변환함. 이 예제는 자막 청크와 질문을 같은 모델로 벡터화함.",
    "text-embedding-3-small": "OpenAI의 임베딩 모델 이름(1536차원). 인덱싱 때 쓴 모델과 검색 때 쓰는 모델이 같아야 의미 공간이 맞아 검색이 됨.",
    "retriever": "검색기. 벡터 DB에서 질문과 가장 비슷한 청크 몇 개를 찾아 돌려주는 역할. 이 예제는 MMR 방식 검색기를 씀.",
    "as_retriever": "벡터 저장소(vectorstore)를 LCEL 체인에 꽂을 수 있는 검색기(retriever) 객체로 바꿔 주는 메서드. 검색 방식(mmr 등)과 옵션을 지정함.",
    "invoke": "LangChain 체인·검색기를 '실행'하는 메서드. 입력을 넣으면 끝까지 돌려 결과를 돌려줌.",
    "ChatGroq": "Groq 클라우드의 채팅 LLM을 호출하는 LangChain 래퍼. GROQ_API_KEY를 자동 참조함.",
    "Groq LPU": "Groq사가 만든 LLM 추론 전용 칩(Language Processing Unit). 매우 빠른 응답 속도가 특징.",
    "gpt-oss-120b": "Groq LPU에서 서빙하는 오픈 가중치 LLM(약 1200억 파라미터). 이 예제의 답변 생성 모델.",
    "temperature": "LLM 답변의 무작위성 정도. 0에 가까울수록 매번 비슷하고 일관된 답을 냄. 이 예제는 0.3으로 두어 사실 중심·일관된 답을 유도함.",
    "ChatPromptTemplate": "LLM에 보낼 프롬프트(지시문)의 틀. {context}·{question} 같은 빈칸에 실제 값을 채워 완성된 프롬프트를 만듦.",
    "프롬프트": "LLM에게 주는 지시문. 이 예제의 시스템 프롬프트는 '자막만 근거로, 영상 제목과 시점 URL을 함께 제시하라'고 지시함.",
    "LCEL": "LangChain Expression Language. 파이프 기호(|)로 단계들을 왼쪽→오른쪽으로 연결해 하나의 처리 흐름(체인)을 만드는 문법.",
    "파이프(|)": "LCEL에서 앞 단계의 결과를 다음 단계의 입력으로 흘려보내는 연결 기호. 'prompt | llm | parser'처럼 씀.",
    "StrOutputParser": "LLM 응답 객체에서 사람이 읽을 본문 문자열만 깔끔히 뽑아 주는 출력 파서.",
    "load_dotenv": ".env 파일에 적어 둔 비밀값(예: YOUTUBE_API_KEY, OPENAI_API_KEY, GROQ_API_KEY)을 프로그램의 환경변수로 불러오는 함수.",
    "from __future__ import annotations": "타입 힌트를 즉시 평가하지 않고 문자열로 두게 하는 파이썬 선언. 순환 참조 없이 가볍게 타입 힌트를 쓰게 해 줌.",
    "Path(__file__).resolve().parent": "지금 이 파이썬 파일이 있는 폴더의 절대경로를 구하는 관용구. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "if __name__ == \"__main__\"": "이 파일을 직접 실행할 때만 특정 코드를 돌리고, 다른 곳에서 import할 때는 돌리지 않게 하는 파이썬 관용구.",
    "API 키 검사": "필요한 API 키가 환경변수에 없으면 실행 초기에 명확한 오류를 내는 패턴. 한참 뒤에 엉뚱한 곳에서 실패하는 것을 막아 디버깅을 쉽게 함."
  }
};
