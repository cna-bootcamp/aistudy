# Docling PDF to Markdown 예제

## 개요
Docling 라이브러리로 PDF를 Markdown으로 변환하는 예제임  
기본 입력은 상위 디렉터리의 `AI GARAGE Proposal.pdf`이고, 기본 출력은 `result.md`임  
OCR, TableFormer ACCURATE, 이미지 추출, 수식/코드 블록 인식 옵션을 함께 사용함  

## 파일 구성
| 파일 | 설명 |
| --- | --- |
| `pdf2md.py` | Docling 기반 PDF to Markdown 변환 스크립트 |
| `result.md` | 변환 결과 Markdown 파일 |
| `images/` | 페이지 전체 이미지와 문서 내 그림/사진 저장 디렉터리 |
| `../AI GARAGE Proposal.pdf` | 기본 입력 PDF 파일 |

## 주요 기능
- easyocr 기반 OCR 사용, 한국어/영어 `ko`, `en` 설정  
- 헤더와 푸터 라벨(`PAGE_HEADER`, `PAGE_FOOTER`) 제외  
- 반복 푸터 문자열(`Copyright`, `All Rights Reserved` 등) 보조 제외  
- TableFormer `ACCURATE` 모드와 `do_cell_matching=True` 사용  
- 수식(`FORMULA`)은 Markdown 수식 블록으로 변환  
- 코드(`CODE`)는 fenced code block으로 변환  
- `generate_page_images=True`로 페이지 전체 이미지 저장  
- `generate_picture_images=True`로 문서 내 그림/사진 저장  
- Markdown 이미지 참조는 `images/image_1.png` 형식의 상대 경로 사용  
- CPU/CUDA/MPS 자동 감지 후 Docling `AcceleratorDevice.AUTO` 사용  

## 소스 코드 설명
`pdf2md.py`는 다음 흐름으로 동작함  

1. `argparse`로 `--input`, `--output`, `--images-dir` 옵션 처리  
2. `docling`, `easyocr`, `hf_xet` 설치 여부 확인  
3. PyTorch 기준 CPU/CUDA/MPS 사용 가능 장치 출력  
4. `PdfPipelineOptions`에서 OCR, 테이블, 이미지, 수식, 코드 옵션 설정  
5. `DocumentConverter`로 PDF 변환 수행  
6. 변환 결과의 페이지 전체 이미지를 `images/page_N.png`로 저장  
7. 문서 항목을 순회하며 헤더/푸터 제외 후 Markdown 생성  
8. 그림/사진 항목을 `images/image_N.png`로 저장하고 Markdown에 상대 경로 삽입  

## 핵심 설정
```python
pipeline_options.do_ocr = True
pipeline_options.ocr_options = EasyOcrOptions(
    lang=["ko", "en"],
    confidence_threshold=0.3,
)

pipeline_options.do_table_structure = True
pipeline_options.table_structure_options = TableStructureOptions(
    mode=TableFormerMode.ACCURATE,
    do_cell_matching=True,
)

pipeline_options.do_formula_enrichment = True
pipeline_options.do_code_enrichment = True
pipeline_options.generate_page_images = True
pipeline_options.generate_picture_images = True
pipeline_options.accelerator_options = AcceleratorOptions(
    num_threads=4,
    device=AcceleratorDevice.AUTO,
)
```

## 주요 함수
| 함수 | 역할 |
| --- | --- |
| `check_required_modules()` | `docling`, `easyocr`, `hf_xet` 설치 여부 확인 |
| `detect_torch_device()` | CPU/CUDA/MPS 사용 가능 장치 감지 |
| `create_pdf_pipeline_options()` | Docling PDF 변환 옵션 생성 |
| `save_page_images()` | `generate_page_images` 결과를 `images/page_N.png`로 저장 |
| `save_picture_image()` | 문서 내 그림/사진을 `images/image_N.png`로 저장 |
| `export_filtered_markdown()` | 헤더/푸터 제외 후 본문 Markdown 생성 |
| `convert_pdf_to_markdown()` | 전체 변환 워크플로우 실행 |

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

## 가상환경 실행 방법
Windows PowerShell 기준 실행 방법임  

```powershell
cd C:\Users\hiond\workspace\aistudy\hands-on\04.pdf\docling
python -m venv .venv --system-site-packages
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install docling easyocr hf_xet
python .\pdf2md.py
```

CMD 기준 가상환경 활성화 명령은 다음과 같음  

```cmd
.\.venv\Scripts\activate.bat
```

macOS/Linux 기준 실행 방법은 다음과 같음  

```bash
cd /path/to/aistudy/hands-on/04.pdf/docling
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install docling easyocr hf_xet
python pdf2md.py
```

GPU가 없으면 CPU로 실행 가능하나 OCR과 TableFormer ACCURATE 처리 시간이 길 수 있음  

## CLI 사용법
기본 실행 시 `..\AI GARAGE Proposal.pdf`를 읽고 `.\result.md`를 생성함  

```powershell
python .\pdf2md.py
```

입력, 출력, 이미지 디렉터리를 직접 지정하는 방법임  

```powershell
python .\pdf2md.py `
  --input "..\AI GARAGE Proposal.pdf" `
  --output ".\result.md" `
  --images-dir ".\images"
```

## 출력 결과
정상 실행 후 생성되는 결과는 다음과 같음  

```text
hands-on/04.pdf/docling/
├── pdf2md.py
├── README.md
├── result.md
└── images/
    ├── page_1.png
    ├── page_2.png
    ├── image_1.png
    └── ...
```

`page_N.png`는 페이지 전체 렌더링 이미지임  
`image_N.png`는 Docling이 그림/사진 항목으로 인식한 개별 이미지임  
Markdown 본문에서는 개별 이미지를 `![캡션](images/image_N.png)` 형식으로 참조함  

## 검증 방법
문법 검사는 다음 명령으로 수행함  

```powershell
python -m py_compile .\pdf2md.py
```

실제 변환 테스트는 다음 명령으로 수행함  

```powershell
python .\pdf2md.py --input "..\AI GARAGE Proposal.pdf" --output ".\result.md"
```

헤더/푸터 잔존 여부 확인 예시는 다음과 같음  

```powershell
rg "Copyright|AI GARAGE Bootcamp 제안서|All Rights Reserved" .\result.md
```

검색 결과가 없으면 반복 푸터가 제거된 상태임  
