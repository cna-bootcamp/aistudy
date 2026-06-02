# PyMuPDF PDF to Markdown 예제

## 개요

`pdf2md.py`는 PyMuPDF의 `fitz` 모듈을 사용하여 PDF 문서를 Markdown 파일로 변환하는 예제임.

기본 실행 시 상위 디렉터리의 `AI GARAGE Proposal.pdf`를 읽고, 현재 예제 디렉터리에 `result.md`를 생성함.

## 파일 구조

```text
hands-on/04.pdf/
├── AI GARAGE Proposal.pdf
└── PyMuPDF/
    ├── pdf2md.py
    ├── requirements.txt
    ├── README.md
    └── result.md
```

## 소스 코드 설명

`pdf2md.py`의 주요 흐름은 다음과 같음.

1. `argparse`로 `--input`, `--output` CLI 옵션 처리
2. PyMuPDF `fitz.open()`으로 PDF 열기
3. `page.get_text("dict", sort=True)`로 텍스트 라인, 좌표, 글자 크기 추출
4. 페이지 상단/하단 영역에서 반복되는 텍스트를 감지하여 헤더와 푸터 제외
5. 글자 크기와 섹션 번호 패턴을 기준으로 Markdown 제목 변환
6. 변환 결과를 UTF-8 인코딩의 Markdown 파일로 저장

헤더/푸터 제거는 페이지 번호처럼 숫자만 달라지는 문자열도 같은 반복 텍스트로 인식하도록 처리함.

## 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\04.pdf\PyMuPDF
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/04.pdf/PyMuPDF
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
```

## 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/04.pdf/PyMuPDF
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 실행 방법

```bash
# 기본 실행 (../AI GARAGE Proposal.pdf → ./result.md)
python pdf2md.py

# 경로 직접 지정
python pdf2md.py --input "../AI GARAGE Proposal.pdf" --output ./result.md
```

## CLI 옵션

| 옵션 | 설명 | 기본값 |
| --- | --- | --- |
| `--input` | 입력 PDF 파일 경로 | `../AI GARAGE Proposal.pdf` |
| `--output` | 출력 Markdown 파일 경로 | `./result.md` |

## PyTorch 및 GPU 안내

이 예제는 PyMuPDF 기반의 PDF 텍스트 추출 예제이므로 PyTorch가 필요하지 않음.

GPU도 사용하지 않음. 다만 다른 예제에서 GPU 기반 PyTorch가 필요한 경우 CUDA 12.1 이상을 기준으로  
공식 PyTorch 다운로드 명령을 확인하여 설치하는 것을 원칙으로 함.

## 실행 결과

정상 실행 시 `result.md` 파일이 생성됨.

생성된 Markdown에는 반복 헤더와 푸터를 제외한 PDF 본문 텍스트가 포함됨.
