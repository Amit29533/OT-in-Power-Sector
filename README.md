# OT-in-Power-Sector — Interactive OT Cyber Incident Decision Lab

An interactive, self-contained web training lab for operational-technology (OT) cybersecurity
in the power &amp; energy sector. It packages a 45-minute training module —
**Incident simulation · Audit guidelines · Cybersecurity maturity roadmap** — into a single,
zero-dependency web application.

## What's inside

| Module | What it delivers |
| --- | --- |
| **Overview / Briefing** | Learning objectives, 45-minute agenda, and the *See → Understand → Decide → Act → Recover* decision framework |
| **Incident Lab** | A progressive 4-stage OT cyber-incident simulation with decisions, consequences, and impact meters |
| **Maturity Assessment** | An 8-domain self-assessment (Visibility, Segmentation, Identity, Monitoring, Incident Response, Resilience, Governance, AI) with a live radar chart and gap analysis |
| **Audit Guidelines** | Interactive audit-readiness checklist with evidence mapping, regulatory expectations (NERC CIP, NIS2, IEC 62443, NIST CSF 2.0, NIST AI RMF), and common findings |
| **Maturity Roadmap** | Quick wins (0–90 days) vs strategic initiatives (3–18 months) + an 18-month phased timeline |
| **Resources & Frameworks** | Reference frameworks and practical next steps |
| **Facilitator Guide** | A ready-to-deliver run of show with timings and discussion prompts |
| **Report** | A consolidated, printable summary of the participant's decisions, maturity, audit-readiness, and roadmap |

## The simulation

Participants walk through four escalating scenarios using the
**See → Understand → Decide → Act → Recover** framework:

1. **Suspicious engineering workstation activity** — initial access via shared credentials
   and unmanaged remote access.
2. **Unauthorized PLC changes** — tampering with a breaker safety interlock.
3. **AI-generated security alerts** — separating hallucinated noise from real signal, and
   governing AI-assisted detection.
4. **IT-to-OT ransomware propagation** — the decisive IT/OT boundary decision.

Each decision is scored for decision quality and its operational &amp; safety impact, with an
expert debrief and a closing incident review.

## Running it

This is a static site with no build step and no dependencies.

```bash
# from the repository root
python3 -m http.server 8000 --bind 0.0.0.0
# open http://localhost:8000
```

Any static file server works (e.g. `npx serve`, VS Code Live Server, nginx).

## Structure

```
index.html       App shell (header, nav, view containers)
styles.css       Control-room themed styling
js/data.js       All content: scenarios, assessment, audit, roadmap, frameworks
js/sim.js        Incident simulation engine (state machine + rendering)
js/assess.js     Maturity assessment + SVG radar chart
js/app.js        App shell: navigation, audit, roadmap, resources, facilitator, report
```

Progress (simulation decisions, maturity answers, audit checklist) persists in
`localStorage`. Use **Reset all progress** in the footer to start fresh.

## Notes

- For **training and awareness purposes only** — not a substitute for operational
  procedures or formal compliance advice.
- Framework references (NERC CIP, NIS2, IEC 62443, NIST CSF 2.0, NIST AI RMF, MITRE
  ATT&amp;CK for ICS / ATLAS) are cited for context; always verify against the current
  version of each standard for your jurisdiction.

## License

Apache-2.0 (see [LICENSE](LICENSE)).
