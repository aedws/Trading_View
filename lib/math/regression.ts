import { mean, stdev } from "./stats";

export type LinearFit = {
  /** intercept */
  a: number;
  /** slope (per x-unit) */
  b: number;
  /** R^2 of the fit */
  r2: number;
  /** residual standard deviation (sample) */
  sigma: number;
  /** prediction values at the input x's */
  yhat: number[];
  /** residuals = y - yhat */
  resid: number[];
};

/** Ordinary Least Squares y = a + b*x. */
export function ols(x: number[], y: number[]): LinearFit {
  const n = Math.min(x.length, y.length);
  if (n < 2) {
    return { a: NaN, b: NaN, r2: NaN, sigma: NaN, yhat: [], resid: [] };
  }
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const b = sxx === 0 ? NaN : sxy / sxx;
  const a = my - b * mx;
  const yhat: number[] = new Array(n);
  const resid: number[] = new Array(n);
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    yhat[i] = a + b * x[i];
    resid[i] = y[i] - yhat[i];
    ssRes += resid[i] * resid[i];
  }
  const r2 = syy === 0 ? NaN : 1 - ssRes / syy;
  const sigma = stdev(resid, true);
  return { a, b, r2, sigma, yhat, resid };
}

/**
 * Log-linear regression on prices: ln(price) = a + b * t.
 * Returns the fit + the implied compound annual growth rate.
 *
 * @param prices    daily closes (length N)
 * @param tradingDaysPerYear  default 252
 */
export function logLinearChannel(
  prices: number[],
  tradingDaysPerYear = 252
): LinearFit & { cagr: number; lastZ: number } {
  const y: number[] = [];
  const x: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (prices[i] > 0) {
      y.push(Math.log(prices[i]));
      x.push(i);
    }
  }
  const fit = ols(x, y);
  const cagr = isFinite(fit.b) ? Math.exp(fit.b * tradingDaysPerYear) - 1 : NaN;
  const lastResid = fit.resid[fit.resid.length - 1] ?? NaN;
  const lastZ = isFinite(fit.sigma) && fit.sigma > 0 ? lastResid / fit.sigma : NaN;
  return { ...fit, cagr, lastZ };
}

/**
 * AR(1) on a series: x_t = phi*x_{t-1} + e_t (no constant after demean).
 * Used for mean-reversion half-life: t_half = -ln(2) / ln(|phi|), valid only when |phi| < 1.
 */
export function ar1HalfLife(series: number[]): {
  phi: number;
  halfLife: number;
} {
  const n = series.length;
  if (n < 30) return { phi: NaN, halfLife: NaN };
  const m = mean(series);
  const dem = series.map((v) => v - m);
  // OLS: dem[t] = phi * dem[t-1]
  const x = dem.slice(0, -1);
  const y = dem.slice(1);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += x[i] * y[i];
    sxx += x[i] * x[i];
  }
  const phi = sxx === 0 ? NaN : sxy / sxx;
  const halfLife =
    isFinite(phi) && phi > 0 && phi < 1 ? -Math.log(2) / Math.log(phi) : NaN;
  return { phi, halfLife };
}
