# Configure an external PostgreSQL database

Langflow의 기본 SQLite 데이터베이스 대신 PostgreSQL 사용 설정.

## 개요

기본 SQLite 연결 문자열 `sqlite:///./langflow.db`를 PostgreSQL로 대체.
로컬 및 컨테이너화된 환경 모두 지원.

**PostgreSQL 사용 이점:**
- Flow, 메시지 히스토리, 로그 등 모든 구조화된 애플리케이션 데이터 관리
- 동시 사용자 지원
- 고급 데이터 무결성 기능
- 확장성
- 프로덕션 환경에 적합

## Prerequisites

- [PostgreSQL](https://www.pgadmin.org/download/) 데이터베이스

## Connect Langflow to a local PostgreSQL database

### 연결 설정 단계

1. Langflow 실행 중이면 Ctrl+C로 중지

2. PostgreSQL 연결 문자열 확인:
   ```
   postgresql://user:password@host:port/dbname
   ```

   **호스트명 설정:**
   | 환경 | 호스트명 |
   |------|----------|
   | 로컬 머신에서 직접 실행 | `localhost` |
   | Docker Compose | 서비스 이름 (예: `postgres`) |
   | 별도 Docker 컨테이너 (`docker run`) | 컨테이너 IP 또는 네트워크 별칭 |
   | 클라우드 호스팅 PostgreSQL | 제공업체에서 제공하는 연결 문자열 |

3. `.env` 파일 생성 또는 편집:
   ```bash
   touch .env
   ```

   템플릿: [.env.example](https://github.com/langflow-ai/langflow/blob/main/.env.example)

4. `LANGFLOW_DATABASE_URL` 설정:
   ```bash
   LANGFLOW_DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
   ```

### PostgreSQL 드라이버 호환성

Langflow는 SQLAlchemy와 psycopg 드라이버 사용.

**필수 드라이버:**
- `psycopg2-binary` 또는 `psycopg[binary]`

> **Note**: `asyncpg` 드라이버는 호환되지 않음 (타임존 처리 요구사항 차이)

### SSL 모드

| SSL 모드 | 설명 |
|----------|------|
| `sslmode=require` | SSL 연결 필수, 서버 인증서 검증 안 함. 대부분의 경우 적합 |
| `sslmode=verify-ca` | SSL 필수 + CA에 대해 서버 인증서 검증 |
| `sslmode=verify-full` | SSL 필수 + 서버 인증서 검증 + 호스트명 검증. 가장 안전 |

**SSL 연결 예시:**

```bash
# require 모드
LANGFLOW_DATABASE_URL="postgresql://user:password@localhost:5432/dbname?sslmode=require"

# verify-ca 모드
LANGFLOW_DATABASE_URL="postgresql://user@localhost:5432/dbname?sslmode=verify-ca&sslcert=/path/to/client.crt&sslkey=/path/to/client.key&sslrootcert=/path/to/ca.crt"

# verify-full 모드
LANGFLOW_DATABASE_URL="postgresql://user@db.example.com:5432/dbname?sslmode=verify-full&sslcert=/path/to/client.crt&sslkey=/path/to/client.key&sslrootcert=/path/to/ca.crt"
```

> **Warning**: `LANGFLOW_SSL_CERT_FILE`과 `LANGFLOW_SSL_KEY_FILE`은 Langflow 서버 HTTPS용이며,
> PostgreSQL 연결용이 아님.

5. Langflow 시작:
   ```bash
   uv run langflow run --env-file .env
   ```

6. Flow 실행하여 트래픽 생성

7. PostgreSQL 데이터베이스 테이블 및 활동 확인

## Deploy Langflow and PostgreSQL containers with docker-compose.yml

Docker Compose로 Langflow와 PostgreSQL 컨테이너를 동일 네트워크에서 실행.

**예시 파일:** [docker-compose.yml](https://github.com/langflow-ai/langflow/blob/main/docker_example/docker-compose.yml)

**특징:**
- 서비스 간 적절한 연결성 보장
- Langflow와 PostgreSQL 데이터에 영구 볼륨 설정
- 컨테이너 재시작 후에도 데이터 유지

**실행 방법:**

```bash
cd langflow/docker_example
docker-compose up
```

## Deploy multiple Langflow instances with a shared PostgreSQL database

여러 Langflow 인스턴스가 동일한 PostgreSQL 데이터베이스 공유.

### .env 파일 설정

```bash
POSTGRES_USER=langflow
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=langflow
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
LANGFLOW_CONFIG_DIR=app/langflow
LANGFLOW_PORT_1=7860
LANGFLOW_PORT_2=7861
LANGFLOW_HOST=0.0.0.0
```

### docker-compose.yml 예시

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    ports:
      - "${POSTGRES_PORT}:5432"
    volumes:
      - langflow-postgres:/var/lib/postgresql/data

  langflow-1:
    image: langflowai/langflow:latest
    pull_policy: always
    ports:
      - "${LANGFLOW_PORT_1}:7860"
    depends_on:
      - postgres
    environment:
      - LANGFLOW_DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}
      - LANGFLOW_CONFIG_DIR=${LANGFLOW_CONFIG_DIR}
      - LANGFLOW_HOST=${LANGFLOW_HOST}
      - PORT=7860
    volumes:
      - langflow-data-1:/app/langflow

  langflow-2:
    image: langflowai/langflow:latest
    pull_policy: always
    ports:
      - "${LANGFLOW_PORT_2}:7860"
    depends_on:
      - postgres
    environment:
      - LANGFLOW_DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}
      - LANGFLOW_CONFIG_DIR=${LANGFLOW_CONFIG_DIR}
      - LANGFLOW_HOST=${LANGFLOW_HOST}
      - PORT=7860
    volumes:
      - langflow-data-2:/app/langflow

volumes:
  langflow-postgres:
  langflow-data-1:
  langflow-data-2:
```

### 배포 및 확인

```bash
# 배포
docker-compose up

# 접속
# - 첫 번째 인스턴스: http://localhost:7860
# - 두 번째 인스턴스: http://localhost:7861

# PostgreSQL 컨테이너 접속
docker exec -it docker-test-postgres-1 psql -U langflow -d langflow

# 활성 연결 확인
langflow=# SELECT * FROM pg_stat_activity WHERE datname = 'langflow';

# psql 종료
quit
```

## See also

- [Langflow database guide for enterprise DBAs](/enterprise-database-guide)
- [Memory management options](/memory)
- [Logs](/logging)
