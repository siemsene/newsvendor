export function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
}

export function std(xs: number[]) {
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1);
  return Math.sqrt(v);
}

export function skewness(xs: number[]) {
  const m = mean(xs);
  const s = std(xs);
  if (s <= 0) return 0;
  const n = xs.length || 1;
  const m3 = xs.reduce((a, b) => a + (b - m) ** 3, 0) / n;
  return m3 / Math.max(1e-9, s ** 3);
}

export function excessKurtosis(xs: number[]) {
  const m = mean(xs);
  const s = std(xs);
  if (s <= 0) return 0;
  const n = xs.length || 1;
  const m4 = xs.reduce((a, b) => a + (b - m) ** 4, 0) / n;
  return m4 / Math.max(1e-9, s ** 4) - 3;
}

export function histogram(values: number[], binCount: number) {
  if (!values.length || binCount <= 0) {
    return { data: [], minX: 0, maxX: 0, scaleToHistogram: 1 };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const step = Math.max(1, Math.ceil(span / binCount));
  const bins: { label: string; count: number }[] = [];
  for (let i = 0; i < binCount; i++) {
    const a = min + i * step;
    const b = a + step;
    bins.push({ label: `${a}-${b - 1}`, count: 0 });
  }
  for (const v of values) {
    const idx = Math.min(binCount - 1, Math.floor((v - min) / step));
    bins[idx].count += 1;
  }
  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  const scaleToHistogram = maxCount;

  return { data: bins, minX: min, maxX: max, scaleToHistogram };
}

function normalPdf(x: number, mu: number, sigma: number) {
  const z = (x - mu) / sigma;
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

export function normalCurvePoints(mu: number, sigma: number, minX: number, maxX: number, points: number) {
  const safePoints = Math.max(0, Math.floor(points));
  if (!(sigma > 0) || safePoints === 0) {
    const span = maxX - minX;
    return Array.from({ length: safePoints }, (_, i) => {
      const x = safePoints > 1 ? minX + (span * i) / (safePoints - 1) : minX;
      return { x: Math.round(x * 10) / 10, y: 0 };
    });
  }
  const xs: { x: number; y: number }[] = [];
  const span = maxX - minX;
  for (let i = 0; i < safePoints; i++) {
    const x = safePoints > 1 ? minX + (span * i) / (safePoints - 1) : minX;
    xs.push({ x: Math.round(x * 10) / 10, y: normalPdf(x, mu, sigma) });
  }
  const maxY = Math.max(...xs.map((p) => p.y), 1e-9);
  return xs.map((p) => ({ x: p.x, y: p.y / maxY }));
}
