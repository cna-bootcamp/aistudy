# Best practices for Langflow on Kubernetes

Kubernetes 프로덕션 환경에서 Langflow 배포를 위한 모범 사례.

## Resources and scaling

### 최소 리소스 요구사항

| 배포 유형 | RAM | CPU | 복제본 |
|-----------|-----|-----|--------|
| **IDE (개발) - 프론트엔드** | 512Mi | 0.3 | 1 |
| **IDE (개발) - 백엔드** | 1Gi | 0.5 | 1 |
| **Runtime (프로덕션)** | 2Gi | 1000m (1 CPU) | 3 |

자세한 정보: [Langflow architecture on Kubernetes](/deployment-architecture)

### Estimate, test, and adjust

최소 권장 리소스 및 복제본으로 시작 후 모니터링하고 필요에 따라 확장.

**리소스 추정 및 성능 테스트 고려 요소:**

- Flow 복잡성
- 동시 사용자 및 요청 볼륨
  - IDE 배포: 프론트엔드 활동이 백엔드 서비스도 핑하므로 일반적으로 함께 확장 필요
- 요청 페이로드 콘텐츠 및 크기 (특히 프로덕션 배포의 파일 업로드)
- 캐시, 파일 관리, Langflow 데이터베이스의 스토리지 요구 사항
- 멀티 코어 CPU 등 더 많은 리소스가 필요할 수 있는 인프라 옵션

### Use an external PostgreSQL database

프로덕션 배포에서 확장성 및 안정성 향상을 위해 **외부 PostgreSQL 데이터베이스 권장**.

**권장 구성:**
- 영구 스토리지: 컨테이너 종료 시 데이터 손실 방지
- 고가용성(HA) 또는 Active-Active: 자동 장애 조치, 확장, 로드 밸런싱
- 다중 인스턴스 배포를 위한 공유 데이터베이스
- NFS 또는 클라우드 스토리지 등 공유 스토리지 (다중 인스턴스가 `/opt/langflow/data/`의 대용량 파일 액세스)

**PostgreSQL 파라미터 조정:**
- `work_mem`, `shared_buffers` 등 리소스 요구 사항 및 사용량 메트릭 기반 조정

자세한 정보:
- [Configure an external PostgreSQL database](/configuration-custom-database)
- [Langflow database guide for enterprise DBAs](/enterprise-database-guide)

### Use HPA for dynamic scaling

런타임(프로덕션) 배포에서 **로드 밸런싱 및 동적 확장 권장**.

**HPA (Horizontal Pod Autoscaler) 예시:**

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: langflow-runtime-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: langflow-runtime
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 80
```

## Failure points

| 장애 지점 | 완화 전략 |
|-----------|-----------|
| **데이터베이스 장애** | [Enterprise DBA 가이드](/enterprise-database-guide) 참조 |
| **파일 시스템 장애** | `/app/data/.cache` 등 파일 캐싱의 동시성 문제로 IO 오류 발생 가능. POSIX 호환 공유 파일 시스템 또는 클라우드 스토리지 사용. 영구 볼륨 사용 |
| **인스턴스 장애** | 다중 복제본 배포로 단일 인스턴스 장애 시 서비스 중단 방지. 헬스 체크로 실패한 Pod 감지 및 교체 |
| **네트워크 및 종속성 장애** | Flow에서 사용하는 외부 API/서비스 실패 가능. 재시도 로직 및 오류 처리 구현. 네트워크 지연 및 종속성 상태 모니터링 |

## Monitoring

| 모니터링 영역 | 권장 사항 |
|---------------|-----------|
| **데이터베이스 모니터링** | [Enterprise DBA 가이드](/enterprise-database-guide) 참조 |
| **애플리케이션 로그** | 오류, 경고, Flow 실행 문제 수집 및 분석. ELK Stack 또는 Fluentd로 로그 중앙화. [Langflow 로그](/logging) 검사 |
| **리소스 사용량** | CPU, 메모리, 디스크 사용량 추적. Prometheus + Grafana로 실시간 메트릭 수집 |
| **API 성능** | 응답 시간, 오류율, 요청 처리량 모니터링. 높은 지연 또는 오류 급증 시 알림 설정 |
| **관찰성 도구** | [LangWatch](/integrations-langwatch) 또는 [Opik](/integrations-opik) 통합으로 상세 Flow 추적 및 메트릭 |

**Prometheus 메트릭 활성화:**
```bash
LANGFLOW_PROMETHEUS_ENABLED=True
LANGFLOW_PROMETHEUS_PORT=9090  # 기본 포트
```

## Security

| 보안 영역 | 권장 사항 |
|-----------|-----------|
| **컨테이너 보안** | `readOnlyRootFilesystem: true` 설정으로 무단 수정 방지. 민감한 데이터 및 설정 파일 접근 제한 |
| **비밀 관리** | API 키, PostgreSQL 자격 증명 등 민감 데이터를 Kubernetes secrets 또는 HashiCorp Vault에 저장 |
| **인증, 권한 부여, 액세스 제어** | 인증 활성화하여 서버 시작 ([API keys and authentication](/api-keys-and-authentication) 참조). 방화벽, 네트워크 정책, VPC로 네트워크 및 리소스 액세스 제한 |
| **암호화 및 개인정보 보호** | GDPR 요구 사항, HTTPS, TLS, SSL 등 데이터 전송 및 저장 시 암호화. PostgreSQL SSL 연결: `?sslmode=require` 또는 `?sslmode=verify-full` |
| **보안 태세 유지** | 정기 보안 감사, 소프트웨어 업데이트, 침입 탐지 시스템으로 의심스러운 활동 모니터링 |

## See also

- [Deploy the Langflow production environment on Kubernetes](/deployment-kubernetes-prod)
- [Langflow Helm Charts repository](https://github.com/langflow-ai/langflow-helm-charts)
- [Langflow environment variables](/environment-variables)

