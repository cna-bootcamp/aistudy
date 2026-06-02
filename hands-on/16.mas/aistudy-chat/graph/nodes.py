"""LangGraph Node 함수들 (SAS 패턴의 Agent/Supervisor 실행 단위)

각 노드는 공유 State(AgentState)를 받아 처리하고, 업데이트할 필드만 dict로 반환함.
에이전트 인스턴스는 전역 싱글톤으로 재사용하여 초기화 비용(LanceDB 연결 등)을 줄임.
"""
from __future__ import annotations

import ast  # 코드 구문 유효성 평가 (Supervisor의 code 채점)
from typing import Literal

from langchain_core.messages import AIMessage, HumanMessage  # role을 객체로 표현하는 메시지 타입

from agents.code_agent import CodeAgent
from agents.rag_agent import RAGAgent
from agents.router import Router
from agents.web_agent import WebAgent
from agents.youtube_agent import YouTubeAgent
from config.settings import RETRY_STRATEGIES, SOURCE_WEIGHTS, SUPERVISOR_CONFIG
from graph.state import AgentState, get_current_query
from llm.ollama_llm import OllamaLLM
from utils.file_saver import save_code_to_file
from utils.helpers import calculate_relevance_score, format_sources, rewrite_query
from utils.logger import get_logger

logger = get_logger("graph.nodes")


# ---------------------------------------------------------------------------
# 전역 에이전트 싱글톤 (Lazy Initialization)
# ---------------------------------------------------------------------------
_router: Router | None = None
_rag_agent: RAGAgent | None = None
_web_agent: WebAgent | None = None
_youtube_agent: YouTubeAgent | None = None
_code_agent: CodeAgent | None = None
_llm: OllamaLLM | None = None


def get_router() -> Router:
    """Router 싱글톤 반환."""
    global _router
    if _router is None:
        _router = Router()
    return _router


def get_rag_agent() -> RAGAgent:
    """RAG Agent 싱글톤 반환 (LanceDB 연결 재사용)."""
    global _rag_agent
    if _rag_agent is None:
        _rag_agent = RAGAgent()
    return _rag_agent


def get_web_agent() -> WebAgent:
    """Web Agent 싱글톤 반환."""
    global _web_agent
    if _web_agent is None:
        _web_agent = WebAgent()
    return _web_agent


def get_youtube_agent() -> YouTubeAgent:
    """YouTube Agent 싱글톤 반환."""
    global _youtube_agent
    if _youtube_agent is None:
        _youtube_agent = YouTubeAgent()
    return _youtube_agent


def get_code_agent() -> CodeAgent:
    """Code Agent 싱글톤 반환."""
    global _code_agent
    if _code_agent is None:
        _code_agent = CodeAgent()
    return _code_agent


def get_llm() -> OllamaLLM:
    """LLM 싱글톤 반환."""
    global _llm
    if _llm is None:
        _llm = OllamaLLM()
    return _llm


# ---------------------------------------------------------------------------
# 노드 함수
# ---------------------------------------------------------------------------

def router_node(state: AgentState) -> dict:
    """질문을 code/qa로 분류함 (Scheduler 진입)."""
    question = state.get("question", "")
    logger.info("[Router] 질문 분류 시작")
    question_type = get_router().classify_question(question)
    logger.info(f"[Router] 분류 결과: {question_type}")
    return {
        "question_type": question_type,
        "messages": [HumanMessage(content=question)],
    }


def rag_node(state: AgentState) -> dict:
    """RAG 검색 노드 — code는 예제코드, qa는 교재+KG 엔티티를 검색함."""
    query = get_current_query(state)
    question_type = state.get("question_type", "qa")
    rag = get_rag_agent()

    if question_type == "code":
        # 코드 작성: 예제코드 청크 검색
        results = rag.search_code(query)
    else:
        # Q&A: 교재 텍스트 유닛(Vector) + KG 엔티티(Knowledge Graph)를 함께 검색
        results = rag.search_textbook(query) + rag.search_entities(query)

    logger.info(f"[RAG] 검색 완료: {len(results)}건 (type={question_type})")
    return {"rag_results": results}


def web_node(state: AgentState) -> dict:
    """웹 검색 노드 (Q&A 경로) — 실패 시 빈 결과로 흐름 유지."""
    query = get_current_query(state)
    results = get_web_agent().search(query)
    return {"web_results": results}


def youtube_node(state: AgentState) -> dict:
    """YouTube 검색 노드 (Q&A 경로) — 실패 시 빈 결과로 흐름 유지."""
    query = get_current_query(state)
    results = get_youtube_agent().search(query)
    return {"youtube_results": results}


