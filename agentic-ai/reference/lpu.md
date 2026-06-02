# LPU (Language Processing Unit) & Groq

- [LPU (Language Processing Unit) & Groq](#lpu-language-processing-unit--groq)
  - [LPU 개요](#lpu-개요)
    - [LPU란](#lpu란)
    - [LPU vs GPU 아키텍처 비교](#lpu-vs-gpu-아키텍처-비교)
    - [LPU의 핵심 기술](#lpu의-핵심-기술)
  - [Groq 소개](#groq-소개)
    - [회사 정보](#회사-정보)
    - [Groq Cloud 주요 특징](#groq-cloud-주요-특징)
    - [지원 모델](#지원-모델)
    - [요금 체계](#요금-체계)
  - [Groq API 사용법](#groq-api-사용법)
    - [API Key 발급](#api-key-발급)
    - [Python SDK 설치](#python-sdk-설치)
    - [기본 사용 예제](#기본-사용-예제)
    - [OpenAI SDK 호환 방식](#openai-sdk-호환-방식)
    - [LangChain 연동](#langchain-연동)
  - [AI 모델 5종 속도 비교 테스트](#ai-모델-5종-속도-비교-테스트)
    - [테스트 개요](#테스트-개요)
    - [속도 비교 결과](#속도-비교-결과)
    - [토큰 사용량 비교](#토큰-사용량-비교)
    - [처리 속도 차트](#처리-속도-차트)
  - [분석](#분석)
    - [속도 분석](#속도-분석)
    - [인프라 아키텍처 비교](#인프라-아키텍처-비교)
    - [품질 vs 속도 트레이드오프](#품질-vs-속도-트레이드오프)
    - [용도별 추천](#용도별-추천)
  - [참고 자료](#참고-자료)

AI 추론 전용 프로세서 LPU와 이를 서비스하는 Groq Cloud에 대한
레퍼런스 문서.
5개 AI 모델(Claude, OpenAI, Gemini, Groq)의 텍스트 요약 속도
비교 실험 결과 포함.

---

## LPU 개요

### LPU란

LPU(Language Processing Unit)는 **Groq**이 설계한 AI 추론 전용
프로세서.
GPU가 학습(Training)과 추론(Inference)을 모두 처리하는 범용
아키텍처인 반면, LPU는 **추론만을 위해 설계**된 전용 하드웨어.

| 항목 | 설명 |
|------|------|
| 정식 명칭 | Language Processing Unit |
| 개발사 | Groq, Inc. |
| 목적 | LLM 추론(Inference) 전용 |
| 핵심 원리 | 순차적 텍스트 생성(Autoregressive Decoding) 최적화 |
| 메모리 | SRAM 기반 (HBM 미사용) |

### LPU vs GPU 아키텍처 비교

| 항목 | LPU (Groq) | GPU (NVIDIA) |
|------|-----------|-------------|
| **설계 목적** | 추론 전용 | 학습 + 추론 범용 |
| **메모리** | SRAM (온칩, 초저지연) | HBM (오프칩, 고대역폭) |
| **병목 지점** | 메모리 병목 제거 | 메모리 대역폭이 병목 |
| **연산 방식** | TSP (Temporal Streaming Processor) | CUDA Core 기반 병렬 연산 |
| **배치 처리** | 단일 요청 최적화 | 대규모 배치 최적화 |
| **지연 시간** | 극저지연 (ms 단위 TTFT) | 상대적으로 높은 지연 |
| **처리량** | 높은 토큰/초 | 배치 크기에 비례 |
| **전력 효율** | 높음 (단순 아키텍처) | 상대적으로 낮음 |
| **가격** | 비공개 (클라우드 API로 제공) | GPU당 수천만 원 |

### LPU의 핵심 기술

**1. TSP (Temporal Streaming Processor)**
- Groq의 독자적 프로세서 아키텍처
- 컴파일 타임에 모든 연산 스케줄을 결정 (소프트웨어 정의 하드웨어)
- 런타임 스케줄링 오버헤드 제거

**2. SRAM 기반 메모리**
- 전통적 GPU는 HBM(High Bandwidth Memory)을 사용하여
  메모리 대역폭이 병목
- LPU는 **온칩 SRAM**만 사용하여 메모리 접근 지연을 극소화
- 결정론적(Deterministic) 실행으로 예측 가능한 성능 보장

**3. 결정론적 실행 모델**
- 모든 연산이 사전에 스케줄링되어 실행 시간이 일정
- 캐시 미스, 분기 예측 실패 등 비결정론적 요소 제거
- 일관된 토큰 생성 속도 유지

[Top](#lpu-language-processing-unit--groq)

---

## Groq 소개

### 회사 정보

| 항목 | 내용 |
|------|------|
| 회사명 | Groq, Inc. |
| 설립 | 2016년 |
| 본사 | 미국 캘리포니아 마운틴뷰 |
| 창업자 | Jonathan Ross (전 Google TPU 설계자) |
| 주요 투자 | Tiger Global, D1 Capital 등 |
| 서비스 | Groq Cloud (API), GroqCard (하드웨어) |

### Groq Cloud 주요 특징

- **OpenAI 호환 API**: 기존 OpenAI SDK로 즉시 사용 가능
- **초고속 추론**: GPU 대비 최대 10배 이상 빠른 토큰 생성
- **무료 티어 제공**: 분당 요청 제한 있지만 무료 사용 가능
- **다양한 모델 지원**: Llama, Mixtral, Gemma 등 오픈소스 모델
- **JSON Mode**: 구조화된 출력 지원
- **Tool Use**: Function Calling 지원

### 지원 모델

| 모델 | 파라미터 | 컨텍스트 | 특징 |
|------|----------|----------|------|
| `llama-3.3-70b-versatile` | 70B | 128K | Llama 3.3 범용 |
| `llama-3.1-8b-instant` | 8B | 128K | 초경량 고속 |
| `mixtral-8x7b-32768` | 46.7B | 32K | MoE 아키텍처 |
| `gemma2-9b-it` | 9B | 8K | Google Gemma 2 |
| `openai/gpt-oss-120b` | 120B | - | OpenAI 오픈소스 |

> 지원 모델은 수시로 변경. 최신 목록은
> [Groq Console](https://console.groq.com/docs/models) 참조

### 요금 체계

| 구분 | 내용 |
|------|------|
| 무료 티어 | 분당 30 요청, 일일 14,400 요청 |
| 유료 플랜 | 토큰 단위 과금, 모델별 상이 |
| 과금 기준 | 입력/출력 토큰 별도 과금 |

[Top](#lpu-language-processing-unit--groq)

---

## Groq API 사용법

### API Key 발급

1. [Groq Console](https://console.groq.com) 접속
2. 회원 가입 (Google/GitHub 소셜 로그인 지원)
3. **API Keys** 메뉴에서 키 생성
4. 생성된 키를 `.env` 파일에 저장

```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

### Python SDK 설치

```bash
pip install groq
```

### 기본 사용 예제

```python
from groq import Groq

client = Groq(api_key="your-api-key")

response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    max_tokens=4096,
    messages=[
        {"role": "system", "content": "한국어로 답변하세요."},
        {"role": "user", "content": "양자 컴퓨팅을 설명해주세요."}
    ]
)

print(response.choices[0].message.content)
print(f"입력 토큰: {response.usage.prompt_tokens}")
print(f"출력 토큰: {response.usage.completion_tokens}")
```

### OpenAI SDK 호환 방식

기존 OpenAI SDK를 사용하는 프로젝트에서 `base_url`만 변경하여
Groq를 사용 가능.

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key="your-groq-api-key"
)

response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": "Hello"}]
)
print(response.choices[0].message.content)
```

### LangChain 연동

```python
from langchain_groq import ChatGroq

llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key="your-groq-api-key",
    temperature=0.7,
    max_tokens=4096
)

response = llm.invoke("마이크로서비스 아키텍처를 설명해주세요.")
print(response.content)
```

[Top](#lpu-language-processing-unit--groq)

---

## AI 모델 5종 속도 비교 테스트

### 테스트 개요

| 항목 | 내용 |
|------|------|
| 테스트 일시 | 2026-01-30 |
| 테스트 목적 | 5개 AI 모델의 텍스트 요약 속도 및 품질 비교 |
| 입력 문서 | `agentic-ai/examples/pdf/result_Docling.md` (16,755자) |
| 테스트 코드 | `agentic-ai/examples/groq/groq-summary/summary_compare.py` |

**테스트 대상 모델**

| 모델 | API ID | Provider |
|------|--------|----------|
| Claude Opus 4.5 | `claude-opus-4-5-20251101` | Anthropic |
| Claude Sonnet 4 | `claude-sonnet-4-20250514` | Anthropic |
| OpenAI GPT-4o | `gpt-4o` | OpenAI |
| Gemini 2.0 Flash | `gemini-2.0-flash` | Google |
| Groq (LPU) | `openai/gpt-oss-120b` | Groq |

### 속도 비교 결과

| 순위 | 모델 | 소요 시간 | 출력 토큰 | 처리 속도 (tok/s) | 배수 |
|------|------|----------|----------|------------------|------|
| 1 | **Groq (LPU)** | 7.22초 | 3,291 | **456.1** | 기준 |
| 2 | **Gemini 2.0 Flash** | 8.50초 | 1,271 | 149.4 | 1.2x |
| 3 | **OpenAI GPT-4o** | 14.50초 | 503 | 34.7 | 2.0x |
| 4 | **Claude Sonnet 4** | 33.81초 | 1,458 | 43.1 | 4.7x |
| 5 | **Claude Opus 4.5** | 41.46초 | 2,332 | 56.2 | 5.7x |

> - Groq(LPU)가 **가장 빠른 응답 시간(7.22초)** 기록
> - 토큰 처리 속도 기준 Groq이 **456.1 tok/s**로 압도적 1위
> - Groq은 가장 많은 출력 토큰(3,291)을 생성하면서도 가장 빠름

### 토큰 사용량 비교

| 지표 | Claude Opus 4.5 | Claude Sonnet 4 | OpenAI GPT-4o | Gemini 2.0 Flash | Groq (LPU) |
|------|-----------------|-----------------|---------------|------------------|------------|
| 입력 토큰 | 8,685 | 8,685 | 5,677 | 5,840 | 5,741 |
| 출력 토큰 | 2,332 | 1,458 | 503 | 1,271 | 3,291 |
| 총 토큰 | 11,017 | 10,143 | 6,180 | 7,111 | 9,032 |

> - Claude 모델은 동일 문서에 대해 약 8,685 입력 토큰을 사용하는
>   반면, 다른 모델은 5,600~5,800 토큰 사용 (토크나이저 차이)
> - GPT-4o는 가장 간결한 요약(503 토큰)을 생성
> - Groq은 가장 상세한 요약(3,291 토큰)을 생성

### 처리 속도 차트

```
토큰 처리 속도 (tokens/sec)

Groq (LPU)        ████████████████████████████████████████████████  456.1
Gemini 2.0 Flash  ████████████████                                  149.4
Claude Opus 4.5   ██████                                             56.2
Claude Sonnet 4   █████                                              43.1
OpenAI GPT-4o     ████                                               34.7

                  0       100     200     300     400     500
```

```
응답 시간 (초) - 짧을수록 좋음

Groq (LPU)        ███████                                            7.22
Gemini 2.0 Flash  █████████                                          8.50
OpenAI GPT-4o     ███████████████                                   14.50
Claude Sonnet 4   ██████████████████████████████████                 33.81
Claude Opus 4.5   █████████████████████████████████████████          41.46

                  0       10      20      30      40      50
```

[Top](#lpu-language-processing-unit--groq)

---

## 분석

### 속도 분석

- **1위 Groq (LPU)**: 7.22초, 456.1 tok/s — LPU 아키텍처의
  결정론적 실행과 SRAM 기반 메모리가 압도적 속도의 원인
- **2위 Gemini 2.0 Flash**: 8.50초, 149.4 tok/s — Google TPU
  인프라 기반으로 Groq에 근접한 응답 시간
- **3위 OpenAI GPT-4o**: 14.50초, 34.7 tok/s — 간결한 출력
  (503 토큰)으로 응답 시간은 중간이나 tok/s는 가장 낮음
- **4위 Claude Sonnet 4**: 33.81초, 43.1 tok/s — 중간 수준의
  상세도와 속도
- **5위 Claude Opus 4.5**: 41.46초, 56.2 tok/s — 가장 느리지만
  tok/s는 Sonnet보다 높음 (출력 토큰이 많아 총 시간이 김)

### 인프라 아키텍처 비교

| Provider | 하드웨어 | 특징 |
|----------|----------|------|
| **Groq** | LPU (자체 설계) | SRAM 기반 결정론적 추론, 메모리 병목 제거 |
| **Google** | TPU v5+ | 대규모 텐서 연산 최적화, 자체 설계 칩 |
| **OpenAI** | NVIDIA GPU (추정) | H100/B100 기반 최적화된 추론 인프라 |
| **Anthropic** | NVIDIA GPU + AWS/GCP | 모델 품질과 안전성에 최적화된 인프라 |

### 품질 vs 속도 트레이드오프

| 모델 | 속도 | 출력 상세도 | 구조화 수준 | 종합 품질 |
|------|------|-----------|------------|----------|
| Claude Opus 4.5 | ★☆☆☆☆ | ★★★★★ | ★★★★★ | 최고 |
| Claude Sonnet 4 | ★★☆☆☆ | ★★★★☆ | ★★★★☆ | 높음 |
| OpenAI GPT-4o | ★★★☆☆ | ★★☆☆☆ | ★★★☆☆ | 보통 |
| Gemini 2.0 Flash | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | 보통 |
| Groq (LPU) | ★★★★★ | ★★★★☆ | ★★★★☆ | 높음 |

> - Claude Opus 4.5: 테이블/헤딩 등 가장 체계적인 구조화,
>   정보 누락이 가장 적음
> - Groq: 빠르면서도 상세한 출력 — 속도와 품질 모두 우수
> - GPT-4o: 가장 간결하여 핵심만 빠르게 파악에 적합

### 용도별 추천

| 용도 | 추천 모델 | 사유 |
|------|----------|------|
| **실시간 챗봇** | Groq (LPU) | 초저지연, 높은 tok/s |
| **스트리밍 응답** | Groq 또는 Gemini Flash | 빠른 첫 토큰 생성 |
| **문서 요약 (품질 우선)** | Claude Opus 4.5 | 체계적 구조화, 정보 완전성 |
| **비용 효율적 요약** | Claude Sonnet 4 | 품질/비용 균형 |
| **간결한 요약** | OpenAI GPT-4o | 핵심만 추출 |
| **대량 배치 처리** | Groq 또는 Gemini Flash | 높은 처리량 |
| **RAG 파이프라인** | Groq | 빠른 응답으로 사용자 경험 향상 |
| **프로토타이핑** | Groq (무료 티어) | 무료 + 빠른 속도 |

[Top](#lpu-language-processing-unit--groq)

---

## 참고 자료

- [Groq 공식 문서](https://console.groq.com/docs)
- [Groq Python SDK GitHub](https://github.com/groq/groq-python)
- [Groq Blog - LPU Architecture](https://groq.com/technology/)
- [테스트 코드](../examples/groq/groq-summary/summary_compare.py)
- [테스트 결과 데이터](../examples/groq/groq-summary/results.json)
- [평가 보고서](../examples/groq/groq-summary/evaluate.md)

[Top](#lpu-language-processing-unit--groq)
