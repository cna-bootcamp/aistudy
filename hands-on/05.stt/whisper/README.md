# Whisper STT 예제 (whisper-large-v3-turbo)

## 개요
OpenAI가 공개한 OSS Whisper 모델(`whisper-large-v3-turbo`)을 Hugging Face `transformers` 파이프라인으로 실행하여  
음성 파일을 한국어로 전사하고, 타임스탬프별 청크를 CSV로 저장하는 예제임

## 파일 구성
```text
hands-on/05.stt/
├── audio/
│   └── phone-with-wife.mp3          # 입력 오디오
└── whisper/
    ├── whisper-large-v3-turbo.py    # 메인 스크립트
    ├── requirements.txt             # 의존 라이브러리
    ├── README.md
    ├── result.txt                   # 전사 결과 (실행 후 생성)
    └── result_chunks.csv            # 타임스탬프 청크 CSV (실행 후 생성)
```

## 소스 코드 설명
`whisper-large-v3-turbo.py`는 다음 순서로 동작함

1. `hands-on/05.stt/audio/`에서 지원 오디오 파일 목록 조회 후 첫 번째 파일 선택  
2. `torch.cuda.is_available()` 로 GPU 유무 감지 → GPU: `float16`, CPU: `float32`  
3. `transformers.pipeline("automatic-speech-recognition", ...)` 으로 모델 로드  
   - 최초 실행 시 Hugging Face Hub에서 모델(약 1.6 GB) 자동 다운로드  
4. `pipe(audio_path, return_timestamps=True, ...)` 로 음성 인식 수행  
5. 전체 텍스트 → `result.txt`, 청크 타임스탬프 → `result_chunks.csv` 저장  

## 주요 함수
| 함수 | 역할 |
| --- | --- |
| `detect_device()` | GPU/CPU 감지 및 dtype 결정 |
| `find_first_audio_file()` | 오디오 디렉터리에서 첫 번째 지원 파일 반환 |
| `load_pipeline()` | Whisper ASR 파이프라인 로드 |
| `transcribe()` | 타임스탬프 포함 음성 인식 실행 |
| `save_result_txt()` | 전체 전사 텍스트를 `result.txt`에 저장 |
| `save_result_csv()` | 청크별 타임스탬프를 `result_chunks.csv`에 저장 |

## 생성 파라미터 설명
| 파라미터 | 기본값 | 설명 |
| --- | --- | --- |
| `language` | `korean` | 전사 언어 지정. 생략 시 자동 감지 |
| `task` | `transcribe` | `transcribe`(원어 전사) 또는 `translate`(영어 번역) |
| `chunk_length_s` | `30` | 오디오를 분할하는 청크 길이(초). 메모리와 정확도 트레이드오프 |
| `batch_size` | `8` | 병렬 처리 청크 수. GPU VRAM에 맞게 조정 |
| `return_timestamps` | `True` | 청크별 `(start, end)` 타임스탬프 반환 활성화 |

## 시스템 요구사항
| 항목 | 최소 | 권장 |
| --- | --- | --- |
| Python | 3.10+ | 3.11+ |
| RAM | 8 GB | 16 GB |
| GPU VRAM (선택) | 4 GB | 8 GB 이상 |
| CUDA (GPU 사용 시) | 12.1+ | 12.4+ |
| ffmpeg | 필수 | — |

## GPU/CPU 확인 방법

### NVIDIA GPU 확인
```powershell
nvidia-smi
```
출력 예시:
```
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 550.xx    Driver Version: 550.xx    CUDA Version: 12.4          |
| GPU  Name        Persistence-M | Bus-Id        Disp.A | Volatile Uncorr. |
|   0  RTX 4080            Off  | 00000000:01:00.0  On |                 N/A |
+-----------------------------------------------------------------------------+
```
`CUDA Version: 12.1` 이상이면 GPU 가속 사용 가능

### Python에서 GPU 확인
```python
import torch
print(torch.cuda.is_available())       # True: GPU 사용 가능
print(torch.cuda.get_device_name(0))   # GPU 이름 출력
```

## ffmpeg 설치 방법

### Windows
```powershell
# Chocolatey 사용
choco install ffmpeg

# Winget 사용
winget install Gyan.FFmpeg
```
설치 후 새 터미널에서 `ffmpeg -version` 으로 확인

### macOS
```bash
brew install ffmpeg
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update && sudo apt install -y ffmpeg
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

> **최초 실행 시 관리자 권한 터미널 필수**  
> 모델 다운로드(약 1.6 GB) 시 시스템 캐시 디렉터리(`~/.cache/huggingface`) 쓰기 권한이 필요함  
> Windows: PowerShell을 **관리자 권한으로 실행** 후 아래 명령 수행

### 가상환경 설정 (Windows / PowerShell)
```powershell
cd hands-on\05.stt\whisper
python -m venv venv --system-site-packages
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)
```bash
cd hands-on/05.stt/whisper
python -m venv venv --system-site-packages
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)
```bash
cd hands-on/05.stt/whisper
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

> **macOS / CPU 전용 머신 사용 시**  
> `requirements.txt` 첫 줄의 `--extra-index-url` 라인 제거 후 설치

### 실행
```powershell
python whisper-large-v3-turbo.py
```

## 출력 파일 형식

### result.txt
```text
Whisper STT Result
Generated At: 2026-05-27 10:00:00
Model: openai/whisper-large-v3-turbo
Audio File: phone-with-wife.mp3

## 전사 결과
여보세요? 차 여기 있어요. 어, 지하층 내려왔어요. ...
```

### result_chunks.csv
구분자 `|` 사용, 청크별 시작·종료 타임스탬프 포함

```
#|시작|종료|텍스트
1|0.00s|2.00s|여보세요?
2|2.00s|4.50s|차 여기 있어요.
3|4.50s|7.00s|어, 지하층 내려왔어요.
```

## 지원 오디오 확장자
`.flac`, `.m4a`, `.mp3`, `.mp4`, `.mpeg`, `.mpga`, `.ogg`, `.wav`, `.webm`
