# OpenVoice V2 — Voice Cloning TTS

MyShell OpenVoice V2를 이용한 음성 복제(Voice Cloning) 한국어 TTS 예제.  
2단계 파이프라인으로 참조 음성의 음색을 한국어 합성 음성에 이식함.

---

## 소스 코드 설명

### 2단계 파이프라인

```
[입력 텍스트] ──► [1단계: MeloTTS]  ──► 기본 KR 음성 (temp WAV)
                                              │
[참조 음성]   ──► [SE 추출]          ──► tgt_se (음색 임베딩)
[kr.pth]      ──────────────────────► src_se (기준 KR 임베딩)
                                              │
                  [2단계: ToneColorConverter] ▼
                                         result.wav (음색 변환 완료)
```

| 단계 | 모델 | 역할 |
|------|------|------|
| 1 | MeloTTS (`language="KR"`, `speaker_key="KR"`) | 한국어 텍스트 → 기본 음성 WAV 합성 |
| 2 | ToneColorConverter | 참조 음성의 음색(tone color)을 합성 음성에 이식 |

### 주요 모듈

| 함수 | 설명 |
|------|------|
| `check_prerequisites()` | PyTorch·OpenVoice·MeloTTS 설치 여부 확인 |
| `download_checkpoints()` | S3에서 V2 체크포인트 자동 다운로드 및 압축 해제 |
| `scan_voices()` | `voices/` 디렉토리의 WAV/MP3 파일 목록 스캔 |
| `load_mapping()` / `save_mapping()` | 화자-참조음성 매핑 JSON 로드/저장 |
| `select_voice_for_speaker()` | 화자별 참조 음성 대화형 선택 UI |
| `load_dialog()` | 파이프(`|`) 구분자 CSV 로드 및 유효성 검사 |
| `main()` | 전체 파이프라인 실행 |

### 파이프라인 흐름

```python
# src_se: checkpoints_v2/base_speakers/ses/kr.pth (OpenVoice V2 기본 제공)
src_se = torch.load("checkpoints_v2/base_speakers/ses/kr.pth")

# tgt_se: 참조 음성에서 음색 임베딩 추출
tgt_se = converter.extract_se([ref_voice_path])

# Stage 1: MeloTTS로 한국어 기본 음성 합성
melo_model.tts_to_file(text, kr_spk_id, tmp_melo.wav, speed=1.0)

# Stage 2: 음색 변환 (src → tgt)
converter.convert(
    audio_src_path=tmp_melo.wav,
    src_se=src_se,
    tgt_se=tgt_se,
    output_path=out.wav,
    message="@MyShell",   # 불가청 워터마크 삽입
)
```

---

## 시스템 요구사항

- **Python**: 3.12 권장 (Windows 기준. 3.13은 `mecab-python3==1.0.9` wheel 없음)
- **GPU**: NVIDIA VRAM 4 GB 이상 권장 (CPU 실행 가능하나 속도 느림)
- **RAM**: 8 GB 이상
- **디스크**: 체크포인트 다운로드용 여유 공간 약 500 MB

---

## PyTorch 설치

> **현재 환경**: CUDA 12.6 (RTX 4090)

CUDA 버전 확인:

```powershell
nvidia-smi
```

