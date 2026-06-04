window.EXPLAIN_DATA = {
  "meta": {
    "title": "Multi-Query — 여러 질문 변형 검색",
    "entry": "app.py"
  },
  "files": [
    {
      "id": "main",
      "label": "app.py",
      "role": "하나의 질문을 여러 표현으로 바꿔 각각 검색하고 결과를 합쳐 답변을 만드는 Multi-Query RAG 전체 스크립트"
    }
  ],
  "flow": [
    {
      "step": 1,
      "title": "사용자 질문 입력",
      "label": "사용자 질문 입력",
      "summary": "사람이 궁금한 점을 자연어 한 문장으로 물어봄",
      "detail": "사용자가 '한 가지 표현'으로만 질문함. 사람마다 같은 내용을 다른 말로 묻기 때문에 이 한 문장만으로 검색하면 표현이 안 맞아 좋은 자료를 놓칠 수 있음. 도서관에서 '강아지 키우기' 한 마디로만 책을 찾으면 '반려견 입양' 책을 못 찾는 것과 같음. 이 예제의 기본 질문은 '특허 어떻게 받어?'임"
    },
    {
      "step": 2,
      "title": "LLM이 여러 개의 변형 질문 생성",
      "label": "변형 질문 생성",
      "refs": ["multi_query"],
      "summary": "원래 질문을 LLM이 서로 다른 표현의 질문 여러 개로 다시 씀 (질의 변환)",
      "detail": "Multi-Query 기법의 핵심임. LLM이 같은 의도를 가진 질문을 표현만 바꿔 3개로 만들고, 원본까지 합쳐 총 4개의 질문을 준비함(Query Transformation). 친구 여러 명에게 같은 부탁을 조금씩 다른 말로 동시에 물어보는 것과 비슷함. 표현이 다양할수록 관련 자료를 놓칠 확률이 줄어듦"
    },
    {
      "step": 3,
      "title": "각 질문으로 검색",
      "label": "각 질문 검색",
      "refs": ["retrieve_with_transformation", "get_retriever"],
      "summary": "변형 질문들을 각각 벡터 DB에서 유사도 검색함",
      "detail": "질문 하나하나를 임베딩으로 바꿔 벡터 DB에서 의미가 비슷한 청크를 찾음(유사도 검색). retriever가 질문마다 따로 검색하므로 서로 조금씩 다른 자료 묶음이 여러 개 나옴. 여러 검색창에 비슷한 검색어를 각각 넣어 보는 것과 같음"
    },
    {
      "step": 4,
      "title": "결과 합치고 중복 제거(union)",
      "label": "결과 합치기·중복 제거",
      "refs": ["retrieve_with_transformation", "deduplicate_docs"],
      "summary": "여러 검색 결과를 하나로 모으고 겹치는 청크는 한 번만 남김",
      "detail": "변형 질문마다 나온 자료에는 같은 청크가 중복으로 들어 있을 수 있음. 이를 합집합(union)으로 모은 뒤 중복 제거를 해서 깔끔한 자료 묶음 하나를 만듦. 여러 사람이 추천한 책 목록을 모아 중복을 빼고 한 장의 추천 리스트로 정리하는 것과 같음"
    },
    {
      "step": 5,
      "title": "LLM 최종 답변 생성",
      "label": "최종 답변 생성",
      "refs": ["answer_question", "format_docs", "create_llm_chain"],
      "summary": "정리된 자료를 근거로 LLM이 최종 답변을 작성함",
      "detail": "중복을 제거한 자료를 프롬프트에 넣고 LLM이 그 내용만 근거로 답변을 만듦(LCEL 체인으로 연결, invoke로 실행). 시험 볼 때 정리된 요약 노트만 보고 답을 쓰는 것과 같아, 엉뚱한 내용을 지어낼 위험이 줄어듦"
    },
    {
      "step": 6,
      "title": "결과 출력",
      "label": "결과 출력",
      "refs": ["display_transform_info"],
      "summary": "변형 질문 목록, 검색된 청크, 완성된 답변을 화면에 보여 줌",
      "detail": "어떤 변형 질문으로 검색했는지, 어떤 청크를 근거로 썼는지, 그리고 최종 답변을 함께 출력함. 여러 변형 질문으로 폭넓게 찾은 덕분에 한 가지 표현으로만 찾았을 때보다 더 풍부하고 정확한 답을 받을 수 있음"
    }
  ],
  "functions": [
    {
      "id": "setup",
      "name": "임포트·경로·상수 설정",
      "fileId": "main",
      "summary": "필요한 라이브러리를 가져오고, 파일 위치 기준으로 벡터 DB·.env 경로를 잡고, 컬렉션명·임베딩 모델·LLM 모델 같은 핵심 상수와 시스템 프롬프트를 준비하는 시작 부분임",
      "how": "함수가 아니라 파일 위쪽의 준비 코드 모음임. 한글 출력이 깨지지 않게 표준출력을 UTF-8로 맞추고, Chroma·OpenAIEmbeddings·ChatGroq 등 RAG에 필요한 부품을 불러옴. 모든 경로를 이 파일 위치(__file__) 기준으로 계산해 어디서 실행해도 같은 공용 벡터 DB와 .env를 가리키게 함. 임베딩 모델은 인덱싱 때와 반드시 같아야 검색이 성립함",
      "terms": [
        "임베딩",
        "벡터 DB",
        "LLM",
        "프롬프트",
        "유사도 검색",
        "청크"
      ],
      "lines": [
        {
          "at": "from langchain_chroma import Chroma",
          "text": "벡터 DB(ChromaDB)를 다루는 LangChain 래퍼를 가져옴"
        },
        {
          "at": "from langchain_openai import OpenAIEmbeddings",
          "text": "질문을 숫자 벡터로 바꿀 임베딩 모델을 가져옴"
        },
        {
          "at": "from langchain_groq import ChatGroq",
          "text": "답변과 변형 질문을 만들어 줄 LLM(Groq) 래퍼를 가져옴"
        },
        {
          "at": "VECTORDB_DIR = SCRIPT_DIR.parents[1]",
          "text": "검색에 쓸 공용 벡터 DB 폴더 경로를 파일 위치 기준으로 계산함"
        },
        {
          "at": "EMBEDDING_MODEL = \"text-embedding-3-small\"",
          "text": "질문을 벡터로 바꿀 임베딩 모델 이름 — 인덱싱 때와 같아야 함"
        },
        {
          "at": "TOP_K = 5",
          "text": "검색으로 가져올 비슷한 청크 개수를 5개로 정함"
        },
        {
          "at": "load_dotenv(ENV_PATH)",
          "text": ".env에서 OpenAI·Groq API 키를 읽어 환경변수로 올림"
        },
        {
          "at": "SYSTEM_PROMPT =",
          "text": "검색한 자료(컨텍스트)만 근거로 답하라고 LLM에 지시하는 프롬프트 틀"
        }
      ],
      "code": "from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함\n\nimport argparse\nimport os\nimport sys\nfrom pathlib import Path\nfrom typing import List\n\n# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함\nif hasattr(sys.stdout, \"reconfigure\"):\n    sys.stdout.reconfigure(encoding=\"utf-8\")\n\nfrom dotenv import load_dotenv\nfrom langchain_chroma import Chroma  # ChromaDB 벡터 스토어를 다루는 LangChain 래퍼\nfrom langchain_openai import OpenAIEmbeddings  # OpenAI 임베딩 모델 (쿼리를 벡터로 변환)\nfrom langchain_groq import ChatGroq  # Groq LPU 채팅 모델 래퍼 (llm.invoke()로 호출)\nfrom langchain_core.documents import Document  # LangChain 표준 문서 객체\nfrom langchain_core.prompts import ChatPromptTemplate  # LLM 프롬프트 템플릿 생성기\nfrom langchain_core.output_parsers import StrOutputParser  # LLM 응답에서 문자열만 추출하는 파서\n\n# ---------------------------------------------------------------------------\n# 경로·상수 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)\n# ---------------------------------------------------------------------------\n# 이 파일 위치: hands-on/10.rag/query-transformation/multi-query/app.py\nSCRIPT_DIR = Path(__file__).resolve().parent       # 이 파일이 위치한 디렉터리 절대경로\nVECTORDB_DIR = SCRIPT_DIR.parents[1] / \"vectordb\"  # hands-on/10.rag/vectordb (공용 벡터 DB)\nENV_PATH = SCRIPT_DIR.parents[2] / \".env\"          # hands-on/.env (API 키 보관)\n\nCOLLECTION_NAME = \"patent_law\"               # 인덱싱 시 사용한 공용 컬렉션명 (반드시 일치해야 검색 가능)\nEMBEDDING_MODEL = \"text-embedding-3-small\"   # 인덱싱과 동일한 임베딩 모델 (1536차원, 쿼리 임베딩용)\nGROQ_MODEL = \"openai/gpt-oss-120b\"           # Groq LPU에서 제공하는 LLM\nTOP_K = 5                                    # 검색 시 가져올 청크 수\nTEST_QUERY = \"특허 어떻게 받어?\"               # 기본 데모/테스트 질의어\n\nload_dotenv(ENV_PATH)  # .env에서 OPENAI_API_KEY·GROQ_API_KEY 등을 환경변수로 로드함\n\nSYSTEM_PROMPT = \"\"\"당신은 특허법 전문 법률 상담 AI입니다.\n\n## 역할\n- 주어진 컨텍스트를 기반으로 특허법 관련 질문에 답변합니다.\n- 법조문을 그대로 인용하지 말고, 일반인이 이해하기 쉽도록 풀어서 설명합니다.\n\n## 규칙\n1. 법률 용어는 쉬운 말로 바꿔서 설명\n2. 복잡한 조문은 핵심만 요약하여 전달\n3. 컨텍스트에 없는 내용은 \"해당 내용은 제공된 문서에서 찾을 수 없습니다\"라고 답변\n\n## 답변 형식\n1. **쉬운 설명**: 질문에 대한 이해하기 쉬운 답변\n2. **근거 조문**: 반드시 명시 (예: 특허법 제42조 제2항)\n3. **참고사항**: 관련 정보나 주의할 점 (있는 경우)\n\n## 컨텍스트\n{context}\n\"\"\""
    },
    {
      "id": "get_llm",
      "name": "get_llm()",
      "fileId": "main",
      "summary": "답변과 변형 질문을 만들어 줄 Groq LLM(openai/gpt-oss-120b)을 준비해 돌려주는 함수임",
      "how": "Groq API 키가 없으면 실행 초기에 명확한 오류를 내 디버깅을 쉽게 함. temperature 0.3으로 약간의 표현 다양성을 허용해, 변형 질문을 만들 때 서로 다른 표현이 잘 나오도록 함",
      "terms": [
        "LLM"
      ],
      "lines": [
        {
          "at": "def get_llm",
          "text": "답변 생성용 LLM을 만드는 함수 정의"
        },
        {
          "at": "api_key = os.environ.get(\"GROQ_API_KEY\")",
          "text": "환경변수에서 Groq API 키를 꺼냄"
        },
        {
          "at": "if not api_key:",
          "text": "키가 없으면 초기에 오류를 내 한참 뒤 엉뚱한 곳에서 실패하는 것을 막음"
        },
        {
          "at": "return ChatGroq(",
          "text": "설정값으로 Groq LLM 객체를 만들어 돌려줌"
        }
      ],
      "code": "def get_llm() -> ChatGroq:\n    \"\"\"Groq LPU의 openai/gpt-oss-120b 모델로 ChatGroq 인스턴스를 생성함.\"\"\"\n    api_key = os.environ.get(\"GROQ_API_KEY\")\n    # API 키 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함\n    if not api_key:\n        raise RuntimeError(\"GROQ_API_KEY가 설정되지 않음 (hands-on/.env 확인)\")\n    # ChatGroq: temperature 0.3으로 약간의 표현 다양성 허용, 최대 2048토큰 응답\n    return ChatGroq(model=GROQ_MODEL, temperature=0.3, max_tokens=2048, api_key=api_key)"
    },
    {
      "id": "load_vectorstore",
      "name": "load_vectorstore()",
      "fileId": "main",
      "summary": "이미 만들어 둔 공용 벡터 DB를 재인덱싱 없이 그대로 연결해 돌려주는 함수임",
      "how": "PDF를 새로 읽거나 쪼개지 않고, 인덱싱이 미리 만들어 둔 결과물(컬렉션 patent_law)을 연결만 함. 컬렉션명과 임베딩 모델을 인덱싱 때와 똑같이 지정해야 저장된 벡터를 정상 검색할 수 있음. 폴더가 없으면 인덱싱을 먼저 하라는 오류를 냄",
      "terms": [
        "벡터 DB",
        "임베딩",
        "청크"
      ],
      "lines": [
        {
          "at": "def load_vectorstore",
          "text": "공용 벡터 DB를 연결하는 함수 정의"
        },
        {
          "at": "if not VECTORDB_DIR.exists():",
          "text": "벡터 DB 폴더가 있는지 확인 — 없으면 인덱싱이 필요함"
        },
        {
          "at": "embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL",
          "text": "인덱싱과 같은 모델로 질문 임베딩기를 준비함(차원·의미공간 일치)"
        },
        {
          "at": "return Chroma(",
          "text": "from_documents(신규 생성)가 아니라 기존 컬렉션을 '연결'만 함"
        },
        {
          "at": "collection_name=COLLECTION_NAME",
          "text": "어떤 컬렉션을 열지 이름으로 지정 — 빠뜨리면 빈 결과가 나옴"
        }
      ],
      "code": "def load_vectorstore() -> Chroma:\n    \"\"\"공용 벡터 DB를 임베딩(재인덱싱) 없이 로드함.\n\n    인덱싱 때와 동일한 컬렉션명(patent_law)·임베딩 모델(text-embedding-3-small)을\n    지정해야 저장된 246개 벡터를 정상 검색할 수 있음. 컬렉션명을 빠뜨리면 ChromaDB가\n    기본 컬렉션(langchain)을 새로 만들어 빈 검색 결과를 반환하므로 주의함.\n    \"\"\"\n    if not VECTORDB_DIR.exists():\n        raise FileNotFoundError(\n            f\"공용 벡터 DB를 찾을 수 없음: {VECTORDB_DIR}\\n\"\n            f\"hands-on/10.rag/indexing/indexing.py를 먼저 실행해 인덱싱을 수행하세요.\"\n        )\n    # OpenAIEmbeddings: 쿼리 문자열을 1536차원 벡터로 변환 (검색 시점에만 사용)\n    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL, api_key=os.environ.get(\"OPENAI_API_KEY\"))\n    print(f\"공용 벡터 DB 로드: {VECTORDB_DIR} (컬렉션: {COLLECTION_NAME})\")\n    return Chroma(\n        collection_name=COLLECTION_NAME,\n        persist_directory=str(VECTORDB_DIR),\n        embedding_function=embeddings,\n    )"
    },
    {
      "id": "get_retriever",
      "name": "get_retriever()",
      "fileId": "main",
      "summary": "벡터 DB를 받아 유사도 기준 상위 TOP_K개 청크를 찾아 주는 검색기(retriever)로 바꿔 주는 함수임",
      "how": "벡터 저장소를 그냥 두면 검색 흐름에 바로 꽂을 수 없어, as_retriever로 검색기 객체로 변환함. similarity(유사도) 방식으로 질문과 의미가 가까운 청크 상위 5개를 가져오도록 설정함",
      "terms": [
        "retriever",
        "유사도 검색",
        "청크",
        "벡터 DB"
      ],
      "lines": [
        {
          "at": "def get_retriever",
          "text": "벡터 DB를 검색기로 바꾸는 함수 정의"
        },
        {
          "at": "return vectorstore.as_retriever",
          "text": "유사도 상위 TOP_K개를 찾는 검색기로 변환해 돌려줌"
        }
      ],
      "code": "def get_retriever(vectorstore: Chroma):\n    \"\"\"코사인 유사도 기반으로 상위 TOP_K개 청크를 반환하는 검색기를 생성함.\"\"\"\n    return vectorstore.as_retriever(search_type=\"similarity\", search_kwargs={\"k\": TOP_K})"
    },
    {
      "id": "format_docs",
      "name": "format_docs()",
      "fileId": "main",
      "summary": "검색된 청크 여러 개를 LLM 프롬프트에 넣을 한 덩어리 문자열로 합치는 도우미 함수임",
      "how": "검색기는 문서 객체 목록을 주는데 프롬프트에는 글자로 넣어야 함. 각 청크 앞에 번호·출처 파일명·청크 번호를 붙여 LLM이 근거를 인용하기 쉽게 하고, 청크 사이는 구분선으로 띄워 문서 경계를 분명히 함",
      "terms": [
        "청크",
        "프롬프트",
        "LLM"
      ],
      "lines": [
        {
          "at": "def format_docs",
          "text": "검색된 청크 목록을 받는 도우미 함수 정의"
        },
        {
          "at": "formatted = []",
          "text": "각 청크를 문자열로 만들어 담을 빈 리스트를 준비"
        },
        {
          "at": "for i, doc in enumerate(docs, 1):",
          "text": "검색된 청크를 1번부터 번호를 매기며 하나씩 처리"
        },
        {
          "at": "formatted.append(f\"[문서 {i}]",
          "text": "출처·내용을 합친 한 청크 블록을 리스트에 추가"
        },
        {
          "at": "return \"\\n\\n---\\n\\n\".join(formatted)",
          "text": "모든 청크 블록을 구분선으로 이어 하나의 컨텍스트 문자열로 만듦"
        }
      ],
      "code": "def format_docs(docs: List[Document]) -> str:\n    \"\"\"검색된 문서들을 LLM 컨텍스트용 문자열로 합침.\"\"\"\n    formatted = []\n    for i, doc in enumerate(docs, 1):\n        source = doc.metadata.get(\"source\", \"알 수 없음\")\n        chunk_index = doc.metadata.get(\"chunk_index\", \"?\")\n        formatted.append(f\"[문서 {i}] {source} (청크 #{chunk_index})\\n{doc.page_content}\")\n    return \"\\n\\n---\\n\\n\".join(formatted)"
    },
    {
      "id": "deduplicate_docs",
      "name": "deduplicate_docs()",
      "fileId": "main",
      "summary": "여러 변형 질문 검색 결과를 합쳤을 때 본문이 똑같은 중복 청크를 한 번만 남기는 함수임 (중복 제거)",
      "how": "Multi-Query는 비슷한 질문 여러 개로 검색하므로 같은 청크가 여러 번 나올 수 있음. 본문 내용을 해시(지문)로 만들어, 이미 본 청크면 건너뛰고 처음 보는 청크만 모음(union/unique). 여러 추천 목록을 합치고 겹치는 책을 빼는 것과 같음",
      "terms": [
        "중복 제거",
        "청크"
      ],
      "lines": [
        {
          "at": "def deduplicate_docs",
          "text": "중복 청크를 제거하는 함수 정의"
        },
        {
          "at": "seen = set()",
          "text": "이미 본 청크의 '지문'을 기록할 집합을 준비"
        },
        {
          "at": "key = hash(doc.page_content)",
          "text": "본문 내용을 해시로 바꿔 같은 청크인지 판단할 지문을 만듦"
        },
        {
          "at": "if key not in seen:",
          "text": "처음 보는 청크일 때만 결과에 추가 — 중복은 건너뜀"
        },
        {
          "at": "return unique",
          "text": "중복이 제거된 고유 청크 목록을 돌려줌"
        }
      ],
      "code": "def deduplicate_docs(docs: List[Document]) -> List[Document]:\n    \"\"\"본문 내용이 동일한 중복 문서를 제거하여 고유 문서만 남김.\"\"\"\n    seen = set()\n    unique = []\n    for doc in docs:\n        # 본문 해시로 동일 청크 여부를 판단함\n        key = hash(doc.page_content)\n        if key not in seen:\n            seen.add(key)\n            unique.append(doc)\n    return unique"
    },
    {
      "id": "create_llm_chain",
      "name": "create_llm_chain()",
      "fileId": "main",
      "summary": "프롬프트 → LLM → 문자열 추출로 이어지는 LCEL 답변 체인을 만드는 함수임",
      "how": "시스템 프롬프트와 사용자 질문을 묶은 프롬프트를 만들고, LCEL 파이프(|)로 '프롬프트 → ChatGroq → StrOutputParser'를 한 줄로 연결함. 이렇게 만든 체인은 나중에 invoke로 한 번에 실행됨",
      "terms": [
        "프롬프트",
        "LLM",
        "LCEL",
        "invoke"
      ],
      "lines": [
        {
          "at": "def create_llm_chain",
          "text": "답변 생성 체인을 만드는 함수 정의"
        },
        {
          "at": "prompt = ChatPromptTemplate.from_messages([",
          "text": "시스템 지시문과 사용자 질문을 하나의 프롬프트로 구성"
        },
        {
          "at": "return prompt | llm | StrOutputParser()",
          "text": "LCEL 파이프(|)로 프롬프트→LLM→문자열파서를 한 줄로 연결"
        }
      ],
      "code": "def create_llm_chain(llm):\n    \"\"\"프롬프트 → LLM → 문자열 추출로 이어지는 LCEL 답변 체인을 생성함.\"\"\"\n    prompt = ChatPromptTemplate.from_messages([\n        (\"system\", SYSTEM_PROMPT),\n        (\"human\", \"{question}\"),\n    ])\n    # LCEL(|) 파이프: 프롬프트 렌더 → ChatGroq 호출 → StrOutputParser로 문자열만 추출\n    return prompt | llm | StrOutputParser()"
    },
    {
      "id": "multi_query",
      "name": "multi_query()  ← 이 예제의 핵심",
      "fileId": "main",
      "summary": "원본 질문 하나를 LLM으로 다양한 관점의 변형 질문 3개로 확장해, 원본 포함 총 4개의 질문을 돌려주는 함수임 (Multi-Query / Query Transformation)",
      "how": "변형 질문을 만들라는 전용 프롬프트를 LLM에 넣어 표현이 다른 질문 여러 개를 받음. LLM 응답을 줄 단위로 잘라 빈 줄을 빼고, 맨 앞에 원본 질문을 더한 뒤 최대 4개로 자름. 표현이 다양해질수록 좋은 자료를 놓칠 확률이 줄어드는, 이 예제의 핵심 단계임",
      "terms": [
        "Multi-Query",
        "Query Transformation",
        "LLM",
        "프롬프트",
        "LCEL",
        "invoke"
      ],
      "lines": [
        {
          "at": "def multi_query",
          "text": "변형 질문을 만드는 핵심 함수 정의"
        },
        {
          "at": "multi_prompt = ChatPromptTemplate.from_template",
          "text": "'질문을 3개로 변형하라'고 지시하는 전용 프롬프트를 만듦"
        },
        {
          "at": "chain = multi_prompt | llm | StrOutputParser()",
          "text": "LCEL 파이프로 변형 질문 생성용 체인을 구성"
        },
        {
          "at": "result = chain.invoke({\"question\": question})",
          "text": "체인을 invoke로 실행해 LLM이 만든 변형 질문 텍스트를 받음"
        },
        {
          "at": "variants = [q.strip()",
          "text": "응답을 줄 단위로 잘라 빈 줄을 빼고 변형 질문 목록으로 정리"
        },
        {
          "at": "queries = [question] + variants",
          "text": "맨 앞에 원본 질문을 더해 원본+변형을 한 목록으로 합침"
        },
        {
          "at": "return queries[:4]",
          "text": "원본 포함 최대 4개(원본 1 + 변형 3)로 잘라 돌려줌"
        }
      ],
      "code": "def multi_query(llm, question: str) -> List[str]:\n    \"\"\"원본 질문을 다양한 관점의 변형 질문 3개로 확장함 (원본 포함 총 4개 반환).\n\n    하나의 질문을 동의어·다른 문장 구조로 재구성해 더 넓은 범위의 관련 문서를 검색함.\n    \"\"\"\n    multi_prompt = ChatPromptTemplate.from_template(\"\"\"당신은 법률 문서 검색을 위한 질문 생성 전문가입니다.\n\n주어진 질문에 대해 다양한 관점에서 3개의 변형 질문을 생성하세요.\n각 변형 질문은 같은 정보를 찾지만 다른 방식으로 표현합니다.\n\n## 변형 규칙:\n1. 동의어나 유사 표현 사용\n2. 질문 구조 변경\n3. 구체적/추상적 수준 조절\n4. 각 질문은 한 줄로 작성 (번호 없이)\n\n## 원본 질문:\n{question}\n\n## 변형 질문 (한 줄에 하나씩):\"\"\")\n    chain = multi_prompt | llm | StrOutputParser()\n    result = chain.invoke({\"question\": question})\n    # 줄 단위로 분리해 빈 줄을 제거함\n    variants = [q.strip() for q in result.strip().split(\"\\n\") if q.strip()]\n    # 원본 질문을 맨 앞에 추가하고 최대 4개(원본+변형 3개)로 제한함\n    queries = [question] + variants\n    return queries[:4]"
    },
    {
      "id": "retrieve_with_transformation",
      "name": "retrieve_with_transformation()",
      "fileId": "main",
      "summary": "변형 질문들로 각각 검색한 결과를 모두 합치고 중복을 제거한 뒤 상위 TOP_K개 청크를 돌려주는 함수임",
      "how": "multi_query로 만든 질문 4개를 하나씩 retriever.invoke로 검색해 결과를 모두 모음(union). 그다음 deduplicate_docs로 중복을 제거하고 상위 5개만 남김. 어떤 질문들로 검색했는지 정보도 함께 돌려줌",
      "terms": [
        "retriever",
        "invoke",
        "유사도 검색",
        "중복 제거",
        "청크",
        "Query Transformation"
      ],
      "lines": [
        {
          "at": "def retrieve_with_transformation",
          "text": "변형 검색 + 합치기 + 중복 제거를 담당하는 함수 정의"
        },
        {
          "at": "queries = multi_query(llm, question)",
          "text": "원본+변형 질문 4개를 만들어 받음"
        },
        {
          "at": "for q in queries:",
          "text": "각 변형 질문을 하나씩 검색하기 위해 반복함"
        },
        {
          "at": "all_docs.extend(retriever.invoke(q))",
          "text": "질문마다 검색한 청크들을 한 목록으로 모두 모음(union)"
        },
        {
          "at": "docs = deduplicate_docs(all_docs)[:TOP_K]",
          "text": "중복을 제거하고 상위 TOP_K(5)개만 남김"
        },
        {
          "at": "info = {\"original\": question, \"queries\": queries}",
          "text": "원본 질문과 실제 검색에 쓴 질문 목록을 정보로 묶음"
        }
      ],
      "code": "def retrieve_with_transformation(vectorstore: Chroma, llm, question: str):\n    \"\"\"여러 변형 질문으로 각각 검색한 결과를 합치고 중복 제거 후 상위 TOP_K개를 반환함.\"\"\"\n    retriever = get_retriever(vectorstore)\n    queries = multi_query(llm, question)\n    all_docs = []\n    # 각 변형 질문으로 검색해 결과를 모두 모음\n    for q in queries:\n        all_docs.extend(retriever.invoke(q))\n    docs = deduplicate_docs(all_docs)[:TOP_K]\n    info = {\"original\": question, \"queries\": queries}\n    return docs, info"
    },
    {
      "id": "display_transform_info",
      "name": "display_transform_info()",
      "fileId": "main",
      "summary": "원본 질문과 LLM이 생성한 변형 질문 목록을 화면에 보기 좋게 출력하는 함수임",
      "how": "사용자가 '어떤 질문들로 검색했는지' 직접 확인할 수 있도록 원본 질문과 변형 질문들을 번호와 함께 출력함. Multi-Query가 실제로 어떻게 동작했는지 눈으로 보여 주는 부분임",
      "terms": [
        "Multi-Query"
      ],
      "lines": [
        {
          "at": "def display_transform_info",
          "text": "변형 질문 목록을 출력하는 함수 정의"
        },
        {
          "at": "print(f\"원본 질문: {info['original']}\")",
          "text": "사용자가 처음 입력한 원본 질문을 출력"
        },
        {
          "at": "for i, q in enumerate(info[\"queries\"], 1):",
          "text": "실제 검색에 쓴 질문들을 번호와 함께 하나씩 출력"
        }
      ],
      "code": "def display_transform_info(info: dict) -> None:\n    \"\"\"원본 질문과 생성된 변형 질문 목록을 표시함.\"\"\"\n    print(\"\\n\" + \"=\" * 60)\n    print(\"Multi-Query (다중 질문 생성)\")\n    print(\"=\" * 60)\n    print(f\"원본 질문: {info['original']}\")\n    print(\"-\" * 60)\n    print(\"검색에 사용한 질문들:\")\n    for i, q in enumerate(info[\"queries\"], 1):\n        print(f\"  {i}. {q}\")\n    print(\"=\" * 60)"
    },
    {
      "id": "answer_question",
      "name": "answer_question()",
      "fileId": "main",
      "summary": "변형 → 검색 → 합치기/중복 제거 → 컨텍스트 주입 → 답변 생성의 전체 흐름을 한 번에 수행하고 출력하는 함수임",
      "how": "retrieve_with_transformation으로 변형 검색·중복 제거를 끝낸 청크를 받고, 변형 질문 목록과 검색된 청크를 화면에 보여 줌. 그다음 format_docs로 만든 컨텍스트와 질문을 답변 체인에 invoke로 넣어 최종 답변을 생성·출력함",
      "terms": [
        "Query Transformation",
        "청크",
        "프롬프트",
        "invoke",
        "LLM"
      ],
      "lines": [
        {
          "at": "def answer_question",
          "text": "검색부터 답변까지 전체 흐름을 수행하는 함수 정의"
        },
        {
          "at": "docs, info = retrieve_with_transformation",
          "text": "변형 검색·합치기·중복 제거를 끝낸 청크와 질문 정보를 받음"
        },
        {
          "at": "display_transform_info(info)",
          "text": "어떤 변형 질문으로 검색했는지 화면에 보여 줌"
        },
        {
          "at": "print(format_chunks_for_display(docs))",
          "text": "근거로 쓸 검색된 청크들을 미리보기로 보여 줌"
        },
        {
          "at": "context = format_docs(docs)",
          "text": "검색된 청크들을 프롬프트에 넣을 한 덩어리 문자열로 합침"
        },
        {
          "at": "response = llm_chain.invoke(",
          "text": "컨텍스트와 질문을 답변 체인에 넣어 최종 답변을 생성"
        }
      ],
      "code": "def answer_question(vectorstore: Chroma, llm, llm_chain, question: str) -> None:\n    \"\"\"Query Transformation → 검색 → 컨텍스트 주입 → 답변 생성의 전체 흐름을 수행하고 출력함.\"\"\"\n    print(\"\\nQuery Transformation 적용 중...\")\n    docs, info = retrieve_with_transformation(vectorstore, llm, question)\n\n    display_transform_info(info)\n\n    print(\"\\n\" + \"=\" * 60)\n    print(f\"검색된 청크 ({len(docs)}개)\")\n    print(\"=\" * 60)\n    print(format_chunks_for_display(docs))\n    print(\"=\" * 60)\n\n    print(\"\\n답변 생성 중...\\n\")\n    context = format_docs(docs)\n    response = llm_chain.invoke({\"context\": context, \"question\": question})\n    print(\"-\" * 60)\n    print(response)\n    print(\"-\" * 60)"
    },
    {
      "id": "main",
      "name": "main()",
      "fileId": "main",
      "summary": "벡터 DB 로드 → LLM 준비 → 답변 체인 생성 후, 인자에 따라 one-shot 또는 대화형으로 실행하는 진입점 함수임",
      "how": "명령줄 인자를 읽어 --query가 있으면 1회 실행, --demo면 기본 질의어로 1회 실행, 둘 다 없으면 대화형 챗봇 모드로 돌림. 시작 시 벡터 DB·LLM·답변 체인을 준비하고, 준비 중 오류가 나면 메시지를 출력하고 종료함",
      "terms": [
        "벡터 DB",
        "LLM",
        "LCEL"
      ],
      "lines": [
        {
          "at": "def main",
          "text": "전체 파이프라인을 실행하는 진입점 함수 정의"
        },
        {
          "at": "vectorstore = load_vectorstore()",
          "text": "공용 벡터 DB를 연결"
        },
        {
          "at": "llm = get_llm()",
          "text": "답변·변형 질문 생성용 LLM을 준비"
        },
        {
          "at": "llm_chain = create_llm_chain(llm)",
          "text": "프롬프트→LLM→파서로 이어지는 답변 체인을 준비"
        },
        {
          "at": "if args.demo:",
          "text": "--demo면 기본 테스트 질의어로 1회 실행"
        },
        {
          "at": "elif args.query is not None:",
          "text": "--query가 주어지면 그 질문으로 1회 실행"
        },
        {
          "at": "chat(vectorstore, llm, llm_chain)",
          "text": "인자가 없으면 대화형 챗봇 모드로 실행"
        }
      ],
      "code": "def main() -> None:\n    \"\"\"--query 인자가 있으면 one-shot, 없으면 대화형으로 실행함.\"\"\"\n    parser = argparse.ArgumentParser(description=\"Multi-Query Query Transformation RAG 예제\")\n    # --query 지정 시 비대화형 1회 실행 (자동 테스트·데모에 사용)\n    parser.add_argument(\"--query\", type=str, default=None, help=\"one-shot 질의어 (미지정 시 대화형 모드)\")\n    parser.add_argument(\"--demo\", action=\"store_true\", help=\"기본 테스트 질의어로 one-shot 실행\")\n    args = parser.parse_args()\n\n    try:\n        vectorstore = load_vectorstore()\n        llm = get_llm()\n        llm_chain = create_llm_chain(llm)\n    except (FileNotFoundError, RuntimeError) as e:\n        print(f\"\\n[오류] {e}\")\n        sys.exit(1)\n\n    if args.demo:\n        run_once(vectorstore, llm, llm_chain, TEST_QUERY)\n    elif args.query is not None:\n        run_once(vectorstore, llm, llm_chain, args.query)\n    else:\n        chat(vectorstore, llm, llm_chain)"
    }
  ],
  "glossary": {
    "Multi-Query": "하나의 질문을 여러 표현의 질문으로 바꿔 각각 검색한 뒤 결과를 합치는 RAG 기법임. 표현 차이로 좋은 자료를 놓치는 문제를 줄여 줌",
    "Query Transformation": "질의 변환. 사용자의 원래 질문을 검색에 더 유리한 형태(여러 표현, 더 명확한 문장 등)로 바꾸는 과정임. Multi-Query는 그 한 방법임",
    "임베딩": "글자(텍스트)를 컴퓨터가 의미로 비교할 수 있게 숫자 목록(벡터)으로 바꾼 것임. 의미가 비슷하면 숫자도 가까워짐",
    "유사도 검색": "질문과 의미가 가장 비슷한 자료를 벡터(숫자) 거리로 찾아 주는 검색 방식임",
    "retriever": "질문을 받아 벡터 DB에서 관련 청크를 찾아 돌려주는 검색 담당 부품임",
    "청크": "긴 문서를 검색하기 좋게 잘라 둔 작은 글 조각임. 한 조각씩 따로 검색되고 답변 근거로 쓰임",
    "벡터 DB": "임베딩(숫자 목록)들을 저장해 두고 비슷한 것을 빠르게 찾아 주는 데이터베이스임. 이 예제는 ChromaDB를 사용함",
    "LLM": "사람의 말을 이해하고 글로 답해 주는 대형 언어 모델임. 여기서는 변형 질문 생성과 최종 답변 작성을 맡음",
    "프롬프트": "LLM에게 무엇을 어떻게 답하라고 지시하는 입력 문장(틀)임",
    "LCEL": "LangChain Expression Language. 파이프 기호(|)로 단계들을 이어 하나의 실행 흐름(체인)으로 묶는 LangChain 문법임",
    "invoke": "만들어 둔 체인(흐름)이나 검색기를 실제로 한 번 실행시켜 결과를 받아 오는 명령임",
    "중복 제거": "여러 검색 결과를 합칠 때 같은 청크가 겹치면 한 번만 남기는 처리임(union/unique). 자료 묶음을 깔끔하게 정리함"
  }
};
