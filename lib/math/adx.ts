import type { Bar } from "../types";

/**
 * Wilder's smoothing (a.k.a. RMA): a recursive EMA with alpha = 1/period.
 * SMA seed for the first period.
 */
function wilderSmooth(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NaN);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  out[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + values[i]) / period;
  }
  return out;
}

/**
 * Average Directional Index (ADX) — Wilder.
 * Returns ADX series + the latest value.
 *
 * Interpretation (typical):
 *   ADX < 20  → weak / no trend
 *   20–25    → developing
 *   25–50    → strong trend (direction read separately from +DI/-DI)
 *   > 50     → very strong; > 75 extreme
 */
export function adx(
  bars: Bar[],
  period = 14
): {
  adx: number[];
  plusDI: number[];
  minusDI: number[];
  last: { adx: number; plusDI: number; minusDI: number };
} {
  const n = bars.length;
  const tr: number[] = new Array(n).fill(0);
  const plusDM: number[] = new Array(n).fill(0);
  const minusDM: number[] = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    const h = bars[i].high;
    const l = bars[i].low;
    const pc = bars[i - 1].close;
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    const upMove = h - bars[i - 1].high;
    const downMove = bars[i - 1].low - l;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }

  // Drop the seed 0 at index 0 to align with Wilder's smoothing on bars[1..]
  const trS = wilderSmooth(tr.slice(1), period);
  const pS = wilderSmooth(plusDM.slice(1), period);
  const mS = wilderSmooth(minusDM.slice(1), period);

  const plusDI: number[] = new Array(n).fill(NaN);
  const minusDI: number[] = new Array(n).fill(NaN);
  const dx: number[] = [];
  for (let i = 0; i < trS.length; i++) {
    if (!isFinite(trS[i]) || trS[i] === 0) continue;
    const pdi = 100 * (pS[i] / trS[i]);
    const mdi = 100 * (mS[i] / trS[i]);
    plusDI[i + 1] = pdi;
    minusDI[i + 1] = mdi;
    const denom = pdi + mdi;
    dx.push(denom === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / denom);
  }

  const adxRaw = wilderSmooth(dx, period);
  const adxArr: number[] = new Array(n).fill(NaN);
  // First valid ADX index in the bars array:
  // dx[k] corresponds to bars index k+1; adxRaw needs `period` more bars.
  const offset = 1 + (period - 1); // first dx index that has a valid adx value at +period-1
  for (let i = 0; i < adxRaw.length; i++) {
    const idx = i + offset;
    if (idx < n) adxArr[idx] = adxRaw[i];
  }

  const last = {
    adx: adxArr[n - 1] ?? NaN,
    plusDI: plusDI[n - 1] ?? NaN,
    minusDI: minusDI[n - 1] ?? NaN,
  };
  return { adx: adxArr, plusDI, minusDI, last };
}
