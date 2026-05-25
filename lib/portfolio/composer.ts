import type { PricePoint } from "@/lib/bt/backtest";
import { fetchPricesCached } from "@/lib/bt/priceCache";
import type { DividendEvent, FetchMode, SplitEvent } from "@/lib/bt/yahoo";

export type RebalanceMode = "daily" | "weekly" | "monthly" | "yearly";

export interface DividendTarget {
  /** Target ticker (must be one of the portfolio legs). */
  ticker: string;
  /** Fraction of the cash to route here. Normalized so the per-leg sum = 1. */
  weight: number;
}

export interface LegInput {
  ticker: string;
  /** Weight as a fraction of 1.0 (e.g. 0.25 for 25%). */
  weight: number;
  /**
   * Dividend distribution targets. If omitted / empty / sum=0, defaults to
   * 100% self-reinvest (i.e. behaviour identical to using adjusted close).
   */
  dividendDistribution?: DividendTarget[];
}

export interface LegSeries {
  ticker: string;
  weight: number;
  /** Adjusted close aligned to the common calendar (self-reinvest baseline). */
  closes: number[];
  /** Simple daily return of adjclose (length = closes.length − 1). */
  returns: number[];
  /** First date the leg had usable price data (regardless of intersection). */
  firstDate: string;
  /** Resolved dividend distribution (sum to 1.0). */
  dividendDistribution: DividendTarget[];
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
  /** Requested span (from input args). */
  requestedRange: { start: string; end: string };
  /** Effective span (intersection of available trading data). */
  effectiveRange: { start: string; end: string };
  /** Which leg's listing date is forcing the start (=oldest first-bar). */
  bindingLeg: { ticker: string; firstDate: string } | null;
}

/**
 * Fetch all tickers (legs + benchmark), align to the common trading day
 * intersection (= forced to start at the youngest leg's listing date),
 * and simulate a share-based portfolio with explicit dividend routing.
 *
 * Notes:
 *  - The simulator uses Yahoo `rawClose` for leg values and processes
 *    splits + dividends explicitly:
 *      • on split:   shares[j] *= ratio   (no cash effect; rawClose drops)
 *      • on div:     cash = shares[j] × per-share; routed per
 *                    `dividendDistribution` (default = 100% self).
 *  - Rebalancing snaps each leg back to its target weight at the first
 *    trading day of every period (daily / weekly / monthly / yearly).
 *  - Benchmark uses adjclose (self-reinvest baseline), as an apples-to-
 *    apples reference.
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
  const legTickers = args.legs.map((l) => l.ticker.trim().toUpperCase());
  const normLegs = args.legs.map((l, idx) => {
    const ticker = legTickers[idx];
    const weight = l.weight / sumW;
    const dist = resolveDistribution(ticker, l.dividendDistribution, legTickers);
    return { ticker, weight, dividendDistribution: dist };
  });

  const benchSym = args.benchmark.trim().toUpperCase();
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
      ticker: benchSym,
      mode: args.mode,
      years: args.years,
      start: args.start,
      end: args.end,
    }),
  ]);

  const legFetches = fetches.slice(0, fetches.length - 1);
  const benchFetch = fetches[fetches.length - 1];

  // Common calendar = intersection of legs + benchmark trading days. This
  // is what forces "start at the youngest ticker's listing date".
  const allSeries: PricePoint[][] = [
    ...legFetches.map((f) => f.prices),
    benchFetch.prices,
  ];
  const dates = intersectDates(allSeries);
  if (dates.length < 30) {
    throw new Error(
      `공통 거래일이 부족합니다 (${dates.length}일). 기간을 늘리거나 종목을 줄여보세요.`,
    );
  }

  const aligned = allSeries.map((s) => alignToDates(s, dates));
  const benchClosesAligned = aligned[aligned.length - 1];
  const legAdjAligned = aligned.slice(0, aligned.length - 1);

  // Per-leg raw close, dividends, splits aligned to `dates`.
  const legRawAligned = legFetches.map((f) =>
    alignRawToDates(f.rawPrices, dates),
  );
  const legDivBetween = legFetches.map((f) =>
    bucketDividendsBetween(f.dividends, dates),
  );
  const legSplitBetween = legFetches.map((f) =>
    bucketSplitsBetween(f.splits, dates),
  );

  const legFirstDates = legFetches.map((f) => f.prices[0]?.date ?? "");
  const bindingIdx = legFirstDates.reduce(
    (best, d, i, arr) => (d > arr[best] ? i : best),
    0,
  );
  const bindingLeg = legFirstDates[bindingIdx]
    ? { ticker: normLegs[bindingIdx].ticker, firstDate: legFirstDates[bindingIdx] }
    : null;

  const legSeries: LegSeries[] = normLegs.map((l, i) => ({
    ticker: l.ticker,
    weight: l.weight,
    closes: legAdjAligned[i],
    returns: simpleDailyReturns(legAdjAligned[i]),
    firstDate: legFirstDates[i],
    dividendDistribution: l.dividendDistribution,
  }));
  const benchReturns = simpleDailyReturns(benchClosesAligned);

  const sim = simulatePortfolio({
    weights: normLegs.map((l) => l.weight),
    distributions: normLegs.map((l) => l.dividendDistribution),
    legTickers: normLegs.map((l) => l.ticker),
    rawCloses: legRawAligned,
    divBetween: legDivBetween,
    splitBetween: legSplitBetween,
    dates,
    rebalance: args.rebalance,
  });

  const portWealth = sim.wealth;
  const portReturns = returnsFromWealth(portWealth);
  const benchWealth = wealthFromReturns(benchReturns);

  const requestedStart =
    args.mode === "custom"
      ? args.start ?? ""
      : args.mode === "years"
        ? toIso(addYears(new Date(), -(args.years ?? 10)))
        : "";
  const requestedEnd =
    args.mode === "custom" ? args.end ?? "" : toIso(new Date());

  return {
    dates,
    legs: legSeries,
    bench: {
      ticker: benchSym,
      closes: benchClosesAligned,
      returns: benchReturns,
    },
    portReturns,
    portWealth,
    benchWealth,
    rebalance: args.rebalance,
    requestedRange: { start: requestedStart, end: requestedEnd },
    effectiveRange: { start: dates[0], end: dates[dates.length - 1] },
    bindingLeg,
  };
}

/* ───────────────── distribution resolution ───────────────── */

