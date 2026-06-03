window.EXPLAIN_DATA = {
  meta: { title: "간단 GraphRAG 인덱싱 — 특허법.pdf → Neo4j", entry: "index_documents.py" },
  files: [
    { id: "main",     label: "index_documents.py",        role: "전체 파이프라인 진입점 — 설정·PDF로드·KG구축·벡터인덱스를 순서대로 조율" },
    { id: "settings", label: "config/settings.py",        role: "Neo4j·Groq·OpenAI임베딩·경로 전역 설정 — .env 로드 및 환경변수 오버라이드" },
    { id: "loader",   label: "document_loader.py",        role: "특허법 PDF를 전처리(머리글 제거)·법령구조 청킹하여 Document로 변환" },
    { id: "graph",    label: "graph/neo4j_connection.py", role: "Neo4j 연결·제약조건·초기화·통계 조회 — 재시도 백오프 포함" },
    { id: "kg",       label: "kg_builder.py",             role: "LLMGraphTransformer로 조문 → 엔티티·관계 추출 → Neo4j KG 저장" },
    { id: "vector",   label: "vector_index.py",           role: "Neo4jVector로 엔티티·조문청크 임베딩 벡터 인덱스 생성 (OpenAI)" }
  ],
  flow: [
    { step: 1, title: "설정 로드",         summary: "Settings가 경로·API 키·모델 정보를 초기화함",                detail: "config/settings.py의 Settings 클래스가 __file__ 위치 기준으로 모든 경로를 자동 계산하고 hands-on/.env에서 GROQ_API_KEY(추출용)·OPENAI_API_KEY(임베딩용)를 읽습니다. neo4j 예제와 달리 데이터소스는 특허법.pdf 1개이고, 임베딩은 OpenAI 1536차원을 씁니다." },
    { step: 2, title: "PDF 로드·청킹",     summary: "특허법.pdf를 읽어 머리글을 지우고 조문 단위로 자름",         detail: "PyPDFLoader로 PDF를 페이지 단위로 읽은 뒤, 법제처 머리글·페이지번호 같은 노이즈를 정규식으로 제거합니다. 그다음 '제○조'·'①②③' 같은 법령 구조를 우선 경계로 삼아 800자 청크로 자릅니다. 같은 청크가 KG와 벡터 인덱스 양쪽에 쓰입니다." },
    { step: 3, title: "Neo4j 연결",       summary: "컨테이너 지연을 고려해 지수 백오프로 3회 재시도함",           detail: "Docker 컨테이너(graphrag-simple-neo4j, 7688 포트)가 완전히 뜨기 전에 연결하면 실패합니다. 1초→2초→4초로 대기 시간을 늘리며 최대 3회 재시도해 일시 장애를 흡수합니다." },
    { step: 4, title: "KG 구축",          summary: "LLMGraphTransformer가 조문 청크에서 엔티티·관계를 추출함",     detail: "Groq LPU의 gpt-oss-120b가 특허법 조문을 읽고 (요건, 관계, 절차) 삼중쌍을 뽑습니다. gpt-oss는 추론 모델이라 reasoning_effort='low'와 max_completion_tokens=8000을 설정해야 출력이 잘리지 않습니다. 추출된 노드·엣지는 Neo4j에 MERGE로 저장됩니다." },
    { step: 5, title: "벡터 인덱스 생성", summary: "Neo4j 안에 entity_embedding과 doc_embedding 두 인덱스를 생성함", detail: "entity_embedding은 KG 엔티티 노드에 OpenAI 임베딩을 추가해 의미 검색 진입점으로 쓰고, doc_embedding은 조문 청크를 Chunk 노드로 저장해 원문 단위 검색을 지원합니다. 인덱싱·질의 임베딩이 같은 모델(1536차원)이어야 검색됩니다." },
    { step: 6, title: "통계 확인",        summary: "노드·관계 수를 출력해 인덱싱 성공 여부를 판정함",              detail: "엔티티 추출 수가 0이면 LLM 추출 경로(reasoning_effort 미설정 등)에 문제가 있다는 명확한 경고를 냅니다. 정상이면 '인덱싱 완료!'를 출력합니다. 실측: 엔티티 842개·관계 2300건." }
  ],
  functions: [
    {
      id: "fn_settings",
      name: "Settings",
      fileId: "settings",
      summary: "Neo4j·Groq·OpenAI임베딩·경로·특허법 온톨로지를 하나의 설정 객체에 모아 관리",
      how: "@dataclass가 __init__을 자동 생성하고, __post_init__에서 .env를 읽어 API 키를 주입합니다. neo4j 예제 대비 핵심 차이: 데이터소스가 특허법.pdf 1개(pdf_path), 임베딩이 OpenAI 1536차원, 포트 7688, 그리고 gpt-oss의 추론 토큰 문제를 막는 reasoning_effort·max_tokens 설정이 추가됐습니다.",
      terms: ["dataclass", "dotenv", "pathlib", "groq_lpu", "openai_embedding", "reasoning_effort", "ontology"],
      lines: [
        { at: "pdf_path: Path = field(default_factory=lambda: _HANDS_ON_DIR / \"10.rag\" / \"data\" / \"특허법.pdf\")", text: "데이터소스 경로입니다. neo4j 예제는 교재 폴더 전체였지만, 이 예제는 10.rag가 쓰는 특허법 PDF 1개만 인덱싱합니다." },
        { at: "neo4j_uri: str = \"bolt://localhost:7688\"", text: "Neo4j 접속 주소입니다. neo4j 예제(7687)와 포트를 분리해, 두 예제의 컨테이너를 동시에 띄워도 충돌하지 않습니다." },
        { at: "embedding_model: str = \"text-embedding-3-small\"", text: "OpenAI 임베딩 모델 이름입니다. 1536차원 벡터를 만들며, 챗봇 질의 임베딩과 같은 모델이어야 검색이 됩니다(neo4j 예제의 Ollama 4096차원과 다름)." },
        { at: "groq_reasoning_effort: str = \"low\"", text: "gpt-oss는 답하기 전에 '추론'에 토큰을 씁니다. low로 낮춰 추론 토큰을 줄이지 않으면, 추론이 출력 한도를 잡아먹어 엔티티가 0개로 추출되는 실측 버그가 생깁니다." },
        { at: "groq_max_tokens: int = 8000", text: "한 번에 생성할 수 있는 토큰 한도를 넉넉히 줍니다. 추출 결과(엔티티·관계 JSON)가 길이 제한에 걸려 잘리지 않게 하는 안전장치입니다." },
        { at: "\"Concept\", \"Requirement\", \"Procedure\", \"Right\", \"Organization\", \"Person\", \"Document\",", text: "특허법 도메인 엔티티 타입 목록입니다. 요건(Requirement)·절차(Procedure)·권리(Right)처럼 법령에 맞는 타입을 영어로 지정합니다. 한글로 쓰면 추출이 조용히 실패합니다." },
        { at: "if self.hands_on_env.exists():", text: "hands-on/.env 파일이 있으면 GROQ_API_KEY·OPENAI_API_KEY 등을 로드합니다. API 키를 코드에 직접 쓰지 않아도 됩니다." }
      ],
      code: `@dataclass  # 설정을 구조화된 객체로 관리해 타입 안정성과 IDE 자동완성을 제공함
class Settings:
    """인덱싱 전역 설정 (경로 + Neo4j + Groq + OpenAI 임베딩)"""

    # --- 경로 (모두 __file__ 기준 자동 도출) ---
    indexing_dir: Path = field(default_factory=lambda: _INDEXING_DIR)
    simple_root: Path = field(default_factory=lambda: _SIMPLE_ROOT)
    workspace_root: Path = field(default_factory=lambda: _WORKSPACE_ROOT)
    # 데이터소스: 특허법 PDF (10.rag 예제와 공유하는 원본 문서)
    pdf_path: Path = field(default_factory=lambda: _HANDS_ON_DIR / "10.rag" / "data" / "특허법.pdf")
    store_dir: Path = field(default_factory=lambda: _SIMPLE_ROOT / "store" / "neo4j")
    # 공용 .env (GROQ_API_KEY·OPENAI_API_KEY 등): hands-on/.env
    hands_on_env: Path = field(default_factory=lambda: _HANDS_ON_DIR / ".env")

    # --- Neo4j 연결 설정 (14.graphrag/neo4j 예제와 포트 분리: 7688) ---
    neo4j_uri: str = "bolt://localhost:7688"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "password"

    # --- OpenAI 임베딩 설정 (agentic-rag 챗봇과 동일 모델) ---
    # text-embedding-3-small: 1536차원. 인덱싱과 질의 임베딩의 모델·차원이 일치해야 검색이 동작함
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536

    # --- Groq LPU LLM 설정 (OpenAI 호환 API) ---
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model: str = "openai/gpt-oss-120b"
    groq_timeout: int = 60
    groq_max_retries: int = 1
    # gpt-oss는 추론(reasoning) 토큰을 소비하는 모델이라, 추론이 길면 함수호출 출력이 길이 제한에 걸려
    # 추출이 0개가 됨(실측). reasoning_effort="low" + max_completion_tokens 상향으로 잘림을 막음.
    groq_reasoning_effort: str = "low"
    groq_max_tokens: int = 8000

    # --- KG 구축 설정 ---
    chunk_size: int = 800
    chunk_overlap: int = 120
    batch_size: int = 10
    # 도메인 온톨로지(영어 필수) — 한국어로 지정하면 strict_mode 필터링에서 Silent Failure 발생
    allowed_nodes: list = field(default_factory=lambda: [
        "Concept", "Requirement", "Procedure", "Right", "Organization", "Person", "Document",
    ])
    allowed_relationships: list = field(default_factory=lambda: [
        "REQUIRES", "DEFINES", "APPLIES_TO", "GRANTS", "REFERS_TO", "PART_OF", "PRECEDES",
    ])
    strict_mode: bool = False
    ignore_tool_usage: bool = False

    def __post_init__(self):
        """공용 .env 로드 후 환경변수로 기본값을 오버라이드함"""
        if self.hands_on_env.exists():
            load_dotenv(self.hands_on_env)
        local_env = self.indexing_dir / ".env"
        if local_env.exists():
            load_dotenv(local_env, override=True)

        # 환경변수가 있으면 우선 적용 (없으면 위의 기본값 유지)
        self.neo4j_uri = os.getenv("NEO4J_URI", self.neo4j_uri)
        self.embedding_model = os.getenv("EMBEDDING_MODEL", self.embedding_model)
        self.groq_api_key = os.getenv("GROQ_API_KEY", self.groq_api_key)
        self.groq_model = os.getenv("GROQ_MODEL", self.groq_model)
        self.groq_reasoning_effort = os.getenv("GROQ_REASONING_EFFORT", self.groq_reasoning_effort)
        (self.indexing_dir / "logs").mkdir(exist_ok=True)`
    },
    {
      id: "fn_load",
      name: "DocumentLoader.load()",
      fileId: "loader",
      summary: "특허법 PDF를 로드·전처리·청킹해 Document 리스트로 반환",
      how: "PyPDFLoader로 PDF를 페이지 단위로 읽고, 각 페이지에서 머리글·바닥글 노이즈를 제거한 뒤 하나의 텍스트로 합칩니다. 그 텍스트를 법령 구조 우선 구분자로 800자씩 자르고, 각 청크에 출처(특허법.pdf)·순번(chunk_index) 메타데이터를 붙입니다.",
      terms: ["PyPDFLoader", "langchain_document", "chunk", "law_separators"],
      lines: [
        { at: "if not pdf_path.exists():", text: "PDF 파일이 없으면 LLM 호출 없이 바로 오류를 냅니다. 경로 설정 실수를 일찍 발견합니다." },
        { at: "pages = PyPDFLoader(str(pdf_path)).load()", text: "PDF를 페이지 단위 Document 목록으로 읽어옵니다. 특허법.pdf는 68페이지입니다." },
        { at: "cleaned_pages = [self._clean_text(page.page_content) for page in pages]", text: "페이지마다 머리글·페이지번호 노이즈를 제거합니다. 다음 줄에서 깨끗한 페이지들을 한 덩어리로 합칩니다." },
        { at: "if not full_text.strip():", text: "텍스트가 하나도 추출되지 않으면(스캔 이미지 PDF 등) 오류를 냅니다. 빈 KG가 만들어지는 것을 막습니다." },
        { at: "chunks = self.splitter.split_text(full_text)", text: "긴 법령 텍스트를 800자 청크로 자릅니다. 법령 구조(조·항)를 우선 경계로 삼아 조문이 중간에서 끊기지 않게 합니다." },
        { at: "\"source\": pdf_path.name,", text: "각 청크의 출처를 '특허법.pdf'로 기록합니다. 검색 결과의 출처 표기와 조항 추출에 쓰입니다." }
      ],
      code: `def load(self) -> list[Document]:
    """특허법 PDF를 로드·전처리·청킹해 Document 리스트로 반환함"""
    pdf_path = self.settings.pdf_path
    if not pdf_path.exists():
        raise FileNotFoundError(f"특허법 PDF를 찾을 수 없음: {pdf_path}")

    # PyPDFLoader(...).load(): PDF를 페이지 단위 Document 리스트로 읽어옴
    pages = PyPDFLoader(str(pdf_path)).load()
    logger.info("PDF 로드: %s (%d페이지)", pdf_path.name, len(pages))

    # 페이지별 추출 텍스트를 합치며 머리글/바닥글 노이즈를 제거함
    cleaned_pages = [self._clean_text(page.page_content) for page in pages]
    full_text = "\\n".join(part for part in cleaned_pages if part)

    # 스캔 PDF(이미지) 등으로 텍스트가 전혀 추출되지 않은 경우를 조기에 감지함
    if not full_text.strip():
        raise ValueError("PDF에서 텍스트를 추출하지 못함 (스캔 이미지 PDF 가능성)")

    chunks = self.splitter.split_text(full_text)
    # metadata 구조: source(파일명) / source_type(law 분류) / chunk_index(원본 내 순서)
    documents = [
        Document(
            page_content=chunk,
            metadata={
                "source": pdf_path.name,
                "source_type": "law",
                "chunk_index": i,
            },
        )
        for i, chunk in enumerate(chunks)
    ]
    logger.info("청킹 완료: %d개 청크 (chunk_size=%d, overlap=%d)",
                len(documents), self.settings.chunk_size, self.settings.chunk_overlap)
    return documents`
    },
    {
      id: "fn_clean_text",
      name: "DocumentLoader._clean_text()",
      fileId: "loader",
      summary: "PDF 추출 텍스트에서 머리글·바닥글·페이지번호 노이즈를 제거",
      how: "법제처 PDF는 페이지마다 '특허법' 머리글, '- 1 -' 페이지번호, '법제처/국가법령정보센터' 바닥글이 반복 삽입됩니다. 이런 반복 텍스트가 그대로 들어가면 검색·추출에 노이즈가 되므로 정규식으로 정리합니다.",
      terms: ["regex", "running_header"],
      lines: [
        { at: "text = re.sub(r\"-\\s*\\d+\\s*-\", \"\", text)", text: "'- 1 -' 형태의 페이지 번호를 지웁니다. 본문 사이에 끼어 검색을 방해하는 숫자를 없앱니다." },
        { at: "noise_keywords = [\"법제처\", \"국가법령정보센터\"]", text: "페이지 바닥글에 반복되는 기관명입니다. 이 단어가 든 줄은 통째로 제거합니다." },
        { at: "if line.strip() == _RUNNING_HEADER:", text: "줄 전체가 '특허법'(머리글)인 줄만 제거합니다. 본문 안에서 다른 글자와 함께 나오는 '특허법'은 남겨 안전합니다." },
        { at: "text = re.sub(r\"\\n{3,}\", \"\\n\\n\", text)", text: "노이즈를 지우며 생긴 과도한 빈 줄을 정리합니다. 3줄 이상 연속된 빈 줄을 2줄로 줄입니다." }
      ],
      code: `@staticmethod
def _clean_text(text: str) -> str:
    """PDF 추출 텍스트에서 머리글·바닥글·페이지 번호 등 노이즈를 제거함"""
    # 페이지 번호 패턴 제거: "- 1 -", "1 / 50" 형식
    text = re.sub(r"-\\s*\\d+\\s*-", "", text)
    text = re.sub(r"\\d+\\s*/\\s*\\d+", "", text)
    lines = text.split("\\n")
    noise_keywords = ["법제처", "국가법령정보센터"]
    cleaned_lines = []
    for line in lines:
        # "법제처 ... 국가법령정보센터" 형식의 페이지 머리글/바닥글 줄 제거
        if any(kw in line for kw in noise_keywords):
            continue
        # 줄 전체가 법령명("특허법")뿐인 반복 머리글 줄 제거
        if line.strip() == _RUNNING_HEADER:
            continue
        cleaned_lines.append(line)
    text = "\\n".join(cleaned_lines)
    # 연속 공백·과도한 빈 줄 정규화
    text = re.sub(r"[ \\t]+", " ", text)
    text = re.sub(r"\\n{3,}", "\\n\\n", text)
    return text.strip()`
    },
    {
      id: "fn_clear_graph",
      name: "Neo4jConnection.clear_graph()",
      fileId: "graph",
      summary: "--force 재인덱싱 시 모든 노드·관계와 벡터 인덱스를 삭제",
      how: "노드를 지워도 벡터 인덱스는 남기 때문에, 차원·내용이 바뀐 채 재사용되면 검색 오류가 납니다. 그래서 노드를 DETACH DELETE로 모두 지운 뒤, entity_embedding·doc_embedding 인덱스도 DROP으로 따로 제거합니다.",
      terms: ["cypher", "detach_delete", "vector_index"],
      lines: [
        { at: "self.graph.query(\"MATCH (n) DETACH DELETE n\")", text: "모든 노드를 삭제합니다. DETACH가 관계를 먼저 끊어주므로, 관계가 연결된 노드도 오류 없이 지워집니다." },
        { at: "for index_name in (\"entity_embedding\", \"doc_embedding\"):", text: "두 벡터 인덱스를 차례로 삭제 대상으로 삼습니다. 노드만 지우면 인덱스 껍데기가 남기 때문입니다." },
        { at: "self.graph.query(f\"DROP INDEX {index_name} IF EXISTS\")", text: "벡터 인덱스를 제거합니다. IF EXISTS 덕분에 인덱스가 없어도 오류 없이 넘어갑니다." }
      ],
      code: `def clear_graph(self) -> None:
    """그래프의 모든 노드·관계·인덱스를 제거함 (--force 재인덱싱용)

    MATCH (n) DETACH DELETE n: 모든 노드와 그에 연결된 관계를 한 번에 삭제함.
    벡터 인덱스는 노드 삭제로 비워지지 않으므로 DROP INDEX로 별도 제거함.
    """
    logger.info("그래프 초기화: 모든 노드·관계 삭제")
    self.graph.query("MATCH (n) DETACH DELETE n")
    # 기존 벡터 인덱스 제거 (차원·내용이 바뀐 채로 재사용되면 검색 오류가 나므로 깨끗이 삭제)
    for index_name in ("entity_embedding", "doc_embedding"):
        try:
            self.graph.query(f"DROP INDEX {index_name} IF EXISTS")
        except Exception as exc:
            logger.warning("인덱스 %s 삭제 실패(무시): %s", index_name, exc)
    logger.info("그래프 초기화 완료")`
    },
    {
      id: "fn_kg_init",
      name: "KGBuilder.__init__()",
      fileId: "kg",
      summary: "Groq LPU를 OpenAI 호환으로 연결하고 LLMGraphTransformer를 초기화 (추론토큰 잘림 방지 설정 포함)",
      how: "ChatOpenAI의 base_url만 Groq로 바꾸면 LLMGraphTransformer가 Groq의 초고속 LPU를 그대로 씁니다. 이 예제의 핵심: reasoning_effort='low'와 max_completion_tokens=8000을 주지 않으면, gpt-oss-120b의 추론 토큰이 출력 한도를 잡아먹어 엔티티가 0개로 추출됩니다(실측 버그).",
      terms: ["groq_lpu", "LLMGraphTransformer", "ignore_tool_usage", "reasoning_effort", "node_properties"],
      lines: [
        { at: "base_url=settings.groq_base_url,", text: "OpenAI API 형식을 그대로 쓰되 서버 주소만 Groq으로 바꿉니다. LLMGraphTransformer는 주소가 바뀐 줄 모르고 동일하게 동작합니다." },
        { at: "reasoning_effort=settings.groq_reasoning_effort,", text: "gpt-oss의 추론 강도를 'low'로 낮춥니다. 이 줄이 없으면 추론에 토큰을 너무 써서 정작 엔티티 출력이 잘려 0개가 됩니다." },
        { at: "max_completion_tokens=settings.groq_max_tokens,", text: "한 번에 생성할 토큰 한도를 8000으로 올립니다. 추출 결과(엔티티·관계 JSON)가 길어도 잘리지 않게 합니다." },
        { at: "transformer_kwargs[\"node_properties\"] = [\"description\"]", text: "함수호출 모드(120b)에서만 description(엔티티 설명)도 함께 추출합니다. 이 설명이 entity_embedding 검색 품질을 높입니다." }
      ],
      code: `def __init__(self, settings: Settings, graph: Neo4jGraph):
    self.settings = settings
    self.graph = graph
    # Groq LPU를 OpenAI 호환 인터페이스로 사용 — base_url·api_key만 Groq로 지정하면
    # LLMGraphTransformer 내부 ChatOpenAI 클라이언트가 그대로 Groq의 초고속 추론(LPU)을 활용함
    self.llm = ChatOpenAI(
        model=settings.groq_model,
        base_url=settings.groq_base_url,
        api_key=settings.groq_api_key,
        temperature=0,              # 결정적 추출(재현성)을 위해 0 고정
        timeout=settings.groq_timeout,
        max_retries=settings.groq_max_retries,
        # reasoning_effort="low": gpt-oss 추론 토큰을 줄여 함수호출 출력이 길이 제한에 걸리지 않게 함
        reasoning_effort=settings.groq_reasoning_effort,
        # max_completion_tokens: 추출 결과(엔티티/관계 JSON)가 잘리지 않도록 완성 토큰 한도를 넉넉히 상향
        max_completion_tokens=settings.groq_max_tokens,
    )

    # LLMGraphTransformer 생성 인자 구성 (allowed_*: 도메인 온톨로지 힌트, strict_mode=False: 재현율 우선)
    transformer_kwargs = dict(
        llm=self.llm,
        allowed_nodes=settings.allowed_nodes,
        allowed_relationships=settings.allowed_relationships,
        strict_mode=settings.strict_mode,
    )
    # node_properties(description 추출)는 함수호출 모드에서만 지원 — ignore_tool_usage와 상호 배타
    supports_ignore = "ignore_tool_usage" in inspect.signature(LLMGraphTransformer.__init__).parameters
    if settings.ignore_tool_usage and supports_ignore:
        transformer_kwargs["ignore_tool_usage"] = True
        logger.info("프롬프트 기반 추출 모드 — node_properties(description) 생략")
    else:
        transformer_kwargs["node_properties"] = ["description"]
    self.transformer = LLMGraphTransformer(**transformer_kwargs)`
    },
    {
      id: "fn_build_async",
      name: "KGBuilder._build_async()",
      fileId: "kg",
      summary: "조문 청크를 배치로 LLM에 보내 엔티티·관계를 추출하고 Neo4j에 저장",
      how: "aconvert_to_graph_documents()가 배치 내 청크를 비동기로 동시에 LLM에 요청해 속도를 높입니다. 한 배치가 스키마 오류로 실패해도(예: 허용 외 관계 타입 생성) 그 배치만 건너뛰고 다음 배치를 계속 처리합니다. 저장 시 baseEntityLabel=True로 공통 라벨을 붙여 벡터 인덱스 생성을 가능하게 합니다.",
      terms: ["LLMGraphTransformer", "cypher", "merge", "async_await", "tqdm"],
      lines: [
        { at: "graph_documents = await self.transformer.aconvert_to_graph_documents(batch)", text: "청크 묶음을 LLM에 비동기로 보내 엔티티와 관계를 추출합니다. 동기 버전보다 5~10배 빠릅니다." },
        { at: "if not extracted_nodes:", text: "추출된 노드가 하나도 없으면 그 배치를 실패로 기록하고 건너뜁니다. reasoning_effort 미설정 시 여기서 전 배치가 실패합니다." },
        { at: "baseEntityLabel=True,", text: "추출된 모든 엔티티에 __Entity__ 라벨을 추가로 붙입니다. 이 공통 라벨이 있어야 from_existing_graph()로 벡터 인덱스를 만들 수 있습니다." },
        { at: "logger.warning(\"청크 %d-%d 변환 실패, 스킵: %s\", start + 1, batch_end, e)", text: "한 배치 실패가 전체를 막지 않도록, 경고만 남기고 다음 배치를 계속합니다. 실측에서 235청크 중 20개가 이렇게 비치명적으로 스킵됐습니다." }
      ],
      code: `async def _build_async(self, documents: list[Document]) -> dict:
    """배치 단위 비동기 변환으로 KG를 구축함"""
    total = len(documents)
    success_count = 0
    fail_count = 0
    extracted_node_total = 0
    batch_starts = list(range(0, total, self.settings.batch_size))

    pbar = tqdm(total=len(batch_starts), desc="KG 구축", unit="batch")

    for start in batch_starts:
        batch = documents[start:start + self.settings.batch_size]
        batch_end = min(start + len(batch), total)

        try:
            # aconvert_to_graph_documents(): 청크들을 비동기로 LLM에 보내 엔티티/관계를 추출
            graph_documents = await self.transformer.aconvert_to_graph_documents(batch)

            # 추출된 노드 집계 — 0개면 LLM이 엔티티를 못 찾았거나 추출 경로가 실패한 것
            extracted_nodes = [n for doc in graph_documents for n in doc.nodes]
            if not extracted_nodes:
                logger.warning("청크 %d-%d: 엔티티 0개 추출", start + 1, batch_end)
                fail_count += len(batch)
                continue
            extracted_node_total += len(extracted_nodes)

            # baseEntityLabel=True: __Entity__ 공통 라벨 부여(벡터 인덱스 필수)
            # include_source=True: 출처 문서 연결(검색 결과 출처 추적)
            self.graph.add_graph_documents(
                graph_documents,
                baseEntityLabel=True,
                include_source=True,
            )
            success_count += len(batch)
        except Exception as e:
            # 한 배치 실패가 전체를 막지 않도록 스킵하고 다음 배치 계속 진행 (WARNING 로그)
            logger.warning("청크 %d-%d 변환 실패, 스킵: %s", start + 1, batch_end, e)
            fail_count += len(batch)
        finally:
            pbar.update(1)

    pbar.close()
    # 엔티티 노드에 벡터 검색용 text 속성 설정 (Neo4jVector가 임베딩 대상 텍스트로 요구)
    self._set_entity_text()
    return {"success": success_count, "fail": fail_count, "extracted_nodes": extracted_node_total}`
    },
    {
      id: "fn_entity_vector_index",
      name: "VectorIndexManager.create_entity_vector_index()",
      fileId: "vector",
      summary: "Neo4j에 이미 있는 엔티티 노드에 OpenAI 임베딩을 추가해 entity_embedding 인덱스 생성",
      how: "from_existing_graph()는 이미 저장된 __Entity__ 노드에서 id와 description을 읽어 OpenAI로 임베딩하고, 각 노드의 embedding 속성에 1536차원 벡터를 저장합니다. 검색할 때 질문을 같은 모델로 임베딩해 가장 가까운 엔티티를 찾는 '그래프 탐색의 진입점'이 됩니다.",
      terms: ["neo4j_vector", "openai_embedding", "entity_embedding"],
      lines: [
        { at: "self.embeddings = OpenAIEmbeddings(model=settings.embedding_model)", text: "OpenAI 임베딩 객체를 만듭니다. OPENAI_API_KEY 환경변수를 자동으로 읽어 1536차원 벡터를 생성합니다." },
        { at: "node_label=\"__Entity__\",", text: "모든 엔티티 노드를 타입(Requirement, Procedure 등)에 상관없이 한 번에 대상으로 삼습니다. 공통 라벨 덕분에 가능합니다." },
        { at: "text_node_properties=[\"id\", \"description\"],", text: "엔티티 이름(id)과 설명(description)을 합친 텍스트가 임베딩 입력이 됩니다. 설명이 있을수록 검색 정확도가 높아집니다." },
        { at: "index_name=\"entity_embedding\",", text: "이 인덱스 이름으로 챗봇이 검색합니다. doc_embedding과 이름이 달라 두 인덱스를 혼동 없이 따로 씁니다." }
      ],
      code: `def __init__(self, settings: Settings):
    self.settings = settings
    # text-embedding-3-small(1536차원) — 인덱스 차원과 질의 임베딩 차원이 일치해야 검색이 동작함
    self.embeddings = OpenAIEmbeddings(model=settings.embedding_model)

def create_entity_vector_index(self) -> Neo4jVector:
    """entity_embedding: 특허법 엔티티의 id+description 임베딩 인덱스 생성

    from_existing_graph(): 이미 Neo4j에 저장된 노드를 대상으로 임베딩과 벡터 인덱스를 추가함.
    → 벡터 검색으로 진입 엔티티를 찾고, 그 엔티티에서 그래프를 확장 탐색하는 하이브리드 검색의 기반
    """
    logger.info("entity_embedding 벡터 인덱스 생성 중...")
    vector_store = Neo4jVector.from_existing_graph(
        embedding=self.embeddings,
        url=self.settings.neo4j_uri,
        username=self.settings.neo4j_user,
        password=self.settings.neo4j_password,
        index_name="entity_embedding",
        node_label="__Entity__",
        text_node_properties=["id", "description"],
        embedding_node_property="embedding",
    )
    logger.info("entity_embedding 벡터 인덱스 생성 완료")
    return vector_store`
    },
    {
      id: "fn_doc_vector_index",
      name: "VectorIndexManager.create_doc_vector_index()",
      fileId: "vector",
      summary: "조문 청크를 Chunk 노드로 저장하고 doc_embedding 인덱스 생성",
      how: "from_documents()는 Document 목록을 Neo4j에 Chunk 노드로 새로 만들고 OpenAI로 임베딩합니다. KG 엔티티와 별도 노드라 검색 대상이 섞이지 않습니다. metadata(source·chunk_index)가 노드 속성으로 저장되어 '제29조' 같은 조항 출처를 추적할 수 있습니다.",
      terms: ["neo4j_vector", "chunk", "doc_embedding", "openai_embedding"],
      lines: [
        { at: "documents=documents,", text: "특허법 조문 청크 목록입니다. 이 Document들이 Neo4j에 Chunk 노드로 하나씩 저장되고 임베딩됩니다." },
        { at: "index_name=\"doc_embedding\",", text: "조문 원문 검색용 인덱스 이름입니다. 챗봇이 '특허 요건은?' 같은 질문을 이 인덱스로 조문 청크에 매칭합니다." }
      ],
      code: `def create_doc_vector_index(self, documents: list[Document]) -> Neo4jVector:
    """doc_embedding: 특허법 조문 청크 텍스트 임베딩 인덱스 생성

    from_documents(): Document 리스트를 Neo4j에 신규 노드(기본 라벨 Chunk)로 만들고 임베딩함.
    - 교재 엔티티(KG)와 분리된 별도 Chunk 노드라 검색 대상이 섞이지 않음
    - metadata(source, source_type, chunk_index)가 노드 속성으로 저장되어 출처 추적 가능
    """
    logger.info("doc_embedding 벡터 인덱스 생성 중 (%d개 청크)...", len(documents))
    vector_store = Neo4jVector.from_documents(
        documents=documents,
        embedding=self.embeddings,
        url=self.settings.neo4j_uri,
        username=self.settings.neo4j_user,
        password=self.settings.neo4j_password,
        index_name="doc_embedding",
    )
    logger.info("doc_embedding 벡터 인덱스 생성 완료")
    return vector_store`
    },
    {
      id: "fn_main",
      name: "main()",
      fileId: "main",
      summary: "PDF 로드 → KG 구축 → 이중 벡터 인덱스 생성 → 통계 출력 전체 흐름 조율",
      how: "각 모듈을 순서대로 호출해 파이프라인을 완성합니다. Phase 1(KG 구축)과 Phase 2(벡터 인덱스)로 나눠, Phase 1 결과물인 엔티티에 Phase 2에서 OpenAI 임베딩을 추가합니다. --mode test면 앞 20개 청크만 처리합니다.",
      terms: ["async_await", "LLMGraphTransformer", "neo4j_vector"],
      lines: [
        { at: "documents = loader.load_specific(_TEST_CHUNK_LIMIT)", text: "--mode test일 때 앞 20개 청크만 로드합니다. LLM 비용을 아끼며 빠르게 동작을 확인합니다." },
        { at: "connection.clear_graph()", text: "--force일 때 기존 그래프와 인덱스를 모두 지우고 처음부터 다시 만듭니다." },
        { at: "kg_builder = KGBuilder(settings, connection.graph)", text: "KG 구축기에 설정과 Neo4j 연결을 주입합니다. 이때 Groq LLM과 LLMGraphTransformer가 초기화됩니다." },
        { at: "connection.clear_doc_chunks()", text: "기존 Chunk 노드를 먼저 지웁니다. --force 없이 재실행해도 조문 청크가 중복 누적되지 않습니다." },
        { at: "if documents and kg_result[\"extracted_nodes\"] == 0:", text: "청크를 처리했는데 엔티티가 0개면 추출 경로 문제(reasoning_effort 미설정·GROQ_API_KEY 등)라는 신호입니다. 명확한 ERROR를 남깁니다." }
      ],
      code: `def main() -> None:
    """문서 로드 → KG 구축 → 이중 벡터 인덱스 생성 → 통계 출력"""
    args = parse_args()

    # 1. 설정 로드 + 경로 검증 (LLM/Neo4j 호출 전에 경로부터 확인)
    settings = Settings()
    log_resolved_paths(settings)

    # 2. 문서 로드 (cheap 단계 — LLM 호출 없음)
    loader = DocumentLoader(settings)
    if args.mode == "test":
        documents = loader.load_specific(_TEST_CHUNK_LIMIT)
    else:
        documents = loader.load()

    # 3. Neo4j 연결 (재시도 백오프 포함)
    connection = Neo4jConnection(settings)

    # 4. --force면 그래프 전체 초기화
    if args.force:
        connection.clear_graph()

    # 5. 엔티티 id 유니크 제약조건 생성 (MERGE 중복 방지 + 성능)
    connection.create_indexes()

    # 6. [Phase 1] KG 구축 (조문 청크) — LLM 추출 단계
    kg_result = {"extracted_nodes": 0, "success": 0, "fail": 0}
    if documents:
        kg_builder = KGBuilder(settings, connection.graph)
        kg_result = kg_builder.build_from_documents(documents)

    # 7. [Phase 2] 벡터 인덱스 생성
    vector_manager = VectorIndexManager(settings)
    try:
        vector_manager.create_entity_vector_index()
    except Exception as e:
        logger.warning("entity_embedding 인덱스 생성 실패: %s", e)
    if documents:
        # 기존 Chunk 노드를 먼저 비워 재실행에서도 중복 누적을 방지 (idempotent)
        connection.clear_doc_chunks()
        vector_manager.create_doc_vector_index(documents)

    # 8. 최종 통계 + 완료 판정 (성공 기준은 'exit 0'이 아니라 '비어있지 않은 KG')
    stats = connection.get_stats()
    logger.info("[통계] 노드 %d개 / 관계 %d개", stats["node_count"], stats["relationship_count"])
    if documents and kg_result["extracted_nodes"] == 0:
        logger.error("인덱싱 경고: 추출 엔티티 0개. GROQ_API_KEY·모델(gpt-oss-120b 함수호출)을 확인하세요.")
    else:
        logger.info("인덱싱 완료!")`
    }
  ],
  glossary: {
    "LLMGraphTransformer":  "텍스트를 LLM에 보내 (주체, 관계, 대상) 삼중쌍을 추출하는 LangChain 도구입니다. 특허법 조문에서 '특허는 제29조(특허요건)를 적용받는다' 같은 관계를 찾아 그래프 노드와 엣지로 만듭니다.",
    "neo4j_vector":         "LangChain의 Neo4jVector — Neo4j를 벡터 저장소처럼 쓸 수 있게 해주는 래퍼입니다. 임베딩 저장·벡터 인덱스 생성·유사도 검색을 지원합니다.",
    "entity_embedding":     "KG의 __Entity__ 노드에 추가한 벡터 인덱스입니다. '질문과 가장 비슷한 개념 찾기'에 사용합니다. 찾은 엔티티에서 그래프를 확장 탐색하는 하이브리드 검색의 출발점입니다.",
    "doc_embedding":        "특허법 조문 청크를 Chunk 노드로 저장한 벡터 인덱스입니다. '특허 요건은?' 같은 질문을 조문 원문에 직접 매칭할 때 씁니다.",
    "openai_embedding":     "OpenAI의 text-embedding-3-small 모델 — 텍스트를 1536차원 벡터로 바꿉니다. 이 예제는 챗봇 질의와 임베딩을 통일하려고 OpenAI를 씁니다(neo4j 예제의 로컬 Ollama 4096차원과 다름). 인덱싱과 질의의 모델·차원이 같아야 검색됩니다.",
    "reasoning_effort":     "gpt-oss 같은 추론형 모델이 답하기 전 '생각'에 얼마나 토큰을 쓸지 정하는 옵션입니다. low로 낮추지 않으면 추론이 출력 한도를 잡아먹어 엔티티 추출 결과가 잘려 0개가 되는 실측 버그가 있습니다.",
    "node_properties":      "LLMGraphTransformer가 엔티티에서 추가로 뽑을 속성 목록입니다. ['description']을 주면 엔티티 설명까지 추출해 검색 품질을 높입니다. 단 네이티브 함수호출 모드에서만 지원됩니다.",
    "ignore_tool_usage":    "추출 경로 선택 옵션입니다. False(기본)이면 네이티브 함수호출로 description까지 추출하고, True이면 프롬프트 기반으로 추출합니다. gpt-oss-20b처럼 함수호출이 불안정한 모델은 True로 설정합니다.",
    "cypher":               "Neo4j 전용 그래프 질의 언어입니다. MATCH (a)-[r]->(b) 형태로 노드와 관계를 조회하고, MERGE로 중복 없이 노드를 만듭니다.",
    "merge":                "Cypher의 MERGE — 이미 있으면 찾고 없으면 만드는 명령입니다. 같은 이름의 엔티티가 여러 청크에서 나와도 노드가 하나만 생깁니다.",
    "detach_delete":        "Cypher의 DETACH DELETE — 노드에 연결된 관계를 먼저 끊고 노드를 삭제합니다. 관계가 남아 있는 노드를 그냥 DELETE하면 오류가 나므로 DETACH를 씁니다.",
    "vector_index":         "벡터(임베딩)들 사이에서 '가장 비슷한 것'을 빠르게 찾도록 만든 색인입니다. Neo4j 5.11+에서 db.index.vector.queryNodes로 검색합니다.",
    "groq_lpu":             "Groq사의 LPU(Language Processing Unit) — GPU보다 LLM 추론이 빠른 전용 칩입니다. OpenAI API와 호환되는 엔드포인트를 제공해 base_url만 바꿔 사용합니다.",
    "PyPDFLoader":          "LangChain의 PDF 로더 — PDF를 페이지 단위 Document로 읽어옵니다. 각 Document에 원본 경로·페이지 번호가 메타데이터로 담깁니다.",
    "law_separators":       "법령 구조를 우선 보존하는 텍스트 분할 구분자 목록입니다. '제○조'·'①②③'를 앞 순위 경계로 삼아, 조문이 청크 중간에서 잘리지 않게 합니다.",
    "running_header":       "PDF 모든 페이지 위쪽에 반복 삽입되는 머리글입니다(여기서는 '특허법'). 검색 노이즈가 되므로 줄 전체가 머리글인 경우만 골라 제거합니다.",
    "regex":                "정규표현식 — 글자 패턴을 찾고 바꾸는 문법입니다. re.sub(패턴, 치환, 텍스트)로 '- 1 -' 같은 페이지 번호를 한 번에 지웁니다.",
    "async_await":          "파이썬의 비동기 키워드입니다. async def로 비동기 함수를 정의하고 await로 결과를 기다립니다. LLM 호출처럼 오래 걸리는 작업 여러 개를 동시에 진행해 전체 시간을 줄입니다.",
    "chunk":                "긴 텍스트를 일정 크기로 자른 조각입니다. LLM이 한 번에 처리할 길이 제한이 있고, 작은 조각일수록 엔티티 추출 정확도가 높아집니다.",
    "langchain_document":   "LangChain의 Document 객체 — page_content(텍스트)와 metadata(사전)로 구성됩니다. LLMGraphTransformer와 Neo4jVector가 공통으로 쓰는 표준 입력 형식입니다.",
    "tqdm":                 "터미널에 진행률 막대를 표시하는 라이브러리입니다. 수십 배치를 처리하는 동안 진행 상황을 실시간으로 보여줍니다.",
    "dataclass":            "@dataclass 데코레이터 — 클래스의 __init__ 등을 자동 생성합니다. 설정처럼 데이터를 담는 클래스를 간결하게 만들 때 씁니다.",
    "dotenv":               "python-dotenv 라이브러리 — .env 파일의 KEY=VALUE를 읽어 환경변수로 등록합니다. API 키를 코드에 직접 쓰지 않고 파일로 관리합니다.",
    "pathlib":              "파이썬 표준 경로 관리 도구입니다. Path 객체는 / 연산자로 경로를 이어 붙이고 .exists() 같은 메서드를 제공합니다.",
    "ontology":             "도메인의 '개체 타입·관계 타입' 사전입니다. 이 예제는 특허법에 맞춰 Requirement(요건)·Procedure(절차)·Right(권리) 등을 정의해 LLM 추출을 안내합니다."
  }
};
