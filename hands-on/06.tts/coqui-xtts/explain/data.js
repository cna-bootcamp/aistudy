/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../06.tts/coqui-xtts/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "Coqui XTTS v2 음성 복제 TTS 예제 설명",
    entry: "tts.py",
  },

  files: [
    { id: "main", label: "tts.py", role: "단일 파일 · 음성 복제(Voice Cloning) TTS 전체 파이프라인" },
  ],

  flow: [
    { step: 1, title: "환경 준비", label: "환경 준비", refs: ["module_setup"],
      summary: "COQUI_TOS_AGREED 환경변수 설정 + PyTorch monkey-patch 적용",
      detail: "가게 문을 열기 전 준비물을 챙기는 단계임. XTTS v2 모델을 쓰려면 라이선스 동의 신호(COQUI_TOS_AGREED)를 미리 환경변수로 전달해야 함. 또한 PyTorch 2.6 이상에서 XTTS 모델 파일 로딩이 깨지는 문제를 임시 패치(monkey-patch)로 미리 수정해 둠." },
    { step: 2, title: "사전 요건 검사", label: "사전 요건 검사", refs: ["check_prerequisites"],
      summary: "check_prerequisites()가 PyTorch·Coqui TTS 설치 여부를 확인함",
      detail: "주방 기구가 다 있는지 확인하는 단계임. PyTorch나 Coqui TTS 라이브러리가 설치되지 않은 채 실행하면 설치 안내를 보여주고 즉시 종료함. 덕분에 엉뚱한 오류 대신 명확한 안내를 받을 수 있음." },
    { step: 3, title: "참조 음성 탐색·변환", label: "음성 탐색·변환", refs: ["scan_voices", "preconvert_voices"],
      summary: "scan_voices()로 voices/ 폴더의 오디오 파일을 모으고, preconvert_voices()로 WAV로 변환함",
      detail: "목소리 재료를 준비하는 단계임. XTTS v2는 WAV 파일로 참조 음성을 받으므로, mp3·m4a 등 다른 형식은 ffmpeg로 WAV로 변환함. 이미 변환된 파일은 건너뜀." },
    { step: 4, title: "대화 CSV 로드", label: "대화 CSV 로드", refs: ["load_dialog"],
      summary: "load_dialog()가 text/dialog.csv를 읽어 화자(speaker)·대사(text) 데이터프레임을 만듦",
      detail: "대본을 읽는 단계임. 파이프(|)로 구분된 CSV 파일에서 누가 무슨 말을 하는지를 읽어옴. 빈 줄이나 누락 컬럼은 자동으로 걸러냄." },
    { step: 5, title: "화자→음성 매핑", label: "화자 매핑", refs: ["load_mapping", "save_mapping", "select_voice_for_speaker"],
      summary: "각 화자에게 어떤 참조 음성 파일을 쓸지 결정함(JSON 저장·재사용)",
      detail: "배우에게 목소리를 배정하는 단계임. mapping.json이 있으면 이전 설정을 재사용하고, 없거나 새 화자가 생기면 사용자가 번호를 입력해 직접 배정함. 한번 정하면 mapping.json에 저장되어 다음 실행 시 자동 적용됨." },
    { step: 6, title: "XTTS v2 모델 로드", label: "모델 로드",
      summary: "TTS(model_name=...).to(device)로 모델을 GPU 또는 CPU에 올림",
      detail: "음성 합성 엔진을 켜는 단계임. 처음 실행 시 약 1.8 GB 모델 파일을 인터넷에서 내려받음. GPU(CUDA)가 있으면 GPU로, 없으면 CPU로 실행함. GPU가 훨씬 빠름." },
    { step: 7, title: "음성 세그먼트 생성", label: "세그먼트 생성", refs: ["make_silence"],
      summary: "tts.tts()를 각 대사 행마다 호출해 음성 조각(float32 배열)을 생성함",
      detail: "대사 한 줄씩 녹음하는 단계임. 화자별 참조 음성 파일을 기준으로 그 목소리 특성을 복제해 한국어 음성을 생성함. 대사 사이에 짧은 무음 구간을 끼워 자연스럽게 이어지게 함. tqdm이 진행률 막대를 보여줌." },
    { step: 8, title: "연결·정규화·저장", label: "연결·정규화·저장",
      summary: "모든 세그먼트를 이어 붙이고, 음량을 정규화해 16-bit PCM WAV로 저장함",
      detail: "녹음 조각들을 하나의 완성본으로 만드는 단계임. 모든 음성 조각을 연결한 뒤, 가장 큰 소리를 기준으로 전체 음량을 맞추고(정규화), scipy로 WAV 파일로 저장함." },
  ],

  functions: [
    // ===== tts.py =====
    {
      id: "module_setup",
      name: "모듈 설정 (상수·패치·환경변수)",
      fileId: "main",
      summary: "파일 맨 위에서 라이선스 동의 환경변수 설정, PyTorch monkey-patch, 경로 상수, 기본 화자 매핑을 준비함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 준비하는 설정'임. COQUI_TOS_AGREED를 환경변수로 먼저 보내야 XTTS가 실행됨. PyTorch 2.6부터 weights_only=True가 기본이 되어 XTTS 모델 파일 로딩이 실패하므로, torch.load 함수를 수정된 버전으로 교체(monkey-patch)해 이 문제를 미리 해결함. SCRIPT_DIR·VOICES_DIR 같은 경로는 이 파일 위치를 기준으로 자동 계산함.",
      terms: ["os.environ", "monkey-patch", "weights_only", "Path(__file__)", "딕셔너리(dict)", "타입 힌트"],
      lines: [
        { at: 'os.environ["COQUI_TOS_AGREED"] = "1"', text: "XTTS v2를 실행하려면 CPML 라이선스에 동의했다는 신호를 환경변수로 먼저 보내야 함. import TTS보다 앞에 와야 함." },
        { at: '_torch_load_orig = _torch.load', text: "원래 torch.load 함수를 _torch_load_orig에 백업해 둠. 나중에 원래 기능은 유지하면서 옵션만 바꿔 호출하기 위함." },
        { at: 'kwargs["weights_only"] = False', text: "★핵심★ PyTorch 2.6+에서 weights_only가 True로 바뀌어 XTTS 모델 pickle 파일 로딩이 실패함. False로 강제 설정해 기존 동작을 복원함." },
        { at: '_torch.load = _torch_load_compat', text: "원래 torch.load를 수정된 버전으로 교체함(monkey-patch). 이후 모든 torch.load 호출이 이 수정판을 거치게 됨." },
        { at: 'SCRIPT_DIR = Path(__file__).parent', text: "Path(__file__)은 '이 파이썬 파일'. .parent로 이 파일이 든 폴더(coqui-xtts/)의 경로를 구함." },
        { at: 'DEFAULT_MAPPING: Dict[str, str] = {', text: "기본 화자→음성 파일 매핑 표임. mapping.json이 없거나 새 화자가 생겼을 때 이 표에서 먼저 찾아 자동 배정함." },
      ],
      code:
`# COQUI_TOS_AGREED: CPML 라이선스 동의 — TTS import 전에 반드시 설정해야 함
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
}`,
    },
    {
      id: "check_prerequisites",
      name: "check_prerequisites()",
      fileId: "main",
      summary: "PyTorch와 Coqui TTS 라이브러리가 설치됐는지 확인하고, 없으면 안내 메시지를 보여주고 종료함.",
      how: "실제로 import해서 성공하면 설치된 것, ImportError가 나면 설치 안 된 것임. 오류를 '감지→안내→종료'로 처리해 엉뚱한 에러 대신 명확한 메시지를 보여줌.",
      terms: ["예외 처리(try/except)", "ImportError", "sys.exit"],
      lines: [
        { at: 'import torch  # noqa: F401', text: "torch를 import해봄. 설치되지 않았으면 ImportError가 발생해 except 블록으로 감." },
        { at: 'from TTS.api import TTS  # noqa: F401', text: "Coqui TTS 라이브러리도 같은 방식으로 확인함. 없으면 pip install -r requirements.txt 안내를 보여줌." },
        { at: 'Coqui TTS not installed. Run:', text: "Coqui TTS가 없을 때 설치 방법(pip install)을 안내하고 sys.exit(1)로 종료함. 0은 정상, 1 이상은 비정상 종료를 의미함." },
      ],
      code:
`def check_prerequisites() -> None:
    """PyTorch 및 Coqui TTS 설치 여부를 확인하고, 미설치 시 안내 후 종료함."""
    try:
        import torch  # noqa: F401
    except ImportError:
        print("\\n[Error] PyTorch not installed.")
        print("  Install guide: https://github.com/cna-bootcamp/aistudy/blob/main/agentic-ai/reference/install-pytorch.md")
        sys.exit(1)

    try:
        # TTS: Coqui TTS 라이브러리의 메인 API 클래스 — XTTS v2 모델 로드 및 음성 합성 담당
        from TTS.api import TTS  # noqa: F401
    except ImportError:
        print("\\n[Error] Coqui TTS not installed. Run: pip install -r requirements.txt")
        sys.exit(1)`,
    },
    {
      id: "scan_voices",
      name: "scan_voices()",
      fileId: "main",
      summary: "voices/ 폴더에서 지원하는 모든 오디오 파일을 찾아 정렬된 목록으로 반환함.",
      how: "VOICE_EXTENSIONS에 정의된 여러 확장자(wav·mp3·m4a 등)를 하나씩 glob으로 검색해 모음. 중복을 없애려고 set(집합)으로 변환했다가 sorted로 이름순 정렬함. 폴더가 없으면 먼저 만들어 둠.",
      terms: ["glob", "set(집합)", "sorted()", "타입 힌트"],
      lines: [
        { at: 'VOICES_DIR.mkdir(parents=True, exist_ok=True)', text: "voices/ 폴더가 없으면 만들어 둠. exist_ok=True는 이미 있어도 오류 없이 넘어가게 함." },
        { at: 'for ext in VOICE_EXTENSIONS:', text: "지원하는 확장자 목록을 하나씩 돌면서 그 확장자 파일을 glob으로 검색함." },
        { at: 'files.extend(VOICES_DIR.glob(ext))', text: "glob(패턴)은 패턴에 맞는 파일 목록을 돌려줌. extend로 files 목록에 이어 붙임." },
        { at: 'return sorted(set(files))', text: "set()으로 중복을 제거하고, sorted()로 이름순 정렬해 반환함." },
      ],
      code:
`def scan_voices() -> List[Path]:
    """voices/ 디렉터리의 지원 오디오 파일을 정렬하여 반환함."""
    VOICES_DIR.mkdir(parents=True, exist_ok=True)
    files: List[Path] = []
    for ext in VOICE_EXTENSIONS:
        files.extend(VOICES_DIR.glob(ext))
    return sorted(set(files))`,
    },
    {
      id: "preconvert_voices",
      name: "preconvert_voices(audio_files)",
      fileId: "main",
      summary: "비-WAV 오디오 파일을 ffmpeg로 WAV로 변환하고, 모든 파일을 WAV 목록으로 반환함.",
      how: "XTTS v2는 WAV 형식을 참조 음성으로 받음. mp3·m4a 등 다른 형식은 ffmpeg 명령어를 subprocess로 실행해 WAV로 변환함. 이미 변환된 파일은 건너뜀. 변환 실패 시 해당 파일만 건너뛰고 계속 진행함.",
      terms: ["subprocess", "ffmpeg", "타입 힌트"],
      lines: [
        { at: "if src.suffix.lower() == \".wav\":", text: "이미 WAV면 변환 없이 바로 목록에 추가하고 다음 파일로 넘어감." },
        { at: 'dst = src.with_suffix(".wav")', text: "변환 결과 파일 경로를 원본과 같은 이름에 확장자만 .wav로 바꿔 정함." },
        { at: 'result = subprocess.run(', text: "subprocess.run()으로 ffmpeg 변환 명령을 실행함. capture_output=True는 출력을 화면 대신 변수에 담음." },
        { at: 'if result.returncode != 0:', text: "returncode가 0이면 성공, 아니면 실패임. 실패 시 오류 메시지를 보여주고 해당 파일을 건너뜀." },
      ],
      code:
`def preconvert_voices(audio_files: List[Path]) -> List[Path]:
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
    return sorted(set(wav_files))`,
    },
    {
      id: "load_mapping",
      name: "load_mapping()",
      fileId: "main",
      summary: "화자→음성 파일 매핑을 mapping.json에서 읽어 반환함. 파일이 없거나 오류 시 None을 반환함.",
      how: "이전 실행에서 저장해 둔 mapping.json이 있으면 읽어서 재사용함. 파일이 없거나 JSON이 깨져 있으면 None을 반환하고 다시 선택 과정을 거침.",
      terms: ["JSON", "예외 처리(try/except)", "with open(rb)", "타입 힌트"],
      lines: [
        { at: 'if not MAPPING_FILE.exists():', text: "mapping.json 파일이 없으면 바로 None을 반환함(아직 매핑을 설정한 적 없는 상태)." },
        { at: 'with open(MAPPING_FILE, encoding="utf-8") as f:', text: "UTF-8 인코딩으로 파일을 열어 JSON을 읽음. with 블록을 벗어나면 파일이 자동으로 닫힘." },
        { at: 'data = json.load(f)', text: "json.load()가 파일의 JSON 텍스트를 파이썬 딕셔너리로 변환함." },
        { at: 'except Exception as e:', text: "JSON이 깨졌거나 다른 오류가 나면 None을 반환해 다시 선택하게 함." },
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
      summary: "화자→음성 파일 매핑을 mapping.json으로 저장해 다음 실행 시 재사용 가능하게 함.",
      how: "딕셔너리를 JSON 형태로 파일에 저장함. ensure_ascii=False는 한글을 그대로 저장(UTF-8), indent=2는 들여쓰기를 넣어 보기 좋게 만듦.",
      terms: ["JSON", "f-string", "딕셔너리(dict)"],
      lines: [
        { at: 'with open(MAPPING_FILE, "w", encoding="utf-8") as f:', text: "파일을 쓰기 모드(w)로 엶. 이미 있으면 덮어씀." },
        { at: 'json.dump(mapping, f, ensure_ascii=False, indent=2)', text: "json.dump()가 딕셔너리를 JSON 텍스트로 변환해 파일에 씀. ensure_ascii=False로 한글을 그대로 저장함." },
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
      summary: "화자 이름과 사용 가능한 음성 파일 목록을 보여주고, 사용자가 번호로 선택한 파일명을 반환함.",
      how: "화면에 파일 목록을 번호와 함께 출력하고, input()으로 번호를 입력받음. 숫자가 아니거나 범위 밖이면 다시 묻는 반복(while)을 돌림.",
      terms: ["enumerate()", "input()", "while 반복", "예외 처리(try/except)", "타입 힌트"],
      lines: [
        { at: 'for i, wav in enumerate(voice_files, 1):', text: "enumerate(..., 1)은 1번부터 번호를 매기며 항목을 함께 꺼내줌." },
        { at: 'size_kb = wav.stat().st_size // 1024', text: "파일 크기를 바이트로 읽어(stat().st_size) KB로 나눠 표시함." },
        { at: 'choice = input(f"Enter number (1-{len(voice_files)}): ").strip()', text: "사용자에게 번호 입력을 요청함. .strip()으로 앞뒤 공백을 제거함." },
        { at: 'idx = int(choice) - 1', text: "입력한 글자를 숫자로 바꾸고 1 빼서 목록 인덱스(0 시작)로 변환함. 숫자가 아니면 ValueError 발생." },
        { at: 'if 0 <= idx < len(voice_files):', text: "번호가 범위 안이면 해당 파일명을 반환함. 범위 밖이면 다시 반복." },
        { at: 'return selected.name', text: "폴더 경로는 빼고 파일명만 저장함(다른 컴퓨터에서도 경로가 맞도록 이식성 확보)." },
      ],
      code:
`def select_voice_for_speaker(speaker: str, voice_files: List[Path]) -> str:
    """참조 음성 목록을 표시하고, 사용자가 선택한 파일명을 반환함."""
    print(f"\\n{'=' * 60}")
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
        print("Invalid choice. Please try again.")`,
    },
    {
      id: "load_dialog",
      name: "load_dialog(path)",
      fileId: "main",
      summary: "파이프(|) 구분자 CSV에서 화자(speaker)·대사(text) 데이터를 읽어 검증된 데이터프레임으로 반환함.",
      how: "pandas의 read_csv로 CSV를 읽음. sep='|'은 파이프를 구분자로 쓰라는 뜻. speaker·text 컬럼이 없으면 즉시 종료함. 빈 줄이나 speaker·text 값이 없는 행은 dropna·필터로 걸러냄.",
      terms: ["pandas(DataFrame)", "dropna", "타입 힌트", "sys.exit"],
      lines: [
        { at: 'df = pd.read_csv(path, sep="|", encoding="utf-8")', text: "pandas로 파이프(|) 구분자 CSV를 읽음. 결과는 표(DataFrame)로 돌아옴." },
        { at: 'for col in ("speaker", "text"):', text: "필수 컬럼이 있는지 확인함. 없으면 오류 메시지를 보여주고 sys.exit(1)로 종료함." },
        { at: 'df = df.dropna(subset=["speaker", "text"])', text: "speaker나 text가 비어 있는 행을 제거함(dropna=null 값 제거)." },
        { at: 'df["text"] = df["text"].astype(str).str.strip()', text: "text를 문자열로 변환하고 앞뒤 공백을 제거함." },
        { at: 'return df[df["text"] != ""].reset_index(drop=True)', text: "빈 문자열 행을 제거하고 인덱스를 0부터 다시 매겨 반환함." },
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
      summary: "지정한 길이(초)만큼의 무음(0으로 채운 배열)을 생성해 반환함.",
      how: "오디오는 숫자 배열임. 0(진폭이 0 = 소리 없음)으로 채운 배열이 무음임. duration_sec(초) × sample_rate(1초당 샘플 수)로 필요한 배열 크기를 계산함.",
      terms: ["numpy(ndarray)", "float32", "sample_rate", "타입 힌트"],
      lines: [
        { at: 'return np.zeros(int(duration_sec * sample_rate), dtype=np.float32)', text: "np.zeros()는 0으로 채운 배열을 만듦. 크기는 '초×샘플레이트'로 계산함. float32는 XTTS가 쓰는 음성 데이터 타입임." },
      ],
      code:
`def make_silence(duration_sec: float, sample_rate: int) -> np.ndarray:
    """지정 길이(초)의 무음 float32 배열을 생성하여 반환함."""
    return np.zeros(int(duration_sec * sample_rate), dtype=np.float32)`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "XTTS v2 음성 복제 TTS 전체 파이프라인을 순서대로 실행하는 진입점.",
      how: "①사전 요건 검사 → ②음성 파일 탐색·변환 → ③대화 CSV 로드 → ④화자 매핑 → ⑤모델 로드 → ⑥음성 생성 → ⑦연결·저장 순으로 진행함. GPU 사용 가능 여부를 자동 감지해 적절한 장치를 선택함. tqdm으로 진행률을 표시하고, 대사 사이에 무음을 넣어 자연스럽게 연결함.",
      terms: ["XTTS v2", "음성 복제(Voice Cloning)", "tqdm", "numpy(ndarray)", "pandas(DataFrame)", "scipy.wavfile", "torch.cuda", "PCM", "sample_rate", "정규화(normalize)", "dict.fromkeys", "if __name__"],
      lines: [
        { at: 'device = "cuda" if torch.cuda.is_available() else "cpu"', text: "GPU(CUDA)가 있으면 'cuda', 없으면 'cpu'를 선택함. GPU가 훨씬 빠르지만, 없어도 CPU로 동작함." },
        { at: 'tts = TTS(model_name=MODEL_NAME).to(device)', text: "★핵심★ TTS 객체를 만들고 선택한 장치(GPU/CPU)로 올림. 처음 실행 시 약 1.8 GB 모델을 내려받음." },
        { at: 'speakers: List[str] = list(dict.fromkeys(', text: "dict.fromkeys()는 중복을 제거하면서 순서를 유지하는 방법임. set()은 순서가 깨짐." },
        { at: 'for i, (_, row) in enumerate(tqdm(rows, desc="Generating")):', text: "tqdm이 반복 진행률을 프로그레스 바로 보여줌. (_, row)에서 _는 쓰지 않는 인덱스를 버리는 관례." },
        { at: 'wav_data = tts.tts(text=text, speaker_wav=str(VOICES_DIR / mapping[spk]), language=LANGUAGE)', text: "★핵심★ tts.tts()가 text를 speaker_wav(참조 음성)의 목소리 특성을 복제해 한국어로 합성함." },
        { at: 'final = np.concatenate(segments)', text: "모든 음성 조각(세그먼트)을 하나의 긴 배열로 이어 붙임." },
        { at: 'final = final / max_val * 0.95', text: "가장 큰 진폭(max_val)으로 나눠 0~1 사이로 맞추고(정규화), 0.95를 곱해 클리핑 방지 여유를 둠." },
        { at: 'final_int16 = (final * 32767).astype(np.int16)', text: "float32(-1~1)를 16-bit 정수(-32767~32767)로 변환함. 표준 WAV 파일 형식임." },
        { at: 'wavfile.write(str(output_path), SAMPLE_RATE, final_int16)', text: "scipy의 wavfile.write()로 24000 Hz 16-bit PCM WAV 파일로 저장함." },
      ],
      code:
`def main() -> None:
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
        print(f"\\n[Error] No supported audio files found in {VOICES_DIR}")
        print("  Place reference audio files (6-30 seconds each) in the voices/ directory.")
        sys.exit(1)
    print(f"\\n[Voices] {len(voice_files)} reference voice(s) available (WAV):")
    for v in voice_files:
        print(f"  - {v.name}")

    # 4. 대화 파일 로드
    print(f"\\n[Load] Reading dialog from {input_path.name}...")
    df = load_dialog(input_path)
    print(f"[Load] {len(df)} lines, {df['speaker'].nunique()} speakers")

    speakers: List[str] = list(dict.fromkeys(df["speaker"].astype(str).tolist()))
    print(f"[Load] Speakers: {speakers}")

    # 5. 화자별 음성 매핑
    mapping = load_mapping()
    need_save = False
    force_manual_mapping = False

    if mapping is None:
        print("\\n[Mapping] No mapping file found. Select reference voices for each speaker.")
        mapping = {}
        need_save = True
    else:
        missing = [s for s in speakers if s not in mapping]
        stale   = [s for s in speakers if s in mapping and not (VOICES_DIR / mapping[s]).exists()]
        if missing or stale:
            if missing:
                print(f"\\n[Mapping] New speakers detected: {missing}. Select reference voices.")
            if stale:
                print(f"\\n[Mapping] Reference voice file(s) missing for: {stale}. Re-select voices.")
                for s in stale:
                    del mapping[s]
            need_save = True
        else:
            print("\\n[Mapping] Current speaker \\u2192 voice mapping:")
            for spk in speakers:
                print(f"  {spk} \\u2192 {mapping[spk]}")
            try:
                answer = input("\\nChange mapping? (y/N): ").strip().lower()
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
                print(f"[Mapping] Default applied: {spk} \\u2192 {default}")
                mapping[spk] = default
            else:
                mapping[spk] = select_voice_for_speaker(spk, voice_files)

    if need_save:
        save_mapping(mapping)

    print("\\n[Mapping] Speaker \\u2192 Reference Voice")
    for spk in speakers:
        print(f"  {spk} \\u2192 {mapping.get(spk, '(not mapped)')}")

    # 6. 매핑된 음성 파일 존재 여부 검증
    for spk in speakers:
        ref = VOICES_DIR / mapping[spk]
        if not ref.exists():
            print(f"\\n[Error] Reference voice not found: {ref}")
            print("  Update voices/mapping.json or re-run to remap.")
            sys.exit(1)

    # 7. XTTS v2 모델 로드
    import torch
    from TTS.api import TTS

    print(f"\\n[Model] Loading {MODEL_NAME}...")
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
                print(f"[Mapping] Updating {spk}: {fname} \\u2192 {wav_name}")
                mapping[spk] = wav_name
                mapping_updated = True
    if mapping_updated:
        save_mapping(mapping)

    # 9. 음성 복제로 한국어 음성 세그먼트 생성
    print("\\n[Audio] Generating Korean speech with voice cloning...")
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
        print("\\n[Error] No audio segments generated.")
        sys.exit(1)

    # 10. 세그먼트 연결, 정규화, 24000Hz 16-bit PCM WAV로 저장
    print("\\n[Audio] Concatenating segments...")
    final = np.concatenate(segments)

    max_val = np.max(np.abs(final))
    if max_val > 0:
        final = final / max_val * 0.95

    final_int16 = (final * 32767).astype(np.int16)
    # 오디오 데이터를 16-bit PCM WAV 파일로 저장함
    wavfile.write(str(output_path), SAMPLE_RATE, final_int16)

    duration = len(final) / SAMPLE_RATE
    print(f"\\n[Done] Output : {output_path}")
    print(f"[Done] Duration: {duration:.2f}s | Sample rate: {SAMPLE_RATE} Hz")
    print("\\n" + "=" * 60)
    print("Voice Cloning Complete!")
    print("=" * 60)


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    main()`,
    },
  ],

  glossary: {
    "os.environ": "프로그램이 실행되는 환경의 변수 모음. os.environ['키'] = '값'으로 환경변수를 설정하면 그 프로그램 안에서 어디서든 읽을 수 있음.",
    "monkey-patch": "라이브러리 내부 함수를 바깥에서 다른 함수로 교체하는 기법. 라이브러리 코드를 직접 수정하지 않고 동작을 바꿀 때 씀. 원숭이가 몰래 교체한다는 비유에서 유래함.",
    "weights_only": "PyTorch의 torch.load() 옵션. True면 모델 가중치(숫자 데이터)만 로드하고 임의 파이썬 코드 실행을 막는 보안 기능임. XTTS v2 모델은 설정 데이터도 pickle로 저장해 True이면 로딩이 실패함.",
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .parent를 붙이면 이 파일이 든 폴더 경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"나\": \"man.wav\"}처럼 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    "타입 힌트": "변수·함수에 자료의 종류(str, Path, List 등)를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "ImportError": "라이브러리나 모듈을 가져올(import) 수 없을 때 나는 오류. 보통 설치가 안 됐을 때 발생함.",
    "sys.exit": "프로그램을 즉시 종료하는 함수. sys.exit(0)은 정상 종료, sys.exit(1)은 오류로 인한 종료를 관례적으로 의미함.",
    "glob": "Path.glob(패턴)은 '*.wav'처럼 패턴을 주면 일치하는 파일 목록을 돌려주는 기능. 여러 확장자 파일을 한꺼번에 찾을 때 유용함.",
    "set(집합)": "{ }로 묶인 '중복 없는 값들의 모음'. 같은 파일이 여러 번 목록에 들어와도 set()으로 한 번만 남길 수 있음.",
    "sorted()": "목록을 정렬해 새 목록으로 돌려주는 함수. 여기서는 파일을 이름순으로 정렬함.",
    "subprocess": "파이썬 안에서 외부 프로그램(예: ffmpeg)을 실행하는 표준 모듈. subprocess.run()으로 명령어를 실행하고 결과를 받아볼 수 있음.",
    "ffmpeg": "오디오·동영상 파일을 다른 형식으로 변환하는 강력한 오픈소스 도구. mp3·m4a 등을 WAV로 바꿀 때 사용함.",
    "JSON": "데이터를 주고받는 표준 글자 형식. {\"key\": \"value\"} 모양으로, 파이썬 딕셔너리와 거의 똑같이 생김. mapping.json에 화자→음성 매핑을 저장함.",
    "with open(rb)": "with 블록으로 파일을 열면, 블록을 벗어날 때 파일이 자동으로 닫힘. 'utf-8'은 한글이 깨지지 않도록 인코딩을 지정하는 것임.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
    "enumerate()": "목록을 돌면서 '번호와 값'을 함께 꺼내주는 함수. start=1을 주면 1번부터 셈.",
    "input()": "콘솔(터미널)에서 사용자가 키보드로 입력한 한 줄을 글자로 받아오는 함수.",
    "while 반복": "조건이 참인 동안 계속 도는 반복문. 여기서는 올바른 번호를 입력할 때까지 다시 묻는 데 씀.",
    "pandas(DataFrame)": "파이썬의 대표적인 데이터 분석 라이브러리. DataFrame은 행과 열로 이루어진 표 자료구조로, CSV를 읽어 다루기 쉽게 해줌.",
    "dropna": "pandas의 기능. 지정한 컬럼에 값이 없는(null/NaN) 행을 제거함. 빈 대사 줄을 정리할 때 씀.",
    "sys.exit": "프로그램을 즉시 종료하는 함수. sys.exit(0)은 정상 종료, sys.exit(1)은 오류로 인한 종료를 관례적으로 의미함.",
    "numpy(ndarray)": "파이썬의 수치 계산 라이브러리. ndarray는 숫자 배열로, 오디오 데이터를 숫자 배열로 다루고 이어 붙이고 변환하는 데 씀.",
    "float32": "소수점 숫자를 32비트로 표현하는 자료형. 오디오 진폭 데이터를 -1.0~1.0 사이 값으로 다룰 때 사용함.",
    "sample_rate": "1초 동안의 오디오 샘플(측정값) 수. XTTS v2는 24000 Hz(1초에 24000개 샘플)를 사용함. 값이 높을수록 음질이 좋아짐.",
    "scipy.wavfile": "scipy 라이브러리의 WAV 파일 읽기·쓰기 모듈. wavfile.write()로 numpy 배열을 WAV 파일로 저장할 수 있음.",
    "tqdm": "반복 작업의 진행률을 프로그레스 바(████████ 60%)로 화면에 표시해주는 라이브러리. 시간이 걸리는 작업에서 얼마나 남았는지 보여줌.",
    "XTTS v2": "Coqui AI가 만든 다국어 음성 합성(TTS) 모델. 짧은 참조 음성만으로 그 목소리를 복제해 한국어 등 16개 언어로 말할 수 있음. CPML 라이선스(비상업 연구 목적만 허용)를 적용함.",
    "음성 복제(Voice Cloning)": "짧은 참조 음성(6~30초)으로 화자의 목소리 특성을 추출하고, 다른 텍스트를 그 목소리로 말하게 하는 기술. 쌍둥이를 만드는 것과 비유할 수 있음.",
    "torch.cuda": "PyTorch에서 GPU(NVIDIA CUDA)를 제어하는 모듈. torch.cuda.is_available()로 GPU 사용 가능 여부를 확인함.",
    "PCM": "Pulse-Code Modulation의 약자. 오디오 신호를 숫자(정수) 배열로 표현하는 가장 기본적인 방식. WAV 파일의 표준 형식임.",
    "정규화(normalize)": "데이터의 값 범위를 일정 범위(예: -1~1)로 맞추는 작업. 오디오에서는 가장 큰 소리를 기준으로 전체 음량을 조정해 소리가 너무 크거나 작지 않게 함.",
    "dict.fromkeys": "리스트의 항목들을 열쇠로 하는 딕셔너리를 만드는 함수. 중복을 제거하면서 순서를 유지하는 데 씀(set은 순서가 없음).",
    "if __name__": "if __name__ == \"__main__\": 는 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함. 다른 파일이 import할 때는 실행되지 않음.",
  },
};
