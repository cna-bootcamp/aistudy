# Deploy Langflow on Docker

Docker 컨테이너에서 애플리케이션 실행: 다양한 시스템에서 일관된 동작 보장 및 종속성 충돌 제거.

> **Tip**: Docker 대신 Podman 사용 가능.
> 자세한 정보: [Podman 문서](https://podman.io/docs)

## 배포 옵션

| 방법 | 설명 |
|------|------|
| [Quickstart](#quickstart) | 기본값으로 Langflow 컨테이너 시작 |
| [Docker Compose](#clone) | 리포지토리 클론 후 Docker Compose로 빌드. PostgreSQL 포함 |
| [커스텀 Flow 이미지](#package-your-flow-as-a-docker-image) | Dockerfile로 Flow를 Docker 이미지로 패키징 |
| [커스텀 Langflow 이미지](#customize-the-langflow-docker-image) | 자체 코드, 커스텀 종속성 포함 |

## Quickstart

Docker 설치 및 실행 중인 시스템에서:

```bash
docker run -p 7860:7860 langflowai/langflow:latest
```

`http://localhost:7860/`에서 Langflow 접근.

## Clone the repo and run the Langflow Docker container

리포지토리 클론 및 Docker Compose 사용: 설정 제어 강화, PostgreSQL 사용 가능.

**기본 Docker Compose 배포 포함 내용:**
- **Langflow 서비스**: PostgreSQL을 데이터베이스로 사용하는 최신 Langflow 이미지
- **PostgreSQL 서비스**: Flow, 사용자, 설정의 영구 데이터 스토리지
- **영구 볼륨**: 컨테이너 재시작 시 데이터 유지

**단계:**

1. **리포지토리 클론:**
   ```bash
   git clone https://github.com/langflow-ai/langflow.git
   ```

2. **docker_example 디렉토리로 이동:**
   ```bash
   cd langflow/docker_example
   ```

3. **Docker Compose 실행:**
   ```bash
   docker compose up
   ```

4. **접근:**
   `http://localhost:7860/`

### Customize your deployment

`.env` 파일로 데이터베이스 자격 증명 설정:

1. **`.env` 파일 생성:**
   ```bash
   # Database credentials
   POSTGRES_USER=myuser
   POSTGRES_PASSWORD=mypassword
   POSTGRES_DB=langflow

   # Langflow configuration
   LANGFLOW_DATABASE_URL=postgresql://myuser:mypassword@postgres:5432/langflow
   LANGFLOW_CONFIG_DIR=/app/langflow
   ```

2. **`docker-compose.yml` 수정:**
   ```yaml
   services:
     langflow:
       environment:
         - LANGFLOW_DATABASE_URL=${LANGFLOW_DATABASE_URL}
         - LANGFLOW_CONFIG_DIR=${LANGFLOW_CONFIG_DIR}
     postgres:
       environment:
         - POSTGRES_USER=${POSTGRES_USER}
         - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
         - POSTGRES_DB=${POSTGRES_DB}
   ```

자세한 정보: [Langflow 환경 변수](/environment-variables)

## Package your flow as a Docker image

특정 Flow를 독립 컨테이너로 배포하거나 Kubernetes 환경에 배포 시 유용.

1. **프로젝트 디렉토리 생성:**
   ```bash
   mkdir langflow-custom && cd langflow-custom
   ```

2. **Flow JSON 파일 추가:**
   ```bash
   # 예제 Flow 다운로드
   wget https://raw.githubusercontent.com/langflow-ai/langflow-helm-charts/refs/heads/main/examples/flows/basic-prompting-hello-world.json

   # 또는 자체 Flow 파일 복사
   cp /path/to/your/flow.json .
   ```

3. **Dockerfile 생성:**
   ```dockerfile
   FROM langflowai/langflow:latest
   RUN mkdir /app/flows
   COPY ./*.json /app/flows/
   ENV LANGFLOW_LOAD_FLOWS_PATH=/app/flows
   ```

4. **이미지 빌드 및 테스트:**
   ```bash
   docker build -t myuser/langflow-custom:1.0.0 .
   docker run -p 7860:7860 myuser/langflow-custom:1.0.0
   ```

5. **Docker Hub에 푸시 (선택):**
   ```bash
   docker push myuser/langflow-custom:1.0.0
   ```

Kubernetes 배포: [Deploy the Langflow production environment on Kubernetes](/deployment-kubernetes-prod) 참조.

## Customize the Langflow Docker image with your own code

Langflow 애플리케이션 자체 커스터마이징:
- 커스텀 Python 패키지 또는 종속성 추가
- Langflow 설정 수정
- 커스텀 컴포넌트 또는 도구 포함
- 자체 코드로 Langflow 기능 확장

**예시: Message History 컴포넌트 커스터마이징**

```dockerfile
FROM langflowai/langflow:latest

# 작업 디렉토리 설정
WORKDIR /app

# 수정된 memory 컴포넌트 복사
COPY src/lfx/src/lfx/components/helpers/memory.py /tmp/memory.py

# site-packages 디렉토리 찾기
RUN python -c "import site; print(site.getsitepackages()[0])" > /tmp/site_packages.txt

# site-packages 위치의 파일 교체
RUN SITE_PACKAGES=$(cat /tmp/site_packages.txt) && \
    echo "Site packages at: $SITE_PACKAGES" && \
    mkdir -p "$SITE_PACKAGES/langflow/components/helpers" && \
    cp /tmp/memory.py "$SITE_PACKAGES/langflow/components/helpers/"

# site-packages 디렉토리의 Python 캐시 정리
RUN SITE_PACKAGES=$(cat /tmp/site_packages.txt) && \
    find "$SITE_PACKAGES" -name "*.pyc" -delete && \
    find "$SITE_PACKAGES" -name "__pycache__" -type d -exec rm -rf {} +

# 기본 Langflow 포트 노출
EXPOSE 7860

# Langflow 실행 명령
CMD ["python", "-m", "langflow", "run", "--host", "0.0.0.0", "--port", "7860"]
```

**사용 방법:**

1. **디렉토리 생성:**
   ```bash
   mkdir langflow-custom && cd langflow-custom
   ```

2. **디렉토리 구조 생성:**
   ```bash
   mkdir -p src/lfx/src/lfx/components/helpers
   ```

3. **수정된 `memory.py` 파일을 `/helpers` 디렉토리에 배치**

4. **Dockerfile 생성** (위 내용 복사)

5. **이미지 빌드 및 실행:**
   ```bash
   docker build -t myuser/langflow-custom:1.0.0 .
   docker run -p 7860:7860 myuser/langflow-custom:1.0.0
   ```

이 접근 방식은 파일 경로와 컴포넌트 이름을 수정하여 다른 컴포넌트나 커스텀 코드에도 적용 가능.

