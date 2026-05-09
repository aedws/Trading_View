import { fftRadix2, padToPow2 } from "./fft";

/**
 * Discrete Hilbert transform via FFT, giving the analytic signal z = x + i·H(x).
 * Returns instantaneous amplitude (envelope), instantaneous phase (radians),
 * and instantaneous frequency (cycles per sample) on the original-length series.
 *
 * Reference: Marple (1999), "Computing the Discrete-Time Analytic Signal via FFT".
 */
export function analyticSignal(x: number[]): {
  amplitude: number[];
  phase: number[];
  frequency: number[];
  /** dominant cycle (samples) inferred from median of last-third instantaneous freq */
  dominantPeriod: number;
} {
  const N0 = x.length;
  if (N0 < 32)
    return { amplitude: [], phase: [], frequency: [], dominantPeriod: NaN };

  // Detrend (subtract mean) to keep envelope sensible
  let m = 0;
  for (const v of x) m += v;
  m /= N0;
  const xc = x.map((v) => v - m);

  const { re, im } = padToPow2(xc);
  const N = re.length;
  fftRadix2(re, im, false);

  // Construct the analytic-signal frequency mask
  // H[0] = 1, H[N/2] = 1 (if exists), H[1..N/2-1] = 2, H[N/2+1..N-1] = 0
  for (let k = 1; k < N / 2; k++) {
    re[k] *= 2;
    im[k] *= 2;
  }
  for (let k = Math.floor(N / 2) + 1; k < N; k++) {
    re[k] = 0;
    im[k] = 0;
  }
  fftRadix2(re, im, true);

  const amplitude: number[] = new Array(N0);
  const phase: number[] = new Array(N0);
  for (let i = 0; i < N0; i++) {
    amplitude[i] = Math.hypot(re[i], im[i]);
    phase[i] = Math.atan2(im[i], re[i]);
  }
  // Unwrap phase, then differentiate to get instantaneous frequency
  const unwrapped = unwrap(phase);
  const frequency: number[] = new Array(N0).fill(NaN);
  for (let i = 1; i < N0; i++) {
    frequency[i] = (unwrapped[i] - unwrapped[i - 1]) / (2 * Math.PI);
  }

  // Estimate dominant period as the median of the absolute frequency
  // over the last 1/3 of the series, then convert.
  const start = Math.floor((N0 * 2) / 3);
  const tail = frequency
    .slice(start)
    .map((f) => Math.abs(f))
    .filter((f) => isFinite(f) && f > 0);
  let dominantPeriod = NaN;
  if (tail.length > 0) {
    const sorted = [...tail].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    if (med > 0) dominantPeriod = 1 / med;
  }
  return { amplitude, phase: unwrapped, frequency, dominantPeriod };
}

function unwrap(phase: number[]): number[] {
  const out = new Array(phase.length);
  out[0] = phase[0];
  let offset = 0;
  for (let i = 1; i < phase.length; i++) {
    const d = phase[i] - phase[i - 1];
    if (d > Math.PI) offset -= 2 * Math.PI;
    else if (d < -Math.PI) offset += 2 * Math.PI;
    out[i] = phase[i] + offset;
  }
  return out;
}
