# Dify DSL Import Validation 분석

Dify 소스 코드 기반 DSL Import 과정의 전체 검증 체인 분석 결과

## 1. 개요

### 분석 대상 소스
| 파일 | 역할 |
|------|------|
| `api/controllers/console/app/app_import.py` | Import API 컨트롤러 (진입점) |
| `api/services/app_dsl_service.py` | DSL 파싱, 버전 검증, 앱 생성/수정 핵심 로직 |
| `api/services/workflow_service.py` | 워크플로우 그래프/피처 검증, 드래프트 동기화 |
| `api/factories/variable_factory.py` | 환경변수/대화변수 생성 및 검증 |
| `api/core/workflow/graph/graph.py` | 그래프 초기화 및 구조 검증 |
| `api/core/workflow/graph/validation.py` | 그래프 검증 규칙 (엣지, 루트노드, 트리거) |
| `api/core/workflow/nodes/*/entities.py` | 노드별 Pydantic 엔티티 모델 |
| `api/core/plugin/entities/plugin.py` | 플러그인 의존성 엔티티 |

### 검증 흐름 요약
```
HTTP POST /apps/imports
  → AppImportApi.post()
    → AppDslService.import_app()
      → YAML 파싱 및 기본 구조 검증
      → 버전 호환성 검증
      → 앱 데이터 검증
      → _create_or_update_app()
        → AppMode 검증
        → 변수 빌드 (variable_factory)
        → WorkflowService.sync_draft_workflow()
          → validate_features_structure()
          → validate_graph_structure()
          → DB 저장
```

## 2. 단계별 검증 상세

### 2.1 YAML 파싱 단계 (app_dsl_service.py:196-203)

| 검증 항목 | 조건 | 오류 메시지 |
|-----------|------|-------------|
| YAML 문법 | `yaml.safe_load()` 성공 필요 | YAML 파싱 에러 메시지 |
| 데이터 타입 | 파싱 결과가 dict여야 함 | "Invalid YAML format: content must be a mapping" |

**자동 보정:**
- `version` 필드 누락 시 → `"0.1.0"` 자동 설정
- `kind` 필드 누락 또는 `"app"` 아닌 경우 → `"app"` 자동 설정

### 2.2 입력 소스 검증 (app_dsl_service.py:138-192)

| 검증 항목 | 조건 | 오류 메시지 |
|-----------|------|-------------|
| import_mode | `yaml-content` 또는 `yaml-url`만 허용 | "Invalid import_mode: {mode}" |
| yaml_content | mode가 `yaml-content`일 때 필수 | "yaml_content is required when import_mode is yaml-content" |
| yaml_url | mode가 `yaml-url`일 때 필수 | "yaml_url is required when import_mode is yaml-url" |
| URL 콘텐츠 크기 | 10MB 이하 (DSL_MAX_SIZE) | "File size exceeds the limit of 10MB" |
| URL 콘텐츠 비어있음 | 빈 응답 거부 | "Empty content from url" |

### 2.3 버전 호환성 검증 (app_dsl_service.py:76-97, 211-215)

**현재 DSL 버전:** `0.5.0` (CURRENT_DSL_VERSION)

| 검증 항목 | 조건 | 오류 메시지 |
|-----------|------|-------------|
| version 타입 | 문자열이어야 함 | "Invalid version type, expected str, got {type}" |
| 버전 파싱 | 유효한 시맨틱 버전 형식 | ImportStatus.FAILED 반환 |

**버전 비교 결과:**
| 조건 | Import 상태 | 설명 |
|------|------------|------|
| imported > current | PENDING | 사용자 확인 필요 (더 높은 버전) |
| imported.major < current.major | PENDING | 메이저 버전 차이로 호환성 확인 필요 |
| imported.minor < current.minor | COMPLETED_WITH_WARNINGS | 경고와 함께 진행 |
| 그 외 | COMPLETED | 정상 진행 |
| 파싱 실패 | FAILED | import 실패 |

### 2.4 앱 데이터 검증 (app_dsl_service.py:218-244)

| 검증 항목 | 조건 | 오류 메시지 |
|-----------|------|-------------|
| app 섹션 존재 | `data.get("app")` 필수 | "Missing app data in YAML content" |
| app_id 유효성 | 제공 시 해당 앱 존재 필요 | "App not found" |
| 앱 모드 호환 | 덮어쓰기 시 workflow/advanced-chat만 허용 | "Only workflow or advanced chat apps can be overwritten" |

### 2.5 AppMode 검증 (app_dsl_service.py:424-427)

**유효한 AppMode 값:**
| 값 | 설명 |
|----|------|
| `completion` | 텍스트 생성 |
| `chat` | 대화 |
| `advanced-chat` | 고급 대화 (워크플로우 기반) |
| `agent-chat` | 에이전트 대화 |
| `workflow` | 워크플로우 |
| `channel` | 채널 |

