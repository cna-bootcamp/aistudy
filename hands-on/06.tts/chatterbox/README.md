# Chatterbox Multilingual TTS — Voice Cloning

Resemble AI의 Chatterbox 모델을 사용한 다국어 음성 복제(Voice Cloning) 예제.  
참조 음성에서 화자 특성을 추출하여 한국어 텍스트를 해당 음색으로 합성함.

> ✅ **라이선스**: Apache 2.0 — 상업적 사용 가능.

> ⚠️ **Perth 워터마크**: 생성된 모든 음성에 Resemble AI의 Perth 불가청 워터마크가 자동 삽입됨.  
> 음질에 영향 없음. 음성 진위 확인 용도로 사용됨.

---

## 음성 복제 흐름

```
참조 음성 (WAV / MP3 / M4A 등, ~10초)
     ↓  (WAV 외 포맷 → ffmpeg로 voices/ 내 WAV 영구 변환 후 재사용)
ChatterboxMultilingualTTS 음성 인코더 → 화자 특성 추출 (zero-shot)
     ↓
텍스트 입력 (한국어, language_id="ko") → 다국어 T3 텍스트 인코더
     ↓
자기회귀 디코더 → 음향 토큰 생성 (음색 + 언어 정보 결합)
     ↓
보코더 → 파형 합성 (24000 Hz)
     ↓
Perth 워터마크 자동 삽입
     ↓
result.wav (16-bit PCM, 24000 Hz)
```

- **모델**: ChatterboxMultilingualTTS (500M 파라미터)
- **지원 언어**: 23개 — Korean(`ko`), English(`en`), Japanese(`ja`), Chinese(`zh`), French(`fr`), German(`de`) 등
- **번역 불필요**: 한국어 텍스트 직접 처리

---

## 시스템 요구사항

| 항목 | 최소 | 권장 |
|------|------|------|
| GPU VRAM | 4 GB | 8 GB 이상 |
| RAM | 8 GB | 16 GB 이상 |
| 디스크 | 2 GB 여유 | (모델 ~500MB + 의존성) |
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

## ffmpeg 설치

WAV 이외 포맷(M4A, MP3, AAC, OGG 등) 참조 음성 사용 시 ffmpeg 필요.

```powershell
# Windows
winget install ffmpeg
```

```bash
# macOS
brew install ffmpeg

# Linux (Ubuntu/Debian)
sudo apt install ffmpeg
```

상세 설치: <https://ffmpeg.org/download.html>

---

## 참조 음성 파일 준비

### 권장 사양

| 항목 | 기준 |
|------|------|
| 길이 | **~10초** (짧을수록 복제 품질 저하, 30초 이내 권장) |
| 화자 수 | **단일 화자** (다중 화자 혼합 금지) |
| 배경 소음 | 최소화 (SNR 20 dB 이상 권장) |
| 포맷 | WAV / MP3 / M4A / AAC / OGG / OPUS / FLAC / WMA / AIFF / WebM / AMR 등 (ffmpeg 자동 변환) |
| 샘플레이트 | 16000 Hz 이상 |

### 언어 일치 원칙

> **(중요)** 참조 음성 언어와 합성 대상 언어를 일치시킬 것.  
> 한국어 합성 시 한국어 참조 음성 사용 권장 — 불일치 시 억양 혼재(accent bleed) 발생 가능.

크로스 링구얼(언어 불일치) 사용 시 `tts.py` 상단의 `CFG_WEIGHT=0.0` 으로 변경하면 억양 혼재 완화 가능:

```python
CFG_WEIGHT = 0.0   # prevents accent bleed for cross-lingual cloning
```

### 배치 방법

```
hands-on/06.tts/chatterbox/voices/
├── voice1.wav   ← 화자 A 참조 음성 (한국어 권장)
├── voice2.wav   ← 화자 B 참조 음성 (한국어 권장)
└── voice3.wav   ← 화자 C 참조 음성 (한국어 권장)
```

자체 음성을 사용하려면 WAV, MP3, M4A, AAC, OGG, OPUS, FLAC 등 파일을 `voices/` 디렉토리에 복사 후 실행.  
WAV 이외 포맷은 실행 시 `voices/` 디렉토리 내에 WAV로 변환하여 저장한 뒤 학습에 사용함 (이후 실행에서는 변환 생략).  
`voices/mapping.json`이 없으면 실행 시 화자별로 참조 음성 선택 요청.  
매핑 파일이 있으면 현재 매핑을 표시하고 변경 여부를 확인 (`Change mapping? (y/N)`).

