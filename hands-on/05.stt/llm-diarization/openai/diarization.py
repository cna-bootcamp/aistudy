"""OpenAI 오디오 LLM 기반 화자 분리 예제.

MP3 파일을 base64로 인코딩하여 Chat Completions API의 input_audio로 전달하고,
오디오 모델이 한국어 화자 분리 전사 결과를 직접 생성함.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import TypedDict

import pandas as pd
from dotenv import load_dotenv
from openai import OpenAI


# Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
SCRIPT_DIR = Path(__file__).resolve().parent
LLM_DIARIZATION_DIR = SCRIPT_DIR.parent
STT_DIR = LLM_DIARIZATION_DIR.parent
HANDS_ON_DIR = STT_DIR.parent
AUDIO_DIR = STT_DIR / "audio"
ENV_PATH = HANDS_ON_DIR / ".env"

MODEL_ID = "gpt-audio-1.5"
AUDIO_FORMAT = "mp3"
MAX_FILE_SIZE_MB = 25
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
MAX_OUTPUT_TOKENS = 4096
MAX_SAMPLE_TEXT_LENGTH = 80

TRANSCRIPT_LINE_RE = re.compile(
    r"^\[(?P<timestamp>\d{2}:\d{2})\]\s*"
    r"(?P<speaker>화자[A-Z0-9가-힣]+)\s*:\s*"
    r"(?P<text>.+?)\s*$"
)

DIARIZATION_PROMPT = """첨부된 MP3 오디오를 듣고 한국어 화자 분리 음성 인식을 수행하세요.

[요구사항]
1. 실제 이름을 추정하지 말고 화자를 화자A, 화자B, 화자C 형식으로 구분하세요.
2. 각 발화는 시작 시간을 [MM:SS] 형식으로 표시하세요.
3. 감탄사, 추임새, 망설임, 짧은 대답도 자연스러운 발화로 포함하세요.
4. 전화 통화의 의미가 바뀌지 않도록 원문 발화를 최대한 빠짐없이 옮기세요.
5. 설명, 요약, 제목, 표, 코드블록은 출력하지 마세요.

[출력 형식]
[MM:SS] 화자A: 발화 내용
[MM:SS] 화자B: 발화 내용

