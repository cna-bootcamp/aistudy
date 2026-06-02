"""
Kakao VITS TTS — 다화자 텍스트 음성 합성 실습.
Kakao Enterprise의 VITS(vits-vctk) 모델로 다화자 음성을 합성함.
- 사전 요건 검사: PyTorch, espeak-ng
- 한국어→영어 번역 (파일 캐싱 지원)
- 108개 VCTK 화자를 억양 그룹별로 분류하여 화자별 음성 선택
- WAV 파일 출력 (16-bit PCM, 22050 Hz)
"""

import os
import sys

# Windows espeak-ng PATH 설정 — phonemizer import 전에 반드시 실행해야 함
_ESPEAK_PATHS = [
    r"C:\Program Files\eSpeak NG",
    r"C:\Program Files (x86)\eSpeak NG",
]
for _p in _ESPEAK_PATHS:
    if os.path.exists(_p):
        # PATH: espeak-ng 실행 파일 경로를 시스템 PATH에 추가함
        os.environ["PATH"] = _p + os.pathsep + os.environ.get("PATH", "")
        # PHONEMIZER_ESPEAK_LIBRARY: phonemizer가 사용할 espeak-ng DLL 경로
        os.environ["PHONEMIZER_ESPEAK_LIBRARY"] = os.path.join(_p, "libespeak-ng.dll")
        # PHONEMIZER_ESPEAK_PATH: phonemizer가 사용할 espeak-ng 실행 파일 경로
        os.environ["PHONEMIZER_ESPEAK_PATH"] = os.path.join(_p, "espeak-ng.exe")
        break

import re
import shutil
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from tqdm import tqdm

# 이 파일이 위치한 디렉터리 경로를 구함
SCRIPT_DIR = Path(__file__).parent   # hands-on/06.tts/kakao-vits/
TTS_ROOT   = SCRIPT_DIR.parent       # hands-on/06.tts/

