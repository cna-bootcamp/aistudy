# n8n 로그 스트리밍

## 개요

로그 스트리밍(Log Streaming)은 n8n의 실행 로그와 이벤트를 외부 로그 관리 시스템으로 실시간 전송하는 Enterprise 기능임

## 주요 개념

### 로그 스트리밍의 목적
- 중앙 집중식 로그 관리
- 실시간 모니터링 및 알림
- 장기 보관 및 분석
- 규정 준수 및 감사
- 통합 대시보드 구성

### 이점
**운영 효율성**:
- 여러 n8n 인스턴스의 로그 통합
- 실시간 문제 감지
- 빠른 트러블슈팅

**보안 및 규정 준수**:
- 변조 방지 로그 저장
- 감사 추적
- 규정 요구사항 충족

## 로그 스트리밍 설정

### 사전 요구사항
- n8n Enterprise 라이선스
- 지원되는 로그 수집 시스템
- 네트워크 연결
- 적절한 권한

### 설정 프로세스

**STEP 1. 로그 수집 시스템 준비**
로그를 받을 외부 시스템 설정:
- Elasticsearch/OpenSearch
- Splunk
- Datadog
- New Relic
- CloudWatch
- 기타 로그 집계 시스템

**STEP 2. n8n 환경 변수 설정**

```bash
# 로그 스트리밍 활성화
N8N_LOG_STREAMING_ENABLED=true

# 로그 레벨 설정
N8N_LOG_LEVEL=info  # debug, info, warn, error

# 로그 형식
N8N_LOG_OUTPUT=json  # json 또는 text

# 로그 전송 방식
N8N_LOG_STREAMING_TYPE=webhook  # webhook, syslog, fluentd 등
```

**STEP 3. 대상 시스템 구성**

**Webhook 방식**:
```bash
N8N_LOG_STREAMING_WEBHOOK_URL=https://logs.example.com/webhook
N8N_LOG_STREAMING_WEBHOOK_METHOD=POST
N8N_LOG_STREAMING_WEBHOOK_HEADERS='{"Authorization":"Bearer token123"}'
```

**Syslog 방식**:
```bash
N8N_LOG_STREAMING_SYSLOG_HOST=syslog.example.com
N8N_LOG_STREAMING_SYSLOG_PORT=514
N8N_LOG_STREAMING_SYSLOG_PROTOCOL=tcp  # tcp 또는 udp
```

**STEP 4. n8n 재시작 및 검증**
- n8n 인스턴스 재시작
- 로그 전송 확인
- 대상 시스템에서 로그 수신 검증

## 이벤트 유형

### 워크플로우 이벤트

**workflow.started**:
워크플로우 실행 시작
```json
{
  "event": "workflow.started",
  "workflowId": "abc123",
  "workflowName": "Data Sync",
  "executionId": "exec456",
  "timestamp": "2024-01-15T10:30:00Z",
  "trigger": "webhook",
  "mode": "production"
}
```

**workflow.completed**:
워크플로우 정상 완료
```json
{
  "event": "workflow.completed",
  "workflowId": "abc123",
  "executionId": "exec456",
  "duration": 1250,
  "status": "success",
  "timestamp": "2024-01-15T10:30:01Z"
}
```

**workflow.failed**:
워크플로우 실행 실패
```json
{
  "event": "workflow.failed",
  "workflowId": "abc123",
  "executionId": "exec456",
  "error": {
    "message": "Connection timeout",
    "stack": "...",
    "nodeId": "node789"
  },
  "timestamp": "2024-01-15T10:30:01Z"
}
```

### 노드 이벤트

**node.executed**:
개별 노드 실행 완료
```json
{
  "event": "node.executed",
  "workflowId": "abc123",
  "executionId": "exec456",
  "nodeId": "node789",
  "nodeName": "HTTP Request",
  "nodeType": "n8n-nodes-base.httpRequest",
  "duration": 350,
  "itemsProcessed": 5,
  "timestamp": "2024-01-15T10:30:00.5Z"
}
```

