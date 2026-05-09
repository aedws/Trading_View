from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from .data import TickerBundle, load_ticker_history, align_leg_prices
from .reinvest import DISTILL_LEG1, DISTILL_LEG2, DISTILL_W1, DISTILL_W2, ReinvestMode
from .schedule import build_dca_dates


def _apply_split(shares: float, split_ratio: float) -> float:
    if split_ratio == 0 or not np.isfinite(split_ratio):
        return shares
    return shares * float(split_ratio)


def _slice_range(bundle: TickerBundle, start: date, end: date) -> Tuple[pd.DataFrame, pd.Series]:
    m = (bundle.prices.index.normalize() >= pd.Timestamp(start)) & (
        bundle.prices.index.normalize() <= pd.Timestamp(end)
    )
    px = bundle.prices.loc[m]
    div = bundle.dividends.reindex(px.index).fillna(0.0)
    return px, div


@dataclass
class BacktestConfig:
    ticker: str
    start: date
    end: date
    period_amount: float = 500.0
    dca_freq: str = "W-FRI"
    reinvest: ReinvestMode = ReinvestMode.NO_REINVEST
    benchmark: str = "VOO"


@dataclass
class BacktestResult:
    ticker: str
    start: date
    end: date
    cfg: BacktestConfig
    wealth: pd.Series  # 거래일별 평가
    primary_shares: pd.Series
    cash: pd.Series
    distill: Optional[Dict[str, pd.Series]] = None
    flows: List[Tuple[pd.Timestamp, float]] = field(default_factory=list)
    contributed: float = 0.0


def run_backtest(
    bundle: TickerBundle,
    cfg: BacktestConfig,
    *,
    progress: bool = False,
) -> BacktestResult:
    px, bundle_div = _slice_range(bundle, cfg.start, cfg.end)
    if px.empty:
        raise ValueError("백테스트 구간 내 거래 데이터가 없습니다.")

    calendar = px.index

    distill_frames: Dict[str, pd.Series] = {}
    if cfg.reinvest == ReinvestMode.DISTILL_QQQI70_SPYI30:
        legs = align_leg_prices([DISTILL_LEG1, DISTILL_LEG2], cfg.start, cfg.end, progress=progress)
        distill_frames = {k: v.reindex(calendar).ffill().bfill() for k, v in legs.items()}

    dca_dates = set(build_dca_dates(calendar, cfg.start, cfg.end, cfg.dca_freq))
    contrib = len(dca_dates) * cfg.period_amount

    wealth_list: List[float] = []
    shr_hist: List[float] = []
    cash_hist: List[float] = []
    d_hist = {DISTILL_LEG1: [], DISTILL_LEG2: []}

    shares = 0.0
    cash = 0.0
    sh_q = sh_s = 0.0
    flows: List[Tuple[pd.Timestamp, float]] = []

    for ts in calendar:
        row_close = float(px.loc[ts, "close"])
        split_ratio = float(px.loc[ts, "split"])

        shares = _apply_split(shares, split_ratio)

        div_ps = float(bundle_div.loc[ts])
        div_cash = div_ps * shares

        if cfg.reinvest == ReinvestMode.NO_REINVEST:
            if div_cash > 1e-9:
                cash += div_cash
        elif cfg.reinvest == ReinvestMode.SELF_REINVEST:
            if div_cash > 1e-9 and row_close > 0:
                shares += div_cash / row_close
        elif cfg.reinvest == ReinvestMode.DISTILL_QQQI70_SPYI30:
            if div_cash > 1e-9:
                pq = float(distill_frames[DISTILL_LEG1].loc[ts])
                ps = float(distill_frames[DISTILL_LEG2].loc[ts])
                if pq > 0 and ps > 0:
                    sh_q += (div_cash * DISTILL_W1) / pq
                    sh_s += (div_cash * DISTILL_W2) / ps

        if ts in dca_dates and row_close > 0:
            flows.append((ts, -float(cfg.period_amount)))
            shares += cfg.period_amount / row_close

        pq_e = distill_frames.get(DISTILL_LEG1)
        ps_e = distill_frames.get(DISTILL_LEG2)
        leg_v = 0.0
        if pq_e is not None and ps_e is not None:
            leg_v += sh_q * float(pq_e.loc[ts])
            leg_v += sh_s * float(ps_e.loc[ts])
        mv = shares * row_close + cash + leg_v
        wealth_list.append(mv)

        shr_hist.append(shares)
        cash_hist.append(cash)
        d_hist[DISTILL_LEG1].append(sh_q)
        d_hist[DISTILL_LEG2].append(sh_s)

    wealth = pd.Series(wealth_list, index=calendar, name="wealth")
    primary_shares = pd.Series(shr_hist, index=calendar)
    cash_ser = pd.Series(cash_hist, index=calendar)
    distill_ser = None
    if cfg.reinvest == ReinvestMode.DISTILL_QQQI70_SPYI30:
        distill_ser = {
            DISTILL_LEG1: pd.Series(d_hist[DISTILL_LEG1], index=calendar),
            DISTILL_LEG2: pd.Series(d_hist[DISTILL_LEG2], index=calendar),
        }

    last_ts = calendar[-1]
    terminal = float(wealth.iloc[-1])
    flows.append((last_ts, terminal))

    return BacktestResult(
        ticker=bundle.ticker,
        start=cfg.start,
        end=cfg.end,
        cfg=cfg,
        wealth=wealth,
        primary_shares=primary_shares,
        cash=cash_ser,
        distill=distill_ser,
        flows=flows,
        contributed=contrib,
    )