설치 가이드: [install-pytorch.md](https://github.com/cna-bootcamp/aistudy/blob/main/agentic-ai/reference/install-pytorch.md)

CUDA 12.6 환경 권장 설치:

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
```

> CUDA 12.6은 `cu124` 빌드와 호환됨.

---

## 설치 순서

### 1. 가상환경 설정

#### Windows / PowerShell
```powershell
cd hands-on\06.tts\openvoice
py -3.12 -m venv venv --system-site-packages
venv\Scripts\Activate.ps1
python --version
```

#### Windows / GitBash
```bash
cd hands-on/06.tts/openvoice
py -3.12 -m venv venv --system-site-packages
source venv/Scripts/activate
python --version
```

#### macOS / Linux
```bash
cd hands-on/06.tts/openvoice
python -m venv venv
source venv/bin/activate
python --version
```

### 2. PyTorch 설치 (CUDA 버전에 맞게)
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
```

### 3. OpenVoice 설치 (순서 중요, `--no-deps` 필수)
```bash
pip install git+https://github.com/myshell-ai/OpenVoice.git --no-deps
pip install git+https://github.com/myshell-ai/MeloTTS.git --no-deps
```

> **Python 3.12 호환성**: `--no-deps` 없이 설치하면 아래 두 가지 오류 발생  
> - OpenVoice: `numpy==1.22.0` 빌드 실패 (Python 3.12 미지원)  
> - MeloTTS: `tokenizers<0.14` Rust 빌드 실패 (Python 3.12 Windows 바이너리 없음)

### 4. MeCab / 일본어 토크나이저 설치

MeloTTS는 한국어 전용으로 실행해도 일본어 모듈을 부팅 시 함께 로드하므로 반드시 설치 필요.

```bash
pip install mecab-python3==1.0.9
pip install fugashi
```

> `mecab-python3==1.0.9`: 번들 MeCab DLL 포함 버전 (Windows 별도 설치 불필요)  
> `fugashi`: 최신 버전으로 설치 (1.3.0 핀 버전은 Python 3.12 Windows 소스 빌드 실패)  
> Python 3.13에서는 `mecab-python3==1.0.9` Windows wheel이 없어 설치 실패.  
> Windows에서는 `py -3.12 -m venv venv`로 Python 3.12 가상환경 생성 필요.  
> **이 두 패키지는 `requirements.txt`에서 제외됨** — `pip install -r requirements.txt` 실행 시 소스 빌드를 시도하여 Python 3.12에서 실패하므로 반드시 이 단계에서 별도 설치

### 5. unidic_lite 사전 설치
```bash
pip install unidic-lite
pip uninstall -y unidic
```

> MeloTTS 일본어 모듈 로드 시 필요한 경량 사전.  
> full `unidic`은 별도 사전 다운로드 전 `dicdir/mecabrc`가 없어 MeCab 초기화 실패 가능.

### 6. 나머지 의존성 설치
```bash
pip install -r requirements.txt
```

---

## 참조 음성 파일 준비

### voices/ 디렉토리 구조
```
hands-on/06.tts/openvoice/voices/
├── voice1.wav    # 화자 A용 참조 음성 (WAV 권장)
├── voice2.mp3    # 화자 B용 참조 음성 (MP3 지원)
└── voice3.m4a    # 화자 C용 참조 음성 (M4A 지원, ffmpeg 필요)
```

### 권장 사양
- **형식**: WAV (권장) / MP3 / M4A / FLAC / OGG / AAC / WMA / OPUS / AIFF / WEBM (ffmpeg 필요)
- **길이**: 6~30초
- **화자**: 단일 화자 (복수 화자 혼합 비권장)

### WAV 외 형식 사용 시 ffmpeg 필요

WAV를 제외한 모든 형식(MP3 / M4A / FLAC / OGG / AAC / WMA / OPUS / AIFF / WEBM 등)은  
**최초 실행 시 `voices/` 디렉토리에 WAV로 변환 저장**되며, 이후 변환된 WAV 파일을 사용함.  
ffmpeg가 PATH에 없으면 변환 단계에서 오류 발생.

#### ffmpeg 설치

```bash
# Windows (PowerShell 관리자 권한)
winget install ffmpeg

# macOS
brew install ffmpeg

# Linux (Ubuntu/Debian)
sudo apt update && sudo apt install ffmpeg
```
- **품질**: 배경 소음 최소화, 16 kHz 이상 샘플링

### 공개 라이선스 샘플 구하기 (LibriSpeech)
```bash
# LibriSpeech test-clean 샘플 (공개 도메인)
# https://www.openslr.org/12  →  test-clean.tar.gz 다운로드 후 flac 파일 사용
# ffmpeg으로 WAV 변환:
ffmpeg -i speaker.flac voices/voice1.wav
```

---

## 체크포인트 다운로드

스크립트 실행 시 **자동 다운로드**됨 (최초 1회, 약 200 MB).

```
https://myshell-public-repo-host.s3.amazonaws.com/openvoice/checkpoints_v2_0417.zip
```

압축 해제 후 디렉토리 구조:

```
checkpoints_v2/
├── converter/
│   ├── config.json
│   └── checkpoint.pth
└── base_speakers/
    └── ses/
        ├── kr.pth          ← 한국어 기본 화자 임베딩
        ├── zh_mix.pth
        ├── en_default.pth
        └── ...
```

수동 다운로드 방법:

```bash
curl -L -o checkpoints_v2.zip \
  "https://myshell-public-repo-host.s3.amazonaws.com/openvoice/checkpoints_v2_0417.zip"
unzip checkpoints_v2.zip -d hands-on/06.tts/openvoice/
```

---

## 실행

```bash
python tts.py
```

최초 실행 시:
1. 체크포인트 자동 다운로드 (약 200 MB)
2. `voices/` 디렉토리 스캔
3. 각 화자별 참조 음성 선택 대화 (매핑 파일 없을 때만)
4. 한국어 음성 합성 + 음색 변환
5. `result.wav` 생성

재실행 시: `voices/mapping.json`이 존재하면 화자 선택 생략.

---

## 입력/출력

| 항목 | 경로 |
|------|------|
| 입력 텍스트 | `hands-on/06.tts/text/dialog.csv` |
| 참조 음성 | `hands-on/06.tts/openvoice/voices/*.wav` |
| 화자 매핑 | `hands-on/06.tts/openvoice/voices/mapping.json` |
| 출력 음성 | `hands-on/06.tts/openvoice/result.wav` |

`dialog.csv` 형식 (파이프 `|` 구분자):

```
id|timestamp|speaker|text
1|00:00|부인|어서 오세요. 차 여기 있어요.
2|00:02|나|어, 지하층 내려왔어요.
```

---

## 라이선스

- **OpenVoice**: MIT License — 상업적 사용 가능
- **MeloTTS**: MIT License — 상업적 사용 가능
- 생성 음성에 `@MyShell` 불가청 워터마크 자동 삽입 (OpenVoice 기본 동작)

---

## 문제 해결

### openvoice / MeloTTS 패키지 없음 오류
```
[Error] Required packages not installed: openvoice, MeloTTS
```
가상환경이 활성화되지 않았거나, OpenVoice·MeloTTS 설치 단계를 건너뛴 경우 발생.

1. 가상환경 활성화 확인:
```bash
# Windows PowerShell
venv\Scripts\Activate.ps1

# Windows GitBash / macOS / Linux
source venv/bin/activate   # (macOS/Linux) 또는 source venv/Scripts/activate (GitBash)
```
2. 활성화 후 순서대로 설치:
```bash
pip install git+https://github.com/myshell-ai/OpenVoice.git --no-deps
pip install git+https://github.com/myshell-ai/MeloTTS.git --no-deps
pip install mecab-python3==1.0.9
pip install fugashi
pip install unidic-lite
pip uninstall -y unidic
pip install -r requirements.txt
```

---

### 체크포인트 다운로드 실패
```
[Error] Checkpoint download failed: ...
```
S3 접속 불가 시 수동으로 zip을 다운로드하여 `openvoice/` 디렉토리에 압축 해제.

### MeCab dicdir/mecabrc 오류
```
[ifs] no such file or directory: ...\unidic\dicdir\mecabrc
```
full `unidic` 패키지만 설치되고 실제 사전 다운로드가 안 된 상태.  
실습에서는 full `unidic` 대신 `unidic_lite` 사용:
```bash
pip uninstall -y unidic
pip install unidic-lite
```

### CUDA Out of Memory
```
RuntimeError: CUDA out of memory
```
- VRAM 4 GB 미만 환경에서 발생 가능  
- CPU 강제 사용: `CUDA_VISIBLE_DEVICES=""` 환경변수 설정 후 실행

### kr.pth 없음 오류
```
[Error] KR source speaker embedding not found
```
`checkpoints_v2/base_speakers/ses/kr.pth` 파일 부재.  
체크포인트 디렉토리 삭제 후 재실행하여 재다운로드.

### numpy 빌드 실패 (Python 3.12, OpenVoice 설치 시)
```
ERROR: Could not build wheels for numpy
```
OpenVoice가 `numpy==1.22.0`을 요구하나 Python 3.12에서 빌드 불가.  
`--no-deps` 옵션으로 설치:
```bash
pip install git+https://github.com/myshell-ai/OpenVoice.git --no-deps
```

### tokenizers Rust 빌드 실패 (Python 3.12, MeloTTS 설치 시)
```
error: can't find Rust compiler
```
MeloTTS가 `tokenizers<0.14`를 요구하나 Python 3.12 Windows 바이너리 없어 소스 빌드 시도 후 실패.  
`--no-deps` 옵션으로 설치:
```bash
pip install git+https://github.com/myshell-ai/MeloTTS.git --no-deps
```

### MeCab 없음 오류 (MeloTTS 로드 시)
```
ImportError: Japanese requires mecab-python3 and unidic-lite.
```
또는:
```
[Error] MeloTTS requires mecab-python3 and fugashi (pre-built wheels, install separately)
```
MeloTTS는 한국어 전용 실행에도 부팅 시 일본어 모듈(`japanese.py`)을 함께 로드하여 MeCab 필요.  
`pip install -r requirements.txt`로 설치 불가 — 소스 빌드 시도로 Python 3.12에서 실패.  
Python 3.13에서는 `mecab-python3==1.0.9` Windows wheel이 없어 `No matching distribution` 오류 발생.  
반드시 별도 설치:
```bash
pip install mecab-python3==1.0.9
pip install fugashi
pip install unidic-lite
pip uninstall -y unidic
```

### fugashi 없음 오류 (MeloTTS 로드 시)
```
ModuleNotFoundError: No module named 'fugashi'
```
`BertJapaneseTokenizer` 사용 시 필요. 핀 버전(1.3.0)은 Python 3.12 Windows 소스 빌드 실패하므로 최신 버전으로 설치:
```bash
pip install fugashi
```

### MeloTTS import 오류 (Windows)
```
ImportError: cannot import name 'TTS' from 'melo.api'
```
`git+` URL로 `--no-deps` 재설치:
```bash
pip uninstall melo -y
pip install git+https://github.com/myshell-ai/MeloTTS.git --no-deps
```

### silero-vad 신뢰 프롬프트 (se_extractor 사용 시)
```
The repository snakers4_silero-vad does not belong to the list of trusted repositories
```
현재 `tts.py`는 짧은 참조 음성 파일에서 `converter.extract_se()`를 직접 호출하므로  
`se_extractor.get_se(..., vad=True)`와 torch hub VAD 다운로드를 사용하지 않음.  
외부 예제에서 `se_extractor`를 직접 사용할 때만 발생 가능.

### pypinyin 없음 오류 (openvoice.text 로드 시)
```
ModuleNotFoundError: No module named 'pypinyin'
```
OpenVoice 중국어 텍스트 처리 모듈(`mandarin.py`)이 사용. `pip install -r requirements.txt`로 설치:
```bash
pip install pypinyin
```

### PyTorch weights_only 오류 (PyTorch 2.6+)
```
_pickle.UnpicklingError: ...
```
`tts.py` 상단의 `_patched_load` 패치가 적용되어 있어 자동 해결됨.  
패치 적용 전 다른 스크립트에서 로드할 경우 동일 패치 적용 필요.
