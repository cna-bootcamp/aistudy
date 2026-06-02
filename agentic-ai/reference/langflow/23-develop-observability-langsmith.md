# LangSmith

LangSmith: LangChain의 풀 라이프사이클 DevOps 서비스.
모니터링 및 관찰성 기능 제공.

Langflow와 통합하려면 LangChain API 키와 설정을 Langflow 환경 변수로 추가 후 Langflow 시작.

## 설정 단계

1. [https://smith.langchain.com](https://smith.langchain.com/)에서 LangChain API 키 획득

2. Langflow `.env` 파일에 환경 변수 설정:

```bash
LANGSMITH_TRACING=True
LANGSMITH_ENDPOINT=https://api.smith.langchain.com/
LANGSMITH_API_KEY=LANGCHAIN_API_KEY
LANGSMITH_PROJECT=LANGSMITH_PROJECT_NAME
```

`LANGCHAIN_API_KEY`와 `LANGSMITH_PROJECT_NAME`을 실제 값으로 대체.

**터미널에서 직접 설정 (대안):**

```bash
export LANGSMITH_TRACING=True && export LANGSMITH_ENDPOINT="https://api.smith.langchain.com/" && export LANGSMITH_API_KEY="LANGCHAIN_API_KEY" && export LANGSMITH_PROJECT="LANGSMITH_PROJECT_NAME"
```

3. 수정된 `.env` 파일로 Langflow 재시작:

```bash
langflow run --env-file .env
```

> **Note**: 터미널에서 환경 변수 설정 시 `--env-file` 생략 가능.
> Langflow는 `.env` 파일과 터미널 모두에서 환경 변수 소싱 가능.

4. Langflow에서 Flow 실행하여 활동 생성

5. LangSmith 대시보드에서 모니터링 및 관찰성 확인

## 환경 변수 요약

| 변수 | 설명 |
|------|------|
| `LANGSMITH_TRACING` | 트레이싱 활성화 (`True`) |
| `LANGSMITH_ENDPOINT` | LangSmith API 엔드포인트 |
| `LANGSMITH_API_KEY` | LangChain API 키 |
| `LANGSMITH_PROJECT` | LangSmith 프로젝트 이름 |

## See also

- [LangSmith](https://smith.langchain.com/)
- [Langflow environment variables](/environment-variables)
