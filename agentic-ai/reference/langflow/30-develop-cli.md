# Langflow CLI

Langflow 명령줄 인터페이스: Langflow 서버 관리 및 실행을 위한 주요 인터페이스.

> **Note**: CLI는 [Langflow 패키지 설치](/get-started-installation) 시 자동 설치됨.
> Langflow Desktop에서는 사용 불가.

## How to use the CLI

설치 방법 및 환경에 따라 여러 방식으로 CLI 호출 가능.

**권장 접근법:** Langflow가 설치된 가상 환경에서 `uv run` 사용.

```bash
uv run langflow run
```

**전역 설치 또는 PATH에 추가된 경우:**

```bash
langflow run
```

## Precedence

CLI 옵션은 터미널 또는 `.env` 파일에 설정된 [환경 변수](/environment-variables) 값을 재정의.

**예시:**
- 환경 변수: `LANGFLOW_PORT=7860`
- CLI 옵션: `--port 7880`
- 결과: 포트 `7880` 사용 (CLI 옵션 우선)

**Boolean 환경 변수:**
- `.env`에 `LANGFLOW_REMOVE_API_KEYS=True` 설정
- CLI로 `--no-remove-api-keys` 실행 시 `False`로 변경

## Langflow CLI options

모든 CLI 명령은 동작 수정 또는 환경 변수 설정을 위한 옵션 지원.

**옵션 구문:**
- `--option value`
- `--option=value`

**공백 포함 값:**
- `--option 'Value with Spaces'`
- `--option="Value with Spaces"`

### Boolean options

Boolean 옵션은 설정 활성화/비활성화.

| 형식 | 설명 |
|------|------|
| `--option` | 활성화 (true) |
| `--no-option` | 비활성화 (false) |

**예시:** `REMOVE_API_KEYS`
- `--remove-api-keys` = `LANGFLOW_REMOVE_API_KEYS=True`
- `--no-remove-api-keys` = `LANGFLOW_REMOVE_API_KEYS=False`

### Universal options

모든 CLI 명령에서 사용 가능한 옵션:

| 옵션 | 설명 |
|------|------|
| `--version`, `-v` | 버전 표시 후 종료 |
| `--install-completion` | 현재 쉘에 자동 완성 설치 |
| `--show-completion` | 자동 완성 설정 파일 위치 표시 |
| `--help` | 명령 사용법, 옵션, 인수 정보 출력 |

## CLI commands

### langflow

인수 없이 실행 시 사용 가능한 옵션과 명령 목록 출력.

```bash
uv run langflow
```

### langflow api-key

Langflow API 키 생성.

