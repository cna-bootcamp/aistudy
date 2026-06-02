# Langflow deployment overview

로컬에서 구축한 Flow를 배포하는 다양한 방법 안내.

## 배포 옵션

| 방법 | 설명 | 사용 사례 |
|------|------|----------|
| [Public server](/deployment-public-server) | ngrok 게이트웨이를 통한 로컬 서버 셀프 호스팅 | 클라우드 제공자 배포 없이 인터넷으로 로컬 서버 공유 |
| [Containerize](/develop-application) | Flow 파일 포함 Langflow 컨테이너 빌드 및 배포 | 다양한 환경에서 이식 가능한 재현 가능 Docker 이미지 |
| [Remote server](/deployment-caddyfile) | Docker와 Caddy로 원격 서버에 배포 | Docker 컨테이너와 Caddy 리버스 프록시로 HTTPS 지원 |
| [Nginx + SSL](/deployment-nginx-ssl) | Nginx와 자동 SSL 인증서로 배포 | Docker 없이 Let's Encrypt로 자동 HTTPS 인증서 관리 |
| [Kubernetes](/deployment-prod-best-practices) | Kubernetes에 배포 | 고가용성, 확장성, 견고한 오케스트레이션의 프로덕션급 배포 |
| 클라우드 제공자 | 클라우드 제공자별 배포 가이드 | [GCP](/deployment-gcp), [Hugging Face Spaces](/deployment-hugging-face-spaces) 등 |

## 배포 방법 선택 가이드

### 개발/테스트용
- **ngrok Public server**: 빠른 공유 및 테스트에 적합

### 프로덕션용
- **Kubernetes**: 대규모 트래픽, 고가용성 필요 시
- **Docker + Caddy/Nginx**: 중소 규모 배포

### 클라우드 네이티브
- **GCP, AWS, Azure**: 각 클라우드 제공자의 관리형 서비스 활용
- **Hugging Face Spaces**: AI/ML 커뮤니티와 쉬운 공유

