import { mean, stdev, quantile, skewness, kurtosis } from "./stats";

const TRADING_DAYS = 252;

/**
 * Historical Value-at-Risk: the (1-alpha)-quantile of losses.
 * Returns a positive fraction (e.g. 0.025 = "lose 2.5% in one day with 95% conf").
 */
export function historicalVaR(returns: number[], alpha = 0.95): number {
  if (returns.length < 30) return NaN;
  // alpha = 0.95 → take 5th percentile of returns; loss = -that.
  const q = quantile(returns, 1 - alpha);
  return -q;
}

/**
 * Parametric (Gaussian) VaR. Useful as a sanity check vs historical.
 * Uses mean and stdev of returns and the standard normal inverse at 1-alpha.
 */
export function parametricVaR(returns: number[], alpha = 0.95): number {
  if (returns.length < 30) return NaN;
  const m = mean(returns);
  const s = stdev(returns, true);
  const z = invStdNormCDF(1 - alpha);
  return -(m + z * s);
}

/**
 * Conditional VaR (a.k.a. Expected Shortfall): average loss in the worst (1-alpha) tail.
 * Returns a positive fraction.
 */
export function historicalCVaR(returns: number[], alpha = 0.95): number {
  if (returns.length < 30) return NaN;
  const sorted = [...returns].sort((a, b) => a - b);
  const cutoff = Math.max(1, Math.floor(sorted.length * (1 - alpha)));
  let s = 0;
  for (let i = 0; i < cutoff; i++) s += sorted[i];
  const meanTail = s / cutoff;
  return -meanTail;
}

/**
 * Sharpe ratio annualized.
 * @param riskFreeAnnual e.g. 0.045 for 4.5%
 */
export function sharpe(returns: number[], riskFreeAnnual = 0.045): number {
  if (returns.length < 30) return NaN;
  const rfDaily = riskFreeAnnual / TRADING_DAYS;
  const ex = returns.map((r) => r - rfDaily);
  const m = mean(ex);
  const s = stdev(ex, true);
  if (!isFinite(s) || s === 0) return NaN;
  return (m / s) * Math.sqrt(TRADING_DAYS);
}

/**
 * Sortino ratio: downside-only deviation. Uses the standard definition where
 * the downside variance is normalized by the *total* number of observations
 * (so that a series with no losses gives an infinite Sortino, and adding more
 * positive returns improves the ratio).
 */
export function sortino(
  returns: number[],
  riskFreeAnnual = 0.045,
  mar = 0
): number {
  if (returns.length < 30) return NaN;
  const rfDaily = riskFreeAnnual / TRADING_DAYS;
  const ex = returns.map((r) => r - rfDaily);
  const m = mean(ex);
  let s = 0;
  for (const r of ex) {
    if (r < mar) s += (r - mar) * (r - mar);
  }
  const dd = Math.sqrt(s / ex.length);
  if (!isFinite(dd) || dd === 0) return NaN;
  return (m / dd) * Math.sqrt(TRADING_DAYS);
}

/**
 * Calmar ratio: annualized return / |MDD|.
 * @param mdd negative fraction (e.g. -0.4)
 */
export function calmar(returns: number[], mdd: number): number {
  if (returns.length < 30 || !isFinite(mdd) || mdd === 0) return NaN;
  const totalLogReturn = returns.reduce((a, b) => a + b, 0);
  const years = returns.length / TRADING_DAYS;
  const cagr = Math.exp(totalLogReturn / years) - 1;
  return cagr / Math.abs(mdd);
}

/** Annualized geometric mean (CAGR) from log returns. */
export function annualizedReturn(returns: number[]): number {
  if (returns.length < 30) return NaN;
  const total = returns.reduce((a, b) => a + b, 0);
  return Math.exp(total / (returns.length / TRADING_DAYS)) - 1;
}

/**
 * Tail summary: skew, excess kurtosis, left/right tail ratio (5th vs 95th magnitude).
 */
export function tailRisk(returns: number[]): {
  skew: number;
  exKurt: number;
  leftTail: number;
  rightTail: number;
  tailRatio: number;
} {
  const skew = skewness(returns);
  const exKurt = kurtosis(returns);
  const leftTail = -quantile(returns, 0.05);
  const rightTail = quantile(returns, 0.95);
  const tailRatio = rightTail !== 0 ? leftTail / rightTail : NaN;
  return { skew, exKurt, leftTail, rightTail, tailRatio };
}

/**
 * Acklam's algorithm for the inverse standard normal CDF (Φ⁻¹).
 * Accurate to ~1e-9 for reasonable inputs.
 */
export function invStdNormCDF(p: number): number {
  if (p <= 0 || p >= 1) return NaN;
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}
