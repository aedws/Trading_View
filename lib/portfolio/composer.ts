import type { PricePoint } from "@/lib/bt/backtest";
import { fetchPricesCached } from "@/lib/bt/priceCache";
import type { DividendEvent, FetchMode, SplitEvent } from "@/lib/bt/yahoo";

export type RebalanceMode = "daily" | "weekly" | "monthly" | "yearly";
export type InvestMode = "lump" | "dca";
export type DcaFrequency = "weekly" | "biweekly" | "monthly" | "quarterly";

export interface InvestConfig {
  mode: InvestMode;
  /** Initial lump-sum amount (default 1). Ignored for DCA. */
  lumpAmount?: number;
  /** Required when mode === "dca". USD per contribution period. */
  dcaAmount?: number;
  /** Required when mode === "dca". */
  dcaFrequency?: DcaFrequency;
}

export interface CashFlow {
  date: string;
  amount: number;
}

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
  /**
   * True if this leg only exists as a dividend-distribution target —
   * it receives no initial allocation, no new DCA contributions, and is
   * excluded from rebalancing. It grows purely from dividends routed to
   * it by other legs (plus its own price action / self-reinvested divs).
   */
  isDividendOnly: boolean;
}

export interface ComposedSeries {
  /** Common calendar (ISO YYYY-MM-DD), trading days only — intersection. */
  dates: string[];
  /** Each leg's aligned closes + simple daily returns. */
  legs: LegSeries[];
  /** Benchmark series aligned to `dates`. */
  bench: { ticker: string; closes: number[]; returns: number[] };
  /** Portfolio daily TWR return series (excludes contribution-day cash add). */
  portReturns: number[];
  /** Portfolio TWR-index wealth path normalized to start at 1.0. */
  portWealth: number[];
  /** Benchmark TWR-index wealth path normalized to start at 1.0. */
  benchWealth: number[];
  /** Benchmark daily TWR return series. */
  benchReturns: number[];
  rebalance: RebalanceMode;
  /** Requested span (from input args). */
  requestedRange: { start: string; end: string };
  /** Effective span (intersection of available trading data). */
  effectiveRange: { start: string; end: string };
  /** Which leg's listing date is forcing the start (=oldest first-bar). */
  bindingLeg: { ticker: string; firstDate: string } | null;