**검증:** `AppMode(app_mode)` — 유효하지 않은 값이면 ValueError 발생

### 2.6 워크플로우 데이터 검증 (app_dsl_service.py:479-516)

| 검증 항목 | 조건 | 오류 메시지 |
|-----------|------|-------------|
| workflow 섹션 | workflow/advanced-chat 모드에서 필수 | "Missing workflow data for workflow/advanced chat app" |
| workflow 타입 | dict 타입이어야 함 | "Missing workflow data..." |
| graph 데이터 | `workflow.get("graph", {})` 필수 | (빈 그래프로 처리) |
| features 데이터 | `workflow.get("features", {})` 필수 | (빈 피처로 처리) |

### 2.7 변수 검증 (variable_factory.py)

#### 환경변수 / 대화변수 공통 검증

| 검증 항목 | 조건 | 오류 |
|-----------|------|------|
| name 필드 | 필수 | VariableError("missing name") |
| value_type 필드 | 필수 | VariableError("missing value type") |
| value 필드 | 필수 | VariableError("missing value") |
| 크기 제한 | 200KB 이하 (MAX_VARIABLE_SIZE) | VariableError("variable size ... exceeds limit ...") |

#### 지원 value_type

| value_type | Python 타입 | 설명 |
|-----------|------------|------|
| `string` | str | 문자열 |
| `secret` | str | 비밀 문자열 |
| `number` (정수) | int | IntegerVariable |
| `number` (실수) | float | FloatVariable |
| `integer` | int | 정수 |
| `float` | float | 실수 |
| `boolean` | bool | 불리언 |
| `object` | dict | 객체 |
| `array[string]` | list | 문자열 배열 |
| `array[number]` | list | 숫자 배열 |
| `array[object]` | list | 객체 배열 |
| `array[boolean]` | list | 불리언 배열 |

**미지원 타입 사용 시:** `VariableError("not supported value type {type}")`

### 2.8 피처 구조 검증 (workflow_service.py:948-958)

**모드별 검증 대상:**

| 앱 모드 | 검증 피처 |
|---------|----------|
| `advanced-chat` | file_upload, opening_statement, suggested_questions, speech_to_text, text_to_speech, retrieval_resource, sensitive_word_avoidance |
| `workflow` | file_upload, text_to_speech, sensitive_word_avoidance |

**검증:** 각 피처 매니저의 `config_validate()` 호출. 인식되지 않는 키는 무시됨.

### 2.9 그래프 구조 검증 (workflow_service.py:923-946)

| 검증 항목 | 조건 | 오류 메시지 |
|-----------|------|-------------|
| 노드 존재 | 빈 그래프는 통과 (빈 배열) | - |
| 노드 타입 충돌 | START 노드와 트리거 노드 공존 불가 | "Start node and trigger nodes cannot coexist in the same workflow" |

### 2.10 그래프 심층 검증 (실행 시, graph.py + validation.py)

Import 시에는 경량 검증만 수행됨. 아래 심층 검증은 워크플로우 실행 시 적용:

| 규칙 | 검증 내용 | 오류 코드 |
|------|----------|----------|
| EdgeEndpointValidator | 모든 엣지의 source/target이 존재하는 노드를 참조 | MISSING_NODE |
| RootNodeValidator | 루트 노드 존재 및 실행 타입 ROOT | INVALID_ROOT |
| TriggerStartExclusivityValidator | START와 트리거 노드 공존 불가 | TRIGGER_START_NODE_CONFLICT |

## 3. 노드별 Pydantic 검증

### 3.1 공통 필드 (BaseNodeData)

모든 노드가 상속하는 기본 필드:
| 필드 | 타입 | 필수 | 기본값 |
|------|------|------|--------|
| title | str | 필수 | - |
| desc | str \| None | 선택 | None |
| version | str | 선택 | "1" |
| error_strategy | ErrorStrategy \| None | 선택 | None |
| default_value | list[DefaultValue] \| None | 선택 | None |
| retry_config | RetryConfig | 선택 | RetryConfig() |

### 3.2 Start 노드 (StartNodeData)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| variables | Sequence[VariableEntity] | 선택 | 입력 변수 목록 (기본: 빈 리스트) |

### 3.3 LLM 노드 (LLMNodeData) — 가장 복잡

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| model | ModelConfig | 필수 | provider, name, mode, completion_params |
| prompt_template | Sequence[ChatMessage] \| CompletionPrompt | 필수 | 프롬프트 템플릿 |
| context | ContextConfig | 필수 | enabled, variable_selector |
| memory | MemoryConfig \| None | 선택 | 메모리 설정 |
| vision | VisionConfig | 선택 | 비전 설정 |
| structured_output_enabled | bool | 선택 | 구조화 출력 |

**ModelConfig 필수 필드:**
- `provider`: str (예: "langgenius/groq/groq")
- `name`: str (예: "llama-3.1-8b-instant")
- `mode`: LLMMode (예: "chat")
- `completion_params`: dict

