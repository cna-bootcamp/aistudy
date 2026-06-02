"""
Coqui XTTS v2 TTS — 음성 복제(Voice Cloning) 실습.
참조 음성으로 화자 특성을 추출하고 한국어 음성을 합성함.
XTTS v2는 한국어를 포함한 16개 언어를 기본 지원하므로 번역이 불필요함.

주의: XTTS v2는 CPML 라이선스(비상업적 연구 목적만 허용)를 적용함.
"""

import os
import sys

# COQUI_TOS_AGREED: CPML 라이선스 동의 — TTS import 전에 반드시 설정해야 함
os.environ["COQUI_TOS_AGREED"] = "1"

# PyTorch 2.6+에서 weights_only 기본값이 True로 변경되어 XTTS v2 config pickle 로딩이 깨짐.
# 모든 TTS import 전에 torch.load를 패치하여 기존 동작을 복원함.
import torch as _torch
_torch_load_orig = _torch.load


def _torch_load_compat(f, *args, **kwargs):
    # weights_only=True를 강제 해제: trainer/io.py가 명시적으로 True를 전달하는 경우를 우선 처리
    kwargs["weights_only"] = False
    return _torch_load_orig(f, *args, **kwargs)


# 라이브러리 내부 함수를 수정된 버전으로 교체함 (monkey-patch)
_torch.load = _torch_load_compat

import json
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import scipy.io.wavfile as wavfile
from tqdm import tqdm

# 이 파일이 위치한 디렉터리 경로를 구함
SCRIPT_DIR = Path(__file__).parent   # hands-on/06.tts/coqui-xtts/
TTS_ROOT   = SCRIPT_DIR.parent       # hands-on/06.tts/
VOICES_DIR = SCRIPT_DIR / "voices"
MAPPING_FILE = VOICES_DIR / "mapping.json"

MODEL_NAME  = "tts_models/multilingual/multi-dataset/xtts_v2"
LANGUAGE    = "ko"
SAMPLE_RATE = 24000   # XTTS v2 기본 출력 샘플레이트
SILENCE_SEC = 0.2

# 기본 화자→음성 파일 매핑 (mapping.json이 없거나 신규 화자 발견 시 적용)
# 주의: 자연스러운 한국어 출력을 위해 참조 음성은 한국어 원어민 화자 사용 권장.
#       비한국어 참조 음성(예: 영어 샘플) 사용 시 한국어 TTS에서 외국 억양이 발생함.
DEFAULT_MAPPING: Dict[str, str] = {
    "나":   "man.wav",
    "부인": "woman.wav",
}


# ============================================================
# 사전 요건 검사
# ============================================================

def check_prerequisites() -> None:
    """PyTorch 및 Coqui TTS 설치 여부를 확인하고, 미설치 시 안내 후 종료함."""
    try:
        import torch  # noqa: F401
    except ImportError:
        print("\n[Error] PyTorch not installed.")
        print("  Install guide: https://github.com/cna-bootcamp/aistudy/blob/main/agentic-ai/reference/install-pytorch.md")
        sys.exit(1)

    try:
        # TTS: Coqui TTS 라이브러리의 메인 API 클래스 — XTTS v2 모델 로드 및 음성 합성 담당
        from TTS.api import TTS  # noqa: F401
    except ImportError:
        print("\n[Error] Coqui TTS not installed. Run: pip install -r requirements.txt")
        sys.exit(1)


# ============================================================
# 참조 음성 관리
# ============================================================

VOICE_EXTENSIONS = (
    "*.wav",   # PCM WAV (기본, 변환 불필요)
    "*.mp3",   # MPEG Audio Layer III
    "*.m4a",   # AAC in MPEG-4 컨테이너
    "*.aac",   # Advanced Audio Coding (raw)
    "*.ogg",   # Ogg Vorbis
    "*.opus",  # Opus
    "*.flac",  # Free Lossless Audio Codec
    "*.wma",   # Windows Media Audio
    "*.aiff",  # Audio Interchange File Format (macOS)
    "*.webm",  # WebM 오디오
    "*.amr",   # Adaptive Multi-Rate (모바일 녹음)
)


def scan_voices() -> List[Path]:
    """voices/ 디렉터리의 지원 오디오 파일을 정렬하여 반환함."""
    VOICES_DIR.mkdir(parents=True, exist_ok=True)
    files: List[Path] = []
    for ext in VOICE_EXTENSIONS:
        files.extend(VOICES_DIR.glob(ext))
    return sorted(set(files))


