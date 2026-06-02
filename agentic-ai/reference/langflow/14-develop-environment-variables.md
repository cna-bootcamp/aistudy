# Environment variables

환경 변수(`LANGFLOW_PORT`, `LANGFLOW_LOG_LEVEL` 등)는 Langflow 실행 방식을 구성하는 광범위한 설정.

**전역 변수와의 차이:**
- 환경 변수: Langflow 전체 배포에 적용되는 설정
- 전역 변수: Flow에서 사용하기 위해 Langflow 데이터베이스에 저장된 사용자 정의 값

## Configure environment variables for Langflow OSS

Langflow는 다음 소스에서 환경 변수 인식:
- 터미널에서 설정된 환경 변수
- Langflow 시작 시 `.env` 파일에서 가져온 환경 변수
- Langflow CLI로 설정된 환경 변수 (`--env-file`, `--port` 등)

### Precedence (우선순위)

동일한 환경 변수가 여러 곳에 설정된 경우:

1. **Langflow CLI 옵션** (최우선)
2. **`.env` 파일** (시스템 환경 변수보다 우선)
3. **시스템 환경 변수** (다른 곳에 설정되지 않은 경우에만 사용)

**예시:**
- 시스템에서 `LANGFLOW_PORT=8080`, `.env`에서 `LANGFLOW_PORT=7860` → `7860` 사용
- CLI로 `--port 9000`, `.env`에서 `LANGFLOW_PORT=7860` → `9000` 사용

### Set environment variables in your terminal

**Linux/macOS:**
```bash
export VARIABLE_NAME='VALUE'
```

**Windows:**
```cmd
set VARIABLE_NAME=VALUE
```

**Docker:**
```bash
docker run -e VARIABLE_NAME=VALUE ...
```

### Import environment variables from a .env file

1. Langflow 실행 중이면 종료
2. `.env` 파일 생성 및 편집
3. Langflow 환경 변수 정의
4. 파일 저장
5. `.env` 파일로 Langflow 시작:

```bash
uv run langflow run --env-file .env
```

**Docker:**
```bash
docker run --env-file .env langflowai/langflow:latest
```

## Set environment variables for Langflow Desktop

터미널에서 설정한 환경 변수는 GUI에서 실행된 앱에 자동으로 전달되지 않음.

### macOS

`launchctl`과 `.plist` 파일 사용:

1. `LaunchAgents` 디렉토리 생성:
```bash
mkdir -p ~/Library/LaunchAgents
```

2. `~/Library/LaunchAgents/dev.langflow.env.plist` 파일 생성

3. 내용 추가:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>dev.langflow.env</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/sh</string>
        <string>-c</string>
        <string>
launchctl setenv LANGFLOW_PORT 7860 ;
launchctl setenv OPENAI_API_KEY sk-...
        </string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

4. 파일 로드:
```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/dev.langflow.env.plist
```

### Windows

**시스템 속성** 또는 **PowerShell** 사용:

**PowerShell (사용자 수준):**
```powershell
[Environment]::SetEnvironmentVariable("LANGFLOW_PORT", "7860", "User")
```

**PowerShell (시스템 수준, 관리자):**
```powershell
[Environment]::SetEnvironmentVariable("LANGFLOW_PORT", "7860", "Machine")
```

## Supported environment variables

### Server

| 변수 | 형식 | 기본값 | 설명 |
|------|------|--------|------|
| `LANGFLOW_HOST` | String | `localhost` | Langflow 서버 호스트 |
| `LANGFLOW_PORT` | Integer | `7860` | Langflow 서버 포트 |
| `LANGFLOW_BACKEND_ONLY` | Boolean | `False` | 백엔드만 실행 (프론트엔드 없음) |
| `LANGFLOW_DEV` | Boolean | `False` | 개발 모드 실행 |
| `LANGFLOW_OPEN_BROWSER` | Boolean | `False` | 시작 시 웹 브라우저 열기 |
| `LANGFLOW_WORKERS` | Integer | `1` | 워커 프로세스 수 |
| `LANGFLOW_WORKER_TIMEOUT` | Integer | `300` | 워커 타임아웃 (초) |
| `LANGFLOW_SSL_CERT_FILE` | String | 미설정 | SSL 인증서 파일 경로 |
| `LANGFLOW_SSL_KEY_FILE` | String | 미설정 | SSL 키 파일 경로 |
| `LANGFLOW_HEALTH_CHECK_MAX_RETRIES` | Integer | `5` | 상태 확인 최대 재시도 횟수 |
| `LANGFLOW_DEACTIVATE_TRACING` | Boolean | `False` | 트레이싱 비활성화 |
| `LANGFLOW_CELERY_ENABLED` | Boolean | `False` | Celery 분산 작업 처리 활성화 |
| `LANGFLOW_ALEMBIC_LOG_TO_STDOUT` | Boolean | `False` | Alembic 마이그레이션 로그를 stdout으로 |

