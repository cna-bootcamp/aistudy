"""
Resemble AI Chatterbox 단일 사용자 한국어 음성 복제 TTS 실습.
아래 순서로 동작함:
1. PyTorch, torchaudio, ffmpeg, chatterbox-tts 설치 여부 확인
2. voices/ 탐색 및 비-WAV 참조 음성을 ffmpeg로 WAV 변환
3. 합성할 한국어 텍스트와 선택적 톤 프롬프트를 사용자에게 입력받음
4. Groq openai/gpt-oss-120b로 입력 텍스트를 한국어 TTS 스크립트로 전처리
5. 텍스트를 세그먼트로 분할, ChatterboxMultilingualTTS(language_id="ko")로 각 세그먼트 합성,
   Facebook DNS denoiser로 노이즈 제거 후 ffmpeg concat으로 연결
6. 타임스탬프가 포함된 WAV 파일을 results/에 저장
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import warnings
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path


# 이 파일이 위치한 디렉터리 경로를 구함
SCRIPT_DIR = Path(__file__).resolve().parent        # tts.py 위치 기준 프로젝트 루트
VOICES_DIR = SCRIPT_DIR / "voices"                  # 참조 음성 파일 디렉토리
SCRIPTS_DIR = SCRIPT_DIR / "scripts"                # Groq 전처리 스크립트 저장 위치
RESULTS_DIR = SCRIPT_DIR / "results"                # 생성 음성 WAV 저장 위치
HANDS_ON_ENV_PATH = SCRIPT_DIR.parents[1] / ".env"  # GROQ_API_KEY를 읽는 .env 경로

LANGUAGE_ID = "ko"                       # Chatterbox 한국어 합성 언어 코드
GROQ_MODEL = "openai/gpt-oss-120b"       # TTS 스크립트 전처리에 사용하는 Groq LLM
GROQ_PREPROCESS_MAX_TOKENS = 4096        # Groq 응답 허용 최대 토큰 수
GROQ_PREPROCESS_CHARS = 450              # Groq 청크 당 최대 입력 문자 수 (출력 잘림 방지)
GROQ_PREPROCESS_MIN_CHARS = 180          # 청크 재분할 시 최소 문자 수 (무한 분할 방지)
DEFAULT_EXAGGERATION = 0.5               # 감정 강도 기본값 (0~1, 높을수록 과장)
DEFAULT_CFG_WEIGHT = 0.5                 # 화자 조건 강도 기본값 (낮을수록 억양 영향 감소)
REFERENCE_SAMPLE_RATE = 24000            # Chatterbox 출력 샘플레이트(Hz), model.sr와 일치
MAX_CHARS_PER_SEGMENT = 120              # TTS 세그먼트 분할 최대 문자 수 (내용 누락 방지)
MIN_CHARS_PER_SEGMENT = 12               # 이 미만이면 앞뒤 세그먼트와 병합 (정렬 오류 방지)
SILENCE_BETWEEN_SEGMENTS_SEC = 0.25      # ffmpeg concat 시 세그먼트 사이 삽입할 묵음 길이(초)
INPUT_END_MARKER = "EOD"                 # 텍스트 입력 종료 신호 (단독 줄로 입력)

# PyTorch CUDA 설치 가이드 URL (오류 안내에 출력)
PYTORCH_GUIDE_URL = (
    "https://github.com/cna-bootcamp/aistudy/blob/main/"
    "agentic-ai/reference/install-pytorch.md"
)

# ── 오디오 파일 탐지 설정 ──────────────────────────────────────────────────
# voices/ 스캔 시 오디오로 인식할 확장자 목록 — ffmpeg가 지원하는 포맷 기준
KNOWN_AUDIO_EXTENSIONS = {
    ".wav",
    ".mp3",
    ".m4a",
    ".aac",
    ".ogg",
    ".opus",
    ".flac",
    ".wma",
    ".aiff",
    ".aif",
    ".webm",
    ".amr",
    ".mp4",
    ".mov",
    ".3gp",
    ".3g2",
    ".caf",
    ".mka",
    ".wv",
    ".ape",
    ".ra",
    ".au",
    ".ac3",
    ".dts",
    ".tta",
    ".spx",
    ".gsm",
    ".ts",
}

# voices/ 스캔 시 무시할 확장자 — 오디오가 아닌 메타/설정 파일 제외
IGNORED_EXTENSIONS = {
    ".json",
    ".txt",
    ".md",
    ".py",
    ".tmp",
    ".bak",
    ".part",
}

# 톤앤매너 입력 프롬프트에 표시하는 예시 문자열
TONE_EXAMPLES = (
    "차분하고 다정하게 / "
    "밝고 활기차게 / "
    "뉴스 앵커처럼 또렷하게"
)

# ── denoiser 노이즈 제거 설정 ─────────────────────────────────────────────
# Facebook Research denoiser DNS 모델로 세그먼트별 음성 노이즈 제거.
# 모델은 최초 실행 시 자동 다운로드됨 (~torch cache).
#   "dns48" — 48채널, 72MB, 속도·품질 균형 (권장)
#   "dns64" — 64채널, 128MB, 더 강한 제거, 느림
DENOISER_MODEL = "dns48"

# SAVE_SEGMENTS: True이면 세그먼트 WAV를 results/segments_{timestamp}/ 에 보존.
#   합성 품질 점검, 특정 구간 재생성, 파라미터 비교 실험에 활용.
#   False이면 최종 결과 WAV 생성 후 임시 디렉토리를 자동 삭제.
SAVE_SEGMENTS = False

# ── 데이터 구조 ────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class RuntimeDeps:
    torch: object
    model_class: object
    groq_client_class: object


@dataclass(frozen=True)
class ToneDecision:
    prompt: str
    text: str
    exaggeration: float
    cfg_weight: float


@dataclass(frozen=True)
class TTSLine:
    cue: str
    text: str
    exaggeration: float
    cfg_weight: float


# ── 환경 설정 ──────────────────────────────────────────────────────────────
def configure_console() -> None:
    """Windows 터미널에서 UTF-8 입출력을 설정함."""
    for stream_name in ("stdin", "stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        # Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")


def exit_with_error(message: str, guide: str | None = None) -> None:
    """에러 메시지와 선택적 안내문을 출력하고 프로세스를 종료함."""
    print(f"\n[Error] {message}")
    if guide:
        print(guide)
    raise SystemExit(1)


def load_env_file(env_path: Path) -> dict[str, str]:
    """.env 파일을 파싱하여 {키: 값} 딕셔너리로 반환함."""
    values: dict[str, str] = {}
    if not env_path.exists():
        return values

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip().removeprefix("export ").strip().lstrip("﻿")
        value = value.strip().strip('"').strip("'")
        if key:
            values[key] = value

    return values


def get_groq_api_key() -> str:
    """환경변수 또는 .env 파일에서 GROQ_API_KEY를 읽어 반환함. 없으면 종료."""
    # GROQ_API_KEY: Groq LLM API 인증에 사용하는 비밀 키
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if api_key:
        return api_key

    env_values = load_env_file(HANDS_ON_ENV_PATH)
    api_key = env_values.get("GROQ_API_KEY", "").strip()
    if api_key:
        return api_key

    exit_with_error(
        "GROQ_API_KEY not found.",
        "\n".join(
            [
                f"Set GROQ_API_KEY in {HANDS_ON_ENV_PATH}",
                "Example: GROQ_API_KEY=gsk_...",
            ]
        ),
    )


def make_run_paths() -> tuple[Path, Path]:
    """타임스탬프 기반 결과 WAV 및 스크립트 경로를 생성하여 반환함."""
    timestamp = datetime.now(ZoneInfo("Asia/Seoul")).strftime("%Y%m%d_%H%M%S")
    SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    return (
        RESULTS_DIR / f"result_{timestamp}.wav",
        SCRIPTS_DIR / f"script_{timestamp}.txt",
    )


def check_python_version() -> None:
    """Python 3.12 또는 3.13이 아닌 경우 안내 후 종료함."""
    if sys.version_info[:2] not in ((3, 12), (3, 13)):
        exit_with_error(
            "This example must be run with Python 3.12 or 3.13.",
            "Create the venv with: py -3.12 -m venv venv --system-site-packages",
        )


# ── 실행 전 필수 의존성 검사 ───────────────────────────────────────────────
def check_prerequisites() -> RuntimeDeps:
    """PyTorch, torchaudio, ffmpeg, chatterbox-tts, groq 설치 여부를 확인하고 RuntimeDeps를 반환함."""
    check_python_version()

    try:
        import torch
    except ImportError:
        exit_with_error(
            "PyTorch is not installed.",
            "\n".join(
                [
                    "Install PyTorch CUDA build outside the venv first.",
                    f"Guide: {PYTORCH_GUIDE_URL}",
                    "Example: py -3.12 -m pip install torch torchvision torchaudio "
                    "--index-url https://download.pytorch.org/whl/cu126",
                ]
            ),
        )

    try:
        import torchaudio  # noqa: F401
    except ImportError:
        exit_with_error(
            "torchaudio is not installed.",
            "\n".join(
                [
                    "Install the PyTorch package set outside the venv first.",
                    f"Guide: {PYTORCH_GUIDE_URL}",
                ]
            ),
        )

    if shutil.which("ffmpeg") is None:
        exit_with_error(
            "ffmpeg is not installed or not available on PATH.",
            "\n".join(
                [
                    "ffmpeg is a system tool and must not be installed via pip.",
                    "Windows: winget install ffmpeg",
                    "macOS: brew install ffmpeg",
                    "Linux: sudo apt install ffmpeg",
                ]
            ),
        )

    warnings.filterwarnings(
        "ignore",
        message="pkg_resources is deprecated as an API.*",
        category=UserWarning,
    )

    try:
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    except ImportError as exc:
        exit_with_error(
            f"chatterbox-tts import failed: {exc}",
            "Install project dependencies with: pip install -r requirements.txt",
        )

    try:
        import numpy  # noqa: F401
        import scipy  # noqa: F401
    except ImportError as exc:
        exit_with_error(
            f"required Python package import failed: {exc}",
            "Install project dependencies with: pip install -r requirements.txt",
        )

    try:
        from groq import Groq
    except ImportError as exc:
        exit_with_error(
            f"groq import failed: {exc}",
            "Install project dependencies with: pip install -r requirements.txt",
        )

    return RuntimeDeps(torch=torch, model_class=ChatterboxMultilingualTTS, groq_client_class=Groq)


def patch_chatterbox_alignment_analyzer() -> None:
    """짧은 세그먼트에서 발생하는 Chatterbox IndexError를 빈 슬라이스 복구 래퍼로 패치함."""
    try:
        from chatterbox.models.t3.inference.alignment_stream_analyzer import AlignmentStreamAnalyzer
    except ImportError:
        return

    if getattr(AlignmentStreamAnalyzer.step, "_safe_empty_slice_patch", False):
        return

    original_step = AlignmentStreamAnalyzer.step

    def safe_step(self, logits, next_token=None):
        try:
            return original_step(self, logits, next_token=next_token)
        except IndexError as exc:
            message = str(exc)
            if "Expected reduction dim 1 to have non-zero size" in message:
                return logits
            raise

    safe_step._safe_empty_slice_patch = True
    # 라이브러리 내부 함수를 수정된 버전으로 교체함 (monkey-patch)
    AlignmentStreamAnalyzer.step = safe_step


def is_audio_candidate(path: Path) -> bool:
    """경로가 오디오 파일 후보인지 확장자로 판단하여 반환함."""
    suffix = path.suffix.lower()
    if suffix in KNOWN_AUDIO_EXTENSIONS:
        return True
    return bool(suffix and suffix not in IGNORED_EXTENSIONS)


# ── 참조 음성 준비 ─────────────────────────────────────────────────────────
def scan_voice_sources() -> list[Path]:
    """voices/ 디렉터리에서 오디오 파일을 탐색하여 정렬된 목록을 반환함."""
    VOICES_DIR.mkdir(parents=True, exist_ok=True)
    return sorted(
        (
            path
            for path in VOICES_DIR.iterdir()
            if path.is_file() and not path.name.startswith(".") and is_audio_candidate(path)
        ),
        key=lambda item: item.name.lower(),
    )


def convert_to_wav(source: Path) -> Path:
    """비-WAV 오디오를 ffmpeg로 WAV로 변환하여 경로를 반환함. 이미 WAV이면 그대로 반환."""
    if source.suffix.lower() == ".wav":
        return source

    target = source.with_suffix(".wav")
    if target.exists() and target.stat().st_size > 0:
        print(f"[Voice] Reuse converted WAV: {target.name}")
        return target

    print(f"[Voice] Convert with ffmpeg: {source.name} -> {target.name}")
    result = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source),
            "-vn",
            "-ac",
            "1",
            "-ar",
            str(REFERENCE_SAMPLE_RATE),
            "-c:a",
            "pcm_s16le",
            str(target),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    if result.returncode != 0:
        exit_with_error(
            f"ffmpeg failed to convert reference audio: {source.name}",
            result.stderr.strip() or "Check whether the file is a valid audio file.",
        )

    return target


def prepare_reference_voices() -> list[Path]:
    """voices/의 오디오를 WAV로 변환·중복 제거하여 사용 가능한 WAV 목록을 반환함."""
    sources = scan_voice_sources()
    if not sources:
        exit_with_error(
            f"No reference audio files found in {VOICES_DIR}",
            "\n".join(
                [
                    "Place at least one reference voice file in voices/.",
                    "Recommended names: user.wav, user.mp3, user.m4a",
                    "Recommended clip: about 10 seconds, single speaker, low background noise.",
                ]
            ),
        )

    print("\n[Voice] Found reference audio files:")
    for source in sources:
        print(f"  - {source.name}")

    wav_by_path: dict[str, Path] = {}
    for source in sources:
        wav_path = convert_to_wav(source)
        wav_by_path[str(wav_path.resolve()).lower()] = wav_path

    wav_files = sorted(wav_by_path.values(), key=lambda item: item.name.lower())
    if not wav_files:
        exit_with_error("No usable WAV reference audio files found.")

    return wav_files


def select_reference_voice(wav_files: list[Path]) -> Path:
    """WAV 목록에서 사용자가 선택한 참조 음성 경로를 반환함. 1개이면 자동 선택."""
    if len(wav_files) == 1:
        selected = wav_files[0]
        print(f"\n[Voice] Use reference voice: {selected.name}")
        return selected

    print("\n[Voice] Select one reference voice for this run.")
    for index, wav_path in enumerate(wav_files, start=1):
        size_kb = wav_path.stat().st_size // 1024
        print(f"  {index}. {wav_path.name} ({size_kb} KB)")

    while True:
        try:
            choice = input(f"Select number (1-{len(wav_files)}): ").strip()
        except EOFError:
            exit_with_error("Multiple reference voices found. Rerun interactively and select one.")

        if choice.isdigit():
            index = int(choice)
            if 1 <= index <= len(wav_files):
                selected = wav_files[index - 1]
                print(f"[Voice] Selected: {selected.name}")
                return selected

        print("Invalid selection. Please enter a valid number.")


def contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    """text에 keywords 중 하나라도 포함되면 True를 반환함."""
    return any(keyword in text for keyword in keywords)


# ── 톤 프롬프트 → TTS 파라미터 변환 ──────────────────────────────────────
# exaggeration: 감정 표현 강도 / cfg_weight: 화자 일관성 (높을수록 단조롭고 명확)
def apply_tone_prompt(source_text: str, tone_prompt: str) -> ToneDecision:
    """톤 프롬프트 키워드를 분석하여 exaggeration·cfg_weight를 결정한 ToneDecision을 반환함."""
    prompt = tone_prompt.strip()
    prompt_lower = prompt.lower()
    exaggeration = DEFAULT_EXAGGERATION
    cfg_weight = DEFAULT_CFG_WEIGHT

    if contains_any(prompt_lower, ("극적", "감정", "연기", "dramatic", "emotional")):
        exaggeration = 0.75
        cfg_weight = 0.35
    elif contains_any(prompt_lower, ("밝", "활기", "신나", "경쾌", "energetic", "bright", "cheerful")):
        exaggeration = 0.65
        cfg_weight = 0.45
    elif contains_any(
        prompt_lower,
        ("뉴스", "앵커", "또렷", "명확", "차분한 보도", "news", "anchor", "clear"),
    ):
        exaggeration = 0.35
        cfg_weight = 0.65
    elif contains_any(
        prompt_lower,
        ("차분", "다정", "부드럽", "온화", "잔잔", "calm", "warm", "gentle", "soft"),
    ):
        exaggeration = 0.35
        cfg_weight = 0.55

    if contains_any(prompt_lower, ("느리", "천천히", "slow")):
        cfg_weight = min(cfg_weight, 0.4)

    return ToneDecision(
        prompt=prompt,
        text=source_text,
        exaggeration=exaggeration,
        cfg_weight=cfg_weight,
    )


# ── Groq 전처리: 희곡식 TTS 스크립트 생성 ───────────────────────────────
def split_text_for_groq(text: str, max_chars: int = GROQ_PREPROCESS_CHARS) -> list[str]:
    """텍스트를 Groq 청크 크기 제한에 맞게 분할하여 청크 목록을 반환함."""
    chunks: list[str] = []
    current = ""

    blocks = [block.strip() for block in re.split(r"\n\s*\n", text) if block.strip()]
    for block in blocks:
        if len(block) <= max_chars:
            candidate = f"{current}\n\n{block}".strip()
            if current and len(candidate) > max_chars:
                chunks.append(current)
                current = block
            else:
                current = candidate
            continue

        for segment in split_text_for_tts(block, max_chars=max_chars):
            candidate = f"{current}\n\n{segment}".strip()
            if current and len(candidate) > max_chars:
                chunks.append(current)
                current = segment
            else:
                current = candidate

    if current:
        chunks.append(current)

    return chunks or [text]


def build_groq_prompts(source_text: str, tone_prompt: str) -> tuple[str, str]:
    """Groq API 호출용 시스템 프롬프트와 사용자 프롬프트 튜플을 생성하여 반환함."""
    tone = tone_prompt.strip() or "default natural Korean narration"
    system_prompt = (
        "You are a Korean TTS preprocessing specialist for Resemble AI Chatterbox Multilingual. "
        "Return only a plain text stage script. Do not return JSON, markdown, bullets, explanations, or code fences. "
        "Each spoken line must start with one cue in this exact format: "
        "(emotion_label|exaggeration=0.35|cfg_weight=0.60) dialogue. "
        "Use concise emotion labels: calm_clear, warm_gentle, bright_energetic, news_anchor, "
        "serious_apology, emphatic, concerned, encouraging, reflective. "
        "Chatterbox emotion is controlled by exaggeration and cfg_weight. "
        "For calm/news use exaggeration 0.30-0.45 and cfg_weight 0.60-0.75. "
        "For bright/emphatic use exaggeration 0.55-0.75 and cfg_weight 0.40-0.60. "
        "Preserve all facts, names, dates, amounts, quotations, and meaning. "
        "Do not summarize, add, omit, or translate. "
        "Normalize Korean numbers, dates, percentages, and money into Hangul reading forms. "
        "Normalize uppercase acronyms into Korean pronunciation: AI -> 에이아이, AM -> 에이엠, SDLC -> 에스디엘시. "
        "Convert other all-caps acronyms letter by letter. "
        "Do not leave raw Arabic numerals or all-caps acronyms in dialogue unless they are IDs/codes. "
        "Use [laugh], [cough], or [chuckle] only if the tone explicitly requests such non-speech sounds."
    )
    user_prompt = f"Tone prompt:\n{tone}\n\nUser text:\n{source_text}"
    return system_prompt, user_prompt


def call_groq_for_script(
    client: object,
    source_text: str,
    tone_prompt: str,
    part_label: str,
    max_chars: int = GROQ_PREPROCESS_CHARS,
) -> str:
    """Groq API를 호출하여 TTS 스크립트를 생성하고 텍스트로 반환함. 토큰 초과 시 재귀 분할."""
    system_prompt, user_prompt = build_groq_prompts(source_text, tone_prompt)
    try:
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.15,
            max_completion_tokens=GROQ_PREPROCESS_MAX_TOKENS,
        )
    except Exception as exc:
        exit_with_error(
            f"Groq preprocessing failed at {part_label}: {exc}",
            "This is usually caused by a long input. The script now preprocesses in smaller chunks; try shortening one paragraph if it persists.",
        )

    choice = completion.choices[0]
    finish_reason = getattr(choice, "finish_reason", None)

    if finish_reason in {"length", "max_tokens"}:
        if len(source_text) <= GROQ_PREPROCESS_MIN_CHARS or max_chars <= GROQ_PREPROCESS_MIN_CHARS:
            exit_with_error(
                f"Groq preprocessing was truncated at {part_label}.",
                "The input chunk is already small. Try simplifying that paragraph or reducing tone instructions.",
            )

        smaller_max_chars = max(GROQ_PREPROCESS_MIN_CHARS, max_chars // 2)
        print(
            f"[Preprocess] {part_label} reached token limit; "
            f"retrying with {smaller_max_chars}-char chunks."
        )
        sub_chunks = split_text_for_groq(source_text, max_chars=smaller_max_chars)
        sub_scripts = [
            call_groq_for_script(
                client,
                sub_chunk,
                tone_prompt,
                f"{part_label}.{sub_index}",
                max_chars=smaller_max_chars,
            )
            for sub_index, sub_chunk in enumerate(sub_chunks, start=1)
        ]
        return "\n".join(script for script in sub_scripts if script.strip())

    return (choice.message.content or "").strip()


def preprocess_text_with_groq(
    groq_client_class: object,
    source_text: str,
    tone_prompt: str,
    script_path: Path,
) -> str:
    """Groq LLM으로 입력 텍스트를 TTS 스크립트로 전처리하고 파일에 저장 후 반환함."""
    api_key = get_groq_api_key()
    client = groq_client_class(api_key=api_key)
    chunks = split_text_for_groq(source_text)

    print(f"[Preprocess] Groq model: {GROQ_MODEL}")
    print(f"[Preprocess] Input split into {len(chunks)} chunk(s).")

    scripts: list[str] = []
    for index, chunk in enumerate(chunks, start=1):
        label = f"chunk {index}/{len(chunks)}"
        print(f"[Preprocess] {label} ({len(chunk)} chars)")
        script_chunk = call_groq_for_script(client, chunk, tone_prompt, label)
        if script_chunk:
            scripts.append(script_chunk)

    combined = "\n".join(scripts)
    preprocessed = "\n".join(line.strip() for line in combined.splitlines() if line.strip())
    if not preprocessed:
        exit_with_error("Groq returned empty preprocessed text.")

    script_path.write_text(preprocessed + "\n", encoding="utf-8")
    print(f"[Preprocess] Script saved: {script_path}")

    return preprocessed


# ── 사용자 입력 수집 ───────────────────────────────────────────────────────
def read_multiline_text() -> str:
    """여러 줄 텍스트를 입력받아 하나의 문자열로 반환함. EOD 입력 시 종료."""
    print(f"Text to synthesize. Type {INPUT_END_MARKER} on its own line to finish.")
    print(f"Type {INPUT_END_MARKER} without text to exit.")

    lines: list[str] = []
    while True:
        prompt = "> " if not lines else ". "
        try:
            line = input(prompt)
        except EOFError:
            break

        if line.strip().upper() == INPUT_END_MARKER:
            break
        lines.append(line.rstrip())

    return "\n".join(lines).strip()


def read_user_inputs(groq_client_class: object, script_path: Path) -> ToneDecision | None:
    """텍스트와 톤 프롬프트를 입력받아 Groq 전처리 후 ToneDecision을 반환함. 빈 입력이면 None."""
    print("\n[Input] Korean text is synthesized directly with language_id=\"ko\".")
    source_text = read_multiline_text()

    if not source_text:
        print("[Exit] Empty text input.")
        return None

    try:
        tone_prompt = input(f"Tone prompt (optional, e.g. {TONE_EXAMPLES}): ").strip()
    except EOFError:
        tone_prompt = ""

    source_text = preprocess_text_with_groq(groq_client_class, source_text, tone_prompt, script_path)

    decision = apply_tone_prompt(source_text, tone_prompt)

    print("\n[Tone] Prompt      :", decision.prompt or "(default tone)")
    print("[Tone] exaggeration:", decision.exaggeration)
    print("[Tone] cfg_weight  :", decision.cfg_weight)

    return decision


# ── TTS 세그먼트 분할 ──────────────────────────────────────────────────────
def split_long_sentence(sentence: str, max_chars: int) -> list[str]:
    """긴 문장을 단어 단위로 분할하여 max_chars 이하 청크 목록을 반환함."""
    words = sentence.split()
    if not words:
        return []

    chunks: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and len(candidate) > max_chars:
            chunks.append(current)
            current = word
        else:
            current = candidate

    if current:
        chunks.append(current)
    return chunks


def split_text_for_tts(text: str, max_chars: int = MAX_CHARS_PER_SEGMENT) -> list[str]:
    """텍스트를 문장 단위로 분할하여 TTS 세그먼트 목록을 반환함."""
    paragraphs = [line.strip() for line in text.splitlines() if line.strip()]
    segments: list[str] = []

    for paragraph in paragraphs:
        sentences = re.findall(r'.+?(?:[.!?。！？]+["\')\]]*|$)', paragraph)
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            if len(sentence) <= max_chars:
                segments.append(sentence)
            else:
                segments.extend(split_long_sentence(sentence, max_chars))

    if not segments and text.strip():
        segments = split_long_sentence(text.strip(), max_chars)

    return segments


def clamp_float(value: float, low: float, high: float) -> float:
    """value를 [low, high] 범위로 클리핑하여 반환함."""
    return max(low, min(high, value))


def parse_float_param(cue: str, name: str) -> float | None:
    """cue 문자열에서 name=값 패턴을 찾아 float로 반환함. 없으면 None."""
    match = re.search(rf"{re.escape(name)}\s*=\s*([0-9]+(?:\.[0-9]+)?)", cue)
    if not match:
        return None
    return float(match.group(1))


def emotion_defaults_from_cue(cue: str, fallback: ToneDecision) -> tuple[float, float]:
    """cue 키워드에서 감정 기본값 (exaggeration, cfg_weight) 튜플을 반환함."""
    cue_lower = cue.lower()
    if any(word in cue_lower for word in ("news", "anchor", "clear")):
        return 0.35, 0.68
    if any(word in cue_lower for word in ("bright", "energetic", "encouraging")):
        return 0.62, 0.48
    if any(word in cue_lower for word in ("emphatic", "dramatic")):
        return 0.72, 0.42
    if any(word in cue_lower for word in ("apology", "concerned", "serious", "reflective")):
        return 0.42, 0.62
    if any(word in cue_lower for word in ("warm", "gentle", "calm")):
        return 0.38, 0.58
    return fallback.exaggeration, fallback.cfg_weight


def tts_line_from_cue(cue: str, text: str, fallback: ToneDecision) -> TTSLine:
    """cue 문자열과 텍스트로 TTSLine 객체를 생성하여 반환함."""
    default_exaggeration, default_cfg_weight = emotion_defaults_from_cue(cue, fallback)
    exaggeration = parse_float_param(cue, "exaggeration")
    cfg_weight = parse_float_param(cue, "cfg_weight")

    return TTSLine(
        cue=cue,
        text=text.strip(),
        exaggeration=clamp_float(exaggeration if exaggeration is not None else default_exaggeration, 0.25, 1.0),
        cfg_weight=clamp_float(cfg_weight if cfg_weight is not None else default_cfg_weight, 0.0, 1.0),
    )


# ── Groq 스크립트 → TTSLine 파싱 ──────────────────────────────────────────
# 형식: (emotion_label|exaggeration=0.5|cfg_weight=0.5) 대사
def script_to_tts_lines(script_text: str, tone_decision: ToneDecision) -> list[TTSLine]:
    """Groq 스크립트 텍스트를 파싱하여 TTSLine 목록을 반환함."""
    lines: list[TTSLine] = []
    current_cue = ""

    def append_dialogue(cue: str, dialogue: str) -> None:
        for segment in split_text_for_tts(dialogue):
            if segment.strip():
                lines.append(tts_line_from_cue(cue, segment, tone_decision))

    for raw_line in script_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        match = re.match(r"^\((?P<cue>[^)]*)\)\s*(?P<text>.*)$", line)
        if match:
            current_cue = match.group("cue").strip()
            dialogue = match.group("text").strip()
            if dialogue:
                append_dialogue(current_cue, dialogue)
            continue

        append_dialogue(current_cue, line)

    return merge_short_tts_lines(lines)


def merge_short_tts_lines(lines: list[TTSLine]) -> list[TTSLine]:
    """Chatterbox alignment analyzer IndexError 방지를 위해 짧은 대사를 인접 대사와 병합함."""
    if not lines:
        return lines

    merged: list[TTSLine] = []
    for line in lines:
        if not merged:
            merged.append(line)
            continue

        if len(line.text) < MIN_CHARS_PER_SEGMENT:
            previous = merged[-1]
            merged[-1] = TTSLine(
                cue=previous.cue,
                text=f"{previous.text} {line.text}".strip(),
                exaggeration=previous.exaggeration,
                cfg_weight=previous.cfg_weight,
            )
        else:
            merged.append(line)

    if len(merged) > 1 and len(merged[0].text) < MIN_CHARS_PER_SEGMENT:
        first = merged.pop(0)
        second = merged.pop(0)
        merged.insert(
            0,
            TTSLine(
                cue=second.cue,
                text=f"{first.text} {second.text}".strip(),
                exaggeration=second.exaggeration,
                cfg_weight=second.cfg_weight,
            ),
        )

    return merged


# ── 음성 합성 ──────────────────────────────────────────────────────────────
def generate_and_save_segments(
    model: object,
    torch: object,
    text: str,
    reference_voice: Path,
    tone_decision: ToneDecision,
    output_path: Path,
    denoiser_model: object = None,
) -> float:
    """텍스트를 세그먼트로 합성·노이즈 제거 후 ffmpeg로 연결하여 WAV를 저장하고 총 길이(초)를 반환함."""
    tts_lines = script_to_tts_lines(text, tone_decision)
    if not tts_lines:
        exit_with_error("No text segments to synthesize.")

    timestamp = output_path.stem.replace("result_", "")
    tmp_dir = output_path.parent / f"_seg_{timestamp}"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n[Generate] Split text into {len(tts_lines)} segment(s).")
    segment_paths: list[Path] = []
    total_duration = 0.0

    for index, line in enumerate(tts_lines, start=1):
        print(
            f"[Generate] Segment {index}/{len(tts_lines)} "
            f"({len(line.text)} chars, exaggeration={line.exaggeration:.2f}, cfg_weight={line.cfg_weight:.2f})"
        )
        wav = model.generate(
            line.text,
            language_id=LANGUAGE_ID,
            audio_prompt_path=str(reference_voice),
            exaggeration=line.exaggeration,
            cfg_weight=line.cfg_weight,
        )
        clean_path = tmp_dir / f"seg_{index:03d}.wav"

        if denoiser_model is not None:
            try:
                import torchaudio
                from denoiser.dsp import convert_audio as _dn_cvt
                dn_device = next(iter(denoiser_model.parameters())).device
                # wav가 [N] 또는 [1,N]일 수 있으므로 convert_audio를 위해 [1,N]으로 정규화
                w = wav if wav.dim() == 2 else wav.unsqueeze(0)
                w = _dn_cvt(w.to(dn_device), model.sr, denoiser_model.sample_rate, denoiser_model.chin)
                with torch.no_grad():
                    out = denoiser_model(w[None])
                if isinstance(out, (list, tuple)):
                    out = out[0]
                if denoiser_model.sample_rate != model.sr:
                    out = torchaudio.functional.resample(out, denoiser_model.sample_rate, model.sr)
                total_duration += save_pcm16_wav(out[0], model.sr, clean_path)
            except Exception as exc:
                print(f"[Generate] Segment {index} denoising failed ({exc}), saving raw.")
                total_duration += save_pcm16_wav(wav, model.sr, clean_path)
        else:
            total_duration += save_pcm16_wav(wav, model.sr, clean_path)

        segment_paths.append(clean_path)

        if index < len(tts_lines):
            total_duration += SILENCE_BETWEEN_SEGMENTS_SEC

    # torch.cat 방식의 raw PCM 접합 아티팩트를 방지하기 위해 ffmpeg concat demuxer 사용
    silence_path = tmp_dir / "silence.wav"
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi",
            "-i", f"aevalsrc=0:c=mono:s={model.sr}:d={SILENCE_BETWEEN_SEGMENTS_SEC}",
            str(silence_path),
        ],
        capture_output=True,
        check=True,
    )

    filelist_path = tmp_dir / "list.txt"
    entries: list[str] = []
    for i, seg_path in enumerate(segment_paths):
        entries.append(f"file '{seg_path.as_posix()}'")
        if i < len(segment_paths) - 1:
            entries.append(f"file '{silence_path.as_posix()}'")
    filelist_path.write_text("\n".join(entries), encoding="utf-8")

    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "concat", "-safe", "0",
            "-i", str(filelist_path),
            str(output_path),
        ],
        capture_output=True,
        check=True,
    )

    if SAVE_SEGMENTS:
        seg_dir = output_path.parent / f"segments_{timestamp}"
        seg_dir.mkdir(parents=True, exist_ok=True)
        for seg_path in segment_paths:
            shutil.move(str(seg_path), seg_dir / seg_path.name)
        print(f"[Generate] Segments saved: {seg_dir}")

    for f in tmp_dir.iterdir():
        f.unlink()
    tmp_dir.rmdir()

    return total_duration


# float32 → int16 클리핑·정규화 후 16-bit PCM WAV로 저장
def save_pcm16_wav(wav_tensor: object, sample_rate: int, output_path: Path) -> float:
    """wav 텐서를 정규화·클리핑 후 16-bit PCM WAV로 저장하고 길이(초)를 반환함."""
    import numpy as np
    from scipy.io import wavfile

    if hasattr(wav_tensor, "detach"):
        audio = wav_tensor.detach().cpu().numpy()
    else:
        audio = np.asarray(wav_tensor)

    audio = np.asarray(audio, dtype=np.float32)
    if audio.ndim == 2:
        if audio.shape[0] == 1:
            audio = audio[0]
        elif audio.shape[1] == 1:
            audio = audio[:, 0]
        elif audio.shape[0] <= audio.shape[1]:
            audio = audio.mean(axis=0)
        else:
            audio = audio.mean(axis=1)

    max_abs = float(np.max(np.abs(audio))) if audio.size else 0.0
    if max_abs > 1.0:
        audio = audio / max_abs

    audio = np.clip(audio, -1.0, 1.0)
    audio_int16 = (audio * 32767.0).astype(np.int16)
    # 오디오 데이터를 16-bit PCM WAV 파일로 저장함
    wavfile.write(str(output_path), sample_rate, audio_int16)
    return float(len(audio_int16) / sample_rate) if sample_rate else 0.0


# ── 진입점 ─────────────────────────────────────────────────────────────────
def main() -> None:
    """Chatterbox 단일 사용자 한국어 음성 복제 TTS 전체 파이프라인을 실행함."""
    configure_console()

    print("=" * 64)
    print("Chatterbox Single-User Korean Voice Cloning TTS")
    print("Model   : Chatterbox Multilingual (500M, 23 languages)")
    print("Language: ko (Korean)")
    print("=" * 64)

    deps = check_prerequisites()
    patch_chatterbox_alignment_analyzer()
    wav_files = prepare_reference_voices()
    reference_voice = select_reference_voice(wav_files)
    output_path, script_path = make_run_paths()
    tone_decision = read_user_inputs(deps.groq_client_class, script_path)
    if tone_decision is None:
        return

    torch = deps.torch
    model_class = deps.model_class
    # GPU(CUDA) 사용 가능 여부 확인. 불가능하면 CPU 사용
    device = "cuda" if torch.cuda.is_available() else "cpu"

    print("\n[Model] Loading ChatterboxMultilingualTTS...")
    print("[Model] First run downloads about 500 MB. Network connection and disk space are required.")
    if device == "cuda":
        print(f"[Model] Device: cuda ({torch.cuda.get_device_name(0)})")
    else:
        print("[Model] Device: cpu (generation can be slow)")

    model = model_class.from_pretrained(device=device)

    print(f"\n[Denoiser] Loading {DENOISER_MODEL} model...")
    from denoiser import pretrained as _dn_pretrained
    denoiser_model = getattr(_dn_pretrained, DENOISER_MODEL)().to(device)
    denoiser_model.eval()
    print(f"[Denoiser] Ready (sample_rate={denoiser_model.sample_rate} Hz)")

    print("\n[Generate] Voice cloning from:", reference_voice.name)
    duration = generate_and_save_segments(model, torch, tone_decision.text, reference_voice, tone_decision, output_path, denoiser_model)

    print("\n[Done] Output:", output_path)
    print(f"[Done] Format: WAV, 16-bit PCM, {model.sr} Hz")
    print(f"[Done] Approx duration: {duration:.2f}s")
    print("[Note] Perth imperceptible watermark is automatically included by Chatterbox.")


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