# ============================================================
# VCTK 화자 데이터베이스 (108명)
# ============================================================
VCTK_SPEAKERS: Dict[int, Dict] = {
    0:   {"id": "p225", "gender": "F", "age": 23, "accent": "English",       "region": "Southern England"},
    1:   {"id": "p226", "gender": "M", "age": 22, "accent": "English",       "region": "Surrey"},
    2:   {"id": "p227", "gender": "M", "age": 38, "accent": "English",       "region": "Cumbria"},
    3:   {"id": "p228", "gender": "F", "age": 22, "accent": "English",       "region": "Southern England"},
    4:   {"id": "p229", "gender": "F", "age": 23, "accent": "English",       "region": "Southern England"},
    5:   {"id": "p230", "gender": "F", "age": 22, "accent": "English",       "region": "Stockton-on-tees"},
    6:   {"id": "p231", "gender": "F", "age": 23, "accent": "English",       "region": "Southern England"},
    7:   {"id": "p232", "gender": "M", "age": 23, "accent": "English",       "region": "Southern England"},
    8:   {"id": "p233", "gender": "F", "age": 23, "accent": "English",       "region": "Staffordshire"},
    9:   {"id": "p234", "gender": "F", "age": 22, "accent": "Scottish",      "region": "West Dumfries"},
    10:  {"id": "p236", "gender": "F", "age": 23, "accent": "English",       "region": "Manchester"},
    11:  {"id": "p237", "gender": "M", "age": 22, "accent": "Scottish",      "region": "Fife"},
    12:  {"id": "p238", "gender": "F", "age": 22, "accent": "English",       "region": "Northampton"},
    13:  {"id": "p239", "gender": "F", "age": 22, "accent": "English",       "region": "Southwest England"},
    14:  {"id": "p240", "gender": "F", "age": 21, "accent": "English",       "region": "Southern England"},
    15:  {"id": "p241", "gender": "M", "age": 21, "accent": "Scottish",      "region": "Perth"},
    16:  {"id": "p243", "gender": "M", "age": 22, "accent": "English",       "region": "London"},
    17:  {"id": "p244", "gender": "F", "age": 22, "accent": "English",       "region": "Manchester"},
    18:  {"id": "p245", "gender": "M", "age": 23, "accent": "Irish",         "region": "Dublin"},
    19:  {"id": "p246", "gender": "M", "age": 22, "accent": "Scottish",      "region": "Edinburgh"},
    20:  {"id": "p247", "gender": "M", "age": 22, "accent": "Scottish",      "region": "Argyll"},
    21:  {"id": "p248", "gender": "F", "age": 23, "accent": "Indian",        "region": "India"},
    22:  {"id": "p249", "gender": "F", "age": 22, "accent": "Scottish",      "region": "Edinburgh"},
    23:  {"id": "p250", "gender": "F", "age": 22, "accent": "English",       "region": "Southeast England"},
    24:  {"id": "p251", "gender": "M", "age": 26, "accent": "Indian",        "region": "India"},
    25:  {"id": "p252", "gender": "M", "age": 22, "accent": "Scottish",      "region": "Edinburgh"},
    26:  {"id": "p253", "gender": "F", "age": 22, "accent": "Welsh",         "region": "Cardiff"},
    27:  {"id": "p254", "gender": "M", "age": 21, "accent": "English",       "region": "Surrey"},
    28:  {"id": "p255", "gender": "M", "age": 19, "accent": "Scottish",      "region": "Fife"},
    29:  {"id": "p256", "gender": "M", "age": 24, "accent": "English",       "region": "Birmingham"},
    30:  {"id": "p257", "gender": "F", "age": 24, "accent": "English",       "region": "Southern England"},
    31:  {"id": "p258", "gender": "M", "age": 22, "accent": "English",       "region": "Southern England"},
    32:  {"id": "p259", "gender": "M", "age": 23, "accent": "English",       "region": "Nottingham"},
    33:  {"id": "p260", "gender": "M", "age": 21, "accent": "Irish",         "region": "Dublin"},
    34:  {"id": "p261", "gender": "F", "age": 30, "accent": "NorthernIrish", "region": "Belfast"},
    35:  {"id": "p262", "gender": "F", "age": 23, "accent": "Scottish",      "region": "Edinburgh"},
    36:  {"id": "p263", "gender": "M", "age": 22, "accent": "Scottish",      "region": "Aberdeen"},
    37:  {"id": "p264", "gender": "F", "age": 23, "accent": "Scottish",      "region": "Falkirk"},
    38:  {"id": "p265", "gender": "F", "age": 23, "accent": "Scottish",      "region": "Dumfries"},
    39:  {"id": "p266", "gender": "F", "age": 22, "accent": "Irish",         "region": "Dublin"},
    40:  {"id": "p267", "gender": "F", "age": 23, "accent": "English",       "region": "Yorkshire"},
    41:  {"id": "p268", "gender": "F", "age": 23, "accent": "English",       "region": "Southern England"},
    42:  {"id": "p269", "gender": "F", "age": 20, "accent": "English",       "region": "Newcastle"},
    43:  {"id": "p270", "gender": "M", "age": 21, "accent": "English",       "region": "Yorkshire"},
    44:  {"id": "p271", "gender": "M", "age": 19, "accent": "Scottish",      "region": "Edinburgh"},
    45:  {"id": "p272", "gender": "M", "age": 26, "accent": "Scottish",      "region": "Edinburgh"},
    46:  {"id": "p273", "gender": "M", "age": 23, "accent": "English",       "region": "Suffolk"},
    47:  {"id": "p274", "gender": "M", "age": 22, "accent": "English",       "region": "Essex"},
    48:  {"id": "p275", "gender": "M", "age": 23, "accent": "Scottish",      "region": "Aberdeen"},
    49:  {"id": "p276", "gender": "F", "age": 24, "accent": "English",       "region": "Oxford"},
    50:  {"id": "p277", "gender": "F", "age": 23, "accent": "English",       "region": "NE England"},
    51:  {"id": "p278", "gender": "M", "age": 22, "accent": "English",       "region": "Cheshire"},
    52:  {"id": "p279", "gender": "M", "age": 23, "accent": "English",       "region": "Leicester"},
    53:  {"id": "p280", "gender": "M", "age": 21, "accent": "American",      "region": "US"},
    54:  {"id": "p281", "gender": "M", "age": 28, "accent": "Scottish",      "region": "Glasgow"},
    55:  {"id": "p282", "gender": "F", "age": 21, "accent": "Scottish",      "region": "Edinburgh"},
    56:  {"id": "p283", "gender": "F", "age": 23, "accent": "Irish",         "region": "Cork"},
    57:  {"id": "p284", "gender": "M", "age": 25, "accent": "English",       "region": "Lancashire"},
    58:  {"id": "p285", "gender": "M", "age": 19, "accent": "Scottish",      "region": "Edinburgh"},
    59:  {"id": "p286", "gender": "M", "age": 23, "accent": "English",       "region": "Newcastle"},
    60:  {"id": "p287", "gender": "M", "age": 23, "accent": "English",       "region": "Yorkshire"},
    61:  {"id": "p288", "gender": "F", "age": 22, "accent": "Irish",         "region": "Dublin"},
    62:  {"id": "p292", "gender": "M", "age": 23, "accent": "NorthernIrish", "region": "Belfast"},
    63:  {"id": "p293", "gender": "F", "age": 22, "accent": "American",      "region": "US"},
    64:  {"id": "p294", "gender": "F", "age": 33, "accent": "American",      "region": "US"},
    65:  {"id": "p295", "gender": "F", "age": 25, "accent": "Irish",         "region": "Dublin"},
    66:  {"id": "p297", "gender": "F", "age": 20, "accent": "American",      "region": "New York"},
    67:  {"id": "p298", "gender": "M", "age": 21, "accent": "Irish",         "region": "Meath"},
    68:  {"id": "p299", "gender": "F", "age": 25, "accent": "American",      "region": "US"},
    69:  {"id": "p300", "gender": "F", "age": 23, "accent": "American",      "region": "California"},
    70:  {"id": "p301", "gender": "F", "age": 23, "accent": "American",      "region": "North Carolina"},
    71:  {"id": "p302", "gender": "M", "age": 28, "accent": "Canadian",      "region": "Canada"},
    72:  {"id": "p303", "gender": "F", "age": 23, "accent": "Indian",        "region": "India"},
    73:  {"id": "p304", "gender": "M", "age": 24, "accent": "NorthernIrish", "region": "Belfast"},
    74:  {"id": "p305", "gender": "F", "age": 19, "accent": "American",      "region": "US"},
    75:  {"id": "p306", "gender": "F", "age": 24, "accent": "American",      "region": "US"},
    76:  {"id": "p307", "gender": "F", "age": 23, "accent": "Canadian",      "region": "Canada"},
    77:  {"id": "p308", "gender": "F", "age": 23, "accent": "Indian",        "region": "India"},
    78:  {"id": "p310", "gender": "F", "age": 21, "accent": "American",      "region": "US"},
    79:  {"id": "p311", "gender": "M", "age": 21, "accent": "American",      "region": "US"},
    80:  {"id": "p312", "gender": "F", "age": 21, "accent": "Canadian",      "region": "Canada"},
    81:  {"id": "p313", "gender": "F", "age": 20, "accent": "Indian",        "region": "India"},
    82:  {"id": "p314", "gender": "F", "age": 19, "accent": "SouthAfrican",  "region": "South Africa"},
    83:  {"id": "p316", "gender": "M", "age": 20, "accent": "Canadian",      "region": "Canada"},
    84:  {"id": "p317", "gender": "F", "age": 23, "accent": "Canadian",      "region": "Canada"},
    85:  {"id": "p318", "gender": "F", "age": 20, "accent": "Welsh",         "region": "Wales"},
    86:  {"id": "p323", "gender": "F", "age": 19, "accent": "SouthAfrican",  "region": "South Africa"},
    87:  {"id": "p326", "gender": "M", "age": 21, "accent": "Irish",         "region": "Ireland"},
    88:  {"id": "p329", "gender": "F", "age": 23, "accent": "American",      "region": "US"},
    89:  {"id": "p330", "gender": "F", "age": 19, "accent": "American",      "region": "US"},
    90:  {"id": "p333", "gender": "F", "age": 23, "accent": "English",       "region": "Liverpool"},
    91:  {"id": "p334", "gender": "M", "age": 18, "accent": "Irish",         "region": "Dublin"},
    92:  {"id": "p335", "gender": "F", "age": 18, "accent": "English",       "region": "Birmingham"},
    93:  {"id": "p336", "gender": "F", "age": 24, "accent": "Scottish",      "region": "Fife"},
    94:  {"id": "p339", "gender": "F", "age": 21, "accent": "American",      "region": "US"},
    95:  {"id": "p340", "gender": "F", "age": 25, "accent": "English",       "region": "London"},
    96:  {"id": "p341", "gender": "F", "age": 24, "accent": "American",      "region": "US"},
    97:  {"id": "p343", "gender": "F", "age": 25, "accent": "Canadian",      "region": "Canada"},
    98:  {"id": "p345", "gender": "M", "age": 21, "accent": "American",      "region": "US"},
    99:  {"id": "p347", "gender": "M", "age": 27, "accent": "Indian",        "region": "India"},
    100: {"id": "p351", "gender": "F", "age": 21, "accent": "Indian",        "region": "India"},
    101: {"id": "p360", "gender": "M", "age": 21, "accent": "American",      "region": "US"},
    102: {"id": "p361", "gender": "F", "age": 26, "accent": "NewZealand",    "region": "New Zealand"},
    103: {"id": "p362", "gender": "F", "age": 29, "accent": "American",      "region": "US"},
    104: {"id": "p363", "gender": "M", "age": 22, "accent": "Canadian",      "region": "Canada"},
    105: {"id": "p364", "gender": "M", "age": 31, "accent": "Welsh",         "region": "Wales"},
    106: {"id": "p374", "gender": "M", "age": 24, "accent": "English",       "region": "Southern England"},
    107: {"id": "p376", "gender": "M", "age": 22, "accent": "English",       "region": "Kent"},
}


