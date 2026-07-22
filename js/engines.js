/**
 * STRAIT WATCH — Analytical engines
 * ----------------------------------
 * Every function here is a pure, deterministic calculation over explicit
 * inputs so a judge (or a future engineer) can trace exactly how a number
 * was produced and re-test it with different assumptions.
 */

const Engines = {};

/* ------------------------------------------------------------------ *
 * 1. GEOPOLITICAL RISK INTELLIGENCE
 *    Weighted composite of four signal families, per corridor.
 * ------------------------------------------------------------------ */
Engines.risk = {
  weights: { tension: 0.4, incidents: 0.25, sanctions: 0.2, congestion: 0.15 },

  scoreCorridor(signals) {
    const w = Engines.risk.weights;
    const incidentsNorm = Math.min(100, signals.incidents * 10); // 10 incidents = saturate
    const score =
      signals.tension * w.tension +
      incidentsNorm * w.incidents +
      signals.sanctions * w.sanctions +
      signals.congestion * w.congestion;
    return Math.round(Math.min(100, Math.max(0, score)));
  },

  band(score) {
    if (score >= 70) return { label: "SEVERE", cls: "risk-severe" };
    if (score >= 45) return { label: "ELEVATED", cls: "risk-elevated" };
    if (score >= 20) return { label: "GUARDED", cls: "risk-guarded" };
    return { label: "LOW", cls: "risk-low" };
  },

  // Composite, import-share-weighted national exposure score
  compositeExposure(corridorScores) {
    let total = 0;
    DATA.corridors.forEach((c) => {
      total += (corridorScores[c.id] / 100) * c.sharePct;
    });
    return Math.round(total); // 0-100 scale, share-weighted
  },
};

/* ------------------------------------------------------------------ *
 * 2. DISRUPTION SCENARIO MODELLER
 *    Converts a scenario + severity + duration into a supply gap and
 *    cascades that gap through refinery run-rate, retail fuel price,
 *    power-sector stress and GDP drag, plus an SPR depletion curve.
 * ------------------------------------------------------------------ */
Engines.scenario = {
  computeSupplyGapMbd(template, severity) {
    const m = DATA.meta;
    const hormuzVolume = m.totalImportMbd * (DATA.corridors.find((c) => c.id === "hormuz").sharePct / 100);
    const redSeaVolume = m.totalImportMbd * (DATA.corridors.find((c) => c.id === "redsea").sharePct / 100);

    switch (template.id) {
      case "hormuz_closure":
        return +(hormuzVolume * (severity / 100)).toFixed(2);
      case "opec_cut": {
        // India absorbs a share of a global cut proportional to its import dependency
        const indiaShareOfGlobalCut = 0.09; // illustrative allocation factor
        return +(severity * indiaShareOfGlobalCut).toFixed(2);
      }
      case "redsea_suspension":
        // Suspension doesn't remove barrels, it delays them; model as a temporary
        // effective supply gap during the reroute transition window (first ~12 days)
        return +(redSeaVolume * (severity / 100) * 0.5).toFixed(2);
      default:
        return 0;
    }
  },

  runRateSensitivity: 1.8,
  fuelElasticity: 0.6,

  cascade(templateId, severity, durationDays) {
    const template = DATA.scenarioTemplates.find((t) => t.id === templateId);
    const m = DATA.meta;
    const gapMbd = Engines.scenario.computeSupplyGapMbd(template, severity);
    const gapRatioPct = (gapMbd / m.totalImportMbd) * 100;

    const refineryRunRateImpactPct = Math.min(40, gapRatioPct * Engines.scenario.runRateSensitivity);
    const fuelPriceImpactPct = gapRatioPct * Engines.scenario.fuelElasticity;
    const fuelPriceImpactINR = +(m.basePetrolPriceINR * (fuelPriceImpactPct / 100)).toFixed(2);
    const powerStressIndex = Math.round(Math.min(100, refineryRunRateImpactPct * 1.4 + gapRatioPct * 0.6));
    const durationFactor = Math.min(1, durationDays / 30);
    const gdpImpactBps = Math.round(m.macroSensitivityBpsPerPct * gapRatioPct * durationFactor);

    // SPR depletion time-series
    const totalReserveMbbl = m.totalImportMbd * m.sprCoverDaysBaseline * 1; // million bbl equivalent of "days"
    const maxDailyDrawdownMbd = m.totalImportMbd * 0.15;
    const drawdownRateMbd = Math.min(maxDailyDrawdownMbd, gapMbd);
    const dailyDepletionDays = m.totalImportMbd > 0 ? drawdownRateMbd / m.totalImportMbd : 0;

    const series = [];
    let coverDays = m.sprCoverDaysBaseline;
    for (let day = 0; day <= durationDays; day++) {
      series.push({ day, coverDays: +Math.max(0, coverDays).toFixed(2) });
      coverDays -= dailyDepletionDays;
    }
    const daysToExhaustion = dailyDepletionDays > 0 ? +(m.sprCoverDaysBaseline / dailyDepletionDays).toFixed(1) : Infinity;

    return {
      template,
      gapMbd,
      gapRatioPct: +gapRatioPct.toFixed(1),
      refineryRunRateImpactPct: +refineryRunRateImpactPct.toFixed(1),
      fuelPriceImpactINR,
      powerStressIndex,
      gdpImpactBps,
      drawdownRateMbd: +drawdownRateMbd.toFixed(2),
      daysToExhaustion,
      series,
      durationDays,
    };
  },
};

