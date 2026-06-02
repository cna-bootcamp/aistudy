# LLM TTS — Text-to-Speech with OpenAI

OpenAI GPT-4o-mini로 대화 텍스트를 번역하고, TTS-1 API로 화자별 음성을 합성하여 단일 WAV 파일로 출력하는 예제

---

## 디렉토리 구조

```
hands-on/06.tts/
├── text/
│   └── dialog.csv              # 입력 대화 파일 (파이프 구분자)
└── llm/
    ├── tts.py                  # 메인 프로그램
    ├── requirements.txt        # 의존 라이브러리
    ├── result.wav              # 출력 음성 파일 (실행 후 생성)
    ├── README.md
    └── translations/           # 번역 캐시 디렉토리
        └── dialog_{lang}.csv   # 언어별 캐시 파일 (예: dialog_en.csv)
```

---

## 소스 코드 설명

### 주요 상수

| 상수 | 설명 |
|------|------|
| `SUPPORTED_LANGUAGES` | 지원 언어 목록 — 번호 → (언어코드, 한국어명, 영어명) |
| `OPENAI_VOICES` | OpenAI TTS 음성 목록 — 번호 → 이름·성별·특징 |

### OpenAI TTS 음성 목록

| 번호 | 이름 | 성별 | 특징 |
|------|------|------|------|
| 1 | alloy | 여성 | 중립적이고 균형 잡힌 음성 |
| 2 | echo | 남성 | 따뜻하고 친근한 음성 |
| 3 | fable | 남성 | 표현력 있는 스토리텔링 음성 |
| 4 | onyx | 남성 | 깊고 권위 있는 음성 |
| 5 | nova | 여성 | 밝고 쾌활한 음성 |
| 6 | shimmer | 여성 | 맑고 선명한 음성 |

### 주요 함수

| 함수 | 역할 |
|------|------|
| `find_env_file()` | 상위 디렉토리를 탐색하여 `.env` 파일 위치 탐색 |
| `load_env()` | `.env` 로드 후 `OPENAI_API_KEY` 반환 |
| `select_language()` | 번역 대상 언어를 사용자에게 선택 요청 |
| `select_voice(speaker)` | 화자별 음성을 사용자에게 선택 요청 |
| `load_dialog(path)` | 파이프 구분자 CSV 대화 파일 로드 |
| `get_speakers(df)` | 등장 순서를 유지한 고유 화자 목록 추출 |
| `translate_text(...)` | GPT-4o-mini로 텍스트 번역 (캐시 우선 사용) |
| `load_translation_cache(lang)` | 언어별 번역 캐시 CSV 로드 |
| `save_translation_cache(lang, cache)` | 번역 캐시 CSV 저장 |
| `generate_tts(text, voice, key)` | OpenAI TTS-1 API로 WAV 바이트 생성 |
| `wav_bytes_to_array(bytes)` | WAV 바이트를 numpy 배열로 변환 |
| `concatenate_segments(...)` | 음성 세그먼트를 0.3초 무음과 함께 연결 |
| `main()` | 전체 파이프라인 실행 |

### 실행 흐름

```
[1] 언어 선택 → [2] dialog.csv 로드 → [3] 화자 감지
    → [4] 화자별 음성 선택 → [5] 번역 캐시 확인
    → [6] 번역 (캐시 미스 시 GPT-4o-mini 호출)
    → [7] 번역 캐시 저장 → [8] TTS 음성 생성
    → [9] 세그먼트 연결 → [10] result.wav 저장
```

---

## 실행 방법

### 1. 의존 라이브러리 설치

```bash
cd hands-on/06.tts/llm
pip install -r requirements.txt
```

### 2. API 키 확인

`agentic-ai/examples/.env` 파일에 `OPENAI_API_KEY` 설정 필요

```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxx
```

### 3. 프로그램 실행

```bash
python tts.py
```

### 4. 대화형 선택

실행 후 순서대로 입력:

```
번역 대상 언어 선택
============================================================
  [1] 한국어 (Korean)
  [2] 영어 (English)
  [3] 중국어 (Chinese)
  [4] 일어 (Japanese)
  [5] 불어 (French)
  [6] 스페인어 (Spanish)
------------------------------------------------------------
언어 번호를 선택하세요 (1-6): 2

--- '부인' 음성 선택 ---
  [1] alloy    (Female) - 중립적이고 균형 잡힌 여성 음성
  [2] echo     (Male  ) - 따뜻하고 친근한 남성 음성
  ...
  음성 번호 (1-6): 5

--- '나' 음성 선택 ---
  음성 번호 (1-6): 2
```

### 5. 출력 확인

```
[완료]
============================================================
  번역 언어  : 영어 (en)
  출력 파일  : .../hands-on/06.tts/llm/result.wav
  재생 시간  : 34.21초
  샘플레이트 : 24000 Hz
============================================================
```

---

## 번역 캐시

### 파일 구조

파이프(`|`) 구분자 CSV 형식으로 저장

**경로:** `hands-on/06.tts/llm/translations/dialog_{lang_code}.csv`

| lang_code | 파일명 |
|-----------|--------|
| `en` | `dialog_en.csv` |
| `zh` | `dialog_zh.csv` |
| `ja` | `dialog_ja.csv` |
| `fr` | `dialog_fr.csv` |
| `es` | `dialog_es.csv` |

**파일 내용 예시 (`dialog_en.csv`):**

```
original|translated
어서 오세요. 차 여기 있어요.|Welcome. The car is here.
어, 지하층 내려왔어요.|Oh, I came down to the basement.
...
```

### 캐시 동작 방식

- 캐시 파일 존재 → 번역 API 호출 없이 캐시 값 사용  
- 캐시 파일 없음 → GPT-4o-mini로 번역 후 캐시 파일 저장  
- 한국어 선택 시 → 번역 생략 (캐시 미사용)

### 캐시 삭제 방법

특정 언어 캐시 삭제:

```bash
rm hands-on/06.tts/llm/translations/dialog_en.csv
```

전체 캐시 삭제:

```bash
rm -rf hands-on/06.tts/llm/translations/
```

---

## 사용 모델

| 용도 | 모델 | 비고 |
|------|------|------|
| 번역 | `gpt-4o-mini` | temperature=0.3, 일관성 있는 번역 |
| 음성 합성 | `tts-1` | 24kHz PCM WAV 출력 |