def run_lump_sum(
    bundle: TickerBundle,
    cfg: BacktestConfig,
    total_contributed: float,
    *,
    progress: bool = False,
) -> BacktestResult:
    px, bundle_div = _slice_range(bundle, cfg.start, cfg.end)
    if px.empty:
        raise ValueError("백테스트 구간 내 거래 데이터가 없습니다.")

    calendar = px.index

    distill_frames: Dict[str, pd.Series] = {}
    if cfg.reinvest == ReinvestMode.DISTILL_QQQI70_SPYI30:
        legs = align_leg_prices([DISTILL_LEG1, DISTILL_LEG2], cfg.start, cfg.end, progress=progress)
        distill_frames = {k: v.reindex(calendar).ffill().bfill() for k, v in legs.items()}

    first_ts = calendar[0]
    row0 = float(px.loc[first_ts, "close"])

    flows: List[Tuple[pd.Timestamp, float]] = [(first_ts, -float(total_contributed))]

    shares = total_contributed / row0
    cash = 0.0
    sh_q = sh_s = 0.0
    wealth_list: List[float] = []
    shr_hist: List[float] = []
    cash_hist: List[float] = []
    d_hist = {DISTILL_LEG1: [], DISTILL_LEG2: []}

    for ts in calendar:
        row_close = float(px.loc[ts, "close"])
        split_ratio = float(px.loc[ts, "split"])
        shares = _apply_split(shares, split_ratio)

        div_ps = float(bundle_div.loc[ts])
        div_cash = div_ps * shares

        if cfg.reinvest == ReinvestMode.NO_REINVEST:
            if div_cash > 1e-9:
                cash += div_cash
        elif cfg.reinvest == ReinvestMode.SELF_REINVEST:
            if div_cash > 1e-9 and row_close > 0:
                shares += div_cash / row_close
        elif cfg.reinvest == ReinvestMode.DISTILL_QQQI70_SPYI30:
            if div_cash > 1e-9:
                pq = float(distill_frames[DISTILL_LEG1].loc[ts])
                ps = float(distill_frames[DISTILL_LEG2].loc[ts])
                if pq > 0 and ps > 0:
                    sh_q += (div_cash * DISTILL_W1) / pq
                    sh_s += (div_cash * DISTILL_W2) / ps

        pq_e = distill_frames.get(DISTILL_LEG1)
        ps_e = distill_frames.get(DISTILL_LEG2)
        leg_v = 0.0
        if pq_e is not None and ps_e is not None:
            leg_v += sh_q * float(pq_e.loc[ts])
            leg_v += sh_s * float(ps_e.loc[ts])

        mv = shares * row_close + cash + leg_v
        wealth_list.append(mv)
        shr_hist.append(shares)
        cash_hist.append(cash)
        d_hist[DISTILL_LEG1].append(sh_q)
        d_hist[DISTILL_LEG2].append(sh_s)

    wealth = pd.Series(wealth_list, index=calendar, name="wealth")
    last_ts = calendar[-1]
    flows.append((last_ts, float(wealth.iloc[-1])))

    distill_ser = None
    if cfg.reinvest == ReinvestMode.DISTILL_QQQI70_SPYI30:
        distill_ser = {
            DISTILL_LEG1: pd.Series(d_hist[DISTILL_LEG1], index=calendar),
            DISTILL_LEG2: pd.Series(d_hist[DISTILL_LEG2], index=calendar),
        }

    return BacktestResult(
        ticker=bundle.ticker,
        start=cfg.start,
        end=cfg.end,
        cfg=cfg,
        wealth=wealth,
        primary_shares=pd.Series(shr_hist, index=calendar),
        cash=pd.Series(cash_hist, index=calendar),
        distill=distill_ser,
        flows=flows,
        contributed=float(total_contributed),
    )


def load_benchmark_bundle(sym: str, start: date, end: date, *, progress=False) -> TickerBundle:
    return load_ticker_history(sym, start, end, progress=progress)
