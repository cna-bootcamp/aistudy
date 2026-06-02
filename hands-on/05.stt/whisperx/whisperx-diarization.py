"""WhisperX STT + 화자 분리 예제.

WhisperX로 단어 수준 타임스탬프를 정밀하게 생성하고,
pyannote 화자 분리로 각 단어에 화자를 배정함.
HF_TOKEN은 hands-on/05.stt/.env에 설정해야 함 (pyannote 모델 접근 필요).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv


# Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
SCRIPT_DIR = Path(__file__).resolve().parent
STT_DIR = SCRIPT_DIR.parent
AUDIO_DIR = STT_DIR / "audio"
ENV_PATH = STT_DIR.parent / ".env"

HF_TOKEN_GUIDE = """
[ERROR] HuggingFace Access Token(HF_TOKEN)이 설정되지 않았습니다.

아래 절차를 따라 토큰을 발급하고 등록하세요.

1. HuggingFace Access Token 발급
   https://huggingface.co/settings/tokens

2. 아래 두 모델의 사용 약관에 동의 (HuggingFace 로그인 필요)
   - https://huggingface.co/pyannote/speaker-diarization-3.1
   - https://huggingface.co/pyannote/segmentation-3.0

3. hands-on/.env 파일에 HF_TOKEN 등록
   HF_TOKEN=hf_xxxxxxxxxx