  /** Selected investing scheme (lump-sum vs DCA). */
  investMode: InvestMode;
  /** Nominal wealth path of the portfolio (includes contributions). */
  portNominalWealth: number[];
  /** Nominal wealth path of the benchmark. */
  benchNominalWealth: number[];
  /** Cash contribution amount on each date (0 = none). */
  contributions: number[];
  /** Total amount contributed over the window. */
  totalContributed: number;
  /** XIRR-ready cash flows for the portfolio (negative=contribution, +final). */
  portFlows: CashFlow[];
  /** XIRR-ready cash flows for the benchmark. */
  benchFlows: CashFlow[];
  /** Final nominal value per leg (matches `legs[]` order). */
  finalLegValues: number[];
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
  invest: InvestConfig;
}): Promise<ComposedSeries> {
  if (args.legs.length === 0) {
    throw new Error("최소 1개 종목이 필요합니다.");
  }
  if (args.legs.length > 10) {
    throw new Error("최대 10개 코어 종목까지 가능합니다.");
  }
  const sumW = args.legs.reduce((s, l) => s + l.weight, 0);
  if (!Number.isFinite(sumW) || sumW <= 0) {
    throw new Error("가중치 합이 0보다 커야 합니다.");
  }

  // Step 1: resolve core legs (positive weight, target allocation).
  const coreTickers = args.legs.map((l) => l.ticker.trim().toUpperCase());
  const coreLegs = args.legs.map((l, idx) => {
    const ticker = coreTickers[idx];
    const weight = l.weight / sumW;
    const dist = resolveDistribution(ticker, l.dividendDistribution);
    return { ticker, weight, dividendDistribution: dist, isDividendOnly: false };
  });

  // Step 2: collect any dividend-target tickers that are NOT among core
  // legs. Those become "dividend-only" legs: weight=0, no rebalancing,
  // no DCA — they only grow from routed dividend cash + own price action.
  const coreSet = new Set(coreTickers);
  const extraSet = new Set<string>();
  for (const l of coreLegs) {
    for (const d of l.dividendDistribution) {
      if (!coreSet.has(d.ticker)) extraSet.add(d.ticker);
    }
  }
  const extraTickers = [...extraSet];
  const extraLegs = extraTickers.map((ticker) => ({
    ticker,
    weight: 0,
    // div-only legs always self-reinvest their own dividends
    dividendDistribution: [{ ticker, weight: 1 }] as DividendTarget[],
    isDividendOnly: true,
  }));
  const normLegs = [...coreLegs, ...extraLegs];

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
    isDividendOnly: l.isDividendOnly,
  }));

  // Build DCA contribution schedule (per-date amount; 0 means no contribution).
  const lumpAmount = args.invest.lumpAmount ?? 1;
  const dcaAmount = args.invest.dcaAmount ?? 0;
  const dcaSchedule =
    args.invest.mode === "dca" && args.invest.dcaFrequency && dcaAmount > 0
      ? buildDcaSchedule(dates, args.invest.dcaFrequency)
      : null;
  const contributions = new Array(dates.length).fill(0);
  if (args.invest.mode === "lump") {
    contributions[0] = lumpAmount;
  } else if (dcaSchedule) {
    for (const idx of dcaSchedule) contributions[idx] = dcaAmount;
  }

  // Portfolio simulator (legs, dividend routing, rebalancing).
  const sim = simulatePortfolio({
    weights: normLegs.map((l) => l.weight),
    distributions: normLegs.map((l) => l.dividendDistribution),
    legTickers: normLegs.map((l) => l.ticker),
    isDividendOnly: normLegs.map((l) => l.isDividendOnly),
    rawCloses: legRawAligned,
    divBetween: legDivBetween,
    splitBetween: legSplitBetween,
    dates,
    rebalance: args.rebalance,
    contributions,
  });

  // Benchmark — same contribution schedule, single asset, no rebal/dist routing.
  const benchSim = simulateSingleAsset({
    closes: benchClosesAligned,
    contributions,
    dates,
  });

  const portReturns = sim.twrReturns;
  const portWealth = sim.twrWealth;
  const benchReturns = benchSim.twrReturns;
  const benchWealth = benchSim.twrWealth;

  const requestedStart =
    args.mode === "custom"
      ? args.start ?? ""
      : args.mode === "years"
        ? toIso(addYears(new Date(), -(args.years ?? 10)))
        : "";
  const requestedEnd =
    args.mode === "custom" ? args.end ?? "" : toIso(new Date());

  // Build XIRR-style flows for portfolio and benchmark.
  const finalPortNominal = sim.nominalWealth[sim.nominalWealth.length - 1];
  const finalBenchNominal = benchSim.nominalWealth[benchSim.nominalWealth.length - 1];
  const portFlows: CashFlow[] = [];
  const benchFlows: CashFlow[] = [];
  for (let t = 0; t < dates.length; t++) {
    if (contributions[t] > 0) {
      portFlows.push({ date: dates[t], amount: -contributions[t] });
      benchFlows.push({ date: dates[t], amount: -contributions[t] });
    }
  }
  portFlows.push({ date: dates[dates.length - 1], amount: finalPortNominal });
  benchFlows.push({ date: dates[dates.length - 1], amount: finalBenchNominal });

  const totalContributed = contributions.reduce((s, x) => s + x, 0);

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
    benchReturns,
    rebalance: args.rebalance,
    requestedRange: { start: requestedStart, end: requestedEnd },
    effectiveRange: { start: dates[0], end: dates[dates.length - 1] },
    bindingLeg,
    investMode: args.invest.mode,
    portNominalWealth: sim.nominalWealth,
    benchNominalWealth: benchSim.nominalWealth,
    contributions,
    totalContributed,
    portFlows,
    benchFlows,
    finalLegValues: sim.finalLegValues,
  };
}

/* ───────────────── distribution resolution ───────────────── */

