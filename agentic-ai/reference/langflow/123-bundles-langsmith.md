# LangSmith

**번들 페이지 없음**

요청된 URL `https://docs.langflow.org/bundles-langsmith`는 존재하지 않음 (404 오류)

Langflow 공식 문서에서 LangSmith 전용 번들을 찾을 수 없음

---

## LangSmith 개요

LangSmith는 LangChain에서 제공하는 LLM 애플리케이션 개발 플랫폼:

### 주요 기능
- **추적(Tracing)**: LLM 호출 및 체인 실행 추적
- **평가(Evaluation)**: 모델 출력 품질 평가
- **모니터링(Monitoring)**: 프로덕션 애플리케이션 모니터링
- **데이터셋**: 테스트 데이터셋 관리
- **프롬프트 관리**: 프롬프트 버전 관리 및 공유

---

## Langflow에서 LangSmith 통합

### 1. Prompt Hub 컴포넌트
LangChain 번들의 **Prompt Hub** 컴포넌트를 통해 LangSmith Hub의 프롬프트 사용 가능

#### 파라미터
| Name | Display Name | Description |
|------|--------------|-------------|
| langchain_api_key | Your LangChain API Key | LangSmith API 키 |
| langchain_hub_prompt | LangChain Hub Prompt | Hub에서 가져올 프롬프트 (예: "efriis/my-first-prompt") |
| prompt | Build Prompt | 빌드된 프롬프트 출력 |

### 2. 환경 변수 설정
LangSmith 추적을 활성화하려면 환경 변수 설정:

```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY={your-api-key}
LANGCHAIN_PROJECT={project-name}
```

### 3. LangChain 컴포넌트 활용
Langflow의 LangChain 번들 컴포넌트는 자동으로 LangSmith와 통합됨:
- Agent 컴포넌트
- Chain 컴포넌트
- LLM 컴포넌트

---

## LangSmith API 사용 예시

### Python SDK
```python
from langsmith import Client

client = Client(api_key="your-api-key")

# 데이터셋 생성
dataset = client.create_dataset("my-dataset")

# 실행 추적
client.create_run(
    name="my-run",
    inputs={"input": "질문"},
    outputs={"output": "답변"}
)
```

### REST API
```bash
curl https://api.smith.langchain.com/runs \
  -H "x-api-key: {LANGSMITH_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-run",
    "inputs": {"input": "질문"},
    "outputs": {"output": "답변"}
  }'
```

---

## Langflow에서 LangSmith 활용 방법

### STEP 1. API 키 획득
[LangSmith](https://smith.langchain.com/)에서 계정 생성 및 API 키 발급

### STEP 2. 환경 변수 설정
Langflow 실행 시 환경 변수 설정:
```bash
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY=your-api-key
export LANGCHAIN_PROJECT=my-project
```

### STEP 3. LangChain 컴포넌트 사용
Langflow에서 LangChain 번들의 컴포넌트를 사용하면 자동으로 LangSmith에 추적됨

### STEP 4. LangSmith 대시보드 확인
[LangSmith 대시보드](https://smith.langchain.com/)에서 추적 결과 확인

---

## 관련 Langflow 컴포넌트

### LangChain 번들
- **Prompt Hub**: LangSmith Hub의 프롬프트 사용
- **Agent 컴포넌트**: 자동 추적 지원
- **LLM 컴포넌트**: 자동 추적 지원

---

## 참조

- [LangSmith 공식 문서](https://docs.smith.langchain.com/)
- [LangSmith Python SDK](https://docs.smith.langchain.com/reference/python-sdk)
- [LangSmith API 레퍼런스](https://docs.smith.langchain.com/reference/api-reference)
- [Langflow LangChain 번들](https://docs.langflow.org/bundles-langchain)
- [Langflow Prompt Hub](https://docs.langflow.org/bundles-langchain#prompt-hub)
