"""Generate explain-exam data.js pages for hands-on/14.graphrag examples."""

from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]

LAUNCHER = """<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>예제 설명 페이지로 이동…</title>
  <script>
    (function () {
      var here = location.href.split(/[?#]/)[0];
      var i = here.lastIndexOf("/hands-on/");
      if (i === -1) {
        document.addEventListener("DOMContentLoaded", function () {
          document.body.textContent = "경로 오류: 이 파일은 hands-on/ 아래에 있어야 합니다.";
        });
        return;
      }
      var rel = here.slice(i + "/hands-on/".length);
      var dir = rel.replace(/[^\\/]*$/, "");
      var depth = (dir.match(/\\//g) || []).length;
      var shell = "../".repeat(depth) + "explain-exam/index.html";
      location.replace(shell + "?data=../" + dir + "data.js");
    })();
  </script>
</head>
<body style="font-family: system-ui, 'Malgun Gothic', sans-serif; padding: 28px; color: #333;">
  설명 페이지로 이동 중입니다…
  <noscript>
    JavaScript가 꺼져 있어 자동 이동하지 못했습니다. 브라우저에서 JavaScript를 켜고 다시 열거나,
    공용 셸 <code>hands-on/explain-exam/index.html</code> 에
    <code>?data=&lt;이 폴더의 data.js 상대경로&gt;</code> 를 붙여 여세요.
  </noscript>
</body>
</html>
"""


GLOSSARY: dict[str, str] = {
    "GraphRAG": "문서에서 개념과 관계를 뽑아 지식 그래프를 만들고, 벡터 검색과 함께 질문에 답하는 RAG 방식임.",
    "Microsoft GraphRAG": "Microsoft의 GraphRAG 구현체임. CLI가 Parquet 산출물과 LanceDB 벡터 인덱스를 생성함.",
    "LightRAG": "가벼운 파일 기반 GraphRAG 구현체임. GraphML, JSON KV Store, nano-vectordb를 함께 사용함.",
    "Neo4j": "노드와 관계를 저장하는 그래프 데이터베이스임. Cypher 질의로 연결 구조를 조회함.",
    "Knowledge Graph": "사람·개념·기술 같은 엔티티를 노드로, 관계를 선으로 표현한 지식 지도임.",
    "Vector": "텍스트 의미를 숫자 목록으로 바꾼 값임. 가까운 숫자일수록 의미가 비슷하다고 봄.",
    "Embedding": "텍스트를 벡터로 바꾸는 처리임. 검색 전 문서와 질문을 같은 숫자 공간에 놓는 과정임.",
    "LanceDB": "로컬 파일로 저장되는 벡터 데이터베이스임. 임베딩 기반 유사도 검색에 사용함.",
    "Parquet": "표 형태 데이터를 빠르게 읽고 쓰는 컬럼 기반 파일 형식임.",
    "Ollama": "로컬에서 LLM이나 임베딩 모델을 실행하는 도구임. 여기서는 qwen3-embedding을 호출함.",
    "Groq LPU": "Groq의 빠른 추론용 LLM 실행 환경임. OpenAI 호환 API 형태로 호출함.",
    "Streamlit": "파이썬 코드만으로 웹 UI를 빠르게 만드는 라이브러리임.",
    "st.session_state": "Streamlit 앱이 재실행되어도 브라우저 탭 안에서 유지되는 임시 저장소임.",
    "@st.cache_resource": "Streamlit에서 무거운 객체를 한 번만 만들고 재사용하게 하는 데코레이터임.",
    "asyncio": "파이썬에서 오래 걸리는 작업을 기다리는 동안 다른 일을 처리하게 해주는 비동기 도구임.",
    "dataclass": "데이터를 담는 클래스를 짧게 선언하게 해주는 파이썬 기능임.",
    "Path": "파일과 폴더 경로를 문자열보다 안전하게 다루는 파이썬 표준 도구임.",
    "sys.path.insert": "파이썬이 import 대상을 찾는 경로 목록 맨 앞에 폴더를 추가하는 코드임.",
    "if __name__ == \"__main__\"": "파일을 직접 실행할 때만 아래 코드를 수행하게 하는 파이썬 관용구임.",
    "argparse": "터미널 옵션을 읽어 `--force`, `--mode` 같은 실행 방식을 정하는 표준 라이브러리임.",
    "subprocess": "파이썬 코드에서 외부 명령을 실행하고 결과를 받는 표준 라이브러리임.",
    "threading": "여러 작업을 동시에 진행하게 하는 표준 라이브러리임. 여기서는 CLI 출력 읽기에 사용함.",
    "tqdm": "터미널 진행률 막대를 표시하는 라이브러리임.",
    "AST": "파이썬 코드를 문법 나무로 해석한 구조임. 함수·클래스 단위 청킹에 사용함.",
    "LanceDB Table": "LanceDB 안에서 검색 대상 행을 담는 표임. 예: code_chunks.",
    "Basic Search": "GraphRAG의 텍스트 유닛 중심 단순 검색 모드임.",
    "Local Search": "특정 엔티티 주변의 관계와 텍스트를 모아 답하는 GraphRAG 검색 모드임.",
    "Global Search": "커뮤니티 리포트를 바탕으로 전체 문서의 큰 흐름을 요약하는 검색 모드임.",
    "DRIFT Search": "전체 관점으로 시작한 뒤 지역 근거를 따라 들어가는 GraphRAG 검색 모드임.",
    "Code Search": "예제코드만 별도 벡터 인덱스에서 찾는 검색 모드임.",
    "Router": "사용자 질문을 보고 어떤 검색 모드를 쓸지 고르는 작은 판단기임.",
    "LLM fallback": "규칙으로 판단이 애매할 때 LLM에게 한 번 더 모드 선택을 맡기는 보완 방법임.",
    "Cypher": "Neo4j 그래프를 조회하는 질의 언어임. SQL이 표를 조회한다면 Cypher는 노드와 관계를 조회함.",
    "GraphCypherQAChain": "질문을 Cypher로 바꾸고 Neo4j 결과를 답변으로 정리하는 LangChain 체인임.",
    "Neo4jGraph": "LangChain에서 Neo4j 연결과 Cypher 실행을 감싸는 래퍼임.",
    "Neo4jVector": "Neo4j를 벡터 저장소처럼 사용하게 해주는 LangChain 래퍼임.",
    "LLMGraphTransformer": "문서에서 엔티티와 관계를 뽑아 그래프 문서로 바꾸는 LangChain 도구임.",
    "GraphML": "그래프의 노드와 관계를 파일로 저장하는 XML 기반 형식임.",
    "nano-vectordb": "LightRAG가 파일 기반 벡터 검색에 사용하는 작은 벡터 DB임.",
    "QueryParam": "LightRAG 검색 모드와 옵션을 담아 query에 전달하는 설정 객체임.",
    "OpenAI 호환 API": "OpenAI SDK 형식과 비슷한 요청 방식으로 다른 모델 서버를 호출하는 API임.",
    "JSON parsing": "문자열로 받은 JSON을 파이썬 데이터로 바꾸는 과정임.",
    "retry": "일시 실패를 가정하고 같은 작업을 다시 시도하는 처리임.",
    "fallback": "원래 방법이 실패했을 때 더 안정적인 다른 방법으로 바꾸는 처리임.",
}


TERM_TRIGGERS: list[tuple[str, str]] = [
    ("GraphRAG", "GraphRAG"),
    ("graphrag", "Microsoft GraphRAG"),
    ("LightRAG", "LightRAG"),
    ("Neo4j", "Neo4j"),
    ("Knowledge Graph", "Knowledge Graph"),
    ("graph", "Knowledge Graph"),
    ("vector", "Vector"),
    ("embedding", "Embedding"),
    ("lancedb", "LanceDB"),
    ("parquet", "Parquet"),
    ("ollama", "Ollama"),
    ("Groq", "Groq LPU"),
    ("streamlit", "Streamlit"),
    ("st.session_state", "st.session_state"),
    ("cache_resource", "@st.cache_resource"),
    ("async", "asyncio"),
    ("dataclass", "dataclass"),
    ("Path(", "Path"),
    ("sys.path.insert", "sys.path.insert"),
    ("__main__", 'if __name__ == "__main__"'),
    ("argparse", "argparse"),
    ("subprocess", "subprocess"),
    ("threading", "threading"),
    ("tqdm", "tqdm"),
    ("ast.", "AST"),
    ("LanceDB", "LanceDB Table"),
    ("basic", "Basic Search"),
    ("local", "Local Search"),
    ("global", "Global Search"),
    ("drift", "DRIFT Search"),
    ("code", "Code Search"),
    ("Router", "Router"),
    ("fallback", "LLM fallback"),
    ("Cypher", "Cypher"),
    ("GraphCypherQAChain", "GraphCypherQAChain"),
    ("Neo4jGraph", "Neo4jGraph"),
    ("Neo4jVector", "Neo4jVector"),
    ("LLMGraphTransformer", "LLMGraphTransformer"),
    ("GraphML", "GraphML"),
    ("NanoVector", "nano-vectordb"),
    ("QueryParam", "QueryParam"),
    ("OpenAI", "OpenAI 호환 API"),
    ("json", "JSON parsing"),
    ("retry", "retry"),
]


