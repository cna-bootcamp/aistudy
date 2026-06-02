"""Whisper STT 후 Claude LLM으로 화자 분리를 수행하는 예제.

Claude는 오디오를 직접 처리할 수 없으므로, OpenAI Whisper로 먼저
타임스탬프 포함 전사를 수행한 뒤 Claude에게 화자 분리를 요청함.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, TypedDict


# Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
SCRIPT_DIR = Path(__file__).resolve().parent
STT_DIR = SCRIPT_DIR.parents[1]
HANDS_ON_DIR = STT_DIR.parent
AUDIO_DIR = STT_DIR / "audio"
ENV_PATH = HANDS_ON_DIR / ".env"

WHISPER_MODEL = "whisper-1"
CLAUDE_MODEL = "claude-opus-4-7"
MAX_OUTPUT_TOKENS = 8192
MAX_SAMPLE_TEXT_LENGTH = 80

SUPPORTED_FORMATS = {
    ".aac",
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

DIARIZED_LINE_PATTERN = re.compile(
    r"^\[(?P<timestamp>\d{1,3}:\d{2})\]\s*"
    r"(?P<speaker>화자\s*[A-Za-z0-9가-힣]+)\s*:\s*"
    r"(?P<text>.+?)\s*$"
)


class SegmentDict(TypedDict):
    """파싱된 대화록 행 구조."""

    id: int
    timestamp: str
    speaker: str
    text: str


@dataclass(frozen=True)
class WhisperSegment:
    """Whisper 세그먼트: 시작 시각과 텍스트를 포함함."""

    start: float
    end: float
    text: str

    @property
    def timestamp(self) -> str:
        return format_timestamp(self.start)


def format_timestamp(seconds: float) -> str:
    """초 단위 시각을 MM:SS 형식 문자열로 변환함."""
    total_seconds = max(0, int(seconds))
    minutes, seconds_part = divmod(total_seconds, 60)
    return f"{minutes:02d}:{seconds_part:02d}"


def normalize_timestamp(timestamp: str) -> str:
    """M:SS 형태의 타임스탬프를 MM:SS 형식으로 정규화함."""
    minute_text, second_text = timestamp.split(":", 1)
    minutes = int(minute_text)
    seconds = int(second_text)
    return f"{minutes:02d}:{seconds:02d}"


def normalize_speaker_label(label: str) -> str:
    """'화자 A'처럼 공백이 포함된 화자 라벨을 '화자A' 형식으로 정규화함."""
    label = re.sub(r"\s+", "", label.strip())
    if label.startswith("화자"):
        return "화자" + label[2:].upper()
    return label


def read_field(value: Any, field_name: str, default: Any = None) -> Any:
    """dict, pydantic 모델, 일반 객체에서 공통으로 필드 값을 읽어 반환함."""
    if isinstance(value, dict):
        return value.get(field_name, default)
    return getattr(value, field_name, default)


def require_package(import_name: str, install_name: str) -> Any:
    """패키지를 임포트하고 없으면 설치 안내 메시지와 함께 예외를 발생시킴."""
    try:
        return __import__(import_name)
    except ImportError as exc:
        raise RuntimeError(
            f"{install_name} 패키지가 설치되지 않았습니다. "
            f"`python -m pip install -r requirements.txt` 실행 필요"
        ) from exc


def find_audio_files(audio_dir: Path) -> list[Path]:
    """공용 audio 디렉터리에서 지원 형식의 오디오 파일 목록을 반환함."""
    if not audio_dir.exists():
        return []

    return sorted(
        path
        for path in audio_dir.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_FORMATS
    )


def resolve_audio_input(input_path: Path | None) -> Path:
    """CLI 입력이 없으면 audio 디렉터리 첫 번째 지원 파일을 자동 선택함."""
    if input_path is not None:
        audio_path = input_path.expanduser().resolve()
    else:
        audio_files = find_audio_files(AUDIO_DIR)
        if not audio_files:
            raise FileNotFoundError(f"오디오 파일을 찾을 수 없습니다: {AUDIO_DIR}")
        audio_path = audio_files[0].resolve()
        print(f"입력 파일 자동 선택: {audio_path.name}")

    if not audio_path.exists():
        raise FileNotFoundError(f"오디오 파일을 찾을 수 없습니다: {audio_path}")
    if not audio_path.is_file():
        raise ValueError(f"파일이 아닙니다: {audio_path}")
    if audio_path.suffix.lower() not in SUPPORTED_FORMATS:
        raise ValueError(f"지원하지 않는 오디오 형식입니다: {audio_path.suffix}")
    return audio_path


def load_api_keys(env_path: Path) -> tuple[str, str]:
    """hands-on/.env에서 CLAUDE_API_KEY와 OPENAI_API_KEY를 읽어 반환함."""
    dotenv = require_package("dotenv", "python-dotenv")
    if not env_path.exists():
        raise FileNotFoundError(f".env 파일을 찾을 수 없습니다: {env_path}")

    # .env 파일에서 API 키 등 환경변수를 로드함
    dotenv.load_dotenv(env_path)
    claude_key = os.getenv("CLAUDE_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")

    missing = []
    if not claude_key:
        missing.append("CLAUDE_API_KEY")
    if not openai_key:
        missing.append("OPENAI_API_KEY")
    if missing:
        raise RuntimeError(f"{', '.join(missing)} 값이 .env에 없습니다: {env_path}")

    return claude_key, openai_key


def transcribe_with_whisper(audio_path: Path, api_key: str) -> list[WhisperSegment]:
    """Whisper STT를 실행하여 타임스탬프가 포함된 세그먼트 목록을 반환함."""
    openai_module = require_package("openai", "openai")
    client = openai_module.OpenAI(api_key=api_key)

    print(f"[1/3] Whisper STT 실행: {audio_path.name}")
    with audio_path.open("rb") as audio_file:
        # OpenAI Whisper API를 호출하여 오디오를 텍스트로 변환함
        response = client.audio.transcriptions.create(
            model=WHISPER_MODEL,
            file=audio_file,
            language="ko",
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )

    segments = extract_whisper_segments(response)
    if not segments:
        raise RuntimeError("Whisper 응답에서 segment 타임스탬프를 찾지 못했습니다.")

    print(f"Whisper segment 수: {len(segments)}")
    return segments


def extract_whisper_segments(response: Any) -> list[WhisperSegment]:
    """OpenAI SDK 응답에서 세그먼트 객체를 추출하여 반환함."""
    raw_segments = read_field(response, "segments")
    if raw_segments is None and hasattr(response, "model_dump"):
        raw_segments = response.model_dump().get("segments")

    segments: list[WhisperSegment] = []
    for raw_segment in raw_segments or []:
        text = str(read_field(raw_segment, "text", "")).strip()
        if not text:
            continue

        start = float(read_field(raw_segment, "start", 0.0) or 0.0)
        end = float(read_field(raw_segment, "end", start) or start)
        segments.append(WhisperSegment(start=start, end=end, text=text))

    return segments


def format_whisper_segments(segments: list[WhisperSegment]) -> str:
    """Whisper 세그먼트를 Claude 프롬프트용 텍스트 형식으로 변환함."""
    return "\n".join(f"[{segment.timestamp}] {segment.text}" for segment in segments)


def build_diarization_prompt(whisper_text: str) -> str:
    """화자 분리를 요청하는 한국어 Claude 프롬프트를 생성함."""
    return f"""아래는 OpenAI Whisper가 생성한 한국어 STT 결과입니다.
