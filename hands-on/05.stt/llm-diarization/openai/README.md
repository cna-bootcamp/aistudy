# OpenAI LLM 화자 분리 음성 인식 예제

## 개요

OpenAI Chat Completions 오디오 모델에 MP3 파일을 base64 `input_audio`로 전달하여 화자 분리 대화록을 생성하는
예제임  
모델은 요구사항에 따라 `gpt-audio-1.5`로 고정함  
API Key는 `hands-on/.env` 파일의 `OPENAI_API_KEY` 값 사용  

## 파일 구성

```text
hands-on/05.stt/
├── audio/
│   └── phone-with-wife.mp3
└── llm-diarization/
    └── openai/
        ├── diarization.py
        ├── requirements.txt
        ├── README.md
        ├── result.txt
        ├── result_chunks.csv
        └── result.json
```

## 소스 코드 설명

`diarization.py` 주요 함수 구성은 다음과 같음  

| 함수 | 역할 |
| --- | --- |
| `load_openai_client()` | `hands-on/.env`에서 `OPENAI_API_KEY` 로드 후 OpenAI 클라이언트 생성 |
| `resolve_audio_input()` | `--input` 값 검증 또는 `audio` 디렉터리의 첫 번째 MP3 자동 선택 |
| `validate_audio_file()` | MP3 확장자, 파일 존재 여부, 25MB 이하 크기 검증 |
| `encode_audio_base64()` | MP3 파일을 base64 문자열로 변환 |
| `transcribe_with_openai_audio()` | `gpt-audio-1.5` Chat Completions 호출, `input_audio.format`은 `mp3` 지정 |
| `parse_transcript()` | AI 응답 중 `[MM:SS] 화자X: 텍스트` 형식 줄만 파싱, 설명과 요약 무시 |
| `collect_speaker_names()` | 화자별 샘플 발화 출력 후 실제 이름 입력 수집 |
| `parse_name_map()` | `--name-map "화자A=이름,화자B=이름"` 형식의 비대화식 이름 매핑 처리 |
| `apply_speaker_names()` | 화자 라벨을 실제 이름으로 치환 |
| `save_results()` | `result.txt`, `result_chunks.csv`, `result.json` 저장 |

## 처리 흐름

1. 입력 MP3 결정 및 검증  
2. `hands-on/.env`에서 `OPENAI_API_KEY` 로드  
3. MP3 파일 base64 인코딩  
4. Chat Completions API에 한국어 화자 분리 프롬프트와 `input_audio` 전달  
5. `[MM:SS] 화자X: 텍스트` 형식만 파싱  
6. 화자별 샘플 발화 표시 및 실제 이름 입력  
7. 실제 이름이 반영된 TXT, CSV, JSON 결과 저장  

## WhisperX와 비교

| 항목 | WhisperX | OpenAI LLM Diarization |
| --- | --- | --- |
| 처리 방식 | Whisper 계열 ASR + pyannote 기반 화자 분리 | 오디오 LLM에 직접 MP3 전달 후 화자 분리 요청 |
| 설치 난이도 | PyTorch, ffmpeg, CUDA 환경 등 복잡 | Python 패키지와 API Key 중심 |
| 실행 위치 | 로컬 CPU/GPU | OpenAI API |
| GPU 필요성 | 긴 파일이나 빠른 처리를 위해 GPU 권장 | 로컬 GPU 불필요 |
| 화자 분리 방식 | 음성 임베딩 기반 분리 | LLM의 오디오 이해와 문맥 추론 기반 |
| 장점 | 오프라인/로컬 처리 가능, 전문 파이프라인 구성 가능 | 구현 단순, 자연스러운 발화 복원과 문맥 반영에 유리 |
| 한계 | 환경 구축 부담, 모델/토큰 관리 필요 | API 비용 발생, 모델 응답 형식 관리 필요 |

## 설치 방법

Windows PowerShell 기준 실행 방법임  

```powershell
cd C:\Users\hiond\workspace\aistudy\hands-on\05.stt\llm-diarization\openai
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

기존 가상환경을 사용하는 경우 `pip install -r requirements.txt`만 수행 가능  

## API Key 설정

`C:\Users\hiond\workspace\aistudy\hands-on\.env` 파일에 다음 값 필요  

```env
OPENAI_API_KEY=sk-...
```

## 실행 방법

기본 실행은 `audio` 디렉터리의 첫 번째 MP3 파일 사용 및 대화형 이름 입력 수행  

```powershell
python .\diarization.py
```

입력 파일과 출력 디렉터리 직접 지정  

```powershell
python .\diarization.py `
  --input "C:\Users\hiond\workspace\aistudy\hands-on\05.stt\audio\phone-with-wife.mp3" `
  --output-dir ".\out"
```

테스트 자동화를 위한 비대화식 실행  

```powershell
python .\diarization.py `
  --input "C:\Users\hiond\workspace\aistudy\hands-on\05.stt\audio\phone-with-wife.mp3" `
  --name-map "화자A=아내,화자B=남편" `
  --yes
```

`--name-map`에 없는 화자는 `--yes` 지정 시 기본 라벨 유지  
`--yes`가 없으면 누락 화자에 대해서만 이름 입력 요청  

## 출력 파일 형식

### result.txt

원본 AI 응답과 파싱된 원본 대화록, 실제 이름 반영 최종 대화록을 함께 저장함  

```text
OpenAI LLM Diarization Result
Generated At: 2026-05-22 14:00:00
Model: gpt-audio-1.5
Audio File: phone-with-wife.mp3

## 원본 변환 결과
[00:00] 화자A: ...

## 파싱된 원본 대화록
[00:00] 화자A: ...

## 이름 반영 최종 대화록
[00:00] 아내: ...
```

### result_chunks.csv

`pandas.DataFrame.to_csv()`를 사용하며 구분자는 `|`임  
화자명은 실제 이름 입력 또는 `--name-map` 반영 후 저장됨  

```csv
id|timestamp|speaker|text
1|00:00|아내|여보세요...
2|00:03|남편|지금 어디야...
```

### result.json

실제 이름이 반영된 `segments`와 화자 이름 매핑 정보를 저장함  

```json
{
  "generated_at": "2026-05-22 14:00:00",
  "model": "gpt-audio-1.5",
  "audio_file": "C:\\Users\\hiond\\workspace\\aistudy\\hands-on\\05.stt\\audio\\phone-with-wife.mp3",
  "speaker_name_map": {
    "화자A": "아내",
    "화자B": "남편"
  },
  "segments": [
    {
      "id": 1,
      "timestamp": "00:00",
      "speaker": "아내",
      "text": "여보세요..."
    }
  ]
}
```

## 시스템 요구사항

| 항목 | 요구사항 |
| --- | --- |
| Python | 3.10 이상 권장 |
| 패키지 | `openai`, `python-dotenv`, `pandas` |
| 네트워크 | OpenAI API 호출 가능한 인터넷 연결 |
| API Key | `OPENAI_API_KEY` 필수 |
| 입력 파일 | MP3, 25MB 이하 |
| 로컬 GPU | 불필요 |

## 검증 방법

문법 검증  

```powershell
python -m py_compile .\diarization.py
```

실제 API 호출 검증  

```powershell
python .\diarization.py `
  --input "C:\Users\hiond\workspace\aistudy\hands-on\05.stt\audio\phone-with-wife.mp3" `
  --name-map "화자A=아내,화자B=남편" `
  --yes
```

## 참고

- [OpenAI Audio and speech guide](https://platform.openai.com/docs/guides/audio)
- [OpenAI Chat Completions API reference](https://platform.openai.com/docs/api-reference/chat/create)
