import type { PriceSeries } from "./types";
import { logReturns, mean, stdev, quantile } from "./math/stats";
import { logLinearChannel, ar1HalfLife } from "./math/regression";
import { drawdownAnalysis } from "./math/drawdown";
import { acf, ljungBoxQ } from "./math/autocorr";
import { hurstRS } from "./math/hurst";
import { adx } from "./math/adx";
import { volRegime, ewmaVolSeries } from "./math/vol";
import {
  historicalVaR,
  parametricVaR,
  historicalCVaR,
  sharpe,
  sortino,
  calmar,
  annualizedReturn,
  tailRisk,
} from "./math/risk";
import { powerSpectrum } from "./math/fft";
import { analyticSignal } from "./math/hilbert";
import { haarMulti, haarBandLabels } from "./math/wavelet";

export type AnalysisReport = {
  meta: {
    ticker: string;
    longName?: string;
    currency: string;
    bars: number;
    firstDate: string;
    lastDate: string;
    lastPrice: number;
  };
  // ----- charts data -----
  pricesForChart: { date: string; close: number; logClose: number }[];
  regressionChannel: {
    a: number;
    b: number;
    cagr: number;
    r2: number;
    sigma: number;
    lastZ: number;
    series: { date: string; mid: number; up1: number; dn1: number; up2: number; dn2: number }[];
  };
  zscore: {
    window: number;
    current: number;
    lastValues: { date: string; z: number; price: number; mean: number; sd: number }[];
  };
  meanReversion: {
    phi: number;
    halfLife: number; // days
    spreadSeries: { date: string; spread: number }[];
  };
  hurst: { H: number; r2: number };
  adx: { last: { adx: number; plusDI: number; minusDI: number } };
  volRegime: {
    current: number;
    median: number;
    p25: number;
    p75: number;
    p95: number;
    label: string;
    zscore: number;
    series: { date: string; ann: number }[];
  };
  autocorr: { lags: number[]; values: number[]; q10: number; q20: number; n: number };
  risk: {
    days: number;
    annualizedReturn: number;
    annualizedVol: number;
    sharpe: number;
    sortino: number;
    calmar: number;
    historicalVaR95: number;
    historicalVaR99: number;
    parametricVaR95: number;
    cvar95: number;
    cvar99: number;
    mdd: number;
    currentDrawdown: number;
    drawdownSeries: { date: string; dd: number }[];
    daysToRecover: number | null;
  };
  tail: {
    skew: number;
    exKurt: number;
    leftTail: number;
    rightTail: number;
    tailRatio: number;
    histogram: { bin: number; count: number }[];
    bins: { lo: number; hi: number; mid: number; count: number }[];
  };
  fft: {
    topPeriods: { period: number; power: number; rank: number }[];
    spectrum: { period: number; power: number }[]; // truncated
  };
  hilbert: {
    dominantPeriod: number;
    series: { date: string; price: number; envelope: number; instFreq: number }[];
  };
  wavelet: {
    bands: string[];
    energies: number[];
  };
};

const TRADING_DAYS = 252;

function fmtFloat(x: number, n = 6): number {
  if (!isFinite(x)) return NaN;
  return Number(x.toFixed(n));
}

