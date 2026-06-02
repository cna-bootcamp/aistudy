"""
Groq LPU 기반 텍스트 요약 예제

Groq Cloud API를 호출하여 마크다운 문서를 청크 단위로 분할·요약하고 최종 통합 요약을 생성함.
openai/gpt-oss-120b 모델을 기본으로 사용하며 result_Docling.md → summary.txt 로 저장함.

사용법:
    python summary.py
    python summary.py --input result_Docling.md --output summary.txt
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from dotenv import load_dotenv
from groq import Groq


# Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


DEFAULT_MODEL_ID = "openai/gpt-oss-120b"
DEFAULT_MAX_CHUNK_CHARS = 12000
DEFAULT_MAX_COMPLETION_TOKENS = 2048


@dataclass(frozen=True)
class GroqOptions:
    """Groq Chat Completions API 호출에 필요한 옵션 묶음."""

    model: str
    temperature: float
    top_p: float
    max_completion_tokens: int
    reasoning_effort: str
    reasoning_format: str


@dataclass(frozen=True)
class CompletionResult:
    """API 호출 1회의 요약 텍스트와 토큰 사용량 정보."""

    text: str
    elapsed_seconds: float
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


def read_text_file(path: Path) -> str:
    """한글 문서 호환을 위해 여러 인코딩으로 입력 파일을 읽음."""
    encodings = ("utf-8", "utf-8-sig", "cp949", "euc-kr")

    for encoding in encodings:
        try:
            content = path.read_text(encoding=encoding)
            print(f"   - 인코딩: {encoding}")
            return content
        except UnicodeDecodeError:
            continue

    print("   - 인코딩: utf-8(errors='ignore')")
    return path.read_text(encoding="utf-8", errors="ignore")


def write_text_file(path: Path, content: str) -> None:
    """요약 결과를 UTF-8 텍스트 파일로 저장함."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + os.linesep, encoding="utf-8")


