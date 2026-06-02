# Telemetry

Langflow는 익명 텔레메트리를 사용하여 기능 사용 및 성능에 대한 통계 수집.
Langflow 팀은 이 데이터를 사용하여 인기 기능 및 개선이 필요한 영역 식별.
실제 사용 패턴을 기반으로 개발 노력의 우선순위 결정에 활용.

## Privacy

Langflow 팀은 개인정보 보호를 존중하며 데이터 보호에 전념.

**수집하지 않는 정보:**
- 개인 정보
- 민감한 데이터

모든 텔레메트리 데이터는 익명화되며 Langflow 개선 목적으로만 사용.

## Opt out of telemetry

텔레메트리 비활성화:

```bash
DO_NOT_TRACK=True
```

Langflow 시작 전 [환경 변수](/environment-variables)에 설정.
이 설정으로 텔레메트리 데이터 수집 비활성화.

## Data that Langflow collects

Langflow 텔레메트리는 Flow 실행, 환경, 컴포넌트 사용에 대한 데이터 수집.

### Run

Flow 실행 시마다 전송되는 텔레메트리 이벤트.

| 필드 | 설명 |
|------|------|
| `IsWebhook` | 웹훅으로 트리거된 작업인지 여부 |
| `Seconds` | 작업 지속 시간 (초), 성능 인사이트 제공 |
| `Success` | 작업 성공 여부 (Boolean), 오류 식별에 활용 |
| `ErrorMessage` | 작업 실패 시 오류 메시지 상세, 문제 해결에 활용 |

### Shutdown

애플리케이션 라이프사이클 및 런타임 기간 정보 캡처.

| 필드 | 설명 |
|------|------|
| `TimeRunning` | 종료 전 총 런타임, 애플리케이션 라이프사이클 이해 및 가동 시간 최적화에 활용 |

### Version

텔레메트리 서비스 시작 시 한 번 전송.

| 필드 | 설명 |
|------|------|
| `Version` | 사용 중인 Langflow 버전, 기능 채택 및 호환성 추적 |
| `Platform` | 호스트 머신의 운영 체제, 개발 및 테스트 우선순위 결정 |
| `Python` | 사용 중인 Python 버전, 호환성 및 지원 유지 |
| `Arch` | 시스템 아키텍처 (x86, ARM 등), 하드웨어 최적화 및 테스트 우선순위 |
| `AutoLogin` | 자동 로그인 기능 활성화 여부, 사용자 환경 설정 반영 |
| `CacheType` | 사용 중인 캐싱 메커니즘 유형, 성능 및 효율성 영향 |
| `BackendOnly` | 백엔드 전용 모드 실행 여부, 배포 구성 이해 |
| `Desktop` | Langflow Desktop 모드 실행 여부, 배포 유형별 사용 패턴 이해 |

### Email

Langflow Desktop의 등록된 이메일 주소 추적.

**전송 시점:**
- POST `/api/v2/registration/` 엔드포인트를 통해 새 이메일 주소 등록 시
- 이메일 주소 등록 후 Langflow Desktop 시작 시마다

| 필드 | 설명 |
|------|------|
| `Email` | 등록된 이메일 주소, 사용자 등록 추적 및 사용자 기반 이해 |
| `ClientType` | 클라이언트 유형 ("desktop" 또는 "oss") |

> **Note**: `DO_NOT_TRACK` 환경 변수로 텔레메트리 비활성화 시에도
> 이메일 주소 입력 프롬프트는 표시되나, 로컬 Langflow 데이터베이스에만 저장.

### Playground

Playground 환경의 성능 및 사용 패턴 모니터링.

| 필드 | 설명 |
|------|------|
| `Seconds` | Playground 실행 시간 (초), 테스트/실험 단계 성능 인사이트 |
| `ComponentCount` | Playground에서 사용된 컴포넌트 수, 복잡성 및 사용 패턴 이해 |
| `Success` | Playground 작업 성공 상태, 실험적 기능의 안정성 식별 |

### Component

각 컴포넌트 실행 시 전송.

| 필드 | 설명 |
|------|------|
| `Name` | 컴포넌트 식별, 가장 많이 사용되거나 문제가 있는 컴포넌트 데이터 |
| `Seconds` | 컴포넌트 실행 시간, 성능 메트릭 |
| `Success` | 컴포넌트 성공 작동 여부, 품질 관리 |
| `ErrorMessage` | 발생한 오류 상세, 디버깅 및 개선에 필수 |

### Exception

Langflow의 라이프사이클 또는 전역 예외 핸들러에서 처리되지 않은 예외 캡처 시 전송.

| 필드 | 설명 |
|------|------|
| `Type` | 예외 클래스 이름 (예: `ValueError`) |
| `Message` | 발생한 예외 메시지 |
| `Context` | 예외 발생 위치 관련 추가 컨텍스트 (라우트, 컴포넌트, 작업 상세 등) |
| `StackTraceHash` | 스택 트레이스 해시, 유사한 예외를 쉽게 분석하기 위한 그룹화에 사용 |
