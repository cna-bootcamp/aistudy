# 특허법 인덱싱 (공용 벡터 DB 구축)

특허법 PDF 문서를 임베딩하여 `hands-on/10.rag/vectordb`에 ChromaDB 기반 공용 벡터 DB를 구축하는 예제임.  
RAG 파이프라인의 **Indexing 단계**(Load → 전처리 → Split → Embed → Store)만 담당하며,  
8.1 이후 RAG 실습 예제들이 이 벡터 DB를 공유하여 검색에 활용함.

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| 입력 | `hands-on/10.rag/data/*.pdf` (특허법 PDF) |
| 임베딩 모델 | OpenAI `text-embedding-3-small` (1536차원) |
| 벡터 DB | ChromaDB (로컬 영속화) |
| 영속 경로 | `hands-on/10.rag/vectordb` |
| 컬렉션명 | `patent_law` |
| 청킹 | `RecursiveCharacterTextSplitter` (chunk_size=800, chunk_overlap=200) |

> **공용 DB 주의사항**: 다운스트림 예제는 동일한 **컬렉션명(`patent_law`)** 과  
> 동일한 **임베딩 모델(`text-embedding-3-small`)** 로 이 DB를 읽어야 검색이 정상 동작함.

---

## 2. 처리 흐름

```
PDF 로드 → 전처리 → 청킹 → 노이즈 필터링 → 메타데이터 부여 → 임베딩 → ChromaDB 저장 → 검증
```

> 콘솔은 5단계(`[1/5]`~`[5/5]`)로 진행 상황을 출력함. 아래 표는 각 콘솔 단계에 대응하는 함수임  
> (필터링·메타데이터 부여는 `[3/5] 청킹` 단계 안에서 함께 수행됨).

| 콘솔 단계 | 함수 | 설명 |
|------|------|------|
| `[1/5]` 로드 | `load_pdfs()` | `data/`의 모든 PDF를 `PyPDFLoader`로 페이지 단위 로드. 텍스트 추출 실패 시 오류 발생 |
| `[2/5]` 전처리 | `preprocess_documents()` / `clean_text()` | 페이지 번호("- 1 -"), 법제처 머리글, 반복 법령명 머리글("특허법") 등 노이즈 제거 후 공백 정규화 |
| `[3/5]` 청킹 | `split_documents()` | 법령 구조(조→항)를 우선 경계로 삼는 `separators`로 800자 청크 분할 |
| `[3/5]` 청킹 | `filter_chunks()` | 개정 태그("[전문개정 ...]")만 담긴 빈약한 청크를 제거하여 검색 품질 향상 |
| `[3/5]` 청킹 | `attach_metadata()` | 스펙 4개 필드만 부여 (아래 표 참조) |
| `[4/5]` 임베딩·저장 | `build_vectordb()` | 기존 DB 삭제 후 OpenAI 임베딩으로 벡터화하여 ChromaDB에 영속 저장 |
| `[5/5]` 검증 | `verify_vectordb()` | 벡터 수·임베딩 차원 출력 및 테스트 쿼리 검색 동작 확인 |

### 저장 메타데이터

| 키 | 타입 | 설명 |
|------|------|------|
| `source` | str | 원본 PDF 파일명 (경로 제외) |
| `chunk_index` | int | 전체 청크 중 순번 (0부터 시작) |
| `total_chunks` | int | 생성된 전체 청크 수 |
| `char_count` | int | 해당 청크의 문자 수 |

---

## 3. 주요 함수

- **`clean_text(text)`**: PDF 추출 텍스트에서 페이지 번호·바닥글·반복 법령명 머리글 노이즈를 정규식으로 제거함.
- **`load_pdfs(data_dir)`**: `data/`의 PDF를 정렬된 순서로 로드하며, 텍스트가 0자면 스캔 PDF로 보고 오류 발생.
- **`split_documents(documents)`**: `RecursiveCharacterTextSplitter`로 법령 구조를 보존하며 청크 분할.
- **`filter_chunks(chunks)`**: 개정 태그만 담긴 노이즈 청크를 제거하여 검색 시 무의미한 상위 노출을 방지.
- **`attach_metadata(chunks)`**: 기존 메타데이터를 버리고 스펙에 정의된 4개 필드만 부여.
- **`build_vectordb(chunks)`**: 멱등성을 위해 기존 DB 삭제 후 임베딩·영속 저장 (중복 적재 방지).
- **`verify_vectordb(vectorstore)`**: 저장 결과를 정량 확인 (벡터 수, 1536차원, 테스트 검색).

---

## 4. 가상환경 설정 및 실행

### 가상환경 설정 (Windows / PowerShell)
```powershell
cd hands-on/10.rag/indexing
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)
```bash
cd hands-on/10.rag/indexing
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)
```bash
cd hands-on/10.rag/indexing
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 환경변수

`hands-on/.env` 파일에 OpenAI API 키가 필요함 (임베딩 호출에 사용).
```
OPENAI_API_KEY=sk-...
```

### 실행
```bash
python indexing.py
```

실행 시 `hands-on/10.rag/vectordb` 디렉터리에 ChromaDB가 생성되며,  
재실행 시 기존 DB를 삭제 후 새로 구축함 (중복 적재 방지).

---

## 5. 실행 결과 예시

```
[1/5] PDF 로드
  - 특허법.pdf: 68페이지 로드