function resolveDistribution(
  selfTicker: string,
  raw: DividendTarget[] | undefined,
  validTickers: string[],
): DividendTarget[] {
  const validSet = new Set(validTickers);
  const list = (raw ?? [])
    .map((d) => ({
      ticker: d.ticker?.trim().toUpperCase() ?? "",
      weight: Number(d.weight),
    }))
    .filter(
      (d) =>
        d.ticker &&
        validSet.has(d.ticker) &&
        Number.isFinite(d.weight) &&
        d.weight > 0,
    );
  if (list.length === 0) {
    return [{ ticker: selfTicker, weight: 1 }];
  }
  const sum = list.reduce((s, d) => s + d.weight, 0);
  if (sum <= 0) return [{ ticker: selfTicker, weight: 1 }];
  return list.map((d) => ({ ticker: d.ticker, weight: d.weight / sum }));
}

/* ───────────────── share-based simulator ───────────────── */

function simulatePortfolio(args: {
  weights: number[];
  distributions: DividendTarget[][];
  legTickers: string[];
  rawCloses: number[][];
  divBetween: number[][];
  splitBetween: number[][];
  dates: string[];
  rebalance: RebalanceMode;
}): { wealth: number[] } {
  const { weights, distributions, legTickers, rawCloses, divBetween, splitBetween, dates, rebalance } = args;
  const nLegs = weights.length;
  const N = dates.length;
  const tickerIdx = new Map(legTickers.map((t, i) => [t, i]));

  // Initial allocation at dates[0] using rawClose[0].
  const TOTAL0 = 1.0;
  const shares = new Array(nLegs).fill(0);
  for (let j = 0; j < nLegs; j++) {
    const p0 = rawCloses[j][0];
    if (p0 > 0 && Number.isFinite(p0)) {
      shares[j] = (TOTAL0 * weights[j]) / p0;
    }
  }

  const wealth = new Array(N).fill(0);
  wealth[0] = TOTAL0;

  for (let t = 1; t < N; t++) {
    // 1) Splits accumulated in (dates[t-1], dates[t]].
    for (let j = 0; j < nLegs; j++) {
      const ratio = splitBetween[j][t];
      if (ratio !== 1) shares[j] *= ratio;
    }

    // 2) Dividends accumulated in (dates[t-1], dates[t]].
    //    Use t's rawClose for deploying the cash. Per-leg cash bucket is
    //    routed independently per its own distribution config.
    for (let j = 0; j < nLegs; j++) {
      const perShare = divBetween[j][t];
      if (perShare <= 0) continue;
      const cash = shares[j] * perShare;
      if (cash <= 0) continue;
      for (const d of distributions[j]) {
        const idx = tickerIdx.get(d.ticker);
        if (idx === undefined) continue;
        const px = rawCloses[idx][t];
        if (px > 0 && Number.isFinite(px)) {
          shares[idx] += (cash * d.weight) / px;
        }
      }
    }

    // 3) Compute total value at price[t].
    let total = 0;
    for (let j = 0; j < nLegs; j++) {
      const px = rawCloses[j][t];
      if (px > 0 && Number.isFinite(px)) total += shares[j] * px;
    }

    // 4) Period-boundary rebalance: snap shares to target weights.
    if (isNewPeriod(dates[t - 1], dates[t], rebalance)) {
      for (let j = 0; j < nLegs; j++) {
        const px = rawCloses[j][t];
        if (px > 0 && Number.isFinite(px)) {
          shares[j] = (total * weights[j]) / px;
        }
      }
    }

    wealth[t] = total > 0 ? total : wealth[t - 1];
  }

  // Normalize so wealth starts at 1.0 — already does since TOTAL0=1.
  return { wealth };
}