**주요 실패 원인:** model.provider/name 누락, context 객체 누락, prompt_template 구조 불일치

### 3.4 Code 노드 (CodeNodeData)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| variables | list[VariableSelector] | 필수 | 입력 변수 |
| code_language | "python3" \| "javascript" | 필수 | 코드 언어 |
| code | str | 필수 | 실행 코드 |
| outputs | dict[str, Output] | 필수 | 출력 정의 |

**Output.type 허용 값:** string, number, object, boolean, array[string], array[number], array[object], array[boolean]
**금지 값:** file, secret, array[file] — 사용 시 검증 실패

### 3.5 If/Else 노드 (IfElseNodeData)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| cases | list[Case] | 조건부 | 새 형식 (case_id, logical_operator, conditions) |
| conditions | list[Condition] | 조건부 | 레거시 형식 |
| logical_operator | "and" \| "or" | 선택 | 기본: "and" |

**주의:** cases 또는 conditions 중 하나 필수

### 3.6 HTTP Request 노드 (HttpRequestNodeData)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| method | get/post/put/patch/delete/head/options | 필수 | HTTP 메서드 |
| url | str | 필수 | 요청 URL |
| authorization | HttpRequestNodeAuthorization | 필수 | 인증 설정 |
| headers | str | 필수 | 헤더 문자열 |
| params | str | 필수 | 파라미터 문자열 |
| body | HttpRequestNodeBody \| None | 선택 | 요청 바디 |

**인증 검증:** type이 "no-auth"이면 config은 None이어야 함. 그 외에는 config이 dict 필수.

### 3.7 Template Transform 노드 (TemplateTransformNodeData)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| variables | list[VariableSelector] | 필수 | 입력 변수 |
| template | str | 필수 | Jinja2 템플릿 |

### 3.8 Variable Aggregator 노드 (VariableAggregatorNodeData)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| output_type | str | 필수 | 출력 타입 |
| variables | list[list[str]] | 필수 | 변수 셀렉터 목록 |
| advanced_settings | AdvancedSettings \| None | 선택 | 고급 설정 |

### 3.9 End 노드 (EndNodeData)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| outputs | list[OutputVariableEntity] | 필수 | 출력 변수 목록 |

**OutputVariableEntity 필수 필드:** variable, value_selector

## 4. 유효한 NodeType 값

```
start, end, answer, llm, knowledge-retrieval, knowledge-index, if-else,
code, template-transform, question-classifier, http-request, tool,
datasource, variable-aggregator, variable-assigner, loop, loop-start,
loop-end, iteration, iteration-start, parameter-extractor, assigner,
document-extractor, list-operator, agent, trigger-webhook,
trigger-schedule, trigger-plugin, human-input
```

## 5. 의존성 검증 (app_dsl_service.py:272-285)

| 검증 항목 | 설명 |
|-----------|------|
| dependencies 필드 | DSL에 포함된 플러그인 의존성 목록 |
| 자동 생성 | DSL v0.1.5 이하에서는 워크플로우/모델에서 자동 추출 |
| PluginDependency 타입 | Github, Marketplace, Package 중 하나 |
| 버전 형식 | 시맨틱 버전 (PEP 440) 준수 필요 |
| 누락 의존성 검사 | `check_dependencies()`로 설치되지 않은 의존성 확인 |

## 6. 주요 오류 클래스

| 오류 클래스 | 위치 | 발생 시점 |
|------------|------|----------|
| ValueError | 다수 | YAML 파싱, 앱 모드, 그래프 구조 등 대부분의 검증 실패 |
| VariableError | core/variables/exc.py | 변수 이름/타입/값/크기 검증 실패 |
| WorkflowHashNotEqualError | services/errors/app.py | 동시 편집 충돌 |
| GraphValidationError | core/workflow/graph/validation.py | 그래프 구조 검증 실패 |
| ValidationError (Pydantic) | 노드 엔티티 | 노드 데이터 필드 검증 실패 |

## 7. DSL Import 실패 주요 원인 Top 10

1. **YAML 문법 오류** — 들여쓰기, 특수문자 이스케이프 문제
2. **YAML 스칼라 스타일** — `>` (folded) 대신 `|` (literal) 사용해야 프롬프트 줄바꿈 유지
3. **version 필드 누락/잘못된 타입** — 문자열 `"0.5.0"` 형식 필수
4. **app 섹션 누락** — 최소 name, mode 필수
5. **잘못된 AppMode** — 유효한 값만 허용
6. **workflow 섹션 누락** — workflow/advanced-chat 모드에서 필수
7. **노드 title 필드 누락** — 모든 노드에서 필수 (BaseNodeData)
8. **LLM 노드 model 설정 오류** — provider, name, mode 필수
9. **의존성 해시 불일치** — 가짜 해시 사용 시 플러그인 확인 단계에서 실패
10. **변수 타입 불일치** — value와 value_type 간 타입 일치 필요