# ============================================================
# 사전 요건 검사
# ============================================================

def check_prerequisites() -> None:
    """PyTorch 및 espeak-ng 설치 여부를 확인하고, 미설치 시 안내 후 종료함."""
    missing = []

    try:
        import torch  # noqa: F401
    except ImportError:
        missing.append("pytorch")

    espeak_found = shutil.which("espeak-ng") is not None
    if not espeak_found:
        espeak_found = any(os.path.exists(p) for p in _ESPEAK_PATHS)
    if not espeak_found:
        missing.append("espeak-ng")

    if not missing:
        return

    print("\n[Error] Required dependencies not found:\n")

    if "pytorch" in missing:
        print("  [PyTorch]")
        print("  Install guide: https://github.com/cna-bootcamp/aistudy/blob/main/agentic-ai/reference/install-pytorch.md")
        print()

    if "espeak-ng" in missing:
        print("  [espeak-ng]")
        print("  Windows : https://github.com/espeak-ng/espeak-ng/releases (MSI installer)")
        print("  macOS   : brew install espeak-ng")
        print("  Linux   : sudo apt install espeak-ng")
        print()

    sys.exit(1)


# ============================================================
# 번역 캐시
# ============================================================

def _cache_path() -> Path:
    """영어 번역 캐시 파일 경로를 반환함."""
    cache_dir = SCRIPT_DIR / "translations"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / "dialog_en.csv"


