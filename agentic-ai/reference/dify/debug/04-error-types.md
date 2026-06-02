# 오류 유형 (Error Types)

## 개요

Dify 워크플로우에서 발생할 수 있는 오류는 노드 유형별 및 시스템 레벨로 분류됨.

## 노드별 오류

### Code Node 오류

**CodeNodeError**
- Python 또는 JavaScript 코드가 실행 중 예외를 발생시킴
- 코드 로직 오류 또는 예외 처리 누락으로 인해 발생

**OutputValidationError**
- 반환된 값과 구성된 출력 변수 간의 데이터 타입 불일치
- 예시: 문자열을 반환해야 하는데 숫자를 반환한 경우

**DepthLimitError**
- 중첩된 데이터 구조가 5단계를 초과함
- 과도하게 깊은 객체 또는 배열 구조 사용 시 발생

**CodeExecutionError**
- 샌드박스 서비스가 코드를 실행할 수 없음
- 샌드박스 환경 문제 또는 리소스 부족으로 인해 발생

### LLM Node 오류

**VariableNotFoundError**
- 프롬프트 템플릿이 워크플로우 컨텍스트에 존재하지 않는 변수를 참조함
- 변수명 오타 또는 삭제된 변수 참조

**InvalidContextStructureError**
- 컨텍스트 필드에 배열 또는 객체가 전달됨 (문자열만 허용됨)
- 데이터 타입 변환 필요

**NoPromptFoundError**
- 프롬프트 필드가 비어 있음
- 프롬프트 작성 필수

**ModelNotExistError**
- 구성에서 모델이 선택되지 않음
- LLM 모델 선택 필요

**LLMModeRequiredError**
- 선택된 모델에 유효한 API 자격 증명이 없음
- API 키 설정 또는 모델 권한 확인 필요

**InvalidVariableTypeError**
- 프롬프트 템플릿에 비호환 Jinja2 구문이 포함됨
- Jinja2 문법 오류 수정 필요

### HTTP Request Node 오류

**AuthorizationConfigError**
- 인증 설정이 누락되거나 유효하지 않음
- API 키, 토큰 등 인증 정보 확인 필요

**InvalidHttpMethodError**
- 지원되지 않는 HTTP 메서드 사용
- GET, POST, PUT, DELETE 등 유효한 메서드 사용 필요

**ResponseSizeError**
- API 응답이 10MB 제한을 초과함
- 응답 데이터 크기 최적화 또는 페이징 처리 필요

**FileFetchError**
- 참조된 파일 변수를 검색할 수 없음
- 파일 경로 또는 권한 확인 필요

**InvalidURLError**
- 잘못된 형식이거나 연결할 수 없는 URL
- URL 형식 및 네트워크 연결 확인 필요

### Tool Node 오류

**ToolParameterError**
- 파라미터가 도구 스키마와 일치하지 않음
- 필수 파라미터 누락 또는 타입 불일치

**ToolFileError**
- 파일 접근 실패
- 파일 경로, 권한, 존재 여부 확인 필요

**ToolInvokeError**
- 외부 도구 API 오류
- 외부 서비스 상태 및 연결 확인 필요

**ToolProviderNotFoundError**
- 도구 프로바이더가 누락되거나 잘못 구성됨
- 도구 프로바이더 설정 확인 필요

## 시스템 레벨 오류

**InvokeConnectionError**
- 네트워크 연결 문제
- 네트워크 상태 및 방화벽 설정 확인 필요

**InvokeServerUnavailableError**
- 서비스 사용 불가 (503 상태)
- 서버 상태 확인 및 재시도 필요

**InvokeRateLimitError**
- API 호출 속도 제한 위반
- 요청 빈도 조정 또는 대기 후 재시도 필요

**QuotaExceededError**
- 사용 할당량 소진
- 플랜 업그레이드 또는 할당량 재설정 대기 필요
