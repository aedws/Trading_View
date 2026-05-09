export type DrawdownInfo = {
  /** Maximum drawdown as a negative fraction, e.g. -0.42 means -42%. */
  mdd: number;
  /** Drawdown series (negative or 0) length = prices.length. */
  series: number[];
  /** Index of the peak that started the worst drawdown. */
  peakIdx: number;
  /** Index of the trough of the worst drawdown. */
  troughIdx: number;
  /** Index of recovery (price ≥ peak again). -1 if not yet recovered. */
  recoverIdx: number;
  /** Current drawdown (last value of series), in [-1, 0]. */
  current: number;
};

/** Compute drawdown series and worst-drawdown statistics from a price array. */
export function drawdownAnalysis(prices: number[]): DrawdownInfo {
  const n = prices.length;
  const series = new Array(n).fill(0);
  let runningPeak = -Infinity;
  let runningPeakIdx = 0;
  let mdd = 0;
  let worstPeakIdx = 0;
  let worstTroughIdx = 0;

  for (let i = 0; i < n; i++) {
    const p = prices[i];
    if (p > runningPeak) {
      runningPeak = p;
      runningPeakIdx = i;
    }
    const dd = runningPeak > 0 ? p / runningPeak - 1 : 0;
    series[i] = dd;
    if (dd < mdd) {
      mdd = dd;
      worstPeakIdx = runningPeakIdx;
      worstTroughIdx = i;
    }
  }

  // Recovery index after worst trough
  const peakPrice = prices[worstPeakIdx];
  let recoverIdx = -1;
  for (let i = worstTroughIdx + 1; i < n; i++) {
    if (prices[i] >= peakPrice) {
      recoverIdx = i;
      break;
    }
  }

  return {
    mdd,
    series,
    peakIdx: worstPeakIdx,
    troughIdx: worstTroughIdx,
    recoverIdx,
    current: series[n - 1] ?? 0,
  };
}