def load_translation_cache() -> Dict[str, str]:
    """파일에서 영어 번역 캐시를 로드하여 {원문: 번역문} 딕셔너리로 반환함."""
    path = _cache_path()
    cache: Dict[str, str] = {}
    if path.exists():
        try:
            df = pd.read_csv(path, sep="|", encoding="utf-8")
            if "original" in df.columns and "translated" in df.columns:
                for _, row in df.iterrows():
                    cache[str(row["original"])] = str(row["translated"])
            print(f"[Cache] Loaded {len(cache)} translations from {path.name}")
        except Exception as e:
            print(f"[Cache] Failed to load cache: {e}")
    return cache


def save_translation_cache(cache: Dict[str, str]) -> None:
    """영어 번역 캐시를 파일에 저장함."""
    path = _cache_path()
    try:
        df = pd.DataFrame([{"original": k, "translated": v} for k, v in cache.items()])
        df.to_csv(path, sep="|", index=False, encoding="utf-8")
        print(f"[Cache] Saved {len(cache)} translations to {path.name}")
    except Exception as e:
        print(f"[Cache] Failed to save cache: {e}")


# ============================================================
# 번역
# ============================================================

def translate_to_english(text: str, cache: Dict[str, str]) -> str:
    """deep-translator를 사용해 텍스트를 영어로 번역하고 반환함 (캐시 활용)."""
    if text in cache:
        return cache[text]

    if text.isascii():
        cache[text] = text
        return text

    try:
        from deep_translator import GoogleTranslator
        result = GoogleTranslator(source="auto", target="en").translate(text)
        if result:
            cache[text] = result
            return result
    except Exception as e:
        print(f"[Translation] deep-translator error: {e}")

    # 번역 실패 시 ASCII 문자만 추출하여 반환 (폴백)
    ascii_only = text.encode("ascii", errors="ignore").decode("ascii").strip()
    if ascii_only:
        print(f"[Warning] Translation failed, using ASCII fallback: {ascii_only[:50]}")
        cache[text] = ascii_only
        return ascii_only

    print(f"[Warning] Non-ASCII text, no fallback available: {text[:30]}... → using placeholder")
    placeholder = "untranslated text"
    cache[text] = placeholder
    return placeholder


