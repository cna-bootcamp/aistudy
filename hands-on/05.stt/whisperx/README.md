# WhisperX STT + 화자 분리 예제

## 개요

WhisperX를 사용하여 음성 파일을 전사(STT)하고 화자를 분리(Speaker Diarization)하는 예제임  
단어 수준 타임스탬프 정렬과 pyannote 기반 화자 분리를 결합하여 높은 정확도를 제공함  
HuggingFace Access Token(`HF_TOKEN`)이 필요하며 `hands-on/05.stt/.env`에 등록 필요

## 파일 구성

```text
hands-on/05.stt/
├── audio/
│   └── phone-with-wife.mp3       # 입력 오디오
├── .env                          # HF_TOKEN 등 환경변수
└── whisperx/
    ├── whisperx-diarization.py   # 메인 스크립트
    ├── requirements.txt          # 의존성 목록
    ├── README.md                 # 이 파일
    ├── result.json               # 원본 결과 객체 (실행 후 생성)
    ├── result_dialog.txt         # 화자별 대화 형식 (실행 후 생성)
    ├── result_chunks.csv         # segment/word 상세 정보 (실행 후 생성)
    └── result.rttm               # RTTM 표준 형식 (실행 후 생성)
```

## 소스 코드 설명

`whisperx-diarization.py`는 다음 순서로 동작함

1. `hands-on/05.stt/.env`에서 `HF_TOKEN` 로드 — 없으면 발급 가이드 출력 후 종료
2. 입력 오디오 파일 확인 (CLI 미지정 시 `audio/` 첫 번째 파일 자동 선택)
3. **[1/4] 전사**: `whisperx.load_model()` + `model.transcribe()`로 초벌 전사 생성
4. **[2/4] 정렬**: `whisperx.load_align_model()` + `whisperx.align()`으로 단어 수준 타임스탬프 정렬
5. **[3/4] 화자 분리**: `DiarizationPipeline()`으로 화자 분할, `assign_word_speakers()`로 단어에 화자 매핑
6. **[4/4] 저장**: 4종 출력 파일 저장

### 주요 함수

| 함수 | 역할 |
| --- | --- |
| `load_hf_token()` | `.env`에서 `HF_TOKEN` 로드, 없으면 가이드 출력 후 `sys.exit(1)` |
| `resolve_audio()` | CLI 인자 또는 `audio/` 디렉터리에서 오디오 파일 결정 |
| `detect_device()` | CUDA 가용 여부 자동 감지 |
| `to_serializable()` | numpy/torch 타입을 JSON 직렬화 가능 타입으로 변환 |
| `build_dialog_lines()` | 동일 화자 연속 단어를 발화 단위로 그룹핑하여 대화 형식 생성 |
| `build_chunks_df()` | segment/word 수준 DataFrame 생성 |
| `build_rttm_lines()` | RTTM 표준 형식 라인 생성 |
| `save_outputs()` | 4종 출력 파일 일괄 저장 |

### 핵심 코드

```python
import whisperx
from whisperx.diarize import DiarizationPipeline

# 전사
model = whisperx.load_model("large-v3-turbo", device, compute_type="float16")
audio = whisperx.load_audio("audio/phone-with-wife.mp3")
result = model.transcribe(audio, batch_size=16, language="ko")

# 단어 수준 타임스탬프 정렬
model_a, metadata = whisperx.load_align_model(language_code="ko", device=device)
result = whisperx.align(result["segments"], model_a, metadata, audio, device)

# 화자 분리 (화자 수 고정)
pipeline = DiarizationPipeline(use_auth_token=HF_TOKEN, device=device)
diarize_segments = pipeline(audio, min_speakers=2, max_speakers=2)
result = whisperx.assign_word_speakers(diarize_segments, result)
```

## HuggingFace Access Token 설정

### 1. Access Token 발급

아래 사이트에서 HuggingFace Access Token을 발급함

```
https://huggingface.co/settings/tokens
```

### 2. 두 모델 사용 약관 동의 (필수)

아래 두 모델 모두 약관 동의 필요 — 하나라도 누락 시 화자 분리 실패

- `pyannote/speaker-diarization-3.1`: https://huggingface.co/pyannote/speaker-diarization-3.1
- `pyannote/segmentation-3.0`: https://huggingface.co/pyannote/segmentation-3.0

### 3. .env 파일에 등록

```env
# hands-on/05.stt/.env
HF_TOKEN=hf_xxxxxxxxxx
```

## 시스템 요구사항

| 항목 | 최소 사양 | 권장 사양 |
| --- | --- | --- |
| Python | 3.9+ | 3.10+ |
| RAM | 8GB | 16GB+ |
| GPU VRAM | — | 8GB+ (CUDA 12.1+) |
| 저장공간 | 5GB | 10GB+ (모델 캐시) |
| OS | Windows 10 / macOS 12 / Ubuntu 20.04 | — |

> CPU 전용 실행 가능하나 처리 속도가 현저히 느림

## GPU/CPU 확인 방법

### NVIDIA GPU 확인 (nvidia-smi)

```powershell
# Windows PowerShell / Linux
nvidia-smi
```

출력 예시:

```
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 535.54.03    Driver Version: 535.54.03    CUDA Version: 12.2    |
+-----------------------------------------------------------------------------+
| GPU  0   GeForce RTX 3080   On   | ...                                      |
+-----------------------------------------------------------------------------+
```

`CUDA Version: 12.1` 이상이면 GPU 가속 사용 가능

### Python에서 CUDA 확인

