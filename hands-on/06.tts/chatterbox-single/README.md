# Chatterbox Single-User Voice Cloning TTS  
  
Resemble AI Chatterbox Multilingual 모델을 이용한 단일 사용자 한국어 음성 복제 TTS 예제임.  
`voices/` 디렉토리에 사용자 참조 음성 1개 이상을 배치한 뒤, 실행 중 입력한 한국어 텍스트를  
해당 사용자 목소리로 합성함.  
  
공식 가이드: <https://github.com/resemble-ai/chatterbox>  
  
## 예제 흐름  
  
1. PyTorch / torchaudio 설치 여부 확인  
2. ffmpeg 설치 여부 확인  
3. `voices/` 디렉토리의 참조 음성 파일 스캔  
4. WAV 이외 포맷을 ffmpeg로 WAV 변환 후 재사용  
5. 참조 음성 파일이 여러 개면 실행 중 사용할 음성 선택  
6. 합성할 한국어 텍스트 입력  
7. 톤앤매너 추가 프롬프트 선택 입력  
8. Groq LPU `openai/gpt-oss-120b`로 희곡식 TTS 스크립트 전처리 (숫자·약자 발음 변환 포함)  
9. Chatterbox Multilingual로 사용자 목소리 음성 생성  
10. Facebook denoiser dns48으로 세그먼트별 노이즈 제거 (텐서 직접 처리)  
11. ffmpeg concat 디먹서로 세그먼트 병합 (세그먼트 간 묵음 삽입), 임시 파일 자동 삭제  
12. `results/result_{YYYYMMDD}_{HHMMSS}.wav`와 `scripts/script_{YYYYMMDD}_{HHMMSS}.txt` 저장  
  
## 프로젝트 구조  
  
```text  
hands-on/06.tts/chatterbox-single/  
  tts.py  
  requirements.txt  
  README.md  
  voices/  
    user.wav  
  scripts/  
    script_{YYYYMMDD}_{HHMMSS}.txt  
  results/  
    result_{YYYYMMDD}_{HHMMSS}.wav  
```  
  
## 모델 정보  
  
- 모델: Chatterbox Multilingual  
- 크기: 약 500M 파라미터  
- 언어: 한국어 포함 23개 언어 지원  
- 한국어 합성: `language_id="ko"` 사용  
- 번역: 불필요  
- 최초 실행: 모델 자동 다운로드, 약 500MB 디스크 여유 공간 및 네트워크 필요  
- 워터마크: 생성 음성에 Resemble AI Perth 불가청 워터마크 자동 삽입  
  
## 시스템 요구사항  
  
- Python: 3.12 필수  
- GPU: VRAM 4GB 이상 권장  
- CPU: 실행 가능하나 속도 느림  
- 디스크: 모델 다운로드 및 캐시를 위한 여유 공간 필요  
- ffmpeg: WAV 이외 포맷 변환에 필요  
  
현재 작업 머신 확인 결과는 다음과 같음.  
  
```text  
GPU: NVIDIA GeForce RTX 4090 계열  
NVIDIA Driver: 560.94  
CUDA Driver: 12.6  
Python: 3.12.9  
Installed torch: 2.6.0+cu124, CUDA 사용 가능  
```  
  
CUDA Driver 12.6 환경에서는 PyTorch CUDA 12.6 빌드 설치 권장.  
CUDA 12.4 빌드도 드라이버 호환 범위에서 사용 가능함.  
  
## PyTorch 설치  
  
`torch` / `torchaudio`는 `requirements.txt`에서 제외함.  
Python 3.12 시스템 환경에 CUDA 빌드를 먼저 설치한 뒤, venv에서 `--system-site-packages`로 공유함.  
  
```powershell  
py -3.12 -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126  
```  
  
상세 가이드:  
<https://github.com/cna-bootcamp/aistudy/blob/main/agentic-ai/reference/install-pytorch.md>  
  
## ffmpeg 설치  
  
ffmpeg는 pip 패키지가 아닌 시스템 도구임.  
WAV 이외 참조 음성 변환에 필요하며, 설치되지 않으면 `tts.py`가 설치 안내 후 종료함.  
  
```powershell  
winget install ffmpeg  
```  
  
macOS / Linux 예시:  
  
```bash  
brew install ffmpeg  
sudo apt install ffmpeg  
```  

## Groq API Key 설정  
  
톤앤매너 기반 텍스트 전처리는 Groq LPU의 `openai/gpt-oss-120b` 모델을 사용함.  
API Key는 `hands-on/.env` 파일에서 읽음.  
  
```text  
GROQ_API_KEY=gsk_...  
```  
  
