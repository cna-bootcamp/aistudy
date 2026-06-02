window.EXPLAIN_DATA = {
  meta: { title: "LightRAG 인덱싱 파이프라인", entry: "index_documents.py" },
  files: [
    { id: "main",     label: "index_documents.py",    role: "실행 진입점 — 2단계 인덱싱 파이프라인 오케스트레이터" },
    { id: "loader",   label: "document_loader.py",    role: "교재(.md)·예제코드(.py)를 데이터소스별로 분리 로드" },
    { id: "llm",      label: "llm_func.py",           role: "Groq LLM 함수·Ollama 임베딩 함수 생성 및 사전 점검" },
    { id: "kg",       label: "kg_builder.py",         role: "LightRAG ainsert()로 교재 → KG + 벡터 동시 구축" },
    { id: "code_vec", label: "code_vector_index.py",  role: "예제코드 청킹 → qwen3-embedding → nano-vectordb 저장" },
    { id: "settings", label: "config/settings.py",    role: "경로·LLM·임베딩·청킹 전역 설정 관리" }
  ],
  flow: [
    { step: 1, title: "설정 로드",       summary: "경로·API키·모델 설정 초기화",          detail: "Settings 클래스가 __file__ 위치를 기준으로 모든 경로를 자동 계산하고, hands-on/.env에서 API 키를 읽습니다. GPS가 현재 위치로 목적지 경로를 계산하는 것과 같습니다." },
    { step: 2, title: "사전 점검",       summary: "Groq API키·Ollama·임베딩 차원 검증",  detail: "인덱싱 전 3가지를 미리 확인합니다: ① Groq API 키가 있는지, ② Ollama 서버가 실행 중인지, ③ 임베딩이 기대 차원(4096)을 반환하는지. 문제가 있으면 대량 작업 전에 즉시 중단합니다." },
    { step: 3, title: "문서 로드",       summary: "교재·예제코드 파일 목록 수집",         detail: "DocumentLoader가 교재(.md)와 예제코드(.py)를 분리해서 읽습니다. venv·캐시·explain 폴더는 자동으로 제외합니다." },
    { step: 4, title: "Phase 1: KG 구축", summary: "교재 → LightRAG insert → GraphML + 벡터 + KV", detail: "KGBuilder가 LightRAG ainsert()를 호출합니다. 한 번의 호출로 ① LLM(Groq)으로 개념·관계 추출 → GraphML 저장, ② 청크/개체 임베딩 → nano-vectordb 저장, ③ 원문 → KV Store 저장을 모두 수행합니다." },
    { step: 5, title: "Phase 2: 코드 벡터", summary: "예제코드 → 청킹 → 임베딩 → nano-vectordb", detail: "CodeVectorIndexer가 예제코드를 1200자 단위로 잘라(청킹), Ollama qwen3-embedding으로 벡터화한 뒤 JSON 파일(vdb_code.json)에 저장합니다. KG는 생성하지 않습니다." },
    { step: 6, title: "결과 요약",       summary: "성공/스킵/노드 수 로그 출력",          detail: "각 단계의 통계를 출력합니다. KG 노드가 0개면 LLM 추출 실패 경고를, 정상이면 validate_index.py 실행을 안내합니다." }
  ],
  functions: [
    {
      id: "fn_main",
      name: "main()",
      fileId: "main",
      summary: "전체 인덱싱 파이프라인 실행 순서 정의",
      how: "설정 로드 → 사전 점검 → (--force면 초기화) → 문서 로드 → Phase 1 KG 구축 → Phase 2 코드 벡터 구축 → 통계 출력 순서로 실행합니다.",
      terms: ["LightRAG", "KGBuilder_class", "CodeVectorIndexer_class"],
      lines: [
        { at: "settings = Settings()", text: "Settings 객체를 만들어 경로·API키 등 설정을 로드합니다." },
        { at: "check_groq_key(settings)", text: "Groq API 키가 있는지 확인합니다. 없으면 즉시 중단합니다." },
        { at: "smoke_test_embedding(settings)", text: "임베딩 1건을 실제 호출해 차원(4096)이 맞는지 미리 검증합니다." },
        { at: "kg_stats = KGBuilder(settings)", text: "교재 문서들로 KG+벡터 인덱스를 구축합니다." },
        { at: "code_stats = CodeVectorIndexer(settings)", text: "예제코드들로 코드 전용 벡터 인덱스를 구축합니다." }
      ],
      code: `def main() -> None:
    """문서 로드 → 교재 KG 구축 → 예제코드 벡터 인덱스 구축 → 통계 출력."""
    args = parse_args()
    logger.info("=" * 60)
    logger.info("LightRAG GraphRAG 인덱싱 시작 (mode=%s, force=%s)", args.mode, args.force)
    logger.info("=" * 60)

    # 1. 설정 로드 + 경로 검증 (LLM/임베딩 호출 전 경로부터 확인)
    settings = Settings()
    log_resolved_paths(settings)

    # 2. 사전 점검: 환경 미비 시 인덱싱 전에 명확히 중단
    check_groq_key(settings)
    check_ollama(settings)
    smoke_test_embedding(settings)

    # 3. --force면 저장소 초기화
    if args.force:
        logger.info("--force: 저장소 초기화")
        reset_stores(settings)

    # 4. 문서 로드 (cheap 단계 — LLM 호출 없음)
    loader = DocumentLoader(settings)
    kg_docs, code_docs = load_documents(settings, loader, args.mode)
    logger.info("KG 대상 교재: %d개 / 코드 벡터 대상 예제코드: %d개", len(kg_docs), len(code_docs))

    # 5. [Phase 1] 교재 KG 구축 (LightRAG insert — LLM 추출 단계)
    kg_stats = {"success": 0, "skipped": [], "total": 0, "kg_nodes": 0}
    if kg_docs:
        logger.info("-" * 60)
        logger.info("[Phase 1] 교재 KG 구축 시작 (%d개 파일)", len(kg_docs))
        kg_stats = KGBuilder(settings).build_from_documents(kg_docs)
    else:
        logger.warning("KG 인덱싱 대상 교재 없음 → Phase 1 스킵")

    # 6. [Phase 2] 예제코드 벡터 인덱스 구축 (nano-vectordb)
    code_stats = {"success": 0, "skipped": [], "chunks": 0, "total": 0}
    if code_docs:
        logger.info("-" * 60)
        logger.info("[Phase 2] 예제코드 벡터 인덱스 구축 시작 (%d개 파일)", len(code_docs))
        code_stats = CodeVectorIndexer(settings).build_from_documents(code_docs)
    else:
        logger.warning("코드 벡터 인덱싱 대상 예제코드 없음 → Phase 2 스킵")

    # 7. 최종 요약
    logger.info("=" * 60)
    logger.info("인덱싱 요약")
    logger.info("  교재 KG : insert 성공 %d / 스킵 %d / 추출 노드 %d개 / 전체 %d",
                kg_stats["success"], len(kg_stats["skipped"]), kg_stats.get("kg_nodes", 0), kg_stats["total"])
    logger.info("  코드 벡터: 성공 %d / 스킵 %d / 청크 %d / 전체 %d",
                code_stats["success"], len(code_stats["skipped"]),
                code_stats["chunks"], code_stats["total"])
    if kg_docs and kg_stats.get("kg_nodes", 0) == 0:
        logger.error("인덱싱 경고: 교재 KG 노드 0개(엔티티 추출 실패). LLM 모델/파라미터·로그를 확인하세요.")
    else:
        logger.info("인덱싱 완료! 검증: python validate_index.py")
    logger.info("=" * 60)`
    },
    {
      id: "fn_smoke",
      name: "smoke_test_embedding()",
      fileId: "main",
      summary: "임베딩 1건 실행으로 차원·연결 사전 검증",
      how: "실제 임베딩 함수를 1회 호출해 반환된 벡터 차원이 설정값(4096)과 일치하는지 확인합니다. 불일치면 즉시 오류를 발생시켜 수천 건 처리 전에 문제를 차단합니다.",
      terms: ["asyncio_run", "smoke_test"],
      lines: [
        { at: "embed = create_embed_callable(settings)", text: "Ollama 임베딩 함수를 준비합니다." },
        { at: "vecs = asyncio.run(", text: "테스트 문장 1개를 실제로 임베딩해봅니다. asyncio.run()은 비동기 함수를 동기 코드에서 실행하는 방법입니다." },
        { at: "dim = vecs.shape[1]", text: "반환된 벡터의 차원 수를 꺼냅니다. numpy 배열이면 .shape[1], 리스트면 len()으로 구합니다." },
        { at: "if dim != settings.embedding_dim:", text: "기대 차원(4096)과 실제 차원이 다르면 오류를 발생시킵니다." }
      ],
      code: `def smoke_test_embedding(settings: Settings) -> None:
    """임베딩이 실제 설정 차원(4096)을 반환하는지 1건으로 사전 검증 (대량 실행 전 안전장치)."""
    embed = create_embed_callable(settings)
    # asyncio.run(): 동기 컨텍스트에서 비동기 임베딩 1회 실행
    vecs = asyncio.run(embed(["임베딩 차원 확인용 테스트 문장"]))
    dim = vecs.shape[1] if hasattr(vecs, "shape") else len(vecs[0])
    if dim != settings.embedding_dim:
        raise RuntimeError(f"임베딩 차원 불일치: 기대 {settings.embedding_dim}, 실제 {dim}")
    logger.info("임베딩 스모크 테스트 통과: %d차원", dim)`
    },
    {
      id: "fn_load_kg",
      name: "load_for_kg()",
      fileId: "loader",
      summary: "교재(.md)만 수집하여 KG 인덱싱 대상 반환",
      how: "textbook_dir 하위의 .md 파일을 모두 찾아 읽고, {file_path, content, doc_type:'textbook'} 형태의 딕셔너리 목록으로 반환합니다.",
      terms: ["rglob", "doc_dict"],
      lines: [
        { at: "textbook_dir.rglob", text: "교재 폴더 안의 .md 파일을 하위 폴더까지 모두 찾아 정렬합니다." },
        { at: "_read_files(files,", text: "파일 목록을 실제로 읽어 딕셔너리 리스트로 변환합니다." }
      ],
      code: `def load_for_kg(self) -> list[dict]:
    """KG 인덱싱 대상: 교재(.md)만 로드 → LightRAG insert()로 KG+Vector 구축."""
    if not self.settings.textbook_dir.exists():
        logger.warning("교재 디렉터리 없음: %s", self.settings.textbook_dir)
        return []
    # rglob("*.md"): 하위 디렉터리까지 재귀 탐색하여 모든 마크다운 수집
    files = sorted(self.settings.textbook_dir.rglob("*.md"))
    docs = self._read_files(files, "textbook")
    logger.info("교재 로드 완료: %d개 파일", len(docs))
    return docs`
    },
    {
      id: "fn_load_vector",
      name: "load_for_vector()",
      fileId: "loader",
      summary: "예제코드(.py)만 수집하여 벡터 인덱싱 대상 반환",
      how: "examples_dir 하위의 .py 파일을 수집합니다. _collect_code_files()를 통해 venv·캐시·explain 등 불필요한 폴더를 제외합니다.",
      terms: ["nano_vectordb"],
      lines: [
        { at: "self._collect_code_files()", text: "제외 폴더를 건너뛰며 .py 파일을 수집하는 헬퍼를 호출합니다." },
        { at: "examples_dir.exists()", text: "예제코드 디렉터리가 존재하는지 먼저 확인합니다." }
      ],
      code: `def load_for_vector(self) -> list[dict]:
    """Vector 인덱싱 대상: 예제코드(.py)만 로드 → 별도 nano-vectordb 구축 (KG 미생성).

    교재와 달리 코드는 LightRAG insert()를 거치지 않고 코드 벡터 인덱스에만 저장함.
    """
    if not self.settings.examples_dir.exists():
        logger.warning("예제코드 디렉터리 없음: %s", self.settings.examples_dir)
        return []
    files = self._collect_code_files()
    docs = self._read_files(files, "code")
    logger.info("예제코드 로드 완료: %d개 파일", len(docs))
    return docs`
    },
    {
      id: "fn_collect_code",
      name: "_collect_code_files()",
      fileId: "loader",
      summary: "venv·캐시 폴더를 제외하고 .py 파일만 수집",
      how: "os.walk()로 폴더를 순회하면서 dirs[:] 가지치기 기법으로 불필요한 하위 폴더 탐색 자체를 차단합니다.",
      terms: ["os_walk", "dirs_prune"],
      lines: [
        { at: "dirs[:] = [d for d in dirs", text: "현재 폴더의 하위 폴더 목록에서 venv, __pycache__ 등을 제거합니다. os.walk()가 그 폴더에는 아예 들어가지 않습니다." },
        { at: "name.endswith", text: ".py 확장자인 파일만 목록에 추가합니다." }
      ],
      code: `def _collect_code_files(self) -> list[Path]:
    """examples 디렉터리를 순회하며 제외 폴더를 건너뛰고 .py 파일만 수집."""
    # os.walk + dirs[:] in-place 가지치기: venv 하위의 .py 파일은 열거 단계부터 제외함.
    files: list[Path] = []
    for root, dirs, filenames in os.walk(self.settings.examples_dir):
        dirs[:] = [d for d in dirs if d not in _EXCLUDE_DIR_PARTS]
        for name in filenames:
            if name.endswith(".py"):
                files.append(Path(root) / name)
    return sorted(files)`
    },
    {
      id: "fn_create_llm",
      name: "create_llm_func()",
      fileId: "llm",
      summary: "Groq LPU로 엔티티 추출하는 LightRAG용 LLM 함수 생성",
      how: "바깥 함수가 안쪽 async 함수를 감싸는 클로저(closure) 패턴입니다. settings를 캡처해 API 키·모델명이 담긴 함수를 반환합니다. reasoning_effort='low'로 설정해 추론 토큰 과다로 인한 빈 응답을 방지합니다.",
      terms: ["closure", "async_await", "groq_lpu", "reasoning_effort"],
      lines: [
        { at: ", \"low\")", text: "추론 노력을 낮게 설정합니다. 높으면 추론 토큰이 응답 한도를 다 써버려 실제 답변이 비어버립니다." },
        { at: ", 8192)", text: "응답 최대 토큰을 충분히 설정합니다." },
        { at: "return await openai_complete_if_cache(", text: "OpenAI 호환 API(Groq 엔드포인트)를 호출합니다. await는 응답이 올 때까지 기다린다는 뜻입니다." }
      ],
      code: `def create_llm_func(settings: Settings):
    """Groq OpenAI 호환 API를 호출하는 LightRAG용 LLM 함수를 생성·반환함."""

    async def llm_model_func(
        prompt,
        system_prompt=None,
        history_messages=None,
        keyword_extraction=False,  # LightRAG가 전달하는 플래그. OpenAI API로 흘려보내지 않도록 흡수
        **kwargs,
    ) -> str:
        """Groq LPU로 LLM 응답 생성 (LightRAG가 엔티티 추출 시 호출).

        gpt-oss-20b는 추론형(reasoning) 모델이라 추론 토큰이 응답 한도를 소진하면
        실제 답변(content)이 비어 LightRAG가 "Received empty content" 오류를 냄.
        reasoning_effort를 낮춰 추론량을 줄이고 max_tokens를 충분히 확보해
        추출 결과가 content로 정상 반환되도록 함. (setdefault로 호출부 지정값을 우선)
        """
        kwargs.setdefault("reasoning_effort", "low")
        kwargs.setdefault("max_tokens", 8192)
        # history_messages를 None→[]로 처리: 가변 기본인자(list) 공유 버그를 피하기 위함
        return await openai_complete_if_cache(
            settings.groq_model,
            prompt,
            system_prompt=system_prompt,
            history_messages=history_messages or [],
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
            **kwargs,
        )

    return llm_model_func`
    },
    {
      id: "fn_create_embed",
      name: "create_embed_callable()",
      fileId: "llm",
      summary: "Ollama qwen3-embedding 호출하는 임베딩 함수 생성",
      how: "_raw_ollama_embed를 직접 호출합니다. LightRAG 기본 ollama_embed 데코레이터가 차원을 1024로 강제하는 문제를 우회하기 위해 .func로 원본 함수를 꺼내 사용합니다.",
      terms: ["ollama", "embedding_func", "decorator_bypass"],
      lines: [
        { at: "return await _raw_ollama_embed(", text: "Ollama 서버에 텍스트를 보내 임베딩 벡터를 요청합니다." },
        { at: "texts, embed_model=settings.embedding_model", text: "임베딩할 텍스트 목록, 모델명(qwen3-embedding), 서버 주소를 전달합니다." }
      ],
      code: `def create_embed_callable(settings: Settings):
    """qwen3-embedding 임베딩을 수행하는 비동기 함수를 생성·반환함 (LightRAG·코드 인덱서 공통)."""

    async def _embed(texts: list[str]):
        """텍스트 목록을 임베딩하여 (N, 4096) ndarray 반환."""
        # host: Ollama 서버 주소. embed_model: 사용할 임베딩 모델명
        return await _raw_ollama_embed(
            texts, embed_model=settings.embedding_model, host=settings.ollama_base_url
        )

    return _embed`
    },
    {
      id: "fn_check_ollama",
      name: "check_ollama()",
      fileId: "llm",
      summary: "Ollama 서버 실행 여부와 임베딩 모델 보유 여부 점검",
      how: "Ollama의 /api/tags 엔드포인트를 HTTP GET으로 호출해 서버 응답 여부와 qwen3-embedding 모델 보유 여부를 확인합니다.",
      terms: ["httpx", "ollama_api"],
      lines: [
        { at: "ollama_base_url}/api/tags", text: "Ollama 서버의 모델 목록 API를 5초 타임아웃으로 호출합니다." },
        { at: "n.startswith(settings.embedding_model)", text: "반환된 모델 목록 중 qwen3-embedding으로 시작하는 것이 없으면 오류를 발생시킵니다." }
      ],
      code: `def check_ollama(settings: Settings) -> None:
    """Ollama 서버 연결과 임베딩 모델 보유 여부를 점검. 실패 시 안내 메시지와 함께 중단."""
    try:
        # /api/tags: Ollama가 보유한 모델 목록을 반환하는 엔드포인트
        resp = httpx.get(f"{settings.ollama_base_url}/api/tags", timeout=5.0)
        resp.raise_for_status()
    except Exception as exc:  # noqa: BLE001 - 연결 실패 원인을 그대로 안내에 포함
        raise RuntimeError(
            f"Ollama 서버에 연결할 수 없음 ({settings.ollama_base_url}). "
            f"\`ollama serve\` 실행 여부를 확인하세요. 원인: {exc}"
        ) from exc
    names = [m.get("name", "") for m in resp.json().get("models", [])]
    # startswith 매칭: 'qwen3-embedding'이 'qwen3-embedding:latest' 형태로 저장될 수 있음
    if not any(n.startswith(settings.embedding_model) for n in names):
        raise RuntimeError(
            f"임베딩 모델 '{settings.embedding_model}'을 찾을 수 없음. "
            f"\`ollama pull {settings.embedding_model}\` 실행 필요. 현재 보유 모델: {names}"
        )`
    },
    {
      id: "fn_kg_build_async",
      name: "_build_async()",
      fileId: "kg",
      summary: "LightRAG ainsert()로 문서를 KG에 삽입하고 결과 반환",
      how: "LightRAG 인스턴스를 만들고 각 교재 파일을 ainsert()로 삽입합니다. 삽입 성공만으로 KG 생성을 보장할 수 없으므로, GraphML 파일에서 <node> 태그 개수를 직접 세어 KG 생성 여부를 확인합니다.",
      terms: ["ainsert", "GraphML", "inspect_signature", "asyncio_run"],
      lines: [
        { at: "rag = await self._create_rag()", text: "LightRAG 인스턴스를 만들고 스토리지를 초기화합니다." },
        { at: "supports_file_paths =", text: "설치된 LightRAG 버전이 file_paths 인자를 지원하는지 런타임에 확인합니다. 버전별 호환성 처리입니다." },
        { at: "file_paths=path", text: "문서 내용을 LightRAG에 삽입합니다. 이 한 번의 호출로 KG 구축 + 벡터 저장이 모두 이루어집니다." },
        { at: "graphml.read_text", text: "GraphML 파일을 읽어 <node 태그 개수를 셉니다. 0이면 KG 추출이 실패한 것입니다." }
      ],
      code: `async def _build_async(self, docs: list[dict]) -> dict:
    """LightRAG 인스턴스 생성·초기화 후 문서를 한 건씩 ainsert."""
    rag = await self._create_rag()

    # ainsert가 file_paths 인자를 지원하는지 1회만 확인 (구버전 호환).
    # 지원 시 출처 경로를 함께 저장해 검색 결과의 인용 추적이 가능함.
    supports_file_paths = "file_paths" in inspect.signature(rag.ainsert).parameters

    success, skipped = 0, []
    for doc in docs:
        path = doc["file_path"]
        try:
            logger.info("KG insert 시작: %s", path)
            if supports_file_paths:
                await rag.ainsert(doc["content"], file_paths=path)
            else:
                await rag.ainsert(doc["content"])
            success += 1
        except Exception as exc:  # noqa: BLE001 - 한 파일 실패가 전체 인덱싱을 막지 않도록 스킵
            logger.warning("KG insert 실패, 스킵: %s (%s)", path, exc)
            skipped.append(path)

    # finalize_storages(): 열린 스토리지 핸들을 정리하여 파일 flush를 보장 (지원 시에만 호출)
    if hasattr(rag, "finalize_storages"):
        await rag.finalize_storages()

    # ainsert는 LLM 추출이 실패(엔티티 0개)해도 예외를 던지지 않으므로, insert 호출 성공만으로는
    # KG 생성을 보장할 수 없음. 실제 GraphML 노드 수를 세어 KG 구축 여부를 정직하게 판정함.
    graphml = self.settings.kg_dir / "graph_chunk_entity_relation.graphml"
    kg_nodes = graphml.read_text(encoding="utf-8").count("<node ") if graphml.exists() else 0

    logger.info("KG 인덱싱 완료: insert 성공 %d, 스킵 %d, 추출 노드 %d개", success, len(skipped), kg_nodes)
    if docs and kg_nodes == 0:
        logger.error(
            "KG 노드 0개 — LLM 엔티티 추출 실패(예: 빈 content 반환). LLM 모델/파라미터를 점검하세요."
        )
    return {"success": success, "skipped": skipped, "total": len(docs), "kg_nodes": kg_nodes}`
    },
    {
      id: "fn_create_rag",
      name: "_create_rag()",
      fileId: "kg",
      summary: "LightRAG 인스턴스 생성 및 Windows 안전 초기화",
      how: "Windows에서는 LightRAG가 내부적으로 멀티프로세싱을 사용해 오류가 납니다. initialize_share_data(1)을 먼저 호출해 단일 프로세스 모드로 고정합니다.",
      terms: ["initialize_share_data", "windows_mp_spawn", "LightRAG"],
      lines: [
        { at: "initialize_share_data(1)", text: "Windows 멀티프로세싱 문제를 막기 위해 단일 프로세스 모드로 잠급니다. 이 줄이 없으면 Windows에서 EOFError가 발생합니다." },
        { at: "rag = LightRAG(", text: "LightRAG 인스턴스를 생성합니다. LLM 함수, 임베딩 함수, 청킹 설정 등을 주입합니다." },
        { at: "await rag.initialize_storages()", text: "KG·벡터·KV 스토리지 파일 핸들을 준비합니다. 비동기 전용이라 await가 필요합니다." },
        { at: "await initialize_pipeline_status()", text: "문서 처리 파이프라인의 전역 상태를 초기화합니다." }
      ],
      code: `async def _create_rag(self) -> LightRAG:
    """LightRAG 인스턴스 생성 후 비동기 스토리지/파이프라인 초기화.

    initialize_storages()와 initialize_pipeline_status()는 비동기 전용이며,
    호출하지 않으면 내부 스토리지가 준비되지 않아 insert 시 오류가 발생함.
    """
    self.settings.kg_dir.mkdir(parents=True, exist_ok=True)
    # [Windows 필수] 단일 프로세스 모드를 가장 먼저 고정함.
    # LightRAG의 ainsert 파이프라인은 내부에서 initialize_share_data(workers>1)를 호출해
    # mp.Manager()를 spawn하는데, Windows의 multiprocessing 'spawn'에서 부트스트랩 핸드셰이크가
    # 깨져 'EOFError: Ran out of input'으로 인덱싱이 실패함.
    # 먼저 workers=1로 호출하면 _initialized=True가 되어 이후 호출이 가드(if _initialized: return)에
    # 막히므로 mp.Manager() spawn이 발생하지 않음 (is_multiprocess=False, asyncio 락 사용).
    initialize_share_data(1)
    rag = LightRAG(
        working_dir=str(self.settings.kg_dir),
        llm_model_func=create_llm_func(self.settings),
        llm_model_name=self.settings.groq_model,
        llm_model_max_async=self.settings.llm_max_async,
        embedding_func=create_embedding_func(self.settings),
        chunk_token_size=self.settings.chunk_token_size,
        chunk_overlap_token_size=self.settings.chunk_overlap_token_size,
    )
    await rag.initialize_storages()       # KG/벡터/KV 스토리지 파일 핸들 준비
    await initialize_pipeline_status()    # 문서 처리 파이프라인 상태(전역) 초기화
    return rag`
    },
    {
      id: "fn_code_build_async",
      name: "_build_async()",
      fileId: "code_vec",
      summary: "코드 청킹 → 임베딩 → nano-vectordb 저장",
      how: "각 파일을 청크로 나누고, 배치로 임베딩한 뒤 nano-vectordb에 upsert합니다. db.save()로 JSON 파일에 영구 저장합니다.",
      terms: ["nano_vectordb", "upsert", "chunk"],
      lines: [
        { at: "db = NanoVectorDB(", text: "nano-vectordb 인스턴스를 만듭니다. 파일이 이미 있으면 자동으로 불러옵니다." },
        { at: "chunks = self._chunk_code", text: "코드 파일 내용을 1200자 단위 조각으로 잘라냅니다." },
        { at: "vectors = await self._embed_in_batches", text: "청크들을 배치로 나눠 Ollama qwen3-embedding으로 벡터화합니다." },
        { at: "self._chunk_id(path, idx, text)", text: "각 청크의 고유 ID를 MD5 해시로 만듭니다. 같은 파일을 재인덱싱해도 같은 ID가 나와 중복이 방지됩니다." },
        { at: "db.upsert(records)", text: "모든 레코드를 DB에 삽입/갱신합니다." },
        { at: "db.save()", text: "변경 내용을 JSON 파일(vdb_code.json)에 저장합니다." }
      ],
      code: `async def _build_async(self, docs: list[dict]) -> dict:
    """코드 청킹 → 임베딩 → nano-vectordb upsert → JSON 저장."""
    self.settings.code_vector_dir.mkdir(parents=True, exist_ok=True)
    # NanoVectorDB(차원, storage_file): 기존 파일이 있으면 자동 로드, 없으면 새로 생성
    db = NanoVectorDB(
        self.settings.embedding_dim,
        storage_file=str(self.settings.code_vdb_file),
    )

    records: list[dict] = []
    success, skipped = 0, []
    for doc in docs:
        path = doc["file_path"]
        try:
            chunks = self._chunk_code(doc["content"])
            vectors = await self._embed_in_batches(chunks)
            for idx, (text, vec) in enumerate(zip(chunks, vectors)):
                records.append({
                    # __id__: nano-vectordb의 레코드 식별자 (결정적 ID로 재실행 시 중복 방지)
                    "__id__": self._chunk_id(path, idx, text),
                    # __vector__: nano-vectordb가 유사도 계산에 사용하는 임베딩 벡터
                    "__vector__": vec,
                    "content": text,
                    "file_path": path,
                    "chunk_index": idx,
                })
            success += 1
        except Exception as exc:  # noqa: BLE001 - 한 파일 임베딩 실패는 스킵하고 계속 진행
            logger.warning("코드 임베딩 실패, 스킵: %s (%s)", path, exc)
            skipped.append(path)

    if records:
        db.upsert(records)
        db.save()   # JSON 파일로 영속화
    logger.info(
        "코드 벡터 인덱싱 완료: 파일 성공 %d, 스킵 %d, 청크 %d",
        success, len(skipped), len(records),
    )
    return {"success": success, "skipped": skipped, "chunks": len(records), "total": len(docs)}`
    },
    {
      id: "fn_chunk_code",
      name: "_chunk_code()",
      fileId: "code_vec",
      summary: "코드를 1200자 단위로 겹침 있게 분할",
      how: "슬라이딩 윈도우 방식으로 코드를 자릅니다. 청크마다 앞 150자가 이전 청크와 겹쳐 문맥 연속성을 유지합니다.",
      terms: ["chunk", "sliding_window"],
      lines: [
        { at: "size = self.settings.code_chunk_size", text: "청크 크기(기본 1200자)를 설정에서 가져옵니다." },
        { at: "overlap = self.settings.code_chunk_overlap", text: "겹침 크기(기본 150자)를 설정에서 가져옵니다." },
        { at: "while start < len(content):", text: "코드 전체를 다 처리할 때까지 반복합니다." },
        { at: "start += size - overlap", text: "다음 청크 시작 위치를 overlap만큼 앞당깁니다. 이 150자가 앞뒤 청크의 공통 구간입니다." }
      ],
      code: `def _chunk_code(self, content: str) -> list[str]:
    """코드 본문을 문자 길이 기준으로 겹침을 두고 분할.

    토큰 기반이 아닌 단순 문자 기반 슬라이딩 윈도우라 의존성 없이 동작함.
    """
    size = self.settings.code_chunk_size
    overlap = self.settings.code_chunk_overlap
    if len(content) <= size:
        return [content]
    chunks: list[str] = []
    start = 0
    while start < len(content):
        chunk = content[start:start + size]
        chunks.append(chunk)
        if start + size >= len(content):
            break
        # 다음 청크 시작점을 overlap만큼 앞당겨 문맥 연속성을 유지함
        start += size - overlap
    return chunks`
    },
    {
      id: "fn_chunk_id",
      name: "_chunk_id()",
      fileId: "code_vec",
      summary: "파일경로+인덱스+내용 MD5 해시로 결정적 청크 ID 생성",
      how: "같은 입력이면 항상 같은 ID가 나옵니다(결정적). 재실행해도 중복이 생기지 않고 upsert가 기존 레코드를 업데이트합니다.",
      terms: ["md5_hash", "idempotent"],
      lines: [
        { at: "::{index}::{text}", text: "파일 경로, 청크 번호, 내용을 합쳐 해시 입력값을 만듭니다." },
        { at: "return hashlib.md5", text: "MD5 해시를 16진수 문자열로 반환합니다. 이것이 청크의 고유 ID가 됩니다." }
      ],
      code: `@staticmethod
def _chunk_id(file_path: str, index: int, text: str) -> str:
    """파일경로+청크번호+내용 해시로 결정적 ID 생성 (재실행 시 중복 upsert 방지)."""
    # hashlib.md5: 동일 입력에 항상 동일 해시 → idempotent upsert 키로 활용
    raw = f"{file_path}::{index}::{text}".encode("utf-8")
    return hashlib.md5(raw).hexdigest()`
    },
    {
      id: "fn_settings",
      name: "Settings",
      fileId: "settings",
      summary: "경로·LLM·임베딩·청킹 전역 설정을 한 곳에 관리",
      how: "@dataclass가 __init__을 자동 생성합니다. __post_init__에서 .env 파일을 읽어 API 키 등을 환경변수로 주입합니다. 모든 경로는 __file__ 위치 기준으로 자동 계산됩니다.",
      terms: ["dataclass", "dotenv", "pathlib"],
      lines: [
        { at: "textbook_dir: Path = field", text: "교재가 있는 폴더 경로입니다. 코드 파일 위치(__file__) 기준으로 자동 계산됩니다." },
        { at: "chunk_token_size: int = 1200", text: "교재를 KG 인덱싱할 때 토큰 기준 청크 크기입니다." },
        { at: "code_chunk_size: int = 1200       # 청크당 문자 수", text: "예제코드 인덱싱 때 문자 기준 청크 크기입니다. 교재와 단위가 달라 별도 설정입니다." },
        { at: "if self.hands_on_env.exists():", text: "hands-on/.env 파일이 있으면 로드합니다." },
        { at: "self.groq_api_key = os.getenv", text: "환경변수 GROQ_API_KEY 값을 읽어 설정에 반영합니다. 없으면 기본값을 유지합니다." }
      ],
      code: `@dataclass  # 설정을 구조화된 객체로 관리해 타입 안정성과 IDE 자동완성을 제공함
class Settings:
    """인덱싱 전역 설정 (경로 + Groq + Ollama + LightRAG 저장소)"""

    # --- 경로 (모두 __file__ 기준 자동 도출) ---
    # field(default_factory=...): 가변 기본값(Path)이 인스턴스 간 공유되지 않도록 인스턴스마다 새로 생성함
    indexing_dir: Path = field(default_factory=lambda: _INDEXING_DIR)
    lightrag_root: Path = field(default_factory=lambda: _LIGHTRAG_ROOT)
    workspace_root: Path = field(default_factory=lambda: _WORKSPACE_ROOT)
    # 교재(KG + Vector 인덱싱 대상): agentic-ai/textbook/*.md
    textbook_dir: Path = field(default_factory=lambda: _WORKSPACE_ROOT / "agentic-ai" / "textbook")
    # 예제코드(Vector 인덱싱 대상): hands-on/**/*.py
    examples_dir: Path = field(default_factory=lambda: _HANDS_ON_DIR)
    # 공용 .env (GROQ_API_KEY 등): hands-on/.env
    hands_on_env: Path = field(default_factory=lambda: _HANDS_ON_DIR / ".env")
    # LightRAG working_dir: GraphML KG + nano-vectordb 교재 벡터 + KV Store JSON이 자동 생성되는 위치
    kg_dir: Path = field(default_factory=lambda: _LIGHTRAG_ROOT / "store" / "kg")
    # 예제코드 전용 nano-vectordb 벡터 인덱스 저장 디렉터리 (KG 미생성)
    code_vector_dir: Path = field(default_factory=lambda: _LIGHTRAG_ROOT / "store" / "vector" / "code")

    # --- Ollama 임베딩 설정 ---
    ollama_base_url: str = "http://localhost:11434"
    # qwen3-embedding: 4096차원 로컬 임베딩 모델 (Ollama). 벡터 인덱스 차원과 반드시 일치해야 함
    embedding_model: str = "qwen3-embedding"
    embedding_dim: int = 4096
    embedding_max_token_size: int = 8192

    # --- Groq LPU LLM 설정 (OpenAI 호환 API) ---
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    # Groq LPU에서 서빙하는 OpenAI gpt-oss 120B 모델 (LightRAG의 엔티티/관계 추출용)
    # 20B 대비 대형 추출 프롬프트(다수 few-shot)에서 빈 content 반환 위험이 낮고 추출 품질이 높음
    groq_model: str = "openai/gpt-oss-120b"
    # 동시 LLM 호출 수: Groq TPM(분당 토큰) 한도 초과를 막기 위해 보수적으로 설정
    llm_max_async: int = 2

    # --- LightRAG 청킹 (교재 KG 구축, 토큰 기준) ---
    chunk_token_size: int = 1200
    chunk_overlap_token_size: int = 100

    # --- 예제코드 청킹 (nano-vectordb, 문자 기준) ---
    code_chunk_size: int = 1200       # 청크당 문자 수
    code_chunk_overlap: int = 150     # 청크 간 겹침 문자 수 (문맥 연속성 유지)
    embed_batch_size: int = 16        # 임베딩 1회 요청당 청크 수

    def __post_init__(self):
        """공용 .env 로드 후 환경변수로 기본값을 오버라이드함"""
        # hands-on/.env에서 GROQ_API_KEY 등 민감 정보 로드 (코드에 키 하드코딩 방지)
        if self.hands_on_env.exists():
            load_dotenv(self.hands_on_env)
        # 인덱싱 디렉터리에 .env가 따로 있으면 추가 로드 (모델·엔드포인트 로컬 오버라이드용)
        local_env = self.indexing_dir / ".env"
        if local_env.exists():
            load_dotenv(local_env, override=True)

        # 환경변수가 있으면 우선 적용 (없으면 위의 기본값 유지)
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", self.ollama_base_url)
        self.embedding_model = os.getenv("EMBEDDING_MODEL", self.embedding_model)
        self.groq_api_key = os.getenv("GROQ_API_KEY", self.groq_api_key)
        self.groq_base_url = os.getenv("GROQ_BASE_URL", self.groq_base_url)
        self.groq_model = os.getenv("GROQ_MODEL", self.groq_model)

        # logs 디렉터리 생성 (인덱싱 로그 파일 출력 위치)
        (self.indexing_dir / "logs").mkdir(exist_ok=True)`
    }
  ],
  glossary: {
    "LightRAG":              "교재 텍스트를 자동으로 지식 그래프(KG)로 변환해주는 오픈소스 라이브러리. ainsert() 한 번으로 개념 추출·관계 구축·벡터 저장을 모두 처리합니다.",
    "KGBuilder_class":       "이 예제의 클래스. LightRAG를 사용해 교재에서 지식 그래프를 구축합니다.",
    "CodeVectorIndexer_class":"이 예제의 클래스. 예제코드를 청크로 자르고 임베딩해 nano-vectordb에 저장합니다.",
    "asyncio_run":           "비동기(async) 함수를 일반 동기 코드에서 실행하는 방법. 이벤트 루프를 만들어 비동기 함수가 끝날 때까지 기다립니다.",
    "smoke_test":            "대량 작업 전 1건만 실행해 환경(API 키, 모델, 차원 등)이 정상인지 미리 확인하는 테스트.",
    "rglob":                 "Path.rglob() — 현재 폴더부터 모든 하위 폴더까지 재귀 탐색하며 패턴에 맞는 파일을 찾습니다.",
    "doc_dict":              "이 예제에서 문서를 표현하는 딕셔너리 형식: {file_path, content, doc_type}.",
    "nano_vectordb":         "nano-vectordb — JSON 단일 파일 기반의 초경량 벡터 DB. 서버 없이 동작하며 NanoVectorDB 클래스로 사용합니다.",
    "os_walk":               "os.walk() — 지정한 폴더와 하위 폴더를 순서대로 방문하며 (root, 폴더목록, 파일목록)을 반환합니다.",
    "dirs_prune":            "os.walk() 중 dirs[:] = [...] 가지치기. 목록을 in-place로 수정해 os.walk가 특정 폴더에 아예 들어가지 않게 합니다.",
    "closure":               "함수 안에서 또 다른 함수를 정의하고, 바깥 함수의 변수를 안쪽 함수에서 사용하는 패턴.",
    "async_await":           "파이썬의 비동기 프로그래밍 키워드. async def로 비동기 함수를 정의하고, await로 다른 비동기 함수를 호출해 결과를 기다립니다.",
    "groq_lpu":              "Groq사의 LPU(Language Processing Unit) 칩을 활용한 빠른 LLM API 서비스. OpenAI와 호환되는 API를 제공합니다.",
    "reasoning_effort":      "추론형 LLM 모델의 추론량 제어 파라미터. 'low'로 설정하면 추론 토큰 사용을 줄여 실제 답변 공간을 확보합니다.",
    "ollama":                "로컬에서 LLM과 임베딩 모델을 실행하는 도구. 외부 API 없이 PC에서 직접 모델을 구동합니다.",
    "embedding_func":        "LightRAG에 주입하는 임베딩 함수 래퍼. 차원 정보를 포함해 벡터 저장소의 크기를 사전에 알려줍니다.",
    "decorator_bypass":      "라이브러리 데코레이터가 원하지 않는 제약(예: 차원=1024 강제)을 추가할 때, .func로 원본 함수에 직접 접근해 제약을 우회하는 기법.",
    "httpx":                 "파이썬 HTTP 클라이언트 라이브러리. requests와 비슷하지만 비동기도 지원합니다.",
    "ollama_api":            "Ollama 서버가 제공하는 REST API. /api/tags는 보유 모델 목록, /api/embeddings는 임베딩 요청 엔드포인트입니다.",
    "ainsert":               "LightRAG의 비동기 문서 삽입 메서드. 호출 한 번으로 KG 구축·벡터 저장·KV 저장을 모두 수행합니다.",
    "GraphML":               "그래프를 XML 형식으로 저장하는 파일 포맷. LightRAG가 추출한 개념과 관계를 <node>/<edge> 태그로 저장합니다.",
    "inspect_signature":     "inspect.signature() — 함수의 파라미터 목록을 런타임에 확인합니다. 버전별 API 차이를 동적으로 처리할 때 사용합니다.",
    "initialize_share_data": "LightRAG 내부 공유 스토리지를 초기화하는 함수. workers=1이면 멀티프로세싱 없이 단일 프로세스(asyncio 락)만 사용합니다.",
    "windows_mp_spawn":      "Windows는 멀티프로세싱 시작 방식이 'spawn'이어서 자식 프로세스가 부모를 새로 import합니다. 이 때 핸드셰이크 실패로 EOFError가 발생할 수 있습니다.",
    "upsert":                "INSERT + UPDATE. 해당 ID가 없으면 새로 삽입하고, 있으면 업데이트합니다. 재실행해도 데이터가 중복되지 않습니다.",
    "chunk":                 "긴 텍스트를 일정 크기로 자른 조각. 검색 정확도를 높이고 임베딩 모델의 입력 한도를 넘지 않게 합니다.",
    "sliding_window":        "윈도우(구간)를 일정 크기만큼 이동하며 데이터를 처리하는 방식. 인접 청크 간 overlap으로 문맥 경계 손실을 줄입니다.",
    "md5_hash":              "MD5 — 임의 길이 입력을 32자 16진수 문자열로 변환하는 해시 함수. 같은 입력에는 항상 같은 값을 반환합니다.",
    "idempotent":            "같은 작업을 여러 번 해도 결과가 처음과 동일한 성질. 재실행해도 중복·부작용이 없습니다.",
    "dataclass":             "@dataclass 데코레이터 — 클래스의 __init__, __repr__ 등을 자동 생성해줍니다. 설정 데이터를 구조화할 때 자주 씁니다.",
    "dotenv":                "python-dotenv 라이브러리. .env 파일의 KEY=VALUE를 읽어 os.environ에 등록합니다. API 키를 코드에 하드코딩하지 않고 파일로 관리할 때 씁니다.",
    "pathlib":               "파이썬 표준 라이브러리의 파일 경로 관리 모듈. Path 객체로 경로를 표현하며 / 연산자로 경로를 이어 붙일 수 있습니다."
  }
};
