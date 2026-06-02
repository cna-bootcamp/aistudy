"""Gemini 직접 오디오 처리 기반 화자 분리 예제.

Gemini 2.5 Flash 모델에 오디오 파일을 직접 전달하여
한국어 전사와 화자 분리를 동시에 수행함.
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
from typing import TypedDict

import pandas as pd
from dotenv import load_dotenv
from google import genai
from google.genai import types


MODEL_NAME = "gemini-2.5-flash"
ENV_KEY = "GEMINI_API_KEY"
BYTES_PER_MB = 1024 * 1024
INLINE_AUDIO_LIMIT_MB = 20
MAX_OUTPUT_TOKENS = 8192
MAX_SAMPLE_TEXT_LENGTH = 70

SUPPORTED_EXTENSIONS = {
    ".aac",
    ".aiff",
    ".flac",
    ".m4a",
    ".mp3",
    ".ogg",
    ".wav",
}

MIME_TYPES = {
    ".aac": "audio/aac",
    ".aiff": "audio/aiff",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mp3",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
}

TRANSCRIPT_LINE_RE = re.compile(
    r"^\[(?P<timestamp>\d{1,2}:\d{2})\]\s*"
    r"(?P<speaker>화자\s*[가-힣A-Za-z0-9]+)\s*:\s*(?P<text>.+?)\s*$"
)

DIARIZATION_PROMPT = """다음 오디오를 한국어 대화록으로 전사하고 화자를 분리하세요.

[요구사항]
1. 서로 다른 화자는 첫 등장 순서대로 화자A, 화자B, 화자C처럼 일관되게 표시하세요.
2. 각 발화는 반드시 [MM:SS] 화자X: 텍스트 형식으로만 출력하세요.
3. 설명, 요약, 제목, 마크다운, 코드블록은 출력하지 마세요.
4. 감탄사, 추임새, 짧은 대답, 말더듬, 웃음 등 자연스러운 발화를 가능한 한 포함하세요.
5. 의미가 바뀌지 않도록 과도하게 다듬지 말고 실제 들리는 대화에 가깝게 적으세요.
6. 이름을 추정하지 말고 반드시 화자A, 화자B 같은 라벨만 사용하세요.

[출력 예시]
[00:00] 화자A: 여보세요?
[00:02] 화자B: 어, 지금 어디야?

