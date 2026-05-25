import { drawdownAnalysis } from "@/lib/math/drawdown";
import {
  calmar,
  historicalCVaR,
  historicalVaR,
  sharpe,
  sortino,
} from "@/lib/math/risk";
import { mean, stdev } from "@/lib/math/stats";

const TRADING_DAYS = 252;

/* ──────────── descriptive helpers ──────────── */

export function cagrFromWealth(wealth: number[]): number {
  const n = wealth.length;
  if (n < 2) return NaN;
  const start = wealth[0];
  const end = wealth[n - 1];
  if (!(start > 0) || !(end > 0)) return NaN;
  const years = (n - 1) / TRADING_DAYS;
  if (years <= 0) return NaN;
  return Math.pow(end / start, 1 / years) - 1;
}

export function totalReturnFromWealth(wealth: number[]): number {
  if (wealth.length < 2) return NaN;
  const s = wealth[0];
  const e = wealth[wealth.length - 1];
  if (!(s > 0) || !(e > 0)) return NaN;
  return e / s - 1;
}

export function annualizedVol(returns: number[]): number {
  const s = stdev(filterFinite(returns), true);
  return Number.isFinite(s) ? s * Math.sqrt(TRADING_DAYS) : NaN;
}

/* ──────────── alpha/beta vs benchmark ──────────── */

export interface CapmStats {
  /** Annualized alpha (CAPM intercept × 252). */
  alpha: number;
  /** Beta vs benchmark (slope on excess returns over rf). */
  beta: number;
  /** R² of the CAPM regression (0..1). */
  r2: number;
  /** Annualized tracking error vs benchmark (stdev of r_p - r_b × √252). */
  trackingError: number;
  /** Information ratio: (mean(r_p - r_b) × 252) / TE. */
  informationRatio: number;
  /** Correlation between portfolio and benchmark daily returns. */
  correlation: number;
  /** Up-capture: avg portfolio return on benchmark-up days / avg benchmark return on up days. */
  upCapture: number;
  /** Down-capture: avg portfolio return on benchmark-down days / avg benchmark return on down days. */
  downCapture: number;
  /** Hit rate: share of days where portfolio beats benchmark. */
  hitRate: number;
  /** Sample size used (overlapping finite-return days). */
  n: number;
}

export function capmStats(
  portReturns: number[],
  benchReturns: number[],
  riskFreeAnnual = 0.045,
): CapmStats {
  const rfDaily = riskFreeAnnual / TRADING_DAYS;
  const pairs: Array<{ p: number; b: number; ep: number; eb: number }> = [];
  const n = Math.min(portReturns.length, benchReturns.length);
  for (let i = 0; i < n; i++) {
    const p = portReturns[i];
    const b = benchReturns[i];
    if (Number.isFinite(p) && Number.isFinite(b)) {
      pairs.push({ p, b, ep: p - rfDaily, eb: b - rfDaily });
    }
  }
  if (pairs.length < 30) {
    return {
      alpha: NaN,
      beta: NaN,
      r2: NaN,
      trackingError: NaN,
      informationRatio: NaN,
      correlation: NaN,
      upCapture: NaN,
      downCapture: NaN,
      hitRate: NaN,
      n: pairs.length,
    };
  }

  const mp = mean(pairs.map((x) => x.ep));
  const mb = mean(pairs.map((x) => x.eb));
  let sbb = 0;
  let spb = 0;
  let spp = 0;
  for (const { ep, eb } of pairs) {
    const db = eb - mb;
    const dp = ep - mp;
    sbb += db * db;
    spb += db * dp;
    spp += dp * dp;
  }
  const beta = sbb > 0 ? spb / sbb : NaN;
  const alphaDaily = mp - beta * mb;
  const alpha = Number.isFinite(alphaDaily) ? alphaDaily * TRADING_DAYS : NaN;

  let ssRes = 0;
  for (const { ep, eb } of pairs) {
    const pred = alphaDaily + beta * eb;
    const e = ep - pred;
    ssRes += e * e;
  }
  const ssTot = spp;
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : NaN;

  const diff = pairs.map((x) => x.p - x.b);
  const sDiff = stdev(diff, true);
  const trackingError = Number.isFinite(sDiff) ? sDiff * Math.sqrt(TRADING_DAYS) : NaN;
  const mDiff = mean(diff);
  const informationRatio =
    Number.isFinite(trackingError) && trackingError > 0
      ? (mDiff * TRADING_DAYS) / trackingError
      : NaN;

  const corr =
    spp > 0 && sbb > 0 ? spb / Math.sqrt(spp * sbb) : NaN;

  const upBench = pairs.filter((x) => x.b > 0);
  const downBench = pairs.filter((x) => x.b < 0);
  const upBenchMean = upBench.length ? mean(upBench.map((x) => x.b)) : NaN;
  const downBenchMean = downBench.length ? mean(downBench.map((x) => x.b)) : NaN;
  const upPortMean = upBench.length ? mean(upBench.map((x) => x.p)) : NaN;
  const downPortMean = downBench.length ? mean(downBench.map((x) => x.p)) : NaN;
  const upCapture = upBenchMean !== 0 ? upPortMean / upBenchMean : NaN;
  const downCapture = downBenchMean !== 0 ? downPortMean / downBenchMean : NaN;

  let beats = 0;
  for (const { p, b } of pairs) if (p > b) beats++;
  const hitRate = pairs.length ? beats / pairs.length : NaN;

  return {
    alpha,
    beta,
    r2,
    trackingError,
    informationRatio,
    correlation: corr,
    upCapture,
    downCapture,
    hitRate,
    n: pairs.length,
  };
}