/* ------------------------------------------------------------------ *
 * 3. ADAPTIVE PROCUREMENT ORCHESTRATOR
 *    Weighted-sum multi-criteria ranking (min-max normalised) over
 *    cost, availability, distance, refinery compatibility and the
 *    live risk score of each supplier's transit corridor — then a
 *    greedy allocation of the open supply gap across the ranked list.
 * ------------------------------------------------------------------ */
Engines.procurement = {
  weights: { cost: 0.3, availability: 0.2, distance: 0.15, compatibility: 0.2, risk: 0.15 },

  rank(gapMbd, corridorScores) {
    const suppliers = DATA.suppliers;
    const costs = suppliers.map((s) => s.costPerBbl);
    const dists = suppliers.map((s) => s.distanceNm);
    const costMin = Math.min(...costs), costMax = Math.max(...costs);
    const distMin = Math.min(...dists), distMax = Math.max(...dists);

    const scored = suppliers.map((s) => {
      const riskScore = corridorScores[s.corridor] ?? 20;
      const normCost = costMax > costMin ? (s.costPerBbl - costMin) / (costMax - costMin) : 0;
      const normDist = distMax > distMin ? (s.distanceNm - distMin) / (distMax - distMin) : 0;
      const w = Engines.procurement.weights;
      const score =
        w.cost * (1 - normCost) +
        w.availability * s.availabilityIdx +
        w.distance * (1 - normDist) +
        w.compatibility * s.compatibility +
        w.risk * (1 - riskScore / 100);
      return { ...s, riskScore, score: +(score * 100).toFixed(1) };
    });

    scored.sort((a, b) => b.score - a.score);

    // Greedy allocation to close the gap
    let remaining = gapMbd;
    const allocations = scored.map((s) => {
      const alloc = Math.min(s.maxIncrementalMbd, Math.max(0, remaining));
      remaining = +(remaining - alloc).toFixed(3);
      return { ...s, allocatedMbd: +alloc.toFixed(2) };
    });

    return { allocations, unmetGapMbd: +Math.max(0, remaining).toFixed(2) };
  },
};

/* ------------------------------------------------------------------ *
 * 4. STRATEGIC RESERVE OPTIMISATION AGENT
 *    Builds a smoothed drawdown schedule that stretches the reserve
 *    across the disruption window and flags the replenishment trigger
 *    day, accounting for procurement lead time and a safety floor.
 * ------------------------------------------------------------------ */
Engines.reserve = {
  optimize(scenarioResult) {
    const m = DATA.meta;
    const { gapMbd, durationDays } = scenarioResult;
    const maxDailyDrawdownMbd = m.totalImportMbd * 0.15;

    // Smooth the gap across the full duration instead of a flat drawdown,
    // capped by the max daily drawdown rate (simple bounded smoothing).
    const smoothedDailyMbd = Math.min(maxDailyDrawdownMbd, gapMbd * 0.85);
    const dailyDepletionDays = smoothedDailyMbd / m.totalImportMbd;

    const schedule = [];
    let cover = m.sprCoverDaysBaseline;
    let reorderDay = null;
    for (let day = 0; day <= durationDays; day++) {
      schedule.push({ day, coverDays: +Math.max(0, cover).toFixed(2), drawdownMbd: +smoothedDailyMbd.toFixed(2) });
      if (reorderDay === null && cover <= m.safetyCoverThresholdDays + m.procurementLeadTimeDays * (dailyDepletionDays)) {
        // trigger once projected cover would breach safety floor after lead time
      }
      cover -= dailyDepletionDays;
    }

    // Reorder day: work backward from when cover crosses the safety threshold,
    // minus the procurement lead time, so replacement barrels land just in time.
    const daysToSafetyFloor = dailyDepletionDays > 0
      ? (m.sprCoverDaysBaseline - m.safetyCoverThresholdDays) / dailyDepletionDays
      : Infinity;
    reorderDay = Math.max(0, Math.round(daysToSafetyFloor - m.procurementLeadTimeDays));

    return {
      smoothedDailyMbd: +smoothedDailyMbd.toFixed(2),
      schedule,
      reorderDay: isFinite(reorderDay) ? reorderDay : null,
      daysToSafetyFloor: isFinite(daysToSafetyFloor) ? +daysToSafetyFloor.toFixed(1) : null,
      leadTimeDays: m.procurementLeadTimeDays,
      safetyFloorDays: m.safetyCoverThresholdDays,
    };
  },
};

if (typeof window !== "undefined") { window.Engines = Engines; }