def clean_markdown(text: str) -> str:
    """요약 품질을 높이기 위해 이미지와 마크다운 표기를 간단히 정리함."""
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", text)

    cleaned_lines: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()

        if not stripped:
            cleaned_lines.append("")
            continue

        if re.fullmatch(r"\|?[\s:\-|]+\|?", stripped):
            continue

        if stripped.startswith("|") and stripped.endswith("|"):
            cells = [cell.strip() for cell in stripped.strip("|").split("|")]
            stripped = " / ".join(cell for cell in cells if cell)

        stripped = re.sub(r"^#{1,6}\s*", "", stripped)
        stripped = re.sub(r"^\s*[-*]\s+", "- ", stripped)
        stripped = re.sub(r"[ \t]+", " ", stripped)
        cleaned_lines.append(stripped)

    text = "\n".join(cleaned_lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_long_paragraph(paragraph: str, max_chars: int) -> list[str]:
    """문장 경계를 기준으로 긴 단락을 max_chars 이하 청크 목록으로 분할함."""
    sentences = re.split(r"(?<=[.!?。！？])\s+", paragraph)
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        if len(sentence) > max_chars:
            if current:
                chunks.append(current.strip())
                current = ""
            chunks.extend(
                sentence[start : start + max_chars].strip()
                for start in range(0, len(sentence), max_chars)
            )
            continue

        candidate = f"{current} {sentence}".strip()
        if len(candidate) <= max_chars:
            current = candidate
            continue

        if current:
            chunks.append(current.strip())
        current = sentence

    if current:
        chunks.append(current.strip())

    return [chunk for chunk in chunks if chunk]


def split_text(text: str, max_chars: int) -> list[str]:
    """긴 문서를 Groq API 호출에 적합한 청크 목록으로 분할함."""
    if max_chars <= 0:
        raise ValueError("--max-chunk-chars 값은 1 이상이어야 합니다.")

    if len(text) <= max_chars:
        return [text]

    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    chunks: list[str] = []
    current_parts: list[str] = []
    current_length = 0

    def flush_current() -> None:
        nonlocal current_length
        if current_parts:
            chunks.append("\n\n".join(current_parts).strip())
            current_parts.clear()
            current_length = 0

    for paragraph in paragraphs:
        paragraph_length = len(paragraph)

        if paragraph_length > max_chars:
            flush_current()
            chunks.extend(split_long_paragraph(paragraph, max_chars))
            continue

        separator_length = 2 if current_parts else 0
        candidate_length = current_length + separator_length + paragraph_length
        if candidate_length <= max_chars:
            current_parts.append(paragraph)
            current_length = candidate_length
            continue

        flush_current()
        current_parts.append(paragraph)
        current_length = paragraph_length

    flush_current()
    return chunks


def iter_env_candidates(start_dir: Path) -> Iterable[Path]:
    """현재 예제와 저장소 상위 디렉터리에서 .env 후보 경로를 순서대로 반환함."""
    for directory in (start_dir, *start_dir.parents):
        yield directory / ".env"
        yield directory / "agentic-ai" / "examples" / ".env"


def load_environment(start_dir: Path) -> list[Path]:
    """GROQ_API_KEY가 포함된 .env 파일을 찾아 환경 변수로 로드함."""
    loaded_paths: list[Path] = []
    seen: set[Path] = set()

    for candidate in iter_env_candidates(start_dir):
        resolved = candidate.resolve()
        if resolved in seen or not resolved.exists():
            continue

        load_dotenv(resolved, override=False)
        loaded_paths.append(resolved)
        seen.add(resolved)

    return loaded_paths


def create_groq_client() -> Groq:
    """환경 변수(GROQ_API_KEY)를 읽어 Groq API 클라이언트를 생성함.
    GROQ_API_KEY가 없으면 RuntimeError를 발생시킴."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY가 설정되지 않았습니다. "
            "agentic-ai/examples/.env 또는 현재 디렉터리 .env에 값을 설정하세요."
        )

    base_url = os.getenv("GROQ_BASE_URL")
    if base_url:
        # Groq: Groq Cloud LPU에 요청을 보내는 공식 Python 클라이언트
        return Groq(api_key=api_key, base_url=base_url)
    return Groq(api_key=api_key)


def build_chunk_prompt(chunk: str, chunk_index: int, total_chunks: int) -> list[dict[str, str]]:
    """문서 일부(청크)를 요약하도록 요청하는 시스템·사용자 메시지 목록을 생성함."""
    system_prompt = (
        "당신은 기업 교육 자료를 요약하는 AI 개발 실습 보조자입니다. "
        "원문에 있는 사실만 사용하고, 한국어로 간결하게 정리하세요."
    )
    user_prompt = f"""다음 문서 조각을 읽고 핵심 내용을 요약해 주세요.

문서 조각: {chunk_index}/{total_chunks}

요약 원칙:
- 회사 개요, 핵심 가치, 수행 실적, 운영 인원, 교육 프로그램 관련 내용 우선 정리
- 수치, 기간, 고유명사는 가능한 한 보존
- 중복 표현과 이미지 설명은 제외
- Markdown 목록 형식으로 작성

문서 내용:
{chunk}"""

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def build_document_prompt(text: str) -> list[dict[str, str]]:
    """단일 전체 문서를 5개 섹션 구조로 요약하도록 요청하는 메시지 목록을 생성함."""
    system_prompt = (
        "당신은 기업 교육 자료를 요약하는 AI 개발 실습 보조자입니다. "
        "원문에 있는 사실만 사용하고, 한국어로 간결하게 정리하세요."
    )
    user_prompt = f"""다음 문서를 읽고 최종 요약을 작성해 주세요.

최종 요약 형식:
# 텍스트 요약
## 1. 회사 개요
## 2. 핵심 가치와 행동 원칙
## 3. 주요 수행 실적
## 4. 운영 인원과 전문성
## 5. 교육 프로그램과 기대효과

작성 원칙:
- 각 섹션은 3~5개 bullet 중심으로 작성
- 수치, 기간, 고유명사는 가능한 한 보존
- 중복 표현과 이미지 설명은 제외
- 원문에 없는 내용 추가 금지

문서 내용:
{text}"""

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def build_final_prompt(chunk_summaries: list[str]) -> list[dict[str, str]]:
    """여러 청크 요약을 하나의 최종 요약으로 통합 요청하는 메시지 목록을 생성함."""
    system_prompt = (
        "당신은 여러 개의 부분 요약을 하나의 최종 요약으로 통합하는 전문 요약가입니다. "
        "중복은 제거하고 사실 관계는 유지하세요."
    )
    joined_summaries = "\n\n".join(
        f"[부분 요약 {index}]\n{summary}"
        for index, summary in enumerate(chunk_summaries, start=1)
    )
    user_prompt = f"""다음 부분 요약들을 하나의 최종 요약으로 통합해 주세요.

최종 요약 형식:
# 텍스트 요약
## 1. 회사 개요
## 2. 핵심 가치와 행동 원칙
## 3. 주요 수행 실적
## 4. 운영 인원과 전문성
## 5. 교육 프로그램과 기대효과

작성 원칙:
- 한국어로 작성
- 원문에 없는 내용 추가 금지
- 각 섹션은 3~5개 bullet 중심으로 작성
- 중복 내용은 한 번만 정리

부분 요약:
{joined_summaries}"""

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def extract_message_text(message: object) -> str:
    """Groq 응답 메시지 객체에서 최종 텍스트 문자열만 추출함."""
    content = getattr(message, "content", None)

    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                parts.append(str(item.get("text") or item.get("content") or ""))
            else:
                parts.append(str(getattr(item, "text", "") or getattr(item, "content", "")))
        return "\n".join(part for part in parts if part).strip()

    return ""


def call_groq(
    client: Groq,
    messages: list[dict[str, str]],
    options: GroqOptions,
) -> CompletionResult:
    """Groq Chat Completions API를 호출하고 응답 텍스트와 사용량을 반환함."""
    start_time = time.perf_counter()
    response = client.chat.completions.create(
        model=options.model,
        messages=messages,
        temperature=options.temperature,
        top_p=options.top_p,
        max_completion_tokens=options.max_completion_tokens,
        reasoning_effort=options.reasoning_effort,
        reasoning_format=options.reasoning_format,
    )
    elapsed = time.perf_counter() - start_time

    message = response.choices[0].message
    text = extract_message_text(message)
    if not text:
        raise RuntimeError("Groq 응답에서 요약 텍스트를 찾을 수 없습니다.")

    usage = getattr(response, "usage", None)
    prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
    completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
    total_tokens = int(getattr(usage, "total_tokens", 0) or 0)

    return CompletionResult(
        text=text,
        elapsed_seconds=elapsed,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
    )


def summarize_text(
    client: Groq,
    text: str,
    max_chunk_chars: int,
    options: GroqOptions,
) -> tuple[str, list[CompletionResult]]:
    """문서를 청크별로 요약한 뒤 최종 통합 요약을 생성하여 반환함."""
    chunks = split_text(text, max_chars=max_chunk_chars)
    total_chunks = len(chunks)
    results: list[CompletionResult] = []
    chunk_summaries: list[str] = []

    print(f"   - 분할 청크 수: {total_chunks}")

    if total_chunks == 1:
        print(f"   - 전체 문서 요약 중 ({len(chunks[0]):,} characters)")
        result = call_groq(
            client=client,
            messages=build_document_prompt(chunks[0]),
            options=options,
        )
        print(
            "     완료: "
            f"{result.elapsed_seconds:.2f}초, "
            f"{result.completion_tokens:,} output tokens"
        )
        return result.text, [result]

    for index, chunk in enumerate(chunks, start=1):
        print(f"   - 청크 {index}/{total_chunks} 요약 중 ({len(chunk):,} characters)")
        result = call_groq(
            client=client,
            messages=build_chunk_prompt(chunk, index, total_chunks),
            options=options,
        )
        results.append(result)
        chunk_summaries.append(result.text)
        print(
            "     완료: "
            f"{result.elapsed_seconds:.2f}초, "
            f"{result.completion_tokens:,} output tokens"
        )

    print("   - 최종 통합 요약 생성 중")
    final_result = call_groq(
        client=client,
        messages=build_final_prompt(chunk_summaries),
        options=options,
    )
    results.append(final_result)
    return final_result.text, results


def parse_args() -> argparse.Namespace:
    """명령줄 인자를 파싱하여 반환함."""
    # 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
    base_dir = Path(__file__).resolve().parent

    parser = argparse.ArgumentParser(description="Groq LPU 텍스트 요약 예제")
    parser.add_argument("--input", type=Path, default=base_dir / "result_Docling.md")
    parser.add_argument("--output", type=Path, default=base_dir / "summary.txt")
    parser.add_argument("--model", default=DEFAULT_MODEL_ID)
    parser.add_argument("--max-chunk-chars", type=int, default=DEFAULT_MAX_CHUNK_CHARS)
    parser.add_argument("--max-completion-tokens", type=int, default=DEFAULT_MAX_COMPLETION_TOKENS)
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--top-p", type=float, default=0.9)
    parser.add_argument("--reasoning-effort", choices=("low", "medium", "high"), default="low")
    parser.add_argument(
        "--reasoning-format",
        choices=("hidden", "parsed", "raw"),
        default="hidden",
        help="hidden은 최종 답변만 반환하고, parsed/raw는 추론 내용을 분리 또는 포함합니다.",
    )
    return parser.parse_args()


def print_usage_summary(results: list[CompletionResult]) -> None:
    """전체 API 호출의 누적 사용량과 처리 시간을 콘솔에 출력함."""
    elapsed = sum(result.elapsed_seconds for result in results)
    prompt_tokens = sum(result.prompt_tokens for result in results)
    completion_tokens = sum(result.completion_tokens for result in results)
    total_tokens = sum(result.total_tokens for result in results)
    tokens_per_second = completion_tokens / elapsed if elapsed > 0 else 0

    print("\n사용량 요약")
    print(f"   - API 호출 수: {len(results)}")
    print(f"   - 총 소요 시간: {elapsed:.2f}초")
    print(f"   - 입력 토큰: {prompt_tokens:,}")
    print(f"   - 출력 토큰: {completion_tokens:,}")
    print(f"   - 전체 토큰: {total_tokens:,}")
    print(f"   - 출력 속도: {tokens_per_second:.1f} tokens/sec")


def main() -> None:
    """텍스트 요약 워크플로우 실행: 인자 파싱 → 파일 읽기 → 요약 → 저장."""
    args = parse_args()
    base_dir = Path(__file__).resolve().parent
    input_path = args.input.resolve()
    output_path = args.output.resolve()

    options = GroqOptions(
        model=args.model,
        temperature=args.temperature,
        top_p=args.top_p,
        max_completion_tokens=args.max_completion_tokens,
        reasoning_effort=args.reasoning_effort,
        reasoning_format=args.reasoning_format,
    )

    print("=" * 70)
    print("Groq LPU 텍스트 요약 예제")
    print("=" * 70)
    print(f"모델: {options.model}")
    print(f"입력 파일: {input_path}")
    print(f"출력 파일: {output_path}")

    loaded_env_paths = load_environment(base_dir)
    if loaded_env_paths:
        print("\n환경 변수 파일")
        for env_path in loaded_env_paths:
            print(f"   - {env_path}")

    if not input_path.exists():
        raise FileNotFoundError(f"입력 파일을 찾을 수 없습니다: {input_path}")

    print("\n1. 입력 파일 읽기")
    input_text = clean_markdown(read_text_file(input_path))
    print(f"   - 문서 길이: {len(input_text):,} characters")

    print("\n2. Groq 클라이언트 초기화")
    client = create_groq_client()
    print("   - 초기화 완료")

    print("\n3. 요약 생성")
    summary, results = summarize_text(
        client=client,
        text=input_text,
        max_chunk_chars=args.max_chunk_chars,
        options=options,
    )

    print("\n4. 결과 저장")
    write_text_file(output_path, summary)
    print(f"   - 저장 완료: {output_path}")

    print_usage_summary(results)

    print("\n" + "=" * 70)
    print("요약 결과")
    print("=" * 70)
    print(summary)
    print("=" * 70)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
