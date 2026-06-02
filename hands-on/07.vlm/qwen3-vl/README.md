# Qwen3-VL 이미지 분석 예제

Qwen3-VL 모델을 활용하여 이미지를 분석하고 설명을 생성하는 예제  
외부 API 없이 로컬에서 모델을 실행함

---

## 소스 코드 설명

### `vlm.py`

| 함수 | 역할 |
|------|------|
| `parse_args()` | CLI 인자 파싱 (`--input`, `--prompt`, `--model`, `--max-tokens`, `--device`) |
| `get_image_path()` | CLI 인자 또는 대화형 입력으로 이미지 경로 획득 및 검증 |
| `load_model()` | Qwen3-VL 모델과 프로세서 로드 (GPU/CPU 자동 감지) |
| `analyze_image()` | Qwen3-VL 모델로 이미지 분석 수행 |
| `main()` | 전체 실행 흐름 관리 |

**이미지 처리 방식**  
- PIL로 이미지를 열어 RGB 변환 후 모델에 직접 전달  
- `processor.apply_chat_template()`으로 이미지 + 텍스트 프롬프트 통합 처리  

**지원 이미지 형식**: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.bmp`

**기본 모델**: `Qwen/Qwen3-VL-2B-Instruct`

| 모델 | 파라미터 | 비고 |
|------|----------|------|
| `Qwen/Qwen3-VL-2B-Instruct` | 2B | 기본값, 경량 |
| `Qwen/Qwen3-VL-8B-Instruct` | 8B | 고성능 |
| `Qwen/Qwen3-VL-32B-Instruct` | 32B | 최고 성능, 고사양 필요 |

---

## 시스템 요구사항

| 항목 | 최소 | 권장 |
|------|------|------|
| GPU VRAM | 8GB | 16GB 이상 |
| RAM | 16GB | 32GB 이상 |
| 저장공간 | 10GB (2B 모델) | 20GB 이상 |
| CUDA | 12.1+ | 12.4+ |
| Python | 3.10+ | 3.11+ |

> GPU 미보유 시 CPU로도 실행 가능하나 추론 속도가 매우 느림

---

## PyTorch 설치

> GPU(CUDA) 사용 시 시스템 CUDA 버전에 맞는 PyTorch를 **가상환경 설정 전에** 먼저 설치해야 함  
> 자세한 설치 가이드: [install-pytorch.md](https://github.com/cna-bootcamp/aistudy/blob/main/agentic-ai/reference/install-pytorch.md)

### 1단계: CUDA 버전 확인

```bash
nvidia-smi
```

출력 예시:
```
+-----------------------------------------------------------------------------------------+
| NVIDIA-SMI 560.94        Driver Version: 560.94        CUDA Version: 12.6              |
```

우측 상단 `CUDA Version` 값을 확인 (위 예시: **12.6**)

### 2단계: CUDA 버전에 맞는 PyTorch 설치

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

---

## 가상환경 설정

> **최초 실행 시 관리자 권한 터미널 필요**  
> Windows에서 HuggingFace 모델 캐시 생성 시 심볼릭 링크 권한이 필요함  
> 관리자 권한 없이 실행 시 `OSError: [WinError 1314]` 오류 발생 가능  
> (대안: Windows 설정 → 개발자 모드 활성화 후 일반 터미널에서 실행 가능)

### Windows / PowerShell

```powershell
cd hands-on\07.vlm\qwen3-vl
python -m venv venv --system-site-packages
venv\Scripts\Activate.ps1
pip install --upgrade pip setuptools
# PyTorch를 먼저 설치 (위 CUDA 버전에 맞는 명령어 사용)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
pip install -r requirements.txt
```

### Windows / GitBash

```bash
cd hands-on/07.vlm/qwen3-vl
python -m venv venv --system-site-packages
source venv/Scripts/activate
pip install --upgrade pip setuptools
# PyTorch를 먼저 설치 (위 CUDA 버전에 맞는 명령어 사용)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
pip install -r requirements.txt
```

### macOS / Linux

```bash
cd hands-on/07.vlm/qwen3-vl
python -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools
# PyTorch를 먼저 설치
pip install torch torchvision torchaudio
pip install -r requirements.txt
```

---

## 실행 방법

### 대화형 입력 모드

```bash
python vlm.py
```

실행 후 이미지 파일 경로를 직접 입력:

```
이미지 파일 경로를 입력하세요.
지원 형식: .bmp, .gif, .jpeg, .jpg, .png, .webp
경로> ./your_image.jpg
```

### 파일 경로 직접 지정

```bash
python vlm.py --input ./your_image.jpg
```

### 커스텀 프롬프트 사용

```bash
python vlm.py --input ./your_image.jpg --prompt "이 이미지에서 텍스트를 모두 추출해 주세요."
```

### 모델 변경

```bash
python vlm.py --input ./your_image.jpg --model Qwen/Qwen3-VL-8B-Instruct
```

### GPU 사용 지정

```bash
# GPU(CUDA) 강제 사용
python vlm.py --input ./your_image.jpg --device cuda

# CPU 강제 사용
python vlm.py --input ./your_image.jpg --device cpu
```

### 전체 옵션

```
옵션:
  --input, -i    분석할 이미지 파일 경로
  --prompt, -p   이미지 분석 프롬프트 (기본값: "이 이미지를 자세히 설명해 주세요.")
  --model        사용할 Qwen3-VL 모델 ID (기본값: Qwen/Qwen3-VL-2B-Instruct)
  --max-tokens   최대 생성 토큰 수 (기본값: 512)
  --device       디바이스 선택: auto | cuda | cpu (기본값: auto)
                 auto: GPU 사용 가능 시 자동 선택, 없으면 CPU
                 cuda: GPU 강제 사용 (미지원 환경에서는 CPU로 자동 전환)
                 cpu : CPU 강제 사용
```

### 실행 예시 출력

```
============================================================
Qwen3-VL 이미지 분석 예제
============================================================

이미지: your_image.jpg
프롬프트: 이 이미지를 자세히 설명해 주세요.
모델: Qwen/Qwen3-VL-2B-Instruct
디바이스: auto
============================================================

1. 모델 로드 중...
   - Qwen/Qwen3-VL-2B-Instruct
   - 첫 실행 시 모델 다운로드로 시간이 걸릴 수 있음
   - GPU(CUDA) 사용 가능: 예
   - 사용 디바이스: CUDA
   - 로드 완료!

2. 이미지 분석 중...

============================================================
분석 결과
============================================================
이 이미지는 ...
============================================================
```
