/* =========================================================================
   OT Cyber Incident Decision Lab — maturity assessment + radar chart
   ========================================================================= */

window.Assess = (function () {
  "use strict";

  var LS_KEY = "otlab.assess.v1";
  var currentDomain = 0;

  var state = load();
  function load() {
    var base = { answers: {} };
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        base.answers = saved.answers || {};
      }
    } catch (e) { /* ignore */ }
    return base;
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function getAnswers(domainId) {
    if (!state.answers[domainId]) state.answers[domainId] = [-1, -1, -1, -1];
    return state.answers[domainId];
  }

  function domainScore(domainId) {
    var answers = getAnswers(domainId);
    var sum = 0;
    answers.forEach(function (a) { if (a > 0) sum += a; });
    return UTIL.pct(sum, answers.length * 3);
  }

  function overall() {
    var total = 0;
    DATA.DOMAINS.forEach(function (d) { total += domainScore(d.id); });
    return Math.round(total / DATA.DOMAINS.length);
  }

  function tier(pct) {
    if (pct >= 75) return { name: "Optimizing", cls: "tier-4" };
    if (pct >= 50) return { name: "Defined", cls: "tier-3" };
    if (pct >= 25) return { name: "Developing", cls: "tier-2" };
    return { name: "Initial", cls: "tier-1" };
  }

  function setAnswer(domainId, qIndex, value) {
    getAnswers(domainId)[qIndex] = value;
    save();
    render();
  }

  function reset() {
    state.answers = {};
    currentDomain = 0;
    save();
  }

  /* ---------------- rendering ---------------- */
  function render() {
    var root = UTIL.el("maturity-root");
    if (!root) return;
    var ov = overall();
    var t = tier(ov);

    var chips = DATA.DOMAINS.map(function (d, i) {
      var s = domainScore(d.id);
      var answered = getAnswers(d.id).some(function (a) { return a >= 0; });
      return '<button class="domain-chip' + (i === currentDomain ? " active" : "") + '" data-domain="' + i + '">' +
        d.icon + ' ' + d.name +
        (answered ? '<span class="dc-score">' + s + '%</span>' : '') +
      '</button>';
    }).join("");

    var gaps = DATA.DOMAINS.slice().sort(function (a, b) { return domainScore(a.id) - domainScore(b.id); })
      .filter(function (d) { return domainScore(d.id) < 75; })
      .slice(0, 4);

    var gapHtml = gaps.map(function (d) {
      var s = domainScore(d.id);
      var col = s >= 50 ? "#22c55e" : s >= 25 ? "#f5a623" : "#ef4444";
      return '<div class="gap-item"><span class="g-name">' + d.icon + ' ' + d.name + '</span>' +
        '<span class="g-bar"><span class="g-fill" style="width:' + s + '%;background:' + col + '"></span></span>' +
        '<span class="g-pct">' + s + '%</span></div>';
    }).join("");

    root.innerHTML =
      '<div class="section-head"><span class="kicker">Cybersecurity maturity</span>' +
      '<h2>OT Security Maturity Assessment</h2>' +
      '<p class="sub">Rate your organisation across eight OT security domains (0 = not started, 3 = optimized). ' +
      'The radar updates live; gaps below 75% are your priority work.</p></div>' +

      '<div class="maturity-top">' +
        '<div class="card"><div class="card-head"><span class="card-kicker">Overall maturity</span><h3>Program score</h3></div>' +
          '<div class="card-body"><div class="score-hero">' +
            '<div class="score-ring">' + ringSVG(ov) + '</div>' +
            '<div><span class="tier-badge ' + t.cls + '">' + t.name + '</span>' +
              '<p class="muted" style="margin:10px 0 0;max-width:300px">' + tierBlurb(ov) + '</p></div>' +
          '</div>' +
          '<div class="meter-block" style="margin-top:16px">' + meter(ov) + '</div>' +
          '<div style="margin-top:16px"><div class="card-kicker" style="margin-bottom:8px">Critical gaps (lowest-scoring)</div>' +
            '<div class="gap-list">' + (gapHtml || '<div class="muted" style="font-size:13px">No critical gaps — every domain scores 75% or above.</div>') + '</div></div>' +
        '</div></div>' +

        '<div class="radar-wrap"><div class="card-head" style="margin-bottom:6px"><span class="card-kicker">Capability profile</span><h3>Maturity radar</h3></div>' +
          radarSVG() +
          '<div class="radar-legend">' + DATA.DOMAINS.map(function (d) {
            return '<span><span class="legend-dot" style="background:' + domainColor(domainScore(d.id)) + '"></span>' + d.name + ' ' + domainScore(d.id) + '%</span>';
          }).join("") + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="domain-nav">' + chips + '</div>' +

      renderDomain(currentDomain) +

      '<div class="lab-nav"><button class="btn btn-ghost" data-goto="audit">Continue to Audit Guidelines →</button><span></span></div>';

    bind(root);
  }

  function renderDomain(index) {
    var d = DATA.DOMAINS[index];
    var answers = getAnswers(d.id);
    var qs = d.questions.map(function (q, qi) {
      var opts = DATA.SCALE.map(function (label, vi) {
        var cls = "q-opt" + (answers[qi] === vi ? " active" : "");
        return '<button class="' + cls + '" data-q="' + qi + '" data-v="' + vi + '">' + label + '</button>';
      }).join("");
      return '<div class="q-item"><div class="q-text">' + (qi + 1) + '. ' + UTIL.esc(q) + '</div>' +
        '<div class="q-opts">' + opts + '</div></div>';
    }).join("");

    var s = domainScore(d.id);
    return '<div class="card" style="margin-top:2px">' +
      '<div class="card-head"><span class="card-kicker">Domain ' + (index + 1) + ' of ' + DATA.DOMAINS.length + '</span>' +
      '<h3>' + d.icon + ' ' + d.name + ' <span class="muted" style="font-weight:400;font-size:13px">· ' + s + '%</span></h3>' +
      '<p class="muted" style="margin:6px 0 0;font-size:13.5px">' + UTIL.esc(d.desc) + '</p></div>' +
      '<div class="card-body">' + qs + '</div></div>';
  }

  function meter(pct) {
    var col = pct >= 50 ? "#22c55e" : pct >= 25 ? "#f5a623" : "#ef4444";
    return '<div class="meter"><div class="meter-bar quality" style="width:' + pct + '%;background:linear-gradient(90deg,' + col + ',' + col + ')"></div></div>';
  }

  function domainColor(pct) {
    return pct >= 50 ? "#22c55e" : pct >= 25 ? "#f5a623" : "#ef4444";
  }

  function tierBlurb(pct) {
    if (pct >= 75) return "A defined, optimising program. Focus on sustaining drills, continuous improvement, and advanced threats.";
    if (pct >= 50) return "Solid foundations with measurable gaps. Prioritise the lowest-scoring domains with the quick wins in the Roadmap.";
    if (pct >= 25) return "Foundational controls are incomplete. Start with visibility, identity, and change detection — they unblock everything else.";
    return "The program is at an initial stage. The good news: the Roadmap's quick wins deliver fast, high-impact improvement.";
  }

  function ringSVG(pct) {
    var r = 52, c = 2 * Math.PI * r;
    var dash = (pct / 100) * c;
    var col = pct >= 50 ? "#22c55e" : pct >= 25 ? "#f5a623" : "#ef4444";
    return '<svg viewBox="0 0 130 130" width="130" height="130">' +
      '<circle cx="65" cy="65" r="' + r + '" fill="none" stroke="#1d2a3d" stroke-width="11"/>' +
      '<circle cx="65" cy="65" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + dash + ' ' + c + '" transform="rotate(-90 65 65)"/>' +
      '<text x="65" y="65" text-anchor="middle" dominant-baseline="central" fill="#e6edf5" font-size="26" font-weight="700" font-family="ui-monospace,monospace">' + pct + '%</text>' +
    '</svg>';
  }

  function radarSVG() {
    var N = DATA.DOMAINS.length;
    var cx = 240, cy = 200, R = 130, size = 480;
    var pts = [];

    function angleOf(i) { return -Math.PI / 2 + (i * 2 * Math.PI) / N; }
    function point(i, scale) {
      var a = angleOf(i);
      return [cx + R * scale * Math.cos(a), cy + R * scale * Math.sin(a)];
    }

    var grid = "";
    [25, 50, 75, 100].forEach(function (lvl) {
      var ring = [];
      for (var i = 0; i < N; i++) {
        var p = point(i, lvl / 100);
        ring.push(p[0].toFixed(1) + "," + p[1].toFixed(1));
      }
      grid += '<polygon points="' + ring.join(" ") + '" fill="none" stroke="#1d2a3d" stroke-width="1"/>';
    });

    var spokes = "";
    for (var i = 0; i < N; i++) {
      var p = point(i, 1);
      spokes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="#1d2a3d" stroke-width="1"/>';
    }

    var dataPts = [];
    for (var j = 0; j < N; j++) {
      var d = DATA.DOMAINS[j];
      var p = point(j, Math.max(0.04, domainScore(d.id) / 100));
      dataPts.push(p[0].toFixed(1) + "," + p[1].toFixed(1));
    }
    var dataPoly = '<polygon points="' + dataPts.join(" ") + '" fill="rgba(45,212,191,0.28)" stroke="#2dd4bf" stroke-width="2" stroke-linejoin="round"/>';

    var dots = "";
    for (var k = 0; k < N; k++) {
      var q = point(k, Math.max(0.04, domainScore(DATA.DOMAINS[k].id) / 100));
      dots += '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="3.4" fill="#2dd4bf"/>';
    }

    var labels = "";
    for (var m = 0; m < N; m++) {
      var a = angleOf(m);
      var lx = cx + (R + 40) * Math.cos(a);
      var ly = cy + (R + 40) * Math.sin(a);
      var anchor = Math.abs(Math.cos(a)) < 0.35 ? "middle" : (Math.cos(a) > 0 ? "start" : "end");
      labels += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + anchor + '" dominant-baseline="middle" fill="#8b99ac" font-size="12.5" font-weight="600">' + DATA.DOMAINS[m].name + '</text>';
    }

    return '<svg viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="Maturity radar chart">' +
      grid + spokes + dataPoly + dots + labels + '</svg>';
  }

  function bind(root) {
    root.querySelectorAll("[data-domain]").forEach(function (n) {
      n.addEventListener("click", function () {
        currentDomain = parseInt(n.getAttribute("data-domain"), 10);
        render();
      });
    });
    root.querySelectorAll("[data-q]").forEach(function (n) {
      n.addEventListener("click", function () {
        var d = DATA.DOMAINS[currentDomain];
        setAnswer(d.id, parseInt(n.getAttribute("data-q"), 10), parseInt(n.getAttribute("data-v"), 10));
      });
    });
    root.querySelectorAll("[data-goto]").forEach(function (n) {
      n.addEventListener("click", function () { window.App && App.go(n.getAttribute("data-goto")); });
    });
  }

  return {
    render: render,
    reset: reset,
    domainScore: domainScore,
    overall: overall,
    radarSVG: radarSVG,
    ringSVG: ringSVG,
    tier: tier,
    state: state
  };
})();
