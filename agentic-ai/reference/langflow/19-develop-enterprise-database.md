# Langflow database guide for enterprise DBAs

엔터프라이즈 DBA 및 운영자를 위한 Langflow 데이터베이스 가이드.
프로덕션 환경에서 PostgreSQL을 사용한 Langflow 배포 및 관리.

## 개요

Langflow 데이터베이스 저장 데이터:
- 시작, Flow 실행, 사용자 상호작용, 관리 작업에 필수
- 프론트엔드(비주얼 에디터)와 백엔드(API) 작업 지원
- 데이터베이스 가용성은 Langflow 안정성과 기능에 중요

자세한 스키마 정보: [Memory management options](/memory)

## Configure Langflow with PostgreSQL

SQLite가 기본 데이터베이스이나, 프로덕션 배포에는 PostgreSQL 권장.

**PostgreSQL 장점:**
- 확장성
- 성능
- 견고성

### PostgreSQL 설정 단계

1. **PostgreSQL 설정:**
   - PostgreSQL 인스턴스 배포 (버전 12 이상 권장)
   - 로컬 서버, Docker, 또는 관리형 클라우드 서비스 사용
   - Langflow용 데이터베이스 생성
   - 적절한 최소 권한의 PostgreSQL 사용자 생성 (CREATE, SELECT, INSERT, UPDATE, DELETE)

2. **연결 문자열 획득:**
   ```
   postgresql://user:password@host:port/dbname
   ```
   예: `postgresql://langflow:securepassword@postgres:5432/langflow`

   > HA 환경에서는 직접 호스트 대신 가상 IP 또는 프록시 호스트명 사용

3. **Langflow 설정 (.env 파일):**
   ```bash
   touch .env
   ```

   ```bash
   LANGFLOW_DATABASE_URL="postgresql://langflow:securepassword@postgres:5432/langflow"
   ```

4. **Langflow 시작:**
   ```bash
   uv run langflow run --env-file .env
   ```

5. **마이그레이션 (선택사항):**
   - Langflow 첫 연결 시 자동으로 마이그레이션 실행
   - 수동 마이그레이션: `langflow migration` (변경 사항 미리보기)
   - 마이그레이션 적용: `langflow migration --fix` (파괴적 작업, 데이터 삭제 가능)

6. **설정 확인:**
   ```bash
   # 데이터베이스 컨테이너 접속
   docker exec -it <postgres-container> psql -U langflow -d langflow

   # SQL 쿼리
   SELECT * FROM pg_stat_activity WHERE datname = 'langflow';
   ```

## High Availability for PostgreSQL

프로덕션 배포에서 성능, 신뢰성, 확장성 향상을 위한 HA 구성 권장.

### Standard HA 구성

1. **스트리밍 복제 설정:**
   - 기본 데이터베이스: 쓰기 작업
   - 복제본: 읽기 및 페일오버
   - 동기/비동기 복제 선택 (지연 시간 및 일관성 요구사항 기반)

2. **자동 페일오버 구현:**

   | 옵션 | 구성 요소 |
   |------|----------|
   | **Patroni + etcd/Consul + HAProxy** | HA 오케스트레이터 + 분산 설정 저장소 + 트래픽 라우터 |
   | **Pgpool-II** | 단독 또는 추가 서비스와 함께 사용 |
   | **관리형 서비스** | AWS RDS, Google Cloud SQL 등 (내장 HA 및 자동 페일오버) |

3. **연결 문자열 업데이트:**
   - 가상 IP 또는 DNS 이름 사용: `postgresql://langflow:securepassword@db-proxy:5432/langflow?sslmode=require`
   - 관리형 서비스 엔드포인트: `langflow.cluster-xyz.us-east-1.rds.amazonaws.com`

4. **읽기 부하 분산 (선택사항):**
   - PgBouncer 같은 연결 풀러로 읽기 쿼리 분산
   - 단일 연결 문자열로 기본 PostgreSQL 또는 프록시 가리킴

### Active-Active HA 구성

여러 Langflow 인스턴스가 동일 데이터베이스에 의존하는 경우 권장.

### 페일오버 후 복구

- `LANGFLOW_DATABASE_CONNECTION_RETRY=True` 설정 시 SQLAlchemy가 재연결 시도
- 페일오버 후 복구 보장
- 데이터베이스 복구 시 중단 최소화

## Impact of database failure

PostgreSQL 데이터베이스 사용 불가 시 실패하는 기능:

| 기능 | 영향 |
|------|------|
| **Flow 검색** | 새 Flow 또는 기존 Flow 로드 불가 |
| **Flow 저장** | 새 Flow 또는 업데이트 저장 불가 |
| **사용자 인증** | 로그인 및 사용자 관리 실패 |
| **프로젝트 컬렉션 접근** | 커뮤니티/커스텀 프로젝트 컬렉션 접근 불가 |
| **설정 검색** | 애플리케이션 설정 로드 불가 |
| **설정 업데이트** | 설정 변경 저장 불가 |
| **실행 로그 접근** | 과거 Flow 실행 로그 검색 불가 |
| **로그 기록** | 새 실행 또는 시스템 활동 로그 기록 불가 |
| **다중 사용자 협업** | 사용자 간 Flow/프로젝트 공유 실패 |
| **API Flow 로딩** | 캐시되지 않은 새 Flow 로드 API 요청 실패 |

**참고:**
- 메모리에 이미 로드된 Flow는 캐시된 설정으로 계속 작동 가능
- 데이터베이스 접근 필요한 작업은 복구 전까지 실패
- 예: 캐시된 Flow 실행 가능, 로그나 메시지 히스토리 기록 불가

### 장애 최소화 방안

- HA 구성 사용
- 정기적 백업 기록
- `pg_dump`로 논리적 백업 생성
- WAL(Write-Ahead Log)로 지속적 아카이빙 설정 (지점 복구용)
- 복원 절차 정기적 테스트

## Database monitoring

PostgreSQL 데이터베이스 모니터링 권장 사항:

| 항목 | 설명 |
|------|------|
| **모니터링 도구** | pgAdmin, Prometheus + PostgreSQL exporter, 클라우드 기반 모니터링 |
| **성능 메트릭** | CPU, 메모리, 디스크 I/O 사용량 |
| **복제본 상태** | 가용성, 지연, 동기화 상태 (`pg_stat_activity`로 연결 수 및 경합 모니터링) |
| **알림 설정** | 높은 지연 시간, 페일오버 이벤트, 복제 문제 |
| **PostgreSQL 로깅** | `log_connections`, `log_statements`로 접근 및 변경 추적 |

## See also

- [Configure an external PostgreSQL database](/configuration-custom-database)
- [Langflow architecture on Kubernetes](/deployment-architecture)
- [Deploy the Langflow production environment on Kubernetes](/deployment-kubernetes-prod)
