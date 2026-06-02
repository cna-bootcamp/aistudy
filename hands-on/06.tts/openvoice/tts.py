"""
OpenVoice V2 TTS — 음성 복제(Voice Cloning) 실습.
아래 2단계 파이프라인으로 동작함:
  [1] MeloTTS (language='KR')  — 기본 한국어 음성 합성
  [2] ToneColorConverter        — 참조 음성의 톤 컬러를 합성 음성에 이전
"""

import os
import sys

# HF_HUB_DISABLE_SYMLINKS_WARNING: Windows에서 HuggingFace 심링크 경고 억제 (동작에는 영향 없음)
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
# TOKENIZERS_PARALLELISM: 포크 시 tokenizers 병렬 처리 경고 억제
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

# PyTorch 2.6+에서 weights_only 기본값이 True로 변경되어 OpenVoice .pth 로딩이 깨짐.
import torch as _torch
_orig_load = _torch.load
def _patched_load(f, *args, **kwargs):
    kwargs.setdefault("weights_only", False)
    return _orig_load(f, *args, **kwargs)
# 라이브러리 내부 함수를 수정된 버전으로 교체함 (monkey-patch)
_torch.load = _patched_load

import json
import shutil
import subprocess
import tempfile
import urllib.request
import zipfile
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import scipy.io.wavfile as wavfile
from tqdm import tqdm

# 이 파일이 위치한 디렉터리 경로를 구함
SCRIPT_DIR    = Path(__file__).parent
TTS_ROOT      = SCRIPT_DIR.parent
VOICES_DIR    = SCRIPT_DIR / "voices"
MAPPING_FILE  = VOICES_DIR / "mapping.json"
CHECKPOINT_DIR = SCRIPT_DIR / "checkpoints_v2"

# V2 공식 체크포인트 아카이브 (converter/ + base_speakers/ses/ 포함)
CHECKPOINT_URL = "https://myshell-public-repo-host.s3.amazonaws.com/openvoice/checkpoints_v2_0417.zip"

SILENCE_SEC = 0.2
MELO_SPEED  = 1.0
# ffmpeg가 지원하는 포맷 — 비-WAV 파일은 SE 추출 전 자동 변환됨
VOICE_EXTENSIONS = ("*.wav", "*.mp3", "*.m4a", "*.flac", "*.ogg", "*.aac",
                    "*.wma", "*.opus", "*.aiff", "*.aif", "*.webm")


# ============================================================
# 사전 요건 검사
# ============================================================

def check_prerequisites() -> None:
    """PyTorch, openvoice, MeloTTS, MeCab 설치 여부를 확인하고, 미설치 시 안내 후 종료함."""
    try:
        import torch  # noqa: F401
    except ImportError:
        print("\n[Error] PyTorch not installed.")
        print("  Install guide: https://github.com/cna-bootcamp/aistudy/blob/main/agentic-ai/reference/install-pytorch.md")
        sys.exit(1)

    import importlib.util
    missing = []
    for pkg, name in [("openvoice", "openvoice"), ("melo", "MeloTTS")]:
        try:
            spec = importlib.util.find_spec(pkg)
            if spec is None:
                missing.append(name)
        except (ModuleNotFoundError, ValueError):
            missing.append(name)

    if missing:
        print(f"\n[Error] Required packages not installed: {', '.join(missing)}")
        print("  pip install git+https://github.com/myshell-ai/OpenVoice.git --no-deps")
        print("  pip install git+https://github.com/myshell-ai/MeloTTS.git --no-deps")
        print("  pip install mecab-python3==1.0.9 && pip install fugashi")
        print("  pip install unidic-lite")
        sys.exit(1)

    # mecab-python3 / fugashi — 별도 설치 필요 (사전 빌드 휠만 지원)
    mecab_missing = []
    for pkg, install_cmd in [("MeCab", "pip install mecab-python3==1.0.9"),
                              ("fugashi", "pip install fugashi")]:
        try:
            spec = importlib.util.find_spec(pkg)
            if spec is None:
                mecab_missing.append(install_cmd)
        except (ModuleNotFoundError, ValueError):
            mecab_missing.append(install_cmd)
    if mecab_missing:
        print("\n[Error] MeloTTS requires mecab-python3 and fugashi (pre-built wheels, install separately):")
        for cmd in mecab_missing:
            print(f"  {cmd}")
        sys.exit(1)

    try:
        import MeCab
        MeCab.Tagger()
    except RuntimeError as exc:
        error_text = str(exc)
        print("\n[Error] MeCab failed to initialize.")
        if "unidic\\dicdir\\mecabrc" in error_text or "unidic/dicdir/mecabrc" in error_text:
            print("  Full unidic is installed without its dictionary.")
            print("  Use the packaged unidic-lite dictionary instead:")
            print("  pip uninstall -y unidic")
            print("  pip install unidic-lite")
        else:
            print(f"  {error_text}")
        sys.exit(1)


