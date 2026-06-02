# Langfuse

[Langfuse](https://langfuse.com): LLM 관찰성을 위한 오픈소스 플랫폼.
AI 애플리케이션에 대한 트레이싱 및 모니터링 기능 제공.
개발자가 AI 시스템을 디버그, 분석, 최적화하도록 지원.

Flow 실행에 대한 [트레이싱](https://langfuse.com/docs/tracing) 데이터를 수집하고
자동으로 Langfuse로 전송하도록 Langflow 구성.

## Prerequisites

- [Langfuse Cloud](https://cloud.langfuse.com) 또는 [Langfuse self-hosted](https://langfuse.com/self-hosting) 계정
- 트레이싱할 Flow가 있는 [실행 중인 Langflow 서버](/get-started-installation)

## Set Langfuse credentials as environment variables

1. [Langfuse API 키](https://langfuse.com/faq/all/where-are-langfuse-api-keys) 생성

2. API 키 정보 복사:
   - Secret Key
   - Public Key
   - Host URL

3. Langflow 실행 환경에 환경 변수 설정:

**Linux/macOS:**
```bash
export LANGFUSE_SECRET_KEY=SECRET_KEY
export LANGFUSE_PUBLIC_KEY=PUBLIC_KEY
export LANGFUSE_HOST=HOST_URL
```

**Windows:**
```cmd
set LANGFUSE_SECRET_KEY=SECRET_KEY
set LANGFUSE_PUBLIC_KEY=PUBLIC_KEY
set LANGFUSE_HOST=HOST_URL
```

## Start Langflow and view traces in Langfuse

1. Langfuse 환경 변수 설정 환경에서 Langflow 시작:
   ```bash
   uv run langflow run
   ```

2. Flow 실행
   - Langflow가 자동으로 Flow 실행에 대한 트레이싱 데이터 수집 및 Langfuse로 전송

3. [Langfuse 대시보드](https://langfuse.com/docs/analytics/overview)에서 수집된 데이터 확인
   - [공개 라이브 트레이스 예시 대시보드](https://cloud.langfuse.com/project/cm0nywmaa005c3ol2msoisiho/traces/f016ae6d-4527-43f5-93ba-9d78388cd3d9) 참조

## Disable Langfuse tracing

Langfuse 통합 비활성화:
1. Langfuse 환경 변수 제거
2. Langflow 재시작

## Run Langfuse and Langflow with Docker Compose

셀프 호스팅 Langfuse의 경우 Docker Compose로 두 서비스 함께 실행 가능.

### 설정 단계

1. [Langfuse API 키](https://langfuse.com/faq/all/where-are-langfuse-api-keys) 생성

2. API 키 정보 복사 (Secret Key, Public Key, Host URL)

3. `docker-compose.yml` 파일의 `environment` 섹션에 자격 증명 추가:

```yaml
services:
  langflow:
    image: langflowai/langflow:latest
    pull_policy: always
    ports:
      - "7860:7860"
    depends_on:
      - postgres
    environment:
      - LANGFLOW_DATABASE_URL=postgresql://langflow:langflow@postgres:5432/langflow
      - LANGFLOW_CONFIG_DIR=app/langflow
      - LANGFUSE_SECRET_KEY=sk-...
      - LANGFUSE_PUBLIC_KEY=pk-...
      - LANGFUSE_HOST=https://us.cloud.langfuse.com
    volumes:
      - langflow-data:/app/langflow

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: langflow
      POSTGRES_PASSWORD: langflow
      POSTGRES_DB: langflow
    ports:
      - "5432:5432"
    volumes:
      - langflow-postgres:/var/lib/postgresql/data

volumes:
  langflow-postgres:
  langflow-data:
```

4. Docker 컨테이너 시작:
   ```bash
   docker-compose up
   ```

5. Langfuse 연결 확인:
   ```bash
   docker compose exec langflow python -c "import requests, os; addr = os.environ.get('LANGFUSE_HOST'); print(addr); res = requests.get(addr, timeout=5); print(res.status_code)"
   ```

   성공 출력:
   ```
   https://us.cloud.langfuse.com
   200
   ```

   오류 발생 시 `LANGFUSE_HOST` 환경 변수 설정 확인.

## See also

- [Langfuse GitHub repository](https://github.com/langfuse/langfuse)
