window.EXPLAIN_DATA = {
  meta: { title: "LangChain + Neo4j GraphRAG 인덱싱 파이프라인", entry: "index_documents.py" },
  files: [
    { id: "main",     label: "index_documents.py",           role: "전체 파이프라인 진입점 — 설정·로드·KG 구축·벡터 인덱스를 순서대로 조율" },
    { id: "settings", label: "config/settings.py",           role: "Neo4j·Groq·Ollama·경로 전역 설정 — .env 로드 및 환경변수 오버라이드" },
    { id: "loader",   label: "document_loader.py",           role: "교재(.md)·예제코드(.py)를 LangChain Document로 로드·청킹" },
    { id: "graph",    label: "graph/neo4j_connection.py",    role: "Neo4j 연결·제약조건·초기화·통계 조회 — 재시도 백오프 포함" },
    { id: "kg",       label: "kg_builder.py",                role: "LLMGraphTransformer로 교재 → 엔티티·관계 추출 → Neo4j KG 저장" },
    { id: "vector",   label: "vector_index.py",              role: "Neo4jVector로 엔티티·문서 청크 임베딩 벡터 인덱스 생성" }
  ],
  flow: [
    { step: 1, title: "설정 로드",         label: "설정 로드",         refs: ["fn_settings"], summary: "Settings가 경로·API 키·모델 정보를 초기화함",           detail: "config/settings.py의 Settings 클래스가 __file__ 위치 기준으로 모든 경로를 자동 계산하고 hands-on/.env에서 GROQ_API_KEY 등 민감 정보를 읽습니다. 실행 위치와 무관하게 경로가 항상 정확합니다." },
    { step: 2, title: "문서 로드",         label: "문서 로드",         refs: ["fn_load_for_kg", "fn_load_single_file", "fn_load_python"], summary: "교재는 KG·Vector 양쪽, 예제코드는 Vector만 로드함",    detail: "DocumentLoader가 교재(마크다운)와 예제코드(파이썬)를 분리해 청킹합니다. 교재는 개념 관계가 풍부해 KG 구축 대상이 되고, 예제코드는 절차적이라 벡터 인덱스에만 들어갑니다." },
    { step: 3, title: "Neo4j 연결",       label: "Neo4j 연결",        refs: ["fn_connect_with_retry"], summary: "컨테이너 지연을 고려해 지수 백오프로 3회 재시도함",      detail: "Docker 컨테이너가 완전히 뜨기 전에 연결하면 실패합니다. 1초→2초→4초로 대기 시간을 늘리며 최대 3회 재시도해 일시 장애를 흡수합니다." },
    { step: 4, title: "KG 구축",          label: "KG 구축",           refs: ["fn_kg_init", "fn_build_async"], summary: "LLMGraphTransformer가 교재 청크에서 엔티티·관계를 추출함", detail: "Groq LPU의 gpt-oss-120b 모델이 교재 텍스트를 읽고 (주체, 관계, 대상) 삼중쌍을 뽑습니다. 추출된 노드와 엣지는 Neo4j에 MERGE로 저장되어 중복이 생기지 않습니다." },
    { step: 5, title: "벡터 인덱스 생성", label: "벡터 인덱스 생성",  refs: ["fn_entity_vector_index", "fn_doc_vector_index"], summary: "Neo4j 안에 entity_embedding과 doc_embedding 두 인덱스를 생성함", detail: "entity_embedding은 KG 엔티티 노드에 Ollama 임베딩을 추가해 의미 검색 진입점으로 쓰고, doc_embedding은 교재·코드 원문 청크를 Chunk 노드로 저장해 원문 단위 검색을 지원합니다." },
    { step: 6, title: "통계 확인",        label: "통계 확인",         summary: "노드·관계 수를 출력해 인덱싱 성공 여부를 판정함",        detail: "엔티티 추출 수가 0이면 LLM 추출 경로에 문제가 있다는 명확한 경고를 냅니다. 정상이면 '인덱싱 완료!'를 출력합니다." }
  ],
  functions: [
    {
      id: "fn_settings",
      name: "Settings",
      fileId: "settings",
      summary: "Neo4j·Groq·Ollama·경로를 하나의 설정 객체에 모아 관리",
      how: "@dataclass가 __init__을 자동 생성합니다. __post_init__에서 .env를 읽어 API 키를 주입합니다. 모든 경로는 __file__ 위치 기준으로 자동 계산되어 어느 디렉터리에서 실행해도 동일하게 동작합니다.",
      terms: ["dataclass", "dotenv", "pathlib", "groq_lpu", "ollama"],
      lines: [
        { at: "textbook_dir: Path = field(default_factory=lambda: _WORKSPACE_ROOT / \"agentic-ai\" / \"textbook\")", text: "교재 폴더 경로입니다. 이 파일(__file__) 위치를 기준으로 자동 계산되어 어디서 실행해도 올바른 경로를 가집니다." },
        { at: "embedding_model: str = \"qwen3-embedding\"", text: "로컬 Ollama에서 실행하는 임베딩 모델 이름입니다. 4096차원 벡터를 만들며, 벡터 인덱스 차원 설정과 반드시 일치해야 합니다." },
        { at: "ignore_tool_usage: bool = False", text: "False이면 네이티브 함수호출(tool calling) 경로로 엔티티를 추출합니다. gpt-oss-20b처럼 함수호출이 불안정한 모델은 True로 바꿔 프롬프트 기반 추출로 전환합니다." },
        { at: "if self.hands_on_env.exists():", text: "hands-on/.env 파일이 있으면 GROQ_API_KEY 등을 로드합니다. API 키를 코드에 직접 쓰지 않아도 됩니다." },
        { at: "self.groq_api_key = os.getenv(\"GROQ_API_KEY\", self.groq_api_key)", text: "환경변수 GROQ_API_KEY가 있으면 그 값을 사용하고, 없으면 .env에서 읽은 값을 유지합니다." }
      ],
      code: `@dataclass  # 설정을 구조화된 객체로 관리해 타입 안정성과 IDE 자동완성을 제공함
class Settings:
    """인덱싱 전역 설정 (경로 + Neo4j + Groq + Ollama)"""

    # --- 경로 (모두 __file__ 기준 자동 도출) ---
    # field(default_factory=...): 가변 기본값(Path)이 인스턴스 간 공유되지 않도록 인스턴스마다 새로 생성함
    indexing_dir: Path = field(default_factory=lambda: _INDEXING_DIR)
    neo4j_root: Path = field(default_factory=lambda: _NEO4J_ROOT)
    workspace_root: Path = field(default_factory=lambda: _WORKSPACE_ROOT)
    # 교재(KG + Vector 인덱싱 대상): agentic-ai/textbook/*.md
    textbook_dir: Path = field(default_factory=lambda: _WORKSPACE_ROOT / "agentic-ai" / "textbook")
    # 예제코드(Vector 인덱싱 대상): hands-on/**/*.py
    examples_dir: Path = field(default_factory=lambda: _HANDS_ON_DIR)
    # Neo4j Docker 볼륨 마운트 루트 (검증·안내용, 실제 마운트는 docker-compose.yml이 담당)
    store_dir: Path = field(default_factory=lambda: _NEO4J_ROOT / "store" / "neo4j")
    # 공용 .env (GROQ_API_KEY 등): hands-on/.env
    hands_on_env: Path = field(default_factory=lambda: _HANDS_ON_DIR / ".env")

    # --- Neo4j 연결 설정 (docker-compose.yml 기본값과 일치) ---
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "password"

    # --- Ollama 임베딩 설정 ---
    ollama_base_url: str = "http://localhost:11434"
    # qwen3-embedding: 4096차원 로컬 임베딩 모델 (Ollama). 벡터 인덱스 차원과 반드시 일치해야 함
    embedding_model: str = "qwen3-embedding"
    embedding_dim: int = 4096

    # --- Groq LPU LLM 설정 (OpenAI 호환 API) ---
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    # Groq LPU에서 서빙하는 OpenAI gpt-oss 120B 모델 (LLMGraphTransformer의 엔티티/관계 추출용)
    groq_model: str = "openai/gpt-oss-120b"
    # Groq API 타임아웃(초) + 재시도 횟수 (네트워크 지연 대응)
    groq_timeout: int = 60
    groq_max_retries: int = 1

    # --- KG 구축 설정 ---
    # 청크 크기: LLMGraphTransformer는 작은 청크에서 추출 정확도가 높음 (800자 권장)
    chunk_size: int = 800
    # 청크 간 100자 중복으로 경계에서 잘린 개념의 문맥 연속성 유지
    chunk_overlap: int = 100
    # 배치 크기: 문서를 10건 단위로 비동기 변환 (메모리·요청 수 제어)
    batch_size: int = 10
    # 도메인 온톨로지(영어 필수) — LLMGraphTransformer 내부 프롬프트가 영어라 LLM이 영어 타입을 반환함.
    # 한국어로 지정하면 strict_mode 필터링에서 Silent Failure 발생
    allowed_nodes: list = field(default_factory=lambda: [
        "Concept", "Technology", "Framework", "Library", "Model", "Tool", "Task",
    ])
    allowed_relationships: list = field(default_factory=lambda: [
        "USES", "DEPENDS_ON", "IMPLEMENTS", "CONTAINS", "COMPARES", "EXTENDS", "PROVIDES",
    ])
    # strict_mode=False: allowed_* 목록을 힌트로만 사용해 그 외 엔티티/관계도 허용 (재현율 우선)
    strict_mode: bool = False
    # ignore_tool_usage=False: 네이티브 함수호출(tool calling) 경로로 추출 (node_properties 지원).
    ignore_tool_usage: bool = False

    def __post_init__(self):
        """공용 .env 로드 후 환경변수로 기본값을 오버라이드함"""
        # hands-on/.env에서 GROQ_API_KEY 등 민감 정보 로드 (코드에 키 하드코딩 방지)
        if self.hands_on_env.exists():
            load_dotenv(self.hands_on_env)
        # 인덱싱 디렉터리에 .env가 따로 있으면 추가 로드 (Neo4j 접속정보 등 로컬 오버라이드용)
        local_env = self.indexing_dir / ".env"
        if local_env.exists():
            load_dotenv(local_env, override=True)

        # 환경변수가 있으면 우선 적용 (없으면 위의 기본값 유지)
        self.neo4j_uri = os.getenv("NEO4J_URI", self.neo4j_uri)
        self.neo4j_user = os.getenv("NEO4J_USER", self.neo4j_user)
        self.neo4j_password = os.getenv("NEO4J_PASSWORD", self.neo4j_password)
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", self.ollama_base_url)
        self.embedding_model = os.getenv("EMBEDDING_MODEL", self.embedding_model)
        self.groq_api_key = os.getenv("GROQ_API_KEY", self.groq_api_key)
        self.groq_base_url = os.getenv("GROQ_BASE_URL", self.groq_base_url)
        self.groq_model = os.getenv("GROQ_MODEL", self.groq_model)

        # logs 디렉터리 생성 (인덱싱 로그 파일 출력 위치)
        (self.indexing_dir / "logs").mkdir(exist_ok=True)`
    },
    {
      id: "fn_load_for_kg",
      name: "DocumentLoader.load_for_kg()",
      fileId: "loader",
      summary: "KG 구축용으로 교재(마크다운)만 로드",
      how: "교재는 '개념 A는 개념 B를 포함한다'처럼 관계 서술이 풍부해 LLMGraphTransformer의 엔티티·관계 추출 효과가 큽니다. 예제코드는 절차적이라 KG 대상에서 제외합니다.",
      terms: ["LLMGraphTransformer", "rglob", "langchain_document"],
      lines: [
        { at: "if not self.settings.textbook_dir.exists():", text: "교재 폴더가 없으면 LLM 호출 없이 바로 빈 목록을 반환합니다. 경로 설정 오류를 조기에 발견할 수 있습니다." },
        { at: "docs = self._load_markdown(self.settings.textbook_dir, \"교재\")", text: "교재 폴더 안의 .md 파일을 모두 찾아 청크 단위 Document 목록으로 변환합니다." },
        { at: "logger.info(\"KG 인덱싱용 교재 문서 %d개 청크 로드\", len(docs))", text: "로드된 청크 수를 로그로 남겨, 0이면 경로 오류임을 즉시 알 수 있게 합니다." }
      ],
      code: `def load_for_kg(self) -> list[Document]:
    """KG 인덱싱 대상: 교재(마크다운)만 로드

    교재는 "RAG는 LLM의 한계를 보완"처럼 개념 간 관계 서술이 풍부해
    LLMGraphTransformer로 엔티티(개념)·관계를 추출하면 멀티홉 추론용 지식 그래프를 만들 수 있음.
    """
    if not self.settings.textbook_dir.exists():
        logger.warning("교재 디렉토리 없음: %s", self.settings.textbook_dir)
        return []
    docs = self._load_markdown(self.settings.textbook_dir, "교재")
    logger.info("KG 인덱싱용 교재 문서 %d개 청크 로드", len(docs))
    return docs`
    },
    {
      id: "fn_load_single_file",
      name: "DocumentLoader._load_single_file()",
      fileId: "loader",
      summary: "파일 하나를 읽어 청크 단위 Document 리스트로 변환",
      how: "파일 전체를 읽고 RecursiveCharacterTextSplitter로 의미 단위로 자릅니다. 각 청크에 source, source_type, chunk_index 메타데이터를 붙여 나중에 검색 결과의 출처를 추적할 수 있게 합니다.",
      terms: ["chunk", "langchain_document", "dirs_prune"],
      lines: [
        { at: "content = file_path.read_text(encoding=\"utf-8\")", text: "파일을 UTF-8로 읽습니다. 한글 교재가 깨지지 않도록 인코딩을 명시합니다." },
        { at: "content = file_path.read_text(encoding=\"utf-8\", errors=\"ignore\")", text: "UTF-8 디코딩에 실패한 글자는 무시하고 읽습니다. cp949 등 다른 인코딩 파일도 대부분 읽을 수 있습니다." },
        { at: "chunks = self.splitter.split_text(content)", text: "긴 텍스트를 800자 단위로 자릅니다. LLMGraphTransformer는 청크가 작을수록 엔티티 추출 정확도가 높습니다." },
        { at: "\"chunk_index\": i,", text: "이 청크가 원본 파일의 몇 번째 조각인지 기록합니다. 검색 결과에서 원문의 어느 부분인지 알 수 있습니다." }
      ],
      code: `def _load_single_file(self, file_path: Path, source_type: str) -> list[Document]:
    """단일 파일을 읽어 청크 단위 Document 리스트로 변환함"""
    try:
        content = file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        # 일부 파일은 cp949 등 다른 인코딩일 수 있어 폴백 (에러 무시하고 utf-8로 읽음)
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        logger.warning("파일 로드 실패 %s: %s", file_path.name, e)
        return []

    if not content.strip():
        return []

    chunks = self.splitter.split_text(content)
    # metadata 구조: source(파일명, 출처 추적) / source_type(교재·예제코드 분류) / chunk_index(원본 내 순서)
    return [
        Document(
            page_content=chunk,
            metadata={
                "source": file_path.name,
                "source_type": source_type,
                "chunk_index": i,
            },
        )
        for i, chunk in enumerate(chunks)
    ]`
    },
    {
      id: "fn_load_python",
      name: "DocumentLoader._load_python()",
      fileId: "loader",
      summary: "venv·캐시 폴더를 제외하고 .py 파일만 수집",
      how: "os.walk()로 폴더를 순회하면서 dirs[:] 가지치기 기법으로 venv처럼 수천 개의 외부 라이브러리 파일이 있는 폴더에 아예 들어가지 않습니다. rglob보다 훨씬 빠릅니다.",
      terms: ["dirs_prune", "os_walk"],
      lines: [
        { at: "dirs[:] = [d for d in dirs if d not in _EXCLUDE_DIR_PARTS]", text: "venv, __pycache__ 등 불필요한 폴더를 목록에서 제거합니다. os.walk()는 이 목록을 보고 탐색할 하위 폴더를 결정하므로, 이 줄이 있으면 venv 안으로 절대 들어가지 않습니다." },
        { at: "if name.endswith(\".py\"):", text: ".py 확장자 파일만 수집합니다. 이미지, 설정 파일 등은 제외됩니다." }
      ],
      code: `def _load_python(self, dir_path: Path, source_type: str) -> list[Document]:
    """디렉터리 하위 모든 .py 파일을 로드·청킹함 (가상환경·캐시 디렉터리는 탐색 자체를 생략)"""
    # os.walk + dirs[:] in-place 가지치기: rglob과 달리 제외 디렉터리로 '내려가지 않음'.
    # 예제마다 있는 venv(수천 파일)를 통째로 건너뛰어 전체 모드 파일 열거 속도를 크게 높임.
    py_files: list[Path] = []
    for root, dirs, files in os.walk(dir_path):
        dirs[:] = [d for d in dirs if d not in _EXCLUDE_DIR_PARTS]  # 하위 탐색에서 제외 디렉터리 제거
        for name in files:
            if name.endswith(".py"):
                py_files.append(Path(root) / name)
    py_files.sort()
    logger.info("[%s] Python %d개 발견: %s", source_type, len(py_files), dir_path)
    docs: list[Document] = []
    for py_file in py_files:
        docs.extend(self._load_single_file(py_file, source_type))
    return docs`
    },
    {
      id: "fn_connect_with_retry",
      name: "Neo4jConnection._connect_with_retry()",
      fileId: "graph",
      summary: "지수 백오프로 최대 3회 재시도하며 Neo4j에 연결",
      how: "Docker 컨테이너가 healthy 상태가 되기까지 시간이 걸립니다. 즉시 재연결은 서버를 악화시킬 수 있어 1초→2초→4초로 대기 시간을 늘려가며 재시도합니다.",
      terms: ["neo4j_graph", "exponential_backoff"],
      lines: [
        { at: "for attempt in range(max_retries):", text: "최대 3번(0, 1, 2) 시도합니다. 모두 실패하면 예외를 던져 인덱싱을 중단합니다." },
        { at: "graph = Neo4jGraph(", text: "Neo4j 접속 정보(URI, 사용자명, 비밀번호)로 연결 객체를 만듭니다. 연결에 성공하면 그래프 객체를 반환합니다." },
        { at: "wait = 2 ** attempt", text: "시도 0→1초, 1→2초, 2→4초로 대기 시간을 두 배씩 늘립니다. 서버가 복구할 시간을 줍니다." },
        { at: "logger.error(\"Neo4j 연결 최종 실패", text: "3회 모두 실패했을 때 명확한 오류 메시지를 남깁니다. Docker 컨테이너 상태를 확인하라고 안내합니다." }
      ],
      code: `def _connect_with_retry(self, max_retries: int = 3) -> Neo4jGraph:
    """지수 백오프(1초·2초·4초)로 최대 3회 재시도하며 Neo4j에 연결함.

    즉시 재연결은 일시 장애를 악화시킬 수 있어, 대기 시간을 2^attempt로 늘려 서버 복구 시간을 줌.
    콜드스타트(APOC 다운로드 포함 ~40초)는 docker-compose의 healthcheck + \`up --wait\`로 흡수하는 것이 원칙임.
    """
    for attempt in range(max_retries):
        try:
            graph = Neo4jGraph(
                url=self.settings.neo4j_uri,
                username=self.settings.neo4j_user,
                password=self.settings.neo4j_password,
            )
            logger.info("Neo4j 연결 성공: %s", self.settings.neo4j_uri)
            return graph
        except Exception as e:
            wait = 2 ** attempt  # 1초 → 2초 → 4초로 대기 시간 증가
            logger.warning(
                "Neo4j 연결 실패 (시도 %d/%d), %d초 후 재시도: %s",
                attempt + 1, max_retries, wait, e,
            )
            if attempt < max_retries - 1:
                time.sleep(wait)
            else:
                logger.error("Neo4j 연결 최종 실패 — 컨테이너가 healthy 상태인지 확인하세요.")
                raise`
    },
    {
      id: "fn_create_indexes",
      name: "Neo4jConnection.create_indexes()",
      fileId: "graph",
      summary: "엔티티 id에 UNIQUE 제약조건을 걸어 중복 노드 생성을 차단",
      how: "같은 개념(예: 'RAG')이 여러 청크에서 반복 추출되어도 Neo4j에 하나의 노드만 만들어집니다. MERGE 연산이 UNIQUE 인덱스를 활용해 빠르게 중복을 찾습니다.",
      terms: ["cypher", "merge", "unique_constraint"],
      lines: [
        { at: "\"CREATE CONSTRAINT IF NOT EXISTS \"", text: "이미 제약조건이 있으면 오류 없이 건너뜁니다. 파이프라인을 여러 번 실행해도 안전합니다." },
        { at: "\"FOR (n:__Entity__) REQUIRE n.id IS UNIQUE\"", text: "__Entity__ 라벨을 가진 모든 노드에서 id 값이 반드시 고유해야 한다는 제약입니다. 같은 이름의 엔티티가 두 번 나와도 노드가 하나만 만들어집니다." }
      ],
      code: `def create_indexes(self):
    """엔티티 id 유니크 제약조건 생성 (중복 방지 + MERGE 성능 확보)

    UNIQUE 제약조건은 동일 엔티티가 여러 노드로 중복 생성되는 것을 막고,
    add_graph_documents()의 내부 MERGE 연산이 인덱스를 활용해 효율적으로 동작하게 함.
    """
    self.graph.query(
        "CREATE CONSTRAINT IF NOT EXISTS "
        "FOR (n:__Entity__) REQUIRE n.id IS UNIQUE"
    )
    logger.info("엔티티 id 유니크 제약조건 생성 완료")`
    },
    {
      id: "fn_clear_graph",
      name: "Neo4jConnection.clear_graph()",
      fileId: "graph",
      summary: "--force 재인덱싱 시 제약조건·인덱스·노드를 순서대로 삭제",
      how: "제약조건이 걸린 채로 노드를 먼저 지우면 무결성 위반 오류가 납니다. 제약조건 → LOOKUP 외 인덱스 → 노드/관계 순으로 삭제해야 안전합니다.",
      terms: ["cypher", "detach_delete"],
      lines: [
        { at: "indexes = self.graph.query(\"SHOW INDEXES WHERE type <> 'LOOKUP'\")", text: "LOOKUP 인덱스는 Neo4j 내부 시스템 인덱스라 삭제하면 오류가 납니다. 이 조건으로 사용자 인덱스만 골라냅니다." },
        { at: "self.graph.query(\"MATCH (n) DETACH DELETE n\")", text: "모든 노드를 삭제합니다. DETACH가 없으면 관계가 연결된 노드를 지울 때 오류가 납니다. DETACH는 관계를 먼저 끊고 노드를 삭제합니다." }
      ],
      code: `def clear_graph(self):
    """그래프 전체 삭제 (--force 재인덱싱용) — 제약조건 → 인덱스 → 노드/관계 순서로 제거함"""
    # 제약조건을 먼저 삭제 (제약조건이 걸린 노드를 먼저 지우면 무결성 위반 가능)
    constraints = self.graph.query("SHOW CONSTRAINTS")
    for c in constraints:
        self.graph.query(f"DROP CONSTRAINT {c['name']}")
    logger.info("제약조건 %d개 삭제", len(constraints))

    # LOOKUP 인덱스는 Neo4j 시스템 내부 인덱스라 삭제 대상에서 제외 (삭제 시도 시 오류)
    indexes = self.graph.query("SHOW INDEXES WHERE type <> 'LOOKUP'")
    for idx in indexes:
        self.graph.query(f"DROP INDEX {idx['name']}")
    logger.info("인덱스 %d개 삭제", len(indexes))

    # DETACH DELETE: 노드에 연결된 관계를 먼저 끊고 노드를 삭제 (일반 DELETE는 관계 있는 노드 삭제 시 오류)
    self.graph.query("MATCH (n) DETACH DELETE n")
    logger.info("그래프 전체 삭제 완료")`
    },
    {
      id: "fn_kg_init",
      name: "KGBuilder.__init__()",
      fileId: "kg",
      summary: "Groq LPU를 OpenAI 호환 인터페이스로 연결하고 LLMGraphTransformer를 초기화",
      how: "ChatOpenAI의 base_url만 Groq 엔드포인트로 바꾸면 LLMGraphTransformer가 Groq의 초고속 LPU를 그대로 씁니다. ignore_tool_usage 여부에 따라 추출 경로(함수호출 vs 프롬프트)가 달라집니다.",
      terms: ["groq_lpu", "LLMGraphTransformer", "ignore_tool_usage"],
      lines: [
        { at: "base_url=settings.groq_base_url,", text: "OpenAI API 형식을 그대로 쓰되 서버 주소만 Groq으로 바꿉니다. LLMGraphTransformer는 주소가 다른 줄 모르고 동일하게 동작합니다." },
        { at: "temperature=0,", text: "온도를 0으로 고정해 엔티티 추출 결과가 매번 동일하게 나오도록 합니다. 무작위성이 있으면 같은 교재를 두 번 인덱싱할 때 다른 KG가 생깁니다." },
        { at: "if settings.ignore_tool_usage and supports_ignore:", text: "이 분기가 True이면 프롬프트 기반 추출(gpt-oss-20b 안전 경로)을, False이면 함수호출 기반 추출(description까지 뽑는 고품질 경로)을 사용합니다." },
        { at: "transformer_kwargs[\"node_properties\"] = [\"description\"]", text: "함수호출 모드에서만 description(엔티티 설명)도 함께 추출합니다. 이 설명이 entity_embedding 품질을 높입니다." }
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
    )

    # LLMGraphTransformer 생성 인자 구성
    # - allowed_nodes/allowed_relationships: 도메인 온톨로지(영어) — 추출 타입을 안내
    # - strict_mode=False: 허용 목록 외 타입도 저장 (재현율 우선)
    transformer_kwargs = dict(
        llm=self.llm,
        allowed_nodes=settings.allowed_nodes,
        allowed_relationships=settings.allowed_relationships,
        strict_mode=settings.strict_mode,
    )
    # node_properties(엔티티 description 추출)는 네이티브 함수호출 모드에서만 지원됨.
    # ignore_tool_usage=True(프롬프트 추출)와 node_properties를 함께 쓰면 ValueError가 나므로 상호 배타 처리:
    supports_ignore = "ignore_tool_usage" in inspect.signature(LLMGraphTransformer.__init__).parameters
    if settings.ignore_tool_usage and supports_ignore:
        transformer_kwargs["ignore_tool_usage"] = True
        logger.info("프롬프트 기반 추출 모드 — node_properties(description) 생략")
    else:
        transformer_kwargs["node_properties"] = ["description"]
        if settings.ignore_tool_usage and not supports_ignore:
            logger.warning("설치된 LLMGraphTransformer가 ignore_tool_usage 미지원 — 함수호출 모드 사용")
    self.transformer = LLMGraphTransformer(**transformer_kwargs)`
    },
    {
      id: "fn_build_async",
      name: "KGBuilder._build_async()",
      fileId: "kg",
      summary: "교재 청크를 배치로 LLM에 보내 엔티티·관계를 추출하고 Neo4j에 저장",
      how: "aconvert_to_graph_documents()가 배치 내 청크를 비동기로 동시에 LLM에 요청해 속도를 높입니다. 추출된 그래프를 add_graph_documents()로 저장할 때 baseEntityLabel=True로 공통 라벨을 부여해 벡터 인덱스 생성을 가능하게 합니다.",
      terms: ["LLMGraphTransformer", "cypher", "merge", "async_await", "tqdm"],
      lines: [
        { at: "graph_documents = await self.transformer.aconvert_to_graph_documents(batch)", text: "청크 묶음을 LLM에 비동기로 보내 엔티티와 관계를 추출합니다. 동기 버전보다 5~10배 빠릅니다." },
        { at: "extracted_nodes = [n for doc in graph_documents for n in doc.nodes]", text: "추출된 모든 노드를 하나의 목록으로 모읍니다. 이 목록이 비어 있으면 LLM이 엔티티를 찾지 못한 것입니다." },
        { at: "baseEntityLabel=True,", text: "추출된 모든 엔티티에 __Entity__ 라벨을 추가로 붙입니다. 이 공통 라벨이 없으면 타입이 제각각이라 from_existing_graph()로 벡터 인덱스를 만들 수 없습니다." },
        { at: "include_source=True,", text: "각 엔티티·관계에 출처 Document 노드를 연결합니다. 나중에 '이 개념이 어느 교재 어느 청크에서 왔는지' 추적할 수 있습니다." }
      ],
      code: `async def _build_async(self, documents: list[Document]) -> dict:
    """배치 단위 비동기 변환으로 KG를 구축함"""
    total = len(documents)
    success_count = 0
    fail_count = 0
    extracted_node_total = 0
    # 배치 시작 인덱스 목록 (예: 0, 10, 20, ...). 메모리·요청 수 제어를 위해 batch_size씩 나눔
    batch_starts = list(range(0, total, self.settings.batch_size))

    pbar = tqdm(
        total=len(batch_starts),
        desc="KG 구축",
        unit="batch",
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]",
    )

    for start in batch_starts:
        batch = documents[start:start + self.settings.batch_size]
        batch_end = min(start + len(batch), total)
        pbar.set_postfix(docs=f"{batch_end}/{total}", ok=success_count, fail=fail_count)

        try:
            # aconvert_to_graph_documents(): 청크들을 비동기로 LLM에 보내 엔티티/관계를 추출
            graph_documents = await self.transformer.aconvert_to_graph_documents(batch)

            # 추출된 노드 집계 — 0개면 LLM이 엔티티를 못 찾았거나 추출 경로가 실패한 것
            extracted_nodes = [n for doc in graph_documents for n in doc.nodes]
            if not extracted_nodes:
                logger.warning(
                    "청크 %d-%d: 엔티티 0개 추출 (LLM 추출 실패 또는 빈 청크)",
                    start + 1, batch_end,
                )
                fail_count += len(batch)
                continue
            extracted_node_total += len(extracted_nodes)

            # 첫 배치는 추출 샘플(노드·관계 타입)을 로그로 남겨 추출이 살아있는지 즉시 확인
            if start == 0:
                sample_types = sorted({n.type for n in extracted_nodes})[:8]
                sample_rels = sorted({
                    r.type for doc in graph_documents for r in doc.relationships
                })[:8]
                logger.info("추출 샘플 — 노드 타입: %s", sample_types)
                logger.info("추출 샘플 — 관계 타입: %s", sample_rels)

            # add_graph_documents() 저장 옵션:
            # - baseEntityLabel=True: 모든 엔티티에 __Entity__ 공통 라벨 부여
            #   → 타입과 무관하게 MATCH (n:__Entity__)로 일괄 조회 (벡터 인덱스 생성에 필수)
            # - include_source=True: 각 엔티티/관계에 출처 문서를 연결해 검색 결과의 출처 추적 가능
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

    logger.info(
        "KG 구축 완료: 성공 %d, 실패 %d (총 %d), 추출 엔티티 %d개",
        success_count, fail_count, total, extracted_node_total,
    )
    return {
        "success": success_count,
        "fail": fail_count,
        "extracted_nodes": extracted_node_total,
    }`
    },
    {
      id: "fn_set_entity_text",
      name: "KGBuilder._set_entity_text()",
      fileId: "kg",
      summary: "엔티티 노드에 text 속성을 보강해 벡터 검색이 가능하게 만듦",
      how: "Neo4jVector.from_existing_graph()는 임베딩 입력으로 text 속성을 읽습니다. LLMGraphTransformer는 id·description만 만들기 때문에, 이 함수가 두 값을 합쳐 text를 채워줍니다.",
      terms: ["cypher", "neo4j_vector"],
      lines: [
        { at: "\"WHERE n.description IS NOT NULL AND n.description <> '' \"", text: "description이 있는 엔티티만 골라냅니다. 설명이 있으면 검색 정확도가 높아집니다." },
        { at: "\"SET n.text = n.id + ': ' + n.description\"", text: "'RAG: 외부 지식을 검색해 LLM에 주입하는 기법'처럼 이름과 설명을 합친 텍스트를 text 속성에 씁니다." },
        { at: "\"WHERE n.text IS NULL OR n.text = '' \"", text: "description이 없어 text가 아직 비어 있는 엔티티만 골라냅니다." },
        { at: "\"SET n.text = n.id\"", text: "설명이 없는 엔티티는 이름만으로 text를 채웁니다. 최소한 이름으로는 검색됩니다." }
      ],
      code: `def _set_entity_text(self):
    """__Entity__ 노드에 text 속성 설정 (벡터 검색용)

    Neo4jVector.from_existing_graph()는 임베딩·결과 표시에 text 속성을 사용하는데
    LLMGraphTransformer는 id·description만 생성하므로, 여기서 text = id(+description)로 채움.
    """
    # description이 있으면 "엔티티명: 설명" (풍부한 문맥으로 검색 정확도 향상)
    self.graph.query(
        "MATCH (n:__Entity__) "
        "WHERE n.description IS NOT NULL AND n.description <> '' "
        "AND (n.text IS NULL OR n.text = '') "
        "SET n.text = n.id + ': ' + n.description"
    )
    # description이 없으면 "엔티티명"만 (최소한의 검색 가능성 확보)
    self.graph.query(
        "MATCH (n:__Entity__) "
        "WHERE n.text IS NULL OR n.text = '' "
        "SET n.text = n.id"
    )
    logger.info("__Entity__ text 속성 설정 완료")`
    },
    {
      id: "fn_entity_vector_index",
      name: "VectorIndexManager.create_entity_vector_index()",
      fileId: "vector",
      summary: "Neo4j에 이미 있는 엔티티 노드에 임베딩을 추가해 entity_embedding 인덱스 생성",
      how: "from_existing_graph()는 이미 저장된 __Entity__ 노드에서 id와 description을 읽어 Ollama로 임베딩하고, 각 노드의 embedding 속성에 벡터를 저장합니다. 검색할 때 질문을 같은 모델로 임베딩해 가장 가까운 엔티티를 찾습니다.",
      terms: ["neo4j_vector", "ollama", "entity_embedding"],
      lines: [
        { at: "node_label=\"__Entity__\",", text: "모든 엔티티 노드를 타입(Technology, Concept 등)에 상관없이 한 번에 대상으로 삼습니다. 공통 라벨 덕분에 가능합니다." },
        { at: "text_node_properties=[\"id\", \"description\"],", text: "이 두 속성을 합친 텍스트가 임베딩 입력이 됩니다. _set_entity_text()에서 만든 text 속성이 아닌, 원본 속성을 직접 씁니다." },
        { at: "embedding_node_property=\"embedding\",", text: "계산된 벡터를 각 노드의 embedding 속성에 저장합니다. 검색 시 이 벡터와 질문 벡터의 코사인 유사도를 비교합니다." }
      ],
      code: `def create_entity_vector_index(self) -> Neo4jVector:
    """entity_embedding: 교재 엔티티의 id+description 임베딩 인덱스 생성

    from_existing_graph(): 이미 Neo4j에 저장된 노드를 대상으로 임베딩과 벡터 인덱스를 추가함.
    - node_label="__Entity__": KG의 모든 엔티티 노드를 타입 무관하게 일괄 대상화
    - text_node_properties=["id", "description"]: 두 속성을 합친 텍스트를 임베딩 입력으로 사용
    - embedding_node_property="embedding": 생성된 벡터를 각 노드의 embedding 속성에 저장
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
      summary: "교재·코드 청크를 Chunk 노드로 저장하고 doc_embedding 인덱스 생성",
      how: "from_documents()는 Document 목록을 Neo4j에 Chunk 노드로 새로 만들고 임베딩합니다. KG 엔티티와 별도 노드라 검색 대상이 섞이지 않습니다. metadata가 노드 속성으로 저장되어 출처를 추적할 수 있습니다.",
      terms: ["neo4j_vector", "chunk", "doc_embedding"],
      lines: [
        { at: "documents=documents,", text: "교재 청크와 예제코드 청크를 합친 목록입니다. 이 Document들이 Neo4j에 Chunk 노드로 하나씩 저장됩니다." },
        { at: "index_name=\"doc_embedding\",", text: "이 인덱스 이름으로 검색할 때 이 인덱스를 지정합니다. entity_embedding과 이름이 달라 혼동 없이 두 인덱스를 따로 씁니다." }
      ],
      code: `def create_doc_vector_index(self, documents: list[Document]) -> Neo4jVector:
    """doc_embedding: 교재 청크 + 예제코드 텍스트 임베딩 인덱스 생성

    from_documents(): Document 리스트를 Neo4j에 신규 노드(기본 라벨 Chunk)로 만들고 임베딩함.
    - 교재 엔티티(KG)와 분리된 별도 Chunk 노드라 검색 대상이 섞이지 않음
    - metadata(source, source_type, chunk_index)가 노드 속성으로 저장되어 출처 추적 가능
    → "개념 설명"(교재 원문)·"X 구현 예제"(코드) 질문을 원문 단위 벡터 유사도로 직접 매칭함
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
      summary: "문서 로드 → KG 구축 → 이중 벡터 인덱스 생성 → 통계 출력 전체 흐름 조율",
      how: "각 모듈을 순서대로 호출해 파이프라인을 완성합니다. Phase 1(KG 구축)과 Phase 2(벡터 인덱스)로 나눠, Phase 1 결과물인 엔티티에 Phase 2에서 임베딩을 추가합니다.",
      terms: ["async_await", "LLMGraphTransformer", "neo4j_vector"],
      lines: [
        { at: "settings = Settings()", text: "설정 객체를 만듭니다. 이 시점에 .env 로드와 경로 계산이 모두 완료됩니다." },
        { at: "connection.create_indexes()", text: "엔티티 id UNIQUE 제약조건을 생성합니다. MERGE 연산이 빠르게 중복을 찾을 수 있게 준비합니다." },
        { at: "kg_builder = KGBuilder(settings, connection.graph)", text: "KG 구축기에 설정과 Neo4j 연결 객체를 주입합니다. LLMGraphTransformer와 Groq LLM도 여기서 초기화됩니다." },
        { at: "connection.clear_doc_chunks()", text: "기존 Chunk 노드를 먼저 지웁니다. --force 없이 재실행해도 교재·코드 청크가 중복 누적되지 않습니다." },
        { at: "if kg_documents and kg_result[\"extracted_nodes\"] == 0:", text: "교재를 처리했는데 엔티티가 하나도 없으면 LLM 추출 경로에 문제가 있다는 신호입니다. GROQ_API_KEY나 ignore_tool_usage 설정을 확인하라고 안내합니다." }
      ],
      code: `def main() -> None:
    """문서 로드 → KG 구축 → 이중 벡터 인덱스 생성 → 통계 출력"""
    args = parse_args()
    logger.info("=" * 60)
    logger.info("LangChain + Neo4j GraphRAG 인덱싱 시작 (mode=%s, force=%s)", args.mode, args.force)
    logger.info("=" * 60)

    # 1. 설정 로드 + 경로 검증 (LLM/Neo4j 호출 전에 경로부터 확인)
    settings = Settings()
    log_resolved_paths(settings)

    # 2. 문서 로드 (cheap 단계 — LLM 호출 없음)
    loader = DocumentLoader(settings)
    kg_documents, vector_documents = load_documents(settings, loader, args.mode)
    logger.info("KG 인덱싱 청크: %d개 / Vector 인덱싱 청크: %d개", len(kg_documents), len(vector_documents))

    # 3. Neo4j 연결 (재시도 백오프 포함)
    logger.info("Neo4j 연결 중...")
    connection = Neo4jConnection(settings)

    # 4. --force면 그래프 전체 초기화 (재인덱싱 시 중복·잔존 데이터 제거)
    if args.force:
        logger.info("--force: 그래프 초기화")
        connection.clear_graph()

    # 5. 엔티티 id 유니크 제약조건 생성 (MERGE 중복 방지 + 성능)
    connection.create_indexes()

    # 6. [Phase 1] KG 구축 (교재) — LLM 추출 단계
    kg_result = {"extracted_nodes": 0}
    if kg_documents:
        logger.info("-" * 60)
        logger.info("[Phase 1] KG 구축 시작 (교재 %d청크)", len(kg_documents))
        kg_builder = KGBuilder(settings, connection.graph)
        kg_result = kg_builder.build_from_documents(kg_documents)
        logger.info(
            "[Phase 1] 완료 — 성공 %d, 실패 %d, 추출 엔티티 %d개",
            kg_result["success"], kg_result["fail"], kg_result["extracted_nodes"],
        )
    else:
        logger.warning("KG 인덱싱 대상 문서 없음 → Phase 1 스킵")

    # 7. [Phase 2] 벡터 인덱스 생성
    logger.info("-" * 60)
    logger.info("[Phase 2] 벡터 인덱스 생성")
    vector_manager = VectorIndexManager(settings)

    # 7-1. entity_embedding (KG 엔티티 id+description)
    try:
        vector_manager.create_entity_vector_index()
    except Exception as e:
        logger.warning("entity_embedding 인덱스 생성 실패: %s", e)

    # 7-2. doc_embedding (교재 청크 + 예제코드)
    if vector_documents:
        try:
            # 기존 Chunk 노드를 먼저 비워 --force 없는 재실행에서도 중복 누적을 방지 (idempotent)
            connection.clear_doc_chunks()
            vector_manager.create_doc_vector_index(vector_documents)
        except Exception as e:
            logger.warning("doc_embedding 인덱스 생성 실패: %s", e)
    else:
        logger.warning("Vector 인덱싱 대상 문서 없음 → doc_embedding 스킵")

    # 8. 최종 통계 + 완료 판정 (성공 기준은 'exit 0'이 아니라 '비어있지 않은 KG')
    logger.info("-" * 60)
    stats = connection.get_stats()
    logger.info("[통계] 노드 %d개 / 관계 %d개", stats["node_count"], stats["relationship_count"])
    for label in stats["node_labels"][:10]:
        logger.info("  라벨 %s = %d", label["lbls"], label["cnt"])
    for rel in stats["relationship_types"][:10]:
        logger.info("  관계 %s = %d", rel["rel_type"], rel["cnt"])

    logger.info("=" * 60)
    if kg_documents and kg_result["extracted_nodes"] == 0:
        # KG 대상 문서가 있었는데 엔티티가 0개면 추출 경로 실패 — 명확히 경고
        logger.error("인덱싱 경고: 추출 엔티티 0개. LLM 추출 경로(ignore_tool_usage)·GROQ_API_KEY를 확인하세요.")
    else:
        logger.info("인덱싱 완료!")
    logger.info("=" * 60)`
    }
  ],
  glossary: {
    "LLMGraphTransformer":  "텍스트를 LLM에 보내 (주체, 관계, 대상) 삼중쌍을 추출하는 LangChain 도구입니다. 교재 문장에서 '개념 A는 개념 B를 사용한다'를 찾아 그래프 노드와 엣지로 만듭니다.",
    "neo4j_graph":          "LangChain의 Neo4jGraph — Cypher 실행과 스키마 조회를 감싼 래퍼입니다. graph.query()로 Cypher 문을 직접 실행할 수 있습니다.",
    "neo4j_vector":         "LangChain의 Neo4jVector — Neo4j를 벡터 저장소처럼 쓸 수 있게 해주는 래퍼입니다. 임베딩 저장·벡터 인덱스 생성·유사도 검색을 지원합니다.",
    "entity_embedding":     "KG의 __Entity__ 노드에 추가한 벡터 인덱스입니다. '질문과 가장 비슷한 개념 찾기'에 사용합니다. 찾은 엔티티에서 그래프를 확장 탐색하는 하이브리드 검색의 출발점입니다.",
    "doc_embedding":        "교재 청크와 예제코드를 Chunk 노드로 저장한 벡터 인덱스입니다. '개념 설명'이나 '코드 예제' 원문을 직접 찾을 때 씁니다.",
    "cypher":               "Neo4j 전용 그래프 질의 언어입니다. MATCH (a)-[r]->(b) 형태로 노드와 관계를 조회하고, MERGE로 중복 없이 노드를 만듭니다.",
    "merge":                "Cypher의 MERGE — 이미 있으면 찾고 없으면 만드는 명령입니다. INSERT와 달리 중복 노드가 생기지 않습니다.",
    "unique_constraint":    "Neo4j의 UNIQUE 제약조건 — 특정 속성 값이 노드 전체에서 고유하도록 강제합니다. 같은 이름의 엔티티가 두 번 추출돼도 노드 하나만 유지됩니다.",
    "detach_delete":        "Cypher의 DETACH DELETE — 노드에 연결된 관계를 먼저 끊고 노드를 삭제합니다. 관계가 남아 있는 노드를 DELETE하면 오류가 나므로 DETACH를 씁니다.",
    "ignore_tool_usage":    "LLMGraphTransformer의 추출 경로 선택 옵션입니다. False(기본)이면 네이티브 함수호출로 description까지 추출하고, True이면 프롬프트 기반으로 추출합니다. gpt-oss-20b처럼 함수호출이 불안정한 모델은 True로 설정합니다.",
    "groq_lpu":             "Groq사의 LPU(Language Processing Unit) — GPU보다 LLM 추론이 빠른 전용 칩입니다. OpenAI API와 호환되는 엔드포인트를 제공해 base_url만 바꿔 사용합니다.",
    "ollama":               "로컬 PC에서 LLM·임베딩 모델을 실행하는 도구입니다. 여기서는 qwen3-embedding 모델로 4096차원 벡터를 만듭니다. API 비용이 없고 오프라인에서도 동작합니다.",
    "async_await":          "파이썬의 비동기 프로그래밍 키워드입니다. async def로 비동기 함수를 정의하고, await로 다른 비동기 함수의 결과를 기다립니다. LLM 호출처럼 오래 걸리는 작업을 기다리는 동안 다른 요청을 처리할 수 있습니다.",
    "exponential_backoff":  "재시도 간격을 1→2→4초처럼 지수적으로 늘리는 전략입니다. 서버가 회복할 시간을 주면서 불필요한 요청 폭탄을 막습니다.",
    "chunk":                "긴 텍스트를 일정 크기로 자른 조각입니다. LLM이 한 번에 처리할 수 있는 길이 제한이 있고, 작은 조각일수록 엔티티 추출 정확도가 높아집니다.",
    "langchain_document":   "LangChain의 Document 객체 — page_content(텍스트)와 metadata(사전)로 구성됩니다. LLMGraphTransformer와 Neo4jVector가 공통으로 사용하는 표준 입력 형식입니다.",
    "rglob":                "Path.rglob() — 현재 폴더부터 모든 하위 폴더를 재귀 탐색하며 패턴에 맞는 파일을 찾습니다. rglob('*.md')이면 하위 폴더까지 모든 마크다운 파일을 반환합니다.",
    "os_walk":              "os.walk() — 지정 폴더와 하위 폴더를 순서대로 방문하며 (현재경로, 폴더목록, 파일목록)을 반환합니다. dirs[:] 가지치기와 함께 쓰면 특정 폴더를 탐색에서 완전히 제외할 수 있습니다.",
    "dirs_prune":           "os.walk() 중 dirs[:] = [필터] 패턴입니다. dirs 목록을 in-place로 수정하면 os.walk가 제외된 폴더에 아예 들어가지 않습니다. rglob보다 훨씬 빠릅니다.",
    "dataclass":            "@dataclass 데코레이터 — 클래스의 __init__, __repr__ 등을 자동 생성합니다. 설정처럼 데이터를 담는 클래스를 간결하게 만들 때 씁니다.",
    "dotenv":               "python-dotenv 라이브러리 — .env 파일의 KEY=VALUE를 읽어 환경변수로 등록합니다. API 키를 코드에 직접 쓰지 않고 파일로 관리합니다.",
    "pathlib":              "파이썬 표준 라이브러리의 경로 관리 도구입니다. Path 객체는 / 연산자로 경로를 이어 붙이고, .exists(), .rglob() 같은 메서드를 제공합니다.",
    "tqdm":                 "터미널에 진행률 막대를 표시하는 라이브러리입니다. 수십~수백 청크를 처리하는 동안 '몇 배치 중 몇 번째' 진행 상황을 실시간으로 보여줍니다."
  }
};