위 출력 형식에 맞는 줄만 출력하세요."""


class Segment(TypedDict):
    """파싱된 화자 분리 세그먼트 구조."""

    id: int
    timestamp: str
    speaker: str
    text: str


def load_openai_client(env_path: Path) -> OpenAI:
    """OPENAI_API_KEY를 읽어 OpenAI 클라이언트를 생성함."""
    # .env 파일에서 API 키 등 환경변수를 로드함
    load_dotenv(env_path)
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(f"OPENAI_API_KEY가 설정되지 않았습니다: {env_path}")
    return OpenAI(api_key=api_key)


def find_audio_files(audio_dir: Path) -> list[Path]:
    """audio 디렉터리에서 MP3 파일 목록을 이름순으로 반환함."""
    if not audio_dir.exists():
        return []
    return sorted(
        path for path in audio_dir.iterdir() if path.is_file() and path.suffix.lower() == ".mp3"
    )


def validate_audio_file(audio_path: Path) -> None:
    """선택된 MP3 입력 파일의 유효성을 검증함."""
    if not audio_path.exists():
        raise FileNotFoundError(f"입력 오디오 파일을 찾을 수 없습니다: {audio_path}")
    if not audio_path.is_file():
        raise ValueError(f"입력 경로가 파일이 아닙니다: {audio_path}")
    if audio_path.suffix.lower() != ".mp3":
        raise ValueError("이 예제는 Chat Completions input_audio format='mp3' 전송만 지원합니다.")
    if audio_path.stat().st_size > MAX_FILE_SIZE_BYTES:
        size_mb = audio_path.stat().st_size / (1024 * 1024)
        raise ValueError(f"오디오 파일이 {MAX_FILE_SIZE_MB}MB를 초과합니다: {size_mb:.2f}MB")


def resolve_audio_input(input_arg: Path | None) -> Path:
    """CLI 인수가 없으면 공용 audio 디렉터리 첫 번째 MP3를 자동 선택함."""
    if input_arg is not None:
        audio_path = input_arg.expanduser().resolve()
        validate_audio_file(audio_path)
        return audio_path

    audio_files = find_audio_files(AUDIO_DIR)
    if not audio_files:
        raise FileNotFoundError(f"MP3 파일을 찾을 수 없습니다: {AUDIO_DIR}")

    audio_path = audio_files[0].resolve()
    validate_audio_file(audio_path)
    return audio_path


def encode_audio_base64(audio_path: Path) -> str:
    """오디오 파일을 읽어 base64 인코딩된 문자열로 반환함."""
    with audio_path.open("rb") as audio_file:
        return base64.b64encode(audio_file.read()).decode("utf-8")


def transcribe_with_openai_audio(
    client: OpenAI,
    audio_path: Path,
    max_output_tokens: int,
) -> str:
    """base64 MP3 오디오를 OpenAI 오디오 채팅 모델에 전달하여 전사 결과를 반환함."""
    audio_data = encode_audio_base64(audio_path)

    response = client.chat.completions.create(
        model=MODEL_ID,
        modalities=["text"],
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": DIARIZATION_PROMPT},
                    {
                        "type": "input_audio",
                        "input_audio": {
                            "data": audio_data,
                            "format": AUDIO_FORMAT,
                        },
                    },
                ],
            }
        ],
        max_tokens=max_output_tokens,
    )

    content = response.choices[0].message.content
    if isinstance(content, str) and content.strip():
        return content.strip()
    if isinstance(content, list):
        text_parts: list[str] = []
        for part in content:
            if isinstance(part, dict) and part.get("type") == "text":
                text_parts.append(str(part.get("text", "")))
            elif hasattr(part, "text"):
                text_parts.append(str(part.text))
        combined = "\n".join(part for part in text_parts if part.strip())
        if combined.strip():
            return combined.strip()
    raise RuntimeError("OpenAI 응답에서 텍스트 내용을 찾을 수 없습니다.")


def parse_transcript(raw_text: str) -> list[Segment]:
    """`[MM:SS] 화자X: 텍스트` 형식의 행만 파싱하고 그 외 줄은 무시함."""
    segments: list[Segment] = []
    for line in raw_text.splitlines():
        match = TRANSCRIPT_LINE_RE.match(line.strip())
        if not match:
            continue

        text = match.group("text").strip()
        if not text:
            continue

        segments.append(
            {
                "id": len(segments) + 1,
                "timestamp": match.group("timestamp"),
                "speaker": match.group("speaker"),
                "text": text,
            }
        )
    return segments


def parse_name_map(name_map_arg: str | None) -> dict[str, str]:
    """`화자A=이름,화자B=이름` 형태의 CLI 입력을 딕셔너리로 파싱함."""
    if not name_map_arg:
        return {}

    mapping: dict[str, str] = {}
    for item in name_map_arg.split(","):
        item = item.strip()
        if not item:
            continue
        if "=" not in item:
            raise ValueError(f"--name-map 항목은 '화자A=이름' 형식이어야 합니다: {item}")
        speaker, name = item.split("=", 1)
        speaker = speaker.strip()
        name = name.strip()
        if not speaker:
            raise ValueError(f"--name-map 화자 라벨이 비어 있습니다: {item}")
        mapping[speaker] = name or speaker
    return mapping


def speaker_sort_key(speaker: str) -> tuple[int, str]:
    """화자A, 화자B 순서로 정렬하기 위한 정렬 키를 반환함."""
    suffix = speaker.replace("화자", "", 1)
    if len(suffix) == 1 and "A" <= suffix <= "Z":
        return (ord(suffix) - ord("A"), speaker)
    return (100, speaker)


def collect_speaker_samples(segments: list[Segment]) -> dict[str, list[str]]:
    """화자별 샘플 발화를 최대 2개씩 수집하여 반환함."""
    samples: dict[str, list[str]] = {}
    for segment in segments:
        speaker = segment["speaker"]
        samples.setdefault(speaker, [])
        if len(samples[speaker]) >= 2:
            continue

        text = segment["text"]
        if len(text) > MAX_SAMPLE_TEXT_LENGTH:
            text = text[:MAX_SAMPLE_TEXT_LENGTH] + "..."
        samples[speaker].append(text)
    return samples


def collect_speaker_names(
    segments: list[Segment],
    provided_mapping: dict[str, str],
    non_interactive: bool,
) -> dict[str, str]:
    """화자 샘플을 보여 주고, 비대화식 모드가 아니면 실제 이름을 입력받음."""
    speakers = sorted({segment["speaker"] for segment in segments}, key=speaker_sort_key)
    samples = collect_speaker_samples(segments)
    name_mapping: dict[str, str] = {}

    print("\n[화자별 샘플 발화]")
    for speaker in speakers:
        print(f"- {speaker}")
        for index, sample in enumerate(samples.get(speaker, []), start=1):
            print(f"  {index}. {sample}")

    print("\n[화자 이름 입력]")
    print("Enter를 누르면 기본 화자 라벨을 유지합니다.")

    for speaker in speakers:
        if speaker in provided_mapping:
            name_mapping[speaker] = provided_mapping[speaker]
            print(f"- {speaker}: {provided_mapping[speaker]}")
            continue

        if non_interactive:
            name_mapping[speaker] = speaker
            print(f"- {speaker}: {speaker}")
            continue

        name = input(f"{speaker} 실제 이름(Enter={speaker}): ").strip()
        name_mapping[speaker] = name or speaker

    return name_mapping


def apply_speaker_names(segments: list[Segment], name_mapping: dict[str, str]) -> list[Segment]:
    """파싱된 세그먼트에 화자 표시 이름을 적용하여 반환함."""
    return [
        {
            "id": segment["id"],
            "timestamp": segment["timestamp"],
            "speaker": name_mapping.get(segment["speaker"], segment["speaker"]),
            "text": segment["text"],
        }
        for segment in segments
    ]


def format_segments(segments: list[Segment]) -> str:
    """세그먼트 목록을 대화록 텍스트 형식으로 변환함."""
    return "\n".join(
        f"[{segment['timestamp']}] {segment['speaker']}: {segment['text']}"
        for segment in segments
    )


def save_results(
    output_dir: Path,
    audio_path: Path,
    raw_transcript: str,
    parsed_segments: list[Segment],
    final_segments: list[Segment],
    name_mapping: dict[str, str],
) -> tuple[Path, Path, Path]:
    """원본 및 이름 반영 화자 분리 결과를 TXT, CSV, JSON으로 저장함."""
    output_dir.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    txt_path = output_dir / "result.txt"
    txt_content = f"""OpenAI LLM Diarization Result
