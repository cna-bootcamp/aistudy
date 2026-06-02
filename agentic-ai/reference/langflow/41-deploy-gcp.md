# Deploy Langflow on Google Cloud Platform

[Google Cloud Platform](https://console.cloud.google.com/)에 Langflow 배포.

Cloud Shell 스크립트로 Debian 기반 VM에 Langflow 패키지, Nginx, 필요한 설정을 구성하여
GCP에서 Langflow 개발 환경 실행.

## Prerequisites

리소스 생성에 필요한 권한이 있는 Google Cloud 프로젝트.

## 배포 단계

1. **Cloud Shell에서 GCP 배포 스크립트 실행:**

   [![Deploy to Google Cloud](https://gstatic.com/cloudssh/images/open-btn.svg)](https://console.cloud.google.com/cloudshell/open?git_repo=https://github.com/langflow-ai/langflow&working_dir=scripts/gcp&shellonly=true&tutorial=walkthroughtutorial.md)

2. **Trust repo 클릭**

   > **Note**: 일부 `gcloud` 명령은 임시 Cloud Shell 환경에서 실행되지 않을 수 있음.

3. **Start 클릭 후 튜토리얼에 따라 Langflow 배포**

## 비용 고려사항

> **Info**: 이 배포는 GCP에 Langflow 배포 방법을 시연하기 위한 비용 효율적인 옵션으로
> [스팟(선점형) 인스턴스](https://cloud.google.com/compute/docs/instances/preemptible) 사용.
>
> **주의**: 스팟 인스턴스 특성상 Google Cloud가 리소스를 회수해야 할 경우 언제든지 VM 종료 가능.

**안정적인 배포를 위해:**
- 스팟 인스턴스 대신 일반 VM 인스턴스 사용 권장

**비용 계산:**
- [GCP 가격 계산기](https://cloud.google.com/products/calculator?hl=en) 참조

