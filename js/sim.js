/* =========================================================================
   OT Cyber Incident Decision Lab — simulation engine
   See → Understand → Decide → Act → Recover, across 4 progressive stages
   ========================================================================= */

window.Sim = (function () {
  "use strict";

  var STEPS = ["see", "understand", "decide", "act", "recover"];
  var STEP_LABELS = { see: "SEE", understand: "UNDERSTAND", decide: "DECIDE", act: "ACT", recover: "RECOVER" };
  var LS_KEY = "otlab.sim.v1";

  var state = load();
  function load() {
    var base = {
      currentStage: 0,
      currentStep: "see",
      records: {},          // stageId -> { hypothesis, choice, score, ops, safety }
      complete: {}          // stageId -> true
    };
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        for (var k in base) if (saved[k] !== undefined) base[k] = saved[k];
      }
    } catch (e) { /* ignore */ }
    return base;
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function totals() {
    var ops = 0, safety = 0, score = 0, decided = 0;
    Object.keys(state.records).forEach(function (id) {
      var r = state.records[id];
      ops += r.ops || 0;
      safety += r.safety || 0;
      score += r.score || 0;
      if (r.choice) decided++;
    });
    return { ops: ops, safety: safety, score: score, decided: decided, maxScore: DATA.SCENARIOS.length * 100 };
  }

  function reset() {
    state.currentStage = 0;
    state.currentStep = "see";
    state.records = {};
    state.complete = {};
    save();
  }

  /* ---------------- stage helpers ---------------- */
  function scenario() { return DATA.SCENARIOS[state.currentStage]; }
  function isLastStage() { return state.currentStage === DATA.SCENARIOS.length - 1; }
  function isComplete() { return isLastStage() && state.currentStep === "recover" && state.records[scenario().id]; }

  function record() { return state.records[scenario().id]; }

  function stageDone(id) { return !!state.complete[id]; }

  function stepIndex() { return STEPS.indexOf(state.currentStep); }

  /* ---------------- actions ---------------- */
  function chooseHypothesis(id) {
    var sc = scenario();
    var hyp = sc.understand.hypotheses.filter(function (h) { return h.id === id; })[0];
    if (!hyp) return;
    var rec = record() || {};
    rec.hypothesis = id;
    state.records[sc.id] = rec;
    save();
    render();
  }

  function chooseOption(id) {
    var sc = scenario();
    var opt = sc.decide.options.filter(function (o) { return o.id === id; })[0];
    if (!opt) return;
    var rec = record() || {};
    rec.choice = id;
    rec.ops = opt.ops;
    rec.safety = opt.safety;
    rec.score = opt.score;
    rec.hypScore = 0;
    if (rec.hypothesis) {
      var hyp = sc.understand.hypotheses.filter(function (h) { return h.id === rec.hypothesis; })[0];
      rec.hypScore = hyp && hyp.correct ? 20 : 0;
      rec.score = opt.score + rec.hypScore;
    }
    state.records[sc.id] = rec;
    save();
    render();
  }

  function gotoStep(step) {
    if (STEPS.indexOf(step) < STEPS.indexOf(state.currentStep)) return; // no going back within a stage
    var rec = record() || {};
    // gates
    if (step === "decide" && !rec.hypothesis) return;
    if (step === "act" && !rec.choice) return;
    state.currentStep = step;
    save();
    render();
  }

  function advance() {
    var sc = scenario();
    var rec = record() || {};
    var idx = stepIndex();

    if (state.currentStep === "see") { gotoStep("understand"); return; }
    if (state.currentStep === "understand") { if (rec.hypothesis) gotoStep("decide"); return; }
    if (state.currentStep === "decide") { if (rec.choice) gotoStep("act"); return; }
    if (state.currentStep === "act") {
      if (!rec.choice) return;
      state.currentStep = "recover";
      state.complete[sc.id] = true;
      save();
      render();
      return;
    }
    if (state.currentStep === "recover") {
      if (!isLastStage()) {
        state.currentStage += 1;
        state.currentStep = "see";
        save();
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }
  }

  function gotoStage(index) {
    if (index < 0 || index >= DATA.SCENARIOS.length) return;
    // allow revisit of completed/current stages; future stages are locked until the current one is done
    if (index > state.currentStage && !stageDone(DATA.SCENARIOS[state.currentStage].id)) return;
    state.currentStage = index;
    state.currentStep = state.records[DATA.SCENARIOS[index].id] ? "act" : "see";
    save();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------- rendering ---------------- */
  function render() {
    var root = UTIL.el("lab-root");
    if (!root) return;
    if (isComplete() && state.currentStep === "recover") {
      root.innerHTML = renderDebrief();
    } else {
      root.innerHTML =
        '<div class="section-head">' +
          '<span class="kicker">Incident Lab · Stage ' + (state.currentStage + 1) + ' of ' + DATA.SCENARIOS.length + '</span>' +
          '<h2>Interactive OT Cyber Incident Simulation</h2>' +
          '<p class="sub">Work each scenario through the Decision &amp; Action Framework. Your choices shape the outcome.</p>' +
        '</div>' +
        '<div class="lab-wrap">' +
          renderRail() +
          renderStage() +
        '</div>';
    }
    bindLab();
    updateHeaderStatus();
  }

  function renderRail() {
    var t = totals();
    var opsMax = DATA.SCENARIOS.length * 3;
    var safetyMax = DATA.SCENARIOS.length * 3;
    var quality = UTIL.pct(t.score, t.maxScore);

    var stages = DATA.SCENARIOS.map(function (sc, i) {
      var cls = "stage-node";
      var stateTxt = "Locked";
      if (i === state.currentStage) { cls += " current"; stateTxt = "In progress"; }
      else if (stageDone(sc.id)) { cls += " done"; stateTxt = "Complete"; }
      else if (i > state.currentStage) { cls += " locked"; }
      else { stateTxt = "Available"; }
      return '<div class="stage-node ' + cls + '" data-stage="' + i + '">' +
        '<span class="sn-num">' + (i + 1) + '</span>' +
        '<div><div class="sn-title">' + UTIL.esc(sc.title) + '</div>' +
        '<div class="sn-time">' + sc.time + ' · ' + sc.duration + '</div>' +
        '<div class="sn-state">' + stateTxt + '</div></div>' +
      '</div>';
    }).join("");

    return '<aside class="lab-rail">' +
      '<div class="rail-card"><div class="meter-block" style="margin-top:0">' +
        '<div class="meter-label"><span>SCENARIOS</span></div></div>' +
        '<div class="stage-list">' + stages + '</div></div>' +
      '<div class="rail-card"><div class="meter-label" style="margin-bottom:12px"><span style="font-family:var(--mono);letter-spacing:1.5px;font-size:10.5px">CUMULATIVE IMPACT</span></div>' +
        meterBlock("Operational impact", t.ops, opsMax, "ops", t.ops + " / " + opsMax) +
        meterBlock("Safety impact", t.safety, safetyMax, "safety", t.safety + " / " + safetyMax) +
        meterBlock("Decision quality", quality, 100, "quality", quality + "%") +
      '</div>' +
      '<div class="rail-card"><div class="impact-chip">◈ Framework: See → Understand → Decide → Act → Recover</div></div>' +
    '</aside>';
  }

  function meterBlock(label, val, max, kind, text) {
    var p = Math.min(100, UTIL.pct(val, max));
    return '<div class="meter-block">' +
      '<div class="meter-label"><span>' + label + '</span><span class="meter-num">' + text + '</span></div>' +
      '<div class="meter"><div class="meter-bar ' + kind + '" style="width:' + p + '%"></div></div>' +
    '</div>';
  }

  function renderStage() {
    var sc = scenario();
    var rec = record() || {};

    var tabs = STEPS.map(function (s, i) {
      var cls = "step-tab";
      var lock = false;
      if (s === state.currentStep) cls += " active";
      if (s === "understand" && !rec.hypothesis && state.currentStep !== "understand") { /* fine */ }
      if (s === "decide" && !rec.hypothesis) lock = true;
      if (s === "act" && !rec.choice) lock = true;
      if (i > stepIndex()) lock = true;
      if (lock) cls += " locked";
      var reached = false;
      if (s === "see" && state.currentStep !== "see") reached = true;
      if (s === "understand" && ["decide", "act", "recover"].indexOf(state.currentStep) !== -1) reached = true;
      if (s === "decide" && ["act", "recover"].indexOf(state.currentStep) !== -1) reached = true;
      if (s === "act" && state.currentStep === "recover") reached = true;
      if (reached) cls += " done";
      return '<button class="' + cls + '" data-step="' + s + '"><span class="st-num">' + (i + 1) + '</span>' + STEP_LABELS[s] + '</button>';
    }).join("");

    var panel = "";
    switch (state.currentStep) {
      case "see": panel = renderSee(sc); break;
      case "understand": panel = renderUnderstand(sc, rec); break;
      case "decide": panel = renderDecide(sc, rec); break;
      case "act": panel = renderAct(sc, rec); break;
      case "recover": panel = renderRecover(sc, rec); break;
    }

    return '<div class="lab-stage">' +
      '<div class="lab-stage-head">' +
        '<span class="stage-badge ' + sc.severityClass + '">' + sc.severity + '</span>' +
        '<h2>Stage ' + sc.num + ' · ' + UTIL.esc(sc.title) + '</h2>' +
        '<span class="clock mono">' + sc.time + ' <span class="muted">·</span> ' + UTIL.esc(sc.tag) + '</span>' +
      '</div>' +
      '<div class="step-tabs">' + tabs + '</div>' +
      '<div class="step-panel">' + panel + renderLabNav(sc, rec) + '</div>' +
    '</div>';
  }

  function renderLabNav(sc, rec) {
    var back = "";
    if (state.currentStep === "see" && state.currentStage > 0) {
      back = '<button class="btn btn-ghost" data-nav="back">← Previous stage</button>';
    }
    var next = "";
    if (state.currentStep === "see") next = '<button class="btn btn-primary" data-nav="next">Investigate → Understand</button>';
    if (state.currentStep === "understand") next = '<button class="btn btn-primary" data-nav="next" ' + (rec.hypothesis ? "" : "disabled") + '>Lock hypothesis → Decide</button>';
    if (state.currentStep === "decide") next = '<button class="btn btn-primary" data-nav="next" ' + (rec.choice ? "" : "disabled") + '>Take action → Act</button>';
    if (state.currentStep === "act") next = '<button class="btn btn-primary" data-nav="next">Move to recovery →</button>';
    if (state.currentStep === "recover") next = isLastStage() ? '<button class="btn btn-primary" data-nav="next">View incident debrief</button>' : '<button class="btn btn-primary" data-nav="next">Next scenario →</button>';
    return '<div class="lab-nav">' + back + '<span></span>' + next + '</div>';
  }

  /* ---------------- step panels ---------------- */
  function renderSee(sc) {
    var metrics = sc.see.metrics.map(function (m) {
      return '<div class="metric-tile"><div class="mt-label">' + UTIL.esc(m.label) + '</div>' +
        '<div class="mt-value ' + m.tone + '">' + UTIL.esc(m.value) + '</div>' +
        '<div class="mt-hint">' + UTIL.esc(m.hint) + '</div></div>';
    }).join("");

    var logs = sc.see.logs.map(function (l) {
      return '<div class="log-line"><span class="log-ts">' + l.ts + '</span><span class="log-lvl ' + l.lvl + '">' + l.lvl.toUpperCase() + '</span><span class="log-msg">' + l.msg + '</span></div>';
    }).join("");

    return '<p class="sp-title">1 · SEE — what do you observe?</p>' +
      '<p class="sp-sub">' + UTIL.esc(sc.see.headline) + '</p>' +
      '<div class="metrics">' + metrics + '</div>' +
      '<div class="terminal"><div class="terminal-head"><span>OT-SIEM · real-time event feed</span><span class="ok">● LIVE</span></div>' +
      '<div class="terminal-body">' + logs + '</div></div>' +
      '<p class="muted" style="margin-top:12px">' + UTIL.esc(sc.see.note) + '</p>';
  }

  function renderUnderstand(sc, rec) {
    var triage = sc.understand.triage.map(function (t, i) {
      return '<div class="triage-item" data-triage="' + i + '">' +
        '<button class="triage-q">' + UTIL.esc(t.q) + '<span class="tq-caret">▸</span></button>' +
        '<div class="triage-a">' + UTIL.esc(t.a) + '<div class="signal ' + (t.hot ? "hot" : "") + '" style="margin-top:8px">SIGNAL · ' + UTIL.esc(t.signal) + '</div></div>' +
      '</div>';
    }).join("");

    var hyps = sc.understand.hypotheses.map(function (h) {
      var cls = "choice";
      if (rec.hypothesis === h.id) cls += " selected";
      return '<button class="' + cls + '" data-hyp="' + h.id + '"><span class="ch-key">' + h.id.toUpperCase().replace("H", "") + '</span><span>' + UTIL.esc(h.text) + '</span></button>';
    }).join("");

    return '<p class="sp-title">2 · UNDERSTAND — triage &amp; form a hypothesis</p>' +
      '<p class="sp-sub">' + UTIL.esc(sc.understand.briefing) + '</p>' +
      '<div class="triage">' + triage + '</div>' +
      '<p style="font-weight:700;margin:16px 0 4px">Working hypothesis — what do you think is happening?</p>' +
      '<div class="choice-list">' + hyps + '</div>';
  }

  function renderDecide(sc, rec) {
    var opts = sc.decide.options.map(function (o) {
      var cls = "decision-card";
      if (rec.choice === o.id) cls += " selected";
      var risks = o.riskTags.map(function (r) { return '<span class="risk-badge">' + UTIL.esc(r) + '</span>'; }).join("");
      return '<div class="' + cls + '" data-opt="' + o.id + '">' +
        '<div class="dc-head"><span class="dc-key">' + o.id + '</span><span class="dc-title">' + UTIL.esc(o.label) + '</span></div>' +
        '<div class="dc-detail">' + UTIL.esc(o.detail) + '</div>' +
        '<div class="dc-tradeoff"><b>Trade-off:</b> ' + UTIL.esc(o.tradeoff) + '</div>' +
        '<div class="dc-risk">' + risks + '</div>' +
      '</div>';
    }).join("");

    return '<p class="sp-title">3 · DECIDE — weigh the trade-offs</p>' +
      '<p class="sp-sub">' + UTIL.esc(sc.decide.prompt) + ' There is no perfect answer — only trade-offs between containment, operations, and safety.</p>' +
      '<div class="choice-list">' + opts + '</div>';
  }

  function renderAct(sc, rec) {
    var opt = sc.decide.options.filter(function (o) { return o.id === rec.choice; })[0];
    if (!opt) return "";
    var tone = opt.good ? "good" : (opt.score >= 45 ? "neutral" : "bad");
    var title = opt.good ? "Strong response" : (opt.score >= 45 ? "Partial response" : "High-risk response");

    // hypothesis verdict
    var hyp = null;
    if (rec.hypothesis) hyp = sc.understand.hypotheses.filter(function (h) { return h.id === rec.hypothesis; })[0];
    var hypBox = "";
    if (hyp) {
      var hcls = hyp.correct ? "good" : "bad";
      var htxt = hyp.correct ? "Hypothesis correct · +20" : "Hypothesis off-track · +0";
      hypBox = '<div class="reveal-box ' + hcls + '" style="margin-bottom:12px"><div class="reveal-title">' + htxt + '</div>' + UTIL.esc(hyp.note) + '</div>';
    }

    var meters =
      meterBlock("Operational impact", opt.ops, 3, "ops", ["None", "Low", "High", "Severe"][opt.ops]) +
      meterBlock("Safety impact", opt.safety, 3, "safety", ["None", "Low", "High", "Severe"][opt.safety]);

    return '<p class="sp-title">4 · ACT — consequence of your decision</p>' +
      '<p class="sp-sub">You chose <strong>' + UTIL.esc(opt.label) + '</strong>. Here is what happened.</p>' +
      '<div class="reveal-box ' + tone + '"><div class="reveal-title">' + title + '</div>' + UTIL.esc(opt.consequence) + '</div>' +
      hypBox +
      '<div class="grid grid-2" style="margin:6px 0">' + meters + '</div>' +
      '<div class="expert-box"><span class="eb-label">Expert debrief</span>' + UTIL.esc(opt.expert) + '</div>';
  }

  function renderRecover(sc, rec) {
    var steps = sc.recover.steps.map(function (s, i) {
      return '<li><span class="rc-num">' + String(i + 1).padStart(2, "0") + '</span><span>' + UTIL.esc(s) + '</span></li>';
    }).join("");
    return '<p class="sp-title">5 · RECOVER — restore &amp; learn</p>' +
      '<p class="sp-sub">Containment is not the end. These are the recovery and hardening actions to close the loop.</p>' +
      '<ul class="recover-list">' + steps + '</ul>' +
      '<div class="lesson-box"><b>Lesson:</b> ' + UTIL.esc(sc.recover.lesson) + '</div>' +
      '<div class="lesson-box" style="border-color:rgba(245,166,35,0.4)"><b>Maturity gap exposed:</b> ' + UTIL.esc(sc.recover.gap) + '</div>';
  }

  /* ---------------- debrief ---------------- */
  function renderDebrief() {
    var t = totals();
    var quality = UTIL.pct(t.score, t.maxScore);
    var badge, badgeCls, blurb;
    if (quality >= 85) { badge = "GOLD"; badgeCls = "tier-4"; blurb = "Disciplined, OT-aware decision-making. You consistently chose containment and integrity actions that preserved operations and safety."; }
    else if (quality >= 70) { badge = "SILVER"; badgeCls = "tier-3"; blurb = "Strong instincts with a few avoidable trade-offs. Review the expert notes on the choices that cost you points."; }
    else if (quality >= 55) { badge = "BRONZE"; badgeCls = "tier-2"; blurb = "You contained the worst outcomes but left value on the table — often by waiting, or acting on unverified information."; }
    else { badge = "NEEDS WORK"; badgeCls = "tier-1"; blurb = "Several high-risk choices. Re-run the lab and compare against the expert rationale — the difference is usually speed, integrity-first thinking, and segmentation."; }

    var log = DATA.SCENARIOS.map(function (sc) {
      var r = state.records[sc.id];
      if (!r) return "";
      var opt = sc.decide.options.filter(function (o) { return o.id === r.choice; })[0];
      var pillCls = opt.good ? "good" : (opt.score >= 45 ? "mid" : "bad");
      var pillTxt = opt.good ? "STRONG" : (opt.score >= 45 ? "PARTIAL" : "RISKY");
      var hyp = sc.understand.hypotheses.filter(function (h) { return h.id === r.hypothesis; })[0];
      return '<div class="dl-item"><span class="dl-stage">S' + sc.num + '</span>' +
        '<span style="flex:1">' + UTIL.esc(opt.label) + '</span>' +
        (hyp && hyp.correct ? '<span class="dl-pill good" title="hypothesis correct">HYP ✓</span>' : '<span class="dl-pill bad" title="hypothesis off">HYP ✗</span>') +
        '<span class="dl-pill ' + pillCls + '">' + pillTxt + '</span></div>';
    }).join("");

    return '<div class="section-head">' +
      '<span class="kicker">Incident debrief</span><h2>Simulation Complete — Decision Review</h2>' +
      '<p class="sub">Four stages, four decisions. Here is how you performed and what to take back to your organisation.</p></div>' +
      '<div class="debrief-grid">' +
        '<div class="card"><div class="card-head"><span class="card-kicker">Decision quality</span><h3>Response grade</h3></div>' +
          '<div class="card-body"><div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">' +
            '<div class="score-ring" style="width:120px;height:120px">' + ringSVG(quality) + '</div>' +
            '<div><span class="tier-badge ' + badgeCls + '">' + badge + '</span>' +
            '<p class="muted" style="margin:10px 0 0;max-width:280px">' + blurb + '</p></div>' +
          '</div>' +
          '<div class="meter-block" style="margin-top:16px">' + meterBlock("Decision quality", quality, 100, "quality", quality + "%") + '</div>' +
          '<div class="meter-block">' + meterBlock("Operational impact (cumulative)", t.ops, 12, "ops", t.ops + " / 12") + '</div>' +
          '<div class="meter-block">' + meterBlock("Safety impact (cumulative)", t.safety, 12, "safety", t.safety + " / 12") + '</div></div>' +
        '</div>' +
        '<div class="card"><div class="card-head"><span class="card-kicker">Your decisions</span><h3>Decision log</h3></div>' +
          '<div class="card-body"><div class="decision-log">' + log + '</div>' +
          '<p class="muted" style="margin-top:10px;font-size:12.5px">Scored out of 100 per stage: 80 for the action + 20 for a correct hypothesis.</p></div>' +
        '</div>' +
      '</div>' +
      '<div class="grid grid-2" style="margin-top:16px">' +
        '<div class="card"><div class="card-head"><span class="card-kicker">Key takeaways</span><h3>What the lab teaches</h3></div><div class="card-body"><ul class="tick-list">' +
          '<li>Containment must sever the live path <em>and</em> the shared identity — not just an IP.</li>' +
          '<li>PLC logic is the crown jewel: changes must be authorised, verified and detected.</li>' +
          '<li>AI accelerates both sides — keep humans accountable for OT decisions.</li>' +
          '<li>A false air-gap is the most expensive assumption in OT security.</li>' +
        '</ul></div></div>' +
        '<div class="card"><div class="card-head"><span class="card-kicker">Next</span><h3>Turn lessons into action</h3></div><div class="card-body">' +
          '<p class="muted" style="margin:0 0 12px">Assess your program, then build the roadmap.</p>' +
          '<button class="btn btn-primary" data-goto="maturity">Assess maturity →</button> ' +
          '<button class="btn btn-ghost" data-goto="report">View full report</button>' +
        '</div></div>' +
      '</div>' +
      '<div class="lab-nav"><button class="btn btn-ghost" data-nav="restart">↻ Re-run the lab</button><span></span></div>';
  }

  function ringSVG(pct) {
    var r = 46, c = 2 * Math.PI * r;
    var dash = (pct / 100) * c;
    var col = pct >= 70 ? "#22c55e" : pct >= 55 ? "#f5a623" : "#ef4444";
    return '<svg viewBox="0 0 120 120" width="120" height="120">' +
      '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="#1d2a3d" stroke-width="10"/>' +
      '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + dash + ' ' + c + '" transform="rotate(-90 60 60)"/>' +
      '<text x="60" y="60" text-anchor="middle" dominant-baseline="central" fill="#e6edf5" font-size="24" font-weight="700" font-family="ui-monospace,monospace">' + pct + '%</text>' +
    '</svg>';
  }

  function updateHeaderStatus() {
    var dot = UTIL.el("statusDot");
    var txt = UTIL.el("statusText");
    if (!dot) return;
    if (state.currentStep !== "see" && state.currentStep !== "recover") {
      dot.classList.add("hot");
      if (txt) txt.textContent = "INCIDENT ACTIVE";
    } else {
      dot.classList.remove("hot");
      if (txt) txt.textContent = isComplete() ? "DEBRIEF" : "LAB READY";
    }
  }

  /* ---------------- event binding ---------------- */
  function bindLab() {
    var root = UTIL.el("lab-root");
    if (!root) return;

    root.querySelectorAll("[data-stage]").forEach(function (n) {
      n.addEventListener("click", function () { gotoStage(parseInt(n.getAttribute("data-stage"), 10)); });
    });
    root.querySelectorAll("[data-step]").forEach(function (n) {
      n.addEventListener("click", function () {
        var s = n.getAttribute("data-step");
        if (n.classList.contains("locked")) return;
        gotoStep(s);
      });
    });
    root.querySelectorAll("[data-hyp]").forEach(function (n) {
      n.addEventListener("click", function () { chooseHypothesis(n.getAttribute("data-hyp")); });
    });
    root.querySelectorAll("[data-opt]").forEach(function (n) {
      n.addEventListener("click", function () { chooseOption(n.getAttribute("data-opt")); });
    });
    root.querySelectorAll("[data-nav]").forEach(function (n) {
      n.addEventListener("click", function () {
        var v = n.getAttribute("data-nav");
        if (v === "next") advance();
        else if (v === "back") { state.currentStage = Math.max(0, state.currentStage - 1); state.currentStep = "recover"; save(); render(); }
        else if (v === "restart") { reset(); render(); }
      });
    });
    root.querySelectorAll("[data-triage]").forEach(function (n) {
      n.querySelector(".triage-q").addEventListener("click", function () {
        n.classList.toggle("open");
      });
    });
    root.querySelectorAll("[data-goto]").forEach(function (n) {
      n.addEventListener("click", function () { window.App && App.go(n.getAttribute("data-goto")); });
    });
  }

  /* expose */
  return {
    render: render,
    reset: reset,
    totals: totals,
    state: state,
    isComplete: isComplete,
    gotoStep: gotoStep,
    gotoStage: gotoStage,
    advance: advance,
    chooseHypothesis: chooseHypothesis,
    chooseOption: chooseOption
  };
})();
