# Strait Watch
### AI-Driven Energy Supply Chain Resilience for Import-Dependent Economies

A working prototype for the challenge theme *Supply Chain Intelligence /
Energy Security / Geopolitical Risk*. India sources ~88% of its crude oil
from imports, with 40–45% transiting the Strait of Hormuz — a structural
vulnerability that repeated geopolitical shocks (2025 US–Iran standoff,
Red Sea attacks, sanctions pressure) have stress-tested. Strait Watch turns
that risk into a continuously monitored, decision-ready system across five
cooperating agents.

**[Live prototype → `index.html`](./index.html)** · no build step, no
external services required, runs fully offline.

---

## What's inside

| Agent | What it does | Where |
|---|---|---|
| **Geopolitical Risk Intelligence Agent** | Weighted composite risk score per corridor from four signal families (tension, incidents, sanctions, congestion), live-ticking | `js/engines.js → Engines.risk`, view: *Risk Intelligence* |
| **Disruption Scenario Modeller** | Converts an event + severity + duration into a supply gap, then cascades it through refinery run-rate, retail fuel price, power-sector stress, GDP drag, and SPR depletion | `js/engines.js → Engines.scenario`, view: *Scenario Simulator* |
| **Adaptive Procurement Orchestrator** | Multi-criteria weighted-sum ranking of alternate crude sources (cost, availability, distance, refinery compatibility, live corridor risk) + greedy gap allocation | `js/engines.js → Engines.procurement`, view: *Procurement Orchestrator* |
| **Strategic Reserve Optimisation Agent** | Smooths SPR drawdown across the disruption window and computes a lead-time-aware reorder trigger day | `js/engines.js → Engines.reserve`, view: *Reserve Optimizer* |
| **Supply Chain Digital Twin** | Stylised geospatial model of chokepoints, corridors, and India's coastal refineries, with a one-click reroute overlay | `js/digitalTwin.js`, view: *Digital Twin* |

A **Command Center** dashboard aggregates all five into one view, and an
**Architecture** page maps every judging criterion to the part of the
system that satisfies it.

## Running it

No dependencies, no build step:

```bash
# Option 1 — just open it
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux

# Option 2 — serve it (avoids browser file:// restrictions on some setups)
python3 -m http.server 8080
# then visit http://localhost:8080
```

Deploys as-is to GitHub Pages: push this folder to a repo, enable Pages on
`main` / root, done.

## Why the data is mocked (and how it stops being mocked)

Every "signal" in this prototype — corridor tension, incident counts,
sanctions severity, supplier costs and availability — is a hand-built,
order-of-magnitude illustrative value, not a live feed. That's a deliberate
scope decision for a hackathon timeline, not a hidden limitation:

- `js/data.js` is the **only** file that would change to go live. It's kept
  separate from every engine on purpose.
- Real replacements: AIS vessel tracking (Spire/MarineTraffic) for
  congestion and tanker positions, GDELT/news NLP for tension and incident
  counts, OFAC/UN registries for sanctions severity, commodity price feeds
  for supplier cost.
- None of the scoring, cascade, ranking, or optimisation **logic** in
  `engines.js` depends on the data being mocked — it operates on the same
  shape of numbers either way.

## Model assumptions (stated so they're testable)

- Risk score = `0.40·tension + 0.25·min(incidents×10,100) + 0.20·sanctions + 0.15·congestion`
- Refinery run-rate impact = `1.8× the import-gap ratio`, capped at 40%
- Retail fuel pass-through elasticity = `0.6× the import-gap ratio` on a ₹96/L reference price
- GDP drag = `8 bps per 1% sustained import gap`, scaled by `duration/30 days`
- Max SPR daily drawdown capped at `15%` of baseline daily imports
- Procurement score = `0.30·(1−cost) + 0.20·availability + 0.15·(1−distance) + 0.20·compatibility + 0.15·(1−corridor risk)`, min-max normalised
- Reserve reorder day = day cover would cross the safety floor, **minus** the 21-day average procurement lead time

Every constant above lives as a named value at the top of `engines.js` — change
one, reload, and the whole system recomputes consistently.

## Judging criteria mapping

| Criteria | Weight | Where it shows up |
|---|---|---|
| Innovation | 25% | One closed loop: live risk score feeds both the procurement ranking and the reserve smoothing model simultaneously |
| Business Impact | 25% | Scenario outputs are decision-ready — INR/litre, GDP bps, refinery run-rate — not just an abstract risk number |
| Technical Excellence | 20% | Explicit, named, documented formulas; deterministic and re-testable; zero external runtime dependencies |
| Scalability | 15% | Data model (`data.js`) fully separated from logic (`engines.js`) — swap mock feeds for live ones without touching a single formula |
| User Experience | 15% | One command center, six focused modules, a live pulse-strip signature element, no dead-end screens |

## Project structure

```
strait-watch/
├── index.html                    # entry point
├── css/styles.css                # design system + layout
├── js/
│   ├── data.js                   # domain data (corridors, ports, suppliers, scenarios)
│   ├── engines.js                # risk / scenario / procurement / reserve logic
│   ├── charts.js                 # dependency-free SVG chart helpers
│   ├── digitalTwin.js            # geospatial projection + map renderer
│   └── app.js                    # state, routing, view rendering
└── docs/
    ├── architecture-diagram.svg  # system architecture (also shown in-app)
    └── demo-video-script.md      # scene-by-scene recording script
```

## Roadmap beyond the prototype

- Real ingestion connectors behind `data.js` (AIS, news NLP, sanctions registries)
- A learned ranker replacing the weighted-sum procurement/risk models once outcome data exists
- A knowledge graph (supplier ↔ corridor ↔ refinery ↔ policy) behind the digital twin for causal "why" queries
- Wiring the reorder trigger into an actual e-procurement workflow with human-in-the-loop approval

---
*Built for the "AI-Driven Energy Supply Chain Resilience for Import-Dependent Economies" challenge. All figures are illustrative and intended to demonstrate a testable model, not to represent verified real-time intelligence.*