def preconvert_voices(audio_files: List[Path]) -> List[Path]:
    """비-WAV 파일을 voices/ 디렉터리에서 WAV로 변환하고, WAV만 정렬하여 반환함."""
    import subprocess
    wav_files: List[Path] = []
    for src in audio_files:
        if src.suffix.lower() == ".wav":
            wav_files.append(src)
            continue
        dst = src.with_suffix(".wav")
        if dst.exists():
            print(f"[Voice] Already converted: {dst.name}")
        else:
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", str(src), str(dst)],
                capture_output=True,
            )
            if result.returncode != 0:
                print(f"[Voice] Failed to convert {src.name}: {result.stderr.decode(errors='replace')[-120:]}")
                continue
            print(f"[Voice] Converted {src.name} -> {dst.name}")
        wav_files.append(dst)
    return sorted(set(wav_files))


def load_mapping() -> Optional[Dict[str, str]]:
    """JSON 파일에서 화자→음성 파일명 매핑을 로드함. 파일이 없거나 오류 시 None 반환."""
    if not MAPPING_FILE.exists():
        return None
    try:
        with open(MAPPING_FILE, encoding="utf-8") as f:
            data = json.load(f)
        print(f"[Mapping] Loaded from {MAPPING_FILE.name}")
        return data
    except Exception as e:
        print(f"[Mapping] Failed to load ({e}), will re-select.")
        return None


