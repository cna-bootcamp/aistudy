# Gemini 기반 LLM 화자 분리 음성 인식 예제

Gemini 2.5 Flash에 오디오 파일을 직접 입력하여 음성 인식과 화자 분리를 한 번에 수행하는 예제임.  
출력은 `[MM:SS] 화자X: 텍스트` 형식만 파싱하며, 설명이나 요약 문장은 결과 데이터에서 제외됨.  

## 시스템 요구사항

- Python 3.10 이상 권장  
- 인터넷 연결 필요  
- Gemini API Key 필요  
- `hands-on/.env` 파일에 `GEMINI_API_KEY` 설정 필요  
- GPU 불필요, 모든 모델 처리는 Gemini API에서 수행됨  

## 설치 방법

```powershell
cd C:\Users\hiond\workspace\aistudy\hands-on\05.stt\llm-diarization\gemini
python -m pip install -r requirements.txt
```

`hands-on\.env` 파일 예시임.  

```env
GEMINI_API_KEY=your_gemini_api_key
```

## 실행 방법

기본 입력 파일은 `hands-on\05.stt\audio\phone-with-wife.mp3`임.  

```powershell
python diarization.py
```

입력 파일과 출력 디렉터리 지정 가능함.  

```powershell
python diarization.py `
  --input C:\Users\hiond\workspace\aistudy\hands-on\05.stt\audio\phone-with-wife.mp3 `
  --output-dir C:\Users\hiond\workspace\aistudy\hands-on\05.stt\llm-diarization\gemini
```

테스트 자동화를 위한 비대화식 실행 예시임.  

```powershell
python diarization.py --yes
python diarization.py --name-map "화자A=아내,화자B=남편"
```

`--yes`는 실제 이름 입력을 생략하고 `화자A`, `화자B` 같은 기본 라벨을 유지함.  
`--name-map`은 지정된 이름을 결과 파일에 반영함. 매핑되지 않은 화자는 기본 모드에서 추가 입력을 받음.  

## 소스 코드 설명

### 주요 함수

| 함수 | 역할 |
|---|---|
| `default_paths()` | 예제 기준 기본 입력 파일, `.env`, 출력 디렉터리 경로 계산 |
| `parse_args()` | `--input`, `--output-dir`, `--name-map`, `--yes`, `--env` 옵션 처리 |
| `load_api_key()` | `.env` 또는 환경 변수에서 `GEMINI_API_KEY` 로드 |
| `validate_audio_file()` | 입력 파일 존재 여부와 지원 확장자 검증 |
| `transcribe_with_gemini()` | `google-genai` SDK로 Gemini 2.5 Flash 직접 오디오 처리 호출 |
| `parse_transcript()` | `[MM:SS] 화자X: 텍스트` 형식만 정규식으로 파싱 |
| `get_speaker_name_mapping()` | 화자별 샘플 발화 출력 후 실제 이름 입력 또는 비대화식 매핑 적용 |
| `save_results()` | `result.txt`, `result_chunks.csv`, `result.json` 저장 |

### 처리 흐름

1. CLI 옵션 파싱 및 기본 경로 계산  
2. `hands-on/.env`에서 `GEMINI_API_KEY` 로드  
3. 오디오 파일 검증  
4. Gemini 2.5 Flash에 한글 화자 분리 프롬프트와 오디오 입력 전달  
5. AI 응답 중 `[MM:SS] 화자X: 텍스트` 형식 라인만 파싱  
6. 화자별 샘플 발화 출력  
7. 실제 이름 입력 또는 `--name-map`, `--yes` 옵션 적용  
8. TXT, CSV, JSON 결과 파일 저장  

### Gemini 오디오 입력 방식

20MB 이하 오디오는 `types.Part.from_bytes()`로 요청에 직접 포함함.  
20MB 초과 파일은 Gemini Files API 업로드 방식으로 전환함.  
모델은 공식 Gemini audio understanding 문서의 오디오 예제와 동일하게 `gemini-2.5-flash` 사용함.  

## 출력 파일 형식

### result.txt

원본 AI 응답과 이름 반영 최종 대화록을 함께 저장함.  

```text
# Gemini LLM 화자 분리 음성 인식 결과

## 원본 변환 결과

[00:00] 화자A: 여보세요?
[00:02] 화자B: 어, 지금 어디야?

## 이름 반영 최종 대화록

[00:00] 아내: 여보세요?
[00:02] 남편: 어, 지금 어디야?
```

### result_chunks.csv

`pandas`로 저장하며 구분자는 `|`임. 실제 이름 반영 결과만 포함함.  

```csv
id|timestamp|speaker|text
1|00:00|아내|여보세요?
2|00:02|남편|어, 지금 어디야?
```

### result.json

실제 이름 반영 결과와 메타데이터를 JSON으로 저장함.  

```json
{
  "model": "gemini-2.5-flash",
  "speaker_name_map": {
    "화자A": "아내",
    "화자B": "남편"
  },
  "segments": [
    {
      "id": 1,
      "timestamp": "00:00",
      "speaker": "아내",
      "text": "여보세요?"
    }
  ]
}
```

## WhisperX와 비교

| 항목 | WhisperX | Gemini LLM 화자 분리 |
|---|---|---|
| 실행 방식 | 로컬 실행 중심 | 클라우드 API 호출 |
| 설치 난이도 | PyTorch, ffmpeg, pyannote 등 의존성 큼 | Python SDK와 API Key 중심 |
| GPU | 긴 파일과 빠른 처리를 위해 권장 | 불필요 |
| 화자 분리 방식 | 전용 ASR, 정렬, diarization 파이프라인 | LLM이 오디오를 이해하고 화자를 추론 |
| 출력 제어 | 후처리 코드로 강하게 제어 | 프롬프트와 파싱 규칙으로 제어 |
| 재현성 | 파이프라인 설정 고정 시 비교적 안정적 | 모델 응답 변동 가능 |
| 비용 | 로컬 자원 비용 중심 | Gemini API 사용량 과금 |
| 적합한 경우 | 대량 처리, 정밀 타임스탬프, 로컬 보안 요구 | 빠른 프로토타입, 간단한 예제, 설치 부담 최소화 |

## 검증 명령

```powershell
python -m py_compile diarization.py
python diarization.py --yes
```

API Key 오류, 할당량 초과, 네트워크 오류가 있으면 실제 실행은 실패할 수 있음.  
이 경우 오류 메시지를 확인하고 `.env`의 `GEMINI_API_KEY`와 Gemini API 사용 권한 확인 필요.  
