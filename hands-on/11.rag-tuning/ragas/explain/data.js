window.EXPLAIN_DATA = {
  "meta": {
    "title": "RAGAS — 청킹 사이즈를 바꿔가며 RAG 품질을 측정·비교하는 평가 예제",
    "entry": "evaluate_ragas.py"
  },
  "files": [
    {
      "id": "main",
      "label": "evaluate_ragas.py",
      "role": "청킹 사이즈를 바꿔가며 RAG를 실행하고 RAGAS 지표로 검색·생성 품질을 측정해 최적값을 고르는 메인 파이프라인"
    },
    {
      "id": "dataset",
      "label": "test_dataset.py",
      "role": "특허법 PDF 조문을 직접 대조해 만든 질문·정답(ground truth) 테스트 케이스 모음 — 메인이 import 해서 사용"
    }
  ],
  "flow": [
    {
      "step": 1,
      "title": "실행 & 준비 (키·경로·재사용 모듈)",
      "summary": "python evaluate_ragas.py 로 실행하고, .env 키와 다른 예제의 검증된 로직을 불러옴",
      "detail": "터미널에서 'python evaluate_ragas.py' 로 실행함. 시작과 함께 .env 의 OPENAI_API_KEY(임베딩·평가자 LLM)와 GROQ_API_KEY(생성 LLM)를 읽음. 이 예제의 핵심은 '한 번에 하나의 변수만 바꿔 공정하게 비교'하는 것이라, 인덱싱(쪼개기)·생성(답하기) 로직은 옆 예제(indexing.py·naive_rag.py)에서 그대로 import 해 조건을 통일함. 비유하면, 요리 대결에서 '오븐 온도'만 바꿔 비교하려고 재료·레시피·접시는 전부 똑같이 맞춰 두는 준비 단계."
    },
    {
      "step": 2,
      "title": "평가 데이터셋 로드 (질문·정답)",
      "summary": "특허법 조문으로 손수 만든 질문 22개와 정답(ground truth)을 가져옴",
      "detail": "test_dataset.py 안에 사람이 특허법 원문을 직접 대조해 적어 둔 '질문 + 정답' 22쌍이 들어 있음. RAG가 내놓은 답을 채점하려면 '모범 답안'이 필요한데, 그게 바로 ground truth 임. 메인은 get_test_dataset() 으로 이 목록을 통째로 받아 질문 리스트와 정답 리스트로 나눠 둠. 비유하면, 시험을 치르기 전에 '문제지와 정답지'를 먼저 손에 쥐는 단계."
    },
    {
      "step": 3,
      "title": "PDF 1회 로드·전처리",
      "summary": "특허법 PDF를 한 번만 읽고 머리글·페이지번호 같은 노이즈를 제거함",
      "detail": "PDF를 읽고 다듬는 일은 청킹 사이즈와 상관없으므로 후보마다 반복하지 않고 딱 한 번만 함(낭비 제거). indexing.py 의 load_pdfs·preprocess_documents 를 재사용해 다른 예제와 똑같이 전처리함. 비유하면, 여러 번 자를 종이를 우선 한 번 깨끗이 펴 두는 것."
    },
    {
      "step": 4,
      "title": "후보별 반복 ① 재청킹 + 임시 인덱싱",
      "summary": "각 chunk_size(400/800/1200)로 문서를 다시 쪼개 임시 벡터 DB에 임베딩함",
      "detail": "후보 크기마다 같은 구분자(LAW_SEPARATORS)로 문서를 다시 잘게 쪼갬(오버랩은 크기의 20% 고정). 쪼갠 청크를 OS 임시 폴더의 ChromaDB에 임베딩해 넣는데, 공용 벡터 DB(../vectordb)는 절대 건드리지 않음 (다른 예제가 쓰므로 보호). 평가가 끝나면 임시 DB는 지움. 비유하면, 똑같은 책을 '큰 조각/중간 조각/작은 조각'으로 따로따로 잘라 임시 서가 3개를 차리는 것."
    },
    {
      "step": 5,
      "title": "후보별 반복 ② RAG 실행 (검색 → 생성)",
      "summary": "질문마다 임시 DB에서 청크를 검색하고 Groq LLM으로 답을 생성함",
      "detail": "각 질문을 임베딩해 유사한 청크 Top-K를 검색하고(탐색), 그 청크를 근거로 넣어 Groq LLM이 답을 만듦(생성). 생성 조건은 naive 예제와 똑같이 맞춰(같은 프롬프트·모델) 청킹 크기 외 변수가 섞이지 않게 함. 분당 호출 한도 같은 일시 오류는 잠깐 기다렸다 다시 시도함(지수 백오프). 비유하면, 같은 시험관·같은 채점 기준으로 서가 3개에서 각각 답안을 작성해 보는 것."
    },
    {
      "step": 6,
      "title": "후보별 반복 ③ RAGAS 평가",
      "summary": "질문·검색 청크·답변·정답을 묶어 RAGAS가 6개 지표 점수를 계산함",
      "detail": "한 질문의 (질문·검색된 청크·생성 답변·정답)을 SingleTurnSample 로 묶고, 묶음을 EvaluationDataset 으로 만들어 evaluate() 에 넘김. 그러면 평가자 LLM(gpt-4o-mini)이 검색 지표 3종(문맥 정밀도·재현율·엔티티 재현율)과 생성 지표 3종(충실도·답변 관련성·사실 정확도)을 0~1 점수로 매김(LLM-as-judge). 비유하면, 사람 대신 또 다른 똑똑한 채점관이 '근거를 잘 찾았나/근거대로 답했나'를 항목별로 채점하는 것."
    },
    {
      "step": 7,
      "title": "집계 · 최적값 선정 · 저장",
      "summary": "후보별 종합 점수를 비교해 최적 chunk_size를 고르고 결과를 파일로 저장함",
      "detail": "각 후보의 점수를 평균 내 종합 점수를 만들고(검색 품질이 청킹의 핵심 효과라 검색 지표 평균을 기준으로 씀), 가장 높은 chunk_size 를 '최적값'으로 표시함. 비교 표를 콘솔에 출력하고 results/{시각}/ 폴더에 후보별 summary.json·detail.csv 와 전체 comparison.json·comparison.csv 로 저장함. 비유하면, 채점이 끝난 답안들의 점수표를 모아 '우승 레시피'를 발표하고 성적표를 파일로 보관하는 것."
    }
  ],
  "functions": [
    {
      "id": "setup",
      "name": "임포트·셰임·경로·재사용 모듈·상수",
      "fileId": "main",
      "summary": "필요한 모듈을 가져오고, 경로·키를 잡고, 다른 예제의 검증된 로직과 핵심 상수를 준비하는 파일 위쪽 코드 모음.",
      "how": "함수가 아니라 메인 파일 상단의 준비 코드임. ① RAGAS 가 import 시 참조하는 (제거된) langchain 경로 때문에 import 자체가 실패하는 것을 막으려고, 쓰지도 않는 더미 모듈을 미리 끼워 넣는 '호환 셰임'을 둠. ② 모든 경로를 이 파일 위치(__file__) 기준으로 계산함. ③ load_dotenv 로 OPENAI/GROQ 키를 올림. ④ indexing.py(인덱싱)·naive_rag.py(생성)·test_dataset.py(데이터셋)의 함수를 import 해 '동일 조건'을 보장함. ⑤ 평가자 LLM 이름·기본 chunk_size 후보·메트릭 라벨 같은 상수를 정함.",
      "terms": [
        "RAGAS",
        "호환 셰임",
        "load_dotenv",
        "from __future__ import annotations",
        "Path(__file__).resolve().parent",
        "임베딩",
        "평가자 LLM",
        "ground truth",
        "청크"
      ],
      "lines": [
        {
          "at": "from __future__ import annotations",
          "text": "타입 힌트를 문자열로 평가해 가볍게 쓰게 하는 파이썬 설정."
        },
        {
          "at": "_VERTEXAI_SHIM_MODULE = ",
          "text": "RAGAS 가 import 시 참조하는, 지금은 제거된 langchain 경로 이름을 변수로 둠."
        },
        {
          "at": "_shim_module.ChatVertexAI = type(",
          "text": "실제로는 안 쓰는 더미 클래스를 끼워 'import ragas' 만 성립하게 하는 호환 셰임."
        },
        {
          "at": "SCRIPT_DIR = Path(__file__)",
          "text": "이 파일이 있는 폴더(ragas/)를 절대경로로 구함 — 실행 위치와 무관하게 동작."
        },
        {
          "at": "PUBLIC_VECTORDB_DIR = RAG_DIR",
          "text": "공용 벡터 DB 경로 — 절대 건드리지 않도록 보호 대상으로 기억해 둠."
        },
        {
          "at": "load_dotenv(ENV_PATH)",
          "text": ".env 에서 OPENAI_API_KEY(임베딩·평가자)·GROQ_API_KEY(생성)를 읽어 올림."
        },
        {
          "at": "from indexing import (",
          "text": "인덱싱(PDF 로드·전처리·필터·구분자)을 다른 예제와 똑같이 쓰려고 그대로 가져옴."
        },
        {
          "at": "from naive_rag import (",
          "text": "생성(프롬프트·Groq LLM·검색 청크 포맷팅)을 naive 예제와 동일하게 가져옴."
        },
        {
          "at": "from test_dataset import get_test_dataset",
          "text": "질문·정답 테스트 케이스를 주는 함수를 같은 폴더 모듈에서 가져옴."
        },
        {
          "at": "EVAL_LLM_MODEL = \"gpt-4o-mini\"",
          "text": "RAGAS 채점을 맡는 평가자 LLM(생성 LLM과 별개, OpenAI)."
        },
        {
          "at": "DEFAULT_CHUNK_SIZES = ",
          "text": "비교할 기본 청킹 사이즈 후보 목록(400/800/1200)."
        },
        {
          "at": "OVERLAP_RATIO = 0.2",
          "text": "오버랩을 청킹 사이즈의 20%로 고정하는 규칙(공정 비교용)."
        },
        {
          "at": "RETRIEVAL_METRIC_LABELS = {",
          "text": "검색 지표의 내부 컬럼명을 사람이 읽는 한글 라벨로 매핑."
        },
        {
          "at": "GENERATION_METRIC_LABELS = {",
          "text": "생성 지표의 내부 컬럼명을 사람이 읽는 한글 라벨로 매핑."
        }
      ],
      "code": "from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함\n\nimport gc\nimport json\nimport shutil\nimport sys\nimport tempfile\nimport time\nfrom datetime import datetime\nfrom pathlib import Path\n\n# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함\nif hasattr(sys.stdout, \"reconfigure\"):\n    sys.stdout.reconfigure(encoding=\"utf-8\")\n\n# ---------------------------------------------------------------------------\n# RAGAS 호환 셰임 (langchain 1.x 상위 호환성 깨짐 우회) — 반드시 `import ragas` 이전에 실행\n# ---------------------------------------------------------------------------\n# ragas는 모듈 로드 시 langchain_community.chat_models.vertexai.ChatVertexAI를 무조건 import하지만,\n# langchain-community 1.x에서 해당 경로가 제거되어 `import ragas` 자체가 실패함. 본 예제의 평가 경로는\n# Vertex AI를 전혀 사용하지 않으므로, 실제로 인스턴스화되지 않는 더미 클래스를 주입해 import만 성립시킴.\nimport types\n\n_VERTEXAI_SHIM_MODULE = \"langchain_community.chat_models.vertexai\"\ntry:\n    __import__(_VERTEXAI_SHIM_MODULE)  # 경로가 살아 있으면(구버전) 셰임 불필요\nexcept ModuleNotFoundError:\n    _shim_module = types.ModuleType(_VERTEXAI_SHIM_MODULE)\n    # ragas가 참조만 하고 호출하지 않는 빈 더미 클래스 (이름만 존재하면 import 성립)\n    _shim_module.ChatVertexAI = type(\"ChatVertexAI\", (), {})\n    sys.modules[_VERTEXAI_SHIM_MODULE] = _shim_module\n\n# ---------------------------------------------------------------------------\n# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)\n# ---------------------------------------------------------------------------\nSCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(ragas/)를 절대경로로 구함\nRAG_DIR = SCRIPT_DIR.parent                     # hands-on/10.rag/\nDATA_DIR = RAG_DIR / \"data\"                     # 인덱싱 대상 PDF 디렉터리\nINDEXING_DIR = RAG_DIR / \"indexing\"             # 인덱싱 파이프라인(전처리·분할 로직 재사용 대상)\nNAIVE_DIR = RAG_DIR / \"naive\"                   # naive RAG 예제(생성 파이프라인 재사용 대상)\nPUBLIC_VECTORDB_DIR = RAG_DIR / \"vectordb\"      # 공용 벡터 DB (절대 건드리지 않음, 보호 대상)\nENV_PATH = RAG_DIR.parent / \".env\"              # hands-on/.env (API 키 보관)\nRESULTS_DIR = SCRIPT_DIR / \"results\"            # 평가 결과 저장 디렉터리\n\n# 재사용 모듈을 import 하기 위해 각 디렉터리를 모듈 검색 경로 맨 앞에 추가함\n# (SCRIPT_DIR을 먼저 넣어 ragas/test_dataset.py가 우선 선택되도록 함)\nfor module_dir in (SCRIPT_DIR, INDEXING_DIR, NAIVE_DIR):\n    # sys.path.insert(0, ...): 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 디렉터리를 추가함\n    sys.path.insert(0, str(module_dir))\n\n# ---------------------------------------------------------------------------\n# 환경변수 로드\n# ---------------------------------------------------------------------------\nfrom dotenv import load_dotenv\n\nload_dotenv(ENV_PATH)  # .env에서 OPENAI_API_KEY(임베딩·평가자)·GROQ_API_KEY(생성 LLM)를 로드함\n\n# ---------------------------------------------------------------------------\n# 재사용 모듈 import (인덱싱·생성 로직을 그대로 가져와 \"동일 조건\"을 보장)\n# ---------------------------------------------------------------------------\n# indexing.py: PDF 로드·전처리·노이즈 필터·메타데이터 로직과 법령 분할 구분자를 재사용함\n# (단, build_vectordb()는 shutil.rmtree로 공용 DB를 삭제하므로 절대 import·호출하지 않음)\nfrom indexing import (\n    EMBEDDING_MODEL,        # \"text-embedding-3-small\" (인덱싱과 동일한 임베딩 모델)\n    LAW_SEPARATORS,         # 법령 구조(조→항) 우선 분할 구분자\n    attach_metadata,        # 청크에 source/chunk_index 등 메타데이터 부여\n    filter_chunks,          # 머리글·개정 태그만 담긴 노이즈 청크 제거\n    load_pdfs,              # data 디렉터리의 PDF를 Document 리스트로 로드\n    preprocess_documents,   # 머리글·페이지번호 등 노이즈 제거(청크 크기와 무관, 1회만 수행)\n)\n\n# naive_rag.py: 검색→생성 파이프라인을 그대로 재사용 (RAG 생성 LLM·프롬프트가 naive와 동일해야 함)\nfrom naive_rag import (\n    HUMAN_PROMPT,    # [참고 문서]/[질문] 형식의 사용자 프롬프트 템플릿\n    SYSTEM_PROMPT,   # 검색 문서 근거로만 답하도록 제약하는 시스템 프롬프트\n    TOP_K,           # 유사도 검색 상위 청크 수 (고정 조건)\n    create_llm,      # Groq openai/gpt-oss-120b 채팅 모델 생성 (reasoning_format=\"hidden\")\n    format_docs,     # 검색 청크를 [출처 N] 라벨이 붙은 단일 문자열로 변환\n)\n\n# test_dataset.py(11.1): 특허법.pdf 조문 대조로 작성한 질문·정답 테스트 케이스\nfrom test_dataset import get_test_dataset\n\n# ---------------------------------------------------------------------------\n# 상수 정의\n# ---------------------------------------------------------------------------\nEVAL_LLM_MODEL = \"gpt-4o-mini\"               # RAGAS 평가자 LLM (생성 LLM과 별개, OpenAI)\nDEFAULT_CHUNK_SIZES = [400, 800, 1200]       # 기본 chunk_size 후보 (스윕 대상)\nOVERLAP_RATIO = 0.2                          # chunk_overlap = chunk_size * 0.2 (20% 고정)\nCOLLECTION_PREFIX = \"patent_law_cs\"          # 임시 컬렉션명 접두사 (예: patent_law_cs400)\n\n# RAGAS 결과 컬럼명 ↔ 사람이 읽는 메트릭명 매핑 (메트릭 그룹별로 구분)\n# 키는 result.to_pandas()의 컬럼명, 값은 출력용 한글 라벨임\nRETRIEVAL_METRIC_LABELS = {\n    \"llm_context_precision_with_reference\": \"Context Precision\",  # 검색 청크가 정답과 관련 있는 비율\n    \"context_recall\": \"Context Recall\",                            # 정답에 필요한 정보가 검색되었는지\n    \"context_entity_recall\": \"Context Entity Recall\",              # 정답의 핵심 엔티티가 검색되었는지\n}\nGENERATION_METRIC_LABELS = {\n    \"faithfulness\": \"Faithfulness\",          # 답변이 검색 컨텍스트에 근거하는지(환각 여부)\n    \"answer_relevancy\": \"Answer Relevancy\",  # 답변이 질문과 관련 있는지\n    \"factual_correctness\": \"Factual Correctness\",  # 답변이 정답과 사실적으로 일치하는지\n}"
    },
    {
      "id": "split_documents_with",
      "name": "split_documents_with()",
      "fileId": "main",
      "summary": "chunk_size·chunk_overlap 을 인자로 받아 문서를 청크로 쪼개는 분할기 — 크기만 바꿔 비교하기 위한 핵심.",
      "how": "indexing.py 의 기본 분할기는 고정 크기만 쓰므로 스윕(여러 크기 비교)에 쓸 수 없음. 그래서 같은 법령 구분자(LAW_SEPARATORS)는 그대로 쓰되 chunk_size·chunk_overlap 만 인자로 받게 만든 분할기임. RecursiveCharacterTextSplitter 가 구분자를 앞에서부터 적용하며 크기 이하가 될 때까지 재귀적으로 쪼갬.",
      "terms": [
        "청크",
        "청킹/임베딩",
        "RecursiveCharacterTextSplitter",
        "LAW_SEPARATORS"
      ],
      "lines": [
        {
          "at": "def split_documents_with",
          "text": "크기를 인자로 받는 분할기 함수 정의."
        },
        {
          "at": "from langchain_text_splitters import",
          "text": "재귀적 문자 분할기를 가져옴."
        },
        {
          "at": "chunk_size=chunk_size,",
          "text": "한 청크의 목표 글자 수를 인자로 지정."
        },
        {
          "at": "chunk_overlap=chunk_overlap,",
          "text": "이웃 청크끼리 겹치는 글자 수를 인자로 지정."
        },
        {
          "at": "separators=LAW_SEPARATORS,",
          "text": "조→항 순으로 먼저 쪼개도록 법령 전용 구분자를 그대로 사용."
        },
        {
          "at": "return splitter.split_documents",
          "text": "설정대로 문서를 쪼갠 청크 리스트를 돌려줌."
        }
      ],
      "code": "def split_documents_with(documents: list, chunk_size: int, chunk_overlap: int) -> list:\n    \"\"\"chunk_size·chunk_overlap을 인자로 받아 문서를 청크로 분할함.\n\n    indexing.py의 split_documents()는 모듈 상수 CHUNK_SIZE/CHUNK_OVERLAP을 읽어 고정 크기로만\n    분할하므로 스윕에 사용할 수 없음. 동일한 LAW_SEPARATORS를 쓰되 크기만 파라미터화한 분할기임.\n    \"\"\"\n    from langchain_text_splitters import RecursiveCharacterTextSplitter\n\n    # RecursiveCharacterTextSplitter: separators를 앞에서부터 순서대로 적용하며\n    # chunk_size 이하가 될 때까지 재귀적으로 분할하는 분할기\n    splitter = RecursiveCharacterTextSplitter(\n        chunk_size=chunk_size,\n        chunk_overlap=chunk_overlap,\n        separators=LAW_SEPARATORS,\n    )\n    return splitter.split_documents(documents)"
    },
    {
      "id": "build_temp_index",
      "name": "build_temp_index()",
      "fileId": "main",
      "summary": "청크를 임베딩해 OS 임시 폴더의 ChromaDB에 저장하는 함수 — 공용 DB를 건드리지 않는 임시 인덱싱.",
      "how": "후보 크기마다 새 인덱스가 필요하므로, %TEMP% 안에 고유한 임시 폴더와 컬렉션명을 만들어 그 안에만 임베딩함. 임시 경로가 혹시라도 공용 DB 경로와 같으면 즉시 중단하는 방어 장치를 둠(공용 DB 파괴 방지). 인덱싱과 같은 임베딩 모델을 써서 Chroma.from_documents 로 새 컬렉션에 청크를 저장하고, (저장소, 임시경로)를 돌려줌.",
      "terms": [
        "청킹/임베딩",
        "ChromaDB",
        "임베딩",
        "text-embedding-3-small",
        "공용 벡터 DB",
        "청크"
      ],
      "lines": [
        {
          "at": "def build_temp_index",
          "text": "임시 벡터 DB를 만드는 함수 정의."
        },
        {
          "at": "temp_dir = Path(tempfile.mkdtemp",
          "text": "OS 임시 폴더 안에 고유한 빈 디렉터리를 만들어 경로로 받음."
        },
        {
          "at": "if temp_dir.resolve() == PUBLIC_VECTORDB_DIR",
          "text": "임시 경로가 공용 DB와 같으면 즉시 중단하는 방어 장치."
        },
        {
          "at": "collection_name = f\"{COLLECTION_PREFIX}",
          "text": "임시 컬렉션 이름을 후보 크기별로 고유하게 지음(예: patent_law_cs400)."
        },
        {
          "at": "embeddings = OpenAIEmbeddings(model=",
          "text": "인덱싱과 동일한 임베딩 모델로 청크를 벡터화함."
        },
        {
          "at": "vectorstore = Chroma.from_documents",
          "text": "청크들을 임베딩해 임시 폴더에 새 ChromaDB 컬렉션으로 저장."
        },
        {
          "at": "return vectorstore, temp_dir",
          "text": "만든 벡터 저장소와 임시 경로를 함께 돌려줌(나중에 정리용)."
        }
      ],
      "code": "def build_temp_index(chunks: list, chunk_size: int) -> tuple:\n    \"\"\"청크를 임베딩하여 임시 디렉터리에 ChromaDB로 저장하고 (vectorstore, 임시경로)를 반환함.\n\n    공용 벡터 DB 보호: persist_directory를 OS 임시 폴더(%TEMP%)로 지정하고 컬렉션명도 고유하게 두어\n    공용 DB(../vectordb)를 절대 덮어쓰지 않음. 평가 후 cleanup_temp_index()로 정리함.\n    Chroma.from_documents: 문서 리스트를 임베딩하여 새 컬렉션에 저장하는 LangChain 헬퍼.\n    \"\"\"\n    from langchain_chroma import Chroma\n    from langchain_openai import OpenAIEmbeddings\n\n    # tempfile.mkdtemp: OS 임시 폴더 안에 고유한 빈 디렉터리를 만들고 그 경로를 반환함\n    temp_dir = Path(tempfile.mkdtemp(prefix=f\"ragas_cs{chunk_size}_\"))\n\n    # 방어 장치: 어떤 경우에도 임시 경로가 공용 DB 경로와 겹치면 즉시 중단함 (공용 DB 파괴 방지)\n    if temp_dir.resolve() == PUBLIC_VECTORDB_DIR.resolve():\n        raise RuntimeError(\"임시 인덱스 경로가 공용 벡터 DB 경로와 동일함 — 중단\")\n\n    collection_name = f\"{COLLECTION_PREFIX}{chunk_size}\"  # 예: patent_law_cs400\n    # OpenAIEmbeddings: 텍스트를 1536차원 벡터로 변환 (인덱싱과 동일 모델, OPENAI_API_KEY 자동 참조)\n    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)\n\n    vectorstore = Chroma.from_documents(\n        documents=chunks,\n        embedding=embeddings,\n        collection_name=collection_name,\n        persist_directory=str(temp_dir),\n    )\n    return vectorstore, temp_dir"
    },
    {
      "id": "cleanup_temp_index",
      "name": "cleanup_temp_index()",
      "fileId": "main",
      "summary": "평가가 끝난 임시 벡터 DB의 파일을 닫고 임시 폴더를 지우는 함수.",
      "how": "후보 평가가 끝나면 임시 인덱스를 지워 디스크를 깨끗이 유지함. 윈도우에서는 ChromaDB(SQLite)가 파일 핸들을 늦게 놓아 삭제가 바로 안 될 수 있어, 참조를 끊고 gc 로 회수한 뒤 짧은 간격으로 최대 3회 재시도함. 끝내 실패해도 경고만 남기고 스윕을 계속 진행함(임시 폴더는 OS가 치움).",
      "terms": [
        "ChromaDB",
        "공용 벡터 DB"
      ],
      "lines": [
        {
          "at": "def cleanup_temp_index",
          "text": "임시 벡터 DB를 정리하는 함수 정의."
        },
        {
          "at": "vectorstore._client._system.stop()",
          "text": "내부 SQLite 연결을 끊어 열린 파일 핸들을 조기에 반환하도록 시도."
        },
        {
          "at": "del vectorstore",
          "text": "벡터 저장소 참조를 끊어 가비지 컬렉션이 회수할 수 있게 함."
        },
        {
          "at": "for attempt in range(3):",
          "text": "삭제를 짧은 간격으로 최대 3회 재시도(핸들 반환 지연 흡수)."
        },
        {
          "at": "shutil.rmtree(temp_dir)",
          "text": "임시 폴더와 그 안의 임시 DB를 통째로 삭제."
        },
        {
          "at": "print(f\"  - (경고) 임시 인덱스 정리 실패",
          "text": "끝내 못 지워도 경고만 남기고 스윕을 계속 진행."
        }
      ],
      "code": "def cleanup_temp_index(vectorstore, temp_dir: Path) -> None:\n    \"\"\"임시 벡터 DB의 파일 핸들을 해제하고 임시 디렉터리를 삭제함.\n\n    Windows에서는 ChromaDB(SQLite)가 파일 핸들을 즉시 놓지 않아 rmtree가 PermissionError를 낼 수 있음.\n    참조를 끊고 gc로 회수한 뒤 몇 차례 재시도하며, 끝내 실패해도 경고만 남기고 스윕을 계속 진행함\n    (임시 폴더는 OS가 정리하므로 무해함).\n    \"\"\"\n    try:\n        # 내부 SQLite 클라이언트 연결을 끊어 파일 핸들을 조기에 반환하도록 시도함\n        vectorstore._client._system.stop()  # type: ignore[attr-defined]\n    except Exception:\n        pass\n    del vectorstore\n    # gc.collect(): 더 이상 참조되지 않는 객체를 즉시 회수해 열린 파일 핸들을 해제함\n    gc.collect()\n\n    # rmtree를 짧은 간격으로 최대 3회 재시도 (핸들 반환 지연 흡수)\n    for attempt in range(3):\n        try:\n            shutil.rmtree(temp_dir)\n            return\n        except (PermissionError, OSError):\n            time.sleep(0.5)\n    print(f\"  - (경고) 임시 인덱스 정리 실패, OS 임시 폴더에 잔존: {temp_dir}\")"
    },
    {
      "id": "build_rag_chain",
      "name": "build_rag_chain()",
      "fileId": "main",
      "summary": "naive 예제와 똑같은 프롬프트로 (프롬프트 | LLM | 파서) 체인을 만드는 함수.",
      "how": "생성 조건을 naive 예제와 동일하게 맞추려고, naive_rag.py 의 SYSTEM_PROMPT·HUMAN_PROMPT 를 그대로 써서 LCEL 파이프로 '프롬프트 → LLM → 문자열 파서' 체인을 조립함. 청킹 크기 외 변수가 답변에 섞이지 않게 하는 장치임.",
      "terms": [
        "LLM-as-judge",
        "청크"
      ],
      "lines": [
        {
          "at": "def build_rag_chain",
          "text": "생성용 RAG 체인을 만드는 함수 정의."
        },
        {
          "at": "from langchain_core.output_parsers import StrOutputParser",
          "text": "LLM 응답에서 본문 문자열만 뽑는 파서를 가져옴."
        },
        {
          "at": "prompt = ChatPromptTemplate.from_messages",
          "text": "naive와 동일한 system·human 프롬프트를 묶어 프롬프트를 구성."
        },
        {
          "at": "return prompt | llm | StrOutputParser()",
          "text": "파이프(|)로 프롬프트→LLM→문자열파서를 한 줄로 연결한 체인을 돌려줌."
        }
      ],
      "code": "def build_rag_chain(llm):\n    \"\"\"naive RAG와 동일한 프롬프트 구성으로 (프롬프트 | LLM | 파서) LCEL 체인을 만듦.\n\n    naive_rag.py의 SYSTEM_PROMPT·HUMAN_PROMPT를 그대로 사용해 생성 조건을 동일하게 맞춤.\n    \"\"\"\n    from langchain_core.output_parsers import StrOutputParser\n    from langchain_core.prompts import ChatPromptTemplate\n\n    # ChatPromptTemplate.from_messages: system/human 메시지 템플릿을 묶어 프롬프트를 구성함\n    prompt = ChatPromptTemplate.from_messages(\n        [(\"system\", SYSTEM_PROMPT), (\"human\", HUMAN_PROMPT)]\n    )\n    # StrOutputParser: LLM의 AIMessage 응답에서 본문 텍스트만 추출함\n    return prompt | llm | StrOutputParser()"
    },
    {
      "id": "run_rag_pipeline",
      "name": "run_rag_pipeline()",
      "fileId": "main",
      "summary": "각 질문에 대해 검색→생성을 수행해 (질문·검색 청크·답변) 묶음 리스트를 만드는 함수.",
      "how": "RAGAS 는 '검색된 청크'와 '생성 답변'을 입력으로 받으므로, 질문마다 둘을 모아 둠. ① retriever.invoke(question) 으로 유사 청크 Top-K 를 검색하고 원문만 contexts 로 추출함. ② 검색 청크를 컨텍스트로 넣어 체인을 실행해 답을 생성함(일시 오류 시 재시도). 결과를 dict 로 모아 리스트로 돌려줌.",
      "terms": [
        "retriever",
        "청크 검색",
        "청크",
        "LLM-as-judge"
      ],
      "lines": [
        {
          "at": "def run_rag_pipeline",
          "text": "질문별 검색→생성을 도는 함수 정의."
        },
        {
          "at": "for index, question in enumerate(questions",
          "text": "질문을 1번부터 번호 매기며 하나씩 처리."
        },
        {
          "at": "docs = retriever.invoke(question)",
          "text": "①탐색: 질문을 임베딩해 의미가 비슷한 청크 Top-K를 가져옴."
        },
        {
          "at": "contexts = [doc.page_content for doc in docs]",
          "text": "검색 청크의 원문 텍스트만 뽑아 RAGAS 입력용 컨텍스트로 만듦."
        },
        {
          "at": "response = invoke_with_retry(",
          "text": "②생성: 검색 청크를 근거로 답을 만듦(일시 오류 시 재시도)."
        },
        {
          "at": "results.append({\"question\"",
          "text": "질문·검색 청크·답변을 한 묶음으로 모아 리스트에 추가."
        }
      ],
      "code": "def run_rag_pipeline(questions: list[str], retriever, chain) -> list[dict]:\n    \"\"\"각 질문에 대해 검색→생성을 수행하고 (질문·검색컨텍스트·답변) 리스트를 반환함.\n\n    RAGAS는 검색된 컨텍스트(retrieved_contexts)와 생성 답변(response)을 입력으로 받으므로\n    질문마다 둘을 모아 둠. 검색 청크 원문만 contexts로 추출함(메트릭이 텍스트 단위로 계산).\n    \"\"\"\n    results = []\n    total = len(questions)\n    for index, question in enumerate(questions, start=1):\n        # 진행 상황 표시 (질문이 길 수 있으므로 앞 40자만)\n        print(f\"    [{index}/{total}] {question[:40]}...\")\n\n        # 1) 탐색: 질의어를 임베딩하여 의미적으로 유사한 청크 Top K 검색\n        docs = retriever.invoke(question)\n        contexts = [doc.page_content for doc in docs]\n\n        # 2) 생성: 검색 청크를 컨텍스트로 주입해 답변 생성 (Groq 호출, 일시적 오류 시 재시도)\n        response = invoke_with_retry(chain, {\"context\": format_docs(docs), \"question\": question})\n\n        results.append({\"question\": question, \"contexts\": contexts, \"response\": response})\n    return results"
    },
    {
      "id": "invoke_with_retry",
      "name": "invoke_with_retry()",
      "fileId": "main",
      "summary": "LLM 호출이 일시적으로 실패하면 잠깐 기다렸다 다시 시도하는(지수 백오프) 함수.",
      "how": "질문을 연속 생성하면 분당 요청 한도(rate limit) 등에 걸릴 수 있음. 한 번의 일시 오류로 전체 스윕이 멈추지 않게, 1초→2초→4초로 대기를 늘리며 최대 3회 재시도함. 마지막 시도까지 실패하면 예외를 그대로 올려 호출한 쪽이 처리하게 함.",
      "terms": [
        "지수 백오프",
        "rate limit"
      ],
      "lines": [
        {
          "at": "def invoke_with_retry",
          "text": "재시도 로직을 담은 함수 정의."
        },
        {
          "at": "return chain.invoke(payload)",
          "text": "정상이면 체인을 실행해 결과를 바로 돌려줌."
        },
        {
          "at": "if attempt == max_retries - 1:",
          "text": "마지막 시도까지 실패하면 예외를 그대로 올림."
        },
        {
          "at": "wait = 2 ** attempt",
          "text": "대기 시간을 1→2→4초로 점점 늘림(지수 백오프)."
        },
        {
          "at": "time.sleep(wait)",
          "text": "정한 시간만큼 쉬었다가 다음 시도로 넘어감."
        }
      ],
      "code": "def invoke_with_retry(chain, payload: dict, max_retries: int = 3):\n    \"\"\"LLM 체인 호출을 일시적 오류(예: Groq rate limit) 발생 시 지수 백오프로 재시도함.\n\n    다수 질문을 연속 생성하면 분당 요청 한도에 걸릴 수 있어, 잠시 대기 후 재시도하여\n    스윕 전체가 한 번의 일시 오류로 중단되지 않게 함.\n    \"\"\"\n    for attempt in range(max_retries):\n        try:\n            return chain.invoke(payload)\n        except Exception as error:\n            # 마지막 시도까지 실패하면 호출자에게 예외를 그대로 전달함\n            if attempt == max_retries - 1:\n                raise\n            wait = 2 ** attempt  # 1초 → 2초 → 4초로 대기 시간을 늘림\n            print(f\"    - (재시도 {attempt + 1}/{max_retries}) 생성 오류: {error} — {wait}초 대기\")\n            time.sleep(wait)"
    },
    {
      "id": "select_metrics",
      "name": "select_metrics()",
      "fileId": "main",
      "summary": "평가 유형(all/retrieval/generation)에 맞는 RAGAS 메트릭 인스턴스 목록을 골라 돌려주는 함수.",
      "how": "검색 지표 3종과 생성 지표 3종을 만든 뒤, 옵션에 따라 둘 중 하나 또는 전체를 돌려줌. 검색 지표는 모두 정답(reference) 기반으로 골라 'chunk_size 의 검색 효과'만 분리 측정함. 특히 문맥 정밀도는 생성 답변이 아닌 정답을 기준으로 하는 WithReference 버전을 써서 청킹 비교가 흐려지지 않게 함.",
      "terms": [
        "RAGAS",
        "context precision(문맥 정밀도)",
        "context recall(문맥 재현율)",
        "faithfulness(충실도)",
        "answer relevancy(답변 관련성)",
        "ground truth"
      ],
      "lines": [
        {
          "at": "def select_metrics",
          "text": "평가 유형별 메트릭 목록을 고르는 함수 정의."
        },
        {
          "at": "from ragas.metrics import (",
          "text": "RAGAS 가 제공하는 메트릭 클래스들을 가져옴."
        },
        {
          "at": "LLMContextPrecisionWithReference,",
          "text": "검색 청크가 정답과 관련 있는 비율(문맥 정밀도, 정답 기준 버전)."
        },
        {
          "at": "LLMContextRecall,",
          "text": "정답에 필요한 정보가 검색되었는지(문맥 재현율)."
        },
        {
          "at": "Faithfulness,",
          "text": "답변이 검색 근거에 충실한지(충실도, 환각 여부)."
        },
        {
          "at": "ResponseRelevancy,",
          "text": "답변이 질문과 관련 있는지(답변 관련성)."
        },
        {
          "at": "retrieval_metrics = [",
          "text": "검색 지표 3종을 한 묶음으로 만듦."
        },
        {
          "at": "generation_metrics = [",
          "text": "생성 지표 3종을 한 묶음으로 만듦."
        },
        {
          "at": "return retrieval_metrics + generation_metrics",
          "text": "옵션이 all 이면 검색+생성 6종 전체를 돌려줌."
        }
      ],
      "code": "def select_metrics(eval_type: str) -> list:\n    \"\"\"평가 유형(all/retrieval/generation)에 맞는 RAGAS 메트릭 인스턴스 목록을 반환함.\n\n    검색 메트릭은 모두 reference(정답) 기반으로 구성해 chunk_size의 \"검색\" 효과를 분리 측정함.\n    특히 Context Precision은 생성 답변이 아닌 정답을 기준으로 하는 WithReference 버전을 사용함\n    (WithoutReference는 생성 품질이 섞여 청킹 비교를 흐림).\n    \"\"\"\n    from ragas.metrics import (\n        ContextEntityRecall,                # 정답 엔티티가 검색되었는지 (검색)\n        FactualCorrectness,                 # 답변과 정답의 사실 일치도 (생성)\n        Faithfulness,                       # 답변이 컨텍스트에 근거하는지 (생성)\n        LLMContextPrecisionWithReference,   # 검색 청크가 정답과 관련 있는 비율 (검색, reference 기준)\n        LLMContextRecall,                   # 정답에 필요한 정보가 검색되었는지 (검색)\n        ResponseRelevancy,                  # 답변이 질문과 관련 있는지 (생성)\n    )\n\n    retrieval_metrics = [\n        LLMContextPrecisionWithReference(),\n        LLMContextRecall(),\n        ContextEntityRecall(),\n    ]\n    generation_metrics = [\n        Faithfulness(),\n        ResponseRelevancy(),\n        FactualCorrectness(),\n    ]\n\n    if eval_type == \"retrieval\":\n        return retrieval_metrics\n    if eval_type == \"generation\":\n        return generation_metrics\n    return retrieval_metrics + generation_metrics"
    },
    {
      "id": "evaluate_chunk_size",
      "name": "evaluate_chunk_size()",
      "fileId": "main",
      "summary": "한 chunk_size 의 RAG 실행 결과를 RAGAS 로 채점해 평가 결과 객체를 돌려주는 함수.",
      "how": "질문마다 (질문·검색 청크·생성 답변·정답)을 SingleTurnSample 한 개로 묶고, 그 묶음들을 EvaluationDataset 으로 만듦. 그 데이터셋을 evaluate() 에 넘기면, 평가자 LLM·임베딩을 호출해 메트릭별 점수를 계산해 줌. 여기서 정답(reference)이 함께 들어가기 때문에 '정답 기준' 검색 지표를 계산할 수 있음.",
      "terms": [
        "RAGAS",
        "SingleTurnSample",
        "EvaluationDataset",
        "ground truth",
        "LLM-as-judge",
        "평가자 LLM",
        "청크"
      ],
      "lines": [
        {
          "at": "def evaluate_chunk_size",
          "text": "한 후보의 결과를 RAGAS로 채점하는 함수 정의."
        },
        {
          "at": "from ragas import EvaluationDataset, SingleTurnSample, evaluate",
          "text": "RAGAS의 샘플·데이터셋·평가 함수를 가져옴."
        },
        {
          "at": "sample = SingleTurnSample(",
          "text": "한 질문의 입력 4종을 RAGAS 표준 샘플 하나로 묶음."
        },
        {
          "at": "retrieved_contexts=result[\"contexts\"],",
          "text": "그 질문에서 검색된 청크 원문 리스트(검색 지표 입력)."
        },
        {
          "at": "response=result[\"response\"],",
          "text": "RAG가 생성한 답변(생성 지표 입력)."
        },
        {
          "at": "reference=ground_truth,",
          "text": "사람이 만든 정답(ground truth) — 정답 기준 채점의 핵심."
        },
        {
          "at": "dataset = EvaluationDataset(samples=samples)",
          "text": "샘플들을 하나의 평가 데이터셋으로 묶음."
        },
        {
          "at": "return evaluate(",
          "text": "평가자 LLM·임베딩으로 메트릭별 점수를 계산해 결과를 돌려줌."
        }
      ],
      "code": "def evaluate_chunk_size(rag_results: list[dict], ground_truths: list[str], metrics: list,\n                        eval_llm_wrapper, eval_embeddings_wrapper):\n    \"\"\"단일 chunk_size의 RAG 실행 결과를 RAGAS로 평가하고 평가 결과 객체를 반환함.\n\n    SingleTurnSample: 한 질문에 대한 입력(질문·검색컨텍스트·답변·정답)을 담는 RAGAS 표준 샘플.\n    EvaluationDataset: 샘플들을 묶은 평가 데이터셋. evaluate()가 메트릭별 점수를 계산함.\n    \"\"\"\n    from ragas import EvaluationDataset, SingleTurnSample, evaluate\n\n    samples = []\n    for result, ground_truth in zip(rag_results, ground_truths):\n        sample = SingleTurnSample(\n            user_input=result[\"question\"],           # 질문\n            retrieved_contexts=result[\"contexts\"],    # 검색된 청크 원문 리스트\n            response=result[\"response\"],              # RAG가 생성한 답변\n            reference=ground_truth,                   # 정답(ground_truth)\n        )\n        samples.append(sample)\n\n    dataset = EvaluationDataset(samples=samples)\n    # evaluate: 각 샘플·메트릭에 대해 평가자 LLM/임베딩을 호출해 점수를 산출함\n    return evaluate(\n        dataset=dataset,\n        metrics=metrics,\n        llm=eval_llm_wrapper,\n        embeddings=eval_embeddings_wrapper,\n    )"
    },
    {
      "id": "extract_scores",
      "name": "extract_scores()",
      "fileId": "main",
      "summary": "RAGAS 평가 결과에서 메트릭별 평균 점수를 딕셔너리로 뽑아내는 함수(버전 호환).",
      "how": "result.to_pandas() 는 '질문×메트릭' 점수표(DataFrame)를 줌. 거기서 입력 컬럼(질문·청크·답변·정답)을 빼고 메트릭 컬럼만 골라 NaN(채점 실패 칸)을 제외하고 평균을 냄. RAGAS 버전마다 점수 접근법이 달라 표 평균이 가장 안전함. 일부 컬럼명에 붙는 모드 접미사(예: factual_correctness(mode=f1))는 괄호 앞만 떼어 키를 통일함.",
      "terms": [
        "RAGAS",
        "DataFrame"
      ],
      "lines": [
        {
          "at": "def extract_scores",
          "text": "결과 표에서 메트릭 평균을 뽑는 함수 정의."
        },
        {
          "at": "df = result.to_pandas()",
          "text": "평가 결과를 질문×메트릭 점수표(DataFrame)로 변환."
        },
        {
          "at": "input_columns = {",
          "text": "점수가 아닌 입력 컬럼(질문·청크·답변·정답) 집합을 정의."
        },
        {
          "at": "mean_value = df[column].dropna().mean()",
          "text": "채점 실패 칸(NaN)을 빼고 메트릭 컬럼의 평균을 계산."
        },
        {
          "at": "key = column.split(\"(\")[0]",
          "text": "모드 접미사를 떼어 라벨·선정 로직과 키를 맞춤."
        },
        {
          "at": "return scores",
          "text": "메트릭명→평균점수 딕셔너리를 돌려줌."
        }
      ],
      "code": "def extract_scores(result) -> dict[str, float]:\n    \"\"\"RAGAS 평가 결과에서 메트릭별 평균 점수 딕셔너리를 추출함 (버전 호환 방식).\n\n    result.to_pandas(): 질문×메트릭 점수를 담은 DataFrame. 입력 컬럼을 제외한 메트릭 컬럼만\n    골라 NaN을 제외하고 평균을 냄. RAGAS 버전에 따라 점수 접근 API가 달라 DataFrame 평균이 안전함.\n    \"\"\"\n    import pandas as pd\n\n    df = result.to_pandas()\n    # 입력 컬럼(질문·컨텍스트·답변·정답)을 제외한 나머지를 메트릭 컬럼으로 간주함\n    input_columns = {\"user_input\", \"retrieved_contexts\", \"response\", \"reference\"}\n    scores: dict[str, float] = {}\n    for column in df.columns:\n        if column in input_columns:\n            continue\n        mean_value = df[column].dropna().mean()  # NaN(평가 실패 샘플)을 빼고 평균\n        if not pd.isna(mean_value):\n            # 일부 메트릭은 컬럼명에 모드 접미사가 붙음(예: \"factual_correctness(mode=f1)\").\n            # 라벨 매핑·선정 로직의 키와 맞추기 위해 괄호 이후를 떼어 정규화함.\n            key = column.split(\"(\")[0]\n            scores[key] = float(mean_value)\n    return scores"
    },
    {
      "id": "compute_selection_score",
      "name": "compute_selection_score()",
      "fileId": "main",
      "summary": "최적 chunk_size 선정에 쓸 '종합 점수' 하나를 계산하는 함수.",
      "how": "chunk_size 는 검색 품질에 직접 영향을 주므로, 검색 지표가 있으면 검색 지표 3종 평균을 종합 점수로 씀. 생성만 평가한 경우에는 생성 지표 평균을 씀. 존재하는 메트릭만 모아 평균 내므로 일부 지표가 빠져도 계산됨.",
      "terms": [
        "context precision(문맥 정밀도)",
        "context recall(문맥 재현율)"
      ],
      "lines": [
        {
          "at": "def compute_selection_score",
          "text": "후보 선정용 종합 점수를 계산하는 함수 정의."
        },
        {
          "at": "target_keys = RETRIEVAL_METRIC_LABELS.keys()",
          "text": "all·retrieval 이면 검색 지표를 종합 점수 기준으로 삼음."
        },
        {
          "at": "target_keys = GENERATION_METRIC_LABELS.keys()",
          "text": "generation 만 평가했으면 생성 지표를 기준으로 삼음."
        },
        {
          "at": "values = [scores[key] for key in target_keys",
          "text": "존재하는 메트릭 점수만 모음(일부 빠져도 계산 가능)."
        },
        {
          "at": "return sum(values) / len(values)",
          "text": "모은 점수의 평균을 종합 점수로 돌려줌."
        }
      ],
      "code": "def compute_selection_score(scores: dict[str, float], eval_type: str) -> float | None:\n    \"\"\"최적 chunk_size 선정용 종합 점수를 계산함.\n\n    선정 기준(교재: chunk_size는 검색 품질에 직접 영향):\n      - 검색 메트릭이 있으면 검색 메트릭(reference 기반 3종) 평균을 종합 점수로 사용함\n      - 생성만 평가한 경우에는 생성 메트릭 평균을 사용함\n    \"\"\"\n    if eval_type in (\"all\", \"retrieval\"):\n        target_keys = RETRIEVAL_METRIC_LABELS.keys()\n    else:\n        target_keys = GENERATION_METRIC_LABELS.keys()\n\n    # 존재하는 메트릭 점수만 모아 평균 (일부 메트릭이 빠져도 계산 가능)\n    values = [scores[key] for key in target_keys if key in scores]\n    if not values:\n        return None\n    return sum(values) / len(values)"
    },
    {
      "id": "save_results",
      "name": "save_results()",
      "fileId": "main",
      "summary": "후보별 summary(JSON)·detail(CSV)와 전체 비교 요약을 results/ 하위에 저장하는 함수.",
      "how": "후보마다 파라미터+점수를 담은 summary.json 과 질문별 점수표 detail.csv 를 저장하고(엑셀 한글 깨짐 방지로 utf-8-sig), 전체 비교를 comparison.json·comparison.csv 로도 남김. 결과를 파일로 보관해 나중에 비교·재현할 수 있게 함.",
      "terms": [
        "DataFrame"
      ],
      "lines": [
        {
          "at": "def save_results",
          "text": "결과를 파일로 저장하는 함수 정의."
        },
        {
          "at": "run_dir.mkdir(parents=True",
          "text": "결과를 담을 timestamp 폴더를 만듦."
        },
        {
          "at": "summary_path = run_dir / f\"cs{size}_summary.json\"",
          "text": "후보별 파라미터+점수 요약을 JSON 경로로 잡음."
        },
        {
          "at": "json.dump(row, f, ensure_ascii=False",
          "text": "한글이 깨지지 않게 JSON으로 저장."
        },
        {
          "at": "to_csv(run_dir / f\"cs{size}_detail.csv\"",
          "text": "질문별 상세 점수를 CSV로 저장(엑셀 한글용 utf-8-sig)."
        },
        {
          "at": "comparison_summary = {",
          "text": "전체 후보 비교 요약 딕셔너리를 구성."
        },
        {
          "at": "pd.DataFrame(flat_rows).to_csv",
          "text": "후보를 행, 메트릭을 열로 펼친 비교 표를 CSV로 저장."
        }
      ],
      "code": "def save_results(run_dir: Path, comparison: list[dict], detail_frames: dict,\n                 best_chunk_size: int | None, eval_type: str) -> None:\n    \"\"\"chunk_size별 summary(JSON)·detail(CSV)와 전체 비교 요약을 results/ 하위에 저장함.\"\"\"\n    run_dir.mkdir(parents=True, exist_ok=True)\n\n    # 1) chunk_size별 개별 결과 저장\n    for row in comparison:\n        size = row[\"chunk_size\"]\n        # summary(JSON): 파라미터 + 메트릭 점수 + 종합 점수\n        summary_path = run_dir / f\"cs{size}_summary.json\"\n        with open(summary_path, \"w\", encoding=\"utf-8\") as f:  # with 블록을 벗어나면 파일이 자동으로 닫힘\n            json.dump(row, f, ensure_ascii=False, indent=2)\n        # detail(CSV): 질문별 메트릭 점수 (utf-8-sig로 저장해 Excel 한글 깨짐 방지)\n        detail_frames[size].to_csv(run_dir / f\"cs{size}_detail.csv\", index=False, encoding=\"utf-8-sig\")\n\n    # 2) 전체 비교 요약 저장\n    comparison_summary = {\n        \"eval_type\": eval_type,\n        \"overlap_ratio\": OVERLAP_RATIO,\n        \"best_chunk_size\": best_chunk_size,\n        \"results\": comparison,\n    }\n    with open(run_dir / \"comparison.json\", \"w\", encoding=\"utf-8\") as f:\n        json.dump(comparison_summary, f, ensure_ascii=False, indent=2)\n\n    # 비교 표를 CSV로도 저장 (chunk_size를 행, 메트릭을 열로)\n    import pandas as pd\n\n    flat_rows = []\n    for row in comparison:\n        flat = {\"chunk_size\": row[\"chunk_size\"], \"chunk_overlap\": row[\"chunk_overlap\"]}\n        flat.update(row[\"scores\"])           # 메트릭 점수 전개\n        flat[\"selection_score\"] = row[\"selection_score\"]\n        flat_rows.append(flat)\n    pd.DataFrame(flat_rows).to_csv(run_dir / \"comparison.csv\", index=False, encoding=\"utf-8-sig\")\n\n    print(f\"\\n결과 저장 위치: {run_dir}\")\n    print(\"  - chunk_size별: csXXX_summary.json, csXXX_detail.csv\")\n    print(\"  - 전체 비교   : comparison.json, comparison.csv\")"
    },
    {
      "id": "parse_args",
      "name": "parse_args()",
      "fileId": "main",
      "summary": "명령줄 옵션을 읽어 평가 유형·chunk_size 후보·케이스 제한을 정하는 함수.",
      "how": "--retrieval/--generation 으로 검색만/생성만 평가할지 정하고, --chunk-sizes 400,800 로 후보를 바꾸며, --limit N 으로 테스트 케이스 수를 줄여 저비용 스모크 테스트를 할 수 있게 함. 옵션이 없으면 기본값을 씀.",
      "terms": [],
      "lines": [
        {
          "at": "def parse_args",
          "text": "명령줄 인자를 해석하는 함수 정의."
        },
        {
          "at": "options = {\"eval_type\": \"all\"",
          "text": "옵션 기본값(전체 평가·기본 후보·제한 없음)을 설정."
        },
        {
          "at": "if \"--retrieval\" in argv:",
          "text": "--retrieval 이 있으면 검색 지표만 평가하도록 설정."
        },
        {
          "at": "elif \"--generation\" in argv:",
          "text": "--generation 이 있으면 생성 지표만 평가하도록 설정."
        },
        {
          "at": "if \"--chunk-sizes\" in argv:",
          "text": "--chunk-sizes 400,800 형식으로 후보 목록을 재정의."
        },
        {
          "at": "if \"--limit\" in argv:",
          "text": "--limit N 으로 테스트 케이스 수를 N개로 제한(스모크 테스트)."
        }
      ],
      "code": "def parse_args(argv: list[str]) -> dict:\n    \"\"\"명령줄 인자를 파싱하여 평가 유형·chunk_size 후보·케이스 제한을 결정함.\"\"\"\n    options = {\"eval_type\": \"all\", \"chunk_sizes\": DEFAULT_CHUNK_SIZES, \"limit\": None}\n\n    if \"--retrieval\" in argv:\n        options[\"eval_type\"] = \"retrieval\"\n    elif \"--generation\" in argv:\n        options[\"eval_type\"] = \"generation\"\n\n    # --chunk-sizes 400,800,1200 형식 파싱\n    if \"--chunk-sizes\" in argv:\n        value = argv[argv.index(\"--chunk-sizes\") + 1]\n        options[\"chunk_sizes\"] = [int(s) for s in value.split(\",\") if s.strip()]\n\n    # --limit N: 저비용 스모크 테스트용으로 테스트 케이스 수를 N개로 제한\n    if \"--limit\" in argv:\n        options[\"limit\"] = int(argv[argv.index(\"--limit\") + 1])\n\n    return options"
    },
    {
      "id": "main",
      "name": "main()",
      "fileId": "main",
      "summary": "데이터셋 로드 → PDF 전처리 → 후보별 (재청킹·인덱싱·RAG·평가) 반복 → 비교·저장까지 지휘하는 진입점.",
      "how": "전체 파이프라인을 순서대로 실행함. ① 테스트셋을 받아 질문·정답으로 나눔. ② PDF를 1회만 로드·전처리함. ③ 생성 LLM(Groq)·평가자 LLM(OpenAI)·평가 임베딩을 한 번 준비함. ④ chunk_size 후보마다 재청킹→임시 인덱싱→RAG→RAGAS 평가를 반복하고, 평가가 끝나거나 오류가 나도 finally 로 임시 인덱스를 반드시 정리함. ⑤ 종합 점수가 최고인 후보를 최적값으로 골라 비교 표를 출력하고 results/{시각}/ 에 저장함. 맨 아래 if __name__ 은 직접 실행할 때만 main() 을 부르는 관용구임.",
      "terms": [
        "RAGAS",
        "ground truth",
        "청킹/임베딩",
        "평가자 LLM",
        "if __name__ == \"__main__\""
      ],
      "lines": [
        {
          "at": "def main() -> None:",
          "text": "전체 평가 파이프라인을 실행하는 진입점 함수 정의."
        },
        {
          "at": "test_cases = get_test_dataset()",
          "text": "test_dataset.py 에서 질문·정답 테스트 케이스를 받아 옴."
        },
        {
          "at": "questions = [case[\"question\"]",
          "text": "테스트 케이스에서 질문만 추출해 리스트로 만듦."
        },
        {
          "at": "ground_truths = [case[\"ground_truth\"]",
          "text": "테스트 케이스에서 정답(ground truth)만 추출해 리스트로 만듦."
        },
        {
          "at": "documents = preprocess_documents(load_pdfs(DATA_DIR))",
          "text": "PDF를 1회만 로드·전처리(청킹과 무관해 반복 안 함)."
        },
        {
          "at": "rag_chain = build_rag_chain(create_llm())",
          "text": "생성용 RAG 체인(naive와 동일 조건)을 준비."
        },
        {
          "at": "eval_llm_wrapper = LangchainLLMWrapper(",
          "text": "RAGAS 채점을 맡을 평가자 LLM(gpt-4o-mini)을 준비."
        },
        {
          "at": "for chunk_size in chunk_sizes:",
          "text": "후보 크기마다 인덱싱→RAG→평가를 반복."
        },
        {
          "at": "chunks = attach_metadata(filter_chunks(split_documents_with",
          "text": "재청킹→노이즈 필터→메타데이터 부여를 한 줄로 수행."
        },
        {
          "at": "vectorstore, temp_dir = build_temp_index",
          "text": "공용 DB를 건드리지 않는 임시 벡터 DB를 구축."
        },
        {
          "at": "rag_results = run_rag_pipeline(questions, retriever, rag_chain)",
          "text": "질문별 검색→생성을 실행해 결과를 모음."
        },
        {
          "at": "result = evaluate_chunk_size(",
          "text": "그 결과를 RAGAS로 채점."
        },
        {
          "at": "cleanup_temp_index(vectorstore, temp_dir)",
          "text": "finally: 오류가 나도 임시 인덱스를 반드시 정리."
        },
        {
          "at": "best_chunk_size = (",
          "text": "종합 점수가 가장 높은 후보를 최적값으로 선정."
        },
        {
          "at": "save_results(RESULTS_DIR / timestamp",
          "text": "비교 결과를 results/{시각}/ 폴더에 저장."
        },
        {
          "at": "if __name__ == \"__main__\":",
          "text": "이 파일을 직접 실행할 때만 main()을 수행하는 관용구."
        }
      ],
      "code": "def main() -> None:\n    \"\"\"PDF 1회 로드·전처리 → chunk_size별 (재청킹·임베딩·RAG·RAGAS 평가) 반복 → 비교·저장.\"\"\"\n    options = parse_args(sys.argv[1:])\n    eval_type = options[\"eval_type\"]\n    chunk_sizes = options[\"chunk_sizes\"]\n    limit = options[\"limit\"]\n\n    from langchain_openai import ChatOpenAI, OpenAIEmbeddings\n    from ragas.embeddings import LangchainEmbeddingsWrapper\n    from ragas.llms import LangchainLLMWrapper\n\n    print(\"=\" * 70)\n    print(\"RAGAS 청킹 사이즈 스윕 평가\")\n    print(f\"  평가 유형 : {eval_type}  |  chunk_size 후보 : {chunk_sizes}  |  overlap : 20% 고정\")\n    print(\"=\" * 70)\n\n    # 1) 테스트 데이터셋 로드 (질문·정답)\n    test_cases = get_test_dataset()\n    if limit is not None:\n        test_cases = test_cases[:limit]  # 스모크 테스트: 앞 N개만 사용\n    questions = [case[\"question\"] for case in test_cases]\n    ground_truths = [case[\"ground_truth\"] for case in test_cases]\n    print(f\"\\n[준비] 테스트 케이스 {len(test_cases)}개 로드\")\n\n    # 2) PDF 로드·전처리는 chunk_size와 무관하므로 1회만 수행함 (임베딩 비용 외 중복 작업 제거)\n    print(\"[준비] PDF 로드 및 전처리 (1회)\")\n    documents = preprocess_documents(load_pdfs(DATA_DIR))\n    print(f\"  - 전처리 후 페이지 수: {len(documents)}\")\n\n    # 3) 생성 LLM(Groq)·평가자 LLM(OpenAI)·평가 임베딩을 준비함 (스윕 내내 고정)\n    print(\"[준비] 생성 LLM(Groq) · 평가자 LLM(OpenAI gpt-4o-mini) 초기화\")\n    rag_chain = build_rag_chain(create_llm())          # 생성: naive와 동일한 Groq 모델\n    eval_llm_wrapper = LangchainLLMWrapper(             # 평가자: OpenAI gpt-4o-mini\n        ChatOpenAI(model=EVAL_LLM_MODEL, temperature=0)\n    )\n    eval_embeddings_wrapper = LangchainEmbeddingsWrapper(\n        OpenAIEmbeddings(model=EMBEDDING_MODEL)        # 평가 임베딩: 인덱싱과 동일 모델\n    )\n    metrics = select_metrics(eval_type)\n\n    # 4) chunk_size 후보별로 인덱싱→RAG→평가를 반복함\n    comparison: list[dict] = []\n    detail_frames: dict[int, object] = {}\n    for chunk_size in chunk_sizes:\n        chunk_overlap = int(chunk_size * OVERLAP_RATIO)  # 오버랩 = 청킹 사이즈의 20%\n        print(\"\\n\" + \"-\" * 70)\n        print(f\"[chunk_size={chunk_size}] overlap={chunk_overlap} — 인덱싱→RAG→평가\")\n\n        # 4-1) 재청킹 → 노이즈 필터 → 메타데이터 부여 (indexing.py 로직 재사용)\n        chunks = attach_metadata(filter_chunks(split_documents_with(documents, chunk_size, chunk_overlap)))\n        print(f\"  - 생성된 청크 수: {len(chunks)}\")\n\n        # 4-2) 임시 벡터 DB 구축 (공용 DB는 건드리지 않음)\n        vectorstore, temp_dir = build_temp_index(chunks, chunk_size)\n        try:\n            retriever = vectorstore.as_retriever(search_kwargs={\"k\": TOP_K})\n\n            # 4-3) RAG 파이프라인 실행 (검색 → 생성)\n            print(\"  - RAG 실행 (검색 → 생성)\")\n            rag_results = run_rag_pipeline(questions, retriever, rag_chain)\n\n            # 4-4) RAGAS 평가\n            print(\"  - RAGAS 평가 (평가자 LLM 호출, 시간 소요)\")\n            result = evaluate_chunk_size(\n                rag_results, ground_truths, metrics, eval_llm_wrapper, eval_embeddings_wrapper\n            )\n        finally:\n            # 평가가 끝났거나 오류가 나도 임시 인덱스는 반드시 정리 시도함\n            cleanup_temp_index(vectorstore, temp_dir)\n\n        # 4-5) 점수 집계\n        scores = extract_scores(result)\n        selection_score = compute_selection_score(scores, eval_type)\n        print_scores(chunk_size, chunk_overlap, scores)\n\n        comparison.append({\n            \"chunk_size\": chunk_size,\n            \"chunk_overlap\": chunk_overlap,\n            \"num_chunks\": len(chunks),\n            \"scores\": scores,\n            \"selection_score\": selection_score,\n        })\n        detail_frames[chunk_size] = result.to_pandas()\n\n    # 5) 최적 chunk_size 선정 (종합 점수 최대) 및 출력·저장\n    scored_rows = [row for row in comparison if row[\"selection_score\"] is not None]\n    best_chunk_size = (\n        max(scored_rows, key=lambda r: r[\"selection_score\"])[\"chunk_size\"] if scored_rows else None\n    )\n    print_comparison(comparison, best_chunk_size, eval_type)\n\n    timestamp = datetime.now().strftime(\"%Y%m%d_%H%M%S\")\n    save_results(RESULTS_DIR / timestamp, comparison, detail_frames, best_chunk_size, eval_type)\n\n\n# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)\nif __name__ == \"__main__\":\n    try:\n        main()\n    except Exception as error:\n        # 실행 중 오류를 명확히 출력하고 비정상 종료 코드로 빠져나감\n        print(f\"\\n[오류] RAGAS 평가 실패: {error}\", file=sys.stderr)\n        import traceback\n\n        traceback.print_exc()\n        sys.exit(1)"
    },
    {
      "id": "dataset_setup",
      "name": "테스트 케이스 정의 (TEST_CASES)",
      "fileId": "dataset",
      "summary": "특허법 원문을 직접 대조해 손으로 적은 '질문 + 정답(ground truth)' 케이스 목록을 정의하는 부분.",
      "how": "함수가 아니라 데이터 파일의 본체임. TEST_CASES 는 dict 22개의 리스트로, 각 케이스에 question(질문)·ground_truth(특허법 조문에 근거한 정답)·expected_source(출처 파일)·difficulty(난이도)·keywords(키워드)를 담음. 자동 생성 대신 사람이 원문과 대조해 작성해, 정답의 '검증 가능성'을 보장한 평가 데이터셋임.",
      "terms": [
        "평가 데이터셋",
        "ground truth",
        "question",
        "RAGAS"
      ],
      "lines": [
        {
          "at": "TEST_CASES: list[dict] = [",
          "text": "질문·정답 케이스 22개를 담는 리스트의 시작."
        },
        {
          "at": "\"question\": \"특허법은 무엇을 목적으로",
          "text": "한 케이스의 'question' — 사용자가 던질 질문(필수)."
        },
        {
          "at": "\"ground_truth\": (",
          "text": "그 질문의 'ground_truth' — 특허법 조문 근거의 모범 정답(필수)."
        },
        {
          "at": "\"expected_source\": \"특허법.pdf\",",
          "text": "정답의 출처 파일명 — 인덱싱 메타데이터의 source와 일치."
        },
        {
          "at": "\"difficulty\": \"easy\",",
          "text": "난이도 표시(easy/medium/hard) — 난이도 분포 확인용(선택)."
        }
      ],
      "code": "# TEST_CASES: 각 원소는 question/ground_truth/expected_source를 담은 dict (총 22개, 난이도 easy 7·medium 10·hard 5)\nTEST_CASES: list[dict] = [\n    {\n        # 제1조(목적) — 단순 사실 확인\n        \"question\": \"특허법은 무엇을 목적으로 하는가?\",\n        \"ground_truth\": (\n            \"특허법은 발명을 보호ㆍ장려하고 그 이용을 도모함으로써 기술의 발전을 촉진하여 \"\n            \"산업발전에 이바지함을 목적으로 한다.(제1조)\"\n        ),\n        \"expected_source\": \"특허법.pdf\",\n        \"difficulty\": \"easy\",\n        \"keywords\": [\"목적\", \"발명 보호\", \"산업발전\"],\n    },"
    },
    {
      "id": "get_test_dataset",
      "name": "get_test_dataset()",
      "fileId": "dataset",
      "summary": "전체 테스트 케이스 리스트를 그대로 돌려주는 함수 — 메인이 가장 먼저 호출함.",
      "how": "TEST_CASES 리스트를 통째로 반환함. 메인(evaluate_ragas.py)은 이 함수를 호출해 질문·정답 묶음 전체를 받아 옴.",
      "terms": [
        "평가 데이터셋"
      ],
      "lines": [
        {
          "at": "def get_test_dataset",
          "text": "전체 테스트 케이스를 돌려주는 함수 정의."
        },
        {
          "at": "return TEST_CASES",
          "text": "질문·정답 케이스 리스트를 그대로 반환."
        }
      ],
      "code": "def get_test_dataset() -> list[dict]:\n    \"\"\"전체 테스트 케이스 리스트(각 원소: question/ground_truth/expected_source 등)를 반환함.\"\"\"\n    return TEST_CASES"
    },
    {
      "id": "get_questions",
      "name": "get_questions()",
      "fileId": "dataset",
      "summary": "모든 케이스에서 질문(question)만 뽑아 리스트로 돌려주는 함수.",
      "how": "리스트 컴프리헨션으로 각 케이스 dict 에서 'question' 값만 순서대로 모아 돌려줌(RAG 실행 입력용).",
      "terms": [
        "question"
      ],
      "lines": [
        {
          "at": "def get_questions",
          "text": "질문만 추출하는 함수 정의."
        },
        {
          "at": "return [case[\"question\"] for case in TEST_CASES]",
          "text": "각 케이스에서 질문 텍스트만 모아 리스트로 반환."
        }
      ],
      "code": "def get_questions() -> list[str]:\n    \"\"\"모든 테스트 케이스의 question만 추출하여 리스트로 반환함 (RAG 실행 입력용).\"\"\"\n    # 리스트 컴프리헨션: 각 케이스 dict에서 \"question\" 값만 순서대로 모음\n    return [case[\"question\"] for case in TEST_CASES]"
    },
    {
      "id": "get_ground_truths",
      "name": "get_ground_truths()",
      "fileId": "dataset",
      "summary": "모든 케이스에서 정답(ground_truth)만 뽑아 리스트로 돌려주는 함수.",
      "how": "각 케이스에서 'ground_truth' 값만 모아 돌려줌. RAGAS 채점 때 정답 비교(reference)용으로 쓰임.",
      "terms": [
        "ground truth"
      ],
      "lines": [
        {
          "at": "def get_ground_truths",
          "text": "정답만 추출하는 함수 정의."
        },
        {
          "at": "return [case[\"ground_truth\"] for case in TEST_CASES]",
          "text": "각 케이스에서 정답 텍스트만 모아 리스트로 반환."
        }
      ],
      "code": "def get_ground_truths() -> list[str]:\n    \"\"\"모든 테스트 케이스의 ground_truth만 추출하여 리스트로 반환함 (정답 비교용).\"\"\"\n    return [case[\"ground_truth\"] for case in TEST_CASES]"
    },
    {
      "id": "dataset_main",
      "name": "main() — 데이터셋 확인용",
      "fileId": "dataset",
      "summary": "이 파일을 직접 실행하면 총 케이스 수·난이도 분포·질문 목록을 출력해 데이터셋 구성을 한눈에 확인시켜 주는 함수.",
      "how": "평가에는 쓰이지 않고, test_dataset.py 를 직접 실행해 데이터셋이 잘 구성됐는지 점검할 때 씀. 총 케이스 수를 세고, 난이도별 개수를 easy→medium→hard 순으로 정리해 출력하며, 질문 목록을 번호와 함께 보여 줌.",
      "terms": [
        "평가 데이터셋",
        "question",
        "if __name__ == \"__main__\""
      ],
      "lines": [
        {
          "at": "def main() -> None:",
          "text": "데이터셋을 점검·출력하는 함수 정의."
        },
        {
          "at": "print(f\"총 테스트 케이스 수",
          "text": "전체 케이스 개수를 출력."
        },
        {
          "at": "level = case.get(\"difficulty\"",
          "text": "각 케이스의 난이도를 읽어 개수를 집계(없으면 미지정)."
        },
        {
          "at": "print(f\"난이도 분포",
          "text": "easy→medium→hard 순으로 난이도 분포를 출력."
        },
        {
          "at": "for index, question in enumerate(get_questions()",
          "text": "모든 질문을 번호와 함께 한 줄씩 출력."
        }
      ],
      "code": "def main() -> None:\n    \"\"\"총 케이스 수·난이도 분포·질문 목록을 출력하여 데이터셋 구성을 한눈에 확인함.\"\"\"\n    cases = get_test_dataset()\n    print(f\"총 테스트 케이스 수: {len(cases)}개\")\n\n    # 난이도별 개수 집계: difficulty 키가 없으면 \"(미지정)\"으로 분류함\n    difficulty_count: dict[str, int] = {}\n    for case in cases:\n        level = case.get(\"difficulty\", \"(미지정)\")\n        difficulty_count[level] = difficulty_count.get(level, 0) + 1\n    # 난이도 분포를 easy→medium→hard 순서로 정렬해 출력함\n    order = {\"easy\": 0, \"medium\": 1, \"hard\": 2}\n    summary = \", \".join(\n        f\"{level} {count}개\"\n        for level, count in sorted(difficulty_count.items(), key=lambda x: order.get(x[0], 99))\n    )\n    print(f\"난이도 분포: {summary}\")\n\n    print(\"\\n[질문 목록]\")\n    for index, question in enumerate(get_questions(), start=1):\n        print(f\"  {index:>2}. {question}\")\n\n\n# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)\nif __name__ == \"__main__\":\n    main()"
    }
  ],
  "glossary": {
    "RAG": "Retrieval-Augmented Generation. 외부 문서에서 관련 내용을 먼저 찾아(검색) 그 근거로 LLM이 답하게 하는 방식.",
    "RAGAS": "RAG Assessment. RAG 파이프라인의 검색·생성 품질을 여러 지표로 자동 채점해 주는 평가 프레임워크. 사람이 일일이 안 보고도 점수로 품질을 비교할 수 있게 함.",
    "평가 데이터셋": "RAG를 채점하기 위해 미리 준비한 (질문·정답·기대 출처) 케이스 모음. 이 예제는 특허법 조문을 대조해 손으로 만든 22개를 씀.",
    "question": "평가 케이스의 '질문'. RAG에 던져 답을 받고, 그 답이 정답에 얼마나 가까운지 채점함.",
    "ground truth": "정답(모범 답안). 사람이 특허법 원문을 보고 미리 적어 둔 것으로, RAGAS가 RAG의 답을 채점할 때 기준(reference)으로 씀.",
    "context precision(문맥 정밀도)": "검색해 온 청크들 중 정답과 관련 있는 비율. 높을수록 검색 결과에 군더더기(노이즈)가 적다는 뜻.",
    "context recall(문맥 재현율)": "정답을 만드는 데 필요한 정보가 검색 청크 안에 빠짐없이 들어왔는지. 높을수록 누락이 적다는 뜻.",
    "faithfulness(충실도)": "생성된 답변이 검색해 온 근거(컨텍스트)에 실제로 기반하는 정도. 높을수록 지어내기(환각)가 적다는 뜻.",
    "answer relevancy(답변 관련성)": "생성된 답변이 질문에 얼마나 잘 들어맞는지. 높을수록 동문서답이 적다는 뜻.",
    "LLM-as-judge": "사람 대신 또 다른 LLM이 답변·근거를 읽고 채점하게 하는 방식. RAGAS의 여러 지표가 이 방식으로 점수를 매김(여기 평가자는 gpt-4o-mini).",
    "평가자 LLM": "RAGAS 채점을 수행하는 LLM(이 예제는 OpenAI gpt-4o-mini). 답을 '생성'하는 LLM(Groq)과는 별개의 역할.",
    "청크": "chunk. 긴 문서를 검색하기 좋게 잘게 나눈 한 조각. 이 예제는 chunk_size를 바꿔가며 청크를 다시 만들어 비교함.",
    "청킹/임베딩": "청킹은 문서를 청크로 쪼개는 것, 임베딩은 청크를 의미가 담긴 숫자 벡터로 바꿔 벡터 DB에 저장하는 것. 검색은 이 벡터로 이뤄짐.",
    "임베딩": "텍스트를 의미가 담긴 숫자 벡터로 바꾼 것. 뜻이 비슷한 글은 벡터도 가깝게 위치해 '비슷한 내용'을 계산으로 찾을 수 있음.",
    "청크 검색": "질문을 임베딩해, 벡터 DB에서 의미가 가장 가까운 청크 상위 몇 개(Top-K)를 찾아오는 단계.",
    "RecursiveCharacterTextSplitter": "구분자를 앞에서부터 차례로 적용하며 목표 크기 이하가 될 때까지 문서를 재귀적으로 쪼개는 LangChain 분할기.",
    "LAW_SEPARATORS": "법령 구조(조→항)를 우선해 쪼개도록 정한 구분자 목록. 인덱싱 예제와 동일하게 재사용해 조건을 통일함.",
    "text-embedding-3-small": "OpenAI의 임베딩 모델 이름(1536차원). 인덱싱·검색·평가에서 같은 모델을 써야 의미 공간이 맞아 검색이 됨.",
    "ChromaDB": "오픈소스 벡터 데이터베이스. 임베딩을 저장하고 유사도 검색을 해 줌. 이 예제는 후보마다 임시 폴더에 새로 만듦.",
    "공용 벡터 DB": "다른 예제들이 함께 쓰는 영구 벡터 DB(../vectordb). 이 예제는 읽지도 덮어쓰지도 않고 임시 DB만 사용해 보호함.",
    "retriever": "검색기. 벡터 DB에서 질문과 가장 비슷한 청크 몇 개(Top-K)를 찾아 돌려주는 역할.",
    "SingleTurnSample": "RAGAS에서 한 질문의 입력(질문·검색 청크·답변·정답)을 담는 표준 샘플 한 개.",
    "EvaluationDataset": "SingleTurnSample 들을 묶은 RAGAS 평가용 데이터셋. evaluate()가 이걸 받아 메트릭별 점수를 계산함.",
    "DataFrame": "표(행×열) 형태로 데이터를 다루는 pandas의 자료구조. 여기서는 질문×메트릭 점수표를 담아 평균을 냄.",
    "지수 백오프": "재시도할 때 대기 시간을 1→2→4초처럼 점점 늘리는 방식. 일시적 과부하·요청 한도 오류를 부드럽게 넘김.",
    "rate limit": "API 제공자가 정한 분당/초당 요청 횟수 한도. 짧은 시간에 너무 많이 부르면 일시 오류가 남.",
    "호환 셰임": "라이브러리 버전 차이로 사라진 경로/기능을 가짜로 채워 넣어 import만 성립하게 하는 임시 우회 코드(shim).",
    "load_dotenv": ".env 파일에 적어 둔 비밀값(예: OPENAI_API_KEY, GROQ_API_KEY)을 프로그램의 환경변수로 불러오는 함수.",
    "from __future__ import annotations": "타입 힌트를 즉시 평가하지 않고 문자열로 두게 하는 파이썬 선언. 순환 참조 없이 가볍게 타입 힌트를 쓰게 해 줌.",
    "Path(__file__).resolve().parent": "지금 이 파이썬 파일이 있는 폴더의 절대경로를 구하는 관용구. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "if __name__ == \"__main__\"": "이 파일을 직접 실행할 때만 특정 코드를 돌리고, 다른 곳에서 import할 때는 돌리지 않게 하는 파이썬 관용구."
  }
};
