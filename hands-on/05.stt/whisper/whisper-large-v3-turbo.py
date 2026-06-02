"""Hugging Face transformers로 Whisper 로컬 모델을 실행하는 예제.

whisper-large-v3-turbo 모델을 로컬에서 직접 실행하여
hands-on/05.stt/audio/ 의 첫 번째 오디오 파일을 전사하고
result.txt와 result_chunks.csv로 저장함.
"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

import pandas as pd
import torch
from transformers import pipeline


# Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
SCRIPT_DIR = Path(__file__).resolve().parent
STT_DIR = SCRIPT_DIR.parent
AUDIO_DIR = STT_DIR / "audio"

MODEL_ID = "openai/whisper-large-v3-turbo"

# 음성 인식 생성 파라미터
LANGUAGE = "korean"
TASK = "transcribe"
CHUNK_LENGTH_S = 30
BATCH_SIZE = 8

SUPPORTED_FORMATS = {".flac", ".m4a", ".mp3", ".mp4", ".mpeg", ".mpga", ".ogg", ".wav", ".webm"}


def detect_device() -> tuple[str, torch.dtype]:
    """GPU 가용 여부를 확인하여 (디바이스, dtype) 쌍을 반환함. GPU 있으면 cuda+float16, 없으면 cpu+float32."""
    if torch.cuda.is_available():
        device_name = torch.cuda.get_device_name(0)
        print(f"GPU 감지: {device_name}")
        return "cuda", torch.float16
    print("GPU 미감지 — CPU 모드로 실행 (속도가 느릴 수 있습니다)")
    return "cpu", torch.float32


def find_first_audio_file(audio_dir: Path) -> Path:
    """audio_dir에서 지원 형식의 파일 중 이름순 첫 번째 파일 경로를 반환함."""
    if not audio_dir.exists():
        raise FileNotFoundError(f"오디오 디렉터리를 찾을 수 없습니다: {audio_dir}")

    files = sorted(
        p for p in audio_dir.iterdir()
        if p.is_file() and p.suffix.lower() in SUPPORTED_FORMATS
    )
    if not files:
        raise FileNotFoundError(
            f"지원 오디오 파일이 없습니다: {audio_dir}\n"
            f"지원 확장자: {', '.join(sorted(SUPPORTED_FORMATS))}"
        )
    return files[0]


def load_pipeline(device: str, torch_dtype: torch.dtype):
    """Hugging Face transformers로 Whisper ASR 파이프라인을 로드하여 반환함."""
    print(f"\n[1/3] 모델 로드 중: {MODEL_ID}")
    print(f"      디바이스: {device}  |  dtype: {torch_dtype}")
    return pipeline(
        "automatic-speech-recognition",
        model=MODEL_ID,
        dtype=torch_dtype,
        device=device,
    )


def transcribe(pipe, audio_path: Path) -> dict:
    """단어 수준 타임스탬프를 포함하여 ASR을 실행하고 원시 결과 딕셔너리를 반환함."""
    print(f"\n[2/3] 음성 인식 중: {audio_path.name}")
    return pipe(
        str(audio_path),
        return_timestamps=True,
        chunk_length_s=CHUNK_LENGTH_S,
        batch_size=BATCH_SIZE,
        generate_kwargs={"language": LANGUAGE, "task": TASK},
    )


def fmt_sec(seconds: float | None) -> str:
    """초 단위 float 값을 '0.00s' 형식 문자열로 변환함."""
    return f"{seconds:.2f}s" if seconds is not None else "0.00s"


def save_result_txt(output_path: Path, audio_path: Path, full_text: str) -> None:
    """전사 전문을 result.txt로 저장함."""
    content = (
        f"Whisper STT Result\n"
        f"Generated At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"Model: {MODEL_ID}\n"
        f"Audio File: {audio_path.name}\n"
        f"\n"
        f"## 전사 결과\n"
        f"{full_text}\n"
    )
    output_path.write_text(content, encoding="utf-8")


def save_result_csv(output_path: Path, chunks: list[dict]) -> None:
    """청크별 타임스탬프를 '|' 구분자로 result_chunks.csv에 저장함."""
    rows = []
    for i, chunk in enumerate(chunks, start=1):
        start, end = chunk.get("timestamp", (None, None))
        rows.append({
            "#": i,
            "시작": fmt_sec(start),
            "종료": fmt_sec(end),
            "텍스트": chunk.get("text", "").strip(),
        })

    df = pd.DataFrame(rows, columns=["#", "시작", "종료", "텍스트"])
    df.to_csv(output_path, index=False, sep="|", encoding="utf-8-sig")


def main() -> int:
    """오디오를 전사하고 결과를 저장하는 진입점 함수."""
    try:
        audio_path = find_first_audio_file(AUDIO_DIR)

        print("=" * 70)
        print("Whisper STT — whisper-large-v3-turbo")
        print("=" * 70)
        print(f"입력 파일: {audio_path}")

        device, torch_dtype = detect_device()
        pipe = load_pipeline(device, torch_dtype)
        result = transcribe(pipe, audio_path)

        full_text = result.get("text", "").strip()
        chunks = result.get("chunks", [])

        output_txt = SCRIPT_DIR / "result.txt"
        output_csv = SCRIPT_DIR / "result_chunks.csv"

        print("\n[3/3] 결과 저장 중")
        save_result_txt(output_txt, audio_path, full_text)
        save_result_csv(output_csv, chunks)

        print("\n완료")
        print(f"- 전사 결과 : {output_txt}")
        print(f"- 청크 CSV  : {output_csv}")
        print(f"- 청크 수   : {len(chunks)}")
        print(f"\n전사 텍스트:\n{full_text}")

    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    return 0


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    raise SystemExit(main())
