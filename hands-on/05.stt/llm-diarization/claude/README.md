# Claude 기반 LLM 화자 분리 음성 인식 예제  

## 개요  

OpenAI Whisper `whisper-1`으로 오디오를 먼저 STT 처리한 뒤, Claude `claude-opus-4-7`로 화자를 분리하는 예제임  
Claude는 오디오 직접 처리를 지원하지 않으므로 `OPENAI_API_KEY`와 `CLAUDE_API_KEY`가 모두 필요함  
기본 입력 파일은 `hands-on/05.stt/audio/phone-with-wife.mp3`임  

## 처리 흐름  

1. `hands-on/.env`에서 `OPENAI_API_KEY`, `CLAUDE_API_KEY` 로드  
2. `--input` 값이 있으면 해당 오디오 사용, 없으면 `hands-on/05.stt/audio/`의 첫 번째 오디오 사용  
3. Whisper `whisper-1` 호출 및 `timestamp_granularities=["segment"]`로 segment 타임스탬프 수신  
4. `[MM:SS] 텍스트` 형태로 Whisper segment 변환  
5. 한글 프롬프트로 Claude에 화자 분리 요청  
6. Claude 응답에서 `[MM:SS] 화자X: 텍스트` 형식 행만 정규식으로 파싱  
7. 화자별 샘플 발화 출력 후 실제 이름 입력 또는 `--name-map`, `--yes`로 비대화식 처리  
8. `result.txt`, `result_chunks.csv`, `result.json` 저장  

## 주요 함수 설명  

| 함수 | 역할 |  
| --- | --- |  
| `resolve_audio_input()` | CLI 입력 또는 기본 audio 디렉터리 첫 번째 파일 선택 |  
| `load_api_keys()` | `hands-on/.env`에서 Claude와 OpenAI API Key 로드 |  
| `transcribe_with_whisper()` | Whisper `verbose_json` 응답으로 segment 타임스탬프 생성 |  
| `format_whisper_segments()` | Claude 입력용 `[MM:SS] 텍스트` 목록 생성 |  
| `build_diarization_prompt()` | 화자A, 화자B 라벨과 자연 발화 보존을 지시하는 한글 프롬프트 생성 |  
| `diarize_with_claude()` | Claude `claude-opus-4-7` 호출 및 화자 분리 응답 수신 |  
| `parse_diarized_transcript()` | `[MM:SS] 화자X: 텍스트` 행만 파싱하고 설명, 요약, 제목 무시 |  
| `choose_speaker_names()` | 화자별 샘플 발화 출력 및 실제 이름 입력 처리 |  
| `save_results()` | TXT, CSV, JSON 결과 저장 |  

## WhisperX와 비교  

| 구분 | WhisperX | Claude LLM 화자 분리 |  
| --- | --- | --- |  
| 방식 | Whisper 계열 ASR, alignment, pyannote 기반 diarization | Whisper STT 후 Claude가 문맥 기반 화자 추론 |  
| 설치 | PyTorch, ffmpeg, CUDA 환경 영향 큼 | API SDK 중심으로 상대적으로 단순 |  
| 실행 위치 | 로컬 실행 중심, GPU 권장 | 클라우드 API 호출 중심 |  
| 타임스탬프 | 단어 단위 alignment 가능 | Whisper segment 시작 시각 기반 |  
| 화자 분리 | 음성 임베딩 기반 분리 | 말투, 문맥, 호칭 기반 추론 |  
| 장점 | 정밀한 alignment와 오프라인 처리 가능 | 짧은 대화의 의미 기반 정리와 라벨링에 유리 |  
| 한계 | 환경 구축 난도와 모델 다운로드 부담 | API 비용, 네트워크, LLM 추론 오류 가능성 |  

## 설치 방법  

Windows PowerShell 기준 실행 방법임  

```powershell
cd C:\Users\hiond\workspace\aistudy\hands-on\05.stt\llm-diarization\claude
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

`hands-on/.env` 파일에 다음 값 필요  

```env
OPENAI_API_KEY=sk-...
CLAUDE_API_KEY=sk-ant-...
```

## 실행 방법  

기본 오디오와 기본 출력 디렉터리를 사용하는 대화식 실행  

```powershell
python .\diarization.py
```

입력 파일과 출력 디렉터리 지정  

```powershell
python .\diarization.py `
  --input "..\..\audio\phone-with-wife.mp3" `
  --output-dir ".\output"
```

테스트 자동화를 위한 비대화식 실행  

```powershell
python .\diarization.py `
  --input "..\..\audio\phone-with-wife.mp3" `
  --output-dir ".\output" `
  --yes
```

실제 이름을 미리 지정하는 비대화식 실행  

```powershell
python .\diarization.py `
  --input "..\..\audio\phone-with-wife.mp3" `
  --output-dir ".\output" `
  --name-map "화자A=아내,화자B=남편"
```

## 출력 파일 형식  

### result.txt  

원본 Claude 변환 결과, 파싱된 원본 대화록, 이름 반영 최종 대화록 포함  

```text
# Claude LLM 화자 분리 결과

## 원본 변환 결과
[00:00] 화자A: 여보세요.

## 파싱된 원본 대화록
[00:00] 화자A: 여보세요.

## 이름 반영 최종 대화록
[00:00] 아내: 여보세요.
```

### result_chunks.csv  

`pandas.DataFrame.to_csv()`로 저장하며 구분자는 `|` 사용  
화자 이름은 실제 이름 매핑이 반영된 값임  

```csv
id|timestamp|speaker|text
1|00:00|아내|여보세요.
2|00:02|남편|응, 어디야?
```

### result.json  

메타데이터, 이름 매핑, 실제 이름이 반영된 segment 목록 포함  

```json
{
  "whisper_model": "whisper-1",
  "claude_model": "claude-opus-4-7",
  "name_mapping": {
    "화자A": "아내",
    "화자B": "남편"
  },
  "segments": [
    {
      "id": 1,
      "timestamp": "00:00",
      "speaker": "아내",
      "text": "여보세요."
    }
  ]
}
```

## 시스템 요구사항  

| 항목 | 요구사항 |  
| --- | --- |  
| Python | 3.10 이상 권장 |  
| 네트워크 | OpenAI, Anthropic API 호출 가능 환경 |  
| API Key | `hands-on/.env`의 `OPENAI_API_KEY`, `CLAUDE_API_KEY` |  
| 입력 오디오 | `.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg`, `.webm`, `.mp4`, `.aac` 등 |  
| 출력 라이브러리 | `pandas` 필요, CSV 구분자 `|` 사용 |  

## 검증 방법  

문법 검사  

```powershell
python -m py_compile .\diarization.py
```

실제 API 실행 테스트  

```powershell
python .\diarization.py `
  --input "..\..\audio\phone-with-wife.mp3" `
  --output-dir ".\output" `
  --yes
```
