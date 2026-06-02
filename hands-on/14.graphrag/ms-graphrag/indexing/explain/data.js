window.EXPLAIN_DATA = {
  meta: { title: "Microsoft GraphRAG 인덱싱 — 교재 KG+Vector / 예제코드 Vector", entry: "index_documents.py" },
  files: [
    { id: "settings", label: "config/settings.py", role: "경로, 모델, GraphRAG 설정값을 한곳에 모으는 설정 파일" },
    { id: "loader", label: "document_loader.py", role: "교재와 예제코드를 서로 다른 방식으로 청킹하는 문서 로더" },
    { id: "main", label: "index_documents.py", role: "교재 GraphRAG CLI 인덱싱과 코드 벡터 인덱싱을 묶는 실행 진입점" },
    { id: "finalize", label: "finalize_indexing.py", role: "DRIFT 검색에 필요한 엔티티·커뮤니티 임베딩을 보완하는 후처리" },
    { id: "code", label: "code_indexer.py", role: "예제코드 청크를 Ollama 임베딩 후 LanceDB에 저장하는 코드 전용 인덱서" },
    { id: "utils", label: "utils/*.py", role: "디렉터리 생성과 로거 초기화를 맡는 작은 공통 유틸리티" }
  ],
  flow: [
    { step: 1, title: "설정 로드",        summary: "settings.py가 경로와 모델명을 확정함",               detail: "작업 폴더, 교재 위치, GraphRAG Parquet 저장소, LanceDB 저장소, Groq/Ollama 모델명을 한 객체에 모읍니다. 모든 경로는 __file__ 위치에서 자동 계산되므로 OS나 Clone 위치가 달라도 수정 없이 동작합니다." },
    { step: 2, title: "문서 수집",        summary: "GraphRAGDocumentLoader가 교재와 예제코드를 청킹함",  detail: "교재는 마크다운 헤더(#~####) 기준으로 섹션을 나누고 500자 미만 소섹션은 합쳐 적정 크기 청크를 만듭니다. 예제코드는 ast.parse()로 문법 구조를 읽어 함수·클래스 단위로 자릅니다. 글자 수로만 자르면 함수 중간이 잘리므로 AST를 씁니다." },
    { step: 3, title: "교재 입력 준비",   summary: "교재 청크를 data/input/*.txt로 내보냄",              detail: "Microsoft GraphRAG CLI는 data/input 디렉터리의 .txt 파일만 입력으로 읽습니다. 기존 파일을 모두 지운 뒤 메타데이터 헤더(Source/File/Section)와 본문을 합쳐 한 청크 = 한 파일로 저장합니다." },
    { step: 4, title: "GraphRAG CLI 실행", summary: "python -m graphrag index --root indexing 실행",       detail: "현재 가상환경의 graphrag를 python -m graphrag로 실행합니다. PATH의 graphrag.exe가 다른 인터프리터를 가리켜도 영향을 받지 않습니다. CLI가 엔티티·관계·커뮤니티를 추출해 Parquet 파일과 LanceDB 벡터 인덱스를 생성합니다." },
    { step: 5, title: "후처리",           summary: "엔티티와 community_full_content 임베딩 누락을 보완함", detail: "GraphRAG CLI 중 Ollama OOM이나 타임아웃으로 일부 임베딩이 빠질 수 있습니다. finalize_indexing이 누락분을 Ollama로 다시 생성하고, DRIFT Search 진입점인 community_full_content LanceDB 테이블을 만듭니다." },
    { step: 6, title: "코드 인덱싱",      summary: "예제코드는 KG 없이 코드 전용 벡터 인덱스에 저장함",  detail: "절차적인 코드에는 개념 관계 그래프보다 유사도 검색이 적합합니다. AST 청킹된 코드 청크를 Ollama qwen3-embedding으로 벡터화해 LanceDB code_chunks 테이블에 저장합니다." }
  ],
  functions: [
    {
      id: "ms_indexing_settings_settings",
      name: "Settings",
      fileId: "settings",
      summary: "인덱싱 전체에서 공유할 경로와 모델 설정을 보관함",
      how: "settings.yaml을 단일 소스로 읽고, yaml에 없는 Python 전용 경로 상수만 직접 정의합니다. 모든 경로는 __file__ 위치를 기준으로 자동 계산되어 어떤 OS에서 Clone해도 수정이 필요 없습니다.",
      terms: ["GraphRAG", "Microsoft GraphRAG", "Knowledge Graph", "Vector", "Embedding", "LanceDB"],
      lines: [
        { at: "parquet_dir: Path = field(default_factory=lambda: PROJECT_ROOT / \"store\" / \"parquet\")", text: "GraphRAG CLI가 엔티티·관계·커뮤니티를 저장하는 Parquet 디렉터리 경로입니다. settings.yaml의 output_storage.base_dir와 반드시 같은 위치를 가리켜야 검색 단계가 파일을 찾을 수 있습니다." },
        { at: "graphrag_vector_dir: Path = field(default_factory=lambda: PROJECT_ROOT / \"store\" / \"vector\" / \"graphrag\")", text: "GraphRAG CLI가 생성하는 LanceDB 벡터 인덱스 경로입니다. settings.yaml의 vector_store.db_uri와 일치해야 합니다." },
        { at: "code_vector_dir: Path = field(default_factory=lambda: PROJECT_ROOT / \"store\" / \"vector\" / \"code\")", text: "교재 KG와 분리된 코드 전용 벡터 인덱스 경로입니다. code_indexer.py가 별도로 관리하므로 graphrag CLI가 이 경로를 덮어쓰지 않습니다." },
        { at: "llm_model: str = field(default_factory=lambda: _get_yaml(", text: "LLM 모델명을 settings.yaml의 completion_models 섹션에서 읽습니다. YAML에 키가 없으면 openai/gpt-oss-120b를 기본값으로 씁니다." },
        { at: "embedding_dim: int = field(default_factory=lambda: int(os.getenv(\"EMBEDDING_DIM\", \"4096\")))", text: "LanceDB 테이블 스키마는 첫 번째 벡터 행으로 차원을 고정합니다. 여기 설정한 4096이 실제 모델 출력과 다르면 스키마 불일치로 저장이 실패합니다." }
      ],
      code: `class Settings:
    """시스템 전역 설정.

    yaml에 있는 값은 yaml에서 읽고, yaml에 없는 Python 전용 값만 직접 정의함.
    """

    # === 프로젝트 경로 (Python 전용) ===
    project_root: Path = field(default_factory=lambda: PROJECT_ROOT)         # ms-graphrag/
    indexing_dir: Path = field(default_factory=lambda: INDEXING_DIR)         # indexing/

    # GraphRAG 입력 디렉터리 (settings.yaml input_storage.base_dir="data/input" 과 일치)
    input_dir: Path = field(default_factory=lambda: INDEXING_DIR / "data" / "input")

    # 출력 스토어 경로 (settings.yaml output_storage.base_dir="../store/parquet" 과 일치)
    parquet_dir: Path = field(default_factory=lambda: PROJECT_ROOT / "store" / "parquet")
    # GraphRAG 벡터 스토어 (settings.yaml vector_store.db_uri="../store/vector/graphrag" 과 일치)
    graphrag_vector_dir: Path = field(default_factory=lambda: PROJECT_ROOT / "store" / "vector" / "graphrag")
    # 예제코드 전용 벡터 스토어 (KG 미생성, code_indexer.py가 구축)
    code_vector_dir: Path = field(default_factory=lambda: PROJECT_ROOT / "store" / "vector" / "code")

    # === 데이터소스 경로 (Python 전용) ===
    textbook_dir: Path = field(default_factory=lambda: AISTUDY_DIR / "agentic-ai" / "textbook")  # 교재(*.md)
    code_dir: Path = field(default_factory=lambda: HANDS_ON_DIR)                                  # 예제코드(*.py) 루트

    # === yaml에서 읽는 설정 ===
    # LLM 모델명 (Groq LPU, GraphRAG 인덱싱 시 엔티티/관계 추출·요약에 사용)
    llm_model: str = field(default_factory=lambda: _get_yaml(
        "completion_models.default_completion_model.model", "openai/gpt-oss-120b"))
    # 임베딩 모델명 (Ollama, 벡터 임베딩 생성용)
    embedding_model: str = field(default_factory=lambda: _get_yaml(
        "embedding_models.default_embedding_model.model", "qwen3-embedding"))
    # Ollama API 베이스 URL
    ollama_base_url: str = field(default_factory=lambda: _get_yaml(
        "embedding_models.default_embedding_model.api_base", "http://localhost:11434"))

    # === .env에서 읽는 설정 ===
    # 임베딩 벡터 차원 (LanceDB 스키마·검증과 일치해야 함, qwen3-embedding=4096)
    embedding_dim: int = field(default_factory=lambda: int(os.getenv("EMBEDDING_DIM", "4096")))
    # Groq API 키 (settings.yaml의 \${GROQ_API_KEY}와 동일 소스, CLI가 .env에서 읽음)
    groq_api_key: str = field(default_factory=lambda: os.getenv("GROQ_API_KEY", ""))`
    },
    {
      id: "ms_indexing_loader_graphragdocument_to_text",
      name: "GraphRAGDocument.to_text()",
      fileId: "loader",
      summary: "청크 본문 앞에 출처 메타데이터를 붙여 GraphRAG 입력 텍스트로 변환함",
      how: "GraphRAG가 나중에 출처를 추적할 수 있도록 Source, File, Section 정보를 본문 위에 넣습니다. 이 헤더가 있어야 검색 결과에서 어느 교재 어느 섹션에서 왔는지 알 수 있습니다.",
      terms: ["GraphRAG", "Microsoft GraphRAG", "Knowledge Graph"],
      lines: [
        { at: "f\"[Source: {self.metadata['source_type']}]\"", text: "출처 유형(교재/예제코드)을 헤더 첫 줄에 씁니다. GraphRAG가 엔티티를 추출할 때 이 태그가 있으면 출처를 구분해 저장합니다." },
        { at: "if self.metadata.get(\"section_title\"):", text: "섹션 제목이 있을 때만 [Section] 헤더를 추가합니다. 마크다운 헤더 텍스트나 Python 함수명이 들어가 검색 결과가 어느 섹션인지 바로 알 수 있습니다." },
        { at: "return f\"{header}\\n\\n{self.content}\"", text: "빈 줄을 두 개(\\n\\n) 넣어 헤더와 본문을 구분합니다. GraphRAG가 이 형식으로 본문만 파싱할 수 있습니다." }
      ],
      code: `    def to_text(self) -> str:
        """GraphRAG 입력 형식 텍스트로 변환함 (메타데이터 헤더 + 본문).

        GraphRAG가 출처를 구분할 수 있도록 헤더에 출처 유형·파일명·섹션 정보를 넣음.

        Returns:
            메타데이터 헤더 + 본문 내용
        """
        header_lines = [
            f"[Source: {self.metadata['source_type']}]",  # 출처 유형 (교재/예제코드)
            f"[File: {self.metadata['filename']}]",        # 원본 파일명
        ]
        # 섹션 정보가 있으면 추가 (마크다운 헤더 또는 파이썬 함수/클래스명)
        if self.metadata.get("section_title"):
            header_lines.append(f"[Section: {self.metadata['section_title']}]")
        header = "\\n".join(header_lines)
        return f"{header}\\n\\n{self.content}"`
    },
    {
      id: "ms_indexing_loader_graphragdocumentloader_split_text_by_sections",
      name: "GraphRAGDocumentLoader.split_text_by_sections()",
      fileId: "loader",
      summary: "마크다운 교재를 헤더와 문단 기준으로 적당한 크기의 청크로 나눔",
      how: "500자 미만 작은 섹션은 다음 섹션과 합치고, 그래도 1200자를 넘으면 문단 단위로 다시 쪼갭니다. 너무 작은 청크는 문맥 부족으로 KG 추출이 실패하고, 너무 크면 LLM 입력 한도를 넘을 수 있어 두 방향 모두 통제합니다.",
      terms: [],
      lines: [
        { at: "MIN_SECTION_SIZE = 500  # 이보다 작은 섹션은 다음 섹션과 병합", text: "500자보다 짧은 섹션은 단독 청크로 LLM에 보내면 문맥이 너무 얕아 엔티티 추출이 잘 안 됩니다. 다음 섹션과 합쳐 의미 있는 크기를 만듭니다." },
        { at: "if len(current_content) < MIN_SECTION_SIZE and len(current_content) + len(content) < self.chunk_size:", text: "두 조건을 동시에 확인합니다. ① 지금까지 쌓인 내용이 아직 짧고 ② 합쳐도 최대 청크 크기를 넘지 않을 때만 병합합니다." },
        { at: "return all_chunks if all_chunks else [(\"\"", text: "분할 결과가 하나도 없으면(빈 문서 등) 앞 1200자만이라도 반환합니다. 빈 리스트를 반환하면 이 파일 전체가 인덱스에서 누락됩니다." }
      ],
      code: `    def split_text_by_sections(self, text: str) -> list[tuple[str, str]]:
        """마크다운을 섹션 분할 후 작은 섹션(500자 미만)을 병합하여 청킹함.

        Returns:
            [(섹션제목, 청크내용), ...]
        """
        sections = self.extract_sections(text)

        merged_sections = []
        current_title = ""
        current_content = ""
        MIN_SECTION_SIZE = 500  # 이보다 작은 섹션은 다음 섹션과 병합

        for title, content, _ in sections:
            if not current_content:
                current_title = title
                current_content = content
                continue
            # 누적 내용이 작고 합쳐도 청크 크기 이내면 병합
            if len(current_content) < MIN_SECTION_SIZE and len(current_content) + len(content) < self.chunk_size:
                current_content += f"\\n\\n[{title}]\\n{content}" if title else f"\\n\\n{content}"
                continue
            merged_sections.append((current_title, current_content))
            current_title = title
            current_content = content

        if current_content:
            merged_sections.append((current_title, current_content))

        all_chunks = []
        for title, content in merged_sections:
            all_chunks.extend(self.split_section(title, content))
        # 청크가 하나도 안 나오면 앞부분만이라도 반환
        return all_chunks if all_chunks else [("", text[:self.chunk_size])]`
    },
    {
      id: "ms_indexing_loader_graphragdocumentloader_split_python_code",
      name: "GraphRAGDocumentLoader.split_python_code()",
      fileId: "loader",
      summary: "파이썬 예제코드를 AST로 파싱해 함수·클래스 단위 청크로 나눔",
      how: "코드를 글자 수만으로 자르면 함수 중간이 끊겨 검색 결과가 불완전합니다. ast.parse()로 문법 구조를 먼저 읽어 함수·클래스 경계에서 청크를 만들고, import 블록은 모든 함수가 참조하므로 맨 앞에 별도 청크로 추가합니다.",
      terms: ["AST", "Code Search"],
      lines: [
        { at: "tree = ast.parse(code)  # 소스를 추상 구문 트리로 변환", text: "파이썬 소스 전체를 추상 구문 트리(AST)로 파싱합니다. 이 트리에서 함수와 클래스의 시작·끝 줄 번호를 정확히 알 수 있어 경계에서 청크를 자를 수 있습니다." },
        { at: "for node in ast.iter_child_nodes(tree):", text: "최상위 노드만 순회합니다. 클래스 안의 메서드 같은 중첩 정의는 클래스 청크 본문에 자연스럽게 포함되므로 별도 청크를 만들지 않습니다." },
        { at: "chunks.insert(0, (\"imports\", f\"[imports]\\n{import_block}\"))", text: "import 블록을 맨 앞 청크로 넣습니다. 각 함수 청크는 어떤 라이브러리를 쓰는지 맥락이 없으면 검색 시 의미를 파악하기 어려우므로, import 정보를 별도 청크로 보존합니다." },
        { at: "step = self.chunk_size - self.chunk_overlap", text: "청크 크기를 초과하는 함수는 슬라이딩 윈도우로 재분할합니다. overlap 덕분에 앞뒤 청크가 100자씩 겹쳐 문맥이 이어집니다." }
      ],
      code: `    def split_python_code(self, code: str) -> list[tuple[str, str]]:
        """파이썬 코드를 AST로 파싱하여 함수/클래스 단위로 청킹함.

        Args:
            code: 파이썬 소스코드

        Returns:
            [(함수/클래스명, 코드내용), ...] 리스트
        """
        lines = code.split("\\n")
        try:
            tree = ast.parse(code)  # 소스를 추상 구문 트리로 변환
        except SyntaxError:
            # 파싱 실패 시 앞부분을 단일 청크로 반환
            return [("", code[:self.chunk_size])]

        # import 문은 모든 함수/클래스가 참조하므로 별도 청크로 추출
        imports = []
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)) and hasattr(node, "lineno"):
                end_line = getattr(node, "end_lineno", node.lineno)
                imports.append("\\n".join(lines[node.lineno - 1:end_line]))
        import_block = "\\n".join(imports) if imports else ""

        chunks = []
        # 최상위 함수·클래스만 순회 (중첩 정의는 본문에 포함됨)
        for node in ast.iter_child_nodes(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                end_line = getattr(node, "end_lineno", node.lineno + 10)
                func_code = "\\n".join(lines[node.lineno - 1:end_line])
                chunks.append((node.name, f"[def {node.name}]\\n{func_code}"))
            elif isinstance(node, ast.ClassDef):
                end_line = getattr(node, "end_lineno", node.lineno + 20)
                class_code = "\\n".join(lines[node.lineno - 1:end_line])
                chunks.append((node.name, f"[class {node.name}]\\n{class_code}"))

        # import 블록이 의미있는 크기면 맨 앞 청크로 추가
        if import_block and len(import_block) > 50:
            chunks.insert(0, ("imports", f"[imports]\\n{import_block}"))

        if not chunks:
            return [("", code[:self.chunk_size])]

        # chunk_size 초과 청크는 overlap을 두고 재분할
        final_chunks = []
        for name, content in chunks:
            if len(content) <= self.chunk_size:
                final_chunks.append((name, content))
            else:
                step = self.chunk_size - self.chunk_overlap
                for i in range(0, len(content), step):
                    final_chunks.append((name, content[i:i + self.chunk_size]))
        return final_chunks`
    },
    {
      id: "ms_indexing_loader_graphragdocumentloader_load_textbook",
      name: "GraphRAGDocumentLoader.load_textbook()",
      fileId: "loader",
      summary: "교재 Markdown 파일 전체를 GraphRAGDocument 목록으로 로드함",
      how: "agentic-ai/textbook 아래 모든 .md 파일을 찾아 교재용 마크다운 청킹 전략을 적용합니다. 진행바로 어떤 파일을 처리 중인지 표시하고, 파일 하나가 실패해도 나머지는 계속 처리합니다.",
      terms: ["GraphRAG", "Microsoft GraphRAG", "Knowledge Graph", "Vector", "tqdm"],
      lines: [
        { at: "files = self._collect_files(self.textbook_dir, \"*.md\")", text: "EXCLUDE_DIRS 목록(venv, __pycache__ 등)을 제외하고 교재 디렉터리 하위의 .md 파일을 모두 수집합니다." },
        { at: "documents.extend(self._chunk_file(file_path, \"교재\"))", text: "파일 1개를 청킹해 GraphRAGDocument 목록으로 변환하고 전체 목록에 추가합니다. source_type을 '교재'로 기록해 나중에 KG 입력임을 식별합니다." },
        { at: "print(f\"교재 청크 수: {len(documents)} ({len(files)}개 파일)\")", text: "최종 청크 수를 출력합니다. 파일 수보다 청크 수가 훨씬 많으면 섹션이 많은 교재가 잘게 분할된 것이고, 비슷하면 교재가 짧다는 신호입니다." }
      ],
      code: `    def load_textbook(self) -> list[GraphRAGDocument]:
        """교재(agentic-ai/textbook/*.md)를 로드함 (KG + Vector 파이프라인 입력).

        Returns:
            GraphRAGDocument 리스트
        """
        print(f"\\n=== 교재 로드 시작: {self.textbook_dir} ===")
        if not self.textbook_dir.exists():
            print(f"경고: 교재 디렉터리가 존재하지 않음: {self.textbook_dir}")
            return []
        files = self._collect_files(self.textbook_dir, "*.md")
        documents = []
        pbar = tqdm(files, desc="교재 로드", unit="file", ncols=80)
        for file_path in pbar:
            pbar.set_postfix_str(file_path.name[:20])
            try:
                documents.extend(self._chunk_file(file_path, "교재"))
            except Exception as e:
                pbar.write(f"파일 로드 실패: {file_path} - {e}")
        print(f"교재 청크 수: {len(documents)} ({len(files)}개 파일)")
        return documents`
    },
    {
      id: "ms_indexing_loader_graphragdocumentloader_load_code",
      name: "GraphRAGDocumentLoader.load_code()",
      fileId: "loader",
      summary: "hands-on 예제코드 전체를 코드 검색용 문서 목록으로 로드함",
      how: "venv, __pycache__, 14.graphrag(자기 자신) 같은 노이즈 폴더는 제외합니다. 자기 자신을 인덱싱하면 이 스크립트들이 검색 결과에 섞여 혼란이 생기므로 14.graphrag를 EXCLUDE_DIRS에 명시합니다.",
      terms: ["GraphRAG", "Microsoft GraphRAG", "Knowledge Graph", "Vector", "tqdm", "Code Search"],
      lines: [
        { at: "files = self._collect_files(self.code_dir, \"*.py\")", text: "EXCLUDE_DIRS(venv, __pycache__, 14.graphrag 등)를 제외하고 hands-on 전체에서 .py 파일을 수집합니다. 14.graphrag를 빼는 이유는 이 인덱싱 코드 자체가 검색 대상에 포함되지 않도록 하기 위해서입니다." },
        { at: "documents.extend(self._chunk_file(file_path, \"예제코드\"))", text: "파일을 AST 기반으로 청킹하고 source_type을 '예제코드'로 기록합니다. 교재와 달리 KG 파이프라인에는 넣지 않고 코드 전용 벡터 인덱스에만 저장합니다." },
        { at: "print(f\"예제코드 청크 수: {len(documents)} ({len(files)}개 파일)\")", text: "청킹 완료 후 파일 수와 청크 수를 비교해 볼 수 있습니다. AST 청킹이므로 함수가 많은 파일은 청크가 많이 나옵니다." }
      ],
      code: `    def load_code(self) -> list[GraphRAGDocument]:
        """예제코드(hands-on/**/*.py)를 로드함 (Vector 전용, KG 미생성).

        Returns:
            GraphRAGDocument 리스트
        """
        print(f"\\n=== 예제코드 로드 시작: {self.code_dir} ===")
        if not self.code_dir.exists():
            print(f"경고: 예제코드 디렉터리가 존재하지 않음: {self.code_dir}")
            return []
        files = self._collect_files(self.code_dir, "*.py")
        documents = []
        pbar = tqdm(files, desc="예제코드 로드", unit="file", ncols=80)
        for file_path in pbar:
            pbar.set_postfix_str(file_path.name[:20])
            try:
                documents.extend(self._chunk_file(file_path, "예제코드"))
            except Exception as e:
                pbar.write(f"파일 로드 실패: {file_path} - {e}")
        print(f"예제코드 청크 수: {len(documents)} ({len(files)}개 파일)")
        return documents`
    },
    {
      id: "ms_indexing_main_prepare_input_documents",
      name: "prepare_input_documents()",
      fileId: "main",
      summary: "교재 청크를 GraphRAG CLI가 읽는 txt 파일로 내보냄",
      how: "기존 입력 txt를 모두 지운 뒤 새 청크를 파일로 저장합니다. 삭제 없이 추가만 하면 이전 실행 파일이 남아 재실행 시 중복 문서가 인덱싱됩니다.",
      terms: ["GraphRAG", "Microsoft GraphRAG", "Knowledge Graph", "tqdm"],
      lines: [
        { at: "for old_file in input_dir.glob(\"*.txt\"):", text: "기존 .txt 파일을 모두 찾아 하나씩 삭제합니다. 재실행 시 이전 교재 내용이 남아 있으면 GraphRAG가 그 파일도 함께 처리해 중복 엔티티가 생깁니다." },
        { at: "old_file.unlink()", text: "파일을 디스크에서 완전히 삭제합니다. 폴더는 그대로 두고 파일만 지워 깨끗한 상태에서 시작합니다." },
        { at: "output_path = input_dir / doc.get_output_filename()", text: "청크마다 고유한 파일명을 만듭니다. 출처 유형·파일명·청크 인덱스를 조합해 같은 파일에서 나온 다른 청크가 같은 이름을 쓰지 않도록 합니다." },
        { at: "f.write(doc.to_text())", text: "메타데이터 헤더(Source/File/Section)와 본문을 합쳐 씁니다. GraphRAG CLI는 이 헤더를 참고해 엔티티 출처를 기록합니다." }
      ],
      code: `def prepare_input_documents(textbook_docs: list[GraphRAGDocument]) -> int:
    """교재 청크를 GraphRAG가 읽는 data/input/*.txt로 내보냄.

    GraphRAG CLI는 input_storage.base_dir(data/input)의 txt 파일만 입력으로 사용함.

    Args:
        textbook_docs: 교재 GraphRAGDocument 리스트

    Returns:
        내보낸 txt 파일 수
    """
    input_dir = settings.input_dir
    ensure_dir(input_dir)

    # 기존 txt를 모두 삭제해 깨끗한 상태에서 시작함
    for old_file in input_dir.glob("*.txt"):
        old_file.unlink()

    exported = 0
    pbar = tqdm(textbook_docs, desc="교재 내보내기", unit="doc", ncols=80)
    for doc in pbar:
        output_path = input_dir / doc.get_output_filename()
        pbar.set_postfix_str(output_path.name[:25])
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(doc.to_text())
            exported += 1
        except Exception as e:
            pbar.write(f"내보내기 실패: {output_path.name} - {e}")

    print(f"교재 내보내기 완료: {exported}개 txt 파일 → {input_dir}")
    return exported`
    },
    {
      id: "ms_indexing_main_progresstracker_process_line",
      name: "ProgressTracker.process_line()",
      fileId: "main",
      summary: "GraphRAG CLI 출력 한 줄을 해석해 진행률 막대를 갱신함",
      how: "CLI가 출력하는 'Starting workflow: xxx', 'N / M', 'Workflow complete: xxx' 패턴을 정규식으로 파싱합니다. stdout을 그대로 보여주면 줄이 너무 많아 읽기 어려우므로 tqdm 진행바로 요약해 표시합니다.",
      terms: ["tqdm"],
      lines: [
        { at: "if (m := self.start_re.search(line)):", text: "'Starting workflow: extract_graph' 같은 줄을 감지합니다. 왈러스 연산자(:=)로 정규식 매칭과 변수 할당을 한 줄에 합쳐 코드를 간결하게 씁니다." },
        { at: "self.workflow_pbar.set_postfix_str(self.current_workflow[:25])", text: "진행바 오른쪽에 현재 워크플로우 이름을 짧게 표시합니다. 어떤 단계가 오래 걸리는지 실시간으로 파악할 수 있습니다." },
        { at: "if self.complete_re.search(line):", text: "'Workflow complete: xxx' 줄을 감지해 워크플로우 진행바를 1 증가시킵니다. 전체 9개 워크플로우 중 몇 개가 끝났는지 상단 진행바에 반영됩니다." },
        { at: "if current > self.item_pbar.n:", text: "N / M 형식에서 현재 값이 진행바보다 앞서 있을 때만 업데이트합니다. 동일하거나 낮은 값이 들어오면 무시해 진행바가 뒤로 가는 이상 현상을 막습니다." }
      ],
      code: `    def process_line(self, line: str):
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
            return`
    },
    {
      id: "ms_indexing_main_run_graphrag_index",
      name: "run_graphrag_index()",
      fileId: "main",
      summary: "Microsoft GraphRAG CLI를 실행해 교재 KG와 벡터 인덱스를 생성함",
      how: "현재 파이썬 인터프리터(sys.executable)로 python -m graphrag index를 실행하고 stdout/stderr를 실시간으로 읽어 진행바에 반영합니다. stdout과 stderr를 각각 별도 스레드로 읽는 이유는 readline()이 블로킹이어서 하나의 스레드만 쓰면 다른 파이프가 꽉 찰 수 있기 때문입니다.",
      terms: ["GraphRAG", "Microsoft GraphRAG", "Knowledge Graph", "Vector", "Parquet", "Groq LPU"],
      lines: [
        { at: "sys.executable, \"-m\", \"graphrag\", \"index\"", text: "PATH의 graphrag.exe 대신 현재 가상환경(venv)의 python으로 graphrag 모듈을 직접 실행합니다. 다른 파이썬 환경에 설치된 CLI가 우선 적용되는 문제를 막습니다." },
        { at: "bufsize=1,", text: "라인 버퍼링을 활성화합니다. 버퍼링 없이 블록 모드면 CLI 출력이 한꺼번에 들어와 진행바를 실시간으로 갱신할 수 없습니다." },
        { at: "threading.Thread(target=_stream_output, args=(process.stdout, tracker, False)),", text: "stdout 읽기 스레드를 생성합니다. stderr와 동시에 처리하기 위해 별도 스레드가 필요합니다. 하나의 스레드로 순차 처리하면 한쪽 파이프가 꽉 차 프로세스가 멈출 수 있습니다." },
        { at: "returncode = process.wait()", text: "CLI 프로세스가 끝날 때까지 블로킹합니다. 스레드는 파이프를 읽는 중이고, 메인 스레드는 여기서 대기합니다." }
      ],
      code: `def run_graphrag_index() -> bool:
    """graphrag CLI로 교재 KG+Vector 인덱싱을 실행함.

    실행 명령: graphrag index --root <indexing_dir>

    Returns:
        성공 여부
    """
    ensure_dir(settings.parquet_dir)
    logger.info("GraphRAG 인덱싱 시작 (Groq LPU: %s)", settings.llm_model)

    print("\\n" + "=" * 60)
    print("GraphRAG 인덱싱 진행 상황")
    print("=" * 60)

    try:
        # graphrag를 'python -m graphrag'로 실행해 현재 인터프리터(venv)의 graphrag를 보장함.
        # (PATH의 graphrag.exe가 다른 인터프리터를 가리켜도 영향받지 않음)
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
    return True`
    },
    {
      id: "ms_indexing_main_verify_index",
      name: "verify_index()",
      fileId: "main",
      summary: "필수 Parquet과 LanceDB 산출물이 만들어졌는지 빠르게 점검함",
      how: "검색 단계가 기대하는 파일이 없으면 검색 오류가 발생합니다. 인덱싱 직후 파일 존재 여부와 행 수를 확인해 문제를 조기에 발견합니다.",
      terms: ["GraphRAG", "Microsoft GraphRAG", "Knowledge Graph", "Vector", "LanceDB", "Parquet"],
      lines: [
        { at: "required = [\"entities.parquet\", \"relationships.parquet\", \"communities.parquet\",", text: "검색에 반드시 필요한 5개 Parquet 파일 목록입니다. 이 중 하나라도 없으면 Local Search나 Global Search가 실패합니다." },
        { at: "print(f\"  [OK] {filename}: {len(pd.read_parquet(filepath))} rows\")", text: "Parquet 파일을 읽어 행 수를 출력합니다. 파일이 있어도 0행이면 GraphRAG가 엔티티를 추출하지 못한 것이므로 LLM 설정을 점검해야 합니다." },
        { at: "lance_files = list(settings.graphrag_vector_dir.rglob(\"*.lance\"))", text: "LanceDB는 .lance 파일 단위로 저장됩니다. 파일이 0개면 벡터 인덱스가 없어 Local Search의 유사도 검색이 동작하지 않습니다." }
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

    # 예제코드 벡터 인덱스 확인
    code_lance = list(settings.code_vector_dir.rglob("*.lance")) if settings.code_vector_dir.exists() else []
    print(f"  [{'OK' if code_lance else 'WARN'}] 예제코드 LanceDB: {len(code_lance)}개 인덱스")

    if missing:
        logger.error("필수 파일 누락: %s", missing)
        return False
    return True`
    },
    {
      id: "ms_indexing_main_main",
      name: "main()",
      fileId: "main",
      summary: "전체 인덱싱 순서를 제어하는 실행 진입점",
      how: "--force, --mode, --code-only 옵션에 따라 초기화, 교재 인덱싱, 후처리, 코드 인덱싱을 순서대로 실행합니다. --code-only는 13분 이상 걸리는 교재 KG를 건너뛰고 코드 벡터 인덱스만 빠르게 재구축할 때 씁니다.",
      terms: ["GraphRAG", "Microsoft GraphRAG", "Knowledge Graph", "Vector", "Embedding", "Parquet"],
      lines: [
        { at: "parser.add_argument(\"--force\", action=\"store_true\"", text: "--force 플래그를 선언합니다. 지정하면 기존 인덱스를 삭제하고 처음부터 다시 만들어 이전 실행의 잔여 데이터가 남아 있는 문제를 해결합니다." },
        { at: "parser.add_argument(\"--code-only\"", text: "--code-only 플래그를 선언합니다. 예제코드 변경이 잦은 경우 교재 KG는 그대로 두고 코드 벡터 인덱스만 수 분 안에 재구축할 수 있습니다." },
        { at: "textbook_docs = loader.load_textbook()", text: "full 모드에서는 교재 전체를 로드합니다. code_docs는 None으로 두고, 5단계의 index_code가 내부에서 직접 로드해 메모리 절약이 됩니다." },
        { at: "finalize_indexing()", text: "GraphRAG CLI 이후 누락된 임베딩을 보완합니다. CLI 중 Ollama OOM이 발생해도 전체 인덱싱은 성공하지만 DRIFT Search가 실패할 수 있으므로 이 단계에서 빈 임베딩을 채웁니다." }
      ],
      code: `def main() -> int:
    """전체 인덱싱 파이프라인 실행 진입점.

    Returns:
        종료 코드 (0=성공, 1=실패)
    """
    parser = argparse.ArgumentParser(description="GraphRAG 3.0 문서 인덱싱")
    parser.add_argument("--force", action="store_true", help="기존 인덱스 삭제 후 재인덱싱")
    parser.add_argument("--mode", choices=["full", "test"], default="full",
                        help="인덱싱 모드: full(전체), test(소량)")
    parser.add_argument("--code-only", action="store_true",
                        help="예제코드 벡터 인덱스만 재구축 (교재 KG 건너뜀)")
    args = parser.parse_args()

    print("=" * 60)
    print(f"GraphRAG 3.0 인덱싱 (Groq {settings.llm_model} + Ollama {settings.embedding_model})")
    print(f"모드: {args.mode}{' / FORCE' if args.force else ''}{' / CODE-ONLY' if args.code_only else ''}")
    print("=" * 60)

    if args.force:
        _clear_indexes(code_only=args.code_only)

    # ── --code-only: 예제코드 인덱싱만 수행 ──
    if args.code_only:
        print("\\n=== 예제코드 벡터 인덱싱 (Vector 전용) ===")
        try:
            index_code(mode=args.mode)
        except Exception as e:
            logger.error("예제코드 인덱싱 실패: %s", e)
            return 1
        verify_index()
        print("\\n" + "=" * 60)
        print("예제코드 인덱싱 완료!")
        print(f"  예제코드 Vector : {settings.code_vector_dir}")
        print("  검증: python validate_index.py")
        print("=" * 60)
        return 0

    # ── 문서 로드 (모드별 분기) ──
    loader = GraphRAGDocumentLoader()
    if args.mode == "test":
        textbook_docs, code_docs = loader.load_specific_files()
    else:
        textbook_docs = loader.load_textbook()
        code_docs = None  # full 모드는 index_code 내부에서 별도 로드

    if not textbook_docs:
        logger.error("교재 문서가 없어 인덱싱을 중단함")
        return 1

    # ── 1단계: 교재 입력 준비 ──
    if prepare_input_documents(textbook_docs) == 0:
        logger.error("준비된 교재 문서가 없음")
        return 1

    # ── 2단계: GraphRAG 인덱싱 (교재 KG + Vector) ──
    if not run_graphrag_index():
        logger.error("GraphRAG 인덱싱 실패")
        return 1

    # ── 3단계: 결과 검증 ──
    if not verify_index():
        logger.warning("일부 산출물 누락 - 후처리를 시도함")

    # ── 4단계: 후처리 (엔티티/커뮤니티 임베딩, DRIFT 지원) ──
    try:
        finalize_indexing()
    except Exception as e:
        logger.error("후처리 실패: %s", e)

    # ── 5단계: 예제코드 벡터 인덱스 (KG 미생성) ──
    print("\\n=== 예제코드 벡터 인덱싱 (Vector 전용) ===")
    try:
        index_code(mode=args.mode, documents=code_docs)
    except Exception as e:
        logger.error("예제코드 인덱싱 실패: %s", e)

    # ── 최종 검증 ──
    verify_index()

    print("\\n" + "=" * 60)
    print("인덱싱 완료!")
    print(f"  교재 KG+Vector : {settings.parquet_dir} / {settings.graphrag_vector_dir}")
    print(f"  예제코드 Vector : {settings.code_vector_dir}")
    print("  검증: python validate_index.py")
    print("=" * 60)
    return 0`
    },
    {
      id: "ms_indexing_finalize_generate_missing_entity_embeddings",
      name: "generate_missing_entity_embeddings()",
      fileId: "finalize",
      summary: "GraphRAG CLI가 만든 엔티티 중 임베딩이 누락된 것을 Ollama로 보완함",
      how: "엔티티의 90% 이상이 이미 임베딩되어 있으면 건너뜁니다. 10% 미만 누락이라도 Local Search의 벡터 유사도 계산에 빠진 엔티티가 포함되지 않아 검색 품질이 낮아집니다.",
      terms: ["GraphRAG", "Microsoft GraphRAG", "Knowledge Graph", "Embedding", "Parquet", "Ollama"],
      lines: [
        { at: "if len(emb_df) >= len(entities_df) * 0.9:", text: "전체 엔티티의 90% 이상 임베딩이 있으면 재생성을 건너뜁니다. 완벽하지 않아도 대부분의 검색에서 문제가 없고, 재생성은 시간이 오래 걸리므로 임계값으로 제어합니다." },
        { at: "entities_df[\"description\"] = entities_df[\"description\"].fillna(entities_df[\"title\"])", text: "description이 None인 엔티티는 title로 대체합니다. 빈 텍스트로 임베딩을 요청하면 Ollama가 빈 벡터([])를 반환해 LanceDB 차원 오류가 납니다." },
        { at: "executor.submit(get_ollama_embedding, f\"{row['title']}: {row['description']}\"", text: "엔티티 제목과 설명을 ':' 로 이어 임베딩합니다. 제목만 넣으면 맥락이 부족하고, 설명만 넣으면 엔티티 이름으로 검색할 때 매칭이 안 됩니다." },
        { at: "pd.DataFrame({\"id\": ids, \"embedding\": embeddings}).to_parquet(embedding_path)", text: "임베딩 결과를 embeddings.entity_description.parquet으로 저장합니다. GraphRAG 검색 엔진이 이 파일을 읽어 벡터 유사도 계산에 사용합니다." }
      ],
      code: `def generate_missing_entity_embeddings(parquet_dir: Path) -> bool:
    """누락된 엔티티 임베딩을 수동 생성함.

    GraphRAG 인덱싱 중 Ollama OOM/타임아웃으로 임베딩이 누락된 경우를 보완함.
    이미 엔티티의 90% 이상 임베딩이 있으면 건너뜀.

    Args:
        parquet_dir: GraphRAG Parquet 출력 디렉터리 (store/parquet)

    Returns:
        성공 여부
    """
    entities_path = parquet_dir / "entities.parquet"
    embedding_path = parquet_dir / "embeddings.entity_description.parquet"

    if not entities_path.exists():
        logger.error("entities.parquet 없음 - 엔티티 임베딩 보완 불가")
        return False

    entities_df = pd.read_parquet(entities_path)

    # 이미 임베딩이 충분하면(엔티티의 90% 이상) 재생성을 건너뜀
    if embedding_path.exists():
        try:
            emb_df = pd.read_parquet(embedding_path)
            if len(emb_df) >= len(entities_df) * 0.9:
                logger.info("엔티티 임베딩이 이미 충분함 (%d/%d) - 건너뜀", len(emb_df), len(entities_df))
                return True
        except Exception:
            pass  # 파일 손상 시 재생성

    # description이 없으면 title로 대체
    if "description" not in entities_df.columns:
        entities_df["description"] = entities_df["title"]
    entities_df["description"] = entities_df["description"].fillna(entities_df["title"])

    logger.info("엔티티 임베딩 수동 생성 시작: %d개", len(entities_df))
    model_name = settings.embedding_model
    embeddings, ids = [], []

    with ThreadPoolExecutor(max_workers=EMBED_WORKERS) as executor:
        futures = [
            executor.submit(get_ollama_embedding, f"{row['title']}: {row['description']}", model_name)
            for _, row in entities_df.iterrows()
        ]
        for (_, row), future in tqdm(zip(entities_df.iterrows(), futures), total=len(entities_df), desc="엔티티 임베딩", ncols=80):
            emb = future.result()
            if emb is not None:
                embeddings.append(emb)
                ids.append(row["id"])

    if not embeddings:
        logger.error("엔티티 임베딩 생성 실패")
        return False

    pd.DataFrame({"id": ids, "embedding": embeddings}).to_parquet(embedding_path)
    logger.info("엔티티 임베딩 저장 완료: %d개", len(ids))
    return True`
    },
    {
      id: "ms_indexing_finalize_generate_community_report_embeddings",
      name: "generate_community_report_embeddings()",
      fileId: "finalize",
      summary: "DRIFT Search용 커뮤니티 리포트 full_content 임베딩을 생성하고 LanceDB 테이블을 만듦",
      how: "GraphRAG CLI가 community_full_content 임베딩을 자동으로 생성하지 않을 때 이 함수가 보완합니다. DRIFT Search는 커뮤니티 리포트 전문을 벡터 검색해 질문 관련 커뮤니티를 찾으므로 이 테이블이 없으면 DRIFT 검색이 실패합니다.",
      terms: ["GraphRAG", "Microsoft GraphRAG", "Knowledge Graph", "Vector", "Embedding", "LanceDB"],
      lines: [
        { at: "if \"full_content_embedding\" in cr_df.columns:", text: "이미 full_content_embedding 컬럼이 있는지 확인합니다. GraphRAG 버전에 따라 CLI가 자동으로 생성하기도 하므로, 있으면 90% 임계값으로만 검사해 불필요한 재생성을 피합니다." },
        { at: "non_null = cr_df[\"full_content_embedding\"].notna().sum()", text: "None이 아닌 임베딩 개수를 셉니다. LLM 타임아웃이나 OOM으로 일부만 생성된 경우 나머지를 보완합니다." },
        { at: "return _build_community_lancedb(cr_df, lancedb_dir)", text: "임베딩이 준비되면 LanceDB community_full_content 테이블을 생성합니다. DRIFT Search는 이 테이블을 진입점으로 질문과 가장 관련된 커뮤니티를 찾아 답변을 구성합니다." }
      ],
      code: `def generate_community_report_embeddings(parquet_dir: Path, lancedb_dir: Path) -> bool:
    """커뮤니티 리포트 full_content 임베딩을 생성하고 LanceDB 테이블을 만듦 (DRIFT Search용).

    DRIFT Search는 community_reports의 full_content 임베딩이 필요함.
    GraphRAG에서 자동 생성되지 않으면 여기서 보완함.

    Args:
        parquet_dir: GraphRAG Parquet 출력 디렉터리 (store/parquet)
        lancedb_dir: GraphRAG LanceDB 디렉터리 (store/vector/graphrag)

    Returns:
        성공 여부
    """
    cr_path = parquet_dir / "community_reports.parquet"
    if not cr_path.exists():
        logger.warning("community_reports.parquet 없음 - DRIFT 임베딩 건너뜀")
        return False

    cr_df = pd.read_parquet(cr_path)
    if len(cr_df) == 0:
        logger.warning("community_reports가 비어있음 - DRIFT 임베딩 건너뜀")
        return False

    # 이미 임베딩이 90% 이상 있으면 재생성을 건너뜀
    if "full_content_embedding" in cr_df.columns:
        non_null = cr_df["full_content_embedding"].notna().sum()
        if non_null >= len(cr_df) * 0.9:
            logger.info("커뮤니티 리포트 임베딩이 이미 충분함 (%d/%d)", non_null, len(cr_df))
        else:
            cr_df = _embed_community_reports(cr_df, cr_path)
    else:
        cr_df = _embed_community_reports(cr_df, cr_path)

    # LanceDB community_full_content 테이블 생성 (DRIFT Search 진입점)
    return _build_community_lancedb(cr_df, lancedb_dir)`
    },
    {
      id: "ms_indexing_finalize_finalize_indexing",
      name: "finalize_indexing()",
      fileId: "finalize",
      summary: "GraphRAG CLI 이후 필요한 임베딩 보완 작업을 한 번에 수행하는 진입점",
      how: "엔티티 임베딩 보완과 커뮤니티 리포트 임베딩 생성을 순서대로 호출합니다. index_documents.py의 4단계에서 자동 호출됩니다.",
      terms: ["GraphRAG", "Microsoft GraphRAG", "Knowledge Graph", "Vector", "Embedding", "LanceDB"],
      lines: [
        { at: "parquet_dir = settings.parquet_dir", text: "settings에서 Parquet 디렉터리 경로를 가져옵니다. 하드코딩 없이 settings를 통해 경로를 참조하므로 경로가 바뀌어도 이 파일은 수정할 필요가 없습니다." },
        { at: "generate_missing_entity_embeddings(parquet_dir)", text: "먼저 엔티티 임베딩을 보완합니다. 엔티티 임베딩이 없으면 Local Search의 entity-level 유사도 검색이 제대로 동작하지 않습니다." },
        { at: "generate_community_report_embeddings(parquet_dir, lancedb_dir)", text: "그 다음 커뮤니티 리포트 임베딩을 생성합니다. 엔티티 보완 후 커뮤니티를 처리하는 순서를 지킵니다." }
      ],
      code: `def finalize_indexing() -> None:
    """인덱싱 후처리 진입점.

    index_documents.py의 GraphRAG 인덱싱 직후 자동 호출됨.
    1) 엔티티 임베딩 보완 → 2) 커뮤니티 리포트 임베딩 + LanceDB 테이블(DRIFT) 생성.
    """
    parquet_dir = settings.parquet_dir
    lancedb_dir = settings.graphrag_vector_dir

    logger.info("=== 인덱싱 후처리 시작 ===")
    generate_missing_entity_embeddings(parquet_dir)
    generate_community_report_embeddings(parquet_dir, lancedb_dir)
    logger.info("=== 인덱싱 후처리 완료 ===")`
    },
    {
      id: "ms_indexing_code_get_ollama_embedding",
      name: "get_ollama_embedding()",
      fileId: "code",
      summary: "Ollama HTTP API로 텍스트 한 건을 임베딩해 4096차원 벡터를 반환함",
      how: "requests.post로 Ollama /api/embeddings 엔드포인트에 JSON을 보내고 응답에서 embedding 키를 꺼냅니다. 실패 시 None을 반환해 호출부에서 해당 청크를 건너뛸 수 있게 합니다.",
      terms: ["Embedding", "Ollama", "Code Search"],
      lines: [
        { at: "url = f\"{settings.ollama_base_url}/api/embeddings\"", text: "Ollama 임베딩 API URL을 settings에서 가져옵니다. 로컬 기본값은 http://localhost:11434/api/embeddings입니다." },
        { at: "payload = {\"model\": model, \"prompt\": text}", text: "Ollama 임베딩 API는 입력 키로 'prompt'를 씁니다. OpenAI 임베딩 API의 'input'과 다르므로 혼동하지 않아야 합니다." },
        { at: "response = requests.post(url, json=payload, timeout=120)", text: "타임아웃을 120초로 설정합니다. qwen3-embedding은 첫 요청 시 모델 로딩 시간이 필요해 짧은 타임아웃이면 연결이 끊길 수 있습니다." },
        { at: "return response.json().get(\"embedding\")", text: "응답 JSON에서 embedding 키를 꺼냅니다. 키가 없으면 None을 반환하고 호출부가 실패 청크로 처리합니다." }
      ],
      code: `def get_ollama_embedding(text: str, model: str) -> list[float] | None:
    """Ollama API로 텍스트 1건을 임베딩함.

    Args:
        text: 임베딩할 텍스트
        model: 임베딩 모델명 (qwen3-embedding)

    Returns:
        임베딩 벡터(리스트) 또는 None(실패 시)
    """
    url = f"{settings.ollama_base_url}/api/embeddings"
    # Ollama 임베딩 API는 단일 입력 키로 "prompt"를 사용함
    payload = {"model": model, "prompt": text}
    try:
        response = requests.post(url, json=payload, timeout=120)
        if response.status_code == 200:
            return response.json().get("embedding")
        logger.warning("임베딩 실패(status=%s): %s", response.status_code, response.text[:200])
        return None
    except Exception as e:
        logger.warning("Ollama 연결 오류: %s", e)
        return None`
    },
    {
      id: "ms_indexing_code_build_code_vector_index",
      name: "build_code_vector_index()",
      fileId: "code",
      summary: "예제코드 청크를 병렬 임베딩해 LanceDB code_chunks 테이블로 저장함",
      how: "ThreadPoolExecutor로 EMBED_WORKERS(4개) 스레드가 동시에 임베딩을 요청합니다. Ollama가 OLLAMA_NUM_PARALLEL=4로 설정되어 있어 병렬 요청을 처리할 수 있습니다. 차원 검증으로 빈 텍스트의 [] 벡터를 걸러 LanceDB 스키마 오류를 막습니다.",
      terms: ["GraphRAG", "Microsoft GraphRAG", "Knowledge Graph", "Vector", "Embedding", "LanceDB"],
      lines: [
        { at: "futures = [executor.submit(get_ollama_embedding, doc.content, model_name) for doc in documents]", text: "모든 청크의 임베딩을 한꺼번에 제출합니다. submit()은 즉시 반환하므로 EMBED_WORKERS 스레드가 동시에 Ollama에 요청을 보냅니다." },
        { at: "dim_counter = Counter(len(r[\"vector\"]) for r in rows)", text: "모든 벡터의 차원을 세어 가장 많이 나온 차원을 정상 차원으로 결정합니다. Ollama는 빈 텍스트에 빈 벡터([])를 반환하는데, None이 아니라서 위에서 걸러지지 않습니다. 여기서 차원 불일치 벡터를 제거합니다." },
        { at: "dominant_dim = dim_counter.most_common(1)[0][0]", text: "가장 많이 등장한 차원이 정상 차원입니다. LanceDB는 첫 번째 행으로 테이블 스키마를 고정하므로, 이상 차원이 앞에 오면 전체가 잘못된 스키마로 저장됩니다." },
        { at: "if CODE_TABLE_NAME in db.table_names():", text: "기존 테이블이 있으면 삭제 후 새로 만듭니다. 기존 테이블에 추가(append)하면 이전 청크가 남아 삭제된 파일의 코드도 검색 결과에 나옵니다." }
      ],
      code: `def build_code_vector_index(documents: list[GraphRAGDocument]) -> bool:
    """예제코드 청크를 임베딩하여 LanceDB 벡터 인덱스로 저장함.

    Args:
        documents: 예제코드 GraphRAGDocument 리스트

    Returns:
        성공 여부
    """
    if not documents:
        logger.warning("예제코드 문서가 없어 벡터 인덱스를 건너뜀")
        return False

    model_name = settings.embedding_model
    logger.info("예제코드 임베딩 시작: %d개 청크 (모델=%s)", len(documents), model_name)

    # 병렬로 임베딩 생성 (제출 순서를 보존해 메타데이터와 1:1 매핑)
    with ThreadPoolExecutor(max_workers=EMBED_WORKERS) as executor:
        futures = [executor.submit(get_ollama_embedding, doc.content, model_name) for doc in documents]
        rows = []
        for doc, future in tqdm(zip(documents, futures), total=len(documents), desc="코드 임베딩", ncols=80):
            embedding = future.result()
            if embedding is None:
                continue  # 실패 청크는 제외
            rows.append({
                "id": f"{doc.get_output_filename()}",                  # 청크 고유 ID
                "vector": embedding,                                    # 임베딩 벡터 (LanceDB는 'vector' 컬럼 요구)
                "text": doc.content[:4000],                             # 원문 (검색 결과 표시용, 길이 제한)
                "source": doc.metadata["source"],                      # 원본 파일 절대경로
                "filename": doc.metadata["filename"],                  # 파일명
                "chunk_index": int(doc.metadata["chunk_index"]),       # 청크 인덱스
                "section_title": doc.metadata["section_title"],         # 함수/클래스명
            })

    if not rows:
        logger.error("임베딩에 성공한 청크가 없음 (Ollama 서버 확인 필요)")
        return False

    # 지배적인 차원을 결정하고 비정상 벡터(길이 0 또는 불일치) 필터링
    # Ollama는 빈/공백 텍스트에 [] 반환 → None이 아니라서 위 None 체크를 통과함
    # LanceDB는 첫 row로 스키마(FixedSizeList 차원)를 추론하므로 사전 필터 필수
    dim_counter = Counter(len(r["vector"]) for r in rows)
    dominant_dim = dim_counter.most_common(1)[0][0]
    valid_rows = [r for r in rows if len(r["vector"]) == dominant_dim]
    dropped = len(rows) - len(valid_rows)
    if dropped:
        logger.warning("비정상 벡터 %d개 제외 (차원 분포: %s → 유효 차원: %d)",
                       dropped, dict(dim_counter), dominant_dim)
    rows = valid_rows

    if not rows:
        logger.error("유효한 벡터가 없음")
        return False

    logger.info("인덱싱 대상: %d개 (전체 %d개 중 %d개 제외)",
                len(rows), len(rows) + dropped, dropped)

    # LanceDB에 연결하여 테이블을 재구성함 (항상 최신 데이터로 갱신)
    settings.code_vector_dir.mkdir(parents=True, exist_ok=True)
    db = lancedb.connect(str(settings.code_vector_dir))
    if CODE_TABLE_NAME in db.table_names():
        db.drop_table(CODE_TABLE_NAME)
    db.create_table(CODE_TABLE_NAME, rows)
    logger.info("예제코드 벡터 인덱스 생성 완료: %d개 (%s/%s.lance)",
                len(rows), settings.code_vector_dir, CODE_TABLE_NAME)
    return True`
    },
    {
      id: "ms_indexing_code_index_code",
      name: "index_code()",
      fileId: "code",
      summary: "예제코드 벡터 인덱싱의 진입점 — 문서를 받거나 직접 로드해 인덱스를 구축함",
      how: "documents가 None이면 로더를 직접 호출합니다. test 모드는 지정된 2개 파일만 사용하고, full 모드는 hands-on 전체를 로드합니다. documents를 외부에서 전달받으면 이미 로드된 문서를 재사용해 중복 파일 읽기를 줄입니다.",
      terms: ["GraphRAG", "Microsoft GraphRAG", "Knowledge Graph", "Vector", "Code Search"],
      lines: [
        { at: "if documents is None:", text: "문서가 미리 전달되지 않은 경우에만 로더를 새로 만듭니다. main()의 test 모드에서는 load_specific_files()로 이미 로드한 문서를 재사용하므로 이 분기에 들어오지 않습니다." },
        { at: "_, documents = loader.load_specific_files()", text: "test 모드에서는 지정된 2개 파일(agentic-rag app.py, indexing.py)만 로드합니다. 전체 인덱싱은 수십 분이 걸리므로 빠른 검증을 위해 소량만 사용합니다." },
        { at: "return build_code_vector_index(documents)", text: "실제 임베딩과 LanceDB 저장은 build_code_vector_index()에 위임합니다. 진입점 역할만 하고 핵심 로직을 분리해 테스트와 재사용이 쉽습니다." }
      ],
      code: `def index_code(mode: str = "full", documents: list[GraphRAGDocument] | None = None) -> bool:
    """예제코드 벡터 인덱싱 진입점.

    Args:
        mode: "full"(전체) 또는 "test"(소량)
        documents: 외부에서 미리 로드한 문서 (test 모드에서 재사용)

    Returns:
        성공 여부
    """
    if documents is None:
        loader = GraphRAGDocumentLoader()
        if mode == "test":
            _, documents = loader.load_specific_files()
        else:
            documents = loader.load_code()
    return build_code_vector_index(documents)`
    },
    {
      id: "ms_indexing_utils_ensure_dir",
      name: "ensure_dir()",
      fileId: "utils",
      summary: "경로가 없으면 부모 디렉터리까지 포함해 생성하고 경로를 반환함",
      how: "Path.mkdir(parents=True, exist_ok=True)로 중간 디렉터리를 한 번에 만듭니다. 파일 저장 직전에 호출해 '경로 없음' 오류를 예방합니다.",
      terms: [],
      lines: [
        { at: "path.mkdir(parents=True, exist_ok=True)", text: "parents=True는 중간 디렉터리도 함께 만듭니다. exist_ok=True는 이미 있어도 오류를 내지 않습니다. 둘 다 없으면 경로 일부가 없거나 이미 있을 때 예외가 납니다." },
        { at: "return path", text: "생성된 경로를 그대로 반환합니다. 호출 코드에서 ensure_dir(path) / 'filename' 처럼 체이닝할 수 있습니다." }
      ],
      code: `def ensure_dir(path: Path) -> Path:
    """디렉터리를 생성함 (없을 때만).

    Args:
        path: 생성할 디렉터리 경로

    Returns:
        생성된(또는 기존) 디렉터리 경로
    """
    # parents=True: 상위 디렉터리도 자동 생성, exist_ok=True: 이미 있으면 무시
    path.mkdir(parents=True, exist_ok=True)
    return path`
    },
    {
      id: "ms_indexing_utils_get_logger",
      name: "get_logger()",
      fileId: "utils",
      summary: "콘솔(stdout)에 로그를 출력하는 일관된 포맷의 로거를 생성함",
      how: "logging.getLogger()는 같은 이름으로 부르면 동일 인스턴스를 반환합니다. 여러 모듈이 같은 로거를 임포트해도 핸들러가 중복 추가되지 않도록 handlers가 비어 있을 때만 설정합니다.",
      terms: [],
      lines: [
        { at: "if not logger.handlers:", text: "이미 핸들러가 등록되어 있으면 추가를 건너뜁니다. 같은 모듈을 여러 번 임포트하거나 테스트에서 반복 호출해도 로그가 두 번씩 찍히지 않습니다." },
        { at: "console_handler = logging.StreamHandler(sys.stdout)", text: "로그를 표준 출력(stdout)으로 내보냅니다. stderr가 아닌 stdout을 쓰는 이유는 tqdm 진행바와 충돌하지 않고 출력 순서가 일관되게 유지되기 때문입니다." },
        { at: "datefmt=\"%Y-%m-%d %H:%M:%S\",", text: "날짜 형식을 '2026-05-31 12:34:56' 형태로 고정합니다. 로그 파일을 시간순으로 정렬하거나 특정 시각의 로그를 찾을 때 이 형식이 편리합니다." }
      ],
      code: `def get_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """일관된 포맷의 로거 인스턴스를 생성함.

    중복 핸들러 방지를 위해 핸들러가 없을 때만 추가함.

    Args:
        name: 로거 이름 (보통 모듈명 사용)
        level: 로깅 레벨 (DEBUG/INFO/WARNING/ERROR/CRITICAL)

    Returns:
        설정된 로거 인스턴스
    """
    # 지정된 이름으로 로거를 가져옴 (없으면 새로 생성)
    logger = logging.getLogger(name)

    # 핸들러가 이미 있으면 중복 추가를 방지함
    if not logger.handlers:
        logger.setLevel(level)

        # 콘솔 핸들러: 표준 출력으로 로그를 내보냄
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(level)

        # 로그 메시지 형식: "2026-05-31 12:34:56 - name - INFO - 메시지"
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    return logger`
    }
  ],
  glossary: {
    "AST": "Abstract Syntax Tree(추상 구문 트리). 파이썬 소스 코드를 문법 구조로 파싱한 트리입니다. 함수·클래스의 정확한 시작·끝 줄 번호를 알 수 있어 경계에서 청크를 자를 때 씁니다.",
    "Code Search": "예제코드만 별도 LanceDB 벡터 인덱스(code_chunks)에서 찾는 검색 모드입니다. 교재 KG와 분리해 관리합니다.",
    "Embedding": "텍스트를 고차원 숫자 벡터로 변환하는 처리입니다. 의미가 비슷한 텍스트끼리 벡터 공간에서 가깝게 놓여 유사도 검색이 가능합니다.",
    "GraphRAG": "문서에서 개념과 관계를 뽑아 지식 그래프를 만들고, 그래프 탐색과 벡터 검색을 결합해 질문에 답하는 RAG 방식입니다.",
    "Groq LPU": "Groq사의 LPU(Language Processing Unit) 칩을 활용한 빠른 LLM API 서비스입니다. OpenAI와 호환되는 API로 호출합니다.",
    "Knowledge Graph": "사람·개념·기술 같은 엔티티를 노드로, 관계를 엣지로 표현한 지식 지도입니다. GraphRAG가 교재에서 자동으로 구축합니다.",
    "LanceDB": "로컬 파일로 저장되는 벡터 데이터베이스입니다. 서버 없이 .lance 파일 형식으로 임베딩을 저장하고 유사도 검색을 수행합니다.",
    "Microsoft GraphRAG": "Microsoft의 GraphRAG 구현체입니다. graphrag CLI로 교재를 처리해 Parquet 형식의 엔티티·관계·커뮤니티 산출물과 LanceDB 벡터 인덱스를 생성합니다.",
    "Ollama": "로컬에서 LLM과 임베딩 모델을 실행하는 도구입니다. 외부 API 없이 PC에서 qwen3-embedding을 구동해 4096차원 벡터를 생성합니다.",
    "Parquet": "표 형태 데이터를 컬럼 단위로 저장하는 바이너리 파일 형식입니다. 대용량 데이터를 빠르게 읽고 쓸 수 있어 GraphRAG 산출물 저장에 씁니다.",
    "Vector": "텍스트 의미를 숫자 목록으로 바꾼 값입니다. 두 벡터가 가까울수록(코사인 유사도가 높을수록) 의미가 비슷하다고 봅니다.",
    "tqdm": "터미널 진행률 막대를 표시하는 파이썬 라이브러리입니다. 반복문 처리 중 현재 진행 상황을 시각적으로 보여줍니다."
  }
};
