---
name: explain-exam
description: 파이썬 예제 코드를 파이썬 모르는 교육생에게 쉽게 설명하는 웹 페이지를 생성함. 예제 디렉터리를 입력받아 공용 셸(기본 hands-on/explain-exam)로 여는 data.js 하나를 작성. "예제 설명 페이지", explain-exam, 예제 코드 설명/해설 페이지 제작 요청 시 사용.
argument-hint: "<예제 디렉터리 경로> [화면(셸) 디렉터리 경로]"
---

# explain-exam — 예제 설명 페이지 생성

입력: $ARGUMENTS
- **1번째 인자 (필수)** = 설명할 예제 디렉터리 경로.
- **2번째 인자 (선택)** = 화면(셸) 디렉터리 경로.
  - **생략 시 자동 도출**: 예제를 감싸는 **가장 가까운 상위 `hands-on/` 루트** 아래의 `explain-exam/`.
    - 예: `hands-on/09.langchain/claude` → `hands-on/explain-exam`
    - 예: `start-here/hands-on/llm` → `start-here/hands-on/explain-exam`
  - 이 프로젝트에는 hands-on 트리가 **여럿**(`hands-on/`, `start-here/hands-on/` …) 있고, 각 트리에 자체 `explain-exam/` 셸이 있음. 셸은 **예제와 같은 hands-on 트리** 아래에 있어야 함(launcher가 예제의 상위 hands-on 루트에서 셸을 찾으므로).
  - 아래 문서에서 `<셸 디렉터리>`는 이 값(예제가 속한 hands-on 트리의 셸)을, `<셸 서브경로>`는 그 hands-on 루트 기준 셸 상대경로(기본 `explain-exam`)를 가리킴.

파이썬을 전혀 모르는 교육생이 예제 코드를 이해하도록, 3분할 웹 페이지로 설명함.
좌측(처리 흐름 + 파일별 함수) · 중앙(소스 코드) · 우측(요약→동작원리→줄별 풀이→용어) 구조.

## 핵심 원칙
- 화면(셸)은 `<셸 디렉터리>`(기본 `hands-on/explain-exam/`)에 이미 있음. **수정하지 않음**.
- 예제마다 **`data.js` 하나만** 새로 작성하여 페이지를 구성함.
- 교육생은 코드를 "읽기만" 함. 설치·서버·파이썬 실행 없이 브라우저로 봄.

## 산출물
- `<예제 디렉터리>/explain/data.js` — 예제별 콘텐츠 (핵심 생성물)
- `<예제 디렉터리>/explain/index.html` — 더블클릭 launcher (같은 셸을 쓰는 예제끼리는 **동일 파일**; `<셸 서브경로>`만 다름. 아래 "launcher 템플릿"을 복사하며 셸 서브경로를 채움)
- 공용 셸(`<셸 디렉터리>/index.html`, `assets/`, `verify-data.js`)은 건드리지 않음

## 처리 절차

### 1. 입력 확인
- `$ARGUMENTS`의 **1번째 인자**(예제 디렉터리)가 비면, 설명할 예제(메인 `.py`)가 있는 디렉터리를 사용자에게 물음.
- **2번째 인자**(화면 셸 디렉터리)가 있으면 그 값을 `<셸 디렉터리>`로 사용함. 없으면 예제 경로에서 **가장 가까운 상위 `hands-on/` 루트**를 찾아 `<그 루트>/explain-exam`으로 자동 도출함.
  - `<셸 디렉터리>`에 셸 파일(`index.html`, `assets/`, `verify-data.js`)이 실제로 있는지 확인함. 없으면 사용자에게 알림(그 트리에 셸이 아직 없을 수 있음).
  - `<셸 서브경로>` = `<셸 디렉터리>`의, **예제의 상위 hands-on 루트 기준** 상대경로(기본 `explain-exam`, 예: `start-here/hands-on/explain-exam`는 루트 `start-here/hands-on/` 기준 `explain-exam`).
  - `<셸 디렉터리>`가 예제의 상위 hands-on 루트 아래가 아니면 launcher가 셸을 못 찾으므로 중단하고 사용자에게 알림.
- 메인 예제 파일(보통 `streamlit run` 대상 또는 `if __name__ == "__main__"` 있는 파일)을 식별함.

### 2. 예제 분석 (다중 파일 필수)
- 메인 파일의 `import` 문을 따라 **로컬(프로젝트 내) 모듈을 모두 수집**함. (외부 라이브러리는 제외)
  - 예: `from tools import TRAVEL_TOOLS` → 같은/상위 경로의 `tools.py`를 찾아 포함.
  - `sys.path.insert(...)`로 추가되는 `common/` 같은 경로도 추적함.