Generated At: {generated_at}
Model: {MODEL_ID}
Audio File: {audio_path.name}

## 원본 변환 결과
{raw_transcript.strip()}

## 파싱된 원본 대화록
{format_segments(parsed_segments)}

## 이름 반영 최종 대화록
{format_segments(final_segments)}
"""
    txt_path.write_text(txt_content, encoding="utf-8")

    csv_path = output_dir / "result_chunks.csv"
    pd.DataFrame(final_segments).to_csv(csv_path, index=False, encoding="utf-8-sig", sep="|")

    json_path = output_dir / "result.json"
    json_data = {
        "generated_at": generated_at,
        "model": MODEL_ID,
        "audio_file": str(audio_path),
        "speaker_name_map": name_mapping,
        "segments": final_segments,
    }
    json_path.write_text(json.dumps(json_data, ensure_ascii=False, indent=2), encoding="utf-8")

    return txt_path, csv_path, json_path


def parse_args() -> argparse.Namespace:
    """CLI 인수를 파싱함."""
    parser = argparse.ArgumentParser(
        description="OpenAI gpt-audio-1.5 기반 LLM 화자 분리 음성 인식 예제"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=None,
        help="입력 MP3 파일 경로. 생략 시 hands-on/05.stt/audio의 첫 번째 MP3 사용",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=SCRIPT_DIR,
        help=f"결과 저장 디렉터리. 기본값: {SCRIPT_DIR}",
    )
    parser.add_argument(
        "--name-map",
        default=None,
        help='비대화식 이름 매핑. 예: "화자A=아내,화자B=남편"',
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="이름 입력을 건너뛰고 미지정 화자는 기본 라벨 유지",
    )
    parser.add_argument(
        "--max-output-tokens",
        type=int,
        default=MAX_OUTPUT_TOKENS,
        help=f"Chat Completions 최대 출력 토큰. 기본값: {MAX_OUTPUT_TOKENS}",
    )
    return parser.parse_args()


def main() -> int:
    """OpenAI 오디오 화자 분리 워크플로우를 실행함."""
    args = parse_args()
    output_dir = args.output_dir.expanduser().resolve()

    try:
        audio_path = resolve_audio_input(args.input)
        provided_mapping = parse_name_map(args.name_map)

        print("=" * 70)
        print("OpenAI LLM 화자 분리 음성 인식")
        print("=" * 70)
        print(f"- 모델: {MODEL_ID}")
        print(f"- 입력: {audio_path}")
        print(f"- 출력 디렉터리: {output_dir}")

        client = load_openai_client(ENV_PATH)

        print("\n[1/4] MP3 파일을 base64 input_audio로 전송 중")
        raw_transcript = transcribe_with_openai_audio(
            client=client,
            audio_path=audio_path,
            max_output_tokens=args.max_output_tokens,
        )

        print("\n[2/4] AI 원본 응답")
        print("-" * 70)
        print(raw_transcript)
        print("-" * 70)

        parsed_segments = parse_transcript(raw_transcript)
        if not parsed_segments:
            raise RuntimeError("AI 응답에서 '[MM:SS] 화자X: 텍스트' 형식의 줄을 찾지 못했습니다.")

        print(f"\n[3/4] 파싱된 발화 수: {len(parsed_segments)}")
        name_mapping = collect_speaker_names(
            segments=parsed_segments,
            provided_mapping=provided_mapping,
            non_interactive=args.yes,
        )
        final_segments = apply_speaker_names(parsed_segments, name_mapping)

        txt_path, csv_path, json_path = save_results(
            output_dir=output_dir,
            audio_path=audio_path,
            raw_transcript=raw_transcript,
            parsed_segments=parsed_segments,
            final_segments=final_segments,
            name_mapping=name_mapping,
        )

    except KeyboardInterrupt:
        print("\n사용자 요청으로 중단되었습니다.", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print("\n[4/4] 저장 완료")
    print(f"- TXT:  {txt_path}")
    print(f"- CSV:  {csv_path}")
    print(f"- JSON: {json_path}")
    return 0


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    raise SystemExit(main())