[2/5] 전처리 (노이즈 제거)
  - 전처리 후 페이지 수: 68
[3/5] 청킹
  - 노이즈 청크 제거: 2개 → ['[전문개정 2014. 6. 11.]', '[전문개정 2014. 6. 11.]']
  - 생성된 청크 수: 246
[4/5] 임베딩 + ChromaDB 저장
  - 기존 벡터 DB 삭제: ...\hands-on\10.rag\vectordb
  - 저장 위치: ...\hands-on\10.rag\vectordb
[5/5] 검증
  - 저장된 벡터 수: 246
  - 임베딩 차원: 1536
  - 테스트 쿼리: '특허를 받을 수 있는 조건은?' → 5건 검색
    [1] 특허법.pdf #32: 제37조(특허를 받을 수 있는 권리의 이전 등) ① 특허를 받을 수 있는 권리는 이전할 수 있다. ...
    [2] 특허법.pdf #68: 제62조(특허거절결정) 심사관은 특허출원이 다음 각 호의 어느 하나의 거절이유...
    [3] 특허법.pdf #234: 제223조(특허표시 및 특허출원표시) ①특허권자, 전용실시권자 또는 통상실시권자는...
    [4] 특허법.pdf #152: 제132조의17(특허거절결정 등에 대한 심판) 특허거절결정 또는 특허권의 존속기간의...
    [5] 특허법.pdf #20: 제29조(특허요건) ① 산업상 이용할 수 있는 발명으로서 다음 각 호의 어느 하나에...

인덱싱 완료. 공용 벡터 DB가 준비됨.
```

> 위 수치(페이지·청크 수)는 입력 PDF에 따라 달라짐. 위 출력은 `text-embedding-3-small` 모델 기준 실측 결과임.  
> 한국어 의미 검색의 정밀한 순위 향상(Hybrid Search·Re-ranking 등)은 8.1 이후 검색 실습 예제에서 다룸.

---

## 6. 벡터 DB 디렉터리 구조

인덱싱 완료 후 `hands-on/10.rag/vectordb`에는 ChromaDB가 데이터를 **두 곳**에 나누어 영속화함.

```
hands-on/10.rag/vectordb/
├── chroma.sqlite3                          # 관계형 메타 저장소 (컬렉션·원문·메타데이터·임베딩)
└── {세그먼트-UUID}/                          # 벡터 인덱스 세그먼트 (HNSW)
    ├── data_level0.bin                      # 벡터 데이터 + 레벨0 그래프 노드/이웃
    ├── header.bin                           # 인덱스 헤더 (차원·파라미터)
    ├── length.bin                           # 각 요소 길이 정보
    └── link_lists.bin                       # 상위 레벨 그래프 링크 (데이터 적을 시 0바이트)
```

### 저장 위치별 내용

| 저장소 | 담는 내용 |
|--------|-----------|
| **`chroma.sqlite3`** | 컬렉션 정의(`name=patent_law`), 청크 **원문 텍스트**, 메타데이터 4종(`source`/`chunk_index`/`total_chunks`/`char_count`), 임베딩 레코드 |
| **`{세그먼트-UUID}/`** | 컬렉션의 **HNSW 벡터 인덱스** — 1536차원 벡터를 빠르게 근사 최근접 검색(ANN)하기 위한 그래프 자료구조 |

> 검색 시 둘이 함께 동작함: **UUID 폴더의 인덱스**로 유사 벡터 후보를 찾고,  
> **`chroma.sqlite3`**에서 해당 청크의 원문·메타데이터를 꺼내 반환함.

> **참고**: UUID 폴더의 HNSW는 검색 가속용 **색인 그래프**이며,  
> GraphRAG의 지식 그래프(Knowledge Graph, 엔티티 관계망)와는 무관함. 이 예제는 순수 Dense Retrieval임.

### 주의사항

| 항목 | 설명 |
|------|------|
| **UUID는 재빌드마다 변경됨** | `build_vectordb()`가 기존 DB 삭제 후 재생성하므로 세그먼트 UUID가 매번 달라짐. 다운스트림 예제는 **UUID를 하드코딩하지 말고** `persist_directory`(`vectordb`) + `collection_name`(`patent_law`)으로만 접근해야 함 |
| **폴더명 ≠ 컬렉션 UUID** | 디스크 폴더명은 "벡터 세그먼트 ID"로, `collections` 테이블의 컬렉션 ID와 별개임 (한 컬렉션이 메타·벡터 세그먼트로 분리되는 ChromaDB의 정상 동작) |
| **파일 크기는 가변** | `.bin`·`chroma.sqlite3` 크기는 문서량·청크 수에 따라 달라짐 |
