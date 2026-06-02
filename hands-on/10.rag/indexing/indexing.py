#!/usr/bin/env python3
"""특허법 PDF 인덱싱 파이프라인 (공용 벡터 DB 구축)

PDF 로드 → 전처리 → 청킹 → 임베딩 → ChromaDB 저장의 인덱싱 단계를 수행함.
8.1 이후 RAG 실습 예제들이 공유하는 공용 벡터 DB(컬렉션 `patent_law`)를 생성함.

Embed   : OpenAI    text-embedding-3-small (1536차원)
VectorDB: ChromaDB  (로컬 영속화, ../vectordb)
Chunk   : RecursiveCharacterTextSplitter (chunk_size=800, chunk_overlap=200)

사용법:
    python indexing.py            # data 디렉터리의 PDF를 인덱싱하여 공용 벡터 DB 생성
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import re
import shutil
import sys
from pathlib import Path

# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ---------------------------------------------------------------------------
# 경로 설정 (이식성을 위해 모든 경로를 __file__ 기준으로 도출)
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent   # 이 파일이 위치한 디렉터리(indexing/)를 절대경로로 구함
RAG_DIR = SCRIPT_DIR.parent                     # hands-on/10.rag/
DATA_DIR = RAG_DIR / "data"                     # 인덱싱 대상 PDF 디렉터리
VECTORDB_DIR = RAG_DIR / "vectordb"             # ChromaDB 영속화 디렉터리 (공용 DB, indexing/ 밖 parent 레벨)
ENV_PATH = RAG_DIR.parent / ".env"              # hands-on/.env (API 키 보관)

# ---------------------------------------------------------------------------
# 환경변수 로드
# ---------------------------------------------------------------------------
from dotenv import load_dotenv

load_dotenv(ENV_PATH)  # .env 파일에서 OPENAI_API_KEY 등 환경변수를 로드함 (langchain-openai가 자동 참조)

# ---------------------------------------------------------------------------
# 상수 정의
# ---------------------------------------------------------------------------
COLLECTION_NAME = "patent_law"               # 공용 벡터 DB 컬렉션명 (다운스트림 예제가 동일 이름으로 검색)
EMBEDDING_MODEL = "text-embedding-3-small"   # OpenAI 임베딩 모델 (출력 1536차원)
CHUNK_SIZE = 800                             # 청크 최대 크기 (문자 수)
CHUNK_OVERLAP = 200                          # 청크 간 겹치는 문자 수 (맥락 보존)

# 법령 문서 구조를 우선 보존하기 위한 분할 구분자 (앞쪽 우선순위)
# "\n제"(조문) → "\n①~⑤"(항) → "\n\n"(단락) → "\n"(줄) → " "(어절) → ""(문자)
LAW_SEPARATORS = ["\n제", "\n①", "\n②", "\n③", "\n④", "\n⑤", "\n\n", "\n", " ", ""]

# 국가법령정보센터 PDF는 모든 페이지 상단에 법령명을 머리글로 반복 삽입함 (검색 노이즈)
RUNNING_HEADER = "특허법"

# 청크 본문이 개정 이력 태그·머리글만으로 이루어졌는지 판별하는 정규식
# 예: "[전문개정 2014. 6. 11.]", "[시행 ...] [법률 제21134호]" → 검색 가치가 없어 제거 대상
TAG_ONLY_PATTERN = re.compile(r"^(\[[^\]]*\]\s*)+$")


# ---------------------------------------------------------------------------
# 1. 전처리
# ---------------------------------------------------------------------------

def clean_text(text: str) -> str:
    """PDF 추출 텍스트에서 머리글·바닥글·페이지 번호 등 노이즈를 제거함.

    PyPDFLoader는 페이지 단위로 텍스트를 추출하므로 법제처 머리글, "- 1 -" 형식의
    페이지 번호 등 검색에 불필요한 반복 텍스트가 섞임. 이를 정규식으로 정리함.
    """
    # 페이지 번호 패턴 제거: "- 1 -", "1 / 50" 형식
    text = re.sub(r"-\s*\d+\s*-", "", text)
    text = re.sub(r"\d+\s*/\s*\d+", "", text)
    # 머리글·바닥글에 자주 등장하는 키워드가 포함된 줄과 반복 법령명 머리글 줄을 제거함
    lines = text.split("\n")
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
    text = "\n".join(cleaned_lines)
    # 연속 공백·과도한 빈 줄 정규화
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ---------------------------------------------------------------------------
# 2. 로드
# ---------------------------------------------------------------------------

def load_pdfs(data_dir: Path) -> list:
    """data 디렉터리의 모든 PDF를 로드하여 Document 리스트로 반환함.

    PyPDFLoader: PDF를 페이지 단위 Document로 변환하는 LangChain 로더.
    각 Document.metadata에는 원본 경로(source)와 페이지 번호(page)가 담김.
    """
    from langchain_community.document_loaders import PyPDFLoader

    # sorted()로 파일 처리 순서를 고정해 재실행 시 청크 인덱스가 동일하게 유지되도록 함
    pdf_paths = sorted(data_dir.glob("*.pdf"))
    if not pdf_paths:
        raise FileNotFoundError(f"PDF 파일을 찾을 수 없음: {data_dir}")

    documents = []
    for pdf_path in pdf_paths:
        pages = PyPDFLoader(str(pdf_path)).load()
        documents.extend(pages)
        print(f"  - {pdf_path.name}: {len(pages)}페이지 로드")

    # 스캔 PDF(이미지) 등으로 텍스트가 전혀 추출되지 않은 경우를 조기에 감지함
    total_chars = sum(len(doc.page_content) for doc in documents)
    if total_chars == 0:
        raise ValueError("PDF에서 텍스트를 추출하지 못함 (스캔 이미지 PDF 가능성)")
    return documents


def preprocess_documents(documents: list) -> list:
    """각 Document의 본문에 clean_text()를 적용하고 빈 페이지를 제거함."""
    cleaned = []
    for doc in documents:
        doc.page_content = clean_text(doc.page_content)
        # 전처리 후 내용이 비어버린 페이지는 청킹·임베딩 대상에서 제외함
        if doc.page_content:
            cleaned.append(doc)
    return cleaned


# ---------------------------------------------------------------------------
# 3. 청킹
# ---------------------------------------------------------------------------

def split_documents(documents: list) -> list:
    """RecursiveCharacterTextSplitter로 문서를 청크로 분할함.

    RecursiveCharacterTextSplitter: separators 목록을 앞에서부터 순서대로 적용하며
    chunk_size 이하가 될 때까지 재귀적으로 분할하는 분할기. 법령 구조(조→항)를
    우선 경계로 삼아 의미 단위가 끊기지 않게 함.
    """
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=LAW_SEPARATORS,
    )
    return splitter.split_documents(documents)


def filter_chunks(chunks: list) -> list:
    """검색 가치가 없는 노이즈 청크를 제거함.

    법령은 조문보다 큰 청크 앞에서 머리글·개정 태그가 단독 청크로 떨어지는 경우가 있음.
    이렇게 "[전문개정 ...]" 같은 태그만 담긴 청크는 질의와 무관하게 상위에 노출되어 검색
    품질을 떨어뜨리므로 임베딩 대상에서 제외함. (clean_text가 제거하지 못한 잔여 노이즈 정리)
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
    return kept


