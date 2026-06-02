# Arize

Arize: [OpenTelemetry](https://opentelemetry.io/)와 [OpenInference](https://docs.arize.com/phoenix/reference/open-inference) 기반의
LLM 애플리케이션 모니터링 및 최적화 도구.

Arize 트레이싱 활성화 시 Langflow 배포에 필요한 환경 변수를 설정하면
Arize가 자동으로 LLM 애플리케이션의 텔레메트리 데이터 수집 시작.

## Prerequisites

| 플랫폼 | 필요 항목 |
|--------|----------|
| **Arize Platform** (표준) | Arize Space ID + Arize API Key |
| **Arize Phoenix** (오픈소스) | Arize Phoenix API Key |

## Connect Arize to Langflow

### Arize Platform 연결

1. [Arize 대시보드](https://app.arize.com/)에서 **Space ID**와 **API Key (Ingestion Service Account Key)** 복사

2. Langflow 애플리케이션 루트에 `.env` 파일 생성 또는 편집

3. 환경 변수 추가:
   ```bash
   ARIZE_SPACE_ID=SPACE_ID
   ARIZE_API_KEY=API_KEY
   ```
   > Arize 표준 플랫폼 사용 시 프로젝트 이름 지정 불필요

4. Langflow 시작:
   ```bash
   uv run langflow run --env-file .env
   ```

### Arize Phoenix 연결

1. [Arize Phoenix](https://docs.arize.com/phoenix)에서 API Key 획득

2. `.env` 파일에 환경 변수 추가:
   ```bash
   PHOENIX_API_KEY=API_KEY
   PHOENIX_COLLECTOR_ENDPOINT=https://your-phoenix-endpoint
   ```

3. Langflow 시작:
   ```bash
   uv run langflow run --env-file .env
   ```

## Run a flow and view metrics in Arize

### Flow 실행

1. Langflow에서 LLM 기반 컴포넌트가 있는 Flow 실행
   - **Agent** 컴포넌트 또는 언어 모델 컴포넌트 사용
   - Arize 트레이싱을 위해 Flow와 채팅하거나 LLM을 트리거하여 트래픽 생성

   예시:
   - **Simple Agent** 템플릿으로 Flow 생성
   - **Agent** 컴포넌트에 OpenAI API 키 추가
   - **Playground** 클릭하여 Flow와 채팅하고 트래픽 생성

### Arize에서 메트릭 확인

2. Arize에서 프로젝트 대시보드 열고 데이터 처리 대기 (몇 분 소요 가능)

3. **LLM Tracing** 탭에서 Flow 메트릭 확인

   각 Langflow 실행은 Arize에서 두 개의 트레이스 생성:
   | 트레이스 | 설명 |
   |----------|------|
   | `AgentExecutor` | LangChain의 `AgentExecutor` Arize 트레이스 |
   | `UUID` | Langflow 컴포넌트의 트레이스 |

4. **Traces** 탭에서 트레이스 확인
   - *트레이스*: 요청의 전체 여정, 여러 *스팬*으로 구성

5. **Spans** 탭에서 스팬 확인
   - *스팬*: 트레이스 내의 단일 작업
   - 예: OpenAI 단일 API 호출 또는 커스텀 도구 단일 함수 호출

6. **Add to Dataset** 클릭하여 스팬을 데이터셋에 추가
   - **LLM Tracing** 탭의 모든 메트릭을 데이터셋에 추가 가능

7. **Datasets** 탭에서 데이터셋 확인

## See also

- [Langflow tracing with Arize Platform](https://arize.com/docs/ax/integrations/frameworks-and-platforms/langflow/langflow-tracing)
- [Langflow tracing with Arize Phoenix](https://arize.com/docs/phoenix/integrations/langflow/langflow-tracing)
- [Arize LLM tracing documentation](https://docs.arize.com/arize/llm-tracing/tracing)
