"""OpenAI Whisper STT 예제.

OpenAI Whisper API를 사용하여 오디오 파일을 한국어로 전사하고
영문으로 직접 번역한 뒤 result.txt로 저장함.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI


# Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
SCRIPT_DIR = Path(__file__).resolve().parent
STT_DIR = SCRIPT_DIR.parent
HANDS_ON_DIR = STT_DIR.parent
AUDIO_DIR = STT_DIR / "audio"
ENV_PATH = HANDS_ON_DIR / ".env"
DEFAULT_OUTPUT = SCRIPT_DIR / "result.txt"
MODEL_ID = "whisper-1"

SUPPORTED_FORMATS = {
    ".flac",
    ".m4a",
    ".mp3",
    ".mp4",
    ".mpeg",
    ".mpga",
    ".ogg",
    ".wav",
    ".webm",
}


def load_openai_client(env_path: Path) -> OpenAI:
    """hands-on/.env에서 OPENAI_API_KEY를 읽어 OpenAI 클라이언트를 생성함."""
    # .env 파일에서 API 키 등 환경변수를 로드함
    load_dotenv(env_path)
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(f"OPENAI_API_KEY가 설정되지 않았습니다: {env_path}")
    return OpenAI(api_key=api_key)


def find_audio_files(audio_dir: Path) -> list[Path]:
    """Whisper가 지원하는 오디오 파일 목록을 이름순으로 반환함."""
    if not audio_dir.exists():
        return []

    return sorted(
        path
        for path in audio_dir.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_FORMATS
    )


def print_audio_files(audio_files: list[Path]) -> None:
    """1부터 시작하는 번호와 함께 사용 가능한 오디오 파일 목록을 출력함."""
    print("=" * 70)
    print("Whisper 지원 오디오 파일")
    print("=" * 70)

    if not audio_files:
        print(f"오디오 파일이 없습니다: {AUDIO_DIR}")
        print("지원 확장자: " + ", ".join(sorted(SUPPORTED_FORMATS)))
        return

    for index, audio_path in enumerate(audio_files, start=1):
        size_kb = audio_path.stat().st_size / 1024
        print(f"{index}. {audio_path.name} ({size_kb:,.1f} KB)")


def select_audio_file(audio_files: list[Path]) -> Path:
    """사용자가 번호를 입력하여 오디오 파일을 선택하도록 안내함."""
    if not audio_files:
        raise FileNotFoundError(f"지원 오디오 파일을 찾을 수 없습니다: {AUDIO_DIR}")

    if len(audio_files) == 1:
        print(f"\n자동 선택: {audio_files[0].name}")
        return audio_files[0]

    while True:
        choice = input("\n변환할 파일 번호를 선택하세요: ").strip()
        try:
            index = int(choice)
        except ValueError:
            print("숫자를 입력해 주세요.")
            continue

        if 1 <= index <= len(audio_files):
            return audio_files[index - 1]

        print(f"1~{len(audio_files)} 사이 번호를 입력해 주세요.")


def resolve_audio_input(input_arg: Path | None) -> Path:
    """CLI 인수나 대화식 선택으로 오디오 입력 경로를 확정함."""
    if input_arg is not None:
        audio_path = input_arg.expanduser().resolve()
        if not audio_path.exists():
            raise FileNotFoundError(f"입력 오디오 파일을 찾을 수 없습니다: {audio_path}")
        if audio_path.suffix.lower() not in SUPPORTED_FORMATS:
            raise ValueError(f"Whisper 미지원 확장자입니다: {audio_path.suffix}")
        return audio_path

    audio_files = find_audio_files(AUDIO_DIR)
    print_audio_files(audio_files)
    return select_audio_file(audio_files)


def transcribe_korean(client: OpenAI, audio_path: Path) -> str:
    """Whisper로 오디오를 한국어 텍스트로 전사함."""
    print(f"\n1. 한국어 전사 생성 중: {audio_path.name}")
    with audio_path.open("rb") as audio_file:
        # OpenAI Whisper API를 호출하여 오디오를 텍스트로 변환함
        transcription = client.audio.transcriptions.create(
            model=MODEL_ID,
            file=audio_file,
            language="ko",
            response_format="json",
        )
    return transcription.text.strip()


def translate_english(client: OpenAI, audio_path: Path) -> str:
    """Whisper로 오디오를 영어로 직접 번역함."""
    print("2. 영문 번역 생성 중")
    with audio_path.open("rb") as audio_file:
        # Whisper translation API: 오디오를 영어로 직접 번역함 (전사 후 번역 아님)
        translation = client.audio.translations.create(
            model=MODEL_ID,
            file=audio_file,
            response_format="json",
        )
    return translation.text.strip()


def save_result(
    output_path: Path,
    audio_path: Path,
    korean_text: str,
    english_text: str,
) -> None:
    """한국어 전사 결과와 영문 번역을 텍스트 파일로 저장함."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    content = f"""OpenAI Whisper STT Result
Generated At: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
Model: {MODEL_ID}
Audio File: {audio_path.name}

## 한국어 전사
{korean_text}

## English Translation
{english_text}
"""
    output_path.write_text(content, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    """커맨드라인 인수를 파싱함."""
    parser = argparse.ArgumentParser(description="OpenAI Whisper STT example")
    parser.add_argument(
        "--input",
        type=Path,
        default=None,
        help="입력 오디오 파일 경로. 생략하면 audio 디렉터리에서 선택합니다.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"출력 파일 경로. 기본값: {DEFAULT_OUTPUT}",
    )
    return parser.parse_args()


def main() -> int:
    """Whisper 전사 및 번역 워크플로우를 실행함."""
    args = parse_args()
    output_path = args.output.expanduser().resolve()

    try:
        audio_path = resolve_audio_input(args.input)
        client = load_openai_client(ENV_PATH)
        korean_text = transcribe_korean(client, audio_path)
        english_text = translate_english(client, audio_path)
        save_result(output_path, audio_path, korean_text, english_text)
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print("\n완료")
    print(f"- 입력 파일: {audio_path}")
    print(f"- 출력 파일: {output_path}")
    return 0


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    raise SystemExit(main())
