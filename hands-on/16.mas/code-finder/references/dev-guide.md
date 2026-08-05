# 개발 가이드

## 3. 기술 모듈 카탈로그

표기 규칙
- `[고정]`: 확정 사양 — 변경이 필요하면 사용자에게 문의
- `[기준]`: 조건→선택 규칙 — 선택 결과와 근거를 README에 기록

### 3.1 LangChain 공통 
- [고정] 프롬프트는 시스템 프롬프트와 유저 프롬프트 명확히 분리
- [고정] LangGraph로 단일 MAS 워크플로우 구현  
  노드 간 데이터 공유는 StateGraph의 State(Reducer)로 구현
- [고정] 세션 체크포인트(중단 복구·재개)로 MemorySaver(InMemory)와 SqliteSaver(로컬파일)중 어떤것을 사용할 지 사용자에게 선택 받음
- [고정] Output Parser 대신 Structured Output 사용
- [기준] LCEL 체인 실행 방식 선택
  - UI 스트리밍 + 병렬 도구 호출 → 비동기 스트리밍(astream)
  - UI 스트리밍만 필요 → 동기 스트리밍(stream)
  - 배치·백그라운드 처리 → 비동기(ainvoke)
  - 단발 검증·스크립트 → 동기(invoke)

### 3.2 LLM
- [고정] Groq LPU 사용, 모델은 OpenAI gpt-oss-120b
- [고정] 기본 파라미터: temperature 0(재현성 우선), timeout 30초, 429 응답 시 지수 백오프 재시도 2회
- [기준] 멀티 LLM(Claude/OpenAI/Gemini) 연동은 요청에 해당 기능이 명시된 경우에만 포함하고  
  provider별 사양은 요청서에 정의

### 3.3 Tool 인터페이스 (도구 호출·ReAct 루프 필요 시)
- [고정] create_agent 함수로 ReAct 루프 구현
- [고정] 최대 반복 상한 기본 7회, 도구 실패 시 observation 반환 후 재시도, 상한 초과 시 종료 후 보고

### 3.4 RAG (예제 코드 유사도 검색 필요 시)
- Indexer
  - [고정] 인덱싱 대상 코드: `~/workspace/aistudy/hands-on/*`
  - [고정] 임베딩 모델: `OpenAI text-embedding-3-large`
  - [고정] 청킹 사이즈 500토큰, 오버랩 사이즈 100토큰
  - [고정] VectorDB는 Chroma DB 사용
  - [기준] 구분자: 코드 파일은 함수·클래스 경계 우선(언어별 스플리터 사용),  
    미지원 언어만 문자 기준 분할로 폴백
  - 임베딩 전처리: 함수 시그니처+독스트링+파일 경로를 청크 프리픽스로 결합
- Retriever
  - [고정] 하이브리드 서치: BM25 + Vector DB, 가중치는 0.4/0.6으로 함
  - [고정] 벡터DB 서치타입: mmr, top-k: 5, fetch-k: 10
  - 완료조건 연계: §3.7 평가 절차 준용 — RAGAS(Context Recall·Precision,  
    Faithfulness·Answer Relevancy) 실측값 기록

### 3.5 GraphRAG (교재 지식그래프 검색 필요 시)
- [고정] 개발 프레임워크: LangChain + Neo4j
- Indexer
  - [고정] 대상 소스: `~/workspace/aistudy/agentic-ai/textbook/*.md`
  - [고정] 비동기 병렬 수행
  - [기준] Entity/Relation Types 제한: 교재 샘플 청크에서 후보를 추출한 뒤  
    사용자 검토로 확정하고 설정 파일로 관리
  - [고정] Global 검색 지원 시 커뮤니티 탐지·요약 인덱싱 단계 포함
- Retriever
  - [기준] 검색 모드 선택: 특정 개체 중심 질의 → Local, 주제 요약형 질의 → Global,  
    복합·판단 모호 → Hybrid
  - 완료조건 연계: §3.7 평가 절차 준용, 검색 모드별 지표 실측값 기록  
    - Local 질의: RAGAS(Context Recall·Precision) + NDCG(순위 품질)  
    - Global 질의: RAGAS(Faithfulness·Answer Relevancy)로 요약 답변 평가  
  - NDCG(Normalized Discounted Cumulative Gain, 정규화 할인 누적 이득): 검색 결과의  
    순위 품질 지표. 관련도 높은 항목이 상위에 올수록 점수가 높고, 하위로 갈수록  
    할인(가중치 감소) 적용. 0~1로 정규화되어 값이 클수록 순위가 우수함

### 3.6 RAG/GraphRAG 공통 검색 처리 기법
- [기준] Pre Techniques 적용 — 해당 조건의 기법만 조합
  - 짧거나 모호한 질의 → Query Rewriting
  - 다각도 검색 필요 → Multi Query
  - 질의-문서 어휘 불일치 → HyDE
  - 추상 개념 질의 → Step-back
- [고정] Post Technique 적용: Re-ranking (모델은 Cohere 리랭킹 모델 사용)

### 3.7 검색 품질 평가 (RAG·GraphRAG 공통)
- [고정] 평가 프레임워크: RAGAS 사용 (검색+생성 품질을 LLM 기반으로 정량 측정)
- [고정] 평가용 테스트셋: 질문·정답(ground truth)·기대 문맥(reference contexts)을  
  라벨링한 쿼리셋 사용, 회귀 평가용으로 버전 관리
- [고정] 핵심 지표
  - Context Recall(문맥 재현율): 정답에 필요한 문맥을 빠짐없이 검색했는가
  - Context Precision(문맥 정밀도): 검색된 문맥 상위에 관련 청크가 위치하는가
  - Faithfulness(충실성): 생성 답변이 검색 문맥에 근거하는가(환각 탐지)
  - Answer Relevancy(답변 관련성): 답변이 질문 의도에 부합하는가
- [기준] 지표 보완: 순위 품질은 RAGAS 미제공 → NDCG를 별도 계산하여 함께 기록  
  (GraphRAG Local 질의 등 순위가 중요한 경우 필수)
- 완료조건 연계: RAGAS 실측 점수표(지표별 값)와 NDCG 실측값을 산출물에 첨부

### 3.8 Web/YouTube 서치 (외부 최신 정보 필요 시)
- Web서치
  - [고정] DuckDuckGo + BeautifulSoup
  - [고정] 최근 6개월 데이터만 검색, 최대 결과수 10
  - [고정] 실패 처리 기본값: 지수 백오프 재시도 3회, 타임아웃 5초,  
    403/429는 즉시 중단 후 보고
- YouTube 서치
  - [고정] 영상검색: YouTube Data API, 최근 6개월 + 조회수 최소 1,000 이상, 최대 결과수 10
  - [고정] 자막 로드: YouTubeLoader 사용
  - 쿼터 초과 시 캐시 반환, 자막 없는 영상은 스킵 후 로그 기록
- 수집 데이터에 fetched_at 메타데이터 기록, 신선도 필터(6개월)는 이 필드 기준으로 적용

### 3.9 개발 디렉토리
- 프론트엔드: `front/` — 기술 스택·하위 구조는 요청 시 명시(미정 시 사용자 문의)
- 백엔드: `app/{service}`, `app/common/`
- 수집 파이프라인: `crawler/web`, `crawler/youtube`
- RAG: `rag/indexer`, `rag/retriever`, `rag/store`
- GraphRAG: `kg/indexer`, `kg/retriever`, `kg/store`