**node.error**:
노드 실행 중 오류
```json
{
  "event": "node.error",
  "workflowId": "abc123",
  "executionId": "exec456",
  "nodeId": "node789",
  "nodeName": "HTTP Request",
  "error": {
    "message": "404 Not Found",
    "statusCode": 404
  },
  "timestamp": "2024-01-15T10:30:00.5Z"
}
```

### 시스템 이벤트

**system.startup**:
n8n 인스턴스 시작
```json
{
  "event": "system.startup",
  "version": "1.20.0",
  "instanceId": "instance-xyz",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

**system.shutdown**:
n8n 인스턴스 종료
```json
{
  "event": "system.shutdown",
  "instanceId": "instance-xyz",
  "timestamp": "2024-01-15T18:00:00Z"
}
```

### 인증 이벤트

**auth.login**:
사용자 로그인
```json
{
  "event": "auth.login",
  "userId": "user123",
  "email": "user@example.com",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2024-01-15T09:00:00Z"
}
```

**auth.failed**:
로그인 실패
```json
{
  "event": "auth.failed",
  "email": "user@example.com",
  "ip": "192.168.1.100",
  "reason": "invalid_password",
  "timestamp": "2024-01-15T09:00:05Z"
}
```

### Credential 이벤트

**credential.created**:
Credential 생성
```json
{
  "event": "credential.created",
  "credentialId": "cred789",
  "credentialType": "slackApi",
  "userId": "user123",
  "timestamp": "2024-01-15T11:00:00Z"
}
```

**credential.updated**:
Credential 수정
```json
{
  "event": "credential.updated",
  "credentialId": "cred789",
  "userId": "user123",
  "timestamp": "2024-01-15T12:00:00Z"
}
```

**credential.deleted**:
Credential 삭제
```json
{
  "event": "credential.deleted",
  "credentialId": "cred789",
  "userId": "user123",
  "timestamp": "2024-01-15T13:00:00Z"
}
```

## 로그 대상 (Destinations)

### Webhook
HTTP POST로 로그 전송

**구성**:
```bash
N8N_LOG_STREAMING_TYPE=webhook
N8N_LOG_STREAMING_WEBHOOK_URL=https://api.example.com/logs
N8N_LOG_STREAMING_WEBHOOK_HEADERS='{"X-API-Key":"secret"}'
```

**용도**:
- 커스텀 로그 수집기
- 로그 처리 파이프라인
- Zapier, Make.com 등 통합

### Elasticsearch/OpenSearch
검색 및 분석에 최적화된 로그 저장

**구성**:
```bash
N8N_LOG_STREAMING_TYPE=elasticsearch
N8N_LOG_STREAMING_ES_URL=https://elasticsearch.example.com
N8N_LOG_STREAMING_ES_INDEX=n8n-logs
N8N_LOG_STREAMING_ES_USERNAME=elastic
N8N_LOG_STREAMING_ES_PASSWORD=password
```

**장점**:
- 강력한 검색 기능
- Kibana로 시각화
- 대용량 로그 처리

### Splunk
엔터프라이즈 로그 분석 플랫폼

**구성**:
```bash
N8N_LOG_STREAMING_TYPE=splunk
N8N_LOG_STREAMING_SPLUNK_URL=https://splunk.example.com:8088
N8N_LOG_STREAMING_SPLUNK_TOKEN=your-hec-token
N8N_LOG_STREAMING_SPLUNK_INDEX=n8n
```

**용도**:
- 엔터프라이즈 모니터링
- 보안 분석 (SIEM)
- 규정 준수

### Datadog
클라우드 모니터링 및 로그 관리

**구성**:
```bash
N8N_LOG_STREAMING_TYPE=datadog
N8N_LOG_STREAMING_DATADOG_API_KEY=your-api-key
N8N_LOG_STREAMING_DATADOG_SITE=datadoghq.com
N8N_LOG_STREAMING_DATADOG_SERVICE=n8n
```

**기능**:
- APM 통합
- 실시간 알림
- 대시보드 및 메트릭

### AWS CloudWatch
AWS 네이티브 로그 서비스

**구성**:
```bash
N8N_LOG_STREAMING_TYPE=cloudwatch
N8N_LOG_STREAMING_CW_LOG_GROUP=/n8n/logs
N8N_LOG_STREAMING_CW_LOG_STREAM=instance-1
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

