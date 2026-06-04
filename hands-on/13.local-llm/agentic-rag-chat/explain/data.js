window.EXPLAIN_DATA = {
  meta: { title: "특허 Agentic RAG 챗봇 — 2-Stage Retrieval + Streamlit", entry: "retrieve/app.py" },
  files: [
    { id: "common",    label: "indexing/common.py",    role: "공유 계약: KaLM 임베딩 모델·차원·컬렉션명을 인덱싱·검색 양쪽에서 동일하게 사용" },
    { id: "indexing",  label: "indexing/indexing.py",  role: "PDF 인덱싱 파이프라인: 로드→전처리→청킹→KaLM 4-bit 임베딩→ChromaDB 저장" },
    { id: "retrieval", label: "retrieve/retrieval.py", role: "2-Stage Retrieval: KaLM Bi-encoder top-20 → BGE Cross-encoder top-5 재정렬" },
    { id: "graph",     label: "retrieve/graph.py",     role: "LangGraph Agentic RAG 워크플로우: 라우팅·검색·생성·평가·재작성 루프" },
    { id: "app",       label: "retrieve/app.py",       role: "Streamlit 웹 UI: 캐싱·사이드바·스트리밍 채팅·처리 과정 가시화" }
  ],
  flow: [
    {
      step: 1, title: "PDF 인덱싱 (1회 실행)",
      label: "PDF 인덱싱",
      refs: ["clean_text", "split_documents", "build_vectordb"],
      summary: "indexing.py: PDF → 전처리 → 청킹 → KaLM 4-bit 임베딩 → ChromaDB 저장",
      detail: "특허법 PDF를 읽어 노이즈(머리글·페이지 번호)를 제거하고, 법령 조문 구조(조→항)를 우선으로 800자 청크로 분할합니다. KaLM 12B 모델을 4-bit 양자화(~7GB VRAM)로 적재해 1024차원 벡터로 변환하고 ChromaDB에 영속 저장합니다. 앱 실행 전 1회만 수행합니다."
    },
    {
      step: 2, title: "앱 초기화 (최초 1회)",
      label: "앱 초기화",
      refs: ["get_retriever", "load_reranker"],
      summary: "app.py: @st.cache_resource로 임베더·리랭커·그래프를 1회만 적재해 캐싱함",
      detail: "Streamlit 앱이 처음 실행될 때 무거운 자원을 적재합니다. CrossEncoder(BGE 리랭커)를 먼저 CUDA에 올린 뒤 ChromaDB를 로드해야 segfault를 방지할 수 있습니다(적재 순서 중요). 워밍업 질의 1회로 KaLM 임베더도 미리 적재합니다."
    },
    {
      step: 3, title: "라우팅 (check_retrieval)",
      label: "라우팅",
      refs: ["check_retrieval_node"],
      summary: "graph.py: 법률 DB 검색 필요 여부·소스·소스별 최적 쿼리를 결정함",
      detail: "사용자 질문과 이전 대화를 보고 LLM이 '특허 질문인가?'를 판단합니다. 법률 DB가 필요하면 vectordb/web/YouTube 중 적합한 소스를 고르고 소스별로 검색 쿼리를 최적화합니다. 법률 DB가 불필요한 질문도 웹 검색으로 보강합니다."
    },
    {
      step: 4, title: "2-Stage 검색 (search)",
      label: "2-Stage 검색",
      refs: ["search_node", "two_stage_retrieve"],
      summary: "retrieval.py: KaLM bi-encoder top-20 회수 → BGE cross-encoder top-5 재정렬",
      detail: "1단계(Bi-encoder): 질의를 KaLM으로 1024차원 벡터로 변환해 ChromaDB에서 코사인 유사도 상위 20개를 빠르게 회수합니다. 2단계(Cross-encoder): BGE 리랭커가 (질의, 문서) 쌍을 함께 보고 관련도를 직접 채점해 상위 5개만 남깁니다. 빠른 1차 + 정밀한 2차의 조합입니다."
    },
    {
      step: 5, title: "답변 생성 (generate)",
      label: "답변 생성",
      refs: ["generate_node_graph"],
      summary: "graph.py: 자막 발췌 포함 컨텍스트로 답변을 스트리밍 생성하고 출처를 부착함",
      detail: "법률 조문·웹 본문·YouTube 자막 청크를 하나의 컨텍스트로 합쳐 LLM에 답변을 요청합니다. Groq LPU의 스트리밍으로 토큰이 실시간으로 화면에 출력됩니다. 법률 DB가 불필요한 질문은 generate_direct가 웹 검색 결과로 직접 답변합니다."
    },
    {
      step: 6, title: "유용성 평가 (evaluate)",
      label: "유용성 평가",
      refs: ["evaluate_node"],
      summary: "graph.py: 답변이 질문에 실제로 유용한지 평가해 재검색 루프 여부를 결정함",
      detail: "LLM이 '이 답변이 질문에 직접 답하고 있는가?'를 평가합니다. 유용하지 않고 재시도 횟수(MAX_RETRIES=2)가 남아 있으면 rewrite → check_retrieval 루프로 돌아갑니다. 유용하거나 재시도가 소진되면 종료합니다."
    },
    {
      step: 7, title: "쿼리 재작성 (rewrite)",
      label: "쿼리 재작성",
      summary: "graph.py: 실패 이유를 분석해 더 나은 검색을 위해 질문을 재작성함",
      detail: "실패한 답변과 실패 이유를 LLM에게 보여주고, 모호한 구어체를 정확한 특허 용어로 바꿉니다. 재작성된 질문으로 check_retrieval부터 다시 실행합니다."
    },
    {
      step: 8, title: "UI 렌더링",
      label: "UI 렌더링",
      refs: ["handle_user_input", "stream_events"],
      summary: "app.py: st.status 단계 가시화 + st.write_stream 토큰 스트리밍 + 처리 과정 로그",
      detail: "라우팅 결과·재정렬 top-5·웹/YouTube 결과·유용성 평가를 st.status로 실시간 표시합니다. 답변 본문은 st.write_stream으로 토큰 단위로 스트리밍하고, 처리 과정 전체는 접이식 expander로 보여줍니다."
    }
  ],
  functions: [
    // ─── common.py ───────────────────────────────────────────────────────────
    {
      id: "ensure_model",
      name: "KaLMEmbeddings._ensure_model()",
      fileId: "common",
      summary: "KaLM 12B 임베딩 모델을 4-bit 양자화로 1회 적재함 (지연 로딩)",
      how: "SentenceTransformer에 BitsAndBytesConfig(4-bit nf4 양자화)와 truncate_dim=1024를 적용해 11.76B 파라미터를 ~7GB VRAM으로 줄입니다. 이 무거운 모델을 클래스 생성 시점이 아니라 첫 임베딩 호출 시점에 1회만 적재해 불필요한 지연을 없앱니다.",
      terms: ["SentenceTransformer", "BitsAndBytesConfig", "MRL", "지연 로딩"],
      lines: [
        { at: "if self._model is not None:", text: "이미 모델을 적재했으면 재적재 없이 바로 반환합니다. 두 번째 호출부터는 이 줄에서 즉시 반환됩니다." },
        { at: "load_in_4bit=True,", text: "모델 가중치를 4-bit(nf4)로 양자화합니다. float32 대비 ~8배 메모리를 절약합니다." },
        { at: "bnb_4bit_compute_dtype=torch.bfloat16,", text: "양자화는 4-bit이지만 연산은 bfloat16으로 수행해 정확도를 유지합니다." },
        { at: "trust_remote_code=True,", text: "HuggingFace 모델 저장소의 커스텀 코드(gemma3_text 임베딩)를 실행 허용합니다." },
        { at: "truncate_dim=EMBED_DIM,", text: "MRL: 3840차원 벡터를 1024차원으로 잘라 씁니다. 앞 1024차원만으로도 의미가 보존됩니다." }
      ],
      code: `def _ensure_model(self):
    """SentenceTransformer 모델을 4-bit 양자화로 1회 적재함 (이후 호출은 재사용)."""
    if self._model is not None:
        return self._model
    from sentence_transformers import SentenceTransformer
    from transformers import BitsAndBytesConfig

    # BitsAndBytesConfig: 가중치를 4-bit(nf4)로 양자화하되 연산은 bfloat16으로 수행하는 설정
    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )
    self._model = SentenceTransformer(
        EMBEDDING_MODEL,
        trust_remote_code=True,        # 모델 저장소의 커스텀 코드(gemma3_text 임베딩) 실행 허용
        truncate_dim=EMBED_DIM,        # MRL: 3840 → 1024 차원으로 절단
        model_kwargs={"quantization_config": quantization_config, "torch_dtype": torch.bfloat16},
    )
    return self._model`
    },
    {
      id: "embed_documents",
      name: "KaLMEmbeddings.embed_documents()",
      fileId: "common",
      summary: "문서 청크 목록을 임베딩해 1024차원 L2 정규화 벡터 목록으로 반환함",
      how: "문서에는 DOCUMENT_PROMPT(빈 문자열)를 사용합니다. 임베딩 후 truncate_dim 절단으로 1024차원이 됐지만, 모델 내부 Normalize는 3840차원 기준이라 L2 재정규화가 필요합니다. normalize_embeddings=True가 이 재정규화를 처리합니다.",
      terms: ["instruct 임베더", "L2 정규화", "DOCUMENT_PROMPT"],
      lines: [
        { at: "model = self._ensure_model()", text: "처음 호출 시 KaLM 모델을 적재하고, 이후는 캐싱된 모델을 반환합니다." },
        { at: "prompt=DOCUMENT_PROMPT,", text: "문서는 빈 프롬프트를 씁니다. instruct 임베더의 비대칭 인코딩: 문서(빈 프롬프트) vs 질의(지시문 프롬프트)." },
        { at: "show_progress_bar=True,", text: "인덱싱 시 진행 상황을 터미널에 표시합니다. 청크가 수백 개라 처리에 시간이 걸립니다." },
        { at: "return vectors.tolist()", text: "numpy 배열을 파이썬 float 리스트로 변환합니다. ChromaDB는 순수 파이썬 리스트를 받습니다." }
      ],
      code: `def embed_documents(self, texts: list[str]) -> list[list[float]]:
    """문서 청크 목록을 임베딩함 (document 프롬프트 사용, 1024차원 L2 정규화 벡터 반환)."""
    model = self._ensure_model()
    # normalize_embeddings=True는 truncate_dim 절단 '이후' 단계에서 L2 정규화를 적용함
    # (모델 내부 Normalize 모듈은 3840차원 기준이라, 1024 절단 후 재정규화가 반드시 필요함)
    vectors = model.encode(
        texts,
        prompt=DOCUMENT_PROMPT,
        normalize_embeddings=True,
        batch_size=self.batch_size,
        show_progress_bar=True,
    )
    # numpy 배열을 ChromaDB가 받는 순수 float 리스트로 변환함
    return vectors.tolist()`
    },
    {
      id: "embed_query",
      name: "KaLMEmbeddings.embed_query()",
      fileId: "common",
      summary: "단일 질의를 지시문 프롬프트로 임베딩해 1024차원 벡터로 반환함",
      how: "질의에는 QUERY_PROMPT(지시문: 'Given a query, retrieve documents...')를 붙입니다. 같은 텍스트라도 문서와 질의가 다른 프롬프트를 사용해 서로 다른 벡터 공간에 매핑됩니다. 이 비대칭 인코딩이 검색 정확도를 높입니다.",
      terms: ["QUERY_PROMPT", "비대칭 인코딩"],
      lines: [
        { at: "prompt=QUERY_PROMPT,", text: "질의에 지시문 프리픽스를 붙입니다. 'Instruct: Given a query...' 형태로 모델에 검색 의도를 알립니다." },
        { at: "vector = model.encode(", text: "단일 질의를 리스트로 감싸서 encode에 전달합니다. 반환값은 (1, 1024) 형태의 배열입니다." },
        { at: "return vector[0].tolist()", text: "첫 번째(유일한) 벡터를 꺼내 리스트로 변환합니다. ChromaDB 검색에서 1024개의 float 값으로 사용됩니다." }
      ],
      code: `def embed_query(self, text: str) -> list[float]:
    """단일 질의를 임베딩함 (query 지시문 프롬프트 사용, 1024차원 L2 정규화 벡터 반환)."""
    model = self._ensure_model()
    vector = model.encode(
        [text],
        prompt=QUERY_PROMPT,
        normalize_embeddings=True,
        batch_size=self.batch_size,
    )
    return vector[0].tolist()`
    },
    // ─── indexing.py ─────────────────────────────────────────────────────────
    {
      id: "clean_text",
      name: "clean_text()",
      fileId: "indexing",
      summary: "PDF 추출 텍스트에서 머리글·바닥글·페이지 번호 등 노이즈를 제거함",
      how: "PyPDFLoader는 페이지 단위로 텍스트를 추출하므로 법제처 머리글, '- 1 -' 형식의 페이지 번호가 섞입니다. 정규식으로 패턴을 제거하고, 각 줄을 검사해 법령명만 반복되는 머리글 줄도 없앱니다.",
      terms: ["PyPDFLoader", "정규식 re.sub"],
      lines: [
        { at: "lines = text.split", text: "텍스트를 줄 단위로 쪼갭니다. 각 줄을 검사해 노이즈 줄을 걸러냅니다." },
        { at: "noise_keywords = [\"법제처\"", text: "법제처·국가법령정보센터 키워드가 있는 줄은 머리글/바닥글로 보고 제거합니다." },
        { at: "line.strip() == RUNNING_HEADER", text: "줄 전체가 '특허법'이면 반복 머리글 줄로 보고 제거합니다. 본문 인용은 다른 글자와 함께 나오므로 안전합니다." },
        { at: "cleaned_lines.append(line)", text: "노이즈가 아닌 줄만 남깁니다." }
      ],
      code: `def clean_text(text: str) -> str:
    """PDF 추출 텍스트에서 머리글·바닥글·페이지 번호 등 노이즈를 제거함."""
    # 페이지 번호 패턴 제거: "- 1 -", "1 / 50" 형식
    text = re.sub(r"-\\s*\\d+\\s*-", "", text)
    text = re.sub(r"\\d+\\s*/\\s*\\d+", "", text)
    # 머리글·바닥글에 자주 등장하는 키워드가 포함된 줄을 제거함
    lines = text.split("\\n")
    noise_keywords = ["법제처", "국가법령정보센터"]
    cleaned_lines = []
    for line in lines:
        if any(kw in line for kw in noise_keywords):
            continue
        # 줄 전체가 법령명("특허법")뿐인 반복 머리글 줄 제거
        if line.strip() == RUNNING_HEADER:
            continue
        cleaned_lines.append(line)
    text = "\\n".join(cleaned_lines)
    # 연속 공백·과도한 빈 줄 정규화
    text = re.sub(r"[ \\t]+", " ", text)
    text = re.sub(r"\\n{3,}", "\\n\\n", text)
    return text.strip()`
    },
    {
      id: "split_documents",
      name: "split_documents()",
      fileId: "indexing",
      summary: "RecursiveCharacterTextSplitter로 문서를 800자 청크로 분할함",
      how: "LAW_SEPARATORS 목록을 앞에서부터 적용해 조(\\n제)→항(\\n①②...)→단락(\\n\\n) 순으로 우선 분할합니다. 법령 구조를 살리면서 800자 이하로 잘라야 임베딩 품질이 좋습니다. chunk_overlap=200으로 앞 청크 끝 부분이 다음 청크 앞에 겹쳐 맥락이 끊기지 않습니다.",
      terms: ["RecursiveCharacterTextSplitter", "chunk_size", "chunk_overlap", "LAW_SEPARATORS"],
      lines: [
        { at: "chunk_size=CHUNK_SIZE,", text: "청크 최대 크기 800자. 이보다 짧아질 때까지 separators를 순서대로 적용합니다." },
        { at: "chunk_overlap=CHUNK_OVERLAP,", text: "청크 간 겹치는 200자. 한 조문이 두 청크로 나뉠 때 문맥이 이어지도록 합니다." },
        { at: "separators=LAW_SEPARATORS,", text: "분할 우선순위: 조문(\\n제) → 항(\\n①) → 단락(\\n\\n) → 줄(\\n) → 어절( ) → 문자(빈 문자열)." },
        { at: "return splitter.split_documents(documents)", text: "분할된 청크 리스트를 반환합니다. 각 청크는 Document 객체(page_content + metadata)입니다." }
      ],
      code: `def split_documents(documents: list) -> list:
    """RecursiveCharacterTextSplitter로 문서를 청크로 분할함.

    separators 목록을 앞에서부터 순서대로 적용하며 chunk_size 이하가 될 때까지
    재귀적으로 분할하는 분할기. 법령 구조(조→항)를 우선 경계로 삼아 의미 단위가 끊기지 않게 함.
    """
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=LAW_SEPARATORS,
    )
    return splitter.split_documents(documents)`
    },
    {
      id: "build_vectordb",
      name: "build_vectordb()",
      fileId: "indexing",
      summary: "청크를 KaLM 임베딩으로 변환하여 ChromaDB에 영속 저장함",
      how: "기존 벡터DB 디렉터리를 삭제하고 새로 생성합니다(멱등성: 재실행해도 중복이 없음). Chroma.from_documents()가 청크를 KaLMEmbeddings로 벡터화하고 컬렉션에 저장하는 과정을 한 번에 처리합니다.",
      terms: ["Chroma.from_documents", "멱등성", "영속 디렉터리"],
      lines: [
        { at: "if VECTORDB_DIR.exists():", text: "기존 DB가 있으면 통째로 삭제합니다. 재실행 시 중복 적재로 검색 품질이 떨어지는 것을 방지합니다." },
        { at: "shutil.rmtree(VECTORDB_DIR)", text: "디렉터리와 그 안의 모든 파일을 삭제합니다(shutil=파이썬 내장 파일 유틸리티)." },
        { at: "embeddings = KaLMEmbeddings()", text: "common.py의 공유 임베딩 래퍼를 사용합니다. 인덱싱·검색이 동일 모델을 써야 벡터 공간이 일치합니다." },
        { at: "vectorstore = Chroma.from_documents(", text: "청크를 임베딩해 컬렉션에 저장하는 헬퍼 메서드. 내부적으로 embed_documents()를 호출합니다." },
        { at: "persist_directory=str(VECTORDB_DIR),", text: "이 경로에 ChromaDB 파일이 영구적으로 저장됩니다. 앱 재시작 후에도 재인덱싱 없이 사용할 수 있습니다." }
      ],
      code: `def build_vectordb(chunks: list):
    """청크를 KaLM 임베딩으로 변환하여 ChromaDB에 영속 저장하고 vectorstore를 반환함.

    재실행 멱등성: 기존 영속 디렉터리를 삭제 후 새로 생성함.
    """
    from langchain_chroma import Chroma

    # 기존 벡터 DB가 있으면 통째로 삭제하여 중복 적재를 방지함
    if VECTORDB_DIR.exists():
        shutil.rmtree(VECTORDB_DIR)
        print(f"  - 기존 벡터 DB 삭제: {VECTORDB_DIR}")

    # KaLMEmbeddings: document 프롬프트로 1024차원 정규화 벡터를 생성하는 공유 임베딩 래퍼
    embeddings = KaLMEmbeddings()

    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        collection_name=COLLECTION_NAME,
        persist_directory=str(VECTORDB_DIR),
    )
    return vectorstore`
    },
    // ─── retrieval.py ────────────────────────────────────────────────────────
    {
      id: "load_reranker",
      name: "load_reranker()",
      fileId: "retrieval",
      summary: "BGE Cross-encoder 리랭커(dragonkue/bge-reranker-v2-m3-ko)를 1회 적재함",
      how: "CrossEncoder는 (질의, 문서) 쌍을 한 번에 보고 관련도 점수를 직접 계산합니다. Bi-encoder보다 정확하지만 느리기 때문에, Stage 1에서 추려진 소수 후보(20개)에만 적용합니다. GPU가 있으면 CUDA로 적재합니다.",
      terms: ["CrossEncoder", "Bi-encoder vs Cross-encoder", "dragonkue/bge-reranker-v2-m3-ko"],
      lines: [
        { at: "device = \"cuda\" if torch.cuda.is_available() else \"cpu\"", text: "GPU(CUDA)가 있으면 GPU로, 없으면 CPU로 적재합니다. CPU도 동작하지만 속도가 느립니다." },
        { at: "return CrossEncoder(RERANKER_MODEL", text: "bge-reranker-v2-m3-ko를 로드합니다. 한국어 특화 파인튜닝 버전으로 한국어 특허법 검색에 적합합니다." }
      ],
      code: `def load_reranker():
    """dragonkue/bge-reranker-v2-m3-ko Cross-encoder 리랭커를 1회 적재함.

    CrossEncoder: (문장A, 문장B) 쌍을 한 번에 입력받아 관련도를 단일 점수로 출력하는
    sentence-transformers 래퍼. bge-reranker-v2-m3는 XLM-RoBERTa 기반 다국어 리랭커이며,
    dragonkue 버전은 한국어 검색 품질을 높이도록 파인튜닝됨.
    """
    from sentence_transformers import CrossEncoder
    import torch

    # GPU(cuda) 사용 가능 시 GPU로, 아니면 CPU로 적재함
    device = "cuda" if torch.cuda.is_available() else "cpu"
    return CrossEncoder(RERANKER_MODEL, max_length=RERANKER_MAX_LENGTH, device=device)`
    },
    {
      id: "two_stage_retrieve",
      name: "TwoStageRetriever.retrieve()",
      fileId: "retrieval",
      summary: "2-stage 검색: bi-encoder로 20개 회수 → cross-encoder로 5개로 재정렬",
      how: "Stage 1은 빠르지만 덜 정확한 코사인 유사도로 20개 후보를 뽑고, Stage 2는 느리지만 정확한 cross-encoder로 5개를 추립니다. rerank_score는 logit을 sigmoid로 0~1로 변환해 UI에서 막대로 표시하기 쉽게 합니다.",
      terms: ["similarity_search", "predict", "sigmoid", "rerank_score"],
      lines: [
        { at: "candidates = self.vectorstore.similarity_search(query, k=self.stage1_top_k)", text: "Stage 1: KaLM 벡터로 ChromaDB에서 코사인 유사도 상위 20개를 빠르게 가져옵니다." },
        { at: "pairs = [(query, doc.page_content) for doc in candidates]", text: "Stage 2 입력 준비: (질의, 문서) 쌍의 리스트를 만듭니다. cross-encoder는 쌍을 함께 보고 관련도를 계산합니다." },
        { at: "scores = self.reranker.predict(", text: "각 (질의, 문서) 쌍의 관련도 logit 점수를 반환합니다. 값이 클수록 관련도가 높습니다." },
        { at: "ranked = sorted(zip(candidates, scores)", text: "점수 내림차순으로 정렬합니다. zip은 두 리스트를 쌍으로 묶습니다." },
        { at: "for doc, score in ranked[: self.stage2_top_k]:", text: "상위 top_k(5)개만 선택합니다." },
        { at: "\"rerank_score\": _sigmoid(float(score))", text: "logit 점수를 sigmoid로 0~1 확률로 변환합니다. UI의 막대 그래프(0~10칸)에 사용됩니다." }
      ],
      code: `def retrieve(self, query: str) -> list[Document]:
    """질의에 대해 2-stage 검색을 수행하고 재정렬 상위 top-5 문서를 반환함."""
    # ----- Stage 1: KaLM Bi-encoder 코사인 유사도 top-20 회수 -----
    candidates = self.vectorstore.similarity_search(query, k=self.stage1_top_k)
    if not candidates:
        return []

    # ----- Stage 2: BGE Cross-encoder로 (질의, 문서) 쌍을 재채점 -----
    pairs = [(query, doc.page_content) for doc in candidates]
    scores = self.reranker.predict(
        pairs,
        batch_size=RERANKER_BATCH_SIZE,
        show_progress_bar=False,
    )

    # 점수 내림차순 정렬 후 상위 top-5만 선택함
    ranked = sorted(zip(candidates, scores), key=lambda pair: float(pair[1]), reverse=True)
    top_docs: list[Document] = []
    for doc, score in ranked[: self.stage2_top_k]:
        # 원본 metadata를 보존하면서 rerank_score를 추가함
        new_metadata = {**doc.metadata, "rerank_score": _sigmoid(float(score))}
        top_docs.append(Document(page_content=doc.page_content, metadata=new_metadata))
    return top_docs`
    },
    // ─── graph.py ────────────────────────────────────────────────────────────
    {
      id: "check_retrieval_node",
      name: "check_retrieval() 노드",
      fileId: "graph",
      summary: "법률 DB 검색 필요 여부·소스·소스별 최적 쿼리를 결정함 (구조화 출력)",
      how: "agentic-rag/app.py의 route()와 유사하지만 차이가 있습니다. 법률 DB가 불필요한 질문도 generate_direct에서 웹 검색을 수행하므로, web_query는 항상 채웁니다. CheckRetrieval Pydantic 스키마로 결과를 구조화합니다.",
      terms: ["CheckRetrieval", "MemorySaver", "thread_id"],
      lines: [
        { at: "decision: CheckRetrieval = (prompt | self.retrieval_checker).invoke({", text: "구조화 출력 LLM을 실행합니다. 결과는 CheckRetrieval 스키마의 객체로 반환됩니다." },
        { at: "sources = decision.sources if decision.needs_retrieval else []", text: "법률 DB가 불필요하면 소스를 비워 generate_direct 경로로 흐르게 합니다." },
        { at: "\"route_reasoning\": decision.reasoning,", text: "판단 근거를 상태에 저장합니다. Streamlit UI의 처리 과정 로그에서 표시됩니다." }
      ],
      code: `def check_retrieval(self, state: AgentState) -> dict:
    """법률 DB 검색 필요 여부·소스를 판단하고 소스별 최적 쿼리를 생성함 (구조화 출력)."""
    prompt = ChatPromptTemplate.from_messages([
        ("system", """당신은 특허/지식재산권 전문 챗봇의 검색 라우터입니다.

[needs_retrieval = True] — 특허·실용신안·상표·디자인권 등 지식재산권 관련 질문
  - vectordb : 특허법 조문·요건·절차 등 '법률 근거'가 필요할 때
  - web      : 비용·통계·최신 동향·사례 등 '최신 정보'가 필요할 때
  - youtube  : 강의·튜토리얼·시각적 설명 등 '영상'을 원할 때

[needs_retrieval = False] — 법률 DB가 필요 없는 질문
  → 이 경우에도 웹 검색으로 최신 정보를 보강하므로, web_query에 적절한 키워드를 넣으세요.
# ...(검색 방식별 질의어 최적화 규칙 이하 생략)
"""),
        ("human", "이전 대화:\\n{history}\\n\\n현재 질문: {question}\\n\\n검색 전략을 결정하세요."),
    ])
    decision: CheckRetrieval = (prompt | self.retrieval_checker).invoke({
        "history": format_history(state.get("history", [])),
        "question": state["question"],
    })
    sources = decision.sources if decision.needs_retrieval else []
    return {
        "needs_retrieval": decision.needs_retrieval,
        "sources": sources,
        "vectordb_query": decision.vectordb_query,
        "web_query": decision.web_query,
        "youtube_query": decision.youtube_query,
        "route_reasoning": decision.reasoning,
    }`
    },
    {
      id: "search_node",
      name: "search() 노드",
      fileId: "graph",
      summary: "선택 소스에서 검색 실행: 벡터DB는 2-stage 재정렬, 웹은 본문 추출, YouTube는 자막 청킹",
      how: "agentic-rag/app.py의 retrieve()와 비교해 차이점이 있습니다: 벡터DB는 단순 유사도가 아닌 2-stage 재정렬(retriever.retrieve())을 사용하고, 웹은 스니펫이 아닌 전체 본문을 추출하며, YouTube는 자막 타임스탬프 청크(youtube-transcript-api)를 포함합니다.",
      terms: ["2-Stage Retrieval", "WebBaseLoader", "youtube-transcript-api"],
      lines: [
        { at: "vector_docs = self.retriever.retrieve(vector_query)", text: "TwoStageRetriever.retrieve()로 bi-encoder top-20 → cross-encoder top-5 재정렬을 수행합니다." },
        { at: "web_results = search_web(state[\"web_query\"] or state[\"question\"])", text: "DuckDuckGo로 링크를 검색한 뒤 WebBaseLoader로 각 페이지의 본문 텍스트까지 가져옵니다." },
        { at: "youtube_results = search_youtube(state[\"youtube_query\"] or state[\"question\"])", text: "scrapetube로 영상을 검색하고 youtube-transcript-api로 자막을 120초 단위 청크로 추출합니다." }
      ],
      code: `def search(self, state: AgentState) -> dict:
    """선택 소스에서 검색을 수행함 (벡터DB=2-stage 재정렬 / 웹 / YouTube).

    외부 검색(웹·YouTube)은 각각 try/except로 감싸 한 소스가 실패해도 나머지로 답변을
    생성할 수 있게 함 (graceful degradation).
    """
    sources = state["sources"]
    vector_docs, web_results, youtube_results = [], [], []

    # 특허법 벡터DB 2-stage 검색 (법률 용어 중심 쿼리)
    if "vectordb" in sources:
        vector_query = state["vectordb_query"] or state["question"]
        vector_docs = self.retriever.retrieve(vector_query)

    # 웹 검색 (DuckDuckGo + 본문 추출)
    if "web" in sources:
        try:
            web_results = search_web(state["web_query"] or state["question"])
        except Exception as error:
            print(f"[search] 웹 검색 실패(무시): {error}", file=sys.stderr)

    # YouTube 검색 (scrapetube + 자막)
    if "youtube" in sources:
        try:
            youtube_results = search_youtube(state["youtube_query"] or state["question"])
        except Exception as error:
            print(f"[search] YouTube 검색 실패(무시): {error}", file=sys.stderr)

    return {
        "vector_docs": vector_docs,
        "web_results": web_results,
        "youtube_results": youtube_results,
    }`
    },
    {
      id: "generate_node_graph",
      name: "generate() 노드",
      fileId: "graph",
      summary: "검색 컨텍스트(자막 포함)로 답변을 스트리밍 생성하고 출처 섹션을 부착함",
      how: "YouTube 자막 타임스탬프 청크(예: '2:05 ~ 특허 신규성이란...')를 컨텍스트에 포함해 '몇 분부터 보면 되는지' 안내합니다. gen_llm은 스트리밍 + reasoning_format='hidden'(추론 과정 숨김)으로 최종 답변 텍스트만 UI에 흘립니다.",
      terms: ["gen_llm", "reasoning_format", "StrOutputParser", "stream_mode"],
      lines: [
        { at: "context = build_context(state)", text: "법률 조문·웹 본문·YouTube 자막 발췌를 하나의 컨텍스트 문자열로 합칩니다." },
        { at: "answer_body = (prompt | self.gen_llm | StrOutputParser()).invoke({", text: "gen_llm은 스트리밍 LLM입니다. LangGraph의 stream_mode='messages'가 이 토큰들을 UI에 실시간으로 흘립니다." },
        { at: "sources_section = build_sources_section(state)", text: "법령 조항·웹 URL·YouTube URL을 코드로 직접 구성합니다. LLM에 맡기면 URL 누락이 생깁니다." },
        { at: "return {\"answer\": full_answer, \"sources_md\": sources_section}", text: "answer(전체 답변)와 sources_md(출처만)를 분리 저장합니다. UI에서 본문 스트리밍 후 출처를 별도 렌더링합니다." }
      ],
      code: `def generate(self, state: AgentState) -> dict:
    """검색 컨텍스트로 답변을 생성하고 코드로 출처 섹션을 부착함.

    gen_llm 호출은 LangGraph의 stream_mode='messages'가 토큰 단위로 가로채 UI에 스트리밍함.
    """
    context = build_context(state)
    prompt = ChatPromptTemplate.from_messages([
        ("system", """당신은 특허/지식재산권 전문 상담 AI입니다.

## 역할
- 아래 검색 컨텍스트(특허법 조문·웹·YouTube 자막)와 이전 대화 맥락을 종합해 질문에 답변합니다.
- 법률 용어는 일반인이 이해하기 쉽게 풀어서 설명합니다.

## 규칙
1. 컨텍스트의 정보를 우선 활용하되, 핵심을 요약해 명확히 전달
2. 영상을 검색한 경우 어떤 영상의 몇 분 지점이 도움이 되는지 간단히 안내
3. '출처' 섹션은 시스템이 자동으로 덧붙이므로 답변 본문에 직접 작성하지 마세요

## 이전 대화 맥락
{history}

## 검색 컨텍스트
{context}"""),
        ("human", "{question}"),
    ])
    # prompt | gen_llm | StrOutputParser: 토큰이 콜백으로 흐르며 LangGraph가 스트리밍으로 노출함
    answer_body = (prompt | self.gen_llm | StrOutputParser()).invoke({
        "history": format_history(state.get("history", [])),
        "context": context,
        "question": state["original_question"],
    })
    sources_section = build_sources_section(state)
    full_answer = f"{answer_body}\\n\\n{sources_section}".strip() if sources_section else answer_body
    return {"answer": full_answer, "sources_md": sources_section}`
    },
    {
      id: "evaluate_node",
      name: "evaluate() 노드",
      fileId: "graph",
      summary: "최종 답변이 질문에 유용한지 평가해 재검색 루프 분기 기준을 설정함",
      how: "usefulness_grader LLM이 원래 질문과 현재 답변을 보고 유용성을 판단합니다. agentic-rag/app.py의 grade_generation()과 동일한 역할입니다.",
      terms: ["UsefulnessGrade", "IsUse"],
      lines: [
        { at: "grade: UsefulnessGrade = (prompt | self.usefulness_grader).invoke({", text: "유용성 평가 LLM을 실행합니다. 구조화 출력으로 is_useful(bool)과 reasoning(이유)을 받습니다." },
        { at: "return {\"is_useful\": grade.is_useful", text: "평가 결과를 상태에 저장합니다. decide_after_eval()이 이 값을 보고 종료 또는 재작성을 결정합니다." }
      ],
      code: `def evaluate(self, state: AgentState) -> dict:
    """최종 답변이 사용자 질문에 유용한지 평가함 (재검색 루프의 분기 기준, 구조화 출력)."""
    prompt = ChatPromptTemplate.from_messages([
        ("system", """당신은 생성된 답변이 사용자 질문에 유용한지 평가하는 전문가입니다.

[유용함 = True] 질문에 직접 답하고, 내용이 명확하며 실질적으로 도움이 됨
[유용하지 않음 = False] 질문을 회피·모호하게 답하거나, 관련 없는 정보만 나열하거나, 너무 일반적임

판단 이유(reasoning)는 한국어로 작성하세요."""),
        ("human", "질문: {question}\\n\\n답변:\\n{answer}\\n\\n이 답변이 질문에 유용하게 답하고 있나요?"),
    ])
    grade: UsefulnessGrade = (prompt | self.usefulness_grader).invoke({
        "question": state["original_question"],
        "answer": state["answer"],
    })
    return {"is_useful": grade.is_useful, "usefulness_reasoning": grade.reasoning}`
    },
    {
      id: "graph_build",
      name: "TwoStageAgenticRAG._build_graph()",
      fileId: "graph",
      summary: "노드·엣지를 연결하고 MemorySaver 체크포인터와 함께 그래프를 컴파일함",
      how: "agentic-rag/app.py의 _build_graph()와 구조가 유사하지만, MemorySaver 체크포인터를 추가해 멀티턴 대화를 지원합니다. thread_id별로 상태를 저장해 다른 탭·사용자의 대화와 섞이지 않습니다.",
      terms: ["MemorySaver", "checkpointer", "generate_direct 노드"],
      lines: [
        { at: "workflow = StateGraph(AgentState)        # 상태 스키마", text: "AgentState 스키마를 기반으로 빈 그래프를 만듭니다." },
        { at: "workflow.add_edge(START, \"check_retrieval\")", text: "실행이 시작되면 항상 check_retrieval 노드로 먼저 이동합니다." },
        { at: "workflow.add_edge(\"rewrite\", \"check_retrieval\")", text: "재작성 후 check_retrieval로 돌아가 새 질문으로 재검색합니다. 이것이 재검색 루프입니다." },
        { at: "return workflow.compile(checkpointer=MemorySaver())", text: "MemorySaver를 붙여 컴파일합니다. thread_id별로 상태가 저장되어 멀티턴 대화가 가능해집니다." }
      ],
      code: `def _build_graph(self):
    """노드와 엣지를 연결하고 MemorySaver 체크포인터와 함께 실행 가능한 그래프로 컴파일함."""
    workflow = StateGraph(AgentState)        # 상태 스키마(AgentState) 기반 그래프 생성
    # 노드 등록
    workflow.add_node("check_retrieval", self.check_retrieval)
    workflow.add_node("search", self.search)
    workflow.add_node("generate", self.generate)
    workflow.add_node("generate_direct", self.generate_direct)
    workflow.add_node("evaluate", self.evaluate)
    workflow.add_node("rewrite", self.rewrite)

    # 엣지 연결
    workflow.add_edge(START, "check_retrieval")
    workflow.add_conditional_edges(
        "check_retrieval",
        self.decide_search_path,
        {"search": "search", "direct": "generate_direct"},
    )
    workflow.add_edge("search", "generate")
    workflow.add_edge("generate", "evaluate")
    workflow.add_conditional_edges(
        "evaluate",
        self.decide_after_eval,
        {"rewrite": "rewrite", "end": END},
    )
    workflow.add_edge("rewrite", "check_retrieval")  # 재검색 루프
    workflow.add_edge("generate_direct", END)
    # checkpointer=MemorySaver(): thread_id 별로 상태를 저장해 멀티턴 대화를 지속함
    return workflow.compile(checkpointer=MemorySaver())`
    },
    {
      id: "stream_events",
      name: "stream_events()",
      fileId: "graph",
      summary: "그래프를 스트리밍 실행하며 노드 진행 업데이트와 답변 토큰을 순차로 yield함",
      how: "stream_mode=['updates','messages'] 두 모드를 동시에 구독합니다. 'updates'는 노드가 완료될 때마다 상태 변경을, 'messages'는 LLM이 생성하는 토큰을 줍니다. 답변 생성 노드(generate/generate_direct)의 토큰만 UI에 흘려보내고 구조화 판단 LLM 토큰은 제외합니다.",
      terms: ["stream_mode", "yield", "제너레이터"],
      lines: [
        { at: "for mode, chunk in self.graph.stream(initial_state", text: "그래프를 두 모드로 동시에 스트리밍합니다. 한 턴씩 실행하며 이벤트가 발생할 때마다 (mode, chunk)를 반환합니다." },
        { at: "if mode == \"updates\":", text: "노드 완료 이벤트입니다. 라우팅·검색·평가 결과를 status UI에 표시하는 데 씁니다." },
        { at: "elif mode == \"messages\":", text: "LLM 토큰 이벤트입니다. 답변 생성 노드의 토큰만 필터링해 UI에 흘립니다." },
        { at: "if node_name in (\"generate\", \"generate_direct\") and getattr(message_chunk", text: "구조화 판단 LLM(라우팅·평가·재작성)의 토큰은 제외하고, 답변 생성 LLM의 토큰만 yield합니다." }
      ],
      code: `def stream_events(self, question: str, history: list, thread_id: str):
    """그래프를 스트리밍 실행하며 (노드 진행 업데이트, 답변 토큰)을 정규화해 순차로 yield함.

    stream_mode=["updates","messages"]:
      - "updates"  : 노드가 끝날 때마다 {노드명: 상태변경} 을 받아 진행 상황을 가시화
      - "messages" : 노드 안에서 LLM이 생성하는 토큰을 (메시지청크, 메타데이터)로 받아 스트리밍

    yield 형식: ("update", 노드명, 상태변경 dict) 또는 ("token", 노드명, 토큰 문자열)
    """
    initial_state = build_initial_state(question, history)
    config = {"configurable": {"thread_id": thread_id}, "recursion_limit": RECURSION_LIMIT}
    for mode, chunk in self.graph.stream(initial_state, config=config, stream_mode=["updates", "messages"]):
        if mode == "updates":
            # chunk = {노드명: 해당 노드가 반환한 상태 변경 dict}
            for node_name, update in chunk.items():
                yield ("update", node_name, update)
        elif mode == "messages":
            message_chunk, metadata = chunk
            node_name = metadata.get("langgraph_node", "")
            # 답변 생성 노드의 토큰만 흘려보냄 (라우팅·평가 등 구조화 출력 토큰은 제외)
            if node_name in ("generate", "generate_direct") and getattr(message_chunk, "content", ""):
                yield ("token", node_name, message_chunk.content)`
    },
    // ─── app.py (retrieve) ───────────────────────────────────────────────────
    {
      id: "get_retriever",
      name: "get_retriever()",
      fileId: "app",
      summary: "@st.cache_resource로 임베더·리랭커를 1회만 적재하고 워밍업까지 수행함",
      how: "@st.cache_resource는 앱 재실행 사이에도 반환값을 재사용합니다. CrossEncoder(리랭커)를 반드시 먼저 로드해야 ChromaDB 로드 시 segfault가 발생하지 않습니다. 워밍업 더미 질의로 KaLM 임베더를 미리 올려 첫 질의 시 멈추는 현상을 방지합니다.",
      terms: ["st.cache_resource", "워밍업", "segfault 방지"],
      lines: [
        { at: "reranker = load_reranker()        # 1단계: CrossEncoder 가 CUDA 컨텍스트를 먼저 선점", text: "리랭커를 먼저 로드합니다. 순서가 바뀌면 CUDA 컨텍스트 충돌로 segfault가 발생합니다." },
        { at: "vectorstore = load_vectorstore()  # 2단계", text: "ChromaDB를 두 번째로 로드합니다. CUDA 컨텍스트가 이미 확보된 상태라 충돌이 없습니다." },
        { at: "retriever.retrieve(\"워밍업\")", text: "더미 질의로 KaLM 임베더를 미리 적재합니다. 안 하면 첫 실제 질의 중에 7GB 모델을 올리느라 화면이 멈춥니다." }
      ],
      code: `@st.cache_resource(show_spinner="임베더·리랭커 적재 중... (최초 1회 KaLM 4-bit ~7GB 로딩, 수십 초 소요)")
def get_retriever() -> TwoStageRetriever:
    """2-stage 검색기를 1회만 적재·워밍업해 캐싱함 (KaLM 임베더 + BGE 리랭커).

    @st.cache_resource: 앱 재실행(rerun) 사이에도 반환값을 재사용해, 무거운 모델을
    매 입력마다 다시 적재하지 않게 함.
    """
    # ★ 반드시 리랭커(CrossEncoder)를 먼저 로드해야 함 ★
    # chromadb가 먼저 로드되면 onnxruntime + grpcio 가 CUDA 네이티브를 선점해,
    # 나중에 CrossEncoder 가 CUDA를 초기화할 때 segfault가 발생함.
    reranker = load_reranker()        # 1단계: CrossEncoder 가 CUDA 컨텍스트를 먼저 선점
    vectorstore = load_vectorstore()  # 2단계: chromadb / KaLM 로드 (CUDA 컨텍스트 이미 확보된 상태)
    retriever = TwoStageRetriever(vectorstore, reranker)
    # 스피너가 도는 지금 더미 질의 1회로 KaLM 임베더(7GB)를 미리 적재(워밍업)함.
    retriever.retrieve("워밍업")
    return retriever`
    },
    {
      id: "handle_user_input",
      name: "handle_user_input()",
      fileId: "app",
      summary: "사용자 질문을 처리해 라우팅·검색 단계를 st.status로 가시화하고 답변을 스트리밍함",
      how: "agent.stream_events()가 yield하는 이벤트를 두 종류로 분류합니다. 'update' 이벤트는 st.status 안에 라우팅·검색 결과를 실시간 표시하고, 'token' 이벤트는 st.write_stream을 통해 답변 텍스트를 문자 단위로 화면에 나타냅니다.",
      terms: ["st.status", "st.write_stream", "st.chat_message", "제너레이터"],
      lines: [
        { at: "status = st.status(", text: "진행 단계를 접을 수 있는 박스로 표시합니다. 라우팅·검색·평가 결과가 여기에 실시간으로 나타납니다." },
        { at: "for kind, node, payload in agent.stream_events(question, history", text: "그래프가 실행되면서 발생하는 이벤트를 하나씩 처리합니다. kind는 'update' 또는 'token'입니다." },
        { at: "if kind == \"update\":", text: "노드 완료 이벤트: render_step()으로 status 박스에 라우팅·검색 결과를 표시합니다." },
        { at: "elif kind == \"token\":", text: "답변 토큰 이벤트: 이 토큰을 yield하면 st.write_stream이 화면에 실시간으로 나타냅니다." },
        { at: "body = st.write_stream(token_stream())", text: "제너레이터가 yield하는 토큰을 실시간 누적 렌더링하고 최종 전체 문자열을 반환합니다." }
      ],
      code: `def handle_user_input(agent: TwoStageAgenticRAG, question: str) -> None:
    """사용자 질문을 처리해 라우팅·검색 단계를 가시화하고 답변을 스트리밍함."""
    st.session_state.messages.append({"role": "user", "content": question})
    with st.chat_message("user"):
        st.markdown(question)

    history = st.session_state.messages[:-1]

    with st.chat_message("assistant"):
        # st.status: 진행 단계를 접을 수 있는 상태 박스로 표시함
        status = st.status("🧭 검색 전략을 판단하는 중...", expanded=True)

        def token_stream():
            """그래프를 스트리밍 실행하며 단계는 status에 그리고, 답변 토큰만 yield함."""
            for kind, node, payload in agent.stream_events(question, history, st.session_state.thread_id):
                if kind == "update":
                    render_step(status, node, payload)
                    if node == "rewrite":
                        yield "\\n\\n---\\n\\n*🔄 답변을 개선하기 위해 다시 검색합니다...*\\n\\n"
                elif kind == "token":
                    yield payload

        # st.write_stream: 제너레이터가 yield하는 토큰을 실시간으로 누적 렌더링
        body = st.write_stream(token_stream())

        final_state = agent.get_final_state(st.session_state.thread_id)
        sources_md = final_state.get("sources_md") or ""
        if sources_md:
            st.markdown(sources_md)

        render_process_log(final_state)
        full_answer = final_state.get("answer") or body
        status.update(label="✅ 처리 완료", state="complete", expanded=False)

    st.session_state.messages.append({"role": "assistant", "content": full_answer})
    st.session_state.turn_count += 1`
    }
  ],
  glossary: {
    "KaLM-Embedding-Gemma3-12B-2511": "Tencent가 공개한 Gemma 3 12B 백본 기반 임베딩 모델. Matryoshka(MRL) 방식으로 훈련되어 앞 1024차원만 잘라도 의미가 보존됩니다.",
    "MRL": "(Matryoshka Representation Learning) 중첩 구조 임베딩 훈련 방법. 3840차원 전체뿐 아니라 앞 1024·512·256차원 부분 벡터도 의미가 보존되도록 학습합니다.",
    "SentenceTransformer": "문장·단락을 고정 길이 벡터로 변환하는 sentence-transformers 라이브러리의 핵심 클래스. Transformer 모델과 풀링·정규화를 캡슐화합니다.",
    "BitsAndBytesConfig": "HuggingFace transformers의 4-bit/8-bit 양자화 설정 클래스. nf4 타입으로 가중치를 4-bit로 줄여 메모리를 ~8배 절약합니다.",
    "MRL 절단": "Matryoshka 임베딩의 앞 N차원만 잘라 사용하는 기법. truncate_dim=1024로 지정하면 3840→1024차원으로 줄어 벡터DB 크기와 검색 속도가 개선됩니다.",
    "지연 로딩": "(Lazy Loading) 무거운 자원을 클래스 생성 시점이 아니라 실제 사용 시점에 처음 1회 적재하는 패턴. 앱 시작 시간을 줄이고 불필요한 메모리 사용을 방지합니다.",
    "instruct 임베더": "질의(query)와 문서(document)에 서로 다른 프롬프트를 붙여 비대칭 인코딩하는 임베딩 모델. 질의는 지시문 프롬프트를, 문서는 빈 프롬프트를 사용합니다.",
    "L2 정규화": "벡터의 크기를 1로 만드는 정규화. 코사인 유사도 계산 시 벡터 크기의 영향을 제거해 의미적 유사도만 비교할 수 있습니다.",
    "DOCUMENT_PROMPT": "문서 임베딩 시 사용하는 프롬프트(빈 문자열). 인덱싱과 검색이 동일한 프롬프트를 써야 벡터 공간이 일치합니다.",
    "QUERY_PROMPT": "질의 임베딩 시 사용하는 지시문 프롬프트. 'Instruct: Given a query, retrieve documents that answer the query\\nQuery:' 형태입니다.",
    "비대칭 인코딩": "질의와 문서를 서로 다른 방식으로 임베딩하는 기법. 검색 의도(질의)와 정보 내용(문서)이 다른 특성을 가지므로 비대칭 인코딩이 더 좋은 검색 결과를 줍니다.",
    "PyPDFLoader": "LangChain의 PDF 로더. PDF를 페이지 단위 Document(page_content + metadata)로 변환합니다.",
    "RecursiveCharacterTextSplitter": "LangChain의 텍스트 분할기. separators 목록을 앞에서부터 적용해 chunk_size 이하가 될 때까지 재귀적으로 분할합니다.",
    "chunk_size": "텍스트 분할기의 최대 청크 크기(문자 수). 이 크기보다 긴 텍스트는 separators를 기준으로 잘립니다.",
    "chunk_overlap": "연속 청크 사이에 겹치는 문자 수. 한 조문이 두 청크에 걸쳐 분리될 때 문맥이 이어지도록 합니다.",
    "LAW_SEPARATORS": "법령 구조를 우선하는 분할 구분자 목록. 조문(\\n제) → 항(\\n①) → 단락(\\n\\n) → 줄(\\n) 순으로 우선 적용합니다.",
    "정규식 re.sub": "정규식(패턴)으로 텍스트를 검색·교체하는 파이썬 내장 함수. re.sub(패턴, 교체문자, 대상텍스트) 형태로 씁니다.",
    "Chroma.from_documents": "청크 리스트를 임베딩해 ChromaDB에 저장하는 헬퍼 메서드. embedding 함수로 각 청크를 벡터화하고 컬렉션에 저장합니다.",
    "멱등성": "같은 작업을 여러 번 수행해도 결과가 같은 성질. 인덱싱을 재실행할 때 기존 DB를 삭제하고 새로 만들어 중복 적재를 방지합니다.",
    "영속 디렉터리": "프로그램이 종료된 후에도 데이터가 남는 디렉터리. ChromaDB는 이 경로에 벡터를 파일로 저장해 재시작 후에도 재인덱싱 없이 사용합니다.",
    "CrossEncoder": "(Cross-encoder) (질의, 문서) 쌍을 한 번에 입력받아 관련도를 직접 채점하는 모델. Bi-encoder보다 정확하지만 느려서 소수 후보에만 적용합니다.",
    "Bi-encoder vs Cross-encoder": "Bi-encoder: 질의·문서를 각각 독립 벡터화해 코사인 유사도 비교(빠름·덜 정확). Cross-encoder: 쌍을 함께 보고 관련도 직접 계산(느림·정확). 2-stage는 두 방식을 결합합니다.",
    "dragonkue/bge-reranker-v2-m3-ko": "XLM-RoBERTa 기반 BGE cross-encoder를 한국어 검색에 특화하여 파인튜닝한 모델. 한국어 특허법 문서 재정렬에 사용됩니다.",
    "similarity_search": "ChromaDB 메서드. 질의를 벡터화해 코사인 유사도 상위 k개 문서를 반환합니다.",
    "predict": "CrossEncoder 메서드. (질의, 문서) 쌍 목록을 받아 각 쌍의 관련도 logit 점수를 반환합니다.",
    "sigmoid": "logit 점수를 0~1 확률로 변환하는 수학 함수. 1/(1+e^(-x)) 형태입니다. 재정렬 점수를 사람이 이해하기 쉬운 형태로 표시하는 데 씁니다.",
    "rerank_score": "cross-encoder logit을 sigmoid로 변환한 0~1 관련도 점수. Streamlit UI에서 막대 그래프(████░░ 형태)로 표시됩니다.",
    "MemorySaver": "LangGraph의 메모리 기반 체크포인터. thread_id별로 그래프 상태를 메모리에 저장해 멀티턴 대화 시 이전 턴 상태를 유지합니다.",
    "thread_id": "멀티턴 대화를 식별하는 고유 문자열. 탭마다 uuid4().hex로 다른 ID를 생성해 사용자/탭 간 대화가 섞이지 않게 합니다.",
    "checkpointer": "LangGraph 그래프 실행 상태를 저장·복구하는 컴포넌트. MemorySaver를 쓰면 thread_id별로 대화 상태를 메모리에 유지합니다.",
    "generate_direct 노드": "법률 DB가 불필요한 질문에 대한 답변 생성 노드. 웹 검색 결과와 LLM 지식을 합쳐 답변합니다. generate 노드와 달리 IsSup 평가가 없습니다.",
    "gen_llm": "답변 생성 전용 Groq LLM. temperature=0.3(약간의 창의성)과 reasoning_format='hidden'(추론 과정 숨김)으로 설정됩니다.",
    "reasoning_format": "Groq gpt-oss 계열 모델의 옵션. 'hidden'으로 설정하면 LLM 내부 추론 과정이 답변에 섞이지 않고 최종 답변 텍스트만 반환됩니다.",
    "stream_mode": "LangGraph stream() 메서드의 모드. 'updates'=노드 완료 이벤트, 'messages'=LLM 토큰 이벤트. 두 모드를 리스트로 동시 구독할 수 있습니다.",
    "yield": "파이썬 제너레이터 키워드. 함수 실행을 일시 중단하고 값을 반환합니다. 호출자가 next()로 다시 실행을 재개합니다. 스트리밍 답변에 적합합니다.",
    "제너레이터": "yield를 포함한 파이썬 함수. 호출 시 즉시 실행되지 않고 이터레이터를 반환합니다. for 루프나 next()로 값을 하나씩 꺼낼 수 있습니다.",
    "st.cache_resource": "Streamlit 데코레이터. 함수 반환값을 앱 재실행 사이에도 유지합니다. 무거운 ML 모델을 매 입력마다 재적재하지 않도록 합니다.",
    "워밍업": "앱 시작 시 더미 질의를 실행해 무거운 모델을 미리 GPU에 올려두는 기법. 첫 실제 질의 시 화면이 멈추는 현상을 방지합니다.",
    "segfault 방지": "segmentation fault(메모리 접근 오류). ChromaDB보다 CrossEncoder를 먼저 로드해 CUDA 컨텍스트를 선점하면 segfault가 발생하지 않습니다.",
    "st.status": "Streamlit 컴포넌트. 접을 수 있는 상태 박스를 표시합니다. 진행 중인 단계를 실시간으로 업데이트하고, 완료 후 '✅ 처리 완료'로 상태를 바꿀 수 있습니다.",
    "st.write_stream": "Streamlit 메서드. 제너레이터가 yield하는 텍스트를 실시간으로 누적 렌더링합니다. ChatGPT처럼 토큰이 흘러나오는 효과를 줍니다.",
    "st.chat_message": "Streamlit 컴포넌트. 'user' 또는 'assistant' 역할로 채팅 말풍선 UI를 만듭니다.",
    "WebBaseLoader": "LangChain의 웹 페이지 로더. URL을 받아 BeautifulSoup으로 HTML을 파싱하고 본문 텍스트를 추출합니다.",
    "youtube-transcript-api": "YouTube 자막을 가져오는 파이썬 라이브러리. video_id와 언어를 지정하면 [{text, start, duration}] 형태의 자막 데이터를 반환합니다.",
    "CheckRetrieval": "check_retrieval 노드의 결과를 담는 Pydantic 스키마. needs_retrieval·sources·세 가지 최적화 쿼리·reasoning을 포함합니다.",
    "UsefulnessGrade": "evaluate 노드의 결과를 담는 Pydantic 스키마. is_useful(bool)과 reasoning(판단 이유)을 포함합니다.",
    "2-Stage Retrieval": "두 단계 검색. 1단계(Bi-encoder): 코사인 유사도로 top-20 빠른 회수. 2단계(Cross-encoder): 쌍을 함께 보고 관련도를 직접 채점해 top-5로 정밀 재정렬. 빠름+정확의 조합입니다.",
    "StrOutputParser": "LangChain 파서. LLM이 반환하는 AIMessage 객체에서 본문 텍스트(content)만 문자열로 추출합니다. 체인 끝에 `| StrOutputParser()`로 붙입니다.",
    "IsUse": "(Is Useful) 생성된 답변이 사용자 질문에 실제로 유용한지 평가하는 단계. 유용하지 않으면 질문을 재작성해 다시 검색합니다. MAX_RETRIES까지만 재시도합니다."
  }
};
