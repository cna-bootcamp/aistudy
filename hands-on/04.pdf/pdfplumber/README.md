# pdfplumber PDF to Markdown 예제
pdfplumber 라이브러리로 PDF 본문과 표를 추출하여 Markdown 파일로 변환하는 예제임  
기본 입력은 상위 디렉터리의 `AI GARAGE Proposal.pdf`이고, 기본 출력은 현재 디렉터리의 `result.md`임  
결과 파일에는 원본 PDF의 본문만 저장하며, 별도 페이지 제목은 추가하지 않음  

## 파일 구성
| 파일 | 설명 |
| --- | --- |
| `pdf2md.py` | pdfplumber 기반 PDF to Markdown 변환 스크립트 |
| `requirements.txt` | 의존성 패키지 정의 |
| `result.md` | 기본 실행 시 생성되는 Markdown 결과 파일 |
| `../AI GARAGE Proposal.pdf` | 기본 입력 PDF 파일 |

## 소스 코드 설명
`pdf2md.py`는 `argparse`로 CLI 옵션을 처리하고 `pdfplumber.open()`으로 PDF를 읽음  
각 페이지의 상단 7%, 하단 7% 영역에서 반복되는 텍스트를 탐지하여 헤더와 푸터 후보로 제외함  
본문 영역은 `page.crop()`으로 잘라 처리하므로 반복 머리말, 꼬리말보다 본문 추출에 집중 가능함  
출력 Markdown에는 본문 섹션 사이의 구분선만 추가하고, PDF의 헤더/푸터와 임의 페이지 제목은 제외함  

표는 `find_tables()`로 위치를 찾고 `table.extract()` 결과를 Markdown 표 문법으로 변환함  
표 위아래의 텍스트 영역을 별도 crop으로 추출하여 표와 본문이 가능한 한 페이지 순서대로 배치됨  
셀 내부 줄바꿈은 `<br>`로 변환하고, `|` 문자는 Markdown 표가 깨지지 않도록 이스케이프함  

주요 함수는 다음과 같음  
| 함수 | 역할 |
| --- | --- |
| `detect_repeated_edge_lines()` | 여러 페이지의 상단/하단 반복 문구 탐지 |
| `crop_body()` | 헤더/푸터 영역을 제외한 본문 페이지 생성 |
| `table_to_markdown()` | pdfplumber 표 추출 결과를 Markdown 표로 변환 |
| `page_sections_to_markdown()` | 한 페이지의 텍스트와 표를 위에서 아래 순서로 추출 |
| `convert_pdf_to_markdown()` | 입력 PDF를 읽어 출력 Markdown 파일 생성 |

## 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\04.pdf\pdfplumber
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/04.pdf/pdfplumber
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
```

## 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/04.pdf/pdfplumber
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## CLI 사용법
기본 실행 시 `..\AI GARAGE Proposal.pdf`를 읽고 `.\result.md`를 생성함  

```powershell
python .\pdf2md.py
```

입력과 출력을 직접 지정하는 방법임  

```powershell
python .\pdf2md.py --input "..\AI GARAGE Proposal.pdf" --output ".\result.md"
```

## GPU 및 PyTorch 안내
이 예제는 pdfplumber만 사용하는 PDF 처리 예제이며 PyTorch가 필요한 예제가 아님  
따라서 GPU도 사용하지 않음  
다른 예제에서 GPU 기반 PyTorch가 필요한 경우 CUDA 12.1 이상에 맞는 PyTorch 패키지를 다운로드하는 것을 원칙으로 함  

## 검증 방법
문법 검사는 다음 명령으로 수행함  

```powershell
python -m py_compile .\pdf2md.py
```

실제 변환 테스트는 다음 명령으로 수행함  

```powershell
python .\pdf2md.py --input "..\AI GARAGE Proposal.pdf" --output ".\result.md"
```
