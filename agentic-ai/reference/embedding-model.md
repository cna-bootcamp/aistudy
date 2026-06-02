# 임베딩 모델

- [임베딩 모델](#임베딩-모델)
  - [개요](#개요)
    - [임베딩 모델이란?](#임베딩-모델이란)
    - [임베딩 모델의 필요성](#임베딩-모델의-필요성)
    - [모델 선택 시 고려 요소](#모델-선택-시-고려-요소)
  - [MTEB Multilingual v2 리더보드 (2025년 11월 기준)](#mteb-multilingual-v2-리더보드-2025년-11월-기준)
    - [상위 20개 모델](#상위-20개-모델)
  - [주요 임베딩 모델 비교](#주요-임베딩-모델-비교)
  - [한국어 특화 모델](#한국어-특화-모델)
  - [선택 가이드](#선택-가이드)
    - [용도별 추천](#용도별-추천)
    - [크기별 추천 (오픈소스)](#크기별-추천-오픈소스)
    - [MTEB 평가 Task Types](#mteb-평가-task-types)
      - [Top 3 평가 Task Types ⭐](#top-3-평가-task-types-)
      - [용어 설명](#용어-설명)
  - [참고 자료](#참고-자료)

---

## 개요

### 임베딩 모델이란?

텍스트, 이미지, 오디오 등 비정형 데이터를 고차원 숫자 벡터로 변환하는 모델.  
변환된 벡터는 의미적 특성을 보존하여, 유사한 의미의 데이터는  
벡터 공간에서 가까운 위치에 배치됨.

```
"고양이" → [0.12, -0.34, 0.56, ...]  (1024차원 벡터)
"cat"    → [0.11, -0.33, 0.55, ...]  (유사한 벡터)
"자동차" → [0.87, 0.23, -0.45, ...]  (다른 벡터)
```

### 임베딩 모델의 필요성

| 필요성 | 설명 |
|--------|------|
| **시맨틱 검색** | 키워드 일치가 아닌 의미 기반 검색 가능 |
| **RAG** | LLM에 외부 지식 주입 시 관련 문서 검색에 필수 |
| **추천 시스템** | 사용자-아이템 간 유사도 계산으로 개인화 추천 |
| **클러스터링** | 유사 문서/데이터 자동 그룹화 |
| **이상 탐지** | 정상 패턴과의 거리 계산으로 이상치 탐지 |
| **중복 제거** | 유사 문서/이미지 탐지 및 제거 |

### 모델 선택 시 고려 요소
- **MTEB (Massive Text Embedding Benchmark)**: 임베딩 모델 성능 평가 표준 벤치마크
- **차원 (Dimension)**: 벡터 크기. 클수록 표현력 높으나 저장/연산 비용 증가
- **최대 토큰**: 한 번에 처리 가능한 입력 길이

[Top](#임베딩-모델)

---

## MTEB Multilingual v2 리더보드 (2025년 11월 기준)

> **벤치마크 정보**: 1038개 언어, 131개 태스크, 9개 태스크 타입  
> **출처**: [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard)

### 상위 20개 모델

| 순위 | 모델 | Retrieval | STS | Class | 파라미터 | 차원 | 최대 토큰 | 유형 |
|------|------|-----------|-----|-------|----------|------|-----------|------|
| 1 | KaLM-Embedding-Gemma3-12B-2511 | 75.66 | 79.02 | 77.88 | 11.8B | 3840 | 32768 | 오픈소스 |
| 2 | llama-embed-nemotron-8b | 68.69 | 79.41 | 73.21 | 7.5B | 4096 | 32768 | 오픈소스 (NVIDIA) |
| 3 | Qwen3-Embedding-8B | 70.88 | 81.08 | 74.00 | 7.6B | 4096 | 32768 | 오픈소스 |
| 4 | gemini-embedding-001 | 67.71 | 79.40 | 71.82 | - | 3072 | 2048 | 상용 API (Google) |
| 5 | Qwen3-Embedding-4B | 69.60 | 80.86 | 72.33 | 4.0B | 2560 | 32768 | 오픈소스 |
| 6 | Octen-Embedding-8B | 71.61 | 81.27 | 66.68 | 7.6B | 4096 | 32768 | 오픈소스 |
| 7 | Seed1.6-embedding-1215 | 66.05 | 75.92 | 76.75 | - | 2048 | 32768 | 상용 API (ByteDance) |
| 8 | Qwen3-Embedding-0.6B | 64.65 | 76.17 | 66.83 | 0.6B | 1024 | 32768 | 오픈소스 |
| 9 | gte-Qwen2-7B-instruct | 60.08 | 73.98 | 61.55 | 7.6B | 3584 | 32768 | 오픈소스 (Alibaba) |
| 10 | Linq-Embed-Mistral | 58.69 | 74.86 | 62.24 | 7.1B | 4096 | 32768 | 오픈소스 |
| 11 | multilingual-e5-large-instruct | 57.12 | 76.81 | 64.94 | 0.56B | 1024 | 514 | 오픈소스 (MS) |
| 12 | embeddinggemma-300m | 62.49 | 74.73 | 60.90 | 0.3B | 768 | 2048 | 오픈소스 (Google) |
| 13 | SFR-Embedding-Mistral | 59.44 | 74.79 | 60.02 | 7.1B | 4096 | 32768 | 오픈소스 (Salesforce) |
| 14 | text-multilingual-embedding-002 | 59.68 | 76.11 | 64.64 | - | 768 | 2048 | 상용 API (Google) |
| 18 | **Cohere-embed-multilingual-v3.0** | 59.22 | 74.80 | 62.95 | - | 512 | - | 상용 API |
| 28 | **voyage-3.5** | 64.01 | 69.97 | 58.54 | - | 1024 | 32000 | 상용 API |
| 30 | **bge-m3** | 54.60 | 74.12 | 60.35 | 0.57B | 1024 | 8194 | 오픈소스 (BAAI) |
| 41 | **text-embedding-3-small** (OpenAI) | 50.69 | 69.42 | 55.22 | - | 1536 | 8191 | 상용 API |

[Top](#임베딩-모델)

---

## 주요 임베딩 모델 비교

| 모델 | 오픈/상용 | 제공사 | 크기 | 장점 | 단점 |
|------|-----------|--------|------|------|------|
| text-embedding-3 | 상용 | OpenAI | large, small | 안정적 API, 차원 축소 지원 | 다국어 성능 낮음 (41위) |
| gemini-embedding | 상용 | Google | - | 상용 API 중 최고 성능 (4위) | 최대 토큰 2048 제한 |
| Cohere embed | 상용 | Cohere | v3, v4, light | 다국어 강점 (18위), 128K (v4) | 영어 전용 모델 성능 낮음 |
| Voyage | 상용 | Voyage AI | 3.5, 3, lite | 도메인 특화 (코드/법률/금융), 32K | 범용 성능 중간 (28위) |
| KaLM-Embedding-Gemma3 | 오픈 | KaLM | 12B | 현재 SOTA (1위) | 고사양 GPU 필요 |
| llama-embed-nemotron | 오픈 | NVIDIA | 8B | 오픈소스 최상위 (2위) | 대용량 GPU 필요 |
| Qwen3-Embedding | 오픈 | Alibaba | 8B, 4B, 0.6B | 크기 대비 최고 (3~8위), 다양한 크기 | 대형 모델은 GPU 필요 |
| E5 | 오픈 | Microsoft | large, mistral-7b | MIT 라이센스, 다국어 우수 (11위) | prefix 필요 (query:/passage:) |
| BGE | 오픈 | BAAI | m3, large, small | 8K 토큰, 다국어, Dense+Sparse | 영어 전용 성능 중간 |
| embeddinggemma | 오픈 | Google | 300m | 경량 (12위), 무료 | 최대 토큰 2048 제한 |

[Top](#임베딩-모델)

---

## 한국어 특화 모델

한국어 임베딩 추천 모델:

| 모델 | 출처 | 특징 | 추천 용도 |
|------|------|------|-----------|
| ko-sroberta-multitask | KoSentence | 한국어 특화 SBERT | 한국어 전용 |
| KoSimCSE | KAIST | SimCSE 한국어 버전 | 연구/실험 |
| **multilingual-e5-large-instruct** | Microsoft | MTEB 11위 | **다국어 최고** |
| **Qwen3-Embedding** | Alibaba | MTEB 3~8위 | **한중일 우수** |
| **bge-m3** | BAAI | MTEB 30위 | 다국어 검색 |
| Cohere embed-multilingual | Cohere | 상용 API | 간편한 API |

```python
# 한국어 특화 모델 사용 예시
from sentence_transformers import SentenceTransformer

# 추천: 다국어 고성능
model = SentenceTransformer("intfloat/multilingual-e5-large-instruct")

# 한국어 전용 경량
model = SentenceTransformer("jhgan/ko-sroberta-multitask")

sentences = ["안녕하세요", "반갑습니다"]
embeddings = model.encode(sentences)
```

[Top](#임베딩-모델)

---

## 선택 가이드

### 용도별 추천

| 용도 | 추천 모델 | MTEB 순위 | 이유 |
|------|-----------|-----------|------|
| **최고 성능** | KaLM-Embedding-Gemma3-12B | 1위 | SOTA |
| **상용 API 최고** | gemini-embedding-001 | 4위 | Google API |
| **오픈소스 최고** | llama-embed-nemotron-8b | 2위 | NVIDIA |
| **다국어/한국어** | multilingual-e5-large-instruct | 11위 | MS, 0.56B |
| **경량 + 고성능** | Qwen3-Embedding-0.6B | 8위 | 0.6B로 8위 |
| **긴 문서 (8K+)** | bge-m3 | 30위 | 8K 토큰 |
| **128K 컨텍스트** | Cohere embed-v4.0 | 신규 | 128K 지원 |
| **코드 검색** | voyage-code-3 | 182위 | 코드 특화 |
| **법률 도메인** | voyage-law-2 | 167위 | 법률 특화 |
| **가성비 API** | text-embedding-3-small | 41위 | $0.02/1M |

### 크기별 추천 (오픈소스)

| GPU 메모리 | 추천 모델 | 파라미터 | MTEB 순위 |
|------------|-----------|----------|-----------|
| 24GB+ | Qwen3-Embedding-8B | 7.6B | 3위 |
| 16GB | Qwen3-Embedding-4B | 4.0B | 5위 |
| 8GB | Qwen3-Embedding-0.6B | 0.6B | 8위 |
| 4GB | bge-m3 | 0.57B | 30위 |
| 2GB | bge-small-en-v1.5 | 0.03B | 90위 |

### MTEB 평가 Task Types

MTEB는 9가지 태스크 유형으로 임베딩 모델의 다양한 능력을 평가함.

| Task Type | 측정 내용 | 평가 방법 | 주요 메트릭 | 활용 사례 |
|-----------|-----------|-----------|-------------|-----------|
| **Zero-shot** | 태스크별 학습 없이 범용 성능 | 사전학습 모델 그대로 평가 | 각 태스크 메트릭 | 범용 임베딩 모델 평가 |
| **Mean(Task)** | 전체 태스크 평균 성능 | 모든 개별 태스크 점수 평균 | 0-100 점수 | 모델 간 종합 비교 |
| **Mean(TaskType)** | 태스크 유형별 평균 성능 | 9개 유형별 점수 동일 가중 평균 | 0-100 점수 | 유형별 균형 성능 비교 |
| **Retrieval** ⭐ | 쿼리-문서 검색 정확도 | 쿼리로 관련 문서 검색 | nDCG@10, MRR | RAG, 검색 엔진, Q&A |
| **STS** ⭐ | 문장 간 의미 유사도 | 문장 쌍의 유사도 점수 예측 | Spearman 상관계수 | 중복 탐지, 의미 비교 |
| **Classification** ⭐ | 텍스트 분류 정확도 | 임베딩으로 분류 모델 학습 | Accuracy, F1 | 감성 분석, 스팸 필터링 |
| **Clustering** | 유사 문서 그룹화 능력 | K-means 등 클러스터링 후 평가 | V-measure | 문서 그룹화, 토픽 분류 |
| **Reranking** | 검색 결과 재정렬 정확도 | 후보 문서 관련성 순위 재정렬 | MAP, MRR | 검색 품질 개선, 추천 |
| **Pair Classification** | 문장 쌍 관계 분류 | 두 문장의 관계(함의/모순 등) 분류 | Accuracy, F1 | NLI, 팩트 체크 |
| **Bitext Mining** | 다국어 문장 정렬 | 언어 간 동일 의미 문장 매칭 | F1, Accuracy | 번역 정렬, 다국어 검색 |
| **Instruction Reranking** | 지시문 기반 재정렬 | 사용자 지시에 맞는 문서 재정렬 | MAP, nDCG | 맞춤 검색, 대화형 검색 |
| **Multilabel Classification** | 다중 레이블 분류 | 하나의 텍스트에 여러 레이블 할당 | F1 (micro/macro) | 태그 자동화, 다중 분류 |

#### Top 3 평가 Task Types ⭐

| 순위 | Task Type | 중요도 | 중요한 이유 |
|------|-----------|--------|-------------|
| 1 | **Retrieval** | ⭐⭐⭐⭐⭐ | RAG/검색이 임베딩 최대 활용처. 검색 품질 = 서비스 품질 |
| 2 | **STS** | ⭐⭐⭐⭐ | 의미 유사도 측정은 임베딩의 본질적 능력. 기초 역량 지표 |
| 3 | **Classification** | ⭐⭐⭐⭐ | 가장 보편적인 NLP 다운스트림 태스크. 전이 학습 품질 측정 |

> **선택 팁**: RAG/검색 서비스는 Retrieval 우선, 범용 목적은 STS+Retrieval 균형, 텍스트 분류는 Classification 확인

#### 용어 설명

- **nDCG (Normalized Discounted Cumulative Gain)**: 검색 순위 품질 측정.  
  상위 결과의 관련성을 가중치로 반영
- **MRR (Mean Reciprocal Rank)**: 첫 번째 정답이 나타나는 순위의 역수 평균
- **MAP (Mean Average Precision)**: 각 쿼리별 평균 정밀도의 평균
- **Spearman 상관계수**: 예측 유사도와 실제 유사도의 순위 상관관계
- **V-measure**: 클러스터링의 동질성(homogeneity)과
  완전성(completeness) 조화 평균
- **F1 Score**: 정밀도(Precision)와 재현율(Recall)의 조화 평균

[Top](#임베딩-모델)

---

## 참고 자료

- [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard) - 공식 벤치마크
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [Cohere Embed Documentation](https://docs.cohere.com/docs/embeddings)
- [Sentence Transformers](https://www.sbert.net/) - 오픈소스 임베딩
- [BGE GitHub](https://github.com/FlagOpen/FlagEmbedding)
- [Qwen3-Embedding](https://huggingface.co/Qwen/Qwen3-Embedding-8B)

[Top](#임베딩-모델)
