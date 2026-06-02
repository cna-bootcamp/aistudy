# Data Pinning

## 개요

Data Pinning은 n8n에서 특정 node의 실행 결과를 고정하여 재사용하는 기능임.
Workflow 개발 및 테스트 시 반복적인 외부 API 호출을 줄이고 개발 속도를 향상시킴.

## Data Pinning의 목적

### 개발 효율성 향상

- API 호출 제한(rate limit) 회피
- 네트워크 지연 없이 빠른 테스트
- 일관된 테스트 데이터로 재현 가능한 결과

### 비용 절감

- 유료 API 호출 횟수 감소
- 외부 서비스 의존성 최소화
- 개발 단계에서 실제 데이터 사용 제한

## Pinning 방법

### Manual Pinning

1. Node 실행 후 output data 확인
2. Output panel 상단의 Pin 아이콘 클릭
3. 데이터가 고정되어 재실행 시에도 동일한 결과 반환

### 고정 데이터 편집

- Pin된 데이터를 직접 JSON 편집기에서 수정 가능
- 다양한 시나리오 테스트를 위한 데이터 변형
- UI에서 직접 값 변경

## Pinning 동작 원리

### 실행 우선순위

```
Pin된 데이터 존재 → Pin 데이터 사용
Pin 없음 → Node 실제 실행
```

### Workflow 전달

- Pin된 데이터는 다음 node로 정상 전달됨
- 전체 workflow의 일부만 pin 가능
- 조합하여 복잡한 시나리오 구성

## 활용 시나리오

### API 개발 테스트

```
HTTP Request (Pin) → Code → Set → 결과 확인
```

- HTTP Request node에 실제 API 응답 pin
- Code, Set node는 반복 테스트하며 로직 개선
- API 재호출 없이 데이터 변환 로직 최적화

### 조건부 로직 검증

```json
// Pin된 테스트 데이터
[
  { "status": "success", "amount": 100 },
  { "status": "error", "amount": 0 },
  { "status": "pending", "amount": 50 }
]
```

- 다양한 상태값으로 IF node 분기 테스트
- Edge case 시뮬레이션

### 긴 Workflow의 중간 지점 테스트

- 앞단 node들은 pin하여 고정
- 뒷단 node만 반복 수정 및 테스트
- 전체 workflow 재실행 시간 단축

## Pinning Best Practice

### 언제 사용하는가

| 상황 | Pinning 권장 |
|------|--------------|
| 외부 API 호출 | ✅ |
| 데이터베이스 쿼리 | ✅ |
| 파일 읽기/쓰기 | ✅ |
| 간단한 데이터 변환 | ❌ (직접 실행) |
| Pure function | ❌ |

### 주의사항

1. **Production 배포 전 Unpin**: Pin된 채로 배포하면 실제 데이터가 처리되지 않음
2. **Pin 상태 시각적 확인**: Pin 아이콘이 활성화되었는지 항상 체크
3. **민감 데이터 주의**: Pin된 데이터는 workflow 파일에 포함되어 저장됨

### 해제 방법

- Pin 아이콘 다시 클릭하여 unpin
- 전체 workflow의 모든 pin 한 번에 해제 가능 (UI 옵션)

## 실전 예제

### Webhook 테스트 시나리오

```
1. Webhook node 실행 → 실제 요청 받음 → Pin
2. 이후 테스트는 pin된 데이터로 반복
3. Webhook 재호출 없이 downstream 로직 개발
```

### 데이터베이스 쿼리 결과 재사용

```
1. PostgreSQL node 실행 → 대량 데이터 조회 → Pin
2. Code node에서 데이터 변환 로직 개발
3. 쿼리 재실행 없이 변환 로직만 반복 테스트
```

## 고급 활용

### 버전 관리

- Pin된 데이터를 JSON으로 export하여 버전 관리
- 팀원 간 동일한 테스트 데이터 공유
- Git에 포함하여 regression test 자동화

### 다중 시나리오 테스트

- 같은 workflow를 복제하여 각기 다른 데이터 pin
- 정상, 오류, 경계값 등 다양한 케이스 동시 검증

## 참고사항

- Pin된 데이터는 workflow JSON 파일 내 `pinData` 필드에 저장
- Cloud 버전과 Self-hosted 버전 모두 지원
- CLI로 workflow export 시 pin 데이터도 함께 포함됨
