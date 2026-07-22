/**
 * STRAIT WATCH — Supply Chain Digital Twin
 * ------------------------------------------
 * Stylised equirectangular projection over the Indian Ocean / Middle East
 * / East Africa region — enough geographic fidelity to reason about
 * corridors and reroutes, without claiming cartographic precision.
 */

const DigitalTwin = {
  bounds: { lngMin: -25, lngMax: 100, latMin: -42, latMax: 40 },
  viewW: 900,
  viewH: 560,

  project(lat, lng) {
    const { lngMin, lngMax, latMin, latMax } = DigitalTwin.bounds;
    const x = ((lng - lngMin) / (lngMax - lngMin)) * DigitalTwin.viewW;
    const y = ((latMax - lat) / (latMax - latMin)) * DigitalTwin.viewH;
    return { x, y };
  },

  corridorColor(score) {
    const band = Engines.risk.band(score);
    if (band.label === "SEVERE") return "var(--danger-500)";
    if (band.label === "ELEVATED") return "var(--flare-500)";
    if (band.label === "GUARDED") return "var(--crude-300)";
    return "var(--teal-400)";
  },

  render(corridorScores, rerouteActive) {
    const W = DigitalTwin.viewW, H = DigitalTwin.viewH;
    const P = DigitalTwin.project;
    const origin = P(DATA.origin.lat, DATA.origin.lng);

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="twin-svg">`;

    // Graticule
    svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="var(--ink-900)" rx="6"/>`;
    for (let lng = -20; lng <= 100; lng += 20) {
      const p1 = P(-42, lng), p2 = P(40, lng);
      svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" class="graticule"/>`;
    }
    for (let lat = -40; lat <= 40; lat += 20) {
      const p1 = P(lat, -25), p2 = P(lat, 100);
      svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" class="graticule"/>`;
    }

    // Corridor lanes: chokepoint -> India origin
    DATA.chokepoints.forEach((cp) => {
      const p = P(cp.lat, cp.lng);
      const score = corridorScores[cp.corridor] ?? 20;
      const color = DigitalTwin.corridorColor(score);
      const dashed = rerouteActive && (cp.id === "hormuz" || cp.corridor === "redsea") ? ' stroke-dasharray="6 6" opacity="0.35"' : "";
      svg += `<line x1="${p.x}" y1="${p.y}" x2="${origin.x}" y2="${origin.y}" stroke="${color}" stroke-width="2.5"${dashed} class="lane"/>`;
    });

    // Reroute path via Cape when active (Hormuz/Red Sea diverted)
    if (rerouteActive) {
      const cape = DATA.chokepoints.find((c) => c.id === "cape");
      const capeP = P(cape.lat, cape.lng);
      const redsea = DATA.chokepoints.find((c) => c.id === "babelmandeb");
      const rp = P(redsea.lat, redsea.lng);
      svg += `<path d="M ${rp.x} ${rp.y} Q ${capeP.x - 60} ${capeP.y - 40}, ${capeP.x} ${capeP.y} T ${origin.x} ${origin.y}"
                fill="none" stroke="var(--flare-500)" stroke-width="3" stroke-dasharray="2 6" class="reroute-path"/>`;
    }

    // Chokepoint nodes
    DATA.chokepoints.forEach((cp) => {
      const p = P(cp.lat, cp.lng);
      const score = corridorScores[cp.corridor] ?? 20;
      const color = DigitalTwin.corridorColor(score);
      svg += `<g class="node chokepoint-node" data-id="${cp.id}" data-name="${cp.name}" data-score="${score}">
        <circle cx="${p.x}" cy="${p.y}" r="9" fill="${color}" fill-opacity="0.18" class="pulse-ring"/>
        <circle cx="${p.x}" cy="${p.y}" r="5" fill="${color}" stroke="var(--ink-950)" stroke-width="1.5"/>
      </g>`;
    });

    // India ports/refineries
    DATA.ports.forEach((port) => {
      const p = P(port.lat, port.lng);
      svg += `<g class="node port-node" data-id="${port.id}" data-name="${port.name}" data-cap="${port.capacityMbd}">
        <rect x="${p.x - 4}" y="${p.y - 4}" width="8" height="8" fill="var(--paper-100)" stroke="var(--steel-700)" transform="rotate(45 ${p.x} ${p.y})"/>
      </g>`;
    });

    // Labels for chokepoints
    DATA.chokepoints.forEach((cp) => {
      const p = P(cp.lat, cp.lng);
      svg += `<text x="${p.x}" y="${p.y - 14}" class="twin-label">${cp.name}</text>`;
    });
    svg += `<text x="${origin.x + 12}" y="${origin.y + 4}" class="twin-label twin-label-strong">INDIA</text>`;

    svg += `</svg>`;
    return svg;
  },
};

if (typeof window !== "undefined") { window.DigitalTwin = DigitalTwin; }
