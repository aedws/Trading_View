import { mean, stdev, rolling } from "./stats";

const TRADING_DAYS = 252;

/** Annualized realized volatility from log returns. */
export function annualizedVol(returns: number[]): number {
  return stdev(returns, true) * Math.sqrt(TRADING_DAYS);
}

/**
 * EWMA (RiskMetrics) variance series:
 *   sigma2_t = lambda * sigma2_{t-1} + (1 - lambda) * r_{t-1}^2
 * Initialized with the sample variance of the first 30 returns.
 *
 * lambda = 0.94 is the standard daily-data RiskMetrics value, which is
 * equivalent to a GARCH(1,1) with omega=0, alpha=0.06, beta=0.94.
 */
export function ewmaVolSeries(
  returns: number[],
  lambda = 0.94
): { sigma: number[]; annualized: number[] } {
  const n = returns.length;
  const sigma2 = new Array(n).fill(NaN);
  if (n < 30) return { sigma: sigma2, annualized: sigma2 };
  // Seed with sample variance of first 30
  const seed = returns.slice(0, 30);
  const m = mean(seed);
  let s2 = 0;
  for (const r of seed) s2 += (r - m) * (r - m);
  s2 /= seed.length;
  sigma2[29] = s2;
  for (let i = 30; i < n; i++) {
    s2 = lambda * s2 + (1 - lambda) * returns[i - 1] * returns[i - 1];
    sigma2[i] = s2;
  }
  const sigma = sigma2.map((v) => Math.sqrt(v));
  const annualized = sigma.map((v) => v * Math.sqrt(TRADING_DAYS));
  return { sigma, annualized };
}

/**
 * Volatility regime via EWMA: classify the latest annualized vol against
 * its own historical distribution.
 *
 *   < 25th percentile  → Low (calm)
 *   25–75th            → Normal
 *   75–95th            → Elevated
 *   ≥ 95th             → Extreme
 */
export function volRegime(returns: number[]): {
  current: number;
  median: number;
  p25: number;
  p75: number;
  p95: number;
  rolling30: number[];
  label: "낮음" | "보통" | "상승" | "극단" | "—";
  zscore: number;
} {
  const ann = ewmaVolSeries(returns).annualized.filter((v) => isFinite(v));
  if (ann.length < 60) {
    return {
      current: NaN,
      median: NaN,
      p25: NaN,
      p75: NaN,
      p95: NaN,
      rolling30: [],
      label: "—",
      zscore: NaN,
    };
  }
  const sorted = [...ann].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.floor((sorted.length - 1) * p)];
  const p25 = q(0.25);
  const median = q(0.5);
  const p75 = q(0.75);
  const p95 = q(0.95);
  const current = ann[ann.length - 1];
  let label: "낮음" | "보통" | "상승" | "극단" = "보통";
  if (current < p25) label = "낮음";
  else if (current >= p95) label = "극단";
  else if (current >= p75) label = "상승";
  const m = mean(ann);
  const sd = stdev(ann, true);
  const zscore = sd > 0 ? (current - m) / sd : NaN;
  // last ~30 of the annualized series (windowed for plotting)
  const rolling30 = rolling(ann, 30, (s) => mean(s)).filter((v) => isFinite(v));
  return { current, median, p25, p75, p95, rolling30, label, zscore };
}