def js_string(value: str) -> str:
    return (
        '"'
        + value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
        + '"'
    )


def js_template(value: str) -> str:
    return "`" + value.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${") + "`"


def find_symbol(path: Path, symbol: str) -> str:
    source = path.read_text(encoding="utf-8")
    lines = source.splitlines()
    tree = ast.parse(source)

    def slice_node(node: ast.AST) -> str:
        end = getattr(node, "end_lineno", None)
        if end is None:
            raise ValueError(f"{path}: end_lineno missing for {symbol}")
        return "\n".join(lines[node.lineno - 1 : end])

    if "." in symbol:
        class_name, method_name = symbol.split(".", 1)
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name == class_name:
                for child in node.body:
                    if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)) and child.name == method_name:
                        return slice_node(child)
        raise ValueError(f"{path}: method not found: {symbol}")

    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.name == symbol:
            return slice_node(node)
    raise ValueError(f"{path}: symbol not found: {symbol}")


def display_name(symbol: str, kind: str | None = None) -> str:
    if kind == "class" or (symbol and symbol[0].isupper() and "." not in symbol):
        return symbol
    return f"{symbol}()"


def function_id(page: str, file_id: str, symbol: str) -> str:
    raw = f"{page}_{file_id}_{symbol}".lower()
    return re.sub(r"[^a-z0-9_]+", "_", raw).strip("_")


def infer_terms(code: str, extra: list[str] | None = None) -> list[str]:
    terms: list[str] = []
    haystack = code.lower()
    for needle, term in TERM_TRIGGERS:
        if needle.lower() in haystack and term not in terms:
            terms.append(term)
    if extra:
        for term in extra:
            if term not in terms:
                terms.append(term)
    return [term for term in terms if term in GLOSSARY][:6]


def unique_anchor(code: str, candidate: str) -> str | None:
    stripped = candidate.strip()
    if not stripped:
        return None
    raw_lines = code.splitlines()
    if sum(1 for line in raw_lines if stripped in line) == 1:
        return stripped
    return None


def auto_lines(code: str, summary: str) -> list[dict[str, str]]:
    raw_lines = code.splitlines()
    anchors: list[dict[str, str]] = []

    def add(candidate: str, text: str) -> None:
        anchor = unique_anchor(code, candidate)
        if anchor and all(item["at"] != anchor for item in anchors):
            anchors.append({"at": anchor, "text": text})

    first = next((line for line in raw_lines if line.strip()), "")
    add(first, f"이 줄에서 '{summary}' 작업을 시작함.")

    patterns: list[tuple[str, str]] = [
        ("st.", "Streamlit 화면에 입력창, 버튼, 메시지 같은 UI 요소를 배치함."),
        ("validate_paths", "검색이나 인덱싱에 필요한 파일이 준비되어 있는지 먼저 확인함."),
        ("load_config", "GraphRAG 설정 파일을 읽어 현재 실행에 맞게 사용함."),
        ("basic_search", "Microsoft GraphRAG의 Basic Search API를 호출함."),
        ("local_search", "엔티티 주변 근거를 모으는 Local Search API를 호출함."),
        ("global_search", "전체 커뮤니티 리포트 기반 Global Search API를 호출함."),
        ("drift_search", "DRIFT Search API를 호출해 전역 관점과 지역 근거를 함께 사용함."),
        ("LightRAG(", "LightRAG 객체를 만들고 저장소 경로와 모델 함수를 연결함."),
        ("QueryParam", "LightRAG에 어떤 검색 모드를 쓸지 옵션으로 전달함."),
        ("Neo4jGraph(", "Neo4j 접속 정보를 사용해 그래프 DB 연결 객체를 생성함."),
        ("Neo4jVector", "Neo4j 안에 벡터 인덱스를 만들거나 조회하는 래퍼를 사용함."),
        ("LLMGraphTransformer", "문서 텍스트에서 엔티티와 관계를 추출하는 변환기를 준비함."),
        ("GraphCypherQAChain", "자연어 질문을 Cypher 조회와 답변 생성으로 연결하는 체인을 만듦."),
        ("requests.post", "Ollama나 LLM 서버에 HTTP 요청을 보내 모델 결과를 받음."),
        ("lancedb.connect", "로컬 LanceDB 저장소를 열어 벡터 테이블을 읽거나 만듦."),
        ("pd.read_parquet", "GraphRAG 산출물인 Parquet 파일을 표로 읽음."),
        ("subprocess.Popen", "GraphRAG CLI를 별도 프로세스로 실행하고 출력을 받아옴."),
        ("threading.Thread", "stdout과 stderr를 동시에 읽기 위해 스레드를 띄움."),
        ("asyncio", "비동기 검색 함수를 동기 코드에서 실행할 수 있게 이벤트 루프를 다룸."),
        ("return SearchResult", "검색 결과를 답변, 모드, 출처가 담긴 공통 형태로 반환함."),
        ("return", "처리가 끝난 값을 호출한 곳으로 돌려줌."),
    ]
    for needle, text in patterns:
        for line in raw_lines:
            if needle in line:
                add(line, text)
                break
            if len(anchors) >= 3:
                break
        if len(anchors) >= 3:
            break
    return anchors[:3]


def item(file_id: str, path: str, symbol: str, summary: str, how: str, *, kind: str | None = None,
         terms: list[str] | None = None, name: str | None = None) -> dict[str, Any]:
    return {
        "fileId": file_id,
        "path": path,
        "symbol": symbol,
        "name": name or display_name(symbol, kind),
        "summary": summary,
        "how": how,
        "kind": kind,
        "terms": terms or [],
    }


PAGES: list[dict[str, Any]] = [
    {
        "key": "ms_indexing",
        "target": "hands-on/14.graphrag/ms-graphrag/indexing",
        "title": "Microsoft GraphRAG 인덱싱 — 교재 KG+Vector / 예제코드 Vector",
        "entry": "index_documents.py",
        "files": [
            {"id": "settings", "label": "config/settings.py", "role": "경로, 모델, GraphRAG 설정값을 한곳에 모으는 설정 파일"},
            {"id": "loader", "label": "document_loader.py", "role": "교재와 예제코드를 서로 다른 방식으로 청킹하는 문서 로더"},
            {"id": "main", "label": "index_documents.py", "role": "교재 GraphRAG CLI 인덱싱과 코드 벡터 인덱싱을 묶는 실행 진입점"},
            {"id": "finalize", "label": "finalize_indexing.py", "role": "DRIFT 검색에 필요한 엔티티·커뮤니티 임베딩을 보완하는 후처리"},
            {"id": "code", "label": "code_indexer.py", "role": "예제코드 청크를 Ollama 임베딩 후 LanceDB에 저장하는 코드 전용 인덱서"},
            {"id": "utils", "label": "utils/*.py", "role": "디렉터리 생성과 로그 파일 설정을 맡는 작은 공통 유틸리티"},
        ],
        "flow": [
            {"step": 1, "title": "설정 로드", "summary": "settings.py가 경로와 모델명을 확정함", "detail": "작업 폴더, 교재 위치, GraphRAG Parquet 저장소, LanceDB 저장소, Groq/Ollama 모델명을 한 객체에 모음."},
            {"step": 2, "title": "문서 수집", "summary": "GraphRAGDocumentLoader가 교재와 예제코드를 청킹함", "detail": "교재는 마크다운 헤더 기준으로 나누고, 예제코드는 AST로 함수·클래스 단위 청크를 만듦."},
            {"step": 3, "title": "교재 입력 준비", "summary": "교재 청크를 data/input/*.txt로 내보냄", "detail": "Microsoft GraphRAG CLI는 txt 입력을 읽으므로, 메타데이터 헤더와 본문을 합쳐 입력 파일로 저장함."},
            {"step": 4, "title": "GraphRAG CLI 실행", "summary": "python -m graphrag index --root indexing 실행", "detail": "교재에서 엔티티·관계·커뮤니티를 만들고 Parquet과 LanceDB 산출물을 생성함."},
            {"step": 5, "title": "후처리", "summary": "엔티티와 community_full_content 임베딩 누락을 보완함", "detail": "DRIFT Search가 안정적으로 동작하도록 누락된 임베딩을 Ollama로 다시 만들고 LanceDB 테이블을 보강함."},
            {"step": 6, "title": "코드 인덱싱", "summary": "예제코드는 KG 없이 코드 전용 벡터 인덱스에 저장함", "detail": "절차적인 코드에는 관계 그래프보다 유사도 검색이 적합하므로 별도 code_chunks 테이블로 분리함."},
        ],
        "items": [
            item("settings", "config/settings.py", "Settings", "인덱싱 전체에서 공유할 경로와 모델 설정을 보관함", "어디서 읽고 어디에 저장할지, 어떤 LLM과 임베딩 모델을 쓸지 한 객체로 고정함.", kind="class"),
            item("loader", "document_loader.py", "GraphRAGDocument.to_text", "청크 본문 앞에 출처 메타데이터를 붙여 GraphRAG 입력 텍스트로 변환함", "GraphRAG가 나중에 출처를 찾을 수 있도록 Source, File, Section 정보를 본문 위에 넣음."),
            item("loader", "document_loader.py", "GraphRAGDocumentLoader.split_text_by_sections", "마크다운 교재를 헤더와 문단 기준으로 적당한 크기의 청크로 나눔", "작은 섹션은 합치고 큰 섹션은 다시 쪼개 의미 단위가 너무 잘리지 않게 함."),
            item("loader", "document_loader.py", "GraphRAGDocumentLoader.split_python_code", "파이썬 예제코드를 AST로 읽어 함수·클래스 단위 청크로 나눔", "코드를 글자 수로만 자르면 함수가 중간에 끊기므로 문법 구조를 먼저 읽어 단위 청크를 만듦."),
            item("loader", "document_loader.py", "GraphRAGDocumentLoader.load_textbook", "교재 Markdown 파일 전체를 GraphRAGDocument 목록으로 로드함", "agentic-ai/textbook 아래 파일을 찾아 교재용 청킹 전략을 적용함."),
            item("loader", "document_loader.py", "GraphRAGDocumentLoader.load_code", "hands-on 예제코드 전체를 코드 검색용 문서 목록으로 로드함", "자기 자신인 14.graphrag와 venv 같은 노이즈 폴더는 제외함."),
            item("main", "index_documents.py", "prepare_input_documents", "교재 청크를 GraphRAG CLI가 읽는 txt 파일로 내보냄", "기존 입력 txt를 지운 뒤 새 청크를 파일로 저장해 재실행 시 중복을 막음."),
            item("main", "index_documents.py", "ProgressTracker.process_line", "GraphRAG CLI 출력 한 줄을 해석해 진행률 막대를 갱신함", "CLI가 내보내는 workflow 시작·완료·N/M 진행 메시지를 정규식으로 읽어 tqdm에 반영함."),
            item("main", "index_documents.py", "run_graphrag_index", "Microsoft GraphRAG CLI를 실행해 교재 KG와 벡터 인덱스를 생성함", "현재 파이썬 인터프리터로 `python -m graphrag index`를 실행하고 stdout/stderr를 실시간 표시함."),
            item("main", "index_documents.py", "verify_index", "필수 Parquet과 LanceDB 산출물이 만들어졌는지 빠르게 점검함", "검색 단계가 기대하는 파일이 없으면 바로 알 수 있도록 행 수와 Lance 파일 개수를 출력함."),
            item("main", "index_documents.py", "main", "전체 인덱싱 순서를 제어하는 실행 진입점", "--force, --mode, --code-only 옵션에 따라 초기화, 교재 인덱싱, 후처리, 코드 인덱싱을 순서대로 실행함."),
            item("finalize", "finalize_indexing.py", "generate_missing_entity_embeddings", "누락된 엔티티 설명 임베딩을 Ollama로 다시 생성함", "GraphRAG CLI 중간에 일부 임베딩이 빠져도 검색 품질을 보완하도록 Parquet 파일을 재작성함."),
            item("finalize", "finalize_indexing.py", "generate_community_report_embeddings", "DRIFT Search용 커뮤니티 리포트 임베딩을 생성함", "전역 커뮤니티 요약을 벡터 검색할 수 있게 full_content_embedding과 LanceDB 테이블을 준비함."),
            item("finalize", "finalize_indexing.py", "finalize_indexing", "GraphRAG CLI 이후 필요한 보정 작업을 한 번에 수행함", "엔티티 임베딩 보완과 커뮤니티 리포트 임베딩 생성을 순서대로 호출함."),
            item("code", "code_indexer.py", "get_ollama_embedding", "Ollama API로 코드 청크 하나를 임베딩함", "텍스트를 qwen3-embedding 모델에 보내 4096차원 벡터를 받아옴."),
            item("code", "code_indexer.py", "build_code_vector_index", "예제코드 청크를 임베딩해 LanceDB code_chunks 테이블로 저장함", "임베딩을 병렬로 만들고 차원이 맞는 벡터만 남긴 뒤 테이블을 새로 생성함."),
            item("code", "code_indexer.py", "index_code", "코드 전용 인덱싱을 시작하는 진입점", "문서가 미리 전달되지 않으면 로더를 직접 호출해 전체 또는 테스트 코드 청크를 준비함."),
            item("utils", "utils/helpers.py", "ensure_dir", "필요한 디렉터리가 없으면 생성함", "파일 저장 전에 부모 폴더가 없어서 실패하지 않도록 보장함."),
            item("utils", "utils/logger.py", "get_logger", "콘솔과 파일에 동시에 남기는 로거를 생성함", "같은 로거에 핸들러가 중복 추가되지 않게 확인하고 로그 파일 경로를 연결함."),
        ],
    },
    {
        "key": "ms_retrieve",
        "target": "hands-on/14.graphrag/ms-graphrag/retrieve",
        "title": "Microsoft GraphRAG 검색 — Auto Router + GraphRAG API + Code Vector",
        "entry": "app.py",
        "files": [
            {"id": "app", "label": "app.py", "role": "Streamlit 채팅 UI와 검색 실행 흐름"},
            {"id": "config", "label": "config.py", "role": "검색 설정, GraphRAG config 로딩, 산출물 경로 검증"},
            {"id": "router", "label": "router.py", "role": "Auto 모드에서 질문을 Basic/Local/Global/DRIFT/Code로 분류"},
            {"id": "retriever", "label": "retriever.py", "role": "GraphRAG API 검색, DRIFT 재시도, 코드 LanceDB 검색"},
            {"id": "llm", "label": "llm.py", "role": "GraphRAG 내장 completion factory 래퍼"},
            {"id": "condenser", "label": "question_condenser.py", "role": "후속 질문을 독립 질문으로 재작성"},
            {"id": "logging", "label": "logging_config.py", "role": "Streamlit 재실행에도 중복 없는 로그 설정"},
        ],
        "flow": [
            {"step": 1, "title": "앱 시작", "summary": "Streamlit이 설정 UI와 채팅 이력을 준비함", "detail": "사이드바에서 검색 모드, LLM 모델, Top-K, DRIFT 재시도 같은 옵션을 고름."},
            {"step": 2, "title": "산출물 확인", "summary": "validate_paths가 Parquet·LanceDB·.env 존재를 검사함", "detail": "인덱싱 결과가 없으면 검색을 시작하지 않고 어떤 파일이 빠졌는지 화면에 표시함."},
            {"step": 3, "title": "질문 재작성", "summary": "대화 이력이 있으면 후속 질문을 독립 질문으로 바꿈", "detail": "'그건 왜 그래?' 같은 질문을 앞 대화 없이도 검색 가능한 문장으로 바꾸어 임베딩 품질을 높임."},
            {"step": 4, "title": "라우팅", "summary": "Auto 모드이면 패턴과 LLM fallback으로 검색 모드 결정", "detail": "코드 질문은 Code, 전체 요약은 Global, 관계·종합 질문은 DRIFT처럼 목적에 맞는 검색 방식을 고름."},
            {"step": 5, "title": "검색 실행", "summary": "GraphRAG API 또는 Code LanceDB 검색 수행", "detail": "Basic/Local/Global/DRIFT는 GraphRAG 산출물을 사용하고, Code는 별도 code_chunks 테이블을 사용함."},
            {"step": 6, "title": "결과 표시", "summary": "답변, 사용 모드, 라우팅 이유, 출처를 화면에 표시함", "detail": "교육생이 답만 보는 것이 아니라 어떤 검색 모드와 어떤 근거로 답했는지 함께 확인 가능함."},
        ],
        "items": [
            item("config", "config.py", "RetrieveSettings", "검색 시간에 바꿀 수 있는 모델·모드·Top-K 기본값을 정의함", "환경변수로 값을 바꿀 수 있고, 없으면 교육 예제의 기본값을 사용함.", kind="class"),
            item("config", "config.py", "load_query_config", "GraphRAG settings.yaml을 읽고 검색용 LLM 모델명을 교체함", "인덱싱 설정은 유지하되, 답변 생성 모델만 현재 UI 옵션에 맞게 바꿈."),
            item("config", "config.py", "validate_paths", "검색에 필요한 인덱싱 산출물 경로가 존재하는지 검사함", "Parquet, GraphRAG LanceDB, 코드 LanceDB, hands-on/.env가 빠졌는지 목록으로 반환함."),
            item("app", "app.py", "render_sidebar", "검색 모드와 세부 옵션을 사이드바 UI로 렌더링함", "사용자가 Auto/Basic/Local/Global/DRIFT/Code와 모델·Top-K·재시도 수를 조절하게 함."),
            item("app", "app.py", "run_query", "질문 재작성, 라우팅, 검색기 선택을 묶어 하나의 검색 결과를 만듦", "Code 모드이면 코드 전용 검색기를, 나머지 모드이면 GraphRAG 검색기를 사용함."),
            item("app", "app.py", "render_result", "검색 답변과 모드·출처·라우팅 근거를 화면에 보여줌", "답변 아래에 실제 선택 모드와 요청 모드, 확신도, fallback 여부를 함께 표시함."),
            item("app", "app.py", "main", "Streamlit 채팅 앱 전체 실행 흐름을 담당함", "설정 렌더링, 산출물 검사, 이전 메시지 표시, 새 질문 처리까지 화면 흐름을 조립함."),
            item("router", "router.py", "QueryRouter.route", "선택 모드가 Auto인지 수동인지 판단해 최종 검색 모드를 결정함", "수동 선택이면 그대로 쓰고, Auto이면 패턴 점수와 필요 시 LLM fallback을 거침."),
            item("router", "router.py", "QueryRouter._route_by_pattern", "키워드 규칙으로 질문을 검색 모드별로 점수화함", "예제·함수·app.py는 Code, 요약·전체는 Global처럼 초보자가 이해 가능한 규칙을 코드로 표현함."),
            item("router", "router.py", "QueryRouter._route_by_llm", "규칙 확신도가 낮을 때 LLM에게 JSON으로 모드를 고르게 함", "few-shot 예시를 보여주고 mode, confidence, reason만 받도록 제한함."),
            item("retriever", "retriever.py", "GraphRAGRetriever.search_async", "선택된 GraphRAG 검색 모드에 맞는 API를 비동기로 호출함", "Basic, Local, Global, DRIFT를 분기하고 공통 SearchResult로 변환함."),
            item("retriever", "retriever.py", "GraphRAGRetriever._drift_with_retry", "DRIFT JSON 파싱 실패를 재시도하고 끝내 실패하면 Local로 폴백함", "LLM 출력이 JSON으로 깨질 수 있는 비결정성을 서비스 실패가 아니라 안전한 모드 전환으로 처리함."),
            item("retriever", "retriever.py", "GraphRAGRetriever.frame", "필수 Parquet 파일을 필요할 때만 읽어 캐싱함", "처음 한 번만 pandas DataFrame으로 읽고 이후 검색에서는 같은 객체를 재사용함."),
            item("retriever", "retriever.py", "CodeVectorRetriever.search", "코드 질문을 임베딩하고 LanceDB에서 유사한 코드 청크를 찾음", "찾은 코드 조각을 근거로 LLM 답변을 생성해 GraphRAG 검색 결과와 같은 형태로 반환함."),
            item("retriever", "retriever.py", "CodeVectorRetriever.embed_query", "사용자 질문을 Ollama 임베딩 벡터로 변환함", "코드 청크 벡터와 같은 모델을 써야 같은 의미 공간에서 비교 가능함."),
            item("retriever", "retriever.py", "collect_sources", "GraphRAG context_data에서 화면에 보여줄 출처 목록을 뽑음", "여러 형태로 넘어오는 DataFrame·dict·list를 공통 SourceItem 목록으로 정리함."),
            item("retriever", "retriever.py", "run_async", "비동기 GraphRAG API를 동기 Streamlit 콜백에서 실행함", "새 이벤트 루프를 만들고 종료 시 남은 작업을 정리해 경고를 줄임."),
            item("llm", "llm.py", "GraphRAGCompletion.complete", "GraphRAG 내장 LLM 클라이언트로 비스트리밍 completion을 실행함", "라우터 fallback, 질문 재작성, 코드 컨텍스트 답변 생성에 같은 LLM 호출 래퍼를 사용함."),
            item("condenser", "question_condenser.py", "condense_question", "대화 이력을 보고 후속 질문을 독립 질문으로 재작성함", "실패하면 원본 질문을 그대로 반환해 검색 흐름이 끊기지 않게 함."),
            item("logging", "logging_config.py", "configure_logging", "콘솔과 파일 로그를 설정하고 중복 핸들러를 제거함", "Streamlit은 파일을 자주 재실행하므로 로그가 두 번 찍히지 않게 기존 핸들러를 정리함."),
        ],
    },
    {
        "key": "neo4j_indexing",
        "target": "hands-on/14.graphrag/neo4j/indexing",
        "title": "LangChain + Neo4j 인덱싱 — KG와 벡터를 하나의 DB에 저장",
        "entry": "index_documents.py",
        "files": [
            {"id": "settings", "label": "config/settings.py", "role": "Neo4j, Groq, Ollama, 데이터소스 경로 설정"},
            {"id": "loader", "label": "document_loader.py", "role": "교재와 예제코드를 LangChain Document로 변환"},
            {"id": "graph", "label": "graph/neo4j_connection.py", "role": "Neo4j 연결, 제약조건·인덱스 생성, 그래프 초기화"},
            {"id": "kg", "label": "kg_builder.py", "role": "LLMGraphTransformer로 교재 Knowledge Graph 생성"},
            {"id": "vector", "label": "vector_index.py", "role": "Neo4jVector로 엔티티·문서 벡터 인덱스 생성"},
            {"id": "main", "label": "index_documents.py", "role": "전체 Neo4j 인덱싱 파이프라인 진입점"},
        ],
        "flow": [
            {"step": 1, "title": "설정 구성", "summary": "Settings가 Neo4j 접속과 모델·경로를 준비함", "detail": "hands-on/.env를 로드하고 Neo4j URI, Groq 모델, Ollama 임베딩 모델, 청킹 크기를 결정함."},
            {"step": 2, "title": "문서 로드", "summary": "DocumentLoader가 교재와 예제코드를 Document로 변환함", "detail": "교재는 KG 구축 대상, 교재+코드는 문서 벡터 대상이 되어 서로 다른 저장 경로를 가짐."},
            {"step": 3, "title": "Neo4j 연결", "summary": "Neo4jConnection이 재시도 후 그래프 객체를 생성함", "detail": "컨테이너가 늦게 뜨는 상황을 고려해 지수 백오프로 3회 재시도함."},
            {"step": 4, "title": "KG 생성", "summary": "LLMGraphTransformer가 교재에서 엔티티와 관계를 추출함", "detail": "추출된 그래프 문서를 Neo4j에 추가하고, 엔티티 text 속성을 보강함."},
            {"step": 5, "title": "벡터 인덱스", "summary": "Neo4jVector가 엔티티·문서 청크 임베딩을 생성함", "detail": "entity_embedding은 KG 엔티티 검색, doc_embedding은 교재와 코드 텍스트 검색에 사용함."},
            {"step": 6, "title": "통계 확인", "summary": "노드·관계·Chunk 수를 출력해 결과를 확인함", "detail": "검색 예제가 사용할 데이터가 실제로 Neo4j 안에 들어갔는지 빠르게 점검함."},
        ],
        "items": [
            item("settings", "config/settings.py", "Settings", "Neo4j 인덱싱에 필요한 경로와 모델 설정을 정의함", "환경변수와 기본값을 합쳐 Docker Neo4j, Groq LPU, Ollama 임베딩 연결 정보를 준비함.", kind="class"),
            item("loader", "document_loader.py", "DocumentLoader.load_for_kg", "교재 Markdown을 KG 구축용 Document 목록으로 로드함", "예제코드는 절차적이라 KG 대상에서 제외하고 교재 개념 관계만 그래프로 만들게 함."),
            item("loader", "document_loader.py", "DocumentLoader.load_for_vector", "교재와 예제코드를 벡터 검색용 Document로 함께 로드함", "개념 설명과 코드 위치 검색을 모두 Neo4j doc_embedding 인덱스에서 찾을 수 있게 함."),
            item("loader", "document_loader.py", "DocumentLoader._load_markdown", "마크다운 파일을 텍스트 청크로 나누고 메타데이터를 붙임", "출처 파일명과 source_type을 보관해 검색 결과에서 원문 위치를 보여줄 수 있게 함."),
            item("loader", "document_loader.py", "DocumentLoader._load_python", "파이썬 파일을 AST 기반 함수·클래스 청크로 나눔", "코드 구조를 보존한 채 벡터 검색에 넣기 위해 문법 단위로 분할함."),
            item("graph", "graph/neo4j_connection.py", "Neo4jConnection._connect_with_retry", "Neo4jGraph 연결을 최대 3회 재시도함", "컨테이너가 아직 healthy가 아니어도 1·2·4초 기다리며 다시 연결함."),
            item("graph", "graph/neo4j_connection.py", "Neo4jConnection.create_indexes", "엔티티와 Chunk 조회에 필요한 Neo4j 제약조건과 인덱스를 생성함", "id 중복 방지와 빠른 조회를 위해 그래프 DB 안에 인덱스를 먼저 만들어 둠."),
            item("graph", "graph/neo4j_connection.py", "Neo4jConnection.clear_graph", "--force 실행 시 기존 그래프와 벡터 인덱스를 삭제함", "재인덱싱할 때 오래된 노드와 관계가 섞이지 않도록 전체를 초기화함."),
            item("graph", "graph/neo4j_connection.py", "Neo4jConnection.get_stats", "Neo4j 안의 주요 노드·관계 수를 집계함", "인덱싱 결과를 숫자로 확인하기 위해 Entity, Chunk, 관계 수를 조회함."),
            item("kg", "kg_builder.py", "KGBuilder.build_from_documents", "교재 Document 목록으로 Knowledge Graph 구축을 시작함", "동기 메인 흐름에서 비동기 내부 작업을 실행해 Neo4j에 그래프를 저장함."),
            item("kg", "kg_builder.py", "KGBuilder._build_async", "LLMGraphTransformer로 문서를 그래프 문서로 변환하고 Neo4j에 추가함", "LLM이 텍스트에서 엔티티와 관계를 뽑고 Neo4jGraph.add_graph_documents가 DB에 반영함."),
            item("kg", "kg_builder.py", "KGBuilder._set_entity_text", "엔티티 노드에 text 속성을 보강함", "Neo4jVector.from_existing_graph가 읽을 텍스트가 비어 있지 않도록 id와 description을 합쳐 저장함."),
            item("vector", "vector_index.py", "VectorIndexManager.create_entity_vector_index", "기존 Entity 노드를 대상으로 entity_embedding 벡터 인덱스를 생성함", "KG 엔티티를 의미 기반으로 찾을 수 있게 Neo4j 안에 임베딩을 추가함."),
            item("vector", "vector_index.py", "VectorIndexManager.create_doc_vector_index", "교재·코드 Document를 Chunk 노드와 doc_embedding 인덱스로 저장함", "텍스트 청크 검색을 위해 Document 목록을 Neo4jVector.from_documents로 넣음."),
            item("main", "index_documents.py", "parse_args", "터미널 옵션을 읽어 인덱싱 모드를 결정함", "--force와 --mode test/full 옵션으로 초기화와 소량 테스트 여부를 조절함."),
            item("main", "index_documents.py", "load_documents", "모드에 맞게 KG용 문서와 벡터용 문서를 로드함", "test 모드에서는 지정 파일만, full 모드에서는 전체 교재와 예제코드를 읽음."),
            item("main", "index_documents.py", "main", "Neo4j 인덱싱 전체 흐름을 순서대로 실행함", "설정 출력, 연결, 초기화, KG 구축, 벡터 인덱스 생성, 통계 출력까지 담당함."),
        ],
    },
    {
        "key": "neo4j_retrieve",
        "target": "hands-on/14.graphrag/neo4j/retrieve",
        "title": "LangChain + Neo4j 검색 — Vector / Graph QA / Hybrid / Cypher",
        "entry": "app.py",
        "files": [
            {"id": "app", "label": "app.py", "role": "Streamlit 채팅 UI와 검색 요청 처리"},
            {"id": "settings", "label": "config/settings.py", "role": "Neo4j 검색 설정, 모델, 로그 파일 경로"},
            {"id": "graph", "label": "graph/neo4j_connection.py", "role": "Neo4j 스키마, 통계, 벡터 차원 상태 조회"},
            {"id": "router", "label": "query/router.py", "role": "질문을 vector/graph/hybrid/cypher 모드로 라우팅"},
            {"id": "condenser", "label": "query/question_condenser.py", "role": "대화 이력 기반 후속 질문 재작성"},
            {"id": "engine", "label": "query/query_engine.py", "role": "Neo4j 벡터 검색, Graph QA, Hybrid, Cypher Direct 실행"},
            {"id": "ui", "label": "ui/components.py", "role": "Neo4j 상태와 검색 결과 표시 컴포넌트"},
            {"id": "logging", "label": "logging_config.py", "role": "검색 앱 로그 설정"},
        ],
        "flow": [
            {"step": 1, "title": "서비스 로드", "summary": "Settings, Neo4jConnection, QueryEngine, QueryRouter를 캐싱함", "detail": "Streamlit 재실행마다 무거운 연결을 새로 만들지 않도록 @st.cache_resource로 묶음."},
            {"step": 2, "title": "상태 확인", "summary": "사이드바에서 Neo4j 통계와 벡터 차원을 확인함", "detail": "Entity·Chunk·관계 수와 entity/doc 임베딩 차원을 보여줘 인덱싱 상태를 빠르게 점검함."},
            {"step": 3, "title": "질문 재작성", "summary": "대화 맥락이 있으면 독립 질문으로 바꿈", "detail": "검색 엔진은 단일 질문을 잘 처리하므로, 후속 질문의 생략된 주어를 보완함."},
            {"step": 4, "title": "모드 라우팅", "summary": "Auto이면 vector/graph/hybrid/cypher 중 하나를 선택함", "detail": "코드·문서 위치는 vector, 관계·구조는 graph, 둘 다 필요하면 hybrid, 직접 Cypher는 cypher로 감지함."},
            {"step": 5, "title": "Neo4j 검색", "summary": "QueryEngine이 선택 모드에 맞게 DB를 조회함", "detail": "벡터 유사도, Cypher QA, 직접 Cypher, 그래프 확장을 조합해 근거를 모음."},
            {"step": 6, "title": "결과 렌더", "summary": "답변, 출처, Cypher, 라우팅 정보를 UI에 표시함", "detail": "검색 모드가 어떤 근거를 가져왔는지 교육생이 눈으로 확인할 수 있게 접이식 영역에 정리함."},
        ],
        "items": [
            item("settings", "config/settings.py", "Settings", "Neo4j 검색 앱의 접속·모델·Top-K 설정을 정의함", "환경변수와 기본값을 합쳐 검색 시간에 필요한 설정 객체를 만듦.", kind="class"),
            item("graph", "graph/neo4j_connection.py", "Neo4jConnection._connect_with_retry", "검색 앱에서 Neo4jGraph 연결을 재시도하며 생성함", "Neo4j 컨테이너가 늦게 준비되는 상황을 고려해 일정 시간 기다리며 다시 연결함."),
            item("graph", "graph/neo4j_connection.py", "Neo4jConnection.get_stats", "Neo4j 안의 노드·관계·Chunk 수를 조회함", "사이드바 상태 표시와 인덱싱 정상 여부 확인에 사용함."),
            item("graph", "graph/neo4j_connection.py", "Neo4jConnection.validate_vector_dimensions", "Neo4j 벡터 인덱스 차원이 설정값과 맞는지 검사함", "qwen3-embedding 차원과 DB 인덱스 차원이 다르면 검색 오류가 나므로 미리 경고함."),
            item("router", "query/router.py", "QueryRouter.route", "수동 모드 또는 Auto 모드를 최종 검색 모드로 변환함", "사용자가 직접 고르면 그대로 쓰고, Auto이면 패턴 점수와 LLM fallback을 사용함."),
            item("router", "query/router.py", "QueryRouter._score_patterns", "질문 키워드로 검색 모드별 점수를 계산함", "관계·연결은 graph/hybrid, 코드·파일은 vector, MATCH 쿼리는 cypher로 점수를 줌."),
            item("router", "query/router.py", "QueryRouter._llm_fallback", "규칙 판단이 애매할 때 LLM에게 JSON 라우팅을 요청함", "mode, confidence, reason만 받게 해서 UI에 판단 근거를 표시할 수 있게 함."),
            item("condenser", "query/question_condenser.py", "condense_question", "대화 이력을 바탕으로 후속 질문을 독립 질문으로 재작성함", "재작성 실패 시 원문을 사용해 검색 흐름이 중단되지 않게 함."),
            item("engine", "query/query_engine.py", "QueryEngine.search", "라우터 결과에 따라 실제 검색 메서드를 분기함", "vector, graph, hybrid, cypher_direct 모드를 하나의 진입점에서 호출함."),
            item("engine", "query/query_engine.py", "QueryEngine.vector_search", "질문 임베딩으로 Entity와 Chunk 벡터 인덱스를 조회함", "의미가 비슷한 엔티티와 문서 청크를 찾고 LLM 답변 컨텍스트로 정리함."),
            item("engine", "query/query_engine.py", "QueryEngine.graph_qa", "GraphCypherQAChain으로 그래프 구조 기반 답변을 생성함", "질문을 Cypher로 바꾸고 Neo4j 결과를 자연어 답변으로 변환함."),
            item("engine", "query/query_engine.py", "QueryEngine.hybrid_search", "벡터 검색 결과 주변 그래프까지 확장해 답변 근거를 보강함", "의미 검색으로 시작해 관계 이웃을 따라가므로 문서 근거와 그래프 근거를 함께 사용함."),
            item("engine", "query/query_engine.py", "QueryEngine.cypher_direct", "사용자가 입력한 읽기 전용 Cypher를 직접 실행함", "MATCH/RETURN 같은 조회 쿼리만 허용해 그래프를 안전하게 탐색함."),
            item("engine", "query/query_engine.py", "QueryEngine._build_graph_chain", "Neo4j 스키마와 LLM을 묶어 GraphCypherQAChain을 생성함", "Cypher 생성과 답변 생성을 한 체인으로 실행할 준비를 함."),
            item("engine", "query/query_engine.py", "QueryEngine._embed_query", "Ollama API로 질문을 임베딩 벡터로 변환함", "Neo4j 벡터 인덱스와 같은 모델 차원의 벡터를 만들어 검색에 사용함."),
            item("engine", "query/query_engine.py", "QueryEngine._try_graph_aggregate_fallback", "Graph QA 실패 시 자주 쓰는 집계 질문을 직접 Cypher로 처리함", "LLM이 잘못된 Cypher를 만들 때도 주요 통계 질문은 안전하게 답할 수 있게 함."),
            item("engine", "query/query_engine.py", "QueryEngine._generate_answer", "수집한 컨텍스트를 바탕으로 한국어 답변을 생성함", "벡터/하이브리드 검색에서 모은 근거를 LLM에 전달해 최종 답변을 만듦."),
            item("engine", "query/query_engine.py", "QueryEngine._validate_readonly_cypher", "직접 실행할 Cypher가 읽기 전용인지 검사함", "CREATE, DELETE, SET 같은 변경 명령을 막아 교육용 조회만 허용함."),
            item("engine", "query/query_engine.py", "QueryEngine._collect_sources", "검색 결과에서 화면에 표시할 출처 목록을 정리함", "문서 청크, 엔티티, 관계 정보를 UI가 다루기 쉬운 dict 목록으로 변환함."),
            item("ui", "ui/components.py", "display_neo4j_status", "Neo4j 연결 상태와 벡터 차원 검증 결과를 표시함", "상태가 정상이면 성공 메시지, 문제가 있으면 경고를 보여줌."),
            item("ui", "ui/components.py", "display_result", "답변, 출처, Cypher, 라우팅 정보를 Streamlit에 렌더링함", "모드별 결과를 같은 화면 구조로 보여줘 비교하기 쉽게 함."),
            item("app", "app.py", "load_services", "검색 앱이 사용할 핵심 서비스를 캐싱해 생성함", "Settings, Neo4jConnection, QueryEngine, QueryRouter를 한 번 만들고 재사용함."),
            item("app", "app.py", "process_query", "사용자 질문을 재작성하고 라우팅한 뒤 QueryEngine에 전달함", "대화 이력과 선택 모드를 함께 고려해 실제 검색 결과를 받아옴."),
            item("app", "app.py", "main", "Neo4j 검색 Streamlit 앱의 전체 화면 흐름을 조립함", "사이드바, 상태 버튼, 채팅 메시지, 오류 처리를 하나로 연결함."),
            item("logging", "logging_config.py", "configure_logging", "검색 로그를 콘솔과 파일에 남기도록 설정함", "Streamlit 재실행 시 같은 파일 핸들러가 중복되지 않도록 제거 후 다시 등록함."),
        ],
    },
    {
        "key": "lightrag_indexing",
        "target": "hands-on/14.graphrag/lightrag/indexing",
        "title": "LightRAG 인덱싱 — 교재 KG+Vector / 코드 전용 Vector",
        "entry": "index_documents.py",
        "files": [
            {"id": "settings", "label": "config/settings.py", "role": "LightRAG 저장소, 모델, 청킹 설정"},
            {"id": "loader", "label": "document_loader.py", "role": "교재와 예제코드 파일을 Document로 로드"},
            {"id": "llm", "label": "llm_func.py", "role": "LightRAG에 주입할 Groq LLM 함수와 Ollama 임베딩 함수"},
            {"id": "kg", "label": "kg_builder.py", "role": "LightRAG ainsert로 교재 KG와 벡터 저장소 구축"},
            {"id": "code", "label": "code_vector_index.py", "role": "예제코드를 nano-vectordb 코드 인덱스로 저장"},
            {"id": "main", "label": "index_documents.py", "role": "LightRAG 인덱싱 파이프라인 진입점"},
        ],
        "flow": [
            {"step": 1, "title": "환경 점검", "summary": "Groq API 키와 Ollama 임베딩 서버를 확인함", "detail": "외부 실행 없이 코드 읽기 기준으로 보면, 실제 인덱싱 시 필요한 두 모델 연결을 초기에 확인하도록 설계됨."},
            {"step": 2, "title": "문서 로드", "summary": "교재는 KG용, 예제코드는 코드 벡터용으로 분리 로드함", "detail": "교재 개념은 LightRAG에 넣고, 절차적 예제코드는 별도 벡터 인덱스로 저장함."},
            {"step": 3, "title": "LightRAG 생성", "summary": "KGBuilder가 working_dir과 LLM/임베딩 함수를 연결함", "detail": "store/kg 아래 GraphML, KV Store, nano-vectordb 파일을 LightRAG가 관리함."},
            {"step": 4, "title": "교재 삽입", "summary": "ainsert로 교재 텍스트를 KG+Vector로 인덱싱함", "detail": "LightRAG가 텍스트에서 엔티티·관계를 뽑고 청크·엔티티·관계 벡터를 함께 생성함."},
            {"step": 5, "title": "코드 벡터", "summary": "CodeVectorIndexer가 코드 청크를 embed 후 vdb_code.json에 저장함", "detail": "코드는 KG로 만들지 않고 함수·클래스 단위 청크를 직접 벡터화해 검색용으로 보관함."},
            {"step": 6, "title": "완료 안내", "summary": "저장소 경로와 검증 명령을 출력함", "detail": "검색 예제는 이 산출물인 store/kg와 store/vector/code/vdb_code.json을 읽음."},
        ],
        "items": [
            item("settings", "config/settings.py", "Settings", "LightRAG 인덱싱 경로와 모델 설정을 정의함", "working_dir, 코드 벡터 저장 위치, Groq/Ollama 모델명, 청크 크기를 한 객체에 모음.", kind="class"),
            item("settings", "config/settings.py", "Settings.code_vdb_file", "코드 벡터 DB 파일 경로를 계산함", "검색 단계와 같은 위치를 쓰도록 store/vector/code/vdb_code.json 경로를 반환함."),
            item("loader", "document_loader.py", "DocumentLoader.load_for_kg", "교재 Markdown 파일을 LightRAG 삽입용 문자열 목록으로 로드함", "LightRAG ainsert는 문자열을 받으므로 파일명 메타데이터와 본문을 합쳐 준비함."),
            item("loader", "document_loader.py", "DocumentLoader.load_for_vector", "예제코드 파일을 코드 벡터 인덱싱용 문자열 목록으로 로드함", "코드 검색은 LightRAG KG가 아니라 별도 벡터 인덱스에서 처리함."),
            item("loader", "document_loader.py", "DocumentLoader.load_specific_files", "테스트 모드에서 교재 1개와 코드 2개만 로드함", "전체 인덱싱 전에 빠르게 동작을 확인할 수 있도록 작은 입력 세트를 제공함."),
            item("loader", "document_loader.py", "DocumentLoader._read_files", "파일 목록을 읽어 메타데이터 헤더가 붙은 텍스트로 변환함", "출처와 파일명을 본문 앞에 붙여 검색 결과에서 원본을 추적 가능하게 함."),
            item("llm", "llm_func.py", "create_llm_func", "LightRAG가 호출할 Groq LPU LLM 함수를 생성함", "LightRAG 내부 프롬프트를 OpenAI 호환 Chat Completions 요청으로 전달함."),
            item("llm", "llm_func.py", "create_embed_callable", "Ollama qwen3-embedding을 호출하는 비동기 임베딩 함수를 만듦", "LightRAG와 코드 인덱서가 같은 임베딩 함수를 공유하게 함."),
            item("llm", "llm_func.py", "create_embedding_func", "LightRAG가 요구하는 EmbeddingFunc 래퍼를 생성함", "임베딩 차원과 최대 토큰 크기를 LightRAG에 명시함."),
            item("llm", "llm_func.py", "check_groq_key", "GROQ_API_KEY가 설정되어 있는지 검사함", "LLM 호출이 필요한 인덱싱을 시작하기 전에 명확한 오류를 내기 위한 방어 코드임."),
            item("llm", "llm_func.py", "check_ollama", "Ollama 서버와 임베딩 모델 사용 가능 여부를 확인함", "임베딩 모델이 없으면 어떤 모델을 pull해야 하는지 알려주는 역할임."),
            item("kg", "kg_builder.py", "KGBuilder.build_from_documents", "교재 문자열 목록을 LightRAG KG로 인덱싱하는 진입점", "동기 파이프라인에서 내부 비동기 ainsert 작업을 실행함."),
            item("kg", "kg_builder.py", "KGBuilder._build_async", "LightRAG 저장소를 초기화하고 문서를 ainsert로 삽입함", "스토리지와 pipeline status를 초기화한 뒤 문서를 하나씩 KG+Vector로 저장함."),
            item("kg", "kg_builder.py", "KGBuilder._create_rag", "LightRAG 객체를 생성하고 모델 함수와 청킹 설정을 연결함", "working_dir, llm_model_func, embedding_func, chunk_token_size를 한 번에 지정함."),
            item("code", "code_vector_index.py", "CodeVectorIndexer.build_from_documents", "예제코드 벡터 인덱스 구축을 시작함", "문서 목록을 받아 비동기 빌더로 넘기고 결과 건수를 반환함."),
            item("code", "code_vector_index.py", "CodeVectorIndexer._build_async", "코드 청크를 만들고 임베딩 후 NanoVectorDB에 저장함", "기존 파일을 지우고 새 벡터를 upsert해 항상 최신 코드 인덱스를 유지함."),
            item("code", "code_vector_index.py", "CodeVectorIndexer._chunk_code", "코드 텍스트를 검색 가능한 청크 목록으로 나눔", "함수·클래스 경계가 길면 겹침을 두고 나누어 검색 맥락을 보존함."),
            item("code", "code_vector_index.py", "CodeVectorIndexer._embed_in_batches", "코드 청크를 배치 단위로 임베딩함", "한 번에 너무 많은 요청을 보내지 않도록 batch_size만큼 나누어 처리함."),
            item("main", "index_documents.py", "parse_args", "인덱싱 모드와 force 옵션을 읽음", "full/test와 기존 저장소 초기화 여부를 터미널 옵션으로 결정함."),
            item("main", "index_documents.py", "reset_stores", "--force 실행 시 LightRAG와 코드 벡터 저장소를 삭제함", "재인덱싱할 때 오래된 GraphML, KV, 벡터 파일이 섞이지 않게 함."),
            item("main", "index_documents.py", "smoke_test_embedding", "인덱싱 전 임베딩 모델이 정상 응답하는지 짧게 확인함", "긴 인덱싱을 시작하기 전에 모델 연결 오류를 빨리 발견함."),
            item("main", "index_documents.py", "main", "LightRAG 인덱싱 전체 파이프라인을 실행함", "점검, 로드, 교재 KG 구축, 코드 벡터 구축, 결과 안내를 순서대로 수행함."),
        ],
    },
    {
        "key": "lightrag_retrieve",
        "target": "hands-on/14.graphrag/lightrag/retrieve",
        "title": "LightRAG 검색 — naive/local/global/hybrid/mix + Code",
        "entry": "app.py",
        "files": [
            {"id": "app", "label": "app.py", "role": "Streamlit 검색 UI"},
            {"id": "settings", "label": "config/settings.py", "role": "LightRAG 검색 경로, 모델, 로그 설정"},
            {"id": "models", "label": "models.py", "role": "라우팅·출처·검색 결과 데이터 구조"},
            {"id": "router", "label": "query_router.py", "role": "질문을 LightRAG 검색 모드나 Code 모드로 라우팅"},
            {"id": "service", "label": "search_service.py", "role": "문서 검색과 코드 검색을 하나의 서비스로 묶음"},
            {"id": "rag", "label": "lightrag_retriever.py", "role": "LightRAG working_dir 기반 교재 검색"},
            {"id": "code", "label": "code_vector_search.py", "role": "코드 전용 벡터 검색과 답변 생성"},
            {"id": "embed", "label": "embeddings.py", "role": "Ollama 임베딩 함수"},
            {"id": "llm", "label": "llm_client.py", "role": "Groq LPU LLM 호출과 JSON 응답 보조"},
            {"id": "utils", "label": "async_utils.py / logging_config.py", "role": "비동기 실행과 로그 설정"},
        ],
        "flow": [
            {"step": 1, "title": "앱 초기화", "summary": "Settings와 SearchService를 캐싱함", "detail": "LightRAG 객체, 코드 검색기, 라우터, LLM 클라이언트를 한 번 만들고 재사용함."},
            {"step": 2, "title": "모드 선택", "summary": "Auto 또는 naive/local/global/hybrid/mix/code 중 선택함", "detail": "Auto는 질문 내용에 따라 교재 검색 모드와 코드 검색 모드를 나눔."},
            {"step": 3, "title": "라우팅", "summary": "QueryRouter가 패턴 점수와 LLM fallback으로 모드를 결정함", "detail": "코드·함수 질문은 code, 전체 요약은 global, 관계·종합 질문은 hybrid/mix 쪽으로 보냄."},
            {"step": 4, "title": "교재 검색", "summary": "LightRAGRetriever가 QueryParam(mode=...)로 LightRAG query를 실행함", "detail": "store/kg에 있는 GraphML, KV, 벡터 저장소를 읽어 답변과 출처를 반환함."},
            {"step": 5, "title": "코드 검색", "summary": "CodeVectorSearch가 vdb_code.json에서 유사 코드 청크를 찾음", "detail": "코드 질문은 LightRAG KG를 거치지 않고 코드 전용 벡터 저장소만 조회함."},
            {"step": 6, "title": "답변 표시", "summary": "답변, 모드, 라우팅 이유, 출처를 Streamlit에 표시함", "detail": "출처 유형과 파일·섹션 메타데이터를 함께 보여줘 어떤 근거로 답했는지 확인 가능함."},
        ],
        "items": [
            item("settings", "config/settings.py", "Settings", "LightRAG 검색 앱의 경로·모델·Top-K 설정을 정의함", "인덱싱 산출물 위치와 Groq/Ollama 모델 정보를 한 객체로 관리함.", kind="class"),
            item("settings", "config/settings.py", "Settings.code_vdb_file", "코드 벡터 DB 파일 경로를 반환함", "검색기가 읽을 vdb_code.json 위치를 Settings 기준으로 계산함."),
            item("settings", "config/settings.py", "Settings.retrieve_log_file", "검색 로그 파일 경로를 반환함", "앱 시작 시각별로 로그 파일 이름을 달리해 실행 기록을 보존함."),
            item("models", "models.py", "RouterDecision", "라우터가 고른 모드와 이유를 담는 데이터 구조임", "검색 결과 화면에서 왜 그 모드가 선택됐는지 보여주는 데 사용함.", kind="class"),
            item("models", "models.py", "Source", "검색 근거 하나의 출처 정보를 담는 데이터 구조임", "파일명, 제목, 본문 일부, 메타데이터를 한 묶음으로 전달함.", kind="class"),
            item("models", "models.py", "SearchResult", "검색 성공 여부, 답변, 출처, 라우팅 정보를 담는 공통 결과 구조임", "교재 검색과 코드 검색이 같은 UI에 표시될 수 있게 결과 형태를 통일함.", kind="class"),
            item("router", "query_router.py", "QueryRouter.route", "수동 모드 또는 Auto 모드를 최종 검색 모드로 결정함", "Auto가 아니면 그대로 쓰고, Auto이면 규칙과 LLM fallback을 거쳐 결정함."),
            item("router", "query_router.py", "QueryRouter._pattern_route", "키워드 기반으로 LightRAG 검색 모드 점수를 계산함", "코드, 전체 요약, 관계, 정의 같은 표현을 찾아 적절한 모드에 점수를 더함."),
            item("router", "query_router.py", "QueryRouter._llm_route", "규칙 판단이 약할 때 LLM에게 모드 선택 JSON을 요청함", "패턴만으로 모호한 질문도 사람이 읽을 수 있는 이유와 함께 모드를 고르게 함."),
            item("service", "search_service.py", "SearchService.search", "라우팅 결과에 따라 LightRAG 검색 또는 코드 검색을 실행함", "code 모드이면 CodeVectorSearch, 나머지는 LightRAGRetriever를 호출함."),
            item("rag", "lightrag_retriever.py", "LightRAGRetriever.search", "LightRAG query를 실행해 교재 답변과 출처를 반환함", "QueryParam에 mode를 넣어 naive/local/global/hybrid/mix를 선택함."),
            item("rag", "lightrag_retriever.py", "LightRAGRetriever._get_rag", "LightRAG 인스턴스를 지연 생성하고 저장소를 초기화함", "처음 검색할 때만 무거운 객체를 만들고 이후에는 같은 객체를 재사용함."),
            item("rag", "lightrag_retriever.py", "LightRAGRetriever._validate_store", "LightRAG working_dir 필수 파일이 있는지 검사함", "인덱싱 산출물이 없으면 검색 전에 어떤 파일이 빠졌는지 명확히 알려줌."),
            item("rag", "lightrag_retriever.py", "LightRAGRetriever._extract_sources", "LightRAG 구조화 응답에서 출처 목록을 추출함", "응답 형태가 dict/list로 달라도 화면 표시용 Source 목록으로 정리함."),
            item("code", "code_vector_search.py", "CodeVectorSearch.search", "질문 임베딩으로 코드 벡터 DB에서 유사 청크를 검색함", "검색된 코드 조각을 컨텍스트로 묶어 GroqChatClient가 답변을 생성함."),
            item("code", "code_vector_search.py", "CodeVectorSearch._get_db", "코드용 NanoVectorDB를 지연 로드함", "처음 코드 검색을 할 때만 vdb_code.json을 열어 재사용함."),
            item("code", "code_vector_search.py", "CodeVectorSearch._format_context", "검색된 코드 청크를 LLM에 전달할 근거 문자열로 정리함", "출처 번호, 파일, 섹션, 본문을 모아 답변 생성 프롬프트에 넣음."),
            item("embed", "embeddings.py", "ollama_embedding", "Ollama 임베딩 API를 직접 호출함", "텍스트 목록을 qwen3-embedding 모델에 보내 numpy 배열 형태로 돌려줌."),
            item("embed", "embeddings.py", "embed_texts", "동기 코드에서 비동기 임베딩 함수를 실행함", "코드 검색처럼 동기 흐름에서 벡터가 필요할 때 run_async로 감싸 호출함."),
            item("embed", "embeddings.py", "create_embedding_func", "LightRAG가 요구하는 EmbeddingFunc을 생성함", "LightRAG 내부 검색이 같은 Ollama 임베딩 함수를 사용하도록 연결함."),
            item("llm", "llm_client.py", "create_lightrag_llm_func", "LightRAG query가 사용할 Groq LPU LLM 함수를 생성함", "LightRAG 내부 프롬프트를 OpenAI 호환 API 호출로 전달함."),
            item("llm", "llm_client.py", "GroqChatClient.complete", "일반 채팅 completion을 Groq OpenAI 호환 API로 실행함", "라우터 fallback과 코드 컨텍스트 답변에서 같은 클라이언트를 사용함."),
            item("llm", "llm_client.py", "GroqChatClient.complete_json", "LLM 응답에서 JSON 객체만 추출해 파싱함", "라우터가 모드 선택 결과를 안전하게 읽을 수 있도록 JSON 부분을 찾음."),
            item("llm", "llm_client.py", "GroqChatClient.answer_from_context", "코드 검색 컨텍스트만 사용해 한국어 답변을 생성함", "근거 번호를 인용하고 부족하면 부족하다고 말하도록 시스템 메시지를 구성함."),
            item("utils", "async_utils.py", "run_async", "비동기 함수를 동기 코드에서 실행하는 이벤트 루프 헬퍼임", "Streamlit이나 일반 함수에서 async 검색·임베딩을 호출할 수 있게 함."),
            item("utils", "logging_config.py", "configure_logging", "콘솔과 파일 로그를 중복 없이 설정함", "Streamlit 재실행 때마다 같은 로그 핸들러가 여러 번 붙지 않도록 정리함."),
            item("app", "app.py", "get_service", "Settings에 맞는 SearchService를 캐싱해 반환함", "검색 서비스 생성 비용을 줄이고 UI 재실행 간 재사용함."),
            item("app", "app.py", "render_sources", "검색 출처 목록을 접이식 영역에 표시함", "출처가 없으면 안내하고, 있으면 파일·메타데이터·본문 일부를 차례로 보여줌."),
            item("app", "app.py", "main", "LightRAG 검색 Streamlit 앱 전체 흐름을 조립함", "사이드바 옵션, 채팅 메시지, 검색 실행, 오류 표시를 담당함."),
        ],
    },
]


def render_page(page: dict[str, Any]) -> str:
    base = ROOT / page["target"]
    functions: list[dict[str, Any]] = []
    used_terms: set[str] = set()

    for raw in page["items"]:
        path = base / raw["path"]
        code = find_symbol(path, raw["symbol"])
        terms = infer_terms(code, raw.get("terms", []))
        used_terms.update(terms)
        functions.append({
            "id": function_id(page["key"], raw["fileId"], raw["symbol"]),
            "name": raw["name"],
            "fileId": raw["fileId"],
            "summary": raw["summary"],
            "how": raw["how"],
            "terms": terms,
            "lines": auto_lines(code, raw["summary"]),
            "code": code,
        })

    file_parts = []
    for f in page["files"]:
        file_parts.append(
            "    { id: %s, label: %s, role: %s }"
            % (js_string(f["id"]), js_string(f["label"]), js_string(f["role"]))
        )

    flow_parts = []
    for s in page["flow"]:
        flow_parts.append(
            "    { step: %s, title: %s, summary: %s, detail: %s }"
            % (s["step"], js_string(s["title"]), js_string(s["summary"]), js_string(s["detail"]))
        )

    function_parts = []
    for fn in functions:
        lines_js = ",\n        ".join(
            "{ at: %s, text: %s }" % (js_string(line["at"]), js_string(line["text"]))
            for line in fn["lines"]
        )
        terms_js = ", ".join(js_string(term) for term in fn["terms"])
        function_parts.append(
            """    {
      id: %s,
      name: %s,
      fileId: %s,
      summary: %s,
      how: %s,
      terms: [%s],
      lines: [
        %s
      ],
      code: %s
    }"""
            % (
                js_string(fn["id"]),
                js_string(fn["name"]),
                js_string(fn["fileId"]),
                js_string(fn["summary"]),
                js_string(fn["how"]),
                terms_js,
                lines_js,
                js_template(fn["code"]),
            )
        )

    glossary_keys = sorted(used_terms)
    glossary_parts = []
    for key in glossary_keys:
        glossary_parts.append("    %s: %s" % (js_string(key), js_string(GLOSSARY[key])))

    return """window.EXPLAIN_DATA = {
  meta: { title: %s, entry: %s },
  files: [
%s
  ],
  flow: [
%s
  ],
  functions: [
%s
  ],
  glossary: {
%s
  }
};
""" % (
        js_string(page["title"]),
        js_string(page["entry"]),
        ",\n".join(file_parts),
        ",\n".join(flow_parts),
        ",\n".join(function_parts),
        ",\n".join(glossary_parts),
    )


def main() -> None:
    for page in PAGES:
        target = ROOT / page["target"] / "explain"
        target.mkdir(parents=True, exist_ok=True)
        (target / "data.js").write_text(render_page(page), encoding="utf-8")
        (target / "index.html").write_text(LAUNCHER, encoding="utf-8")
        print(target)


if __name__ == "__main__":
    main()