/* ──────────── drawdown vs benchmark ──────────── */

export interface DrawdownStats {
  mdd: number;
  /** ISO date of trough. */
  troughDate: string;
  /** ISO date of peak that started the worst drawdown. */
  peakDate: string;
  /** ISO date when wealth recovered to the prior peak (-1 → not recovered). */
  recoverDate: string | null;
  /** Current drawdown at the last sample. */
  current: number;
  /** Length of the worst drawdown in trading days (peak → trough). */
  declineDays: number;
  /** Days from trough to recovery (NaN if not recovered). */
  recoveryDays: number;
}

export function drawdownStatsFromWealth(
  wealth: number[],
  dates: string[],
): DrawdownStats {
  const info = drawdownAnalysis(wealth);
  const peakDate = dates[info.peakIdx] ?? "";
  const troughDate = dates[info.troughIdx] ?? "";
  const recoverDate =
    info.recoverIdx >= 0 ? (dates[info.recoverIdx] ?? null) : null;
  const declineDays = Math.max(0, info.troughIdx - info.peakIdx);
  const recoveryDays =
    info.recoverIdx >= 0 ? info.recoverIdx - info.troughIdx : NaN;
  return {
    mdd: info.mdd,
    peakDate,
    troughDate,
    recoverDate,
    current: info.current,
    declineDays,
    recoveryDays,
  };
}

/* ──────────── per-leg breakdown ──────────── */

export interface LegStats {
  ticker: string;
  weight: number;
  /** True if the leg only exists as a dividend-distribution target. */
  isDividendOnly: boolean;
  /** Total return over the window. */
  totalReturn: number;
  cagr: number;
  volAnnual: number;
  /** Annualized CAPM alpha vs the benchmark (intercept × 252). */
  alphaVsBench: number;
  /** Beta of the leg vs the benchmark. */
  betaVsBench: number;
  /** Correlation with benchmark. */
  corrVsBench: number;
  /** Approximate contribution to total portfolio return: w_i × leg TR. */
  contribution: number;
}

const TRADING_DAYS_LEG = 252;

