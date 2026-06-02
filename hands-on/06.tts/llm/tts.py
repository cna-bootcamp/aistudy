"""
LLM TTS — OpenAI API를 활용한 텍스트 음성 합성 실습.
GPT-4o-mini로 대화문을 번역하고, OpenAI TTS-1 모델로 음성을 생성함.

기능:
- 다국어 번역 (한국어, 영어, 중국어, 일어, 불어, 스페인어)
- 언어별 번역 캐시 파일 저장
- 화자별 음성 선택
- WAV 파일 출력
"""

import os
import sys
import io
from pathlib import Path
from typing import Dict, List

import pandas as pd
import numpy as np
import scipy.io.wavfile as wavfile
from tqdm import tqdm
from dotenv import load_dotenv


# =============================================================================
# 상수 정의
# =============================================================================

SUPPORTED_LANGUAGES: Dict[str, tuple] = {
    "1": ("ko", "한국어", "Korean"),
    "2": ("en", "영어", "English"),
    "3": ("zh", "중국어", "Chinese"),
    "4": ("ja", "일어", "Japanese"),
    "5": ("fr", "불어", "French"),
    "6": ("es", "스페인어", "Spanish"),
}

# OpenAI TTS 음성 목록: https://platform.openai.com/docs/guides/text-to-speech/voice-options
OPENAI_VOICES: Dict[str, Dict[str, str]] = {
    "1": {"name": "alloy",   "gender": "Female", "description": "중립적이고 균형 잡힌 여성 음성"},
    "2": {"name": "echo",    "gender": "Male",   "description": "따뜻하고 친근한 남성 음성"},
    "3": {"name": "fable",   "gender": "Male",   "description": "표현력 있는 스토리텔링 남성 음성"},
    "4": {"name": "onyx",    "gender": "Male",   "description": "깊고 권위 있는 남성 음성"},
    "5": {"name": "nova",    "gender": "Female", "description": "밝고 쾌활한 여성 음성"},
    "6": {"name": "shimmer", "gender": "Female", "description": "맑고 선명한 여성 음성"},
}

# 이 파일이 위치한 디렉터리 경로를 구함
SCRIPT_DIR = Path(__file__).parent          # hands-on/06.tts/llm/
TTS_ROOT   = SCRIPT_DIR.parent             # hands-on/06.tts/


# =============================================================================
# 경로 유틸리티
# =============================================================================

def find_env_file() -> Path:
    """.env 파일을 workspace 루트까지 거슬러 올라가며 탐색하여 경로를 반환함."""
    # agentic-ai/ 디렉터리가 있는 workspace 루트를 찾아 상위로 이동
    current = SCRIPT_DIR
    for _ in range(6):
        candidate = current / "agentic-ai" / "examples" / ".env"
        if candidate.exists():
            return candidate
        current = current.parent
    # 폴백: 상위 디렉터리에서 .env 파일 탐색
    current = SCRIPT_DIR
    for _ in range(6):
        candidate = current / ".env"
        if candidate.exists():
            return candidate
        current = current.parent
    # 탐색 실패 시 명확한 에러가 발생하도록 현재 디렉터리 경로 반환
    return SCRIPT_DIR / ".env"


def get_cache_path(lang_code: str) -> Path:
    """프로젝트 디렉터리 내 번역 캐시 파일 경로를 반환함."""
    cache_dir = SCRIPT_DIR / "translations"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / f"dialog_{lang_code}.csv"


def get_input_path() -> Path:
    """대화 CSV 입력 파일 경로를 반환함."""
    return TTS_ROOT / "text" / "dialog.csv"


def get_output_path() -> Path:
    """출력 WAV 파일 경로를 반환함."""
    return SCRIPT_DIR / "result.wav"


# =============================================================================
# 환경 변수
# =============================================================================

def load_env() -> str:
    """.env에서 환경변수를 로드하고 OpenAI API 키를 반환함. 없으면 종료."""
    env_path = find_env_file()
    load_dotenv(env_path)

    # OPENAI_API_KEY: OpenAI API 인증에 사용하는 비밀 키
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print(f"\n[Error] OPENAI_API_KEY not found.")
        print(f"  Expected at: {env_path}")
        print(f"  Add OPENAI_API_KEY=sk-xxx to that file.")
        sys.exit(1)

    return api_key


# =============================================================================
# 번역 캐시
# =============================================================================

def load_translation_cache(lang_code: str) -> Dict[str, str]:
    """CSV 파일에서 번역 캐시를 로드하여 {원문: 번역문} 딕셔너리로 반환함."""
    cache_path = get_cache_path(lang_code)
    cache: Dict[str, str] = {}

    if cache_path.exists():
        try:
            df = pd.read_csv(cache_path, sep="|", encoding="utf-8")
            if "original" in df.columns and "translated" in df.columns:
                for _, row in df.iterrows():
                    cache[str(row["original"])] = str(row["translated"])
                print(f"[Cache] {len(cache)}개 번역 캐시 로드: {cache_path.name}")
        except Exception as e:
            print(f"[Cache] 캐시 로드 실패: {e}")

    return cache


