import { ols } from "./regression";
import { mean, stdev } from "./stats";

/**
 * Hurst exponent via Rescaled Range (R/S) analysis on log-returns.
 *
 * Interpretation:
 *   H ≈ 0.5  → random walk (efficient market)
 *   H > 0.5  → trending / persistent (positive autocorrelation)
 *   H < 0.5  → mean-reverting / anti-persistent
 *
 * Range chosen so that there are at least ~8 chunks at the largest scale.
 */
export function hurstRS(returns: number[]): { H: number; r2: number } {
  const N = returns.length;
  if (N < 100) return { H: NaN, r2: NaN };

  // Pick window sizes from 10 to N/4, log-spaced ~12 points.
  const minN = 10;
  const maxN = Math.max(20, Math.floor(N / 4));
  const nPoints = 12;
  const sizes: number[] = [];
  const logMin = Math.log(minN);
  const logMax = Math.log(maxN);
  for (let i = 0; i < nPoints; i++) {
    const s = Math.round(Math.exp(logMin + ((logMax - logMin) * i) / (nPoints - 1)));
    if (sizes[sizes.length - 1] !== s) sizes.push(s);
  }

  const xs: number[] = [];
  const ys: number[] = [];

  for (const n of sizes) {
    const chunks = Math.floor(N / n);
    if (chunks < 2) continue;
    const rsValues: number[] = [];
    for (let c = 0; c < chunks; c++) {
      const slice = returns.slice(c * n, c * n + n);
      const m = mean(slice);
      // cumulative deviation
      let cum = 0;
      let max = -Infinity;
      let min = Infinity;
      for (const v of slice) {
        cum += v - m;
        if (cum > max) max = cum;
        if (cum < min) min = cum;
      }
      const R = max - min;
      const S = stdev(slice, false);
      if (S > 0) rsValues.push(R / S);
    }
    if (rsValues.length === 0) continue;
    const avgRS = rsValues.reduce((a, b) => a + b, 0) / rsValues.length;
    if (avgRS > 0) {
      xs.push(Math.log(n));
      ys.push(Math.log(avgRS));
    }
  }
  if (xs.length < 4) return { H: NaN, r2: NaN };
  const fit = ols(xs, ys);
  return { H: fit.b, r2: fit.r2 };
}