---

## 파라미터 튜닝 가이드

### exaggeration (기본값: 0.5)

감정 표현 강도를 제어. 값이 높을수록 표현력 증가.

| 값 | 효과 |
|----|------|
| 0.3 이하 | 차분하고 평온한 어조 |
| 0.5 (기본) | 자연스러운 표현 |
| 0.7 이상 | 강조된 감정 표현 |
| 1.0 | 최대 감정 표현 (과장될 수 있음) |

### cfg_weight (기본값: 0.5)

화자 일관성 제어. 낮을수록 억양 전달 감소.

| 값 | 효과 |
|----|------|
| 0.0 | 억양 전달 억제 (크로스 링구얼 권장) |
| 0.5 (기본) | 화자 특성과 자연스러운 억양 균형 |
| 1.0 | 참조 음성 억양 최대 반영 |

`tts.py` 상단 상수를 수정하거나, 코드 내 `model.generate()` 인자를 직접 변경:

```python
# tts.py 상단에서 조정
EXAGGERATION = 0.5
CFG_WEIGHT   = 0.5
```

---

## 감정 태그 사용법

텍스트에 비언어적 표현 태그를 삽입하여 자연스러운 대화 구현 가능.

| 태그 | 효과 |
|------|------|
| `[laugh]` | 웃음 소리 삽입 |
| `[cough]` | 기침 소리 삽입 |
| `[clears throat]` | 목 가다듬기 |
| `[sighs]` | 한숨 소리 |
| `[chuckle]` | 낮은 웃음 |

`dialog.csv` 텍스트 컬럼에 직접 삽입:

```
1|00:00|부인|어서 오세요 [laugh]. 차 여기 있어요.
```

---

## 가상환경 설정 및 실행

### 가상환경 설정 (Windows / PowerShell)

```powershell
# [Step 1] PyTorch CUDA 빌드를 Python 3.12에 시스템 설치 (미설치 시)
py -3.12 -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126

# [Step 2] Python 3.12 기반 venv 생성 — system-site-packages로 CUDA torch 공유
cd hands-on\06.tts\chatterbox
py -3.12 -m venv venv --system-site-packages
venv\Scripts\Activate.ps1

# [Step 3] pip / setuptools 업그레이드 (빌드 백엔드 오류 방지)
pip install --upgrade pip setuptools

# [Step 4] 나머지 의존성 설치 (torch 제외 — 시스템에서 공유)
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / Git Bash)

```bash
# [Step 1] PyTorch CUDA 빌드를 Python 3.12에 시스템 설치 (미설치 시)
py -3.12 -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126

# [Step 2] Python 3.12 기반 venv 생성
cd hands-on/06.tts/chatterbox
py -3.12 -m venv venv --system-site-packages
source venv/Scripts/activate

# [Step 3] pip / setuptools 업그레이드 (빌드 백엔드 오류 방지)
pip install --upgrade pip setuptools

# [Step 4] 나머지 의존성 설치 (torch 제외 — 시스템에서 공유)
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
# [Step 1] PyTorch 시스템 설치 (미설치 시)
# macOS (CPU only)
python3.12 -m pip install torch torchvision torchaudio
# Linux (CUDA 12.6)
# python3.12 -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126

# [Step 2] Python 3.12 기반 venv 생성
cd hands-on/06.tts/chatterbox
python3.12 -m venv venv --system-site-packages
source venv/bin/activate

# [Step 3] pip / setuptools 업그레이드 (빌드 백엔드 오류 방지)
pip install --upgrade pip setuptools