function resolveDistribution(
  selfTicker: string,
  raw: DividendTarget[] | undefined,
): DividendTarget[] {
  // Accept ANY ticker (including ones not in the portfolio) — those get
  // turned into zero-weight "dividend-only" legs by the caller.
  const list = (raw ?? [])
    .map((d) => ({
      ticker: d.ticker?.trim().toUpperCase() ?? "",
      weight: Number(d.weight),
    }))
    .filter(
      (d) =>
        d.ticker && Number.isFinite(d.weight) && d.weight > 0,
    );
  if (list.length === 0) {
    return [{ ticker: selfTicker, weight: 1 }];
  }
  const sum = list.reduce((s, d) => s + d.weight, 0);
  if (sum <= 0) return [{ ticker: selfTicker, weight: 1 }];
  return list.map((d) => ({ ticker: d.ticker, weight: d.weight / sum }));
}

/* ───────────────── share-based simulator ───────────────── */

interface SimOutput {
  /** Daily time-weighted return (excludes contribution-day cash addition). */
  twrReturns: number[];
  /** TWR index (starts at 1.0, compounds twrReturns). */
  twrWealth: number[];
  /** Nominal wealth (includes contributions). */
  nominalWealth: number[];
  /** Per-leg final value in nominal terms (shares × rawClose at last date). */
  finalLegValues: number[];
}

function simulatePortfolio(args: {
  weights: number[];
  distributions: DividendTarget[][];
  legTickers: string[];
  /** Per-leg flag: skip rebalancing + DCA contribution for these. */
  isDividendOnly: boolean[];
  rawCloses: number[][];
  divBetween: number[][];
  splitBetween: number[][];
  dates: string[];
  rebalance: RebalanceMode;
  /** Cash contribution at each date (0 = none). contributions[0] is the
   *  initial seed (lump or first DCA installment). */
  contributions: number[];
}): SimOutput {
  const { weights, distributions, legTickers, isDividendOnly, rawCloses, divBetween, splitBetween, dates, rebalance, contributions } = args;
  const nLegs = weights.length;
  const N = dates.length;
  const tickerIdx = new Map(legTickers.map((t, i) => [t, i]));

  const shares = new Array(nLegs).fill(0);
  const nominalWealth = new Array(N).fill(0);
  const twrWealth = new Array(N).fill(1);
  const twrReturns: number[] = [];

  // Day 0: deploy the seed contribution into CORE legs only.
  let totalNominal = 0;
  if (contributions[0] > 0) {
    for (let j = 0; j < nLegs; j++) {
      if (isDividendOnly[j]) continue;
      const p0 = rawCloses[j][0];
      if (p0 > 0 && Number.isFinite(p0)) {
        shares[j] = (contributions[0] * weights[j]) / p0;
      }
    }
    totalNominal = contributions[0];
  }
  nominalWealth[0] = totalNominal;
  twrWealth[0] = 1;

  for (let t = 1; t < N; t++) {
    // 1) Splits accumulated in (dates[t-1], dates[t]].
    for (let j = 0; j < nLegs; j++) {
      const ratio = splitBetween[j][t];
      if (ratio !== 1) shares[j] *= ratio;
    }

    // 2) Dividends accumulated in (dates[t-1], dates[t]].
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

    // 3) Value BEFORE today's contribution (drives TWR).
    let preContribValue = 0;
    for (let j = 0; j < nLegs; j++) {
      const px = rawCloses[j][t];
      if (px > 0 && Number.isFinite(px)) preContribValue += shares[j] * px;
    }
    const prevNominal = totalNominal;
    const twrDaily =
      prevNominal > 0 ? preContribValue / prevNominal - 1 : 0;
    twrReturns.push(twrDaily);
    twrWealth[t] = twrWealth[t - 1] * (1 + twrDaily);

    // 4) Today's contribution (if any), deployed into CORE legs by weights.
    let totalAfter = preContribValue;
    if (contributions[t] > 0) {
      for (let j = 0; j < nLegs; j++) {
        if (isDividendOnly[j]) continue;
        const px = rawCloses[j][t];
        if (px > 0 && Number.isFinite(px)) {
          shares[j] += (contributions[t] * weights[j]) / px;
        }
      }
      totalAfter += contributions[t];
    }

    // 5) Period-boundary rebalance — CORE legs only. Dividend-only legs
    //    keep their accumulated shares so they grow purely from routed cash.
    if (isNewPeriod(dates[t - 1], dates[t], rebalance) && totalAfter > 0) {
      let coreTotal = 0;
      for (let j = 0; j < nLegs; j++) {
        if (isDividendOnly[j]) continue;
        const px = rawCloses[j][t];
        if (px > 0 && Number.isFinite(px)) coreTotal += shares[j] * px;
      }
      if (coreTotal > 0) {
        for (let j = 0; j < nLegs; j++) {
          if (isDividendOnly[j]) continue;
          const px = rawCloses[j][t];
          if (px > 0 && Number.isFinite(px)) {
            shares[j] = (coreTotal * weights[j]) / px;
          }
        }
      }
    }

    totalNominal = totalAfter > 0 ? totalAfter : prevNominal;
    nominalWealth[t] = totalNominal;
  }

  // Snapshot per-leg final value at the last date (for current-weight pie).
  const lastIdx = N - 1;
  const finalLegValues = new Array(nLegs).fill(0);
  for (let j = 0; j < nLegs; j++) {
    const px = rawCloses[j][lastIdx];
    if (px > 0 && Number.isFinite(px)) finalLegValues[j] = shares[j] * px;
  }

  return { twrReturns, twrWealth, nominalWealth, finalLegValues };
}

