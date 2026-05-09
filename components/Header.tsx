"use client";

import TickerInput from "./TickerInput";
import type { RangeKey } from "@/lib/types";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "1y", label: "1Y" },
  { key: "2y", label: "2Y" },
  { key: "3y", label: "3Y" },
  { key: "5y", label: "5Y" },
  { key: "10y", label: "10Y" },
  { key: "max", label: "MAX" },
];

export default function Header({
  ticker,
  range,
  onTicker,
  onRange,
  loading,
}: {
  ticker: string;
  range: RangeKey;
  onTicker: (t: string) => void;
  onRange: (r: RangeKey) => void;
  loading: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 bg-bg/80 backdrop-blur border-b border-border">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="text-lg font-bold tracking-tight">
            <span className="text-accent-blue">시장</span>분석기
          </div>
          <div className="text-[10px] text-gray-500 hidden md:inline">
            TradingView + 통계·장세·리스크·주기 수학 대시보드
          </div>
        </div>
        <div className="flex-1 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
          <TickerInput initial={ticker} onSubmit={onTicker} />
          <div className="flex bg-bg-soft border border-border rounded-lg p-0.5 text-xs">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => onRange(r.key)}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  range === r.key
                    ? "bg-accent-blue text-white"
                    : "text-gray-400 hover:text-gray-100"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {loading && (
            <span className="text-xs text-gray-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
              계산중
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
