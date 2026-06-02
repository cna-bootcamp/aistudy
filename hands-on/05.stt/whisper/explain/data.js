/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../05.stt/whisper/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "Whisper 로컬 모델 STT (whisper-large-v3-turbo) 예제 설명",
    entry: "whisper-large-v3-turbo.py",
  },

  files: [
    { id: "main", label: "whisper-large-v3-turbo.py", role: "단일 파일 CLI 예제 · 로컬 Whisper 모델로 오디오를 전사하고 CSV/TXT로 저장" },
  ],

  flow: [
    {
      step: 1, title: "실행 시작",
      summary: "python whisper-large-v3-turbo.py 실행 → if __name__ == '__main__': 가 main()을 호출함",
      detail: "이 예제는 웹이 아니라 '명령줄 프로그램'임. 터미널에서 실행하면 파일 맨 아래 if __name__ == \"__main__\": 블록이 main()을 호출함. main()이 전체 작업을 순서대로 지휘함.",
    },
    {
      step: 2, title: "환경 준비",
      summary: "한글 출력 인코딩 설정, 경로 상수(SCRIPT_DIR·AUDIO_DIR), 모델 파라미터 상수를 파일 상단에서 정의함",
      detail: "프로그램이 시작될 때 한 번만 준비하는 값들임. 윈도우에서 한글이 깨지지 않도록 stdout/stderr 인코딩을 UTF-8로 맞추고, 이 파일 위치를 기준으로 audio 폴더 경로를 자동 계산함. MODEL_ID·LANGUAGE·CHUNK_LENGTH_S 같은 상수는 코드 안에 값을 직접 쓰지 않고 한 곳에 모아 관리함.",
    },
    {
      step: 3, title: "오디오 파일 탐색",
      summary: "find_first_audio_file()이 audio 폴더에서 지원 형식의 파일 중 이름순 첫 번째를 찾음",
      detail: "audio 폴더가 없거나 지원 확장자 파일이 없으면 즉시 오류를 내어 문제를 빨리 알아채게 함. sorted()로 이름순 정렬해 항상 같은 파일을 선택하도록 일관성을 유지함. 찾은 파일 경로를 main()으로 돌려주면 이후 단계에서 사용함.",
    },
    {
      step: 4, title: "GPU/CPU 감지",
      summary: "detect_device()가 GPU 사용 가능 여부를 확인하여 (디바이스, dtype) 쌍을 반환함",
      detail: "GPU(NVIDIA 그래픽 카드)가 있으면 cuda+float16으로 빠르게, 없으면 cpu+float32로 느리게 실행함. dtype은 '숫자를 얼마나 정밀하게 저장할지'를 뜻함. GPU용 float16은 메모리를 절반만 써서 더 빠름.",
    },
    {
      step: 5, title: "모델 로드",
      summary: "load_pipeline()이 Hugging Face transformers로 Whisper ASR 파이프라인을 로드함",
      detail: "파이프라인(pipeline)은 '음성 → 텍스트' 변환 과정을 한 번에 처리하는 묶음 도구임. 처음 실행 시 모델 파일을 인터넷에서 받아 캐시에 저장하고, 이후엔 캐시를 재사용함. 모델 크기가 크기 때문에 로드에 시간이 걸릴 수 있음.",
    },
    {
      step: 6, title: "음성 인식 (전사)",
      summary: "transcribe()가 파이프라인으로 오디오를 텍스트와 타임스탬프 청크로 변환함",
      detail: "오디오를 CHUNK_LENGTH_S(30초) 단위로 잘라 병렬 처리(batch_size=8)함. return_timestamps=True로 각 구간의 시작/종료 시간도 함께 받음. 결과 딕셔너리에 전체 텍스트(text)와 구간별 목록(chunks)이 들어 있음.",
    },
    {
      step: 7, title: "결과 저장",
      summary: "save_result_txt()와 save_result_csv()가 전사 결과를 result.txt와 result_chunks.csv로 저장함",
      detail: "result.txt에는 전사 전문과 메타정보(모델·파일명·생성시각)를 저장함. result_chunks.csv에는 청크별 시작/종료 시간과 텍스트를 '|' 구분자로 저장하여 스프레드시트에서 열어볼 수 있게 함. fmt_sec()가 초 단위 숫자를 '0.00s' 형식으로 보기 좋게 변환함.",
    },
    {
      step: 8, title: "완료 출력",
      summary: "저장된 파일 경로·청크 수·전사 텍스트를 출력하고 종료 코드(0=성공)를 반환함",
      detail: "작업이 끝나면 어디에 저장했는지, 몇 개의 청크로 분리됐는지 알려주고 전사 텍스트도 화면에 출력함. 중간에 오류가 나면 except로 메시지를 출력하고 종료 코드 1(실패)을 돌려줌.",
    },
  ],

  functions: [
    {
      id: "module_setup",
      name: "모듈 설정 (경로·상수)",
      fileId: "main",
      summary: "파일 맨 위에서 한글 출력 깨짐 방지, 경로 상수, 모델 파라미터, 지원 오디오 형식을 준비함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 준비하는 값들'임. SCRIPT_DIR·STT_DIR·AUDIO_DIR로 이 파일 위치를 기준으로 오디오 폴더 경로를 자동 계산함. 대문자 상수(MODEL_ID, LANGUAGE 등)는 값을 한 곳에 모아 관리하여 수정이 쉽게 함.",
      terms: ["Path(__file__)", "set(집합)", "sys.stdout.reconfigure", "from __future__ import annotations"],
      lines: [
        { at: 'if hasattr(sys.stdout, "reconfigure"):', text: "윈도우 콘솔에서 한글 출력이 깨지지 않도록 stdout·stderr 인코딩을 UTF-8로 바꿈. hasattr로 이 기능이 있는지 먼저 확인함(없는 환경에서 오류 방지)." },
        { at: 'SCRIPT_DIR = Path(__file__).resolve().parent', text: "Path(__file__)은 '지금 이 파이썬 파일'. .resolve()로 절대경로로 바꾸고 .parent로 파일이 든 폴더를 구함. 어디서 실행해도 경로가 어긋나지 않음." },
        { at: 'MODEL_ID = "openai/whisper-large-v3-turbo"', text: "Hugging Face 모델 저장소 이름. 이 값 하나만 바꾸면 다른 Whisper 모델로 교체할 수 있음." },
        { at: 'SUPPORTED_FORMATS = {".flac"', text: "Whisper가 받는 오디오 확장자를 집합(set)으로 정의함. 'x in 집합' 검사가 목록보다 훨씬 빠름." },
      ],
      code:
`"""Hugging Face transformers로 Whisper 로컬 모델을 실행하는 예제.

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

SUPPORTED_FORMATS = {".flac", ".m4a", ".mp3", ".mp4", ".mpeg", ".mpga", ".ogg", ".wav", ".webm"}`,
    },
    {
      id: "detect_device",
      name: "detect_device()",
      fileId: "main",
      summary: "GPU 사용 가능 여부를 확인하여 (디바이스 이름, 숫자 정밀도) 쌍을 반환함.",
      how: "torch.cuda.is_available()로 NVIDIA GPU가 있는지 물어봄. GPU가 있으면 'cuda'와 float16(메모리 절약·빠름)을, 없으면 'cpu'와 float32(느리지만 안전)를 돌려줌. 이 쌍을 load_pipeline()에 전달해 모델이 올바른 장치에서 실행되게 함.",
      terms: ["torch", "dtype", "GPU(cuda)", "float16/float32", "tuple(튜플)"],
      lines: [
        { at: 'if torch.cuda.is_available():', text: "PyTorch에게 'GPU(CUDA)가 쓸 수 있나?' 물어봄. True면 GPU 모드로, False면 CPU 모드로 전환함." },
        { at: 'device_name = torch.cuda.get_device_name(0)', text: "GPU가 있으면 첫 번째(0번) GPU의 이름을 읽어 화면에 출력함(예: NVIDIA GeForce RTX 3080)." },
        { at: 'return "cuda", torch.float16', text: "GPU 모드: 'cuda' 장치명과 float16(16비트 부동소수점) 정밀도를 반환함. 메모리를 절반만 써서 빠름." },
        { at: 'return "cpu", torch.float32', text: "CPU 모드: 'cpu' 장치명과 float32(32비트, 더 정밀)를 반환함. GPU 없이도 안전하게 동작함." },
      ],
      code:
`def detect_device() -> tuple[str, torch.dtype]:
    """GPU 가용 여부를 확인하여 (디바이스, dtype) 쌍을 반환함. GPU 있으면 cuda+float16, 없으면 cpu+float32."""
    if torch.cuda.is_available():
        device_name = torch.cuda.get_device_name(0)
        print(f"GPU 감지: {device_name}")
        return "cuda", torch.float16
    print("GPU 미감지 — CPU 모드로 실행 (속도가 느릴 수 있습니다)")
    return "cpu", torch.float32`,
    },
    {
      id: "find_first_audio_file",
      name: "find_first_audio_file(audio_dir)",
      fileId: "main",
      summary: "audio 폴더에서 지원 형식 파일 중 이름순 첫 번째 경로를 반환함.",
      how: "폴더가 없으면 즉시 FileNotFoundError를 냄. sorted()로 폴더 안 파일들을 이름순 정렬해 일관성을 보장함. 지원 형식이 하나도 없으면 지원 확장자를 알려주는 친절한 오류를 냄.",
      terms: ["Path(경로)", "FileNotFoundError", "sorted()", "제너레이터 표현식", "suffix(확장자)", "set(집합)"],
      lines: [
        { at: 'if not audio_dir.exists():', text: "폴더 자체가 없으면 즉시 오류를 냄. 존재 여부를 먼저 확인해 이후 오류 위치를 명확히 함." },
        { at: 'files = sorted(', text: "sorted()로 파일들을 이름순 정렬함. 매번 같은 파일이 선택되도록 일관성 보장." },
        { at: 'p for p in audio_dir.iterdir()', text: "iterdir()로 폴더 안 항목을 하나씩 훑는 제너레이터 표현식. is_file()과 확장자 검사를 조건으로 걸음." },
        { at: 'if p.is_file() and p.suffix.lower() in SUPPORTED_FORMATS', text: "파일이면서 확장자가 지원 형식 집합에 든 것만 통과시킴. .lower()로 대소문자 관계없이 비교함." },
        { at: 'if not files:', text: "지원 형식 파일이 하나도 없으면 지원 확장자 목록을 알려주는 친절한 오류를 냄." },
      ],
      code:
`def find_first_audio_file(audio_dir: Path) -> Path:
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
    return files[0]`,
    },
    {
      id: "load_pipeline",
      name: "load_pipeline(device, torch_dtype)",
      fileId: "main",
      summary: "Hugging Face transformers로 Whisper ASR 파이프라인을 로드하여 반환함.",
      how: "pipeline()은 '음성 → 텍스트' 변환을 한 번에 처리하는 묶음 도구임. 'automatic-speech-recognition'은 작업 종류를 지정하는 문자열임. 처음 실행 시 모델 파일을 인터넷에서 내려받아 로컬에 캐시하고, 이후엔 캐시를 재사용해 빠르게 로드함.",
      terms: ["pipeline(파이프라인)", "ASR(자동 음성 인식)", "Hugging Face transformers", "dtype", "GPU(cuda)"],
      lines: [
        { at: 'print(f"\\n[1/3] 모델 로드 중: {MODEL_ID}")', text: "'[1/3]' 표시로 3단계 작업 중 첫 번째임을 사용자에게 알려줌." },
        { at: 'return pipeline(', text: "transformers의 pipeline()로 ASR 파이프라인을 만들어 반환함. 이 객체가 이후 transcribe()에서 실제 음성 인식에 사용됨." },
        { at: '"automatic-speech-recognition"', text: "'automatic-speech-recognition'은 Hugging Face가 정한 '음성 → 텍스트' 작업 식별자임. 이 문자열 하나로 어떤 종류의 AI 작업인지 지정됨." },
        { at: 'model=MODEL_ID,', text: "Hugging Face 허브의 모델 이름을 지정함. 처음엔 인터넷에서 내려받고, 이후엔 로컬 캐시를 씀." },
      ],
      code:
`def load_pipeline(device: str, torch_dtype: torch.dtype):
    """Hugging Face transformers로 Whisper ASR 파이프라인을 로드하여 반환함."""
    print(f"\\n[1/3] 모델 로드 중: {MODEL_ID}")
    print(f"      디바이스: {device}  |  dtype: {torch_dtype}")
    return pipeline(
        "automatic-speech-recognition",
        model=MODEL_ID,
        dtype=torch_dtype,
        device=device,
    )`,
    },
    {
      id: "transcribe",
      name: "transcribe(pipe, audio_path)",
      fileId: "main",
      summary: "파이프라인으로 오디오를 실행하고 텍스트와 타임스탬프 청크를 담은 원시 결과 딕셔너리를 반환함.",
      how: "pipe()를 마치 함수처럼 호출함. 오디오를 30초(CHUNK_LENGTH_S) 단위로 잘라 8개씩(BATCH_SIZE) 병렬 처리함. return_timestamps=True로 각 구간의 시작/종료 시간도 함께 받음. generate_kwargs로 언어(korean)와 작업(transcribe)을 모델에 전달함.",
      terms: ["pipeline(파이프라인)", "return_timestamps", "chunk_length_s", "batch_size", "generate_kwargs", "딕셔너리(dict)"],
      lines: [
        { at: 'return pipe(', text: "pipe를 함수처럼 호출해 음성 인식을 실행함. 내부에서 오디오를 청크로 나눠 처리하고 결과를 모아 돌려줌." },
        { at: 'str(audio_path),', text: "Path 객체를 문자열로 변환해 파이프라인에 넘김. 파이프라인이 파일 경로 문자열을 받아 오디오를 직접 읽음." },
        { at: 'return_timestamps=True,', text: "True로 설정하면 각 청크의 시작/종료 시간(타임스탬프)도 함께 반환됨. CSV 저장에 사용됨." },
        { at: 'chunk_length_s=CHUNK_LENGTH_S,', text: "오디오를 몇 초 단위로 잘라 처리할지 지정함. 30초로 설정해 긴 오디오를 조각조각 나눠 처리함." },
        { at: 'generate_kwargs={"language": LANGUAGE, "task": TASK}', text: "모델에게 '한국어(korean)로 전사(transcribe)하라'고 지시하는 추가 설정임." },
      ],
      code:
`def transcribe(pipe, audio_path: Path) -> dict:
    """단어 수준 타임스탬프를 포함하여 ASR을 실행하고 원시 결과 딕셔너리를 반환함."""
    print(f"\\n[2/3] 음성 인식 중: {audio_path.name}")
    return pipe(
        str(audio_path),
        return_timestamps=True,
        chunk_length_s=CHUNK_LENGTH_S,
        batch_size=BATCH_SIZE,
        generate_kwargs={"language": LANGUAGE, "task": TASK},
    )`,
    },
    {
      id: "fmt_sec",
      name: "fmt_sec(seconds)",
      fileId: "main",
      summary: "초 단위 숫자를 '0.00s' 형식 문자열로 변환함. None이면 '0.00s'를 반환함.",
      how: "타임스탬프가 없는 청크(None)도 안전하게 처리하려고 None 체크를 넣음. f-string의 :.2f 형식 지정자가 소수점 두 자리로 맞춰줌.",
      terms: ["f-string", "타입 힌트", "None 처리"],
      lines: [
        { at: 'return f"{seconds:.2f}s" if seconds is not None else "0.00s"', text: "seconds가 숫자면 소수점 둘째 자리로 포맷하고 's'를 붙임(예: 3.5 → '3.50s'). None이면 '0.00s'를 반환함." },
      ],
      code:
`def fmt_sec(seconds: float | None) -> str:
    """초 단위 float 값을 '0.00s' 형식 문자열로 변환함."""
    return f"{seconds:.2f}s" if seconds is not None else "0.00s"`,
    },
    {
      id: "save_result_txt",
      name: "save_result_txt(output_path, audio_path, full_text)",
      fileId: "main",
      summary: "전사 전문(모든 텍스트)을 메타정보와 함께 result.txt로 저장함.",
      how: "f-string 삼중 따옴표로 제목·생성시각·모델명·파일명·전사 결과를 담은 텍스트를 구성함. write_text()로 UTF-8 인코딩으로 파일에 씀(한글이 깨지지 않게 인코딩 지정).",
      terms: ["f-string", "write_text", "datetime", "UTF-8"],
      lines: [
        { at: 'content = (', text: "저장할 내용을 f-string(여러 줄) 으로 구성함. 괄호 안에 여러 f-string을 이어붙이는 파이썬 문법임." },
        { at: 'f"Generated At: {datetime.now().strftime', text: "datetime.now()로 현재 시각을 얻고, strftime으로 '2024-01-15 14:30:00' 형식으로 변환함." },
        { at: 'output_path.write_text(content, encoding="utf-8")', text: "Path 객체의 write_text()로 문자열을 파일에 통째로 씀. encoding='utf-8'로 한글이 깨지지 않게 저장함." },
      ],
      code:
`def save_result_txt(output_path: Path, audio_path: Path, full_text: str) -> None:
    """전사 전문을 result.txt로 저장함."""
    content = (
        f"Whisper STT Result\\n"
        f"Generated At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\\n"
        f"Model: {MODEL_ID}\\n"
        f"Audio File: {audio_path.name}\\n"
        f"\\n"
        f"## 전사 결과\\n"
        f"{full_text}\\n"
    )
    output_path.write_text(content, encoding="utf-8")`,
    },
    {
      id: "save_result_csv",
      name: "save_result_csv(output_path, chunks)",
      fileId: "main",
      summary: "청크별 시작/종료 시간과 텍스트를 '|' 구분자로 result_chunks.csv에 저장함.",
      how: "chunks 목록을 순서대로 돌며 각 청크의 timestamp(시작, 종료)와 텍스트를 꺼내 행 딕셔너리로 만듦. pandas DataFrame으로 정리한 뒤 to_csv()로 '|' 구분자 CSV로 저장함. sep='|'을 쓰는 이유는 텍스트 안에 쉼표가 들어갈 수 있기 때문임.",
      terms: ["pandas(DataFrame)", "enumerate()", "딕셔너리(dict)", ".get()", "CSV", "sep(구분자)"],
      lines: [
        { at: 'for i, chunk in enumerate(chunks, start=1):', text: "enumerate(..., start=1)로 1번부터 번호를 매기며 청크를 하나씩 꺼냄." },
        { at: 'start, end = chunk.get("timestamp", (None, None))', text: "timestamp가 없는 청크는 (None, None)을 기본값으로 써서 안전하게 처리함. 튜플 언패킹으로 start·end 두 변수에 한 번에 담음." },
        { at: 'df = pd.DataFrame(rows, columns=["#", "시작", "종료", "텍스트"])', text: "행 딕셔너리 목록을 pandas DataFrame으로 만듦. 열 순서를 columns로 명시함." },
        { at: 'df.to_csv(output_path, index=False, sep="|", encoding="utf-8-sig")', text: "to_csv()로 파일에 저장함. sep='|'은 구분자. index=False는 행 번호를 파일에 포함하지 않음. encoding='utf-8-sig'는 엑셀에서 한글이 깨지지 않게 BOM을 추가함." },
      ],
      code:
`def save_result_csv(output_path: Path, chunks: list[dict]) -> None:
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
    df.to_csv(output_path, index=False, sep="|", encoding="utf-8-sig")`,
    },
    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "전체 작업을 순서대로 실행하는 진입점. 오디오 탐색→GPU 감지→모델 로드→전사→저장.",
      how: "프로그램의 '지휘자'임. find_first_audio_file → detect_device → load_pipeline → transcribe → save_result_txt/csv 순으로 순서대로 실행함. 전체를 try/except로 감싸 어떤 오류가 나도 메시지를 출력하고 실패(1)로 끝냄. 성공 시 0을 반환.",
      terms: ["예외 처리(try/except)", "sys.stderr", "raise SystemExit", "if __name__", ".get()"],
      lines: [
        { at: 'audio_path = find_first_audio_file(AUDIO_DIR)', text: "audio 폴더에서 처리할 오디오 파일을 찾음. 없으면 여기서 오류가 나고 except로 넘어감." },
        { at: 'device, torch_dtype = detect_device()', text: "GPU/CPU를 감지해 디바이스명과 dtype을 동시에 받음(튜플 언패킹)." },
        { at: 'pipe = load_pipeline(device, torch_dtype)', text: "감지된 장치 정보로 Whisper 파이프라인을 로드함." },
        { at: 'result = transcribe(pipe, audio_path)', text: "★핵심★ 파이프라인으로 실제 음성 인식을 실행함. 시간이 가장 오래 걸리는 단계임." },
        { at: 'full_text = result.get("text", "").strip()', text: "결과 딕셔너리에서 전체 텍스트를 꺼냄. 없으면 빈 문자열을 기본값으로 씀." },
        { at: 'except Exception as exc:', text: "중간에 어떤 오류가 나도 메시지를 stderr로 출력하고 종료 코드 1을 돌려줌(정상=0)." },
      ],
      code:
`def main() -> int:
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

        print("\\n[3/3] 결과 저장 중")
        save_result_txt(output_txt, audio_path, full_text)
        save_result_csv(output_csv, chunks)

        print("\\n완료")
        print(f"- 전사 결과 : {output_txt}")
        print(f"- 청크 CSV  : {output_csv}")
        print(f"- 청크 수   : {len(chunks)}")
        print(f"\\n전사 텍스트:\\n{full_text}")

    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    return 0


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    raise SystemExit(main())`,
    },
  ],

  glossary: {
    "from __future__ import annotations": "타입 힌트를 문자열로 평가해 순환 참조 없이 사용할 수 있게 하는 파이썬 설정. 파일 맨 위에 한 번 써두면 이후 타입 힌트 작성이 더 유연해짐.",
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .resolve().parent를 붙이면 이 파일이 든 폴더의 절대경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "set(집합)": "{ }로 묶은 '중복 없는 값들의 모음'. 'x in 집합'으로 들어있는지 매우 빠르게 확인할 수 있어, 지원 형식 검사에 적합함.",
    "sys.stdout.reconfigure": "콘솔(터미널) 출력의 글자 인코딩을 바꾸는 기능. 윈도우에서 한글이 깨지지 않도록 UTF-8로 다시 설정함.",
    "torch": "딥러닝(AI) 연산을 처리하는 대표적인 파이썬 라이브러리(PyTorch). 여기서는 GPU 감지와 숫자 정밀도(dtype) 설정에 사용됨.",
    "dtype": "데이터 타입(Data Type)의 줄임말. 숫자를 얼마나 정밀하게 저장할지를 결정함. float16은 절반 크기라 GPU에서 빠르고, float32는 더 정밀하지만 메모리를 두 배 씀.",
    "GPU(cuda)": "그래픽 처리 장치(Graphic Processing Unit). AI 연산을 CPU보다 훨씬 빠르게 처리함. NVIDIA GPU를 쓸 때 'cuda'라는 이름으로 지정함.",
    "float16/float32": "숫자 표현 방식. float16은 16비트(절반 크기)로 GPU 메모리를 아끼고, float32는 32비트(표준)로 더 정밀함. Whisper는 float16으로도 충분한 품질을 냄.",
    "tuple(튜플)": "여러 값을 순서대로 묶은 변경 불가 묶음. (a, b) 형태로 표현함. 함수가 여러 값을 한 번에 반환할 때 자주 씀. '언패킹'으로 a, b = 함수() 처럼 각각 받을 수 있음.",
    "pipeline(파이프라인)": "Hugging Face의 '한 번에 처리하는 묶음 도구'. 모델 로드·전처리·추론·후처리를 자동으로 묶어줘, pipe(오디오경로) 한 번 호출로 결과를 얻을 수 있음.",
    "ASR(자동 음성 인식)": "Automatic Speech Recognition의 줄임말. 사람의 말소리(오디오)를 글자(텍스트)로 자동 변환하는 기술. 'automatic-speech-recognition'이 Hugging Face의 ASR 작업 식별자임.",
    "Hugging Face transformers": "AI 모델을 쉽게 불러다 쓸 수 있게 해주는 인기 라이브러리. Whisper 같은 수천 개의 사전 학습된 모델을 코드 몇 줄로 사용할 수 있게 해줌.",
    "return_timestamps": "음성 인식 결과에 각 구간의 시작/종료 시간도 포함할지 여부. True로 설정하면 '0.00s~5.20s: 안녕하세요' 같은 타임스탬프 청크를 받을 수 있음.",
    "chunk_length_s": "오디오를 몇 초 단위로 잘라 처리할지 지정하는 옵션. 30초로 설정하면 긴 오디오도 30초씩 나눠 처리함.",
    "batch_size": "한 번에 몇 개의 청크를 병렬로 처리할지 지정. 8이면 8개 청크를 동시에 처리해 속도를 높임. GPU 메모리가 클수록 더 큰 값을 쓸 수 있음.",
    "generate_kwargs": "모델의 텍스트 생성 방식을 제어하는 추가 설정 딕셔너리. language로 언어, task로 작업 종류(transcribe=전사, translate=번역)를 지정함.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"도시\": \"서울\"}처럼 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    "pandas(DataFrame)": "표(테이블) 형태의 데이터를 다루는 인기 라이브러리. DataFrame은 엑셀 시트처럼 행과 열로 이루어진 표임. to_csv()로 CSV 파일로 저장할 수 있음.",
    "enumerate()": "목록을 돌면서 '번호와 값'을 함께 꺼내 주는 함수. start=1을 주면 1번부터 셈. for i, x in enumerate(목록, start=1): 형태로 씀.",
    ".get()": "딕셔너리에서 값을 '안전하게' 꺼내는 방법. 열쇠가 없어도 오류를 내지 않고, 정해둔 기본값을 돌려줌. chunk.get('timestamp', (None, None))처럼 씀.",
    "CSV": "Comma-Separated Values의 줄임말. 값들을 구분자로 나눈 텍스트 파일. 엑셀이나 스프레드시트에서 열 수 있음. 여기서는 쉼표 대신 '|'를 구분자로 씀.",
    "sep(구분자)": "CSV 파일에서 각 열을 구분하는 문자. 기본값은 쉼표(,)인데 텍스트 안에 쉼표가 있을 수 있어 '|'(파이프)를 씀.",
    "제너레이터 표현식": "( ... for x in ... if ... ) 형태로, 값을 미리 다 만들지 않고 필요할 때 하나씩 만들어내는 효율적인 문법. sorted()에 바로 넘겨 정렬할 때 자주 씀.",
    "sorted()": "목록을 정렬해 새 목록으로 돌려주는 함수. 여기서는 파일을 이름순으로 정렬해 매번 같은 파일이 선택되게 함.",
    "suffix(확장자)": "Path 객체의 .suffix는 파일 확장자(예: '.mp3')를 줌. .lower()로 소문자로 맞춰 대소문자 관계없이 비교함.",
    "FileNotFoundError": "찾는 파일이나 폴더가 없을 때 나는 오류. 여기서는 오디오 폴더나 파일이 없을 때 분명히 알려주려고 일부러 발생시킴.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
    "write_text": "문자열을 파일에 통째로 쓰는 Path의 기능. encoding='utf-8'로 한글이 깨지지 않게 저장함.",
    "datetime": "날짜와 시간을 다루는 파이썬 표준 모듈. datetime.now()로 현재 시각을 얻고, strftime()으로 원하는 형식의 문자열로 변환함.",
    "UTF-8": "전 세계 문자를 표현할 수 있는 글자 인코딩 방식. 한국어·영어·특수문자를 모두 안전하게 저장하고 읽을 수 있음.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "sys.stderr": "오류 메시지를 내보내는 통로(표준 에러). 일반 출력(stdout)과 구분해 오류만 따로 보낼 수 있음.",
    "raise SystemExit": "프로그램을 끝내면서 종료 코드를 운영체제에 알림. main()의 반환값(0=성공, 1=실패)을 종료 코드로 씀.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
    "타입 힌트": "변수나 함수에 '이건 문자열(str)이야, 결과는 정수(int)야'처럼 자료의 종류를 적어두는 표시. 실행에 꼭 필요하진 않지만 코드를 읽고 점검하기 쉽게 함.",
    "None 처리": "값이 없음을 뜻하는 None을 안전하게 다루는 방법. 'x if x is not None else 기본값' 형태로 None일 때 대체값을 지정함.",
    "Path(경로)": "파일이나 폴더의 위치를 나타내는 객체. '/'나 '\\'로 경로를 이어붙이거나, .exists()·.is_file() 같은 메서드로 편리하게 경로를 다룰 수 있음.",
  },
};