def save_translation_cache(lang_code: str, cache: Dict[str, str]) -> None:
    """번역 캐시를 CSV 파일에 저장함."""
    cache_path = get_cache_path(lang_code)

    try:
        df = pd.DataFrame([
            {"original": k, "translated": v}
            for k, v in cache.items()
        ])
        df.to_csv(cache_path, sep="|", index=False, encoding="utf-8")
        print(f"[Cache] {len(cache)}개 번역 캐시 저장: {cache_path.name}")
    except Exception as e:
        print(f"[Cache] 캐시 저장 실패: {e}")


# =============================================================================
# 사용자 인터랙션
# =============================================================================

def select_language() -> tuple:
    """번역 대상 언어를 사용자에게 선택받아 (언어 코드, 한국어명, 영어명) 튜플을 반환함."""
    print("\n" + "=" * 60)
    print("번역 대상 언어 선택")
    print("=" * 60)

    for key, (code, korean, english) in SUPPORTED_LANGUAGES.items():
        print(f"  [{key}] {korean} ({english})")

    print("-" * 60)

    while True:
        choice = input("언어 번호를 선택하세요 (1-6): ").strip()
        if choice in SUPPORTED_LANGUAGES:
            code, korean, english = SUPPORTED_LANGUAGES[choice]
            print(f"\n[선택] {korean} ({code})")
            return code, korean, english
        print("  1부터 6 사이의 번호를 입력하세요.")


def select_voice(speaker: str) -> str:
    """화자에 대한 음성을 사용자에게 선택받아 음성 이름을 반환함."""
    print(f"\n--- '{speaker}' 음성 선택 ---")

    for key, info in OPENAI_VOICES.items():
        print(f"  [{key}] {info['name']:8s} ({info['gender']:6s}) - {info['description']}")

    while True:
        choice = input(f"  음성 번호 (1-6): ").strip()
        if choice in OPENAI_VOICES:
            selected = OPENAI_VOICES[choice]["name"]
            print(f"  → {selected}")
            return selected
        print("  1부터 6 사이의 번호를 입력하세요.")


# =============================================================================
# 데이터 로드
# =============================================================================

def load_dialog(input_path: Path) -> pd.DataFrame:
    """대화 CSV 파일을 로드하고 필수 컬럼을 검증하여 DataFrame을 반환함."""
    if not input_path.exists():
        print(f"\n[Error] 입력 파일을 찾을 수 없습니다: {input_path}")
        sys.exit(1)

    df = pd.read_csv(input_path, sep="|", encoding="utf-8")

    for col in ("speaker", "text"):
        if col not in df.columns:
            print(f"\n[Error] 필수 컬럼 '{col}'이 없습니다.")
            sys.exit(1)

    return df


def get_speakers(df: pd.DataFrame) -> List[str]:
    """등장 순서를 유지하며 고유 화자 목록을 추출하여 반환함."""
    seen: Dict[str, None] = {}
    for s in df["speaker"]:
        seen[str(s)] = None
    return list(seen.keys())


# =============================================================================
# OpenAI 번역
# =============================================================================

def translate_text(
    texts: List[str],
    target_language: str,
    cache: Dict[str, str],
    api_key: str,
) -> List[str]:
    """GPT-4o-mini와 캐시를 활용하여 텍스트 목록을 번역하고 반환함."""
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    translated: List[str] = []
    new_translations = 0

    # tqdm: 반복 작업의 진행률을 프로그레스 바로 표시함
    for text in tqdm(texts, desc="번역 중"):
        text = str(text).strip()

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
                            f"Translate the given text to {target_language}. "
                            f"Output only the translated text, nothing else."
                        ),
                    },
                    {"role": "user", "content": text},
                ],
                temperature=0.3,
            )
            result = (response.choices[0].message.content or text).strip()
            cache[text] = result
            translated.append(result)
            new_translations += 1
        except Exception as e:
            print(f"\n[Warning] 번역 실패 ('{text[:20]}...'): {e}")
            translated.append(text)

    if new_translations > 0:
        print(f"[번역] {new_translations}개 새로 번역됨")

    return translated


# =============================================================================
# OpenAI TTS
# =============================================================================

def generate_tts(text: str, voice: str, api_key: str) -> bytes:
    """OpenAI TTS-1 모델로 음성 바이트를 생성하여 반환함."""
    from openai import OpenAI

    client = OpenAI(api_key=api_key)

    response = client.audio.speech.create(
        model="tts-1",
        voice=voice,       # type: ignore[arg-type]
        input=text,
        response_format="wav",
    )
    return response.content


# =============================================================================
# 오디오 처리
# =============================================================================

