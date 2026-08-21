/* =========================================================================
   OT Cyber Incident Decision Lab — application shell
   Navigation, audit checklist, roadmap, resources, facilitator guide, report
   ========================================================================= */

window.App = (function () {
  "use strict";

  var AUDIT_KEY = "otlab.audit.v1";
  var roadmapFilter = "all";

  var auditState = loadAudit();
  function loadAudit() {
    try {
      var raw = localStorage.getItem(AUDIT_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { checked: {} };
  }
  function saveAudit() {
    try { localStorage.setItem(AUDIT_KEY, JSON.stringify(auditState)); } catch (e) { /* ignore */ }
  }

  var VIEWS = ["overview", "lab", "maturity", "audit", "roadmap", "frameworks", "facilitator", "report"];

  /* ---------------- navigation ---------------- */
  function go(view) {
    if (VIEWS.indexOf(view) === -1) view = "overview";
    VIEWS.forEach(function (v) {
      var s = UTIL.el("view-" + v);
      if (s) s.classList.toggle("active", v === view);
    });
    document.querySelectorAll(".nav-item").forEach(function (n) {
      n.classList.toggle("active", n.getAttribute("data-view") === view);
    });
    // render dynamic views on entry
    if (view === "lab") Sim.render();
    if (view === "maturity") Assess.render();
    if (view === "audit") renderAudit();
    if (view === "roadmap") renderRoadmap();
    if (view === "frameworks") renderFrameworks();
    if (view === "facilitator") renderFacilitator();
    if (view === "report") renderReport();
    if (view !== "lab") setStatus(false, "LAB READY");
    try { history.replaceState(null, "", "#" + view); } catch (e) { /* ignore */ }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setStatus(hot, text) {
    var dot = UTIL.el("statusDot");
    var txt = UTIL.el("statusText");
    if (dot) dot.classList.toggle("hot", hot);
    if (txt) txt.textContent = text;
  }

  /* ---------------- audit ---------------- */
  function auditTotals() {
    var total = 0, checked = 0;
    DATA.AUDIT_CATEGORIES.forEach(function (c) {
      c.items.forEach(function (_, i) {
        total++;
        if (auditState.checked[c.id + "-" + i]) checked++;
      });
    });
    return { total: total, checked: checked, pct: UTIL.pct(checked, total) };
  }

  function renderAudit() {
    var root = UTIL.el("audit-root");
    if (!root) return;
    var t = auditTotals();

    var cats = DATA.AUDIT_CATEGORIES.map(function (c) {
      var items = c.items.map(function (it, i) {
        var key = c.id + "-" + i;
        var on = !!auditState.checked[key];
        var maps = it.maps.map(function (m) { return '<span class="map-chip">' + UTIL.esc(m) + '</span>'; }).join("");
        return '<div class="check-item' + (on ? " checked" : "") + '" data-check="' + key + '">' +
          '<span class="ci-check">✓</span>' +
          '<div class="ci-body"><div class="ci-title">' + UTIL.esc(it.control) + '</div>' +
          '<div class="ci-evidence"><b>Evidence:</b> ' + UTIL.esc(it.evidence) + '</div>' +
          '<div class="ci-maps">' + maps + '</div></div>' +
        '</div>';
      }).join("");
      return '<div class="audit-category"><h3>' + c.name + ' <span class="muted" style="font-weight:400;font-size:12px">(' + c.items.length + ' controls)</span></h3></div>' + items;
    }).join("");

    var regRows = DATA.REGULATIONS.map(function (r) {
      return '<tr><td>' + r.name + '</td><td>' + UTIL.esc(r.scope) + '</td><td>' + UTIL.esc(r.focus) + '</td><td>' + UTIL.esc(r.relevance) + '</td></tr>';
    }).join("");

    var findings = DATA.COMMON_FINDINGS.map(function (f) {
      return '<div class="finding-item">⚠ ' + UTIL.esc(f) + '</div>';
    }).join("");

    root.innerHTML =
      '<div class="section-head"><span class="kicker">Audit guidelines</span>' +
      '<h2>Audit-readiness &amp; Regulatory Expectations</h2>' +
      '<p class="sub">Tick the controls you can evidence today. Your readiness score updates live — and each control is mapped to the frameworks an auditor will ask about.</p></div>' +

      '<div class="audit-hero">' +
        statPill(t.checked + " / " + t.total, "controls evidenced") +
        statPill(t.pct + "%", "audit readiness") +
        statPill(DATA.AUDIT_CATEGORIES.length + "", "control domains") +
      '</div>' +

      '<div class="meter-block" style="max-width:520px;margin-bottom:8px">' +
        '<div class="meter"><div class="meter-bar quality" style="width:' + t.pct + '%"></div></div>' +
      '</div>' +

      cats +

      '<div class="card" style="margin-top:24px"><div class="card-head"><span class="card-kicker">Regulatory expectations</span><h3>Frameworks an auditor will reference</h3></div>' +
      '<div class="card-body" style="overflow-x:auto"><table class="reg-table"><thead><tr><th>Framework</th><th>Scope</th><th>Focus</th><th>Relevance</th></tr></thead><tbody>' + regRows + '</tbody></table></div></div>' +

      '<div class="card" style="margin-top:16px"><div class="card-head"><span class="card-kicker">Heads up</span><h3>Common OT audit findings</h3></div>' +
      '<div class="card-body">' + findings + '</div></div>' +

      '<div class="lab-nav"><button class="btn btn-ghost" data-goto="maturity">← Back to Maturity</button>' +
      '<button class="btn btn-primary" data-goto="roadmap">Build the Roadmap →</button></div>';

    bindAudit(root);
  }

  function statPill(num, label) {
    return '<div class="stat-pill"><div class="sp-num">' + num + '</div><div class="sp-lbl">' + label + '</div></div>';
  }

  function bindAudit(root) {
    root.querySelectorAll("[data-check]").forEach(function (n) {
      n.addEventListener("click", function () {
        var key = n.getAttribute("data-check");
        if (auditState.checked[key]) delete auditState.checked[key];
        else auditState.checked[key] = true;
        saveAudit();
        renderAudit();
      });
    });
    root.querySelectorAll("[data-goto]").forEach(function (n) {
      n.addEventListener("click", function () { go(n.getAttribute("data-goto")); });
    });
  }

  /* ---------------- roadmap ---------------- */
  function roadmapDomains() {
    var set = {};
    DATA.QUICK_WINS.concat(DATA.STRATEGIC).forEach(function (i) { set[i.domain] = true; });
    return ["all"].concat(Object.keys(set).sort());
  }

  function renderRoadmap() {
    var root = UTIL.el("roadmap-root");
    if (!root) return;

    var chips = roadmapDomains().map(function (d) {
      return '<button class="domain-chip' + (roadmapFilter === d ? " active" : "") + '" data-filter="' + d + '">' + (d === "all" ? "All domains" : d) + '</button>';
    }).join("");

    var quick = DATA.QUICK_WINS.filter(function (i) { return roadmapFilter === "all" || i.domain === roadmapFilter; })
      .map(rmItem).join("");
    var strategic = DATA.STRATEGIC.filter(function (i) { return roadmapFilter === "all" || i.domain === roadmapFilter; })
      .map(rmItem).join("");

    var phases = DATA.ROADMAP_PHASES.map(function (p) {
      var items = p.items.map(function (i) { return "<li>" + UTIL.esc(i) + "</li>"; }).join("");
      return '<div class="phase"><div class="ph-label">' + p.phase + '</div>' +
        '<div class="ph-body"><div class="ph-title">' + UTIL.esc(p.title) + '</div><ul>' + items + '</ul></div></div>';
    }).join("");

    root.innerHTML =
      '<div class="section-head"><span class="kicker">Cybersecurity maturity roadmap</span>' +
      '<h2>Quick Wins vs Strategic Initiatives</h2>' +
      '<p class="sub">Sequence the work: 90-day quick wins build momentum and close the most dangerous gaps; strategic initiatives build durable capability.</p></div>' +

      '<div class="roadmap-tabs">' + chips + '</div>' +

      '<div class="roadmap-cols">' +
        '<div><div class="col-head"><span class="ch-badge ch-quick">Quick wins · 0–90 days</span></div>' + (quick || '<div class="muted">No items in this filter.</div>') + '</div>' +
        '<div><div class="col-head"><span class="ch-badge ch-strategic">Strategic · 3–18 months</span></div>' + (strategic || '<div class="muted">No items in this filter.</div>') + '</div>' +
      '</div>' +

      '<div class="card" style="margin-top:20px"><div class="card-head"><span class="card-kicker">Phased plan</span><h3>18-month maturity timeline</h3></div>' +
      '<div class="card-body"><div class="timeline">' + phases + '</div></div></div>' +

      '<div class="lab-nav"><button class="btn btn-ghost" data-goto="audit">← Back to Audit</button>' +
      '<button class="btn btn-primary" data-goto="frameworks">Resources &amp; next steps →</button></div>';

    root.querySelectorAll("[data-filter]").forEach(function (n) {
      n.addEventListener("click", function () {
        roadmapFilter = n.getAttribute("data-filter");
        renderRoadmap();
      });
    });
    root.querySelectorAll("[data-goto]").forEach(function (n) {
      n.addEventListener("click", function () { go(n.getAttribute("data-goto")); });
    });
  }

  function rmItem(i) {
    var eff = i.effort === "Low" ? "effort-low" : i.effort === "Medium" ? "effort-med" : "effort-high";
    return '<div class="rm-item"><div class="rm-title">' + UTIL.esc(i.title) + '<span class="muted" style="font-weight:400;font-size:12px">' + UTIL.esc(i.domain) + '</span></div>' +
      '<div class="rm-desc">' + UTIL.esc(i.desc) + '</div>' +
      '<div class="rm-meta"><span class="rm-pill ' + eff + '">Effort: ' + i.effort + '</span><span class="rm-pill">Impact: ' + i.impact + '</span></div></div>';
  }

  /* ---------------- frameworks ---------------- */
  function renderFrameworks() {
    var root = UTIL.el("frameworks-root");
    if (!root) return;

    var cards = DATA.FRAMEWORKS.map(function (f) {
      return '<div class="fw-card"><div class="fw-org">' + UTIL.esc(f.org) + '</div>' +
        '<div class="fw-name">' + UTIL.esc(f.name) + '</div>' +
        '<div class="fw-focus">' + UTIL.esc(f.focus) + '</div>' +
        '<div class="fw-rel">Why it matters: ' + UTIL.esc(f.relevance) + '</div>' +
        '<a class="fw-link" href="' + UTIL.esc(f.url) + '" target="_blank" rel="noopener">Reference ↗</a></div>';
    }).join("");

    var steps = DATA.NEXT_STEPS.map(function (s, i) {
      return '<div class="ns-item"><span class="ns-num">' + String(i + 1).padStart(2, "0") + '</span><span>' + UTIL.esc(s) + '</span></div>';
    }).join("");

    root.innerHTML =
      '<div class="section-head"><span class="kicker">Resources &amp; frameworks</span>' +
      '<h2>Reference Frameworks &amp; Practical Next Steps</h2>' +
      '<p class="sub">Anchor your program in recognised standards and prioritise the first moves after this lab.</p></div>' +

      '<div class="frameworks-grid">' + cards + '</div>' +

      '<div class="card" style="margin-top:22px"><div class="card-head"><span class="card-kicker">Action plan</span><h3>Practical next steps</h3></div>' +
      '<div class="card-body"><div class="next-steps">' + steps + '</div></div></div>' +

      '<div class="lab-nav"><button class="btn btn-ghost" data-goto="roadmap">← Back to Roadmap</button>' +
      '<button class="btn btn-primary" data-goto="report">View your report →</button></div>';

    root.querySelectorAll("[data-goto]").forEach(function (n) {
      n.addEventListener("click", function () { go(n.getAttribute("data-goto")); });
    });
  }

  /* ---------------- facilitator ---------------- */
  function renderFacilitator() {
    var root = UTIL.el("facilitator-root");
    if (!root) return;

    var rows = DATA.RUN_OF_SHOW.map(function (r) {
      var prompts = r.prompts.map(function (p) { return '<li>' + UTIL.esc(p) + '</li>'; }).join("");
      return '<tr><td class="rt-time">' + r.time + '</td><td><strong>' + UTIL.esc(r.section) + '</strong><div class="muted" style="margin-top:4px">' + UTIL.esc(r.what) + '</div><ul class="prompt-list" style="margin-top:6px">' + prompts + '</ul></td></tr>';
    }).join("");

    var tips = DATA.FACILITATOR_TIPS.map(function (t) { return '<li>' + UTIL.esc(t) + '</li>'; }).join("");

    root.innerHTML =
      '<div class="section-head"><span class="kicker">Facilitator guide</span>' +
      '<h2>How to run the 45-minute lab</h2>' +
      '<p class="sub">A ready-to-deliver run of show with timings, facilitation notes, and discussion prompts.</p></div>' +

      '<div class="card"><div class="card-head"><span class="card-kicker">Run of show</span><h3>45-minute agenda</h3></div>' +
      '<div class="card-body" style="overflow-x:auto"><table class="run-table"><thead><tr><th>Time</th><th>What happens</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +

      '<div class="card" style="margin-top:16px"><div class="card-head"><span class="card-kicker">Facilitation tips</span><h3>Getting the most from the room</h3></div>' +
      '<div class="card-body"><ul class="prompt-list">' + tips + '</ul></div></div>' +

      '<div class="lab-nav"><button class="btn btn-ghost" data-goto="overview">← Back to Overview</button>' +
      '<button class="btn btn-primary" data-goto="lab">Launch the Incident Lab →</button></div>';

    root.querySelectorAll("[data-goto]").forEach(function (n) {
      n.addEventListener("click", function () { go(n.getAttribute("data-goto")); });
    });
  }

  /* ---------------- report ---------------- */
  function renderReport() {
    var root = UTIL.el("report-root");
    if (!root) return;

    var sim = Sim.totals();
    var quality = UTIL.pct(sim.score, sim.maxScore);
    var anyLab = sim.decided > 0;

    // Lab section
    var labHtml = "";
    if (anyLab) {
      var log = DATA.SCENARIOS.map(function (sc) {
        var r = Sim.state.records[sc.id];
        if (!r || !r.choice) return "";
        var opt = sc.decide.options.filter(function (o) { return o.id === r.choice; })[0];
        var pillCls = opt.good ? "good" : (opt.score >= 45 ? "mid" : "bad");
        var pillTxt = opt.good ? "STRONG" : (opt.score >= 45 ? "PARTIAL" : "RISKY");
        return '<div class="dl-item"><span class="dl-stage">S' + sc.num + '</span><span style="flex:1">' + UTIL.esc(opt.label) + '</span><span class="dl-pill ' + pillCls + '">' + pillTxt + '</span></div>';
      }).join("");
      labHtml =
        '<div class="report-block"><h3><span class="rb-tag">01</span>Incident Lab — Decision Review</h3>' +
        '<div class="audit-hero">' +
          statPill(quality + "%", "decision quality") +
          statPill(sim.decided + " / 4", "scenarios decided") +
          statPill(sim.ops + " / 12", "operational impact") +
          statPill(sim.safety + " / 12", "safety impact") +
        '</div><div class="decision-log">' + log + '</div></div>';
    } else {
      labHtml = '<div class="report-block"><h3><span class="rb-tag">01</span>Incident Lab</h3>' +
        '<p class="muted">No decisions recorded yet. <a href="#lab" style="color:var(--accent)">Run the Incident Lab</a> to populate this section.</p></div>';
    }

    // Maturity section
    var ov = Assess.overall();
    var tierObj = Assess.tier(ov);
    var gaps = DATA.DOMAINS.slice().sort(function (a, b) { return Assess.domainScore(a.id) - Assess.domainScore(b.id); }).slice(0, 3);
    var gapList = gaps.map(function (d) {
      var s = Assess.domainScore(d.id);
      return '<div class="gap-item"><span class="g-name">' + d.name + '</span><span class="g-bar"><span class="g-fill" style="width:' + s + '%;background:' + (s >= 50 ? "#22c55e" : s >= 25 ? "#f5a623" : "#ef4444") + '"></span></span><span class="g-pct">' + s + '%</span></div>';
    }).join("");
    var maturityHtml =
      '<div class="report-block"><h3><span class="rb-tag">02</span>Maturity Assessment</h3>' +
      '<div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">' +
        '<div>' + Assess.ringSVG(ov) + '</div>' +
        '<div style="flex:1;min-width:240px">' +
          '<span class="tier-badge ' + tierObj.cls + '">' + tierObj.name + ' · ' + ov + '%</span>' +
          '<div class="gap-list" style="margin-top:12px">' + gapList + '</div>' +
        '</div></div></div>';

    // Audit section
    var at = auditTotals();
    var auditHtml =
      '<div class="report-block"><h3><span class="rb-tag">03</span>Audit Readiness</h3>' +
      '<div class="audit-hero">' +
        statPill(at.pct + "%", "readiness") +
        statPill(at.checked + " / " + at.total, "controls evidenced") +
      '</div>' +
      '<p class="muted">Framework alignment: NERC CIP · IEC 62443 · NIST CSF 2.0 · NIS2 · NIST AI RMF.</p></div>';

    // Roadmap section
    var roadmapHtml =
      '<div class="report-block"><h3><span class="rb-tag">04</span>Prioritised Roadmap</h3>' +
      '<div class="roadmap-cols">' +
        '<div><div class="col-head"><span class="ch-badge ch-quick">Quick wins · 0–90 days</span></div>' +
        DATA.QUICK_WINS.slice(0, 4).map(rmItem).join("") + '</div>' +
        '<div><div class="col-head"><span class="ch-badge ch-strategic">Strategic · 3–18 months</span></div>' +
        DATA.STRATEGIC.slice(0, 4).map(rmItem).join("") + '</div>' +
      '</div></div>';

    // Next steps
    var nextHtml = '<div class="report-block"><h3><span class="rb-tag">05</span>Next Steps</h3><div class="next-steps">' +
      DATA.NEXT_STEPS.slice(0, 4).map(function (s, i) { return '<div class="ns-item"><span class="ns-num">' + String(i + 1).padStart(2, "0") + '</span><span>' + UTIL.esc(s) + '</span></div>'; }).join("") +
      '</div></div>';

    root.innerHTML =
      '<div class="report-head">' +
        '<div><div class="section-head" style="margin:0"><span class="kicker">Session summary</span>' +
        '<h2>Your OT Decision Lab Report</h2>' +
        '<p class="sub">A consolidated snapshot of your simulation decisions, maturity, audit-readiness, and roadmap — ready to share.</p></div></div>' +
        '<button class="btn btn-primary" id="printReport">Print / save PDF</button>' +
      '</div>' +
      labHtml + maturityHtml + auditHtml + roadmapHtml + nextHtml;

    var pb = UTIL.el("printReport");
    if (pb) pb.addEventListener("click", function () { window.print(); });
    root.querySelectorAll("a[href^='#']").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        go(a.getAttribute("href").slice(1));
      });
    });
  }

  /* ---------------- global events ---------------- */
  function bindGlobal() {
    document.querySelectorAll("[data-view]").forEach(function (n) {
      n.addEventListener("click", function () { go(n.getAttribute("data-view")); });
    });
    document.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target.closest("[data-goto]") : null;
      if (t) { go(t.getAttribute("data-goto")); }
    });
    var resetBtn = UTIL.el("resetAll");
    if (resetBtn) resetBtn.addEventListener("click", function () {
      Sim.reset();
      Assess.reset();
      auditState = { checked: {} };
      saveAudit();
      roadmapFilter = "all";
      UTIL.toast("All progress reset.");
      go("overview");
    });
  }

  function init() {
    bindGlobal();
    var hash = (location.hash || "").replace("#", "");
    go(VIEWS.indexOf(hash) !== -1 ? hash : "overview");
  }

  document.addEventListener("DOMContentLoaded", init);

  return { go: go, renderReport: renderReport };
})();