def attach_metadata(chunks: list) -> list:
    """각 청크에 스펙에 정의된 4개 메타데이터만 부여함.

    부여 항목: source(파일명), chunk_index(전체 청크 중 순번), total_chunks(전체 청크 수),
    char_count(청크 문자 수). ChromaDB 메타데이터는 원시형(str/int)만 허용되므로 모두 충족함.
    """
    total = len(chunks)
    for index, chunk in enumerate(chunks):
        # PyPDFLoader가 넣은 source는 전체 경로이므로 파일명만 추출함
        source_name = Path(chunk.metadata.get("source", "")).name
        # 기존 메타데이터(page 등)를 버리고 스펙의 4개 키만 남김
        chunk.metadata = {
            "source": source_name,
            "chunk_index": index,
            "total_chunks": total,
            "char_count": len(chunk.page_content),
        }
    return chunks


# ---------------------------------------------------------------------------
# 4. 임베딩 + 저장
# ---------------------------------------------------------------------------

def build_vectordb(chunks: list):
    """청크를 임베딩하여 ChromaDB에 영속 저장하고 vectorstore를 반환함.

    재실행 멱등성: 공용 DB에 동일 문서가 중복 적재되면 검색 품질이 떨어지므로,
    기존 영속 디렉터리를 삭제 후 새로 생성함.
    Chroma.from_documents: 문서 리스트를 임베딩하여 컬렉션에 저장하는 LangChain 헬퍼.
    """
    from langchain_chroma import Chroma
    from langchain_openai import OpenAIEmbeddings

    # 기존 벡터 DB가 있으면 통째로 삭제하여 중복 적재를 방지함
    if VECTORDB_DIR.exists():
        shutil.rmtree(VECTORDB_DIR)
        print(f"  - 기존 벡터 DB 삭제: {VECTORDB_DIR}")

    # OpenAIEmbeddings: 텍스트를 1536차원 벡터로 변환 (OPENAI_API_KEY 환경변수 자동 사용)
    embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL)

    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        collection_name=COLLECTION_NAME,
        persist_directory=str(VECTORDB_DIR),
    )
    return vectorstore


