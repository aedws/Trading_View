import type { PricePoint } from "@/lib/bt/backtest";
import { fetchPricesCached } from "@/lib/bt/priceCache";
import type { FetchMode } from "@/lib/bt/yahoo";

export type RebalanceMode = "daily" | "none";

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
 *  - "daily" rebalance: r_p[t] = Σ w_i r_i[t]. Theoretically clean and
 *    keeps the portfolio fixed at the requested weights every day.
 *  - "none" (drift): allocate w_i at t=0, let each leg grow on its own.
 *    Reported "weights" then drift over time.
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

  const portReturns = computePortfolioReturns(legSeries, args.rebalance);
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

function computePortfolioReturns(
  legs: LegSeries[],
  rebalance: RebalanceMode,
): number[] {
  const n = legs[0]?.returns.length ?? 0;
  if (rebalance === "daily") {
    const out = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let r = 0;
      let used = 0;
      for (const leg of legs) {
        const ri = leg.returns[i];
        if (Number.isFinite(ri)) {
          r += leg.weight * ri;
          used += leg.weight;
        }
      }
      out[i] = used > 0 ? r / used : 0;
    }
    return out;
  }
  // "none" — drift: track per-leg wealth, then aggregate.
  const wealth = legs.map((leg) => leg.weight);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let prevTotal = wealth.reduce((s, x) => s + x, 0);
    let nextTotal = 0;
    for (let j = 0; j < legs.length; j++) {
      const ri = legs[j].returns[i];
      const grow = Number.isFinite(ri) ? 1 + ri : 1;
      wealth[j] *= grow;
      nextTotal += wealth[j];
    }
    out.push(prevTotal > 0 ? nextTotal / prevTotal - 1 : 0);
  }
  return out;
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
