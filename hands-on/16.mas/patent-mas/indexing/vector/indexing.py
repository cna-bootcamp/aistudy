#!/usr/bin/env python3
"""특허법 조문 벡터 RAG 인덱싱 파이프라인 (patent-mas / 법령지식 MAS용)

PDF 로드 → 노이즈 제거 → 청킹 → 장/조/항 메타데이터 부여 → OpenAI 임베딩 →
ChromaDB 적재 → 검증의 인덱싱 단계를 수행함. 분산 MAS의 '법령지식 MAS(MAS A)'가
이 인덱스를 컬렉션명 `patent_law`로 검색해 조문 원문을 정밀 인용함.

[10.rag/indexing 예제 대비 핵심 변경 사항]
  Before: 메타데이터 = source / chunk_index / total_chunks / char_count (4종)
  After : 위 4종 + 장(chapter)/조(article)/항(clause) 인용 메타데이터를 추가 부여
          → 검색 결과가 "특허법 제29조(특허요건)"처럼 출처를 추적 가능해짐

Embed   : OpenAI    text-embedding-3-small (1536차원)
VectorDB: ChromaDB  (로컬 영속화, store/)
Chunk   : RecursiveCharacterTextSplitter (chunk_size=800, chunk_overlap=160)
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import re
import shutil
import sys
from pathlib import Path

# Windows 콘솔 기본 인코딩(cp949)에서 한글 출력이 깨지지 않도록 표준출력을 UTF-8로 재설정함
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 이 파일의 디렉터리를 추가함
# → 어느 위치에서 실행하든 `from config import settings`가 동작하도록 보장함
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import settings as cfg  # 전역 설정(경로·모델·청킹·노이즈) 모듈

# ---------------------------------------------------------------------------
# 환경변수 로드
# ---------------------------------------------------------------------------
from dotenv import load_dotenv  # .env 파일의 환경변수를 로드하는 함수

load_dotenv(cfg.ENV_PATH)  # hands-on/.env에서 OPENAI_API_KEY를 로드함 (langchain-openai가 자동 참조)

# ---------------------------------------------------------------------------
# 조문 구조 파싱용 정규식 (장/조/항 메타데이터 추출)
# ---------------------------------------------------------------------------
# re.MULTILINE: ^가 문자열 시작뿐 아니라 각 줄의 시작과도 매칭되게 함.
# 장·조 제목은 항상 줄 맨 앞에 오므로 ^로 앵커링하면 본문 중간의 교차 인용("...제29조에 따라")을 걸러냄.

# 장(章) 머리글: "제1장 총칙", "제6장의2 특허취소신청 <신설 ...>"
#   group(1)=장 번호, group(2)=의N 가지번호(선택), group(3)=장 제목('<' 또는 줄끝 전까지)
CHAPTER_RE = re.compile(r"^\s*제\s*(\d+)\s*장(의\s*\d+)?\s+([^\n<]+)", re.MULTILINE)

# 조(條) 머리글: "제1조(목적)", "제7조의2(행위능력 등의 흠에 대한 추인)"
#   group(1)=조 번호, group(2)=의N 가지번호(선택), group(3)=조 제목(괄호 안)
#   괄호가 있는 형태만 매칭 → "제132조의2에 따른" 같은 본문 교차 인용은 제외됨
ARTICLE_RE = re.compile(r"^\s*제\s*(\d+)\s*조(의\s*\d+)?\s*\(([^)]*)\)", re.MULTILINE)

# 항(項) 마커 — 원문자(①~⑮). 조문 본문에서 각 항의 시작을 표시함
CLAUSE_MARKS = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮"

# 청크 본문이 개정 이력 태그·머리글만으로 이루어졌는지 판별하는 정규식
# 예: "[전문개정 2014. 6. 11.]" → 검색 가치가 없어 제거 대상
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
    # 머리글·바닥글 키워드가 포함된 줄과 반복 법령명 머리글 줄을 제거함
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        # "법제처 ... 국가법령정보센터" 형식의 페이지 머리글/바닥글 줄 제거
        if any(kw in line for kw in cfg.NOISE_KEYWORDS):
            continue
        # 줄 전체가 법령명("특허법")뿐인 반복 머리글 줄 제거 (본문 내 인용은 다른 글자와 함께 등장하므로 안전)
        if line.strip() == cfg.RUNNING_HEADER:
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

def load_pdf(pdf_path: Path) -> list:
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
    return pages


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
    chunk_size 이하가 될 때까지 재귀적으로 분할하는 분할기. 법령 구조(장→조→항)를
    우선 경계로 삼아 의미 단위가 끊기지 않게 함.
    """
    from langchain_text_splitters import RecursiveCharacterTextSplitter  # 재귀 분할기

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=cfg.CHUNK_SIZE,
        chunk_overlap=cfg.CHUNK_OVERLAP,
        separators=cfg.LAW_SEPARATORS,
    )
    return splitter.split_documents(documents)


def filter_chunks(chunks: list) -> list:
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
    return kept


# ---------------------------------------------------------------------------
# 4. 장/조/항 메타데이터 부여 (인용 추적용)
# ---------------------------------------------------------------------------

def _chapter_label(match: re.Match) -> str:
    """장 정규식 매치에서 "제1장"/"제6장의2" 형식의 라벨을 만듦."""
    number = match.group(1)
    # group(2)는 "의 2"처럼 공백을 포함할 수 있어 공백을 제거함 ("의2")
    branch = (match.group(2) or "").replace(" ", "")
    return f"제{number}장{branch}"


def _article_label(match: re.Match) -> str:
    """조 정규식 매치에서 "제29조"/"제7조의2" 형식의 라벨을 만듦."""
    number = match.group(1)
    branch = (match.group(2) or "").replace(" ", "")
    return f"제{number}조{branch}"


def attach_law_metadata(chunks: list) -> list:
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
    return chunks


# ---------------------------------------------------------------------------
# 5. 임베딩 + 저장
# ---------------------------------------------------------------------------

def build_vectordb(chunks: list):
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
    return vectorstore


# ---------------------------------------------------------------------------
# 6. 검증
# ---------------------------------------------------------------------------

def verify_vectordb(vectorstore) -> None:
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
        snippet = doc.page_content[:45].replace("\n", " ")
        print(
            f"    · '{query}' (기대 {expected_article}) [{match_mark}]\n"
            f"        chapter={meta.get('chapter')}({meta.get('chapter_title')}) "
            f"article={meta.get('article')}({meta.get('article_title')}) "
            f"articles=[{meta.get('articles')}] clauses=[{meta.get('clauses')}]\n"
            f"        본문: {snippet}..."
        )


# ---------------------------------------------------------------------------
# 메인 파이프라인
# ---------------------------------------------------------------------------

def main() -> None:
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

    print("\n인덱싱 완료. 특허법 조문 벡터 인덱스가 준비됨.")


# 이 파일을 직접 실행할 때만 main()을 수행함 (import 시 미실행)
if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # 실행 중 오류를 명확히 출력하고 비정상 종료 코드로 빠져나감
        print(f"\n[오류] 인덱싱 실패: {error}", file=sys.stderr)
        sys.exit(1)
