# Deploy the Langflow production environment on Kubernetes

[Langflow runtime Helm chart](https://github.com/langflow-ai/langflow-helm-charts/blob/main/charts/langflow-runtime):
프로덕션 환경 배포에 맞춤화. 안정성, 성능, 격리, 보안에 초점.

> **Warning**: 보안상 기본 설정 [`readOnlyRootFilesystem: true`](https://github.com/langflow-ai/langflow-helm-charts/blob/main/charts/langflow-runtime/values.yaml#L46).
> 런타임 시 컨테이너 루트 파일 시스템 수정 방지 (프로덕션 권장 보안 조치).
> 비활성화 시 보안 태세 저하. 보안 영향을 이해하고 다른 보안 조치를 구현한 경우에만 비활성화.

## Prerequisites

- [Kubernetes](https://kubernetes.io/docs/setup/) 서버
- [kubectl](https://kubernetes.io/docs/tasks/tools/#kubectl)
- [Helm](https://helm.sh/docs/intro/install/)

## Install the Langflow runtime Helm chart

1. **Helm에 리포지토리 추가:**
   ```bash
   helm repo add langflow https://langflow-ai.github.io/langflow-helm-charts
   helm repo update
   ```

2. **Langflow 앱 설치:**

   **방법 1: 커스텀 이미지로 설치**

   [패키징된 Flow가 포함된 커스텀 이미지](/deployment-docker#package-your-flow-as-a-docker-image)가 있으면
   `--set` 플래그로 기본 [values.yaml](https://github.com/langflow-ai/langflow-helm-charts/blob/main/charts/langflow-runtime/values.yaml) 재정의:

   ```bash
   helm install my-langflow-app langflow/langflow-runtime -n langflow --create-namespace --set image.repository=myuser/langflow-hello-world --set image.tag=1.0.0
   ```

   **방법 2: Flow 다운로드로 설치**

   `downloadFlows` 옵션으로 URL에서 Flow 다운로드:

   ```bash
   helm install my-langflow-app-with-flow langflow/langflow-runtime \
     -n langflow \
     --create-namespace \
     --set "downloadFlows.flows[0].url=https://raw.githubusercontent.com/langflow-ai/langflow-helm-charts/refs/heads/main/examples/flows/basic-prompting-hello-world.json"
   ```

3. **Pod 상태 확인:**
   ```bash
   kubectl get pods -n langflow
   ```

## Access the Langflow runtime

1. **서비스 이름 확인:**
   ```bash
   kubectl get svc -n langflow
   ```
   서비스 이름: 릴리스 이름 + `-langflow-runtime` (예: `my-langflow-app-with-flow-langflow-runtime`)

2. **포트 포워딩 활성화:**
   ```bash
   kubectl port-forward -n langflow svc/my-langflow-app-with-flow-langflow-runtime 7860:7860
   ```

3. **API 접근 확인:**
   ```bash
   curl -v http://localhost:7860/api/v1/flows/
   ```
   성공 시 Flow 목록 반환.

4. **패키징된 Flow 실행:**
   ```bash
   # Flow ID 가져오기
   id=$(curl -s "http://localhost:7860/api/v1/flows/" | jq -r '.[0].id')

   # Flow 실행
   curl -X POST \
     "http://localhost:7860/api/v1/run/$id?stream=false" \
     -H 'Content-Type: application/json' \
     -d '{
       "input_value": "Hello!",
       "output_type": "chat",
       "input_type": "chat"
     }'
   ```

## Configure secrets and environment variables

[values.yaml](https://github.com/langflow-ai/langflow-helm-charts/blob/main/charts/langflow-runtime/values.yaml)의 `.env` 섹션으로
Langflow 배포의 환경 변수 정의.

- 내장 [Langflow 환경 변수](/environment-variables)
- Flow에서 사용하는 [전역 변수](/configuration-global-variables)

Langflow는 Kubernetes secrets 등 런타임 환경에서 전역 변수 소싱 가능.

> **Tip**: Flow를 JSON 파일로 내보낼 때 비밀 생략 권장.
> **Save with my API keys** 옵션 사용 여부에 따라 비밀 포함 결정.
> 자세한 정보: [Import and export flows](/concepts-flows-import)

### Set secrets

Kubernetes secrets: 민감한 값과 자격 증명 저장에 권장.

**`values.yaml`에서 `secretKeyRef`로 Kubernetes secret 참조:**
```yaml
env:
  - name: OPENAI_API_KEY
    valueFrom:
      secretKeyRef:
        name: openai-credentials
        key: openai-key
```

**kubectl과 helm으로 비밀 생성 및 설정:**
```bash
# Kubernetes secret 생성
kubectl create secret generic openai-credentials \
  --from-literal=openai-key=sk-... \
  -n langflow

# Helm 설치 시 secret 참조
helm install my-langflow-app langflow/langflow-runtime \
  -n langflow \
  --set "env[0].name=OPENAI_API_KEY" \
  --set "env[0].valueFrom.secretKeyRef.name=openai-credentials" \
  --set "env[0].valueFrom.secretKeyRef.key=openai-key"
```

### Set the log level and other configuration variables

비민감 변수는 `values.yaml`에 직접 값 설정:
```yaml
env:
  - name: LANGFLOW_LOG_LEVEL
    value: "INFO"
```

## Configure scaling

[values.yaml](https://github.com/langflow-ai/langflow-helm-charts/blob/main/charts/langflow-runtime/values.yaml)에서
`replicaCount` 및 `resources`로 확장 설정.

### Horizontal scaling

`replicaCount`로 복제본 수 설정:
```yaml
replicaCount: 3
```

### Vertical scaling

`resources` 섹션으로 Pod 리소스 조정:
```yaml
resources:
  requests:
    memory: "2Gi"
    cpu: "1000m"
```

## See also

- [Best practices for Langflow on Kubernetes](/deployment-prod-best-practices)
- [Langflow Helm Charts repository](https://github.com/langflow-ai/langflow-helm-charts)