**장점**:
- AWS 서비스 통합
- CloudWatch Insights
- Lambda 트리거

### Syslog
표준 syslog 프로토콜

**구성**:
```bash
N8N_LOG_STREAMING_TYPE=syslog
N8N_LOG_STREAMING_SYSLOG_HOST=syslog.example.com
N8N_LOG_STREAMING_SYSLOG_PORT=514
N8N_LOG_STREAMING_SYSLOG_PROTOCOL=tcp
N8N_LOG_STREAMING_SYSLOG_FACILITY=local0
```

**호환성**:
- Rsyslog
- Syslog-ng
- 기존 로그 인프라

## 로그 필터링 및 커스터마이징

### 로그 레벨 설정

```bash
# 모든 로그 (상세)
N8N_LOG_LEVEL=debug

# 일반 정보 (권장)
N8N_LOG_LEVEL=info

# 경고 및 오류만
N8N_LOG_LEVEL=warn

# 오류만
N8N_LOG_LEVEL=error
```

### 이벤트 필터링

특정 이벤트만 스트리밍:
```bash
N8N_LOG_STREAMING_EVENTS=workflow.started,workflow.failed,auth.login
```

특정 워크플로우만:
```bash
N8N_LOG_STREAMING_WORKFLOW_IDS=workflow1,workflow2,workflow3
```

### 민감 데이터 제외

```bash
# 노드 데이터 제외 (개인정보 보호)
N8N_LOG_STREAMING_INCLUDE_NODE_DATA=false

# Credential 정보 제외 (항상 기본값)
N8N_LOG_STREAMING_INCLUDE_CREDENTIALS=false
```

### 커스텀 필드 추가

환경 정보 추가:
```bash
N8N_LOG_STREAMING_CUSTOM_FIELDS='{"environment":"production","region":"us-east-1","cluster":"main"}'
```

## 모니터링 및 알림

### 주요 메트릭

**성능 메트릭**:
- 워크플로우 평균 실행 시간
- 노드별 처리 시간
- 시간대별 실행 횟수
- 동시 실행 워크플로우 수

**오류 메트릭**:
- 실패율
- 오류 유형별 분류
- 가장 많이 실패하는 워크플로우
- 노드별 오류 빈도

**시스템 메트릭**:
- CPU 및 메모리 사용량
- 큐 길이
- 응답 시간

### 알림 설정 예시

**Elasticsearch + Kibana**:
1. 특정 조건의 쿼리 생성
2. Watcher로 알림 규칙 설정
3. 이메일/Slack/PagerDuty 통지

**Datadog**:
1. 로그 기반 모니터 생성
2. 임계값 설정 (예: 실패율 > 5%)
3. 알림 채널 구성

**Splunk**:
1. 검색 쿼리 저장
2. Alert 생성
3. 알림 액션 설정

## 보안 및 규정 준수

### 데이터 보호

**전송 중 암호화**:
- TLS/SSL 필수
- 인증서 검증
- 안전한 프로토콜 사용

**저장 시 암호화**:
- 로그 수집 시스템의 암호화 기능 활용
- 장기 보관 시 암호화 스토리지 사용

**민감 데이터 처리**:
- 자동 마스킹 또는 제외
- PII(개인 식별 정보) 필터링
- Credential 정보 절대 로깅 안 함

