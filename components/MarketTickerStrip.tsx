"use client";

import { useEffect, useState } from "react";

type MarketQuote = {
  symbol: string;
  label: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string | null;
};

function fmtPrice(value: number | null, currency: string | null, label: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (label === "달러 환율") return `₩${Math.round(value).toLocaleString("ko-KR")}`;
  if (currency === "KRW") return Math.round(value).toLocaleString("ko-KR");
  if (currency === "USD") return value.toFixed(value >= 100 ? 2 : 3);
  return value.toFixed(2);
}

export default function MarketTickerStrip({
  selectedSymbol,
  onSelectSymbol,
}: {
  /** 현재 대시보드에서 분석 중인 야후 심볼 (강조용) */
  selectedSymbol?: string | null;
  /** 카드 클릭 시 호출 → 차트·지표 분석 틱커와 동기화 */
  onSelectSymbol?: (yahooSymbol: string) => void;
}) {
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  useEffect(() => {
    let timer: number | undefined;
    const load = async () => {
      try {
        const res = await fetch("/api/market", { cache: "no-store" });
        const data = await res.json();
        if (res.ok && Array.isArray(data.quotes)) {
          setQuotes(data.quotes);
          setUpdatedAt(data.updatedAt ?? "");
        }
      } catch {
        // keep last data
      }
    };
    load();
    timer = window.setInterval(load, 30000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="rounded-xl border border-border bg-bg-card overflow-x-auto">
      <div className="min-w-[1100px] px-3 py-2 flex items-center gap-3">
        {quotes.map((q) => {
          const up = (q.changePercent ?? 0) > 0;
          const down = (q.changePercent ?? 0) < 0;
          const active =
            selectedSymbol != null &&
            selectedSymbol.replace(/\s+/g, "").toUpperCase() ===
              q.symbol.replace(/\s+/g, "").toUpperCase();
          const interactive = typeof onSelectSymbol === "function";
          return (
            <button
              key={q.symbol}
              type="button"
              disabled={!interactive}
              title={
                interactive
                  ? `${q.label} 차트·지표 분석 보기 (${q.symbol})`
                  : undefined
              }
              onClick={() => interactive && onSelectSymbol(q.symbol)}
              className={`shrink-0 rounded-lg border px-2.5 py-1.5 min-w-[130px] text-left transition ${
                interactive
                  ? "cursor-pointer hover:border-accent-blue/60 hover:bg-bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/50"
                  : "cursor-default"
              } ${
                active
                  ? "border-accent-blue bg-accent-blue/15 ring-1 ring-accent-blue/35"
                  : "border-border-soft bg-bg-soft"
              }`}
            >
              <div className="text-[10px] text-gray-400 leading-none mb-1">{q.label}</div>
              <div className="text-sm font-semibold num">{fmtPrice(q.price, q.currency, q.label)}</div>
              <div
                className={`text-[11px] num leading-none mt-1 ${
                  up ? "text-accent-green" : down ? "text-accent-red" : "text-gray-400"
                }`}
              >
                {q.changePercent == null
                  ? "—"
                  : `${up ? "+" : ""}${q.changePercent.toFixed(2)}%`}
              </div>
            </button>
          );
        })}
        <div className="ml-auto text-[10px] text-gray-500 shrink-0">
          업데이트: {updatedAt ? new Date(updatedAt).toLocaleTimeString("ko-KR") : "—"}
        </div>
      </div>
    </div>
  );
}

