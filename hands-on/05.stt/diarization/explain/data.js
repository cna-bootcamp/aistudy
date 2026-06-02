/*
 * 예제 설명 페이지 콘텐츠 데이터 (예제별로 이 파일 하나만 작성함)
 *
 * 공용 셸: hands-on/explain-exam/  (index.html + assets/)
 * 여는 법: explain-exam/index.html?data=../05.stt/diarization/explain/data.js
 *
 * 스키마: window.EXPLAIN_DATA = { meta, files[], flow[], functions[], glossary{} }
 *   - functions[].lines 는 줄 번호 대신 "앵커(at: 코드 부분 문자열)"를 씀 → 앱이 줄 번호 자동 계산
 *   - 검증: node hands-on/explain-exam/verify-data.js <이 파일 경로>  (VERIFY: PASS 여야 함)
 */
window.EXPLAIN_DATA = {
  meta: {
    title: "Whisper + pyannote 화자 분리 예제 설명",
    entry: "diarization.py",
  },

  files: [
    { id: "main", label: "diarization.py", role: "단일 파일 CLI 예제 · 음성 전사 + 화자 분리 결합" },
  ],

  flow: [
    {
      step: 1, title: "실행 시작",
      summary: "python diarization.py 실행 → main()이 진입점으로 호출됨",
      detail: "터미널에서 실행하면 파일 맨 아래 if __name__ == \"__main__\": 가 main()을 호출함. main()이 네 단계 작업 전체를 순서대로 지휘함.",
    },
    {
      step: 2, title: "환경 준비",
      summary: "setup_device()로 GPU/CPU를 정하고 load_env()로 HuggingFace 토큰을 읽음",
      detail: "요리를 시작하기 전 재료와 도구를 챙기는 단계임. GPU가 있으면 더 빠른 float16 연산을 쓰고, 없으면 CPU용 float32를 씀. HF_TOKEN은 pyannote 모델을 내려받을 때 필요한 '허가증'임.",
    },
    {
      step: 3, title: "오디오 입력 확정",
      summary: "resolve_audio_input()이 CLI 인수 또는 audio 폴더 첫 파일을 자동 선택함",
      detail: "--input 옵션으로 파일을 직접 줄 수도 있고, 생략하면 audio 폴더의 파일을 자동으로 고름. librosa가 그 파일을 numpy 배열 + torch 텐서 두 가지 형태로 준비함.",
    },
    {
      step: 4, title: "[1/4] 오디오 로드",
      summary: "load_audio()가 librosa로 파일을 읽어 numpy 배열과 torch 텐서를 반환함",
      detail: "librosa는 MP3·WAV 등 오디오를 파이썬 배열로 읽어주는 도서관(라이브러리)임. 16 000Hz 샘플레이트로 통일하여 Whisper와 pyannote 모두 같은 오디오를 씀. torch 텐서는 pyannote 입력 형식에 맞춰 (1, T) 모양으로 추가 변환함.",
    },
    {
      step: 5, title: "[2/4] Whisper STT",
      summary: "load_whisper()로 모델을 준비하고 transcribe()로 오디오를 청크별 타임스탬프와 함께 전사함",
      detail: "받아쓰기 단계임. 로컬에 내려받은 Whisper 모델이 오디오를 30초씩 잘라(chunk_length_s=30) 한국어 텍스트로 변환함. 각 청크에 시작·종료 시각(timestamp)이 함께 오므로 나중에 화자 구간과 맞출 수 있음.",
    },
    {
      step: 6, title: "[3/4] pyannote 화자 분리",
      summary: "diarize()가 pyannote 모델을 실행해 '몇 초~몇 초는 누구'를 분리함",
      detail: "누가 언제 말했는지 구분하는 단계임. pyannote는 음성 패턴(성문)을 분석해 SPEAKER_00, SPEAKER_01 처럼 화자를 레이블로 나눔. 화자 수를 직접 지정하거나 자동으로 감지할 수 있음.",
    },
    {
      step: 7, title: "[4/4] 결과 병합 및 저장",
      summary: "merge_results()가 Whisper 청크에 화자를 붙이고 save_results()가 TXT·CSV로 저장함",
      detail: "퍼즐 조각 맞추기 단계임. Whisper가 준 각 청크의 중간 시각(mid)을 pyannote 구간과 비교해 가장 잘 맞는 화자를 배정함. SPEAKER_00 같은 내부 이름을 등장 순서로 화자A·화자B 형태로 바꿔 읽기 쉽게 함.",
    },
    {
      step: 8, title: "종료",
      summary: "TXT·CSV 저장 경로를 출력하고 종료 코드 0(성공)을 반환함",
      detail: "작업이 끝나면 어디에 저장했는지 알려주고 끝남. 도중에 오류가 나면 메시지를 찍고 종료 코드 1(실패)을 돌려줌.",
    },
  ],

  functions: [
    // ===== 모듈 수준 상수 및 경로 설정 =====
    {
      id: "module_setup",
      name: "모듈 설정 (경로·상수)",
      fileId: "main",
      summary: "파일 맨 위에서 한글 출력 깨짐 방지, 경로, 지원 형식, 모델 ID 등 기본 설정을 준비함.",
      how: "함수가 아니라 '프로그램 시작 시 한 번 준비하는 값들'임. 이 파일 위치를 기준으로 오디오 폴더·.env 경로를 자동 계산하고, Whisper와 pyannote 모델 이름·샘플레이트·지원 확장자 등을 상수로 정의함.",
      terms: ["Path(__file__)", "set(집합)", "sys.stdout.reconfigure", "SAMPLE_RATE"],
      lines: [
        { at: 'if hasattr(sys.stdout, "reconfigure"):', text: "윈도우 콘솔에서 한글이 깨지지 않도록 출력 인코딩을 UTF-8로 바꿈." },
        { at: 'SCRIPT_DIR = Path(__file__).resolve().parent', text: "Path(__file__)은 '이 파일의 위치'. .resolve().parent로 이 파일이 든 폴더의 절대경로를 구함." },
        { at: 'WHISPER_MODEL_ID = "openai/whisper-large-v3-turbo"', text: "HuggingFace Hub에서 내려받을 Whisper 모델 이름. 큰 따옴표 안 문자열이 그대로 다운로드 주소가 됨." },
        { at: 'SAMPLE_RATE = 16_000', text: "오디오를 읽을 때 쓸 샘플레이트(초당 16000번 측정). 두 모델(Whisper·pyannote) 모두 이 값을 기준으로 함." },
        { at: 'SUPPORTED_FORMATS = {".mp3"', text: "지원하는 오디오 확장자 집합(set). 중복 없는 모음이라 'in 집합'으로 빠르게 확인 가능함." },
      ],
      code:
`"""Whisper + pyannote 화자 분리 예제.

로컬 Whisper(whisper-large-v3-turbo)로 음성을 전사하고,
pyannote(speaker-diarization-3.1)로 화자를 분리한 뒤 결합함.
librosa로 오디오를 로드하여 torchaudio MP3 백엔드 문제를 우회함.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import librosa
import numpy as np
import pandas as pd
import torch
from dotenv import load_dotenv
from pyannote.audio import Pipeline as DiarizationPipeline
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline


# Windows 콘솔에서 한글 출력 시 UnicodeEncodeError 방지
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# 이 파일이 위치한 디렉터리 경로를 절대경로로 구함
SCRIPT_DIR = Path(__file__).resolve().parent
STT_DIR = SCRIPT_DIR.parent
HANDS_ON_DIR = STT_DIR.parent
AUDIO_DIR = STT_DIR / "audio"
ENV_PATH = HANDS_ON_DIR / ".env"

WHISPER_MODEL_ID = "openai/whisper-large-v3-turbo"
DIARIZATION_MODEL_ID = "pyannote/speaker-diarization-3.1"
SAMPLE_RATE = 16_000

SUPPORTED_FORMATS = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".webm"}`,
    },

    // ===== 디바이스 및 환경 설정 =====
    {
      id: "setup_device",
      name: "setup_device()",
      fileId: "main",
      summary: "GPU 사용 가능 여부를 확인하여 디바이스 이름과 연산 정밀도를 반환함.",
      how: "딥러닝 모델은 GPU가 있으면 훨씬 빠름. torch.cuda.is_available()로 GPU를 쓸 수 있는지 확인하고, 가능하면 'cuda'(GPU) + float16(빠른 계산), 아니면 'cpu' + float32(안정적인 계산)를 선택함.",
      terms: ["torch", "cuda", "float16 / float32", "tuple(튜플)"],
      lines: [
        { at: 'device = "cuda" if torch.cuda.is_available() else "cpu"', text: "GPU(CUDA)를 쓸 수 있으면 'cuda', 없으면 'cpu'를 선택함. 조건식(삼항 표현)으로 한 줄에 작성." },
        { at: 'torch_dtype = torch.float16 if device == "cuda" else torch.float32', text: "GPU면 float16(16비트 소수), CPU면 float32(32비트 소수)를 씀. float16은 더 빠르지만 GPU가 없으면 오류남." },
        { at: 'return device, torch_dtype', text: "두 값을 묶어(튜플) 한 번에 반환함. 받을 때 device, torch_dtype = setup_device() 처럼 둘 다 받음." },
      ],
      code:
`def setup_device() -> tuple[str, torch.dtype]:
    """GPU 사용 가능 여부를 확인하여 디바이스와 연산 정밀도를 반환함."""
    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch_dtype = torch.float16 if device == "cuda" else torch.float32
    return device, torch_dtype`,
    },

    {
      id: "load_env",
      name: "load_env()",
      fileId: "main",
      summary: "hands-on/.env에서 HF_TOKEN을 읽어 반환함.",
      how: "pyannote 모델은 HuggingFace에서 내려받을 때 허가 토큰(HF_TOKEN)이 필요함. load_dotenv로 .env 파일을 읽어 환경변수로 올리고, HF_TOKEN 값이 없으면 친절한 오류 메시지로 어디서 발급받는지 안내함.",
      terms: ["load_dotenv", "환경변수(.env)", "HF_TOKEN", "RuntimeError"],
      lines: [
        { at: 'load_dotenv(ENV_PATH)', text: ".env 파일의 KEY=값들을 읽어 환경변수로 등록함. 이후 os.getenv()로 값을 꺼낼 수 있음." },
        { at: 'hf_token = os.getenv("HF_TOKEN")', text: "환경변수에서 HF_TOKEN 값을 꺼냄. 없으면 None을 받음." },
        { at: 'if not hf_token:', text: "토큰이 없으면 즉시 RuntimeError로 멈추고, 어디에 토큰을 추가해야 하는지·어디서 발급받는지를 안내함." },
      ],
      code:
`def load_env() -> str:
    """hands-on/.env에서 HF_TOKEN을 읽어 반환함."""
    # .env 파일에서 API 키 등 환경변수를 로드함
    load_dotenv(ENV_PATH)
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        raise RuntimeError(
            f"HF_TOKEN이 설정되지 않았습니다.\\n"
            f"{ENV_PATH} 파일에 'HF_TOKEN=your_token' 을 추가하세요.\\n"
            f"토큰 발급: https://huggingface.co/settings/tokens"
        )
    return hf_token`,
    },

    // ===== 오디오 입력 =====
    {
      id: "find_audio_files",
      name: "find_audio_files(audio_dir)",
      fileId: "main",
      summary: "audio 디렉터리에서 지원 형식의 오디오 파일 목록을 이름순으로 반환함.",
      how: "폴더가 없으면 빈 목록을 돌려줌(안전 처리). 폴더 안 항목을 하나씩 보며, 파일이면서 확장자가 지원 형식인 것만 sorted로 이름순 정렬해 반환함.",
      terms: ["sorted()", "suffix(확장자)", "set(집합)", "타입 힌트"],
      lines: [
        { at: 'if not audio_dir.exists():', text: "폴더가 없으면 빈 목록 []을 돌려줌. 오류 대신 안전하게 처리함." },
        { at: 'return sorted(', text: "sorted()로 이름순 정렬한 목록을 반환함. 제너레이터 표현식으로 조건에 맞는 항목만 모음." },
        { at: 'if p.is_file() and p.suffix.lower() in SUPPORTED_FORMATS', text: "파일이면서 확장자(.mp3 등)가 지원 형식 집합에 들어 있는 것만 고름." },
      ],
      code:
`def find_audio_files(audio_dir: Path) -> list[Path]:
    """audio 디렉터리에서 지원 형식의 오디오 파일 목록을 이름순으로 반환함."""
    if not audio_dir.exists():
        return []
    return sorted(
        p for p in audio_dir.iterdir()
        if p.is_file() and p.suffix.lower() in SUPPORTED_FORMATS
    )`,
    },

    {
      id: "resolve_audio_input",
      name: "resolve_audio_input(input_arg)",
      fileId: "main",
      summary: "CLI 인수가 없으면 audio 디렉터리 첫 번째 파일을 자동 선택함.",
      how: "--input 으로 파일을 직접 줬으면 그 파일이 실제로 있는지·지원 형식인지 확인 후 사용함. 인수가 없으면 find_audio_files로 목록을 찾아 첫 번째 파일을 자동으로 선택함.",
      terms: ["Path(__file__)", "suffix(확장자)", "FileNotFoundError", "ValueError"],
      lines: [
        { at: 'if input_arg is not None:', text: "--input 으로 파일을 직접 줬으면(인수가 None이 아니면) 그 경로를 사용함." },
        { at: 'path = input_arg.expanduser().resolve()', text: "~ 같은 단축 경로를 펴고(expanduser) 절대경로로 바꿈(resolve)." },
        { at: 'if path.suffix.lower() not in SUPPORTED_FORMATS:', text: "확장자가 지원 형식이 아니면 ValueError로 알려줌." },
        { at: 'print(f"자동 선택: {audio_files[0].name}")', text: "인수가 없을 때 audio 폴더의 첫 번째 파일을 자동 선택하고 이름을 출력함." },
      ],
      code:
`def resolve_audio_input(input_arg: Path | None) -> Path:
    """CLI 인수가 없으면 audio 디렉터리 첫 번째 파일을 자동 선택함."""
    if input_arg is not None:
        path = input_arg.expanduser().resolve()
        if not path.exists():
            raise FileNotFoundError(f"입력 오디오 파일을 찾을 수 없습니다: {path}")
        if path.suffix.lower() not in SUPPORTED_FORMATS:
            raise ValueError(f"지원하지 않는 확장자입니다: {path.suffix}")
        return path

    audio_files = find_audio_files(AUDIO_DIR)
    if not audio_files:
        raise FileNotFoundError(f"오디오 파일이 없습니다: {AUDIO_DIR}")

    print(f"자동 선택: {audio_files[0].name}")
    return audio_files[0]`,
    },

    {
      id: "load_audio",
      name: "load_audio(audio_path)",
      fileId: "main",
      summary: "librosa로 오디오를 로드하여 numpy 배열과 torch 텐서 (1, T)를 반환함.",
      how: "librosa.load가 MP3·WAV 등 파일을 읽어 numpy 배열(숫자 목록)로 만들어 줌. sr=SAMPLE_RATE로 샘플레이트를 16 000Hz로 맞춰 Whisper·pyannote 모두에 호환되게 함. unsqueeze(0)으로 배열 앞에 '배치 차원'을 추가해 pyannote가 요구하는 (1, T) 모양으로 바꿈.",
      terms: ["librosa", "numpy(np)", "torch 텐서", "unsqueeze(0)", "SAMPLE_RATE"],
      lines: [
        { at: 'waveform_np, _ = librosa.load(str(audio_path), sr=SAMPLE_RATE, mono=True)', text: "librosa.load로 오디오 파일을 numpy 배열로 읽음. sr=16000으로 샘플레이트를 고정하고, mono=True로 스테레오를 단채널로 합침. _ 는 실제 샘플레이트(이미 알고 있으므로 버림)." },
        { at: 'waveform_tensor = torch.from_numpy(waveform_np).unsqueeze(0)', text: "numpy 배열을 torch 텐서로 바꾸고, unsqueeze(0)으로 앞에 차원을 추가해 (1, T) 모양으로 만듦. pyannote가 이 모양을 요구함." },
        { at: 'duration = len(waveform_np) / SAMPLE_RATE', text: "배열 길이를 샘플레이트로 나눠 오디오 길이(초)를 계산함." },
      ],
      code:
`def load_audio(audio_path: Path) -> tuple[np.ndarray, torch.Tensor]:
    """librosa로 오디오를 로드하여 numpy 배열과 torch 텐서 (1, T)를 반환함."""
    print(f"  파일: {audio_path.name}")
    waveform_np, _ = librosa.load(str(audio_path), sr=SAMPLE_RATE, mono=True)
    # unsqueeze(0): 1차원 배열에 배치 차원(앞쪽)을 추가하여 (1, T) 형태로 만듦
    waveform_tensor = torch.from_numpy(waveform_np).unsqueeze(0)
    duration = len(waveform_np) / SAMPLE_RATE
    print(f"  길이: {duration:.1f}초 | 샘플: {len(waveform_np):,}")
    return waveform_np, waveform_tensor`,
    },

    // ===== Whisper STT =====
    {
      id: "load_whisper",
      name: "load_whisper(device, torch_dtype)",
      fileId: "main",
      summary: "HuggingFace transformers로 Whisper 로컬 모델과 파이프라인을 로드함.",
      how: "인터넷 API에 보내는 게 아니라, 모델 파일을 내 컴퓨터에 내려받아 직접 실행함. AutoModelForSpeechSeq2Seq가 모델을 불러오고, AutoProcessor가 오디오를 모델 입력 형식으로 변환함. pipeline()이 이 두 가지를 묶어 쓰기 쉬운 파이프라인을 만들어 줌.",
      terms: ["transformers", "AutoModelForSpeechSeq2Seq", "AutoProcessor", "pipeline(변환기)", "from_pretrained", "HuggingFace"],
      lines: [
        { at: 'model = AutoModelForSpeechSeq2Seq.from_pretrained(', text: "HuggingFace Hub에서 Whisper 모델 파일을 내려받거나 이미 있으면 캐시에서 불러옴. low_cpu_mem_usage=True로 메모리를 아껴 로드함." },
        { at: 'model.to(device)', text: "모델을 GPU(cuda) 또는 CPU로 옮김. 연산이 실제로 실행되는 장치를 지정하는 것임." },
        { at: 'processor = AutoProcessor.from_pretrained(WHISPER_MODEL_ID)', text: "오디오를 모델이 이해하는 숫자 형식으로 바꾸는 전처리 도구를 불러옴." },
        { at: 'return pipeline(', text: "모델·토크나이저·특징 추출기를 묶어 pipeline 객체로 만듦. 이 객체에 오디오를 넘기면 전사 결과를 받을 수 있음." },
      ],
      code:
`def load_whisper(device: str, torch_dtype: torch.dtype) -> Any:
    """Hugging Face transformers로 Whisper 로컬 모델과 파이프라인을 로드함."""
    print(f"  모델: {WHISPER_MODEL_ID}")
    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        WHISPER_MODEL_ID,
        torch_dtype=torch_dtype,
        low_cpu_mem_usage=True,
        use_safetensors=True,
    )
    model.to(device)
    processor = AutoProcessor.from_pretrained(WHISPER_MODEL_ID)
    return pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        torch_dtype=torch_dtype,
        device=device,
    )`,
    },

    {
      id: "transcribe",
      name: "transcribe(whisper_pipe, waveform_np)",
      fileId: "main",
      summary: "Whisper 파이프라인으로 오디오를 전사하고 청크별 타임스탬프를 반환함.",
      how: "오디오를 30초 단위(chunk_length_s=30)로 잘라 처리하고, 각 조각에 시작·종료 시각(timestamp)을 붙여 돌려줌. 한국어(language='ko')로 전사하고, 여러 온도(temperature) 값을 순서대로 시도해 품질이 낮으면 다음 온도로 재시도함.",
      terms: ["청크(chunk)", "timestamp", "return_timestamps", "batch_size", "temperature", "전사(transcription)"],
      lines: [
        { at: '{"array": waveform_np, "sampling_rate": SAMPLE_RATE},', text: "파이프라인에 오디오 numpy 배열과 샘플레이트를 딕셔너리로 전달함." },
        { at: 'chunk_length_s=30,', text: "오디오를 30초 단위로 잘라 처리함. 긴 오디오도 메모리 부족 없이 처리 가능함." },
        { at: 'return_timestamps=True,', text: "각 전사 청크에 시작·종료 시각을 함께 반환하도록 요청함. 화자 분리와 맞추는 데 필요함." },
        { at: '"language": "ko",', text: "전사 언어를 한국어로 지정함." },
        { at: 'chunks = result.get("chunks", [])', text: "결과에서 청크 목록을 꺼냄. chunks가 없으면 빈 목록을 씀(안전 처리)." },
      ],
      code:
`def transcribe(whisper_pipe: Any, waveform_np: np.ndarray) -> list[dict]:
    """Whisper 파이프라인으로 오디오를 전사하고 청크별 타임스탬프를 반환함."""
    result = whisper_pipe(
        {"array": waveform_np, "sampling_rate": SAMPLE_RATE},
        chunk_length_s=30,
        batch_size=16,
        return_timestamps=True,
        generate_kwargs={
            "language": "ko",
            "task": "transcribe",
            "max_new_tokens": 448,
            "num_beams": 1,
            "condition_on_prev_tokens": False,
            "compression_ratio_threshold": 1.35,
            "temperature": (0.0, 0.2, 0.4, 0.6, 0.8, 1.0),
            "logprob_threshold": -1.0,
            "no_speech_threshold": 0.6,
        },
    )
    chunks = result.get("chunks", [])
    print(f"  인식된 청크 수: {len(chunks)}")
    return chunks`,
    },

    // ===== pyannote 화자 분리 =====
    {
      id: "diarize",
      name: "diarize(hf_token, waveform_tensor, device, num_speakers)",
      fileId: "main",
      summary: "pyannote 화자 분리 파이프라인을 실행하여 (시작, 종료, 화자) 목록을 반환함.",
      how: "pyannote는 오디오에서 '누가 몇 초부터 몇 초까지 말했는지'를 분석하는 AI 모델임. DiarizationPipeline.from_pretrained로 모델을 불러온 뒤, 오디오 텐서를 넣으면 itertracks()로 구간별 화자 정보를 꺼낼 수 있음. num_speakers를 줄 수도 있고 자동 감지를 쓸 수도 있음.",
      terms: ["pyannote", "DiarizationPipeline", "itertracks", "화자 분리(diarization)", "HF_TOKEN", "from_pretrained"],
      lines: [
        { at: 'diar_pipeline = DiarizationPipeline.from_pretrained(', text: "HuggingFace에서 pyannote 화자 분리 모델을 내려받거나 캐시에서 불러옴. token은 모델 접근 허가에 필요한 HF_TOKEN임." },
        { at: 'if device == "cuda":', text: "GPU가 있으면 화자 분리 모델도 GPU로 옮겨 빠르게 실행함." },
        { at: 'if num_speakers is not None:', text: "화자 수를 알고 있으면 kwargs에 담아 파이프라인에 전달함. 없으면 자동 감지함." },
        { at: 'for turn, _, speaker in diarization.itertracks(yield_label=True)', text: "itertracks()로 구간(turn)과 화자(speaker) 정보를 하나씩 꺼냄. _는 쓰지 않는 값을 버리는 관례." },
      ],
      code:
`def diarize(
    hf_token: str,
    waveform_tensor: torch.Tensor,
    device: str,
    num_speakers: int | None,
) -> list[tuple[float, float, str]]:
    """pyannote 화자 분리 파이프라인을 실행하여 (시작, 종료, 화자) 목록을 반환함."""
    print(f"  모델: {DIARIZATION_MODEL_ID}")
    # DiarizationPipeline: pyannote 화자 분리 모델을 로드하는 클래스
    diar_pipeline = DiarizationPipeline.from_pretrained(
        DIARIZATION_MODEL_ID,
        token=hf_token,
    )
    if device == "cuda":
        diar_pipeline.to(torch.device("cuda"))

    kwargs: dict[str, Any] = {}
    if num_speakers is not None:
        kwargs["num_speakers"] = num_speakers

    diarization = diar_pipeline(
        {"waveform": waveform_tensor, "sample_rate": SAMPLE_RATE},
        **kwargs,
    )

    segments = [
        (turn.start, turn.end, speaker)
        for turn, _, speaker in diarization.itertracks(yield_label=True)
    ]
    print(f"  화자 분리 세그먼트 수: {len(segments)}")
    return segments`,
    },

    // ===== 결과 병합 =====
    {
      id: "_find_speaker",
      name: "_find_speaker(mid, diar_segments)",
      fileId: "main",
      summary: "중간 지점을 포함하는 화자 세그먼트를 찾고, 없으면 가장 가까운 세그먼트 화자를 반환함.",
      how: "Whisper 청크의 중간 시각(mid)이 어느 화자 구간에 속하는지 확인함. 딱 맞는 구간이 없으면 중간 시각이 가장 가까운 화자를 선택함. min()과 lambda로 거리를 계산하는 코드가 핵심.",
      terms: ["lambda(람다)", "min()", "tuple(튜플)"],
      lines: [
        { at: 'for start, end, speaker in diar_segments:', text: "화자 분리 세그먼트를 하나씩 꺼내 (시작, 종료, 화자) 세 값으로 분리함." },
        { at: 'if start <= mid <= end:', text: "청크 중간 시각이 이 구간 안에 있으면 해당 화자를 바로 반환함." },
        { at: 'return min(diar_segments, key=lambda s: abs((s[0] + s[1]) / 2 - mid))[2]', text: "딱 맞는 구간이 없으면, 각 세그먼트의 중간 시각과 mid의 거리를 계산해 가장 가까운 세그먼트의 화자(인덱스 [2])를 선택함." },
      ],
      code:
`def _find_speaker(mid: float, diar_segments: list[tuple[float, float, str]]) -> str:
    """중간 지점을 포함하는 화자 세그먼트를 반환하고, 없으면 가장 가까운 세그먼트 화자를 반환함."""
    for start, end, speaker in diar_segments:
        if start <= mid <= end:
            return speaker
    return min(diar_segments, key=lambda s: abs((s[0] + s[1]) / 2 - mid))[2]`,
    },

    {
      id: "_speaker_label",
      name: "_speaker_label(raw, order_map)",
      fileId: "main",
      summary: "SPEAKER_00 형태의 원시 라벨을 첫 등장 순서 기반 화자A/화자B 형식으로 변환함.",
      how: "pyannote가 주는 'SPEAKER_00', 'SPEAKER_01' 같은 이름을 읽기 쉬운 '화자A', '화자B' 형식으로 바꿈. 첫 등장 순서를 기억하는 order_map 딕셔너리로 매번 같은 결과를 보장함.",
      terms: ["딕셔너리(dict)", ".get()", "f-string"],
      lines: [
        { at: 'alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"', text: "화자 이름에 쓸 알파벳 문자열. 인덱스로 꺼내 A·B·C 순으로 씀." },
        { at: 'idx = order_map.get(raw, 0)', text: "order_map에서 이 화자의 등장 순서를 꺼냄. 없으면 0을 씀(안전 기본값)." },
        { at: 'return f"화자{alphabet[idx % len(alphabet)]}"', text: "등장 순서 인덱스로 알파벳을 골라 '화자A' 형태로 반환함. % len(alphabet)으로 26명 이상이어도 넘치지 않게 함." },
      ],
      code:
`def _speaker_label(raw: str, order_map: dict[str, int]) -> str:
    """SPEAKER_00 형태의 원시 라벨을 첫 등장 순서 기반 화자A/화자B 형식으로 변환함."""
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    idx = order_map.get(raw, 0)
    return f"화자{alphabet[idx % len(alphabet)]}"`,
    },

    {
      id: "merge_results",
      name: "merge_results(whisper_chunks, diar_segments)",
      fileId: "main",
      summary: "Whisper 청크에 화자 라벨을 배정하여 병합 결과를 반환함.",
      how: "퍼즐 조각 맞추기 단계임. 먼저 화자별 첫 등장 순서를 order_map에 기록함. 그 다음 각 Whisper 청크의 중간 시각(mid)을 _find_speaker로 화자 구간과 맞추고, _speaker_label로 읽기 쉬운 이름으로 바꿈. 결과를 id·시각·화자·텍스트가 담긴 딕셔너리 목록으로 만들어 반환함.",
      terms: ["딕셔너리(dict)", "리스트(list)", "타입 힌트", "f-string"],
      lines: [
        { at: 'order_map: dict[str, int] = {}', text: "화자 첫 등장 순서를 기록하는 빈 딕셔너리. 예: {'SPEAKER_00': 0, 'SPEAKER_01': 1}." },
        { at: 'if spk not in order_map:', text: "처음 등장하는 화자면 현재 목록 크기(len)를 순서로 배정함. 이미 있으면 건드리지 않음." },
        { at: 'text = chunk.get("text", "").strip()', text: "청크에서 텍스트를 꺼내 앞뒤 공백을 제거함. 비어 있으면 .strip()이 빈 문자열을 돌려줌." },
        { at: 'mid = (start + end) / 2', text: "청크의 시작·종료 시각 평균을 내 중간 시각을 구함. 이 시각이 어느 화자 구간에 속하는지 찾는 기준이 됨." },
        { at: 'ts_str = f"{int(start) // 60:02d}:{int(start) % 60:02d}"', text: "시작 시각(초)을 MM:SS 형태의 문자열로 만듦. //60은 분, %60은 나머지 초, :02d는 두 자리 패딩." },
      ],
      code:
`def merge_results(
    whisper_chunks: list[dict],
    diar_segments: list[tuple[float, float, str]],
) -> list[dict]:
    """Whisper 청크에 화자 라벨을 배정하여 병합 결과를 반환함."""
    # 첫 등장 순서로 화자A/화자B 라벨을 안정적으로 부여하기 위한 순서 맵 생성
    order_map: dict[str, int] = {}
    for _, _, spk in diar_segments:
        if spk not in order_map:
            order_map[spk] = len(order_map)

    merged: list[dict] = []
    for chunk in whisper_chunks:
        text = chunk.get("text", "").strip()
        if not text:
            continue

        ts = chunk.get("timestamp", (0.0, 0.0))
        start = float(ts[0]) if ts[0] is not None else 0.0
        end = float(ts[1]) if ts[1] is not None else start
        mid = (start + end) / 2

        raw_spk = _find_speaker(mid, diar_segments) if diar_segments else "SPEAKER_00"
        speaker = _speaker_label(raw_spk, order_map)
        ts_str = f"{int(start) // 60:02d}:{int(start) % 60:02d}"

        merged.append({
            "id": len(merged) + 1,
            "timestamp": ts_str,
            "start_sec": round(start, 2),
            "end_sec": round(end, 2),
            "speaker": speaker,
            "text": text,
        })
    return merged`,
    },

    // ===== 출력 =====
    {
      id: "save_results",
      name: "save_results(output_dir, audio_path, segments, num_speakers, device)",
      fileId: "main",
      summary: "전사 결과를 TXT와 CSV 파일로 저장하고 저장 경로를 반환함.",
      how: "결과를 두 가지 형식으로 저장함. TXT는 사람이 읽기 좋은 대화록 형태, CSV는 엑셀 등에서 분석할 수 있는 표 형태임. pandas의 DataFrame이 목록을 CSV로 만들어 주고, | 구분자로 저장함.",
      terms: ["mkdir", "DataFrame(판다스)", "write_text", "f-string", "타입 힌트"],
      lines: [
        { at: 'output_dir.mkdir(parents=True, exist_ok=True)', text: "저장 폴더가 없으면 만듦. parents=True는 중간 폴더도 같이, exist_ok=True는 이미 있어도 오류 없이 넘어감." },
        { at: 'generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")', text: "현재 시각을 '2024-01-15 10:30:00' 형태의 문자열로 만듦. 파일에 생성 시각을 기록하기 위함." },
        { at: 'transcript = "\\n".join(', text: "각 세그먼트를 '[시각] 화자: 텍스트' 형태로 만들어 줄바꿈으로 이어 붙임. join은 목록의 항목들을 구분자로 연결하는 함수." },
        { at: 'txt_path.write_text(', text: "준비한 내용을 UTF-8 인코딩으로 TXT 파일에 씀. 한글이 깨지지 않도록 인코딩을 지정함." },
        { at: 'pd.DataFrame(segments).to_csv(csv_path', text: "세그먼트 목록을 pandas DataFrame(표 형태)으로 만들어 CSV로 저장함. | 구분자, UTF-8-sig(엑셀 호환 BOM 포함)로 저장함." },
      ],
      code:
`def save_results(
    output_dir: Path,
    audio_path: Path,
    segments: list[dict],
    num_speakers: int | None,
    device: str,
) -> tuple[Path, Path]:
    """전사 결과를 TXT와 CSV 파일로 저장하고 저장 경로를 반환함."""
    output_dir.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    transcript = "\\n".join(
        f"[{s['timestamp']}] {s['speaker']}: {s['text']}" for s in segments
    )

    txt_path = output_dir / "result.txt"
    txt_path.write_text(
        f"Whisper + pyannote Diarization Result\\n"
        f"Generated At  : {generated_at}\\n"
        f"STT Model     : {WHISPER_MODEL_ID}\\n"
        f"Diarization   : {DIARIZATION_MODEL_ID}\\n"
        f"Audio File    : {audio_path.name}\\n"
        f"Device        : {device.upper()}\\n"
        f"Num Speakers  : {num_speakers if num_speakers else 'auto'}\\n"
        f"\\n## 화자 분리 대화록\\n{transcript}\\n",
        encoding="utf-8",
    )

    csv_path = output_dir / "result_chunks.csv"
    pd.DataFrame(segments).to_csv(csv_path, index=False, encoding="utf-8-sig", sep="|")

    return txt_path, csv_path`,
    },

    // ===== CLI =====
    {
      id: "prompt_num_speakers",
      name: "prompt_num_speakers(cli_value)",
      fileId: "main",
      summary: "CLI 값이 없으면 사용자에게 화자 수를 입력받음 (Enter 시 자동 감지).",
      how: "화자 수를 미리 알면 분리 정확도가 높아짐. --num-speakers 옵션으로 줬으면 바로 사용하고, 없으면 사용자에게 직접 물어봄. Enter만 누르면 None을 반환해 pyannote가 자동으로 화자 수를 감지하게 함.",
      terms: ["input()", "int()", "예외 처리(try/except)"],
      lines: [
        { at: 'if cli_value is not None:', text: "CLI 옵션으로 값을 이미 줬으면 그 값을 바로 반환함. 사용자에게 다시 묻지 않음." },
        { at: 'raw = input("\\n화자 수를 입력하세요', text: "input()으로 사용자의 키보드 입력을 받음. Enter만 누르면 빈 문자열이 됨." },
        { at: 'if not raw:', text: "Enter만 눌러 빈 문자열이면 None을 반환. pyannote가 자동으로 화자 수를 감지하게 함." },
        { at: 'n = int(raw)', text: "입력값을 정수로 변환함. 숫자가 아니면 ValueError가 발생해 except로 감." },
        { at: 'if n < 1:', text: "화자 수가 1 미만이면 유효하지 않으므로 ValueError를 일부러 발생시켜 자동 감지로 넘어감." },
      ],
      code:
`def prompt_num_speakers(cli_value: int | None) -> int | None:
    """CLI 값이 없으면 사용자에게 화자 수를 입력받음 (Enter 시 자동 감지)."""
    if cli_value is not None:
        return cli_value
    raw = input("\\n화자 수를 입력하세요 (Enter=자동 감지): ").strip()
    if not raw:
        return None
    try:
        n = int(raw)
        if n < 1:
            raise ValueError
        return n
    except ValueError:
        print("유효하지 않은 입력입니다. 자동 감지로 진행합니다.")
        return None`,
    },

    {
      id: "parse_args",
      name: "parse_args()",
      fileId: "main",
      summary: "커맨드라인 인수를 파싱함.",
      how: "argparse는 'python diarization.py --input a.mp3 --num-speakers 2' 같은 명령줄 입력을 정의하고 해석함. 각 옵션의 타입·기본값·도움말을 정의한 뒤 parse_args()로 실제 입력을 파싱해 객체로 반환함.",
      terms: ["argparse", "타입 힌트"],
      lines: [
        { at: 'parser = argparse.ArgumentParser(', text: "argparse 파서를 만듦. description에 이 프로그램이 무엇인지 설명을 넣으면 --help 시 보여줌." },
        { at: '"--input"', text: "--input 옵션 정의: 변환할 오디오 파일 경로. 생략하면 None(자동 선택)." },
        { at: '"--output-dir"', text: "--output-dir 옵션 정의: 결과를 저장할 폴더(기본값은 스크립트 폴더)." },
        { at: '"--num-speakers"', text: "--num-speakers 옵션 정의: 화자 수 정수. 생략하면 None(프롬프트 또는 자동 감지)." },
        { at: 'return parser.parse_args()', text: "실제 명령줄을 해석해 옵션 값들을 담은 Namespace 객체를 반환함." },
      ],
      code:
`def parse_args() -> argparse.Namespace:
    """커맨드라인 인수를 파싱함."""
    parser = argparse.ArgumentParser(
        description="Whisper + pyannote 화자 분리 음성 인식 예제"
    )
    parser.add_argument(
        "--input", type=Path, default=None,
        help="입력 오디오 파일 경로. 생략 시 audio 디렉터리 첫 번째 파일 사용",
    )
    parser.add_argument(
        "--output-dir", type=Path, default=SCRIPT_DIR,
        help=f"결과 저장 디렉터리. 기본값: {SCRIPT_DIR}",
    )
    parser.add_argument(
        "--num-speakers", type=int, default=None,
        help="화자 수 (정수). 생략 시 프롬프트 또는 자동 감지",
    )
    return parser.parse_args()`,
    },

    {
      id: "main",
      name: "main()",
      fileId: "main",
      summary: "Whisper + pyannote 화자 분리 워크플로우를 순서대로 실행하는 진입점.",
      how: "프로그램의 '지휘자'임. [1/4] 오디오 로드 → [2/4] Whisper STT → [3/4] pyannote 화자 분리 → [4/4] 결과 병합 및 저장 순서로 진행함. 전체를 try/except로 감싸 오류가 나도 메시지를 찍고 실패(1)로 끝냄.",
      terms: ["예외 처리(try/except)", "if __name__", "raise SystemExit"],
      lines: [
        { at: 'args = parse_args()', text: "먼저 명령줄 옵션을 읽음." },
        { at: 'device, torch_dtype = setup_device()', text: "GPU·CPU 중 사용할 디바이스와 연산 정밀도를 결정함." },
        { at: 'hf_token = load_env()', text: ".env에서 HuggingFace 토큰을 읽음." },
        { at: 'waveform_np, waveform_tensor = load_audio(audio_path)', text: "[1/4] 오디오를 numpy 배열과 torch 텐서 두 형태로 로드함." },
        { at: 'whisper_pipe = load_whisper(device, torch_dtype)', text: "[2/4] Whisper 모델을 로드하고 오디오를 전사함." },
        { at: 'diar_segments = diarize(hf_token, waveform_tensor, device, num_speakers)', text: "[3/4] pyannote로 화자를 분리함." },
        { at: 'merged = merge_results(whisper_chunks, diar_segments)', text: "[4/4] Whisper 결과와 화자 분리 결과를 병합하고 저장함." },
        { at: 'except KeyboardInterrupt:', text: "Ctrl+C로 중단하면 130을 반환함(Unix 규약: 128 + SIGINT 번호 2)." },
      ],
      code:
`def main() -> int:
    """Whisper + pyannote 화자 분리 워크플로우를 실행함."""
    args = parse_args()
    output_dir = args.output_dir.expanduser().resolve()

    try:
        print("=" * 70)
        print("Whisper + pyannote 화자 분리 음성 인식")
        print("=" * 70)

        device, torch_dtype = setup_device()
        print(f"- 디바이스  : {device.upper()}")
        print(f"- STT 모델  : {WHISPER_MODEL_ID}")
        print(f"- 화자 분리 : {DIARIZATION_MODEL_ID}")

        hf_token = load_env()
        audio_path = resolve_audio_input(args.input)
        num_speakers = prompt_num_speakers(args.num_speakers)

        print(f"- 입력 파일 : {audio_path}")
        print(f"- 화자 수   : {num_speakers if num_speakers else '자동 감지'}")
        print(f"- 출력 경로 : {output_dir}")

        print("\\n[1/4] 오디오 로드")
        waveform_np, waveform_tensor = load_audio(audio_path)

        print("\\n[2/4] Whisper STT")
        whisper_pipe = load_whisper(device, torch_dtype)
        whisper_chunks = transcribe(whisper_pipe, waveform_np)

        print("\\n[3/4] pyannote 화자 분리")
        diar_segments = diarize(hf_token, waveform_tensor, device, num_speakers)

        print("\\n[4/4] 결과 병합 및 저장")
        merged = merge_results(whisper_chunks, diar_segments)
        txt_path, csv_path = save_results(
            output_dir, audio_path, merged, num_speakers, device
        )

    except KeyboardInterrupt:
        print("\\n사용자 요청으로 중단되었습니다.", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print("\\n완료")
    print(f"- TXT : {txt_path}")
    print(f"- CSV : {csv_path}")
    return 0


# 이 파일을 직접 실행할 때만 아래 코드를 수행함 (import 시 미실행)
if __name__ == "__main__":
    raise SystemExit(main())`,
    },
  ],

  glossary: {
    "Path(__file__)": "Path(__file__)은 '지금 이 파이썬 파일'을 가리킴. .resolve().parent를 붙이면 이 파일이 든 폴더의 절대경로가 됨. 어디서 실행해도 경로가 어긋나지 않게 함.",
    "set(집합)": "{ }로 묶은 '중복 없는 값들의 모음'. 'x in 집합'으로 들어있는지 매우 빠르게 확인할 수 있어, 지원 형식 검사에 적합함.",
    "sys.stdout.reconfigure": "콘솔(터미널) 출력의 글자 인코딩을 바꾸는 기능. 윈도우에서 한글이 깨지지 않도록 UTF-8로 다시 설정함.",
    "SAMPLE_RATE": "오디오를 1초에 몇 번 측정(샘플링)하는지를 나타내는 숫자. 16 000Hz는 1초에 16 000번 측정. Whisper와 pyannote 모두 이 값을 기준으로 동작함.",
    "torch": "딥러닝 모델을 만들고 실행하는 파이썬 라이브러리(PyTorch). 여기서는 GPU/CPU 선택, 텐서 계산, 모델 실행에 사용함.",
    "cuda": "NVIDIA GPU에서 병렬 연산을 수행하는 기술의 이름. 'device=cuda'는 GPU를 사용하겠다는 뜻임. GPU가 없으면 'cpu'를 사용함.",
    "float16 / float32": "소수(실수)를 저장하는 방식. float16은 16비트(가볍고 빠름, GPU에서 활용), float32는 32비트(더 정확, CPU에 적합). 숫자 처리 속도와 메모리 사용에 영향을 줌.",
    "tuple(튜플)": "여러 값을 묶어 한 번에 다루는 자료구조. 리스트와 비슷하지만 한 번 만들면 값을 바꿀 수 없음. (device, torch_dtype) 처럼 관련 값들을 쌍으로 반환할 때 씀.",
    "load_dotenv": ".env 파일에 적어둔 KEY=값들을 읽어, 프로그램이 쓸 수 있는 환경변수로 올려주는 함수.",
    "환경변수(.env)": "API 키처럼 코드에 직접 쓰면 안 되는 비밀 값을 따로 보관하는 설정. 보통 .env 파일에 KEY=값 형태로 적어둠.",
    "HF_TOKEN": "HuggingFace Hub에서 모델을 내려받을 때 필요한 인증 토큰. pyannote 같은 일부 모델은 이 토큰 없이 접근할 수 없음. https://huggingface.co/settings/tokens 에서 발급.",
    "RuntimeError": "'실행 중 문제가 생겼다'고 알리는 오류의 한 종류. 여기서는 토큰이나 파일이 없을 때 일부러 발생시켜 원인을 알려줌.",
    "sorted()": "목록을 정렬해 새 목록으로 돌려주는 함수. 여기서는 파일을 이름순으로 정렬함.",
    "suffix(확장자)": "Path 객체의 .suffix는 파일 확장자(예: '.mp3')를 줌. .lower()로 소문자로 맞춰 대소문자 구분 없이 비교함.",
    "FileNotFoundError": "찾는 파일이나 폴더가 없을 때 나는 오류. 여기서는 오디오 파일이 없을 때 분명히 알려주려고 발생시킴.",
    "ValueError": "값이 잘못됐을 때 나는 오류. 여기서는 지원하지 않는 확장자이거나 유효하지 않은 화자 수일 때 발생시킴.",
    "librosa": "오디오 파일(MP3·WAV 등)을 파이썬 숫자 배열로 읽어주는 라이브러리. 샘플레이트 변환·모노 변환도 자동으로 해줌. torchaudio의 MP3 백엔드 문제를 우회하는 용도로도 씀.",
    "numpy(np)": "파이썬에서 숫자 배열을 빠르게 처리하는 핵심 라이브러리. 오디오 파형을 숫자 목록(배열)으로 다룰 때 씀. 'np'는 관례적인 별칭임.",
    "torch 텐서": "PyTorch에서 숫자 데이터를 담는 다차원 배열. numpy 배열과 비슷하지만 GPU에서도 실행할 수 있고 딥러닝 모델의 입력·출력 형식임.",
    "unsqueeze(0)": "배열 앞에 크기 1인 차원을 추가하는 함수. 예: (T,) → (1, T). pyannote가 오디오를 (배치 수, 샘플 수) 모양으로 받기 때문에 필요함.",
    "transformers": "HuggingFace가 만든 AI 모델 라이브러리. Whisper·BERT 등 수천 가지 모델을 몇 줄의 코드로 불러와 쓸 수 있게 해줌.",
    "AutoModelForSpeechSeq2Seq": "음성을 텍스트로 변환(Seq2Seq)하는 모델을 자동으로 불러오는 클래스. 모델 이름만 주면 적합한 구조를 알아서 선택함.",
    "AutoProcessor": "오디오를 모델이 이해하는 숫자 형식으로 바꾸는 전처리 도구를 자동으로 불러오는 클래스. 토크나이저와 특징 추출기를 포함함.",
    "pipeline(변환기)": "HuggingFace 모델을 가장 쉽게 쓰는 방법. '어떤 작업인지'(자동 음성 인식 등)와 모델을 주면, 입력을 넣으면 결과가 나오는 객체를 만들어 줌.",
    "from_pretrained": "HuggingFace Hub에 공개된 학습 완료 모델을 내려받거나 캐시에서 불러오는 메서드. 모델 이름 문자열 하나로 사용 가능함.",
    "HuggingFace": "AI 모델을 공유하고 내려받을 수 있는 플랫폼(허브). Whisper·pyannote 등 수만 가지 모델이 공개되어 있음. 일부 모델은 HF_TOKEN이 있어야 내려받을 수 있음.",
    "청크(chunk)": "긴 오디오를 일정 길이(여기서는 30초)로 잘라낸 조각. 너무 긴 오디오를 한꺼번에 처리하면 메모리가 부족해 청크 단위로 나눠 처리함.",
    "timestamp": "소리가 발생한 시각(시작·종료). Whisper가 각 전사 조각의 시작·종료 시각을 float 숫자(초 단위)로 제공함. 화자 분리 구간과 맞추는 데 핵심 정보임.",
    "return_timestamps": "Whisper가 전사 결과에 시작·종료 시각을 함께 포함할지 지정하는 옵션. True로 설정해야 화자와 연결할 수 있음.",
    "batch_size": "한 번에 처리할 청크 수. batch_size=16이면 16개 청크를 묶어 GPU에 한꺼번에 보내 처리 속도를 높임.",
    "temperature": "모델이 다음 단어를 고를 때의 '무작위성'. 0.0은 가장 확실한 것만, 1.0은 다양한 선택을 함. Whisper는 여러 온도를 순서대로 시도해 품질이 낮으면 다음 온도로 재시도함.",
    "전사(transcription)": "말소리를 '같은 언어의 글자'로 받아쓰는 것. 한국어 오디오 → 한국어 텍스트.",
    "pyannote": "화자 분리(Speaker Diarization) 특화 AI 모델 라이브러리. 오디오에서 '누가 언제 말했는지'를 분석해 줌. HuggingFace에서 내려받을 때 HF_TOKEN이 필요함.",
    "DiarizationPipeline": "pyannote 화자 분리 모델을 불러와 실행하는 클래스. from_pretrained로 모델을 로드하고, 오디오 텐서를 넣으면 화자 구간을 반환함.",
    "itertracks": "pyannote 화자 분리 결과에서 구간(turn)·화자(speaker) 정보를 하나씩 꺼내는 반복자(이터레이터). yield_label=True로 화자 레이블을 함께 받음.",
    "화자 분리(diarization)": "오디오에서 '누가(who) 언제(when) 말했는지'를 자동으로 구분하는 기술. 회의 녹음이나 인터뷰 음성에서 발화자를 분리할 때 사용함.",
    "lambda(람다)": "이름 없는 간단한 함수를 한 줄로 정의하는 파이썬 문법. 예: lambda s: s[0]+s[1]은 s를 받아 앞 두 값의 합을 반환하는 함수임. min()·sorted()의 key= 인자에 자주 씀.",
    "min()": "목록에서 가장 작은 값을 찾는 함수. key= 인수에 기준 함수를 주면 그 기준으로 비교함. 여기서는 가장 가까운 화자 구간을 찾는 데 씀.",
    "딕셔너리(dict)": "'열쇠(key)'로 '값(value)'을 찾는 자료 구조. {\"도시\": \"서울\"}처럼 이름표를 붙여 값을 저장함. 사전에서 단어로 뜻을 찾는 것과 같음.",
    "리스트(list)": "여러 값을 순서대로 담는 목록. [\"a\", \"b\"]처럼 대괄호로 표현함.",
    "f-string": "문자열 앞에 f를 붙이고 f\"안녕 {이름}\"처럼 쓰면, 중괄호 {} 안의 변수 값이 글자에 끼워 들어가는 파이썬 문법.",
    "타입 힌트": "변수나 함수에 '이건 문자열(str)이야, 결과는 목록(list)이야'처럼 자료의 종류를 적어두는 표시. 실행에 꼭 필요하진 않지만, 코드를 읽고 점검하기 쉽게 함.",
    "DataFrame(판다스)": "pandas 라이브러리의 핵심 자료구조. 엑셀 시트처럼 행과 열이 있는 표 형태임. 딕셔너리 목록을 DataFrame으로 만들면 CSV로 저장하기 쉬움.",
    "mkdir": "폴더를 만드는 명령. parents=True는 중간 폴더까지, exist_ok=True는 이미 있어도 오류 없이 넘어가게 함.",
    "write_text": "문자열을 파일에 통째로 쓰는 Path의 기능. encoding='utf-8'로 한글이 깨지지 않게 저장함.",
    "input()": "콘솔(터미널)에서 사용자가 키보드로 입력한 한 줄을 글자로 받아오는 함수.",
    "int()": "글자(문자열)를 정수로 바꾸는 함수. 숫자로 바꿀 수 없으면 ValueError가 남.",
    "예외 처리(try/except)": "오류가 날 수 있는 코드를 try로 감싸고, 오류가 나면 except에서 대신 처리하는 안전장치. 프로그램이 갑자기 멈추는 것을 막음.",
    "argparse": "'python 파일.py --옵션 값' 형태의 명령줄 입력을 정의하고 해석해 주는 파이썬 표준 도구.",
    "if __name__": "if __name__ == \"__main__\": 은 '이 파일을 직접 실행할 때만' 아래 코드를 수행하게 함(다른 파일이 import할 때는 실행 안 됨).",
    "raise SystemExit": "프로그램을 끝내면서 종료 코드를 운영체제에 알림. main()의 반환값(0=성공, 1=실패)을 종료 코드로 씀.",
    ".get()": "딕셔너리에서 값을 '안전하게' 꺼내는 방법. 열쇠가 없어도 오류를 내지 않고, 정해둔 기본값을 돌려줌.",
  },
};
