# n8n 용어집

## AI 관련 용어

### AI Agent
AI 시스템이 자율적으로 작업을 수행하고 의사결정을 내리는 개체
n8n에서는 LangChain을 통해 AI Agent 구축 가능

**특징**:
- 목표 지향적 행동
- 환경 인식 및 반응
- 도구 사용 능력
- 자율적 의사결정

**사용 예**:
- 고객 지원 챗봇
- 데이터 분석 자동화
- 작업 스케줄링 및 우선순위 지정

### AI Chain
여러 AI 작업을 순차적으로 연결한 처리 파이프라인

**구성요소**:
- Prompt 템플릿
- LLM 호출
- 출력 파서
- 메모리

**일반적인 체인**:
- Simple Chain: 단일 프롬프트와 응답
- Sequential Chain: 여러 단계의 순차 처리
- Router Chain: 조건에 따라 경로 분기

### AI Completion
LLM이 주어진 입력에 대해 텍스트를 생성하는 프로세스

**사용 사례**:
- 텍스트 생성
- 질문 답변
- 코드 작성
- 번역
- 요약

**파라미터**:
- Temperature: 창의성 조절 (0-1)
- Max Tokens: 최대 출력 길이
- Stop Sequences: 생성 중단 조건

### AI Embedding
텍스트를 고차원 벡터 공간의 수치 표현으로 변환하는 기법

**특징**:
- 의미적 유사성 보존
- 벡터 간 거리로 유사도 측정
- 고정된 차원의 벡터 생성

**활용**:
- 의미 검색
- 텍스트 분류
- 클러스터링
- 추천 시스템

**주요 모델**:
- OpenAI Embeddings
- Google PaLM Embeddings
- Cohere Embeddings

### AI Groundedness
AI 응답이 제공된 컨텍스트나 소스에 얼마나 충실한지 측정하는 지표

**중요성**:
- Hallucination 방지
- 신뢰성 향상
- 사실 기반 응답 보장

**측정 방법**:
- 소스 인용 검증
- 사실 확인
- 컨텍스트 일치도 평가

### AI Hallucination
AI 모델이 사실이 아니거나 입력 데이터에 없는 정보를 생성하는 현상

**원인**:
- 학습 데이터 부족
- 과도한 일반화
- 컨텍스트 부족
- 높은 Temperature 설정

**완화 방법**:
- RAG 사용
- Temperature 낮추기
- 명확한 프롬프트
- Groundedness 검증

### AI Reranking
검색 결과를 관련성에 따라 재정렬하는 프로세스

**작동 방식**:
1. 초기 검색으로 후보 문서 수집
2. Reranking 모델로 정교한 관련성 평가
3. 점수에 따라 재정렬
4. 상위 결과 반환

**장점**:
- 검색 정확도 향상
- 더 관련성 높은 결과
- 사용자 만족도 증가

### AI Memory
AI 시스템이 이전 상호작용을 기억하고 활용하는 기능

**메모리 유형**:
- **Buffer Memory**: 최근 N개 대화 저장
- **Summary Memory**: 대화 요약 저장
- **Entity Memory**: 주요 개체 정보 추적
- **Knowledge Graph Memory**: 관계 기반 저장

**사용 예**:
- 대화 맥락 유지
- 개인화된 응답
- 장기 상호작용

### AI Retrieval-Augmented Generation (RAG)
외부 지식 베이스에서 관련 정보를 검색하여 LLM 응답에 활용하는 기법

**프로세스**:
1. 사용자 쿼리 임베딩
2. 벡터 스토어에서 유사 문서 검색
3. 검색된 문서를 컨텍스트로 LLM에 제공
4. LLM이 컨텍스트 기반 응답 생성

**장점**:
- Hallucination 감소
- 최신 정보 활용
- 도메인 특화 지식 활용
- 투명한 소스 인용

### AI Tool
AI Agent가 특정 작업을 수행하기 위해 사용할 수 있는 함수 또는 API

**도구 예시**:
- 검색 엔진
- 계산기
- 날씨 API
- 데이터베이스 쿼리
- 외부 API 호출

**도구 정의**:
- 이름: 도구 식별자
- 설명: 도구 기능 설명
- 파라미터: 입력 스키마
- 실행 함수: 실제 로직

