/**
 * Iterative Cooley-Tukey radix-2 FFT, in-place. Length must be a power of 2.
 *
 * Input: real and imaginary arrays (modified in place).
 * If `inverse=true`, computes the inverse FFT and divides by N.
 */
export function fftRadix2(re: number[], im: number[], inverse = false): void {
  const n = re.length;
  if (n !== im.length || (n & (n - 1)) !== 0)
    throw new Error("fftRadix2: length must be power of 2 and equal");

  // Bit reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = ((inverse ? 2 : -2) * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < half; k++) {
        const xRe = re[i + k];
        const xIm = im[i + k];
        const yRe = re[i + k + half] * curRe - im[i + k + half] * curIm;
        const yIm = re[i + k + half] * curIm + im[i + k + half] * curRe;
        re[i + k] = xRe + yRe;
        im[i + k] = xIm + yIm;
        re[i + k + half] = xRe - yRe;
        im[i + k + half] = xIm - yIm;
        const nextRe = curRe * wRe - curIm * wIm;
        const nextIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
        curIm = nextIm;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

/** Pad a real input to the next power of 2, returning re/im arrays. */
export function padToPow2(x: number[]): { re: number[]; im: number[] } {
  let m = 1;
  while (m < x.length) m <<= 1;
  const re = new Array(m).fill(0);
  const im = new Array(m).fill(0);
  for (let i = 0; i < x.length; i++) re[i] = x[i];
  return { re, im };
}

/**
 * Power spectrum (one-sided) of a real input.
 * Returns periods[k] = N / k (in samples) and power[k] for k = 1 .. N/2.
 *
 * The input series is detrended (subtract OLS linear fit) and a Hann window
 * is applied before the FFT to reduce leakage.
 */
export function powerSpectrum(x: number[]): {
  periods: number[];
  power: number[];
  topPeriods: { period: number; power: number; rank: number }[];
} {
  const N0 = x.length;
  if (N0 < 32)
    return { periods: [], power: [], topPeriods: [] };

  // Linear detrend
  const sumX = (N0 * (N0 - 1)) / 2;
  const sumX2 = (N0 * (N0 - 1) * (2 * N0 - 1)) / 6;
  let sumY = 0;
  let sumXY = 0;
  for (let i = 0; i < N0; i++) {
    sumY += x[i];
    sumXY += i * x[i];
  }
  const denom = N0 * sumX2 - sumX * sumX;
  const slope = (N0 * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / N0;
  const detr = new Array(N0);
  for (let i = 0; i < N0; i++) detr[i] = x[i] - (intercept + slope * i);

  // Hann window
  for (let i = 0; i < N0; i++) {
    detr[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N0 - 1)));
  }

  const { re, im } = padToPow2(detr);
  fftRadix2(re, im, false);
  const N = re.length;
  const half = Math.floor(N / 2);
  const periods: number[] = [];
  const power: number[] = [];
  for (let k = 1; k <= half; k++) {
    periods.push(N / k);
    power.push(re[k] * re[k] + im[k] * im[k]);
  }
  const ranked = power
    .map((p, i) => ({ period: periods[i], power: p, idx: i }))
    .sort((a, b) => b.power - a.power);
  // Filter very-low-frequency artifacts (period > N/3)
  const filtered = ranked.filter((r) => r.period <= N0 / 2 && r.period >= 4);
  const topPeriods = filtered.slice(0, 5).map((r, rank) => ({
    period: r.period,
    power: r.power,
    rank: rank + 1,
  }));
  return { periods, power, topPeriods };
}
