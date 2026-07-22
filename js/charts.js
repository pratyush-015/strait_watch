/**
 * STRAIT WATCH — Minimal SVG chart helpers
 * -------------------------------------------
 * Deliberately dependency-free: no Chart.js / D3 CDN required, so the
 * prototype renders identically online or fully offline.
 */

const Charts = {
  sparkline(values, opts = {}) {
    const w = opts.w || 240, h = opts.h || 36;
    if (!values || values.length < 2) {
      return `<svg width="${w}" height="${h}" class="chart chart-empty"></svg>`;
    }
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const step = w / (values.length - 1);
    const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(" ");
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="chart">
      <polyline points="${pts}" fill="none" stroke="${opts.stroke || "var(--teal-400)"}" stroke-width="2"/>
    </svg>`;
  },

  lineChart(values, opts = {}) {
    const w = opts.w || 700, h = opts.h || 160, pad = 32;
    if (!values || values.length < 2) return `<svg width="${w}" height="${h}"></svg>`;
    const max = Math.max(...values, 1);
    const min = 0;
    const range = max - min || 1;
    const innerW = w - pad * 2, innerH = h - pad * 1.5;
    const step = innerW / (values.length - 1);
    const pts = values.map((v, i) => `${(pad + i * step).toFixed(1)},${(h - pad - ((v - min) / range) * innerH).toFixed(1)}`).join(" ");
    const zeroY = h - pad;
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const y = h - pad - f * innerH;
      const val = (min + f * range).toFixed(1);
      return `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" class="grid-line"/><text x="4" y="${y + 3}" class="axis-label">${val}</text>`;
    }).join("");
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="chart chart-line">
      ${gridLines}
      <polyline points="${pts}" fill="none" stroke="${opts.stroke || "var(--flare-500)"}" stroke-width="2.5"/>
      <line x1="${pad}" y1="${zeroY}" x2="${w - pad}" y2="${zeroY}" class="axis-line"/>
      <text x="${w - pad}" y="${pad - 12}" class="axis-label axis-label-end">${opts.yLabel || ""}</text>
    </svg>`;
  },

  corridorBars(scoresObj) {
    const w = 480, barH = 26, gap = 14, pad = 140;
    const corridors = DATA.corridors;
    const h = corridors.length * (barH + gap);
    const rows = corridors.map((c, i) => {
      const score = scoresObj[c.id];
      const band = Engines.risk.band(score);
      const barW = (score / 100) * (w - pad - 40);
      const y = i * (barH + gap);
      return `
        <text x="0" y="${y + barH / 2 + 4}" class="bar-label">${c.name}</text>
        <rect x="${pad}" y="${y}" width="${w - pad - 40}" height="${barH}" class="bar-track"/>
        <rect x="${pad}" y="${y}" width="${barW}" height="${barH}" fill="${DigitalTwin.corridorColor(score)}" rx="3"/>
        <text x="${pad + (w - pad - 40) + 6}" y="${y + barH / 2 + 4}" class="bar-value">${score}</text>
      `;
    }).join("");
    return `<svg width="100%" viewBox="0 0 ${w} ${h}" class="chart chart-bars">${rows}</svg>`;
  },
};

if (typeof window !== "undefined") { window.Charts = Charts; }