### 접근 제어

**로그 접근 권한**:
- 역할 기반 접근 제어
- 최소 권한 원칙
- 감사 로그 활성화

**보관 정책**:
- 법적 요구사항 준수
- 정기적인 로그 아카이빙
- 만료된 로그 자동 삭제

### 규정 준수

**GDPR**:
- 개인 데이터 최소화
- 데이터 보관 기간 제한
- 데이터 삭제 요청 처리

**SOC 2**:
- 로그 무결성 보장
- 변조 방지
- 감사 추적

**HIPAA (의료 분야)**:
- 민감 의료 정보 제외
- 암호화 및 접근 제어
- 감사 로그 유지

## 문제 해결

### 로그가 전송되지 않음

**원인**:
- 네트워크 연결 문제
- 잘못된 설정
- 대상 시스템 장애
- 방화벽 차단

**해결책**:
1. n8n 로그에서 오류 확인
2. 네트워크 연결 테스트
3. 환경 변수 재확인
4. 대상 시스템 상태 점검

### 로그 누락

**원인**:
- 버퍼 오버플로우
- Rate Limiting
- 필터링 설정

**해결책**:
1. 버퍼 크기 증가
2. 배치 전송 최적화
3. 필터 설정 검토

### 성능 저하

**원인**:
- 과도한 로그 생성
- 동기식 전송
- 네트워크 지연

**해결책**:
1. 로그 레벨 조정
2. 비동기 전송 활성화
3. 로컬 버퍼링
4. 배치 크기 최적화

## 최적화 팁

### 성능 최적화

**배치 전송**:
```bash
N8N_LOG_STREAMING_BATCH_SIZE=100
N8N_LOG_STREAMING_BATCH_INTERVAL=5000  # 5초
```

**비동기 처리**:
```bash
N8N_LOG_STREAMING_ASYNC=true
N8N_LOG_STREAMING_QUEUE_SIZE=10000
```

### 비용 최적화

**로그 샘플링**:
```bash
# 10%만 샘플링
N8N_LOG_STREAMING_SAMPLE_RATE=0.1
```

**선택적 로깅**:
- 중요 워크플로우만 로깅
- 개발 환경에서 로깅 비활성화
- 장기 보관 정책 최적화

## 실전 예시

### Elasticsearch 통합

**1. Elasticsearch 설정**:
```bash
# Docker로 Elasticsearch 실행
docker run -d \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  elasticsearch:8.0.0
```

**2. n8n 환경 변수**:
```bash
N8N_LOG_STREAMING_ENABLED=true
N8N_LOG_STREAMING_TYPE=elasticsearch
N8N_LOG_STREAMING_ES_URL=http://localhost:9200
N8N_LOG_STREAMING_ES_INDEX=n8n-logs
N8N_LOG_OUTPUT=json
```

**3. Kibana 대시보드**:
- Index Pattern 생성
- 시각화 구성
- 알림 설정

### Datadog 통합

**1. Datadog API Key 발급**:
Datadog 콘솔에서 API Key 생성

**2. n8n 설정**:
```bash
N8N_LOG_STREAMING_ENABLED=true
N8N_LOG_STREAMING_TYPE=datadog
N8N_LOG_STREAMING_DATADOG_API_KEY=your-api-key
N8N_LOG_STREAMING_DATADOG_SERVICE=n8n-production
```

**3. Datadog 모니터 생성**:
- 로그 기반 메트릭
- 이상 탐지
- 알림 설정

## 추가 리소스

### 문서
- 로그 수집 시스템별 가이드
- 보안 베스트 프랙티스
- 규정 준수 체크리스트

### 지원
- Enterprise 지원팀
- 통합 컨설팅
- 모니터링 설정 지원

### 도구
- 로그 분석 쿼리 예제
- 대시보드 템플릿
- 알림 규칙 샘플
