window.EXPLAIN_DATA = {
  "meta": {
    "title": "인덱싱(Indexing) — 공용 벡터 DB 구축",
    "entry": "indexing.py"
  },
  "files": [
    {
      "id": "main",
      "label": "indexing.py",
      "role": "특허법 PDF를 읽어 잘게 쪼개고 숫자 벡터로 바꿔 ChromaDB에 저장하는 인덱싱 전체 (이후 RAG 예제가 공유하는 공용 DB 생성)"
    }
  ],
  "flow": [
    {
      "step": 1,
      "title": "실행 & 환경 준비",
      "summary": "python indexing.py 로 실행하고, .env 의 OpenAI 키를 불러옴",
      "detail": "터미널에서 'python indexing.py' 로 실행함. 시작과 동시에 load_dotenv() 가 hands-on/.env 에 적어 둔 OPENAI_API_KEY(임베딩에 필요)를 환경변수로 올림. 한글 출력이 깨지지 않게 표준출력을 UTF-8로 맞추는 처리도 함. 또 청크 크기·구분자·컬렉션명 같은 핵심 설정값을 상수로 정해 둠. 비유하면, 도서관 사서가 출근해 책상에 임베딩 열쇠를 챙기고, '책을 어떻게 자르고 어디에 꽂을지' 규칙표를 펼쳐 두는 단계."
    },
    {
      "step": 2,
      "title": "PDF 로드",
      "summary": "data 폴더의 모든 PDF를 페이지 단위로 읽어 들임",
      "detail": "PyPDFLoader 로 data 디렉터리의 PDF를 전부 읽어 '페이지마다 한 덩어리(Document)'로 만듦. 각 페이지에는 원본 파일명·페이지 번호 같은 부가정보(metadata)가 자동으로 붙음. 파일 순서는 sorted()로 고정해, 다시 실행해도 청크 번호가 똑같이 나오게 함. 글자가 하나도 안 뽑히면(스캔 이미지 PDF) 바로 오류를 냄. 비유하면, 사서가 서고의 책들을 가져와 페이지를 한 장 한 장 펼쳐 놓는 단계."
    },
    {
      "step": 3,
      "title": "전처리 (노이즈 제거)",
      "summary": "머리글·페이지 번호 같은 반복 노이즈를 정규식으로 지움",
      "detail": "법령 PDF는 모든 페이지 위에 '특허법' 같은 머리글과 '- 1 -' 형식의 페이지 번호, '법제처/국가법령정보센터' 같은 출처 줄이 반복해서 들어 있음. 이런 글자는 검색에 방해만 되므로 clean_text() 가 정규식으로 깔끔히 지우고, 연속된 공백·빈 줄도 정리함. 전처리 후 내용이 텅 빈 페이지는 아예 버림. 비유하면, 복사본마다 찍힌 도장·쪽번호를 지우개로 지워 본문만 남기는 단계."
    },
    {
      "step": 4,
      "title": "청킹 (조문 단위로 쪼개기)",
      "summary": "법령 구조를 살려 긴 문서를 검색하기 좋은 조각으로 나눔",
      "detail": "긴 문서를 통째로 검색에 쓰면 정확도가 떨어지므로, RecursiveCharacterTextSplitter 로 약 800자 크기의 청크로 잘게 나눔(앞뒤 200자는 겹치게 해 맥락이 끊기지 않게 함). 이때 그냥 글자 수로 자르지 않고 '\\n제'(조문), '\\n①'(항) 같은 법령 구분자를 우선 경계로 삼아, 조·항이 중간에 잘리지 않게 함. 비유하면, 두꺼운 법전을 아무 데서나 찢지 않고 '제○조' 단위로 가지런히 잘라 카드로 만드는 단계."
    },
    {
      "step": 5,
      "title": "노이즈 청크 필터 + 메타데이터 부여",
      "summary": "쓸모없는 조각을 버리고, 남은 조각마다 출처·번호를 붙임",
      "detail": "쪼개다 보면 '[전문개정 2014. 6. 11.]' 같은 개정 태그만 담긴 빈 껍데기 청크가 생기는데, 검색 결과 위쪽을 차지해 품질을 떨어뜨리므로 filter_chunks() 가 정규식으로 골라 버림(무엇을 버렸는지 로그로 남김). 남은 청크마다 attach_metadata() 가 출처 파일명·청크 순번·전체 개수·문자 수 4개를 붙여, 나중에 답변 출처를 표시할 수 있게 함. 비유하면, 글자 없는 카드는 버리고, 남은 카드마다 '몇 번 카드·어느 책'이라고 라벨을 붙이는 단계."
    },
    {
      "step": 6,
      "title": "임베딩 + ChromaDB 저장 (멱등)",
      "summary": "청크를 숫자 벡터로 바꿔 벡터 DB에 영속 저장함",
      "detail": "OpenAIEmbeddings 로 각 청크를 의미가 담긴 1536개 숫자(벡터)로 바꾸고, Chroma.from_documents 로 ChromaDB 컬렉션(patent_law)에 저장함. 저장 폴더는 디스크에 영속화되어 프로그램을 꺼도 남음. 단, 같은 문서가 중복으로 쌓이면 검색 품질이 나빠지므로, 기존 폴더를 통째로 지운 뒤 새로 만듦(=몇 번을 실행해도 결과가 같은 멱등 동작). 비유하면, 카드마다 좌표(벡터)를 매겨 서가에 꽂되, 헷갈리지 않게 서가를 비우고 처음부터 다시 정리하는 단계."
    },
    {
      "step": 7,
      "title": "검증",
      "summary": "저장된 벡터 수·차원을 확인하고 테스트 검색을 해 봄",
      "detail": "인덱싱이 제대로 됐는지 verify_vectordb() 가 점검함. 저장된 벡터 개수를 세고, 테스트 질문 하나를 임베딩해 차원이 1536인지 확인하고, 실제로 유사도 검색을 돌려 상위 5건이 잘 나오는지 출력함. 여기까지 통과하면 공용 벡터 DB가 준비된 것. 비유하면, 정리를 끝낸 사서가 시험 삼아 질문 하나를 던져 '관련 카드가 제대로 뽑히는지' 마지막으로 확인하는 단계."
    }
  ],
  "functions": [
    {
      "id": "setup",
      "name": "임포트·경로·상수 설정",
      "fileId": "main",
      "summary": "필요한 모듈을 가져오고, 파일 위치 기준으로 경로를 잡고, .env 키와 인덱싱 핵심 설정값을 준비하는 부분.",
      "how": "함수가 아니라 파일 위쪽의 준비 코드 모음임. ① from __future__ import annotations 로 타입 힌트를 가볍게 쓰고, 표준출력을 UTF-8로 맞춤. ② 모든 경로를 이 파일 위치(__file__) 기준으로 계산해, 어디서 실행해도 같은 data 폴더·공용 벡터 DB·.env 를 가리키게 함. ③ load_dotenv 로 OpenAI 키를 올림. ④ 컬렉션명·임베딩 모델·청크 크기/겹침·법령 구분자(separators)·머리글·노이즈 판별 정규식 같은 핵심 상수를 정함. 이 값들이 인덱싱 품질을 좌우함.",
      "terms": [
        "from __future__ import annotations",
        "Path(__file__).resolve().parent",
        "load_dotenv",
        "인덱싱",
        "컬렉션",
        "영속화",
        "text-embedding-3-small",
        "chunk_size",
        "chunk_overlap",
        "separators(법령 구분자)",
        "정규식",
        "ChromaDB"
      ],
      "lines": [
        {
          "at": "from __future__ import annotations",
          "text": "타입 힌트를 문자열로 평가해 가볍게 쓰게 하는 파이썬 설정."
        },
        {
          "at": "import re",
          "text": "정규식(글자 패턴 찾기·바꾸기) 기능을 쓰기 위한 기본 모듈."
        },
        {
          "at": "sys.stdout.reconfigure(encoding",
          "text": "윈도우 콘솔에서 한글이 깨지지 않도록 출력 인코딩을 UTF-8로 바꿈."
        },
        {
          "at": "SCRIPT_DIR = Path(__file__)",
          "text": "이 파일이 있는 폴더(indexing/)를 절대경로로 구함 — 실행 위치와 무관하게 동작."
        },
        {
          "at": "DATA_DIR = RAG_DIR / \"data\"",
          "text": "인덱싱할 PDF들이 들어 있는 data 폴더 경로를 잡음."
        },
        {
          "at": "VECTORDB_DIR = RAG_DIR / \"vectordb\"",
          "text": "벡터 DB를 저장할 공용 폴더(../vectordb) 경로를 잡음."
        },
        {
          "at": "ENV_PATH = RAG_DIR.parent",
          "text": "API 키가 든 hands-on/.env 파일 경로를 잡음."
        },
        {
          "at": "load_dotenv(ENV_PATH)",
          "text": ".env 에서 OPENAI_API_KEY 를 실제로 읽어 환경변수로 올림."
        },
        {
          "at": "COLLECTION_NAME = \"patent_law\"",
          "text": "저장할 벡터 DB의 컬렉션 이름 — 검색 예제도 같은 이름을 씀."
        },
        {
          "at": "EMBEDDING_MODEL =",
          "text": "청크를 벡터로 바꿀 임베딩 모델(1536차원) 이름."
        },
        {
          "at": "CHUNK_SIZE = 800",
          "text": "청크 한 조각의 최대 글자 수를 800으로 정함."
        },
        {
          "at": "CHUNK_OVERLAP = 200",
          "text": "이웃한 청크끼리 200자를 겹치게 해 맥락이 끊기지 않게 함."
        },
        {
          "at": "LAW_SEPARATORS =",
          "text": "쪼갤 때 우선시할 경계 목록 — '\\n제'(조문)·'\\n①'(항)을 앞쪽에 둠."
        },
        {
          "at": "RUNNING_HEADER = \"특허법\"",
          "text": "모든 페이지 위에 반복되는 머리글 문구 — 제거 대상으로 지정."
        },
        {
          "at": "TAG_ONLY_PATTERN = re.compile",
          "text": "개정 태그(예 [전문개정 ...])만 든 청크를 가려낼 정규식을 미리 컴파일."
        }
      ],
      "code": "from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함\n\nimport re\nimport shutil\nimport sys\nfrom pathlib import Path\n\n# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함\nif hasattr(sys.stdout, \"reconfigure\"):\n    sys.stdout.reconfigure(encoding=\"utf-8\")\n\n# ---------------------------------------------------------------------------\n# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)\n# ---------------------------------------------------------------------------\nSCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(indexing/)를 절대경로로 구함\nRAG_DIR = SCRIPT_DIR.parent                     # hands-on/10.rag/\nDATA_DIR = RAG_DIR / \"data\"                     # 인덱싱 대상 PDF 디렉터리\nVECTORDB_DIR = RAG_DIR / \"vectordb\"             # ChromaDB 영속화 디렉터리 (공용 DB, indexing/ 밖 parent 레벨)\nENV_PATH = RAG_DIR.parent / \".env\"              # hands-on/.env (API 키 보관)\n\n# ---------------------------------------------------------------------------\n# 환경변수 로드\n# ---------------------------------------------------------------------------\nfrom dotenv import load_dotenv\n\nload_dotenv(ENV_PATH)  # .env 파일에서 OPENAI_API_KEY 등 환경변수를 로드함 (langchain-openai가 자동 참조)\n\n# ---------------------------------------------------------------------------\n# 상수 정의\n# ---------------------------------------------------------------------------\nCOLLECTION_NAME = \"patent_law\"               # 공용 벡터 DB 컬렉션명 (다운스트림 예제가 동일 이름으로 검색)\nEMBEDDING_MODEL = \"text-embedding-3-small\"   # OpenAI 임베딩 모델 (출력 1536차원)\nCHUNK_SIZE = 800                             # 청크 최대 크기 (문자 수)\nCHUNK_OVERLAP = 200                          # 청크 간 겹치는 문자 수 (맥락 보존)\n\n# 법령 문서 구조를 우선 보존하기 위한 분할 구분자 (앞쪽 우선순위)\n# \"\\n제\"(조문) → \"\\n①~⑤\"(항) → \"\\n\\n\"(단락) → \"\\n\"(줄) → \" \"(어절) → \"\"(문자)\nLAW_SEPARATORS = [\"\\n제\", \"\\n①\", \"\\n②\", \"\\n③\", \"\\n④\", \"\\n⑤\", \"\\n\\n\", \"\\n\", \" \", \"\"]\n\n# 국가법령정보센터 PDF는 모든 페이지 상단에 법령명을 머리글로 반복 삽입함 (검색 노이즈)\nRUNNING_HEADER = \"특허법\"\n\n# 청크 본문이 개정 이력 태그·머리글만으로 이루어졌는지 판별하는 정규식\n# 예: \"[전문개정 2014. 6. 11.]\", \"[시행 ...] [법률 제21134호]\" → 검색 가치가 없어 제거 대상\nTAG_ONLY_PATTERN = re.compile(r\"^(\\[[^\\]]*\\]\\s*)+$\")"
    },
    {
      "id": "clean_text",
      "name": "clean_text()",
      "fileId": "main",
      "summary": "PDF에서 뽑은 글에서 머리글·페이지 번호·출처 줄 같은 반복 노이즈를 정규식으로 지우는 함수.",
      "how": "PDF는 페이지마다 같은 머리글·쪽번호가 반복되는데, 이런 글자는 검색에 방해만 됨. ① '- 1 -', '1 / 50' 같은 페이지 번호를 정규식으로 지움. ② 줄을 한 줄씩 보며 '법제처·국가법령정보센터' 키워드가 든 줄, 그리고 줄 전체가 머리글('특허법')뿐인 줄을 빼버림. ③ 마지막으로 연속 공백과 과도한 빈 줄을 정규식으로 정리해 깔끔한 본문만 돌려줌.",
      "terms": [
        "정규식",
        "PyPDFLoader"
      ],
      "lines": [
        {
          "at": "def clean_text",
          "text": "노이즈를 제거하는 전처리 함수 정의."
        },
        {
          "at": "re.sub(r\"-\\s*\\d+\\s*-\"",
          "text": "'- 1 -' 형식의 페이지 번호를 정규식으로 찾아 지움."
        },
        {
          "at": "lines = text.split(\"\\n\")",
          "text": "줄 단위로 검사하기 위해 본문을 줄별로 나눔."
        },
        {
          "at": "noise_keywords =",
          "text": "머리글/바닥글에 자주 나오는 출처 키워드 목록을 정함."
        },
        {
          "at": "if any(kw in line for kw in noise_keywords)",
          "text": "그 키워드가 든 줄이면 통째로 건너뜀(제거)."
        },
        {
          "at": "if line.strip() == RUNNING_HEADER",
          "text": "줄 전체가 머리글('특허법')뿐인 반복 줄을 제거."
        },
        {
          "at": "cleaned_lines.append(line)",
          "text": "노이즈가 아닌 줄만 결과 목록에 모음."
        },
        {
          "at": "re.sub(r\"\\n{3,}\"",
          "text": "빈 줄이 3줄 이상이면 2줄로 줄여 과도한 여백을 정리."
        },
        {
          "at": "return text.strip()",
          "text": "앞뒤 공백을 떼고 깨끗해진 본문을 돌려줌."
        }
      ],
      "code": "def clean_text(text: str) -> str:\n    \"\"\"PDF 추출 텍스트에서 머리글·바닥글·페이지 번호 등 노이즈를 제거함.\n\n    PyPDFLoader는 페이지 단위로 텍스트를 추출하므로 법제처 머리글, \"- 1 -\" 형식의\n    페이지 번호 등 검색에 불필요한 반복 텍스트가 섞임. 이를 정규식으로 정리함.\n    \"\"\"\n    # 페이지 번호 패턴 제거: \"- 1 -\", \"1 / 50\" 형식\n    text = re.sub(r\"-\\s*\\d+\\s*-\", \"\", text)\n    text = re.sub(r\"\\d+\\s*/\\s*\\d+\", \"\", text)\n    # 머리글·바닥글에 자주 등장하는 키워드가 포함된 줄과 반복 법령명 머리글 줄을 제거함\n    lines = text.split(\"\\n\")\n    noise_keywords = [\"법제처\", \"국가법령정보센터\"]\n    cleaned_lines = []\n    for line in lines:\n        # \"법제처 ... 국가법령정보센터\" 형식의 페이지 머리글/바닥글 줄 제거\n        if any(kw in line for kw in noise_keywords):\n            continue\n        # 줄 전체가 법령명(\"특허법\")뿐인 반복 머리글 줄 제거 (본문 내 인용은 다른 글자와 함께 등장하므로 안전)\n        if line.strip() == RUNNING_HEADER:\n            continue\n        cleaned_lines.append(line)\n    text = \"\\n\".join(cleaned_lines)\n    # 연속 공백·과도한 빈 줄 정규화\n    text = re.sub(r\"[ \\t]+\", \" \", text)\n    text = re.sub(r\"\\n{3,}\", \"\\n\\n\", text)\n    return text.strip()"
    },
    {
      "id": "load_pdfs",
      "name": "load_pdfs()",
      "fileId": "main",
      "summary": "data 폴더의 모든 PDF를 PyPDFLoader로 읽어 페이지 단위 Document 목록으로 돌려주는 함수.",
      "how": "인덱싱의 첫 단계인 '읽기'를 담당함. ① data 폴더의 PDF 경로를 sorted()로 정렬해 처리 순서를 고정함(재실행 시 청크 번호 일치). PDF가 없으면 오류를 냄. ② 각 PDF를 PyPDFLoader로 읽어 페이지마다 Document로 만들고 모두 모음. 각 Document에는 원본 경로·페이지 번호가 metadata로 자동으로 붙음. ③ 전체 글자 수가 0이면(스캔 이미지 PDF) 오류를 내 조기에 잡아냄.",
      "terms": [
        "PyPDFLoader",
        "metadata"
      ],
      "lines": [
        {
          "at": "def load_pdfs",
          "text": "PDF들을 읽어 Document 목록으로 만드는 함수 정의."
        },
        {
          "at": "from langchain_community.document_loaders import PyPDFLoader",
          "text": "PDF를 페이지 단위로 읽는 LangChain 로더를 가져옴."
        },
        {
          "at": "pdf_paths = sorted(",
          "text": "PDF 파일 순서를 고정해 재실행해도 청크 번호가 같게 함."
        },
        {
          "at": "raise FileNotFoundError",
          "text": "PDF가 한 개도 없으면 명확한 오류를 냄."
        },
        {
          "at": "pages = PyPDFLoader(str(pdf_path)).load()",
          "text": "한 PDF를 읽어 페이지마다 Document로 변환."
        },
        {
          "at": "documents.extend(pages)",
          "text": "읽은 페이지들을 전체 목록에 합침."
        },
        {
          "at": "total_chars = sum(",
          "text": "모든 페이지의 글자 수를 더해 추출량을 확인."
        },
        {
          "at": "if total_chars == 0",
          "text": "글자가 0이면(스캔 PDF) 텍스트 추출 실패로 오류를 냄."
        },
        {
          "at": "return documents",
          "text": "읽어 들인 페이지 Document 목록을 돌려줌."
        }
      ],
      "code": "def load_pdfs(data_dir: Path) -> list:\n    \"\"\"data 디렉터리의 모든 PDF를 로드하여 Document 리스트로 반환함.\n\n    PyPDFLoader: PDF를 페이지 단위 Document로 변환하는 LangChain 로더.\n    각 Document.metadata에는 원본 경로(source)와 페이지 번호(page)가 담김.\n    \"\"\"\n    from langchain_community.document_loaders import PyPDFLoader\n\n    # sorted()로 파일 처리 순서를 고정해 재실행 시 청크 인덱스가 동일하게 유지되도록 함\n    pdf_paths = sorted(data_dir.glob(\"*.pdf\"))\n    if not pdf_paths:\n        raise FileNotFoundError(f\"PDF 파일을 찾을 수 없음: {data_dir}\")\n\n    documents = []\n    for pdf_path in pdf_paths:\n        pages = PyPDFLoader(str(pdf_path)).load()\n        documents.extend(pages)\n        print(f\"  - {pdf_path.name}: {len(pages)}페이지 로드\")\n\n    # 스캔 PDF(이미지) 등으로 텍스트가 전혀 추출되지 않은 경우를 조기에 감지함\n    total_chars = sum(len(doc.page_content) for doc in documents)\n    if total_chars == 0:\n        raise ValueError(\"PDF에서 텍스트를 추출하지 못함 (스캔 이미지 PDF 가능성)\")\n    return documents"
    },
    {
      "id": "preprocess_documents",
      "name": "preprocess_documents()",
      "fileId": "main",
      "summary": "각 페이지 Document에 clean_text()를 적용해 노이즈를 지우고, 내용이 빈 페이지는 버리는 함수.",
      "how": "읽어 온 페이지들을 하나씩 돌며 본문에 clean_text() 를 적용해 머리글·쪽번호 노이즈를 제거함. 전처리 후 내용이 텅 빈 페이지(머리글만 있던 페이지 등)는 청킹·임베딩 대상에서 빼고, 알맹이가 남은 페이지만 모아 돌려줌.",
      "terms": [
        "metadata"
      ],
      "lines": [
        {
          "at": "def preprocess_documents",
          "text": "페이지별 노이즈 제거를 수행하는 함수 정의."
        },
        {
          "at": "for doc in documents:",
          "text": "읽어 온 페이지를 하나씩 처리."
        },
        {
          "at": "doc.page_content = clean_text(doc.page_content)",
          "text": "각 페이지 본문에 노이즈 제거 함수를 적용."
        },
        {
          "at": "if doc.page_content:",
          "text": "전처리 후에도 내용이 남은 페이지만 남김."
        },
        {
          "at": "cleaned.append(doc)",
          "text": "알맹이가 있는 페이지를 결과 목록에 모음."
        },
        {
          "at": "return cleaned",
          "text": "노이즈를 지운 페이지 목록을 돌려줌."
        }
      ],
      "code": "def preprocess_documents(documents: list) -> list:\n    \"\"\"각 Document의 본문에 clean_text()를 적용하고 빈 페이지를 제거함.\"\"\"\n    cleaned = []\n    for doc in documents:\n        doc.page_content = clean_text(doc.page_content)\n        # 전처리 후 내용이 비어버린 페이지는 청킹·임베딩 대상에서 제외함\n        if doc.page_content:\n            cleaned.append(doc)\n    return cleaned"
    },
    {
      "id": "split_documents",
      "name": "split_documents()",
      "fileId": "main",
      "summary": "RecursiveCharacterTextSplitter로 긴 문서를 법령 구조를 살려 청크로 쪼개는 함수.",
      "how": "검색하기 좋게 문서를 잘게 나누는 '청킹'을 담당함. RecursiveCharacterTextSplitter 를 chunk_size=800·chunk_overlap=200 으로 만들되, separators 에 법령 구분자(LAW_SEPARATORS)를 줘서 '조문→항→단락→줄→어절' 순으로 우선 경계를 잡음. 이렇게 하면 조·항이 중간에 잘리지 않아 의미 단위가 보존됨. split_documents() 한 줄로 모든 페이지를 청크 목록으로 바꿔 돌려줌.",
      "terms": [
        "청크/청킹",
        "RecursiveCharacterTextSplitter",
        "chunk_size",
        "chunk_overlap",
        "separators(법령 구분자)"
      ],
      "lines": [
        {
          "at": "def split_documents",
          "text": "문서를 청크로 쪼개는 함수 정의."
        },
        {
          "at": "from langchain_text_splitters import RecursiveCharacterTextSplitter",
          "text": "재귀적으로 글을 잘라 주는 LangChain 분할기를 가져옴."
        },
        {
          "at": "splitter = RecursiveCharacterTextSplitter(",
          "text": "분할기 객체를 설정값과 함께 생성."
        },
        {
          "at": "chunk_size=CHUNK_SIZE,",
          "text": "청크 한 조각의 최대 글자 수(800)를 지정."
        },
        {
          "at": "chunk_overlap=CHUNK_OVERLAP,",
          "text": "이웃 청크끼리 겹칠 글자 수(200)를 지정해 맥락 보존."
        },
        {
          "at": "separators=LAW_SEPARATORS,",
          "text": "법령 구분자를 우선 경계로 줘 조·항이 안 잘리게 함."
        },
        {
          "at": "return splitter.split_documents(documents)",
          "text": "모든 페이지를 청크 목록으로 잘라 돌려줌."
        }
      ],
      "code": "def split_documents(documents: list) -> list:\n    \"\"\"RecursiveCharacterTextSplitter로 문서를 청크로 분할함.\n\n    RecursiveCharacterTextSplitter: separators 목록을 앞에서부터 순서대로 적용하며\n    chunk_size 이하가 될 때까지 재귀적으로 분할하는 분할기. 법령 구조(조→항)를\n    우선 경계로 삼아 의미 단위가 끊기지 않게 함.\n    \"\"\"\n    from langchain_text_splitters import RecursiveCharacterTextSplitter\n\n    splitter = RecursiveCharacterTextSplitter(\n        chunk_size=CHUNK_SIZE,\n        chunk_overlap=CHUNK_OVERLAP,\n        separators=LAW_SEPARATORS,\n    )\n    return splitter.split_documents(documents)"
    },
    {
      "id": "filter_chunks",
      "name": "filter_chunks()",
      "fileId": "main",
      "summary": "개정 태그만 든 빈 껍데기 청크 등 검색 가치 없는 노이즈 청크를 걸러내는 함수.",
      "how": "청킹 후에도 '[전문개정 ...]' 같은 개정 태그만 담긴 청크가 단독으로 생기는데, 이런 청크는 질문과 무관하게 검색 상위에 떠 품질을 떨어뜨림. ① 청크마다 본문 앞뒤 공백을 떼고, ② 비었거나 TAG_ONLY_PATTERN(태그만으로 구성) 정규식에 걸리면 버림(dropped). ③ 남은 청크만 모으고, 무엇을 버렸는지 로그로 출력해 실수로 짧은 조문이 빠지지 않았는지 확인 가능하게 함.",
      "terms": [
        "청크/청킹",
        "정규식"
      ],
      "lines": [
        {
          "at": "def filter_chunks",
          "text": "노이즈 청크를 걸러내는 함수 정의."
        },
        {
          "at": "for chunk in chunks:",
          "text": "쪼개진 청크를 하나씩 검사."
        },
        {
          "at": "content = chunk.page_content.strip()",
          "text": "청크 본문의 앞뒤 공백을 떼어 검사 준비."
        },
        {
          "at": "if not content or TAG_ONLY_PATTERN.match(content)",
          "text": "비었거나 개정 태그만인 청크면 버림 대상으로 분류."
        },
        {
          "at": "dropped.append(content)",
          "text": "버릴 청크의 내용을 따로 모아 둠."
        },
        {
          "at": "kept.append(chunk)",
          "text": "검색 가치가 있는 청크만 결과에 남김."
        },
        {
          "at": "print(f\"  - 노이즈 청크 제거:",
          "text": "무엇을 몇 개 버렸는지 로그로 남겨 확인 가능하게 함."
        },
        {
          "at": "return kept",
          "text": "노이즈를 걸러낸 청크 목록을 돌려줌."
        }
      ],
      "code": "def filter_chunks(chunks: list) -> list:\n    \"\"\"검색 가치가 없는 노이즈 청크를 제거함.\n\n    법령은 조문보다 큰 청크 앞에서 머리글·개정 태그가 단독 청크로 떨어지는 경우가 있음.\n    이렇게 \"[전문개정 ...]\" 같은 태그만 담긴 청크는 질의와 무관하게 상위에 노출되어 검색\n    품질을 떨어뜨리므로 임베딩 대상에서 제외함. (clean_text가 제거하지 못한 잔여 노이즈 정리)\n    \"\"\"\n    kept = []\n    dropped = []\n    for chunk in chunks:\n        content = chunk.page_content.strip()\n        # 빈 청크 또는 개정 태그만으로 구성된 청크는 제외함\n        if not content or TAG_ONLY_PATTERN.match(content):\n            dropped.append(content)\n            continue\n        kept.append(chunk)\n    # 어떤 청크가 제거됐는지 로그로 남겨 실제 짧은 조문이 잘못 누락되지 않았는지 확인 가능하게 함\n    if dropped:\n        print(f\"  - 노이즈 청크 제거: {len(dropped)}개 → {dropped}\")\n    return kept"
    },
    {
      "id": "attach_metadata",
      "name": "attach_metadata()",
      "fileId": "main",
      "summary": "남은 청크마다 출처·순번·전체 개수·문자 수 4개의 메타데이터만 깔끔히 부여하는 함수.",
      "how": "각 청크에 나중에 답변 출처를 표시할 정보를 붙임. ① PyPDFLoader가 넣은 source 는 전체 경로라 파일명만 추출함. ② 기존 metadata(page 등)는 버리고 스펙이 정한 4개 키만 남김: source(파일명)·chunk_index(전체 청크 중 순번)·total_chunks(전체 개수)·char_count(문자 수). ChromaDB 메타데이터는 문자열·정수 같은 원시형만 허용하므로 4개 모두 그 조건을 충족함.",
      "terms": [
        "metadata",
        "청크/청킹",
        "ChromaDB"
      ],
      "lines": [
        {
          "at": "def attach_metadata",
          "text": "청크에 메타데이터를 부여하는 함수 정의."
        },
        {
          "at": "total = len(chunks)",
          "text": "전체 청크 개수를 미리 세어 둠(total_chunks 용)."
        },
        {
          "at": "for index, chunk in enumerate(chunks):",
          "text": "청크를 0번부터 번호를 매기며 하나씩 처리."
        },
        {
          "at": "source_name = Path(chunk.metadata.get(\"source\", \"\")).name",
          "text": "전체 경로에서 파일명만 깔끔히 추출."
        },
        {
          "at": "chunk.metadata = {",
          "text": "기존 부가정보를 버리고 4개 키만 새로 채움."
        },
        {
          "at": "\"chunk_index\": index,",
          "text": "이 청크가 전체에서 몇 번째인지 순번을 기록."
        },
        {
          "at": "\"total_chunks\": total,",
          "text": "전체 청크가 몇 개인지 함께 기록."
        },
        {
          "at": "\"char_count\": len(chunk.page_content),",
          "text": "이 청크의 글자 수를 기록."
        },
        {
          "at": "return chunks",
          "text": "메타데이터를 부여한 청크 목록을 돌려줌."
        }
      ],
      "code": "def attach_metadata(chunks: list) -> list:\n    \"\"\"각 청크에 스펙에 정의된 4개 메타데이터만 부여함.\n\n    부여 항목: source(파일명), chunk_index(전체 청크 중 순번), total_chunks(전체 청크 수),\n    char_count(청크 문자 수). ChromaDB 메타데이터는 원시형(str/int)만 허용되므로 모두 충족함.\n    \"\"\"\n    total = len(chunks)\n    for index, chunk in enumerate(chunks):\n        # PyPDFLoader가 넣은 source는 전체 경로이므로 파일명만 추출함\n        source_name = Path(chunk.metadata.get(\"source\", \"\")).name\n        # 기존 메타데이터(page 등)를 버리고 스펙의 4개 키만 남김\n        chunk.metadata = {\n            \"source\": source_name,\n            \"chunk_index\": index,\n            \"total_chunks\": total,\n            \"char_count\": len(chunk.page_content),\n        }\n    return chunks"
    },
    {
      "id": "build_vectordb",
      "name": "build_vectordb()",
      "fileId": "main",
      "summary": "청크를 임베딩하여 ChromaDB에 영속 저장하는 함수. 재실행해도 결과가 같도록 기존 DB를 지우고 새로 만듦(멱등).",
      "how": "인덱싱의 핵심인 '벡터로 바꿔 저장'을 담당함. ① 공용 DB에 같은 문서가 중복으로 쌓이면 검색 품질이 나빠지므로, 기존 영속 폴더가 있으면 통째로 삭제함(=몇 번 실행해도 같은 결과를 내는 멱등 동작). ② OpenAIEmbeddings 로 청크를 1536차원 벡터로 바꿈(OPENAI_API_KEY 자동 사용). ③ Chroma.from_documents 로 청크 목록을 임베딩해 컬렉션(patent_law)에 저장하고, 디스크 폴더에 영속화한 뒤 vectorstore 를 돌려줌.",
      "terms": [
        "임베딩",
        "OpenAIEmbeddings",
        "text-embedding-3-small",
        "벡터 DB",
        "ChromaDB",
        "Chroma.from_documents",
        "컬렉션",
        "영속화",
        "멱등",
        "유사도 검색"
      ],
      "lines": [
        {
          "at": "def build_vectordb",
          "text": "청크를 임베딩해 벡터 DB에 저장하는 함수 정의."
        },
        {
          "at": "from langchain_chroma import Chroma",
          "text": "ChromaDB를 다루는 LangChain 래퍼를 가져옴."
        },
        {
          "at": "from langchain_openai import OpenAIEmbeddings",
          "text": "텍스트를 벡터로 바꿀 임베딩 모델을 가져옴."
        },
        {
          "at": "if VECTORDB_DIR.exists():",
          "text": "기존 벡터 DB 폴더가 있는지 확인."
        },
        {
          "at": "shutil.rmtree(VECTORDB_DIR)",
          "text": "있으면 통째로 지워 중복 적재를 막음(멱등 보장)."
        },
        {
          "at": "embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)",
          "text": "인덱싱용 임베딩기를 준비(1536차원, 키 자동 참조)."
        },
        {
          "at": "vectorstore = Chroma.from_documents(",
          "text": "청크 목록을 임베딩해 컬렉션에 새로 저장(신규 생성)."
        },
        {
          "at": "collection_name=COLLECTION_NAME,",
          "text": "저장할 컬렉션 이름(patent_law)을 지정."
        },
        {
          "at": "persist_directory=str(VECTORDB_DIR),",
          "text": "디스크 폴더에 영속화해 꺼도 남게 함."
        },
        {
          "at": "return vectorstore",
          "text": "저장이 끝난 벡터 저장소 객체를 돌려줌."
        }
      ],
      "code": "def build_vectordb(chunks: list):\n    \"\"\"청크를 임베딩하여 ChromaDB에 영속 저장하고 vectorstore를 반환함.\n\n    재실행 멱등성: 공용 DB에 동일 문서가 중복 적재되면 검색 품질이 떨어지므로,\n    기존 영속 디렉터리를 삭제 후 새로 생성함.\n    Chroma.from_documents: 문서 리스트를 임베딩하여 컬렉션에 저장하는 LangChain 헬퍼.\n    \"\"\"\n    from langchain_chroma import Chroma\n    from langchain_openai import OpenAIEmbeddings\n\n    # 기존 벡터 DB가 있으면 통째로 삭제하여 중복 적재를 방지함\n    if VECTORDB_DIR.exists():\n        shutil.rmtree(VECTORDB_DIR)\n        print(f\"  - 기존 벡터 DB 삭제: {VECTORDB_DIR}\")\n\n    # OpenAIEmbeddings: 텍스트를 1536차원 벡터로 변환 (OPENAI_API_KEY 환경변수 자동 사용)\n    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)\n\n    vectorstore = Chroma.from_documents(\n        documents=chunks,\n        embedding=embeddings,\n        collection_name=COLLECTION_NAME,\n        persist_directory=str(VECTORDB_DIR),\n    )\n    return vectorstore"
    },
    {
      "id": "verify_vectordb",
      "name": "verify_vectordb()",
      "fileId": "main",
      "summary": "저장된 벡터 수·임베딩 차원을 출력하고, 테스트 쿼리로 유사도 검색이 동작하는지 확인하는 함수.",
      "how": "인덱싱 결과가 멀쩡한지 마지막으로 점검함. ① 컬렉션에 실제 저장된 벡터 개수를 세어 출력함. ② 테스트 질문 하나를 임베딩해 차원이 1536인지 확인함. ③ 그 질문으로 유사도 검색을 상위 5건 돌려, 어떤 청크가 뽑히는지 출처·번호·앞부분 미리보기와 함께 출력함. 여기까지 통과하면 공용 벡터 DB가 검색 가능한 상태로 준비된 것.",
      "terms": [
        "벡터 DB",
        "임베딩",
        "유사도 검색",
        "컬렉션",
        "metadata"
      ],
      "lines": [
        {
          "at": "def verify_vectordb",
          "text": "인덱싱 결과를 점검하는 함수 정의."
        },
        {
          "at": "count = vectorstore._collection.count()",
          "text": "컬렉션에 실제 저장된 벡터 개수를 읽음."
        },
        {
          "at": "test_query =",
          "text": "검색이 되는지 확인할 테스트 질문을 정함."
        },
        {
          "at": "query_vector = vectorstore._embedding_function.embed_query(test_query)",
          "text": "테스트 질문을 벡터로 바꿔 차원을 확인할 준비."
        },
        {
          "at": "임베딩 차원:",
          "text": "임베딩 결과의 차원(1536)을 출력해 확인."
        },
        {
          "at": "results = vectorstore.similarity_search(test_query, k=5)",
          "text": "테스트 질문으로 유사한 청크 상위 5건을 검색."
        },
        {
          "at": "for rank, doc in enumerate(results, start=1):",
          "text": "검색된 청크를 1번부터 순위를 매기며 처리."
        },
        {
          "at": "snippet = doc.page_content[:60]",
          "text": "각 청크 본문 앞 60자만 미리보기로 잘라 한 줄로 표시."
        }
      ],
      "code": "def verify_vectordb(vectorstore) -> None:\n    \"\"\"저장된 벡터 수·임베딩 차원을 출력하고 테스트 쿼리로 검색 동작을 확인함.\"\"\"\n    # ._collection.count(): 컬렉션에 실제 저장된 벡터 개수를 반환함\n    count = vectorstore._collection.count()\n    print(f\"  - 저장된 벡터 수: {count}\")\n\n    # 임베딩 함수로 쿼리 한 건을 벡터화하여 차원이 1536인지 확인함\n    test_query = \"특허를 받을 수 있는 조건은?\"\n    query_vector = vectorstore._embedding_function.embed_query(test_query)\n    print(f\"  - 임베딩 차원: {len(query_vector)}\")\n\n    # 영속 DB에 대해 유사도 검색이 동작하는지 상위 5건으로 확인함 (Naive RAG 통상 검색 수)\n    results = vectorstore.similarity_search(test_query, k=5)\n    print(f\"  - 테스트 쿼리: '{test_query}' → {len(results)}건 검색\")\n    for rank, doc in enumerate(results, start=1):\n        snippet = doc.page_content[:60].replace(\"\\n\", \" \")\n        print(f\"    [{rank}] {doc.metadata['source']} #{doc.metadata['chunk_index']}: {snippet}...\")"
    },
    {
      "id": "main",
      "name": "main()",
      "fileId": "main",
      "summary": "PDF 로드 → 전처리 → 청킹 → 필터/메타데이터 → 임베딩·저장 → 검증 순으로 인덱싱 전체를 실행하는 진입점.",
      "how": "전체 파이프라인을 단계별로 지휘함. [1/5] load_pdfs 로 PDF를 읽고, [2/5] preprocess_documents 로 노이즈를 지우고, [3/5] split_documents 로 청킹한 뒤 filter_chunks·attach_metadata 로 노이즈 청크를 버리고 라벨을 붙임. [4/5] build_vectordb 로 임베딩·저장하고, [5/5] verify_vectordb 로 검증함. 맨 아래 if __name__ == \"__main__\" 은 이 파일을 직접 실행할 때만 main()을 부르는 관용구이고, try/except 로 오류를 깔끔히 보여 주고 비정상 종료 코드로 빠져나감.",
      "terms": [
        "인덱싱",
        "청크/청킹",
        "임베딩",
        "ChromaDB",
        "if __name__ == \"__main__\""
      ],
      "lines": [
        {
          "at": "def main",
          "text": "인덱싱 전체를 실행하는 진입점 함수 정의."
        },
        {
          "at": "documents = load_pdfs(DATA_DIR)",
          "text": "[1/5] data 폴더의 PDF를 페이지 단위로 읽음."
        },
        {
          "at": "documents = preprocess_documents(documents)",
          "text": "[2/5] 머리글·쪽번호 노이즈를 제거."
        },
        {
          "at": "chunks = split_documents(documents)",
          "text": "[3/5] 법령 구조를 살려 청크로 쪼갬."
        },
        {
          "at": "chunks = filter_chunks(chunks)",
          "text": "쓸모없는 노이즈 청크를 걸러냄."
        },
        {
          "at": "chunks = attach_metadata(chunks)",
          "text": "남은 청크마다 출처·번호 메타데이터를 붙임."
        },
        {
          "at": "vectorstore = build_vectordb(chunks)",
          "text": "[4/5] 청크를 임베딩해 ChromaDB에 저장."
        },
        {
          "at": "verify_vectordb(vectorstore)",
          "text": "[5/5] 저장 결과와 검색 동작을 점검."
        },
        {
          "at": "if __name__",
          "text": "이 파일을 직접 실행할 때만 아래 main()을 수행하는 관용구."
        },
        {
          "at": "except Exception as error:",
          "text": "실행 중 오류를 잡아 메시지를 출력하고 비정상 종료."
        }
      ],
      "code": "def main() -> None:\n    \"\"\"PDF 로드 → 전처리 → 청킹 → 임베딩 → 저장 → 검증 순으로 인덱싱을 수행함.\"\"\"\n    print(\"[1/5] PDF 로드\")\n    documents = load_pdfs(DATA_DIR)\n\n    print(\"[2/5] 전처리 (노이즈 제거)\")\n    documents = preprocess_documents(documents)\n    print(f\"  - 전처리 후 페이지 수: {len(documents)}\")\n\n    print(\"[3/5] 청킹\")\n    chunks = split_documents(documents)\n    # 머리글·개정 태그만 담긴 노이즈 청크를 제거한 뒤 메타데이터를 부여함 (인덱스 연속성 유지)\n    chunks = filter_chunks(chunks)\n    chunks = attach_metadata(chunks)\n    print(f\"  - 생성된 청크 수: {len(chunks)}\")\n\n    print(\"[4/5] 임베딩 + ChromaDB 저장\")\n    vectorstore = build_vectordb(chunks)\n    print(f\"  - 저장 위치: {VECTORDB_DIR}\")\n\n    print(\"[5/5] 검증\")\n    verify_vectordb(vectorstore)\n\n    print(\"\\n인덱싱 완료. 공용 벡터 DB가 준비됨.\")\n\n\n# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)\nif __name__ == \"__main__\":\n    try:\n        main()\n    except Exception as error:\n        # 실행 중 오류를 명확히 출력하고 비정상 종료 코드로 빠져나감\n        print(f\"\\n[오류] 인덱싱 실패: {error}\", file=sys.stderr)\n        sys.exit(1)"
    }
  ],
  "glossary": {
    "인덱싱": "Indexing. 검색에 쓸 문서를 미리 '읽고 → 쪼개고 → 벡터로 바꿔 → 저장'해 두는 준비 작업. 이 작업을 한 번 해 두면 이후 RAG 예제들이 그 결과(공용 벡터 DB)를 검색만 해서 쓸 수 있음.",
    "청크/청킹": "chunk/chunking. 긴 문서를 검색하기 좋게 잘게 나눈 한 조각(청크)과, 그렇게 나누는 작업(청킹). 너무 크면 검색 정확도가 떨어지고 너무 작으면 맥락이 끊겨 적당한 크기로 나눔.",
    "chunk_size": "청크 한 조각의 최대 글자 수. 이 예제는 800자로 정함. 클수록 맥락은 풍부하지만 검색 정밀도가 떨어질 수 있음.",
    "chunk_overlap": "이웃한 청크끼리 겹치게 두는 글자 수. 이 예제는 200자. 경계에서 문장이 잘려 맥락이 끊기는 것을 막아 줌.",
    "RecursiveCharacterTextSplitter": "LangChain의 텍스트 분할기. separators 목록을 앞에서부터 순서대로 적용하며, 청크가 chunk_size 이하가 될 때까지 재귀적으로 잘게 쪼갬.",
    "separators(법령 구분자)": "문서를 자를 때 우선시할 경계 문자 목록. 이 예제는 '\\n제'(조문)·'\\n①'(항)을 앞에 둬, 글자 수보다 법령 구조를 먼저 지켜 조·항이 잘리지 않게 함.",
    "임베딩": "텍스트를 의미가 담긴 숫자 벡터(여러 숫자의 나열)로 바꾼 것. 뜻이 비슷한 글은 벡터도 가깝게 위치해, 컴퓨터가 '비슷한 내용'을 계산으로 찾을 수 있음.",
    "text-embedding-3-small": "OpenAI의 임베딩 모델 이름(출력 1536차원). 인덱싱 때 쓴 모델과 검색 때 쓰는 모델이 같아야 의미 공간이 맞아 검색이 됨.",
    "벡터 DB": "임베딩(숫자 벡터)을 저장하고, 질문 벡터와 가장 가까운 것들을 빠르게 찾아 주는 데이터베이스. 여기서는 ChromaDB를 사용함.",
    "ChromaDB": "오픈소스 벡터 데이터베이스. 임베딩을 저장하고 유사도 검색을 해 줌. 로컬 폴더에 영속화(저장)되어 재실행 시 그대로 재사용 가능.",
    "Chroma.from_documents": "청크(Document) 목록을 한 번에 임베딩하여 ChromaDB 컬렉션에 '새로 저장'해 주는 LangChain 헬퍼. 기존 연결이 아니라 신규 생성에 씀.",
    "컬렉션": "벡터 DB 안에서 벡터들을 묶어 두는 단위(여기서는 patent_law). 인덱싱과 검색이 같은 컬렉션 이름을 써야 검색이 됨.",
    "영속화": "persist. 메모리에만 두지 않고 디스크 폴더에 저장해, 프로그램을 껐다 켜도 데이터가 남아 재사용되게 하는 것.",
    "멱등": "idempotent. 같은 작업을 몇 번 실행해도 결과가 똑같이 유지되는 성질. 이 예제는 기존 벡터 DB를 지우고 새로 만들어, 다시 실행해도 중복 없이 같은 DB가 됨.",
    "정규식": "regular expression. 글자 패턴을 규칙으로 표현해 찾거나 바꾸는 방법. 여기서는 페이지 번호·머리글·개정 태그 같은 반복 노이즈를 가려내는 데 씀.",
    "PyPDFLoader": "PDF를 페이지 단위 Document로 읽어 주는 LangChain 로더. 각 페이지에 원본 경로(source)·페이지 번호(page)를 metadata로 자동으로 붙여 줌.",
    "metadata": "청크에 딸린 부가정보(예: 출처 파일명 source, 청크 번호 chunk_index). 답변의 출처를 표시하는 데 사용함.",
    "유사도 검색": "similarity search. 질문 벡터와 문서 벡터의 '가까운 정도'를 계산해 가장 가까운 것부터 찾는 검색 방식.",
    "OpenAIEmbeddings": "OpenAI 임베딩 모델 호출 래퍼. 텍스트를 숫자 벡터로 변환함. 여기서는 청크를 벡터로 바꾸는 데 사용(OPENAI_API_KEY 자동 참조).",
    "load_dotenv": ".env 파일에 적어 둔 비밀값(예: OPENAI_API_KEY)을 프로그램의 환경변수로 불러오는 함수.",
    "Path(__file__).resolve().parent": "지금 이 파이썬 파일이 있는 폴더의 절대경로를 구하는 관용구. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "from __future__ import annotations": "타입 힌트를 즉시 평가하지 않고 문자열로 두게 하는 파이썬 선언. 순환 참조 없이 가볍게 타입 힌트를 쓰게 해 줌.",
    "if __name__ == \"__main__\"": "이 파일을 직접 실행할 때만 특정 코드를 돌리고, 다른 곳에서 import할 때는 돌리지 않게 하는 파이썬 관용구."
  }
};