# ============================================================
# 체크포인트 다운로드
# ============================================================

def download_checkpoints() -> None:
    """V2 체크포인트가 없으면 S3에서 다운로드하여 압축 해제함."""
    converter_dir = CHECKPOINT_DIR / "converter"
    ses_dir       = CHECKPOINT_DIR / "base_speakers" / "ses"

    if converter_dir.exists() and ses_dir.exists() and any(ses_dir.glob("*.pth")):
        print(f"[Checkpoint] Already downloaded at {CHECKPOINT_DIR}")
        return

    print(f"[Checkpoint] Downloading V2 checkpoints (~200 MB)...")
    print(f"  URL: {CHECKPOINT_URL}")
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

    zip_path = CHECKPOINT_DIR / "checkpoints_v2.zip"
    try:
        with urllib.request.urlopen(CHECKPOINT_URL) as resp:
            total = int(resp.headers.get("Content-Length", 0))
            downloaded = 0
            with open(zip_path, "wb") as f:
                chunk_size = 1024 * 64
                while True:
                    chunk = resp.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total:
                        pct = downloaded / total * 100
                        print(f"\r  {pct:.1f}%  ({downloaded // 1024 // 1024} MB)", end="", flush=True)
        print()
        print("[Checkpoint] Download complete. Extracting...")

        # 임시 디렉터리에 먼저 압축 해제 후 체크포인트 디렉터리를 위치에 상관없이 탐색·이동
        with tempfile.TemporaryDirectory() as tmp_extract:
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(tmp_extract)

            tmp_root = Path(tmp_extract)
            # zip 최상위 디렉터리명에 관계없이 converter/와 base_speakers/ 탐색
            converter_src = next(tmp_root.rglob("converter/config.json"), None)
            ses_src       = next(tmp_root.rglob("base_speakers/ses/kr.pth"), None)

            if converter_src is None or ses_src is None:
                raise FileNotFoundError(
                    "Expected converter/config.json and base_speakers/ses/kr.pth "
                    "not found in the downloaded archive."
                )

            ckpt_root = converter_src.parent.parent  # …/checkpoints_v2/
            CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
            for item in ckpt_root.iterdir():
                dst = CHECKPOINT_DIR / item.name
                if dst.exists():
                    shutil.rmtree(dst) if dst.is_dir() else dst.unlink()
                shutil.copytree(item, dst) if item.is_dir() else shutil.copy2(item, dst)

        zip_path.unlink(missing_ok=True)
        print(f"[Checkpoint] Extracted to {CHECKPOINT_DIR}")

    except Exception as e:
        print(f"\n[Error] Checkpoint download failed: {e}")
        print("  Manual download:")
        print(f"  1. Download {CHECKPOINT_URL}")
        print(f"  2. Extract checkpoints_v2/ into {SCRIPT_DIR}")
        if zip_path.exists():
            zip_path.unlink()
        sys.exit(1)


# ============================================================
# 참조 음성 관리
# ============================================================

def scan_voices() -> List[Path]:
    """비-WAV 음성 파일을 ffmpeg로 WAV 변환 후, WAV 파일 목록을 정렬하여 반환함."""
    VOICES_DIR.mkdir(parents=True, exist_ok=True)

    non_wav: List[Path] = []
    for ext in VOICE_EXTENSIONS:
        if ext != "*.wav":
            non_wav.extend(VOICES_DIR.glob(ext))

    for src in sorted(non_wav):
        dst = VOICES_DIR / (src.stem + ".wav")
        if dst.exists():
            print(f"[Voice] {src.name} → {dst.name} (already converted, skip)")
            continue
        print(f"[Voice] Converting {src.name} → {dst.name} ...")
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", str(src), str(dst)],
            capture_output=True,
        )
        if result.returncode != 0:
            print(f"[Voice] Warning: ffmpeg failed for {src.name}")
            print(f"  {result.stderr.decode(errors='replace').strip()}")
        else:
            print(f"[Voice] Saved: {dst.name}")

    return sorted(VOICES_DIR.glob("*.wav"))


