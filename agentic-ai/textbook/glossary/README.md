# AI 부트캠프 초보자 용어집

AI Boot Camp 교재 17종을 분석하여 만든 **초보자용 AI 용어 사전** (웹문서)  
비유와 예시 중심으로 작성하여 AI를 처음 접하는 직원도 쉽게 이해 가능

## 구성 파일

| 파일 | 설명 |
|:---|:---|
| `index.html` | 용어집 웹페이지 (검색·필터·초성검색·다크모드 UI 포함) |
| `glossary.json` | 용어 데이터 (term, 영문명, 분류, 설명, 비유, 예시, 출처교재, 연관어) |
| `README.md` | 본 문서 |

## 주요 기능

- **실시간 검색**: 용어명·영문명·설명·연관어를 입력 즉시 필터링
- **한글 초성 검색**: `ㅍㄹㅍㅌ` → 프롬프트, `ㅇㅂㄷ` → 임베딩 형태로 검색 가능
- **카테고리 필터**: 기초·공통, LLM·프롬프트, RAG·벡터검색, MCP 등 분류별 보기
- **연관어 점프**: 용어 카드의 연관어 클릭 시 해당 용어로 바로 이동
- **정렬**: 가나다/A–Z 또는 카테고리별 정렬
- **다크모드**: 우측 상단 토글로 전환 (설정 자동 저장)
- **반응형**: PC·태블릿·모바일 모두 지원

## 실행 방법

브라우저 보안 정책상 `glossary.json`을 읽으려면 로컬 서버 실행 권장  

### macOS / Linux

```bash
cd agentic-ai/textbook/glossary
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

### Windows (PowerShell / GitBash)

```bash
cd agentic-ai/textbook/glossary
python -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

> `index.html`을 더블클릭해서 바로 열 수도 있으나, 일부 브라우저는 보안 정책으로  
> 데이터 로드를 차단함. 이 경우 위 로컬 서버 방식 사용

## 데이터 갱신 방법

교재가 추가·수정되면 `glossary.json`에 항목을 추가하면 됨  
각 용어 항목 스키마:

```json
{
  "term": "용어명",
  "fullName": "영문 풀네임 또는 원어",
  "category": "카테고리(아래 목록 중 하나)",
  "definition": "초보자용 쉬운 설명",
  "analogy": "일상 비유 (선택)",
  "example": "구체적 예시 (선택)",
  "chapters": ["출처 교재명"],
  "related": ["연관 용어"]
}
```

카테고리 목록: 기초·공통, LLM·프롬프트, 오디오·비전, Function Calling·도구,  
LangChain·체인, RAG·벡터검색, GraphRAG·지식그래프, MCP, 멀티에이전트(MAS),  
노코드·플랫폼, 인프라·배포
