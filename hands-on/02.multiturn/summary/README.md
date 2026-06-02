# OpenAI 멀티턴 여행 플래너 — 슬라이딩 윈도우 + 요약 방식

## 개요

OpenAI `gpt-4o-mini`를 사용하여 멀티턴 대화로 여행지 관광지를 추천하는 예제임.  
**슬라이딩 윈도우 + 요약 방식**: 대화가 길어질수록 오래된 메시지를 LLM으로 요약 압축하고  
최근 `WINDOW_SIZE`개 메시지만 메모리에 유지하여 토큰 사용량을 일정하게 유지함.

| 항목 | 내용 |
|------|------|
| 실행 위치 | `hands-on/02.multiturn/summary/` |
| 실행 파일 | `travel_planner.py` |
| API | OpenAI Chat Completions API |
| 모델 | `gpt-4o-mini` |
| 대화 방식 | 슬라이딩 윈도우 + 요약 (Sliding Window + Summary) |
| WINDOW_SIZE | 6 (최근 유지할 메시지 수) |
| SUMMARY_THRESHOLD | 8 (요약 시작 기준) |

## 전체 히스토리 방식과 비교

| 구분 | 전체 히스토리 | 슬라이딩 윈도우 + 요약 |
|------|--------------|----------------------|
| API 전송량 | 대화 길이에 비례해 증가 | WINDOW_SIZE + 요약으로 일정 유지 |
| 토큰 비용 | 대화 길수록 증가 | 일정 수준으로 제한 |
| 과거 맥락 | 완전 보존 | 요약으로 압축 보존 |
| 구현 복잡도 | 단순 | 요약 로직 추가 |

> **주의**: `WINDOW_SIZE < len(conversation) ≤ SUMMARY_THRESHOLD` 구간에서는 윈도우 밖 메시지가  
> 아직 요약되지 않은 상태로 API에 미전송됨. `SUMMARY_THRESHOLD` 초과 시 압축이 발동되면 해소됨.

## 파일 구조

```text
hands-on/02.multiturn/summary/
├── travel_planner.py   # 슬라이딩 윈도우 + 요약 여행 플래너
├── requirements.txt    # 의존 패키지 목록
└── README.md           # 실행 안내 문서
```

## 소스 코드 설명

### 핵심 동작 원리

```text
매 턴 처리 흐름:
  사용자 입력
      → conversation에 추가
      → build_context() = [system] + [요약(있으면)] + conversation[-6:]
      → OpenAI API 호출
      → 응답 conversation에 추가
      → 상태 표시 (전체/메모리/API 전송/요약 여부)
      → len(conversation) > 8 이면 maybe_compress() 실행
          └─ to_evict = conversation[:-6]   ← 오래된 메시지
          └─ summary = LLM 요약(기존요약 + to_evict)  ← 누적 요약
          └─ conversation = conversation[-6:]  ← 최근 6개만 유지
```

### 주요 함수

#### `build_context(summary, conversation)`

API에 전송할 메시지 목록을 구성함. 요약이 있으면 system 역할로 삽입함.

```python
messages = [{"role": "system", "content": SYSTEM_PROMPT}]
if summary:
    messages.append({"role": "system", "content": f"[이전 대화 요약]\n{summary}"})
messages.extend(conversation[-WINDOW_SIZE:])
```

#### `summarize(prev_summary, to_evict)`

기존 요약과 퇴거 메시지를 합쳐 누적 요약을 생성함.  
여행지/기간/인원 정보가 요약에서 소실되지 않도록 프롬프트에 명시함.

#### `maybe_compress(summary, conversation)`

`len(conversation) > SUMMARY_THRESHOLD` 초과 시 슬라이딩 윈도우 압축을 수행함.  
API 호출 이후에 실행되어 현재 턴의 응답 품질에 영향을 주지 않음.

### 상태 표시 예시

```text
  (전체: 4턴 | 메모리: 9개 | API 전송: 6개 | 요약: 없음)  ← 압축 직전 턴
  (전체: 5턴 | 메모리: 8개 | API 전송: 7개 | 요약: 있음)  ← 압축 이후 첫 턴
```

> 상태는 API 호출 직후, 압축 실행 전에 출력됨.  
> **메모리**는 압축 후 `WINDOW_SIZE`(6)개로 감소하며, 그 다음 턴부터 다시 누적됨.

- **전체**: 누적 사용자 입력 횟수 (압축 이후에도 감소하지 않음)
- **메모리**: 현재 `conversation` 리스트 크기 (압축 후 WINDOW_SIZE로 감소)
- **API 전송**: 실제 API에 전달된 메시지 수 (system 제외)
- **요약**: 누적 요약 보유 여부

## 환경 설정

### API Key 설정

`hands-on/.env` 파일에 OpenAI API Key 설정 필요함.

```env
OPENAI_API_KEY=sk-...
```

### 가상환경 설정 (Windows / PowerShell)

```powershell
cd hands-on\02.multiturn\summary
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)

```bash
cd hands-on/02.multiturn/summary
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)

```bash
cd hands-on/02.multiturn/summary
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 실행

```bash
python travel_planner.py
```

### 실행 예시

```text
==========================================================
  여행 플래너 (멀티턴 · 슬라이딩 윈도우 + 요약 방식)
  윈도우: 6개  |  요약 기준: 8개 초과 시
  종료하려면 'quit', 'exit', '종료' 입력
==========================================================

[AI] 안녕하세요! 여행 플래너입니다. 어디로 여행을 계획하고 계신가요?

[나] 도쿄요

[AI] 도쿄 좋은 선택이에요! 여행 기간은 어떻게 생각하고 계신가요?
  (전체: 1턴 | 메모리: 3개 | API 전송: 2개 | 요약: 없음)

...

  ┌─ [요약 실행] 3개 메시지 압축 중...
  └─ [요약 완료] 메모리 6개 유지

[나] 관광지 더 알려줘

[AI] 추가 관광지를 알려드릴게요! ...
  (전체: 5턴 | 메모리: 8개 | API 전송: 7개 | 요약: 있음)
```

### 종료 방법

대화 중 `quit`, `exit`, `종료` 중 하나를 입력하면 프로그램이 종료됨.