### AI Vector Store
임베딩 벡터를 저장하고 검색하는 특수 데이터베이스

**주요 기능**:
- 벡터 저장
- 유사도 검색 (ANN - Approximate Nearest Neighbor)
- 메타데이터 필터링
- 확장성

**인기 벡터 스토어**:
- Pinecone
- Qdrant
- Weaviate
- Chroma
- FAISS

## 기술 및 플랫폼 용어

### API
Application Programming Interface의 약자
소프트웨어 간 상호작용을 위한 규약 및 도구 모음

**n8n에서의 API**:
- HTTP Request 노드로 외부 API 호출
- Webhook으로 외부에서 n8n 호출
- n8n 자체 API로 워크플로우 관리

**일반적인 API 유형**:
- REST API
- GraphQL
- SOAP
- Webhook

### Canvas (n8n)
워크플로우를 시각적으로 설계하고 편집하는 작업 공간

**기능**:
- 노드 배치 및 연결
- 드래그 앤 드롭 인터페이스
- 줌 및 팬 지원
- 그리드 스냅

**조작**:
- 노드 추가/삭제
- 연결선 그리기
- 레이아웃 정리
- 주석 추가

### Cluster Node (n8n)
여러 하위 노드(Sub Node)를 포함하는 복합 노드

**특징**:
- 복잡한 로직을 단일 노드로 캡슐화
- 내부에 여러 작업 단계 포함
- 주로 AI 및 LangChain 작업에 사용

**예시**:
- AI Agent 노드
- AI Chain 노드
- 복합 데이터 처리 노드

### Credential (n8n)
외부 서비스에 접근하기 위한 인증 정보

**인증 유형**:
- OAuth2
- API Key
- Basic Auth
- Token Auth
- Custom Auth

**관리**:
- 재사용 가능
- 암호화 저장
- 공유 지원 (Enterprise)

### Data Pinning (n8n)
노드의 출력 데이터를 고정하여 재실행 시에도 동일한 데이터 사용

**목적**:
- 테스트 데이터 고정
- 디버깅 효율화
- API 호출 절약

**사용법**:
1. 노드 실행 후 데이터 생성
2. 핀 아이콘 클릭
3. 고정된 데이터는 회색 표시
4. 재실행 시 고정 데이터 사용

### Editor (n8n)
n8n의 웹 기반 워크플로우 편집 인터페이스

**구성요소**:
- 캔버스
- 노드 패널
- 설정 패널
- 실행 패널
- 사이드바

**기능**:
- 워크플로우 생성/편집
- 노드 구성
- 실행 및 디버깅
- 데이터 시각화

### Entitlement (n8n)
사용자 또는 조직이 사용할 수 있는 기능 및 리소스의 권한

**라이선스 유형**:
- Community: 기본 기능
- Pro: 팀 협업 기능
- Enterprise: 고급 보안 및 관리 기능

**제어 항목**:
- 워크플로우 수
- 실행 횟수
- 사용자 수
- 고급 기능 접근

### Evaluation (n8n)
AI 모델 출력의 품질이나 정확성을 평가하는 프로세스

**평가 지표**:
- Accuracy: 정확도
- Relevance: 관련성
- Groundedness: 근거성
- Coherence: 일관성

**평가 방법**:
- 자동 평가 (메트릭 기반)
- LLM 기반 평가
- 사람 평가

### Expression (n8n)
동적 데이터를 참조하고 처리하기 위한 코드 표현식

**문법**:
```javascript
{{ $json.fieldName }}              // JSON 필드 접근
{{ $node["NodeName"].json }}       // 특정 노드 데이터
{{ $now }}                         // 현재 시간
{{ "Hello " + $json.name }}        // 문자열 연결
{{ $json.price * 1.1 }}            // 계산
```

**지원 기능**:
- JavaScript 표현식
- 내장 함수
- 날짜/시간 처리
- 문자열 조작

### LangChain
LLM 기반 애플리케이션 개발을 위한 프레임워크

**핵심 개념**:
- Chains: 작업 파이프라인
- Agents: 자율 실행 개체
- Memory: 대화 기억
- Tools: 외부 기능 통합

**n8n 통합**:
- LangChain 노드 제공
- Agent 및 Chain 구성
- 벡터 스토어 연동

