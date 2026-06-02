# Gemini Vision 이미지 분석 예제

Google Gemini Vision API를 활용하여 이미지를 분석하고 한국어 설명을 생성하는 예제

---

## 소스 코드 설명

### `vlm.py`

| 함수 | 역할 |
|------|------|
| `load_api_key()` | `hands-on/.env`에서 `GEMINI_API_KEY` 로드 |
| `parse_args()` | CLI 인자 파싱 (`--input`, `--prompt`, `--model`, `--max-tokens`) |
| `get_image_path()` | CLI 인자 또는 대화형 입력으로 이미지 경로 획득 및 검증 |
| `analyze_image()` | Gemini Vision API로 이미지 분석 수행 |
| `main()` | 전체 실행 흐름 관리 |

**이미지 전송 방식**  
- **20MB 미만**: `types.Part.from_bytes()` 인라인 데이터 방식  
- **20MB 이상**: `client.files.upload()` File API 업로드 방식  

**지원 이미지 형식**: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.bmp`

**기본 모델**: `gemini-2.5-flash`

---

## 환경 설정

### API 키 설정

`hands-on/.env` 파일에 Gemini API 키가 설정되어 있어야 함:

```env
GEMINI_API_KEY=your_api_key_here
```

> Google AI Studio([aistudio.google.com](https://aistudio.google.com))에서 API 키 발급 가능

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\07.vlm\gemini
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/07.vlm/gemini
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/07.vlm/gemini
python -m venv venv
source venv/bin/activate
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
경로> ./sample.jpg
```

### 파일 경로 직접 지정

```bash
python vlm.py --input ./sample.jpg
```

### 커스텀 프롬프트 사용

```bash
python vlm.py --input ./sample.jpg --prompt "이 이미지에서 텍스트를 모두 추출해 주세요."
```

### 모델 변경

```bash
python vlm.py --input ./sample.jpg --model gemini-2.5-pro
```

### 전체 옵션

```
옵션:
  --input, -i    분석할 이미지 파일 경로
  --prompt, -p   이미지 분석 프롬프트 (기본값: "이 이미지를 자세히 설명해 주세요.")
  --model        사용할 Gemini 모델 (기본값: gemini-2.5-flash)
  --max-tokens   최대 생성 토큰 수 (기본값: 8192)
```

### 실행 예시 출력

```
============================================================
Gemini Vision 이미지 분석 예제
============================================================

이미지: sample.jpg
프롬프트: 이 이미지를 자세히 설명해 주세요.
모델: gemini-2.5-flash
============================================================

1. Gemini API 클라이언트 초기화 중...
   - 초기화 완료!

2. 이미지 분석 중...

============================================================
분석 결과
============================================================
이 이미지는 ...
============================================================
```
