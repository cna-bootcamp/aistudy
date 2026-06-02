# PyTorch 설치 (GPU 사용 시)

- [PyTorch 설치 (GPU 사용 시)](#pytorch-설치-gpu-사용-시)
  - [1. 시스템 CUDA 버전 확인](#1-시스템-cuda-버전-확인)
    - [Windows](#windows)
    - [macOS](#macos)
    - [Linux](#linux)
    - [출력 예시 (nvidia-smi)](#출력-예시-nvidia-smi)
  - [2. PyTorch CUDA 버전 선택 기준](#2-pytorch-cuda-버전-선택-기준)
  - [3. PyTorch 설치](#3-pytorch-설치)
    - [Windows / Linux (NVIDIA GPU)](#windows--linux-nvidia-gpu)
    - [macOS (Apple Silicon)](#macos-apple-silicon)
  - [4. 설치 확인](#4-설치-확인)

GPU 사용 시 CUDA 버전에 맞는 PyTorch 선행 설치 필요.

---

## 1. 시스템 CUDA 버전 확인

### Windows

**방법 1: 명령 프롬프트 (CMD) 또는 PowerShell**
```cmd
nvidia-smi
```

**방법 2: NVIDIA 제어판**
1. 바탕화면 우클릭 → "NVIDIA 제어판" 선택
2. 좌측 하단 "시스템 정보" 클릭
3. "CUDA 버전" 확인

### macOS

macOS는 NVIDIA GPU 미지원. Apple Silicon (M1/M2/M3/M4)은 MPS(Metal Performance Shaders) 사용.

```bash
# Apple Silicon 확인
system_profiler SPHardwareDataType | grep "Chip"

# MPS 지원 확인 (PyTorch 설치 후)
python -c "import torch; print(f'MPS available: {torch.backends.mps.is_available()}')"
```

> **Note**: Apple Silicon Mac은 CPU 버전 PyTorch 설치 시 MPS 자동 활성화.

### Linux

```bash
# 방법 1: nvidia-smi (권장)
nvidia-smi

# 방법 2: nvcc (CUDA Toolkit 설치된 경우)
nvcc --version

# 방법 3: GPU 정보 확인
lspci | grep -i nvidia
```

### 출력 예시 (nvidia-smi)

```
+-----------------------------------------------------------------------------------------+
| NVIDIA-SMI 560.94                 Driver Version: 560.94         CUDA Version: 12.6     |
|-----------------------------------------+------------------------+----------------------+
| GPU  Name                  Driver-Model | Bus-Id          Disp.A | Volatile Uncorr. ECC |
|=========================================+========================+======================|
|   0  NVIDIA GeForce RTX 4090       ...  |   00000000:01:00.0  On |                  N/A |
+-----------------------------------------+------------------------+----------------------+
```

우측 상단 `CUDA Version` 확인 (위 예시: **12.6**).

[Top](#pytorch-설치-gpu-사용-시)

---

## 2. PyTorch CUDA 버전 선택 기준

| 시스템 CUDA 버전 | 설치할 PyTorch CUDA 버전 | 설명 |
|:----------------:|:------------------------:|------|
| 12.6 | cu124 | 하위 호환 (권장) |
| 12.4 ~ 12.5 | cu124 | 정확히 일치 또는 하위 버전 |
| 12.1 ~ 12.3 | cu121 | 하위 호환 |
| 11.8 | cu118 | CUDA 11.x 사용자 |
| 없음 | CPU | GPU 미사용 |

> **중요**: PyTorch CUDA 버전은 시스템 CUDA 버전과 **같거나 낮아야** 함.
> 예: 시스템 CUDA 12.6 → PyTorch cu124 (O), cu121 (O), cu126 (X - 아직 미제공)

[Top](#pytorch-설치-gpu-사용-시)

---

## 3. PyTorch 설치

### Windows / Linux (NVIDIA GPU)

```bash
# CUDA 12.4 이상 (CUDA 12.4, 12.5, 12.6 등)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

# CUDA 12.1 ~ 12.3
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# CUDA 11.8
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# CPU 전용 (GPU 미보유 시)
pip install torch torchvision torchaudio
```

### macOS (Apple Silicon)

```bash
# Apple Silicon (M1/M2/M3/M4) - MPS 자동 활성화
pip install torch torchvision torchaudio
```

> **Note**: macOS에서는 별도 CUDA 설정 없이 CPU 버전 설치 시 MPS 자동 활성화.

[Top](#pytorch-설치-gpu-사용-시)

---

## 4. 설치 확인

```bash
python -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA available: {torch.cuda.is_available()}'); print(f'CUDA version: {torch.version.cuda}')"
```

출력 예시:
```
PyTorch: 2.6.0+cu124
CUDA available: True
CUDA version: 12.4
```

> **Note**: 최신 설치 명령어는 https://pytorch.org/get-started/locally/ 에서 확인.

[Top](#pytorch-설치-gpu-사용-시)
