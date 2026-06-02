# YouTube 자막 RAG (YouTube Data API + Multi-Query)

YouTube Data API v3로 최신 영상을 조건에 맞춰 검색하고, 자막을 추출해 ChromaDB에 인덱싱한 뒤  
Groq LPU LLM으로 영상 내용에 답하는 RAG 챗봇 예제임.

- **검색**: YouTube Data API v3 + Multi-Query (토픽별 4개 관점 검색, 24시간 TTL 캐시)  
- **자막 캐시**: 영상별 자막 스니펫 24시간 TTL 캐시로 반복 인덱싱 시 프록시 요청 절감  
- **조건**: 최근 3개월 · 길이 5분↑ · 조회수 1000회↑  
- **토픽**: Claude Code · Antigravity · Codex (각 10개 영상 선정)  
- **특징**: 타임스탬프 청킹(120초)으로 "몇 분부터 보면 되나요?" 질문에 시점 URL 제공  

> `agentic-ai/examples/rag/youtube-rag`(YouTubeSearchTool 스크래핑·indexing/chatbot 분리)를  
> **Data API 검색 + Multi-Query + 단일 app.py + Groq LLM**으로 확장한 예제임.

---

## 1. 동작 개요

```
┌───────────────────────────────────────────────────────────────────┐
│ [1단계] 검색 (YouTube Data API v3 + Multi-Query)                   │
│  토픽 × 관점(특징·활용·스킬·플러그인) → search.list (최근 3개월)    │
│  → videos.list로 길이·조회수 조회 → 5분↑·1000회↑ 필터 → 토픽당 10개 │
│  → .cache/youtube_search_results.json 에 24시간 캐시 저장/재사용    │
└───────────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│ [2단계] 자막 추출 (youtube-transcript-api 직접 호출, 프록시·백오프) │
│  120초 단위 청킹 → 청크별 타임스탬프 URL·메타데이터(제목·조회수) 부여 │
│  → .cache/youtube_transcript_results.json 에 24시간 캐시 저장/재사용│
│  자막 없음/IP 차단 영상은 건너뜀(에러 핸들링)                       │
└───────────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│ [3단계] 인덱싱 (OpenAI 임베딩 → ChromaDB)                          │
│  DB 없으면 [최초 인덱싱], 있으면 [추가 인덱싱] 자동 감지            │
└───────────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│ [질의] chat / ask (MMR 검색 → Groq gpt-oss-120b 답변)             │
│  답변에 영상 제목 + 타임스탬프 바로가기 URL 포함                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. 소스 코드 설명

파일: `app.py` (검색 · 인덱싱 · 질의를 한 파일에 통합, 서브커맨드로 분기)

### 2.1 주요 함수

| 함수 | 역할 |
|------|------|
| `build_youtube_client()` | `YOUTUBE_API_KEY`로 YouTube Data API v3 클라이언트 생성 |
| `parse_duration_seconds()` | ISO 8601 길이(`PT15M33S`)를 초로 변환 (5분 필터용) |
| `search_topic_videos()` | 한 토픽을 Multi-Query 검색 → 필터 → 조회수순 상위 10개 선정 |
| `load_search_cache()` / `save_search_cache()` | YouTube 검색 결과 24시간 TTL 캐시 로드/저장 |
| `search_all_topics()` | 3개 토픽 검색 + 토픽 간 중복 제거 + **선정 게이트 로그** + 캐시 재사용 |
| `build_transcript_client()` | youtube-transcript-api 클라이언트 생성 (환경변수로 **프록시** 자동 적용) |
| `load_transcript_cache()` / `save_transcript_cache()` | 영상별 자막 스니펫 24시간 TTL 캐시 로드/저장 |
| `_chunk_transcript()` | raw 자막 스니펫을 120초 단위 Document로 묶음 (YoutubeLoader CHUNKS와 동일 로직) |
| `_fetch_transcript_pieces()` | 자막 조회 + **차단 시 지수 백오프 재시도** (영구 오류는 전파) |
| `load_transcripts()` | 영상별 자막 120초 청킹 + 타임스탬프·메타데이터 주입 (자막 없음/차단 시 스킵) |
| `get_embeddings()` | OpenAI `text-embedding-3-small` 임베딩 생성 (인덱싱·질의 공용) |
| `create_or_update_vectorstore()` | ChromaDB 최초 생성 / 추가 인덱싱 **자동 감지** |
| `run_indexing()` | 검색 → 자막 → 인덱싱 파이프라인 (`--reset` 지원) |
| `load_vectorstore()` | 인덱싱된 컬렉션 로드 (질의용) |
| `create_retriever()` | MMR 검색기 생성 (다양성 + 관련성) |
| `create_llm()` | Groq `openai/gpt-oss-120b` 채팅 모델 생성 |
| `build_rag_chain()` | 프롬프트 → LLM → 파서 LCEL 체인 구성 |
| `answer_question()` | 검색 → 컨텍스트 포맷 → LLM 답변 생성 |
| `run_chat()` / `run_ask()` | 대화형 / 단발성 질의 실행 |

### 2.2 처리 흐름

1. **검색** (`search_all_topics` → `search_topic_videos`)
   - `.cache/youtube_search_results.json`에 24시간 이내 검색 결과가 있으면 YouTube Data API 호출 없이 재사용
   - `--refresh-search-cache` 옵션 사용 시 기존 검색 캐시를 무시하고 새로 검색 후 캐시 갱신
   - 토픽마다 `특징`·`활용 방법`·`스킬 개발`·`플러그인 개발` 4개 관점을 결합해 검색어 생성 (Multi-Query)
   - `search.list`(part=`id`)로 최근 3개월 영상 ID 수집 → 중복 제거
   - `videos.list`(part=`contentDetails,statistics,snippet`)로 길이·조회수·제목 조회
   - 길이 ≥ 5분 & 조회수 ≥ 1000회 필터 → 조회수 내림차순 상위 10개 선정
2. **자막 추출** (`load_transcripts`)
   - `.cache/youtube_transcript_results.json`에 24시간 이내 자막이 있으면 프록시 요청 없이 재사용
   - `--refresh-transcript-cache` 옵션 사용 시 기존 자막 캐시를 무시하고 새로 추출 후 캐시 갱신
   - `youtube-transcript-api`를 **직접 호출**(프록시·백오프 지원)해 자막만 받고, 제목·채널·조회수는 Data API 결과에서 주입
   - IP 차단 시 지수 백오프 재시도(3→6→12→24초), 끝까지 차단되면 해당 영상 스킵 + 프록시 권장 안내
   - 120초 청크마다 `timestamp_url`(`&t=초`)·`timestamp_display`(분:초) 메타데이터 부여
3. **인덱싱** (`create_or_update_vectorstore`)
   - `chroma_db/` 존재 여부로 최초/추가 인덱싱 자동 분기
4. **질의** (`run_chat` / `run_ask`)
   - MMR로 상위 10개 청크 회수 → Groq LLM이 컨텍스트 기반 답변 + 타임스탬프 URL 제시

---

## 3. YouTube 도구 사용법

### 3.1 YouTube Data API v3 (검색)

공식 API로 **날짜 필터·정렬·상세 메타데이터(길이·조회수)** 를 제공함. `YOUTUBE_API_KEY` 필요.

```python
from googleapiclient.discovery import build
from datetime import datetime, timedelta, timezone