def normalize_mapping(mapping: Dict[str, str]) -> Dict[str, str]:
    """매핑의 비-WAV 파일명을 변환된 WAV 파일명으로 마이그레이션하여 반환함."""
    updated = {}
    for spk, fname in mapping.items():
        p = Path(fname)
        if p.suffix.lower() != ".wav":
            wav_name = p.stem + ".wav"
            if (VOICES_DIR / wav_name).exists():
                print(f"[Mapping] Migrated {spk}: {fname} → {wav_name}")
                updated[spk] = wav_name
            else:
                updated[spk] = fname
        else:
            updated[spk] = fname
    return updated


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
    for i, vf in enumerate(voice_files, 1):
        size_kb = vf.stat().st_size // 1024
        print(f"  {i:2}. {vf.name}  ({size_kb} KB)")
    print("=" * 60)

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
# 오디오 유틸리티
# ============================================================

def make_silence(duration_sec: float, sample_rate: int) -> np.ndarray:
    """지정 길이(초)의 무음 float32 배열을 생성하여 반환함."""
    return np.zeros(int(duration_sec * sample_rate), dtype=np.float32)


def read_wav_float(path: str) -> tuple:
    """WAV 파일을 읽어 (float32 배열, 샘플레이트) 튜플로 반환함."""
    sr, data = wavfile.read(path)
    if data.dtype == np.int16:
        audio = data.astype(np.float32) / 32768.0
    elif data.dtype == np.int32:
        audio = data.astype(np.float32) / 2147483648.0
    else:
        audio = data.astype(np.float32)
    if audio.ndim == 2:
        audio = audio.mean(axis=1)
    return audio, sr


# ============================================================
# 진입점
# ============================================================

