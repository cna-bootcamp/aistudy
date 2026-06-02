# Install custom dependencies

Langflow 기능 확장을 위한 선택적 의존성 그룹 및 커스텀 의존성 지원.

## 의존성 관리 구조

Langflow 코드베이스는 두 개의 `pyproject.toml` 파일 사용:

| 패키지 | 위치 | 포함 내용 |
|--------|------|----------|
| `main` | 루트 레벨 `pyproject.toml` | 최종 사용자 기능, 메인 애플리케이션 코드 (Langchain, OpenAI 등) |
| `base` | `src/backend/base/pyproject.toml` | 코어 인프라 (FastAPI 웹 프레임워크 등) |

## Install custom dependencies in Langflow Desktop

`requirements.txt` 파일에 패키지 항목 추가:

**파일 위치:**
- macOS: `/Users/USER/.langflow/data/requirements.txt`
- Windows: `C:\Users\USER\AppData\Roaming\com.Langflow\data\requirements.txt`

**형식:**
```
DEPENDENCY==VERSION
```

**예시:**
```
matplotlib==3.10.0
```

의존성 설치를 위해 Langflow Desktop 재시작.

커스텀 의존성 변경/제거 시 `requirements.txt` 파일 편집 후 재시작.

## Install custom dependencies in Langflow OSS

패키지 매니저로 커스텀 의존성 추가.

클론된 Langflow 저장소 내 작업 시:

```bash
uv add DEPENDENCY
```

### Install optional dependency groups

Langflow OSS는 기능 확장을 위한 선택적 의존성 그룹 제공.

`pyproject.toml` 파일의 `[project.optional-dependencies]`에 나열.

**설치 방법:**

```bash
# 단일 의존성 그룹
uv pip install "langflow[postgresql]"

# 복수 의존성 그룹
uv pip install "langflow[local,postgresql]"
```

### Use a virtual environment to test custom dependencies

로컬 테스트 시 가상 환경 사용으로 의존성 격리 및 충돌 방지:

```bash
# 가상 환경 생성 및 활성화
uv venv YOUR_LANGFLOW_VENV
source YOUR_LANGFLOW_VENV/bin/activate

# langflow와 추가 의존성 설치
uv pip install langflow matplotlib
```

클론된 저장소에서는 기존 `pyproject.toml` 파일 참조를 위해 `uv add` 사용:

```bash
uv add matplotlib
```

`uv add` 명령은 적절한 위치의 `uv.lock` 파일 자동 업데이트.

## Add dependencies to the Langflow codebase

Langflow 코드베이스 기여 시 의존성 추가 방법.

### main 패키지에 의존성 추가

프로젝트 루트에서 실행:

```bash
uv add matplotlib
```

의존성 추가 위치:
- 일반 의존성: `[project.dependencies]`
- 선택적 의존성: `[project.optional-dependencies]`

### base 패키지에 의존성 추가

`src/backend/base` 디렉토리로 이동 후 실행:

```bash
cd src/backend/base && uv add DEPENDENCY
```

### 개발 의존성 추가

테스트, 린팅, 디버깅용:

```bash
cd src/backend/base && uv add --group dev DEPENDENCY
```

### make 명령 사용 (선택사항)

```bash
# main 패키지에 추가 (uv add matplotlib 와 동일)
make add main="matplotlib"

# base 패키지 개발 의존성에 추가
make add devel="matplotlib"

# base 패키지에 추가
make add base="matplotlib"
```

### 수동으로 pyproject.toml 편집

**일반 의존성:**

```toml
[project]
dependencies = [
    "matplotlib>=3.8.0"
]
```

**선택적 의존성 (main 패키지):**

```toml
[project.optional-dependencies]
plotting = [
    "matplotlib>=3.8.0",
]
```

**개발 의존성 (base 패키지):**

```toml
[dependency-groups]
dev = [
    "matplotlib>=3.8.0",
]
```

## See also

- [Containerize a Langflow application](/develop-application)
- [Create custom Python components](/components-custom-components)