### Large Language Model (LLM)
대규모 텍스트 데이터로 학습된 딥러닝 언어 모델

**주요 LLM**:
- GPT-4 (OpenAI)
- Claude (Anthropic)
- PaLM (Google)
- Llama (Meta)

**용도**:
- 텍스트 생성
- 대화
- 번역
- 요약
- 코드 생성

## n8n 핵심 개념

### Node (n8n)
워크플로우 내에서 특정 작업을 수행하는 개별 구성 요소

**노드 유형**:
- **Trigger 노드**: 워크플로우 시작
- **일반 노드**: 데이터 처리 및 작업 수행
- **Core 노드**: 유틸리티 기능

**노드 구성**:
- 파라미터: 노드 동작 설정
- Credential: 인증 정보
- Expression: 동적 값

### Project (n8n)
워크플로우와 리소스를 논리적으로 그룹화하는 단위

**용도**:
- 팀별/프로젝트별 구성
- 접근 권한 관리
- 리소스 격리

**구성요소**:
- 워크플로우
- Credential
- 팀원 (Enterprise)

### Root Node (n8n)
Cluster Node의 최상위 노드로, 전체 로직의 시작점

**역할**:
- Cluster 내부 흐름 제어
- 입력 데이터 수신
- 하위 노드로 데이터 전달

### Sub Node (n8n)
Cluster Node 내부에 포함된 개별 작업 노드

**특징**:
- Root Node에 종속
- 내부 데이터 흐름 처리
- 외부에서 직접 접근 불가

**예시**:
- Agent 내의 Tool 노드
- Chain 내의 처리 단계

### Template (n8n)
사전 구축된 워크플로우 또는 노드 구성

**유형**:
- 커뮤니티 템플릿
- 공식 템플릿
- 커스텀 템플릿

**활용**:
1. 템플릿 브라우저 탐색
2. 템플릿 가져오기
3. Credential 설정
4. 커스터마이징

### Trigger Node (n8n)
워크플로우의 실행을 시작하는 특수 노드

**Trigger 유형**:
- **Schedule Trigger**: 시간 기반
- **Webhook**: HTTP 요청
- **Manual Trigger**: 수동 실행
- **Email Trigger**: 이메일 수신
- **File Trigger**: 파일 변경 감지

**특징**:
- 워크플로우의 첫 번째 노드
- 활성화 시 자동 실행
- 이벤트 기반 또는 스케줄 기반

### Workflow (n8n)
자동화하려는 프로세스를 노드와 연결선으로 표현한 것

**구성**:
- Trigger: 시작점
- 작업 노드: 처리 로직
- 연결선: 데이터 흐름

**속성**:
- 이름: 워크플로우 식별자
- 활성/비활성: 자동 실행 여부
- 태그: 분류 및 검색
- 설정: 타임아웃, 에러 핸들링 등

**실행 모드**:
- 수동 실행
- 자동 실행 (활성화 시)
- API 호출
- Webhook 트리거

## 용어 사용 가이드

### 초보자를 위한 필수 용어
1. **Workflow**: 자동화 프로세스
2. **Node**: 작업 단위
3. **Trigger**: 시작점
4. **Credential**: 인증 정보
5. **Expression**: 동적 데이터 처리
6. **Canvas**: 편집 화면

### AI 기능 사용 시 필수 용어
1. **LLM**: 언어 모델
2. **RAG**: 검색 증강 생성
3. **Embedding**: 벡터 변환
4. **Vector Store**: 벡터 데이터베이스
5. **Agent**: 자율 실행 개체
6. **Chain**: 작업 파이프라인

### 고급 사용자를 위한 용어
1. **Cluster Node**: 복합 노드
2. **Data Pinning**: 데이터 고정
3. **Entitlement**: 권한 및 라이선스
4. **Groundedness**: 응답 신뢰성
5. **Reranking**: 검색 결과 재정렬

## 참고사항

### 용어 업데이트
n8n과 AI 기술의 발전에 따라 새로운 용어가 지속적으로 추가됨

### 추가 학습 리소스
- 공식 문서
- 커뮤니티 포럼
- 튜토리얼 및 비디오
- 용어집 확장판

### 기여
커뮤니티에서 새로운 용어 정의 제안 가능
