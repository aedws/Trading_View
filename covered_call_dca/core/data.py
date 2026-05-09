from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import pandas as pd
import yfinance as yf


@dataclass(frozen=True)
class TickerBundle:
    """
    ticker: 표시 심볼.
    prices: 일봉 — close=당일 종가(분할 전가), adj_close=Yahoo 수정종가(참고), split=분할 비율(0 또는 배수).
    dividends: 해당 일 현금 분배 /주 (실제 과세·DRIP 가정에는 Close 기준 보유 주수 적용).
    """

    ticker: str
    prices: pd.DataFrame  # close, adj_close, split
    dividends: pd.Series


def _normalize_index(df: pd.DataFrame) -> pd.DataFrame:
    if df.index.tz is not None:
        df = df.copy()
        df.index = df.index.tz_localize(None)
    df = df.sort_index()
    return df


def load_ticker_history(
    ticker: str,
    start: date,
    end: date,
    *,
    progress: bool = False,
) -> TickerBundle:
    """
    Yahoo 일봉. auto_adjust=False + actions 로 분할·현금 분배를 분리하고,
    시뮬레이션 체결가는 보통 ``close``(당일 종가), 분배는 ``dividends``로 적립합니다.
    """
    t = yf.Ticker(ticker)
    hist = t.history(
        start=start.isoformat(),
        end=(pd.Timestamp(end) + pd.Timedelta(days=1)).date().isoformat(),
        auto_adjust=False,
        actions=True,
        repair=True,
        progress=progress,
    )
    hist = _normalize_index(hist)
    if hist.empty:
        raise ValueError(f"{ticker}: 가격 이력이 비어 있습니다.")

    if "Adj Close" not in hist.columns:
        raise ValueError(f"{ticker}: Adj Close 컬럼 없음")

    splits = hist["Stock Splits"].fillna(0.0) if "Stock Splits" in hist.columns else 0.0
    div_row = hist["Dividends"].fillna(0.0) if "Dividends" in hist.columns else 0.0

    prices = pd.DataFrame(
        {
            "close": hist["Close"].astype(float),
            "adj_close": hist["Adj Close"].astype(float),
            "split": splits.astype(float),
        }
    )

    div = pd.Series(div_row.values.astype(float), index=prices.index, name="div")
    mask = (prices.index.date >= start) & (prices.index.date <= end)
    prices = prices.loc[mask]
    div = div.loc[mask]
    div = div[div > 1e-12]
    return TickerBundle(ticker=ticker.upper(), prices=prices, dividends=div)


def align_leg_prices(
    tickers: list[str],
    start: date,
    end: date,
    *,
    progress: bool = False,
) -> dict[str, pd.Series]:
    """distill 등 다자산용 — 날짜 인덱스 맞춘 adj_close만."""
    out: dict[str, pd.Series] = {}
    for sym in tickers:
        b = load_ticker_history(sym, start, end, progress=progress)
        out[sym.upper()] = b.prices["close"]
    return out
