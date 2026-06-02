# Opik

[Opik](https://www.comet.com/site/products/opik/): LLM 애플리케이션 평가, 테스트, 모니터링을 위한 오픈소스 플랫폼.
Comet에서 개발, LLM 기반 애플리케이션의 협업, 테스트, 모니터링 지원.

Flow 실행에 대한 [트레이싱](https://www.comet.com/docs/opik/tracing/log_traces) 데이터를 수집하고
자동으로 Opik으로 전송하도록 Langflow 구성 가능.

## Prerequisites

- [오픈소스 Opik 서버 또는 Opik Cloud 계정](https://www.comet.com/docs/opik/faq#what-is-the-difference-between-opik-cloud-and-the-open-source-opik-platform-)
- 트레이싱할 Flow가 있는 [실행 중인 Langflow 서버](/get-started-installation)

## Integrate Opik with Langflow

### 설정 단계

1. **Opik Cloud 사용 시:** [Opik API 키](https://www.comet.com/docs/opik/faq#where-can-i-find-my-opik-api-key-) 획득
   > 오픈소스 Opik 서버 사용 시 API 키 불필요

2. Langflow 실행 환경에서 `opik configure` CLI 호출:

   **Opik Cloud:**
   ```bash
   opik configure
   ```

   **셀프 호스팅 Opik:**
   ```bash
   opik configure --use_local
   ```

   자세한 정보: [Opik SDK configuration documentation](https://www.comet.com/docs/opik/tracing/sdk_configuration)

3. 환경 변수 설정한 동일 터미널/환경에서 Langflow 시작:
   ```bash
   uv run langflow run
   ```

4. Langflow에서 Flow 실행하여 Opik 트레이싱 활동 생성

5. Opik 프로젝트 대시보드에서 수집된 트레이싱 데이터 확인

## Disable the Opik integration

Opik 통합 비활성화:
1. `opik configure`로 설정한 환경 변수 제거
2. Langflow 재시작

## Opik Cloud vs Open-Source

| 항목 | Opik Cloud | Open-Source Opik |
|------|------------|------------------|
| API 키 | 필요 | 불필요 |
| 설정 명령 | `opik configure` | `opik configure --use_local` |
| 호스팅 | Comet 관리 | 셀프 호스팅 |

## See also

- [Opik](https://www.comet.com/site/products/opik/)
- [Opik SDK configuration](https://www.comet.com/docs/opik/tracing/sdk_configuration)
