import type { FetchMode } from "@/lib/bt/yahoo";

import {
  composePortfolio,
  type DividendTarget,
  type LegInput,
  type RebalanceMode,
} from "./composer";
import {
  annualizedVol,
  cagrFromWealth,
  capmStats,
  correlationMatrix,
  drawdownStatsFromWealth,
  legStats,
  riskAdjusted,
  totalReturnFromWealth,
  type CapmStats,
  type CorrelationMatrix,
  type DrawdownStats,
  type LegStats,
  type RiskAdjusted,
} from "./metrics";

export interface PortfolioAnalysisInput {
  legs: LegInput[];
  benchmark: string;
  mode: FetchMode;
  years?: number;
  start?: string;
  end?: string;
  rebalance: RebalanceMode;
  riskFreeAnnual?: number;
}

export interface SeriesPoint {
  date: string;
  portfolio: number;
  benchmark: number;
}

export interface DrawdownPoint {
  date: string;
  portfolio: number;
  benchmark: number;
}

export interface PortfolioAnalysisResult {
  startDate: string;
  endDate: string;
  tradingDays: number;
  rebalance: RebalanceMode;
  riskFreeAnnual: number;
  benchmark: string;

  /** Requested window (from input). */
  requestedRange: { start: string; end: string };
  /** Effective window (= intersection / forced by youngest leg). */
  effectiveRange: { start: string; end: string };
  /** Which leg is forcing the start = youngest listing date. */
  bindingLeg: { ticker: string; firstDate: string } | null;
  /** Per-leg first available date (independent of intersection). */
  legInceptions: Array<{ ticker: string; firstDate: string }>;
  /** Resolved per-leg dividend distribution (each sums to 1.0). */
  dividendRouting: Array<{
    ticker: string;
    targets: DividendTarget[];
    /** Convenience: true if all weight goes back to the leg itself. */
    selfReinvest: boolean;
  }>;

  /** Portfolio: weights are normalized to sum to 1. */
  weights: Array<{ ticker: string; weight: number }>;

  /** Headline portfolio numbers. */
  portfolio: {
    totalReturn: number;
    cagr: number;
    volAnnual: number;
    finalWealth: number;
  };

  /** Same numbers for the benchmark. */
  benchmarkStats: {
    totalReturn: number;
    cagr: number;
    volAnnual: number;
    finalWealth: number;
  };

  /** Alpha, beta, R², TE, IR, correlation, up/down capture, hit rate. */
  capm: CapmStats;

  /** Risk-adjusted ratios for the portfolio. */
  risk: RiskAdjusted;

  /** Risk-adjusted ratios for the benchmark — useful for side-by-side compare. */
  benchRisk: RiskAdjusted;

  /** Drawdown summary for portfolio & benchmark. */
  drawdown: { portfolio: DrawdownStats; benchmark: DrawdownStats };

  /** Per-leg breakdown. */
  legs: LegStats[];

  /** Correlation matrix (legs + benchmark). */
  correlation: CorrelationMatrix;

  /** Down-sampled wealth path (≤ ~250 points) for chart rendering. */
  wealthSeries: SeriesPoint[];

  /** Down-sampled drawdown series. */
  drawdownSeries: DrawdownPoint[];
}

const TRADING_DAYS = 252;

