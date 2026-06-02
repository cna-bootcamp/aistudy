# Memory management options

Langflow의 저장소 옵션 및 경로 구성 방법.

## Storage options and paths

Langflow는 다음 정보를 저장:
- Langflow 데이터베이스: 테이블에 사용자 자격 증명, Flow 정의, API 키 등 저장
- 캐시 메모리: 빠른 접근을 위한 임시 데이터
- 업로드된 파일

### Langflow 데이터베이스 저장 경로

기본 저장 위치:

| 플랫폼 | 경로 |
|--------|------|
| **macOS** | `~/Library/Caches/langflow/` |
| **Linux** | `~/.cache/langflow/` |
| **Windows** | `C:\Users\<username>\AppData\Local\langflow\langflow\` |

파일명: `langflow.db` (SQLite 형식)

### 경로 변경 방법

`LANGFLOW_CONFIG_DIR` 환경 변수로 저장 위치 변경:

```bash
LANGFLOW_CONFIG_DIR=/custom/path uv run langflow run
```

## Langflow database tables

Langflow 데이터베이스에 저장되는 테이블:

| 테이블 | 설명 |
|--------|------|
| `ApiKey` | Langflow API 접근을 위한 사용자별 API 키 |
| `File` | 업로드된 파일의 메타데이터 |
| `Flow` | Flow 정의 (JSON 형식), 생성/수정 시간, 소유자 정보 |
| `Folder` | Flow 정리를 위한 폴더 (프로젝트) |
| `Message` | Flow 실행 중 교환된 채팅 메시지 |
| `Transactions` | 로깅 및 분석을 위한 런타임 트랜잭션 |
| `User` | 사용자 계정, 자격 증명, 역할 |
| `Variables` | 암호화된 전역 변수 값 |
| `VertexBuild` | Flow vertex의 빌드 상태 기록 |

## Configure external memory

기본 SQLite 대신 외부 PostgreSQL 데이터베이스 사용 가능.

### PostgreSQL 연결

`LANGFLOW_DATABASE_URL` 환경 변수 설정:

```bash
LANGFLOW_DATABASE_URL="postgresql://user:password@host:port/database"
```

### 연결 풀 설정

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `LANGFLOW_DB_POOL_SIZE` | `10` | 연결 풀 크기 |
| `LANGFLOW_DB_MAX_OVERFLOW` | `20` | 최대 초과 연결 수 |
| `LANGFLOW_DB_POOL_PRE_PING` | `True` | 연결 상태 사전 확인 |

**.env 파일 예시:**

```bash
LANGFLOW_DATABASE_URL=postgresql://user:password@localhost:5432/langflow
LANGFLOW_DB_POOL_SIZE=10
LANGFLOW_DB_MAX_OVERFLOW=20
```

## Configure cache memory

Langflow 런타임 캐싱을 위한 다양한 백엔드 지원.

### 캐시 유형

| 유형 | 설정 값 | 설명 |
|------|---------|------|
| **async** | `async` | 비동기 인메모리 캐시 (기본값) |
| **redis** | `redis` | Redis 기반 분산 캐시 |
| **memory** | `memory` | 동기 인메모리 캐시 |
| **disk** | `disk` | 디스크 기반 영구 캐시 |

### 캐시 설정

```bash
LANGFLOW_CACHE_TYPE=redis
```

### Redis 캐시 구성

Redis 사용 시 추가 설정:

```bash
LANGFLOW_CACHE_TYPE=redis
LANGFLOW_REDIS_HOST=localhost
LANGFLOW_REDIS_PORT=6379
LANGFLOW_REDIS_DB=0
LANGFLOW_REDIS_CACHE_EXPIRE=3600
```

## Store chat memory

Flow 내 채팅 히스토리 저장 방법.

### Agent 내장 메모리

**Agent** 컴포넌트의 내장 메모리 기능:

1. **Chat Memory** 옵션 확장
2. **Memory** 필드에서 메모리 타입 선택
3. 기본값: `Agent component's chat memory`

특징:
- 자동으로 대화 기록 유지
- Session ID 기반 메모리 분리
- 추가 컴포넌트 불필요

### Message History 컴포넌트

별도의 **Message History** 컴포넌트 사용:

1. Flow에 **Message History** 컴포넌트 추가
2. **Agent** 컴포넌트의 **Memory** 필드에 연결
3. 메모리 설정 커스터마이징

### 타사 메모리 컴포넌트

외부 서비스 연동:

| 컴포넌트 | 설명 |
|----------|------|
| **Astra DB Chat Memory** | DataStax Astra DB 기반 메모리 |
| **Cassandra Chat Memory** | Apache Cassandra 기반 메모리 |
| **Redis Chat Memory** | Redis 기반 메모리 |
| **Zep Chat Memory** | Zep 서비스 기반 메모리 |

### Session ID 활용

- 동일한 Session ID: 대화 기록 공유
- 다른 Session ID: 별도 대화 컨텍스트 유지
- 사용자별 고유 Session ID 부여로 개인화된 대화 가능

## Memory-related environment variables

| 변수 | 형식 | 기본값 | 설명 |
|------|------|--------|------|
| `LANGFLOW_DATABASE_URL` | String | 미설정 | 외부 데이터베이스 연결 URL |
| `LANGFLOW_CONFIG_DIR` | String | 플랫폼별 | 설정 및 데이터베이스 디렉토리 |
| `LANGFLOW_DB_POOL_SIZE` | Integer | `10` | DB 연결 풀 크기 |
| `LANGFLOW_DB_MAX_OVERFLOW` | Integer | `20` | DB 최대 초과 연결 |
| `LANGFLOW_CACHE_TYPE` | String | `async` | 캐시 백엔드 유형 |
| `LANGFLOW_REDIS_HOST` | String | `localhost` | Redis 호스트 |
| `LANGFLOW_REDIS_PORT` | Integer | `6379` | Redis 포트 |

## See also

- [Global variables](/configuration-global-variables)
- [Environment variables](/environment-variables)
