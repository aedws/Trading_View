from __future__ import annotations

from datetime import date
from typing import List

import pandas as pd


def build_dca_dates(
    calendar_index: pd.DatetimeIndex,
    start: date,
    end: date,
    freq: str = "W-FRI",
) -> List[pd.Timestamp]:
    """
    달력 빈도별 이론 매수일 후, 실제 첫 거래일으로 스냅(캘린더에 없으면 다음 거래일).

    Parameters
    ----------
    calendar_index
        히스토리에 존재하는 거래일 인덱스(정렬됨).
    freq
        pandas offset alias. 검증 케이스에 맞추려면 ``W-FRI`` / ``W-WED`` 등을 CLI로 바꿉니다.
    """
    if calendar_index.empty:
        return []
    idx = calendar_index.sort_values()
    ci_start = max(pd.Timestamp(start), idx.min())
    ci_end = min(pd.Timestamp(end), idx.max())

    raw = pd.date_range(ci_start.normalize(), ci_end.normalize(), freq=freq)
    snaps: list[pd.Timestamp] = []
    values = idx.values
    for d in raw:
        pos = idx.searchsorted(d, side="left")
        if pos >= len(idx):
            continue
        snaps.append(pd.Timestamp(idx[pos]))
    # 중복 제거(같은 거래일 스냅)
    out: list[pd.Timestamp] = []
    seen = set()
    for s in snaps:
        k = s.normalize()
        if k not in seen:
            seen.add(k)
            out.append(s)
    return out
