# explain-exam — 예제 설명 페이지 공용 셸

파이썬을 전혀 모르는 교육생에게 예제 코드를 쉽게 설명하는 웹 페이지의 **공용 화면(셸)**임.  
셸(`index.html` + `assets/`)은 모든 예제가 공유하고, **예제마다 `data.js` 하나만** 만들어 페이지를 구성함.

## 구조

```
hands-on/explain-exam/
├── index.html          # 공용 셸 (예제 무관·고정)
├── assets/
│   ├── app.js          # 공용 로직: ?data= 로드·렌더·구문강조·앵커 줄풀이
│   └── style.css       # 공용 스타일
├── verify-data.js      # data.js 검증 게이트 (Node)
└── README.md

hands-on/<예제 디렉터리>/explain/
├── data.js             # ★예제별 콘텐츠★ (예제마다 새로 작성)
└── index.html          # 더블클릭 launcher (모든 예제 동일 파일 → 공용 셸로 연결)
```

## 여는 방법

### 방법 1 (권장): 예제 폴더의 launcher 더블클릭
각 예제의 `explain/index.html` 을 더블클릭하면 됨. 이 launcher가 같은 폴더의 `data.js` 를
이 공용 셸로 자동 연결함(`hands-on/` 기준 경로를 동적 계산 → 깊이 무관).

```
hands-on/09.langchain/claude/explain/index.html   ← 더블클릭
```

### 방법 2: 공용 셸을 직접 열며 `?data=` 지정
`index.html` 뒤에 `?data=<예제 data.js 까지의 상대경로>` 를 붙임.

```
explain-exam/index.html?data=../09.langchain/claude/explain/data.js
```

- `app.js` 가 이 경로를 **동적 `<script>` 로 주입**해 불러옴 → `fetch` 미사용 → `file://` 더블클릭에서도 안전
- 설치·서버·파이썬 실행 불필요, 오프라인 동작

> 파라미터 없이 `index.html` 만 열면 사용법 안내가 표시됨. `?data=` 대신 `#data=` 도 지원함.

## 새 예제 추가 (data.js 만 작성)

`.claude/skills/explain-exam/SKILL.md` 스킬이 예제 디렉터리를 입력받아 `data.js` 를 생성함.  
직접 작성할 경우 아래 스키마를 따르고, 반드시 검증 게이트를 통과시킴.

```bash
node hands-on/explain-exam/verify-data.js hands-on/<예제>/explain/data.js
# → VERIFY: PASS (오류 0건) 이어야 함
```

## data.js 스키마 (고정 계약)

`app.js` 는 아래 구조에만 의존함.

```js
window.EXPLAIN_DATA = {
  meta:  { title: "페이지 제목", entry: "메인 파일명" },
  files: [ { id: "main", label: "파일명.py", role: "한 줄 역할" } ],
  flow:  [ { step: 1, title: "단계명", summary: "중앙 한 줄", detail: "우측 상세(비유)",
             label: "좌측용 짧은 제목", refs: ["get_agent"] } ],  // label·refs는 선택: 처리 흐름↔함수 점프 연결
  functions: [
    {
      id: "get_agent",        // 고유 식별자
      name: "get_agent()",    // 좌측 메뉴 표시명
      fileId: "main",         // files[].id 참조 → 파일별 그룹핑
      summary: "한 줄 요약",
      how: "동작 원리(선택)",
      terms: ["create_react_agent"],   // glossary 키 참조
      // 줄별 풀이: 줄 번호 대신 "코드 안의 부분 문자열(at)"로 앵커링 → 앱이 줄 번호 자동 계산
      lines: [ { at: 'require_api_key(', text: "그 줄이 하는 일" } ],
      code: "def get_agent():\n    ..."   // 순수 파이썬 소스 (구문강조는 app.js가 처리)
    }
  ],
  glossary: { "create_react_agent": "쉬운 설명" }
};
```

### 왜 줄 번호 대신 앵커(at)인가
수동 줄 번호는 docstring 길이 등으로 쉽게 어긋남(실제로 초기 버전에서 발생).  
`at` 은 코드의 부분 문자열이라 앱이 줄 번호를 **자동 계산**함 → 어긋날 수 없음.  
`verify-data.js` 가 각 `at` 이 **정확히 한 줄**과 매칭되는지 검사함(0개·2개+ 매칭 시 실패).
