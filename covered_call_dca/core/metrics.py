from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from scipy.optimize import brentq

from .data import TickerBundle
from .dca_engine import BacktestResult


def xnpv(rate: float, dates: List[pd.Timestamp], amounts: List[float]) -> float:
    if not amounts:
        return 0.0
    origin = dates[0]
    return sum(
        float(amt) / (1 + float(rate)) ** (((d - origin).days) / 365.25) for d, amt in zip(dates, amounts)
    )


def xirr(flows: List[Tuple[pd.Timestamp, float]], guess: Optional[float] = None) -> float:
    """이전거래금리(연율). 해가 없거나 실패하면 nan."""
    if len(flows) < 2:
        return np.nan
    dates = [pd.Timestamp(t) for t, _ in flows]
    amounts = [float(a) for _, a in flows]
    pos = any(a > 0 for a in amounts)
    neg = any(a < 0 for a in amounts)
    if not (pos and neg):
        return np.nan

    def f(r):
        try:
            return xnpv(r, dates, amounts)
        except (OverflowError, ZeroDivisionError, ValueError):
            return np.sign(r + 2) * 1e18

    if guess is not None:
        try:
            return float(brentq(f, guess - 0.999, guess + 3, maxiter=200))
        except ValueError:
            pass

    for lo in np.linspace(-0.999, 10, 100):
        for hi in np.linspace(lo + 0.01, 12, 80):
            try:
                vlo, vhi = f(lo), f(hi)
                if np.isnan(vlo) or np.isnan(vhi):
                    continue
                if vlo == 0:
                    return float(lo)
                if vhi == 0:
                    return float(hi)
                if vlo * vhi < 0:
                    return float(brentq(f, lo, hi, maxiter=200))
            except ValueError:
                continue
    return np.nan


def max_drawdown(wealth: pd.Series) -> float:
    """음수 표기 예: -0.13 == -13%"""
    x = wealth.astype(float).values
    if len(x) < 2:
        return np.nan
    peak = np.maximum.accumulate(x)
    dd = np.where(peak <= 1e-12, np.nan, (x / peak) - 1.0)
    return float(np.nanmin(dd))


def cagr_from_wealth(wealth: pd.Series, end: date) -> float:
    if len(wealth) < 2:
        return np.nan
    s = float(wealth.iloc[0])
    e_w = float(wealth.iloc[-1])
    if s <= 1e-12 or e_w <= 1e-12:
        return np.nan
    t0 = wealth.index[0]
    years = ((pd.Timestamp(end) - pd.Timestamp(t0.date())).days) / 365.25
    if years <= 0:
        return np.nan
    return (e_w / s) ** (1 / years) - 1.0


def detect_distribution_frequency(days_between: pd.Series) -> str:
    if days_between.empty:
        return "unknown"
    md = float(days_between.median())
    if md <= 9:
        return "weekly_or_faster"
    if md <= 21:
        return "approximately_weekly"
    if md <= 45:
        return "approximately_monthly"
    if md <= 100:
        return "approximately_quarterly"
    return "irregular_or_infrequent"


def dividend_intervals(bundle: TickerBundle, start: date, end: date) -> Tuple[str, float]:
    d = bundle.dividends.loc[
        (bundle.dividends.index.normalize() >= pd.Timestamp(start))
        & (bundle.dividends.index.normalize() <= pd.Timestamp(end))
    ]
    d = d[d > 0]
    if len(d) < 2:
        return detect_distribution_frequency(pd.Series(dtype=float)), float("nan")

    deltas = pd.Series(sorted(d.index)).diff().dt.days.iloc[1:]
    return detect_distribution_frequency(deltas), float(deltas.median())


def sliding_one_year_returns(wealth: pd.Series, window: int = 252) -> pd.Series:
    """거래일 window 롤링, 단순 (W_t/W_{t-w})-1"""
    return wealth / wealth.shift(window) - 1.0


@dataclass
class MetricsPack:
    irr: float
    mdd: float
    cagr: float
    cash_on_cash: float
    contributed: float
    terminal_wealth: float
    lump_terminal: float
    lump_irr: float
    voo_terminal: float
    voo_irr: float
    dist_freq_label: str
    dist_freq_median_days: float
    slide_rolling_mean: float
    slide_rolling_std: float
    slide_win_p10: float
    slide_win_p50: float
    slide_win_p90: float
    extras: Dict[str, float]


def _wealth_active(wealth: pd.Series) -> pd.Series:
    """첫 유의미 자산 발생 이후만 MDD/CAGR 롤링에 사용."""
    v = wealth.astype(float).values
    nz = np.where(v > 1e-9)[0]
    if nz.size == 0:
        return wealth
    return wealth.iloc[int(nz[0]) :]


def compute_all_metrics(
    bundle: TickerBundle,
    dca: BacktestResult,
    lump: Optional[BacktestResult] = None,
    voo: Optional[BacktestResult] = None,
) -> MetricsPack:
    irr_raw = xirr(sorted(dca.flows, key=lambda x: x[0]))
    contrib = float(dca.contributed)
    term = float(dca.wealth.iloc[-1])
    coc = (term - contrib) / contrib if contrib > 1e-9 else np.nan

    w_act = _wealth_active(dca.wealth)
    mdd_val = max_drawdown(w_act)
    cagr_val = cagr_from_wealth(w_act, dca.end)

    freq_lab, freq_med = dividend_intervals(bundle, dca.start, dca.end)

    wl = len(w_act)
    win = 252 if wl > 253 else max(42, wl // 3)
    slid = sliding_one_year_returns(w_act, window=win)
    sl_valid = slid.replace([np.inf, -np.inf], np.nan).dropna()

    def _pct(x):
        return float(np.nanpercentile(sl_valid.values.astype(float), x))

    lump_t = lump.wealth.iloc[-1] if lump is not None else np.nan
    lump_ir = xirr(sorted(lump.flows, key=lambda x: x[0])) if lump is not None else np.nan
    vt = voo.wealth.iloc[-1] if voo is not None else np.nan
    vi = xirr(sorted(voo.flows, key=lambda x: x[0])) if voo is not None else np.nan

    return MetricsPack(
        irr=irr_raw,
        mdd=mdd_val,
        cagr=float(cagr_val),
        cash_on_cash=float(coc),
        contributed=contrib,
        terminal_wealth=term,
        lump_terminal=float(lump_t),
        lump_irr=float(lump_ir),
        voo_terminal=float(vt),
        voo_irr=float(vi),
        dist_freq_label=freq_lab,
        dist_freq_median_days=freq_med,
        slide_rolling_mean=float(sl_valid.mean()) if len(sl_valid) else np.nan,
        slide_rolling_std=float(sl_valid.std(ddof=1)) if len(sl_valid) > 1 else np.nan,
        slide_win_p10=_pct(10) if len(sl_valid) else np.nan,
        slide_win_p50=_pct(50) if len(sl_valid) else np.nan,
        slide_win_p90=_pct(90) if len(sl_valid) else np.nan,
        extras={},
    )
