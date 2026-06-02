# Traceloop

Traceloop SDK: LLM 애플리케이션용 경량 계측 툴킷.
개발자가 LLM 워크플로우에서 트레이스, 메트릭, 주요 관찰성 신호를 자동 캡처 및 내보내기.

Instana와 결합 시 Traceloop에서 내보낸 텔레메트리 데이터로 엔드투엔드 가시성 제공.
트레이스 시각화, 성능 병목 분석, LLM 애플리케이션의 안정적 운영 보장.

## Prerequisites

- [Traceloop API 키](https://app.traceloop.com/settings/api-key) 생성
- [Instana 엔드포인트 및 Instana 키](https://www.ibm.com/docs/en/instana-observability/1.0.302) 생성
- [Langflow 설치](/get-started-installation)

## Configure environment variables

1. Langflow 애플리케이션 루트 폴더에 `.env` 파일 생성 또는 편집

2. 환경 변수 설정:

```bash
TRACELOOP_API_KEY=tl_dummy_1234567890abcdef1234567890abcdef
TRACELOOP_BASE_URL=https://otlp-magenta-saas.instana.rocks:4318
TRACELOOP_HEADERS="x-instana-key=INSTANA_KEY"
OTEL_EXPORTER_OTLP_INSECURE=false
TRACELOOP_METRICS_ENDPOINT=HOST:8000
TRACELOOP_METRICS_ENABLED=true
OTEL_METRIC_EXPORT_INTERVAL=10000
```

### 환경 변수 설명

| 변수 | 설명 |
|------|------|
| `TRACELOOP_API_KEY` | Traceloop 모니터링 서비스 인증용 API 키. Traceloop 계정 대시보드에서 획득. 없으면 플레이스홀더 사용 가능 |
| `TRACELOOP_BASE_URL` | 텔레메트리 데이터 수집용 Instana 엔드포인트 URL (예: `https://otlp-magenta-saas.instana.rocks:4318`) |
| `TRACELOOP_HEADERS` | Instana 데이터 수집용 인증 헤더. `"x-instana-key=INSTANA_KEY"` 형식 |
| `OTEL_EXPORTER_OTLP_INSECURE` | OpenTelemetry Protocol 연결 보안 설정. `false`: 보안 HTTPS/TLS (프로덕션 권장), `true`: 비보안 HTTP (개발용) |
| `TRACELOOP_METRICS_ENDPOINT` | 별도 메트릭 엔드포인트. Docker 환경: `host.docker.internal:8000` |
| `TRACELOOP_METRICS_ENABLED` | 메트릭 수집 활성화 (`true`) |
| `OTEL_METRIC_EXPORT_INTERVAL` | 메트릭 내보내기 간격 (밀리초). `10000` = 10초 |

### OpenTelemetry Data Collector 설정

OTel DC가 실행 중이고 올바르게 설정되었는지 확인.
Collector의 `config.yaml` 파일 설정:

```yaml
llm.application: "LLM_DC"
instances:
  - otel.agentless.mode: true
    # Example endpoint: https://otlp-magenta-saas.instana.rocks:4318
    otel.backend.url: "INSTANA_ENDPOINT"
    otel.backend.using.http: false
    callback.interval: 10
    otel.service.name: "DC1"
    otel.service.port: 8000
    currency: "USD"
```

## Start Langflow with Traceloop environment variables

`.env` 파일로 Langflow 시작:

```bash
uv run langflow run --env-file .env
```

Traceloop가 자동으로 LLM 애플리케이션의 텔레메트리 데이터 모니터링 및 수집 시작.

## Verify the integration

관찰성 정상 작동 확인:

### 트레이스 확인

1. Langflow에서 Flow 실행하여 트래픽 생성
2. Instana에서 **Applications** 클릭
3. **Services**에서 `Langflow` 검색
4. **Langflow** 클릭하여 관련 호출 확인 및 분석

### 메트릭 확인

1. Instana에서 **Infrastructure** 클릭
2. **Analyze Infrastructure**에서 **Otel LLMonitor** 클릭
3. `LLM:DC1@your_machine_name.local` 클릭하여 메트릭 대시보드 확인

## See also

- [Traceloop documentation](https://www.traceloop.com/docs/introduction)
- [Instana setup documentation](https://www.ibm.com/docs/en/instana-observability/1.0.300?topic=started-instana-setup)
- [Otel DC setup documentation](https://www.ibm.com/docs/en/instana-observability/1.0.300?topic=started-install-otel-data-collector-llm-odcl)