### Visual editor and Playground behavior

| 변수 | 형식 | 기본값 | 설명 |
|------|------|--------|------|
| `LANGFLOW_AUTO_SAVING` | Boolean | `True` | 자동 저장 활성화 |
| `LANGFLOW_AUTO_SAVING_INTERVAL` | Integer | `1000` | 자동 저장 간격 (밀리초) |
| `LANGFLOW_BUNDLE_URLS` | List[String] | `[]` | 커스텀 번들 로드 URL 목록 |
| `LANGFLOW_COMPONENTS_PATH` | String | 미설정 | 커스텀 컴포넌트 디렉토리 경로 |
| `LANGFLOW_LOAD_FLOWS_PATH` | String | 미설정 | 시작 시 로드할 Flow JSON 디렉토리 |
| `LANGFLOW_CREATE_STARTER_PROJECTS` | Boolean | `True` | 초기화 시 템플릿 생성 |
| `LANGFLOW_UPDATE_STARTER_PROJECTS` | Boolean | `True` | 업그레이드 후 템플릿 업데이트 |
| `LANGFLOW_LAZY_LOAD_COMPONENTS` | Boolean | `False` | 컴포넌트 지연 로딩 |
| `LANGFLOW_EVENT_DELIVERY` | String | `streaming` | 빌드 이벤트 전달 방식 (polling/streaming/direct) |
| `LANGFLOW_FRONTEND_PATH` | String | `./frontend` | 프론트엔드 빌드 파일 경로 |
| `LANGFLOW_MAX_ITEMS_LENGTH` | Integer | `100` | 비주얼 에디터 최대 항목 수 |
| `LANGFLOW_MAX_TEXT_LENGTH` | Integer | `1000` | 비주얼 에디터 최대 문자 수 |
| `LANGFLOW_MAX_TRANSACTIONS_TO_KEEP` | Integer | `3000` | 데이터베이스 최대 트랜잭션 이벤트 수 |
| `LANGFLOW_MAX_VERTEX_BUILDS_TO_KEEP` | Integer | `3000` | 데이터베이스 최대 버텍스 빌드 수 |
| `LANGFLOW_MAX_VERTEX_BUILDS_PER_VERTEX` | Integer | `2` | 버텍스당 최대 빌드 수 |
| `LANGFLOW_PUBLIC_FLOW_CLEANUP_INTERVAL` | Integer | `3600` | 공유 Playground Flow 정리 간격 (초) |
| `LANGFLOW_PUBLIC_FLOW_EXPIRATION` | Integer | `86400` | 공유 Playground Flow 만료 시간 (초) |

### 기타 참조

| 카테고리 | 참조 문서 |
|----------|----------|
| **Authentication and security** | [API keys and authentication](/api-keys-and-authentication) |
| **Global variables** | [Global variables](/configuration-global-variables) |
| **Logs** | [Configure log options](/logging#log-storage) |
| **MCP servers** | [Use Langflow as an MCP server](/mcp-server) |
| **Monitoring and metrics** | [Langfuse](/integrations-langfuse), [Kubernetes best practices](/deployment-prod-best-practices) |
| **Storage** | [File storage](/concepts-file-management#file-storage-environment-variables) |
| **Database** | [Memory management options](/memory#configure-external-memory) |
| **Telemetry** | [Telemetry](/contributing-telemetry) |
