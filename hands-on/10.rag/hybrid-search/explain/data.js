window.EXPLAIN_DATA = {
  "meta": {
    "title": "Hybrid Search — 키워드+의미 검색 결합",
    "entry": "app.py"
  },
  "files": [
    {
      "id": "main",
      "label": "app.py",
      "role": "공용 벡터 DB를 BM25(키워드)+Dense(의미) 두 검색기로 함께 찾고, 그 결과를 RRF로 융합해 LLM이 근거 기반 답변을 만드는 CLI RAG 전체"
    }
  ],
  "flow": [
    {
      "step": 1,
      "title": "실행 & 환경 준비",
      "summary": "python app.py 로 실행하고, .env 의 API 키를 불러옴",
      "detail": "터미널에서 'python app.py' 또는 'python app.py \"질문\"' 으로 실행함. 시작과 동시에 load_dotenv() 가 hands-on/.env 에 적어 둔 OPENAI_API_KEY(질의 임베딩용)와 GROQ_API_KEY(LLM용)를 읽어 둠. 한글 출력이 깨지지 않게 표준출력을 UTF-8로 맞추고, 라이브러리의 불필요한 경고도 숨김. 비유하면, 사서(앱)가 출근해 책상에 두 개의 열쇠(임베딩 열쇠·답변 열쇠)를 챙겨 두는 단계."
    },
    {
      "step": 2,
      "title": "벡터 DB 로드 + BM25 코퍼스 준비",
      "summary": "공용 벡터 DB를 '재임베딩 없이' 연결하고, 그 안의 원문 청크를 꺼내 BM25용 자료로 재사용함",
      "detail": "이 예제는 PDF를 새로 읽거나 쪼개지 않음. 그 작업(인덱싱)은 ../indexing 이 미리 해 두었고, 여기서는 결과물인 공용 ChromaDB(컬렉션 patent_law)를 연결만 함. 그런데 BM25(키워드 검색)는 '벡터'가 아니라 '원문 글자'로 색인을 만들기 때문에, DB에 함께 저장돼 있던 청크 원문을 다시 꺼내(다시 임베딩하지 않음) BM25용 자료(코퍼스)로 재활용함. 비유하면, 같은 책장(서가)을 두 가지 방법으로 찾을 준비를 하는 것 — 하나는 좌표(벡터)로, 하나는 책에 적힌 글자(원문)로."
    },
    {
      "step": 3,
      "title": "두 검색기 + 융합 검색기 구성",
      "summary": "Dense(의미)·BM25(키워드) 검색기를 각각 만들고, 둘을 합치는 Hybrid(앙상블) 검색기를 만듦",
      "detail": "세 종류 검색기를 준비함. ① Dense: 질문을 벡터로 바꿔 의미가 가까운 청크를 찾음(임베딩 기반). ② BM25(Sparse): 글자가 겹치는 정도(키워드)로 찾음 — 한국어는 '특허를/특허는'이 다 다른 단어로 취급되므로, 형태소 분석기(kiwipiepy)로 '특허'처럼 어근만 떼어 맞춤률을 높임. ③ Hybrid: 두 검색기를 묶은 EnsembleRetriever 로, 각자 찾은 순위를 RRF(역순위 융합)로 점수화한 뒤 합침. 비유하면, '뜻으로 찾는 사서'와 '단어로 찾는 사서'를 한 팀으로 묶어, 둘이 같이 추천한 책은 더 위로 올려 주는 것."
    },
    {
      "step": 4,
      "title": "LLM 준비",
      "summary": "답변을 생성할 Groq LLM(gpt-oss-120b)을 준비함",
      "detail": "검색한 근거를 바탕으로 실제 문장을 써 줄 LLM을 준비함. Groq LPU에서 서빙하는 openai/gpt-oss-120b 를 쓰며, 추론 과정이 답에 섞이지 않도록 reasoning_format=\"hidden\" 으로 최종 답변만 받음. temperature=0 이라 같은 질문엔 같은 답을 냄. 비유하면, 자료를 보고 답을 써 줄 '글쓰는 직원'을 부르는 단계."
    },
    {
      "step": 5,
      "title": "Hybrid 탐색 (Retrieve)",
      "summary": "Hybrid 검색기로 질문을 던져 Dense+BM25 융합 결과를 가져옴",
      "detail": "answer_query 안에서 hybrid_retriever.invoke(query) 를 호출하면, 내부적으로 두 검색기가 각자 상위 5개씩 찾고 그 순위를 RRF로 합쳐 하나의 목록으로 돌려줌(중복 제거 후 최대 10건). 두 검색기가 공통으로 찾은 청크는 점수가 합산되어 위로 올라옴 — 이것이 Hybrid의 핵심 이득. 비유하면, 두 사서가 따로 뽑아 온 추천 목록을 합쳐, 둘 다 추천한 책을 맨 위에 두는 것."
    },
    {
      "step": 6,
      "title": "생성 (Generate)",
      "summary": "융합으로 찾은 청크를 근거로 넣어 LLM이 답을 만듦",
      "detail": "찾아온 청크들을 [출처] 라벨과 함께 '컨텍스트'로 프롬프트에 채우고, LLM이 그 근거만 바탕으로 답을 생성함. 프롬프트에 '문서에 없으면 추측하지 말 것'이라는 규칙이 있어 지어내기(환각)를 줄임. 이 조립은 LCEL 파이프(prompt | llm | StrOutputParser)로 이뤄짐. 비유하면, 사서들이 뽑아 온 카드만 보고 질문에 답을 적어 주는 것."
    },
    {
      "step": 7,
      "title": "검색 비교 + 결과 출력",
      "summary": "Dense·BM25·Hybrid 결과를 나란히 보여 주고, 최종 답변과 '검색 출처'를 표시",
      "detail": "먼저 같은 질문에 대해 Dense·BM25·Hybrid 가 각각 어떤 청크를 골랐는지 나란히 출력해, 융합이 어떻게 두 결과를 합쳤는지(특히 공통 청크가 어떻게 상위로 올라갔는지) 눈으로 확인하게 함. 이어 최종 답변과 근거 청크(파일명·청크 번호·앞부분 미리보기)를 보여 줌. 비유하면, '뜻으로 찾은 목록·단어로 찾은 목록·합친 목록'을 같이 펼쳐 보여 주고, 답안과 참고 카드 목록을 함께 제출하는 것."
    }
  ],
  "functions": [
    {
      "id": "setup",
      "name": "임포트·경로·상수 설정",
      "fileId": "main",
      "summary": "필요한 모듈을 가져오고, 파일 위치 기준으로 경로를 잡고, .env 키와 핵심 상수(가중치 포함)를 준비하는 부분.",
      "how": "함수가 아니라 파일 위쪽의 준비 코드 모음임. ① from __future__ import annotations 로 타입 힌트를 가볍게 쓰고, 표준출력을 UTF-8로 맞추며, BM25 관련 라이브러리 경고를 숨김. ② 모든 경로를 이 파일 위치(__file__) 기준으로 계산해 어디서 실행해도 같은 공용 벡터 DB와 .env 를 가리키게 함. ③ load_dotenv 로 키를 올리고, 컬렉션명·임베딩 모델·LLM 모델·TOP_K 와 더불어 Hybrid 핵심 설정인 두 검색기 가중치(DENSE_WEIGHT·BM25_WEIGHT)·기본 질의어·프롬프트를 정함. 임베딩 모델은 인덱싱 때와 반드시 같아야 검색이 성립함.",
      "terms": [
        "from __future__ import annotations",
        "Path(__file__).resolve().parent",
        "load_dotenv",
        "청크",
        "벡터 DB",
        "ChromaDB",
        "임베딩",
        "text-embedding-3-small",
        "top-k",
        "가중치(weights)",
        "프롬프트"
      ],
      "lines": [
        {
          "at": "from __future__ import annotations",
          "text": "타입 힌트를 문자열로 평가해 가볍게 쓰게 하는 파이썬 설정."
        },
        {
          "at": "import re",
          "text": "정규식(폴백 토크나이저)을 쓰기 위한 기본 모듈."
        },
        {
          "at": "sys.stdout.reconfigure(encoding",
          "text": "윈도우 콘솔에서 한글이 깨지지 않도록 출력 인코딩을 UTF-8로 바꿈."
        },
        {
          "at": "warnings.filterwarnings(",
          "text": "BM25 라이브러리의 불필요한 경고만 숨겨 학습용 콘솔을 깔끔하게 유지."
        },
        {
          "at": "SCRIPT_DIR = Path(__file__)",
          "text": "이 파일이 있는 폴더(hybrid-search/)를 절대경로로 구함 — 실행 위치와 무관하게 동작."
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
          "at": "TOP_K = 5",
          "text": "각 검색기(Dense·BM25)가 가져올 상위 청크 개수를 5개로 정함(top-k)."
        },
        {
          "at": "DENSE_WEIGHT = 0.5",
          "text": "융합 시 Dense(의미 검색) 결과에 줄 비중 — 본 예제는 균형값 0.5."
        },
        {
          "at": "BM25_WEIGHT = 0.5",
          "text": "융합 시 BM25(키워드 검색) 결과에 줄 비중 — 본 예제는 균형값 0.5."
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
      "code": "from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함\n\nimport re\nimport sys\nimport warnings\nfrom pathlib import Path\n\n# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함\nif hasattr(sys.stdout, \"reconfigure\"):\n    sys.stdout.reconfigure(encoding=\"utf-8\")\n\n# BM25Retriever는 아직 langchain_community에만 존재하여 import 시 패키지 sunset 경고가 출력됨.\n# 기능에는 영향이 없으므로 학습용 콘솔이 깔끔하도록 해당 DeprecationWarning만 숨김.\nwarnings.filterwarnings(\"ignore\", message=r\".*langchain-community.*sunset.*\")\n\n# ---------------------------------------------------------------------------\n# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)\n# ---------------------------------------------------------------------------\nSCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(hybrid-search/)를 절대경로로 구함\nRAG_DIR = SCRIPT_DIR.parent                     # hands-on/10.rag/\nVECTORDB_DIR = RAG_DIR / \"vectordb\"             # 공용 ChromaDB 영속화 디렉터리 (8.0 인덱싱으로 생성)\nENV_PATH = RAG_DIR.parent / \".env\"              # hands-on/.env (API 키 보관)\n\n# ---------------------------------------------------------------------------\n# 환경변수 로드\n# ---------------------------------------------------------------------------\nfrom dotenv import load_dotenv\n\nload_dotenv(ENV_PATH)  # .env에서 OPENAI_API_KEY(질의 임베딩)·GROQ_API_KEY(LLM)를 로드함\n\n# ---------------------------------------------------------------------------\n# 상수 정의\n# ---------------------------------------------------------------------------\nCOLLECTION_NAME = \"patent_law\"               # 공용 벡터 DB 컬렉션명 (인덱싱과 동일해야 검색 가능)\nEMBEDDING_MODEL = \"text-embedding-3-small\"   # 질의 임베딩 모델 (인덱싱과 반드시 동일, 1536차원)\nLLM_MODEL = \"openai/gpt-oss-120b\"            # Groq LPU에서 서빙하는 답변 생성용 LLM\nTOP_K = 5                                    # 각 검색기가 반환할 상위 청크 수\n\n# Hybrid 가중치: 두 검색기의 RRF 점수에 곱해지는 비중 (합이 1일 필요는 없으나 관례상 1.0으로 맞춤)\n# 법령 문서는 조문 번호·전문 용어 등 정확한 키워드 매칭이 중요하므로 BM25에 비중을 약간 더 둘 수도 있음.\n# 본 예제는 교재 기본값인 균형 가중치(0.5/0.5)를 사용함 (README의 가중치 조정 가이드 참고).\nDENSE_WEIGHT = 0.5                           # Dense(임베딩 의미 검색) 가중치\nBM25_WEIGHT = 0.5                            # Sparse(BM25 키워드 검색) 가중치\n\nDEFAULT_QUERY = \"특허를 받을 수 있는 조건은 ?\"  # 인자 미지정 시 사용할 기본 질의어 (교재 8.3 테스트 질의어)\n\n# 검색된 문서에 근거해서만 답하도록 제약하는 RAG 프롬프트\n# context에는 검색된 청크들이, question에는 사용자 질의어가 주입됨\nSYSTEM_PROMPT = (\n    \"당신은 대한민국 특허법 문서를 근거로 답변하는 RAG 어시스턴트임. \"\n    \"반드시 아래 [참고 문서]에 있는 내용만 근거로 답변하고, 문서에 없는 내용은 추측하지 말 것. \"\n    \"근거를 찾을 수 없으면 '제공된 문서에서 관련 내용을 찾을 수 없습니다.'라고 답할 것. \"\n    \"답변은 한국어로 간결하게 작성하고, 가능하면 근거가 된 조문을 함께 언급할 것.\"\n)\nHUMAN_PROMPT = \"[참고 문서]\\n{context}\\n\\n[질문]\\n{question}\\n\\n[답변]\""
    },
    {
      "id": "build_bm25_tokenizer",
      "name": "build_bm25_tokenizer()",
      "fileId": "main",
      "summary": "BM25(키워드 검색)가 한국어를 잘 다루도록, 문장을 어근 단위로 쪼개는 '토크나이저' 함수를 만들어 돌려주는 함수.",
      "how": "BM25는 글자가 겹치는 정도로 찾기 때문에 '단어를 어떻게 쪼개느냐(토큰화)'가 검색 품질을 좌우함. 기본값인 공백 분리는 교착어인 한국어에 부적합함('특허를/특허는'을 다른 단어로 봄). ① kiwipiepy(Kiwi) 형태소 분석기가 있으면 '특허+를 → 특허'처럼 조사·어미를 떼어 어근 토큰을 만드는 함수를 돌려줌. ② kiwipiepy 가 없으면 정규식([가-힣]+|[a-zA-Z0-9]+)으로 한글·영숫자 덩어리만 뽑는 폴백 함수를 돌려줘, 어떤 환경에서도 예제가 실행되게 함.",
      "terms": [
        "BM25",
        "Sparse Retrieval(키워드/희소 검색)",
        "kiwipiepy(형태소 분석기)",
        "토크나이저",
        "정규식 폴백"
      ],
      "lines": [
        {
          "at": "def build_bm25_tokenizer():",
          "text": "BM25용 한국어 토크나이저 함수를 만들어 돌려주는 함수 정의."
        },
        {
          "at": "from kiwipiepy import Kiwi",
          "text": "한국어 형태소 분석기 kiwipiepy 를 가져옴(설치돼 있을 때만 성공)."
        },
        {
          "at": "kiwi = Kiwi()",
          "text": "형태소 분석기 객체를 생성함."
        },
        {
          "at": "return [token.form for token in kiwi.tokenize(text)]",
          "text": "문장을 형태소로 쪼개 어근 토큰 문자열 목록을 반환함."
        },
        {
          "at": "except Exception as error:",
          "text": "kiwipiepy 가 없거나 실패하면 폴백 토크나이저로 넘어감."
        },
        {
          "at": "token_pattern = re.compile",
          "text": "한글 덩어리와 영숫자 덩어리만 뽑는 정규식을 준비함(구두점 제거)."
        },
        {
          "at": "return token_pattern.findall(text)",
          "text": "정규식으로 토큰을 뽑아 반환하는 폴백 토크나이저."
        }
      ],
      "code": "def build_bm25_tokenizer():\n    \"\"\"BM25용 한국어 토크나이저 함수를 생성하여 반환함.\n\n    BM25는 텍스트를 토큰(단어) 단위로 쪼개 빈도를 세는 알고리즘임. 기본 토크나이저는\n    공백 분리(text.split())라 한국어에 부적합함. 한국어는 교착어라 \"특허를/특허는/특허의\"가\n    모두 다른 토큰이 되어 \"특허\" 매칭에 실패하기 때문임.\n    형태소 분석기(kiwipiepy)로 \"특허+를 → 특허\"처럼 어근을 분리하면 키워드 매칭률이 크게 향상됨.\n    kiwipiepy 미설치 시에는 정규식 기반 폴백 토크나이저를 사용해 예제가 항상 실행되도록 함.\n    \"\"\"\n    try:\n        # Kiwi: 한국어 형태소 분석기 (조사·어미를 분리하여 어근 토큰을 추출)\n        from kiwipiepy import Kiwi\n\n        kiwi = Kiwi()\n\n        def tokenize(text: str) -> list[str]:\n            # kiwi.tokenize()는 형태소 객체 리스트를 반환하며, .form이 표면형 토큰 문자열임\n            return [token.form for token in kiwi.tokenize(text)]\n\n        print(\"  - BM25 토크나이저: kiwipiepy 형태소 분석 (한국어 최적화)\")\n        return tokenize\n    except Exception as error:\n        # 정규식 폴백: 한글 음절 덩어리와 영숫자 덩어리만 추출 (구두점 제거로 공백 분리보다 개선)\n        print(f\"  - BM25 토크나이저: 정규식 폴백 사용 (kiwipiepy 미사용: {error})\")\n        token_pattern = re.compile(r\"[가-힣]+|[a-zA-Z0-9]+\")\n\n        def tokenize(text: str) -> list[str]:\n            return token_pattern.findall(text)\n\n        return tokenize"
    },
    {
      "id": "load_vectorstore",
      "name": "load_vectorstore()",
      "fileId": "main",
      "summary": "이미 만들어진 공용 ChromaDB를 재임베딩 없이 연결해 'vectorstore(벡터 저장소)'로 돌려주는 함수.",
      "how": "Dense(의미) 검색의 토대를 준비함. 새로 인덱싱하지 않고 인덱싱(../indexing)이 만들어 둔 영속 컬렉션을 그대로 연결함. ① 질의 임베딩에 OpenAI 키가 필요하므로 없으면 즉시 오류를 냄. ② 벡터 DB 폴더가 있는지 확인함. ③ 인덱싱과 동일한 임베딩 모델로 OpenAIEmbeddings 를 만들고, Chroma(...) 생성자로 기존 컬렉션을 연결함(from_documents 가 아님 = 재인덱싱 안 함). ④ 저장된 벡터가 0개면 오류를 내고, 정상이면 vectorstore 객체를 돌려줌.",
      "terms": [
        "ChromaDB",
        "Chroma",
        "벡터 DB",
        "임베딩",
        "OpenAIEmbeddings",
        "text-embedding-3-small",
        "API 키 검사"
      ],
      "lines": [
        {
          "at": "def load_vectorstore():",
          "text": "공용 벡터 DB를 연결해 돌려주는 함수 정의."
        },
        {
          "at": "from langchain_chroma import Chroma",
          "text": "ChromaDB를 다루는 LangChain 래퍼를 가져옴."
        },
        {
          "at": "from langchain_openai import OpenAIEmbeddings",
          "text": "질의를 벡터로 바꿀 임베딩 도구를 가져옴."
        },
        {
          "at": "if not os.getenv(\"OPENAI_API_KEY\"):",
          "text": "OpenAI 키가 없으면 곧바로 명확한 오류를 냄(질의 임베딩 필수)."
        },
        {
          "at": "if not VECTORDB_DIR.exists():",
          "text": "벡터 DB 폴더가 없으면 인덱싱 먼저 하라고 안내하며 중단."
        },
        {
          "at": "embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)",
          "text": "인덱싱과 동일한 임베딩 모델로 질의 임베딩 도구를 만듦."
        },
        {
          "at": "vectorstore = Chroma(",
          "text": "영속화된 컬렉션을 그대로 연결함(재인덱싱하지 않음)."
        },
        {
          "at": "count = vectorstore._collection.count()",
          "text": "컬렉션에 저장된 벡터 개수를 셈(비어 있는지 확인용)."
        },
        {
          "at": "return vectorstore",
          "text": "연결된 벡터 저장소 객체를 돌려줌."
        }
      ],
      "code": "def load_vectorstore():\n    \"\"\"공용 ChromaDB를 재임베딩 없이 로드하여 vectorstore를 반환함.\n\n    Chroma(...) 생성자: from_documents(신규 인덱싱)와 달리 이미 영속화된 컬렉션을 그대로 연결함.\n    embedding_function에 인덱싱과 동일한 모델을 지정해야 질의 임베딩의 의미 공간이 일치하여\n    Dense 검색이 정상 동작함.\n    \"\"\"\n    import os\n\n    from langchain_chroma import Chroma\n    from langchain_openai import OpenAIEmbeddings\n\n    # 질의 임베딩에 OpenAI API가 필요하므로 키 부재 시 즉시 명확한 오류를 발생시킴\n    if not os.getenv(\"OPENAI_API_KEY\"):\n        raise RuntimeError(f\"OPENAI_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요\")\n\n    # 인덱싱이 선행되어야 검색 가능하므로 영속 디렉터리 존재 여부를 먼저 확인함\n    if not VECTORDB_DIR.exists():\n        raise FileNotFoundError(\n            f\"공용 벡터 DB가 없음: {VECTORDB_DIR}\\n\"\n            f\"먼저 ../indexing/indexing.py 로 인덱싱을 수행해야 함\"\n        )\n\n    # OpenAIEmbeddings: 텍스트를 1536차원 벡터로 변환 (질의 임베딩에 사용, OPENAI_API_KEY 자동 참조)\n    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)\n\n    # Chroma: 영속화된 벡터 컬렉션을 연결하는 LangChain 벡터 저장소 래퍼\n    vectorstore = Chroma(\n        collection_name=COLLECTION_NAME,\n        embedding_function=embeddings,\n        persist_directory=str(VECTORDB_DIR),\n    )\n\n    # ._collection.count(): 컬렉션에 저장된 벡터 개수. 0이면 인덱싱이 비었음을 뜻함\n    count = vectorstore._collection.count()\n    if count == 0:\n        raise ValueError(f\"벡터 DB가 비어 있음 (컬렉션 '{COLLECTION_NAME}'). 인덱싱 재실행 필요\")\n    print(f\"  - 벡터 DB 로드 완료: {count}개 벡터 (컬렉션 '{COLLECTION_NAME}')\")\n\n    return vectorstore"
    },
    {
      "id": "load_corpus_from_vectorstore",
      "name": "load_corpus_from_vectorstore()",
      "fileId": "main",
      "summary": "벡터 DB에 함께 저장된 원문 청크 전체를 꺼내 Document 리스트로 복원하는 함수 — BM25용 자료(코퍼스).",
      "how": "BM25(키워드 검색)는 벡터가 아니라 원문 글자로 색인을 만들기 때문에, 청크 원문이 필요함. 공용 DB는 Dense 용으로 만들어졌지만 청크 원문과 메타데이터도 함께 저장하므로, ._collection.get(include=[\"documents\",\"metadatas\"]) 로 임베딩을 제외한 원문·메타데이터만 일괄 조회함(문서를 다시 임베딩하지 않음). 꺼낸 원문과 메타데이터를 짝지어 LangChain 표준 문서 객체 Document 로 복원해 BM25 코퍼스로 재사용함.",
      "terms": [
        "청크",
        "코퍼스(corpus)",
        "Document",
        "ChromaDB",
        "임베딩",
        "메타데이터"
      ],
      "lines": [
        {
          "at": "def load_corpus_from_vectorstore(vectorstore) -> list:",
          "text": "벡터 DB에서 원문 청크를 꺼내 복원하는 함수 정의."
        },
        {
          "at": "from langchain_core.documents import Document",
          "text": "원문+메타데이터를 담는 LangChain 표준 문서 객체를 가져옴."
        },
        {
          "at": "records = vectorstore._collection.get(include=[\"documents\", \"metadatas\"])",
          "text": "임베딩은 빼고 원문·메타데이터만 한 번에 조회함."
        },
        {
          "at": "contents = records.get(\"documents\") or []",
          "text": "조회 결과에서 청크 원문 목록을 꺼냄."
        },
        {
          "at": "metadatas = records.get(\"metadatas\") or []",
          "text": "조회 결과에서 메타데이터(파일명·청크번호 등) 목록을 꺼냄."
        },
        {
          "at": "Document(page_content=content, metadata=metadata or {})",
          "text": "원문과 메타데이터를 짝지어 Document 로 복원함."
        },
        {
          "at": "return corpus",
          "text": "복원한 청크 목록(BM25 코퍼스)을 돌려줌."
        }
      ],
      "code": "def load_corpus_from_vectorstore(vectorstore) -> list:\n    \"\"\"벡터 DB에 저장된 원문 청크 전체를 꺼내 Document 리스트로 복원함.\n\n    BM25는 벡터가 아니라 원문 텍스트로 인덱스를 만드는 메모리 기반 검색기임. 공용 DB는\n    Dense 검색용으로 만들어졌지만 청크 원문과 메타데이터도 함께 저장하므로, 이를 그대로\n    꺼내 BM25 코퍼스로 재사용함 (문서를 다시 임베딩하지 않음).\n    ._collection.get(include=[...]): ChromaDB에서 임베딩을 제외한 원문·메타데이터만 일괄 조회함.\n    \"\"\"\n    from langchain_core.documents import Document  # Document: page_content + metadata를 담는 LangChain 표준 문서 객체\n\n    # include에 \"documents\"(원문)와 \"metadatas\"(메타데이터)만 지정해 불필요한 임베딩 전송을 피함\n    records = vectorstore._collection.get(include=[\"documents\", \"metadatas\"])\n    contents = records.get(\"documents\") or []\n    metadatas = records.get(\"metadatas\") or []\n\n    # 원문과 메타데이터를 짝지어 Document로 복원함 (메타데이터가 없으면 빈 dict로 대체)\n    corpus = [\n        Document(page_content=content, metadata=metadata or {})\n        for content, metadata in zip(contents, metadatas)\n    ]\n    if not corpus:\n        raise ValueError(\"벡터 DB에서 원문 청크를 가져오지 못함. 인덱싱 결과 확인 필요\")\n    print(f\"  - BM25 코퍼스 추출 완료: {len(corpus)}개 청크\")\n    return corpus"
    },
    {
      "id": "build_retrievers",
      "name": "build_retrievers()",
      "fileId": "main",
      "summary": "Dense(의미)·BM25(키워드)·Hybrid(융합) 세 검색기를 만들어 한꺼번에 돌려주는 함수 — 이 예제의 핵심.",
      "how": "세 검색기를 구성함. ① Dense: vectorstore.as_retriever 로 '유사도 상위 5개를 찾는' 의미 검색기를 만듦. ② BM25(Sparse): BM25Retriever.from_documents 로 코퍼스에서 키워드 색인을 메모리에 만들고, 앞서 만든 한국어 토크나이저를 preprocess_func 로 주입함(반환 개수도 5개로 설정). ③ Hybrid: EnsembleRetriever 에 두 검색기와 가중치를 넘겨, 각자 순위를 RRF(역순위 융합)로 점수화해 합치는 융합 검색기를 만듦(EnsembleRetriever 는 최신 langchain 에서 langchain_classic 으로 분리됨). 세 검색기를 모두 돌려줘 결과를 비교 출력할 수 있게 함.",
      "terms": [
        "Hybrid Search",
        "Dense Retrieval(의미/밀집 검색)",
        "Sparse Retrieval(키워드/희소 검색)",
        "BM25",
        "EnsembleRetriever",
        "RRF",
        "가중치(weights)",
        "retriever",
        "as_retriever",
        "유사도 검색",
        "top-k"
      ],
      "lines": [
        {
          "at": "def build_retrievers(vectorstore, corpus: list):",
          "text": "세 검색기를 만들어 돌려주는 함수 정의."
        },
        {
          "at": "from langchain_community.retrievers import BM25Retriever",
          "text": "키워드 기반 Sparse 검색기 BM25Retriever 를 가져옴."
        },
        {
          "at": "from langchain_classic.retrievers import EnsembleRetriever",
          "text": "두 검색기를 융합하는 EnsembleRetriever 를 가져옴(분리된 위치)."
        },
        {
          "at": "dense_retriever = vectorstore.as_retriever(",
          "text": "벡터 저장소를 의미 검색기(Dense)로 변환함."
        },
        {
          "at": "search_kwargs={\"k\": TOP_K},",
          "text": "Dense 가 유사도 상위 5개(top-k)를 반환하도록 설정함."
        },
        {
          "at": "bm25_retriever = BM25Retriever.from_documents(",
          "text": "코퍼스로 BM25 키워드 색인을 메모리에 구축함."
        },
        {
          "at": "preprocess_func=build_bm25_tokenizer(),",
          "text": "한국어 형태소 토크나이저를 BM25에 주입해 매칭률을 높임."
        },
        {
          "at": "bm25_retriever.k = TOP_K",
          "text": "BM25 도 상위 5개를 반환하도록 설정함."
        },
        {
          "at": "hybrid_retriever = EnsembleRetriever(",
          "text": "Dense·BM25 두 검색기를 묶는 융합 검색기를 만듦."
        },
        {
          "at": "retrievers=[dense_retriever, bm25_retriever],",
          "text": "융합 대상으로 의미 검색기와 키워드 검색기를 함께 넣음."
        },
        {
          "at": "weights=[DENSE_WEIGHT, BM25_WEIGHT],",
          "text": "두 검색기의 RRF 점수에 줄 비중(0.5/0.5)을 지정함."
        },
        {
          "at": "return dense_retriever, bm25_retriever, hybrid_retriever",
          "text": "세 검색기를 모두 돌려줌(비교 출력용)."
        }
      ],
      "code": "def build_retrievers(vectorstore, corpus: list):\n    \"\"\"Dense·Sparse(BM25)·Hybrid(Ensemble) 세 검색기를 구성하여 반환함.\n\n    - Dense  : vectorstore.as_retriever() → 질의 임베딩 기반 유사도 검색\n    - Sparse : BM25Retriever.from_documents() → 키워드 빈도 기반 검색 (한국어 토크나이저 주입)\n    - Hybrid : EnsembleRetriever → 두 검색 순위를 RRF(역순위 융합)로 결합 후 가중치 적용\n    세 검색기를 모두 반환하여 동일 질의에 대한 검색 결과를 비교 출력할 수 있게 함.\n    \"\"\"\n    from langchain_community.retrievers import BM25Retriever  # BM25Retriever: 키워드 기반 Sparse 검색기\n    # EnsembleRetriever는 langchain_classic.retrievers에 위치함 (최신 langchain에서 분리됨)\n    from langchain_classic.retrievers import EnsembleRetriever\n\n    # Dense: 유사도 상위 TOP_K개 청크를 반환하도록 설정함\n    dense_retriever = vectorstore.as_retriever(\n        search_type=\"similarity\",\n        search_kwargs={\"k\": TOP_K},\n    )\n\n    # Sparse: 코퍼스로 BM25 인덱스를 메모리에 구축함. preprocess_func로 한국어 형태소 토크나이저를 주입함\n    bm25_retriever = BM25Retriever.from_documents(\n        corpus,\n        preprocess_func=build_bm25_tokenizer(),\n    )\n    bm25_retriever.k = TOP_K  # BM25가 반환할 상위 청크 수\n\n    # Hybrid: 두 검색기 결과를 가중치로 융합함\n    # EnsembleRetriever 동작 원리:\n    #   1) 각 검색기를 독립 실행해 순위 목록을 얻음\n    #   2) RRF(Reciprocal Rank Fusion)로 순위를 점수화: score = Σ weight / (k + rank)\n    #   3) 동일 문서(page_content 일치)는 점수를 합산하고 최종 점수순으로 정렬함\n    hybrid_retriever = EnsembleRetriever(\n        retrievers=[dense_retriever, bm25_retriever],\n        weights=[DENSE_WEIGHT, BM25_WEIGHT],\n    )\n\n    return dense_retriever, bm25_retriever, hybrid_retriever"
    },
    {
      "id": "create_llm",
      "name": "create_llm()",
      "fileId": "main",
      "summary": "답변을 생성할 Groq LPU의 openai/gpt-oss-120b 채팅 모델을 만들어 돌려주는 함수.",
      "how": "검색 근거를 바탕으로 문장을 써 줄 LLM을 준비함. ① Groq 키가 없으면 즉시 오류를 냄. ② ChatGroq 래퍼로 모델을 만들되, gpt-oss-120b 는 추론 모델이라 사고 과정이 답에 섞일 수 있으므로 reasoning_format=\"hidden\" 으로 최종 답변만 받음. ③ temperature=0 으로 같은 질문에 같은 답이 나오도록(결정적) 설정함.",
      "terms": [
        "ChatGroq",
        "LLM",
        "reasoning_format",
        "temperature",
        "API 키 검사"
      ],
      "lines": [
        {
          "at": "def create_llm():",
          "text": "Groq 채팅 모델을 만들어 돌려주는 함수 정의."
        },
        {
          "at": "from langchain_groq import ChatGroq",
          "text": "Groq LPU 모델을 다루는 LangChain 래퍼를 가져옴."
        },
        {
          "at": "if not os.getenv(\"GROQ_API_KEY\"):",
          "text": "Groq 키가 없으면 곧바로 명확한 오류를 냄."
        },
        {
          "at": "return ChatGroq(",
          "text": "Groq 채팅 모델 객체를 만들어 돌려줌."
        },
        {
          "at": "temperature=0,",
          "text": "같은 질문에 같은 답이 나오도록 무작위성을 0으로 둠."
        },
        {
          "at": "reasoning_format=\"hidden\",",
          "text": "추론 과정을 숨기고 최종 답변 텍스트만 받도록 함."
        }
      ],
      "code": "def create_llm():\n    \"\"\"Groq LPU의 openai/gpt-oss-120b 채팅 모델을 생성하여 반환함.\n\n    ChatGroq: Groq Cloud LPU에 채팅 요청을 보내는 LangChain 모델 래퍼 (GROQ_API_KEY 자동 참조).\n    gpt-oss-120b는 추론(reasoning) 모델이라 사고 과정이 답변 본문에 섞일 수 있으므로\n    reasoning_format=\"hidden\"으로 최종 답변만 받도록 함.\n    temperature=0: 동일 질의에 대해 재현 가능한(결정적) 답변을 생성하도록 함.\n    \"\"\"\n    import os\n\n    from langchain_groq import ChatGroq\n\n    if not os.getenv(\"GROQ_API_KEY\"):\n        raise RuntimeError(f\"GROQ_API_KEY가 설정되지 않음. {ENV_PATH} 확인 필요\")\n\n    return ChatGroq(\n        model=LLM_MODEL,\n        temperature=0,\n        reasoning_format=\"hidden\",  # 추론 과정을 숨기고 최종 답변 텍스트만 반환\n    )"
    },
    {
      "id": "format_docs",
      "name": "format_docs()",
      "fileId": "main",
      "summary": "검색된 청크(Document) 목록을 LLM 프롬프트에 넣을 하나의 문자열로 합치는 함수.",
      "how": "검색해 온 청크들을 LLM이 읽기 좋은 형태로 가공함. 각 청크 앞에 [출처 N] 라벨과 메타데이터(파일명·청크 번호)를 붙여, LLM이 근거 조문을 인용하기 쉽고 사람도 출처를 식별할 수 있게 함. 청크 사이는 구분선(---)으로 띄워 문서 경계를 분명히 함.",
      "terms": [
        "청크",
        "Document",
        "메타데이터",
        "프롬프트"
      ],
      "lines": [
        {
          "at": "def format_docs(docs: list) -> str:",
          "text": "청크 목록을 하나의 문자열로 합치는 함수 정의."
        },
        {
          "at": "for index, doc in enumerate(docs, start=1):",
          "text": "검색된 청크를 1번부터 번호를 붙이며 순회함."
        },
        {
          "at": "source = doc.metadata.get(\"source\", \"unknown\")",
          "text": "메타데이터에서 출처 파일명을 꺼냄(없으면 unknown)."
        },
        {
          "at": "blocks.append(f\"[출처 {index}]",
          "text": "출처 라벨·메타데이터·원문을 한 블록으로 묶어 모음."
        },
        {
          "at": "return \"\\n\\n---\\n\\n\".join(blocks)",
          "text": "블록들을 구분선으로 이어 하나의 컨텍스트 문자열로 합침."
        }
      ],
      "code": "def format_docs(docs: list) -> str:\n    \"\"\"검색된 Document 리스트를 LLM 프롬프트용 단일 문자열로 합침.\n\n    각 청크 앞에 [출처 N] 라벨과 메타데이터(파일명·청크 번호)를 붙여\n    LLM이 근거 조문을 인용하기 쉽게 하고, 출력 시 사람도 출처를 식별할 수 있게 함.\n    \"\"\"\n    blocks = []\n    for index, doc in enumerate(docs, start=1):\n        source = doc.metadata.get(\"source\", \"unknown\")\n        chunk_index = doc.metadata.get(\"chunk_index\", \"?\")\n        blocks.append(f\"[출처 {index}] {source} #{chunk_index}\\n{doc.page_content}\")\n    # 청크 사이를 구분선으로 띄워 LLM이 문서 경계를 인식하기 쉽게 함\n    return \"\\n\\n---\\n\\n\".join(blocks)"
    },
    {
      "id": "answer_query",
      "name": "answer_query()",
      "fileId": "main",
      "summary": "질의어로 Hybrid 검색을 수행하고, 그 결과를 근거로 LLM 답변을 생성하는 RAG 파이프라인 함수.",
      "how": "RAG의 '탐색 → 생성'을 한 함수로 묶음. ① 탐색: retriever.invoke(query) 로 Hybrid 검색기를 호출해 Dense+BM25 융합 결과(청크)를 가져옴. ② 생성: ChatPromptTemplate 로 system/human 프롬프트를 묶고, LCEL 파이프 연산자(|)로 prompt | llm | StrOutputParser 체인을 만든 뒤, format_docs 로 만든 컨텍스트와 질문을 넣어 invoke 함. 답변과 함께 근거 청크도 같이 돌려줘 출처를 출력할 수 있게 함.",
      "terms": [
        "retriever",
        "invoke",
        "LCEL",
        "ChatPromptTemplate",
        "StrOutputParser",
        "프롬프트"
      ],
      "lines": [
        {
          "at": "def answer_query(query: str, retriever, llm) -> tuple[str, list]:",
          "text": "Hybrid 검색 후 LLM 답변을 만드는 함수 정의."
        },
        {
          "at": "from langchain_core.output_parsers import StrOutputParser",
          "text": "LLM 응답에서 본문 텍스트만 뽑는 파서를 가져옴."
        },
        {
          "at": "from langchain_core.prompts import ChatPromptTemplate",
          "text": "system/human 메시지로 프롬프트를 조립하는 도구를 가져옴."
        },
        {
          "at": "docs = retriever.invoke(query)",
          "text": "탐색: Hybrid 검색기로 Dense+BM25 융합 결과를 가져옴."
        },
        {
          "at": "prompt = ChatPromptTemplate.from_messages(",
          "text": "system·human 프롬프트를 묶어 프롬프트를 구성함."
        },
        {
          "at": "chain = prompt | llm | StrOutputParser()",
          "text": "생성: 프롬프트→LLM→파서를 파이프(|)로 연결한 LCEL 체인."
        },
        {
          "at": "answer = chain.invoke({\"context\": format_docs(docs), \"question\": query})",
          "text": "검색 컨텍스트와 질문을 체인에 넣어 답변을 생성함."
        },
        {
          "at": "return answer, docs",
          "text": "생성된 답변과 근거 청크를 함께 돌려줌."
        }
      ],
      "code": "def answer_query(query: str, retriever, llm) -> tuple[str, list]:\n    \"\"\"질의어로 Hybrid 검색을 수행하고 검색 결과를 근거로 LLM 답변을 생성함.\n\n    처리 흐름:\n      1. 탐색: retriever.invoke(query) → Dense+BM25 융합 결과 반환\n      2. 생성: (prompt | llm | StrOutputParser) LCEL 체인에 context·question 주입\n    검색 청크를 별도로 반환하여 답변과 함께 출처를 출력할 수 있게 함.\n    \"\"\"\n    from langchain_core.output_parsers import StrOutputParser\n    from langchain_core.prompts import ChatPromptTemplate\n\n    # 1) 탐색: Hybrid 검색기로 Dense+BM25 융합 결과를 가져옴\n    docs = retriever.invoke(query)\n\n    # 2) 생성: LCEL 파이프 연산자(|)로 프롬프트 → LLM → 문자열 파서를 연결함\n    # ChatPromptTemplate.from_messages: system/human 메시지 템플릿을 묶어 프롬프트를 구성함\n    prompt = ChatPromptTemplate.from_messages(\n        [(\"system\", SYSTEM_PROMPT), (\"human\", HUMAN_PROMPT)]\n    )\n    # StrOutputParser: LLM의 AIMessage 응답에서 본문 텍스트만 추출함\n    chain = prompt | llm | StrOutputParser()\n\n    # 검색된 청크를 컨텍스트 문자열로 변환해 질의어와 함께 체인에 주입함\n    answer = chain.invoke({\"context\": format_docs(docs), \"question\": query})\n    return answer, docs"
    },
    {
      "id": "_doc_ids",
      "name": "_doc_ids()",
      "fileId": "main",
      "summary": "청크(Document) 목록을 'source#chunk_index' 형태의 짧은 식별자 목록으로 바꾸는 보조 함수(검색 비교용).",
      "how": "Dense·BM25·Hybrid 결과를 나란히 비교하려면 각 청크를 짧게 가리키는 이름이 필요함. 각 청크의 메타데이터에서 파일명(source)과 청크 번호(chunk_index)를 꺼내 '특허법.pdf#32' 같은 식별자 문자열로 만들어 목록으로 돌려줌. 이 식별자로 어떤 검색기가 어떤 청크를 골랐는지 한눈에 대조할 수 있음.",
      "terms": [
        "청크",
        "Document",
        "메타데이터"
      ],
      "lines": [
        {
          "at": "def _doc_ids(docs: list) -> list[str]:",
          "text": "청크 목록을 짧은 식별자 목록으로 바꾸는 함수 정의."
        },
        {
          "at": "for doc in docs:",
          "text": "청크들을 하나씩 순회함."
        },
        {
          "at": "ids.append(f\"{source}#{chunk_index}\")",
          "text": "파일명#청크번호 형태의 식별자를 만들어 모음."
        },
        {
          "at": "return ids",
          "text": "식별자 목록을 돌려줌(검색 비교에 사용)."
        }
      ],
      "code": "def _doc_ids(docs: list) -> list[str]:\n    \"\"\"Document 리스트를 'source#chunk_index' 형태의 짧은 식별자 리스트로 변환함 (검색 비교용).\"\"\"\n    ids = []\n    for doc in docs:\n        source = doc.metadata.get(\"source\", \"unknown\")\n        chunk_index = doc.metadata.get(\"chunk_index\", \"?\")\n        ids.append(f\"{source}#{chunk_index}\")\n    return ids"
    },
    {
      "id": "print_search_comparison",
      "name": "print_search_comparison()",
      "fileId": "main",
      "summary": "Dense·BM25·Hybrid 세 검색 결과를 나란히 출력해 Hybrid의 효과를 눈으로 보여 주는 함수.",
      "how": "같은 질문에 대해 세 검색기가 각각 어떤 청크를 골랐는지 _doc_ids 식별자로 나란히 출력함. 이어 Dense 결과 집합과 BM25 결과 집합의 교집합(both)을 구해, 두 검색기가 '공통으로 찾은 청크'를 따로 표시함 — 이 공통 청크는 RRF에서 점수가 합산되어 상위로 올라가므로 Hybrid 의 핵심 이득을 직관적으로 보여 줌.",
      "terms": [
        "Dense Retrieval(의미/밀집 검색)",
        "BM25",
        "Hybrid Search",
        "RRF",
        "청크"
      ],
      "lines": [
        {
          "at": "def print_search_comparison(query: str, dense_docs: list, bm25_docs: list, hybrid_docs: list) -> None:",
          "text": "세 검색 결과를 비교 출력하는 함수 정의."
        },
        {
          "at": "print(f\"  Dense (의미)",
          "text": "Dense(의미) 검색이 고른 상위 청크 식별자를 출력함."
        },
        {
          "at": "print(f\"  BM25  (키워드)",
          "text": "BM25(키워드) 검색이 고른 상위 청크 식별자를 출력함."
        },
        {
          "at": "print(f\"  Hybrid(융합)",
          "text": "Hybrid(융합) 검색이 최종으로 고른 청크 식별자를 출력함."
        },
        {
          "at": "both = dense_set & bm25_set",
          "text": "두 검색기가 공통으로 찾은 청크(교집합)를 구함."
        },
        {
          "at": "print(f\"  → Dense·BM25 공통 청크",
          "text": "공통 청크는 RRF에서 점수가 합산돼 상위에 오름을 표시함."
        }
      ],
      "code": "def print_search_comparison(query: str, dense_docs: list, bm25_docs: list, hybrid_docs: list) -> None:\n    \"\"\"Dense·BM25·Hybrid 검색 결과를 나란히 출력해 Hybrid의 효과를 시각적으로 보여줌.\n\n    같은 질의에 대해 세 검색기가 각각 어떤 청크를 골랐는지 비교하면, Hybrid가\n    의미 검색(Dense)과 키워드 검색(BM25)의 결과를 어떻게 통합하는지 직관적으로 이해할 수 있음.\n    \"\"\"\n    print(\"\\n\" + \"=\" * 70)\n    print(f\"[검색 비교] 질의어: {query}\")\n    print(\"=\" * 70)\n    print(f\"  Dense (의미)   Top {len(dense_docs)}: {_doc_ids(dense_docs)}\")\n    print(f\"  BM25  (키워드) Top {len(bm25_docs)}: {_doc_ids(bm25_docs)}\")\n    print(f\"  Hybrid(융합)        {len(hybrid_docs)}건: {_doc_ids(hybrid_docs)}\")\n\n    # Dense·BM25 각각의 결과 집합을 만들어 Hybrid가 어느 쪽에서 가져온 청크인지 표시함\n    dense_set = set(_doc_ids(dense_docs))\n    bm25_set = set(_doc_ids(bm25_docs))\n    both = dense_set & bm25_set\n    if both:\n        # 두 검색기가 공통으로 찾은 청크는 RRF에서 점수가 합산되어 상위에 오름 (Hybrid의 핵심 이득)\n        print(f\"  → Dense·BM25 공통 청크(점수 합산되어 상위): {sorted(both)}\")"
    },
    {
      "id": "print_result",
      "name": "print_result()",
      "fileId": "main",
      "summary": "질의어·생성 답변·Hybrid 검색 출처를 보기 좋게 콘솔에 출력하는 함수.",
      "how": "최종 결과를 사람이 읽기 좋게 정리함. 질문과 생성된 답변을 출력한 뒤, 근거가 된 청크 목록을 번호·파일명·청크 번호와 함께 보여 줌. 각 청크는 본문 앞 60자만 한 줄 미리보기로 잘라 어떤 내용이 근거인지 빠르게 확인하게 함. 근거(출처)를 함께 보여 주는 것은 RAG의 핵심 장점 — 사람이 답의 출처를 검증할 수 있음.",
      "terms": [
        "청크",
        "Hybrid Search",
        "메타데이터"
      ],
      "lines": [
        {
          "at": "def print_result(query: str, answer: str, docs: list) -> None:",
          "text": "질문·답변·검색 출처를 출력하는 함수 정의."
        },
        {
          "at": "print(f\"[답변]\\n{answer}\")",
          "text": "LLM이 생성한 최종 답변을 출력함."
        },
        {
          "at": "print(f\"[검색 출처] {len(docs)}건",
          "text": "근거로 쓰인 청크가 몇 건인지(Hybrid 결과) 출력함."
        },
        {
          "at": "snippet = doc.page_content[:60].replace(\"\\n\", \" \")",
          "text": "청크 본문 앞 60자만 한 줄 미리보기로 잘라 냄."
        },
        {
          "at": "print(f\"  [{index}] {source} #{chunk_index}: {snippet}...\")",
          "text": "번호·파일명·청크번호와 미리보기를 한 줄로 출력함."
        }
      ],
      "code": "def print_result(query: str, answer: str, docs: list) -> None:\n    \"\"\"질의어·생성 답변·Hybrid 검색 출처를 보기 좋게 콘솔에 출력함.\"\"\"\n    print(\"\\n\" + \"=\" * 70)\n    print(f\"[질문] {query}\")\n    print(\"=\" * 70)\n    print(f\"[답변]\\n{answer}\")\n    print(\"\\n\" + \"-\" * 70)\n    print(f\"[검색 출처] {len(docs)}건 (Hybrid: Dense + BM25)\")\n    for index, doc in enumerate(docs, start=1):\n        source = doc.metadata.get(\"source\", \"unknown\")\n        chunk_index = doc.metadata.get(\"chunk_index\", \"?\")\n        # 본문 미리보기 60자만 한 줄로 보여 어떤 청크가 근거인지 확인 가능하게 함\n        snippet = doc.page_content[:60].replace(\"\\n\", \" \")\n        print(f\"  [{index}] {source} #{chunk_index}: {snippet}...\")\n    print(\"=\" * 70)"
    },
    {
      "id": "main",
      "name": "main()",
      "fileId": "main",
      "summary": "벡터 DB 로드 → 검색기 구성 → LLM 생성 → 검색 비교·답변 → 출력 순으로 Hybrid RAG 전체를 실행하는 함수.",
      "how": "프로그램의 지휘자 역할임. ① 명령줄 인자가 있으면 질의어로, 없으면 기본 질의어를 씀. ② load_vectorstore·load_corpus_from_vectorstore 로 벡터 DB와 BM25 코퍼스를 준비함. ③ build_retrievers 로 세 검색기를, create_llm 으로 LLM을 만듦. ④ 비교 출력을 위해 Dense·BM25 단독 결과도 따로 조회하고, answer_query 로 Hybrid 결과 기반 답변을 생성함(실제 답변은 Hybrid 결과만 사용). ⑤ print_search_comparison·print_result 로 비교와 최종 결과를 출력함.",
      "terms": [
        "Hybrid Search",
        "벡터 DB",
        "retriever",
        "invoke",
        "LLM"
      ],
      "lines": [
        {
          "at": "def main() -> None:",
          "text": "Hybrid RAG 전체 흐름을 묶어 실행하는 메인 함수 정의."
        },
        {
          "at": "query = \" \".join(sys.argv[1:]).strip() or DEFAULT_QUERY",
          "text": "명령줄 질문이 있으면 그것을, 없으면 기본 질문을 사용함."
        },
        {
          "at": "vectorstore = load_vectorstore()",
          "text": "공용 벡터 DB를 재임베딩 없이 연결함."
        },
        {
          "at": "corpus = load_corpus_from_vectorstore(vectorstore)",
          "text": "DB에서 원문 청크를 꺼내 BM25 코퍼스를 만듦."
        },
        {
          "at": "dense_retriever, bm25_retriever, hybrid_retriever = build_retrievers(vectorstore, corpus)",
          "text": "Dense·BM25·Hybrid 세 검색기를 한 번에 구성함."
        },
        {
          "at": "llm = create_llm()",
          "text": "답변을 생성할 Groq LLM을 준비함."
        },
        {
          "at": "dense_docs = dense_retriever.invoke(query)",
          "text": "비교용으로 Dense 단독 검색 결과를 따로 가져옴."
        },
        {
          "at": "bm25_docs = bm25_retriever.invoke(query)",
          "text": "비교용으로 BM25 단독 검색 결과를 따로 가져옴."
        },
        {
          "at": "answer, hybrid_docs = answer_query(query, hybrid_retriever, llm)",
          "text": "Hybrid 검색+생성으로 최종 답변과 근거 청크를 얻음."
        },
        {
          "at": "print_search_comparison(query, dense_docs, bm25_docs, hybrid_docs)",
          "text": "세 검색 결과를 나란히 비교 출력함."
        },
        {
          "at": "print_result(query, answer, hybrid_docs)",
          "text": "최종 질문·답변·검색 출처를 출력함."
        }
      ],
      "code": "def main() -> None:\n    \"\"\"벡터 DB 로드 → 검색기 구성 → LLM 생성 → 검색 비교·답변 → 출력 순으로 Hybrid RAG를 실행함.\"\"\"\n    # 명령줄 인자가 있으면 질의어로 사용하고, 없으면 기본 질의어를 사용함\n    query = \" \".join(sys.argv[1:]).strip() or DEFAULT_QUERY\n\n    print(\"[1/4] 공용 벡터 DB 로드 (재임베딩 없음)\")\n    vectorstore = load_vectorstore()\n    corpus = load_corpus_from_vectorstore(vectorstore)\n\n    print(\"[2/4] 검색기 구성 (Dense + BM25 → Hybrid)\")\n    dense_retriever, bm25_retriever, hybrid_retriever = build_retrievers(vectorstore, corpus)\n\n    print(\"[3/4] LLM 생성 (Groq openai/gpt-oss-120b)\")\n    llm = create_llm()\n\n    print(\"[4/4] Hybrid 검색 + 답변 생성\")\n    # 비교 출력을 위해 Dense·BM25 단독 결과도 함께 조회함 (학습용; 실제 답변은 Hybrid 결과만 사용)\n    dense_docs = dense_retriever.invoke(query)\n    bm25_docs = bm25_retriever.invoke(query)\n    answer, hybrid_docs = answer_query(query, hybrid_retriever, llm)\n\n    print_search_comparison(query, dense_docs, bm25_docs, hybrid_docs)\n    print_result(query, answer, hybrid_docs)"
    }
  ],
  "glossary": {
    "from __future__ import annotations": "파이썬 파일 맨 위에 두는 선언으로, 타입 힌트(코드에 적는 자료형 설명)를 글자 그대로 다뤄 더 가볍고 자유롭게 쓰게 해 줌.",
    "Path(__file__).resolve().parent": "지금 실행 중인 파일이 들어 있는 폴더의 절대경로를 구하는 표현. 어디서 실행하든 같은 위치를 가리키게 해 줌.",
    "load_dotenv": ".env 파일에 적어 둔 비밀값(API 키 등)을 읽어 프로그램의 환경변수로 올려 주는 함수.",
    "API 키 검사": "OpenAI·Groq 같은 외부 서비스 호출에 필요한 비밀 키가 설정돼 있는지 미리 확인해, 없으면 곧바로 명확한 오류를 내는 것.",
    "청크": "긴 문서를 검색·처리하기 좋게 잘라 둔 작은 글 조각. 이 예제의 특허법 PDF도 여러 청크로 나뉘어 저장돼 있음.",
    "코퍼스(corpus)": "검색·분석의 대상이 되는 문서(청크) 묶음 전체. 여기서는 BM25 색인을 만들 원문 청크 모음을 뜻함.",
    "임베딩": "글(텍스트)을 의미가 담긴 숫자 목록(벡터)으로 바꾸는 것. 뜻이 비슷한 글은 비슷한 숫자가 되어 '의미로 검색'할 수 있게 됨.",
    "벡터 DB": "임베딩(숫자 벡터)을 저장하고, 입력 벡터와 가까운 것을 빠르게 찾아 주는 특수 데이터베이스.",
    "ChromaDB": "이 예제가 쓰는 오픈소스 벡터 DB. 청크의 벡터와 원문·메타데이터를 로컬 폴더에 저장해 둠.",
    "Chroma": "ChromaDB를 파이썬/LangChain에서 다루기 쉽게 감싼 래퍼 객체. 생성자로 부르면 기존 컬렉션을 그대로 연결함.",
    "OpenAIEmbeddings": "OpenAI의 임베딩 모델을 호출해 텍스트를 벡터로 바꿔 주는 LangChain 도구.",
    "text-embedding-3-small": "이 예제가 쓰는 OpenAI 임베딩 모델 이름. 텍스트를 1536개 숫자(1536차원)로 바꿈. 인덱싱 때와 같아야 검색이 맞음.",
    "메타데이터": "청크에 딸린 부가 정보(예: 원본 파일명, 청크 번호). 출처를 표시하거나 청크를 식별하는 데 씀.",
    "Document": "원문(page_content)과 메타데이터(metadata)를 함께 담는 LangChain 표준 문서 객체.",
    "Hybrid Search": "키워드 검색(BM25/Sparse)과 의미 검색(임베딩/Dense)을 함께 돌려 두 결과를 합치는 검색 방식. 서로의 약점을 보완해 정확도를 높임.",
    "BM25": "단어가 얼마나 자주·드물게 나오는지로 점수를 매겨 찾는 고전 키워드 검색 알고리즘. 임베딩 없이 글자 일치로 동작함.",
    "Sparse Retrieval(키워드/희소 검색)": "단어 출현 정보로 찾는 검색 방식(BM25 등). 단어 차원이 매우 많고 대부분 0이라 '희소(Sparse)'라고 부름. 정확한 용어·조문 번호 매칭에 강함.",
    "Dense Retrieval(의미/밀집 검색)": "텍스트를 임베딩(빽빽한 숫자 벡터)으로 바꿔 의미가 가까운 것을 찾는 검색 방식. 자연어 질문·동의어·오타에 강함.",
    "EnsembleRetriever": "여러 검색기를 묶어, 각자의 검색 결과 순위를 RRF로 합쳐 하나의 결과로 돌려주는 LangChain 융합 검색기. 최신 langchain 에서는 langchain_classic 에 들어 있음.",
    "RRF": "Reciprocal Rank Fusion(역순위 융합). 여러 검색기의 '순위'만으로 점수를 매겨 합치는 방법. 여러 검색기가 공통으로 찾은 항목일수록 점수가 합산돼 상위로 올라감.",
    "가중치(weights)": "융합할 때 각 검색기 결과에 얼마나 비중을 줄지 정하는 값. 이 예제는 Dense 0.5 / BM25 0.5 로 균형을 둠.",
    "kiwipiepy(형태소 분석기)": "한국어 문장을 형태소(뜻을 가진 최소 단위)로 쪼개 주는 라이브러리. '특허를'에서 조사 '를'을 떼어 '특허'를 뽑아냄.",
    "토크나이저": "문장을 검색·처리 단위인 토큰(주로 단어·어근)으로 잘라 주는 도구. BM25의 키워드 매칭 품질을 좌우함.",
    "정규식 폴백": "kiwipiepy 가 없을 때 대신 쓰는 간단한 규칙(정규식) 기반 토크나이저. 한글·영숫자 덩어리만 뽑아 예제가 항상 실행되게 함.",
    "retriever": "질문을 받아 관련 청크를 찾아 주는 '검색기' 객체. 이 예제에는 Dense·BM25·Hybrid 세 종류가 있음.",
    "as_retriever": "벡터 저장소(vectorstore)를 '검색기(retriever)'로 바꿔 주는 메서드. 상위 몇 개(k)를 찾을지 등을 설정함.",
    "유사도 검색": "질문 벡터와 가장 가까운(=의미가 비슷한) 청크를 거리(유사도) 기준으로 찾는 것. Dense 검색의 핵심.",
    "top-k": "검색에서 점수가 높은 상위 k개만 가져오는 것. 이 예제는 각 검색기가 k=5개를 가져옴.",
    "ChatGroq": "Groq Cloud의 LPU에서 도는 채팅 LLM에 요청을 보내는 LangChain 래퍼. GROQ_API_KEY 를 자동으로 참조함.",
    "LLM": "Large Language Model(대규모 언어 모델). 글을 이해하고 새 문장을 생성하는 AI. 여기서는 검색 근거로 답변을 작성함.",
    "reasoning_format": "추론(reasoning) 모델의 사고 과정을 어떻게 다룰지 정하는 옵션. \"hidden\" 으로 두면 사고 과정을 숨기고 최종 답변만 받음.",
    "temperature": "LLM 답변의 무작위성(다양성) 정도. 0이면 같은 입력에 늘 같은 답을 내 재현 가능함.",
    "ChatPromptTemplate": "system·human 등 역할별 메시지를 묶어 LLM에 보낼 프롬프트를 조립하는 LangChain 템플릿.",
    "StrOutputParser": "LLM의 응답 객체에서 사람이 읽을 본문 텍스트만 깔끔히 뽑아 주는 출력 파서.",
    "LCEL": "LangChain Expression Language. 파이프 연산자(|)로 prompt | llm | parser 처럼 단계를 이어 붙여 처리 흐름(체인)을 만드는 방식.",
    "invoke": "검색기·체인 등 LangChain 구성요소를 '한 번 실행'시키는 메서드. 입력을 넣으면 결과를 돌려줌.",
    "프롬프트": "LLM에게 무엇을 어떻게 답할지 지시하는 입력 글. 역할·규칙·검색 문맥·질문 등을 담음."
  }
};