`GROQ_API_KEY`가 없거나 잘못되면 음성 생성 전에 오류 안내 후 종료함.  
  
## 가상환경 설정  
  
의존성 설치 전 `pip` / `setuptools` 업그레이드 필수.  
미수행 시 `BackendUnavailable: Cannot import 'setuptools.build_meta'` 오류 발생 가능.  
  
### Windows PowerShell  
  
```powershell  
cd hands-on\06.tts\chatterbox-single  
py -3.12 -m venv venv --system-site-packages  
venv\Scripts\Activate.ps1  
python -m pip install --upgrade pip setuptools  
pip install -r requirements.txt  
```  
  
### Windows Git Bash  
  
```bash  
cd hands-on/06.tts/chatterbox-single  
py -3.12 -m venv venv --system-site-packages  
source venv/Scripts/activate  
python -m pip install --upgrade pip setuptools  
pip install -r requirements.txt  
```  
  
### macOS / Linux  
  
```bash  
cd hands-on/06.tts/chatterbox-single  
python3.12 -m venv venv --system-site-packages  
source venv/bin/activate  
python -m pip install --upgrade pip setuptools  
pip install -r requirements.txt  
```  
  
## 참조 음성 준비  
  
`voices/` 디렉토리에 사용자 목소리 참조 음성 파일을 배치함.  
  
권장 파일명:  
  
- `user.wav`  
- `user.mp3`  
- `user.m4a`  
  
권장 사양:  
  
- 길이: 약 10초  
- 화자: 단일 화자  
- 배경 소음: 최소화  
- 발화: 또렷하고 자연스러운 문장  
- 언어: 합성 대상 언어와 일치, 한국어 합성 시 한국어 참조 음성 권장  
  
지원 포맷:  
  
- WAV  
- MP3  
- M4A  
- AAC  
- OGG  
- OPUS  
- FLAC  
- WMA  
- AIFF  
- WebM  
- AMR  
- 기타 ffmpeg가 읽을 수 있는 오디오 포맷  
  
WAV 파일은 그대로 사용함.  
WAV 이외 포맷은 실행 시 ffmpeg로 `voices/` 안에 같은 이름의 WAV 파일로 변환함.  
예를 들어 `voices/user.m4a`는 `voices/user.wav`로 변환됨.  
이미 변환된 WAV 파일이 있으면 재실행 시 다시 변환하지 않고 재사용함.  
  
참조 음성과 합성 언어가 다르면 억양 혼재가 발생할 수 있음.  
한국어 텍스트 합성에는 한국어 참조 음성 사용 권장.  
  
## 실행 방법  
  
```bash  
python tts.py  
```  
  
실행 중 입력 예시:  
  
```text  
Text to synthesize. Type EOD on its own line to finish.  
Type EOD without text to exit.  
> 안녕하세요.  
. 오늘은 AI 음성 합성 실습을 시작하겠습니다.  
. EOD  
Tone prompt: 차분하고 다정하게  
```  
  
텍스트 입력은 `EOD`가 단독으로 입력될 때 종료함.  
첫 입력이 `EOD`이면 종료함.  
빈 줄은 본문 줄바꿈으로 유지 가능함.  
텍스트 중간의 Enter는 줄바꿈으로 유지됨.  
톤앤매너 입력이 비어 있으면 기본 톤으로 생성함.  
  
## LLM 전처리  
  
Groq LPU `openai/gpt-oss-120b`가 사용자 원문과 톤앤매너를 받아 Chatterbox용 희곡식 스크립트를 생성함.  
각 대사는 괄호 안에 감정 라벨과 Chatterbox 생성 파라미터를 포함함.  
긴 원문은 Groq 출력 잘림을 피하기 위해 약 450자 단위로 나누어 전처리한 뒤 합침.  
전처리 결과는 JSON이 아니라 순수 텍스트 희곡식 스크립트로 받음.  
Groq 응답이 토큰 한도에 걸리면 해당 청크를 더 작게 나누어 재요청함.  
  
예시:  
  
```text  
(news_anchor|exaggeration=0.35|cfg_weight=0.70) 삼성전자 사장단이 이천이십육년 임금 단체협약 최종 타결 직후...  
(serious_apology|exaggeration=0.40|cfg_weight=0.65) 국민과 주주, 고객, 그리고 임직원 여러분께...  
```  
  
