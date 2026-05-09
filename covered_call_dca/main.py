#!/usr/bin/env python3
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

import click

# 패키지 루트를 path에 넣어 `python main.py` 직접 실행 지원
_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from core.ai_prompt import build_ai_prompt  # noqa: E402
from core.data import load_ticker_history  # noqa: E402
from core.dca_engine import BacktestConfig, run_backtest, run_lump_sum  # noqa: E402
from core.grading import grade_ticker  # noqa: E402
from core.metrics import compute_all_metrics  # noqa: E402
from core.report_md import render_markdown_report  # noqa: E402
from core.reinvest import ReinvestMode  # noqa: E402


@click.command(context_settings={"help_option_names": ["-h", "--help"]})
@click.option("--ticker", "-t", required=True, help="야후 거래 심볼")
@click.option("--start", required=True, type=click.DateTime(formats=["%Y-%m-%d"]))
@click.option("--end", required=True, type=click.DateTime(formats=["%Y-%m-%d"]))
@click.option(
    "--amount",
    default=500.0,
    show_default=True,
    help="적립 회당 금액 USD",
)
@click.option(
    "--freq",
    default="W-FRI",
    show_default=True,
    help="pandas 오프셋 (예 W-FRI, W-WED, ME)",
)
@click.option(
    "--reinvest",
    type=click.Choice([m.value for m in ReinvestMode], case_sensitive=False),
    default=ReinvestMode.NO_REINVEST.value,
    show_default=True,
)
@click.option("--output", "-o", type=click.Path(path_type=Path), default=None)
@click.option(
    "--mode",
    type=click.Choice(["report", "ai_prompt", "both"], case_sensitive=False),
    default="report",
)
@click.option("--no-benchmark", is_flag=True, help="VOO·일시불 비교 생략")
def main(
    ticker: str,
    start: click.DateTime,
    end: click.DateTime,
    amount: float,
    freq: str,
    reinvest: str,
    output: Path | None,
    mode: str,
    no_benchmark: bool,
) -> None:
    """yfinance 기반 단일자산 DCA 백테스트 → 메트릭·등급·마크다운/프롬프트."""
    s: date = start.date()
    e: date = end.date()
    if e < s:
        raise click.ClickException("end가 start보다 이전입니다.")

    mode_e = ReinvestMode(reinvest.lower())
    cfg = BacktestConfig(
        ticker=ticker.strip().upper(),
        start=s,
        end=e,
        period_amount=amount,
        dca_freq=freq,
        reinvest=mode_e,
    )

    bundle = load_ticker_history(cfg.ticker, s, e)
    dca = run_backtest(bundle, cfg)
    lump = None
    voo_br = None
    if not no_benchmark:
        lump = run_lump_sum(bundle, cfg, dca.contributed)
        voo_b = load_ticker_history(cfg.benchmark, s, e)
        voo_br = run_backtest(voo_b, cfg)

    metrics = compute_all_metrics(bundle, dca, lump=lump, voo=voo_br)
    gr = grade_ticker(cfg.ticker, metrics)

    md = render_markdown_report(cfg.ticker, cfg, dca, metrics, gr, lump=lump, voo=voo_br)
    prompt = build_ai_prompt(cfg.ticker, cfg, dca, metrics, gr)

    out_text = (
        md
        if mode == "report"
        else prompt
        if mode == "ai_prompt"
        else md + "\n\n---\n\n## AI 프롬프트\n\n" + prompt
    )

    if output:
        output.write_text(out_text, encoding="utf-8")
        click.echo(f"Wrote {output}")
    else:
        click.echo(out_text)


if __name__ == "__main__":
    main()
