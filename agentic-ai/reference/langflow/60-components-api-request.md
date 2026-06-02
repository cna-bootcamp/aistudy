# API Request

URL 또는 curl 명령을 사용하여 HTTP 요청 구성 및 전송.

**모드:**
- **URL mode**: 쉼표로 구분된 하나 이상의 URL 입력, 각 URL에 대한 요청 메서드 선택
- **curl mode**: 실행할 curl 명령 입력

컴포넌트 파라미터에서 추가 요청 옵션 및 필드 활성화 가능.

**출력:** 응답이 포함된 `Data` 객체

참조: 제공자별 API 컴포넌트는 [Bundles](/components-bundle-components) 참조

## API Request 파라미터

| Name | Display Name | 설명 |
|------|--------------|------|
| `mode` | Mode | **URL** 또는 **curl** 모드 설정 |
| `urls` | URL | 요청에 사용할 쉼표로 구분된 하나 이상의 URL |
| `curl` | curl | **curl 모드** 전용. 완전한 curl 명령 입력. 명령 인수에서 다른 컴포넌트 파라미터 채움 |
| `method` | Method | 사용할 HTTP 메서드 |
| `query_params` | Query Parameters | URL에 추가할 쿼리 파라미터 |
| `body` | Body | POST, PATCH, PUT 요청과 함께 보낼 본문 (딕셔너리) |
| `headers` | Headers | 요청과 함께 보낼 헤더 (딕셔너리) |
| `timeout` | Timeout | 요청에 사용할 타임아웃 |
| `follow_redirects` | Follow Redirects | HTTP 리다이렉트 따를지 여부. Langflow 1.7부터 기본값 `false` (SSRF 우회 공격 방지). 신뢰할 수 있는 서버만 활성화 권장. 참조: [SSRF protection environment variables](/api-keys-and-authentication#ssrf-protection) |
| `save_to_file` | Save to File | API 응답을 임시 파일에 저장할지 여부. 기본값: 비활성화 (`false`) |
| `include_httpx_metadata` | Include HTTPx Metadata | `headers`, `status_code`, `response_headers`, `redirection_history` 등의 속성을 출력에 포함할지 여부. 기본값: 비활성화 (`false`) |