/* ───────────────── alignment helpers ───────────────── */

function intersectDates(series: PricePoint[][]): string[] {
  if (series.length === 0) return [];
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

function alignRawToDates(
  rawPrices: Array<{ date: string; rawClose: number }>,
  dates: string[],
): number[] {
  const m = new Map<string, number>();
  for (const p of rawPrices) {
    if (typeof p.rawClose === "number" && p.rawClose > 0) {
      m.set(p.date, p.rawClose);
    }
  }
  // Forward-fill within window so a missing raw bar doesn't kill the sim.
  let last = NaN;
  return dates.map((d) => {
    const v = m.get(d);
    if (typeof v === "number" && v > 0) {
      last = v;
      return v;
    }
    return last;
  });
}

/**
 * For each date `dates[t]`, bucket the sum of dividend per-share amounts
 * paid in the window (dates[t-1], dates[t]]. Index 0 returns 0.
 */
function bucketDividendsBetween(
  divs: DividendEvent[],
  dates: string[],
): number[] {
  return bucketBetween(
    divs.map((d) => ({ date: d.date, value: d.amount })),
    dates,
    (a, b) => a + b,
    0,
  );
}

/**
 * For each date `dates[t]`, multiply split ratios in (dates[t-1], dates[t]].
 * Default 1 (no split).
 */
function bucketSplitsBetween(
  splits: SplitEvent[],
  dates: string[],
): number[] {
  return bucketBetween(
    splits.map((s) => ({ date: s.date, value: s.ratio })),
    dates,
    (a, b) => a * b,
    1,
  );
}

function bucketBetween(
  events: Array<{ date: string; value: number }>,
  dates: string[],
  combine: (acc: number, v: number) => number,
  identity: number,
): number[] {
  if (dates.length === 0) return [];
  const out = new Array(dates.length).fill(identity);
  if (events.length === 0) return out;
  const sorted = [...events].sort((a, b) => (a.date < b.date ? -1 : 1));
  let cursor = 0;
  for (let t = 1; t < dates.length; t++) {
    const lo = dates[t - 1];
    const hi = dates[t];
    let acc = identity;
    while (cursor < sorted.length && sorted[cursor].date <= lo) cursor++;
    let k = cursor;
    while (k < sorted.length && sorted[k].date <= hi) {
      acc = combine(acc, sorted[k].value);
      k++;
    }
    out[t] = acc;
    // Don't advance cursor here — next iteration may need same window edge.
  }
  return out;
}

/* ───────────────── simple-returns + wealth ───────────────── */

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

function returnsFromWealth(wealth: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < wealth.length; i++) {
    const a = wealth[i - 1];
    const b = wealth[i];
    if (a > 0 && Number.isFinite(a) && Number.isFinite(b)) {
      out.push(b / a - 1);
    } else {
      out.push(0);
    }
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

/* ───────────────── period detection ───────────────── */

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

function isoWeekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/* ───────────────── misc ───────────────── */

function toIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addYears(d: Date, years: number): Date {
  const out = new Date(d.getTime());
  out.setUTCFullYear(out.getUTCFullYear() + years);
  return out;
}
