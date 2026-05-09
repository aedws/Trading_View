import { mean, variance } from "./stats";

/**
 * Autocorrelation function ACF for lags 0..maxLag (inclusive).
 * Uses biased estimator divided by variance (so acf[0] = 1).
 */
export function acf(series: number[], maxLag: number): number[] {
  const n = series.length;
  const m = mean(series);
  const v = variance(series, false);
  if (!isFinite(v) || v === 0) return new Array(maxLag + 1).fill(NaN);
  const out = new Array(maxLag + 1).fill(0);
  out[0] = 1;
  for (let k = 1; k <= maxLag; k++) {
    let s = 0;
    for (let t = k; t < n; t++) s += (series[t] - m) * (series[t - k] - m);
    out[k] = s / n / v;
  }
  return out;
}

/**
 * Ljung-Box Q statistic up to lag h. Approximate p-value via chi-square h dof.
 * We don't have a chi-square CDF in stdlib; we provide Q only — the card will
 * threshold against common critical values (e.g. 5% for h=10 ≈ 18.31).
 */
export function ljungBoxQ(acfValues: number[], n: number, h: number): number {
  let s = 0;
  for (let k = 1; k <= h; k++) s += (acfValues[k] * acfValues[k]) / (n - k);
  return n * (n + 2) * s;
}
