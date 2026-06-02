# Coqui XTTS v2 — Voice Cloning TTS

XTTS v2 모델을 사용한 다국어 음성 복제(Voice Cloning) 예제.  
참조 음성에서 화자 특성을 추출하여 한국어 텍스트를 해당 음색으로 합성함.

> ⚠️ **라이선스 경고**: XTTS v2는 [CPML(Coqui Public Model License)](https://coqui.ai/cpml) 라이선스 적용.  
> **비상업 연구 목적 전용** — 상업적 배포, 제품 내 탑재, 판매 금지.

> ℹ️ **유지보수 상태**: [coqui-ai/TTS](https://github.com/coqui-ai/TTS) 저장소는 2024년 아카이브됨.  
> `pip install TTS` 설치는 가능하나 신규 업데이트 없음.  
> 대안: [idiap/coqui-ai-TTS](https://github.com/idiap/coqui-ai-TTS) (커뮤니티 포크)

---

## 음성 복제 흐름

```
참조 음성 (WAV / MP3 / M4A / AAC / OGG / FLAC 등)
     ↓  (WAV 외 포맷은 ffmpeg로 자동 변환)
XTTS v2 음성 인코더 → 화자 임베딩 (256-dim latent)
     ↓
텍스트 입력 (한국어) → 텍스트 인코더 + 언어 임베딩
     ↓
자기회귀 디코더 (GPT-2 기반) → 음향 토큰 생성
     ↓
HiFi-GAN 보코더 → 파형 합성 (24000 Hz)
     ↓
result.wav (16-bit PCM, 24000 Hz)
```

- **언어 코드**: `"ko"` (한국어) — 번역 없이 직접 처리
- **참조 음성과 출력 언어는 달라도 무방** (Cross-lingual voice cloning)

---

## 시스템 요구사항

| 항목 | 최소 | 권장 |
|------|------|------|
| GPU VRAM | 4 GB | 8 GB 이상 |
| RAM | 8 GB | 16 GB 이상 |
| 디스크 | 5 GB 여유 | (모델 ~1.8 GB + 의존성) |
| CUDA | 11.8 이상 | 12.4 / 12.6 |

CPU 실행도 가능하나 속도가 매우 느림 (1문장당 30초 이상 소요 가능).

---

## PyTorch 설치

> 설치 전 `nvidia-smi`로 CUDA 버전 확인 필요.

현재 작업 머신: **NVIDIA RTX 4090 / CUDA Driver 12.6**

```powershell
# CUDA 12.6 빌드 (RTX 40 시리즈 권장)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126

# 또는 CUDA 12.4 빌드
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
```

상세 설치 가이드: <https://github.com/cna-bootcamp/aistudy/blob/main/agentic-ai/reference/install-pytorch.md>

---

## 참조 음성 파일 준비

### 권장 사양

| 항목 | 기준 |
|------|------|
| 길이 | **6~30초** (짧으면 품질 저하, 30초 초과 불필요) |
| 화자 수 | **단일 화자** (배경 음악·다중 화자 혼합 금지) |
| 배경 소음 | 최소화 (SNR 20 dB 이상 권장) |
| 포맷 | WAV / MP3 / M4A / AAC / OGG / OPUS / FLAC / WMA / AIFF / WebM / AMR (ffmpeg 자동 변환) |
| 샘플레이트 | 16000 Hz 이상 |

### 배치 방법

```
hands-on/06.tts/coqui-xtts/voices/
├── voice1.wav   ← 화자 A 참조 음성
├── voice2.wav   ← 화자 B 참조 음성
└── voice3.wav   ← 화자 C 참조 음성
```

제공된 샘플 (XTTS v2 공식 레포 제공):
- `voice1.wav` — English speaker sample
- `voice2.wav` — French speaker sample
- `voice3.wav` — German speaker sample

자체 음성을 사용하려면 WAV, MP3, M4A, AAC, OGG, OPUS, FLAC, WMA, AIFF, WebM, AMR 파일을  
`voices/` 디렉토리에 복사하면 됨. WAV 이외 포맷은 ffmpeg가 자동으로 변환하여 처리함.

---

## 가상환경 설정 및 실행

> **Python 버전 주의**: 반드시 **Python 3.12**로 가상환경 생성 필요.  
> - Python 3.13+는 `coqui-tts` 의존성 빌드 미지원  
> - Python 3.14+에서 생성한 venv는 PyTorch 2.9+를 설치하며, coqui-tts가 `torchcodec`을 요구해 실패함  
> - Windows에서 Python 버전이 여러 개라면 `py -3.12`로 명시 필수

> **torch/torchaudio 설치 위치**: `requirements.txt`에 포함되지 않음.  
> venv가 `--system-site-packages`로 생성되므로 **시스템(전역) Python에 설치**해야 함.  
> venv 내부에 설치하면 최신 버전(2.9+)이 설치되어 `torchcodec` 오류 발생.

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\06.tts\coqui-xtts

# 1단계: 시스템 Python에 PyTorch 설치 (최초 1회)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126

# 2단계: Python 3.12로 가상환경 생성 (시스템 패키지 공유)
py -3.12 -m venv venv --system-site-packages
venv\Scripts\Activate.ps1

# 3단계: 나머지 의존성 설치
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / Git Bash)

```bash
cd hands-on/06.tts/coqui-xtts

# 1단계: 시스템 Python에 PyTorch 설치 (최초 1회)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126

# 2단계: Python 3.12로 가상환경 생성
py -3.12 -m venv venv --system-site-packages
source venv/Scripts/activate

# 3단계: 나머지 의존성 설치
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/06.tts/coqui-xtts

# 1단계: 시스템 Python에 PyTorch 설치 (최초 1회)
# macOS (CPU only)
pip3.12 install torch torchvision torchaudio

# Linux (CUDA 12.6)
pip3.12 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126

# 2단계: Python 3.12로 가상환경 생성
python3.12 -m venv venv --system-site-packages
source venv/bin/activate

# 3단계: 나머지 의존성 설치
pip install -r requirements.txt
```

### 실행

```bash
python tts.py
```

**최초 실행 시:**
1. XTTS v2 모델 자동 다운로드 (~1.8 GB) — 네트워크 연결 필요
2. `voices/` 디렉토리의 WAV/M4A 파일 목록 표시
3. 각 화자(`부인`, `나`)에 대해 사용할 참조 음성 선택
4. 선택 결과 `voices/mapping.json` 저장 → 다음 실행 시 재사용 여부 확인 후 변경 가능

**출력**: `result.wav` (16-bit PCM, 24000 Hz)

---

## 음성 복제 품질 향상 팁

1. **참조 음성 길이**: 10~20초가 가장 안정적. 6초 미만이면 품질 저하.
2. **노이즈 제거**: Audacity 등으로 배경 소음 제거 후 사용.
3. **음량 정규화**: -3 dBFS 기준 정규화 권장.
4. **단일 문장 단위**: 긴 문장은 XTTS v2 내부에서 자동 분할됨.
5. **동일 언어 참조**: 한국어 참조 음성 사용 시 자연스러운 억양 획득 가능.
6. **여러 클립 병합**: 같은 화자의 여러 클립을 하나의 WAV로 합쳐 30초 이내로 사용.

---

## 문제 해결

### 모델 다운로드 실패

```
URLError / ConnectionError
```

→ 네트워크 확인. 프록시 환경이면 `HTTP_PROXY` / `HTTPS_PROXY` 환경변수 설정 필요.  
→ 수동 다운로드: HuggingFace `coqui/XTTS-v2` 레포에서 전체 파일 다운로드 후  
  `~/.local/share/tts/tts_models--multilingual--multi-dataset--xtts_v2/` 에 배치.

### CUDA Out of Memory

```
torch.cuda.OutOfMemoryError
```

→ VRAM 부족. CPU 실행으로 전환 (느리지만 가능):

```python
# tts.py 내 device 값을 강제 변경
device = "cpu"
```

또는 `CUDA_VISIBLE_DEVICES=""` 환경변수 설정 후 실행.

### PyTorch weights_only 오류

```
_pickle.UnpicklingError or WeightsOnlyError
```

→ PyTorch 2.6+에서 발생. `tts.py` 상단의 `_torch_load_compat` 패치가 자동으로 처리함.  
패치 적용 여부 확인 후 재실행.

### 참조 음성 오류

```
[Error] Reference voice not found: ...
```

→ `voices/mapping.json` 삭제 후 재실행하여 화자 매핑 재선택.

### TTS 임포트 실패 (Python 3.12)

```
ImportError: cannot import name 'TTS' from 'TTS'
```

→ 커뮤니티 포크 설치:

```bash
pip uninstall TTS
pip install coqui-tts
```

### ACCEPT_TOS 프롬프트가 멈추는 경우

→ `COQUI_TOS_AGREED=1` 환경변수 확인. `tts.py` 상단에 이미 설정되어 있음.

### torchcodec 오류 (Python 3.13+ / PyTorch 2.9+)

```
ImportError: From Pytorch 2.9, the torchcodec library is required...
```

→ venv가 Python 3.13+ 로 생성된 경우 발생. `pyvenv.cfg`의 `home` 경로 확인.  
→ 반드시 **Python 3.12**로 venv 재생성 필요:

```bash
py -3.12 -m venv venv --system-site-packages
```

### transformers 호환성 오류

```
ImportError: cannot import name 'isin_mps_friendly' from 'transformers.pytorch_utils'
```

→ `transformers 4.46+` 에서 해당 함수가 제거됨. coqui-tts 0.27.5의 호환 문제.  
→ venv 내 파일 패치:

```python
# venv/Lib/site-packages/TTS/tts/layers/tortoise/autoregressive.py 12번째 줄 교체
try:
    from transformers.pytorch_utils import isin_mps_friendly as isin
except ImportError:
    def isin(elements, test_elements):
        return torch.isin(elements, test_elements)
```

### M4A / MP3 변환 실패

```
RuntimeError: ffmpeg failed to convert ...
```

→ ffmpeg가 설치되지 않은 경우. 아래 명령어로 설치:

```powershell
winget install ffmpeg
```

또는 <https://ffmpeg.org/download.html> 에서 수동 설치 후 PATH 등록.

---

## 라이선스

| 항목 | 내용 |
|------|------|
| XTTS v2 모델 | [CPML](https://coqui.ai/cpml) — 비상업 연구 목적 전용 |
| Coqui TTS 코드 | Apache 2.0 |
| 참조 음성 샘플 | Coqui XTTS-v2 공식 레포 제공 (CPML) |
| 본 예제 코드 | MIT |

**상업적 활용 금지** — 제품 배포, 서비스 운영, 판매 시 별도 라이선스 계약 필요.
