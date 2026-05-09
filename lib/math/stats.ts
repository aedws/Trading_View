// Basic statistical primitives. All return numbers, return NaN for invalid.

export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function variance(xs: number[], sample = true): number {
  const n = xs.length;
  if (n < (sample ? 2 : 1)) return NaN;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) {
    const d = x - m;
    s += d * d;
  }
  return s / (sample ? n - 1 : n);
}

export function stdev(xs: number[], sample = true): number {
  return Math.sqrt(variance(xs, sample));
}

export function skewness(xs: number[]): number {
  // Fisher-Pearson sample skewness
  const n = xs.length;
  if (n < 3) return NaN;
  const m = mean(xs);
  const s = stdev(xs, true);
  if (!isFinite(s) || s === 0) return NaN;
  let sum = 0;
  for (const x of xs) sum += Math.pow((x - m) / s, 3);
  return (n / ((n - 1) * (n - 2))) * sum;
}

export function kurtosis(xs: number[]): number {
  // Excess kurtosis (sample)
  const n = xs.length;
  if (n < 4) return NaN;
  const m = mean(xs);
  const s = stdev(xs, true);
  if (!isFinite(s) || s === 0) return NaN;
  let sum = 0;
  for (const x of xs) sum += Math.pow((x - m) / s, 4);
  const term1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
  const term2 = (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  return term1 * sum - term2;
}

/**
 * Linear-interpolation percentile (R-7 / numpy default).
 * p in [0, 1].
 */
export function quantile(xs: number[], p: number): number {
  if (xs.length === 0) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  if (p <= 0) return sorted[0];
  if (p >= 1) return sorted[sorted.length - 1];
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

/** Simple log returns from price array. Length = prices.length - 1. */
export function logReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > 0 && prices[i - 1] > 0) {
      out.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  return out;
}

/** Simple arithmetic returns. */
export function simpleReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) out.push(prices[i] / prices[i - 1] - 1);
  }
  return out;
}

/** Rolling mean and stdev. Output length = xs.length, first window-1 = NaN. */
export function rolling(
  xs: number[],
  window: number,
  fn: (slice: number[]) => number
): number[] {
  const out: number[] = new Array(xs.length).fill(NaN);
  for (let i = window - 1; i < xs.length; i++) {
    out[i] = fn(xs.slice(i - window + 1, i + 1));
  }
  return out;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