def main() -> None:
    """OpenVoice V2 음성 복제 TTS 전체 파이프라인을 실행함."""
    # Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    print("=" * 60)
    print("OpenVoice V2 — Voice Cloning TTS")
    print("Pipeline: MeloTTS (KR) → ToneColorConverter")
    print("=" * 60)

    # 1. 사전 요건 검사
    check_prerequisites()

    # 2. 체크포인트 다운로드 (없는 경우)
    download_checkpoints()

    # 3. 경로 설정
    input_path  = TTS_ROOT / "text" / "dialog.csv"
    output_path = SCRIPT_DIR / "result.wav"

    # 4. 참조 음성 탐색
    voice_files = scan_voices()
    if not voice_files:
        print(f"\n[Error] No voice files found in {VOICES_DIR}")
        print("  Place reference voice files in the voices/ directory.")
        print("  Supported: WAV (direct) or any ffmpeg format (MP3/M4A/FLAC/OGG/AAC etc.)")
        print("  Non-WAV files are auto-converted to WAV and saved in voices/ on first run.")
        sys.exit(1)
    print(f"\n[Voices] {len(voice_files)} reference voice(s):")
    for vf in voice_files:
        print(f"  - {vf.name}")

    # 5. 대화 파일 로드
    print(f"\n[Load] Reading dialog from {input_path.name}...")
    df = load_dialog(input_path)
    print(f"[Load] {len(df)} lines, {df['speaker'].nunique()} speakers")
    speakers: List[str] = list(dict.fromkeys(df["speaker"].astype(str).tolist()))
    print(f"[Load] Speakers: {speakers}")

    # 6. 화자별 음성 매핑
    mapping = load_mapping()
    if mapping:
        mapping = normalize_mapping(mapping)
    need_save = False

    if mapping is None:
        print("\n[Mapping] No mapping file. Select reference voices for each speaker.")
        mapping = {}
        need_save = True
    else:
        missing = [s for s in speakers if s not in mapping]
        if missing:
            print(f"\n[Mapping] New speakers: {missing}. Select reference voices.")
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
                mapping = {}
                need_save = True

    for spk in speakers:
        if spk not in mapping:
            mapping[spk] = select_voice_for_speaker(spk, voice_files)

    if need_save:
        save_mapping(mapping)

    print("\n[Mapping] Speaker → Reference Voice")
    for spk in speakers:
        print(f"  {spk} → {mapping.get(spk, '(not mapped)')}")

    # 7. 매핑된 음성 파일 존재 여부 검증
    for spk in speakers:
        ref = VOICES_DIR / mapping[spk]
        if not ref.exists():
            print(f"\n[Error] Reference voice not found: {ref}")
            print("  Update voices/mapping.json or re-run to remap.")
            sys.exit(1)

    # 8. OpenVoice V2 모델 로드
    import torch
    # ToneColorConverter: OpenVoice의 톤 컬러 이전 모듈 — 참조 음성의 음색을 합성 음성에 적용함
    from openvoice.api import ToneColorConverter
    # MeloTTS: MyShell의 다국어 TTS 모델 — 1단계 기본 한국어 음성 합성에 사용
    from melo.api import TTS as MeloTTS

    # GPU(CUDA) 사용 가능 여부 확인. 불가능하면 CPU 사용
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\n[Model] Device: {device}")

    # 8a. ToneColorConverter 로드
    ckpt_converter = CHECKPOINT_DIR / "converter"
    config_path    = ckpt_converter / "config.json"
    ckpt_path      = ckpt_converter / "checkpoint.pth"

    for p in (config_path, ckpt_path):
        if not p.exists():
            print(f"\n[Error] Checkpoint file missing: {p}")
            print(f"  Re-run to re-download, or manually extract checkpoints_v2/ to {SCRIPT_DIR}")
            sys.exit(1)

    print("[Model] Loading ToneColorConverter...")
    converter = ToneColorConverter(str(config_path), device=device)
    converter.load_ckpt(str(ckpt_path))
    sample_rate: int = converter.hps.data.sampling_rate
    print(f"[Model] ToneColorConverter loaded (sample rate: {sample_rate} Hz)")

    # 8b. 소스 SE — 사전 추출된 KR 화자 임베딩 로드
    src_se_path = CHECKPOINT_DIR / "base_speakers" / "ses" / "kr.pth"
    if not src_se_path.exists():
        print(f"\n[Error] KR source speaker embedding not found: {src_se_path}")
        print("  The checkpoints_v2 archive must contain base_speakers/ses/kr.pth")
        sys.exit(1)
    src_se = torch.load(str(src_se_path), map_location=device)
    print(f"[Model] Source SE loaded from {src_se_path.name}")

    # 8c. MeloTTS 로드
    print("[Model] Loading MeloTTS (KR)...")
    melo_model = MeloTTS(language="KR", device=device)
    speaker_ids = melo_model.hps.data.spk2id
    kr_spk_id = speaker_ids["KR"] if "KR" in speaker_ids else next(iter(speaker_ids.values()))
    print(f"[Model] MeloTTS loaded (speaker_id: {kr_spk_id})")

    # 9. 화자별 타겟 SE 사전 추출 (라인별 재추출 방지)
    # scan_voices()에서 모든 참조 음성을 WAV로 변환했으므로 직접 로딩 가능
    print("\n[SE] Extracting target speaker embeddings from reference voices...")
    target_ses: Dict[str, object] = {}
    for spk in speakers:
        ref_path = VOICES_DIR / mapping[spk]
        print(f"  {spk} → {mapping[spk]}")
        tgt_se = converter.extract_se([str(ref_path)])
        target_ses[spk] = tgt_se

    # 10. 라인별 음성 합성 (파일 기반 파이프라인)
    print("\n[Audio] Generating voice-cloned Korean speech...")
    segments: List[np.ndarray] = []
    silence   = make_silence(SILENCE_SEC, sample_rate)

    with tempfile.TemporaryDirectory() as tmp_dir:
        rows = list(df.iterrows())
        # tqdm: 반복 작업의 진행률을 프로그레스 바로 표시함
        for i, (_, row) in enumerate(tqdm(rows, desc="Generating")):
            spk  = str(row["speaker"])
            text = str(row["text"])

            # 1단계: MeloTTS → 임시 WAV
            tmp_base = str(Path(tmp_dir) / f"seg_{i:04d}")
            tmp_melo = tmp_base + "_melo.wav"
            melo_model.tts_to_file(text, kr_spk_id, tmp_melo, speed=MELO_SPEED)

            # 2단계: ToneColorConverter → 출력 WAV
            tmp_out = tmp_base + "_out.wav"
            converter.convert(
                audio_src_path=tmp_melo,
                src_se=src_se,
                tgt_se=target_ses[spk],
                output_path=tmp_out,
                message="@MyShell",
            )

            audio, _ = read_wav_float(tmp_out)
            segments.append(audio)
            if i < len(rows) - 1:
                segments.append(silence)

    if not segments:
        print("\n[Error] No audio segments generated.")
        sys.exit(1)

    # 11. 세그먼트 연결, 정규화, 16-bit PCM WAV 저장
    print("\n[Audio] Concatenating segments...")
    final = np.concatenate(segments)

    max_val = np.max(np.abs(final))
    if max_val > 0:
        final = final / max_val * 0.95

    final_int16 = (final * 32767).astype(np.int16)
    # 오디오 데이터를 16-bit PCM WAV 파일로 저장함
    wavfile.write(str(output_path), sample_rate, final_int16)

    duration = len(final) / sample_rate
    print(f"\n[Done] Output  : {output_path}")
    print(f"[Done] Duration: {duration:.2f}s  |  Sample rate: {sample_rate} Hz")
    print("\n" + "=" * 60)
    print("Voice Cloning Complete!")
    print("=" * 60)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