> **Note**: API 키 생성에는 슈퍼유저 권한 필요.
> 자세한 정보: [Langflow API keys](/api-keys-and-authentication#langflow-api-keys)

```bash
uv run langflow api-key
```

| 옵션 | 기본값 | 타입 | 설명 |
|------|--------|------|------|
| `--log-level` | `error` | String | 로깅 레벨 (`debug`, `info`, `warning`, `error`, `critical`) |

### langflow copy-db

캐시 디렉토리에서 현재 Langflow 설치 디렉토리로 데이터베이스 파일 복사.

**복사되는 파일:**
- `langflow.db`: 메인 Langflow 데이터베이스
- `langflow-pre.db`: 프리릴리스 데이터베이스 (존재 시)

```bash
uv run langflow copy-db
```

### langflow migration

[Alembic](https://alembic.sqlalchemy.org/en/latest/)을 사용한 데이터베이스 스키마 변경 관리.

**두 가지 모드:**

| 모드 | 설명 |
|------|------|
| **Test mode** (기본) | 마이그레이션 적용 가능 여부 확인 (실제 실행 안 함) |
| **Fix mode** | 마이그레이션 적용하여 데이터베이스 스키마 업데이트 |

> **Warning**: `langflow migration --fix`는 데이터 삭제 가능한 파괴적 작업.
> 항상 `langflow migration`으로 먼저 변경 사항 미리보기.

```bash
# Test mode
uv run langflow migration

# Fix mode
uv run langflow migration --fix
```

### langflow run

Langflow 서버 시작.

```bash
uv run langflow run [OPTIONS]
```

#### Options

| 옵션 | 기본값 | 타입 | 설명 |
|------|--------|------|------|
| `--auto-saving` | `--auto-saving` (true) | Boolean | 비주얼 에디터에서 Flow 자동 저장 활성화 |
| `--auto-saving-interval` | `1000` | Integer | 자동 저장 간격 (밀리초) |
| `--backend-only` | `--no-backend-only` (false) | Boolean | 백엔드 서비스만 실행 (프론트엔드 없음) |
| `--cache` | `async` | String | 캐시 스토리지 타입 (`async`, `redis`, `memory`, `disk`) |
| `--components-path` | Not set | String | 커스텀 컴포넌트 디렉토리 경로 |
| `--dev` | `--no-dev` (false) | Boolean | 개발 모드 실행 |
| `--env-file` | Not set | String | `.env` 파일 경로 |
| `--frontend-path` | Not set | String | 프론트엔드 빌드 파일 디렉토리 경로 |
| `--health-check-max-retries` | `5` | Integer | 헬스 체크 최대 재시도 횟수 |
| `--host` | `localhost` | String | 서버 호스트 |
| `--log-file` | `logs/langflow.log` | String | 로그 파일 경로 |
| `--log-level` | `critical` | String | 로깅 레벨 |
| `--log-rotation` | Not set | String | 로그 로테이션 간격 |
| `--max-file-size-upload` | `1024` | Integer | 파일 업로드 최대 크기 (MB) |
| `--open-browser` | `--no-open-browser` (false) | Boolean | 시작 시 웹 브라우저 열기 |
| `--port` | `7860` | Integer | 서버 포트 |
| `--remove-api-keys` | `--no-remove-api-keys` (false) | Boolean | 저장된 Flow에서 API 키/토큰 제거 |
| `--ssl-cert-file-path` | Not set | String | SSL 인증서 파일 경로 |
| `--ssl-key-file-path` | Not set | String | SSL 키 파일 경로 |
| `--worker-timeout` | `300` | Integer | 워커 타임아웃 (초) |
| `--workers` | `1` | Integer | 워커 프로세스 수 |

#### Start Langflow with a specific .env file

`--env-file` 옵션으로 특정 `.env` 파일의 설정 사용.
추가 옵션이 `.env` 파일의 중복 값을 재정의.

```bash
uv run langflow run --env-file PATH/TO/LANGFLOW/.env
```

#### Start Langflow in headless mode

`--backend-only` 옵션으로 백엔드 서비스만 시작.
프론트엔드(비주얼 에디터) 없이 API 및 CLI로만 서버 액세스.

```bash
uv run langflow run --backend-only
```

### langflow superuser

지정된 사용자명과 비밀번호로 슈퍼유저 계정 생성.

```bash
uv run langflow superuser --username [NAME] --password [PASSWORD] [OPTIONS]
```

| 옵션 | 기본값 | 타입 | 설명 |
|------|--------|------|------|
| `--log-level` | `error` | String | 로깅 레벨 |

> **Note**: `--username`과 `--password`는 필수이며 기본값 없음.
> 자세한 정보: [LANGFLOW_SUPERUSER and LANGFLOW_SUPERUSER_PASSWORD](/api-keys-and-authentication#langflow-superuser)

#### Disable CLI superuser creation

`LANGFLOW_ENABLE_SUPERUSER_CLI` 환경 변수로 슈퍼유저 명령 제어:

| 값 | 설명 |
|----|------|
| `True` (기본) | `langflow superuser` 명령 사용 가능 |
| `False` (권장) | 명령 비활성화 (프로덕션 환경에서 보안상 권장) |

비활성화하려면 `.env` 파일에 `LANGFLOW_ENABLE_SUPERUSER_CLI=False` 설정 후 해당 `.env` 파일로 Langflow 시작.