function simulateSingleAsset(args: {
  closes: number[];
  contributions: number[];
  dates: string[];
}): SimOutput {
  const { closes, contributions } = args;
  const N = closes.length;
  let shares = 0;
  let totalNominal = 0;
  if (contributions[0] > 0 && closes[0] > 0) {
    shares = contributions[0] / closes[0];
    totalNominal = contributions[0];
  }
  const nominalWealth = new Array(N).fill(0);
  const twrWealth = new Array(N).fill(1);
  const twrReturns: number[] = [];
  nominalWealth[0] = totalNominal;

  for (let t = 1; t < N; t++) {
    const px = closes[t];
    const preContrib = px > 0 ? shares * px : totalNominal;
    const prevNominal = totalNominal;
    const r = prevNominal > 0 ? preContrib / prevNominal - 1 : 0;
    twrReturns.push(r);
    twrWealth[t] = twrWealth[t - 1] * (1 + r);
    let totalAfter = preContrib;
    if (contributions[t] > 0 && px > 0) {
      shares += contributions[t] / px;
      totalAfter += contributions[t];
    }
    totalNominal = totalAfter > 0 ? totalAfter : prevNominal;
    nominalWealth[t] = totalNominal;
  }
  return { twrReturns, twrWealth, nominalWealth, finalLegValues: [totalNominal] };
}

/* ───────────────── DCA schedule ───────────────── */

/**
 * Returns the indices into `dates` corresponding to the first trading day of
 * each DCA period (always includes index 0). For "biweekly" this groups ISO
 * weeks into pairs starting from the first analysis week.
 */
function buildDcaSchedule(dates: string[], freq: DcaFrequency): number[] {
  if (dates.length === 0) return [];
  const out: number[] = [0];
  let lastKey = dcaPeriodKey(dates[0], freq, dates[0]);
  for (let i = 1; i < dates.length; i++) {
    const key = dcaPeriodKey(dates[i], freq, dates[0]);
    if (key !== lastKey) {
      out.push(i);
      lastKey = key;
    }
  }
  return out;
}

function dcaPeriodKey(iso: string, freq: DcaFrequency, anchorIso: string): string {
  if (freq === "monthly") return iso.slice(0, 7);
  if (freq === "quarterly") {
    const y = iso.slice(0, 4);
    const m = parseInt(iso.slice(5, 7), 10);
    const q = Math.floor((m - 1) / 3);
    return `${y}-Q${q}`;
  }
  if (freq === "weekly") {
    return isoWeekKey(new Date(iso + "T00:00:00Z"));
  }
  // biweekly: bucket by week count since anchor, /2.
  const anchor = new Date(anchorIso + "T00:00:00Z");
  const today = new Date(iso + "T00:00:00Z");
  const weeks = Math.floor(
    (today.getTime() - anchor.getTime()) / (7 * 86400000),
  );
  return `BW-${Math.floor(weeks / 2)}`;
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
