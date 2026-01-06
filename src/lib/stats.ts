export function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
}

export function std(xs: number[]) {
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1);
  return Math.sqrt(v);
}

export function histogram(values: number[], binCount: number) {
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
  const xs: { x: number; y: number }[] = [];
  const span = maxX - minX;
  for (let i = 0; i < points; i++) {
    const x = minX + (span * i) / (points - 1);
    xs.push({ x: Math.round(x * 10) / 10, y: normalPdf(x, mu, sigma) });
  }
  const maxY = Math.max(...xs.map((p) => p.y), 1e-9);
  return xs.map((p) => ({ x: p.x, y: p.y / maxY }));
}