export function legStats(
  ticker: string,
  weight: number,
  isDividendOnly: boolean,
  legCloses: number[],
  legReturns: number[],
  benchReturns: number[],
  riskFreeAnnual = 0.045,
): LegStats {
  const legWealth = wealthFromReturnsLocal(legReturns);
  const tr = totalReturnFromWealth(legWealth);
  const cg = cagrFromWealth(legWealth);
  const vol = annualizedVol(legReturns);

  const rfDaily = riskFreeAnnual / TRADING_DAYS_LEG;
  const n = Math.min(legReturns.length, benchReturns.length);
  let mp = 0;
  let mb = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const r = legReturns[i];
    const rb = benchReturns[i];
    if (Number.isFinite(r) && Number.isFinite(rb)) {
      mp += r - rfDaily;
      mb += rb - rfDaily;
      count++;
    }
  }
  mp = count ? mp / count : 0;
  mb = count ? mb / count : 0;
  let sbb = 0;
  let spb = 0;
  let spp = 0;
  for (let i = 0; i < n; i++) {
    const r = legReturns[i];
    const rb = benchReturns[i];
    if (Number.isFinite(r) && Number.isFinite(rb)) {
      const dp = r - rfDaily - mp;
      const db = rb - rfDaily - mb;
      sbb += db * db;
      spb += db * dp;
      spp += dp * dp;
    }
  }
  const beta = sbb > 0 ? spb / sbb : NaN;
  const alphaDaily = mp - beta * mb;
  const alpha = Number.isFinite(alphaDaily) ? alphaDaily * TRADING_DAYS_LEG : NaN;
  const corr = spp > 0 && sbb > 0 ? spb / Math.sqrt(spp * sbb) : NaN;
  void legCloses; // not used directly; kept in signature for clarity

  return {
    ticker,
    weight,
    isDividendOnly,
    totalReturn: tr,
    cagr: cg,
    volAnnual: vol,
    alphaVsBench: alpha,
    betaVsBench: beta,
    corrVsBench: corr,
    contribution: weight * tr,
  };
}

/* ──────────── correlation matrix ──────────── */

export interface CorrelationMatrix {
  /** Row/column labels — legs first, then benchmark. */
  labels: string[];
  /** values[i][j] = pearson correlation between labels[i] and labels[j]. */
  values: number[][];
}

export function correlationMatrix(
  legs: { ticker: string; returns: number[] }[],
  bench: { ticker: string; returns: number[] },
): CorrelationMatrix {
  const series = [
    ...legs.map((l) => ({ label: l.ticker, returns: l.returns })),
    { label: `${bench.ticker} (벤치)`, returns: bench.returns },
  ];
  const labels = series.map((s) => s.label);
  const n = series.length;
  const values: number[][] = Array.from({ length: n }, () => new Array(n).fill(NaN));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const c = pearson(series[i].returns, series[j].returns);
      values[i][j] = c;
      values[j][i] = c;
    }
  }
  return { labels, values };
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let ma = 0;
  let mb = 0;
  let cnt = 0;
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(a[i]) && Number.isFinite(b[i])) {
      ma += a[i];
      mb += b[i];
      cnt++;
    }
  }
  if (cnt < 2) return NaN;
  ma /= cnt;
  mb /= cnt;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(a[i]) && Number.isFinite(b[i])) {
      const da = a[i] - ma;
      const db = b[i] - mb;
      sab += da * db;
      saa += da * da;
      sbb += db * db;
    }
  }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN;
}

/* ──────────── risk-adjusted ratios ──────────── */

export interface RiskAdjusted {
  sharpe: number;
  sortino: number;
  calmar: number;
  var95: number;
  cvar95: number;
}

export function riskAdjusted(
  returns: number[],
  mdd: number,
  riskFreeAnnual = 0.045,
): RiskAdjusted {
  // Convert to log returns for calmar (existing implementation expects log
  // returns); use simple returns for Sharpe/Sortino/VaR which is the
  // standard convention.
  const cleaned = filterFinite(returns);
  const log = cleaned.map((r) => Math.log(1 + r));
  return {
    sharpe: sharpe(cleaned, riskFreeAnnual),
    sortino: sortino(cleaned, riskFreeAnnual),
    calmar: calmar(log, mdd),
    var95: historicalVaR(cleaned, 0.95),
    cvar95: historicalCVaR(cleaned, 0.95),
  };
}

/* ──────────── utility ──────────── */

function filterFinite(xs: number[]): number[] {
  return xs.filter((x) => Number.isFinite(x));
}

function wealthFromReturnsLocal(returns: number[]): number[] {
  const out: number[] = [1];
  let w = 1;
  for (const r of returns) {
    w *= 1 + (Number.isFinite(r) ? r : 0);
    out.push(w);
  }
  return out;
}
