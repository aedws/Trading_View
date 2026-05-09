/**
 * Single-stage Haar discrete wavelet transform (DWT).
 *
 * Splits a signal into:
 *   - approximation (low-pass average pairs / sqrt(2))
 *   - detail        (high-pass diff  pairs / sqrt(2))
 *
 * For input length N, both arrays have length floor(N/2).
 * If N is odd, the last sample is dropped.
 */
export function haarOnce(x: number[]): { a: number[]; d: number[] } {
  const n = Math.floor(x.length / 2);
  const a = new Array(n);
  const d = new Array(n);
  const s = Math.SQRT1_2; // 1/sqrt(2)
  for (let i = 0; i < n; i++) {
    a[i] = (x[2 * i] + x[2 * i + 1]) * s;
    d[i] = (x[2 * i] - x[2 * i + 1]) * s;
  }
  return { a, d };
}

/**
 * Multi-level Haar DWT. Returns the array of detail coefficients per level
 * and the final approximation.
 *
 * level k captures roughly the band of cycles around 2^(k+1) samples.
 *   k=1 → ~2-4 sample cycles ("noise / micro")
 *   k=2 → ~4-8
 *   k=3 → ~8-16
 *   k=4 → ~16-32
 *   k=5 → ~32-64
 *   k=6 → ~64-128
 */
export function haarMulti(
  x: number[],
  maxLevel = 6
): { details: number[][]; approx: number[]; energies: number[] } {
  let cur = x.slice();
  const details: number[][] = [];
  for (let lv = 0; lv < maxLevel && cur.length >= 2; lv++) {
    const { a, d } = haarOnce(cur);
    details.push(d);
    cur = a;
  }
  // Energy per level = sum of squared detail coefficients, normalized.
  const rawEnergy = details.map((d) => d.reduce((s, v) => s + v * v, 0));
  const total = rawEnergy.reduce((s, v) => s + v, 0);
  const energies = total > 0 ? rawEnergy.map((e) => e / total) : rawEnergy;
  return { details, approx: cur, energies };
}

/** Human-readable scale labels per level (in trading days). */
export function haarBandLabels(levels: number): string[] {
  const out: string[] = [];
  for (let k = 1; k <= levels; k++) {
    const lo = Math.pow(2, k);
    const hi = Math.pow(2, k + 1);
    out.push(`${lo}~${hi}일`);
  }
  return out;
}