- 메인 + 의존 모듈의 **함수·주요 상수·@tool**을 파일별로 목록화함.
- 전체 처리 흐름(실행 진입 → 입력 → 처리 → 응답 생성 → 표시)을 단계로 정리함.

### 3. data.js 작성
- 아래 "data.js 스키마"를 따름. `window.EXPLAIN_DATA = { ... }` 전역 할당.
- 코드(`code`)는 **실제 소스 그대로** 넣음(발췌·재구성 금지). 구문 강조는 셸이 처리.
- 줄별 풀이(`lines`)는 줄 번호가 아니라 **앵커(`at`: 코드 안의 부분 문자열)**로 작성함.

### 3-1. launcher 복사
- `<예제 디렉터리>/explain/index.html` 에 아래 "launcher 템플릿"을 복사하되, 템플릿 안 `SHELL_SUB` 값을 **`<셸 서브경로>`**(기본 `explain-exam`)로 채움.
- 기본 셸을 쓰면 모든 예제가 동일 파일임(수정 불필요). 다른 셸을 쓰면 `SHELL_SUB`만 그 셸의 서브경로로 바뀜.
- 이 launcher는 같은 폴더의 `data.js` 를 화면 셸로 자동 연결함 → 교육생이 **이 index.html 만 더블클릭**하면 됨.
- 경로는 launcher가 `hands-on/` 기준으로 동적 계산하므로 `../` 개수를 직접 세지 않음(깊이 무관).

### 4. 검증 (게이트 — 필수)
```bash
node <셸 디렉터리>/verify-data.js <예제 디렉터리>/explain/data.js
# 기본 셸 예: node hands-on/explain-exam/verify-data.js <예제 디렉터리>/explain/data.js
```
- 결과가 **`VERIFY: PASS (오류 0건)`** 이어야 함. 실패 시 메시지대로 고치고 재실행.

### 5. (권장) 실제 렌더 확인
- 로컬 HTTP 또는 headless Chrome로 file:// 렌더를 확인함(아래 "테스트" 참고).

### 6. 실습 인덱스 추가
- 예제가 속한 hands-on 트리의 **목록**에 이 예제를 등록해 교육생이 쉽게 찾게 함. 트리마다 목록 방식이 다르므로 아래 순서로 판단:
  1. `<셸 디렉터리>/examples.js`(레지스트리, `window.EXAMPLE_INDEX` 배열)가 있으면 **거기에 항목 1개를 append**함
     (`{chapter, name, file, desc, link:"../<예제>/explain/index.html", readme}`). 이러면 셸 `index.html`을 data 없이 열 때 리스트에 자동 표시됨. (예: `start-here/hands-on/explain-exam/examples.js`)
     - `<예제 디렉터리>/web/index.html`(가시화 페이지)이 **있으면** 항목에 `web:"../<예제>/web/index.html"`도 넣음 → 카드에 "가시화 설명" 버튼이 표시됨. 없으면 생략.
  2. 레지스트리가 없고 트리 루트에 `index.html`(예제 목록 페이지, 예: `hands-on/index.html`)이 있으면 적절한 위치에 `<예제 디렉터리>` 항목을 추가함.
  3. 둘 다 없으면 이 단계는 건너뜀(없다고 실패로 보지 않음).

### 7. 사용자 안내
- 가장 간단한 방법: **`<예제 디렉터리>/explain/index.html` 을 더블클릭** (launcher가 화면 셸로 자동 연결).
- 또는 직접 열기: `<셸 디렉터리>/index.html?data=<예제 data.js 상대경로>`
  - 예(기본 셸): `hands-on/explain-exam/index.html?data=../09.langchain/claude/explain/data.js`

## data.js 스키마 (고정 계약 — 셸이 이 구조에만 의존)