오디오 전체를 빠짐없이 전사하세요."""


class Segment(TypedDict):
    """파싱된 대화록 세그먼트 구조."""

    id: int
    timestamp: str
    speaker: str
    text: str


@dataclass(frozen=True)
class Paths:
    """이 예제에서 사용하는 기본 경로 묶음."""

    script_dir: Path
    stt_dir: Path
    env_path: Path
    input_path: Path
    output_dir: Path


def default_paths() -> Paths:
    """이 파일 위치를 기준으로 기본 경로를 생성하여 반환함."""
    # 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
    script_dir = Path(__file__).resolve().parent
    stt_dir = script_dir.parent.parent
    return Paths(
        script_dir=script_dir,
        stt_dir=stt_dir,
        env_path=stt_dir.parent / ".env",
        input_path=stt_dir / "audio" / "phone-with-wife.mp3",
        output_dir=script_dir,
    )


def parse_args() -> argparse.Namespace:
    """커맨드라인 인수를 파싱함."""
    paths = default_paths()
    parser = argparse.ArgumentParser(
        description="Gemini 2.5 Flash 직접 오디오 처리 기반 화자 분리 음성 인식 예제"
    )
    parser.add_argument(
        "--input",
        default=str(paths.input_path),
        help="입력 오디오 파일 경로",
    )
    parser.add_argument(
        "--output-dir",
        default=str(paths.output_dir),
        help="결과 파일을 저장할 디렉터리",
    )
    parser.add_argument(
        "--name-map",
        default="",
        help='비대화식 화자 이름 매핑. 예: "화자A=아내,화자B=남편"',
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="이름 입력을 묻지 않고 기본 화자 라벨을 유지",
    )
    parser.add_argument(
        "--env",
        default=str(paths.env_path),
        help="GEMINI_API_KEY를 읽을 .env 파일 경로",
    )
    return parser.parse_args()


def load_api_key(env_path: Path) -> str:
    """.env 파일에서 GEMINI_API_KEY를 읽어 반환함."""
    if env_path.exists():
        # .env 파일에서 API 키 등 환경변수를 로드함
        load_dotenv(env_path)

    api_key = os.getenv(ENV_KEY)
    if not api_key:
        raise RuntimeError(
            f"{ENV_KEY}가 설정되지 않았습니다. {env_path} 파일 또는 환경 변수에 값을 설정하세요."
        )
    return api_key


def get_mime_type(audio_path: Path) -> str:
    """파일 확장자에 대응하는 MIME 타입 문자열을 반환함."""
    return MIME_TYPES.get(audio_path.suffix.lower(), "audio/mp3")


def validate_audio_file(audio_path: Path) -> None:
    """오디오 파일 경로의 존재 여부와 지원 형식을 검증함."""
    if not audio_path.exists():
        raise FileNotFoundError(f"오디오 파일을 찾을 수 없습니다: {audio_path}")
    if not audio_path.is_file():
        raise ValueError(f"오디오 파일 경로가 아닙니다: {audio_path}")
    if audio_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise ValueError(f"지원하지 않는 오디오 형식입니다: {audio_path.suffix} (지원: {supported})")


def transcribe_with_gemini(audio_path: Path, api_key: str) -> str:
    """Gemini 모델에 오디오를 직접 전달하여 화자 분리 전사 결과를 반환함."""
    client = genai.Client(api_key=api_key)
    mime_type = get_mime_type(audio_path)
    file_size_mb = audio_path.stat().st_size / BYTES_PER_MB

    print("[1/3] Gemini 직접 오디오 처리 요청 준비")
    print(f"  입력 파일: {audio_path}")
    print(f"  MIME: {mime_type}")
    print(f"  모델: {MODEL_NAME}")

    try:
        if file_size_mb <= INLINE_AUDIO_LIMIT_MB:
            with open(audio_path, "rb") as audio_file:
                audio_part = types.Part.from_bytes(
                    data=audio_file.read(),
                    mime_type=mime_type,
                )
            contents = [DIARIZATION_PROMPT, audio_part]
        else:
            print("  20MB 초과 파일이므로 Gemini Files API 업로드 방식 사용")
            uploaded_file = client.files.upload(file=str(audio_path))
            contents = [DIARIZATION_PROMPT, uploaded_file]

        print("[2/3] Gemini 응답 생성 중")
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=MAX_OUTPUT_TOKENS,
            ),
        )
    except Exception as exc:
        raise RuntimeError(f"Gemini API 호출 실패: {exc}") from exc

    response_text = (response.text or "").strip()
    if not response_text:
        raise RuntimeError("Gemini API 응답에 텍스트가 없습니다.")
    return response_text


def parse_transcript(response_text: str) -> list[Segment]:
    """응답 텍스트에서 `[MM:SS] 화자X: 텍스트` 형식의 행만 파싱하여 반환함."""
    segments: list[Segment] = []
    for raw_line in response_text.splitlines():
        line = raw_line.strip()
        match = TRANSCRIPT_LINE_RE.match(line)
        if not match:
            continue

        segments.append(
            {
                "id": len(segments) + 1,
                "timestamp": normalize_timestamp(match.group("timestamp")),
                "speaker": normalize_speaker(match.group("speaker")),
                "text": match.group("text"),
            }
        )

    if not segments:
        raise RuntimeError("AI 응답에서 '[MM:SS] 화자X: 텍스트' 형식의 발화를 찾지 못했습니다.")
    return segments


def normalize_timestamp(timestamp: str) -> str:
    """M:SS 형태의 타임스탬프를 MM:SS 형식으로 정규화함."""
    minutes, seconds = timestamp.split(":")
    return f"{int(minutes):02d}:{int(seconds):02d}"


def normalize_speaker(speaker: str) -> str:
    """화자 라벨에서 공백을 제거하여 정규화함."""
    return re.sub(r"\s+", "", speaker)


def parse_name_map(name_map_text: str) -> dict[str, str]:
    """`화자A=아내,화자B=남편` 형태의 텍스트를 딕셔너리로 파싱함."""
    if not name_map_text.strip():
        return {}

    mapping: dict[str, str] = {}
    for item in name_map_text.split(","):
        item = item.strip()
        if not item:
            continue
        if "=" not in item:
            raise ValueError(f"--name-map 항목 형식이 잘못되었습니다: {item}")

        speaker, name = item.split("=", 1)
        speaker = speaker.strip()
        name = name.strip()
        if not speaker:
            raise ValueError(f"--name-map 항목에 화자 라벨이 없습니다: {item}")
        mapping[speaker] = name or speaker

    return mapping


def collect_speaker_samples(segments: list[Segment], max_count: int = 2) -> dict[str, list[str]]:
    """화자별 샘플 발화를 최대 max_count개씩 수집하여 반환함."""
    samples: dict[str, list[str]] = {}
    for segment in segments:
        speaker = segment["speaker"]
        samples.setdefault(speaker, [])
        if len(samples[speaker]) >= max_count:
            continue

        text = segment["text"]
        if len(text) > MAX_SAMPLE_TEXT_LENGTH:
            text = f"{text[:MAX_SAMPLE_TEXT_LENGTH]}..."
        samples[speaker].append(text)

    return samples


def get_speaker_name_mapping(
    segments: list[Segment],
    preset_mapping: dict[str, str],
    yes: bool,
) -> dict[str, str]:
    """화자 샘플을 출력하고, yes 모드가 아니면 실제 이름을 대화식으로 입력받음."""
    speakers = sorted({segment["speaker"] for segment in segments})
    samples = collect_speaker_samples(segments)
    name_mapping = {speaker: preset_mapping.get(speaker, speaker) for speaker in speakers}

    print("\n[화자별 샘플 발화]")
    for speaker in speakers:
        print(f"- {speaker}")
        for sample in samples.get(speaker, []):
            print(f"  - {sample}")

    if yes:
        print("\n--yes 옵션으로 이름 입력을 생략합니다.")
        return name_mapping

    unmapped_speakers = [speaker for speaker in speakers if speaker not in preset_mapping]
    if not unmapped_speakers:
        print("\n--name-map에 모든 화자가 지정되어 이름 입력을 생략합니다.")
        return name_mapping

    print("\n[실제 이름 입력]")
    print("Enter를 누르면 기본 화자 라벨을 유지합니다.")
    for speaker in unmapped_speakers:
        current = name_mapping[speaker]
        name = input(f"{speaker} 실제 이름 [{current}]: ").strip()
        if name:
            name_mapping[speaker] = name

    return name_mapping


def apply_speaker_names(segments: list[Segment], name_mapping: dict[str, str]) -> list[Segment]:
    """세그먼트에 실제 화자 이름을 적용하여 새 목록을 반환함."""
    renamed_segments: list[Segment] = []
    for segment in segments:
        renamed_segments.append(
            {
                "id": segment["id"],
                "timestamp": segment["timestamp"],
                "speaker": name_mapping.get(segment["speaker"], segment["speaker"]),
                "text": segment["text"],
            }
        )
    return renamed_segments


def format_segments(segments: list[Segment]) -> str:
    """세그먼트 목록을 대화록 텍스트 형식으로 변환함."""
    return "\n".join(
        f"[{segment['timestamp']}] {segment['speaker']}: {segment['text']}"
        for segment in segments
    )


def save_results(
    raw_response: str,
    original_segments: list[Segment],
    final_segments: list[Segment],
    name_mapping: dict[str, str],
    audio_path: Path,
    output_dir: Path,
) -> tuple[Path, Path, Path]:
    """TXT, CSV, JSON 결과 파일을 저장하고 저장 경로를 반환함."""
    output_dir.mkdir(parents=True, exist_ok=True)

    txt_path = output_dir / "result.txt"
    csv_path = output_dir / "result_chunks.csv"
    json_path = output_dir / "result.json"

    created_at = datetime.now().isoformat(timespec="seconds")

    txt_content = "\n".join(
        [
            "# Gemini LLM 화자 분리 음성 인식 결과",
            "",
            f"- 생성 시각: {created_at}",
            f"- 입력 파일: {audio_path}",
            f"- 모델: {MODEL_NAME}",
            "",
            "## 원본 변환 결과",
            "",
            raw_response.strip(),
            "",
            "## 파싱된 원본 대화록",
            "",
            format_segments(original_segments),
            "",
            "## 이름 반영 최종 대화록",
            "",
            format_segments(final_segments),
            "",
        ]
    )
    txt_path.write_text(txt_content, encoding="utf-8")

    df = pd.DataFrame(final_segments, columns=["id", "timestamp", "speaker", "text"])
    df.to_csv(csv_path, index=False, encoding="utf-8-sig", sep="|")

    payload = {
        "created_at": created_at,
        "audio_file": str(audio_path),
        "model": MODEL_NAME,
        "speaker_name_map": name_mapping,
        "segments": final_segments,
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    return txt_path, csv_path, json_path


def main() -> None:
    """Gemini 화자 분리 워크플로우를 실행함."""
    args = parse_args()
    audio_path = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    env_path = Path(args.env).expanduser().resolve()

    try:
        validate_audio_file(audio_path)
        api_key = load_api_key(env_path)
        preset_mapping = parse_name_map(args.name_map)

        raw_response = transcribe_with_gemini(audio_path, api_key)
        original_segments = parse_transcript(raw_response)

        print("[3/3] 응답 파싱 완료")
        print(f"  파싱된 발화 수: {len(original_segments)}")

        name_mapping = get_speaker_name_mapping(original_segments, preset_mapping, args.yes)
        final_segments = apply_speaker_names(original_segments, name_mapping)
        txt_path, csv_path, json_path = save_results(
            raw_response=raw_response,
            original_segments=original_segments,
            final_segments=final_segments,
            name_mapping=name_mapping,
            audio_path=audio_path,
            output_dir=output_dir,
        )
    except KeyboardInterrupt:
        print("\n사용자가 작업을 중단했습니다.")
        sys.exit(130)
    except Exception as exc:
        print(f"\n오류: {exc}", file=sys.stderr)
        sys.exit(1)

    print("\n[이름 반영 최종 대화록]")
    print(format_segments(final_segments))
    print("\n[결과 파일]")
    print(f"- TXT: {txt_path}")
    print(f"- CSV: {csv_path}")
    print(f"- JSON: {json_path}")


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
