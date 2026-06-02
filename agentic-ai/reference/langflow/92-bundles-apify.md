# Apify

[Apify](https://apify.com/)는 3,000개 이상의 **Actors**라는 클라우드 도구를 제공하는 웹 스크래핑 및 데이터 추출 플랫폼.

## Apify Actors 컴포넌트

Flow에서 **Apify Actors** 컴포넌트를 사용하여 데이터 추출, 콘텐츠 분석, SQL 작업 등의 태스크 수행.

### Flow에서 사용 방법

1. **Apify Actors** 컴포넌트를 Flow에 추가하고 설정:
   - **Apify Token**: [Apify API 토큰](https://docs.apify.com/platform/integrations/api) 입력
   - **Actor**: [Apify Actor Store](https://apify.com/store)에서 실행할 Actor ID 입력
     - 예: [Website Content Crawler](https://apify.com/apify/website-content-crawler)의 Actor ID는 `apify/website-content-crawler`
   - **Run Input**: [Actor 실행 구성을 위한 JSON 입력](https://docs.apify.com/platform/actors/running-actors#input) 입력
   - 선택한 Actor와 사용 사례에 따라 추가 파라미터 및 명령 설정

2. Flow의 다른 컴포넌트와 연결:
   - Flow의 독립 실행 단계로 사용 가능
   - 에이전트의 도구로 사용 가능

### Tool Mode 활성화

1. 컴포넌트 출력 타입을 **Output**에서 **Tool**로 변경
2. **Agent** 컴포넌트의 **Tools** 포트에 연결

### 출력

**Apify Actors** 컴포넌트는 Actor 실행 결과를 Langflow의 [Data](/data-types#data) 타입의 JSON 객체로 출력.

## 예시 Flow

### 웹사이트 텍스트 콘텐츠를 Markdown으로 추출

1. [Website Content Crawler Actor](https://apify.com/apify/website-content-crawler)로 웹사이트에서 Markdown 형식의 텍스트 콘텐츠 추출
2. **Output**을 **Parser** 컴포넌트의 입력에 연결하여 추가 처리

### 에이전트로 웹 콘텐츠 처리

1. [Website Content Crawler Actor](https://apify.com/apify/website-content-crawler)를 **Agent** 컴포넌트에 도구로 연결
2. 에이전트가 채팅 입력에 따라 웹사이트 콘텐츠 추출 여부 결정
3. 추출된 데이터를 요약, 인사이트 또는 구조화된 응답으로 변환

### 여러 Actor로 소셜 미디어 프로필 분석

여러 Apify Actor로 종합적인 소셜 미디어 조사 수행:

1. [Google Search Results Scraper Actor](https://apify.com/apify/google-search-scraper)로 관련 소셜 미디어 프로필 찾기
2. [TikTok Data Extractor Actor](https://apify.com/clockworks/free-tiktok-scraper)로 데이터 및 동영상 수집
3. 두 Actor를 **Agent** 컴포넌트의 도구로 연결
4. Google에서 링크를, TikTok에서 콘텐츠를 수집하고 데이터를 분석하여 인물, 브랜드 또는 주제에 대한 인사이트 제공