```js
window.EXPLAIN_DATA = {
  meta:  { title: "페이지 제목", entry: "메인 파일명" },
  files: [ { id: "main", label: "파일명.py", role: "한 줄 역할" } ],   // 좌측 그룹 = 파일
  flow:  [ {
    step: 1, title: "단계명", summary: "중앙 한 줄", detail: "우측 상세(비유 포함)",
    label: "좌측용 짧은 제목",          // (선택) 좌측 '처리 흐름' 바로가기 메뉴 표시명. 없으면 title 사용
    refs: ["get_agent"],                // (선택) 이 단계의 함수 id들 → 좌측 단계 클릭·중앙 '코드:' 칩으로 소스 점프
  } ],
  functions: [
    {
      id: "get_agent",                 // 고유 식별자
      name: "get_agent()",             // 좌측 메뉴 표시명
      fileId: "main",                  // files[].id 참조 → 파일별 그룹핑
      summary: "한 줄 요약",
      how: "동작 원리(선택, 여러 문장 가능)",
      terms: ["create_react_agent"],   // glossary 키 참조 → 우측 용어
      lines: [                         // 줄별 풀이: 줄 번호 대신 앵커(at)
        { at: 'require_api_key(', text: "그 줄이 하는 일(쉬운 말)" }
      ],
      code: "def get_agent():\n    ..."  // 실제 파이썬 소스 전체(줄바꿈 포함)
    }
  ],
  glossary: { "create_react_agent": "쉬운 설명" }
};
```

