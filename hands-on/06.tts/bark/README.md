# Bark TTS (Text to Speech with Translation)

Suno Bark 모델을 사용하여 CSV 파일의 대화 텍스트를 번역 후 음성 파일로 변환하는 예제.

## 개요

대화 텍스트 파일을 읽어 선택한 언어로 번역하고, 각 화자별로 다른 목소리를 지정하여 음성 파일 생성.

### 주요 특징

| 특징 | 설명 |
|------|------|
| **자동 번역** | GPT-4o-mini로 13개 언어 번역 |
| **번역 캐싱** | 언어별 번역 결과 파일 저장 후 재사용 |
| **화자별 목소리** | 각 화자에게 독립적인 음성 프리셋 지정 |
| **음성 프리셋** | 언어별 10개 목소리 제공 (남/여 구분) |
| **GPU 가속** | CUDA 지원으로 빠른 생성 |

### 지원 언어

| 번호 | 언어 | 코드 |
|:----:|------|:----:|
| 1 | English | en |
| 2 | Korean | ko |
| 3 | Chinese | zh |
| 4 | Japanese | ja |
| 5 | German | de |
| 6 | French | fr |
| 7 | Spanish | es |
| 8 | Italian | it |
| 9 | Portuguese | pt |
| 10 | Polish | pl |
| 11 | Russian | ru |
| 12 | Hindi | hi |
| 13 | Turkish | tr |

## 프로젝트 구조

```
hands-on/06.tts/
├── text/
│   └── dialog.csv              # 입력 파일 (대화 텍스트)
└── bark/
    ├── tts.py                  # 메인 소스 코드
    ├── requirements.txt        # 의존성 패키지
    ├── result.wav              # 출력 파일 (생성된 음성)
    ├── README.md               # 문서 (현재 파일)
    └── translations/           # 번역 캐시 디렉토리 (자동 생성)
        ├── dialog_en.csv       # 영어 번역 캐시
        ├── dialog_ja.csv       # 일본어 번역 캐시
        └── ...
```

## 소스 코드 설명

### 코드 구조

```
tts.py
│
├── 상수 정의
│   └── SUPPORTED_LANGUAGES        # 지원 언어 목록 (13개)
│
├── 경로 헬퍼
│   ├── find_env_file()            # .env 파일 위치 탐색
│   ├── get_input_path()           # 입력 CSV 경로
│   ├── get_output_path()          # 출력 WAV 경로
│   └── get_cache_path()           # 번역 캐시 파일 경로
│
├── 디바이스 확인
│   └── check_device()             # GPU/CPU 자동 감지
│
├── API 설정
│   └── load_api_key()             # .env에서 OpenAI API 키 로드
│
├── UI 함수
│   ├── select_language()          # 번역 대상 언어 선택 (1-13)
│   ├── select_voice()             # 화자별 목소리 선택 (0-9)
│   └── assign_voices()            # 전체 화자 목소리 할당
│
├── 데이터 처리
│   └── load_dialog()              # CSV 로드 및 화자 목록 추출
│
├── 번역 캐시
│   ├── load_translation_cache()   # 캐시 파일 로드 (dict 반환)
│   └── save_translation_cache()   # 번역 결과 캐시 저장
│
├── 번역
│   └── translate_dialogs()        # GPT-4o-mini로 전체 대화 번역
│
├── 모델
│   ├── load_model()               # Bark 모델 로드
│   └── generate_speech()          # 텍스트 → 음성 변환
│
├── 오디오 처리
│   └── concatenate_audio()        # 세그먼트 연결 (0.2초 무음 삽입)
│
└── 메인
    └── main()                     # 프로그램 진입점
```

### 주요 함수

| 함수 | 설명 |
|------|------|
| `check_device()` | GPU 가용 여부 확인, 디바이스 문자열 반환 |
| `load_api_key()` | .env 파일에서 OPENAI_API_KEY 로드 |
| `select_language()` | 번역 대상 언어 선택 (lang_code, lang_name 반환) |
| `select_voice()` | 화자별 목소리 프리셋 선택 |
| `assign_voices()` | 모든 화자에 목소리 매핑 dict 반환 |
| `load_dialog()` | CSV 로드, 화자 목록 추출 |
| `load_translation_cache()` | 캐시 파일 로드 (없으면 빈 dict) |
| `save_translation_cache()` | 번역 결과 CSV로 저장 |
| `translate_dialogs()` | GPT-4o-mini로 전체 대화 번역, 캐시 활용 |
| `load_model()` | suno/bark 모델 및 프로세서 로드 |
| `generate_speech()` | 텍스트를 numpy 오디오 배열로 변환 |
| `concatenate_audio()` | 세그먼트 사이 0.2초 무음 삽입 후 연결 |

