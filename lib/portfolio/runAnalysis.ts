import { computeXirr } from "@/lib/coveredCall/xirr";
import type { FetchMode } from "@/lib/bt/yahoo";

import {
  composePortfolio,
  type DcaFrequency,
  type DividendTarget,
  type InvestConfig,
  type InvestMode,
  type LegInput,
  type RebalanceMode,
} from "./composer";
import {
  annualizedVol,
  capmStats,
  correlationMatrix,
  drawdownStatsFromWealth,
  legStats,
  riskAdjusted,
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
  invest: InvestConfig;
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

export interface YearlyRow {
  year: string;
  portfolio: number;
  benchmark: number;
  alpha: number; // port − bench
}

export interface MonthlyCell {
  year: number;
  month: number; // 1..12
  portfolio: number;
}

export interface CashSummary {
  totalContributed: number;
  portfolioFinalNominal: number;
  benchmarkFinalNominal: number;
  portfolioProfit: number;
  benchmarkProfit: number;
  /** Money-weighted IRR (XIRR). */
  portfolioXirr: number;
  benchmarkXirr: number;
}

export interface PortfolioAnalysisResult {
  startDate: string;
  endDate: string;
  tradingDays: number;
  rebalance: RebalanceMode;
  riskFreeAnnual: number;
  benchmark: string;

  /** Selected investing scheme. */
  investMode: InvestMode;
  /** DCA frequency (when investMode === "dca"). */
  dcaFrequency: DcaFrequency | null;
  dcaAmount: number | null;

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
    selfReinvest: boolean;
  }>;

  /** Portfolio: weights are normalized to sum to 1. */
  weights: Array<{ ticker: string; weight: number }>;

  /** Headline portfolio numbers (TWR-based). */
  portfolio: {
    totalReturn: number;
    cagr: number;
    volAnnual: number;
    finalWealth: number;
  };
  benchmarkStats: {
    totalReturn: number;
    cagr: number;
    volAnnual: number;
    finalWealth: number;
  };

  capm: CapmStats;
  risk: RiskAdjusted;
  benchRisk: RiskAdjusted;
  drawdown: { portfolio: DrawdownStats; benchmark: DrawdownStats };
  legs: LegStats[];
  correlation: CorrelationMatrix;

  wealthSeries: SeriesPoint[];
  drawdownSeries: DrawdownPoint[];

  /** Per calendar year TWR returns for portfolio vs benchmark. */
  yearly: YearlyRow[];
  /** Monthly portfolio TWR returns shaped for a heatmap (year × month). */
  monthlyHeatmap: {
    years: number[]; // sorted asc
    cells: MonthlyCell[]; // sparse list — UI fills NaN for missing months
  };

  /** Nominal cash flow summary (always defined; meaningful for DCA). */
  cash: CashSummary;
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
    invest: input.invest,
  });

  const startDate = composed.dates[0];
  const endDate = composed.dates[composed.dates.length - 1];

  const portTr = totalReturnFromTwr(composed.portReturns);
  const portCagr = cagrFromTwr(composed.portReturns);
  const portVol = annualizedVol(composed.portReturns);
  const benchTr = totalReturnFromTwr(composed.benchReturns);
  const benchCagr = cagrFromTwr(composed.benchReturns);
  const benchVol = annualizedVol(composed.benchReturns);

  const capm = capmStats(composed.portReturns, composed.benchReturns, riskFreeAnnual);

  const ddPort = drawdownStatsFromWealth(composed.portWealth, composed.dates);
  const ddBench = drawdownStatsFromWealth(composed.benchWealth, composed.dates);

  const risk = riskAdjusted(composed.portReturns, ddPort.mdd, riskFreeAnnual);
  const benchRisk = riskAdjusted(composed.benchReturns, ddBench.mdd, riskFreeAnnual);

  const legBreakdown = composed.legs.map((l) =>
    legStats(l.ticker, l.weight, l.closes, l.returns, composed.benchReturns, riskFreeAnnual),
  );

  const corr = correlationMatrix(composed.legs, {
    ticker: composed.bench.ticker,
    returns: composed.benchReturns,
  });

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

  // Yearly + monthly returns from TWR daily returns.
  const yearly = yearlyReturns(
    composed.dates,
    composed.portReturns,
    composed.benchReturns,
  );
  const monthlyHeatmap = monthlyReturnsHeatmap(composed.dates, composed.portReturns);

  // XIRR (money-weighted) from nominal cash flows.
  const portXirr = computeXirr(composed.portFlows);
  const benchXirr = computeXirr(composed.benchFlows);

  return {
    startDate,
    endDate,
    tradingDays: composed.dates.length,
    rebalance: composed.rebalance,
    riskFreeAnnual,
    benchmark: composed.bench.ticker,
    investMode: composed.investMode,
    dcaFrequency:
      input.invest.mode === "dca" ? input.invest.dcaFrequency ?? null : null,
    dcaAmount: input.invest.mode === "dca" ? input.invest.dcaAmount ?? null : null,
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
    yearly,
    monthlyHeatmap,
    cash: {
      totalContributed: composed.totalContributed,
      portfolioFinalNominal:
        composed.portNominalWealth[composed.portNominalWealth.length - 1],
      benchmarkFinalNominal:
        composed.benchNominalWealth[composed.benchNominalWealth.length - 1],
      portfolioProfit:
        composed.portNominalWealth[composed.portNominalWealth.length - 1] -
        composed.totalContributed,
      benchmarkProfit:
        composed.benchNominalWealth[composed.benchNominalWealth.length - 1] -
        composed.totalContributed,
      portfolioXirr: portXirr,
      benchmarkXirr: benchXirr,
    },
  };
}

