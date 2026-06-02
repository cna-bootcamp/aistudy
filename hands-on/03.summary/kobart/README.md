# KoBART 뉴스 URL 요약 예제

뉴스 기사 URL을 입력받아 KoBART 모델로 한국어 요약문을 생성하는 예제.

## 소스 코드 설명

### summary.py 주요 구성

| 함수 | 역할 |
|------|------|
| `crawl_news(url)` | requests로 HTML 다운로드 후 BeautifulSoup으로 본문 추출 |
| `preprocess(text)` | 공백·특수문자 정리, 연속 공백 제거 |
| `truncate_to_tokens(tokenizer, text, max_tokens)` | BART 최대 입력(1024 토큰) 초과 방지를 위한 truncation |
| `summarize(model, tokenizer, text, device)` | KoBART 모델로 요약 생성 + `▁` 기호 후처리 |
| `main()` | 전체 파이프라인 실행 (크롤링 → 전처리 → 요약 → 저장) |

### 처리 파이프라인

```
URL 입력 → 뉴스 본문 크롤링 → 텍스트 전처리 → 토큰 수 확인
    → KoBART 요약 생성 → ▁ 기호 후처리 → summary.txt 저장
```

### 크롤링 방식

- `requests.get()` + User-Agent 헤더로 차단 방지
- `response.apparent_encoding`으로 한글 인코딩(cp949/euc-kr) 자동 감지
- `<article>` 태그 우선 탐색, 없으면 전체 `<p>` 태그 추출
- `<script>`, `<style>`, `<nav>`, `<header>`, `<footer>`, `<aside>` 제거

### KoBART SentencePiece 후처리

KoBART는 SentencePiece 토크나이저를 사용하여 `tokenizer.decode()` 후  
단어 경계에 `▁` 기호가 남는 이슈가 있음. 아래 후처리로 해결:

```python
decoded.replace("▁", " ").strip()
```

---

## 시스템 요구사항

| 항목 | 최소 | 권장 |
|------|------|------|
| Python | 3.9+ | 3.11+ |
| RAM | 4GB | 8GB+ |
| VRAM (GPU 사용 시) | 2GB | 4GB+ |
| CUDA (GPU 사용 시) | 12.1+ | 12.4+ |
| 디스크 | 2GB (모델 캐시) | 5GB+ |

---

## GPU/CPU 확인 방법

### GPU 확인 (NVIDIA)

```bash
nvidia-smi
```

출력 예시:
```
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 550.54.15    Driver Version: 550.54.15    CUDA Version: 12.4    |
|-------------------------------+----------------------+----------------------+
| GPU  0  NVIDIA GeForce RTX 3080  ...                                        |
+-----------------------------------------------------------------------------+
```

`CUDA Version: 12.1` 이상이면 GPU 가속 사용 가능.

### Python에서 GPU 감지 확인

```python
import torch
print(torch.cuda.is_available())   # True: GPU 사용 가능
print(torch.cuda.get_device_name(0))  # 예: NVIDIA GeForce RTX 3080
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

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\03.summary\kobart
python -m venv venv --system-site-packages
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/03.summary/kobart
python -m venv venv --system-site-packages
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/03.summary/kobart
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 실행

```bash
python summary.py --url https://n.news.naver.com/article/001/0015000000
```

출력 파일: `hands-on/03.summary/kobart/summary.txt`

---

## 생성 파라미터 설명

`model.generate()` 호출 시 사용되는 파라미터:

| 파라미터 | 값 | 설명 |
|----------|----|------|
| `max_length` | 256 | 생성 요약문의 최대 토큰 수 |
| `num_beams` | 4 | Beam Search 후보 수. 클수록 품질↑, 속도↓ |
| `length_penalty` | 2.0 | 긴 요약 선호도. 1.0 초과 시 긴 문장 우대 |
| `early_stopping` | True | Beam Search에서 EOS 토큰 도달 시 조기 종료 |
| `no_repeat_ngram_size` | 3 | 3-gram 반복 생성 방지로 중복 표현 제거 |

### 입력 길이 제한

KoBART(BART 기반)의 최대 입력 토큰은 **1024개**.  
본문이 초과될 경우 앞 1022 토큰(BOS/EOS 2개 제외)만 사용하여 자동 truncation.

---

## 사용 모델

- **모델명**: [gogamza/kobart-summarization](https://huggingface.co/gogamza/kobart-summarization)
- **유형**: BART 기반 한국어 뉴스 요약 특화 모델
- **파라미터 수**: 약 124M (0.1B)
- **라이선스**: MIT
- **학습 데이터**: 한국어 뉴스 기사 (Daumkakao 뉴스 등)