export function analyze(series: PriceSeries): AnalysisReport {
  const bars = series.bars;
  const closes = bars.map((b) => b.adjClose);
  const dates = bars.map((b) => b.date);
  const rets = logReturns(closes);
  const N = closes.length;

  // ----- log-linear regression channel -----
  const ch = logLinearChannel(closes);
  const channelSeries = bars.map((b, i) => {
    const fitted = ch.a + ch.b * i;
    return {
      date: b.date,
      mid: Math.exp(fitted),
      up1: Math.exp(fitted + ch.sigma),
      dn1: Math.exp(fitted - ch.sigma),
      up2: Math.exp(fitted + 2 * ch.sigma),
      dn2: Math.exp(fitted - 2 * ch.sigma),
    };
  });

  // ----- rolling Z-score (60d) -----
  const Z_WIN = 60;
  const zSeries: {
    date: string;
    z: number;
    price: number;
    mean: number;
    sd: number;
  }[] = [];
  for (let i = Z_WIN - 1; i < N; i++) {
    const slice = closes.slice(i - Z_WIN + 1, i + 1);
    const m = mean(slice);
    const sd = stdev(slice, true);
    const z = sd > 0 ? (closes[i] - m) / sd : NaN;
    zSeries.push({ date: dates[i], z, price: closes[i], mean: m, sd });
  }
  const lastZRow = zSeries[zSeries.length - 1];

  // ----- mean reversion (Ornstein–Uhlenbeck-style) on log-prices -----
  const logCloses = closes.map((c) => Math.log(c));
  const fit = logLinearChannel(closes);
  const spread = closes.map((_, i) => logCloses[i] - (fit.a + fit.b * i));
  const ar = ar1HalfLife(spread);
  const spreadSeries = bars.map((b, i) => ({ date: b.date, spread: spread[i] }));

  // ----- Hurst -----
  const H = hurstRS(rets);

  // ----- ADX -----
  const adxOut = adx(bars, 14);

  // ----- Volatility regime -----
  const vr = volRegime(rets);
  const ewma = ewmaVolSeries(rets).annualized;
  const volSeries = bars.map((b, i) => ({
    date: b.date,
    ann: i < ewma.length ? ewma[i] : NaN,
  }));

  // ----- Autocorrelation -----
  const lagsMax = 20;
  const acVals = acf(rets, lagsMax);
  const q10 = ljungBoxQ(acVals, rets.length, 10);
  const q20 = ljungBoxQ(acVals, rets.length, 20);

  // ----- Risk -----
  const dd = drawdownAnalysis(closes);
  const annRet = annualizedReturn(rets);
  const annVol = stdev(rets, true) * Math.sqrt(TRADING_DAYS);
  const var95 = historicalVaR(rets, 0.95);
  const var99 = historicalVaR(rets, 0.99);
  const pVar95 = parametricVaR(rets, 0.95);
  const cvar95 = historicalCVaR(rets, 0.95);
  const cvar99 = historicalCVaR(rets, 0.99);
  const sR = sharpe(rets);
  const soR = sortino(rets);
  const cR = calmar(rets, dd.mdd);

  // days to recover from worst drawdown (or null if not yet)
  const daysToRecover =
    dd.recoverIdx >= 0 ? dd.recoverIdx - dd.troughIdx : null;

  const drawdownSeries = bars.map((b, i) => ({ date: b.date, dd: dd.series[i] }));

  // ----- Tail risk + histogram -----
  const tail = tailRisk(rets);
  const lo = quantile(rets, 0.005);
  const hi = quantile(rets, 0.995);
  const NB = 40;
  const width = (hi - lo) / NB;
  const counts = new Array(NB).fill(0);
  for (const r of rets) {
    if (r < lo || r > hi) continue;
    const idx = Math.min(NB - 1, Math.max(0, Math.floor((r - lo) / width)));
    counts[idx]++;
  }
  const histBins = counts.map((c, i) => ({
    lo: lo + i * width,
    hi: lo + (i + 1) * width,
    mid: lo + (i + 0.5) * width,
    count: c,
  }));

  // ----- FFT on detrended log-returns -----
  const ps = powerSpectrum(rets);
  // Reduce spectrum to a smaller, plot-friendly range (period 4..N/2)
  const trimmed = ps.periods
    .map((p, i) => ({ period: p, power: ps.power[i] }))
    .filter((r) => r.period >= 4 && r.period <= rets.length / 2);
  // Down-sample to ~60 points logarithmically for the chart
  const targetN = 60;
  const trimmedSorted = trimmed.sort((a, b) => a.period - b.period);
  const spectrumChart: { period: number; power: number }[] = [];
  if (trimmedSorted.length > 0) {
    const minLog = Math.log(trimmedSorted[0].period);
    const maxLog = Math.log(trimmedSorted[trimmedSorted.length - 1].period);
    for (let i = 0; i < targetN; i++) {
      const target = Math.exp(minLog + ((maxLog - minLog) * i) / (targetN - 1));
      // find nearest
      let best = trimmedSorted[0];
      let bestD = Math.abs(best.period - target);
      for (const t of trimmedSorted) {
        const d = Math.abs(t.period - target);
        if (d < bestD) {
          best = t;
          bestD = d;
        }
      }
      if (
        spectrumChart.length === 0 ||
        spectrumChart[spectrumChart.length - 1].period !== best.period
      ) {
        spectrumChart.push(best);
      }
    }
  }

  // ----- Hilbert envelope -----
  const hb = analyticSignal(closes);
  const hilbertSeries: {
    date: string;
    price: number;
    envelope: number;
    instFreq: number;
  }[] = bars.map((b, i) => ({
    date: b.date,
    price: closes[i],
    envelope: hb.amplitude[i] ?? NaN,
    instFreq: hb.frequency[i] ?? NaN,
  }));

  // ----- Haar wavelet decomposition on log-returns -----
  const wv = haarMulti(rets, 6);
  const bandLabels = haarBandLabels(wv.energies.length);

  // === Build report ===
  return {
    meta: {
      ticker: series.ticker,
      longName: series.longName,
      currency: series.currency,
      bars: N,
      firstDate: dates[0],
      lastDate: dates[N - 1],
      lastPrice: closes[N - 1],
    },
    pricesForChart: bars.map((b) => ({
      date: b.date,
      close: b.adjClose,
      logClose: Math.log(b.adjClose),
    })),
    regressionChannel: {
      a: fmtFloat(ch.a),
      b: fmtFloat(ch.b),
      cagr: fmtFloat(ch.cagr),
      r2: fmtFloat(ch.r2, 4),
      sigma: fmtFloat(ch.sigma, 4),
      lastZ: fmtFloat(ch.lastZ, 3),
      series: channelSeries,
    },
    zscore: {
      window: Z_WIN,
      current: lastZRow ? fmtFloat(lastZRow.z, 3) : NaN,
      lastValues: zSeries.slice(-360), // last ~1.5y for chart
    },
    meanReversion: {
      phi: fmtFloat(ar.phi, 4),
      halfLife: fmtFloat(ar.halfLife, 1),
      spreadSeries: spreadSeries.slice(-720), // last ~3y
    },
    hurst: { H: fmtFloat(H.H, 3), r2: fmtFloat(H.r2, 3) },
    adx: {
      last: {
        adx: fmtFloat(adxOut.last.adx, 1),
        plusDI: fmtFloat(adxOut.last.plusDI, 1),
        minusDI: fmtFloat(adxOut.last.minusDI, 1),
      },
    },
    volRegime: {
      current: fmtFloat(vr.current, 4),
      median: fmtFloat(vr.median, 4),
      p25: fmtFloat(vr.p25, 4),
      p75: fmtFloat(vr.p75, 4),
      p95: fmtFloat(vr.p95, 4),
      label: vr.label,
      zscore: fmtFloat(vr.zscore, 2),
      series: volSeries.slice(-720),
    },
    autocorr: {
      lags: Array.from({ length: lagsMax }, (_, i) => i + 1),
      values: acVals.slice(1).map((v) => fmtFloat(v, 4)),
      q10: fmtFloat(q10, 2),
      q20: fmtFloat(q20, 2),
      n: rets.length,
    },
    risk: {
      days: rets.length,
      annualizedReturn: fmtFloat(annRet, 4),
      annualizedVol: fmtFloat(annVol, 4),
      sharpe: fmtFloat(sR, 3),
      sortino: fmtFloat(soR, 3),
      calmar: fmtFloat(cR, 3),
      historicalVaR95: fmtFloat(var95, 4),
      historicalVaR99: fmtFloat(var99, 4),
      parametricVaR95: fmtFloat(pVar95, 4),
      cvar95: fmtFloat(cvar95, 4),
      cvar99: fmtFloat(cvar99, 4),
      mdd: fmtFloat(dd.mdd, 4),
      currentDrawdown: fmtFloat(dd.current, 4),
      drawdownSeries,
      daysToRecover,
    },
    tail: {
      skew: fmtFloat(tail.skew, 3),
      exKurt: fmtFloat(tail.exKurt, 3),
      leftTail: fmtFloat(tail.leftTail, 4),
      rightTail: fmtFloat(tail.rightTail, 4),
      tailRatio: fmtFloat(tail.tailRatio, 3),
      histogram: counts.map((c, i) => ({ bin: i, count: c })),
      bins: histBins,
    },
    fft: {
      topPeriods: ps.topPeriods.map((p) => ({
        period: fmtFloat(p.period, 1),
        power: fmtFloat(p.power, 6),
        rank: p.rank,
      })),
      spectrum: spectrumChart.map((p) => ({
        period: fmtFloat(p.period, 1),
        power: fmtFloat(p.power, 6),
      })),
    },
    hilbert: {
      dominantPeriod: fmtFloat(hb.dominantPeriod, 1),
      series: hilbertSeries.slice(-360),
    },
    wavelet: {
      bands: bandLabels,
      energies: wv.energies.map((e) => fmtFloat(e, 4)),
    },
  };
}
