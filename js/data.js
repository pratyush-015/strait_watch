/**
 * STRAIT WATCH — Domain data model
 * ---------------------------------
 * All figures below are illustrative, order-of-magnitude estimates assembled
 * from publicly reported ranges (India crude import dependency, Hormuz
 * transit share, SPR cover days). They exist to make the simulation
 * internally consistent and testable — NOT to represent a live feed.
 * Swap DATA.liveFeed / DATA.corridors for a real ingestion pipeline
 * (AIS, GDELT, EIA, sanctions registries) without touching the engines.
 */

const DATA = {
  meta: {
    totalImportMbd: 5.2,        // India crude imports, million barrels/day (illustrative)
    importDependencyPct: 88,    // % of consumption met by imports
    sprCoverDaysBaseline: 9.5,  // strategic reserve cover, days of net imports
    basePetrolPriceINR: 96,     // INR / litre, retail reference
    macroSensitivityBpsPerPct: 8, // GDP growth drag (bps) per 1% sustained import-gap
    procurementLeadTimeDays: 21,  // avg. lead time to onboard an alternate barrel
    safetyCoverThresholdDays: 3,  // reserve floor before a reorder is forced
  },

  corridors: [
    {
      id: "hormuz",
      name: "Strait of Hormuz",
      sharePct: 42,
      note: "Iran / Iraq / Saudi / UAE / Qatar crude, ~33km chokepoint width",
      baseline: { tension: 58, incidents: 4, sanctions: 55, congestion: 40 },
    },
    {
      id: "redsea",
      name: "Red Sea / Bab-el-Mandeb / Suez",
      sharePct: 12,
      note: "Mediterranean & partial West-Africa-bound cargo, Suez-linked",
      baseline: { tension: 62, incidents: 7, sanctions: 20, congestion: 35 },
    },
    {
      id: "cape",
      name: "Cape of Good Hope (reroute path)",
      sharePct: 18,
      note: "Longer alternate route; absorbs traffic diverted off Red Sea",
      baseline: { tension: 15, incidents: 1, sanctions: 5, congestion: 20 },
    },
    {
      id: "direct",
      name: "Direct / Other (ESPO Pacific, US Gulf, Atlantic)",
      sharePct: 28,
      note: "Not chokepoint-dependent; residual geopolitical exposure only",
      baseline: { tension: 12, incidents: 0, sanctions: 25, congestion: 10 },
    },
  ],

  chokepoints: [
    { id: "hormuz", name: "Strait of Hormuz", lat: 26.57, lng: 56.25, corridor: "hormuz" },
    { id: "babelmandeb", name: "Bab-el-Mandeb", lat: 12.58, lng: 43.32, corridor: "redsea" },
    { id: "suez", name: "Suez Canal", lat: 30.5, lng: 32.3, corridor: "redsea" },
    { id: "cape", name: "Cape of Good Hope", lat: -34.36, lng: 18.47, corridor: "cape" },
  ],

  ports: [
    { id: "jamnagar", name: "Jamnagar Refinery (Reliance)", lat: 22.4707, lng: 69.8347, capacityMbd: 1.4 },
    { id: "vadinar", name: "Vadinar Refinery (Nayara)", lat: 22.47, lng: 69.70, capacityMbd: 0.4 },
    { id: "mundra", name: "Mundra Port / Refinery", lat: 22.84, lng: 69.72, capacityMbd: 0.3 },
    { id: "paradip", name: "Paradip Refinery (IOCL)", lat: 20.316, lng: 86.679, capacityMbd: 0.3 },
    { id: "chennai", name: "Manali Refinery (Chennai)", lat: 13.17, lng: 80.32, capacityMbd: 0.2 },
    { id: "kochi", name: "Kochi Refinery (BPCL)", lat: 9.97, lng: 76.28, capacityMbd: 0.31 },
    { id: "haldia", name: "Haldia Refinery (IOCL)", lat: 22.03, lng: 88.06, capacityMbd: 0.18 },
    { id: "numaligarh", name: "Numaligarh Refinery (Assam)", lat: 26.65, lng: 93.70, capacityMbd: 0.09 },
    { id: "barauni", name: "Barauni Refinery (Bihar)", lat: 25.47, lng: 85.97, capacityMbd: 0.12 },
    { id: "panipat", name: "Panipat Refinery (Haryana)", lat: 29.39, lng: 76.97, capacityMbd: 0.25 },
  ],

  // India origin reference point for reroute-distance illustration
  origin: { lat: 21.5, lng: 70.5 },

  suppliers: [
    { id: "iraq", name: "Iraq (Basra)", corridor: "hormuz", distanceNm: 2300, costPerBbl: 78, compatibility: 0.95, availabilityIdx: 0.8, maxIncrementalMbd: 0.5 },
    { id: "saudi", name: "Saudi Arabia (Ras Tanura)", corridor: "hormuz", distanceNm: 2100, costPerBbl: 80, compatibility: 0.95, availabilityIdx: 0.75, maxIncrementalMbd: 0.6 },
    { id: "uae", name: "UAE (Fujairah – Hormuz-bypass terminal)", corridor: "direct", distanceNm: 2200, costPerBbl: 81, compatibility: 0.9, availabilityIdx: 0.7, maxIncrementalMbd: 0.35 },
    { id: "russia", name: "Russia (Urals / ESPO)", corridor: "direct", distanceNm: 5200, costPerBbl: 68, compatibility: 0.8, availabilityIdx: 0.85, maxIncrementalMbd: 0.7 },
    { id: "usa", name: "USA (WTI, US Gulf)", corridor: "cape", distanceNm: 8600, costPerBbl: 86, compatibility: 0.55, availabilityIdx: 0.6, maxIncrementalMbd: 0.4 },
    { id: "nigeria", name: "Nigeria (Bonny Light)", corridor: "cape", distanceNm: 5600, costPerBbl: 84, compatibility: 0.7, availabilityIdx: 0.55, maxIncrementalMbd: 0.3 },
    { id: "brazil", name: "Brazil (Santos Basin)", corridor: "cape", distanceNm: 8100, costPerBbl: 85, compatibility: 0.6, availabilityIdx: 0.5, maxIncrementalMbd: 0.25 },
  ],

  scenarioTemplates: [
    {
      id: "hormuz_closure",
      label: "Strait of Hormuz — Partial Closure",
      corridor: "hormuz",
      description: "A share of Hormuz-transiting volume is blocked or deterred (mining threat, naval incident, insurance withdrawal).",
      severityLabel: "Volume affected",
      severityUnit: "%",
      severityDefault: 35,
      severityMax: 100,
    },
    {
      id: "opec_cut",
      label: "OPEC+ Emergency Supply Cut",
      corridor: "hormuz",
      description: "A coordinated production cut reduces global supply; India absorbs a proportional share via higher landed cost and allocation friction.",
      severityLabel: "Global cut",
      severityUnit: "mbd",
      severityDefault: 2,
      severityMax: 6,
    },
    {
      id: "redsea_suspension",
      label: "Red Sea Shipping Suspension",
      corridor: "redsea",
      description: "Carriers suspend Red Sea / Bab-el-Mandeb transits; affected cargo reroutes via the Cape of Good Hope (+~12 transit days).",
      severityLabel: "Route suspended",
      severityUnit: "%",
      severityDefault: 60,
      severityMax: 100,
    },
  ],
};

if (typeof window !== "undefined") { window.DATA = DATA; }
