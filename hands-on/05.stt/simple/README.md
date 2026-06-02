# OpenAI Whisper STT 예제

## 개요
OpenAI Whisper 모델을 사용하여 음성 파일을 한국어로 전사하고, 같은 음성을 영어로 번역하는 예제임  
API Key는 `hands-on/.env` 파일의 `OPENAI_API_KEY` 값을 사용함  
결과는 `hands-on/05.stt/simple/result.txt`에 저장됨  

## 파일 구성
```text
hands-on/05.stt/
├── audio/
│   └── phone-with-wife.mp3
└── simple/
    ├── whisper.py
    ├── README.md
    └── result.txt
```

## 소스 코드 설명
`whisper.py`는 다음 순서로 동작함  

1. `hands-on/05.stt/audio/`에서 Whisper 지원 오디오 파일 목록 조회  
2. 파일이 1개면 자동 선택, 여러 개면 번호 입력으로 선택  
3. `hands-on/.env`에서 `OPENAI_API_KEY` 로드  
4. `client.audio.transcriptions.create()`로 한국어 전사 생성  
5. `client.audio.translations.create()`로 Whisper 영문 번역 생성  
6. 한국어 전사와 영문 번역을 `result.txt`에 함께 저장  

## 주요 함수
| 함수 | 역할 |
| --- | --- |
| `find_audio_files()` | 지원 확장자의 오디오 파일 목록 조회 |
| `select_audio_file()` | 번호 입력으로 변환 대상 선택 |
| `load_openai_client()` | `hands-on/.env`에서 API Key 로드 후 OpenAI 클라이언트 생성 |
| `transcribe_korean()` | Whisper transcription API로 한국어 전사 생성 |
| `translate_english()` | Whisper translation API로 영어 번역 생성 |
| `save_result()` | 한국어 전사와 영문 번역을 텍스트 파일로 저장 |

## 핵심 코드
```python
transcription = client.audio.transcriptions.create(
    model="whisper-1",
    file=audio_file,
    language="ko",
    response_format="json",
)

translation = client.audio.translations.create(
    model="whisper-1",
    file=audio_file,
    response_format="json",
)
```

## 가상환경 설정 및 실행 방법
Windows PowerShell 기준 실행 방법임  

```powershell
cd C:\Users\hiond\workspace\aistudy\hands-on\05.stt\simple
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install openai python-dotenv
python .\whisper.py
```

CMD 기준 가상환경 활성화 명령은 다음과 같음  

```cmd
.\.venv\Scripts\activate.bat
```

macOS/Linux 기준 실행 방법은 다음과 같음  

```bash
cd /path/to/aistudy/hands-on/05.stt/simple
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install openai python-dotenv
python whisper.py
```

## API Key 설정
`hands-on/.env` 파일에 다음 값이 필요함  

```env
OPENAI_API_KEY=sk-...
```

## CLI 사용법
오디오 파일을 목록에서 선택하는 기본 실행 방식임  

```powershell
python .\whisper.py
```

입력과 출력을 직접 지정하는 방식임  

```powershell
python .\whisper.py `
  --input "..\audio\phone-with-wife.mp3" `
  --output ".\result.txt"
```

## 출력 파일 형식
`result.txt`에는 한국어 전사와 Whisper translation API로 생성한 영문 번역이 함께 저장됨  

```text
OpenAI Whisper STT Result
Generated At: 2026-05-22 13:00:00
Model: whisper-1
Audio File: phone-with-wife.mp3

## 한국어 전사
...

## English Translation
...
```

## 지원 오디오 확장자
`.flac`, `.m4a`, `.mp3`, `.mp4`, `.mpeg`, `.mpga`, `.ogg`, `.wav`, `.webm` 형식을 지원함  

## 검증 방법
문법 검사는 다음 명령으로 수행함  

```powershell
python -m py_compile .\whisper.py
```

실제 API 호출 테스트는 다음 명령으로 수행함  

```powershell
python .\whisper.py --input "..\audio\phone-with-wife.mp3" --output ".\result.txt"
```
