/* =========================================================================
   OT Cyber Incident Decision Lab — content & data model
   ========================================================================= */

window.UTIL = (function () {
  "use strict";
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function el(id) {
    return document.getElementById(id);
  }
  function toast(msg) {
    var t = el("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }
  function pct(part, whole) {
    if (!whole) return 0;
    return Math.round((part / whole) * 100);
  }
  return { esc: esc, el: el, toast: toast, pct: pct };
})();

window.DATA = (function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * SCENARIOS — 4 progressive incident stages
   * ------------------------------------------------------------------ */
  const SCENARIOS = [
    {
      id: "stage1",
      num: 1,
      time: "02:14",
      duration: "~5 min",
      title: "Suspicious Engineering Workstation Activity",
      tag: "Initial Access · Lateral Movement",
      severity: "Medium",
      severityClass: "sev-medium",
      objective: "Detect the intrusion early and contain it before the attacker reaches the control network.",
      see: {
        headline: "At 02:14 the SOC notices activity on EWS-03, the engineering workstation for Substation B — during a night with no personnel on site.",
        metrics: [
          { label: "EWS-03 · Substation B", value: "REMOTE SESSION", hint: "inbound RDP — no onsite operator", tone: "warn" },
          { label: "External peer", value: "203.0.113.47:443", hint: "untrusted geo · no known vendor", tone: "warn" },
          { label: "Badge system", value: "0 ON SITE", hint: "control room only", tone: "ok" },
          { label: "Scheduled maintenance", value: "NONE", hint: "no approved window", tone: "crit" }
        ],
        logs: [
          { ts: "02:14:07", lvl: "info", msg: "EWS-03: inbound RDP session established (src 203.0.113.47)" },
          { ts: "02:14:22", lvl: "warn", msg: "EWS-03: PowerShell spawned by svchost — encoded command" },
          { ts: "02:14:31", lvl: "warn", msg: "EWS-03: credential validation against HISTORIAN-01 (SVC_ENG)" },
          { ts: "02:14:44", lvl: "crit", msg: "EWS-03: read attempt on PLC project files (\\file\\plc\\sub-b)" },
          { ts: "02:14:52", lvl: "crit", msg: "EWS-03: network recon — SMB scan of control subnet <span class='dim'>…streaming…</span>" }
        ],
        note: "Three things line up: a remote session nobody scheduled, a shared service account, and interest in PLC project files."
      },
      understand: {
        briefing: "You are the OT security lead on call. You have minutes to form a working hypothesis and decide whether to act. Ask the right questions first.",
        triage: [
          { q: "Is a remote maintenance window scheduled?", a: "No. The vendor VPN used for remote support was decommissioned 14 days ago and never replaced by an approved path.", signal: "Anomaly — no legitimate remote channel exists tonight.", hot: true },
          { q: "Is anyone physically at the substation?", a: "No badge scans. The night shift is staffed at the central control room only. Substation B is unmanned.", signal: "Anomaly — session has no human owner on site.", hot: true },
          { q: "What is the patch posture of EWS-03?", a: "60+ days overdue on a known remote-code-execution CVE. Engineering workstations are exempt from the standard IT patch cycle.", signal: "Exposed surface — known exploitable vulnerability.", hot: true },
          { q: "Which account is being used?", a: "SVC_ENG — a shared service account used for engineering uploads and historian access. Same credential on several systems.", signal: "Shared credential — lateral movement enabler.", hot: true }
        ],
        hypotheses: [
          { id: "h1", text: "False positive — a vendor is doing routine after-hours support.", correct: false, note: "No vendor session is scheduled, and the approved VPN path was retired two weeks ago." },
          { id: "h2", text: "Initial access / lateral movement — a compromised remote-access path into the engineering environment.", correct: true, note: "Unattended remote session + shared credential + recon of PLC files is a classic intrusion pattern." },
          { id: "h3", text: "A legitimate operator working remotely on an urgent fix.", correct: false, note: "No operator is badged on site and no change request or on-call log supports remote work." },
          { id: "h4", text: "An insider employee working after hours.", correct: false, note: "Possible but less consistent: the connection originates from an external, untrusted address." }
        ]
      },
      decide: {
        prompt: "What do you do first?",
        options: [
          {
            id: "A",
            label: "Isolate EWS-03 and revoke SVC_ENG immediately",
            detail: "Disable the workstation's switch port and disable the shared service account, then investigate.",
            tradeoff: "Cost: any in-flight engineering work is dropped and the team loses the asset until it is rebuilt.",
            ops: 1, safety: 0, score: 80, good: true,
            riskTags: ["fast containment", "small ops impact", "breaks attack path"],
            consequence: "You isolate EWS-03 within minutes and disable SVC_ENG. The remote session drops before the attacker reaches the PLC project files. Forensics later confirm a replayed VPN credential harvested by a phishing kit. No OT impact.",
            expert: "Fast, decisive containment on the crown-jewel path is correct. A shared service account is a super-highway for lateral movement — revoking it is the single highest-value action here. The small operational cost is worth it."
          },
          {
            id: "B",
            label: "Block only the external IP at the perimeter firewall",
            detail: "Add a deny rule for 203.0.113.47 but leave the workstation online and the session in place.",
            tradeoff: "Cost: looks clean, but an already-open session and any second-stage C2 survive the block.",
            ops: 0, safety: 0, score: 45, good: false,
            riskTags: ["cosmetic control", "session persists", "C2 survives"],
            consequence: "New connections to 203.0.113.47 are dropped, but the attacker's session persists over an already-established channel and pivots using SVC_ENG. Real containment is delayed several hours.",
            expert: "Blocking an IP stops future callbacks but not the active session or the shared credential. Containment must sever the live path and the identity, not just the address."
          },
          {
            id: "C",
            label: "Monitor quietly — watch and learn before acting",
            detail: "Keep logging to map the attacker's scope and intent, and hold off on any disruptive action.",
            tradeoff: "Cost: you concede the initiative; the attacker keeps moving while you watch.",
            ops: 0, safety: 0, score: 25, good: false,
            riskTags: ["surveillance", "delayed containment", "loses initiative"],
            consequence: "The attacker goes quiet for 40 minutes, then reappears on the historian authenticated as SVC_ENG and enumerates the engineering file share. You learn the scope — but only after the intrusion deepens.",
            expert: "Understanding is important, but 'monitor only' on an active intrusion surrenders initiative. In OT, the priority is to stop movement toward safety-critical systems first, then investigate."
          },
          {
            id: "D",
            label: "Escalate to management and wait for approval to act",
            detail: "Notify the shift manager and the CISO, and hold all technical action pending sign-off.",
            tradeoff: "Cost: governance is satisfied, but the clock runs while the attacker is live.",
            ops: 0, safety: 0, score: 35, good: false,
            riskTags: ["governance", "slow", "decision latency"],
            consequence: "Approval arrives 55 minutes later. By then the attacker has enumerated the engineering file share and staged tooling. Nothing irreversible yet — but the window is now far wider.",
            expert: "Escalation is mandatory, but it should happen in parallel with pre-authorized containment actions. Define 'pre-approved' response thresholds in advance so responders never wait for sign-off on a live intrusion."
          }
        ]
      },
      recover: {
        steps: [
          "Preserve forensics — image EWS-03 and capture netflow/SIEM evidence before any cleanup",
          "Revoke and rotate SVC_ENG and every shared credential in the OT estate",
          "Patch the EWS fleet and enforce MFA for all remote access",
          "Replace ad-hoc vendor remote access with time-boxed, audited, jump-host sessions",
          "Hunt for persistence — scheduled tasks, services, and implants across engineering hosts"
        ],
        lesson: "Shared service accounts and unmanaged remote access are the number-one OT entry point. Engineering workstations need the same identity hygiene and patch discipline as IT — not an exemption.",
        gap: "Identity & Access Management · Visibility"
      }
    },

    {
      id: "stage2",
      num: 2,
      time: "03:02",
      duration: "~5 min",
      title: "Unauthorized PLC Changes",
      tag: "Integrity · Safety Interlocks",
      severity: "High",
      severityClass: "sev-high",
      objective: "Detect and reverse an unauthorized logic change without tripping generation or endangering safety.",
      see: {
        headline: "At 03:02 the historian flags a logic download to PLC-07 — the generator breaker control — sourced from the compromised EWS-03. There is no change ticket.",
        metrics: [
          { label: "PLC-07 · breaker interlocks", value: "LOGIC MODIFIED", hint: "03:02:11", tone: "crit" },
          { label: "Download source", value: "EWS-03", hint: "already compromised", tone: "crit" },
          { label: "MOC change ticket", value: "NONE", hint: "no approved change", tone: "crit" },
          { label: "Config checksum", value: "MISMATCH", hint: "vs golden image", tone: "warn" }
        ],
        logs: [
          { ts: "03:02:11", lvl: "crit", msg: "PLC-07: logic download initiated from EWS-03" },
          { ts: "03:02:19", lvl: "crit", msg: "PLC-07: rung 42 modified — breaker interlock condition changed" },
          { ts: "03:02:26", lvl: "warn", msg: "PLC-07: alarm suppression engaged (10-minute window)" },
          { ts: "03:02:31", lvl: "warn", msg: "SCADA: PLC-07 heartbeat interval altered" },
          { ts: "03:02:44", lvl: "crit", msg: "Historian: config hash mismatch — golden image vs live logic" }
        ],
        note: "The changed rung is an interlock — a condition that prevents the breaker from closing during maintenance. Disabling it could allow a close onto a grounded circuit."
      },
      understand: {
        briefing: "The attacker has reached the control layer. This is no longer about visibility — it is about integrity and safety. Establish exactly what changed before deciding how to respond.",
        triage: [
          { q: "Was there an approved change?", a: "No Management-of-Change ticket exists for this asset or window. The change came from EWS-03, which is known compromised.", signal: "Unauthorized — integrity event.", hot: true },
          { q: "What exactly changed?", a: "Interlock rung 42 — the condition that blocks breaker closure while the circuit is earthed for maintenance. Disabling it defeats a physical-safety control.", signal: "Safety-critical modification.", hot: true },
          { q: "What is the current plant state?", a: "Unit at reduced load; the generator breaker is open for scheduled work. A wrong close could energize an earthed circuit — severe equipment and personnel hazard.", signal: "High-consequence window.", hot: true },
          { q: "Is this the only PLC affected?", a: "Unknown. Other PLCs share the same engineering access path and the same SVC_ENG credential.", signal: "Scope not yet bounded — assume more.", hot: false }
        ],
        hypotheses: [
          { id: "h1", text: "Benign config sync — engineering pushed a routine update.", correct: false, note: "No change ticket exists and the source host is known compromised. A benign sync does not disable an interlock and suppress its own alarm." },
          { id: "h2", text: "Attacker disabling a safety interlock to enable an unsafe or malicious operation.", correct: true, note: "Targeted modification of a breaker interlock plus alarm suppression is a deliberate, safety-directed act." },
          { id: "h3", text: "Operator error — someone loaded the wrong project file.", correct: false, note: "The timing, source (compromised EWS), and alarm suppression pattern contradict a simple mistake." },
          { id: "h4", text: "SCADA master re-sync overwriting the PLC.", correct: false, note: "A re-sync would match the configured baseline, not diverge from the golden image." }
        ]
      },
      decide: {
        prompt: "The interlock on a live breaker has been tampered with. What is your first move?",
        options: [
          {
            id: "A",
            label: "Trip the unit to a safe state and block all further downloads",
            detail: "Shed the affected generator and lock out logic downloads until the PLC is verified.",
            tradeoff: "Cost: a self-inflicted generation outage and a stressful, manual shutdown at night.",
            ops: 3, safety: 0, score: 55, good: false,
            riskTags: ["safe but disruptive", "generation outage", "defensive"],
            consequence: "The unit trips safely. No one is hurt and the tampered interlock cannot act — but you have caused an avoidable generation outage that will take hours to restore and must be reported.",
            expert: "Tripping is defensible when safety is uncertain, but here you could first verify and revert the logic while keeping the process under watch. Restore integrity before sacrificing availability."
          },
          {
            id: "B",
            label: "Revert to the last-known-good logic image and verify integrity",
            detail: "Push the golden image back to PLC-07, verify the checksum, and hold downloads under watch until re-armed.",
            tradeoff: "Cost: brief control transition risk during the revert; requires a controlled window.",
            ops: 1, safety: 0, score: 80, good: true,
            riskTags: ["integrity restore", "minimal outage", "controlled"],
            consequence: "You reload the golden image and confirm the checksum. The interlock is restored within minutes. Monitoring confirms no further downloads. No trip, no outage — the tampered logic never executes.",
            expert: "Restoring verified integrity is the right first move: it removes the danger at its source with minimal operational impact. Keep downloads locked and alarms un-suppressed until the scope is understood."
          },
          {
            id: "C",
            label: "Leave it running and observe behaviour",
            detail: "The change may be benign. Watch the breaker logic in operation before intervening.",
            tradeoff: "Cost: you are gambling with a safety interlock on a live breaker.",
            ops: 0, safety: 3, score: 10, good: false,
            riskTags: ["unsafe", "gambles safety", "inaction"],
            consequence: "Twenty minutes later the breaker control behaves abnormally during a switching operation. The tampered interlock nearly allows a close onto an earthed circuit before an operator intervenes manually. A near-miss is logged.",
            expert: "Never 'wait and see' on a modified safety interlock. Integrity events on safety controls demand immediate, decisive action — the downside is injury and equipment destruction."
          },
          {
            id: "D",
            label: "Power-cycle PLC-07 to halt the attacker",
            detail: "Reboot the controller to stop the malicious session and clear the running logic.",
            tradeoff: "Cost: a reboot drops breaker control and telemetry, and may not clear the downloaded logic.",
            ops: 2, safety: 1, score: 30, good: false,
            riskTags: ["loss of visibility", "control outage", "incomplete fix"],
            consequence: "The reboot interrupts control and telemetry to the breaker for several minutes, alarming the control room. Worse, the modified logic persists in non-volatile memory — the reboot removed visibility, not the threat.",
            expert: "Rebooting a PLC drops control and visibility without reliably removing tampered logic. Revert from a known-good image, then restore the device to a clean state in a controlled window."
          }
        ]
      },
      recover: {
        steps: [
          "Verify PLC-07 logic against the golden image and confirm the checksum",
          "Enforce Management-of-Change and engineering access management (key switch / download authorization)",
          "Lock down PLC engineering ports — no remote logic downloads from the IT side",
          "Enable change detection and file-integrity monitoring for all PLC projects",
          "Audit every other PLC sharing the same engineering path for similar modifications"
        ],
        lesson: "PLC logic is the crown jewel of OT. Changes must be authorized, verified, and detected in near-real time — an unmanaged logic change can defeat physical safety.",
        gap: "Segmentation · Monitoring & Change Detection"
      }
    },

    {
      id: "stage3",
      num: 3,
      time: "03:41",
      duration: "~5 min",
      title: "AI-Generated Security Alerts",
      tag: "AI Governance · Detection",
      severity: "Medium",
      severityClass: "sev-medium",
      objective: "Separate signal from noise when an AI SOC co-pilot floods the queue — and respond to AI-enabled threats.",
      see: {
        headline: "At 03:41 the AI SOC co-pilot ('ARGUS') starts generating a flood of 'critical' alerts. Some are real, some are hallucinated — and the true positive is buried near the bottom.",
        metrics: [
          { label: "ARGUS co-pilot", value: "47 ALERTS", hint: "in 5 minutes", tone: "warn" },
          { label: "False positives", value: "12", hint: "hallucinated correlations", tone: "warn" },
          { label: "True positive rank", value: "#38", hint: "mis-prioritised", tone: "crit" },
          { label: "Analyst workload", value: "SATURATED", hint: "triage bottleneck", tone: "crit" }
        ],
        logs: [
          { ts: "03:41:02", lvl: "info", msg: "ARGUS [CRITICAL]: lateral movement EWS-03 → HISTORIAN-01 (conf 0.97)" },
          { ts: "03:41:05", lvl: "info", msg: "ARGUS [CRITICAL]: data exfil PLC-09 → 203.0.113.99 (conf 0.94) <span class='dim'>— later proven FALSE (stale enrichment)</span>" },
          { ts: "03:41:11", lvl: "warn", msg: "ARGUS [LOW]: credential replay SVC_ENG on JUMPHOST-02 (conf 0.31) <span class='dim'>— later proven TRUE</span>" },
          { ts: "03:41:40", lvl: "crit", msg: "SOC: analyst queue at 100% — triage bottleneck" }
        ],
        note: "The co-pilot is confident about the wrong things and timid about the real thing. This is the new reality of AI-assisted defense."
      },
      understand: {
        briefing: "AI changes the economics of both attack and defense. Your job: decide how much to trust the machine, and where a human must stay in control.",
        triage: [
          { q: "Can you trust the co-pilot's labels?", a: "No. ARGUS produced 12 false positives in five minutes — hallucinated correlations and stale threat intelligence it presented as fact.", signal: "Model reliability problem.", hot: true },
          { q: "Where is the true signal?", a: "Raw telemetry (netflow, EDR, PLC change logs) shows the LOW-confidence 'credential replay' alert is real — the same SVC_ENG pattern from Stage 1.", signal: "Ground truth beats the AI's ranking.", hot: true },
          { q: "Does the AI understand OT?", a: "Partially. ARGUS was trained mostly on IT data and mislabels normal OT behaviour — e.g. Modbus polling as 'scanning'.", signal: "Domain gap.", hot: false },
          { q: "What is the governance status?", a: "No approval, no data-flow review, and no human-in-the-loop policy. ARGUS was deployed by a single team as an experiment.", signal: "Governance gap.", hot: true }
        ],
        hypotheses: [
          { id: "h1", text: "The AI is reliable — act directly on its top-ranked alerts.", correct: false, note: "Its top alert was partly wrong and the real one was ranked #38. Confidence scores do not equal correctness." },
          { id: "h2", text: "The AI is useful but must be verified against raw telemetry, with human decision authority.", correct: true, note: "AI accelerates triage; ground truth and accountability must stay human." },
          { id: "h3", text: "The AI itself has been compromised by the attacker.", correct: false, note: "Plausible to consider, but the evidence points to hallucination and poor enrichment — not takeover." },
          { id: "h4", text: "These are all noise — switch the AI off and move on.", correct: false, note: "Buried in the noise is a genuine credential-replay event. Ignoring the tool discards real signal too." }
        ]
      },
      decide: {
        prompt: "The queue is flooded and a real alert is buried in it. How do you handle the AI?",
        options: [
          {
            id: "A",
            label: "Auto-isolate the top AI-flagged asset",
            detail: "Let ARGUS trigger containment automatically on its highest-confidence alert.",
            tradeoff: "Cost: you act on an unverified model output — potentially disrupting production over a hallucination.",
            ops: 2, safety: 0, score: 35, good: false,
            riskTags: ["unverified automation", "hallucination risk", "self-inflicted outage"],
            consequence: "Automated containment kicks in on a false-positive 'data exfil' alert and isolates PLC-09, disrupting a live process. Meanwhile the real credential-replay event continues unnoticed at rank #38.",
            expert: "Automating OT containment on raw model output is dangerous. AI may recommend, but a human with ground truth must decide actions that can stop a plant."
          },
          {
            id: "B",
            label: "Turn off AI alerts entirely",
            detail: "The noise isn't worth it — disable ARGUS and rely on classic SIEM rules.",
            tradeoff: "Cost: you lose the speed and coverage AI provides, and the real alert may never surface.",
            ops: 0, safety: 0, score: 25, good: false,
            riskTags: ["abandons tooling", "loses signal", "reactionary"],
            consequence: "You silence the flood — and with it the genuine credential-replay alert. The compromise of JUMPHOST-02 goes undetected until it resurfaces as a larger incident.",
            expert: "Abandoning the tool throws away real signal. The fix is governance and verification, not deletion. Tune it, don't unplug it."
          },
          {
            id: "C",
            label: "Use AI as an assistant — verify against raw telemetry, keep humans in control",
            detail: "Treat ARGUS as a triage aid: analysts verify alerts against netflow/EDR/PLC logs before any action, and tune thresholds.",
            tradeoff: "Cost: more analyst effort in the short term to re-verify, and you must define the human-in-the-loop policy.",
            ops: 0, safety: 0, score: 80, good: true,
            riskTags: ["human-in-the-loop", "verify-first", "governed"],
            consequence: "Analysts re-verify against raw telemetry, catch the buried credential-replay alert, and escalate it correctly. You also write the human-in-the-loop policy that will govern ARGUS from now on.",
            expert: "This is the right balance: AI accelerates, humans adjudicate. Verify model output against ground truth, keep decision authority on OT actions human, and govern the tool's data access."
          },
          {
            id: "D",
            label: "Escalate the alert flood to management",
            detail: "Push the problem up — the tool is generating unmanageable volume and someone senior must decide.",
            tradeoff: "Cost: the decision is deferred while the genuine incident keeps unfolding.",
            ops: 0, safety: 0, score: 30, good: false,
            riskTags: ["defers decision", "no immediate control", "process-only"],
            consequence: "Management convenes to discuss the alert volume. In the meantime the real credential-replay event is lost in the queue and the intrusion advances.",
            expert: "Escalation is necessary but not sufficient. Responders must be empowered to tune, verify, and act in the moment — management decides policy, not every alert."
          }
        ]
      },
      recover: {
        steps: [
          "Adopt a human-in-the-loop policy with a clear RACI for AI-assisted detection",
          "Validate and red-team AI/LLM tools against OT data (hallucination, prompt injection, stale enrichment)",
          "Tune alert thresholds, deduplication, and enrichment hygiene to cut false positives",
          "Train analysts and staff on AI-enabled threats (AI phishing, deepfakes, AI-generated payloads)",
          "Govern AI data access with least privilege and a data-flow review"
        ],
        lesson: "AI is a force multiplier — for attackers and defenders alike. Keep humans accountable for every OT decision, and govern AI like any other high-impact system.",
        gap: "AI Governance · Monitoring & Detection"
      }
    },

    {
      id: "stage4",
      num: 4,
      time: "04:20",
      duration: "~7 min",
      title: "IT-to-OT Ransomware Propagation",
      tag: "Ransomware · IT/OT Boundary",
      severity: "Critical",
      severityClass: "sev-critical",
      objective: "Stop ransomware spreading from IT into OT while preserving generation and safe operation.",
      see: {
        headline: "At 04:20 ransomware detonates across the IT domain. A jump host in the DMZ is compromised — and it just authenticated to the OT historian with SVC_ENG.",
        metrics: [
          { label: "IT domain", value: "ENCRYPTING", hint: "200+ endpoints", tone: "crit" },
          { label: "JMP-01 · DMZ", value: "COMPROMISED", hint: "reaches OT", tone: "crit" },
          { label: "IT↔OT path", value: "OPEN 445/3389", hint: "shared SVC_ENG", tone: "crit" },
          { label: "Historian / HMIs", value: "NOT YET HIT", hint: "minutes to act", tone: "warn" }
        ],
        logs: [
          { ts: "04:20:00", lvl: "crit", msg: "IT: ransomware detonated — 200+ endpoints encrypting" },
          { ts: "04:20:11", lvl: "crit", msg: "IT: lateral spread via SMB/PsExec — domain controllers & file servers" },
          { ts: "04:20:31", lvl: "crit", msg: "DMZ: JMP-01 authenticated to OT historian using SVC_ENG" },
          { ts: "04:20:40", lvl: "warn", msg: "OT: unusual SMB (445) from JMP-01 toward control network" },
          { ts: "04:20:55", lvl: "crit", msg: "OT: historian query storm — SVC_ENG enumerating tags <span class='dim blink'>▲</span>" }
        ],
        note: "The path from IT to OT is bidirectional — a two-way firewall, a jump host, and a shared credential. You have minutes before the ransomware crosses.",
        topo: {
          rows: [
            { label: "IT DOMAIN", nodes: [
              { id: "it", cls: "it compromised", text: "IT · 200+ hosts\nENCRYPTING" },
              { id: "dc", cls: "it compromised", text: "DC / file servers\nCOMPROMISED" }
            ]},
            { label: "DMZ", nodes: [
              { id: "jmp", cls: "dmz compromised", text: "JMP-01\nCOMPROMISED" }
            ]},
            { label: "OT CONTROL", nodes: [
              { id: "hist", cls: "ot", text: "Historian" },
              { id: "hmi", cls: "ot", text: "HMI" },
              { id: "plc", cls: "ot", text: "PLC-07 · breakers" }
            ]}
          ]
        }
      },
      understand: {
        briefing: "This is the decisive moment. Everything you decided earlier — segmentation, identity, visibility — is now on the line. Your priority: keep generation and safety systems out of the blast radius.",
        triage: [
          { q: "Has OT been hit yet?", a: "Not yet. The historian and HMIs are clean — but JMP-01 just authenticated to the historian and is enumerating tags. The door is open.", signal: "Time pressure — act now.", hot: true },
          { q: "What connects IT and OT?", a: "A two-way firewall plus a jump host, bound together by the shared SVC_ENG credential. There is no unidirectional gateway.", signal: "Bidirectional bridge — the decisive point.", hot: true },
          { q: "What are the crown jewels?", a: "Generation control and protection relays. Losing them means grid instability and possible safety events.", signal: "Protect generation first.", hot: true },
          { q: "Can IT tools still reach OT?", a: "Yes — that is the problem. The same path the defenders use is the path the ransomware will use.", signal: "Shared path — cut it, then recover.", hot: true }
        ],
        hypotheses: [
          { id: "h1", text: "OT is already encrypted — shift all effort to IT recovery.", correct: false, note: "OT systems are currently clean. Treating OT as already lost wastes the decisive window." },
          { id: "h2", text: "Ransomware is on the doorstep: the IT↔OT bridge is the decisive point — sever and isolate it now.", correct: true, note: "Cutting the bridge stops the spread vector while OT remains operational." },
          { id: "h3", text: "It's an IT problem — OT is effectively air-gapped.", correct: false, note: "The DMZ jump host just authenticated to the OT historian. The 'air gap' is assumed, not real." },
          { id: "h4", text: "Shut down every OT system to keep them safe.", correct: false, note: "Pre-emptive shutdown is a self-inflicted outage — isolate the path, don't destroy availability." }
        ]
      },
      decide: {
        prompt: "Ransomware is spreading in IT and knocking on OT's door. What do you do?",
        options: [
          {
            id: "A",
            label: "Sever and isolate the IT↔OT link now",
            detail: "Disable JMP-01, block SMB/RDP at the boundary, revoke SVC_ENG on OT, and move to a one-way path for data.",
            tradeoff: "Cost: IT loses visibility into OT while you fight the ransomware; historian feeds to IT pause.",
            ops: 1, safety: 0, score: 80, good: true,
            riskTags: ["segmentation holds", "preserves OT", "decisive"],
            consequence: "You cut the bridge. The ransomware cannot cross. Generation continues, the historian is quarantined but safe, and IT is recovered in isolation. The attack is contained at the boundary.",
            expert: "Severing the IT↔OT link is the textbook correct call. Availability of OT is the priority during an IT ransomware event; recover IT in isolation, and let OT data flow one-way only."
          },
          {
            id: "B",
            label: "Shut down all OT systems to protect them",
            detail: "Trip generation and power down control systems before the ransomware can reach them.",
            tradeoff: "Cost: a self-inflicted, potentially cascading outage — you do the attacker's work for them.",
            ops: 3, safety: 1, score: 35, good: false,
            riskTags: ["self-inflicted outage", "availability loss", "cascading risk"],
            consequence: "You take generation offline pre-emptively. The ransomware never reaches OT — but you have caused a major outage with its own stability and safety risks, and a long restoration.",
            expert: "Shutting down OT is the nuclear option. Isolate the path and keep operating; only shed load where safety genuinely requires it. Don't let the attacker win by your own hand."
          },
          {
            id: "C",
            label: "Keep the link up so IT tools can fight the ransomware",
            detail: "Leave the boundary open so the IT security stack can scan and remediate OT hosts.",
            tradeoff: "Cost: the same open path lets the ransomware walk straight into OT.",
            ops: 0, safety: 2, score: 15, good: false,
            riskTags: ["keeps door open", "shared path", "high spread risk"],
            consequence: "Within an hour the ransomware crosses the boundary and encrypts the historian and two HMIs. Generation is disrupted and a manual operating mode is declared. The incident just became an OT incident.",
            expert: "Never keep a bidirectional IT↔OT path open during a ransomware event. Segment first, remediate OT separately with clean, OT-appropriate tools."
          },
          {
            id: "D",
            label: "Restore IT from backups first, then check OT",
            detail: "Prioritise restoring IT services; OT looks unaffected, so deal with it afterwards.",
            tradeoff: "Cost: you ignore the live credential replay into the historian while it is still happening.",
            ops: 1, safety: 2, score: 25, good: false,
            riskTags: ["mis-prioritisation", "ignores live bridge", "reactive"],
            consequence: "While the IT team restores file servers, JMP-01 continues enumerating the historian. By the time OT is checked, the attacker has staging artifacts on the control network.",
            expert: "IT restoration and OT isolation must run in parallel. The live bridge is the immediate threat — close it before you optimise anything else."
          }
        ]
      },
      recover: {
        steps: [
          "Enforce segmentation for real — move to a unidirectional gateway / data diode for IT→OT flows",
          "Eliminate shared credentials; separate IT and OT identity with PAM and MFA",
          "Maintain offline, tested backups and golden images for PLCs, HMIs, and historians",
          "Execute the OT incident-response playbook and comms plan (internal, regulator, grid operator)",
          "Notify per regulation (NERC CIP / NIS2 / national CSIRT) and run a post-incident review"
        ],
        lesson: "A false sense of air-gap is the most expensive assumption in OT security. Segmentation must be enforced and tested — not assumed.",
        gap: "Segmentation · Resilience & Recovery"
      }
    }
  ];

  /* ------------------------------------------------------------------ *
   * MATURITY ASSESSMENT — 8 domains, 4 questions each (0–3 scale)
   * ------------------------------------------------------------------ */
  const SCALE = ["Not started", "Initial", "Managed", "Optimized"];

  const DOMAINS = [
    {
      id: "visibility",
      name: "Visibility",
      icon: "◉",
      desc: "Know what you have, what it is doing, and what changed.",
      questions: [
        "Do you maintain an up-to-date, authorised inventory of all OT devices (PLCs, RTUs, HMIs, engineering workstations)?",
        "Are network-traffic baselines established and regularly reviewed for the control network?",
        "Is there centralised logging and telemetry from OT devices and engineering workstations?",
        "Can you identify what is connected and what changed within minutes — not weeks?"
      ]
    },
    {
      id: "segmentation",
      name: "Segmentation",
      icon: "▦",
      desc: "Zone the network so a compromise cannot cross into the control layer.",
      questions: [
        "Is the OT network segmented into zones and conduits (e.g. control, field, safety) per IEC 62443?",
        "Is the IT/OT boundary enforced by a firewall/DMZ with a documented, reviewed ruleset?",
        "Is remote and vendor access isolated, time-boxed, and multi-factor authenticated?",
        "Are critical control flows protected (e.g. unidirectional gateway where required)?"
      ]
    },
    {
      id: "identity",
      name: "Identity & Access",
      icon: "⚿",
      desc: "Control who and what can touch operational systems.",
      questions: [
        "Are shared and default credentials eliminated across OT systems?",
        "Is multi-factor authentication enforced for remote and engineering access?",
        "Is privileged access managed (PAM/vault, session monitoring, least privilege)?",
        "Is access promptly reviewed and revoked when staff or vendors change?"
      ]
    },
    {
      id: "monitoring",
      name: "Monitoring & Detection",
      icon: "◈",
      desc: "Detect intrusions and integrity changes before they become incidents.",
      questions: [
        "Is OT-aware intrusion and malware detection deployed (deep packet inspection for ICS protocols)?",
        "Are PLC and configuration changes detected and alerted in near-real time?",
        "Are OT logs correlated with IT events in a SIEM?",
        "Is there a 24x7 monitoring capability (SOC) with OT expertise?"
      ]
    },
    {
      id: "incident",
      name: "Incident Response",
      icon: "⚑",
      desc: "Respond decisively when something goes wrong.",
      questions: [
        "Does an OT-specific incident-response playbook exist (containment, escalation, recovery)?",
        "Are IR roles, decision authority, and IT/OT coordination paths defined?",
        "Are OT incidents drilled regularly (tabletop and technical exercises)?",
        "Is there a defined escalation path to management, regulator, and grid operator?"
      ]
    },
    {
      id: "resilience",
      name: "Resilience & Recovery",
      icon: "↻",
      desc: "Restore operations quickly and safely after an event.",
      questions: [
        "Are offline, tested backups and golden images maintained for PLCs, HMIs, and historians?",
        "Can critical processes be restored within defined recovery time objectives?",
        "Are manual and fallback operating procedures available if control systems are unavailable?",
        "Is restoration rehearsed and backup integrity verified periodically?"
      ]
    },
    {
      id: "governance",
      name: "Governance",
      icon: "⌘",
      desc: "Set policy, risk management, and accountability.",
      questions: [
        "Is there an OT cybersecurity policy, risk-management process, and clear accountability (RACI)?",
        "Is the program aligned to frameworks and regulations (NIST CSF, IEC 62443, NERC CIP)?",
        "Is third-party and supply-chain risk assessed for OT vendors and integrators?",
        "Is cybersecurity embedded in procurement and change management (security by design)?"
      ]
    },
    {
      id: "ai",
      name: "AI Governance",
      icon: "◬",
      desc: "Harness AI safely — and defend against AI-enabled threats.",
      questions: [
        "Is there governance for AI/ML tools touching OT data (approval, data-flow review, risk)?",
        "Is human decision authority required for any OT action an AI recommends?",
        "Are AI-enabled threats (deepfakes, AI phishing, AI-generated payloads) in your threat model?",
        "Are AI tools red-teamed for hallucination, bias, and prompt injection before OT use?"
      ]
    }
  ];

  /* ------------------------------------------------------------------ *
   * AUDIT GUIDELINES
   * ------------------------------------------------------------------ */
  const AUDIT_CATEGORIES = [
    {
      id: "gov",
      name: "Governance & Policy",
      items: [
        { control: "OT cybersecurity policy approved and communicated", evidence: "Signed policy document, distribution and acknowledgement records", maps: ["NIST CSF GV.OC", "IEC 62443-2-1", "NERC CIP-003"] },
        { control: "Roles and accountability (RACI) for OT security", evidence: "Organisation chart, role definitions, RACI matrix", maps: ["NIST CSF GV.RR", "IEC 62443-2-4"] },
        { control: "Risk assessment and treatment for OT systems", evidence: "Risk register, treatment plan, review cadence", maps: ["NIST CSF ID.RA", "IEC 62443-3-2"] }
      ]
    },
    {
      id: "asset",
      name: "Asset & Configuration Management",
      items: [
        { control: "Authorised asset inventory of OT devices", evidence: "CMDB / inventory export with owners and criticality", maps: ["NIST CSF ID.AM", "NERC CIP-002"] },
        { control: "Secure baselines and hardening for OT hosts", evidence: "Baseline configurations, hardening guides, deviation logs", maps: ["NIST CSF PR.PS", "IEC 62443-4-2"] },
        { control: "Change management covering PLC logic (MOC)", evidence: "Change tickets, approvals, rollback plans", maps: ["NIST CSF ID.AM", "IEC 62443-2-4"] }
      ]
    },
    {
      id: "access",
      name: "Access Control",
      items: [
        { control: "Least privilege; default/shared credentials removed", evidence: "Account review reports, PAM records, credential vault", maps: ["NIST CSF PR.AA", "NERC CIP-005/007"] },
        { control: "MFA enforced for remote and engineering access", evidence: "MFA configuration, exception list, approval trail", maps: ["NIST CSF PR.AA", "NERC CIP-004"] },
        { control: "Session monitoring for privileged OT access", evidence: "PAM session recordings, review log", maps: ["NIST CSF DE.CM", "IEC 62443-2-4"] }
      ]
    },
    {
      id: "network",
      name: "Network Security & Segmentation",
      items: [
        { control: "Network zones and conduits per IEC 62443", evidence: "Network diagrams, zone/conduit model, data-flow maps", maps: ["IEC 62443-3-2/3-3", "NIST CSF PR.IR"] },
        { control: "IT/OT boundary enforced and reviewed", evidence: "Firewall/DMZ ruleset, periodic review records", maps: ["NERC CIP-005", "IEC 62443-3-3"] },
        { control: "Remote access controlled and time-boxed", evidence: "Vendor access requests, approvals, session logs", maps: ["NERC CIP-005", "IEC 62443-4-2"] }
      ]
    },
    {
      id: "detect",
      name: "Monitoring & Detection",
      items: [
        { control: "OT-aware monitoring (ICS protocol IDS/NDR)", evidence: "Coverage map, detection rules, sample alerts", maps: ["NIST CSF DE.CM", "IEC 62443-3-3 SR6.2"] },
        { control: "PLC / configuration change detection", evidence: "Change alerts, baseline comparison reports", maps: ["NIST CSF DE.CM", "IEC 62443-2-4"] },
        { control: "Centralised logging and SIEM correlation", evidence: "SIEM configuration, retention policy, correlation rules", maps: ["NIST CSF DE.CM", "NERC CIP-007"] }
      ]
    },
    {
      id: "ir",
      name: "Incident Response & Recovery",
      items: [
        { control: "OT incident-response playbook with defined roles", evidence: "Playbook, call tree, escalation matrix", maps: ["NIST CSF RS.MA", "IEC 62443-2-1"] },
        { control: "Exercises and tabletops conducted", evidence: "Exercise reports, findings, remediation tracking", maps: ["NIST CSF RS.MA", "IEC 62443-2-4"] },
        { control: "Offline, tested backups and golden images", evidence: "Backup schedule, restore test results", maps: ["NIST CSF RC.RP", "IEC 62443-4-1"] },
        { control: "Recovery objectives and manual fallback procedures", evidence: "RTO/RPO documentation, fallback procedures", maps: ["NIST CSF RC.RP", "IEC 62443-2-1"] }
      ]
    },
    {
      id: "ai",
      name: "AI & Emerging Technology",
      items: [
        { control: "AI governance and human-in-the-loop for OT", evidence: "AI policy, RACI, human-decision authority", maps: ["NIST AI RMF", "ISO/IEC 42001"] },
        { control: "AI/LLM tool risk and data-flow review", evidence: "Approval records, data-flow diagram, DPIA", maps: ["NIST AI RMF"] },
        { control: "AI-enabled threats covered in risk/threat model", evidence: "Threat model, red-team report", maps: ["NIST AI RMF", "MITRE ATLAS"] }
      ]
    },
    {
      id: "supply",
      name: "Supply Chain & Third Party",
      items: [
        { control: "Third-party risk assessment for OT vendors", evidence: "Vendor assessments, risk ratings, findings", maps: ["NIST CSF GV.SC", "NERC CIP-013"] },
        { control: "Security requirements in procurement contracts", evidence: "Contract clauses, security specifications", maps: ["NERC CIP-013", "IEC 62443-2-4"] }
      ]
    }
  ];

  const REGULATIONS = [
    { name: "NERC CIP (FERC)", scope: "North America — Bulk Electric System (BES)", focus: "CIP-002–014: asset identification, security management controls, personnel & training, electronic/ physical security perimeters, incident reporting & response planning, configuration change management, vulnerability assessments, information protection, and supply-chain risk (CIP-013).", relevance: "Mandatory for BES owners/operators. The direct compliance driver for most power utilities." },
    { name: "NIS2 Directive (EU)", scope: "European Union — energy is an essential sector", focus: "Risk-management measures, supply-chain security, management accountability and training, and incident reporting (24-hour early warning, 72-hour notification).", relevance: "Transposed into national law in EU member states; drives board-level accountability." },
    { name: "IEC 62443 (ISA/IEC)", scope: "Global — industrial automation & control systems", focus: "Zones and conduits (3-2), system security requirements (3-3), component requirements (4-2), secure product development (4-1), and certification (ISASecure).", relevance: "The engineering and procurement standard; embed it in design and vendor requirements." },
    { name: "NIST CSF 2.0", scope: "Global — voluntary framework", focus: "Govern, Identify, Protect, Detect, Respond, Recover — with OT-friendly subcategories and implementation examples.", relevance: "Best for program alignment and communicating risk to the board." },
    { name: "ISO/IEC 27001", scope: "Global — information security management", focus: "ISMS with Annex A controls; certification demonstrates a managed security program.", relevance: "Aligns the IT side and gives auditors a recognised baseline." },
    { name: "NIST AI RMF / ISO/IEC 42001", scope: "Global — AI governance", focus: "Govern, Map, Measure, Manage (NIST AI RMF); AI management system (42001).", relevance: "Essential once AI/ML tools touch OT data or decisions." }
  ];

  const COMMON_FINDINGS = [
    "Missing or outdated OT asset inventory and network diagrams",
    "Shared service accounts and no MFA on remote/engineering access",
    "Flat OT networks with an unenforced IT/OT boundary",
    "No PLC change detection or configuration-integrity monitoring",
    "Backups untested or online-only (encrypted along with production)",
    "No OT-specific incident-response playbook — IT-only plans",
    "Change management that does not cover PLC logic (MOC gaps)",
    "AI or third-party tools deployed without governance or data-flow review"
  ];

  /* ------------------------------------------------------------------ *
   * ROADMAP — quick wins vs strategic + phased timeline
   * ------------------------------------------------------------------ */
  const QUICK_WINS = [
    { domain: "Visibility", title: "Authorised OT asset inventory & network map", desc: "Build the authoritative list of PLCs, RTUs, HMIs and engineering workstations, with owners and criticality.", effort: "Low", impact: "High" },
    { domain: "Identity", title: "Eliminate shared/default credentials; MFA on remote access", desc: "Kill SVC-style shared accounts and enforce MFA for all remote and vendor access paths.", effort: "Low", impact: "High" },
    { domain: "Monitoring", title: "Baseline PLC configs & enable change detection", desc: "Store golden images and alert on any logic change — the fastest integrity win available.", effort: "Low", impact: "High" },
    { domain: "Segmentation", title: "Review & lock the IT/OT firewall ruleset", desc: "Close unused ports (445, 3389), remove legacy any-any rules, document the rest.", effort: "Low", impact: "High" },
    { domain: "Incident Response", title: "Tabletop the OT IR playbook", desc: "Run a 2-hour scenario with IT, engineering, and operations to surface decision gaps.", effort: "Low", impact: "Medium" },
    { domain: "Resilience", title: "Verify offline backups & golden images", desc: "Confirm restore works from offline media before you need it in anger.", effort: "Low", impact: "High" },
    { domain: "AI", title: "Start an AI governance register", desc: "Inventory every AI/ML tool touching OT data and tag its risk and decision authority.", effort: "Low", impact: "Medium" }
  ];

  const STRATEGIC = [
    { domain: "Monitoring", title: "OT-aware NDR/IDS + SIEM correlation", desc: "Deploy deep-packet inspection for ICS protocols and correlate OT and IT events.", effort: "High", impact: "High" },
    { domain: "Segmentation", title: "IEC 62443 zones/conduits + unidirectional gateway", desc: "Re-architect the IT/OT boundary to one-way data flow with a data diode.", effort: "High", impact: "High" },
    { domain: "Identity", title: "PAM + privileged session management for OT", desc: "Vaulted, audited, least-privilege access with session recording for engineering work.", effort: "Medium", impact: "High" },
    { domain: "Visibility", title: "Passive OT asset discovery & baselining", desc: "Continuous, passive visibility that stays current as the plant changes.", effort: "Medium", impact: "High" },
    { domain: "Incident Response", title: "Cross-functional OT SOC", desc: "Stand up 24x7 monitoring with analysts who understand both OT and IT.", effort: "High", impact: "High" },
    { domain: "Resilience", title: "Segmented, offline, tested recovery & failover drills", desc: "Prove you can restore a substation or plant within RTO — not on paper, in a drill.", effort: "High", impact: "High" },
    { domain: "Governance", title: "Security-by-design in procurement", desc: "Make IEC 62443 and hardening requirements a contract term for new systems.", effort: "Medium", impact: "Medium" },
    { domain: "AI", title: "AI detection co-pilot with human-in-the-loop + red team", desc: "Governed AI assistance for triage, adversarial testing, and clear human decision authority.", effort: "Medium", impact: "Medium" },
    { domain: "Governance", title: "Supply-chain risk program (CIP-013 style)", desc: "Assess and monitor OT vendors, integrators, and firmware sources.", effort: "Medium", impact: "Medium" }
  ];

  const ROADMAP_PHASES = [
    { phase: "0–3 months", title: "Quick wins & foundation", items: ["Asset inventory and network map", "Remove shared credentials; enable MFA", "Baseline PLC configs and turn on change detection", "Lock the IT/OT firewall ruleset", "Run the first OT IR tabletop"] },
    { phase: "3–6 months", title: "Visibility & detection", items: ["Deploy OT-aware NDR/IDS and SIEM correlation", "Introduce PAM for engineering access", "Design IEC 62443 zones and conduits", "Stand up centralised OT logging"] },
    { phase: "6–12 months", title: "Enforcement & hardening", items: ["Roll out network segmentation and unidirectional gateways", "Automate config-integrity monitoring", "Conduct backup/restore and failover drills", "Finalise OT IR playbooks and comms plans"] },
    { phase: "12–18 months", title: "Optimise & scale", items: ["Cross-functional OT SOC with 24x7 coverage", "Governed AI assistance with human-in-the-loop", "Security-by-design in procurement and supply chain", "Continuous improvement against NIST CSF / IEC 62443"] }
  ];

  /* ------------------------------------------------------------------ *
   * FRAMEWORKS & RESOURCES
   * ------------------------------------------------------------------ */
  const FRAMEWORKS = [
    { org: "NIST", name: "Cybersecurity Framework 2.0", focus: "Govern, Identify, Protect, Detect, Respond, Recover — with OT implementation examples.", relevance: "Strategic alignment & board communication.", url: "https://www.nist.gov/cyberframework" },
    { org: "ISA / IEC", name: "IEC 62443", focus: "Zones & conduits, security levels, system/component requirements, secure development.", relevance: "Engineering & procurement standard for OT/IACS.", url: "https://www.isa.org/standards-and-publications/isa-standards/isa-iec-62443-series-of-standards" },
    { org: "NERC / FERC", name: "NERC CIP", focus: "Reliability standards (CIP-002–014) for BES cyber systems.", relevance: "Mandatory compliance for North American bulk power.", url: "https://www.nerc.com/pa/Stand/Pages/CIPStandards.aspx" },
    { org: "MITRE", name: "ATT&CK for ICS", focus: "Adversary tactics and techniques mapped to industrial control systems.", relevance: "Threat modeling & detection coverage.", url: "https://attack.mitre.org/matrices/ics/" },
    { org: "MITRE", name: "ATLAS", focus: "Adversarial threat landscape for AI/ML systems.", relevance: "AI-enabled threat modeling & defense.", url: "https://atlas.mitre.org/" },
    { org: "NIST", name: "AI Risk Management Framework", focus: "Govern, Map, Measure, Manage for AI risk.", relevance: "AI governance for tools touching OT.", url: "https://www.nist.gov/itl/ai-risk-management-framework" },
    { org: "CISA / NSA", name: "Cross-Sector Cybersecurity Performance Goals", focus: "Prioritised baseline controls common across critical infrastructure.", relevance: "Practical quick wins & audit baselines.", url: "https://www.cisa.gov/cross-sector-cybersecurity-performance-goals" },
    { org: "ISO", name: "ISO/IEC 27001 & 42001", focus: "Information security management system (27001); AI management system (42001).", relevance: "Recognised audit baselines for IT and AI.", url: "https://www.iso.org/" },
    { org: "SANS", name: "ICS410 / ICS515", focus: "ICS/SCADA security essentials and active defense for ICS.", relevance: "Skills & awareness for OT security teams.", url: "https://www.sans.org/cyber-security-courses/" }
  ];

  const NEXT_STEPS = [
    "Run this maturity assessment quarterly and track the radar over time",
    "Schedule an OT incident-response tabletop within 30 days — involve IT, engineering and operations",
    "Deliver the 90-day quick wins: inventory, MFA, PLC change detection, firewall review",
    "Map your program to NERC CIP / IEC 62443 (or NIS2) and close the top three gaps",
    "Establish AI governance before any AI/ML tool touches OT data or decisions",
    "Engage an OT-aware assessor or integrator for an independent gap validation",
    "Define pre-approved containment thresholds so responders never wait for sign-off"
  ];

  /* ------------------------------------------------------------------ *
   * FACILITATOR RUN OF SHOW
   * ------------------------------------------------------------------ */
  const RUN_OF_SHOW = [
    { time: "00:00–05:00", section: "Framing & the Decision Framework", what: "Set learning objectives and ground rules (decisions have consequences; there are no perfect answers — only trade-offs). Walk the See → Understand → Decide → Act → Recover framework.", prompts: ["Which step does your organisation do best — See or Understand?"] },
    { time: "05:00–10:00", section: "Stage 1 · Engineering Workstation", what: "Work SEE and UNDERSTAND together, have the room vote on DECIDE, reveal consequences, then discuss the expert note.", prompts: ["Who would notice this in your plant — and how fast?", "Do you know every shared service account in OT?"] },
    { time: "10:00–15:00", section: "Stage 2 · Unauthorized PLC Changes", what: "Emphasise safety impact and Management-of-Change. Compare 'trip the unit' vs 'revert to golden image'.", prompts: ["Who has authority to trip a unit — and is it documented?", "Could you detect a logic change in near-real time?"] },
    { time: "15:00–20:00", section: "Stage 3 · AI-Generated Alerts", what: "Discuss hallucination, confidence vs correctness, and human-in-the-loop. Ask who already runs AI tools against OT data.", prompts: ["Do you trust your AI tools enough to act — or only to suggest?", "What governance covers AI touching OT data today?"] },
    { time: "20:00–25:00", section: "Stage 4 · IT-to-OT Ransomware", what: "Run under time pressure. Stress segmentation, shared credentials, and IT/OT coordination. Reveal consequences and debrief.", prompts: ["Is your IT/OT boundary real or assumed?", "What is your crown jewel, and what is your cut point?"] },
    { time: "25:00–28:00", section: "Incident Debrief", what: "Review the decision log and Decision Quality gauge. Extract the recurring lessons: identity, segmentation, visibility, governance.", prompts: ["What is the single most expensive assumption you saw today?"] },
    { time: "28:00–33:00", section: "Maturity Assessment", what: "Have each participant (or table) complete the 8-domain assessment. Discuss the radar and the top three gaps.", prompts: ["Where is your biggest gap — and why does it exist?"] },
    { time: "33:00–40:00", section: "Audit-readiness & Regulatory Expectations", what: "Walk the audit checklist, evidence mapping, and regulatory table (NERC CIP / NIS2 / IEC 62443). Highlight common findings.", prompts: ["Which regulator applies to you, and what is your reporting threshold?"] },
    { time: "40:00–45:00", section: "Roadmap, Quick Wins & Next Steps", what: "Sort quick wins vs strategic initiatives, agree the phased roadmap, and capture personal action items. Close with resources.", prompts: ["What is your first 30-day win — and who owns it?"] }
  ];

  const FACILITATOR_TIPS = [
    "Project the lab on a shared screen or let participants run it in pairs — both work well.",
    "Keep it a safe learning space (Chatham House rule): the goal is better decisions, not blame.",
    "Pause after each consequence reveal — the discussion is where the learning happens.",
    "Use the decision log in the Report view to replay and compare choices across tables.",
    "Adjust timing: the lab stages can compress to 3 minutes or expand to 10 for deep discussion."
  ];

  return {
    SCENARIOS,
    SCALE,
    DOMAINS,
    AUDIT_CATEGORIES,
    REGULATIONS,
    COMMON_FINDINGS,
    QUICK_WINS,
    STRATEGIC,
    ROADMAP_PHASES,
    FRAMEWORKS,
    NEXT_STEPS,
    RUN_OF_SHOW,
    FACILITATOR_TIPS
  };
})();
