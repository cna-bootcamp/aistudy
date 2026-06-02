# Deploy the Langflow development environment on Kubernetes

[Langflow IDE Helm chart](https://github.com/langflow-ai/langflow-helm-charts/tree/main/charts/langflow-ide):
개발자가 Flow를 생성, 테스트, 디버그할 수 있는 완전한 환경 제공.
Langflow API와 비주얼 에디터 모두 포함.

## Prerequisites

- [Kubernetes](https://kubernetes.io/docs/setup/) 클러스터
- [kubectl](https://kubernetes.io/docs/tasks/tools/#kubectl)
- [Helm](https://helm.sh/docs/intro/install/)

## Prepare a Kubernetes cluster

예시: [Minikube](https://minikube.sigs.k8s.io/docs/start/) 사용 (다른 Kubernetes 클러스터도 가능).

1. **Minikube에서 Kubernetes 클러스터 생성:**
   ```bash
   minikube start
   ```

2. **kubectl이 Minikube 사용하도록 설정:**
   ```bash
   kubectl config use-context minikube
   ```

## Install the Langflow IDE Helm chart

1. **Helm에 리포지토리 추가 및 업데이트:**
   ```bash
   helm repo add langflow https://langflow-ai.github.io/langflow-helm-charts
   helm repo update
   ```

2. **`langflow` 네임스페이스에 기본 옵션으로 Langflow 설치:**
   ```bash
   helm install langflow-ide langflow/langflow-ide -n langflow --create-namespace
   ```

3. **Pod 상태 확인:**
   ```bash
   kubectl get pods -n langflow
   ```

## Access the Langflow IDE

로컬 포트 포워딩 활성화하여 로컬 머신에서 Langflow 접근:

1. **Langflow API를 포트 7860에서 접근 가능하게 설정:**
   ```bash
   kubectl port-forward -n langflow svc/langflow-service-backend 7860:7860
   ```

2. **비주얼 에디터를 포트 8080에서 접근 가능하게 설정:**
   ```bash
   kubectl port-forward -n langflow svc/langflow-service 8080:8080
   ```

**접근 URL:**
- Langflow API: `http://localhost:7860`
- 비주얼 에디터: `http://localhost:8080`

## Modify your Langflow IDE deployment

[values.yaml](https://github.com/langflow-ai/langflow-helm-charts/blob/main/charts/langflow-ide/values.yaml)
파일을 수정하여 배포 커스터마이징.

> **Note**: 비밀 설정 시 Kubernetes secrets 권장.

### Deploy a different Langflow version

기본: 최신 Langflow 버전 배포.

**다른 버전 지정:**
```yaml
langflow:
  backend:
    image:
      tag: "1.0.0a59"
  frontend:
    image:
      tag: "1.0.0a59"
```

### Use external storage for the Langflow database

기본: 로컬 영구 디스크에 저장된 SQLite 데이터베이스.

**외부 PostgreSQL 데이터베이스 사용:**

**방법 1: 내장 PostgreSQL 차트 사용**
```yaml
postgresql:
  enabled: true
  auth:
    username: "langflow"
    password: "langflow-postgres"
    database: "langflow-db"
```

**방법 2: 외부 데이터베이스 연결**
```yaml
externalDatabase:
  enabled: true
  driver: "postgresql"
  host: "your-postgres-host"
  port: 5432
  database: "langflow-db"
  user: "langflow"
  password: "your-password"
```

### Configure scaling

수평 확장(`replicaCount`) 및 수직 확장(`resources`) 설정.

> **Note**: Flow가 [내장 채팅 메모리](/memory) 등 공유 상태에 의존하면
> 수평 확장 시 공유 데이터베이스 설정 필요.

```yaml
langflow:
  backend:
    replicaCount: 1
    resources:
      requests:
        cpu: 0.5
        memory: 1Gi
      # limits:
      #   cpu: 0.5
      #   memory: 1Gi

  frontend:
    enabled: true
    replicaCount: 1
    resources:
      requests:
        cpu: 0.3
        memory: 512Mi
      # limits:
      #   cpu: 0.3
      #   memory: 512Mi
```

## See also

- [Best practices for Langflow on Kubernetes](/deployment-prod-best-practices)
- [Deploy the Langflow production environment on Kubernetes](/deployment-kubernetes-prod)
- [Langflow Helm Charts repository](https://github.com/langflow-ai/langflow-helm-charts)

