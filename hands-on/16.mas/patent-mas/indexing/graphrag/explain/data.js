window.EXPLAIN_DATA = {
  meta: {
    title: "특허법 GraphRAG 지식그래프 인덱싱 — PDF를 입력 텍스트로 만들고 GraphRAG 엔진을 호출하는 오케스트레이터",
    entry: "index_documents.py",
  },

  // 좌측 그룹 = 파일 (메인 오케스트레이터 → PDF 변환기 → 검증 도구 → 설정 → 공통 유틸)
  files: [
    { id: "main",     label: "index_documents.py", role: "인덱싱 오케스트레이터 — PDF를 입력 텍스트로 변환→graphrag CLI 호출(KG+벡터)→산출물 검증" },
    { id: "loader",   label: "pdf_loader.py",      role: "PDF→GraphRAG 입력 텍스트 변환기 — 로드·노이즈 제거·법령 구조 청킹 후 data/input/*.txt로 내보냄" },
    { id: "validate", label: "validate_index.py",  role: "인덱싱 결과 검증/보정 도구 — parquet·LanceDB 산출물을 심각도별로 점검하고 일부는 자동 보정" },
    { id: "settings", label: "config/settings.py", role: "전역 설정 — 경로·모델명·차원을 settings.yaml과 .env에서 읽어 한곳에서 관리" },
    { id: "utils",    label: "utils/",             role: "공통 유틸 — 디렉터리 생성(ensure_dir)·로거 생성(get_logger)" },
  ],

  // 전체 처리 흐름 (입력 준비 → GraphRAG 엔진 호출 → 산출물 검증 → 사후 검증)
  flow: [
    {
      step: 1,
      title: "환경 준비 & 설정 로드",
      label: "환경·설정 로드",
      refs: ["settings_class"],
      summary: "콘솔 UTF-8 재설정 → sys.path 보정 → config.settings 로드(.env·settings.yaml)",
      detail: "실행을 시작하면 먼저 Windows 콘솔 출력을 UTF-8로 바꿔 한글이 깨지지 않게 하고, 모듈 검색 경로를 보정해 어디서 실행하든 하위 모듈(config·utils·pdf_loader)을 찾게 합니다. 그다음 settings.py가 settings.yaml(모델명 등)과 .env(API 키)를 읽어 둡니다. 비유하면 '요리 시작 전 레시피와 재료를 식탁에 올려두는' 준비 단계입니다.",
    },
    {
      step: 2,
      title: "입력 준비 — PDF를 GraphRAG 입력 텍스트로 변환",
      label: "입력 준비",
      refs: ["prepare_input", "load_pdf_text", "split_into_chunks", "clean_text"],
      summary: "prepare_input(): 특허법 PDF → 노이즈 제거 → 법령 구조 청킹 → data/input/특허법_NNNN.txt 저장",
      detail: "pdf_loader가 특허법 PDF를 펼쳐 노이즈(머리글·페이지번호)를 지우고, 조문·항 경계를 우선해 1800자 청크로 자른 뒤, 각 청크를 한 개의 .txt 파일로 data/input/ 폴더에 저장합니다. GraphRAG 엔진은 이 폴더의 txt 파일들을 입력으로 읽으므로, 이 단계는 '엔진이 먹을 수 있는 형태로 재료를 손질하는' 작업입니다.",
    },
    {
      step: 3,
      title: "GraphRAG 엔진 호출 — 지식그래프 + 벡터 인덱싱 (핵심)",
      label: "GraphRAG 엔진 호출",
      refs: ["run_graphrag_index", "progress_tracker"],
      summary: "run_graphrag_index(): 'graphrag index' CLI를 subprocess로 실행, settings.yaml 기반으로 KG·임베딩 생성",
      detail: "이 예제의 핵심입니다. 무거운 작업(엔티티·관계 추출 → Leiden 커뮤니티 묶기 → 커뮤니티 리포트 작성 → 임베딩)은 이 파이썬 코드가 직접 하지 않고, 외부 GraphRAG 엔진(graphrag 명령)에게 맡깁니다. 파이썬은 'graphrag index --root ...' 명령을 별도 프로세스(subprocess)로 띄워 실행하고, 엔진이 쏟아내는 진행 로그를 읽어 진행바로 보여 주는 '지휘자' 역할만 합니다. 엔진의 동작 규칙(어떤 모델로 무엇을 추출할지)은 settings.yaml에 적혀 있습니다.",
    },
    {
      step: 4,
      title: "산출물 검증",
      label: "산출물 검증",
      refs: ["verify_index"],
      summary: "verify_index(): store/parquet의 필수 파일 존재·행 수 + LanceDB 벡터 인덱스 확인",
      detail: "엔진이 만들어 낸 결과물(entities·relationships·communities 등 parquet 표 파일과 LanceDB 벡터 인덱스)이 실제로 생겼는지, 행이 비어 있지 않은지 빠르게 확인합니다. 비유하면 '주문한 부품 상자들이 빠짐없이 도착했는지 체크리스트로 점검하는' 단계입니다.",
    },
    {
      step: 5,
      title: "사후 검증 — validate_index.py",
      label: "사후 검증",
      refs: ["check_vector_tables", "check_dataclasses"],
      summary: "별도 도구로 parquet·LanceDB를 심각도(CRITICAL/WARNING/INFO)별 정밀 점검, --fix로 일부 자동 보정",
      detail: "인덱싱이 끝난 뒤 별도 도구(validate_index.py)로 더 깊이 점검합니다. 단순 존재 여부를 넘어, 검색이 실제로 조회하는 LanceDB 벡터 테이블이 충분히 적재됐는지·임베딩 차원이 맞는지 등을 심각도별로 분류해 리포트를 남기고, 일부 누락(엔티티 임베딩 등)은 --fix 옵션으로 자동 보완합니다.",
    },
  ],

  functions: [
    // ───────────────────────── pdf_loader.py ─────────────────────────
    {
      id: "loader_consts",
      name: "청킹 상수 · 노이즈 패턴",
      fileId: "loader",
      summary: "청크 크기·법령 구분자·반복 머리글·개정 태그 판별 정규식 등 PDF 변환에 쓰는 상수 모음",
      how: "PDF를 청크로 자를 때 쓰는 값들을 파일 맨 위에 모아 둡니다. KG 추출은 넓은 문맥이 필요해 RAG 검색용(800)보다 큰 1800자 청크를 씁니다. LAW_SEPARATORS는 '조문 경계 → 항 → 단락 → 줄 → 어절' 순서로 자를 위치를 정하는 우선순위 목록입니다. TAG_ONLY_PATTERN은 '[전문개정 ...]'처럼 대괄호 태그만 든 청크를 가려내는 정규식입니다.",
      terms: ["청킹(chunking)", "chunk_size", "chunk_overlap", "정규식(re)", "노이즈", "지식그래프(KG)"],
      lines: [
        { at: "CHUNK_SIZE = 1800", text: "한 청크의 최대 글자 수(1800자). KG 추출에 충분한 문맥을 담기 위해 검색용(800)보다 크게 잡습니다." },
        { at: "CHUNK_OVERLAP = 200", text: "이웃 청크끼리 200자를 겹치게 해 경계에서 맥락이 끊기지 않게 합니다." },
        { at: "LAW_SEPARATORS = [", text: "자를 위치의 우선순위 목록 — 조문 경계('제') → 항(①②…) → 단락 → 줄 → 어절." },
        { at: "RUNNING_HEADER = ", text: "모든 페이지 상단에 반복되는 법령명 머리글('특허법'). 노이즈로 제거 대상." },
        { at: "TAG_ONLY_PATTERN = re.compile(", text: "줄 전체가 대괄호 태그('[...]')로만 이뤄졌는지 판별하는 정규식(개정 이력 태그 제거용)." },
      ],
      code: `# (일부 발췌) 청킹 상수 (법령 문서 특화)

# KG 추출에 충분한 문맥을 담도록 RAG 검색용(800)보다 큰 청크를 사용함.
# settings.yaml chunking.size(2500 토큰)보다 작으므로 GraphRAG가 추가 분할하지 않음.
CHUNK_SIZE = 1800          # 청크 최대 크기 (문자 수)
CHUNK_OVERLAP = 200        # 청크 간 겹치는 문자 수 (맥락 보존)

# 법령 문서 구조를 우선 보존하기 위한 분할 구분자 (앞쪽 우선순위)
# "\\n제"(조문) → "\\n①~⑤"(항) → "\\n\\n"(단락) → "\\n"(줄) → " "(어절) → ""(문자)
LAW_SEPARATORS = ["\\n제", "\\n①", "\\n②", "\\n③", "\\n④", "\\n⑤", "\\n\\n", "\\n", " ", ""]

# 국가법령정보센터 PDF는 모든 페이지 상단에 법령명을 머리글로 반복 삽입함 (검색 노이즈)
RUNNING_HEADER = "특허법"

# 청크 본문이 개정 이력 태그·머리글만으로 이루어졌는지 판별하는 정규식
# 예: "[전문개정 2014. 6. 11.]", "[시행 ...] [법률 제21134호]" → 검색 가치가 없어 제거 대상
TAG_ONLY_PATTERN = re.compile(r"^(\\[[^\\]]*\\]\\s*)+$")`,
    },
    {
      id: "clean_text",
      name: "clean_text()",
      fileId: "loader",
      summary: "PDF에서 뽑은 텍스트의 머리글·페이지번호 같은 반복 노이즈를 정규식으로 제거",
      how: "법령 PDF는 페이지마다 '법제처', '국가법령정보센터', '특허법', '- 1 -' 같은 글자가 반복됩니다. 검색·추출에 방해만 되므로 정규식(글자 패턴 규칙)으로 찾아 지웁니다. 줄을 하나씩 살펴 노이즈 키워드가 든 줄이나 법령명만 든 줄은 버리고, 마지막에 연속 공백·빈 줄을 정돈합니다.",
      terms: ["정규식(re)", "re.sub", "PDF", "노이즈"],
      lines: [
        { at: "# 페이지 번호 패턴 제거", text: "'- 1 -', '1 / 50' 같은 페이지 번호 형식을 정규식으로 찾아 빈 문자열로 바꿔 지웁니다." },
        { at: "lines = text.split", text: "전체 텍스트를 줄 단위로 쪼개 한 줄씩 검사할 수 있게 만듭니다." },
        { at: "if any(kw in line", text: "그 줄에 '법제처'·'국가법령정보센터' 같은 노이즈 키워드가 하나라도 있으면 건너뜁니다(버림)." },
        { at: "if line.strip() == RUNNING_HEADER:", text: "줄 전체가 '특허법'(법령명)뿐인 반복 머리글 줄이면 버립니다." },
        { at: "cleaned_lines.append(line)", text: "노이즈가 아닌 줄만 따로 모읍니다." },
        { at: "# 연속 공백", text: "줄을 다시 합친 뒤 연속 공백과 과도한 빈 줄을 정규식으로 한 칸씩 정리합니다." },
        { at: "return text.strip()", text: "정리된 텍스트의 앞뒤 공백을 떼어 돌려줍니다." },
      ],
      code: `def clean_text(text: str) -> str:
    """PDF 추출 텍스트에서 머리글·바닥글·페이지 번호 등 노이즈를 제거함.

    PyPDFLoader는 페이지 단위로 텍스트를 추출하므로 법제처 머리글, "- 1 -" 형식의
    페이지 번호 등 검색에 불필요한 반복 텍스트가 섞임. 이를 정규식으로 정리함.
    """
    # 페이지 번호 패턴 제거: "- 1 -", "1 / 50" 형식
    text = re.sub(r"-\\s*\\d+\\s*-", "", text)
    text = re.sub(r"\\d+\\s*/\\s*\\d+", "", text)
    # 머리글·바닥글에 자주 등장하는 키워드가 포함된 줄과 반복 법령명 머리글 줄을 제거함
    lines = text.split("\\n")
    noise_keywords = ["법제처", "국가법령정보센터"]
    cleaned_lines = []
    for line in lines:
        # "법제처 ... 국가법령정보센터" 형식의 페이지 머리글/바닥글 줄 제거
        if any(kw in line for kw in noise_keywords):
            continue
        # 줄 전체가 법령명("특허법")뿐인 반복 머리글 줄 제거 (본문 내 인용은 다른 글자와 함께 등장하므로 안전)
        if line.strip() == RUNNING_HEADER:
            continue
        cleaned_lines.append(line)
    text = "\\n".join(cleaned_lines)
    # 연속 공백·과도한 빈 줄 정규화
    text = re.sub(r"[ \\t]+", " ", text)
    text = re.sub(r"\\n{3,}", "\\n\\n", text)
    return text.strip()`,
    },
    {
      id: "load_pdf_text",
      name: "load_pdf_text()",
      fileId: "loader",
      summary: "특허법 PDF를 페이지별로 로드·정제해 하나의 큰 텍스트로 결합",
      how: "PyPDFLoader가 PDF를 한 페이지씩 Document(본문+출처 메모)로 변환합니다. 각 페이지를 clean_text로 정제하고, 빈 페이지는 빼고, 남은 것을 빈 줄로 이어 붙여 '한 덩어리 텍스트'로 만듭니다. 글자가 전혀 없으면(스캔 이미지 PDF) 일찍 오류를 내 뒤 단계의 헛작업을 막습니다.",
      terms: ["PyPDFLoader", "Document", "PDF", "LangChain", "노이즈"],
      lines: [
        { at: "from langchain_community.document_loaders import PyPDFLoader", text: "PDF를 Document로 바꿔 주는 LangChain 로더를 (이 함수가 호출될 때) 불러옵니다." },
        { at: "if not pdf_path.exists():", text: "PDF 파일이 실제로 존재하는지 먼저 확인하고, 없으면 명확한 오류를 냅니다." },
        { at: "pages = PyPDFLoader(str(pdf_path)).load()", text: "PDF를 열어 페이지마다 하나씩 Document로 만든 목록을 받습니다." },
        { at: "cleaned_pages = [clean_text(", text: "모든 페이지 본문에 clean_text를 적용해 노이즈를 지웁니다." },
        { at: "full_text = ", text: "정제 후 내용이 남은 페이지만 빈 줄로 이어 붙여 한 덩어리 텍스트로 만듭니다." },
        { at: "if not full_text.strip():", text: "결합 결과가 텅 비면(스캔 이미지 PDF 등) 오류를 내 뒤 단계를 막습니다." },
      ],
      code: `def load_pdf_text(pdf_path: Path) -> str:
    """특허법 PDF를 로드·정제하여 단일 정제 텍스트로 결합함."""
    # PyPDFLoader: PDF를 페이지 단위 Document로 변환하는 LangChain 로더
    from langchain_community.document_loaders import PyPDFLoader

    if not pdf_path.exists():
        raise FileNotFoundError(f"특허법 PDF를 찾을 수 없음: {pdf_path}")

    pages = PyPDFLoader(str(pdf_path)).load()
    logger.info("PDF 로드 완료: %s (%d페이지)", pdf_path.name, len(pages))

    # 페이지별 정제 후 빈 페이지를 제외하고 결합함
    cleaned_pages = [clean_text(p.page_content) for p in pages]
    full_text = "\\n\\n".join(t for t in cleaned_pages if t)

    if not full_text.strip():
        raise ValueError("PDF에서 텍스트를 추출하지 못함 (스캔 이미지 PDF 가능성)")
    logger.info("정제 후 전체 문자 수: %d", len(full_text))
    return full_text`,
    },
    {
      id: "split_into_chunks",
      name: "split_into_chunks()",
      fileId: "loader",
      summary: "법령 구조를 우선 보존하며 텍스트를 1800자 청크로 분할하고 노이즈 청크 제거",
      how: "긴 본문을 검색·추출에 알맞은 조각(청크)으로 자릅니다. RecursiveCharacterTextSplitter는 LAW_SEPARATORS를 앞에서부터 적용하며 1800자 이하가 될 때까지 재귀적으로 쪼개, 조문·항 경계에서 의미가 끊기지 않게 합니다. 자른 뒤 빈 청크나 개정 태그만 든 청크는 버립니다.",
      terms: ["RecursiveCharacterTextSplitter", "청킹(chunking)", "chunk_size", "chunk_overlap", "정규식(re)", "노이즈", "LangChain"],
      lines: [
        { at: "from langchain_text_splitters import RecursiveCharacterTextSplitter", text: "재귀 분할기를 (이 함수가 호출될 때) 불러옵니다." },
        { at: "splitter = RecursiveCharacterTextSplitter(", text: "분할기를 청크 크기·겹침·구분자 설정과 함께 만듭니다." },
        { at: "raw_chunks = splitter.split_text(text)", text: "설정대로 전체 텍스트를 청크 문자열 목록으로 자릅니다." },
        { at: "if not content or TAG_ONLY_PATTERN.match(content):", text: "내용이 비었거나 개정 태그만으로 이뤄진 청크인지 판별합니다." },
        { at: "dropped += 1", text: "버릴 청크는 개수만 세어 둡니다(로그용)." },
        { at: "chunks.append(content)", text: "검색 가치가 있는 청크만 결과 목록에 담습니다." },
        { at: "return chunks", text: "노이즈를 걸러낸 청크 목록을 돌려줍니다." },
      ],
      code: `def split_into_chunks(text: str) -> list[str]:
    """법령 구조를 우선 보존하며 텍스트를 청크로 분할함.

    RecursiveCharacterTextSplitter: separators 목록을 앞에서부터 순서대로 적용하며
    chunk_size 이하가 될 때까지 재귀적으로 분할함. 법령 구조(조→항)를 우선 경계로
    삼아 의미 단위가 끊기지 않게 함.
    """
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=LAW_SEPARATORS,
    )
    raw_chunks = splitter.split_text(text)

    # 빈 청크 또는 개정 태그만으로 구성된 청크는 검색 가치가 없어 제외함
    chunks, dropped = [], 0
    for chunk in raw_chunks:
        content = chunk.strip()
        if not content or TAG_ONLY_PATTERN.match(content):
            dropped += 1
            continue
        chunks.append(content)
    if dropped:
        logger.info("노이즈 청크 제거: %d개", dropped)
    logger.info("생성된 청크 수: %d", len(chunks))
    return chunks`,
    },
    {
      id: "prepare_input",
      name: "prepare_input()",
      fileId: "loader",
      summary: "특허법 PDF를 GraphRAG 입력 폴더(data/input)의 *.txt 파일들로 내보내는 진입 함수",
      how: "이 모듈의 대표 함수입니다. 입력 폴더를 비우고(멱등성), PDF를 로드·정제·청킹한 다음, 청크마다 출처 헤더를 붙여 '특허법_0000.txt'처럼 한 파일씩 저장합니다. GraphRAG CLI는 이 폴더의 txt 파일만 입력으로 읽으므로, 이 함수가 '엔진에게 먹일 재료를 접시에 담아 두는' 역할을 합니다. limit으로 앞쪽 몇 개만 만들어 파이프라인을 빠르게 검증할 수도 있습니다.",
      terms: ["멱등성", "to_input_text", "GraphRAG", "지식그래프(KG)"],
      lines: [
        { at: "input_dir = ensure_dir(settings.input_dir)", text: "입력 폴더(data/input)가 없으면 만들고 경로를 받습니다." },
        { at: "for old_file in input_dir.glob(", text: "기존 txt를 모두 지워 깨끗한 상태에서 시작합니다(재실행해도 결과가 같도록 = 멱등성)." },
        { at: "full_text = load_pdf_text(settings.pdf_path)", text: "PDF를 로드·정제해 한 덩어리 텍스트로 만듭니다." },
        { at: "chunks = split_into_chunks(full_text)", text: "그 텍스트를 법령 구조 기준 청크 목록으로 자릅니다." },
        { at: "chunks = chunks[:limit]", text: "limit이 주어지면 앞쪽 몇 개 청크만 남겨 빠른 검증용 슬라이스를 만듭니다." },
        { at: "output_path = input_dir / f", text: "청크 번호로 파일명을 만듭니다(예: 특허법_0003.txt)." },
        { at: "f.write(to_input_text(chunk, i))", text: "출처 헤더를 붙인 청크 텍스트를 그 파일에 UTF-8로 씁니다." },
        { at: "return exported", text: "내보낸 txt 파일 수를 돌려줍니다(0이면 입력 없음으로 처리)." },
      ],
      code: `def prepare_input(limit: int | None = None) -> int:
    """특허법 PDF를 data/input/*.txt 로 변환함.

    GraphRAG CLI는 input_storage.base_dir(data/input)의 txt 파일만 입력으로 사용함.
    """
    input_dir = ensure_dir(settings.input_dir)

    # 기존 txt를 모두 삭제해 깨끗한 상태에서 시작함 (재실행 멱등성)
    for old_file in input_dir.glob("*.txt"):
        old_file.unlink()

    full_text = load_pdf_text(settings.pdf_path)
    chunks = split_into_chunks(full_text)

    if limit is not None:
        chunks = chunks[:limit]
        logger.info("슬라이스 모드: 앞쪽 %d개 청크만 변환", len(chunks))

    exported = 0
    for i, chunk in enumerate(chunks):
        output_path = input_dir / f"특허법_{i:04d}.txt"
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(to_input_text(chunk, i))
            exported += 1
        except Exception as e:
            logger.warning("내보내기 실패: %s - %s", output_path.name, e)

    logger.info("특허법 txt 내보내기 완료: %d개 → %s", exported, input_dir)
    return exported`,
    },

    // ───────────────────────── index_documents.py ─────────────────────────
    {
      id: "run_graphrag_index",
      name: "run_graphrag_index()",
      fileId: "main",
      summary: "외부 GraphRAG 엔진('graphrag index' CLI)을 별도 프로세스로 실행하는 핵심 함수",
      how: "이 예제의 심장입니다. 엔티티·관계 추출, 커뮤니티 묶기, 임베딩 같은 무거운 작업은 이 코드가 직접 하지 않고 외부 GraphRAG 엔진에게 맡깁니다. subprocess.Popen으로 'python -m graphrag index --root ...' 명령을 별도 프로세스로 띄우고, 엔진이 쏟아내는 stdout/stderr 로그를 두 개의 스레드로 실시간으로 읽어 진행바에 반영합니다. 엔진의 동작 규칙은 settings.yaml에 적혀 있고, API 키는 부모 프로세스의 환경변수로 자동 상속됩니다.",
      terms: ["subprocess", "CLI", "GraphRAG", "Popen", "스레드(thread)", "환경변수 상속", "지식그래프(KG)", "임베딩(embedding)"],
      lines: [
        { at: "ensure_dir(settings.parquet_dir)", text: "결과를 저장할 출력 폴더(store/parquet)를 미리 만들어 둡니다." },
        { at: "process = subprocess.Popen(", text: "외부 GraphRAG 엔진을 '별도 프로세스'로 띄웁니다(파이썬 안에서 실행하지 않음)." },
        { at: 'sys.executable, "-m", "graphrag", "index", "--root"', text: "현재 venv의 파이썬으로 'graphrag index --root ...' 명령을 구성합니다." },
        { at: "stdout=subprocess.PIPE, stderr=subprocess.PIPE,", text: "엔진의 출력·오류 메시지를 파이프로 받아 진행 상황을 읽을 수 있게 합니다." },
        { at: "except FileNotFoundError:", text: "graphrag가 설치돼 있지 않으면 안내 메시지를 내고 실패로 끝냅니다." },
        { at: "tracker = ProgressTracker()", text: "엔진 로그를 파싱해 진행바로 보여 주는 도우미를 만듭니다." },
        { at: "threading.Thread(target=_stream_output, args=(process.stdout", text: "stdout·stderr를 각각 별도 스레드로 동시에 읽습니다(읽기가 블로킹되므로)." },
        { at: "returncode = process.wait()", text: "엔진 프로세스가 끝날 때까지 기다리고 종료 코드를 받습니다." },
        { at: "except KeyboardInterrupt:", text: "사용자가 Ctrl+C로 중단하면 엔진 프로세스를 강제 종료합니다." },
      ],
      code: `def run_graphrag_index() -> bool:
    """graphrag CLI로 특허법 KG + Vector 인덱싱을 실행함.

    실행 명령: graphrag index --root <indexing_dir>

    Returns:
        성공 여부
    """
    ensure_dir(settings.parquet_dir)
    logger.info("GraphRAG 인덱싱 시작 (Groq LPU: %s / OpenAI 임베딩: %s)",
                settings.llm_model, settings.embedding_model)

    print("\\n" + "=" * 60)
    print("GraphRAG 인덱싱 진행 상황")
    print("=" * 60)

    try:
        # graphrag를 'python -m graphrag'로 실행해 현재 인터프리터(venv)의 graphrag를 보장함.
        # subprocess는 부모 프로세스의 os.environ을 상속하므로 config.settings가 로드한
        # GROQ_API_KEY / OPENAI_API_KEY가 전달되어 settings.yaml의 \${...}가 해석됨.
        # bufsize=1: 라인 버퍼링으로 실시간 진행 상황 파싱
        process = subprocess.Popen(
            [sys.executable, "-m", "graphrag", "index", "--root", str(settings.indexing_dir)],
            cwd=str(settings.indexing_dir),
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding="utf-8", errors="replace", bufsize=1,
        )
    except FileNotFoundError:
        logger.error("graphrag 모듈을 찾을 수 없음. 'pip install -r requirements.txt' 후 다시 실행하세요.")
        return False

    tracker = ProgressTracker()
    threads = [
        threading.Thread(target=_stream_output, args=(process.stdout, tracker, False)),
        threading.Thread(target=_stream_output, args=(process.stderr, tracker, True)),
    ]
    for t in threads:
        t.start()
    try:
        returncode = process.wait()
    except KeyboardInterrupt:
        process.kill()
        logger.error("사용자 취소로 인덱싱 중단")
        return False
    for t in threads:
        t.join()
    tracker.close()

    print("\\n" + "=" * 60)
    if returncode != 0:
        logger.warning("GraphRAG 인덱싱 경고 (returncode=%s)", returncode)
    return True`,
    },
    {
      id: "progress_tracker",
      name: "ProgressTracker.process_line()",
      fileId: "main",
      summary: "GraphRAG 엔진의 출력 한 줄을 해석해 tqdm 진행바를 갱신하는 메서드 (발췌)",
      how: "GraphRAG 엔진은 'Starting workflow: xxx', '3 / 10', 'Workflow complete: xxx' 같은 줄을 출력합니다. 이 메서드는 미리 만든 정규식으로 그런 줄을 알아보고, 워크플로우 진행바와 아이템 진행바(2단계)를 갱신합니다. 엔진 안을 들여다볼 수 없으니 '엔진이 외친 말을 듣고 진척도를 가늠하는' 방식입니다.",
      terms: ["tqdm", "정규식(re)", "workflow(워크플로우)", "GraphRAG"],
      lines: [
        { at: "line = line.rstrip()", text: "줄 끝의 줄바꿈·공백을 떼어 깨끗한 한 줄로 만듭니다." },
        { at: "if (m := self.start_re.search(line)):", text: "'Starting workflow: xxx' 줄이면 현재 워크플로우 이름을 갱신합니다." },
        { at: "if self.complete_re.search(line):", text: "'Workflow complete: xxx' 줄이면 완료 개수를 1 올리고 진행바를 전진시킵니다." },
        { at: "if (m := self.progress_re.match(line)):", text: "'3 / 10' 같은 아이템 진행 줄이면 현재/전체 개수를 읽어 아이템 진행바를 갱신합니다." },
        { at: "self.workflow_pbar.update(1)", text: "워크플로우 하나가 끝날 때마다 상단 진행바를 한 칸 전진시킵니다." },
      ],
      code: `# (일부 발췌) ProgressTracker 클래스의 핵심 메서드
def process_line(self, line: str):
    """CLI 출력 한 줄을 파싱하여 진행바를 갱신함."""
    line = line.rstrip()
    if not line:
        return
    # 워크플로우 시작
    if (m := self.start_re.search(line)):
        self._close_item()
        self.current_workflow = m.group(1)
        self.workflow_pbar.set_postfix_str(self.current_workflow[:25])
        return
    # 워크플로우 완료
    if self.complete_re.search(line):
        self._close_item()
        self.completed += 1
        if self.completed <= len(self.WORKFLOWS):
            self.workflow_pbar.update(1)
        return
    # 아이템 진행 (N / M)
    if (m := self.progress_re.match(line)):
        current, total = int(m.group(1)), int(m.group(2))
        if self.item_pbar is None or self.item_pbar.total != total:
            self._close_item()
            desc = self.current_workflow or "처리중"
            self.item_pbar = tqdm(
                total=total, desc=f"  {desc[:18]}", unit="item", ncols=80,
                position=1, leave=False,
                bar_format="{desc}: {percentage:3.0f}%|{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]",
            )
        if current > self.item_pbar.n:
            self.item_pbar.update(current - self.item_pbar.n)
        return`,
    },
    {
      id: "verify_index",
      name: "verify_index()",
      fileId: "main",
      summary: "엔진이 만든 store/parquet 필수 파일들과 LanceDB 벡터 인덱스의 존재·행 수를 빠르게 확인",
      how: "GraphRAG가 만들어 낸 결과물이 제대로 생겼는지 점검합니다. entities·relationships·communities·text_units·documents 다섯 개 parquet 표 파일이 있는지, 각 표에 행이 몇 개인지 출력하고, LanceDB 벡터 인덱스(.lance 파일)가 있는지 확인합니다. 하나라도 빠지면 False를 돌려줘 '부품 누락'을 알립니다.",
      terms: ["parquet", "pandas(pd)", "LanceDB", "지식그래프(KG)", "엔티티(entity)", "관계(relationship)", "커뮤니티(community)"],
      lines: [
        { at: "required = [", text: "반드시 있어야 하는 5개 parquet 파일 목록(없으면 검색 불가)을 정합니다." },
        { at: "for filename in required:", text: "필수 파일을 하나씩 돌며 존재 여부와 행 수를 점검합니다." },
        { at: "print(f\"  [OK] {filename}: {len(pd.read_parquet(filepath))} rows\")", text: "파일이 있으면 표를 읽어 행 수를 [OK]와 함께 출력합니다." },
        { at: "missing.append(filename)", text: "없는 파일은 누락 목록에 모아 둡니다." },
        { at: "lance_files = list(", text: "LanceDB 폴더에서 벡터 인덱스 파일(.lance)을 모두 찾습니다." },
        { at: "if missing:", text: "필수 파일이 하나라도 빠지면 오류 로그를 남기고 False를 돌려줍니다." },
        { at: "return True", text: "모든 필수 파일이 있으면 검증 통과(True)를 돌려줍니다." },
      ],
      code: `def verify_index() -> bool:
    """store/parquet 산출물의 존재와 행 수를 검증함.

    Returns:
        필수 파일이 모두 존재하면 True
    """
    parquet_dir = settings.parquet_dir
    print("\\n=== 인덱싱 결과 검증 ===")

    required = ["entities.parquet", "relationships.parquet", "communities.parquet",
                "text_units.parquet", "documents.parquet"]
    missing = []
    for filename in required:
        filepath = parquet_dir / filename
        if filepath.exists():
            print(f"  [OK] {filename}: {len(pd.read_parquet(filepath))} rows")
        else:
            print(f"  [FAIL] {filename}: 없음")
            missing.append(filename)

    # GraphRAG LanceDB 벡터 인덱스 확인
    lance_files = list(settings.graphrag_vector_dir.rglob("*.lance")) if settings.graphrag_vector_dir.exists() else []
    print(f"  [{'OK' if lance_files else 'WARN'}] GraphRAG LanceDB: {len(lance_files)}개 인덱스")

    if missing:
        logger.error("필수 파일 누락: %s", missing)
        return False
    return True`,
    },
    {
      id: "main_func",
      name: "main()",
      fileId: "main",
      summary: "입력 준비 → GraphRAG 호출 → 검증 → (선택) 사후 보완을 순서대로 실행하는 진입점",
      how: "전체 인덱싱 파이프라인을 1~4단계로 차례로 호출하는 '지휘자' 함수입니다. --force면 기존 인덱스를 먼저 지우고, --limit이면 일부 청크로만 빠르게 검증합니다. 각 단계가 실패하면 종료 코드를 돌려줘 멈추고, 끝에는 finalize_indexing 모듈이 있으면 임베딩 누락을 보완합니다(없으면 조용히 건너뜀).",
      terms: ["argparse", "파이프라인", "진입점(main)", "GraphRAG", "임베딩(embedding)"],
      lines: [
        { at: "parser = argparse.ArgumentParser(", text: "명령줄 옵션(--force, --limit)을 받을 파서를 만듭니다." },
        { at: "if args.force:", text: "--force면 기존 인덱스(입력 txt·parquet·벡터)를 먼저 모두 지웁니다." },
        { at: "if prepare_input(limit=args.limit) == 0:", text: "[1단계] PDF를 입력 txt로 변환합니다. 결과가 0개면 실패로 끝냅니다." },
        { at: "if not run_graphrag_index():", text: "[2단계] 외부 GraphRAG 엔진을 호출해 지식그래프·벡터를 만듭니다." },
        { at: "if not verify_index():", text: "[3단계] 산출물이 제대로 생겼는지 검증합니다." },
        { at: "from finalize_indexing import finalize_indexing", text: "[4단계] 임베딩 보완 모듈이 있으면 불러옵니다(없으면 except로 건너뜀)." },
        { at: "except ImportError:", text: "보완 모듈이 없으면 네이티브 임베딩만으로 충분하다고 보고 조용히 넘어갑니다." },
        { at: "return 0", text: "모든 단계가 끝나면 성공 종료 코드(0)를 돌려줍니다." },
      ],
      code: `def main() -> int:
    """전체 인덱싱 파이프라인 실행 진입점.

    Returns:
        종료 코드 (0=성공, 1=실패)
    """
    parser = argparse.ArgumentParser(description="특허법 GraphRAG 인덱싱")
    parser.add_argument("--force", action="store_true", help="기존 인덱스 삭제 후 재인덱싱")
    parser.add_argument("--limit", type=int, default=None,
                        help="인덱싱할 청크 수 상한 (슬라이스 검증용, 미지정 시 전체)")
    args = parser.parse_args()

    print("=" * 60)
    print(f"특허법 GraphRAG 인덱싱 (Groq {settings.llm_model} + OpenAI {settings.embedding_model})")
    print(f"모드: {'슬라이스 ' + str(args.limit) if args.limit else 'full'}{' / FORCE' if args.force else ''}")
    print("=" * 60)

    if args.force:
        _clear_indexes()

    # ── 1단계: 입력 준비 (특허법 PDF → data/input/*.txt) ──
    if prepare_input(limit=args.limit) == 0:
        logger.error("준비된 입력 문서가 없음")
        return 1

    # ── 2단계: GraphRAG 인덱싱 (KG + Vector) ──
    if not run_graphrag_index():
        logger.error("GraphRAG 인덱싱 실패")
        return 1

    # ── 3단계: 결과 검증 ──
    if not verify_index():
        logger.warning("일부 산출물 누락 - 후처리를 시도함")

    # ── 4단계: 후처리 (선택) — finalize_indexing 모듈이 있을 때만 임베딩 누락 보완 ──
    # GraphRAG 3.x는 3종 임베딩 테이블을 네이티브로 생성하므로 통상 불필요하나,
    # 임베딩 누락 시 OpenAI로 보완하기 위해 모듈이 있으면 호출함.
    try:
        from finalize_indexing import finalize_indexing
        finalize_indexing()
    except ImportError:
        pass  # finalize 모듈이 없으면 네이티브 임베딩만으로 충분한 것으로 간주함
    except Exception as e:
        logger.error("후처리 실패: %s", e)

    print("\\n" + "=" * 60)
    print("인덱싱 완료!")
    print(f"  KG + Vector : {settings.parquet_dir} / {settings.graphrag_vector_dir}")
    print("  검증: python validate_index.py")
    print("=" * 60)
    return 0`,
    },

    // ───────────────────────── validate_index.py ─────────────────────────
    {
      id: "check_dataclasses",
      name: "CheckResult · ValidationReport",
      fileId: "validate",
      summary: "검증 결과 한 건과 전체 리포트를 담는 데이터 클래스(구조 묶음) (발췌)",
      how: "검증 결과를 깔끔하게 다루기 위한 '데이터 그릇'입니다. CheckResult는 검사 한 건(이름·심각도·통과 여부·메시지·보정가능 여부)을 담고, ValidationReport는 그런 결과들의 목록과 통계를 담습니다. @property로 표시한 critical_count 등은 '계산해서 보여 주는 가짜 속성'이라, 미통과 CRITICAL 개수를 그때그때 세어 돌려줍니다.",
      terms: ["dataclass", "@property", "심각도(severity)", "CRITICAL/WARNING/INFO"],
      lines: [
        { at: "# (일부 발췌) 검증 결과를 담는 데이터 클래스", text: "필드만 적으면 생성자·표현을 자동으로 만들어 주는 '데이터 그릇' 표시(@dataclass 데코레이터)를 씁니다." },
        { at: "class CheckResult:", text: "검증 한 건의 결과(이름·심각도·통과여부·메시지·보정가능)를 담는 구조." },
        { at: "fixable: bool = False", text: "이 항목이 --fix로 자동 보정 가능한지 표시(기본은 불가)." },
        { at: "class ValidationReport:", text: "여러 검증 결과와 통계를 한데 모은 전체 리포트 구조." },
        { at: "def critical_count(self) -> int:", text: "미통과한 CRITICAL 항목 수를 그때그때 세어 돌려주는 계산 속성." },
        { at: "if c.severity == \"CRITICAL\" and not c.passed)", text: "심각도가 CRITICAL이면서 통과하지 못한 항목만 골라 셉니다." },
      ],
      code: `# (일부 발췌) 검증 결과를 담는 데이터 클래스
@dataclass
class CheckResult:
    """개별 검증 결과."""
    name: str          # 검증 항목 ID (예: C1, W1, I1)
    severity: str      # 심각도 ("CRITICAL"/"WARNING"/"INFO")
    passed: bool       # 통과 여부
    message: str       # 결과 메시지
    fixable: bool = False  # 자동 보정 가능 여부


@dataclass
class ValidationReport:
    """전체 검증 리포트."""
    checks: list[CheckResult] = field(default_factory=list)
    stats: dict = field(default_factory=dict)

    @property
    def critical_count(self) -> int:
        """실패한 CRITICAL 항목 수 (재인덱싱 권고 대상)."""
        return sum(1 for c in self.checks if c.severity == "CRITICAL" and not c.passed)`,
    },
    {
      id: "check_vector_tables",
      name: "IndexValidator._check_vector_tables()",
      fileId: "validate",
      summary: "검색이 실제로 조회하는 LanceDB 벡터 테이블의 존재·적재율을 검증하는 핵심 검사 (발췌)",
      how: "이 도구에서 가장 중요한 검사입니다. GraphRAG 검색은 LanceDB의 특정 테이블(entity_description 등)을 조회하는데, settings.yaml 설정이 잘못되면 서로 다른 테이블이 같은 이름(index_name)을 공유해 인덱싱 중 한쪽을 덮어써 누락됩니다. 이 검사는 각 테이블이 실제로 있는지, 그리고 원본 parquet 대비 90% 이상 적재됐는지(적재율)를 확인해 그런 충돌·미완성을 잡아냅니다.",
      terms: ["LanceDB", "index_name", "적재율(coverage)", "엔티티(entity)", "parquet", "CRITICAL/WARNING/INFO"],
      lines: [
        { at: "specs = [", text: "검사할 테이블 3종(검증ID·심각도·테이블명·원본 parquet·용도)을 목록으로 정의합니다." },
        { at: "db = lancedb.connect(str(self.lancedb_dir))", text: "LanceDB에 연결해 실제 존재하는 테이블 이름들을 읽습니다." },
        { at: "for name, severity, table, source_file, use in specs:", text: "정의한 테이블 3종을 하나씩 검증합니다." },
        { at: "if table not in existing:", text: "테이블이 아예 없으면(index_name 충돌로 덮어써짐) 실패로 기록합니다." },
        { at: "rows = db.open_table(table).count_rows()", text: "테이블이 있으면 실제 적재된 행 수를 셉니다." },
        { at: "coverage = (rows / source_rows", text: "원본 parquet 대비 몇 %가 적재됐는지(적재율) 계산합니다." },
        { at: "passed = source_rows == 0 or coverage >= 90.0", text: "적재율 90% 이상이면 정상으로 판정합니다(임베딩 일부 실패 허용)." },
      ],
      code: `# (일부 발췌) IndexValidator 클래스의 핵심 검사 메서드
def _check_vector_tables(self) -> list:
    """검색이 실제 조회하는 LanceDB 벡터 테이블의 존재 + 적재율 검증.

    settings.yaml vector_store의 index_name과 일치하는 테이블이 실제로 존재하고,
    행 수가 원본 parquet 대비 충분히 적재됐는지 확인함. (entity_description와
    text_unit_text가 같은 index_name을 공유하면 인덱싱 시 서로 덮어써 누락됨.)
    """
    specs = [
        ("C4", "CRITICAL", "entity_description", "entities.parquet", "Local/DRIFT"),
        ("W8", "WARNING", "text_unit_text", "text_units.parquet", "Basic"),
        ("W9", "WARNING", "community_full_content", "community_reports.parquet", "DRIFT/Global"),
    ]
    db = lancedb.connect(str(self.lancedb_dir))
    existing = set(db.table_names())

    results = []
    for name, severity, table, source_file, use in specs:
        src = self._read_parquet_safe(source_file)
        source_rows = len(src) if src is not None else 0
        if table not in existing:
            results.append(CheckResult(
                name, severity, False,
                f"{table} 테이블 없음 (검색 {use} 불가 - index_name 분리 후 재인덱싱 필요)"))
            continue
        rows = db.open_table(table).count_rows()
        # 적재율: 원본 대비 90% 이상이면 정상 (임베딩 일부 실패 허용 여유)
        coverage = (rows / source_rows * 100) if source_rows else 0.0
        passed = source_rows == 0 or coverage >= 90.0
        results.append(CheckResult(name, severity, passed,
            f"{table} 적재 {'정상' if passed else '미완성'}: {rows:,}/{source_rows:,} ({coverage:.1f}%) [{use}]"))
    return results`,
    },

    // ───────────────────────── config/settings.py ─────────────────────────
    {
      id: "settings_class",
      name: "Settings (전역 설정)",
      fileId: "settings",
      summary: "경로·모델명·차원·API 키를 settings.yaml과 .env에서 읽어 한곳에 모은 설정 데이터 클래스 (발췌)",
      how: "코드 곳곳에서 settings.XXX로 참조하는 값을 모두 이 클래스 한곳에 모읍니다. 경로는 __file__ 기준으로 도출해 어느 컴퓨터에서도 동작하게 하고, 모델명은 settings.yaml에서, API 키·차원은 .env에서 읽습니다. field(default_factory=...)는 '인스턴스를 만들 때 그 함수를 불러 기본값을 계산'하는 방식입니다. 맨 아래 settings = Settings()로 전역 인스턴스를 한 번 만들어 다른 모듈이 가져다 씁니다.",
      terms: ["dataclass", "field(default_factory)", "settings.yaml", ".env", "load_dotenv", "이식성(portability)"],
      lines: [
        { at: "indexing_dir: Path = field(", text: "graphrag CLI의 --root가 될 폴더 경로(settings.yaml이 있는 곳)." },
        { at: "input_dir: Path = field(", text: "PDF에서 만든 입력 txt를 둘 폴더(data/input)." },
        { at: "parquet_dir: Path = field(", text: "GraphRAG가 표 파일(parquet)을 저장할 출력 폴더." },
        { at: "pdf_path: Path = field(", text: "입력 데이터인 특허법 PDF의 경로(hands-on/10.rag/data 아래)." },
        { at: "llm_model: str = field(", text: "엔티티·관계 추출에 쓸 LLM 모델명을 settings.yaml에서 읽습니다." },
        { at: "embedding_model: str = field(", text: "임베딩에 쓸 OpenAI 모델명을 settings.yaml에서 읽습니다." },
        { at: "embedding_dim: int = field(", text: "임베딩 벡터 차원(1536)을 .env에서 읽습니다(검증 기대값)." },
        { at: "settings = Settings()", text: "전역 설정 인스턴스를 한 번 만들어 다른 모듈이 import해 씁니다." },
      ],
      code: `# (일부 발췌) config/settings.py — 전역 설정

# hands-on/.env 로드 (OPENAI_API_KEY, GROQ_API_KEY 등). override=True로 .env 우선.
load_dotenv(_ENV_PATH, override=True)


@dataclass
class Settings:
    """시스템 전역 설정. yaml에 있는 값은 yaml에서, 없는 값만 직접 정의함."""

    # === 프로젝트 경로 (Python 전용) ===
    indexing_dir: Path = field(default_factory=lambda: INDEXING_DIR)         # graphrag/ (--root)
    input_dir: Path = field(default_factory=lambda: INDEXING_DIR / "data" / "input")
    parquet_dir: Path = field(default_factory=lambda: INDEXING_DIR / "store" / "parquet")

    # === 데이터소스 경로 ===
    pdf_path: Path = field(default_factory=lambda: HANDS_ON_DIR / "10.rag" / "data" / "특허법.pdf")

    # === yaml에서 읽는 설정 ===
    llm_model: str = field(default_factory=lambda: _get_yaml(
        "completion_models.default_completion_model.model", "openai/gpt-oss-120b"))
    embedding_model: str = field(default_factory=lambda: _get_yaml(
        "embedding_models.default_embedding_model.model", "text-embedding-3-small"))

    # === .env에서 읽는 설정 ===
    embedding_dim: int = field(default_factory=lambda: int(os.getenv("EMBEDDING_DIM", "1536")))


# 전역 설정 인스턴스 (모듈 임포트 시 자동 생성)
settings = Settings()`,
    },

    // ───────────────────────── utils/ ─────────────────────────
    {
      id: "utils_helpers",
      name: "ensure_dir() · get_logger()",
      fileId: "utils",
      summary: "디렉터리를 만들고(없을 때만) 일관된 포맷의 로거를 만드는 공통 유틸 두 가지",
      how: "여러 파일이 공통으로 쓰는 작은 도우미입니다. ensure_dir는 폴더를 만들되 이미 있으면 그냥 넘어가(중복 생성 방지) 경로를 돌려줍니다. get_logger는 모듈 이름으로 로거를 만들고, 같은 핸들러가 중복으로 붙지 않게 한 번만 설정해 '날짜 - 이름 - 레벨 - 메시지' 형식의 로그를 콘솔에 찍게 합니다.",
      terms: ["mkdir", "로거(logger)", "핸들러(handler)"],
      lines: [
        { at: "path.mkdir(parents=True, exist_ok=True)", text: "상위 폴더까지 만들고(parents), 이미 있으면 무시(exist_ok)해 안전하게 폴더를 보장합니다." },
        { at: "return path", text: "만들었거나 이미 있던 폴더 경로를 돌려줍니다." },
        { at: "logger = logging.getLogger(name)", text: "지정한 이름으로 로거를 가져옵니다(없으면 새로 만듦)." },
        { at: "if not logger.handlers:", text: "핸들러가 이미 있으면 중복 추가를 막아 로그가 두 번 찍히지 않게 합니다." },
        { at: "formatter = logging.Formatter(", text: "'날짜 - 이름 - 레벨 - 메시지' 형식을 정의합니다." },
        { at: "logger.addHandler(console_handler)", text: "표준 출력으로 로그를 내보내는 핸들러를 로거에 붙입니다." },
      ],
      code: `# (일부 발췌) utils/helpers.py + utils/logger.py

def ensure_dir(path: Path) -> Path:
    """디렉터리를 생성함 (없을 때만)."""
    # parents=True: 상위 디렉터리도 자동 생성, exist_ok=True: 이미 있으면 무시
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """일관된 포맷의 로거 인스턴스를 생성함."""
    # 지정된 이름으로 로거를 가져옴 (없으면 새로 생성)
    logger = logging.getLogger(name)

    # 핸들러가 이미 있으면 중복 추가를 방지함
    if not logger.handlers:
        logger.setLevel(level)
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(level)
        # 로그 메시지 형식: "2026-06-01 12:34:56 - name - INFO - 메시지"
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    return logger`,
    },
  ],

  glossary: {
    "지식그래프(KG)": "문서 속 개념(엔티티)과 그 사이의 관계를 점·선으로 이어 그린 그래프. GraphRAG가 PDF에서 이걸 자동으로 뽑아냄.",
    "GraphRAG": "문서에서 지식그래프(엔티티·관계·커뮤니티)와 벡터를 함께 만들어 더 똑똑한 검색을 돕는 마이크로소프트의 도구·엔진.",
    "엔티티(entity)": "문서에 등장하는 의미 있는 대상(사람·조항·개념 등). 지식그래프의 '점'에 해당함.",
    "관계(relationship)": "두 엔티티가 어떻게 연결되는지(예: A가 B를 규정함). 지식그래프의 '선'에 해당함.",
    "커뮤니티(community)": "서로 촘촘히 연결된 엔티티들의 묶음. GraphRAG가 Leiden 알고리즘으로 자동 그룹핑함.",
    "workflow(워크플로우)": "GraphRAG 엔진이 순서대로 수행하는 처리 단계(입력 로드→그래프 추출→커뮤니티→리포트→임베딩 등).",
    "subprocess": "지금 실행 중인 프로그램이 또 다른 프로그램을 '별도 프로세스'로 띄워 실행하는 것. 여기선 외부 graphrag 명령을 띄움.",
    "Popen": "파이썬 subprocess의 함수. 외부 명령을 시작하고, 그 출력·종료를 다룰 수 있게 해 줌.",
    "CLI": "Command Line Interface. 터미널에 명령을 쳐서 쓰는 프로그램. 여기선 'graphrag index' 명령을 가리킴.",
    "스레드(thread)": "한 프로그램 안에서 여러 일을 동시에 처리하는 작업 갈래. 여기선 출력·오류를 동시에 읽는 데 씀.",
    "환경변수 상속": "부모 프로세스가 가진 환경변수(API 키 등)를 자식 프로세스가 그대로 물려받는 것.",
    "tqdm": "반복 작업의 진행 상황을 막대바로 보여 주는 파이썬 라이브러리.",
    "PDF": "문서 파일 형식. 여기서는 국가법령정보센터가 배포한 특허법 전문 PDF를 입력으로 씀.",
    "PyPDFLoader": "PDF를 페이지 단위 Document로 바꿔 주는 LangChain 로더(불러오기 도구).",
    "Document": "LangChain에서 '본문(page_content) + 메모(metadata)'를 한 묶음으로 담는 기본 객체.",
    "LangChain": "LLM·검색·문서 처리 부품을 조립해 AI 앱을 만드는 파이썬 프레임워크.",
    "청킹(chunking)": "긴 문서를 처리·검색하기 좋은 작은 조각(청크)으로 나누는 것.",
    "RecursiveCharacterTextSplitter": "구분자 목록을 우선순위대로 적용해 정해진 크기 이하가 될 때까지 재귀적으로 문서를 쪼개는 LangChain 분할기.",
    "chunk_size": "한 청크에 담는 최대 글자 수(이 예제는 1800).",
    "chunk_overlap": "이웃한 청크끼리 겹쳐 두는 글자 수(이 예제는 200). 경계에서 맥락이 끊기지 않게 함.",
    "정규식(re)": "글자 패턴을 규칙으로 표현해 찾기/바꾸기를 하는 도구. 파이썬 표준 모듈 re. 예: 숫자·공백 등의 패턴을 표현함.",
    "re.sub": "정규식으로 찾은 부분을 다른 문자열로 바꾸는 함수(substitute의 약자).",
    "노이즈": "검색·추출에 방해되는 불필요한 반복 텍스트(머리글·페이지번호·개정 태그 등).",
    "멱등성": "같은 작업을 몇 번 실행해도 결과가 같은 성질. 여기선 재실행 시 기존 입력 txt를 지워 중복을 막음.",
    "to_input_text": "청크에 출처 헤더(법령명·파일명·청크번호)를 붙여 GraphRAG 입력 형식 텍스트로 만드는 보조 함수.",
    "임베딩(embedding)": "글의 의미를 숫자 목록(벡터)으로 바꾸는 것. 의미가 비슷하면 벡터도 가까움.",
    "parquet": "표(행·열) 데이터를 효율적으로 저장하는 파일 형식. GraphRAG가 엔티티·관계 등을 이 형식으로 저장함.",
    "pandas(pd)": "표 데이터를 다루는 파이썬 라이브러리. 여기선 parquet 파일을 읽어 행 수를 셈.",
    "LanceDB": "벡터를 저장하고 빠르게 검색하는 벡터 전용 데이터베이스. GraphRAG의 임베딩이 여기에 테이블로 들어감.",
    "index_name": "LanceDB 벡터 테이블의 이름. 서로 다른 데이터가 같은 이름을 쓰면 덮어써져 한쪽이 사라지는 함정이 있음.",
    "적재율(coverage)": "원본 데이터(parquet) 대비 실제로 벡터 테이블에 들어간 비율(%). 90% 미만이면 임베딩 미완성으로 봄.",
    "dataclass": "필드만 적으면 생성자 등을 자동으로 만들어 주는 파이썬의 '데이터 그릇' 도구(@dataclass).",
    "@property": "메서드를 속성처럼 쓰게 해 주는 표시. 호출할 때마다 값을 계산해 돌려줌(예: critical_count).",
    "심각도(severity)": "검증 결과의 중요도 등급. 높을수록 먼저 고쳐야 함.",
    "CRITICAL/WARNING/INFO": "검증 심각도 3단계. CRITICAL은 치명적(재인덱싱 권고), WARNING은 주의, INFO는 참고용.",
    "field(default_factory)": "dataclass에서 인스턴스를 만들 때 함수를 불러 기본값을 계산하게 하는 설정(리스트·경로 등에 씀).",
    "settings.yaml": "GraphRAG 엔진의 동작 규칙(모델·청킹·벡터 저장 등)을 적어 둔 설정 파일. 파이썬이 아니라 엔진이 읽음.",
    ".env": "API 키처럼 민감한 값을 코드 밖에 따로 보관하는 파일. load_dotenv로 읽어 환경변수로 올림.",
    "load_dotenv": ".env 파일을 읽어 그 안의 값을 환경변수로 올려 주는 함수(python-dotenv 제공).",
    "이식성(portability)": "어느 컴퓨터·폴더에서 실행해도 똑같이 동작하는 성질. 경로를 __file__ 기준으로 잡아 보장함.",
    "argparse": "명령줄 옵션(--force, --limit 등)을 정의·해석해 주는 파이썬 표준 모듈.",
    "파이프라인": "여러 처리 단계를 한 줄로 이어, 앞 단계 결과를 다음 단계로 넘기는 구조.",
    "진입점(main)": "프로그램 실행이 시작되는 함수. 전체 흐름을 순서대로 호출함.",
    "mkdir": "폴더(디렉터리)를 만드는 명령. parents·exist_ok 옵션으로 상위 폴더 생성·중복 무시를 제어함.",
    "로거(logger)": "프로그램 실행 중 일어난 일을 정해진 형식으로 기록·출력하는 도구.",
    "핸들러(handler)": "로거가 만든 메시지를 어디로(콘솔·파일 등) 내보낼지 정하는 출력 담당. 중복으로 붙으면 로그가 여러 번 찍힘.",
  },
};
