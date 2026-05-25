import type { PricePoint } from "@/lib/bt/backtest";
import { fetchPricesCached } from "@/lib/bt/priceCache";
import type { FetchMode } from "@/lib/bt/yahoo";

export type RebalanceMode = "daily" | "weekly" | "monthly" | "yearly";

export interface LegInput {
  ticker: string;
  /** Weight as a fraction of 1.0 (e.g. 0.25 for 25%). */
  weight: number;
}

export interface LegSeries {
  ticker: string;
  weight: number;
  /** Adjusted close aligned to the common calendar. */
  closes: number[];
  /** Simple daily return aligned to `dates[i-1] -> dates[i]`; length = closes.length - 1. */
  returns: number[];
}

export interface ComposedSeries {
  /** Common calendar (ISO YYYY-MM-DD), trading days only — intersection. */
  dates: string[];
  /** Each leg's aligned closes + simple daily returns. */
  legs: LegSeries[];
  /** Benchmark series aligned to `dates`. */
  bench: { ticker: string; closes: number[]; returns: number[] };
  /** Portfolio daily simple return series under chosen rebalance rule. */
  portReturns: number[];
  /** Portfolio wealth path normalized to start at 1.0. */
  portWealth: number[];
  /** Benchmark wealth path normalized to start at 1.0. */
  benchWealth: number[];
  rebalance: RebalanceMode;
}

/**
 * Fetch all tickers (legs + benchmark), align to the common trading day
 * intersection, and compute the portfolio daily-return series.
 *
 * Conventions:
 *  - Adjusted close is used everywhere → returns include dividends.
 *  - Rebalancing snaps each leg back to its target weight at the start of
 *    every period. Inside a period weights drift with the market.
 *      • "daily"   — every trading day (r_p[t] = Σ w_i r_i[t])
 *      • "weekly"  — at the first trading day of each ISO week
 *      • "monthly" — at the first trading day of each calendar month
 *      • "yearly"  — at the first trading day of each calendar year
 */
export async function composePortfolio(args: {
  legs: LegInput[];
  benchmark: string;
  mode: FetchMode;
  years?: number;
  start?: string;
  end?: string;
  rebalance: RebalanceMode;
}): Promise<ComposedSeries> {
  if (args.legs.length === 0) {
    throw new Error("최소 1개 종목이 필요합니다.");
  }
  if (args.legs.length > 10) {
    throw new Error("최대 10개 종목까지 합성 가능합니다.");
  }
  const sumW = args.legs.reduce((s, l) => s + l.weight, 0);
  if (!Number.isFinite(sumW) || sumW <= 0) {
    throw new Error("가중치 합이 0보다 커야 합니다.");
  }
  const normLegs = args.legs.map((l) => ({
    ticker: l.ticker.trim().toUpperCase(),
    weight: l.weight / sumW,
  }));

  const fetches = await Promise.all([
    ...normLegs.map((l) =>
      fetchPricesCached({
        ticker: l.ticker,
        mode: args.mode,
        years: args.years,
        start: args.start,
        end: args.end,
      }),
    ),
    fetchPricesCached({
      ticker: args.benchmark.trim().toUpperCase(),
      mode: args.mode,
      years: args.years,
      start: args.start,
      end: args.end,
    }),
  ]);

  const benchPrices = fetches[fetches.length - 1].prices;
  const legPrices = fetches.slice(0, fetches.length - 1).map((f) => f.prices);

  const allSeries: PricePoint[][] = [...legPrices, benchPrices];
  const dates = intersectDates(allSeries);
  if (dates.length < 30) {
    throw new Error(
      `공통 거래일이 부족합니다 (${dates.length}일). 기간을 늘리거나 종목을 줄여보세요.`,
    );
  }

  const aligned = allSeries.map((s) => alignToDates(s, dates));
  const benchClosesAligned = aligned[aligned.length - 1];
  const legClosesAligned = aligned.slice(0, aligned.length - 1);

  const legSeries: LegSeries[] = normLegs.map((l, i) => {
    const closes = legClosesAligned[i];
    const returns = simpleDailyReturns(closes);
    return { ticker: l.ticker, weight: l.weight, closes, returns };
  });
  const benchReturns = simpleDailyReturns(benchClosesAligned);

  const portReturns = computePortfolioReturns(legSeries, dates, args.rebalance);
  const portWealth = wealthFromReturns(portReturns);
  const benchWealth = wealthFromReturns(benchReturns);

  return {
    dates,
    legs: legSeries,
    bench: {
      ticker: args.benchmark.trim().toUpperCase(),
      closes: benchClosesAligned,
      returns: benchReturns,
    },
    portReturns,
    portWealth,
    benchWealth,
    rebalance: args.rebalance,
  };
}