# [Step 4] 나머지 의존성 설치 (torch 제외 — 시스템에서 공유)
pip install -r requirements.txt
```

### 실행

```bash
python tts.py
```

**최초 실행 시:**

1. ChatterboxMultilingualTTS 모델 자동 다운로드 (~500MB) — 네트워크 연결 필요
2. `voices/` 디렉토리 스캔 — WAV 이외 포맷(M4A, MP3 등)은 자동으로 WAV 변환 후 `voices/` 에 저장
3. 각 화자(`부인`, `나`)에 대해 사용할 참조 음성 선택 (변환 완료된 WAV 파일 목록)
4. 선택 결과 `voices/mapping.json` 저장 → 다음 실행 시 현재 매핑 표시 후 변경 여부 확인

**출력**: `result.wav` (16-bit PCM, 24000 Hz)

---

## 문제 해결

### 의존성 설치 실패 (BackendUnavailable)

```
pip._vendor.pyproject_hooks._impl.BackendUnavailable: Cannot import 'setuptools.build_meta'
```

→ venv의 pip/setuptools가 오래되어 빌드 백엔드를 찾지 못하는 오류.  
→ 의존성 설치 전 아래 명령어로 먼저 업그레이드:

```bash
pip install --upgrade pip setuptools
pip install -r requirements.txt
```

### 모델 다운로드 실패

```
URLError / ConnectionError / huggingface_hub.errors.RepositoryNotFoundError
```

→ 네트워크 확인. 프록시 환경이면 `HTTP_PROXY` / `HTTPS_PROXY` 환경변수 설정 필요.  
→ HuggingFace Hub에서 `resemble-ai/chatterbox` 레포 수동 다운로드 후  
  `~/.cache/huggingface/hub/` 경로에 배치.

### CUDA Out of Memory

```
torch.cuda.OutOfMemoryError: CUDA out of memory
```

→ VRAM 부족. `tts.py` 내 device를 CPU로 강제 전환:

```python
device = "cpu"   # tts.py의 torch.cuda.is_available() 라인 대체
```

또는 환경변수 설정 후 실행:

```bash
CUDA_VISIBLE_DEVICES="" python tts.py
```

### 참조 음성 파일 없음

```
[Error] Reference voice not found: voices/xxx.wav
```

→ `voices/mapping.json` 삭제 후 재실행하여 화자 매핑 재선택.

### chatterbox-tts 임포트 실패 (ml_dtypes 오류)

```
[Error] chatterbox-tts import failed: No module named 'ml_dtypes._ml_dtypes_ext'
```

→ ml_dtypes C 확장 바이너리 손상. 재설치:

```bash
pip install --upgrade --force-reinstall ml_dtypes
```

### CUDA 미감지 — torch CPU 버전 설치됨

```
[Model] Device: cpu   ← GPU가 있음에도 CPU로 실행
```

→ venv가 Python 3.14+로 생성되어 `pip install chatterbox-tts`가 torch CPU 버전을 venv에 설치함.  
→ **Python 3.12로 venv를 재생성**해야 시스템 CUDA torch가 공유됨:

```powershell
# 기존 venv 삭제 후 Python 3.12로 재생성
Remove-Item -Recurse -Force venv
py -3.12 -m venv venv --system-site-packages
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### chatterbox-tts 임포트 실패 (ModuleNotFoundError)

```
ModuleNotFoundError: No module named 'chatterbox'
```

→ 가상환경 활성화 확인 후 재설치:

```bash
pip install chatterbox-tts
```

### 음성 품질 저하 (억양 혼재)

→ 참조 음성과 합성 언어 불일치 가능성.  
→ 한국어 참조 음성으로 교체하거나 `CFG_WEIGHT=0.0` 설정.

### M4A / MP3 변환 실패

```
RuntimeError: ffmpeg failed to convert ...
```

→ ffmpeg가 설치되지 않은 경우. 아래 명령어로 설치:

```powershell
winget install ffmpeg
```

또는 <https://ffmpeg.org/download.html> 에서 수동 설치 후 PATH 등록.

### result.wav 재생 불가

→ `scipy` 버전 확인 (`pip install --upgrade scipy`).  
→ 파일 크기가 0이면 세그먼트 생성 실패 — 오류 로그 확인.

---

## 라이선스

| 항목 | 내용 |
|------|------|
| Chatterbox 모델 | Apache 2.0 — 상업적 사용 가능 |
| Perth 워터마크 | 생성 음성에 자동 삽입 (불가청) |
| 본 예제 코드 | MIT |

**상업적 활용 가능** — Apache 2.0 라이선스 적용.  
단, 생성 음성에는 Perth 불가청 워터마크가 포함됨.
