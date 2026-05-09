from __future__ import annotations

from datetime import date
from typing import Optional

from .dca_engine import BacktestConfig, BacktestResult
from .grading import GradeResult, grade_public_label
from .metrics import MetricsPack
from .reinvest import ReinvestMode


def render_markdown_report(
    ticker: str,
    cfg: BacktestConfig,
    dca: BacktestResult,
    metrics: MetricsPack,
    grade: GradeResult,
    *,
    lump: Optional[BacktestResult] = None,
    voo: Optional[BacktestResult] = None,
) -> str:
    rn = ReinvestMode(cfg.reinvest)
    pct = lambda x: "**—**" if x != x else f"{x * 100:.2f}%"

    lines = [
        f"# 커버드콜 DCA 분석 리포트: `{ticker}`",
        "",
        "## 개요",
        f"- 분석구간: **{cfg.start}** ~ **{cfg.end}**",
        f"- 적립금액/주기: **${cfg.period_amount:g}**, `{cfg.dca_freq}`",
        f"- 재투자모드: `{rn.value}`",
        f"- 총납입(시뮬): **${metrics.contributed:g}** · 종료자산 **${metrics.terminal_wealth:g}**",
        "",
        "## 지표 요약",
        f"|항목|값|",
        f"|---|---|",
        f"|IRR (연환산 XIRR 근사)|{pct(metrics.irr)}|",
        f"|MDD (wealth 기준)|{pct(metrics.mdd)}|",
        f"|CAGR · wealth 곡선|{pct(metrics.cagr)}|",
        f"|Cash-on-cash (종료-납입)/납입|{pct(metrics.cash_on_cash)}|",
        f"|분배 리듬 추정 (중앙 간격 일)| `{metrics.dist_freq_label}` / {metrics.dist_freq_median_days:.1f}|",
        f"|Sliding-window 수익 분포 평균|{pct(metrics.slide_rolling_mean)}| "
        f"σ={pct(metrics.slide_rolling_std)}, p10–p90={pct(metrics.slide_win_p10)} … {pct(metrics.slide_win_p90)}|",
        "",
        "## 비교",
    ]

    if lump is not None:
        lines.append(
            f"- **Lump-sum** (동액 초기 매수 후 동일 규칙): 종가 ${metrics.lump_terminal:g}, IRR {pct(metrics.lump_irr)}"
        )
    if voo is not None:
        lines.append(
            f"- **VOO 벤치마크** (동일 DCA 파라미터): 종가 ${metrics.voo_terminal:g}, IRR {pct(metrics.voo_irr)}"
        )

    lines.extend(
        [
            "",
            "## 등급",
            f"- **{grade_public_label(grade.code)}** — {grade.reason}",
            "",
            "---",
            "*교육·참고용. 야후 데이터 지연·세금·수수료·슬리피지 미반영.*",
        ]
    )
    return "\n".join(lines)
