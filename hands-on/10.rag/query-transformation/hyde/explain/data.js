window.EXPLAIN_DATA = {
  "meta": {
    "title": "HyDE — 가상 답변 임베딩 검색",
    "entry": "app.py"
  },
  "files": [
    {
      "id": "main",
      "label": "app.py",
      "role": "질문 대신 LLM이 만든 '가상 답변 문서'로 검색해 근거 기반 답변을 만드는 HyDE RAG 전체"
    }
  ],
  "flow": [
    {
      "step": 1,
      "title": "실행 & 환경 준비",
      "summary": "python app.py 로 실행하고, .env 의 API 키를 불러옴",
      "detail": "터미널에서 'python app.py'(대화형) 또는 'python app.py --query \"특허 어떻게 받어?\"'(1회 실행)로 시작함. 시작과 동시에 load_dotenv() 가 hands-on/.env 에 적어 둔 OPENAI_API_KEY(가상 문서 임베딩용)와 GROQ_API_KEY(LLM용)를 읽어 둠. 한글 출력이 깨지지 않게 표준출력을 UTF-8로 맞추는 처리도 함. 비유하면, 사서(앱)가 출근해 책상에 두 개의 열쇠(임베딩 열쇠·답변 열쇠)를 챙겨 두는 단계."
    },
    {
      "step": 2,
      "title": "벡터 DB 로드 & LLM 준비",
      "summary": "이미 만들어 둔 공용 벡터 DB를 '재인덱싱 없이' 연결하고, 답변용 LLM도 준비함",
      "detail": "이 예제는 PDF를 새로 읽거나 쪼개지 않음. 그 작업(인덱싱)은 ../../indexing 이 미리 해 두었고, 여기서는 그 결과물인 공용 벡터 DB(컬렉션 patent_law)를 그냥 연결만 함. 동시에 답변을 써 줄 Groq LLM(openai/gpt-oss-120b)도 준비함. 비유하면, 이미 정리된 서가에 사서가 접근 권한을 얻고, 답을 적어 줄 글쓰는 직원도 부르는 단계."
    },
    {
      "step": 3,
      "title": "가상 답변 문서 생성 (HyDE 핵심)",
      "summary": "짧은 질문을 LLM에게 줘서, 법령 문체의 '가상 모범답안'을 먼저 만들게 함",
      "detail": "HyDE의 핵심 단계임. 사용자의 짧은 질문(예: '특허 어떻게 받어?')은 실제 법령 문서와 말투·구조가 너무 달라 그대로 검색하면 잘 안 맞음. 그래서 먼저 LLM에게 '이 질문에 대한 답이 법령 문서에 있다면 이렇게 생겼을 것'이라는 가상의 답변 문서(hypothetical document)를 3~5문장으로 짓게 함. 이 가상 답변의 사실 정확성은 중요하지 않고, 오직 검색을 위한 '미끼' 역할만 함. 비유하면, 막연한 질문 쪽지 대신, 답안처럼 보이는 예시 카드를 먼저 그려 보는 것."
    },
    {
      "step": 4,
      "title": "가상 답변으로 유사도 검색 (Retrieve)",
      "summary": "질문이 아니라 '가상 답변 문서'를 임베딩해 비슷한 청크 5개(top-k)를 찾음",
      "detail": "이제 원본 질문이 아니라 방금 만든 가상 답변 문서를 숫자 벡터(임베딩)로 바꿔 벡터 DB에서 가장 가까운 청크 상위 5개를 꺼냄(유사도 검색). 가상 답변은 실제 법령 문서와 문체가 비슷하므로, 질문을 그대로 검색할 때보다 더 알맞은 청크가 걸림 — 이것이 HyDE가 검색 정확도를 높이는 원리임. 비유하면, '답안처럼 생긴 예시 카드'와 좌표가 가까운 서가 카드들을 뽑아 오는 것."
    },
    {
      "step": 5,
      "title": "컨텍스트 주입 & 최종 답변 생성 (Generate)",
      "summary": "찾은 청크를 근거로 넣어, LLM이 '원본 질문'에 대한 답을 만듦",
      "detail": "검색해 온 청크 5개를 [문서 N] 라벨과 함께 '컨텍스트'로 프롬프트에 채우고, LLM이 그 근거만 바탕으로 답을 생성함. 이때 검색은 가상 답변으로 했지만, 최종 답변은 '원본 질문'에 대해 '실제 검색된 청크'에 근거해 만들어짐(가상 답변은 검색 미끼였을 뿐). 이 조립은 LCEL 파이프(prompt | llm | StrOutputParser)로 이뤄짐. 비유하면, 사서가 뽑아 온 진짜 카드만 보고 원래 질문에 답을 적어 주는 것."
    },
    {
      "step": 6,
      "title": "결과 출력",
      "summary": "가상 답변·검색 청크·최종 답변을 콘솔에 보기 좋게 표시",
      "detail": "어떤 가상 답변으로 검색했는지, 어떤 청크가 근거였는지(파일명·청크 번호·앞부분 미리보기), 그리고 최종 답변을 차례로 보여 줌. 검색 과정과 근거를 함께 보여 주는 것은 RAG의 핵심 장점 — 사람이 답의 출처와 검색 품질을 검증할 수 있음. 비유하면, 답안과 함께 '어떤 예시 카드로 찾았는지'와 '참고한 진짜 카드 목록'을 같이 제출하는 것."
    }
  ],
  "functions": [
    {
      "id": "setup",
      "name": "임포트·경로·상수·프롬프트 설정",
      "fileId": "main",
      "summary": "필요한 모듈을 가져오고, 파일 위치 기준으로 경로를 잡고, .env 키·핵심 상수·시스템 프롬프트를 준비하는 부분.",
      "how": "함수가 아니라 파일 위쪽의 준비 코드 모음임. ① from __future__ import annotations 로 타입 힌트를 가볍게 쓰고, 표준출력을 UTF-8로 맞춤. ② LangChain 관련 모듈(Chroma·OpenAIEmbeddings·ChatGroq·프롬프트·파서)을 가져옴. ③ 모든 경로를 이 파일 위치(__file__) 기준으로 계산해, 어디서 실행해도 같은 공용 벡터 DB와 .env 를 가리키게 함. ④ load_dotenv 로 키를 올리고, 컬렉션명·임베딩 모델·LLM 모델·TOP_K·기본 질의어와 최종 답변용 시스템 프롬프트를 정함. 특히 임베딩 모델은 인덱싱 때와 반드시 같아야 검색이 성립함.",
      "terms": [
        "from __future__ import annotations",
        "Path(__file__).resolve().parent",
        "load_dotenv",
        "벡터 DB",
        "청크",
        "임베딩",
        "TOP_K",
        "프롬프트",
        "LLM"
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
          "at": "from langchain_chroma import Chroma",
          "text": "공용 벡터 DB(ChromaDB)를 연결하는 LangChain 래퍼를 가져옴."
        },
        {
          "at": "from langchain_openai import OpenAIEmbeddings",
          "text": "가상 답변 문서를 벡터로 바꿀 임베딩 모델을 가져옴."
        },
        {
          "at": "from langchain_groq import ChatGroq",
          "text": "Groq 클라우드에 채팅 요청을 보내는 LLM 래퍼를 가져옴."
        },
        {
          "at": "from langchain_core.prompts import ChatPromptTemplate",
          "text": "LLM에 보낼 프롬프트 틀을 만드는 도구를 가져옴."
        },
        {
          "at": "from langchain_core.output_parsers import StrOutputParser",
          "text": "LLM 응답에서 본문 문자열만 뽑는 파서를 가져옴."
        },
        {
          "at": "SCRIPT_DIR = Path(__file__)",
          "text": "이 파일이 있는 폴더(hyde/)를 절대경로로 구함 — 실행 위치와 무관하게 동작."
        },
        {
          "at": "VECTORDB_DIR = SCRIPT_DIR.parents[1]",
          "text": "공용 벡터 DB가 저장된 폴더(10.rag/vectordb)를 가리킴."
        },
        {
          "at": "ENV_PATH = SCRIPT_DIR.parents[2]",
          "text": "API 키가 든 hands-on/.env 파일 경로를 잡음."
        },
        {
          "at": "COLLECTION_NAME =",
          "text": "검색할 벡터 DB의 컬렉션 이름 — 인덱싱 때와 같아야 함."
        },
        {
          "at": "EMBEDDING_MODEL =",
          "text": "가상 답변을 벡터로 바꿀 임베딩 모델 — 인덱싱 때와 반드시 동일(1536차원)."
        },
        {
          "at": "GROQ_MODEL =",
          "text": "가상 답변 생성과 최종 답변 생성에 모두 쓰는 LLM(Groq의 gpt-oss-120b) 이름."
        },
        {
          "at": "TOP_K = 5",
          "text": "검색으로 가져올 비슷한 청크 개수를 5개로 정함(top-k)."
        },
        {
          "at": "TEST_QUERY =",
          "text": "--demo 실행 시 사용할 기본 데모 질의어."
        },
        {
          "at": "load_dotenv(ENV_PATH)",
          "text": ".env 에서 OPENAI_API_KEY·GROQ_API_KEY 를 실제로 읽어 환경변수로 올림."
        },
        {
          "at": "SYSTEM_PROMPT =",
          "text": "검색된 컨텍스트만 근거로 답하라고 지시하는 최종 답변용 시스템 프롬프트."
        }
      ],
      "code": "\"\"\"HyDE 기법 RAG 예제 (Query Transformation)\n\n질문 대신 LLM이 만든 '가상의 답변 문서'를 임베딩해 검색함으로써,\n질문-문서 간 형식 차이를 줄여 검색 정확도를 높이는 예제임(HyDE: Hypothetical Document Embeddings).\n\n핵심 흐름: 원본 질문 → (LLM 가상 답변 생성) → 가상 문서 → 유사도 검색 → 컨텍스트 주입 → 답변 생성\nLLM: Groq LPU openai/gpt-oss-120b / 임베딩: OpenAI text-embedding-3-small (검색 시점에만 사용)\n\"\"\"\n\nfrom __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함\n\nimport argparse\nimport os\nimport sys\nfrom pathlib import Path\nfrom typing import List\n\n# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함\nif hasattr(sys.stdout, \"reconfigure\"):\n    sys.stdout.reconfigure(encoding=\"utf-8\")\n\nfrom dotenv import load_dotenv\nfrom langchain_chroma import Chroma  # ChromaDB 벡터 스토어를 다루는 LangChain 래퍼\nfrom langchain_openai import OpenAIEmbeddings  # OpenAI 임베딩 모델 (쿼리를 벡터로 변환)\nfrom langchain_groq import ChatGroq  # Groq LPU 채팅 모델 래퍼 (llm.invoke()로 호출)\nfrom langchain_core.documents import Document  # LangChain 표준 문서 객체\nfrom langchain_core.prompts import ChatPromptTemplate  # LLM 프롬프트 템플릿 생성기\nfrom langchain_core.output_parsers import StrOutputParser  # LLM 응답에서 문자열만 추출하는 파서\n\n# ---------------------------------------------------------------------------\n# 경로·상수 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)\n# ---------------------------------------------------------------------------\n# 이 파일 위치: hands-on/10.rag/query-transformation/hyde/app.py\nSCRIPT_DIR = Path(__file__).resolve().parent       # 이 파일이 위치한 디렉터리 절대경로\nVECTORDB_DIR = SCRIPT_DIR.parents[1] / \"vectordb\"  # hands-on/10.rag/vectordb (공용 벡터 DB)\nENV_PATH = SCRIPT_DIR.parents[2] / \".env\"          # hands-on/.env (API 키 보관)\n\nCOLLECTION_NAME = \"patent_law\"               # 인덱싱 시 사용한 공용 컬렉션명 (반드시 일치해야 검색 가능)\nEMBEDDING_MODEL = \"text-embedding-3-small\"   # 인덱싱과 동일한 임베딩 모델 (1536차원, 쿼리 임베딩용)\nGROQ_MODEL = \"openai/gpt-oss-120b\"           # Groq LPU에서 제공하는 LLM\nTOP_K = 5                                    # 검색 시 가져올 청크 수\nTEST_QUERY = \"특허 어떻게 받어?\"               # 기본 데모/테스트 질의어\n\nload_dotenv(ENV_PATH)  # .env에서 OPENAI_API_KEY·GROQ_API_KEY 등을 환경변수로 로드함\n\nSYSTEM_PROMPT = \"\"\"당신은 특허법 전문 법률 상담 AI입니다.\n\n## 역할\n- 주어진 컨텍스트를 기반으로 특허법 관련 질문에 답변합니다.\n- 법조문을 그대로 인용하지 말고, 일반인이 이해하기 쉽도록 풀어서 설명합니다.\n\n## 규칙\n1. 법률 용어는 쉬운 말로 바꿔서 설명\n2. 복잡한 조문은 핵심만 요약하여 전달\n3. 컨텍스트에 없는 내용은 \"해당 내용은 제공된 문서에서 찾을 수 없습니다\"라고 답변\n\n## 답변 형식\n1. **쉬운 설명**: 질문에 대한 이해하기 쉬운 답변\n2. **근거 조문**: 반드시 명시 (예: 특허법 제42조 제2항)\n3. **참고사항**: 관련 정보나 주의할 점 (있는 경우)\n\n## 컨텍스트\n{context}\n\"\"\""
    },
    {
      "id": "get_llm",
      "name": "get_llm()",
      "fileId": "main",
      "summary": "가상 답변·최종 답변을 모두 생성할 Groq LLM(openai/gpt-oss-120b)을 만들어 돌려주는 함수.",
      "how": "이 예제에서 LLM은 두 번 쓰임 — 가상 답변 문서를 짓는 데 한 번, 최종 답변을 쓰는 데 한 번. 그 LLM을 여기서 준비함. Groq 키가 없으면 즉시 명확한 오류를 내 디버깅을 쉽게 함. temperature=0.3 으로 표현에 약간의 다양성을 허용하고, max_tokens=2048 로 응답 길이 상한을 둠.",
      "terms": [
        "ChatGroq",
        "Groq LPU",
        "LLM",
        "temperature",
        "API 키 검사"
      ],
      "lines": [
        {
          "at": "def get_llm",
          "text": "가상·최종 답변 생성용 LLM을 만드는 함수 정의."
        },
        {
          "at": "api_key = os.environ.get(\"GROQ_API_KEY\")",
          "text": "환경변수에서 Groq API 키를 읽어 옴."
        },
        {
          "at": "if not api_key:",
          "text": "Groq 키가 없으면 실행 초기에 명확한 오류를 내 디버깅을 쉽게 함."
        },
        {
          "at": "return ChatGroq(",
          "text": "설정값으로 Groq 채팅 모델 객체를 만들어 돌려줌."
        }
      ],
      "code": "def get_llm() -> ChatGroq:\n    \"\"\"Groq LPU의 openai/gpt-oss-120b 모델로 ChatGroq 인스턴스를 생성함.\"\"\"\n    api_key = os.environ.get(\"GROQ_API_KEY\")\n    # API 키 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함\n    if not api_key:\n        raise RuntimeError(\"GROQ_API_KEY가 설정되지 않음 (hands-on/.env 확인)\")\n    # ChatGroq: temperature 0.3으로 약간의 표현 다양성 허용, 최대 2048토큰 응답\n    return ChatGroq(model=GROQ_MODEL, temperature=0.3, max_tokens=2048, api_key=api_key)"
    },
    {
      "id": "load_vectorstore",
      "name": "load_vectorstore()",
      "fileId": "main",
      "summary": "이미 만들어진 공용 벡터 DB를 재인덱싱 없이 연결해 벡터 스토어(Chroma)로 돌려주는 함수.",
      "how": "RAG의 검색 쪽 준비를 담당함. 새로 인덱싱하지 않고, 인덱싱이 만들어 둔 공용 컬렉션을 그대로 연결함. ① 벡터 DB 폴더가 없으면 인덱싱을 먼저 하라는 안내와 함께 오류를 냄. ② 인덱싱과 동일한 임베딩 모델로 OpenAIEmbeddings 를 만들고(검색 시점에 가상 답변을 벡터로 바꾸는 데 사용), Chroma(...) 로 기존 컬렉션을 연결함. 컬렉션명을 빠뜨리면 빈 검색 결과가 나오므로 반드시 같은 이름을 지정함.",
      "terms": [
        "벡터 DB",
        "Chroma",
        "컬렉션",
        "OpenAIEmbeddings",
        "임베딩",
        "유사도 검색"
      ],
      "lines": [
        {
          "at": "def load_vectorstore",
          "text": "공용 벡터 DB를 연결해 벡터 스토어를 만드는 함수 정의."
        },
        {
          "at": "if not VECTORDB_DIR.exists():",
          "text": "인덱싱이 먼저 돼 있어야 하므로 벡터 DB 폴더 존재를 확인함."
        },
        {
          "at": "raise FileNotFoundError(",
          "text": "폴더가 없으면 인덱싱을 먼저 하라는 안내와 함께 오류를 냄."
        },
        {
          "at": "embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL",
          "text": "인덱싱과 같은 모델로 임베딩기를 준비함(검색 시점에만 사용)."
        },
        {
          "at": "return Chroma(",
          "text": "from_documents(신규 생성)가 아니라 기존 컬렉션을 '연결'만 함."
        },
        {
          "at": "collection_name=COLLECTION_NAME,",
          "text": "어떤 컬렉션을 열지 이름으로 지정 — 인덱싱 때와 같아야 함."
        },
        {
          "at": "persist_directory=str(VECTORDB_DIR),",
          "text": "디스크에 저장된 벡터 폴더를 가리켜 재임베딩 없이 재사용."
        }
      ],
      "code": "def load_vectorstore() -> Chroma:\n    \"\"\"공용 벡터 DB를 임베딩(재인덱싱) 없이 로드함.\n\n    인덱싱 때와 동일한 컬렉션명(patent_law)·임베딩 모델(text-embedding-3-small)을\n    지정해야 저장된 246개 벡터를 정상 검색할 수 있음. 컬렉션명을 빠뜨리면 ChromaDB가\n    기본 컬렉션(langchain)을 새로 만들어 빈 검색 결과를 반환하므로 주의함.\n    \"\"\"\n    if not VECTORDB_DIR.exists():\n        raise FileNotFoundError(\n            f\"공용 벡터 DB를 찾을 수 없음: {VECTORDB_DIR}\\n\"\n            f\"hands-on/10.rag/indexing/indexing.py를 먼저 실행해 인덱싱을 수행하세요.\"\n        )\n    # OpenAIEmbeddings: 쿼리 문자열을 1536차원 벡터로 변환 (검색 시점에만 사용)\n    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL, api_key=os.environ.get(\"OPENAI_API_KEY\"))\n    print(f\"공용 벡터 DB 로드: {VECTORDB_DIR} (컬렉션: {COLLECTION_NAME})\")\n    return Chroma(\n        collection_name=COLLECTION_NAME,\n        persist_directory=str(VECTORDB_DIR),\n        embedding_function=embeddings,\n    )"
    },
    {
      "id": "get_retriever",
      "name": "get_retriever()",
      "fileId": "main",
      "summary": "벡터 스토어를 '상위 TOP_K개를 찾는 검색기(retriever)'로 바꿔 돌려주는 함수.",
      "how": "벡터 스토어 자체는 저장소일 뿐이라, 검색에 바로 쓰려면 검색기(retriever) 형태로 바꿔야 함. as_retriever 에 코사인 유사도 기반(search_type='similarity')으로 상위 TOP_K(5)개를 가져오라고 설정해 돌려줌.",
      "terms": [
        "retriever",
        "유사도 검색",
        "TOP_K",
        "청크"
      ],
      "lines": [
        {
          "at": "def get_retriever",
          "text": "벡터 스토어를 검색기로 바꾸는 함수 정의."
        },
        {
          "at": "return vectorstore.as_retriever",
          "text": "유사도 기반으로 상위 TOP_K개 청크를 찾는 검색기로 변환해 돌려줌."
        }
      ],
      "code": "def get_retriever(vectorstore: Chroma):\n    \"\"\"코사인 유사도 기반으로 상위 TOP_K개 청크를 반환하는 검색기를 생성함.\"\"\"\n    return vectorstore.as_retriever(search_type=\"similarity\", search_kwargs={\"k\": TOP_K})"
    },
    {
      "id": "format_docs",
      "name": "format_docs()",
      "fileId": "main",
      "summary": "검색된 청크 여러 개를 LLM 프롬프트에 넣을 한 덩어리 컨텍스트 문자열로 합치는 도우미 함수.",
      "how": "검색기는 Document 객체 목록을 주는데, 프롬프트에는 글자로 넣어야 함. 각 청크 앞에 [문서 N]·출처 파일명·청크 번호를 붙여 LLM이 근거를 인용하기 쉽게 하고, 청크 사이는 구분선(---)으로 띄워 문서 경계를 분명히 함.",
      "terms": [
        "청크",
        "Document",
        "프롬프트"
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
          "at": "source = doc.metadata.get(\"source\", \"알 수 없음\")",
          "text": "청크의 출처 파일명을 메타데이터에서 꺼냄."
        },
        {
          "at": "chunk_index = doc.metadata.get(\"chunk_index\", \"?\")",
          "text": "청크가 문서에서 몇 번째 조각인지 번호를 꺼냄."
        },
        {
          "at": "formatted.append(f\"[문서 {i}]",
          "text": "[문서 N]·출처·내용을 합친 한 청크 블록을 리스트에 추가."
        },
        {
          "at": "return \"\\n\\n---\\n\\n\".join(formatted)",
          "text": "모든 청크 블록을 구분선으로 이어 하나의 컨텍스트 문자열로 만듦."
        }
      ],
      "code": "def format_docs(docs: List[Document]) -> str:\n    \"\"\"검색된 문서들을 LLM 컨텍스트용 문자열로 합침.\"\"\"\n    formatted = []\n    for i, doc in enumerate(docs, 1):\n        source = doc.metadata.get(\"source\", \"알 수 없음\")\n        chunk_index = doc.metadata.get(\"chunk_index\", \"?\")\n        formatted.append(f\"[문서 {i}] {source} (청크 #{chunk_index})\\n{doc.page_content}\")\n    return \"\\n\\n---\\n\\n\".join(formatted)"
    },
    {
      "id": "create_llm_chain",
      "name": "create_llm_chain()",
      "fileId": "main",
      "summary": "프롬프트 → LLM → 문자열 추출로 이어지는 LCEL 답변 체인을 만드는 함수(최종 답변용).",
      "how": "최종 답변을 만드는 처리 흐름을 한 줄의 체인으로 조립함. ChatPromptTemplate.from_messages 로 시스템 프롬프트(SYSTEM_PROMPT, 컨텍스트 포함)와 사용자 질문을 묶고, LCEL 파이프(|)로 prompt | llm | StrOutputParser 를 연결함. 이렇게 만든 체인을 나중에 invoke 로 실행하면 검색된 컨텍스트 기반 답변이 문자열로 나옴.",
      "terms": [
        "ChatPromptTemplate",
        "프롬프트",
        "LCEL",
        "파이프(|)",
        "StrOutputParser",
        "LLM"
      ],
      "lines": [
        {
          "at": "def create_llm_chain",
          "text": "최종 답변용 LCEL 체인을 만드는 함수 정의."
        },
        {
          "at": "prompt = ChatPromptTemplate.from_messages([",
          "text": "시스템 프롬프트와 사용자 질문을 하나의 프롬프트로 구성."
        },
        {
          "at": "(\"system\", SYSTEM_PROMPT),",
          "text": "컨텍스트만 근거로 답하라는 시스템 지시문을 넣음."
        },
        {
          "at": "(\"human\", \"{question}\"),",
          "text": "사용자 질문이 들어갈 자리({question})를 둠."
        },
        {
          "at": "return prompt | llm | StrOutputParser()",
          "text": "LCEL 파이프(|)로 프롬프트→LLM→문자열파서를 한 줄로 연결해 돌려줌."
        }
      ],
      "code": "def create_llm_chain(llm):\n    \"\"\"프롬프트 → LLM → 문자열 추출로 이어지는 LCEL 답변 체인을 생성함.\"\"\"\n    prompt = ChatPromptTemplate.from_messages([\n        (\"system\", SYSTEM_PROMPT),\n        (\"human\", \"{question}\"),\n    ])\n    # LCEL(|) 파이프: 프롬프트 렌더 → ChatGroq 호출 → StrOutputParser로 문자열만 추출\n    return prompt | llm | StrOutputParser()"
    },
    {
      "id": "hyde",
      "name": "hyde()",
      "fileId": "main",
      "summary": "질문에 대한 '가상의 답변 문서(hypothetical document)'를 LLM으로 만드는 함수 — 이 예제의 핵심.",
      "how": "HyDE 기법의 심장임. 짧은 질문 문장은 실제 법령 문서와 형식이 달라 그대로 검색하면 잘 안 맞으므로, '법령 문서에 있을 법한 가상의 답변'을 LLM에게 3~5문장으로 짓게 함. 전용 프롬프트(hyde_prompt)로 가상 답변 체인을 만들고 invoke 로 실행해, 결과 문자열의 앞뒤 공백을 다듬어(strip) 돌려줌. 이 가상 답변은 사실 정확성보다 '검색 미끼' 역할이 목적임.",
      "terms": [
        "HyDE",
        "가상 문서",
        "Query Transformation",
        "프롬프트",
        "LCEL",
        "StrOutputParser",
        "invoke",
        "LLM"
      ],
      "lines": [
        {
          "at": "def hyde",
          "text": "질문에 대한 가상 답변 문서를 만드는 핵심 함수 정의."
        },
        {
          "at": "hyde_prompt = ChatPromptTemplate.from_template",
          "text": "법령 문체의 가상 답변을 짓도록 지시하는 전용 프롬프트를 만듦."
        },
        {
          "at": "주어진 질문에 대해 특허법 문서에서",
          "text": "'문서에 있을 법한 가상 답변을 쓰라'는 핵심 지시문."
        },
        {
          "at": "3~5 문장으로 간결하게 작성",
          "text": "가상 답변을 3~5문장으로 짧게 쓰라는 규칙."
        },
        {
          "at": "chain = hyde_prompt | llm | StrOutputParser()",
          "text": "프롬프트→LLM→문자열 추출로 가상 답변 생성 체인을 구성."
        },
        {
          "at": "return chain.invoke({\"question\": question}).strip()",
          "text": "체인을 실행해 가상 답변을 받고 앞뒤 공백을 다듬어 돌려줌."
        }
      ],
      "code": "def hyde(llm, question: str) -> str:\n    \"\"\"질문에 대한 가상의 답변 문서를 생성함 (HyDE).\n\n    질문 문장보다 '답변 형태'가 실제 법령 문서와 구조가 더 비슷하므로,\n    가상 답변을 임베딩해 검색하면 질문-문서 형식 차이를 줄여 검색 정확도가 향상됨.\n    \"\"\"\n    hyde_prompt = ChatPromptTemplate.from_template(\"\"\"당신은 특허법 전문가입니다.\n\n주어진 질문에 대해 특허법 문서에서 찾을 수 있을 법한 가상의 답변 문서를 작성하세요.\n\n## 작성 규칙:\n1. 실제 법률 문서 스타일로 작성\n2. 관련 조문 번호 언급 가능 (가상)\n3. 3~5 문장으로 간결하게 작성\n4. 법률 용어 사용\n\n## 질문:\n{question}\n\n## 가상의 답변 문서:\"\"\")\n    # 프롬프트 → LLM → 문자열 추출 체인으로 가상 답변 문서를 생성함\n    chain = hyde_prompt | llm | StrOutputParser()\n    return chain.invoke({\"question\": question}).strip()"
    },
    {
      "id": "retrieve_with_transformation",
      "name": "retrieve_with_transformation()",
      "fileId": "main",
      "summary": "가상 답변 문서를 만든 뒤, 질문이 아닌 '그 가상 답변'을 쿼리로 써서 유사 청크를 검색하는 함수.",
      "how": "HyDE의 검색 단계를 묶음. ① get_retriever 로 검색기를 얻음. ② hyde() 로 가상 답변 문서를 만듦. ③ 핵심 — 원본 질문이 아니라 가상 답변(hypothetical)을 retriever.invoke 에 넣어 검색함(실제 문서와 형식이 더 비슷해 검색 정확도↑). ④ 검색된 청크와, 원본 질문·가상 답변을 담은 info 를 함께 돌려줌.",
      "terms": [
        "HyDE",
        "가상 문서",
        "retriever",
        "invoke",
        "유사도 검색",
        "청크"
      ],
      "lines": [
        {
          "at": "def retrieve_with_transformation",
          "text": "가상 답변 생성 후 그것으로 검색하는 함수 정의."
        },
        {
          "at": "retriever = get_retriever(vectorstore)",
          "text": "벡터 스토어에서 상위 TOP_K개를 찾는 검색기를 얻음."
        },
        {
          "at": "hypothetical = hyde(llm, question)",
          "text": "질문으로부터 가상 답변 문서를 생성함."
        },
        {
          "at": "docs = retriever.invoke(hypothetical)",
          "text": "핵심 — 질문이 아니라 '가상 답변'을 쿼리로 넣어 유사 청크를 검색함."
        },
        {
          "at": "info = {\"original\": question, \"hypothetical\": hypothetical}",
          "text": "원본 질문과 가상 답변을 묶어 표시용 정보로 보관."
        },
        {
          "at": "return docs, info",
          "text": "검색된 청크와 변환 정보를 함께 돌려줌."
        }
      ],
      "code": "def retrieve_with_transformation(vectorstore: Chroma, llm, question: str):\n    \"\"\"가상 답변 문서를 생성하고, 그 문서를 쿼리로 사용해 유사 청크를 검색함.\"\"\"\n    retriever = get_retriever(vectorstore)\n    hypothetical = hyde(llm, question)\n    # 질문이 아닌 '가상 답변'을 검색 쿼리로 사용함 (실제 문서와 형식이 더 유사)\n    docs = retriever.invoke(hypothetical)\n    info = {\"original\": question, \"hypothetical\": hypothetical}\n    return docs, info"
    },
    {
      "id": "display_transform_info",
      "name": "display_transform_info()",
      "fileId": "main",
      "summary": "원본 질문과 LLM이 만든 가상 답변 문서를 콘솔에 보기 좋게 출력하는 함수.",
      "how": "HyDE가 실제로 어떤 가상 답변으로 검색했는지 사람이 확인할 수 있게, 구분선과 함께 원본 질문과 생성된 가상 답변 문서를 출력함. 검색 과정을 투명하게 보여 주는 역할.",
      "terms": [
        "HyDE",
        "가상 문서"
      ],
      "lines": [
        {
          "at": "def display_transform_info",
          "text": "변환 정보를 콘솔에 출력하는 함수 정의."
        },
        {
          "at": "print(\"HyDE (가상 문서 임베딩)\")",
          "text": "어떤 기법으로 검색했는지 제목을 출력."
        },
        {
          "at": "print(f\"원본 질문: {info['original']}\")",
          "text": "사용자가 입력한 원본 질문을 출력."
        },
        {
          "at": "print(info[\"hypothetical\"])",
          "text": "LLM이 만든 가상 답변 문서를 그대로 출력."
        }
      ],
      "code": "def display_transform_info(info: dict) -> None:\n    \"\"\"원본 질문과 생성된 가상 답변 문서를 표시함.\"\"\"\n    print(\"\\n\" + \"=\" * 60)\n    print(\"HyDE (가상 문서 임베딩)\")\n    print(\"=\" * 60)\n    print(f\"원본 질문: {info['original']}\")\n    print(\"-\" * 60)\n    print(\"생성된 가상 답변 문서:\")\n    print(info[\"hypothetical\"])\n    print(\"=\" * 60)"
    },
    {
      "id": "answer_question",
      "name": "answer_question()",
      "fileId": "main",
      "summary": "가상 답변 생성 → 검색 → 컨텍스트 주입 → 최종 답변 생성의 전체 흐름을 수행하고 출력하는 핵심 함수.",
      "how": "HyDE RAG 한 사이클을 지휘함. ① retrieve_with_transformation 으로 가상 답변을 만들고 그것으로 청크를 검색함. ② display_transform_info 로 가상 답변을, format_chunks_for_display 로 검색된 청크를 보여 줌. ③ format_docs 로 청크를 컨텍스트 문자열로 만들고, llm_chain.invoke 에 컨텍스트와 '원본 질문'을 넣어 최종 답변을 생성·출력함. 검색은 가상 답변으로, 답변은 원본 질문에 대해 이뤄진다는 점이 핵심.",
      "terms": [
        "HyDE",
        "Query Transformation",
        "청크",
        "프롬프트",
        "invoke",
        "LLM"
      ],
      "lines": [
        {
          "at": "def answer_question",
          "text": "가상 답변 생성부터 최종 답변 출력까지 수행하는 함수 정의."
        },
        {
          "at": "docs, info = retrieve_with_transformation(vectorstore, llm, question)",
          "text": "가상 답변을 만들고 그것으로 청크를 검색함."
        },
        {
          "at": "display_transform_info(info)",
          "text": "원본 질문과 가상 답변 문서를 출력함."
        },
        {
          "at": "print(format_chunks_for_display(docs))",
          "text": "검색된 청크들을 미리보기 형태로 출력함."
        },
        {
          "at": "context = format_docs(docs)",
          "text": "검색된 청크를 LLM 컨텍스트용 문자열로 합침."
        },
        {
          "at": "response = llm_chain.invoke({\"context\": context, \"question\": question})",
          "text": "컨텍스트와 '원본 질문'을 체인에 넣어 최종 답변을 생성함."
        },
        {
          "at": "print(response)",
          "text": "생성된 최종 답변을 출력함."
        }
      ],
      "code": "def answer_question(vectorstore: Chroma, llm, llm_chain, question: str) -> None:\n    \"\"\"Query Transformation → 검색 → 컨텍스트 주입 → 답변 생성의 전체 흐름을 수행하고 출력함.\"\"\"\n    print(\"\\nQuery Transformation 적용 중...\")\n    docs, info = retrieve_with_transformation(vectorstore, llm, question)\n\n    display_transform_info(info)\n\n    print(\"\\n\" + \"=\" * 60)\n    print(f\"검색된 청크 ({len(docs)}개)\")\n    print(\"=\" * 60)\n    print(format_chunks_for_display(docs))\n    print(\"=\" * 60)\n\n    print(\"\\n답변 생성 중...\\n\")\n    context = format_docs(docs)\n    response = llm_chain.invoke({\"context\": context, \"question\": question})\n    print(\"-\" * 60)\n    print(response)\n    print(\"-\" * 60)"
    },
    {
      "id": "run_once",
      "name": "run_once()",
      "fileId": "main",
      "summary": "질의 한 건만 처리하고 끝내는 one-shot 모드 함수(비대화형 테스트·데모용).",
      "how": "--query 나 --demo 로 실행할 때 쓰는 1회 실행 모드임. 질의어를 헤더로 한 번 출력한 뒤 answer_question 을 호출해 가상 답변 생성→검색→답변까지 한 번에 처리하고 종료함. 자동 테스트나 데모에 적합함.",
      "terms": [
        "HyDE"
      ],
      "lines": [
        {
          "at": "def run_once",
          "text": "질의 한 건만 처리하는 one-shot 모드 함수 정의."
        },
        {
          "at": "print(f\"[one-shot] 질의어: {question}\")",
          "text": "처리할 질의어를 헤더로 출력함."
        },
        {
          "at": "answer_question(vectorstore, llm, llm_chain, question)",
          "text": "가상 답변 생성→검색→답변까지 한 번에 수행함."
        }
      ],
      "code": "def run_once(vectorstore: Chroma, llm, llm_chain, question: str) -> None:\n    \"\"\"one-shot 모드: 질의 한 건을 처리하고 종료함 (비대화형 테스트·데모용).\"\"\"\n    print(\"\\n\" + \"=\" * 60)\n    print(f\"[one-shot] 질의어: {question}\")\n    print(\"=\" * 60)\n    answer_question(vectorstore, llm, llm_chain, question)"
    },
    {
      "id": "chat",
      "name": "chat()",
      "fileId": "main",
      "summary": "사용자 입력을 반복해서 받아 처리하는 대화형 챗봇 루프 함수.",
      "how": "인자 없이 실행하면 들어오는 대화형 모드임. while 루프로 질문을 계속 받아 answer_question 으로 처리함. 'quit'·'q'·'종료' 입력 시 멈추고, 파이프로 입력이 끊기면 던져지는 EOFError 도 잡아 무한 루프를 방지함. 그 밖의 예외는 메시지만 보여 주고 루프를 이어 감.",
      "terms": [
        "HyDE"
      ],
      "lines": [
        {
          "at": "def chat",
          "text": "대화형 챗봇 루프 함수 정의."
        },
        {
          "at": "while True:",
          "text": "종료 입력이 있을 때까지 질문을 반복해서 받음."
        },
        {
          "at": "question = input(\"질문: \").strip()",
          "text": "사용자로부터 질문 한 줄을 입력받음."
        },
        {
          "at": "if question.lower() in [\"quit\", \"q\", \"exit\", \"종료\"]:",
          "text": "종료 명령어가 들어오면 루프를 빠져나감."
        },
        {
          "at": "except (KeyboardInterrupt, EOFError):",
          "text": "Ctrl+C나 입력 종료(파이프)를 잡아 안전하게 종료함."
        }
      ],
      "code": "def chat(vectorstore: Chroma, llm, llm_chain) -> None:\n    \"\"\"대화형 챗봇 루프 (입력이 없을 때까지 반복).\"\"\"\n    print(\"\\n\" + \"=\" * 60)\n    print(\"HyDE RAG 챗봇\")\n    print(\"=\" * 60)\n    print(\"특허법에 대해 질문하세요. 종료하려면 'quit' 또는 'q' 입력.\")\n    print(\"=\" * 60 + \"\\n\")\n    while True:\n        try:\n            question = input(\"질문: \").strip()\n            if not question:\n                continue\n            if question.lower() in [\"quit\", \"q\", \"exit\", \"종료\"]:\n                print(\"\\n챗봇을 종료합니다.\")\n                break\n            answer_question(vectorstore, llm, llm_chain, question)\n            print()\n        # EOFError: 비대화형(파이프) 실행 시 input()이 던지는 예외 — 무한 루프 방지를 위해 종료함\n        except (KeyboardInterrupt, EOFError):\n            print(\"\\n\\n챗봇을 종료합니다.\")\n            break\n        except Exception as e:\n            print(f\"\\n오류가 발생했습니다: {e}\\n\")"
    },
    {
      "id": "main",
      "name": "main()",
      "fileId": "main",
      "summary": "옵션을 해석해 벡터 DB·LLM·체인을 준비하고, one-shot 또는 대화형으로 실행하는 진입점.",
      "how": "전체 흐름을 지휘함. argparse 로 --query·--demo 옵션을 받음. load_vectorstore() 로 벡터 스토어를, get_llm() 으로 LLM을, create_llm_chain() 으로 최종 답변 체인을 준비하되, 파일 없음·키 없음 오류는 깔끔히 보여 주고 종료함. --demo 면 기본 질의어로, --query 면 지정 질의어로 run_once 를, 둘 다 없으면 chat 대화형을 실행함. 맨 아래 if __name__ == \"__main__\" 은 이 파일을 직접 실행할 때만 main() 을 부르는 관용구.",
      "terms": [
        "if __name__ == \"__main__\"",
        "LLM"
      ],
      "lines": [
        {
          "at": "def main",
          "text": "옵션 해석부터 모드 분기까지 지휘하는 진입점 함수 정의."
        },
        {
          "at": "parser = argparse.ArgumentParser",
          "text": "명령줄 옵션을 받을 파서를 만듦."
        },
        {
          "at": "vectorstore = load_vectorstore()",
          "text": "공용 벡터 DB를 연결해 벡터 스토어를 준비."
        },
        {
          "at": "llm = get_llm()",
          "text": "가상·최종 답변 생성용 Groq LLM을 준비."
        },
        {
          "at": "llm_chain = create_llm_chain(llm)",
          "text": "최종 답변용 LCEL 체인을 준비."
        },
        {
          "at": "if args.demo:",
          "text": "--demo 면 기본 데모 질의어로 1회 실행."
        },
        {
          "at": "elif args.query is not None:",
          "text": "--query 가 있으면 지정 질의어로 1회 실행."
        },
        {
          "at": "chat(vectorstore, llm, llm_chain)",
          "text": "옵션이 없으면 대화형 챗봇 모드로 실행."
        },
        {
          "at": "if __name__ ==",
          "text": "이 파일을 직접 실행할 때만 아래 main()을 수행하는 관용구."
        }
      ],
      "code": "def main() -> None:\n    \"\"\"--query 인자가 있으면 one-shot, 없으면 대화형으로 실행함.\"\"\"\n    parser = argparse.ArgumentParser(description=\"HyDE Query Transformation RAG 예제\")\n    # --query 지정 시 비대화형 1회 실행 (자동 테스트·데모에 사용)\n    parser.add_argument(\"--query\", type=str, default=None, help=\"one-shot 질의어 (미지정 시 대화형 모드)\")\n    parser.add_argument(\"--demo\", action=\"store_true\", help=\"기본 테스트 질의어로 one-shot 실행\")\n    args = parser.parse_args()\n\n    try:\n        vectorstore = load_vectorstore()\n        llm = get_llm()\n        llm_chain = create_llm_chain(llm)\n    except (FileNotFoundError, RuntimeError) as e:\n        print(f\"\\n[오류] {e}\")\n        sys.exit(1)\n\n    if args.demo:\n        run_once(vectorstore, llm, llm_chain, TEST_QUERY)\n    elif args.query is not None:\n        run_once(vectorstore, llm, llm_chain, args.query)\n    else:\n        chat(vectorstore, llm, llm_chain)\n\n\n# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)\nif __name__ == \"__main__\":\n    main()"
    }
  ],
  "glossary": {
    "RAG": "Retrieval-Augmented Generation. 외부 문서에서 관련 내용을 먼저 찾아(검색) 그 근거로 LLM이 답하게 하는 방식. 모델이 모르는 전문·최신 정보도 문서만 있으면 답할 수 있게 함.",
    "HyDE": "Hypothetical Document Embeddings. 질문을 그대로 검색하지 않고, LLM이 만든 '가상의 답변 문서'를 임베딩해 검색하는 기법. 질문과 실제 문서의 형식 차이를 줄여 검색 정확도를 높임.",
    "가상 문서": "hypothetical document. 질문에 대해 '실제 문서에 있다면 이렇게 생겼을 답'을 LLM이 지어낸 가짜 답변 문서. 사실 정확성보다 검색용 '미끼' 역할이 목적임.",
    "Query Transformation": "질의 변환. 사용자의 원본 질문을 검색에 더 유리한 형태로 바꿔 검색 정확도를 높이는 RAG 기법 묶음. HyDE는 질문을 '가상 답변'으로 바꾸는 한 방식임.",
    "임베딩": "텍스트를 의미가 담긴 숫자 벡터(여러 숫자의 나열)로 바꾼 것. 뜻이 비슷한 글은 벡터도 가깝게 위치해, 컴퓨터가 '비슷한 내용'을 계산으로 찾을 수 있음.",
    "유사도 검색": "similarity search. 쿼리 벡터와 문서 벡터의 '가까운 정도'(코사인 유사도)를 계산해 가장 가까운 청크부터 찾는 검색 방식.",
    "retriever": "검색기. 벡터 DB에서 쿼리와 가장 비슷한 청크 몇 개(top-k)를 찾아 돌려주는 역할. 이 예제에서는 가상 답변을 쿼리로 받아 검색함.",
    "청크": "chunk. 긴 문서를 검색하기 좋게 잘게 나눈 한 조각. 이 예제는 이미 나뉘어 저장된 청크를 검색해서 사용함.",
    "벡터 DB": "임베딩(숫자 벡터)을 저장하고, 쿼리 벡터와 가장 가까운 것들을 빠르게 찾아 주는 데이터베이스. 여기서는 ChromaDB를 사용함.",
    "Chroma": "ChromaDB(오픈소스 벡터 데이터베이스)를 LangChain에서 다루는 래퍼 클래스. 여기서는 from_documents(신규 생성)가 아니라 생성자로 기존 컬렉션을 '연결'만 함.",
    "컬렉션": "벡터 DB 안에서 벡터들을 묶어 두는 단위(여기서는 patent_law). 인덱싱과 검색이 같은 컬렉션 이름을 써야 검색이 됨.",
    "OpenAIEmbeddings": "OpenAI 임베딩 모델 호출 래퍼. 텍스트를 숫자 벡터로 변환함. 여기서는 가상 답변 문서를 벡터로 바꾸는 데 사용.",
    "Document": "LangChain에서 한 청크를 담는 객체. 본문 텍스트(page_content)와 출처 등 부가정보(metadata)를 함께 가짐.",
    "LLM": "Large Language Model(거대 언어 모델). 글을 이해하고 생성하는 AI. 이 예제에서는 Groq의 gpt-oss-120b를 가상 답변 생성과 최종 답변 생성에 사용함.",
    "ChatGroq": "Groq 클라우드의 채팅 LLM을 호출하는 LangChain 래퍼. GROQ_API_KEY를 자동/명시 참조함.",
    "Groq LPU": "Groq사가 만든 LLM 추론 전용 칩(Language Processing Unit). 매우 빠른 응답 속도가 특징.",
    "temperature": "LLM 답변의 무작위성 정도. 0에 가까울수록 매번 비슷하고 일관된 답을, 높을수록 다양한 표현을 냄. 이 예제는 0.3.",
    "프롬프트": "LLM에게 주는 지시문. 이 예제에는 가상 답변을 짓게 하는 프롬프트와, 최종 답변을 컨텍스트 근거로 쓰게 하는 시스템 프롬프트가 있음.",
    "ChatPromptTemplate": "LLM에 보낼 프롬프트(지시문)의 틀. {context}·{question} 같은 빈칸에 실제 값을 채워 완성된 프롬프트를 만듦.",
    "LCEL": "LangChain Expression Language. 파이프 기호(|)로 단계들을 왼쪽→오른쪽으로 연결해 하나의 처리 흐름(체인)을 만드는 문법.",
    "파이프(|)": "LCEL에서 앞 단계의 결과를 다음 단계의 입력으로 흘려보내는 연결 기호. 'prompt | llm | parser'처럼 씀.",
    "StrOutputParser": "LLM 응답 객체에서 사람이 읽을 본문 문자열만 깔끔히 뽑아 주는 출력 파서.",
    "invoke": "LangChain 체인/검색기를 '실행'하는 메서드. 입력을 넣으면 끝까지 돌려 결과를 돌려줌.",
    "TOP_K": "검색에서 가져올 '가장 비슷한 상위 k개' 청크 개수를 정한 상수. 이 예제에서는 5.",
    "load_dotenv": ".env 파일에 적어 둔 비밀값(예: OPENAI_API_KEY, GROQ_API_KEY)을 프로그램의 환경변수로 불러오는 함수.",
    "from __future__ import annotations": "타입 힌트를 즉시 평가하지 않고 문자열로 두게 하는 파이썬 선언. 순환 참조 없이 가볍게 타입 힌트를 쓰게 해 줌.",
    "Path(__file__).resolve().parent": "지금 이 파이썬 파일이 있는 폴더의 절대경로를 구하는 관용구. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "if __name__ == \"__main__\"": "이 파일을 직접 실행할 때만 특정 코드를 돌리고, 다른 곳에서 import할 때는 돌리지 않게 하는 파이썬 관용구.",
    "API 키 검사": "필요한 API 키가 환경변수에 없으면 실행 초기에 명확한 오류를 내는 패턴. 한참 뒤에 엉뚱한 곳에서 실패하는 것을 막아 디버깅을 쉽게 함."
  }
};
