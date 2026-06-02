# Install Langflow

Langflow 설치 방법:

1. **Langflow Desktop (권장)**: 독립 실행형 데스크톱 애플리케이션. 의존성 관리 및 업그레이드 용이.
2. **Docker**: Langflow Docker 이미지를 사용하여 격리된 환경에서 실행.
3. **Python package**: Langflow OSS Python 패키지 설치. 환경, 의존성, 버전 관리에 대한 더 많은 제어 가능.
4. **Install from source**: Langflow 코드베이스 또는 문서에 기여하려는 경우.

## Install and run Langflow Desktop

Langflow Desktop은 의존성 관리와 업그레이드를 단순화한 데스크톱 버전.
단, **Shareable Playground**와 **Voice Mode**는 Desktop에서 사용 불가.

### macOS
- macOS 13 이상 필요
1. [Langflow Desktop](https://www.langflow.org/desktop)으로 이동
2. **Download Langflow** 클릭, 연락처 정보 입력 후 **Download** 클릭
3. Langflow 애플리케이션 마운트 및 설치
4. 설치 완료 후 Langflow 애플리케이션 열고 Quickstart로 첫 Flow 생성

### Windows
- Windows용 다운로드 가능

참고:
- 업그레이드 정보: [Release notes](/release-notes)
- 의존성 관리: [Install custom dependencies in Langflow Desktop](/install-custom-dependencies#langflow-desktop)

## Install and run Langflow with Docker

Docker 이미지로 Langflow 컨테이너 시작.
자세한 정보: [Deploy Langflow on Docker](/deployment-docker)

1. [Docker](https://docs.docker.com/) 설치 및 시작
2. 최신 [Langflow Docker image](https://hub.docker.com/r/langflowai/langflow) pull 및 시작:
   ```bash
   docker run -p 7860:7860 langflowai/langflow:latest
   ```
3. Langflow 접속: `http://localhost:7860/`
4. Quickstart로 첫 Flow 생성

## Install and run the Langflow OSS Python package

### 요구사항

**Python 버전:**
- macOS/Linux: 3.10 ~ 3.13
- Windows: 3.10 ~ 3.12

**uv**: [설치 가이드](https://docs.astral.sh/uv/getting-started/installation/)

**인프라:**
- 최소: 듀얼 코어 CPU, 2GB RAM
- 권장: 멀티 코어 CPU, 4GB 이상 RAM

**브라우저:** Google Chrome 권장 (필수 아님)

### 설치 단계

1. [uv](https://docs.astral.sh/uv/pip/environments)로 가상환경 생성

2. 가상환경에서 Langflow 설치:
   ```bash
   uv pip install langflow
   ```
   특정 버전 설치:
   ```bash
   uv pip install langflow==1.4.22
   ```

3. Langflow 시작:
   ```bash
   uv run langflow run
   ```
   시작까지 몇 분 소요될 수 있음.

4. 로컬 Langflow 인스턴스 확인: `http://127.0.0.1:7860`

5. Quickstart로 첫 Flow 생성

참고:
- 업그레이드 정보: [Release notes](/release-notes)
- 커스텀 의존성: [Install custom dependencies](/install-custom-dependencies)

## Next steps

- [Quickstart](/get-started-quickstart): 몇 분 만에 첫 Flow 빌드 및 실행
- [Build flows](/concepts-flows): Flow 빌드에 대해 학습
- [Troubleshoot Langflow](/troubleshoot): 일반적인 설치 및 시작 문제 해결
