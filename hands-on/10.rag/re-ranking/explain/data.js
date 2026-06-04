window.EXPLAIN_DATA = {
  "meta": {
    "title": "Re-ranking — 검색 결과 재정렬",
    "entry": "app.py"
  },
  "files": [
    {
      "id": "main",
      "label": "app.py",
      "role": "공용 벡터 DB를 1차로 넓게 검색한 뒤 Cross-Encoder로 재정렬해 정밀한 근거만 LLM에 넘기는 2단계 RAG 전체"
    }
  ],
  "flow": [
    {
      "step": 1,
      "title": "준비 — 리소스 로드",
      "label": "리소스 로드",
      "refs": ["load_vectorstore", "load_reranker", "load_llm"],
      "summary": "공용 벡터 DB·재정렬 모델(Re-ranker)·답변용 LLM 세 가지를 미리 불러옴",
      "detail": "이 예제는 PDF를 새로 쪼개거나 다시 임베딩하지 않음. 이미 만들어 둔 공용 벡터 DB(컬렉션 patent_law)를 '연결'만 함. 동시에 두 종류의 채점 도구를 챙기는데, 하나는 빠르게 후보를 추리는 1차 검색기(벡터 DB), 다른 하나는 후보를 꼼꼼히 다시 채점하는 재정렬 모델(Cross-Encoder)임. 마지막으로 답을 글로 써 줄 LLM도 준비함. 비유하면, 도서관 사서가 출근해 '대충 빨리 찾는 검색대'와 '정밀 감정사' 그리고 '글 써 주는 직원' 셋을 모두 자리에 앉혀 두는 단계."
    },
    {
      "step": 2,
      "title": "1차 검색 — 후보를 넓게(Top-50) 가져오기",
      "label": "1차 검색",
      "refs": ["retrieve_initial"],
      "summary": "질문을 임베딩해 의미가 비슷한 청크를 빠르게 50개 추출함(Bi-Encoder)",
      "detail": "사용자 질문을 문서와 똑같은 방식으로 숫자 벡터(임베딩)로 바꾼 뒤, 벡터 DB에서 가장 가까운(=의미가 비슷한) 청크를 무려 50개나 꺼냄(유사도 검색). 보통 RAG는 5개만 꺼내지만, 여기서는 일부러 넓게 가져옴 — 빠른 1차 검색은 정작 중요한 문서를 상위권에서 놓칠 수 있어서, 그물을 크게 던져 일단 후보에 포함시키는 전략임(recall 확보). 비유하면, 감정에 들어가기 전에 비슷해 보이는 후보 카드 50장을 일단 빠르게 긁어모으는 것."
    },
    {
      "step": 3,
      "title": "재정렬 — 정밀 점수 매기기(Re-ranking)",
      "label": "재정렬",
      "refs": ["rerank_documents"],
      "summary": "Cross-Encoder가 질문과 각 문서를 함께 읽고 관련도 점수를 정밀하게 매김",
      "detail": "1차로 모은 50개 후보 하나하나에 대해, '질문 + 문서'를 한 쌍으로 묶어 재정렬 모델에 넣음. 1차 검색(Bi-Encoder)이 질문과 문서를 따로따로 보고 거리만 쟀다면, 재정렬 모델(Cross-Encoder)은 둘을 함께 읽어 단어 사이 상호작용까지 따지므로 훨씬 정확함(대신 느림). 그 결과 0~1 사이의 관련도 점수를 받아 점수 높은 순으로 다시 줄을 세움. 비유하면, 빠르게 긁어모은 50장을 정밀 감정사가 한 장씩 질문과 대조하며 진짜 점수를 매겨 순위를 뒤집는 단계."
    },
    {
      "step": 4,
      "title": "상위 N 선택 — Top-5만 남기기",
      "label": "상위 N 선택",
      "refs": ["rerank_documents"],
      "summary": "재정렬 점수가 가장 높은 상위 5개 문서만 최종 근거로 선정함",
      "detail": "정밀 채점으로 다시 줄 세운 후보들 중 상위 5개(RERANK_K)만 골라냄. 이때 각 문서가 1차 검색에서 몇 위였는지도 함께 들고 다녀, 재정렬로 순위가 얼마나 바뀌었는지(예: 1차 46위 → 4위) 보여 줄 수 있게 함 — 재정렬의 효과를 눈으로 확인하는 교육 장치임. 50개를 다 LLM에 넣지 않고 5개만 넘기므로 토큰 비용은 늘지 않음. 비유하면, 정밀 감정을 마친 뒤 가장 점수 높은 5장만 추려 답안 작성 책상에 올려 두는 것."
    },
    {
      "step": 5,
      "title": "LLM 생성 — 근거로 답변 만들기",
      "label": "LLM 생성",
      "refs": ["format_context", "build_chain", "run_query"],
      "summary": "선정된 Top-5를 컨텍스트로 넣어 Groq LLM이 근거 기반 답을 생성함",
      "detail": "재정렬로 추려진 5개 문서를 [문서 N]·출처·관련도 라벨과 함께 '컨텍스트'로 프롬프트에 채우고, LLM이 그 근거만 바탕으로 답을 씀. 프롬프트에 '컨텍스트에 없으면 찾을 수 없다고 답하라'는 규칙이 있어 지어내기(환각)를 줄임. 이 조립은 LCEL 파이프(prompt | llm | StrOutputParser)로 이뤄짐. 비유하면, 사서가 가장 잘 고른 5장의 카드만 보고 질문에 답을 적어 주는 것."
    },
    {
      "step": 6,
      "title": "출력 — 결과와 순위 변화 표시",
      "label": "결과·순위 변화 출력",
      "refs": ["print_initial_results", "print_reranked_results"],
      "summary": "생성된 답변과, 1차 순위→재정렬 순위 변화를 콘솔에 보기 좋게 출력함",
      "detail": "최종 답변을 출력하고, 1차 검색 미리보기와 재정렬 결과(1차 몇 위에서 몇 위로 올랐는지 ▲▼ 화살표)를 함께 보여 줌. 어떤 문서가 점수 몇 점으로 근거가 됐는지 드러나므로 사람이 답의 출처를 검증할 수 있음. 데모 1회 후에는 사용자가 직접 질문을 입력해 재정렬 효과를 체험하는 대화형 루프로 들어감. 비유하면, 답안과 함께 '감정 결과표(순위가 어떻게 뒤집혔는지)'를 같이 제출하는 것."
    }
  ],
  "functions": [
    {
      "id": "setup",
      "name": "임포트·경로·상수 설정",
      "fileId": "main",
      "summary": "필요한 모듈을 가져오고, 파일 위치 기준으로 경로를 잡고, .env 키와 1차/재정렬 개수 같은 핵심 상수를 준비하는 부분.",
      "how": "함수가 아니라 파일 위쪽의 준비 코드 모음임. ① OpenMP 라이브러리 중복 로드로 인한 윈도우 종료 오류를 피하는 환경변수와, 한글 출력을 위한 UTF-8 설정을 함. ② 모든 경로를 이 파일 위치(__file__) 기준으로 계산해, 어디서 실행해도 같은 공용 벡터 DB와 .env 를 가리키게 함. ③ load_dotenv 로 키를 올리고, 컬렉션명·임베딩 모델·재정렬 모델·LLM 모델과 함께 'INITIAL_K=50(1차로 넓게)'·'RERANK_K=5(최종 추림)' 같은 2단계 검색의 핵심 숫자, 그리고 시스템 프롬프트를 정함.",
      "terms": [
        "from __future__ import annotations",
        "load_dotenv",
        "컬렉션",
        "임베딩",
        "text-embedding-3-small",
        "Cross-Encoder",
        "top-k",
        "top-n",
        "프롬프트"
      ],
      "lines": [
        {
          "at": "from __future__ import annotations",
          "text": "타입 힌트를 문자열로 평가해 가볍게 쓰게 하는 파이썬 설정."
        },
        {
          "at": "os.environ.setdefault(\"KMP_DUPLICATE_LIB_OK\"",
          "text": "torch와 chromadb가 OpenMP 라이브러리를 중복 로드해도 종료 시 오류가 안 나게 회피."
        },
        {
          "at": "sys.stdout.reconfigure(encoding",
          "text": "윈도우 콘솔에서 한글이 깨지지 않도록 출력 인코딩을 UTF-8로 바꿈."
        },
        {
          "at": "SCRIPT_DIR = Path(__file__)",
          "text": "이 파일이 있는 폴더(re-ranking/)를 절대경로로 구함 — 실행 위치와 무관하게 동작."
        },
        {
          "at": "VECTORDB_DIR = RAG_DIR",
          "text": "공용 ChromaDB가 저장된 폴더(../vectordb)를 가리킴."
        },
        {
          "at": "ENV_PATH = RAG_DIR.parent",
          "text": "API 키가 든 hands-on/.env 파일 경로를 잡음."
        },
        {
          "at": "load_dotenv(ENV_PATH)",
          "text": ".env 에서 OPENAI_API_KEY·GROQ_API_KEY 를 실제로 읽어 환경변수로 올림."
        },
        {
          "at": "COLLECTION_NAME = \"patent_law\"",
          "text": "검색할 벡터 DB의 컬렉션 이름 — 인덱싱 때와 같아야 함."
        },
        {
          "at": "EMBEDDING_MODEL =",
          "text": "질의를 벡터로 바꿀 임베딩 모델 — 인덱싱 때와 반드시 동일(1536차원)."
        },
        {
          "at": "RERANKER_MODEL =",
          "text": "후보를 정밀하게 다시 채점할 한국어 Cross-Encoder 재정렬 모델 이름."
        },
        {
          "at": "GROQ_MODEL =",
          "text": "답변을 생성할 LLM(Groq의 gpt-oss-120b) 이름."
        },
        {
          "at": "INITIAL_K = 50",
          "text": "1차 검색에서 넓게 가져올 후보 개수(top-k) — 일부러 크게 잡아 누락을 줄임."
        },
        {
          "at": "RERANK_K = 5",
          "text": "재정렬 후 LLM에 넘길 최종 문서 개수(top-n)."
        },
        {
          "at": "DEFAULT_QUERY =",
          "text": "질문을 직접 안 줬을 때 데모로 쓸 기본 질문."
        },
        {
          "at": "SYSTEM_PROMPT = \"\"\"당신은",
          "text": "검색된 컨텍스트로만 답하고 쉬운 말로 풀어 설명하도록 지시하는 시스템 프롬프트."
        }
      ],
      "code": "from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함\n\nimport os\nimport sys\nfrom pathlib import Path\n\n# torch(CUDA)와 chromadb(onnxruntime)가 각자 OpenMP 런타임(libiomp5md.dll)을 중복 로드하면\n# Windows에서 프로세스 종료 시점에 세그폴트(exit 139)가 발생할 수 있음. 중복 로드를 허용해 회피함.\nos.environ.setdefault(\"KMP_DUPLICATE_LIB_OK\", \"TRUE\")\n\n# Windows 콘솔 기본 인코딩(cp949)에서 한글 청크 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함\nif hasattr(sys.stdout, \"reconfigure\"):\n    sys.stdout.reconfigure(encoding=\"utf-8\")\n\n# ---------------------------------------------------------------------------\n# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)\n# ---------------------------------------------------------------------------\nSCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(re-ranking/)를 절대경로로 구함\nRAG_DIR = SCRIPT_DIR.parent                     # hands-on/10.rag/\nVECTORDB_DIR = RAG_DIR / \"vectordb\"             # 공용 ChromaDB 영속 디렉터리 (8.0 인덱싱 산출물)\nENV_PATH = RAG_DIR.parent / \".env\"              # hands-on/.env (API 키 보관)\n\n# ---------------------------------------------------------------------------\n# 환경변수 로드\n# ---------------------------------------------------------------------------\nfrom dotenv import load_dotenv\n\nload_dotenv(ENV_PATH)  # .env에서 OPENAI_API_KEY(쿼리 임베딩)·GROQ_API_KEY(LLM)를 로드함\n\n# ---------------------------------------------------------------------------\n# 상수 정의\n# ---------------------------------------------------------------------------\nCOLLECTION_NAME = \"patent_law\"               # 공용 벡터 DB 컬렉션명 (8.0 인덱싱이 저장한 이름과 반드시 일치)\nEMBEDDING_MODEL = \"text-embedding-3-small\"   # 쿼리 임베딩 모델 (인덱싱 시와 동일해야 벡터 공간이 일치)\nRERANKER_MODEL = \"dragonkue/bge-reranker-v2-m3-ko\"  # 한국어 최적화 Cross-Encoder Re-ranker\nGROQ_MODEL = \"openai/gpt-oss-120b\"           # Groq LPU에서 서빙되는 LLM\n\nINITIAL_K = 50   # 1차 검색(Bi-Encoder)에서 넓게 가져올 후보 문서 수\nRERANK_K = 5     # Re-ranking(Cross-Encoder) 후 LLM에 전달할 최종 문서 수\n\nDEFAULT_QUERY = \"특허를 받을 수 있는 조건은 ?\"   # 데모용 기본 질의어\n\n# LLM 시스템 프롬프트 (검색된 컨텍스트에만 근거하도록 제약)\nSYSTEM_PROMPT = \"\"\"당신은 특허법 전문 법률 상담 AI입니다.\n\n## 역할\n- 주어진 컨텍스트(검색된 특허법 조문)를 기반으로 질문에 답변합니다.\n- 법조문을 그대로 인용하지 말고, 일반인이 이해하기 쉽도록 풀어서 설명합니다.\n\n## 규칙\n1. 법률 용어는 쉬운 말로 바꿔서 설명 (예: \"출원인\" → \"특허를 신청하는 사람\")\n2. 복잡한 조문은 핵심만 요약하여 전달\n3. 컨텍스트에 없는 내용은 \"해당 내용은 제공된 문서에서 찾을 수 없습니다\"라고 답변\n4. 답변 끝에 근거가 된 조문 번호를 명시 (예: 특허법 제29조)\n\n## 컨텍스트\n{context}\n\"\"\""
    },
    {
      "id": "load_vectorstore",
      "name": "load_vectorstore()",
      "fileId": "main",
      "summary": "이미 만들어진 공용 ChromaDB를 재인덱싱 없이 연결해 1차 검색용 '벡터 저장소'로 돌려주는 함수.",
      "how": "RAG의 1차 검색 쪽 준비를 담당함. 새로 인덱싱하지 않고, 인덱싱이 만들어 둔 영속 컬렉션을 그대로 연결함. ① 벡터 DB 폴더가 있는지 먼저 확인함. ② 인덱싱과 동일한 임베딩 모델로 OpenAIEmbeddings 를 만들어(질의 임베딩 전용), Chroma(...) 로 기존 컬렉션을 연결함. 이때 collection_name 을 'patent_law'로 반드시 지정해야 함 — 빠뜨리면 기본 이름의 빈 컬렉션이 열려 검색이 0건이 되는 '침묵 실패'가 남. ③ 저장된 벡터 개수를 읽어 0이면 연결 실패로 보고 중단함.",
      "terms": [
        "벡터 DB",
        "ChromaDB",
        "Chroma",
        "컬렉션",
        "임베딩",
        "OpenAIEmbeddings",
        "유사도 검색",
        "Bi-Encoder"
      ],
      "lines": [
        {
          "at": "def load_vectorstore",
          "text": "공용 벡터 DB를 연결해 1차 검색용 저장소를 만드는 함수 정의."
        },
        {
          "at": "from langchain_chroma import Chroma",
          "text": "영속화된 벡터 컬렉션을 연결하는 Chroma 래퍼를 가져옴."
        },
        {
          "at": "from langchain_openai import OpenAIEmbeddings",
          "text": "질의를 벡터로 바꿀 임베딩 모델(Bi-Encoder)을 가져옴."
        },
        {
          "at": "if not VECTORDB_DIR.exists()",
          "text": "인덱싱이 먼저 돼 있어야 하므로 벡터 DB 폴더 존재를 확인함."
        },
        {
          "at": "embeddings = OpenAIEmbeddings(model=",
          "text": "인덱싱과 같은 모델로 질의 임베딩기를 준비함(차원·의미공간 일치)."
        },
        {
          "at": "vectorstore = Chroma(",
          "text": "신규 생성이 아니라 기존 컬렉션을 '연결'만 함."
        },
        {
          "at": "collection_name=COLLECTION_NAME",
          "text": "어떤 컬렉션을 열지 이름으로 지정 — 빠뜨리면 빈 컬렉션이 열림."
        },
        {
          "at": "count = vectorstore._collection.count()",
          "text": "저장된 벡터 개수를 읽어 컬렉션 연결이 됐는지 확인."
        },
        {
          "at": "if count == 0",
          "text": "벡터가 하나도 없으면 연결 실패로 보고 오류를 냄."
        }
      ],
      "code": "def load_vectorstore():\n    \"\"\"8.0 인덱싱이 구축한 공용 벡터 DB를 임베딩 없이 로드하여 반환함.\n\n    핵심 주의점: langchain_chroma의 기본 컬렉션명은 'langchain'이므로 collection_name을\n    명시하지 않으면 오류 없이 빈 컬렉션이 열려 검색이 0건이 됨(침묵 실패). 따라서\n    8.0 인덱싱이 저장한 컬렉션명(patent_law)을 반드시 지정하고, 적재 건수를 검증함.\n    \"\"\"\n    from langchain_chroma import Chroma           # Chroma: ChromaDB 벡터 스토어 LangChain 래퍼\n    from langchain_openai import OpenAIEmbeddings  # OpenAIEmbeddings: 텍스트를 1536차원 벡터로 변환\n\n    if not VECTORDB_DIR.exists():\n        raise FileNotFoundError(\n            f\"공용 벡터 DB를 찾을 수 없음: {VECTORDB_DIR}\\n\"\n            f\"먼저 8.0 인덱싱(hands-on/10.rag/indexing/indexing.py)을 실행하세요.\"\n        )\n\n    # 쿼리 임베딩에만 사용함 — 코퍼스는 이미 임베딩되어 저장돼 있으므로 재인덱싱하지 않음\n    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL, api_key=os.environ.get(\"OPENAI_API_KEY\"))\n\n    vectorstore = Chroma(\n        persist_directory=str(VECTORDB_DIR),\n        collection_name=COLLECTION_NAME,\n        embedding_function=embeddings,\n    )\n\n    # ._collection.count(): 컬렉션에 실제 저장된 벡터 개수 — 0이면 컬렉션 연결 실패로 간주하고 중단함\n    count = vectorstore._collection.count()\n    if count == 0:\n        raise RuntimeError(\n            f\"컬렉션 '{COLLECTION_NAME}'에 문서가 없음(연결 실패 가능). \"\n            f\"persist_directory/collection_name이 8.0 인덱싱과 일치하는지 확인하세요.\"\n        )\n    print(f\"  - 공용 벡터 DB 로드 완료: 컬렉션 '{COLLECTION_NAME}', 저장 벡터 {count}건\")\n    return vectorstore"
    },
    {
      "id": "load_reranker",
      "name": "load_reranker()",
      "fileId": "main",
      "summary": "1차 검색 결과를 정밀하게 다시 채점할 한국어 Cross-Encoder 재정렬 모델을 불러오는 함수.",
      "how": "재정렬(Re-ranking)의 핵심 도구를 준비함. FlagReranker 는 '질문+문서'를 한 입력으로 받아 관련도 점수를 산출하는 Cross-Encoder 래퍼임. 1차 검색의 Bi-Encoder(임베딩)와 달리 두 텍스트의 토큰 상호작용까지 분석하므로 더 정확하지만 더 느림. use_fp16=True 는 16비트 부동소수점으로 GPU 메모리를 아끼고 추론을 빠르게 함. 모델이 약 2GB라 최초 1회는 다운로드로 시간이 걸릴 수 있음.",
      "terms": [
        "Re-ranking",
        "Cross-Encoder",
        "Bi-Encoder",
        "FlagReranker",
        "relevance score"
      ],
      "lines": [
        {
          "at": "def load_reranker",
          "text": "재정렬용 Cross-Encoder 모델을 불러오는 함수 정의."
        },
        {
          "at": "from FlagEmbedding import FlagReranker",
          "text": "질문-문서 쌍을 함께 채점하는 Cross-Encoder 래퍼를 가져옴."
        },
        {
          "at": "(최초 실행 시 모델 다운로드",
          "text": "약 2GB 모델이라 최초 1회는 내려받는 데 수 분 걸릴 수 있음을 안내."
        },
        {
          "at": "return FlagReranker(RERANKER_MODEL, use_fp16=True)",
          "text": "16비트(fp16)로 메모리를 아끼며 재정렬 모델 객체를 만들어 돌려줌."
        }
      ],
      "code": "def load_reranker():\n    \"\"\"한국어 최적화 Cross-Encoder Re-ranker를 로드하여 반환함.\n\n    FlagReranker: 쿼리-문서 쌍을 하나의 입력으로 받아 관련도 점수를 산출하는 Cross-Encoder 래퍼.\n    Bi-Encoder(임베딩)와 달리 두 텍스트의 토큰 상호작용까지 분석해 정확도가 높음(대신 느림).\n    use_fp16=True: 16비트 부동소수점으로 GPU 메모리를 절약하고 추론 속도를 높임(CUDA GPU 환경 권장).\n    \"\"\"\n    from FlagEmbedding import FlagReranker\n\n    print(f\"  - Re-ranker 로드: {RERANKER_MODEL}\")\n    print(\"    (최초 실행 시 모델 다운로드로 수 분 소요될 수 있음)\")\n    return FlagReranker(RERANKER_MODEL, use_fp16=True)"
    },
    {
      "id": "load_llm",
      "name": "load_llm()",
      "fileId": "main",
      "summary": "재정렬된 근거로 실제 답변을 써 줄 Groq LLM(openai/gpt-oss-120b)을 만들어 돌려주는 함수.",
      "how": "답변 생성용 LLM을 준비함. Groq 키가 없으면 즉시 명확한 오류를 내 디버깅을 쉽게 함. ChatGroq 는 Groq API에 채팅 요청을 보내는 LangChain 래퍼이고, llm.invoke() 로 대화 요청을 전송함. temperature=0.3 으로 무작위성을 낮춰 법률 답변의 일관성을 높임.",
      "terms": [
        "ChatGroq",
        "Groq LPU",
        "gpt-oss-120b",
        "temperature",
        "invoke",
        "API 키 검사"
      ],
      "lines": [
        {
          "at": "def load_llm",
          "text": "답변 생성용 Groq LLM을 만드는 함수 정의."
        },
        {
          "at": "from langchain_groq import ChatGroq",
          "text": "Groq 클라우드에 채팅 요청을 보내는 LangChain 래퍼를 가져옴."
        },
        {
          "at": "if not api_key:",
          "text": "LLM 호출에 필요한 Groq 키가 없으면 초기에 명확히 오류를 냄."
        },
        {
          "at": "return ChatGroq(model=GROQ_MODEL",
          "text": "모델·낮은 온도(0.3) 등을 설정해 Groq 채팅 모델 객체를 만들어 돌려줌."
        }
      ],
      "code": "def load_llm():\n    \"\"\"Groq LPU에서 서빙되는 LLM 인스턴스를 생성하여 반환함.\n\n    ChatGroq: Groq API용 LangChain 채팅 모델 래퍼(llm.invoke()로 대화 요청 전송).\n    temperature=0.3: 법률 답변의 일관성을 위해 낮은 무작위성 사용.\n    \"\"\"\n    from langchain_groq import ChatGroq\n\n    api_key = os.environ.get(\"GROQ_API_KEY\")\n    # API 키 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함\n    if not api_key:\n        raise RuntimeError(\"GROQ_API_KEY가 .env에 설정되지 않음\")\n    return ChatGroq(model=GROQ_MODEL, temperature=0.3, max_tokens=2048, api_key=api_key)"
    },
    {
      "id": "retrieve_initial",
      "name": "retrieve_initial()",
      "fileId": "main",
      "summary": "1차 검색: 벡터 유사도로 상위 INITIAL_K(50)개 후보를 빠르게 가져오는 함수.",
      "how": "2단계 검색의 첫 단계임. similarity_search 는 질문을 임베딩한 뒤 코사인 유사도가 가까운 청크를 순서대로 돌려줌 — 반환 리스트의 순서가 곧 Bi-Encoder 기준 순위(첫 원소가 1위)임. k=INITIAL_K 로 일부러 50개나 넓게 가져와, 빠른 1차 검색이 놓칠 수 있는 핵심 문서까지 후보에 포함시킴.",
      "terms": [
        "Bi-Encoder",
        "유사도 검색",
        "top-k",
        "청크"
      ],
      "lines": [
        {
          "at": "def retrieve_initial",
          "text": "1차 검색(넓게 후보 추출)을 수행하는 함수 정의."
        },
        {
          "at": "return vectorstore.similarity_search(query, k=INITIAL_K)",
          "text": "질문을 임베딩해 유사도 상위 50개 청크를 순위 순으로 가져옴."
        }
      ],
      "code": "def retrieve_initial(vectorstore, query: str) -> list:\n    \"\"\"1차 검색(Bi-Encoder): 벡터 유사도로 상위 INITIAL_K개 후보를 빠르게 추출함.\n\n    similarity_search는 쿼리를 임베딩한 뒤 코사인 유사도 순으로 Document를 반환하므로,\n    반환 리스트의 순서가 곧 Bi-Encoder 기준 순위(1위가 리스트 첫 원소)임.\n    \"\"\"\n    return vectorstore.similarity_search(query, k=INITIAL_K)"
    },
    {
      "id": "rerank_documents",
      "name": "rerank_documents()",
      "fileId": "main",
      "summary": "Cross-Encoder로 1차 후보를 다시 채점·정렬해 상위 top_k개를 돌려주는 재정렬의 핵심 함수.",
      "how": "2단계 검색의 두 번째 단계임. ① 각 후보를 '[질문, 문서본문]' 쌍으로 묶음. ② compute_score(pairs, normalize=True) 로 쌍마다 0~1 사이 관련도 점수를 받음(normalize 로 Sigmoid 정규화). ③ 후보가 1건이면 float가 오므로 리스트로 통일함. ④ enumerate(start=1) 로 각 후보에 1차 검색 순위를 붙여 (1차순위, 문서, 점수) 튜플로 묶음 — 나중에 순위가 어떻게 바뀌었는지 보여 주기 위함. ⑤ 점수 내림차순으로 정렬한 뒤 상위 top_k개만 잘라 돌려줌.",
      "terms": [
        "Re-ranking",
        "Cross-Encoder",
        "relevance score",
        "top-n",
        "청크"
      ],
      "lines": [
        {
          "at": "def rerank_documents",
          "text": "1차 후보를 재정렬해 상위 몇 개만 돌려주는 함수 정의."
        },
        {
          "at": "pairs = [[query, doc.page_content] for doc in docs]",
          "text": "각 후보를 '[질문, 문서본문]' 쌍으로 묶어 Cross-Encoder 입력 형식으로 만듦."
        },
        {
          "at": "scores = reranker.compute_score(pairs, normalize=True)",
          "text": "쌍마다 관련도 점수를 산출하고 Sigmoid로 0~1 범위로 정규화."
        },
        {
          "at": "if isinstance(scores, float)",
          "text": "후보가 1건이면 점수가 float로 오므로 리스트로 통일함."
        },
        {
          "at": "for initial_rank, (doc, score) in enumerate(zip(docs, scores), start=1)",
          "text": "각 후보에 1차 검색 순위(1부터)를 붙여 문서·점수와 함께 묶음."
        },
        {
          "at": "ranked.sort(key=lambda item: item[2], reverse=True)",
          "text": "관련도 점수가 높은 순(내림차순)으로 후보를 다시 정렬함."
        },
        {
          "at": "return ranked[:top_k]",
          "text": "재정렬된 후보 중 상위 top_k개만 잘라 돌려줌."
        }
      ],
      "code": "def rerank_documents(reranker, query: str, docs: list, top_k: int) -> list:\n    \"\"\"Cross-Encoder로 1차 검색 결과를 재정렬하여 상위 top_k개를 반환함.\n\n    반환 형식: (원래_1차순위, doc, 관련도점수) 튜플 리스트 — 1차 순위를 함께 담아\n    재정렬로 순위가 어떻게 바뀌었는지(교육 목적) 출력 단계에서 비교할 수 있게 함.\n    \"\"\"\n    if not docs:\n        return []\n\n    # Cross-Encoder 입력 형식: [쿼리, 문서본문] 쌍의 리스트\n    pairs = [[query, doc.page_content] for doc in docs]\n\n    # normalize=True: 원시 로짓을 Sigmoid로 0~1 범위 관련도 점수로 정규화함\n    scores = reranker.compute_score(pairs, normalize=True)\n\n    # 후보가 1건이면 compute_score가 float를 반환하므로 리스트로 통일함\n    if isinstance(scores, float):\n        scores = [scores]\n\n    # enumerate(start=1): 1차 검색 순위를 1부터 부여해 doc·점수와 함께 묶음\n    ranked = [\n        (initial_rank, doc, score)\n        for initial_rank, (doc, score) in enumerate(zip(docs, scores), start=1)\n    ]\n    # 관련도 점수 내림차순으로 정렬 후 상위 top_k개만 선택함\n    ranked.sort(key=lambda item: item[2], reverse=True)\n    return ranked[:top_k]"
    },
    {
      "id": "_doc_label",
      "name": "_doc_label()",
      "fileId": "main",
      "summary": "문서의 출처(파일명·청크 번호)를 짧은 라벨 문자열로 만드는 도우미 함수.",
      "how": "각 청크에 딸린 부가정보(metadata)에서 출처 파일명(source)과 청크 번호(chunk_index)를 꺼내 '파일명 #번호' 형태의 짧은 라벨로 만듦. 검색 결과·컨텍스트 출력에서 어떤 문서가 근거인지 한눈에 알게 해 줌. 값이 없으면 기본값을 넣어 출력이 깨지지 않게 함.",
      "terms": [
        "metadata",
        "청크"
      ],
      "lines": [
        {
          "at": "def _doc_label",
          "text": "문서 출처를 짧은 라벨로 만드는 도우미 함수 정의."
        },
        {
          "at": "source = doc.metadata.get(\"source\"",
          "text": "청크의 출처 파일명을 메타데이터에서 꺼냄(없으면 기본값)."
        },
        {
          "at": "chunk_index = doc.metadata.get(\"chunk_index\"",
          "text": "청크가 문서에서 몇 번째 조각인지 번호를 꺼냄."
        },
        {
          "at": "return f\"{source} #{chunk_index}\"",
          "text": "'파일명 #번호' 형태의 라벨 문자열로 합쳐 돌려줌."
        }
      ],
      "code": "def _doc_label(doc) -> str:\n    \"\"\"문서 메타데이터(공용 DB는 source/chunk_index만 존재)를 짧은 라벨로 만듦.\"\"\"\n    source = doc.metadata.get(\"source\", \"알 수 없음\")\n    chunk_index = doc.metadata.get(\"chunk_index\", \"?\")\n    return f\"{source} #{chunk_index}\""
    },
    {
      "id": "print_initial_results",
      "name": "print_initial_results()",
      "fileId": "main",
      "summary": "1차 검색(Bi-Encoder) 결과 상위 일부를 미리보기로 출력하는 함수.",
      "how": "재정렬 전, 1차 검색이 어떤 순서로 후보를 뽑았는지 상위 10건만 미리보기로 보여 줌. 각 줄에 순위·출처 라벨·본문 앞 60자를 출력해, 나중에 재정렬 결과와 비교할 기준선을 제공함(교육 목적).",
      "terms": [
        "Bi-Encoder",
        "청크"
      ],
      "lines": [
        {
          "at": "def print_initial_results",
          "text": "1차 검색 결과 미리보기를 출력하는 함수 정의."
        },
        {
          "at": "[1차 검색] Bi-Encoder",
          "text": "1차 검색이 Bi-Encoder 방식임을 헤더로 표시."
        },
        {
          "at": "for rank, doc in enumerate(docs[:10], start=1)",
          "text": "상위 10건만 순위를 매기며 하나씩 출력 준비."
        },
        {
          "at": "preview = doc.page_content[:60]",
          "text": "본문 앞 60자만 한 줄 미리보기로 잘라 보여 줌."
        }
      ],
      "code": "def print_initial_results(docs: list) -> None:\n    \"\"\"1차 검색(Bi-Encoder) 결과 상위 일부를 미리보기로 출력함.\"\"\"\n    print(\"\\n\" + \"-\" * 70)\n    print(f\"[1차 검색] Bi-Encoder Top-{len(docs)} (상위 10건 미리보기)\")\n    print(\"-\" * 70)\n    for rank, doc in enumerate(docs[:10], start=1):\n        preview = doc.page_content[:60].replace(\"\\n\", \" \")\n        print(f\"  {rank:2d}. {_doc_label(doc)}: {preview}...\")"
    },
    {
      "id": "print_reranked_results",
      "name": "print_reranked_results()",
      "fileId": "main",
      "summary": "재정렬 결과를 출력하되, 1차 순위→재정렬 순위 변화를 ▲▼ 화살표로 함께 보여 주는 함수.",
      "how": "재정렬의 효과를 눈으로 보여 주는 핵심 출력임. 각 문서에 대해 1차 순위와 새 순위의 차이를 계산해, 올랐으면 ▲, 내렸으면 ▼, 그대로면 ─ 로 표시함. 함께 관련도 점수와 출처 라벨, 본문 앞 70자도 출력해 '왜 이 문서가 위로 올라왔는지'를 가늠하게 함.",
      "terms": [
        "Re-ranking",
        "Cross-Encoder",
        "relevance score"
      ],
      "lines": [
        {
          "at": "def print_reranked_results",
          "text": "재정렬 결과와 순위 변화를 출력하는 함수 정의."
        },
        {
          "at": "[Re-ranking] Cross-Encoder",
          "text": "재정렬이 Cross-Encoder 방식임을 헤더로 표시."
        },
        {
          "at": "for new_rank, (initial_rank, doc, score) in enumerate(reranked, start=1)",
          "text": "재정렬된 문서를 새 순위와 함께 하나씩 처리."
        },
        {
          "at": "move = initial_rank - new_rank",
          "text": "1차 순위 대비 몇 칸 올랐는지/내렸는지를 계산."
        },
        {
          "at": "marker = f\"",
          "text": "상승은 ▲, 하강은 ▼, 유지는 ─ 화살표로 변화를 시각화."
        },
        {
          "at": "[점수 {score:.4f}]",
          "text": "각 문서의 관련도 점수(소수 4자리)와 출처를 함께 출력."
        }
      ],
      "code": "def print_reranked_results(reranked: list) -> None:\n    \"\"\"Re-ranking 결과를 출력하되, 1차 순위 → 재정렬 순위 변화를 함께 표시함.\"\"\"\n    print(\"\\n\" + \"=\" * 70)\n    print(f\"[Re-ranking] Cross-Encoder Top-{len(reranked)} (1차 순위 → 재정렬 순위)\")\n    print(\"=\" * 70)\n    for new_rank, (initial_rank, doc, score) in enumerate(reranked, start=1):\n        # 1차 순위 대비 상승/하강/유지를 화살표로 표시해 재정렬 효과를 시각화함\n        move = initial_rank - new_rank\n        marker = f\"▲{move}\" if move > 0 else (f\"▼{-move}\" if move < 0 else \"─\")\n        preview = doc.page_content[:70].replace(\"\\n\", \" \")\n        print(f\"  {new_rank}. (1차 {initial_rank:2d}위 {marker}) [점수 {score:.4f}] {_doc_label(doc)}\")\n        print(f\"     {preview}...\")"
    },
    {
      "id": "format_context",
      "name": "format_context()",
      "fileId": "main",
      "summary": "재정렬된 문서들을 LLM 프롬프트에 넣을 한 덩어리 컨텍스트 문자열로 합치는 함수.",
      "how": "재정렬로 추려진 Top-5 문서를 LLM에게 글로 전달하기 위해 합침. 각 문서 앞에 [문서 N]·출처 라벨·관련도 점수를 붙여 LLM이 근거를 인용하기 쉽게 하고, 문서 사이는 구분선(---)으로 띄워 경계를 분명히 함.",
      "terms": [
        "프롬프트",
        "relevance score",
        "청크"
      ],
      "lines": [
        {
          "at": "def format_context",
          "text": "재정렬 문서들을 컨텍스트 문자열로 합치는 함수 정의."
        },
        {
          "at": "blocks = []",
          "text": "각 문서 블록을 문자열로 만들어 담을 빈 리스트를 준비."
        },
        {
          "at": "header = f\"[문서 {new_rank}]",
          "text": "[문서 N]·출처·관련도 점수가 담긴 헤더를 만듦."
        },
        {
          "at": "blocks.append(",
          "text": "헤더와 본문을 합친 한 문서 블록을 리스트에 추가."
        },
        {
          "at": ".join(blocks)",
          "text": "모든 문서 블록을 구분선으로 이어 하나의 컨텍스트로 만듦."
        }
      ],
      "code": "def format_context(reranked: list) -> str:\n    \"\"\"재정렬된 문서들을 LLM 프롬프트에 넣을 컨텍스트 문자열로 합침.\"\"\"\n    blocks = []\n    for new_rank, (_initial_rank, doc, score) in enumerate(reranked, start=1):\n        header = f\"[문서 {new_rank}] (출처: {_doc_label(doc)}, 관련도 {score:.4f})\"\n        blocks.append(f\"{header}\\n{doc.page_content}\")\n    return \"\\n\\n---\\n\\n\".join(blocks)"
    },
    {
      "id": "build_chain",
      "name": "build_chain()",
      "fileId": "main",
      "summary": "프롬프트 → LLM → 문자열 추출로 이어지는 LCEL 체인을 구성하는 함수.",
      "how": "답변 생성 파이프라인을 한 줄로 조립함. system 프롬프트(역할·규칙)와 human 프롬프트(질문)를 ChatPromptTemplate 으로 묶고, LCEL 파이프(prompt | llm | StrOutputParser)로 연결함. 이렇게 만든 체인에 컨텍스트·질문을 넣어 invoke 하면 프롬프트 완성 → LLM 호출 → 본문 문자열만 추출까지 한 번에 흐름.",
      "terms": [
        "ChatPromptTemplate",
        "LCEL",
        "파이프(|)",
        "StrOutputParser",
        "프롬프트",
        "invoke"
      ],
      "lines": [
        {
          "at": "def build_chain",
          "text": "프롬프트→LLM→파서로 이어지는 체인을 만드는 함수 정의."
        },
        {
          "at": "from langchain_core.prompts import ChatPromptTemplate",
          "text": "system·human 메시지를 묶을 프롬프트 템플릿을 가져옴."
        },
        {
          "at": "from langchain_core.output_parsers import StrOutputParser",
          "text": "LLM 응답에서 본문 문자열만 뽑는 파서를 가져옴."
        },
        {
          "at": "prompt = ChatPromptTemplate.from_messages(",
          "text": "시스템·사용자 프롬프트를 하나의 프롬프트로 구성."
        },
        {
          "at": "return prompt | llm | StrOutputParser()",
          "text": "LCEL 파이프(|)로 프롬프트→LLM→문자열파서를 한 줄로 연결해 돌려줌."
        }
      ],
      "code": "def build_chain(llm):\n    \"\"\"프롬프트 → LLM → 문자열 추출로 이어지는 LCEL 체인을 구성함.\"\"\"\n    from langchain_core.prompts import ChatPromptTemplate   # 시스템/사용자 메시지 템플릿\n    from langchain_core.output_parsers import StrOutputParser  # LLM 응답에서 본문 문자열만 추출\n\n    prompt = ChatPromptTemplate.from_messages([\n        (\"system\", SYSTEM_PROMPT),\n        (\"human\", \"{question}\"),\n    ])\n    # LCEL 파이프: prompt가 만든 메시지를 llm에 전달하고 결과를 문자열로 파싱함\n    return prompt | llm | StrOutputParser()"
    },
    {
      "id": "run_query",
      "name": "run_query()",
      "fileId": "main",
      "summary": "질문 하나에 대해 1차 검색 → 재정렬 → 답변 생성의 전체 흐름을 수행하는 핵심 함수.",
      "how": "2단계 RAG의 실행 전체를 한 함수에 담음. ① retrieve_initial 로 1차 후보 50개를 가져와 미리보기 출력. ② rerank_documents 로 Cross-Encoder 재정렬해 Top-5를 선정하고 순위 변화를 출력. ③ format_context 로 만든 컨텍스트와 질문을 chain.invoke 에 넣어 답을 생성하고 출력함. 1차→재정렬→생성이 한눈에 보이도록 단계마다 결과를 콘솔에 찍음.",
      "terms": [
        "2단계 검색",
        "Re-ranking",
        "invoke",
        "top-n"
      ],
      "lines": [
        {
          "at": "def run_query",
          "text": "질문 하나의 전체 흐름(검색→재정렬→생성)을 수행하는 함수 정의."
        },
        {
          "at": "initial_docs = retrieve_initial(vectorstore, query)",
          "text": "①1차 검색: 후보 50개를 넓게 가져옴."
        },
        {
          "at": "reranked = rerank_documents(reranker, query, initial_docs, RERANK_K)",
          "text": "②재정렬: Cross-Encoder로 정밀 채점해 Top-5를 선정."
        },
        {
          "at": "context = format_context(reranked)",
          "text": "재정렬 Top-5를 LLM에 넣을 컨텍스트 문자열로 변환."
        },
        {
          "at": "answer = chain.invoke(",
          "text": "③생성: 컨텍스트와 질문을 체인에 넣어 답변을 받음."
        }
      ],
      "code": "def run_query(vectorstore, reranker, chain, query: str) -> None:\n    \"\"\"질의 하나에 대해 1차 검색 → Re-ranking → 답변 생성의 전체 흐름을 수행함.\"\"\"\n    print(f\"\\n질문: {query}\")\n\n    # 1) 1차 검색 (Bi-Encoder, 넓게)\n    initial_docs = retrieve_initial(vectorstore, query)\n    print_initial_results(initial_docs)\n\n    # 2) Re-ranking (Cross-Encoder, 정밀)\n    reranked = rerank_documents(reranker, query, initial_docs, RERANK_K)\n    print_reranked_results(reranked)\n\n    # 3) 답변 생성 (재정렬 Top-K만 컨텍스트로 사용)\n    print(\"\\n답변 생성 중...\\n\")\n    context = format_context(reranked)\n    answer = chain.invoke({\"context\": context, \"question\": query})\n    print(\"-\" * 70)\n    print(answer)\n    print(\"-\" * 70)"
    },
    {
      "id": "main",
      "name": "main()",
      "fileId": "main",
      "summary": "리소스 로드 → 기본 질의어 데모 1회 → 대화형 입력 루프 순으로 전체를 실행하는 진입점.",
      "how": "전체 흐름을 지휘함. ① load_vectorstore()·load_reranker()·build_chain(load_llm()) 로 1차 검색기·재정렬 모델·LLM 체인 세 가지를 준비함. ② 기본 질의어로 run_query 를 1회 시연함. ③ 그 뒤 while 루프로 사용자가 직접 질문을 입력해 재정렬 효과를 체험하게 하고, quit/q/빈 줄이면 종료함. 맨 아래 if __name__ == \"__main__\" 은 이 파일을 직접 실행할 때만 main() 을 부르는 관용구이며, try/except 로 오류를 보여 주고 비정상 종료 코드로 빠져나감.",
      "terms": [
        "if __name__ == \"__main__\"",
        "2단계 검색",
        "Re-ranking"
      ],
      "lines": [
        {
          "at": "def main",
          "text": "전체 파이프라인을 실행하는 진입점 함수 정의."
        },
        {
          "at": "vectorstore = load_vectorstore()",
          "text": "공용 벡터 DB를 연결해 1차 검색기를 준비."
        },
        {
          "at": "reranker = load_reranker()",
          "text": "정밀 채점용 Cross-Encoder 재정렬 모델을 준비."
        },
        {
          "at": "chain = build_chain(load_llm())",
          "text": "LLM을 만들어 답변 생성 체인을 준비."
        },
        {
          "at": "run_query(vectorstore, reranker, chain, DEFAULT_QUERY)",
          "text": "기본 질의어로 전체 파이프라인을 1회 시연."
        },
        {
          "at": "while True:",
          "text": "사용자가 직접 질문을 입력하는 대화형 루프 시작."
        },
        {
          "at": "if not question or question.lower() in",
          "text": "quit/q/빈 줄 등이면 루프를 끝내고 종료."
        },
        {
          "at": "if __name__",
          "text": "이 파일을 직접 실행할 때만 아래 main()을 수행하는 관용구."
        },
        {
          "at": "print(f\"\\n[오류] 실행 실패",
          "text": "최상위에서 오류를 잡아 메시지를 출력하고 비정상 종료."
        }
      ],
      "code": "def main() -> None:\n    \"\"\"리소스 로드 후 기본 질의어 데모를 1회 실행하고 대화형 입력 루프로 진입함.\"\"\"\n    print(\"=\" * 70)\n    print(\"특허법 RAG 예제 (Re-ranking)\")\n    print(f\"설정: 1차 검색 Top-{INITIAL_K} → Re-ranking → Top-{RERANK_K} / LLM: {GROQ_MODEL}\")\n    print(\"=\" * 70)\n\n    print(\"\\n[준비] 리소스 로드\")\n    vectorstore = load_vectorstore()\n    reranker = load_reranker()\n    chain = build_chain(load_llm())\n\n    # 기본 질의어로 전체 파이프라인을 1회 시연함\n    run_query(vectorstore, reranker, chain, DEFAULT_QUERY)\n\n    # 대화형 루프: 사용자가 직접 질문을 입력해 재정렬 효과를 체험할 수 있게 함\n    print(\"\\n\" + \"=\" * 70)\n    print(\"대화형 모드 — 질문을 입력하세요 (종료: quit / q / 빈 줄)\")\n    print(\"=\" * 70)\n    while True:\n        try:\n            question = input(\"\\n질문> \").strip()\n        except (EOFError, KeyboardInterrupt):\n            print(\"\\n종료합니다.\")\n            break\n        if not question or question.lower() in {\"quit\", \"q\", \"exit\", \"종료\"}:\n            print(\"종료합니다.\")\n            break\n        try:\n            run_query(vectorstore, reranker, chain, question)\n        except Exception as error:\n            print(f\"\\n[오류] 질의 처리 실패: {error}\")\n\n\n# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)\nif __name__ == \"__main__\":\n    try:\n        main()\n    except Exception as error:\n        print(f\"\\n[오류] 실행 실패: {error}\", file=sys.stderr)\n        sys.exit(1)"
    }
  ],
  "glossary": {
    "Re-ranking": "재정렬. 1차 검색으로 모은 후보를 더 정밀한 모델로 다시 채점해 순위를 매기는 단계. 빠른 검색이 놓친 핵심 문서를 위로 끌어올려 검색 품질을 높임.",
    "2단계 검색": "1차로 빠르게 후보를 넓게 가져온 뒤(1차 검색→재정렬), 정밀 모델로 다시 추리는 2단계 방식. 'Retrieve More, Rerank Better' 전략으로 recall과 precision을 동시에 확보함.",
    "Bi-Encoder": "질문과 문서를 '각각 따로' 벡터로 바꿔(임베딩) 거리만 재는 방식. 미리 계산해 둘 수 있어 매우 빠르지만, 둘의 상호작용을 못 봐 정확도는 상대적으로 낮음. 1차 검색에 사용.",
    "Cross-Encoder": "질문과 문서를 '하나로 합쳐' 함께 읽고 관련도 점수를 내는 방식. 단어 사이 상호작용까지 따져 정확하지만, 쌍마다 매번 계산해야 해 느림. 재정렬에 사용.",
    "FlagReranker": "Cross-Encoder 재정렬 모델을 쉽게 쓰게 해 주는 래퍼. '질문+문서' 쌍을 넣으면 관련도 점수를 돌려줌. 이 예제는 한국어 최적화 모델(dragonkue/bge-reranker-v2-m3-ko)을 사용.",
    "relevance score": "관련성 점수. 질문과 문서가 얼마나 관련 있는지를 나타내는 수치. 이 예제는 0~1 사이로 정규화(Sigmoid)해 높을수록 더 관련 있음을 뜻함.",
    "top-k": "검색에서 '가장 비슷한 상위 k개'를 가져온다는 뜻. 이 예제의 1차 검색은 INITIAL_K=50 으로 50개를 넓게 가져옴.",
    "top-n": "여러 후보 중 '상위 n개'만 추린다는 뜻. 이 예제는 재정렬 후 RERANK_K=5 로 5개만 LLM에 넘김.",
    "임베딩": "텍스트를 의미가 담긴 숫자 벡터(여러 숫자의 나열)로 바꾼 것. 뜻이 비슷한 글은 벡터도 가깝게 위치해, 컴퓨터가 '비슷한 내용'을 계산으로 찾을 수 있음.",
    "벡터 DB": "임베딩(숫자 벡터)을 저장하고, 질문 벡터와 가장 가까운 것들을 빠르게 찾아 주는 데이터베이스. 여기서는 ChromaDB를 사용함.",
    "ChromaDB": "오픈소스 벡터 데이터베이스. 임베딩을 저장하고 유사도 검색을 해 줌. 로컬 폴더에 영속화(저장)되어 재실행 시 그대로 재사용 가능.",
    "Chroma": "ChromaDB를 LangChain에서 다루는 래퍼 클래스. 여기서는 신규 생성이 아니라 생성자로 기존 컬렉션을 '연결'만 함.",
    "컬렉션": "벡터 DB 안에서 벡터들을 묶어 두는 단위(여기서는 patent_law). 인덱싱과 검색이 같은 컬렉션 이름을 써야 검색이 됨.",
    "청크": "chunk. 긴 문서를 검색하기 좋게 잘게 나눈 한 조각. 이 예제는 이미 나뉘어 저장된 청크를 검색해서 사용함.",
    "metadata": "청크에 딸린 부가정보(예: 출처 파일명 source, 청크 번호 chunk_index). 답변의 출처를 표시하는 데 사용함.",
    "OpenAIEmbeddings": "OpenAI 임베딩 모델 호출 래퍼. 텍스트를 숫자 벡터로 변환함. 여기서는 질의(질문)를 벡터로 바꾸는 데 사용.",
    "text-embedding-3-small": "OpenAI의 임베딩 모델 이름(1536차원). 인덱싱 때 쓴 모델과 검색 때 쓰는 모델이 같아야 의미 공간이 맞아 검색이 됨.",
    "유사도 검색": "similarity search. 질문 벡터와 문서 벡터의 '가까운 정도'를 계산해 가장 가까운 것부터 찾는 검색 방식.",
    "ChatGroq": "Groq 클라우드의 채팅 LLM을 호출하는 LangChain 래퍼. GROQ_API_KEY를 자동 참조함.",
    "Groq LPU": "Groq사가 만든 LLM 추론 전용 칩(Language Processing Unit). 매우 빠른 응답 속도가 특징.",
    "gpt-oss-120b": "Groq LPU에서 서빙하는 오픈 가중치 LLM(약 1200억 파라미터). 이 예제의 답변 생성 모델.",
    "temperature": "LLM 답변의 무작위성 정도. 0에 가까울수록 매번 비슷하고 일관된(보수적인) 답을 냄. 이 예제는 0.3 사용.",
    "ChatPromptTemplate": "LLM에 보낼 프롬프트(지시문)의 틀. {context}·{question} 같은 빈칸에 실제 값을 채워 완성된 프롬프트를 만듦.",
    "프롬프트": "LLM에게 주는 지시문. 여기서는 '컨텍스트 근거로만 쉬운 말로 답하라'는 시스템 프롬프트와 질문을 담는 사용자 프롬프트로 나뉨.",
    "LCEL": "LangChain Expression Language. 파이프 기호(|)로 단계들을 왼쪽→오른쪽으로 연결해 하나의 처리 흐름(체인)을 만드는 문법.",
    "파이프(|)": "LCEL에서 앞 단계의 결과를 다음 단계의 입력으로 흘려보내는 연결 기호. 'prompt | llm | parser'처럼 씀.",
    "StrOutputParser": "LLM 응답 객체에서 사람이 읽을 본문 문자열만 깔끔히 뽑아 주는 출력 파서.",
    "invoke": "LangChain 체인/모델을 '실행'하는 메서드. 입력을 넣으면 끝까지 돌려 결과를 돌려줌.",
    "load_dotenv": ".env 파일에 적어 둔 비밀값(예: OPENAI_API_KEY, GROQ_API_KEY)을 프로그램의 환경변수로 불러오는 함수.",
    "from __future__ import annotations": "타입 힌트를 즉시 평가하지 않고 문자열로 두게 하는 파이썬 선언. 순환 참조 없이 가볍게 타입 힌트를 쓰게 해 줌.",
    "if __name__ == \"__main__\"": "이 파일을 직접 실행할 때만 특정 코드를 돌리고, 다른 곳에서 import할 때는 돌리지 않게 하는 파이썬 관용구.",
    "API 키 검사": "필요한 API 키가 환경변수에 없으면 실행 초기에 명확한 오류를 내는 패턴. 한참 뒤에 엉뚱한 곳에서 실패하는 것을 막아 디버깅을 쉽게 함."
  }
};
