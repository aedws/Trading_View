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

/** 전일 종가 대비 당일 시가 갭 비율 (야후 OHLC 필요 시 확장) — 종가→전일 종가 갭으로 근사 */
export function overnightGapStats(closes: number[]): {
  gapUpPct: number;
  gapDownPct: number;
  bothWayPenalty: boolean;
} {
  let up = 0;
  let down = 0;
  let n = 0;
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const cur = closes[i];
    if (prev <= 0) continue;
    const g = (cur - prev) / prev;
    if (g > 0.02) up++;
    if (g < -0.02) down++;
    n++;
  }
  const gapUpPct = n ? up / n : 0;
  const gapDownPct = n ? down / n : 0;
  return {
    gapUpPct,
    gapDownPct,
    bothWayPenalty: gapUpPct > 0.08 && gapDownPct > 0.08,
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
