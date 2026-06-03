window.EXPLAIN_DATA = {
  meta: { title: "Agentic GraphRAG 챗봇 — 법률 검색을 Neo4j GraphRAG로 교체", entry: "app.py" },
  files: [
    { id: "retriever", label: "app.py · GraphRetriever", role: "★ 교체된 핵심 — ChromaDB 대신 Neo4j GraphRAG 하이브리드 검색기 (조문 벡터 + 엔티티 벡터·그래프)" },
    { id: "setup",     label: "app.py · 자원 준비",       role: "Neo4j 연결·임베딩·LLM 준비 및 AgenticRAG 조립" },
    { id: "nodes",     label: "app.py · LangGraph 노드",  role: "Self-RAG 성찰 루프 노드 (Route·Retrieve·IsRel·IsSup) + 출처 구성" },
    { id: "graph",     label: "app.py · 그래프 조립",     role: "노드·엣지를 StateGraph로 연결해 실행 가능한 워크플로우로 컴파일" }
  ],
  flow: [
    { step: 1, title: "Route (라우팅)",        summary: "질문을 보고 검색이 필요한지·어떤 소스를 쓸지 결정함",          detail: "LLM이 질문을 분석해 특허 질문이면 graphrag(법률)·web·youtube 중 필요한 소스를 고릅니다. 인사나 특허 외 주제는 검색 없이 바로 답합니다. 원본 챗봇의 'vectordb' 소스가 'graphrag'로 바뀐 것 외에는 동일합니다." },
    { step: 2, title: "Retrieve (검색)",       summary: "법률은 Neo4j GraphRAG, 그 외는 웹·YouTube에서 검색함",        detail: "★ 바뀐 부분: 법률 검색이 ChromaDB 단순 유사도에서 Neo4j GraphRAG 하이브리드로 교체됐습니다. 조문 청크(doc_embedding)와 진입 엔티티(entity_embedding)+1-hop 그래프 관계를 함께 가져와 List[Document]로 반환합니다. 웹·YouTube는 그대로입니다." },
    { step: 3, title: "IsRel (관련성 평가)",   summary: "검색된 문서가 질문과 관련 있는지 골라냄",                    detail: "GraphRAG가 가져온 조문 청크·그래프 관계 문서를 LLM이 한 번에 평가해 관련 있는 것만 남깁니다. '특허 요건' 질문에서는 조문 청크보다 '제29조(특허요건)' 관계 문서가 더 관련 있다고 선별되기도 합니다." },
    { step: 4, title: "Generate + IsSup",      summary: "컨텍스트로 답을 만들고 근거가 있는지 검증함",                detail: "선별된 법률·웹·영상 컨텍스트로 답변을 생성하고, 그 답이 컨텍스트에 근거하는지(환각이 없는지) 검사합니다. 근거가 부족하면 컨텍스트만으로 엄격 재생성합니다. 출처 섹션은 코드가 직접 붙입니다." },
    { step: 5, title: "IsUse + 재검색 루프",   summary: "답이 유용하지 않으면 질문을 고쳐 다시 검색함",                detail: "최종 답이 유용한지 평가해, 부족하면 질문을 더 검색 친화적으로 재작성하고 Route로 돌아갑니다(최대 3회). 이 Self-RAG 성찰 루프는 원본 챗봇과 완전히 동일합니다." }
  ],
  functions: [
    {
      id: "fn_retrieve",
      name: "GraphRetriever.retrieve()  ★",
      fileId: "retriever",
      summary: "★ 교체의 핵심 — Neo4j GraphRAG 하이브리드 검색을 수행해 List[Document]로 반환",
      how: "ChromaDB 검색기는 vectorstore.as_retriever().invoke(질문)로 유사 청크를 반환했습니다. 이 함수는 (1)조문 벡터검색으로 원문 청크를, (2)엔티티 벡터검색+1-hop 그래프 확장으로 관계 근거를 가져와 똑같이 List[Document]로 반환합니다. 반환 형식이 같아서 뒤따르는 관련성 평가·출처 구성 코드는 한 줄도 바꾸지 않습니다.",
      terms: ["GraphRetriever", "List_Document", "embed_query", "doc_embedding", "entity_embedding", "one_hop", "langchain_document"],
      lines: [
        { at: "embedding = self.embeddings.embed_query(question)", text: "질문을 OpenAI로 1536차원 벡터로 바꿉니다. 인덱싱 때와 같은 모델이어야 검색이 됩니다." },
        { at: "raise ValueError(f\"임베딩 차원 불일치", text: "혹시 임베딩 차원이 인덱스와 다르면 즉시 오류를 냅니다. 검색이 조용히 실패하는 것을 막습니다." },
        { at: "doc_hits = self._query_doc_vectors(embedding, DOC_TOP_K)", text: "조문 청크 벡터 인덱스(doc_embedding)에서 질문과 유사한 조문 5개를 찾습니다. → 법률 원문 근거." },
        { at: "entity_hits = self._query_entity_vectors(embedding, ENTITY_TOP_K)", text: "엔티티 벡터 인덱스(entity_embedding)에서 질문과 관련된 진입 엔티티를 찾습니다. → 그래프 탐색의 출발점." },
        { at: "relations = self._expand_graph(", text: "찾은 진입 엔티티에서 1-hop(한 단계) 그래프 관계를 펼칩니다. → 멀티홉 추론 근거. 이게 단순 벡터 검색과 GraphRAG의 결정적 차이입니다." },
        { at: "page_content=hit.get(\"text\", \"\"),", text: "조문 청크의 본문을 Document의 내용으로 넣습니다. 본문이 조문 원문이라 나중에 '제29조' 같은 조항을 정규식으로 뽑을 수 있습니다." },
        { at: "kg_text = self._build_kg_text(entity_hits, relations)", text: "엔티티와 관계를 사람이 읽는 텍스트로 합칩니다. 다음 줄에서 이걸 별도의 '지식그래프' Document 1건으로 추가합니다." },
        { at: "\"kind\": \"graph\",", text: "이 Document가 조문 원문이 아니라 그래프 관계 근거임을 표시합니다. 출처 섹션에서 '특허법 지식그래프(KG)'로 구분 표기됩니다." }
      ],
      code: `def retrieve(self, question: str) -> list[Document]:
    """질문에 대한 GraphRAG 하이브리드 검색을 수행해 List[Document]로 반환함."""
    embedding = self.embeddings.embed_query(question)
    if len(embedding) != EMBEDDING_DIM:
        # 인덱싱과 질의 임베딩 차원이 다르면 Neo4j 벡터 검색이 실패하므로 조기에 오류를 알림
        raise ValueError(f"임베딩 차원 불일치: 실제 {len(embedding)} != 기대 {EMBEDDING_DIM}")

    doc_hits = self._query_doc_vectors(embedding, DOC_TOP_K)
    entity_hits = self._query_entity_vectors(embedding, ENTITY_TOP_K)
    relations = self._expand_graph([hit["id"] for hit in entity_hits if hit.get("id")])

    documents: list[Document] = []
    # 1) 조문 청크 → 법률 근거(원문). page_content가 조문 원문이라 ARTICLE_PATTERN이 조항을 추출함
    for hit in doc_hits:
        documents.append(Document(
            page_content=hit.get("text", ""),
            metadata={
                "source": hit.get("source") or "특허법.pdf",
                "source_type": hit.get("source_type") or "law",
                "chunk_index": hit.get("chunk_index"),
                "score": hit.get("score"),
                "kind": "document",
            },
        ))
    # 2) 진입 엔티티 + 1-hop 관계 → 그래프 관계 근거(멀티홉 추론). 1건의 합성 Document로 묶음
    kg_text = self._build_kg_text(entity_hits, relations)
    if kg_text:
        documents.append(Document(
            page_content=kg_text,
            metadata={
                "source": KG_SOURCE_LABEL,
                "source_type": "graph",
                "chunk_index": 0,
                "kind": "graph",
            },
        ))
    return documents`
    },
    {
      id: "fn_expand_graph",
      name: "GraphRetriever._expand_graph()  ★",
      fileId: "retriever",
      summary: "진입 엔티티의 1-hop 이웃 관계를 Cypher로 조회 (그래프 멀티홉 추론 근거)",
      how: "벡터 검색만으로는 '특허'와 '제29조'가 어떤 관계인지 알 수 없습니다. 이 함수는 진입 엔티티에서 한 단계 떨어진 이웃을 그래프로 탐색해 (특허)-[APPLIES_TO]->(제29조) 같은 관계를 가져옵니다. 양쪽 끝이 모두 진짜 엔티티인 관계만 남기고, 출처 연결용 MENTIONS 관계는 제외합니다.",
      terms: ["one_hop", "cypher", "neo4j_entity_label", "mentions"],
      lines: [
        { at: "if not seed_ids:", text: "진입 엔티티가 하나도 없으면 빈 목록을 반환합니다. 불필요한 Cypher 실행을 막습니다." },
        { at: "\"MATCH (n:__Entity__)-[r]-(m:__Entity__) \"", text: "양쪽 끝(n, m)이 모두 __Entity__ 라벨인 관계만 찾습니다. 해시 id를 가진 원본 문서 노드가 결과에 섞이지 않게 합니다." },
        { at: "\"WHERE n.id IN $seed_ids AND type(r) <> 'MENTIONS' \"", text: "진입 엔티티에서 출발하는 관계만 고르되, 출처 연결용 MENTIONS 관계는 뺍니다. 의미 있는 법률 관계(REQUIRES, APPLIES_TO 등)만 남습니다." },
        { at: "params={\"seed_ids\": seed_ids, \"limit\": GRAPH_EXPAND_LIMIT},", text: "Cypher에 진입 엔티티 목록과 최대 건수(20)를 안전하게 전달합니다. 값을 직접 문자열에 끼우지 않아 인젝션을 막습니다." }
      ],
      code: `def _expand_graph(self, seed_ids: list[str]) -> list[dict[str, Any]]:
    """진입 엔티티의 1-hop 이웃 관계를 조회함 (그래프 기반 멀티홉 추론 근거).

    양쪽 끝이 모두 __Entity__인 관계만 남기고 MENTIONS(출처 Document→엔티티)는 제외해,
    해시 id를 가진 원본 Document 노드가 결과에 섞이지 않게 함.
    """
    if not seed_ids:
        return []
    try:
        return self.graph.query(
            "MATCH (n:__Entity__)-[r]-(m:__Entity__) "
            "WHERE n.id IN $seed_ids AND type(r) <> 'MENTIONS' "
            "WITH n, r, m, CASE WHEN startNode(r) = n THEN 'out' ELSE 'in' END AS direction "
            "RETURN n.id AS source, "
            "       type(r) AS relation, "
            "       direction, "
            "       m.id AS target, "
            "       coalesce(m.description, m.text, m.id) AS target_text "
            "LIMIT $limit",
            params={"seed_ids": seed_ids, "limit": GRAPH_EXPAND_LIMIT},
        )
    except Exception as error:
        print(f"  ! 1-hop 그래프 확장 실패(무시): {error}")
        return []`
    },
    {
      id: "fn_build_kg_text",
      name: "GraphRetriever._build_kg_text()",
      fileId: "retriever",
      summary: "진입 엔티티와 1-hop 관계를 LLM이 읽을 텍스트로 합성",
      how: "그래프에서 가져온 엔티티·관계는 딕셔너리 목록입니다. LLM은 텍스트를 읽으므로, 이를 '- 특허 ->[APPLIES_TO] 제29조(특허요건)' 같은 줄로 풀어 씁니다. 이 텍스트가 retrieve()에서 '지식그래프' Document의 본문이 되어 답변 근거로 쓰입니다.",
      terms: ["one_hop"],
      lines: [
        { at: "if not entity_hits and not relations:", text: "엔티티도 관계도 없으면 빈 문자열을 반환합니다. retrieve()는 빈 문자열이면 그래프 Document를 추가하지 않습니다." },
        { at: "parts.append(\"[지식그래프 관련 엔티티]\")", text: "관련 엔티티 목록의 제목 줄입니다. 아래에 엔티티 이름·타입·설명을 한 줄씩 붙입니다." },
        { at: "parts.append(\"[지식그래프 관계 (멀티홉 추론 근거)]\")", text: "엔티티 사이의 관계 목록 제목입니다. 이 관계들이 '요건과 절차의 연결' 같은 멀티홉 답변의 근거가 됩니다." },
        { at: "arrow = \"->\" if row.get(\"direction\") == \"out\" else \"<-\"", text: "관계의 방향을 화살표로 표시합니다. 진입 엔티티에서 나가면 ->, 들어오면 <- 로 그려 읽기 쉽게 합니다." }
      ],
      code: `@staticmethod
def _build_kg_text(entity_hits: list[dict[str, Any]], relations: list[dict[str, Any]]) -> str:
    """진입 엔티티와 1-hop 관계를 LLM 컨텍스트용 텍스트로 합성함."""
    if not entity_hits and not relations:
        return ""
    parts: list[str] = []
    if entity_hits:
        parts.append("[지식그래프 관련 엔티티]")
        for hit in entity_hits:
            labels = ",".join(hit.get("labels") or []) or "Entity"
            description = (hit.get("description") or "").strip()
            parts.append(f"- {hit.get('id')} ({labels}): {description[:200]}")
    if relations:
        parts.append("[지식그래프 관계 (멀티홉 추론 근거)]")
        for row in relations:
            arrow = "->" if row.get("direction") == "out" else "<-"
            target_text = (row.get("target_text") or "").strip()
            parts.append(
                f"- {row.get('source')} {arrow}[{row.get('relation')}] "
                f"{row.get('target')} ({target_text[:120]})"
            )
    return "\\n".join(parts)`
    },
    {
      id: "fn_load_graph",
      name: "load_graph()",
      fileId: "setup",
      summary: "Neo4j 연결과 질의 임베딩을 준비하고, 인덱싱 선행 여부를 확인",
      how: "ChromaDB 버전의 load_vectorstore()를 대체합니다. Neo4j에 연결한 뒤, entity_embedding·doc_embedding 인덱스가 있는지 확인해 없으면 '인덱싱을 먼저 하라'고 안내합니다. 빈 그래프에 질문해서 빈 답을 받는 혼란을 막습니다.",
      terms: ["neo4j_graph", "openai_embedding", "entity_embedding", "doc_embedding"],
      lines: [
        { at: "graph = Neo4jGraph(url=NEO4J_URI, username=NEO4J_USER, password=NEO4J_PASSWORD)", text: "Neo4j(7688 포트)에 연결합니다. 실패하면 docker compose로 컨테이너를 먼저 띄우라고 안내합니다." },
        { at: "index_names = {row[\"name\"] for row in graph.query(", text: "Neo4j에 어떤 인덱스가 있는지 이름 목록을 가져옵니다. 인덱싱이 끝났는지 확인하는 용도입니다." },
        { at: "missing = {ENTITY_INDEX_NAME, DOC_INDEX_NAME} - index_names", text: "필요한 두 벡터 인덱스 중 빠진 것을 찾습니다. 하나라도 없으면 인덱싱이 선행되지 않은 것입니다." },
        { at: "embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL, api_key=os.environ.get(\"OPENAI_API_KEY\"))", text: "질문을 벡터로 바꿀 OpenAI 임베딩 객체를 만듭니다. 인덱싱과 같은 모델·차원이어야 검색됩니다." }
      ],
      code: `def load_graph() -> tuple[Neo4jGraph, OpenAIEmbeddings]:
    """특허법 GraphRAG용 Neo4j 연결과 질의 임베딩을 준비함 (검색 전용).

    인덱싱과 동일한 임베딩 모델(text-embedding-3-small, 1536차원)을 지정해야
    질의 벡터와 저장 벡터의 차원·의미 공간이 일치하여 검색이 정상 동작함.
    """
    try:
        graph = Neo4jGraph(url=NEO4J_URI, username=NEO4J_USER, password=NEO4J_PASSWORD)
    except Exception as error:
        raise RuntimeError(
            f"Neo4j 연결 실패: {error}\\n"
            f"먼저 'docker compose up -d --wait'로 graphrag-simple-neo4j를 기동하세요 ({NEO4J_URI})."
        )
    # 벡터 인덱스 존재 여부 확인 — 없으면 인덱싱이 선행되지 않은 것
    index_names = {row["name"] for row in graph.query("SHOW INDEXES YIELD name RETURN name")}
    missing = {ENTITY_INDEX_NAME, DOC_INDEX_NAME} - index_names
    if missing:
        raise RuntimeError(
            f"벡터 인덱스 누락: {', '.join(sorted(missing))}\\n"
            f"먼저 'indexing/index_documents.py'를 실행해 특허법 KG·벡터 인덱스를 구축하세요."
        )
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL, api_key=os.environ.get("OPENAI_API_KEY"))
    return graph, embeddings`
    },
    {
      id: "fn_agentic_init",
      name: "AgenticRAG.__init__()",
      fileId: "setup",
      summary: "GraphRetriever와 구조화 평가기들을 묶어 그래프를 컴파일",
      how: "원본 챗봇이 ChromaDB retriever를 만들던 자리에 GraphRetriever를 끼웁니다. 이 한 줄이 'Vector DB를 GraphRAG로 교체'의 실체입니다. 나머지(라우터·관련성/근거성/유용성 평가기·질문 재작성기)는 원본과 동일하게 json_schema 구조화 출력을 씁니다.",
      terms: ["GraphRetriever", "with_structured_output", "chatgroq", "langgraph_stategraph"],
      lines: [
        { at: "self.graph_retriever = GraphRetriever(graph, embeddings)", text: "★ 핵심 한 줄. ChromaDB 검색기 대신 Neo4j GraphRAG 검색기를 씁니다. 반환 타입이 같아 뒤 코드는 그대로입니다." },
        { at: "self.router = llm.with_structured_output(RouteDecision, method=\"json_schema\")", text: "라우터의 출력을 RouteDecision 스키마(JSON)로 강제합니다. gpt-oss가 도구 이름을 잘못 만드는 문제를 피하려고 json_schema 방식을 씁니다." },
        { at: "self.graph = self._build_graph()", text: "노드와 엣지를 연결한 실행 가능한 그래프를 미리 컴파일해 둡니다." }
      ],
      code: `def __init__(self, llm: ChatGroq, graph: Neo4jGraph, embeddings: OpenAIEmbeddings):
    self.llm = llm
    # ChromaDB 검색기 대신 Neo4j GraphRAG 하이브리드 검색기를 사용 (반환 타입은 동일 List[Document])
    self.graph_retriever = GraphRetriever(graph, embeddings)
    # with_structured_output(method="json_schema"): LLM 응답을 Pydantic 스키마(JSON)로 강제함.
    # gpt-oss-120b는 기본 function_calling 모드에서 도구 이름을 잘못 생성해 호출이 실패할 수 있어,
    # 도구 이름이 없는 json_schema 방식으로 안정성을 확보함.
    self.router = llm.with_structured_output(RouteDecision, method="json_schema")
    self.relevance_grader = llm.with_structured_output(BatchRelevanceGrade, method="json_schema")
    self.support_grader = llm.with_structured_output(SupportGrade, method="json_schema")
    self.usefulness_grader = llm.with_structured_output(UsefulnessGrade, method="json_schema")
    self.query_rewriter = llm.with_structured_output(RewrittenQuery, method="json_schema")
    # 노드들을 연결한 실행 가능한 그래프를 미리 컴파일해 둠
    self.graph = self._build_graph()`
    },
    {
      id: "fn_node_retrieve",
      name: "AgenticRAG.retrieve()  (노드)",
      fileId: "nodes",
      summary: "라우터가 고른 소스(법률 GraphRAG·웹·YouTube)에서만 검색 수행",
      how: "법률 소스 이름이 원본의 'vectordb'에서 'graphrag'로 바뀌었고, 호출도 ChromaDB retriever에서 GraphRetriever로 바뀐 것 외에는 동일합니다. 웹·YouTube는 각각 try/except로 감싸 한 소스가 실패해도 나머지로 답할 수 있게 합니다(graceful degradation).",
      terms: ["GraphRetriever", "graceful_degradation", "duckduckgo", "youtube_api"],
      lines: [
        { at: "if \"graphrag\" in sources:", text: "라우터가 'graphrag'(법률)를 골랐을 때만 Neo4j GraphRAG 검색을 합니다. 원본의 'vectordb' 분기를 대체합니다." },
        { at: "vector_docs_raw = self.graph_retriever.retrieve(state[\"question\"])", text: "GraphRAG 하이브리드 검색을 실행해 조문 청크+그래프 관계 Document를 가져옵니다." },
        { at: "if \"web\" in sources:", text: "웹 소스가 선택됐으면 DuckDuckGo로 최근 1년 문서를 검색합니다. 이 부분은 원본과 동일합니다." },
        { at: "if \"youtube\" in sources:", text: "YouTube 소스가 선택됐으면 Data API로 최근 1년 영상을 검색합니다. 역시 원본과 동일합니다." }
      ],
      code: `def retrieve(self, state: AgentState) -> dict:
    """검색 노드: 라우터가 선택한 소스에서만 검색을 수행함."""
    sources = state["sources"]
    vector_docs_raw, web_results, youtube_results = [], [], []

    # 특허법 GraphRAG 검색 (재작성된 질문 기준) — 조문 벡터 + 엔티티 벡터·1-hop 그래프
    if "graphrag" in sources:
        print("\\n[Retrieve:GraphRAG] 특허법 조문·지식그래프 검색 중...")
        try:
            vector_docs_raw = self.graph_retriever.retrieve(state["question"])
            print(f"  → {len(vector_docs_raw)}개 문서 검색됨 (조문 청크 + 지식그래프)")
        except Exception as error:
            print(f"  ! GraphRAG 검색 실패(무시하고 진행): {error}")

    # 웹 검색 (DuckDuckGo, 연도 제외 쿼리)
    if "web" in sources:
        try:
            web_results = search_web(state["web_query"] or state["question"])
        except Exception as error:
            print(f"  ! 웹 검색 실패(무시하고 진행): {error}")

    # YouTube 검색 (Data API v3, 짧은 키워드 쿼리)
    if "youtube" in sources:
        try:
            youtube_results = search_youtube(state["youtube_query"] or state["question"])
        except Exception as error:
            print(f"  ! YouTube 검색 실패(무시하고 진행): {error}")

    return {
        "vector_docs_raw": vector_docs_raw,
        "web_results": web_results,
        "youtube_results": youtube_results,
    }`
    },
    {
      id: "fn_grade_documents",
      name: "AgenticRAG.grade_documents()  (IsRel)",
      fileId: "nodes",
      summary: "GraphRAG가 가져온 문서들의 관련성을 한 번의 LLM 호출로 일괄 평가",
      how: "Self-RAG의 IsRel 토큰입니다. 조문 청크와 그래프 관계 문서를 모두 LLM에 보여 주고, 질문에 직접 도움이 되는 것만 골라냅니다. '특허 요건' 질문에서는 조문 청크보다 '제29조(특허요건)' 관계 문서가 더 관련 있다고 선별되기도 합니다.",
      terms: ["self_rag", "isrel", "with_structured_output"],
      lines: [
        { at: "docs = state[\"vector_docs_raw\"]", text: "GraphRAG가 가져온 원본 문서들(조문 청크 + 그래프 관계)을 꺼냅니다. 이 중 관련 있는 것만 남길 예정입니다." },
        { at: "docs_text = \"\\n\\n\".join(f\"[문서 {i}]\\n{doc.page_content}\" for i, doc in enumerate(docs))", text: "각 문서에 번호를 붙여 하나의 텍스트로 만듭니다. LLM이 번호로 어떤 문서가 관련 있는지 답하게 합니다." },
        { at: "batch: BatchRelevanceGrade = (prompt | self.relevance_grader).invoke(", text: "LLM을 한 번만 호출해 모든 문서의 관련성을 동시에 평가합니다. 문서마다 호출하는 것보다 빠르고 저렴합니다." },
        { at: "if 0 <= grade.document_index < len(docs) and grade.is_relevant:", text: "LLM이 잘못된 번호를 줄 수 있으므로 범위를 확인하고, 관련 있다고 표시된 문서만 최종 목록에 담습니다." }
      ],
      code: `def grade_documents(self, state: AgentState) -> dict:
    """[IsRel] 노드: GraphRAG 검색 문서의 관련성을 1회 LLM 호출로 일괄 평가해 선별함."""
    docs = state["vector_docs_raw"]
    if not docs:
        return {"vector_docs": []}

    print("\\n[IsRel] GraphRAG 문서 관련성 일괄 평가 중...")
    docs_text = "\\n\\n".join(f"[문서 {i}]\\n{doc.page_content}" for i, doc in enumerate(docs))
    prompt = ChatPromptTemplate.from_messages([
        ("system", "당신은 검색된 특허법 문서들이 질문과 관련 있는지 평가하는 전문가입니다. ..."),
        ("human", "질문: {question}\\n\\n검색된 문서들:\\n{documents}\\n\\n각 문서의 관련성을 평가해 주세요."),
    ])
    batch: BatchRelevanceGrade = (prompt | self.relevance_grader).invoke({
        "question": state["question"],
        "documents": docs_text,
    })
    relevant_docs = []
    for grade in batch.results:
        # 구조화 출력이 잘못된 인덱스를 줄 수 있으므로 범위를 검사해 안전하게 매핑함
        if 0 <= grade.document_index < len(docs) and grade.is_relevant:
            relevant_docs.append(docs[grade.document_index])
    print(f"  → 관련 문서 {len(relevant_docs)}/{len(docs)}개 선별")
    return {"vector_docs": relevant_docs}`
    },
    {
      id: "fn_build_sources",
      name: "build_sources_section()",
      fileId: "nodes",
      summary: "검색 결과 메타데이터로 '출처' 섹션을 코드가 직접 구성 (조항 자동 추출)",
      how: "LLM이 URL을 빠뜨리지 않도록, 출처는 LLM이 아니라 코드가 직접 만듭니다. 법률은 문서 본문에서 '제29조' 같은 조항 번호를 정규식으로 뽑아 묶고, 웹·YouTube는 제목+링크를 마크다운으로 출력합니다. GraphRAG로 바꿔도 이 함수는 그대로 동작합니다(반환 Document 형식이 같기 때문).",
      terms: ["article_pattern", "kg_source_label"],
      lines: [
        { at: "law_name = Path(doc.metadata.get(\"source\", \"특허법\")).stem or \"특허법\"", text: "문서 출처 파일명에서 확장자를 떼어 법령명을 만듭니다. '특허법.pdf'→'특허법', 그래프 문서는 '특허법 지식그래프(KG)'가 됩니다." },
        { at: "for article in ARTICLE_PATTERN.findall(doc.page_content):", text: "문서 본문에서 '제29조', '제42조의2' 같은 조항을 정규식으로 모두 찾습니다. GraphRAG가 넣은 조문 원문 덕분에 조항이 정확히 뽑힙니다." },
        { at: "blocks.append(\"**법률**\\n\" + \"\\n\".join(law_lines))", text: "법령별로 모은 조항들을 '법률' 출처 블록으로 만듭니다. 예: '- 특허법 제29조, 제42조'." },
        { at: "web_lines = [f\"- [{item['title']}]({item['link']})\"", text: "웹 결과를 제목+링크 마크다운으로 만듭니다. LLM이 아니라 검색 단계에서 모은 실제 URL을 그대로 씁니다." }
      ],
      code: `def build_sources_section(state: AgentState) -> str:
    """수집된 검색 결과 메타데이터로 '출처' 섹션을 코드에서 직접 구성함."""
    blocks = []

    # 법률 출처: 문서 출처(법령명)별로 본문에서 조항 번호를 추출해 묶음
    if state["vector_docs"]:
        law_articles: dict[str, list[str]] = {}
        for doc in state["vector_docs"]:
            # 메타데이터 source는 PDF 파일명/그래프 라벨이므로 확장자를 떼어 출처명으로 사용
            law_name = Path(doc.metadata.get("source", "특허법")).stem or "특허법"
            law_articles.setdefault(law_name, [])
            for article in ARTICLE_PATTERN.findall(doc.page_content):
                if article not in law_articles[law_name]:
                    law_articles[law_name].append(article)
        law_lines = []
        for law_name, articles in law_articles.items():
            if articles:
                law_lines.append(f"- {law_name} {', '.join(articles)}")
            else:
                law_lines.append(f"- {law_name}")
        blocks.append("**법률**\\n" + "\\n".join(law_lines))

    # 웹 출처: 제목 + URL 링크 (반드시 포함)
    if state["web_results"]:
        web_lines = [f"- [{item['title']}]({item['link']})" for item in state["web_results"] if item["link"]]
        if web_lines:
            blocks.append("**웹**\\n" + "\\n".join(web_lines))

    if not blocks:
        return ""
    return "## 출처\\n" + "\\n\\n".join(blocks)`
    },
    {
      id: "fn_build_graph",
      name: "AgenticRAG._build_graph()",
      fileId: "graph",
      summary: "노드와 엣지를 StateGraph로 연결해 Self-RAG 워크플로우를 컴파일",
      how: "각 처리 단계를 노드로 등록하고, 조건부 엣지로 분기를 만듭니다. route 후 검색 필요 여부로 갈라지고, 답변 평가 후 유용하면 끝, 부족하면 rewrite→route로 되돌아가는 재검색 루프를 구성합니다. 이 그래프 구조는 GraphRAG 교체와 무관하게 원본과 동일합니다.",
      terms: ["langgraph_stategraph", "conditional_edge", "self_rag"],
      lines: [
        { at: "workflow.add_node(\"route\", self.route)", text: "각 처리 단계를 이름과 함께 노드로 등록합니다. route, retrieve, grade_documents 등이 모두 노드가 됩니다." },
        { at: "self.decide_search_path,", text: "route 다음에 '검색 필요/불필요'로 갈라지는 조건부 분기 함수입니다. 필요하면 retrieve로, 아니면 direct_answer로 보냅니다." },
        { at: "workflow.add_edge(\"rewrite\", \"route\")", text: "질문을 재작성한 뒤 다시 route로 돌아가는 엣지입니다. 이 되돌이 연결이 Self-RAG의 재검색 루프를 만듭니다." },
        { at: "return workflow.compile()", text: "노드·엣지 설계를 실행 가능한 그래프로 컴파일합니다. 이후 graph.invoke()로 질문을 흘려보낼 수 있습니다." }
      ],
      code: `def _build_graph(self):
    """노드와 엣지를 연결해 실행 가능한 StateGraph로 컴파일함."""
    workflow = StateGraph(AgentState)        # 상태 스키마(AgentState) 기반 그래프 생성
    # 노드 등록 (이름 → 실행 함수)
    workflow.add_node("route", self.route)
    workflow.add_node("retrieve", self.retrieve)
    workflow.add_node("grade_documents", self.grade_documents)
    workflow.add_node("generate", self.generate)
    workflow.add_node("grade_generation", self.grade_generation)
    workflow.add_node("rewrite", self.rewrite)
    workflow.add_node("direct_answer", self.direct_answer)

    # 엣지 연결
    workflow.add_edge(START, "route")        # 시작 → route
    workflow.add_conditional_edges(          # route 후 검색 필요 여부로 분기
        "route",
        self.decide_search_path,
        {"retrieve": "retrieve", "direct": "direct_answer"},
    )
    workflow.add_edge("retrieve", "grade_documents")     # 검색 → 관련성 평가
    workflow.add_edge("grade_documents", "generate")     # 관련성 평가 → 답변 생성
    workflow.add_edge("generate", "grade_generation")    # 답변 생성 → 유용성 평가
    workflow.add_conditional_edges(          # 유용성 평가 후 재검색/종료 분기
        "grade_generation",
        self.decide_after_generation,
        {"rewrite": "rewrite", "end": END},
    )
    workflow.add_edge("rewrite", "route")    # 재작성 → route로 돌아가 재검색 (루프)
    workflow.add_edge("direct_answer", END)  # 직접 답변 → 종료
    return workflow.compile()                # 실행 가능한 앱으로 컴파일`
    }
  ],
  glossary: {
    "GraphRetriever":        "이 예제에서 새로 만든 클래스입니다. 원본 챗봇의 ChromaDB 검색기를 대체하며, Neo4j에서 (1)조문 청크 벡터검색과 (2)엔티티 벡터검색+1-hop 그래프 확장을 결합해 List[Document]로 반환합니다. 반환 형식이 같아 나머지 코드는 바꾸지 않습니다.",
    "List_Document":         "LangChain Document 객체의 목록입니다. ChromaDB 검색기와 GraphRetriever가 똑같이 이 형식을 반환하기 때문에, 검색 백엔드만 갈아끼우고 뒤 코드(평가·컨텍스트·출처)는 그대로 둘 수 있습니다.",
    "langchain_document":    "LangChain의 Document 객체 — page_content(텍스트)와 metadata(사전)로 구성됩니다. GraphRetriever는 조문 청크와 그래프 관계를 모두 이 형식으로 만들어 반환합니다.",
    "embed_query":           "질문 텍스트를 벡터(숫자 목록)로 바꾸는 호출입니다. 같은 모델로 만든 인덱스의 벡터들과 거리를 비교해 가장 비슷한 것을 찾습니다.",
    "doc_embedding":         "특허법 조문 청크를 저장한 벡터 인덱스입니다. '특허 요건은?' 같은 질문을 조문 원문에 직접 매칭할 때 씁니다.",
    "entity_embedding":      "KG 엔티티(요건·절차·권리 등)를 저장한 벡터 인덱스입니다. 질문과 가장 비슷한 엔티티를 찾아 그래프 탐색의 출발점으로 삼습니다.",
    "one_hop":               "그래프에서 한 노드와 직접 연결된(한 단계 떨어진) 이웃까지 탐색하는 것입니다. (특허)-[APPLIES_TO]->(제29조)처럼 엔티티 사이 관계를 가져와 멀티홉 추론의 근거로 씁니다.",
    "cypher":                "Neo4j 전용 그래프 질의 언어입니다. MATCH (a)-[r]->(b) 형태로 노드와 관계를 조회합니다. SQL이 표를 다루듯 Cypher는 그래프를 다룹니다.",
    "neo4j_graph":           "LangChain의 Neo4jGraph — Cypher 실행을 감싼 래퍼입니다. graph.query()로 Cypher 문을 직접 실행합니다.",
    "neo4j_entity_label":    "LLMGraphTransformer가 모든 엔티티에 공통으로 붙이는 __Entity__ 라벨입니다. 이 라벨로 '진짜 엔티티'와 출처용 문서 노드를 구분합니다.",
    "mentions":              "원본 문서(청크)와 거기서 추출된 엔티티를 잇는 출처 연결 관계입니다. 의미 있는 법률 관계가 아니므로 그래프 확장에서 제외합니다.",
    "openai_embedding":      "OpenAI의 text-embedding-3-small 모델 — 텍스트를 1536차원 벡터로 바꿉니다. 인덱싱과 질의가 같은 모델·차원이어야 검색됩니다.",
    "chatgroq":              "LangChain의 ChatGroq — Groq LPU의 채팅 모델(gpt-oss-120b) 래퍼입니다. llm.invoke()로 대화 요청을 보냅니다. 검색 백엔드만 바뀌고 이 LLM은 원본 그대로입니다.",
    "with_structured_output": "LLM의 답을 정해진 스키마(JSON)로 강제하는 기능입니다. 라우팅·평가처럼 결과 형식이 중요한 곳에서 파싱을 안정적으로 만듭니다.",
    "langgraph_stategraph":  "LangGraph의 StateGraph — 상태(State)를 노드 사이로 흘려보내며 워크플로우를 만드는 그래프입니다. 각 노드가 상태의 일부를 갱신하면 자동으로 병합됩니다.",
    "conditional_edge":      "조건에 따라 다음 노드를 고르는 엣지입니다. 예: route 다음에 '검색 필요'면 retrieve로, '불필요'면 direct_answer로 분기합니다.",
    "self_rag":              "검색 증강 생성(RAG)에 자기 평가를 더한 기법입니다. 문서 관련성(IsRel)·답변 근거성(IsSup)·유용성(IsUse)을 스스로 평가해, 부족하면 질문을 고쳐 다시 검색합니다.",
    "isrel":                 "Self-RAG의 토큰 중 하나로, 검색된 문서가 질문과 관련 있는지 판단합니다. 관련 없는 문서를 걸러 답변 품질을 높입니다.",
    "graceful_degradation":  "일부 기능이 실패해도 전체가 멈추지 않고 남은 기능으로 동작하는 설계입니다. 웹 검색이 실패해도 법률·영상 결과로 답을 만듭니다.",
    "duckduckgo":            "API 키가 필요 없는 무료 웹 검색입니다. time='y' 옵션으로 최근 1년 문서만 검색해 최신 정보를 가져옵니다.",
    "youtube_api":           "YouTube Data API v3 — 영상을 검색하는 공식 API입니다. publishedAfter로 최근 1년 영상만, relevanceLanguage='ko'로 한국어 영상을 우선합니다.",
    "article_pattern":       "'제29조', '제42조의2' 같은 법령 조항을 찾는 정규식입니다. 답변 출처에 어떤 조문이 쓰였는지 본문에서 자동으로 뽑아냅니다.",
    "kg_source_label":       "그래프 관계로 만든 합성 문서의 출처 이름('특허법 지식그래프(KG)')입니다. 조문 원문 출처와 구분해 표기하기 위한 라벨입니다."
  }
};
