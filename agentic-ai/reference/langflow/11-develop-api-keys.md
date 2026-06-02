# API keys and authentication

인증 자격 증명은 Langflow 서버, Flow, 컴포넌트를 통해 연결된 서비스에 대한 무단 접근 방지에 도움.

> **Warning**: Langflow 포트를 적절한 보안 조치 없이 인터넷에 직접 노출하지 마세요.
> - `LANGFLOW_AUTO_LOGIN=False` 설정
> - 기본값이 아닌 `LANGFLOW_SECRET_KEY` 사용
> - 인증이 활성화된 리버스 프록시 뒤에 배포

## 자격 증명 유형

| 유형 | 용도 |
|------|------|
| **Langflow API keys** | Langflow API 인증 및 서버 측 작업(Flow 실행, 파일 업로드 등) 권한 부여 |
| **Component API keys** | Langflow와 컴포넌트를 통해 연결된 서비스(모델 제공자, 타사 API 등) 간 인증 |
| **Authentication environment variables** | Langflow의 사용자 인증 및 권한 부여 처리 방식 구성 |

## Langflow API keys

Langflow와 프로그래밍 방식으로 상호 작용하기 위한 키.

기본적으로 대부분의 Langflow API 엔드포인트(`/v1/run/$FLOW_ID` 등)는 Langflow API 키 인증 필요.

### API 키 권한

- API 키는 생성한 사용자의 권한 상속
- 단일 사용자 환경: 항상 슈퍼유저 권한
- 멀티 사용자 환경: 슈퍼유저가 아닌 사용자는 다른 사용자 리소스에 접근 불가

### API 키 생성

**Langflow Settings에서:**
1. 헤더에서 프로필 아이콘 클릭 → **Settings** 선택
2. **Langflow API Keys** 클릭 → **Add New** 클릭
3. 키 이름 지정 → **Create API Key** 클릭
4. API 키 복사 후 안전하게 보관

**Langflow CLI로:**
```bash
langflow api-key create --name "my-key"
```

### API 키 사용

`x-api-key` 헤더 또는 쿼리 파라미터로 전달:

```bash
curl -X POST \
  "http://$LANGFLOW_SERVER_ADDRESS/api/v1/run/$FLOW_ID?stream=false" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $LANGFLOW_API_KEY" \
  -d '{"inputs": {"text":""}, "tweaks": {}}'
```

### API 키 사용 추적

기본적으로 `total_uses`와 `last_used_at` 기록 추적.
높은 동시성 시 데이터베이스 경합 방지를 위해 비활성화 가능:
```
LANGFLOW_DISABLE_TRACK_APIKEY_USAGE=True
```

### API 키 철회

1. **Settings** → **Langflow API Keys**
2. 삭제할 키 선택 → **Delete** 클릭

## Component API keys

Flow의 컴포넌트가 호출하는 외부 서비스(모델 제공자, 데이터베이스, 타사 API)에 대한 접근 권한 부여.

저장 방법:
- **Settings**의 전역 변수에 저장
- 런타임 환경에서 가져오기

자세한 정보: [Global variables](/configuration-global-variables)

> **Note**: Langflow에서 전역 변수를 삭제해도 서비스 제공자 시스템의 실제 API 키는 삭제/무효화되지 않음.

보안 강화:
- `LANGFLOW_REMOVE_API_KEYS=True`: Flow 데이터에서 API 키/토큰 제외
- Flow 내보내기 시 API 키 제외 옵션 선택 가능

## Authentication environment variables

### LANGFLOW_AUTO_LOGIN

인증 필요 여부 제어:

| 값 | 동작 |
|----|------|
| `False` | 자동 로그인 비활성화. 비주얼 에디터 로그인, CLI 슈퍼유저 인증, API 키 필요 |
| `True` (기본값) | API 요청은 인증 필요, 비주얼 에디터는 자동으로 슈퍼유저로 로그인 |

`False` 설정 시 `LANGFLOW_SUPERUSER`와 `LANGFLOW_SUPERUSER_PASSWORD`도 명시적 설정 권장.

### LANGFLOW_SUPERUSER / LANGFLOW_SUPERUSER_PASSWORD

슈퍼유저 사용자명과 비밀번호 지정:

```
LANGFLOW_SUPERUSER=administrator
LANGFLOW_SUPERUSER_PASSWORD=securepassword
```