Claude는 오디오를 직접 들을 수 없으므로, 아래 segment 타임스탬프와 문맥만 사용하여 화자를 분리하세요.

[Whisper STT 결과]
{whisper_text}

[작업 지시]
1. 대화의 말투, 호칭, 응답 흐름, 문맥을 근거로 화자를 구분하세요.
2. 화자는 반드시 화자A, 화자B, 화자C처럼 표시하세요.
3. 같은 사람은 처음부터 끝까지 같은 화자 라벨을 유지하세요.
4. 각 발화의 시작 타임스탬프는 입력 segment의 [MM:SS] 값을 활용하세요.
5. 자연스러운 대화를 위해 감탄사, 추임새, 짧은 반응도 삭제하지 말고 포함하세요.
6. STT 오류로 보이는 부분은 문맥상 최소한으로만 다듬고, 의미를 새로 만들지 마세요.

[출력 규칙]
- 출력은 오직 `[MM:SS] 화자X: 텍스트` 형식의 행만 작성하세요.
- 설명, 요약, 제목, 코드블록, 목록 기호, 주석은 절대 출력하지 마세요.
- 확실하지 않은 발화도 가장 가능성이 높은 화자로 배정하세요.

[출력 예시]
[00:00] 화자A: 어, 여보세요.
[00:02] 화자B: 응, 지금 어디야?
[00:04] 화자A: 아, 나 거의 다 왔어."""


def diarize_with_claude(whisper_text: str, api_key: str) -> str:
    """Claude API를 호출하여 Whisper 전사 결과에 화자 분리를 수행함."""
    anthropic_module = require_package("anthropic", "anthropic")
    client = anthropic_module.Anthropic(api_key=api_key)

    print(f"[2/3] Claude 화자 분리 실행: {CLAUDE_MODEL}")
    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=MAX_OUTPUT_TOKENS,
        system=(
            "당신은 한국어 전화 통화 전사와 화자 분리 전문가입니다. "
            "반드시 사용자가 지정한 출력 형식만 반환합니다."
        ),
        messages=[
            {
                "role": "user",
                "content": build_diarization_prompt(whisper_text),
            }
        ],
    )

    text_parts: list[str] = []
    for content_block in message.content:
        block_text = getattr(content_block, "text", "")
        if block_text:
            text_parts.append(block_text)

    transcript = "\n".join(text_parts).strip()
    if not transcript:
        raise RuntimeError("Claude 응답이 비어 있습니다.")
    return transcript


def parse_diarized_transcript(transcript: str) -> list[SegmentDict]:
    """`[MM:SS] 화자X: 텍스트` 형식의 행만 파싱하여 세그먼트 목록을 반환함."""
    segments: list[SegmentDict] = []

    for raw_line in transcript.splitlines():
        line = raw_line.strip()
        match = DIARIZED_LINE_PATTERN.match(line)
        if not match:
            continue

        text = match.group("text").strip()
        if not text:
            continue

        segments.append(
            {
                "id": len(segments) + 1,
                "timestamp": normalize_timestamp(match.group("timestamp")),
                "speaker": normalize_speaker_label(match.group("speaker")),
                "text": text,
            }
        )

    if not segments:
        raise RuntimeError(
            "Claude 응답에서 `[MM:SS] 화자X: 텍스트` 형식의 행을 찾지 못했습니다."
        )
    return segments


def render_segments(segments: list[SegmentDict]) -> str:
    """파싱된 세그먼트를 대화록 텍스트 형식으로 변환함."""
    return "\n".join(
        f"[{segment['timestamp']}] {segment['speaker']}: {segment['text']}"
        for segment in segments
    )


def collect_speaker_samples(segments: list[SegmentDict]) -> dict[str, list[str]]:
    """화자별 샘플 발화를 최대 3개씩 수집하여 반환함."""
    samples: dict[str, list[str]] = {}
    for segment in segments:
        speaker = segment["speaker"]
        samples.setdefault(speaker, [])
        if len(samples[speaker]) >= 3:
            continue

        text = segment["text"]
        if len(text) > MAX_SAMPLE_TEXT_LENGTH:
            text = text[:MAX_SAMPLE_TEXT_LENGTH] + "..."
        samples[speaker].append(text)
    return samples


def parse_name_map(name_map_text: str | None) -> dict[str, str]:
    """`화자A=아내,화자B=남편` 형태의 CLI 텍스트를 딕셔너리로 파싱함."""
    if not name_map_text:
        return {}

    mapping: dict[str, str] = {}
    for item in name_map_text.split(","):
        item = item.strip()
        if not item:
            continue
        if "=" not in item:
            raise ValueError(f"--name-map 항목에 '='가 없습니다: {item}")

        label, name = item.split("=", 1)
        label = normalize_speaker_label(label)
        name = name.strip()
        if not label or not name:
            raise ValueError(f"--name-map 항목이 비어 있습니다: {item}")
        mapping[label] = name
    return mapping


def choose_speaker_names(
    segments: list[SegmentDict],
    predefined_names: dict[str, str],
    interactive: bool,
) -> dict[str, str]:
    """화자 샘플 발화를 보여 주고 실제 이름을 입력받거나 기본 라벨을 유지함."""
    samples = collect_speaker_samples(segments)
    speakers = sorted(samples)

    print("\n[화자별 샘플 발화]")
    for speaker in speakers:
        print(f"- {speaker}")
        for sample in samples[speaker]:
            print(f"  - {sample}")

    if not interactive:
        mapping = {
            speaker: predefined_names.get(speaker, speaker)
            for speaker in speakers
        }
        unknown = sorted(set(predefined_names) - set(speakers))
        if unknown:
            print(f"참고: 결과에 없는 화자 라벨은 무시합니다: {', '.join(unknown)}")
        return mapping

    print("\n실제 이름을 입력하세요. Enter를 누르면 기본 화자 라벨을 유지합니다.")
    mapping: dict[str, str] = {}
    for speaker in speakers:
        default_name = predefined_names.get(speaker, speaker)
        prompt = f"{speaker} 이름 [{default_name}]: "
        entered_name = input(prompt).strip()
        mapping[speaker] = entered_name or default_name
    return mapping


def apply_speaker_names(
    segments: list[SegmentDict],
    name_mapping: dict[str, str],
) -> list[SegmentDict]:
    """파싱된 세그먼트에 실제 화자 이름을 적용하여 반환함."""
    return [
        {
            "id": segment["id"],
            "timestamp": segment["timestamp"],
            "speaker": name_mapping.get(segment["speaker"], segment["speaker"]),
            "text": segment["text"],
        }
        for segment in segments
    ]


def save_results(
    output_dir: Path,
    audio_path: Path,
    raw_claude_transcript: str,
    parsed_segments: list[SegmentDict],
    final_segments: list[SegmentDict],
    name_mapping: dict[str, str],
) -> tuple[Path, Path, Path]:
    """TXT, CSV, JSON 결과 파일을 저장하고 저장 경로를 반환함."""
    pandas_module = require_package("pandas", "pandas")
    output_dir.mkdir(parents=True, exist_ok=True)

    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    parsed_transcript = render_segments(parsed_segments)
    final_transcript = render_segments(final_segments)

    txt_path = output_dir / "result.txt"
    txt_path.write_text(
        "\n".join(
            [
                "# Claude LLM 화자 분리 결과",
                "",
                f"- 생성 시각: {generated_at}",
                f"- 입력 오디오: {audio_path.name}",
                f"- Whisper 모델: {WHISPER_MODEL}",
                f"- Claude 모델: {CLAUDE_MODEL}",
                "",
                "## 원본 변환 결과",
                raw_claude_transcript.strip(),
                "",
                "## 파싱된 원본 대화록",
                parsed_transcript,
                "",
                "## 이름 반영 최종 대화록",
                final_transcript,
                "",
            ]
        ),
        encoding="utf-8",
    )

    csv_path = output_dir / "result_chunks.csv"
    pandas_module.DataFrame(final_segments).to_csv(
        csv_path,
        index=False,
        encoding="utf-8-sig",
        sep="|",
    )

    json_path = output_dir / "result.json"
    json_path.write_text(
        json.dumps(
            {
                "generated_at": generated_at,
                "audio_file": str(audio_path),
                "whisper_model": WHISPER_MODEL,
                "claude_model": CLAUDE_MODEL,
                "name_mapping": name_mapping,
                "segments": final_segments,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    return txt_path, csv_path, json_path


def parse_args() -> argparse.Namespace:
    """CLI 인수를 파싱함."""
    parser = argparse.ArgumentParser(
        description="Whisper STT 후 Claude로 화자 분리를 수행하는 예제"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=None,
        help="입력 오디오 파일 경로. 생략하면 hands-on/05.stt/audio의 첫 번째 파일 사용",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=SCRIPT_DIR,
        help="결과 파일을 저장할 디렉터리. 기본값은 현재 예제 디렉터리",
    )
    parser.add_argument(
        "--name-map",
        default=None,
        help='비대화식 이름 매핑. 예: "화자A=아내,화자B=남편"',
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="이름 입력을 생략하고 지정되지 않은 화자는 기본 라벨 유지",
    )
    return parser.parse_args()


def main() -> int:
    """Claude 화자 분리 워크플로우를 실행함."""
    args = parse_args()
    interactive_names = not args.yes and args.name_map is None

    try:
        audio_path = resolve_audio_input(args.input)
        output_dir = args.output_dir.expanduser().resolve()
        name_map = parse_name_map(args.name_map)

        claude_key, openai_key = load_api_keys(ENV_PATH)
        whisper_segments = transcribe_with_whisper(audio_path, openai_key)
        whisper_text = format_whisper_segments(whisper_segments)
        raw_claude_transcript = diarize_with_claude(whisper_text, claude_key)

        print("[3/3] Claude 응답 파싱 및 결과 저장")
        parsed_segments = parse_diarized_transcript(raw_claude_transcript)
        speaker_names = choose_speaker_names(
            parsed_segments,
            name_map,
            interactive=interactive_names,
        )
        final_segments = apply_speaker_names(parsed_segments, speaker_names)
        txt_path, csv_path, json_path = save_results(
            output_dir,
            audio_path,
            raw_claude_transcript,
            parsed_segments,
            final_segments,
            speaker_names,
        )

    except KeyboardInterrupt:
        print("\n사용자가 실행을 중단했습니다.", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print("\n완료")
    print(f"- result.txt: {txt_path}")
    print(f"- result_chunks.csv: {csv_path}")
    print(f"- result.json: {json_path}")
    return 0


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    raise SystemExit(main())