### 작성 팁
- `code`는 JS 템플릿 리터럴(백틱)로 작성하기 쉬움. **소스에 백틱(`` ` ``)이 있으면 `\`` 로 이스케이프**함.
  (예: 마크다운 문자열 안의 `` `서울` `` → `` \`서울\` ``)
- `terms`의 각 항목은 `glossary`에 키가 존재해야 함.
- `files[].id`와 `functions[].fileId`가 일치해야 좌측 그룹에 표시됨.
- (선택) `flow[].label`·`flow[].refs`로 **처리 흐름↔함수**를 연결함. `refs`는 그 단계의 `functions[].id` 목록이며,
  좌측 단계 바로가기·중앙 "코드:" 칩·함수 화면 상단 "처리 흐름 N단계" 배너로 렌더됨. 깨끗이 대응되는 함수가 없는
  단계는 `refs`를 **생략**함(억지 매칭 금지 = graceful degrade). 모범사례: `16.mas/patent-mas/mas-a/explain/data.js`.

## launcher 템플릿 (`<예제>/explain/index.html` — `SHELL_SUB`만 `<셸 서브경로>`로 채우고 나머지는 그대로 복사; 기본 셸이면 모든 예제 동일)

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>예제 설명 페이지로 이동…</title>
  <script>
    // 같은 폴더의 data.js 를, 예제가 속한 hands-on 트리의 화면 셸(기본 explain-exam)로 열어 줌.
    // 가장 가까운 상위 /hands-on/ 을 앵커로 삼아, 어느 hands-on 트리·깊이든 동작하도록 경로를 동적 계산함(상대경로 → file:// 안전).
    (function () {
      var here = location.href.split(/[?#]/)[0];
      var i = here.lastIndexOf("/hands-on/");
      if (i === -1) {
        document.addEventListener("DOMContentLoaded", function () {
          document.body.textContent = "경로 오류: 이 파일은 hands-on/ 아래에 있어야 합니다.";
        });
        return;
      }
      // 화면 셸의 (예제의 상위 hands-on 루트 기준) 상대경로. 기본 "explain-exam".
      // 다른 셸을 쓰면 스킬이 이 값을 <셸 서브경로>로 바꿔 씀.
      var SHELL_SUB = "explain-exam";
      var rel = here.slice(i + "/hands-on/".length);  // 예: 09.langchain/claude/explain/index.html
      var dir = rel.replace(/[^\/]*$/, "");           // 예: 09.langchain/claude/explain/
      var depth = (dir.match(/\//g) || []).length;    // 예: 3
      var shell = "../".repeat(depth) + SHELL_SUB + "/index.html";
      location.replace(shell + "?data=../" + dir + "data.js");
    })();
  </script>
</head>
<body style="font-family: system-ui, 'Malgun Gothic', sans-serif; padding: 28px; color: #333;">
  설명 페이지로 이동 중입니다…
  <noscript>
    JavaScript가 꺼져 있어 자동 이동하지 못했습니다. 브라우저에서 JavaScript를 켜고 다시 열거나,
    공용 셸 <code>hands-on/explain-exam/index.html</code> 에
    <code>?data=&lt;이 폴더의 data.js 상대경로&gt;</code> 를 붙여 여세요.
  </noscript>
</body>
</html>
```

## MUST
- **줄 번호 매칭**: `lines`는 반드시 `{ at, text }` 앵커로 작성함. `at`은 해당 함수 `code` 안에서
  **정확히 한 줄**과만 매칭되는 부분 문자열이어야 함(0개=오타, 2개+=모호). 동일 라인이 여러 번
  나오면(예: `return cleaned` 중복) 더 구체적인 앵커를 쓰거나 다른 줄을 선택함.
  → 생성 후 `verify-data.js`가 **PASS** 해야 함(이 게이트로 줄 번호 어긋남을 원천 차단).
- **초보자 친화**: 모든 설명은 파이썬 모르는 사람 기준. 필요 시 비유·예시 사용.
- **용어 설명**: 기술 용어·약어는 모두 `glossary`에 쉬운 말로 풀이.
  `agentic-ai/reference/standard-comment.md`의 "파이썬 관용구 의무 목록 / 외부 라이브러리 용어"를 1차 출처로 활용.
- **다중 파일 그룹핑**: 메인 + 의존 모듈을 `files`로 나눠, 함수를 파일별로 묶음.
- **코드 충실성**: `code`는 실제 소스 그대로. 발췌 시 `# (일부 발췌)` 명시.
- **file:// 안전**: `data.js`는 `window.EXPLAIN_DATA` 전역 할당만 함.
  `fetch`/`import`/ES 모듈 사용 금지(셸이 동적 `<script>`로 불러오고 charset도 셸이 처리함).

## MUST NOT
- 교육생에게 빌드·서버·파이썬 실행을 요구하지 않음.
- 공용 셸(`<셸 디렉터리>/index.html`, `assets/`)을 예제마다 복사·수정하지 않음.
- 예제 코드를 실행하거나 외부 API를 호출하지 않음(정적 설명 전용).
- 영문 위주 설명 금지(한국어 기준, 기술 용어만 원어 병기).

## 시행착오 (반드시 참고 — 과거 실수)
- [HIGH] `data.json` + `fetch`는 `file://`에서 CORS(null origin)로 차단되어 **빈 화면**이 됨 →
  `data.js`의 `window` 전역 + `<script>` 로드만 사용(셸이 동적 주입). fetch 금지.
- [HIGH] **줄 번호 수동 입력은 어긋남**. 특히 여러 줄 docstring이 있는 함수에서 원본 파일 기준으로
  적으면 화면의 1-기반 줄 번호와 안 맞음 → **앵커(at) 방식 + verify-data.js 게이트**로 해결.
- [HIGH] `file://`에선 HTTP charset 헤더가 없어 한글이 깨질(mojibake) 수 있음 → 셸이 `<script charset="utf-8">`로
  로드하므로 `data.js`는 UTF-8로 저장만 하면 됨(BOM 불필요).
- [MED] JS 템플릿 리터럴 `code`에 소스의 백틱이 그대로 들어가면 리터럴이 깨짐 → 백틱은 `\`` 로 이스케이프.
- [MED] 앵커가 함수 안에서 2곳 이상 매칭되면 verify 실패 → 더 긴/구체적 부분 문자열 사용.
- [MED] 예제는 단일 파일이 아님(메인이 `common/` 등 로컬 모듈 import) → import를 따라 전부 포함, 파일별 그룹핑.
- [MED] 테스트 도구가 `file://`를 막을 때가 있음 → headless Chrome `--virtual-time-budget`로 검증
  (동적 스크립트 로드가 끝나기 전 캡처되면 false blank가 나므로 budget 필수).

## 완료조건
- `node <셸 디렉터리>/verify-data.js <data.js>` → `VERIFY: PASS`.
- 좌측에 처리 흐름 + 함수가 파일별로 표시(메인 + 의존 모듈 전부).
- 함수 클릭 시 중앙 소스 + 우측 요약·동작원리·줄별 풀이·용어가 표시되고, 줄별 풀이의 줄 번호가 코드와 일치.
- `<셸 디렉터리>/index.html?data=<상대경로>`로 열면 빈 화면·한글 깨짐 없이 렌더됨.
- 예제가 속한 hands-on 트리의 `index.html`이 있으면, 그 파일에 `<예제 디렉터리>` 항목이 추가되어 있음.

## 테스트 방법 (참고)
로컬 HTTP:
```bash
# <셸 디렉터리>에서 (기본: hands-on/explain-exam, 예: start-here/hands-on/explain-exam)
python -m http.server 8777 --bind 127.0.0.1
# 브라우저: http://127.0.0.1:8777/index.html?data=../<예제>/explain/data.js
```
headless Chrome로 file:// (Windows 예):
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu `
  --screenshot="$env:TEMP\explain.png" --window-size=1600,1000 --virtual-time-budget=6000 `
  "file:///<레포 절대경로>/<셸 디렉터리>/index.html?data=../<예제>/explain/data.js"
# 생성된 explain.png 를 열어 3분할이 보이고 한글이 정상인지 확인
```