```python
import torch
print(torch.cuda.is_available())   # True: GPU 사용 가능
print(torch.cuda.get_device_name(0))  # GPU 모델명
```

## ffmpeg 설치 방법

WhisperX는 오디오 파일 처리에 ffmpeg를 사용함

### Windows

```powershell
# Winget 사용 (권장)
winget install Gyan.FFmpeg
# 위 명령이 실패할 경우
# winget install ffmpeg

# Chocolatey 사용
choco install ffmpeg

# 설치 확인
ffmpeg -version
```

> Winget이 없는 경우 https://ffmpeg.org/download.html 에서 수동 다운로드 후  
> 압축 해제 및 `bin/` 경로를 시스템 환경변수 `PATH`에 추가

### macOS

```bash
# Homebrew 사용 (권장)
brew install ffmpeg

# 설치 확인
ffmpeg -version
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install ffmpeg

# 설치 확인
ffmpeg -version
```

## PyTorch 설치

> GPU(CUDA) 사용 시 시스템 CUDA 버전에 맞는 PyTorch를 전역 환경에 먼저 설치해야 함  
> 자세한 설치 가이드: [install-pytorch.md](https://github.com/cna-bootcamp/aistudy/blob/main/agentic-ai/reference/install-pytorch.md)

### 1단계: CUDA 버전 확인

```bash
nvidia-smi
```

### 2단계: CUDA 버전에 맞는 PyTorch 설치 (전역 환경)

| 시스템 CUDA 버전 | 설치 명령어 |
|:---:|---|
| 12.4 이상 | `pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124` |
| 12.1 ~ 12.3 | `pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121` |
| 11.8 | `pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118` |
| GPU 없음 (CPU) | `pip install torch torchvision torchaudio` |

> macOS (Apple Silicon): `pip install torch torchvision torchaudio` — MPS 자동 활성화

### 3단계: 설치 확인

```bash
python -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA available: {torch.cuda.is_available()}')"
```

## 가상환경 설정 및 실행 방법

> **최초 실행 시 주의**: pyannote 모델 다운로드 권한 필요.  
> **관리자 권한 터미널**에서 실행 권장 (Windows: PowerShell을 "관리자로 실행")

### Windows / PowerShell

```powershell
cd hands-on\05.stt\whisperx
python -m venv venv --system-site-packages
venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Windows / Git Bash

```bash
cd hands-on/05.stt/whisperx
python -m venv venv --system-site-packages
source venv/Scripts/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### macOS / Linux

```bash
cd hands-on/05.stt/whisperx
python -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 실행

```powershell
# 기본 실행 (audio/ 첫 번째 파일, 화자 수 자동 감지)
python whisperx-diarization.py

# 화자 수 지정 (2명)
python whisperx-diarization.py --num-speakers 2

# 오디오 파일 직접 지정
python whisperx-diarization.py --input "..\audio\phone-with-wife.mp3" --num-speakers 2

# 출력 디렉터리 지정
python whisperx-diarization.py --output-dir ".\output"
```

## 생성 파라미터 설명

| 파라미터 | 기본값 | 설명 |
| --- | --- | --- |
| `--input` | audio/ 첫 번째 파일 | 입력 오디오 파일 경로 |
| `--output-dir` | 스크립트 디렉터리 | 결과 파일 저장 경로 |
| `--num-speakers` | None (자동) | 화자 수 고정. 지정 시 `min_speakers=N, max_speakers=N`으로 설정 |
| `--language` | `ko` | 음성 언어 코드 (ISO 639-1) |
| `--model` | `large-v3-turbo` | Whisper 모델 크기 (`tiny` / `base` / `small` / `medium` / `large-v2` / `large-v3` / `large-v3-turbo`) |
| `--batch-size` | `16` | 배치 크기. GPU 메모리 부족 시 `8` 또는 `4`로 줄임 |
| `--compute-type` | `float16` | 연산 정밀도. GPU: `float16` 권장, CPU: `int8` 자동 적용 |
| `--device` | 자동 감지 | `cuda` 또는 `cpu`. 생략 시 CUDA 가용 여부 자동 확인 |

## 출력 파일 설명

### result.json

WhisperX 파이프라인의 전체 결과 객체 (원본)

```json
{
  "segments": [
    {
      "start": 0.0,
      "end": 2.5,
      "text": " 여보세요",
      "speaker": "SPEAKER_00",
      "words": [
        { "word": " 여보세요", "start": 0.0, "end": 2.5, "score": 0.95, "speaker": "SPEAKER_00" }
      ]
    }
  ]
}
```

### result_dialog.txt

동일 화자의 연속 단어를 발화 단위로 그룹핑한 대화 형식

```text
[00:00] SPEAKER_00: 여보세요 지금 어디야
[00:04] SPEAKER_01: 나 지금 회사야
```

### result_chunks.csv

segment/word 수준 상세 정보 (`|` 구분자)

```
type|segment_id|word_id|speaker|start|end|duration|text
segment|1||SPEAKER_00|0.0|2.5|2.5|여보세요 지금 어디야
word|1|1|SPEAKER_00|0.0|1.2|1.2|여보세요
```

### result.rttm

RTTM(Rich Transcription Time Mark) 표준 형식

```
SPEAKER phone-with-wife 1 0.000 2.500 <NA> <NA> SPEAKER_00 <NA> <NA>
SPEAKER phone-with-wife 1 4.100 3.200 <NA> <NA> SPEAKER_01 <NA> <NA>
```

## 문법 검사

```powershell
python -m py_compile whisperx-diarization.py
echo "문법 오류 없음"
```
