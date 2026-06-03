/*
 * 예제 설명 페이지 - 공유 로직 (모든 예제가 이 파일을 공유함. 예제별로 바꾸지 않음)
 *
 * 하는 일:
 *   1) URL 파라미터 ?data=<상대경로> 로 예제 data.js 를 동적 <script> 주입으로 불러옴
 *      (fetch 미사용 → file:// 로 더블클릭해도 안전)
 *   2) window.EXPLAIN_DATA 를 읽어 좌측 메뉴를 그림 (처리 흐름 + 파일별 함수)
 *   3) 메뉴 클릭 시 중앙(코드/흐름)과 우측(설명)을 함께 갱신
 *   4) 파이썬 구문 강조를 외부 라이브러리 없이 자체 구현 (오프라인/file:// 안전)
 *   5) 줄별 풀이는 "앵커(at: 코드 부분 문자열)"로 줄 번호를 자동 계산함
 *      → 수동 줄 번호를 쓰지 않으므로 줄 번호가 어긋날 수 없음
 */
(function () {
  "use strict";

  var els = {
    title: document.getElementById("page-title"),
    entry: document.getElementById("page-entry"),
    nav: document.getElementById("nav"),
    center: document.getElementById("center"),
    detail: document.getElementById("detail"),
  };

  var DATA = null;
  var LS_ZOOM = "explain_code_zoom";
  var codeZoom = parseFloat(localStorage.getItem(LS_ZOOM) || "1.0");  // 코드블록 폰트 배율 (0.5 ~ 2.0)

  function applyZoom() {
    var block = els.center.querySelector(".code-block");
    if (block) block.style.fontSize = (13.5 * codeZoom).toFixed(1) + "px";
  }

  // ---------------------------------------------------------------------------
  // 데이터 로딩 (?data= 또는 #data=)
  // ---------------------------------------------------------------------------

  function getDataPath() {
    try {
      var q = new URLSearchParams(location.search).get("data");
      if (q) return q;
    } catch (e) { /* 구형 브라우저 대비 */ }
    var h = location.hash || "";
    if (h.indexOf("#data=") === 0) return decodeURIComponent(h.slice("#data=".length));
    return null;
  }

  function showMessage(html) {
    if (els.center) els.center.innerHTML = '<div class="empty-error">' + html + "</div>";
    if (els.detail) els.detail.innerHTML = "";
    if (els.nav) els.nav.innerHTML = "";
  }

  function showUsage() {
    showMessage(
      "<h2>예제를 지정해 주세요</h2>" +
      "<p>이 페이지는 여러 예제가 함께 쓰는 공용 화면임. 주소 뒤에 <code>?data=예제경로</code> 를 붙여 엽니다.</p>" +
      '<p>예) <code>index.html?data=../09.langchain/claude/explain/data.js</code></p>'
    );
  }

  function start() {
    var path = getDataPath();
    if (!path) { showUsage(); return; }
    // 캐시 무력화: data.js 수정 후에도 브라우저가 옛 버전을 쓰지 않도록 타임스탬프 쿼리를 덧붙임.
    // file:// 더블클릭 실행 시에는 쿼리가 일부 브라우저의 경로 해석을 방해할 수 있어, http(s) 서빙일 때만 적용함.
    var src = path;
    if (location.protocol !== "file:") {
      src += (path.indexOf("?") === -1 ? "?" : "&") + "t=" + Date.now();
    }
    var s = document.createElement("script");
    s.src = src;
    s.charset = "utf-8"; // file:// 에서 한글이 깨지지 않도록 UTF-8 명시
    s.onload = boot;
    s.onerror = function () {
      showMessage(
        "<h2>예제 데이터를 불러오지 못했습니다</h2>" +
        "<p>경로를 확인하세요: <code>" + esc(path) + "</code></p>"
      );
    };
    document.head.appendChild(s);
  }

  function boot() {
    DATA = window.EXPLAIN_DATA;
    if (!DATA || typeof DATA !== "object") {
      showMessage("<h2>콘텐츠 형식 오류</h2><p>data.js 가 <code>window.EXPLAIN_DATA</code> 를 정의해야 합니다.</p>");
      return;
    }
    init();
  }

  // ---------------------------------------------------------------------------
  // 공통 유틸
  // ---------------------------------------------------------------------------

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ---------------------------------------------------------------------------
  // 파이썬 구문 강조 (간단한 자체 구현)
  // ---------------------------------------------------------------------------

  var PY_KW = {};
  ["def","return","if","elif","else","for","while","in","not","and","or","is","None",
   "True","False","import","from","as","with","try","except","finally","raise","class",
   "lambda","pass","break","continue","yield","global","nonlocal","assert","del","async","await"
  ].forEach(function (k) { PY_KW[k] = true; });

  function highlightLine(line, state) {
    var out = "", i = 0, n = line.length;
    if (state.triple) {
      var c0 = line.indexOf(state.triple);
      if (c0 === -1) return '<span class="t-str">' + esc(line) + "</span>";
      out += '<span class="t-str">' + esc(line.slice(0, c0 + 3)) + "</span>";
      state.triple = null;
      i = c0 + 3;
    }
    while (i < n) {
      var c = line[i];
      if (c === "#") { out += '<span class="t-com">' + esc(line.slice(i)) + "</span>"; break; }
      var tri = line.slice(i, i + 3);
      if (tri === '"""' || tri === "'''") {
        var cc = line.indexOf(tri, i + 3);
        if (cc === -1) { out += '<span class="t-str">' + esc(line.slice(i)) + "</span>"; state.triple = tri; break; }
        out += '<span class="t-str">' + esc(line.slice(i, cc + 3)) + "</span>"; i = cc + 3; continue;
      }
      if (c === '"' || c === "'") {
        var j = i + 1;
        while (j < n) { if (line[j] === "\\") { j += 2; continue; } if (line[j] === c) { j++; break; } j++; }
        out += '<span class="t-str">' + esc(line.slice(i, j)) + "</span>"; i = j; continue;
      }
      if (c === "@" && (i === 0 || /\s/.test(line[i - 1]))) {
        var k = i + 1;
        while (k < n && /[A-Za-z0-9_.]/.test(line[k])) k++;
        out += '<span class="t-dec">' + esc(line.slice(i, k)) + "</span>"; i = k; continue;
      }
      if (/[0-9]/.test(c) && (i === 0 || !/[A-Za-z0-9_]/.test(line[i - 1]))) {
        var m = i;
        while (m < n && /[0-9.]/.test(line[m])) m++;
        out += '<span class="t-num">' + esc(line.slice(i, m)) + "</span>"; i = m; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        var p = i;
        while (p < n && /[A-Za-z0-9_]/.test(line[p])) p++;
        var word = line.slice(i, p);
        if (PY_KW[word]) out += '<span class="t-kw">' + esc(word) + "</span>";
        else if (/^\s*\(/.test(line.slice(p))) out += '<span class="t-fn">' + esc(word) + "</span>";
        else out += esc(word);
        i = p; continue;
      }
      out += esc(c); i++;
    }
    return out;
  }

  function highlightPython(code) {
    var state = { triple: null };
    return String(code).split("\n").map(function (l) {
      try { return highlightLine(l, state); } catch (e) { return esc(l); }
    });
  }

  // 앵커(at: 코드 부분 문자열)로 줄 번호를 자동 계산함. 못 찾으면 line=0.
  function resolveAnchors(code, anns) {
    var rawLines = String(code).split("\n");
    return (anns || []).map(function (a) {
      var idx = -1;
      for (var i = 0; i < rawLines.length; i++) {
        if (a.at != null && rawLines[i].indexOf(a.at) !== -1) { idx = i; break; }
      }
      return { line: idx + 1, found: idx >= 0, text: a.text };
    }).filter(function (a) { return a.found; })
      .sort(function (x, y) { return x.line - y.line; });
  }

  // ---------------------------------------------------------------------------
  // 좌측 메뉴
  // ---------------------------------------------------------------------------

  function buildNav() {
    var html = "";
    html += '<div class="nav-group">';
    html += '<div class="nav-group-title flow">처리 흐름</div>';
    html += '<button type="button" class="nav-item" data-type="flow" data-id="__flow__">전체 실행 흐름</button>';
    html += "</div>";

    (DATA.files || []).forEach(function (file) {
      var fns = (DATA.functions || []).filter(function (fn) { return fn.fileId === file.id; });
      if (!fns.length) return;
      html += '<div class="nav-group">';
      html += '<div class="nav-group-title file">' + esc(file.label) + "</div>";
      if (file.role) html += '<div class="nav-group-role">' + esc(file.role) + "</div>";
      fns.forEach(function (fn) {
        html += '<button type="button" class="nav-item" data-type="fn" data-id="' + esc(fn.id) + '">' +
          esc(fn.name) + "</button>";
      });
      html += "</div>";
    });
    els.nav.innerHTML = html;
  }

  function setActive(type, id) {
    var items = els.nav.querySelectorAll(".nav-item");
    for (var x = 0; x < items.length; x++) {
      var it = items[x];
      var on = it.getAttribute("data-type") === type && it.getAttribute("data-id") === id;
      if (on) it.classList.add("active"); else it.classList.remove("active");
    }
  }

  function selectItem(type, id) {
    setActive(type, id);
    if (type === "flow") renderFlow();
    else renderFunction(id);
    els.center.scrollTop = 0;
    els.detail.scrollTop = 0;
  }

  // ---------------------------------------------------------------------------
  // 처리 흐름 렌더링
  // ---------------------------------------------------------------------------

  function renderFlow() {
    var steps = DATA.flow || [];
    var c = '<div class="center-head"><h2>전체 실행 흐름</h2>' +
      '<p class="center-sub">앱이 켜져서 답변을 줄 때까지의 단계입니다. ' +
      "각 단계에 마우스를 올리면 오른쪽의 자세한 설명과 연결됩니다.</p></div>";
    c += '<div class="flow">';
    steps.forEach(function (s, idx) {
      c += '<div class="flow-step" data-step="' + esc(s.step) + '">' +
        '<div class="flow-num">' + esc(s.step) + "</div>" +
        '<div class="flow-body"><div class="flow-title">' + esc(s.title) + "</div>" +
        '<div class="flow-sum">' + esc(s.summary) + "</div></div></div>";
      if (idx < steps.length - 1) c += '<div class="flow-arrow">&#8595;</div>';
    });
    c += "</div>";
    els.center.innerHTML = c;

    var d = '<div class="detail-head"><h2>단계별 자세한 설명</h2>' +
      '<p class="detail-sub">비유와 함께 각 단계가 무엇을, 왜 하는지 풀어서 설명합니다.</p></div>';
    steps.forEach(function (s) {
      d += '<div class="flow-detail" data-step="' + esc(s.step) + '">' +
        '<div class="fd-head"><span class="fd-num">' + esc(s.step) + "</span>" + esc(s.title) + "</div>" +
        '<div class="fd-body">' + esc(s.detail) + "</div></div>";
    });
    els.detail.innerHTML = d;
    wireSync(".flow-step", "data-step", ".flow-detail");
  }

  // ---------------------------------------------------------------------------
  // 함수 렌더링
  // ---------------------------------------------------------------------------

  function renderFunction(id) {
    var fn = (DATA.functions || []).filter(function (f) { return f.id === id; })[0];
    if (!fn) {
      els.center.innerHTML = '<div class="empty-error"><p>함수를 찾을 수 없습니다.</p></div>';
      els.detail.innerHTML = "";
      return;
    }
    var file = (DATA.files || []).filter(function (f) { return f.id === fn.fileId; })[0];

    // 중앙: 소스 코드 (줄 번호 + 구문 강조)
    var hl = highlightPython(fn.code);
    var c = '<div class="center-head">';
    if (file) c += '<span class="file-badge">' + esc(file.label) + "</span>";
    c += "<h2>" + esc(fn.name) + "</h2></div>";
    c += '<div class="code-wrap">';
    c += '<div class="code-zoom-bar">' +
      '<button class="zoom-btn" data-action="out" title="축소">A<sup>−</sup></button>' +
      '<button class="zoom-btn" data-action="in"  title="확대">A<sup>+</sup></button>' +
      '</div>';
    c += '<div class="code-block">';
    hl.forEach(function (lineHtml, idx) {
      var ln = idx + 1;
      c += '<div class="code-line" data-line="' + ln + '">' +
        '<span class="ln">' + ln + "</span>" +
        '<span class="lc">' + (lineHtml === "" ? "&nbsp;" : lineHtml) + "</span></div>";
    });
    c += "</div></div>";
    els.center.innerHTML = c;
    applyZoom(); // 저장된 줌 배율 즉시 적용

    // 우측: 설명 (요약 -> 동작 원리 -> 줄별 풀이 -> 용어)
    var d = '<div class="detail-head"><h2>이 함수가 하는 일</h2></div>';
    d += '<div class="d-summary">' + esc(fn.summary) + "</div>";
    if (fn.how) {
      d += '<div class="d-section"><h3>동작 원리</h3><p class="d-how">' + esc(fn.how) + "</p></div>";
    }

    var annos = resolveAnchors(fn.code, fn.lines);
    if (annos.length) {
      d += '<div class="d-section"><h3>줄별 풀이</h3>' +
        '<p class="d-tip">코드 줄에 마우스를 올리면 해당 설명이 강조됩니다.</p><div class="anno-list">';
      annos.forEach(function (a) {
        var isStar = a.text.indexOf("★") !== -1;
        var cls    = "anno" + (isStar ? " anno--star" : "");
        var txt    = esc(a.text).replace(/★/g, '<span class="anno-star-icon">★</span>');
        d += '<div class="' + cls + '" data-line="' + a.line + '">' +
          '<span class="anno-ln">줄 ' + a.line + "</span>" +
          '<span class="anno-tx">' + txt + "</span></div>";
      });
      d += "</div></div>";
    }

    var terms = fn.terms || [];
    if (terms.length) {
      d += '<div class="d-section"><h3>용어 풀이</h3><div class="terms">';
      terms.forEach(function (t) {
        var def = (DATA.glossary || {})[t] || "(설명 준비 중)";
        d += '<div class="term"><span class="term-name" title="' + esc(def) + '">' + esc(t) + "</span>" +
          '<span class="term-desc">' + esc(def) + "</span></div>";
      });
      d += "</div></div>";
    }

    els.detail.innerHTML = d;
    wireSync(".code-line", "data-line", ".anno");
  }

  // ---------------------------------------------------------------------------
  // 중앙 <-> 우측 항목 마우스 오버 동기화
  // ---------------------------------------------------------------------------

  function wireSync(leftSel, attr, rightSel) {
    var lefts = els.center.querySelectorAll(leftSel);
    var rights = els.detail.querySelectorAll(rightSel);
    var leftByKey = {}, rightByKey = {};
    var i;
    for (i = 0; i < lefts.length; i++) leftByKey[lefts[i].getAttribute(attr)] = lefts[i];
    for (i = 0; i < rights.length; i++) rightByKey[rights[i].getAttribute(attr)] = rights[i];

    function toggle(key, on) {
      if (leftByKey[key]) leftByKey[key].classList.toggle("hot", on);
      if (rightByKey[key]) rightByKey[key].classList.toggle("hot", on);
    }
    function bind(el, key, scrollTarget) {
      el.addEventListener("mouseenter", function () { toggle(key, true); });
      el.addEventListener("mouseleave", function () { toggle(key, false); });
      el.addEventListener("click", function () {
        if (scrollTarget) scrollTarget.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }
    for (i = 0; i < lefts.length; i++) {
      var lk = lefts[i].getAttribute(attr);
      if (rightByKey[lk]) lefts[i].classList.add("has-pair");
      bind(lefts[i], lk, rightByKey[lk]);
    }
    for (i = 0; i < rights.length; i++) {
      var rk = rights[i].getAttribute(attr);
      bind(rights[i], rk, leftByKey[rk]);
    }
  }

  // ---------------------------------------------------------------------------
  // 시작
  // ---------------------------------------------------------------------------

  function init() {
    if (els.title && DATA.meta && DATA.meta.title) els.title.textContent = DATA.meta.title;
    if (els.entry && DATA.meta && DATA.meta.entry) els.entry.textContent = "진입(시작) 파일: " + DATA.meta.entry;

    buildNav();
    els.nav.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".nav-item") : null;
      if (!btn) return;
      selectItem(btn.getAttribute("data-type"), btn.getAttribute("data-id"));
    });
    selectItem("flow", "__flow__"); // 첫 화면 = 처리 흐름

    // 코드블록 확대/축소 (이벤트 위임 + localStorage 저장)
    els.center.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".zoom-btn") : null;
      if (!btn) return;
      var action = btn.getAttribute("data-action");
      if (action === "in")  codeZoom = Math.min(2.0, +(codeZoom + 0.15).toFixed(2));
      if (action === "out") codeZoom = Math.max(0.5, +(codeZoom - 0.15).toFixed(2));
      localStorage.setItem(LS_ZOOM, codeZoom);
      applyZoom();
    });
  }

  start();
})();
