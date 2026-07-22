/**
 * STRAIT WATCH — Application shell
 * -----------------------------------
 * Owns app state (live signals, alert log, scenario/reserve/procurement
 * results), routing between views, and rendering. Kept dependency-free
 * (no build step, no CDN chart library) so the prototype runs offline
 * straight from index.html.
 */

const App = {
  state: {
    view: "dashboard",
    signals: {}, // corridorId -> {tension, incidents, sanctions, congestion}
    history: {}, // corridorId -> [{t, score}]
    alerts: [],
    tick: 0,
    scenario: { templateId: "hormuz_closure", severity: 35, duration: 21, result: null },
    reroute: false,
  },

  init() {
    DATA.corridors.forEach((c) => {
      App.state.signals[c.id] = { ...c.baseline };
      App.state.history[c.id] = [];
    });
    App.pushAlert("SYSTEM", "Strait Watch initialised. Monitoring 4 corridors, 10 domestic nodes.", "info");
    App.renderShell();
    App.tickSignals(); // seed first score
    App.navigate("dashboard");
    setInterval(App.tickSignals, 3500);
  },

  corridorScores() {
    const out = {};
    DATA.corridors.forEach((c) => {
      out[c.id] = Engines.risk.scoreCorridor(App.state.signals[c.id]);
    });
    return out;
  },

  tickSignals() {
    App.state.tick += 1;
    DATA.corridors.forEach((c) => {
      const s = App.state.signals[c.id];
      // bounded random walk around baseline signal channels
      s.tension = App.clamp(s.tension + (Math.random() - 0.5) * 6, 0, 100);
      s.incidents = App.clamp(s.incidents + (Math.random() < 0.15 ? (Math.random() < 0.5 ? -1 : 1) : 0), 0, 20);
      s.sanctions = App.clamp(s.sanctions + (Math.random() - 0.5) * 2, 0, 100);
      s.congestion = App.clamp(s.congestion + (Math.random() - 0.5) * 5, 0, 100);
      const score = Engines.risk.scoreCorridor(s);
      const hist = App.state.history[c.id];
      hist.push({ t: App.state.tick, score });
      if (hist.length > 40) hist.shift();

      const prevScore = hist.length > 1 ? hist[hist.length - 2].score : score;
      if (score >= 70 && prevScore < 70) {
        App.pushAlert(c.name.toUpperCase(), `Corridor risk entered SEVERE band (${score}/100).`, "danger");
      } else if (score >= 45 && prevScore < 45) {
        App.pushAlert(c.name.toUpperCase(), `Corridor risk entered ELEVATED band (${score}/100).`, "warn");
      }
    });
    if (!document.getElementById("view-root")) return; // shell not mounted yet
    if (document.getElementById("pulse-readout")) App.renderPulseStrip();
    if (App.state.view === "dashboard") App.renderDashboard();
    if (App.state.view === "risk") App.renderRisk();
    if (App.state.view === "twin") App.renderTwin();
  },

  clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },

  pushAlert(source, message, level) {
    App.state.alerts.unshift({ source, message, level, time: new Date().toLocaleTimeString() });
    if (App.state.alerts.length > 30) App.state.alerts.pop();
  },

  /* ---------------------------- SHELL / NAV ---------------------------- */
  renderShell() {
    const root = document.getElementById("app");
    root.innerHTML = `
      <header class="app-header">
        <div class="brand">
          <svg class="brand-mark" viewBox="0 0 40 40" width="30" height="30">
            <path d="M20 3 L35 11 V22 C35 30 28 35 20 37 C12 35 5 30 5 22 V11 Z" fill="none" stroke="var(--flare-500)" stroke-width="2.4"/>
            <path d="M13 21 L18 26 L28 14" fill="none" stroke="var(--paper-100)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div class="brand-text">
            <span class="brand-name">STRAIT WATCH</span>
            <span class="brand-tagline">Energy Supply Chain Resilience Intelligence</span>
          </div>
        </div>
        <nav class="main-nav" id="main-nav"></nav>
      </header>
      <div class="pulse-strip" id="pulse-strip"></div>
      <main id="view-root"></main>
      <footer class="app-footer">
        Prototype build · illustrative data model · not connected to live AIS/news feeds ·
        built for the "AI-Driven Energy Supply Chain Resilience" challenge
      </footer>
    `;
    const navItems = [
      ["dashboard", "Command Center"],
      ["risk", "Risk Intelligence"],
      ["scenario", "Scenario Simulator"],
      ["procurement", "Procurement Orchestrator"],
      ["reserve", "Reserve Optimizer"],
      ["twin", "Digital Twin"],
      ["about", "Architecture"],
    ];
    document.getElementById("main-nav").innerHTML = navItems
      .map(([id, label]) => `<button class="nav-btn" data-view="${id}" onclick="App.navigate('${id}')">${label}</button>`)
      .join("");
    App.renderPulseStrip();
  },

  navigate(view) {
    App.state.view = view;
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    const map = {
      dashboard: App.renderDashboard, risk: App.renderRisk, scenario: App.renderScenario,
      procurement: App.renderProcurement, reserve: App.renderReserve, twin: App.renderTwin, about: App.renderAbout,
    };
    (map[view] || App.renderDashboard)();
  },

  renderPulseStrip() {
    const scores = App.corridorScores();
    const composite = Engines.risk.compositeExposure(scores);
    const hist = App.state.history["hormuz"] || [];
    const pts = hist.slice(-24).map((h) => h.score);
    const el = document.getElementById("pulse-strip");
    if (!el) return;
    el.innerHTML = `
      <div class="pulse-readout" id="pulse-readout">
        <span class="pulse-label">COMPOSITE CORRIDOR RISK</span>
        <span class="pulse-value ${Engines.risk.band(composite).cls}">${composite}<small>/100</small></span>
      </div>
      <div class="pulse-wave">${Charts.sparkline(pts, { w: 520, h: 34, stroke: "var(--flare-500)" })}</div>
      <div class="pulse-time">t+${App.state.tick} · live signal simulation</div>
    `;
  },

  /* ---------------------------- DASHBOARD ---------------------------- */
  renderDashboard() {
    const scores = App.corridorScores();
    const composite = Engines.risk.compositeExposure(scores);
    const sprCover = DATA.meta.sprCoverDaysBaseline;

    const root = document.getElementById("view-root");
    root.innerHTML = `
      <section class="view">
        <h1 class="view-title">Command Center</h1>
        <p class="view-sub">Composite view across all four agents — updated every simulation tick.</p>

        <div class="kpi-grid">
          ${App.kpiCard("Composite Risk Exposure", composite + "/100", Engines.risk.band(composite).label, Engines.risk.band(composite).cls)}
          ${App.kpiCard("Strategic Reserve Cover", sprCover.toFixed(1) + " days", "baseline national cover", "risk-guarded")}
          ${App.kpiCard("Import Dependency", DATA.meta.importDependencyPct + "%", "of domestic consumption", "risk-elevated")}
          ${App.kpiCard("Active Alerts", App.state.alerts.filter(a => a.level !== "info").length, "since session start", "risk-severe")}
        </div>

        <div class="grid-2">
          <div class="panel">
            <h2>Corridor Risk Breakdown</h2>
            ${Charts.corridorBars(scores)}
          </div>
          <div class="panel">
            <h2>Live Alert Feed</h2>
            <div class="alert-feed">${App.renderAlerts(8)}</div>
          </div>
        </div>

        <div class="panel">
          <h2>What this Command Center demonstrates</h2>
          <ul class="check-list">
            <li>Continuous corridor risk scoring (Geopolitical Risk Intelligence Agent)</li>
            <li>Scenario-to-impact cascade modelling with an explicit, editable assumption set (Disruption Scenario Modeller)</li>
            <li>Multi-criteria supplier ranking + allocation under a live risk score (Adaptive Procurement Orchestrator)</li>
            <li>Reserve drawdown smoothing and a lead-time-aware reorder trigger (Strategic Reserve Optimisation Agent)</li>
            <li>A geospatial digital twin of chokepoints, corridors and domestic refineries (Supply Chain Digital Twin)</li>
          </ul>
        </div>
      </section>
    `;
  },

  kpiCard(label, value, sub, cls) {
    return `<div class="kpi-card"><div class="kpi-label">${label}</div><div class="kpi-value ${cls}">${value}</div><div class="kpi-sub">${sub}</div></div>`;
  },

  renderAlerts(limit) {
    const list = App.state.alerts.slice(0, limit || App.state.alerts.length);
    if (!list.length) return `<div class="alert-empty">No alerts yet.</div>`;
    return list.map((a) => `
      <div class="alert-row alert-${a.level}">
        <span class="alert-dot"></span>
        <div>
          <div class="alert-msg"><strong>${a.source}</strong> — ${a.message}</div>
          <div class="alert-time">${a.time}</div>
        </div>
      </div>`).join("");
  },

  /* ---------------------------- RISK INTELLIGENCE ---------------------------- */
  renderRisk() {
    const scores = App.corridorScores();
    const root = document.getElementById("view-root");
    root.innerHTML = `
      <section class="view">
        <h1 class="view-title">Geopolitical Risk Intelligence</h1>
        <p class="view-sub">Adjust the underlying signal channels for each corridor and watch the composite score respond in real time — this is the live tuning surface behind the multi-source ingestion agent.</p>
        <div class="risk-grid">
          ${DATA.corridors.map((c) => App.riskCorridorPanel(c, scores[c.id])).join("")}
        </div>
        <div class="panel">
          <h2>Scoring model</h2>
          <p class="model-note">score = 0.40·tension + 0.25·incidents(×10, capped) + 0.20·sanctions + 0.15·congestion, clamped to [0,100]. Weights are configurable in <code>engines.js → Engines.risk.weights</code>.</p>
        </div>
      </section>
    `;
  },

  riskCorridorPanel(corridor, score) {
    const s = App.state.signals[corridor.id];
    const band = Engines.risk.band(score);
    const hist = App.state.history[corridor.id].map((h) => h.score);
    return `
      <div class="panel corridor-panel">
        <div class="corridor-head">
          <h2>${corridor.name}</h2>
          <span class="badge ${band.cls}">${band.label} · ${score}</span>
        </div>
        <p class="corridor-note">${corridor.note} · ${corridor.sharePct}% of India's crude imports</p>
        ${Charts.sparkline(hist, { w: 260, h: 40, stroke: "var(--teal-400)" })}
        ${App.sliderRow(corridor.id, "tension", "Geopolitical tension", s.tension, 0, 100)}
        ${App.sliderRow(corridor.id, "incidents", "Reported incidents (30d)", s.incidents, 0, 20)}
        ${App.sliderRow(corridor.id, "sanctions", "Sanctions severity", s.sanctions, 0, 100)}
        ${App.sliderRow(corridor.id, "congestion", "Tanker / port congestion", s.congestion, 0, 100)}
      </div>
    `;
  },

  sliderRow(corridorId, field, label, value, min, max) {
    return `
      <div class="slider-row">
        <label>${label} <span class="slider-value" id="val-${corridorId}-${field}">${Math.round(value)}</span></label>
        <input type="range" min="${min}" max="${max}" value="${value}"
          oninput="App.onSignalChange('${corridorId}','${field}',this.value)" />
      </div>`;
  },

  onSignalChange(corridorId, field, value) {
    App.state.signals[corridorId][field] = Number(value);
    document.getElementById(`val-${corridorId}-${field}`).textContent = Math.round(value);
    App.renderRisk();
    App.renderPulseStrip();
  },

  /* ---------------------------- SCENARIO SIMULATOR ---------------------------- */
  renderScenario() {
    const st = App.state.scenario;
    const template = DATA.scenarioTemplates.find((t) => t.id === st.templateId);
    if (!st.result) st.result = Engines.scenario.cascade(st.templateId, st.severity, st.duration);
    const r = st.result;

    const root = document.getElementById("view-root");
    root.innerHTML = `
      <section class="view">
        <h1 class="view-title">Disruption Scenario Modeller</h1>
        <p class="view-sub">Choose an event, set severity and duration, and the model cascades the supply gap through refining, retail prices, the power sector, GDP drag and the strategic reserve — assumptions stated explicitly below.</p>

        <div class="panel">
          <div class="scenario-controls">
            <div class="control-group">
              <label>Scenario</label>
              <select id="scenario-select" onchange="App.onScenarioChange(this.value)">
                ${DATA.scenarioTemplates.map((t) => `<option value="${t.id}" ${t.id === st.templateId ? "selected" : ""}>${t.label}</option>`).join("")}
              </select>
              <p class="model-note">${template.description}</p>
            </div>
            <div class="control-group">
              <label>${template.severityLabel} <span class="slider-value">${st.severity}${template.severityUnit}</span></label>
              <input type="range" min="0" max="${template.severityMax}" value="${st.severity}" oninput="App.onSeverityChange(this.value)"/>
            </div>
            <div class="control-group">
              <label>Duration <span class="slider-value">${st.duration} days</span></label>
              <input type="range" min="3" max="60" value="${st.duration}" oninput="App.onDurationChange(this.value)"/>
            </div>
          </div>
        </div>

        <div class="kpi-grid">
          ${App.kpiCard("Supply Gap", r.gapMbd + " mbd", r.gapRatioPct + "% of total imports", "risk-severe")}
          ${App.kpiCard("Refinery Run-Rate Impact", "-" + r.refineryRunRateImpactPct + "%", "vs. planned throughput", "risk-elevated")}
          ${App.kpiCard("Retail Fuel Impact", "+₹" + r.fuelPriceImpactINR, "per litre, illustrative pass-through", "risk-elevated")}
          ${App.kpiCard("Power Sector Stress", r.powerStressIndex + "/100", "backup-generation + grid strain proxy", "risk-guarded")}
          ${App.kpiCard("GDP Drag", r.gdpImpactBps + " bps", "if sustained for " + r.durationDays + " days", "risk-severe")}
          ${App.kpiCard("SPR Exhaustion", r.daysToExhaustion === Infinity ? "no depletion" : r.daysToExhaustion + " days", "at current drawdown rate", "risk-severe")}
        </div>

        <div class="panel">
          <h2>Strategic Reserve — Cover Depletion</h2>
          ${Charts.lineChart(r.series.map((s) => s.coverDays), { w: 820, h: 180, stroke: "var(--flare-500)", yLabel: "days cover" })}
        </div>

        <div class="panel">
          <h2>Model assumptions (explicit &amp; testable)</h2>
          <ul class="check-list">
            <li>Refinery run-rate sensitivity: 1.8× the import-gap ratio, capped at 40% throughput loss</li>
            <li>Retail fuel pass-through elasticity: 0.6× the import-gap ratio, applied to a ₹96/L reference price</li>
            <li>GDP sensitivity: 8 bps of growth drag per 1% sustained import gap, scaled by duration/30 days</li>
            <li>Max daily SPR drawdown capped at 15% of baseline daily imports</li>
          </ul>
          <button class="ghost-btn" onclick="App.navigate('procurement')">→ Send this gap to the Procurement Orchestrator</button>
        </div>
      </section>
    `;
  },

  onScenarioChange(id) { App.state.scenario.templateId = id; App.recalcScenario(); },
  onSeverityChange(v) { App.state.scenario.severity = Number(v); App.recalcScenario(); },
  onDurationChange(v) { App.state.scenario.duration = Number(v); App.recalcScenario(); },
  recalcScenario() {
    const st = App.state.scenario;
    st.result = Engines.scenario.cascade(st.templateId, st.severity, st.duration);
    App.renderScenario();
  },

  /* ---------------------------- PROCUREMENT ORCHESTRATOR ---------------------------- */
  renderProcurement() {
    const st = App.state.scenario;
    if (!st.result) st.result = Engines.scenario.cascade(st.templateId, st.severity, st.duration);
    const scores = App.corridorScores();
    const { allocations, unmetGapMbd } = Engines.procurement.rank(st.result.gapMbd, scores);

    const root = document.getElementById("view-root");
    root.innerHTML = `
      <section class="view">
        <h1 class="view-title">Adaptive Procurement Orchestrator</h1>
        <p class="view-sub">Ranks alternate crude sources with a weighted multi-criteria score (cost, availability, distance, refinery compatibility, live corridor risk) and greedily allocates the ${st.result.gapMbd} mbd gap from the current scenario.</p>

        <div class="panel">
          <h2>Recommended sourcing plan</h2>
          <table class="data-table">
            <thead><tr><th>Rank</th><th>Supplier</th><th>Score</th><th>Cost / bbl</th><th>Distance (nm)</th><th>Compatibility</th><th>Corridor risk</th><th>Allocation</th></tr></thead>
            <tbody>
              ${allocations.map((a, i) => `
                <tr class="${a.allocatedMbd > 0 ? "row-active" : ""}">
                  <td>${i + 1}</td>
                  <td>${a.name}</td>
                  <td><span class="badge ${a.score > 60 ? "risk-low" : a.score > 40 ? "risk-guarded" : "risk-elevated"}">${a.score}</span></td>
                  <td>$${a.costPerBbl}</td>
                  <td>${a.distanceNm.toLocaleString()}</td>
                  <td>${Math.round(a.compatibility * 100)}%</td>
                  <td>${a.riskScore}/100</td>
                  <td>${a.allocatedMbd > 0 ? a.allocatedMbd + " mbd" : "—"}</td>
                </tr>`).join("")}
            </tbody>
          </table>
          ${unmetGapMbd > 0 ? `<p class="warn-note">⚠ ${unmetGapMbd} mbd of the gap remains unmet by current incremental capacity — escalate to reserve drawdown.</p>` : `<p class="ok-note">✓ Gap fully covered by ranked alternate sources.</p>`}
        </div>

        <div class="panel">
          <h2>Scoring model</h2>
          <p class="model-note">score = 0.30·(1−cost) + 0.20·availability + 0.15·(1−distance) + 0.20·compatibility + 0.15·(1−corridor risk), each metric min-max normalised across the supplier set, weighted sum × 100.</p>
          <button class="ghost-btn" onclick="App.navigate('reserve')">→ Cover the unmet gap with the Reserve Optimizer</button>
        </div>
      </section>
    `;
  },

  /* ---------------------------- RESERVE OPTIMIZER ---------------------------- */
  renderReserve() {
    const st = App.state.scenario;
    if (!st.result) st.result = Engines.scenario.cascade(st.templateId, st.severity, st.duration);
    const opt = Engines.reserve.optimize(st.result);

    const root = document.getElementById("view-root");
    root.innerHTML = `
      <section class="view">
        <h1 class="view-title">Strategic Reserve Optimisation Agent</h1>
        <p class="view-sub">Smooths the reserve drawdown across the disruption window and computes a lead-time-aware replenishment trigger, so policymakers see the decision point before the reserve breaches its safety floor.</p>

        <div class="kpi-grid">
          ${App.kpiCard("Smoothed Daily Drawdown", opt.smoothedDailyMbd + " mbd", "capped at 15% of baseline imports", "risk-elevated")}
          ${App.kpiCard("Safety Floor", opt.safetyFloorDays + " days", "minimum acceptable cover", "risk-guarded")}
          ${App.kpiCard("Days to Safety Floor", opt.daysToSafetyFloor ?? "—", "at smoothed drawdown rate", "risk-severe")}
          ${App.kpiCard("Reorder Trigger", opt.reorderDay !== null ? "day " + opt.reorderDay : "not required", opt.leadTimeDays + " day lead time factored in", "risk-elevated")}
        </div>

        <div class="panel">
          <h2>Reserve cover — smoothed schedule</h2>
          ${Charts.lineChart(opt.schedule.map((s) => s.coverDays), { w: 820, h: 180, stroke: "var(--teal-400)", yLabel: "days cover" })}
        </div>

        <div class="panel">
          <h2>Decision logic</h2>
          <ul class="check-list">
            <li>Daily drawdown = min(max daily drawdown rate, 85% of the scenario supply gap) — smoothing avoids emptying the reserve on day one</li>
            <li>Reorder trigger = day the projected cover would cross the safety floor, minus the ${opt.leadTimeDays}-day average procurement lead time</li>
            <li>If "Reorder Trigger" has already passed relative to scenario day 0, the recommendation is to initiate emergency procurement immediately</li>
          </ul>
        </div>
      </section>
    `;
  },

  /* ---------------------------- DIGITAL TWIN ---------------------------- */
  renderTwin() {
    const scores = App.corridorScores();
    const root = document.getElementById("view-root");
    root.innerHTML = `
      <section class="view">
        <h1 class="view-title">Supply Chain Digital Twin</h1>
        <p class="view-sub">Geospatial view of the four monitored corridors, their chokepoints, and India's coastal refineries. Toggle the reroute overlay to see the Cape of Good Hope diversion used when Hormuz or the Red Sea is impaired.</p>
        <div class="panel twin-panel">
          <div class="twin-toolbar">
            <button class="ghost-btn" onclick="App.toggleReroute()">${App.state.reroute ? "Hide" : "Show"} reroute overlay</button>
            <div class="twin-legend">
              <span><i class="dot risk-low"></i> Low</span>
              <span><i class="dot risk-guarded"></i> Guarded</span>
              <span><i class="dot risk-elevated"></i> Elevated</span>
              <span><i class="dot risk-severe"></i> Severe</span>
            </div>
          </div>
          <div id="twin-map">${DigitalTwin.render(scores, App.state.reroute)}</div>
          <div id="twin-info" class="twin-info">Click a chokepoint or refinery node for details.</div>
        </div>
      </section>
    `;
    document.querySelectorAll(".chokepoint-node").forEach((el) => {
      el.addEventListener("click", () => {
        const name = el.dataset.name, score = el.dataset.score;
        const band = Engines.risk.band(Number(score));
        document.getElementById("twin-info").innerHTML =
          `<strong>${name}</strong> — corridor risk <span class="badge ${band.cls}">${band.label} · ${score}</span>`;
      });
    });
    document.querySelectorAll(".port-node").forEach((el) => {
      el.addEventListener("click", () => {
        document.getElementById("twin-info").innerHTML =
          `<strong>${el.dataset.name}</strong> — capacity ${el.dataset.cap} mbd`;
      });
    });
  },

  toggleReroute() { App.state.reroute = !App.state.reroute; App.renderTwin(); },

  /* ---------------------------- ABOUT / ARCHITECTURE ---------------------------- */
  renderAbout() {
    const root = document.getElementById("view-root");
    root.innerHTML = `
      <section class="view">
        <h1 class="view-title">Architecture &amp; Judging Alignment</h1>
        <div class="panel">
          <h2>System architecture</h2>
          <img src="docs/architecture-diagram.svg" alt="Architecture diagram" class="arch-img"/>
        </div>
        <div class="grid-2">
          <div class="panel">
            <h2>How this maps to the judging criteria</h2>
            <table class="data-table">
              <thead><tr><th>Criteria</th><th>Weight</th><th>Where it shows up</th></tr></thead>
              <tbody>
                <tr><td>Innovation</td><td>25%</td><td>Composite live risk scoring feeding both procurement ranking and reserve smoothing in one closed loop</td></tr>
                <tr><td>Business Impact</td><td>25%</td><td>Scenario → INR fuel price, GDP bps, refinery run-rate — decision-ready, not just a risk number</td></tr>
                <tr><td>Technical Excellence</td><td>20%</td><td>Explicit, documented formulas; deterministic + testable; zero external dependencies</td></tr>
                <tr><td>Scalability</td><td>15%</td><td>Data model separated from engines — swap mock corridors/suppliers for live AIS/news/ERP feeds without touching logic</td></tr>
                <tr><td>User Experience</td><td>15%</td><td>Single command center, six focused modules, live pulse strip, no dead ends</td></tr>
              </tbody>
            </table>
          </div>
          <div class="panel">
            <h2>Production roadmap</h2>
            <ul class="check-list">
              <li>Replace signal sliders with real ingestion: MarineTraffic/Spire AIS, GDELT + news NLP, OFAC/UN sanctions feeds</li>
              <li>Swap the weighted-sum risk/procurement models for a learned ranker once historical outcome data exists</li>
              <li>Add a knowledge graph (supplier ↔ corridor ↔ refinery ↔ policy) behind the digital twin for causal "why" answers</li>
              <li>Wire the reorder trigger into an actual e-procurement workflow with human-in-the-loop approval</li>
            </ul>
          </div>
        </div>
      </section>
    `;
  },
};

document.addEventListener("DOMContentLoaded", App.init);

if (typeof window !== "undefined") { window.App = App; }
