"""MAS B 서브프로세스 워커 — 오케스트레이터가 '외부 프로세스'로 호출하는 진입점.

분산 MAS에서 MAS B(선행기술·동향 리서치)는 자체 venv·자체 의존성을 가진 독립 단위임.
오케스트레이터가 직접 import 하면 mas-b/mas-c 의 동일한 패키지명(config·graph·sources)이
한 프로세스에서 충돌하므로, 각 단위를 '그 단위의 venv 파이썬'으로 실행하는 서브프로세스로 격리함.

[입출력 계약 — stdio JSON RPC]
  입력(stdin) : {"question": str, "history": [{"role","content"}]}  (EOF까지 1개 JSON)
  출력(stdout): {"ok": bool, "answer": str, "context_items": [...], ...}  (정확히 1줄 JSON)

[stdout 오염 방지] PatentTrendRAG 는 진행 로그를 stdout 으로 print 함. JSON 채널이 깨지지 않도록
그래프 실행 동안 sys.stdout 을 stderr 로 돌리고, 최종 JSON만 '원래 stdout'에 1회 기록함.

실행: <mas-b/venv 파이썬> mas_b_worker.py   (오케스트레이터가 자동 기동, 직접 실행 불필요)
"""

from __future__ import annotations  # 타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함

import json
import sys
import traceback
from pathlib import Path

# 이 파일이 위치한 디렉터리 기준으로 단위 MAS 경로를 도출함 (이식성 확보)
# 이 파일: patent-mas/orchestrator/workers/mas_b_worker.py
#   parents[0]=workers, parents[1]=orchestrator, parents[2]=patent-mas
_WORKER_DIR = Path(__file__).resolve().parent          # 이 파일이 위치한 디렉터리 절대경로
MAS_B_DIR = _WORKER_DIR.parents[1] / "mas-b"           # 단위 MAS B 프로젝트 루트

# Windows 기본 인코딩(cp949)에서 한글이 깨지지 않도록 표준입출력 3종을 모두 UTF-8로 재설정함.
# stdin 까지 반드시 포함해야 함 — 부모(오케스트레이터)가 UTF-8로 보낸 질문을 자식이 cp949로
# 읽으면 글자가 surrogate 로 깨져 Groq 요청 인코딩 단계에서 UnicodeEncodeError 가 발생함.
for _stream in (sys.stdin, sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# 파이썬이 모듈을 검색하는 경로 목록 맨 앞에 mas-b 를 추가함 → `from graph.workflow import ...` 가 B를 가리킴
sys.path.insert(0, str(MAS_B_DIR))


def _run(request: dict) -> dict:
    """요청 1건을 받아 MAS B Self-RAG 그래프를 실행하고 결과를 JSON-직렬화 가능한 dict로 반환함.

    PatentTrendRAG.invoke()가 돌려준 relevant_items 는 {source,title,content,citation} 형태라
    그대로 오케스트레이터→MAS C 의 provided_context 로 넘길 수 있음(fan-in 컨텍스트 재사용).
    """
    # build_llm / PatentTrendRAG 는 mas-b 의 그래프 구현체 (이 import 는 sys.path 조정 후에 수행해야 함)
    from graph.workflow import PatentTrendRAG, build_llm

    question = request.get("question", "")
    history = request.get("history", []) or []

    agent = PatentTrendRAG(build_llm())
    result = agent.invoke(question, history)

    # relevant_items: IsRel 평가를 통과한 항목만 — MAS C 가 근거로 쓰기 적합함
    context_items = result.get("relevant_items") or []
    law_raw = result.get("law_raw") or {}
    return {
        "ok": True,
        "answer": result.get("answer", ""),
        "context_items": context_items,
        # 오케스트레이터 Supervisor 의 출력 검증·요약 표시에 쓰는 메타데이터
        "needs_retrieval": result.get("needs_retrieval"),
        "sources": result.get("sources", []),
        "is_supported": result.get("is_supported"),
        "is_useful": result.get("is_useful"),
        "retry_count": result.get("retry_count", 0),
        "counts": {
            "precedents": len(law_raw.get("precedents", [])),
            "interpretations": len(law_raw.get("interpretations", [])),
            "web": len(result.get("web_results", [])),
            "youtube_chunks": len(result.get("youtube_chunks", [])),
            "relevant": len(context_items),
        },
    }


def main() -> int:
    """stdin 으로 들어온 JSON 요청을 처리하고 stdout 으로 JSON 응답 1줄을 기록함."""
    # 원래 stdout 을 보관하고, 그래프 실행 동안 출력 채널을 stderr 로 돌려 JSON 오염을 막음
    real_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        raw = sys.stdin.read()  # EOF까지 전체를 읽어 1개 JSON으로 파싱함
        request = json.loads(raw) if raw and raw.strip() else {}
        response = _run(request)
    except Exception as error:  # noqa: BLE001 - 어떤 실패도 JSON 오류로 변환해 오케스트레이터가 graceful 처리하게 함
        response = {
            "ok": False,
            "answer": "",
            "context_items": [],
            "error": f"{type(error).__name__}: {error}",
            "trace": traceback.format_exc()[-1500:],
        }
    finally:
        sys.stdout = real_stdout  # 최종 JSON 기록 전에 출력 채널 복구

    # ensure_ascii=False + UTF-8 stdout: 한글을 그대로 직렬화함 (양끝 모두 UTF-8 파이프로 일치)
    real_stdout.write(json.dumps(response, ensure_ascii=False))
    real_stdout.flush()
    return 0 if response.get("ok") else 1


# 이 파일을 직접 실행할 때만 main 을 수행함 (import 시 미실행)
if __name__ == "__main__":
    sys.exit(main())
