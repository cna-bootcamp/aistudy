# Whisper + pyannote 화자 분리 (Speaker Diarization)

OpenAI **whisper-large-v3-turbo** 로 음성을 텍스트로 변환하고,  
**pyannote/speaker-diarization-3.1** 로 화자를 구분하는 예제

---

## 소스 코드 설명

```
diarization/
├── diarization.py      # 메인 스크립트
├── requirements.txt    # 의존성 패키지
├── result.txt          # 실행 후 생성 — 화자 분리 대화록
└── result_chunks.csv   # 실행 후 생성 — 타임스탬프별 CSV
```

### 처리 흐름

```
오디오 파일
    ↓ librosa.load (16 kHz mono)
    ├─→ [Whisper] chunk 단위 STT → (timestamp, text) 청크 목록
    └─→ [pyannote] 화자 분리 → (start, end, speaker) 세그먼트 목록
                ↓
        midpoint 기반 병합
                ↓
        result.txt  /  result_chunks.csv
```

### 주요 함수

| 함수 | 역할 |
|------|------|
| `load_audio()` | librosa로 MP3/WAV 로드 → numpy 배열 + torch 텐서 반환 |
| `load_whisper()` | `whisper-large-v3-turbo` 모델 로드 |
| `transcribe()` | Whisper pipeline으로 STT 수행 (청크 타임스탬프 포함) |
| `diarize()` | pyannote pipeline으로 화자 분리 수행 |
| `merge_results()` | Whisper 청크의 midpoint로 화자 세그먼트 룩업 후 병합 |
| `save_results()` | result.txt + result_chunks.csv 저장 |

### 출력 파일

**result.txt** — 읽기 쉬운 대화록

```
[00:00] 화자A: 여보세요?
[00:03] 화자B: 어, 내려왔어요.
```

**result_chunks.csv** — 구분자 `|`, pandas 저장

```
id|timestamp|start_sec|end_sec|speaker|text
1|00:00|0.0|2.5|화자A|여보세요?
2|00:03|3.1|5.8|화자B|어, 내려왔어요.
```

---

## 시스템 요구사항

| 항목 | 최소 | 권장 |
|------|------|------|
| Python | 3.10+ | 3.11+ |
| RAM | 8 GB | 16 GB |
| GPU VRAM | — | 8 GB+ (CUDA 12.1+) |
| 디스크 | 5 GB | 10 GB (모델 캐시) |
| OS | Windows 10 / macOS 12 / Ubuntu 20.04 | — |

---

## GPU / CPU 확인 방법

### NVIDIA GPU 확인

```bash
nvidia-smi
```

출력 예시:

```
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 535.104  Driver Version: 535.104  CUDA Version: 12.2            |
+-----------------------------------------------------------------------------+
| GPU  0  NVIDIA GeForce RTX 3080  ...
```

- **CUDA Version 12.1 이상**이면 GPU 가속 사용 가능
- `nvidia-smi` 명령이 없거나 오류 발생 시 CPU 모드로 동작 (속도 느림)

### Python에서 GPU 확인

```python
import torch
print(torch.cuda.is_available())   # True = GPU 사용 가능
print(torch.cuda.get_device_name(0))
```

---

## ffmpeg 설치 방법

pyannote.audio 내부에서 오디오 변환에 ffmpeg가 필요합니다.

### Windows

```powershell
# winget 사용
winget install Gyan.FFmpeg

# 또는 choco 사용
choco install ffmpeg
```

설치 후 터미널 재시작 후 확인:

```powershell
ffmpeg -version
```

### macOS

```bash
brew install ffmpeg
```

### Linux (Ubuntu / Debian)

```bash
sudo apt update && sudo apt install -y ffmpeg
```

---

## 사전 준비: HuggingFace 토큰 및 모델 약관 수락

pyannote 모델은 HuggingFace 계정 로그인 + 약관 수락이 필요합니다.

1. [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) 에서 **Read** 토큰 발급
2. 아래 두 모델 페이지에서 **약관 수락 (Accept)**:
   - [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
   - [pyannote/segmentation-3.0](https://huggingface.co/pyannote/segmentation-3.0)
3. `hands-on/.env` 파일에 토큰 추가:

```env
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx
```

---

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

> **중요**: 최초 실행 시 모델 다운로드가 필요합니다.  
> **관리자 권한의 터미널**에서 실행하세요 (Windows: PowerShell 우클릭 → "관리자 권한으로 실행").

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\05.stt\diarization
python -m venv venv --system-site-packages
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/05.stt/diarization
python -m venv venv --system-site-packages
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/05.stt/diarization
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 실행 방법

### 기본 실행 (audio 디렉터리 첫 번째 파일 자동 선택)

```bash
python diarization.py
```

실행 중 화자 수 입력 프롬프트가 나타납니다:

```
화자 수를 입력하세요 (Enter=자동 감지): 2
```

### 파라미터 지정 실행

```bash
# 화자 수 2명으로 지정
python diarization.py --num-speakers 2

# 입력 파일 직접 지정
python diarization.py --input ../audio/phone-with-wife.mp3 --num-speakers 2

# 출력 디렉터리 지정
python diarization.py --num-speakers 2 --output-dir ./output
```

---

## 생성 파라미터 설명

### Whisper 파라미터

| 파라미터 | 값 | 설명 |
|----------|----|------|
| `language` | `"ko"` | 음성 언어 (한국어 고정) |
| `task` | `"transcribe"` | 전사 모드 (translate 선택 시 영어로 번역) |
| `chunk_length_s` | `30` | 청크 단위 길이 (초). 긴 오디오를 30초씩 분할 처리 |
| `batch_size` | `16` | GPU 병렬 처리 배치 크기 |
| `max_new_tokens` | `448` | 청크당 최대 생성 토큰 수 (turbo 모델 권장값) |
| `num_beams` | `1` | Greedy 디코딩 (beam=1). 속도 최우선 |
| `condition_on_prev_tokens` | `False` | 이전 청크 조건 비사용. 청크 독립 처리 |
| `compression_ratio_threshold` | `1.35` | 반복 텍스트 감지 임계값 |
| `temperature` | `(0.0~1.0)` | 폴백 온도 스케줄. 낮을수록 결정론적 |
| `logprob_threshold` | `-1.0` | 로그 확률 임계값. 이하 시 폴백 |
| `no_speech_threshold` | `0.6` | 무음 감지 임계값. 이상이면 빈 텍스트 반환 |

### pyannote 파라미터

| 파라미터 | 값 | 설명 |
|----------|----|------|
| `num_speakers` | 정수 or None | 화자 수. None이면 자동 감지 |
| `min_speakers` | 정수 (코드 미사용) | 최소 화자 수 범위 지정 시 사용 가능 |
| `max_speakers` | 정수 (코드 미사용) | 최대 화자 수 범위 지정 시 사용 가능 |

### 병합 파라미터

| 항목 | 설명 |
|------|------|
| midpoint lookup | Whisper 청크의 `(start+end)/2` 지점이 속한 pyannote 세그먼트로 화자 배정 |
| nearest fallback | midpoint가 어느 세그먼트에도 속하지 않으면 중심점이 가장 가까운 세그먼트 선택 |
| 화자 라벨 | `SPEAKER_00` → `화자A`, `SPEAKER_01` → `화자B` (등장 순서 기준) |
