/** 커버드콜 DCA 편의 지표 */

export function maxDrawdown(wealth: number[]): number {
  if (wealth.length < 2) return NaN;
  let peak = -Infinity;
  let minDd = 0;
  for (const x of wealth) {
    if (!Number.isFinite(x) || x <= 0) continue;
    peak = Math.max(peak, x);
    const dd = x / peak - 1;
    minDd = Math.min(minDd, dd);
  }
  return minDd;
}

export function wealthActive(wealth: number[]): number[] {
  const idx = wealth.findIndex((w) => w > 1e-9);
  if (idx < 0) return wealth;
  return wealth.slice(idx);
}

export function cagrFromWealth(
  activeWealth: number[],
  startIso: string,
  endIso: string,
): number {
  if (activeWealth.length < 2) return NaN;
  const s = activeWealth[0];
  const e = activeWealth[activeWealth.length - 1];
  if (s <= 1e-12 || e <= 1e-12) return NaN;
  const d0 = new Date(startIso + "T12:00:00Z").getTime();
  const d1 = new Date(endIso + "T12:00:00Z").getTime();
  const years = (d1 - d0) / (365.25 * 86400000);
  if (years <= 0) return NaN;
  return Math.pow(e / s, 1 / years) - 1;
}

export type DistFreq =
  | "weekly_or_faster"
  | "approximately_weekly"
  | "approximately_monthly"
  | "approximately_quarterly"
  | "irregular_or_infrequent"
  | "unknown";

export function dividendIntervals(divDatesSorted: string[]): {
  label: DistFreq;
  medianDays: number;
} {
  const divs = divDatesSorted.filter(Boolean).sort();
  if (divs.length < 2) return { label: "unknown", medianDays: NaN };
  const gaps: number[] = [];
  for (let i = 1; i < divs.length; i++) {
    const a = new Date(divs[i - 1] + "T12:00:00Z").getTime();
    const b = new Date(divs[i] + "T12:00:00Z").getTime();
    gaps.push((b - a) / 86400000);
  }
  gaps.sort((x, y) => x - y);
  const mid = gaps[Math.floor(gaps.length / 2)];
  const md = mid;
  let label: DistFreq = "irregular_or_infrequent";
  if (md <= 9) label = "weekly_or_faster";
  else if (md <= 21) label = "approximately_weekly";
  else if (md <= 45) label = "approximately_monthly";
  else if (md <= 100) label = "approximately_quarterly";
  return { label, medianDays: md };
}

export function slidingWindowReturns(
  wealth: number[],
  window: number,
): number[] {
  const out: number[] = [];
  for (let i = window; i < wealth.length; i++) {
    const prev = wealth[i - window];
    const cur = wealth[i];
    if (prev > 1e-12 && Number.isFinite(cur)) {
      out.push(cur / prev - 1);
    }
  }
  return out;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** 동일 거래일만 맞춘 종가 시계열 */
export function alignCloseByDate(
  primary: Array<{ date: string; close: number }>,
  bench: Array<{ date: string; close: number }>,
): { asset: number[]; bench: number[] } {
  const bm = new Map(bench.map((b) => [b.date, b.close]));
  const asset: number[] = [];
  const benchAr: number[] = [];
  for (const p of primary) {
    const bc = bm.get(p.date);
    if (
      bc !== undefined &&
      typeof p.close === "number" &&
      p.close > 0 &&
      bc > 0
    ) {
      asset.push(p.close);
      benchAr.push(bc);
    }
  }
  return { asset, bench: benchAr };
}

function medianSimple(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return NaN;
  const m = Math.floor(sortedAsc.length / 2);
  if (sortedAsc.length % 2) return sortedAsc[m];
  return (sortedAsc[m - 1] + sortedAsc[m]) / 2;
}

/**
 * 일간 종가 수익률 기준, 자산이 **하락한 날**에 벤치마크 대비 얼마나 더 떨어졌는지.
 * (상승 구간 갭은 원칙 2 판단에서 제외)
 */
export function downsideVsBenchStats(
  assetCloses: number[],
  benchCloses: number[],
  benchLabel: string,
): {
  benchLabel: string;
  tradingIntervals: number;
  /** 자산 일간 수익률 < 0 인 날의 (r_a - r_bench) 중앙값 */
  medianExcessWhenAssetDown: number;
  /** 전체 일간 구간 중 r_a<0 이고 r_a < r_bench 인 날 비율 */
  excessDownVsBenchShare: number;
  /** r_a<0 이고 (r_a - r_bench) < -1%p 인 날 비율 */
  severeExcessDownShare: number;
  /** 원칙 2 경고 */
  distress: boolean;
} {
  const n = Math.min(assetCloses.length, benchCloses.length);
  if (n < 3) {
    return {
      benchLabel,
      tradingIntervals: 0,
      medianExcessWhenAssetDown: NaN,
      excessDownVsBenchShare: NaN,
      severeExcessDownShare: NaN,
      distress: false,
    };
  }

  const excessWhenDown: number[] = [];
  let intervals = 0;
  let excessDownDays = 0;
  let severeDays = 0;

  for (let i = 1; i < n; i++) {
    const pa = assetCloses[i - 1];
    const ca = assetCloses[i];
    const pb = benchCloses[i - 1];
    const cb = benchCloses[i];
    if (pa <= 0 || pb <= 0) continue;
    const ra = ca / pa - 1;
    const rb = cb / pb - 1;
    const excess = ra - rb;
    intervals++;

    if (ra < 0) {
      excessWhenDown.push(excess);
      if (ra < rb) excessDownDays++;
      if (excess < -0.01) severeDays++;
    }
  }

  const sorted = [...excessWhenDown].sort((a, b) => a - b);
  const mid = medianSimple(sorted);

  const excessDownVsBenchShare = intervals ? excessDownDays / intervals : NaN;
  const severeExcessDownShare = intervals ? severeDays / intervals : NaN;

  const distress =
    intervals >= 30 &&
    (severeExcessDownShare > 0.06 ||
      (Number.isFinite(mid) && mid < -0.004 && severeExcessDownShare > 0.035));

  return {
    benchLabel,
    tradingIntervals: intervals,
    medianExcessWhenAssetDown: mid,
    excessDownVsBenchShare,
    severeExcessDownShare,
    distress,
  };
}

/** 일간 로그수익 연율화 변동성 (IV 프록시) */
export function realizedVolAnnual(closes: number[]): number {
  if (closes.length < 10) return NaN;
  const lr: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1];
    const b = closes[i];
    if (a > 0 && b > 0) lr.push(Math.log(b / a));
  }
  if (lr.length < 5) return NaN;
  const m = lr.reduce((s, x) => s + x, 0) / lr.length;
  const v =
    lr.reduce((s, x) => s + (x - m) ** 2, 0) / (lr.length - 1);
  return Math.sqrt(v * 252);
}
