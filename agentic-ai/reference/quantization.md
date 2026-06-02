# 양자화 (Quantization)

- [양자화 (Quantization)](#양자화-quantization)
  - [핵심 개념](#핵심-개념)
    - [정밀도별 메모리 사용량](#정밀도별-메모리-사용량)
    - [모델 크기별 VRAM 사용량](#모델-크기별-vram-사용량)
  - [양자화 기법 비교](#양자화-기법-비교)
  - [사용 방법](#사용-방법)
    - [1. bitsandbytes (가장 간편)](#1-bitsandbytes-가장-간편)
      - [8-bit 양자화](#8-bit-양자화)
      - [4-bit 양자화 (NF4)](#4-bit-양자화-nf4)
    - [2. GPTQ (사전 양자화 모델)](#2-gptq-사전-양자화-모델)
    - [3. AWQ (최신, 가장 빠름)](#3-awq-최신-가장-빠름)
  - [GPU별 권장 설정](#gpu별-권장-설정)
    - [RTX 4090 (24GB)](#rtx-4090-24gb)
    - [RTX 4090 Laptop (16GB)](#rtx-4090-laptop-16gb)
    - [RTX 3080/3090 (10GB/24GB)](#rtx-30803090-10gb24gb)
  - [CPU Offload (대형 모델용)](#cpu-offload-대형-모델용)
  - [속도 vs 메모리 트레이드오프](#속도-vs-메모리-트레이드오프)
  - [양자화 선택 가이드](#양자화-선택-가이드)
  - [비유로 이해하기](#비유로-이해하기)
  - [자주 묻는 질문](#자주-묻는-질문)
    - [Q: 양자화 시 속도 향상 여부?](#q-양자화-시-속도-향상-여부)
    - [Q: 8-bit vs 4-bit 선택 기준?](#q-8-bit-vs-4-bit-선택-기준)
    - [Q: 품질 손실 우려](#q-품질-손실-우려)
  - [참고 자료](#참고-자료)


모델의 숫자 정밀도를 낮춰 메모리 사용량을 줄이는 기법.

---

## 핵심 개념

### 정밀도별 메모리 사용량

| 정밀도 | 비트 수 | 숫자당 메모리 | 표현 예시 |
|--------|---------|---------------|-----------|
| FP32 | 32bit | 4 bytes | 3.141592653589793 |
| FP16/BF16 | 16bit | 2 bytes | 3.14159 |
| INT8 | 8bit | 1 byte | 3.14 |
| INT4 | 4bit | 0.5 byte | 3.1 |

### 모델 크기별 VRAM 사용량

| 모델 크기 | FP32 | FP16 | INT8 | INT4 |
|-----------|------|------|------|------|
| 7B | 28GB | 14GB | 7GB | 3.5GB |
| 13B | 52GB | 26GB | 13GB | 6.5GB |
| 70B | 280GB | 140GB | 70GB | 35GB |

> 계산식: `파라미터 수 x 바이트 수 = VRAM`
> 예: 7B x 4 bytes (FP32) = 28GB

[Top](#양자화-quantization)

---

## 양자화 기법 비교

| 기법 | 특징 | 속도 | 품질 손실 | 사용 편의성 |
|------|------|------|-----------|-------------|
| **bitsandbytes** | 동적 양자화, HuggingFace 통합 | 보통 | 낮음 | 매우 쉬움 |
| **GPTQ** | 사전 양자화, 빠른 추론 | 빠름 | 낮음 | 쉬움 |
| **AWQ** | 최신 기법, 최적 성능 | 가장 빠름 | 가장 낮음 | 쉬움 |
| **GGUF** | CPU/GPU 혼합, llama.cpp | 빠름 | 낮음 | 보통 |

[Top](#양자화-quantization)

---

## 사용 방법

### 1. bitsandbytes (가장 간편)

```bash
pip install bitsandbytes accelerate
```

#### 8-bit 양자화

```python
from transformers import AutoModelForCausalLM, BitsAndBytesConfig

quantization_config = BitsAndBytesConfig(
    load_in_8bit=True
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B",
    quantization_config=quantization_config,
    device_map="auto"
)
```

#### 4-bit 양자화 (NF4)

```python
import torch
from transformers import AutoModelForCausalLM, BitsAndBytesConfig

quantization_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",              # normalized float 4 (권장)
    bnb_4bit_compute_dtype=torch.bfloat16,  # 연산 시 정밀도
    bnb_4bit_use_double_quant=True          # 이중 양자화로 추가 압축
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-70B",
    quantization_config=quantization_config,
    device_map="auto"
)
```

### 2. GPTQ (사전 양자화 모델)

```bash
pip install optimum auto-gptq
```

```python
from transformers import AutoModelForCausalLM

# TheBloke 등에서 사전 양자화된 모델 사용
model = AutoModelForCausalLM.from_pretrained(
    "TheBloke/Llama-2-70B-GPTQ",
    device_map="auto"
)
```

### 3. AWQ (최신, 가장 빠름)

```bash
pip install autoawq
```

```python
from transformers import AutoModelForCausalLM

model = AutoModelForCausalLM.from_pretrained(
    "TheBloke/Llama-2-70B-AWQ",
    device_map="auto"
)
```

[Top](#양자화-quantization)

---

## GPU별 권장 설정

### RTX 4090 (24GB)

| 모델 크기 | 권장 설정 | 예상 VRAM |
|-----------|-----------|-----------|
| 7B | FP16 (양자화 불필요) | ~14GB |
| 13B | 8-bit | ~13GB |
| 70B | 4-bit + CPU offload | ~24GB + RAM |

### RTX 4090 Laptop (16GB)

| 모델 크기 | 권장 설정 | 예상 VRAM |
|-----------|-----------|-----------|
| 7B | 8-bit | ~7GB |
| 13B | 4-bit | ~6.5GB |
| 70B | 불가 (RAM offload 필수) | - |

### RTX 3080/3090 (10GB/24GB)

| GPU | 모델 크기 | 권장 설정 |
|-----|-----------|-----------|
| 3080 (10GB) | 7B | 4-bit |
| 3090 (24GB) | 7B | FP16 |
| 3090 (24GB) | 13B | 8-bit |

[Top](#양자화-quantization)

---

## CPU Offload (대형 모델용)

VRAM 부족 시 일부를 CPU RAM으로 이동하는 방법.

```python
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-70B",
    quantization_config=quantization_config,
    device_map="auto",
    offload_folder="offload",
    max_memory={0: "22GiB", "cpu": "50GiB"}  # GPU 0에 22GB, CPU에 50GB
)
```

[Top](#양자화-quantization)

---

## 속도 vs 메모리 트레이드오프

| | 메모리 | 추론 속도 | 품질 |
|--|--------|-----------|------|
| FP16 | 많음 | 가장 빠름 | 최고 |
| INT8 | 절반 | 약간 느림 (~5%) | 거의 동일 |
| INT4 | 1/4 | 느림 (~15%) | 약간 저하 (1~3%) |

> **주의**: 양자화는 "속도 향상"이 아닌 **"메모리 부족 해결"** 목적의 기법.
> VRAM 충분 시 FP16이 가장 빠름.

[Top](#양자화-quantization)

---

## 양자화 선택 가이드

```
VRAM 충분 여부?
    |
    +-- Yes --> FP16 사용 (양자화 불필요)
    |
    +-- No --> 부족 정도?
                |
                +-- 조금 부족 --> INT8 (bitsandbytes)
                |
                +-- 많이 부족 --> INT4 (bitsandbytes NF4)
                |
                +-- 매우 부족 --> AWQ/GPTQ 사전 양자화 모델 + CPU offload
```

[Top](#양자화-quantization)

---

## 비유로 이해하기

양자화는 **사진 압축**과 유사:

| 사진 | LLM |
|------|-----|
| RAW (원본) | FP32 |
| JPEG 고화질 | FP16 |
| JPEG 중화질 | INT8 |
| JPEG 저화질 | INT4 |

최신 양자화 기법(NF4, AWQ)은 "스마트 압축"처럼 **품질 손실 최소화**하며 용량 절감.

[Top](#양자화-quantization)

---

## 자주 묻는 질문

### Q: 양자화 시 속도 향상 여부?

**아니오.** 양자화는 메모리 절감 기법.
- FP16: GPU 네이티브 처리 (최적화)
- INT4: 역양자화 -> 연산 -> 재양자화 오버헤드 발생

VRAM 충분 시 양자화 미적용이 더 빠름.

### Q: 8-bit vs 4-bit 선택 기준?

| 상황 | 권장 |
|------|------|
| VRAM 50% 이상 여유 | 양자화 불필요 |
| VRAM 약간 부족 | 8-bit |
| VRAM 많이 부족 | 4-bit |
| 70B+ 대형 모델 | 4-bit 필수 |

### Q: 품질 손실 우려

최신 양자화 기법(NF4, AWQ) 벤치마크 기준 1~3% 정도 성능 저하.
일반적 사용에서는 체감 어려운 수준.

[Top](#양자화-quantization)

---

## 참고 자료

- [bitsandbytes GitHub](https://github.com/TimDettmers/bitsandbytes)
- [HuggingFace Quantization Docs](https://huggingface.co/docs/transformers/quantization)
- [GPTQ Paper](https://arxiv.org/abs/2210.17323)
- [AWQ Paper](https://arxiv.org/abs/2306.00978)
- [TheBloke HuggingFace](https://huggingface.co/TheBloke) - 사전 양자화 모델

[Top](#양자화-quantization)