`tts.py`는 괄호 지시문을 그대로 읽게 하지 않고, 이를 파싱하여 각 대사별 `exaggeration`과 `cfg_weight`로 적용함.  
Chatterbox 계열의 감정 제어는 주로 `exaggeration` 파라미터로 처리되며, `cfg_weight`는 화자 조건과 속도/안정성에 영향을 줌.  
`[laugh]`, `[cough]`, `[chuckle]` 같은 비언어 태그는 명시적으로 필요한 경우에만 대사 텍스트에 포함함.  
  
LLM 전처리 결과는 음성 파일과 같은 타임스탬프로 저장됨.  
  
```text  
hands-on/06.tts/chatterbox-single/scripts/script_{YYYYMMDD}_{HHMMSS}.txt  
```  
  
## 숫자와 약자 읽기 전처리  
  
Chatterbox Multilingual의 기본 전처리는 문장부호 정리와 언어별 토큰화 중심임.  
한국어 숫자, 날짜, 금액, 영어 약자 읽기는 합성 전 Groq LLM 단계에서 처리함.  
  
이 예제는 Groq LLM 시스템 프롬프트에서 숫자와 영어 약자 발음을 변환하도록 지시함.  
코드 레벨 안전망 변환은 Groq가 의도적으로 보존한 ID·코드류 숫자를 잘못 변환할 수 있어 제거함.  
  
예시:  
  
| 입력 | LLM 변환 결과 |  
|---|---|  
| `2026년` | `이천이십육년` |  
| `27일` | `이십칠일` |  
| `5년간` | `오년간` |  
| `5조원` | `오조원` |  
| `12.5%` | `십이 점 오퍼센트` |  
| `3명` | `삼명` |  
| `AI` | `에이아이` |  
| `AM` | `에이엠` |  
| `SDLC` | `에스디엘시` |  
  
## 톤앤매너 프롬프트  
  
`tts.py`는 톤앤매너 프롬프트를 Groq LLM에 전달해 대사별 감정 라벨과 Chatterbox 파라미터를 생성함.  
사용자 입력 텍스트의 의미는 변경하지 않으며, 사실, 날짜, 금액, 고유명사, 인용문을 보존하도록 지시함.  
각 대사는 `(emotion_label|exaggeration=...|cfg_weight=...)` 형식으로 시작함.  
`tts.py`는 이 값을 읽어 각 대사 생성 시 `model.generate()`의 파라미터로 전달함.  
장문 입력은 한 번에 생성하지 않고 문장/문단 단위로 나누어 생성한 뒤 연결함.  
긴 기사문을 한 번의 `model.generate()`에 넣으면 내부 생성 토큰 한도와 반복 종료 조건 때문에 내용 누락,  
반복, 원문과 다른 발화가 발생할 수 있음.  
  
예시:  
  
- `차분하고 다정하게`  
- `밝고 활기차게`  
- `뉴스 앵커처럼 또렷하게`  
- `감정을 살려 극적으로`  
- `웃음 섞어서 밝게`  
  
## 파라미터 튜닝 가이드  
  
`exaggeration` 기본값은 `0.5`임.  
값이 높을수록 감정 표현 강도가 증가함.  
  
| 값 | 효과 |  
|---:|---|  
| 0.35 | 차분하고 안정적인 표현 |  
| 0.50 | 기본 표현 |  
| 0.65 | 밝고 활기찬 표현 |  
| 0.75 이상 | 극적이고 감정적인 표현 |  
  
`cfg_weight` 기본값은 `0.5`임.  
값이 낮을수록 참조 음성의 억양 전달이 줄고, 값이 높을수록 화자 일관성이 강해짐.  
  
| 값 | 효과 |  
|---:|---|  
| 0.0 | 억양 전달 최소화, 교차 언어 복제 시 사용 가능 |  
| 0.35 | 표현력 우선, 억양 영향 감소 |  
| 0.50 | 기본 균형 |  
| 0.65 | 또렷함과 화자 일관성 우선 |  
  
## 감정 태그 사용  
  
Chatterbox는 비언어적 표현 태그를 텍스트에 포함할 수 있음.  
이 예제는 톤 프롬프트에 명시적인 요청이 있을 때만 태그를 추가함.  
  
예시 태그:  
  
- `[laugh]`  
- `[chuckle]`  
- `[cough]`  
- `[clears throat]`  
- `[sighs]`  
  
톤 프롬프트 예시:  
  
```text  
웃음 섞어서 밝게  
목 가다듬고 뉴스 앵커처럼 또렷하게  
```  
  
## 출력 파일  
  
생성 결과는 다음 위치에 저장됨.  
  
```text  
hands-on/06.tts/chatterbox-single/results/result_{YYYYMMDD}_{HHMMSS}.wav  
hands-on/06.tts/chatterbox-single/scripts/script_{YYYYMMDD}_{HHMMSS}.txt  
```  
  
