# Logs

Langflow는 개별 Flow와 애플리케이션 자체에 대한 로그를 [structlog](https://www.structlog.org) 라이브러리로 생성.

**기본 로그 파일:** `langflow.log`
**로그 형식:** 구조화된 메타데이터와 함께 JSON 형식으로 저장

## Log storage

로그는 `LANGFLOW_CONFIG_DIR` 환경 변수에 지정된 설정 디렉토리에 저장.

### 기본 설정 디렉토리 위치

**Langflow Desktop:**

| OS | 경로 |
|----|------|
| macOS | `/Users/<username>/Library/Logs/com.LangflowDesktop` |
| Windows | `C:\Users\<username>\AppData\Local\com.LangflowDesktop\logs` |

**OSS Langflow:**

| 환경 | 경로 |
|------|------|
| macOS (`uv pip install`) | `/Users/<username>/Library/Caches/langflow` |
| Linux (`uv pip install`) | `/home/<username>/.cache/langflow` |
| Windows/WSL (`uv pip install`) | `C:\Users\<username>\AppData\Local\langflow\langflow\Cache` |
| macOS/Windows/Linux/WSL (`git clone`) | `<path_to_clone>/src/backend/base/langflow/` |

### 로그 관련 환경 변수

| 변수 | 형식 | 기본값 | 설명 |
|------|------|--------|------|
| `LANGFLOW_CONFIG_DIR` | String | 설치별 상이 | 파일 및 로그 저장 설정 디렉토리 |
| `LANGFLOW_LOG_LEVEL` | String | `ERROR` | 로그 레벨 (DEBUG, ERROR, INFO, WARNING, CRITICAL) |
| `LANGFLOW_LOG_FILE` | String | 미설정 | 비기본 위치 로그 파일 경로. 미설정 시 stdout으로 출력 |
| `LANGFLOW_LOG_ENV` | String | `default` | 로그 형식 제어. `container`: JSON, `container_csv`: Key-Value, `default`: PRETTY_LOGS 참조 |
| `LANGFLOW_PRETTY_LOGS` | Boolean | `True` | `LOG_ENV=default` 시 형식 제어. `true`: ConsoleRenderer, `false`: JSON |
| `LANGFLOW_LOG_FORMAT` | String | 미설정 | `key_value` 또는 `console`. `LOG_ENV=default`이고 `PRETTY_LOGS=true`일 때만 동작 |
| `LANGFLOW_LOG_ROTATION` | String | `1 day` | 로그 파일 로테이션. 시간: `1 day`, `12 hours`, `1 week`. 크기: `10 MB`, `1 GB`. 비활성화: `None` |
| `LANGFLOW_ENABLE_LOG_RETRIEVAL` | Boolean | `False` | Logs 엔드포인트로 로그 검색 활성화 |
| `LANGFLOW_LOG_RETRIEVER_BUFFER_SIZE` | Integer | `10000` | 로그 검색 버퍼 크기 (0보다 커야 함) |

## View logs in real-time

실시간 로그 모니터링:

**macOS:**
```bash
cd /Users/<USERNAME>/Library/Caches/langflow
tail -f langflow.log
```

**Windows:**
```cmd
cd C:\Users\<USERNAME>\AppData\Local\langflow\langflow\Cache
Get-Content langflow.log -Wait
```

새 로그 항목이 보이지 않으면:
- Langflow 실행 중인지 확인
- 로그 이벤트를 생성하는 작업 수행
- Langflow 시작한 터미널에서 로그 출력 확인

## Flow and component logs

Flow 실행 후 각 컴포넌트와 Flow 실행에 대한 로그 검사 가능.
예: Input/Output 컴포넌트에서 수집 및 생성된 `Message` 객체 검사

### View flow logs

비주얼 에디터에서 **Logs** 클릭하여 전체 Flow 로그 확인.

**inputs** 및 **outputs** 열의 셀 클릭하여 `Message` 객체 검사.

**Chat Input 컴포넌트 출력 예시:**

```json
"messages": [
  {
    "message": "What's the recommended way to install Docker on Mac M1?",
    "sender": "User",
    "sender_name": "User",
    "session_id": "Session Apr 21, 17:37:04",
    "stream_url": null,
    "component_id": "ChatInput-4WKag",
    "files": [],
    "type": "text"
  }
]
```

> **Note**: Input/Output 컴포넌트의 경우 원본 입력이 `Message` 객체 형식이 아닐 수 있음.
> 예: LLM 컴포넌트가 원시 텍스트 응답을 Chat Output 컴포넌트에 전달 → `Message` 객체로 변환

Flow의 `.log` 파일은 Langflow 설치의 로그 저장 위치에서 확인 가능.

### View chat logs

**Playground**에서 각 채팅 세션의 채팅 히스토리 검사 가능.

자세한 정보: [View chat history](/concepts-playground#view-chat-history)

### View output from a single component

Flow 출력의 형식이나 내용 문제 디버깅 시 각 컴포넌트의 출력 검사 유용.

비주얼 에디터에서 컴포넌트의 **Inspect output** 클릭하여 최근 실행의 출력 확인.

## Access Langflow Desktop logs

Langflow Desktop 문제 발생 시 시작 로그 접근 필요.

**macOS:**
```bash
cd ~/Library/Logs/com.LangflowDesktop
open .
```

**Windows:**
```cmd
cd C:\Users\<USERNAME>\AppData\Local\com.LangflowDesktop\logs
explorer .
```

`langflow.log` 파일 확인.

**로그 파일 활용:**
- 문제 자체 조사
- GitHub Issue에 컨텍스트 추가
- 지원팀에 디버깅 지원 요청

> **Note**: 로그 파일은 Langflow Desktop 실행 시에만 생성.
> 로그 파일이 없으면 먼저 Langflow Desktop 시작 후 확인.

## See also

- [Logs endpoints](/api-logs)
- [Memory management options](/memory)
- [Configure an external PostgreSQL database](/configuration-custom-database)