### 처리 흐름

```
[1] GPU/CPU 디바이스 확인
     ↓
[2] .env에서 OpenAI API 키 로드
     ↓
[3] 입력 CSV 파일 로드 (06.tts/text/dialog.csv)
     ↓
[4] 화자 목록 추출 (speaker 컬럼)
     ↓
[5] 번역 대상 언어 선택 (1-13)
     ↓
[6] 번역 캐시 확인
     ├─ 캐시 있음 → 캐시 파일 로드
     └─ 캐시 없음 → GPT-4o-mini로 번역 → 캐시 저장
     ↓
[7] 각 화자별 목소리 선택 (0-9)
     ↓
[8] suno/bark 모델 로드 (최초 실행 시 다운로드 ~5GB)
     ↓
[9] 번역된 텍스트로 음성 생성
     ↓
[10] 세그먼트 연결 (0.2초 무음 삽입)
     ↓
[11] WAV 파일로 저장 (result.wav)
```

### Voice Preset 형식

```
v2/{lang_code}_speaker_{number}

예시:
- v2/ko_speaker_0  → 한국어 화자 0 (남성 계열)
- v2/ko_speaker_5  → 한국어 화자 5 (여성 계열)
- v2/en_speaker_3  → 영어 화자 3 (남성 계열)
```

| 번호 | 대략적 성별 |
|:----:|:----------:|
| 0-4 | 남성 |
| 5-9 | 여성 |

> **Note**: 성별은 대략적이며, 실제 음색은 언어마다 다를 수 있음.

## 시스템 요구사항

| 항목 | 최소 요구사항 | 권장 요구사항 |
|------|:------------:|:------------:|
| **Python** | 3.9 이상 | 3.10 이상 |
| **RAM** | 8GB | 16GB 이상 |
| **GPU VRAM** | - | 8GB 이상 (NVIDIA) |
| **저장공간** | 10GB | 20GB (모델 캐시 포함) |
| **네트워크** | 최초 실행 시 필요 | - |

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

> GPU 미사용 시 CPU로도 동작하나 생성 속도가 크게 느려짐.

## 가상환경 설정 및 실행 방법

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\06.tts\bark
python -m venv venv --system-site-packages
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/06.tts/bark
python -m venv venv --system-site-packages
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/06.tts/bark
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### API 키 설정

`agentic-ai/examples/.env` 파일에 OpenAI API 키 추가:

```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

### 프로그램 실행

> **중요**: 최초 실행 시 suno/bark 모델(약 5GB)을 다운로드함.  
> 모델 캐시 디렉토리 생성을 위해 **관리자 권한 터미널**에서 실행 권장.

#### Windows - 관리자 권한 터미널 실행

1. **Windows Terminal**: 시작 메뉴 검색 → 우클릭 → "관리자 권한으로 실행"
2. **PowerShell**: 시작 메뉴 검색 → 우클릭 → "관리자 권한으로 실행"
3. **CMD**: 시작 메뉴 검색 → 우클릭 → "관리자 권한으로 실행"

```powershell
# 가상환경 활성화 후
python tts.py
```

#### macOS / Linux

```bash
# 일반 사용자로도 실행 가능 (~/.cache/huggingface 에 모델 저장)
python tts.py
```

> 최초 실행 후에는 일반 터미널에서도 실행 가능.

### 실행 예시

```
============================================================
  Bark TTS - Text to Speech Generator with Translation
  (suno/bark + GPT-4o-mini translation)
============================================================
[INFO] GPU detected: NVIDIA GeForce RTX 4090

[INFO] Input : .../06.tts/text/dialog.csv
[INFO] Output: .../06.tts/bark/result.wav
[INFO] OpenAI API connected for translation
[INFO] Found 20 dialog(s) with 2 speaker(s): ['부인', '나']

==================================================
Select Target Language for Translation
==================================================
   1. English (en)
   2. Korean (ko)
   3. Chinese (zh)
   ...
==================================================
Enter number (1-13): 1
[INFO] Selected: English (en)

# 캐시 없는 경우 (최초)
[INFO] Translating to English (20 lines)...
Translating: 100%|████████████| 20/20 [00:12<00:00]
[INFO] 20 new translation(s) completed
[INFO] Translation saved to cache: dialog_en.csv

