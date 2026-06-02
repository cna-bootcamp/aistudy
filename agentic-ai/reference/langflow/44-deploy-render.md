# Deploy Langflow on Render

[Render](https://render.com/)에 Langflow 배포.

Render: 웹 애플리케이션 및 API 배포를 위한 클라우드 플랫폼.

## Prerequisites

Langflow 지원 가능한 Render 인스턴스 준비.

> **Note**: Langflow는 최소 2GB RAM 필요.
> **Standard** 이상의 Render 인스턴스 타입 필요 (유료 Render 계정 필요).

자세한 정보:
- [Render Web Services](https://render.com/docs/web-services)
- [Render 가격](https://render.com/pricing)

## 배포 단계

1. **Render에서 Langflow 배포 시작:**

   [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Flangflow-ai%2Flangflow%2Ftree%2Fdev)

2. **블루프린트 설정:**
   - 블루프린트 이름 입력
   - `render.yaml` 파일의 브랜치 선택
   - **Deploy Blueprint** 클릭

3. **배포 완료 시 Langflow 인스턴스 사용 준비 완료**

## 장점

- 간편한 블루프린트 기반 배포
- 자동 SSL 인증서
- 자동 배포 (Git 푸시 시)
- 관리형 데이터베이스 지원

