# Directory

디렉토리에서 파일을 재귀적으로 로드. 파일 타입, 깊이, 동시성 옵션 제공.

파일은 [지원되는 타입 및 크기](/read-file#file-type-and-size-limits)여야 로드 가능.

**출력:** 디렉토리 내용에 따라 `Data` 또는 `DataFrame` 객체.

## Directory 파라미터

| Name | Type | 설명 |
|------|------|------|
| `path` | MessageTextInput | 파일을 로드할 디렉토리 경로. 기본값: 현재 디렉토리 (`.`) |
| `types` | MessageTextInput | 로드할 파일 타입. 하나 이상 선택하거나 비워두면 모든 파일 로드 시도 |
| `depth` | IntInput | 파일 검색 깊이 |
| `max_concurrency` | IntInput | 여러 파일 로드 시 최대 동시성 |
| `load_hidden` | BoolInput | `true`이면 숨김 파일 로드 |
| `recursive` | BoolInput | `true`이면 재귀적으로 검색 |
| `silent_errors` | BoolInput | `true`이면 오류 시 예외 발생 안 함 |
| `use_multithreading` | BoolInput | `true`이면 멀티스레딩 사용 |

