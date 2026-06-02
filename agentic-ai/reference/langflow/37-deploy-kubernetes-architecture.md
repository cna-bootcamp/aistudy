# Langflow architecture on Kubernetes

## 배포 유형

| 유형 | 설명 | 용도 |
|------|------|------|
| **Langflow IDE (개발)** | 비주얼 에디터(프론트엔드) + API(백엔드) 배포 | 개발 환경에서 Flow 생성 및 관리 |
| **Langflow runtime (프로덕션)** | 헤드리스(백엔드 전용) 서비스 | Flow를 프로그래매틱하게 실행하는 프로덕션 환경 |

### Langflow IDE (개발)

- 비주얼 에디터와 API 모두 배포
- 개발자가 프로덕션 런타임 배포 전 Flow 생성 및 관리에 사용
- [docker-compose.yml](https://github.com/langflow-ai/langflow/blob/main/docker_example/docker-compose.yml)로 IDE 이미지 빌드
- 자세한 정보: [Deploy the Langflow development environment on Kubernetes](/deployment-kubernetes-dev)

### Langflow runtime (프로덕션)

- 프로덕션 Flow용 Langflow 런타임 배포
- 헤드리스(백엔드 전용) 서비스로 Langflow API 서비스에 집중
- Flow를 엔드포인트로 노출하고 각 Flow 서비스에 필요한 프로세스만 실행
- 확장성 및 안정성 향상을 위해 **외부 PostgreSQL 데이터베이스 강력 권장**
- 자세한 정보: [Deploy the Langflow production environment on Kubernetes](/deployment-kubernetes-prod)

> **Tip**: `LANGFLOW_BACKEND_ONLY` [환경 변수](/environment-variables)로 헤드리스 모드 시작 가능.

Docker 배포: [Deploy the Langflow IDE and runtime on Docker](/deployment-docker) 참조.

## Benefits of deploying Langflow on Kubernetes

| 장점 | 설명 |
|------|------|
| **확장성 (Scalability)** | 워크로드 요구에 맞게 Langflow 서비스 확장 가능 |
| **가용성 및 복원력 (Availability)** | 자동 장애 조치 및 자가 복구 등 내장 복원력 기능 |
| **보안 (Security)** | 역할 기반 액세스 제어 및 네트워크 격리 등 보안 기능 |
| **이식성 (Portability)** | 온프레미스 또는 클라우드의 모든 Kubernetes 클러스터에 배포 가능 |

**클라우드 플랫폼 지원:** AWS EKS, Google GKE, Azure AKS 등.
자세한 정보: [Langflow Helm charts repository](https://github.com/langflow-ai/langflow-helm-charts)

## Langflow deployment

**일반적인 Langflow 배포 구성:**

| 구성 요소 | 설명 |
|-----------|------|
| **Langflow 서비스** | Langflow API 및 IDE 배포 시 비주얼 에디터 |
| **Kubernetes 클러스터** | Langflow 및 지원 서비스 배포/관리 플랫폼 |
| **영구 스토리지** | 모델 및 학습 데이터 등 서비스 데이터 저장 |
| **Ingress 컨트롤러** | Langflow 서비스로의 트래픽 단일 진입점 |
| **로드 밸런서** | 여러 Langflow 복제본 간 트래픽 분산 |
| **벡터 데이터베이스** | RAG 사용 시 Astra Serverless의 벡터 데이터베이스 통합 가능 |

## Environment isolation

**개발 및 프로덕션 환경 분리 권장:**

- **개발 환경**: IDE 배포 - 개발자가 새 Flow 프로토타입 및 테스트
- **프로덕션 환경**: 런타임 배포 - Flow를 독립 서비스로 서비스

### 분리의 장점

| 장점 | 설명 |
|------|------|
| **격리 (Isolation)** | 애플리케이션 라이프사이클의 다른 단계 격리. 개발 관련 문제가 프로덕션에 영향 최소화 |
| **액세스 제어** | 각 환경에 다른 보안 정책 및 액세스 제어 적용 가능 |
| **공격 표면 감소** | 런타임 환경은 필수 컴포넌트만 포함하여 공격 표면 및 잠재적 취약점 감소 |
| **최적화된 리소스 사용 및 비용 효율성** | 리소스를 더 효과적으로 할당. 각 Flow를 독립적으로 배포하여 세밀한 리소스 제어 |
| **확장성** | 런타임 환경을 애플리케이션 로드 및 성능 요구 사항에 따라 독립적으로 확장 |

## Next steps

- [Best practices for Langflow on Kubernetes](/deployment-prod-best-practices)
- [Deploy the Langflow development environment on Kubernetes](/deployment-kubernetes-dev)
- [Deploy the Langflow production environment on Kubernetes](/deployment-kubernetes-prod)