def code_generation_node(state: AgentState) -> dict:
    """RAG 결과를 참고해 코드를 생성·검증하고 유효하면 파일로 저장함."""
    question = state.get("question", "")
    rag_results = state.get("rag_results", [])
    logger.info(f"[Code] 코드 생성 시작 (참조 {len(rag_results)}건)")

    context = get_rag_agent().format_context(rag_results)
    code, is_valid = get_code_agent().generate_with_retry(question, context)
    logger.info(f"[Code] 생성 완료: valid={is_valid}, length={len(code)}")

    filename = ""
    if is_valid and code:
        success, path = save_code_to_file(code, request=question)
        if success:
            filename = path
    return {"generated_code": code, "code_filename": filename}


def qa_response_node(state: AgentState) -> dict:
    """RAG + Web + YouTube를 종합하여 Q&A 답변을 생성하고 출처를 첨부함."""
    question = state.get("question", "")
    rag_results = state.get("rag_results", [])
    web_results = state.get("web_results", [])
    youtube_results = state.get("youtube_results", [])
    weights = state.get("source_weights", SOURCE_WEIGHTS["default"])
    logger.info(
        f"[QA] 응답 생성: RAG={len(rag_results)}, Web={len(web_results)}, YouTube={len(youtube_results)}"
    )

    rag = get_rag_agent()
    rag_context = rag.format_context(rag_results) if rag_results else "교재 검색 결과 없음."
    web_context = get_web_agent().format_results(web_results)
    youtube_context = get_youtube_agent().format_results(youtube_results)

    prompt = f"""다음 검색 결과를 종합하여 질문에 한국어로 답변함.

## 질문
{question}

## 교재/KG 자료 (가중치 {weights.get('rag', 0.7)})
{rag_context}

## 웹 검색 결과 (가중치 {weights.get('web', 0.1)})
{web_context}

## YouTube 영상 (가중치 {weights.get('youtube', 0.2)})
{youtube_context}

## 답변 작성 규칙
1. 검색 결과를 종합하여 명확하고 구체적으로 답변
2. 가중치가 높은 소스(교재)를 우선 참조
3. 본문에 핵심 출처를 자연스럽게 언급
4. 관련 영상이 있으면 추천
5. 설명에 도움이 되면 ```python 코드 블록으로 예시 제공

## 답변:"""

    answer = get_llm().generate(prompt=prompt, temperature=0.7)
    sources = format_sources(rag_results, web_results, youtube_results)
    full_answer = f"{answer}\n\n---\n**참고 출처:**\n{sources}"

    logger.info(f"[QA] 응답 생성 완료 (길이 {len(full_answer)})")
    return {"answer": full_answer, "messages": [AIMessage(content=full_answer)]}


def supervisor_node(state: AgentState) -> dict:
    """결과 품질을 평가(0.0~1.0)하고 통과/재시도 전략을 결정함 (Hybrid Supervisor)."""
    question_type = state.get("question_type", "qa")
    retry_count = state.get("retry_count", 0)
    logger.info(f"[Supervisor] 평가 시작 (type={question_type}, retry={retry_count})")

    score = _evaluate_code(state) if question_type == "code" else _evaluate_qa(state)
    passed = score >= SUPERVISOR_CONFIG["pass_threshold"]

    strategy = ""
    if not passed and retry_count < SUPERVISOR_CONFIG["max_retries"]:
        strategies = RETRY_STRATEGIES.get(question_type, {})
        if score >= SUPERVISOR_CONFIG["retry_threshold"]:
            strategy = strategies.get("score >= 0.5", "query_rewrite")
        else:
            strategy = strategies.get("score < 0.5", "query_rewrite")

    logger.info(f"[Supervisor] score={score:.2f}, passed={passed}, strategy={strategy or 'none'}")
    return {"evaluation_score": score, "evaluation_passed": passed, "retry_strategy": strategy}


def _evaluate_code(state: AgentState) -> float:
    """코드 결과를 4개 항목(각 0.25)으로 채점함 — 구문/키워드/RAG참조/구조."""
    code = state.get("generated_code", "")
    question = state.get("question", "")
    rag_results = state.get("rag_results", [])
    score = 0.0

    # 1) 구문 유효성 (ast.parse 통과)
    if code.strip():
        try:
            ast.parse(code)
            score += 0.25
        except SyntaxError:
            pass
    # 2) 질문 키워드가 코드에 1개 이상 반영
    if any(kw in code.lower() for kw in question.lower().split()):
        score += 0.25
    # 3) RAG 참조가 있었음
    if rag_results and code:
        score += 0.25
    # 4) import + 함수/클래스 구조 존재
    if "import" in code and ("def " in code or "class " in code):
        score += 0.25
    return score


