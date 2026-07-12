(function () {
  const DATA = window.VIZ_DATA;
  const sa = DATA.attention.self_attention;
  const mh = DATA.attention.multi_head;

  // ---------------------------------------------------------------
  // Section 1: Self-Attention step walkthrough + Multi-Head Attention
  // ---------------------------------------------------------------
  const STEP_META = [
    {
      num: 1, title: "관련도 점수 매기기", sub: "(전문용어: QK^T)",
      explain: `"${sa.query_word}"가 다른 단어들에게 "너는 나랑 얼마나 관련있어?"라고 하나씩 물어보고 ` +
        `숫자로 점수를 매기는 단계임. 숫자가 클수록 "많이 관련있다"는 뜻임.`,
    },
    {
      num: 2, title: "점수 다듬기", sub: "(전문용어: Scaling)",
      explain: `점수 차이가 너무 크면 나중에 딱 한 단어만 정답처럼 보이는 문제가 생김. 그래서 모든 점수를 ` +
        `같은 비율로 살짝 줄여서 다듬어줌.`,
    },
    {
      num: 3, title: "백분율로 바꾸기", sub: "(전문용어: Softmax)",
      explain: `다듬어진 점수를 "더하면 100%가 되는 비율(%)"로 바꿔줌. 이 비율은 바로 다음 단계에서 ` +
        `"각 단어의 이야기를 얼마나 섞어서 쓸지" 정하는 비율임. 예를 들어 사과를 40%, 나는 30%, 먹었다 ` +
        `(자기 자신) 30%로 나왔다면, 다음 단계에서 새 정보를 만들 때 사과를 이야기를 40%만큼, 나는 ` +
        `이야기를 30%만큼, 먹었다 자기 이야기를 30%만큼 섞어서 쓰겠다는 뜻임.`,
    },
    {
      num: 4, title: "집중한 만큼 정보 섞기", sub: "(전문용어: Weighted Sum)",
      explain: `위에서 구한 비율을 그대로 이용함 — 각 단어는 맨 위 표에서 본 것처럼 숫자 4개로 된 자기만의 ` +
        `정보를 갖고 있는데, 그 정보에 방금 구한 비율을 곱한 다음 전부 더함(아래 계산 참고). 그 결과로 ` +
        `"${sa.query_word}"를 위한 새로운 숫자 4개가 만들어짐 — 여기에 문장 전체의 맥락이 녹아 있음.`,
    },
  ];

  let currentStep = 1;
  let playTimer = null;

  function renderEmbedTable() {
    const el = document.getElementById("embed-table");
    let html = `<div style="font-size:12.5px;color:var(--color-secondary);margin-bottom:8px;">` +
      `각 단어를 숫자 ${sa.d_model}개로 표현한 값 (★표시가 지금 살펴보는 단어)</div><div class="token-table">`;
    sa.tokens.forEach((tok, i) => {
      const isQuery = tok === sa.query_word;
      html += `<div class="token-label${isQuery ? " query" : ""}">${tok}${isQuery ? " ★" : ""}</div>`;
      html += `<div>[ ${sa.embeddings[i].map((v) => v.toFixed(3)).join(", ")} ]</div>`;
    });
    html += `</div>
      <div class="step-explain" style="margin-top:10px;">
        이 숫자 ${sa.d_model}개는 "이 단어의 특징을 나타내는 좌표"임(전문용어: 임베딩 벡터). 숫자 하나하나가
        "품사"나 "감정"처럼 딱 하나의 뜻을 가지는 건 아니고, ${sa.d_model}개를 통틀어서 이 단어의 특징을
        표현함 — 그래서 숫자 하나만 보고 "몇 번째 숫자가 무슨 의미다"라고 말할 수는 없음. 실제 모델은
        보통 512~768개의 숫자를 쓰는데, 화면에 다 보이도록 이 데모에서는 ${sa.d_model}개만 사용함. 참고로
        지금은 학습 전(무작위) 상태라 숫자 자체에 특별한 의미는 없음 — 실제로 학습된 모델에서는 뜻이 비슷한
        단어끼리 숫자도 비슷해짐(예: "고양이"와 "강아지"의 숫자가 서로 가까워짐).
      </div>`;
    el.innerHTML = html;
  }

  function renderBars(container, items, opts) {
    opts = opts || {};
    container.innerHTML = "";
    const maxAbs = Math.max(...items.map((it) => Math.abs(it.value)), 1e-9);
    items.forEach((it) => {
      const row = document.createElement("div");
      row.className = "bar-row";

      const label = document.createElement("div");
      label.className = "bar-label" + (it.highlight ? " query" : "");
      label.textContent = it.label;

      const track = document.createElement("div");
      track.className = "bar-track";
      const fill = document.createElement("div");
      fill.className = "bar-fill" + (it.value < 0 ? " negative" : "");
      track.appendChild(fill);

      const valueEl = document.createElement("div");
      valueEl.className = "bar-value";
      valueEl.textContent = opts.percent ? (it.value * 100).toFixed(1) + "%" : it.value.toFixed(3);

      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(valueEl);
      container.appendChild(row);

      const widthPct = opts.percent ? Math.max(it.value, 0) * 100 : (Math.abs(it.value) / maxAbs) * 100;
      // Set synchronously (not via requestAnimationFrame): some browsers/preview
      // environments pause rAF for backgrounded or headless tabs, which would
      // otherwise leave every bar stuck at 0 width.
      fill.style.width = Math.min(widthPct, 100) + "%";
    });
  }

  function stepItems(stepNum) {
    if (stepNum === 1) {
      return sa.tokens.map((tok, i) => ({ label: tok, value: sa.raw_scores[i], highlight: tok === sa.query_word }));
    }
    if (stepNum === 2) {
      return sa.tokens.map((tok, i) => ({ label: tok, value: sa.scaled_scores[i], highlight: tok === sa.query_word }));
    }
    return sa.tokens.map((tok, i) => ({ label: tok, value: sa.attn_weights[i], highlight: tok === sa.query_word }));
  }

  function fmtVec(arr) {
    return "[ " + arr.map((v) => v.toFixed(3)).join(", ") + " ]";
  }

  // Step 4 keeps showing the same 3 tokens (not a sudden switch to "dim0..dim3"):
  // each row is "그 단어의 비율(%) × 그 단어의 정보(숫자 4개)", added together into one
  // new vector, so the jump from "% per word" (step 3) to "new numbers" (step 4)
  // stays visually connected to the words already on screen.
  function renderWeightedSumRecipe(container) {
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "mix-recipe";

    sa.tokens.forEach((tok, i) => {
      if (i > 0) {
        const plus = document.createElement("div");
        plus.className = "mix-op";
        plus.textContent = "+";
        wrap.appendChild(plus);
      }
      const row = document.createElement("div");
      row.className = "mix-row" + (tok === sa.query_word ? " query" : "");
      row.innerHTML =
        `<span class="mix-percent">${(sa.attn_weights[i] * 100).toFixed(1)}%</span>` +
        ` &times; <b>${tok}</b>의 정보 <span class="mix-vec">${fmtVec(sa.values[i])}</span>`;
      wrap.appendChild(row);
    });

    const eq = document.createElement("div");
    eq.className = "mix-op";
    eq.textContent = "=";
    wrap.appendChild(eq);

    const result = document.createElement("div");
    result.className = "mix-result";
    result.innerHTML = `새로 만들어진 "${sa.query_word}"의 정보 <span class="mix-vec">${fmtVec(sa.context)}</span>`;
    wrap.appendChild(result);

    container.appendChild(wrap);
  }

  function renderStepFlow() {
    const el = document.getElementById("step-flow");
    el.innerHTML = "";
    STEP_META.forEach((meta) => {
      const chip = document.createElement("div");
      chip.className = "step-chip" + (meta.num === currentStep ? " active" : "");
      chip.dataset.step = meta.num;
      chip.innerHTML = `<span class="step-num">STEP ${meta.num}</span>${meta.title}<br>` +
        `<span style="opacity:.85;font-weight:400;">${meta.sub}</span>`;
      chip.addEventListener("click", () => {
        stopPlay();
        currentStep = meta.num;
        renderAll();
      });
      el.appendChild(chip);
    });
  }

  function renderStepBody() {
    const meta = STEP_META[currentStep - 1];
    const body = document.getElementById("step-body");
    body.innerHTML = `<div style="font-weight:700;color:var(--color-primary);margin-bottom:8px;">` +
      `STEP ${meta.num}. ${meta.title}</div>`;
    const chartHost = document.createElement("div");
    body.appendChild(chartHost);
    if (currentStep === 4) {
      renderWeightedSumRecipe(chartHost);
    } else {
      renderBars(chartHost, stepItems(currentStep), { percent: currentStep === 3 });
    }
    document.getElementById("step-explain").textContent = meta.explain;
  }

  function renderAll() {
    renderStepFlow();
    renderStepBody();
  }

  function stopPlay() {
    if (playTimer) {
      clearInterval(playTimer);
      playTimer = null;
    }
  }

  document.getElementById("step-prev").addEventListener("click", () => {
    stopPlay();
    currentStep = Math.max(1, currentStep - 1);
    renderAll();
  });
  document.getElementById("step-next").addEventListener("click", () => {
    stopPlay();
    currentStep = Math.min(4, currentStep + 1);
    renderAll();
  });
  document.getElementById("step-play").addEventListener("click", () => {
    stopPlay();
    currentStep = 1;
    renderAll();
    playTimer = setInterval(() => {
      if (currentStep >= 4) {
        stopPlay();
        return;
      }
      currentStep += 1;
      renderAll();
    }, 1400);
  });

  function renderMultiHead() {
    const grid = document.getElementById("mha-grid");
    grid.innerHTML = "";
    mh.head_weights.forEach((weights, h) => {
      const card = document.createElement("div");
      card.className = "mha-head-card";
      card.innerHTML = `<h4>${h + 1}번째 관점 (Head ${h})</h4>`;
      const host = document.createElement("div");
      card.appendChild(host);
      grid.appendChild(card);
      renderBars(
        host,
        mh.tokens.map((tok, i) => ({ label: tok, value: weights[i], highlight: tok === mh.query_word })),
        { percent: true }
      );
    });
  }

  renderEmbedTable();
  renderAll();
  renderMultiHead();

  // ---------------------------------------------------------------
  // Section 2: training loss curve
  // ---------------------------------------------------------------
  (function () {
    const history = DATA.training;
    const svg = document.getElementById("loss-chart");
    const W = 900, H = 280, PAD_L = 46, PAD_B = 26, PAD_T = 12, PAD_R = 12;
    const logToggle = document.getElementById("loss-log");
    let playTimer2 = null;
    let cursor = 0;

    function scaleY(loss, useLog, maxLoss, minLoss) {
      const innerH = H - PAD_T - PAD_B;
      if (useLog) {
        const lo = Math.log10(Math.max(minLoss, 1e-4));
        const hi = Math.log10(maxLoss);
        const v = Math.log10(Math.max(loss, 1e-4));
        return PAD_T + innerH * (1 - (v - lo) / (hi - lo));
      }
      return PAD_T + innerH * (1 - loss / maxLoss);
    }

    function scaleX(epoch, total) {
      const innerW = W - PAD_L - PAD_R;
      return PAD_L + innerW * ((epoch - 1) / (total - 1));
    }

    function draw(uptoIndex) {
      const useLog = logToggle.checked;
      const total = history.length;
      const maxLoss = Math.max(...history.map((h) => h.loss));
      const minLoss = Math.min(...history.map((h) => h.loss));

      let path = "";
      for (let i = 0; i <= uptoIndex; i++) {
        const x = scaleX(history[i].epoch, total);
        const y = scaleY(history[i].loss, useLog, maxLoss, minLoss);
        path += (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1) + " ";
      }

      const axisSvg = `
        <line x1="${PAD_L}" y1="${H - PAD_B}" x2="${W - PAD_R}" y2="${H - PAD_B}" stroke="#dddde0" />
        <line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${H - PAD_B}" stroke="#dddde0" />
        <text x="${PAD_L}" y="${H - 6}" font-size="11" fill="#6b6b7b">epoch 1</text>
        <text x="${W - PAD_R - 60}" y="${H - 6}" font-size="11" fill="#6b6b7b">epoch ${total}</text>
        <text x="4" y="${PAD_T + 10}" font-size="11" fill="#6b6b7b">${maxLoss.toFixed(1)}</text>
        <text x="4" y="${H - PAD_B}" font-size="11" fill="#6b6b7b">${useLog ? minLoss.toFixed(3) : "0"}</text>
      `;
      svg.innerHTML = axisSvg + `<path d="${path}" fill="none" stroke="#0d9488" stroke-width="2.5" />`;

      if (uptoIndex >= 0) {
        const last = history[uptoIndex];
        document.getElementById("loss-epoch").textContent = last.epoch;
        document.getElementById("loss-value").textContent = last.loss.toFixed(4);
      }
      document.getElementById("loss-total").textContent = total;
    }

    function stopPlay2() {
      if (playTimer2) {
        clearInterval(playTimer2);
        playTimer2 = null;
      }
    }

    document.getElementById("loss-play").addEventListener("click", () => {
      stopPlay2();
      cursor = 0;
      const step = Math.max(1, Math.floor(history.length / 120));
      playTimer2 = setInterval(() => {
        draw(cursor);
        cursor += step;
        if (cursor >= history.length) {
          draw(history.length - 1);
          stopPlay2();
        }
      }, 30);
    });
    document.getElementById("loss-reset").addEventListener("click", () => {
      stopPlay2();
      cursor = 0;
      draw(0);
    });
    logToggle.addEventListener("change", () => draw(Math.min(cursor, history.length - 1)));

    draw(history.length - 1);
  })();

  // ---------------------------------------------------------------
  // Section 3: translation + cross-attention
  // ---------------------------------------------------------------
  (function () {
    const items = DATA.translations;
    const select = document.getElementById("example-select");
    const SPLIT_LABEL = {
      train: { text: "학습 문장", cls: "train" },
      heldout: { text: "held-out", cls: "heldout-ok" },
      unused: { text: "미사용 조합", cls: "unused" },
    };

    items.forEach((item, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = item.source + "  (" + item.translation + ")";
      select.appendChild(opt);
    });

    function splitBadge(item) {
      if (item.split === "heldout" && item.note.indexOf("오역") !== -1) {
        return { text: "held-out(실패)", cls: "heldout-fail" };
      }
      return SPLIT_LABEL[item.split];
    }

    function renderTokens(container, tokens) {
      container.innerHTML = "";
      tokens.forEach((tok) => {
        const chip = document.createElement("span");
        chip.className = "token-chip";
        chip.textContent = tok;
        container.appendChild(chip);
      });
    }

    function weightColor(w) {
      const t = Math.min(1, Math.max(0, w));
      const r = Math.round(255 + (13 - 255) * t);
      const g = Math.round(255 + (148 - 255) * t);
      const b = Math.round(255 + (136 - 255) * t);
      return `rgb(${r},${g},${b})`;
    }

    function renderHeatmap(item) {
      const wrap = document.getElementById("heatmap-wrap");
      let html = "<table class='heatmap'><thead><tr><th></th>";
      item.source_tokens.forEach((tok) => {
        html += `<th>${tok}</th>`;
      });
      html += "</tr></thead><tbody>";
      item.generated_tokens.forEach((tok, r) => {
        html += `<tr><td class="row-label">${tok}</td>`;
        item.cross_attention[r].forEach((w) => {
          html += `<td style="background:${weightColor(w)}">${(w * 100).toFixed(1)}%</td>`;
        });
        html += "</tr>";
      });
      html += "</tbody></table>";
      wrap.innerHTML = html;
    }

    function run() {
      const item = items[Number(select.value)];
      renderTokens(document.getElementById("source-tokens"), item.source_tokens);

      const genHost = document.getElementById("gen-tokens");
      genHost.innerHTML = "";
      document.getElementById("heatmap-wrap").innerHTML = "";
      document.getElementById("translate-note").innerHTML = "";

      const chips = item.generated_tokens.map((tok) => {
        const chip = document.createElement("span");
        chip.className = "token-chip gen";
        chip.textContent = tok;
        genHost.appendChild(chip);
        return chip;
      });

      chips.forEach((chip, i) => {
        setTimeout(() => {
          chip.classList.add("shown");
          if (i === chips.length - 1) {
            setTimeout(() => {
              renderHeatmap(item);
              const badge = splitBadge(item);
              const isFail = badge.cls === "heldout-fail";
              document.getElementById("translate-note").innerHTML =
                `<div class="note-box ${isFail ? "fail" : "ok"}">` +
                `<span class="split-badge ${badge.cls}">${badge.text}</span> &nbsp;${item.note}</div>`;
            }, 250);
          }
        }, i * 450);
      });
    }

    document.getElementById("translate-run").addEventListener("click", run);
    run();
  })();
})();
