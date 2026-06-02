"""
Bark TTS — GPT-4o-mini 번역 + suno/bark 모델을 활용한 다국어 음성 합성 실습.
dialog.csv의 대화문을 선택 언어로 번역한 뒤, 화자별 음성 프리셋을 지정하여 WAV 파일로 출력함.
"""

import os
import sys
import warnings
import torch
import pandas as pd
import numpy as np
import scipy.io.wavfile as wavfile
from pathlib import Path
from tqdm import tqdm
from dotenv import load_dotenv
from openai import OpenAI
# AutoProcessor, BarkModel: HuggingFace Transformers의 Bark TTS 모델과 전처리기
from transformers import AutoProcessor, BarkModel

warnings.filterwarnings("ignore", message=".*attention.*mask.*")


SUPPORTED_LANGUAGES = {
    "1":  ("en", "English"),
    "2":  ("ko", "Korean"),
    "3":  ("zh", "Chinese"),
    "4":  ("ja", "Japanese"),
    "5":  ("de", "German"),
    "6":  ("fr", "French"),
    "7":  ("es", "Spanish"),
    "8":  ("it", "Italian"),
    "9":  ("pt", "Portuguese"),
    "10": ("pl", "Polish"),
    "11": ("ru", "Russian"),
    "12": ("hi", "Hindi"),
    "13": ("tr", "Turkish"),
}

# 이 파일이 위치한 디렉터리 경로를 구함
SCRIPT_DIR = Path(__file__).parent.resolve()   # hands-on/06.tts/bark/
TTS_ROOT   = SCRIPT_DIR.parent                  # hands-on/06.tts/


# ---------------------------------------------------------------------------
# 경로 유틸리티
# ---------------------------------------------------------------------------

def find_env_file() -> Path:
    """.env 파일을 상위 디렉터리로 거슬러 올라가며 탐색하여 경로를 반환함."""
    current = SCRIPT_DIR
    for _ in range(8):
        candidate = current / "agentic-ai" / "examples" / ".env"
        if candidate.exists():
            return candidate
        current = current.parent
    current = SCRIPT_DIR
    for _ in range(8):
        candidate = current / ".env"
        if candidate.exists():
            return candidate
        current = current.parent
    return SCRIPT_DIR / ".env"


def get_input_path() -> Path:
    """대화 CSV 파일 경로를 반환함."""
    return TTS_ROOT / "text" / "dialog.csv"


def get_output_path() -> Path:
    """출력 WAV 파일 경로를 반환함."""
    return SCRIPT_DIR / "result.wav"


def get_cache_path(lang_code: str) -> Path:
    """언어 코드에 해당하는 번역 캐시 CSV 파일 경로를 반환함."""
    cache_dir = SCRIPT_DIR / "translations"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / f"dialog_{lang_code}.csv"


# ---------------------------------------------------------------------------
# 디바이스 설정
# ---------------------------------------------------------------------------

def check_device() -> str:
    """GPU(CUDA) 사용 가능 여부 확인. 불가능하면 CPU 사용."""
    if torch.cuda.is_available():
        print(f"[INFO] GPU detected: {torch.cuda.get_device_name(0)}")
        return "cuda"
    print("[INFO] No GPU detected, using CPU (slower)")
    return "cpu"


# ---------------------------------------------------------------------------
# API 키 로드
# ---------------------------------------------------------------------------

def load_api_key() -> str:
    """.env 파일에서 OPENAI_API_KEY를 로드하여 반환함. 없으면 프로세스 종료."""
    env_path = find_env_file()
    load_dotenv(env_path)
    # OPENAI_API_KEY: OpenAI API 인증에 사용하는 비밀 키
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print(f"[ERROR] OPENAI_API_KEY not found. Expected at: {env_path}")
        sys.exit(1)
    return api_key


# ---------------------------------------------------------------------------
# 언어 선택
# ---------------------------------------------------------------------------

def select_language() -> tuple:
    """지원 언어 목록을 출력하고, 사용자가 선택한 (언어 코드, 언어 이름) 튜플을 반환함."""
    print("\n" + "=" * 50)
    print("Select Target Language for Translation")
    print("=" * 50)
    for key, (code, name) in SUPPORTED_LANGUAGES.items():
        print(f"  {key:>2}. {name} ({code})")
    print("=" * 50)
    while True:
        choice = input("Enter number (1-13): ").strip()
        if choice in SUPPORTED_LANGUAGES:
            code, name = SUPPORTED_LANGUAGES[choice]
            print(f"[INFO] Selected: {name} ({code})")
            return code, name
        print("[ERROR] Invalid choice. Please try again.")


# ---------------------------------------------------------------------------
# 대화 CSV 로드
# ---------------------------------------------------------------------------