export async function runPortfolioAnalysis(
  input: PortfolioAnalysisInput,
): Promise<PortfolioAnalysisResult> {
  const riskFreeAnnual =
    typeof input.riskFreeAnnual === "number" && Number.isFinite(input.riskFreeAnnual)
      ? input.riskFreeAnnual
      : 0.045;

  const composed = await composePortfolio({
    legs: input.legs,
    benchmark: input.benchmark,
    mode: input.mode,
    years: input.years,
    start: input.start,
    end: input.end,
    rebalance: input.rebalance,
  });

  const startDate = composed.dates[0];
  const endDate = composed.dates[composed.dates.length - 1];

  const portTr = totalReturnFromWealth(composed.portWealth);
  const portCagr = cagrFromWealth(composed.portWealth);
  const portVol = annualizedVol(composed.portReturns);
  const benchTr = totalReturnFromWealth(composed.benchWealth);
  const benchCagr = cagrFromWealth(composed.benchWealth);
  const benchVol = annualizedVol(composed.bench.returns);

  const capm = capmStats(composed.portReturns, composed.bench.returns, riskFreeAnnual);

  const ddPort = drawdownStatsFromWealth(composed.portWealth, composed.dates);
  const ddBench = drawdownStatsFromWealth(composed.benchWealth, composed.dates);

  const risk = riskAdjusted(composed.portReturns, ddPort.mdd, riskFreeAnnual);
  const benchRisk = riskAdjusted(composed.bench.returns, ddBench.mdd, riskFreeAnnual);

  const legBreakdown = composed.legs.map((l) =>
    legStats(l.ticker, l.weight, l.closes, l.returns, composed.bench.returns),
  );

  const corr = correlationMatrix(composed.legs, composed.bench);

  const wealthSeries = downsampleWealth(
    composed.dates,
    composed.portWealth,
    composed.benchWealth,
  );
  const drawdownSeries = downsampleDrawdown(
    composed.dates,
    composed.portWealth,
    composed.benchWealth,
  );

  const dividendRouting = composed.legs.map((l) => ({
    ticker: l.ticker,
    targets: l.dividendDistribution,
    selfReinvest:
      l.dividendDistribution.length === 1 &&
      l.dividendDistribution[0].ticker === l.ticker &&
      Math.abs(l.dividendDistribution[0].weight - 1) < 1e-9,
  }));

  return {
    startDate,
    endDate,
    tradingDays: composed.dates.length,
    rebalance: composed.rebalance,
    riskFreeAnnual,
    benchmark: composed.bench.ticker,
    requestedRange: composed.requestedRange,
    effectiveRange: composed.effectiveRange,
    bindingLeg: composed.bindingLeg,
    legInceptions: composed.legs.map((l) => ({
      ticker: l.ticker,
      firstDate: l.firstDate,
    })),
    dividendRouting,
    weights: composed.legs.map((l) => ({ ticker: l.ticker, weight: l.weight })),
    portfolio: {
      totalReturn: portTr,
      cagr: portCagr,
      volAnnual: portVol,
      finalWealth: composed.portWealth[composed.portWealth.length - 1],
    },
    benchmarkStats: {
      totalReturn: benchTr,
      cagr: benchCagr,
      volAnnual: benchVol,
      finalWealth: composed.benchWealth[composed.benchWealth.length - 1],
    },
    capm,
    risk,
    benchRisk,
    drawdown: { portfolio: ddPort, benchmark: ddBench },
    legs: legBreakdown,
    correlation: corr,
    wealthSeries,
    drawdownSeries,
  };
}

/* ──────────── chart helpers ──────────── */

function downsampleWealth(
  dates: string[],
  portWealth: number[],
  benchWealth: number[],
): SeriesPoint[] {
  const n = Math.min(dates.length, portWealth.length, benchWealth.length);
  const step = Math.max(1, Math.floor(n / 240));
  const out: SeriesPoint[] = [];
  for (let i = 0; i < n; i += step) {
    out.push({
      date: dates[i],
      portfolio: portWealth[i],
      benchmark: benchWealth[i],
    });
  }
  if (out.length === 0 || out[out.length - 1].date !== dates[n - 1]) {
    out.push({
      date: dates[n - 1],
      portfolio: portWealth[n - 1],
      benchmark: benchWealth[n - 1],
    });
  }
  return out;
}

function downsampleDrawdown(
  dates: string[],
  portWealth: number[],
  benchWealth: number[],
): DrawdownPoint[] {
  const ddPort = drawdownSeries(portWealth);
  const ddBench = drawdownSeries(benchWealth);
  const n = Math.min(dates.length, ddPort.length, ddBench.length);
  const step = Math.max(1, Math.floor(n / 240));
  const out: DrawdownPoint[] = [];
  for (let i = 0; i < n; i += step) {
    out.push({ date: dates[i], portfolio: ddPort[i], benchmark: ddBench[i] });
  }
  if (out.length === 0 || out[out.length - 1].date !== dates[n - 1]) {
    out.push({
      date: dates[n - 1],
      portfolio: ddPort[n - 1],
      benchmark: ddBench[n - 1],
    });
  }
  return out;
}

function drawdownSeries(wealth: number[]): number[] {
  const out = new Array(wealth.length).fill(0);
  let peak = -Infinity;
  for (let i = 0; i < wealth.length; i++) {
    const w = wealth[i];
    if (w > peak) peak = w;
    out[i] = peak > 0 ? w / peak - 1 : 0;
  }
  return out;
}

// Silence unused-import warnings if any tooling expects TRADING_DAYS here.
void TRADING_DAYS;