"""


def load_hf_token() -> str:
    """.env에서 HF_TOKEN을 읽어 반환하고, 없으면 안내 메시지 출력 후 종료함."""
    if ENV_PATH.exists():
        # .env 파일에서 API 키 등 환경변수를 로드함
        load_dotenv(ENV_PATH)

    token = os.getenv("HF_TOKEN")
    if not token:
        print(HF_TOKEN_GUIDE, file=sys.stderr)
        sys.exit(1)
    return token


def find_audio_files(audio_dir: Path) -> list[Path]:
    """audio 디렉터리에서 지원 형식의 오디오 파일 목록을 이름순으로 반환함."""
    supported = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".mp4", ".webm"}
    if not audio_dir.exists():
        return []
    return sorted(
        p for p in audio_dir.iterdir()
        if p.is_file() and p.suffix.lower() in supported
    )


def resolve_audio(input_arg: Path | None) -> Path:
    """CLI 인수나 audio 디렉터리 첫 번째 파일로 오디오 경로를 확정함."""
    if input_arg is not None:
        path = input_arg.expanduser().resolve()
        if not path.exists():
            raise FileNotFoundError(f"오디오 파일을 찾을 수 없습니다: {path}")
        return path

    files = find_audio_files(AUDIO_DIR)
    if not files:
        raise FileNotFoundError(f"오디오 파일이 없습니다: {AUDIO_DIR}")
    return files[0].resolve()


def detect_device() -> str:
    """CUDA 가용 여부를 자동 감지하여 디바이스 문자열을 반환함."""
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def to_serializable(obj: object) -> object:
    """numpy/torch 타입을 JSON 직렬화 가능한 Python 기본 타입으로 재귀 변환함."""
    try:
        import numpy as np
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
    except ImportError:
        pass
    if isinstance(obj, dict):
        return {k: to_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_serializable(v) for v in obj]
    return obj


def build_dialog_lines(result: dict) -> list[str]:
    """동일 화자의 연속 단어를 하나의 발화 줄로 묶어 대화록 행 목록을 반환함."""
    lines: list[str] = []
    current_speaker: str | None = None
    current_words: list[str] = []
    current_start: float = 0.0

    all_words: list[dict] = []
    for segment in result.get("segments", []):
        seg_speaker = segment.get("speaker", "UNKNOWN")
        words = segment.get("words", [])
        if not words:
            # 단어 정보가 없으면 세그먼트 전체를 단일 단어 항목으로 처리함
            all_words.append({
                "word": segment.get("text", "").strip(),
                "start": segment.get("start", 0.0),
                "speaker": seg_speaker,
            })
        else:
            for w in words:
                all_words.append({
                    "word": w.get("word", "").strip(),
                    "start": w.get("start", segment.get("start", 0.0)),
                    "speaker": w.get("speaker", seg_speaker),
                })

    for entry in all_words:
        speaker = entry.get("speaker", "UNKNOWN")
        word = entry.get("word", "")
        start = entry.get("start", 0.0)

        if speaker != current_speaker:
            if current_words and current_speaker is not None:
                mins, secs = divmod(int(current_start), 60)
                lines.append(f"[{mins:02d}:{secs:02d}] {current_speaker}: {' '.join(current_words)}")
            current_speaker = speaker
            current_words = [word] if word else []
            current_start = start
        else:
            if word:
                current_words.append(word)

    if current_words and current_speaker is not None:
        mins, secs = divmod(int(current_start), 60)
        lines.append(f"[{mins:02d}:{secs:02d}] {current_speaker}: {' '.join(current_words)}")

    return lines


def build_chunks_df(result: dict) -> pd.DataFrame:
    """화자 분리 결과에서 세그먼트 및 단어 수준 DataFrame을 생성하여 반환함."""
    rows: list[dict] = []
    for seg_idx, segment in enumerate(result.get("segments", [])):
        seg_speaker = segment.get("speaker", "UNKNOWN")
        seg_start = float(segment.get("start", 0.0))
        seg_end = float(segment.get("end", 0.0))

        rows.append({
            "type": "segment",
            "segment_id": seg_idx + 1,
            "word_id": "",
            "speaker": seg_speaker,
            "start": round(seg_start, 3),
            "end": round(seg_end, 3),
            "duration": round(seg_end - seg_start, 3),
            "text": segment.get("text", "").strip(),
        })

        for word_idx, word_info in enumerate(segment.get("words", [])):
            w_start = float(word_info.get("start", seg_start))
            w_end = float(word_info.get("end", seg_end))
            rows.append({
                "type": "word",
                "segment_id": seg_idx + 1,
                "word_id": word_idx + 1,
                "speaker": word_info.get("speaker", seg_speaker),
                "start": round(w_start, 3),
                "end": round(w_end, 3),
                "duration": round(w_end - w_start, 3),
                "text": word_info.get("word", "").strip(),
            })

    return pd.DataFrame(rows)


def build_rttm_lines(result: dict, file_id: str) -> list[str]:
    """화자 분리 세그먼트에서 RTTM 형식 행 목록을 생성하여 반환함."""
    lines: list[str] = []
    for segment in result.get("segments", []):
        speaker = segment.get("speaker", "UNKNOWN")
        start = float(segment.get("start", 0.0))
        end = float(segment.get("end", 0.0))
        duration = end - start
        if duration <= 0:
            continue
        lines.append(
            f"SPEAKER {file_id} 1 {start:.3f} {duration:.3f} <NA> <NA> {speaker} <NA> <NA>"
        )
    return lines


def save_outputs(output_dir: Path, audio_path: Path, result: dict) -> None:
    """result.json, result_dialog.txt, result_chunks.csv, result.rttm을 저장함."""
    output_dir.mkdir(parents=True, exist_ok=True)
    file_id = audio_path.stem

    json_path = output_dir / "result.json"
    json_path.write_text(
        json.dumps(to_serializable(result), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"  result.json       -> {json_path}")

    dialog_lines = build_dialog_lines(result)
    dialog_path = output_dir / "result_dialog.txt"
    dialog_path.write_text("\n".join(dialog_lines), encoding="utf-8")
    print(f"  result_dialog.txt -> {dialog_path}")

    df = build_chunks_df(result)
    csv_path = output_dir / "result_chunks.csv"
    df.to_csv(csv_path, index=False, sep="|", encoding="utf-8-sig")
    print(f"  result_chunks.csv -> {csv_path}")

    rttm_lines = build_rttm_lines(result, file_id)
    rttm_path = output_dir / "result.rttm"
    rttm_path.write_text("\n".join(rttm_lines), encoding="utf-8")
    print(f"  result.rttm       -> {rttm_path}")


def parse_args() -> argparse.Namespace:
    """커맨드라인 인수를 파싱함."""
    parser = argparse.ArgumentParser(
        description="WhisperX STT + 화자 분리(Speaker Diarization) 예제"
    )
    parser.add_argument(
        "--input", type=Path, default=None,
        help="입력 오디오 파일 경로. 생략 시 hands-on/05.stt/audio/ 첫 번째 파일 자동 선택",
    )
    parser.add_argument(
        "--output-dir", type=Path, default=SCRIPT_DIR,
        help=f"결과 저장 디렉터리 (기본값: {SCRIPT_DIR})",
    )
    parser.add_argument(
        "--num-speakers", type=int, default=None,
        help="화자 수. 지정 시 해당 화자 수로 고정 분할 처리",
    )
    parser.add_argument(
        "--language", type=str, default="ko",
        help="음성 언어 코드 (기본값: ko)",
    )
    parser.add_argument(
        "--model", type=str, default="large-v3-turbo",
        help="Whisper 모델 크기 (기본값: large-v3-turbo)",
    )
    parser.add_argument(
        "--batch-size", type=int, default=16,
        help="배치 크기 (기본값: 16, GPU 메모리 부족 시 줄임)",
    )
    parser.add_argument(
        "--compute-type", type=str, default="float16",
        choices=["float16", "int8", "float32"],
        help="연산 정밀도 (기본값: float16, CPU 사용 시 int8 자동 적용)",
    )
    parser.add_argument(
        "--device", type=str, default=None,
        help="디바이스 (cuda/cpu). 생략 시 CUDA 가용 여부 자동 감지",
    )
    parser.add_argument(
        "--diarize-model", type=str, default="pyannote/speaker-diarization-3.1",
        help="화자 분리 모델 (기본값: pyannote/speaker-diarization-3.1)",
    )
    return parser.parse_args()


def main() -> int:
    """WhisperX + 화자 분리 워크플로우를 실행함."""
    args = parse_args()

    hf_token = load_hf_token()

    try:
        audio_path = resolve_audio(args.input)
    except FileNotFoundError as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 1

    device = args.device or detect_device()
    compute_type = args.compute_type
    if device == "cpu" and compute_type == "float16":
        compute_type = "int8"
        print("[INFO] CPU 모드 감지: compute_type을 int8로 자동 변경")

    output_dir = args.output_dir.expanduser().resolve()

    print("=" * 70)
    print("WhisperX STT + 화자 분리")
    print("=" * 70)
    print(f"  모델         : {args.model}")
    print(f"  오디오       : {audio_path}")
    print(f"  언어         : {args.language}")
    print(f"  디바이스     : {device}")
    print(f"  compute_type : {compute_type}")
    print(f"  batch_size   : {args.batch_size}")
    print(f"  화자 수      : {args.num_speakers if args.num_speakers else '자동 감지'}")
    print(f"  화자분리 모델: {args.diarize_model}")
    print(f"  출력 디렉터리: {output_dir}")
    print()

    try:
        import whisperx
        # DiarizationPipeline: whisperx 내장 화자 분리 파이프라인 클래스
        from whisperx.diarize import DiarizationPipeline

        print("[1/4] Whisper 모델 로딩 및 전사 중...")
        model = whisperx.load_model(
            args.model,
            device,
            compute_type=compute_type,
            language=args.language,
        )
        audio = whisperx.load_audio(str(audio_path))
        result = model.transcribe(audio, batch_size=args.batch_size, language=args.language)
        print(f"      전사 완료: {len(result.get('segments', []))} segments")

        print("[2/4] 단어 수준 타임스탬프 정렬 중...")
        model_a, metadata = whisperx.load_align_model(
            language_code=result["language"],
            device=device,
        )
        result = whisperx.align(
            result["segments"],
            model_a,
            metadata,
            audio,
            device,
            return_char_alignments=False,
        )
        print("      정렬 완료")

        print("[3/4] 화자 분리 중...")
        diarize_pipeline = DiarizationPipeline(model_name=args.diarize_model, token=hf_token, device=device)

        diarize_kwargs: dict = {}
        if args.num_speakers is not None:
            diarize_kwargs["min_speakers"] = args.num_speakers
            diarize_kwargs["max_speakers"] = args.num_speakers

        diarize_segments = diarize_pipeline(audio, **diarize_kwargs)
        result = whisperx.assign_word_speakers(diarize_segments, result)
        print("      화자 분리 완료")

        print("[4/4] 결과 저장 중...")
        save_outputs(output_dir, audio_path, result)

    except ImportError as e:
        print(f"[ERROR] 필수 패키지가 없습니다: {e}", file=sys.stderr)
        print("  pip install -r requirements.txt 를 실행하세요.", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\n사용자 요청으로 중단되었습니다.", file=sys.stderr)
        return 130
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 1

    print("\n완료!")
    return 0


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    raise SystemExit(main())