예: `results/result_20260527_181010.wav`, `scripts/script_20260527_181010.txt`  
타임스탬프는 한국시간(`Asia/Seoul`) 기준임.  
출력 형식은 WAV 16-bit PCM임.  
  
## 소스 코드 설명  
  
`tts.py` 주요 처리:  
  
- `check_prerequisites()`: Python 3.12, PyTorch, torchaudio, ffmpeg, chatterbox-tts 확인  
- `prepare_reference_voices()`: `voices/` 스캔 및 비-WAV 파일 변환  
- `select_reference_voice()`: 여러 참조 음성 중 사용할 파일 선택  
- `read_user_inputs()`: 합성 텍스트와 톤앤매너 프롬프트 입력  
- `get_groq_api_key()`: `hands-on/.env`에서 `GROQ_API_KEY` 로드  
- `patch_chatterbox_alignment_analyzer()`: 짧은 세그먼트에서 발생 가능한 Chatterbox 내부 빈 슬라이스 오류 완화  
- `preprocess_text_with_groq()`: Groq `openai/gpt-oss-120b` 기반 희곡식 TTS 스크립트 생성  
- `split_text_for_groq()`: Groq 출력 잘림 방지를 위한 전처리 청크 분할  
- `script_to_tts_lines()`: 괄호 감정 지시문을 대사별 파라미터로 파싱  
- `split_text_for_tts()`: 장문을 문장/문단 단위로 분할  
- `merge_short_tts_lines()`: 너무 짧은 대사를 앞뒤 대사와 병합하여 내부 정렬 오류 가능성 완화  
- `generate_and_save_segments()`: 세그먼트별 denoiser dns48 노이즈 제거 → ffmpeg concat 병합  
- `model.generate(...)`: `language_id="ko"`와 `audio_prompt_path` 기반 음성 복제 합성  
- `make_run_paths()`: 한국시간 기준 `results/result_{YYYYMMDD}_{HHMMSS}.wav`와 `scripts/script_{YYYYMMDD}_{HHMMSS}.txt` 경로 생성  
- `save_pcm16_wav()`: 세그먼트를 16-bit PCM WAV로 저장  
  
핵심 API:  
  
```python  
wav = model.generate(  
    text,  
    language_id="ko",  
    audio_prompt_path=reference_voice,  
    exaggeration=0.5,  
    cfg_weight=0.5,  
)  
```  
  
## 목소리 학습 문장
```
봄바람이 살랑살랑 불어오는 화창한 오후,
창가에 앉아 따뜻한 차 한 잔을 마십니다.
오늘도 즐겁고 행복한 하루 되세요.
```

천천히, 또박또박 읽되 너무 인위적이지 않게 자연스러운 속도 유지   
조용한 환경에서 마이크와 입 사이 10~15cm 거리 유지
  
## 문제 해결  
  
### PyTorch 없음  
  
```text  
[Error] PyTorch is not installed.  
```  
  
Python 3.12 시스템 환경에 CUDA 빌드 PyTorch 설치 필요.  
설치 후 `--system-site-packages` venv에서 공유함.  
  
### CUDA 미감지  
  
Python 3.14 이상 venv에서 torch CPU 버전이 설치되면 CUDA가 감지되지 않을 수 있음.  
Python 3.12로 venv 재생성 필요.  
  
```powershell  
py -3.12 -m venv venv --system-site-packages  
```  
  
### ffmpeg 없음  
  
```text  
[Error] ffmpeg is not installed or not available on PATH.  
```  
  
Windows에서 다음 명령으로 설치함.  
  
```powershell  
winget install ffmpeg  
```  

### Groq API Key 없음  
  
```text  
[Error] GROQ_API_KEY not found.  
```  
  
`hands-on/.env` 파일에 다음 값을 설정함.  
  
```text  
GROQ_API_KEY=gsk_...  
```  
  
### Groq JSON 생성 실패  
  
```text  
json_validate_failed  
max completion tokens reached before generating a valid document  
```  
  
긴 입력을 JSON 한 덩어리로 강제 생성할 때 발생 가능함.  
현재 예제는 JSON 응답 강제를 사용하지 않고, 입력을 작은 청크로 나누어 Groq 전처리를 수행함.  
응답이 `finish_reason=length`로 끝나면 해당 청크를 더 작게 나누어 자동 재시도함.  
문제가 계속되면 한 문단을 더 짧게 나누어 입력함.  
  
### 참조 음성 없음  
  
`voices/` 디렉토리에 오디오 파일이 없으면 실행이 중단됨.  
약 10초 길이의 단일 화자 참조 음성 배치 필요.  
  
