export type DemandParams = {
  mu: number;
  sigma: number;
  nTrain: number;
  nGame: number;
  price: number;
  cost: number;
  salvage: number;
};

export type DemandDataset = {
  training: number[];
  inGame: number[];
  optimalQ: number;
};

type RNG = () => number;

export function makeRng(seed: number): RNG {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return (s & 0xffffffff) / 0x100000000;
  };
}

function boxMuller(rng: RNG) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function truncatedNormalInt(mu: number, sigma: number, rng: RNG) {
  for (let k = 0; k < 10000; k++) {
    const z = boxMuller(rng);
    const x = mu + sigma * z;
    if (x >= 0) return Math.max(0, Math.round(x));
  }
  return Math.max(0, Math.round(mu));
}

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
}

function std(xs: number[]) {
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1);
  return Math.sqrt(v);
}

// Acklam inverse normal CDF approximation (commonly used public-domain implementation)
export function invNormCdf(p: number) {
  if (p <= 0 || p >= 1) throw new Error("p must be in (0,1)");
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];

  const plow = 0.02425;
  const phigh = 1 - plow;

  let q: number, r: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
           ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
  }
  if (phigh < p) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
            ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
  }
  q = p - 0.5;
  r = q * q;
  return (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5]) * q /
         (((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1);
}

export function optimalOrderQuantity(mu: number, sigma: number, price: number, cost: number, salvage: number) {
  const cu = price - cost;
  const co = cost - salvage;
  if (cu <= 0) return 0;
  if (co < 0) return Math.max(0, Math.round(mu));
  const crit = cu / (cu + co);
  const z = invNormCdf(crit);
  const q = mu + z * sigma;
  return Math.max(0, Math.round(q));
}

function profitForSeries(demands: number[], Q: number, price: number, cost: number, salvage: number) {
  let profit = 0;
  for (const D of demands) {
    const sold = Math.min(Q, D);
    const leftover = Math.max(0, Q - sold);
    profit += price * sold + salvage * leftover - cost * Q;
  }
  return profit;
}

function scoreDataset(training: number[], inGame: number[], params: DemandParams, optimalQ: number) {
  const mT = mean(training), sT = std(training);
  const mG = mean(inGame), sG = std(inGame);

  const mu = params.mu, sigma = params.sigma;

  const repPenalty =
    Math.abs(mT - mu) / Math.max(1e-9, sigma) +
    Math.abs(mG - mu) / Math.max(1e-9, sigma) +
    Math.abs(sT - sigma) / Math.max(1e-9, sigma) +
    Math.abs(sG - sigma) / Math.max(1e-9, sigma);

  const pOpt = profitForSeries(inGame, optimalQ, params.price, params.cost, params.salvage);
  const pMinus = profitForSeries(inGame, Math.max(0, optimalQ - 10), params.price, params.cost, params.salvage);
  const pPlus = profitForSeries(inGame, optimalQ + 10, params.price, params.cost, params.salvage);

  const worstNeighbor = Math.min(pMinus, pPlus);
  const advantage = pOpt - worstNeighbor;
  const scale = Math.max(1, Math.abs(pOpt));
  const advScore = advantage / scale;

  return advScore - 0.35 * repPenalty;
}

export function generateDemandDataset(params: DemandParams, seed: number): DemandDataset {
  const rng = makeRng(seed);
  const optimalQ = optimalOrderQuantity(params.mu, params.sigma, params.price, params.cost, params.salvage);

  let best: DemandDataset | null = null;
  let bestScore = -Infinity;

  const nTotal = params.nTrain + params.nGame;
  const iterations = 1500;

  for (let it = 0; it < iterations; it++) {
    const draws: number[] = [];
    while (draws.length < nTotal) draws.push(truncatedNormalInt(params.mu, params.sigma, rng));

    // shuffle
    for (let i = draws.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [draws[i], draws[j]] = [draws[j], draws[i]];
    }

    const training = draws.slice(0, params.nTrain);
    const inGame = draws.slice(params.nTrain);

    const mT = mean(training), sT = std(training);
    const mG = mean(inGame), sG = std(inGame);

    const tolMean = 0.08 * params.sigma;
    const tolStd = 0.15 * params.sigma;

    const ok =
      Math.abs(mT - params.mu) <= tolMean &&
      Math.abs(mG - params.mu) <= tolMean &&
      Math.abs(sT - params.sigma) <= tolStd &&
      Math.abs(sG - params.sigma) <= tolStd;

    if (!ok) continue;

    const score = scoreDataset(training, inGame, params, optimalQ);
    if (score > bestScore) {
      bestScore = score;
      best = { training, inGame, optimalQ };
    }
  }

  if (!best) {
    const rng2 = makeRng(seed ^ 0x9e3779b9);
    const draws: number[] = [];
    while (draws.length < nTotal) draws.push(truncatedNormalInt(params.mu, params.sigma, rng2));
    const training = draws.slice(0, params.nTrain);
    const inGame = draws.slice(params.nTrain);
    return { training, inGame, optimalQ };
  }

  return best;
}
