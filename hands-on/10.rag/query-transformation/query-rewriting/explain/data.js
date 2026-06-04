window.EXPLAIN_DATA = {
  "meta": {
    "title": "Query Rewriting — 질의 재작성",
    "entry": "app.py"
  },
  "files": [
    {
      "id": "main",
      "label": "app.py",
      "role": "모호한 질문을 LLM이 검색 친화적 질문으로 재작성한 뒤, 그 질문으로 공용 벡터 DB를 검색해 답변하는 CLI RAG 전체"
    }
  ],
  "flow": [
    {
      "step": 1,
      "title": "실행 & 환경 준비",
      "label": "실행·환경 준비",
      "refs": ["setup", "main"],
      "summary": "python app.py 로 실행하고, .env 의 API 키를 불러옴",
      "detail": "터미널에서 'python app.py'(대화형) 또는 'python app.py --query \"질문\"'(1회 실행)으로 시작함. 실행과 동시에 load_dotenv() 가 hands-on/.env 에 적어 둔 OPENAI_API_KEY(질의 임베딩용)와 GROQ_API_KEY(LLM용)를 읽어 둠. 한글이 깨지지 않게 표준출력을 UTF-8로 맞추는 처리도 함. 비유하면, 통역사(앱)가 출근해 책상에 두 개의 열쇠(질문을 벡터로 바꾸는 열쇠·답을 써 줄 열쇠)를 챙겨 두는 단계."
    },
    {
      "step": 2,
      "title": "벡터 DB 로드 & LLM 준비",
      "label": "벡터 DB·LLM 준비",
      "refs": ["load_vectorstore", "get_llm", "create_llm_chain"],
      "summary": "이미 만들어 둔 공용 벡터 DB를 재임베딩 없이 연결하고, 답변·재작성용 LLM을 준비함",
      "detail": "이 예제는 PDF를 새로 읽거나 쪼개지 않음. 그 작업(인덱싱)은 ../indexing 이 미리 해 두었고, 여기서는 그 결과물인 공용 벡터 DB(컬렉션 patent_law)를 그냥 연결만 함. 동시에 질문 재작성과 답변 생성을 모두 맡을 Groq LLM(gpt-oss-120b)도 준비함. 비유하면, 이미 정리된 서가에 접근 권한만 얻고, 옆에 글 잘 쓰는 직원을 한 명 부르는 단계 — 책을 다시 꽂지는 않음."
    },
    {
      "step": 3,
      "title": "질문 재작성 (Query Rewriting)",
      "label": "질문 재작성",
      "refs": ["query_rewriting"],
      "summary": "구어체·모호한 원본 질문을 LLM이 검색에 더 적합한 명확한 법률 질문으로 바꿈",
      "detail": "이 예제의 핵심 단계임. 예를 들어 '특허 어떻게 받어?' 같은 구어체 질문은 격식 있는 법조문과 표현이 달라 검색이 잘 안 됨. 그래서 먼저 LLM에게 '이 질문을 법률 용어·키워드 중심의 명확한 문장으로 다시 써 달라'고 시킴(query_rewriting). 그 결과 '특허 취득을 위한 출원 절차·요건·심사 기준…' 같은 검색 친화적 질문이 만들어짐. 비유하면, 손님의 막연한 말을 사서가 알아듣기 쉽게 정식 도서 검색어로 바꿔 적어 주는 것."
    },
    {
      "step": 4,
      "title": "탐색 (Retrieve)",
      "label": "탐색",
      "refs": ["retrieve_with_transformation", "get_retriever"],
      "summary": "재작성된 질문을 임베딩해 의미가 비슷한 청크 5개(top-k)를 찾음",
      "detail": "원본 질문이 아니라 '재작성된 질문'을 숫자 벡터(임베딩)로 바꾼 뒤, 벡터 DB에서 가장 가까운(=의미가 비슷한) 청크 상위 5개를 꺼냄(유사도 검색). 표현을 다듬은 질문으로 찾기 때문에 그냥 검색할 때보다 더 알맞은 조문이 걸려 옴. 비유하면, 잘 다듬은 검색어 카드와 좌표가 가장 가까운 서가 카드 5장을 뽑아 오는 것."
    },
    {
      "step": 5,
      "title": "생성 (Generate)",
      "label": "생성",
      "refs": ["answer_question", "format_docs"],
      "summary": "찾은 청크를 근거로 넣어 LLM이 최종 답을 만듦",
      "detail": "찾아온 청크 5개를 [문서] 라벨과 함께 '컨텍스트'로 프롬프트에 채우고, LLM이 그 근거만 바탕으로 답을 생성함. 흥미롭게도 답변 생성에는 '재작성된 질문'이 아니라 사용자의 '원본 질문'을 넣음 — 재작성은 검색을 잘하기 위한 것이고, 답은 원래 묻고 싶었던 것에 맞춰야 하기 때문임. 이 조립은 LCEL 파이프(prompt | llm | StrOutputParser)로 이뤄짐. 비유하면, 사서가 뽑아 온 5장의 카드만 보고 손님이 원래 한 질문에 답을 적어 주는 것."
    },
    {
      "step": 6,
      "title": "결과 출력",
      "label": "결과 출력",
      "refs": ["display_transform_info", "format_chunks_for_display"],
      "summary": "원본·재작성 질문, 검색된 청크, 최종 답변을 콘솔에 보기 좋게 표시",
      "detail": "원본 질문과 재작성된 질문을 나란히 보여 주고(어떻게 다듬었는지 확인 가능), 어떤 청크가 근거였는지(파일명·청크 번호·앞부분 미리보기)와 최종 답변을 함께 출력함. 재작성 결과까지 보여 주는 것이 이 예제의 특징 — 검색 정확도가 왜 올라갔는지 사람이 눈으로 확인할 수 있음. 비유하면, 답안과 함께 '내가 바꿔 적은 검색어'와 '참고한 카드 목록'을 같이 제출하는 것."
    }
  ],
  "functions": [
    {
      "id": "setup",
      "name": "임포트·경로·상수·프롬프트 설정",
      "fileId": "main",
      "summary": "필요한 모듈을 가져오고, 파일 위치 기준으로 경로를 잡고, .env 키와 핵심 상수·시스템 프롬프트를 준비하는 부분.",
      "how": "함수가 아니라 파일 위쪽의 준비 코드 모음임. ① from __future__ import annotations 로 타입 힌트를 가볍게 쓰고, 표준출력을 UTF-8로 맞춤. ② LangChain 관련 모듈(Chroma·OpenAIEmbeddings·ChatGroq·ChatPromptTemplate·StrOutputParser)을 가져옴. ③ 모든 경로를 이 파일 위치(__file__) 기준으로 계산해, 어디서 실행해도 같은 공용 벡터 DB와 .env 를 가리키게 함. ④ load_dotenv 로 키를 올리고, 컬렉션명·임베딩 모델·LLM 모델·TOP_K·기본 질의어를 정함. ⑤ 답변 생성에 쓸 SYSTEM_PROMPT(특허법 상담 규칙)를 정의함.",
      "terms": [
        "from __future__ import annotations",
        "Path(__file__).resolve().parent",
        "load_dotenv",
        "임베딩",
        "벡터 DB",
        "Chroma",
        "OpenAIEmbeddings",
        "ChatGroq",
        "StrOutputParser",
        "컬렉션",
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
          "at": "import argparse",
          "text": "명령줄 옵션(--query, --demo)을 읽기 위한 기본 모듈."
        },
        {
          "at": "sys.stdout.reconfigure(encoding",
          "text": "윈도우 콘솔에서 한글이 깨지지 않도록 출력 인코딩을 UTF-8로 바꿈."
        },
        {
          "at": "from langchain_chroma import Chroma",
          "text": "영속화된 벡터 컬렉션을 연결하는 Chroma 래퍼를 가져옴."
        },
        {
          "at": "from langchain_openai import OpenAIEmbeddings",
          "text": "질문을 숫자 벡터로 바꿀 OpenAI 임베딩 모델을 가져옴."
        },
        {
          "at": "from langchain_groq import ChatGroq",
          "text": "Groq 클라우드의 채팅 LLM을 호출하는 래퍼를 가져옴(재작성·답변 둘 다 담당)."
        },
        {
          "at": "from langchain_core.output_parsers import StrOutputParser",
          "text": "LLM 응답에서 본문 문자열만 뽑는 파서를 가져옴."
        },
        {
          "at": "SCRIPT_DIR = Path(__file__)",
          "text": "이 파일이 있는 폴더(query-rewriting/)를 절대경로로 구함 — 실행 위치와 무관하게 동작."
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
          "at": "COLLECTION_NAME = \"patent_law\"",
          "text": "검색할 벡터 DB의 컬렉션 이름 — 인덱싱 때와 같아야 함."
        },
        {
          "at": "EMBEDDING_MODEL =",
          "text": "질문을 벡터로 바꿀 임베딩 모델 — 인덱싱 때와 반드시 동일(1536차원)."
        },
        {
          "at": "GROQ_MODEL =",
          "text": "재작성·답변에 쓸 LLM(Groq의 gpt-oss-120b) 이름."
        },
        {
          "at": "TOP_K = 5",
          "text": "검색으로 가져올 비슷한 청크 개수를 5개로 정함(top-k)."
        },
        {
          "at": "TEST_QUERY =",
          "text": "데모(--demo)에서 쓸 기본 질의어 — 일부러 구어체 '특허 어떻게 받어?'로 둠."
        },
        {
          "at": "load_dotenv(ENV_PATH)",
          "text": ".env 에서 OPENAI_API_KEY·GROQ_API_KEY 를 실제로 읽어 환경변수로 올림."
        },
        {
          "at": "SYSTEM_PROMPT = \"\"\"당신은 특허법",
          "text": "검색된 컨텍스트로만 답하도록 규칙을 정한 답변 생성용 시스템 프롬프트."
        }
      ],
      "code": "\"\"\"Query Rewriting 기법 RAG 예제 (Query Transformation)\n\n모호하거나 구어체인 질문을 명확한 법률 용어 중심 질문으로 재작성한 뒤,\n그 질문으로 공용 벡터 DB(특허법)를 검색해 답변 정확도를 높이는 예제임.\n\n핵심 흐름: 원본 질문 → (LLM 재작성) → 재작성 질문 → 유사도 검색 → 컨텍스트 주입 → 답변 생성\nLLM: Groq LPU openai/gpt-oss-120b / 임베딩: OpenAI text-embedding-3-small (검색 시점에만 사용)\n\"\"\"\n\nfrom __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함\n\nimport argparse\nimport os\nimport sys\nfrom pathlib import Path\nfrom typing import List\n\n# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함\nif hasattr(sys.stdout, \"reconfigure\"):\n    sys.stdout.reconfigure(encoding=\"utf-8\")\n\nfrom dotenv import load_dotenv\nfrom langchain_chroma import Chroma  # ChromaDB 벡터 스토어를 다루는 LangChain 래퍼\nfrom langchain_openai import OpenAIEmbeddings  # OpenAI 임베딩 모델 (쿼리를 벡터로 변환)\nfrom langchain_groq import ChatGroq  # Groq LPU 채팅 모델 래퍼 (llm.invoke()로 호출)\nfrom langchain_core.documents import Document  # LangChain 표준 문서 객체\nfrom langchain_core.prompts import ChatPromptTemplate  # LLM 프롬프트 템플릿 생성기\nfrom langchain_core.output_parsers import StrOutputParser  # LLM 응답에서 문자열만 추출하는 파서\n\n# ---------------------------------------------------------------------------\n# 경로·상수 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)\n# ---------------------------------------------------------------------------\n# 이 파일 위치: hands-on/10.rag/query-transformation/query-rewriting/app.py\nSCRIPT_DIR = Path(__file__).resolve().parent       # 이 파일이 위치한 디렉터리 절대경로\nVECTORDB_DIR = SCRIPT_DIR.parents[1] / \"vectordb\"  # hands-on/10.rag/vectordb (공용 벡터 DB)\nENV_PATH = SCRIPT_DIR.parents[2] / \".env\"          # hands-on/.env (API 키 보관)\n\nCOLLECTION_NAME = \"patent_law\"               # 인덱싱 시 사용한 공용 컬렉션명 (반드시 일치해야 검색 가능)\nEMBEDDING_MODEL = \"text-embedding-3-small\"   # 인덱싱과 동일한 임베딩 모델 (1536차원, 쿼리 임베딩용)\nGROQ_MODEL = \"openai/gpt-oss-120b\"           # Groq LPU에서 제공하는 LLM\nTOP_K = 5                                    # 검색 시 가져올 청크 수\nTEST_QUERY = \"특허 어떻게 받어?\"               # 기본 데모/테스트 질의어\n\nload_dotenv(ENV_PATH)  # .env에서 OPENAI_API_KEY·GROQ_API_KEY 등을 환경변수로 로드함\n\nSYSTEM_PROMPT = \"\"\"당신은 특허법 전문 법률 상담 AI입니다.\n\n## 역할\n- 주어진 컨텍스트를 기반으로 특허법 관련 질문에 답변합니다.\n- 법조문을 그대로 인용하지 말고, 일반인이 이해하기 쉽도록 풀어서 설명합니다.\n\n## 규칙\n1. 법률 용어는 쉬운 말로 바꿔서 설명\n2. 복잡한 조문은 핵심만 요약하여 전달\n3. 컨텍스트에 없는 내용은 \"해당 내용은 제공된 문서에서 찾을 수 없습니다\"라고 답변\n\n## 답변 형식\n1. **쉬운 설명**: 질문에 대한 이해하기 쉬운 답변\n2. **근거 조문**: 반드시 명시 (예: 특허법 제42조 제2항)\n3. **참고사항**: 관련 정보나 주의할 점 (있는 경우)\n\n## 컨텍스트\n{context}\n\"\"\""
    },
    {
      "id": "get_llm",
      "name": "get_llm()",
      "fileId": "main",
      "summary": "질문 재작성과 답변 생성에 모두 쓸 Groq LLM(openai/gpt-oss-120b)을 만들어 돌려주는 함수.",
      "how": "이 예제의 '글 쓰는 직원'을 준비함. Groq 키가 없으면 즉시 명확한 오류를 내 디버깅을 쉽게 함. ChatGroq 객체를 만들 때 temperature=0.3(표현에 약간의 다양성 허용), max_tokens=2048(응답 최대 길이)로 설정함. 이렇게 만든 하나의 LLM이 뒤에서 질문 재작성과 최종 답변 생성에 함께 쓰임.",
      "terms": [
        "ChatGroq",
        "Groq LPU",
        "gpt-oss-120b",
        "LLM",
        "API 키 검사"
      ],
      "lines": [
        {
          "at": "def get_llm",
          "text": "재작성·답변용 LLM을 만드는 함수 정의."
        },
        {
          "at": "api_key = os.environ.get(\"GROQ_API_KEY\")",
          "text": "환경변수에서 Groq API 키를 꺼냄."
        },
        {
          "at": "if not api_key:",
          "text": "키가 없으면 초기에 명확한 오류를 내 한참 뒤 엉뚱한 실패를 막음."
        },
        {
          "at": "return ChatGroq(model=GROQ_MODEL",
          "text": "설정값(온도 0.3·최대 2048토큰)으로 Groq 채팅 모델을 만들어 돌려줌."
        }
      ],
      "code": "def get_llm() -> ChatGroq:\n    \"\"\"Groq LPU의 openai/gpt-oss-120b 모델로 ChatGroq 인스턴스를 생성함.\"\"\"\n    api_key = os.environ.get(\"GROQ_API_KEY\")\n    # API 키 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함\n    if not api_key:\n        raise RuntimeError(\"GROQ_API_KEY가 설정되지 않음 (hands-on/.env 확인)\")\n    # ChatGroq: temperature 0.3으로 약간의 표현 다양성 허용, 최대 2048토큰 응답\n    return ChatGroq(model=GROQ_MODEL, temperature=0.3, max_tokens=2048, api_key=api_key)"
    },
    {
      "id": "load_vectorstore",
      "name": "load_vectorstore()",
      "fileId": "main",
      "summary": "이미 만들어진 공용 벡터 DB를 재임베딩 없이 연결해 Chroma 벡터 저장소로 돌려주는 함수.",
      "how": "RAG의 검색 쪽 준비를 담당함. 새로 인덱싱하지 않고, 인덱싱이 만들어 둔 영속 컬렉션을 그대로 연결함. ① 벡터 DB 폴더가 없으면 인덱싱부터 하라는 오류를 냄. ② 인덱싱과 동일한 임베딩 모델로 OpenAIEmbeddings 를 만듦(검색 시점에만 사용). ③ Chroma(...) 로 기존 컬렉션(patent_law)을 연결해 돌려줌. 컬렉션명을 빠뜨리면 빈 결과가 나오므로 반드시 같은 이름을 지정함.",
      "terms": [
        "벡터 DB",
        "Chroma",
        "컬렉션",
        "OpenAIEmbeddings",
        "임베딩",
        "유사도 검색",
        "text-embedding-3-small"
      ],
      "lines": [
        {
          "at": "def load_vectorstore",
          "text": "공용 벡터 DB를 연결해 돌려주는 함수 정의."
        },
        {
          "at": "if not VECTORDB_DIR.exists()",
          "text": "인덱싱이 먼저 돼 있어야 하므로 벡터 DB 폴더 존재를 확인함."
        },
        {
          "at": "embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL",
          "text": "인덱싱과 같은 모델로 질문 임베딩기를 준비함(차원·의미공간 일치)."
        },
        {
          "at": "return Chroma(",
          "text": "from_documents(신규 생성)가 아니라 기존 컬렉션을 '연결'만 함."
        },
        {
          "at": "collection_name=COLLECTION_NAME",
          "text": "어떤 컬렉션(patent_law)을 열지 이름으로 지정."
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
      "summary": "벡터 저장소를 '상위 TOP_K개를 찾는 검색기(retriever)'로 바꿔 주는 함수.",
      "how": "Chroma 벡터 저장소 그대로는 LCEL 체인에 꽂기 어려우므로, as_retriever 로 검색기 객체로 변환함. search_type='similarity'(코사인 유사도 검색)와 k=TOP_K(상위 5개) 설정을 줘, 질문이 오면 의미가 가장 비슷한 청크 5개를 돌려주도록 함.",
      "terms": [
        "retriever",
        "유사도 검색",
        "top-k",
        "TOP_K",
        "청크"
      ],
      "lines": [
        {
          "at": "def get_retriever",
          "text": "벡터 저장소를 검색기로 바꾸는 함수 정의."
        },
        {
          "at": "return vectorstore.as_retriever",
          "text": "유사도 검색·상위 TOP_K개 설정으로 검색기를 만들어 돌려줌."
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
        "프롬프트",
        "LLM"
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
          "at": "for i, doc in enumerate(docs, 1)",
          "text": "검색된 청크를 1번부터 번호를 매기며 하나씩 처리."
        },
        {
          "at": "source = doc.metadata.get(\"source\", \"알 수 없음\")",
          "text": "청크의 출처 파일명을 메타데이터에서 꺼냄."
        },
        {
          "at": "formatted.append(f\"[문서 {i}]",
          "text": "[문서 N]·내용을 합친 한 청크 블록을 리스트에 추가."
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
      "summary": "검색된 청크를 콘솔 화면에 보여 줄 짧은 미리보기 형태로 다듬는 도우미 함수.",
      "how": "사람이 결과를 확인하도록, 각 청크의 출처·번호와 함께 본문 앞 150자만 한 줄로 잘라 보여 줌. 150자보다 길면 '...'을 붙여 더 있다는 것을 표시함. format_docs(LLM용)와 달리 이건 화면 표시 전용임.",
      "terms": [
        "청크"
      ],
      "lines": [
        {
          "at": "def format_chunks_for_display",
          "text": "청크를 화면 표시용으로 다듬는 함수 정의."
        },
        {
          "at": "lines = []",
          "text": "한 줄씩 만든 미리보기를 담을 빈 리스트를 준비."
        },
        {
          "at": "preview = doc.page_content[:150]",
          "text": "청크 본문 앞 150자만 잘라 미리보기로 만듦(줄바꿈은 공백으로)."
        },
        {
          "at": "if len(doc.page_content) > 150:",
          "text": "본문이 150자보다 길면 뒤를 잘랐다는 뜻으로 '...'을 붙임."
        },
        {
          "at": "lines.append(f\"[청크 {i}]",
          "text": "[청크 N]·출처·미리보기를 합친 한 줄을 리스트에 추가."
        }
      ],
      "code": "def format_chunks_for_display(docs: List[Document]) -> str:\n    \"\"\"검색된 청크를 콘솔 표시용으로 미리보기 형태로 포맷팅함.\"\"\"\n    lines = []\n    for i, doc in enumerate(docs, 1):\n        source = doc.metadata.get(\"source\", \"알 수 없음\")\n        chunk_index = doc.metadata.get(\"chunk_index\", \"?\")\n        # 청크 본문은 처음 150자만 미리보기로 표시함\n        preview = doc.page_content[:150].replace(\"\\n\", \" \")\n        if len(doc.page_content) > 150:\n            preview += \"...\"\n        lines.append(f\"[청크 {i}] {source} (#{chunk_index})\\n  {preview}\")\n    return \"\\n\".join(lines)"
    },
    {
      "id": "deduplicate_docs",
      "name": "deduplicate_docs()",
      "fileId": "main",
      "summary": "본문 내용이 똑같은 중복 청크를 걸러 내 고유 청크만 남기는 도우미 함수.",
      "how": "검색 결과에 같은 내용이 여러 번 나오면 컨텍스트가 낭비됨. 각 청크 본문의 해시값(내용 지문)을 set 에 모아 두고, 이미 본 내용이면 건너뛰어 처음 나온 것만 남김. 결과적으로 중복 없는 고유 청크 목록을 돌려줌.",
      "terms": [
        "청크"
      ],
      "lines": [
        {
          "at": "def deduplicate_docs",
          "text": "중복 청크를 제거하는 함수 정의."
        },
        {
          "at": "seen = set()",
          "text": "이미 본 내용의 지문을 모아 둘 집합을 준비."
        },
        {
          "at": "unique = []",
          "text": "중복 없는 고유 청크를 담을 리스트를 준비."
        },
        {
          "at": "key = hash(doc.page_content)",
          "text": "본문 내용을 해시(지문)로 바꿔 동일 청크인지 판단할 키로 삼음."
        },
        {
          "at": "if key not in seen:",
          "text": "아직 본 적 없는 내용일 때만 결과에 추가함."
        }
      ],
      "code": "def deduplicate_docs(docs: List[Document]) -> List[Document]:\n    \"\"\"본문 내용이 동일한 중복 문서를 제거하여 고유 문서만 남김.\"\"\"\n    seen = set()\n    unique = []\n    for doc in docs:\n        # 본문 해시로 동일 청크 여부를 판단함\n        key = hash(doc.page_content)\n        if key not in seen:\n            seen.add(key)\n            unique.append(doc)\n    return unique"
    },
    {
      "id": "create_llm_chain",
      "name": "create_llm_chain()",
      "fileId": "main",
      "summary": "프롬프트 → LLM → 문자열 추출로 이어지는 LCEL 답변 체인을 만드는 함수.",
      "how": "최종 답변을 만드는 처리 흐름을 한 줄의 체인으로 묶음. ChatPromptTemplate.from_messages 로 system(특허법 규칙)·human(질문) 메시지를 묶은 프롬프트를 만들고, LCEL 파이프(|)로 'prompt | llm | StrOutputParser()' 처럼 연결함. 이렇게 만든 체인에 컨텍스트·질문을 넣으면 끝까지 돌아 답변 문자열이 나옴.",
      "terms": [
        "프롬프트",
        "ChatPromptTemplate",
        "LCEL",
        "파이프(|)",
        "StrOutputParser",
        "LLM"
      ],
      "lines": [
        {
          "at": "def create_llm_chain",
          "text": "답변 생성 체인을 만드는 함수 정의."
        },
        {
          "at": "prompt = ChatPromptTemplate.from_messages(",
          "text": "system(특허법 규칙)·human(질문) 메시지를 묶어 프롬프트를 구성."
        },
        {
          "at": "(\"human\", \"{question}\"),",
          "text": "사용자 질문이 들어갈 자리({question})를 둔 human 메시지."
        },
        {
          "at": "return prompt | llm | StrOutputParser()",
          "text": "LCEL 파이프(|)로 프롬프트→LLM→문자열파서를 한 줄로 연결해 돌려줌."
        }
      ],
      "code": "def create_llm_chain(llm):\n    \"\"\"프롬프트 → LLM → 문자열 추출로 이어지는 LCEL 답변 체인을 생성함.\"\"\"\n    prompt = ChatPromptTemplate.from_messages([\n        (\"system\", SYSTEM_PROMPT),\n        (\"human\", \"{question}\"),\n    ])\n    # LCEL(|) 파이프: 프롬프트 렌더 → ChatGroq 호출 → StrOutputParser로 문자열만 추출\n    return prompt | llm | StrOutputParser()"
    },
    {
      "id": "query_rewriting",
      "name": "query_rewriting()",
      "fileId": "main",
      "summary": "원본 질문을 검색에 더 적합한 명확한 법률 질문으로 LLM이 다시 쓰게 하는, 이 예제의 핵심 함수.",
      "how": "Query Rewriting 기법의 본체임. ① '질문을 법률 용어·키워드 중심의 명확한 한 문장으로 재작성하라'는 전용 재작성 프롬프트를 ChatPromptTemplate.from_template 로 만듦. ② 'prompt | llm | StrOutputParser()' LCEL 체인을 구성함. ③ chain.invoke 로 원본 질문을 넣어 재작성된 질문을 얻고, .strip() 으로 앞뒤 공백을 정리해 돌려줌. 이 재작성된 질문이 다음 단계 검색에 쓰임.",
      "terms": [
        "Query Rewriting",
        "Query Transformation",
        "프롬프트",
        "ChatPromptTemplate",
        "LCEL",
        "파이프(|)",
        "StrOutputParser",
        "invoke",
        "LLM"
      ],
      "lines": [
        {
          "at": "def query_rewriting",
          "text": "원본 질문을 검색 친화적 질문으로 재작성하는 핵심 함수 정의."
        },
        {
          "at": "rewrite_prompt = ChatPromptTemplate.from_template",
          "text": "'질문을 명확한 법률 용어로 다시 써라'는 재작성 전용 프롬프트를 만듦."
        },
        {
          "at": "{question}",
          "text": "재작성할 원본 질문이 들어갈 자리({question})."
        },
        {
          "at": "chain = rewrite_prompt | llm | StrOutputParser()",
          "text": "LCEL 파이프(|)로 재작성 프롬프트→LLM→문자열파서를 연결."
        },
        {
          "at": "return chain.invoke({\"question\": question}).strip()",
          "text": "원본 질문을 넣어 체인을 실행하고, 재작성된 질문의 앞뒤 공백을 정리해 돌려줌."
        }
      ],
      "code": "def query_rewriting(llm, question: str) -> str:\n    \"\"\"원본 질문을 법률 문서 검색에 더 적합한 명확한 질문으로 재작성함.\n\n    모호하거나 구어체인 질문을 정확한 법률 용어·키워드 중심으로 바꿔 검색 정확도를 높임.\n    \"\"\"\n    rewrite_prompt = ChatPromptTemplate.from_template(\"\"\"당신은 법률 문서 검색을 위한 질문 최적화 전문가입니다.\n\n주어진 질문을 분석하고, 특허법 문서 검색에 더 적합하도록 재작성하세요.\n\n## 재작성 규칙:\n1. 모호하거나 구어체인 표현을 명확한 법률 용어로 변환\n2. 질문의 핵심 의도를 분명히 표현\n3. 검색에 유용한 키워드 포함\n4. 한 문장으로 간결하게 작성\n\n## 원본 질문:\n{question}\n\n## 재작성된 질문:\"\"\")\n    # 프롬프트 → LLM → 문자열 추출 체인으로 재작성된 질문을 얻음\n    chain = rewrite_prompt | llm | StrOutputParser()\n    return chain.invoke({\"question\": question}).strip()"
    },
    {
      "id": "retrieve_with_transformation",
      "name": "retrieve_with_transformation()",
      "fileId": "main",
      "summary": "질문을 먼저 재작성한 뒤, 그 재작성된 질문으로 유사 청크를 검색하는 함수.",
      "how": "재작성과 검색을 한 함수로 묶음. ① get_retriever 로 검색기를 얻음. ② query_rewriting 으로 원본 질문을 재작성함. ③ retriever.invoke(rewritten) — 즉 원본이 아니라 '재작성된 질문'으로 유사 청크를 검색함(이 점이 일반 RAG와의 차이). ④ 검색된 청크와 함께, 원본·재작성 질문을 담은 info 를 반환해 나중에 화면에 보여 줄 수 있게 함.",
      "terms": [
        "retriever",
        "invoke",
        "유사도 검색",
        "청크",
        "Query Rewriting"
      ],
      "lines": [
        {
          "at": "def retrieve_with_transformation",
          "text": "재작성 후 검색까지 수행하는 함수 정의."
        },
        {
          "at": "retriever = get_retriever(vectorstore)",
          "text": "벡터 저장소에서 상위 청크를 찾는 검색기를 준비."
        },
        {
          "at": "rewritten = query_rewriting(llm, question)",
          "text": "원본 질문을 검색 친화적 질문으로 재작성함."
        },
        {
          "at": "docs = retriever.invoke(rewritten)",
          "text": "원본이 아니라 '재작성된 질문'으로 유사 청크를 검색함(핵심 차이)."
        },
        {
          "at": "info = {\"original\": question, \"rewritten\": rewritten}",
          "text": "화면 표시용으로 원본·재작성 질문을 함께 담아 둠."
        }
      ],
      "code": "def retrieve_with_transformation(vectorstore: Chroma, llm, question: str):\n    \"\"\"질문을 재작성한 뒤 그 질문으로 유사 청크를 검색함.\"\"\"\n    retriever = get_retriever(vectorstore)\n    rewritten = query_rewriting(llm, question)\n    docs = retriever.invoke(rewritten)\n    info = {\"original\": question, \"rewritten\": rewritten}\n    return docs, info"
    },
    {
      "id": "display_transform_info",
      "name": "display_transform_info()",
      "fileId": "main",
      "summary": "원본 질문과 재작성된 질문을 콘솔에 나란히 보여 주는 출력 함수.",
      "how": "재작성이 실제로 어떻게 이뤄졌는지 사람이 확인하도록, 구분선과 함께 '원본 질문'과 '재작성 질문'을 위아래로 출력함. 이 비교 출력이 Query Rewriting 예제의 학습 포인트를 눈으로 보여 주는 부분임.",
      "terms": [
        "Query Rewriting"
      ],
      "lines": [
        {
          "at": "def display_transform_info",
          "text": "원본·재작성 질문을 화면에 보여 주는 함수 정의."
        },
        {
          "at": "print(f\"원본 질문",
          "text": "사용자가 입력한 원본 질문을 출력."
        },
        {
          "at": "print(f\"재작성 질문",
          "text": "LLM이 다시 쓴 재작성 질문을 출력(비교 학습 포인트)."
        }
      ],
      "code": "def display_transform_info(info: dict) -> None:\n    \"\"\"원본 질문과 재작성된 질문을 콘솔에 표시함.\"\"\"\n    print(\"\\n\" + \"=\" * 60)\n    print(\"Query Rewriting (질문 재작성)\")\n    print(\"=\" * 60)\n    print(f\"원본 질문   : {info['original']}\")\n    print(f\"재작성 질문 : {info['rewritten']}\")\n    print(\"=\" * 60)"
    },
    {
      "id": "answer_question",
      "name": "answer_question()",
      "fileId": "main",
      "summary": "재작성 → 검색 → 컨텍스트 주입 → 답변 생성의 전체 흐름을 수행하고 출력하는 핵심 함수.",
      "how": "이 예제의 파이프라인을 한 함수에 담음. ① retrieve_with_transformation 으로 재작성+검색을 한 번에 수행해 청크와 info 를 받음. ② display_transform_info 로 원본·재작성 질문을 보여 줌. ③ 검색된 청크를 화면에 미리보기로 출력함. ④ format_docs 로 만든 컨텍스트와 함께, 답변에는 '원본 질문(question)'을 넣어 llm_chain.invoke 로 최종 답을 생성·출력함. 검색은 재작성 질문으로, 답변은 원본 질문으로 한다는 점이 핵심임.",
      "terms": [
        "청크",
        "invoke",
        "프롬프트",
        "Query Transformation",
        "LLM"
      ],
      "lines": [
        {
          "at": "def answer_question",
          "text": "재작성→검색→답변 전체 흐름을 수행하는 함수 정의."
        },
        {
          "at": "docs, info = retrieve_with_transformation(vectorstore, llm, question)",
          "text": "재작성+검색을 한 번에 수행해 청크와 원본/재작성 정보를 받음."
        },
        {
          "at": "display_transform_info(info)",
          "text": "원본·재작성 질문을 화면에 보여 줌."
        },
        {
          "at": "print(format_chunks_for_display(docs))",
          "text": "검색된 청크들을 미리보기 형태로 화면에 출력."
        },
        {
          "at": "context = format_docs(docs)",
          "text": "검색된 청크들을 LLM에 넣을 컨텍스트 문자열로 합침."
        },
        {
          "at": "response = llm_chain.invoke({\"context\": context, \"question\": question})",
          "text": "컨텍스트와 '원본' 질문을 넣어 답변 체인을 실행함(답은 원래 질문에 맞춤)."
        }
      ],
      "code": "def answer_question(vectorstore: Chroma, llm, llm_chain, question: str) -> None:\n    \"\"\"Query Transformation → 검색 → 컨텍스트 주입 → 답변 생성의 전체 흐름을 수행하고 출력함.\"\"\"\n    print(\"\\nQuery Transformation 적용 중...\")\n    docs, info = retrieve_with_transformation(vectorstore, llm, question)\n\n    display_transform_info(info)\n\n    print(\"\\n\" + \"=\" * 60)\n    print(f\"검색된 청크 ({len(docs)}개)\")\n    print(\"=\" * 60)\n    print(format_chunks_for_display(docs))\n    print(\"=\" * 60)\n\n    print(\"\\n답변 생성 중...\\n\")\n    context = format_docs(docs)\n    response = llm_chain.invoke({\"context\": context, \"question\": question})\n    print(\"-\" * 60)\n    print(response)\n    print(\"-\" * 60)"
    },
    {
      "id": "run_once",
      "name": "run_once()",
      "fileId": "main",
      "summary": "질의 한 건만 처리하고 종료하는 one-shot 모드 함수(데모·테스트용).",
      "how": "비대화형으로 질문 하나를 처리할 때 씀. 구분선과 함께 어떤 질의어를 처리하는지 출력한 뒤, answer_question 을 한 번 호출하고 끝남. --query 나 --demo 로 실행할 때 이 함수가 불림.",
      "terms": [],
      "lines": [
        {
          "at": "def run_once",
          "text": "질문 1건만 처리하고 끝나는 one-shot 함수 정의."
        },
        {
          "at": "print(f\"[one-shot] 질의어",
          "text": "처리할 질의어를 화면에 표시."
        },
        {
          "at": "answer_question(vectorstore, llm, llm_chain, question)",
          "text": "재작성→검색→답변 전체 흐름을 한 번 실행."
        }
      ],
      "code": "def run_once(vectorstore: Chroma, llm, llm_chain, question: str) -> None:\n    \"\"\"one-shot 모드: 질의 한 건을 처리하고 종료함 (비대화형 테스트·데모용).\"\"\"\n    print(\"\\n\" + \"=\" * 60)\n    print(f\"[one-shot] 질의어: {question}\")\n    print(\"=\" * 60)\n    answer_question(vectorstore, llm, llm_chain, question)"
    },
    {
      "id": "chat",
      "name": "chat()",
      "fileId": "main",
      "summary": "사용자 입력을 계속 받아 처리하는 대화형 챗봇 루프 함수.",
      "how": "터미널에서 사용자가 질문을 반복 입력하게 함. 무한 루프에서 input 으로 질문을 받아, 빈 입력은 건너뛰고 'quit'·'q' 등이면 종료함. 그 외에는 answer_question 으로 답을 만듦. 파이프 입력 등으로 input 이 EOFError 를 내면 무한 루프를 막기 위해 안전하게 빠져나옴.",
      "terms": [],
      "lines": [
        {
          "at": "def chat",
          "text": "대화형 챗봇 루프 함수 정의."
        },
        {
          "at": "while True:",
          "text": "사용자가 종료할 때까지 질문을 반복해서 받는 무한 루프."
        },
        {
          "at": "question = input(\"질문: \").strip()",
          "text": "사용자에게 질문을 입력받고 앞뒤 공백을 정리."
        },
        {
          "at": "if question.lower() in [\"quit\", \"q\", \"exit\", \"종료\"]:",
          "text": "종료 명령어가 들어오면 루프를 빠져나감."
        },
        {
          "at": "answer_question(vectorstore, llm, llm_chain, question)",
          "text": "입력받은 질문으로 재작성→검색→답변을 수행."
        },
        {
          "at": "except (KeyboardInterrupt, EOFError):",
          "text": "Ctrl+C나 파이프 입력 종료(EOF) 시 안전하게 챗봇을 종료."
        }
      ],
      "code": "def chat(vectorstore: Chroma, llm, llm_chain) -> None:\n    \"\"\"대화형 챗봇 루프 (입력이 없을 때까지 반복).\"\"\"\n    print(\"\\n\" + \"=\" * 60)\n    print(\"Query Rewriting RAG 챗봇\")\n    print(\"=\" * 60)\n    print(\"특허법에 대해 질문하세요. 종료하려면 'quit' 또는 'q' 입력.\")\n    print(\"=\" * 60 + \"\\n\")\n    while True:\n        try:\n            question = input(\"질문: \").strip()\n            if not question:\n                continue\n            if question.lower() in [\"quit\", \"q\", \"exit\", \"종료\"]:\n                print(\"\\n챗봇을 종료합니다.\")\n                break\n            answer_question(vectorstore, llm, llm_chain, question)\n            print()\n        # EOFError: 비대화형(파이프) 실행 시 input()이 던지는 예외 — 무한 루프 방지를 위해 종료함\n        except (KeyboardInterrupt, EOFError):\n            print(\"\\n\\n챗봇을 종료합니다.\")\n            break\n        except Exception as e:\n            print(f\"\\n오류가 발생했습니다: {e}\\n\")"
    },
    {
      "id": "main",
      "name": "main()",
      "fileId": "main",
      "summary": "명령줄 옵션을 읽고, 벡터 DB·LLM·체인을 준비한 뒤 모드(one-shot/대화형)에 맞게 실행하는 진입점.",
      "how": "전체 흐름을 지휘함. argparse 로 --query·--demo 옵션을 읽음. load_vectorstore()·get_llm()·create_llm_chain() 으로 검색·재작성·답변에 필요한 도구를 모두 준비하되, 준비 단계 오류는 깔끔히 출력하고 종료함. --demo 면 기본 질의어로, --query 면 지정 질의어로 run_once 를 부르고, 둘 다 없으면 chat 으로 대화형 모드를 시작함. 맨 아래 if __name__ == \"__main__\" 은 이 파일을 직접 실행할 때만 main() 을 부르는 관용구임.",
      "terms": [
        "LLM",
        "if __name__ == \"__main__\""
      ],
      "lines": [
        {
          "at": "def main",
          "text": "전체 파이프라인을 실행하는 진입점 함수 정의."
        },
        {
          "at": "parser = argparse.ArgumentParser",
          "text": "명령줄 옵션을 해석할 파서를 준비."
        },
        {
          "at": "parser.add_argument(\"--query\"",
          "text": "1회 실행할 질의어를 받는 --query 옵션을 등록."
        },
        {
          "at": "vectorstore = load_vectorstore()",
          "text": "공용 벡터 DB를 연결해 검색 준비."
        },
        {
          "at": "llm = get_llm()",
          "text": "재작성·답변용 Groq LLM을 준비."
        },
        {
          "at": "llm_chain = create_llm_chain(llm)",
          "text": "프롬프트→LLM→문자열로 이어지는 답변 체인을 준비."
        },
        {
          "at": "if args.demo:",
          "text": "--demo 면 기본 테스트 질의어로 one-shot 실행."
        },
        {
          "at": "elif args.query is not None:",
          "text": "--query 가 주어지면 지정 질의어로 one-shot 실행."
        },
        {
          "at": "chat(vectorstore, llm, llm_chain)",
          "text": "옵션이 없으면 대화형 챗봇 모드로 시작."
        },
        {
          "at": "if __name__ ==",
          "text": "이 파일을 직접 실행할 때만 아래 main()을 수행하는 관용구."
        }
      ],
      "code": "def main() -> None:\n    \"\"\"--query 인자가 있으면 one-shot, 없으면 대화형으로 실행함.\"\"\"\n    parser = argparse.ArgumentParser(description=\"Query Rewriting Query Transformation RAG 예제\")\n    # --query 지정 시 비대화형 1회 실행 (자동 테스트·데모에 사용)\n    parser.add_argument(\"--query\", type=str, default=None, help=\"one-shot 질의어 (미지정 시 대화형 모드)\")\n    parser.add_argument(\"--demo\", action=\"store_true\", help=\"기본 테스트 질의어로 one-shot 실행\")\n    args = parser.parse_args()\n\n    try:\n        vectorstore = load_vectorstore()\n        llm = get_llm()\n        llm_chain = create_llm_chain(llm)\n    except (FileNotFoundError, RuntimeError) as e:\n        print(f\"\\n[오류] {e}\")\n        sys.exit(1)\n\n    if args.demo:\n        run_once(vectorstore, llm, llm_chain, TEST_QUERY)\n    elif args.query is not None:\n        run_once(vectorstore, llm, llm_chain, args.query)\n    else:\n        chat(vectorstore, llm, llm_chain)\n\n\n# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)\nif __name__ == \"__main__\":\n    main()"
    }
  ],
  "glossary": {
    "Query Rewriting": "질의 재작성. 사용자의 원본 질문을 LLM이 검색에 더 적합한 형태(명확한 용어·키워드 중심)로 다시 쓰는 기법. 이 예제의 핵심.",
    "Query Transformation": "질의 변환. 검색 전에 질문을 더 좋은 형태로 바꾸는 기법들의 큰 묶음. Query Rewriting은 그중 한 갈래임.",
    "임베딩": "텍스트를 의미가 담긴 숫자 벡터(여러 숫자의 나열)로 바꾼 것. 뜻이 비슷한 글은 벡터도 가깝게 위치해, 컴퓨터가 '비슷한 내용'을 계산으로 찾을 수 있음.",
    "벡터 DB": "임베딩(숫자 벡터)을 저장하고, 질문 벡터와 가장 가까운 것들을 빠르게 찾아 주는 데이터베이스. 여기서는 ChromaDB를 사용함.",
    "Chroma": "ChromaDB(오픈소스 벡터 DB)를 LangChain에서 다루는 래퍼 클래스. 여기서는 새로 만들지 않고 기존 컬렉션을 '연결'만 함.",
    "컬렉션": "벡터 DB 안에서 벡터들을 묶어 두는 단위(여기서는 patent_law). 인덱싱과 검색이 같은 컬렉션 이름을 써야 검색이 됨.",
    "청크": "chunk. 긴 문서를 검색하기 좋게 잘게 나눈 한 조각. 이 예제는 이미 나뉘어 저장된 청크를 검색해서 사용함.",
    "유사도 검색": "similarity search. 질문 벡터와 문서 벡터의 '가까운 정도'를 계산해 가장 가까운 것부터 찾는 검색 방식.",
    "retriever": "검색기. 벡터 DB에서 질문과 가장 비슷한 청크 몇 개(top-k)를 찾아 돌려주는 역할.",
    "top-k": "검색에서 '가장 비슷한 상위 k개'를 가져온다는 뜻. 이 예제는 TOP_K=5 로 5개를 가져옴.",
    "TOP_K": "가져올 상위 청크 개수를 정한 상수. 이 예제에서는 5.",
    "LLM": "Large Language Model. 사람의 말을 이해하고 글을 생성하는 거대 언어 모델. 여기서는 질문 재작성과 답변 생성을 모두 맡음.",
    "ChatGroq": "Groq 클라우드의 채팅 LLM을 호출하는 LangChain 래퍼. GROQ_API_KEY를 자동 참조함.",
    "Groq LPU": "Groq사가 만든 LLM 추론 전용 칩(Language Processing Unit). 매우 빠른 응답 속도가 특징.",
    "gpt-oss-120b": "Groq LPU에서 서빙하는 오픈 가중치 LLM(약 1200억 파라미터). 이 예제의 재작성·답변 생성 모델.",
    "OpenAIEmbeddings": "OpenAI 임베딩 모델 호출 래퍼. 텍스트를 숫자 벡터로 변환함. 여기서는 질문을 벡터로 바꾸는 데 사용.",
    "text-embedding-3-small": "OpenAI의 임베딩 모델 이름(1536차원). 인덱싱 때 쓴 모델과 검색 때 쓰는 모델이 같아야 의미 공간이 맞아 검색이 됨.",
    "프롬프트": "LLM에게 주는 지시문. 이 예제에는 '질문을 다시 써라'는 재작성 프롬프트와 '문서 근거로만 답하라'는 답변용 프롬프트가 따로 있음.",
    "ChatPromptTemplate": "LLM에 보낼 프롬프트(지시문)의 틀. {question}·{context} 같은 빈칸에 실제 값을 채워 완성된 프롬프트를 만듦.",
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