### 참조 음성 변환 실패  
  
파일 손상 또는 ffmpeg 미지원 컨테이너 가능성 있음.  
다른 포맷으로 저장하거나 WAV 파일로 직접 변환 후 배치함.  
  
### 모델 다운로드 실패  
  
최초 실행 시 약 500MB 모델 다운로드 필요.  
네트워크 연결, 프록시, Hugging Face 캐시 권한 확인 필요.  
  
### CUDA OOM  
  
VRAM 부족 시 CPU 실행 또는 더 짧은 텍스트로 재시도함.  
GPU VRAM 4GB 이상 권장.  
  
### 청크 경계 노이즈

세그먼트를 단순 이어붙이면 각 청크의 노이즈 플로어 차이로 인해 경계 부분에서 잡음이 들릴 수 있음.  
현재 예제는 세그먼트별로 Facebook denoiser dns48 노이즈 제거를 텐서에 직접 적용한 뒤 ffmpeg concat으로 병합하여 이 문제를 최소화함.  
노이즈가 여전히 남아 있으면 참조 음성의 배경 소음을 줄이거나 녹음 품질을 개선함.  

### 음성 억양 혼재  
  
참조 음성 언어와 합성 언어 불일치 가능성 있음.  
한국어 합성에는 한국어 참조 음성 사용 권장.  
교차 언어 실험 시 `cfg_weight`를 낮추면 억양 전달 완화 가능.  
  
### 원문과 다른 내용 생성  
  
긴 문단 전체를 한 번에 합성하면 Chatterbox 내부 생성 토큰 한도에 걸려 내용이 중간에 끊기거나  
반복과 다른 발화가 섞일 수 있음.  
이 예제는 `split_text_for_tts()`로 장문을 나눈 뒤 각 구간을 합성하고 연결함.  
문제가 계속되면 한 구간 길이를 더 줄이거나 문장부호를 명확히 입력함.  
  
### Chatterbox alignment analyzer 오류  
  
```text  
IndexError: max(): Expected reduction dim 1 to have non-zero size.  
```  
  
짧은 대사 또는 분할된 짧은 세그먼트에서 Chatterbox 내부 정렬 분석기가 빈 슬라이스에 `max()`를 호출하며 발생 가능함.  
이 예제는 실행 시 Chatterbox 내부 분석기에 안전 래퍼를 적용하고, 지나치게 짧은 대사는 앞뒤 대사와 병합함.  
  
### 숫자 발음 오류  
  
`2026년`, `27일`, `5년간`, `5조원`처럼 숫자와 단위가 붙은 표현은 모델이 잘못 읽을 수 있음.  
이 예제는 Groq 전처리 단계에서 `이천이십육년`, `이십칠일`, `오년간`, `오조원`처럼 변환하도록 지시함.  
도메인별 숫자 표현이 많으면 Groq 시스템 프롬프트에 예시를 추가함.  
  
### 영어 약자 발음 오류  
  
`AI`, `AM`, `SDLC` 같은 대문자 약자는 모델이 영어처럼 읽거나 건너뛸 수 있음.  
이 예제는 Groq 전처리 단계에서 `에이아이`, `에이엠`, `에스디엘시`처럼 변환하도록 지시함.  
변환이 누락되면 Groq 시스템 프롬프트에 해당 약자와 발음을 예시로 추가함.  
  
### 톤앤매너 미반영  
  
Chatterbox Multilingual은 자연어 감정 지시문을 직접 이해하기보다 `exaggeration`과 `cfg_weight` 값에 크게 의존함.  
이 예제는 Groq가 각 대사 앞에 `(news_anchor|exaggeration=0.35|cfg_weight=0.70)` 같은 지시문을 붙이게 함.  
`tts.py`는 괄호 내용을 음성으로 읽지 않고 파싱하여 `model.generate()` 호출 파라미터로 사용함.  
  
### numpy 2.x 설치 문제  
  
일부 환경에서 `numpy` 2.x가 torch CUDA 감지에 영향을 줄 수 있음.  
이 예제는 `requirements.txt`에서 `numpy<2.0`으로 고정함.  
  
## 라이선스 안내  
  
요구사항 기준 안내 라이선스는 Apache 2.0이며 상업적 사용 가능으로 정리함.  
단, 공식 Chatterbox GitHub 및 PyPI 표기는 MIT License로 확인될 수 있음.  
실제 배포 전 공식 `LICENSE` 파일과 조직의 오픈소스 정책 재확인 필요.  
  
생성 음성에는 Perth 불가청 워터마크가 자동 포함됨.  