def _evaluate_qa(state: AgentState) -> float:
    """Q&A 답변을 4개 항목(각 0.25)으로 채점함 — 길이/소스/출처표기/관련성."""
    answer = state.get("answer", "")
    question = state.get("question", "")
    rag_results = state.get("rag_results", [])
    web_results = state.get("web_results", [])
    youtube_results = state.get("youtube_results", [])
    score = 0.0

    # 1) 충분한 답변 길이
    if len(answer) >= 100:
        score += 0.25
    # 2) 검색 소스가 하나라도 존재
    if rag_results or web_results or youtube_results:
        score += 0.25
    # 3) 출처 표기 포함
    if "출처" in answer or "참고" in answer or "URL" in answer:
        score += 0.25
    # 4) 질문-답변 관련성 (키워드 겹침 휴리스틱)
    if calculate_relevance_score(question, answer) >= 0.5:
        score += 0.25
    return score


def retry_node(state: AgentState) -> dict:
    """재시도 준비 노드 — 전략에 따라 쿼리 재작성 또는 소스 가중치 조정 후 retry_count 증가."""
    strategy = state.get("retry_strategy", "")
    question = state.get("question", "")
    question_type = state.get("question_type", "qa")
    retry_count = state.get("retry_count", 0)
    logger.info(f"[Retry] 재시도 준비 (strategy={strategy}, count={retry_count + 1})")

    updates: dict = {"retry_count": retry_count + 1}
    if strategy == "query_rewrite":
        updates["rewritten_query"] = rewrite_query(question)
        logger.info(f"[Retry] 쿼리 재작성: {updates['rewritten_query']}")
    elif strategy == "reweight_sources" and question_type == "qa":
        updates["source_weights"] = SOURCE_WEIGHTS["reweight"].copy()
        logger.info("[Retry] 소스 가중치 재조정(웹/유튜브 비중↑)")
    return updates


def fallback_node(state: AgentState) -> dict:
    """재시도 한도 초과 시 LLM 단독으로 최선의 답변/코드를 생성하는 폴백 (Graceful Degradation)."""
    question = state.get("question", "")
    question_type = state.get("question_type", "qa")
    logger.warning(f"[Fallback] 폴백 응답 생성 (type={question_type})")

    if question_type == "code":
        code = get_code_agent().generate_code(f"다음 요청에 대한 Python 코드를 작성함: {question}", temperature=0.5)
        filename = ""
        if code:
            success, path = save_code_to_file(code, request=question)
            filename = path if success else ""
        answer = f"```python\n{code}\n```"
        if filename:
            answer += f"\n\n저장 위치: `{filename}`"
        return {"generated_code": code, "code_filename": filename, "answer": answer, "messages": [AIMessage(content=answer)]}

    answer = get_llm().generate(prompt=f"다음 질문에 한국어로 답변함: {question}", temperature=0.7)
    answer += "\n\n> (참고: 검색 품질이 낮아 LLM 기본 지식으로 답변함)"
    return {"answer": answer, "messages": [AIMessage(content=answer)]}


def final_response_node(state: AgentState) -> dict:
    """코드 유형 통과 시 최종 답변을 포맷함 (코드 + 저장 위치)."""
    code = state.get("generated_code", "")
    filename = state.get("code_filename", "")
    if filename:
        answer = f"코드를 생성하여 저장함.\n\n**저장 위치:** `{filename}`\n\n```python\n{code}\n```"
    else:
        answer = f"```python\n{code}\n```"
    return {"answer": answer, "messages": [AIMessage(content=answer)]}


# ---------------------------------------------------------------------------
# 조건부 분기 함수 (Scheduler의 라우팅 판단)
# ---------------------------------------------------------------------------

def should_continue(state: AgentState) -> Literal["end", "retry", "fallback"]:
    """Supervisor 평가 후 완료/재시도/폴백을 결정함."""
    if state.get("evaluation_passed", False):
        return "end"
    # 최대 재시도 초과 → 폴백 (Loop Guard)
    if state.get("retry_count", 0) >= SUPERVISOR_CONFIG["max_retries"]:
        return "fallback"
    # 재시도 전략이 있으면 재시도
    if state.get("retry_strategy", ""):
        return "retry"
    return "end"


def route_by_type(state: AgentState) -> Literal["code", "qa"]:
    """질문 유형에 따른 경로 반환."""
    return state.get("question_type", "qa")