youtube = build("youtube", "v3", developerKey=API_KEY)

# 최근 90일(약 3개월) 필터 — ISO 8601(RFC 3339) 형식
published_after = (datetime.now(timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%SZ")

# 1) 검색: 영상 ID만 수집 (호출당 100 units)
resp = youtube.search().list(
    q="Claude Code 특징", part="id", type="video",
    order="relevance", publishedAfter=published_after, maxResults=25,
).execute()
ids = [it["id"]["videoId"] for it in resp["items"]]

# 2) 상세 조회: 길이·조회수·제목 (search.list는 길이/조회수를 주지 않음)
det = youtube.videos().list(part="contentDetails,statistics,snippet", id=",".join(ids)).execute()
```

> **`search.list` vs `videos.list`**: `search.list`는 영상 ID·제목 정도만 반환하고 **길이·조회수는 주지 않음**.  
> 길이(5분↑)·조회수(1000회↑) 필터링을 하려면 `videos.list`로 `contentDetails`·`statistics`를 별도 조회해야 함.

> **할당량**: 무료 10,000 units/일. `search.list`=100 units, `videos.list`=1 unit.  
> 본 예제는 토픽 3 × 관점 4 = 12회 검색 = 1,200 units로 한도 내에서 동작함.

> **`relevanceLanguage` 미지정 이유**: Claude Code·Antigravity·Codex는 영어권 콘텐츠가 많아  
> `ko`로 제한하면 조건(최근 3개월·조회수)을 만족하는 영상이 부족해짐. 자막 언어만 `["ko","en"]`로 우선순위 지정함.

### 3.2 youtube-transcript-api (자막 추출)

자막은 `youtube-transcript-api`를 **직접 호출**해 추출함(웹 플레이어의 공개 `timedtext` 경로 사용, **API 키 불필요**).  
LangChain `YoutubeLoader`를 쓰지 않는 이유는 **프록시 설정 인자가 없어 IP 차단을 우회할 수 없기** 때문임.

```python
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.proxies import WebshareProxyConfig, GenericProxyConfig

# 프록시 없이 직결 (차단 시 백오프 재시도로 대응)
ytt = YouTubeTranscriptApi()

# IP 차단 우회: Webshare 레지덴셜 프록시 (권장) 또는 일반 HTTP(S) 프록시
ytt = YouTubeTranscriptApi(proxy_config=WebshareProxyConfig(proxy_username="...", proxy_password="..."))
# ytt = YouTubeTranscriptApi(proxy_config=GenericProxyConfig(http_url="http://...", https_url="https://..."))

fetched = ytt.fetch("VIDEO_ID", languages=["ko", "en"])  # ko 우선, 없으면 en
pieces = fetched.to_raw_data()   # [{"text": ..., "start": 0.0, "duration": 3.2}, ...]
```

> **YouTube Data API로는 자막을 못 가져옴**: Data API의 `captions.download`는 **OAuth 인증 + 본인 소유 영상**만  
> 다운로드 가능함. 제3자 공개 영상(이 예제가 인덱싱하는 강의 영상들)의 자막은 받을 수 없음(403).  
> 따라서 자막 추출은 `youtube-transcript-api`(공개 `timedtext` 경로)가 사실상 유일한 선택지임.

> **IP 차단(IpBlocked/RequestBlocked) 대응**: `youtube-transcript-api`는 키 없이 동작하는 대신, 짧은 시간에  
> 많은 영상을 연속 요청하면 YouTube가 IP를 일시 차단함. 본 예제는 두 단계로 대응함:  
> 1) **백오프 재시도**: 차단 시 3→6→12→24초 간격으로 최대 4회 재시도 (영상 사이 1초 간격도 둠)  
> 2) **프록시 우회**: 환경변수로 프록시를 지정하면 즉시 우회됨(아래 표). 데이터센터 IP는 다시 막힐 수 있어  
>    **레지덴셜 프록시(Webshare 등)** 권장. 끝까지 차단되면 해당 영상은 스킵하고 안내 메시지를 출력함.

> **자막 없는 영상 처리**: 요청 언어(`ko`/`en`) 자막이 없으면 `NoTranscriptFound`/`TranscriptsDisabled` 예외가  
> 발생함. 본 예제는 `try/except`로 해당 영상만 건너뛰고 다음 영상으로 진행함(에러 핸들링).

---

## 4. 가상환경 설정 및 실행

### 가상환경 설정 (Windows / PowerShell)
```powershell
cd hands-on/12.web-youtube-search/youtube-rag
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 가상환경 설정 (Windows / GitBash)
```bash
cd hands-on/12.web-youtube-search/youtube-rag
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### 가상환경 설정 (macOS / Linux)
```bash
cd hands-on/12.web-youtube-search/youtube-rag
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 환경변수 (`hands-on/.env`)

| 변수 | 용도 | 필요 여부 |
|------|------|----------|
| `YOUTUBE_API_KEY` | YouTube Data API v3 영상 검색 | 필수 |
| `OPENAI_API_KEY` | 자막 임베딩 (`text-embedding-3-small`) | 필수 |
| `GROQ_API_KEY` | LLM 답변 생성 (`openai/gpt-oss-120b`) | 필수 |
| `YT_WEBSHARE_USER` / `YT_WEBSHARE_PASS` | 자막 IP 차단 우회용 **Webshare 레지덴셜 프록시** (권장) | 선택 |
| `YT_WEBSHARE_LOCATIONS` | Webshare 프록시 국가 제한(예: `kr,jp,us`) | 선택 |
| `YT_WEBSHARE_RETRIES_WHEN_BLOCKED` | Webshare 내부 IP 차단 시 교체 재시도 횟수(기본 `10`) | 선택 |
| `YT_WEBSHARE_DOMAIN` / `YT_WEBSHARE_PORT` | Webshare 엔드포인트 오버라이드(기본 `p.webshare.io:80`) | 선택 |
| `YT_PROXY_HTTP` / `YT_PROXY_HTTPS` | 자막 IP 차단 우회용 **일반 HTTP(S) 프록시 URL** | 선택 |

> 프록시 변수는 **선택**임. 없으면 직결로 동작하되, IP가 차단되면 백오프 재시도 후에도 자막이 0개가 될 수 있음.  
> 이 경우 위 프록시 변수 중 하나를 채우면 즉시 우회됨(`YT_PROXY_*` 직접 URL → Webshare → 직결 순).

#### Webshare 권장 설정 예시

Webshare 사용 시 **Residential** 상품 준비 필요: https://dashboard.webshare.io
- Rotating Residential > Proxy List에서 상품 구매 
- 구매 후 Proxy List에서 Korea의 Proxy 중 아무거나 username, password 를 사용

`Proxy Server` 또는 `Static Residential`은 YouTube에서 다시  
차단될 가능성이 높아 권장하지 않음.

대시보드의 기본 username만 넣는 경우 코드가 국가 목록과 `-rotate`를 붙여 회전형 URL을 구성함.

```env
YT_WEBSHARE_USER=기본_Proxy_Username
YT_WEBSHARE_PASS=발급받은_Proxy_Password
YT_WEBSHARE_LOCATIONS=kr,jp,us
YT_WEBSHARE_RETRIES_WHEN_BLOCKED=10
```

Endpoint Generator 또는 curl 테스트에서 `username-kr-11`처럼 국가·세션이 이미 붙은 username을 받은 경우  
그 username을 그대로 넣고 `YT_WEBSHARE_LOCATIONS`는 비우는 방식 권장.

```env
YT_WEBSHARE_USER=username-kr-11
YT_WEBSHARE_PASS=발급받은_Proxy_Password
YT_WEBSHARE_RETRIES_WHEN_BLOCKED=10
```

#### 일반 프록시 설정 예시

회전형 HTTP(S) 프록시를 이미 보유했거나, curl로 검증한 Webshare 전체 URL을 그대로 쓰고 싶은 경우  
아래 형식 사용 가능. `YT_PROXY_*`는 `YT_WEBSHARE_*`보다 우선 적용됨.

```env
YT_PROXY_HTTP=http://user:pass@proxy-host:port
YT_PROXY_HTTPS=http://user:pass@proxy-host:port
YT_PROXY_RETRIES_WHEN_BLOCKED=10
```

#### 프록시 점검

프록시 설정 후 전체 인덱싱 전에 자막이 있는 영상 1건으로 연결 확인 가능.

```bash
python app.py check-proxy "https://www.youtube.com/watch?v=VIDEO_ID"
```

성공 시 `[OK] 자막 스니펫 ...개 수신` 출력. 실패 시 프록시 인증 정보, 상품 종류, 국가 제한, 영상 자막  
존재 여부 확인 필요.

### 실행

```bash
# 0) 프록시 점검: 전체 인덱싱 전에 자막 우회 연결만 확인
python app.py check-proxy "https://www.youtube.com/watch?v=VIDEO_ID"

# 1) 인덱싱: 검색 → 자막 추출 → 벡터 DB 저장 (서브커맨드 생략 시 기본 동작)
python app.py
python app.py index            # 위와 동일
python app.py index --reset    # 기존 벡터 DB 삭제 후 재생성
python app.py index --refresh-search-cache  # 24시간 검색 캐시를 무시하고 새로 검색
python app.py index --refresh-transcript-cache  # 24시간 자막 캐시를 무시하고 새로 추출

# 2) 대화형 RAG 챗봇
python app.py chat

# 3) 단발성 질문
python app.py ask "Claude Code로 플러그인 개발하는 방법은 몇 분부터 보면 되나요?"
```

### 실행 예시 (인덱싱)

```
======================================================================
[1단계] YouTube Data API 검색 + 조건 필터 (최근 90일·5분↑·1000회↑)
======================================================================
  [Claude Code] 검색어 4개 → 후보 58개 → 조건통과 53개 → 선정 10개
  [Antigravity] 검색어 4개 → 후보 89개 → 조건통과 47개 → 선정 10개
  [Codex] 검색어 4개 → 후보 64개 → 조건통과 46개 → 선정 10개

  [선정 요약]
    - Claude Code: 10/10개 (OK)
    - Antigravity: 10/10개 (OK)
    - Codex: 10/10개 (OK)
  전체 고유 영상(토픽 중복 제거 후): 29개

======================================================================
[2단계] 자막 추출 (youtube-transcript-api, 120초 청킹, 언어 ['ko', 'en'], 직결(프록시 없음))
======================================================================
  (1/29) [Claude Code] 클로드 초보자 가이드 2026 | 이 영상 하나로 끝내세요.
       [OK] 14개 청크
  ...
  (4/29) [Claude Code] Claude Cowork/Code保姆級完整教學 ...
       [실패] 건너뜀: NoTranscriptFound        # ko/en 자막 없는 영상 → 에러 핸들링으로 스킵
  ...
  자막 추출 완료: 성공 23개 / 건너뜀 6개 / 총 청크 315개

======================================================================
[3단계] 최초 인덱싱 (벡터 DB 신규 생성)
======================================================================
  생성 완료: 315개 청크 → ./chroma_db
```

> 검색·필터 단계에서 토픽별 **10/10**개를 확보함(완료 기준 충족). 자막이 없는 영상(중국어·스페인어 등
> `ko`/`en` 자막 부재)은 건너뛰므로 실제 인덱싱 영상 수는 선정 수보다 적을 수 있음(에러 핸들링).

### 실행 예시 (질의)

```
[1/2] 벡터 DB 로드
  - 벡터 DB 로드 완료: 315개 청크
[2/2] LLM 생성 (Groq openai/gpt-oss-120b)

======================================================================
[질문] Claude Code로 플러그인이나 스킬을 개발하는 방법을 알려주고, 몇 분부터 보면 되는지 알려줘
======================================================================

[검색된 청크 10개]
  [2] 클로드 코워크 15분만에 마스터하기 @ 10:00
      https://www.youtube.com/watch?v=HFcVTALckhw&t=600
      ... 플러스를 누르신 후 플러그인에서 우리가 만든 플러그인 이름을 선택하 ...
  [9] 클로드 코드 2시간 안에 마스터하기 @ 60:00
      https://www.youtube.com/watch?v=vxEvo2BLM6A&t=3600
      ... 플러그인을 설치하고 스킬을 만들고 그 스킬을 테스트하는 것까지 ...
  ...

----------------------------------------------------------------------
Claude Code에서 플러그인·스킬을 만드는 기본 흐름은 다음과 같습니다.
1. 플러그인 만들기 — 코워크에서 플러스 → 플러그인 이름 선택 ...
2. 스킬 만들기 — '스킬 크리에이터' 설치 후 트리거 키워드·파라미터 정의 ...

### 참고 영상 및 시작 시점
- 클로드 코워크 15분만에 마스터하기 ▶ 10분 00초부터 → https://...&t=600
- 클로드 초보자 가이드 2026       ▶ 22분 00초부터 → https://...&t=1320
----------------------------------------------------------------------
```

> 질문의 "몇 분부터 보면 되나요?"에 대해 타임스탬프 청킹 덕분에 **정확한 시점(분:초)과 바로가기 URL**을 제시함.

---

## 5. 전체 구성

| 항목 | 내용 |
|------|------|
| Search | YouTube Data API v3 (`publishedAfter` 최근 90일, `order=relevance`, Multi-Query 4관점) |
| 필터 | 길이 ≥ 5분, 조회수 ≥ 1000회, 토픽당 10개 |
| Transcript | youtube-transcript-api 직접 호출 (`ko→en`, 120초 청킹, 프록시·백오프로 IP 차단 대응) |
| Embed | OpenAI `text-embedding-3-small` (1536차원) |
| VectorDB | ChromaDB (`./chroma_db`, 컬렉션 `youtube_transcripts`, 최초/추가 자동 감지) |
| Retriever | MMR (`k=10`, `fetch_k=30`, `lambda_mult=0.5`) |
| LLM | Groq LPU `openai/gpt-oss-120b` (`reasoning_format="hidden"`) |
