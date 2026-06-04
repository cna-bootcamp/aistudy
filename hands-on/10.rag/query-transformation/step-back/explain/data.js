window.EXPLAIN_DATA = {
  "meta": {
    "title": "Step-Back Prompting — 한 걸음 물러난 상위 질문으로 폭넓게 검색하는 RAG",
    "entry": "app.py"
  },
  "files": [
    {
      "id": "main",
      "label": "app.py",
      "role": "원본 질문을 한 단계 추상화한 '한 걸음 물러난' 질문으로 바꿔, 두 질문 모두로 검색·병합해 답하는 CLI RAG 전체"
    }
  ],
  "flow": [
    {
      "step": 1,
      "title": "실행 & 환경 준비",
      "label": "실행·환경 준비",
      "refs": ["setup", "main"],
      "summary": "python app.py 로 실행하고, .env 의 API 키를 불러옴",
      "detail": "터미널에서 'python app.py'(대화형), 'python app.py --demo'(기본 질의어), 'python app.py --query \"질문\"'(지정 질의어) 중 하나로 실행함. 시작과 동시에 load_dotenv() 가 hands-on/.env 의 OPENAI_API_KEY(질의 임베딩용)와 GROQ_API_KEY(LLM용)를 읽어 둠. 한글 출력이 깨지지 않게 표준출력을 UTF-8로 맞추는 처리도 함. 비유하면, 사서(앱)가 출근해 책상에 두 개의 열쇠(임베딩 열쇠·답변 열쇠)를 챙겨 두는 단계."
    },
    {
      "step": 2,
      "title": "벡터 DB 로드 & LLM 준비",
      "label": "벡터 DB·LLM 준비",
      "refs": ["load_vectorstore", "get_llm", "create_llm_chain"],
      "summary": "이미 만들어 둔 공용 벡터 DB를 재인덱싱 없이 연결하고, Groq LLM도 준비함",
      "detail": "이 예제는 PDF를 새로 읽거나 쪼개지 않음. 그 작업(인덱싱)은 ../../indexing 이 미리 해 두었고, 여기서는 결과물인 공용 ChromaDB(컬렉션 patent_law, 246개 벡터)를 그냥 연결만 함(load_vectorstore). 그리고 추상화 질문 생성과 최종 답변을 맡을 Groq LLM(gpt-oss-120b)도 함께 준비함(get_llm). 비유하면, 정리된 서가에 접근 권한을 얻고, 글을 써 줄 직원도 부르는 단계."
    },
    {
      "step": 3,
      "title": "한 걸음 물러난 질문 생성 (Step-Back)",
      "label": "상위 질문 생성",
      "refs": ["step_back"],
      "summary": "LLM이 구체적 질문을 더 일반적·근본적인 '상위 질문'으로 추상화함",
      "detail": "이 예제의 핵심임. 사용자의 구체적 질문(예: '특허 어떻게 받어?')을 LLM에게 주고, 한 단계 뒤로 물러난 더 일반적인 질문(예: '특허 취득에 필요한 절차와 요건은?')으로 바꿔 달라고 함(step_back). 구체 사례만 좁게 찾으면 배경 지식이 빠지기 쉬운데, 상위 개념 질문을 함께 던지면 기본 원칙이 담긴 문서까지 끌어올 수 있음. 비유하면, '이 가게 영수증 어디서 떼?'를 묻기 전에 '환불·증빙 절차가 어떻게 되지?'라는 큰 그림을 먼저 묻는 것."
    },
    {
      "step": 4,
      "title": "두 질문 모두로 검색 (Retrieve x2)",
      "label": "두 질문 검색",
      "refs": ["retrieve_with_transformation", "get_retriever"],
      "summary": "상위 질문과 원본 질문을 각각 임베딩해, 각자 비슷한 청크 5개씩 찾음",
      "detail": "추상화한 상위 질문(배경 지식)과 원래 질문(구체 정보)을 각각 같은 검색기로 검색함. 두 질문 모두 숫자 벡터(임베딩)로 바뀌어 벡터 DB에서 의미가 가까운 청크 상위 5개씩(유사도 검색)을 가져옴. Naive RAG가 한 번만 검색하는 것과 달리, 여기서는 관점이 다른 두 검색으로 폭을 넓힘. 비유하면, 큰 질문 카드와 작은 질문 카드로 서가를 두 번 훑어 더 다양한 자료를 모으는 것."
    },
    {
      "step": 5,
      "title": "결과 병합 & 중복 제거",
      "label": "병합·중복 제거",
      "refs": ["retrieve_with_transformation", "deduplicate_docs"],
      "summary": "두 검색 결과를 합치고, 본문이 같은 청크는 한 번만 남겨 상위 5개를 추림",
      "detail": "두 검색에서 겹치는 청크가 나올 수 있으므로, 본문 내용으로 중복을 걸러 고유 청크만 남김(deduplicate_docs). 그 후 상위 TOP_K(5)개만 잘라 최종 근거 묶음을 만듦. 비유하면, 두 번 훑어 모은 카드 더미에서 똑같은 카드를 골라내고 가장 쓸모 있는 5장만 추리는 것."
    },
    {
      "step": 6,
      "title": "컨텍스트 주입 & 답변 생성 (Generate)",
      "label": "답변 생성",
      "refs": ["answer_question", "format_docs"],
      "summary": "추린 청크를 근거로 넣어 LLM이 최종 답을 만듦",
      "detail": "추린 청크 5개를 [문서 N] 라벨과 함께 '컨텍스트'로 프롬프트에 채우고(format_docs), LLM이 그 근거만 바탕으로 답을 생성함(llm_chain.invoke). 프롬프트에 '문서에 없으면 찾을 수 없다고 답하라'는 규칙이 있어 지어내기(환각)를 줄임. 조립은 LCEL 파이프(prompt | llm | StrOutputParser)로 이뤄짐. 비유하면, 추린 5장의 카드만 보고 질문에 답을 적어 주는 것."
    },
    {
      "step": 7,
      "title": "결과 출력",
      "label": "결과 출력",
      "refs": ["display_transform_info", "format_chunks_for_display"],
      "summary": "원본·상위 질문, 검색된 청크, 최종 답변을 콘솔에 보기 좋게 표시",
      "detail": "원본 질문과 추상화한 Step-Back 질문을 함께 보여 주고(display_transform_info), 근거로 쓴 청크 목록(파일명·청크 번호·앞부분 미리보기)과 최종 답변을 출력함. 어떤 상위 질문으로 무엇을 찾아 답했는지 과정을 드러내 사람이 검증할 수 있게 함. 비유하면, 답안과 함께 '어떤 큰 질문을 떠올렸고 어떤 카드를 참고했는지'를 같이 제출하는 것."
    }
  ],
  "functions": [
    {
      "id": "setup",
      "name": "임포트·경로·상수·프롬프트 설정",
      "fileId": "main",
      "summary": "필요한 모듈을 가져오고, 파일 위치 기준으로 경로를 잡고, .env 키·핵심 상수·시스템 프롬프트를 준비하는 부분.",
      "how": "함수가 아니라 파일 위쪽의 준비 코드 모음임. ① from __future__ import annotations 로 타입 힌트를 가볍게 쓰고, 표준출력을 UTF-8로 맞춤. ② 모든 경로를 이 파일 위치(__file__) 기준으로 계산해, 어디서 실행해도 같은 공용 벡터 DB와 .env 를 가리키게 함. ③ load_dotenv 로 키를 올리고, 컬렉션명·임베딩 모델·LLM 모델·TOP_K·기본 질의어를 정함. 특히 임베딩 모델은 인덱싱 때와 반드시 같아야 검색이 성립함. ④ 답변용 시스템 프롬프트(SYSTEM_PROMPT)에는 컨텍스트만 근거로 쉽게 설명하라는 규칙이 담김.",
      "terms": [
        "from __future__ import annotations",
        "Path(__file__).resolve().parent",
        "load_dotenv",
        "컬렉션",
        "영속화",
        "text-embedding-3-small",
        "TOP_K",
        "프롬프트",
        "임베딩"
      ],
      "lines": [
        {
          "at": "from __future__ import annotations",
          "text": "타입 힌트를 문자열로 평가해 가볍게 쓰게 하는 파이썬 설정."
        },
        {
          "at": "import argparse",
          "text": "명령줄 옵션(--query, --demo)을 받기 위한 기본 모듈."
        },
        {
          "at": "sys.stdout.reconfigure(encoding",
          "text": "윈도우 콘솔에서 한글이 깨지지 않도록 출력 인코딩을 UTF-8로 바꿈."
        },
        {
          "at": "from langchain_openai import OpenAIEmbeddings",
          "text": "질의를 벡터로 바꿀 OpenAI 임베딩 모델 래퍼를 가져옴."
        },
        {
          "at": "from langchain_groq import ChatGroq",
          "text": "Groq 클라우드에 채팅 요청을 보내는 LangChain 래퍼를 가져옴."
        },
        {
          "at": "SCRIPT_DIR = Path(__file__)",
          "text": "이 파일이 있는 폴더(step-back/)를 절대경로로 구함 — 실행 위치와 무관하게 동작."
        },
        {
          "at": "VECTORDB_DIR = SCRIPT_DIR.parents[1]",
          "text": "공용 ChromaDB가 저장된 폴더(../../vectordb)를 가리킴."
        },
        {
          "at": "ENV_PATH = SCRIPT_DIR.parents[2]",
          "text": "API 키가 든 hands-on/.env 파일 경로를 잡음."
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
          "at": "GROQ_MODEL = \"openai/gpt-oss-120b\"",
          "text": "추상화 질문과 답변을 만들 LLM(Groq의 gpt-oss-120b) 이름."
        },
        {
          "at": "TOP_K = 5",
          "text": "검색으로 가져올 비슷한 청크 개수를 5개로 정함(top-k)."
        },
        {
          "at": "TEST_QUERY =",
          "text": "--demo 로 실행할 때 쓸 기본 질문."
        },
        {
          "at": "load_dotenv(ENV_PATH)",
          "text": ".env 에서 OPENAI_API_KEY·GROQ_API_KEY 를 실제로 읽어 환경변수로 올림."
        },
        {
          "at": "SYSTEM_PROMPT =",
          "text": "컨텍스트만 근거로, 일반인이 이해하기 쉽게 답하라는 규칙을 담은 시스템 프롬프트."
        },
        {
          "at": "{context}",
          "text": "검색된 청크 묶음이 채워질 자리 — 답변 생성 시 실제 문서로 대체됨."
        }
      ],
      "code": "\"\"\"Step-Back 기법 RAG 예제 (Query Transformation)\n\n구체적인 질문을 한 단계 추상화한 일반 질문으로 바꿔, 추상 질문(배경 지식)과\n원본 질문(구체 정보) 양쪽으로 검색해 폭넓은 컨텍스트를 확보하는 예제임.\n\n핵심 흐름: 원본 질문 → (LLM 추상화) → Step-Back 질문 + 원본 질문 → 각각 검색 → 병합 → 답변 생성\nLLM: Groq LPU openai/gpt-oss-120b / 임베딩: OpenAI text-embedding-3-small (검색 시점에만 사용)\n\"\"\"\n\nfrom __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함\n\nimport argparse\nimport os\nimport sys\nfrom pathlib import Path\nfrom typing import List\n\n# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함\nif hasattr(sys.stdout, \"reconfigure\"):\n    sys.stdout.reconfigure(encoding=\"utf-8\")\n\nfrom dotenv import load_dotenv\nfrom langchain_chroma import Chroma  # ChromaDB 벡터 스토어를 다루는 LangChain 래퍼\nfrom langchain_openai import OpenAIEmbeddings  # OpenAI 임베딩 모델 (쿼리를 벡터로 변환)\nfrom langchain_groq import ChatGroq  # Groq LPU 채팅 모델 래퍼 (llm.invoke()로 호출)\nfrom langchain_core.documents import Document  # LangChain 표준 문서 객체\nfrom langchain_core.prompts import ChatPromptTemplate  # LLM 프롬프트 템플릿 생성기\nfrom langchain_core.output_parsers import StrOutputParser  # LLM 응답에서 문자열만 추출하는 파서\n\n# ---------------------------------------------------------------------------\n# 경로·상수 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)\n# ---------------------------------------------------------------------------\n# 이 파일 위치: hands-on/10.rag/query-transformation/step-back/app.py\nSCRIPT_DIR = Path(__file__).resolve().parent       # 이 파일이 위치한 디렉터리 절대경로\nVECTORDB_DIR = SCRIPT_DIR.parents[1] / \"vectordb\"  # hands-on/10.rag/vectordb (공용 벡터 DB)\nENV_PATH = SCRIPT_DIR.parents[2] / \".env\"          # hands-on/.env (API 키 보관)\n\nCOLLECTION_NAME = \"patent_law\"               # 인덱싱 시 사용한 공용 컬렉션명 (반드시 일치해야 검색 가능)\nEMBEDDING_MODEL = \"text-embedding-3-small\"   # 인덱싱과 동일한 임베딩 모델 (1536차원, 쿼리 임베딩용)\nGROQ_MODEL = \"openai/gpt-oss-120b\"           # Groq LPU에서 제공하는 LLM\nTOP_K = 5                                    # 검색 시 가져올 청크 수\nTEST_QUERY = \"특허 어떻게 받어?\"               # 기본 데모/테스트 질의어\n\nload_dotenv(ENV_PATH)  # .env에서 OPENAI_API_KEY·GROQ_API_KEY 등을 환경변수로 로드함\n\nSYSTEM_PROMPT = \"\"\"당신은 특허법 전문 법률 상담 AI입니다.\n\n## 역할\n- 주어진 컨텍스트를 기반으로 특허법 관련 질문에 답변합니다.\n- 법조문을 그대로 인용하지 말고, 일반인이 이해하기 쉽도록 풀어서 설명합니다.\n\n## 규칙\n1. 법률 용어는 쉬운 말로 바꿔서 설명\n2. 복잡한 조문은 핵심만 요약하여 전달\n3. 컨텍스트에 없는 내용은 \"해당 내용은 제공된 문서에서 찾을 수 없습니다\"라고 답변\n\n## 답변 형식\n1. **쉬운 설명**: 질문에 대한 이해하기 쉬운 답변\n2. **근거 조문**: 반드시 명시 (예: 특허법 제42조 제2항)\n3. **참고사항**: 관련 정보나 주의할 점 (있는 경우)\n\n## 컨텍스트\n{context}\n\"\"\""
    },
    {
      "id": "get_llm",
      "name": "get_llm()",
      "fileId": "main",
      "summary": "추상화 질문 생성과 답변 생성에 쓸 Groq LLM(openai/gpt-oss-120b)을 만들어 돌려주는 함수.",
      "how": "실제 문장을 써 줄 LLM을 준비함. GROQ_API_KEY 가 없으면 즉시 명확한 오류를 내 디버깅을 쉽게 함. temperature=0.3 으로 약간의 표현 다양성을 허용하고, 최대 2048토큰까지 답하도록 ChatGroq 객체를 만들어 돌려줌.",
      "terms": [
        "ChatGroq",
        "Groq LPU",
        "gpt-oss-120b",
        "temperature",
        "API 키 검사"
      ],
      "lines": [
        {
          "at": "def get_llm",
          "text": "추상화·답변에 쓸 LLM을 만드는 함수 정의."
        },
        {
          "at": "api_key = os.environ.get(\"GROQ_API_KEY\")",
          "text": "환경변수에서 Groq API 키를 읽어 옴."
        },
        {
          "at": "if not api_key:",
          "text": "키가 없으면 초기에 명확히 오류를 내 한참 뒤 엉뚱한 실패를 막음."
        },
        {
          "at": "return ChatGroq(model=GROQ_MODEL",
          "text": "설정값(약간의 다양성·2048토큰)으로 Groq 채팅 모델 객체를 만들어 돌려줌."
        }
      ],
      "code": "def get_llm() -> ChatGroq:\n    \"\"\"Groq LPU의 openai/gpt-oss-120b 모델로 ChatGroq 인스턴스를 생성함.\"\"\"\n    api_key = os.environ.get(\"GROQ_API_KEY\")\n    # API 키 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함\n    if not api_key:\n        raise RuntimeError(\"GROQ_API_KEY가 설정되지 않음 (hands-on/.env 확인)\")\n    # ChatGroq: temperature 0.3으로 약간의 표현 다양성 허용, 최대 2048토큰 응답\n    return ChatGroq(model=GROQ_MODEL, temperature=0.3, max_tokens=2048, api_key=api_key)"
    },
    {
      "id": "load_vectorstore",
      "name": "load_vectorstore()",
      "fileId": "main",
      "summary": "이미 만들어진 공용 ChromaDB를 재인덱싱 없이 연결해 벡터 스토어로 돌려주는 함수.",
      "how": "RAG의 검색 기반을 준비함. 새로 인덱싱하지 않고, 인덱싱이 만들어 둔 영속 컬렉션을 그대로 연결함. ① 벡터 DB 폴더가 없으면 인덱싱을 먼저 하라는 오류를 냄. ② 인덱싱과 동일한 임베딩 모델로 OpenAIEmbeddings 를 만들고, Chroma(...) 로 기존 컬렉션을 연결함. 컬렉션명을 빠뜨리면 빈 결과가 나오므로 patent_law 를 반드시 지정함.",
      "terms": [
        "ChromaDB",
        "Chroma",
        "영속화",
        "컬렉션",
        "OpenAIEmbeddings",
        "임베딩",
        "text-embedding-3-small"
      ],
      "lines": [
        {
          "at": "def load_vectorstore",
          "text": "공용 벡터 DB를 연결하는 함수 정의."
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
          "at": "return Chroma(",
          "text": "from_documents(신규 생성)가 아니라 기존 컬렉션을 '연결'만 함."
        },
        {
          "at": "collection_name=COLLECTION_NAME",
          "text": "어떤 컬렉션을 열지 이름(patent_law)으로 지정 — 빠뜨리면 빈 결과."
        },
        {
          "at": "persist_directory=str(VECTORDB_DIR)",
          "text": "디스크에 저장된 벡터 폴더를 가리켜 재임베딩 없이 재사용."
        }
      ],
      "code": "def load_vectorstore() -> Chroma:\n    \"\"\"공용 벡터 DB를 임베딩(재인덱싱) 없이 로드함.\n\n    인덱싱 때와 동일한 컬렉션명(patent_law)·임베딩 모델(text-embedding-3-small)을\n    지정해야 저장된 246개 벡터를 정상 검색할 수 있음. 컬렉션명을 빠뜨리면 ChromaDB가\n    기본 컬렉션(langchain)을 새로 만들어 빈 검색 결과를 반환하므로 주의함.\n    \"\"\"\n    if not VECTORDB_DIR.exists():\n        raise FileNotFoundError(\n            f\"공용 벡터 DB를 찾을 수 없음: {VECTORDB_DIR}\\n\"\n            f\"hands-on/10.rag/indexing/indexing.py를 먼저 실행해 인덱싱을 수행하세요.\"\n        )\n    # OpenAIEmbeddings: 쿼리 문자열을 1536차원 벡터로 변환 (검색 시점에만 사용)\n    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL, api_key=os.environ.get(\"OPENAI_API_KEY\"))\n    print(f\"공용 벡터 DB 로드: {VECTORDB_DIR} (컬렉션: {COLLECTION_NAME})\")\n    return Chroma(\n        collection_name=COLLECTION_NAME,\n        persist_directory=str(VECTORDB_DIR),\n        embedding_function=embeddings,\n    )"
    },
    {
      "id": "get_retriever",
      "name": "get_retriever()",
      "fileId": "main",
      "summary": "벡터 스토어를 코사인 유사도 기반 상위 TOP_K 검색기(retriever)로 바꿔 주는 함수.",
      "how": "연결된 벡터 스토어를 LCEL 체인에 꽂을 수 있는 검색기 객체로 변환함. search_type='similarity' 와 k=TOP_K 를 줘, 질문이 오면 의미가 가장 비슷한 청크 5개를 돌려주게 함.",
      "terms": [
        "retriever",
        "as_retriever",
        "유사도 검색",
        "top-k",
        "TOP_K"
      ],
      "lines": [
        {
          "at": "def get_retriever",
          "text": "벡터 스토어를 검색기로 바꾸는 함수 정의."
        },
        {
          "at": "return vectorstore.as_retriever",
          "text": "유사도 검색으로 상위 TOP_K개를 찾는 검색기로 변환해 돌려줌."
        },
        {
          "at": "search_type=\"similarity\"",
          "text": "코사인 유사도 방식으로 가장 비슷한 청크를 찾도록 지정."
        },
        {
          "at": "\"k\": TOP_K",
          "text": "한 번 검색에 가져올 청크 수를 5개로 지정."
        }
      ],
      "code": "def get_retriever(vectorstore: Chroma):\n    \"\"\"코사인 유사도 기반으로 상위 TOP_K개 청크를 반환하는 검색기를 생성함.\"\"\"\n    return vectorstore.as_retriever(search_type=\"similarity\", search_kwargs={\"k\": TOP_K})"
    },
    {
      "id": "format_docs",
      "name": "format_docs()",
      "fileId": "main",
      "summary": "검색된 청크 여러 개를 LLM 프롬프트에 넣을 한 덩어리 문자열로 합치는 도우미 함수.",
      "how": "검색기는 Document 객체 목록을 주는데, 프롬프트에는 글자로 넣어야 함. 각 청크 앞에 [문서 N]·파일명·청크 번호를 붙여 LLM이 근거를 인용하기 쉽게 하고, 사람도 출처를 알 수 있게 함. 청크 사이는 구분선(---)으로 띄워 문서 경계를 분명히 함.",
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
          "at": "formatted = []",
          "text": "각 청크를 문자열로 만들어 담을 빈 리스트를 준비."
        },
        {
          "at": "for i, doc in enumerate(docs, 1):",
          "text": "검색된 청크를 1번부터 번호를 매기며 하나씩 처리."
        },
        {
          "at": "source = doc.metadata.get(\"source\"",
          "text": "청크의 출처 파일명을 메타데이터에서 꺼냄."
        },
        {
          "at": "chunk_index = doc.metadata.get(\"chunk_index\"",
          "text": "청크가 문서에서 몇 번째 조각인지 번호를 메타데이터에서 꺼냄."
        },
        {
          "at": "formatted.append(f\"[문서 {i}]",
          "text": "[문서 N]·출처·본문을 합친 한 청크 블록을 리스트에 추가."
        },
        {
          "at": "return \"\\n\\n---\\n\\n\".join(formatted)",
          "text": "모든 청크 블록을 구분선으로 이어 하나의 컨텍스트 문자열로 만듦."
        }
      ],
      "code": "def format_docs(docs: List[Document]) -> str:\n    \"\"\"검색된 문서들을 LLM 컨텍스트용 문자열로 합침.\"\"\"\n    formatted = []\n    for i, doc in enumerate(docs, 1):\n        source = doc.metadata.get(\"source\", \"알 수 없음\")\n        chunk_index = doc.metadata.get(\"chunk_index\", \"?\")\n        formatted.append(f\"[문서 {i}] {source} (청크 #{chunk_index})\\n{doc.page_content}\")\n    return \"\\n\\n---\\n\\n\".join(formatted)"
    },
    {
      "id": "format_chunks_for_display",
      "name": "format_chunks_for_display()",
      "fileId": "main",
      "summary": "검색된 청크를 콘솔에 보여 줄 미리보기 형태(앞 150자)로 포맷팅하는 도우미 함수.",
      "how": "사람이 어떤 청크가 근거였는지 한눈에 보도록, 각 청크의 출처·번호와 본문 앞 150자만 잘라 한 줄 미리보기로 만듦. 본문이 150자보다 길면 끝에 '...'을 붙여 잘렸음을 표시함.",
      "terms": [
        "청크",
        "metadata"
      ],
      "lines": [
        {
          "at": "def format_chunks_for_display",
          "text": "청크를 콘솔 미리보기용으로 만드는 함수 정의."
        },
        {
          "at": "lines = []",
          "text": "각 청크의 미리보기 줄을 담을 빈 리스트를 준비."
        },
        {
          "at": "preview = doc.page_content[:150]",
          "text": "청크 본문 앞 150자만 잘라 줄바꿈을 공백으로 바꿔 한 줄로 만듦."
        },
        {
          "at": "if len(doc.page_content) > 150:",
          "text": "본문이 150자보다 길면 잘렸다는 표시를 붙일지 판단."
        },
        {
          "at": "preview += \"...\"",
          "text": "길게 잘린 경우 끝에 '...'을 붙여 더 있음을 표시."
        },
        {
          "at": "lines.append(f\"[청크 {i}]",
          "text": "출처·번호·미리보기를 합친 한 줄을 리스트에 추가."
        }
      ],
      "code": "def format_chunks_for_display(docs: List[Document]) -> str:\n    \"\"\"검색된 청크를 콘솔 표시용으로 미리보기 형태로 포맷팅함.\"\"\"\n    lines = []\n    for i, doc in enumerate(docs, 1):\n        source = doc.metadata.get(\"source\", \"알 수 없음\")\n        chunk_index = doc.metadata.get(\"chunk_index\", \"?\")\n        # 청크 본문은 처음 150자만 미리보기로 표시함\n        preview = doc.page_content[:150].replace(\"\\n\", \" \")\n        if len(doc.page_content) > 150:\n            preview += \"...\"\n        lines.append(f\"[청크 {i}] {source} (#{chunk_index})\\n  {preview}\")\n    return \"\\n\".join(lines)"
    },
    {
      "id": "deduplicate_docs",
      "name": "deduplicate_docs()",
      "fileId": "main",
      "summary": "본문 내용이 같은 중복 청크를 제거해 고유 청크만 남기는 함수 (두 검색 결과 병합 시 핵심).",
      "how": "상위 질문 검색과 원본 질문 검색에서 같은 청크가 중복으로 나올 수 있음. 각 청크 본문을 hash 로 바꿔, 이미 본 적 없는 것만 골라 순서를 유지하며 남김. 이렇게 중복을 걸러야 컨텍스트에 같은 내용이 두 번 들어가는 낭비를 막음.",
      "terms": [
        "중복 제거",
        "청크",
        "Document"
      ],
      "lines": [
        {
          "at": "def deduplicate_docs",
          "text": "중복 청크를 제거하는 함수 정의."
        },
        {
          "at": "seen = set()",
          "text": "이미 본 청크의 본문 해시를 기록해 둘 집합을 준비."
        },
        {
          "at": "unique = []",
          "text": "고유한 청크만 모아 둘 빈 리스트를 준비."
        },
        {
          "at": "key = hash(doc.page_content)",
          "text": "청크 본문을 해시값으로 바꿔 동일 청크 여부 판단 키로 삼음."
        },
        {
          "at": "if key not in seen:",
          "text": "아직 본 적 없는 청크일 때만 처리(중복이면 건너뜀)."
        },
        {
          "at": "seen.add(key)",
          "text": "이 청크의 해시를 '본 것' 집합에 기록."
        },
        {
          "at": "unique.append(doc)",
          "text": "고유 청크 목록에 추가해 순서를 유지하며 남김."
        }
      ],
      "code": "def deduplicate_docs(docs: List[Document]) -> List[Document]:\n    \"\"\"본문 내용이 동일한 중복 문서를 제거하여 고유 문서만 남김.\"\"\"\n    seen = set()\n    unique = []\n    for doc in docs:\n        # 본문 해시로 동일 청크 여부를 판단함\n        key = hash(doc.page_content)\n        if key not in seen:\n            seen.add(key)\n            unique.append(doc)\n    return unique"
    },
    {
      "id": "create_llm_chain",
      "name": "create_llm_chain()",
      "fileId": "main",
      "summary": "프롬프트 → LLM → 문자열 추출로 이어지는 LCEL 답변 체인을 만들어 돌려주는 함수.",
      "how": "최종 답변을 만들 체인을 조립함. system 프롬프트(규칙)와 human 프롬프트({question})를 묶은 뒤, LCEL 파이프(|)로 'prompt | llm | StrOutputParser' 를 한 줄로 연결함. 이 체인에 컨텍스트와 질문을 넣어 invoke 하면 최종 답 문자열이 나옴.",
      "terms": [
        "ChatPromptTemplate",
        "LCEL",
        "파이프(|)",
        "StrOutputParser",
        "프롬프트"
      ],
      "lines": [
        {
          "at": "def create_llm_chain",
          "text": "최종 답변용 LCEL 체인을 만드는 함수 정의."
        },
        {
          "at": "prompt = ChatPromptTemplate.from_messages",
          "text": "system(규칙)·human(질문) 메시지를 묶어 답변 프롬프트를 구성."
        },
        {
          "at": "(\"system\", SYSTEM_PROMPT)",
          "text": "컨텍스트 기반 답변 규칙이 담긴 시스템 메시지를 넣음."
        },
        {
          "at": "(\"human\", \"{question}\")",
          "text": "사용자 질문이 채워질 human 메시지 자리를 둠."
        },
        {
          "at": "return prompt | llm | StrOutputParser()",
          "text": "LCEL 파이프(|)로 프롬프트→LLM→문자열파서를 한 줄로 연결해 돌려줌."
        }
      ],
      "code": "def create_llm_chain(llm):\n    \"\"\"프롬프트 → LLM → 문자열 추출로 이어지는 LCEL 답변 체인을 생성함.\"\"\"\n    prompt = ChatPromptTemplate.from_messages([\n        (\"system\", SYSTEM_PROMPT),\n        (\"human\", \"{question}\"),\n    ])\n    # LCEL(|) 파이프: 프롬프트 렌더 → ChatGroq 호출 → StrOutputParser로 문자열만 추출\n    return prompt | llm | StrOutputParser()"
    },
    {
      "id": "step_back",
      "name": "step_back()  ★핵심",
      "fileId": "main",
      "summary": "구체적 질문을 한 단계 추상화한 더 일반적·근본적인 'Step-Back 질문'으로 변환하는 이 예제의 핵심 함수.",
      "how": "Step-Back Prompting 의 본체임. 전용 프롬프트로 LLM에게 '구체적 세부사항 → 일반적 원칙/개념'으로 한 문장의 상위 질문을 만들라고 지시함(예시도 함께 제공). 프롬프트 → LLM → 문자열 추출 체인을 invoke 해 추상화된 질문 문자열을 얻고, 앞뒤 공백을 정리해 돌려줌. 이 상위 질문 덕분에 배경 지식 문서까지 함께 검색됨.",
      "terms": [
        "Step-Back",
        "추상화",
        "Query Transformation",
        "ChatPromptTemplate",
        "LCEL",
        "StrOutputParser",
        "invoke"
      ],
      "lines": [
        {
          "at": "def step_back",
          "text": "구체적 질문을 추상적 상위 질문으로 바꾸는 핵심 함수 정의."
        },
        {
          "at": "step_back_prompt = ChatPromptTemplate.from_template",
          "text": "추상화 지시·규칙·예시를 담은 Step-Back 전용 프롬프트를 만듦."
        },
        {
          "at": "더 일반적이고 추상적인 질문을 생성",
          "text": "한 단계 물러나 더 일반적·추상적인 질문을 만들라는 핵심 지시문."
        },
        {
          "at": "1. 구체적 세부사항",
          "text": "구체적 세부사항을 일반적 원칙/개념으로 바꾸라는 규칙."
        },
        {
          "at": "## 원본 질문:",
          "text": "사용자의 구체적 원본 질문이 채워질 자리."
        },
        {
          "at": "chain = step_back_prompt | llm | StrOutputParser()",
          "text": "프롬프트→LLM→문자열 추출을 LCEL 파이프로 연결한 추상화 체인."
        },
        {
          "at": "return chain.invoke({\"question\": question}).strip()",
          "text": "체인을 실행해 추상화된 상위 질문을 받아 공백을 정리해 돌려줌."
        }
      ],
      "code": "def step_back(llm, question: str) -> str:\n    \"\"\"구체적 질문을 한 단계 추상화한 일반적 질문으로 변환함 (Step-Back).\n\n    세부 사례를 더 넓은 개념/원칙 수준의 질문으로 바꿔, 배경 지식이 담긴 문서까지\n    함께 검색하도록 함.\n    \"\"\"\n    step_back_prompt = ChatPromptTemplate.from_template(\"\"\"당신은 법률 문서 검색을 위한 질문 분석 전문가입니다.\n\n주어진 구체적인 질문에서 한 단계 뒤로 물러나, 더 일반적이고 추상적인 질문을 생성하세요.\n\n## Step-Back 규칙:\n1. 구체적 세부사항 → 일반적 원칙/개념\n2. 특정 사례 → 해당 법률 영역의 기본 개념\n3. 한 문장으로 작성\n\n## 예시:\n- 원본: \"특허 출원 시 명세서에 무엇을 기재해야 하나요?\"\n- Step-Back: \"특허 출원에 필요한 서류와 그 요건은 무엇인가요?\"\n\n## 원본 질문:\n{question}\n\n## Step-Back 질문:\"\"\")\n    # 프롬프트 → LLM → 문자열 추출 체인으로 추상화된 질문을 얻음\n    chain = step_back_prompt | llm | StrOutputParser()\n    return chain.invoke({\"question\": question}).strip()"
    },
    {
      "id": "retrieve_with_transformation",
      "name": "retrieve_with_transformation()  ★핵심",
      "fileId": "main",
      "summary": "추상화 질문과 원본 질문으로 각각 검색한 결과를 합쳐 배경+구체 문서를 모두 확보하는 핵심 함수.",
      "how": "Step-Back 검색 전략의 실행부임. ① get_retriever 로 검색기를 얻고, ② step_back 으로 상위 질문을 만듦. ③ 상위 질문(배경 지식)과 원본 질문(구체 정보)으로 각각 검색하고, ④ 두 결과를 합쳐 deduplicate_docs 로 중복을 제거한 뒤 상위 TOP_K개만 남김. 끝으로 원본·상위 질문 정보(info)도 함께 돌려줘 화면에 보여 줄 수 있게 함.",
      "terms": [
        "retriever",
        "Step-Back",
        "유사도 검색",
        "중복 제거",
        "청크",
        "TOP_K",
        "invoke"
      ],
      "lines": [
        {
          "at": "def retrieve_with_transformation",
          "text": "두 질문으로 검색·병합하는 핵심 함수 정의."
        },
        {
          "at": "retriever = get_retriever(vectorstore)",
          "text": "벡터 스토어를 상위 TOP_K 검색기로 변환해 준비."
        },
        {
          "at": "step_back_q = step_back(llm, question)",
          "text": "원본 질문을 한 단계 추상화한 상위 질문을 생성."
        },
        {
          "at": "step_back_docs = retriever.invoke(step_back_q)",
          "text": "상위(배경) 질문으로 검색해 비슷한 청크를 가져옴."
        },
        {
          "at": "original_docs = retriever.invoke(question)",
          "text": "원본(구체) 질문으로도 검색해 비슷한 청크를 가져옴."
        },
        {
          "at": "docs = deduplicate_docs(step_back_docs + original_docs)",
          "text": "두 결과를 합쳐 중복을 제거하고 상위 TOP_K개만 남김."
        },
        {
          "at": "info = {\"original\": question, \"step_back\": step_back_q}",
          "text": "원본·상위 질문을 묶어 화면 표시용 정보로 만듦."
        },
        {
          "at": "return docs, info",
          "text": "최종 근거 청크와 질문 정보를 함께 돌려줌."
        }
      ],
      "code": "def retrieve_with_transformation(vectorstore: Chroma, llm, question: str):\n    \"\"\"추상화 질문과 원본 질문으로 각각 검색한 결과를 합쳐 배경+구체 문서를 모두 확보함.\"\"\"\n    retriever = get_retriever(vectorstore)\n    step_back_q = step_back(llm, question)\n    # 추상화 질문(배경 지식)과 원본 질문(구체 정보) 양쪽으로 검색함\n    step_back_docs = retriever.invoke(step_back_q)\n    original_docs = retriever.invoke(question)\n    docs = deduplicate_docs(step_back_docs + original_docs)[:TOP_K]\n    info = {\"original\": question, \"step_back\": step_back_q}\n    return docs, info"
    },
    {
      "id": "display_transform_info",
      "name": "display_transform_info()",
      "fileId": "main",
      "summary": "원본 질문과 추상화된 Step-Back 질문을 콘솔에 나란히 보여 주는 함수.",
      "how": "어떤 상위 질문이 만들어졌는지 과정을 사람이 볼 수 있게, 구분선과 함께 원본 질문과 Step-Back 질문을 출력함. Query Transformation 의 효과를 눈으로 확인하게 해 줌.",
      "terms": [
        "Step-Back",
        "Query Transformation"
      ],
      "lines": [
        {
          "at": "def display_transform_info",
          "text": "원본·상위 질문을 보여 주는 함수 정의."
        },
        {
          "at": "print(\"Step-Back (추상화 질문)\")",
          "text": "추상화 질문 영역임을 알리는 제목을 출력."
        },
        {
          "at": "원본 질문      :",
          "text": "사용자가 입력한 원본(구체적) 질문을 출력."
        },
        {
          "at": "Step-Back 질문 :",
          "text": "LLM이 만든 추상화(상위) 질문을 출력."
        }
      ],
      "code": "def display_transform_info(info: dict) -> None:\n    \"\"\"원본 질문과 추상화된 Step-Back 질문을 표시함.\"\"\"\n    print(\"\\n\" + \"=\" * 60)\n    print(\"Step-Back (추상화 질문)\")\n    print(\"=\" * 60)\n    print(f\"원본 질문      : {info['original']}\")\n    print(f\"Step-Back 질문 : {info['step_back']}\")\n    print(\"=\" * 60)"
    },
    {
      "id": "answer_question",
      "name": "answer_question()",
      "fileId": "main",
      "summary": "Query Transformation → 검색 → 컨텍스트 주입 → 답변 생성의 전체 흐름을 수행·출력하는 함수.",
      "how": "한 질문에 대한 전체 파이프라인을 묶음. ① retrieve_with_transformation 으로 상위 질문 생성·양쪽 검색·병합을 한 번에 수행함. ② display_transform_info 로 두 질문을, format_chunks_for_display 로 검색 청크를 보여 줌. ③ format_docs 로 컨텍스트를 만들고 llm_chain.invoke 로 최종 답을 생성해 출력함.",
      "terms": [
        "Query Transformation",
        "청크",
        "프롬프트",
        "LCEL",
        "invoke"
      ],
      "lines": [
        {
          "at": "def answer_question",
          "text": "한 질문의 전체 흐름을 수행·출력하는 함수 정의."
        },
        {
          "at": "docs, info = retrieve_with_transformation",
          "text": "상위 질문 생성·양쪽 검색·병합을 한 번에 수행해 근거 청크와 질문 정보를 받음."
        },
        {
          "at": "display_transform_info(info)",
          "text": "원본·상위 질문을 화면에 표시."
        },
        {
          "at": "print(format_chunks_for_display(docs))",
          "text": "검색된 청크 미리보기를 화면에 표시."
        },
        {
          "at": "context = format_docs(docs)",
          "text": "근거 청크들을 프롬프트에 넣을 컨텍스트 문자열로 합침."
        },
        {
          "at": "response = llm_chain.invoke",
          "text": "컨텍스트와 질문을 답변 체인에 넣어 최종 답을 생성."
        },
        {
          "at": "print(response)",
          "text": "생성된 최종 답변을 출력."
        }
      ],
      "code": "def answer_question(vectorstore: Chroma, llm, llm_chain, question: str) -> None:\n    \"\"\"Query Transformation → 검색 → 컨텍스트 주입 → 답변 생성의 전체 흐름을 수행하고 출력함.\"\"\"\n    print(\"\\nQuery Transformation 적용 중...\")\n    docs, info = retrieve_with_transformation(vectorstore, llm, question)\n\n    display_transform_info(info)\n\n    print(\"\\n\" + \"=\" * 60)\n    print(f\"검색된 청크 ({len(docs)}개)\")\n    print(\"=\" * 60)\n    print(format_chunks_for_display(docs))\n    print(\"=\" * 60)\n\n    print(\"\\n답변 생성 중...\\n\")\n    context = format_docs(docs)\n    response = llm_chain.invoke({\"context\": context, \"question\": question})\n    print(\"-\" * 60)\n    print(response)\n    print(\"-\" * 60)"
    },
    {
      "id": "run_once",
      "name": "run_once()",
      "fileId": "main",
      "summary": "질의 한 건만 처리하고 종료하는 one-shot 모드 함수 (비대화형 테스트·데모용).",
      "how": "--query 나 --demo 로 들어온 단일 질문을 한 번만 처리함. 질의어를 헤더로 출력한 뒤 answer_question 을 호출해 전체 흐름을 수행함.",
      "terms": [
        "Query Transformation"
      ],
      "lines": [
        {
          "at": "def run_once",
          "text": "질의 한 건만 처리하는 one-shot 함수 정의."
        },
        {
          "at": "[one-shot] 질의어",
          "text": "어떤 질의어로 1회 실행하는지 헤더로 출력."
        },
        {
          "at": "answer_question(vectorstore, llm, llm_chain, question)",
          "text": "전체 파이프라인을 한 번 수행."
        }
      ],
      "code": "def run_once(vectorstore: Chroma, llm, llm_chain, question: str) -> None:\n    \"\"\"one-shot 모드: 질의 한 건을 처리하고 종료함 (비대화형 테스트·데모용).\"\"\"\n    print(\"\\n\" + \"=\" * 60)\n    print(f\"[one-shot] 질의어: {question}\")\n    print(\"=\" * 60)\n    answer_question(vectorstore, llm, llm_chain, question)"
    },
    {
      "id": "chat",
      "name": "chat()",
      "fileId": "main",
      "summary": "사용자 입력을 반복해서 받는 대화형 챗봇 루프 함수.",
      "how": "종료어가 들어오거나 입력이 끊길 때까지 질문을 계속 받아 answer_question 으로 답함. 비대화형(파이프) 실행 시 input() 이 던지는 EOFError 와 Ctrl+C 를 잡아 무한 루프 없이 깔끔히 종료함. 기타 예외는 메시지만 출력하고 루프를 이어 감.",
      "terms": [
        "Query Transformation"
      ],
      "lines": [
        {
          "at": "def chat",
          "text": "대화형 챗봇 루프 함수 정의."
        },
        {
          "at": "while True:",
          "text": "종료 전까지 질문을 계속 받기 위한 무한 반복."
        },
        {
          "at": "question = input(\"질문: \").strip()",
          "text": "사용자에게서 질문을 한 줄 입력받아 공백을 정리."
        },
        {
          "at": "if question.lower() in [\"quit\"",
          "text": "quit/q/exit/종료 입력 시 루프를 끝냄."
        },
        {
          "at": "except (KeyboardInterrupt, EOFError):",
          "text": "Ctrl+C 또는 파이프 입력 종료를 잡아 무한 루프 없이 종료."
        },
        {
          "at": "except Exception as e:",
          "text": "기타 오류는 메시지만 보여 주고 대화를 계속 이어 감."
        }
      ],
      "code": "def chat(vectorstore: Chroma, llm, llm_chain) -> None:\n    \"\"\"대화형 챗봇 루프 (입력이 없을 때까지 반복).\"\"\"\n    print(\"\\n\" + \"=\" * 60)\n    print(\"Step-Back RAG 챗봇\")\n    print(\"=\" * 60)\n    print(\"특허법에 대해 질문하세요. 종료하려면 'quit' 또는 'q' 입력.\")\n    print(\"=\" * 60 + \"\\n\")\n    while True:\n        try:\n            question = input(\"질문: \").strip()\n            if not question:\n                continue\n            if question.lower() in [\"quit\", \"q\", \"exit\", \"종료\"]:\n                print(\"\\n챗봇을 종료합니다.\")\n                break\n            answer_question(vectorstore, llm, llm_chain, question)\n            print()\n        # EOFError: 비대화형(파이프) 실행 시 input()이 던지는 예외 — 무한 루프 방지를 위해 종료함\n        except (KeyboardInterrupt, EOFError):\n            print(\"\\n\\n챗봇을 종료합니다.\")\n            break\n        except Exception as e:\n            print(f\"\\n오류가 발생했습니다: {e}\\n\")"
    },
    {
      "id": "main",
      "name": "main()",
      "fileId": "main",
      "summary": "명령줄 옵션을 해석해 벡터 DB·LLM·체인을 준비하고, one-shot 또는 대화형으로 실행하는 진입점.",
      "how": "전체 흐름을 지휘함. argparse 로 --query·--demo 옵션을 받음. load_vectorstore·get_llm·create_llm_chain 로 준비를 마치되, 준비 단계 오류는 잡아 메시지를 내고 종료함. --demo 면 기본 질의어로, --query 면 지정 질의어로 run_once 를, 둘 다 없으면 chat 대화형 모드를 실행함. 맨 아래 if __name__ == \"__main__\" 은 이 파일을 직접 실행할 때만 main() 을 부르는 관용구임.",
      "terms": [
        "if __name__ == \"__main__\"",
        "API 키 검사"
      ],
      "lines": [
        {
          "at": "def main",
          "text": "전체 파이프라인을 실행하는 진입점 함수 정의."
        },
        {
          "at": "parser = argparse.ArgumentParser",
          "text": "명령줄 옵션을 받을 파서를 생성."
        },
        {
          "at": "parser.add_argument(\"--query\"",
          "text": "one-shot 질의어 옵션(--query)을 정의."
        },
        {
          "at": "parser.add_argument(\"--demo\"",
          "text": "기본 질의어로 1회 실행하는 옵션(--demo)을 정의."
        },
        {
          "at": "vectorstore = load_vectorstore()",
          "text": "공용 벡터 DB를 연결해 준비."
        },
        {
          "at": "llm = get_llm()",
          "text": "추상화·답변에 쓸 Groq LLM을 준비."
        },
        {
          "at": "llm_chain = create_llm_chain(llm)",
          "text": "프롬프트→LLM→문자열 답변 체인을 준비."
        },
        {
          "at": "except (FileNotFoundError, RuntimeError) as e:",
          "text": "준비 단계 오류(파일 없음·키 없음)를 잡아 메시지 출력 후 종료."
        },
        {
          "at": "if args.demo:",
          "text": "--demo 면 기본 질의어로 one-shot 실행."
        },
        {
          "at": "elif args.query is not None:",
          "text": "--query 면 지정 질의어로 one-shot 실행."
        },
        {
          "at": "else:",
          "text": "옵션이 없으면 대화형 챗봇 모드로 실행."
        },
        {
          "at": "if __name__ == \"__main__\":",
          "text": "이 파일을 직접 실행할 때만 아래 main()을 수행하는 관용구."
        }
      ],
      "code": "def main() -> None:\n    \"\"\"--query 인자가 있으면 one-shot, 없으면 대화형으로 실행함.\"\"\"\n    parser = argparse.ArgumentParser(description=\"Step-Back Query Transformation RAG 예제\")\n    # --query 지정 시 비대화형 1회 실행 (자동 테스트·데모에 사용)\n    parser.add_argument(\"--query\", type=str, default=None, help=\"one-shot 질의어 (미지정 시 대화형 모드)\")\n    parser.add_argument(\"--demo\", action=\"store_true\", help=\"기본 테스트 질의어로 one-shot 실행\")\n    args = parser.parse_args()\n\n    try:\n        vectorstore = load_vectorstore()\n        llm = get_llm()\n        llm_chain = create_llm_chain(llm)\n    except (FileNotFoundError, RuntimeError) as e:\n        print(f\"\\n[오류] {e}\")\n        sys.exit(1)\n\n    if args.demo:\n        run_once(vectorstore, llm, llm_chain, TEST_QUERY)\n    elif args.query is not None:\n        run_once(vectorstore, llm, llm_chain, args.query)\n    else:\n        chat(vectorstore, llm, llm_chain)\n\n\n# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)\nif __name__ == \"__main__\":\n    main()"
    }
  ],
  "glossary": {
    "Step-Back": "Step-Back Prompting. 구체적 질문에서 한 걸음 물러나 더 일반적·근본적인 '상위 개념 질문'을 LLM이 만들게 하는 기법. 세부 사례뿐 아니라 그 사례가 속한 배경 지식·원칙이 담긴 문서까지 함께 검색하게 해 답변의 맥락을 넓힘.",
    "추상화": "구체적이고 세부적인 내용을 더 일반적·근본적인 개념·원칙 수준으로 끌어올리는 것. 여기서는 '특허 어떻게 받어?' 같은 구체 질문을 '특허 취득 절차와 요건은?' 같은 상위 질문으로 바꾸는 일을 뜻함.",
    "Query Transformation": "사용자의 원래 질문을 그대로 쓰지 않고, 검색이 더 잘 되도록 바꾸거나 늘리는 기법들의 묶음. Step-Back은 그중 '질문을 한 단계 추상화'하는 방식임.",
    "중복 제거": "여러 검색 결과를 합칠 때 본문이 같은 청크가 두 번 들어가지 않도록 걸러 내는 것. 이 예제는 본문 해시로 같은 청크를 판별해 고유 청크만 남김(deduplicate_docs).",
    "RAG": "Retrieval-Augmented Generation. 외부 문서에서 관련 내용을 먼저 찾아(검색) 그 근거로 LLM이 답하게 하는 방식. 모델이 모르는 전문·최신 정보도 문서만 있으면 답할 수 있게 함.",
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
    "gpt-oss-120b": "Groq LPU에서 서빙하는 오픈 가중치 LLM(약 1200억 파라미터). 이 예제의 추상화·답변 생성 모델.",
    "temperature": "LLM 답변의 무작위성 정도. 0에 가까울수록 매번 비슷하고 일관된(보수적인) 답을 냄. 이 예제는 0.3으로 약간의 표현 다양성을 허용함.",
    "ChatPromptTemplate": "LLM에 보낼 프롬프트(지시문)의 틀. {context}·{question} 같은 빈칸에 실제 값을 채워 완성된 프롬프트를 만듦.",
    "프롬프트": "LLM에게 주는 지시문. 여기서는 '문서 근거로만 쉽게 답하라'는 답변 프롬프트와 '질문을 추상화하라'는 Step-Back 프롬프트가 따로 있음.",
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
