# Groq LPU 텍스트 요약 예제

## 개요
Groq LPU와 `openai/gpt-oss-120b` 모델을 사용하여 마크다운 문서를 요약하는 예제임.  
입력 파일 `result_Docling.md`를 읽고 요약 결과를 `summary.txt`로 저장함.  

| 항목 | 내용 |
|------|------|
| 실행 위치 | `hands-on/03.summary/groq/` |
| 입력 파일 | `result_Docling.md` |
| 실행 파일 | `summary.py` |
| 출력 파일 | `summary.txt` |
| API | Groq Chat Completions API |
| 모델 | `openai/gpt-oss-120b` |

## 파일 구조
```text
hands-on/03.summary/groq/
├── result_Docling.md    # 입력 파일
├── summary.py           # Groq LPU 기반 요약 프로그램
├── summary.txt          # 요약 결과 파일, 실행 후 생성
└── README.md            # 실행 안내 문서
```

## 소스 코드 설명

### 전체 흐름
`summary.py`는 입력 파일 읽기, 마크다운 정리, 긴 문서 청크 분할, Groq API 호출, 최종 요약 통합, 결과 저장의  
순서로 동작함.  

```text
result_Docling.md
    -> 마크다운 정리
    -> 청크 분할
    -> 청크별 요약
    -> 최종 통합 요약
    -> summary.txt 저장
```

### 주요 함수
| 함수 | 역할 |
|------|------|
| `read_text_file()` | UTF-8, UTF-8-SIG, CP949, EUC-KR 순서로 입력 파일 읽기 |
| `clean_markdown()` | 이미지 태그, 표 구분선, 불필요한 공백 정리 |
| `split_text()` | 긴 문서를 지정된 문자 수 기준으로 청크 분할 |
| `load_environment()` | 현재 디렉터리와 `agentic-ai/examples/.env`에서 환경 변수 로드 |
| `create_groq_client()` | `GROQ_API_KEY` 기반 Groq 클라이언트 생성 |
| `call_groq()` | Groq Chat Completions API 호출 및 사용량 정보 추출 |
| `summarize_text()` | 청크별 요약과 최종 통합 요약 수행 |
| `write_text_file()` | 요약 결과를 UTF-8 파일로 저장 |

### 핵심 설정
```python
DEFAULT_MODEL_ID = "openai/gpt-oss-120b"
DEFAULT_MAX_CHUNK_CHARS = 12000
DEFAULT_MAX_COMPLETION_TOKENS = 2048
```

`openai/gpt-oss-120b`는 reasoning 모델이므로 기본값으로 `reasoning_effort="low"`와  
`reasoning_format="hidden"`을 사용함.  
요약 실습에서는 추론 과정을 출력하지 않고 최종 요약만 저장하기 위한 설정임.  

## 가상환경 설정 및 실행 방법

### 1. 예제 디렉터리 이동
```bash
cd hands-on/03.summary/groq
```

### 2. 가상환경 생성 및 활성화
```bash
# Windows PowerShell / CMD
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python -m venv venv
source venv/bin/activate
```

### 3. 패키지 설치
```bash
pip install -r requirements.txt
```

### 4. API Key 설정
`agentic-ai/examples/.env` 또는 현재 디렉터리의 `.env` 파일에 Groq API Key 설정 필요.  

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

현재 프로그램은 실행 디렉터리부터 상위 디렉터리까지 `.env` 파일을 자동 탐색함.  
또한 각 상위 디렉터리 아래의 `agentic-ai/examples/.env`도 함께 탐색함.  

```text
hands-on/03.summary/groq/.env
hands-on/03.summary/.env
hands-on/.env
프로젝트 루트/.env
프로젝트 루트/agentic-ai/examples/.env
```

### 5. 실행
```bash
python summary.py
```

### 6. 결과 확인
```bash
# Windows
type summary.txt

# macOS / Linux
cat summary.txt
```

## 실행 옵션
```bash
python summary.py \
  --input result_Docling.md \
  --output summary.txt \
  --model openai/gpt-oss-120b \
  --max-chunk-chars 12000 \
  --max-completion-tokens 2048 \
  --temperature 0.2 \
  --reasoning-effort low \
  --reasoning-format hidden
```

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--input` | `result_Docling.md` | 요약 대상 파일 |
| `--output` | `summary.txt` | 요약 결과 저장 파일 |
| `--model` | `openai/gpt-oss-120b` | Groq에서 사용할 모델 ID |
| `--max-chunk-chars` | `12000` | 청크 1개당 최대 문자 수 |
| `--max-completion-tokens` | `2048` | API 호출당 최대 출력 토큰 수 |
| `--temperature` | `0.2` | 생성 다양성 조절 |
| `--top-p` | `0.9` | nucleus sampling 기준값 |
| `--reasoning-effort` | `low` | GPT-OSS reasoning 강도, `low`, `medium`, `high` 중 선택 |
| `--reasoning-format` | `hidden` | reasoning 출력 방식, 최종 답변만 저장하려면 `hidden` 사용 |

## 참고 자료
- [Groq GPT OSS 120B 모델 문서](https://console.groq.com/docs/model/openai/gpt-oss-120b)  
- [Groq Reasoning 문서](https://console.groq.com/docs/reasoning)  
- [Groq OpenAI Compatibility 문서](https://console.groq.com/docs/openai)  