/* ───────────────── helpers ───────────────── */

function intersectDates(series: PricePoint[][]): string[] {
  if (series.length === 0) return [];
  // Build sets per series of dates with positive close.
  const sets = series.map((s) => {
    const set = new Set<string>();
    for (const p of s) {
      if (typeof p.close === "number" && p.close > 0 && Number.isFinite(p.close)) {
        set.add(p.date);
      }
    }
    return set;
  });
  const [first, ...rest] = sets;
  const out: string[] = [];
  for (const d of first) {
    if (rest.every((s) => s.has(d))) out.push(d);
  }
  return out.sort();
}

function alignToDates(series: PricePoint[], dates: string[]): number[] {
  const m = new Map<string, number>();
  for (const p of series) m.set(p.date, p.close);
  return dates.map((d) => m.get(d) ?? NaN);
}

function simpleDailyReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1];
    const b = closes[i];
    if (a > 0 && Number.isFinite(a) && Number.isFinite(b)) {
      out.push(b / a - 1);
    } else {
      out.push(NaN);
    }
  }
  return out;
}

/**
 * Portfolio daily return series with rebalancing at period boundaries.
 *
 * Algorithm (works for any RebalanceMode):
 *   1. Initialize per-leg wealth = w_i (∑ = 1).
 *   2. For each return index i (i.e. close[i] → close[i+1]):
 *        a) If close[i+1] is the first trading day of a new period
 *           relative to close[i], reset legWealth[j] = total × w_j.
 *        b) Apply daily growth: legWealth[j] *= 1 + r_j[i].
 *        c) Portfolio return = total_after / total_before − 1.
 *
 * In daily mode condition (a) fires every step, collapsing to the clean
 * Σ w_j r_j[i] formula. In weekly/monthly/yearly mode weights drift
 * within the period and snap back to the target on the first trading
 * day of the next period.
 */
function computePortfolioReturns(
  legs: LegSeries[],
  dates: string[],
  rebalance: RebalanceMode,
): number[] {
  const n = legs[0]?.returns.length ?? 0;
  const weights = legs.map((l) => l.weight);
  let legWealth = weights.slice();
  let totalWealth = legWealth.reduce((s, x) => s + x, 0);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const prevIso = dates[i];
    const nextIso = dates[i + 1] ?? prevIso;
    const crossesBoundary =
      i > 0 && isNewPeriod(prevIso, nextIso, rebalance);
    if (crossesBoundary) {
      for (let j = 0; j < legs.length; j++) {
        legWealth[j] = totalWealth * weights[j];
      }
    }
    const prevTotal = legWealth.reduce((s, x) => s + x, 0);
    let nextTotal = 0;
    for (let j = 0; j < legs.length; j++) {
      const ri = legs[j].returns[i];
      const grow = Number.isFinite(ri) ? 1 + ri : 1;
      legWealth[j] *= grow;
      nextTotal += legWealth[j];
    }
    totalWealth = nextTotal;
    out.push(prevTotal > 0 ? nextTotal / prevTotal - 1 : 0);
  }
  return out;
}

function isNewPeriod(prevIso: string, nextIso: string, mode: RebalanceMode): boolean {
  if (mode === "daily") return true;
  return periodKey(prevIso, mode) !== periodKey(nextIso, mode);
}

function periodKey(iso: string, mode: RebalanceMode): string {
  if (mode === "yearly") return iso.slice(0, 4);
  if (mode === "monthly") return iso.slice(0, 7);
  if (mode === "weekly") {
    const d = new Date(iso + "T00:00:00Z");
    return isoWeekKey(d);
  }
  return iso;
}

/** ISO week key like "2025-W14". UTC-based for stability. */
function isoWeekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function wealthFromReturns(returns: number[]): number[] {
  const out: number[] = [1];
  let w = 1;
  for (const r of returns) {
    w *= 1 + (Number.isFinite(r) ? r : 0);
    out.push(w);
  }
  return out;
}
