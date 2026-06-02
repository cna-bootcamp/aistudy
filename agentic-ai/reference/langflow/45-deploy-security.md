# Security

Langflow 보안 고려사항 및 책임.

## 개요

Langflow UI: IDE 및 코드 실행 플랫폼.
- 개발자가 임의의 Python 코드 작성 및 실행 가능
- 호스트 Langflow 백엔드 프로세스, 파일 시스템, 네트워크에 대한 전체 접근 권한
- 일부 컴포넌트는 AI 모델이 생성한 코드 실행 포함

**중요 특성:**
- 단일 Langflow 프로세스 내 사용자 간 격리 없음
- 로컬 디스크 또는 네트워크 리소스 접근 제한 없음
- Flow 가시성 및 사용자 접근 제어: 사용성 목적, 보안 강제 아님
- 멀티테넌트 배포 시 인프라 수준 보안에 의존

> **Warning**: 사용자 책임 사항:
> - 포괄적인 인프라 격리 적용
> - Flow 안전 실행 (특히 LLM 생성 코드 또는 사용자 제출 코드 포함 시)
> - Langflow 기반 API의 엔드투엔드 보안 보장 (저장 및 전송 중 데이터 포함)

## 로컬 개발 보안

Langflow: 로컬 시스템에 대한 전체 접근 권한을 가진 코드 실행 플랫폼.

**권장 사항:**
- 실행하는 Flow의 안전성 확인은 사용자 책임
- 신뢰할 수 없는 코드 또는 LLM 생성 코드 실행 시 격리/컨테이너화된 실행 환경 사용 고려

참조: [Containerize a Langflow application](/develop-application)

## 자사 배포 보안 (First-party deployments)

자신 또는 조직이 작성한 Flow 기반 API 서비스 시 보안 책임.

**API 보안 모범 사례:**
- 보안 API 게이트웨이로 인증 및 권한 부여 제공
- 사용자 데이터 적절한 격리
- XSS 및 인젝션 공격에 대한 입출력 검증
- ReDoS 취약점 방지를 위한 정규식 패턴 검증

참조:
- [Deploy Langflow with Nginx and SSL](/deployment-nginx-ssl)
- [API keys and authentication](/api-keys-and-authentication)

## 서드파티 배포 보안 (Third-party deployments)

서드파티에게 Langflow 서비스 제공 시 모든 실행 코드가 잠재적으로 악의적일 수 있다고 가정.

**필수 격리 조치:**

| 격리 유형 | 목적 |
|----------|------|
| 프로세스 격리 | 테넌트 간 단일 Langflow 프로세스 공유 방지 |
| 디스크 격리 | 쓰기 가능한 영구 스토리지 공유 접근 방지 |
| 네트워크 격리 | 프라이빗 네트워크 접근 방지 |
| 데이터베이스 격리 | 공유 데이터베이스 리소스 접근/수정 방지 |

**추가 요구사항:**
- 인증 및 권한 부여: Langflow 컨테이너 외부에서 제공 및 적용
- 공유 서비스 (데이터베이스 등): 자격 증명 및 보안 정책으로 외부에서 접근 제한 적용

참조: [Best practices for Langflow on Kubernetes](/deployment-prod-best-practices)

## Security Bulletin

보안 취약점, 수정 사항, CVE에 대한 최신 정보:
- [Langflow Security Policy](https://github.com/langflow-ai/langflow/blob/main/SECURITY.md)
- [Langflow GitHub Security Advisories](https://github.com/langflow-ai/langflow/security/advisories)

**취약점 발견 시:**
- [GitHub Security 탭](https://github.com/langflow-ai/langflow/security)을 통해 책임감 있게 보고
- 평가 및 해결 전까지 공개 비공개 권장