def save_mapping(mapping: Dict[str, str]) -> None:
    """화자→음성 파일명 매핑을 JSON 파일에 저장하여 재사용을 가능하게 함."""
    with open(MAPPING_FILE, "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
    print(f"[Mapping] Saved to {MAPPING_FILE.name}")


def select_voice_for_speaker(speaker: str, voice_files: List[Path]) -> str:
    """참조 음성 목록을 표시하고, 사용자가 선택한 파일명을 반환함."""
    print(f"\n{'=' * 60}")
    print(f"Select reference voice for speaker: '{speaker}'")
    print("=" * 60)
    for i, wav in enumerate(voice_files, 1):
        size_kb = wav.stat().st_size // 1024
        print(f"  {i:2}. {wav.name}  ({size_kb} KB)")
    print("=" * 60)

    while True:
        try:
            choice = input(f"Enter number (1-{len(voice_files)}): ").strip()
            idx = int(choice) - 1
            if 0 <= idx < len(voice_files):
                selected = voice_files[idx]
                print(f"Selected: {selected.name}")
                # 파일명만 저장 (머신 간 이식성 확보)
                return selected.name
        except (ValueError, KeyboardInterrupt):
            pass
        print("Invalid choice. Please try again.")


# ============================================================
# 대화 CSV 로드
# ============================================================

def load_dialog(path: Path) -> pd.DataFrame:
    """파이프(|) 구분자 CSV에서 대화 데이터를 로드하고 필수 컬럼을 검증하여 반환함."""
    if not path.exists():
        print(f"\n[Error] Input file not found: {path}")
        sys.exit(1)
    df = pd.read_csv(path, sep="|", encoding="utf-8")
    for col in ("speaker", "text"):
        if col not in df.columns:
            print(f"\n[Error] Required column '{col}' not found in {path.name}")
            sys.exit(1)
    df = df.dropna(subset=["speaker", "text"])
    df["text"] = df["text"].astype(str).str.strip()
    return df[df["text"] != ""].reset_index(drop=True)


# ============================================================
# 오디오 유틸리티
# ============================================================

def make_silence(duration_sec: float, sample_rate: int) -> np.ndarray:
    """지정 길이(초)의 무음 float32 배열을 생성하여 반환함."""
    return np.zeros(int(duration_sec * sample_rate), dtype=np.float32)


# ============================================================
# 진입점
# ============================================================

def main() -> None:
    """Coqui XTTS v2 음성 복제 TTS 전체 파이프라인을 실행함."""
    # Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    print("=" * 60)
    print("Coqui XTTS v2 — Voice Cloning TTS")
    print(f"Model   : {MODEL_NAME}")
    print(f"Language: {LANGUAGE} (Korean)")
    print("=" * 60)

    # 1. 사전 요건 검사
    check_prerequisites()

    # 2. 경로 설정
    input_path  = TTS_ROOT / "text" / "dialog.csv"
    output_path = SCRIPT_DIR / "result.wav"

    # 3. 참조 음성 탐색 및 WAV 사전 변환
    all_audio = scan_voices()
    voice_files = preconvert_voices(all_audio)
    if not voice_files:
        print(f"\n[Error] No supported audio files found in {VOICES_DIR}")
        print("  Place reference audio files (6-30 seconds each) in the voices/ directory.")
        sys.exit(1)
    print(f"\n[Voices] {len(voice_files)} reference voice(s) available (WAV):")
    for v in voice_files:
        print(f"  - {v.name}")

    # 4. 대화 파일 로드
    print(f"\n[Load] Reading dialog from {input_path.name}...")
    df = load_dialog(input_path)
    print(f"[Load] {len(df)} lines, {df['speaker'].nunique()} speakers")

    speakers: List[str] = list(dict.fromkeys(df["speaker"].astype(str).tolist()))
    print(f"[Load] Speakers: {speakers}")

    # 5. 화자별 음성 매핑
    mapping = load_mapping()
    need_save = False
    force_manual_mapping = False

    if mapping is None:
        print("\n[Mapping] No mapping file found. Select reference voices for each speaker.")
        mapping = {}
        need_save = True
    else:
        missing = [s for s in speakers if s not in mapping]
        stale   = [s for s in speakers if s in mapping and not (VOICES_DIR / mapping[s]).exists()]
        if missing or stale:
            if missing:
                print(f"\n[Mapping] New speakers detected: {missing}. Select reference voices.")
            if stale:
                print(f"\n[Mapping] Reference voice file(s) missing for: {stale}. Re-select voices.")
                for s in stale:
                    del mapping[s]
            need_save = True
        else:
            print("\n[Mapping] Current speaker → voice mapping:")
            for spk in speakers:
                print(f"  {spk} → {mapping[spk]}")
            try:
                answer = input("\nChange mapping? (y/N): ").strip().lower()
            except EOFError:
                answer = "n"
            if answer == "y":
                print("[Mapping] Manual remapping requested. Select reference voices for each speaker.")
                mapping = {}
                need_save = True
                force_manual_mapping = True

    for spk in speakers:
        if spk not in mapping:
            default = DEFAULT_MAPPING.get(spk)
            if not force_manual_mapping and default and (VOICES_DIR / default).exists():
                print(f"[Mapping] Default applied: {spk} → {default}")
                mapping[spk] = default
            else:
                mapping[spk] = select_voice_for_speaker(spk, voice_files)

    if need_save:
        save_mapping(mapping)

    print("\n[Mapping] Speaker → Reference Voice")
    for spk in speakers:
        print(f"  {spk} → {mapping.get(spk, '(not mapped)')}")

    # 6. 매핑된 음성 파일 존재 여부 검증
    for spk in speakers:
        ref = VOICES_DIR / mapping[spk]
        if not ref.exists():
            print(f"\n[Error] Reference voice not found: {ref}")
            print("  Update voices/mapping.json or re-run to remap.")
            sys.exit(1)

    # 7. XTTS v2 모델 로드
    import torch
    from TTS.api import TTS

    print(f"\n[Model] Loading {MODEL_NAME}...")
    print("[Model] First run downloads ~1.8 GB — ensure network and disk space available.")

    # GPU(CUDA) 사용 가능 여부 확인. 불가능하면 CPU 사용
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[Model] Device: {device}")

    tts = TTS(model_name=MODEL_NAME).to(device)
    print("[Model] Loaded successfully")

    # 8. 매핑에서 비-WAV 항목을 변환된 .wav 파일명으로 업데이트
    mapping_updated = False
    for spk in speakers:
        fname = mapping[spk]
        if not fname.lower().endswith(".wav"):
            wav_name = str(Path(fname).with_suffix(".wav"))
            if (VOICES_DIR / wav_name).exists():
                print(f"[Mapping] Updating {spk}: {fname} → {wav_name}")
                mapping[spk] = wav_name
                mapping_updated = True
    if mapping_updated:
        save_mapping(mapping)

    # 9. 음성 복제로 한국어 음성 세그먼트 생성
    print("\n[Audio] Generating Korean speech with voice cloning...")
    segments: List[np.ndarray] = []
    silence = make_silence(SILENCE_SEC, SAMPLE_RATE)

    rows = list(df.iterrows())
    # tqdm: 반복 작업의 진행률을 프로그레스 바로 표시함
    for i, (_, row) in enumerate(tqdm(rows, desc="Generating")):
        spk  = str(row["speaker"])
        text = str(row["text"])
        wav_data = tts.tts(text=text, speaker_wav=str(VOICES_DIR / mapping[spk]), language=LANGUAGE)
        segments.append(np.array(wav_data, dtype=np.float32))
        if i < len(rows) - 1:
            segments.append(silence)

    if not segments:
        print("\n[Error] No audio segments generated.")
        sys.exit(1)

    # 10. 세그먼트 연결, 정규화, 24000Hz 16-bit PCM WAV로 저장
    print("\n[Audio] Concatenating segments...")
    final = np.concatenate(segments)

    max_val = np.max(np.abs(final))
    if max_val > 0:
        final = final / max_val * 0.95

    final_int16 = (final * 32767).astype(np.int16)
    # 오디오 데이터를 16-bit PCM WAV 파일로 저장함
    wavfile.write(str(output_path), SAMPLE_RATE, final_int16)

    duration = len(final) / SAMPLE_RATE
    print(f"\n[Done] Output : {output_path}")
    print(f"[Done] Duration: {duration:.2f}s | Sample rate: {SAMPLE_RATE} Hz")
    print("\n" + "=" * 60)
    print("Voice Cloning Complete!")
    print("=" * 60)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
