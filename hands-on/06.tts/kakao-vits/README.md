# Kakao VITS TTS — Multi-speaker Text-to-Speech

Kakao Enterprise의 `vits-vctk` 모델을 사용한 다중 화자 음성 합성 프로그램.

## 주요 기능

- **사전 설치 체크**: PyTorch, espeak-ng 미설치 시 가이드 출력 후 종료
- **한국어 → 영어 번역**: deep-translator로 자동 번역 (VITS는 영어만 지원)
- **번역 캐싱**: 번역 결과를 CSV 파일로 저장하여 재사용
- **다중 화자**: VCTK 기반 108명 화자 선택 (억양별 그룹화)
- **WAV 출력**: 16-bit PCM, 22050 Hz

---

## 시스템 요구사항

| 항목 | 최소 사양 | 권장 사양 |
|------|----------|----------|
| Python | 3.9+ | 3.10+ |
| RAM | 8 GB | 16 GB+ |
| GPU | — | CUDA 12.1+ 지원 GPU |
| 디스크 | 2 GB | 5 GB+ |

---

## 설치 방법

### 1. PyTorch 설치

> GPU(CUDA) 사용 시 시스템 CUDA 버전에 맞는 PyTorch를 전역 환경에 먼저 설치해야 함  
> 자세한 설치 가이드: [install-pytorch.md](https://github.com/cna-bootcamp/aistudy/blob/main/agentic-ai/reference/install-pytorch.md)

#### 1단계: CUDA 버전 확인

```bash
nvidia-smi
```

#### 2단계: CUDA 버전에 맞는 PyTorch 설치 (전역 환경)

| 시스템 CUDA 버전 | 설치 명령어 |
|:---:|---|
| 12.4 이상 | `pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124` |
| 12.1 ~ 12.3 | `pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121` |
| 11.8 | `pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118` |
| GPU 없음 (CPU) | `pip install torch torchvision torchaudio` |

> macOS (Apple Silicon): `pip install torch torchvision torchaudio` — MPS 자동 활성화

#### 3단계: 설치 확인

```bash
python -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA available: {torch.cuda.is_available()}')"
```

---

### 2. espeak-ng 설치 (필수)

VITS 모델의 음소(phoneme) 변환 엔진. **반드시 사전 설치 필요.**

**Windows:**
1. [espeak-ng 릴리즈 페이지](https://github.com/espeak-ng/espeak-ng/releases)에서 최신 MSI 다운로드
2. `espeak-ng-X.XX-x64.msi` 실행 후 기본 경로(`C:\Program Files\eSpeak NG`)에 설치
3. 설치 후 터미널 재시작

**macOS:**
```bash
brew install espeak-ng
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install espeak-ng
```

---

### 3. 가상환경 설정

#### Windows / PowerShell

```powershell
cd hands-on\06.tts\kakao-vits
python -m venv venv --system-site-packages
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

#### Windows / Git Bash

```bash
cd hands-on/06.tts/kakao-vits
python -m venv venv --system-site-packages
source venv/Scripts/activate
pip install -r requirements.txt
```

#### macOS / Linux

```bash
cd hands-on/06.tts/kakao-vits
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## 실행 방법

> **최초 실행 시**: Hugging Face에서 모델 다운로드 (~500 MB).  
> **Windows는 관리자 권한 터미널**에서 실행 권장.

```bash
python tts.py
```

### 실행 흐름

1. **사전 설치 체크**: PyTorch, espeak-ng 설치 확인. 미설치 시 가이드 출력 후 종료
2. **번역 캐시 로드**: `translations/dialog_en.csv` 존재 시 캐시 사용
3. **화자별 음성 선택**: 억양 그룹별 목소리 목록 표시, 각 화자 선택
4. **번역**: 한국어 텍스트 → 영어 변환 (deep-translator)
5. **음성 생성**: VITS 모델로 각 대사 음성 합성
6. **결과 저장**: `result.wav` 출력

---

## 파일 구조

```
hands-on/06.tts/
├── kakao-vits/
│   ├── tts.py                  # 메인 프로그램
│   ├── requirements.txt        # 의존성 목록
│   ├── README.md               # 이 문서
│   ├── result.wav              # 생성된 음성 (실행 후 생성)
│   └── translations/
│       └── dialog_en.csv       # 영어 번역 캐시
└── text/
    └── dialog.csv              # 입력 대화 파일
```

---

## 소스 코드 설명

### `tts.py` 주요 구성

| 함수 | 역할 |
|------|------|
| `check_prerequisites()` | PyTorch, espeak-ng 설치 여부 확인. 미설치 시 설치 가이드 출력 후 종료 |
| `load_translation_cache()` | `translations/dialog_en.csv`에서 번역 캐시 로드 |
| `save_translation_cache()` | 번역 결과를 캐시 파일로 저장 |
| `translate_to_english()` | deep-translator로 영어 번역. 실패 시 ASCII fallback |
| `display_voice_menu()` | 억양별 그룹화된 화자 목록 표시, 사용자 선택 반환 |
| `sanitize_for_tts()` | 비ASCII 문자 제거, 공백 정규화 (VITS ASCII 전용) |
| `generate_segment()` | VITS 모델로 단일 대사 음성 파형 생성 |
| `make_silence()` | 화자 간 무음 구간 배열 생성 |
| `main()` | 전체 파이프라인 실행 |

### espeak-ng PATH 자동 설정

Windows에서 스크립트 실행 시 `C:\Program Files\eSpeak NG` 경로를 `PATH`와  
`PHONEMIZER_ESPEAK_LIBRARY`에 자동 추가. phonemizer 라이브러리가 espeak-ng를 찾을 수 있도록 설정.

### 번역 처리

VITS 모델은 **영어만 지원**. 입력 텍스트가 비ASCII(한국어 등)이면 deep-translator로  
영어 번역 후 TTS 처리. 번역 실패 시 ASCII 문자만 추출하는 fallback 적용.

---

## 입력 파일 형식

`hands-on/06.tts/text/dialog.csv` — 파이프(`|`) 구분자 사용:

```csv
id|timestamp|speaker|text
1|00:00|부인|어서 오세요. 차 여기 있어요.
2|00:02|나|어, 지하층 내려왔어요.
```

| 컬럼 | 설명 |
|------|------|
| `speaker` | 화자 이름 (음성 할당에 사용) |
| `text` | 발화 텍스트 |

---

## 생성 파라미터

| 파라미터 | 값 | 설명 |
|----------|-----|------|
| 샘플레이트 | 22050 Hz | VITS 모델 기본값 |
| 화자 간 무음 | 0.2초 | 대화 간격 |
| 출력 형식 | WAV (16-bit PCM) | 표준 오디오 형식 |
| 정규화 | 피크 0.95 | 클리핑 방지 |

---

## 번역 캐시

### 파일 구조

`hands-on/06.tts/kakao-vits/translations/dialog_en.csv`:

```csv
original|translated
어서 오세요. 차 여기 있어요.|Welcome. The car is here.
어, 지하층 내려왔어요.|Oh, I came down to the basement.
```

| 컬럼 | 설명 |
|------|------|
| `original` | 원본 텍스트 |
| `translated` | 영어 번역 결과 |

### 캐시 재생성 방법

번역을 새로 수행하려면 캐시 파일 삭제 후 재실행:

```bash
# Windows
del hands-on\06.tts\kakao-vits\translations\dialog_en.csv

# macOS / Linux
rm hands-on/06.tts/kakao-vits/translations/dialog_en.csv
```

---

## VCTK 화자 정보

108명의 화자, 9가지 억양 그룹:

| 억양 | 설명 |
|------|------|
| English | 영국 영어 (London, Manchester, Birmingham 등) |
| Scottish | 스코틀랜드 영어 (Edinburgh, Glasgow 등) |
| Irish | 아일랜드 영어 (Dublin, Cork 등) |
| NorthernIrish | 북아일랜드 영어 (Belfast) |
| Welsh | 웨일스 영어 (Cardiff) |
| American | 미국 영어 (California, New York 등) |
| Canadian | 캐나다 영어 |
| Indian | 인도 영어 |
| SouthAfrican | 남아프리카 영어 |
| NewZealand | 뉴질랜드 영어 |

---

## 문제 해결

### espeak not found

```
espeak-ng: not found
RuntimeError: espeak not installed on your system
```

**해결 방법:**
- espeak-ng 시스템 설치 여부 확인 ([설치 방법](#2-espeak-ng-설치-필수) 참조)
- Windows: 설치 경로가 `C:\Program Files\eSpeak NG`인지 확인
- 설치 후 터미널 재시작

### CUDA 메모리 부족 (OOM)

```
RuntimeError: CUDA out of memory
```

**해결 방법:**
- 다른 GPU 프로세스 종료 후 재실행
- CPU 모드 강제 실행:

```python
# tts.py main() 내 device 라인을 임시 수정
device = torch.device("cpu")
```

### 번역 오류

```
[Translation] deep-translator error: ...
```

**해결 방법:**
- 인터넷 연결 확인
- Google 번역 API 일시 제한 시 잠시 후 재시도
- 캐시 파일이 존재하면 오프라인에서도 재실행 가능

### 모델 다운로드 실패

```
OSError: We couldn't connect to 'https://huggingface.co'
```

**해결 방법:**
- 인터넷 연결 및 방화벽 설정 확인
- Windows: 관리자 권한 터미널에서 재실행
- HuggingFace 접속 가능 여부 확인

### phonemizer import 오류

```
ImportError: cannot import name 'EspeakBackend'
```

**해결 방법:**
- phonemizer 재설치: `pip install --upgrade phonemizer`
- espeak-ng 시스템 패키지 재설치

---

## 참고 자료

- [Kakao VITS 모델 (HuggingFace)](https://huggingface.co/kakao-enterprise/vits-vctk)
- [VCTK 데이터셋](https://huggingface.co/datasets/CSTR-Edinburgh/vctk)
- [VITS 논문](https://arxiv.org/abs/2106.06103)
- [espeak-ng 릴리즈](https://github.com/espeak-ng/espeak-ng/releases)
