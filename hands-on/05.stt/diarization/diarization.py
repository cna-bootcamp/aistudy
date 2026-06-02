"""Whisper + pyannote 화자 분리 예제.

로컬 Whisper(whisper-large-v3-turbo)로 음성을 전사하고,
pyannote(speaker-diarization-3.1)로 화자를 분리한 뒤 결합함.
librosa로 오디오를 로드하여 torchaudio MP3 백엔드 문제를 우회함.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import librosa
import numpy as np
import pandas as pd
import torch
from dotenv import load_dotenv
from pyannote.audio import Pipeline as DiarizationPipeline
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline


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

WHISPER_MODEL_ID = "openai/whisper-large-v3-turbo"
DIARIZATION_MODEL_ID = "pyannote/speaker-diarization-3.1"
SAMPLE_RATE = 16_000

SUPPORTED_FORMATS = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".webm"}


# ---------------------------------------------------------------------------
# 디바이스 및 환경 설정
# ---------------------------------------------------------------------------

def setup_device() -> tuple[str, torch.dtype]:
    """GPU 사용 가능 여부를 확인하여 디바이스와 연산 정밀도를 반환함."""
    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch_dtype = torch.float16 if device == "cuda" else torch.float32
    return device, torch_dtype


def load_env() -> str:
    """hands-on/.env에서 HF_TOKEN을 읽어 반환함."""
    # .env 파일에서 API 키 등 환경변수를 로드함
    load_dotenv(ENV_PATH)
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        raise RuntimeError(
            f"HF_TOKEN이 설정되지 않았습니다.\n"
            f"{ENV_PATH} 파일에 'HF_TOKEN=your_token' 을 추가하세요.\n"
            f"토큰 발급: https://huggingface.co/settings/tokens"
        )
    return hf_token


# ---------------------------------------------------------------------------
# 오디오 입력
# ---------------------------------------------------------------------------

def find_audio_files(audio_dir: Path) -> list[Path]:
    """audio 디렉터리에서 지원 형식의 오디오 파일 목록을 이름순으로 반환함."""
    if not audio_dir.exists():
        return []
    return sorted(
        p for p in audio_dir.iterdir()
        if p.is_file() and p.suffix.lower() in SUPPORTED_FORMATS
    )


def resolve_audio_input(input_arg: Path | None) -> Path:
    """CLI 인수가 없으면 audio 디렉터리 첫 번째 파일을 자동 선택함."""
    if input_arg is not None:
        path = input_arg.expanduser().resolve()
        if not path.exists():
            raise FileNotFoundError(f"입력 오디오 파일을 찾을 수 없습니다: {path}")
        if path.suffix.lower() not in SUPPORTED_FORMATS:
            raise ValueError(f"지원하지 않는 확장자입니다: {path.suffix}")
        return path

    audio_files = find_audio_files(AUDIO_DIR)
    if not audio_files:
        raise FileNotFoundError(f"오디오 파일이 없습니다: {AUDIO_DIR}")

    print(f"자동 선택: {audio_files[0].name}")
    return audio_files[0]


def load_audio(audio_path: Path) -> tuple[np.ndarray, torch.Tensor]:
    """librosa로 오디오를 로드하여 numpy 배열과 torch 텐서 (1, T)를 반환함."""
    print(f"  파일: {audio_path.name}")
    waveform_np, _ = librosa.load(str(audio_path), sr=SAMPLE_RATE, mono=True)
    # unsqueeze(0): 1차원 배열에 배치 차원(앞쪽)을 추가하여 (1, T) 형태로 만듦
    waveform_tensor = torch.from_numpy(waveform_np).unsqueeze(0)
    duration = len(waveform_np) / SAMPLE_RATE
    print(f"  길이: {duration:.1f}초 | 샘플: {len(waveform_np):,}")
    return waveform_np, waveform_tensor


# ---------------------------------------------------------------------------
# Whisper STT
# ---------------------------------------------------------------------------

def load_whisper(device: str, torch_dtype: torch.dtype) -> Any:
    """Hugging Face transformers로 Whisper 로컬 모델과 파이프라인을 로드함."""
    print(f"  모델: {WHISPER_MODEL_ID}")
    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        WHISPER_MODEL_ID,
        torch_dtype=torch_dtype,
        low_cpu_mem_usage=True,
        use_safetensors=True,
    )
    model.to(device)
    processor = AutoProcessor.from_pretrained(WHISPER_MODEL_ID)
    return pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        torch_dtype=torch_dtype,
        device=device,
    )


def transcribe(whisper_pipe: Any, waveform_np: np.ndarray) -> list[dict]:
    """Whisper 파이프라인으로 오디오를 전사하고 청크별 타임스탬프를 반환함."""
    result = whisper_pipe(
        {"array": waveform_np, "sampling_rate": SAMPLE_RATE},
        chunk_length_s=30,
        batch_size=16,
        return_timestamps=True,
        generate_kwargs={
            "language": "ko",
            "task": "transcribe",
            "max_new_tokens": 448,
            "num_beams": 1,
            "condition_on_prev_tokens": False,
            "compression_ratio_threshold": 1.35,
            "temperature": (0.0, 0.2, 0.4, 0.6, 0.8, 1.0),
            "logprob_threshold": -1.0,
            "no_speech_threshold": 0.6,
        },
    )
    chunks = result.get("chunks", [])
    print(f"  인식된 청크 수: {len(chunks)}")
    return chunks


# ---------------------------------------------------------------------------
# pyannote 화자 분리
# ---------------------------------------------------------------------------

def diarize(
    hf_token: str,
    waveform_tensor: torch.Tensor,
    device: str,
    num_speakers: int | None,
) -> list[tuple[float, float, str]]:
    """pyannote 화자 분리 파이프라인을 실행하여 (시작, 종료, 화자) 목록을 반환함."""
    print(f"  모델: {DIARIZATION_MODEL_ID}")
    # DiarizationPipeline: pyannote 화자 분리 모델을 로드하는 클래스
    diar_pipeline = DiarizationPipeline.from_pretrained(
        DIARIZATION_MODEL_ID,
        token=hf_token,
    )
    if device == "cuda":
        diar_pipeline.to(torch.device("cuda"))

    kwargs: dict[str, Any] = {}
    if num_speakers is not None:
        kwargs["num_speakers"] = num_speakers

    diarization = diar_pipeline(
        {"waveform": waveform_tensor, "sample_rate": SAMPLE_RATE},
        **kwargs,
    )

    segments = [
        (turn.start, turn.end, speaker)
        for turn, _, speaker in diarization.itertracks(yield_label=True)
    ]
    print(f"  화자 분리 세그먼트 수: {len(segments)}")
    return segments


# ---------------------------------------------------------------------------
# 결과 병합
# ---------------------------------------------------------------------------

def _find_speaker(mid: float, diar_segments: list[tuple[float, float, str]]) -> str:
    """중간 지점을 포함하는 화자 세그먼트를 반환하고, 없으면 가장 가까운 세그먼트 화자를 반환함."""
    for start, end, speaker in diar_segments:
        if start <= mid <= end:
            return speaker
    return min(diar_segments, key=lambda s: abs((s[0] + s[1]) / 2 - mid))[2]


def _speaker_label(raw: str, order_map: dict[str, int]) -> str:
    """SPEAKER_00 형태의 원시 라벨을 첫 등장 순서 기반 화자A/화자B 형식으로 변환함."""
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    idx = order_map.get(raw, 0)
    return f"화자{alphabet[idx % len(alphabet)]}"


def merge_results(
    whisper_chunks: list[dict],
    diar_segments: list[tuple[float, float, str]],
) -> list[dict]:
    """Whisper 청크에 화자 라벨을 배정하여 병합 결과를 반환함."""
    # 첫 등장 순서로 화자A/화자B 라벨을 안정적으로 부여하기 위한 순서 맵 생성
    order_map: dict[str, int] = {}
    for _, _, spk in diar_segments:
        if spk not in order_map:
            order_map[spk] = len(order_map)

    merged: list[dict] = []
    for chunk in whisper_chunks:
        text = chunk.get("text", "").strip()
        if not text:
            continue

        ts = chunk.get("timestamp", (0.0, 0.0))
        start = float(ts[0]) if ts[0] is not None else 0.0
        end = float(ts[1]) if ts[1] is not None else start
        mid = (start + end) / 2

        raw_spk = _find_speaker(mid, diar_segments) if diar_segments else "SPEAKER_00"
        speaker = _speaker_label(raw_spk, order_map)
        ts_str = f"{int(start) // 60:02d}:{int(start) % 60:02d}"

        merged.append({
            "id": len(merged) + 1,
            "timestamp": ts_str,
            "start_sec": round(start, 2),
            "end_sec": round(end, 2),
            "speaker": speaker,
            "text": text,
        })
    return merged


# ---------------------------------------------------------------------------
# 출력
# ---------------------------------------------------------------------------

def save_results(
    output_dir: Path,
    audio_path: Path,
    segments: list[dict],
    num_speakers: int | None,
    device: str,
) -> tuple[Path, Path]:
    """전사 결과를 TXT와 CSV 파일로 저장하고 저장 경로를 반환함."""
    output_dir.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    transcript = "\n".join(
        f"[{s['timestamp']}] {s['speaker']}: {s['text']}" for s in segments
    )

    txt_path = output_dir / "result.txt"
    txt_path.write_text(
        f"Whisper + pyannote Diarization Result\n"
        f"Generated At  : {generated_at}\n"
        f"STT Model     : {WHISPER_MODEL_ID}\n"
        f"Diarization   : {DIARIZATION_MODEL_ID}\n"
        f"Audio File    : {audio_path.name}\n"
        f"Device        : {device.upper()}\n"
        f"Num Speakers  : {num_speakers if num_speakers else 'auto'}\n"
        f"\n## 화자 분리 대화록\n{transcript}\n",
        encoding="utf-8",
    )

    csv_path = output_dir / "result_chunks.csv"
    pd.DataFrame(segments).to_csv(csv_path, index=False, encoding="utf-8-sig", sep="|")

    return txt_path, csv_path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def prompt_num_speakers(cli_value: int | None) -> int | None:
    """CLI 값이 없으면 사용자에게 화자 수를 입력받음 (Enter 시 자동 감지)."""
    if cli_value is not None:
        return cli_value
    raw = input("\n화자 수를 입력하세요 (Enter=자동 감지): ").strip()
    if not raw:
        return None
    try:
        n = int(raw)
        if n < 1:
            raise ValueError
        return n
    except ValueError:
        print("유효하지 않은 입력입니다. 자동 감지로 진행합니다.")
        return None


def parse_args() -> argparse.Namespace:
    """커맨드라인 인수를 파싱함."""
    parser = argparse.ArgumentParser(
        description="Whisper + pyannote 화자 분리 음성 인식 예제"
    )
    parser.add_argument(
        "--input", type=Path, default=None,
        help="입력 오디오 파일 경로. 생략 시 audio 디렉터리 첫 번째 파일 사용",
    )
    parser.add_argument(
        "--output-dir", type=Path, default=SCRIPT_DIR,
        help=f"결과 저장 디렉터리. 기본값: {SCRIPT_DIR}",
    )
    parser.add_argument(
        "--num-speakers", type=int, default=None,
        help="화자 수 (정수). 생략 시 프롬프트 또는 자동 감지",
    )
    return parser.parse_args()


def main() -> int:
    """Whisper + pyannote 화자 분리 워크플로우를 실행함."""
    args = parse_args()
    output_dir = args.output_dir.expanduser().resolve()

    try:
        print("=" * 70)
        print("Whisper + pyannote 화자 분리 음성 인식")
        print("=" * 70)

        device, torch_dtype = setup_device()
        print(f"- 디바이스  : {device.upper()}")
        print(f"- STT 모델  : {WHISPER_MODEL_ID}")
        print(f"- 화자 분리 : {DIARIZATION_MODEL_ID}")

        hf_token = load_env()
        audio_path = resolve_audio_input(args.input)
        num_speakers = prompt_num_speakers(args.num_speakers)

        print(f"- 입력 파일 : {audio_path}")
        print(f"- 화자 수   : {num_speakers if num_speakers else '자동 감지'}")
        print(f"- 출력 경로 : {output_dir}")

        print("\n[1/4] 오디오 로드")
        waveform_np, waveform_tensor = load_audio(audio_path)

        print("\n[2/4] Whisper STT")
        whisper_pipe = load_whisper(device, torch_dtype)
        whisper_chunks = transcribe(whisper_pipe, waveform_np)

        print("\n[3/4] pyannote 화자 분리")
        diar_segments = diarize(hf_token, waveform_tensor, device, num_speakers)

        print("\n[4/4] 결과 병합 및 저장")
        merged = merge_results(whisper_chunks, diar_segments)
        txt_path, csv_path = save_results(
            output_dir, audio_path, merged, num_speakers, device
        )

    except KeyboardInterrupt:
        print("\n사용자 요청으로 중단되었습니다.", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print("\n완료")
    print(f"- TXT : {txt_path}")
    print(f"- CSV : {csv_path}")
    return 0


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    raise SystemExit(main())