# ============================================================
# 음성 선택 UI
# ============================================================

def display_voice_menu(character_name: str) -> int:
    """억양 그룹별 화자 메뉴를 표시하고, 선택된 화자 인덱스를 반환함."""
    print(f"\n{'=' * 60}")
    print(f"Select Voice for '{character_name}'")
    print("=" * 60)

    # 억양별로 그룹화
    accents: Dict[str, List] = {}
    for idx, info in VCTK_SPEAKERS.items():
        accents.setdefault(info["accent"], []).append((idx, info))

    all_options: List[int] = []
    option_num = 1

    for accent in sorted(accents.keys()):
        print(f"\n  [{accent}]")
        for idx, info in accents[accent]:
            gender_str = "Female" if info["gender"] == "F" else "Male"
            print(f"    {option_num:3}. {info['id']} - {gender_str}, Age {info['age']}, {info['region']}")
            all_options.append(idx)
            option_num += 1

    print("\n" + "=" * 60)

    while True:
        try:
            choice = input(f"Enter number (1-{len(all_options)}): ").strip()
            idx = int(choice) - 1
            if 0 <= idx < len(all_options):
                selected = all_options[idx]
                info = VCTK_SPEAKERS[selected]
                print(f"Selected: {info['id']} ({info['gender']}, {info['accent']}, {info['region']})")
                return selected
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

    return df


# ============================================================
# 오디오 생성
# ============================================================

def sanitize_for_tts(text: str) -> str:
    """VITS 입력을 위해 비ASCII 문자를 제거하고 공백을 정규화하여 반환함."""
    if not text or not text.strip():
        return "silence"

    if not text.isascii():
        ascii_only = text.encode("ascii", errors="ignore").decode("ascii").strip()
        if not ascii_only:
            return "untranslated text"
        text = ascii_only

    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"[^\w\s.,!?'\"-]", "", text)
    return text if text else "silence"


def generate_segment(model, tokenizer, text: str, speaker_id: int, device) -> np.ndarray:
    """단일 텍스트 세그먼트의 파형을 생성하여 numpy 배열로 반환함."""
    import torch

    clean = sanitize_for_tts(text)
    inputs = tokenizer(clean, return_tensors="pt").to(device)

    with torch.no_grad():
        output = model(**inputs, speaker_id=torch.tensor([speaker_id]).to(device))

    return output.waveform.squeeze().cpu().numpy()


def make_silence(duration_sec: float, sample_rate: int) -> np.ndarray:
    """지정 길이(초)의 무음 float32 배열을 생성하여 반환함."""
    return np.zeros(int(duration_sec * sample_rate), dtype=np.float32)


# ============================================================
# 진입점
# ============================================================

