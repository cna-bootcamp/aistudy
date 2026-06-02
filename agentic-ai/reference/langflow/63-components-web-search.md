# Web Search

**Web Search**, **News Search**, **RSS Reader** 컴포넌트를 하나로 통합.
DuckDuckGo로 웹 검색, Google News 검색, RSS 피드 읽기를 하나의 컴포넌트에서 수행.

참조: 다른 검색 API는 [Bundles](/components-bundle-components) 참조

> **Info**: **Web Search** 컴포넌트는 속도 제한이 적용될 수 있는 웹 스크래핑 사용.
> 프로덕션 사용 시 더 견고한 API 지원이 있는 다른 검색 컴포넌트 (제공자별 번들 등) 고려 권장.

## Flow에서 사용

1. **Basic Prompting** 템플릿 기반 Flow 생성

2. **Web Search** 컴포넌트 추가
   - **Search Mode** 선택 (Web, News, RSS)
   - 검색 쿼리 또는 RSS 피드 URL 입력

3. **Type Convert** 컴포넌트 추가
   - **Output Type**을 **Message**로 설정
   - Web Search 출력 → Type Convert 입력 연결
   - 기본적으로 Web Search는 `DataFrame` 출력, Prompt Template은 `Message`만 수신하므로 변환 필요

4. **Prompt Template** 컴포넌트의 **Template** 필드에 변수 추가
   - 예: `{searchresults}` 또는 `{context}`
   - 변환된 검색 결과를 프롬프트에 전달하는 필드 추가됨
   - 참조: [Define variables in prompts](/components-prompts#define-variables-in-prompts)

5. **Type Convert** 출력 → **Prompt Template**의 새 변수 필드 연결

6. **Language Model** 컴포넌트에 API 키 추가 (또는 다른 제공자/모델 선택)

7. **Playground**에서 쿼리 입력하여 테스트

## 파라미터

### Web Search 모드

| Name | Display Name | 설명 |
|------|--------------|------|
| `search_mode` | Search Mode | 검색 모드 선택: Web (DuckDuckGo), News (Google News), RSS (Feed Reader). 기본값: `Web` |
| `query` | Search Query | 검색할 키워드 |
| `timeout` | Timeout | 웹 검색 요청 타임아웃 (초). 기본값: `5` |
| `results` | Results | (출력) `title`, `link`, `snippet`, `content`가 포함된 `DataFrame` 반환 |

### News Search 모드
Google News에서 뉴스 검색.

### RSS Reader 모드
RSS 피드 URL에서 콘텐츠 읽기.

## Web Search 출력

검색 모드에 따라 다른 열이 포함된 `DataFrame` 출력.

### Web 검색 모드 출력

| 열 | 설명 |
|----|------|
| `title` | 검색 결과 제목 |
| `link` | 검색 결과 URL |
| `snippet` | 검색 결과의 간단한 스니펫 |
| `content` | 페이지의 전체 콘텐츠 (성공적으로 가져온 경우) |

### News 검색 모드 출력
뉴스 기사 관련 정보 포함.

### RSS Reader 모드 출력
RSS 피드 항목 정보 포함.