/* ──────────── TWR aggregates ──────────── */

function totalReturnFromTwr(returns: number[]): number {
  if (returns.length === 0) return NaN;
  let prod = 1;
  for (const r of returns) prod *= 1 + (Number.isFinite(r) ? r : 0);
  return prod - 1;
}

function cagrFromTwr(returns: number[]): number {
  if (returns.length === 0) return NaN;
  let sumLog = 0;
  for (const r of returns) {
    const x = 1 + (Number.isFinite(r) ? r : 0);
    if (x > 0) sumLog += Math.log(x);
  }
  const years = returns.length / TRADING_DAYS;
  if (years <= 0) return NaN;
  return Math.exp(sumLog / years) - 1;
}

/* ──────────── yearly / monthly aggregations ──────────── */

function yearlyReturns(
  dates: string[],
  portReturns: number[],
  benchReturns: number[],
): YearlyRow[] {
  const map = new Map<string, { p: number; b: number }>();
  for (let i = 0; i < portReturns.length; i++) {
    const iso = dates[i + 1] ?? dates[i];
    const y = iso.slice(0, 4);
    const cur = map.get(y) ?? { p: 1, b: 1 };
    cur.p *= 1 + (Number.isFinite(portReturns[i]) ? portReturns[i] : 0);
    cur.b *= 1 + (Number.isFinite(benchReturns[i]) ? benchReturns[i] : 0);
    map.set(y, cur);
  }
  const years = [...map.keys()].sort();
  return years.map((y) => {
    const { p, b } = map.get(y)!;
    const port = p - 1;
    const bench = b - 1;
    return { year: y, portfolio: port, benchmark: bench, alpha: port - bench };
  });
}

function monthlyReturnsHeatmap(
  dates: string[],
  portReturns: number[],
): { years: number[]; cells: MonthlyCell[] } {
  const map = new Map<string, number>();
  for (let i = 0; i < portReturns.length; i++) {
    const iso = dates[i + 1] ?? dates[i];
    const key = iso.slice(0, 7); // YYYY-MM
    const grow = 1 + (Number.isFinite(portReturns[i]) ? portReturns[i] : 0);
    map.set(key, (map.get(key) ?? 1) * grow);
  }
  const cells: MonthlyCell[] = [];
  const yearSet = new Set<number>();
  for (const [key, prod] of map.entries()) {
    const y = parseInt(key.slice(0, 4), 10);
    const m = parseInt(key.slice(5, 7), 10);
    yearSet.add(y);
    cells.push({ year: y, month: m, portfolio: prod - 1 });
  }
  return {
    years: [...yearSet].sort((a, b) => a - b),
    cells: cells.sort((a, b) =>
      a.year === b.year ? a.month - b.month : a.year - b.year,
    ),
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