def main() -> None:
    """Kakao VITS 다화자 TTS 전체 파이프라인을 실행함."""
    # Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    import torch
    import scipy.io.wavfile as wavfile
    # VitsModel: HuggingFace Transformers의 VITS TTS 모델 — kakao-enterprise/vits-vctk 사용
    from transformers import VitsModel, AutoTokenizer

    print("=" * 60)
    print("Kakao VITS TTS - Multi-speaker Text-to-Speech")
    print("Model : kakao-enterprise/vits-vctk (108 speakers)")
    print("=" * 60)

    # 1. 사전 요건 검사
    check_prerequisites()

    # 2. 경로 설정
    input_path  = TTS_ROOT / "text" / "dialog.csv"
    output_path = SCRIPT_DIR / "result.wav"

    # 3. 번역 캐시 로드
    cache = load_translation_cache()

    # 4. 대화 파일 로드
    print(f"\n[Load] Reading dialog from {input_path.name}...")
    df = load_dialog(input_path)
    print(f"[Load] {len(df)} lines loaded")

    # 5. 등장 순서를 유지한 고유 화자 목록
    speakers: List[str] = list(dict.fromkeys(df["speaker"].astype(str).tolist()))
    print(f"[Load] {len(speakers)} speakers found: {speakers}")

    # 6. 화자별 음성 선택
    speaker_voice: Dict[str, int] = {}
    for spk in speakers:
        speaker_voice[spk] = display_voice_menu(spk)

    print("\n" + "=" * 60)
    print("Voice Assignment")
    print("=" * 60)
    for spk, vid in speaker_voice.items():
        info = VCTK_SPEAKERS[vid]
        print(f"  {spk}: {info['id']} ({info['gender']}, {info['accent']}, {info['region']})")

    # 7. 한국어→영어 번역
    print("\n[Translation] Translating to English...")
    texts_raw = df["text"].astype(str).tolist()
    translated: List[str] = []
    new_count = 0

    # tqdm: 반복 작업의 진행률을 프로그레스 바로 표시함
    for text in tqdm(texts_raw, desc="Translating"):
        before = len(cache)
        en = translate_to_english(text, cache)
        if len(cache) > before:
            new_count += 1
        translated.append(en)

    if new_count > 0:
        save_translation_cache(cache)
        print(f"[Translation] {new_count} new translations cached")
    else:
        print("[Translation] All loaded from cache")

    # 8. 모델 로드
    print("\n[Model] Loading kakao-enterprise/vits-vctk...")
    print("[Model] First run will download the model (~500 MB)...")

    # GPU(CUDA) 사용 가능 여부 확인. 불가능하면 CPU 사용
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[Model] Device: {device}")

    model = VitsModel.from_pretrained("kakao-enterprise/vits-vctk").to(device)
    tokenizer = AutoTokenizer.from_pretrained("kakao-enterprise/vits-vctk")
    sample_rate: int = model.config.sampling_rate
    print(f"[Model] Loaded (sample rate: {sample_rate} Hz)")

    # 9. 오디오 세그먼트 생성
    print("\n[Audio] Generating speech...")
    segments: List[np.ndarray] = []
    silence = make_silence(0.2, sample_rate)

    for i, (_, row) in enumerate(tqdm(df.iterrows(), total=len(df), desc="Generating")):
        spk  = str(row["speaker"])
        text = translated[i]
        vid  = speaker_voice[spk]

        wav = generate_segment(model, tokenizer, text, vid, device)
        segments.append(wav)
        if i < len(df) - 1:
            segments.append(silence)

    # 10. 세그먼트 연결, 정규화, 저장
    print("\n[Audio] Concatenating segments...")
    final = np.concatenate(segments)

    max_val = np.max(np.abs(final))
    if max_val > 0:
        final = final / max_val * 0.95

    final_int16 = (final * 32767).astype(np.int16)
    # 오디오 데이터를 16-bit PCM WAV 파일로 저장함
    wavfile.write(str(output_path), sample_rate, final_int16)

    duration = len(final) / sample_rate
    print(f"\n[Done] {output_path}")
    print(f"[Done] Duration: {duration:.2f}s  |  Sample rate: {sample_rate} Hz")
    print("\n" + "=" * 60)
    print("Generation Complete!")
    print("=" * 60)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