def load_dialog(input_path: Path) -> tuple:
    """파이프(|) 구분자 CSV에서 대화 데이터를 로드하고, (DataFrame, 화자 목록) 튜플을 반환함."""
    if not input_path.exists():
        print(f"[ERROR] Input file not found: {input_path}")
        sys.exit(1)
    df = pd.read_csv(input_path, sep="|", encoding="utf-8")
    for col in ("speaker", "text"):
        if col not in df.columns:
            print(f"[ERROR] CSV must contain '{col}' column")
            sys.exit(1)
    seen: dict = {}
    for s in df["speaker"]:
        seen[str(s)] = None
    speakers = list(seen.keys())
    print(f"[INFO] Found {len(df)} dialog(s) with {len(speakers)} speaker(s): {speakers}")
    return df, speakers


# ---------------------------------------------------------------------------
# 번역 캐시
# ---------------------------------------------------------------------------

def load_translation_cache(lang_code: str) -> dict:
    """이전에 저장한 번역 캐시 CSV를 불러와 {원문: 번역문} 딕셔너리로 반환함."""
    cache_path = get_cache_path(lang_code)
    if not cache_path.exists():
        return {}
    try:
        df = pd.read_csv(cache_path, sep="|", encoding="utf-8")
        if "translated_text" not in df.columns:
            return {}
        print(f"[INFO] Translation cache found: {cache_path.name}")
        return df.set_index("text")["translated_text"].to_dict()
    except Exception as e:
        print(f"[WARNING] Failed to load translation cache: {e}")
        return {}


def save_translation_cache(df_translated: pd.DataFrame, lang_code: str) -> None:
    """번역 결과 DataFrame을 캐시 CSV 파일로 저장함."""
    cache_path = get_cache_path(lang_code)
    try:
        df_translated.to_csv(cache_path, sep="|", index=False, encoding="utf-8")
        print(f"[INFO] Translation saved to cache: {cache_path.name}")
    except Exception as e:
        print(f"[WARNING] Failed to save translation cache: {e}")


# ---------------------------------------------------------------------------
# 번역
# ---------------------------------------------------------------------------

def translate_dialogs(
    client: OpenAI,
    df: pd.DataFrame,
    lang_name: str,
    lang_code: str,
) -> pd.DataFrame:
    """GPT-4o-mini를 사용해 대화 텍스트를 지정 언어로 번역하고, 번역 열이 추가된 DataFrame을 반환함."""
    cache = load_translation_cache(lang_code)
    texts = df["text"].astype(str).tolist()
    translated = []
    new_count = 0

    print(f"\n[INFO] Translating to {lang_name} ({len(texts)} lines)...")
    # tqdm: 반복 작업의 진행률을 프로그레스 바로 표시함
    for text in tqdm(texts, desc="Translating"):
        text = text.strip()
        if text in cache:
            translated.append(cache[text])
            continue
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            f"You are a professional translator. "
                            f"Translate the given text to {lang_name}. "
                            f"Output only the translated text, nothing else."
                        ),
                    },
                    {"role": "user", "content": text},
                ],
                temperature=0.3,
                max_tokens=1000,
            )
            result = (response.choices[0].message.content or text).strip()
            cache[text] = result
            translated.append(result)
            new_count += 1
        except Exception as e:
            print(f"\n[WARNING] Translation failed ('{text[:30]}'): {e}")
            translated.append(text)

    if new_count > 0:
        print(f"[INFO] {new_count} new translation(s) completed")

    df_out = df.copy()
    df_out["translated_text"] = translated
    return df_out


# ---------------------------------------------------------------------------
# 음성 선택
# ---------------------------------------------------------------------------

def select_voice(speaker: str, lang_code: str) -> str:
    """화자 이름과 언어 코드를 받아 사용자가 선택한 Bark 음성 프리셋 문자열을 반환함."""
    print(f"\n--- Speaker: {speaker} ---")
    print("=" * 50)
    print(f"Select Voice Preset (Language: {lang_code})")
    print("=" * 50)
    for i in range(10):
        gender = "Male" if i < 5 else "Female"
        print(f"  {i}. Speaker {i} ({gender} - approximate)")
    print("=" * 50)
    while True:
        choice = input("Enter number (0-9): ").strip()
        if choice.isdigit() and 0 <= int(choice) <= 9:
            preset = f"v2/{lang_code}_speaker_{choice}"
            print(f"[INFO] Selected: {preset}")
            return preset
        print("[ERROR] Invalid choice. Please try again.")


def assign_voices(speakers: list, lang_code: str) -> dict:
    """각 화자에 대해 음성 프리셋을 선택받아 {화자명: 프리셋} 딕셔너리로 반환함."""
    print("\n" + "=" * 50)
    print("Assign Voice to Each Speaker")
    print("=" * 50)
    voices = {speaker: select_voice(speaker, lang_code) for speaker in speakers}
    print("\n[INFO] Voice assignments:")
    for speaker, preset in voices.items():
        print(f"  {speaker} -> {preset}")
    return voices


