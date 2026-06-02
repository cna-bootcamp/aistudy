/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../05.stt/whisperx/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "WhisperX STT + 화자 분리 예제 설명",
    entry: "whisperx-diarization.py",
  },

  files: [
    { id: "main", label: "whisperx-diarization.py", role: "단일 파일 CLI 예제 · WhisperX 전사 + 화자 분리 워크플로우 전체" },
  ],

  flow: [
    {
      step: 1, title: "실행 시작",
      summary: "터미널에서 python whisperx-diarization.py 실행 → main()이 진입점으로 호출됨",
      detail: "이 예제는 웹이 아니라 명령줄(터미널) 프로그램임. 맨 아래 if __name__ == \"__main__\": 가 main()을 호출함. main()이 전체 작업 흐름을 순서대로 지휘함."
    },
    {
      step: 2, title: "명령줄 옵션 읽기",
      summary: "parse_args()로 --input·--model·--language 등 옵션을 읽음",
      detail: "식당 주문서를 받는 단계와 비슷함. argparse가 'python whisperx-diarization.py --input a.mp3' 같은 입력을 해석해 어떤 파일을 처리하고 어떤 모델을 쓸지 정함. 옵션을 생략하면 기본값(large-v3-turbo, ko 등)을 씀."
    },
    {
      step: 3, title: "HF 토큰 확인",
      summary: "load_hf_token()이 .env에서 HuggingFace 토큰을 읽어 화자 분리 모델 접근권을 확인함",
      detail: "pyannote 화자 분리 모델은 HuggingFace 계정과 사용 약관 동의가 필요함. 토큰이 없으면 상세한 안내 메시지를 출력하고 프로그램을 바로 종료함."
    },
    {
      step: 4, title: "오디오 파일 확정",
      summary: "resolve_audio()가 --input 인수나 audio 폴더 첫 번째 파일로 오디오 경로를 확정함",
      detail: "--input 으로 파일을 직접 줬으면 그 파일이 실제로 있는지 확인해 사용함. 없으면 audio 폴더에서 파일을 자동으로 찾아 첫 번째 파일을 사용함."
    },
    {
      step: 5, title: "디바이스·정밀도 설정",
      summary: "detect_device()로 CUDA/CPU를 감지하고, CPU면 compute_type을 int8로 자동 변경함",
      detail: "GPU(CUDA)가 있으면 float16으로 빠르게 처리하고, CPU만 있으면 int8로 자동 변환해 속도를 보완함. 사용자가 --device를 직접 지정하면 감지 없이 그 값을 씀."
    },
    {
      step: 6, title: "[1/4] 전사",
      summary: "whisperx.load_model()로 Whisper 모델을 불러와 음성을 텍스트 세그먼트로 변환함",
      detail: "주방에 요리사(Whisper 모델)를 고용하는 단계임. 큰 모델(large-v3-turbo)일수록 정확하지만 느림. transcribe()는 오디오를 세그먼트(문장 조각) 단위로 받아쓰기 함."
    },
    {
      step: 7, title: "[2/4] 단어 정렬",
      summary: "whisperx.load_align_model()·align()으로 각 단어의 정확한 시작·끝 시각을 부착함",
      detail: "기본 Whisper는 세그먼트 단위 시각만 줌. 정렬 단계에서 단어 하나하나에 타임스탬프를 붙여, 나중에 화자를 단어 수준으로 정확히 배정할 수 있게 함."
    },
    {
      step: 8, title: "[3/4] 화자 분리",
      summary: "DiarizationPipeline으로 '언제 누가 말했는지'를 구간별로 분리한 뒤 각 단어에 화자를 배정함",
      detail: "이 단계가 이 예제의 핵심임. pyannote 모델이 오디오를 분석해 화자(SPEAKER_00·SPEAKER_01…)가 말한 구간을 찾고, assign_word_speakers()가 단어별로 화자 태그를 붙여 줌."
    },
    {
      step: 9, title: "[4/4] 결과 저장",
      summary: "save_outputs()가 result.json·result_dialog.txt·result_chunks.csv·result.rttm 네 파일을 저장함",
      detail: "완성된 결과를 네 가지 형식으로 저장함. JSON은 원본 데이터, dialog.txt는 사람이 읽기 좋은 대화록, CSV는 분석용 표, RTTM은 화자 분리 표준 형식임."
    },
    {
      step: 10, title: "종료",
      summary: "완료 메시지를 출력하고 종료 코드(0=성공)를 반환함",
      detail: "오류가 없으면 main()이 0을 반환해 성공을 알림. ImportError(패키지 미설치)나 KeyboardInterrupt(Ctrl+C) 등 오류 유형별로 다른 종료 코드(1·130)를 반환함."
    },
  ],

  functions: [
    // ===== 모듈 설정 (경로·상수) =====
    {
      id: "module_setup",
      name: "모듈 설정 (경로·상수·안내문)",
      fileId: "main",
      summary: "파일 맨 위에서 한글 출력 깨짐 방지, 폴더 경로, HF 토큰 안내 문구 등 기본 설정을 준비함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 준비하는 값들'임. 이 파일 위치를 기준으로 audio 폴더·.env 경로를 자동으로 계산하고, HF_TOKEN이 없을 때 보여줄 상세 안내 문구를 상수로 정의함.",
      terms: ["Path(__file__)", "sys.stdout.reconfigure", "from __future__ import annotations"],
      lines: [
        { at: 'from __future__ import annotations', text: "타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 함. 파일 맨 위에 한 번 적음." },
        { at: 'if hasattr(sys.stdout, "reconfigure"):', text: "윈도우 콘솔에서 한글 출력이 깨지지 않도록 출력 인코딩을 UTF-8로 바꿈. 기능이 없는 환경(hasattr)에서는 건너뜀." },
        { at: 'SCRIPT_DIR = Path(__file__).resolve().parent', text: "Path(__file__)은 '이 파일의 위치'. .resolve().parent로 이 파일이 든 폴더의 절대경로를 구함. 어디서 실행해도 경로가 어긋나지 않음." },
        { at: 'HF_TOKEN_GUIDE = """', text: "HuggingFace 토큰이 없을 때 출력할 상세 안내 문구를 미리 상수로 정의해 둠(삼중 따옴표 여러 줄 문자열)." },
      ],
      code:
`"""WhisperX STT + 화자 분리 예제.

WhisperX로 단어 수준 타임스탬프를 정밀하게 생성하고,
pyannote 화자 분리로 각 단어에 화자를 배정함.
HF_TOKEN은 hands-on/05.stt/.env에 설정해야 함 (pyannote 모델 접근 필요).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv


# Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
SCRIPT_DIR = Path(__file__).resolve().parent
STT_DIR = SCRIPT_DIR.parent
AUDIO_DIR = STT_DIR / "audio"
ENV_PATH = STT_DIR / ".env"

HF_TOKEN_GUIDE = """
[ERROR] HuggingFace Access Token(HF_TOKEN)이 설정되지 않았습니다.

아래 절차를 따라 토큰을 발급하고 등록하세요.

1. HuggingFace Access Token 발급
   https://huggingface.co/settings/tokens

2. 아래 두 모델의 사용 약관에 동의 (HuggingFace 로그인 필요)
   - https://huggingface.co/pyannote/speaker-diarization-3.1
   - https://huggingface.co/pyannote/segmentation-3.0

3. hands-on/05.stt/.env 파일에 HF_TOKEN 등록
   HF_TOKEN=hf_xxxxxxxxxx
"""`
    },

    // ===== load_hf_token =====
    {
      id: "load_hf_token",
      name: "load_hf_token()",
      fileId: "main",
      summary: ".env에서 HF_TOKEN을 읽어 반환하고, 없으면 안내 메시지 출력 후 종료함.",
      how: "HuggingFace 토큰은 코드에 직접 쓰지 않고 .env 파일에 보관함. load_dotenv가 그 파일을 읽어 환경변수로 올려주면 os.getenv로 꺼냄. 토큰이 없으면 상세 안내(HF_TOKEN_GUIDE)를 출력하고 sys.exit(1)로 즉시 종료함.",
      terms: ["load_dotenv", "환경변수(.env)", "sys.exit()", "os.getenv"],
      lines: [
        { at: 'for env_path in [ENV_PATH, STT_DIR.parent / ".env"]:', text: "두 위치(.stt/.env, .env)를 순서대로 시도해 하나라도 있으면 읽음(안전한 탐색)." },
        { at: 'load_dotenv(env_path)', text: ".env 파일을 읽어 그 안의 HF_TOKEN 등을 환경변수로 올림." },
        { at: 'token = os.getenv("HF_TOKEN")', text: "환경변수에서 HF_TOKEN 값을 꺼냄. 없으면 None을 받음." },
        { at: 'print(HF_TOKEN_GUIDE, file=sys.stderr)', text: "토큰이 없으면 미리 만들어 둔 안내 문구를 오류 통로(stderr)로 출력함." },
        { at: 'sys.exit(1)', text: "sys.exit(1)은 '실패로 프로그램을 끝낸다'는 뜻. 1은 오류 종료, 0은 정상 종료." },
      ],
      code:
`def load_hf_token() -> str:
    """.env에서 HF_TOKEN을 읽어 반환하고, 없으면 안내 메시지 출력 후 종료함."""
    for env_path in [ENV_PATH, STT_DIR.parent / ".env"]:
        if env_path.exists():
            # .env 파일에서 API 키 등 환경변수를 로드함
            load_dotenv(env_path)

    token = os.getenv("HF_TOKEN")
    if not token:
        print(HF_TOKEN_GUIDE, file=sys.stderr)
        sys.exit(1)
    return token`
    },

    // ===== find_audio_files =====
    {
      id: "find_audio_files",
      name: "find_audio_files(audio_dir)",
      fileId: "main",
      summary: "audio 디렉터리에서 지원 형식의 오디오 파일 목록을 이름순으로 반환함.",
      how: "폴더가 없으면 빈 목록을 돌려줌(안전). 폴더 안 항목을 하나씩 보며, 파일이면서 확장자가 지원 형식({.mp3, .wav, .flac …})인 것만 모아 sorted로 이름순 정렬함.",
      terms: ["Path(__file__)", "suffix(확장자)", "set(집합)", "sorted()", "제너레이터 표현식"],
      lines: [
        { at: 'supported = {".mp3", ".wav"', text: "지원하는 오디오 확장자를 집합(set)으로 정의함. 'x in 집합'으로 포함 여부를 빠르게 확인할 수 있음." },
        { at: 'if not audio_dir.exists():', text: "폴더가 아예 없으면 빈 목록 []을 돌려줌(오류 대신 안전 처리)." },
        { at: 'p for p in audio_dir.iterdir()', text: "iterdir()로 폴더 안의 항목을 하나씩 훑으며, 파일이고 확장자가 지원 형식인 것만 골라 sorted로 이름순 정렬함." },
      ],
      code:
`def find_audio_files(audio_dir: Path) -> list[Path]:
    """audio 디렉터리에서 지원 형식의 오디오 파일 목록을 이름순으로 반환함."""
    supported = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".mp4", ".webm"}
    if not audio_dir.exists():
        return []
    return sorted(
        p for p in audio_dir.iterdir()
        if p.is_file() and p.suffix.lower() in supported
    )`
    },

    // ===== resolve_audio =====
    {
      id: "resolve_audio",
      name: "resolve_audio(input_arg)",
      fileId: "main",
      summary: "CLI 인수나 audio 디렉터리 첫 번째 파일로 오디오 경로를 확정함.",
      how: "--input 으로 경로를 줬으면 그 파일이 실제로 있는지 확인하고 사용함. 인수가 없으면 audio 폴더에서 파일을 찾아 첫 번째를 자동 선택함. 둘 다 없으면 FileNotFoundError로 원인을 알려줌.",
      terms: ["FileNotFoundError", "타입 힌트"],
      lines: [
        { at: 'if input_arg is not None:', text: "--input 으로 파일을 직접 줬으면(None이 아니면) 그 경로를 사용함." },
        { at: 'path = input_arg.expanduser().resolve()', text: "~ 같은 단축 경로를 펴고(expanduser) 절대경로로 바꿈(resolve)." },
        { at: 'raise FileNotFoundError(f"오디오 파일을 찾을 수 없습니다', text: "파일이 없으면 FileNotFoundError로 원인을 분명히 알려줌." },
        { at: 'files = find_audio_files(AUDIO_DIR)', text: "인수가 없으면 audio 폴더에서 파일 목록을 찾음." },
        { at: 'raise FileNotFoundError(f"오디오 파일이 없습니다', text: "audio 폴더에도 파일이 없으면 다시 FileNotFoundError로 알려줌." },
      ],
      code:
`def resolve_audio(input_arg: Path | None) -> Path:
    """CLI 인수나 audio 디렉터리 첫 번째 파일로 오디오 경로를 확정함."""
    if input_arg is not None:
        path = input_arg.expanduser().resolve()
        if not path.exists():
            raise FileNotFoundError(f"오디오 파일을 찾을 수 없습니다: {path}")
        return path

    files = find_audio_files(AUDIO_DIR)
    if not files:
        raise FileNotFoundError(f"오디오 파일이 없습니다: {AUDIO_DIR}")
    return files[0].resolve()`
    },

    // ===== detect_device =====
    {
      id: "detect_device",
      name: "detect_device()",
      fileId: "main",
      summary: "CUDA 가용 여부를 자동 감지하여 디바이스 문자열을 반환함.",
      how: "GPU(CUDA)가 있으면 'cuda'를 돌려줘 빠른 처리를 하고, 없으면 'cpu'를 돌려줌. torch가 설치되지 않은 환경도 try/except로 안전하게 처리해 항상 'cpu'를 돌려줌.",
      terms: ["예외 처리(try/except)", "CUDA", "torch"],
      lines: [
        { at: 'import torch', text: "torch 임포트를 시도함. 설치되지 않았으면 ImportError가 나서 except 블록으로 감." },
        { at: 'return "cuda" if torch.cuda.is_available() else "cpu"', text: "torch.cuda.is_available()이 True면 GPU 사용 가능 → 'cuda', 아니면 'cpu'를 반환함." },
        { at: 'except ImportError:', text: "torch가 없으면 ImportError가 나므로, 안전하게 'cpu'를 반환함." },
      ],
      code:
`def detect_device() -> str:
    """CUDA 가용 여부를 자동 감지하여 디바이스 문자열을 반환함."""
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"`
    },

    // ===== to_serializable =====
    {
      id: "to_serializable",
      name: "to_serializable(obj)",
      fileId: "main",
      summary: "numpy/torch 타입을 JSON 직렬화 가능한 Python 기본 타입으로 재귀 변환함.",
      how: "WhisperX 결과에는 numpy 정수·실수·배열이 섞여 있어 json.dumps()로 바로 저장하면 오류가 남. 이 함수가 그런 타입들을 파이썬의 int·float·list로 바꿔줌. 딕셔너리·리스트는 안쪽까지 재귀적으로 변환함.",
      terms: ["재귀(recursion)", "JSON", "numpy", "isinstance()", "예외 처리(try/except)"],
      lines: [
        { at: 'import numpy as np', text: "numpy 임포트를 시도함. 설치되지 않았으면 pass로 건너뜀(안전)." },
        { at: 'if isinstance(obj, np.integer):', text: "numpy 정수 타입이면 파이썬 int로 변환함. JSON은 numpy 타입을 모르기 때문." },
        { at: 'if isinstance(obj, np.ndarray):', text: "numpy 배열이면 .tolist()로 파이썬 리스트로 변환함." },
        { at: 'if isinstance(obj, dict):', text: "딕셔너리면 안의 값들도 각각 재귀 변환함(자기 자신을 다시 호출)." },
        { at: 'if isinstance(obj, list):', text: "리스트면 안의 항목들도 각각 재귀 변환함." },
      ],
      code:
`def to_serializable(obj: object) -> object:
    """numpy/torch 타입을 JSON 직렬화 가능한 Python 기본 타입으로 재귀 변환함."""
    try:
        import numpy as np
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
    except ImportError:
        pass
    if isinstance(obj, dict):
        return {k: to_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_serializable(v) for v in obj]
    return obj`
    },

    // ===== build_dialog_lines =====
    {
      id: "build_dialog_lines",
      name: "build_dialog_lines(result)",
      fileId: "main",
      summary: "동일 화자의 연속 단어를 하나의 발화 줄로 묶어 대화록 행 목록을 반환함.",
      how: "WhisperX 결과에는 세그먼트 안에 단어들이 있고, 각 단어에 화자 태그가 붙어 있음. 이 함수는 단어를 순서대로 훑으며 '같은 화자가 연속으로 말한 단어들'을 하나의 줄로 합쳐 '[MM:SS] SPEAKER_00: 안녕하세요' 형태의 대화록을 만듦.",
      terms: ["딕셔너리(dict)", ".get()", "divmod()", "f-string", "리스트(list)"],
      lines: [
        { at: 'current_speaker: str | None = None', text: "현재 누가 말하고 있는지 추적하는 변수. 처음엔 아무도 말 안 함(None)." },
        { at: 'for segment in result.get("segments", []):', text: "전사 결과의 각 세그먼트(문장 조각)를 순서대로 꺼냄. 없으면 빈 목록으로 안전 처리." },
        { at: '# 단어 정보가 없으면 세그먼트 전체를 단일 단어 항목으로 처리함', text: "단어 정보가 없는 세그먼트는 통째로 하나의 단어처럼 취급해 누락 없이 처리함." },
        { at: 'if speaker != current_speaker:', text: "화자가 바뀌면: 이전 화자의 단어들을 한 줄로 합쳐 대화록에 추가하고, 새 화자로 전환함." },
        { at: "current_speaker = speaker", text: "화자가 바뀌면 이전 화자의 단어들을 '[MM:SS] 화자: 말' 형태로 대화록에 추가한 뒤, 현재 화자를 새 화자로 전환함." },
      ],
      code:
`def build_dialog_lines(result: dict) -> list[str]:
    """동일 화자의 연속 단어를 하나의 발화 줄로 묶어 대화록 행 목록을 반환함."""
    lines: list[str] = []
    current_speaker: str | None = None
    current_words: list[str] = []
    current_start: float = 0.0

    all_words: list[dict] = []
    for segment in result.get("segments", []):
        seg_speaker = segment.get("speaker", "UNKNOWN")
        words = segment.get("words", [])
        if not words:
            # 단어 정보가 없으면 세그먼트 전체를 단일 단어 항목으로 처리함
            all_words.append({
                "word": segment.get("text", "").strip(),
                "start": segment.get("start", 0.0),
                "speaker": seg_speaker,
            })
        else:
            for w in words:
                all_words.append({
                    "word": w.get("word", "").strip(),
                    "start": w.get("start", segment.get("start", 0.0)),
                    "speaker": w.get("speaker", seg_speaker),
                })

    for entry in all_words:
        speaker = entry.get("speaker", "UNKNOWN")
        word = entry.get("word", "")
        start = entry.get("start", 0.0)

        if speaker != current_speaker:
            if current_words and current_speaker is not None:
                mins, secs = divmod(int(current_start), 60)
                lines.append(f"[{mins:02d}:{secs:02d}] {current_speaker}: {' '.join(current_words)}")
            current_speaker = speaker
            current_words = [word] if word else []
            current_start = start
        else:
            if word:
                current_words.append(word)

    if current_words and current_speaker is not None:
        mins, secs = divmod(int(current_start), 60)
        lines.append(f"[{mins:02d}:{secs:02d}] {current_speaker}: {' '.join(current_words)}")

    return lines`
    },

    // ===== build_chunks_df =====
    {
      id: "build_chunks_df",
      name: "build_chunks_df(result)",
      fileId: "main",
      summary: "화자 분리 결과에서 세그먼트 및 단어 수준 DataFrame을 생성하여 반환함.",
      how: "CSV로 저장할 표(DataFrame)를 만드는 함수임. 각 세그먼트와 그 안의 단어들을 행(row)으로 변환해 pandas DataFrame으로 묶음. type 열로 'segment'와 'word'를 구분해 어느 계층인지 알 수 있게 함.",
      terms: ["pandas DataFrame", "enumerate()", "round()", "딕셔너리(dict)", "리스트(list)"],
      lines: [
        { at: 'rows: list[dict] = []', text: "나중에 DataFrame으로 만들 행(row) 목록을 담을 빈 리스트." },
        { at: 'for seg_idx, segment in enumerate(result.get("segments", [])):', text: "enumerate로 세그먼트 번호(seg_idx)와 내용을 함께 꺼냄." },
        { at: '"type": "segment",', text: "이 행이 세그먼트 수준임을 type 열로 표시함. 아래쪽 단어 행은 type=word." },
        { at: 'for word_idx, word_info in enumerate(segment.get("words", [])):', text: "세그먼트 안의 단어들을 하나씩 꺼내 각각 행으로 추가함." },
        { at: 'return pd.DataFrame(rows)', text: "모은 행 목록을 pandas DataFrame으로 변환해 돌려줌. CSV 저장에 바로 쓸 수 있음." },
      ],
      code:
`def build_chunks_df(result: dict) -> pd.DataFrame:
    """화자 분리 결과에서 세그먼트 및 단어 수준 DataFrame을 생성하여 반환함."""
    rows: list[dict] = []
    for seg_idx, segment in enumerate(result.get("segments", [])):
        seg_speaker = segment.get("speaker", "UNKNOWN")
        seg_start = float(segment.get("start", 0.0))
        seg_end = float(segment.get("end", 0.0))

        rows.append({
            "type": "segment",
            "segment_id": seg_idx + 1,
            "word_id": "",
            "speaker": seg_speaker,
            "start": round(seg_start, 3),
            "end": round(seg_end, 3),
            "duration": round(seg_end - seg_start, 3),
            "text": segment.get("text", "").strip(),
        })

        for word_idx, word_info in enumerate(segment.get("words", [])):
            w_start = float(word_info.get("start", seg_start))
            w_end = float(word_info.get("end", seg_end))
            rows.append({
                "type": "word",
                "segment_id": seg_idx + 1,
                "word_id": word_idx + 1,
                "speaker": word_info.get("speaker", seg_speaker),
                "start": round(w_start, 3),
                "end": round(w_end, 3),
                "duration": round(w_end - w_start, 3),
                "text": word_info.get("word", "").strip(),
            })

    return pd.DataFrame(rows)`
    },

    // ===== build_rttm_lines =====
    {
      id: "build_rttm_lines",
      name: "build_rttm_lines(result, file_id)",
      fileId: "main",
      summary: "화자 분리 세그먼트에서 RTTM 형식 행 목록을 생성하여 반환함.",
      how: "RTTM(Rich Transcription Time Marked)은 화자 분리 결과를 저장하는 표준 파일 형식임. 각 세그먼트를 'SPEAKER 파일명 1 시작초 길이초 <NA> <NA> 화자명 <NA> <NA>' 한 줄로 변환함. 길이가 0 이하인 세그먼트는 건너뜀.",
      terms: ["f-string", "RTTM", "리스트(list)"],
      lines: [
        { at: 'for segment in result.get("segments", []):', text: "전사 결과의 각 세그먼트를 순서대로 꺼냄." },
        { at: 'duration = end - start', text: "세그먼트 길이(초) = 끝 시각 - 시작 시각." },
        { at: 'if duration <= 0:', text: "길이가 0 이하인 이상한 세그먼트는 건너뜀(RTTM에 유효하지 않은 데이터 방지)." },
        { at: 'f"SPEAKER {file_id} 1 {start:.3f} {duration:.3f}', text: "RTTM 형식의 한 줄을 f-string으로 만듦. {start:.3f}는 소수점 셋째 자리까지 표시." },
      ],
      code:
`def build_rttm_lines(result: dict, file_id: str) -> list[str]:
    """화자 분리 세그먼트에서 RTTM 형식 행 목록을 생성하여 반환함."""
    lines: list[str] = []
    for segment in result.get("segments", []):
        speaker = segment.get("speaker", "UNKNOWN")
        start = float(segment.get("start", 0.0))
        end = float(segment.get("end", 0.0))
        duration = end - start
        if duration <= 0:
            continue
        lines.append(
            f"SPEAKER {file_id} 1 {start:.3f} {duration:.3f} <NA> <NA> {speaker} <NA> <NA>"
        )
    return lines`
    },

    // ===== save_outputs =====
    {
      id: "save_outputs",
      name: "save_outputs(output_dir, audio_path, result)",
      fileId: "main",
      summary: "result.json, result_dialog.txt, result_chunks.csv, result.rttm을 저장함.",
      how: "네 가지 형식으로 결과를 저장하는 '저장 담당' 함수임. JSON은 원본 전체 데이터, dialog.txt는 사람이 읽기 좋은 대화록, CSV는 단어·세그먼트 분석표(| 구분자), RTTM은 화자 분리 표준 형식임.",
      terms: ["mkdir", "json.dumps", "pandas DataFrame", "write_text", "f-string"],
      lines: [
        { at: 'output_dir.mkdir(parents=True, exist_ok=True)', text: "저장 폴더가 없으면 만들어 둠(parents=True: 중간 폴더까지, exist_ok=True: 이미 있어도 오류 없음)." },
        { at: 'file_id = audio_path.stem', text: "audio_path.stem은 파일명에서 확장자를 뺀 부분. 예: 'interview.mp3' → 'interview'. RTTM 파일명으로 쓰임." },
        { at: 'json.dumps(to_serializable(result), ensure_ascii=False, indent=2)', text: "ensure_ascii=False는 한글을 유니코드 이스케이프 없이 그대로 저장함. indent=2는 들여쓰기로 보기 좋게 만듦." },
        { at: 'df.to_csv(csv_path, index=False, sep="|"', text: "index=False는 행 번호를 열로 포함하지 않음. sep='|'는 콤마 대신 | 를 구분자로 씀(텍스트 안의 콤마 충돌 방지)." },
      ],
      code:
`def save_outputs(output_dir: Path, audio_path: Path, result: dict) -> None:
    """result.json, result_dialog.txt, result_chunks.csv, result.rttm을 저장함."""
    output_dir.mkdir(parents=True, exist_ok=True)
    file_id = audio_path.stem

    json_path = output_dir / "result.json"
    json_path.write_text(
        json.dumps(to_serializable(result), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"  result.json       -> {json_path}")

    dialog_lines = build_dialog_lines(result)
    dialog_path = output_dir / "result_dialog.txt"
    dialog_path.write_text("\\n".join(dialog_lines), encoding="utf-8")
    print(f"  result_dialog.txt -> {dialog_path}")

    df = build_chunks_df(result)
    csv_path = output_dir / "result_chunks.csv"
    df.to_csv(csv_path, index=False, sep="|", encoding="utf-8-sig")
    print(f"  result_chunks.csv -> {csv_path}")

    rttm_lines = build_rttm_lines(result, file_id)
    rttm_path = output_dir / "result.rttm"
    rttm_path.write_text("\\n".join(rttm_lines), encoding="utf-8")
    print(f"  result.rttm       -> {rttm_path}")`
    },

    // ===== parse_args =====
    {
      id: "parse_args",
      name: "parse_args()",
      fileId: "main",
      summary: "커맨드라인 인수를 파싱함.",
      how: "argparse는 'python whisperx-diarization.py --model large-v3-turbo --language ko' 같은 명령줄 입력을 처리하는 표준 도구임. 각 옵션의 타입·기본값·도움말을 정의하고, parse_args()로 실제 입력을 해석해 돌려줌.",
      terms: ["argparse", "타입 힌트"],
      lines: [
        { at: 'parser = argparse.ArgumentParser(', text: "argparse 파서를 만듦. 명령줄 옵션을 정의·해석하는 파이썬 표준 도구임." },
        { at: '"--input"', text: "--input 옵션: 처리할 오디오 파일 경로(생략 가능, 없으면 audio 폴더 첫 파일 사용)." },
        { at: '"--num-speakers"', text: "--num-speakers: 화자 수를 미리 알면 지정해 분리 정확도를 높일 수 있음. 생략하면 자동 감지." },
        { at: '"--compute-type"', text: "--compute-type: 연산 정밀도 선택. float16(빠름·GPU), int8(빠름·CPU 호환), float32(느리고 정확)." },
        { at: 'return parser.parse_args()', text: "실제 명령줄을 해석해, 옵션 값들을 담은 객체를 돌려줌." },
      ],
      code:
`def parse_args() -> argparse.Namespace:
    """커맨드라인 인수를 파싱함."""
    parser = argparse.ArgumentParser(
        description="WhisperX STT + 화자 분리(Speaker Diarization) 예제"
    )
    parser.add_argument(
        "--input", type=Path, default=None,
        help="입력 오디오 파일 경로. 생략 시 hands-on/05.stt/audio/ 첫 번째 파일 자동 선택",
    )
    parser.add_argument(
        "--output-dir", type=Path, default=SCRIPT_DIR,
        help=f"결과 저장 디렉터리 (기본값: {SCRIPT_DIR})",
    )
    parser.add_argument(
        "--num-speakers", type=int, default=None,
        help="화자 수. 지정 시 해당 화자 수로 고정 분할 처리",
    )
    parser.add_argument(
        "--language", type=str, default="ko",
        help="음성 언어 코드 (기본값: ko)",
    )
    parser.add_argument(
        "--model", type=str, default="large-v3-turbo",
        help="Whisper 모델 크기 (기본값: large-v3-turbo)",
    )
    parser.add_argument(
        "--batch-size", type=int, default=16,
        help="배치 크기 (기본값: 16, GPU 메모리 부족 시 줄임)",
    )
    parser.add_argument(
        "--compute-type", type=str, default="float16",
        choices=["float16", "int8", "float32"],
        help="연산 정밀도 (기본값: float16, CPU 사용 시 int8 자동 적용)",
    )
    parser.add_argument(
        "--device", type=str, default=None,
        help="디바이스 (cuda/cpu). 생략 시 CUDA 가용 여부 자동 감지",
    )
    return parser.parse_args()`
    },

    // ===== main =====
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "WhisperX + 화자 분리 워크플로우를 실행함. 전체 흐름(전사→정렬→화자분리→저장)을 지휘함.",
      how: "프로그램의 '지휘자'임. ①옵션 읽기 → ②HF 토큰 확인 → ③오디오 확정 → ④디바이스 설정 → ⑤Whisper 전사 → ⑥단어 정렬 → ⑦화자 분리 → ⑧결과 저장 순으로 실행함. ImportError(패키지 미설치)·KeyboardInterrupt(중단)·일반 오류를 각각 다른 종료 코드로 처리함.",
      terms: ["예외 처리(try/except)", "ImportError", "KeyboardInterrupt", "if __name__", "DiarizationPipeline", "WhisperX"],
      lines: [
        { at: 'hf_token = load_hf_token()', text: "가장 먼저 HuggingFace 토큰을 확인함. 없으면 여기서 종료됨(이후 단계 불필요)." },
        { at: 'device = args.device or detect_device()', text: "사용자가 --device를 지정했으면 그 값을, 없으면 자동 감지한 값을 씀('or' 활용)." },
        { at: 'if device == "cpu" and compute_type == "float16":', text: "CPU에서 float16은 지원 안 됨. 자동으로 int8로 바꿔줌." },
        { at: 'model = whisperx.load_model(', text: "[1/4] Whisper 모델을 메모리에 불러옴. 처음 실행하면 모델 파일을 다운로드하므로 시간이 걸림." },
        { at: 'diarize_pipeline = DiarizationPipeline(use_auth_token=hf_token', text: "[3/4] HF 토큰으로 pyannote 화자 분리 파이프라인을 초기화함. 토큰으로 사용 권한을 확인함." },
        { at: 'result = whisperx.assign_word_speakers(diarize_segments, result)', text: "화자 분리 결과(diarize_segments)를 전사 단어들에 매칭해 각 단어에 화자를 배정함." },
        { at: 'except ImportError as e:', text: "whisperx·pyannote 등 필수 패키지가 없으면 설치 안내와 함께 종료 코드 1을 반환함." },
        { at: 'except KeyboardInterrupt:', text: "Ctrl+C로 중단하면 '사용자 요청 중단' 메시지 후 종료 코드 130(유닉스 관례)을 반환함." },
      ],
      code:
`def main() -> int:
    """WhisperX + 화자 분리 워크플로우를 실행함."""
    args = parse_args()

    hf_token = load_hf_token()

    try:
        audio_path = resolve_audio(args.input)
    except FileNotFoundError as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 1

    device = args.device or detect_device()
    compute_type = args.compute_type
    if device == "cpu" and compute_type == "float16":
        compute_type = "int8"
        print("[INFO] CPU 모드 감지: compute_type을 int8로 자동 변경")

    output_dir = args.output_dir.expanduser().resolve()

    print("=" * 70)
    print("WhisperX STT + 화자 분리")
    print("=" * 70)
    print(f"  모델         : {args.model}")
    print(f"  오디오       : {audio_path}")
    print(f"  언어         : {args.language}")
    print(f"  디바이스     : {device}")
    print(f"  compute_type : {compute_type}")
    print(f"  batch_size   : {args.batch_size}")
    print(f"  화자 수      : {args.num_speakers if args.num_speakers else '자동 감지'}")
    print(f"  출력 디렉터리: {output_dir}")
    print()

    try:
        import whisperx
        # DiarizationPipeline: whisperx 내장 화자 분리 파이프라인 클래스
        from whisperx.diarize import DiarizationPipeline

        print("[1/4] Whisper 모델 로딩 및 전사 중...")
        model = whisperx.load_model(
            args.model,
            device,
            compute_type=compute_type,
            language=args.language,
        )
        audio = whisperx.load_audio(str(audio_path))
        result = model.transcribe(audio, batch_size=args.batch_size, language=args.language)
        print(f"      전사 완료: {len(result.get('segments', []))} segments")

        print("[2/4] 단어 수준 타임스탬프 정렬 중...")
        model_a, metadata = whisperx.load_align_model(
            language_code=result["language"],
            device=device,
        )
        result = whisperx.align(
            result["segments"],
            model_a,
            metadata,
            audio,
            device,
            return_char_alignments=False,
        )
        print("      정렬 완료")

        print("[3/4] 화자 분리 중...")
        diarize_pipeline = DiarizationPipeline(use_auth_token=hf_token, device=device)

        diarize_kwargs: dict = {}
        if args.num_speakers is not None:
            diarize_kwargs["min_speakers"] = args.num_speakers
            diarize_kwargs["max_speakers"] = args.num_speakers

        diarize_segments = diarize_pipeline(audio, **diarize_kwargs)
        result = whisperx.assign_word_speakers(diarize_segments, result)
        print("      화자 분리 완료")

        print("[4/4] 결과 저장 중...")
        save_outputs(output_dir, audio_path, result)

    except ImportError as e:
        print(f"[ERROR] 필수 패키지가 없습니다: {e}", file=sys.stderr)
        print("  pip install -r requirements.txt 를 실행하세요.", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\\n사용자 요청으로 중단되었습니다.", file=sys.stderr)
        return 130
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 1

    print("\\n완료!")
    return 0


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    raise SystemExit(main())`
    },
  ],

  glossary: {
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .resolve().parent를 붙이면 이 파일이 든 폴더의 절대경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "sys.stdout.reconfigure": "콘솔(터미널) 출력의 글자 인코딩을 바꾸는 기능. 윈도우에서 한글이 깨지지 않도록 UTF-8로 다시 설정함.",
    "from __future__ import annotations": "파이썬 3.10 미만에서도 'list[str]' 같은 최신 타입 힌트를 쓸 수 있게 해주는 호환성 선언. 파일 맨 위에 한 번만 씀.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값 들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env 파일에 KEY=값 형태로 적어둠.",
    "sys.exit()": "프로그램을 즉시 끝내는 함수. 괄호 안의 숫자가 종료 코드(0=성공, 1=오류)임. 쉘 스크립트 등에서 성공·실패를 구분할 때 씀.",
    "os.getenv": "환경변수 값을 읽어오는 함수. os.getenv('키') 형태로 씀. 해당 키가 없으면 None을 돌려줌.",
    "FileNotFoundError": "찾는 파일이 없을 때 나는 오류. 여기서는 오디오 파일이 없을 때 분명히 알려주려고 일부러 발생시킴.",
    "타입 힌트": "변수·함수에 자료의 종류(str, Path, list 등)를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "CUDA": "NVIDIA GPU에서 병렬 연산을 할 수 있게 해주는 기술. 'cuda'로 설정하면 GPU를 써서 처리 속도가 크게 빨라짐.",
    "torch": "딥러닝 연산을 수행하는 PyTorch 라이브러리. WhisperX가 내부적으로 의존하며, GPU(CUDA) 감지에도 씀.",
    "재귀(recursion)": "함수가 자기 자신을 다시 호출하는 방식. 딕셔너리 안의 딕셔너리처럼 중첩된 구조를 끝까지 파고들어 처리할 때 씀.",
    "numpy": "수치 계산용 파이썬 라이브러리. WhisperX 내부에서 쓰이며, numpy 타입은 JSON으로 바로 저장할 수 없어 변환이 필요함.",
    "isinstance()": "어떤 값이 특정 종류(타입)인지 확인하는 함수. 예: isinstance(x, list)는 'x가 리스트인가?'를 True/False로 답함.",
    "pandas DataFrame": "표(스프레드시트)처럼 데이터를 다루는 구조. pandas 라이브러리가 제공하며, .to_csv()로 CSV 파일로 바로 저장할 수 있음.",
    "enumerate()": "목록을 돌면서 '번호와 값'을 함께 꺼내 주는 함수. start=1을 주면 1번부터 셈.",
    "round()": "숫자를 지정한 소수점 자릿수로 반올림하는 함수. round(1.2345, 3) → 1.235.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"도시\": \"서울\"}처럼 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    "리스트(list)": "여러 값을 순서대로 담는 목록. [\"a\", \"b\"]처럼 대괄호로 표현함.",
    ".get()": "딕셔너리에서 값을 '안전하게' 꺼내는 방법. 열쇠가 없어도 오류를 내지 않고, 정해둔 기본값을 돌려줌.",
    "divmod()": "두 수를 나눠서 몫과 나머지를 한꺼번에 돌려주는 함수. divmod(90, 60)은 (1, 30) → 1분 30초.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 값이 글자에 끼워 들어가는 파이썬 문법.",
    "RTTM": "Rich Transcription Time Marked의 약자. 화자 분리 결과를 저장하는 표준 텍스트 파일 형식. 각 줄이 '언제·누가·얼마나' 말했는지를 나타냄.",
    "mkdir": "폴더를 만드는 명령. parents=True는 중간 폴더까지, exist_ok=True는 이미 있어도 오류 없이 넘어가게 함.",
    "JSON": "데이터를 주고받는 표준 글자 형식. {\"key\": \"value\"} 모양으로, 파이썬 딕셔너리와 거의 똑같이 생김. 파일 저장·API 통신에 널리 쓰임.",
    "json.dumps": "파이썬 딕셔너리·리스트를 JSON 형식의 문자열로 변환하는 함수. ensure_ascii=False는 한글을 그대로, indent=2는 들여쓰기로 보기 좋게 함.",
    "write_text": "문자열을 파일에 통째로 쓰는 Path의 기능. encoding='utf-8'로 한글이 깨지지 않게 저장함.",
    "argparse": "'python 파일.py --옵션 값' 형태의 명령줄 입력을 정의하고 해석해 주는 파이썬 표준 도구.",
    "ImportError": "import 하려는 패키지가 설치되지 않았을 때 나는 오류. pip install로 설치하면 해결됨.",
    "KeyboardInterrupt": "사용자가 Ctrl+C를 눌러 프로그램을 강제 중단했을 때 발생하는 신호. 적절히 처리하면 깔끔하게 종료할 수 있음.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
    "DiarizationPipeline": "pyannote.audio 기반의 화자 분리 파이프라인 클래스. 오디오를 받아 '언제 누가 말했는지'를 구간별로 분리해 줌. HuggingFace 토큰으로 접근 권한을 확인함.",
    "WhisperX": "OpenAI Whisper를 기반으로 단어 수준 타임스탬프 정렬과 화자 분리(pyannote 연동)를 추가한 오픈소스 라이브러리. 기본 Whisper보다 정밀한 시각 정보를 제공함.",
    "set(집합)": "{ }로 묶은 '중복 없는 값들의 모음'. 'x in 집합'으로 포함 여부를 매우 빠르게 확인할 수 있어 지원 형식 검사에 적합함.",
    "sorted()": "목록을 정렬해 새 목록으로 돌려주는 함수. 여기서는 파일을 이름순으로 정렬함.",
    "suffix(확장자)": "Path 객체의 .suffix는 파일 확장자(예: '.mp3')를 줌. .lower()로 소문자로 맞춰 대소문자 구분 없이 비교함.",
    "제너레이터 표현식": "( ... for x in ... if ... ) 형태로, 값을 미리 다 만들지 않고 필요할 때 하나씩 만들어내는 효율적인 문법.",
  },
};
