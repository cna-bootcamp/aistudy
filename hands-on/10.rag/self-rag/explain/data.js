window.EXPLAIN_DATA = {
  "meta": {
    "title": "Self-RAG — 스스로 점검·교정하는 RAG",
    "entry": "app.py"
  },
  "files": [
    {
      "id": "main",
      "label": "app.py",
      "role": "특허법 질문을 받아 검색 필요 판단 → 검색 → 관련성·근거성·유용성 자체 검증 → 부족하면 질문을 고쳐 재시도하는 Self-RAG 챗봇 전체"
    }
  ],
  "flow": [
    {
      "step": 1,
      "title": "실행 & 환경 준비",
      "summary": "python app.py 로 실행하고, .env 의 API 키를 불러옴",
      "detail": "터미널에서 'python app.py'(대화형 챗봇) 또는 'python app.py --demo'(검증 질의 3건 자동 실행)로 시작함. 시작과 동시에 load_dotenv() 가 hands-on/.env 에 적어 둔 GROQ_API_KEY(LLM용)와 OPENAI_API_KEY(질의 임베딩용)를 읽어 둠. 한글 출력이 깨지지 않게 표준출력을 UTF-8로 맞추는 처리도 함. 비유하면, 똑똑한 사서(앱)가 출근해 두 개의 열쇠(답변 열쇠·검색 열쇠)를 책상에 챙겨 두는 단계."
    },
    {
      "step": 2,
      "title": "벡터 DB·LLM·체인 준비",
      "summary": "공용 벡터 DB를 검색 전용으로 연결하고, LLM과 Self-RAG 체인을 만듦",
      "detail": "이 예제는 PDF를 새로 읽거나 쪼개지 않음. 그 작업(인덱싱)은 ../indexing 이 미리 해 두었고, 여기서는 결과물인 공용 ChromaDB(컬렉션 patent_law)를 연결만 함. 그다음 답변을 써 줄 Groq LLM(gpt-oss-120b)을 만들고, 이 둘을 SelfRAGChain 에 넣어 '스스로 점검하는' 처리 엔진을 조립함. 비유하면, 정리된 서가에 접근 권한을 얻고, 글 쓰는 직원과 '품질 검사관' 역할을 한 사람에게 모두 맡기는 것."
    },
    {
      "step": 3,
      "title": "[Retrieve] 검색 필요 여부 판단",
      "summary": "질문을 보고 '문서를 찾아봐야 하나?'를 LLM이 스스로 결정함",
      "detail": "Self-RAG의 첫 자기성찰 단계임. 인사말이나 특허법 외 주제(예: 개인정보보호법)는 굳이 검색하지 않고 LLM 일반 지식으로 바로 답함. 특허법 관련 질문일 때만 검색을 켬. 이것이 '항상 검색'하는 Naive RAG 와 가장 큰 차이임. 비유하면, 손님 질문을 듣고 '이건 서가를 뒤져야 할 질문'인지 '그냥 대답해도 되는 질문'인지 먼저 가려내는 것."
    },
    {
      "step": 4,
      "title": "검색 + [IsRel] 관련성 일괄 평가",
      "summary": "비슷한 청크 5개를 찾고, 그중 정말 관련된 것만 1회 호출로 골라냄",
      "detail": "검색이 필요하면 질문을 임베딩해 의미가 가까운 청크 상위 5개(top-k)를 꺼냄. 그다음 [IsRel] 단계에서 5개를 한 프롬프트에 묶어 1회 LLM 호출로 '관련 있음/없음'을 일괄 채점하고 관련 문서만 추림(호출 수·비용 절감). 관련 문서가 하나도 없으면 검색 결과를 버리고 LLM 지식으로 답함. 비유하면, 검색으로 뽑은 5장의 카드를 한 번에 훑어보며 진짜 쓸 카드만 남기는 것."
    },
    {
      "step": 5,
      "title": "답변 생성 + [IsSup] 근거성 검증",
      "summary": "관련 문서로 답을 쓰고, 그 답이 문서에 근거하는지(환각 없는지) 점검함",
      "detail": "추려낸 관련 문서를 컨텍스트로 넣어 답변을 생성함. 이어 [IsSup] 단계에서 '이 답이 문서로 뒷받침되는가, 지어낸 내용은 없는가'를 LLM이 검사함. 근거가 부족하면 '컨텍스트에 있는 내용만 써라'는 엄격한 프롬프트로 답을 다시 생성함(환각 방지). 비유하면, 직원이 쓴 답안을 검사관이 카드와 대조해 '근거 없는 문장'을 걸러내는 것."
    },
    {
      "step": 6,
      "title": "[IsUse] 유용성 평가 → 재시도 루프",
      "summary": "최종 답이 질문에 정말 쓸모 있는지 보고, 미흡하면 질문을 고쳐 처음부터 다시 함",
      "detail": "마지막 자기성찰 단계임. [IsUse] 에서 답이 질문에 직접·명확하게 답하는지 평가함. 유용하면 그대로 출력하고, 유용하지 않으면 rewrite_query 로 질문을 검색에 더 좋게 고친 뒤 [Retrieve]부터 통째로 다시 실행함(최대 3회). 이 자기교정 루프가 Self-RAG 의 핵심임. 비유하면, 답이 부실하면 질문 자체를 더 정확히 바꿔 다시 서가를 뒤지는 끈질긴 사서."
    },
    {
      "step": 7,
      "title": "결과 요약 & 출력",
      "summary": "각 Reflection 판단(검색/관련/근거/유용)과 재시도 이력을 요약해 답변과 함께 보여 줌",
      "detail": "format_reflection_summary 가 [Retrieve]·[IsRel]·[IsSup]·[IsUse] 판단 결과와 재작성 이력을 한눈에 보이게 표로 만들고, print_result 가 요약과 최종 답변을 콘솔에 출력함. 어떤 자기점검을 거쳤는지 투명하게 보여 주는 것이 Self-RAG 의 신뢰성 장점임. 비유하면, 답안과 함께 '어떤 검사를 통과했는지' 체크리스트를 같이 제출하는 것."
    }
  ],
  "functions": [
    {
      "id": "setup",
      "name": "임포트·경로·상수 설정",
      "fileId": "main",
      "summary": "필요한 모듈을 가져오고, 파일 위치 기준으로 경로를 잡고, .env 키와 핵심 상수를 준비하는 부분.",
      "how": "함수가 아니라 파일 위쪽의 준비 코드 모음임. ① from __future__ import annotations 로 타입 힌트를 가볍게 쓰고, 표준출력을 UTF-8로 맞춤. ② LangChain 의 LLM·벡터DB·임베딩·프롬프트 도구와 Pydantic(구조화 출력용)을 가져옴. ③ 모든 경로를 이 파일 위치(__file__) 기준으로 계산해 어디서 실행해도 같은 공용 벡터 DB·.env 를 가리키게 함. ④ load_dotenv 로 키를 올리고, 컬렉션명·임베딩 모델·LLM 모델·TOP_K·MAX_RETRIES(재시도 한도) 같은 상수를 정함.",
      "terms": [
        "from __future__ import annotations",
        "Path(__file__).resolve().parent",
        "load_dotenv",
        "Pydantic",
        "ChatGroq",
        "Chroma",
        "OpenAIEmbeddings",
        "ChatPromptTemplate",
        "StrOutputParser",
        "컬렉션",
        "영속화",
        "text-embedding-3-small",
        "TOP_K",
        "MAX_RETRIES"
      ],
      "lines": [
        {
          "at": "from __future__ import annotations",
          "text": "타입 힌트를 문자열로 평가해 가볍게 쓰게 하는 파이썬 설정."
        },
        {
          "at": "sys.stdout.reconfigure(encoding",
          "text": "윈도우 콘솔에서 한글이 깨지지 않도록 출력 인코딩을 UTF-8로 바꿈."
        },
        {
          "at": "from pydantic import BaseModel, Field",
          "text": "LLM 출력을 정해진 형식으로 강제하기 위한 Pydantic 스키마 도구를 가져옴."
        },
        {
          "at": "from langchain_groq import ChatGroq",
          "text": "Groq 클라우드에 채팅 요청을 보내는 LLM 래퍼를 가져옴."
        },
        {
          "at": "from langchain_chroma import Chroma",
          "text": "영속화된 ChromaDB 벡터 컬렉션을 연결하는 래퍼를 가져옴."
        },
        {
          "at": "from langchain_openai import OpenAIEmbeddings",
          "text": "질의를 벡터로 바꿀 임베딩 모델을 가져옴."
        },
        {
          "at": "from langchain_core.prompts import ChatPromptTemplate",
          "text": "system·human 메시지를 묶어 프롬프트를 만드는 템플릿을 가져옴."
        },
        {
          "at": "from langchain_core.output_parsers import StrOutputParser",
          "text": "LLM 응답에서 본문 문자열만 뽑는 파서를 가져옴."
        },
        {
          "at": "SCRIPT_DIR = Path(__file__)",
          "text": "이 파일이 있는 폴더(self-rag/)를 절대경로로 구함 — 실행 위치와 무관하게 동작."
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
          "text": ".env 에서 GROQ_API_KEY·OPENAI_API_KEY 를 실제로 읽어 환경변수로 올림."
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
          "text": "답변·검증을 모두 맡을 LLM(Groq의 gpt-oss-120b) 이름."
        },
        {
          "at": "TOP_K = 5",
          "text": "검색으로 가져올 비슷한 청크 개수를 5개로 정함(top-k)."
        },
        {
          "at": "MAX_RETRIES = 3",
          "text": "[IsUse] 실패 시 질문을 고쳐 다시 시도하는 최대 횟수(3회)."
        }
      ],
      "code": "from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함\n\nimport os\nimport sys\nfrom pathlib import Path\n\n# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함\nif hasattr(sys.stdout, \"reconfigure\"):\n    sys.stdout.reconfigure(encoding=\"utf-8\")\n\nfrom dotenv import load_dotenv\nfrom pydantic import BaseModel, Field\n\n# ChatGroq: Groq LPU 채팅 모델 래퍼 (llm.invoke()로 대화 요청 전송)\nfrom langchain_groq import ChatGroq\nfrom langchain_chroma import Chroma                       # ChromaDB 벡터 스토어 래퍼\nfrom langchain_openai import OpenAIEmbeddings             # OpenAI 임베딩 모델 (질의 벡터화)\nfrom langchain_core.documents import Document             # LangChain 문서 객체 타입\nfrom langchain_core.prompts import ChatPromptTemplate     # LLM 프롬프트 템플릿\nfrom langchain_core.output_parsers import StrOutputParser  # LLM 출력에서 문자열만 추출\n\n# ---------------------------------------------------------------------------\n# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)\n# ---------------------------------------------------------------------------\nSCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(self-rag/)를 절대경로로 구함\nRAG_DIR = SCRIPT_DIR.parent                     # hands-on/10.rag/\nVECTORDB_DIR = RAG_DIR / \"vectordb\"             # 공용 ChromaDB 영속 디렉터리 (indexing으로 구축)\nENV_PATH = RAG_DIR.parent / \".env\"              # hands-on/.env (API 키 보관)\n\n# .env에서 GROQ_API_KEY(LLM)·OPENAI_API_KEY(임베딩) 등 환경변수를 로드함\nload_dotenv(ENV_PATH)\n\n# ---------------------------------------------------------------------------\n# 상수 정의\n# ---------------------------------------------------------------------------\nCOLLECTION_NAME = \"patent_law\"               # 공용 벡터 DB 컬렉션명 (indexing과 반드시 동일해야 검색됨)\nEMBEDDING_MODEL = \"text-embedding-3-small\"   # 인덱싱과 동일 임베딩 모델 (1536차원, 다르면 검색 불가)\nLLM_MODEL = \"openai/gpt-oss-120b\"            # Groq LPU에서 서빙하는 OpenAI gpt-oss 120B 모델\nTOP_K = 5                                    # 유사도 검색 시 가져올 문서 수\nMAX_RETRIES = 3                              # [IsUse] 실패 시 Query Rewriting 재시도 최대 횟수"
    },
    {
      "id": "schemas",
      "name": "Reflection Token 스키마 (Pydantic)",
      "fileId": "main",
      "summary": "LLM의 4가지 자기성찰 판단([Retrieve]·[IsRel]·[IsSup]·[IsUse])과 질문 재작성 결과를 담을 '정해진 답안지 양식'을 정의함.",
      "how": "LLM에게 자유 문장 대신 '이 칸을 채워라'는 양식(스키마)을 주면 결과를 안정적으로 읽을 수 있음. 각 클래스는 with_structured_output() 과 짝을 이뤄, LLM이 반드시 이 형식(JSON)으로 답하도록 강제함. RetrieveDecision=검색 필요 여부, RelevanceGrade/BatchRelevanceGrade=문서 관련성(여러 건 묶음), SupportGrade=근거성, UsefulnessGrade=유용성, RewrittenQuery=고쳐 쓴 질문을 각각 담음.",
      "terms": [
        "Pydantic",
        "with_structured_output",
        "Reflection Token",
        "검색 필요성 판단",
        "문서 관련성 평가",
        "환각 점검",
        "답변 유용성 평가",
        "질문 재작성"
      ],
      "lines": [
        {
          "at": "class RetrieveDecision",
          "text": "[Retrieve] 결과 양식: 검색이 필요한지(needs_retrieval)와 그 이유를 담음."
        },
        {
          "at": "needs_retrieval: bool",
          "text": "외부 문서 검색이 필요한지 참/거짓으로 표시하는 칸."
        },
        {
          "at": "class RelevanceGrade",
          "text": "[IsRel] 결과 양식(문서 1건): 몇 번 문서가 관련 있는지 담음."
        },
        {
          "at": "document_index: int",
          "text": "평가 대상 문서의 번호(0부터)를 담는 칸."
        },
        {
          "at": "is_relevant: bool",
          "text": "그 문서가 질문과 관련 있는지 참/거짓으로 표시하는 칸."
        },
        {
          "at": "class BatchRelevanceGrade",
          "text": "[IsRel] 결과를 여러 문서분 한꺼번에 담는 양식(1회 호출 일괄 평가용)."
        },
        {
          "at": "results: list[RelevanceGrade]",
          "text": "각 문서의 관련성 평가 결과를 리스트로 모아 담는 칸."
        },
        {
          "at": "class SupportGrade",
          "text": "[IsSup] 결과 양식: 답변이 문서에 근거하는지(환각 없는지) 담음."
        },
        {
          "at": "is_supported: bool",
          "text": "답변이 컨텍스트로 뒷받침되는지 참/거짓으로 표시하는 칸."
        },
        {
          "at": "class UsefulnessGrade",
          "text": "[IsUse] 결과 양식: 답변이 질문에 유용한지 담음."
        },
        {
          "at": "is_useful: bool",
          "text": "답변이 질문에 실질적으로 도움이 되는지 참/거짓으로 표시하는 칸."
        },
        {
          "at": "class RewrittenQuery",
          "text": "질문 재작성 결과 양식: 검색에 더 좋게 고친 질문을 담음."
        },
        {
          "at": "rewritten_query: str",
          "text": "검색 최적화를 위해 다시 작성한 질문 문장을 담는 칸."
        }
      ],
      "code": "class RetrieveDecision(BaseModel):\n    \"\"\"[Retrieve] 토큰 결과: 검색 필요 여부와 판단 근거.\"\"\"\n    needs_retrieval: bool = Field(description=\"질문에 답하기 위해 외부 문서 검색이 필요한지 여부\")\n    reasoning: str = Field(description=\"판단 근거 (한국어 한 문장)\")\n\n\nclass RelevanceGrade(BaseModel):\n    \"\"\"[IsRel] 토큰 결과: 개별 문서 한 건의 관련성 평가.\"\"\"\n    document_index: int = Field(description=\"평가 대상 문서의 인덱스 (0부터 시작)\")\n    is_relevant: bool = Field(description=\"해당 문서가 질문과 관련 있는지 여부\")\n\n\nclass BatchRelevanceGrade(BaseModel):\n    \"\"\"[IsRel] 토큰 결과: 여러 문서의 관련성 일괄 평가 (1회 LLM 호출로 전체 평가).\"\"\"\n    results: list[RelevanceGrade] = Field(description=\"각 문서의 관련성 평가 결과 리스트\")\n\n\nclass SupportGrade(BaseModel):\n    \"\"\"[IsSup] 토큰 결과: 답변의 근거성 평가.\"\"\"\n    is_supported: bool = Field(description=\"생성된 답변이 검색된 문서에 근거하는지 여부\")\n    reasoning: str = Field(description=\"근거성 판단 이유 (한국어 한 문장)\")\n\n\nclass UsefulnessGrade(BaseModel):\n    \"\"\"[IsUse] 토큰 결과: 답변 유용성 평가.\"\"\"\n    is_useful: bool = Field(description=\"답변이 사용자 질문에 유용한지 여부\")\n    reasoning: str = Field(description=\"유용성 판단 이유 (한국어 한 문장)\")\n\n\nclass RewrittenQuery(BaseModel):\n    \"\"\"Query Rewriting 결과: 검색에 최적화되도록 다시 작성된 질문.\"\"\"\n    rewritten_query: str = Field(description=\"검색에 최적화되도록 다시 작성된 질문\")\n    reasoning: str = Field(description=\"질문을 다시 작성한 이유 (한국어 한 문장)\")"
    },
    {
      "id": "build_llm",
      "name": "build_llm()",
      "fileId": "main",
      "summary": "답변 생성과 자기성찰 판단을 모두 맡을 Groq LLM(gpt-oss-120b)을 만들어 돌려주는 함수.",
      "how": "Self-RAG 에서 LLM 은 답도 쓰고 스스로 채점도 하므로, 하나의 LLM 을 준비해 여러 용도로 씀. Groq 키가 없으면 즉시 명확한 오류를 냄(나중에 엉뚱한 곳에서 실패하는 것 방지). temperature=0 으로 같은 질문엔 같은(재현 가능한) 판단·답변을 내도록 고정함.",
      "terms": [
        "ChatGroq",
        "Groq LPU",
        "gpt-oss-120b",
        "temperature",
        "API 키 검사"
      ],
      "lines": [
        {
          "at": "def build_llm",
          "text": "답변·검증용 Groq LLM을 만드는 함수 정의."
        },
        {
          "at": "api_key = os.environ.get(\"GROQ_API_KEY\")",
          "text": "환경변수에서 Groq API 키를 읽음."
        },
        {
          "at": "if not api_key",
          "text": "키가 없으면 초기에 명확한 오류를 내 디버깅을 쉽게 함."
        },
        {
          "at": "return ChatGroq(model=LLM_MODEL",
          "text": "모델 이름과 temperature=0 등 설정으로 Groq 채팅 모델을 만들어 돌려줌."
        }
      ],
      "code": "def build_llm() -> ChatGroq:\n    \"\"\"Groq LPU의 gpt-oss-120b 모델 인스턴스를 생성함.\n\n    temperature=0으로 고정해 Reflection 판단(구조화 출력)과 답변을 재현 가능하게 함.\n    GROQ_API_KEY 미설정 시 실행 초기에 명확한 오류를 발생시켜 디버깅을 쉽게 함.\n    \"\"\"\n    api_key = os.environ.get(\"GROQ_API_KEY\")\n    if not api_key:\n        raise RuntimeError(\"GROQ_API_KEY가 설정되지 않음. hands-on/.env를 확인하세요.\")\n    return ChatGroq(model=LLM_MODEL, temperature=0, api_key=api_key)"
    },
    {
      "id": "load_vectorstore",
      "name": "load_vectorstore()",
      "fileId": "main",
      "summary": "이미 만들어진 공용 ChromaDB를 재임베딩 없이 연결해 검색 전용 벡터 스토어로 돌려주는 함수.",
      "how": "새로 인덱싱하지 않고, ../indexing 이 만들어 둔 영속 컬렉션을 그대로 연결함. ① 벡터 DB 폴더가 없으면 인덱싱부터 하라는 오류를 냄. ② 인덱싱과 동일한 임베딩 모델로 OpenAIEmbeddings 를 만들어 질의를 1536차원 벡터로 바꿀 준비를 함. ③ persist_directory 와 collection_name 으로 디스크에 저장된 컬렉션에 접근함(차원·의미 공간이 맞아야 검색됨).",
      "terms": [
        "Chroma",
        "ChromaDB",
        "영속화",
        "컬렉션",
        "OpenAIEmbeddings",
        "text-embedding-3-small",
        "유사도 검색"
      ],
      "lines": [
        {
          "at": "def load_vectorstore",
          "text": "공용 벡터 DB를 검색 전용으로 연결하는 함수 정의."
        },
        {
          "at": "if not VECTORDB_DIR.exists()",
          "text": "인덱싱이 먼저 돼 있어야 하므로 벡터 DB 폴더 존재를 확인함."
        },
        {
          "at": "raise FileNotFoundError",
          "text": "폴더가 없으면 ../indexing/indexing.py 를 먼저 실행하라는 오류를 냄."
        },
        {
          "at": "embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL",
          "text": "인덱싱과 같은 모델로 질의 임베딩기를 준비함(차원·의미공간 일치)."
        },
        {
          "at": "return Chroma(",
          "text": "from_documents(신규 생성)가 아니라 기존 컬렉션을 '연결'만 해서 돌려줌."
        },
        {
          "at": "persist_directory=str(VECTORDB_DIR)",
          "text": "디스크에 저장된 벡터 폴더를 가리켜 재임베딩 없이 재사용."
        },
        {
          "at": "collection_name=COLLECTION_NAME",
          "text": "어떤 컬렉션을 열지 이름으로 지정."
        }
      ],
      "code": "def load_vectorstore() -> Chroma:\n    \"\"\"공용 벡터 DB를 임베딩 없이 로드함 (검색 전용).\n\n    인덱싱과 동일한 컬렉션명(patent_law)·임베딩 모델(text-embedding-3-small)을 지정해야\n    질의 벡터와 저장 벡터의 차원·의미 공간이 일치하여 검색이 정상 동작함.\n    \"\"\"\n    if not VECTORDB_DIR.exists():\n        raise FileNotFoundError(\n            f\"벡터 DB를 찾을 수 없음: {VECTORDB_DIR}\\n\"\n            f\"먼저 '../indexing/indexing.py'를 실행하여 공용 벡터 DB를 구축하세요.\"\n        )\n\n    # 질의를 1536차원 벡터로 변환 (OPENAI_API_KEY 환경변수 자동 사용)\n    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL, api_key=os.environ.get(\"OPENAI_API_KEY\"))\n\n    # persist_directory + collection_name으로 영속 DB에 접근 (세그먼트 UUID는 하드코딩하지 않음)\n    return Chroma(\n        persist_directory=str(VECTORDB_DIR),\n        collection_name=COLLECTION_NAME,\n        embedding_function=embeddings,\n    )"
    },
    {
      "id": "init",
      "name": "SelfRAGChain.__init__()",
      "fileId": "main",
      "summary": "검색기와 5개의 '구조화 출력 채점기'를 미리 만들어 Self-RAG 처리 엔진을 초기화하는 부분.",
      "how": "Self-RAG 체인의 부품을 준비함. ① 벡터 스토어를 유사도 기반 검색기(retriever)로 바꿔 상위 TOP_K개를 찾게 함. ② with_structured_output 으로 LLM 을 5개의 전용 채점기(검색필요·관련성·근거성·유용성·질문재작성)로 감쌈. method=\"json_schema\" 를 쓰는 이유: gpt-oss-120b 는 기본 도구호출 모드에서 도구 이름을 잘못 만들어 실패할 수 있어, 도구 이름이 없는 json_schema 방식으로 안정성을 확보함.",
      "terms": [
        "retriever",
        "as_retriever",
        "유사도 검색",
        "TOP_K",
        "with_structured_output",
        "검색 필요성 판단",
        "문서 관련성 평가",
        "환각 점검",
        "답변 유용성 평가",
        "질문 재작성"
      ],
      "lines": [
        {
          "at": "def __init__",
          "text": "검색기와 채점기들을 준비하는 초기화 메서드 정의."
        },
        {
          "at": "self.retriever = vectorstore.as_retriever",
          "text": "벡터 스토어를 유사도 기반 검색기로 바꿔 보관."
        },
        {
          "at": "search_kwargs={\"k\": TOP_K}",
          "text": "검색 시 상위 TOP_K(5)개 청크만 가져오도록 설정."
        },
        {
          "at": "self.retrieve_grader",
          "text": "[Retrieve] 판단을 RetrieveDecision 양식으로 강제하는 채점기를 만듦."
        },
        {
          "at": "self.relevance_grader",
          "text": "[IsRel] 일괄 관련성 평가를 BatchRelevanceGrade 양식으로 강제하는 채점기를 만듦."
        },
        {
          "at": "self.support_grader",
          "text": "[IsSup] 근거성 평가를 SupportGrade 양식으로 강제하는 채점기를 만듦."
        },
        {
          "at": "self.usefulness_grader",
          "text": "[IsUse] 유용성 평가를 UsefulnessGrade 양식으로 강제하는 채점기를 만듦."
        },
        {
          "at": "self.query_rewriter",
          "text": "질문 재작성을 RewrittenQuery 양식으로 강제하는 채점기를 만듦."
        }
      ],
      "code": "    def __init__(self, llm: ChatGroq, vectorstore: Chroma):\n        self.llm = llm\n        # 코사인 유사도 기반으로 가장 유사한 TOP_K개 문서를 반환하는 검색기\n        self.retriever = vectorstore.as_retriever(\n            search_type=\"similarity\",\n            search_kwargs={\"k\": TOP_K},\n        )\n        # with_structured_output: LLM 응답을 Pydantic 스키마(JSON)로 강제해 안정적으로 파싱함.\n        # method=\"json_schema\": Groq 구조화 출력(response_format)을 사용함. gpt-oss-120b는 기본\n        # function_calling 모드에서 도구 이름을 잘못 생성(예: 'IsSup')해 호출이 실패할 수 있어,\n        # 도구 이름이 없는 json_schema 방식으로 안정성을 확보함.\n        self.retrieve_grader = llm.with_structured_output(RetrieveDecision, method=\"json_schema\")\n        self.relevance_grader = llm.with_structured_output(BatchRelevanceGrade, method=\"json_schema\")\n        self.support_grader = llm.with_structured_output(SupportGrade, method=\"json_schema\")\n        self.usefulness_grader = llm.with_structured_output(UsefulnessGrade, method=\"json_schema\")\n        self.query_rewriter = llm.with_structured_output(RewrittenQuery, method=\"json_schema\")"
    },
    {
      "id": "check_retrieval_need",
      "name": "check_retrieval_need() — [Retrieve]",
      "fileId": "main",
      "summary": "질문을 보고 외부 문서 검색이 필요한지 LLM이 스스로 판단하는 [Retrieve] 단계 함수.",
      "how": "Self-RAG의 첫 자기성찰임. 시스템 프롬프트로 '외부 문서는 특허법뿐'이라는 기준을 주고, 특허법 질문이면 검색 필요(True), 인사말이나 특허법 외 주제면 검색 불필요(False)로 판단하게 함. prompt | self.retrieve_grader 로 프롬프트와 구조화 채점기를 연결해 RetrieveDecision 양식의 결과를 받음.",
      "terms": [
        "검색 필요성 판단",
        "ChatPromptTemplate",
        "파이프(|)",
        "invoke",
        "프롬프트"
      ],
      "lines": [
        {
          "at": "def check_retrieval_need",
          "text": "검색 필요 여부를 판단하는 [Retrieve] 메서드 정의."
        },
        {
          "at": "외부 문서 검색이 필요한지 판단하는 전문가",
          "text": "검색 필요 여부를 판정하라는 역할을 지시하는 시스템 프롬프트."
        },
        {
          "at": "[검색 필요 = True]",
          "text": "특허법 관련 질문이면 검색을 켜라는 판단 기준."
        },
        {
          "at": "[검색 불필요 = False]",
          "text": "인사말·특허법 외 주제는 검색 없이 LLM 지식으로 답하라는 기준."
        },
        {
          "at": "return (prompt | self.retrieve_grader)",
          "text": "프롬프트와 채점기를 파이프로 연결해 RetrieveDecision 결과를 받아 돌려줌."
        }
      ],
      "code": "    def check_retrieval_need(self, question: str) -> RetrieveDecision:\n        \"\"\"[Retrieve] 토큰: 외부 문서 검색이 필요한지 판단함.\"\"\"\n        prompt = ChatPromptTemplate.from_messages([\n            (\"system\", \"\"\"당신은 질문을 분석하여 외부 문서 검색이 필요한지 판단하는 전문가입니다.\n\n이 시스템의 외부 문서는 '특허법' 한 가지뿐입니다. 따라서 다음 기준으로 판단하세요.\n\n[검색 필요 = True]\n- 특허법, 특허 요건, 특허 출원·심사·등록, 특허권 등 특허법 관련 질문\n\n[검색 불필요 = False]\n- 일반 인사말이나 잡담 (예: 안녕하세요)\n- 특허법 이외의 법률·주제 질문 (예: 개인정보보호법, 민법) — 외부 문서에 없으므로 LLM 지식으로 답변\n- 단순 계산·번역 등 LLM 일반 지식으로 답변 가능한 질문\n\n판단 근거(reasoning)는 반드시 한국어로 작성하세요.\"\"\"),\n            (\"human\", \"질문: {question}\\n\\n이 질문에 답하기 위해 특허법 문서 검색이 필요한가요?\"),\n        ])\n        return (prompt | self.retrieve_grader).invoke({\"question\": question})"
    },
    {
      "id": "grade_relevance_batch",
      "name": "grade_relevance_batch() — [IsRel]",
      "fileId": "main",
      "summary": "검색된 문서들의 관련성을 1회 LLM 호출로 한꺼번에 채점하는 [IsRel] 단계 함수.",
      "how": "문서를 하나씩 평가하면 호출 수가 문서 수만큼 늘어나므로, 모든 문서에 번호를 붙여 한 프롬프트로 묶어 1회에 평가함(비용·지연 절감). 각 문서를 그 인덱스와 함께 '관련 있음/없음'으로 채점해 BatchRelevanceGrade 양식으로 돌려줌. 이 결과로 관련 문서만 골라 답변 컨텍스트로 씀.",
      "terms": [
        "문서 관련성 평가",
        "청크",
        "Document",
        "ChatPromptTemplate",
        "파이프(|)",
        "invoke"
      ],
      "lines": [
        {
          "at": "def grade_relevance_batch",
          "text": "검색 문서 관련성을 일괄 평가하는 [IsRel] 메서드 정의."
        },
        {
          "at": "docs_text = \"\\n\\n\".join(",
          "text": "각 문서에 번호를 붙여 한 덩어리 텍스트로 합침(LLM이 번호로 결과를 매핑)."
        },
        {
          "at": "검색된 문서들이 질문과 관련 있는지 평가하는 전문가",
          "text": "문서 관련성을 판정하라는 역할을 지시하는 시스템 프롬프트."
        },
        {
          "at": "입력된 각 문서를 그 인덱스",
          "text": "각 문서를 인덱스와 함께 개별 평가해 모두 반환하라는 지시."
        },
        {
          "at": "return (prompt | self.relevance_grader)",
          "text": "프롬프트와 채점기를 연결해 일괄 관련성 결과를 받아 돌려줌."
        }
      ],
      "code": "    def grade_relevance_batch(self, question: str, documents: list[Document]) -> BatchRelevanceGrade:\n        \"\"\"[IsRel] 토큰: 검색된 문서들의 관련성을 1회 LLM 호출로 일괄 평가함.\n\n        문서를 개별 호출로 평가하면 호출 수가 문서 수만큼 늘어나므로, 모든 문서를\n        하나의 프롬프트로 묶어 한 번에 평가하여 비용·지연을 줄임.\n        \"\"\"\n        # 각 문서에 인덱스를 붙여 한 덩어리 텍스트로 합침 (LLM이 인덱스로 결과를 매핑)\n        docs_text = \"\\n\\n\".join(\n            f\"[문서 {i}]\\n{doc.page_content}\" for i, doc in enumerate(documents)\n        )\n        prompt = ChatPromptTemplate.from_messages([\n            (\"system\", \"\"\"당신은 검색된 문서들이 질문과 관련 있는지 평가하는 전문가입니다.\n\n문서가 질문에 답하는 데 직접 도움이 되는 정보를 포함하면 관련 있음(True)으로 판단합니다.\n부분적·간접적으로만 관련되면 관련 없음(False)으로 판단합니다.\n\n입력된 각 문서를 그 인덱스(document_index)와 함께 개별적으로 평가하여 모두 반환하세요.\"\"\"),\n            (\"human\", \"질문: {question}\\n\\n검색된 문서들:\\n{documents}\\n\\n각 문서의 관련성을 평가해 주세요.\"),\n        ])\n        return (prompt | self.relevance_grader).invoke({\"question\": question, \"documents\": docs_text})"
    },
    {
      "id": "generators",
      "name": "답변 생성 3종 (generate / without_context / strict)",
      "fileId": "main",
      "summary": "상황에 맞게 답을 만드는 세 가지 생성 함수: 컨텍스트 기반·검색없이·엄격 근거 기반 재생성.",
      "how": "Self-RAG 는 상황에 따라 다른 방식으로 답을 만듦. ① generate_answer: 관련 문서를 컨텍스트로 넣어 일반인이 이해하기 쉽게 답함. ② generate_answer_without_context: 검색이 불필요하거나 관련 문서가 없을 때 LLM 의 일반 지식만으로 답함. ③ regenerate_with_strict_grounding: [IsSup] 근거성 실패 시 '컨텍스트에 있는 내용만 써라'고 엄격히 제약해 환각을 줄여 다시 생성함. 셋 다 prompt | self.llm | StrOutputParser 파이프로 답변 문자열을 얻음.",
      "terms": [
        "ChatPromptTemplate",
        "LCEL",
        "파이프(|)",
        "StrOutputParser",
        "환각 점검",
        "프롬프트",
        "invoke"
      ],
      "lines": [
        {
          "at": "def generate_answer(self, question: str, context: str)",
          "text": "관련 문서 컨텍스트를 근거로 특허법 답변을 생성하는 함수 정의."
        },
        {
          "at": "- 주어진 컨텍스트를 기반으로 특허법 관련 질문에 답변",
          "text": "특허법 전문가 역할로 컨텍스트 기반 답을 쓰라는 시스템 프롬프트."
        },
        {
          "at": "법조문을 그대로 인용하지 말고",
          "text": "일반인이 이해하기 쉽게 풀어 설명하라는 지시."
        },
        {
          "at": "def generate_answer_without_context",
          "text": "검색 없이 LLM 일반 지식만으로 답하는 함수 정의(검색 불필요·관련 문서 없음 시)."
        },
        {
          "at": "도움이 되는 한국어 AI 어시스턴트",
          "text": "일반 어시스턴트 역할로 친절·정확히 답하라는 시스템 프롬프트."
        },
        {
          "at": "def regenerate_with_strict_grounding",
          "text": "[IsSup] 실패 시 엄격 근거 기반으로 답을 재생성하는 함수 정의."
        },
        {
          "at": "엄격한 근거 기반 답변",
          "text": "컨텍스트에 있는 정보만 쓰고 없는 내용은 추가하지 말라는 환각 차단 지시."
        }
      ],
      "code": "    def generate_answer(self, question: str, context: str) -> str:\n        \"\"\"검색된 컨텍스트를 근거로 특허법 답변을 생성함.\"\"\"\n        prompt = ChatPromptTemplate.from_messages([\n            (\"system\", \"\"\"당신은 특허법 전문 법률 상담 AI입니다.\n\n## 역할\n- 주어진 컨텍스트를 기반으로 특허법 관련 질문에 답변합니다.\n- 법조문을 그대로 인용하지 말고, 일반인이 이해하기 쉽도록 풀어서 설명합니다.\n\n## 규칙\n1. 법률 용어는 쉬운 말로 바꿔서 설명\n2. 복잡한 조문은 핵심만 요약하여 전달\n3. 컨텍스트에 없는 내용은 \"해당 내용은 제공된 문서에서 찾을 수 없습니다\"라고 답변\n\n## 컨텍스트\n{context}\"\"\"),\n            (\"human\", \"{question}\"),\n        ])\n        return (prompt | self.llm | StrOutputParser()).invoke({\"context\": context, \"question\": question})\n\n    def generate_answer_without_context(self, question: str) -> str:\n        \"\"\"검색 없이 LLM의 파라메트릭 지식만으로 답변을 생성함 (검색 불필요·관련 문서 없음 시).\"\"\"\n        prompt = ChatPromptTemplate.from_messages([\n            (\"system\", \"당신은 도움이 되는 한국어 AI 어시스턴트입니다. 친절하고 정확하게 답변해 주세요.\"),\n            (\"human\", \"{question}\"),\n        ])\n        return (prompt | self.llm | StrOutputParser()).invoke({\"question\": question})\n\n    def regenerate_with_strict_grounding(self, question: str, context: str) -> str:\n        \"\"\"[IsSup] 실패 시: 컨텍스트에 있는 정보만 사용하도록 엄격히 제약하여 답변을 재생성함.\"\"\"\n        prompt = ChatPromptTemplate.from_messages([\n            (\"system\", \"\"\"당신은 특허법 전문 법률 상담 AI입니다.\n\n## 중요: 엄격한 근거 기반 답변\n- 반드시 아래 컨텍스트에 있는 정보만 사용하여 답변하세요.\n- 컨텍스트에 없는 내용은 절대 추가하지 마세요.\n- 확실하지 않은 내용은 \"확인되지 않음\"이라고 명시하세요.\n\n## 컨텍스트\n{context}\"\"\"),\n            (\"human\", \"{question}\"),\n        ])\n        return (prompt | self.llm | StrOutputParser()).invoke({\"context\": context, \"question\": question})"
    },
    {
      "id": "grade_support",
      "name": "grade_support() — [IsSup]",
      "fileId": "main",
      "summary": "생성된 답변이 컨텍스트에 근거하는지(환각이 없는지) 검증하는 [IsSup] 단계 함수.",
      "how": "답의 주요 주장이 컨텍스트에서 직접 확인되면 근거 있음(True), 없는 내용을 추가·왜곡했으면 근거 없음(False)으로 판정함. False 가 나오면 호출부에서 엄격 근거 기반 재생성을 트리거함. SupportGrade 양식으로 결과와 이유를 돌려줌.",
      "terms": [
        "환각 점검",
        "ChatPromptTemplate",
        "파이프(|)",
        "invoke"
      ],
      "lines": [
        {
          "at": "def grade_support",
          "text": "답변의 근거성을 검증하는 [IsSup] 메서드 정의."
        },
        {
          "at": "제공된 컨텍스트에 근거하는지 평가하는 전문가",
          "text": "답변이 컨텍스트로 뒷받침되는지 판정하라는 시스템 프롬프트."
        },
        {
          "at": "컨텍스트에 없는 정보를 추가하거나 왜곡했으면",
          "text": "지어낸 내용이 있으면 근거 없음(False)으로 보라는 환각 판정 기준."
        },
        {
          "at": "return (prompt | self.support_grader)",
          "text": "프롬프트와 채점기를 연결해 근거성 결과를 받아 돌려줌."
        }
      ],
      "code": "    def grade_support(self, answer: str, context: str) -> SupportGrade:\n        \"\"\"[IsSup] 토큰: 생성된 답변이 컨텍스트에 근거하는지(환각이 없는지) 검증함.\"\"\"\n        prompt = ChatPromptTemplate.from_messages([\n            (\"system\", \"\"\"당신은 생성된 답변이 제공된 컨텍스트에 근거하는지 평가하는 전문가입니다.\n\n답변의 주요 주장과 정보가 컨텍스트에서 직접 확인 가능해야 근거 있음(True)입니다.\n컨텍스트에 없는 정보를 추가하거나 왜곡했으면 근거 없음(False)으로 판단합니다.\n판단 이유(reasoning)는 한국어로 작성하세요.\"\"\"),\n            (\"human\", \"컨텍스트:\\n{context}\\n\\n생성된 답변:\\n{answer}\\n\\n이 답변이 컨텍스트에 근거하고 있나요?\"),\n        ])\n        return (prompt | self.support_grader).invoke({\"context\": context, \"answer\": answer})"
    },
    {
      "id": "grade_usefulness",
      "name": "grade_usefulness() — [IsUse]",
      "fileId": "main",
      "summary": "최종 답변이 사용자 질문에 유용한지 평가하는 [IsUse] 단계 함수.",
      "how": "질문에 직접·명확히 답하고 실질적 도움이 되면 유용함(True), 회피·모호·일반적이면 유용하지 않음(False)으로 판정함. False 가 나오면 호출부에서 질문 재작성 후 재시도 루프가 돌게 됨. UsefulnessGrade 양식으로 결과와 이유를 돌려줌.",
      "terms": [
        "답변 유용성 평가",
        "재시도 루프",
        "ChatPromptTemplate",
        "파이프(|)",
        "invoke"
      ],
      "lines": [
        {
          "at": "def grade_usefulness",
          "text": "답변의 유용성을 평가하는 [IsUse] 메서드 정의."
        },
        {
          "at": "사용자 질문에 유용한지 평가하는 전문가",
          "text": "답변이 질문에 유용한지 판정하라는 시스템 프롬프트."
        },
        {
          "at": "[유용함 = True]",
          "text": "질문에 직접 답하고 명확·도움이 되면 유용함으로 보라는 기준."
        },
        {
          "at": "[유용하지 않음 = False]",
          "text": "회피·모호·일반적인 답이면 유용하지 않음으로 보라는 기준."
        },
        {
          "at": "return (prompt | self.usefulness_grader)",
          "text": "프롬프트와 채점기를 연결해 유용성 결과를 받아 돌려줌."
        }
      ],
      "code": "    def grade_usefulness(self, question: str, answer: str) -> UsefulnessGrade:\n        \"\"\"[IsUse] 토큰: 최종 답변이 사용자 질문에 유용한지 평가함.\"\"\"\n        prompt = ChatPromptTemplate.from_messages([\n            (\"system\", \"\"\"당신은 생성된 답변이 사용자 질문에 유용한지 평가하는 전문가입니다.\n\n[유용함 = True]\n- 질문에 직접 답하고, 내용이 명확하며 실질적으로 도움이 됨\n\n[유용하지 않음 = False]\n- 질문을 회피·모호하게 답하거나, 관련 없는 정보만 나열하거나, 너무 일반적임\n\n판단 이유(reasoning)는 한국어로 작성하세요.\"\"\"),\n            (\"human\", \"질문: {question}\\n\\n답변:\\n{answer}\\n\\n이 답변이 질문에 유용하게 답하고 있나요?\"),\n        ])\n        return (prompt | self.usefulness_grader).invoke({\"question\": question, \"answer\": answer})"
    },
    {
      "id": "rewrite_query",
      "name": "rewrite_query() — 질문 재작성",
      "fileId": "main",
      "summary": "[IsUse] 실패 시 더 나은 검색 결과를 얻도록 질문을 다시 작성하는 함수.",
      "how": "유용한 답을 못 만든 원인을 받아, 모호한 표현을 구체적 용어로·구어체를 전문 용어로 바꾸고 특허법 핵심 키워드를 명확히 포함하도록 질문을 고침. 고친 질문(RewrittenQuery)으로 [Retrieve]부터 통째로 다시 실행하는 재시도 루프의 출발점이 됨.",
      "terms": [
        "질문 재작성",
        "재시도 루프",
        "ChatPromptTemplate",
        "파이프(|)",
        "invoke"
      ],
      "lines": [
        {
          "at": "def rewrite_query",
          "text": "[IsUse] 실패 시 질문을 검색에 더 좋게 고치는 메서드 정의."
        },
        {
          "at": "검색 쿼리를 최적화하는 전문가",
          "text": "검색이 잘 되도록 질문을 다시 쓰라는 시스템 프롬프트."
        },
        {
          "at": "모호한 표현을 구체적인 용어로 변환",
          "text": "막연한 말을 구체적 용어로 바꾸라는 재작성 전략."
        },
        {
          "at": "return (prompt | self.query_rewriter)",
          "text": "프롬프트와 채점기를 연결해 재작성된 질문을 받아 돌려줌."
        },
        {
          "at": "\"failure_reason\": failure_reason",
          "text": "원래 질문·실패한 답·실패 이유를 입력으로 넣어 더 나은 질문을 얻음."
        }
      ],
      "code": "    def rewrite_query(self, original_question: str, failed_answer: str, failure_reason: str) -> RewrittenQuery:\n        \"\"\"[IsUse] 실패 시: 더 나은 검색 결과를 얻도록 질문을 재작성함.\"\"\"\n        prompt = ChatPromptTemplate.from_messages([\n            (\"system\", \"\"\"당신은 검색 쿼리를 최적화하는 전문가입니다.\n\n원래 질문으로 시도했으나 유용한 답변을 생성하지 못했습니다. 더 나은 검색을 위해 질문을 다시 작성하세요.\n\n## 재작성 전략\n1. 모호한 표현을 구체적인 용어로 변환\n2. 구어체를 문어체/전문 용어로 변환\n3. 특허법 관련 정확한 법률 용어와 핵심 키워드를 명확히 포함\n\n재작성 이유(reasoning)는 한국어로 작성하세요.\"\"\"),\n            (\"human\", \"\"\"원래 질문: {original_question}\n\n이전 답변(유용하지 않음): {failed_answer}\n\n유용하지 않은 이유: {failure_reason}\n\n더 나은 검색 결과를 위해 질문을 다시 작성해 주세요.\"\"\"),\n        ])\n        return (prompt | self.query_rewriter).invoke({\n            \"original_question\": original_question,\n            \"failed_answer\": failed_answer,\n            \"failure_reason\": failure_reason,\n        })"
    },
    {
      "id": "invoke",
      "name": "invoke() / _invoke_with_retry() — 오케스트레이션",
      "fileId": "main",
      "summary": "[Retrieve]→검색→[IsRel]→생성→[IsSup]→[IsUse] 를 1회 수행하고, [IsUse] 실패 시 질문을 고쳐 처음부터 재귀 재시도하는 Self-RAG 본체.",
      "how": "Self-RAG 전체 흐름을 지휘하는 핵심임. invoke 는 _invoke_with_retry 를 retry_count=0 으로 호출함. _invoke_with_retry 는 ① [Retrieve] 로 검색 필요를 판단하고, 필요하면 ② 검색 ③ [IsRel] 일괄 관련성 평가로 관련 문서만 추림. ④ 관련 문서가 있으면 답을 생성하고 ⑤ [IsSup] 로 근거성을 검증해 부족하면 엄격 재생성함. 관련 문서가 없거나 검색이 불필요하면 LLM 지식으로 답함. ⑥ [IsUse] 로 유용성을 평가해, 유용하지 않고 재시도 한도 안이면 질문을 재작성해 자기 자신을 다시 호출함(처음부터 재시도). 재작성 이력(rewrites)은 누적 전달됨.",
      "terms": [
        "Self-RAG",
        "Reflection Token",
        "검색 필요성 판단",
        "문서 관련성 평가",
        "환각 점검",
        "답변 유용성 평가",
        "질문 재작성",
        "재시도 루프",
        "MAX_RETRIES",
        "retriever",
        "invoke"
      ],
      "lines": [
        {
          "at": "def invoke(self, question: str) -> dict",
          "text": "질문 한 건에 대해 Self-RAG 전체를 실행하는 공개 진입 메서드 정의."
        },
        {
          "at": "return self._invoke_with_retry(question",
          "text": "재시도 카운트 0으로 내부 재귀 처리 메서드를 호출."
        },
        {
          "at": "def _invoke_with_retry",
          "text": "[Retrieve]~[IsUse] 1회 수행 + 재귀 재시도를 담당하는 메서드 정의."
        },
        {
          "at": "\"rewritten_queries\": rewrites",
          "text": "결과 묶음에 재작성 이력 리스트를 연결해 재귀 사이에 누적 공유함."
        },
        {
          "at": "decision = self.check_retrieval_need(question)",
          "text": "①[Retrieve]: 검색 필요 여부를 판단함."
        },
        {
          "at": "if decision.needs_retrieval",
          "text": "검색이 필요한 경우에만 검색·관련성 평가 분기로 들어감."
        },
        {
          "at": "docs = self.retriever.invoke(question)",
          "text": "②검색: 질문을 임베딩해 유사 청크 top-k를 가져옴."
        },
        {
          "at": "batch = self.grade_relevance_batch(question, docs)",
          "text": "③[IsRel]: 검색 문서 관련성을 1회 호출로 일괄 평가함."
        },
        {
          "at": "if not 0 <= grade.document_index < len(docs)",
          "text": "잘못된 인덱스를 걸러 안전하게 문서를 매핑함."
        },
        {
          "at": "if grade.is_relevant:",
          "text": "관련 있다고 채점된 문서만 관련 문서 목록에 모음."
        },
        {
          "at": "answer = self.generate_answer(question, context)",
          "text": "④생성: 관련 문서를 컨텍스트로 답변을 만듦."
        },
        {
          "at": "support = self.grade_support(answer, context)",
          "text": "⑤[IsSup]: 답변이 컨텍스트에 근거하는지 검증함."
        },
        {
          "at": "if not support.is_supported",
          "text": "근거가 부족하면 엄격 근거 기반으로 답을 재생성함."
        },
        {
          "at": "answer = self.regenerate_with_strict_grounding",
          "text": "환각 방지를 위해 컨텍스트만 쓰도록 제약해 다시 생성."
        },
        {
          "at": "관련 문서 없음 → LLM 지식으로 답변",
          "text": "검색은 했으나 관련 문서가 없으면 LLM 일반 지식으로 답함."
        },
        {
          "at": "검색 불필요 → LLM 지식으로 답변",
          "text": "[Retrieve]가 불필요로 판단하면 검색 없이 바로 답함."
        },
        {
          "at": "usefulness = self.grade_usefulness(original_question, answer)",
          "text": "⑥[IsUse]: 최종 답이 질문에 유용한지 평가함."
        },
        {
          "at": "if not usefulness.is_useful and retry_count < MAX_RETRIES",
          "text": "유용하지 않고 재시도 한도 안이면 자기교정 루프로 진입."
        },
        {
          "at": "rewritten = self.rewrite_query(original_question, answer",
          "text": "질문을 검색에 더 좋게 재작성함."
        },
        {
          "at": "return self._invoke_with_retry(rewritten.rewritten_query",
          "text": "고친 질문으로 [Retrieve]부터 통째로 다시 실행(재귀 재시도)."
        },
        {
          "at": "최대 재시도 횟수",
          "text": "한도에 도달하면 마지막 답을 그대로 반환하고 경고함."
        }
      ],
      "code": "    def invoke(self, question: str) -> dict:\n        \"\"\"질문 한 건에 대해 Self-RAG 전체 워크플로우를 실행함 (재시도 포함).\"\"\"\n        return self._invoke_with_retry(question, original_question=question, retry_count=0, rewrites=[])\n\n    def _invoke_with_retry(self, question: str, original_question: str, retry_count: int, rewrites: list) -> dict:\n        \"\"\"[Retrieve]부터 [IsUse]까지 1회 수행하고, [IsUse] 실패 시 재귀로 처음부터 재시도함.\n\n        rewrites: 재귀 호출 사이에 공유되는 Query Rewriting 이력 누적 리스트. 재귀 프레임마다\n        result를 새로 만들어도 이 리스트를 그대로 전달하여 전체 재작성 체인이 최종 결과에 남도록 함.\n        \"\"\"\n        result = {\n            \"original_question\": original_question,\n            \"current_question\": question,\n            \"used_retrieval\": False,\n            \"retrieved_docs\": [],\n            \"relevant_docs\": [],\n            \"answer\": \"\",\n            \"support_grade\": None,\n            \"usefulness_grade\": None,\n            \"retry_count\": retry_count,\n            \"rewritten_queries\": rewrites,\n        }\n\n        if retry_count > 0:\n            print(f\"\\n{'=' * 60}\")\n            print(f\"[재시도 {retry_count}/{MAX_RETRIES}] Query Rewriting 후 처음부터 재시도\")\n            print(f\"  원래 질문  : {original_question}\")\n            print(f\"  재작성 질문: {question}\")\n            print(f\"{'=' * 60}\")\n\n        # 1. [Retrieve] 검색 필요 여부 판단\n        print(\"\\n[Retrieve] 검색 필요 여부 판단 중...\")\n        decision = self.check_retrieval_need(question)\n        print(f\"  → 검색 필요: {decision.needs_retrieval} ({decision.reasoning})\")\n\n        if decision.needs_retrieval:\n            result[\"used_retrieval\"] = True\n\n            # 2. 검색 수행\n            print(\"\\n[검색] 관련 문서 검색 중...\")\n            docs = self.retriever.invoke(question)\n            result[\"retrieved_docs\"] = docs\n            print(f\"  → {len(docs)}개 문서 검색됨\")\n\n            # 3. [IsRel] 관련성 일괄 평가 (1회 LLM 호출)\n            print(\"\\n[IsRel] 검색 문서 관련성 일괄 평가 중...\")\n            batch = self.grade_relevance_batch(question, docs)\n            relevant_docs = []\n            for grade in batch.results:\n                # 구조화 출력이 잘못된 인덱스를 줄 수 있으므로 범위를 검사해 안전하게 매핑함\n                if not 0 <= grade.document_index < len(docs):\n                    continue\n                mark = \"관련 있음\" if grade.is_relevant else \"관련 없음\"\n                print(f\"  문서 {grade.document_index + 1}: {mark}\")\n                if grade.is_relevant:\n                    relevant_docs.append(docs[grade.document_index])\n            result[\"relevant_docs\"] = relevant_docs\n            print(f\"  → 관련 문서 {len(relevant_docs)}개 (1회 LLM 호출로 평가)\")\n\n            if relevant_docs:\n                context = self._format_docs(relevant_docs)\n\n                # 4. 답변 생성\n                print(\"\\n[생성] 컨텍스트 기반 답변 생성 중...\")\n                answer = self.generate_answer(question, context)\n\n                # 5. [IsSup] 근거성 검증 → 실패 시 엄격 근거 기반 재생성\n                print(\"\\n[IsSup] 답변의 근거성 평가 중...\")\n                support = self.grade_support(answer, context)\n                result[\"support_grade\"] = support\n                print(f\"  → 근거 있음: {support.is_supported} ({support.reasoning})\")\n                if not support.is_supported:\n                    print(\"\\n[재생성] 근거 부족 → 엄격 근거 기반으로 답변 재생성 중...\")\n                    answer = self.regenerate_with_strict_grounding(question, context)\n            else:\n                # 검색은 필요했으나 관련 문서가 없으면 LLM 지식으로 답변\n                print(\"\\n[생성] 관련 문서 없음 → LLM 지식으로 답변 생성 중...\")\n                answer = self.generate_answer_without_context(question)\n        else:\n            # 검색 불필요 → 파라메트릭 지식으로 직접 답변\n            print(\"\\n[생성] 검색 불필요 → LLM 지식으로 답변 생성 중...\")\n            answer = self.generate_answer_without_context(question)\n\n        result[\"answer\"] = answer\n\n        # 6. [IsUse] 유용성 평가 → 실패 시 Query Rewriting 후 처음부터 재시도\n        print(\"\\n[IsUse] 답변의 유용성 평가 중...\")\n        usefulness = self.grade_usefulness(original_question, answer)\n        result[\"usefulness_grade\"] = usefulness\n        print(f\"  → 유용함: {usefulness.is_useful} ({usefulness.reasoning})\")\n\n        if not usefulness.is_useful and retry_count < MAX_RETRIES:\n            print(\"\\n[Query Rewriting] 유용성 미달 → 질문 재작성 중...\")\n            rewritten = self.rewrite_query(original_question, answer, usefulness.reasoning)\n            print(f\"  → 재작성 질문: {rewritten.rewritten_query} ({rewritten.reasoning})\")\n            rewrites.append({\n                \"from\": question,\n                \"to\": rewritten.rewritten_query,\n                \"reasoning\": rewritten.reasoning,\n            })\n            # 재작성한 질문으로 [Retrieve]부터 다시 실행 (처음부터 재시도). 누적 이력(rewrites)을 함께 전달함\n            return self._invoke_with_retry(rewritten.rewritten_query, original_question, retry_count + 1, rewrites)\n\n        if not usefulness.is_useful:\n            print(f\"\\n[경고] 최대 재시도 횟수({MAX_RETRIES}회)에 도달함. 마지막 답변을 그대로 반환함.\")\n\n        return result"
    },
    {
      "id": "format_docs",
      "name": "_format_docs()",
      "fileId": "main",
      "summary": "관련 문서들을 출처·청크 번호 헤더와 함께 하나의 컨텍스트 문자열로 합치는 도우미 함수.",
      "how": "검색기는 Document 객체 목록을 주는데 프롬프트에는 글자로 넣어야 함. 각 문서 앞에 [문서 N]·출처 파일명·청크 번호를 붙여 LLM 이 근거를 인용하기 쉽게 하고, 사람도 출처를 알 수 있게 함. 문서 사이는 구분선(---)으로 띄워 경계를 분명히 함.",
      "terms": [
        "청크",
        "Document",
        "metadata"
      ],
      "lines": [
        {
          "at": "def _format_docs",
          "text": "관련 문서 목록을 컨텍스트 문자열로 합치는 도우미 함수 정의."
        },
        {
          "at": "for i, doc in enumerate(docs, 1)",
          "text": "관련 문서를 1번부터 번호를 매기며 하나씩 처리."
        },
        {
          "at": "source = doc.metadata.get(\"source\"",
          "text": "문서의 출처 파일명을 메타데이터에서 꺼냄."
        },
        {
          "at": "chunk_index = doc.metadata.get(\"chunk_index\"",
          "text": "청크가 문서에서 몇 번째 조각인지 번호를 꺼냄."
        },
        {
          "at": "return \"\\n\\n---\\n\\n\".join(formatted)",
          "text": "문서 블록들을 구분선으로 이어 하나의 컨텍스트 문자열로 만듦."
        }
      ],
      "code": "    def _format_docs(self, docs: list[Document]) -> str:\n        \"\"\"관련 문서들을 출처·청크 번호 헤더와 함께 하나의 컨텍스트 문자열로 합침.\"\"\"\n        formatted = []\n        for i, doc in enumerate(docs, 1):\n            # 공용 벡터 DB의 메타데이터 키는 source/chunk_index/total_chunks/char_count임\n            source = doc.metadata.get(\"source\", \"알 수 없음\")\n            chunk_index = doc.metadata.get(\"chunk_index\", \"?\")\n            formatted.append(f\"[문서 {i}] (출처: {source} #{chunk_index})\\n{doc.page_content}\")\n        return \"\\n\\n---\\n\\n\".join(formatted)"
    },
    {
      "id": "output_run",
      "name": "출력·실행 (summary / print / demo / chat / main)",
      "fileId": "main",
      "summary": "Reflection 판단 결과를 요약·출력하고, 데모/대화형 모드로 Self-RAG 체인을 실행하는 진입부.",
      "how": "결과 표시와 실행 진입을 담당함. format_reflection_summary 는 [Retrieve]·[IsRel]·[IsSup]·[IsUse] 판단과 재작성 이력을 표로 요약하고, print_result 가 요약·최종 답변을 출력함. run_demo 는 검증 질의 3건(인사·특허법 외·특허법)을 자동 실행하고, chat 은 대화형 루프를 돔. main 은 벡터 DB·LLM·SelfRAGChain 을 준비한 뒤 --demo 인자 유무로 모드를 고르고, 맨 아래 if __name__ 관용구로 직접 실행 시에만 main 을 부름.",
      "terms": [
        "Reflection Token",
        "재시도 루프",
        "Self-RAG",
        "if __name__ == \"__main__\""
      ],
      "lines": [
        {
          "at": "def format_reflection_summary",
          "text": "Reflection 판단 결과를 한눈에 보이는 요약 문자열로 만드는 함수 정의."
        },
        {
          "at": "for step, rewrite in enumerate(result.get(\"rewritten_queries\"",
          "text": "질문 재작성 이력을 단계별로 표시함."
        },
        {
          "at": "[Retrieve] 검색 수행",
          "text": "검색을 수행했는지 요약 줄에 표시."
        },
        {
          "at": "[IsUse ] 유용함",
          "text": "최종 유용성 판단을 요약 줄에 표시."
        },
        {
          "at": "def print_result",
          "text": "요약과 최종 답변을 콘솔에 출력하는 함수 정의."
        },
        {
          "at": "def run_demo",
          "text": "검증 질의 3건을 비대화형으로 순차 실행하는 함수 정의(--demo)."
        },
        {
          "at": "demo_questions = [",
          "text": "인사·특허법 외 주제·특허법 질문 3종 검증 질의를 정의."
        },
        {
          "at": "def chat",
          "text": "대화형 챗봇 루프를 실행하는 함수 정의."
        },
        {
          "at": "question = input(\"질문: \")",
          "text": "사용자에게서 질문을 입력받음."
        },
        {
          "at": "def main",
          "text": "벡터 DB·LLM·체인을 준비하고 모드에 따라 실행하는 진입점 함수 정의."
        },
        {
          "at": "chain = SelfRAGChain(llm, vectorstore)",
          "text": "LLM과 벡터 스토어로 Self-RAG 처리 엔진을 만듦."
        },
        {
          "at": "if \"--demo\" in sys.argv[1:]",
          "text": "--demo 인자가 있으면 데모, 없으면 대화형으로 분기."
        },
        {
          "at": "if __name__ == \"__main__\"",
          "text": "이 파일을 직접 실행할 때만 main()을 수행하는 관용구."
        }
      ],
      "code": "def format_reflection_summary(result: dict) -> str:\n    \"\"\"Reflection Token들의 판단 결과를 한눈에 보이도록 요약 문자열로 만듦.\"\"\"\n    lines = [\"=\" * 60, \"Self-RAG 처리 결과 요약\", \"=\" * 60]\n    if result.get(\"retry_count\", 0) > 0:\n        lines.append(f\"[Retry ] 재시도 횟수 : {result['retry_count']}\")\n        lines.append(f\"[Query ] 원래 질문   : {result.get('original_question', '')}\")\n        lines.append(f\"[Query ] 최종 질문   : {result.get('current_question', '')}\")\n        # Query Rewriting으로 질문이 바뀐 이력을 단계별로 표시함\n        for step, rewrite in enumerate(result.get(\"rewritten_queries\", []), 1):\n            lines.append(f\"[Rewrite {step}] {rewrite['from']} → {rewrite['to']}\")\n    lines.append(f\"[Retrieve] 검색 수행 : {result['used_retrieval']}\")\n    if result[\"used_retrieval\"]:\n        lines.append(f\"[검색  ] 검색 문서   : {len(result['retrieved_docs'])}개\")\n        lines.append(f\"[IsRel ] 관련 문서   : {len(result['relevant_docs'])}개\")\n    if result[\"support_grade\"] is not None:\n        lines.append(f\"[IsSup ] 근거 있음   : {result['support_grade'].is_supported}\")\n    if result[\"usefulness_grade\"] is not None:\n        lines.append(f\"[IsUse ] 유용함     : {result['usefulness_grade'].is_useful}\")\n    lines.append(\"=\" * 60)\n    return \"\\n\".join(lines)\n\n\ndef print_result(result: dict) -> None:\n    \"\"\"처리 요약과 최종 답변을 콘솔에 출력함.\"\"\"\n    print(\"\\n\" + format_reflection_summary(result))\n    print(\"\\n\" + \"-\" * 60)\n    print(\"답변:\")\n    print(\"-\" * 60)\n    print(result[\"answer\"])\n    print(\"-\" * 60)\n\n\ndef run_demo(chain: SelfRAGChain) -> None:\n    \"\"\"교재 검증 질의 3건을 비대화형으로 순차 실행함 (--demo).\"\"\"\n    demo_questions = [\n        \"안녕하세요?\",                       # 검색 불필요 (인사)\n        \"개인정보보호법의 정의와 범위는 ?\",   # 검색 불필요 (특허법 외 주제)\n        \"특허를 받을 수 있는 조건은 ?\",       # 검색 필요 (특허법)\n    ]\n    for idx, question in enumerate(demo_questions, 1):\n        print(\"\\n\" + \"#\" * 60)\n        print(f\"# 데모 질의 {idx}/{len(demo_questions)}: {question}\")\n        print(\"#\" * 60)\n        print_result(chain.invoke(question))\n\n\ndef chat(chain: SelfRAGChain) -> None:\n    \"\"\"대화형 챗봇 루프를 실행함.\"\"\"\n    print(\"\\n\" + \"=\" * 60)\n    print(\"특허법 Self-RAG 챗봇\")\n    print(\"=\" * 60)\n    print(\"검색 필요 여부를 스스로 판단하고, 답변 품질을 자체 검증합니다.\")\n    print(\"종료하려면 'quit' 또는 'q'를 입력하세요.\")\n    print(\"=\" * 60 + \"\\n\")\n\n    while True:\n        try:\n            question = input(\"질문: \").strip()\n            if not question:\n                continue\n            if question.lower() in (\"quit\", \"q\", \"exit\", \"종료\"):\n                print(\"\\n챗봇을 종료합니다. 감사합니다!\")\n                break\n            print_result(chain.invoke(question))\n            print()\n        except KeyboardInterrupt:\n            print(\"\\n\\n챗봇을 종료합니다.\")\n            break\n        except Exception as error:\n            print(f\"\\n오류가 발생했습니다: {error}\\n\")\n\n\ndef main() -> None:\n    \"\"\"벡터 DB·LLM·Self-RAG 체인을 준비하고, 모드(데모/대화형)에 따라 실행함.\"\"\"\n    print(\"\\n\" + \"=\" * 60)\n    print(\"특허법 Self-RAG 예제 (Groq gpt-oss-120b)\")\n    print(\"=\" * 60)\n    try:\n        vectorstore = load_vectorstore()\n        print(f\"벡터 DB 로드 완료: {VECTORDB_DIR} (컬렉션 {COLLECTION_NAME}, {vectorstore._collection.count()}개 청크)\")\n        llm = build_llm()\n        chain = SelfRAGChain(llm, vectorstore)\n\n        # 명령행 인자에 --demo가 있으면 비대화형 데모, 없으면 대화형 챗봇으로 동작함\n        if \"--demo\" in sys.argv[1:]:\n            run_demo(chain)\n        else:\n            chat(chain)\n    except (FileNotFoundError, RuntimeError) as error:\n        print(f\"\\n[오류] {error}\", file=sys.stderr)\n        sys.exit(1)\n\n\n# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)\nif __name__ == \"__main__\":\n    main()"
    }
  ],
  "glossary": {
    "Self-RAG": "Self-Reflective RAG. LLM이 '검색이 필요한가 / 문서가 관련 있나 / 답이 근거 있나 / 답이 유용한가'를 스스로 판단(Reflection)하며 검색·생성·재시도를 제어하는 RAG 방식. 검색이 항상 일어나는 Naive RAG와 달리 필요할 때만 검색하고, 답을 자체 검증·교정함.",
    "RAG": "Retrieval-Augmented Generation. 외부 문서에서 관련 내용을 먼저 찾아(검색) 그 근거로 LLM이 답하게 하는 방식. 모델이 모르는 전문·최신 정보도 문서만 있으면 답할 수 있게 함.",
    "Reflection Token": "Self-RAG에서 LLM이 워크플로우 각 단계마다 스스로 내리는 판단 신호. 이 예제의 [Retrieve]·[IsRel]·[IsSup]·[IsUse] 네 가지가 검색·관련성·근거성·유용성을 차례로 점검함.",
    "검색 필요성 판단": "[Retrieve] 단계. 질문을 보고 외부 문서 검색이 필요한지(특허법 질문) 아닌지(인사·타 주제)를 LLM이 스스로 결정하는 것.",
    "문서 관련성 평가": "[IsRel] 단계. 검색해 온 문서들이 질문에 실제로 도움이 되는지 채점해 관련 있는 것만 추리는 것. 이 예제는 여러 문서를 1회 LLM 호출로 일괄 평가함.",
    "환각 점검": "[IsSup] 단계. 생성된 답변이 검색 문서에 근거하는지, 지어낸(환각) 내용은 없는지 검증하는 것. 근거가 부족하면 컨텍스트만 쓰도록 엄격히 제약해 다시 생성함.",
    "답변 유용성 평가": "[IsUse] 단계. 최종 답이 질문에 직접·명확히 답하며 실질적으로 도움이 되는지 평가하는 것. 미흡하면 질문을 고쳐 재시도함.",
    "질문 재작성": "Query Rewriting. [IsUse]에서 답이 유용하지 않다고 판정되면, 더 나은 검색을 위해 질문을 구체적·전문적 용어로 다시 쓰는 것.",
    "재시도 루프": "[IsUse] 실패 시 질문을 재작성해 [Retrieve]부터 전체 과정을 처음부터 다시 실행하는 자기교정 반복. 이 예제는 최대 MAX_RETRIES(3)회 반복함.",
    "Naive RAG": "가장 단순한 형태의 RAG. '검색 → 생성'을 한 번, 가공·검증 없이 곧장 수행함. Self-RAG는 여기에 검색 필요 판단과 자체 검증·재시도를 더한 것.",
    "Pydantic": "파이썬에서 데이터의 '형식(스키마)'을 클래스로 정의하고 검증하는 라이브러리. 여기서는 LLM이 정해진 칸을 채워 답하도록 양식을 정하는 데 사용.",
    "with_structured_output": "LLM 응답을 자유 문장이 아니라 지정한 Pydantic 스키마(JSON)로 강제해 안정적으로 파싱하게 하는 LangChain 기능. 이 예제는 5개 채점기를 이 방식으로 만듦.",
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
    "TOP_K": "검색에서 가져올 상위 청크 개수를 정한 상수. 이 예제에서는 5.",
    "유사도 검색": "similarity search. 질문 벡터와 문서 벡터의 '가까운 정도'를 계산해 가장 가까운 것부터 찾는 검색 방식.",
    "MAX_RETRIES": "[IsUse] 실패 시 질문을 고쳐 재시도하는 최대 횟수를 정한 상수. 이 예제에서는 3.",
    "ChatGroq": "Groq 클라우드의 채팅 LLM을 호출하는 LangChain 래퍼. GROQ_API_KEY를 자동/명시 참조함.",
    "Groq LPU": "Groq사가 만든 LLM 추론 전용 칩(Language Processing Unit). 매우 빠른 응답 속도가 특징.",
    "gpt-oss-120b": "Groq LPU에서 서빙하는 오픈 가중치 LLM(약 1200억 파라미터). 이 예제의 답변 생성·자체 검증 모델.",
    "temperature": "LLM 답변의 무작위성 정도. 0에 가까울수록 매번 비슷하고 일관된(보수적인) 답을 냄. 이 예제는 0으로 고정해 판단을 재현 가능하게 함.",
    "ChatPromptTemplate": "LLM에 보낼 프롬프트(지시문)의 틀. {context}·{question} 같은 빈칸에 실제 값을 채워 완성된 프롬프트를 만듦.",
    "프롬프트": "LLM에게 주는 지시문. 이 예제는 단계마다 '검색 필요를 판단하라', '근거 있는지 평가하라' 같은 서로 다른 시스템 프롬프트를 씀.",
    "LCEL": "LangChain Expression Language. 파이프 기호(|)로 단계들을 왼쪽→오른쪽으로 연결해 하나의 처리 흐름(체인)을 만드는 문법.",
    "파이프(|)": "LCEL에서 앞 단계의 결과를 다음 단계의 입력으로 흘려보내는 연결 기호. 'prompt | grader' 나 'prompt | llm | parser'처럼 씀.",
    "StrOutputParser": "LLM 응답 객체에서 사람이 읽을 본문 문자열만 깔끔히 뽑아 주는 출력 파서.",
    "invoke": "LangChain 체인/검색기/채점기를 '실행'하는 메서드. 입력을 넣으면 끝까지 돌려 결과를 돌려줌.",
    "load_dotenv": ".env 파일에 적어 둔 비밀값(예: GROQ_API_KEY, OPENAI_API_KEY)을 프로그램의 환경변수로 불러오는 함수.",
    "from __future__ import annotations": "타입 힌트를 즉시 평가하지 않고 문자열로 두게 하는 파이썬 선언. 순환 참조 없이 가볍게 타입 힌트를 쓰게 해 줌.",
    "Path(__file__).resolve().parent": "지금 이 파이썬 파일이 있는 폴더의 절대경로를 구하는 관용구. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "if __name__ == \"__main__\"": "이 파일을 직접 실행할 때만 특정 코드를 돌리고, 다른 곳에서 import할 때는 돌리지 않게 하는 파이썬 관용구.",
    "API 키 검사": "필요한 API 키가 환경변수에 없으면 실행 초기에 명확한 오류를 내는 패턴. 한참 뒤에 엉뚱한 곳에서 실패하는 것을 막아 디버깅을 쉽게 함."
  }
};
