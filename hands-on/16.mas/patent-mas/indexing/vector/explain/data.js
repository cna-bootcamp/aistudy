window.EXPLAIN_DATA = {
  meta: {
    title: "특허법 조문 벡터 RAG 인덱싱 — 장/조/항 메타데이터 부여 파이프라인",
    entry: "indexing.py",
  },

  // 좌측 그룹 = 파일 (메인 인덱싱 파이프라인 → 전역 설정)
  files: [
    { id: "main",     label: "indexing.py",        role: "인덱싱 실행 진입점 — PDF 로드→전처리→청킹→장/조/항 메타데이터→임베딩→ChromaDB 저장→검증" },
    { id: "settings", label: "config/settings.py", role: "전역 설정 — 경로·임베딩 모델·청킹 파라미터·노이즈 키워드·검증 쿼리를 한곳에서 관리" },
  ],

  // 전체 처리 흐름 (환경 준비 → 로드 → 전처리 → 청킹 → 메타데이터 → 저장 → 검증)
  flow: [
    {
      step: 1,
      title: "환경 준비 & 설정 로드",
      label: "환경·설정 로드",
      refs: ["settings_consts"],
      summary: "sys.path 보정 → config.settings 로드 → .env에서 OPENAI_API_KEY 읽기",
      detail: "실행을 시작하면 먼저 모듈 검색 경로를 보정해 어느 위치에서 실행하든 config 폴더를 찾을 수 있게 합니다. 그다음 settings.py(경로·모델·청킹 값 모음)를 불러오고, .env 파일에서 OpenAI 비밀키를 읽어 둡니다. 비유하면 '요리 시작 전 재료와 레시피, 도구를 식탁에 올려두는' 준비 단계입니다.",
    },
    {
      step: 2,
      title: "PDF 로드",
      label: "PDF 로드",
      refs: ["load_pdf"],
      summary: "load_pdf(): 특허법 PDF를 페이지 단위 Document 목록으로 변환",
      detail: "PyPDFLoader가 특허법 PDF를 펼쳐 한 페이지를 하나의 'Document(본문+출처 메모가 붙은 종이 한 장)'로 만듭니다. 글자가 한 자도 추출되지 않으면(스캔 이미지 PDF) 일찍 오류를 내 헛작업을 막습니다.",
    },
    {
      step: 3,
      title: "전처리 — 노이즈 제거",
      label: "전처리",
      refs: ["clean_text", "preprocess_documents"],
      summary: "clean_text() / preprocess_documents(): 머리글·페이지번호 등 반복 노이즈 삭제",
      detail: "법령 PDF는 모든 페이지에 '특허법', '법제처', '국가법령정보센터', '- 1 -' 같은 머리글/페이지번호가 반복됩니다. 검색에 방해되는 이런 글자를 정규식으로 걸러냅니다. 비유하면 '복사본마다 찍힌 워터마크와 쪽번호를 지우는' 작업입니다.",
    },
    {
      step: 4,
      title: "청킹 + 노이즈 청크 필터",
      label: "청킹·필터",
      refs: ["split_documents", "filter_chunks"],
      summary: "split_documents() → filter_chunks(): 800자 단위로 쪼개고 빈/태그-only 조각 제거",
      detail: "긴 본문을 검색하기 좋은 800자 조각(청크)으로 자릅니다. 이때 법령 구조(장→조→항)를 우선 경계로 삼아 의미가 중간에 끊기지 않게 합니다. 자른 뒤 '[전문개정 2014...]'처럼 개정 태그만 든 쓸모없는 조각은 버립니다.",
    },
    {
      step: 5,
      title: "장/조/항 메타데이터 부여 (핵심)",
      label: "메타데이터 부여",
      refs: ["attach_law_metadata", "label_helpers"],
      summary: "attach_law_metadata(): 컨텍스트 승계(carry-forward)로 각 청크에 소속 장/조/항 표기",
      detail: "이 예제의 핵심입니다. 청크를 순서대로 한 번 훑으면서 '지금 몇 장 몇 조를 보고 있는지' 기억합니다. 긴 조문이 여러 청크로 쪼개져 뒤쪽 청크엔 머리글이 없어도, 직전 청크의 장/조를 물려받아(carry-forward) '제29조(특허요건)에 속한 본문'임을 정확히 표기합니다. 덕분에 나중에 검색 결과가 '특허법 제29조'처럼 출처 추적이 됩니다.",
    },
    {
      step: 6,
      title: "임베딩 + ChromaDB 저장",
      label: "임베딩·저장",
      refs: ["build_vectordb"],
      summary: "build_vectordb(): OpenAI로 각 청크를 1536차원 벡터로 바꿔 ChromaDB에 영속 저장",
      detail: "각 청크를 OpenAI 임베딩 모델로 1536개 숫자 벡터(의미를 좌표로 바꾼 것)로 변환해 ChromaDB라는 벡터 전용 데이터베이스에 저장합니다. 재실행 시 같은 문서가 중복 적재되지 않도록 기존 저장소를 통째로 지우고 새로 만듭니다(멱등성).",
    },
    {
      step: 7,
      title: "검증",
      label: "검증",
      refs: ["verify_vectordb"],
      summary: "verify_vectordb(): 저장 개수·차원 확인 + 알려진 조문으로 메타데이터 스폿체크",
      detail: "저장된 벡터 개수와 임베딩 차원(1536)이 맞는지 확인하고, '특허요건은?' 같은 알려진 질문으로 검색해 반환된 청크의 장/조 메타데이터가 기대값(제29조 등)과 맞는지 눈으로 확인합니다. 개수만으로는 못 잡는 '인용 메타데이터의 정확성'을 검사하는 단계입니다.",
    },
  ],

  functions: [
    // ───────────────────────── indexing.py ─────────────────────────
    {
      id: "clean_text",
      name: "clean_text()",
      fileId: "main",
      summary: "PDF에서 뽑은 텍스트의 머리글·바닥글·페이지번호 같은 반복 노이즈를 정규식으로 제거",
      how: "법령 PDF는 페이지마다 '법제처', '국가법령정보센터', '특허법', '- 1 -' 같은 글자가 반복됩니다. 검색에 방해만 되므로 정규식(글자 패턴 규칙)으로 찾아 지웁니다. 줄을 하나씩 살펴 노이즈 키워드가 든 줄이나 법령명만 든 줄은 버리고, 마지막에 연속 공백·빈 줄을 정돈합니다.",
      terms: ["정규식(re)", "re.sub", "PDF", "노이즈"],
      lines: [
        { at: "# 페이지 번호 패턴 제거", text: "'- 1 -', '1 / 50' 같은 페이지 번호 형식을 정규식으로 찾아 빈 문자열로 바꿔 지웁니다." },
        { at: "lines = text.split", text: "전체 텍스트를 줄 단위로 쪼개 한 줄씩 검사할 수 있게 만듭니다." },
        { at: "if any(kw in line", text: "그 줄에 '법제처'·'국가법령정보센터' 같은 노이즈 키워드가 하나라도 있으면 건너뜁니다(버림)." },
        { at: "if line.strip() == cfg.RUNNING_HEADER", text: "줄 전체가 '특허법'(법령명)뿐인 반복 머리글 줄이면 버립니다." },
        { at: "cleaned_lines.append(line)", text: "노이즈가 아닌 줄만 따로 모읍니다." },
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
    # 머리글·바닥글 키워드가 포함된 줄과 반복 법령명 머리글 줄을 제거함
    lines = text.split("\\n")
    cleaned_lines = []
    for line in lines:
        # "법제처 ... 국가법령정보센터" 형식의 페이지 머리글/바닥글 줄 제거
        if any(kw in line for kw in cfg.NOISE_KEYWORDS):
            continue
        # 줄 전체가 법령명("특허법")뿐인 반복 머리글 줄 제거 (본문 내 인용은 다른 글자와 함께 등장하므로 안전)
        if line.strip() == cfg.RUNNING_HEADER:
            continue
        cleaned_lines.append(line)
    text = "\\n".join(cleaned_lines)
    # 연속 공백·과도한 빈 줄 정규화
    text = re.sub(r"[ \\t]+", " ", text)
    text = re.sub(r"\\n{3,}", "\\n\\n", text)
    return text.strip()`,
    },
    {
      id: "load_pdf",
      name: "load_pdf()",
      fileId: "main",
      summary: "특허법 PDF를 페이지 단위 Document 목록으로 읽어들이는 함수",
      how: "PyPDFLoader는 PDF를 한 페이지씩 'Document(본문 + 출처 메모가 붙은 객체)'로 변환합니다. 글자가 전혀 추출되지 않으면 스캔 이미지 PDF일 가능성이 높으므로, 그 경우 일찍 오류를 내 뒤 단계의 헛작업을 막습니다.",
      terms: ["PyPDFLoader", "Document", "PDF", "LangChain"],
      lines: [
        { at: "from langchain_community.document_loaders import PyPDFLoader", text: "PDF를 Document로 바꿔 주는 LangChain 로더를 (이 함수가 호출될 때) 불러옵니다." },
        { at: "if not pdf_path.exists():", text: "PDF 파일이 실제로 존재하는지 먼저 확인하고, 없으면 명확한 오류를 냅니다." },
        { at: "pages = PyPDFLoader(str(pdf_path)).load()", text: "PDF를 열어 페이지마다 하나씩 Document로 만든 목록을 받습니다." },
        { at: "total_chars = sum(", text: "모든 페이지의 글자 수를 합산합니다(추출 성공 여부 확인용)." },
        { at: "if total_chars == 0:", text: "글자가 한 자도 없으면(스캔 이미지 PDF) 오류를 내 뒤 단계를 막습니다." },
      ],
      code: `def load_pdf(pdf_path: Path) -> list:
    """특허법 PDF를 로드하여 페이지 단위 Document 리스트로 반환함.

    PyPDFLoader: PDF를 페이지 단위 Document로 변환하는 LangChain 로더.
    각 Document.metadata에는 원본 경로(source)와 페이지 번호(page)가 담김.
    """
    from langchain_community.document_loaders import PyPDFLoader  # PDF→Document 로더

    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF 파일을 찾을 수 없음: {pdf_path}")

    pages = PyPDFLoader(str(pdf_path)).load()
    print(f"  - {pdf_path.name}: {len(pages)}페이지 로드")

    # 스캔 PDF(이미지) 등으로 텍스트가 전혀 추출되지 않은 경우를 조기에 감지함
    total_chars = sum(len(doc.page_content) for doc in pages)
    if total_chars == 0:
        raise ValueError("PDF에서 텍스트를 추출하지 못함 (스캔 이미지 PDF 가능성)")
    return pages`,
    },
    {
      id: "preprocess_documents",
      name: "preprocess_documents()",
      fileId: "main",
      summary: "모든 페이지 Document에 clean_text()를 적용하고, 내용이 빈 페이지는 제외",
      how: "load_pdf로 읽은 페이지들을 하나씩 돌며 clean_text로 노이즈를 지웁니다. 전처리 후 내용이 텅 비어버린 페이지(머리글만 있던 페이지 등)는 청킹·임베딩 대상에서 빼 비용과 노이즈를 줄입니다.",
      terms: ["Document", "노이즈"],
      lines: [
        { at: "doc.page_content = clean_text(doc.page_content)", text: "그 페이지의 본문을 clean_text로 정리한 결과로 덮어씁니다." },
        { at: "if doc.page_content:", text: "정리 후에도 내용이 남아 있는 페이지만 (다음 줄에서) 보관 목록에 추가합니다." },
        { at: "cleaned.append(doc)", text: "내용이 있는 페이지만 결과 목록에 모읍니다." },
      ],
      code: `def preprocess_documents(documents: list) -> list:
    """각 Document의 본문에 clean_text()를 적용하고 빈 페이지를 제거함."""
    cleaned = []
    for doc in documents:
        doc.page_content = clean_text(doc.page_content)
        # 전처리 후 내용이 비어버린 페이지는 청킹·임베딩 대상에서 제외함
        if doc.page_content:
            cleaned.append(doc)
    return cleaned`,
    },
    {
      id: "split_documents",
      name: "split_documents()",
      fileId: "main",
      summary: "RecursiveCharacterTextSplitter로 문서를 800자 청크로 분할(법령 구조 우선 경계)",
      how: "긴 본문을 검색하기 좋은 작은 조각(청크)으로 자릅니다. RecursiveCharacterTextSplitter는 구분자 목록(법령 경계 '\\n제' → 항 '\\n①' → 단락 → 줄 → 어절)을 앞에서부터 적용하며 800자 이하가 될 때까지 재귀적으로 쪼갭니다. 법령 구조를 우선 경계로 삼아 의미가 끊기지 않게 합니다.",
      terms: ["RecursiveCharacterTextSplitter", "청킹(chunking)", "chunk_size", "chunk_overlap", "LangChain"],
      lines: [
        { at: "from langchain_text_splitters import RecursiveCharacterTextSplitter", text: "재귀 분할기를 (이 함수가 호출될 때) 불러옵니다." },
        { at: "splitter = RecursiveCharacterTextSplitter(", text: "분할기를 설정값과 함께 만듭니다." },
        { at: "chunk_size=cfg.CHUNK_SIZE,", text: "한 청크의 최대 크기(800자)를 지정합니다." },
        { at: "chunk_overlap=cfg.CHUNK_OVERLAP,", text: "이웃 청크끼리 160자(20%)를 겹치게 해 경계에서 맥락이 끊기지 않게 합니다." },
        { at: "separators=cfg.LAW_SEPARATORS,", text: "분할 우선순위(법령 경계 → 항 → 단락 → 줄 …)를 지정합니다." },
        { at: "return splitter.split_documents(documents)", text: "설정대로 문서를 청크 목록으로 잘라 돌려줍니다." },
      ],
      code: `def split_documents(documents: list) -> list:
    """RecursiveCharacterTextSplitter로 문서를 청크로 분할함.

    RecursiveCharacterTextSplitter: separators 목록을 앞에서부터 순서대로 적용하며
    chunk_size 이하가 될 때까지 재귀적으로 분할하는 분할기. 법령 구조(장→조→항)를
    우선 경계로 삼아 의미 단위가 끊기지 않게 함.
    """
    from langchain_text_splitters import RecursiveCharacterTextSplitter  # 재귀 분할기

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=cfg.CHUNK_SIZE,
        chunk_overlap=cfg.CHUNK_OVERLAP,
        separators=cfg.LAW_SEPARATORS,
    )
    return splitter.split_documents(documents)`,
    },
    {
      id: "filter_chunks",
      name: "filter_chunks()",
      fileId: "main",
      summary: "빈 청크나 '[전문개정 ...]'처럼 개정 태그만 든 노이즈 청크를 제거",
      how: "법령은 조문 앞에 개정 태그·머리글이 단독 청크로 떨어지기도 합니다. '[전문개정 2014. 6. 11.]'처럼 태그만 든 청크는 검색에서 엉뚱하게 상위 노출되어 품질을 떨어뜨리므로 임베딩 대상에서 뺍니다. 어떤 청크를 버렸는지 로그로 남겨 실제 짧은 조문이 잘못 누락되지 않았는지 확인할 수 있게 합니다.",
      terms: ["청킹(chunking)", "정규식(re)", "노이즈"],
      lines: [
        { at: "content = chunk.page_content.strip()", text: "청크 본문의 앞뒤 공백을 떼어 검사 대상으로 삼습니다." },
        { at: "if not content or TAG_ONLY_PATTERN.match(content):", text: "내용이 비었거나 개정 태그만으로 이뤄진 청크인지 판별합니다." },
        { at: "dropped.append(content)", text: "버릴 청크는 따로 모아 둡니다(로그 출력용)." },
        { at: "kept.append(chunk)", text: "검색 가치가 있는 청크만 보관 목록에 담습니다." },
        { at: "return kept", text: "노이즈를 걸러낸 청크 목록을 돌려줍니다." },
      ],
      code: `def filter_chunks(chunks: list) -> list:
    """검색 가치가 없는 노이즈 청크를 제거함.

    법령은 조문 앞에서 머리글·개정 태그가 단독 청크로 떨어지는 경우가 있음.
    "[전문개정 ...]" 같은 태그만 담긴 청크는 질의와 무관하게 상위에 노출되어 검색
    품질을 떨어뜨리므로 임베딩 대상에서 제외함. (clean_text가 못 거른 잔여 노이즈 정리)
    """
    kept = []
    dropped = []
    for chunk in chunks:
        content = chunk.page_content.strip()
        # 빈 청크 또는 개정 태그만으로 구성된 청크는 제외함
        if not content or TAG_ONLY_PATTERN.match(content):
            dropped.append(content)
            continue
        kept.append(chunk)
    # 어떤 청크가 제거됐는지 로그로 남겨 실제 짧은 조문이 잘못 누락되지 않았는지 확인 가능하게 함
    if dropped:
        print(f"  - 노이즈 청크 제거: {len(dropped)}개 → {dropped}")
    return kept`,
    },
    {
      id: "label_helpers",
      name: "_chapter_label() · _article_label()",
      fileId: "main",
      summary: "정규식 매치 결과에서 '제1장'·'제29조' 같은 인용 라벨 문자열을 만드는 두 도우미 함수",
      how: "정규식이 찾은 장/조 머리글에서 번호와 가지번호('의2')를 뽑아 '제6장의2', '제7조의2'처럼 사람이 읽는 라벨로 조립합니다. 메타데이터에 넣을 표준 이름을 만드는 작은 보조 함수입니다.",
      terms: ["정규식(re)", "re.Match", "f-string"],
      lines: [
        { at: "# group(2)는", text: "'의 2'처럼 공백이 낀 가지번호에서 공백을 제거해 '의2'로 만듭니다(없으면 빈 문자열)." },
        { at: 'return f"제{number}장{branch}"', text: "장 번호와 가지번호를 합쳐 '제6장의2' 형식의 라벨을 돌려줍니다." },
        { at: 'return f"제{number}조{branch}"', text: "조 번호와 가지번호를 합쳐 '제7조의2' 형식의 라벨을 돌려줍니다." },
      ],
      code: `def _chapter_label(match: re.Match) -> str:
    """장 정규식 매치에서 "제1장"/"제6장의2" 형식의 라벨을 만듦."""
    number = match.group(1)
    # group(2)는 "의 2"처럼 공백을 포함할 수 있어 공백을 제거함 ("의2")
    branch = (match.group(2) or "").replace(" ", "")
    return f"제{number}장{branch}"


def _article_label(match: re.Match) -> str:
    """조 정규식 매치에서 "제29조"/"제7조의2" 형식의 라벨을 만듦."""
    number = match.group(1)
    branch = (match.group(2) or "").replace(" ", "")
    return f"제{number}조{branch}"`,
    },
    {
      id: "attach_law_metadata",
      name: "attach_law_metadata()",
      fileId: "main",
      summary: "각 청크에 소속 장/조/항을 부여 — '컨텍스트 승계(carry-forward)' 단일 패스 알고리즘",
      how: "이 예제의 핵심 함수입니다. 청크를 문서 순서대로 한 번만 훑으며 '지금까지 본 마지막 장/조'를 변수에 기억합니다. 청크에 장/조 머리글이 있으면 그것으로 갱신하고, 머리글이 없는 연속 청크(긴 조문이 쪼개진 뒷부분)는 직전 장/조를 그대로 물려받습니다(carry-forward). 이렇게 모든 청크가 '제29조(특허요건)에 속한 본문'처럼 출처를 갖게 됩니다. ChromaDB는 리스트를 저장하지 못하므로 여러 조/항은 콤마 문자열로 직렬화합니다.",
      terms: ["carry-forward(컨텍스트 승계)", "메타데이터", "정규식(re)", "finditer", "인용 추적(citation tracing)", "직렬화"],
      lines: [
        { at: "cur_chapter_label, cur_chapter_title = ", text: "'직전까지 본 장' 기억 변수를 빈 값으로 초기화합니다(연속 청크가 물려받을 컨텍스트)." },
        { at: "for index, chunk in enumerate(chunks):", text: "청크를 0번부터 순서대로(번호와 함께) 하나씩 처리합니다." },
        { at: "chapter_matches = list(CHAPTER_RE.finditer(text))", text: "이 청크 안에 장(章) 머리글이 있는지 정규식으로 모두 찾습니다." },
        { at: "chapter_label, chapter_title = cur_chapter_label, cur_chapter_title", text: "장 머리글이 없으면 직전 장을 그대로 물려받습니다(carry-forward 핵심)." },
        { at: "article_matches = list(ARTICLE_RE.finditer(text))", text: "이 청크 안에 조(條) 머리글이 있는지 정규식으로 모두 찾습니다." },
        { at: "article_label, article_title = cur_article_label, cur_article_title", text: "조 머리글이 없는 연속 청크는 직전 조문을 물려받습니다." },
        { at: 'clauses = ",".join(mark for mark in CLAUSE_MARKS if mark in text)', text: "청크에 등장하는 항 마커(①②③…)를 모아 콤마 문자열로 만듭니다." },
        { at: "chunk.metadata = {", text: "기존 메타데이터를 버리고 스펙에 정의된 키만 새로 채웁니다." },
        { at: '"article": article_label,', text: "대표 조 라벨(예: '제29조')을 메타데이터에 기록합니다 — 인용 추적의 핵심." },
        { at: '"articles": articles,', text: "한 청크에 여러 조가 병합된 경우 전체 조 목록을 함께 기록합니다." },
        { at: "return chunks", text: "메타데이터가 부여된 청크 목록을 돌려줍니다." },
      ],
      code: `def attach_law_metadata(chunks: list) -> list:
    """각 청크에 기본 4종 + 장/조/항 메타데이터를 부여함.

    핵심 알고리즘 — '컨텍스트 승계(carry-forward)' 단일 패스:
      청크를 문서 순서대로 1회 순회하며 직전까지 본 장/조를 기억함. 긴 조문이 여러
      청크로 쪼개지면 뒤따르는 연속 청크에는 머리글이 없으므로, 직전 청크의 장/조를
      물려받아 "어느 조문에 속한 본문인지"를 정확히 표기함. 순회가 결정적이라 재현성 보장.

    부여 항목(ChromaDB는 str/int 등 원시형만 허용하므로 리스트는 콤마 문자열로 직렬화):
      source/chunk_index/total_chunks/char_count + chapter/chapter_title/
      article/article_title/articles(청크 내 전체 조)/clauses(청크 내 항 마커)
    """
    total = len(chunks)
    # 직전까지 본 장/조 컨텍스트 (연속 청크가 물려받음). 미상이면 빈 문자열 유지
    cur_chapter_label, cur_chapter_title = "", ""
    cur_article_label, cur_article_title = "", ""

    for index, chunk in enumerate(chunks):
        text = chunk.page_content

        # --- 장(章) ---
        chapter_matches = list(CHAPTER_RE.finditer(text))
        if chapter_matches:
            # 청크에 장 머리글이 있으면 그 청크의 장 = 첫 번째 머리글
            first = chapter_matches[0]
            chapter_label = _chapter_label(first)
            chapter_title = first.group(3).strip()
            # 후속 청크가 물려받을 컨텍스트는 청크 내 마지막 장으로 갱신
            last = chapter_matches[-1]
            cur_chapter_label = _chapter_label(last)
            cur_chapter_title = last.group(3).strip()
        else:
            # 장 머리글이 없으면 직전 장을 승계
            chapter_label, chapter_title = cur_chapter_label, cur_chapter_title

        # --- 조(條) ---
        article_matches = list(ARTICLE_RE.finditer(text))
        if article_matches:
            first_a = article_matches[0]
            # 대표 조문 = 청크 첫 번째 조 머리글
            article_label = _article_label(first_a)
            article_title = first_a.group(3).strip()
            # 청크가 여러 짧은 조를 담은 경우 전체 조 번호를 순서 보존·중복 제거하여 기록
            seen = []
            for m in article_matches:
                label = _article_label(m)
                if label not in seen:
                    seen.append(label)
            articles = ",".join(seen)
            # 후속 연속 청크용 컨텍스트는 청크 내 마지막 조로 갱신
            last_a = article_matches[-1]
            cur_article_label = _article_label(last_a)
            cur_article_title = last_a.group(3).strip()
        else:
            # 머리글이 없는 연속 청크 → 직전 조문 컨텍스트를 승계함
            article_label, article_title = cur_article_label, cur_article_title
            articles = article_label

        # --- 항(項) ---
        # 청크에 등장하는 항 마커를 ①②③ 정의 순서대로 수집(자연 등장 순과 일치)
        clauses = ",".join(mark for mark in CLAUSE_MARKS if mark in text)

        # PyPDFLoader가 넣은 source는 전체 경로이므로 파일명만 추출함
        source_name = Path(chunk.metadata.get("source", "")).name
        # 기존 메타데이터(page 등)를 버리고 스펙에 정의된 키만 남김
        chunk.metadata = {
            "source": source_name,
            "chunk_index": index,
            "total_chunks": total,
            "char_count": len(text),
            "chapter": chapter_label,          # 장 라벨 (예: "제2장")
            "chapter_title": chapter_title,    # 장 제목 (예: "특허요건 및 특허출원")
            "article": article_label,          # 대표 조 라벨 (예: "제29조")
            "article_title": article_title,    # 대표 조 제목 (예: "특허요건")
            "articles": articles,              # 청크 내 전체 조 (예: "제29조,제30조")
            "clauses": clauses,                # 청크 내 항 마커 (예: "①,②")
        }
    return chunks`,
    },
    {
      id: "build_vectordb",
      name: "build_vectordb()",
      fileId: "main",
      summary: "청크를 OpenAI 임베딩으로 벡터화해 ChromaDB에 영속 저장",
      how: "각 청크 텍스트를 OpenAI 임베딩 모델로 1536개 숫자(벡터)로 바꿔 ChromaDB에 저장합니다. 같은 문서가 두 번 들어가면 검색 품질이 나빠지므로, 기존 저장 폴더가 있으면 통째로 지운 뒤 새로 만듭니다(재실행해도 결과가 같도록 = 멱등성).",
      terms: ["임베딩(embedding)", "OpenAIEmbeddings", "ChromaDB", "Chroma.from_documents", "벡터(vector)", "멱등성", "shutil.rmtree", "컬렉션(collection)"],
      lines: [
        { at: "from langchain_chroma import Chroma", text: "ChromaDB를 LangChain에서 쓰기 위한 래퍼를 불러옵니다." },
        { at: "from langchain_openai import OpenAIEmbeddings", text: "OpenAI 임베딩 래퍼를 불러옵니다." },
        { at: "if cfg.STORE_DIR.exists():", text: "기존 벡터 DB 폴더가 있는지 확인합니다." },
        { at: "shutil.rmtree(cfg.STORE_DIR)", text: "있으면 통째로 삭제해 중복 적재를 막습니다(멱등성)." },
        { at: "embeddings = OpenAIEmbeddings(model=cfg.EMBEDDING_MODEL)", text: "텍스트를 1536차원 벡터로 바꾸는 임베딩 도구를 준비합니다(API 키는 환경변수에서 자동 사용)." },
        { at: "vectorstore = Chroma.from_documents(", text: "청크들을 한 번에 임베딩해 ChromaDB 컬렉션으로 저장합니다." },
        { at: "collection_name=cfg.COLLECTION_NAME,", text: "컬렉션 이름을 'patent_law'로 지정 — 나중에 MAS가 이 이름으로 검색합니다." },
        { at: "return vectorstore", text: "만들어진 벡터 저장소 객체를 돌려줍니다(검증 단계에서 사용)." },
      ],
      code: `def build_vectordb(chunks: list):
    """청크를 OpenAI 임베딩으로 벡터화하여 ChromaDB에 영속 저장하고 vectorstore를 반환함.

    재실행 멱등성: 동일 문서가 중복 적재되면 검색 품질이 떨어지므로 기존 영속
    디렉터리를 삭제 후 새로 생성함.
    Chroma.from_documents: 문서 리스트를 임베딩하여 컬렉션에 저장하는 LangChain 헬퍼.
    """
    from langchain_chroma import Chroma  # ChromaDB용 LangChain 벡터스토어 래퍼
    from langchain_openai import OpenAIEmbeddings  # OpenAI 임베딩 래퍼

    # 기존 벡터 DB가 있으면 통째로 삭제하여 중복 적재를 방지함
    if cfg.STORE_DIR.exists():
        shutil.rmtree(cfg.STORE_DIR)
        print(f"  - 기존 벡터 DB 삭제: {cfg.STORE_DIR}")

    # OpenAIEmbeddings: 텍스트를 1536차원 벡터로 변환 (OPENAI_API_KEY 환경변수 자동 사용)
    embeddings = OpenAIEmbeddings(model=cfg.EMBEDDING_MODEL)

    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        collection_name=cfg.COLLECTION_NAME,
        persist_directory=str(cfg.STORE_DIR),
    )
    return vectorstore`,
    },
    {
      id: "verify_vectordb",
      name: "verify_vectordb()",
      fileId: "main",
      summary: "저장 벡터 수·임베딩 차원 확인 + 알려진 조문 검색으로 장/조 메타데이터 스폿체크",
      how: "저장이 잘 됐는지 세 가지로 확인합니다. (1) 저장된 벡터 개수, (2) 임베딩 차원이 1536인지, (3) '특허요건은?' 같은 알려진 질문으로 검색해 상위 청크의 장/조 메타데이터가 기대값(제29조 등)과 맞는지. 개수만으로는 못 잡는 '인용 메타데이터의 정확성'을 사람이 눈으로 확인하는 단계입니다.",
      terms: ["similarity_search", "임베딩(embedding)", "메타데이터", "스폿체크", "컬렉션(collection)"],
      lines: [
        { at: "count = vectorstore._collection.count()", text: "컬렉션에 실제 저장된 벡터 개수를 읽어 출력합니다." },
        { at: "query_vector = vectorstore._embedding_function.embed_query(sample_query)", text: "예시 질문 하나를 벡터로 바꿔 차원을 확인할 준비를 합니다." },
        { at: "dim = len(query_vector)", text: "벡터의 길이(차원 수)를 셉니다." },
        { at: "status = ", text: "차원이 기대값(1536)과 같으면 'OK', 다르면 '불일치'로 표시합니다." },
        { at: "def _covers_article(meta: dict, expected: str) -> bool:", text: "검색된 청크가 기대 조문(예: 제29조)을 담고 있는지 판정하는 보조 함수입니다." },
        { at: "for query, expected_article in cfg.SPOT_CHECK_QUERIES:", text: "미리 정해 둔 '질문 → 기대 조문' 목록을 하나씩 검사합니다." },
        { at: "results = vectorstore.similarity_search(query, k=3)", text: "그 질문으로 의미가 가까운 청크 3개를 검색합니다." },
        { at: "hit = next(", text: "상위 3개 중 기대 조문을 담은 청크가 있으면 그것을 골라 일치 여부를 표시합니다." },
      ],
      code: `def verify_vectordb(vectorstore) -> None:
    """저장 벡터 수·임베딩 차원과 장/조/항 메타데이터 정확성을 검증함.

    개수·차원 검증만으로는 이 과제의 본질인 '인용 메타데이터의 정확성'을 확인할 수
    없으므로, 알려진 조문으로 검색해 반환 청크의 chapter/article이 기대값과 맞는지
    스폿체크함. carry-forward의 약점(연속 청크 누락·overlap 오염)도 함께 드러남.
    """
    # ._collection.count(): 컬렉션에 실제 저장된 벡터 개수를 반환함
    count = vectorstore._collection.count()
    print(f"  - 저장된 벡터 수: {count}")

    # 임베딩 함수로 쿼리 한 건을 벡터화하여 차원이 1536인지 확인함
    sample_query = cfg.SPOT_CHECK_QUERIES[0][0]
    query_vector = vectorstore._embedding_function.embed_query(sample_query)
    dim = len(query_vector)
    status = "OK" if dim == cfg.EMBEDDING_DIM else f"불일치(기대 {cfg.EMBEDDING_DIM})"
    print(f"  - 임베딩 차원: {dim} [{status}]")

    # 장/조/항 메타데이터 스폿체크 — 알려진 조문 검색 → 상위 청크의 메타데이터 출력
    print("  - 메타데이터 스폿체크 (질의 → 기대 조 / 실제 상위 청크 메타데이터):")

    def _covers_article(meta: dict, expected: str) -> bool:
        # 짧은 조문은 한 청크에 여러 조가 병합되므로 대표 article뿐 아니라
        # 전체 조 목록(articles)에 기대 조문이 포함되는지까지 확인함(인용 추적 관점)
        return expected == meta.get("article") or expected in meta.get("articles", "").split(",")

    for query, expected_article in cfg.SPOT_CHECK_QUERIES:
        results = vectorstore.similarity_search(query, k=3)
        if not results:
            print(f"    · '{query}' → 검색 결과 없음")
            continue
        # 상위 3건 중 기대 조문을 담은 청크가 있으면 그것을, 없으면 1순위를 표시함
        hit = next((d for d in results if _covers_article(d.metadata, expected_article)), None)
        match_mark = "✓일치" if hit else "△상위3 내 미발견(1순위 표시)"
        doc = hit or results[0]
        meta = doc.metadata
        snippet = doc.page_content[:45].replace("\\n", " ")
        print(
            f"    · '{query}' (기대 {expected_article}) [{match_mark}]\\n"
            f"        chapter={meta.get('chapter')}({meta.get('chapter_title')}) "
            f"article={meta.get('article')}({meta.get('article_title')}) "
            f"articles=[{meta.get('articles')}] clauses=[{meta.get('clauses')}]\\n"
            f"        본문: {snippet}..."
        )`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "PDF 로드 → 전처리 → 청킹 → 메타데이터 → 임베딩·저장 → 검증을 순서대로 실행하는 진입점",
      how: "전체 인덱싱 파이프라인을 [1/5]~[5/5] 단계로 차례대로 호출하는 '지휘자' 함수입니다. 각 단계가 앞 단계의 결과를 받아 다음으로 넘깁니다. 맨 아래 if __name__ 블록은 이 파일을 직접 실행할 때만 main()을 돌리고, 오류가 나면 메시지를 출력한 뒤 비정상 종료 코드로 끝냅니다.",
      terms: ["진입점(main)", 'if __name__ == "__main__"', "파이프라인"],
      lines: [
        { at: "documents = load_pdf(cfg.PDF_PATH)", text: "[1/5] 특허법 PDF를 페이지 Document 목록으로 로드합니다." },
        { at: "documents = preprocess_documents(documents)", text: "[2/5] 노이즈를 제거하고 빈 페이지를 거릅니다." },
        { at: "chunks = split_documents(documents)", text: "[3/5] 800자 청크로 분할합니다." },
        { at: "chunks = filter_chunks(chunks)", text: "노이즈 청크를 걸러냅니다." },
        { at: "chunks = attach_law_metadata(chunks)", text: "각 청크에 장/조/항 메타데이터를 부여합니다." },
        { at: "vectorstore = build_vectordb(chunks)", text: "[4/5] OpenAI 임베딩으로 벡터화해 ChromaDB에 저장합니다." },
        { at: "verify_vectordb(vectorstore)", text: "[5/5] 저장 결과와 메타데이터 정확성을 검증합니다." },
        { at: 'if __name__ == "__main__":', text: "이 파일을 직접 실행할 때만 아래 블록을 수행합니다(import 시에는 실행 안 함)." },
        { at: "except Exception as error:", text: "실행 중 오류가 나면 메시지를 출력하고 비정상 종료 코드(1)로 빠져나갑니다." },
      ],
      code: `def main() -> None:
    """PDF 로드 → 전처리 → 청킹 → 메타데이터 → 임베딩·저장 → 검증 순으로 인덱싱을 수행함."""
    print("[1/5] PDF 로드")
    documents = load_pdf(cfg.PDF_PATH)

    print("[2/5] 전처리 (노이즈 제거)")
    documents = preprocess_documents(documents)
    print(f"  - 전처리 후 페이지 수: {len(documents)}")

    print("[3/5] 청킹 + 장/조/항 메타데이터")
    chunks = split_documents(documents)
    # 머리글·개정 태그만 담긴 노이즈 청크를 제거한 뒤 메타데이터를 부여함 (인덱스 연속성 유지)
    chunks = filter_chunks(chunks)
    chunks = attach_law_metadata(chunks)
    print(f"  - 생성된 청크 수: {len(chunks)}")

    print("[4/5] OpenAI 임베딩 + ChromaDB 저장")
    vectorstore = build_vectordb(chunks)
    print(f"  - 저장 위치: {cfg.STORE_DIR}")

    print("[5/5] 검증")
    verify_vectordb(vectorstore)

    print("\\n인덱싱 완료. 특허법 조문 벡터 인덱스가 준비됨.")


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # 실행 중 오류를 명확히 출력하고 비정상 종료 코드로 빠져나감
        print(f"\\n[오류] 인덱싱 실패: {error}", file=sys.stderr)
        sys.exit(1)`,
    },

    // ───────────────────────── config/settings.py ─────────────────────────
    {
      id: "settings_consts",
      name: "주요 설정 상수",
      fileId: "settings",
      summary: "경로·임베딩 모델·청킹 파라미터·노이즈·검증 쿼리를 한곳에 모은 설정값들",
      how: "코드 곳곳에서 cfg.XXX 형태로 참조하는 값을 모두 이 파일 한곳에 모아 둡니다. 청킹 크기·임베딩 모델·컬렉션 이름 같은 값을 바꾸려면 코드를 뒤질 필요 없이 여기만 고치면 됩니다. 재현성을 위해 청킹 값은 고정해 둡니다.",
      terms: ["text-embedding-3-small", "ChromaDB", "컬렉션(collection)", "chunk_size", "chunk_overlap", "재현성"],
      lines: [
        { at: 'COLLECTION_NAME = "patent_law"', text: "벡터를 담을 컬렉션 이름. 다운스트림 MAS가 같은 이름으로 검색합니다." },
        { at: 'EMBEDDING_MODEL = "text-embedding-3-small"', text: "사용할 OpenAI 임베딩 모델(출력 1536차원)." },
        { at: "CHUNK_SIZE = 800", text: "한 청크의 최대 글자 수." },
        { at: "CHUNK_OVERLAP = 160", text: "이웃 청크끼리 겹치는 글자 수(800자의 20%) — 경계 맥락 보존." },
        { at: "LAW_SEPARATORS = ", text: "분할 우선순위 목록 — 법령 경계('\\n제') → 항('\\n①') → 단락 → 줄 → 어절." },
        { at: "NOISE_KEYWORDS = ", text: "머리글/바닥글에서 줄 단위로 제거할 키워드." },
        { at: "SPOT_CHECK_QUERIES = [", text: "검증용 '질문 → 기대 조문' 목록. 메타데이터 정확성 확인에 사용." },
      ],
      code: `# (일부 발췌) config/settings.py — 인덱싱 전역 설정

# 컬렉션명 — 다운스트림 MAS가 동일 이름으로 이 인덱스를 검색함
COLLECTION_NAME = "patent_law"
# OpenAI 임베딩 모델 (출력 1536차원). 로컬 모델 사용 금지 제약에 따라 OpenAI 고정
EMBEDDING_MODEL = "text-embedding-3-small"
# 임베딩 벡터 차원 (text-embedding-3-small 고정값) — 검증 시 기대값으로 사용
EMBEDDING_DIM = 1536

# 청킹 파라미터 (재현성을 위해 고정값으로 둠)
CHUNK_SIZE = 800           # 청크 최대 크기(문자 수)
CHUNK_OVERLAP = 160        # 청크 간 겹침 160자(20%, 맥락 보존)

# 법령 문서 구조를 우선 보존하기 위한 분할 구분자 (앞쪽 우선순위)
LAW_SEPARATORS = ["\\n제", "\\n①", "\\n②", "\\n③", "\\n④", "\\n⑤", "\\n\\n", "\\n", " ", ""]

# 전처리(노이즈 제거) — 국가법령정보센터 PDF의 반복 머리글 정의
RUNNING_HEADER = "특허법"
NOISE_KEYWORDS = ["법제처", "국가법령정보센터"]

# 검증용 스폿체크 쿼리 (질의 → 기대 조문)
SPOT_CHECK_QUERIES = [
    ("산업상 이용할 수 있는 발명의 특허요건은?", "제29조"),  # 특허요건 (제2장)
    ("발명의 정의는 무엇인가?", "제2조"),                  # 정의 (제1장)
    ("특허거절결정의 사유는?", "제62조"),                  # 특허거절결정 (제3장)
]`,
    },
  ],

  glossary: {
    "정규식(re)": "글자 패턴을 규칙으로 표현해 찾기/바꾸기를 하는 도구. 파이썬 표준 모듈 re. 예: r'\\d+'는 '숫자 한 개 이상'을 뜻함.",
    "re.sub": "정규식으로 찾은 부분을 다른 문자열로 바꾸는 함수(substitute의 약자).",
    "re.Match": "정규식이 찾아낸 한 건의 결과 객체. group(1) 등으로 매치 안의 부분을 꺼냄.",
    "re.MULTILINE": "정규식 옵션. ^(줄 시작)·$(줄 끝)이 문자열 전체가 아니라 각 줄에도 적용되게 함.",
    "finditer": "정규식에 맞는 부분을 문서에서 모두 찾아 하나씩 돌려주는 함수.",
    "PDF": "문서 파일 형식. 여기서는 국가법령정보센터가 배포한 특허법 전문 PDF를 입력으로 씀.",
    "PyPDFLoader": "PDF를 페이지 단위 Document로 바꿔 주는 LangChain 로더(불러오기 도구).",
    "Document": "LangChain에서 '본문(page_content) + 메모(metadata)'를 한 묶음으로 담는 기본 객체.",
    "LangChain": "LLM·검색·문서 처리 부품을 조립해 AI 앱을 만드는 파이썬 프레임워크.",
    "메타데이터": "본문에 붙는 부가 정보(출처·페이지·장/조 등). 검색 결과의 출처를 추적할 때 씀.",
    "청킹(chunking)": "긴 문서를 검색하기 좋은 작은 조각(청크)으로 나누는 것.",
    "RecursiveCharacterTextSplitter": "구분자 목록을 우선순위대로 적용해 정해진 크기 이하가 될 때까지 재귀적으로 문서를 쪼개는 LangChain 분할기.",
    "chunk_size": "한 청크에 담는 최대 글자 수(이 예제는 800).",
    "chunk_overlap": "이웃한 청크끼리 겹쳐 두는 글자 수(이 예제는 160 = 20%). 경계에서 맥락이 끊기지 않게 함.",
    "임베딩(embedding)": "글의 의미를 숫자 목록(벡터)으로 바꾸는 것. 의미가 비슷하면 벡터도 가까움.",
    "OpenAIEmbeddings": "OpenAI 임베딩 모델을 LangChain에서 쓰게 해 주는 래퍼.",
    "text-embedding-3-small": "OpenAI의 임베딩 모델 이름. 텍스트를 1536차원 벡터로 변환함.",
    "벡터(vector)": "여러 숫자를 한 줄로 늘어놓은 것. 여기서는 글 의미를 나타내는 1536개 숫자.",
    "ChromaDB": "벡터를 저장하고 '의미가 가까운 것'을 빠르게 찾아 주는 벡터 전용 데이터베이스.",
    "Chroma.from_documents": "문서 목록을 한 번에 임베딩해 ChromaDB 컬렉션으로 저장하는 LangChain 헬퍼.",
    "컬렉션(collection)": "벡터 DB 안에서 같은 종류의 데이터를 모아 두는 묶음(테이블 같은 것). 여기 이름은 patent_law.",
    "similarity_search": "질문 벡터와 의미가 가까운 청크를 ChromaDB에서 찾아 주는 검색 함수.",
    "carry-forward(컨텍스트 승계)": "앞에서 본 정보를 뒤로 물려주는 기법. 여기선 머리글 없는 연속 청크가 직전 장/조를 이어받음.",
    "인용 추적(citation tracing)": "검색 결과가 '특허법 제29조'처럼 어느 조문에서 나왔는지 출처를 되짚는 것.",
    "직렬화": "리스트 같은 복합 데이터를 저장 가능한 단순 형태(예: 콤마로 이은 문자열)로 바꾸는 것. ChromaDB가 원시형만 저장하기 때문에 필요.",
    "노이즈": "검색에 방해되는 불필요한 반복 텍스트(머리글·페이지번호·개정 태그 등).",
    "멱등성": "같은 작업을 몇 번 실행해도 결과가 같은 성질. 여기선 재실행 시 기존 DB를 지워 중복 적재를 막음.",
    "재현성": "같은 입력으로 다시 돌리면 같은 결과가 나오는 성질. 청킹 값을 고정해 보장함.",
    "shutil.rmtree": "폴더와 그 안의 모든 내용을 통째로 삭제하는 파이썬 표준 함수.",
    "스폿체크": "전수 검사 대신 대표 사례 몇 개만 골라 정확성을 눈으로 확인하는 점검.",
    "f-string": "파이썬에서 f\"...{변수}...\" 형태로 문자열 안에 값을 끼워 넣는 문법.",
    "진입점(main)": "프로그램 실행이 시작되는 함수. 전체 흐름을 순서대로 호출함.",
    'if __name__ == "__main__"': "이 파일을 직접 실행할 때만 아래 코드를 돌리는 파이썬 관용구(다른 곳에서 import하면 실행 안 함).",
    "파이프라인": "여러 처리 단계를 한 줄로 이어, 앞 단계 결과를 다음 단계로 넘기는 구조.",
  },
};
