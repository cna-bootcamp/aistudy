"""
Resemble AI Chatterbox 다국어 TTS — 음성 복제(Voice Cloning) 실습.
참조 음성에서 화자 특성을 추출한 뒤 텍스트를 합성함.
ChatterboxMultilingualTTS(500M)는 한국어(language_id='ko')를 포함한 23개 언어를 기본 지원하며,
생성된 모든 오디오에 Perth 워터마크가 자동 삽입됨.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import scipy.io.wavfile as wavfile
from tqdm import tqdm

# 이 파일이 위치한 디렉터리 경로를 구함
SCRIPT_DIR   = Path(__file__).parent   # hands-on/06.tts/chatterbox/
TTS_ROOT     = SCRIPT_DIR.parent       # hands-on/06.tts/
VOICES_DIR   = SCRIPT_DIR / "voices"
MAPPING_FILE = VOICES_DIR / "mapping.json"

LANGUAGE     = "ko"    # 한국어 (ISO 639-1) — 23개 지원 언어 중 하나
SAMPLE_RATE  = 24000   # Chatterbox 기본 출력 샘플레이트
SILENCE_SEC  = 0.2
EXAGGERATION = 0.5     # 감정 표현 강도 (높을수록 과장됨)
CFG_WEIGHT   = 0.5     # 화자 일관성 제어 (0.0 = 교차 언어 시 억양 혼입 억제)

VOICE_EXTENSIONS = (
    "*.wav",   # PCM WAV (기본, 변환 불필요)
    "*.mp3",   # MPEG Audio Layer III
    "*.m4a",   # AAC in MPEG-4 컨테이너
    "*.aac",   # Advanced Audio Coding (raw)
    "*.ogg",   # Ogg Vorbis
    "*.opus",  # Opus (WebRTC / 메신저 앱)
    "*.flac",  # Free Lossless Audio Codec
    "*.wma",   # Windows Media Audio
    "*.aiff",  # Audio Interchange File Format
    "*.aif",   # AIFF (대체 확장자)
    "*.webm",  # WebM 오디오
    "*.amr",   # Adaptive Multi-Rate (모바일)
    "*.mp4",   # MPEG-4 비디오/오디오 컨테이너
    "*.mov",   # QuickTime 컨테이너
    "*.3gp",   # 3GPP 모바일
    "*.3g2",   # 3GPP2 모바일
    "*.caf",   # Apple Core Audio Format
    "*.mka",   # Matroska 오디오
    "*.wv",    # WavPack
    "*.ape",   # Monkey's Audio
    "*.ra",    # RealAudio
    "*.au",    # Sun/NeXT AU
    "*.ac3",   # Dolby Digital AC-3
    "*.dts",   # DTS 오디오
    "*.tta",   # True Audio
    "*.spx",   # Speex (Ogg 컨테이너)
    "*.gsm",   # GSM 06.10
    "*.ts",    # MPEG Transport Stream
)


# ============================================================
# 사전 요건 검사
# ============================================================

def check_prerequisites() -> None:
    """PyTorch 및 chatterbox-tts 설치 여부를 확인하고, 미설치 시 안내 후 종료함."""
    try:
        import torch  # noqa: F401
    except ImportError:
        print("\n[Error] PyTorch not installed.")
        print("  Install guide: https://github.com/cna-bootcamp/aistudy/blob/main/agentic-ai/reference/install-pytorch.md")
        sys.exit(1)

    try:
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS  # noqa: F401
    except ImportError as e:
        print(f"\n[Error] chatterbox-tts import failed: {e}")
        print("  If 'ml_dtypes' related: pip install --upgrade --force-reinstall ml_dtypes")
        print("  Otherwise reinstall: pip install -r requirements.txt")
        sys.exit(1)


# ============================================================
# 참조 음성 관리
# ============================================================

def scan_voices() -> List[Path]:
    """voices/ 디렉터리의 지원 오디오 파일을 정렬하여 반환함."""
    VOICES_DIR.mkdir(parents=True, exist_ok=True)
    files: List[Path] = []
    for ext in VOICE_EXTENSIONS:
        files.extend(VOICES_DIR.glob(ext))
    return sorted(files)


def convert_to_wav(src: Path) -> Path:
    """비-WAV 오디오 파일을 voices/ 디렉터리에서 WAV로 변환하여 경로를 반환함."""
    import subprocess
    dst = src.with_suffix(".wav")
    if dst.exists():
        print(f"[Voice] Already converted: {src.name} -> {dst.name} (skip)")
        return dst
    print(f"[Voice] Converting {src.name} -> {dst.name} ...")
    result = subprocess.run(
        ["ffmpeg", "-y", "-i", str(src), str(dst)],
        capture_output=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed to convert {src.name}:\n{result.stderr.decode(errors='replace')}"
        )
    print(f"[Voice] Converted: {src.name} -> {dst.name}")
    return dst


def convert_non_wav_voices(voice_files: List[Path]) -> List[Path]:
    """비-WAV 파일을 모두 WAV로 변환하고, 중복 제거 후 정렬된 WAV 목록을 반환함."""
    wav_set: set = set()
    for f in voice_files:
        if f.suffix.lower() == ".wav":
            wav_set.add(f)
        else:
            wav_path = convert_to_wav(f)
            wav_set.add(wav_path)
    return sorted(wav_set)


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
    print("  [Tip] Use Korean reference audio for best results.")
    print("        If using non-Korean audio, cfg_weight=0.0 reduces accent bleed.")

    while True:
        try:
            choice = input(f"Enter number (1-{len(voice_files)}): ").strip()
            idx = int(choice) - 1
            if 0 <= idx < len(voice_files):
                selected = voice_files[idx]
                print(f"Selected: {selected.name}")
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
# 진입점
# ============================================================

def main() -> None:
    """Chatterbox 다국어 TTS 음성 복제 전체 파이프라인을 실행함."""
    # Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    print("=" * 60)
    print("Chatterbox Multilingual TTS — Voice Cloning")
    print("Model   : ChatterboxMultilingualTTS (500M, 23 languages)")
    print(f"Language: {LANGUAGE} (Korean)")
    print("=" * 60)

    # 1. 사전 요건 검사
    check_prerequisites()

    import torch
    # ChatterboxMultilingualTTS: Resemble AI의 다국어 음성 복제 TTS 모델 (500M 파라미터)
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    # 2. 경로 설정
    input_path  = TTS_ROOT / "text" / "dialog.csv"
    output_path = SCRIPT_DIR / "result.wav"

    # 3. voices/ 디렉터리의 오디오 파일 탐색
    all_voice_files = scan_voices()
    if not all_voice_files:
        print(f"\n[Error] No audio files found in {VOICES_DIR}")
        print("  Place ~10s reference audio files (Korean preferred) in voices/ directory.")
        print("  Supported formats: WAV, MP3, M4A, AAC, OGG, OPUS, FLAC, WMA, AIFF, and more.")
        sys.exit(1)

    print(f"\n[Voices] {len(all_voice_files)} reference voice(s) found:")
    for v in all_voice_files:
        print(f"  - {v.name}")

    # 4. 비-WAV 파일을 voices/ 디렉터리에서 WAV로 변환
    non_wav = [f for f in all_voice_files if f.suffix.lower() != ".wav"]
    if non_wav:
        print(f"\n[Voice] Converting {len(non_wav)} non-WAV file(s) to WAV in voices/ ...")
        voice_files = convert_non_wav_voices(all_voice_files)
    else:
        voice_files = all_voice_files

    # 5. 대화 파일 로드
    print(f"\n[Load] Reading dialog from {input_path.name}...")
    df = load_dialog(input_path)
    print(f"[Load] {len(df)} lines, {df['speaker'].nunique()} speakers")

    speakers: List[str] = list(dict.fromkeys(df["speaker"].astype(str).tolist()))
    print(f"[Load] Speakers: {speakers}")

    # 6. 화자별 음성 매핑
    mapping = load_mapping()
    need_save = False

    if mapping is None:
        print("\n[Mapping] No mapping file found. Select reference voices for each speaker.")
        mapping = {}
        need_save = True
    else:
        missing = [s for s in speakers if s not in mapping]
        if missing:
            print(f"\n[Mapping] New speakers detected: {missing}. Select reference voices.")
            need_save = True
        else:
            print("\n[Mapping] Current speaker -> voice mapping:")
            for spk in speakers:
                print(f"  {spk} -> {mapping[spk]}")
            try:
                answer = input("\nChange mapping? (y/N): ").strip().lower()
            except EOFError:
                answer = "n"
            if answer == "y":
                mapping = {}
                need_save = True

    for spk in speakers:
        if spk not in mapping:
            mapping[spk] = select_voice_for_speaker(spk, voice_files)

    if need_save:
        save_mapping(mapping)

    print("\n[Mapping] Speaker -> Reference Voice")
    for spk in speakers:
        print(f"  {spk} -> {mapping.get(spk, '(not mapped)')}")

    # 7. 매핑된 음성 파일 존재 여부 검증 (이 시점에서 모두 WAV여야 함)
    for spk in speakers:
        ref = VOICES_DIR / mapping[spk]
        if not ref.exists():
            print(f"\n[Error] Reference voice not found: {ref}")
            print("  Update voices/mapping.json or delete it to re-map.")
            sys.exit(1)

    # 8. ChatterboxMultilingualTTS 모델 로드
    print("\n[Model] Loading ChatterboxMultilingualTTS...")
    print("[Model] First run downloads ~500MB — ensure network connection and disk space.")

    # GPU(CUDA) 사용 가능 여부 확인. 불가능하면 CPU 사용
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[Model] Device: {device}")

    model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    sample_rate = model.sr
    print(f"[Model] Loaded (sample rate: {sample_rate} Hz)")

    # 9. 음성 복제로 한국어 음성 세그먼트 생성
    print("\n[Audio] Generating Korean speech with voice cloning...")
    print(f"[Audio] exaggeration={EXAGGERATION}, cfg_weight={CFG_WEIGHT}")
    segments = []
    silence = torch.zeros(1, int(SILENCE_SEC * sample_rate))  # CPU 텐서

    rows = list(df.iterrows())
    # tqdm: 반복 작업의 진행률을 프로그레스 바로 표시함
    for i, (_, row) in enumerate(tqdm(rows, desc="Generating")):
        spk     = str(row["speaker"])
        text    = str(row["text"])
        ref_wav = str(VOICES_DIR / mapping[spk])

        wav = model.generate(
            text,
            language_id=LANGUAGE,
            audio_prompt_path=ref_wav,
            exaggeration=EXAGGERATION,
            cfg_weight=CFG_WEIGHT,
        )
        # CPU로 이동 후 목록에 추가 (torch.cat 전 정규화)
        segments.append(wav.cpu())
        if i < len(rows) - 1:
            segments.append(silence)

    if not segments:
        print("\n[Error] No audio segments generated.")
        sys.exit(1)

    # 10. 세그먼트 연결, 정규화, 16-bit PCM WAV 저장
    print("\n[Audio] Concatenating segments...")
    # torch.cat: 텐서 목록을 시간 축(dim=1)으로 이어 붙임 → shape: [1, T]
    final = torch.cat(segments, dim=1)
    final_np = final.squeeze(0).cpu().numpy().astype(np.float32)

    max_val = np.max(np.abs(final_np))
    if max_val > 0:
        final_np = final_np / max_val * 0.95

    final_int16 = (final_np * 32767).astype(np.int16)
    # 오디오 데이터를 16-bit PCM WAV 파일로 저장함
    wavfile.write(str(output_path), sample_rate, final_int16)

    duration = len(final_int16) / sample_rate
    print(f"\n[Done] Output  : {output_path}")
    print(f"[Done] Duration: {duration:.2f}s | Sample rate: {sample_rate} Hz")
    print("[Note] Perth watermark is automatically embedded in the output audio.")
    print("\n" + "=" * 60)
    print("Voice Cloning Complete!")
    print("=" * 60)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