def wav_bytes_to_array(wav_bytes: bytes):
    """WAV 바이트를 (샘플레이트, numpy 배열) 튜플로 변환하여 반환함."""
    with io.BytesIO(wav_bytes) as f:
        return wavfile.read(f)


def to_int16(audio: np.ndarray) -> np.ndarray:
    """임의 타입의 오디오 배열을 int16으로 정규화하여 반환함."""
    if audio.dtype == np.int16:
        return audio
    if np.issubdtype(audio.dtype, np.floating):
        return (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)
    return audio.astype(np.int16)


def build_silence(duration_sec: float, sample_rate: int) -> np.ndarray:
    """지정 길이(초)의 무음 int16 배열을 생성하여 반환함."""
    return np.zeros(int(duration_sec * sample_rate), dtype=np.int16)


def concatenate_segments(
    segments: List[np.ndarray],
    sample_rate: int,
    gap_sec: float = 0.3,
) -> np.ndarray:
    """오디오 세그먼트 사이에 묵음을 삽입하여 하나의 배열로 연결함."""
    silence = build_silence(gap_sec, sample_rate)
    parts: List[np.ndarray] = []
    for i, seg in enumerate(segments):
        parts.append(to_int16(seg))
        if i < len(segments) - 1:
            parts.append(silence)
    return np.concatenate(parts)


# =============================================================================
# 진입점
# =============================================================================

def main():
    """OpenAI 번역 및 TTS-1 음성 합성 전체 파이프라인을 실행함."""
    print("=" * 60)
    print("  LLM TTS - Text-to-Speech with OpenAI")
    print("  (GPT-4o-mini 번역 + TTS-1 음성 합성)")
    print("=" * 60)

    api_key = load_env()
    print("[API] OpenAI API 연결됨")

    input_path  = get_input_path()
    output_path = get_output_path()
    print(f"\n[입력] {input_path}")
    print(f"[출력] {output_path}")

    # 1. 언어 선택
    lang_code, lang_korean, lang_english = select_language()

    # 2. 대화 파일 로드
    print(f"\n[로드] 대화 파일 읽는 중...")
    dialog_df = load_dialog(input_path)
    print(f"[로드] {len(dialog_df)}개 대화 로드됨")

    # 3. 화자 목록
    speakers = get_speakers(dialog_df)
    print(f"[화자] {len(speakers)}명 감지: {speakers}")

    # 4. 화자별 음성 선택
    print("\n" + "=" * 60)
    print("화자별 음성 선택")
    print("=" * 60)

    speaker_voices: Dict[str, str] = {}
    for speaker in speakers:
        speaker_voices[speaker] = select_voice(speaker)

    print("\n[음성 할당 결과]")
    for speaker, voice in speaker_voices.items():
        print(f"  {speaker} → {voice}")

    # 5. 번역 캐시 로드
    cache = load_translation_cache(lang_code)

    # 6. 번역
    print(f"\n[번역] {lang_korean}로 번역 중...")
    texts = dialog_df["text"].tolist()

    if lang_code == "ko":
        # 한국어가 원본 언어인 경우 번역 생략
        translated_texts = [str(t) for t in texts]
        print("[번역] 원본 언어(한국어) 선택 — 번역 생략")
    else:
        translated_texts = translate_text(texts, lang_english, cache, api_key)
        save_translation_cache(lang_code, cache)

    # 7. TTS 음성 합성
    print(f"\n[TTS] 음성 생성 중...")
    audio_segments: List[np.ndarray] = []
    # OpenAI TTS 기본 샘플레이트
    sample_rate = 24000

    for i, (_, row) in enumerate(tqdm(dialog_df.iterrows(), total=len(dialog_df), desc="음성 생성")):
        speaker = str(row["speaker"])
        text    = translated_texts[i].strip()
        voice   = speaker_voices[speaker]

        if not text:
            continue

        try:
            wav_bytes = generate_tts(text, voice, api_key)
            sr, audio_data = wav_bytes_to_array(wav_bytes)
            sample_rate = sr
            audio_segments.append(audio_data)
        except Exception as e:
            print(f"\n[Warning] 음성 생성 실패 (line {i + 1}): {e}")

    if not audio_segments:
        print("\n[Error] 생성된 음성이 없습니다.")
        sys.exit(1)

    # 8. 세그먼트 연결 및 저장
    print(f"\n[저장] 오디오 파일 생성 중...")
    final_audio = concatenate_segments(audio_segments, sample_rate)
    # 오디오 데이터를 16-bit PCM WAV 파일로 저장함
    wavfile.write(str(output_path), sample_rate, final_audio)

    duration_sec = len(final_audio) / sample_rate

    print("\n" + "=" * 60)
    print("[완료]")
    print("=" * 60)
    print(f"  번역 언어  : {lang_korean} ({lang_code})")
    print(f"  출력 파일  : {output_path}")
    print(f"  재생 시간  : {duration_sec:.2f}초")
    print(f"  샘플레이트 : {sample_rate} Hz")
    print("=" * 60)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()
