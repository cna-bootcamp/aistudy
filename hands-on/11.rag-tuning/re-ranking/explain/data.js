window.EXPLAIN_DATA = {
  "meta": {
    "title": "Re-ranking (LangChain Compressor) — 검색 결과를 정밀 재정렬해 답변 품질을 높이는 예제",
    "entry": "app.py"
  },
  "files": [
    {
      "id": "main",
      "label": "app.py",
      "role": "공용 벡터 DB에서 후보를 넓게 찾은 뒤 Cross-Encoder로 정밀하게 다시 줄 세워(re-rank) 상위 5개만 LLM에 넘겨 답하는 전체 파이프라인"
    }
  ],
  "flow": [
    {
      "step": 1,
      "title": "실행 & 준비 (키·경로·재사용 자산)",
      "label": "실행·준비",
      "refs": ["setup", "load_vectorstore", "main"],
      "summary": "python app.py 로 실행하고, .env 키와 옆 예제(10.rag)가 만들어 둔 벡터 DB를 빌려 씀",
      "detail": "터미널에서 'python app.py' 로 실행함. 시작과 함께 .env 의 OPENAI_API_KEY(질문을 숫자 벡터로 바꾸는 임베딩용)와 GROQ_API_KEY(답을 쓰는 LLM용)를 읽음. 이 예제는 문서를 새로 쪼개거나 저장하지 않고, 이미 8.0 인덱싱이 만들어 둔 공용 벡터 DB(../../10.rag/vectordb)를 '읽기만' 함. 비유하면, 이미 정리된 도서관 서가를 그대로 빌려 쓰는 것."
    },
    {
      "step": 2,
      "title": "1차 검색 (넓게·빠르게)",
      "label": "1차 검색",
      "refs": ["retrieve_initial"],
      "summary": "질문과 비슷한 조문 후보 50개를 벡터 유사도로 빠르게 끌어옴",
      "detail": "질문을 숫자 벡터로 바꿔, 미리 저장된 조문 벡터들과 '방향이 얼마나 비슷한지(코사인 유사도)'로 상위 50개를 빠르게 추림. 이 단계는 빠르지만 거칠어서, 정작 핵심 조문이 5등 밖으로 밀려 있을 수 있음. 그래서 일부러 넓게(50개) 가져옴. 비유하면, 도서관에서 제목·키워드만 보고 후보 책 50권을 일단 빼 오는 것."
    },
    {
      "step": 3,
      "title": "Re-ranking (정밀하게 다시 줄 세우기)",
      "label": "재정렬",
      "refs": ["load_compressor", "build_compression_retriever", "rerank_with_scores"],
      "summary": "질문+조문을 한 쌍으로 묶어 Cross-Encoder가 관련도를 정밀 채점하고 상위 5개로 압축",
      "detail": "50개 후보 각각을 '질문 + 조문 본문'으로 짝지어 Cross-Encoder(전문 채점 모델)에 통째로 넣음. 이 모델은 두 글의 단어 상호작용까지 따져 0~1 점수를 매기므로 1차 검색보다 훨씬 정확함(대신 느림). 이 작업을 LangChain의 'Compressor(압축기)'가 대신 해 주고, 점수 높은 5개만 남겨 '압축'함. 비유하면, 빼 온 50권을 사서가 한 권씩 펼쳐 질문과 정말 맞는지 꼼꼼히 보고 베스트 5권만 추리는 것."
    },
    {
      "step": 4,
      "title": "순위 변화 보여주기 (교육용)",
      "label": "순위 변화 표시",
      "refs": ["print_reranked_results", "helpers"],
      "summary": "1차 순위 → 재정렬 순위가 어떻게 바뀌었는지 ▲▼ 화살표로 표시",
      "detail": "재정렬이 실제로 효과가 있었는지 눈으로 확인하려고, 1차 검색 순위와 재정렬 후 순위를 (출처·조각번호) 키로 맞춰 비교함. 예: 핵심 조문이 1차 46위에서 4위로 뛰면 ▲42 로 표시. 통합 검색기는 점수를 따로 안 알려 주므로, 보여 줄 점수만 최종 5개에 대해 다시 계산함. 비유하면, 예선 등수와 결선 등수를 나란히 붙여 '얼마나 역전했는지' 전광판에 띄우는 것."
    },
    {
      "step": 5,
      "title": "답변 생성 (Top-5 근거로)",
      "label": "답변 생성",
      "refs": ["format_context", "build_chain", "run_query"],
      "summary": "추려낸 조문 5개만 근거로 묶어 Groq LLM이 쉬운 말로 답함",
      "detail": "최종 5개 조문을 하나의 '컨텍스트' 글로 합쳐, 시스템 프롬프트(법률 용어를 쉽게 풀어 설명하라는 지시)와 함께 Groq LLM 에 넘김. LLM 은 그 5개 근거 안에서만 답을 만들고, 끝에 근거 조문 번호를 붙임. LLM 에 넘기는 건 5개뿐이라 토큰 비용은 그대로면서 품질만 올라감. 비유하면, 베스트 5권만 책상에 펴 놓고 그 내용으로만 보고서를 쓰는 것."
    }
  ],
  "functions": [
    {
      "id": "setup",
      "name": "임포트·경로·환경변수·상수",
      "fileId": "main",
      "summary": "파일 맨 위의 준비 코드 모음 — 모듈을 가져오고, 윈도우 한글·세그폴트 문제를 막고, 경로·키·핵심 설정값을 잡음.",
      "how": "함수가 아니라 메인 파일 상단의 준비 코드임. ① OpenMP 런타임이 두 번 로드돼 윈도우에서 종료 시 죽는(세그폴트) 것을 KMP_DUPLICATE_LIB_OK 로 막음. ② 윈도우 콘솔이 한글을 깨뜨리지 않도록 출력 인코딩을 UTF-8 로 바꿈. ③ 모든 경로를 이 파일 위치(__file__) 기준으로 계산해, 어디서 실행하든 공용 벡터 DB(../../10.rag/vectordb)와 .env 를 정확히 찾음. ④ 검색·재정렬·LLM 에 쓸 모델 이름과 INITIAL_K(1차 50개)·RERANK_K(최종 5개) 같은 설정값을 정함. ⑤ LLM 에게 '법률 용어를 쉽게 풀어 답하라'고 지시하는 시스템 프롬프트를 둠.",
      "terms": ["import", "KMP_DUPLICATE_LIB_OK", "세그폴트", "UTF-8", "__file__", "dotenv", "임베딩", "Cross-Encoder", "Top-K", "시스템 프롬프트"],
      "lines": [
        { "at": "os.environ.setdefault(\"KMP_DUPLICATE_LIB_OK\", \"TRUE\")", "text": "윈도우에서 종료할 때 OpenMP 충돌로 프로그램이 죽는 현상을 막는 안전장치." },
        { "at": "sys.stdout.reconfigure(encoding=\"utf-8\")", "text": "윈도우 콘솔에서 한글이 깨지지 않도록 출력 글자 인코딩을 UTF-8 로 바꿈." },
        { "at": "RAG_DIR = SCRIPT_DIR.parent.parent / \"10.rag\"", "text": "옆 폴더(10.rag)를 가리킴 — 공용 벡터 DB 같은 자산이 여기 있음." },
        { "at": "VECTORDB_DIR = RAG_DIR / \"vectordb\"", "text": "빌려 쓸 공용 벡터 DB(이미 만들어진 조문 저장소)의 위치." },
        { "at": "load_dotenv(ENV_PATH)", "text": ".env 파일에서 OpenAI·Groq API 키를 읽어 환경변수로 올림." },
        { "at": "INITIAL_K = 50", "text": "1차 검색에서 넓게 가져올 후보 개수(많이 가져와야 핵심을 놓치지 않음)." },
        { "at": "RERANK_K = 5", "text": "정밀 재정렬 후 LLM 에 실제로 넘길 최종 문서 개수." },
        { "at": "DEFAULT_QUERY = ", "text": "프로그램을 켜면 자동으로 한 번 시연해 보는 기본 질문." }
      ],
      "code": "from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함\n\nimport os\nimport sys\nfrom pathlib import Path\n\n# torch(CUDA)와 chromadb(onnxruntime)가 각자 OpenMP 런타임(libiomp5md.dll)을 중복 로드하면\n# Windows에서 프로세스 종료 시점에 세그폴트(exit 139)가 발생할 수 있음. 중복 로드를 허용해 회피함.\nos.environ.setdefault(\"KMP_DUPLICATE_LIB_OK\", \"TRUE\")\n\n# Windows 콘솔 기본 인코딩(cp949)에서 한글 청크 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함\nif hasattr(sys.stdout, \"reconfigure\"):\n    sys.stdout.reconfigure(encoding=\"utf-8\")\n\n# ---------------------------------------------------------------------------\n# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)\n# ---------------------------------------------------------------------------\nSCRIPT_DIR = Path(__file__).resolve().parent        # 이 파일이 위치한 디렉터리(11.rag-tuning/re-ranking/)\nRAG_DIR = SCRIPT_DIR.parent.parent / \"10.rag\"        # hands-on/10.rag/ (공용 자산 위치)\nVECTORDB_DIR = RAG_DIR / \"vectordb\"                  # 공용 ChromaDB 영속 디렉터리 (8.0 인덱싱 산출물)\nENV_PATH = SCRIPT_DIR.parent.parent / \".env\"          # hands-on/.env (API 키 보관)\n\n# ---------------------------------------------------------------------------\n# 환경변수 로드\n# ---------------------------------------------------------------------------\nfrom dotenv import load_dotenv\n\nload_dotenv(ENV_PATH)  # .env에서 OPENAI_API_KEY(쿼리 임베딩)·GROQ_API_KEY(LLM)를 로드함\n\n# ---------------------------------------------------------------------------\n# 상수 정의\n# ---------------------------------------------------------------------------\nCOLLECTION_NAME = \"patent_law\"               # 공용 벡터 DB 컬렉션명 (8.0 인덱싱이 저장한 이름과 반드시 일치)\nEMBEDDING_MODEL = \"text-embedding-3-small\"   # 쿼리 임베딩 모델 (인덱싱 시와 동일해야 벡터 공간이 일치)\nRERANKER_MODEL = \"dragonkue/bge-reranker-v2-m3-ko\"  # 한국어 최적화 Cross-Encoder Re-ranker\nGROQ_MODEL = \"openai/gpt-oss-120b\"           # Groq LPU에서 서빙되는 LLM\n\nINITIAL_K = 50   # 1차 검색(base_retriever)에서 넓게 가져올 후보 문서 수\nRERANK_K = 5     # Re-ranking(Compressor) 후 LLM에 전달할 최종 문서 수(= CrossEncoderReranker의 top_n)\n\nDEFAULT_QUERY = \"특허를 받을 수 있는 조건은 ?\"   # 데모용 기본 질의어\n\n# LLM 시스템 프롬프트 (검색된 컨텍스트에만 근거하도록 제약)\nSYSTEM_PROMPT = \"\"\"당신은 특허법 전문 법률 상담 AI입니다.\n\n## 역할\n- 주어진 컨텍스트(검색된 특허법 조문)를 기반으로 질문에 답변합니다.\n- 법조문을 그대로 인용하지 말고, 일반인이 이해하기 쉽도록 풀어서 설명합니다.\n\n## 규칙\n1. 법률 용어는 쉬운 말로 바꿔서 설명 (예: \"출원인\" → \"특허를 신청하는 사람\")\n2. 복잡한 조문은 핵심만 요약하여 전달\n3. 컨텍스트에 없는 내용은 \"해당 내용은 제공된 문서에서 찾을 수 없습니다\"라고 답변\n4. 답변 끝에 근거가 된 조문 번호를 명시 (예: 특허법 제29조)\n\n## 컨텍스트\n{context}\n\"\"\""
    },
    {
      "id": "load_vectorstore",
      "name": "load_vectorstore()",
      "fileId": "main",
      "summary": "이미 만들어진 공용 벡터 DB(조문 저장소)를 새로 만들지 않고 그대로 열어 연결함.",
      "how": "8.0 인덱싱이 저장해 둔 ChromaDB 를 collection_name='patent_law' 로 정확히 지정해 엶. 이름을 빼먹으면 langchain 이 'langchain' 이라는 엉뚱한 빈 칸을 오류 없이 열어, 검색이 늘 0건이 되는 '조용한 실패'가 생김 — 그래서 연 다음 실제 저장된 개수(count)를 세어 0이면 곧장 중단함. 질문을 벡터로 바꿀 임베딩 모델만 붙이고, 저장된 조문은 이미 벡터라서 다시 만들지 않음.",
      "terms": ["벡터 DB", "ChromaDB", "컬렉션", "임베딩", "OpenAIEmbeddings", "조용한 실패"],
      "lines": [
        { "at": "if not VECTORDB_DIR.exists():", "text": "공용 벡터 DB 폴더가 없으면, 먼저 인덱싱을 돌리라는 안내와 함께 멈춤." },
        { "at": "embeddings = OpenAIEmbeddings(", "text": "질문을 1536개 숫자(벡터)로 바꾸는 변환기 — 저장 때와 같은 모델이어야 비교가 됨." },
        { "at": "vectorstore = Chroma(", "text": "저장된 조문 벡터 DB 를 폴더·컬렉션 이름으로 지정해 엶." },
        { "at": "collection_name=COLLECTION_NAME,", "text": "이 이름('patent_law')을 꼭 줘야 함 — 빼면 빈 칸이 열려 검색 0건이 됨." },
        { "at": "count = vectorstore._collection.count()", "text": "실제로 몇 건이 들어있는지 셈 — 연결이 잘 됐는지 확인하는 안전장치." },
        { "at": "if count == 0:", "text": "0건이면 연결 실패로 보고 명확한 오류를 내며 중단함." }
      ],
      "code": "def load_vectorstore():\n    \"\"\"8.0 인덱싱이 구축한 공용 벡터 DB를 임베딩 없이 로드하여 반환함.\n\n    핵심 주의점: langchain_chroma의 기본 컬렉션명은 'langchain'이므로 collection_name을\n    명시하지 않으면 오류 없이 빈 컬렉션이 열려 검색이 0건이 됨(침묵 실패). 따라서\n    8.0 인덱싱이 저장한 컬렉션명(patent_law)을 반드시 지정하고, 적재 건수를 검증함.\n    \"\"\"\n    from langchain_chroma import Chroma           # Chroma: ChromaDB 벡터 스토어 LangChain 래퍼\n    from langchain_openai import OpenAIEmbeddings  # OpenAIEmbeddings: 텍스트를 1536차원 벡터로 변환\n\n    if not VECTORDB_DIR.exists():\n        raise FileNotFoundError(\n            f\"공용 벡터 DB를 찾을 수 없음: {VECTORDB_DIR}\\n\"\n            f\"먼저 8.0 인덱싱(hands-on/10.rag/indexing/indexing.py)을 실행하세요.\"\n        )\n\n    # 쿼리 임베딩에만 사용함 — 코퍼스는 이미 임베딩되어 저장돼 있으므로 재인덱싱하지 않음\n    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL, api_key=os.environ.get(\"OPENAI_API_KEY\"))\n\n    vectorstore = Chroma(\n        persist_directory=str(VECTORDB_DIR),\n        collection_name=COLLECTION_NAME,\n        embedding_function=embeddings,\n    )\n\n    # ._collection.count(): 컬렉션에 실제 저장된 벡터 개수 — 0이면 컬렉션 연결 실패로 간주하고 중단함\n    count = vectorstore._collection.count()\n    if count == 0:\n        raise RuntimeError(\n            f\"컬렉션 '{COLLECTION_NAME}'에 문서가 없음(연결 실패 가능). \"\n            f\"persist_directory/collection_name이 8.0 인덱싱과 일치하는지 확인하세요.\"\n        )\n    print(f\"  - 공용 벡터 DB 로드 완료: 컬렉션 '{COLLECTION_NAME}', 저장 벡터 {count}건\")\n    return vectorstore"
    },
    {
      "id": "load_compressor",
      "name": "load_compressor()",
      "fileId": "main",
      "summary": "정밀 채점 모델(Cross-Encoder)을 불러오고, 그것을 LangChain '압축기(Compressor)'로 감쌈.",
      "how": "HuggingFaceCrossEncoder 로 한국어 재정렬 모델을 올림 — 이 모델의 .score() 는 질문·문서 쌍의 관련도를 0~1 로 매김(1에 가까울수록 관련). 이 모델을 CrossEncoderReranker(top_n=5) 로 감싸면, '많은 후보를 점수로 다시 줄 세워 상위 5개만 남기는' LangChain 표준 압축기가 됨. 반환값으로 모델과 압축기를 함께 돌려주는데, 모델은 점수를 화면에 표시할 때, 압축기는 검색기를 조립할 때 씀.",
      "terms": ["Cross-Encoder", "HuggingFaceCrossEncoder", "CrossEncoderReranker", "Compressor", "top_n", "sigmoid", "Re-ranking"],
      "lines": [
        { "at": "from langchain_classic.retrievers.document_compressors import CrossEncoderReranker", "text": "langchain 1.x 에서 재정렬 압축기는 langchain_classic 경로로 옮겨졌음." },
        { "at": "model = HuggingFaceCrossEncoder(model_name=RERANKER_MODEL)", "text": "질문+문서를 함께 보고 관련도를 0~1 로 채점하는 정밀 모델을 올림." },
        { "at": "compressor = CrossEncoderReranker(model=model, top_n=RERANK_K)", "text": "그 모델로 후보를 다시 줄 세워 상위 5개(top_n)만 남기는 '압축기'를 만듦." },
        { "at": "return model, compressor", "text": "점수 표시용 모델과 검색기 조립용 압축기를 함께 돌려줌." }
      ],
      "code": "def load_compressor():\n    \"\"\"Cross-Encoder 모델과 그것을 감싼 LangChain Compressor를 함께 로드하여 반환함.\n\n    HuggingFaceCrossEncoder: sentence-transformers의 CrossEncoder를 LangChain 인터페이스로 감싼 래퍼.\n        쿼리-문서 쌍을 함께 입력해 관련도를 평가하며, .score()는 0~1로 정규화된 점수(numpy 배열)를 반환함.\n        (10.rag/re-ranking의 FlagReranker.compute_score(normalize=True)와 동일한 의미의 점수)\n    CrossEncoderReranker: 위 모델을 LangChain DocumentCompressor로 만든 것. compress_documents()가\n        1차 검색 결과를 재정렬한 뒤 상위 top_n개만 남겨 \"압축(compression)\"함.\n\n    반환: (model, compressor) — model은 점수 표시(교육용)에, compressor는 retriever 구성에 사용함.\n    \"\"\"\n    from langchain_community.cross_encoders import HuggingFaceCrossEncoder\n    from langchain_classic.retrievers.document_compressors import CrossEncoderReranker\n\n    print(f\"  - Re-ranker 로드: {RERANKER_MODEL}\")\n    print(\"    (최초 실행 시 모델 다운로드로 수 분 소요될 수 있음)\")\n    model = HuggingFaceCrossEncoder(model_name=RERANKER_MODEL)\n    compressor = CrossEncoderReranker(model=model, top_n=RERANK_K)  # 재정렬 후 Top-RERANK_K로 압축\n    return model, compressor"
    },
    {
      "id": "build_compression_retriever",
      "name": "build_compression_retriever()",
      "fileId": "main",
      "summary": "'1차 검색기'와 '압축기'를 하나로 묶어, 호출 한 번에 검색→재정렬→압축까지 하는 통합 검색기를 만듦.",
      "how": "이 예제의 핵심임. 먼저 벡터 DB 를 as_retriever(k=50) 로 '검색기'로 바꿈(넓게 50개). 그 검색기를 base_retriever 로, 앞서 만든 압축기를 base_compressor 로 ContextualCompressionRetriever 에 끼움. 이렇게 묶으면 retriever.invoke(질문) 한 번이 ① 50개 1차 검색 → ② 정밀 재정렬 → ③ 상위 5개 압축을 자동으로 다 함. 재정렬 방식을 바꾸고 싶으면 base_compressor 만 다른 압축기(예: Cohere)로 갈아 끼우면 됨 — 나머지 코드는 그대로.",
      "terms": ["ContextualCompressionRetriever", "base_retriever", "as_retriever", "Compressor", "invoke"],
      "lines": [
        { "at": "from langchain_classic.retrievers import ContextualCompressionRetriever", "text": "검색기+압축기를 묶어 주는 통합 검색기 클래스를 가져옴." },
        { "at": "base_retriever = vectorstore.as_retriever(search_kwargs={\"k\": INITIAL_K})", "text": "벡터 DB 를 '한 번에 50개를 찾는 검색기'로 변환함." },
        { "at": "base_retriever=base_retriever,   # 1단계: 초기 검색(Bi-Encoder)", "text": "1단계: 넓게 찾는 1차 검색기를 끼움." },
        { "at": "base_compressor=compressor,      # 2단계: 압축(Cross-Encoder 재정렬 + Top-N)", "text": "2단계: 정밀 재정렬 압축기를 끼움 — 재정렬 방식을 바꾸려면 여기만 교체." }
      ],
      "code": "def build_compression_retriever(vectorstore, compressor):\n    \"\"\"1차 검색 retriever를 Compressor로 감싼 ContextualCompressionRetriever를 구성하여 반환함.\n\n    ContextualCompressionRetriever.invoke(query) 한 번이 내부적으로\n      ① base_retriever로 1차 검색(Top-INITIAL_K) → ② base_compressor로 재정렬·압축(Top-RERANK_K)\n    을 순차 수행함. 즉 10.rag 예제의 수동 2단계가 이 retriever 하나로 통합됨.\n\n    리랭크 방식 교체는 base_compressor만 바꾸면 됨(예: ColBERTReranker, CohereRerank 등).\n    \"\"\"\n    from langchain_classic.retrievers import ContextualCompressionRetriever\n\n    # as_retriever: 벡터 스토어를 LangChain Retriever 인터페이스로 변환. k=INITIAL_K로 넓게 검색함\n    base_retriever = vectorstore.as_retriever(search_kwargs={\"k\": INITIAL_K})\n    return ContextualCompressionRetriever(\n        base_retriever=base_retriever,   # 1단계: 초기 검색(Bi-Encoder)\n        base_compressor=compressor,      # 2단계: 압축(Cross-Encoder 재정렬 + Top-N)  ← 여기만 교체하면 방식 변경\n    )"
    },
    {
      "id": "load_llm",
      "name": "load_llm()",
      "fileId": "main",
      "summary": "Groq 서비스에서 돌아가는 LLM(답을 쓰는 모델)을 준비함.",
      "how": "ChatGroq 로 Groq LPU 위의 LLM 을 연결함. temperature=0.3 은 '무작위성'을 낮게 둔 값 — 법률 답변은 매번 들쭉날쭉하면 안 되므로 일관되게 함. API 키가 .env 에 없으면 한참 뒤가 아니라 시작하자마자 명확한 오류를 내어 디버깅을 쉽게 함.",
      "terms": ["LLM", "ChatGroq", "temperature", "Groq LPU"],
      "lines": [
        { "at": "api_key = os.environ.get(\"GROQ_API_KEY\")", "text": ".env 에서 Groq API 키를 읽어 옴." },
        { "at": "if not api_key:", "text": "키가 없으면 실행 초반에 바로 오류를 내어 원인을 빨리 알게 함." },
        { "at": "return ChatGroq(", "text": "모델 이름·온도·최대 토큰·키를 지정해 LLM 연결 객체를 만들어 돌려줌." }
      ],
      "code": "def load_llm():\n    \"\"\"Groq LPU에서 서빙되는 LLM 인스턴스를 생성하여 반환함.\n\n    ChatGroq: Groq API용 LangChain 채팅 모델 래퍼(llm.invoke()로 대화 요청 전송).\n    temperature=0.3: 법률 답변의 일관성을 위해 낮은 무작위성 사용.\n    \"\"\"\n    from langchain_groq import ChatGroq\n\n    api_key = os.environ.get(\"GROQ_API_KEY\")\n    # API 키 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함\n    if not api_key:\n        raise RuntimeError(\"GROQ_API_KEY가 .env에 설정되지 않음\")\n    return ChatGroq(model=GROQ_MODEL, temperature=0.3, max_tokens=2048, api_key=api_key)"
    },
    {
      "id": "retrieve_initial",
      "name": "retrieve_initial()",
      "fileId": "main",
      "summary": "통합 검색기 속에 든 '1차 검색기'만 따로 꺼내, 재정렬 '전' 후보 50개를 가져옴.",
      "how": "통합 검색기(ContextualCompressionRetriever)는 최종 5개만 돌려주므로, '원래 1차 순위'를 알 수 없음. 그래서 그 안의 base_retriever 를 직접 꺼내 invoke 해서, 재정렬되기 전의 50개 순서를 따로 확보함 — 나중에 '몇 등에서 몇 등으로 바뀌었나(▲▼)'를 보여 주기 위함. 반환 리스트의 순서가 곧 1차 순위(맨 앞이 1위).",
      "terms": ["base_retriever", "invoke", "Document"],
      "lines": [
        { "at": "base_retriever = retriever.base_retriever", "text": "통합 검색기 안에 들어 있는 1차 검색기를 꺼냄." },
        { "at": "return base_retriever.invoke(query)", "text": "재정렬 전 상태로 후보 50개를 1차 순위 순서대로 가져옴." }
      ],
      "code": "def retrieve_initial(retriever, query: str) -> list:\n    \"\"\"1차 검색(base_retriever): 벡터 유사도로 상위 INITIAL_K개 후보를 추출함.\n\n    compression_retriever 내부의 base_retriever를 그대로 꺼내 호출함 — 재정렬 '전' 상태(1차 순위)를\n    교육 목적으로 노출하기 위함임. 반환 리스트의 순서가 곧 Bi-Encoder 기준 순위(1위가 첫 원소)임.\n    \"\"\"\n    base_retriever = retriever.base_retriever\n    return base_retriever.invoke(query)"
    },
    {
      "id": "rerank_with_scores",
      "name": "rerank_with_scores()",
      "fileId": "main",
      "summary": "통합 검색기로 최종 5개를 얻고, 각 문서에 '원래 1차 순위'와 '관련도 점수'를 붙여 돌려줌.",
      "how": "먼저 1차 후보 목록으로 '(출처·조각번호) → 1차 순위' 사전을 만들어 둠. 그 다음 retriever.invoke(질문) 한 번으로 검색→재정렬→상위 5개 압축까지 끝냄. 통합 검색기는 점수를 알려 주지 않으므로, 화면 표시용 점수만 최종 5개에 대해 model.score() 로 다시 계산함(5개뿐이라 비용은 무시 가능). 끝으로 각 문서를 (1차 순위, 문서, 점수) 세 쪽 묶음으로 만들어 돌려줌 — 출력 단계가 이걸로 ▲▼ 변화를 그림.",
      "terms": ["invoke", "page_content", "sigmoid", "metadata", "Top-K"],
      "lines": [
        { "at": "initial_rank_by_key = {_doc_key(doc): rank for rank, doc in enumerate(initial_docs, start=1)}", "text": "각 문서의 (출처·조각번호)에 1차 순위를 1부터 매겨 빠르게 찾을 사전을 만듦." },
        { "at": "reranked_docs = retriever.invoke(query)", "text": "통합 검색기 한 번 호출로 검색→재정렬→상위 5개 압축까지 끝냄(핵심)." },
        { "at": "if not reranked_docs:", "text": "결과가 비면 빈 목록을 돌려 줌(안전 처리)." },
        { "at": "pairs = [(query, doc.page_content) for doc in reranked_docs]", "text": "표시용 점수를 내려고 '질문+문서본문' 쌍 5개를 만듦." },
        { "at": "scores = model.score(pairs)", "text": "최종 5개의 관련도 점수(0~1)를 다시 계산함 — 화면에 보여 줄 용도." },
        { "at": "initial_rank = initial_rank_by_key.get(_doc_key(doc), -1)", "text": "이 문서가 1차 검색에서 몇 등이었는지 사전에서 찾음." },
        { "at": "ranked.append((initial_rank, doc, float(score)))", "text": "(1차 순위, 문서, 점수) 묶음으로 쌓아 순위 변화 비교의 재료로 만듦." }
      ],
      "code": "def rerank_with_scores(model, retriever, query: str, initial_docs: list) -> list:\n    \"\"\"compression_retriever로 재정렬·압축한 Top-K에 1차 순위와 관련도 점수를 부착해 반환함.\n\n    - 재정렬·압축: retriever.invoke(query)가 내부에서 base_retriever 검색 + compressor 압축을 수행함.\n      (initial_docs와 동일한 1차 검색을 거치므로 두 결과를 (source, chunk_index) 키로 대응시킬 수 있음)\n    - 점수: ContextualCompressionRetriever는 점수를 메타데이터로 노출하지 않으므로, 표시용으로\n      model.score()를 최종 Top-K에 대해서만 다시 계산함(5건뿐이라 비용 무시 가능).\n\n    반환 형식: (원래_1차순위, doc, 관련도점수) 튜플 리스트 — 재정렬로 순위가 어떻게 바뀌었는지(교육 목적)\n    출력 단계에서 비교할 수 있게 함.\n    \"\"\"\n    # 1차 순위 조회용 인덱스: (source, chunk_index) → 1부터 시작하는 1차 검색 순위\n    initial_rank_by_key = {_doc_key(doc): rank for rank, doc in enumerate(initial_docs, start=1)}\n\n    # 통합 retriever 한 번 호출로 검색→재정렬→Top-K 압축까지 완료(이 예제의 핵심)\n    reranked_docs = retriever.invoke(query)\n    if not reranked_docs:\n        return []\n\n    # 표시용 관련도 점수: 최종 Top-K 쌍에 대해서만 Cross-Encoder 점수를 재계산함(0~1 정규화 값)\n    pairs = [(query, doc.page_content) for doc in reranked_docs]\n    scores = model.score(pairs)\n\n    ranked = []\n    for doc, score in zip(reranked_docs, scores):\n        initial_rank = initial_rank_by_key.get(_doc_key(doc), -1)  # 못 찾으면 -1(이론상 발생하지 않음)\n        ranked.append((initial_rank, doc, float(score)))\n    return ranked"
    },
    {
      "id": "helpers",
      "name": "_doc_key() · _doc_label()",
      "fileId": "main",
      "summary": "문서를 식별하는 작은 도우미 두 개 — 하나는 비교용 '열쇠', 하나는 화면 표시용 '이름표'.",
      "how": "_doc_key() 는 (출처, 조각번호) 짝을 만들어, 1차 결과와 재정렬 결과의 '같은 문서'를 맞춰 보는 열쇠로 씀. _doc_label() 은 같은 정보를 '특허법.pdf #20' 처럼 사람이 읽기 좋은 짧은 이름표로 만듦. 둘 다 문서의 metadata(부가 정보)에서 값을 꺼냄.",
      "terms": ["metadata", "튜플"],
      "lines": [
        { "at": "return (doc.metadata.get(\"source\"), doc.metadata.get(\"chunk_index\"))", "text": "출처 파일과 조각 번호를 짝지어, 같은 문서인지 가려내는 고유 열쇠로 씀." },
        { "at": "source = doc.metadata.get(\"source\", \"알 수 없음\")", "text": "어느 파일에서 나온 조각인지(없으면 '알 수 없음')." },
        { "at": "return f\"{source} #{chunk_index}\"", "text": "'특허법.pdf #20' 형태의 짧은 표시용 이름표를 만듦." }
      ],
      "code": "def _doc_key(doc) -> tuple:\n    \"\"\"문서를 고유 식별하는 키(source, chunk_index) — 1차 순위와 재정렬 결과를 대응시키는 데 사용함.\"\"\"\n    return (doc.metadata.get(\"source\"), doc.metadata.get(\"chunk_index\"))\n\n\ndef _doc_label(doc) -> str:\n    \"\"\"문서 메타데이터(공용 DB는 source/chunk_index만 존재)를 짧은 라벨로 만듦.\"\"\"\n    source = doc.metadata.get(\"source\", \"알 수 없음\")\n    chunk_index = doc.metadata.get(\"chunk_index\", \"?\")\n    return f\"{source} #{chunk_index}\""
    },
    {
      "id": "print_reranked_results",
      "name": "print_reranked_results()",
      "fileId": "main",
      "summary": "재정렬 결과를 출력하되, 1차 순위 대비 몇 계단 올랐는지/내렸는지 ▲▼ 화살표로 보여 줌.",
      "how": "최종 5개를 돌면서, '1차 순위 - 새 순위' 로 이동 폭을 계산함. 양수면 올라간 것(▲), 음수면 내려간 것(▼), 0이면 그대로(─). 예: 1차 46위가 4위가 되면 46-4=42 라서 ▲42 로 찍힘. 함께 점수와 이름표, 본문 앞부분 미리보기도 출력해 재정렬 효과를 한눈에 보게 함.",
      "terms": ["enumerate", "Re-ranking", "recall", "precision"],
      "lines": [
        { "at": "for new_rank, (initial_rank, doc, score) in enumerate(reranked, start=1):", "text": "재정렬된 5개를 새 순위(1부터)와 함께 하나씩 돎." },
        { "at": "move = initial_rank - new_rank", "text": "1차 순위에서 새 순위로 몇 계단 움직였는지 계산." },
        { "at": "marker = f\"▲{move}\" if move > 0 else (f\"▼{-move}\" if move < 0 else \"─\")", "text": "올랐으면 ▲, 내렸으면 ▼, 그대로면 ─ 표시를 고름." },
        { "at": "preview = doc.page_content[:70].replace(\"\\n\", \" \")", "text": "본문 앞 70자만 한 줄 미리보기로 잘라 냄." }
      ],
      "code": "def print_reranked_results(reranked: list) -> None:\n    \"\"\"Re-ranking 결과를 출력하되, 1차 순위 → 재정렬 순위 변화를 함께 표시함.\"\"\"\n    print(\"\\n\" + \"=\" * 70)\n    print(f\"[Re-ranking] Compressor Top-{len(reranked)} (1차 순위 → 재정렬 순위)\")\n    print(\"=\" * 70)\n    for new_rank, (initial_rank, doc, score) in enumerate(reranked, start=1):\n        # 1차 순위 대비 상승/하강/유지를 화살표로 표시해 재정렬 효과를 시각화함\n        move = initial_rank - new_rank\n        marker = f\"▲{move}\" if move > 0 else (f\"▼{-move}\" if move < 0 else \"─\")\n        preview = doc.page_content[:70].replace(\"\\n\", \" \")\n        print(f\"  {new_rank}. (1차 {initial_rank:2d}위 {marker}) [점수 {score:.4f}] {_doc_label(doc)}\")\n        print(f\"     {preview}...\")"
    },
    {
      "id": "format_context",
      "name": "format_context()",
      "fileId": "main",
      "summary": "최종 문서 5개를 LLM 에게 넘길 하나의 '근거 묶음' 글로 합침.",
      "how": "각 문서에 '[문서 1] (출처…, 관련도 0.99)' 같은 머리말을 붙이고 본문을 이어, 구분선(---)으로 5개를 연결함. 이렇게 만든 글이 시스템 프롬프트의 {context} 자리에 들어가, LLM 이 '이 안에서만' 답을 만들게 함.",
      "terms": ["시스템 프롬프트", "Top-K"],
      "lines": [
        { "at": "for new_rank, (_initial_rank, doc, score) in enumerate(reranked, start=1):", "text": "최종 5개 문서를 순서대로 돎(1차 순위는 여기선 안 쓰므로 밑줄로 무시)." },
        { "at": "header = f\"[문서 {new_rank}] (출처: {_doc_label(doc)}, 관련도 {score:.4f})\"", "text": "문서마다 출처·관련도를 적은 머리말을 붙임." },
        { "at": "return \"\\n\\n---\\n\\n\".join(blocks)", "text": "5개 문서 글을 구분선으로 이어 하나의 근거 묶음으로 만듦." }
      ],
      "code": "def format_context(reranked: list) -> str:\n    \"\"\"재정렬된 문서들을 LLM 프롬프트에 넣을 컨텍스트 문자열로 합침.\"\"\"\n    blocks = []\n    for new_rank, (_initial_rank, doc, score) in enumerate(reranked, start=1):\n        header = f\"[문서 {new_rank}] (출처: {_doc_label(doc)}, 관련도 {score:.4f})\"\n        blocks.append(f\"{header}\\n{doc.page_content}\")\n    return \"\\n\\n---\\n\\n\".join(blocks)"
    },
    {
      "id": "build_chain",
      "name": "build_chain()",
      "fileId": "main",
      "summary": "'프롬프트 → LLM → 글자만 뽑기' 순서로 이어지는 답변 생성 라인을 조립함.",
      "how": "ChatPromptTemplate 로 시스템 메시지(역할 지시)와 사람 메시지(질문)를 묶은 틀을 만들고, 파이프(|) 로 프롬프트→LLM→StrOutputParser 를 연결함. 이게 LangChain 의 LCEL 방식 — 레고처럼 부품을 | 로 이어 한 줄로 만듦. StrOutputParser 는 LLM 응답에서 본문 글자만 깔끔히 뽑아냄.",
      "terms": ["ChatPromptTemplate", "StrOutputParser", "LCEL", "파이프"],
      "lines": [
        { "at": "prompt = ChatPromptTemplate.from_messages([", "text": "시스템 지시 + 사람 질문으로 이뤄진 대화 틀을 만듦." },
        { "at": "(\"system\", SYSTEM_PROMPT),", "text": "'법률 용어를 쉽게 풀어 답하라'는 역할 지시(컨텍스트 자리 포함)." },
        { "at": "return prompt | llm | StrOutputParser()", "text": "프롬프트→LLM→본문추출을 파이프로 이어 한 줄짜리 실행 라인으로 만듦." }
      ],
      "code": "def build_chain(llm):\n    \"\"\"프롬프트 → LLM → 문자열 추출로 이어지는 LCEL 체인을 구성함.\"\"\"\n    from langchain_core.prompts import ChatPromptTemplate   # 시스템/사용자 메시지 템플릿\n    from langchain_core.output_parsers import StrOutputParser  # LLM 응답에서 본문 문자열만 추출\n\n    prompt = ChatPromptTemplate.from_messages([\n        (\"system\", SYSTEM_PROMPT),\n        (\"human\", \"{question}\"),\n    ])\n    # LCEL 파이프: prompt가 만든 메시지를 llm에 전달하고 결과를 문자열로 파싱함\n    return prompt | llm | StrOutputParser()"
    },
    {
      "id": "run_query",
      "name": "run_query()",
      "fileId": "main",
      "summary": "질문 하나에 대해 1차 검색 → 재정렬 → 답변 생성의 전체 흐름을 차례로 실행함.",
      "how": "이 함수가 한 질문의 처음부터 끝까지를 지휘함. ① retrieve_initial 로 1차 후보 50개를 가져와 미리보기 출력 → ② rerank_with_scores 로 통합 검색기를 돌려 최종 5개와 순위 변화를 만들어 출력 → ③ format_context 로 5개를 근거 묶음으로 합쳐 체인(chain)에 질문과 함께 넘겨 답을 생성·출력함.",
      "terms": ["invoke", "Re-ranking"],
      "lines": [
        { "at": "initial_docs = retrieve_initial(retriever, query)", "text": "1단계: 재정렬 전 1차 후보 50개를 가져옴." },
        { "at": "reranked = rerank_with_scores(model, retriever, query, initial_docs)", "text": "2단계: 통합 검색기로 정밀 재정렬해 최종 5개(+순위 변화)를 얻음." },
        { "at": "context = format_context(reranked)", "text": "3단계 준비: 최종 5개를 LLM 에 줄 근거 묶음 글로 합침." },
        { "at": "answer = chain.invoke({\"context\": context, \"question\": query})", "text": "3단계: 근거와 질문을 체인에 넣어 LLM 답변을 생성함." }
      ],
      "code": "def run_query(model, retriever, chain, query: str) -> None:\n    \"\"\"질의 하나에 대해 1차 검색 → Re-ranking(Compressor) → 답변 생성의 전체 흐름을 수행함.\"\"\"\n    print(f\"\\n질문: {query}\")\n\n    # 1) 1차 검색 (base_retriever, 넓게) — 재정렬 '전' 상태를 교육 목적으로 노출\n    initial_docs = retrieve_initial(retriever, query)\n    print_initial_results(initial_docs)\n\n    # 2) Re-ranking (Compressor, 정밀) — ContextualCompressionRetriever가 검색→재정렬→압축을 통합 수행\n    reranked = rerank_with_scores(model, retriever, query, initial_docs)\n    print_reranked_results(reranked)\n\n    # 3) 답변 생성 (재정렬 Top-K만 컨텍스트로 사용)\n    print(\"\\n답변 생성 중...\\n\")\n    context = format_context(reranked)\n    answer = chain.invoke({\"context\": context, \"question\": query})\n    print(\"-\" * 70)\n    print(answer)\n    print(\"-\" * 70)"
    },
    {
      "id": "main",
      "name": "main()",
      "fileId": "main",
      "summary": "필요한 부품을 모두 준비한 뒤 기본 질문으로 한 번 시연하고, 사용자가 직접 묻는 대화 모드로 들어감.",
      "how": "프로그램의 시작점임. ① 벡터 DB·재정렬 모델/압축기·통합 검색기·답변 체인을 차례로 준비함. ② 기본 질문(특허 요건)으로 run_query 를 한 번 돌려 전체 흐름을 시연함. ③ 그 뒤 while 무한 루프로 들어가 사용자가 직접 질문을 입력하게 함 — quit/q/빈 줄이면 종료. 질문 처리 중 오류가 나도 프로그램이 죽지 않고 메시지만 보여 주고 계속 받음.",
      "terms": ["while 루프", "invoke"],
      "lines": [
        { "at": "vectorstore = load_vectorstore()", "text": "준비①: 공용 벡터 DB 를 엶." },
        { "at": "model, compressor = load_compressor()", "text": "준비②: 정밀 재정렬 모델과 압축기를 올림." },
        { "at": "retriever = build_compression_retriever(vectorstore, compressor)", "text": "준비③: 검색기+압축기를 묶은 통합 검색기를 만듦." },
        { "at": "run_query(model, retriever, chain, DEFAULT_QUERY)", "text": "기본 질문으로 전체 파이프라인을 한 번 시연함." },
        { "at": "question = input(\"\\n질문> \").strip()", "text": "대화 모드: 사용자가 직접 질문을 입력하게 받음." },
        { "at": "if not question or question.lower() in {\"quit\", \"q\", \"exit\", \"종료\"}:", "text": "빈 줄이나 종료어를 입력하면 루프를 빠져나옴." }
      ],
      "code": "def main() -> None:\n    \"\"\"리소스 로드 후 기본 질의어 데모를 1회 실행하고 대화형 입력 루프로 진입함.\"\"\"\n    print(\"=\" * 70)\n    print(\"특허법 RAG 예제 (Re-ranking / LangChain Compressor)\")\n    print(f\"설정: 1차 검색 Top-{INITIAL_K} → Compressor 재정렬 → Top-{RERANK_K} / LLM: {GROQ_MODEL}\")\n    print(\"=\" * 70)\n\n    print(\"\\n[준비] 리소스 로드\")\n    vectorstore = load_vectorstore()\n    model, compressor = load_compressor()\n    retriever = build_compression_retriever(vectorstore, compressor)\n    chain = build_chain(load_llm())\n\n    # 기본 질의어로 전체 파이프라인을 1회 시연함\n    run_query(model, retriever, chain, DEFAULT_QUERY)\n\n    # 대화형 루프: 사용자가 직접 질문을 입력해 재정렬 효과를 체험할 수 있게 함\n    print(\"\\n\" + \"=\" * 70)\n    print(\"대화형 모드 — 질문을 입력하세요 (종료: quit / q / 빈 줄)\")\n    print(\"=\" * 70)\n    while True:\n        try:\n            question = input(\"\\n질문> \").strip()\n        except (EOFError, KeyboardInterrupt):\n            print(\"\\n종료합니다.\")\n            break\n        if not question or question.lower() in {\"quit\", \"q\", \"exit\", \"종료\"}:\n            print(\"종료합니다.\")\n            break\n        try:\n            run_query(model, retriever, chain, question)\n        except Exception as error:\n            print(f\"\\n[오류] 질의 처리 실패: {error}\")"
    }
  ],
  "glossary": {
    "import": "다른 사람이 만든 코드 묶음(라이브러리)이나 같은 프로젝트의 다른 파일을 '가져와' 쓰는 명령.",
    "KMP_DUPLICATE_LIB_OK": "수치 계산 가속 런타임(OpenMP)이 두 번 로드돼 윈도우에서 프로그램이 죽는 것을 눈감아 주도록 켜는 환경 설정값.",
    "세그폴트": "Segmentation fault. 프로그램이 허용되지 않은 메모리를 건드려 갑자기 비정상 종료되는 오류.",
    "UTF-8": "한글을 포함한 전 세계 문자를 깨지지 않게 표현하는 표준 글자 인코딩 방식.",
    "__file__": "지금 실행 중인 파이썬 파일 자신의 경로. 이를 기준으로 다른 파일 위치를 안전하게 계산함.",
    "dotenv": ".env 파일에 적어 둔 비밀 값(API 키 등)을 프로그램의 환경변수로 불러오는 도구.",
    "임베딩": "글(문장·단어)을 의미가 담긴 숫자 목록(벡터)으로 바꾸는 것. 비슷한 의미면 숫자도 비슷해져 '의미 검색'이 가능해짐.",
    "벡터 DB": "임베딩(숫자 벡터)을 저장하고, 질문 벡터와 가장 비슷한 것을 빠르게 찾아 주는 특수 데이터베이스.",
    "ChromaDB": "로컬 폴더에 저장되는 가벼운 벡터 DB. 이 예제는 옆 예제가 만든 ChromaDB 를 빌려 씀.",
    "컬렉션": "벡터 DB 안에서 문서 묶음을 담는 칸(이름표). 이름을 정확히 지정해야 그 칸을 열 수 있음.",
    "OpenAIEmbeddings": "OpenAI 의 임베딩 모델로 글을 벡터로 바꿔 주는 LangChain 도구.",
    "조용한 실패": "오류 메시지 없이 잘못 동작하는 상황. 여기선 컬렉션 이름을 빼면 빈 칸이 열려 검색 0건이 되는 경우.",
    "Bi-Encoder": "질문과 문서를 '따로따로' 벡터로 바꿔 비교하는 방식. 빠르지만 거칠어 1차 검색에 씀.",
    "Cross-Encoder": "질문과 문서를 '하나로 붙여' 통째로 보고 관련도를 매기는 방식. 단어 상호작용까지 따져 정확하지만 느려서 소수 후보 재정렬에 씀.",
    "Re-ranking": "1차 검색으로 넓게 가져온 후보를, 더 정밀한 모델(Cross-Encoder)로 다시 줄 세워 진짜 관련 있는 것을 위로 올리는 것.",
    "HuggingFaceCrossEncoder": "허깅페이스의 Cross-Encoder 재정렬 모델을 LangChain 에서 쓰도록 감싼 래퍼. .score() 로 관련도 점수를 냄.",
    "CrossEncoderReranker": "Cross-Encoder 로 후보를 다시 줄 세워 상위 top_n 개만 남기는 LangChain '압축기(Compressor)'.",
    "Compressor": "검색된 문서 묶음을 '재정렬하거나 불필요한 것을 걸러' 더 알찬 소수로 압축하는 LangChain 부품. 종류만 갈아 끼우면 재정렬 방식이 바뀜.",
    "ContextualCompressionRetriever": "'1차 검색기 + 압축기'를 하나로 묶은 검색기. invoke() 한 번에 검색→재정렬→압축을 자동으로 다 해 줌.",
    "base_retriever": "ContextualCompressionRetriever 안에 들어가는 '1차 검색기'. 넓게(여기선 50개) 후보를 가져오는 역할.",
    "as_retriever": "벡터 DB 를 LangChain 의 표준 '검색기' 형태로 바꿔 주는 메서드. k 값으로 가져올 개수를 정함.",
    "top_n": "재정렬 후 최종적으로 남길 문서 개수. 이 예제에선 5.",
    "Top-K": "유사도/점수 상위 K개만 고르는 것. 1차는 Top-50, 재정렬 후는 Top-5.",
    "invoke": "LangChain 부품(검색기·체인 등)을 '실행'하라는 표준 호출. 입력을 주면 결과를 돌려줌.",
    "sigmoid": "어떤 점수를 0~1 사이 값으로 눌러 주는 수학 함수. 재정렬 점수를 '관련도 확률'처럼 0~1 로 표현하는 데 씀.",
    "metadata": "문서 본문 외의 부가 정보(출처 파일명·조각 번호 등). 같은 문서를 가려내거나 이름표를 만드는 데 씀.",
    "page_content": "LangChain 문서(Document) 객체에서 실제 본문 글자가 담긴 부분.",
    "Document": "LangChain 에서 한 조각의 문서를 담는 객체. 본문(page_content)과 부가정보(metadata)를 가짐.",
    "튜플": "여러 값을 괄호로 묶어 한 덩어리로 다루는 파이썬 자료형. 예: (출처, 조각번호).",
    "enumerate": "목록을 돌 때 '번호'와 '원소'를 함께 꺼내 주는 파이썬 도구. start=1 이면 1번부터 셈.",
    "recall": "재현율. 정작 필요한 관련 문서를 얼마나 빠짐없이 찾아왔는지의 정도. 넓게 검색하면 올라감.",
    "precision": "정밀도. 가져온 문서 중 진짜 관련 있는 것의 비율. 재정렬로 위쪽을 정리하면 올라감.",
    "LLM": "Large Language Model. 대량의 글로 학습해 사람처럼 글을 이해하고 답을 생성하는 인공지능 모델.",
    "ChatGroq": "Groq 서비스의 LLM 을 LangChain 채팅 모델로 쓰게 해 주는 래퍼.",
    "Groq LPU": "Groq 사가 만든, LLM 추론을 아주 빠르게 처리하는 특수 칩(서비스).",
    "temperature": "LLM 답변의 무작위성 정도. 낮을수록(예 0.3) 일관되고 안정적인 답을 냄.",
    "시스템 프롬프트": "LLM 에게 '너의 역할·규칙은 이렇다'고 미리 알려 주는 지시문. 여기선 법률 용어를 쉽게 풀라고 시킴.",
    "ChatPromptTemplate": "시스템 메시지·사람 메시지 등을 빈칸({context}·{question}) 채우기 식으로 조립하는 프롬프트 틀.",
    "StrOutputParser": "LLM 응답 객체에서 사람이 읽을 본문 문자열만 깔끔히 뽑아내는 LangChain 부품.",
    "LCEL": "LangChain Expression Language. 부품들을 파이프(|)로 이어 한 줄짜리 실행 흐름(체인)으로 만드는 방식.",
    "파이프": "기호 |. 앞 부품의 출력을 뒤 부품의 입력으로 자동으로 흘려보내 연결함.",
    "while 루프": "조건이 참인 동안 같은 코드를 반복 실행하는 구조. 여기선 사용자가 종료할 때까지 질문을 계속 받음."
  }
};