`LANGFLOW_AUTO_LOGIN=False`일 때 필수.
설정하지 않으면 기본값 `langflow`/`langflow` 사용.

### LANGFLOW_SECRET_KEY

API 키 같은 민감한 데이터 암호화용 비밀 키.
Fernet 라이브러리 사용.

**키 생성 (macOS):**
```bash
python3 -c "from secrets import token_urlsafe; print(f'LANGFLOW_SECRET_KEY={token_urlsafe(32)}')" | pbcopy
```

**키 생성 (Linux):**
```bash
python3 -c "from secrets import token_urlsafe; print(f'LANGFLOW_SECRET_KEY={token_urlsafe(32)}')" | xclip -selection clipboard
```

프로덕션 환경에서는 자체 키 생성 및 명시적 설정 권장.
Kubernetes 같은 멀티 인스턴스 배포 시 인스턴스 간 일관된 암호화를 위해 필수.

### LANGFLOW_NEW_USER_IS_ACTIVE

| 값 | 동작 |
|----|------|
| `False` (기본값) | 슈퍼유저가 생성한 계정은 비활성화 상태, 명시적 활성화 필요 |
| `True` | 생성된 계정이 자동으로 활성화 |

### LANGFLOW_API_KEY_SOURCE

API 키 검증 방식 제어:

| 값 | 설명 |
|----|------|
| `db` (기본값) | 데이터베이스에 저장된 Langflow API 키로 검증 |
| `env` | `LANGFLOW_API_KEY` 환경 변수 값으로 검증 (Kubernetes, CI/CD 파이프라인에 유용) |

`env` 사용 시:
- 단일 API 키만 사용 가능
- 모든 인증된 요청에 슈퍼유저 권한 부여
- 단일 테넌트 배포 또는 자동화 시스템용

### LANGFLOW_CORS_*

CORS(Cross-Origin Resource Sharing) 구성:

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `LANGFLOW_CORS_ORIGINS` | `*` | 허용된 CORS 출처 |
| `LANGFLOW_CORS_ALLOW_CREDENTIALS` | `True` | 자격 증명 허용 여부 |
| `LANGFLOW_CORS_ALLOW_HEADERS` | `*` | 허용된 헤더 |
| `LANGFLOW_CORS_ALLOW_METHODS` | `*` | 허용된 HTTP 메서드 |

> **Danger**: 프로덕션에서는 정확한 출처 지정 권장:
> ```
> LANGFLOW_CORS_ORIGINS=["https://yourdomain.com"]
> ```

### SSRF protection

API Request 컴포넌트의 SSRF(Server-Side Request Forgery) 보호:

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `LANGFLOW_SSRF_PROTECTION_ENABLED` | `False` | SSRF 보호 활성화 |
| `LANGFLOW_SSRF_ALLOWED_HOSTS` | 미설정 | SSRF 검사를 우회할 수 있는 호스트/IP/CIDR 목록 |

### LANGFLOW_WEBHOOK_AUTH_ENABLE

웹훅 엔드포인트의 API 키 인증 요구 여부:

| 값 | 동작 |
|----|------|
| `False` (기본값) | 웹훅이 인증 없이 Flow 소유자로 실행 |
| `True` | 웹훅 엔드포인트에 API 키 인증 필요 |

## Start a Langflow server with authentication enabled

### 설정 단계

1. `.env` 파일 생성:

```
LANGFLOW_AUTO_LOGIN=False
LANGFLOW_SUPERUSER=administrator
LANGFLOW_SUPERUSER_PASSWORD=securepassword
LANGFLOW_SECRET_KEY=dBuu...2kM2_fb
LANGFLOW_NEW_USER_IS_ACTIVE=False
LANGFLOW_ENABLE_SUPERUSER_CLI=False
```

2. Langflow 시작:

```bash
uv run langflow run --env-file .env
```

3. 서버 확인: `http://localhost:7860`

### Manage users as an administrator

1. `http://localhost:7860/login`에서 슈퍼유저로 로그인
2. `http://localhost:7860/admin` 또는 프로필 아이콘 → **Admin Page**로 이동
3. **New User** 클릭하여 사용자 추가:
   - 사용자명과 비밀번호 입력
   - **Active** 선택하여 즉시 활성화
   - 슈퍼유저 권한 필요 없으면 **Superuser** 선택 해제
   - **Save** 클릭
4. 사용자에게 자격 증명 전달

## See also

- [Langflow environment variables](/environment-variables)