# ---------------------------------------------------------------------------
# Bark 모델 로드 및 음성 생성
# ---------------------------------------------------------------------------

def load_model(device: str) -> tuple:
    """HuggingFace에서 suno/bark 모델과 프로세서를 로드하여 (processor, model) 튜플을 반환함."""
    print("\n[INFO] Loading Bark model (first run may take a while)...")
    # AutoProcessor: 텍스트를 Bark 모델 입력 형식으로 변환하는 전처리기
    processor = AutoProcessor.from_pretrained("suno/bark")
    # BarkModel: 텍스트를 오디오로 변환하는 Bark TTS 모델 (suno/bark)
    model = BarkModel.from_pretrained("suno/bark")
    model = model.to(device)
    if device == "cuda":
        model = model.to(torch.float16)
    print("[INFO] Model loaded successfully")
    return processor, model


def generate_speech(
    processor: AutoProcessor,
    model: BarkModel,
    text: str,
    voice_preset: str,
    device: str,
) -> np.ndarray:
    """텍스트와 음성 프리셋으로 Bark 모델에서 오디오 배열을 생성하여 반환함."""
    inputs = processor(text, voice_preset=voice_preset, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}
    with torch.no_grad():
        audio_array = model.generate(**inputs, do_sample=True)
    return audio_array.cpu().numpy().squeeze()


# ---------------------------------------------------------------------------
# 오디오 처리
# ---------------------------------------------------------------------------

def concatenate_audio(segments: list, sample_rate: int, silence_duration: float = 0.2) -> np.ndarray:
    """오디오 세그먼트 목록 사이에 묵음을 삽입하여 하나의 배열로 연결함."""
    silence = np.zeros(int(silence_duration * sample_rate), dtype=np.float32)
    parts = []
    for i, seg in enumerate(segments):
        parts.append(seg)
        if i < len(segments) - 1:
            parts.append(silence)
    return np.concatenate(parts)


# ---------------------------------------------------------------------------
# 진입점
# ---------------------------------------------------------------------------

def main():
    """번역 및 Bark TTS 음성 합성 전체 파이프라인을 실행함."""
    print("=" * 60)
    print("  Bark TTS - Text to Speech Generator with Translation")
    print("  (suno/bark + GPT-4o-mini translation)")
    print("=" * 60)

    device = check_device()

    input_path  = get_input_path()
    output_path = get_output_path()
    print(f"\n[INFO] Input : {input_path}")
    print(f"[INFO] Output: {output_path}")

    api_key = load_api_key()
    client  = OpenAI(api_key=api_key)
    print("[INFO] OpenAI API connected for translation")

    df, speakers = load_dialog(input_path)

    lang_code, lang_name = select_language()

    # 캐시에 전체 번역이 있으면 API 호출 없이 재사용
    cache = load_translation_cache(lang_code)
    texts = df["text"].astype(str).tolist()

    if all(t.strip() in cache for t in texts):
        print(f"[INFO] Using cached translation for {lang_name}")
        df_translated = df.copy()
        df_translated["translated_text"] = [cache[t.strip()] for t in texts]
    else:
        df_translated = translate_dialogs(client, df, lang_name, lang_code)
        save_translation_cache(df_translated, lang_code)

    speaker_voices = assign_voices(speakers, lang_code)

    processor, model = load_model(device)
    # Bark 모델 샘플레이트: AttributeError 방지를 위해 하드코딩
    sample_rate = 24000

    print("\n[INFO] Generating speech...")
    audio_segments = []

    for _, row in tqdm(df_translated.iterrows(), total=len(df_translated), desc="Processing"):
        speaker = str(row["speaker"])
        text    = str(row["translated_text"]).strip()
        if not text:
            continue
        try:
            audio = generate_speech(processor, model, text, speaker_voices[speaker], device)
            audio_segments.append(audio)
        except Exception as e:
            print(f"\n[WARNING] Speech generation failed: {e}")

    if not audio_segments:
        print("[ERROR] No audio segments generated")
        sys.exit(1)

    print("\n[INFO] Concatenating audio segments...")
    final_audio = concatenate_audio(audio_segments, sample_rate, silence_duration=0.2)

    # 오디오 최댓값으로 정규화한 뒤 16-bit 정수형으로 변환
    max_val = np.max(np.abs(final_audio))
    if max_val > 0:
        final_audio = final_audio / max_val
    final_audio = (final_audio * 32767).astype(np.int16)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    # 오디오 데이터를 16-bit PCM WAV 파일로 저장함
    wavfile.write(str(output_path), sample_rate, final_audio)

    print("\n" + "=" * 60)
    print("[SUCCESS]")
    print("=" * 60)
    print(f"  Output file : {output_path}")
    print(f"  Duration    : {len(final_audio) / sample_rate:.2f} sec")
    print(f"  Sample rate : {sample_rate} Hz")
    print(f"  Language    : {lang_name} ({lang_code})")
    print("=" * 60)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
