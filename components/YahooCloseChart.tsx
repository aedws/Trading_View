"use client";

import { fmtDate, fmtPrice } from "@/lib/format";
import { toTradingViewSymbol, tradingViewWebPath } from "@/lib/tvSymbol";

type Point = { date: string; close: number };

type Props = {
  ticker: string;
  longName?: string;
  currency: string;
  points: Point[];
  height: number;
};

const VB_W = 1400;
const VB_H = 640;
const PL = 78;
const PR = 20;
const PT = 36;
const PB = 44;

export default function YahooCloseChart({
  ticker,
  longName,
  currency,
  points,
  height,
}: Props) {
  const valid = points.filter((p) => Number.isFinite(p.close));
  const cw = VB_W - PL - PR;
  const ch = VB_H - PT - PB;

  const pathD = (() => {
    if (valid.length < 2) return "";
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of valid) {
      lo = Math.min(lo, p.close);
      hi = Math.max(hi, p.close);
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.06;
    lo -= pad;
    hi += pad;
    const span = hi - lo || 1;
    const n = valid.length;
    return valid
      .map((p, i) => {
        const x = PL + (i / (n - 1)) * cw;
        const y = PT + (1 - (p.close - lo) / span) * ch;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  })();

  const yTicks = (() => {
    if (valid.length < 2) return [] as { y: number; label: string }[];
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of valid) {
      lo = Math.min(lo, p.close);
      hi = Math.max(hi, p.close);
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.06;
    lo -= pad;
    hi += pad;
    const span = hi - lo || 1;
    const steps = 5;
    const ticks: { y: number; label: string }[] = [];
    for (let i = 0; i <= steps; i++) {
      const v = lo + (span * i) / steps;
      const yy = PT + (1 - (v - lo) / span) * ch;
      ticks.push({
        y: yy,
        label:
          currency === "KRW"
            ? `${Math.round(v).toLocaleString("ko-KR")}`
            : v.toFixed(v >= 100 ? 2 : 3),
      });
    }
    return ticks;
  })();

  const first = valid[0];
  const last = valid[valid.length - 1];
  const lastPrice = last?.close;
  const change =
    first && last && Number.isFinite(first.close) && Number.isFinite(last.close)
      ? last.close - first.close
      : NaN;
  const chgPct =
    first && last && Number.isFinite(first.close) && first.close !== 0
      ? (change / first.close) * 100
      : NaN;

  const tvSym = toTradingViewSymbol(ticker);
  const tvUrl = `https://www.tradingview.com/symbols/${encodeURIComponent(
    tradingViewWebPath(tvSym)
  )}/`;

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-bg-card shrink-0">
      <div className="px-4 pt-3 pb-1 border-b border-border-soft flex flex-wrap items-baseline gap-x-4 gap-y-1 min-h-[2.75rem]">
        <span className="font-mono text-sm text-gray-100">{ticker}</span>
        {longName && (
          <span className="text-xs text-gray-400 truncate max-w-md">{longName}</span>
        )}
        <span className="text-lg font-semibold num">
          {fmtPrice(lastPrice, currency)}
        </span>
        {Number.isFinite(change) && Number.isFinite(chgPct) && (
          <span
            className={`text-sm num ${
              change > 0
                ? "text-accent-green"
                : change < 0
                ? "text-accent-red"
                : "text-gray-400"
            }`}
          >
            {change > 0 ? "+" : ""}
            {currency === "KRW"
              ? `${Math.round(change).toLocaleString("ko-KR")}`
              : change.toFixed(2)}{" "}
            ({chgPct > 0 ? "+" : ""}
            {chgPct.toFixed(2)}% · 구간)
          </span>
        )}
      </div>

      <div className="w-full bg-bg-card" style={{ height, minHeight: height }}>
        {valid.length < 2 ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-500">
            표시할 가격 데이터가 부족합니다.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="w-full h-full block"
            preserveAspectRatio="none"
            aria-label={`${ticker} 종가 차트`}
          >
            <rect x={0} y={0} width={VB_W} height={VB_H} fill="#0f1419" />

            {/* plot area frame */}
            <rect
              x={PL}
              y={PT}
              width={cw}
              height={ch}
              fill="none"
              stroke="#1f2937"
              strokeWidth={1}
            />

            {/* horizontal grid */}
            {yTicks.map((t, i) => (
              <line
                key={i}
                x1={PL}
                x2={PL + cw}
                y1={t.y}
                y2={t.y}
                stroke="#1f293799"
                strokeWidth={1}
              />
            ))}

            {/* y-axis labels */}
            {yTicks.map((t, i) => (
              <text
                key={i}
                x={PL - 8}
                y={t.y + 4}
                textAnchor="end"
                fill="#6b7280"
                fontSize={11}
                className="num"
              >
                {t.label}
              </text>
            ))}

            {/* x-axis dates */}
            {first && (
              <text
                x={PL}
                y={VB_H - 14}
                fill="#6b7280"
                fontSize={11}
                className="num"
              >
                {fmtDate(first.date)}
              </text>
            )}
            {valid[Math.floor(valid.length / 2)] && (
              <text
                x={PL + cw / 2}
                y={VB_H - 14}
                textAnchor="middle"
                fill="#6b7280"
                fontSize={11}
                className="num"
              >
                {fmtDate(valid[Math.floor(valid.length / 2)].date)}
              </text>
            )}
            {last && (
              <text
                x={PL + cw}
                y={VB_H - 14}
                textAnchor="end"
                fill="#6b7280"
                fontSize={11}
                className="num"
              >
                {fmtDate(last.date)}
              </text>
            )}

            <path
              d={pathD}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      <div className="px-3 py-2 text-[10px] text-gray-500 border-t border-border-soft flex items-center justify-between gap-2 flex-wrap">
        <span>
          <span className="text-gray-400">야후 일봉 종가</span>
          <span className="text-gray-600 mx-1">·</span>
          TradingView 임베드는 KRX 등에서 제한될 수 있어 이 구간은 대체 차트입니다.
        </span>
        <a
          href={tvUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-blue hover:underline shrink-0"
        >
          TV 심볼 페이지 ↗ ({tvSym})
        </a>
      </div>
    </div>
  );
}