# ---------------------------------------------------------------------------
# 5. 검증
# ---------------------------------------------------------------------------

def verify_vectordb(vectorstore) -> None:
    """저장된 벡터 수·임베딩 차원을 출력하고 테스트 쿼리로 검색 동작을 확인함."""
    # ._collection.count(): 컬렉션에 실제 저장된 벡터 개수를 반환함
    count = vectorstore._collection.count()
    print(f"  - 저장된 벡터 수: {count}")

    # 임베딩 함수로 쿼리 한 건을 벡터화하여 차원이 1536인지 확인함
    test_query = "특허를 받을 수 있는 조건은?"
    query_vector = vectorstore._embedding_function.embed_query(test_query)
    print(f"  - 임베딩 차원: {len(query_vector)}")

    # 영속 DB에 대해 유사도 검색이 동작하는지 상위 5건으로 확인함 (Naive RAG 통상 검색 수)
    results = vectorstore.similarity_search(test_query, k=5)
    print(f"  - 테스트 쿼리: '{test_query}' → {len(results)}건 검색")
    for rank, doc in enumerate(results, start=1):
        snippet = doc.page_content[:60].replace("\n", " ")
        print(f"    [{rank}] {doc.metadata['source']} #{doc.metadata['chunk_index']}: {snippet}...")


# ---------------------------------------------------------------------------
# 메인 파이프라인
# ---------------------------------------------------------------------------

def main() -> None:
    """PDF 로드 → 전처리 → 청킹 → 임베딩 → 저장 → 검증 순으로 인덱싱을 수행함."""
    print("[1/5] PDF 로드")
    documents = load_pdfs(DATA_DIR)

    print("[2/5] 전처리 (노이즈 제거)")
    documents = preprocess_documents(documents)
    print(f"  - 전처리 후 페이지 수: {len(documents)}")

    print("[3/5] 청킹")
    chunks = split_documents(documents)
    # 머리글·개정 태그만 담긴 노이즈 청크를 제거한 뒤 메타데이터를 부여함 (인덱스 연속성 유지)
    chunks = filter_chunks(chunks)
    chunks = attach_metadata(chunks)
    print(f"  - 생성된 청크 수: {len(chunks)}")

    print("[4/5] 임베딩 + ChromaDB 저장")
    vectorstore = build_vectordb(chunks)
    print(f"  - 저장 위치: {VECTORDB_DIR}")

    print("[5/5] 검증")
    verify_vectordb(vectorstore)

    print("\n인덱싱 완료. 공용 벡터 DB가 준비됨.")


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # 실행 중 오류를 명확히 출력하고 비정상 종료 코드로 빠져나감
        print(f"\n[오류] 인덱싱 실패: {error}", file=sys.stderr)
        sys.exit(1)
