# Containerize a Langflow application

비주얼 에디터에서 Flow 설계는 Langflow를 사용한 애플리케이션 구축의 첫 단계.
기능적인 Flow가 있으면 웹사이트나 모바일 앱과 같은 더 큰 애플리케이션에서 사용 가능.

> **Tip**: Docker 대신 Podman 사용 가능.
> 자세한 정보: [Podman 문서](https://podman.io/docs)

Langflow는 IDE이자 런타임이므로:
- 로컬에서 Flow 빌드 및 테스트
- 프로덕션 환경에서 Flow 패키징 및 서비스

## Directory structure

최소 Langflow 애플리케이션 디렉토리 구조:

```
LANGFLOW-APPLICATION/
├── docker.env
├── Dockerfile
├── flows/
│   ├── flow1.json
│   └── flow2.json
├── langflow-config-dir/
├── README.md
```

| 항목 | 설명 |
|------|------|
| `docker.env` | Docker 이미지에 `.env` 파일로 복사됨 |
| `Dockerfile` | Langflow 이미지 빌드 방법 제어 |
| `/flows` | 애플리케이션이 사용하는 Flow 저장 |
| `/langflow-config-dir` | 설정 파일, 데이터베이스, 로그 위치 |
| `README.md` | 애플리케이션 문서 |

### Package management

기본 Langflow Docker 이미지는 `langflowai/langflow:latest`를 상위 이미지로 사용하여
핵심 종속성 포함.

**추가 종속성 필요 시:**
1. [pyproject.toml](https://packaging.python.org/en/latest/guides/writing-pyproject-toml) 파일 생성
2. Dockerfile에 다음 추가:
   ```dockerfile
   COPY pyproject.toml uv.lock /app/
   ```

자세한 정보: [Install custom dependencies](/install-custom-dependencies)

### Environment variables

`docker.env` 파일: Docker 이미지에 로드되는 `.env` 파일.
인증, 데이터베이스 스토리지, API 키, 서버 설정 등 제어.

**예시:**
```bash
LANGFLOW_AUTO_LOGIN=True
LANGFLOW_SAVE_DB_IN_CONFIG_DIR=True
LANGFLOW_BASE_URL=http://0.0.0.0:7860
OPENAI_API_KEY=sk-...
```

> **Note**: `docker.env`와 Dockerfile 모두에 환경 변수 설정 시 `docker.env` 값 사용.

**관련 기능:**
- [환경 변수에서 전역 변수 생성](/configuration-global-variables#add-custom-global-variables-from-the-environment)
- [누락된 전역 변수에 환경 변수 사용](/configuration-global-variables#use-environment-variables-for-missing-global-variables)

### Secrets

API 키 및 민감한 값 관리 시 업계 모범 사례 준수:
- 환경 변수 사용
- 비밀 관리 도구 사용

자세한 정보: [API keys and authentication](/api-keys-and-authentication)

### Storage

기본: [SQLite](https://www.sqlite.org/) 데이터베이스 사용.
PostgreSQL 선호 시: [Configure an external PostgreSQL database](/configuration-custom-database) 참조.

자세한 정보: [Memory management options](/memory)

### Flows

패키징 시 애플리케이션이 사용하는 Flow만 포함.

1. 애플리케이션에 관련된 [Flow 내보내기](/concepts-flows-import)
   - 체인된 Flow (다른 Flow를 트리거하는 Flow) 있으면 **모든** 필요한 Flow 내보내기
2. 내보낸 JSON 파일을 `/flows` 폴더에 추가

### Components

**Core components** 및 **Bundles**: 기본 Langflow Docker 이미지에 자동 포함.

**[커스텀 컴포넌트](/components-custom-components) 사용 시:**

1. `/components` 폴더 생성
2. 카테고리 하위 폴더 생성 (예: `/components/data`, `/components/tools`)
3. 커스텀 컴포넌트 파일을 적절한 카테고리 폴더에 추가
4. Dockerfile에 추가:
   ```dockerfile
   COPY components /app/components
   ENV LANGFLOW_COMPONENTS_PATH=/app/components
   ```

## Langflow Dockerfile

Dockerfile: 종속성, Flow, 컴포넌트, 설정 파일 포함 Langflow 이미지 빌드 방법 결정.

**최소 요구사항:**
- 기본 Langflow 이미지 지정
- 컨테이너에 필요한 폴더 생성
- 폴더 및 파일을 컨테이너에 복사
- 시작 명령 제공

```dockerfile
# 최신 버전의 기본 Langflow 이미지 사용
FROM langflowai/langflow:latest

# 폴더 생성 및 작업 디렉토리 설정
RUN mkdir /app/flows
RUN mkdir /app/langflow-config-dir
WORKDIR /app

# flows, langflow-config-dir, docker.env를 컨테이너에 복사
COPY flows /app/flows
COPY langflow-config-dir /app/langflow-config-dir
COPY docker.env /app/.env

# (선택) 커스텀 컴포넌트 복사
COPY components /app/components

# (선택) 커스텀 종속성 사용
COPY pyproject.toml uv.lock /app/

# 환경 변수 설정 (docker.env에 없는 경우)
ENV PYTHONPATH=/app
ENV LANGFLOW_LOAD_FLOWS_PATH=/app/flows
ENV LANGFLOW_CONFIG_DIR=/app/langflow-config-dir
ENV LANGFLOW_COMPONENTS_PATH=/app/components
ENV LANGFLOW_LOG_ENV=container

# 포트 7860에서 Langflow 서버 실행 명령
EXPOSE 7860
CMD ["langflow", "run", "--backend-only", "--env-file","/app/.env","--host", "0.0.0.0", "--port", "7860"]
```

> **Note**: `ENV LANGFLOW_LOG_ENV=container`는 컨테이너 환경에서
> 직렬화된 JSON을 `stdout`으로 로깅하도록 설정.

### Backend-only mode

`--backend-only` 플래그: 프로그래매틱 액세스만 제공하는 백엔드 전용 모드.
비주얼 에디터 접근이 필요 없는 애플리케이션 종속성으로 Langflow 실행 시 권장.

비주얼 에디터 **및** 백엔드 모두 서비스하려면 `--backend-only` 생략.

## Test your Langflow Docker image

1. **Docker 이미지 빌드:**
   ```bash
   docker build -t langflow-pokedex:1.2.0 .
   ```

2. **Docker 컨테이너 실행:**
   ```bash
   docker run -p 7860:7860 langflow-pokedex:1.2.0
   ```

3. **Flow 실행 테스트:**

   Flow JSON 파일에서 Flow ID 찾기:
   ```json
   "name": "Basic Prompting",
   "description": "Perform basic prompting with an OpenAI model.",
   "id": "e4167236-938f-4aca-845b-21de3f399858",
   ```

   API 요청으로 Flow 실행:
   ```bash
   curl --request POST \
     --url 'http://localhost:7860/api/v1/run/e4167236-938f-4aca-845b-21de3f399858?stream=true' \
     --header 'Content-Type: application/json' \
     --data '{
       "input_value": "Tell me about Charizard.",
       "output_type": "chat",
       "input_type": "chat",
       "session_id": "charizard_test_request"
     }'
   ```

4. **응답 확인:**
   요청 성공 및 유효한 응답 확인 시 Langflow Docker 이미지가 올바르게 설정됨.

## Deploy to Docker Hub and Kubernetes

프로덕션 환경 배포 관련 정보:

- [Langflow 배포 개요](/deployment-overview)
- [Docker에 Langflow 배포](/deployment-docker)
- [Kubernetes에 Langflow 프로덕션 환경 배포](/deployment-kubernetes-prod)