# 또는 캐시 있는 경우 (재실행)
[INFO] Translation cache found: dialog_en.csv
[INFO] Using cached translation for English

==================================================
Assign Voice to Each Speaker
==================================================

--- Speaker: 부인 ---
Enter number (0-9): 6
[INFO] Selected: v2/en_speaker_6

--- Speaker: 나 ---
Enter number (0-9): 0
[INFO] Selected: v2/en_speaker_0

[INFO] Voice assignments:
  부인 -> v2/en_speaker_6
  나 -> v2/en_speaker_0

[INFO] Loading Bark model (first run may take a while)...
[INFO] Model loaded successfully

[INFO] Generating speech...
Processing: 100%|████████████| 20/20 [02:30<00:00]

[INFO] Concatenating audio segments...

============================================================
[SUCCESS]
============================================================
  Output file : .../06.tts/bark/result.wav
  Duration    : 45.20 sec
  Sample rate : 24000 Hz
  Language    : English (en)
============================================================
```

## 입력/출력 파일

### 입력 파일 (06.tts/text/dialog.csv)

| 컬럼 | 설명 |
|------|------|
| `id` | 순번 |
| `timestamp` | 타임스탬프 |
| `speaker` | 화자 이름 |
| `text` | 발화 텍스트 (원본) |

```csv
id|timestamp|speaker|text
1|00:00|부인|어서 오세요. 차 여기 있어요.
2|00:02|나|어, 지하층 내려왔어요.
```

### 번역 캐시 파일 (bark/translations/dialog_{lang_code}.csv)

언어별 번역 결과 자동 저장.

| 컬럼 | 설명 |
|------|------|
| `id` | 순번 |
| `timestamp` | 타임스탬프 |
| `speaker` | 화자 이름 |
| `text` | 원본 텍스트 |
| `translated_text` | 번역된 텍스트 |

```csv
id|timestamp|speaker|text|translated_text
1|00:00|부인|어서 오세요. 차 여기 있어요.|Welcome. The car is here.
2|00:02|나|어, 지하층 내려왔어요.|Oh, I came down to the basement floor.
```

#### 캐시 삭제 방법

특정 언어 캐시 재생성이 필요한 경우 해당 파일 삭제 후 재실행:

```bash
# 영어 캐시 삭제
rm hands-on/06.tts/bark/translations/dialog_en.csv

# 전체 캐시 삭제
rm -rf hands-on/06.tts/bark/translations/
```

### 출력 파일 (result.wav)

| 항목 | 값 |
|------|-----|
| 형식 | WAV (무손실) |
| 샘플레이트 | 24,000 Hz |
| 채널 | 모노 |

## 생성 파라미터 설명

### Bark 모델 파라미터

| 파라미터 | 값 | 설명 |
|----------|:---:|------|
| `sample_rate` | 24,000 Hz | Bark 모델 기본 샘플레이트 (하드코딩) |
| `do_sample` | True | 샘플링 기반 생성 (다양성 증가) |
| `silence_duration` | 0.2초 | 화자 전환 시 무음 길이 |

### 번역 파라미터

| 파라미터 | 값 | 설명 |
|----------|:---:|------|
| `model` | gpt-4o-mini | 번역 모델 |
| `temperature` | 0.3 | 낮은 값으로 일관된 번역 |
| `max_tokens` | 1,000 | 최대 출력 토큰 |

### Bark 모델 정보

| 항목 | 내용 |
|------|------|
| **모델명** | suno/bark |
| **개발사** | Suno AI |
| **파라미터** | ~300M |
| **라이선스** | MIT |
| **모델 크기** | 약 5GB |

## 주의사항

1. **최초 실행**: 모델 다운로드(약 5GB)에 시간 소요됨
2. **관리자 권한**: 최초 실행 시 모델 캐시 디렉토리 생성을 위해 관리자 권한 필요 (Windows)
3. **GPU 메모리**: GPU 사용 시 최소 8GB VRAM 권장
4. **생성 시간**: CPU 사용 시 텍스트 1줄당 1-3분 소요될 수 있음
5. **API 비용**: 캐시 없는 최초 번역 시에만 OpenAI API 비용 발생
6. **번역 캐시**: `bark/translations/` 디렉토리에 언어별 저장

## 참고 자료

- [Suno Bark - Hugging Face](https://huggingface.co/suno/bark)
- [Bark GitHub Repository](https://github.com/suno-ai/bark)
- [PyTorch Installation](https://pytorch.org/get-started/locally/)
- [Transformers - Bark](https://huggingface.co/docs/transformers/model_doc/bark)
