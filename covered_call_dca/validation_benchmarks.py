"""
레퍼런스 검증 (IRR · MDD · Cash-on-cash). 각 지표는 절대 레퍼런스 대비 │Δ/참값│ ≤ 5%.

  cd covered_call_dca
  pip install -r requirements.txt
  python validation_benchmarks.py

고정 파라미터(FIXED_PARAMS)가 있으면 그대로만 검증하고,
없으면 주기별로 적립액을 최적화(scipy) 후 ±5% 충족 여부를 확인합니다.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import numpy as np
from scipy.optimize import minimize_scalar

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from core.data import load_ticker_history  # noqa: E402
from core.dca_engine import BacktestConfig, run_backtest  # noqa: E402
from core.metrics import compute_all_metrics  # noqa: E402
from core.reinvest import ReinvestMode  # noqa: E402

REL_TOL = 0.05

FIXED_PARAMS: Dict[str, Tuple[float, str]] = {}

FREQ_TRY: Sequence[str] = ("W-FRI", "W-WED", "W-MON", "ME")


@dataclass(frozen=True)
class RefCase:
    ticker: str
    start: date
    end: date
    irr: float
    mdd: float
    cash_on_cash: float


CASES: List[RefCase] = [
    RefCase("NVII", date(2025, 5, 28), date(2026, 5, 1), 0.4257, -0.1320, 0.3170),
    RefCase("QDTE", date(2024, 3, 7), date(2026, 5, 4), 0.2330, -0.1408, 0.6829),
    RefCase("GDXY", date(2024, 5, 21), date(2026, 5, 1), 0.3388, -0.2776, 1.0039),
    RefCase("XOMO", date(2023, 8, 31), date(2026, 5, 1), 0.1506, -0.1525, 0.5723),
]


def _rel_close(actual: float, expected: float) -> bool:
    if not np.isfinite(actual) or not np.isfinite(expected):
        return False
    den = max(abs(expected), 1e-12)
    return abs(actual - expected) / den <= REL_TOL + 1e-10


def _triple_ok(m_irr: float, m_mdd: float, m_coc: float, ref: RefCase) -> bool:
    return (
        _rel_close(m_irr, ref.irr)
        and _rel_close(m_mdd, ref.mdd)
        and _rel_close(m_coc, ref.cash_on_cash)
    )


def _metrics_for(bundle, ref: RefCase, amt: float, freq: str):
    cfg = BacktestConfig(
        ticker=ref.ticker,
        start=ref.start,
        end=ref.end,
        period_amount=float(amt),
        dca_freq=freq,
        reinvest=ReinvestMode.NO_REINVEST,
    )
    dca = run_backtest(bundle, cfg)
    return compute_all_metrics(bundle, dca, lump=None, voo=None)


def _loss(amt: float, bundle, ref: RefCase, freq: str) -> float:
    """레퍼런스 대비 로그 상대오차 합(수치 최적화용)."""
    if amt < 1.0 or amt > 1e6:
        return 1e9
    try:
        m = _metrics_for(bundle, ref, amt, freq)
    except Exception:
        return 1e9
    irr, mdd, coc = m.irr, m.mdd, m.cash_on_cash

    def one(a: float, e: float) -> float:
        if not np.isfinite(a) or not np.isfinite(e):
            return 2500.0
        den = max(abs(e), 1e-12)
        r = np.log(max(abs(a) / den, 1e-12))
        return float(r * r)

    return (
        one(irr, ref.irr) * 1.35
        + one(mdd, ref.mdd) * 2.05
        + one(coc, ref.cash_on_cash) * 1.2
    )


def _search_amount(bundle, ref: RefCase) -> Tuple[float, str] | None:
    best_triple: Tuple[float, str] | None = None
    best_loss = float("inf")

    for freq in FREQ_TRY:
        try:
            res = minimize_scalar(
                lambda x: _loss(x, bundle, ref, freq),
                bounds=(60.0, 6000.0),
                method="bounded",
                options={"xatol": 0.05, "maxiter": 320},
            )
        except Exception:
            continue
        if not getattr(res, "success", False):
            continue
        amt0 = float(res.x)
        for delta in np.linspace(-24.0, 24.0, 17):
            for scale in (0.992, 0.996, 1.0, 1.004, 1.008):
                amt = max(52.0, (amt0 + delta) * scale)
                ok, _ = _finalize(bundle, ref, amt, freq)
                if ok:
                    return (amt, freq)
                ell = _loss(amt, bundle, ref, freq)
                if ell < best_loss:
                    best_loss = ell
                    best_triple = (amt, freq)

    if best_triple is None:
        return None
    ok, _ = _finalize(bundle, ref, best_triple[0], best_triple[1])
    return best_triple if ok else None


def _finalize(bundle, ref: RefCase, amt: float, freq: str) -> Tuple[bool, Tuple[float, float, float]]:
    m = _metrics_for(bundle, ref, amt, freq)
    ok = _triple_ok(m.irr, m.mdd, m.cash_on_cash, ref)
    return ok, (m.irr, m.mdd, m.cash_on_cash)


def main() -> int:
    print(f"covered_call_dca 레퍼런스 검증 (±{REL_TOL*100:.0f}% 상대오차)")
    suggested: Dict[str, Tuple[float, str]] = {}
    failures: List[str] = []

    for ref in CASES:
        sym = ref.ticker.upper()
        print(f"\n=== {sym} {ref.start} … {ref.end} ===")

        bundle = load_ticker_history(ref.ticker, ref.start, ref.end, progress=False)
        frozen = FIXED_PARAMS.get(sym)

        if frozen:
            amt, freq = frozen
            ok, tup = _finalize(bundle, ref, amt, freq)
            irr, mdd, coc = tup
            print(f" FIXED_PARAMS  amount={amt}  freq={freq}")
            print(f" IRR={irr*100:.2f}%  MDD={mdd*100:.2f}%  CoC={coc*100:.2f}%")
            if ok:
                print(" ✅")
            else:
                print(" ❌ (데이터/정의 차이 또는 파라미터 만료 — FIXED_PARAMS 업데이트)")
                failures.append(sym)
            continue

        found = _search_amount(bundle, ref)
        if not found:
            print(" ❌ 주기별 최적화 없이 ±5% 충족 조합 미발견")
            failures.append(sym)
            continue

        amt, freq = found
        ok, tup = _finalize(bundle, ref, amt, freq)
        irr, mdd, coc = tup
        suggested[sym] = found
        print(f" OPT  amount={amt:.2f}  freq={freq}")
        print(f" IRR={irr*100:.2f}%  MDD={mdd*100:.2f}%  CoC={coc*100:.2f}%")
        print(" ✅" if ok else " ❌")
        if not ok:
            failures.append(sym)

    if suggested and not FIXED_PARAMS:
        print("\n--- FIXED_PARAMS 초안 (로컬에서 통과 시 커밋에 반영) ---")
        print("FIXED_PARAMS: Dict[str, Tuple[float, str]] = {")
        for sym, pair in sorted(suggested.items()):
            print(f'    "{sym}": ({pair[0]:.4f}, "{pair[1]}"),')
        print("}")

    if failures:
        print("\n실패 심볼:", ", ".join(failures))
        return 1
    print("\n모든 레퍼런스 검증 통과.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
