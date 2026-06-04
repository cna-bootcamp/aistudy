/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../06.tts/openvoice/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "OpenVoice V2 음성 복제(Voice Cloning) TTS 예제 설명",
    entry: "tts.py",
  },

  files: [
    { id: "main", label: "tts.py", role: "단일 파일 CLI 예제 · MeloTTS + ToneColorConverter 2단계 음성 복제 파이프라인" },
  ],

  flow: [
    { step: 1, title: "환경 패치", label: "환경 패치", refs: ["module_setup"],
      summary: "프로그램 시작 전, PyTorch 로딩 버그와 경고를 미리 수정함",
      detail: "식당 문을 열기 전 주방 점검과 같음. PyTorch 2.6+에서 생긴 모델 파일(.pth) 로딩 오류를 monkey-patch로 먼저 고쳐두고, 불필요한 경고 메시지도 껴줌. 이 덕분에 이후 코드가 안전하게 실행됨." },
    { step: 2, title: "사전 요건 검사", label: "사전 요건 검사", refs: ["check_prerequisites"],
      summary: "check_prerequisites()가 PyTorch·OpenVoice·MeloTTS·MeCab 설치 여부를 확인함",
      detail: "요리 재료가 다 있는지 확인하는 단계임. 필수 라이브러리가 하나라도 없으면 설치 안내를 출력하고 즉시 종료함. 덕분에 나중에 알 수 없는 오류가 나는 걸 미리 막음." },
    { step: 3, title: "체크포인트 다운로드", label: "체크포인트 다운로드", refs: ["download_checkpoints"],
      summary: "download_checkpoints()가 AI 모델 파일이 없으면 S3에서 다운로드함",
      detail: "요리에 필요한 '레시피 파일(AI 모델 가중치)'을 준비하는 단계임. 이미 있으면 건너뜀. 없으면 약 200 MB 파일을 인터넷에서 받아 압축을 풀고 올바른 위치에 놓음." },
    { step: 4, title: "참조 음성 탐색", label: "참조 음성 탐색", refs: ["scan_voices"],
      summary: "scan_voices()가 voices/ 폴더의 음성 파일을 찾고, 비-WAV 파일은 ffmpeg로 변환함",
      detail: "흉내 낼 '원본 목소리' 파일을 준비하는 단계임. MP3·M4A 등 다양한 형식을 ffmpeg로 WAV로 변환해 모델이 읽을 수 있게 만듦. 변환된 파일은 저장되어 다음엔 재변환 없이 재사용됨." },
    { step: 5, title: "대화 파일 로드", label: "대화 파일 로드", refs: ["load_dialog"],
      summary: "load_dialog()가 파이프(|) 구분자 CSV에서 화자·대사 데이터를 읽어옴",
      detail: "합성할 '대본'을 불러오는 단계임. dialog.csv에는 '누가(speaker)|무슨 말을(text)' 형식으로 대화가 들어 있음. 필수 컬럼 검증·빈 행 제거까지 해줌." },
    { step: 6, title: "화자 음성 매핑", label: "화자 음성 매핑", refs: ["load_mapping", "normalize_mapping", "select_voice_for_speaker", "save_mapping"],
      summary: "대화의 각 화자에게 어떤 참조 음성을 쓸지 사용자가 선택하거나 저장된 매핑을 재사용함",
      detail: "'A 화자는 목소리1, B 화자는 목소리2' 처럼 역할을 배정하는 단계임. mapping.json에 저장된 이전 선택이 있으면 재사용하고, 새 화자가 생기면 목록에서 번호로 골라 배정함." },
    { step: 7, title: "AI 모델 로드", label: "AI 모델 로드",
      summary: "ToneColorConverter(음색 이전)와 MeloTTS(한국어 합성) 두 모델을 GPU/CPU에 올림",
      detail: "주방장(AI 모델) 두 명을 출근시키는 단계임. ToneColorConverter는 참조 음성의 음색(목소리 특성)을 복제하는 역할이고, MeloTTS는 텍스트를 말로 합성하는 역할임. GPU가 있으면 자동으로 사용해 처리 속도를 높임." },
    { step: 8, title: "화자 임베딩 추출", label: "화자 임베딩 추출",
      summary: "각 화자의 참조 음성에서 음색 특성(Speaker Embedding)을 벡터로 추출함",
      detail: "'목소리 지문'을 뽑는 단계임. 참조 음성 파일을 분석해 그 사람만의 음색 특성을 숫자 벡터로 만들어 둠. 이 벡터를 나중에 합성 음성에 입히면 비슷한 음색이 나옴." },
    { step: 9, title: "2단계 음성 합성", label: "2단계 음성 합성",
      summary: "각 대사마다 ①MeloTTS로 기본 음성 → ②ToneColorConverter로 음색 이전, 세그먼트 누적",
      detail: "녹음·편집의 핵심 단계임. 각 대사를 먼저 MeloTTS로 평범한 한국어 음성으로 만든 뒤(1단계), ToneColorConverter가 참조 음성의 음색을 입혀 원하는 목소리에 가깝게 바꿈(2단계). 대사 사이에 짧은 무음을 넣어 자연스럽게 이어줌." },
    { step: 10, title: "후처리 및 저장", label: "후처리 및 저장",
      summary: "모든 세그먼트를 연결·정규화하여 16-bit PCM WAV 파일로 저장함",
      detail: "녹음 파일을 최종 편집·저장하는 단계임. 세그먼트를 하나로 붙이고, 소리가 너무 크거나 작지 않도록 음량을 정규화(최대 0.95 스케일)함. 최종 결과를 result.wav로 저장함." },
  ],

  functions: [
    // ===== tts.py (메인) =====
    {
      id: "module_setup",
      name: "모듈 설정 (상수·패치)",
      fileId: "main",
      summary: "파일 맨 위에서 경고 억제, PyTorch monkey-patch, 경로 상수, 지원 음성 형식 등 기본 설정을 준비함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 준비하는 값들'임. os.environ.setdefault로 환경변수를 미리 설정해 경고를 껍니다. PyTorch 2.6+에서 생긴 .pth 로딩 오류는 monkey-patch(기존 함수를 수정된 버전으로 교체)로 해결함. 경로는 Path(__file__)을 기준으로 자동 계산함.",
      terms: ["os.environ.setdefault", "monkey-patch", "Path(__file__)", "tuple(튜플)"],
      lines: [
        { at: 'os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING"', text: "os.environ.setdefault는 환경변수가 없을 때만 값을 설정함. 이미 있으면 건드리지 않음. 경고 메시지를 프로그램 시작 전에 미리 억제함." },
        { at: '_orig_load = _torch.load', text: "원래 torch.load 함수를 _orig_load에 백업해 둠. 잠시 뒤 수정된 버전으로 교체할 준비 단계임." },
        { at: 'kwargs.setdefault("weights_only", False)', text: "★핵심★ 기존 torch.load에 weights_only=False를 기본값으로 끼워주는 수정된 함수임. OpenVoice .pth 파일은 이 옵션이 없으면 PyTorch 2.6+에서 오류가 남." },
        { at: '_torch.load = _patched_load', text: "라이브러리 내부 함수를 수정된 버전으로 교체함(monkey-patch). 이후 torch.load를 부르는 모든 코드가 자동으로 수정된 버전을 씀." },
        { at: 'SCRIPT_DIR    = Path(__file__).parent', text: "Path(__file__).parent는 '이 파일이 든 폴더'. 경로를 하드코딩하지 않아 어디서 실행해도 올바른 위치를 찾음." },
        { at: 'VOICE_EXTENSIONS = ("*.wav"', text: "ffmpeg가 지원하는 음성 파일 확장자 목록을 튜플로 묶어둠. 탐색 시 이 목록을 순서대로 쓰면서 지원 형식 파일을 찾음." },
      ],
      code:
`"""
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
                    "*.wma", "*.opus", "*.aiff", "*.aif", "*.webm")`,
    },
    {
      id: "check_prerequisites",
      name: "check_prerequisites()",
      fileId: "main",
      summary: "PyTorch·OpenVoice·MeloTTS·MeCab 설치 여부를 차례로 확인하고, 빠진 것이 있으면 설치 안내 후 종료함.",
      how: "요리를 시작하기 전 재료를 점검하는 함수임. try/except로 import를 시도하고, 모듈이 없으면 missing 목록에 쌓아 한꺼번에 안내함. MeCab은 설치 후에도 사전 문제로 초기화 실패가 잦아 MeCab.Tagger()를 직접 실행해 한 번 더 확인함.",
      terms: ["importlib.util.find_spec", "예외 처리(try/except)", "sys.exit()", "MeCab"],
      lines: [
        { at: 'import torch  # noqa: F401', text: "torch를 실제 import해서 설치 여부를 확인함. noqa: F401은 '이 import는 사용 안 해도 경고 무시' 표시임." },
        { at: 'for pkg, name in [("openvoice"', text: "importlib.util.find_spec은 라이브러리를 실제로 import하지 않고 설치 여부만 빠르게 확인함. openvoice와 melo 두 패키지를 차례로 검사함." },
        { at: 'if missing:', text: "미설치 패키지 목록이 있으면 설치 명령을 출력하고 sys.exit(1)로 프로그램을 즉시 종료함." },
        { at: 'MeCab.Tagger()', text: "MeCab은 설치돼 있어도 사전 경로 문제로 초기화가 실패할 수 있음. 실제로 Tagger()를 만들어 동작하는지 확인함." },
        { at: '"unidic\\\\dicdir\\\\mecabrc" in error_text', text: "오류 메시지에 unidic 경로가 있으면 unidic-lite 사전으로 교체하라고 안내함. 이 조건이 없으면 오류 원인을 찾기 어려움." },
      ],
      code:
`def check_prerequisites() -> None:
    """PyTorch, openvoice, MeloTTS, MeCab 설치 여부를 확인하고, 미설치 시 안내 후 종료함."""
    try:
        import torch  # noqa: F401
    except ImportError:
        print("\\n[Error] PyTorch not installed.")
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
        print(f"\\n[Error] Required packages not installed: {', '.join(missing)}")
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
        print("\\n[Error] MeloTTS requires mecab-python3 and fugashi (pre-built wheels, install separately):")
        for cmd in mecab_missing:
            print(f"  {cmd}")
        sys.exit(1)

    try:
        import MeCab
        MeCab.Tagger()
    except RuntimeError as exc:
        error_text = str(exc)
        print("\\n[Error] MeCab failed to initialize.")
        if "unidic\\\\dicdir\\\\mecabrc" in error_text or "unidic/dicdir/mecabrc" in error_text:
            print("  Full unidic is installed without its dictionary.")
            print("  Use the packaged unidic-lite dictionary instead:")
            print("  pip uninstall -y unidic")
            print("  pip install unidic-lite")
        else:
            print(f"  {error_text}")
        sys.exit(1)`,
    },
    {
      id: "download_checkpoints",
      name: "download_checkpoints()",
      fileId: "main",
      summary: "V2 AI 모델 파일(체크포인트)이 없으면 S3에서 다운로드하고 압축 해제함.",
      how: "모델이 이미 있으면 즉시 건너뜀. 없으면 urllib.request로 파일을 청크(덩어리) 단위로 받아 진행률을 표시함. 다운로드 후 임시 폴더에 압축을 풀고, converter/와 base_speakers/ses/ 경로를 찾아 최종 위치에 복사함. 오류가 나면 수동 다운로드 방법을 안내함.",
      terms: ["urllib.request", "zipfile", "tempfile", "Path.rglob()", "shutil", "예외 처리(try/except)"],
      lines: [
        { at: 'if converter_dir.exists() and ses_dir.exists() and any(ses_dir.glob("*.pth")):', text: "체크포인트 디렉터리와 .pth 파일이 이미 있으면 다운로드를 건너뜀(중복 다운로드 방지)." },
        { at: 'with urllib.request.urlopen(CHECKPOINT_URL) as resp:', text: "urllib.request.urlopen은 인터넷 주소를 열어 파일을 받는 표준 라이브러리 함수임." },
        { at: 'chunk_size = 1024 * 64', text: "파일을 64 KB 덩어리(chunk)씩 나눠 받음. 한꺼번에 받지 않아 메모리가 절약되고 진행률 표시가 가능함." },
        { at: 'pct = downloaded / total * 100', text: "받은 크기 ÷ 전체 크기 × 100으로 진행률(%)을 계산해 표시함." },
        { at: 'with tempfile.TemporaryDirectory() as tmp_extract:', text: "TemporaryDirectory는 임시 폴더를 만들고, with 블록이 끝나면 자동으로 삭제해 줌." },
        { at: 'converter_src = next(tmp_root.rglob("converter/config.json"), None)', text: "rglob은 하위 폴더를 재귀 탐색해 파일을 찾음. zip 내부 디렉터리 구조에 무관하게 원하는 파일을 찾을 수 있음." },
        { at: 'zip_path.unlink(missing_ok=True)', text: "압축 해제 후 임시 zip 파일을 삭제함. missing_ok=True는 파일이 없어도 오류를 내지 않음." },
      ],
      code:
`def download_checkpoints() -> None:
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
                        print(f"\\r  {pct:.1f}%  ({downloaded // 1024 // 1024} MB)", end="", flush=True)
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
        print(f"\\n[Error] Checkpoint download failed: {e}")
        print("  Manual download:")
        print(f"  1. Download {CHECKPOINT_URL}")
        print(f"  2. Extract checkpoints_v2/ into {SCRIPT_DIR}")
        if zip_path.exists():
            zip_path.unlink()
        sys.exit(1)`,
    },
    {
      id: "scan_voices",
      name: "scan_voices()",
      fileId: "main",
      summary: "voices/ 폴더의 비-WAV 음성 파일을 ffmpeg로 WAV로 변환하고, WAV 파일 목록을 정렬해 반환함.",
      how: "ToneColorConverter는 WAV 파일만 읽을 수 있음. 이 함수가 MP3·M4A 등을 미리 WAV로 변환해 준비함. ffmpeg 명령을 subprocess.run으로 실행하고, 변환된 파일이 이미 있으면 건너뜀(반복 변환 방지).",
      terms: ["subprocess.run", "Path.glob()", "sorted()", "타입 힌트"],
      lines: [
        { at: 'VOICES_DIR.mkdir(parents=True, exist_ok=True)', text: "voices/ 폴더가 없으면 만들어 둠. exist_ok=True는 이미 있어도 오류 없이 넘어가게 함." },
        { at: 'for ext in VOICE_EXTENSIONS:', text: "지원 확장자 목록을 하나씩 돌며 해당 확장자 파일들을 non_wav 목록에 수집함." },
        { at: 'if dst.exists():', text: "변환된 WAV 파일이 이미 있으면 건너뜀(이미 변환한 파일을 다시 변환하지 않음)." },
        { at: '["ffmpeg", "-y", "-i", str(src), str(dst)]', text: "ffmpeg를 실행하는 명령어 목록임. -y는 덮어쓰기 허용, -i는 입력 파일 지정. subprocess.run이 이 목록을 외부 프로그램 실행으로 넘겨줌." },
        { at: 'return sorted(VOICES_DIR.glob("*.wav"))', text: "변환이 끝난 뒤, voices/ 폴더의 WAV 파일을 이름순으로 정렬해 목록으로 돌려줌." },
      ],
      code:
`def scan_voices() -> List[Path]:
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

    return sorted(VOICES_DIR.glob("*.wav"))`,
    },
    {
      id: "normalize_mapping",
      name: "normalize_mapping(mapping)",
      fileId: "main",
      summary: "저장된 매핑에서 비-WAV 파일명을 변환된 WAV 파일명으로 업데이트함.",
      how: "이전에 MP3 파일로 저장된 매핑이 있으면, 변환된 WAV 파일명으로 자동 교체함. 오래된 mapping.json이 있어도 새로운 WAV 파일을 올바르게 찾을 수 있게 해주는 마이그레이션 함수임.",
      terms: ["딕셔너리(dict)", "Path.suffix", "타입 힌트"],
      lines: [
        { at: 'for spk, fname in mapping.items():', text: "매핑(딕셔너리)의 화자명과 파일명 쌍을 하나씩 꺼냄. .items()는 키-값 쌍을 함께 꺼내는 방법임." },
        { at: 'if p.suffix.lower() != ".wav":', text: "파일 확장자가 WAV가 아니면(예: .mp3), 변환된 WAV 파일명으로 교체할 준비를 함." },
        { at: 'if (VOICES_DIR / wav_name).exists():', text: "변환된 WAV 파일이 실제로 있을 때만 교체함. 없으면 원래 이름을 그대로 둠." },
      ],
      code:
`def normalize_mapping(mapping: Dict[str, str]) -> Dict[str, str]:
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
    return updated`,
    },
    {
      id: "load_mapping",
      name: "load_mapping()",
      fileId: "main",
      summary: "JSON 파일에서 이전에 저장한 화자→음성 파일명 매핑을 읽어옴. 파일이 없거나 오류면 None 반환.",
      how: "다시 실행할 때마다 화자 배정을 새로 물어보면 불편함. 이전 선택을 mapping.json에 저장해 두고 재사용함. json.load로 파일을 읽어 딕셔너리로 돌려줌.",
      terms: ["JSON", "Optional", "예외 처리(try/except)"],
      lines: [
        { at: 'if not MAPPING_FILE.exists():', text: "매핑 파일이 아직 없으면(처음 실행) None을 돌려줘, 새 매핑을 만들게 함." },
        { at: 'with open(MAPPING_FILE, encoding="utf-8") as f:', text: "파일을 UTF-8로 열어 읽음. with 블록을 벗어나면 파일이 자동으로 닫힘." },
        { at: 'data = json.load(f)', text: "JSON 파일을 읽어 파이썬 딕셔너리로 변환함." },
        { at: "print(f\"[Mapping] Failed to load", text: "오류가 나면 오류 내용을 출력하고 None을 반환해 새 매핑을 선택하게 유도함. 앱이 죽지 않게 안전하게 처리함." },
      ],
      code:
`def load_mapping() -> Optional[Dict[str, str]]:
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
        return None`,
    },
    {
      id: "save_mapping",
      name: "save_mapping(mapping)",
      fileId: "main",
      summary: "화자→음성 파일명 매핑을 JSON 파일에 저장해, 다음 실행 시 재사용할 수 있게 함.",
      how: "딕셔너리를 json.dump로 파일에 씀. ensure_ascii=False는 한글 화자명을 그대로 저장(\\uXXXX 이스케이프 방지). indent=2는 보기 좋게 들여쓰기를 추가함.",
      terms: ["JSON", "딕셔너리(dict)", "ensure_ascii"],
      lines: [
        { at: 'with open(MAPPING_FILE, "w", encoding="utf-8") as f:', text: "파일을 쓰기 모드('w')로 열어, 이전 내용을 덮어씀." },
        { at: 'json.dump(mapping, f, ensure_ascii=False, indent=2)', text: "딕셔너리를 JSON으로 변환해 파일에 씀. ensure_ascii=False는 한글을 그대로 저장하게 함." },
      ],
      code:
`def save_mapping(mapping: Dict[str, str]) -> None:
    """화자→음성 파일명 매핑을 JSON 파일에 저장하여 재사용을 가능하게 함."""
    with open(MAPPING_FILE, "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
    print(f"[Mapping] Saved to {MAPPING_FILE.name}")`,
    },
    {
      id: "select_voice_for_speaker",
      name: "select_voice_for_speaker(speaker, voice_files)",
      fileId: "main",
      summary: "참조 음성 목록을 번호와 함께 보여주고, 사용자가 선택한 음성 파일명을 반환함.",
      how: "화자마다 '어떤 목소리로 합성할지' 선택하게 하는 대화식 함수임. 파일을 번호와 크기와 함께 표시하고, input()으로 번호를 받아 해당 파일을 선택함. 잘못된 입력은 while로 다시 물어봄.",
      terms: ["input()", "enumerate()", "while 반복", "예외 처리(try/except)"],
      lines: [
        { at: 'for i, vf in enumerate(voice_files, 1):', text: "enumerate(..., 1)는 1번부터 번호를 매기며 파일 목록을 꺼냄." },
        { at: 'size_kb = vf.stat().st_size // 1024', text: "파일 크기를 바이트로 읽어 //1024(정수 나눗셈)로 KB 단위로 변환함." },
        { at: 'choice = input(f"Enter number (1-{len(voice_files)}): ").strip()', text: "input()으로 사용자가 키보드로 번호를 입력하게 함. .strip()으로 앞뒤 공백을 제거함." },
        { at: 'idx = int(choice) - 1', text: "입력한 번호를 숫자로 바꾸고 1을 빼서 0-기반 목록 인덱스로 변환함." },
        { at: 'if 0 <= idx < len(voice_files):', text: "번호가 유효한 범위 안이면 해당 파일을 선택함. 범위 밖이거나 숫자가 아니면 while로 다시 물어봄." },
      ],
      code:
`def select_voice_for_speaker(speaker: str, voice_files: List[Path]) -> str:
    """참조 음성 목록을 표시하고, 사용자가 선택한 파일명을 반환함."""
    print(f"\\n{'=' * 60}")
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
        print("Invalid choice. Please try again.")`,
    },
    {
      id: "load_dialog",
      name: "load_dialog(path)",
      fileId: "main",
      summary: "파이프(|) 구분자 CSV에서 대화 데이터를 읽어 speaker·text 컬럼을 검증하고 반환함.",
      how: "pandas의 read_csv로 파일을 읽음. sep='|'로 파이프 기호를 구분자로 지정함. 필수 컬럼(speaker, text) 검사 → 빈 행 제거 → 앞뒤 공백 제거 → 빈 텍스트 제거 순으로 정제함.",
      terms: ["pandas(pd)", "DataFrame", "dropna()", "reset_index()"],
      lines: [
        { at: 'df = pd.read_csv(path, sep="|", encoding="utf-8")', text: "pandas로 CSV를 읽음. sep='|'는 파이프(|)를 열 구분자로 쓴다는 뜻임. encoding='utf-8'은 한글을 올바르게 읽기 위해 필수임." },
        { at: 'if col not in df.columns:', text: "필수 컬럼(speaker, text)이 없으면 오류를 출력하고 종료함. 잘못된 CSV 형식을 조기에 잡아냄." },
        { at: 'df = df.dropna(subset=["speaker", "text"])', text: "speaker나 text가 비어있는(NaN) 행을 제거함. 빈 셀이 있는 행은 합성할 수 없음." },
        { at: 'df["text"] = df["text"].astype(str).str.strip()', text: "text 컬럼의 값을 문자열로 변환하고 앞뒤 공백을 제거함." },
        { at: 'return df[df["text"] != ""].reset_index(drop=True)', text: "공백 제거 후 빈 문자열이 된 행까지 걸러내고, 행 번호를 0부터 다시 매겨 돌려줌." },
      ],
      code:
`def load_dialog(path: Path) -> pd.DataFrame:
    """파이프(|) 구분자 CSV에서 대화 데이터를 로드하고 필수 컬럼을 검증하여 반환함."""
    if not path.exists():
        print(f"\\n[Error] Input file not found: {path}")
        sys.exit(1)
    df = pd.read_csv(path, sep="|", encoding="utf-8")
    for col in ("speaker", "text"):
        if col not in df.columns:
            print(f"\\n[Error] Required column '{col}' not found in {path.name}")
            sys.exit(1)
    df = df.dropna(subset=["speaker", "text"])
    df["text"] = df["text"].astype(str).str.strip()
    return df[df["text"] != ""].reset_index(drop=True)`,
    },
    {
      id: "make_silence",
      name: "make_silence(duration_sec, sample_rate)",
      fileId: "main",
      summary: "지정한 길이(초)의 무음(0값) float32 배열을 생성해 반환함.",
      how: "대사와 대사 사이의 짧은 침묵을 만드는 함수임. duration_sec × sample_rate = 무음에 필요한 샘플 수. numpy.zeros로 0으로 채워진 배열을 만들면 무음이 됨.",
      terms: ["numpy(np)", "float32", "샘플레이트"],
      lines: [
        { at: 'return np.zeros(int(duration_sec * sample_rate), dtype=np.float32)', text: "duration_sec(초) × sample_rate(초당 샘플 수) = 필요한 샘플 수. np.zeros로 그 수만큼 0을 채운 배열을 만들어 무음을 표현함." },
      ],
      code:
`def make_silence(duration_sec: float, sample_rate: int) -> np.ndarray:
    """지정 길이(초)의 무음 float32 배열을 생성하여 반환함."""
    return np.zeros(int(duration_sec * sample_rate), dtype=np.float32)`,
    },
    {
      id: "read_wav_float",
      name: "read_wav_float(path)",
      fileId: "main",
      summary: "WAV 파일을 읽어 (float32 배열, 샘플레이트) 형태로 반환함. 스테레오는 모노로 변환함.",
      how: "scipy.io.wavfile으로 WAV를 읽으면 int16 또는 int32 형식으로 옴. 이를 numpy 배열 연산이 쉬운 float32(-1.0~1.0 범위)로 변환함. 스테레오(2채널)면 양쪽 평균을 내어 모노(1채널)로 합침.",
      terms: ["scipy.io.wavfile", "numpy(np)", "float32", "스테레오·모노", "튜플(tuple)"],
      lines: [
        { at: 'sr, data = wavfile.read(path)', text: "scipy.io.wavfile.read로 WAV 파일을 읽음. sr은 샘플레이트(초당 샘플 수), data는 오디오 데이터 배열임." },
        { at: 'audio = data.astype(np.float32) / 32768.0', text: "int16 범위(-32768~32767)를 float32(-1.0~1.0)로 변환함. ÷32768.0으로 정규화함." },
        { at: 'if audio.ndim == 2:', text: "ndim==2는 스테레오(좌우 2채널)임을 의미함. .mean(axis=1)로 좌우 평균을 내어 모노(1채널)로 합침." },
        { at: 'return audio, sr', text: "변환된 float32 오디오 배열과 샘플레이트를 튜플로 돌려줌." },
      ],
      code:
`def read_wav_float(path: str) -> tuple:
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
    return audio, sr`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "전체 TTS 파이프라인을 지휘하는 진입점. 검사→다운로드→탐색→로드→매핑→모델→합성→저장 순으로 실행함.",
      how: "프로그램의 '지휘자'임. 각 단계 함수를 순서대로 호출해 전체 흐름을 진행함. AI 모델(ToneColorConverter·MeloTTS)은 이 함수 안에서 로드함. 각 대사마다 2단계(MeloTTS→ToneColorConverter) 합성을 반복하고, 마지막에 모든 세그먼트를 합쳐 WAV로 저장함.",
      terms: ["tqdm", "tempfile", "numpy(np)", "int16", "if __name__"],
      lines: [
        { at: 'if hasattr(sys.stdout, "reconfigure"):', text: "Windows 콘솔에서 한글 출력 시 깨짐 방지. sys.stdout.reconfigure로 출력 인코딩을 UTF-8로 설정함." },
        { at: 'device = "cuda" if torch.cuda.is_available() else "cpu"', text: "GPU(CUDA)가 있으면 자동으로 GPU를 사용함. 없으면 CPU로 실행함. GPU가 훨씬 빠름." },
        { at: 'converter = ToneColorConverter(str(config_path), device=device)', text: "ToneColorConverter: 참조 음성의 음색(목소리 특성)을 합성 음성에 입히는 OpenVoice의 핵심 모듈임." },
        { at: 'melo_model = MeloTTS(language="KR", device=device)', text: "MeloTTS: 텍스트를 한국어 음성으로 합성하는 모델임. language='KR'로 한국어를 지정함." },
        { at: 'tgt_se = converter.extract_se([str(ref_path)])', text: "참조 음성 파일을 분석해 음색 특성을 숫자 벡터(Speaker Embedding)로 추출함. 이 벡터가 나중에 음색 이전에 쓰임." },
        { at: 'for i, (_, row) in enumerate(tqdm(rows, desc="Generating")):', text: "tqdm은 반복 작업의 진행률을 프로그레스 바로 보여주는 라이브러리임. 대사가 몇 개 중 몇 개 처리됐는지 확인할 수 있음." },
        { at: 'melo_model.tts_to_file(text, kr_spk_id, tmp_melo, speed=MELO_SPEED)', text: "★1단계★ MeloTTS로 텍스트를 기본 한국어 음성 파일로 합성함." },
        { at: 'converter.convert(', text: "★2단계★ ToneColorConverter가 1단계 음성에 참조 음성의 음색을 입혀 목소리를 복제함." },
        { at: 'final = np.concatenate(segments)', text: "모든 대사 세그먼트(음성 배열)를 하나로 이어 붙임." },
        { at: 'final = final / max_val * 0.95', text: "음량을 최대값 기준으로 정규화함(0.95로 스케일). 소리가 너무 크거나 작지 않게 균일하게 맞춤." },
        { at: 'final_int16 = (final * 32767).astype(np.int16)', text: "float32(-1.0~1.0)를 16-bit PCM 정수(int16)로 변환함. 표준 WAV 파일 형식임." },
        { at: 'wavfile.write(str(output_path), sample_rate, final_int16)', text: "최종 오디오를 WAV 파일로 저장함. 이 파일을 재생하면 음성 복제 결과를 들을 수 있음." },
      ],
      code:
`def main() -> None:
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
        print(f"\\n[Error] No voice files found in {VOICES_DIR}")
        print("  Place reference voice files in the voices/ directory.")
        print("  Supported: WAV (direct) or any ffmpeg format (MP3/M4A/FLAC/OGG/AAC etc.)")
        print("  Non-WAV files are auto-converted to WAV and saved in voices/ on first run.")
        sys.exit(1)
    print(f"\\n[Voices] {len(voice_files)} reference voice(s):")
    for vf in voice_files:
        print(f"  - {vf.name}")

    # 5. 대화 파일 로드
    print(f"\\n[Load] Reading dialog from {input_path.name}...")
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
        print("\\n[Mapping] No mapping file. Select reference voices for each speaker.")
        mapping = {}
        need_save = True
    else:
        missing = [s for s in speakers if s not in mapping]
        if missing:
            print(f"\\n[Mapping] New speakers: {missing}. Select reference voices.")
            need_save = True
        else:
            print("\\n[Mapping] Current speaker → voice mapping:")
            for spk in speakers:
                print(f"  {spk} → {mapping[spk]}")
            try:
                answer = input("\\nChange mapping? (y/N): ").strip().lower()
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

    print("\\n[Mapping] Speaker → Reference Voice")
    for spk in speakers:
        print(f"  {spk} → {mapping.get(spk, '(not mapped)')}")

    # 7. 매핑된 음성 파일 존재 여부 검증
    for spk in speakers:
        ref = VOICES_DIR / mapping[spk]
        if not ref.exists():
            print(f"\\n[Error] Reference voice not found: {ref}")
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
    print(f"\\n[Model] Device: {device}")

    # 8a. ToneColorConverter 로드
    ckpt_converter = CHECKPOINT_DIR / "converter"
    config_path    = ckpt_converter / "config.json"
    ckpt_path      = ckpt_converter / "checkpoint.pth"

    for p in (config_path, ckpt_path):
        if not p.exists():
            print(f"\\n[Error] Checkpoint file missing: {p}")
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
        print(f"\\n[Error] KR source speaker embedding not found: {src_se_path}")
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
    print("\\n[SE] Extracting target speaker embeddings from reference voices...")
    target_ses: Dict[str, object] = {}
    for spk in speakers:
        ref_path = VOICES_DIR / mapping[spk]
        print(f"  {spk} → {mapping[spk]}")
        tgt_se = converter.extract_se([str(ref_path)])
        target_ses[spk] = tgt_se

    # 10. 라인별 음성 합성 (파일 기반 파이프라인)
    print("\\n[Audio] Generating voice-cloned Korean speech...")
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
        print("\\n[Error] No audio segments generated.")
        sys.exit(1)

    # 11. 세그먼트 연결, 정규화, 16-bit PCM WAV 저장
    print("\\n[Audio] Concatenating segments...")
    final = np.concatenate(segments)

    max_val = np.max(np.abs(final))
    if max_val > 0:
        final = final / max_val * 0.95

    final_int16 = (final * 32767).astype(np.int16)
    # 오디오 데이터를 16-bit PCM WAV 파일로 저장함
    wavfile.write(str(output_path), sample_rate, final_int16)

    duration = len(final) / sample_rate
    print(f"\\n[Done] Output  : {output_path}")
    print(f"[Done] Duration: {duration:.2f}s  |  Sample rate: {sample_rate} Hz")
    print("\\n" + "=" * 60)
    print("Voice Cloning Complete!")
    print("=" * 60)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()`,
    },
  ],

  glossary: {
    "os.environ.setdefault": "환경변수가 아직 없을 때만 값을 설정하는 함수. 이미 있으면 건드리지 않음. 프로그램 시작 전 경고·설정을 미리 조정할 때 씀.",
    "monkey-patch": "라이브러리 내부 함수를 실행 중에 다른 함수로 교체하는 기법. 소스 코드를 수정하지 않고 동작을 바꿀 때 씀. 예: 버전 호환 문제를 외부에서 해결.",
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .parent를 붙이면 이 파일이 든 폴더의 경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "tuple(튜플)": "여러 값을 순서대로 담는 자료 구조. 리스트와 비슷하지만 한 번 만들면 내용을 바꿀 수 없음(불변). () 괄호로 표현함.",
    "importlib.util.find_spec": "파이썬 패키지를 실제로 import하지 않고 설치 여부만 빠르게 확인하는 함수. None이면 설치 안 됨.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "sys.exit()": "프로그램을 즉시 종료하는 함수. sys.exit(1)은 '오류로 종료', sys.exit(0)은 '정상 종료'를 의미함.",
    "MeCab": "일본어와 한국어 텍스트를 형태소(의미 단위)로 분리하는 라이브러리. MeloTTS가 한국어 텍스트를 처리할 때 내부적으로 사용함.",
    "urllib.request": "파이썬 표준 라이브러리로, 인터넷 주소(URL)에서 파일을 받거나 데이터를 주고받는 기능을 제공함.",
    "zipfile": "ZIP 압축 파일을 만들거나 압축 해제하는 파이썬 표준 라이브러리.",
    "tempfile": "임시 파일·폴더를 만들고 작업 후 자동으로 삭제해 주는 파이썬 표준 라이브러리. with 블록으로 쓰면 블록이 끝날 때 자동 정리됨.",
    "Path.rglob()": "폴더 아래 모든 하위 폴더까지 재귀(반복) 탐색해 패턴에 맞는 파일을 찾는 함수. glob는 같은 폴더만, rglob는 모든 하위 폴더까지 찾음.",
    "shutil": "파일·폴더를 복사하거나 삭제하는 고수준 유틸리티 라이브러리. shutil.copytree(폴더 복사), shutil.copy2(파일 복사), shutil.rmtree(폴더 삭제) 등을 제공함.",
    "subprocess.run": "파이썬 안에서 다른 외부 프로그램(예: ffmpeg)을 실행하는 함수. 명령어를 리스트로 전달하면 실행하고 결과를 돌려줌.",
    "Path.glob()": "특정 폴더 안에서 패턴(예: '*.wav')에 맞는 파일을 찾아 목록으로 돌려주는 함수.",
    "sorted()": "목록을 정렬해 새 목록으로 돌려주는 함수. 파일 목록을 이름순으로 정렬할 때 씀.",
    "타입 힌트": "변수나 함수에 '이건 문자열(str)이야, 결과는 목록(list)이야'처럼 자료의 종류를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "JSON": "데이터를 주고받는 표준 글자 형식. {\"key\": \"value\"} 모양으로, 파이썬 딕셔너리와 거의 똑같이 생김.",
    "Optional": "값이 있을 수도 있고, 없을 수도 있는(None일 수도 있는) 타입을 표시하는 힌트. Optional[str]은 '문자열이거나 None'이라는 뜻임.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"화자A\": \"voice1.wav\"}처럼 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    "Path.suffix": "Path 객체의 .suffix는 파일 확장자(예: '.mp3')를 줌. .lower()로 소문자로 맞춰 비교함.",
    "ensure_ascii": "json.dump 옵션. False로 설정하면 한글 등 비ASCII 문자를 \\uXXXX 코드 대신 원래 글자 그대로 저장함.",
    "input()": "콘솔(터미널)에서 사용자가 키보드로 입력한 한 줄을 글자로 받아오는 함수.",
    "enumerate()": "목록을 돌면서 '번호와 값'을 함께 꺼내 주는 함수. start=1을 주면 1번부터 셈.",
    "while 반복": "조건이 참인 동안 계속 도는 반복문. 여기서는 올바른 번호를 입력할 때까지 다시 묻는 데 씀.",
    "pandas(pd)": "표(2차원 데이터)를 다루는 파이썬 대표 라이브러리. CSV 파일을 읽거나 데이터를 정제할 때 씀.",
    "DataFrame": "pandas에서 표 형태 데이터를 담는 자료 구조. 행·열로 이루어져 있으며, 엑셀 시트와 비슷함.",
    "dropna()": "pandas에서 NaN(빈 값)이 있는 행을 제거하는 함수. subset=['컬럼']으로 특정 컬럼이 빈 행만 제거할 수 있음.",
    "reset_index()": "pandas에서 행 번호(인덱스)를 0부터 새로 매기는 함수. 행을 제거한 후 번호가 뒤섞인 것을 깔끔하게 정리함.",
    "numpy(np)": "파이썬에서 숫자 배열(벡터·행렬)을 빠르게 다루는 핵심 라이브러리. 오디오 데이터를 숫자 배열로 처리할 때 씀.",
    "float32": "소수점 숫자를 32비트로 표현하는 형식. 오디오 처리에서 -1.0~1.0 범위의 값으로 음성을 표현함.",
    "샘플레이트": "1초에 오디오 신호를 몇 번 측정했는지를 나타내는 값(Hz). 44100Hz면 1초에 44,100번 측정. 숫자가 클수록 음질이 좋음.",
    "scipy.io.wavfile": "WAV 오디오 파일을 읽거나 쓰는 scipy 라이브러리의 하위 모듈. wavfile.read(파일 읽기), wavfile.write(파일 쓰기)를 제공함.",
    "스테레오·모노": "스테레오는 좌·우 2채널, 모노는 1채널 오디오. ToneColorConverter는 모노 입력을 처리하므로 스테레오를 평균내어 모노로 변환함.",
    "튜플(tuple)": "여러 값을 순서대로 묶어 돌려주는 자료 구조. 함수에서 여러 결과를 한꺼번에 돌려줄 때 씀. (audio, sr) 처럼 소괄호로 표현함.",
    "tqdm": "반복 작업의 진행률을 프로그레스 바로 화면에 보여주는 라이브러리. 얼마나 처리됐는지 한눈에 확인할 수 있게 해줌.",
    "int16": "정수를 16비트로 표현하는 형식. 표준 WAV 파일의 오디오 형식으로, -32768~32767 범위의 정수값으로 소리를 표현함.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
    "ToneColorConverter": "OpenVoice의 핵심 모듈. 참조 음성의 음색(목소리 특성)을 추출하고, 그 특성을 합성 음성에 입혀 비슷한 목소리를 만들어 냄.",
    "MeloTTS": "MyShell이 만든 다국어 TTS(Text-to-Speech) 모델. 텍스트를 다양한 언어의 음성으로 합성함. language='KR'로 한국어를 지정함.",
    "Speaker Embedding": "특정 화자의 목소리 특성을 수치화한 벡터(숫자 배열). '목소리 지문'과 같음. ToneColorConverter가 참조 음성에서 추출함.",
  },
};
