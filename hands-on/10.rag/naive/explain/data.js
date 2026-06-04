window.EXPLAIN_DATA = {
  "meta": {
    "title": "Naive RAG — 가장 기본적인 검색·생성 파이프라인",
    "entry": "naive_rag.py"
  },
  "files": [
    {
      "id": "main",
      "label": "naive_rag.py",
      "role": "공용 벡터 DB를 검색해 LLM이 근거 기반 답변을 만드는 CLI RAG 전체"
    }
  ],
  "flow": [
    {
      "step": 1,
      "title": "실행 & 환경 준비",
      "label": "실행·환경 준비",
      "refs": ["setup", "main"],
      "summary": "python naive_rag.py 로 실행하고, .env 의 API 키를 불러옴",
      "detail": "터미널에서 'python naive_rag.py' 또는 'python naive_rag.py \"질문\"' 으로 실행함. 시작과 동시에 load_dotenv() 가 hands-on/.env 에 적어 둔 OPENAI_API_KEY(질의 임베딩용)와 GROQ_API_KEY(LLM용)를 읽어 둠. 한글 출력이 깨지지 않게 표준출력을 UTF-8로 맞추는 처리도 함. 비유하면, 사서(앱)가 출근해 책상에 두 개의 열쇠(임베딩 열쇠·답변 열쇠)를 챙겨 두는 단계."
    },
    {
      "step": 2,
      "title": "벡터 DB 로드 (검색기 만들기)",
      "label": "벡터 DB 로드",
      "refs": ["load_retriever"],
      "summary": "이미 만들어 둔 공용 벡터 DB를 '재임베딩 없이' 연결함",
      "detail": "이 예제는 PDF를 새로 읽거나 쪼개지 않음. 그 작업(인덱싱)은 ../indexing/indexing.py 가 미리 해 두었고, 여기서는 그 결과물인 공용 ChromaDB(컬렉션 patent_law)를 그냥 연결만 함. 연결된 벡터 DB를 검색기(retriever)로 바꿔, 질문이 오면 비슷한 청크를 찾을 준비를 함. 비유하면, 이미 정리된 서가에 사서가 그대로 접근 권한을 얻는 것 — 책을 다시 꽂지 않음."
    },
    {
      "step": 3,
      "title": "LLM 준비",
      "label": "LLM 준비",
      "refs": ["create_llm"],
      "summary": "답변을 생성할 Groq LLM(gpt-oss-120b)을 준비함",
      "detail": "검색한 근거를 바탕으로 실제 문장을 써 줄 LLM을 준비함. Groq LPU에서 서빙하는 openai/gpt-oss-120b 를 쓰며, 추론 과정이 답에 섞이지 않도록 reasoning_format=\"hidden\" 으로 최종 답변만 받음. temperature=0 이라 같은 질문엔 같은 답을 냄. 비유하면, 자료를 보고 답을 써 줄 '글쓰는 직원'을 부르는 단계."
    },
    {
      "step": 4,
      "title": "탐색 (Retrieve)",
      "label": "탐색",
      "refs": ["answer_query"],
      "summary": "질문을 임베딩해 의미가 비슷한 청크 5개(top-k)를 찾음",
      "detail": "사용자 질문도 문서와 똑같은 방식으로 숫자 벡터(임베딩)로 바꾼 뒤, 벡터 DB에서 가장 가까운(=의미가 비슷한) 청크 상위 5개를 꺼냄(유사도 검색). 'Naive'는 이 검색을 한 번만, 가공 없이 단순하게 한다는 뜻 — 질문을 바꿔보거나(Query Transformation) 재정렬(Re-ranking)하는 단계가 없음. 비유하면, 사서가 질문 카드와 좌표가 가장 가까운 서가 카드 5장을 그대로 뽑아 오는 것."
    },
    {
      "step": 5,
      "title": "생성 (Generate)",
      "label": "생성",
      "refs": ["answer_query", "format_docs"],
      "summary": "찾은 청크를 근거로 넣어 LLM이 답을 만듦",
      "detail": "찾아온 청크 5개를 [출처] 라벨과 함께 '컨텍스트'로 프롬프트에 채우고, LLM이 그 근거만 바탕으로 답을 생성함. 프롬프트에 '문서에 없으면 추측하지 말 것'이라는 규칙이 있어 지어내기(환각)를 줄임. 이 조립은 LCEL 파이프(prompt | llm | StrOutputParser)로 이뤄짐. 비유하면, 사서가 뽑아 온 5장의 카드만 보고 질문에 답을 적어 주는 것."
    },
    {
      "step": 6,
      "title": "결과 출력",
      "label": "결과 출력",
      "refs": ["print_result"],
      "summary": "생성된 답변과 '검색 출처'를 콘솔에 보기 좋게 표시",
      "detail": "최종 답변을 출력하고, 어떤 청크가 근거였는지(파일명·청크 번호·앞부분 미리보기)도 함께 보여 줌. 근거를 함께 보여 주는 것은 RAG의 핵심 장점 — 사람이 답의 출처를 검증할 수 있음. 비유하면, 답안과 함께 '참고한 카드 목록'을 같이 제출하는 것."
    }
  ],
  "functions": [
    {
      "id": "setup",
      "name": "임포트·경로·상수 설정",
      "fileId": "main",
      "summary": "필요한 모듈을 가져오고, 파일 위치 기준으로 경로를 잡고, .env 키와 핵심 상수를 준비하는 부분.",
      "how": "함수가 아니라 파일 위쪽의 준비 코드 모음임. ① from __future__ import annotations 로 타입 힌트를 가볍게 쓰고, 표준출력을 UTF-8로 맞춤. ② 모든 경로를 이 파일 위치(__file__) 기준으로 계산해, 어디서 실행해도 같은 공용 벡터 DB와 .env 를 가리키게 함. ③ load_dotenv 로 키를 올리고, 컬렉션명·임베딩 모델·LLM 모델·TOP_K·기본 질의어·프롬프트 같은 상수를 정함. 특히 임베딩 모델은 인덱싱 때와 반드시 같아야 검색이 성립함.",
      "terms": [
        "from __future__ import annotations",
        "Path(__file__).resolve().parent",
        "load_dotenv",
        "컬렉션",
        "영속화",
        "text-embedding-3-small",
        "TOP_K",
        "프롬프트"
      ],
      "lines": [
        {
          "at": "from __future__ import annotations",
          "text": "타입 힌트를 문자열로 평가해 가볍게 쓰게 하는 파이썬 설정."
        },
        {
          "at": "import sys",
          "text": "명령줄 인자·표준출력 등 시스템 기능을 쓰기 위한 기본 모듈."
        },
        {
          "at": "sys.stdout.reconfigure(encoding",
          "text": "윈도우 콘솔에서 한글이 깨지지 않도록 출력 인코딩을 UTF-8로 바꿈."
        },
        {
          "at": "SCRIPT_DIR = Path(__file__)",
          "text": "이 파일이 있는 폴더(naive/)를 절대경로로 구함 — 실행 위치와 무관하게 동작."
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
          "at": "from dotenv import load_dotenv",
          "text": ".env 의 비밀값을 불러오는 함수를 가져옴."
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
          "at": "LLM_MODEL =",
          "text": "답변을 생성할 LLM(Groq의 gpt-oss-120b) 이름."
        },
        {
          "at": "TOP_K = 5",
          "text": "검색으로 가져올 비슷한 청크 개수를 5개로 정함(top-k)."
        },
        {
          "at": "DEFAULT_QUERY =",
          "text": "명령줄에 질문을 안 줬을 때 쓸 기본 질문."
        },
        {
          "at": "SYSTEM_PROMPT = (",
          "text": "문서 근거로만 답하고 추측 금지를 지시하는 시스템 프롬프트."
        },
        {
          "at": "HUMAN_PROMPT =",
          "text": "검색 문맥{context}과 질문{question}을 끼워 넣을 사용자 프롬프트 틀."
        }
      ],
      "code": "from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함\n\nimport sys\nfrom pathlib import Path\n\n# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함\nif hasattr(sys.stdout, \"reconfigure\"):\n    sys.stdout.reconfigure(encoding=\"utf-8\")\n\n# ---------------------------------------------------------------------------\n# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)\n# ---------------------------------------------------------------------------\nSCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(naive/)를 절대경로로 구함\nRAG_DIR = SCRIPT_DIR.parent                     # hands-on/10.rag/\nVECTORDB_DIR = RAG_DIR / \"vectordb\"             # 공용 ChromaDB 영속화 디렉터리 (8.0 인덱싱으로 생성)\nENV_PATH = RAG_DIR.parent / \".env\"              # hands-on/.env (API 키 보관)\n\n# ---------------------------------------------------------------------------\n# 환경변수 로드\n# ---------------------------------------------------------------------------\nfrom dotenv import load_dotenv\n\nload_dotenv(ENV_PATH)  # .env에서 OPENAI_API_KEY(질의 임베딩)·GROQ_API_KEY(LLM)를 로드함\n\n# ---------------------------------------------------------------------------\n# 상수 정의\n# ---------------------------------------------------------------------------\nCOLLECTION_NAME = \"patent_law\"               # 공용 벡터 DB 컬렉션명 (인덱싱과 동일해야 검색 가능)\nEMBEDDING_MODEL = \"text-embedding-3-small\"   # 질의 임베딩 모델 (인덱싱과 반드시 동일, 1536차원)\nLLM_MODEL = \"openai/gpt-oss-120b\"            # Groq LPU에서 서빙하는 답변 생성용 LLM\nTOP_K = 5                                    # 유사도 검색으로 가져올 상위 청크 수 (Naive RAG 통상값)\nDEFAULT_QUERY = \"특허를 받을 수 있는 조건은 ?\"  # 인자 미지정 시 사용할 기본 질의어 (교재 8.1 테스트 질의어)\n\n# 검색된 문서에 근거해서만 답하도록 제약하는 RAG 프롬프트\n# context에는 검색된 청크들이, question에는 사용자 질의어가 주입됨\nSYSTEM_PROMPT = (\n    \"당신은 대한민국 특허법 문서를 근거로 답변하는 RAG 어시스턴트임. \"\n    \"반드시 아래 [참고 문서]에 있는 내용만 근거로 답변하고, 문서에 없는 내용은 추측하지 말 것. \"\n    \"근거를 찾을 수 없으면 '제공된 문서에서 관련 내용을 찾을 수 없습니다.'라고 답할 것. \"\n    \"답변은 한국어로 간결하게 작성하고, 가능하면 근거가 된 조문을 함께 언급할 것.\"\n)\nHUMAN_PROMPT = \"[참고 문서]\\n{context}\\n\\n[질문]\\n{question}\\n\\n[답변]\""
    },
    {
      "id": "load_retriever",
      "name": "load_retriever()",
      "fileId": "main",
      "summary": "이미 만들어진 공용 ChromaDB를 재임베딩 없이 연결해 '검색기(retriever)'로 돌려주는 함수.",
      "how": "RAG의 검색 쪽 준비를 담당함. 새로 인덱싱하지 않고, 인덱싱(../indexing)이 만들어 둔 영속 컬렉션을 그대로 연결함. ① 질의 임베딩에 OpenAI 키가 필요하므로 없으면 즉시 오류를 냄. ② 벡터 DB 폴더가 있는지 확인함. ③ 인덱싱과 동일한 임베딩 모델로 OpenAIEmbeddings 를 만들고, Chroma(...) 로 기존 컬렉션을 연결함. ④ 저장된 벡터가 0개면 오류를 내고, 정상이면 as_retriever 로 '상위 TOP_K개를 찾는 검색기'를 돌려줌.",
      "terms": [
        "Dense Retrieval",
        "ChromaDB",
        "Chroma",
        "영속화",
        "컬렉션",
        "OpenAIEmbeddings",
        "as_retriever",
        "retriever",
        "top-k",
        "유사도 검색",
        "API 키 검사"
      ],
      "lines": [
        {
          "at": "def load_retriever",
          "text": "공용 벡터 DB를 연결해 검색기를 만드는 함수 정의."
        },
        {
          "at": "from langchain_chroma import Chroma",
          "text": "영속화된 벡터 컬렉션을 연결하는 Chroma 래퍼를 가져옴."
        },
        {
          "at": "from langchain_openai import OpenAIEmbeddings",
          "text": "질의를 벡터로 바꿀 임베딩 모델을 가져옴."
        },
        {
          "at": "if not os.getenv(\"OPENAI_API_KEY\")",
          "text": "임베딩에 필요한 OpenAI 키가 없으면 초기에 명확히 오류를 냄."
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
          "text": "from_documents(신규 생성)가 아니라 기존 컬렉션을 '연결'만 함."
        },
        {
          "at": "collection_name=COLLECTION_NAME",
          "text": "어떤 컬렉션을 열지 이름으로 지정."
        },
        {
          "at": "persist_directory=str(VECTORDB_DIR)",
          "text": "디스크에 저장된 벡터 폴더를 가리켜 재임베딩 없이 재사용."
        },
        {
          "at": "count = vectorstore._collection.count()",
          "text": "저장된 벡터 개수를 읽어 인덱싱이 비었는지 확인."
        },
        {
          "at": "if count == 0",
          "text": "벡터가 하나도 없으면 인덱싱 재실행이 필요하므로 오류를 냄."
        },
        {
          "at": "return vectorstore.as_retriever(search_kwargs",
          "text": "벡터 DB를 '상위 TOP_K개를 찾는 검색기'로 바꿔 돌려줌."
        }
      ],
      "code": "def load_retriever():\n    \"\"\"공용 ChromaDB를 재임베딩 없이 로드하여 Dense Retriever를 반환함.\n\n    Chroma(...) 생성자: from_documents(신규 인덱싱)와 달리 이미 영속화된 컬렉션을 그대로 연결함.\n    embedding_function에 인덱싱과 동일한 모델을 지정해야 질의 임베딩 차원·의미 공간이 일치하여\n    유사도 검색이 정상 동작함.\n    as_retriever(): 벡터 저장소를 LCEL 체인에 꽂을 수 있는 Retriever 객체로 변환함.\n    \"\"\"\n    import os\n\n    from langchain_chroma import Chroma\n    from langchain_openai import OpenAIEmbeddings\n\n    # 질의 임베딩에 OpenAI API가 필요하므로 키 부재 시 즉시 명확한 오류를 발생시킴\n    if not os.getenv(\"OPENAI_API_KEY\"):\n        raise RuntimeError(f\"OPENAI_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요\")\n\n    # 인덱싱이 선행되어야 검색 가능하므로 영속 디렉터리 존재 여부를 먼저 확인함\n    if not VECTORDB_DIR.exists():\n        raise FileNotFoundError(\n            f\"공용 벡터 DB가 없음: {VECTORDB_DIR}\\n\"\n            f\"먼저 ../indexing/indexing.py 로 인덱싱을 수행해야 함\"\n        )\n\n    # OpenAIEmbeddings: 텍스트를 1536차원 벡터로 변환 (질의 임베딩에 사용, OPENAI_API_KEY 자동 참조)\n    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)\n\n    # Chroma: 영속화된 벡터 컬렉션을 연결하는 LangChain 벡터 저장소 래퍼\n    vectorstore = Chroma(\n        collection_name=COLLECTION_NAME,\n        embedding_function=embeddings,\n        persist_directory=str(VECTORDB_DIR),\n    )\n\n    # ._collection.count(): 컬렉션에 저장된 벡터 개수. 0이면 인덱싱이 비었음을 뜻함\n    count = vectorstore._collection.count()\n    if count == 0:\n        raise ValueError(f\"벡터 DB가 비어 있음 (컬렉션 '{COLLECTION_NAME}'). 인덱싱 재실행 필요\")\n    print(f\"  - 벡터 DB 로드 완료: {count}개 벡터 (컬렉션 '{COLLECTION_NAME}')\")\n\n    # search_kwargs={\"k\": TOP_K}: 유사도 상위 TOP_K개 청크만 반환하도록 설정함\n    return vectorstore.as_retriever(search_kwargs={\"k\": TOP_K})"
    },
    {
      "id": "create_llm",
      "name": "create_llm()",
      "fileId": "main",
      "summary": "답변 생성용 Groq LLM(openai/gpt-oss-120b)을 만들어 돌려주는 함수.",
      "how": "검색된 근거로 실제 문장을 써 줄 LLM을 준비함. Groq 키가 없으면 즉시 오류를 냄. gpt-oss-120b 는 추론(reasoning) 모델이라 사고 과정이 답에 섞일 수 있어 reasoning_format=\"hidden\" 으로 최종 답만 받음. temperature=0 으로 같은 질문엔 항상 같은(재현 가능한) 답을 내도록 함.",
      "terms": [
        "ChatGroq",
        "Groq LPU",
        "gpt-oss-120b",
        "reasoning_format",
        "temperature",
        "API 키 검사"
      ],
      "lines": [
        {
          "at": "def create_llm",
          "text": "답변 생성용 LLM을 만드는 함수 정의."
        },
        {
          "at": "from langchain_groq import ChatGroq",
          "text": "Groq 클라우드에 채팅 요청을 보내는 LangChain 래퍼를 가져옴."
        },
        {
          "at": "if not os.getenv(\"GROQ_API_KEY\")",
          "text": "LLM 호출에 필요한 Groq 키가 없으면 초기에 오류를 냄."
        },
        {
          "at": "return ChatGroq(",
          "text": "설정값으로 Groq 채팅 모델 객체를 만들어 돌려줌."
        },
        {
          "at": "model=LLM_MODEL",
          "text": "사용할 모델 이름(gpt-oss-120b)을 지정."
        },
        {
          "at": "temperature=0,",
          "text": "무작위성을 0으로 둬 같은 질문에 일관된 답을 내게 함."
        },
        {
          "at": "reasoning_format=\"hidden\",",
          "text": "추론 과정을 숨기고 최종 답변 텍스트만 받음."
        }
      ],
      "code": "def create_llm():\n    \"\"\"Groq LPU의 openai/gpt-oss-120b 채팅 모델을 생성하여 반환함.\n\n    ChatGroq: Groq Cloud LPU에 채팅 요청을 보내는 LangChain 모델 래퍼 (GROQ_API_KEY 자동 참조).\n    gpt-oss-120b는 추론(reasoning) 모델이라 사고 과정이 답변 본문에 섞일 수 있으므로\n    reasoning_format=\"hidden\"으로 최종 답변만 받도록 함.\n    temperature=0: 동일 질의에 대해 재현 가능한(결정적) 답변을 생성하도록 함.\n    \"\"\"\n    import os\n\n    from langchain_groq import ChatGroq\n\n    if not os.getenv(\"GROQ_API_KEY\"):\n        raise RuntimeError(f\"GROQ_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요\")\n\n    return ChatGroq(\n        model=LLM_MODEL,\n        temperature=0,\n        reasoning_format=\"hidden\",  # 추론 과정을 숨기고 최종 답변 텍스트만 반환\n    )"
    },
    {
      "id": "format_docs",
      "name": "format_docs()",
      "fileId": "main",
      "summary": "검색된 청크 여러 개를 LLM 프롬프트에 넣을 한 덩어리 문자열로 합치는 도우미 함수.",
      "how": "검색기는 Document 객체 목록을 주는데, 프롬프트에는 글자로 넣어야 함. 각 청크 앞에 [출처 N]·파일명·청크 번호를 붙여 LLM이 근거를 인용하기 쉽게 하고, 사람도 출처를 알 수 있게 함. 청크 사이는 구분선(---)으로 띄워 문서 경계를 분명히 함.",
      "terms": [
        "청크",
        "Document",
        "metadata"
      ],
      "lines": [
        {
          "at": "def format_docs",
          "text": "검색된 청크 목록을 받는 도우미 함수 정의."
        },
        {
          "at": "blocks = []",
          "text": "각 청크를 문자열로 만들어 담을 빈 리스트를 준비."
        },
        {
          "at": "for index, doc in enumerate(docs, start=1)",
          "text": "검색된 청크를 1번부터 번호를 매기며 하나씩 처리."
        },
        {
          "at": "source = doc.metadata.get(\"source\"",
          "text": "청크의 출처 파일명을 메타데이터에서 꺼냄."
        },
        {
          "at": "chunk_index = doc.metadata.get",
          "text": "청크가 문서에서 몇 번째 조각인지 번호를 꺼냄."
        },
        {
          "at": "blocks.append(",
          "text": "[출처]·내용을 합친 한 청크 블록을 리스트에 추가."
        },
        {
          "at": ".join(blocks)",
          "text": "모든 청크 블록을 구분선으로 이어 하나의 컨텍스트 문자열로 만듦."
        }
      ],
      "code": "def format_docs(docs: list) -> str:\n    \"\"\"검색된 Document 리스트를 LLM 프롬프트용 단일 문자열로 합침.\n\n    각 청크 앞에 [출처 N] 라벨과 메타데이터(파일명·청크 번호)를 붙여\n    LLM이 근거 조문을 인용하기 쉽게 하고, 출력 시 사람도 출처를 식별할 수 있게 함.\n    \"\"\"\n    blocks = []\n    for index, doc in enumerate(docs, start=1):\n        source = doc.metadata.get(\"source\", \"unknown\")\n        chunk_index = doc.metadata.get(\"chunk_index\", \"?\")\n        blocks.append(f\"[출처 {index}] {source} #{chunk_index}\\n{doc.page_content}\")\n    # 청크 사이를 구분선으로 띄워 LLM이 문서 경계를 인식하기 쉽게 함\n    return \"\\n\\n---\\n\\n\".join(blocks)"
    },
    {
      "id": "answer_query",
      "name": "answer_query()",
      "fileId": "main",
      "summary": "질문으로 검색(Retrieve)을 하고, 그 결과를 근거로 LLM 답변(Generate)을 만드는 핵심 함수.",
      "how": "RAG의 실행 두 단계를 한 함수에 담음. ① retriever.invoke(query) 로 질문을 임베딩해 유사 청크 Top-K를 가져옴(탐색). ② 시스템·사용자 프롬프트를 묶고 LCEL 파이프(prompt | llm | StrOutputParser)로 체인을 만든 뒤, format_docs 로 만든 컨텍스트와 질문을 넣어 invoke 로 실행해 답을 생성함(생성). 답변과 함께 검색된 청크도 돌려줘, 호출한 쪽에서 출처를 출력할 수 있게 함.",
      "terms": [
        "retriever",
        "invoke",
        "유사도 검색",
        "ChatPromptTemplate",
        "LCEL",
        "파이프(|)",
        "StrOutputParser",
        "청크"
      ],
      "lines": [
        {
          "at": "def answer_query",
          "text": "검색 후 답변까지 수행하는 함수 정의(답변·청크를 함께 반환)."
        },
        {
          "at": "from langchain_core.output_parsers import StrOutputParser",
          "text": "LLM 응답에서 본문 문자열만 뽑는 파서를 가져옴."
        },
        {
          "at": "from langchain_core.prompts import ChatPromptTemplate",
          "text": "system·human 메시지를 묶을 프롬프트 템플릿을 가져옴."
        },
        {
          "at": "docs = retriever.invoke(query)",
          "text": "①탐색: 질문을 임베딩해 의미가 비슷한 청크 Top-K를 가져옴."
        },
        {
          "at": "prompt = ChatPromptTemplate.from_messages(",
          "text": "시스템·사용자 프롬프트를 하나의 프롬프트로 구성."
        },
        {
          "at": "chain = prompt | llm | StrOutputParser()",
          "text": "LCEL 파이프(|)로 프롬프트→LLM→문자열파서를 한 줄로 연결."
        },
        {
          "at": "answer = chain.invoke(",
          "text": "②생성: 컨텍스트와 질문을 넣어 체인을 실행, 답변을 받음."
        },
        {
          "at": "return answer, docs",
          "text": "생성한 답변과 근거 청크 목록을 함께 돌려줌."
        }
      ],
      "code": "def answer_query(query: str, retriever, llm) -> tuple[str, list]:\n    \"\"\"질의어로 검색을 수행하고 검색 결과를 근거로 LLM 답변을 생성함.\n\n    처리 흐름:\n      1. 탐색: retriever.invoke(query) → 질의 임베딩 후 유사 청크 Top K 반환\n      2. 생성: (prompt | llm | StrOutputParser) LCEL 체인에 context·question 주입\n    검색 청크를 별도로 반환하여 답변과 함께 출처를 출력할 수 있게 함.\n    \"\"\"\n    from langchain_core.output_parsers import StrOutputParser\n    from langchain_core.prompts import ChatPromptTemplate\n\n    # 1) 탐색: 질의어를 임베딩하여 의미적으로 유사한 청크를 검색함\n    docs = retriever.invoke(query)\n\n    # 2) 생성: LCEL 파이프 연산자(|)로 프롬프트 → LLM → 문자열 파서를 연결함\n    # ChatPromptTemplate.from_messages: system/human 메시지 템플릿을 묶어 프롬프트를 구성함\n    prompt = ChatPromptTemplate.from_messages(\n        [(\"system\", SYSTEM_PROMPT), (\"human\", HUMAN_PROMPT)]\n    )\n    # StrOutputParser: LLM의 AIMessage 응답에서 본문 텍스트만 추출함\n    chain = prompt | llm | StrOutputParser()\n\n    # 검색된 청크를 컨텍스트 문자열로 변환해 질의어와 함께 체인에 주입함\n    answer = chain.invoke({\"context\": format_docs(docs), \"question\": query})\n    return answer, docs"
    },
    {
      "id": "print_result",
      "name": "print_result()",
      "fileId": "main",
      "summary": "질문·생성 답변·검색 출처를 콘솔에 보기 좋게 출력하는 함수.",
      "how": "사용자가 결과를 한눈에 보도록 구분선과 함께 질문, 답변, 그리고 검색에 쓰인 청크들의 출처(파일명·번호·앞 60자 미리보기)를 출력함. 근거를 함께 보여 주는 것이 RAG의 신뢰성 핵심임.",
      "terms": [
        "청크",
        "metadata"
      ],
      "lines": [
        {
          "at": "def print_result",
          "text": "결과를 콘솔에 출력하는 함수 정의."
        },
        {
          "at": "print(f\"[질문]",
          "text": "사용자 질문을 출력."
        },
        {
          "at": "print(f\"[답변]",
          "text": "LLM이 생성한 답변을 출력."
        },
        {
          "at": "print(f\"[검색 출처]",
          "text": "근거로 쓴 청크가 몇 건인지 출력."
        },
        {
          "at": "for index, doc in enumerate(docs, start=1)",
          "text": "검색된 청크를 번호와 함께 하나씩 출력 준비."
        },
        {
          "at": "snippet = doc.page_content[:60]",
          "text": "청크 본문 앞 60자만 미리보기로 잘라 한 줄로 보여 줌."
        },
        {
          "at": "print(f\"  [{index}]",
          "text": "각 청크의 출처·번호·미리보기를 출력."
        }
      ],
      "code": "def print_result(query: str, answer: str, docs: list) -> None:\n    \"\"\"질의어·생성 답변·검색 출처를 보기 좋게 콘솔에 출력함.\"\"\"\n    print(\"\\n\" + \"=\" * 70)\n    print(f\"[질문] {query}\")\n    print(\"=\" * 70)\n    print(f\"[답변]\\n{answer}\")\n    print(\"\\n\" + \"-\" * 70)\n    print(f\"[검색 출처] {len(docs)}건\")\n    for index, doc in enumerate(docs, start=1):\n        source = doc.metadata.get(\"source\", \"unknown\")\n        chunk_index = doc.metadata.get(\"chunk_index\", \"?\")\n        # 본문 미리보기 60자만 한 줄로 보여 어떤 청크가 근거인지 확인 가능하게 함\n        snippet = doc.page_content[:60].replace(\"\\n\", \" \")\n        print(f\"  [{index}] {source} #{chunk_index}: {snippet}...\")\n    print(\"=\" * 70)"
    },
    {
      "id": "main",
      "name": "main()",
      "fileId": "main",
      "summary": "벡터 DB 로드 → LLM 생성 → 검색·답변 → 출력 순으로 Naive RAG 전체를 실행하는 진입점.",
      "how": "전체 흐름을 지휘함. 명령줄에 질문이 있으면 그걸, 없으면 기본 질의어를 씀. load_retriever() 로 검색기를, create_llm() 으로 LLM을 준비한 뒤 answer_query() 로 답을 만들고 print_result() 로 출력함. 맨 아래 if __name__ == \"__main__\" 은 이 파일을 직접 실행할 때만 main() 을 부르는 관용구이고, try/except 로 오류를 깔끔히 보여 주고 비정상 종료 코드로 빠져나감.",
      "terms": [
        "if __name__ == \"__main__\"",
        "retriever",
        "top-k"
      ],
      "lines": [
        {
          "at": "def main",
          "text": "전체 파이프라인을 실행하는 진입점 함수 정의."
        },
        {
          "at": "query = \" \".join(sys.argv[1:])",
          "text": "명령줄 인자를 질문으로 합치고, 없으면 기본 질의어 사용."
        },
        {
          "at": "retriever = load_retriever()",
          "text": "공용 벡터 DB를 연결해 검색기를 준비."
        },
        {
          "at": "llm = create_llm()",
          "text": "답변 생성용 Groq LLM을 준비."
        },
        {
          "at": "answer, docs = answer_query(",
          "text": "검색+답변을 수행해 답변과 근거 청크를 받음."
        },
        {
          "at": "print_result(query, answer, docs)",
          "text": "질문·답변·출처를 콘솔에 출력."
        },
        {
          "at": "if __name__",
          "text": "이 파일을 직접 실행할 때만 아래 main()을 수행하는 관용구."
        },
        {
          "at": "except Exception as error",
          "text": "실행 중 오류를 잡아 메시지를 출력하고 비정상 종료."
        }
      ],
      "code": "def main() -> None:\n    \"\"\"벡터 DB 로드 → LLM 생성 → 검색·답변 → 출력 순으로 Naive RAG를 실행함.\"\"\"\n    # 명령줄 인자가 있으면 질의어로 사용하고, 없으면 기본 질의어를 사용함\n    query = \" \".join(sys.argv[1:]).strip() or DEFAULT_QUERY\n\n    print(\"[1/3] 공용 벡터 DB 로드 (재임베딩 없음)\")\n    retriever = load_retriever()\n\n    print(\"[2/3] LLM 생성 (Groq openai/gpt-oss-120b)\")\n    llm = create_llm()\n\n    print(\"[3/3] 검색 + 답변 생성\")\n    answer, docs = answer_query(query, retriever, llm)\n\n    print_result(query, answer, docs)\n\n\n# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)\nif __name__ == \"__main__\":\n    try:\n        main()\n    except Exception as error:\n        # 실행 중 오류를 명확히 출력하고 비정상 종료 코드로 빠져나감\n        print(f\"\\n[오류] Naive RAG 실행 실패: {error}\", file=sys.stderr)\n        sys.exit(1)"
    }
  ],
  "glossary": {
    "RAG": "Retrieval-Augmented Generation. 외부 문서에서 관련 내용을 먼저 찾아(검색) 그 근거로 LLM이 답하게 하는 방식. 모델이 모르는 전문·최신 정보도 문서만 있으면 답할 수 있게 함.",
    "Naive RAG": "가장 단순한 형태의 RAG. '검색 → 생성'을 한 번, 가공 없이 곧장 수행함. 질문을 바꿔보거나(Query Transformation) 결과를 재정렬(Re-ranking)하는 고급 단계가 없음.",
    "Dense Retrieval": "질문과 문서를 임베딩(의미 벡터)으로 바꿔, 의미가 가까운 것을 찾는 검색 방식. 단어가 정확히 겹치지 않아도 뜻이 비슷하면 찾을 수 있음.",
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
    "top-k": "검색에서 '가장 비슷한 상위 k개'를 가져온다는 뜻. 이 예제는 TOP_K=5 로 5개를 가져옴.",
    "TOP_K": "가져올 상위 청크 개수를 정한 상수. 이 예제에서는 5.",
    "유사도 검색": "similarity search. 질문 벡터와 문서 벡터의 '가까운 정도'를 계산해 가장 가까운 것부터 찾는 검색 방식.",
    "ChatGroq": "Groq 클라우드의 채팅 LLM을 호출하는 LangChain 래퍼. GROQ_API_KEY를 자동 참조함.",
    "Groq LPU": "Groq사가 만든 LLM 추론 전용 칩(Language Processing Unit). 매우 빠른 응답 속도가 특징.",
    "gpt-oss-120b": "Groq LPU에서 서빙하는 오픈 가중치 LLM(약 1200억 파라미터). 이 예제의 답변 생성 모델.",
    "reasoning_format": "추론(reasoning) 모델의 사고 과정을 어떻게 다룰지 정하는 옵션. \"hidden\"이면 과정을 숨기고 최종 답만 받음.",
    "temperature": "LLM 답변의 무작위성 정도. 0에 가까울수록 매번 비슷하고 일관된(보수적인) 답을 냄.",
    "ChatPromptTemplate": "LLM에 보낼 프롬프트(지시문)의 틀. {context}·{question} 같은 빈칸에 실제 값을 채워 완성된 프롬프트를 만듦.",
    "프롬프트": "LLM에게 주는 지시문. 여기서는 '문서 근거로만 답하라'는 시스템 프롬프트와 문맥·질문을 담는 사용자 프롬프트로 나뉨.",
    "LCEL": "LangChain Expression Language. 파이프 기호(|)로 단계들을 왼쪽→오른쪽으로 연결해 하나의 처리 흐름(체인)을 만드는 문법.",
    "파이프(|)": "LCEL에서 앞 단계의 결과를 다음 단계의 입력으로 흘려보내는 연결 기호. 'prompt | llm | parser'처럼 씀.",
    "StrOutputParser": "LLM 응답 객체에서 사람이 읽을 본문 문자열만 깔끔히 뽑아 주는 출력 파서.",
    "invoke": "LangChain 체인/검색기를 '실행'하는 메서드. 입력을 넣으면 끝까지 돌려 결과를 돌려줌.",
    "load_dotenv": ".env 파일에 적어 둔 비밀값(예: OPENAI_API_KEY, GROQ_API_KEY)을 프로그램의 환경변수로 불러오는 함수.",
    "from __future__ import annotations": "타입 힌트를 즉시 평가하지 않고 문자열로 두게 하는 파이썬 선언. 순환 참조 없이 가볍게 타입 힌트를 쓰게 해 줌.",
    "Path(__file__).resolve().parent": "지금 이 파이썬 파일이 있는 폴더의 절대경로를 구하는 관용구. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "if __name__ == \"__main__\"": "이 파일을 직접 실행할 때만 특정 코드를 돌리고, 다른 곳에서 import할 때는 돌리지 않게 하는 파이썬 관용구.",
    "API 키 검사": "필요한 API 키가 환경변수에 없으면 실행 초기에 명확한 오류를 내는 패턴. 한참 뒤에 엉뚱한 곳에서 실패하는 것을 막아 디버깅을 쉽게 함."
  }
};
