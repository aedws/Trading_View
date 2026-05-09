from __future__ import annotations

from .dca_engine import BacktestConfig, BacktestResult
from .grading import GradeResult, grade_public_label
from .metrics import MetricsPack


def build_ai_prompt(
    ticker: str,
    cfg: BacktestConfig,
    _dca: BacktestResult,
    metrics: MetricsPack,
    grade: GradeResult,
) -> str:
    """LLM에 그대로 붙여넣기용 — 구조화된 맥락."""
    return "\n".join(
        [
            "You are a quantitative finance assistant. Summarize and critique the following covered-call / high-yield ETF DCA backtest (Yahoo Finance data, simplified model).",
            "Focus on risk (MDD, rolling 1y distribution), return (IRR vs lump vs VOO if present), whether distribution frequency looks sustainable, and limitations of the model.",
            "Answer in Korean for the end user; use bullet points; do not give buy/sell advice.",
            "",
            f"Ticker: {ticker}",
            f"Window: {cfg.start} to {cfg.end}",
            f"DCA: ${cfg.period_amount:g} with freq {cfg.dca_freq}, reinvest mode = {cfg.reinvest}",
            f"Contributed: ${metrics.contributed:g}, terminal: ${metrics.terminal_wealth:g}",
            f"IRR: {metrics.irr:.4f}, MDD: {metrics.mdd:.4f}, CoC: {metrics.cash_on_cash:.4f}, CAGR(simple): {metrics.cagr:.4f}",
            f"Distribution spacing (median days): {metrics.dist_freq_median_days}, label: {metrics.dist_freq_label}",
            f"Rolling window mean return: {metrics.slide_rolling_mean:.4f}, p10-p90: {metrics.slide_win_p10:.4f} .. {metrics.slide_win_p90:.4f}",
            f"Rule grade: {grade_public_label(grade.code)} — {grade.reason}",
            f"Lump terminal: {metrics.lump_terminal}, lump IRR: {metrics.lump_irr}",
            f"VOO terminal: {metrics.voo_terminal}, VOO IRR: {metrics.voo_irr}",
        ]
    )
