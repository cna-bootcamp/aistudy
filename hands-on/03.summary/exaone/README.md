# EXAONE-4.0-1.2B 텍스트 요약 예제

## 개요
LG AI Research의 **EXAONE-4.0-1.2B** 모델을 사용해 마크다운 문서를 요약하는 예제임.  
EXAONE 4.0은 Instruction-tuned 모델로, Base/Instruct 구분 없이 단일 모델로 제공됨.

| 항목 | 내용 |
|------|------|
| 모델명 | EXAONE-4.0-1.2B |
| 개발사 | LG AI Research |
| 파라미터 | 1.2B (12억 개) |
| 특징 | 한국어/영어 이중언어 지원, Instruction-tuned |
| Hugging Face | [LGAI-EXAONE/EXAONE-4.0-1.2B](https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-1.2B) |

## 파일 구조
```
hands-on/03.summary/exaone/
├── result_Docling.md    # 입력 파일 (요약 대상 마크다운)
├── summary.py           # 요약 실행 스크립트
├── summary.txt          # 출력 파일 (요약 결과, 실행 후 생성)
└── README.md            # 본 문서
```

## 소스 코드 설명

### summary.py 주요 함수

| 함수 | 역할 |
|------|------|
| `load_input_file(input_path)` | 마크다운 파일 읽기. UTF-8/CP949/EUC-KR/Latin-1 순차 시도하여 한글 호환성 확보 |
| `save_output_file(output_path, content)` | 요약 결과를 UTF-8 인코딩으로 파일 저장 |
| `create_summary_prompt(text)` | 구조화된 요약 요청(회사 개요, 핵심 가치, 수행 실적 등) 프롬프트 생성 |
| `summarize_text(model, tokenizer, text)` | EXAONE 모델로 텍스트 요약 수행 |
| `main()` | 입력 → 모델 로드 → 요약 → 저장의 메인 워크플로우 실행 |

### 핵심 코드
```python
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

# 모델 로드 (dtype 사용, torch_dtype은 deprecated)
model_id = "LGAI-EXAONE/EXAONE-4.0-1.2B"
tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    dtype=torch.float16,   # GPU 사용 시 (CPU는 torch.float32)
    device_map="auto",
    trust_remote_code=True,
)

# Chat 템플릿 적용 (reasoning 모드 비활성화)
messages = [{"role": "user", "content": prompt}]
formatted_prompt = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
    enable_thinking=False,   # reasoning 모드 비활성화 (빠른 응답)
)

# 토큰화 (attention_mask 명시적 전달)
model_inputs = tokenizer(
    formatted_prompt,
    return_tensors="pt",
    return_attention_mask=True,
).to(model.device)

# 생성
generated_ids = model.generate(
    model_inputs.input_ids,
    attention_mask=model_inputs.attention_mask,
    max_new_tokens=4096,
    do_sample=True,
    temperature=0.1,            # 한국어 요약 권장값
    top_k=50,
    top_p=0.95,
    pad_token_id=tokenizer.eos_token_id,
    repetition_penalty=1.1,
)
```

## GPU/CPU 확인 방법

### 1) nvidia-smi 로 GPU 가용성 확인
`smi`는 **S**ystem **M**anagement **I**nterface의 약자임.
```bash
nvidia-smi
```
- 결과 출력 → NVIDIA GPU 사용 가능 → PyTorch GPU(CUDA 12.1+) 버전 설치
- "명령을 찾을 수 없습니다" / 인식 안 됨 → GPU 사용 불가 → PyTorch CPU 버전 설치

### 2) Python에서 PyTorch CUDA 인식 확인
```bash
python -c "import torch; print('CUDA available:', torch.cuda.is_available()); print('Device:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')"
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

### 1. 가상환경 생성
```bash
# Windows (PowerShell / CMD)
cd hands-on/03.summary/exaone
python -m venv venv --system-site-packages
venv\Scripts\activate

# Windows (Git Bash)
cd hands-on/03.summary/exaone
python -m venv venv --system-site-packages
source venv/Scripts/activate

# macOS / Linux
cd hands-on/03.summary/exaone
python -m venv venv
source venv/bin/activate
```

### 2. 패키지 설치

**[선택 1] GPU (CUDA 12.1 이상) 보유 시**
```bash
# PyTorch CUDA 12.1 빌드 먼저 설치
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
# 나머지 의존성 설치
pip install "transformers>=4.54.0" accelerate sentencepiece
```

**[선택 2] CPU 전용**
```bash
pip install -r requirements.txt
```

### 3. 실행
```bash
python summary.py
```

### 4. 결과 확인
```bash
# Windows
type summary.txt
# macOS / Linux
cat summary.txt
```

## 시스템 요구사항

| 항목 | 최소 사양 | 권장 사양 |
|------|----------|----------|
| Python | 3.10+ | 3.11+ |
| transformers | 4.54.0+ | 최신 |
| CUDA (GPU 사용 시) | 12.1+ | 12.1+ |
| RAM | 8 GB | 16 GB |
| GPU VRAM | 4 GB (float16) | 8 GB 이상 |
| 저장공간 | 10 GB | 20 GB (모델 캐시 포함) |

> GPU 미보유 시 CPU로도 실행 가능하나 처리 속도가 매우 느림(수 분~수십 분 소요).

## 생성 파라미터 설명

| 파라미터 | 값 | 설명 |
|---------|-----|------|
| `max_new_tokens` | 4096 | 생성할 최대 토큰 수 (긴 한국어 요약 대응) |
| `do_sample` | True | 확률적 샘플링 사용 (다양성 확보) |
| `temperature` | 0.1 | 출력 다양성 조절. 낮을수록 일관성↑. 한국어 요약 권장값(한·영 섞임 방지) |
| `top_k` | 50 | 상위 k개 토큰 중에서 샘플링 |
| `top_p` | 0.95 | 누적 확률 95% 이내 토큰만 고려 (nucleus sampling) |
| `repetition_penalty` | 1.1 | 반복 문장 억제 페널티 |
| `pad_token_id` | `eos_token_id` | 패딩 토큰을 EOS로 지정 |
| `enable_thinking` | False | reasoning 모드 비활성화 (빠른 응답, 단순 요약 목적) |
| `attention_mask` | 명시적 전달 | 패딩 영역 무시, 정확한 어텐션 계산 보장 |

## 주의사항
1. **첫 실행 시 모델 다운로드**: 약 2.5 GB 다운로드(허깅페이스 캐시: `~/.cache/huggingface`).
2. **`torch_dtype` 사용 금지**: deprecated되어 `dtype` 파라미터를 사용해야 함.
3. **`trust_remote_code=True` 필요**: EXAONE은 커스텀 모델 코드 포함.
4. **`enable_thinking=False` 필수**: reasoning 모드 활성 시 응답 시간이 크게 증가하며, 본 예제와 출력 형식이 달라질 수 있음.

## 참고 자료
- [Hugging Face Transformers 공식 문서](https://huggingface.co/docs/transformers)
- [EXAONE-4.0-1.2B Hugging Face 페이지](https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-1.2B)
- [LG AI Research](https://www.lgresearch.ai/)
- [PyTorch CUDA 설치 가이드](https://pytorch.org/get-started/locally/)
